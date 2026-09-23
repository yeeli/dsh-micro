// dsh-omkb · 宿主侧设置命名空间
// 设置页（src/client/components/settings-panel.jsx）里的每一行都通过浏览器端的 ctx.settingsScope
// 写进 `dsh-omkb` 命名空间。命名空间必须先由宿主侧 ctx.settings.register 注册：
// 否则 settings.describe 不会返回该段，客户端 scope 恒为 unavailable / 不可写，
// scope.set() 的写入会被静默丢弃（什么都不落盘）。
//
// 本模块是该命名空间的唯一真源。schema 默认值必须与客户端 DSVI.OMKB_DEFAULTS
// 保持一致（两侧分别构建、无法共享模块），字段增删请同时改这两处：
//   - src/core/settings.js        （本文件）
//   - src/client/components/settings-panel.jsx （DSVI.OMKB_DEFAULTS）
//
// 「注册了没有」这件事在客户端是不可见的（未注册时 scope 恒为 unavailable），
// 自查用 `npm run verify:settings`，线上核对用宿主 settings.describe。
//
// ── 接线 API 的两个世代（DSH 0.1.5-rc.3 起改名，必须两条都留着）────────────────
// DSH ≤0.1.5-rc.3 之前，@deepseek-ai/dsh-settings 导出两个**自由函数**：
//     installSettingsSection(ctx, settingsNamespace('dsh-omkb'), schema, entry, hooks)
// 0.1.5-rc.3 起包的导出面只剩 { SettingsConflictError, SettingsProvider, redactSecrets }，
// 命名空间改由**服务方法**注册：
//     ctx.settings.installSection(owner, 'dsh-omkb', schema, entry, hooks)
// 两个自由函数被删掉后，旧代码里的 `settingsNamespace(...)` 变成 undefined → 调用即抛
// 「loaded.settingsNamespace is not a function」→ 命名空间静默不注册 → 设置页写入全被
// 丢弃（用户看到的就是「改参数保存失败」）。所以这里先探服务方法、再退回包导出，
// 并把走的是哪条路记进 diagnose().api（/omkb/state 可见），别让这种版本漂移再靠猜。

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** 命名空间（与客户端 DSVI.NS 相同）。 */
export const OMKB_NAMESPACE = 'dsh-omkb'

/**
 * 宿主侧默认值 —— schema 默认值与 installSection 的 entry（组合层 / provider 缺失时的
 * 兜底值）共用这一份，避免两处各写一份慢慢漂移。
 * 必须与客户端 DSVI.OMKB_DEFAULTS 逐字段一致（两侧分别构建、无法共享模块）。
 */
export const OMKB_DEFAULTS = {
  brightness: 0.9,
  autoDim: 0,
  actLabels: {},
  joystick: {},
  agentKey: 'recent',
  agentAssign: {},
  knob: 'navigate',
  knobCustom: {},
  micKey: false,
  tapFocus: false,
  guideSeen: false,
  removed: false
}

/** 智能体键映射模式。 */
export const AGENT_KEY_MODES = ['pinned', 'recent', 'priority', 'custom']
/** 旋钮模式。 */
export const KNOB_MODES = ['navigate', 'reasoning', 'scroll', 'custom']
/** 自定义旋钮手势。 */
export const KNOB_GESTURES = ['cw', 'ccw', 'click', 'long']
/** 自动调暗可选秒数（0 = 关闭）。 */
export const AUTO_DIM_SECONDS = [0, 30, 60, 120, 300]

const clamp01 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.9)

/**
 * DSH 运行时依赖的解析位置。
 *
 * dsh-settings / schemastery 由 DSH 运行时提供，插件包自己不声明它们（也不该声明具体
 * 版本）。麻烦在于「从哪个位置解析」：Node 默认把符号链接解析成**真实路径**，所以开发
 * 态以 `link:` 挂进 profile 的插件，其 import.meta.url 指向项目目录——那里没有
 * node_modules/@deepseek-ai，`createRequire(import.meta.url)` 直接 MODULE_NOT_FOUND。
 * 结果是依赖加载失败 → 命名空间静默不注册 → 设置页写入全部被丢弃
 * （客户端只看到 unavailable，旧代码还会把它显示成「已保存」）。
 *
 * 因此按「最近 → 最远」依次尝试多个解析根，并把每个根的错误码收集起来：全部失败时
 * 日志能直接指出是哪一环断的，而不是只报一句「缺少 settings 服务」。
 */
const DEP_PACKAGES = {
  settings: '@deepseek-ai/dsh-settings',
  schema: '@deepseek-ai/schemastery'
}

