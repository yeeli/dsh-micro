// dsh-omkb · client/index.js
// 组装入口（Vite/Rollup 入口）：副作用导入全部模块使其挂载到共享 DSVI，
// 再导出 apply/inject。Vite 以 CJS 打包后，这两个会成为 module.exports.apply/inject，
// 恰好满足 DSH __ModuleLoader__ 的 factory 契约。
//
// 目录约定（改代码前先认一下门）：
//   keypad/      按键功能（分派器 + 键帽表 + 布局模型）
//   joystick.js  摇杆功能（方向 → 动作）
//   knob.js      旋钮功能（模式 + 手势 → 动作）
//   actions/     对 DSH 的操作（门面；client 目录下唯一直接碰 DSH 的地方）
//   components/  有界面的子页面与组件（设置页、布局、各弹窗、输入框按钮、侧边栏入口）
//   utils/       无界面、无状态的纯逻辑工具（按键按压状态机、输入监控三态映射）
import './core.js'
import './voice.js'
import './hid-bridge.js'
import './agents.js'
import './keypad/index.js'
import './knob.js'
import './components/settings-panel.jsx'
import './components/sidebar-action.jsx'
import './entry.js'
import { DSVI } from './core.js'

export const apply = DSVI.apply
export const inject = DSVI.inject
