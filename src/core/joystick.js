// dsh-omkb · core/joystick.js
// 摇杆（joystick）解析：设备通过 RPC `v.oai.rad` 上报摇杆状态，
//   参数形如 { a: 0.90, d: 1.0 }（字段可位于顶层或 params），
//   a = 角度（0..1，归一化到 0..360°，其中 0 为"右"），d = 推力/位移（0..1，≈0 视为回中）。
// 依据角度 a 计算四方向（顺时针）：上 270° / 右 0° / 下 90° / 左 180°（各取 ±45° 扇区）。
// 返回 { a, d, dir }；非 v.oai.rad 消息、或 d 低于推力阈值（回中/未推动）时返回 null。
export const JOYSTICK_METHOD = 'v.oai.rad'
const PUSH_THRESHOLD = 0.35

export function parseJoystick(msg) {
  if (!msg || msg.method !== JOYSTICK_METHOD) return null
  const p = (msg && msg.params) && typeof msg.params === 'object' ? msg.params : {}
  const aRaw = msg.a != null ? msg.a : p.a
  const dRaw = msg.d != null ? msg.d : p.d
  if (aRaw == null) return null
  const a = Number(aRaw)
  const d = dRaw == null ? 1 : Number(dRaw)
  if (!Number.isFinite(a)) return null
  // 推力不足视作回中（没有明确推进方向）
  if (!(d >= PUSH_THRESHOLD)) return { a, d, dir: null }
  // a ∈ [0,1] → 角度 [0°,360°)；右为 0°（顺时针：右0/下90/左180/上270）
  let deg = (a - Math.floor(a)) * 360
  let dir
  if (deg >= 315 || deg < 45) dir = 'right'
  else if (deg < 135) dir = 'down'
  else if (deg < 225) dir = 'left'
  else dir = 'up'
  return { a, d, dir }
}