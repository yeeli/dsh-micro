// dsh-omkb · client/src/entry.js
// 客户端插件入口：按依赖序实例化各控制器并挂到 DSVI.services，再注册 slots / locale /
// 设置表单（configForms）/ 全局 LED 刷新 effect。
// 每一段装配相互隔离（try/catch + 显式报错），避免某一段抛错拖垮整个 apply，
// 从而保住 hid 轮询 / 按键分派不因 UI 或偏好装配失败而失效。
import { DSVI } from './core.js'
import { VoiceController } from './voice.js'
import { AgentController } from './agents.js'
import { KeypadController } from './keypad.js'
import { KnobController } from './knob.js'
import { AttentionController } from './attention.js'
import { JoystickController } from './joystick.js'
import { JoystickHud } from './joystick-hud.js'
import { OmkbNotice, NOTICE_REASON, NOTICE_TEXT_FALLBACK, NOTICE_MS, NOTICE_COALESCE_MS } from './notice.js'
import { HidBridge } from './hid-bridge.js'
import { GuideController } from './guide.js'
import { DeviceController } from './device.js'
import { DshOps, levelRows, parseLevelFromLabel, currentLevelIndex, openReasoningLevels, closeReasoningLevels, ringTo, commitLevel, findReasoningTrigger, scrollStepSize, findScrollContainer, scrollToBottomDir, focusCollect, isTextEntry, interactionPanelRoot, panelAnswerOf, pickPanelButton, ACTIONS, runAction, keycapActions, knobActions } from './actions/index.js'
import { OmkbSettingsSection } from './components/settings/panel.jsx'
import { VoiceInputButton } from './components/common/voice-button.jsx'
import { OmkbSidebarAction, FOOT_ACTION_ID, FOOT_ACTION_SLOT, openKeyboardSettings, openGeneralSettings } from './components/sidebar/action.jsx'
import { installNavIconPatch, setNavRowHidden, NAV_ICON_SIZE } from './sidebar.js'
// 摇杆提示卡片的样式（会话界面顶部那张）。与设置页的 settings.css 同一套做法：模块级追加到
// DSVI.css，随第 1 段的 installStyles 一次性注入 <style>。
import hudCss from './assets/hud.css?raw'
// 顶部提示的样式（「这颗键在当前页面做不了」，见 notice.js）。与 hud.css 同一套做法：
// 模块级追加到 DSVI.css，随第 1 段的 installStyles 一次性注入 <style>。
import noticeCss from './assets/notice.css?raw'

DSVI.css += hudCss
DSVI.css += noticeCss

// 声明式依赖：**只列这里真的整份离不开的服务**（缺一个，runner 就让整个客户端入口
// 停在这一行，web boot 会报 `dsh-omkb: pending (waiting for service: …)`——不是设置页
// 坏掉，是界面与按键分派一起不激活）。
// 「可能没有、没有也要能跑」的服务一律**不进列表**，改用 `ctx.get(name)` 现场可选查找
// （0.1.7-rc.2 的 runner 明确把它当可选取用：`ctx.get` 不要求声明，直读 `ctx.xxx` 才要求）。
// uiWorkspace / layout / conversation / remote.commands 都走这条路，见下面各处注释。
DSVI.inject = ['slots', 'locale', 'configForms', 'sessions', 'workspaces'];

const err = (tag, e) => { try { console.error('[omkb] 装配失败 ' + tag + ':', e) } catch (_) {} }

