import { createRequire } from 'node:module';
import fs from 'node:fs';
import os, { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

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
// ── 三条不能犯的错（旧实现就是这么卡的）─────────────────────────────
//   1. **不在信号回调里同步 close()**：那是原生调用（IOKit），设备异常时会阻塞；而信号回调
//      一旦卡在它里面，后面每一次 Ctrl+C 都石沉大海 —— 我们自己在信号处理里堵住了自己。
//   2. **不重发信号**（不要 `process.kill(process.pid, sig)`）：重发会再打到自己，于是
//      「用户第二次按」与「我们自己的重发」无法区分，「再按一次就强制退出」也就实现不了。
//   3. **不装机即接管、永不放手**：不该在构造函数里注册去顶掉宿主的退出逻辑 ——
//      怎么退由宿主决定，我们只做减法。
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

// dsh-omkb · core/protocol.js
// **跨进程的线格式契约** —— 设备协议里那些「宿主与客户端、宿主与设备双方逐字一致」的
// 常量与纯解析函数。从 ble.js 分拆出来，因为它与「谁持有 HID 句柄」无关：
//   · 按键边沿词表 HID_ACT（浏览器按它区分「还按着」与「已经松开」）；
//   · 槽位状态码 AGENT_ST（浏览器 agents.js 的 AGENT_STATE 必须逐字一致）；
//   · 电量归一化/状态解析（纯函数，自检直接喂 JSON 验，见 test/verify_device.js）；
//   · 全灭槽位 BLACKOUT_SLOTS（关闭前写给设备的最后一份 thstatus）。
//
// 这里**没有状态、没有副作用、不碰设备** —— 任何一处改动都必须整条链一起看
// （加/删字段两边词表要同步，设备不会报错，只会按一个没人认得的数去分支）。

/**
 * 设备上报的 `params.act` —— **按键边沿**（一个物理键发一对事件）：
 *   1 = 按下、0 = 松开、2 = 脉冲（旋钮转过一格的瞬时事件，没有“按住”态）。
 * 长这样：`{"method":"v.oai.hid","params":{"k":"AG00","act":1,"ag":0}}`。
 * 老固件不带这个字段 → 一律按“按下”处理，行为与引入它之前逐字一致。
 */
const HID_ACT = { RELEASE: 0, PRESS: 1, PULSE: 2 };

/**
 * 设备状态上报的 method 名（电量就住在它的 params 里）：
 *   `{"method":"device.status","params":{"battery":12,"is_charging":false}}`
 * 和其它上报一样走 RPC 通道（channel=2），与按键/摇杆共用同一条 JSON 行流。
 */
const STATUS_METHOD = 'device.status';

/**
 * 电量百分比：**认不出来就返回 null**，绝不猜。
 *   - 0..100 的数字（或能转成数字的字符串）→ 四舍五入的整数；
 *   - 越界（负 / >100）→ null。固件真给了 255 这种「未知」编码时，界面上显示「—」
 *     比显示一个凭空的 100% 诚实；
 *   - 布尔值**必须拒掉**：`Number(true) === 1`，不挡的话 `is_charging` 被误当电量就是「1%」。
 * @param v - 设备给的原始值。
 * @returns {number|null} 0..100 的整数，或 null。
 */
const normalizeBattery = (v) => {
  if (typeof v === 'boolean' || v === null || v === undefined || v === '') return null
  if (typeof v !== 'number' && typeof v !== 'string') return null
  const n = Number(v);
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > 100) return null
  return Math.round(n)
};

/** 是否在充电：只认真正的布尔与 0/1，其余（undefined / 字符串）一律当「没在充」。 */
const normalizeCharging = (v) => v === true || v === 1;

/**
 * 从一条设备上报里取状态（**纯函数**，自检直接喂 JSON 验它，见 test/verify_device.js）。
 *
 * 认两条路：
 *   ① method 就是 `device.status`（大小写不敏感；允许厂商前缀，如 `v.oai.device.status`
 *      —— 已有上报都叫 `v.oai.*`，固件换个命名空间不该让界面永远显示「—」）；
 *   ② 任何 method，只要载荷里带着**合法**的 battery —— 电量只可能来自设备状态，
 *      多认这一条能省掉一次「固件改了 method 名 → 电池行一直空着」的排查。
 * 载荷取 `params`（设备主动上报的通知）**或** `result`（我们发了 RPC 之后设备给的应答）：
 * 宿主连上时会主动发一条 `device.status` 去问（见 transport.js #requestStatus），设备很可能按
 * JSON-RPC 的规矩回 `{"id":N,"result":{...}}` —— 那种消息**没有 method**，只认 `params` 就会把
 * 应答整条丢掉，界面永远显示「—」。
 * 两条都不成立 → null（调用方据此早返回，别让它落进按键链路去）。
 * @param msg - 已解析的一条上报对象。
 * @returns {{battery: number|null, charging: boolean}|null}
 */
const parseDeviceStatus = (msg) => {
  if (!msg || typeof msg !== 'object') return null
  const bag = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);
  const params = bag(msg.params) || bag(msg.result);
  if (!params) return null
  const method = typeof msg.method === 'string' ? msg.method.toLowerCase() : '';
  const named = method === STATUS_METHOD || method.endsWith('.' + STATUS_METHOD);
  const battery = normalizeBattery(params.battery);
  if (!named && battery === null) return null
  return { battery, charging: normalizeCharging(params.is_charging) }
};

// 说明：槽位的状态码 `st`（整数）有过一个来回 —— 2026-09-25 先按要求把整条链删掉
// （浏览器 payload / 宿主期望灯态 / 写给设备的 thstatus 全都不带 st），随后又按要求
// 以 **int** 形式加回来：空闲 0 / 运行 1 / 成功 2 / 失败 3（见 AGENT_ST）。
// 教训：这是**跨进程的线格式**，加/删都必须整条链一起动，且两边词表逐字一致（自检会断言）；
// 只往 thstatus 里塞回一个字段的话，设备会按一个没人认得的数去分支，而且不会有任何报错。

/**
 * 下发给设备的**槽位状态码**（整数）—— 就是 v.oai.thstatus 里每个槽位的 `st`。
 *
 * **必须与 `src/client/agents.js` 的 `AGENT_STATE` 逐字一致**（两边自检都会断言这两个表相等；
 * 改一边忘一边 = 设备按一个没人认得的数去分支，且不会有任何报错）。
 * 放在模块级而不是类里：它是跨进程的线格式约定，本来就不属于某个实例。
 */
const AGENT_ST = {
  IDLE: 0,    // 空闲 —— 会话在、没在跑
  RUNNING: 1, // 运行 —— agent loop 在跑
  SUCCESS: 2, // 成功 —— 刚跑完一轮（**宿主叠加**，见 leds.js reportSuccess）
  ERROR: 3    // 失败 —— 跑失败了（**宿主叠加**，见 leds.js reportError，同时把灯转红）
};
/**
 * 浏览器**只能**报这两种：成功/失败由宿主自己在结果态里叠加 —— 只有宿主收得到那条总线，
 * 也只有它分得清「用户主动中断」（不发 agent/error）与「真失败」。
 * 若允许浏览器发 ERROR，它会用一份自己并不知道真假的结论去覆盖宿主的判断，而灯并不红——
 * 设备那边看到的就是自相矛盾的一对（状态码说失败、颜色说正常）。
 */
const AGENT_ST_INBOUND = [AGENT_ST.IDLE, AGENT_ST.RUNNING];
/** 认不出 / 缺字段时回落到哪一档（老客户端不发 st，就是这个下场：空闲）。 */
const AGENT_ST_DEFAULT = AGENT_ST.IDLE;

/**
 * 「全灭」槽位 —— **整个应用关闭前**写给设备的最后一份 thstatus（6 个槽位的 c/b/e 全 0）。
 *
 * 为什么单独抽出来当契约：自检要能直接验这份形状（见 test/verify_blackout.js），
 * 而且「关闭时灭灯」这件事**不能**靠「把浏览器的灯态清空」来实现 —— 那样只在宿主
 * 重启时才成立，而关闭是插件卸载那一刻才发生的。
 * 深冻结：它是一份只读的字面量契约，谁都不许在运行时改它。
 */
const BLACKOUT_SLOTS = Object.freeze(
  Array.from({ length: 6 }, (_, id) => Object.freeze({ id, c: 0, b: 0, e: 0, st: AGENT_ST.IDLE }))
);

