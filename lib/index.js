import { createRequire } from 'node:module';
import fs from 'node:fs';
import os, { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

// dsh-omkb · core/joystick.js
// 摇杆（joystick）解析：设备通过 RPC `v.oai.rad` 上报摇杆状态，
//   参数形如 { a: 0.90, d: 1.0 }（字段可位于顶层或 params），
//   a = 角度（0..1，归一化到 0..360°，其中 0 为"右"），d = 推力/位移（0..1，≈0 视为回中）。
// 依据角度 a 计算四方向（顺时针）：上 270° / 右 0° / 下 90° / 左 180°（各取 ±45° 扇区）。
// 返回 { a, d, dir }；非 v.oai.rad 消息、或 d 低于推力阈值（回中/未推动）时返回 null。
const JOYSTICK_METHOD = 'v.oai.rad';
const PUSH_THRESHOLD = 0.35;

function parseJoystick(msg) {
  if (!msg || msg.method !== JOYSTICK_METHOD) return null
  const p = (msg && msg.params) && typeof msg.params === 'object' ? msg.params : {};
  const aRaw = msg.a != null ? msg.a : p.a;
  const dRaw = msg.d != null ? msg.d : p.d;
  if (aRaw == null) return null
  const a = Number(aRaw);
  const d = dRaw == null ? 1 : Number(dRaw);
  if (!Number.isFinite(a)) return null
  // 推力不足视作回中（没有明确推进方向）
  if (!(d >= PUSH_THRESHOLD)) return { a, d, dir: null }
  // a ∈ [0,1] → 角度 [0°,360°)；右为 0°（顺时针：右0/下90/左180/上270）
  let deg = (a - Math.floor(a)) * 360;
  let dir;
  if (deg >= 315 || deg < 45) dir = 'right';
  else if (deg < 135) dir = 'down';
  else if (deg < 225) dir = 'left';
  else dir = 'up';
  return { a, d, dir }
}

// dsh-omkb · 宿主侧「进程退出安全网」
//
// ── 它解决什么问题 ──────────────────────────────────────────────────────────
// node-hid 打开的设备会**持有事件循环引用**（内部 TSFN）。设备不关，宿主那条
// 「停服务 → 清理插件 → 等事件循环排空 → 退出」的优雅退出路径就永远等不到空循环，
// 于是进程挂在那儿：终端不回到提示符、Ctrl+C 也没反应。
//
// 最容易复现的场合正是「宿主启动失败」：宿主还没走到插件清理那一步（apply() 里那份
// dispose 通道可能压根没建立），设备句柄留在我们手里，用户看到的就是
// 「整个 dsh 卡死、杀不掉」。所以本模块存在的意义是：**任何情况下，Ctrl+C 都得有用。**
//
// ── 为什么不能像以前那样写（2026-09-23 这次改动的由来）─────────────────────
// 旧实现在构造函数里 `process.on(sig)` 接管 SIGINT/SIGTERM/SIGHUP，处理函数里同步
// `close()` 设备，再 `process.kill(process.pid, sig)` 把信号重发一遍。三个坑：
//
//   1. **同步 close() 是原生调用**（IOKit），设备异常时它可能阻塞。信号回调一旦卡在
//      原生调用里，主线程就再也处理不了任何信号 —— 后面每一次 Ctrl+C 都石沉大海。
//      这正是「卡死、无法被杀死」最直接的来源：我们自己在信号处理里堵住了自己。
//   2. **重发信号会再打到自己**：`process.kill(process.pid, sig)` 会让本处理函数再被
//      调用一次，于是「用户第二次按 Ctrl+C」和「我们自己的重发」在代码里长得一模一样，
//      无法区分，也就没法实现「再按一次就强制退出」。
//   3. **装机即接管，且永不放手**：构造函数里就注册，宿主自己的退出逻辑被顶掉 ——
//      而「怎么退」本来就该由宿主决定。
//
// ── 现在的语义（全部可单测：进程对象与退出函数都可注入）─────────────────────
//   * **只在真的打开了设备之后才装**（ble.js 在 open() 成功后才 install）：手上没有
//     资源就完全不碰进程信号。启动失败且没设备 = 零干预，与没装本插件表现一致。
//   * 收到信号时**当场看这个信号还有没有别的监听者**，而不是安装时判断 —— 宿主的
//     信号接线可能晚于插件加载：
//       - 还有别的监听者（宿主在管）→ 只把自己握着的资源**下一拍异步**放掉（帮宿主把
//         事件循环排空），退出交给宿主，我们自己不 exit；
//       - 只有我们 → 按 Node 默认语义自己退：`exit(128 + signum)`。**这条路不跑释放**：
//         process.exit 之后由操作系统回收句柄，为了「关得干净」去跑一个可能阻塞的原生
//         调用，恰恰是旧实现卡死的原因。**但灭灯要跑**（见下一节）。
//   * **用户再按一次**（第二次派发）→ 无条件强制退出：宿主卡在自己的优雅退出里也逃得掉。
//   * 「别的监听者」会把**其它 exit-guard 实例**排除掉：宿主把插件 apply 两次时，两个
//     安全网不能互相把对方当宿主而彼此礼让 —— 那会导致谁也退不掉（见自检【6】）。
//
// ── 退出前必须灭灯（2026-09-25 用户报障补上）────────────────────────────────
// 灯效是**设备自己记着**的：进程一走、BLE 链路断开，设备也不会自己熄灭 —— 它会一直亮着
// 最后收到的那幅画面（Agent 键亮着、氛围灯亮着）。所以「进程要走了」这件事必须转达给
// 设备（两条写：rgbcfg 全 0 + thstatus 全灭，见 ble.js 的 #lightsOff）。三个必须覆盖的点：
//   1. **exit 分支**：我们拥有退出权时，`doExit()` 之前先灭灯。这条路**仍然不释放**
//      （同步 close 是原生调用、可能阻塞，见上面第 1 条），但灭灯不是释放 —— 它是两条很小
//      的写，而且没有别人能替我们做（操作系统会回收句柄，但不会替设备关灯）。
//   2. **handover 分支**：灭灯必须排在释放**之前**。释放会关掉句柄，之后谁都写不出去；而
//      宿主自己的优雅退出是**异步**的，它跑到插件 dispose 时句柄已经被我们关掉了 ——
//      于是 dispose 里那句灭灯被 `state.open` 守卫挡下，灯就一直亮着。**用户报的
//      「Ctrl+C 之后设备灯还亮着」正是这条**（一个纯粹的排序 bug）。
//   3. **proc.on('exit') 兜底**：宿主自己的信号处理可能先跑、并且直接 `process.exit()`，
//      我们的信号回调压根不执行 —— 这时唯一还来得及的地方就是 `'exit'` 钩子
//      （`process.exit()` 一定会触发它，而 HID 写是同步的）。装上安全网时一起挂，卸下时一起摘。
// 反过来，**灭灯绝不能被塞进 close()**：断开是随时会发生的（掉线 / 点重连 / 重扫设备），
// 在那儿关灯只会换来「重连之后黑一片」。灭灯的落点只有两个：「进程要走了」（本模块）与
// 「插件卸载了」（ble.dispose()）。
//
// 明确不负责的：如果连 `kill -9` 都不死，说明主线程被不可中断的原生调用占住了，
// 那不是插件能解决的范围（只能靠别的手段，见技能里的排查清单）。`kill -9` 同样**灭不了灯**
// （进程被内核直接干掉，任何钩子都跑不到）。

/** 信号 → 编号（退出码 = 128 + 编号，与 shell 的约定一致）。 */
const SIGNUM = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };

/** 我们关心的退出信号。SIGHUP 也收：关终端窗口时 macOS 发的是它。 */
const EXIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/**
 * 信号对应的退出码（128 + n）。未知信号退化为 1，绝不返回 undefined。
 * @param sig - 信号名。
 * @returns {number}
 */
const exitCodeOf = (sig) => 128 + (SIGNUM[sig] || 0);

/**
 * 收到信号后的决策 —— 本模块唯一的判据，纯函数。
 *   'exit'     我们自己退（没人管这个信号，或用户已经按了不止一次）
 *   'handover' 只释放资源，退出交给宿主
 * @param {{seen: number, others: number}} args - seen = 收到信号的次数（只算外部派发）；
 *   others = 除本安全网之外，这个信号还有几个监听者。
 * @returns {'exit'|'handover'}
 */
const exitPlan = ({ seen, others }) => (seen >= 2 || others === 0 ? 'exit' : 'handover');

/**
 * 所有由本模块注册的处理函数。用来把「我们自己的监听者」从 others 里剔除：
 * 一个进程里可能存在多个安全网实例（插件被 apply 多次），它们之间不能互相礼让。
 * 用 WeakSet 而不是数组：实例被回收后不需要清理。
 */
const GUARD_LISTENERS = new WeakSet();

/**
 * 建一个退出安全网。
 * @param {object} [options] - 全部可注入，便于自检用假进程验证。
 * @param {Function} [options.release] - 释放自己握着的资源（这里是 ble.close()）。**必须幂等**。
 * @param {Function} [options.blackout] - 「进程要走了，把设备灯关掉」（这里是 ble 的灭灯）。**必须幂等、绝不抛**；
 *   三条路都会调它（exit 分支 / handover 的下一拍 / `proc.on('exit')`），
 *   本模块保证**整个进程生命周期内最多调一次**（见 {@link createExitGuard} 内的 blackoutOnce）。
 * @param {object} [options.proc] - 进程对象（默认 globalThis.process）。
 * @param {string[]} [options.signals] - 要接管的信号（默认 {@link EXIT_SIGNALS}）。
 * @param {Function} [options.schedule] - 「下一拍」调度器（默认 setImmediate）。
 * @param {Function|null} [options.log] - 只用来打一行诊断；抛错会被吞掉（退出路径上不能出岔子）。
 * @param {Function|null} [options.exit] - 退出实现（默认 proc.exit），自检注入假函数。
 * @returns {{install: Function, dispose: Function, releaseOnce: Function, blackoutOnce: Function, isInstalled: Function, handlers: Map}}
 */
