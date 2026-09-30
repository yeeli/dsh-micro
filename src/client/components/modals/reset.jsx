// dsh-micro · client/src/components/modals/reset.jsx
// 「重置布局」确认弹窗。
//
// 重置是**破坏性**的（用户一颗一颗调出来的键帽、摇杆映射会被一次清空），所以动手前
// 先把「会重置成什么」摆在眼前，而不是点一下就没了。列出来的就是**出厂值**
// （与宿主 schema 的 default 一一对应，见 src/core/settings.js）。
//
// 持久化：确认后走与设置页其它控件同一条写入路径（unset → 回落 schema 默认），
// 并回读校验 —— 也就是说它是**落盘**的，重启后仍然是出厂设置（而不是只改了这一屏）。
// 落地的代码在 settings/panel.jsx 的 resetLayout()。
const RESET_GROUPS = [
  {
    title: '键盘布局',
    items: [
      '键帽：动作键回到 模式 / 归档 / 拒绝 / 批准 / 语音 / 发送；拆分态的右开关回到「自定义」（未指派）',
      '模拟摇杆：左 = 撤销 · 右 = 重做 · 上 = 切换规划模式 · 下 = 切换侧边栏',
      '独立麦克风键：关闭（两颗开关并回一颗宽键）'
    ]
  },
  {
    title: '按键选项',
    items: [
      '智能体键：最近使用（自定义分配清空）',
      '旋钮模式：输入区导航（自定义分配清空）',
      '轻点聚焦：关闭',
      '首次连接引导：下次连上设备时重新弹一遍'
    ]
  }
]

/**
 * @param onCancel - 放弃重置。
 * @param onConfirm - 真的重置（由调用方负责 unset + 回读校验）。
 */
export function MicroResetModal({ onCancel, onConfirm }) {
  return (
    <div className="micro-modal-overlay" onMouseDown={onCancel}>
      <div className="micro-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="micro-modal-head">
          <div>
            <div className="micro-modal-title">重置布局</div>
            <div className="micro-modal-sub">把下面这些改回出厂设置，并保存</div>
          </div>
          <button type="button" className="micro-modal-x" onClick={onCancel}>×</button>
        </div>
        <div className="micro-reset-body">
          {RESET_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="micro-sub-cat">{g.title}</div>
              <ul className="micro-reset-list">
                {g.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="micro-modal-foot">
          <button type="button" className="micro-ghost" onClick={onCancel}>取消</button>
          <button type="button" className="micro-primary" onClick={onConfirm}>重置</button>
        </div>
      </div>
    </div>
  )
}
