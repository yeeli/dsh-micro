// dsh-omkb · client/src/entry.js
// 客户端插件入口：按依赖序实例化各控制器并挂到 DSVI.services，再注册 slots / locale /
// settingsScope / 全局 LED 刷新 effect。
// 每一段装配相互隔离（try/catch + 显式报错），避免某一段抛错拖垮整个 apply，
// 从而保住 hid 轮询 / 按键分派不因 UI 或偏好装配失败而失效。
import { DSVI } from './core.js'
import { VoiceController } from './voice.js'
import { AgentController } from './agents.js'
import { KeypadController } from './keypad/index.js'
import { KnobController } from './knob.js'
import { JoystickController } from './joystick.js'
import { HidBridge } from './hid-bridge.js'
import { GuideController } from './guide.js'
import { DeviceController } from './device.js'
import { DshOps, levelRows, parseLevelFromLabel, currentLevelIndex, openReasoningLevels, closeReasoningLevels, ringTo, commitLevel, findReasoningTrigger, scrollStepSize, findScrollContainer, scrollToBottomDir, focusCollect, isTextEntry, ACTIONS, runAction, keycapActions, knobActions } from './actions/index.js'
import { OmkbSettingsSection } from './components/settings-panel.jsx'
import { VoiceInputButton } from './components/voice-button.jsx'
import { OmkbSidebarAction, FOOT_ACTION_ID, FOOT_ACTION_SLOT } from './components/sidebar-action.jsx'
import { installNavIconPatch, setNavRowHidden, NAV_ICON_SIZE } from './nav-icon.js'

DSVI.inject = ['slots', 'locale', 'settingsScope', 'sessions', 'workspaces'];

const err = (tag, e) => { try { console.error('[omkb] 装配失败 ' + tag + ':', e) } catch (_) {} }

