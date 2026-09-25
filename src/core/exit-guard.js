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
export const SIGNUM = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }

/** 我们关心的退出信号。SIGHUP 也收：关终端窗口时 macOS 发的是它。 */
export const EXIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']

/**
 * 信号对应的退出码（128 + n）。未知信号退化为 1，绝不返回 undefined。
 * @param sig - 信号名。
 * @returns {number}
 */
export const exitCodeOf = (sig) => 128 + (SIGNUM[sig] || 0)

/**
 * 收到信号后的决策 —— 本模块唯一的判据，纯函数。
 *   'exit'     我们自己退（没人管这个信号，或用户已经按了不止一次）
 *   'handover' 只释放资源，退出交给宿主
 * @param {{seen: number, others: number}} args - seen = 收到信号的次数（只算外部派发）；
 *   others = 除本安全网之外，这个信号还有几个监听者。
 * @returns {'exit'|'handover'}
 */
export const exitPlan = ({ seen, others }) => (seen >= 2 || others === 0 ? 'exit' : 'handover')

/**
 * 所有由本模块注册的处理函数。用来把「我们自己的监听者」从 others 里剔除：
 * 一个进程里可能存在多个安全网实例（插件被 apply 多次），它们之间不能互相礼让。
 * 用 WeakSet 而不是数组：实例被回收后不需要清理。
 */
const GUARD_LISTENERS = new WeakSet()

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
export const createExitGuard = ({
  release,
  blackout,
  proc = globalThis.process,
  signals = EXIT_SIGNALS,
  schedule = setImmediate,
  log = null,
  exit = null
} = {}) => {
  /** 信号名 → 我们注册的处理函数（也是「装没装」的判据）。 */
  const handlers = new Map()
  /** 收到信号的次数。**只统计外部派发**：本模块从不重发信号，所以这个计数是可信的。 */
  let seen = 0
  /** 释放只做一次（幂等闸门；释放失败也不重试，退出路径上不该有重试循环）。 */
  let released = false
  /** 灭灯只做一次：三处落点（exit 分支 / handover 的下一拍 / 'exit' 钩子）可能先后都跑到。 */
  let blackedOut = false
  /** 挂在 proc 上的 `'exit'` 监听者（`null` = 没装）。幂等的依据。 */
  let exitHook = null

  const say = (msg) => { try { if (log) log(msg) } catch (e) {} }

  /** 释放自己握着的资源，最多一次，绝不抛。 */
  const releaseOnce = () => {
    if (released) return false
    released = true
    try {
      if (typeof release === 'function') release()
    } catch (e) {
      // 释放失败不能影响退出：设备句柄由操作系统回收。
      say(`释放资源失败（忽略）：${(e && e.message) || e}`)
    }
    return true
  }

  /**
   * 灭灯，最多一次，绝不抛。**必须在释放之前调用** —— 释放会关掉句柄，之后写不出去。
   * 三处落点：exit 分支（我们拥有退出权）、handover 的下一拍（排在释放前）、`'exit'` 钩子（兜底）。
   */
  const blackoutOnce = () => {
    if (blackedOut) return false
    blackedOut = true
    try {
      if (typeof blackout === 'function') blackout()
    } catch (e) {
      // 灭灯失败也得退：宁可留一盏灯，也不能因为关灯把进程卡在退出路径上。
      say(`退出前灭灯失败（忽略）：${(e && e.message) || e}`)
    }
    return true
  }

  /** 真正退出。走注入的 exit（默认 proc.exit），顺带把退出码写进 exitCode（便于诊断）。 */
  const doExit = (sig) => {
    const code = exitCodeOf(sig)
    try { proc.exitCode = code } catch (e) {}
    if (typeof exit === 'function') return exit(code)
    return proc.exit(code)
  }

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
  }

  const makeHandler = (sig) => function exitGuardHandler() {
    const mine = handlers.get(sig)
    seen += 1
    const others = othersFor(sig, mine)

    if (exitPlan({ seen, others }) === 'exit') {
      // 我们拥有退出权（没人管这个信号），或是用户又按了一次。
      // ⚠ 这条路**故意不释放**：同步的原生 close 可能阻塞，而退出根本不需要它
      //   （进程一走，句柄由操作系统回收）。旧实现就是在这儿卡死的。
      //   —— 但**灭灯不能省**：灯是设备记着的，操作系统不会替我们关（见文件头那一节）。
      blackoutOnce()
      say(seen >= 2
        ? `收到 ${sig}（第 ${seen} 次），强制退出 ${exitCodeOf(sig)}`
        : `收到 ${sig}，宿主未接管该信号，按默认语义退出 ${exitCodeOf(sig)}`)
      return doExit(sig)
    }

    // 宿主在管这个信号：我们只帮它把事件循环排空（下一拍，别占用信号回调），
    // 退不退、怎么退，由宿主决定。
    // ⚠ **灭灯必须排在这一拍里、且排在释放之前**：释放会 close 掉句柄，之后谁都写不出去；
    //   而宿主的优雅退出是异步的，等它跑到插件 dispose 时 `state.open` 已经是我们关的了，
    //   dispose 里那句灭灯会被守卫挡下 —— 灯就一直亮着（用户报的正是这个）。
    const handoff = () => { blackoutOnce(); releaseOnce() }
    try {
      schedule(handoff)
    } catch (e) {
      handoff()
    }
  }

  /**
   * 装上安全网。幂等：重复调用不会叠加监听者。
   * 除了三个信号，还会挂一个 `'exit'` 钩子 —— 见文件头「退出前必须灭灯」第 3 条。
   * @returns {number} 本次新增的**信号**监听者个数（0 = 之前已经装好；`'exit'` 钩子不计入）。
   */
  const install = () => {
    let added = 0
    for (const sig of signals) {
      if (handlers.has(sig)) continue
      const h = makeHandler(sig)
      GUARD_LISTENERS.add(h)
      try {
        proc.on(sig, h)
        handlers.set(sig, h)
        added += 1
      } catch (e) {
        // 某些信号在个别平台上不允许监听（或不是有效信号名）→ 跳过，不影响其它信号。
        GUARD_LISTENERS.delete(h)
      }
    }
    // `'exit'` 兜底：宿主自己的信号处理可能先跑、并直接 process.exit()，我们的信号回调压根
    // 不执行 —— 那时唯一还来得及的地方就是这里（process.exit 一定会触发 'exit'，HID 写是同步的）。
    if (!exitHook) {
      try {
        const h = () => { blackoutOnce() }
        proc.on('exit', h)
        exitHook = h
      } catch (e) {
        exitHook = null
      }
    }
    return added
  }

  /**
   * 卸下安全网：**只移除自己注册的那几个函数**（宿主自己装的监听者一个都不碰）。
   * 幂等，可重复调用。
   * @returns {number} 本次移除的**信号**监听者个数（`'exit'` 钩子不计入）。
   */
  const dispose = () => {
    let removed = 0
    for (const [sig, h] of [...handlers]) {
      handlers.delete(sig)
      try {
        const off = typeof proc.off === 'function' ? proc.off : proc.removeListener
        off.call(proc, sig, h)
        removed += 1
      } catch (e) {}
    }
    if (exitHook) {
      try {
        const off = typeof proc.off === 'function' ? proc.off : proc.removeListener
        off.call(proc, 'exit', exitHook)
      } catch (e) {}
      exitHook = null
    }
    return removed
  }

  return { install, dispose, releaseOnce, blackoutOnce, isInstalled: () => handlers.size > 0, handlers }
}