DSVI.apply = (ctx) => {
  // 1) 样式
  try { ctx.effect(DSVI.installStyles, `${DSVI.NS}: styles`) } catch (e) { err('styles', e) }

  // 2) 控制器装配（按键/灯光分派的根基，失败会连累整个 hid 桥）
  let voice = null, agents = null, keypad = null, knob = null, joystick = null, hid = null, ops = null, guide = null, device = null, notice = null, attention = null
  try {
    voice = new VoiceController();
    // services 必须**延迟取值**（同下面 DshOps 那条）：uiWorkspace 晚于本插件加载，
    // 而智能体键要它才能打开会话（`uiWorkspace.openSession`，见 agents.js openSlot）。
    agents = new AgentController({ services: (name) => ctx.get(name) });
    agents.setSessions(ctx.sessions);
    // workspaces 提供归档会话集合（侧边栏隐藏谁，键盘灯就不该亮谁）。
    agents.setWorkspaces(ctx.workspaces);
    // conversation 不在 inject 里（它由 ui-conversation 提供，但缺了也不该拖住整个入口），
    // 所以走可选查找；拿不到就是 null，下面按「没有对话服务」降级。
    const conversation = ctx.get('conversation') || null;
    if (conversation) agents.setConversation(conversation);
    // 顶部提示（「这颗键在当前页面做不了」，见 notice.js）：**纯 DOM**，节点第一次真要显示时才建，
    // 所以在这里建实例不必等任何界面挂载。词典**延迟取** —— 这一段比第 4 段的 locale.register 早，
    // 而提示要到真按了键才需要文案（同下面 joy-hud 那条的 tt 做法）。
    notice = new OmkbNotice({
      t: (key) => { try { return ctx.locale.bind(DSVI.NS)(key) } catch (e) { return key } }
    });
    // DSH 功能门面：按键/摇杆/旋钮要执行的每一个 DSH 操作都从它走（见 actions/）。
    // services 必须是**延迟取值**的函数：layout / remote.commands 由别的客户端插件提供，
    // 晚于本插件加载，只有到真正要用它的那一刻取才拿得到。
    ops = new DshOps({
      sessions: ctx.sessions,
      conversation,
      services: (name) => ctx.get(name),
      // 「打开本插件设置页」的深链**只能从这里注入**：门面不许 import 那个 JSX 模块
      // （会形成 action.jsx ↔ actions/index.js 的循环，而且 Node 侧自检进不去 JSX）。
      // 长按旋钮就是走这一条（registry 的 open_settings）——与设置页里那个按钮同源。
      // 候选标题由词典里各语言的 nav 兜住，所以不必等下面 UI 段才有的 t。
      //
      // 「通用设置」是同一份深链的另一个落点（action.jsx 里共用 openSection）：键帽上那颗齿轮
      // 「设置」走它，与「键盘设置」共用点击顺序，不会一处能开一处打不开。
      openSettings: () => openKeyboardSettings(),
      openGeneralSettings: () => openGeneralSettings()
    });
    keypad = new KeypadController({ voice, ops, notice: notice ? notice.showKey : null });
    knob = new KnobController({ voice, ops });
    // 弹窗注意力（用户 2026-09-29）：批准弹窗 → 当前会话那颗键转黄；旋钮 / 输入框「+」打开的
    // 弹窗 → 转粉，直到弹窗关闭。它只**看界面 + 上报**，颜色怎么用全在宿主（见 attention.js 顶注）。
    // 「按下旋钮」这一刻只有 knob 知道（见 knob.js 的 setOnPress），所以在这里接上。
    attention = new AttentionController({ agents, log: (m) => { try { console.log('[omkb] ' + m) } catch (e) {} } });
    knob.setOnPress(attention.arm);
    joystick = new JoystickController({ ops, voice });
    // 桥接层**不收 voice**：语音只能由显式动作触发（ACT10/ACT11 或设置页里绑定的动作），
    // 不让它碰语音控制器，就从结构上堵死「认不出来的事件 → 误开语音」那类问题。
    hid = new HidBridge({ agents, keypad, knob, joystick });
    // 首次连接引导：**只读** /omkb/state 的 `open`，不参与任何按键分派（见 guide.js 顶部）。
    // 设置表单要等下面 UI 段才拿得到，所以先建实例、那边再 setScope。
    guide = new GuideController({ hid });
    // 设备级状态（「这台键盘被移除了没有」）：同样只订阅广播读 `open`。清空偏好要用到
    // 默认字段清单 —— 直接给它设置页那份（DSVI.OMKB_DEFAULTS 与宿主 schema 逐字段对齐）。
    device = new DeviceController({ hid, defaults: DSVI.OMKB_DEFAULTS });
    DSVI.services = { voice, agents, keypad, knob, joystick, hid, ops, guide, device, notice, attention };
    // 旋钮「仅推理 / 对话滚动 / 输入区导航」用到的定位函数（纯函数）：控制台与自检直接验，
    // 不必真的去转硬件 —— __dshOmkb.knobTools.levelRows() / .focusCollect()。
    DSVI.knobTools = {
      levelRows, parseLevelFromLabel, currentLevelIndex, findReasoningTrigger,
      openReasoningLevels, closeReasoningLevels, ringTo, commitLevel, scrollStepSize,
      findScrollContainer, scrollToBottomDir, focusCollect, isTextEntry,
      // 待确认弹窗那三件：探针要能直接问「现在这张弹窗我认出来了吗、这两颗键会点哪个」，
      // 控制台也能手验（`__dshOmkb.knobTools.interactionPanelRoot()`）—— 判据只有一份。
      interactionPanelRoot, panelAnswerOf, pickPanelButton
    };
    DSVI.actions = { list: () => ACTIONS, run: runAction, keycaps: keycapActions, knob: knobActions };
    // 顶部提示的**原因表**也挂出来：探针要能把每一种提示逐条显示一遍看措辞
    // （`__dshOmkb.noticeTools.NOTICE_REASON` 的键就是可以丢给 notice.showKey 的 id）。
    // 与 knobTools 同一条理由：判据只有一份，探针/控制台里不许再抄一份 id 清单。
    DSVI.noticeTools = { NOTICE_REASON, NOTICE_TEXT_FALLBACK, NOTICE_MS, NOTICE_COALESCE_MS };
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

  // 3d) 摇杆提示卡片（会话界面顶部居中）：推着就实时跟着画，松手再停留 1.5s。
  // 两条数据线各管各的（见 joystick-hud.js 的文件头）：
  //   · hid.subscribe → feed()   只管画面（joy / joyD / joyA），**不产生任何动作**；
  //   · joystick.onGesture → notify() 只管文案（方向 + 动作名 + 结果）。
  // 设置页打开期间（演示闸门）直接收起来：那一页有自己的布局动画，再浮一张卡片只会碍事。
  if (hid && joystick) {
    try {
      ctx.effect(() => {
        // 词典**延迟取**：这段比第 4 段的 locale.register 早，而卡片要到真推杆时才需要文案。
        // 取不到（或词条没绑）时卡片自己有内置中文兜底，见 joystick-hud.js 的 #text()。
        const tt = (key) => { try { return ctx.locale.bind(DSVI.NS)(key) } catch (e) { return key } };
        const hud = new JoystickHud({ t: tt });
        const off = hid.subscribe((s) => {
          if (hid.simulating) hud.hide()
          else hud.feed(s)
        });
        joystick.setOnGesture(hud.notify);
        if (DSVI.services) DSVI.services.hud = hud;
        return () => {
          off();
          joystick.setOnGesture(null);
          if (DSVI.services && DSVI.services.hud === hud) DSVI.services.hud = null;
          hud.dispose();
        }
      }, `${DSVI.NS}: joy-hud`)
    } catch (e) { err('joy-hud', e) }
  }

  // 3e) 顶部提示的收尾：卸载时把节点从 body 上摘掉。
  // 独立一段（同上面的 joy-hud）：坏了最多是「重装后在 body 上留一个死节点」，
  // 绝不能连累按键分派与灯光。
  if (notice) {
    try { ctx.effect(() => () => notice.dispose(), `${DSVI.NS}: notice`) }
    catch (e) { err('notice', e) }
  }

  // 3f) 弹窗注意力探测（批准弹窗 → 黄；旋钮/「+」招来的弹窗 → 粉）。
  // 独立一段：它只读界面、只上报灯色，坏了最多是「弹窗不再变色」，不能连累按键分派。
  if (attention) {
    try { ctx.effect(() => { attention.start(); return () => attention.stop() }, `${DSVI.NS}: attention`) }
    catch (e) { err('attention', e) }
  }

  // 4) 设置页（locale + configForms + sessions），失败不影响按键/灯光
  try {
    ctx.effect(() => ctx.locale.register(DSVI.NS, DSVI.locales), `${DSVI.NS}: locale`);
    const t = ctx.locale.bind(DSVI.NS);
    // 设置表单：0.1.7-rc.2 起唯一入口。命名空间就是宿主那条 loader 条目的 id（dsh-omkb），
    // 表单面跟着旧 scope 的形状（getSnapshot/subscribe/set/unset/mutate）—— 宿主没把
    // schema 登记上时它恒为 unavailable，写入被丢弃（设置页会如实报「保存失败」）。
    const scope = ctx.configForms.get(DSVI.NS);
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
          // 按键功能：键帽那一格同时决定「按下执行什么」（见 keypad.js 的 resolve）。
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
        inject: () => ({
          scope,
          t,
          sessions,
          // 注意：**不再注入 services 检测函数**。设置页底部「第三方插件」卡以前靠它现场判
          // 「某插件装没装」，2026-09-26 起改成读配置（src/client/config/default.js 的
          // PLUGIN_DEPS，静态、不检测系统）。
          workspaces: ctx.workspaces
        })
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
