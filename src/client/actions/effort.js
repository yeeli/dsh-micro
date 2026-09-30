// dsh-micro · client/src/actions/effort.js
// 【推理强度（reasoning effort）】：当前模型提供哪几档、现在在哪一档、升/降一档该选谁。
//
// ── 与 ./reasoning.js 的分工（两个文件都「关于推理」，判据不同）────────────────
//   reasoning.js  —— **靠界面**：点开「模型 / 推理等级」菜单、在菜单里画蓝环、按下确认。
//                    旋钮的「仅推理」模式（转动移环、按下确认）走这条，本文件不动它。
//   本文件        —— **靠服务**：从 `ctx.modelDirectories`（dsh-client-ui-model-selection 提供的
//                    ModelDirectoryResolver → 每条会话一个 ModelDirectory）直接读出
//                    「这条会话用的是哪个模型、这个模型有哪些档」，再用 `directory.select()`
//                    落一次选择 —— **全程不打开任何菜单**。
//                    用户 2026-09-29 的口径：「如果当前会话使用的模型可以选择推理强度,
//                    不用打开选项, 直接加减, 没有就提示不可用」。
//
// ── 契约（照抄 @deepseek-ai/dsh-api-session-controller 的 types，一个字都不许自己编）──
//   ModelSelection     = { provider, model, reasoningEffort? }              // 一次完整的模型选择
//   ModelReasoning     = { efforts: [{ id, name, description? }], defaultEffort? }
//   ModelCatalogModel  = { id, name, description?, reasoning?: ModelReasoning }
//   ModelProviderGroup = { id, name, models: ModelCatalogModel[] }
//   ModelDirectoryState= { current, pending, routable, groups, failures, status, error }
//   `reasoning` 整个缺失 = 这个模型没有可调的档（DSH 自己的菜单这时写着「当前模型未提供推理等级」）。
//
// ── 三处必须与 DSH 自己那份菜单**逐字对齐**（对齐源：ui-model-selection 的
//    effortChoices / effectiveEffort / chooseEffort）──────────────────────────────
//   ① **等级列表** = [「Provider 默认」?] + efforts。头上那一档**不是恒有**的：只有模型
//      **没有** defaultEffort 时清单里才多出一条「默认」（effort 为 undefined）——
//      此时 DSH 的菜单里用户真的能选到它，我们加减时也必须能停在它上面。
//   ② **当前档** = `selection.reasoningEffort ?? reasoning.defaultEffort`
//      （用户没显式选过 = 模型默认档）。
//   ③ **提交时 `reasoningEffort === undefined` 就不带这个键**（不是带 null、也不是空串）：
//      `ModelDirectory.select()` 与菜单的 chooseEffort 都是这么发出去的。
//   少一条的表现都是同一类：「按键算出来的档」与「菜单里勾着的那一档」对不上。
//
// ── 为什么这里敢优先用 `pending` 起算（DSH 的菜单不这么做）──────────────────────
//   `select()` 是异步的，落盘要等一帧投影才回到 `current`。连按两下「推理+」时若每次都从
//   `current` 起算，第二下算出来的目标与第一下一模一样 —— 等于**白按**。DSH 的菜单不会有这个
//   问题（选中即关菜单，不存在连按），而按键天生会被连按，所以我们从「刚发出去、还没落盘的
//   那一次」（`pending`）起算，连按才累积。⚠ 只认同一个 provider+model 的 pending。
//
// ── 本文件全是纯函数 ────────────────────────────────────────────────────────
//   不认识 DSH、不碰 DOM、**不 import 任何东西**（连 react 都不碰）—— Node 自检直接喂假快照
//   断言（test/verify_actions.js §3e）。真正去摸服务的是门面（./index.js 的 reasoningAdjust）。

/** 两次选择是不是**同一个模型路由**（provider + model）。路由不同 = 不是同一件事，一律不比较。 */
export const sameRoute = (a, b) => !!a && !!b && a.provider === b.provider && a.model === b.model

/**
 * 某个模型路由的推理元数据（`ModelCatalogModel.reasoning`）。
 *
 * ⚠ 从 `state.groups` 里现查，而不是另开一路服务：这份 groups 就是宿主给整个客户端的那一份目录
 *   （`ModelDirectoryState.groups`），DSH 自己的菜单（`ModelCatalogDirectory.reasoningFor`）读的
 *   也是同一份数据，所以这里不可能与菜单看到的不一致。
 * @param state - `directory.store.getSnapshot()`（ModelDirectoryState）。
 * @param selection - 要查的那个选择（provider + model）。
 * @returns {object|undefined} `{ efforts, defaultEffort? }`；**undefined = 读不到**
 *   （清单里没有这个路由 / 这个模型条目上没有 reasoning）—— 两种情况对我们都是「没有档可调」。
 */
export const modelReasoningOf = (state, selection) => {
  const sel = selection || null
  if (!state || !sel) return undefined
  if (typeof sel.provider !== 'string' || !sel.provider) return undefined
  if (typeof sel.model !== 'string' || !sel.model) return undefined
  const groups = Array.isArray(state.groups) ? state.groups : []
  const group = groups.find((g) => g && g.id === sel.provider)
  const models = group && Array.isArray(group.models) ? group.models : []
  const model = models.find((m) => m && m.id === sel.model)
  return (model && model.reasoning) || undefined
}