const createExitGuard = ({
  release,
  blackout,
  proc = globalThis.process,
  signals = EXIT_SIGNALS,
  schedule = setImmediate,
  log = null,
  exit = null
} = {}) => {
  /** 信号名 → 我们注册的处理函数（也是「装没装」的判据）。 */
  const handlers = new Map();
  /** 收到信号的次数。**只统计外部派发**：本模块从不重发信号，所以这个计数是可信的。 */
  let seen = 0;
  /** 释放只做一次（幂等闸门；释放失败也不重试，退出路径上不该有重试循环）。 */
  let released = false;
  /** 灭灯只做一次：三处落点（exit 分支 / handover 的下一拍 / 'exit' 钩子）可能先后都跑到。 */
  let blackedOut = false;
  /** 挂在 proc 上的 `'exit'` 监听者（`null` = 没装）。幂等的依据。 */
  let exitHook = null;

  const say = (msg) => { try { if (log) log(msg); } catch (e) {} };

  /** 释放自己握着的资源，最多一次，绝不抛。 */
  const releaseOnce = () => {
    if (released) return false
    released = true;
    try {
      if (typeof release === 'function') release();
    } catch (e) {
      // 释放失败不能影响退出：设备句柄由操作系统回收。
      say(`释放资源失败（忽略）：${(e && e.message) || e}`);
    }
    return true
  };

  /**
   * 灭灯，最多一次，绝不抛。**必须在释放之前调用** —— 释放会关掉句柄，之后写不出去。
   * 三处落点：exit 分支（我们拥有退出权）、handover 的下一拍（排在释放前）、`'exit'` 钩子（兜底）。
   */
  const blackoutOnce = () => {
    if (blackedOut) return false
    blackedOut = true;
    try {
      if (typeof blackout === 'function') blackout();
    } catch (e) {
      // 灭灯失败也得退：宁可留一盏灯，也不能因为关灯把进程卡在退出路径上。
      say(`退出前灭灯失败（忽略）：${(e && e.message) || e}`);
    }
    return true
  };

  /** 真正退出。走注入的 exit（默认 proc.exit），顺带把退出码写进 exitCode（便于诊断）。 */
  const doExit = (sig) => {
    const code = exitCodeOf(sig);
    try { proc.exitCode = code; } catch (e) {}
    if (typeof exit === 'function') return exit(code)
    return proc.exit(code)
  };

  /**
   * 这个信号除我们之外还有几个监听者。
   * 读不到 listeners（异常环境）时按 0 算 —— 宁可自己退，也不要停在「谁也退不掉」上。
   */
  const othersFor = (sig, mine) => {
    try {
      if (typeof proc.listeners !== 'function') return 0
      return proc.listeners(sig).filter((l) => l !== mine && !GUARD_LISTENERS.has(l)).length
    } catch (e) {
      return 0
    }
  };

  const makeHandler = (sig) => function exitGuardHandler() {
    const mine = handlers.get(sig);
    seen += 1;
    const others = othersFor(sig, mine);

    if (exitPlan({ seen, others }) === 'exit') {
      // 我们拥有退出权（没人管这个信号），或是用户又按了一次。
      // ⚠ 这条路**故意不释放**：同步的原生 close 可能阻塞，而退出根本不需要它
      //   （进程一走，句柄由操作系统回收）。旧实现就是在这儿卡死的。
      //   —— 但**灭灯不能省**：灯是设备记着的，操作系统不会替我们关（见文件头那一节）。
      blackoutOnce();
      say(seen >= 2
        ? `收到 ${sig}（第 ${seen} 次），强制退出 ${exitCodeOf(sig)}`
        : `收到 ${sig}，宿主未接管该信号，按默认语义退出 ${exitCodeOf(sig)}`);
      return doExit(sig)
    }

    // 宿主在管这个信号：我们只帮它把事件循环排空（下一拍，别占用信号回调），
    // 退不退、怎么退，由宿主决定。
    // ⚠ **灭灯必须排在这一拍里、且排在释放之前**：释放会 close 掉句柄，之后谁都写不出去；
    //   而宿主的优雅退出是异步的，等它跑到插件 dispose 时 `state.open` 已经是我们关的了，
    //   dispose 里那句灭灯会被守卫挡下 —— 灯就一直亮着（用户报的正是这个）。
    const handoff = () => { blackoutOnce(); releaseOnce(); };
    try {
      schedule(handoff);
    } catch (e) {
      handoff();
    }
  };

  /**
   * 装上安全网。幂等：重复调用不会叠加监听者。
   * 除了三个信号，还会挂一个 `'exit'` 钩子 —— 见文件头「退出前必须灭灯」第 3 条。
   * @returns {number} 本次新增的**信号**监听者个数（0 = 之前已经装好；`'exit'` 钩子不计入）。
   */
  const install = () => {
    let added = 0;
    for (const sig of signals) {
      if (handlers.has(sig)) continue
      const h = makeHandler(sig);
      GUARD_LISTENERS.add(h);
      try {
        proc.on(sig, h);
        handlers.set(sig, h);
        added += 1;
      } catch (e) {
        // 某些信号在个别平台上不允许监听（或不是有效信号名）→ 跳过，不影响其它信号。
        GUARD_LISTENERS.delete(h);
      }
    }
    // `'exit'` 兜底：宿主自己的信号处理可能先跑、并直接 process.exit()，我们的信号回调压根
    // 不执行 —— 那时唯一还来得及的地方就是这里（process.exit 一定会触发 'exit'，HID 写是同步的）。
    if (!exitHook) {
      try {
        const h = () => { blackoutOnce(); };
        proc.on('exit', h);
        exitHook = h;
      } catch (e) {
        exitHook = null;
      }
    }
    return added
  };

  /**
   * 卸下安全网：**只移除自己注册的那几个函数**（宿主自己装的监听者一个都不碰）。
   * 幂等，可重复调用。
   * @returns {number} 本次移除的**信号**监听者个数（`'exit'` 钩子不计入）。
   */
  const dispose = () => {
    let removed = 0;
    for (const [sig, h] of [...handlers]) {
      handlers.delete(sig);
      try {
        const off = typeof proc.off === 'function' ? proc.off : proc.removeListener;
        off.call(proc, sig, h);
        removed += 1;
      } catch (e) {}
    }
    if (exitHook) {
      try {
        const off = typeof proc.off === 'function' ? proc.off : proc.removeListener;
        off.call(proc, 'exit', exitHook);
      } catch (e) {}
      exitHook = null;
    }
    return removed
  };

  return { install, dispose, releaseOnce, blackoutOnce, isInstalled: () => handlers.size > 0, handlers }
};

