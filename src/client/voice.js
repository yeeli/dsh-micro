// dsh-micro · client/src/voice.js
// 🎤 语音输入控制器：**优先用 DSH 官方那套语音输入，拿不到才回退到浏览器 Web Speech**
// （由 entry.js 装配进 DSVI.services.voice）。
//
// 为什么分两层：官方那套（`@deepseek-ai/dsh-experimental-voice-input-bundle`）是**宿主侧**的
// 本地 SenseVoice 识别 —— 录音在浏览器、识别在 DSH 所在的那台机器上；而它是**实验性且默认禁用**
// 的 Bundle：用户没在插件管理页启用，或启用了却没「下载并准备」模型时，就没有它。
// 于是：官方点得到 → 点它；官方不在 → 自己用 Web Speech 顶上。
// 「能不能点」的判据全部住在 `actions/dom.js`（DSH 界面结构的唯一一份理解，别在这儿再写一份），
// 这里只管**策略与状态**。
//
// 两条链路的差别（对外接口一致，所以调用方一行都不用改）：
//   * 官方 —— **点按 toggle**：点麦克风开始 → 点「停止并识别」结束，文字由官方自己插进草稿；
//   * Web Speech —— 我们自己收流式结果，再由 actions/index.js 的 DshOps.writeDraft 写回草稿。
//
// ⚠ **失败 / 反馈那一态**（2026-10-19）：官方识别失败后会把那条录音栏留在 `feedback` 上，
// 错误信息就挂在那儿。它不是「正在录音」，所以 `listening` 为 false；再按一次语音键时
// **先关掉那条栏、等麦克风回来、再开始新的录音**（#recoverOfficial）。判据全在 actions/dom.js，
// 这里只管时序 —— 不认识官方的槽位名，也不认识它的阶段属性与文案。
//
// 两种触发方式（都收口到 start / stop / toggle 三个方法上）：
//   * 输入框上的麦克风按钮 —— 点按 = toggle；**官方可用时这个按钮会自己让位**
//     （见 components/common/voice-button.jsx），免得输入区出现两个麦克风；
//   * 动作键 ACT10/ACT11（或设置页里绑成「语音」的摇杆/旋钮手势）—— **按住说话**：
//     按下 start（幂等）、松开 stop（幂等），见 keypad.js 的 release 与 hid-bridge 的松开分派。
import {
  officialVoiceReady,
  officialVoicePhase,
  clickOfficialVoiceStart,
  clickOfficialVoiceStop,
  clickOfficialVoiceDismiss
} from './actions/dom.js'

/** 松开后等官方进入录音态（requesting → recording）再点停止的上限。 */
const OFFICIAL_STOP_WAIT_MS = 2000
/** 上面那段等待的轮询间隔（关掉错误栏之后等它收起也用这一拍）。 */
const OFFICIAL_STOP_POLL_MS = 100

/**
 * 官方的阶段里**哪些算「真的在收」**。
 *
 * 另外那个 `feedback`（识别结果 / 失败信息的反馈栏）**不算** —— 它只是栏还挂在那里。
 * 这条区分是 2026-10-19 的修复核心：以前判据是 `phase !== null`，于是识别一失败，
 * 那条错误栏就让控制器以为「还在录音」，再按语音键直接 return，用户看到的正是
 * 「报错了，然后按什么都没反应」。
 */
const OFFICIAL_BUSY = ['requesting', 'recording', 'transcribing']

/** 关掉错误/反馈栏之后，等官方回到折叠态（麦克风重新出现）再点开始的上限。 */
const OFFICIAL_RECOVER_WAIT_MS = 2000

export class VoiceController {
  SR =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null
  #recognizer = null
  #listening = false
  #unsupported = !this.SR
  /** 本次录音是**我们点的官方麦克风** —— 松开时得由我们去点官方那颗「停止并识别」。 */
  #official = false
  /** 等官方进入录音态的轮询句柄（同一时刻只允许一个）。 */
  #stopWait = null
  #beforeDraft = ''
  #finalText = ''
  #interimText = ''
  #commit = null
  #listeners = new Set()
  /** 关掉错误栏之后「等它收起、再点开始」的轮询句柄（同一时刻只允许一个）。 */
  #recoverWait = null

  /** 官方**真的在收**（请求授权 / 录音 / 转写）—— `feedback` 不算，见 OFFICIAL_BUSY。 */
  #officialActive = () => OFFICIAL_BUSY.includes(officialVoicePhase())

