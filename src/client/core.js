// dsh-micro · client/src/core.js
// 共享运行时：命名空间常量、样式、通用图标，以及所有模块共享的 `DSVI` 容器（持有 react）。
// ESM 化后各模块显式从此导入。
import React from 'react'
export const react = React

export const NS = 'dsh-micro'
export const SLOT_INPUT = 'conversation.input.left'
/** 侧边栏底部「设置」旁边的动作位（DSH 官方槽位，见 dsh-client-ui-sidebar）。 */
export const SLOT_FOOT_ACTION = 'sidebar.footer.action'
/** 设置页分区槽位（本插件在它下面挂「DSH小键盘」页）。 */
export const SLOT_SETTINGS_SECTION = 'settings.section'

// 基础样式（设置模块会在此基础上追加）。使用 DSH 设计令牌。
export const css = [
  '.dsvi-btn{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;display:grid;background:0 0}',
  '.dsvi-btn:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
  '.dsvi-btn[data-active]{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover-danger);animation:dsvi_pulse 1.2s ease-in-out infinite}',
  '@keyframes dsvi_pulse{0%,100%{opacity:1}50%{opacity:.45}}',
  // ---------- 抵消 DSH 的「超椭圆圆角」（2026-09-23）----------
  // DSH 在 html/body 上设了 `corner-shape: superellipse(1.5)`（超椭圆，即"方中带圆"那种
  // squircle）。这个属性**会被继承**，于是我们元素上的 `border-radius:50%` 不再渲染成
  // 正圆，而是超椭圆 —— 小尺寸下看着就是"圆角方形"。
  // 症状：用户报「布局里原来是圆形的图标变成圆角的形状了」——像素法实测 `.micro-key-dot`
  // （22px / 50%）顶边第一行就有 16px 宽、整条轮廓与「圆角半径 = 边长 38% 的圆角方形」
  // 逐行吻合，而 computed 明明是 `50%`。
  // DSH 自己知道这个坑：它的组件逐条写了 `corner-shape: round` 抵消（跑 `probe:corner-shape`
  // 能看到一长串 `→ round`），我们的元素一个都没写。这里按同样办法补上。
  // 不认这个属性的浏览器直接忽略这条声明，无副作用。
  '[class*="micro-"],[class*="dsvi-"]{corner-shape:round}'
].join('')

export const installStyles = () => {
  if (typeof document === 'undefined') return () => {}
  const tagId = `${NS}/style`
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = NS
  tag.dataset.pluginCss = tagId
  tag.textContent = DSVI.css
  document.head.appendChild(tag)
  return () => tag.remove()
}

export const svgIcon = (size, props, children) =>
  react.createElement(
    'svg',
    { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, ...props },
    ...children
  )

export const MicIcon = (size) =>
  svgIcon(size, {}, [
    react.createElement('path', {
      fill: 'currentColor',
      d: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z'
    })
  ])

// 小键盘图标：**竖向圆角方框**（描边）+ 3 列 × 2 行圆点 + 底部「一个点 + 空格条」（都是实心）。
// （原来的横版「两排方块键帽」已按设计稿换掉：方框更像键盘按键本身，圆点在小尺寸下也比小方块清楚。）
//
// 视图固定 16（与 DSH 设置页导航图标同一基线），渲染尺寸由调用方给：
//   侧边栏入口用 20（比旁边设置图标的 16 大一号）、设置页导航项用 16。
//
// 比例是从设计稿图上量出来的（图标 14×14 像素，逐像素量框线/点径/行距）：
//   外框 ≈ 内容全宽、圆角 ≈ 18%、点径 ≈ 13%、点间距 ≈ 23%、空格条 ≈ 45% 宽且右端对齐第 3 列中心。
//   16 视窗里外框占 12.8（留 1.6 边距，和 DSH 其它 16 图标视觉重量一致）。
//
// **几何只写一份**（KEYPAD_ICON）：`KeypadIcon`（React）和 `keypadIconHTML`（DOM 钩子）都从它生成。
// 设置页导航项那处是往 DSH 的 DOM 里塞的（见 ./sidebar.js），拿不到 React 元素 ——
// 两处各画一份几何，迟早会画成两个样。
//
// 数值都是「外框内宽 11.5」按上面比例算的：点间距 11.5×0.636÷2 = 3.66、点径 11.5×0.18 = 2.06…
export const KEYPAD_ICON = {
  viewBox: '0 0 16 16',
  strokeWidth: 1.3,
  /** 外框：近方形圆角矩形（rx ≈ 边长的 16%，即设计稿那种「方中带圆」）。 */
  box: { x: 1.6, y: 1.6, width: 12.8, height: 12.8, rx: 2.0 },
  /** 圆点圆心：前两行各 3 个 + 第三行 1 个（第三行右边留给空格条）。 */
  dots: [
    [4.35, 4.35], [8, 4.35], [11.65, 4.35],
    [4.35, 8], [8, 8], [11.65, 8],
    [4.35, 11.65]
  ],
  dotR: 1.03,
  /** 空格条：右端对齐第 3 列圆心，粗细与圆点直径一致。 */
  space: { x: 6.45, y: 10.62, width: 5.2, height: 2.06, rx: 1.03 }
}