/** 解析根候选：插件的真实路径、宿主进程入口、cwd、DSH_DEPS_DIR、DSH_HOME。 */
const resolverRoots = () => {
  const roots = []
  const push = (label, base) => {
    if (typeof base === 'string' && base.length > 0) roots.push({ label, base })
  }
  push('插件自身', import.meta.url)
  push('宿主进程入口', process.argv[1])
  push('工作目录', path.join(process.cwd(), 'package.json'))
  const depsDir = process.env.DSH_DEPS_DIR
  push('DSH_DEPS_DIR', depsDir ? path.join(depsDir, 'package.json') : null)
  const dshHome = process.env.DSH_HOME || path.join(homedir(), '.dsh')
  push('DSH_HOME/profile', path.join(dshHome, 'profiles', 'node_modules', 'package.json'))
  return roots
}

/**
 * 按 {@link resolverRoots} 的顺序解析一个包。
 * @param pkg - 包名。
 * @returns {{ok: true, path: string, req: Function, root: string} | {ok: false, failures: string[]}}
 */
const resolveDep = (pkg) => {
  const failures = []
  for (const root of resolverRoots()) {
    try {
      const req = createRequire(root.base)
      return { ok: true, path: req.resolve(pkg), req, root: root.label }
    } catch (e) {
      failures.push(`${root.label}(${e && e.code ? e.code : (e && e.message) || e})`)
    }
  }
  return { ok: false, failures }
}

/**
 * 解析并加载 schema 依赖。失败时返回带原因的失败对象，让调用方优雅退化为
 * 「无持久化」，而不是让整个插件加载失败。
 *
 * 为什么是异步的：宿主会用 Promise.all 并发加载插件，dsh-settings 是 ESM 包，
 * 那一刻可能还没求值完。此时 `require()` 它会抛
 * `ERR_REQUIRE_ESM_RACE_CONDITION: ... not yet fully loaded`——而且这个错误发生在
 * 模块求值期，同步路径上无法重试。`import()` 会等它求值完再给结果，因此这里统一用
 * 动态 import（schemastery 虽然是 CJS，也一起走这条路径，避免 require 拿到半成品导出）。
 *
 * **只有 schemastery 是硬依赖**：命名空间现在通过 `ctx.settings` 服务注册（见本文件头），
 * 服务由 DSH 自己提供，插件不需要 import dsh-settings 包。这个包只在「旧版 DSH」的
 * 退路里才有用（那两个自由函数），所以解析不到它不算致命 —— 若最终两条路都走不通，
 * 失败信息里会写清楚是哪一环。
 * @returns {Promise<{ok: true, z: any, zSource: string, legacy: {settingsNamespace: Function, installSettingsSection: Function} | null, source: string}
 *   | {ok: false, reason: string}>}
 */
export async function loadSettingsDeps() {
  const schema = resolveDep(DEP_PACKAGES.schema)
  if (!schema.ok) {
    return { ok: false, reason: `解析 DSH 运行时依赖失败：${DEP_PACKAGES.schema} ← ${schema.failures.join(' / ')}` }
  }
  const settings = resolveDep(DEP_PACKAGES.settings)
  // 旧版退路：包里那两个自由函数还在时才算数。新版包解析得到、但导出面已经不含它们，
  // 于是 legacy 为 null —— 这不是错误，只是说明必须走服务方法。
  let legacy = null
  let legacyNote = settings.ok ? '包内无 installSettingsSection（新版导出面）' : `未解析到（${settings.failures.join(' / ')}）`
  if (settings.ok) {
    try {
      const mod = await import(pathToFileURL(settings.path).href)
      if (typeof mod.installSettingsSection === 'function' && typeof mod.settingsNamespace === 'function') {
        legacy = { installSettingsSection: mod.installSettingsSection, settingsNamespace: mod.settingsNamespace }
        legacyNote = '可用'
      }
    } catch (e) {
      legacyNote = `加载失败（${(e && e.message) || e}）`
    }
  }
  try {
    const zMod = await import(pathToFileURL(schema.path).href)
    return {
      ok: true,
      z: zMod.default ?? zMod,
      zSource: schema.root,
      legacy,
      legacyNote,
      source: `${settings.root || '（未解析）'} / ${schema.root}`
    }
  } catch (e) {
    const code = e && e.code ? `${e.code}: ` : ''
    return { ok: false, reason: `已解析到路径但加载失败：${code}${(e && e.message) || e}` }
  }
}

let cachedSchema
/**
 * 构造命名空间 schema。所有字段都带默认值，因此即使设置文档里没有 `dsh-omkb:` 段，
 * resolved 值也是完整的——客户端回读不会拿到 undefined，宿主也能直接用默认值初始化灯光。
 * @param deps - {@link loadSettingsDeps} 成功返回的依赖对象（必须有可用的 `z`）。
 * @returns {any | null} schemastery schema；依赖不可用时为 null。
 */