const require$1 = createRequire(import.meta.url);
class HidTransport {
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
  #state = null;
  #logger;
  #hid = null;
  #lineBuf = "";
  // 跨帧重组 buffer，按 '\n' 切 JSON 行
  #rpcId = 0;
  // 灯光/查询控制（Codex Micro 兼容协议）
  #onLine = null;
  #onOpened = null;
  #onBlackout = null;
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
  /** @param {{logger?: any, state: object, onLine: Function, onOpened?: Function, onBlackout?: Function, guard?: {release: Function, blackout: Function, log?: Function}}} [options] */
  constructor(options = {}) {
    const { logger = null, state = null, onLine = null, onOpened = null, onBlackout = null, guard = {} } = options;
    this.#logger = logger;
    this.#state = state;
    this.#onLine = onLine;
    this.#onOpened = onOpened;
    this.#onBlackout = onBlackout;
    const probe = Number(process.env.DSH_OMKB_PROBE_MS);
    if (Number.isFinite(probe) && probe >= 0) this.#probeMs = probe;
    this.#exitGuard = createExitGuard({
      release: guard.release,
      blackout: guard.blackout,
      log: guard.log || ((m) => this.#warn(m))
    });
  }
  // 自检用：拿到退出安全网句柄（`test/verify_exit_guard.js` / `test/lib/exit-guard-child.mjs`
  // 用它在不依赖真设备的前提下验证「信号到达时退不退、退得掉吗」）。
  get exitGuard() {
    return this.#exitGuard;
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
      this.#onOpened?.();
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
    this.#linkSeen = false;
    if (this.#probeTimer) {
      clearTimeout(this.#probeTimer);
      this.#probeTimer = null;
    }
  };
  // --- 设备走了之后属于「链路」、不属于「灯态」的那部分收尾，由上层 close() 调本方法后
  //     再让 leds 清自己的账（见 ble.js 的 close 与 leds.js 的 resetOnDisconnect）。
  // 断开后每 30 秒自动重连一次，直到设备重新可用（手动重连：先关再开）。
  reconnect = () => {
    this.close();
    this.open();
  };
  // recoverable 的收尾（插件卸载）：停重连/探活定时器 + 卸下安全网。
  // **不关句柄** —— 上层要先灭灯（唯一出口 #sendRpc 要看到活着的句柄才写得出去），
  // 灭完灯再由上层 close()。顺序见 ble.js 的 dispose。
  dispose = () => {
    if (this.#reconnectTimer) {
      clearInterval(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    if (this.#probeTimer) {
      clearTimeout(this.#probeTimer);
      this.#probeTimer = null;
    }
    this.#exitGuard?.dispose();
  };
  /**
   * 灭灯的对外落点（由上层 blackout 调用；自带「没连着就什么都不做」的守卫）。
   *
   * 故意写成**公有类字段**（和 close 同一套路）：自检脚本可以把它整个换成打印或计数器，
   * 以此观测「退出路径到底有没有灭灯」。
   * 真正的写灯实现在 leds.js（#onBlackout）—— 它必须**同步**写出去（退出路径上没有微任务）。
   * @returns {boolean} 是否真的写给设备了。
   */
  blackout = () => {
    if (!this.#hid || !this.#state.open) return false;
    return this.#onBlackout?.() || false;
  };
  // ---------- HID 写回：JSON-RPC 分帧写入（用于灯光/亮度/查询控制） ----------
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
  /** 上层（leds.js）写灯的入口 —— 只是 #sendRpc 的公有包装。 */
  writeRpc = (method, params) => this.#sendRpc(method, params);
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
  // 把一段 payload 追加进重组 buffer，按 '\n' 切出完整行处理
  #feed = (payload) => {
    this.#lineBuf += payload.toString("utf8");
    let idx;
    while ((idx = this.#lineBuf.indexOf("\n")) !== -1) {
      const line = this.#lineBuf.slice(0, idx);
      this.#lineBuf = this.#lineBuf.slice(idx + 1);
      if (line.length) {
        try {
          this.#onLine?.(line);
        } catch (e) {
          this.#warn(`丢弃异常行: ${e && e.message ? e.message : e}`);
        }
      }
    }
    if (this.#lineBuf.length > 4096) this.#lineBuf = "";
  };
}

// dsh-omkb · core/leds.js
// **灯态引擎** —— 「浏览器下发的期望灯态 + 宿主收到的结果态 ⇒ 实际写给设备的灯」。
// 从 ble.js 分拆出来：它是设备灯语（v.oai.rgbcfg / v.oai.thstatus）的**唯一出口**，
// 而「谁持有 HID 句柄」是 transport.js 的事 —— 本模块只会调 transport.writeRpc()。
//
// 分工：**浏览器**决定「哪个会话占哪颗键、平时什么颜色与状态」（它才知道会话列表），
// **宿主**决定「上一轮跑成了什么样」（它才收得到 agent/error 与 agent/turn-stopping，
// 也是唯一写 HID 的人）。浏览器下发的槽位带上会话 id（sid），宿主用它把事件定位到键。
//
// 三条主线（每条都带「一次只许发一条」的硬约束，**完整沿革与反证见技能 §2**）：
//   · **结果态**（失败转红 st=3 / 跑完一轮 st=2）**不会自己变回去**，直到该会话重新运行才收掉；
//   · **`st` 只报当前会话**（规则 1，见 `#currentSession`），判据压平在 `#stOfSlot` **只此一处**；
//     （「会话重新运行 → 6 槽 st 全空闲」的规则 2 自 2026-09-27 起停用，形态保留待恢复。）
//   · **三道防线**：① 同拍合并（`#pendingAgents`）② 跨拍内容去重（`#lastThstatus`）
//     ③ 结果态等浏览器那条（`#outcomeWindowMs`）。
//
// **进程要走了就把两组灯全部按灭**：设备会保留最后收到的灯效，不关就是「app 关了、键盘还亮着」。
// 两个落点：插件卸载（dispose）与**进程级退出**（Ctrl+C/SIGTERM/SIGHUP，见 ./guard.js 的 blackout
// 回调 —— 那条路常常等不到 dispose）。灭灯**必须同步写出去**，所以走 `#sendThstatus` 而不是合并
// 闸门（「exit」钩子里微任务根本不会跑）。
// ⚠ **断开连接（close）时刻意不灭灯** —— 断开随时会重连，在那里关灯只换来「重连之后黑一片」。


class LedEngine {
  #state = null
  #transport = null
  #logger
  #errorColor = 0xff0000 // 默认红；浏览器可用 payload.errorColor 覆盖（调色板在 src/client/agents.js）

  // ---------- 浏览器下发的期望灯态 ----------
  // 槽位里带上会话 id（sid），宿主靠它把 agent/error 这类事件定位到具体那颗键。
  #desiredAgents = [] // 浏览器下发的期望灯态（设备字段 + 会话 id 元数据）
  #slotSessions = [] // 槽位下标 → 会话 id
  /**
   * **当前会话** = 主视图正在看的那一条（DSH 官方判据 `retainedBy.mainView > 0`；客户端由
   * `src/client/utils/session-list.js` 的 `currentSessionIdIn` 算出来，随 POST /omkb/agents
   * 的 `current` 字段报上来）。
   *
   * **当前会话** = 主视图正在看的那一条（DSH 官方判据 `retainedBy.mainView > 0`；**只有浏览器算得
   * 出来** —— 由 `utils/session-list.js` 的 `currentSessionIdIn` 算出，随 `current` 字段报上来）。
   *
   * ⚠ **规则 1**：`st` 只报当前会话占的那颗键，其余槽位一律 `IDLE`，**颜色照旧**（别的会话在跑
   * 就还是蓝的，那由 `c` 说）。判据压平在 `#stOfSlot`，全项目**只此一处**。
   * （规则 2「会话重新运行 → 6 槽 st 全空闲」自 2026-09-27 起停用，形态留着待恢复。）
   *
   * ⚠ `#currentKnown` 区分两种「没有」——**缺 ≠ 空**：`false` = 老客户端压根没报这个字段 →
   * **不替它压平**（逐槽照旧，与改动前逐字节一致）；`true` + `null` = 报了、只是主视图此刻没会话
   * → 6 槽全空闲。
   *
   * 详见技能 §2「st 只报当前会话」。
   */
  #currentSession = null
  #currentKnown = false
  /**
   * 上一次**报过的真实会话 id**（`null` 报告不覆盖它）—— 只服务**日志**那一行「切会话：X → Y」。
   *
   * ⚠ 「切会话」只认**两个真实会话 id 之间**：浏览器在主视图重渲染的**间隙**会短暂报一次 `null`，
   * 把它也算变化，一次真实切换就被打成 A → null → B **两条**。所以 `null` =「不知道 / 暂时没有」，
   * 不是一次用户切换。「写不写设备」现在全由**内容**说了算，本字段不参与任何写判定。
   *
   * 详见技能 §2「`#currentSeen`」。
   */
  #currentSeen = null
  /**
   * 「同拍合并」的暂存位（三道防线的第一道，见 `#renderAgents`）。
   *
   *   `#pendingAgents`   —— 算好但还没写出去的那一份参数（null = 没东西待写）
   *   `#agentsScheduled` —— 当前这一拍是否已经排过写入（排过就只覆盖内容，不再排第二次）
   *   `#pendingForce`    —— 这一份是不是**结论**驱动的（是则不许被内容去重挡下）
   *
   * ⚠ 同一拍里多个来源都会重画（宿主的 error/status 连着来、`allIdle` 翻转顺手唤醒亮度），
   * 逐条写 = 设备一口气收到好几条 `thstatus`（每条要切成 5 帧 63 字节的 HID 报告）。
   * 沿革见技能 §2「一次只发一条」。
   */
  #pendingAgents = null
  #agentsScheduled = false
  /**
   * 待写的这一份是不是**结论**驱动的 —— 是则**必须真发出去**，不许被内容去重挡下。
   *
   * ⚠ 结论是**事件**，不是「此刻的样子」：红色为宿主独占（浏览器那份改不动），于是同一个会话
   * 连续失败两次算出的报文**逐字节相同**，不绕过去重就是「第二次失败设备根本不知道」。
   * 只给 **error** 开口子 —— success 的颜色要等浏览器更正，且两次颜色本就不同，用不着。
   * ⚠ 跟着**内容**走（谁后到谁赢，与 `#pendingAgents` 同语义）。切会话曾是本字段的第二个来源，
   * 2026-09-27 已撤回：强制写对「内容不同 / 相同」两种下落都只能产生重复。
   *
   * 三轮取舍与反证见技能 §2「一次只发一条 → 结论不吃内容去重」。
   */
  #pendingForce = false
  /**
   * 上一次**真正写出去**的那条 `v.oai.thstatus` 长什么样（JSON 字符串，用来比对内容）。
   *
   * ⚠ 第二道防线：同拍合并只管**同一拍**，挡不住同一份内容**跨拍**被推两次（宿主结论与浏览器
   * 那份快照错开到达，内容却完全一样）。设备没必要听两遍。
   * ⚠ 只在**写成功之后**更新（失败时不动，下次同内容仍会尝试）；`resetOnDisconnect()` 清空 ——
   * 「链路断了」是唯一必须忘掉「上次发过什么」的时刻（重连要重放）。
   */
  #lastThstatus = null
  /**
   * **结果态的等待窗口**（毫秒）—— 结果态**不立刻下发**，先等一个窗口。
   *
   * ⚠ **为什么**：「会话状态变了」有**两条速率不同的通道** —— 宿主的事件是即时的，浏览器那份带
   * 350ms 防抖且要等列表重算，同一个物理时刻它晚 350ms 以上才到。不等就是拿**旧颜色**写一条
   * 抢跑态（实测一次「跑完一轮」设备收到 3 条，中间那条纯属抢跑）。
   * ⚠ **窗口到点 ≠ 可以写**：要先确认浏览器那条真到了（看待写内容有没有被消费掉），
   * 窗口只是「回头看一眼」的检查点 —— 取值因此不需要「比对方长」。一直不来由 `#outcomeMaxMs` 兜底。
   *
   * 诊断面不受影响（`#state.agents` 仍在同一拍同步更新）。0 = 立即写（`DSH_OMKB_OUTCOME_MS` 覆盖）。
   * 两轮演化与反证见技能 §2「一次只发一条 → 第三道防线」。
   */
  #outcomeWindowMs = 500
  /**
   * 等浏览器那条的**硬上限**（毫秒）—— 从**首次**开窗算起，不因期间又来结论而重排。
   *
   * 为什么必须有：「等对方」的判据对面可能**永远不来**（页面关了 / 崩了 / 被挂起）。
   * 没有上限就变成「灯一直不变」，那是用户明确反对的另一头。
   * 为什么是 2s：正常路径下浏览器那条 350ms~1s 内必到（防抖 + 渲染 + 后台节流），
   * 2s 已是「这次真的不会来了」的量级；再长只会让「页面关了」的场景更迟钝。
   * `DSH_OMKB_OUTCOME_MAX_MS` 覆盖（自检要调小，否则每节都得多等 2 秒）。
   */
  #outcomeMaxMs = 2000
  /** 当前这轮结果态**首次**开窗的时刻（0 = 没在等）。算 `#outcomeMaxMs` 的起点，**不重排**。 */
  #outcomeSince = 0
  /** 结果态窗口的定时器（null = 窗口没开）。见 #outcomeWindowMs / #deferAgentsWrite。 */
  #outcomeTimer = null
  /**
   * 槽位下标 → { sid, kind }，**结果态**（kind: 'error' | 'success'）。
   *
   * ⚠ **它不会自己过期**（2026-09-25 用户要求：「错误后不变白」）。原来的实现是 3 秒窗口，
   * 到点自动回到浏览器下发的常态；现在一直挂着，直到下面三件事之一发生：
   *   1. 该会话**重新开始运行** → 用户重试了，`clearOutcome()`（宿主 agent/status=running 驱动）；
   *   2. 该会话从槽位上消失（归档 / 关掉 / 被别的会话顶掉，见 applyAgents 的整表重建）；
   *   3. 同一颗键上来了**更新的结论**（又失败一次 / 这回跑成功了，后写覆盖先写）。
   *
   * 「到点自动消失」这件事**不能靠浏览器重新下发来替代**：失败那一刻浏览器快照里这个会话
   * 常常还写着 running（它的推送还带 350ms 防抖），拿浏览器下发的 st 当清除判据，红灯会在
   * 亮起的同一瞬间被自己的陈旧快照抹掉。清除只认宿主的 agent/status（见 applyAgents 的注释）。
   *
   * 两种表现：
   *   'error'   —— 状态码 st=3，**并且**把颜色换成红灯（用户可见的「上次失败了」）
   *   'success' —— 状态码 st=2，颜色不动（跑完了是正常态，不该抢眼的颜色）
   */
  #outcome = new Map()

  // ---------- 电源/空闲（自动调暗）----------
  #dimmed = false // 是否已因空闲而自动调暗
  #lastActivity = Date.now()
  /**
   * 浏览器上报的「所有会话都空闲」（null = 还没上报过 / 老客户端）。
   * 自动调暗按它计时：**会话全空闲**才是真的没事干；有会话在跑就不该关灯。
   */
  #allIdle = null
  #idleSince = 0 // 进入「全空闲」的时刻（0 = 未知）
  #dimTimer = null

  /** @param {{logger?: any, state: object}} [options] */
  constructor(options = {}) {
    const { logger = null, state = null } = options;
    this.#logger = logger;
    this.#state = state;
    // 结果态窗口（见 #outcomeWindowMs）：自检设 0 退回「同拍合并后立刻写」的老路径。
    const outcome = Number(process.env.DSH_OMKB_OUTCOME_MS);
    if (Number.isFinite(outcome) && outcome >= 0) this.#outcomeWindowMs = outcome;
    // 等浏览器那条的硬上限（见 #outcomeMaxMs）：自检调小，否则每节都得多等 2 秒。
    const outcomeMax = Number(process.env.DSH_OMKB_OUTCOME_MAX_MS);
    if (Number.isFinite(outcomeMax) && outcomeMax > 0) this.#outcomeMaxMs = outcomeMax;
    this.#dimTimer = setInterval(() => this.#autoDimCheck(), 1000);
    this.#dimTimer.unref();
  }

  /** 装配后注入传输层（写灯的唯一出口）—— 构造顺序上 transport 依赖 leds 的 lightsOff，故后接。 */
  attach = (transport) => { this.#transport = transport; }

  #log = (...a) => { try { this.#logger?.['info']?.(...a); } catch (e) {}; logSink.info(...a); }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a); } catch (e) {}; logSink.warn(...a); }

  // ---------- 电源：亮度 / 自动调暗 ----------
  /** 有输入活动（input.js 每次入站都报）—— 自动调暗的计时基准。 */
  markActivity = (now = Date.now()) => { this.#lastActivity = now; }

  /**
   * 从「空闲调暗」状态恢复亮度。两处会调用：按下任意键（input.js #bump）、会话重新开始运行（applyAgents）。
   * 恢复时连灯态一起重放：调暗期间 #sendThstatus 是把灯压灭的（见它的实现），
   * 只写回亮度而不重放灯态的话，Agent 键会一直黑着。
   * @returns {boolean} 是否真的从调暗状态恢复。
   */
  wake = () => {
    if (!this.#dimmed) return false
    this.#dimmed = false;
    if (this.#state.brightness > 0) this.#sendBrightness(this.#state.brightness);
    this.#renderAgents();
    return true
  }

  // 亮度：写回 rgbcfg（普通键背光 + 外周氛围灯）。v 为 0..1
  #sendBrightness = (v) => {
    const b = Math.max(0, Math.min(1, v));
    if (b <= 0) {
      return this.#transport.writeRpc('v.oai.rgbcfg', {
        ambient: { e: 0, b: 0, s: 0, m: 0, c: 0 },
        keys: { e: 0, b: 0, s: 0, m: 0, c: 0 }
      })
    }
    return this.#transport.writeRpc('v.oai.rgbcfg', {
      ambient: { e: 2, b, s: 0.4, m: 0, c: 0x304ffe },
      keys: { e: 1, b, s: 0, m: 0, c: 0xffffff }
    })
  }

  // 应用来自设置面板的配置补丁（公开给 server/：POST /omkb/config 的 handler 调它）。
  applyConfig = (patch) => {
    if (!patch || typeof patch !== 'object') return
    if (typeof patch.brightness === 'number') {
      this.#state.brightness = Math.max(0, Math.min(1, patch.brightness));
      this.#dimmed = false;
      this.markActivity();
      this.#sendBrightness(this.#state.brightness);
      this.#renderAgents();
    }
    if (typeof patch.autoDim === 'number') {
      this.#state.autoDim = Math.max(0, patch.autoDim);
      // 关掉自动调暗时如果正暗着，要立刻把灯点回来（#wake 只在真暗着时才动手）
      if (this.#state.autoDim <= 0) this.wake();
      else this.#dimmed = false;
    }
  }

  // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
  // 与 applyConfig 的区别：只有值真的变化才写 HID，避免重复下发灯光指令。
  // 返回是否发生了改动。
  setPrefs = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return false
    let changed = false;
    if (typeof prefs.brightness === 'number') {
      const b = Math.max(0, Math.min(1, prefs.brightness));
      if (b !== this.#state.brightness) {
        this.#state.brightness = b;
        this.#dimmed = false;
        this.markActivity();
        this.#sendBrightness(b);
        this.#renderAgents();
        changed = true;
      }
    }
    if (typeof prefs.autoDim === 'number') {
      const d = Math.max(0, prefs.autoDim);
      if (d !== this.#state.autoDim) {
        this.#state.autoDim = d;
        if (d <= 0) this.wake();
        else this.#dimmed = false;
        changed = true;
      }
    }
    return changed
  }

  // 空闲自动调暗：autoDim(秒) 到了就关灯（亮度 0 = ambient 与键灯一起熄）。
  //
  // 计时基准有两条路：
  //   * 浏览器报过 allIdle（新客户端）→ 用「进入全空闲的时刻」与「最后一次按键」里较晚的那个
  //     起算。会话在跑 = 有活干，直接不关；刚敲过键盘也不关——否则会出现
  //     「到点关灯 → 一按键又亮 → 1 秒后又关」的闪烁。
  //   * 还没这份信息（老客户端 / 从未上报）→ 退回原来的「无按键活动」判据，行为与以前完全一致。
  #autoDimCheck = () => {
    if (this.#state.autoDim <= 0 || this.#dimmed || !this.#state.open) return
    if (this.#allIdle === false) return // 有会话在运行：不关灯
    const ref = Math.max(this.#lastActivity, this.#idleSince);
    if (Date.now() - ref < this.#state.autoDim * 1000) return
    this.#dimmed = true;
    this.#sendBrightness(0);
    this.#renderAgents(); // 灯态也要跟着压灭（否则下一次 thstatus 又把灯点亮）
    this.#log(`空闲自动调暗：关闭灯光（${this.#allIdle === true ? '所有会话空闲' : '无按键活动'} ${this.#state.autoDim}s）`);
  }

  #clampRgb = (v) => Math.max(0, Math.min(0xffffff, Math.round(Number(v) || 0)))

  #clamp01 = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
  }

  /**
   * 状态码的白名单校验：**必须是整数**且在 allowed 里，否则回落到 IDLE。
   *
   * 为什么要判类型而不是只 `Number()` 一下：`Number(true) === 1`、`Number('1') === 1` ——
   * 只做数值转换的话，浏览器塞个 `true` 就能伪装成「运行中」。设备拿这个数直接分支，
   * 所以校验必须严于「能转成数字」。
   */
  #stOf = (v, allowed) => (typeof v === 'number' && Number.isInteger(v) && allowed.includes(v) ? v : AGENT_ST_DEFAULT)

  /** 浏览器报上来的状态码：只接受 IDLE/RUNNING（见 AGENT_ST_INBOUND）。 */
  #inboundSt = (v) => this.#stOf(v, AGENT_ST_INBOUND)

  /** 真正下发到设备前的兜底（此时才允许宿主叠加的 SUCCESS/ERROR）。 */
  #clampSt = (v) => this.#stOf(v, Object.values(AGENT_ST))

  // Agent 键 LED：把 6 个槽位的状态一次性写回（v.oai.thstatus）
  // 这里是设备协议的**唯一出口**：未知字段（浏览器的 sid、错误类型等）不会被带下去。
  //
    // 每个槽位恰好 5 个字段：id / c / b / e / st（曾经多发的 s / sk / sa 恒为 0，已删）。
    // 要加新字段，先答得出「谁产出它、谁消费它」。
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
    }))
  }

  /**
   * 写一条 `v.oai.thstatus` —— **唯一的落笔点**（`#sendThstatus` 与 `#flushAgents` 都走它）。
   *
   * ⚠ **只有常态灯态才吃这套去重**。`force`（= **结论**，见 `#pendingForce`）为真时，
   *   内容再一样也**必须发**：结论是**一件事发生了**，「设备此刻已经是红色」并不等于「设备已经知道
   *   又失败了一次」。用户 2026-09-26 第四次报的「连续两次失败，第二次不发」就是被这条挡下的。
   * @param params - `#thstatusParams` 规范化过的 6 槽参数。
   * @param force - true = **结论**驱动（见 `#pendingForce`），跳过内容比对直接发。
   * @returns {boolean} 是否真的写了（内容没变且非结论时为 false，这不是错误）。
   */
  #writeThstatus = (params, force = false) => {
    const key = JSON.stringify(params);
    if (key === this.#lastThstatus) {
      if (!force) {
        this.#log('灯态与上次写出去的完全相同 → 跳过重复写回');
        return false
      }
      // 结论态照发 —— 这一行是给「又失败一次，终端里却什么都没有」留的证据。
      this.#log('这一条是结论态 → 内容与上次相同也照发（内容去重只挡常态灯态）');
    }
    const ok = this.#transport.writeRpc('v.oai.thstatus', params);
    if (ok) {
      this.#lastThstatus = key;
    }
    return ok
  }

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
    if (!Array.isArray(slots)) return false
    const params = this.#thstatusParams(slots);
    this.#state.agents = params;
    return this.#writeThstatus(params)
  }

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
    return dim && dark
  }

  /**
   * 灭灯的唯一对外落点（`#lightsOff` 的公开包装，自带「没连着就什么都不做」的守卫在 transport）。
   *
   * 故意写成**公有类字段**（和 close 同一套路）：上层（ble.js 的 blackout / 退出安全网）
   * 拿它当回调，自检也可以换掉它来观测「退出路径到底有没有灭灯」。
   * @returns {boolean} 是否真的写给设备了。
   */
  lightsOff = () => this.#lightsOff()

  // ---------- 期望灯态 + 结果态 ⇒ 实际灯态 ----------
  // 会话灯态的**唯一出口**：把浏览器下发的期望灯态与「上一轮跑出结论的那几颗键」叠加后写 HID。
  // 这样浏览器在任何时刻重新下发灯态（会话列表变化、切设置页都会触发）都不会把结果态
  // 冲掉——收不收只由宿主说了算（见 #latchOutcome 与 applyAgents）。
  //
  // ⚠ **不直接写设备**：把「此刻应该是什么样」算出来存进 `#pendingAgents`，写入排到本拍末尾
  //   （微任务、同拍再多次也只是覆盖）→ 管**同拍**；跨拍的重复由 `#writeThstatus` 的**内容去重**
  //   兜住 → 管**跨拍**。两条防线各管一段，缺一不可（见技能 §2「一次只发一条」）。
  //
  // ⚠ 诊断字段（`#state.agents` / `#state.outcomes`）必须留在**同步**这一半更新：读 /omkb/state
  //   与自检的人不该被一个微任务的时序影响。**灭灯不走这里**：退出路径必须同步写。
  //
  // @param {{defer?: boolean, force?: boolean, stIdle?: boolean, stAs?: {current: (string|null), known: boolean}}} [opts]
  //   defer  - 排到结果态窗口之后（见 #deferAgentsWrite），只给结果态用。
  //   force  - 这一份是**结论** → 写出去时不吃内容去重（见 #pendingForce）。
  //   stIdle - 这份报文的 st 一律空闲（规则 2 的清除报文）。**2026-09-27 起无调用方**：
  //            `clearOutcome` 不再发清除报文，这条分支保留着以便随时恢复（见 #composeAgents）。
  //   stAs   - 「**按别的当前会话**来算这一份的 st」，只给 `applyAgents` 用：当前会话刚换人时它把
  //            这一份按**换人之前**的样子画出来，于是内容与设备手里那份逐字节相同、被内容去重
  //            挡下 —— 那条推送就一条都不写（见 applyAgents 末尾的长注释）。诊断面
  //            `#state.agents` 跟着它走是对的：那正是设备手里将会保留的那份画面。
  #renderAgents = (opts = {}) => {
    const { defer = false, force = false, stIdle = false, stAs = null } = opts || {};
    if (!this.#desiredAgents.length) return false
    const params = this.#thstatusParams(this.#composeAgents(
      stIdle,
      stAs ? stAs.current : this.#currentSession,
      stAs ? stAs.known : this.#currentKnown
    ));
    // ⚠ 下面两行**同步**更新，与「什么时候写设备」无关：读诊断面的人（GET /omkb/state、
    //   自检）不该被一个写设备的时机左右。defer 只推迟 #pendingAgents 的落地。
    this.#state.agents = params;
    // 排查用：哪些键此刻挂着结果态（红/成功）、分别是哪个会话。它们是**不会自己消失**的，
    // 所以「灯的颜色没人解释」时，先来这里看是谁挂的。
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }));
    this.#pendingAgents = params;
    // 「是不是结论」跟着**内容**一起记（谁后到谁赢，与 #pendingAgents 同一套语义，见 #pendingForce）。
    this.#pendingForce = force;
    if (defer) this.#deferAgentsWrite();
    else if (!this.#agentsScheduled) {
      this.#agentsScheduled = true;
      queueMicrotask(this.#flushAgents);
    }
    return true
  }

  /** 设备（重）连后重放灯态（open() 成功时由 transport 回调）—— 空期望态时什么也不做。 */
  replayAgents = () => this.#renderAgents()

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
      return
    }
    if (this.#outcomeTimer) return
    if (!this.#outcomeSince) this.#outcomeSince = Date.now();
    this.#outcomeTimer = setTimeout(this.#afterOutcomeWindow, this.#outcomeWindowMs);
    // 绝不因为一条灯效把进程留住（窗口到点前进程就该能走；那时灯也没人看了）。
    this.#outcomeTimer.unref?.();
  }

  /**
   * 窗口到点：**回头看一眼浏览器那条来了没有** —— 只有来了（或等过头了）才把灯写出去。
   *
   * 怎么知道它来了：**看 `#pendingAgents` 还在不在**。浏览器那条一到就走
   * `applyAgents` → `#renderAgents()`（非 defer）→ 微任务把终态写下去，这一份随即被消费掉；
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
      return
    }
    // 认输：连同窗口一起撤掉（`#flushAgents` 里的 #cancelOutcomeWindow），别留孤儿。
    this.#flushAgents();
  }


  /**
   * 把当前这一拍攒下的那一份灯态写出去（**最多一条**，且内容与上次相同就跳过）。
   *
   * 链路断开时 `resetOnDisconnect()` 会把 `#pendingAgents` 清掉：链路都没了还补写一条，除了
   * 多一行「设备未连接，忽略写回」的 warn 之外毫无意义；重连时 open() 会重新让灯态重放出来，
   * 不会漏（`resetOnDisconnect()` 也顺手忘了「上次发过什么」，见 `#lastThstatus`）。
   * @returns {boolean} 这一拍是否真的往设备写了一条（无待写 / 内容没变时为 false）。
   */
  #flushAgents = () => {
    this.#agentsScheduled = false;
    // 这一轮等待到此结束（灯已经有人写了）→ **窗口必须一起撤掉**（`#cancelOutcomeWindow`）：
    // 只清一半会留下**孤儿窗口**，它到点会把 flush 之后新来的那份**抢跑**写出去 = 设备收到两条
    // （用户第三次报的「点击发送后还是两条」，详见那里与 verify_blackout §8g）。
    this.#cancelOutcomeWindow();
    const params = this.#pendingAgents;
    // 「是不是结论」与内容一起消费掉（同一个暂存位的两半）。
    const force = this.#pendingForce;
    this.#pendingAgents = null;
    this.#pendingForce = false;
    if (!params) return false
    return this.#writeThstatus(params, force)
  }

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
    if (this.#outcomeTimer) { clearTimeout(this.#outcomeTimer); this.#outcomeTimer = null; }
    this.#outcomeSince = 0;
  }

  /**
   * 期望灯态 + 结果态 → 6 个槽位（设备字段形态）。不改变状态、不碰设备。
   *
   * 结果态只认「此刻占着这个槽位的那个会话」：会话消失 / 换人时宁可少亮一盏，也不要把
   * 别人上一轮的失败挂到新来的会话身上（`applyAgents` 已经整表重建过，这里是出口兜底）。
   *
   * ⚠ **`st` 只报「当前会话」**（规则 1，用户 2026-09-26）—— 判据与优先级都在 `#stOfSlot`。
   * @param stIdle - true = 这份报文的 st 一律空闲（规则 2 的清除报文）。**2026-09-27 起无调用方**
   *   （`clearOutcome` 不再发清除报文）—— 保留是为了恢复规则 2 时只改一处，见 `clearOutcome`。
   * @param current - 「当前会话」用哪一个来算（默认就是此刻记账里的那个）。给 `applyAgents` 留的口子：
   *   「当前会话刚换人」时它要把同一份期望灯态**按换人之前的样子**再算一遍，好拿内容去重把那条
   *   纯 st 位移的报文挡下（见那里）。**颜色与它无关** —— 颜色只跟「谁在跑」走。
   * @param known - 「浏览器报过 current 没有」，与 `current` 配对（见 `#currentKnown`）。
   */
  #composeAgents = (stIdle = false, current = this.#currentSession, known = this.#currentKnown) => this.#desiredAgents.map((s, i) => {
    const out = this.#outcome.get(i);
    const mine = out && this.#slotSessions[i] === out.sid ? out : null;
    const red = !!mine && mine.kind === 'error';
    return {
      id: i,
      st: this.#stOfSlot(i, s.st, mine, stIdle, current, known),
      // 颜色与 st 的归属**故意不同**：失败的红照旧压在那颗键上（用户要求「只动 st，颜色照旧」），
      // 哪怕它不是当前会话 —— 灯的颜色说的是「这条会话上一轮跑成什么样」。
      c: red ? this.#errorColor : s.c,
      b: s.b,
      e: s.e
    }
  })

  /**
   * 槽位 `slot` 该报什么 `st` —— **规则 1 / 规则 2 的唯一落点**。
   *
   * 两条规则在这里合成一句话：**只有「当前会话」这一颗键会报出非空闲的 st**。
   *   · `stIdle`（规则 2：一个会话重新开始运行）→ 6 槽全空闲，把设备上的旧结论一次清掉；
   *     **2026-09-27 起无调用方**（`clearOutcome` 不再发清除报文），保留以便恢复。
   *   · 浏览器**没报过**「谁是当前会话」（老客户端）→ 不知道就不压平，逐槽照旧下发
   *     （与改动前逐字节一致，见 `#currentKnown`）；
   *   · 已知当前会话 → 只有它占的那一槽可能非空闲。它没占键 / 已被归档时自然退化成「全空闲」
   *     ——这正是规则 1 说的「其它会话的为空闲」。
   * 结果态的优先级不变：失败(3) 压过成功(2)，都压过浏览器下发的常态(0/1)。
   * @param slot - 槽位下标。
   * @param desiredSt - 浏览器下发的常态状态码（只可能是 IDLE/RUNNING）。
   * @param mine - 该槽位此刻挂着的**本会话**结果态（`{sid,kind}`），没有则 null。
   * @param stIdle - 规则 2 的清除报文。
   * @param current / known - 「当前会话」的判据（默认取此刻记账里的那个，`applyAgents` 会传换人
   *   之前的那一份进来重算 —— 见 `#composeAgents`）。
   */
  #stOfSlot = (slot, desiredSt, mine, stIdle, current = this.#currentSession, known = this.#currentKnown) => {
    if (stIdle) return AGENT_ST.IDLE
    const isCurrent = typeof current === 'string' && this.#slotSessions[slot] === current;
    // 「知道当前会话是谁，但它不是这一槽」→ 空闲。注意先判 isCurrent 再判 currentKnown：
    // 空槽位的 #slotSessions 是 null，而 currentSession 为 null 时 `null === null` 会误命中。
    if (known && !isCurrent) return AGENT_ST.IDLE
    if (mine) return mine.kind === 'error' ? AGENT_ST.ERROR : AGENT_ST.SUCCESS
    return desiredSt
  }

  /**
   * 某个会话这一轮跑出了结论 → 让它占的那几颗键**保持**这个结果态，直到该会话重新运行
   * （见 clearOutcome）。
   * @param sessionId - 会话 id（DSH 里 agent.id 就是会话 id）。
   * @param kind - 'error'（运行失败，**顺带把灯换成红灯**）| 'success'（正常跑完一轮，只改状态码）。
   * @returns {boolean} 是否真的命中了某个键（该会话没占键时为 false，不算异常）。
   */
  #latchOutcome = (sessionId, kind) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    const bad = kind === 'error';
    const slots = [];
    for (let i = 0; i < this.#slotSessions.length; i++) if (this.#slotSessions[i] === sessionId) slots.push(i);
    if (slots.length === 0) return false // 不在侧边栏 / 还没下发过灯态 → 没有键可亮
    // 同槽位后写覆盖先写：失败之后重试成功，红灯该被成功盖掉（反过来则说明重试又失败了，
    // 那个也是新的结论）。两颗键对应同一会话时一起设。
    for (const slot of slots) this.#outcome.set(slot, { sid: sessionId, kind });
    // ⚠ 两种结论的写入时机不同，判据是「**颜色由谁定**」（详见 #outcomeWindowMs）：
    //   error 的红是**宿主独占** → 立即写（抢跑那条与浏览器那条逐字节相同，会被去重挡下）；
    //   success 要**等浏览器更正颜色** → 走窗口。
    // force（见 #pendingForce）：**只有失败**才打开内容去重的口子。两层理由：
    //   · 上面那条「两者算出来的内容相同」的对偶事实 —— 对**成功**来说颜色每次都不同
    //     （蓝→白），去重根本挡不住它、也用不着开口子；对**失败**来说内容必然相同（红是宿主
    //     独占的，其余槽位一个字节都不动），于是「又失败一次」会被静默吞掉（用户实测：
    //     连续两次发送失败，第二次终端里没有「→ 写 thstatus」）。一个结论必须让设备知道一次。
    //   · 规则 1（`st` 只报当前会话，见 #stOfSlot）让「成功不用 force」这条**更站得住**而不是
    //     更松：非当前会话的 st 恒为 0、颜色也不动，它连跑成功两次算出来的报文确实一模一样
    //     —— 而那种「重复」对设备来说**本来就是同一个画面**（规则 1 有意如此），挡掉不丢信息。
    this.#renderAgents({ defer: !bad, force: bad });
    this.#log(bad
      ? `会话运行失败 → 槽位 ${slots.join(',')} 转红灯（保持到该会话重新运行）`
      : `会话跑完一轮 → 槽位 ${slots.join(',')} 报成功（保持到该会话重新运行）`);
    return true
  }

  /**
   * 某个会话运行失败 → 让它的那颗键**一直红着**（状态码同时变 3），不再自己变回白色。
   *
   * 由宿主的 `agent/error` 事件驱动（见 src/core/index.js）。注意这个事件**只在真正的失败**
   * 时发出：用户主动中断走的是另一条分支，不会转红。
   * 收掉它的唯一常规途径是「该会话重新开始运行」（clearOutcome）。
   */
  reportError = (sessionId) => this.#latchOutcome(sessionId, 'error')

  /**
   * 某个会话**正常跑完一轮** → 让它那颗键一直报 st=2（成功），颜色不动。
   *
   * 由宿主的 `agent/turn-stopping` 驱动：那是「这一轮要收尾了」的钩子，用户中断
   * （signal.aborted）与真失败（agent/error）都在它之前就 throw 掉了，走不到这一步 ——
   * 所以它天然就是「成功」的信号，不需要再去比对什么 reason。
   */
  reportSuccess = (sessionId) => this.#latchOutcome(sessionId, 'success')

  /**
   * 某个会话**重新开始运行** → 收掉它的结果态（红 / 成功）。
   *
   * 这是结果态唯一会「自己走掉」的途径，由宿主的 `agent/status`（status === 'running'）驱动：
   * 那是 agent loop 的相位变化，用户重试 = 新一轮 = 相位从 idle 变 running。
   *
   * 为什么**不**拿浏览器下发的 `st=1` 当清除判据：浏览器那份快照带 350ms 防抖，失败发生的
   * 那一刻它手里往往还写着「这个会话在跑」，把它当成「用户重试了」会让红灯刚亮就被抹掉
   * ——那正是这次要修的病（见 #outcome 的注释）。
   *
   * ⚠ **2026-09-27 用户要求：这里不发任何报文**（「clearOutcome 先不要，这个也会导致发送多条」）。
   *   在此之前它会额外发一条「6 槽 st 全空闲」的清除报文（规则 2），问题出在**时序叠加**：
   *   `agent/status=running` 在「发一条消息」与「失败后重试」时都会来，于是
   *     ① 这条清除报文（全空闲）  ② 随后的浏览器那份（蓝·st=1）
   *   一次操作设备收到两条 —— 用户在终端里看到的两行「→ 写 thstatus」正是它们。
   *
   *   现在只做**内部记账**：把结论从 `#outcome` 里撤掉（这样下一次浏览器推送重算时红灯自然
   *   消失 —— 不撤的话红灯会永远压着）。设备上的画面交给**浏览器那条推送**去更正：
   *   「一个会话重新开始运行」本来就会让会话列表变化 → 浏览器推一次 → 宿主重算（此时已无结论）
   *   → 写出正确状态。一场重试因此**只剩一条**。
   *
   *   诊断面同步（**不写设备**）：`#state.agents` 仍是设备上一份真实画面，`#state.outcomes`
   *   如实反映「结论已经收掉」。`#renderAgents` 的 `stIdle` 分支暂时无调用方（保留以便随时恢复
   *   规则 2，见 #composeAgents）。
   * @param sessionId - 会话 id。
   * @returns {boolean} 这一轮是否真的收掉了某个结果态（本来就没挂时为 false，此时什么都不做）。
   */
  clearOutcome = (sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId) return false
    let hit = false;
    for (const [slot, t] of [...this.#outcome]) {
      if (t.sid !== sessionId) continue
      this.#outcome.delete(slot);
      hit = true;
    }
    // 只更新诊断面，**不渲染、不写设备**（原因见上面的注释）。
    this.#state.outcomes = [...this.#outcome].map(([slot, t]) => ({ slot, sid: t.sid, kind: t.kind }));
    if (hit) this.#log(`会话 ${sessionId} 重新开始运行 → 收掉结果灯（不再额外发清除报文）`);
    return hit
  }

  // 来自设置面板的 Agent 键 LED 配置（{ slots: [{st,c,b,e,sid}...], errorColor, allIdle, current } 或纯数组）。
  // 公开给 server/：POST /omkb/agents 的 handler 调它。
  applyAgents = (payload) => {
    const list = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.slots) ? payload.slots : null);
    if (!list) return
    // **这一份是不是一次「切会话」** —— 只用来打一行日志：写不写设备由**内容**说了算
    // （末尾那段：只有 st 该报哪颗键变了的那条一条都不写）。判据是「在两个真实会话 id 之间
    // 切换」，见 `#currentSeen`。
    let switched = false;
    // 「当前会话」**换人之前**的两半判据 —— 末尾那条「只有 st 该报哪颗键变了就不额外发」要用它把
    // 同一份期望灯态按换人之前的样子再算一遍。必须在下面覆盖之前取（对照 §9 的形态守卫）。
    const prevCurrent = this.#currentSession;
    const prevKnown = this.#currentKnown;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      // 必须严格判定类型：Number(null) === 0 会让「字段缺失/null」被当成合法的黑色，
      // 于是红灯变成一颗看不见的灯（比报错更难查）。
      const c = payload.errorColor;
      if (typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= 0xffffff) this.#errorColor = c;
      // 「所有会话都空闲」→ 自动调暗的计时起点；有会话重新开始运行 → 立刻把灯点回来。
      // 老客户端不发这个字段（数组形态的老请求更是没有），此时 #allIdle 保持 null = 未知，
      // 自动调暗退回「无按键活动」判据。
      if (typeof payload.allIdle === 'boolean') {
        this.#state.idle = payload.allIdle;
        if (payload.allIdle !== this.#allIdle) {
          this.#allIdle = payload.allIdle;
          if (payload.allIdle) this.#idleSince = Date.now();
          else { this.#idleSince = 0; this.wake(); }
        }
      }
      // **谁是「当前会话」**（规则 1 的判据，见 #currentSession）：主视图正在看的那一条。
      // 判据与 errorColor 一样严格 —— 只认 `string`（会话 id）与 `null`（知道，但没有）两种形态；
      // 数字/布尔/对象这类畸形值一律当作**这次没报**处理（保持原有认知），绝不让一个坏字段
      // 把整盘 st 压成空闲。老客户端根本不发这个字段 → `#currentKnown` 保持 false →
      // 不替它压平，逐槽照旧下发（与改动前逐字节一致）。
      if (typeof payload.current === 'string' || payload.current === null) {
        const next = payload.current || null;
        // 「切没切」必须在**覆盖之前**算，而且判据是「**在两个真实会话 id 之间**切换」——
        // 见 `#currentSeen`：`null` 是「主视图暂时没有会话」，把它也算成变化的话，一次真实
        // 切换会被算成两次（A → null → B），多写一条与设备已有内容逐字节相同的报文。
        // 留下那行日志是为了让现场日志自己说清「这一条是切换驱动的」，不用再靠猜。
        const prevSeen = this.#currentSeen;
        switched = typeof next === 'string' && prevSeen !== null && prevSeen !== next;
        if (typeof next === 'string') this.#currentSeen = next;
        this.#currentKnown = true;
        this.#currentSession = next;
        if (switched) this.#log(`切会话：当前会话 ${prevSeen} → ${next}（内容有变才发，逐字节相同就不发 —— 见末尾注释）`);
      }
      // 诊断面（GET /omkb/state）：排查「为什么其它会话的 st 都是 0」时先看这里 ——
      // 它就是规则 1 用来挑那一颗键的判据。
      // ⚠ 两个字段必须**一起**看，`agentsCurrent` 单个字段的 `null` 是**两种**事：
      //   · `known: false` + `null` —— 浏览器**从没报过这个字段**（老客户端）→ 我们不压平；
      //   · `known: true`  + `null` —— 报过，只是主视图此刻没有会话 → 6 槽全空闲。
      // 这正是 `#currentKnown` 想分开的东西，所以**必须让它可观测**：不然现场只能靠读源码分辨
      // （与 `#state.idle` 同一条纪律：诊断面照旧同步、别让排查的人去猜）。
      this.#state.agentsCurrent = this.#currentKnown ? this.#currentSession : null;
      this.#state.agentsCurrentKnown = this.#currentKnown;
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
      sessions.push(typeof s.sid === 'string' && s.sid ? s.sid : null);
    }
    this.#desiredAgents = desired;
    this.#slotSessions = sessions;
    // 结果态要跟着会话走，不能跟着槽位走：会话列表重排时槽位会换人，结果态必须一起搬家，
    // 会话消失（归档 / 关掉）时则撤掉。这里整表重建，避免原地增删的边界情况。
    //
    // ⚠ 这里**不**看浏览器下发的 st：它带 350ms 防抖，失败那一刻常常还是「running」的陈旧
    //   快照（见 #outcome 的注释），拿它收结果态 = 红灯刚亮就被抹掉。收只认 agent/status。
    const next = new Map();
    for (const [, t] of this.#outcome) {
      const at = sessions.indexOf(t.sid);
      if (at !== -1 && !next.has(at)) next.set(at, t);
    }
    this.#outcome = next;
    // 这条写出去就是**终态**（带着结果态 + 浏览器刚更正的颜色）：结果态窗口到点时再算一遍
    // 内容相同，会被 #writeThstatus 去重挡下；此时 #pendingAgents 也已被这一拍消费掉，
    // 窗口到点直接空转返回 —— 所以这里不需要显式去取消它（没有它行为也一样，见 #outcomeWindowMs）。
    //
    // ⚠ **「当前会话」换人本身不写设备**（用户 2026-09-27 第三次改口径：「切换 session 后，
    //   成功/错误返回又多发了一条，目标是只发一条，只发一条」）。
    //
    //   判据不是「切没切」这个事件（那条路当天走过一版 force，只能产生重复，已撤回），而是
    //   **内容**：拿**换人之前**的当前会话把同一份期望灯态再算一遍，若与设备上那份逐字节相同，
    //   就说明这条推送带来的**唯一**变化是「规则 1 该把 st 挪到哪颗键」—— 而**颜色一个字节都没动**
    //   （颜色只跟「谁在跑」走，与 current 无关，见 #composeAgents）。那种报文对设备是纯噪音：
    //   本次推送没有带来任何新画面。于是这里**按换人之前的样子重画** → 内容与设备手里那份相同
    //   → 被 #writeThstatus 的内容去重挡下 → **一条都不发**。st 的排布留到**下一次真实变化**
    //   （跑起来 / 跑完 / 失败 / 颜色变了）时一并带过去，那时 #stOfSlot 用的已经是新的当前会话。
    //
    //   代价说清楚：这期间设备上那颗键的 st 还是**上一任**当前会话的（比如它还报着 st=1「在跑」）
    //   —— 颜色始终正确，规则 1 只是**推迟**到下一次真实变化才生效。这正是用户要的取舍：
    //   「一条都不多发」优先于「切换瞬间就把 st 挪过去」。（反例都不必构造：只要某一次推送真的
    //   改了颜色 / 结果态 / 哪个会话在跑，下面这行比较就不成立，照旧立刻发一条。）
    const moved = prevKnown !== this.#currentKnown || prevCurrent !== this.#currentSession;
    let stAs = null;
    if (moved && this.#lastThstatus) {
      const asBefore = JSON.stringify(this.#thstatusParams(this.#composeAgents(false, prevCurrent, prevKnown)));
      if (asBefore === this.#lastThstatus) stAs = { current: prevCurrent, known: prevKnown };
    }
    if (stAs) this.#log('只有「st 该报哪颗键」变了（当前会话换人）→ 不额外发一条；下一次真实变化会把它一起带过去');
    this.#renderAgents(stAs ? { stAs } : {});
  }

  /**
   * 链路断开时属于**灯态**的那部分收尾（由 ble.js 的 close 调）：
   *   · 电量读数作废 —— 它是「这台设备的读数」，设备不在了就该如实变成「不知道」，
   *     而不是把断开前的 12% 一直挂在界面上（用户看到的就是一台没连上的键盘还有电量）；
   *   · 排着队还没写出去的灯态作废 —— 链路都没了还补写一条，只会多一行「设备未连接」的 warn；
   *   · 还没到点的结果态窗口撤掉，并忘掉「上次写出去的灯态长什么样」：链路断过之后设备那份
   *     画面不再可信（它可能自己重启过 / 被人手动改过），重连时灯态必须**真的重放一次**，
   *     不能被内容比对挡掉。重连时 open() 会重新重放灯态，所以不会漏。
   */
  resetOnDisconnect = () => {
    this.#state.battery = null;
    this.#state.charging = false;
    this.#pendingAgents = null;
    // 「是不是结论」也一起作废：它属于被丢掉的那一份待写内容，留着会让**下一条**无关灯态
    // 平白绕过内容去重（那个暂存位的两半必须同生同灭，见 #pendingForce）。
    this.#pendingForce = false;
    // 用 #cancelOutcomeWindow 而不是只清定时器：它顺手把「这轮从什么时候开始等」也归零，
    // 两个字段本来就该同生同灭（见它的注释）。
    this.#cancelOutcomeWindow();
    this.#lastThstatus = null;
  }

  /** 插件卸载（进程要走了）：停掉自动调暗定时器。句柄与安全网由 transport 收尾。 */
  dispose = () => {
    if (this.#dimTimer) { clearInterval(this.#dimTimer); this.#dimTimer = null; }
  }
}

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

// dsh-omkb · core/input.js
// **输入解析层** —— 把设备上报的一行 JSON 翻译成状态快照里的输入事实（从 ble.js 分拆出来）。
//
// 每个输入源有自己的累加计数器（见 ble.js 顶部 #state 的说明）：enc（旋钮带符号步数）、
// knobPress（旋钮按下）、joyPush/joyDir（摇杆推了一次）、joyT（含回中的方向变化计数）、
// down/keyAct（当前按住的键 + 本次边沿）、keyT（每键按下次数）。浏览器据此归属事件，
// 而不是靠 t 猜 —— 靠状态字段猜事件类型是一类老 bug（旋钮/摇杆曾被当成麦克风键而触发语音）。
//
// 分工：本层只「翻译输入」——不写设备、不认识灯态。唯一的外部动作是通知 leds.js
//   · markActivity()（有输入 = 有活动，自动调暗的计时基准）；
//   · wake()（按下任意键先把灯点回来，restoreLight=false 的摇杆除外）。
// 电量（device.status / 应答形状）也在这里认：它**插在按键链路之前并直接 return**，
// 否则会走完整条按键链路（t 自增、state.key 被冲成 null），客户端会因此记一条无主事件噪声。


class InputParser {
  #state = null
  #leds = null
  #logger
  #held = new Set() // 当前物理按住的键名（只有拿到 act 才会维护）
  #last = 0
  #debounceMs = 250 // 一次物理按压只计一次
  #triggerMethod = process.env.DSH_HID_METHOD || null // 可选：只响应某个 method
  #triggerKey = process.env.DSH_HID_KEY || null // 可选：只响应某个 params.k

  /** @param {{logger?: any, state: object, leds: object}} [options] */
  constructor(options = {}) {
    const { logger = null, state = null, leds = null } = options;
    this.#logger = logger;
    this.#state = state;
    this.#leds = leds;
  }

  #log = (...a) => { try { this.#logger?.['info']?.(...a); } catch (e) {}; logSink.info(...a); }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a); } catch (e) {}; logSink.warn(...a); }

  // 防抖计数 + 空闲调暗恢复。restoreLight=false 时只通知计数、不写回 LED（用于摇杆这类纯输入事件，
  // 摇杆不应向键盘发回任何灯光信息）
  #bump = (label, restoreLight = true) => {
    const now = Date.now();
    // 有输入 = 有活动：自动调暗的计时基准归 leds 管（它才是灯的主人）。
    this.#leds?.markActivity?.(now);
    // 空闲调暗状态下，任意按键先恢复亮度
    if (restoreLight) this.#leds?.wake?.();
    if (now - this.#last < this.#debounceMs) return
    this.#last = now;
    this.#state.t += 1;
    this.#log(`HID 触发 ${this.#state.t}${label ? ' (' + label + ')' : ''}`);
  }

  // 处理一条完整的 JSON 通知行，如 {"method":"v.oai.hid","params":{"k":"AG00"}}
  handleLine = (line) => {
    // 入站帧**原样**回显：开发版照旧打终端（`console.log(line)`，**不带** [omkb] 前缀）；
    // 正式版落进日志文件的 `[rx]` 级别（排查「设备到底说了什么」时只有它靠得住）。
    logSink.raw(line);
    const raw = line.trim();
    if (!raw) return
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      this.#warn('非法 JSON 行:', raw);
      return
    }
    if (!msg || typeof msg !== 'object') return

    // ---- 设备状态（电量）：**插在按键链路之前并直接 return** ----
    // 它不是按键事件。落进下面的链路会让 t 自增、把 state.key 冲成 null，
    // 客户端就会因为这个「有 t 但没有可识别字段」的帧记一条无主事件诊断
    // （见 src/client/hid-bridge.js 的 #noteUnhandled）—— 电量一上报就报一条噪声。
    // 也刻意排在 `#triggerMethod` 过滤之前：那是调试用的「只认某个 method」开关，
    // 不该顺手把电量也挡掉。
    // 位置同样排在下面那条 `method` 守卫**之前**：我们主动问电量的应答是
    // `{"id":N,"result":{...}}`（**没有 method**），晚一步就会被守卫整条丢掉。
    const status = parseDeviceStatus(msg);
    if (status) {
      this.#state.battery = status.battery;
      this.#state.charging = status.charging;
      return
    }

    if (typeof msg.method !== 'string') return

    if (this.#triggerMethod && msg.method !== this.#triggerMethod) return

    const key = msg.params && msg.params.k;
    if (this.#triggerKey && (!key || key !== this.#triggerKey)) return

    // ---- 按键边沿（见 HID_ACT）：按下 / 松开 / 脉冲 ----
    const keyAct = msg.params && typeof msg.params.act === 'number' ? msg.params.act : null;
    this.#state.keyAct = keyAct;

    // 松开**不是一个新事件**，只更新“当前按住的键”就结束（t 不变 → 客户端不会再执行一次动作）。
    // 以前没有这条分支：松手也会走完整条链路，AG 键会重复打开会话、语音键会被 toggle 两次，
    // 只是 250ms 去抖恰好遮住了大部分（按得慢就会露出来）。
    if (keyAct === HID_ACT.RELEASE) {
      if (key) { this.#held.delete(key); this.#state.down = [...this.#held]; }
      return
    }

    // 按住集合：**只有设备明确报了 act 才维护**——老固件只会报“按下”，
    // 若要它就会把键永久钉在按下态（永远收不到松开）。
    // 脉冲（旋钮转一格）是两个边沿之间的瞬时事件，没有“按住”语义，也不入集合。
    if (key && keyAct !== null && keyAct !== HID_ACT.PULSE) {
      this.#held.add(key);
      this.#state.down = [...this.#held];
    }

    // 记录具体按键：
    //   Agent 键 AG00..AG05 → 槽位 0..5
    //   动作键 ACT06..ACT12 → 动作码（'ACT07' 归档 / 'ACT08' 拒绝 / 'ACT09' 同意 /
    //     'ACT10'·'ACT11' 语音 / 'ACT12' 发送 / 'ACT06' 保留）
    this.#state.key = key || null;

    // 每个键名一个累加计数器（keyT）：设置页的键盘布局靠它播「按键特效」。
    // 计数的是**按下**次数（松开在上面已经 return），所以「按一下 = +1」；
    // 为什么不用 sticky 的 key 计：它会被后续事件覆盖，两次轮询之间按下的不同键只看得到最后一个。
    if (key) {
      const map = this.#state.keyT || (this.#state.keyT = {});
      if (map[key] !== undefined || Object.keys(map).length < 64) {
        map[key] = (map[key] || 0) + 1;
      }
    }

    // 旋钮（编码器）：CW(+1)/CC(-1) 累加带符号步数；旋钮按下 ENC 走下方普通按键路径
    if (key === 'ENC_CW') { this.#state.enc = (this.#state.enc || 0) + 1; this.#state.agent = -1; this.#state.act = null; this.#bump(key); return }
    if (key === 'ENC_CC') { this.#state.enc = (this.#state.enc || 0) - 1; this.#state.agent = -1; this.#state.act = null; this.#bump(key); return }

    // 摇杆：RPC `v.oai.rad`，参数 { a(角度), d(推力) } → 依角度归一化为四方向。
    // 角度→方向映射见 ./joystick.js；回中(d 低于阈值)时置 joy=null。
    if (msg.method === JOYSTICK_METHOD) {
      const j = parseJoystick(msg);
      const dir = (j && j.dir) || null;
      this.#state.agent = -1;
      this.#state.act = null;
      const prev = this.#state.joy;
      this.#state.joy = dir;
      // 摇杆是连续帧流：只有方向**发生变化**才触发一次，避免同方向持续推导致重复执行
      // 返回/前进等动作。
      //
      // joyT 是方向变化计数器，且**把回中也算作一次变化**（joy → null）。为什么必须
      // 单独计数：t 只在非空方向变化时递增，回中不改 t，于是浏览器端永远看不到
      // 「这一次推杆结束了」——它按 t 变化取状态，第二次推**同一个方向**时会拿
      // joy='left' 和上次的基线比，判成「持续推杆」而整个吞掉。有了 joyT，
      // 「推→回中→再推同向」各记一次，且帧流期间保持不变。
      if (dir !== prev) {
        this.#state.joyT = (this.#state.joyT || 0) + 1;
        if (dir) {
          // 非空方向变化 = 「推了一次」。累加计数 + 记住方向，浏览器只靠这两个字段
          // 就能执行动作——即使松手发生在两次轮询之间（那时 joy 已经回中，
          // 光看 joy 会把这个动作整个丢掉）。
          this.#state.joyPush = (this.#state.joyPush || 0) + 1;
          this.#state.joyDir = dir;
          this.#bump('JOY_' + dir, false); // 纯输入，不写回键盘灯光
        }
      }
      return
    }

    const m = /^AG0([0-5])$/i.exec(key || '');
    const a = /^ACT(0[6-9]|1[0-2])$/i.exec(key || '');
    this.#state.agent = m ? Number(m[1]) : -1;
    this.#state.act = a ? 'ACT' + a[1] : null;

    // 旋钮按下：单独计数。宿主 #bump 有 250ms 去抖，而设备可能按得比这快，
    // 光靠 t 会漏掉（浏览器也就没法归属这次按下）。旋转在更上面 ENC_CW/CC 分支处理。
    if (key === 'ENC') this.#state.knobPress = (this.#state.knobPress || 0) + 1;

    this.#bump(key || msg.method);
  }

  /** 链路断开时清掉「当前按住的键」——设备走了就不可能还有键按着。 */
  resetHeld = () => {
    this.#held.clear();
    this.#state.down = [];
  }
}

// dsh-omkb · core/ble.js
// **装配门面** —— 原先那个上千行的单体（HID 传输 + 协议解析 + 输入翻译 + 灯态状态机全塞在一个
// 类里）按职责拆成了四个模块，这里只剩「把它们接起来」这一件事：
//
//   · ./protocol.js  **线格式契约**：HID_ACT / STATUS_METHOD / AGENT_ST / BLACKOUT_SLOTS 与
//                    电量/状态的纯解析函数（无状态、无副作用、不碰设备）。
//   · ./transport.js **HID 传输**：node-hid 打开/分帧/写回、30 秒重连、兜底探活、退出安全网。
//   · ./leds.js      **灯态状态机**：期望灯态 + 结果态 ⇒ 实际灯态，同拍合并 / 内容去重 / 结果态
//                    窗口三道防线，亮度与空闲自动调暗。
//   · ./input.js     **输入翻译**：一行 JSON → 状态快照里的按键/旋钮/摇杆/电量事实。
//
// 本文件保留**对外门面不变**（`BleController` 的公有落点 + `createBleReader` 的 12 个字段），
// 并把 protocol.js 的全部符号**再导出**（`export *`）—— 自检与其它模块照旧 `from './ble.js'` 取
// HID_ACT / parseDeviceStatus / AGENT_ST / BLACKOUT_SLOTS 等，一个字都不用改。
//
// 三块拼图的依赖是**回调 + 后注入**，没有环：
//   input → leds（markActivity / wake）
//   transport → 上层回调 onLine / onOpened / onBlackout
//   leds → transport（构造后 attach，因为 transport 的构造又依赖 leds 的 lightsOff）
//   安全网的 release/blackout 闭包指向**本类**的 this.close()/this.blackout()：
//   它们是公有类字段、可被自检替换，安全网必须调它们（见 test/lib/exit-guard-child.mjs）。


class BleController {
  // ---------- 状态：计数器 + 连接状态 + 灯光配置，暴露给浏览器客户端 ----------
  // 关键：**每个输入源都有自己的累加计数器**，浏览器据此归属事件，而不是靠 t 猜。
  // t 只是「发生过一件事」的全局计数，而设备状态字段会被后续事件覆盖（推完立刻松手，
  // 轮询那一刻 joy 已经回中），拿它当「事件类型」用必然误判——曾经的后果是旋钮/摇杆
  // 操作被当成「麦克风键」而触发语音输入（见 src/client/hid-bridge.js 顶部注释）。
  //   enc      带符号累计步数 → 旋钮旋转（差值即步数）
  //   knobPress           计数 → 旋钮按下（不受去抖影响）
  //   joyPush/joyDir      计数 + 最近一次有效方向 → 摇杆推了一次（回中不计，方向不走丢）
  //   joyT                含回中的方向变化计数（老客户端用，语义保持不变）
  //   down / keyAct       **当前按住的键** + 本次事件的边沿（见 protocol.js 的 HID_ACT）。
  //   battery / charging  设备的**电平型**状态（device.status 上报，见 protocol.js 的
  //                       parseDeviceStatus）。故意**不给它配计数器**：断开时清成 null/false。
  // 这份字面量**原样搬自拆分前的 ble.js**，三个模块共用同一个对象（各持引用），
  // 谁写哪几个字段的分工见各模块顶部的说明。
  #state = { t: 0, open: false, product: null, battery: null, charging: false, brightness: 0.9, autoDim: 0, key: null, keyAct: null, down: [], agent: -1, act: null, enc: 0, encPress: 0, encLong: 0, knobPress: 0, joy: null, joyT: 0, joyPush: 0, joyDir: null, agents: [], outcomes: [], idle: null, agentsCurrent: null, agentsCurrentKnown: false, keyT: {} }
  #logger
  #diagnostics = null
  #leds = null
  #input = null
  #transport = null

  constructor({ logger, diagnostics } = {}) {
    this.#logger = logger;
    this.#diagnostics = typeof diagnostics === 'function' ? diagnostics : null;
    // 装配顺序被三处依赖钉死：
    //   ① leds 先生成（它是灯的主人，transport 的 onBlackout 要调它）；
    //   ② input 拿 leds 的引用（按键要 markActivity / wake）；
    //   ③ transport 最后建，用回调把三块接起来，再由 leds.attach 反向注入（破环）。
    this.#leds = new LedEngine({ logger, state: this.#state });
    this.#input = new InputParser({ logger, state: this.#state, leds: this.#leds });
    this.#transport = new HidTransport({
      logger,
      state: this.#state,
      onLine: (line) => this.#input.handleLine(line),
      onOpened: () => this.#leds.replayAgents(),
      onBlackout: () => this.#leds.lightsOff(),
      // 安全网的两个落点 —— **必须闭包指向本类的公有字段**（close / blackout）。它们都是公有类
      // 字段、可被自检整套替换（test/lib/exit-guard-child.mjs 就这么观测「到底灭没灭灯」）；
      // 若这里改调私有实现或 transport 自己的方法，那种替换就观测不到了。
      // ⚠ blackout 必须排在 release **之前**执行（由安全网保证）—— 释放会关掉句柄。
      guard: {
        release: () => this.close(),
        blackout: () => this.blackout(),
        log: (m) => this.#warn(m)
      }
    });
    this.#leds.attach(this.#transport);
  }

  #warn = (...a) => { try { this.#logger?.['warn']?.(...a); } catch (e) {}; logSink.warn(...a); }

  get state() { return this.#state }

  /**
   * 自检用：拿到退出安全网句柄。**只给自检脚本用**（`test/verify_exit_guard.js` 用它
   * 在不依赖真设备的前提下验证「信号到达时退不退、退得掉吗」）；运行时不调用，
   * 真机路径上安全网由 transport 的 open() 自己 install()。
   */
  get exitGuard() { return this.#transport.exitGuard }

  /**
   * 测试注入：把一行 JSON 当作设备上报处理（与 HID 数据帧走同一条解析路径）。
   * 只给自检脚本用（verified 摇杆/按键链路）；运行时不调用。
   * @param line - 一行 JSON 文本（可带尾随换行）。
   * @returns {void}
   */
  feedLine = (line) => { this.#input.handleLine(String(line)); }

  // 状态快照 = 硬件状态 + 可选诊断。诊断由宿主注入（目前是设置持久化是否在线）：
  // 终端里的 logger 输出不一定会落到 stdout，把关键结论挂到 /omkb/state 上，
  // 排查时一条 curl 就能看到，不用重启终端或翻日志。
  // 公开给 server/：GET /omkb/state 的 handler 调它取「带诊断面」的快照。
  snapshot = () => {
    if (!this.#diagnostics) return this.#state
    try { return { ...this.#state, settings: this.#diagnostics() } } catch (e) { return this.#state }
  }

  open = () => this.#transport.open()

  close = () => {
    // 断开**刻意不关灯**（随时会发生、也随时会重连，在这儿关灯换来的只是「重连之后黑一片」）。
    // 三块各自收自己的账：句柄/链路归 transport，按住集合归 input，灯态与电量归 leds
    // （后者见 leds.js 的 resetOnDisconnect —— 「谁清待写内容谁就得忘了上次写出去的样子」）。
    this.#transport.close();
    this.#input.resetHeld();
    this.#leds.resetOnDisconnect();
  }

  // 手动重连（公开给 server/：/omkb/reconnect 的 handler 调它）。
  reconnect = () => {
    this.close();
    this.open();
  }

  /**
   * 灭灯的唯一对外落点（自带「没连着就什么都不做」的守卫）。
   *
   * 故意写成**公有类字段**（和 close 同一套路）：自检脚本可以把它整个换成打印或计数器，
   * 以此观测「退出路径到底有没有灭灯」—— 而真正的写灯实现在 leds.js（私有），从外面换不掉。
   * @returns {boolean} 是否真的写给设备了。
   */
  blackout = () => this.#transport.blackout()

  // 应用来自设置面板的配置补丁（公开给 server/：POST /omkb/config）。
  applyConfig = (patch) => this.#leds.applyConfig(patch)

  // 持久化偏好回灌（宿主启动时从 settings.yaml 读到的亮度/自动调暗）。
  setPrefs = (prefs) => this.#leds.setPrefs(prefs)

  // 来自设置面板的 Agent 键 LED 配置（公开给 server/：POST /omkb/agents）。
  applyAgents = (payload) => this.#leds.applyAgents(payload)

  // 结果态：某个会话失败（红）/ 跑完一轮（成功）/ 重新开始运行（收掉）。由宿主总线驱动。
  reportError = (sessionId) => this.#leds.reportError(sessionId)

  reportSuccess = (sessionId) => this.#leds.reportSuccess(sessionId)

  clearOutcome = (sessionId) => this.#leds.clearOutcome(sessionId)

  dispose = () => {
    // 插件卸载（进程要走了）：三块各自收尾，顺序有两条硬约束 ——
    //   ① 停掉自动调暗定时器（leds.dispose）—— 别让一条灯效把进程留住；
    //   ② **灭灯必须排在 close() 之前**（用户 2026-09-25 要求）：唯一出口要看到活着的句柄
    //      才写得出去；灯是设备自己记着的，进程一走没人替我们关。
    // 另一个落点是**退出安全网**（Ctrl+C/SIGTERM/SIGHUP）—— 宿主优雅关闭那条路未必走到这里。
    this.#leds.dispose();
    this.blackout();
    this.#transport.dispose();
    this.close();
  }
}

/**
 * 创建 HID 读取器。
 *
 * 这里可以放心用解构形参，但前提是宿主构建关掉了 tree-shaking（见 vite.core.config.js）：
 * rollup 会按「被调用方的解构形参」裁剪对象字面量实参，`createBleReader({ logger, diagnostics })`
 * 遇上只解构 logger 的工厂会被打包成 `createBleReader({ logger })`——多传的选项静默消失
 * （源码里有、产物里没有、不报错）。若哪天重新打开 tree-shaking，这里要么改成不透明形参
 * `(options = {}) => new BleController(options)`，要么记得验证产物。
 * @param {{ logger?: any, diagnostics?: Function }} [options] - logger 与可选诊断回调。
 * @returns 读取器门面。
 */
const createBleReader = ({ logger, diagnostics } = {}) => {
  const ctl = new BleController({ logger, diagnostics });
  return {
    open: ctl.open,
    close: ctl.close,
    reconnect: ctl.reconnect,
    setPrefs: ctl.setPrefs,
    applyAgents: ctl.applyAgents,
    applyConfig: ctl.applyConfig,
    reportError: ctl.reportError,
    reportSuccess: ctl.reportSuccess,
    clearOutcome: ctl.clearOutcome,
    // 测试注入（自检脚本用它喂摇杆帧，见 feedLine）；宿主运行时不用。
    feedLine: ctl.feedLine,
    dispose: ctl.dispose,
    state: ctl.state,
    snapshot: ctl.snapshot
  }
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

// dsh-omkb · HTTP 路由路径唯一真源
//
// 宿主侧对外暴露的 7 条 /omkb/* 路由，路径只在这里声明一次。其余模块（server/ 下的
// 各 handler、以及需要断言路径的自检）一律 import 这里，绝不各自写死字符串 ——
// 否则「改一条路径要改 N 处」，改漏了就变成「浏览器打新地址、宿主还挂在旧地址上」的
// 静默断连。
//
// ⚠ 客户端（src/client/*）那一侧目前仍是各自写死的字符串（8 处），与这里**不同源**。
// 本轮（2026-09-27）只统一 core 侧；若要根治，得再抽一份无 Node 依赖的共享常量模块让
// client 也 import，属于独立的一轮，见项目备忘。

const PATHS = Object.freeze({
  /** 状态快照（GET）：设备状态 + 灯态 + 诊断面。 */
  state: '/omkb/state',
  /** 配置写回（POST）：亮度 / 自动调暗。 */
  config: '/omkb/config',
  /** 手动重连（任意）：关句柄再 open。 */
  reconnect: '/omkb/reconnect',
  /** 灯态上报（POST）：Agent 键 LED 配置 + 当前会话 + 结果态。 */
  agents: '/omkb/agents',
  /** 归档当前会话（POST）：宿主 workspaceRegistry.archiveSession。 */
  archive: '/omkb/archive',
  /** 输入监控授权状态（GET/POST，仅 macOS）：读系统权限。 */
  monitor: '/omkb/monitor',
  /** 打开系统设置的隐私面板（POST）：浏览器不能 spawn，宿主代劳。 */
  openPrivacy: '/omkb/open-privacy'
});

// dsh-omkb · HTTP 桥接小工具
//
// 宿主侧所有路由 handler 共用的一套读写原语。原来这些散在 ble.js 里（#jsonHead/#readBody/#json），
// 搬到这里是因为它们与「BLE/HID 设备」无关，只跟「webserver 通信」有关 —— 属于 server/ 的职责。
//
// 这些函数是纯工具（无状态、无闭包），所以导出为模块级常量即可，不必挂到某个实例上。

/** 统一 JSON 响应头。 */
const JSON_HEAD = { 'content-type': 'application/json; charset=utf-8' };

/**
 * 读完请求体（跨 chunk 拼起来）后回调。
 * @param {import('http').IncomingMessage} req
 * @param {(body: string) => void} cb
 */
const readBody = (req, cb) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => cb(body));
};

/**
 * 用 JSON_HEAD 回一段 JSON。
 * @param {import('http').ServerResponse} res
 * @param {number} code
 * @param {unknown} obj
 */
const json = (res, code, obj) => {
  res.writeHead(code, JSON_HEAD);
  res.end(JSON.stringify(obj));
};

/** 405（方法不允许）的统一回包。 */
const methodNotAllowed = (res) => json(res, 405, { error: 'method not allowed' });

/**
 * 把一个「读 body → 解析 → 处理 → 回 JSON」的 POST handler 包成标准形态：
 * 方法不是 POST 就 405；body 解析失败回 400；处理器抛错也回 400（带 message）。
 * @param {(body: unknown, req: import('http').IncomingMessage) => unknown} handler
 *   返回要写回客户端的 JSON 对象（200）。
 * @returns {(req, res) => void}
 */
const postJson = (handler) => (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res)
  readBody(req, (body) => {
    let parsed;
    try {
      parsed = JSON.parse(body || '{}');
    } catch (e) {
      return json(res, 400, { error: e && e.message ? e.message : String(e) })
    }
    try {
      json(res, 200, handler(parsed, req));
    } catch (e) {
      json(res, 400, { error: e && e.message ? e.message : String(e) });
    }
  });
};

// dsh-omkb · server/device.js
//
// 与「设备」直接相关的三条只读/写回路由：
//   GET  /omkb/state     —— 状态快照（设备状态 + 灯态 + 诊断面）。
//   POST /omkb/config    —— 配置写回（亮度 / 自动调暗）。
//   ANY  /omkb/reconnect —— 手动重连（关句柄再 open）。
//
// 业务体（#state / applyConfig / 重连）都在 ble.js，这里只做 HTTP 壳。


/**
 * 注册 state / config / reconnect 三条路由。
 * @param {object} webServer
 * @param {object} ble - 门面（snapshot / applyConfig / reconnect）。
 * @param {{ warn: (msg: string) => void }} [log]
 * @returns {() => void} disposer（一次注销三条）。
 */
const registerDeviceRoutes = (webServer, ble, log = null) => {
  const disposers = [
    webServer.register({
      kind: 'exact',
      path: PATHS.state,
      handler: (_req, res) => json(res, 200, ble.snapshot())
    }),
    webServer.register({
      kind: 'exact',
      path: PATHS.config,
      handler: postJson((patch) => {
        ble.applyConfig(patch);
        return ble.state
      })
    }),
    webServer.register({
      kind: 'exact',
      path: PATHS.reconnect,
      handler: (_req, res) => {
        ble.reconnect();
        json(res, 200, ble.state);
      }
    })
  ];
  return () => {
    for (const d of disposers) {
      try { d && d(); } catch (e) { log && log.warn && log.warn(`[omkb] 设备路由注销失败: ${e && e.message}`); }
    }
  }
};

// dsh-omkb · server/agents.js
//
// POST /omkb/agents —— 浏览器把「Agent 键 LED 配置 + 当前会话 + 结果态」上报给宿主。
// 这是 7 条路由里最重的一条：它的业务体（期望灯态解析、结果态搬家、当前会话判据）都还在
// ble.js 的 applyAgents() 里，这里只做「读 body → 调 applyAgents → 回 state」的薄壳。
//
// 与业务的分界：server/ 只管「怎么从 HTTP 进来、怎么回 JSON」；「这条报文该把灯改成什么样」
// 属于设备/宿主逻辑，留在 ble.js。这样 ble.js 一行 HTTP 代码都不必认识。


/**
 * 注册灯态路由。
 * @param {object} webServer - 宿主注入的 webServer（有 register()）。
 * @param {object} ble - BLE 读取器门面（有 applyAgents / snapshot）。
 * @param {{ warn: (msg: string) => void }} [log] - 日志出口。
 * @returns {() => void} disposer。
 */
const registerAgentsRoute = (webServer, ble, log = null) => {
  const disposer = webServer.register({
    kind: 'exact',
    path: PATHS.agents,
    handler: postJson((payload) => {
      ble.applyAgents(payload);
      return ble.snapshot()
    })
  });
  // 与改动前一致：注册失败不该连累按键功能，只告警。
  return () => { try { disposer && disposer(); } catch (e) { log && log.warn && log.warn(`[omkb] 灯态路由注销失败: ${e && e.message}`); } }
};

// dsh-omkb · server/system.js
//
// 与「系统 / 宿主能力」相关的三条路由（与设备无关，浏览器自己做不到、只能宿主代劳）：
//   GET|POST /omkb/monitor        —— 输入监控授权状态（仅 macOS，读系统权限）。
//   POST      /omkb/open-privacy  —— 打开系统设置的隐私面板（浏览器不能 spawn）。
//   POST      /omkb/archive       —— 归档当前会话（宿主 workspaceRegistry.archiveSession）。
//
// 业务体（probeInputMonitor / openPrivacyPane / workspaceRegistry）都在别处，这里只做 HTTP 壳。
// 三条都「不强依赖」：宿主缺对应能力时静默不注册（archive），注册失败也只告警、不连累按键。


/**
 * 注册 monitor / open-privacy / archive 三条路由。
 * @param {object} webServer
 * @param {object} deps
 * @param {{ read: (force: boolean) => Promise<object> }} deps.monitor - 带缓存的检测器。
 * @param {(pane: string) => Promise<boolean>} deps.openPrivacy - 打开隐私面板。
 * @param {{ archiveSession: (id: string) => Promise<unknown> }|null} deps.workspaceRegistry
 *   归档服务；宿主版本缺失时为 null（不注册 archive 路由）。
 * @param {{ warn: (msg: string) => void }} [log]
 * @returns {() => void} disposer（一次注销全部三条）。
 */
const registerSystemRoutes = (webServer, deps, log = null) => {
  const disposers = [];

  // ---- 输入监控授权状态（仅 macOS）----
  // 走独立路由而不是塞进 /omkb/state：检测要 spawn 一个 osascript，而 state 是每秒被
  // 轮询的同步快照（塞进去会把每次轮询都变成一次进程启动）。
  try {
    disposers.push(webServer.register({
      kind: 'exact',
      path: PATHS.monitor,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'POST') {
          json(res, 405, { error: 'method not allowed' });
          return
        }
        const force = /[?&]force=1/.test(String(req.url || ''));
        deps.monitor.read(force).then(
          (r) => json(res, 200, r),
          (e) => json(res, 500, { supported: false, granted: null, detail: (e && e.message) || String(e) })
        );
      }
    }));
  } catch (e) {
    log && log.warn && log.warn(`[omkb] 输入监控路由注册失败: ${e && e.message}`);
  }

  // ---- 打开系统设置的隐私面板 ----
  try {
    disposers.push(webServer.register({
      kind: 'exact',
      path: PATHS.openPrivacy,
      handler: (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'method not allowed' });
          return
        }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          let pane = 'listen';
          try { pane = (JSON.parse(body || '{}').pane) || 'listen'; } catch (e) {}
          deps.openPrivacy(pane).then((ok) => {
            res.writeHead(ok ? 200 : 500, JSON_HEAD);
            res.end(JSON.stringify({ ok }));
          });
        });
      }
    }));
  } catch (e) {
    log && log.warn && log.warn(`[omkb] 系统设置跳转路由注册失败: ${e && e.message}`);
  }

  // ---- 归档当前会话 ----
  // 走宿主的 workspaceRegistry（官方「已归档聊天」机制）。服务可能因宿主版本缺失，
  // 这里不强依赖——可用才注册路由。
  const ws = deps.workspaceRegistry;
  if (ws && typeof ws.archiveSession === 'function') {
    try {
      disposers.push(webServer.register({
        kind: 'exact',
        path: PATHS.archive,
        handler(req, res) {
          if (req.method !== 'POST') {
            json(res, 405, { error: 'method not allowed' });
            return
          }
          let body = '';
          req.on('data', (c) => { body += c; });
          req.on('end', () => {
            try {
              const { sessionId } = JSON.parse(body || '{}');
              if (!sessionId) {
                json(res, 400, { error: 'missing sessionId' });
                return
              }
              Promise.resolve(ws.archiveSession(sessionId)).then(
                () => json(res, 200, { ok: true }),
                (e) => json(res, 500, { error: e && e.message ? e.message : String(e) })
              );
            } catch (e) {
              json(res, 400, { error: e && e.message ? e.message : String(e) });
            }
          });
        }
      }));
    } catch (e) {
      log && log.warn && log.warn(`[omkb] 归档路由注册失败: ${e && e.message}`);
    }
  }

  return () => {
    for (const d of disposers) {
      try { d && d(); } catch (e) { log && log.warn && log.warn(`[omkb] 系统路由注销失败: ${e && e.message}`); }
    }
  }
};