DSVI.apply = (ctx) => {
  // 1) 样式
  try { ctx.effect(DSVI.installStyles, `${DSVI.NS}: styles`) } catch (e) { err('styles', e) }

  // 2) 控制器装配（按键/灯光分派的根基，失败会连累整个 hid 桥）
  let voice = null, agents = null, keypad = null, knob = null, joystick = null, hid = null, ops = null, guide = null, device = null
  try {
    voice = new VoiceController();
    agents = new AgentController();
    agents.setSessions(ctx.sessions);
    // workspaces 提供归档会话集合（侧边栏隐藏谁，键盘灯就不该亮谁）。
    agents.setWorkspaces(ctx.workspaces);
    let conversation = null;
    try { conversation = typeof ctx.get === 'function' ? ctx.get('conversation') : (ctx.conversation || null) } catch (e) {}
    if (conversation) agents.setConversation(conversation);
    // DSH 功能门面：按键/摇杆/旋钮要执行的每一个 DSH 操作都从它走（见 actions/）。
    // services 必须是**延迟取值**的函数：layout / remote.commands 由别的客户端插件提供，
    // 晚于本插件加载，只有到真正要用它的那一刻取才拿得到。
    ops = new DshOps({
      sessions: ctx.sessions,
      conversation,
      services: (name) => (typeof ctx.get === 'function' ? ctx.get(name) : undefined)
    });
    keypad = new KeypadController({ voice, ops });
    knob = new KnobController({ voice, ops });
    joystick = new JoystickController({ ops, voice });
    // 桥接层**不收 voice**：语音只能由显式动作触发（ACT10/ACT11 或设置页里绑定的动作），
    // 不让它碰语音控制器，就从结构上堵死「认不出来的事件 → 误开语音」那类问题。
    hid = new HidBridge({ agents, keypad, knob, joystick });
    // 首次连接引导：**只读** /omkb/state 的 `open`，不参与任何按键分派（见 guide.js 顶部）。
    // 设置作用域要等下面 UI 段才拿得到，所以先建实例、那边再 setScope。
    guide = new GuideController({ hid });
    // 设备级状态（「这台键盘被移除了没有」）：同样只订阅广播读 `open`。清空偏好要用到
    // 默认字段清单 —— 直接给它设置页那份（DSVI.OMKB_DEFAULTS 与宿主 schema 逐字段对齐）。
    device = new DeviceController({ hid, defaults: DSVI.OMKB_DEFAULTS });
    DSVI.services = { voice, agents, keypad, knob, joystick, hid, ops, guide, device };
    // 旋钮「仅推理 / 对话滚动 / 输入区导航」用到的定位函数（纯函数）：控制台与自检直接验，
    // 不必真的去转硬件 —— __dshOmkb.knobTools.levelRows() / .focusCollect()。
    DSVI.knobTools = {
      levelRows, parseLevelFromLabel, currentLevelIndex, findReasoningTrigger,
      openReasoningLevels, closeReasoningLevels, ringTo, commitLevel, scrollStepSize,
      findScrollContainer, scrollToBottomDir, focusCollect, isTextEntry
    };
    // 功能总表（actions/registry.js）也挂到调试句柄上：设备没在手边时，
    //   __dshOmkb.actions.list()                    // 现在有哪些功能（谁绑在哪颗键上）
    //   __dshOmkb.actions.run('fork')               // 直接试一个功能，不必真按硬件
    //   __dshOmkb.actions.keycaps() / .knob()       // 键帽候选 / 旋钮下拉里能选到的那些
    DSVI.actions = { list: () => ACTIONS, run: runAction, keycaps: keycapActions, knob: knobActions };
    // 浏览器控制台调试句柄：不推杆也能验动作（设备没在手边时尤其有用）——
    //   __dshOmkb.services.joystick.getMapping()        // 看四个方向当前绑了什么
    //   __dshOmkb.services.joystick.run('切换规划模式')   // 单独试一个动作
    //   __dshOmkb.services.ops.togglePlan()             // 直接调 DSH 操作（跳过按键/摇杆/旋钮）
    //   __dshOmkb.services.hid.diagnose()               // 有没有「认不出来被忽略」的按键
    //   __dshOmkb.services.guide.diagnose()             // 首次连接引导为什么没弹（/ 弹过了）
    //   __dshOmkb.services.guide.replay()               // 手验引导三屏（不必真拔插设备）
    //   __dshOmkb.services.device.diagnose()            // 界面为什么收起/显示（移除的状态）
    //   __dshOmkb.services.device.setPrefs({ removed: true }) // 手验「移除后收起」（**不落盘**）
    //   __dshOmkb.actions.run('fork')                   // 手验任意功能按键（不必真按设备）
    //   __dshOmkb.knobTools.levelRows()                 // 推理等级列表当前有哪几档
    //   __dshOmkb.knobTools.ringTo(null, 2)             // 手验「把蓝环移到第 3 档」
    //   document.querySelector('[data-omkb-knob]')      // 蓝环现在落在谁身上
    //   __dshOmkb.knobTools.focusCollect()              // 旋钮旋转会依次停在哪些控件上
    try { if (typeof window !== 'undefined') window.__dshOmkb = DSVI } catch (e) {}
  } catch (e) { err('controllers', e) }

  // 3) 启动 BLE/HID 轮询（独立隔离：即使上方某段失败，只要 hid 实例在就继续轮询）
  if (hid) {
    try { ctx.effect(() => { hid.start(); return () => hid.stop() }, `${DSVI.NS}: hid-bridge`) }
    catch (e) { err('hid', e) }
  }

  // 3b) 首次连接引导：订阅同一路状态广播，只认 open（独立一段，坏了不影响按键/灯光）
  if (guide) {
    try { ctx.effect(() => { guide.start(); return () => guide.stop() }, `${DSVI.NS}: guide`) }
    catch (e) { err('guide', e) }
  }

  // 3c) 设备级状态（移除/恢复）：同一路广播、同一段生命周期。**必须独立**于 UI 段 ——
  // 「设备重新连上 → 把界面放回来」这件事在设置页关着的时候也要发生（那时 UI 段
  // 的组件都没挂载，只能靠这里订阅着）。
  if (device) {
    try { ctx.effect(() => { device.start(); return () => device.stop() }, `${DSVI.NS}: device`) }
    catch (e) { err('device', e) }
  }

  // 4) 设置页（locale + settingsScope + sessions），失败不影响按键/灯光
  try {
    ctx.effect(() => ctx.locale.register(DSVI.NS, DSVI.locales), `${DSVI.NS}: locale`);
    const t = ctx.locale.bind(DSVI.NS);
    const scope = ctx.settingsScope.bind({ namespace: DSVI.NS });
    const sessions = ctx.sessions;
    // 引导的「看过没有」就住在设置里（guideSeen）：给了 scope 它才敢弹 —— 记不住就不打扰
    // （见 guide.js 的 #canRemember）。scope 拿不到时整段会抛，那时引导保持「不弹」。
    if (guide) guide.setScope(scope);
    // 设备级状态同理：「移除」要写盘、重连要清标记，没有 scope 就什么都做不了（见 device.js）。
    if (device) device.setScope(scope);

    // 会话列表 / 归档集合 / 偏好变化 → 刷新 Agent 键 LED 并同步旋钮模式。
    // 归档集合住在 workspaces 快照里，必须一并订阅：只订阅会话列表的话，
    // 归档一个会话不会立刻熄掉它对应的那颗灯。
    ctx.effect(() => {
      const readPrefs = () => { try { const s = scope.getSnapshot(); return (s && s.value) || {} } catch (e) { return {} } };
      const list = sessions && sessions.list ? sessions.list : null;
      const wsList = ctx.workspaces && ctx.workspaces.list ? ctx.workspaces.list : null;
      const refresh = () => {
        try {
          const p = readPrefs();
          if (knob) { knob.setMode(p.knob || 'navigate'); knob.setCustom(p.knobCustom || {}) }
          // 摇杆方向映射（设置页「模拟摇杆」里选的四个动作）
          if (joystick) joystick.setMapping(p.joystick)
          // 按键功能：键帽那一格同时决定「按下执行什么」（见 keypad/index.js 的 resolve）。
          // 不灌进来会一直按出厂默认走，用户改了键帽却看不见行为变化。
          if (keypad) keypad.setKeyMap(p.actLabels, !!p.micKey)
          if (agents) agents.refresh(p, list ? list.getSnapshot() : null);
          // 引导也要这份快照：prefs 既是「看没看过」的判据，也是键盘插图的画法来源
          if (guide) guide.setPrefs(p);
          // 设备级状态也看这份快照（只看 removed）：设置页写成功之后界面才会跟着收起/放回
          if (device) device.setPrefs(p);
        } catch (e) { err('agents-refresh', e) }
      };
      const offList = list && typeof list.subscribe === 'function' ? list.subscribe(refresh) : null;
      const offWs = wsList && typeof wsList.subscribe === 'function' ? wsList.subscribe(refresh) : null;
      const offScope = typeof scope.subscribe === 'function' ? scope.subscribe(refresh) : null;
      refresh();
      return () => { if (offList) offList(); if (offWs) offWs(); if (offScope) offScope() };
    }, `${DSVI.NS}: agents`);

    // 注入麦克风按钮 → 输入框工具行左侧
    ctx.slots.inject(DSVI.SLOT_INPUT, () =>
      ctx.slots.register({ name: DSVI.SLOT_INPUT, id: 'omkb-voice', order: 100 }, VoiceInputButton)
    );

    // 注入设置页 → omkb 键盘
    ctx.slots.inject('settings.section', () => {
      const dispose = ctx.slots.register({
        name: 'settings.section',
        id: 'omkb',
        order: 60,
        label: () => t('nav'),
        inject: () => ({ scope, t, sessions, workspaces: ctx.workspaces })
      }, OmkbSettingsSection);
      return () => { dispose() };
    });
  } catch (e) { err('ui', e) }

  // 5) 侧边栏底部「设置」旁边的小键盘图标 → 一键打开键盘设置页。
  // 独立一段：上面 ui 段任何一处失败都不该让这个入口消失（它只依赖 slots + locale）。
  try {
    ctx.slots.inject(FOOT_ACTION_SLOT, () => {
      const dispose = ctx.slots.register({
        name: FOOT_ACTION_SLOT,
        id: FOOT_ACTION_ID,
        order: 50,
        locale: DSVI.NS
      }, OmkbSidebarAction);
      return () => { dispose() };
    });
  } catch (e) { err('sidebar-action', e) }

  // 6) 设置页左侧导航里「OMKB 键盘」那一项的图标 → 我们的键盘图标。
  // 独立一段：DSH 那边只按 section id 查表给图标（插件注册时没有 icon 字段可给），
  // 想让它是键盘就得改 DOM —— 这段坏了最多图标退回齿轮，不能连累别的。
  try {
    ctx.effect(() => installNavIconPatch({ size: NAV_ICON_SIZE }), `${DSVI.NS}: nav-icon`)
  } catch (e) { err('nav-icon', e) }

  // 6b) 「移除键盘」之后把设置页导航里那一行**整行**藏起来（设备重新连上再放出来）。
  // 为什么不注销设置分区：分区的注册一旦发出就收不回来（`ctx.slots.register` 返回的 dispose
  // 会不会让 DSH 的设置导航跟着消失，从插件侧确认不了 —— 工作区外的东西本轮一律不读），
  // 而这一行本来就是我们已经在补图标的那一行，多一个 display 开关是最小改动。
  if (device) {
    try {
      ctx.effect(() => {
        const apply = () => { try { setNavRowHidden(device.hidden) } catch (e) {} }
        const off = device.subscribe(apply)
        apply()
        return () => { off(); setNavRowHidden(false) }
      }, `${DSVI.NS}: nav-row-hidden`)
    } catch (e) { err('nav-row-hidden', e) }
  }
};
