// dsh-micro · 宿主侧设置（DSH 0.1.7-rc.2 契约）
//
// ── 这一版为什么整块重写（第三次契约漂移）────────────────────────────────────
// 0.1.5-rc.3 之前：@deepseek-ai/dsh-settings 导出两个自由函数
//     installSettingsSection(ctx, settingsNamespace('dsh-micro'), schema, entry, hooks)
// 0.1.5-rc.3：改成服务方法 ctx.settings.installSection(owner, ns, schema, entry, hooks)
// 0.1.7-rc.2：**installSection 与客户端 settingsScope 一起删掉了**。命名空间不再是
//   「插件自己注册的东西」，而是**插件在 profile 里那条 loader 条目的 Config**：
//     · 命名空间名 = 条目 id（我们就是 `dsh-micro`，见 cordis.patch.yml 的 insert.id）
//     · schema     = 插件模块导出的 `Config`（schemastery），**每个字段都要 .volatile()**
//     · 可写性     = 只有标了 volatile 的字段才进设置表单；改它由 loader 就地提交
//                    （updateVolatile + `loader/volatile-update`），**不会重启插件**
//     · 客户端     = ctx.configForms.get('dsh-micro')（settingsScope.bind 没了）
//   没有 volatile 字段的条目连 describe() 都不会出现（dsh-settings 的 volatileForm
//   返回 undefined 就整条跳过）——所以「忘了标 volatile」的表现和当年「没注册」一模一样：
//   设置页能看能改、一保存就丢。
//
// 于是本文件的职责只剩两件：**构造那个 schema**、**读回宿主发下来的配置**。
// 注册动作没有了（导出即注册）。
//
// ── 为什么在最外层用 top-level await ────────────────────────────────────────
// `Config` 必须是一个**现成的** schema 对象（loader 会在注册插件时立刻读
// `runtime.Config`，`"toJSON" in schema` 才算数），不能再像以前那样「等 apply 里异步
// 加载依赖、再注册」。而 schemastery 是 DSH 运行时提供的包、插件自己不声明（声明了就会
// 装出第二份，`toJSON` 的全局 refs 表会互相踩）——只能运行时解析。两条路：
//   a) 静态 import：Node 会把 `link:` 挂进来的插件解析成项目真实路径，那里没有
//      node_modules/@deepseek-ai → MODULE_NOT_FOUND（正是 resolverRoots 存在的原因）；
//   b) 模块最外层 `await import(...)`：loader 用动态 `import()` 加载插件模块
//      （cordis-plugin-loader 的 `tree.import`），ESM 顶层 await 完全支持。
// 所以走 b。代价是构建产物里带着 top-level await → vite 的 build.target 必须是 esnext
// （见 vite.core.config.js，那边有注释说明）。

import { pathToFileURL } from 'node:url'
// 解析根与解析动作由 ./resolve.js 提供（状态推送的 ws 走同一套，见那边顶部注释）。
import { resolveDep } from './resolve.js'

/**
 * 命名空间。**必须与 profile 里那条 loader 条目的 id 逐字相同**（我们的
 * `cordis.patch.yml` 里 `insert: [{ id: dsh-micro, name: dsh-micro }]`）。
 * 客户端 `ctx.configForms.get(DSVI.NS)` 用的也是这个字符串。
 */
export const MICRO_NAMESPACE = 'dsh-micro'

/**
 * 默认值 —— schema 默认值与「读不到配置时的兜底」共用这一份，避免两处各写一份慢慢漂移。
 * 必须与客户端 DSVI.MICRO_DEFAULTS 逐字段一致（两侧分别构建、无法共享模块）。
 */
export const MICRO_DEFAULTS = {
  brightness: 0.9,
  autoDim: 0,
  actLabels: {},
  joystick: {},
  agentKey: 'recent',
  agentAssign: {},
  knob: 'navigate',
  knobCustom: {},
  micKey: false,
  guideSeen: false,
  removed: false
}

/** 智能体键映射模式。 */
export const AGENT_KEY_MODES = ['pinned', 'recent', 'priority', 'custom']
/** 旋钮模式。 */
export const KNOB_MODES = ['navigate', 'reasoning', 'scroll', 'custom']

const clamp01 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.9)

/**
 * 本模块需要从 DSH 运行时里解析的包。
 *
 * schemastery 由 DSH 运行时提供，插件包自己不声明它（也不该声明具体版本）；解析位置与
 * 失败原因的解释都在 ./resolve.js 的顶部注释里（那边是解析根的唯一真源）。
 */
const DEP_PACKAGES = {
  schema: '@deepseek-ai/schemastery'
}

