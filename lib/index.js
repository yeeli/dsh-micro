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
var _reportId, _channelRpc, _vendorId, _productId, _deviceName, _deviceMfr, _triggerMethod, _triggerKey, _debounceMs, _statePath, _configPath, _reconnectPath, _agentsPath, _state, _held, _logger, _last, _lineBuf, _rpcId, _dimmed, _lastActivity, _allIdle, _idleSince, _hid, _diagnostics, _dimTimer, _exitGuard, _reconnectTimer, _linkSeen, _probeTimer, _probeMs, _desiredAgents, _slotSessions, _pendingAgents, _agentsScheduled, _lastThstatus, _outcome, _errorColor, _log, _warn, _snapshot, _bump, _wake, _handleLine, _feed, _onData, _BleController_instances, parseHex_fn, _matches, _sendRpc, _markConnected, _armProbe, _requestStatus, _sendBrightness, _applyConfig, _clampRgb, _clamp01, _stOf, _inboundSt, _clampSt, _thstatusParams, _writeThstatus, _sendThstatus, _lightsOff, _renderAgents, _flushAgents, _composeAgents, _latchOutcome, _applyAgents, _autoDimCheck, _jsonHead, _readBody, _json;
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
  blackout,
  proc = globalThis.process,
  signals = EXIT_SIGNALS,
  schedule = setImmediate,
  log = null,
  exit = null
} = {}) => {
  const handlers = /* @__PURE__ */ new Map();
  let seen = 0;
  let released = false;
  let blackedOut = false;
  let exitHook = null;
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
  const blackoutOnce = () => {
    if (blackedOut) return false;
    blackedOut = true;
    try {
      if (typeof blackout === "function") blackout();
    } catch (e) {
      say(`退出前灭灯失败（忽略）：${e && e.message || e}`);
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
      blackoutOnce();
      say(seen >= 2 ? `收到 ${sig}（第 ${seen} 次），强制退出 ${exitCodeOf(sig)}` : `收到 ${sig}，宿主未接管该信号，按默认语义退出 ${exitCodeOf(sig)}`);
      return doExit(sig);
    }
    const handoff = () => {
      blackoutOnce();
      releaseOnce();
    };
    try {
      schedule(handoff);
    } catch (e) {
      handoff();
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
    if (!exitHook) {
      try {
        const h = () => {
          blackoutOnce();
        };
        proc.on("exit", h);
        exitHook = h;
      } catch (e) {
        exitHook = null;
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
    if (exitHook) {
      try {
        const off = typeof proc.off === "function" ? proc.off : proc.removeListener;
        off.call(proc, "exit", exitHook);
      } catch (e) {
      }
      exitHook = null;
    }
    return removed;
  };
  return { install, dispose, releaseOnce, blackoutOnce, isInstalled: () => handlers.size > 0, handlers };
};
const require$1 = createRequire(import.meta.url);
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
const AGENT_ST = {
  IDLE: 0,
  // 空闲 —— 会话在、没在跑
  RUNNING: 1,
  // 运行 —— agent loop 在跑
  SUCCESS: 2,
  // 成功 —— 刚跑完一轮（**宿主叠加**，见 reportSuccess）
  ERROR: 3
  // 失败 —— 跑失败了（**宿主叠加**，见 reportError，同时把灯转红）
};
const AGENT_ST_INBOUND = [AGENT_ST.IDLE, AGENT_ST.RUNNING];
const AGENT_ST_DEFAULT = AGENT_ST.IDLE;
const BLACKOUT_SLOTS = Object.freeze(
  Array.from({ length: 6 }, (_, id) => Object.freeze({ id, c: 0, b: 0, e: 0, st: AGENT_ST.IDLE }))
);
class BleController {
  // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js）
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
    __privateAdd(this, _state, { t: 0, open: false, product: null, battery: null, charging: false, brightness: 0.9, autoDim: 0, key: null, keyAct: null, down: [], agent: -1, act: null, enc: 0, encPress: 0, encLong: 0, knobPress: 0, joy: null, joyT: 0, joyPush: 0, joyDir: null, agents: [], outcomes: [], idle: null, keyT: {} });
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
    /**
     * 「**检测到设备已连接**」的判据 —— 本次链路里有没有真的收到过设备的数据。
     *
     * 为什么不能用「`open()` 成功」当判据（用户 2026-09-25 指出）：启动那一刻句柄可能开得起来
     * （设备还挂在系统里），而**蓝牙链路其实还没建立**，这时候把 `device.status` 发出去只是白发
     * 一条 —— 设备收不到，我们这边也没有任何地方会因此报错（静默白问）。
     * 唯一能证明「设备在链路上、而且在通信」的硬证据，是它自己发来的**数据帧**。
     *
     * 生命期跟着链路走：**每次 `open()` 都重置回 false**（那是「一条新链路开始」的唯一时刻），
     * 所以每次（重）连都会重新检测一次；`close()` 里也顺手清一遍（状态卫生，见那里的注释）。
     */
    __privateAdd(this, _linkSeen, false);
    /**
     * 「一句不吭」时的兜底探活定时器：句柄开着、`#probeMs` 里一帧都没收到 → 问一次。
     *
     * 为什么留着它：设备的协议用法是「被问才报」或「它自己刚连上时报」。宿主重启时若链路其实
     * 还在（旧连接），设备不会主动说话，不兜底问一次的话电池行会永远显示「—」（那是 2026-09-23
     * 专门修过的 bug）。代价只是链路真没建起来时白发一条 —— 那种情况写不出去，也不报错。
     */
    __privateAdd(this, _probeTimer, null);
    __privateAdd(this, _probeMs, 15e3);
    // 兜底延迟；DSH_OMKB_PROBE_MS 覆盖（自检脚本调小它），0 = 不兜底
    // ---------- 会话的「结果态」：运行失败（红）/ 跑完一轮（成功）----------
    // 分工：**浏览器**决定「哪个会话占哪颗键、平时是什么颜色与状态」（它才知道会话列表），
    // **宿主**决定「上一轮跑成了什么样」（它才收得到 agent/error 与 agent/turn-stopping，
    // 也是唯一写 HID 的人）。因此浏览器下发的槽位里带上会话 id（sid），宿主用它把事件定位到键。
    __privateAdd(this, _desiredAgents, []);
    // 浏览器下发的期望灯态（设备字段 + 会话 id 元数据）
    __privateAdd(this, _slotSessions, []);
    // 槽位下标 → 会话 id
    /**
     * 「同拍合并」的两个暂存位（见 #renderAgents）。
     *
     *   `#pendingAgents`   —— 算好但还没写出去的那一份参数（null = 没东西待写）
     *   `#agentsScheduled` —— 当前这一拍是否已经排过写入（排过就只覆盖内容，不再排第二次）
     *
     * 为什么要有它（用户 2026-09-25 要求：**会话信息返回给键盘设备时，一次不许发多条**）：
     * 同一个事件循环拍里会有好几个来源都要重画灯态 —— 宿主的 `agent/error` 与 `agent/status`
     * 常常连着来、浏览器 POST /omkb/agents 里 `allIdle` 翻转时还会顺手 `#wake()`。
     * 逐条写出去就是**设备一口气收到好几条 `v.oai.thstatus`**（每条还要切成 5 帧 63 字节的
     * HID 报告）。攒成一条再发，设备收到的永远是「此刻应该是什么样」。
     */
    __privateAdd(this, _pendingAgents, null);
    __privateAdd(this, _agentsScheduled, false);
    /**
     * 上一次**真正写出去**的那条 `v.oai.thstatus` 长什么样（JSON 字符串，用来比对内容）。
     *
     * 为什么同拍合并还不够（用户 2026-09-25：「thstatus 还是会发送两条」）：`#pendingAgents`
     * 只管**同一个事件循环拍**，而真实时序里同一份灯态会**跨拍**被推两次 —— 宿主的结论
     * （`agent/error`）与浏览器那一份快照相隔一拍到达（浏览器带 350ms 防抖，快照里往往还写着
     * 运行中，可宿主把结果态叠上去之后算出来的**内容完全一样**），或者浏览器自己连着推两遍。
     * 两条一模一样，设备没必要听两遍。
     *
     * 只在**写成功之后**更新（没句柄 / 写失败时不动，下次同内容仍会尝试）；
     * `close()` 清空 —— 「链路断了」是唯一必须忘掉「上次发过什么」的时刻（重连要重放）。
     */
    __privateAdd(this, _lastThstatus, null);
    /**
     * 槽位下标 → { sid, kind }，**结果态**（kind: 'error' | 'success'）。
     *
     * ⚠ **它不会自己过期**（2026-09-25 用户要求：「错误后不变白」）。原来的实现是 3 秒窗口，
     * 到点自动回到浏览器下发的常态；现在一直挂着，直到下面三件事之一发生：
     *   1. 该会话**重新开始运行** → 用户重试了，`clearOutcome()`（宿主 agent/status=running 驱动）；
     *   2. 该会话从槽位上消失（归档 / 关掉 / 被别的会话顶掉，见 #applyAgents 的整表重建）；
     *   3. 同一颗键上来了**更新的结论**（又失败一次 / 这回跑成功了，后写覆盖先写）。
     *
     * 「到点自动消失」这件事**不能靠浏览器重新下发来替代**：失败那一刻浏览器快照里这个会话
     * 常常还写着 running（它的推送还带 350ms 防抖），拿浏览器下发的 st 当清除判据，红灯会在
     * 亮起的同一瞬间被自己的陈旧快照抹掉。清除只认宿主的 agent/status（见 #applyAgents 的注释）。
     *
     * 两种表现：
     *   'error'   —— 状态码 st=3，**并且**把颜色换成红灯（用户可见的「上次失败了」）
     *   'success' —— 状态码 st=2，颜色不动（跑完了是正常态，不该抢眼的颜色）
     */
    __privateAdd(this, _outcome, /* @__PURE__ */ new Map());
    __privateAdd(this, _errorColor, 16711680);
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
      if (!__privateGet(this, _linkSeen)) __privateGet(this, _markConnected).call(this);
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
        __privateSet(this, _linkSeen, false);
        __privateGet(this, _armProbe).call(this);
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
      __privateSet(this, _linkSeen, false);
      if (__privateGet(this, _probeTimer)) {
        clearTimeout(__privateGet(this, _probeTimer));
        __privateSet(this, _probeTimer, null);
      }
      __privateSet(this, _pendingAgents, null);
      __privateSet(this, _lastThstatus, null);
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
    // ---------- 「设备已连接」的检测 ⇒ 才去问电量 ----------
    /**
     * 检测到设备已连接时：停掉兜底、必要时问一次电量。
     *
     * 由 `#onData` 在收到**第一帧**时调用，而且必须排在**解析之前** —— 「设备在链路上说话」这件事
     * 只要有一帧就能证明，哪怕这一帧认不出来（调错通道、固件换了字段、JSON 截断）。
     * 把这个判据往后挪（等解析成功）等于给「已连接」加了一道会失败的前置条件：漏判的代价是整个
     * 功能静默失效（电池行永远「—」），而它的收益只是省掉一条请求。
     * 代价如实写在这里：**设备自己刚连上时推的那条 `device.status` 也会触发我们问一次**（因为
     * 判连接在解析之前，那时 `battery` 还是 null）。一次多余的查询，换来判据不吃解析的成败。
     *
     * 「手上已经有读数就不再问」这条留给**兜底路径**（见 #armProbe 与它的守卫）。
     */
    __privateAdd(this, _markConnected, () => {
      __privateSet(this, _linkSeen, true);
      if (__privateGet(this, _probeTimer)) {
        clearTimeout(__privateGet(this, _probeTimer));
        __privateSet(this, _probeTimer, null);
      }
      __privateGet(this, _log).call(this, "检测到设备已连接（收到第一帧数据）");
      if (__privateGet(this, _state).battery === null) __privateGet(this, _requestStatus).call(this);
    });
    /**
     * 武装「一句不吭」的兜底探活：`#probeMs` 内一帧都没收到，才主动问一次电量。
     *
     * 只在 open() 成功后武装一次，设备一开口（#markConnected）或链路一断（close）就撤掉。
     * 它**不是**「连上就问」：它要等满了整个窗口，且期间设备一声不响 —— 那才是「链路可能还活着、
     * 但设备不会自己说话」的那种旧连接（宿主重启）。
     */
    __privateAdd(this, _armProbe, () => {
      var _a, _b;
      if (__privateGet(this, _probeTimer)) {
        clearTimeout(__privateGet(this, _probeTimer));
        __privateSet(this, _probeTimer, null);
      }
      if (!(__privateGet(this, _probeMs) > 0)) return;
      __privateSet(this, _probeTimer, setTimeout(() => {
        __privateSet(this, _probeTimer, null);
        if (!__privateGet(this, _hid) || !__privateGet(this, _state).open || __privateGet(this, _linkSeen)) return;
        __privateGet(this, _log).call(this, `打开句柄后 ${__privateGet(this, _probeMs)}ms 没收到设备的任何数据 → 兜底问一次电量`);
        __privateGet(this, _requestStatus).call(this);
      }, __privateGet(this, _probeMs)));
      (_b = (_a = __privateGet(this, _probeTimer)).unref) == null ? void 0 : _b.call(_a);
    });
    /**
     * 向设备要一次状态（电量 / 是不是在充电）。
     *
     * 协议用法（用户 2026-09-23 给的）：**发一条 `device.status`，设备就会上报** `battery`（电量）
     * 与 `is_charging`（是否在充电）。设备自己不会定时推，所以想拿到读数就得问一次。
     *
     * ⚠ 调用时机由**「检测到设备已连接」**决定，不是 open() 那一刻（用户 2026-09-25 改的口径）：
     *   · 正常路径 —— 收到设备的第一帧（#markConnected，且手上还没读数）；
     *   · 兜底路径 —— 句柄开着但 `#probeMs` 内一声不吭（#armProbe）。
     * 启动那一刻蓝牙链路往往还没建立，那时候问就是白发一条（设备收不到、也没人会报错）。
     * params 给空对象 —— 这是「把你的状态告诉我」的查询，不带参数。
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
    /**
     * 状态码的白名单校验：**必须是整数**且在 allowed 里，否则回落到 IDLE。
     *
     * 为什么要判类型而不是只 `Number()` 一下：`Number(true) === 1`、`Number('1') === 1` ——
     * 只做数值转换的话，浏览器塞个 `true` 就能伪装成「运行中」。设备拿这个数直接分支，
     * 所以校验必须严于「能转成数字」。
     */
    __privateAdd(this, _stOf, (v, allowed) => typeof v === "number" && Number.isInteger(v) && allowed.includes(v) ? v : AGENT_ST_DEFAULT);
    /** 浏览器报上来的状态码：只接受 IDLE/RUNNING（见 AGENT_ST_INBOUND）。 */
    __privateAdd(this, _inboundSt, (v) => __privateGet(this, _stOf).call(this, v, AGENT_ST_INBOUND));
    /** 真正下发到设备前的兜底（此时才允许宿主叠加的 SUCCESS/ERROR）。 */
    __privateAdd(this, _clampSt, (v) => __privateGet(this, _stOf).call(this, v, Object.values(AGENT_ST)));
    // Agent 键 LED：把 6 个槽位的状态一次性写回（v.oai.thstatus）
    // 这里是设备协议的**唯一出口**：未知字段（浏览器的 sid、错误类型等）不会被带下去。
    //
    // 每个槽位恰好 5 个字段：id / c / b / e / st。
    // 曾经还发过 s / sk / sa —— 它们**从头到尾恒为 0**（没有任何一行代码给过别的值），
    // 2026-09-25 按用户要求删掉。要加新字段，先答得出「谁产出它、谁消费它」。
    //
    // 自动调暗期间一律把 e/b 压成 0：调暗是「灯全灭」，而浏览器仍会照常推送灯态
    // （设置页打开、会话列表变化都会触发），不压的话下一次推送就把灯又点亮了。
    // st **不压**：它是语义而不是光学量，压成「空闲」会让设备以为会话跑完了。
    /**
     * 一组槽位 → 真正写给设备的参数（白名单 5 字段 + 取值范围收敛 + 调暗压灭）。
     * **不改变任何状态、不碰设备** —— 什么时候把它交出去由调用方决定。
     */
    __privateAdd(this, _thstatusParams, (slots) => {
      const dimmed = __privateGet(this, _dimmed);
      return slots.slice(0, 6).map((s, i) => ({
        id: i,
        c: __privateGet(this, _clampRgb).call(this, s && s.c),
        b: dimmed ? 0 : __privateGet(this, _clamp01).call(this, s && s.b, 0),
        e: dimmed ? 0 : Math.round(Number(s && s.e) || 0),
        st: __privateGet(this, _clampSt).call(this, s && s.st)
      }));
    });
    /**
     * 写一条 `v.oai.thstatus` —— **唯一的落笔点**（`#sendThstatus` 与 `#flushAgents` 都走它）。
     *
     * 内容与**上一次真正写出去的**完全一致时直接跳过，并记一行日志。
     * 比对的是**规范化之后**的参数，所以「先失败、随后浏览器补一份陈旧快照」这种重复也认得出来
     * —— 它算出来的红灯与宿主刚写出去的逐字节相同（见 `#lastThstatus` 的注释）。
     * @returns {boolean} 是否真的写了（内容没变时为 false，这不是错误）。
     */
    __privateAdd(this, _writeThstatus, (params) => {
      const key = JSON.stringify(params);
      if (key === __privateGet(this, _lastThstatus)) {
        __privateGet(this, _log).call(this, "灯态与上次写出去的完全相同 → 跳过重复写回");
        return false;
      }
      const ok = __privateGet(this, _sendRpc).call(this, "v.oai.thstatus", params);
      if (ok) __privateSet(this, _lastThstatus, key);
      return ok;
    });
    /**
     * **立刻**把一组槽位写给设备（规范化 + 记诊断 + 写）。
     *
     * 只有「进程要走了」那条线该用它（`#lightsOff` 灭灯），因为那条路**必须同步**：
     *   · `dispose()` 的灭灯要排在 `close()` 之前，早一步句柄就没了；
     *   · 安全网的 `'exit'` 钩子跑在 process 退出回调里，**微任务根本不会被执行**。
     * 会话灯态走 `#renderAgents()`（同拍合并 + 内容去重），**不要**拿这个函数去写常态灯。
     *
     * 它也过内容去重（见 `#writeThstatus`）：连续两次灭灯只会写出去一条 —— 「全灭」本来就已经
     * 是设备此刻的样子。
     * @returns {boolean} 是否真的写给了设备（内容与上次相同 → false）。
     */
    __privateAdd(this, _sendThstatus, (slots) => {
      if (!Array.isArray(slots)) return false;
      const params = __privateGet(this, _thstatusParams).call(this, slots);
      __privateGet(this, _state).agents = params;
      return __privateGet(this, _writeThstatus).call(this, params);
    });
    /**
     * 把灯**全部**关掉 —— 两组灯各一条指令，缺一不可。
     *
     * 为什么要主动关：灯效是**设备自己记着**的状态，BLE 链路断开并不会让它熄灭。设备会一直
     * 保持最后收到的那个画面（Agent 键亮着、氛围灯亮着），看起来就像「app 都关了，键盘还亮着」。
     *
     * 两条指令覆盖两组互不相干的灯：
     *   · `v.oai.rgbcfg` 全 0  —— 普通键背光 + 外周氛围灯；
     *   · `v.oai.thstatus` 全 0 —— Agent 键那圈灯（它**不走** rgbcfg）。
     * 只关一组就是「亮着一半」，用户照样看得出没关干净。
     *
     * **只在「进程要走了」这条线上调用，绝不在 close() 里**：断开是随时会发生的（掉线 /
     * 点「重连」/ 宿主重扫设备），在那儿关灯只会让「重连之后黑一片」（用户明确要求做出这个区别）。
     * 两个落点 ——
     *   · `dispose()`：插件卸载（宿主优雅关闭 / 重载）；
     *   · **退出安全网**（exit-guard）：Ctrl+C / SIGTERM / SIGHUP 这类进程级退出，
     *     宿主未必来得及走到 `dispose()`（见 ./exit-guard.js 顶部「退出前必须灭灯」）。
     *
     * 幂等：重复调用只是把同一份「全灭」再写一遍，弄不坏任何状态（插件可能被卸载两次、
     * 安全网也可能在 exit 钩子上再调一次）。
     *
     * 它会让 `state.agents` 也变成全 0（`#sendThstatus` 的正常副作用）：这正是设备此刻
     * 真实的样子，也是 /omkb/state 该报的事实。**期望灯态 `#desiredAgents` 一个字节都不动**。
     * @returns {boolean} 两条指令是否真的写出去了（没连上、或内容与上次完全相同被跳过时 false）。
     */
    __privateAdd(this, _lightsOff, () => {
      const dim = __privateGet(this, _sendBrightness).call(this, 0);
      const dark = __privateGet(this, _sendThstatus).call(this, BLACKOUT_SLOTS);
      return dim && dark;
    });
    /**
     * 灭灯的唯一对外落点（`#lightsOff` 的公开包装，自带「没连着就什么都不做」的守卫）。
     *
     * 故意写成**公有类字段**（和 `close` 同一套路）：自检脚本可以把它整个换成打印或计数器，
     * 以此观测「退出路径到底有没有灭灯」（见 test/lib/exit-guard-child.mjs）——
     * 而 `#lightsOff` 是私有的，从外面换不掉。
     * @returns {boolean} 是否真的写给设备了。
     */
    __publicField(this, "blackout", () => {
      if (!__privateGet(this, _hid) || !__privateGet(this, _state).open) return false;
      return __privateGet(this, _lightsOff).call(this);
    });
    // ---------- 期望灯态 + 结果态 ⇒ 实际灯态 ----------
    // 会话灯态的**唯一出口**：把浏览器下发的期望灯态与「上一轮跑出结论的那几颗键」叠加后写 HID。
    // 这样浏览器在任何时刻重新下发灯态（会话列表变化、切设置页都会触发）都不会把结果态
    // 冲掉——收不收只由宿主说了算（见 #latchOutcome 与 #applyAgents）。
    //
    // ⚠ **同拍合并**（用户 2026-09-25）：这里**不直接写设备**，只把「此刻应该是什么样」算出来存进
    // `#pendingAgents`，真正的写入排到当前这一拍的末尾（微任务）。同一拍里再被调用多少次都只是
    // 覆盖那一份内容 —— 设备因此只会收到**一条** `v.oai.thstatus`。谁后到谁赢，因为它们算的都是
    // 同一个问题的答案：此刻应该是什么样。
    //
    // 光有这一层还不够（用户当天实测「thstatus 还是会发送两条」）：它只管**同一拍**，而同一份
    // 灯态常**跨拍**被推两次（宿主结论与浏览器那份带 350ms 防抖的快照错开到达，内容一模一样）。
    // 那一半由 `#writeThstatus` 的**内容去重**兜住 —— 两条防线各管一段，缺一不可。
    //
    // 诊断字段（`#state.agents` / `#state.outcomes`）留在**同步**这一半更新：读它的人
    // （GET /omkb/state、自检）不该被一个微任务的时序影响。
    //
    // 反过来，**灭灯不走这里**（见 #sendThstatus 的注释）：退出路径必须同步写出去。
    __privateAdd(this, _renderAgents, () => {
      if (!__privateGet(this, _desiredAgents).length) return false;
      const params = __privateGet(this, _thstatusParams).call(this, __privateGet(this, _composeAgents).call(this));
      __privateGet(this, _state).agents = params;
      __privateGet(this, _state).outcomes = [...__privateGet(this, _outcome)].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }));
      __privateSet(this, _pendingAgents, params);
      if (!__privateGet(this, _agentsScheduled)) {
        __privateSet(this, _agentsScheduled, true);
        queueMicrotask(__privateGet(this, _flushAgents));
      }
      return true;
    });
    /**
     * 把当前这一拍攒下的那一份灯态写出去（**最多一条**，且内容与上次相同就跳过）。
     *
     * 断开时 `close()` 会把 `#pendingAgents` 清掉：链路都没了还补写一条，除了多一行
     * 「设备未连接，忽略写回」的 warn 之外毫无意义；重连时 `open()` 会重新 `#renderAgents()`
     * 把灯态重放出来，不会漏（`close()` 也顺手忘了「上次发过什么」，见 `#lastThstatus`）。
     * @returns {boolean} 这一拍是否真的往设备写了一条（无待写 / 内容没变时为 false）。
     */
    __privateAdd(this, _flushAgents, () => {
      __privateSet(this, _agentsScheduled, false);
      const params = __privateGet(this, _pendingAgents);
      __privateSet(this, _pendingAgents, null);
      if (!params) return false;
      return __privateGet(this, _writeThstatus).call(this, params);
    });
    /**
     * 期望灯态 + 结果态 → 6 个槽位（设备字段形态）。不改变状态、不碰设备。
     *
     * 结果态只认「此刻占着这个槽位的那个会话」：会话消失 / 换人时宁可少亮一盏，也不要把
     * 别人上一轮的失败挂到新来的会话身上（`#applyAgents` 已经整表重建过，这里是出口兜底）。
     */
    __privateAdd(this, _composeAgents, () => __privateGet(this, _desiredAgents).map((s, i) => {
      const out = __privateGet(this, _outcome).get(i);
      const mine = out && __privateGet(this, _slotSessions)[i] === out.sid ? out : null;
      const red = !!mine && mine.kind === "error";
      return {
        id: i,
        // 失败压过一切；成功只是「状态码是 2」，颜色仍按浏览器给的那份。
        st: red ? AGENT_ST.ERROR : mine ? AGENT_ST.SUCCESS : s.st,
        c: red ? __privateGet(this, _errorColor) : s.c,
        b: s.b,
        e: s.e
      };
    }));
    /**
     * 某个会话这一轮跑出了结论 → 让它占的那几颗键**保持**这个结果态，直到该会话重新运行
     * （见 clearOutcome）。
     * @param sessionId - 会话 id（DSH 里 agent.id 就是会话 id）。
     * @param kind - 'error'（运行失败，**顺带把灯换成红灯**）| 'success'（正常跑完一轮，只改状态码）。
     * @returns {boolean} 是否真的命中了某个键（该会话没占键时为 false，不算异常）。
     */
    __privateAdd(this, _latchOutcome, (sessionId, kind) => {
      if (typeof sessionId !== "string" || !sessionId) return false;
      const bad = kind === "error";
      const slots = [];
      for (let i = 0; i < __privateGet(this, _slotSessions).length; i++) if (__privateGet(this, _slotSessions)[i] === sessionId) slots.push(i);
      if (slots.length === 0) return false;
      for (const slot of slots) __privateGet(this, _outcome).set(slot, { sid: sessionId, kind });
      __privateGet(this, _renderAgents).call(this);
      __privateGet(this, _log).call(this, bad ? `会话运行失败 → 槽位 ${slots.join(",")} 转红灯（保持到该会话重新运行）` : `会话跑完一轮 → 槽位 ${slots.join(",")} 报成功（保持到该会话重新运行）`);
      return true;
    });
    /**
     * 某个会话运行失败 → 让它的那颗键**一直红着**（状态码同时变 3），不再自己变回白色。
     *
     * 由宿主的 `agent/error` 事件驱动（见 src/core/index.js）。注意这个事件**只在真正的失败**
     * 时发出：用户主动中断走的是另一条分支，不会转红。
     * 收掉它的唯一常规途径是「该会话重新开始运行」（clearOutcome）。
     */
    __publicField(this, "reportError", (sessionId) => __privateGet(this, _latchOutcome).call(this, sessionId, "error"));
    /**
     * 某个会话**正常跑完一轮** → 让它那颗键一直报 st=2（成功），颜色不动。
     *
     * 由宿主的 `agent/turn-stopping` 驱动：那是「这一轮要收尾了」的钩子，用户中断
     * （signal.aborted）与真失败（agent/error）都在它之前就 throw 掉了，走不到这一步 ——
     * 所以它天然就是「成功」的信号，不需要再去比对什么 reason。
     */
    __publicField(this, "reportSuccess", (sessionId) => __privateGet(this, _latchOutcome).call(this, sessionId, "success"));
    /**
     * 某个会话**重新开始运行** → 收掉它的结果态（红 / 成功），回到浏览器下发的常态（蓝）。
     *
     * 这是结果态唯一会「自己走掉」的途径，由宿主的 `agent/status`（status === 'running'）驱动：
     * 那是 agent loop 的相位变化，用户重试 = 新一轮 = 相位从 idle 变 running。
     *
     * 为什么**不**拿浏览器下发的 `st=1` 当清除判据：浏览器那份快照带 350ms 防抖，失败发生的
     * 那一刻它手里往往还写着「这个会话在跑」，把它当成「用户重试了」会让红灯刚亮就被抹掉
     * ——那正是这次要修的病（见 #outcome 的注释）。
     * @param sessionId - 会话 id。
     * @returns {boolean} 是否真的收掉了某个结果态（本来就没挂时为 false）。
     */
    __publicField(this, "clearOutcome", (sessionId) => {
      if (typeof sessionId !== "string" || !sessionId) return false;
      let hit = false;
      for (const [slot, t] of [...__privateGet(this, _outcome)]) {
        if (t.sid !== sessionId) continue;
        __privateGet(this, _outcome).delete(slot);
        hit = true;
      }
      if (!hit) return false;
      __privateGet(this, _renderAgents).call(this);
      __privateGet(this, _log).call(this, `会话 ${sessionId} 重新开始运行 → 收掉结果灯`);
      return true;
    });
    // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,sid}...], errorColor } 或纯数组）
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
          st: __privateGet(this, _inboundSt).call(this, s.st),
          c: __privateGet(this, _clampRgb).call(this, s.c),
          b: __privateGet(this, _clamp01).call(this, s.b, 0),
          e: Math.round(Number(s.e) || 0)
        });
        sessions.push(typeof s.sid === "string" && s.sid ? s.sid : null);
      }
      __privateSet(this, _desiredAgents, desired);
      __privateSet(this, _slotSessions, sessions);
      const next = /* @__PURE__ */ new Map();
      for (const [, t] of __privateGet(this, _outcome)) {
        const at = sessions.indexOf(t.sid);
        if (at !== -1 && !next.has(at)) next.set(at, t);
      }
      __privateSet(this, _outcome, next);
      __privateGet(this, _renderAgents).call(this);
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
      if (__privateGet(this, _reconnectTimer)) {
        clearInterval(__privateGet(this, _reconnectTimer));
        __privateSet(this, _reconnectTimer, null);
      }
      if (__privateGet(this, _probeTimer)) {
        clearTimeout(__privateGet(this, _probeTimer));
        __privateSet(this, _probeTimer, null);
      }
      this.blackout();
      (_a = __privateGet(this, _exitGuard)) == null ? void 0 : _a.dispose();
      this.close();
    });
    __privateSet(this, _logger, logger);
    __privateSet(this, _diagnostics, typeof diagnostics === "function" ? diagnostics : null);
    const probe = Number(process.env.DSH_OMKB_PROBE_MS);
    if (Number.isFinite(probe) && probe >= 0) __privateSet(this, _probeMs, probe);
    __privateSet(this, _dimTimer, setInterval(() => __privateGet(this, _autoDimCheck).call(this), 1e3));
    __privateGet(this, _dimTimer).unref();
    __privateSet(this, _exitGuard, createExitGuard({
      release: () => this.close(),
      blackout: () => this.blackout(),
      log: (m) => __privateGet(this, _warn).call(this, m)
    }));
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
_linkSeen = new WeakMap();
_probeTimer = new WeakMap();
_probeMs = new WeakMap();
_desiredAgents = new WeakMap();
_slotSessions = new WeakMap();
_pendingAgents = new WeakMap();
_agentsScheduled = new WeakMap();
_lastThstatus = new WeakMap();
_outcome = new WeakMap();
_errorColor = new WeakMap();
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
_markConnected = new WeakMap();
_armProbe = new WeakMap();
_requestStatus = new WeakMap();
_sendBrightness = new WeakMap();
_applyConfig = new WeakMap();
_clampRgb = new WeakMap();
_clamp01 = new WeakMap();
_stOf = new WeakMap();
_inboundSt = new WeakMap();
_clampSt = new WeakMap();
_thstatusParams = new WeakMap();
_writeThstatus = new WeakMap();
_sendThstatus = new WeakMap();
_lightsOff = new WeakMap();
_renderAgents = new WeakMap();
_flushAgents = new WeakMap();
_composeAgents = new WeakMap();
_latchOutcome = new WeakMap();
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
    reportError: ctl.reportError,
    reportSuccess: ctl.reportSuccess,
    clearOutcome: ctl.clearOutcome,
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
    console.log("dispose");
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
      if (!ble.reportError(id)) {
        logger.info(`[omkb] 会话 ${id} 运行失败，但它当前没有占键（不在侧边栏），不亮灯`);
      }
    } catch (e) {
      logger.warn("[omkb] 失败红灯下发异常:", e && e.message ? e.message : e);
    }
  }), "omkb: agent error → LED");
  ctx.effect(() => ctx.on("agent/turn-stopping", ({ agent }) => {
    try {
      ble.reportSuccess(agent && agent.id);
    } catch (e) {
      logger.warn("[omkb] 成功状态下发异常:", e && e.message ? e.message : e);
    }
  }), "omkb: agent turn done → LED status");
  ctx.effect(() => ctx.on("agent/status", ({ agent, status }) => {
    try {
      if (status !== "running") return;
      const id = agent && agent.id;
      if (ble.clearOutcome(id)) logger.info(`[omkb] 会话 ${id} 重新开始运行 → 收掉结果灯（红/成功）`);
    } catch (e) {
      logger.warn("[omkb] 结果灯收尾异常:", e && e.message ? e.message : e);
    }
  }), "omkb: agent running → clear outcome LED");
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