  /**
   * 录音栏还挂着，但已经不在收 —— 就是识别结果 / **错误信息**那一态（`feedback`）。
   * 这时既点不到「停止并识别」，也没有折叠态的麦克风：只能先把它关掉。
   */
  #officialLeftover = () => {
    const phase = officialVoicePhase()
    return phase !== null && !OFFICIAL_BUSY.includes(phase)
  }

  /**
   * 官方语音此刻**能不能开始**（出口在、麦克风在、没灰）。
   * ⚠ 「让位」不看它 —— 转写中 / 报错时官方在场但开始不了，那时仍然要让位
   * （判据是 actions/dom.js 的 `officialVoicePresent()`，见 voice-button.jsx）。
   */
  officialReady = () => officialVoiceReady()

  /** 在听：自己那半边在收，或官方**真的在收**（挂着一条错误/反馈栏不算 —— 那不是「在录」）。 */
  get listening() { return this.#listening || this.#officialActive() }

  /** 「不支持语音」只说自己那半边 —— 官方可用时根本不缺语音能力。 */
  get unsupported() { return this.officialReady() ? false : this.#unsupported }

  /**
   * 诊断（控制台 / 真机探针）——「语音会走 / 正在走哪条链路」。
   *   __dshMicro.services.voice.diagnose()
   * ⚠ `route` 报的是「**下一次按下**会走哪条」（有进行中的则报进行中的那条），
   *   而**不是**「刚刚走完哪条」。若按后者写，折叠态下永远是 'browser' ——
   *   真机探针第一跑就被它骗了一次（明明官方 ready，读出来像「回退到浏览器了」）。
   *   `active` 单独区分「正在进行」与「闲着但下次走官方」。
   *   `leftover` = 录音栏还挂着一条**反馈 / 错误**（`feedback`）——**它不是「在录」**，
   *   下次按下会先关掉它再重新开始。
   * @returns {{ready: boolean, phase: string|null, active: boolean, leftover: boolean, route: 'official'|'browser'}}
   */
  diagnose = () => {
    const phase = officialVoicePhase()
    const ready = officialVoiceReady()
    const busy = this.#officialActive()
    const leftover = phase !== null && !busy
    // 「官方那半边在场」：正在收，或还挂着一条反馈/错误栏（收起它也归官方这条链路管）
    const officialLive = this.#official || phase !== null
    const active = busy || !!this.#recognizer
    // 进行中 → 报进行中的那条；闲着 → 报「下次按下会走哪条」
    const route = officialLive ? 'official' : (active ? 'browser' : (ready ? 'official' : 'browser'))
    return { ready, phase, active, leftover, route }
  }

  #emit = () => {
    for (const fn of this.#listeners) { try { fn() } catch (e) {} }
  }
  #setListening = (v) => { this.#listening = v; this.#emit() }
  #fullText = () => this.#finalText + this.#interimText
  #push = () => {
    const text = this.#fullText().trim()
    if (this.#commit && text) this.#commit(this.#beforeDraft, text)
  }

  subscribe = (fn) => { this.#listeners.add(fn); return () => this.#listeners.delete(fn) }
  setCommit = (fn) => { this.#commit = fn }

  /**
   * 开始转写。**官方优先**：官方那颗麦克风点得到就点它，浏览器这套完全不碰；
   * 点不到（Bundle 没启用 / 模型没准备完 / 拿不到出口）才落到 Web Speech。
   *
   * 幂等：官方或自己在跑时直接返回 —— 按住期间设备会重复上报同一次按下（宿主去抖后的重发、
   * 或两颗 Mic 开关都亮），重复 start 会把刚转写出来的内容清掉重来。
   *
   * ⚠ **识别失败之后**（官方那条录音栏停在 `feedback`，错误信息就挂在那儿）再按：
   * 先关掉那条栏、等麦克风回来，再开始新的录音 —— 见 #recoverOfficial。
   * 以前这里只看「栏在不在」，于是报错之后按下去直接 return，用户看到的就是「按了没反应」。
   */
  start = () => {
    if (this.#recoverWait) return
    if (this.#official || this.#officialActive()) return
    if (this.#officialLeftover()) { this.#recoverOfficial(); return }
    if (clickOfficialVoiceStart()) {
      this.#official = true
      this.#unsupported = false
      this.#setListening(true)
      return
    }
    if (!this.SR) { this.#unsupported = true; this.#emit(); return }
    if (this.#recognizer && this.#listening) return
    if (this.#recognizer) { try { this.#recognizer.stop() } catch (e) {} }
    this.#unsupported = false
    this.#finalText = ''
    this.#interimText = ''
    const rec = new this.SR({ lang: 'zh-CN', continuous: true, interimResults: true, maxAlternatives: 1 })
    try { rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1 } catch (e) {}
    this.#recognizer = rec

    rec.onresult = (event) => {
      this.#interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) {
          if (res[0] && res[0].transcript) this.#finalText += res[0].transcript
        } else {
          this.#interimText = res[0] && res[0].transcript ? res[0].transcript : ''
        }
      }
      this.#emit()
      this.#push()
    }
    rec.onend = () => {
      if (this.#recognizer === rec) this.#recognizer = null
      this.#interimText = ''
      this.#setListening(false)
      this.#push()
      this.#finalText = ''
    }
    rec.onerror = (event) => {
      if (this.#recognizer === rec) this.#recognizer = null
      this.#interimText = ''
      this.#setListening(false)
      const code = event && event.error
      if (code === 'not-allowed' || code === 'service-not-allowed') this.#unsupported = true
      this.#emit()
    }
    try {
      rec.start()
      this.#setListening(true)
    } catch (e) {
      this.#recognizer = null
      this.#unsupported = true
      this.#emit()
    }
  }

  /**
   * 停止转写。
   *   * Web Speech 在跑 → 停它（收尾在 onend 里）；
   *   * 官方在跑 → 点官方那颗「停止并识别」；
   *   * 只剩一条错误 / 反馈栏（`feedback`）→ 直接关掉它（没有「停止并识别」可点）。
   * 两个调用方：输入框上的麦克风按钮（点按 = toggle），以及**动作键的松开**：
   * 语音键是按住说话，松开必须停（见 keypad.js 的 release / hid-bridge 的松开分派）。
   * 幂等：两条链路都没在跑时什么都不做，重复松手不会出错。
   */
  stop = () => {
    // 恢复窗口里还没真的开始录 —— 松手就取消它。否则那拍定时器会在**松手之后**把录音点起来，
    // 变成一条没有人负责收尾的录音（按住说话最短可以是几十毫秒）。
    if (this.#recoverWait) { this.#clearRecover(); return }
    if (this.#recognizer) { try { this.#recognizer.stop() } catch (e) {} ; return }
    if (this.#officialLeftover()) { this.#dismissOfficial(); return }
    if (this.#official || this.#officialActive()) this.#stopOfficial()
  }

  /**
   * 停官方那条链路。
   *
   * ⚠ 为什么不能只点一下就走：官方点麦克风之后先进入 `requesting`（等麦克风授权），
   * **那时「停止并识别」按钮还没渲染**（官方只在 `phase === 'recording'` 时给这颗按钮）。
   * 我们的键是「按住说话」，短按一下就松开的话，松开那一刻往往还在 requesting ——
   * 直接点会点空，表现就是「松手了但录音没停」。所以点不到就**等它出现**（有上限），
   * 期间官方若整条流程结束（录音栏收起）也立刻收手。
   */
  #stopOfficial = () => {
    if (this.#stopWait) return
    const finish = () => {
      this.#clearStopWait()
      this.#official = false
      this.#setListening(false)
    }
    if (clickOfficialVoiceStop()) { finish(); return }
    const deadline = Date.now() + OFFICIAL_STOP_WAIT_MS
    this.#stopWait = setInterval(() => {
      if (clickOfficialVoiceStop()) { finish(); return }
      if (Date.now() >= deadline || !this.#officialActive()) finish()
    }, OFFICIAL_STOP_POLL_MS)
  }

  #clearStopWait = () => {
    if (this.#stopWait) { clearInterval(this.#stopWait); this.#stopWait = null }
  }

  /**
   * 关掉那条错误 / 反馈栏（**不**重新开始）—— 松手时走这条。
   * 关不掉也不假装：`clickOfficialVoiceDismiss()` 返回 false 就到此为止。
   */
  #dismissOfficial = () => {
    this.#clearStopWait()
    this.#clearRecover()
    this.#official = false
    clickOfficialVoiceDismiss()
    this.#setListening(false)
  }

  /**
   * 「报错了 → 再按一次」：先关掉错误栏，等官方回到折叠态（麦克风重新出现）再点开始。
   *
   * 为什么要等：关掉只是一次 click，官方要下一拍才重渲染出那颗麦克风；
   * 立刻点会点空 —— 与 #stopOfficial 等「停止并识别」出现是同一类时序问题。
   * 上限 OFFICIAL_RECOVER_WAIT_MS，到点收手（绝不留一个永不停歇的轮询）；
   * 期间官方若自己已经进入新一轮（阶段是 busy），就认它，不再补点第二下。
   */
  #recoverOfficial = () => {
    this.#clearStopWait()
    this.#clearRecover()
    this.#official = false
    this.#setListening(false)
    if (!clickOfficialVoiceDismiss()) return
    const deadline = Date.now() + OFFICIAL_RECOVER_WAIT_MS
    this.#recoverWait = setInterval(() => {
      const phase = officialVoicePhase()
      if (phase === null) {
        if (clickOfficialVoiceStart()) {
          this.#clearRecover()
          this.#official = true
          this.#setListening(true)
          return
        }
      } else if (OFFICIAL_BUSY.includes(phase)) {
        // 官方自己已经开始（比如用户点的是「重试」）—— 认这一轮，不再补点
        this.#clearRecover()
        this.#official = true
        this.#setListening(true)
        return
      }
      if (Date.now() >= deadline) this.#clearRecover()
    }, OFFICIAL_STOP_POLL_MS)
  }

  #clearRecover = () => {
    if (this.#recoverWait) { clearInterval(this.#recoverWait); this.#recoverWait = null }
  }

  /** 点按式开关：输入框上的麦克风按钮与设置页里绑成「语音」的摇杆/旋钮手势用它。 */
  toggle = () => { if (this.listening) this.stop(); else this.start() }
}
