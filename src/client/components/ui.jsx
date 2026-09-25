// dsh-omkb · client/src/components/ui.jsx
// 设置页的**共用零件**：键的壳（Key）、SVG 包装（SvgIcon）、键帽的脸（CAP_ICON + KeyFace）。
//
// **一份图标表喂两处**：布局里的键、以及「编辑按键」弹窗里的候选。以前弹窗用的是
// emoji（⚡🗑✕✓🎤➤）+ 小方卡片，跟外面那排键长得完全不是一回事 —— 用户在弹窗里挑的东西
// 和他在键盘上看到的东西对不上，选完还得自己脑补。现在两边都是同一个组件、同一张表，
// 挑的就是按下去会变成的样子。
//
// 键帽 id → 图标的对应关系由 keypad/keycaps.js 给（那里是纯 JS，`icon` 只是一个名字），
// 名字 → 路径的映射在这层做（只有渲染层才该产出 JSX）。
//
// ---------- 文字放哪：布局不带、弹窗带（2026-09-24）----------
// 键面（KeyFace）现在**只画图标**。以前图标下面还压着一行 9px 的键帽字（FAST/SEND…），
// 于是布局看起来像一排标签而不是一排按键；更糟的是弹窗里的候选也走同一个 `<span>`，
// 而那一行字是 `position:absolute` 且只在 `.omkb-key--act` 里定得住 —— `.omkb-cap` 不是
// 定位祖先，候选的名字全被甩到遮罩底部叠成一堆，跟键对不上号。
// 现在的分工：**布局 = 真键盘的样子（只有图标）**，**「编辑按键」弹窗 = 键下面写名字**
// （见 keycap-modal.jsx 的 .omkb-cap-name）。要加文字就在布局/弹窗那一层加，别再塞回键面里。
import { CUSTOM_ICON, keycapOf } from '../keypad/keycaps.js'

/** 设置页里「一颗键」的壳：布局里的键、弹窗里的候选、按键特效都挂在这上面。 */
export const Key = ({ children, onClick, className = '', ...rest }) => {
  return (
    <div onClick={onClick} className={`omkb-key ${className}`} {...rest}>
      {children}
    </div>
  )
}

/**
 * 电量图标（设置页「电池」那一行用）：外壳 + 右端电极 + **按电量比例画的实心条**。
 * 条长就是电量本身（不是装饰性闪烁），空读数是空壳 —— 宁可看着空，也不要画一条假电量。
 * @param props.pct - 0..100；null/越界 = 没有读数（只画外壳）。
 * @param props.charging - 在充电：壳里改画一个闪电（此时条会来回跳，不如直接告诉用户在充电）。
 * 颜色跟随 currentColor：低电量由外层 `.omkb-batt--low` 变红（见 assets/settings.css）。
 */
export const BatteryIcon = ({ pct, charging }) => {
  const known = typeof pct === 'number' && Number.isFinite(pct) && pct >= 0 && pct <= 100
  // 外壳内腔：x 4.6..17.4（宽 12.8），留 0.2 的内缩让实心条不贴边。
  const w = known ? Math.max(1.4, (pct / 100) * 12.4) : 0
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.6" y="7.2" width="17" height="9.6" rx="2.6" />
      <path d="M21.4 10.6v2.8" strokeWidth={2.2} />
      {charging
        ? <path d="M12.9 8.4l-3.4 4.4h2.3l-.7 3.2 3.4-4.4h-2.3z" fill="currentColor" stroke="none" />
        : (w > 0 ? <rect x="4.6" y="9.2" width={w} height="5.6" rx="1.3" fill="currentColor" stroke="none" /> : null)}
    </svg>
  )
}

/** 24 视窗的 SVG 包装（设置页里的小图标统一走它，颜色用 currentColor）。 */
export const SvgIcon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="omkb-svg-icon" stroke="#222" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

