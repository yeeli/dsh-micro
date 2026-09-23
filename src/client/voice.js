// dsh-omkb · client/src/voice.js
// 🎤 语音输入控制器：封装 Web Speech API（由 entry.js 装配进 DSVI.services.voice）。
//
// 语音识别是**浏览器的能力**（不是 DSH 的），所以它不走 actions/ 那套门面；
// 但「把转写结果写进 composer 草稿」是 DSH 操作 → 由 actions/index.js 的 DshOps.writeDraft 落地。
// 界面那一半（输入框上的麦克风按钮）在 components/voice-button.jsx。
//
// 两种触发方式（都收口到 start / stop / toggle 三个方法上）：
//   * 输入框上的麦克风按钮 —— 点按 = toggle；
//   * 动作键 ACT10/ACT11（或设置页里绑成「语音」的摇杆/旋钮手势）—— **按住说话**：
//     按下 start（幂等）、松开 stop（幂等），见 keypad/index.js 的 release 与 hid-bridge 的松开分派。
export class VoiceController {
  SR =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null
  #recognizer = null
  #listening = false
  #unsupported = !this.SR
  #beforeDraft = ''
  #finalText = ''
  #interimText = ''
  #commit = null
  #listeners = new Set()

  get listening() { return this.#listening }
  get unsupported() { return this.#unsupported }

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

  start = () => {
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
   * 停止转写（把已经识别出来的文本落进输入框 —— 收尾在 onend 里）。
   * 两个调用方：输入框上的麦克风按钮（点按 = toggle），以及**动作键的松开**：
   * 语音键是按住说话，松开必须停（见 keypad/index.js 的 release / hid-bridge 的松开分派）。
   * 幂等：没有识别器在跑时什么都不做，重复松手不会出错。
   */
  stop = () => {
    try { if (this.#recognizer) this.#recognizer.stop() } catch (e) {}
  }

  /** 点按式开关：输入框上的麦克风按钮与设置页里绑成「语音」的摇杆/旋钮手势用它。 */
  toggle = () => { if (this.#listening) this.stop(); else this.start() }
}
