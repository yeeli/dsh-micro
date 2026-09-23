var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var __privateWrapper = (obj, member, setter, getter) => ({
  set _(value) {
    __privateSet(obj, member, value, setter);
  },
  get _() {
    return __privateGet(obj, member, getter);
  }
});
var _reportId, _channelRpc, _vendorId, _productId, _deviceName, _deviceMfr, _triggerMethod, _triggerKey, _debounceMs, _statePath, _configPath, _reconnectPath, _agentsPath, _state, _held, _logger, _last, _lineBuf, _rpcId, _dimmed, _lastActivity, _allIdle, _idleSince, _hid, _diagnostics, _dimTimer, _exitGuard, _reconnectTimer, _desiredAgents, _slotSessions, _errorSlots, _errorTimer, _errorMs, _errorColor, _statusFrom, _inboundStatus, _outboundStatus, _log, _warn, _snapshot, _bump, _wake, _handleLine, _feed, _onData, _BleController_instances, parseHex_fn, _matches, _sendRpc, _requestStatus, _sendBrightness, _applyConfig, _clampRgb, _clamp01, _sendThstatus, _renderAgents, _armErrorTimer, _applyAgents, _autoDimCheck, _jsonHead, _readBody, _json;
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
const JOYSTICK_METHOD = "v.oai.rad";
const PUSH_THRESHOLD = 0.35;
function parseJoystick(msg) {
  if (!msg || msg.method !== JOYSTICK_METHOD) return null;
  const p = msg && msg.params && typeof msg.params === "object" ? msg.params : {};
  const aRaw = msg.a != null ? msg.a : p.a;
  const dRaw = msg.d != null ? msg.d : p.d;
  if (aRaw == null) return null;
  const a = Number(aRaw);
  const d = dRaw == null ? 1 : Number(dRaw);
  if (!Number.isFinite(a)) return null;
  if (!(d >= PUSH_THRESHOLD)) return { a, d, dir: null };
  let deg = (a - Math.floor(a)) * 360;
  let dir;
  if (deg >= 315 || deg < 45) dir = "right";
  else if (deg < 135) dir = "down";
  else if (deg < 225) dir = "left";
  else dir = "up";
  return { a, d, dir };
}
const SIGNUM = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
const EXIT_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
const exitCodeOf = (sig) => 128 + (SIGNUM[sig] || 0);
const exitPlan = ({ seen, others }) => seen >= 2 || others === 0 ? "exit" : "handover";
const GUARD_LISTENERS = /* @__PURE__ */ new WeakSet();
const createExitGuard = ({
  release,
  proc = globalThis.process,
  signals = EXIT_SIGNALS,
  schedule = setImmediate,
  log = null,
  exit = null
} = {}) => {
  const handlers = /* @__PURE__ */ new Map();
  let seen = 0;
  let released = false;
  const say = (msg) => {
    try {
      if (log) log(msg);
    } catch (e) {
    }
  };
  const releaseOnce = () => {
    if (released) return false;
    released = true;
    try {
      if (typeof release === "function") release();
    } catch (e) {
      say(`释放资源失败（忽略）：${e && e.message || e}`);
    }
    return true;
  };
  const doExit = (sig) => {
    const code = exitCodeOf(sig);
    try {
      proc.exitCode = code;
    } catch (e) {
    }
    if (typeof exit === "function") return exit(code);
    return proc.exit(code);
  };
  const othersFor = (sig, mine) => {
    try {
      if (typeof proc.listeners !== "function") return 0;
      return proc.listeners(sig).filter((l) => l !== mine && !GUARD_LISTENERS.has(l)).length;
    } catch (e) {
      return 0;
    }
  };
  const makeHandler = (sig) => function exitGuardHandler() {
    const mine = handlers.get(sig);
    seen += 1;
    const others = othersFor(sig, mine);
    if (exitPlan({ seen, others }) === "exit") {
      say(seen >= 2 ? `收到 ${sig}（第 ${seen} 次），强制退出 ${exitCodeOf(sig)}` : `收到 ${sig}，宿主未接管该信号，按默认语义退出 ${exitCodeOf(sig)}`);
      return doExit(sig);
    }
    try {
      schedule(() => releaseOnce());
    } catch (e) {
      releaseOnce();
    }
  };
  const install = () => {
    let added = 0;
    for (const sig of signals) {
      if (handlers.has(sig)) continue;
      const h = makeHandler(sig);
      GUARD_LISTENERS.add(h);
      try {
        proc.on(sig, h);
        handlers.set(sig, h);
        added += 1;
      } catch (e) {
        GUARD_LISTENERS.delete(h);
      }
    }
    return added;
  };
  const dispose = () => {
    let removed = 0;
    for (const [sig, h] of [...handlers]) {
      handlers.delete(sig);
      try {
        const off = typeof proc.off === "function" ? proc.off : proc.removeListener;
        off.call(proc, sig, h);
        removed += 1;
      } catch (e) {
      }
    }
    return removed;
  };
  return { install, dispose, releaseOnce, isInstalled: () => handlers.size > 0, handlers };
};
const require$1 = createRequire(import.meta.url);
const AGENT_STATUSES = /* @__PURE__ */ new Set(["running", "idle", "error", "empty"]);
const AGENT_STATUS_INBOUND = /* @__PURE__ */ new Set(["running", "idle", "empty"]);
const AGENT_STATUS_DEFAULT = "empty";
const HID_ACT = { RELEASE: 0, PRESS: 1, PULSE: 2 };
const STATUS_METHOD = "device.status";
const normalizeBattery = (v) => {
  if (typeof v === "boolean" || v === null || v === void 0 || v === "") return null;
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.round(n);
};
const normalizeCharging = (v) => v === true || v === 1;
const parseDeviceStatus = (msg) => {
  if (!msg || typeof msg !== "object") return null;
  const bag = (o) => o && typeof o === "object" && !Array.isArray(o) ? o : null;
  const params = bag(msg.params) || bag(msg.result);
  if (!params) return null;
  const method = typeof msg.method === "string" ? msg.method.toLowerCase() : "";
  const named = method === STATUS_METHOD || method.endsWith("." + STATUS_METHOD);
  const battery = normalizeBattery(params.battery);
  if (!named && battery === null) return null;
  return { battery, charging: normalizeCharging(params.is_charging) };
};
class BleController {
  constructor({ logger, diagnostics } = {}) {
    __privateAdd(this, _BleController_instances);
    // ---------- 配置（可用环境变量覆盖） ----------
    __privateAdd(this, _reportId, 6);
    // ReportMap: 0x85, 0x06
    __privateAdd(this, _channelRpc, 2);
    // 2 = RPC（1 = debug，忽略）
    // 设备匹配：优先按 VID:PID；默认 0x303A:0x8361，可用 DSH_HID_VID/DSH_HID_PID（十六进制字符串）覆盖；
    // 未配置 VID/PID 时回退到旧的 name/manufacturer 匹配（DSH_HID_NAME/DSH_HID_MFR）
    __privateAdd(this, _vendorId, __privateMethod(this, _BleController_instances, parseHex_fn).call(this, process.env.DSH_HID_VID || "0x303A"));
    __privateAdd(this, _productId, __privateMethod(this, _BleController_instances, parseHex_fn).call(this, process.env.DSH_HID_PID || "0x8361"));
    __privateAdd(this, _deviceName, (process.env.DSH_HID_NAME || "OMKB").toLowerCase());
    __privateAdd(this, _deviceMfr, (process.env.DSH_HID_MFR || "OMKB LAB").toLowerCase());
    __privateAdd(this, _triggerMethod, process.env.DSH_HID_METHOD || null);
    // 可选：只响应某个 method
    __privateAdd(this, _triggerKey, process.env.DSH_HID_KEY || null);
    // 可选：只响应某个 params.k
    __privateAdd(this, _debounceMs, 250);
    // 一次物理按压只计一次
    __privateAdd(this, _statePath, "/omkb/state");
    __privateAdd(this, _configPath, "/omkb/config");
    __privateAdd(this, _reconnectPath, "/omkb/reconnect");
    __privateAdd(this, _agentsPath, "/omkb/agents");
    // ---------- 状态：计数器 + 连接状态 + 灯光配置，暴露给浏览器客户端 ----------
    // 关键：**每个输入源都有自己的累加计数器**，浏览器据此归属事件，而不是靠 t 猜。
    // t 只是「发生过一件事」的全局计数，而设备状态字段会被后续事件覆盖（推完立刻松手，
    // 轮询那一刻 joy 已经回中），拿它当「事件类型」用必然误判——曾经的后果是旋钮/摇杆
    // 操作被当成「麦克风键」而触发语音输入（见 src/client/hid-bridge.js 顶部注释）。
    //   enc      带符号累计步数 → 旋钮旋转（差值即步数）
    //   knobPress           计数 → 旋钮按下（不受 #bump 去抖影响）
    //   joyPush/joyDir      计数 + 最近一次有效方向 → 摇杆推了一次（回中不计，方向不走丢）
    //   joyT                含回中的方向变化计数（老客户端用，语义保持不变）
    //   down / keyAct       **当前按住的键** + 本次事件的边沿（见 HID_ACT）。
    //                       宿主以前只会说“发生了一件事”，于是“还按着”和“已经松开”在浏览器侧
    //                       无法区分（设置页的布局特效只能按定时器猜着弹回来）。设备给了 act，
    //                       这里就如实翻译：down = 真相（快照即状态），keyAct = 本次边沿；
    //                       老固件两者分别是 [] 和 null。
    //   battery / charging  设备的**电平型**状态（device.status 上报，见 parseDeviceStatus）。
    //                       故意**不给它配计数器**：它是「现在多少」而不是「发生了一件事」，
    //                       拿它判事件就会退回「靠状态字段猜事件类型」那类老 bug（见文件头）。
    //                       断开时清成 null/false —— 留着旧读数等于在展示一台已经拔掉的键盘的电量。
    __privateAdd(this, _state, { t: 0, open: false, product: null, battery: null, charging: false, brightness: 0.9, autoDim: 0, key: null, keyAct: null, down: [], agent: -1, act: null, enc: 0, encPress: 0, encLong: 0, knobPress: 0, joy: null, joyT: 0, joyPush: 0, joyDir: null, agents: [], errors: [], idle: null, keyT: {} });
    /** 当前物理按住的键名（只有拿到 act 才会维护；见 #handleLine 的松开分支）。 */
    __privateAdd(this, _held, /* @__PURE__ */ new Set());
    __privateAdd(this, _logger);
    __privateAdd(this, _last, 0);
    __privateAdd(this, _lineBuf, "");
    // 跨帧重组 buffer，按 '\n' 切 JSON 行
    __privateAdd(this, _rpcId, 0);
    // 灯光控制（Codex Micro 兼容协议，见 src/core/ble.js 顶部注释）
    __privateAdd(this, _dimmed, false);
    // 是否已因空闲而自动调暗
    __privateAdd(this, _lastActivity, Date.now());
    /**
     * 浏览器上报的「所有会话都空闲」（null = 还没上报过 / 老客户端）。
     * 自动调暗按它计时：**会话全空闲**才是真的没事干；有会话在跑就不该关灯。
     */
    __privateAdd(this, _allIdle, null);
    __privateAdd(this, _idleSince, 0);
    // 进入「全空闲」的时刻（0 = 未知）
    __privateAdd(this, _hid, null);
    __privateAdd(this, _diagnostics, null);
    __privateAdd(this, _dimTimer, null);
    /**
     * 进程退出安全网（见 ./exit-guard.js）。
     * **只有真的打开了设备才会 install()**：手上没有句柄就完全不碰进程信号，
     * 宿主启动失败时也就不会因为我们而变成「退不掉」。
     */
    __privateAdd(this, _exitGuard, null);
    __privateAdd(this, _reconnectTimer, null);
    // ---------- 运行失败的红色闪灯 ----------
    // 分工：**浏览器**决定「哪个会话占哪颗键、平时是什么颜色」（它才知道会话列表），
    // **宿主**决定「失败的那颗键临时变红多久」（它才收得到 agent/error，也是唯一写 HID 的人）。
    // 因此浏览器下发的槽位里带上会话 id（sid），宿主用它把失败事件定位到具体某个键。
    __privateAdd(this, _desiredAgents, []);
    // 浏览器下发的期望灯态（设备字段 + st/sid 元数据）
    __privateAdd(this, _slotSessions, []);
    // 槽位下标 → 会话 id
    __privateAdd(this, _errorSlots, /* @__PURE__ */ new Map());
    // 槽位下标 → { until, sid }，红灯窗口
    __privateAdd(this, _errorTimer, null);
    // 指向最近一次到期的单个定时器（不是每个槽位一个）
    __privateAdd(this, _errorMs, 3e3);
    // 红灯持续时长；可用 DSH_OMKB_ERROR_MS 覆盖（自检脚本调小它）
    __privateAdd(this, _errorColor, 16711680);
    // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js）
    // ---------- 槽位状态标识（st） ----------
    // 每个槽位随灯态一起带一个「会话状态」字段，跟着 v.oai.thstatus 下发到设备：
    //   running — 会话正在运行      idle — 会话空闲
    //   empty   — 该键没有会话      error — 该会话运行失败（**宿主叠加**，只在红灯窗口内）
    // 为什么要它：以前状态只体现在颜色里（蓝/白），设备只能靠猜颜色反推；有了 st，设备可以
    // 自己按状态做灯效，而颜色随时可调不影响语义。词表必须与 src/client/agents.js 的
    // AGENT_STATUS 一致（两边自检都会断言这一串）。
    // 校验状态标识：合法就用它，非法/缺字段 → 按槽位自身推断
    // （有会话在亮 = e 开着或有颜色 → idle；否则 empty）。老客户端不发 st 也能正常工作。
    __privateAdd(this, _statusFrom, (slot, allowed) => {
      if (!slot) return AGENT_STATUS_DEFAULT;
      if (typeof slot.st === "string" && allowed.has(slot.st)) return slot.st;
      return Number(slot.e) > 0 || __privateGet(this, _clampRgb).call(this, slot.c) > 0 ? "idle" : AGENT_STATUS_DEFAULT;
    });
    /** 浏览器报上来的状态（不接受 error，见 AGENT_STATUS_INBOUND）。 */
    __privateAdd(this, _inboundStatus, (slot) => __privateGet(this, _statusFrom).call(this, slot, AGENT_STATUS_INBOUND));
    /** 真正下发到设备前的兜底校验（此时才允许宿主叠加的 error）。 */
    __privateAdd(this, _outboundStatus, (slot) => __privateGet(this, _statusFrom).call(this, slot, AGENT_STATUSES));
    // 日志同时打到 Cordis logger 和终端 stdout/stderr，方便从命令行用 `dsh web` 调试
    __privateAdd(this, _log, (...a) => {
      var _a, _b;
      try {
        (_b = (_a = __privateGet(this, _logger)) == null ? void 0 : _a["info"]) == null ? void 0 : _b.call(_a, ...a);
      } catch (e) {
      }
      ;
      console.log("[omkb]", ...a);
    });
    __privateAdd(this, _warn, (...a) => {
      var _a, _b;
      try {
        (_b = (_a = __privateGet(this, _logger)) == null ? void 0 : _a["warn"]) == null ? void 0 : _b.call(_a, ...a);
      } catch (e) {
      }
      ;
      console.error("[omkb]", ...a);
    });
    /**
     * 测试注入：把一行 JSON 当作设备上报处理（与 HID 数据帧走同一条 #handleLine 路径）。
     * 只给自检脚本用（src/verify_joystick.js 用它喂 v.oai.rad 摇杆帧，把
     * 「角度 → 方向 → joy/joyT 计数」这条链路钉在测试里）；运行时不调用。
     * @param line - 一行 JSON 文本（可带尾随换行）。
     * @returns {void}
     */
    __publicField(this, "feedLine", (line) => {
      __privateGet(this, _handleLine).call(this, String(line));
    });
    // 状态快照 = 硬件状态 + 可选诊断。诊断由宿主注入（目前是设置持久化是否在线）：
    // 终端里的 logger 输出不一定会落到 stdout，把关键结论挂到 /omkb/state 上，
    // 排查时一条 curl 就能看到，不用重启终端或翻日志。
    __privateAdd(this, _snapshot, () => {
      if (!__privateGet(this, _diagnostics)) return __privateGet(this, _state);
      try {
        return { ...__privateGet(this, _state), settings: __privateGet(this, _diagnostics).call(this) };
      } catch (e) {
        return __privateGet(this, _state);
      }
    });
    // 防抖计数 + 空闲调暗恢复。restoreLight=false 时只通知计数、不写回 LED（用于摇杆这类纯输入事件，
    // 摇杆不应向键盘发回任何灯光信息）
    __privateAdd(this, _bump, (label, restoreLight = true) => {
      const now = Date.now();
      __privateSet(this, _lastActivity, now);
      if (restoreLight) __privateGet(this, _wake).call(this);
      if (now - __privateGet(this, _last) < __privateGet(this, _debounceMs)) return;
      __privateSet(this, _last, now);
      __privateGet(this, _state).t += 1;
      __privateGet(this, _log).call(this, `HID 触发 ${__privateGet(this, _state).t}${label ? " (" + label + ")" : ""}`);
    });
    /**
     * 从「空闲调暗」状态恢复亮度。两处会调用：按下任意键（#bump）、会话重新开始运行（#applyAgents）。
     * 恢复时连灯态一起重放：调暗期间 #sendThstatus 是把灯压灭的（见它的实现），
     * 只写回亮度而不重放灯态的话，Agent 键会一直黑着。
     * @returns {boolean} 是否真的从调暗状态恢复。
     */
    __privateAdd(this, _wake, () => {
      if (!__privateGet(this, _dimmed)) return false;
      __privateSet(this, _dimmed, false);
      if (__privateGet(this, _state).brightness > 0) __privateGet(this, _sendBrightness).call(this, __privateGet(this, _state).brightness);
      __privateGet(this, _renderAgents).call(this);
      return true;
    });
    // 处理一条完整的 JSON 通知行，如 {"method":"v.oai.hid","params":{"k":"AG00"}}
    __privateAdd(this, _handleLine, (line) => {
      console.log(line);
      const raw = line.trim();
      if (!raw) return;
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        __privateGet(this, _warn).call(this, "非法 JSON 行:", raw);
        return;
      }
      if (!msg || typeof msg !== "object") return;
      const status = parseDeviceStatus(msg);
      if (status) {
        __privateGet(this, _state).battery = status.battery;
        __privateGet(this, _state).charging = status.charging;
        return;
      }
      if (typeof msg.method !== "string") return;
      if (__privateGet(this, _triggerMethod) && msg.method !== __privateGet(this, _triggerMethod)) return;
      const key = msg.params && msg.params.k;
      if (__privateGet(this, _triggerKey) && (!key || key !== __privateGet(this, _triggerKey))) return;
      const keyAct = msg.params && typeof msg.params.act === "number" ? msg.params.act : null;
      __privateGet(this, _state).keyAct = keyAct;
      if (keyAct === HID_ACT.RELEASE) {
        if (key) {
          __privateGet(this, _held).delete(key);
          __privateGet(this, _state).down = [...__privateGet(this, _held)];
        }
        return;
      }
      if (key && keyAct !== null && keyAct !== HID_ACT.PULSE) {
        __privateGet(this, _held).add(key);
        __privateGet(this, _state).down = [...__privateGet(this, _held)];
      }
      __privateGet(this, _state).key = key || null;
      if (key) {
        const map = __privateGet(this, _state).keyT || (__privateGet(this, _state).keyT = {});
        if (map[key] !== void 0 || Object.keys(map).length < 64) {
          map[key] = (map[key] || 0) + 1;
        }
      }
      if (key === "ENC_CW") {
        __privateGet(this, _state).enc = (__privateGet(this, _state).enc || 0) + 1;
        __privateGet(this, _state).agent = -1;
        __privateGet(this, _state).act = null;
        __privateGet(this, _bump).call(this, key);
        return;
      }
      if (key === "ENC_CC") {
        __privateGet(this, _state).enc = (__privateGet(this, _state).enc || 0) - 1;
        __privateGet(this, _state).agent = -1;
        __privateGet(this, _state).act = null;
        __privateGet(this, _bump).call(this, key);
        return;
      }
      if (msg.method === JOYSTICK_METHOD) {
        const j = parseJoystick(msg);
        const dir = j && j.dir || null;
        __privateGet(this, _state).agent = -1;
        __privateGet(this, _state).act = null;
        const prev = __privateGet(this, _state).joy;
        __privateGet(this, _state).joy = dir;
        if (dir !== prev) {
          __privateGet(this, _state).joyT = (__privateGet(this, _state).joyT || 0) + 1;
          if (dir) {
            __privateGet(this, _state).joyPush = (__privateGet(this, _state).joyPush || 0) + 1;
            __privateGet(this, _state).joyDir = dir;
            __privateGet(this, _bump).call(this, "JOY_" + dir, false);
          }
        }
        return;
      }
      const m = /^AG0([0-5])$/i.exec(key || "");
      const a = /^ACT(0[6-9]|1[0-2])$/i.exec(key || "");
      __privateGet(this, _state).agent = m ? Number(m[1]) : -1;
      __privateGet(this, _state).act = a ? "ACT" + a[1] : null;
      if (key === "ENC") __privateGet(this, _state).knobPress = (__privateGet(this, _state).knobPress || 0) + 1;
      __privateGet(this, _bump).call(this, key || msg.method);
    });
    // 把一段 payload 追加进重组 buffer，按 '\n' 切出完整行处理
    __privateAdd(this, _feed, (payload) => {
      __privateSet(this, _lineBuf, __privateGet(this, _lineBuf) + payload.toString("utf8"));
      let idx;
      while ((idx = __privateGet(this, _lineBuf).indexOf("\n")) !== -1) {
        const line = __privateGet(this, _lineBuf).slice(0, idx);
        __privateSet(this, _lineBuf, __privateGet(this, _lineBuf).slice(idx + 1));
        if (line.length) {
          try {
            __privateGet(this, _handleLine).call(this, line);
          } catch (e) {
            __privateGet(this, _warn).call(this, `丢弃异常行: ${e && e.message ? e.message : e}`);
          }
        }
      }
      if (__privateGet(this, _lineBuf).length > 4096) __privateSet(this, _lineBuf, "");
    });
    __privateAdd(this, _onData, (buf) => {
      if (!buf || buf.length < 3) return;
      let off = buf[0] === __privateGet(this, _reportId) ? 1 : 0;
      if (buf.length < off + 2) return;
      const channel = buf[off];
      const len = buf[off + 1];
      if (channel !== __privateGet(this, _channelRpc)) return;
      __privateGet(this, _feed).call(this, buf.slice(off + 2, off + 2 + len));
    });
    // 设备匹配：优先 VID+PID 精确匹配；未配置 VID/PID 时回退到 name/manufacturer
    __privateAdd(this, _matches, (d) => {
      if (__privateGet(this, _vendorId) != null || __privateGet(this, _productId) != null) {
        return __privateGet(this, _vendorId) != null && d.vendorId === __privateGet(this, _vendorId) && __privateGet(this, _productId) != null && d.productId === __privateGet(this, _productId);
      }
      const p = typeof d.product === "string" ? d.product.toLowerCase() : "";
      const m = typeof d.manufacturer === "string" ? d.manufacturer.toLowerCase() : "";
      return p.includes(__privateGet(this, _deviceName)) && m === __privateGet(this, _deviceMfr);
    });
    __publicField(this, "open", () => {
      var _a;
      if (__privateGet(this, _hid) || __privateGet(this, _state).open) return;
      try {
        const nodehid = require$1("node-hid");
        if (!nodehid || typeof nodehid.devices !== "function") {
          __privateGet(this, _log).call(this, "未安装 node-hid 原生模块，HID 读取关闭");
          return;
        }
        const list = nodehid.devices();
        const cand = list.find(__privateGet(this, _matches));
        if (!cand) {
          __privateGet(this, _log).call(this, `未找到 ${__privateGet(this, _vendorId) != null || __privateGet(this, _productId) != null ? `VID:PID = 0x${(__privateGet(this, _vendorId) || 0).toString(16)}:0x${(__privateGet(this, _productId) || 0).toString(16)}` : `name="${__privateGet(this, _deviceName)}" & manufacturer="${__privateGet(this, _deviceMfr)}"`} 的 HID 设备；可设 DSH_HID_VID/DSH_HID_PID（十六进制，如 1235/0a91），或检查设备是否已配对且为厂商自定义类(标准键盘会被系统独占)`);
          return;
        }
        __privateGet(this, _state).product = cand.product || cand.manufacturer || JSON.stringify({ VID: cand.vendorId, PID: cand.productId });
        __privateSet(this, _hid, new nodehid.HID(cand.path));
        __privateGet(this, _state).open = true;
        (_a = __privateGet(this, _exitGuard)) == null ? void 0 : _a.install();
        if (__privateGet(this, _reconnectTimer)) {
          clearInterval(__privateGet(this, _reconnectTimer));
          __privateSet(this, _reconnectTimer, null);
        }
        __privateGet(this, _log).call(this, `已打开 HID 设备: ${__privateGet(this, _state).product} (manufacturer=${cand.manufacturer || ""})`);
        if (__privateGet(this, _desiredAgents).length) __privateGet(this, _renderAgents).call(this);
        __privateGet(this, _hid).on("data", __privateGet(this, _onData));
        __privateGet(this, _hid).on("error", (e) => {
          __privateGet(this, _warn).call(this, "HID 读取错误:", e && e.message);
          this.close();
          if (!__privateGet(this, _reconnectTimer)) {
            __privateSet(this, _reconnectTimer, setInterval(() => this.open(), 3e4));
            __privateGet(this, _reconnectTimer).unref();
            __privateGet(this, _log).call(this, "设备断开，已启动 30 秒自动重连");
          }
        });
        __privateGet(this, _requestStatus).call(this);
      } catch (e) {
        __privateGet(this, _warn).call(this, "node-hid 打开失败(需要正确编译的原生依赖，且设备非标准键盘):", e && e.message);
        __privateGet(this, _state).open = false;
      }
    });
    __publicField(this, "close", () => {
      if (__privateGet(this, _hid)) {
        try {
          __privateGet(this, _hid).close();
        } catch (e) {
        }
        __privateSet(this, _hid, null);
      }
      __privateGet(this, _state).open = false;
      __privateGet(this, _held).clear();
      __privateGet(this, _state).down = [];
      __privateGet(this, _state).battery = null;
      __privateGet(this, _state).charging = false;
    });
    // ---------- HID 写回：JSON-RPC 分帧写入（用于灯光/亮度控制） ----------
    // 输出报告 64 字节：[0x06 report id][0x02 channel][len][JSON 片段<=61]，超长按 61 字节切片
    __privateAdd(this, _sendRpc, (method, params) => {
      if (!__privateGet(this, _hid) || !__privateGet(this, _state).open) {
        __privateGet(this, _warn).call(this, "设备未连接，忽略写回:", method);
        return false;
      }
      const json = Buffer.from(JSON.stringify({ method, params, id: ++__privateWrapper(this, _rpcId)._ }), "utf8");
      const MAX = 61;
      for (let pos = 0; pos < json.length; pos += MAX) {
        const frag = json.slice(pos, pos + MAX);
        const buf = Buffer.alloc(64);
        buf[0] = __privateGet(this, _reportId);
        buf[1] = __privateGet(this, _channelRpc);
        buf[2] = frag.length;
        frag.copy(buf, 3);
        try {
          __privateGet(this, _hid).write(buf);
        } catch (e) {
          __privateGet(this, _warn).call(this, "HID 写入失败:", e && e.message);
          return false;
        }
      }
      __privateGet(this, _log).call(this, "已发送 RPC:", method, JSON.stringify(params));
      return true;
    });
    /**
     * 向设备要一次状态（电量 / 是不是在充电）。
     *
     * 协议用法（用户 2026-09-23 给的）：**连上之后发一条 `device.status`，设备就会上报**
     * `battery`（电量）与 `is_charging`（是否在充电）。设备自己不会定时推，所以「连上就问一次」
     * 是拿到读数的前提。params 给空对象 —— 这是「把你的状态告诉我」的查询，不带参数。
     *
     * 设备怎么回都能收：通知形状（`{method:'device.status',params:{...}}`）或应答形状
     * （`{id,result:{...}}`）都由 parseDeviceStatus 认，见那里的注释。
     * @returns {boolean} 是否真的写给了设备（没连上时为 false，不抛错）。
     */
    __privateAdd(this, _requestStatus, () => __privateGet(this, _sendRpc).call(this, STATUS_METHOD, {}));
    // 亮度：写回 rgbcfg（普通键背光 + 外周氛围灯）。v 为 0..1
    __privateAdd(this, _sendBrightness, (v) => {
      const b = Math.max(0, Math.min(1, v));
      if (b <= 0) {
        return __privateGet(this, _sendRpc).call(this, "v.oai.rgbcfg", {
          ambient: { e: 0, b: 0, s: 0, m: 0, c: 0 },
          keys: { e: 0, b: 0, s: 0, m: 0, c: 0 }
        });
      }
      return __privateGet(this, _sendRpc).call(this, "v.oai.rgbcfg", {
        ambient: { e: 2, b, s: 0.4, m: 0, c: 3166206 },
        keys: { e: 1, b, s: 0, m: 0, c: 16777215 }
      });
    });
    // 应用来自设置面板的配置补丁
    __privateAdd(this, _applyConfig, (patch) => {
      if (!patch || typeof patch !== "object") return;
      if (typeof patch.brightness === "number") {
        __privateGet(this, _state).brightness = Math.max(0, Math.min(1, patch.brightness));
        __privateSet(this, _dimmed, false);
        __privateSet(this, _lastActivity, Date.now());
        __privateGet(this, _sendBrightness).call(this, __privateGet(this, _state).brightness);
        __privateGet(this, _renderAgents).call(this);
      }
      if (typeof patch.autoDim === "number") {
        __privateGet(this, _state).autoDim = Math.max(0, patch.autoDim);
        if (__privateGet(this, _state).autoDim <= 0) __privateGet(this, _wake).call(this);
        else __privateSet(this, _dimmed, false);
      }
    });
    // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
    // 与 #applyConfig 的区别：只有值真的变化才写 HID，避免重复下发灯光指令。
    // 返回是否发生了改动。
    __publicField(this, "setPrefs", (prefs) => {
      if (!prefs || typeof prefs !== "object") return false;
      let changed = false;
      if (typeof prefs.brightness === "number") {
        const b = Math.max(0, Math.min(1, prefs.brightness));
        if (b !== __privateGet(this, _state).brightness) {
          __privateGet(this, _state).brightness = b;
          __privateSet(this, _dimmed, false);
          __privateSet(this, _lastActivity, Date.now());
          __privateGet(this, _sendBrightness).call(this, b);
          __privateGet(this, _renderAgents).call(this);
          changed = true;
        }
      }
      if (typeof prefs.autoDim === "number") {
        const d = Math.max(0, prefs.autoDim);
        if (d !== __privateGet(this, _state).autoDim) {
          __privateGet(this, _state).autoDim = d;
          if (d <= 0) __privateGet(this, _wake).call(this);
          else __privateSet(this, _dimmed, false);
          changed = true;
        }
      }
      return changed;
    });
    __privateAdd(this, _clampRgb, (v) => Math.max(0, Math.min(16777215, Math.round(Number(v) || 0))));
    __privateAdd(this, _clamp01, (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
    });
    // Agent 键 LED：把 6 个槽位的状态一次性写回（v.oai.thstatus）
    // 每个槽位带 `st`（状态标识）——设备可以只认它做灯效，不必反推颜色。
    // 这里是设备协议的**唯一出口**：未知字段（浏览器的 sid、错误类型等）不会被带下去。
    //
    // 自动调暗期间一律把 e/b 压成 0：调暗是「灯全灭」，而浏览器仍会照常推送灯态
    // （设置页打开、会话列表变化都会触发），不压的话下一次推送就把灯又点亮了。
    __privateAdd(this, _sendThstatus, (slots) => {
      if (!Array.isArray(slots)) return false;
      const dimmed = __privateGet(this, _dimmed);
      const params = slots.slice(0, 6).map((s, i) => ({
        id: i,
        st: __privateGet(this, _outboundStatus).call(this, s),
        c: __privateGet(this, _clampRgb).call(this, s && s.c),
        b: dimmed ? 0 : __privateGet(this, _clamp01).call(this, s && s.b, 0),
        e: dimmed ? 0 : Math.round(Number(s && s.e) || 0),
        s: __privateGet(this, _clamp01).call(this, s && s.s, 0),
        sk: 0,
        sa: 0
      }));
      __privateGet(this, _state).agents = params;
      return __privateGet(this, _sendRpc).call(this, "v.oai.thstatus", params);
    });
    // ---------- 期望灯态 + 失败红灯 ⇒ 实际灯态 ----------
    // 唯一的灯态出口：把浏览器下发的期望灯态与「正在闪红的那几颗键」叠加后写 HID。
    // 这样浏览器在任何时刻重新下发灯态（会话列表变化、切设置页都会触发）都不会把红灯
    // 提前冲掉——红灯由宿主自己守到窗口结束。
    // 状态标识同理：红灯窗口内的那颗键报 'error'，窗口结束自动回到浏览器给的状态。
    __privateAdd(this, _renderAgents, () => {
      if (!__privateGet(this, _desiredAgents).length) return false;
      const now = Date.now();
      const slots = __privateGet(this, _desiredAgents).map((s, i) => {
        const err = __privateGet(this, _errorSlots).get(i);
        const red = err !== void 0 && err.until > now;
        return { id: i, st: red ? "error" : s.st, c: red ? __privateGet(this, _errorColor) : s.c, b: s.b, e: s.e, s: s.s, sk: 0, sa: 0 };
      });
      __privateGet(this, _state).errors = [...__privateGet(this, _errorSlots)].map(([slot, e]) => ({ slot, sid: e.sid, msLeft: Math.max(0, e.until - now) }));
      return __privateGet(this, _sendThstatus).call(this, slots);
    });
    // 红灯窗口到期 → 收起红色、回到期望灯态（也就是「然后再变为空闲灯光」）。
    // 只保留一个定时器并指向最近一次到期：槽位可以同时有多个窗口，逐槽定时器会互相覆盖。
    __privateAdd(this, _armErrorTimer, () => {
      var _a, _b;
      if (__privateGet(this, _errorTimer)) {
        clearTimeout(__privateGet(this, _errorTimer));
        __privateSet(this, _errorTimer, null);
      }
      if (__privateGet(this, _errorSlots).size === 0) return;
      let next = Infinity;
      for (const e of __privateGet(this, _errorSlots).values()) if (e.until < next) next = e.until;
      __privateSet(this, _errorTimer, setTimeout(() => {
        __privateSet(this, _errorTimer, null);
        const now = Date.now();
        for (const [slot, e] of [...__privateGet(this, _errorSlots)]) if (e.until <= now) __privateGet(this, _errorSlots).delete(slot);
        __privateGet(this, _renderAgents).call(this);
        __privateGet(this, _armErrorTimer).call(this);
      }, Math.max(0, next - Date.now())));
      (_b = (_a = __privateGet(this, _errorTimer)).unref) == null ? void 0 : _b.call(_a);
    });
    /**
     * 某个会话运行失败 → 让它的那颗键闪红灯，窗口结束后自动回到期望灯态。
     *
     * 由宿主的 `agent/error` 事件驱动（见 src/core/index.js）。注意这个事件**只在真正的失败**
     * 时发出：用户主动中断走的是另一条分支，不会闪红灯。
     * @param {string} sessionId - 失败的会话（DSH 里 agent.id 就是会话 id）。
     * @returns {boolean} 是否真的点亮了某个键（该会话没占键时为 false）。
     */
    __publicField(this, "flashError", (sessionId) => {
      if (typeof sessionId !== "string" || !sessionId) return false;
      const slots = [];
      for (let i = 0; i < __privateGet(this, _slotSessions).length; i++) if (__privateGet(this, _slotSessions)[i] === sessionId) slots.push(i);
      if (slots.length === 0) return false;
      const until = Date.now() + __privateGet(this, _errorMs);
      for (const slot of slots) __privateGet(this, _errorSlots).set(slot, { until, sid: sessionId });
      __privateGet(this, _renderAgents).call(this);
      __privateGet(this, _armErrorTimer).call(this);
      __privateGet(this, _log).call(this, `会话运行失败 → 槽位 ${slots.join(",")} 闪红灯 ${__privateGet(this, _errorMs)}ms`);
      return true;
    });
    // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,s,sid}...], errorColor } 或纯数组）
    __privateAdd(this, _applyAgents, (payload) => {
      const list = Array.isArray(payload) ? payload : payload && Array.isArray(payload.slots) ? payload.slots : null;
      if (!list) return;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const c = payload.errorColor;
        if (typeof c === "number" && Number.isInteger(c) && c >= 0 && c <= 16777215) __privateSet(this, _errorColor, c);
        if (typeof payload.allIdle === "boolean") {
          __privateGet(this, _state).idle = payload.allIdle;
          if (payload.allIdle !== __privateGet(this, _allIdle)) {
            __privateSet(this, _allIdle, payload.allIdle);
            if (payload.allIdle) __privateSet(this, _idleSince, Date.now());
            else {
              __privateSet(this, _idleSince, 0);
              __privateGet(this, _wake).call(this);
            }
          }
        }
      }
      const desired = [];
      const sessions = [];
      for (let i = 0; i < 6; i++) {
        const s = list[i] || {};
        desired.push({
          st: __privateGet(this, _inboundStatus).call(this, s),
          c: __privateGet(this, _clampRgb).call(this, s.c),
          b: __privateGet(this, _clamp01).call(this, s.b, 0),
          e: Math.round(Number(s.e) || 0),
          s: __privateGet(this, _clamp01).call(this, s.s, 0)
        });
        sessions.push(typeof s.sid === "string" && s.sid ? s.sid : null);
      }
      __privateSet(this, _desiredAgents, desired);
      __privateSet(this, _slotSessions, sessions);
      const now = Date.now();
      const next = /* @__PURE__ */ new Map();
      for (const [, e] of __privateGet(this, _errorSlots)) {
        if (e.until <= now) continue;
        const at = sessions.indexOf(e.sid);
        if (at !== -1 && !next.has(at)) next.set(at, e);
      }
      __privateSet(this, _errorSlots, next);
      __privateGet(this, _renderAgents).call(this);
      __privateGet(this, _armErrorTimer).call(this);
    });
    // 空闲自动调暗：autoDim(秒) 到了就关灯（亮度 0 = ambient 与键灯一起熄）。
    //
    // 计时基准有两条路：
    //   * 浏览器报过 allIdle（新客户端）→ 用「进入全空闲的时刻」与「最后一次按键」里较晚的那个
    //     起算。会话在跑 = 有活干，直接不关；刚敲过键盘也不关——否则会出现
    //     「到点关灯 → 一按键又亮 → 1 秒后又关」的闪烁。
    //   * 还没这份信息（老客户端 / 从未上报）→ 退回原来的「无按键活动」判据，行为与以前完全一致。
    __privateAdd(this, _autoDimCheck, () => {
      if (__privateGet(this, _state).autoDim <= 0 || __privateGet(this, _dimmed) || !__privateGet(this, _state).open) return;
      if (__privateGet(this, _allIdle) === false) return;
      const ref = Math.max(__privateGet(this, _lastActivity), __privateGet(this, _idleSince));
      if (Date.now() - ref < __privateGet(this, _state).autoDim * 1e3) return;
      __privateSet(this, _dimmed, true);
      __privateGet(this, _sendBrightness).call(this, 0);
      __privateGet(this, _renderAgents).call(this);
      __privateGet(this, _log).call(this, `空闲自动调暗：关闭灯光（${__privateGet(this, _allIdle) === true ? "所有会话空闲" : "无按键活动"} ${__privateGet(this, _state).autoDim}s）`);
    });
    // ---------- HTTP 桥接：状态查询 + 配置写回 + 重连 ----------
    __privateAdd(this, _jsonHead, { "content-type": "application/json; charset=utf-8" });
    __privateAdd(this, _readBody, (req, cb) => {
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => cb(body));
    });
    __privateAdd(this, _json, (res, code, obj) => {
      res.writeHead(code, __privateGet(this, _jsonHead));
      res.end(JSON.stringify(obj));
    });
    __publicField(this, "registerRoute", (webServer) => {
      const disposers = [];
      try {
        disposers.push(webServer.register({
          kind: "exact",
          path: __privateGet(this, _statePath),
          handler: (_req, res) => {
            __privateGet(this, _json).call(this, res, 200, __privateGet(this, _snapshot).call(this));
          }
        }));
        disposers.push(webServer.register({
          kind: "exact",
          path: __privateGet(this, _configPath),
          handler: (req, res) => {
            if (req.method !== "POST") {
              __privateGet(this, _json).call(this, res, 405, { error: "method not allowed" });
              return;
            }
            __privateGet(this, _readBody).call(this, req, (body) => {
              try {
                __privateGet(this, _applyConfig).call(this, JSON.parse(body || "{}"));
                __privateGet(this, _json).call(this, res, 200, __privateGet(this, _state));
              } catch (e) {
                __privateGet(this, _json).call(this, res, 400, { error: e && e.message ? e.message : String(e) });
              }
            });
          }
        }));
        disposers.push(webServer.register({
          kind: "exact",
          path: __privateGet(this, _reconnectPath),
          handler: (_req, res) => {
            this.close();
            this.open();
            __privateGet(this, _json).call(this, res, 200, __privateGet(this, _state));
          }
        }));
        disposers.push(webServer.register({
          kind: "exact",
          path: __privateGet(this, _agentsPath),
          handler: (req, res) => {
            if (req.method !== "POST") {
              __privateGet(this, _json).call(this, res, 405, { error: "method not allowed" });
              return;
            }
            __privateGet(this, _readBody).call(this, req, (body) => {
              try {
                __privateGet(this, _applyAgents).call(this, JSON.parse(body || "{}"));
                __privateGet(this, _json).call(this, res, 200, __privateGet(this, _state));
              } catch (e) {
                __privateGet(this, _json).call(this, res, 400, { error: e && e.message ? e.message : String(e) });
              }
            });
          }
        }));
        return () => {
          for (const d of disposers) {
            try {
              d && d();
            } catch (e) {
            }
          }
        };
      } catch (e) {
        __privateGet(this, _warn).call(this, "webServer 路由注册失败:", e && e.message);
        return null;
      }
    });
    __publicField(this, "dispose", () => {
      var _a;
      clearInterval(__privateGet(this, _dimTimer));
      if (__privateGet(this, _errorTimer)) {
        clearTimeout(__privateGet(this, _errorTimer));
        __privateSet(this, _errorTimer, null);
      }
      if (__privateGet(this, _reconnectTimer)) {
        clearInterval(__privateGet(this, _reconnectTimer));
        __privateSet(this, _reconnectTimer, null);
      }
      (_a = __privateGet(this, _exitGuard)) == null ? void 0 : _a.dispose();
      this.close();
    });
    __privateSet(this, _logger, logger);
    __privateSet(this, _diagnostics, typeof diagnostics === "function" ? diagnostics : null);
    const ms = Number(process.env.DSH_OMKB_ERROR_MS);
    if (Number.isFinite(ms) && ms >= 0) __privateSet(this, _errorMs, ms);
    __privateSet(this, _dimTimer, setInterval(() => __privateGet(this, _autoDimCheck).call(this), 1e3));
    __privateGet(this, _dimTimer).unref();
    __privateSet(this, _exitGuard, createExitGuard({ release: () => this.close(), log: (m) => __privateGet(this, _warn).call(this, m) }));
  }
  get state() {
    return __privateGet(this, _state);
  }
  /**
   * 自检用：拿到退出安全网句柄。**只给自检脚本用**（`test/verify_exit_guard.js` 用它
   * 在不依赖真设备的前提下验证「信号到达时退不退、退得掉吗」）；运行时不调用，
   * 真机路径上安全网由 open() 自己 install()。
   */
  get exitGuard() {
    return __privateGet(this, _exitGuard);
  }
}
_reportId = new WeakMap();
_channelRpc = new WeakMap();
_vendorId = new WeakMap();
_productId = new WeakMap();
_deviceName = new WeakMap();
_deviceMfr = new WeakMap();
_triggerMethod = new WeakMap();
_triggerKey = new WeakMap();
_debounceMs = new WeakMap();
_statePath = new WeakMap();
_configPath = new WeakMap();
_reconnectPath = new WeakMap();
_agentsPath = new WeakMap();
_state = new WeakMap();
_held = new WeakMap();
_logger = new WeakMap();
_last = new WeakMap();
_lineBuf = new WeakMap();
_rpcId = new WeakMap();
_dimmed = new WeakMap();
_lastActivity = new WeakMap();
_allIdle = new WeakMap();
_idleSince = new WeakMap();
_hid = new WeakMap();
_diagnostics = new WeakMap();
_dimTimer = new WeakMap();
_exitGuard = new WeakMap();
_reconnectTimer = new WeakMap();
_desiredAgents = new WeakMap();
_slotSessions = new WeakMap();
_errorSlots = new WeakMap();
_errorTimer = new WeakMap();
_errorMs = new WeakMap();
_errorColor = new WeakMap();
_statusFrom = new WeakMap();
_inboundStatus = new WeakMap();
_outboundStatus = new WeakMap();
_log = new WeakMap();
_warn = new WeakMap();
_snapshot = new WeakMap();
_bump = new WeakMap();
_wake = new WeakMap();
_handleLine = new WeakMap();
_feed = new WeakMap();
_onData = new WeakMap();
_BleController_instances = new WeakSet();
// 十六进制字符串（可带 0x 前缀）→ 数值；非法返回 null
// 注意：必须是原型方法语法（非箭头字段），供上方字段初始化时调用
parseHex_fn = function(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{1,4}$/.test(s)) return null;
  return parseInt(s, 16);
};
_matches = new WeakMap();
_sendRpc = new WeakMap();
_requestStatus = new WeakMap();
_sendBrightness = new WeakMap();
_applyConfig = new WeakMap();
_clampRgb = new WeakMap();
_clamp01 = new WeakMap();
_sendThstatus = new WeakMap();
_renderAgents = new WeakMap();
_armErrorTimer = new WeakMap();
_applyAgents = new WeakMap();
_autoDimCheck = new WeakMap();
_jsonHead = new WeakMap();
_readBody = new WeakMap();
_json = new WeakMap();
const createBleReader = ({ logger, diagnostics } = {}) => {
  const ctl = new BleController({ logger, diagnostics });
  return {
    open: ctl.open,
    close: ctl.close,
    registerRoute: ctl.registerRoute,
    setPrefs: ctl.setPrefs,
    flashError: ctl.flashError,
    // 测试注入（自检脚本用它喂摇杆帧，见 #feedLine）；宿主运行时不用。
    feedLine: ctl.feedLine,
    dispose: ctl.dispose,
    state: ctl.state
  };
};
const OMKB_NAMESPACE = "dsh-omkb";
const OMKB_DEFAULTS = {
  brightness: 0.9,
  autoDim: 0,
  actLabels: {},
  joystick: {},
  agentKey: "recent",
  agentAssign: {},
  knob: "navigate",
  knobCustom: {},
  micKey: false,
  tapFocus: false,
  guideSeen: false,
  removed: false
};
const AGENT_KEY_MODES = ["pinned", "recent", "priority", "custom"];
const KNOB_MODES = ["navigate", "reasoning", "scroll", "custom"];
const KNOB_GESTURES = ["cw", "ccw", "click", "long"];
const AUTO_DIM_SECONDS = [0, 30, 60, 120, 300];
const clamp01 = (v) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.9;
const DEP_PACKAGES = {
  settings: "@deepseek-ai/dsh-settings",
  schema: "@deepseek-ai/schemastery"
};
const resolverRoots = () => {
  const roots = [];
  const push = (label, base) => {
    if (typeof base === "string" && base.length > 0) roots.push({ label, base });
  };
  push("插件自身", import.meta.url);
  push("宿主进程入口", process.argv[1]);
  push("工作目录", path.join(process.cwd(), "package.json"));
  const depsDir = process.env.DSH_DEPS_DIR;
  push("DSH_DEPS_DIR", depsDir ? path.join(depsDir, "package.json") : null);
  const dshHome = process.env.DSH_HOME || path.join(homedir(), ".dsh");
  push("DSH_HOME/profile", path.join(dshHome, "profiles", "node_modules", "package.json"));
  return roots;
};
const resolveDep = (pkg) => {
  const failures = [];
  for (const root of resolverRoots()) {
    try {
      const req = createRequire(root.base);
      return { ok: true, path: req.resolve(pkg), req, root: root.label };
    } catch (e) {
      failures.push(`${root.label}(${e && e.code ? e.code : e && e.message || e})`);
    }
  }
  return { ok: false, failures };
};
async function loadSettingsDeps() {
  const schema = resolveDep(DEP_PACKAGES.schema);
  if (!schema.ok) {
    return { ok: false, reason: `解析 DSH 运行时依赖失败：${DEP_PACKAGES.schema} ← ${schema.failures.join(" / ")}` };
  }
  const settings = resolveDep(DEP_PACKAGES.settings);
  let legacy = null;
  let legacyNote = settings.ok ? "包内无 installSettingsSection（新版导出面）" : `未解析到（${settings.failures.join(" / ")}）`;
  if (settings.ok) {
    try {
      const mod = await import(pathToFileURL(settings.path).href);
      if (typeof mod.installSettingsSection === "function" && typeof mod.settingsNamespace === "function") {
        legacy = { installSettingsSection: mod.installSettingsSection, settingsNamespace: mod.settingsNamespace };
        legacyNote = "可用";
      }
    } catch (e) {
      legacyNote = `加载失败（${e && e.message || e}）`;
    }
  }
  try {
    const zMod = await import(pathToFileURL(schema.path).href);
    return {
      ok: true,
      z: zMod.default ?? zMod,
      zSource: schema.root,
      legacy,
      legacyNote,
      source: `${settings.root || "（未解析）"} / ${schema.root}`
    };
  } catch (e) {
    const code = e && e.code ? `${e.code}: ` : "";
    return { ok: false, reason: `已解析到路径但加载失败：${code}${e && e.message || e}` };
  }
}
let cachedSchema;
function buildOmkbSchema(deps) {
  var _a;
  if (cachedSchema !== void 0) return cachedSchema;
  if (!deps || typeof ((_a = deps.z) == null ? void 0 : _a.object) !== "function") {
    cachedSchema = null;
    return cachedSchema;
  }
  const { z } = deps;
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
  });
  return cachedSchema;
}
function readHardwarePrefs(section) {
  const src = section && typeof section === "object" ? section : {};
  return {
    brightness: clamp01(src.brightness),
    autoDim: Number.isFinite(src.autoDim) ? Math.max(0, src.autoDim) : 0
  };
}
function createSettingsBridge() {
  let source = null;
  let listener = null;
  let prefsChanged = false;
  let registered = false;
  let phase = "idle";
  let failure = null;
  let depsSource = null;
  let api = null;
  let registeredVia = null;
  const hooks = {
    setSource: (fn) => {
      source = fn;
      registered = true;
    },
    onChange: () => {
      prefsChanged = true;
      if (listener) {
        try {
          listener();
        } catch (e) {
        }
      }
    }
  };
  const fail = (reason) => {
    phase = "failed";
    failure = reason;
  };
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
      if (typeof (ctx == null ? void 0 : ctx.inject) !== "function") {
        fail("宿主上下文不支持 ctx.inject，无法等待 settings 服务");
        return false;
      }
      if (phase !== "idle") return phase === "ready";
      phase = "loading";
      const wire = (sctx, loaded) => {
        if (!loaded.ok) {
          fail(loaded.reason);
          return;
        }
        const schema = buildOmkbSchema(loaded);
        if (schema === null) {
          fail("schemastery 可用但没有 z.object，schema 构建失败");
          return;
        }
        const svc = sctx && sctx.settings;
        try {
          if (svc && typeof svc.installSection === "function") {
            svc.installSection(ctx, OMKB_NAMESPACE, schema, OMKB_DEFAULTS, hooks);
            api = "ctx.settings.installSection";
            registeredVia = "service";
          } else if (loaded.legacy) {
            loaded.legacy.installSettingsSection(
              ctx,
              loaded.legacy.settingsNamespace(OMKB_NAMESPACE),
              schema,
              OMKB_DEFAULTS,
              hooks
            );
            api = "dsh-settings.installSettingsSection";
            registeredVia = "package";
          } else {
            fail(`settings 服务没有 installSection，dsh-settings 包也没有 installSettingsSection（${loaded.legacyNote}）—— 该 DSH 版本没有可用的命名空间注册入口`);
            return;
          }
          depsSource = loaded.source;
          phase = "ready";
        } catch (e) {
          fail(`设置命名空间接线失败（${api || "未识别路径"}）：${e && e.message || e}`);
        }
      };
      const deps = loadSettingsDeps();
      try {
        ctx.inject(["settings"], (sctx) => {
          deps.then(
            (loaded) => wire(sctx, loaded),
            (e) => fail(`依赖加载异常：${e && e.message || e}`)
          );
        });
      } catch (e) {
        fail(`等待 settings 服务失败：${e && e.message || e}`);
        return false;
      }
      return true;
    },
    /**
     * 运行时可观测的诊断快照（宿主把它挂到 /omkb/state，便于不重启终端就判断持久化是否在线）。
     * `api` 记的是走的哪一代接线入口 —— DSH 改名过这个 API，出问题时这行字直接指路。
     */
    diagnose: () => ({ phase, registered, depsSource, api, via: registeredVia, error: failure }),
    /** 消费一次待处理标记：有变更（或首次）时返回 true。 */
    consume: () => {
      const had = prefsChanged;
      prefsChanged = false;
      return had;
    },
    /**
     * 注册变更监听并立刻补发一次当前值。
     * @param fn - 设置值变化时的回调（无参）。
     */
    attach: (fn) => {
      listener = fn;
      listener();
    },
    /** @returns 当前 resolved 设置段（无 settings 服务时为 null）。 */
    read: () => {
      try {
        return source ? source() : null;
      } catch (e) {
        return null;
      }
    }
  };
}
const isSupportedPlatform = (platform = process.platform) => platform === "darwin";
const PRIVACY_PANE_URLS = {
  listen: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
  accessibility: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
};
const MONITOR_JXA = [
  "ObjC.import('CoreGraphics')",
  'ObjC.bindFunction("CGPreflightListenEventAccess",["bool",[]])',
  "var r={}",
  "try{r.listen=$.CGPreflightListenEventAccess()}catch(e){r.errListen=String(e)}",
  "try{ObjC.import('ApplicationServices');r.ax=$.AXIsProcessTrusted()}catch(e){r.errAx=String(e)}",
  "JSON.stringify(r)"
].join(";");
const parseMonitorOutput = (stdout) => {
  const text = String(stdout == null ? "" : stdout).trim();
  if (!text) return { granted: null, accessibility: null, detail: "查询没有返回内容" };
  let obj = null;
  const line = text.split("\n").map((s) => s.trim()).filter(Boolean).pop() || "";
  try {
    obj = JSON.parse(line);
  } catch (e) {
    return { granted: null, accessibility: null, detail: "无法解析查询结果：" + line.slice(0, 120) };
  }
  if (!obj || typeof obj !== "object") return { granted: null, accessibility: null, detail: "查询结果不是对象" };
  const asBool = (v) => v === true ? true : v === false ? false : typeof v === "number" ? v !== 0 : null;
  const granted = asBool(obj.listen);
  const accessibility = asBool(obj.ax);
  const detail = granted === null ? "查询失败：" + (obj.errListen || "CoreGraphics 未返回结果") : granted ? "系统已授权输入监控" : "系统未授权输入监控";
  return { granted, accessibility, detail };
};
const probeInputMonitor = async (opts = {}) => {
  const platform = opts.platform || process.platform;
  const supported = isSupportedPlatform(platform);
  if (!supported) {
    return { supported: false, granted: null, accessibility: null, method: "unsupported", detail: `当前系统是 ${platform}，只有 macOS 有输入监控权限` };
  }
  const spawnFn = opts.spawnFn || spawn;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 2500;
  return new Promise((resolve) => {
    var _a;
    let child = null;
    let settled = false;
    const done = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const timer = setTimeout(() => {
      try {
        if (child) child.kill();
      } catch (e) {
      }
      done({ supported: true, granted: null, accessibility: null, method: "timeout", detail: `查询超时（${timeoutMs}ms）` });
    }, timeoutMs);
    (_a = timer.unref) == null ? void 0 : _a.call(timer);
    try {
      child = spawnFn("/usr/bin/osascript", ["-l", "JavaScript", "-e", MONITOR_JXA], { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      clearTimeout(timer);
      done({ supported: true, granted: null, accessibility: null, method: "unavailable", detail: "无法执行 osascript：" + (e && e.message || e) });
      return;
    }
    let out = "";
    let err = "";
    if (child.stdout && child.stdout.on) child.stdout.on("data", (c) => {
      out += c;
    });
    if (child.stderr && child.stderr.on) child.stderr.on("data", (c) => {
      err += c;
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      done({ supported: true, granted: null, accessibility: null, method: "unavailable", detail: "osascript 启动失败：" + (e && e.message || e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) {
        done({ supported: true, granted: null, accessibility: null, method: "failed", detail: `osascript 退出码 ${code}` + (err.trim() ? "：" + err.trim().slice(0, 160) : "") });
        return;
      }
      const parsed = parseMonitorOutput(out);
      done({ supported: true, ...parsed, method: "jxa" });
    });
  });
};
const openPrivacyPane = (pane = "listen", spawnFn = spawn) => {
  const url = PRIVACY_PANE_URLS[pane] || PRIVACY_PANE_URLS.listen;
  return new Promise((resolve) => {
    try {
      const child = spawnFn("open", [url], { stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    } catch (e) {
      resolve(false);
    }
  });
};
const createMonitorProbe = (opts = {}) => {
  const ttl = Number.isFinite(opts.ttlMs) ? opts.ttlMs : 4e3;
  let cached = null;
  let at = 0;
  let inflight = null;
  return {
    /** 读一次（命缓存直接返回）。@param force - 忽略缓存强制重测。 */
    read: (force = false) => {
      const now = Date.now();
      if (!force && cached && now - at < ttl) return Promise.resolve(cached);
      if (inflight) return inflight;
      inflight = probeInputMonitor(opts).then((r) => {
        cached = r;
        at = Date.now();
        inflight = null;
        return r;
      }, (e) => {
        inflight = null;
        const r = { supported: isSupportedPlatform(opts.platform || process.platform), granted: null, accessibility: null, method: "error", detail: e && e.message || String(e) };
        cached = r;
        at = Date.now();
        return r;
      });
      return inflight;
    }
  };
};
const ARCHIVE_PATH = "/omkb/archive";
const MONITOR_PATH = "/omkb/monitor";
const PRIVACY_PATH = "/omkb/open-privacy";
const JSON_HEAD = { "content-type": "application/json; charset=utf-8" };
const PREFS_RESCAN_MS = 1e4;
const name = "dsh-omkb";
const settingsBridge = createSettingsBridge();
function apply(ctx) {
  var _a;
  const logger = ctx.logger("omkb");
  logger.info("[omkb] 蓝牙 HID 小键盘插件已加载（name=omkb, manufacturer=OM）");
  const ble = createBleReader({ logger, diagnostics: () => settingsBridge.diagnose() });
  let disposeSettings = null;
  let disposeRoute = null;
  let disposeArchive = null;
  let disposeMonitor = null;
  let disposePrivacy = null;
  ctx.on("dispose", () => {
    if (disposeSettings) {
      try {
        disposeSettings();
      } catch (e) {
      }
    }
    ble.dispose();
    if (disposeRoute) {
      try {
        disposeRoute();
      } catch (e) {
      }
    }
    if (disposeArchive) {
      try {
        disposeArchive();
      } catch (e) {
      }
    }
    if (disposeMonitor) {
      try {
        disposeMonitor();
      } catch (e) {
      }
    }
    if (disposePrivacy) {
      try {
        disposePrivacy();
      } catch (e) {
      }
    }
  });
  ble.open();
  ctx.effect(() => ctx.on("agent/error", ({ agent, error }) => {
    try {
      const id = agent && agent.id;
      if (!ble.flashError(id)) {
        logger.info(`[omkb] 会话 ${id} 运行失败，但它当前没有占键（不在侧边栏），不闪灯`);
      }
    } catch (e) {
      logger.warn("[omkb] 失败红灯下发异常:", e && e.message ? e.message : e);
    }
  }), "omkb: agent error → LED");
  if (settingsBridge.install(ctx)) {
    let lastApplied = null;
    const applyPrefs = () => {
      try {
        const prefs = readHardwarePrefs(settingsBridge.read());
        if (lastApplied && lastApplied.brightness === prefs.brightness && lastApplied.autoDim === prefs.autoDim) return;
        lastApplied = prefs;
        ble.setPrefs(prefs);
      } catch (e) {
        logger.warn("[omkb] 应用持久化偏好失败:", e && e.message ? e.message : e);
      }
    };
    settingsBridge.attach(applyPrefs);
    const rescan = setInterval(() => {
      if (settingsBridge.consume()) applyPrefs();
    }, PREFS_RESCAN_MS);
    (_a = rescan.unref) == null ? void 0 : _a.call(rescan);
    disposeSettings = () => clearInterval(rescan);
  } else {
    const why = settingsBridge.diagnose().error || "未知原因";
    logger.warn(`[omkb] 设置命名空间 ${OMKB_NAMESPACE} 未接线：${why}；设置页的改动将无法落盘`);
  }
  ctx.inject(["webServer"], (wctx) => {
    disposeRoute = ble.registerRoute(wctx.webServer);
    const monitor = createMonitorProbe();
    try {
      disposeMonitor = wctx.webServer.register({
        kind: "exact",
        path: MONITOR_PATH,
        handler: (req, res) => {
          if (req.method !== "GET" && req.method !== "POST") {
            res.writeHead(405, JSON_HEAD);
            res.end(JSON.stringify({ error: "method not allowed" }));
            return;
          }
          const force = /[?&]force=1/.test(String(req.url || ""));
          monitor.read(force).then(
            (r) => {
              res.writeHead(200, JSON_HEAD);
              res.end(JSON.stringify(r));
            },
            (e) => {
              res.writeHead(500, JSON_HEAD);
              res.end(JSON.stringify({ supported: false, granted: null, detail: e && e.message || String(e) }));
            }
          );
        }
      });
    } catch (e) {
      logger.warn("[omkb] 输入监控路由注册失败:", e && e.message ? e.message : e);
    }
    try {
      disposePrivacy = wctx.webServer.register({
        kind: "exact",
        path: PRIVACY_PATH,
        handler: (req, res) => {
          if (req.method !== "POST") {
            res.writeHead(405, JSON_HEAD);
            res.end(JSON.stringify({ error: "method not allowed" }));
            return;
          }
          let body = "";
          req.on("data", (c) => {
            body += c;
          });
          req.on("end", () => {
            let pane = "listen";
            try {
              pane = JSON.parse(body || "{}").pane || "listen";
            } catch (e) {
            }
            openPrivacyPane(pane).then((ok) => {
              res.writeHead(ok ? 200 : 500, JSON_HEAD);
              res.end(JSON.stringify({ ok }));
            });
          });
        }
      });
    } catch (e) {
      logger.warn("[omkb] 系统设置跳转路由注册失败:", e && e.message ? e.message : e);
    }
    let ws = null;
    try {
      ws = typeof wctx.get === "function" && wctx.get("workspaceRegistry") || wctx.workspaceRegistry || null;
    } catch (e) {
      ws = null;
    }
    if (ws && typeof ws.archiveSession === "function") {
      disposeArchive = wctx.webServer.register({
        kind: "exact",
        path: ARCHIVE_PATH,
        handler(req, res) {
          if (req.method !== "POST") {
            res.writeHead(405, JSON_HEAD);
            res.end(JSON.stringify({ error: "method not allowed" }));
            return;
          }
          let body = "";
          req.on("data", (c) => {
            body += c;
          });
          req.on("end", () => {
            try {
              const { sessionId } = JSON.parse(body || "{}");
              if (!sessionId) {
                res.writeHead(400, JSON_HEAD);
                res.end(JSON.stringify({ error: "missing sessionId" }));
                return;
              }
              Promise.resolve(ws.archiveSession(sessionId)).then(
                () => {
                  res.writeHead(200, JSON_HEAD);
                  res.end(JSON.stringify({ ok: true }));
                },
                (e) => {
                  res.writeHead(500, JSON_HEAD);
                  res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) }));
                }
              );
            } catch (e) {
              res.writeHead(400, JSON_HEAD);
              res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) }));
            }
          });
        }
      });
    } else {
      logger.warn("[omkb] 宿主未提供 workspaceRegistry.archiveSession，归档键不可用");
    }
  });
}
export {
  apply,
  name
};