// dsh-omkb · server/index.js
//
// 「宿主与 webserver 通信」的唯一入口。所有 /omkb/* 路由（7 条）都在这里汇总注册，
// 由 server/ 下按功能域拆分的三个模块各自认领：
//   device.js  —— state / config / reconnect（与设备直接相关）
//   agents.js  —— agents（灯态，最重的一条）
//   system.js  —— monitor / open-privacy / archive（系统与宿主能力）
//
// 与 ble.js / index.js 的分界：
//   · ble.js 只管「设备 + 灯态业务」，**一行 HTTP 代码都不认识**；
//   · 这里的各模块只管「怎么从 HTTP 进来、怎么回 JSON」，业务体调 ble 门面；
//   · index.js（插件主体）把 ctx / ble / logger 递给 registerServerRoutes，自己不再碰路由细节。
//
// 注册动作发生在宿主注入 webServer 服务的上下文里（ctx.inject(['webServer'])），这是
// 依赖注入的硬要求：webServer 不是全局，必须声明依赖后才能访问。


/**
 * 汇总注册全部 7 条 /omkb/* 路由。
 *
 * @param {object} ctx - 宿主插件上下文（有 inject / get）。
 * @param {object} deps
 * @param {object} deps.ble - BLE 读取器门面（snapshot / state / applyAgents / applyConfig / reconnect）。
 * @param {object} deps.monitor - 带缓存的输入监控检测器（read(force)）。
 * @param {(pane: string) => Promise<boolean>} deps.openPrivacy - 打开隐私面板。
 * @param {{ warn: (msg: string) => void, info?: (msg: string) => void }} [deps.logger]
 * @returns {{ dispose: () => void }} 统一清理句柄（ble 相关 + 系统相关一起退订）。
 */
