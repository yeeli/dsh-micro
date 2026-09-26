// dsh-omkb · client/src/components/common/voice-button.jsx
// 输入框工具行左侧的**麦克风按钮**（注册在 conversation.input.left 槽位）。
//
// 它只做界面与「按钮 → 共享语音控制器」的转发；识别本身在 ../../voice.js。
// 三条与 DSH 打交道的事都从这里发起，但都落到别处：
//   * 把转写文本写进 composer 草稿 → actions/index.js 的 DshOps.writeDraft（本目录下唯一碰 DSH 的路径）
//   * 把槽位给的 inputActions 转交给 DshOps（写草稿的正式入口）→ bindComposer
//   * 卸载时停掉识别
// 门面万一没装配起来时才退回自己拼草稿，拼接规则仍取同一份（actions/session.js 的 formatDraft），
// 不在界面层另写一条。
//
// ⚠ **官方启用时这个按钮整个让位**（2026-09-26）：
// 官方那套（@deepseek-ai/dsh-experimental-voice-input-bundle）自己的麦克风就在同一行走廊里
// （模型选择器与发送按钮之间），两个麦克风只会让人犯迷糊。判据是 actions/dom.js 的
// officialVoiceReady()（出口在、麦克风在、没灰），**不是**我们自己的状态 —— 官方 Bundle
// 是**运行时**在插件管理页启停的、页面不会刷新，所以这里低频探一下（组件卸载即停）。
// 让位只是不渲染那颗按钮：下面所有 hook 与副作用都排在它**之前**，bindComposer / setCommit
// 照旧绑上 —— 否则官方一旦被停用，写草稿的链路会突然缺一环。
import { useCallback, useEffect, useState } from 'react'
import { DSVI, MicIcon } from '../../core.js'
import { formatDraft } from '../../actions/session.js'
import { officialVoiceReady } from '../../actions/dom.js'

/** 官方语音可用性的探测间隔：Bundle 启停是低频事件，每次只读一个 DOM 属性。 */
const OFFICIAL_POLL_MS = 1200

export const VoiceInputButton = ({ input, inputActions }) => {
  const controller = DSVI.services ? DSVI.services.voice : null
  const [state, setState] = useState({
    listening: !!(controller && controller.listening),
    unsupported: !!(controller && controller.unsupported)
  })
  const [official, setOfficial] = useState(() => officialVoiceReady())

  useEffect(() => {
    if (!controller) return undefined
    return controller.subscribe(() => {
      setState({ listening: controller.listening, unsupported: controller.unsupported })
    })
  }, [controller])

  // 官方在不在，只有 DOM 知道（它的 Bundle 可以在页面不刷新的情况下被启用/停用）。
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    setOfficial(officialVoiceReady())
    const id = setInterval(() => setOfficial(officialVoiceReady()), OFFICIAL_POLL_MS)
    return () => clearInterval(id)
  }, [])

  // 由组件把"写回输入框"的提交函数交给共享控制器。
  // 「往 DSH 的 composer 草稿里写字」是 DSH 操作 → 走 DshOps（actions/ 是 client 目录下
  // 唯一碰 DSH 的目录），这里既不认识 inputActions 的细节，也不自己去 DOM 里找输入框。
  useEffect(() => {
    if (!controller) return undefined
    controller.setCommit((before, text) => {
      const ops = DSVI.services ? DSVI.services.ops : null
      if (ops) { ops.writeDraft(before, text); return }
      if (inputActions && typeof inputActions.setDraft === 'function') inputActions.setDraft(formatDraft(before, text))
    })
    return () => { controller.setCommit(null) }
  }, [inputActions, controller])

  // 把槽位（DSH）交给我们的输入动作转交给 DshOps —— 它是写回草稿时用的正式入口。
  useEffect(() => {
    const ops = DSVI.services ? DSVI.services.ops : null
    if (!ops) return undefined
    ops.bindComposer(inputActions)
    return () => { ops.bindComposer(null) }
  }, [inputActions])

  useEffect(() => () => { if (controller) controller.stop() }, [controller])

  const start = useCallback(() => { if (controller) controller.start() }, [controller])

  const onClick = () => {
    if (!controller) return
    if (controller.listening) controller.stop()
    else start()
  }

  // ---- 官方接管 → 让位 ----
  // 放在所有 hook 之后：不渲染按钮，但上面那些副作用（订阅 / setCommit / bindComposer）照旧生效。
  if (official) return null

  const title = (controller && controller.unsupported)
    ? '当前浏览器不支持语音识别，请使用 Chrome / Edge'
    : (controller && controller.listening ? '停止聆听' : '语音输入')

  return (
    <button
      type="button"
      className="dsvi-btn"
      aria-label={title}
      title={title}
      aria-pressed={controller ? controller.listening : false}
      data-active={controller && controller.listening || undefined}
      onClick={onClick}
      disabled={!controller}
    >
      {MicIcon(controller && controller.listening ? 18 : 16)}
    </button>
  )
}
