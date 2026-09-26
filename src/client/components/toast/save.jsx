// dsh-omkb · client/src/components/toast/save.jsx
// 保存提示：顶部悬浮 message。
//
// 以前保存状态是标题行里的一行文本（omkb-save-status）：它是**在文档流里**的，
// 出现/消失会把下方卡片整体顶动一行；而且贴着标题一闪而过，容易漏看。
// 现在改成固定在视口顶部的轻量提示（message 的位置习惯）：
//   * position:fixed + 高 z-index —— 不占布局、浮在设置弹窗之上（弹窗自己的层级见 settings.css）；
//   * 三态各自带语义色（令牌取 DSH 主题，浅色/深色都跟着走）；
//   * pointer-events:none —— 它只是通知，绝不挡住底下任何控件的点击。
export const SAVE_TOAST_TEXT = { saving: 'settings.saving', saved: 'settings.saved', error: 'settings.saveError' }

/**
 * @param status - null（不发）/ 'saving' / 'saved' / 'error'。
 * @param t - 词典函数（locale.bind 出来的那个）。
 */
export function OmkbSaveToast({ status, t }) {
  if (!status) return null
  return (
    <div className={'omkb-toast omkb-toast--' + status} role="status" aria-live="polite">
      <span className="omkb-toast__ico" aria-hidden="true">
        {status === 'saving' ? (
          <span className="omkb-toast__spin" />
        ) : (
          <svg
            viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="8" cy="8" r="6.6" />
            {status === 'saved'
              ? <path d="M5 8.3l2.1 2.1L11 6.4" />
              : <path d="M8 4.9v3.7M8 11.2h.01" />}
          </svg>
        )}
      </span>
      <span className="omkb-toast__text">{t(SAVE_TOAST_TEXT[status] || 'settings.saveError')}</span>
    </div>
  )
}
