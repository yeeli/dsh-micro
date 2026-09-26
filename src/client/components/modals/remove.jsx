// dsh-omkb · client/src/components/modals/remove.jsx
// 「移除键盘」确认弹窗。
//
// 这是一次**破坏性**操作（清空全部偏好 + 把设置页分区与侧边栏入口一起收起来），所以动手前
// 先把后果一条条摆出来，而不是点一下就没了 —— 与「重置布局」同一个规矩（见 modals/reset.jsx）。
//
// 与重置的区别（文案里说清楚，否则用户分不清这两个按钮）：
//   重置布局 = 键帽/摇杆/旋钮回到出厂值，**界面还在**；
//   移除键盘 = 清空全部设置**并且**把界面收起来，直到这台键盘重新连上为止。
//
// 落地的代码在 client/device.js 的 remove()（清字段 → 立 removed 标记 → 回读确认）。
const ITEM_KEYS = [
  'remove.item1',
  'remove.item2',
  'remove.item3',
  'remove.item4',
  'remove.item5'
]

/**
 * @param tt - 词典函数（设置页同款）。
 * @param onCancel - 放弃移除。
 * @param onConfirm - 真的移除（调用方负责清空 + 回读校验）。
 */
export function OmkbRemoveModal({ tt, onCancel, onConfirm }) {
  const t = typeof tt === 'function' ? tt : ((k) => k)
  return (
    <div className="omkb-modal-overlay" onMouseDown={onCancel}>
      <div className="omkb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="omkb-modal-head">
          <div>
            <div className="omkb-modal-title">{t('remove.title')}</div>
            <div className="omkb-modal-sub">{t('remove.sub')}</div>
          </div>
          <button type="button" className="omkb-modal-x" aria-label={t('remove.cancel')} onClick={onCancel}>×</button>
        </div>
        <div className="omkb-reset-body">
          <ul className="omkb-reset-list">
            {ITEM_KEYS.map((k) => <li key={k}>{t(k)}</li>)}
          </ul>
          <div className="omkb-modal-hint">{t('remove.hint')}</div>
        </div>
        <div className="omkb-modal-foot">
          <button type="button" className="omkb-ghost" onClick={onCancel}>{t('remove.cancel')}</button>
          <button type="button" className="omkb-primary omkb-primary--danger" onClick={onConfirm}>{t('remove.confirm')}</button>
        </div>
      </div>
    </div>
  )
}