export function buildOmkbSchema(deps) {
  if (cachedSchema !== undefined) return cachedSchema
  if (!deps || typeof deps.z?.object !== 'function') {
    cachedSchema = null
    return cachedSchema
  }
  const { z } = deps
  cachedSchema = z.object({
    /** 灯光亮度 0..1。 */
    brightness: z.number().min(0).max(1).default(OMKB_DEFAULTS.brightness),
    /** 空闲自动调暗秒数，0 = 关闭。 */
    autoDim: z.number().min(0).default(OMKB_DEFAULTS.autoDim),
    /**
     * 键帽覆盖：动作键 id（ACT06..ACT12）→ 选定的键帽 id（如 'ACT07'）。
     * 值域与客户端 OMKB_KEYCAPS 的 id 一致；留空表示用物理键的出厂标签。
     */
    actLabels: z.dict(z.string()).default(OMKB_DEFAULTS.actLabels),
    /**
     * 模拟摇杆映射：{ up, right, down, left } → 动作名（客户端 JOY_ACTION.name）。
     * 动作名是开放集合（含技能名），故用自由字典而非枚举；
     * 'none' 表示该方向不绑定任何动作（不能用 null：dict<string> 校验会拒掉）。
     */
    joystick: z.dict(z.string()).default(OMKB_DEFAULTS.joystick),
    /** 智能体键映射模式。 */
    agentKey: z.union(AGENT_KEY_MODES).default(OMKB_DEFAULTS.agentKey),
    /** 自定义分配：槽位(0..5) → 会话 id（键按字符串存储）。 */
    agentAssign: z.dict(z.string()).default(OMKB_DEFAULTS.agentAssign),
    /** 旋钮模式。 */
    knob: z.union(KNOB_MODES).default(OMKB_DEFAULTS.knob),
    /** 自定义旋钮分配：{ cw, ccw, click, long } → 动作名。 */
    knobCustom: z.dict(z.string()).default(OMKB_DEFAULTS.knobCustom),
    /** 独立麦克风宽键。 */
    micKey: z.boolean().default(OMKB_DEFAULTS.micKey),
    /** 轻点聚焦窗口。 */
    tapFocus: z.boolean().default(OMKB_DEFAULTS.tapFocus),
    /**
     * 首次连接引导看过了没有（客户端 GuideController 在用户跳过/走完时写 true）。
     * 落在这里而不是 localStorage：它是「这台键盘的引导」而不是「这个浏览器的引导」，
     * 换台机器 / 重装浏览器不该再来一遍。重置布局会清掉它（于是下次连上再弹一次）。
     */
    guideSeen: z.boolean().default(OMKB_DEFAULTS.guideSeen),
    /**
     * 「这台键盘已被移除」（客户端 DeviceController 在用户确认移除时写 true）。
     *
     * 它**不是偏好**：不出现在界面上，也不该被「重置布局」清掉 —— 唯一的清法是
     * 「设备重新连上」（那时界面放回来、标记也一并清掉，见 src/client/device.js）。
     * 为什么必须落盘：它决定「设置页分区与侧边栏入口要不要收起来」，
     * 只记在浏览器里的话，一次刷新（或换浏览器）界面就又冒出来了 —— 用户看到的是
     * 「点了移除没用」。移除时清空的是**其余全部字段**，这个标记自己留着。
     */
    removed: z.boolean().default(OMKB_DEFAULTS.removed)
  })
  return cachedSchema
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
 * 组装设置命名空间接线所需的 hooks，并暴露「注册命名空间」与「读取当前值」。
 *
 * 采用「事件推送」而不是「回调闭包」：静态 import 会在模块求值期执行，而 ble/logger
 * 要等 apply() 里才存在，因此 hooks 先把值缓存下来，等 apply() 用 `attach(onChange)`
 * 注册监听后再补发一次。
 * @returns {{ hooks: object, install: Function, diagnose: Function,
 *   consume: Function, attach: Function, read: Function }}
 */
export function createSettingsBridge() {
  let source = null
  let listener = null
  let prefsChanged = false
  // 命名空间「真的注册上了」的唯一判据：settings 服务的 inject 回调跑过。
  // 注册入口在回调里调 hooks.setSource(...)，只接线成功（没抛错）还不足以说明
  // 问题——ctx.inject 是异步的，回调可能一直不触发。
  let registered = false
  // 依赖加载是异步的（见 loadSettingsDeps），因此这里是个状态机：
  // idle → loading → ready | failed。外部通过 diagnose() 观察，不猜。
  let phase = 'idle'
  let failure = null
  let depsSource = null
  // 实际走的接线入口（DSH 改过这个 API 的形态，出问题时这一项直接指路）。
  let api = null
  let registeredVia = null
  // 两个入口（createSettingsBridge().hooks 与 install 传给注册入口的）
  // 必须是同一份，否则 registered 会记在不被调用的那份上。
  const hooks = {
    setSource: (fn) => { source = fn; registered = true },
    onChange: () => { prefsChanged = true; if (listener) { try { listener() } catch (e) {} } }
  }
  const fail = (reason) => { phase = 'failed'; failure = reason }
  return {
    hooks,
    /**
     * 发起接线：等 settings 服务就绪 + 异步加载 schemastery，然后注册 `dsh-omkb` 命名空间。
     *
     * 两段都必须异步/延后：
     *  * settings 服务晚于本插件出现是常态（插件加载顺序不保证）→ 走 `ctx.inject(['settings'])`；
     *  * 宿主用 Promise.all 并发加载插件，那一刻 ESM 依赖可能还没求值完 → 同步 require 会抛
     *    ERR_REQUIRE_ESM_RACE_CONDITION（见 loadSettingsDeps）。
     * 结果通过 diagnose()（宿主挂在 /omkb/state 上）观察。
     * @param ctx - 宿主插件上下文。
     * @returns {boolean} 是否已发起接线（不代表已完成）。
     */
    install: (ctx) => {
      if (typeof ctx?.inject !== 'function') {
        fail('宿主上下文不支持 ctx.inject，无法等待 settings 服务')
        return false
      }
      if (phase !== 'idle') return phase === 'ready'
      phase = 'loading'

      /** 依赖就绪 + 服务就绪之后，按 API 世代选一条接线路径。 */
      const wire = (sctx, loaded) => {
        if (!loaded.ok) { fail(loaded.reason); return }
        const schema = buildOmkbSchema(loaded)
        if (schema === null) { fail('schemastery 可用但没有 z.object，schema 构建失败'); return }
        const svc = sctx && sctx.settings
        try {
          if (svc && typeof svc.installSection === 'function') {
            // DSH 0.1.5-rc.3+：命名空间是服务方法。
            // installSection(owner, ns, schema, entry, hooks) —— entry 是组合层 / provider
            // 缺失时的兜底值，必须给出完整对象（这里与 schema 默认值同源）。
            svc.installSection(ctx, OMKB_NAMESPACE, schema, OMKB_DEFAULTS, hooks)
            api = 'ctx.settings.installSection'
            registeredVia = 'service'
          } else if (loaded.legacy) {
            // 旧版 DSH：包里导出的自由函数（ns 需要品牌化）。
            loaded.legacy.installSettingsSection(
              ctx,
              loaded.legacy.settingsNamespace(OMKB_NAMESPACE),
              schema,
              OMKB_DEFAULTS,
              hooks
            )
            api = 'dsh-settings.installSettingsSection'
            registeredVia = 'package'
          } else {
            fail(`settings 服务没有 installSection，dsh-settings 包也没有 installSettingsSection（${loaded.legacyNote}）—— 该 DSH 版本没有可用的命名空间注册入口`)
            return
          }
          depsSource = loaded.source
          phase = 'ready'
        } catch (e) {
          fail(`设置命名空间接线失败（${api || '未识别路径'}）：${(e && e.message) || e}`)
        }
      }

      const deps = loadSettingsDeps()
      try {
        ctx.inject(['settings'], (sctx) => {
          deps.then(
            (loaded) => wire(sctx, loaded),
            (e) => fail(`依赖加载异常：${(e && e.message) || e}`)
          )
        })
      } catch (e) {
        fail(`等待 settings 服务失败：${(e && e.message) || e}`)
        return false
      }
      return true
    },
    /**
     * 运行时可观测的诊断快照（宿主把它挂到 /omkb/state，便于不重启终端就判断持久化是否在线）。
     * `api` 记的是走的哪一代接线入口 —— DSH 改名过这个 API，出问题时这行字直接指路。
     */
    diagnose: () => ({ phase, registered, depsSource, api, via: registeredVia, error: failure }),
    /** 消费一次待处理标记：有变更（或首次）时返回 true。 */
    consume: () => { const had = prefsChanged; prefsChanged = false; return had },
    /**
     * 注册变更监听并立刻补发一次当前值。
     * @param fn - 设置值变化时的回调（无参）。
     */
    attach: (fn) => { listener = fn; listener() },
    /** @returns 当前 resolved 设置段（无 settings 服务时为 null）。 */
    read: () => { try { return source ? source() : null } catch (e) { return null } }
  }
}