/**
 * 键帽图标名 → 路径。名字来自 keycaps.js 的 `icon`；`custom`（未指派）是虚框 + 加号。
 *
 * 2026-09-24 把这几颗逐一对过一遍（用户报「SEND 的图标不合适」），改了两颗、保留四颗：
 *   send —— **原先画的是警告三角**（Feather 的 alert-triangle：三角形 + 感叹号），跟「发送」
 *           毫无关系，一眼看去像「这里出错了」。改成纸飞机（send）：按下去=把这段发出去。
 *   arch —— 原先画的是**垃圾桶**（删档图标）。「归档」和「删除」是两个相反的操作，
 *           拿垃圾桶当归档，用户会以为按下去是永久删掉。改成归档箱（盖 + 箱体 + 投口）。
 *   fast / rej / mic —— 保留：闪电对 FAST、圆圈叉对「拒绝」、麦克风对 MIC，都已经是公认画法。
 * 2026-09-24 新增 fork（分叉会话）：一条主干分成两条 —— 与「新增/复制」区分开：
 *   复制是同一样东西再来一份，分叉是**从这里变成两条**，所以画的是分叉口而不是文件叠层。
 * 2026-09-25 重画 appr 的勾（用户报「所有图标风格要类似，appr 和 reject 要有类似的风格」）：
 *   rej 与 appr 是**成对**的两颗键（同一个外框 + 一个内符号），尺寸必须相当才好一眼分辨。
 *   原来直接搬了 Feather check 的原始坐标：那条勾的**起笔点正好落在圆的描边上**（离圆心恰好
 *   等于半径），整条勾又大又斜、几乎填满圆；放大看勾与圆粘成一团，32px 下更糊成一块，
 *   而旁边的叉小巧居中、离圆边还留着近 6 个单位的空隙 —— 两只完全不像一套。
 *   现在把勾的包围盒收到 7.6×5.2 并**居中于圆心**，三个端点到圆心的距离是 4.6 / 3.0 / 3.7
 *   （叉的四个端点是 4.24）→ 与圆边的呼吸空间和叉一致。回归防护见 test/verify_keycaps.js【4】。
 */
export const CAP_ICON = {
  fast: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>,
  // 归档箱：上盖比箱体宽一点（一眼区分「箱子」与「表格」），中间一道投口。
  arch: (
    <>
      <rect x="2" y="3.4" width="20" height="5.4" rx="1.2"/>
      <path d="M4.4 8.8v9.6a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2V8.8"/>
      <line x1="9.8" y1="12.8" x2="14.2" y2="12.8"/>
    </>
  ),
  rej: (
    <>
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </>
  ),
  // 勾（APPR）—— 与上面的叉成对：同一个圆，勾的包围盒 7.6×5.2、居中于圆心，
  // 端点离圆边与叉留的呼吸空间一致。见文件头 2026-09-25 那条。
  appr: (
    <>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="8.2 11.4 10.6 14.6 15.8 9.4"/>
    </>
  ),
  mic: (
    <>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </>
  ),
  // 纸飞机（原来这里是警告三角，见上面对照表）。
  send: (
    <>
      <line x1="21.4" y1="2.6" x2="10.6" y2="13.4"/>
      <path d="M21.4 2.6 14.6 21.4 10.6 13.4 2.6 9.4z"/>
    </>
  ),
  // 分叉（FORK）：一条主干向上分成两条 —— 「从这里变成两条」，不是复制也不是删除。
  fork: (
    <>
      <path d="M12 21.2V12.6"/>
      <path d="M12 12.6 6.4 7.2V3.2"/>
      <path d="M12 12.6 17.6 7.2V3.2"/>
    </>
  ),
  // 未指派（自定义键）：虚框 + 加号 ——「这里还没选功能」。
  [CUSTOM_ICON]: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.2" strokeDasharray="3.2 3.2"/>
      <path d="M12 8.6v6.8M8.6 12h6.8"/>
    </>
  )
}

/**
 * 一颗键的面：按**键帽**（而不是物理键码）画图标，`capId` 为 null 就是「自定义」（虚框 + 加号）。
 * **只画图标、不带文字**：名字由调用方决定放哪儿 —— 布局里不放（真键盘上也只有图标），
 * 「编辑按键」弹窗里放在键下面（见 keycap-modal.jsx）。
 * @param capId - 键帽 id（keypad/keycaps.js）；null/未知 = 未指派。
 */
export const KeyFace = ({ capId }) => {
  const cap = keycapOf(capId)
  return (
    <SvgIcon>{CAP_ICON[cap ? cap.icon : CUSTOM_ICON] || CAP_ICON[CUSTOM_ICON]}</SvgIcon>
  )
}