const RELEASE = true ? false : false;
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const resolveLogPath = (env = process.env, home = os.homedir()) => path.join(env && env.DSH_HOME ? env.DSH_HOME : path.join(home, ".dsh"), "logs", "dsh-omkb.log");
const render = (a) => {
  if (typeof a === "string") return a;
  if (a instanceof Error) return a.message || String(a);
  try {
    return JSON.stringify(a);
  } catch (e) {
    return String(a);
  }
};
const createLogSink = ({ release = RELEASE, file, fs: io = fs, now = () => /* @__PURE__ */ new Date() } = {}) => {
  let opened = false;
  let broken = false;
  const target = () => file || resolveLogPath();
  const open = () => {
    opened = true;
    const p = target();
    try {
      io.mkdirSync(path.dirname(p), { recursive: true });
    } catch (e) {
    }
    try {
      if (io.statSync(p).size > MAX_LOG_BYTES) io.renameSync(p, p + ".1");
    } catch (e) {
    }
  };
  const emit = (level, args, dev) => {
    if (!release) {
      try {
        dev();
      } catch (e) {
      }
      ;
      return;
    }
    if (broken) return;
    if (!opened) open();
    try {
      io.appendFileSync(target(), `${now().toISOString()} [${level}] ${args.map(render).join(" ")}
`, "utf8");
    } catch (e) {
      broken = true;
      try {
        console.error("[omkb] 日志文件写入失败，后续日志将丢弃:", e && e.message ? e.message : e);
      } catch (e2) {
      }
    }
  };
  return {
    info: (...a) => emit("info", a, () => console.log("[omkb]", ...a)),
    warn: (...a) => emit("warn", a, () => console.error("[omkb]", ...a)),
    // 入站帧的**原样**回显：改动前就是 `console.log(line)`（**不带**前缀），这一条也得保持原样。
    raw: (line) => emit("rx", [line], () => console.log(line))
  };
};
const logSink = createLogSink();

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
  // ---------- 配置（可用环境变量覆盖） ----------
  #reportId = 6;
  // ReportMap: 0x85, 0x06
  #channelRpc = 2;
  // 2 = RPC（1 = debug，忽略）
  // 设备匹配：优先按 VID:PID；默认 0x303A:0x8361，可用 DSH_HID_VID/DSH_HID_PID（十六进制字符串）覆盖；
  // 未配置 VID/PID 时回退到旧的 name/manufacturer 匹配（DSH_HID_NAME/DSH_HID_MFR）
  #vendorId = this.#parseHex(process.env.DSH_HID_VID || "0x303A");
  #productId = this.#parseHex(process.env.DSH_HID_PID || "0x8361");
  #deviceName = (process.env.DSH_HID_NAME || "OMKB").toLowerCase();
  #deviceMfr = (process.env.DSH_HID_MFR || "OMKB LAB").toLowerCase();
  #triggerMethod = process.env.DSH_HID_METHOD || null;
  // 可选：只响应某个 method
  #triggerKey = process.env.DSH_HID_KEY || null;
  // 可选：只响应某个 params.k
  #debounceMs = 250;
  // 一次物理按压只计一次
  #statePath = "/omkb/state";
  #configPath = "/omkb/config";
  #reconnectPath = "/omkb/reconnect";
  #agentsPath = "/omkb/agents";
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
  #state = { t: 0, open: false, product: null, battery: null, charging: false, brightness: 0.9, autoDim: 0, key: null, keyAct: null, down: [], agent: -1, act: null, enc: 0, encPress: 0, encLong: 0, knobPress: 0, joy: null, joyT: 0, joyPush: 0, joyDir: null, agents: [], outcomes: [], idle: null, keyT: {} };
  /** 当前物理按住的键名（只有拿到 act 才会维护；见 #handleLine 的松开分支）。 */
  #held = /* @__PURE__ */ new Set();
  #logger;
  #last = 0;
  #lineBuf = "";
  // 跨帧重组 buffer，按 '\n' 切 JSON 行
  #rpcId = 0;
  // 灯光控制（Codex Micro 兼容协议，见 src/core/ble.js 顶部注释）
  #dimmed = false;
  // 是否已因空闲而自动调暗
  #lastActivity = Date.now();
  /**
   * 浏览器上报的「所有会话都空闲」（null = 还没上报过 / 老客户端）。
   * 自动调暗按它计时：**会话全空闲**才是真的没事干；有会话在跑就不该关灯。
   */
  #allIdle = null;
  #idleSince = 0;
  // 进入「全空闲」的时刻（0 = 未知）
  #hid = null;
  #diagnostics = null;
  #dimTimer = null;
  /**
   * 进程退出安全网（见 ./guard.js）。
   * **只有真的打开了设备才会 install()**：手上没有句柄就完全不碰进程信号，
   * 宿主启动失败时也就不会因为我们而变成「退不掉」。
   */
  #exitGuard = null;
  #reconnectTimer = null;
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
  #linkSeen = false;
  /**
   * 「一句不吭」时的兜底探活定时器：句柄开着、`#probeMs` 里一帧都没收到 → 问一次。
   *
   * 为什么留着它：设备的协议用法是「被问才报」或「它自己刚连上时报」。宿主重启时若链路其实
   * 还在（旧连接），设备不会主动说话，不兜底问一次的话电池行会永远显示「—」（那是 2026-09-23
   * 专门修过的 bug）。代价只是链路真没建起来时白发一条 —— 那种情况写不出去，也不报错。
   */
  #probeTimer = null;
  #probeMs = 15e3;
  // 兜底延迟；DSH_OMKB_PROBE_MS 覆盖（自检脚本调小它），0 = 不兜底
  // ---------- 会话的「结果态」：运行失败（红）/ 跑完一轮（成功）----------
  // 分工：**浏览器**决定「哪个会话占哪颗键、平时是什么颜色与状态」（它才知道会话列表），
  // **宿主**决定「上一轮跑成了什么样」（它才收得到 agent/error 与 agent/turn-stopping，
  // 也是唯一写 HID 的人）。因此浏览器下发的槽位里带上会话 id（sid），宿主用它把事件定位到键。
  #desiredAgents = [];
  // 浏览器下发的期望灯态（设备字段 + 会话 id 元数据）
  #slotSessions = [];
  // 槽位下标 → 会话 id
  /**
   * 「同拍合并」的暂存位（见 #renderAgents）。
   *
   *   `#pendingAgents`   —— 算好但还没写出去的那一份参数（null = 没东西待写）
   *   `#agentsScheduled` —— 当前这一拍是否已经排过写入（排过就只覆盖内容，不再排第二次）
   *   `#pendingForce`    —— 这一份是不是**结论**驱动的（是则不许被内容去重挡下）
   *
   * 为什么要有它（用户 2026-09-25 要求：**会话信息返回给键盘设备时，一次不许发多条**）：
   * 同一个事件循环拍里会有好几个来源都要重画灯态 —— 宿主的 `agent/error` 与 `agent/status`
   * 常常连着来、浏览器 POST /omkb/agents 里 `allIdle` 翻转时还会顺手 `#wake()`。
   * 逐条写出去就是**设备一口气收到好几条 `v.oai.thstatus`**（每条还要切成 5 帧 63 字节的
   * HID 报告）。攒成一条再发，设备收到的永远是「此刻应该是什么样」。
   */
  #pendingAgents = null;
  #agentsScheduled = false;
  /**
   * 待写的这一份是不是**结论**驱动的 —— 是则**必须真发出去**，不许被内容去重挡下。
   *
   * 为什么要有它（用户 2026-09-26 第四次报：「如果上一次是发送失败，这一次发送又失败
   * 就不会发送 thstatus 了 —— 状态只回复当前会话的状态，其它会话 st 都为 0」）：
   * `#lastThstatus` 的内容去重回答的是「**设备此刻是不是已经这个样子了**」。对**常态灯态**
   * （浏览器推的期望态）这个问题问得对 —— 浏览器重推一份一模一样的快照，设备没必要听第二遍。
   *
   * 但对**结论**它问错了：一个结论是**事件**，不是「此刻的样子」。而红色恰好是**宿主独占**的
   * （`#errorColor`，浏览器那份改不动它），于是「又失败一次」算出来的 6 槽内容与上一次
   * **逐字节相同** → 被当成重复挡下 → 设备根本不知道又失败了一次。用户实测的正是这一条。
   * 真机实测的槽位（`npm run probe:agentslots`）：4 个可见会话全是空闲 → 除了出结论的那一颗键，
   * 其余槽位的 `st/c/b/e` **一个字都不变**，所以两次失败的报文必然逐字节相同。
   *
   * 只给 **error** 这条路打开（见 `#latchOutcome`）。为什么 success 不需要、也不该：
   *   · 成功的颜色要**等浏览器更正**（运行中的蓝 → 空闲的白），此刻多下发一次就可能多一条
   *     错颜色的中间态（那正是 §8f 要堵的东西）；
   *   · 它每次的颜色本来就与上次不同（蓝→白），内容去重根本挡不住它，用不着开这个口子。
   * 「**颜色由谁定**」又一次决定了能不能等、能不能去重 —— 与 `#outcomeWindowMs` 同一条纪律。
   *
   * 它跟着**内容**走（谁后到谁赢）—— 与 `#pendingAgents` 同一套语义：写这一份的调用方是不是结论，
   * 就记成什么。曾经写成「**或**上去」（`if (force) this.#pendingForce = true`，理由：同一拍里结论
   * 算出的内容若被浏览器那份覆盖，这一条仍然算结论），反证时发现**行为上分辨不出**：
   * 本文件里其余会重画灯态的入口（浏览器 POST / HID 输入 / 1s 的调暗检查 / open 重放）全都来自
   * I/O 回调或定时器，而写入排在**同一个事件循环拍的微任务**里 —— 「这一拍里结论被别的渲染覆盖」
   * 构造不出来。按「**不留无法反证的分支**」改成直接赋值（同 `#browserSeq` 那一课的规矩）。
   */
  #pendingForce = false;
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
  #lastThstatus = null;
  /**
   * **结果态的等待窗口**（毫秒）—— 「跑完一轮」「重新开跑」这类结果态**不立刻下发**，
   * 先等一个窗口，到点再回头看浏览器那条来了没有。
   *
   * 为什么要有它（用户 2026-09-26 第一次报「在会话中 thstatus 还是发两次」）：
   * 「会话状态变了」这件事有**两条速率不同的通道**。宿主的事件（`agent/turn-stopping` 等）是即时的；
   * 浏览器那份期望灯态带 **350ms 防抖**，而且要等会话列表变化才重算 —— 同一个物理时刻的事，
   * 它要晚 350ms 以上才到。于是「跑完一轮」变成两条：宿主先用**上一拍的颜色**（运行中的蓝）
   * 写一条 st=2，350ms 后浏览器那条把颜色更正成空闲的白 —— 内容不同，`#lastThstatus` 的
   * 内容去重挡不住（它只挡「一模一样」）。实测一次「跑完一轮」设备收到 3 条：
   * 蓝·运行中 → 蓝·成功 → 白·成功，中间那条是纯粹的抢跑。
   *
   * ⚠ **窗口到点 ≠ 可以写**（用户 2026-09-26 第二次报「会话中 thstatus 又发两次」）：
   * 第一版只是把写入往后推一个固定窗口，暗含「浏览器那条总会落在窗口内」—— 而它站不住：
   *   · `pushLeds` 的 350ms 防抖是**重新计时**的（`clearTimeout` + 新 `setTimeout`），
   *     会话在跑时列表频繁变化 → 那条 POST 被无限往后推，「会话中」正是它最容易超时的时刻；
   *   · 页面切到后台，Chrome 还会把定时器节流到 1s 以上。
   * 于是窗口一到点就写了「**旧颜色** + 新 st」，浏览器那条到了再把颜色更正 → 还是两条。
   * 现在改成**等浏览器那条真的到**（看那份待写内容有没有被消费掉），窗口只是「回头看一眼」的
   * 检查点；它一直不来（页面关了）才由 `#outcomeMaxMs` 兜底。
   * 窗口大小因此不再需要「比对方长」，它只决定**多久检查一次**。
   *
   * **诊断面不受影响**：`#state.agents` / `#state.outcomes` 仍在**同一拍同步**更新 ——
   * 读它的人（GET /omkb/state、自检）不该被「什么时候写设备」左右。
   *
   * 0 = 立即写（自检用；`DSH_OMKB_OUTCOME_MS` 覆盖）。
   */
  #outcomeWindowMs = 500;
  /**
   * 等浏览器那条的**硬上限**（毫秒）—— 从**首次**开窗算起，不因期间又来结论而重排。
   *
   * 为什么必须有：「等对方」的判据对面可能**永远不来**（页面关了 / 崩了 / 被挂起）。
   * 没有上限就变成「灯一直不变」，那是用户明确反对的另一头。
   * 为什么是 2s：正常路径下浏览器那条 350ms~1s 内必到（防抖 + 渲染 + 后台节流），
   * 2s 已是「这次真的不会来了」的量级；再长只会让「页面关了」的场景更迟钝。
   * `DSH_OMKB_OUTCOME_MAX_MS` 覆盖（自检要调小，否则每节都得多等 2 秒）。
   */
  #outcomeMaxMs = 2e3;
  /** 当前这轮结果态**首次**开窗的时刻（0 = 没在等）。算 `#outcomeMaxMs` 的起点，**不重排**。 */
  #outcomeSince = 0;
  /** 结果态窗口的定时器（null = 窗口没开）。见 #outcomeWindowMs / #deferAgentsWrite。 */
  #outcomeTimer = null;
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
  #outcome = /* @__PURE__ */ new Map();
  #errorColor = 16711680;
  // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js）
  constructor({ logger, diagnostics } = {}) {
    this.#logger = logger;
    this.#diagnostics = typeof diagnostics === "function" ? diagnostics : null;
    const probe = Number(process.env.DSH_OMKB_PROBE_MS);
    if (Number.isFinite(probe) && probe >= 0) this.#probeMs = probe;
    const outcome = Number(process.env.DSH_OMKB_OUTCOME_MS);
    if (Number.isFinite(outcome) && outcome >= 0) this.#outcomeWindowMs = outcome;
    const outcomeMax = Number(process.env.DSH_OMKB_OUTCOME_MAX_MS);
    if (Number.isFinite(outcomeMax) && outcomeMax > 0) this.#outcomeMaxMs = outcomeMax;
    this.#dimTimer = setInterval(() => this.#autoDimCheck(), 1e3);
    this.#dimTimer.unref();
    this.#exitGuard = createExitGuard({
      release: () => this.close(),
      blackout: () => this.blackout(),
      log: (m) => this.#warn(m)
    });
  }
  // 日志同时打到 Cordis logger 和「我们自己那一份」（开发版 = 终端 stdout/stderr，方便
  // 从命令行用 `dsh web` 调试；**正式版 = 只写 $DSH_HOME/logs/dsh-omkb.log**，终端安静）。
  // 去向由 ./log.js 的 logSink 定（构建期常量 __OMKB_RELEASE__，见那边的注释）。
  #log = (...a) => {
    try {
      this.#logger?.["info"]?.(...a);
    } catch (e) {
    }
    ;
    logSink.info(...a);
  };
  #warn = (...a) => {
    try {
      this.#logger?.["warn"]?.(...a);
    } catch (e) {
    }
    ;
    logSink.warn(...a);
  };
  get state() {
    return this.#state;
  }
  /**
   * 自检用：拿到退出安全网句柄。**只给自检脚本用**（`test/verify_exit_guard.js` 用它
   * 在不依赖真设备的前提下验证「信号到达时退不退、退得掉吗」）；运行时不调用，
   * 真机路径上安全网由 open() 自己 install()。
   */
  get exitGuard() {
    return this.#exitGuard;
  }
  /**
   * 测试注入：把一行 JSON 当作设备上报处理（与 HID 数据帧走同一条 #handleLine 路径）。
   * 只给自检脚本用（src/verify_joystick.js 用它喂 v.oai.rad 摇杆帧，把
   * 「角度 → 方向 → joy/joyT 计数」这条链路钉在测试里）；运行时不调用。
   * @param line - 一行 JSON 文本（可带尾随换行）。
   * @returns {void}
   */
  feedLine = (line) => {
    this.#handleLine(String(line));
  };
  // 状态快照 = 硬件状态 + 可选诊断。诊断由宿主注入（目前是设置持久化是否在线）：
  // 终端里的 logger 输出不一定会落到 stdout，把关键结论挂到 /omkb/state 上，
  // 排查时一条 curl 就能看到，不用重启终端或翻日志。
  #snapshot = () => {
    if (!this.#diagnostics) return this.#state;
    try {
      return { ...this.#state, settings: this.#diagnostics() };
    } catch (e) {
      return this.#state;
    }
  };
  // 防抖计数 + 空闲调暗恢复。restoreLight=false 时只通知计数、不写回 LED（用于摇杆这类纯输入事件，
  // 摇杆不应向键盘发回任何灯光信息）
  #bump = (label, restoreLight = true) => {
    const now = Date.now();
    this.#lastActivity = now;
    if (restoreLight) this.#wake();
    if (now - this.#last < this.#debounceMs) return;
    this.#last = now;
    this.#state.t += 1;
    this.#log(`HID 触发 ${this.#state.t}${label ? " (" + label + ")" : ""}`);
  };
  /**
   * 从「空闲调暗」状态恢复亮度。两处会调用：按下任意键（#bump）、会话重新开始运行（#applyAgents）。
   * 恢复时连灯态一起重放：调暗期间 #sendThstatus 是把灯压灭的（见它的实现），
   * 只写回亮度而不重放灯态的话，Agent 键会一直黑着。
   * @returns {boolean} 是否真的从调暗状态恢复。
   */
  #wake = () => {
    if (!this.#dimmed) return false;
    this.#dimmed = false;
    if (this.#state.brightness > 0) this.#sendBrightness(this.#state.brightness);
    this.#renderAgents();
    return true;
  };
  // 处理一条完整的 JSON 通知行，如 {"method":"v.oai.hid","params":{"k":"AG00"}}
  #handleLine = (line) => {
    logSink.raw(line);
    const raw = line.trim();
    if (!raw) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      this.#warn("非法 JSON 行:", raw);
      return;
    }
    if (!msg || typeof msg !== "object") return;
    const status = parseDeviceStatus(msg);
    if (status) {
      this.#state.battery = status.battery;
      this.#state.charging = status.charging;
      return;
    }
    if (typeof msg.method !== "string") return;
    if (this.#triggerMethod && msg.method !== this.#triggerMethod) return;
    const key = msg.params && msg.params.k;
    if (this.#triggerKey && (!key || key !== this.#triggerKey)) return;
    const keyAct = msg.params && typeof msg.params.act === "number" ? msg.params.act : null;
    this.#state.keyAct = keyAct;
    if (keyAct === HID_ACT.RELEASE) {
      if (key) {
        this.#held.delete(key);
        this.#state.down = [...this.#held];
      }
      return;
    }
    if (key && keyAct !== null && keyAct !== HID_ACT.PULSE) {
      this.#held.add(key);
      this.#state.down = [...this.#held];
    }
    this.#state.key = key || null;
    if (key) {
      const map = this.#state.keyT || (this.#state.keyT = {});
      if (map[key] !== void 0 || Object.keys(map).length < 64) {
        map[key] = (map[key] || 0) + 1;
      }
    }
    if (key === "ENC_CW") {
      this.#state.enc = (this.#state.enc || 0) + 1;
      this.#state.agent = -1;
      this.#state.act = null;
      this.#bump(key);
      return;
    }
    if (key === "ENC_CC") {
      this.#state.enc = (this.#state.enc || 0) - 1;
      this.#state.agent = -1;
      this.#state.act = null;
      this.#bump(key);
      return;
    }
    if (msg.method === JOYSTICK_METHOD) {
      const j = parseJoystick(msg);
      const dir = j && j.dir || null;
      this.#state.agent = -1;
      this.#state.act = null;
      const prev = this.#state.joy;
      this.#state.joy = dir;
      if (dir !== prev) {
        this.#state.joyT = (this.#state.joyT || 0) + 1;
        if (dir) {
          this.#state.joyPush = (this.#state.joyPush || 0) + 1;
          this.#state.joyDir = dir;
          this.#bump("JOY_" + dir, false);
        }
      }
      return;
    }
    const m = /^AG0([0-5])$/i.exec(key || "");
    const a = /^ACT(0[6-9]|1[0-2])$/i.exec(key || "");
    this.#state.agent = m ? Number(m[1]) : -1;
    this.#state.act = a ? "ACT" + a[1] : null;
    if (key === "ENC") this.#state.knobPress = (this.#state.knobPress || 0) + 1;
    this.#bump(key || msg.method);
  };
  // 把一段 payload 追加进重组 buffer，按 '\n' 切出完整行处理
  #feed = (payload) => {
    this.#lineBuf += payload.toString("utf8");
    let idx;
    while ((idx = this.#lineBuf.indexOf("\n")) !== -1) {
      const line = this.#lineBuf.slice(0, idx);
      this.#lineBuf = this.#lineBuf.slice(idx + 1);
      if (line.length) {
        try {
          this.#handleLine(line);
        } catch (e) {
          this.#warn(`丢弃异常行: ${e && e.message ? e.message : e}`);
        }
      }
    }
    if (this.#lineBuf.length > 4096) this.#lineBuf = "";
  };
  #onData = (buf) => {
    if (!buf || buf.length < 3) return;
    if (!this.#linkSeen) this.#markConnected();
    let off = buf[0] === this.#reportId ? 1 : 0;
    if (buf.length < off + 2) return;
    const channel = buf[off];
    const len = buf[off + 1];
    if (channel !== this.#channelRpc) return;
    this.#feed(buf.slice(off + 2, off + 2 + len));
  };
  // 十六进制字符串（可带 0x 前缀）→ 数值；非法返回 null
  // 注意：必须是原型方法语法（非箭头字段），供上方字段初始化时调用
  #parseHex(v) {
    if (v == null) return null;
    const s = String(v).trim().toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]{1,4}$/.test(s)) return null;
    return parseInt(s, 16);
  }
  // 设备匹配：优先 VID+PID 精确匹配；未配置 VID/PID 时回退到 name/manufacturer
  #matches = (d) => {
    if (this.#vendorId != null || this.#productId != null) {
      return this.#vendorId != null && d.vendorId === this.#vendorId && this.#productId != null && d.productId === this.#productId;
    }
    const p = typeof d.product === "string" ? d.product.toLowerCase() : "";
    const m = typeof d.manufacturer === "string" ? d.manufacturer.toLowerCase() : "";
    return p.includes(this.#deviceName) && m === this.#deviceMfr;
  };
  open = () => {
    if (this.#hid || this.#state.open) return;
    try {
      const nodehid = require$1("node-hid");
      if (!nodehid || typeof nodehid.devices !== "function") {
        this.#log("未安装 node-hid 原生模块，HID 读取关闭");
        return;
      }
      const list = nodehid.devices();
      const cand = list.find(this.#matches);
      if (!cand) {
        this.#log(
          `未找到 ${this.#vendorId != null || this.#productId != null ? `VID:PID = 0x${(this.#vendorId || 0).toString(16)}:0x${(this.#productId || 0).toString(16)}` : `name="${this.#deviceName}" & manufacturer="${this.#deviceMfr}"`} 的 HID 设备；可设 DSH_HID_VID/DSH_HID_PID（十六进制，如 1235/0a91），或检查设备是否已配对且为厂商自定义类(标准键盘会被系统独占)`
        );
        return;
      }
      this.#state.product = cand.product || cand.manufacturer || JSON.stringify({ VID: cand.vendorId, PID: cand.productId });
      this.#hid = new nodehid.HID(cand.path);
      this.#state.open = true;
      this.#exitGuard?.install();
      if (this.#reconnectTimer) {
        clearInterval(this.#reconnectTimer);
        this.#reconnectTimer = null;
      }
      this.#log(`已打开 HID 设备: ${this.#state.product} (manufacturer=${cand.manufacturer || ""})`);
      if (this.#desiredAgents.length) this.#renderAgents();
      this.#hid.on("data", this.#onData);
      this.#hid.on("error", (e) => {
        this.#warn("HID 读取错误:", e && e.message);
        this.close();
        if (!this.#reconnectTimer) {
          this.#reconnectTimer = setInterval(() => this.open(), 3e4);
          this.#reconnectTimer.unref();
          this.#log("设备断开，已启动 30 秒自动重连");
        }
      });
      this.#linkSeen = false;
      this.#armProbe();
    } catch (e) {
      this.#warn(
        "node-hid 打开失败(需要正确编译的原生依赖，且设备非标准键盘):",
        e && e.message
      );
      this.#state.open = false;
    }
  };
  close = () => {
    if (this.#hid) {
      try {
        this.#hid.close();
      } catch (e) {
      }
      this.#hid = null;
    }
    this.#state.open = false;
    this.#held.clear();
    this.#state.down = [];
    this.#state.battery = null;
    this.#state.charging = false;
    this.#linkSeen = false;
    if (this.#probeTimer) {
      clearTimeout(this.#probeTimer);
      this.#probeTimer = null;
    }
    this.#pendingAgents = null;
    this.#pendingForce = false;
    this.#cancelOutcomeWindow();
    this.#lastThstatus = null;
  };
  // ---------- HID 写回：JSON-RPC 分帧写入（用于灯光/亮度控制） ----------
  // 输出报告 64 字节：[0x06 report id][0x02 channel][len][JSON 片段<=61]，超长按 61 字节切片
  #sendRpc = (method, params) => {
    if (!this.#hid || !this.#state.open) {
      this.#warn("设备未连接，忽略写回:", method);
      return false;
    }
    const json = Buffer.from(JSON.stringify({ method, params, id: ++this.#rpcId }), "utf8");
    const MAX = 61;
    for (let pos = 0; pos < json.length; pos += MAX) {
      const frag = json.slice(pos, pos + MAX);
      const buf = Buffer.alloc(64);
      buf[0] = this.#reportId;
      buf[1] = this.#channelRpc;
      buf[2] = frag.length;
      frag.copy(buf, 3);
      try {
        this.#hid.write(buf);
      } catch (e) {
        this.#warn("HID 写入失败:", e && e.message);
        return false;
      }
    }
    this.#log("已发送 RPC:", method, JSON.stringify(params));
    return true;
  };
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
  #markConnected = () => {
    this.#linkSeen = true;
    if (this.#probeTimer) {
      clearTimeout(this.#probeTimer);
      this.#probeTimer = null;
    }
    this.#log("检测到设备已连接（收到第一帧数据）");
    if (this.#state.battery === null) this.#requestStatus();
  };
  /**
   * 武装「一句不吭」的兜底探活：`#probeMs` 内一帧都没收到，才主动问一次电量。
   *
   * 只在 open() 成功后武装一次，设备一开口（#markConnected）或链路一断（close）就撤掉。
   * 它**不是**「连上就问」：它要等满了整个窗口，且期间设备一声不响 —— 那才是「链路可能还活着、
   * 但设备不会自己说话」的那种旧连接（宿主重启）。
   */
  #armProbe = () => {
    if (this.#probeTimer) {
      clearTimeout(this.#probeTimer);
      this.#probeTimer = null;
    }
    if (!(this.#probeMs > 0)) return;
    this.#probeTimer = setTimeout(() => {
      this.#probeTimer = null;
      if (!this.#hid || !this.#state.open || this.#linkSeen) return;
      this.#log(`打开句柄后 ${this.#probeMs}ms 没收到设备的任何数据 → 兜底问一次电量`);
      this.#requestStatus();
    }, this.#probeMs);
    this.#probeTimer.unref?.();
  };
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
  #requestStatus = () => this.#sendRpc(STATUS_METHOD, {});
  // 亮度：写回 rgbcfg（普通键背光 + 外周氛围灯）。v 为 0..1
  #sendBrightness = (v) => {
    const b = Math.max(0, Math.min(1, v));
    if (b <= 0) {
      return this.#sendRpc("v.oai.rgbcfg", {
        ambient: { e: 0, b: 0, s: 0, m: 0, c: 0 },
        keys: { e: 0, b: 0, s: 0, m: 0, c: 0 }
      });
    }
    return this.#sendRpc("v.oai.rgbcfg", {
      ambient: { e: 2, b, s: 0.4, m: 0, c: 3166206 },
      keys: { e: 1, b, s: 0, m: 0, c: 16777215 }
    });
  };
  // 应用来自设置面板的配置补丁
  #applyConfig = (patch) => {
    if (!patch || typeof patch !== "object") return;
    if (typeof patch.brightness === "number") {
      this.#state.brightness = Math.max(0, Math.min(1, patch.brightness));
      this.#dimmed = false;
      this.#lastActivity = Date.now();
      this.#sendBrightness(this.#state.brightness);
      this.#renderAgents();
    }
    if (typeof patch.autoDim === "number") {
      this.#state.autoDim = Math.max(0, patch.autoDim);
      if (this.#state.autoDim <= 0) this.#wake();
      else this.#dimmed = false;
    }
  };
  // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
  // 与 #applyConfig 的区别：只有值真的变化才写 HID，避免重复下发灯光指令。
  // 返回是否发生了改动。
  setPrefs = (prefs) => {
    if (!prefs || typeof prefs !== "object") return false;
    let changed = false;
    if (typeof prefs.brightness === "number") {
      const b = Math.max(0, Math.min(1, prefs.brightness));
      if (b !== this.#state.brightness) {
        this.#state.brightness = b;
        this.#dimmed = false;
        this.#lastActivity = Date.now();
        this.#sendBrightness(b);
        this.#renderAgents();
        changed = true;
      }
    }
    if (typeof prefs.autoDim === "number") {
      const d = Math.max(0, prefs.autoDim);
      if (d !== this.#state.autoDim) {
        this.#state.autoDim = d;
        if (d <= 0) this.#wake();
        else this.#dimmed = false;
        changed = true;
      }
    }
    return changed;
  };
  #clampRgb = (v) => Math.max(0, Math.min(16777215, Math.round(Number(v) || 0)));
  #clamp01 = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  };
  /**
   * 状态码的白名单校验：**必须是整数**且在 allowed 里，否则回落到 IDLE。
   *
   * 为什么要判类型而不是只 `Number()` 一下：`Number(true) === 1`、`Number('1') === 1` ——
   * 只做数值转换的话，浏览器塞个 `true` 就能伪装成「运行中」。设备拿这个数直接分支，
   * 所以校验必须严于「能转成数字」。
   */
  #stOf = (v, allowed) => typeof v === "number" && Number.isInteger(v) && allowed.includes(v) ? v : AGENT_ST_DEFAULT;
  /** 浏览器报上来的状态码：只接受 IDLE/RUNNING（见 AGENT_ST_INBOUND）。 */
  #inboundSt = (v) => this.#stOf(v, AGENT_ST_INBOUND);
  /** 真正下发到设备前的兜底（此时才允许宿主叠加的 SUCCESS/ERROR）。 */
  #clampSt = (v) => this.#stOf(v, Object.values(AGENT_ST));
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
  #thstatusParams = (slots) => {
    const dimmed = this.#dimmed;
    return slots.slice(0, 6).map((s, i) => ({
      id: i,
      c: this.#clampRgb(s && s.c),
      b: dimmed ? 0 : this.#clamp01(s && s.b, 0),
      e: dimmed ? 0 : Math.round(Number(s && s.e) || 0),
      st: this.#clampSt(s && s.st)
    }));
  };
  /**
   * 写一条 `v.oai.thstatus` —— **唯一的落笔点**（`#sendThstatus` 与 `#flushAgents` 都走它）。
   *
   * 内容与**上一次真正写出去的**完全一致时直接跳过，并记一行日志。
   * 比对的是**规范化之后**的参数，所以「先失败、随后浏览器补一份陈旧快照」这种重复也认得出来
   * —— 它算出来的红灯与宿主刚写出去的逐字节相同（见 `#lastThstatus` 的注释）。
   *
   * ⚠ **只有常态灯态才吃这套去重**。`force`（= 宿主的结论，见 `#pendingForce`）为真时，
   *   内容再一样也**必须发**：结论是**事件**，「设备此刻已经是红色」并不等于「设备已经知道
   *   又失败了一次」。用户 2026-09-26 第四次报的「连续两次失败，第二次不发」就是被这条挡下的。
   * @param params - `#thstatusParams` 规范化过的 6 槽参数。
   * @param force - true = 结论态，跳过内容比对直接发。
   * @returns {boolean} 是否真的写了（内容没变且非结论时为 false，这不是错误）。
   */
  #writeThstatus = (params, force = false) => {
    const key = JSON.stringify(params);
    if (key === this.#lastThstatus) {
      if (!force) {
        this.#log("灯态与上次写出去的完全相同 → 跳过重复写回");
        return false;
      }
      this.#log("这一条是结论态 → 内容与上次相同也照发（内容去重只挡常态灯态）");
    }
    const ok = this.#sendRpc("v.oai.thstatus", params);
    if (ok) {
      this.#lastThstatus = key;
      this.#log(`→ 写 thstatus${force ? "（结论）" : ""}：${params.map((p) => `${p.id}:st${p.st}/#${p.c.toString(16).padStart(6, "0")}${p.e ? "" : "(灭)"}`).join(" ")}`);
    }
    return ok;
  };
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
  #sendThstatus = (slots) => {
    if (!Array.isArray(slots)) return false;
    const params = this.#thstatusParams(slots);
    this.#state.agents = params;
    return this.#writeThstatus(params);
  };
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
   *     宿主未必来得及走到 `dispose()`（见 ./guard.js 顶部「退出前必须灭灯」）。
   *
   * 幂等：重复调用只是把同一份「全灭」再写一遍，弄不坏任何状态（插件可能被卸载两次、
   * 安全网也可能在 exit 钩子上再调一次）。
   *
   * 它会让 `state.agents` 也变成全 0（`#sendThstatus` 的正常副作用）：这正是设备此刻
   * 真实的样子，也是 /omkb/state 该报的事实。**期望灯态 `#desiredAgents` 一个字节都不动**。
   * @returns {boolean} 两条指令是否真的写出去了（没连上、或内容与上次完全相同被跳过时 false）。
   */
  #lightsOff = () => {
    const dim = this.#sendBrightness(0);
    const dark = this.#sendThstatus(BLACKOUT_SLOTS);
    return dim && dark;
  };
  /**
   * 灭灯的唯一对外落点（`#lightsOff` 的公开包装，自带「没连着就什么都不做」的守卫）。
   *
   * 故意写成**公有类字段**（和 `close` 同一套路）：自检脚本可以把它整个换成打印或计数器，
   * 以此观测「退出路径到底有没有灭灯」（见 test/lib/exit-guard-child.mjs）——
   * 而 `#lightsOff` 是私有的，从外面换不掉。
   * @returns {boolean} 是否真的写给设备了。
   */
  blackout = () => {
    if (!this.#hid || !this.#state.open) return false;
    return this.#lightsOff();
  };
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
  //
  // @param defer - 排到结果态窗口之后（见 #deferAgentsWrite），只给结果态用。
  // @param force - 这一份是**结论** → 写出去时不吃内容去重（见 #pendingForce）。
  #renderAgents = (defer = false, force = false) => {
    if (!this.#desiredAgents.length) return false;
    const params = this.#thstatusParams(this.#composeAgents());
    this.#state.agents = params;
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }));
    this.#pendingAgents = params;
    this.#pendingForce = force;
    if (defer) this.#deferAgentsWrite();
    else if (!this.#agentsScheduled) {
      this.#agentsScheduled = true;
      queueMicrotask(this.#flushAgents);
    }
    return true;
  };
  /**
   * 把待写的那份灯态排到**一个窗口之后**（见 `#outcomeWindowMs`）—— 只给**结果态**用
   * （`#latchOutcome` / `clearOutcome`），常态灯态照旧走同拍合并后立刻写。
   *
   * 窗口内再来多少次都只是覆盖 `#pendingAgents`（谁后到谁赢，算的都是「此刻应该是什么样」），
   * 到点只写一条。**已经在窗口里就直接返回，起点不重排** —— 否则连续事件会把写入无限往后推，
   * 变成「一直不亮」。
   *
   * 窗口为 0（自检 / `DSH_OMKB_OUTCOME_MS=0`）时走的还是老路径：同拍合并后立刻写。
   * 这样「结果态延后」这件事不会把「同拍只发一条」那套既有语义搅乱。
   */
  #deferAgentsWrite = () => {
    if (this.#outcomeWindowMs <= 0) {
      if (!this.#agentsScheduled) {
        this.#agentsScheduled = true;
        queueMicrotask(this.#flushAgents);
      }
      return;
    }
    if (this.#outcomeTimer) return;
    if (!this.#outcomeSince) this.#outcomeSince = Date.now();
    this.#outcomeTimer = setTimeout(this.#afterOutcomeWindow, this.#outcomeWindowMs);
    this.#outcomeTimer.unref?.();
  };
  /**
   * 窗口到点：**回头看一眼浏览器那条来了没有** —— 只有来了（或等过头了）才把灯写出去。
   *
   * 怎么知道它来了：**看 `#pendingAgents` 还在不在**。浏览器那条一到就走
   * `#applyAgents` → `#renderAgents()`（非 defer）→ 微任务把终态写下去，这一份随即被消费掉；
   * 所以「到点后 `#pendingAgents` 还在」= 这期间没有任何东西写过灯。此刻写出去的是
   * 「旧颜色 + 新 st」，等浏览器到了还得再写一条，设备就收到两条 —— 那正是用户报的病。
   * 于是**继续等**，等到 `#outcomeMaxMs` 才认输兜底。
   *
   * ⚠ 曾经这里还比过一个「浏览器推送序号」（`#browserSeq` / `#outcomeSeq`）。反证时发现
   *   **摘掉它行为完全不变** —— 因为「浏览器推过」的充分表现就是上面那份待写内容被消费掉，
   *   序号是第二份判据、多一个可以不同步的字段。按「不留无法反证的分支」删掉了。
   */
  #afterOutcomeWindow = () => {
    this.#outcomeTimer = null;
    const patientLeft = Date.now() - this.#outcomeSince < this.#outcomeMaxMs;
    if (this.#pendingAgents && patientLeft) {
      this.#deferAgentsWrite();
      return;
    }
    this.#flushAgents();
  };
  /**
   * 把当前这一拍攒下的那一份灯态写出去（**最多一条**，且内容与上次相同就跳过）。
   *
   * 断开时 `close()` 会把 `#pendingAgents` 清掉：链路都没了还补写一条，除了多一行
   * 「设备未连接，忽略写回」的 warn 之外毫无意义；重连时 `open()` 会重新 `#renderAgents()`
   * 把灯态重放出来，不会漏（`close()` 也顺手忘了「上次发过什么」，见 `#lastThstatus`）。
   * @returns {boolean} 这一拍是否真的往设备写了一条（无待写 / 内容没变时为 false）。
   */
  #flushAgents = () => {
    this.#agentsScheduled = false;
    this.#cancelOutcomeWindow();
    const params = this.#pendingAgents;
    const force = this.#pendingForce;
    this.#pendingAgents = null;
    this.#pendingForce = false;
    if (!params) return false;
    return this.#writeThstatus(params, force);
  };
  /**
   * 撤掉还没到点的结果态窗口，并清掉「这一轮从何时算起」。
   *
   * 谁清 `#outcomeSince` 谁就得清 `#outcomeTimer` —— 这两个字段是**同一件事的两半**：
   * 窗口活着 = 这一轮还在等浏览器那条。只清一个就会留下孤儿窗口，它到点时按「已经等过头了」
   * 处理，把不该写的待写内容抢跑写出去（见 `#flushAgents` 与 §8g）。
   *
   * ⚠ 这条曾经被当成「删掉也没有断言变红」的冗余代码删过一次 —— 那是**当时漏了场景**：
   *   §8f 覆盖的是「开窗后没有新的结果态变化」，而 orphan 要的是
   *   「开窗 → 浏览器那条到（flush）→ **又来一次结果态变化**（点击发送 / clearOutcome）」。
   *   §8g 补上之后，删掉它立刻红 3 条。**别再删了。**
   */
  #cancelOutcomeWindow = () => {
    if (this.#outcomeTimer) {
      clearTimeout(this.#outcomeTimer);
      this.#outcomeTimer = null;
    }
    this.#outcomeSince = 0;
  };
  /**
   * 期望灯态 + 结果态 → 6 个槽位（设备字段形态）。不改变状态、不碰设备。
   *
   * 结果态只认「此刻占着这个槽位的那个会话」：会话消失 / 换人时宁可少亮一盏，也不要把
   * 别人上一轮的失败挂到新来的会话身上（`#applyAgents` 已经整表重建过，这里是出口兜底）。
   */
  #composeAgents = () => this.#desiredAgents.map((s, i) => {
    const out = this.#outcome.get(i);
    const mine = out && this.#slotSessions[i] === out.sid ? out : null;
    const red = !!mine && mine.kind === "error";
    return {
      id: i,
      // 失败压过一切；成功只是「状态码是 2」，颜色仍按浏览器给的那份。
      st: red ? AGENT_ST.ERROR : mine ? AGENT_ST.SUCCESS : s.st,
      c: red ? this.#errorColor : s.c,
      b: s.b,
      e: s.e
    };
  });
  /**
   * 某个会话这一轮跑出了结论 → 让它占的那几颗键**保持**这个结果态，直到该会话重新运行
   * （见 clearOutcome）。
   * @param sessionId - 会话 id（DSH 里 agent.id 就是会话 id）。
   * @param kind - 'error'（运行失败，**顺带把灯换成红灯**）| 'success'（正常跑完一轮，只改状态码）。
   * @returns {boolean} 是否真的命中了某个键（该会话没占键时为 false，不算异常）。
   */
  #latchOutcome = (sessionId, kind) => {
    if (typeof sessionId !== "string" || !sessionId) return false;
    const bad = kind === "error";
    const slots = [];
    for (let i = 0; i < this.#slotSessions.length; i++) if (this.#slotSessions[i] === sessionId) slots.push(i);
    if (slots.length === 0) return false;
    for (const slot of slots) this.#outcome.set(slot, { sid: sessionId, kind });
    this.#renderAgents(!bad, bad);
    this.#log(bad ? `会话运行失败 → 槽位 ${slots.join(",")} 转红灯（保持到该会话重新运行）` : `会话跑完一轮 → 槽位 ${slots.join(",")} 报成功（保持到该会话重新运行）`);
    return true;
  };
  /**
   * 某个会话运行失败 → 让它的那颗键**一直红着**（状态码同时变 3），不再自己变回白色。
   *
   * 由宿主的 `agent/error` 事件驱动（见 src/core/index.js）。注意这个事件**只在真正的失败**
   * 时发出：用户主动中断走的是另一条分支，不会转红。
   * 收掉它的唯一常规途径是「该会话重新开始运行」（clearOutcome）。
   */
  reportError = (sessionId) => this.#latchOutcome(sessionId, "error");
  /**
   * 某个会话**正常跑完一轮** → 让它那颗键一直报 st=2（成功），颜色不动。
   *
   * 由宿主的 `agent/turn-stopping` 驱动：那是「这一轮要收尾了」的钩子，用户中断
   * （signal.aborted）与真失败（agent/error）都在它之前就 throw 掉了，走不到这一步 ——
   * 所以它天然就是「成功」的信号，不需要再去比对什么 reason。
   */
  reportSuccess = (sessionId) => this.#latchOutcome(sessionId, "success");
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
  clearOutcome = (sessionId) => {
    if (typeof sessionId !== "string" || !sessionId) return false;
    let hit = false;
    for (const [slot, t] of [...this.#outcome]) {
      if (t.sid !== sessionId) continue;
      this.#outcome.delete(slot);
      hit = true;
    }
    if (!hit) return false;
    this.#renderAgents(true);
    this.#log(`会话 ${sessionId} 重新开始运行 → 收掉结果灯`);
    return true;
  };
  // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,sid}...], errorColor } 或纯数组）
  #applyAgents = (payload) => {
    const list = Array.isArray(payload) ? payload : payload && Array.isArray(payload.slots) ? payload.slots : null;
    if (!list) return;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const c = payload.errorColor;
      if (typeof c === "number" && Number.isInteger(c) && c >= 0 && c <= 16777215) this.#errorColor = c;
      if (typeof payload.allIdle === "boolean") {
        this.#state.idle = payload.allIdle;
        if (payload.allIdle !== this.#allIdle) {
          this.#allIdle = payload.allIdle;
          if (payload.allIdle) this.#idleSince = Date.now();
          else {
            this.#idleSince = 0;
            this.#wake();
          }
        }
      }
    }
    const desired = [];
    const sessions = [];
    for (let i = 0; i < 6; i++) {
      const s = list[i] || {};
      desired.push({
        st: this.#inboundSt(s.st),
        c: this.#clampRgb(s.c),
        b: this.#clamp01(s.b, 0),
        e: Math.round(Number(s.e) || 0)
      });
      sessions.push(typeof s.sid === "string" && s.sid ? s.sid : null);
    }
    this.#desiredAgents = desired;
    this.#slotSessions = sessions;
    const next = /* @__PURE__ */ new Map();
    for (const [, t] of this.#outcome) {
      const at = sessions.indexOf(t.sid);
      if (at !== -1 && !next.has(at)) next.set(at, t);
    }
    this.#outcome = next;
    this.#renderAgents();
  };
  // 空闲自动调暗：autoDim(秒) 到了就关灯（亮度 0 = ambient 与键灯一起熄）。
  //
  // 计时基准有两条路：
  //   * 浏览器报过 allIdle（新客户端）→ 用「进入全空闲的时刻」与「最后一次按键」里较晚的那个
  //     起算。会话在跑 = 有活干，直接不关；刚敲过键盘也不关——否则会出现
  //     「到点关灯 → 一按键又亮 → 1 秒后又关」的闪烁。
  //   * 还没这份信息（老客户端 / 从未上报）→ 退回原来的「无按键活动」判据，行为与以前完全一致。
  #autoDimCheck = () => {
    if (this.#state.autoDim <= 0 || this.#dimmed || !this.#state.open) return;
    if (this.#allIdle === false) return;
    const ref = Math.max(this.#lastActivity, this.#idleSince);
    if (Date.now() - ref < this.#state.autoDim * 1e3) return;
    this.#dimmed = true;
    this.#sendBrightness(0);
    this.#renderAgents();
    this.#log(`空闲自动调暗：关闭灯光（${this.#allIdle === true ? "所有会话空闲" : "无按键活动"} ${this.#state.autoDim}s）`);
  };
  // ---------- HTTP 桥接：状态查询 + 配置写回 + 重连 ----------
  #jsonHead = { "content-type": "application/json; charset=utf-8" };
  #readBody = (req, cb) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => cb(body));
  };
  #json = (res, code, obj) => {
    res.writeHead(code, this.#jsonHead);
    res.end(JSON.stringify(obj));
  };
  registerRoute = (webServer) => {
    const disposers = [];
    try {
      disposers.push(webServer.register({
        kind: "exact",
        path: this.#statePath,
        handler: (_req, res) => {
          this.#json(res, 200, this.#snapshot());
        }
      }));
      disposers.push(webServer.register({
        kind: "exact",
        path: this.#configPath,
        handler: (req, res) => {
          if (req.method !== "POST") {
            this.#json(res, 405, { error: "method not allowed" });
            return;
          }
          this.#readBody(req, (body) => {
            try {
              this.#applyConfig(JSON.parse(body || "{}"));
              this.#json(res, 200, this.#state);
            } catch (e) {
              this.#json(res, 400, { error: e && e.message ? e.message : String(e) });
            }
          });
        }
      }));
      disposers.push(webServer.register({
        kind: "exact",
        path: this.#reconnectPath,
        handler: (_req, res) => {
          this.close();
          this.open();
          this.#json(res, 200, this.#state);
        }
      }));
      disposers.push(webServer.register({
        kind: "exact",
        path: this.#agentsPath,
        handler: (req, res) => {
          if (req.method !== "POST") {
            this.#json(res, 405, { error: "method not allowed" });
            return;
          }
          this.#readBody(req, (body) => {
            try {
              this.#applyAgents(JSON.parse(body || "{}"));
              this.#json(res, 200, this.#state);
            } catch (e) {
              this.#json(res, 400, { error: e && e.message ? e.message : String(e) });
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
      this.#warn("webServer 路由注册失败:", e && e.message);
      return null;
    }
  };
  dispose = () => {
    clearInterval(this.#dimTimer);
    if (this.#reconnectTimer) {
      clearInterval(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    if (this.#probeTimer) {
      clearTimeout(this.#probeTimer);
      this.#probeTimer = null;
    }
    this.blackout();
    this.#exitGuard?.dispose();
    this.close();
  };
}
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

// dsh-omkb · 宿主侧设置（DSH 0.1.7-rc.2 契约）
//
// ── 这一版为什么整块重写（第三次契约漂移）────────────────────────────────────
// 0.1.5-rc.3 之前：@deepseek-ai/dsh-settings 导出两个自由函数
//     installSettingsSection(ctx, settingsNamespace('dsh-omkb'), schema, entry, hooks)
// 0.1.5-rc.3：改成服务方法 ctx.settings.installSection(owner, ns, schema, entry, hooks)
// 0.1.7-rc.2：**installSection 与客户端 settingsScope 一起删掉了**。命名空间不再是
//   「插件自己注册的东西」，而是**插件在 profile 里那条 loader 条目的 Config**：
//     · 命名空间名 = 条目 id（我们就是 `dsh-omkb`，见 cordis.patch.yml 的 insert.id）
//     · schema     = 插件模块导出的 `Config`（schemastery），**每个字段都要 .volatile()**
//     · 可写性     = 只有标了 volatile 的字段才进设置表单；改它由 loader 就地提交
//                    （updateVolatile + `loader/volatile-update`），**不会重启插件**
//     · 客户端     = ctx.configForms.get('dsh-omkb')（settingsScope.bind 没了）
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


/**
 * 命名空间。**必须与 profile 里那条 loader 条目的 id 逐字相同**（我们的
 * `cordis.patch.yml` 里 `insert: [{ id: dsh-omkb, name: dsh-omkb }]`）。
 * 客户端 `ctx.configForms.get(DSVI.NS)` 用的也是这个字符串。
 */
const OMKB_NAMESPACE = 'dsh-omkb';

/**
 * 默认值 —— schema 默认值与「读不到配置时的兜底」共用这一份，避免两处各写一份慢慢漂移。
 * 必须与客户端 DSVI.OMKB_DEFAULTS 逐字段一致（两侧分别构建、无法共享模块）。
 */
const OMKB_DEFAULTS = {
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
};

/** 智能体键映射模式。 */
const AGENT_KEY_MODES = ['pinned', 'recent', 'priority', 'custom'];
/** 旋钮模式。 */
const KNOB_MODES = ['navigate', 'reasoning', 'scroll', 'custom'];

const clamp01 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.9);

/**
 * DSH 运行时依赖的解析位置。
 *
 * schemastery 由 DSH 运行时提供，插件包自己不声明它（也不该声明具体版本）。麻烦在于
 * 「从哪个位置解析」：Node 默认把符号链接解析成**真实路径**，所以开发态以 `link:` 挂进
 * profile 的插件，其 import.meta.url 指向项目目录——那里没有 node_modules/@deepseek-ai，
 * `createRequire(import.meta.url)` 直接 MODULE_NOT_FOUND。
 *
 * 因此按「最近 → 最远」依次尝试多个解析根，并把每个根的错误码收集起来：全部失败时日志能
 * 直接指出是哪一环断的，而不是只报一句「设置用不了」。
 */
const DEP_PACKAGES = {
  schema: '@deepseek-ai/schemastery'
};

/** 解析根候选：插件的真实路径、宿主进程入口、cwd、DSH_DEPS_DIR、DSH_HOME。 */
const resolverRoots = () => {
  const roots = [];
  const push = (label, base) => {
    if (typeof base === 'string' && base.length > 0) roots.push({ label, base });
  };
  push('插件自身', import.meta.url);
  push('宿主进程入口', process.argv[1]);
  push('工作目录', path.join(process.cwd(), 'package.json'));
  const depsDir = process.env.DSH_DEPS_DIR;
  push('DSH_DEPS_DIR', depsDir ? path.join(depsDir, 'package.json') : null);
  const dshHome = process.env.DSH_HOME || path.join(homedir(), '.dsh');
  push('DSH_HOME/profile', path.join(dshHome, 'profiles', 'node_modules', 'package.json'));
  return roots
};

/**
 * 按 {@link resolverRoots} 的顺序解析一个包。
 * @param pkg - 包名。
 * @returns {{ok: true, path: string, root: string} | {ok: false, failures: string[]}}
 */
const resolveDep = (pkg) => {
  const failures = [];
  for (const root of resolverRoots()) {
    try {
      const req = createRequire(root.base);
      return { ok: true, path: req.resolve(pkg), root: root.label }
    } catch (e) {
      failures.push(`${root.label}(${e && e.code ? e.code : (e && e.message) || e})`);
    }
  }
  return { ok: false, failures }
};

/** 解析结果（模块作用域，供 Config 与诊断共用）。 */
let zMod = null;
let schemaSource = null;
let schemaError = null;
try {
  const resolved = resolveDep(DEP_PACKAGES.schema);
  if (!resolved.ok) {
    schemaError = `解析 DSH 运行时依赖失败：${DEP_PACKAGES.schema} ← ${resolved.failures.join(' / ')}`;
  } else {
    // 用 import() 而不是 require()：宿主用 Promise.all 并发加载插件，那一刻 ESM 依赖可能
    // 还没求值完，同步 require 会抛 ERR_REQUIRE_ESM_RACE_CONDITION（而且发生在模块求值期，
    // 同步路径上无法重试）。顶层 await 会等它求值完。
    const mod = await import(pathToFileURL(resolved.path).href);
    zMod = mod.default ?? mod;
    schemaSource = resolved.root;
    if (typeof zMod?.object !== 'function') {
      schemaError = `解析到 ${resolved.path}（经 ${resolved.root}），但它没有 z.object —— 不是 schemastery？`;
      zMod = null;
    }
  }
} catch (e) {
  schemaError = `已解析到路径但加载失败：${(e && e.code ? e.code + ': ' : '') + ((e && e.message) || e)}`;
  zMod = null;
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
 * 插件其余部分（按键/灯光）照常工作，诊断（/omkb/state 的 settings.error）会说清原因。
 */
const Config = zMod
  ? zMod.object({
    /** 灯光亮度 0..1。 */
    brightness: zMod.number().min(0).max(1).default(OMKB_DEFAULTS.brightness).volatile(),
    /** 空闲自动调暗秒数，0 = 关闭。 */
    autoDim: zMod.number().min(0).default(OMKB_DEFAULTS.autoDim).volatile(),
    /**
     * 键帽覆盖：动作键 id（ACT06..ACT12）→ 选定的键帽 id（如 'ACT07'）。
     * 值域与客户端 OMKB_KEYCAPS 的 id 一致；留空表示用物理键的出厂标签。
     */
    actLabels: zMod.dict(zMod.string()).default(OMKB_DEFAULTS.actLabels).volatile(),
    /**
     * 模拟摇杆映射：{ up, right, down, left } → 动作名（取值域与出厂值见客户端
     * src/client/config/default.js 的 JOY_ACTION / JOY_DEFAULTS）。
     * 动作名是开放集合（含技能名），故用自由字典而非枚举；
     * 'none' 表示该方向不绑定任何动作（不能用 null：dict<string> 校验会拒掉）。
     */
    joystick: zMod.dict(zMod.string()).default(OMKB_DEFAULTS.joystick).volatile(),
    /** 智能体键映射模式。 */
    agentKey: zMod.union(AGENT_KEY_MODES).default(OMKB_DEFAULTS.agentKey).volatile(),
    /** 自定义分配：槽位(0..5) → 会话 id（键按字符串存储）。 */
    agentAssign: zMod.dict(zMod.string()).default(OMKB_DEFAULTS.agentAssign).volatile(),
    /** 旋钮模式。 */
    knob: zMod.union(KNOB_MODES).default(OMKB_DEFAULTS.knob).volatile(),
    /** 自定义旋钮分配：{ cw, ccw, click, long } → 动作名。 */
    knobCustom: zMod.dict(zMod.string()).default(OMKB_DEFAULTS.knobCustom).volatile(),
    /** 独立麦克风宽键。 */
    micKey: zMod.boolean().default(OMKB_DEFAULTS.micKey).volatile(),
    /**
     * 首次连接引导看过了没有（客户端 GuideController 在用户跳过/走完时写 true）。
     * 落在这里而不是 localStorage：它是「这台键盘的引导」而不是「这个浏览器的引导」，
     * 换台机器 / 重装浏览器不该再来一遍。重置布局会清掉它（于是下次连上再弹一次）。
     */
    guideSeen: zMod.boolean().default(OMKB_DEFAULTS.guideSeen).volatile(),
    /**
     * 「这台键盘已被移除」（客户端 DeviceController 在用户确认移除时写 true）。
     *
     * 它**不是偏好**：不出现在界面上，也不该被「重置布局」清掉 —— 唯一的清法是
     * 「设备重新连上」（那时界面放回来、标记也一并清掉，见 src/client/device.js）。
     * 为什么必须落盘：它决定「设置页分区与侧边栏入口要不要收起来」，
     * 只记在浏览器里的话，一次刷新（或换浏览器）界面就又冒出来了 —— 用户看到的是
     * 「点了移除没用」。移除时清空的是**其余全部字段**，这个标记自己留着。
     */
    removed: zMod.boolean().default(OMKB_DEFAULTS.removed).volatile()
  })
  : undefined;

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
function readConfig(config) {
  const src = config && typeof config === 'object' ? config : {};
  const out = {};
  for (const key of Object.keys(OMKB_DEFAULTS)) {
    const v = src[key];
    if (v === undefined || v === null) out[key] = OMKB_DEFAULTS[key];
    else if (typeof v === 'object' && typeof v.get === 'function') {
      const inner = v.get();
      out[key] = inner === undefined ? OMKB_DEFAULTS[key] : inner;
    } else out[key] = v;
  }
  return out
}

/** 硬件侧真正消费的两个字段（其余字段只影响浏览器行为）。 */
function readHardwarePrefs(section) {
  const src = section && typeof section === 'object' ? section : {};
  return {
    brightness: clamp01(src.brightness),
    autoDim: Number.isFinite(src.autoDim) ? Math.max(0, src.autoDim) : 0
  }
}

/**
 * schema 里到底标了几个 volatile 字段。
 *
 * 不去数 OMKB_DEFAULTS 的键数：那样「漏标 volatile」这种错误就永远断言不出来
 * （整条链恰好死在那一处）。这里读的是**真的 schema**（toJSON → refs 里翻 meta）。
 * @returns {{total: number, volatile: number}}
 */
function countVolatileFields() {
  const out = { total: 0, volatile: 0 };
  if (!Config || typeof Config.toJSON !== 'function') return out
  let json;
  try { json = Config.toJSON(); } catch (e) { return out }
  const root = json && json.refs ? json.refs[json.uid] : null;
  if (!root || !root.dict) return out
  for (const uid of Object.values(root.dict)) {
    const node = json.refs[uid];
    if (!node) continue
    out.total += 1;
    if (node.meta && node.meta.volatile === true) out.volatile += 1;
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
function createSettingsProbe() {
  const startedAt = Date.now();
  /** 探测延迟：避开「apply 期间自己还没 active」那段（describe 只收 state===2 的条目）。 */
  const PROBE_DELAY_MS = 1200;
  let service = null;
  let served = null;
  let namespaces = null;
  let probeError = null;
  return {
    /**
     * 把 settings 服务交给探针（宿主 ctx.inject(['settings']) 里调）。
     * @param sctx - 带 settings 服务的上下文。
     */
    attach: (sctx) => { service = sctx && sctx.settings ? sctx.settings : null; },
    /**
     * 尝试（一次）把 describe() 里我们那条命名空间记下来。
     * 服务还没到 / 还没到时间 / 已经探过 → 直接跳过，不抛。
     * @param ctx - 宿主插件上下文（服务没 attach 时用它兜底取）。
     */
    tick: (ctx) => {
      if (served !== null) return
      let svc = service;
      if (!svc) {
        try { svc = ctx && typeof ctx.get === 'function' ? ctx.get('settings') : null; } catch (e) { svc = null; }
      }
      if (!svc || typeof svc.describe !== 'function') return
      if (Date.now() - startedAt < PROBE_DELAY_MS) return
      try {
        const rows = svc.describe() || [];
        namespaces = rows.map((r) => r && r.ns).filter((n) => typeof n === 'string');
        served = namespaces.includes(OMKB_NAMESPACE);
      } catch (e) {
        probeError = (e && e.message) || String(e);
      }
    },
    /** @returns 诊断快照（挂在 /omkb/state 的 settings 上）。 */
    diagnose: () => {
      const fields = countVolatileFields();
      return {
        // 契约代号：这一版是「条目 Config + volatile」。下次 DSH 再改，这行字直接指路。
        api: 'Config(volatile)',
        via: 'config',
        namespace: OMKB_NAMESPACE,
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

// dsh-omkb · 宿主侧「输入监控」授权检测（仅 macOS）
//
// 目标：如实回答「DeepSeek Harness 这条进程链有没有拿到系统授权」，而不是在界面上写死
// 一句「请在系统设置授权」。
//
// ── 为什么是这么实现的（踩过的路，别再走回去）────────────────────────────────
// 1. **读 TCC 数据库**（`~/Library/Application Support/com.apple.TCC/TCC.db`）最直观，
//    但实测 `sqlite3` 打开它直接 `authorization denied`（要「完全磁盘访问」才行）。
//    宿主的运行环境通常没有，所以这条路不可用。
// 2. **在 Node 里直接调** `CGPreflightListenEventAccess()` 不行：它是 CoreGraphics 的 C
//    函数，没有 native addon 就够不着，`process.dlopen` 也只能加载 N-API addon。
// 3. **实测可行**：macOS 自带 `osascript` 的 JXA（JavaScript for Automation）可以
//    `ObjC.import('CoreGraphics')` + `ObjC.bindFunction(...)` 绑定并调用这个 C 函数：
//        osascript -l JavaScript -e 'ObjC.import("CoreGraphics");
//            ObjC.bindFunction("CGPreflightListenEventAccess",["bool",[]]);
//            $.CGPreflightListenEventAccess()'   →   true / false
//    （注意：直接 `$.CGPreflightListenEventAccess` 是 undefined，**必须**先 bindFunction。）
// 4. TCC 的判据是 **responsible process**：从宿主 spawn 出去的子进程，问的就是宿主这条
//    进程链的授权 —— 正是我们想展示的那个答案。若 DSH 是从终端起的，那条链上的授权者
//    就是终端 / DSH 自己，这也正是它实际受影响的对象。
// 5. 用的是 **preflight**（只查询，绝不触发系统弹窗）；请求授权的 `CGRequestListenEventAccess`
//    我们**不调**，免得插件一加载就弹窗。
// 6. 辅助功能（Accessibility）顺带查一下（`AXIsProcessTrusted`），它和输入监控是两个
//    独立权限，界面上可以分别说明。
//
// 三态：granted=true 已授权 / granted=false 未授权 / granted=null 无法判定（非 mac、
// 没有 osascript、执行超时、输出解析不了）。**不知道就说不确定**，别猜。


/** 平台判定：只有 macOS 有「输入监控」这个权限概念。 */
const isSupportedPlatform = (platform = process.platform) => platform === 'darwin';

/** 系统设置里「输入监控」面板的深链（`open` 命令用）。 */
const PRIVACY_PANE_URLS = {
  listen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
};

/**
 * JXA 脚本：查询输入监控 + 辅助功能授权。
 * 写成一行直接用 `osascript -e` 传（参数走 argv 数组，不需要 shell 转义）。
 */
const MONITOR_JXA = [
  "ObjC.import('CoreGraphics')",
  'ObjC.bindFunction("CGPreflightListenEventAccess",["bool",[]])',
  'var r={}',
  'try{r.listen=$.CGPreflightListenEventAccess()}catch(e){r.errListen=String(e)}',
  "try{ObjC.import('ApplicationServices');r.ax=$.AXIsProcessTrusted()}catch(e){r.errAx=String(e)}",
  'JSON.stringify(r)'
].join(';');

/**
 * 解析 osascript 的输出（纯函数，自检直接喂样本）。
 * @param stdout - osascript 的 stdout。
 * @returns {{granted: boolean|null, accessibility: boolean|null, detail: string}}
 */
const parseMonitorOutput = (stdout) => {
  const text = String(stdout == null ? '' : stdout).trim();
  if (!text) return { granted: null, accessibility: null, detail: '查询没有返回内容' }
  let obj = null;
  // osascript 可能把警告也打到 stdout，所以取最后一行花括号内容来解析。
  const line = text.split('\n').map((s) => s.trim()).filter(Boolean).pop() || '';
  try { obj = JSON.parse(line); } catch (e) { return { granted: null, accessibility: null, detail: '无法解析查询结果：' + line.slice(0, 120) } }
  if (!obj || typeof obj !== 'object') return { granted: null, accessibility: null, detail: '查询结果不是对象' }
  const asBool = (v) => (v === true ? true : v === false ? false : (typeof v === 'number' ? v !== 0 : null));
  const granted = asBool(obj.listen);
  const accessibility = asBool(obj.ax);
  const detail = granted === null
    ? ('查询失败：' + (obj.errListen || 'CoreGraphics 未返回结果'))
    : (granted ? '系统已授权输入监控' : '系统未授权输入监控');
  return { granted, accessibility, detail }
};

/**
 * 执行一次授权检测。
 * @param opts.spawnFn - 可注入的 spawn（自检用假进程）。
 * @param opts.timeoutMs - 超时（默认 2500ms：osascript 正常几十毫秒就回来）。
 * @param opts.platform - 可注入平台（自检用）。
 * @returns {Promise<{supported: boolean, granted: boolean|null, accessibility: boolean|null,
 *   method: string, detail: string}>}
 */
const probeInputMonitor = async (opts = {}) => {
  const platform = opts.platform || process.platform;
  const supported = isSupportedPlatform(platform);
  if (!supported) {
    return { supported: false, granted: null, accessibility: null, method: 'unsupported', detail: `当前系统是 ${platform}，只有 macOS 有输入监控权限` }
  }
  const spawnFn = opts.spawnFn || spawn;
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 2500;
  return new Promise((resolve) => {
    let child = null;
    let settled = false;
    const done = (result) => { if (!settled) { settled = true; resolve(result); } };
    const timer = setTimeout(() => {
      try { if (child) child.kill(); } catch (e) {}
      done({ supported: true, granted: null, accessibility: null, method: 'timeout', detail: `查询超时（${timeoutMs}ms）` });
    }, timeoutMs);
    timer.unref?.();

    try {
      child = spawnFn('/usr/bin/osascript', ['-l', 'JavaScript', '-e', MONITOR_JXA], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      clearTimeout(timer);
      done({ supported: true, granted: null, accessibility: null, method: 'unavailable', detail: '无法执行 osascript：' + ((e && e.message) || e) });
      return
    }

    let out = '';
    let err = '';
    if (child.stdout && child.stdout.on) child.stdout.on('data', (c) => { out += c; });
    if (child.stderr && child.stderr.on) child.stderr.on('data', (c) => { err += c; });
    child.on('error', (e) => {
      clearTimeout(timer);
      done({ supported: true, granted: null, accessibility: null, method: 'unavailable', detail: 'osascript 启动失败：' + ((e && e.message) || e) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) {
        done({ supported: true, granted: null, accessibility: null, method: 'failed', detail: `osascript 退出码 ${code}` + (err.trim() ? '：' + err.trim().slice(0, 160) : '') });
        return
      }
      const parsed = parseMonitorOutput(out);
      done({ supported: true, ...parsed, method: 'jxa' });
    });
  })
};

/** 打开系统设置的隐私面板（`open` 命令，argv 数组传参，无 shell 转义问题）。 */
const openPrivacyPane = (pane = 'listen', spawnFn = spawn) => {
  const url = PRIVACY_PANE_URLS[pane] || PRIVACY_PANE_URLS.listen;
  return new Promise((resolve) => {
    try {
      const child = spawnFn('open', [url], { stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    } catch (e) { resolve(false); }
  })
};

/**
 * 带缓存的检测器：设置页会按几秒的间隔轮询，没必要每次都 spawn 一个 osascript。
 * @param opts.ttlMs - 缓存有效期（默认 4000ms）。
 */
const createMonitorProbe = (opts = {}) => {
  const ttl = Number.isFinite(opts.ttlMs) ? opts.ttlMs : 4000;
  let cached = null;
  let at = 0;
  let inflight = null;
  return {
    /** 读一次（命缓存直接返回）。@param force - 忽略缓存强制重测。 */
    read: (force = false) => {
      const now = Date.now();
      if (!force && cached && now - at < ttl) return Promise.resolve(cached)
      if (inflight) return inflight
      inflight = probeInputMonitor(opts).then((r) => {
        cached = r;
        at = Date.now();
        inflight = null;
        return r
      }, (e) => {
        inflight = null;
        const r = { supported: isSupportedPlatform(opts.platform || process.platform), granted: null, accessibility: null, method: 'error', detail: (e && e.message) || String(e) };
        cached = r;
        at = Date.now();
        return r
      });
      return inflight
    }
  }
};

// dsh-omkb · 宿主侧（Host）入口
// 职责：
//   1. 加载 BLE/HID 读取器（src/host/core/ble.js）：用 node-hid 读 omkb 小键盘，
//      按 name='omkb' & manufacturer='OM' 匹配设备，解析按键（AG00..AG05 智能键、
//      ACT06..ACT12 动作键），并把触发计数器/按键码暴露到 GET /omkb/state。
//   2. 注册 /omkb/archive：归档当前会话（宿主 workspaceRegistry.archiveSession）。
//   3. 声明 `dsh-omkb` 设置命名空间：由本模块导出的 Config 承载（见 ./settings.js），
//      落盘在 profile 的 patch 文件里；影响硬件的字段（亮度/自动调暗）回灌到 BLE。
//   4. 浏览器客户端轮询 /omkb/state，按键变化即切换会话/语音/发送等。
//   5. 订阅宿主总线的 agent/error（运行失败 → 红灯 + 状态码 3）、agent/turn-stopping（跑完一轮
//      → 状态码 2）与 agent/status（该会话重新开跑 → 收掉上面那个结果态）。前两者是**结果态、
//      不会自己变回去**（用户 2026-09-25 要求「错误后不变白」），只有第三个会解除它。
//   6. 退出安全网（见 ./guard.js）：设备句柄会持有事件循环，握上它之后要保证
//      Ctrl+C 依然能把进程带走 —— 宿主启动失败时也一样。**清理通道先于 open() 就位**。


const ARCHIVE_PATH = '/omkb/archive';
/** 输入监控授权检测（仅 macOS；见 ./monitor.js 顶部注释里「为什么这么做」）。 */
const MONITOR_PATH = '/omkb/monitor';
/** 打开系统设置的隐私面板（浏览器不能 spawn，只能由宿主代劳）。 */
const PRIVACY_PATH = '/omkb/open-privacy';
const JSON_HEAD = { 'content-type': 'application/json; charset=utf-8' };

const name = 'dsh-omkb';

// 设置诊断探针（只读，不改行为）：把「schema 建起来没有 / 字段都标 volatile 没有 /
// 宿主 describe() 里有没有我们这条命名空间」报给 /omkb/state。
// 命名空间本身由上面导出的 Config 承载，这里没有注册动作可做。
const settingsProbe = createSettingsProbe();

/**
 * 插件主体。
 * @param ctx - 宿主插件上下文。
 * @param config - loader 按我们导出的 Config 解析好的插件配置。volatile 字段在这里是
 *   引用对象（`.get()` 取值），一律经 settings.js 的 readConfig 摊平后再用。
 */
function apply(ctx, config) {
  const logger = ctx.logger('omkb');
  logger.info('[omkb] 蓝牙 HID 小键盘插件已加载（name=omkb, manufacturer=OM）');
  // 同一件事也写进**我们自己的**出口（见 ./log.js）：正式版终端是安静的，日志文件里
  // 必须留下「这一轮是什么时候起的、跑的是哪个版本」，否则那份文件只剩中间过程。
  logSink.info('蓝牙 HID 小键盘插件已加载（name=omkb, manufacturer=OM）');

  // 宿主把这份诊断挂到 GET /omkb/state 上：settings.served === true 才代表宿主真的
  // 在服务我们这条命名空间（终端日志不一定会转发到 stdout，这里由 HTTP 说话）。
  const ble = createBleReader({ logger, diagnostics: () => settingsProbe.diagnose() });

  // ---- 清理通道：**必须先于 ble.open() 就位** ----
  // 打开着的 HID 设备会持有事件循环引用（见 ./guard.js）。宿主启动失败时往往还没
  // 走到「清理插件」这一步就停了，如果这份 dispose 是 open() 之后才挂上的，设备句柄就
  // 没人关 → 事件循环永远排不空 → 进程挂着不动、Ctrl+C 也没反应（用户看到的就是
  // 「整个 dsh 卡死杀不掉」）。所以顺序必须是：先挂清理，再握资源。
  // 连带地，这些 dispose* 变量都得先声明 —— 否则 dispose 提前触发会在闭包里踩 TDZ。
  let disposeRoute = null;
  let disposeArchive = null;
  let disposeMonitor = null;
  let disposePrivacy = null;
  ctx.on('dispose', () => {
    // 原来是一句裸的 `console.log('dispose')`（连 [omkb] 前缀都没有）：走日志出口，
    // 正式版才不至于在插件卸载时往终端漏一行。
    logSink.info('dispose');
    // ble.dispose() 不只是关句柄：它会**先关灯、再关句柄**（把键盘 LED 全熄，见 ble.js 的
    // blackout/#lightsOff）—— 设备不会因为 BLE 断开自己熄灭，不关的话就是
    // 「app 都关了、键盘还亮着」。这条只在应用关闭时发生，断开连接（掉线/重连）不关灯。
    // ⚠ 这只是灭灯的**两个落点之一**：Ctrl+C / SIGTERM 这类进程级退出走的是 exit-guard
    // （宿主可能来不及走到这里），见 ./guard.js 顶部「退出前必须灭灯」。
    ble.dispose();
    if (disposeRoute) { try { disposeRoute(); } catch (e) {} }
    if (disposeArchive) { try { disposeArchive(); } catch (e) {} }
    if (disposeMonitor) { try { disposeMonitor(); } catch (e) {} }
    if (disposePrivacy) { try { disposePrivacy(); } catch (e) {} }
  });

  ble.open();

  // ---- 运行失败 → 对应键转红灯（结果态，一直亮着）----
  // 为什么订阅在这个事件上：宿主总线的 agent/error 是「真正的失败」的唯一出口。
  // dsh-agent-loop 的 turn() catch 里分了两条路——用户主动中断走 signal.aborted
  // 分支（只记 turn/end reason=aborted 后直接 throw），**不**发 agent/error；
  // 只有真失败才 throwError() → emit('agent/error')。所以按停止键不会转红。
  // 事件里的 agent.id 就是会话 id（DSH 里 agent 身份与会话 id 是同一根轴，
  // 宿主 apiproxy 也是拿 agent.id 当 sessionId 转发给浏览器的）。
  // 亮哪颗键由宿主自己定位：浏览器下发灯态时带了每槽的会话 id（见 ble.js #slotSessions）。
  ctx.effect(() => ctx.on('agent/error', ({ agent, error }) => {
    try {
      const id = agent && agent.id;
      if (!ble.reportError(id)) {
        logger.info(`[omkb] 会话 ${id} 运行失败，但它当前没有占键（不在侧边栏），不亮灯`);
      }
    } catch (e) {
      logger.warn('[omkb] 失败红灯下发异常:', e && e.message ? e.message : e);
    }
  }), 'omkb: agent error → LED');

  // ---- 跑完一轮 → 对应键报「成功」状态（同样是结果态）----
  // agent/turn-stopping 是「这一轮要收尾了」的钩子：dsh-agent-loop 在 turn 正常结束时
  // 用 `dispatch.serial` 发它。它天然就是「成功」的信号，**不需要再去比对 reason** ——
  // 用户主动中断（signal.aborted）与真正的失败（上面那条 agent/error）都在它**之前**就
  // throw 掉了，根本走不到这一步。所以拿它当「成功」是准的，不会把中断说成完成。
  //
  // 与失败一样，只报状态不改行为的边界都在宿主侧：浏览器只管「谁占哪颗键、平时什么状态」。
  // 返回 false（该会话没占键，比如后台跑的）是常事，不告警、也不刷日志。
  ctx.effect(() => ctx.on('agent/turn-stopping', ({ agent }) => {
    try {
      ble.reportSuccess(agent && agent.id);
    } catch (e) {
      logger.warn('[omkb] 成功状态下发异常:', e && e.message ? e.message : e);
    }
  }), 'omkb: agent turn done → LED status');

  // ---- 该会话重新开跑 → 收掉上面那个结果态 ----
  // 为什么订阅 agent/status 而不是等浏览器下发的 st=1：那是 agent loop 的**相位变化**
  // （setPhase → status 从 idle 变 running 才发，ds-agent-loop 里有「同值不许重发」的不变量），
  // 语义就是「这个会话又干活了」。而浏览器那份快照带 350ms 防抖，失败那一刻它手里往往还写着
  // 「这个会话在跑」——把它当判据会让红灯刚亮就被抹掉，正是这次要修的病。
  // 用户中断不会重新触发 running（相位已经回到 idle），所以中断过的会话结果态照旧保留。
  // 只在真收掉了东西时打日志：多数 agent/status 与灯无关，不该刷屏。
  ctx.effect(() => ctx.on('agent/status', ({ agent, status }) => {
    try {
      if (status !== 'running') return
      const id = agent && agent.id;
      if (ble.clearOutcome(id)) logger.info(`[omkb] 会话 ${id} 重新开始运行 → 收掉结果灯（红/成功）`);
    } catch (e) {
      logger.warn('[omkb] 结果灯收尾异常:', e && e.message ? e.message : e);
    }
  }), 'omkb: agent running → clear outcome LED');

  // ---- 设置持久化 ----
  // 命名空间与 schema 由本模块导出的 Config 承载（导出即注册，没有 installSection 可调）。
  // apply 收到的 config 就是宿主解析好的那份；volatile 字段是引用对象，readConfig 摊平。
  //
  // 偏好怎么回到硬件：**由 loader 就地提交**，不走「重新 apply」。
  // 标了 volatile 的字段改动时，loader 调 updateVolatile 写进同一个引用对象，再发
  // `loader/volatile-update`（见 cordis-plugin-loader 的 _commitVolatile）——所以这里只需
  // 订阅那个事件重扫一遍；ble.setPrefs 自己带变更检测，重复调用是安全的。
  // 反过来说：不订阅的话，在设置页拖亮度滑杆**设备不会有任何反应**（配置变了、插件不知道）。
  {
    const applyPrefs = () => {
      try {
        ble.setPrefs(readHardwarePrefs(readConfig(config)));
      } catch (e) {
        logger.warn('[omkb] 应用持久化偏好失败:', e && e.message ? e.message : e);
      }
    };
    applyPrefs();
    ctx.effect(() => ctx.on('loader/volatile-update', applyPrefs), 'omkb: 设置变更 → BLE');
  }

  // 让 DSH 不要为这条条目**再自动生成**一个设置页：本插件自带界面（settings.section
  // 分区的 'omkb'），两份入口只会让人以为「改这份没用」。
  // 用官方写法：configure 的第二个参数是「哪条条目」，默认是调用者自己的 fiber —— 显式传
  // ctx.fiber 以免 ctx 经代理后指向别处；重复配置会抛，所以必须包在 ctx.effect 里（卸载时
  // 自动撤销），并吞掉异常（这只是界面政策，失败不该连累按键）。
  try {
    ctx.inject(['settings'], (child) => {
      try {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
      } catch (e) {
        logger.warn('[omkb] 声明「自带设置页」失败（不影响功能，只影响设置里会不会多出一个自动页）:', e && e.message ? e.message : e);
      }
      try { settingsProbe.attach(child); } catch (e) {}
    });
  } catch (e) {
    logger.warn('[omkb] 等待 settings 服务失败:', e && e.message ? e.message : e);
  }

  // 延后一次探测：describe() 只收已经 active 的条目，apply 期间自己还没 active。
  // 转成 unref 的定时器，绝不因为这条诊断把进程留住。
  {
    const timer = setTimeout(() => { try { settingsProbe.tick(ctx); } catch (e) {} }, 1500);
    timer.unref?.();
  }

  // webServer 是依赖注入服务，必须通过 ctx.inject 声明后才能访问。
  ctx.inject(['webServer'], (wctx) => {
    disposeRoute = ble.registerRoute(wctx.webServer);

    // ---- 输入监控授权状态（仅 macOS）----
    // 浏览器侧读不到系统权限，必须由宿主去问系统；检测方式与三态语义见 ./monitor.js。
    // 走独立路由而不是塞进 /omkb/state：检测要 spawn 一个 osascript，而 state 是每秒被
    // 轮询的同步快照（塞进去会把每次轮询都变成一次进程启动）。
    const monitor = createMonitorProbe();
    try {
      disposeMonitor = wctx.webServer.register({
        kind: 'exact',
        path: MONITOR_PATH,
        handler: (req, res) => {
          if (req.method !== 'GET' && req.method !== 'POST') {
            res.writeHead(405, JSON_HEAD);
            res.end(JSON.stringify({ error: 'method not allowed' }));
            return
          }
          const force = /[?&]force=1/.test(String(req.url || ''));
          monitor.read(force).then(
            (r) => { res.writeHead(200, JSON_HEAD); res.end(JSON.stringify(r)); },
            (e) => { res.writeHead(500, JSON_HEAD); res.end(JSON.stringify({ supported: false, granted: null, detail: (e && e.message) || String(e) })); }
          );
        }
      });
    } catch (e) {
      logger.warn('[omkb] 输入监控路由注册失败:', e && e.message ? e.message : e);
    }

    // 「打开系统设置」按钮：浏览器不能启动进程，由宿主执行 open。
    try {
      disposePrivacy = wctx.webServer.register({
        kind: 'exact',
        path: PRIVACY_PATH,
        handler: (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, JSON_HEAD);
            res.end(JSON.stringify({ error: 'method not allowed' }));
            return
          }
          let body = '';
          req.on('data', (c) => { body += c; });
          req.on('end', () => {
            let pane = 'listen';
            try { pane = (JSON.parse(body || '{}').pane) || 'listen'; } catch (e) {}
            openPrivacyPane(pane).then((ok) => {
              res.writeHead(ok ? 200 : 500, JSON_HEAD);
              res.end(JSON.stringify({ ok }));
            });
          });
        }
      });
    } catch (e) {
      logger.warn('[omkb] 系统设置跳转路由注册失败:', e && e.message ? e.message : e);
    }

    // 归档：走宿主的 workspaceRegistry（官方「已归档聊天」机制，见 dsh-tauri-session）。
    // 服务可能因宿主版本缺失，这里不强依赖——可用才注册路由。
    let ws = null;
    try {
      ws = (typeof wctx.get === 'function' && wctx.get('workspaceRegistry')) || wctx.workspaceRegistry || null;
    } catch (e) {
      ws = null;
    }
    if (ws && typeof ws.archiveSession === 'function') {
      disposeArchive = wctx.webServer.register({
        kind: 'exact',
        path: ARCHIVE_PATH,
        handler(req, res) {
          if (req.method !== 'POST') {
            res.writeHead(405, JSON_HEAD);
            res.end(JSON.stringify({ error: 'method not allowed' }));
            return
          }
          let body = '';
          req.on('data', (c) => { body += c; });
          req.on('end', () => {
            try {
              const { sessionId } = JSON.parse(body || '{}');
              if (!sessionId) {
                res.writeHead(400, JSON_HEAD);
                res.end(JSON.stringify({ error: 'missing sessionId' }));
                return
              }
              Promise.resolve(ws.archiveSession(sessionId)).then(
                () => { res.writeHead(200, JSON_HEAD); res.end(JSON.stringify({ ok: true })); },
                (e) => { res.writeHead(500, JSON_HEAD); res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) })); }
              );
            } catch (e) {
              res.writeHead(400, JSON_HEAD);
              res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) }));
            }
          });
        }
      });
    } else {
      logger.warn('[omkb] 宿主未提供 workspaceRegistry.archiveSession，归档键不可用');
    }
  });
}

export { Config, apply, name };
