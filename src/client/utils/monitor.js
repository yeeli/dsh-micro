// dsh-micro · client/src/utils/monitor.js
// 「输入监控」授权状态在浏览器侧的一条窄接口：端点常量 + 三态映射。
//
// 为什么要单独一个模块：状态判据要在自检里直接断言，而设置页那几个文件是 JSX + `?raw` CSS，
// node 里加载不了。把判据放在这里（纯 JS），自检 import 的就是真正跑在界面上的那份逻辑。
//
// 三态语义（务必按 `=== true` / `=== false` 判，别用真值判断）：
//   granted === true  已授权
//   granted === false 明确未授权
//   granted === null  不知道：非 macOS 平台 / osascript 超时 / 输出解析不了 / 宿主没这个路由
// 「不知道」必须显示成中性灰的「无法判定」，不能混进「未授权」——那是无中生有的结论。

/** 查询授权状态（宿主 spawn osascript 去问系统，见 src/core/monitor.js）。加 `?force=1` 强制重测。 */
export const MONITOR_URL = '/micro/monitor'

/** 让宿主打开系统设置的隐私面板（浏览器不能启动进程）。 */
export const PRIVACY_URL = '/micro/open-privacy'

/**
 * 三态 → 界面用的类名与文案键。
 * @param m - 宿主返回的授权状态对象（可能为 null：还没测到）。
 * @returns {{cls: string, statusCls: string, labelKey: string}}
 */
export const monitorDot = (m) => {
  if (m && m.granted === true) return { cls: 'micro-dot--ok', statusCls: 'micro-status--ok', labelKey: 'monitor.granted' }
  if (m && m.granted === false) return { cls: 'micro-dot--err', statusCls: 'micro-status--err', labelKey: 'monitor.denied' }
  return { cls: 'micro-dot--idle', statusCls: 'micro-status--idle', labelKey: 'monitor.unknown' }
}

/** 这一份状态要不要显示这张卡片：**只在 macOS 显示**（宿主用 supported 字段回答）。 */
export const monitorVisible = (m) => !!(m && m.supported === true)

/** 未授权时是否给「打开系统设置」按钮。 */
export const monitorNeedsSettings = (m) => !!(m && m.supported === true && m.granted === false)