/** 解析结果（模块作用域，供 Config 与诊断共用）。 */
let zMod = null
let schemaSource = null
let schemaError = null
try {
  const resolved = resolveDep(DEP_PACKAGES.schema)
  if (!resolved.ok) {
    schemaError = `解析 DSH 运行时依赖失败：${DEP_PACKAGES.schema} ← ${resolved.failures.join(' / ')}`
  } else {
    // 用 import() 而不是 require()：宿主用 Promise.all 并发加载插件，那一刻 ESM 依赖可能
    // 还没求值完，同步 require 会抛 ERR_REQUIRE_ESM_RACE_CONDITION（而且发生在模块求值期，
    // 同步路径上无法重试）。顶层 await 会等它求值完。
    const mod = await import(pathToFileURL(resolved.path).href)
    zMod = mod.default ?? mod
    schemaSource = resolved.root
    if (typeof zMod?.object !== 'function') {
      schemaError = `解析到 ${resolved.path}（经 ${resolved.root}），但它没有 z.object —— 不是 schemastery？`
      zMod = null
    }
  }
} catch (e) {
  schemaError = `已解析到路径但加载失败：${(e && e.code ? e.code + ': ' : '') + ((e && e.message) || e)}`
  zMod = null
}

/**
 * 插件导出的设置 schema。loader 读的就是它（`entry.fiber.runtime.Config`）。
 *
 * **每个字段都必须 .volatile()**：`dsh-settings.describe()` 只把「有 volatile 字段」的
 * 条目算进命名空间列表（volatileForm），写入也只接受 volatile 路径（isVolatilePath）；
 * 漏标一个字段 = 那一行在设置页永远保存失败。反过来，标了 volatile 的字段改动由 loader
 * 就地提交（`loader/volatile-update`），**不会重启插件**——所以改亮度不会把 BLE 断一次。
 *
 * 依赖没解析到时这里是 undefined：条目没有 schema → 命名空间不存在 → 设置页只能读默认值。
 * 插件其余部分（按键/灯光）照常工作，诊断（/micro/state 的 settings.error）会说清原因。
 */
export const Config = zMod
  ? zMod.object({
    /** 灯光亮度 0..1。 */
    brightness: zMod.number().min(0).max(1).default(MICRO_DEFAULTS.brightness).volatile(),
    /** 空闲自动调暗秒数，0 = 关闭。 */
    autoDim: zMod.number().min(0).default(MICRO_DEFAULTS.autoDim).volatile(),
    /**
     * 键帽覆盖：动作键 id（ACT06..ACT12）→ 选定的键帽 id（如 'ACT07'）。
     * 值域与客户端 MICRO_KEYCAPS 的 id 一致；留空表示用物理键的出厂标签。
     */
    actLabels: zMod.dict(zMod.string()).default(MICRO_DEFAULTS.actLabels).volatile(),
    /**
     * 模拟摇杆映射：{ up, right, down, left } → 动作名（取值域与出厂值见客户端
     * src/client/config/default.js 的 JOY_ACTION / JOY_DEFAULTS）。
     * 动作名是开放集合（含技能名），故用自由字典而非枚举；
     * 'none' 表示该方向不绑定任何动作（不能用 null：dict<string> 校验会拒掉）。
     */
    joystick: zMod.dict(zMod.string()).default(MICRO_DEFAULTS.joystick).volatile(),
    /** 智能体键映射模式。 */
    agentKey: zMod.union(AGENT_KEY_MODES).default(MICRO_DEFAULTS.agentKey).volatile(),
    /** 自定义分配：槽位(0..5) → 会话 id（键按字符串存储）。 */
    agentAssign: zMod.dict(zMod.string()).default(MICRO_DEFAULTS.agentAssign).volatile(),
    /** 旋钮模式。 */
    knob: zMod.union(KNOB_MODES).default(MICRO_DEFAULTS.knob).volatile(),
    /** 自定义旋钮分配：{ cw, ccw, click, long } → 动作名。 */
    knobCustom: zMod.dict(zMod.string()).default(MICRO_DEFAULTS.knobCustom).volatile(),
    /** 独立麦克风宽键。 */
    micKey: zMod.boolean().default(MICRO_DEFAULTS.micKey).volatile(),
    /**
     * 首次连接引导看过了没有（客户端 GuideController 在用户跳过/走完时写 true）。
     * 落在这里而不是 localStorage：它是「这台键盘的引导」而不是「这个浏览器的引导」，
     * 换台机器 / 重装浏览器不该再来一遍。重置布局会清掉它（于是下次连上再弹一次）。
     */
    guideSeen: zMod.boolean().default(MICRO_DEFAULTS.guideSeen).volatile(),
    /**
     * 「这台键盘已被移除」（客户端 DeviceController 在用户确认移除时写 true）。
     *
     * 它**不是偏好**：不出现在界面上，也不该被「重置布局」清掉 —— 唯一的清法是
     * 「设备重新连上」（那时界面放回来、标记也一并清掉，见 src/client/device.js）。
     * 为什么必须落盘：它决定「设置页分区与侧边栏入口要不要收起来」，
     * 只记在浏览器里的话，一次刷新（或换浏览器）界面就又冒出来了 —— 用户看到的是
     * 「点了移除没用」。移除时清空的是**其余全部字段**，这个标记自己留着。
     */
    removed: zMod.boolean().default(MICRO_DEFAULTS.removed).volatile()
  })
  : undefined