/**
 * 等级列表（**DSH 那份的形状**）：可选的一条「Provider 默认」在头，然后依次是各档。
 * @param reasoning - `modelReasoningOf()` 的结果（undefined 也可以喂进来，得到空数组）。
 * @returns {Array<{effort: (string|undefined), name: (string|null)}>} `effort` 为 undefined
 *   的那条就是「Provider 默认」，提交时**不带** reasoningEffort 键（见文件头 ③）。
 */
export const effortChoicesOf = (reasoning) => {
  if (!reasoning) return []
  const efforts = Array.isArray(reasoning.efforts) ? reasoning.efforts : []
  // ① 头上那一档只在模型**没有**默认档时存在（有默认档时，「默认」就是列表里的某一档本身）
  const head = reasoning.defaultEffort === undefined ? [{ effort: undefined, name: null }] : []
  return head.concat(
    efforts
      .filter((e) => e && typeof e.id === 'string' && e.id)
      .map((e) => ({ effort: e.id, name: typeof e.name === 'string' && e.name ? e.name : e.id }))
  )
}

/**
 * 现在生效的是哪一档（= DSH 菜单的 `effectiveEffort`）：显式选过就用它，否则用模型默认档。
 * @returns {string|undefined} 档位 id；undefined = 停在「Provider 默认」那一条上。
 */
export const effortEffectiveOf = (selection, reasoning) => {
  const explicit = selection ? selection.reasoningEffort : undefined
  if (typeof explicit === 'string' && explicit) return explicit
  const dflt = reasoning ? reasoning.defaultEffort : undefined
  return (typeof dflt === 'string' && dflt) ? dflt : undefined
}

/** 某一档在列表里的下标（认不出 → -1：会话记着一个已被删掉的档，或档位表刚换过）。 */
export const effortIndexOf = (choices, effort) => {
  const list = Array.isArray(choices) ? choices : []
  return list.findIndex((c) => c.effort === effort)
}

/**
 * 从**哪一次选择**起算：优先「刚发出去、还没落盘的 pending」，否则用 current。
 * 见文件头「为什么敢优先用 pending」——连按要能累积。
 * @returns {object|null} null = 连当前模型都读不到（目录还没加载完 / 会话没有绑定）。
 */
export const effortBaseOf = (state) => {
  const current = state && state.current ? state.current : null
  if (!current) return null
  const pending = state && state.pending ? state.pending : null
  return (pending && sameRoute(pending, current)) ? pending : current
}

/**
 * 「升/降一档」的完整判据 —— 门面（reasoningAdjust）与只读诊断（effortInfo）**共用这一份**，
 * 探针里不许再算一遍（算两遍就会漂移）。
 *
 * 三处口径：
 *   * **不绕圈**：到底了就是到底了（`edgeTop` / `edgeBottom`），不从头再来 —— 与旋钮「仅推理」
 *     的蓝环同一条（ringTo 也是夹在两端）。用户按「推理+」停在 Max 上再按，宿主那一侧也确实
 *     没有下一档可去。
 *   * **当前档不在列表里** → 从**靠近的那一端**进列表：升一档落到第一档、降一档落到最后一档。
 *     这是唯一确定性、且不兜圈子的选择（与 nextPresetOf 的「当前 id 不在清单里 → 从第一个开始」
 *     同一条规矩）。
 *   * **只有一档可调 = 没有加减可言** → 也说 `noReasoning`，绝不假装移了一档。
 * @param state - ModelDirectoryState（`directory.store.getSnapshot()`）。
 * @param dir - 正数 = 升一档，负数 = 降一档（只看符号）。
 * @returns {object} 成功：`{ ok:true, target, choices, index, from, to }`（target 可直接喂
 *   `directory.select()`）；失败：`{ ok:false, why, ... }`，why ∈
 *   `unknownModel`（读不到当前模型）/ `noReasoning`（这个模型没有档可调）/
 *   `edgeTop` / `edgeBottom`（已经在两端）。
 */
export const effortStepOf = (state, dir) => {
  const step = dir >= 0 ? 1 : -1
  const base = effortBaseOf(state)
  if (!base) return { ok: false, why: 'unknownModel' }
  const reasoning = modelReasoningOf(state, base)
  const choices = effortChoicesOf(reasoning)
  if (choices.length < 2) return { ok: false, why: 'noReasoning', selection: base, choices }
  const effort = effortEffectiveOf(base, reasoning)
  const index = effortIndexOf(choices, effort)
  const at = index === -1 ? (step > 0 ? -1 : choices.length) : index
  const to = at + step
  if (to < 0) return { ok: false, why: 'edgeBottom', selection: base, choices, index, effort }
  if (to >= choices.length) return { ok: false, why: 'edgeTop', selection: base, choices, index, effort }
  const next = choices[to]
  const target = { provider: base.provider, model: base.model }
  // ③ 「Provider 默认」那一档提交时**不带** reasoningEffort 键（照抄 chooseEffort）
  if (next.effort !== undefined) target.reasoningEffort = next.effort
  return {
    ok: true,
    target,
    choices,
    index,
    from: index === -1 ? null : choices[index],
    to: next
  }
}
