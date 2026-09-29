// dsh-omkb · client/knob.js
// 旋钮（编码器）分派：依据设置里的旋钮模式，把旋转/按下/长按路由到对应功能。
//   navigate  ：输入区导航 —— 高亮选中下一个/上一个控件，按下激活。
//                跳过语音控件，也**跳过文本输入框**（转着转着把焦点吸进 composer
//                是用户报的 bug：编辑器在候选表里排第一，第一转就停上去）。
//   scroll    ：对话滚动 —— 旋转滚动**当前会话的消息列表**，按下回到底部
//   reasoning ：仅推理   —— 旋转把蓝环在等级列表里上下移（**转动不提交**）；菜单关着时这一转
//                只负责打开菜单、把环落在当前档；按下 = 确认环停的那一档（环在当前档=只收菜单）
//   custom    ：自定义分配 —— 按 knobCustom 里配置的动作执行
//
// **长按与模式无关**：任何模式下长按旋钮都打开本插件设置页（见 long）—— 用户 2026-09-28
// 要求「长按旋钮打开 omkb 设置页面」，选的是「任何模式都生效」。
//
// 这个文件只做**模式与手势的路由**：mode + gesture → 调 DshOps 的哪个方法。
// 具体的 DSH 操作（滚动容器、导航候选表、自绘蓝环、等级菜单的定位与提交）全在
// ./actions/ —— client 目录下唯一直接操作 DSH 的目录，别在这里再摸一次 DOM。
// 自定义分配里能选到的功能**也在那里**（./actions/registry.js 的功能总表：与键帽候选、
// 设置页下拉同一份）—— 以前这里另写了一张 KNOB_ACTIONS，加个功能要改两处，已经删掉。
// 唯一不走门面的是「语音」：那是浏览器能力（Web Speech），由注进来的 voice 控制器管
// （总表里那条 hold 动作的 run 就是它的 toggle，键帽那一侧走 press/release）。
// 纯定位函数（等级列表、滚动容器、导航候选）由 entry.js 从 actions/index.js 挂到
// DSVI.knobTools 上，便于控制台与自检直接验。
import { runAction } from './actions/registry.js'

export class KnobController {
  #ref = { mode: 'navigate', custom: {} }
  voice = null
  /** DSH 功能门面（./actions/index.js）。 */
  ops = null
  /**
   * 「按下旋钮」的旁路回调（./attention.js 用它进入「等弹窗」待命）。
   *
   * ⚠ 只管**通知**，不改这条路径的任何行为：回调查不到 / 抛错都不影响下面照常派发动作。
   * 之所以要它：「这次弹窗是旋钮招来的」只有按下这一刻知道（弹窗本身长得跟别的一样）。
   */
  #onPress = null

  constructor({ voice, ops }) {
    this.voice = voice || null
    this.ops = ops || null
  }

  get mode() { return this.#ref.mode }
  setMode = (m) => { this.#ref.mode = m }
  setCustom = (obj) => { this.#ref.custom = obj }
  /** 注册「按下旋钮」的回调（null = 取消）。 */
  setOnPress = (fn) => { this.#onPress = typeof fn === 'function' ? fn : null }

  /**
   * 自定义分配里的动作名 → 执行。
   * 动作表在 ./actions/registry.js（功能总表）—— 与键帽候选、设置页那个下拉**同一份**，
   * 所以「下拉里有、按下去没有」这种漂移在这里结构上不可能发生。
   * 设过的手势没配置（或值不认识）时不做事：绝不猜一个动作顶上。
   */
  #customGesture = (gesture) => {
    const cfg = this.#ref.custom || {}
    runAction(cfg[gesture] || 'none', { ops: this.ops, voice: this.voice })
  }

  step = (dir) => {
    const ops = this.ops
    const mode = this.#ref.mode || 'navigate'
    if (mode === 'scroll') { if (ops) ops.scrollStep(dir) }
    else if (mode === 'reasoning') { if (ops) ops.reasoningStep(dir) }
    else if (mode === 'custom') this.#customGesture(dir >= 0 ? 'cw' : 'ccw')
    else if (ops) ops.navStep(dir)
  }

  press = () => {
    const ops = this.ops
    const mode = this.#ref.mode || 'navigate'
    // 先通知（『这次弹窗是旋钮招来的』只有这一刻知道，见 #onPress），再照常派发动作 ——
    // 顺序反过来的话，按下就打开菜单的那条路会先弹出来、再进入待命（漏掉第一拍）。
    try { this.#onPress?.() } catch (e) {}
    if (mode === 'scroll') { if (ops) ops.scrollToBottom() }
    else if (mode === 'reasoning') { if (ops) ops.reasoningPress() }
    else if (mode === 'custom') this.#customGesture('click')
    else if (ops) ops.navActivate()
  }

  /**
   * 长按 —— **全局固定手势**：打开本插件的设置页，**任何模式都生效**。
   *
   * 为什么不做成配置项：「回设置页」是唯一的回家入口，不该随旋钮模式漂移。所以「自定义分配」
   * 里那个 long 下拉**已删掉**（见 components/settings/panel.jsx）—— 留一个按下去没反应的
   * 下拉比没有更坏。老存档里的 `knobCustom.long` 由此变成死值：不读它就不出错。
   *
   * 动作本体在功能总表里（./actions/registry.js 的 open_settings → DshOps.openSettings）；
   * 这个文件照旧只做「手势 → 动作」的路由，不碰 DSH 的 DOM。
   */
  long = () => {
    runAction('open_settings', { ops: this.ops, voice: this.voice })
  }
}