/**
 * 把宿主发下来的配置摊平成普通对象。
 *
 * volatile 字段在插件拿到的 config 里**不是值，而是一个引用对象**（cosmokit 的
 * createVolatile：`{ get(), [Symbol.for('cosmokit.volatile.write')] }`），值要靠 `.get()`
 * 取；标了 volatile 的字段就是这种形状（见 Config）。认不出来的形状原样返回，缺字段补默认
 * —— 于是调用方拿到的永远是一个**字段齐全的普通对象**，不必自己判 `=== undefined`。
 * @param config - apply(ctx, config) 收到的配置。
 * @returns {object} 普通对象形式的偏好（未知字段不保留）。
 */
export function readConfig(config) {
  const src = config && typeof config === 'object' ? config : {}
  const out = {}
  for (const key of Object.keys(MICRO_DEFAULTS)) {
    const v = src[key]
    if (v === undefined || v === null) out[key] = MICRO_DEFAULTS[key]
    else if (typeof v === 'object' && typeof v.get === 'function') {
      const inner = v.get()
      out[key] = inner === undefined ? MICRO_DEFAULTS[key] : inner
    } else out[key] = v
  }
  return out
}

/** 硬件侧真正消费的两个字段（其余字段只影响浏览器行为）。 */
export function readHardwarePrefs(section) {
  const src = section && typeof section === 'object' ? section : {}
  return {
    brightness: clamp01(src.brightness),
    autoDim: Number.isFinite(src.autoDim) ? Math.max(0, src.autoDim) : 0
  }
}

/**
 * schema 里到底标了几个 volatile 字段。
 *
 * 不去数 MICRO_DEFAULTS 的键数：那样「漏标 volatile」这种错误就永远断言不出来
 * （整条链恰好死在那一处）。这里读的是**真的 schema**（toJSON → refs 里翻 meta）。
 * @returns {{total: number, volatile: number}}
 */
export function countVolatileFields() {
  const out = { total: 0, volatile: 0 }
  if (!Config || typeof Config.toJSON !== 'function') return out
  let json
  try { json = Config.toJSON() } catch (e) { return out }
  const root = json && json.refs ? json.refs[json.uid] : null
  if (!root || !root.dict) return out
  for (const uid of Object.values(root.dict)) {
    const node = json.refs[uid]
    if (!node) continue
    out.total += 1
    if (node.meta && node.meta.volatile === true) out.volatile += 1
  }
  return out
}

/**
 * 运行时自证：「这套设置到底接上了没有」。
 *
 * 判据必须是**别人也能复核的事实**，不是自我感觉：
 *  · schema 建起来了没有（phase/error）；
 *  · 字段数与 volatile 数（少标一个 → 那一行永远保存失败）；
 *  · `settings.describe()` 里有没有我们这条命名空间（served）。
 * 最后一条要等：我们的 fiber 在 apply 期间还没进入 active，那一刻 describe() 里必然没有
 * 自己（它只收 state===2 的条目）——所以探测要延后，且只探一次。
 */
export function createSettingsProbe() {
  const startedAt = Date.now()
  /** 探测延迟：避开「apply 期间自己还没 active」那段（describe 只收 state===2 的条目）。 */
  const PROBE_DELAY_MS = 1200
  let service = null
  let served = null
  let namespaces = null
  let probeError = null
  return {
    /**
     * 把 settings 服务交给探针（宿主 ctx.inject(['settings']) 里调）。
     * @param sctx - 带 settings 服务的上下文。
     */
    attach: (sctx) => { service = sctx && sctx.settings ? sctx.settings : null },
    /**
     * 尝试（一次）把 describe() 里我们那条命名空间记下来。
     * 服务还没到 / 还没到时间 / 已经探过 → 直接跳过，不抛。
     * @param ctx - 宿主插件上下文（服务没 attach 时用它兜底取）。
     */
    tick: (ctx) => {
      if (served !== null) return
      let svc = service
      if (!svc) {
        try { svc = ctx && typeof ctx.get === 'function' ? ctx.get('settings') : null } catch (e) { svc = null }
      }
      if (!svc || typeof svc.describe !== 'function') return
      if (Date.now() - startedAt < PROBE_DELAY_MS) return
      try {
        const rows = svc.describe() || []
        namespaces = rows.map((r) => r && r.ns).filter((n) => typeof n === 'string')
        served = namespaces.includes(MICRO_NAMESPACE)
      } catch (e) {
        probeError = (e && e.message) || String(e)
      }
    },
    /** @returns 诊断快照（挂在 /micro/state 的 settings 上）。 */
    diagnose: () => {
      const fields = countVolatileFields()
      return {
        // 契约代号：这一版是「条目 Config + volatile」。下次 DSH 再改，这行字直接指路。
        api: 'Config(volatile)',
        via: 'config',
        namespace: MICRO_NAMESPACE,
        phase: Config ? 'ready' : 'failed',
        error: schemaError,
        schemaSource,
        fields: fields.total,
        volatile: fields.volatile,
        served,
        namespaces,
        probeError
      }
    }
  }
}