export const KeypadIcon = (size = 20) =>
  svgIcon(
    size,
    {
      viewBox: KEYPAD_ICON.viewBox,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: KEYPAD_ICON.strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    },
    [
      react.createElement('rect', { key: 'body', ...KEYPAD_ICON.box }),
      ...KEYPAD_ICON.dots.map(([cx, cy], i) =>
        react.createElement('circle', {
          key: `d${i}`,
          cx,
          cy,
          r: KEYPAD_ICON.dotR,
          fill: 'currentColor',
          stroke: 'none'
        })
      ),
      react.createElement('rect', { key: 'space', ...KEYPAD_ICON.space, fill: 'currentColor', stroke: 'none' })
    ]
  )

/**
 * 同一个图标的 HTML 串（给 DOM 钩子用：设置页导航项那块 DOM 归 DSH 管，我们只能插节点）。
 * @param size - 渲染边长（px）。
 * @param attrs - 追加到 `<svg>` 上的额外属性串，如 `class="x" data-micro-navicon="1"`。
 * @returns 完整的 `<svg>…</svg>` 字符串，颜色跟随 currentColor。
 */
export const keypadIconHTML = (size = 16, attrs = '') => {
  const k = KEYPAD_ICON
  const box = k.box
  const sp = k.space
  return [
    `<svg width="${size}" height="${size}" viewBox="${k.viewBox}" fill="none" stroke="currentColor"`,
    ` stroke-width="${k.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${attrs ? ' ' + attrs : ''}>`,
    `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${box.rx}"/>`,
    ...k.dots.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${k.dotR}" fill="currentColor" stroke="none"/>`),
    `<rect x="${sp.x}" y="${sp.y}" width="${sp.width}" height="${sp.height}" rx="${sp.rx}" fill="currentColor" stroke="none"/>`,
    '</svg>'
  ].join('')
}

// ---------- 会话列表：判据整份转发自 utils/session-list.js ----------
//
// 「哪一条是眼前这条会话」与「侧边栏看得见哪几条」这两条判断的**本体与全部依据**住在
// `utils/session-list.js`：那是个**不许 import 任何东西**的叶子文件，所以 DSH 操作门面
// （actions/session.js，要能在 node 里塞假快照直接断言）能直接 import 它，而不必被这里的
// `import React`（peerDependency）拖进 UI 运行时 —— 2026-09-26 先把判据写在这儿、
// 门面再来 import，verify:knob 等几套自检当场 ERR_MODULE_NOT_FOUND: react，就是踩的这个。
//
// 这里只做转发：`import { archivedIdsOf, visibleSessions } from './core.js'` 的老写法
// （agents.js / components/settings/panel.jsx）一个字都不用改，而拿到的是同一个函数。
export * from './utils/session-list.js'

/** 侧边栏的 recency 比较器：最新在前，updatedAt 相同时用 id 保证确定性次序。 */
export const byRecency = (a, b) =>
  (b.updatedAt || 0) - (a.updatedAt || 0) || (a.id < b.id ? -1 : 1)

// 共享命名空间容器：各模块挂载能力、互称彼此状态都在此对象上。
// 各控制器实例由 entry.js 装配到 services。
export const DSVI = {
  react,
  NS,
  SLOT_INPUT,
  SLOT_FOOT_ACTION,
  SLOT_SETTINGS_SECTION,
  css,
  installStyles,
  svgIcon,
  MicIcon,
  KeypadIcon,
  KEYPAD_ICON,
  keypadIconHTML,
  inject: [],
  apply: null,
  services: null
}