const registerServerRoutes = (ctx, deps) => {
  const { ble, monitor, openPrivacy, logger = null } = deps;
  const warn = (msg) => { logger && logger.warn && logger.warn(msg); };

  let disposeAll = null;

  ctx.inject(['webServer'], (wctx) => {
    const webServer = wctx.webServer;
    if (!webServer || typeof webServer.register !== 'function') {
      warn('[omkb] 宿主未提供 webServer 服务，HTTP 路由不可用');
      return
    }

    // 归档服务可选：宿主版本可能没给 workspaceRegistry。
    let ws = null;
    try {
      ws = (typeof wctx.get === 'function' && wctx.get('workspaceRegistry')) || wctx.workspaceRegistry || null;
    } catch (e) {
      ws = null;
    }
    if (!ws || typeof ws.archiveSession !== 'function') {
      warn('[omkb] 宿主未提供 workspaceRegistry.archiveSession，归档键不可用');
    }

    const disposers = [
      registerDeviceRoutes(webServer, ble, logger),
      registerAgentsRoute(webServer, ble, logger),
      registerSystemRoutes(webServer, { monitor, openPrivacy, workspaceRegistry: ws }, logger)
    ];
    disposeAll = () => { for (const d of disposers) d(); };
  });

  return { dispose: () => { if (disposeAll) { try { disposeAll(); } catch (e) {} } } }
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

  // ---- 该会话重新开跑 → 只收掉上面那个结果态，**不额外发报文** ----
  // 为什么订阅 agent/status 而不是等浏览器下发的 st=1：那是 agent loop 的**相位变化**
  // （setPhase → status 从 idle 变 running 才发，ds-agent-loop 里有「同值不许重发」的不变量），
  // 语义就是「这个会话又干活了」。而浏览器那份快照带 350ms 防抖，失败那一刻它手里往往还写着
  // 「这个会话在跑」——把它当判据会让红灯刚亮就被抹掉，正是这次要修的病。
  // 用户中断不会重新触发 running（相位已经回到 idle），所以中断过的会话结果态照旧保留。
  //
  // ⚠ **规则 2 暂时停用**（2026-09-27 用户要求：「clearOutcome 先不要，这个也会导致发送多条」）。
  //   原本这一跳还会让 `clearOutcome` 发一条「6 槽 st 全空闲」的清除报文，但 `running` 相位在
  //   「发一条消息」时也会来 → 那条清除报文 + 随后的浏览器那份（蓝·st=1）= 一次操作设备收到两条。
  //   现在 `clearOutcome` 只把结论从内部表里撤掉（红灯交由浏览器下一次推送重算时自然消失），
  //   设备画面由**浏览器那条推送**更正 —— 一场重试因此只剩一条。
  //
  // 只认 `running`：**idle 那一跳不发**（用户明确要求）。它是相位回落，紧跟在本轮的
  // turn-stopping/error 之后，刚写过的那份内容已经是最新的；再写一条只会让设备收到重复内容。
  // 只在真收掉了东西时打日志：多数 agent/status 与灯无关，不该刷屏。
  ctx.effect(() => ctx.on('agent/status', ({ agent, status }) => {
    try {
      if (status !== 'running') return
      const id = agent && agent.id;
      if (ble.clearOutcome(id)) logger.info(`[omkb] 会话 ${id} 重新开始运行 → 收掉结果灯（红/成功，不额外发报文）`);
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

  // ---- 全部 /omkb/* 路由（7 条）都交给 server/ 汇总注册 ----
  // server/index.js 是「宿主与 webserver 通信」的唯一入口：它负责在 ctx.inject(['webServer'])
  // 的上下文里把 state/config/reconnect/agents/monitor/open-privacy/archive 七条路由挂上去，
  // 并返回一个统一 disposer。业务体（灯态、归档、权限检测）仍在各自模块里，这里只递材料。
  // 输入监控检测器要在 apply 期间建一次（带缓存），路由与后续调用共用同一个实例。
  const monitor = createMonitorProbe();
  {
    const server = registerServerRoutes(ctx, { ble, monitor, openPrivacy: openPrivacyPane, logger });
    disposeRoute = server.dispose;
  }
}

export { Config, apply, name };
