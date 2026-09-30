// dsh-micro · client/index.js
// 组装入口（Vite/Rollup 入口）：副作用导入全部模块使其挂载到共享 DSVI，
// 再导出 apply/inject。Vite 以 CJS 打包后，这两个会成为 module.exports.apply/inject，
// 恰好满足 DSH __ModuleLoader__ 的 factory 契约。
//
// 目录约定（改代码前先认一下门 —— 三条纪律，加文件前先问「它属于哪一类」）：
//   ① 带 JSX、或是页面 → components/ 下**按功能分子目录**，不许堆在 components/ 根下：
//        modals/    弹窗（键帽编辑、摇杆、引导、重置、移除）
//        toast/     浮动提示条（保存成功那条）
//        settings/  设置页本体与键盘布局
//        sidebar/   侧边栏入口（齿轮旁那颗按键 + 各种贴合/隐藏）
//        common/    跨页面复用的 UI 基元（键帽画法、输入框上的麦克风按钮）
//   ② 纯逻辑工具集合（无状态、无副作用、不涉及功能执行）→ utils/
//   ③ 与 DSH 交互、与 core 交互的方法与类 → actions/（client 目录下唯一直接碰 DSH 的地方）
//
// 各文件归属（一眼定位）：
//   keypad.js    按键功能（键帽表 + 分派器）
//   joystick.js  摇杆功能（方向 → 动作）
//   knob.js      旋钮功能（模式 + 手势 → 动作）
//   sidebar.js   设置页导航行那一项（图标注入 + 隐藏）
//   notice.js    顶部提示（「这颗键在当前页面做不了」；纯 DOM，只对动作键 ACT06..ACT12 发）
//   actions/     对 DSH 的操作（门面 + 功能总表 + 会话/推理/推理等级/dom 助手）
//   components/  有界面的子页面与组件（见上面 ①）
//   utils/       无界面、无状态的纯逻辑（按键按压状态机、键帽布局模型、会话列表判据…）
//   config/      默认值与文案（default.js 是默认配置的唯一真源）
import './core.js'
import './voice.js'
import './hid-bridge.js'
import './agents.js'
import './keypad.js'
import './knob.js'
import './components/settings/panel.jsx'
import './components/sidebar/action.jsx'
import './entry.js'
import { DSVI } from './core.js'

export const apply = DSVI.apply
export const inject = DSVI.inject
