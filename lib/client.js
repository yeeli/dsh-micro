// dsh-micro · 客户端（Client）· 由 Vite + client_build.js 生成，勿手改。
// 源码在 src/client/，改后执行：npm run build:client
window.__ModuleLoader__.load({
  id: 'dsh-micro',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
"use strict";
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
var _recognizer, _listening, _unsupported, _official, _stopWait, _beforeDraft, _finalText, _interimText, _commit, _listeners, _officialActive, _emit, _setListening, _fullText, _push, _stopOfficial, _clearStopWait, _last, _lastEnc, _lastJoy, _lastJoyT, _lastJoyPush, _lastKnobPress, _lastKnobLong, _lastDown, _tapTimer, _socket, _retryTimer, _retryMs, _warned, _subs, _sim, _HidBridge_instances, startPolling_fn, stopPolling_fn, socketUrl_fn, connect_fn, scheduleReconnect_fn, _dispatch, _emit2, handleFrame_fn, _consumeReleases, _release, _guardTap, _baseline, _consumeJoystick, _consumeKnob, _knobPress, _knobLong, _noteUnhandled, _slots, _pushTimer, _allIdle, _attention, _lastPush, _lastSentBody, _services, _log, _service, _doc, _t, _ms, _log2, _root, _els, _timer, _shown, _warnedMissingDoc, _docOf, _cancel, _restart, _el, _ensure, _capAction, _factoryAction, _note, _refuse, _ref, _onPress, _customGesture, _mapping, _ops, _voice, _log3, _onGesture, _execute, _result, _gesture, _agents, _timer2, _armTimer, _armed, _sawPopup, _reported, _onClick, _log4, _arm, _disarm, _handleClick, _tick, _report, _doc2, _t2, _lingerMs, _log5, _root2, _els2, _timer3, _phase, _info, _push2, _warnedMissingDoc2, _docOf2, _text, _cancelLinger, _startLinger, _show, _el2, _ensure2, _paint, _hid, _scope, _prefs, _open, _step, _shown2, _off, _subs2, _canRemember, _emit3, _onState, _remember, _hid2, _scope2, _defaults, _prefs2, _open2, _seen, _off2, _subs3, _restoring, _restoreWarned, _emit4, _onState2, _snapshot, _readBack, _unset, _restore, _services2, _log6, _openSettings, _openGeneralSettings, _composer, _navIndex, _navList, _lastDeny, _service2, _deny, _answerOnPanel, _setDraft, _presetName, _routeName;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
const jsxRuntime = require("react/jsx-runtime");
const currentSessionIdIn = (snapshot2) => {
  if (!snapshot2) return null;
  if (snapshot2.current) return snapshot2.current;
  const byId = snapshot2.byId || {};
  const ids = Array.isArray(snapshot2.ids) && snapshot2.ids.length ? snapshot2.ids : Object.keys(byId);
  for (const id of ids) {
    const row = byId[id];
    if (!row) continue;
    const retained = row.retainedBy || null;
    if (retained && (retained.mainView ?? 0) > 0) return row.id || id;
  }
  return null;
};
const archivedIdsOf = (workspaces) => {
  try {
    const snap = workspaces && workspaces.list ? workspaces.list.getSnapshot() : null;
    return new Set(snap && snap.archivedSessionIds || []);
  } catch (e) {
    return /* @__PURE__ */ new Set();
  }
};
const sessionVisible = (s, current, archived) => !!s && s.origin !== "subagent" && !archived.has(s.id) && (!s.blank || s.id === current);
const visibleSessions = (snapshot2, archived) => {
  if (!snapshot2) return [];
  const byId = snapshot2.byId || {};
  const ids = Array.isArray(snapshot2.ids) ? snapshot2.ids : Object.keys(byId);
  const current = currentSessionIdIn(snapshot2);
  return ids.map((id) => byId[id]).filter((s) => sessionVisible(s, current, archived));
};
const react = React;
const NS = "dsh-micro";
const SLOT_INPUT = "conversation.input.left";
const SLOT_FOOT_ACTION = "sidebar.footer.action";
const SLOT_SETTINGS_SECTION = "settings.section";
const css = [
  ".dsvi-btn{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;display:grid;background:0 0}",
  ".dsvi-btn:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
  ".dsvi-btn[data-active]{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover-danger);animation:dsvi_pulse 1.2s ease-in-out infinite}",
  "@keyframes dsvi_pulse{0%,100%{opacity:1}50%{opacity:.45}}",
  // ---------- 抵消 DSH 的「超椭圆圆角」（2026-09-23）----------
  // DSH 在 html/body 上设了 `corner-shape: superellipse(1.5)`（超椭圆，即"方中带圆"那种
  // squircle）。这个属性**会被继承**，于是我们元素上的 `border-radius:50%` 不再渲染成
  // 正圆，而是超椭圆 —— 小尺寸下看着就是"圆角方形"。
  // 症状：用户报「布局里原来是圆形的图标变成圆角的形状了」——像素法实测 `.micro-key-dot`
  // （22px / 50%）顶边第一行就有 16px 宽、整条轮廓与「圆角半径 = 边长 38% 的圆角方形」
  // 逐行吻合，而 computed 明明是 `50%`。
  // DSH 自己知道这个坑：它的组件逐条写了 `corner-shape: round` 抵消（跑 `probe:corner-shape`
  // 能看到一长串 `→ round`），我们的元素一个都没写。这里按同样办法补上。
  // 不认这个属性的浏览器直接忽略这条声明，无副作用。
  '[class*="micro-"],[class*="dsvi-"]{corner-shape:round}'
].join("");
const installStyles = () => {
  if (typeof document === "undefined") return () => {
  };
  const tagId = `${NS}/style`;
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return () => {
  };
  const tag = document.createElement("style");
  tag.dataset.plugin = NS;
  tag.dataset.pluginCss = tagId;
  tag.textContent = DSVI.css;
  document.head.appendChild(tag);
  return () => tag.remove();
};
const svgIcon = (size, props, children) => react.createElement(
  "svg",
  { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true, ...props },
  ...children
);
const MicIcon = (size) => svgIcon(size, {}, [
  react.createElement("path", {
    fill: "currentColor",
    d: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"
  })
]);
const KEYPAD_ICON = {
  viewBox: "0 0 16 16",
  strokeWidth: 1.3,
  /** 外框：近方形圆角矩形（rx ≈ 边长的 16%，即设计稿那种「方中带圆」）。 */
  box: { x: 1.6, y: 1.6, width: 12.8, height: 12.8, rx: 2 },
  /** 圆点圆心：前两行各 3 个 + 第三行 1 个（第三行右边留给空格条）。 */
  dots: [
    [4.35, 4.35],
    [8, 4.35],
    [11.65, 4.35],
    [4.35, 8],
    [8, 8],
    [11.65, 8],
    [4.35, 11.65]
  ],
  dotR: 1.03,
  /** 空格条：右端对齐第 3 列圆心，粗细与圆点直径一致。 */
  space: { x: 6.45, y: 10.62, width: 5.2, height: 2.06, rx: 1.03 }
};
const KeypadIcon = (size = 20) => svgIcon(
  size,
  {
    viewBox: KEYPAD_ICON.viewBox,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: KEYPAD_ICON.strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  },
  [
    react.createElement("rect", { key: "body", ...KEYPAD_ICON.box }),
    ...KEYPAD_ICON.dots.map(
      ([cx, cy], i) => react.createElement("circle", {
        key: `d${i}`,
        cx,
        cy,
        r: KEYPAD_ICON.dotR,
        fill: "currentColor",
        stroke: "none"
      })
    ),
    react.createElement("rect", { key: "space", ...KEYPAD_ICON.space, fill: "currentColor", stroke: "none" })
  ]
);
const keypadIconHTML = (size = 16, attrs = "") => {
  const k = KEYPAD_ICON;
  const box = k.box;
  const sp = k.space;
  return [
    `<svg width="${size}" height="${size}" viewBox="${k.viewBox}" fill="none" stroke="currentColor"`,
    ` stroke-width="${k.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${attrs ? " " + attrs : ""}>`,
    `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${box.rx}"/>`,
    ...k.dots.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${k.dotR}" fill="currentColor" stroke="none"/>`),
    `<rect x="${sp.x}" y="${sp.y}" width="${sp.width}" height="${sp.height}" rx="${sp.rx}" fill="currentColor" stroke="none"/>`,
    "</svg>"
  ].join("");
};
const byRecency = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || (a.id < b.id ? -1 : 1);
const DSVI = {
  react,
  NS,
  SLOT_INPUT,
  SLOT_FOOT_ACTION,
  SLOT_SETTINGS_SECTION,
  css,
  installStyles,
  svgIcon,
  MicIcon,
  KeypadIcon,
  KEYPAD_ICON,
  keypadIconHTML,
  inject: [],
  apply: null,
  services: null
};
const nodeVisible = (el) => {
  if (!el || typeof el.getBoundingClientRect !== "function") return false;
  if (el.disabled === true || el.getAttribute("aria-disabled") === "true") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  try {
    const cs = window.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) return false;
  } catch (e) {
  }
  return true;
};
const labelOf = (el) => {
  try {
    return `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`.trim();
  } catch (e) {
    return "";
  }
};
const ariaOf = (el) => {
  try {
    return String(el.getAttribute("aria-label") || el.getAttribute("title") || "");
  } catch (e) {
    return "";
  }
};
const NON_TEXT_INPUT_TYPES = ["checkbox", "radio", "range", "color", "file", "button", "submit", "reset", "image"];
const isTextEntry = (el) => {
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea") return true;
  try {
    if (el.isContentEditable === true) return true;
  } catch (e) {
  }
  try {
    if (el.getAttribute("contenteditable") === "true") return true;
  } catch (e) {
  }
  if (tag === "input") {
    let type = "text";
    try {
      type = String(el.getAttribute("type") || "text").toLowerCase();
    } catch (e) {
    }
    return !NON_TEXT_INPUT_TYPES.includes(type);
  }
  return false;
};
const KNOB_SELECTOR = [
  "button",
  '[role="button"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="tab"]',
  '[role="switch"]',
  "a[href]",
  'input:not([type="hidden"])',
  "textarea",
  "select",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
  "[data-action]",
  "[data-testid]",
  "[aria-haspopup]",
  "[aria-label]",
  "[title]"
].join(",");
const isVoiceControl = (el) => {
  const cls = typeof el.className === "string" ? el.className : "";
  if (/\bdsvi-btn\b/.test(cls)) return true;
  if (/\bdshv_input\b/.test(cls)) return true;
  if (/(voice|mic|record|listen)/i.test(cls)) return true;
  let label = "";
  try {
    label = el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "";
  } catch (e) {
  }
  return /(语音|麦克风|voice|microphone|mic|录制)/i.test(label);
};
const composerRootPattern = /(composer|conversation-input|message-input|chat-input|composer-toolbar|input-editor|editor-toolbar|input-toolbar|input-bar)/i;
const hasInputField = (el) => {
  try {
    return el.querySelector('textarea, [contenteditable="true"], .dsvi-btn') !== null;
  } catch (e) {
    return false;
  }
};
const findInputRoot = () => {
  if (typeof document === "undefined") return null;
  for (const sel of ["[data-composer-seat]", "[data-composer-card]"]) {
    let el = null;
    try {
      el = document.querySelector(sel);
    } catch (e) {
      el = null;
    }
    if (el && nodeVisible(el) && hasInputField(el)) return el;
  }
  let best = null;
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll("div, main, section, form"));
  } catch (e) {
    return best;
  }
  for (const el of nodes) {
    if (el === document.body || el === document.documentElement) continue;
    let cls = "";
    try {
      if (typeof el.className === "string") cls = el.className;
      else if (el.classList && el.classList.value) cls = el.classList.value;
    } catch (e) {
      continue;
    }
    if (!composerRootPattern.test(cls)) continue;
    if (!nodeVisible(el) || !hasInputField(el)) continue;
    if (!best) {
      best = el;
      continue;
    }
    if (best.contains(el)) best = el;
  }
  return best;
};
const chatRootPattern = /(chat|conversation|thread|session|message-list|message_list|chat-view|conversation-main)/i;
const findChatRoot = () => {
  if (typeof document === "undefined") return null;
  const input = findInputRoot();
  const dataSels = ["[data-chat-root]", "[data-conversation-root]", "[data-thread-root]", "[data-chat-seat]", "[data-conversation-seat]"];
  for (const sel of dataSels) {
    let el = null;
    try {
      el = document.querySelector(sel);
    } catch (e) {
      el = null;
    }
    if (el && nodeVisible(el)) return el;
  }
  if (input) {
    let cursor = input;
    let chat = null;
    while (cursor && cursor !== document.body && cursor !== document.documentElement) {
      let cls = "";
      try {
        if (typeof cursor.className === "string") cls = cursor.className;
        else if (cursor.classList && cursor.classList.value) cls = cursor.classList.value;
      } catch (e) {
      }
      if (chatRootPattern.test(cls)) chat = cursor;
      cursor = cursor.parentElement;
    }
    if (chat) return chat;
  }
  return input;
};
const findActivePopup = () => {
  if (typeof document === "undefined") return null;
  const POP_ROLE = ["dialog", "alertdialog", "menu", "listbox", "popover", "tooltip", "combobox"];
  const POP_SEL = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="popover"]',
    '[role="tooltip"]',
    '[aria-expanded="true"]',
    "[data-popover]",
    "[data-menu]",
    "[data-dropdown]",
    "[data-dialog]",
    ".popover",
    ".dropdown",
    ".tooltip",
    ".modal",
    ".dialog",
    ".ds-modal",
    ".dsh-dialog",
    '[data-root="popper"]'
  ].join(",");
  const isPopupEl = (el) => {
    try {
      const role = el.getAttribute && (el.getAttribute("role") || "");
      if (POP_ROLE.includes(role)) return true;
    } catch (e) {
    }
    let cls = "";
    try {
      if (typeof el.className === "string") cls = el.className;
      else if (el.classList && el.classList.value) cls = el.classList.value;
    } catch (e) {
    }
    return /(popover|dropdown|tooltip|modal|popper|command-palette|context-menu)/i.test(cls);
  };
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll(POP_SEL));
  } catch (e) {
    nodes = [];
  }
  let candidates = nodes.filter((el) => nodeVisible(el) && isPopupEl(el));
  if (!candidates.length) return null;
  candidates = candidates.filter((el) => !candidates.some((o) => o !== el && o.contains(el)));
  candidates.sort((a, b) => b.querySelectorAll(KNOB_SELECTOR).length - a.querySelectorAll(KNOB_SELECTOR).length);
  return candidates[0];
};
const focusCollect = () => {
  if (typeof document === "undefined") return [];
  const root = interactionPanelRoot() || findActivePopup() || findChatRoot();
  if (!root) return [];
  let nodes = [];
  try {
    nodes = Array.from(root.querySelectorAll(KNOB_SELECTOR));
  } catch (e) {
    return [];
  }
  return nodes.filter((el) => nodeVisible(el) && !isVoiceControl(el) && !isTextEntry(el));
};
const clearHighlight = () => {
  try {
    const prev = document.querySelector("[data-micro-knob]");
    if (prev) {
      prev.removeAttribute("data-micro-knob");
      if (prev.__microPrevOutline !== void 0) {
        prev.style.outline = prev.__microPrevOutline;
        delete prev.__microPrevOutline;
      }
      if (prev.__microPrevShadow !== void 0) {
        prev.style.boxShadow = prev.__microPrevShadow;
        delete prev.__microPrevShadow;
      }
    }
  } catch (e) {
  }
};
const highlight = (el) => {
  clearHighlight();
  if (!el) return;
  el.setAttribute("data-micro-knob", "1");
  el.__microPrevShadow = el.style.boxShadow;
  el.style.boxShadow = "inset 0 0 0 2px #304FFE";
  el.__microPrevOutline = el.style.outline;
  el.style.outline = "1px solid #304FFE";
  el.style.outlineOffset = "-1px";
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch (e) {
  }
};
let scrollCache = null;
const pickScrollable = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return null;
  let nodes = [];
  try {
    nodes = Array.from(root.querySelectorAll("div, main, section, ul, ol, article"));
  } catch (e) {
    return null;
  }
  let best = null;
  let bestDiff = 0;
  for (const el of nodes) {
    const diff = el.scrollHeight - el.clientHeight;
    if (diff < 40 || diff <= bestDiff) continue;
    let oy = "";
    try {
      oy = window.getComputedStyle(el).overflowY;
    } catch (e) {
    }
    if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") continue;
    best = el;
    bestDiff = diff;
  }
  return best;
};
const findScrollContainer = () => {
  if (typeof document === "undefined") return null;
  if (scrollCache && document.contains(scrollCache)) return scrollCache;
  scrollCache = pickScrollable(findChatRoot()) || pickScrollable(document);
  return scrollCache;
};
const scrollStepSize = (clientHeight) => Math.max(90, Math.round((clientHeight || 600) * 0.22));
const scrollStepDir = (dir) => {
  const el = findScrollContainer() || (typeof document !== "undefined" ? document.scrollingElement || document.documentElement : null);
  if (!el) return false;
  const step = scrollStepSize(el.clientHeight);
  try {
    el.scrollTop = (el.scrollTop || 0) + (dir >= 0 ? step : -step);
    return true;
  } catch (e) {
    return false;
  }
};
const scrollToBottomDir = () => {
  const el = findScrollContainer() || (typeof document !== "undefined" ? document.scrollingElement || document.documentElement : null);
  if (!el) return false;
  try {
    el.scrollTop = el.scrollHeight;
    return true;
  } catch (e) {
    return false;
  }
};
const PLAN_CHIP_RE = /plan\s*mode\s*(已开启|on)|plan.*(按下关闭|press to turn off)/i;
const planChipEl = () => {
  if (typeof document === "undefined") return null;
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll("[aria-label],[title]"));
  } catch (e) {
    return null;
  }
  for (const el of nodes) {
    if (PLAN_CHIP_RE.test(labelOf(el)) && nodeVisible(el)) return el;
  }
  return null;
};
const SIDEBAR_RE = /sidebar|侧边栏|侧栏|展开.*栏|收起.*栏/i;
const sidebarToggleEl = () => {
  if (typeof document === "undefined") return null;
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll('button,[role="button"]'));
  } catch (e) {
    return null;
  }
  for (const el of nodes) {
    if (SIDEBAR_RE.test(labelOf(el)) && nodeVisible(el)) return el;
  }
  return null;
};
const EDITABLE_SEL = "textarea, [contenteditable]";
const composerEditable = () => {
  if (typeof document === "undefined") return null;
  const active = typeof document.activeElement !== "undefined" ? document.activeElement : null;
  if (active && isTextEntry(active) && nodeVisible(active)) return active;
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll(EDITABLE_SEL));
  } catch (e) {
    return null;
  }
  const visible = nodes.filter((el) => isTextEntry(el) && nodeVisible(el));
  return visible.length ? visible[visible.length - 1] : null;
};
const composerDraft = () => {
  const text = editableTextOf(composerEditable());
  return typeof text === "string" ? text : "";
};
const fileInputScore = (el) => {
  let s = 0;
  try {
    if (el.multiple === true) s += 2;
    if (el.disabled === true) s -= 4;
    if (el.hidden === true || el.getAttribute("hidden") !== null) s += 1;
  } catch (e) {
  }
  return s;
};
const composerFileInput = () => {
  if (typeof document === "undefined") return null;
  const within = (scope) => {
    try {
      return Array.from(scope.querySelectorAll('input[type="file"]'));
    } catch (e) {
      return [];
    }
  };
  const root = findInputRoot();
  let nodes = root ? within(root) : [];
  if (!nodes.length) nodes = within(document);
  let best = null;
  for (const el of nodes) {
    try {
      if (el.disabled === true) continue;
    } catch (e) {
    }
    if (!best || fileInputScore(el) > fileInputScore(best)) best = el;
  }
  return best;
};
const clickComposerFileInput = () => {
  const el = composerFileInput();
  if (!el) return false;
  try {
    el.click();
    return true;
  } catch (e) {
    return false;
  }
};
const OFFICIAL_VOICE_OUTLET_SEL = '[data-slot="conversation.input.activity"]';
const officialVoiceOutlet = () => {
  if (typeof document === "undefined") return null;
  try {
    return document.querySelector(OFFICIAL_VOICE_OUTLET_SEL);
  } catch (e) {
    return null;
  }
};
const officialVoicePhase = () => {
  const outlet = officialVoiceOutlet();
  if (!outlet) return null;
  let row = null;
  try {
    row = outlet.querySelector("[data-voice-activity]");
  } catch (e) {
    return null;
  }
  if (!row) return null;
  try {
    return row.getAttribute("data-voice-activity") || null;
  } catch (e) {
    return null;
  }
};
const officialVoiceButtons = (outlet) => {
  try {
    return Array.from(outlet.querySelectorAll("button"));
  } catch (e) {
    return [];
  }
};
const VOICE_START_RE = /^(开始录音|开始听写|start recording)$/i;
const VOICE_STOP_RE = /^(停止并识别|停止转写|stop and transcribe)$/i;
const officialVoiceStartButton = () => {
  const outlet = officialVoiceOutlet();
  if (!outlet) return null;
  const btns = officialVoiceButtons(outlet);
  if (!btns.length) return null;
  const byLabel = btns.find((b) => VOICE_START_RE.test(ariaOf(b)));
  if (byLabel) return byLabel;
  if (btns.length === 1) return btns[0];
  return btns.find((b) => {
    const cls = typeof b.className === "string" ? b.className : "";
    return /_trigger\b/.test(cls);
  }) || null;
};
const officialVoiceStopButton = () => {
  if (officialVoicePhase() !== "recording") return null;
  const outlet = officialVoiceOutlet();
  if (!outlet) return null;
  const btns = officialVoiceButtons(outlet);
  if (!btns.length) return null;
  const byLabel = btns.find((b) => VOICE_STOP_RE.test(ariaOf(b)));
  if (byLabel) return byLabel;
  return btns[btns.length - 1];
};
const officialVoiceReady = () => {
  const btn = officialVoiceStartButton();
  if (!btn) return false;
  try {
    if (btn.disabled === true) return false;
    if (btn.getAttribute("aria-disabled") === "true") return false;
  } catch (e) {
    return false;
  }
  return true;
};
const clickOfficialVoiceStart = () => {
  if (!officialVoiceReady()) return false;
  const btn = officialVoiceStartButton();
  if (!btn) return false;
  try {
    btn.click();
    return true;
  } catch (e) {
    return false;
  }
};
const clickOfficialVoiceStop = () => {
  const btn = officialVoiceStopButton();
  if (!btn) return false;
  try {
    btn.click();
    return true;
  } catch (e) {
    return false;
  }
};
const PANEL_APPROVE_WORDS = [
  "批准",
  "允许",
  "同意",
  "确认",
  "继续",
  "下一步",
  "执行",
  "是",
  "approve",
  "allow",
  "accept",
  "confirm",
  "continue",
  "next",
  "run",
  "yes"
];
const PANEL_REJECT_WORDS = [
  "跳过",
  "拒绝",
  "不允许",
  "否",
  "不",
  "skip",
  "reject",
  "deny",
  "decline",
  "no"
];
const PANEL_EXACT_ONLY = /* @__PURE__ */ new Set(["是", "否", "不", "yes", "no"]);
const PANEL_TEXT_MAX = 40;
const panelAnswerOf = (text) => {
  const t = String(text == null ? "" : text).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!t || t.length > PANEL_TEXT_MAX) return null;
  const hit = (words) => words.some((w) => PANEL_EXACT_ONLY.has(w) ? t === w : t.includes(w));
  if (hit(PANEL_REJECT_WORDS)) return "reject";
  if (hit(PANEL_APPROVE_WORDS)) return "approve";
  return null;
};
const buttonTextOf = (el) => {
  let visible = "";
  try {
    visible = String(el && el.textContent || "");
  } catch (e) {
    visible = "";
  }
  return `${visible} ${labelOf(el)}`.trim();
};
const allOf = (sel) => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return [];
  try {
    return Array.from(document.querySelectorAll(sel));
  } catch (e) {
    return [];
  }
};
const safeVisible = (el) => {
  try {
    return nodeVisible(el);
  } catch (e) {
    return true;
  }
};
const commonAncestor = (a, b) => {
  if (!a || !b) return null;
  const chain = /* @__PURE__ */ new Set();
  for (let n = a; n; n = n.parentElement) chain.add(n);
  for (let n = b; n; n = n.parentElement) if (chain.has(n)) return n;
  return null;
};
const interactionPanelRoot = () => {
  if (typeof document === "undefined") return null;
  for (const sel of ["[data-approval-key]", "[data-plan-review-key]"]) {
    const card = (() => {
      try {
        return document.querySelector(sel);
      } catch (e) {
        return null;
      }
    })();
    if (card) return card;
  }
  const btns = allOf('button, [role="button"]').filter(safeVisible);
  if (!btns.length) return null;
  const yes = btns.filter((b) => panelAnswerOf(buttonTextOf(b)) === "approve");
  const no = btns.filter((b) => panelAnswerOf(buttonTextOf(b)) === "reject");
  if (!yes.length || !no.length) return null;
  const root = commonAncestor(yes[yes.length - 1], no[no.length - 1]);
  if (!root) return null;
  try {
    const tag = String(root.tagName || "").toLowerCase();
    if (tag === "body" || tag === "html") return null;
  } catch (e) {
  }
  return root;
};
const interactionPanelButtons = () => {
  const root = interactionPanelRoot();
  if (!root) return [];
  let btns = [];
  try {
    btns = Array.from(root.querySelectorAll("button"));
  } catch (e) {
    btns = [];
  }
  if (!btns.length) {
    try {
      btns = Array.from(root.querySelectorAll('button, [role="button"]'));
    } catch (e) {
      btns = [];
    }
  }
  return btns;
};
const pickPanelButton = (buttons, approve) => {
  const list = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  if (!list.length) return null;
  const want = approve ? "approve" : "reject";
  const hit = list.filter((b) => panelAnswerOf(buttonTextOf(b)) === want);
  if (hit.length) return hit[0];
  return approve ? list[list.length - 1] : list[0];
};
const dispatchEnter = (target) => {
  if (typeof document === "undefined" || typeof KeyboardEvent === "undefined") return false;
  const el = document.activeElement;
  if (!el || typeof el.dispatchEvent !== "function") return false;
  const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
  try {
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    return true;
  } catch (e) {
    return false;
  }
};
const editableTextOf = (el) => {
  if (!el) return null;
  if (typeof el.value === "string") return el.value;
  if (typeof el.textContent === "string") return el.textContent;
  return null;
};
const dispatchUndoChord = (shift) => {
  if (typeof document === "undefined" || typeof KeyboardEvent === "undefined") return false;
  const el = composerEditable();
  if (!el) return false;
  const before = editableTextOf(el);
  const opts = {
    key: shift ? "Z" : "z",
    code: "KeyZ",
    keyCode: 90,
    which: 90,
    metaKey: true,
    shiftKey: !!shift,
    bubbles: true,
    cancelable: true
  };
  try {
    if (typeof el.focus === "function") el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
  } catch (e) {
    return false;
  }
  return editableTextOf(el) !== before;
};
const execUndoCommand = (shift) => {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const el = composerEditable();
  if (!el) return false;
  const before = editableTextOf(el);
  if (before === null) return false;
  try {
    if (typeof el.focus === "function") el.focus();
    document.execCommand(shift ? "redo" : "undo");
  } catch (e) {
    return false;
  }
  return editableTextOf(el) !== before;
};
const OFFICIAL_STOP_WAIT_MS = 2e3;
const OFFICIAL_STOP_POLL_MS = 100;
class VoiceController {
  constructor() {
    __publicField(this, "SR", typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null);
    __privateAdd(this, _recognizer, null);
    __privateAdd(this, _listening, false);
    __privateAdd(this, _unsupported, !this.SR);
    /** 本次录音是**我们点的官方麦克风** —— 松开时得由我们去点官方那颗「停止并识别」。 */
    __privateAdd(this, _official, false);
    /** 等官方进入录音态的轮询句柄（同一时刻只允许一个）。 */
    __privateAdd(this, _stopWait, null);
    __privateAdd(this, _beforeDraft, "");
    __privateAdd(this, _finalText, "");
    __privateAdd(this, _interimText, "");
    __privateAdd(this, _commit, null);
    __privateAdd(this, _listeners, /* @__PURE__ */ new Set());
    /** 官方录音栏开着（= 官方那半边在忙：请求权限 / 录音 / 转写 / 待插入都算）。 */
    __privateAdd(this, _officialActive, () => officialVoicePhase() !== null);
    /** 官方语音此刻可用吗（出口在、麦克风在、没灰）。界面按它决定是否让位。 */
    __publicField(this, "officialReady", () => officialVoiceReady());
    /**
     * 诊断（控制台 / 真机探针）——「语音会走 / 正在走哪条链路」。
     *   __dshMicro.services.voice.diagnose()
     * ⚠ `route` 报的是「**下一次按下**会走哪条」（有进行中的则报进行中的那条），
     *   而**不是**「刚刚走完哪条」。若按后者写，折叠态下永远是 'browser' ——
     *   真机探针第一跑就被它骗了一次（明明官方 ready，读出来像「回退到浏览器了」）。
     *   `active` 单独区分「正在进行」与「闲着但下次走官方」。
     * @returns {{ready: boolean, phase: string|null, active: boolean, route: 'official'|'browser'}}
     */
    __publicField(this, "diagnose", () => {
      const phase = officialVoicePhase();
      const ready = officialVoiceReady();
      const officialLive = __privateGet(this, _official) || phase !== null;
      const active = officialLive || !!__privateGet(this, _recognizer);
      const route = officialLive ? "official" : active ? "browser" : ready ? "official" : "browser";
      return { ready, phase, active, route };
    });
    __privateAdd(this, _emit, () => {
      for (const fn of __privateGet(this, _listeners)) {
        try {
          fn();
        } catch (e) {
        }
      }
    });
    __privateAdd(this, _setListening, (v) => {
      __privateSet(this, _listening, v);
      __privateGet(this, _emit).call(this);
    });
    __privateAdd(this, _fullText, () => __privateGet(this, _finalText) + __privateGet(this, _interimText));
    __privateAdd(this, _push, () => {
      const text = __privateGet(this, _fullText).call(this).trim();
      if (__privateGet(this, _commit) && text) __privateGet(this, _commit).call(this, __privateGet(this, _beforeDraft), text);
    });
    __publicField(this, "subscribe", (fn) => {
      __privateGet(this, _listeners).add(fn);
      return () => __privateGet(this, _listeners).delete(fn);
    });
    __publicField(this, "setCommit", (fn) => {
      __privateSet(this, _commit, fn);
    });
    /**
     * 开始转写。**官方优先**：官方那颗麦克风点得到就点它，浏览器这套完全不碰；
     * 点不到（Bundle 没启用 / 模型没准备完 / 拿不到出口）才落到 Web Speech。
     *
     * 幂等：官方或自己在跑时直接返回 —— 按住期间设备会重复上报同一次按下（宿主去抖后的重发、
     * 或两颗 Mic 开关都亮），重复 start 会把刚转写出来的内容清掉重来。
     */
    __publicField(this, "start", () => {
      if (__privateGet(this, _official) || __privateGet(this, _officialActive).call(this)) return;
      if (clickOfficialVoiceStart()) {
        __privateSet(this, _official, true);
        __privateSet(this, _unsupported, false);
        __privateGet(this, _setListening).call(this, true);
        return;
      }
      if (!this.SR) {
        __privateSet(this, _unsupported, true);
        __privateGet(this, _emit).call(this);
        return;
      }
      if (__privateGet(this, _recognizer) && __privateGet(this, _listening)) return;
      if (__privateGet(this, _recognizer)) {
        try {
          __privateGet(this, _recognizer).stop();
        } catch (e) {
        }
      }
      __privateSet(this, _unsupported, false);
      __privateSet(this, _finalText, "");
      __privateSet(this, _interimText, "");
      const rec = new this.SR({ lang: "zh-CN", continuous: true, interimResults: true, maxAlternatives: 1 });
      try {
        rec.lang = "zh-CN";
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
      } catch (e) {
      }
      __privateSet(this, _recognizer, rec);
      rec.onresult = (event) => {
        __privateSet(this, _interimText, "");
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            if (res[0] && res[0].transcript) __privateSet(this, _finalText, __privateGet(this, _finalText) + res[0].transcript);
          } else {
            __privateSet(this, _interimText, res[0] && res[0].transcript ? res[0].transcript : "");
          }
        }
        __privateGet(this, _emit).call(this);
        __privateGet(this, _push).call(this);
      };
      rec.onend = () => {
        if (__privateGet(this, _recognizer) === rec) __privateSet(this, _recognizer, null);
        __privateSet(this, _interimText, "");
        __privateGet(this, _setListening).call(this, false);
        __privateGet(this, _push).call(this);
        __privateSet(this, _finalText, "");
      };
      rec.onerror = (event) => {
        if (__privateGet(this, _recognizer) === rec) __privateSet(this, _recognizer, null);
        __privateSet(this, _interimText, "");
        __privateGet(this, _setListening).call(this, false);
        const code = event && event.error;
        if (code === "not-allowed" || code === "service-not-allowed") __privateSet(this, _unsupported, true);
        __privateGet(this, _emit).call(this);
      };
      try {
        rec.start();
        __privateGet(this, _setListening).call(this, true);
      } catch (e) {
        __privateSet(this, _recognizer, null);
        __privateSet(this, _unsupported, true);
        __privateGet(this, _emit).call(this);
      }
    });
    /**
     * 停止转写。
     *   * Web Speech 在跑 → 停它（收尾在 onend 里）；
     *   * 官方在跑 → 点官方那颗「停止并识别」。
     * 两个调用方：输入框上的麦克风按钮（点按 = toggle），以及**动作键的松开**：
     * 语音键是按住说话，松开必须停（见 keypad.js 的 release / hid-bridge 的松开分派）。
     * 幂等：两条链路都没在跑时什么都不做，重复松手不会出错。
     */
    __publicField(this, "stop", () => {
      if (__privateGet(this, _recognizer)) {
        try {
          __privateGet(this, _recognizer).stop();
        } catch (e) {
        }
        return;
      }
      if (__privateGet(this, _official) || __privateGet(this, _officialActive).call(this)) __privateGet(this, _stopOfficial).call(this);
    });
    /**
     * 停官方那条链路。
     *
     * ⚠ 为什么不能只点一下就走：官方点麦克风之后先进入 `requesting`（等麦克风授权），
     * **那时「停止并识别」按钮还没渲染**（官方只在 `phase === 'recording'` 时给这颗按钮）。
     * 我们的键是「按住说话」，短按一下就松开的话，松开那一刻往往还在 requesting ——
     * 直接点会点空，表现就是「松手了但录音没停」。所以点不到就**等它出现**（有上限），
     * 期间官方若整条流程结束（录音栏收起）也立刻收手。
     */
    __privateAdd(this, _stopOfficial, () => {
      if (__privateGet(this, _stopWait)) return;
      const finish = () => {
        __privateGet(this, _clearStopWait).call(this);
        __privateSet(this, _official, false);
        __privateGet(this, _setListening).call(this, false);
      };
      if (clickOfficialVoiceStop()) {
        finish();
        return;
      }
      const deadline = Date.now() + OFFICIAL_STOP_WAIT_MS;
      __privateSet(this, _stopWait, setInterval(() => {
        if (clickOfficialVoiceStop()) {
          finish();
          return;
        }
        if (Date.now() >= deadline || !__privateGet(this, _officialActive).call(this)) finish();
      }, OFFICIAL_STOP_POLL_MS));
    });
    __privateAdd(this, _clearStopWait, () => {
      if (__privateGet(this, _stopWait)) {
        clearInterval(__privateGet(this, _stopWait));
        __privateSet(this, _stopWait, null);
      }
    });
    /** 点按式开关：输入框上的麦克风按钮与设置页里绑成「语音」的摇杆/旋钮手势用它。 */
    __publicField(this, "toggle", () => {
      if (this.listening) this.stop();
      else this.start();
    });
  }
  /** 在听：自己那半边在收，或官方录音栏开着。 */
  get listening() {
    return __privateGet(this, _listening) || __privateGet(this, _officialActive).call(this);
  }
  /** 「不支持语音」只说自己那半边 —— 官方可用时根本不缺语音能力。 */
  get unsupported() {
    return this.officialReady() ? false : __privateGet(this, _unsupported);
  }
}
_recognizer = new WeakMap();
_listening = new WeakMap();
_unsupported = new WeakMap();
_official = new WeakMap();
_stopWait = new WeakMap();
_beforeDraft = new WeakMap();
_finalText = new WeakMap();
_interimText = new WeakMap();
_commit = new WeakMap();
_listeners = new WeakMap();
_officialActive = new WeakMap();
_emit = new WeakMap();
_setListening = new WeakMap();
_fullText = new WeakMap();
_push = new WeakMap();
_stopOfficial = new WeakMap();
_clearStopWait = new WeakMap();
const HID_STATE_URL = "/micro/state";
const POLL_MS$1 = 120;
const WS_RETRY_MS = 1e3;
const WS_RETRY_MAX_MS = 1e4;
const KNOB_KEYS = /* @__PURE__ */ new Set(["ENC", "ENC_CW", "ENC_CC"]);
const MAX_CATCHUP = 3;
const TAP_HOLD_MS = 400;
class HidBridge {
  // 注意：这里**不收** voice。语音只能由显式动作（ACT10/ACT11 或设置页里绑定的动作）
  // 触发，桥接层拿不到也不该拿到语音控制器——少一条隐式通路，就少一类误触发。
  constructor({ agents, keypad, knob, joystick } = {}) {
    __privateAdd(this, _HidBridge_instances);
    __publicField(this, "agents", null);
    /** 按键控制器（./keypad.js）：键码 → 动作。 */
    __publicField(this, "keypad", null);
    __publicField(this, "knob", null);
    __publicField(this, "joystick", null);
    __publicField(this, "timer", null);
    /** 当前用的通道：'websocket' | 'poll'（诊断与自检读它，见 diagnose）。 */
    __publicField(this, "transport", "poll");
    /** 诊断：最近几次「认不出来、被忽略」的事件（认出来的不入队）。 */
    __publicField(this, "unhandled", []);
    /** 诊断：累计忽略过多少次。 */
    __publicField(this, "unhandledCount", 0);
    __privateAdd(this, _last, null);
    __privateAdd(this, _lastEnc, 0);
    __privateAdd(this, _lastJoy, null);
    __privateAdd(this, _lastJoyT, null);
    __privateAdd(this, _lastJoyPush, null);
    __privateAdd(this, _lastKnobPress, null);
    __privateAdd(this, _lastKnobLong, null);
    /** 上一次轮询看到的「当前按住的键」集合（null = 还没建立基线）。差集就是本次松开的那几颗。 */
    __privateAdd(this, _lastDown, null);
    /** 快按兜底的收尾定时器（见 TAP_HOLD_MS）。 */
    __privateAdd(this, _tapTimer, null);
    /** 当前的 WebSocket（null = 没连着，走轮询）。 */
    __privateAdd(this, _socket, null);
    /** WS 重连定时器 + 当前退避时长（见 WS_RETRY_MS / WS_RETRY_MAX_MS）。 */
    __privateAdd(this, _retryTimer, null);
    __privateAdd(this, _retryMs, WS_RETRY_MS);
    __privateAdd(this, _warned, /* @__PURE__ */ new Set());
    /** 状态快照的订阅者（设置页的布局特效）——与动作分派无关，见 subscribe()。 */
    __privateAdd(this, _subs, /* @__PURE__ */ new Set());
    /** 「只演示不执行」的闸门深度（0 = 正常工作）；设置页打开我们的分区时由它持有，见 enterSim()。 */
    __privateAdd(this, _sim, 0);
    __publicField(this, "start", () => {
      if (typeof window === "undefined" || typeof fetch !== "function") return;
      __privateSet(this, _last, null);
      __privateSet(this, _lastEnc, 0);
      __privateSet(this, _lastJoy, null);
      __privateSet(this, _lastJoyT, null);
      __privateSet(this, _lastJoyPush, null);
      __privateSet(this, _lastKnobPress, null);
      __privateSet(this, _lastKnobLong, null);
      __privateSet(this, _lastDown, null);
      __privateSet(this, _retryMs, WS_RETRY_MS);
      __privateMethod(this, _HidBridge_instances, startPolling_fn).call(this);
      __privateMethod(this, _HidBridge_instances, connect_fn).call(this);
    });
    __publicField(this, "stop", () => {
      __privateMethod(this, _HidBridge_instances, stopPolling_fn).call(this);
      if (__privateGet(this, _retryTimer)) {
        clearTimeout(__privateGet(this, _retryTimer));
        __privateSet(this, _retryTimer, null);
      }
      __privateSet(this, _retryMs, WS_RETRY_MS);
      const sock = __privateGet(this, _socket);
      __privateSet(this, _socket, null);
      if (sock) {
        sock.onopen = null;
        sock.onmessage = null;
        sock.onclose = null;
        sock.onerror = null;
        try {
          sock.close();
        } catch (e) {
        }
      }
      if (__privateGet(this, _tapTimer)) {
        clearTimeout(__privateGet(this, _tapTimer));
        __privateSet(this, _tapTimer, null);
      }
      __privateSet(this, _lastDown, null);
      this.transport = "poll";
    });
    /**
     * 订阅状态快照：每收到一帧（WS 推送或轮询）后广播一次（**不管有没有事件**）。
     * 用途只有一个：设置页的键盘布局拿它播「按键特效 / 摇杆推拉」——那是纯视觉，
     * 绝不能掺进上面的动作分派里（分派路径必须保持「认不出来就什么都不做」）。
     * 消费者自己比对 keyT / joy 的差值即可，这里不做任何判断。
     * @param fn - 收到快照的回调。
     * @returns 取消订阅的函数。
     */
    __publicField(this, "subscribe", (fn) => {
      if (typeof fn !== "function") return () => {
      };
      __privateGet(this, _subs).add(fn);
      return () => {
        __privateGet(this, _subs).delete(fn);
      };
    });
    /**
     * 进入「只演示不执行」，返回**释放函数**（幂等）。
     * 用深度计数而不是布尔：持有者可能不止一个，`useEffect(() => hid.enterSim(), [])`
     * 的清理函数正好就是那个释放函数 —— 挂载进、卸载出，天然成对。
     * @returns {() => void} 释放（重复调用无副作用）。
     */
    __publicField(this, "enterSim", () => {
      __privateSet(this, _sim, __privateGet(this, _sim) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        __privateSet(this, _sim, Math.max(0, __privateGet(this, _sim) - 1));
      };
    });
    /**
     * 真实动作的唯一出口 —— **闸门落下时（simulating）这里什么都不做**。
     *
     * 为什么基线要照常推进：enc / knobPress / joyPush / t 都是**累加计数器**，且每条都带
     * MAX_CATCHUP 补执行。若抑制期间让它们原地不动，关掉设置页后的第一帧就会把「在设置页里
     * 转过的圈、推过的杆、按过的键」一次性补发出去 —— 那正是用户最不想要的一幕。
     * 所以：**归属与计数照常，只有最后一跳被丢掉**。
     *
     * 松开（#release）**故意不过这道闸门**：那是给已经开着的按住型动作收尾（语音按住说话），
     * 不是「触发功能」。在这里吞掉松开，会让「在设置页里按住麦克风键再松手」留下一个
     * 永不停止的录音。
     *
     * @param fn - 真正要落地的那一跳。
     * @returns {boolean} 是否真的执行了（调用方据此决定要不要连带启动快按兜底）。
     */
    __privateAdd(this, _dispatch, (fn) => {
      if (__privateGet(this, _sim) > 0) return false;
      if (typeof fn !== "function") return false;
      fn();
      return true;
    });
    __privateAdd(this, _emit2, (s) => {
      if (!__privateGet(this, _subs).size) return;
      for (const fn of [...__privateGet(this, _subs)]) {
        try {
          fn(s);
        } catch (e) {
        }
      }
    });
    /**
     * 测试注入：把一段 /micro/state 形状的快照直接广播给订阅者。
     * 只给自检与真机探针用（宿主没重启、手边没设备时，验「按键特效 / 摇杆推拉」不必真的按键）。
     * **它只广播**：不建立基线、不做事件归属，所以绝不会触发任何真实功能。
     */
    __publicField(this, "feed", (snap) => {
      __privateGet(this, _emit2).call(this, snap || {});
    });
    /** 诊断快照：出问题时先看这里（浏览器控制台 `__dshMicro.services.hid.diagnose()`）。 */
    __publicField(this, "diagnose", () => ({
      // 当前通道：'websocket' = 宿主在推；'poll' = 退回 120ms 轮询（宿主没带 ws / WS 正断着重连）
      transport: this.transport,
      unhandledCount: this.unhandledCount,
      unhandled: this.unhandled.slice(),
      voice: "仅显式动作（ACT10/ACT11 或设置页绑定的动作），桥接层不触发语音"
    }));
    /** 退路通道：拉一次 HTTP 快照（WS 不可用/断开时按 POLL_MS 反复调它）。 */
    __publicField(this, "poll", () => {
      fetch(HID_STATE_URL, { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then((s) => __privateMethod(this, _HidBridge_instances, handleFrame_fn).call(this, s)).catch(() => {
      });
    });
    /**
     * 松开分派：`down`（宿主给出的「当前按住的键」全量快照）的差集就是本次松开的那几颗。
     *
     * 为什么用差集而不是宿主另发一个「松开了谁」的字段：**快照即真相** ——
     * 差集天然处理「两颗键分别松开」「设备断开」这类情况，也不怕轮询漏帧（漏了也只是延后一拍）。
     * 老宿主没有 down（undefined）→ 整段跳过，行为退回引入它之前（客户端仍然兼容）。
     *
     * ⚠ 松开**不受「只演示不执行」闸门管**（见 #dispatch）：它是收尾。若在这里也吞掉，
     * 「在设置页里按住麦克风键、然后松手」就永远等不到 stop，留下一个停不下来的录音。
     */
    __privateAdd(this, _consumeReleases, (s) => {
      const list = Array.isArray(s.down) ? s.down : null;
      if (list === null) return;
      const cur = new Set(list.filter((k) => typeof k === "string" && k));
      const prev = __privateGet(this, _lastDown);
      __privateSet(this, _lastDown, cur);
      if (prev === null) return;
      for (const k of prev) if (!cur.has(k)) __privateGet(this, _release).call(this, k);
    });
    __privateAdd(this, _release, (key) => {
      if (!this.keypad || typeof this.keypad.release !== "function") return;
      try {
        this.keypad.release(key);
      } catch (e) {
      }
    });
    /**
     * 快按兜底：这次的按下**没有出现在 down 里**（按得比一次轮询还快），那就永远等不到松开。
     * 只有按住型的动作（语音）需要它 —— 给一个最短停留再收尾，不留一个永不停止的录音。
     * 判据用宿主给的 down 快照：在同一帧里，按下与「进入 down」是同一个 JSON 里的字段，
     * 所以「按下了但 down 里没有它」只可能是「已经松开了」。
     */
    __privateAdd(this, _guardTap, (s, act) => {
      const held = Array.isArray(s.down) ? s.down : null;
      if (held === null) return;
      const key = typeof s.key === "string" ? s.key : null;
      if (!key || held.includes(key)) return;
      if (!this.keypad || typeof this.keypad.resolve !== "function") return;
      let fn = null;
      try {
        fn = this.keypad.resolve(act);
      } catch (e) {
        return;
      }
      if (fn !== "voice") return;
      if (__privateGet(this, _tapTimer)) clearTimeout(__privateGet(this, _tapTimer));
      __privateSet(this, _tapTimer, setTimeout(() => {
        __privateSet(this, _tapTimer, null);
        __privateGet(this, _release).call(this, key);
      }, TAP_HOLD_MS));
    });
    // 首读只建立基线：用陈旧计数制造假增量会把「上一次会话」的按键重放一遍
    __privateAdd(this, _baseline, (s) => {
      __privateSet(this, _last, s.t);
      __privateSet(this, _lastEnc, typeof s.enc === "number" ? s.enc : 0);
      __privateSet(this, _lastJoy, typeof s.joy === "string" ? s.joy : null);
      __privateSet(this, _lastJoyT, typeof s.joyT === "number" ? s.joyT : null);
      __privateSet(this, _lastJoyPush, typeof s.joyPush === "number" ? s.joyPush : null);
      __privateSet(this, _lastKnobPress, typeof s.knobPress === "number" ? s.knobPress : null);
    });
    /**
     * 摇杆：新宿主看 joyPush（非空方向变化计数）+ joyDir（最近一次有效方向）。
     * 这两者让「推了一下就松手」在两次轮询之间也照样执行——回中会清掉 joy，
     * 但 joyDir 记着方向、joyPush 记着次数。
     * 老宿主（没有 joyPush）退回 joyT（含回中）/ joy 的边沿检测，语义与之前一致。
     * @returns {boolean} 本次轮询是否消费了摇杆事件（供「认不出来」诊断判据使用）。
     */
    __privateAdd(this, _consumeJoystick, (s) => {
      const joy = typeof s.joy === "string" ? s.joy : null;
      const joyPush = typeof s.joyPush === "number" ? s.joyPush : null;
      let seen = false;
      if (joyPush !== null) {
        if (__privateGet(this, _lastJoyPush) === null) {
          __privateSet(this, _lastJoyPush, joyPush);
        } else if (joyPush !== __privateGet(this, _lastJoyPush)) {
          const n = Math.max(1, Math.min(joyPush - __privateGet(this, _lastJoyPush), MAX_CATCHUP));
          __privateSet(this, _lastJoyPush, joyPush);
          const dir = typeof s.joyDir === "string" && s.joyDir ? s.joyDir : joy;
          if (dir && this.joystick && typeof this.joystick.handle === "function") {
            __privateGet(this, _dispatch).call(this, () => {
              for (let i = 0; i < n; i++) this.joystick.handle(dir);
            });
          }
          seen = true;
        }
      } else {
        const joyT = typeof s.joyT === "number" ? s.joyT : null;
        if (joyT !== null && __privateGet(this, _lastJoyT) === null) {
          __privateSet(this, _lastJoyT, joyT);
        } else if (joyT !== null) {
          if (joyT !== __privateGet(this, _lastJoyT)) {
            __privateSet(this, _lastJoyT, joyT);
            if (joy && this.joystick && typeof this.joystick.handle === "function") __privateGet(this, _dispatch).call(this, () => this.joystick.handle(joy));
            seen = true;
          }
        } else if (joy !== __privateGet(this, _lastJoy)) {
          if (joy && this.joystick && typeof this.joystick.handle === "function") __privateGet(this, _dispatch).call(this, () => this.joystick.handle(joy));
          seen = true;
        }
      }
      __privateSet(this, _lastJoy, joy);
      return seen;
    });
    /**
     * 旋钮：旋转看 enc 差值（带符号累计），按下看 knobPress 计数。
     * @param s - 状态快照。
     * @param tChanged - 本次轮询 t 是否自增（老宿主只有 sticky 的 key，必须靠它才能判一次）。
     * @param released - 本次事件是不是「松开」（老宿主会把松手也算成一次，得挡掉）。
     * @returns {boolean} 本次轮询是否消费了旋钮事件。
     */
    __privateAdd(this, _consumeKnob, (s, tChanged, released) => {
      let seen = false;
      const enc = typeof s.enc === "number" ? s.enc : __privateGet(this, _lastEnc);
      if (enc !== __privateGet(this, _lastEnc)) {
        const d = enc - __privateGet(this, _lastEnc);
        __privateSet(this, _lastEnc, enc);
        if (this.knob && typeof this.knob.step === "function") {
          const n = Math.min(Math.abs(d), 50);
          __privateGet(this, _dispatch).call(this, () => {
            for (let i = 0; i < n; i++) this.knob.step(d > 0 ? 1 : -1);
          });
        }
        seen = true;
      }
      const press = typeof s.knobPress === "number" ? s.knobPress : null;
      if (press !== null) {
        if (__privateGet(this, _lastKnobPress) === null) {
          __privateSet(this, _lastKnobPress, press);
        } else if (press !== __privateGet(this, _lastKnobPress)) {
          const n = Math.max(1, Math.min(press - __privateGet(this, _lastKnobPress), MAX_CATCHUP));
          __privateSet(this, _lastKnobPress, press);
          for (let i = 0; i < n; i++) __privateGet(this, _knobPress).call(this);
          seen = true;
        }
      } else if (tChanged && !released && s.key === "ENC") {
        __privateGet(this, _knobPress).call(this);
        seen = true;
      }
      const klong = typeof s.knobLong === "number" ? s.knobLong : null;
      if (klong !== null) {
        if (__privateGet(this, _lastKnobLong) === null) {
          __privateSet(this, _lastKnobLong, klong);
        } else if (klong !== __privateGet(this, _lastKnobLong)) {
          const n = Math.max(1, Math.min(klong - __privateGet(this, _lastKnobLong), MAX_CATCHUP));
          __privateSet(this, _lastKnobLong, klong);
          for (let i = 0; i < n; i++) __privateGet(this, _knobLong).call(this);
          seen = true;
        }
      }
      return seen;
    });
    __privateAdd(this, _knobPress, () => {
      __privateGet(this, _dispatch).call(this, () => {
        if (this.knob && typeof this.knob.press === "function") this.knob.press();
      });
    });
    /** 长按（≥500ms，时长由宿主算 —— 见 src/core/input.js 的 KNOB_LONG_MS）。 */
    __privateAdd(this, _knobLong, () => {
      __privateGet(this, _dispatch).call(this, () => {
        if (this.knob && typeof this.knob.long === "function") this.knob.long();
      });
    });
    __privateAdd(this, _noteUnhandled, (s) => {
      const rec = { at: Date.now(), t: s.t, key: s.key || null };
      this.unhandled.push(rec);
      if (this.unhandled.length > 8) this.unhandled.shift();
      this.unhandledCount += 1;
      const name = rec.key || "(该帧没有按键名)";
      if (!__privateGet(this, _warned).has(name)) {
        __privateGet(this, _warned).add(name);
        try {
        } catch (e) {
        }
      }
    });
    this.agents = agents || null;
    this.keypad = keypad || null;
    this.knob = knob || null;
    this.joystick = joystick || null;
  }
  // ---------------------------------------------------------------------------
  // 「只演示不执行」：设置页（我们的分区）打开时，设备照样被读、布局照样演，
  // 但**按键 / 旋钮 / 摇杆一律不落到控制器上** —— 用户在设置页里试按键，不该真的
  // 切会话、切规划模式、发消息、批准审批（用户 2026-09-25 要求）。
  //
  // 为什么闸门开在「调用控制器」那一层，而不是在 poll() 开头整段跳过：事件的归属与
  // 各输入源的计数器基线**必须照常推进**（见 #dispatch）。智能体键（AG00..AG05）
  // **不受闸门管**：按下去仍然真的打开会话（用户明确要求的一部分）。
  // ---------------------------------------------------------------------------
  /** 当前是否处于「只演示不执行」（诊断与自检读它）。 */
  get simulating() {
    return __privateGet(this, _sim) > 0;
  }
}
_last = new WeakMap();
_lastEnc = new WeakMap();
_lastJoy = new WeakMap();
_lastJoyT = new WeakMap();
_lastJoyPush = new WeakMap();
_lastKnobPress = new WeakMap();
_lastKnobLong = new WeakMap();
_lastDown = new WeakMap();
_tapTimer = new WeakMap();
_socket = new WeakMap();
_retryTimer = new WeakMap();
_retryMs = new WeakMap();
_warned = new WeakMap();
_subs = new WeakMap();
_sim = new WeakMap();
_HidBridge_instances = new WeakSet();
// ---------------------------------------------------------------------------
// 通道管理：WS 为主、轮询兜底。两条通道都把快照交给同一个 #handleFrame，
// 所以事件归属判据只有一份（新增字段时不必两边各改一遍）。
// ---------------------------------------------------------------------------
/** 起 120ms 轮询（幂等）。 */
startPolling_fn = function() {
  if (this.timer) return;
  this.timer = setInterval(this.poll, POLL_MS$1);
};
/** 停轮询（幂等）。 */
stopPolling_fn = function() {
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
};
/** 同源 WS 地址。取不到 location（非浏览器/异常环境）时返回 null → 走轮询。 */
socketUrl_fn = function() {
  const loc = typeof window !== "undefined" ? window.location : null;
  if (!loc || !loc.host) return null;
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}${HID_STATE_URL}`;
};
/**
 * 尝试建立 WS。**任何一条失败路径都只是「继续轮询」**，绝不抛错、绝不阻塞按键
 * ——推送是优化，不是命脉。
 */
connect_fn = function() {
  if (__privateGet(this, _socket)) return;
  if (typeof WebSocket !== "function") return;
  const url = __privateMethod(this, _HidBridge_instances, socketUrl_fn).call(this);
  if (!url) return;
  let sock = null;
  try {
    sock = new WebSocket(url);
  } catch (e) {
    return;
  }
  __privateSet(this, _socket, sock);
  sock.onopen = () => {
    if (__privateGet(this, _socket) !== sock) return;
    __privateSet(this, _retryMs, WS_RETRY_MS);
    __privateMethod(this, _HidBridge_instances, stopPolling_fn).call(this);
    this.transport = "websocket";
  };
  sock.onmessage = (ev) => {
    if (__privateGet(this, _socket) !== sock) return;
    let s = null;
    try {
      s = JSON.parse(ev && ev.data);
    } catch (e) {
      return;
    }
    __privateMethod(this, _HidBridge_instances, handleFrame_fn).call(this, s);
  };
  sock.onerror = () => {
    try {
      sock.close();
    } catch (e) {
    }
  };
  sock.onclose = () => {
    if (__privateGet(this, _socket) !== sock) return;
    __privateSet(this, _socket, null);
    this.transport = "poll";
    __privateMethod(this, _HidBridge_instances, startPolling_fn).call(this);
    __privateMethod(this, _HidBridge_instances, scheduleReconnect_fn).call(this);
  };
};
/** 指数退避重连（幂等：已经有排队的就不重复排）。 */
scheduleReconnect_fn = function() {
  if (__privateGet(this, _retryTimer)) return;
  const delay = __privateGet(this, _retryMs);
  __privateSet(this, _retryMs, Math.min(__privateGet(this, _retryMs) * 2, WS_RETRY_MAX_MS));
  __privateSet(this, _retryTimer, setTimeout(() => {
    __privateSet(this, _retryTimer, null);
    __privateMethod(this, _HidBridge_instances, connect_fn).call(this);
  }, delay));
};
_dispatch = new WeakMap();
_emit2 = new WeakMap();
/**
 * **两条通道的唯一落点**：一帧 /micro/state 形状的快照（WS 的 onmessage 与轮询的 poll
 * 都走这里）。所以下面这套归属判据只有一份 —— 不会出现「推送那条改了、轮询那条忘了改」。
 * @param {object} s 状态快照。
 */
handleFrame_fn = function(s) {
  if (!s || typeof s.t !== "number") return;
  __privateGet(this, _emit2).call(this, s);
  if (__privateGet(this, _last) === null) {
    __privateGet(this, _baseline).call(this, s);
    return;
  }
  const tChanged = s.t !== __privateGet(this, _last);
  const hostDown = Array.isArray(s.down) ? s.down : null;
  const released = s.keyAct === 0 && hostDown === null;
  __privateGet(this, _consumeReleases).call(this, s);
  const joySeen = __privateGet(this, _consumeJoystick).call(this, s);
  const knobSeen = __privateGet(this, _consumeKnob).call(this, s, tChanged, released);
  if (!tChanged) return;
  __privateSet(this, _last, s.t);
  if (released) return;
  const slot = typeof s.agent === "number" ? s.agent : -1;
  const act = s.act || null;
  if (slot >= 0 && this.agents && typeof this.agents.openSlot === "function") {
    this.agents.openSlot(slot);
  } else if (act && this.keypad && typeof this.keypad.run === "function") {
    if (__privateGet(this, _dispatch).call(this, () => this.keypad.run(act))) __privateGet(this, _guardTap).call(this, s, act);
  } else if (knobSeen || joySeen || KNOB_KEYS.has(s.key)) ;
  else {
    __privateGet(this, _noteUnhandled).call(this, s);
  }
};
_consumeReleases = new WeakMap();
_release = new WeakMap();
_guardTap = new WeakMap();
_baseline = new WeakMap();
_consumeJoystick = new WeakMap();
_consumeKnob = new WeakMap();
_knobPress = new WeakMap();
_knobLong = new WeakMap();
_noteUnhandled = new WeakMap();
const AGENT_STATUS = {
  RUNNING: "running",
  IDLE: "idle",
  EMPTY: "empty",
  ERROR: "error"
};
const AGENT_STATE = {
  IDLE: 0,
  // 空闲 —— 会话在、没在跑
  RUNNING: 1
};
const AGENT_COLOR_RGB = {
  working: 3166206,
  // 蓝 —— 运行中
  idle: 16777215,
  // 白 —— 空闲
  error: 16711680,
  // 红 —— 运行失败（由宿主点亮并保持，直到该会话重新运行）
  // 绿 —— 跑完一轮（成功）。**与红不对称**（用户 2026-09-28）：宿主只给**当前会话**那一槽点绿，
  // 而且只亮一会儿就回落成 idle（红则常驻、且不吃「当前会话」闸门）。这里只提供色值，
  // 何时点亮/何时收掉全在宿主侧 src/core/leds.js 的 #colorOf / #armSuccessHold。
  success: 65280,
  // 琥珀黄 / 玫粉 —— **弹窗覆盖色**（用户 2026-09-29）：
  //   approval —— 当前有「批准 / 拒绝」弹窗 → 当前会话那颗键转黄；
  //   menu     —— 旋钮按下 / 点输入框「+」打开的弹窗 → 当前会话那颗键转粉。
  // 两者都**只给当前会话**、都**优先于失败红灯**，弹窗关了立刻回到原色。
  // 何时点亮/何时收掉全在宿主侧 src/core/leds.js 的 #attentionColor（这里只给色值，
  // 由 ./attention.js 探测弹窗、随 pushLeds 上报）。
  approval: 16762880,
  menu: 16738740,
  off: 0
  // 黑 —— 关（未分配）
};
class AgentController {
  /** @param options.services - (name) => service（取 ctx 上的跨插件服务，如 uiWorkspace）。 */
  constructor(options = {}) {
    // Codex Micro 状态色（packed RGB 整数）—— 与上面的模块常量同一份
    __publicField(this, "AGENT_COLORS", AGENT_COLOR_RGB);
    __publicField(this, "sessions", null);
    __publicField(this, "workspaces", null);
    __publicField(this, "conversation", null);
    __privateAdd(this, _slots, []);
    __privateAdd(this, _pushTimer, null);
    __privateAdd(this, _allIdle, null);
    /**
     * 弹窗覆盖态（见调色板里的 approval / menu）—— 由 ./attention.js 探测界面上的弹窗后调
     * `setAttention()` 灌进来：`'approval'`（批准弹窗）/ `'menu'`（旋钮或「+」打开的弹窗）/ `null`。
     *
     * ⚠ 它只**随灯态一起上报**，颜色由宿主决定（跟 errorColor / successColor 同一套分工）。
     * ⚠ 弹窗的开/关不是会话列表变化，`refresh` 不会被触发 —— 所以 `setAttention` 要拿
     *   最近一次下发的参数**自己再推一次**（见 `#lastPush`）。
     */
    __privateAdd(this, _attention, null);
    /** 最近一次 `refresh` 下发的参数（`setAttention` 复用它们重推，不必等下一次列表变化）。 */
    __privateAdd(this, _lastPush, null);
    // 内容级去重的账本 =「**宿主此刻持有的**那份请求体」。**只有发成功才更新**；null = 还没成功发过。
    // ⚠ 失败**不重置**它 —— 理由见 pushLeds 里的推演（清账会让「切回原状态」白发一条）。
    __privateAdd(this, _lastSentBody, null);
    // 跨插件服务**延迟取值**（与 actions/index.js 的 DshOps 同一套写法）：别的客户端插件
    // 晚于本插件加载，建对象时缓存下来会永远是 undefined。
    __privateAdd(this, _services, () => void 0);
    __privateAdd(this, _log, (msg) => {
      try {
      } catch (e) {
      }
    });
    __publicField(this, "log", (msg) => {
      __privateGet(this, _log).call(this, msg);
    });
    __privateAdd(this, _service, (name) => {
      try {
        return __privateGet(this, _services).call(this, name);
      } catch (e) {
        return void 0;
      }
    });
    __publicField(this, "setSessions", (sess) => {
      this.sessions = sess;
    });
    __publicField(this, "setWorkspaces", (ws) => {
      this.workspaces = ws;
    });
    __publicField(this, "setConversation", (conv) => {
      this.conversation = conv;
    });
    // 侧边栏可见的顶层会话，保持快照顺序（判据见 core.js：与 dsh-client-ui-workspace
    // 的 sessionVisible 逐字一致）。
    __publicField(this, "listSessions", (snapshot2) => visibleSessions(snapshot2, archivedIdsOf(this.workspaces)));
    // 依据偏好的 agentKey 模式对会话排序（取前 6），返回 [{id,title,status}]
    __publicField(this, "buildAgentSlots", (prefs, snapshot2) => {
      const mode = prefs && prefs.agentKey || "recent";
      const all = this.listSessions(snapshot2);
      const seen = new Set(all.map((s) => s.id));
      const toSlot = (s) => ({ id: s.id, title: s.displayTitle || s.id, status: s.running ? AGENT_STATUS.RUNNING : AGENT_STATUS.IDLE });
      const empty = () => ({ id: null, title: null, status: AGENT_STATUS.EMPTY });
      if (mode === "custom") {
        const assign = prefs && prefs.agentAssign || {};
        const byId = snapshot2 && snapshot2.byId || {};
        return [0, 1, 2, 3, 4, 5].map((i) => {
          const s = assign[i] ? byId[assign[i]] : void 0;
          return s && seen.has(s.id) ? toSlot(s) : empty();
        });
      }
      const ordered = mode === "priority" ? all.slice().sort((a, b) => (b.running ? 1 : 0) - (a.running ? 1 : 0) || byRecency(a, b)) : all.slice().sort(byRecency);
      const slots = [];
      for (let i = 0; i < 6; i++) slots.push(ordered[i] ? toSlot(ordered[i]) : empty());
      return slots;
    });
    // 计算 + 缓存 + 推送 LED
    __publicField(this, "refresh", (prefs, snapshot2) => {
      const slots = this.buildAgentSlots(prefs, snapshot2);
      __privateSet(this, _slots, slots);
      const all = this.listSessions(snapshot2);
      const allIdle = !all.some((s) => s && s.running);
      __privateSet(this, _allIdle, allIdle);
      const brightness = prefs && prefs.brightness;
      const current = currentSessionIdIn(snapshot2);
      __privateSet(this, _lastPush, { slots, brightness, allIdle, current });
      this.pushLeds(slots, brightness, allIdle, current);
      return slots;
    });
    /**
     * 弹窗覆盖态变化（由 ./attention.js 探测界面后调）—— 拿最近一次的参数重推一遍灯态。
     *
     * 为什么不能只改字段等下一次 `refresh`：`refresh` 的触发者只有会话列表 / 归档集合 / 偏好
     * 这三路订阅，**弹窗开了关了什么都不会触发它** —— 只改字段就等于「灯色永远不变」。
     * 值不合法（既不是 'approval' / 'menu' 也不是 null）时按 null 处理：宁可恢复原色，也不猜。
     * @param {'approval'|'menu'|null} kind
     */
    __publicField(this, "setAttention", (kind) => {
      const k = kind === "approval" || kind === "menu" ? kind : null;
      if (k === __privateGet(this, _attention)) return;
      __privateSet(this, _attention, k);
      this.log(k === "approval" ? "当前有批准弹窗 → 当前会话灯色交给宿主转黄" : k === "menu" ? "弹窗打开（旋钮 / 输入框「+」）→ 当前会话灯色交给宿主转粉" : "弹窗已关闭 → 当前会话恢复原来的灯色");
      const a = __privateGet(this, _lastPush);
      if (a) this.pushLeds(a.slots, a.brightness, a.allIdle, a.current);
    });
    // 槽位映射 → 6 个 slot 对象，POST 给 host（宿主再把这些字段写进 v.oai.thstatus 发给键盘）。
    // 防抖合并：进入页面/列表变化时 refresh 会被连续触发多次，
    // 这里把多次调用合并成最后一次发送（350ms 内只发一次）。
    //
    // 每个槽位带两样「不是设备光学参数」的信息：
    //   sid —— 会话 id：宿主要靠它把 agent/error（运行失败）与 agent/turn-stopping
    //          （跑完一轮）定位到具体某颗键；
    //   st  —— 状态码（int，见 AGENT_STATE）：设备侧直接按它做灯效，不必反推颜色。
    //          这里只发 IDLE/RUNNING，成功/失败由宿主叠加。
    //
    // ⚠ **这里下发的 st 一位都不会进报文**（2026-09-27 第六轮起）：宿主侧 `#desiredAgents`
    //   索性不再收它 —— st 的唯一来源是**结论态**，且只给「当前会话」那一槽（闸门②）。
    //   浏览器这份保持**如实**（谁在跑就报 1）是因为它要表达「期望灯态」，
    //   而**颜色**只在这里决定（失败的红色也由本表下发）。
    //   一份判据住在一处：让客户端算一半、宿主算一半，等于给下一个读代码的人埋两个真相。
    // ⚠ 宿主**不看**这里下发的 st 去收回红灯：本表带 350ms 防抖，失败那一刻它常常还写着
    //   running（见 src/core/leds.js 的 #outcome）。
    //
    // 请求体里另外带两样宿主需要的信息：
    //   allIdle —— 宿主据此做「所有会话空闲 → 超时关灯」；
    //   current —— **谁是「当前会话」**（主视图正在看的那条，DSH 官方判据 retainedBy.mainView）。
    //              只有浏览器算得出来，而宿主没有它就只能凭结论瞎猜该给哪一槽带状态码。
    //              **永远发这个字段**：`null` 是「知道，但主视图此刻没有会话」，与「老客户端
    //              压根没发」是两件事（宿主用 `#currentKnown` 区分，见那边注释）。
    //
    // ⚠ 设备契约只要这几个字段（id/c/b/e/st）。曾经还发过 s/sk/sa 三个，**从头到尾恒为 0**
    //   （没有任何一行代码给过它们别的值），2026-09-25 按用户要求删掉 —— 留着它们只会让
    //   读协议的人以为「这几个字段有用，只是暂时没接上」。要加回新字段，先想清楚谁产出。
    __publicField(this, "pushLeds", (slots, brightness, allIdle, current) => {
      const b = Math.max(0, Math.min(1, brightness == null ? 0.9 : brightness));
      const th = (slots || []).slice(0, 6).map((s, i) => {
        if (!s || !s.id) {
          return { id: i, sid: null, st: AGENT_STATE.IDLE, c: 0, b: 0, e: 0 };
        }
        const running = s.status === AGENT_STATUS.RUNNING;
        return {
          id: i,
          sid: s.id,
          st: running ? AGENT_STATE.RUNNING : AGENT_STATE.IDLE,
          c: running ? this.AGENT_COLORS.working : this.AGENT_COLORS.idle,
          b,
          e: 1
        };
      });
      const body = JSON.stringify({
        slots: th,
        errorColor: this.AGENT_COLORS.error,
        // 成功色（绿）与失败色同一套：调色板归客户端，宿主不另立一份（见 leds.js 的 #successColor）。
        successColor: this.AGENT_COLORS.success,
        // 弹窗覆盖色（黄 / 粉）同一套分工（见 leds.js 的 #attentionColor）：这里只给色值，
        // 「什么时候用、给哪一槽」全由宿主决定（只给当前会话，且优先于红灯）。
        approvalColor: this.AGENT_COLORS.approval,
        menuColor: this.AGENT_COLORS.menu,
        // **永远发**（同 current）：`null` =「弹窗都关了」是有意义的值，与「老客户端没发」是两件事。
        attention: __privateGet(this, _attention),
        current: typeof current === "string" && current ? current : null,
        // 只在拿到明确结论时上报；undefined 会让宿主把它当「未上报」（老客户端语义）。
        ...typeof allIdle === "boolean" ? { allIdle } : {}
      });
      if (__privateGet(this, _pushTimer)) {
        clearTimeout(__privateGet(this, _pushTimer));
        __privateSet(this, _pushTimer, null);
      }
      __privateSet(this, _pushTimer, setTimeout(() => {
        __privateSet(this, _pushTimer, null);
        if (typeof fetch !== "function") return;
        if (body === __privateGet(this, _lastSentBody)) return;
        fetch("/micro/agents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body
        }).then(
          () => {
            __privateSet(this, _lastSentBody, body);
          },
          () => {
          }
          // 失败：不碰账本（理由见上）
        );
      }, 350));
    });
    // Agent 键按下（slot 0..5）：打开对应会话；返回是否已处理
    //
    // ⚠ **打开会话的入口是 `uiWorkspace.openSession(id)`，不是 `sessions.open(id)`。**
    // 后者在 DSH 0.1.7-rc.2 已被删掉（`sessions` 服务面只剩 retain / using / retainInfo /
    // refreshProjections / search / fork / scope / binding），而官方入口在 uiWorkspace 上：
    // DSH 侧边栏点击会话走的正是 `ctx.uiWorkspace.openSession(id)`
    // （`SessionTarget = SessionId | SubagentAddress` → 直接给 id 字符串即可）。
    //
    // 踩过的坑（用户报「智能体键无法切换会话」）：这里以前只调 `sessions.open`，
    // 拿不到就**静默** `return false` —— 而调用方（hid-bridge）根本不看返回值，
    // 于是「按键完全没反应、且一行日志都没有」。所以现在三件事缺一不可：
    //   ① 先走官方入口 uiWorkspace.openSession；② 再退到老宿主的 sessions.open；
    //   ③ 都没有 / 抛错 → **记一行日志**再说 false，绝不静默（见 actions/index.js
    //      的 archive/fork，那两条一直就是这么写的）。
    //
    // 另：「这颗键本来没分配会话」不算失败，是正常状态（灯就是灭的），不记日志。
    __publicField(this, "openSlot", (slot) => {
      const s = __privateGet(this, _slots) && __privateGet(this, _slots)[slot];
      if (!s || !s.id) return false;
      let snap = null;
      try {
        snap = this.sessions && this.sessions.list ? this.sessions.list.getSnapshot() : null;
      } catch (e) {
        this.log(`智能体键 ${slot}：读不到会话快照（${e && e.message || e}），这次按键丢弃`);
        return false;
      }
      const byId = snap && snap.byId;
      if (!byId || !byId[s.id]) {
        this.log(`智能体键 ${slot}：槽位里的会话已不在快照里（${s.id}），跳过`);
        return false;
      }
      if (!visibleSessions(snap, archivedIdsOf(this.workspaces)).some((v) => v.id === s.id)) {
        this.log(`智能体键 ${slot}：会话已不可见（归档 / 子代理 / 空白），跳过 ${s.id}`);
        return false;
      }
      const ui = __privateGet(this, _service).call(this, "uiWorkspace");
      if (ui && typeof ui.openSession === "function") {
        try {
          ui.openSession(s.id);
          return true;
        } catch (e) {
          this.log(`智能体键 ${slot}：uiWorkspace.openSession 抛错（${e && e.message || e}）`);
        }
      }
      if (this.sessions && typeof this.sessions.open === "function") {
        try {
          this.sessions.open(s.id);
          return true;
        } catch (e) {
          this.log(`智能体键 ${slot}：sessions.open 抛错（${e && e.message || e}）`);
        }
      }
      this.log(`智能体键 ${slot}：拿不到「打开会话」的入口（既没有 uiWorkspace.openSession，也没有老宿主的 sessions.open），${s.id} 没能打开`);
      return false;
    });
    const o = options || {};
    if (typeof o.services === "function") __privateSet(this, _services, o.services);
    if (typeof o.log === "function") __privateSet(this, _log, o.log);
  }
  get slots() {
    return __privateGet(this, _slots);
  }
  /** 最近一次刷新时的「全部空闲」结论（诊断/自检用）。 */
  get allIdle() {
    return __privateGet(this, _allIdle);
  }
}
_slots = new WeakMap();
_pushTimer = new WeakMap();
_allIdle = new WeakMap();
_attention = new WeakMap();
_lastPush = new WeakMap();
_lastSentBody = new WeakMap();
_services = new WeakMap();
_log = new WeakMap();
_service = new WeakMap();
const defaultLog = (msg) => {
  try {
  } catch (e) {
  }
};
const call = (ops, method, ...args) => {
  if (!ops || typeof ops[method] !== "function") return false;
  const r = ops[method](...args);
  return r === void 0 ? true : !!r;
};
const startVoice = (voice) => {
  if (!voice) return false;
  if (voice.listening) return false;
  if (typeof voice.start !== "function") return false;
  try {
    voice.start();
    return true;
  } catch (e) {
    return false;
  }
};
const stopVoice = (voice) => {
  if (!voice || typeof voice.stop !== "function") return false;
  if (!voice.listening) return false;
  try {
    voice.stop();
    return true;
  } catch (e) {
    return false;
  }
};
const toggleVoice = (voice) => {
  if (!voice || typeof voice.toggle !== "function") return false;
  try {
    voice.toggle();
    return true;
  } catch (e) {
    return false;
  }
};
const ACTIONS = [
  {
    id: "mode",
    name: "模式",
    icon: "mode",
    capId: "ACT06",
    label: "act.mode",
    desc: "切换 Agent 模式：在 标准 / PTC / 极简 / 创造 这几个预设之间循环（会话一旦开始跑就换不了）",
    knob: true,
    run: (c) => call(c.ops, "cycleAgentMode")
  },
  {
    id: "archive",
    name: "归档",
    icon: "arch",
    capId: "ACT07",
    label: "act.archive",
    desc: "归档当前会话：立刻从会话列表收起，可在「已归档」里找回",
    knob: true,
    run: (c) => call(c.ops, "archive")
  },
  {
    id: "reject",
    name: "拒绝",
    icon: "rej",
    capId: "ACT08",
    label: "act.reject",
    desc: "对当前待确认的弹窗说「不」：审批 → 拒绝；计划确认 → 拒绝执行；多步确认 → 跳过",
    knob: true,
    run: (c) => call(c.ops, "respond", "reject")
  },
  {
    id: "approve",
    name: "批准",
    icon: "appr",
    capId: "ACT09",
    label: "act.approve",
    desc: "对当前待确认的弹窗说「行」：审批 → 允许一次；计划确认 → 确认执行；多步确认 → 下一步",
    knob: true,
    // 历史动作名：knobCustom 里老值存的是 'agree'（见 ALIASES）。
    run: (c) => call(c.ops, "respond", "approve")
  },
  {
    id: "voice",
    name: "语音",
    icon: "mic",
    capId: "ACT10",
    label: "act.voice",
    desc: "语音输入：按住开始转写，松开停止",
    knob: true,
    // 同一条功能、两种界面语义，**都是用户要的**，所以分开写：
    //   键帽/按键 = 按住说话（按下 start、松开 stop，见 keypad.js 的 release）；
    //   旋钮手势 = 没有「按住」这回事，一转/一按就是开关（原 knob.js 里就是 toggle）。
    hold: true,
    press: (c) => startVoice(c.voice),
    release: (c) => stopVoice(c.voice),
    run: (c) => toggleVoice(c.voice)
  },
  {
    id: "send",
    name: "发送",
    icon: "send",
    capId: "ACT12",
    label: "act.send",
    desc: "发送当前输入",
    knob: true,
    run: (c) => call(c.ops, "send")
  },
  {
    id: "fork",
    name: "分叉",
    icon: "fork",
    capId: "FORK",
    label: "act.fork",
    desc: "分叉当前会话：从当前这条复制出一条新的分支会话，原会话保留",
    knob: true,
    run: (c) => call(c.ops, "fork")
  },
  // ---- 2026-09-28 新增的 12 颗（顺序就是用户列的顺序）----
  // 它们的**出口全在门面**：本文件只声明「有这个功能、图标是什么、显示成什么」，
  // 真正落到 DSH 上的调用（哪个服务、哪条 API）一律写在 ./index.js 的 DshOps 上。
  {
    // ⚠ 这条是**原来那颗「设置」**（capId 一直是 SETTINGS）。2026-09-28 用户改口径：
    //   名字改成「键盘设置」、图标从 gear 换成 keyboard —— 但**行为一字未动**（仍是本插件设置页）。
    //   所以老存档（actLabels 里存着 'SETTINGS'）里那颗键**自动变成键盘图标**，什么都不用迁移。
    //   通用设置是**另一颗新键**（下面那条 GENERAL）：两条路各走各的，别把它们合并。
    //   长按旋钮绑的就是这一条（knob: false 的由来），它指向本插件设置页 —— 语义不变。
    id: "open_settings",
    name: "键盘设置",
    icon: "keyboard",
    capId: "SETTINGS",
    label: "act.openSettings",
    desc: "打开 DSH小键盘设置页（**长按旋钮**也是它 —— 同一份深链，不会一处能开一处打不开）",
    // 仍是固定手势那条：**不进旋钮下拉**（长按旋钮已经绑定它了，再多一个下拉项只会让人以为要配）。
    knob: false,
    run: (c) => call(c.ops, "openSettings")
  },
  {
    id: "general_settings",
    name: "设置",
    icon: "gear",
    capId: "GENERAL",
    label: "act.generalSettings",
    desc: "打开 DSH 的通用设置页（模型 / 外观那些；键盘相关的在左边那颗「键盘设置」里）",
    knob: true,
    run: (c) => call(c.ops, "openGeneralSettings")
  },
  {
    id: "terminal",
    name: "终端",
    icon: "terminal",
    capId: "TERMINAL",
    label: "act.terminal",
    desc: "在右侧栏打开一个终端（与 DSH 自己的「新建终端」同一个标签类型）",
    knob: true,
    run: (c) => call(c.ops, "openTerminal")
  },
  // 2026-10-01 用户改口径：这一颗（capId 仍是老的 'CLEAR'，老存档不动）**改名叫「清空」、
  //   图标换成橡皮擦**；「一次删一个字」另起了下面那颗 delete_char（用户原话：「现在删除按键的
  //   功能是清空功能，将按键重命名为清空，图标也换成清空，增加一个按键命名为删除，功能只删除
  //   输入一个字一个字删除」）。
  {
    id: "clear_input",
    name: "清空",
    icon: "erase",
    capId: "CLEAR",
    label: "act.clearInput",
    desc: "清空当前输入框的内容（只清草稿，不动已经发出去的消息）",
    knob: true,
    run: (c) => call(c.ops, "clearInput")
  },
  {
    id: "delete_char",
    name: "删除",
    icon: "clear",
    capId: "DELETE",
    label: "act.deleteChar",
    desc: "删除输入框里的一个字：每按一下从末尾少一个（只动草稿，不动已经发出去的消息）",
    knob: true,
    run: (c) => call(c.ops, "deleteChar")
  },
  {
    id: "new_session",
    name: "新建",
    icon: "newchat",
    capId: "NEW",
    label: "act.newSession",
    desc: "新建一个对话（在当前工作区里开一条空会话并切过去）",
    knob: true,
    run: (c) => call(c.ops, "newSession")
  },
  {
    id: "upload",
    name: "上传",
    icon: "upload",
    capId: "UPLOAD",
    label: "act.upload",
    desc: "上传文件：弹出系统的文件选择框，选中的文件加进当前输入的附件（等同输入框左下角的「+ → 文件」）",
    knob: true,
    run: (c) => call(c.ops, "pickUpload")
  },
  {
    id: "compact",
    name: "压缩",
    icon: "compact",
    capId: "COMPACT",
    label: "act.compact",
    desc: "压缩当前会话的上下文（走 DSH 自己的 /compact 命令）",
    knob: true,
    run: (c) => call(c.ops, "compact")
  },
  {
    // 2026-10-01 用户要求：「轨迹」这颗按键换成「目标」。
    //   ⚠ 「轨迹」是**整条删掉**（不是藏起来）：键帽候选里不再有它，门面里的实现
    //     （openTrajectory / 代码工作工具那道闸门）也一并清了 —— 见 actions/index.js。
    //     老存档里存过 'TRAJECTORY' 的那颗键，键帽认不出来 → 回落它的**出厂功能**
    //     （见 utils/keycaps.js 的 capFor / keypad.js 的 resolve）。
    //   「目标」只做一件事：把命令**填进输入框**（不发送），光标停在后面等用户补内容。
    //     命令名固定是 DSH 注册的 `/goal`（**不跟界面语言走**，见 actions/session.js 的
    //     GOAL_COMMAND）—— 这里只说「这个键干什么」。
    id: "goal",
    name: "目标",
    icon: "goal",
    capId: "GOAL",
    label: "act.goal",
    // ⚠ 2026-10-01 用户改口径：**这颗键的动作是「在输入框添加命令」**，不是「打开目标视图」之类的
    //   别的意思 —— 描述里第一句就要把这件事说清（原文「把 /目标 填进输入框」被用户判为没说清）。
    // ⚠ 2026-10-01 用户报「填进去了但 DSH 不认」→ 命令名是 DSH 注册的 `/goal`，**中文界面也一样**
    //   （菜单里显示成「目标」只是文案，不是命令名）。所以描述里不再写「/目标 」。
    desc: "在输入框添加目标命令「/goal 」：命令写在最前面，光标停在它后面 —— 接着写你要达成的目标，再自己按发送",
    knob: true,
    run: (c) => call(c.ops, "writeGoal")
  },
  // ⚠ 2026-09-29 用户改口径：这两颗键**不再打开等级菜单**，而是直接把当前会话的推理强度
  //   升/降一档（「不用打开选项, 直接加减, 没有就提示不可用」）——出口从 reasoningStep 换成
  //   reasoningAdjust（见 ./effort.js 与门面里那一大段注释）。模型没有可调的档、或已经在
  //   最高/最低档时，**动作键上**会给一句顶部提示（分派层显示，见 client/notice.js）。
  //   ⚠ 旋钮「仅推理」模式**不受影响**：它转/按的是「打开菜单 → 移环 → 确认」那条老交互
  //     （knob.js 直接调 reasoningStep / reasoningPress，不经过这张表）。
  {
    id: "reasoning_up",
    name: "推理+",
    icon: "reasonUp",
    capId: "REASON_UP",
    label: "act.reasoningUp",
    desc: "提升推理强度：直接升一档，不打开等级菜单；模型没有可调等级时不动（动作键上会给一句提示）",
    knob: true,
    run: (c) => call(c.ops, "reasoningAdjust", 1)
  },
  {
    id: "reasoning_down",
    name: "推理-",
    icon: "reasonDown",
    capId: "REASON_DOWN",
    label: "act.reasoningDown",
    desc: "降低推理强度：直接降一档，不打开等级菜单；模型没有可调等级时不动（动作键上会给一句提示）",
    knob: true,
    run: (c) => call(c.ops, "reasoningAdjust", -1)
  },
  {
    id: "open_folder",
    name: "文件夹",
    icon: "folder",
    capId: "FOLDER",
    label: "act.openFolder",
    desc: "在系统的文件管理器里打开当前会话的项目文件夹（与 DSH 会话标题栏那个「打开位置」同一条路）",
    knob: true,
    run: (c) => call(c.ops, "openFolder")
  },
  {
    id: "plugins",
    name: "插件",
    icon: "plug",
    capId: "PLUGINS",
    label: "act.plugins",
    desc: "打开 DSH 的插件管理页（中央主面板，与侧边栏里那条入口同一个页面）",
    knob: true,
    run: (c) => call(c.ops, "openPlugins")
  },
  // ---- 以下是「旋钮自定义分配」专属（没有 capId：它们是手势语义，不是一颗键的功能）----
  {
    id: "none",
    label: "act.none",
    desc: "不执行任何操作（旋钮某个手势不想绑东西时选它）",
    knob: true,
    run: () => false
  },
  {
    id: "nav_fwd",
    label: "act.navFwd",
    desc: "焦点后移到下一个可聚焦控件（不含输入框）",
    knob: true,
    run: (c) => call(c.ops, "navStep", 1)
  },
  {
    id: "nav_back",
    label: "act.navBack",
    desc: "焦点前移到上一个可聚焦控件",
    knob: true,
    run: (c) => call(c.ops, "navStep", -1)
  },
  {
    id: "scroll_up",
    label: "act.scrollUp",
    desc: "当前对话向上滚一屏",
    knob: true,
    run: (c) => call(c.ops, "scrollStep", -1)
  },
  {
    id: "scroll_down",
    label: "act.scrollDown",
    desc: "当前对话向下滚一屏",
    knob: true,
    run: (c) => call(c.ops, "scrollStep", 1)
  },
  {
    id: "scroll_bottom",
    label: "act.scrollBottom",
    desc: "滚到当前对话底部",
    knob: true,
    run: (c) => call(c.ops, "scrollToBottom")
  },
  {
    id: "reasoning",
    label: "act.reasoning",
    desc: "仅推理：打开等级菜单（环在当前档）/ 确认环停的那一档",
    knob: true,
    run: (c) => call(c.ops, "reasoningPress")
  }
];
const BY_ID$1 = new Map(ACTIONS.map((a) => [a.id, a]));
const ALIASES = { agree: "approve" };
const actionById = (id) => {
  const key = String(id == null ? "" : id).trim();
  if (!key) return null;
  if (BY_ID$1.has(key)) return BY_ID$1.get(key);
  const lower = key.toLowerCase();
  if (BY_ID$1.has(lower)) return BY_ID$1.get(lower);
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (alias === lower) return BY_ID$1.get(target) || null;
  }
  return null;
};
const keycapActions = () => ACTIONS.filter((a) => !!a.capId);
const knobActions = () => ACTIONS.filter((a) => a.knob === true);
const normalizeCtx = (o) => ({
  ops: o && o.ops || null,
  voice: o && o.voice || null,
  log: o && typeof o.log === "function" ? o.log : defaultLog
});
const invoke = (entry, fn, ctx, phase) => {
  if (typeof fn !== "function") return false;
  const c = normalizeCtx(ctx);
  try {
    const r = fn(c);
    return r === void 0 ? true : !!r;
  } catch (e) {
    try {
      c.log(`功能「${entry.id}」执行失败（${phase}）：${e && e.message || e}`);
    } catch (_) {
    }
    return false;
  }
};
const runAction = (id, ctx) => {
  const entry = actionById(id);
  if (!entry) return false;
  return invoke(entry, entry.run, ctx, "run");
};
const pressAction = (id, ctx) => {
  const entry = actionById(id);
  if (!entry) return false;
  return invoke(entry, entry.hold ? entry.press : entry.run, ctx, "press");
};
const releaseAction = (id, ctx) => {
  const entry = actionById(id);
  if (!entry || typeof entry.release !== "function") return false;
  return invoke(entry, entry.release, ctx, "release");
};
const MICRO_DEFAULTS = {
  /** 灯光亮度 0..1（宿主侧有 min(0).max(1) 校验）。 */
  brightness: 0.9,
  /** 空闲自动调暗秒数，0 = 关闭。可选档位见设置页的 AUTO_DIM_OPTIONS。 */
  autoDim: 0,
  /**
   * 键帽覆盖：动作键 id（ACT06..ACT12）→ 选定的键帽 id（如 'ACT07'）。
   * **留空 = 走 {@link FACTORY_KEY_FUNCS} 的出厂指派**。用户改过哪颗键，哪颗键才在这里留一条。
   */
  actLabels: {},
  /** 模拟摇杆映射：{ up, right, down, left } → 动作名（'none' = 该方向不绑定）。 */
  joystick: {},
  /** 智能体键映射模式：recent | pinned | priority | custom。 */
  agentKey: "recent",
  /** 自定义分配：槽位(0..5) → 会话 id（键按字符串存）。 */
  agentAssign: {},
  /** 旋钮模式：navigate | reasoning | scroll | custom。 */
  knob: "navigate",
  /** 自定义旋钮分配：{ cw, ccw, click, long } → 动作名。 */
  knobCustom: {},
  /** 独立麦克风键：打开后宽 Mic 键下的两个开关各自独立（布局拆成两颗键）。 */
  micKey: false,
  /** 首次连接引导看过了没有（连上设备时弹一次）。重置布局会清掉它 → 下次连上再弹一次。 */
  guideSeen: false,
  /**
   * 「这台键盘已被移除」。**不是偏好**而是生命周期标记：不显示在界面上、也不该被
   * 「重置布局」清掉，唯一的清法是「设备重新连上」（见 src/client/device.js）。
   */
  removed: false
};
const FACTORY_KEY_FUNCS = {
  ACT06: "mode",
  ACT07: "archive",
  ACT08: "reject",
  ACT09: "approve",
  ACT10: "voice",
  ACT11: "voice",
  ACT12: "send"
};
const PLUGIN_DEPS = [];
const JOY_ACTION = {
  /** 左方向出厂：应用里撤销（undo）。 */
  BACK: "撤销",
  /** 右方向出厂：应用里重做（redo）。 */
  FORWARD: "重做",
  SIDEBAR: "切换侧边栏",
  PLAN: "切换规划模式",
  SCROLL_BOTTOM: "滚动到底部"
};
const JOY_DEFAULTS = {
  up: JOY_ACTION.PLAN,
  right: JOY_ACTION.FORWARD,
  down: JOY_ACTION.SIDEBAR,
  left: JOY_ACTION.BACK
};
const MIC_SWITCHES = ["ACT10", "ACT11"];
const MIC_MERGED_ID = "act10";
const MIC_CUSTOM_CODE = "ACT11";
const CAP_OF_FUNC = new Map(keycapActions().map((a) => [a.id, a.capId]));
const factoryFuncName = (code) => FACTORY_KEY_FUNCS[String(code || "").trim().toUpperCase()];
const factoryFuncOf = (code) => {
  const f = factoryFuncName(code);
  return CAP_OF_FUNC.has(f) ? f : null;
};
const factoryCapOf = (code) => CAP_OF_FUNC.get(factoryFuncName(code)) || null;
const capFor = (code, prefs = {}) => {
  const c = String(code || "").trim().toUpperCase();
  const labels = prefs && prefs.actLabels || {};
  if (MIC_SWITCHES.includes(c)) {
    if (prefs && prefs.micKey) {
      if (c === MIC_CUSTOM_CODE) return labels[c] || null;
      return labels[c] || factoryCapOf(c);
    }
    return labels.ACT10 || factoryCapOf("ACT10");
  }
  return labels[c] || factoryCapOf(c);
};
const KEY_LAYOUT = {
  AG00: "r1-2",
  AG01: "r1-3",
  AG02: "r2-1",
  AG03: "r2-2",
  AG04: "r2-3",
  AG05: "r2-4",
  ACT06: "act06",
  ACT07: "act07",
  ACT08: "act08",
  ACT09: "act09",
  ACT10: MIC_MERGED_ID,
  ACT11: MIC_MERGED_ID,
  ACT12: "act12"
};
const ACTION_KEY_CODES = Object.keys(KEY_LAYOUT).filter((code) => code.startsWith("ACT"));
const keyVisual = (name, split) => {
  const code = String(name || "").toUpperCase();
  if (split && MIC_SWITCHES.includes(code)) return code.toLowerCase();
  return KEY_LAYOUT[code] || null;
};
const micRowKeys = (prefs = {}) => {
  const rows = prefs && prefs.micKey ? MIC_SWITCHES.map((code) => ({ code, visualId: code.toLowerCase(), wide: false })) : [{ code: MIC_MERGED_ID.toUpperCase(), visualId: MIC_MERGED_ID, wide: true }];
  return rows.map((k) => {
    const capId = capFor(k.code, prefs);
    return { ...k, capId, custom: !capId };
  });
};
const actionSourceOf = (code, split) => {
  const c = String(code || "").trim().toUpperCase();
  if (MIC_SWITCHES.includes(c)) return split ? [c] : [MIC_MERGED_ID.toUpperCase()];
  return [c];
};
const NOTICE_CLASS = "micro-notice";
const NOTICE_MS = 3600;
const NOTICE_COALESCE_MS = 300;
const NOTICE_REASON = {
  /** 没有当前会话（登录页 / 还没点开任何会话）。 */
  noSession: "notice.noSession",
  /** 需要的跨插件服务拿不到（通常是对应插件没装）。 */
  noService: "notice.noService",
  /** 当前没有待确认的弹窗。 */
  noPanel: "notice.noPanel",
  /** 弹窗里是**选项**（提问 / 计划多选）：该转旋钮选、按旋钮勾。 */
  panelOptions: "notice.panelOptions",
  /** 弹窗认出来了，但按文案与位置都挑不出可点的按钮。 */
  noButton: "notice.noButton",
  /** 当前页面没有可用的输入框（写草稿 / 清空）。 */
  noInput: "notice.noInput",
  /** 输入栏里找不到原生文件选择框（上传）。 */
  noUpload: "notice.noUpload",
  /** 会话快照上没有项目目录（cwd），打开位置无从谈起。 */
  noCwd: "notice.noCwd",
  /** 只有在空会话（blank）上才允许换 Agent 预设。 */
  sessionBusy: "notice.sessionBusy",
  /** 「推理±」：这个模型没有可调的推理等级（与 DSH 菜单那句「当前模型未提供推理等级」同一句）。 */
  noReasoning: "notice.noReasoning",
  /** 「推理+」：已经在最高一档（**不绕圈**，与旋钮蓝环的夹边一致）。 */
  reasoningTop: "notice.reasoningTop",
  /** 「推理-」：已经在最低一档。 */
  reasoningBottom: "notice.reasoningBottom",
  /** 兜底：这次操作在当前页面就是不能执行（分派层的安全网）。 */
  notAvailable: "notice.notAvailable"
};
const NOTICE_FALLBACK = "notAvailable";
const NOTICE_TEXT_FALLBACK = {
  "notice.noSession": "先打开一个会话，再按这颗键",
  "notice.noService": "这个功能需要对应的 DSH 插件，当前页面用不了",
  "notice.noPanel": "现在没有待确认的弹窗",
  "notice.panelOptions": "这次弹窗要选选项：转旋钮选、按旋钮勾",
  "notice.noButton": "弹窗上找不到可点的按钮",
  "notice.noInput": "当前页面没有可用的输入框",
  "notice.noUpload": "输入栏里找不到文件选择框",
  "notice.noCwd": "这条会话没有记录项目目录",
  "notice.sessionBusy": "这条会话已经在跑了，新开一条再换",
  "notice.noReasoning": "当前模型未提供推理等级",
  "notice.reasoningTop": "已经是最高的推理强度了",
  "notice.reasoningBottom": "已经是最低的推理强度了",
  "notice.notAvailable": "当前页面不能执行这个操作"
};
const NOTICE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M12 6.5v6.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M12 16.6h.01" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>';
const noticeTextOf = (reason, t) => {
  const key = NOTICE_REASON[reason] || NOTICE_REASON[NOTICE_FALLBACK];
  let v = null;
  try {
    v = typeof t === "function" ? t(key) : null;
  } catch (e) {
    v = null;
  }
  return typeof v === "string" && v && v !== key ? v : NOTICE_TEXT_FALLBACK[key];
};
class MicroNotice {
  /**
   * @param options.doc - 注入的 document（不传就用运行时的；测试里装假 DOM 用）。
   * @param options.t - 词典函数（`ctx.locale.bind(DSVI.NS)`）。返回未知词条时退回内置中文。
   * @param options.ms - 显示时长（测试里调小）。
   * @param options.log - 记一行日志（拿不到 document 这类「看起来没反应」的情况必须出声）。
   */
  constructor(options = {}) {
    __privateAdd(this, _doc, null);
    __privateAdd(this, _t, null);
    __privateAdd(this, _ms, NOTICE_MS);
    __privateAdd(this, _log2, null);
    __privateAdd(this, _root, null);
    __privateAdd(this, _els, null);
    __privateAdd(this, _timer, null);
    /** 正在显示（或刚显示完）的那条：{ reason, text, at }。 */
    __privateAdd(this, _shown, null);
    /** 「拿不到 document」只出声一次（每次显示都刷屏的话，控制台就没法看了）。 */
    __privateAdd(this, _warnedMissingDoc, false);
    /** 给探针 / 自检 / 控制台看的一眼状态（量 DOM 请查 .micro-notice）。 */
    __publicField(this, "status", () => ({
      visible: this.visible,
      text: __privateGet(this, _shown) ? __privateGet(this, _shown).text : null,
      reason: __privateGet(this, _shown) ? __privateGet(this, _shown).reason : null,
      ms: __privateGet(this, _ms)
    }));
    /**
     * 报一句「当前页面不能执行」。
     * @param {string} reason - NOTICE_REASON 里的 id（'noSession' / 'noService' / …）。
     * @returns {boolean} 这次有没有真的显示出去（被去重丢掉 / 没有 document → false）。
     */
    __publicField(this, "showKey", (reason) => this.show(noticeTextOf(reason, __privateGet(this, _t)), reason));
    /**
     * 显示一条原文（控制台手验 / 探针用；正式链路一律走 showKey）。
     * @param {string} text - 要显示的文案（空串 = 什么都不做）。
     * @param {string} [reason] - 来源原因 id（只进 status / DOM 属性，便于查「刚才那条是谁报的」）。
     * @returns {boolean} 这次有没有真的显示出去。
     */
    __publicField(this, "show", (text, reason) => {
      const s = String(text == null ? "" : text).trim();
      if (!s) return false;
      const els = __privateGet(this, _ensure).call(this);
      if (!els) return false;
      if (this.visible && __privateGet(this, _shown) && Date.now() - __privateGet(this, _shown).at < NOTICE_COALESCE_MS) return false;
      __privateSet(this, _shown, { reason: reason || null, text: s, at: Date.now() });
      els.text.textContent = s;
      els.root.setAttribute("data-reason", __privateGet(this, _shown).reason || "");
      els.root.hidden = false;
      __privateGet(this, _restart).call(this);
      return true;
    });
    /** 立刻收起来（不需要等自动消失的场合：设备断开、页面卸载）。 */
    __publicField(this, "hide", () => {
      __privateGet(this, _cancel).call(this);
      if (__privateGet(this, _root)) __privateGet(this, _root).hidden = true;
    });
    /** 卸载：连节点一起摘掉（只 hidden 的话，重装会在 body 上堆一串死节点）。 */
    __publicField(this, "dispose", () => {
      __privateGet(this, _cancel).call(this);
      const root = __privateGet(this, _root);
      __privateSet(this, _root, null);
      __privateSet(this, _els, null);
      __privateSet(this, _shown, null);
      if (root && typeof root.remove === "function") {
        try {
          root.remove();
        } catch (e) {
        }
      }
    });
    // ------------------------------------------------------------------ 内部
    __privateAdd(this, _docOf, () => __privateGet(this, _doc) || (typeof document !== "undefined" ? document : null));
    __privateAdd(this, _cancel, () => {
      if (__privateGet(this, _timer)) {
        clearTimeout(__privateGet(this, _timer));
        __privateSet(this, _timer, null);
      }
    });
    __privateAdd(this, _restart, () => {
      __privateGet(this, _cancel).call(this);
      __privateSet(this, _timer, setTimeout(() => {
        __privateSet(this, _timer, null);
        this.hide();
      }, __privateGet(this, _ms)));
    });
    __privateAdd(this, _el, (tag, cls) => {
      const el = __privateGet(this, _docOf).call(this).createElement(tag);
      if (cls) el.className = cls;
      return el;
    });
    /** 惰性建节点：第一次真的要显示时才碰 DOM（没有 document 时安静地什么都不做，只记一行）。 */
    __privateAdd(this, _ensure, () => {
      if (__privateGet(this, _els)) return __privateGet(this, _els);
      const doc = __privateGet(this, _docOf).call(this);
      if (!doc || !doc.body || typeof doc.createElement !== "function") {
        if (!__privateGet(this, _warnedMissingDoc)) {
          __privateSet(this, _warnedMissingDoc, true);
          __privateGet(this, _log2).call(this, "拿不到 document.body，顶部提示不显示（按键失败将只留下一行日志）");
        }
        return null;
      }
      const root = __privateGet(this, _el).call(this, "div", NOTICE_CLASS);
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      root.hidden = true;
      const ico = __privateGet(this, _el).call(this, "span", NOTICE_CLASS + "__ico");
      if (typeof ico.insertAdjacentHTML === "function") ico.insertAdjacentHTML("afterbegin", NOTICE_ICON);
      else if ("innerHTML" in ico) ico.innerHTML = NOTICE_ICON;
      const text = __privateGet(this, _el).call(this, "span", NOTICE_CLASS + "__text");
      root.appendChild(ico);
      root.appendChild(text);
      doc.body.appendChild(root);
      __privateSet(this, _root, root);
      __privateSet(this, _els, { root, ico, text });
      return __privateGet(this, _els);
    });
    const o = options || {};
    if (o.doc) __privateSet(this, _doc, o.doc);
    __privateSet(this, _t, typeof o.t === "function" ? o.t : null);
    if (Number.isFinite(o.ms) && o.ms >= 0) __privateSet(this, _ms, o.ms);
    __privateSet(this, _log2, typeof o.log === "function" ? o.log : (msg) => {
      try {
      } catch (e) {
      }
    });
  }
  /** 此刻真的在屏幕上吗（判据是 DOM 的 hidden，不是我自己的变量）。 */
  get visible() {
    return !!(__privateGet(this, _root) && __privateGet(this, _root).hidden === false);
  }
}
_doc = new WeakMap();
_t = new WeakMap();
_ms = new WeakMap();
_log2 = new WeakMap();
_root = new WeakMap();
_els = new WeakMap();
_timer = new WeakMap();
_shown = new WeakMap();
_warnedMissingDoc = new WeakMap();
_docOf = new WeakMap();
_cancel = new WeakMap();
_restart = new WeakMap();
_el = new WeakMap();
_ensure = new WeakMap();
const CUSTOM_LABEL = "自定义";
const CUSTOM_ICON = "custom";
const KEYCAPS = keycapActions().map((a) => ({
  id: a.capId,
  label: a.name,
  labelKey: a.label,
  icon: a.icon,
  action: a.id,
  desc: a.desc
}));
const BY_ID = new Map(KEYCAPS.map((c) => [c.id, c]));
BY_ID.set("ACT11", BY_ID.get("ACT10"));
const keycapOf = (id) => BY_ID.get(String(id == null ? "" : id).trim().toUpperCase()) || null;
const keycapAction = (id) => {
  const c = keycapOf(id);
  return c ? c.action : void 0;
};
class KeypadController {
  constructor({ voice, ops, log, notice } = {}) {
    /**
     * 出厂「键码 → 动作」表（保留为公开字段：诊断与控制台拿它对照）。
     * 由键帽表派生 —— 两份手写的表迟早对不上，而这里的每一行都直接决定按下的行为。
     * `'none'`（明确的「什么都不做」，现只存在于旋钮下拉）不进表：
     * 写进去反而像「有个动作叫 none」。
     */
    __publicField(this, "ACTION_KEYS", Object.fromEntries(
      ACTION_KEY_CODES.map((id) => [id, keycapAction(id)]).filter(([, action]) => action && action !== "none")
    ));
    __publicField(this, "voice", null);
    /** DSH 功能门面（./actions/index.js）：发送、批准/拒绝、归档、分叉都从它走。 */
    __publicField(this, "ops", null);
    /** 日志（可选；功能总表执行失败时用它记一行，没给就用控制台）。 */
    __publicField(this, "log", null);
    /**
     * 顶部提示（可选）：`(reasonId) => void`，由 entry.js 注入 ./notice.js 那个实例的 showKey。
     * **只对动作键（ACT06..ACT12）** 用 —— 见 #refuse，那是用户 2026-09-28 定的口径。
     */
    __publicField(this, "notice", null);
    /** 设置里的键帽（键码 → 键帽 id，也就是「这颗键要当什么用」）；由 entry.js 随偏好灌入。 */
    __publicField(this, "keyMap", {});
    /**
     * 独立麦克风键：打开时 Mic 的两颗开关各读各的，关闭时共用一颗宽键。
     * ⚠ 那颗宽键**就是 ACT10**（键帽 / 读取 / 保存都以它为准，ACT11 在合并态不参与）——
     * 见 utils/keycaps.js 的 MIC_MERGED_ID / capFor / actionSourceOf。
     */
    __publicField(this, "micSplit", false);
    /**
     * 诊断：最近几次真实按键「上报的键码 → 解析出的动作」（最多 8 条，最新的在后）。
     * 设备按键类问题排查入口：`__dshMicro.services.keypad.lastRuns`。
     * 为什么需要它：「按下没反应」有两种完全不同的原因——(a) 这个键码根本没送到浏览器
     * （那 hid.diagnose() 的 unhandled 里会有它），(b) 送到了但被解析成 null（明确设成
     * 保留 / 键码不在表里）。只看现象分不清，看这两条记录一眼就知道。
     * 每条带 edge：'press' = 按下、'release' = 松开（按住型动作靠它收尾）。
     */
    __publicField(this, "lastRuns", []);
    /** 偏好变化时由 entry.js 调用：键帽 + 「独立麦克风键」开关状态。 */
    __publicField(this, "setKeyMap", (actLabels, micSplit) => {
      this.keyMap = actLabels && typeof actLabels === "object" ? actLabels : {};
      this.micSplit = !!micSplit;
    });
    /**
     * 键帽 id → 动作；不认识的 id 返回 undefined（`'none'` 现在不再出现在键帽表里，
     * 那颗「保留」键帽已换成「模式」）。
     * 判据就是本文件的键帽表 —— 设置页弹窗列的候选也是同一张表，两边不可能漂移。
     */
    __privateAdd(this, _capAction, (capId) => keycapAction(capId));
    /**
     * 出厂默认动作（键帽没设过、或存的值不认识时用它兜底）。
     * 判据在 ./utils/keycaps.js 的 factoryFuncOf()：出厂功能名写在 config/default.js 的
     * FACTORY_KEY_FUNCS 里，到这里已经是「动作名」了（翻译是布局那一层的事，本文件不重复认一遍键帽表）。
     * 唯一的特例：**拆分态的 ACT11 出厂是未指派的自定义键** —— 按规则它什么都不做，
     * 而不是「随便找个功能顶上」（那样用户会看到一颗他没指派过的键自己动起来）。
     * 合并态不走这条分支（两颗开关是同一颗宽键，出厂就是麦克风）。
     */
    __privateAdd(this, _factoryAction, (code, split) => {
      const c = String(code || "").trim().toUpperCase();
      if (split && c === MIC_CUSTOM_CODE) return null;
      return factoryFuncOf(c);
    });
    /**
     * 某键按下后要执行的动作名（只解析、不执行；自检与控制台用它查当前映射）。
     * @param {string} act 设备上报的动作键码。
     * @returns {string|null} 动作名（`'none'` = 明确保留：按下什么都不做）；
     *   **null = 认不出这个键码 / 这颗键没指派**（同样什么都不做，但原因不同 —— 见 lastRuns 诊断）。
     */
    __publicField(this, "resolve", (act) => {
      const k = String(act || "").trim().toUpperCase();
      const split = this.micSplit;
      for (const src of actionSourceOf(k, split)) {
        const picked = this.keyMap ? this.keyMap[src] : null;
        if (!picked) continue;
        const mapped = __privateGet(this, _capAction).call(this, picked);
        if (mapped !== void 0) return mapped;
        break;
      }
      return __privateGet(this, _factoryAction).call(this, k, split);
    });
    /** 记一条诊断（最多 8 条）。 */
    __privateAdd(this, _note, (act, fn, edge) => {
      this.lastRuns.push({ at: Date.now(), act: String(act || "").trim().toUpperCase(), fn, edge });
      if (this.lastRuns.length > 8) this.lastRuns.shift();
    });
    /**
     * 动作分派入口（被 hid-bridge 在**按下**时调用）。
     *
     * 只做一件事：把键码解析成动作名，交给**功能总表**执行（./actions/registry.js）。
     * 那张表是「所有功能按键方法」的唯一去处 —— 这里是键码→功能名的翻译，不是功能实现：
     * 加/删一个功能只改 registry.js，这个文件一个字都不用动。
     *
     * **先执行、再提示**：功能真的跑过了、返回 false（= 没派出去）才由 #refuse 补一句顶部提示。
     * 绝不在这里做「预先判断这个键能不能用」—— 那等于拿一份猜的判据替门面做决定；
     * 能不能执行只有门面自己知道（它读的是 DSH 的服务面与当前会话）。
     */
    __publicField(this, "run", (act) => {
      const fn = this.resolve(act);
      __privateGet(this, _note).call(this, act, fn, "press");
      const ops = this.ops;
      const before = ops && typeof ops.lastDeny === "function" ? ops.lastDeny() : null;
      const ok = pressAction(fn, { ops: this.ops, voice: this.voice, log: this.log });
      if (!ok) __privateGet(this, _refuse).call(this, act, fn, before);
    });
    /**
     * 「这颗键在当前页面执行不了」→ 顶部提示（用户 2026-09-28 要求：**只做动作键 ACT06..ACT12**）。
     *
     * 提示什么由门面决定：门面在拦下这次操作时会记一条原因（`ops.lastDeny()`，比如
     * 「没有当前会话」「终端插件没装」「这次弹窗要选选项」），这里读出来照原样报 ——
     * `before !== now` 就是「这一趟新记的」；没记（比如门面里某条抛错路径）就用兜底那句
     * 「当前页面不能执行这个操作」，绝不拿上次的旧原因冒充。
     *
     * 三类**不算失败**、不能提示的（否则就是拿噪音骚扰用户）：
     *   · 不在动作键里的键码 —— 用户的口径只到 ACT06..ACT12（ACTION_KEY_CODES）；
     *   · 认不出的键码 / 没指派功能（entry 为 null）——「这颗键本来就没东西」不是失败
     *     （拆分态那颗未指派的 ACT11 走的就是这条）；
     *   · 按住型（语音）—— 按住期间设备会重复上报同一次按下，重复 start 返回 false 是**正常的**。
     *   （`'none'`（明确保留）不必单独挡：它当不了键帽、也不在出厂功能表里，`resolve` 根本到不了它。）
     */
    __privateAdd(this, _refuse, (act, fn, before) => {
      if (!this.notice) return;
      const code = String(act || "").trim().toUpperCase();
      if (!ACTION_KEY_CODES.includes(code)) return;
      const entry = actionById(fn);
      if (!entry || entry.hold) return;
      const ops = this.ops;
      const now = ops && typeof ops.lastDeny === "function" ? ops.lastDeny() : null;
      const reason = now && now !== before && now.reason ? now.reason : NOTICE_FALLBACK;
      try {
        this.notice(reason);
      } catch (e) {
      }
    });
    /**
     * 松开分派入口（被 hid-bridge 在**松开**时调用）。
     *
     * 为什么需要它：语音是**按住说话**——按下开始转写、松开就该停。以前松开什么都不做，
     * 于是「按下开始录音、抬起不停」，只能再按一次去 toggle（用户报的 bug）。
     * 现在只有按住型的动作在这里有活干（判据是功能总表里那条 `hold: true`）；
     * 其余动作按下就完成了，松开返回 false。
     *
     * @param {string} act 松开的那个键码。
     * @returns {boolean} 是否真的收尾了某个动作。
     */
    __publicField(this, "release", (act) => {
      const fn = this.resolve(act);
      __privateGet(this, _note).call(this, act, fn, "release");
      return releaseAction(fn, { ops: this.ops, voice: this.voice, log: this.log });
    });
    this.voice = voice || null;
    this.ops = ops || null;
    this.log = typeof log === "function" ? log : null;
    this.notice = typeof notice === "function" ? notice : null;
  }
}
_capAction = new WeakMap();
_factoryAction = new WeakMap();
_note = new WeakMap();
_refuse = new WeakMap();
class KnobController {
  constructor({ voice, ops }) {
    __privateAdd(this, _ref, { mode: "navigate", custom: {} });
    __publicField(this, "voice", null);
    /** DSH 功能门面（./actions/index.js）。 */
    __publicField(this, "ops", null);
    /**
     * 「按下旋钮」的旁路回调（./attention.js 用它进入「等弹窗」待命）。
     *
     * ⚠ 只管**通知**，不改这条路径的任何行为：回调查不到 / 抛错都不影响下面照常派发动作。
     * 之所以要它：「这次弹窗是旋钮招来的」只有按下这一刻知道（弹窗本身长得跟别的一样）。
     */
    __privateAdd(this, _onPress, null);
    __publicField(this, "setMode", (m) => {
      __privateGet(this, _ref).mode = m;
    });
    __publicField(this, "setCustom", (obj) => {
      __privateGet(this, _ref).custom = obj;
    });
    /** 注册「按下旋钮」的回调（null = 取消）。 */
    __publicField(this, "setOnPress", (fn) => {
      __privateSet(this, _onPress, typeof fn === "function" ? fn : null);
    });
    /**
     * 自定义分配里的动作名 → 执行。
     * 动作表在 ./actions/registry.js（功能总表）—— 与键帽候选、设置页那个下拉**同一份**，
     * 所以「下拉里有、按下去没有」这种漂移在这里结构上不可能发生。
     * 设过的手势没配置（或值不认识）时不做事：绝不猜一个动作顶上。
     */
    __privateAdd(this, _customGesture, (gesture) => {
      const cfg = __privateGet(this, _ref).custom || {};
      runAction(cfg[gesture] || "none", { ops: this.ops, voice: this.voice });
    });
    __publicField(this, "step", (dir) => {
      const ops = this.ops;
      const mode = __privateGet(this, _ref).mode || "navigate";
      if (mode === "scroll") {
        if (ops) ops.scrollStep(dir);
      } else if (mode === "reasoning") {
        if (ops) ops.reasoningStep(dir);
      } else if (mode === "custom") __privateGet(this, _customGesture).call(this, dir >= 0 ? "cw" : "ccw");
      else if (ops) ops.navStep(dir);
    });
    __publicField(this, "press", () => {
      var _a;
      const ops = this.ops;
      const mode = __privateGet(this, _ref).mode || "navigate";
      try {
        (_a = __privateGet(this, _onPress)) == null ? void 0 : _a.call(this);
      } catch (e) {
      }
      if (mode === "scroll") {
        if (ops) ops.scrollToBottom();
      } else if (mode === "reasoning") {
        if (ops) ops.reasoningPress();
      } else if (mode === "custom") __privateGet(this, _customGesture).call(this, "click");
      else if (ops) ops.navActivate();
    });
    /**
     * 长按 —— **全局固定手势**：打开本插件的设置页，**任何模式都生效**。
     *
     * 为什么不做成配置项：「回设置页」是唯一的回家入口，不该随旋钮模式漂移。所以「自定义分配」
     * 里那个 long 下拉**已删掉**（见 components/settings/panel.jsx）—— 留一个按下去没反应的
     * 下拉比没有更坏。老存档里的 `knobCustom.long` 由此变成死值：不读它就不出错。
     *
     * 动作本体在功能总表里（./actions/registry.js 的 open_settings → DshOps.openSettings）；
     * 这个文件照旧只做「手势 → 动作」的路由，不碰 DSH 的 DOM。
     */
    __publicField(this, "long", () => {
      runAction("open_settings", { ops: this.ops, voice: this.voice });
    });
    this.voice = voice || null;
    this.ops = ops || null;
  }
  get mode() {
    return __privateGet(this, _ref).mode;
  }
}
_ref = new WeakMap();
_onPress = new WeakMap();
_customGesture = new WeakMap();
const MONITOR_URL = "/micro/monitor";
const PRIVACY_URL = "/micro/open-privacy";
const monitorDot = (m) => {
  if (m && m.granted === true) return { cls: "micro-dot--ok", statusCls: "micro-status--ok", labelKey: "monitor.granted" };
  if (m && m.granted === false) return { cls: "micro-dot--err", statusCls: "micro-status--err", labelKey: "monitor.denied" };
  return { cls: "micro-dot--idle", statusCls: "micro-status--idle", labelKey: "monitor.unknown" };
};
const monitorVisible = (m) => !!(m && m.supported === true);
const monitorNeedsSettings = (m) => !!(m && m.supported === true && m.granted === false);
const BATTERY_LOW_PCT = 20;
const REMOVED_KEY = "removed";
const SCOPE_RETRY = { tries: 4, delayMs: 120 };
const readbackOk = (snap) => !!snap && snap.status === "ready" && snap.writable !== false;
const snapValue = (snap) => snap && snap.value && typeof snap.value === "object" ? snap.value : {};
const sameJson = (a, b) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
};
const normalizeBattery = (v) => {
  if (typeof v === "boolean" || v === null || v === void 0 || v === "") return null;
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.round(n);
};
const batteryView = (state = {}) => {
  const pct = normalizeBattery(state && state.battery);
  const charging = !!(state && state.charging === true);
  const known = pct !== null;
  return { known, pct, charging, low: known && !charging && pct <= BATTERY_LOW_PCT };
};
const isDeviceHidden = (state = {}) => !!(state && state.removed === true && state.open !== true);
const isDeviceOffline = (state = {}) => !!(state && state.known === true && state.open !== true);
const removeKeys = (defaults) => Object.keys(defaults && typeof defaults === "object" ? defaults : {}).filter((k) => k !== REMOVED_KEY);
const locales = {
  zh: {
    nav: "DSH小键盘",
    "settings.title": "DSH小键盘",
    "settings.subtitle": "连接状态与按键 / 灯光配置",
    "conn.title": "连接",
    "conn.connected": "已连接",
    "conn.disconnected": "连接未成功",
    "conn.desc": "DSH小键盘正在自动重连。请确认设备已配对，并关闭键盘重映射或安全类工具。",
    // 「电池」那一行（**只在设备连上时展示**；电量来自设备上报的 device.status）
    "conn.battery": "电池",
    "conn.charging": "充电中",
    "conn.retry": "重新连接",
    "conn.remove": "移除",
    "monitor.title": "输入监控",
    "monitor.desc": "DSH小键盘的按键需要系统「输入监控」授权",
    "monitor.granted": "已授权",
    "monitor.denied": "未授权",
    "monitor.unknown": "无法判定",
    "monitor.hintDenied": "请在「系统设置 → 隐私与安全性 → 输入监控」中勾选终端，然后回来重新检测",
    "monitor.hintUnknown": "系统没有返回明确结果，可点重新检测再试一次",
    "monitor.open": "打开系统设置",
    "monitor.retry": "重新检测",
    "brightness.title": "亮度",
    "brightness.desc": "调整 DSH小键盘所有灯光的亮度",
    "autoDim.title": "自动调暗",
    "autoDim.desc": "所有会话空闲达到设定时长后关闭灯光；按任意键或会话开始运行即点亮",
    "autoDim.off": "关闭",
    "autoDim.30s": "30 秒",
    "autoDim.1m": "1 分钟",
    "autoDim.2m": "2 分钟",
    "autoDim.5m": "5 分钟",
    "layout.title": "布局",
    "layout.reset": "重置布局",
    "layout.desc": "DSH小键盘物理按键布局",
    // 这一页打开期间设备只做演示（闸门见 hid-bridge 的 enterSim）—— 不加这句，用户会以为键盘坏了
    "layout.simHint": "本页打开时，按键 / 旋钮 / 摇杆只在图中演示，不会触发功能",
    "opts.agentKey": "智能体键",
    "opts.agentKeyDesc": "6 个智能键映射到会话，并用键盘灯光显示会话状态",
    "opts.agentKey.pinned": "已置顶聊天",
    "opts.agentKey.recent": "最近的聊天",
    "opts.agentKey.priority": "优先聊天",
    "opts.agentKey.custom": "自定义分配",
    "opts.agentAssign.slot": "按键",
    "opts.agentAssign.none": "未分配",
    "opts.knob": "旋钮",
    "opts.knob.navigate": "输入区导航",
    "opts.knob.navigate.desc": "在编辑器控件和选项间移动（不含输入框）",
    "opts.knob.reasoning": "仅推理",
    "opts.knob.reasoning.desc": "转动打开推理强度菜单并在档位间移动高亮，按下确认",
    "opts.knob.scroll": "对话滚动",
    "opts.knob.scroll.desc": "滚动浏览当前对话",
    "opts.knob.custom": "自定义分配",
    "opts.knob.custom.desc": "为每次旋转和点击选择操作",
    // 「长按」是与模式无关的固定手势，所以提示单独一行、四种模式下都显示（见 panel.jsx）
    "opts.knob.longHint": "长按旋钮：任何模式下都打开本设置页",
    "opts.knobCustom": "自定义分配",
    "opts.knobCustomDesc": "为旋钮的顺时针 / 逆时针旋转与点击选择命令",
    "opts.knobCustom.cw": "顺时针旋转",
    "opts.knobCustom.ccw": "逆时针旋转",
    "opts.knobCustom.click": "点击",
    // act.* —— 「功能名」，**悬停气泡的第二行**（见 components/common/cap-tip.jsx）：
    // 比键帽短名长一点、说清具体做什么。键帽短名不在这里 —— 它是 registry 各条的 `name`
    // （中文，如「批准」「终端」），因为它同时要当设置页那一格的名字。
    "act.none": "无",
    "act.navFwd": "焦点后移",
    "act.navBack": "焦点前移",
    "act.scrollUp": "向上滚动",
    "act.scrollDown": "向下滚动",
    "act.scrollBottom": "滚动到底部",
    "act.voice": "语音输入",
    "act.send": "发送",
    "act.approve": "批准 / 下一步",
    "act.reject": "拒绝 / 跳过",
    "act.archive": "归档当前会话",
    "act.fork": "分叉当前会话",
    "act.reasoning": "切换推理",
    "act.reasoningUp": "增强推理强度",
    "act.reasoningDown": "减弱推理强度",
    "act.openSettings": "打开键盘设置页",
    // 2026-09-28 新增的 12 颗按键（第 1 颗「键盘设置」复用上面的 act.openSettings）。
    // 「设置」（act.generalSettings）与它成对：一个打开 DSH 的通用设置、一个打开本插件的键盘设置。
    "act.generalSettings": "打开通用设置",
    "act.mode": "切换 Agent 模式",
    "act.terminal": "打开终端",
    "act.clearInput": "清空输入框",
    "act.deleteChar": "删除一个字",
    "act.newSession": "新建对话",
    "act.upload": "上传文件",
    "act.compact": "压缩上下文",
    "act.goal": "在输入框添加目标命令",
    "act.openFolder": "打开项目文件夹",
    "act.plugins": "打开插件管理",
    // ⚠ 2026-10-01：`cmd.*` 那一段整条删掉了。「目标」键要填的 `/goal` 是 **DSH 的命令名**，
    //   不本地化 —— 原先按界面语言填 `/目标`，DSH 不认（用户报障「填进去了但 DSH 不认」）。
    //   命令名现在只住一处：actions/session.js 的 GOAL_COMMAND。
    // ---------- 摇杆提示卡片（会话界面顶部，见 ../joystick-hud.js）----------
    // joyHud.*  卡片自己那几行（方向名 + 结果）
    // joyAct.*  四个内置摇杆动作的显示名 —— 键由 JOY_ACTION 计算出来（joystick-hud.js 的
    //           JOY_ACTION_LOCALE），存进设置里的**仍然是中文动作名**，这里只管显示。
    "joyHud.up": "上",
    "joyHud.right": "右",
    "joyHud.down": "下",
    "joyHud.left": "左",
    "joyHud.ok": "已触发",
    "joyHud.unbound": "未绑定",
    "joyHud.unwired": "未接线",
    "joyHud.failed": "未生效",
    "joyAct.undo": "撤销",
    "joyAct.redo": "重做",
    "joyAct.sidebar": "切换侧边栏",
    "joyAct.plan": "切换规划模式",
    "joyAct.scrollBottom": "滚动到底部",
    // ---------- 第三方插件依赖（设置页底部，**清单为空则整卡隐藏**）----------
    // 清单来自 config/default.js 的 PLUGIN_DEPS（静态配置、不检测系统）。用户 2026-09-29 口径：
    // 清单为空 → 设置页连这个模块都不显示，所以**没有**「暂无…」这类空态文案（原先那条
    // plugins.empty 随之删掉 —— 它永远不会被渲染到）。要加插件条目请改那个文件，
    // 加一条立刻在设置页现身；这里的文案结构不用动。
    "plugins.title": "第三方插件",
    "plugins.desc": "以下按键功能需要额外安装对应的 DSH 插件；安装状态按插件自带配置显示",
    "plugins.installed": "已安装",
    "plugins.missing": "未安装",
    "plugins.usedBy": "用于：",
    "opts.micKey": "使用独立麦克风键",
    "opts.micKeyDesc": "下方宽 Mic 键有两个开关，打开后各自独立（布局里拆成两颗键，可分别指定功能）",
    "settings.saving": "保存中…",
    "settings.saved": "已保存",
    "settings.saveError": "保存失败",
    // ---------- 顶部提示（「这颗键在当前页面做不了」，见 ../notice.js）----------
    // 键就是 notice.js 的 NOTICE_REASON 表里的**词典键**：加一条原因要两处同步
    // （「词典齐不齐」由 test/verify_notice.js 盯着，少一条它红）。
    // 只对动作键 ACT06..ACT12 发（用户口径），所以文案都是「你现在该做什么」。
    "notice.noSession": "先打开一个会话，再按这颗键",
    "notice.noService": "这个功能需要对应的 DSH 插件，当前页面用不了",
    "notice.noPanel": "现在没有待确认的弹窗",
    "notice.panelOptions": "这次弹窗要选选项：转旋钮选、按旋钮勾",
    "notice.noButton": "弹窗上找不到可点的按钮",
    "notice.noInput": "当前页面没有可用的输入框",
    "notice.noUpload": "输入栏里找不到文件选择框",
    "notice.noCwd": "这条会话没有记录项目目录",
    "notice.sessionBusy": "这条会话已经在跑了，新开一条再换",
    "notice.noReasoning": "当前模型未提供推理等级",
    "notice.reasoningTop": "已经是最高的推理强度了",
    "notice.reasoningBottom": "已经是最低的推理强度了",
    "notice.notAvailable": "当前页面不能执行这个操作",
    // 侧边栏底部「设置」旁边的小键盘图标（点了直接落到本分区）
    "sidebar.action": "键盘设置",
    // 断开时的悬停/可访问名（图标右上会多一个红点）。**不许写成「点击重新连接」** ——
    // 这个入口点了是打开设置页，重连在那一页的按钮上（口径见 components/sidebar/action.jsx）。
    "sidebar.offline": "键盘已断开 · 点击打开设置重新连接",
    // 「与**后台**断开」气泡里的三句话 —— 这三句**照抄 DSH 自己词典里的措辞**
    // （dsh-client-ui-settings-general 的 connection.connecting / .error / .connected）。
    // 为什么要抄：这条提示原本由 DSH 画在「设置」那一行里，我们只是把它换个地方展示（气泡），
    // 措辞跟着它走，用户才不会觉得界面上冒出两套说法。
    "sidebar.connecting": "自动重连中",
    "sidebar.disconnected": "连接异常",
    "sidebar.reconnected": "连接成功",
    // 气泡的可访问名：点它就是「立即重连」（= 点那颗被我们藏起来的 DSH 指示器）
    "sidebar.reconnectNow": "点击立即重连",
    // ---------- 首次连接引导（设备第一次连上时弹一次，见 components/modals/guide.jsx）----------
    // （设置页那一行「首次连接引导 / 重新播放」2026-09-24 按要求去掉，专属词条一并撤了）
    "guide.close": "关闭引导",
    "guide.connected": "键盘已连接",
    "guide.monitor": "输入监控",
    "guide.skip": "跳过",
    "guide.start": "开始两步导览",
    "guide.last": "最后一步",
    "guide.back": "上一步",
    "guide.settings": "设置",
    "guide.finish": "开始构建！",
    "guide.welcome.title": "欢迎使用 DSH小键盘",
    "guide.welcome.desc": "检测到你的 DSH小键盘已经连上。接下来用两步带你看清 6 颗智能体键和命令键 —— 大概半分钟。",
    "guide.agents.title": "智能体按键",
    "guide.agents.desc": "第一、二排的 6 颗键对应你的会话：按下就切过去。灯的颜色实时反映每个会话的状态，不用盯着屏幕也知道谁在忙。",
    "guide.commands.title": "命令键",
    "guide.commands.desc": "第三排是四颗命令键（模式 / 归档 / 拒绝 / 批准），底部是麦克风键和发送键 —— 最常用的操作都在手边。",
    "guide.commands.note": "这些键都能改：设置 → DSH小键盘，可以逐颗换键帽、给摇杆四个方向绑动作、切换旋钮模式。",
    "guide.legend.running": "蓝色 · 运行中",
    "guide.legend.runningHint": "这个会话正在回答",
    "guide.legend.idle": "白色 · 空闲",
    "guide.legend.idleHint": "会话存在，在等你",
    "guide.legend.error": "红色 · 运行失败",
    "guide.legend.errorHint": "刚出错，一直亮到你重试",
    "guide.legend.empty": "关闭 · 未分配",
    "guide.legend.emptyHint": "这颗键还没分到会话",
    // ---------- 「移除键盘」确认弹窗（见 components/modals/remove.jsx）----------
    // 与「重置布局」的区别要在文案里说清：重置＝回到出厂值、界面还在；
    // 移除＝清空全部设置**并且**把界面收起来，直到这台键盘重新连上。
    "remove.title": "移除键盘",
    "remove.sub": "把这台键盘从 DSH 里摘掉",
    "remove.item1": "清空全部键盘设置：键帽、摇杆方向、旋钮模式、亮度、自动调暗都回到出厂值",
    "remove.item2": "设置页里的「DSH小键盘」分区会隐藏",
    "remove.item3": "侧边栏底部的小键盘图标会隐藏",
    "remove.item4": "「首次连接引导」的已读标记一起清掉",
    "remove.item5": "重新连接这台键盘后以上全部恢复显示（引导会像新装一样再弹一次）",
    "remove.hint": "只在设备没连上时才需要移除；如果只是暂时断开，先试「重新连接」。",
    "remove.cancel": "取消",
    "remove.confirm": "移除"
  },
  en: {
    nav: "DSH Keypad",
    "settings.title": "DSH Keypad",
    "settings.subtitle": "Connection status and key / lighting configuration",
    "conn.title": "Connection",
    "conn.connected": "Connected",
    "conn.disconnected": "Connection failed",
    "conn.desc": "DSH Keypad is reconnecting. Make sure the device is paired and no keyboard remapper or security tool is blocking access.",
    "conn.battery": "Battery",
    "conn.charging": "Charging",
    "conn.retry": "Reconnect",
    "conn.remove": "Remove",
    "monitor.title": "Input Monitoring",
    "monitor.desc": "DSH Keypad keys require the system Input Monitoring permission",
    "monitor.granted": "Granted",
    "monitor.denied": "Not granted",
    "monitor.unknown": "Unknown",
    "monitor.hintDenied": "Tick Teriminal in System Settings → Privacy & Security → Input Monitoring, then check again",
    "monitor.hintUnknown": "The system did not return a clear result — try checking again",
    "monitor.open": "Open System Settings",
    "monitor.retry": "Check again",
    "brightness.title": "Brightness",
    "brightness.desc": "Adjust the brightness of all DSH Keypad lights",
    "autoDim.title": "Auto-Dim",
    "autoDim.desc": "Turn lights off after every session has been idle for the chosen time; a keypress or a running session relights them",
    "autoDim.off": "Off",
    "autoDim.30s": "30 seconds",
    "autoDim.1m": "1 minute",
    "autoDim.2m": "2 minutes",
    "autoDim.5m": "5 minutes",
    "layout.title": "Layout",
    "layout.reset": "Reset Layout",
    "layout.desc": "Physical key layout of the DSH Keypad",
    // While this page is open the device only previews (gate: hid-bridge's enterSim)
    "layout.simHint": "While this page is open, keys / knob / joystick only preview in the picture — no actions are triggered",
    "opts.agentKey": "Smart Agent Keys",
    "opts.agentKeyDesc": "Map the 6 smart keys to sessions and show their status as LED colors",
    "opts.agentKey.pinned": "Pinned chats",
    "opts.agentKey.recent": "Recent chats",
    "opts.agentKey.priority": "Priority chats",
    "opts.agentKey.custom": "Custom assignment",
    "opts.agentAssign.slot": "Key",
    "opts.agentAssign.none": "None",
    "opts.knob": "Knob",
    "opts.knob.navigate": "Input area navigation",
    "opts.knob.navigate.desc": "Move between editor controls and options (skips the text box)",
    "opts.knob.reasoning": "Reasoning only",
    "opts.knob.reasoning.desc": "Rotate to open the reasoning menu and move the highlight, press to confirm",
    "opts.knob.scroll": "Conversation scrolling",
    "opts.knob.scroll.desc": "Scroll through the current conversation",
    "opts.knob.custom": "Custom assignment",
    "opts.knob.custom.desc": "Choose actions for each rotate and click",
    "opts.knob.longHint": "Long-press the knob: opens this settings page in any mode",
    "opts.knobCustom": "Custom assignment",
    "opts.knobCustomDesc": "Choose the command for rotate clockwise, rotate counter-clockwise and click",
    "opts.knobCustom.cw": "Rotate clockwise",
    "opts.knobCustom.ccw": "Rotate counter-clockwise",
    "opts.knobCustom.click": "Click",
    "act.none": "None",
    "act.navFwd": "Focus next",
    "act.navBack": "Focus previous",
    "act.scrollUp": "Scroll up",
    "act.scrollDown": "Scroll down",
    "act.scrollBottom": "Scroll to bottom",
    "act.voice": "Voice input",
    "act.send": "Send",
    "act.approve": "Approve / Next step",
    "act.reject": "Reject / Skip",
    "act.archive": "Archive this session",
    "act.fork": "Fork this session",
    "act.reasoning": "Toggle reasoning",
    "act.reasoningUp": "Increase reasoning",
    "act.reasoningDown": "Decrease reasoning",
    "act.openSettings": "Open keyboard settings",
    // The 12 keys added 2026-09-28 (the first one, Keyboard settings, reuses act.openSettings above).
    // Settings (act.generalSettings) comes as its pair: one opens DSH's general settings,
    // the other this plugin's keyboard settings.
    "act.generalSettings": "Open general settings",
    "act.mode": "Switch Agent mode",
    "act.terminal": "Open a terminal",
    "act.clearInput": "Clear the input box",
    "act.deleteChar": "Delete one character",
    "act.newSession": "New conversation",
    "act.upload": "Upload files",
    "act.compact": "Compact the context",
    "act.goal": "Add the goal command to the input box",
    "act.openFolder": "Open the project folder",
    "act.plugins": "Open the plugin manager",
    // The cmd.* block was removed 2026-10-01: the Goal key types `/goal`, which is DSH's own
    // command name and is NOT localized (typing `/目标` made DSH reject it). The name lives in
    // exactly one place now: GOAL_COMMAND in actions/session.js.
    // ---------- Joystick hint card (top of the conversation view, see ../joystick-hud.js) ----------
    "joyHud.up": "Up",
    "joyHud.right": "Right",
    "joyHud.down": "Down",
    "joyHud.left": "Left",
    "joyHud.ok": "Triggered",
    "joyHud.unbound": "Not assigned",
    "joyHud.unwired": "Not wired",
    "joyHud.failed": "No effect",
    "joyAct.undo": "Undo",
    "joyAct.redo": "Redo",
    "joyAct.sidebar": "Toggle sidebar",
    "joyAct.plan": "Toggle plan mode",
    "joyAct.scrollBottom": "Scroll to bottom",
    // ---------- Third-party plugin dependencies (hidden entirely when the list is empty) ----------
    // The list comes from config/default.js (PLUGIN_DEPS, static config — no system probing).
    // Per the user (2026-09-29) an empty list means the whole module is not rendered, so there is
    // no "nothing to install" copy — the old plugins.empty key was removed with it.
    "plugins.title": "Third-party Plugins",
    "plugins.desc": "The key actions below need extra DSH plugins; the status shown follows the plugin’s own config",
    "plugins.installed": "Installed",
    "plugins.missing": "Missing",
    "plugins.usedBy": "Used by: ",
    "opts.micKey": "Use separate mic keys",
    "opts.micKeyDesc": "The wide mic key has two switches; map them independently (the layout splits into two keys, each with its own action)",
    "settings.saving": "Saving…",
    "settings.saved": "Saved",
    "settings.saveError": "Save failed",
    // ---------- Top notice ("this key can't do its job on this page", see ../notice.js) ----------
    // The keys below are the dictionary keys listed in notice.js's NOTICE_REASON table;
    // test/verify_notice.js keeps both sides in sync (a missing line turns that suite red).
    // Only the action keys ACT06..ACT12 show it (per the user), so every line says what to do next.
    "notice.noSession": "Open a session first, then press this key",
    "notice.noService": "This action needs its DSH plugin — not available on this page",
    "notice.noPanel": "There is no dialog waiting for an answer right now",
    "notice.panelOptions": "This dialog wants answers: turn the knob to pick, press the knob to tick",
    "notice.noButton": "No clickable button found on the dialog",
    "notice.noInput": "No usable input box on this page",
    "notice.noUpload": "No file picker found in the input bar",
    "notice.noCwd": "This session has no project folder recorded",
    "notice.sessionBusy": "This session is already running — start a new one to switch",
    "notice.noReasoning": "This model provides no reasoning effort levels",
    "notice.reasoningTop": "Already at the highest reasoning effort",
    "notice.reasoningBottom": "Already at the lowest reasoning effort",
    "notice.notAvailable": "This action can’t run on this page",
    // Sidebar-foot action next to Settings (opens this section directly)
    "sidebar.action": "Keyboard settings",
    // Hover / accessible name while the keyboard is disconnected (a red dot appears too).
    // Must NOT say "click to reconnect": this entry opens the settings page, where the
    // reconnect button lives (see components/sidebar/action.jsx).
    "sidebar.offline": "Keyboard disconnected · open settings to reconnect",
    // The three lines shown in the "host disconnected" bubble. Wording is copied verbatim from
    // DSH's own dictionary (connection.connecting / .error / .connected) on purpose: the notice
    // is DSH's, we only re-present it as a bubble, so the wording must not diverge.
    "sidebar.connecting": "Reconnecting",
    "sidebar.disconnected": "Disconnected",
    "sidebar.reconnected": "Connected",
    // Accessible name of the bubble — clicking it reconnects (= clicking the hidden indicator)
    "sidebar.reconnectNow": "Click to reconnect now",
    // ---------- First-connect guide (see components/modals/guide.jsx) ----------
    // (the "First-connect guide / Replay" settings row was removed on 2026-09-24; its keys went with it)
    "guide.close": "Close guide",
    "guide.connected": "Keyboard connected",
    "guide.monitor": "Input Monitoring",
    "guide.skip": "Skip",
    "guide.start": "Start the 2-step tour",
    "guide.last": "Last step",
    "guide.back": "Back",
    "guide.settings": "Settings",
    "guide.finish": "Start building!",
    "guide.welcome.title": "Welcome to DSH Keypad",
    "guide.welcome.desc": "Your DSH Keypad is connected. Two short steps show you the 6 smart agent keys and the command keys — about half a minute.",
    "guide.agents.title": "Smart agent keys",
    "guide.agents.desc": "The 6 keys in the first two rows map to your sessions: press one to switch to it. The LED color tracks each session live, so you can tell who is busy without looking at the screen.",
    "guide.commands.title": "Command keys",
    "guide.commands.desc": "Row three holds four command keys (mode / archive / reject / approve); the bottom row has the mic and send keys — the most used actions are always at hand.",
    "guide.commands.note": "All of these can be changed: Settings → DSH Keypad lets you swap keycaps, bind the four joystick directions, and switch knob modes.",
    "guide.legend.running": "Blue · running",
    "guide.legend.runningHint": "This session is answering",
    "guide.legend.idle": "White · idle",
    "guide.legend.idleHint": "Session exists, waiting for you",
    "guide.legend.error": "Red · failed",
    "guide.legend.errorHint": "Just errored, stays red until you retry",
    "guide.legend.empty": "Off · unassigned",
    "guide.legend.emptyHint": "No session on this key yet",
    // ---------- "Remove keypad" confirm modal (see components/modals/remove.jsx) ----------
    "remove.title": "Remove keypad",
    "remove.sub": "Take this keypad out of DSH",
    "remove.item1": "Clear every keypad setting: keycaps, joystick directions, knob mode, brightness and auto-dim all go back to their factory values",
    "remove.item2": "The “DSH Keypad” section disappears from Settings",
    "remove.item3": "The small keypad icon in the sidebar disappears",
    "remove.item4": "The “first-connect guide” read flag is cleared as well",
    "remove.item5": "Reconnect this keypad and everything above comes back (the guide shows again like on a fresh install)",
    "remove.hint": "Removing is only meant for when the device is not connected; if it is just temporarily offline, try “Reconnect” first.",
    "remove.cancel": "Cancel",
    "remove.confirm": "Remove"
  }
};
DSVI.locales = locales;
const settingsCss = '\n\n/* dsh-micro · client/src/settings.css — 设置面板样式\n * 以 ?raw 引入，追加到 DSVI.css，随 installStyles 一起注入。 */\n.micro-key--act{position:relative}\n.micro-modal-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(15,18,25,.4);backdrop-filter:blur(4px)}\n.micro-modal{width:min(520px,92vw);background:#fff;border-radius:14px;padding:18px;box-shadow:0 24px 60px rgba(0,0,0,.25)}\n.micro-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}\n.micro-modal-title{font-size:18px;font-weight:600;color:#1f2937}\n.micro-modal-sub{margin-top:2px;font-size:13px;color:#4b5563}\n.micro-modal-x{background:0 0;border:0;font-size:22px;line-height:1;color:#4b5563;cursor:pointer;border-radius:6px;width:30px;height:30px}\n.micro-modal-x:hover{background:rgba(0,0,0,.06)}\n.micro-modal-search{width:100%;margin:14px 0;padding:8px 12px;border:1px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;box-sizing:border-box}\n.micro-modal-search:focus{border-color:#3b82f6}\n.micro-modal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:10px;max-height:300px;overflow:auto}\n/* 「编辑按键」的候选 = **和外面那排键同一套外观**。\n * 组件直接复用 .micro-key（同一个圆角、同一条投影、同一个图标），这里只覆盖网格尺寸与选中态。\n * 以前候选项是一排 emoji 小方卡片，弹窗里挑的东西和选完之后键盘上看到的东西长得完全不一样。 */\n.micro-capgrid{grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:12px}\n/* 一格 = 一颗键（**只有图标**）。键下面的名字 2026-09-28 撤掉了，改由悬停气泡说（见下）。\n * 格子仍然保留 flex + 内边距：鼠标落在键四周那圈空白上也算选中这颗键（老手感不变）。 */\n.micro-cap-cell{display:flex;flex-direction:column;cursor:pointer;padding:4px;border-radius:22px}\n.micro-cap{background:#f7f5f1;border:1px solid rgba(255,255,255,.6)}\n.micro-cap-cell:hover .micro-cap{border-color:#93c5fd}\n/* 选中的那一格：**外围**那圈淡蓝底（框画在键上，见下面那条）。\n * 圆角 22 = 键的 18 + 格子内边距 4 —— 两道圆角同心，看起来是「一个框套着那颗键」，\n * 而不是「一个圆角方框套住一个圆角键」。 */\n.micro-cap-cell--sel{background:rgba(59,130,246,.10)}\n/* 选中态（2026-10-01 修用户报的「编辑按键时看不出选的是哪颗」）——\n * ⚠ **不是少写了样式，是被层叠盖掉**：\n *   原来写的是 `.micro-cap--sel{border-color;box-shadow}`（单类，本文件前段）。\n *   本文件后半段还有一条同样单类的 `.micro-key{… border:1px solid rgba(255,255,255,.6);\n *   box-shadow:0 2px 6px …}` —— 单类对单类比的是**出现顺序**，`.micro-key` 在后面 → 赢，\n *   把选中态的 `border-color` 与 `box-shadow` 整条盖掉（`.micro` 候选的底色/边框本来就与\n *   `.micro-key` 同值，所以平时看不出「被盖了」，只看到「选了跟没选一样」）。\n *   唯一还能看见蓝边的场合是鼠标停在键上：`.micro-cap--sel:hover` 是**两个**类，压得过单类。\n *   ⇒ 症状正好是用户说的「移开鼠标就不知道刚才选的是哪一颗」。\n * 修法：选择器写成 `.micro-key.micro-cap--sel`（两个类）—— **不再依赖文件里的先后顺序**，\n * 以后谁在文件后面再加一条 `.micro-key{…}` 也盖不掉它。\n * 长相也一并加强：1px 蓝边 + 淡蓝底 + 一圈**画在键外面**的 3px 扩散环（用户要的「外框」）。\n * 环最多伸出键 3px，而候选格子有 4px 内边距、格与格之间还有 10px 间距 → 永远不会被\n * 候选网格的 `overflow:auto` 裁掉（这点是实测出来的：把框画在格子上才会被裁）。\n * 回归防护在 test/verify_keycaps.js【4c】：那里是**按层叠顺序算赢家**，不是判「有没有写」。 */\n.micro-key.micro-cap--sel,.micro-key.micro-cap--sel:hover{border-color:#3b82f6;background:#eff6ff;box-shadow:0 0 0 3px rgba(59,130,246,.38),0 2px 6px rgba(0,0,0,.06)}\n\n/* ---- 悬停气泡：一颗键的「短名 / 功能名 / 说明」三行 ----\n * 布局里的键与「编辑按键」弹窗的候选共用它（见 components/common/cap-tip.jsx）。\n * 位置（left/top）由组件量出来后写在 style 上，这里只管长相 —— **必须是 position:fixed**：\n * 弹窗的候选网格是 overflow:auto 的滚动容器，相对定位的气泡会被裁掉。\n * 深色底是为了在「浅色卡片」和「浅色弹窗」两边都清楚（键帽本身也是浅色的）。\n * ⚠ max-width 必须与 cap-tip.jsx 的 CAP_TIP_MAX_W 一致：组件的左右夹取算的就是它。 */\n.micro-captip{position:fixed;z-index:10050;transform:translate(-50%,-100%);pointer-events:none;\n  box-sizing:border-box;width:max-content;max-width:248px;padding:8px 11px;border-radius:9px;\n  background:#1f2937;color:#f9fafb;box-shadow:0 8px 22px rgba(0,0,0,.28);text-align:left;line-height:1.45}\n/* 键离视口顶太近时翻到键**下面**（组件加的这个类只管把方向反过来）。 */\n.micro-captip--below{transform:translate(-50%,0)}\n/* 小箭头：默认朝下（气泡在键上方），--below 时朝上。用 border 三角形，缩放不失真。 */\n.micro-captip::after{content:\'\';position:absolute;left:50%;margin-left:-5px;bottom:-10px;\n  border:5px solid transparent;border-top-color:#1f2937}\n.micro-captip--below::after{bottom:auto;top:-10px;border-top-color:transparent;border-bottom-color:#1f2937}\n.micro-captip-name{font-size:12.5px;font-weight:700;letter-spacing:.2px}\n.micro-captip-func{margin-top:2px;font-size:11.5px;font-weight:600;color:#93c5fd}\n.micro-captip-desc{margin-top:3px;font-size:11.5px;color:rgba(249,250,251,.72)}\n/* 未指派的自定义键（拆分态那颗 Mic 右开关）：虚框 + 淡一点，\n * 一眼看出「这里还没选功能」，而不是「又一颗 MIC 键」。 */\n.micro-key--custom{border-style:dashed;border-color:rgba(0,0,0,.16);background:#f2efe9;box-shadow:none}\n.micro-modal-spacer{flex:1}\n/* 置灰的按钮要真的看得出不能点（「保存」在没换键帽时是禁用的）。 */\n.micro-modal .micro-ghost[disabled],.micro-modal .micro-primary[disabled]{opacity:.4;cursor:default}\n.micro-modal .micro-ghost[disabled]:hover{background:transparent}\n.micro-modal .micro-primary[disabled]:hover{opacity:.4}\n/* 「重置布局」确认弹窗：把会重置成什么一条条列出来 */\n.micro-reset-body{max-height:320px;overflow:auto;margin-top:8px}\n.micro-reset-list{margin:0 0 4px;padding-left:18px;color:#4b5563;font-size:12.5px;line-height:1.65}\n.micro-modal-hint{margin-top:10px;font-size:12px;line-height:1.5;color:#9ca3af}\n.micro-modal-foot{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:16px}\n.micro-modal .micro-ghost{background:transparent;color:#4b5563;border:0;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px}\n.micro-modal .micro-ghost:hover{background:rgba(0,0,0,.06)}\n.micro-modal .micro-primary{background:#000;color:#fff;border:0;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500}\n.micro-modal .micro-primary:hover{opacity:.88}\n.micro-control-item{cursor:default}\n/* 摇杆那颗控件**可点**（点开「模拟摇杆」方向配置）→ 必须是手型光标。\n * ⚠ 选择器要写成 `.micro-control-item.micro-joy-ctrl`（两个类）：本文件后半段还有一条单类的\n *   `.micro-control-item{… cursor:default}`，单类对单类比顺序、它在后面 → 原来那条单类的\n *   `.micro-joy-ctrl{cursor:pointer}` 一直被盖着（「能点的东西没有手型」＝用户在猜能不能点）。\n *   与候选键选中态是**同一个病**，见上面 .micro-key.micro-cap--sel 那条的说明。 */\n.micro-control-item.micro-joy-ctrl{cursor:pointer}\n.micro-joy-body{display:flex;gap:16px;align-items:stretch;margin-top:14px}\n/* 摇杆弹窗里的方向盘底盘：与布局里那颗摇杆同形（正圆），不再是圆角方框 —— 见上面 .micro-control-base 的注释。 */\n.micro-joy-pad{flex:none;align-self:center;width:64px;height:64px;border-radius:50%;background:#eef2f6;display:grid;place-items:center}\n.micro-joy-knob{width:26px;height:26px;border-radius:50%;background:#111;box-shadow:0 2px 4px rgba(0,0,0,.25)}\n.micro-joy-list{flex:1;display:flex;flex-direction:column;gap:6px}\n.micro-joy-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer}\n.micro-joy-row:hover{border-color:#93c5fd}\n.micro-joy-row--sel,.micro-joy-row--sel:hover{border-color:#3b82f6;background:#eff6ff}\n.micro-joy-arrow{font-size:15px;color:#4b5563;width:16px;text-align:center}\n.micro-joy-dir{font-weight:600;color:#1f2937}\n.micro-joy-val{margin-left:auto;color:#4b5563;font-size:13px;max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.micro-joy-foot{display:flex;justify-content:flex-end;margin-top:16px}\n.micro-joy-done{width:100%}\n.micro-overlay--sub{z-index:10002}\n.micro-modal--sub{width:min(480px,92vw)}\n.micro-sub-title{font-size:16px;font-weight:700;color:#1f2937}\n.micro-sub-clear{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid #e5e7eb;color:#4b5563;border-radius:20px;padding:3px 10px;font-size:12px;cursor:pointer}\n.micro-sub-clear span{color:#999;font-size:14px}\n.micro-sub-body{max-height:320px;overflow:auto}\n.micro-sub-cat{font-size:13px;font-weight:700;color:#374151;margin:12px 0 4px}\n.micro-sub-pick{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer}\n.micro-sub-pick:hover{background:#f3f4f6}\n.micro-sub-pick--soon{opacity:.45;cursor:default}\n.micro-sub-pick--soon:hover{background:transparent}\n.micro-sub-name{flex:none;font-weight:600;color:#1f2937}\n.micro-sub-des{margin-left:auto;color:#4b5563;font-size:12px;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.micro-sub-empty{padding:18px;text-align:center;color:#9ca3af;font-size:13px}\n.micro-wrap{display:flex;flex-direction:column;gap:16px;padding:0 0 24px;max-width:560px}\n.micro-heading{margin-bottom:4px}\n.micro-title{font-size:18px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0}\n.micro-subtitle{font-size:13px;color:#4b5563;margin:4px 0 0}\n.micro-card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 16px}\n.micro-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0}\n.micro-row + .micro-row{border-top:1px solid var(--dsw-alias-border-l2)}\n.micro-row__label{min-width:0;flex:1}\n.micro-row__title{font-size:14px;color:var(--dsw-alias-label-primary)}\n/* 模块描述文字：固定 #999（不跟随主题令牌——令牌在浅色主题下太浅，读不清） */\n.micro-row__desc{font-size:12px;color:#999;margin-top:2px}\n.micro-row__ctrl{flex:none;display:flex;align-items:center;gap:8px}\n.micro-dot{width:8px;height:8px;border-radius:999px;flex:none}\n.micro-dot--ok{background:var(--dsw-alias-state-success-primary)}\n.micro-dot--err{background:var(--dsw-alias-state-error-primary)}\n/* 「无法判定」：既不是成功也不是失败，用中性灰（别拿红点吓人） */\n.micro-dot--idle{background:var(--dsw-alias-label-tertiary)}\n.micro-status{font-size:13px;font-weight:500}\n.micro-status--ok{color:var(--dsw-alias-state-success-primary)}\n.micro-status--err{color:var(--dsw-alias-state-error-primary)}\n.micro-status--idle{color:var(--dsw-alias-label-secondary)}\n.micro-hint{font-size:12px;color:var(--dsw-alias-state-warn-label);margin-top:8px;line-height:1.5}\n/* 设置页里「这一页只演示、不触发功能」的说明（闸门见 hid-bridge 的 enterSim）。\n * 贴在键盘插图正上方、居中；用告警色是刻意的 —— 用户按了键没反应时，这行字是唯一解释。 */\n.micro-sim-hint{text-align:center;margin:12px 0 0}\n.micro-slider{width:160px;accent-color:var(--dsw-alias-brand-primary)}\n.micro-val{font-size:12px;color:var(--dsw-alias-label-secondary);min-width:34px;text-align:right}\n/* ---------- 电量（设置页「电池」那一行；只在设备连上时出现）----------\n * 颜色三档：正常跟随次级文字色；**低电量**（阈值见 utils/device.js 的 BATTERY_LOW_PCT）\n * 图标与数字一起转告警红 —— 数字也要红，因为图标小、红点容易被当成装饰。\n * 「充电中」用中性文字的小胶囊，不抢告警色（此刻低电量已经不告警了，见 batteryView）。 */\n.micro-batt{display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary)}\n.micro-batt--low{color:var(--dsw-alias-state-error-primary)}\n.micro-batt__val{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary);min-width:34px;text-align:right}\n.micro-batt__val--low{color:var(--dsw-alias-state-error-primary)}\n.micro-batt__tag{font-size:11px;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 6px}\n.micro-select{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 8px;font-size:13px}\n.micro-switch{position:relative;width:38px;height:22px;border-radius:999px;border:none;background:var(--dsw-alias-label-tertiary);cursor:pointer;transition:background .15s}\n.micro-switch[data-on]{background:var(--dsw-alias-brand-primary)}\n.micro-switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:999px;background:#fff;transition:transform .15s}\n.micro-switch[data-on]::after{transform:translateX(16px)}\n.micro-ghost{background:0 0;border:none;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer;padding:4px 8px;border-radius:8px}\n.micro-ghost:hover{background:var(--dsw-alias-interactive-bg-hover)}\n/* 破坏性操作（「移除」）：平时与其它 ghost 按钮同形，只有文字用告警色 ——\n * 按钮长得越像普通按钮，越要让人一眼看出它不一样。 */\n.micro-ghost--danger{color:var(--dsw-alias-state-error-primary)}\n.micro-ghost--danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}\n.micro-modal .micro-primary--danger{background:var(--dsw-alias-state-error-primary)}\n.micro-modal .micro-primary--danger:hover{opacity:.88}\n/* ---------- 保存提示：顶部悬浮 message ----------\n * 由设置页 MicroSaveToast 渲染，只在 saved / saving / error 时存在。\n * 三条硬约束：\n *   1) position:fixed —— 必须**脱离文档流**（原来的行内文本每次出现都把下方卡片顶动一行）；\n *   2) z-index 高于本插件的弹窗遮罩（.micro-modal-overlay 9999 / 二级 10002），\n *      否则在「编辑键帽」弹窗关掉的那一拍会被盖住 —— 保存提示恰好出现在那一拍；\n *   3) pointer-events:none —— 它是通知不是控件，绝不能挡住底下任何点击\n *      （视口顶部正中在设置弹窗的头部区域，那里有 DSH 自己的关闭按钮附近的可点区域）。\n * 颜色走 DSH 主题令牌：浅色/深色主题自动跟随，不写死背景。 */\n.micro-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10050;display:flex;align-items:center;gap:7px;max-width:70vw;padding:7px 14px 7px 12px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));box-shadow:0 10px 26px rgba(15,18,25,.16),0 2px 6px rgba(15,18,25,.08);font-size:13px;font-weight:500;line-height:1.25;color:var(--dsw-alias-label-primary,#111);pointer-events:none;animation:micro_toast_in .18s ease-out}\n.micro-toast__ico{display:flex;align-items:center;justify-content:center;flex:none;width:14px;height:14px}\n.micro-toast__text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.micro-toast--saving .micro-toast__ico{color:var(--dsw-alias-label-secondary,#6b7280)}\n.micro-toast--saved .micro-toast__ico{color:var(--dsw-alias-state-success-primary,#16a34a)}\n.micro-toast--error .micro-toast__ico{color:var(--dsw-alias-state-error-primary,#dc2626)}\n.micro-toast--error{color:var(--dsw-alias-state-error-primary,#dc2626)}\n/* 「保存中」用转圈而不是静态图标：写盘快慢不定，转圈说明还在进行中。 */\n.micro-toast__spin{box-sizing:border-box;width:13px;height:13px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:micro_toast_spin .7s linear infinite}\n@keyframes micro_toast_in{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}\n@keyframes micro_toast_spin{to{transform:rotate(360deg)}}\n@media (prefers-reduced-motion:reduce){.micro-toast{animation:none}.micro-toast__spin{animation-duration:1.6s}}\n\n.micro-page-wrap {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n}\n\n.micro-keyboard-wrap {\n  width: 420px;\n  padding: 24px;\n  background: #eae8e3;\n  border-radius: 28px;\n  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);\n}\n\n.micro-grid-4col {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 16px;\n}\n\n.micro-key {\n  aspect-ratio: 1 / 1;\n  background: #f7f5f1;\n  border-radius: 18px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);\n  cursor: pointer;\n  /* 回弹曲线：按下时快（配合 --pressed 里的 transition-duration），松开时轻轻回弹 */\n  transition: transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.18s ease, background 0.18s ease;\n  border: 1px solid rgba(255, 255, 255, 0.6);\n}\n\n.micro-key:active {\n  transform: translateY(2px);\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);\n}\n\n/* 真机按键时布局里对应键的按压特效（纯视觉，见 components/settings/keyboard-layout.jsx 的 useHidSignals）：\n   按下 = 陷下去 + 内阴影 + 底色变暗；松开时用上面的回弹曲线弹回来。 */\n.micro-key--pressed {\n  transform: translateY(3px) scale(0.95);\n  background: #e9e6df;\n  box-shadow: 0 0 0 rgba(0, 0, 0, 0.05), inset 0 2px 6px rgba(0, 0, 0, 0.14);\n  transition-duration: 0.06s;\n}\n\n.micro-key-dot {\n  width: 22px;\n  height: 22px;\n  border-radius: 50%;\n  background: #7b68bc;\n}\n\n.micro-control-item {\n  aspect-ratio: 1 / 1;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: transparent;\n  box-shadow: none;\n  border: none;\n  cursor: default;\n}\n\n/* 旋钮 / 摇杆的**凹槽底盘**：必须跟里面的圆零件（.micro-circle-knob-inner / .micro-joystick-dot）\n * 同形 —— 都是正圆。改回 px 圆角会让"圆零件"看上去像被套进一个圆角方框里\n * （用户 2026-09-23 报的「原来圆形的图标变成圆角形状」就是这层底盘造成的：\n *  白芯 #f1f1ef 与底盘 #e6e4df 对比度极低，整体看就是个圆角方形）。\n * 契约由 test/verify_layout.js 的【圆形零件】一节守着。 */\n.micro-control-base {\n  width: 92px;\n  height: 92px;\n  border-radius: 50%;\n  background: #e6e4df;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.4);\n  border: 1px solid rgba(0, 0, 0, 0.04);\n}\n\n.micro-circle-knob-inner {\n  width: 72px;\n  height: 72px;\n  /* 定位祖先：转动指示的环与蓝点都画在它里面（见下面 .micro-knob-ring / .micro-knob-dot） */\n  position: relative;\n  border-radius: 50%;\n  background: #f1f1ef;\n  box-shadow: 0 6px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -4px 8px rgba(0,0,0,0.08);\n  border: 1px solid rgba(0, 0, 0, 0.06);\n}\n\n/* ---------- 旋钮的「转动指示」（2026-09-25，判据见 utils/knob-state.js）----------\n * 设备转动 / 按下旋钮时，圆盘上亮起一圈淡蓝描边，蓝点落在**这次转动的方向**上：\n * 顺时针 → 右侧 3 点（90°），逆时针 → 左侧 9 点（-90°）。活性窗口过期后两者一起淡出 ——\n * 静止时与以前完全一样，看不见环也看不见点。\n * 几何：盘半径 36、环宽 2 → 内缘 34；点到圆心 27 + 点半径 6 = 33，外缘贴着环内侧\n * （KNOB_DOT_R，见 components/settings/keyboard-layout.jsx）。 */\n.micro-knob-ring {\n  position: absolute;\n  inset: 0;\n  border-radius: 50%;\n  border: 2px solid #a8c8f8;\n  opacity: 0;\n  transition: opacity 0.18s ease;\n}\n\n.micro-knob-dot {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  width: 12px;\n  height: 12px;\n  border-radius: 50%;\n  background: #7ba7f5;\n  opacity: 0;\n  /* 兜底角度 = 静止位（左侧）。组件每次都写 inline 角度，transition 让它在左右之间滑过去 ——\n   * 所以这里**不能**省：写成点停在圆心会让第一次转动时蓝点从中心飞出去。 */\n  transform: translate(-50%, -50%) rotate(-90deg) translateY(-27px);\n  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;\n}\n\n.micro-control-base.micro-knob--active .micro-knob-ring { opacity: 1; }\n.micro-control-base.micro-knob--active .micro-knob-dot { opacity: 1; }\n\n.micro-joystick-dot {\n  width: 72px;\n  height: 72px;\n  border-radius: 50%;\n  background: #1a1a1a;\n  /* 推杆时抖得很快（inline style 覆盖成 .1s），松手按这条回弹曲线归位 ——\n     所以默认值就是「回弹」那条，飘出去的方向感由 JS 写 transform。 */\n  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);\n  will-change: transform;\n}\n\n.micro-svg-icon {\n  width: 32px;\n  height: 32px;\n}\n\n.micro-bottom-row {\n  margin-top: 16px;\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 16px;\n  align-items: stretch;\n}\n\n.micro-knob-panel {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n}\n\n.micro-knob-lights {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n}\n\n.micro-knob-light {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n}\n\n.micro-blue { background: #74a9ff; }\n.micro-green { background: #90c968; }\n.micro-amber { background: #e0c05a; }\n\n.micro-circle-knob {\n  width: 70px;\n  height: 70px;\n  border-radius: 50%;\n  background: #222;\n  flex-shrink: 0;\n}\n\n.micro-key-mic {\n  grid-column: span 2;\n  aspect-ratio: unset;\n}\n\n/* 预览模式（首次连接引导里的键盘插图，见 components/modals/guide.jsx）：\n * 只画不响应 —— 整张插图对指针透明（连 :active 的按压回弹也不要），背景交还给外层卡片。 */\n.micro-page-wrap--preview{background:transparent}\n.micro-page-wrap--preview .micro-key{cursor:default;pointer-events:none}\n/* ⚠ 2026-09-30：`.micro-key-dot--swatch` 那条规则已撤 —— 引导里那张键盘要与设置页里那台\n * 逐像素一致（用户报障「导览页面的按键颜色和设置页不一样」）。键面配色只许有一个来源：\n * 上面那条 `.micro-key-dot`。别再按状态给键面另加一套颜色。 */\n\n/* ---------- 首次连接引导 ----------\n * 层级夹在本插件自己的弹窗（9999 / 二级 10002）之上、保存提示（10050）之下：\n * 引导是整屏遮罩，必须在所有设置弹窗之上；但保存提示只出现在设置页里，\n * 万一同时出现也不该被引导盖住。\n * 注意：**没有**「点遮罩关闭」——引导一旦关掉就永久记住「看过了」（见 modals/guide.jsx 顶部），\n * 误点一次等于再也看不到，所以出口只有右上角 × / 跳过 / 走完两步。 */\n.micro-guide-overlay{z-index:10040}\n.micro-guide{position:relative;width:min(600px,94vw);max-height:92vh;overflow:auto;padding:18px 18px 0;display:flex;flex-direction:column}\n.micro-guide-x{position:absolute;top:6px;right:8px;z-index:2}\n.micro-guide-shot{display:flex;justify-content:center;margin-bottom:14px;pointer-events:none}\n.micro-guide-shot .micro-keyboard-wrap{width:min(480px,100%);box-sizing:border-box;padding:18px;border-radius:22px;box-shadow:0 6px 20px rgba(0,0,0,.08)}\n.micro-guide-body{padding:0 6px}\n.micro-guide-title{font-size:20px;font-weight:700;color:#1f2937;text-align:center}\n.micro-guide-desc{margin-top:8px;font-size:13px;line-height:1.65;color:#4b5563;text-align:center}\n.micro-guide-status{margin-top:12px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px;font-size:13px;font-weight:500}\n.micro-guide-sep{color:#c9c9c9}\n.micro-guide-legend{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;text-align:left;border:1px solid #ececec;border-radius:12px;padding:12px 14px}\n.micro-guide-legend-row{display:flex;align-items:center;gap:8px;font-size:12.5px;min-width:0}\n.micro-guide-swatch{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}\n.micro-guide-legend-name{font-weight:600;color:#374151;flex:none}\n.micro-guide-legend-hint{color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.micro-guide-note{margin-top:14px;padding:12px 14px;border-radius:12px;background:#f7f5f1;font-size:12.5px;line-height:1.65;color:#4b5563;text-align:left}\n.micro-guide-foot{margin-top:16px;padding-bottom:18px;justify-content:center}\n@media (max-width:560px){.micro-guide-legend{grid-template-columns:1fr}}\n\n/* ---------- 侧边栏底部：设置按钮旁边的方形键盘入口 ----------\n * 展开态：36×36 方块，**覆盖定位**贴到「设置」那一行的右端（与齿轮同一行并列），\n * 因此它不占文档流，底栏不会为它多出一行。top/right 由 JS 现场量出来写在 style 上\n * （见 components/sidebar/action.jsx 的 placeFootAction）：DSH 的类名是模块哈希、行高还会随\n * 展开/收起变化，量着放才稳。量不到就退回文档流（仍可用，只是多占一行）。\n * 收起成 56px 导轨时留在流里：36×36 居中，正好落在齿轮正上方（与 DSH 自己的导轨按钮同规格）。 */\n.micro-foot-action{box-sizing:border-box;position:relative;width:36px;height:36px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:10px;flex:none;align-items:center;justify-content:center;margin:0;padding:0;font-family:inherit;display:flex;overflow:hidden}\n.micro-foot-action:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.micro-foot-action>svg{flex:none;display:block}\n/* 覆盖到设置行右端时：抬一层（压住设置行的 hover 反馈也不影响点击），并确保外边距为 0\n * ——绝对定位的 top/right 是从**外边距盒**起算的，留白由几何常量控制。 */\n.micro-foot-action--pinned{position:absolute;z-index:1;margin:0}\n/* 导轨态：留在文档流，居中（footerActions 是横向 flex，这里只有它一个）。 */\n.micro-foot-action--rail{align-self:center;margin:0 0 4px}\n/* 「键盘已断开」的红点（判据在 utils/device.js 的 isDeviceOffline，见 sidebar/action.jsx）。\n * 画在按钮**内圈**：按钮是 overflow:hidden（画到框外会被裁掉），而按钮 36px、图标 20px 居中，\n * 所以贴着内圈右上角 = 看起来正落在图标右上。描边用底层的颜色给红点垫开一点，\n * 免得它跟图标的线条糊在一起（`corner-shape` 由 core.js 的 micro- 兜底规则抵掉，这里是正圆）。\n * pointer-events:none：它纯装饰，点下去仍然是「打开键盘设置页」，不把点击语义劈成两个。 */\n.micro-foot-action__dot{position:absolute;top:3px;right:3px;width:7px;height:7px;border-radius:999px;background:var(--dsw-alias-state-error-primary,#ef4444);box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-1,#fff);pointer-events:none}\n\n/* ---------- 「与后台断开」气泡（替代 DSH 画在「设置」那一行里的连接指示器）----------\n * 背景：DSH 的 triggerRow 里除了「设置」按钮，还并排放着一个连接状态指示器 —— 与后台断开时\n * 它是那条橙色的「自动重连中」，刚恢复时是绿色的「连接成功」。那一行是 `flex-start` 布局、\n * 设置按钮是 `flex:1`（吃满剩余宽度），所以指示器**正好落在我们贴右端的地方**：要么被键盘\n * 图标压住（2026-09-25 第一版用户截图），要么逼得我们退回文档流、图标孤零零多占一行\n * （第二版用户截图：「这个错误更加严重了」）。\n * 现行处置：**把那个指示器藏起来**（宿主 DOM 上打 data-micro-conn-hide，React 重渲染也顶不掉），\n * 改用这个气泡展示同一句话 —— 那一行恢复成「只有一个设置按钮」，覆盖定位照常；\n * 提示没丢，点气泡还能「立即重连」（= 点那颗被藏起来的指示器，见 sidebar/action.jsx）。\n * 深色 + 小尾巴是用户指定的样式（与原生 tooltip 一致），明暗两套主题下都用深色。\n * ⚠ 2026-09-26 用户第三次报「重新连接又改回黄色错位了」：**这套气泡一直没显示出来**，\n *   因为 `gearRowOf` 取的是 `gear.parentElement`（display:contents 的槽位出口），\n *   压根找不到那个指示器 —— 于是它既没被藏、气泡也没弹，就地压住方块。根因与修法见\n *   sidebar/action.jsx 的 `gearRowOf`（改用 layoutParent）。CSS 这边没问题，别改。\n * 节点挂在 body 上、position:fixed：① 不被 footer 那一行的 overflow 裁掉；\n * ② 不在 React 管的子树里，React 重渲染不会把它顶掉（它压根管不着这个节点）。\n * top/right 由 JS 现场量（sidebar/action.jsx 的 placeConnTip），这里只管长相。\n * 小尾巴是个真元素（不是 ::after）：位置要按方块中心算，真元素写 inline style 更省事。 */\n[data-micro-conn-hide]{display:none!important}\n.micro-conn-tip{position:fixed;z-index:60;box-sizing:border-box;display:block;max-width:calc(100vw - 20px);padding:6px 10px;border-radius:10px;background:#1f2124;color:#fff;font-size:12.5px;line-height:18px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease}\n.micro-conn-tip--on{opacity:1;visibility:visible;pointer-events:auto;cursor:pointer}\n.micro-conn-tip__text{display:block;overflow:hidden;text-overflow:ellipsis}\n.micro-conn-tip__tail{position:absolute;top:100%;right:11px;width:0;height:0;border:6px solid transparent;border-bottom:0;border-top-color:#1f2124;font-size:0;line-height:0;pointer-events:none}\n.micro-conn-tip--below .micro-conn-tip__tail{top:auto;bottom:100%;border-top:0;border-bottom:6px solid #1f2124}\n\n/* ── 「设置」的悬停提示：挪到行上方 + 补一根朝下的小尾巴（2026-09-26）────────────\n * DSH 的 Tooltip（dsh-client-ui-primitives）默认 side:"right"：`left = 锚点右缘 + 10px`、\n * 竖直居中。「设置」按钮被我们收窄之后，那个落点在侧边栏里面、正好压住键盘方块。\n * 用户要的位置是「在设置上面」——这里把它改到**行上方**：\n *   * 行打 data-micro-gear-row（sidebar/action.jsx 的 markGearTip）→ position:relative 做包含块；\n *   * 提示打 data-micro-gear-tip → 改成 absolute、贴着行上缘、左缘对齐齿轮。\n * ⚠ 内联 left/top 是 DSH 的 JS 写的（悬停时算一次、ResizeObserver 每次重算都重写），\n *   不带 !important 压不住；transform 也要清 —— [data-side=right] 自带 translateY(-50%)。\n * ⚠ `calc(100% + 8px)` 里的 8 = sidebar/action.jsx 的 TIP_ABOVE_GAP，两处数字改要一起改。\n * 标记只在「我们贴右端」的展开态打（unpin 时摘掉）：收起成导轨 / 退回文档流时提示回 DSH 默认。\n *\n * 小尾巴（::after）：用户给的样式图就是「深色圆角气泡 + 下方一个小三角」（工具提示的标准形状）。\n * 一个悬在行上方的气泡没有尾巴，看起来就像「一块压在那里的东西」——正是上一轮报的那个画面。\n * DSH 自己的 bubble 没有尾巴（它的实现是一句话 + 快捷键，没有装饰节点），所以我们自己补一根。\n * 颜色用 DSH 的 tooltip 令牌（跟主题走），别写死深色。::after 不会被裁：bubble 的 CSS 里没有\n * overflow:hidden（`.{bubble}` 只有 display/position/padding/圆角这些）。\n * `left:14px` = 齿轮左缘往右 14px，正落在齿轮图标（20px、左内边距约 10px）那一片上。 */\n[data-micro-gear-row]{position:relative}\n[data-micro-gear-tip]{position:absolute!important;left:var(--micro-gear-tip-left,0)!important;right:auto!important;top:auto!important;bottom:calc(100% + 8px)!important;transform:none!important}\n[data-micro-gear-tip]::after{content:\'\';position:absolute;top:100%;left:14px;width:0;height:0;border:6px solid transparent;border-bottom:0;border-top-color:var(--dsw-alias-tooltip-bg,#1f2124);font-size:0;line-height:0;pointer-events:none}\n\n/* ── 第三方插件依赖（设置页底部；清单来自 config/default.js 的 PLUGIN_DEPS，\n * **清单为空则整卡不渲染**（用户 2026-09-29 口径）—— 所以这里只有行内徽标的样式，\n * 没有空态样式；见 settings/panel.jsx）──\n * 徽标复刻 .micro-batt__tag 的胶囊造型，但用绿/红两态表达「已安装 / 未安装」。\n * 绿色/红色取 DSH 设计令牌的状态色，跟随主题（不写死色值，避免暗色主题下看不清）。 */\n.micro-plugin-badge{font-size:11px;line-height:1;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:4px 8px;white-space:nowrap}\n.micro-plugin-badge--on{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}\n.micro-plugin-badge--off{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}\n';
const FLASH_MS = 170;
const STALE_MS = 1200;
const isTrue = (v) => v === true || v === 1;
const createPressTracker = ({ now = () => Date.now() } = {}) => {
  let held = {};
  let flash = {};
  let lastKeyT = null;
  let lastSnapAt = 0;
  let sawDown = false;
  const fold = (s, split) => {
    if (!s || typeof s !== "object") return;
    const t = now();
    lastSnapAt = t;
    if (Array.isArray(s.down)) {
      sawDown = true;
      const next = {};
      if (s.open !== false) {
        for (const name of s.down) {
          const v = keyVisual(name, split);
          if (v) next[v] = true;
        }
      }
      held = next;
    }
    const kt = s.keyT;
    if (kt && typeof kt === "object") {
      if (lastKeyT === null) {
        lastKeyT = { ...kt };
      } else {
        for (const name of Object.keys(kt)) {
          const cur = Number(kt[name]) || 0;
          const prev = lastKeyT[name];
          lastKeyT[name] = cur;
          if (prev === void 0) {
            if (cur > 0) {
              const v0 = keyVisual(name, split);
              if (v0 && !held[v0]) flash[v0] = t + FLASH_MS;
            }
            continue;
          }
          const d = cur - (Number(prev) || 0);
          if (d <= 0) continue;
          const v = keyVisual(name, split);
          if (v && !held[v]) flash[v] = t + FLASH_MS;
        }
      }
    }
  };
  const tap = (visualId) => {
    if (visualId) flash[visualId] = now() + FLASH_MS;
  };
  const snapshot2 = () => {
    const t = now();
    if (sawDown && t - lastSnapAt > STALE_MS) held = {};
    const out = {};
    for (const k of Object.keys(flash)) {
      if (flash[k] > t) out[k] = true;
      else delete flash[k];
    }
    for (const k of Object.keys(held)) out[k] = true;
    return out;
  };
  const reset = () => {
    held = {};
    flash = {};
    lastKeyT = null;
    lastSnapAt = 0;
    sawDown = false;
  };
  return { fold, tap, snapshot: snapshot2, reset };
};
const samePressed = (a, b) => {
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!isTrue(b && b[k])) return false;
  return true;
};
const KNOB_DOT_DEG = { cw: 90, ccw: -90 };
const KNOB_DOT_REST_DEG = KNOB_DOT_DEG.ccw;
const KNOB_ACTIVE_MS = 900;
const createKnobTracker = ({ now = () => Date.now() } = {}) => {
  let lastEnc = null;
  let lastPress = null;
  let dir = null;
  let until2 = 0;
  const fold = (s) => {
    if (!s || typeof s !== "object") return;
    const t = now();
    let seen = false;
    const enc = typeof s.enc === "number" ? s.enc : null;
    if (enc !== null) {
      if (lastEnc === null) {
        lastEnc = enc;
      } else if (enc !== lastEnc) {
        const d = enc - lastEnc;
        lastEnc = enc;
        if (d !== 0) {
          dir = d > 0 ? "cw" : "ccw";
          seen = true;
        }
      }
    }
    const press = typeof s.knobPress === "number" ? s.knobPress : null;
    if (press !== null) {
      if (lastPress === null) lastPress = press;
      else if (press !== lastPress) {
        lastPress = press;
        seen = true;
      }
    }
    if (seen) until2 = t + KNOB_ACTIVE_MS;
  };
  const snapshot2 = () => {
    const active = now() < until2;
    return { active, dir: active ? dir : null };
  };
  const reset = () => {
    lastEnc = null;
    lastPress = null;
    dir = null;
    until2 = 0;
  };
  return { fold, snapshot: snapshot2, reset };
};
const Key = ({ children, onClick, className = "", ...rest }) => {
  return /* @__PURE__ */ jsxRuntime.jsx("div", { onClick, className: `micro-key ${className}`, ...rest, children });
};
const BatteryIcon = ({ pct, charging }) => {
  const known = typeof pct === "number" && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const w = known ? Math.max(1.4, pct / 100 * 12.4) : 0;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "svg",
    {
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      "aria-hidden": "true",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "2.6", y: "7.2", width: "17", height: "9.6", rx: "2.6" }),
        /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M21.4 10.6v2.8", strokeWidth: 2.2 }),
        charging ? /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12.9 8.4l-3.4 4.4h2.3l-.7 3.2 3.4-4.4h-2.3z", fill: "currentColor", stroke: "none" }) : w > 0 ? /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "4.6", y: "9.2", width: w, height: "5.6", rx: "1.3", fill: "currentColor", stroke: "none" }) : null
      ]
    }
  );
};
const SvgIcon = ({ children }) => /* @__PURE__ */ jsxRuntime.jsx("svg", { viewBox: "0 0 24 24", className: "micro-svg-icon", stroke: "#222", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", children });
const CAP_ICON = {
  mode: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 2.8 21 7.4 12 12 3 7.4z" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M3 12.2 12 16.8 21 12.2" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M3 16.6 12 21.2 21 16.6" })
  ] }),
  // 归档箱：上盖比箱体宽一点（一眼区分「箱子」与「表格」），中间一道投口。
  arch: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "2", y: "3.4", width: "20", height: "5.4", rx: "1.2" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4.4 8.8v9.6a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2V8.8" }),
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "9.8", y1: "12.8", x2: "14.2", y2: "12.8" })
  ] }),
  rej: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "12", cy: "12", r: "10" }),
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "15", y1: "9", x2: "9", y2: "15" }),
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "9", y1: "9", x2: "15", y2: "15" })
  ] }),
  // 勾（APPR）—— 与上面的叉成对：同一个圆，勾的包围盒 7.6×5.2、居中于圆心，
  // 端点离圆边与叉留的呼吸空间一致。见文件头 2026-09-25 那条。
  appr: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "12", cy: "12", r: "10" }),
    /* @__PURE__ */ jsxRuntime.jsx("polyline", { points: "8.2 11.4 10.6 14.6 15.8 9.4" })
  ] }),
  mic: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "12", y1: "19", x2: "12", y2: "23" }),
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "8", y1: "23", x2: "16", y2: "23" })
  ] }),
  // 纸飞机（原来这里是警告三角，见上面对照表）。
  send: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "21.4", y1: "2.6", x2: "10.6", y2: "13.4" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M21.4 2.6 14.6 21.4 10.6 13.4 2.6 9.4z" })
  ] }),
  // 分叉（FORK）：一条主干向上分成两条 —— 「从这里变成两条」，不是复制也不是删除。
  fork: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 21.2V12.6" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 12.6 6.4 7.2V3.2" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 12.6 17.6 7.2V3.2" })
  ] }),
  // ---- 2026-09-28 的 13 颗（键帽名见 actions/registry.js 各条的 desc）----
  // 设置（齿轮）：外圈 + 轮毂 + 八颗**伸在圈外**的齿。刻意不画成「同心双圆」——
  // 那在 26px 下读起来像靶心/录制键。2026-09-28 起它归**「设置」那颗键（打开通用设置）**，
  // 「键盘设置」另有一颗 keyboard（见下）——两颗都得能一眼分开，所以这里没动画法。
  gear: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "12", cy: "12", r: "6.6" }),
    /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "12", cy: "12", r: "2.6" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 2.2v3.2M12 18.6v3.2M2.2 12h3.2M18.6 12h3.2M4.9 4.9l2.3 2.3M16.8 16.8l2.3 2.3M19.1 4.9l-2.3 2.3M7.2 16.8l-2.3 2.3" })
  ] }),
  // 键盘（键盘设置）：圆角外框 + 两排错开的**键点** + 一条空格键。
  // 键位画「点」而不是小方块：26px 下小方块的细边会糊成一片灰，圆点（`v.01` 配 SvgIcon 的
  // linecap:round = 直径等于描边宽度的实心点）还认得出是键盘；点单独用 1.8 的描边，
  // 免得跟外框一样粗而糊成一团。这是它与 gear 的分界 —— 本插件自己的设置页是「键盘」。
  keyboard: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "1.9", y: "5.4", width: "20.2", height: "13.2", rx: "2.4" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6.1 9.4v.01M10.1 9.4v.01M14.1 9.4v.01M18.1 9.4v.01M8.1 12.6v.01M12.1 12.6v.01M16.1 12.6v.01", strokeWidth: 1.8 }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M8.4 15.8h7.2" })
  ] }),
  // 终端：窗口 + `>` 提示符 + 光标横线（不画整个 `>_` 字形，缩放后太糊）。
  terminal: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "2.6", y: "3.6", width: "18.8", height: "16.8", rx: "2.6" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M7.2 9.2 10.2 12.1 7.2 15" }),
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "12.8", y1: "15.2", x2: "16.8", y2: "15.2" })
  ] }),
  // 清空输入：**橡皮擦**（斜放的长条 + 一道分界线）——「把整块字迹擦掉」。
  // 2026-10-01 用户要求「清空」这颗换图标（原来它画的退格轮廓，现在归「删除」那颗）。
  erase: /* @__PURE__ */ jsxRuntime.jsxs("g", { transform: "rotate(-45 12 12)", children: [
    /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "3.8", y: "8.6", width: "16.4", height: "6.8", rx: "1.8" }),
    /* @__PURE__ */ jsxRuntime.jsx("line", { x1: "13.6", y1: "8.6", x2: "13.6", y2: "15.4" })
  ] }),
  // 删除：**退格键**的轮廓 —— 左边一个尖角、右边一个方框、中间一个叉，一下少一个字。
  // 为什么不用垃圾桶：垃圾桶是「永久删掉」，这颗键只删当前草稿（见 registry 的 delete_char）。
  clear: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M21.2 6.2v11.6a1.6 1.6 0 0 1-1.6 1.6H9.6a2 2 0 0 1-1.5-.7L2.6 12l5.5-6.7a2 2 0 0 1 1.5-.7h10a1.6 1.6 0 0 1 1.6 1.6z" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12.6 9.6l5 4.8M17.6 9.6l-5 4.8" })
  ] }),
  // 新建聊天：对话气泡（左下角有个尾巴）+ 加号。
  newchat: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M3.4 5.4A1.8 1.8 0 0 1 5.2 3.6h13.6a1.8 1.8 0 0 1 1.8 1.8v8.2a1.8 1.8 0 0 1-1.8 1.8H10l-4.6 4.2v-4.2H5.2a1.8 1.8 0 0 1-1.8-1.8z" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 7.4v5.2M9.4 10h5.2" })
  ] }),
  // 上传：箭头向上 + **开口托盘**（两侧有竖边的 U）。托盘是它与 reasonUp 的分界，见文件头 ③。
  upload: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 15.6V3.6" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M7.4 8.2 12 3.6l4.6 4.6" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M3.6 15.4v3.4a1.8 1.8 0 0 0 1.8 1.8h13.2a1.8 1.8 0 0 0 1.8-1.8v-3.4" })
  ] }),
  // 压缩上下文：两支箭头**朝里收**（角括号在靠中心那一端，就是箭头尖）。
  compact: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M3.6 3.6 10 10" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M10 5.4V10H5.4" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M20.4 20.4 14 14" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M14 18.6V14h4.6" })
  ] }),
  // 目标：一根**旗杆 + 燕尾旗**（旗面右端两个尖角、中间凹进去 = 旗子飘起来的形状）。
  // 为什么不用靶心（同心圆）：那与「设置」那颗齿轮（同心双圆 + 齿）在 26px 下会认混，
  // 而旗子在本表里是新形状；「插旗 = 定下目标」也是通用读法（原来是「轨迹」的时间轴图标，
  // 2026-10-01 用户要求把这颗键换成「目标」）。
  goal: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M5.6 3.4v17.2" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M5.6 4.6h13l-3 4.2 3 4.2h-13z" })
  ] }),
  // 推理强度 +：向上的箭头停在一条**基线**上（「档位往上抬」）。基线是它与 upload 的分界。
  reasonUp: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 15.8V4.4" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6.8 9.6 12 4.4l5.2 5.2" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4.6 19.6h14.8" })
  ] }),
  // 推理强度 -：向下的箭头停在一条基线上（整条画法上下翻转，与上面那颗成对）。
  reasonDown: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 8.2v11.4" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6.8 14.4 12 19.6l5.2-5.2" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4.6 4.4h14.8" })
  ] }),
  // 文件夹：带标签页的文件夹轮廓。
  folder: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M3.4 6.8A2 2 0 0 1 5.4 4.8h3.4l2.2 2.6h7.6a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z" }),
  // 插件：**插头**（两个插脚 + 圆底插头体 + 一条线）——「插件」就是 plug，比拼图块好认、
  // 也不用把拼图的凹凸画成一条长路径（小尺寸下会糊）。
  plug: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M9.4 3.6v4.4M14.6 3.6v4.4" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M6.6 8h10.8v3.4a5.4 5.4 0 0 1-10.8 0z" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 16.8v3.6" })
  ] }),
  // 未指派（自定义键）：虚框 + 加号 ——「这里还没选功能」。
  [CUSTOM_ICON]: /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("rect", { x: "3.6", y: "3.6", width: "16.8", height: "16.8", rx: "4.2", strokeDasharray: "3.2 3.2" }),
    /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M12 8.6v6.8M8.6 12h6.8" })
  ] })
};
const KeyFace = ({ capId }) => {
  const cap = keycapOf(capId);
  return /* @__PURE__ */ jsxRuntime.jsx(SvgIcon, { children: CAP_ICON[cap ? cap.icon : CUSTOM_ICON] || CAP_ICON[CUSTOM_ICON] });
};
const CAP_TIP_MAX_W = 248;
const CAP_TIP_GAP = 10;
const CAP_TIP_FLIP_Y = 118;
const CAP_TIP_EDGE = 8;
const capTipLines = (cap, t) => {
  if (!cap) {
    return {
      name: CUSTOM_LABEL,
      func: "",
      desc: "这颗键还没指派功能，按下不执行任何操作（点它挑一颗键帽）"
    };
  }
  const tt = typeof t === "function" ? t : null;
  let func = "";
  if (tt && cap.labelKey) {
    let bound = "";
    try {
      bound = String(tt(cap.labelKey) || "");
    } catch (e) {
      bound = "";
    }
    if (bound && bound !== cap.labelKey) func = bound;
  }
  return {
    name: String(cap.label || ""),
    func,
    desc: String(cap.desc || "")
  };
};
const capTipPlacement = (rect, viewport = {}) => {
  const r = rect || {};
  const vw = Number(viewport && viewport.width) > 0 ? Number(viewport.width) : 1024;
  const half = CAP_TIP_MAX_W / 2 + CAP_TIP_EDGE;
  const lo = half;
  const hi = vw - half;
  const cx = Number(r.left || 0) + Number(r.width || 0) / 2;
  const x = hi <= lo ? vw / 2 : Math.min(Math.max(cx, lo), hi);
  const below = Number(r.top || 0) < CAP_TIP_FLIP_Y;
  return {
    x,
    below,
    y: below ? Number(r.bottom || 0) + CAP_TIP_GAP : Number(r.top || 0) - CAP_TIP_GAP
  };
};
function useCapTip() {
  const [tip, setTip] = React.useState(null);
  const show = React.useCallback((cap, el) => {
    if (!el || typeof el.getBoundingClientRect !== "function") {
      setTip(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTip({ cap: cap || null, left: r.left, top: r.top, bottom: r.bottom, width: r.width });
  }, []);
  const hide = React.useCallback(() => setTip(null), []);
  return { tip, show, hide };
}
const capTipHandlers = (show, hide, cap) => ({
  onMouseEnter: (e) => show(cap, e.currentTarget),
  onMouseLeave: () => hide(),
  onFocus: (e) => show(cap, e.currentTarget),
  onBlur: () => hide()
});
function CapTip({ tip, t }) {
  if (!tip) return null;
  const lines = capTipLines(tip.cap, t);
  const vw = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024;
  const at = capTipPlacement(tip, { width: vw });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: "micro-captip" + (at.below ? " micro-captip--below" : ""),
      style: { left: at.x, top: at.y },
      role: "tooltip",
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-captip-name", children: lines.name }),
        lines.func ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-captip-func", children: lines.func }) : null,
        lines.desc ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-captip-desc", children: lines.desc }) : null
      ]
    }
  );
}
const haystackOf = (c, tt) => {
  const key = c.labelKey;
  let local = "";
  try {
    local = String(tt(key) || "");
  } catch (e) {
    local = "";
  }
  if (local === key) local = "";
  return [c.id, c.action, c.label, local, c.desc].map((v) => String(v || "")).join(" ").toLowerCase();
};
function MicroKeycapModal({ target, current, fallback, t, onCancel, onClear, onSave }) {
  const initial = current || fallback || null;
  const [pick, setPick] = React.useState(initial);
  const [q2, setQ] = React.useState("");
  const tt = typeof t === "function" ? t : (k) => k;
  const { tip, show, hide } = useCapTip();
  const s = q2.trim().toLowerCase();
  const list = KEYCAPS.filter((c) => !s || haystackOf(c, tt).includes(s));
  const picked = keycapOf(pick);
  const dirty = pick !== initial;
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-overlay", onMouseDown: onCancel, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal", onMouseDown: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-head", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-title", children: "编辑按键" }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-sub", children: [
            "给 ",
            target,
            " 选一颗键帽 —— 这颗键按下后就执行它对应的动作"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-modal-x", onClick: onCancel, children: "×" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          className: "micro-modal-search",
          placeholder: "搜索…",
          value: q2,
          onChange: (e) => setQ(e.target.value)
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-grid micro-capgrid", onMouseLeave: hide, children: [
        list.map((c) => (
          /* 一格 = 一颗键（只有图标）。名字不再写在键下面，改由悬停气泡说 —— 见文件头。
             鼠标事件挂在**外层格子**上：点在名字原来那个位置也算选中这颗键（老手感不变）。 */
          /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: "micro-cap-cell" + (pick === c.id ? " micro-cap-cell--sel" : ""),
              onClick: () => setPick(c.id),
              ...capTipHandlers(show, hide, c),
              children: /* @__PURE__ */ jsxRuntime.jsx(
                Key,
                {
                  className: "micro-cap" + (pick === c.id ? " micro-cap--sel" : ""),
                  "data-micro-cap": c.id,
                  children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId: c.id })
                }
              )
            },
            c.id
          )
        )),
        !list.length && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-sub-empty", children: "无匹配结果" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-hint", children: picked ? `${picked.label} —— ${picked.desc}` : `当前是${CUSTOM_LABEL}：这颗键没有指派功能，按下不执行任何操作` }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-foot", children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            className: "micro-ghost",
            onClick: onClear,
            disabled: !current,
            title: "清掉这颗键的自定义键帽，回到出厂设置",
            children: "恢复默认"
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-modal-spacer" }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: onCancel, children: "取消" }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            className: "micro-primary",
            disabled: !dirty,
            onClick: () => {
              if (dirty) onSave(pick);
            },
            children: "保存"
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(CapTip, { tip, t: tt })
  ] });
}
const JOY_DIRS$1 = ["up", "right", "down", "left"];
const JOY_NONE = "none";
const JOY_RESULT = { OK: "ok", UNBOUND: "unbound", UNWIRED: "unwired", FAILED: "failed" };
const JOY_LEGACY = { "返回": JOY_ACTION.BACK, "前进": JOY_ACTION.FORWARD };
const normalizeJoyAction = (name) => {
  if (typeof name !== "string") return name;
  const trimmed = name.trim();
  return JOY_LEGACY[trimmed] || trimmed;
};
const resolveJoyMapping = (saved) => {
  const src = saved && typeof saved === "object" ? saved : {};
  const out = {};
  for (const dir of JOY_DIRS$1) {
    const raw = src[dir];
    if (typeof raw !== "string") {
      out[dir] = JOY_DEFAULTS[dir];
      continue;
    }
    const name = raw.trim();
    out[dir] = name === "" || name === JOY_NONE ? null : normalizeJoyAction(name);
  }
  return out;
};
class JoystickController {
  /**
   * @param options.ops - DshOps（DSH 功能门面，撤销/重做、侧边栏、规划模式、滚动都在它上面）。
   * @param options.voice - VoiceController（「语音」类动作直接开/关语音输入）。
   * @param options.onGesture - 每次推杆的「方向 + 动作名 + 结果」回调（会话界面那张提示卡片要它，
   *                            见 ./joystick-hud.js）。**纯通知**：回调里抛错不影响动作是否执行。
   * @param options.log - 记一行日志。
   */
  constructor(options = {}) {
    __privateAdd(this, _mapping, { ...JOY_DEFAULTS });
    __privateAdd(this, _ops, null);
    __privateAdd(this, _voice, null);
    __privateAdd(this, _log3, null);
    __privateAdd(this, _onGesture, null);
    /** 设置页写入的映射（可残缺、可为空对象）。 */
    __publicField(this, "setMapping", (saved) => {
      __privateSet(this, _mapping, resolveJoyMapping(saved));
      return this.getMapping();
    });
    /** 当前生效的映射（未绑定为 null）。 */
    __publicField(this, "getMapping", () => ({ ...__privateGet(this, _mapping) }));
    /** 某方向绑定的动作名；未绑定 / 未知方向 = null。 */
    __publicField(this, "actionOf", (dir) => dir && typeof __privateGet(this, _mapping)[dir] === "string" ? __privateGet(this, _mapping)[dir] : null);
    /**
     * 换掉手势回调（entry.js 在装配 HUD 之后接上；传 null 摘掉）。
     * 用 setter 而不是构造参数，是因为装配顺序是「控制器先建、UI 段后到」。
     */
    __publicField(this, "setOnGesture", (fn) => {
      __privateSet(this, _onGesture, typeof fn === "function" ? fn : null);
    });
    /** 由 hid-bridge 在方向事件时调用：查设置映射 → 执行 → 报出结果（给提示卡片）。 */
    __publicField(this, "handle", (dir) => {
      const name = this.actionOf(dir);
      if (!name) {
        __privateGet(this, _log3).call(this, `摇杆方向「${dir}」未绑定动作，忽略`);
        __privateGet(this, _gesture).call(this, { dir, action: null, status: JOY_RESULT.UNBOUND });
        return false;
      }
      const r = __privateGet(this, _execute).call(this, name);
      __privateGet(this, _gesture).call(this, { dir, action: name, status: r.status });
      return r.ok;
    });
    /** 动作名 → 执行（设置页里选了什么就执行什么）。对外仍然只回「成没成」。 */
    __publicField(this, "run", (name) => __privateGet(this, _execute).call(this, name).ok);
    /**
     * 动作名 → **执行 + 结果**（结果只给提示卡片用，见 ./joystick-hud.js 的四种状态）。
     * 为什么要带出处：卡片第三行要如实写「未绑定 / 未接线 / 未生效」——
     * 光看 handle() 那个布尔，这三种「没成」长得一模一样，用户就分不清是没配还是坏了。
     */
    __privateAdd(this, _execute, (name) => {
      const action = normalizeJoyAction(name);
      if (!action || action === JOY_NONE) return { ok: false, status: JOY_RESULT.UNBOUND };
      try {
        if (action === JOY_ACTION.BACK) return __privateGet(this, _result).call(this, this.back());
        if (action === JOY_ACTION.FORWARD) return __privateGet(this, _result).call(this, this.forward());
        if (action === JOY_ACTION.SIDEBAR) return __privateGet(this, _result).call(this, this.toggleSidebar());
        if (action === JOY_ACTION.PLAN) return __privateGet(this, _result).call(this, this.togglePlanMode());
        if (action === JOY_ACTION.SCROLL_BOTTOM) return __privateGet(this, _result).call(this, this.scrollToBottom());
        if (action.indexOf("语音") !== -1) return __privateGet(this, _result).call(this, this.toggleVoice());
        __privateGet(this, _log3).call(this, `摇杆动作「${action}」未接线（设置页技能类动作尚未实现），忽略`);
        return { ok: false, status: JOY_RESULT.UNWIRED };
      } catch (e) {
        __privateGet(this, _log3).call(this, `摇杆动作「${action}」执行异常：${e && e.message || e}`);
        return { ok: false, status: JOY_RESULT.FAILED };
      }
    });
    /** 门面方法一律回布尔：true = 干了，false = 接线了但没生效（拿不到服务 / 没东西可撤销…）。 */
    __privateAdd(this, _result, (ok) => ({ ok: !!ok, status: ok ? JOY_RESULT.OK : JOY_RESULT.FAILED }));
    /**
     * 报一次手势。**回调是纯通知**：它自己抛错绝不改变「动作执行了没有」这个事实
     * （卡片画不出来是小事，把好好的 undo 吃掉是大事）。
     */
    __privateAdd(this, _gesture, (info) => {
      if (!__privateGet(this, _onGesture)) return;
      try {
        __privateGet(this, _onGesture).call(this, info);
      } catch (e) {
        __privateGet(this, _log3).call(this, `提示卡片回调异常：${e && e.message || e}`);
      }
    });
    // ---------------- 已接线动作（一律转给 DshOps；拿不到门面就当没接线） ----------------
    /** 撤销当前会话输入机最近一次编辑操作。 */
    __publicField(this, "back", () => __privateGet(this, _ops) ? __privateGet(this, _ops).undo() : false);
    /** 重做最近一次被撤销的编辑操作。 */
    __publicField(this, "forward", () => __privateGet(this, _ops) ? __privateGet(this, _ops).redo() : false);
    /** 切换侧边栏。 */
    __publicField(this, "toggleSidebar", () => __privateGet(this, _ops) ? __privateGet(this, _ops).toggleSidebar() : false);
    /** 切换规划模式。 */
    __publicField(this, "togglePlanMode", () => __privateGet(this, _ops) ? __privateGet(this, _ops).togglePlan() : false);
    /** 滚到当前对话底部。 */
    __publicField(this, "scrollToBottom", () => __privateGet(this, _ops) ? __privateGet(this, _ops).scrollToBottom() : false);
    /** 语音输入开关（设置页里的「语音转写」等语音类动作）。 */
    __publicField(this, "toggleVoice", () => {
      if (__privateGet(this, _voice) && typeof __privateGet(this, _voice).toggle === "function") {
        __privateGet(this, _voice).toggle();
        return true;
      }
      return false;
    });
    const o = options || {};
    __privateSet(this, _ops, o.ops || null);
    __privateSet(this, _voice, o.voice || null);
    __privateSet(this, _log3, typeof o.log === "function" ? o.log : (msg) => {
      try {
      } catch (e) {
      }
    });
    if (typeof o.onGesture === "function") __privateSet(this, _onGesture, o.onGesture);
  }
}
_mapping = new WeakMap();
_ops = new WeakMap();
_voice = new WeakMap();
_log3 = new WeakMap();
_onGesture = new WeakMap();
_execute = new WeakMap();
_result = new WeakMap();
_gesture = new WeakMap();
const JOY_DIR_LABEL = { up: "上", right: "右", down: "下", left: "左" };
const JOY_DIR_ARROW = { up: "↑", right: "→", down: "↓", left: "←" };
const JOY_DIRS = JOY_DIRS$1.map((dir) => ({ dir, label: JOY_DIR_LABEL[dir], arrow: JOY_DIR_ARROW[dir] }));
const JOY_ACTIONS = [
  { cat: "系统操作", name: JOY_ACTION.BACK, des: "在应用里撤销（undo）上一次编辑" },
  { cat: "系统操作", name: JOY_ACTION.FORWARD, des: "在应用里重做（redo）被撤销的那次编辑" },
  { cat: "系统操作", name: JOY_ACTION.SIDEBAR, des: "打开或收起侧边栏" },
  { cat: "系统操作", name: JOY_ACTION.PLAN, des: "规划模式 开 / 关" },
  { cat: "系统操作", name: JOY_ACTION.SCROLL_BOTTOM, des: "滚到当前对话底部" },
  { cat: "系统操作", name: JOY_NONE, des: "不执行任何操作" },
  { cat: "技能（未接线）", name: "Documents", des: "处理 Word 与文档文件", soon: true },
  { cat: "技能（未接线）", name: "Excel Live Control", des: "实时控制打开的 Excel 表格", soon: true },
  { cat: "技能（未接线）", name: "Image Gen", des: "为站点/游戏等生成或编辑图片", soon: true },
  { cat: "技能（未接线）", name: "网页搜索", des: "搜索并获取网络信息", soon: true },
  { cat: "技能（未接线）", name: "语音转写", des: "语音内容的实时转写（当前等价于开关语音输入）", soon: true }
];
const joyLabel = (name) => !name || name === JOY_NONE ? "不绑定" : name;
function MicroJoystickModal({ value, onClose, onSave }) {
  var _a;
  const [local, setLocal] = React.useState(value && Object.keys(value).length ? { ...value } : { ...JOY_DEFAULTS });
  const [editDir, setEditDir] = React.useState(null);
  const setDir = (dir, name) => setLocal({ ...local, [dir]: name });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-overlay", onMouseDown: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal micro-modal--joy", onMouseDown: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-head", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-title", children: "模拟摇杆" }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-sub", children: "选择每个方向触发的操作" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-modal-x", onClick: onClose, children: "×" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-joy-body", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-joy-pad", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-joy-knob" }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-joy-list", children: JOY_DIRS.map(({ dir, label, arrow }) => /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: "micro-joy-row" + (editDir === dir ? " micro-joy-row--sel" : ""),
            onClick: () => setEditDir(dir),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-joy-arrow", children: arrow }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-joy-dir", children: label }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-joy-val", children: joyLabel(local[dir] ?? JOY_DEFAULTS[dir]) })
            ]
          },
          dir
        )) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-joy-foot", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-primary micro-joy-done", onClick: () => onSave(local), children: "完成" }) })
    ] }) }),
    editDir && /* @__PURE__ */ jsxRuntime.jsx(
      JoyPicker,
      {
        title: (_a = JOY_DIRS.find((d) => d.dir === editDir)) == null ? void 0 : _a.label,
        current: joyLabel(local[editDir] ?? JOY_DEFAULTS[editDir]),
        onClear: () => {
          setDir(editDir, JOY_NONE);
          setEditDir(null);
        },
        onClose: () => {
          setEditDir(null);
        },
        onPick: (name) => {
          setDir(editDir, name);
          setEditDir(null);
        }
      }
    )
  ] });
}
function JoyPicker({ title, current, onClear, onClose, onPick }) {
  const [q2, setQ] = React.useState("");
  const s = q2.trim().toLowerCase();
  const items = JOY_ACTIONS.filter((a) => !s || a.name.toLowerCase().includes(s) || a.des.toLowerCase().includes(s) || joyLabel(a.name).includes(s));
  const cats = [...new Set(items.map((a) => a.cat))];
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-overlay micro-overlay--sub", onMouseDown: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal micro-modal--sub", onMouseDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-head", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-sub-title", children: [
        "指定",
        title
      ] }),
      current && /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "micro-sub-clear", onClick: onClear, children: [
        current,
        " ",
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "×" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("input", { className: "micro-modal-search", placeholder: "搜索操作和技能", value: q2, onChange: (e) => setQ(e.target.value) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-sub-body", children: [
      cats.map((cat) => /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-sub-cat", children: cat }),
        items.filter((a) => a.cat === cat).map((a, i) => /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: "micro-sub-pick" + (a.soon ? " micro-sub-pick--soon" : ""),
            onClick: a.soon ? void 0 : () => onPick(a.name),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-sub-name", children: joyLabel(a.name) }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-sub-des", children: a.des })
            ]
          },
          cat + i
        ))
      ] }, cat)),
      !items.length && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-sub-empty", children: "无匹配结果" })
    ] })
  ] }) });
}
const JOY_SHIFT = 9;
const JOY_OFFSET = {
  up: [0, -JOY_SHIFT],
  down: [0, JOY_SHIFT],
  left: [-JOY_SHIFT, 0],
  right: [JOY_SHIFT, 0]
};
function useHidSignals(splitRef) {
  const [pressed, setPressed] = React.useState({});
  const [joy, setJoy] = React.useState(null);
  const [knob, setKnob] = React.useState({ active: false, dir: null });
  const trackerRef = React.useRef(null);
  if (trackerRef.current === null) trackerRef.current = createPressTracker();
  const tracker = trackerRef.current;
  const knobRef = React.useRef(null);
  if (knobRef.current === null) knobRef.current = createKnobTracker();
  const knobTracker = knobRef.current;
  const shownRef = React.useRef({});
  const knobShownRef = React.useRef({ active: false, dir: null });
  const commit = () => {
    const next = tracker.snapshot();
    if (!samePressed(next, shownRef.current)) {
      shownRef.current = next;
      setPressed(next);
    }
    const k = knobTracker.snapshot();
    if (k.active !== knobShownRef.current.active || k.dir !== knobShownRef.current.dir) {
      knobShownRef.current = k;
      setKnob(k);
    }
  };
  const tap = (visualId) => {
    tracker.tap(visualId);
    commit();
  };
  React.useEffect(() => {
    const hid = DSVI.services && DSVI.services.hid;
    if (!hid || typeof hid.subscribe !== "function") return void 0;
    let lastJoy;
    const off = hid.subscribe((s) => {
      tracker.fold(s, splitRef && splitRef.current);
      knobTracker.fold(s);
      commit();
      const j = s && typeof s.joy === "string" && s.joy ? s.joy : null;
      if (j !== lastJoy) {
        lastJoy = j;
        setJoy(j);
      }
    });
    const timer = setInterval(commit, Math.max(60, Math.round(FLASH_MS / 2)));
    return () => {
      off();
      clearInterval(timer);
      tracker.reset();
      knobTracker.reset();
      shownRef.current = {};
      knobShownRef.current = { active: false, dir: null };
    };
  }, []);
  return { pressed, joy, knob, tap };
}
const ACT_ROW_CODES = ["ACT06", "ACT07", "ACT08", "ACT09"];
function MicroLayout({ update, prefs = {}, clearField, preview = null, t }) {
  const actLabels = prefs.actLabels || {};
  const [editor, setEditor] = React.useState(null);
  const [joyOpen, setJoyOpen] = React.useState(false);
  const staticShot = !!preview;
  const tt = typeof t === "function" ? t : null;
  const { tip, show, hide } = useCapTip();
  const tipProps = (capId) => staticShot ? {} : capTipHandlers(show, hide, keycapOf(capId));
  const micSplit = !!prefs.micKey;
  const micKeys = micRowKeys(prefs);
  const splitRef = React.useRef(micSplit);
  React.useEffect(() => {
    splitRef.current = micSplit;
  }, [micSplit]);
  const { pressed, joy, knob, tap } = useHidSignals(splitRef);
  const shownJoy = staticShot ? null : joy;
  const shownPressed = staticShot ? {} : pressed;
  const shownKnob = staticShot ? { active: false, dir: null } : knob;
  const knobDeg = KNOB_DOT_DEG[shownKnob.dir] ?? KNOB_DOT_REST_DEG;
  const openKeycap = (target) => () => {
    if (staticShot) return;
    hide();
    setEditor({ target });
  };
  const saveCap = (target, pick) => update("actLabels", { ...actLabels, [target]: pick });
  const clearCap = (target) => {
    const next = { ...actLabels };
    delete next[target];
    if (!Object.keys(next).length && typeof clearField === "function") return clearField("actLabels");
    return update("actLabels", next);
  };
  const dot = () => /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-key-dot" });
  const slot = (visualId, onClick, extra = "") => ({
    "data-micro-key": visualId,
    className: [extra, shownPressed[visualId] ? "micro-key--pressed" : ""].filter(Boolean).join(" "),
    onClick: staticShot ? void 0 : onClick || (() => tap(visualId))
  });
  const [jx, jy] = JOY_OFFSET[shownJoy] || [0, 0];
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-page-wrap" + (staticShot ? " micro-page-wrap--preview" : ""), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-keyboard-wrap", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-grid-4col", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-control-item", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-control-base" + (shownKnob.active ? " micro-knob--active" : ""), children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-circle-knob-inner", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-knob-ring" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: "micro-knob-dot",
              "data-micro-knob-dot": shownKnob.dir || "off",
              style: { transform: `translate(-50%, -50%) rotate(${knobDeg}deg) translateY(${-27}px)` }
            }
          )
        ] }) }) }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r1-2"), children: dot() }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r1-3"), children: dot() }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: "micro-control-item micro-joy-ctrl",
            "data-micro-key": "joy",
            onClick: staticShot ? void 0 : () => setJoyOpen(true),
            children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-control-base", children: /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                className: "micro-joystick-dot",
                "data-joy": shownJoy || "center",
                style: {
                  transform: `translate(${jx}px, ${jy}px)`,
                  transition: shownJoy ? "transform .1s ease-out" : "transform .28s cubic-bezier(.34,1.56,.64,1)"
                }
              }
            ) })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-1"), children: dot() }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-2"), children: dot() }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-3"), children: dot() }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-4"), children: dot() }),
        ACT_ROW_CODES.map((code) => {
          const capId = capFor(code, prefs);
          const visualId = code.toLowerCase();
          return /* @__PURE__ */ jsxRuntime.jsx(
            Key,
            {
              ...slot(visualId, openKeycap(code), "micro-key--act" + (capId ? "" : " micro-key--custom")),
              "data-micro-cap": capId || CUSTOM_ICON,
              ...tipProps(capId),
              children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId })
            },
            code
          );
        })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-bottom-row", "data-micro-mic": micSplit ? "split" : "merged", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-knob-panel", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-knob-lights", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-knob-light micro-blue" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-knob-light micro-green" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-knob-light micro-amber" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-circle-knob" })
        ] }),
        micKeys.map((k) => /* @__PURE__ */ jsxRuntime.jsx(
          Key,
          {
            ...slot(
              k.visualId,
              openKeycap(k.code),
              (k.wide ? "micro-key-mic " : "") + "micro-key--act" + (k.custom ? " micro-key--custom" : "")
            ),
            "data-micro-cap": k.capId || CUSTOM_ICON,
            ...tipProps(k.capId),
            children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId: k.capId })
          },
          k.visualId
        )),
        (() => {
          const capId = capFor("ACT12", prefs);
          return /* @__PURE__ */ jsxRuntime.jsx(
            Key,
            {
              ...slot("act12", openKeycap("ACT12"), "micro-key--act" + (capId ? "" : " micro-key--custom")),
              "data-micro-cap": capId || CUSTOM_ICON,
              ...tipProps(capId),
              children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId })
            }
          );
        })()
      ] })
    ] }),
    !staticShot && editor && /* @__PURE__ */ jsxRuntime.jsx(
      MicroKeycapModal,
      {
        target: editor.target,
        current: actLabels[editor.target] || null,
        fallback: capFor(editor.target, prefs),
        t: tt,
        onCancel: () => setEditor(null),
        onClear: () => {
          clearCap(editor.target);
          setEditor(null);
        },
        onSave: (pick) => {
          saveCap(editor.target, pick);
          setEditor(null);
        }
      }
    ),
    !staticShot && joyOpen && /* @__PURE__ */ jsxRuntime.jsx(
      MicroJoystickModal,
      {
        value: prefs.joystick,
        onClose: () => setJoyOpen(false),
        onSave: (cfg) => {
          update("joystick", cfg);
          setJoyOpen(false);
        }
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(CapTip, { tip, t: tt || void 0 })
  ] });
}
const RESET_GROUPS = [
  {
    title: "键盘布局",
    items: [
      "键帽：动作键回到 模式 / 归档 / 拒绝 / 批准 / 语音 / 发送；拆分态的右开关回到「自定义」（未指派）",
      "模拟摇杆：左 = 撤销 · 右 = 重做 · 上 = 切换规划模式 · 下 = 切换侧边栏",
      "独立麦克风键：关闭（两颗开关并回一颗宽键）"
    ]
  },
  {
    title: "按键选项",
    items: [
      "智能体键：最近使用（自定义分配清空）",
      "旋钮模式：输入区导航（自定义分配清空）",
      "轻点聚焦：关闭",
      "首次连接引导：下次连上设备时重新弹一遍"
    ]
  }
];
function MicroResetModal({ onCancel, onConfirm }) {
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-overlay", onMouseDown: onCancel, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal", onMouseDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-head", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-title", children: "重置布局" }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-sub", children: "把下面这些改回出厂设置，并保存" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-modal-x", onClick: onCancel, children: "×" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-reset-body", children: RESET_GROUPS.map((g) => /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-sub-cat", children: g.title }),
      /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "micro-reset-list", children: g.items.map((it) => /* @__PURE__ */ jsxRuntime.jsx("li", { children: it }, it)) })
    ] }, g.title)) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-foot", children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: onCancel, children: "取消" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-primary", onClick: onConfirm, children: "重置" })
    ] })
  ] }) });
}
const ITEM_KEYS = [
  "remove.item1",
  "remove.item2",
  "remove.item3",
  "remove.item4",
  "remove.item5"
];
function MicroRemoveModal({ tt, onCancel, onConfirm }) {
  const t = typeof tt === "function" ? tt : (k) => k;
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-overlay", onMouseDown: onCancel, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal", onMouseDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-head", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-title", children: t("remove.title") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-sub", children: t("remove.sub") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-modal-x", "aria-label": t("remove.cancel"), onClick: onCancel, children: "×" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-reset-body", children: [
      /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "micro-reset-list", children: ITEM_KEYS.map((k) => /* @__PURE__ */ jsxRuntime.jsx("li", { children: t(k) }, k)) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-hint", children: t("remove.hint") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-foot", children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: onCancel, children: t("remove.cancel") }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-primary micro-primary--danger", onClick: onConfirm, children: t("remove.confirm") })
    ] })
  ] }) });
}
const SAVE_TOAST_TEXT = { saving: "settings.saving", saved: "settings.saved", error: "settings.saveError" };
function MicroSaveToast({ status, t }) {
  if (!status) return null;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-toast micro-toast--" + status, role: "status", "aria-live": "polite", children: [
    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-toast__ico", "aria-hidden": "true", children: status === "saving" ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-toast__spin" }) : /* @__PURE__ */ jsxRuntime.jsxs(
      "svg",
      {
        viewBox: "0 0 16 16",
        width: "14",
        height: "14",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "8", cy: "8", r: "6.6" }),
          status === "saved" ? /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M5 8.3l2.1 2.1L11 6.4" }) : /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M8 4.9v3.7M8 11.2h.01" })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-toast__text", children: t(SAVE_TOAST_TEXT[status] || "settings.saveError") })
  ] });
}
const GUIDE_STEPS = ["welcome", "agents", "commands"];
const stepIndex = (step) => {
  const i = GUIDE_STEPS.indexOf(step);
  return i < 0 ? 0 : i;
};
const stepAt = (i) => {
  const n = Number.isFinite(i) ? Math.round(i) : 0;
  return GUIDE_STEPS[Math.max(0, Math.min(GUIDE_STEPS.length - 1, n))];
};
const isLastStep = (step) => stepIndex(step) === GUIDE_STEPS.length - 1;
const isFirstStep = (step) => stepIndex(step) === 0;
const nextStep = (step) => stepAt(stepIndex(step) + 1);
const prevStep = (step) => stepAt(stepIndex(step) - 1);
const shouldShowGuide = ({ open, seen } = {}) => seen !== true && open === true;
const rgbHex = (n) => {
  const v = Number.isFinite(n) ? Math.max(0, Math.min(16777215, Math.round(n))) : 0;
  return "#" + v.toString(16).padStart(6, "0");
};
const GUIDE_LEGEND = [
  { key: AGENT_STATUS.RUNNING, color: AGENT_COLOR_RGB.working, labelKey: "guide.legend.running" },
  { key: AGENT_STATUS.IDLE, color: AGENT_COLOR_RGB.idle, labelKey: "guide.legend.idle" },
  { key: AGENT_STATUS.ERROR, color: AGENT_COLOR_RGB.error, labelKey: "guide.legend.error" },
  { key: AGENT_STATUS.EMPTY, color: AGENT_COLOR_RGB.off, labelKey: "guide.legend.empty" }
];
const TITLE = { welcome: "guide.welcome.title", agents: "guide.agents.title", commands: "guide.commands.title" };
const DESC = { welcome: "guide.welcome.desc", agents: "guide.agents.desc", commands: "guide.commands.desc" };
const LEGEND_HINT = {
  "guide.legend.running": "guide.legend.runningHint",
  "guide.legend.idle": "guide.legend.idleHint",
  "guide.legend.error": "guide.legend.errorHint",
  "guide.legend.empty": "guide.legend.emptyHint"
};
const snapshot = (g) => ({ open: !!(g && g.open), step: g && g.step || "welcome" });
function MicroGuideHost({ t, onOpenSettings }) {
  const guide = DSVI.services ? DSVI.services.guide : null;
  const [snap, setSnap] = React.useState(() => snapshot(guide));
  React.useEffect(() => {
    if (!guide || typeof guide.subscribe !== "function") return void 0;
    setSnap(snapshot(guide));
    return guide.subscribe(() => setSnap(snapshot(guide)));
  }, [guide]);
  if (!guide || !snap.open) return null;
  return /* @__PURE__ */ jsxRuntime.jsx(MicroGuide, { t, guide, step: snap.step, onOpenSettings });
}
function MicroGuide({ t, guide, step, onOpenSettings }) {
  const dict = DSVI.locales && DSVI.locales.zh || {};
  const tt = typeof t === "function" ? t : (k) => dict[k] || k;
  const [monitor, setMonitor] = React.useState(null);
  React.useEffect(() => {
    if (typeof fetch !== "function") return void 0;
    let alive = true;
    fetch(MONITOR_URL, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((m) => {
      if (alive && m && typeof m === "object") setMonitor(m);
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, []);
  const md = monitorDot(monitor);
  const last = isLastStep(step);
  const close = () => guide.dismiss();
  const goSettings = () => {
    close();
    if (typeof onOpenSettings === "function") onOpenSettings();
  };
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-modal-overlay micro-guide-overlay", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal micro-guide", "data-micro-guide": step, role: "dialog", "aria-modal": "true", children: [
    /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-modal-x micro-guide-x", onClick: close, "aria-label": tt("guide.close"), children: "×" }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-guide-shot", children: /* @__PURE__ */ jsxRuntime.jsx(MicroLayout, { update: noop, prefs: guide.prefs || {}, preview: true }) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-guide-body", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-guide-title", children: tt(TITLE[step] || TITLE.welcome) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-guide-desc", children: tt(DESC[step] || DESC.welcome) }),
      step === "welcome" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-guide-status", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-dot micro-dot--ok" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: tt("guide.connected") }),
        monitorVisible(monitor) && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-guide-sep", children: "·" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-dot " + md.cls }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: md.statusCls, children: [
            tt("guide.monitor"),
            " ",
            tt(md.labelKey)
          ] })
        ] })
      ] }),
      step === "agents" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-guide-legend", children: GUIDE_LEGEND.map((row) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-guide-legend-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-guide-swatch", style: { background: rgbHex(row.color) } }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-guide-legend-name", children: tt(row.labelKey) }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-guide-legend-hint", children: tt(LEGEND_HINT[row.labelKey] || "") })
      ] }, row.key)) }),
      step === "commands" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-guide-note", children: tt("guide.commands.note") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-modal-foot micro-guide-foot", children: [
      !isFirstStep(step) && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: () => guide.back(), children: tt("guide.back") }),
      step === "welcome" && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: close, children: tt("guide.skip") }),
      last && typeof onOpenSettings === "function" && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: goSettings, children: tt("guide.settings") }),
      last ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-primary", onClick: close, children: tt("guide.finish") }) : /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-primary", onClick: () => guide.next(), children: tt(step === "welcome" ? "guide.start" : "guide.last") })
    ] })
  ] }) });
}
const noop = () => {
};
const FOOT_ACTION_SLOT = DSVI.SLOT_FOOT_ACTION;
const FOOT_ACTION_ID = "micro-keyboard";
const SETTINGS_OUTLET_SEL = '[data-slot="sidebar.settings"]';
const SETTINGS_TRIGGER_SEL = 'button[aria-haspopup="dialog"]';
const NAV_SCOPE_SEL = 'nav, [role="dialog"]';
const BUTTON_SIZE = 36;
const ICON_SIZE = 20;
const GEAR_INSET = 10;
const GEAR_GAP = 8;
const MIN_GEAR_WIDTH = 96;
const CONN_NOTICE_SEL = 'button[data-phase],[role="status"]';
const NOTICE_HIDE_ATTR = "data-micro-conn-hide";
const TIP_GAP = 6;
const TIP_TAIL = 12;
const GEAR_ROW_ATTR = "data-micro-gear-row";
const GEAR_TIP_ATTR = "data-micro-gear-tip";
const NAV_WAIT_MS = 1200;
const POLL_MS = 16;
const warn$1 = (msg) => {
};
const winOf = () => typeof window !== "undefined" ? window : null;
const q = (root, sel) => {
  if (!root || typeof root.querySelector !== "function") return null;
  try {
    return root.querySelector(sel);
  } catch (e) {
    return null;
  }
};
const qa = (root, sel) => {
  if (!root || typeof root.querySelectorAll !== "function") return null;
  try {
    return Array.from(root.querySelectorAll(sel));
  } catch (e) {
    return [];
  }
};
const matches = (el, sel) => {
  if (!el || typeof el.matches !== "function") return false;
  try {
    return el.matches(sel);
  } catch (e) {
    return false;
  }
};
const textOf = (el) => {
  try {
    return String(el && el.textContent || "");
  } catch (e) {
    return "";
  }
};
const styleOf = (el) => {
  try {
    const w = winOf();
    if (w && typeof w.getComputedStyle === "function") return w.getComputedStyle(el);
    if (typeof getComputedStyle === "function") return getComputedStyle(el);
  } catch (e) {
  }
  return null;
};
const triggerEl = (root) => {
  const outlet = q(root, SETTINGS_OUTLET_SEL);
  if (outlet) return q(outlet, SETTINGS_TRIGGER_SEL);
  return q(root, SETTINGS_TRIGGER_SEL);
};
const isExpanded = (trigger) => {
  try {
    return trigger && trigger.getAttribute("aria-expanded") === "true";
  } catch (e) {
    return false;
  }
};
const candidateLabels = (extra) => {
  const out = [];
  const push = (v) => {
    if (typeof v !== "string") return;
    const s = v.trim();
    if (s && out.indexOf(s) === -1) out.push(s);
  };
  push(extra);
  const dicts = DSVI && DSVI.locales || {};
  for (const key of Object.keys(dicts)) push(dicts[key] && dicts[key].nav);
  return out;
};
const navScopes = (root) => {
  if (!root) return [];
  const out = [];
  if (matches(root, NAV_SCOPE_SEL)) out.push(root);
  for (const el of qa(root, NAV_SCOPE_SEL) || []) out.push(el);
  return out;
};
const findSectionRow = (labels, scopes) => {
  const wants = (labels || []).filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
  if (!wants.length) return null;
  const containers = [];
  for (const root of scopes || []) {
    for (const c of navScopes(root)) if (containers.indexOf(c) === -1) containers.push(c);
  }
  if (!containers.length) return null;
  const rowsIn = (c) => qa(c, 'button, [role="button"], a') || [];
  for (const want of wants) {
    for (const c of containers) {
      const hit = rowsIn(c).find((b) => textOf(b).trim() === want);
      if (hit) return hit;
    }
  }
  for (const want of wants) {
    for (const c of containers) {
      const hit = rowsIn(c).find((b) => textOf(b).includes(want));
      if (hit) return hit;
    }
  }
  return null;
};
const isActiveRow = (row) => {
  try {
    return row.getAttribute("aria-current") === "true";
  } catch (e) {
    return false;
  }
};
const sleep$1 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clickEl = (el, what) => {
  try {
    el.click();
    return true;
  } catch (e) {
    warn$1(`点击${what}失败：` + (e && e.message || e));
    return false;
  }
};
const GENERAL_SECTION_LABELS = ["通用", "General"];
const openSection = async (labels, waitMs, what) => {
  if (typeof document === "undefined") return false;
  const outlet = q(document, SETTINGS_OUTLET_SEL);
  const scopes = [outlet, document].filter(Boolean);
  const found = findSectionRow(labels, scopes);
  if (found) {
    if (isActiveRow(found)) return true;
    return clickEl(found, "分区导航行");
  }
  const trigger = triggerEl(document);
  if (!trigger) {
    return false;
  }
  if (!isExpanded(trigger) && !clickEl(trigger, "设置按钮")) return false;
  const deadline = Date.now() + waitMs;
  for (; ; ) {
    const row = findSectionRow(labels, scopes);
    if (row) {
      if (isActiveRow(row)) return true;
      return clickEl(row, "分区导航行");
    }
    if (Date.now() >= deadline) break;
    await sleep$1(POLL_MS);
  }
  warn$1(`设置弹窗里没找到分区行（要打开：${what}；候选标题：${labels.join(" / ") || "无"}）`);
  return false;
};
const waitOf = (opts) => {
  const ms = opts && opts.waitMs;
  return Number.isFinite(ms) ? ms : NAV_WAIT_MS;
};
const openKeyboardSettings = (label, opts = {}) => openSection(candidateLabels(label), waitOf(opts), "键盘设置页");
const openGeneralSettings = (opts = {}) => openSection(GENERAL_SECTION_LABELS, waitOf(opts), "通用设置");
const isContents = (el) => {
  const s = styleOf(el);
  return !!s && s.display === "contents";
};
const layoutParent = (el) => {
  let p = el && el.parentElement;
  while (p) {
    if (!isContents(p)) return p;
    p = p.parentElement;
  }
  return null;
};
const findFootHosts = (button) => {
  const row = layoutParent(button);
  if (!row) return null;
  const area = row.nextElementSibling;
  if (!area) return null;
  const gear = triggerEl(area);
  if (!gear) return null;
  const foot = row.parentElement;
  if (!foot || typeof foot.contains !== "function") return null;
  if (!foot.contains(area) || !foot.contains(button)) return null;
  return { row, area, foot, gear };
};
const positionedAncestor = (el) => {
  let p = el && el.parentElement;
  while (p) {
    const s = styleOf(p);
    if (s && s.position && s.position !== "static") return p;
    p = p.parentElement;
  }
  return null;
};
const gearRowOf = (gear) => gear ? layoutParent(gear) : null;
const isOverlay = (el) => {
  const s = styleOf(el);
  return !!s && (s.position === "fixed" || s.position === "absolute");
};
const visibleSiblingOf = (row, except) => {
  let kids = null;
  try {
    kids = Array.from(row && row.children || []);
  } catch (e) {
    return null;
  }
  for (const el of kids) {
    if (el === except) continue;
    if (isContents(el)) continue;
    if (el && typeof el.contains === "function") {
      let wraps = false;
      try {
        wraps = el.contains(except);
      } catch (e) {
        wraps = false;
      }
      if (wraps) continue;
    }
    if (isOverlay(el)) continue;
    let r = null;
    try {
      r = el.getBoundingClientRect();
    } catch (e) {
      continue;
    }
    if (r && r.width > 1 && r.height > 1) return el;
  }
  return null;
};
const NOTICE_PHASE_KEY = {
  connecting: "sidebar.connecting",
  disconnected: "sidebar.disconnected",
  reconnected: "sidebar.reconnected"
};
const noticePhaseOf = (el) => {
  if (!el) return null;
  let phase = null;
  try {
    phase = el.getAttribute("data-phase");
  } catch (e) {
    phase = null;
  }
  if (phase === "connecting") return "connecting";
  if (phase !== null && phase !== void 0 && phase !== "") return "disconnected";
  return matches(el, '[role="status"]') ? "reconnected" : null;
};
const connNoticeOf = (gear) => {
  const row = gearRowOf(gear);
  return row ? q(row, CONN_NOTICE_SEL) : null;
};
const noticeCandidates = (row) => row ? qa(row, CONN_NOTICE_SEL) || [] : [];
const setNoticeHidden = (el, on) => {
  if (!el || typeof el.setAttribute !== "function") return false;
  try {
    if (on) {
      el.setAttribute(NOTICE_HIDE_ATTR, "1");
      return true;
    }
    if (typeof el.removeAttribute === "function") {
      el.removeAttribute(NOTICE_HIDE_ATTR);
      return true;
    }
  } catch (e) {
  }
  return false;
};
const computePlacement = (containerRect, gearRect, size = BUTTON_SIZE, inset = GEAR_INSET) => ({
  top: Math.round(gearRect.top - containerRect.top + (gearRect.height - size) / 2),
  right: Math.round(containerRect.right - gearRect.right + inset)
});
const num = (v, dflt) => typeof v === "number" && Number.isFinite(v) ? v : dflt;
const narrowGear = (gear, width) => {
  if (!gear || !gear.style) return;
  const v = width === null || width === void 0 ? "" : Math.round(width) + "px";
  try {
    gear.style.width = v;
  } catch (e) {
  }
  try {
    gear.style.maxWidth = v;
  } catch (e) {
  }
};
const gearTipOf = (gear) => {
  if (!gear) return null;
  let el = null;
  try {
    el = gear.nextElementSibling;
  } catch (e) {
    return null;
  }
  while (el) {
    if (matches(el, '[role="tooltip"]')) return el;
    el = el.nextElementSibling;
  }
  const outlet = gear.parentElement;
  if (!outlet || typeof outlet.querySelectorAll !== "function") return null;
  let found = null;
  try {
    found = Array.from(outlet.querySelectorAll('[role="tooltip"]') || []).find((node) => {
      try {
        return !gear.contains(node);
      } catch (e) {
        return true;
      }
    }) || null;
  } catch (e) {
    found = null;
  }
  return found;
};
const markGearTip = (gear) => {
  const row = gearRowOf(gear);
  if (!row || typeof row.setAttribute !== "function") return false;
  try {
    row.setAttribute(GEAR_ROW_ATTR, "1");
  } catch (e) {
    return false;
  }
  try {
    const rr = row.getBoundingClientRect();
    const gr = gear.getBoundingClientRect();
    const left = rr && gr ? Math.max(0, Math.round(gr.left - rr.left)) : 0;
    if (typeof row.style.setProperty === "function") row.style.setProperty("--micro-gear-tip-left", left + "px");
    else row.style["--micro-gear-tip-left"] = left + "px";
  } catch (e) {
  }
  const tip = gearTipOf(gear);
  if (tip) {
    try {
      tip.setAttribute(GEAR_TIP_ATTR, "1");
    } catch (e) {
    }
  }
  return true;
};
const unmarkGearTip = (gear) => {
  const row = gearRowOf(gear);
  if (!row) return;
  try {
    row.removeAttribute(GEAR_ROW_ATTR);
  } catch (e) {
  }
  try {
    if (typeof row.style.removeProperty === "function") row.style.removeProperty("--micro-gear-tip-left");
    else delete row.style["--micro-gear-tip-left"];
  } catch (e) {
  }
};
const setClass = (el, name, on) => {
  const cl = el && el.classList;
  if (!cl) return;
  try {
    if (on) cl.add(name);
    else cl.remove(name);
  } catch (e) {
  }
};
let narrowWarned = false;
const warnIfNotNarrowed = (gear, want) => {
  if (narrowWarned) return;
  try {
    const got = gear.getBoundingClientRect().width;
    if (got > want + 1) {
      narrowWarned = true;
      warn$1(`设置按钮收窄没生效（想要 ${Math.round(want)}px，实际 ${Math.round(got)}px）：hover 背景可能仍会盖住键盘图标 —— DSH 大概又换了该按钮的布局方式（见 sidebar/action.jsx 头部）`);
    }
  } catch (e) {
  }
};
const placeFootAction = (button, opts = {}) => {
  if (!button || !button.style) return null;
  const hosts = findFootHosts(button);
  if (!hosts) {
    unpinFootAction(button);
    return null;
  }
  const row = gearRowOf(hosts.gear);
  for (const el of noticeCandidates(row)) setNoticeHidden(el, false);
  const sibling = visibleSiblingOf(row, hosts.gear);
  const notice = sibling && noticePhaseOf(sibling) ? sibling : null;
  if (sibling && !notice) {
    unpinFootAction(button);
    return null;
  }
  if (notice) setNoticeHidden(notice, true);
  const container = positionedAncestor(button);
  if (!container || typeof container.getBoundingClientRect !== "function") {
    unpinFootAction(button);
    return null;
  }
  const size = num(opts.size, BUTTON_SIZE);
  const inset = num(opts.inset, GEAR_INSET);
  const gap = num(opts.gap, GEAR_GAP);
  narrowGear(hosts.gear, null);
  button.__microGear = hosts.gear;
  button.style.position = "absolute";
  setClass(button, "micro-foot-action--pinned", true);
  const box = container.getBoundingClientRect();
  const gearRect = hosts.gear.getBoundingClientRect();
  const pos = computePlacement(box, gearRect, size, inset);
  button.style.top = pos.top + "px";
  button.style.right = pos.right + "px";
  button.style.left = "auto";
  const keyRight = box.right - pos.right;
  const want = keyRight - size - gap - gearRect.left;
  if (want >= MIN_GEAR_WIDTH && want < gearRect.width) {
    narrowGear(hosts.gear, want);
    warnIfNotNarrowed(hosts.gear, want);
  }
  markGearTip(hosts.gear);
  return { ...pos, notice };
};
const unpinFootAction = (button) => {
  if (!button || !button.style) return;
  const hosts0 = findFootHosts(button);
  for (const el of noticeCandidates(hosts0 ? gearRowOf(hosts0.gear) : null)) setNoticeHidden(el, false);
  unmarkGearTip(button.__microGear || hosts0 && hosts0.gear);
  setClass(button, "micro-foot-action--pinned", false);
  for (const k of ["position", "top", "right", "left"]) {
    try {
      button.style[k] = "";
    } catch (e) {
    }
  }
  narrowGear(button.__microGear || (findFootHosts(button) || {}).gear, null);
};
let tipEl = null;
let tipTextEl = null;
let tipTailEl = null;
const viewportWidth = () => {
  const w = winOf();
  const n = w && Number(w.innerWidth);
  if (Number.isFinite(n) && n > 0) return n;
  try {
    const de = typeof document !== "undefined" && document.documentElement;
    const m = de && Number(de.clientWidth);
    if (Number.isFinite(m) && m > 0) return m;
  } catch (e) {
  }
  return 0;
};
const connTipNode = () => {
  if (tipEl) return tipEl;
  let doc = null;
  try {
    doc = typeof document !== "undefined" ? document : null;
  } catch (e) {
    doc = null;
  }
  if (!doc || typeof doc.createElement !== "function") return null;
  try {
    tipEl = doc.createElement("div");
    tipTextEl = doc.createElement("span");
    tipTailEl = doc.createElement("span");
  } catch (e) {
    tipEl = null;
    tipTextEl = null;
    tipTailEl = null;
    return null;
  }
  setClass(tipEl, "micro-conn-tip", true);
  setClass(tipTextEl, "micro-conn-tip__text", true);
  setClass(tipTailEl, "micro-conn-tip__tail", true);
  try {
    tipEl.setAttribute("role", "status");
  } catch (e) {
  }
  try {
    tipEl.appendChild(tipTextEl);
    tipEl.appendChild(tipTailEl);
  } catch (e) {
  }
  return tipEl;
};
const placeConnTip = (tip, button, opts = {}) => {
  if (!tip || !tip.style || !button) return null;
  const size = num(opts.size, BUTTON_SIZE);
  const gap = num(opts.gap, TIP_GAP);
  const tail = num(opts.tail, TIP_TAIL);
  const b = button.getBoundingClientRect();
  const r = tip.getBoundingClientRect();
  const h = num(r.height, num(opts.tipHeight, 30));
  const w = num(r.width, 0);
  let top = b.top - gap - h;
  const below = top < 0;
  if (below) top = b.bottom + gap;
  const vw = num(opts.viewportWidth, viewportWidth());
  let right = vw ? vw - b.right : 0;
  if (vw && w && vw - right - w < GEAR_INSET) right = vw - GEAR_INSET - w;
  tip.style.top = Math.round(top) + "px";
  tip.style.right = Math.round(Math.max(0, right)) + "px";
  tip.style.left = "auto";
  if (tipTailEl && tipTailEl.style) tipTailEl.style.right = Math.round(size / 2 - tail / 2) + "px";
  setClass(tip, "micro-conn-tip--below", below);
  return { top, right, below };
};
const syncConnTip = (button, notice, opts = {}) => {
  const tip = connTipNode();
  if (!button || !notice) {
    if (tip) setClass(tip, "micro-conn-tip--on", false);
    return false;
  }
  let body = null;
  try {
    body = typeof document !== "undefined" && (document.body || document.documentElement) || null;
  } catch (e) {
    body = null;
  }
  if (!tip || !body || typeof body.appendChild !== "function") {
    setNoticeHidden(notice, false);
    return false;
  }
  if (tip.parentElement !== body) {
    try {
      body.appendChild(tip);
    } catch (e) {
      setNoticeHidden(notice, false);
      return false;
    }
  }
  const text = String(opts.text == null ? "" : opts.text);
  if (tipTextEl) tipTextEl.textContent = text;
  try {
    tip.setAttribute("aria-label", String(opts.ariaLabel || text));
  } catch (e) {
  }
  if (typeof opts.onClick === "function") tip.onclick = opts.onClick;
  setClass(tip, "micro-conn-tip--on", true);
  placeConnTip(tip, button, opts);
  return true;
};
const disposeConnTip = () => {
  if (!tipEl) return;
  setClass(tipEl, "micro-conn-tip--on", false);
  try {
    const p = tipEl.parentElement;
    if (p && typeof p.removeChild === "function") p.removeChild(tipEl);
  } catch (e) {
  }
};
const leaveOurSection = (label, roots) => {
  if (typeof document === "undefined") return false;
  const where = Array.isArray(roots) && roots.length ? roots : [document];
  const mine = findSectionRow(candidateLabels(label), where);
  if (!mine) return false;
  for (const c of navScopes(document)) {
    for (const row of qa(c, 'button, [role="button"], a') || []) {
      if (row === mine) continue;
      if (!textOf(row).trim()) continue;
      if (row.getAttribute("aria-current") === "true") continue;
      try {
        row.click();
        return true;
      } catch (e) {
      }
    }
  }
  return false;
};
const CLOSE_LABELS = ["关闭", "Close"];
const CLOSE_MAX_UP = 3;
const CLOSE_STEP_MS = 600;
const settingsDialogOpen = (label) => {
  if (typeof document === "undefined") return false;
  const outlet = q(document, SETTINGS_OUTLET_SEL);
  const scopes = [outlet, document].filter(Boolean);
  return !!findSectionRow(candidateLabels(label), scopes);
};
const waitDialogGone = async (waitMs) => {
  const deadline = Date.now() + waitMs;
  for (; ; ) {
    if (!settingsDialogOpen()) return true;
    if (Date.now() >= deadline) return false;
    await sleep$1(POLL_MS);
  }
};
const isOurs = (el) => matches(el, '[data-micro-foot],[data-slot="sidebar.footer.action"]');
const closeButtonOf = (root) => {
  const nav = navScopes(root)[0] || null;
  if (!nav) return null;
  const stop = root && (root.body || root.documentElement) || null;
  const inNav = (el) => {
    try {
      return nav.contains(el);
    } catch (e) {
      return false;
    }
  };
  let scope = nav;
  for (let up = 0; up < CLOSE_MAX_UP; up++) {
    const next = scope.parentElement;
    if (!next) break;
    if (next === stop || !next.contains(nav)) break;
    scope = next;
    for (const btn of qa(scope, 'button, [role="button"]') || []) {
      if (inNav(btn) || isOurs(btn)) continue;
      const name = textOf(btn).trim() || String(btn.getAttribute && btn.getAttribute("aria-label") || "");
      if (!CLOSE_LABELS.some((w) => name.includes(w))) continue;
      return btn;
    }
  }
  return null;
};
const pressEscape = () => {
  if (typeof document === "undefined") return false;
  let ae = null;
  try {
    ae = document.activeElement;
  } catch (e) {
    ae = null;
  }
  const usable = !!ae && ae !== document.body && typeof ae.dispatchEvent === "function";
  const target = usable ? ae : navScopes(document)[0] || document.body || null;
  if (!target || typeof target.dispatchEvent !== "function") return false;
  try {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return true;
  } catch (e) {
    return false;
  }
};
const closeSettingsDialog = async (opts = {}) => {
  if (typeof document === "undefined") return false;
  const ms = num(opts.stepMs, CLOSE_STEP_MS);
  if (!settingsDialogOpen()) return true;
  const gear = triggerEl(document);
  if (gear && isExpanded(gear)) {
    clickEl(gear, "设置按钮");
    if (await waitDialogGone(ms)) return true;
  }
  const x = closeButtonOf(document);
  if (x) {
    clickEl(x, "设置弹窗关闭按钮");
    if (await waitDialogGone(ms)) return true;
  }
  if (pressEscape() && await waitDialogGone(ms)) return true;
  if (leaveOurSection()) {
    return false;
  }
  return false;
};
DSVI.openKeyboardSettings = openKeyboardSettings;
DSVI.openGeneralSettings = openGeneralSettings;
DSVI.leaveOurSection = leaveOurSection;
DSVI.closeSettingsDialog = closeSettingsDialog;
DSVI.settingsDialogOpen = settingsDialogOpen;
DSVI.footAction = {
  open: openKeyboardSettings,
  close: closeSettingsDialog,
  place: placeFootAction,
  unpin: unpinFootAction,
  narrow: narrowGear,
  hosts: findFootHosts,
  // 摆放计算用的「包含块」= 最近的定位祖先。暴露出来给控制台/自检排查「到底贴在谁身上」。
  // ⚠ 别拿它验「内缩」：包含块是横跨视口的 frame，`包含块.right - 按钮.right` 是上千 px，不是判据
  //   （判据是「天然齿轮右端 − 按钮右端 = GEAR_INSET」，见 probes/foot.mjs）。
  ancestor: positionedAncestor,
  placement: computePlacement,
  layoutParent,
  // 「设置」那一行里已就位的邻居（连接指示器）——控制台/自检用它回答「现在方块为什么不在右端」。
  gearRow: gearRowOf,
  sibling: visibleSiblingOf,
  // 连接指示器那条线：认相位、藏/放、以及替代它的气泡（控制台可
  // `__dshMicro.footAction.tipNode()` 看那颗气泡节点长什么样）。
  notice: connNoticeOf,
  noticePhase: noticePhaseOf,
  hideNotice: setNoticeHidden,
  tipNode: connTipNode,
  placeTip: placeConnTip,
  syncTip: syncConnTip,
  disposeTip: disposeConnTip,
  // 「设置」的悬停提示：找它 / 打标记（挪到行上方的那条线），以及浮动层判据。
  gearTip: gearTipOf,
  markTip: markGearTip,
  unmarkTip: unmarkGearTip,
  isOverlay,
  // 「不生成盒子」的判据（槽位出口就是这种）：邻居判断与 layoutParent 共用它。
  isContents,
  candidateLabels
};
function MicroSidebarAction({ wide, t }) {
  const ref = React.useRef(null);
  const tr = typeof t === "function" ? t : null;
  const dict = DSVI && DSVI.locales && DSVI.locales.zh || {};
  const label = tr && tr("sidebar.action") || dict["sidebar.action"] || "DSH Keypad";
  const device = DSVI.services ? DSVI.services.device : null;
  const snapOf = (d) => ({
    hidden: !!(d && d.hidden),
    offline: !!(d && isDeviceOffline({ known: d.known, open: d.open }))
  });
  const [dev, setDev] = React.useState(() => snapOf(device));
  React.useEffect(() => {
    if (!device || typeof device.subscribe !== "function") return void 0;
    const sync = () => setDev(snapOf(device));
    sync();
    return device.subscribe(sync);
  }, [device]);
  const hidden = dev.hidden;
  const offline = dev.offline;
  const pick = (key, fallback) => tr && tr(key) || dict[key] || fallback;
  const noticeText = (notice) => {
    const key = NOTICE_PHASE_KEY[noticePhaseOf(notice)] || NOTICE_PHASE_KEY.disconnected;
    return pick(key, "连接异常");
  };
  const noticeAria = (notice) => {
    const body = noticeText(notice);
    const action = pick("sidebar.reconnectNow", "点击立即重连");
    return body ? body + " · " + action : action;
  };
  const onNoticeClick = () => {
    const btn = ref.current;
    const hosts = btn ? findFootHosts(btn) : null;
    const el = hosts ? connNoticeOf(hosts.gear) : null;
    if (!el) return;
    try {
      el.click();
    } catch (e) {
      warn$1("点连接指示器失败：" + (e && e.message || e));
    }
  };
  React.useEffect(() => {
    const btn = ref.current;
    const w = winOf();
    if (!btn || !w) return void 0;
    if (!wide) {
      unpinFootAction(btn);
      disposeConnTip();
      return void 0;
    }
    const place = () => {
      try {
        const r = placeFootAction(btn);
        const notice = r ? r.notice : null;
        syncConnTip(btn, notice, {
          text: noticeText(notice),
          ariaLabel: noticeAria(notice),
          onClick: onNoticeClick
        });
      } catch (e) {
        warn$1("摆放键盘入口失败：" + (e && e.message || e));
      }
    };
    place();
    const raf = typeof w.requestAnimationFrame === "function" ? w.requestAnimationFrame(place) : 0;
    const timer = setTimeout(place, 260);
    let ro = null;
    try {
      if (typeof ResizeObserver === "function") {
        const hosts = findFootHosts(btn);
        if (hosts) {
          ro = new ResizeObserver(place);
          ro.observe(hosts.foot);
        }
      }
    } catch (e) {
      ro = null;
    }
    let mo = null;
    try {
      if (typeof MutationObserver === "function") {
        const hosts = findFootHosts(btn);
        const gRow = hosts && gearRowOf(hosts.gear);
        if (gRow) {
          mo = new MutationObserver((records) => {
            const gearNow = (findFootHosts(btn) || {}).gear;
            if (records.some((r) => !(r.type === "attributes" && r.target === gearNow))) place();
          });
          mo.observe(gRow, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style", "data-phase"]
          });
        }
      }
    } catch (e) {
      mo = null;
    }
    w.addEventListener("resize", place);
    return () => {
      try {
        if (raf) w.cancelAnimationFrame(raf);
      } catch (e) {
      }
      try {
        clearTimeout(timer);
      } catch (e) {
      }
      try {
        if (ro) ro.disconnect();
      } catch (e) {
      }
      try {
        if (mo) mo.disconnect();
      } catch (e) {
      }
      try {
        w.removeEventListener("resize", place);
      } catch (e) {
      }
      unpinFootAction(btn);
      disposeConnTip();
    };
  }, [wide, hidden]);
  const onClick = () => {
    openKeyboardSettings(tr ? tr("nav") : void 0).then((ok) => {
      if (!ok) warn$1("没能直接打开键盘设置页，可手动从设置里进入「" + (dict.nav || "DSH小键盘") + "」");
    });
  };
  if (hidden) return null;
  const tip = offline ? tr && tr("sidebar.offline") || dict["sidebar.offline"] || "键盘已断开" : label;
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        ref,
        type: "button",
        "data-micro-foot": "1",
        className: "micro-foot-action" + (wide ? "" : " micro-foot-action--rail"),
        "aria-label": tip,
        title: tip,
        onClick,
        children: offline ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          KeypadIcon(ICON_SIZE),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-foot-action__dot" })
        ] }) : KeypadIcon(ICON_SIZE)
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(MicroGuideHost, { t: tr, onOpenSettings: () => {
      onClick();
    } })
  ] });
}
DSVI.MICRO_DEFAULTS = MICRO_DEFAULTS;
DSVI.css += settingsCss;
const listSessions = (snapshot2, workspaces) => visibleSessions(snapshot2, archivedIdsOf(workspaces));
const KNOB_ACTION_OPTIONS = knobActions().map((a) => [a.id, a.label]);
const GESTURES = [
  ["cw", "opts.knobCustom.cw"],
  ["ccw", "opts.knobCustom.ccw"],
  ["click", "opts.knobCustom.click"]
];
const pluginKeyLabel = (id, tt) => {
  const entry = actionById(id);
  if (entry && entry.name) return entry.name;
  if (entry && entry.label) return tt(entry.label);
  return String(id);
};
const AUTO_DIM_OPTIONS = [
  [0, "autoDim.off"],
  [30, "autoDim.30s"],
  [60, "autoDim.1m"],
  [120, "autoDim.2m"],
  [300, "autoDim.5m"]
];
function MicroSettingsSection({ scope, t, sessions, workspaces }) {
  const tt = t || ((k) => k);
  const [sessionsList, setSessionsList] = React.useState(
    () => sessions && sessions.list ? listSessions(sessions.list.getSnapshot(), workspaces) : []
  );
  React.useEffect(() => {
    const list = sessions && sessions.list ? sessions.list : null;
    const wsList = workspaces && workspaces.list ? workspaces.list : null;
    const onChange = () => setSessionsList(list ? listSessions(list.getSnapshot(), workspaces) : []);
    const off = list && typeof list.subscribe === "function" ? list.subscribe(onChange) : null;
    const offWs = wsList && typeof wsList.subscribe === "function" ? wsList.subscribe(onChange) : null;
    onChange();
    return () => {
      if (off) off();
      if (offWs) offWs();
    };
  }, [sessions, workspaces]);
  const initial = (() => {
    try {
      const s = scope && scope.getSnapshot();
      const v = s && s.value;
      return v && typeof v === "object" ? v : {};
    } catch (e) {
      return {};
    }
  })();
  const [prefs, setPrefs] = React.useState(() => ({ ...DSVI.MICRO_DEFAULTS, ...initial }));
  React.useEffect(() => {
    if (!scope || typeof scope.subscribe !== "function") return void 0;
    const off = scope.subscribe(() => {
      try {
        const s = scope.getSnapshot();
        const v = s && s.value;
        if (v && typeof v === "object") {
          setPrefs((p) => ({ ...p, ...v }));
        }
      } catch (e) {
      }
    });
    return off;
  }, [scope]);
  const SAVE_TOAST_MS = { saved: 1800, error: 3200 };
  const [saveStatus, setSaveStatus] = React.useState(null);
  const saveTimer = React.useRef(null);
  const showSaveStatus = (status) => {
    setSaveStatus(status);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const hold = SAVE_TOAST_MS[status];
    saveTimer.current = hold ? setTimeout(() => setSaveStatus(null), hold) : null;
  };
  const [conn, setConn] = React.useState({ open: false, product: null, battery: null, charging: false });
  const [resetOpen, setResetOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const readScope = () => {
    try {
      return scope && typeof scope.getSnapshot === "function" ? scope.getSnapshot() : null;
    } catch (e) {
      return null;
    }
  };
  const readBack = (check, tries = SCOPE_RETRY.tries) => new Promise((resolve) => {
    let left = tries;
    const attempt = () => {
      const snap = readScope();
      if (readbackOk(snap) && check(snap)) {
        resolve(true);
        return;
      }
      left -= 1;
      if (left <= 0) {
        resolve(false);
        return;
      }
      setTimeout(attempt, SCOPE_RETRY.delayMs);
    };
    attempt();
  });
  const writeSeq = React.useRef(0);
  const persistWrite = (key, run, expected, opts = {}) => {
    const silent = opts.silent === true;
    const sc = scope;
    if (!sc) {
      if (!silent) showSaveStatus("error");
      return Promise.resolve(false);
    }
    const before = readScope();
    if (before && before.status === "unavailable") {
      if (!silent) showSaveStatus("error");
      return Promise.resolve(false);
    }
    const seq = ++writeSeq.current;
    if (!silent) showSaveStatus("saving");
    return Promise.resolve(run()).then(
      () => readBack((snap) => snap.writable !== false && sameJson((snap.value || {})[key], expected)).then((ok) => {
        if (!silent && seq === writeSeq.current) showSaveStatus(ok ? "saved" : "error");
        return ok;
      }),
      () => {
        if (!silent && seq === writeSeq.current) showSaveStatus("error");
        return false;
      }
    );
  };
  const persist = (key, value, opts = {}) => {
    const sc = scope;
    if (!sc || typeof sc.set !== "function") {
      if (opts.silent !== true) showSaveStatus("error");
      return Promise.resolve(false);
    }
    return persistWrite(key, () => sc.set(key, value), value, opts);
  };
  const clearField = (key, opts = {}) => {
    const sc = scope;
    if (!sc) {
      if (opts.silent !== true) showSaveStatus("error");
      return Promise.resolve(false);
    }
    if (typeof sc.unset !== "function") return persist(key, DSVI.MICRO_DEFAULTS[key], opts);
    return persistWrite(key, () => sc.unset(key), DSVI.MICRO_DEFAULTS[key], opts);
  };
  const pending = React.useRef(/* @__PURE__ */ new Map());
  const debounceSend = (key, send, ms) => {
    const prev = pending.current.get(key);
    if (prev && prev.timer) clearTimeout(prev.timer);
    const entry = { send, timer: null };
    pending.current.set(key, entry);
    entry.timer = setTimeout(() => {
      pending.current.delete(key);
      send();
    }, ms);
  };
  React.useEffect(() => () => {
    for (const [, entry] of pending.current) {
      if (entry.timer) clearTimeout(entry.timer);
      if (entry.send) entry.send();
    }
    pending.current.clear();
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);
  const update = (key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    return persist(key, value);
  };
  const postConfig = (patch) => {
    if (typeof fetch === "function") {
      fetch("/micro/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      }).catch(() => {
      });
    }
  };
  const setBrightness = (v) => {
    setPrefs((p) => ({ ...p, brightness: v }));
    debounceSend("brightness:rgb", () => postConfig({ brightness: v }), 220);
    debounceSend("brightness:save", () => persist("brightness", v), 300);
  };
  const setAutoDim = (v) => {
    setPrefs((p) => ({ ...p, autoDim: v }));
    postConfig({ autoDim: v });
    persist("autoDim", v);
  };
  const resetLayout = () => {
    const keys = ["agentKey", "knob", "micKey", "agentAssign", "knobCustom", "actLabels", "joystick", "guideSeen"];
    setPrefs((p) => {
      const next = { ...p };
      for (const key of keys) next[key] = DSVI.MICRO_DEFAULTS[key];
      return next;
    });
    const sc = scope;
    const canUnset = !!sc && typeof sc.unset === "function";
    const canSet = !!sc && typeof sc.set === "function";
    if (!canUnset && !canSet) {
      showSaveStatus("error");
      return;
    }
    const seq = ++writeSeq.current;
    showSaveStatus("saving");
    let chain = Promise.resolve();
    for (const key of keys) {
      chain = chain.then(() => {
        const run = canUnset ? Promise.resolve(sc.unset(key)) : Promise.resolve(sc.set(key, DSVI.MICRO_DEFAULTS[key]));
        return run.catch(() => {
        });
      });
    }
    chain.then(() => readBack((snap) => keys.every(
      // 「清掉了」有两种同样正确的样子：DSH 的镜像会把 schema 默认值补齐（unset 之后读回来
      // 是默认值），有的版本则干脆不返回这个字段。两种都算成功 —— 只认前者，换个 DSH
      // 版本就会把「写成功了」报成失败（见 client/device.js 里同一处判据）。
      (key) => (snap.value || {})[key] === void 0 || sameJson((snap.value || {})[key], DSVI.MICRO_DEFAULTS[key])
    ))).then((ok) => {
      if (seq === writeSeq.current) showSaveStatus(ok ? "saved" : "error");
    });
  };
  React.useEffect(() => {
    if (typeof fetch !== "function") return void 0;
    const poll = () => {
      fetch("/micro/state", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
        if (!s || typeof s !== "object") return;
        setConn({ open: !!s.open, product: s.product || null, battery: s.battery, charging: s.charging });
      }).catch(() => {
      });
    };
    poll();
    const timer = setInterval(poll, 1e3);
    return () => clearInterval(timer);
  }, []);
  const reconnect = () => {
    if (typeof fetch === "function") fetch("/micro/reconnect", { method: "POST" }).catch(() => {
    });
  };
  const [monitor, setMonitor] = React.useState(null);
  React.useEffect(() => {
    if (typeof fetch !== "function") return void 0;
    let alive = true;
    const read = () => fetch(MONITOR_URL, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
      if (alive && s && typeof s === "object") setMonitor(s);
    }).catch(() => {
    });
    read();
    const timer = setInterval(read, 5e3);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const recheckMonitor = () => {
    if (typeof fetch !== "function") return;
    fetch(MONITOR_URL + "?force=1", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
      if (s && typeof s === "object") setMonitor(s);
    }).catch(() => {
    });
  };
  const openPrivacy = () => {
    if (typeof fetch !== "function") return;
    fetch(PRIVACY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pane: "listen" })
    }).catch(() => {
    });
  };
  const doRemove = () => {
    setRemoveOpen(false);
    const dev = DSVI.services ? DSVI.services.device : null;
    if (!dev || typeof dev.remove !== "function") {
      showSaveStatus("error");
      return;
    }
    showSaveStatus("saving");
    Promise.resolve(dev.remove()).then((ok) => {
      showSaveStatus(ok ? "saved" : "error");
      if (!ok) return void 0;
      return Promise.resolve(closeSettingsDialog());
    });
  };
  React.useEffect(() => {
    const hid = DSVI.services ? DSVI.services.hid : null;
    if (!hid || typeof hid.enterSim !== "function") return void 0;
    return hid.enterSim();
  }, []);
  const brightnessPct = Math.round((prefs.brightness ?? DSVI.MICRO_DEFAULTS.brightness) * 100);
  const autoDim = prefs.autoDim ?? 0;
  const agentKey = prefs.agentKey ?? "recent";
  const knob = prefs.knob ?? "navigate";
  const knobCustom = prefs.knobCustom || {};
  const plugins = PLUGIN_DEPS.map((d) => ({
    plugin: String(d.plugin),
    name: d.name || String(d.plugin),
    desc: d.desc || "",
    // 安装状态：**default.js 里手写的字段**，右侧徽标照它渲染（缺省 = 未安装）。
    installed: d.installed === true,
    usedBy: Array.isArray(d.usedBy) ? d.usedBy.filter((id) => typeof id === "string" && id) : []
  }));
  const batt = batteryView(conn);
  const hidden = isDeviceHidden({ removed: prefs.removed === true, open: conn.open });
  if (hidden) return null;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-wrap", children: [
    /* @__PURE__ */ jsxRuntime.jsx(MicroSaveToast, { status: saveStatus, t: tt }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-heading", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "micro-title", children: tt("settings.title") }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: "micro-subtitle", children: tt("settings.subtitle") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", style: { borderTop: "none" }, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("conn.title") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: conn.open ? "micro-dot micro-dot--ok" : "micro-dot micro-dot--err" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: conn.open ? "micro-status micro-status--ok" : "micro-status micro-status--err", children: conn.open ? tt("conn.connected") : tt("conn.disconnected") })
        ] })
      ] }),
      conn.open ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", "data-micro-battery": batt.known ? String(batt.pct) : "unknown", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("conn.battery") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-batt" + (batt.low ? " micro-batt--low" : ""), children: /* @__PURE__ */ jsxRuntime.jsx(BatteryIcon, { pct: batt.pct, charging: batt.charging }) }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-batt__val" + (batt.low ? " micro-batt__val--low" : ""), children: batt.known ? batt.pct + "%" : "—" }),
          batt.charging ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-batt__tag", children: tt("conn.charging") }) : null
        ] })
      ] }) : null,
      conn.open ? null : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-hint", style: { marginTop: 0 }, children: tt("conn.desc") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: reconnect, children: tt("conn.retry") }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost micro-ghost--danger", onClick: () => setRemoveOpen(true), children: tt("conn.remove") })
        ] })
      ] })
    ] }),
    removeOpen ? /* @__PURE__ */ jsxRuntime.jsx(
      MicroRemoveModal,
      {
        tt,
        onCancel: () => setRemoveOpen(false),
        onConfirm: doRemove
      }
    ) : null,
    monitorVisible(monitor) ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("monitor.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("monitor.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-dot " + monitorDot(monitor).cls }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-status " + monitorDot(monitor).statusCls, children: tt(monitorDot(monitor).labelKey) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-hint", style: { marginTop: 0 }, children: monitor.granted === false ? tt("monitor.hintDenied") : monitor.granted === true ? monitor.detail || "" : tt("monitor.hintUnknown") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__ctrl", children: [
          monitorNeedsSettings(monitor) ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: openPrivacy, children: tt("monitor.open") }) : null,
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "micro-ghost", onClick: recheckMonitor, children: tt("monitor.retry") })
        ] })
      ] })
    ] }) : null,
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("brightness.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("brightness.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "range",
              min: 0,
              max: 100,
              step: 1,
              value: brightnessPct,
              className: "micro-slider",
              "aria-label": tt("brightness.title"),
              onChange: (e) => setBrightness(Number(e.target.value) / 100)
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-val", children: brightnessPct + "%" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("autoDim.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("autoDim.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "select",
          {
            className: "micro-select",
            value: String(autoDim),
            "aria-label": tt("autoDim.title"),
            onChange: (e) => setAutoDim(Number(e.target.value)),
            children: AUTO_DIM_OPTIONS.map(([v, key]) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: String(v), children: tt(key) }, String(v)))
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("layout.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("layout.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            className: "micro-ghost",
            onClick: () => setResetOpen(true),
            children: tt("layout.reset")
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-hint micro-sim-hint", "data-micro-simhint": "1", children: tt("layout.simHint") }),
      /* @__PURE__ */ jsxRuntime.jsx(MicroLayout, { prefs, update, clearField, t: tt })
    ] }),
    resetOpen ? /* @__PURE__ */ jsxRuntime.jsx(
      MicroResetModal,
      {
        onCancel: () => setResetOpen(false),
        onConfirm: () => {
          setResetOpen(false);
          resetLayout();
        }
      }
    ) : null,
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("opts.agentKey") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("opts.agentKeyDesc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsxs(
          "select",
          {
            className: "micro-select",
            value: agentKey,
            "aria-label": tt("opts.agentKey"),
            onChange: (e) => update("agentKey", e.target.value),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "pinned", children: tt("opts.agentKey.pinned") }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "recent", children: tt("opts.agentKey.recent") }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priority", children: tt("opts.agentKey.priority") }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "custom", children: tt("opts.agentKey.custom") })
            ]
          }
        ) })
      ] }),
      agentKey === "custom" ? [0, 1, 2, 3, 4, 5].map((n) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("opts.agentAssign.slot") + " " + (n + 1) }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsxs(
          "select",
          {
            className: "micro-select",
            value: String((prefs.agentAssign || {})[n] || ""),
            "aria-label": tt("opts.agentAssign.slot") + " " + (n + 1),
            onChange: (e) => {
              const assign = { ...prefs.agentAssign || {} };
              if (e.target.value) assign[n] = e.target.value;
              else delete assign[n];
              update("agentAssign", assign);
            },
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "", children: tt("opts.agentAssign.none") }),
              sessionsList.map((s) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: s.id, children: s.displayTitle || s.id }, s.id))
            ]
          }
        ) })
      ] }, "agent-slot-" + n)) : null,
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("opts.knob") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("opts.knob." + knob + ".desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsxs(
          "select",
          {
            className: "micro-select",
            value: knob,
            "aria-label": tt("opts.knob"),
            onChange: (e) => update("knob", e.target.value),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "navigate", children: tt("opts.knob.navigate") }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "reasoning", children: tt("opts.knob.reasoning") }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "scroll", children: tt("opts.knob.scroll") }),
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "custom", children: tt("opts.knob.custom") })
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("opts.knob.longHint") }) }) }),
      knob === "custom" ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("opts.knobCustom") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("opts.knobCustomDesc") })
      ] }) }) : null,
      knob === "custom" ? GESTURES.map(([g, labelKey]) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt(labelKey) }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "select",
          {
            className: "micro-select",
            value: String(knobCustom[g] || "none"),
            "aria-label": tt(labelKey),
            onChange: (e) => update("knobCustom", { ...knobCustom, [g]: e.target.value }),
            children: KNOB_ACTION_OPTIONS.map(([v, key]) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: v, children: tt(key) }, v))
          }
        ) })
      ] }, "knob-gesture-" + g)) : null,
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("opts.micKey") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("opts.micKeyDesc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": !!prefs.micKey,
            "aria-label": tt("opts.micKey"),
            className: "micro-switch",
            "data-on": prefs.micKey || void 0,
            onClick: () => update("micKey", !prefs.micKey)
          }
        ) })
      ] })
    ] }),
    plugins.length ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-card", "data-micro-plugins": "1", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: tt("plugins.title") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__desc", children: tt("plugins.desc") })
      ] }) }),
      plugins.map((p) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row", "data-micro-plugin": p.plugin, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__title", children: p.name }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "micro-row__desc", children: [
            p.desc || null,
            p.desc && p.usedBy.length ? " · " : null,
            p.usedBy.length ? tt("plugins.usedBy") + p.usedBy.map((id) => pluginKeyLabel(id, tt)).join("、") : null
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "micro-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "micro-plugin-badge" + (p.installed ? " micro-plugin-badge--on" : " micro-plugin-badge--off"), children: p.installed ? tt("plugins.installed") : tt("plugins.missing") }) })
      ] }, p.plugin))
    ] }) : null
  ] });
}
const ATTENTION_POLL_MS = 150;
const ATTENTION_ARM_MS = 4e3;
const COMPOSER_TRIGGER_SEL = 'button, [role="button"], [aria-haspopup], [aria-expanded]';
class AttentionController {
  constructor({ agents, log, pollMs, armMs } = {}) {
    /** 灯态控制器（./agents.js）—— 探测结果通过它的 setAttention 上报。 */
    __privateAdd(this, _agents, null);
    __privateAdd(this, _timer2, null);
    __privateAdd(this, _armTimer, null);
    /** 是否在「等弹窗」（见文件头 ②）。 */
    __privateAdd(this, _armed, false);
    /** 这一轮待命期间**见到过**弹窗（见文件头 ③）。 */
    __privateAdd(this, _sawPopup, false);
    /** 上一次上报给 agents 的值（null = 没有弹窗）。 */
    __privateAdd(this, _reported, null);
    __privateAdd(this, _onClick, null);
    __privateAdd(this, _log4, (msg) => {
      try {
      } catch (e) {
      }
    });
    __publicField(this, "pollMs", ATTENTION_POLL_MS);
    __publicField(this, "armMs", ATTENTION_ARM_MS);
    __publicField(this, "start", () => {
      if (typeof document === "undefined") return;
      this.stop();
      __privateSet(this, _onClick, __privateGet(this, _handleClick));
      try {
        document.addEventListener("click", __privateGet(this, _onClick), true);
      } catch (e) {
      }
      __privateSet(this, _timer2, setInterval(__privateGet(this, _tick), this.pollMs));
      __privateGet(this, _tick).call(this);
    });
    __publicField(this, "stop", () => {
      if (__privateGet(this, _timer2)) {
        clearInterval(__privateGet(this, _timer2));
        __privateSet(this, _timer2, null);
      }
      __privateGet(this, _disarm).call(this);
      if (__privateGet(this, _onClick)) {
        try {
          document.removeEventListener("click", __privateGet(this, _onClick), true);
        } catch (e) {
        }
        __privateSet(this, _onClick, null);
      }
      __privateGet(this, _report).call(this, null);
    });
    /** 旋钮按下（由 KnobController.setOnPress 调）→ 进入待命，等它招来的弹窗。 */
    __publicField(this, "arm", () => __privateGet(this, _arm).call(this));
    /** 诊断快照（`__dshMicro.services.attention.diagnose()`）。 */
    __publicField(this, "diagnose", () => ({
      attention: __privateGet(this, _reported),
      armed: __privateGet(this, _armed),
      sawPopup: __privateGet(this, _sawPopup),
      pollMs: this.pollMs,
      armMs: this.armMs
    }));
    __privateAdd(this, _arm, () => {
      var _a, _b;
      __privateSet(this, _armed, true);
      __privateSet(this, _sawPopup, false);
      if (__privateGet(this, _armTimer)) clearTimeout(__privateGet(this, _armTimer));
      __privateSet(this, _armTimer, setTimeout(() => {
        __privateSet(this, _armTimer, null);
        __privateGet(this, _disarm).call(this);
        __privateGet(this, _tick).call(this);
      }, this.armMs));
      (_b = (_a = __privateGet(this, _armTimer)) == null ? void 0 : _a.unref) == null ? void 0 : _b.call(_a);
      __privateGet(this, _tick).call(this);
    });
    __privateAdd(this, _disarm, () => {
      __privateSet(this, _armed, false);
      __privateSet(this, _sawPopup, false);
      if (__privateGet(this, _armTimer)) {
        clearTimeout(__privateGet(this, _armTimer));
        __privateSet(this, _armTimer, null);
      }
    });
    /**
     * 点在输入框里某个控件上 → 待命。
     *
     * ⚠ 刻意**只认控件**（按钮 / 弹出触发器），不认「点在输入区里的任何地方」：点进编辑区打字
     * （文本输入框）和点正文里的提及块都不该算 —— 它们不是「按了那颗 + 号」。
     * ⚠ 认「输入框里的控件」而不是「那颗 + 号」本身：DSH 的 + 号没有稳定可认的标记
     * （class 带构建期 hash，见 ./actions/dom.js 的 composerFileInput 那段注释），
     * 而这一条覆盖得到它、也不会把正文里的随便一颗按钮算进来。
     */
    __privateAdd(this, _handleClick, (ev) => {
      try {
        const el = ev && ev.target;
        if (!el) return;
        if (isTextEntry(el)) return;
        const root = findInputRoot();
        if (!root || !root.contains(el)) return;
        if (typeof el.closest !== "function") return;
        if (!el.closest(COMPOSER_TRIGGER_SEL)) return;
        __privateGet(this, _arm).call(this);
      } catch (e) {
      }
    });
    /**
     * 一拍：先认批准弹窗（优先），再认「待命期间出现的弹窗」，最后看看待命该不该收。
     */
    __privateAdd(this, _tick, () => {
      let kind = null;
      if (interactionPanelRoot()) kind = "approval";
      else if (__privateGet(this, _armed) && findActivePopup()) {
        __privateSet(this, _sawPopup, true);
        kind = "menu";
      }
      if (!kind && __privateGet(this, _armed) && __privateGet(this, _sawPopup)) __privateGet(this, _disarm).call(this);
      __privateGet(this, _report).call(this, kind);
    });
    __privateAdd(this, _report, (kind) => {
      if (kind === __privateGet(this, _reported)) return;
      __privateSet(this, _reported, kind);
      const a = __privateGet(this, _agents);
      if (!a || typeof a.setAttention !== "function") return;
      try {
        a.setAttention(kind);
      } catch (e) {
        __privateGet(this, _log4).call(this, `弹窗灯色上报失败：${e && e.message || e}`);
      }
    });
    __privateSet(this, _agents, agents || null);
    if (typeof log === "function") __privateSet(this, _log4, log);
    if (typeof pollMs === "number" && pollMs > 0) this.pollMs = pollMs;
    if (typeof armMs === "number" && armMs > 0) this.armMs = armMs;
  }
  /** 当前上报出去的弹窗态（诊断 / 自检用）。 */
  get attention() {
    return __privateGet(this, _reported);
  }
  get armed() {
    return __privateGet(this, _armed);
  }
}
_agents = new WeakMap();
_timer2 = new WeakMap();
_armTimer = new WeakMap();
_armed = new WeakMap();
_sawPopup = new WeakMap();
_reported = new WeakMap();
_onClick = new WeakMap();
_log4 = new WeakMap();
_arm = new WeakMap();
_disarm = new WeakMap();
_handleClick = new WeakMap();
_tick = new WeakMap();
_report = new WeakMap();
const HUD_LINGER_MS = 1500;
const HUD_CLASS = "micro-joyhud";
const DIR_ANGLE = { right: 0, down: 90, left: 180, up: 270 };
const DIR_ARROW = { up: "↑", right: "→", down: "↓", left: "←" };
const DIR_TEXT_KEY = {
  up: "joyHud.up",
  right: "joyHud.right",
  down: "joyHud.down",
  left: "joyHud.left"
};
const DIR_FALLBACK = { up: "上", right: "右", down: "下", left: "左" };
const STATUS_TEXT_KEY = {
  ok: "joyHud.ok",
  unbound: "joyHud.unbound",
  unwired: "joyHud.unwired",
  failed: "joyHud.failed"
};
const STATUS_FALLBACK = { ok: "已触发", unbound: "未绑定", unwired: "未接线", failed: "未生效" };
const STATUS_MARK = { ok: "✓", unbound: "·", unwired: "·", failed: "!" };
const JOY_ACTION_LOCALE = {
  [JOY_ACTION.BACK]: "joyAct.undo",
  [JOY_ACTION.FORWARD]: "joyAct.redo",
  [JOY_ACTION.SIDEBAR]: "joyAct.sidebar",
  [JOY_ACTION.PLAN]: "joyAct.plan",
  [JOY_ACTION.SCROLL_BOTTOM]: "joyAct.scrollBottom"
};
const DOT_RADIUS = 12;
const clamp01 = (n) => Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
const round2 = (n) => Math.round(n * 100) / 100;
const dotOffset = (dir, push, a) => {
  if (!dir) return { x: 0, y: 0 };
  const deg = Number.isFinite(a) ? (a % 1 + 1) % 1 * 360 : DIR_ANGLE[dir];
  if (!Number.isFinite(deg)) return { x: 0, y: 0 };
  const r = DOT_RADIUS * (Number.isFinite(push) ? clamp01(push) : 1);
  const rad = deg * Math.PI / 180;
  return { x: round2(Math.cos(rad) * r), y: round2(Math.sin(rad) * r) };
};
class JoystickHud {
  /**
   * @param options.doc - 注入的 document（不传就用运行时的 document；测试里装假 DOM 用）。
   * @param options.t - 词典函数（`ctx.locale.bind(NS)`）。拿不到 / 返回未知词条时退回内置中文。
   * @param options.lingerMs - 松手后的停留时长（测试里调小）。
   * @param options.log - 记一行日志（拿不到 document 这类「看起来没反应」的情况必须出声）。
   */
  constructor(options = {}) {
    __privateAdd(this, _doc2, null);
    __privateAdd(this, _t2, null);
    __privateAdd(this, _lingerMs, HUD_LINGER_MS);
    __privateAdd(this, _log5, null);
    __privateAdd(this, _root2, null);
    __privateAdd(this, _els2, null);
    __privateAdd(this, _timer3, null);
    __privateAdd(this, _phase, "idle");
    /** 卡片上正在显示的那一条：{ dir, action, status }。**留着不删** —— 同方向再推一次无需重算文案。 */
    __privateAdd(this, _info, null);
    /** 当前这一推的实时画面：{ dir, push, a }。回中后置 null（点归中心）。 */
    __privateAdd(this, _push2, null);
    /** 「拿不到 document」只出声一次（每次显示都刷屏的话，控制台就没法看了）。 */
    __privateAdd(this, _warnedMissingDoc2, false);
    /** 给自检 / 探针看的一眼状态（不含 DOM 细节，量 DOM 请查 .micro-joyhud）。 */
    __publicField(this, "status", () => ({
      phase: __privateGet(this, _phase),
      visible: this.visible,
      info: __privateGet(this, _info) ? { ...__privateGet(this, _info) } : null,
      push: __privateGet(this, _push2) ? { ...__privateGet(this, _push2) } : null,
      lingerMs: __privateGet(this, _lingerMs)
    }));
    /**
     * 每次轮询的状态快照。**只画画面，不执行任何动作**。
     * @param snap - /micro/state 的形状（只读 joy / joyD / joyA / open）。
     */
    __publicField(this, "feed", (snap) => {
      if (!__privateGet(this, _info)) return;
      const s = snap && typeof snap === "object" ? snap : {};
      const live = s.open !== false && typeof s.joy === "string" && !!s.joy;
      if (!live) {
        if (__privateGet(this, _phase) !== "live") return;
        __privateSet(this, _phase, "linger");
        __privateSet(this, _push2, null);
        __privateGet(this, _paint).call(this);
        if (__privateGet(this, _root2)) __privateGet(this, _startLinger).call(this);
        else __privateSet(this, _phase, "idle");
        return;
      }
      const entered = __privateGet(this, _phase) !== "live";
      __privateSet(this, _phase, "live");
      __privateGet(this, _cancelLinger).call(this);
      if (entered && __privateGet(this, _info).dir !== s.joy) return;
      __privateSet(this, _push2, { dir: s.joy, push: Number.isFinite(s.joyD) ? s.joyD : 1, a: Number.isFinite(s.joyA) ? s.joyA : null });
      __privateGet(this, _paint).call(this);
      __privateGet(this, _show).call(this);
    });
    /**
     * 摇杆控制器报来的一次手势（方向 + 动作名 + 结果）。**只管文案**。
     * @param info - { dir, action, status }；status 见 joystick.js 的 JOY_RESULT（认不出的按 ok 处理）。
     */
    __publicField(this, "notify", (info) => {
      const i = info && typeof info === "object" ? info : null;
      if (!i || typeof i.dir !== "string" || !i.dir) return;
      __privateSet(this, _info, {
        dir: i.dir,
        action: typeof i.action === "string" && i.action ? i.action : null,
        status: STATUS_TEXT_KEY[i.status] ? i.status : JOY_RESULT.OK
      });
      const ok = __privateGet(this, _paint).call(this);
      if (!ok) return;
      if (__privateGet(this, _phase) !== "live") {
        __privateSet(this, _phase, "linger");
        __privateGet(this, _startLinger).call(this);
      }
      __privateGet(this, _show).call(this);
    });
    /** 立刻收起来（设置页演示闸门期间 / 卸载）。 */
    __publicField(this, "hide", () => {
      __privateGet(this, _cancelLinger).call(this);
      __privateSet(this, _phase, "idle");
      if (__privateGet(this, _root2)) __privateGet(this, _root2).hidden = true;
    });
    /** 卸载：连节点一起摘掉（只 hidden 的话，重装会在 body 上堆一串死节点）。 */
    __publicField(this, "dispose", () => {
      __privateGet(this, _cancelLinger).call(this);
      __privateSet(this, _phase, "idle");
      __privateSet(this, _push2, null);
      const root = __privateGet(this, _root2);
      __privateSet(this, _root2, null);
      __privateSet(this, _els2, null);
      if (root && typeof root.remove === "function") {
        try {
          root.remove();
        } catch (e) {
        }
      }
    });
    // ------------------------------------------------------------------ 内部
    __privateAdd(this, _docOf2, () => __privateGet(this, _doc2) || (typeof document !== "undefined" ? document : null));
    /** 词典取词：拿不到（没注入 / 词条没绑 / 返回键名本身）时退回内置文案。 */
    __privateAdd(this, _text, (key, fallback) => {
      let v = null;
      try {
        v = __privateGet(this, _t2) ? __privateGet(this, _t2).call(this, key) : null;
      } catch (e) {
        v = null;
      }
      return typeof v === "string" && v && v !== key ? v : fallback;
    });
    __privateAdd(this, _cancelLinger, () => {
      if (__privateGet(this, _timer3)) {
        clearTimeout(__privateGet(this, _timer3));
        __privateSet(this, _timer3, null);
      }
    });
    __privateAdd(this, _startLinger, () => {
      __privateGet(this, _cancelLinger).call(this);
      __privateSet(this, _timer3, setTimeout(() => {
        __privateSet(this, _timer3, null);
        this.hide();
      }, __privateGet(this, _lingerMs)));
    });
    __privateAdd(this, _show, () => {
      const els = __privateGet(this, _ensure2).call(this);
      if (els) els.root.hidden = false;
    });
    __privateAdd(this, _el2, (tag, cls, text) => {
      const el = __privateGet(this, _docOf2).call(this).createElement(tag);
      if (cls) el.className = cls;
      if (text !== void 0) el.textContent = text;
      return el;
    });
    /** 惰性建节点：第一次真的要显示时才碰 DOM（没有 document 时安静地什么都不做，只记一行）。 */
    __privateAdd(this, _ensure2, () => {
      if (__privateGet(this, _els2)) return __privateGet(this, _els2);
      const doc = __privateGet(this, _docOf2).call(this);
      if (!doc || !doc.body || typeof doc.createElement !== "function") {
        if (!__privateGet(this, _warnedMissingDoc2)) {
          __privateSet(this, _warnedMissingDoc2, true);
          __privateGet(this, _log5).call(this, "拿不到 document.body，摇杆提示卡片不显示");
        }
        return null;
      }
      const root = __privateGet(this, _el2).call(this, "div", HUD_CLASS);
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");
      root.setAttribute("data-status", JOY_RESULT.OK);
      root.hidden = true;
      const pad = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__pad");
      const dot = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__dot");
      pad.appendChild(dot);
      const body = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__body");
      const dirRow = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__dir");
      const arrow = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__arrow");
      const dirText = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__dirtext");
      dirRow.appendChild(arrow);
      dirRow.appendChild(dirText);
      const action = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__action");
      const statusRow = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__status");
      const mark = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__mark");
      const statusText = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__statustext");
      statusRow.appendChild(mark);
      statusRow.appendChild(statusText);
      const bar = __privateGet(this, _el2).call(this, "span", HUD_CLASS + "__bar");
      const fill = __privateGet(this, _el2).call(this, "i", HUD_CLASS + "__fill");
      fill.style.animationDuration = __privateGet(this, _lingerMs) + "ms";
      bar.appendChild(fill);
      body.appendChild(dirRow);
      body.appendChild(action);
      body.appendChild(statusRow);
      body.appendChild(bar);
      root.appendChild(pad);
      root.appendChild(body);
      doc.body.appendChild(root);
      __privateSet(this, _root2, root);
      __privateSet(this, _els2, { root, dot, arrow, dirText, action, mark, statusText, fill });
      return __privateGet(this, _els2);
    });
    /** 把 #info / #push 画到节点上。没建成节点（没有 document）时返回 false。 */
    __privateAdd(this, _paint, () => {
      if (!__privateGet(this, _info)) return false;
      const els = __privateGet(this, _ensure2).call(this);
      if (!els) return false;
      const { dir, action, status } = __privateGet(this, _info);
      els.arrow.textContent = DIR_ARROW[dir] || "";
      els.dirText.textContent = __privateGet(this, _text).call(this, DIR_TEXT_KEY[dir], DIR_FALLBACK[dir] || dir);
      els.action.textContent = action ? __privateGet(this, _text).call(this, JOY_ACTION_LOCALE[action], action) : "—";
      els.mark.textContent = STATUS_MARK[status] || "";
      els.statusText.textContent = __privateGet(this, _text).call(this, STATUS_TEXT_KEY[status], STATUS_FALLBACK[status] || status);
      els.root.setAttribute("data-status", status);
      els.root.setAttribute("data-dir", dir);
      const o = __privateGet(this, _push2) ? dotOffset(__privateGet(this, _push2).dir, __privateGet(this, _push2).push, __privateGet(this, _push2).a) : { x: 0, y: 0 };
      els.dot.style.transform = `translate(${o.x}px, ${o.y}px)`;
      return true;
    });
    const o = options || {};
    if (o.doc) __privateSet(this, _doc2, o.doc);
    __privateSet(this, _t2, typeof o.t === "function" ? o.t : null);
    if (Number.isFinite(o.lingerMs) && o.lingerMs >= 0) __privateSet(this, _lingerMs, o.lingerMs);
    __privateSet(this, _log5, typeof o.log === "function" ? o.log : (msg) => {
      try {
      } catch (e) {
      }
    });
  }
  /** 卡片此刻真的在屏幕上吗（判据是 DOM 的 hidden，不是我自己的相位变量）。 */
  get visible() {
    return !!(__privateGet(this, _root2) && __privateGet(this, _root2).hidden === false);
  }
}
_doc2 = new WeakMap();
_t2 = new WeakMap();
_lingerMs = new WeakMap();
_log5 = new WeakMap();
_root2 = new WeakMap();
_els2 = new WeakMap();
_timer3 = new WeakMap();
_phase = new WeakMap();
_info = new WeakMap();
_push2 = new WeakMap();
_warnedMissingDoc2 = new WeakMap();
_docOf2 = new WeakMap();
_text = new WeakMap();
_cancelLinger = new WeakMap();
_startLinger = new WeakMap();
_show = new WeakMap();
_el2 = new WeakMap();
_ensure2 = new WeakMap();
_paint = new WeakMap();
const WHY$1 = {
  ready: "ok",
  seen: "已看过（guideSeen=true）",
  offline: "设备未连接（/micro/state.open !== true）",
  already: "本次页面会话里已经弹过",
  norecord: "设置作用域不可写，弹了也记不住",
  nodeps: "没有 hid 桥（收不到 /micro/state 广播）"
};
class GuideController {
  constructor({ hid } = {}) {
    /** hid-bridge：取它只为订阅状态广播（见文件头「只读状态」）。 */
    __privateAdd(this, _hid, null);
    /** settingsScope 的绑定；`set` 不可用时整个引导不弹（见文件头）。 */
    __privateAdd(this, _scope, null);
    /** 最近一次偏好快照（只看 guideSeen；prefs 也直接给预览用）。 */
    __privateAdd(this, _prefs, {});
    __privateAdd(this, _open, false);
    __privateAdd(this, _step, GUIDE_STEPS[0]);
    /** 一次性闸门：本次页面会话里已经弹过了。 */
    __privateAdd(this, _shown2, false);
    __privateAdd(this, _off, null);
    __privateAdd(this, _subs2, /* @__PURE__ */ new Set());
    /** 设置作用域（entry.js 的 UI 段装配好之后灌进来）。 */
    __publicField(this, "setScope", (scope) => {
      __privateSet(this, _scope, scope || null);
    });
    /** 偏好快照（entry.js 的 refresh effect 每次变化都灌）。 */
    __publicField(this, "setPrefs", (prefs) => {
      if (!prefs || typeof prefs !== "object") return;
      const was = this.seen;
      __privateSet(this, _prefs, prefs);
      if (was && !this.seen) __privateSet(this, _shown2, false);
    });
    /**
     * 能不能把「已看过」记下来。
     * 记不住就不弹：弹窗的价值全在「只弹一次」，每次都弹的话它就从引导变成了骚扰。
     */
    __privateAdd(this, _canRemember, () => !!(__privateGet(this, _scope) && typeof __privateGet(this, _scope).set === "function"));
    /** 订阅「要不要弹 / 第几屏」的变化（供 React 重渲染）。 */
    __publicField(this, "subscribe", (fn) => {
      if (typeof fn !== "function") return () => {
      };
      __privateGet(this, _subs2).add(fn);
      return () => {
        __privateGet(this, _subs2).delete(fn);
      };
    });
    __privateAdd(this, _emit3, () => {
      for (const fn of [...__privateGet(this, _subs2)]) {
        try {
          fn();
        } catch (e) {
        }
      }
    });
    /** 开始盯设备状态（由 ctx.effect 管生命周期）。幂等：重复调用不会叠订阅。 */
    __publicField(this, "start", () => {
      if (__privateGet(this, _off)) return true;
      if (!__privateGet(this, _hid) || typeof __privateGet(this, _hid).subscribe !== "function") return false;
      __privateSet(this, _off, __privateGet(this, _hid).subscribe(__privateGet(this, _onState)));
      return true;
    });
    __publicField(this, "stop", () => {
      if (__privateGet(this, _off)) {
        __privateGet(this, _off).call(this);
        __privateSet(this, _off, null);
      }
    });
    /**
     * 每帧 /micro/state 都会走这里 —— 所以第一件事就是短路，
     * 别让一个纯界面的判断跑在 120ms 的热路径上做大动作。
     */
    __privateAdd(this, _onState, (s) => {
      if (__privateGet(this, _shown2) || __privateGet(this, _open)) return;
      const open = !!(s && s.open === true);
      if (!__privateGet(this, _canRemember).call(this)) return;
      if (!shouldShowGuide({ open, seen: this.seen })) return;
      __privateSet(this, _shown2, true);
      __privateSet(this, _step, GUIDE_STEPS[0]);
      __privateSet(this, _open, true);
      __privateGet(this, _emit3).call(this);
    });
    /** 关掉引导并**记住**（走完 / 跳过 / 右上角 × 都是这条路）。 */
    __publicField(this, "dismiss", () => {
      if (!__privateGet(this, _open)) return false;
      __privateSet(this, _open, false);
      if (!this.seen) __privateSet(this, _prefs, { ...__privateGet(this, _prefs), guideSeen: true });
      __privateGet(this, _emit3).call(this);
      __privateGet(this, _remember).call(this);
      return true;
    });
    __privateAdd(this, _remember, () => {
      const sc = __privateGet(this, _scope);
      if (!sc || typeof sc.set !== "function") return false;
      try {
        Promise.resolve(sc.set("guideSeen", true)).catch(() => {
        });
        return true;
      } catch (e) {
        return false;
      }
    });
    /** 下一屏（已经在最后一屏时无动作）。 */
    __publicField(this, "next", () => {
      if (!__privateGet(this, _open)) return false;
      const to = nextStep(__privateGet(this, _step));
      if (to === __privateGet(this, _step)) return false;
      __privateSet(this, _step, to);
      __privateGet(this, _emit3).call(this);
      return true;
    });
    /** 上一屏（已经在封面时无动作）。 */
    __publicField(this, "back", () => {
      if (!__privateGet(this, _open)) return false;
      const to = prevStep(__privateGet(this, _step));
      if (to === __privateGet(this, _step)) return false;
      __privateSet(this, _step, to);
      __privateGet(this, _emit3).call(this);
      return true;
    });
    /**
     * 从头重放（设置页里的「重新播放引导」）。
     * 与 `#onState` 的区别：**不查 seen、不看设备**——用户明确要再看一次。
     * 也不动 `guideSeen`：重放不是「没看过」，关掉之后仍然不再自动弹。
     */
    __publicField(this, "replay", () => {
      __privateSet(this, _step, GUIDE_STEPS[0]);
      __privateSet(this, _open, true);
      __privateSet(this, _shown2, true);
      __privateGet(this, _emit3).call(this);
      return true;
    });
    /** 诊断快照：`__dshMicro.services.guide.diagnose()` 直接答「为什么没弹」。 */
    __publicField(this, "diagnose", () => {
      let why = WHY$1.ready;
      if (__privateGet(this, _shown2) || __privateGet(this, _open)) why = WHY$1.already;
      else if (!__privateGet(this, _hid) || typeof __privateGet(this, _hid).subscribe !== "function") why = WHY$1.nodeps;
      else if (!__privateGet(this, _canRemember).call(this)) why = WHY$1.norecord;
      else if (this.seen) why = WHY$1.seen;
      else why = WHY$1.offline;
      return {
        shown: __privateGet(this, _shown2),
        open: __privateGet(this, _open),
        step: __privateGet(this, _step),
        seen: this.seen,
        canRemember: __privateGet(this, _canRemember).call(this),
        why
      };
    });
    __privateSet(this, _hid, hid || null);
  }
  get open() {
    return __privateGet(this, _open);
  }
  get step() {
    return __privateGet(this, _step);
  }
  get prefs() {
    return __privateGet(this, _prefs);
  }
  get shown() {
    return __privateGet(this, _shown2);
  }
  /** 用户看过没有（只看已落盘/已读回的值）。 */
  get seen() {
    return __privateGet(this, _prefs) && __privateGet(this, _prefs).guideSeen === true;
  }
}
_hid = new WeakMap();
_scope = new WeakMap();
_prefs = new WeakMap();
_open = new WeakMap();
_step = new WeakMap();
_shown2 = new WeakMap();
_off = new WeakMap();
_subs2 = new WeakMap();
_canRemember = new WeakMap();
_emit3 = new WeakMap();
_onState = new WeakMap();
_remember = new WeakMap();
const WHY = {
  visible: "ok（界面正常显示）",
  hidden: "已被移除 + 设备没连上 → 界面收起",
  connected: "设备已连上 → 界面显示（removed 会被自动清掉）",
  nodeps: "没有 hid 桥（收不到 /micro/state 广播）",
  noscope: "设置作用域不可写（移除/恢复都无法落盘）"
};
class DeviceController {
  constructor({ hid, defaults } = {}) {
    /** hid-bridge：只取它订阅状态广播（读 `open`）。 */
    __privateAdd(this, _hid2, null);
    /** settingsScope 的绑定（entry.js 的 UI 段装配好之后灌进来）。 */
    __privateAdd(this, _scope2, null);
    /** 与宿主 schema 逐字段对齐的默认值（清空偏好要用它）。 */
    __privateAdd(this, _defaults, {});
    /** 最近一次偏好快照（只看 removed）。 */
    __privateAdd(this, _prefs2, {});
    __privateAdd(this, _open2, false);
    /**
     * 已经收到过宿主的状态帧没有（2026-09-24）。
     *
     * 为什么要它：`open` 的初值是 false，而「从没听过宿主说话」与「听说过、它说没连上」
     * 对界面是两件事 —— 前者不该挂「已断开」的红点，否则每次刷新都会先闪一下
     * （见 utils/device.js 的 isDeviceOffline）。
     */
    __privateAdd(this, _seen, false);
    __privateAdd(this, _off2, null);
    __privateAdd(this, _subs3, /* @__PURE__ */ new Set());
    /**
     * 正在清 removed（防重入）。广播 120ms 一帧、写盘要几拍，不挡的话每帧都会再写一次；
     * 失败后**不立刻重试**，等下一次「连上」的边沿再试（见 #onState）——
     * 那说明作用域暂时写不进去，每 120ms 重试一轮只会在控制台刷屏。
     */
    __privateAdd(this, _restoring, false);
    /** 恢复写盘失败过（只在控制台提醒一次）。 */
    __privateAdd(this, _restoreWarned, false);
    /** 设置作用域（entry.js 的 UI 段）。 */
    __publicField(this, "setScope", (scope) => {
      __privateSet(this, _scope2, scope || null);
    });
    /** 偏好快照（entry.js 的 refresh effect 每次变化都灌）。 */
    __publicField(this, "setPrefs", (prefs) => {
      if (!prefs || typeof prefs !== "object") return;
      const was = this.hidden;
      __privateSet(this, _prefs2, prefs);
      if (was !== this.hidden) __privateGet(this, _emit4).call(this);
    });
    /** 订阅「隐藏与否」的变化（侧边栏入口、设置页导航行都靠它）。 */
    __publicField(this, "subscribe", (fn) => {
      if (typeof fn !== "function") return () => {
      };
      __privateGet(this, _subs3).add(fn);
      return () => {
        __privateGet(this, _subs3).delete(fn);
      };
    });
    __privateAdd(this, _emit4, () => {
      for (const fn of [...__privateGet(this, _subs3)]) {
        try {
          fn();
        } catch (e) {
        }
      }
    });
    /** 开始盯设备状态（由 ctx.effect 管生命周期）。幂等：重复调用不会叠订阅。 */
    __publicField(this, "start", () => {
      if (__privateGet(this, _off2)) return true;
      if (!__privateGet(this, _hid2) || typeof __privateGet(this, _hid2).subscribe !== "function") return false;
      __privateSet(this, _off2, __privateGet(this, _hid2).subscribe(__privateGet(this, _onState2)));
      return true;
    });
    __publicField(this, "stop", () => {
      if (__privateGet(this, _off2)) {
        __privateGet(this, _off2).call(this);
        __privateSet(this, _off2, null);
      }
    });
    /**
     * 每帧状态都会走这里（WS 推送为主；退回轮询时 120ms 一拍），所以先比再发，
     * 不做多余的重渲染。
     */
    __privateAdd(this, _onState2, (s) => {
      const open = !!(s && s.open === true);
      const first = !__privateGet(this, _seen);
      __privateSet(this, _seen, true);
      if (first || open !== __privateGet(this, _open2)) {
        __privateSet(this, _open2, open);
        if (open) __privateSet(this, _restoring, false);
        __privateGet(this, _emit4).call(this);
      }
      if (open && this.removed) __privateGet(this, _restore).call(this);
    });
    __privateAdd(this, _snapshot, () => {
      try {
        return __privateGet(this, _scope2) && typeof __privateGet(this, _scope2).getSnapshot === "function" ? __privateGet(this, _scope2).getSnapshot() : null;
      } catch (e) {
        return null;
      }
    });
    /** 回读重试：镜像刷新要几拍，读一次常常还读到上一版（判据与设置页同源）。 */
    __privateAdd(this, _readBack, (check, tries = SCOPE_RETRY.tries) => new Promise((resolve) => {
      let left = tries;
      const attempt = () => {
        const snap = __privateGet(this, _snapshot).call(this);
        if (readbackOk(snap) && check(snap)) {
          resolve(true);
          return;
        }
        left -= 1;
        if (left <= 0) {
          resolve(false);
          return;
        }
        setTimeout(attempt, SCOPE_RETRY.delayMs);
      };
      attempt();
    }));
    /** 清掉一个字段的用户层覆盖（回落 schema 默认）；老客户端没有 unset 时就写默认值。 */
    __privateAdd(this, _unset, async (key) => {
      const sc = __privateGet(this, _scope2);
      if (!sc) return;
      try {
        if (typeof sc.unset === "function") await sc.unset(key);
        else await sc.set(key, __privateGet(this, _defaults)[key]);
      } catch (e) {
      }
    });
    /**
     * 「移除这台键盘」：清空**全部**偏好，再记下 removed。
     *
     * 顺序要紧：先清偏好、最后立标记。反过来的话中途失败会留下「界面没了、偏好还在」的
     * 中间态，而用户看到的是「已经移除了」。
     *
     * 收界面**只在回读确认之后**（见文件头第三条）：落盘没成就不该把界面收掉。
     * @returns {Promise<boolean>} 是否真的落盘成功。
     */
    __publicField(this, "remove", async () => {
      const sc = __privateGet(this, _scope2);
      if (!sc || typeof sc.set !== "function") return false;
      const before = __privateGet(this, _snapshot).call(this);
      if (before && before.status === "unavailable") return false;
      const keys = removeKeys(__privateGet(this, _defaults));
      for (const key of keys) await __privateGet(this, _unset).call(this, key);
      try {
        await sc.set(REMOVED_KEY, true);
      } catch (e) {
      }
      const ok = await __privateGet(this, _readBack).call(this, (snap) => {
        const v = snapValue(snap);
        return v[REMOVED_KEY] === true && keys.every((k) => v[k] === void 0 || sameJson(v[k], __privateGet(this, _defaults)[k]));
      });
      if (ok) {
        __privateSet(this, _prefs2, { ...__privateGet(this, _prefs2), [REMOVED_KEY]: true });
        __privateGet(this, _emit4).call(this);
      }
      return ok;
    });
    /**
     * 设备重新连上 → 撤销「移除」。
     *
     * 这里**故意乐观**：先把本地态改成「没被移除」并广播，界面立刻回来，写盘在后台做。
     * 理由与 remove() 相反 —— 写失败的后果不一样：只要设备连着，`hidden` 恒为 false，
     * 界面本来就是对的；写失败唯一的影响是「以后拔掉设备会再收一次界面」，所以只提醒一行。
     * 反过来（等写盘回读再放行）会出现「键盘明明已经连上了，界面还要等半秒才回来」。
     */
    __privateAdd(this, _restore, () => {
      if (__privateGet(this, _restoring)) return false;
      const sc = __privateGet(this, _scope2);
      if (!sc || typeof sc.set !== "function") return false;
      __privateSet(this, _restoring, true);
      __privateSet(this, _prefs2, { ...__privateGet(this, _prefs2), [REMOVED_KEY]: false });
      __privateGet(this, _emit4).call(this);
      const run = typeof sc.unset === "function" ? () => sc.unset(REMOVED_KEY) : () => sc.set(REMOVED_KEY, false);
      Promise.resolve().then(run).then(() => __privateGet(this, _readBack).call(this, (snap) => snapValue(snap)[REMOVED_KEY] !== true)).then((ok) => {
        if (ok || __privateGet(this, _restoreWarned)) return;
        __privateSet(this, _restoreWarned, true);
        try {
        } catch (e) {
        }
      }).catch(() => {
      });
      return true;
    });
    /** 诊断快照：直接答「界面为什么是这个样子」。 */
    __publicField(this, "diagnose", () => {
      let why = WHY.visible;
      if (!__privateGet(this, _scope2) || typeof __privateGet(this, _scope2).set !== "function") why = WHY.noscope;
      else if (!__privateGet(this, _hid2) || typeof __privateGet(this, _hid2).subscribe !== "function") why = WHY.nodeps;
      else if (this.hidden) why = WHY.hidden;
      else if (this.removed && __privateGet(this, _open2)) why = WHY.connected;
      return {
        open: __privateGet(this, _open2),
        known: __privateGet(this, _seen),
        offline: isDeviceOffline({ known: __privateGet(this, _seen), open: __privateGet(this, _open2) }),
        removed: this.removed,
        hidden: this.hidden,
        canWrite: !!(__privateGet(this, _scope2) && typeof __privateGet(this, _scope2).set === "function"),
        restoring: __privateGet(this, _restoring),
        clearKeys: removeKeys(__privateGet(this, _defaults)),
        why
      };
    });
    __privateSet(this, _hid2, hid || null);
    if (defaults && typeof defaults === "object") __privateSet(this, _defaults, defaults);
  }
  /** 用户点过「移除」没有（只看已落盘/已读回的值）。 */
  get removed() {
    return __privateGet(this, _prefs2) && __privateGet(this, _prefs2)[REMOVED_KEY] === true;
  }
  /** 设备此刻连上没有（严格等 true）。 */
  get open() {
    return __privateGet(this, _open2);
  }
  /** 已经收到过宿主的状态帧没有（false = 还不知道设备在不在 → 界面一律按正常画）。 */
  get known() {
    return __privateGet(this, _seen);
  }
  /** 界面该不该收起来（判据在 utils/device.js）。 */
  get hidden() {
    return isDeviceHidden({ removed: this.removed, open: __privateGet(this, _open2) });
  }
}
_hid2 = new WeakMap();
_scope2 = new WeakMap();
_defaults = new WeakMap();
_prefs2 = new WeakMap();
_open2 = new WeakMap();
_seen = new WeakMap();
_off2 = new WeakMap();
_subs3 = new WeakMap();
_restoring = new WeakMap();
_restoreWarned = new WeakMap();
_emit4 = new WeakMap();
_onState2 = new WeakMap();
_snapshot = new WeakMap();
_readBack = new WeakMap();
_unset = new WeakMap();
_restore = new WeakMap();
const LEVEL_ROW_SEL = '[role="menuitemradio"]';
const MENU_ROW_SEL = '[role="menuitem"]';
const MENU_SEL = '[role="menu"]';
const TRIGGER_SEL = 'button[aria-haspopup="menu"]';
const REASONING_KW = /(推理等级|推理强度|推理|reasoning)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, budgetMs = 800, stepMs = 20) => {
  const end = Date.now() + budgetMs;
  for (; ; ) {
    let v = null;
    try {
      v = fn();
    } catch (e) {
    }
    if (v) return v;
    if (Date.now() >= end) return null;
    await sleep(stepMs);
  }
};
const levelRows = () => {
  if (typeof document === "undefined") return [];
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll(LEVEL_ROW_SEL));
  } catch (e) {
    return [];
  }
  return nodes.filter(nodeVisible);
};
const parseLevelFromLabel = (label) => {
  const m = /(?:推理等级|推理强度|推理|reasoning(?:\s*effort|\s*level)?)\s*[：:]?\s*([A-Za-z][A-Za-z0-9_-]*)/i.exec(String(label || ""));
  return m ? m[1] : null;
};
const findReasoningTrigger = () => {
  if (typeof document === "undefined") return null;
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll(TRIGGER_SEL));
  } catch (e) {
    return null;
  }
  const vis = nodes.filter(nodeVisible);
  return vis.find((el) => /推理|reasoning/i.test(ariaOf(el))) || vis.find((el) => /选择模型|模型|model/i.test(ariaOf(el))) || null;
};
const menuOpen = () => {
  try {
    return Array.from(document.querySelectorAll(MENU_SEL)).some(nodeVisible);
  } catch (e) {
    return false;
  }
};
const findLevelEntryRow = () => {
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll(MENU_ROW_SEL));
  } catch (e) {
    return null;
  }
  return nodes.filter(nodeVisible).find((el) => REASONING_KW.test(String(el.textContent || ""))) || null;
};
const openReasoningLevels = async () => {
  if (levelRows().length) return true;
  const trig = findReasoningTrigger();
  if (!trig) return false;
  if (!menuOpen()) {
    try {
      trig.click();
    } catch (e) {
      return false;
    }
    const shown = await until(() => menuOpen() && (levelRows().length > 0 || findLevelEntryRow()), 700);
    if (!shown) return false;
  }
  if (levelRows().length) return true;
  const row = findLevelEntryRow();
  if (!row) return false;
  try {
    row.click();
  } catch (e) {
    return false;
  }
  return await until(() => levelRows().length > 0, 800) !== null;
};
const closeReasoningLevels = () => {
  const trig = findReasoningTrigger();
  if (!trig) return false;
  try {
    trig.click();
    return true;
  } catch (e) {
    return false;
  }
};
const currentLevelIndex = (rows) => {
  const list = rows || levelRows();
  if (!list.length) return -1;
  const at = list.findIndex((el) => {
    try {
      return el.getAttribute("aria-checked") === "true";
    } catch (e) {
      return false;
    }
  });
  if (at !== -1) return at;
  const name = parseLevelFromLabel(ariaOf(findReasoningTrigger()));
  if (!name) return -1;
  return list.findIndex((el) => String(el.textContent || "").trim().toLowerCase() === name.toLowerCase());
};
let ringRow = null;
let ringAt = -1;
const ringClear = () => {
  ringRow = null;
  ringAt = -1;
  clearHighlight();
};
const ringForget = () => {
  ringRow = null;
  ringAt = -1;
};
const ringIndex = (list) => {
  if (!list || !list.length) return -1;
  if (ringRow) {
    const at = list.indexOf(ringRow);
    if (at !== -1) return at;
  }
  if (ringAt >= 0 && ringAt < list.length) return ringAt;
  const cur = currentLevelIndex(list);
  return cur === -1 ? 0 : cur;
};
const ringTo = (list, at) => {
  const rows = list && list.length ? list : levelRows();
  if (!rows.length) {
    ringClear();
    return false;
  }
  const i = Math.max(0, Math.min(rows.length - 1, at));
  ringRow = rows[i];
  ringAt = i;
  highlight(ringRow);
  return true;
};
const commitLevel = (row) => {
  if (!row) return false;
  try {
    row.click();
    return true;
  } catch (e) {
    return false;
  }
};
let opening = null;
const openLevels = () => {
  if (!opening) opening = openReasoningLevels().finally(() => {
    opening = null;
  });
  return opening;
};
let stepQueue = [];
let stepDraining = false;
const drainSteps = async () => {
  if (stepDraining) return;
  stepDraining = true;
  try {
    while (stepQueue.length) {
      const dir = stepQueue.shift();
      let list = levelRows();
      if (!list.length) {
        ringForget();
        const ok = await openLevels();
        if (!ok) {
          stepQueue.length = 0;
          break;
        }
        list = levelRows();
        ringTo(list, ringIndex(list));
        continue;
      }
      ringTo(list, ringIndex(list) + dir);
    }
  } finally {
    stepDraining = false;
  }
};
const reasoningStepDir = (dir) => {
  stepQueue.push(dir >= 0 ? 1 : -1);
  drainSteps();
};
const reasoningPressOnce = () => {
  stepQueue.length = 0;
  const list = levelRows();
  if (!list.length) {
    ringForget();
    openLevels().then((ok) => {
      if (ok) ringTo(levelRows(), ringIndex(levelRows()));
    });
    return;
  }
  const at = ringIndex(list);
  const cur = currentLevelIndex(list);
  if (at >= 0 && at !== cur) {
    commitLevel(list[at]);
    ringClear();
    return;
  }
  ringClear();
  closeReasoningLevels();
};
const sameRoute = (a, b) => !!a && !!b && a.provider === b.provider && a.model === b.model;
const modelReasoningOf = (state, selection) => {
  const sel = selection || null;
  if (!state || !sel) return void 0;
  if (typeof sel.provider !== "string" || !sel.provider) return void 0;
  if (typeof sel.model !== "string" || !sel.model) return void 0;
  const groups = Array.isArray(state.groups) ? state.groups : [];
  const group = groups.find((g) => g && g.id === sel.provider);
  const models = group && Array.isArray(group.models) ? group.models : [];
  const model = models.find((m) => m && m.id === sel.model);
  return model && model.reasoning || void 0;
};
const effortChoicesOf = (reasoning) => {
  if (!reasoning) return [];
  const efforts = Array.isArray(reasoning.efforts) ? reasoning.efforts : [];
  const head = reasoning.defaultEffort === void 0 ? [{ effort: void 0, name: null }] : [];
  return head.concat(
    efforts.filter((e) => e && typeof e.id === "string" && e.id).map((e) => ({ effort: e.id, name: typeof e.name === "string" && e.name ? e.name : e.id }))
  );
};
const effortEffectiveOf = (selection, reasoning) => {
  const explicit = selection ? selection.reasoningEffort : void 0;
  if (typeof explicit === "string" && explicit) return explicit;
  const dflt = reasoning ? reasoning.defaultEffort : void 0;
  return typeof dflt === "string" && dflt ? dflt : void 0;
};
const effortIndexOf = (choices, effort) => {
  const list = Array.isArray(choices) ? choices : [];
  return list.findIndex((c) => c.effort === effort);
};
const effortBaseOf = (state) => {
  const current = state && state.current ? state.current : null;
  if (!current) return null;
  const pending = state && state.pending ? state.pending : null;
  return pending && sameRoute(pending, current) ? pending : current;
};
const effortStepOf = (state, dir) => {
  const step = dir >= 0 ? 1 : -1;
  const base = effortBaseOf(state);
  if (!base) return { ok: false, why: "unknownModel" };
  const reasoning = modelReasoningOf(state, base);
  const choices = effortChoicesOf(reasoning);
  if (choices.length < 2) return { ok: false, why: "noReasoning", selection: base, choices };
  const effort = effortEffectiveOf(base, reasoning);
  const index = effortIndexOf(choices, effort);
  const at = index === -1 ? step > 0 ? -1 : choices.length : index;
  const to = at + step;
  if (to < 0) return { ok: false, why: "edgeBottom", selection: base, choices, index, effort };
  if (to >= choices.length) return { ok: false, why: "edgeTop", selection: base, choices, index, effort };
  const next = choices[to];
  const target = { provider: base.provider, model: base.model };
  if (next.effort !== void 0) target.reasoningEffort = next.effort;
  return {
    ok: true,
    target,
    choices,
    index,
    from: index === -1 ? null : choices[index],
    to: next
  };
};
const planActiveOf = (sessions, sessionId) => {
  if (!sessions || !sessionId) return null;
  try {
    const binding = typeof sessions.binding === "function" ? sessions.binding(sessionId) : null;
    const projections = binding && binding.session ? binding.session.projections : null;
    if (!projections) return null;
    let value;
    if (typeof projections.get === "function") value = projections.get("plan");
    else if (typeof projections.faceOf === "function") {
      const face = projections.faceOf("plan");
      value = face && typeof face.getSnapshot === "function" ? face.getSnapshot() : void 0;
    }
    if (!value || typeof value !== "object") return null;
    const active = value.active === true;
    const pending = value.pending === true;
    return pending ? !active : active;
  } catch (e) {
    return null;
  }
};
const currentSessionIdOf = (sessions) => {
  if (!sessions || !sessions.list) return null;
  try {
    return currentSessionIdIn(sessions.list.getSnapshot());
  } catch (e) {
    return null;
  }
};
const sessionScopeOf = (sessions, sid) => {
  if (!sessions || !sid) return void 0;
  try {
    return typeof sessions.scope === "function" ? sessions.scope(sid) : void 0;
  } catch (e) {
    return void 0;
  }
};
const sessionRowOf = (sessions, sid) => {
  if (!sessions || !sid || !sessions.list || typeof sessions.list.getSnapshot !== "function") return null;
  try {
    const snap = sessions.list.getSnapshot();
    const row = snap && snap.byId ? snap.byId[sid] : null;
    return row && typeof row === "object" ? row : null;
  } catch (e) {
    return null;
  }
};
const sessionCwdOf = (sessions, sid) => {
  const row = sessionRowOf(sessions, sid);
  const cwd = row && row.cwd;
  return typeof cwd === "string" && cwd ? cwd : null;
};
const agentPresetOf = (sessions, sid) => {
  if (!sessions || !sid) return void 0;
  const row = sessionRowOf(sessions, sid);
  const fromRow = row && row.projectionValues ? row.projectionValues.agentPreset : void 0;
  if (fromRow !== void 0) return fromRow;
  try {
    const binding = typeof sessions.binding === "function" ? sessions.binding(sid) : null;
    const projections = binding && binding.session ? binding.session.projections : null;
    if (!projections) return void 0;
    if (typeof projections.get === "function") return projections.get("agentPreset");
    if (typeof projections.faceOf === "function") {
      const face = projections.faceOf("agentPreset");
      return face && typeof face.getSnapshot === "function" ? face.getSnapshot() : void 0;
    }
  } catch (e) {
    return void 0;
  }
  return void 0;
};
const agentPresetStateOf = (sessions, sid) => {
  const unknown = { preset: null, blank: null };
  if (!sessions || !sid) return unknown;
  try {
    const row = sessionRowOf(sessions, sid);
    const value = agentPresetOf(sessions, sid);
    return {
      preset: typeof value === "string" && value ? value : null,
      blank: row && (row.blank === true || row.blank === false) ? row.blank : null
    };
  } catch (e) {
    return unknown;
  }
};
const agentPresetsChannelOf = (service) => {
  const take = (name) => {
    try {
      return service(name);
    } catch (e) {
      return void 0;
    }
  };
  const direct = take("remote.agentPresets");
  if (direct && typeof direct.list === "function") return direct;
  const remote = take("remote");
  if (remote && remote.agentPresets && typeof remote.agentPresets.list === "function") return remote.agentPresets;
  return null;
};
const nextPresetOf = (presets, currentId) => {
  const list = (Array.isArray(presets) ? presets : []).filter((p) => p && typeof p.id === "string" && p.id && !p.broken);
  if (list.length < 2) return null;
  const idx = list.findIndex((p) => p.id === currentId);
  return list[(idx + 1 + list.length) % list.length];
};
const archiveRefusalOf = (error) => {
  if (!error || typeof error !== "object") return null;
  const rpc = error.rpcError || error.cause && error.cause.rpcError || null;
  if (!rpc || rpc.code !== "workspace/session-active") return null;
  const details = rpc.details || {};
  const activity = details.activity;
  return { code: rpc.code, activity: typeof activity === "string" && activity ? activity : null };
};
const archiveFailureText = (error) => {
  const refusal = archiveRefusalOf(error);
  if (refusal) {
    const what = refusal.activity ? `（${refusal.activity}）` : "";
    return `归档被拒绝：当前会话还有活动在跑${what} —— 等它跑完再按，或到 DSH 侧边栏里用「停止并归档」`;
  }
  return `归档失败：${error && error.message || error}`;
};
const inputOf = (sessions, conversation) => {
  const sid = currentSessionIdOf(sessions);
  if (!sid || !conversation) return null;
  if (typeof conversation.input !== "object" || conversation.input === null) return null;
  if (typeof conversation.input.for !== "function") return null;
  const scope = sessionScopeOf(sessions, sid);
  if (scope === void 0) return null;
  try {
    return conversation.input.for(scope);
  } catch (e) {
    return null;
  }
};
const commandChannelOf = (service) => {
  const take = (name) => {
    try {
      return service(name);
    } catch (e) {
      return void 0;
    }
  };
  const direct = take("remote.commands");
  if (direct && typeof direct.execute === "function") return direct;
  const remote = take("remote");
  if (remote && remote.commands && typeof remote.commands.execute === "function") return remote.commands;
  return null;
};
const formatDraft = (before, text) => {
  const head = String(before == null ? "" : before);
  const tail = String(text == null ? "" : text);
  if (!tail) return head;
  const sep = head && !/[\s，。！？、；：,.!?;:]$/.test(head) ? " " : "";
  return head + sep + tail;
};
const GOAL_COMMAND = "/goal";
const goalDraft = (before) => {
  const head = String(before == null ? "" : before).trim();
  if (!head) return GOAL_COMMAND + " ";
  if (head.startsWith(GOAL_COMMAND)) return null;
  return GOAL_COMMAND + " " + head;
};
const pendingInteractionOf = (uiSession, sessionId) => {
  if (!uiSession || !sessionId) return null;
  const store = uiSession.pendingInteractions;
  if (!store || typeof store.getSnapshot !== "function") return null;
  let snap = null;
  try {
    snap = store.getSnapshot();
  } catch (e) {
    return null;
  }
  if (!snap) return null;
  try {
    if (typeof snap.get === "function") return snap.get(sessionId) || null;
    return snap[sessionId] || null;
  } catch (e) {
    return null;
  }
};
const planReviewOf = (pending) => {
  const questions = pending && pending.questions;
  if (!Array.isArray(questions) || questions.length !== 1) return null;
  const q2 = questions[0];
  const intent = q2 && q2.intent;
  if (!intent || intent.kind !== "plan-review" || q2.detail === void 0) return null;
  if (q2.multiSelect === true) return null;
  const options = Array.isArray(q2.options) ? q2.options : [];
  if (options.length > 2) return null;
  const approve = options.find((o) => o && o.label === intent.approve);
  if (!approve) return null;
  const decline = options.find((o) => o && o.label !== intent.approve);
  return { id: q2.id, question: q2.question, approve, ...decline ? { decline } : {} };
};
const answerFor = (pending, action) => {
  if (!pending || typeof pending.answer !== "function") return null;
  const approve = action === "approve";
  const kind = pending.kind || "approval";
  if (kind === "approval") return approve ? "allowed-once" : "rejected";
  if (kind === "plan-review") {
    const review = planReviewOf(pending);
    if (!review) return null;
    const opt = approve ? review.approve : review.decline;
    if (!opt || !opt.label) return null;
    return { answers: [{ id: review.id, selected: [opt.label] }] };
  }
  return null;
};
class DshOps {
  /**
   * @param options.sessions - ctx.sessions。
   * @param options.conversation - conversation 服务（拿 composer 输入机）。
   * @param options.services - (name) => service，取 ctx 上的跨插件服务（layout / remote.commands）。
   *                            别的客户端插件晚于本插件加载，所以取值必须延后到调用那一刻。
   * @param options.log - 记一行日志（默认 console.log 加 `[micro] ` 前缀）。
   */
  constructor(options = {}) {
    /** ctx.sessions（会话快照 / 投影）。 */
    __publicField(this, "sessions", null);
    /** ctx 上的 conversation 服务（composer 输入机的入口）。 */
    __publicField(this, "conversation", null);
    __privateAdd(this, _services2, () => void 0);
    __privateAdd(this, _log6, null);
    /** 「打开本插件设置页」的入口（entry.js 注入，见 openSettings）。 */
    __privateAdd(this, _openSettings, null);
    /** 「打开 DSH 通用设置」的入口（entry.js 注入，见 openGeneralSettings）。 */
    __privateAdd(this, _openGeneralSettings, null);
    /** composer 的输入动作（由对话输入区槽位组件在挂载时交给我们，见 bindComposer）。 */
    __privateAdd(this, _composer, null);
    /** 输入区导航的当前位置（环停在第几个候选上）。 */
    __privateAdd(this, _navIndex, -1);
    __privateAdd(this, _navList, []);
    /** 最近一次同步拦下来的失败：`{ reason, at }`（见 #deny / lastDeny）。 */
    __privateAdd(this, _lastDeny, null);
    __publicField(this, "log", (msg) => {
      __privateGet(this, _log6).call(this, msg);
    });
    __privateAdd(this, _service2, (name) => {
      try {
        return __privateGet(this, _services2).call(this, name);
      } catch (e) {
        return void 0;
      }
    });
    /**
     * 「这次没派出去，因为 …」——同步拦截点统一走它：**记一行日志**（照旧，查得出）
     * + 把原因记进 `#lastDeny`（看得见，由调用方决定显示到哪儿）。
     *
     * 为什么用「记下来」而不是「直接弹提示」：门面不知道是谁在按（按键 / 旋钮 / 摇杆 / 控制台），
     * 而用户的口径是「只做 act06-12 按键」——那是个**键码级**的判断，只有分派层（keypad.js）够得着。
     * 于是这里只负责「说出理由」，`lastDeny()` 让分派层紧接着读一次（见 keypad.js 的 #refuse）。
     * @param {string} reason - notice.js 的 NOTICE_REASON 里的 id。
     * @param {string} logText - 那一行日志（照旧是给人查的，比提示长）。
     */
    __privateAdd(this, _deny, (reason, logText) => {
      this.log(logText);
      try {
        __privateSet(this, _lastDeny, { reason, at: Date.now() });
      } catch (e) {
      }
    });
    /**
     * 最近一次「当前页面不能执行」的原因 —— `{ reason, at }`；从没失败过时 null。
     *
     * ⚠ **必须按对象身份比对**（分派层就是拿调用前后两次引用比「这次有没有新记一条」），
     * 所以每次 #deny 都新造一个对象，不要就地改字段。时间戳只是给人看的。
     */
    __publicField(this, "lastDeny", () => __privateGet(this, _lastDeny));
    // ---------------- 会话与输入机 ----------------
    /** 当前会话 id（sessions.list 快照的 current）。 */
    __publicField(this, "currentSessionId", () => currentSessionIdOf(this.sessions));
    /** 当前会话的 composer 输入机（拿不到返回 null，调用方各自决定降级方式）。 */
    __publicField(this, "input", () => inputOf(this.sessions, this.conversation));
    // ---------------- 输入机上的动作 ----------------
    /** 发送当前对话（输入机优先；拿不到输入机时退回「向聚焦元素派一次 Enter」）。 */
    __publicField(this, "send", () => {
      const input = this.input();
      if (input) {
        if (typeof input.submit === "function") {
          try {
            input.submit();
            return true;
          } catch (e) {
          }
        }
        if (typeof input.send === "function") {
          try {
            input.send();
            return true;
          } catch (e) {
          }
        }
      }
      return this.pressEnter();
    });
    /**
     * 清空当前输入框（「清空」键）—— **只动草稿，不碰已经发出去的消息**。
     *
     * 与 writeDraft 同一条取值链，只是写的是空串：composer 输入动作（槽位交给我们的那套，
     * 实机走它）优先 → 输入机自己的 `setDraft`。两条都没有就**出声**（不静默）：
     * 这条链路一旦断了，用户看到的是「按了删除、字还在」。
     *
     * ⚠ 走 setDraft 而不是直接改 DOM：composer 是 React 受控的，手改 textarea.value 只会让
     * 显示与状态分家（下一次渲染又变回来）。
     * @returns {boolean} 是否真的清掉了。
     */
    __publicField(this, "clearInput", () => {
      if (__privateGet(this, _setDraft).call(this, "")) return true;
      __privateGet(this, _deny).call(this, "noInput", "清空输入框失败：既没有 composer 输入动作，输入机也不提供 setDraft");
      return false;
    });
    /**
     * 删除当前输入框里的**一个字**（「删除」键）—— 每按一下从末尾少一个码点，连按就连删。
     *
     * 为什么读 DOM 草稿（`composerDraft()`）而不是读输入机：DSH 没有「读草稿」的服务面
     * （与 writeGoal 同一条理由，见 ./dom.js）。改完仍走 `#setDraft` 写回 —— composer 是
     * React 受控的，手改 textarea.value 只会让显示与状态分家（见 #setDraft 的注释）。
     *
     * 用 `Array.from` 切**码点**而不是 `slice(-1)`：后者按 UTF-16 码元切，会把 emoji（代理对）
     * 劈成半个字符，写回去是一个乱码方块。
     *
     * ⚠ **幂等**：草稿本来就是空的 → 直接返回 true，什么都不做、也不弹提示（这已经是要的结果）。
     * @returns {boolean} 是否（已经）删好了。
     */
    __publicField(this, "deleteChar", () => {
      const chars = Array.from(String(composerDraft() || ""));
      if (chars.length === 0) return true;
      if (__privateGet(this, _setDraft).call(this, chars.slice(0, -1).join(""))) return true;
      __privateGet(this, _deny).call(this, "noInput", "删除失败：既没有 composer 输入动作，输入机也不提供 setDraft");
      return false;
    });
    /**
     * 上传文件（「上传」键）：点一下输入栏里那个原生文件选择框，等同 DSH 输入框左下角
     * 「+ → 文件」。之后**上传、挂附件、进度全归 DSH 自己管**（我们只负责把框叫出来）。
     *
     * 为什么只能点 DOM：conversation 输入机上只有 `addAttachments(ids)`（收的是已经上传完的
     * 附件 id），「弹选择框 + 上传」这一段没有对外服务面（见 ./dom.js 的 composerFileInput）。
     * @returns {boolean} 是否真的点到了那个输入框。
     */
    __publicField(this, "pickUpload", () => {
      if (clickComposerFileInput()) return true;
      __privateGet(this, _deny).call(this, "noUpload", "上传失败：输入栏里那个原生文件选择框找不到（当前不是可输入附件的会话，或 DSH 改了输入栏结构）");
      return false;
    });
    // ---------------- 待确认交互（批准 / 拒绝两颗键） ----------------
    /**
     * 对当前会话的待确认交互做出回应（批准 / 拒绝）。
     *
     * ⚠ 这里曾经用 `input.approve()/reject()/respond()` —— **这一版 DSH 的输入机没有这些方法**
     * （`conversation.input.for(scope)` 拿到的是 SessionInputShell，只有 setDraft/submit/notify…），
     * 于是 APPR / REJ 两颗键按下去静默什么都不发生（用户报的正是这个）。现在走正式的那条路：
     * uiSession 服务的 `pendingInteractions` 快照 → 那条交互自己的 `answer()`（DSH 自己的审批面板
     * 与提问面板用的就是它）；三种 kind 的答案形状见 ./session.js 的 answerFor。
     * 服务拿不到时退回**界面兜底**（点面板上的按钮），仍然拿不到就如实记一行日志。
     *
     * @param {'approve'|'reject'} action
     * @returns {boolean} 是否真的把回应发出去了。
     */
    __publicField(this, "respond", (action) => {
      const approve = action === "approve";
      const pending = this.pendingInteraction();
      if (pending) {
        const payload = answerFor(pending, action);
        if (payload === null) {
          __privateGet(this, _deny).call(this, "panelOptions", `待确认交互是「${pending.kind || "?"}」：它要逐项作答，${approve ? "批准" : "拒绝"}键不替你选 —— 转旋钮选、按旋钮勾`);
          return false;
        }
        Promise.resolve().then(() => pending.answer(payload)).catch((e) => this.log(`回应待确认交互失败：${e && e.message || e}`));
        return true;
      }
      return __privateGet(this, _answerOnPanel).call(this, approve);
    });
    /** 当前会话挂着的待确认交互（审批 / 计划确认 / 提问）；没有或拿不到服务时 null。 */
    __publicField(this, "pendingInteraction", () => pendingInteractionOf(__privateGet(this, _service2).call(this, "uiSession"), this.currentSessionId()));
    /**
     * 界面兜底：直接点审批 / 计划确认面板上的按钮。
     *
     * 挑哪个按钮**先按文案**（「批准为批准或者下一步，拒绝为跳过」），文案认不出来才退回位置
     * （界面顺序恒为「否定在左、肯定在右」）。判据本体在 ./dom.js 的 pickPanelButton，
     * 面板怎么认（属性 → 文案成对）见同文件的 interactionPanelRoot。
     *
     * 只在服务拿不到时走这条路 —— 优先永远是 `pending.answer()`。
     */
    __privateAdd(this, _answerOnPanel, (approve) => {
      const btns = interactionPanelButtons();
      if (!btns.length) {
        __privateGet(this, _deny).call(this, "noPanel", `${approve ? "批准" : "拒绝"}失败：当前会话没有待确认的交互，也没在界面上找到审批 / 计划确认面板（若弹窗里只有**选项**，那要用旋钮：转着选、按下勾）`);
        return false;
      }
      const el = pickPanelButton(btns, approve);
      if (!el) {
        __privateGet(this, _deny).call(this, "noButton", `${approve ? "批准" : "拒绝"}失败：面板上找不到可点的按钮`);
        return false;
      }
      try {
        el.click();
        return true;
      } catch (e) {
        return false;
      }
    });
    // ---------------- 输入机上的动作（撤销 / 重做 / 输入框兜底） ----------------
    /**
     * 撤销 / 重做 = **composer 输入机的操作记录**（⌘Z / ⌘⇧Z 走的就是它）。
     * DSH 没有会话级的 undo，别在这里假装有：它撤销的是当前会话的**输入内容**（草稿），
     * 不是「上一条已发送的消息」。
     *
     * 三级链，**顺序不能换**：
     *   ① 输入机自己的 undo()/redo() —— 官方面，有就用。⚠ **这一版 SessionInputShell 没有这两个
     *      方法**（只有 setDraft / addAttachments / submit / notify / state），与 approve/reject
     *      那次一样：方法不存在就当没有，别指望它；
     *   ② execUndoCommand 走**原生编辑命令** —— textarea / input 自带的撤销栈只有这条路能驱动；
     *      它**回读**文本，真变了才算成，成了就返回、不再往下走（否则会撤两次）；
     *   ③ 合成 ⌘Z / ⌘⇧Z —— 只对自带历史实现的 JS 编辑器有效（见 ./dom.js 的说明）。
     *
     * 三条都没成时**如实回 false**：摇杆提示卡片会写「未生效」，而不是像从前那样假装成功
     * （2026-10-01 用户报「撤销 / 重做没实现」，就是卡在「输入机没有 + 兜底空转却回 true」上）。
     */
    __publicField(this, "undo", () => {
      const input = this.input();
      if (input && typeof input.undo === "function") {
        try {
          input.undo();
          return true;
        } catch (e) {
        }
      }
      if (execUndoCommand(false)) return true;
      return dispatchUndoChord(false);
    });
    __publicField(this, "redo", () => {
      const input = this.input();
      if (input && typeof input.redo === "function") {
        try {
          input.redo();
          return true;
        } catch (e) {
        }
      }
      if (execUndoCommand(true)) return true;
      return dispatchUndoChord(true);
    });
    /** 兜底：向当前聚焦元素派发一次 Enter（见 ./dom.js 的 dispatchEnter）。 */
    __publicField(this, "pressEnter", () => dispatchEnter());
    // ---------------- 把文本写回草稿（语音转写落盘用） ----------------
    /**
     * 绑定当前 composer 的输入动作（对话输入区槽位组件挂载时调用，卸载时传 null）。
     * 那套 inputActions 是 DSH 通过槽位 props 交给我们的，比自己去 DOM 里找输入框可靠。
     */
    __publicField(this, "bindComposer", (inputActions) => {
      __privateSet(this, _composer, inputActions || null);
    });
    /**
     * 把文本写进 composer 草稿。`before` 是开始转写前的草稿，两者之间的拼接规则见 session.js
     * 的 formatDraft。两条路：槽位给我们的 inputActions（实机走这条）→ 输入机自己的 setDraft。
     * @returns {boolean} 是否真的写进去了。
     */
    __publicField(this, "writeDraft", (before, text) => {
      const next = formatDraft(before, text);
      if (next === String(before == null ? "" : before)) return false;
      if (__privateGet(this, _setDraft).call(this, next)) return true;
      __privateGet(this, _deny).call(this, "noInput", "写回输入框失败：既没有 composer 输入动作，输入机也不提供 setDraft");
      return false;
    });
    /**
     * 把整段文本写进当前 composer 草稿（**整段覆盖**；要拼什么由调用方先算好）。
     *
     * 取值链**只有这一处**（清空 / 语音写回 / 目标命令三条路都走它）：
     *   ① 槽位交给我们的 composer 输入动作（对话输入区组件挂载时 bindComposer 交进来的，实机走这条）
     *   ② 输入机自己的 `setDraft`（conversation.input.for(scope)）
     * 两条都没有 → 返回 false，由调用方 `#deny` 说出原因（绝不静默）。
     *
     * ⚠ 为什么不直接改 DOM：composer 是 React 受控的，手改 textarea.value 只会让显示与状态分家
     * （下一次渲染又变回来），与 clearInput 那条注释同一个理由。
     * @returns {boolean} 是否真的写进去了。
     */
    __privateAdd(this, _setDraft, (text) => {
      const composer = __privateGet(this, _composer);
      if (composer && typeof composer.setDraft === "function") {
        try {
          composer.setDraft(text);
          return true;
        } catch (e) {
        }
      }
      const input = this.input();
      if (input && typeof input.setDraft === "function") {
        try {
          input.setDraft(text);
          return true;
        } catch (e) {
        }
      }
      return false;
    });
    /**
     * 把「目标」命令填进输入框（「目标」键）—— **只填不发**，光标停在命令后面等用户补内容。
     *
     * 三件事各只有一个判据，别在这儿再抄一遍：
     *   · 填什么 —— `goalDraft` 里写死的 `GOAL_COMMAND`（＝`/goal`，DSH 注册的就是这个名字；
     *               见 ./session.js 那一大段）。**不跟界面语言走**。
     *   · 怎么拼 —— `goalDraft(before)`：命令放**最前面**（slash 命令必须行首才被 DSH 认），
     *               用户已经打的字接在后面、一个字都不丢；
     *   · 里面已有什么 —— `composerDraft()`（DOM 真值，见 ./dom.js）—— DSH 没有「读草稿」的服务面。
     *
     * ⚠ 命令名**不跟界面语言走**：DSH 的命令名不本地化，中文界面里菜单上写着「目标」但命令仍是
     *   `/goal`。2026-10-01 用户报障「填进去了但 DSH 不认」就是原先按语言填 `/目标` 造成的。
     *
     * ⚠ **幂等**：草稿已经以这条命令开头时 `goalDraft` 回 null —— 这里返回 **true**（结果态已经
     *   是用户要的样子，不是失败），**不记 deny**。否则连按两下会弹一句「当前页面不能执行」，
     *   而实际上一切正常。
     * @returns {boolean} 是否（已经）填好了。
     */
    __publicField(this, "writeGoal", () => {
      const next = goalDraft(composerDraft());
      if (next === null) return true;
      if (__privateGet(this, _setDraft).call(this, next)) return true;
      __privateGet(this, _deny).call(this, "noInput", "填写目标失败：既没有 composer 输入动作，输入机也不提供 setDraft");
      return false;
    });
    // ---------------- 会话动作（归档 / 分叉 / 新建） ----------------
    /**
     * 归档当前会话。
     * ① 官方客户端服务 `uiWorkspace.archiveSession` —— DSH 侧边栏里那个「归档」动作走的就是它
     *    （会同时处理「归档的正好是当前会话 → 清掉当前选择」）。
     * ② 退路：宿主旁路路由 POST /micro/archive（宿主 workspaceRegistry.archiveSession；见 src/core/index.js）。
     *    它要求宿主重启过，所以只当兜底。
     *
     * ⚠ 失败必须**出声**：`archiveSession` 在「会话还有活动在跑」时会拒绝（`rpcError.code ===
     * 'workspace/session-active'`），DSH 自己的流程是弹确认框、用户点了才用 `{ stopActivity: true }`
     * 重试。本插件不替用户停活（不可逆），但要把拒绝说清楚 —— 否则表现就是「按了没反应」
     * （归档键「无法使用」的那次报障里，前半段是会话 id 取不到、后半段就是这个静默）。
     *
     * @returns {boolean} 是否真的派发出去（拿不到任何入口 → false + 一行日志）。
     */
    __publicField(this, "archive", () => {
      const sid = this.currentSessionId();
      if (!sid) {
        __privateGet(this, _deny).call(this, "noSession", "归档失败：认不出当前会话（快照里既没有 current，也没有被主视图持有的那条）");
        return false;
      }
      const ui = __privateGet(this, _service2).call(this, "uiWorkspace");
      if (ui && typeof ui.archiveSession === "function") {
        Promise.resolve().then(() => ui.archiveSession(sid)).catch((e) => this.log(archiveFailureText(e)));
        return true;
      }
      if (typeof fetch === "function") {
        fetch("/micro/archive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sid })
        }).then(
          (res) => {
            if (res && res.ok === false) this.log(`归档失败：宿主路由 /micro/archive 返回 ${res.status}`);
          },
          (e) => this.log(`归档失败：宿主路由 /micro/archive 不可达（${e && e.message || e}）`)
        );
        return true;
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到归档入口：既没有 uiWorkspace 服务，也不在浏览器环境里");
      return false;
    });
    /**
     * 分叉当前会话（用户要的 FORK 键）：从当前这条复制出一条新的分支会话，原会话保留。
     * ① `uiWorkspace.forkSession` —— DSH 会话菜单里「分叉会话」走的正是它（内部是
     *    `sessions.fork({ sessionId, increaseTitle: true })` + 打开子会话）。
     * ② 退路：没有 uiWorkspace 时自己走那两步（sessions.fork + 打开子会话）。
     *    打开子会话同样认官方入口 `uiWorkspace.openSession` —— `sessions.open` 在
     *    0.1.7-rc.2 已被删（见 agents.js openSlot 的注释），别再只认它。
     * @returns {boolean} 是否真的派发出去。
     */
    __publicField(this, "fork", () => {
      const sid = this.currentSessionId();
      if (!sid) {
        __privateGet(this, _deny).call(this, "noSession", "当前没有会话，无法分叉");
        return false;
      }
      const ui = __privateGet(this, _service2).call(this, "uiWorkspace");
      if (ui && typeof ui.forkSession === "function") {
        Promise.resolve().then(() => ui.forkSession(sid)).catch((e) => this.log(`分叉失败：${e && e.message || e}`));
        return true;
      }
      const sessions = this.sessions;
      if (sessions && typeof sessions.fork === "function") {
        Promise.resolve().then(() => sessions.fork({ sessionId: sid, increaseTitle: true })).then((childId) => {
          if (!childId) return;
          const openSession = ui && typeof ui.openSession === "function" ? (id) => ui.openSession(id) : typeof sessions.open === "function" ? (id) => sessions.open(id) : null;
          if (!openSession) {
            this.log(`分叉出的子会话没能打开（没有 uiWorkspace.openSession）：${childId}`);
            return;
          }
          openSession(childId);
        }).catch((e) => this.log(`分叉失败：${e && e.message || e}`));
        return true;
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到分叉入口：既没有 uiWorkspace.forkSession，sessions 也没有 fork");
      return false;
    });
    /**
     * 新建一个对话（「新建」键）。
     * 入口 = `uiWorkspace.startSession()`：官方契约是「Start a New Session flow and navigate to
     * its Session」，**不传 workspaceId 就继承当前（或最近用过的）工作区** —— 正是用户要的
     * 「在现在这个项目里开一条新的聊天」。宿主拒绝创建时会自己弹 Workspace 通知，并且**不动当前选择**，
     * 所以这里不额外兜底（我们没法比宿主说得更清楚）。
     *
     * 为什么不用 `connectWorkspace(workspaceId)`：它要一个 workspaceId，而「当前工作区 id」在
     * 会话快照上**没有稳定读法**（只有 cwd，不是 workspace 标识）；硬猜一个 id 传进去只会更脆弱。
     * @returns {boolean} 是否真的派发出去。
     */
    __publicField(this, "newSession", () => {
      const ui = __privateGet(this, _service2).call(this, "uiWorkspace");
      if (ui && typeof ui.startSession === "function") {
        try {
          ui.startSession();
          return true;
        } catch (e) {
          this.log(`新建会话失败：${e && e.message || e}`);
          return false;
        }
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到新建会话入口（ctx.uiWorkspace.startSession），忽略");
      return false;
    });
    /**
     * 压缩当前会话的上下文（「压缩」键）—— 走 DSH 自己的 `/compact` 命令
     * （人类可读命令，定义在 dsh-command-compact：`name: "compact"`、不带参数）。
     * 复用 /plan 那条命令通道（commandChannelOf，两个服务名都试）。
     * 宿主会在「正在压缩中 / 智能体不空闲 / 没有可压缩的历史」时拒绝，这些都带 message，如实转述。
     * @returns {boolean} 是否真的派发出去。
     */
    __publicField(this, "compact", () => {
      const sid = this.currentSessionId();
      if (!sid) {
        __privateGet(this, _deny).call(this, "noSession", "压缩失败：认不出当前会话");
        return false;
      }
      const commands = commandChannelOf(__privateGet(this, _services2));
      if (commands && typeof commands.execute === "function") {
        Promise.resolve().then(() => commands.execute(sid, "/compact", [])).then(
          (res) => {
            if (res && res.ok === false) {
              const err2 = res.error || {};
              this.log(`压缩失败 ${err2.code || ""} ${err2.message || ""}`.trim());
            }
          },
          (e) => this.log(`压缩调用异常：${e && e.message || e}`)
        );
        return true;
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到 /compact 命令通道（ctx.remote.commands），无法压缩");
      return false;
    });
    // ---------------- Agent 模式（预设循环） ----------------
    /**
     * 切换 Agent 模式（「模式」键，原来的 FAST/「保留」那一格）—— 在 Agent 预设之间循环。
     *
     * 三步，顺序不能反：
     *   ① 读当前会话绑定的预设（**会话列表快照那一行的** `projectionValues.agentPreset`）
     *      与 blank 标志（同一行的 `blank`）—— 见 session.js 的 agentPresetStateOf；
     *   ② 拿清单 `remote.agentPresets.list()` → 按环形规则算下一个（nextPresetOf，只挑没坏掉的）；
     *   ③ `remote.agentPresets.select(sid, nextId)`。
     *   ⚠ ①里那两个字段**不在** `binding.session` 上（那是个 ObservableSnapshot 源对象，只有
     *     `projections` 与 `getSnapshot()`）：2026-09-28 读错过一次，preset 恒为 null →
     *     每按一次都在算「清单第 0 个」→ 用户看到的是「模式键按了不换」（2026-09-29 修）。
     *
     * ⚠ **官方只允许在还没开跑的空会话（blank）上换预设**（select 对非 blank 会话直接不提交，
     *   见 dsh-client-ui-agent-preset 的 apply）。这一条必须**出声**：静默丢弃就是「按了没反应」。
     *   blank 读不到（null）时不挡 —— 乐观发一次，宿主拒绝的话它的 reason 会告诉我们。
     * @returns {boolean} 是否真的派发出去（清单取得晚，成功与否看日志）。
     */
    __publicField(this, "cycleAgentMode", () => {
      const sid = this.currentSessionId();
      if (!sid) {
        __privateGet(this, _deny).call(this, "noSession", "切换 Agent 模式失败：认不出当前会话");
        return false;
      }
      const state = agentPresetStateOf(this.sessions, sid);
      if (state.blank === false) {
        __privateGet(this, _deny).call(this, "sessionBusy", "切换 Agent 模式失败：这条会话已经开始跑了，DSH 不允许再换预设（新开一条会话再换）");
        return false;
      }
      const channel = agentPresetsChannelOf(__privateGet(this, _services2));
      if (!channel || typeof channel.select !== "function") {
        __privateGet(this, _deny).call(this, "noService", "拿不到 Agent 预设入口（ctx.remote.agentPresets），忽略");
        return false;
      }
      Promise.resolve().then(() => channel.list()).then((res) => {
        if (!res || res.ok === false) {
          const err2 = res && res.error || {};
          this.log(`切换 Agent 模式失败：取预设清单被拒 ${err2.code || ""} ${err2.message || ""}`.trim());
          return void 0;
        }
        const presets = res.value && res.value.presets || [];
        const next = nextPresetOf(presets, state.preset);
        if (!next) {
          this.log(`切换 Agent 模式：可用预设不足两个（当前 ${state.preset || "未知"}），没有可切换的对象`);
          return void 0;
        }
        return Promise.resolve(channel.select(sid, next.id)).then((r) => {
          if (r && r.ok === false) {
            const err2 = r.error || {};
            const details = err2.details || {};
            const reason = typeof details.reason === "string" ? details.reason : err2.message;
            this.log(`切换 Agent 模式到「${__privateGet(this, _presetName).call(this, next)}」被拒：${reason || "未知原因"}`);
          }
        });
      }).catch((e) => this.log(`切换 Agent 模式失败：${e && e.message || e}`));
      return true;
    });
    /** 「预设名（id）」用于日志：名字优先，退到 id。 */
    __privateAdd(this, _presetName, (preset) => String(preset && (preset.name || preset.id) || "?"));
    /**
     * 「模式」键的**只读诊断**：这一步按下去会发生什么，先问它。
     *
     * 为什么需要它：2026-09-29 用户报「模式键按了不换」——那种「按一下没反应」的事，
     * 光看界面分不清是「没读对当前预设」「清单是空的」「会话开跑了」还是「宿主拒绝」。
     * 这里把四个答案一次说清，而且**判据与 cycleAgentMode 同源**（同一对纯函数：
     * agentPresetStateOf / nextPresetOf），不另写一份「看起来一样」的逻辑。
     *
     * 控制台也能直接问：`await __dshMicro.services.ops.modeInfo()`；
     * 真机探针 npm run probe:mode 走的就是它（探针**不按键** —— ACT06 会真的换掉当前会话的预设）。
     * @returns {Promise<object>} { sessionId, preset, blank, hasChannel, failure, presets, next }
     *   preset/blank 为 null = 读不到；failure = 取清单被拒的原因；next = 下一个预设 id。
     */
    __publicField(this, "modeInfo", async () => {
      const sessionId = this.currentSessionId();
      const { preset, blank } = agentPresetStateOf(this.sessions, sessionId);
      const channel = agentPresetsChannelOf(__privateGet(this, _services2));
      let rows = null;
      let failure = null;
      if (channel && typeof channel.list === "function") {
        try {
          const res = await channel.list();
          if (res && res.ok === false) {
            const err2 = res.error || {};
            failure = String([err2.code, err2.message].filter(Boolean).join(" ")) || "被拒绝（没给原因）";
          } else {
            rows = (res && res.value && res.value.presets || []).map((p) => ({
              id: p.id,
              name: p.name || null,
              isDefault: p.isDefault === true,
              broken: p.broken || null
            }));
          }
        } catch (e) {
          failure = String(e && e.message || e);
        }
      }
      const next = rows ? nextPresetOf(rows, preset) : null;
      return {
        sessionId,
        preset,
        blank,
        hasChannel: !!channel,
        failure,
        presets: rows,
        next: next ? next.id : null
      };
    });
    // ---------------- 布局 ----------------
    /** 切换侧边栏：优先 layout 服务（官方跨插件面），服务缺失时退回点界面上的开关按钮。 */
    __publicField(this, "toggleSidebar", () => {
      const layout = __privateGet(this, _service2).call(this, "layout");
      if (layout && typeof layout.toggleSidebar === "function") {
        try {
          layout.toggleSidebar();
          return true;
        } catch (e) {
          this.log(`layout.toggleSidebar 异常：${e && e.message || e}`);
        }
      }
      const el = sidebarToggleEl();
      if (el) {
        try {
          el.click();
          return true;
        } catch (e) {
        }
      }
      __privateGet(this, _deny).call(this, "notAvailable", "拿不到 layout 服务，界面上也找不到侧边栏开关，忽略");
      return false;
    });
    /**
     * 打开本插件自己的设置页 —— **长按旋钮**的固定手势（见 registry 的 open_settings）。
     *
     * DSH 没给「打开某个设置分区」的接口（展开态与当前分区住在官方组件的内部 state，插件拿不到），
     * 所以真正的深链只能「点设置按钮 → 等导航渲染 → 点掉文字等于本分区标题的那一行」——
     * 那套判据在 components/sidebar/action.jsx 的 openKeyboardSettings，由 entry.js 注入到这里。
     * 好处是「设置页里那个按钮」和「长按旋钮」走的是**同一条**链路，不会一处能开一处打不开。
     *
     * 它是**异步**的（轮询等导航行，预算 ~1.2s）：这里只把「已经派出去」当成功 ——
     * 落空由那条链路自己 console.warn（我们不重复记一条，否则一次失败刷两行日志）。
     * @returns {boolean} 这次打开有没有真的派出去（拿不到注入 → false）。
     */
    __publicField(this, "openSettings", () => {
      if (!__privateGet(this, _openSettings)) {
        __privateGet(this, _deny).call(this, "notAvailable", "拿不到「打开设置页」的入口（entry.js 没注入 openSettings），忽略");
        return false;
      }
      try {
        const r = __privateGet(this, _openSettings).call(this);
        if (r && typeof r.then === "function") r.catch(() => {
        });
        return true;
      } catch (e) {
        this.log(`打开键盘设置页失败：${e && e.message || e}`);
        return false;
      }
    });
    /**
     * 打开 DSH 自己的**通用设置**页（键帽上那颗齿轮「设置」）。
     *
     * 与 openSettings 是**同一份深链实现**（action.jsx 的 openSection）：唯一的差别是目标分区 ——
     * 那边落到本插件分区（候选来自词典的 `nav`），这边落到导航第一项「通用」。
     * 所以两处的降级路径也一致：拿不到触发按钮 / 等不到导航行都在那条链路上 warn，这里不重复记。
     * @returns {boolean} 这次打开有没有真的派出去（拿不到注入 → false）。
     */
    __publicField(this, "openGeneralSettings", () => {
      if (!__privateGet(this, _openGeneralSettings)) {
        __privateGet(this, _deny).call(this, "notAvailable", "拿不到「打开通用设置」的入口（entry.js 没注入 openGeneralSettings），忽略");
        return false;
      }
      try {
        const r = __privateGet(this, _openGeneralSettings).call(this);
        if (r && typeof r.then === "function") r.catch(() => {
        });
        return true;
      } catch (e) {
        this.log(`打开通用设置失败：${e && e.message || e}`);
        return false;
      }
    });
    // ---------------- 官方面板与视图（终端 / 插件 / 文件夹） ----------------
    //
    // 这几件与上面的 toggleSidebar 同源：都是「让 DSH 自己把某个界面打开」，我们只负责按对那个入口。
    // 它们是**可选服务**（对应插件没装 / 服务没注册时拿不到）→ 一律如实出声，见各自的「拿不到…」分支。
    /**
     * 在右侧栏打开一个终端（「终端」键）。
     * 入口 = `ctx.sidebarRight.openTab('terminal')` —— DSH 自己那个「新建终端」走的就是它；
     * kind `"terminal"` 由 dsh-client-ui-sidebar-terminal 注册
     * （`sidebarRightTabs.register({ kind: 'terminal', multiple: true })`）。
     * 不指定 paneId：空着就落在当前活跃格，正是「点一下开一个终端」该有的位置。
     * @returns {boolean} 是否真的派发出去。
     */
    __publicField(this, "openTerminal", () => {
      const bar = __privateGet(this, _service2).call(this, "sidebarRight");
      if (bar && typeof bar.openTab === "function") {
        try {
          bar.openTab("terminal");
          return true;
        } catch (e) {
          this.log(`打开终端失败：${e && e.message || e}`);
          return false;
        }
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到终端入口（ctx.sidebarRight.openTab 不存在，或终端插件没装），忽略");
      return false;
    });
    /**
     * 打开 DSH 的插件管理页（「插件」键）—— 中央主面板。
     * 入口 = `ctx.layout.selectPanel('plugins')`：面板 id 就是 dsh-client-ui-plugin-manager 自己
     * 注册的 `PANEL_ID = "plugins"`，它自己的侧边栏入口也调这一条。`null` 表示回到对话
     * （这里传的是 id，所以是「切到插件页」）。
     * @returns {boolean} 是否真的派发出去。
     */
    __publicField(this, "openPlugins", () => {
      const layout = __privateGet(this, _service2).call(this, "layout");
      if (layout && typeof layout.selectPanel === "function") {
        try {
          layout.selectPanel("plugins");
          return true;
        } catch (e) {
          this.log(`打开插件管理页失败：${e && e.message || e}`);
          return false;
        }
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到中央面板入口（ctx.layout.selectPanel），忽略");
      return false;
    });
    /**
     * 在系统的文件管理器里打开当前会话的项目文件夹（「文件夹」键）。
     * 入口 = `ctx.remote.session.openWorkspacePath({ path })` —— dsh-client-ui-open-in-app 的
     * 「打开位置」走的就是它。**请求形状照抄它**：`action` 只有 `'reveal'` 一个值（在文件夹里
     * 选中该路径），省略 `action` 才是「用系统默认程序打开」；`signal` 那个参数官方自己也没传。
     * 路径取会话快照行上的 `cwd`（sessionCwdOf）—— 拿不到就出声，不去猜。
     * @returns {boolean} 是否真的派发出去。
     */
    __publicField(this, "openFolder", () => {
      const sid = this.currentSessionId();
      if (!sid) {
        __privateGet(this, _deny).call(this, "noSession", "打开项目文件夹失败：认不出当前会话");
        return false;
      }
      const cwd = sessionCwdOf(this.sessions, sid);
      if (!cwd) {
        __privateGet(this, _deny).call(this, "noCwd", "打开项目文件夹失败：这条会话没有记录项目目录（cwd）");
        return false;
      }
      const remote = __privateGet(this, _service2).call(this, "remote");
      const session = remote && remote.session;
      if (session && typeof session.openWorkspacePath === "function") {
        Promise.resolve().then(() => session.openWorkspacePath({ path: cwd })).then(
          (res) => {
            if (res && res.ok === false) this.log(`打开项目文件夹失败：宿主没能打开 ${cwd}`);
          },
          (e) => this.log(`打开项目文件夹失败：${e && e.message || e}`)
        );
        return true;
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到「打开位置」入口（ctx.remote.session.openWorkspacePath），忽略");
      return false;
    });
    // ---------------- 规划模式 ----------------
    /** 当前会话是否在规划模式（投影不可知时返回 null）。 */
    __publicField(this, "planActive", () => planActiveOf(this.sessions, this.currentSessionId()));
    /**
     * 切换规划模式：读会话的 `plan` 投影决定方向，再走 /plan 命令通道。
     * 没有命令通道时只降级为「关掉已经开着的规划模式」（点 plan chip）——进入必须靠命令。
     */
    __publicField(this, "togglePlan", () => {
      const sid = this.currentSessionId();
      if (!sid) {
        __privateGet(this, _deny).call(this, "noSession", "当前没有会话，无法切换规划模式");
        return false;
      }
      let active = planActiveOf(this.sessions, sid);
      if (active === null && planChipEl()) active = true;
      const line = active === true ? "/plan off" : "/plan";
      const commands = commandChannelOf(__privateGet(this, _services2));
      if (commands && typeof commands.execute === "function") {
        Promise.resolve().then(() => commands.execute(sid, line, [])).then(
          (res) => {
            if (res && res.ok === false) {
              const err2 = res.error || {};
              this.log(`${line} 失败 ${err2.code || ""} ${err2.message || ""}`.trim());
            }
          },
          (e) => this.log(`${line} 调用异常：${e && e.message || e}`)
        );
        return true;
      }
      const chip = planChipEl();
      if (chip) {
        try {
          chip.click();
          return true;
        } catch (e) {
        }
      }
      __privateGet(this, _deny).call(this, "noService", "拿不到 /plan 命令通道，无法切换规划模式");
      return false;
    });
    // ---------------- 对话滚动 ----------------
    /** 滚一步（dir < 0 向上）。 */
    __publicField(this, "scrollStep", (dir) => scrollStepDir(dir));
    /** 滚到当前对话底部。 */
    __publicField(this, "scrollToBottom", () => scrollToBottomDir());
    // ---------------- 输入区导航（自绘蓝环） ----------------
    /**
     * 转一步：把环移到下一个/上一个可聚焦控件上（跳过语音控件与文本输入框）。
     * 首次进入时从「当前环 → 当前聚焦元素 → 表头/表尾」依次找起点。
     * @returns {boolean} 是否找到了落脚点。
     */
    __publicField(this, "navStep", (dir) => {
      const d = dir >= 0 ? 1 : -1;
      const list = focusCollect();
      if (!list.length) {
        __privateSet(this, _navIndex, -1);
        __privateSet(this, _navList, []);
        clearHighlight();
        return false;
      }
      let idx = list.indexOf(document.querySelector("[data-micro-knob]"));
      if (idx === -1) idx = list.indexOf(document.activeElement);
      let next;
      if (idx === -1) next = d >= 0 ? list[0] : list[list.length - 1];
      else next = list[(idx + d + list.length) % list.length];
      __privateSet(this, _navIndex, list.indexOf(next));
      __privateSet(this, _navList, list);
      highlight(next);
      return true;
    });
    /** 按下：激活环停着的那个控件（click + focus）。 */
    __publicField(this, "navActivate", () => {
      const list = __privateGet(this, _navList).length ? __privateGet(this, _navList) : focusCollect();
      if (!list.length) return false;
      let idx = __privateGet(this, _navIndex);
      if (idx < 0 || idx >= list.length) idx = list.indexOf(document.querySelector("[data-micro-knob]"));
      if (idx < 0) idx = 0;
      const el = list[idx];
      if (!el) return false;
      try {
        if (typeof el.click === "function") el.click();
      } catch (e) {
      }
      try {
        el.focus();
      } catch (e) {
      }
      return true;
    });
    // ---------------- 推理：等级菜单（仅推理）／直接加减（推理±） ----------------
    //
    // 同一条「推理强度」的两条实现，**谁都不许替谁做决定**：
    //   reasoningStep / reasoningPress —— 靠界面：打开「模型 / 推理等级」菜单，环上/下移一档、按下确认。
    //                                    旋钮的「仅推理」模式走这条（用户要的就是「能看着选」）。
    //   reasoningAdjust              —— 靠服务：直接读目录、算下一档、select 落一次，**不开菜单**
    //                                    （「推理+ / 推理-」两颗键，用户 2026-09-29 的口径）。
    // 判据（等级列表 / 当前档 / 能不能再加）只有一份，在 ./effort.js；这里只负责「取服务 + 出声」。
    /** 转一档：菜单关着时这一转只打开菜单并把环落在当前档（见 ./reasoning.js 的交互契约）。 */
    __publicField(this, "reasoningStep", (dir) => {
      reasoningStepDir(dir);
      return true;
    });
    /** 按下：环在别的档 → 提交；环在当前档 → 只收菜单。 */
    __publicField(this, "reasoningPress", () => {
      reasoningPressOnce();
      return true;
    });
    /**
     * 推理强度直接升/降一档（「推理+ / 推理-」两颗键）—— **不打开等级菜单**。
     *
     * 用户 2026-09-29 的原话：「如果当前会话使用的模型可以选择推理强度, 不用打开选项, 直接加减,
     * 没有就提示不可用」。所以这条路只碰**服务**（`ctx.modelDirectories`），一个 DOM 都不摸：
     *   ① `directoryFor(sid)` 拿这条会话的模型目录（官方 `ModelSelect` 组件读的就是它，
     *      「/model 弹窗」与输入框那颗模型按钮共享同一份状态，所以这里改完，界面上的档位标签
     *      会自己跟着变）；
     *   ② 读它的**快照**（`store.getSnapshot()`）→ 交给 ./effort.js 的 effortStepOf 算下一档；
     *   ③ `directory.select({ provider, model, reasoningEffort? })` 落一次。
     *
     * **同步判定、异步落盘**，这一点是本方法的关键（也是为什么快照读不到时宁可拒绝）：
     * 「这颗键在当前页面做不了」的顶部提示是**同步**发出的（keypad.js 的 #refuse 在调用后立刻读
     * `lastDeny()`），所以能不能做必须在**返回之前**就知道。若把判定也塞进 Promise，失败就只能
     * 记日志 —— 用户那边又是「按了没反应」。因此：算不出下一档就当场 `#deny` 返回 false；
     * 只要派发出去了就返回 true，之后被宿主拒绝的（session/writer-held 之类）**只记日志**
     * （与本文件其它动作同一条规矩：派出去之后被拒的，DSH 自己会说话）。
     *
     * 出声的三种情况（都由分派层显示，见 notice.js）：
     *   `noReasoning`   这个模型没有可调的档（DSH 菜单里同样写着「当前模型未提供推理等级」）；
     *   `reasoningTop` / `reasoningBottom`  已经在最高/最低档（**不绕圈**，与蓝环的夹边一致）；
     *   `notAvailable`  连「当前用的是哪个模型」都读不到（目录还没加载完）——日志里写明是哪一种。
     * 走不下去的还有两种「拿不到入口」，各自有自己的原因 id：没有当前会话 → `noSession`，
     * 拿不到模型目录服务 → `noService`（model-selection 插件没装）。
     * @param {number} dir 正数 = 升一档，负数 = 降一档（只看符号）。
     * @returns {boolean} 是否真的把选择派发给了宿主（成功与否看日志 / `effortInfo()`）。
     */
    __publicField(this, "reasoningAdjust", (dir) => {
      const step = dir >= 0 ? 1 : -1;
      const sid = this.currentSessionId();
      if (!sid) {
        __privateGet(this, _deny).call(this, "noSession", "调整推理强度失败：认不出当前会话");
        return false;
      }
      const resolver = __privateGet(this, _service2).call(this, "modelDirectories");
      if (!resolver || typeof resolver.directoryFor !== "function") {
        __privateGet(this, _deny).call(this, "noService", "拿不到模型选择服务（ctx.modelDirectories），忽略");
        return false;
      }
      let directory = null;
      try {
        directory = resolver.directoryFor(sid);
      } catch (e) {
        __privateGet(this, _deny).call(this, "noService", `拿不到这条会话的模型目录：${e && e.message || e}`);
        return false;
      }
      const store = directory ? directory.store : null;
      if (!store || typeof store.getSnapshot !== "function" || typeof directory.select !== "function") {
        __privateGet(this, _deny).call(this, "noService", "模型目录缺少快照或 select，忽略");
        return false;
      }
      let state = null;
      try {
        state = store.getSnapshot();
      } catch (e) {
        state = null;
      }
      const plan = effortStepOf(state, step);
      if (!plan.ok) {
        if (plan.why === "edgeTop") __privateGet(this, _deny).call(this, "reasoningTop", "调整推理强度：已经在最高一档，忽略");
        else if (plan.why === "edgeBottom") __privateGet(this, _deny).call(this, "reasoningBottom", "调整推理强度：已经在最低一档，忽略");
        else if (plan.why === "noReasoning") {
          __privateGet(this, _deny).call(this, "noReasoning", `调整推理强度：当前模型没有可调的推理等级（${__privateGet(this, _routeName).call(this, (state || {}).current)}）`);
        } else {
          __privateGet(this, _deny).call(this, "notAvailable", `调整推理强度失败：读不到当前模型（目录还没加载好？status=${(state || {}).status}）`);
        }
        return false;
      }
      const target = plan.target;
      let pending = null;
      try {
        pending = directory.select(target);
      } catch (e) {
        __privateGet(this, _deny).call(this, "noService", `提交推理强度失败：${e && e.message || e}`);
        return false;
      }
      Promise.resolve(pending).then((r) => {
        if (r && r.ok === false) {
          const err2 = r.error || {};
          const reason = [err2.code, err2.message].filter(Boolean).join(" ") || "未知原因";
          this.log(`调整推理强度到「${plan.to.effort || "默认"}」被拒：${reason}`);
        }
      }).catch((e) => this.log(`调整推理强度失败：${e && e.message || e}`));
      return true;
    });
    /** 「provider/model」用于日志（读不到时给一个明确说法的占位，不写 undefined）。 */
    __privateAdd(this, _routeName, (selection) => {
      const p = selection && selection.provider;
      const m = selection && selection.model;
      return typeof p === "string" && p && typeof m === "string" && m ? `${p}/${m}` : "未知模型";
    });
    /**
     * 「推理±」的**只读诊断**：这颗键现在按下去会发生什么，先问它（同 `modeInfo` 的做法）。
     *
     * 为什么需要它：这台设备上的「按了没变化」有三种完全不同的来源 —— ①服务没装上；
     * ②目录里压根没有当前模型（还没加载完 / 这个部署没配）；③模型在、但它没有可调的档。
     * 光看界面分不清，而这两颗键**会真的改设置**（所以探针不该盲按）。
     *
     * 判据与 reasoningAdjust **同源**（同一对纯函数：effortBaseOf / effortStepOf），这里不许再算一遍。
     * 控制台：`await __dshMicro.services.ops.effortInfo()`；真机探针：`npm run probe:effort`。
     * ⚠ 唯一的副作用：`directoryFor()` 会像官方那条路一样给这条会话**惰性建**一个模型目录
     *   （DSH 自己的模型按钮挂载时也这么做），所以这是「官方入口同款」，不是我们另开门路。
     * @returns {Promise<object>} { sessionId, hasService, failure, status, current, pending, routable,
     *   reasoning, choices, index, effective, nextUp, nextDown } —— nextUp/nextDown 为
     *   `✗ <why>` 时表示按那颗键不会改档（why 见 effortStepOf）。
     */
    __publicField(this, "effortInfo", async () => {
      const sessionId = this.currentSessionId();
      const resolver = __privateGet(this, _service2).call(this, "modelDirectories");
      const out = {
        sessionId,
        hasService: !!(resolver && typeof resolver.directoryFor === "function"),
        failure: null,
        status: null,
        current: null,
        pending: null,
        routable: null,
        reasoning: null,
        choices: [],
        index: -1,
        effective: null,
        nextUp: null,
        nextDown: null
      };
      if (!out.hasService) {
        out.failure = "拿不到 ctx.modelDirectories（model-selection 插件没装？）";
        return out;
      }
      if (!sessionId) {
        out.failure = "认不出当前会话";
        return out;
      }
      let directory = null;
      try {
        directory = resolver.directoryFor(sessionId);
      } catch (e) {
        out.failure = `拿不到模型目录：${e && e.message || e}`;
        return out;
      }
      let state = null;
      try {
        state = directory.store.getSnapshot();
      } catch (e) {
        state = null;
      }
      if (!state) {
        out.failure = "目录快照读不出来";
        return out;
      }
      const base = effortBaseOf(state);
      const reasoning = modelReasoningOf(state, base);
      out.status = state.status;
      out.current = state.current || null;
      out.pending = state.pending || null;
      out.routable = state.routable === void 0 ? null : state.routable;
      out.reasoning = reasoning ? { defaultEffort: reasoning.defaultEffort || null, efforts: (reasoning.efforts || []).map((e) => ({ id: e.id, name: e.name })) } : null;
      const choices = effortChoicesOf(reasoning);
      const effective = effortEffectiveOf(base, reasoning);
      out.choices = choices.map((c) => ({ effort: c.effort === void 0 ? null : c.effort, name: c.name }));
      out.effective = effective === void 0 ? null : effective;
      out.index = effortIndexOf(choices, effective);
      const brief = (p) => p.ok ? p.to.effort === void 0 ? "（Provider 默认）" : p.to.effort : `✗ ${p.why}`;
      out.nextUp = brief(effortStepOf(state, 1));
      out.nextDown = brief(effortStepOf(state, -1));
      return out;
    });
    const o = options || {};
    this.sessions = o.sessions || null;
    this.conversation = o.conversation || null;
    __privateSet(this, _services2, typeof o.services === "function" ? o.services : () => void 0);
    __privateSet(this, _log6, typeof o.log === "function" ? o.log : (msg) => {
      try {
      } catch (e) {
      }
    });
    __privateSet(this, _openSettings, typeof o.openSettings === "function" ? o.openSettings : null);
    __privateSet(this, _openGeneralSettings, typeof o.openGeneralSettings === "function" ? o.openGeneralSettings : null);
  }
}
_services2 = new WeakMap();
_log6 = new WeakMap();
_openSettings = new WeakMap();
_openGeneralSettings = new WeakMap();
_composer = new WeakMap();
_navIndex = new WeakMap();
_navList = new WeakMap();
_lastDeny = new WeakMap();
_service2 = new WeakMap();
_deny = new WeakMap();
_answerOnPanel = new WeakMap();
_setDraft = new WeakMap();
_presetName = new WeakMap();
_routeName = new WeakMap();
const OFFICIAL_POLL_MS = 1200;
const VoiceInputButton = ({ input, inputActions }) => {
  const controller = DSVI.services ? DSVI.services.voice : null;
  const [state, setState] = React.useState({
    listening: !!(controller && controller.listening),
    unsupported: !!(controller && controller.unsupported)
  });
  const [official, setOfficial] = React.useState(() => officialVoiceReady());
  React.useEffect(() => {
    if (!controller) return void 0;
    return controller.subscribe(() => {
      setState({ listening: controller.listening, unsupported: controller.unsupported });
    });
  }, [controller]);
  React.useEffect(() => {
    if (typeof document === "undefined") return void 0;
    setOfficial(officialVoiceReady());
    const id = setInterval(() => setOfficial(officialVoiceReady()), OFFICIAL_POLL_MS);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    if (!controller) return void 0;
    controller.setCommit((before, text) => {
      const ops = DSVI.services ? DSVI.services.ops : null;
      if (ops) {
        ops.writeDraft(before, text);
        return;
      }
      if (inputActions && typeof inputActions.setDraft === "function") inputActions.setDraft(formatDraft(before, text));
    });
    return () => {
      controller.setCommit(null);
    };
  }, [inputActions, controller]);
  React.useEffect(() => {
    const ops = DSVI.services ? DSVI.services.ops : null;
    if (!ops) return void 0;
    ops.bindComposer(inputActions);
    return () => {
      ops.bindComposer(null);
    };
  }, [inputActions]);
  React.useEffect(() => () => {
    if (controller) controller.stop();
  }, [controller]);
  const start = React.useCallback(() => {
    if (controller) controller.start();
  }, [controller]);
  const onClick = () => {
    if (!controller) return;
    if (controller.listening) controller.stop();
    else start();
  };
  if (official) return null;
  const title = controller && controller.unsupported ? "当前浏览器不支持语音识别，请使用 Chrome / Edge" : controller && controller.listening ? "停止聆听" : "语音输入";
  return /* @__PURE__ */ jsxRuntime.jsx(
    "button",
    {
      type: "button",
      className: "dsvi-btn",
      "aria-label": title,
      title,
      "aria-pressed": controller ? controller.listening : false,
      "data-active": controller && controller.listening || void 0,
      onClick,
      disabled: !controller,
      children: MicIcon(controller && controller.listening ? 18 : 16)
    }
  );
};
const NAV_MARK = "data-micro-navicon";
const NAV_ICON_SEL = "svg.dshp-settings-nav-icon";
const NAV_SIDE_SEL = `[data-slot-sidebar="dsh-tauri-ui"], ${SETTINGS_OUTLET_SEL}`;
const NAV_ICON_SIZE = 16;
const svgOf = (row) => {
  try {
    return row.querySelector("svg[" + NAV_MARK + "]");
  } catch (e) {
    return null;
  }
};
let rowHidden = false;
let hiddenRow = null;
let reapply = null;
let retries = [];
let guard = null;
let warnedMissing = false;
const HIDE_RETRY_MS = [150, 600];
const HIDE_GUARD_MS = 1500;
const ROW_SEL = 'button, [role="button"], a';
const warn = (msg) => {
  try {
  } catch (e) {
  }
};
const restoreRow = () => {
  if (!hiddenRow) return;
  try {
    hiddenRow.style.display = "";
  } catch (e) {
  }
  hiddenRow = null;
};
const sideHostPresent = () => {
  try {
    const outlet = document.querySelector(SETTINGS_OUTLET_SEL);
    if (outlet) {
      const btn = outlet.querySelector(SETTINGS_TRIGGER_SEL);
      if (!btn) return true;
      const exp = btn.getAttribute("aria-expanded");
      if (exp !== "false") return true;
      return navOnPage();
    }
    if (document.querySelector(NAV_SIDE_SEL)) return true;
    return true;
  } catch (e) {
    return true;
  }
};
const navOnPage = () => {
  try {
    return !!document.querySelector(NAV_SCOPE_SEL);
  } catch (e) {
    return false;
  }
};
const settingsNavPresent = () => {
  try {
    for (const d of document.querySelectorAll('[role="dialog"]') || []) {
      try {
        if (d.querySelector("nav")) return true;
      } catch (e) {
      }
    }
  } catch (e) {
  }
  return false;
};
const findOurRow = (labels) => {
  try {
    const mine = document.querySelector("svg[" + NAV_MARK + "]");
    for (let node = mine; node; node = node.parentElement) {
      try {
        if (typeof node.matches === "function" && node.matches(ROW_SEL)) return node;
      } catch (e) {
      }
    }
  } catch (e) {
  }
  try {
    return findSectionRow(labels, [document]);
  } catch (e) {
    return null;
  }
};
const clearPending = () => {
  while (retries.length) {
    const t = retries.pop();
    try {
      clearTimeout(t);
    } catch (e) {
    }
  }
  if (guard) {
    try {
      clearInterval(guard);
    } catch (e) {
    }
    guard = null;
  }
};
const applyHidden = () => {
  try {
    if (reapply) reapply(true);
  } catch (e) {
  }
};
const armHideGuard = () => {
  for (const ms of HIDE_RETRY_MS) {
    try {
      retries.push(setTimeout(() => {
        if (rowHidden) applyHidden();
      }, ms));
    } catch (e) {
    }
  }
  try {
    guard = setInterval(() => {
      if (rowHidden) applyHidden();
    }, HIDE_GUARD_MS);
    if (guard && typeof guard.unref === "function") guard.unref();
  } catch (e) {
    guard = null;
  }
};
const setNavRowHidden = (on) => {
  const next = !!on;
  const changed = next !== rowHidden;
  rowHidden = next;
  clearPending();
  if (!next) {
    restoreRow();
    warnedMissing = false;
    return rowHidden;
  }
  applyHidden();
  if (changed) armHideGuard();
  return rowHidden;
};
const navRowHidden = () => rowHidden;
const navRowStatus = () => ({
  hidden: rowHidden,
  row: !!hiddenRow,
  applied: !!(hiddenRow && hiddenRow.style && hiddenRow.style.display === "none"),
  guard: !!guard,
  retries: retries.length,
  warned: warnedMissing
});
const patchNavIcon = (labels, size = 16) => {
  if (typeof document === "undefined") return false;
  const row = findOurRow(labels);
  if (!row) {
    if (rowHidden && !warnedMissing && settingsNavPresent()) {
      warnedMissing = true;
      warn("设置弹窗开着，却找不到导航里本分区那一行 —— 「移除」之后那一项会留在菜单里。多半是 DSH 又换了导航行的写法，或我们插的图标没打上（见 sidebar.js 头部）。");
    }
    return false;
  }
  if (rowHidden) {
    if (hiddenRow && hiddenRow !== row) restoreRow();
    hiddenRow = row;
    try {
      row.style.display = "none";
    } catch (e) {
    }
    return false;
  }
  restoreRow();
  if (svgOf(row)) return false;
  try {
    const original = row.querySelector(NAV_ICON_SEL) || row.querySelector("svg");
    if (original) original.style.display = "none";
    const html = keypadIconHTML(size, `class="dshp-settings-nav-icon" ${NAV_MARK}="1" aria-hidden="true"`);
    if (original) original.insertAdjacentHTML("afterend", html);
    else row.insertAdjacentHTML("afterbegin", html);
    return true;
  } catch (e) {
    return false;
  }
};
const installNavIconPatch = (opts = {}) => {
  if (typeof document === "undefined") return () => {
  };
  const size = Number.isFinite(opts.size) ? opts.size : 16;
  const labels = Array.isArray(opts.labels) && opts.labels.length ? opts.labels : candidateLabels();
  let alive = true;
  let scheduled = false;
  const run = (force) => {
    scheduled = false;
    if (!alive) return;
    if (!force && !rowHidden) {
      if (!sideHostPresent()) return;
    }
    patchNavIcon(labels, size);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => run(), 0);
  };
  let observer = null;
  try {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    observer = null;
  }
  run();
  reapply = run;
  DSVI.navIcon = {
    labels,
    size,
    patch: () => patchNavIcon(labels, size),
    findRow: () => findOurRow(labels),
    hidden: navRowHidden,
    setHidden: setNavRowHidden,
    status: navRowStatus,
    // 短路判据的诊断面（2026-09-30 新增）：真机上「图标为什么还是齿轮」只看这两个。
    // `sideHost()` = false 就是「短路认为弹窗关着，于是补图标被跳过了」—— 那种失效是完全静默的，
    // 所以必须能在控制台/探针里读到，不能只靠读源码猜。
    sideHost: sideHostPresent,
    sideHostSels: NAV_SIDE_SEL
  };
  return () => {
    alive = false;
    if (reapply === run) reapply = null;
    clearPending();
    rowHidden = false;
    restoreRow();
    try {
      if (observer) observer.disconnect();
    } catch (e) {
    }
  };
};
DSVI.patchNavIcon = patchNavIcon;
DSVI.installNavIconPatch = installNavIconPatch;
DSVI.setNavRowHidden = setNavRowHidden;
DSVI.navRowHidden = navRowHidden;
DSVI.navRowStatus = navRowStatus;
const hudCss = '/* dsh-micro · assets/hud.css —— 摇杆提示卡片（会话界面顶部居中）的样式\n *\n * 结构见 ../joystick-hud.js：#ensure() 建的节点树与这里的类名一一对应：\n *   .micro-joyhud              固定层（根，data-status / data-dir 供探针与状态色用）\n *     ├ __pad                方向盘外圈（含四向暗刻度，靠两层渐变画，不额外造节点）\n *     │  └ __dot             跟着推力走的蓝点\n *     └ __body               右侧三行 + 进度条\n *        ├ __dir（__arrow + __dirtext）\n *        ├ __action\n *        ├ __status（__mark + __statustext）\n *        └ __bar > __fill\n *\n * 三条硬约束：\n *   ① **它只是通知**：pointer-events:none + 不参与布局（position:fixed），绝不挡住底下的任何点击；\n *   ② 颜色全走 DSH 令牌（浅色/深色自成一套），只有兜底值才是写死的浅色；\n *   ③ `[hidden]` 必须自己写一条 display:none —— 本文件给根节点设了 display:flex，\n *      作者样式会盖掉浏览器默认的 `[hidden]{display:none}`，漏了这条卡片就永远收不起来。\n */\n.micro-joyhud{\n  --micro-hud-accent:var(--dsw-alias-brand-primary,#2f6fed);\n  position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10045;\n  display:flex;align-items:center;gap:12px;\n  min-width:206px;max-width:min(320px,80vw);padding:10px 16px 11px 12px;\n  border-radius:16px;background:var(--dsw-alias-bg-layer-1,#fff);\n  border:1px solid var(--dsw-alias-border-l2,rgba(47,111,237,.28));\n  box-shadow:0 12px 30px rgba(15,18,25,.14),0 2px 6px rgba(15,18,25,.08);\n  pointer-events:none;animation:micro_joyhud_in .16s ease-out;\n}\n/* 别删：见文件头 ③。 */\n.micro-joyhud[hidden]{display:none}\n/* 没成的那几种，整张卡片的强调色跟着收灰 / 转红（点、状态行、进度条都读 --micro-hud-accent）。 */\n.micro-joyhud[data-status="unbound"],.micro-joyhud[data-status="unwired"]{--micro-hud-accent:var(--dsw-alias-label-tertiary,#9aa3b2)}\n.micro-joyhud[data-status="failed"]{--micro-hud-accent:var(--dsw-alias-state-error-primary,#dc2626)}\n\n/* 方向盘：正圆外圈 + 四向暗刻度（两条渐变各画一条十字线，中心留空） */\n.micro-joyhud__pad{\n  position:relative;flex:none;width:44px;height:44px;border-radius:50%;\n  border:1px solid var(--dsw-alias-border-l2,rgba(47,111,237,.35));\n  background:\n    linear-gradient(to right,transparent 0 46%,var(--dsw-alias-border-l2,rgba(47,111,237,.22)) 46% 54%,transparent 54% 100%) center/100% 9px no-repeat,\n    linear-gradient(to bottom,transparent 0 46%,var(--dsw-alias-border-l2,rgba(47,111,237,.22)) 46% 54%,transparent 54% 100%) center/9px 100% no-repeat;\n}\n.micro-joyhud__dot{\n  position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;\n  background:var(--micro-hud-accent);transition:transform .08s linear;\n}\n.micro-joyhud__body{display:flex;flex-direction:column;gap:2px;min-width:0}\n.micro-joyhud__dir{display:flex;align-items:center;gap:6px;font-size:12px;line-height:1.3;color:var(--dsw-alias-label-tertiary,#8b95a7)}\n.micro-joyhud__arrow{font-size:13px;line-height:1}\n.micro-joyhud__action{font-size:14px;font-weight:600;line-height:1.35;color:var(--dsw-alias-label-primary,#1f2937);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.micro-joyhud__status{display:flex;align-items:center;gap:5px;font-size:13px;line-height:1.3;color:var(--micro-hud-accent)}\n.micro-joyhud__mark{font-size:12px;line-height:1}\n.micro-joyhud__bar{display:block;width:34px;height:3px;margin-top:3px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover,rgba(47,111,237,.14));overflow:hidden}\n/* 停留多久就走多久：时长由 joystick-hud.js 写成 inline animation-duration。\n   卡片是从 display:none 切回来的，所以每次显示都会重新起一次动画（这就是「续命」的机制）。 */\n.micro-joyhud__fill{display:block;width:100%;height:100%;border-radius:999px;background:var(--micro-hud-accent);transform-origin:left center;animation:micro_joyhud_linger linear forwards}\n@keyframes micro_joyhud_in{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}\n@keyframes micro_joyhud_linger{from{transform:scaleX(1)}to{transform:scaleX(0)}}\n@media (prefers-reduced-motion:reduce){\n  .micro-joyhud{animation:none}\n  .micro-joyhud__fill{animation:none}\n  .micro-joyhud__dot{transition:none}\n}\n';
const noticeCss = "/* dsh-micro · client/assets/notice.css\n * 「当前页面不能执行」的顶部浮动提示（渲染者：notice.js 的 MicroNotice，纯 DOM）。\n *\n * 形状照用户 2026-09-28 给的那张截图：**圆角矩形卡片 + 左侧圆形实底图标 + 一行文案**，\n * 浮在界面之上、不占布局。它是「你刚按的那颗键没生效」的跨页面通知，所以：\n *   1) position:fixed —— 绝不参与任何页面的布局（按键失败不该把界面顶动一行）；\n *   2) z-index 高于本插件自己的弹窗遮罩（.micro-modal-overlay 9999 / 二级 10002）\n *      与另两条顶部提示（摇杆卡片 10045 / 保存提示 10050）—— 它最要紧，允许盖在上面；\n *   3) pointer-events:none —— 通知不是控件，绝不挡住底下的点击；\n *   4) 颜色全走 DSH 主题令牌：浅色/深色主题自动跟随，不写死背景与文字色。\n *\n * 与保存提示（save.jsx / settings.css 的 .micro-toast）**有意不同形**：\n * 那条是胶囊、只在设置页出现；这条是卡片、任意页面都可能出现。两处都顶部正中，\n * 所以位置撞上时靠 z-index 分先后（同一拍里两条提示也会各自去重，见 notice.js）。\n */\n.micro-notice {\n  position: fixed;\n  top: 14px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 10060;\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  max-width: 76vw;\n  padding: 12px 18px 12px 14px;\n  border-radius: 14px;\n  background: var(--dsw-alias-bg-layer-1, #fff);\n  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));\n  box-shadow: 0 12px 30px rgba(15, 18, 25, 0.16), 0 2px 8px rgba(15, 18, 25, 0.08);\n  font-size: 14px;\n  font-weight: 500;\n  line-height: 1.4;\n  color: var(--dsw-alias-label-primary, #111);\n  pointer-events: none;\n  animation: micro_notice_in 0.18s ease-out;\n}\n\n/* 圆形实底图标：颜色就是「这是没做成」的语义色（警示橙；拿不到令牌时退到琥珀）。\n * 图标内部的白色符号写在 NOTICE_ICON 里（fill=currentColor 跟随这里的 color）。 */\n.micro-notice__ico {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: none;\n  width: 20px;\n  height: 20px;\n  color: var(--dsw-alias-state-warning-primary, #d97706);\n}\n\n/* 文案一行；太长就省略号（卡片最宽 76vw，正常一句话远远到不了）。 */\n.micro-notice__text {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n@keyframes micro_notice_in {\n  from { opacity: 0; transform: translate(-50%, -10px); }\n  to { opacity: 1; transform: translate(-50%, 0); }\n}\n\n/* 系统开了「减弱动态效果」时不播入场动画（与设置页那两条提示一致）。 */\n@media (prefers-reduced-motion: reduce) {\n  .micro-notice { animation: none; }\n}\n";
DSVI.css += hudCss;
DSVI.css += noticeCss;
DSVI.inject = ["slots", "locale", "configForms", "sessions", "workspaces"];
const err = (tag, e) => {
  try {
  } catch (_) {
  }
};
DSVI.apply = (ctx) => {
  try {
    ctx.effect(DSVI.installStyles, `${DSVI.NS}: styles`);
  } catch (e) {
    err("styles", e);
  }
  let voice = null, agents = null, keypad = null, knob = null, joystick = null, hid = null, ops = null, guide = null, device = null, notice = null, attention = null;
  try {
    voice = new VoiceController();
    agents = new AgentController({ services: (name) => ctx.get(name) });
    agents.setSessions(ctx.sessions);
    agents.setWorkspaces(ctx.workspaces);
    const conversation = ctx.get("conversation") || null;
    if (conversation) agents.setConversation(conversation);
    notice = new MicroNotice({
      t: (key) => {
        try {
          return ctx.locale.bind(DSVI.NS)(key);
        } catch (e) {
          return key;
        }
      }
    });
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
      // ⚠ 2026-10-01 起**不再注入 t**：「目标」键填的命令名是 DSH 注册的 `/goal`，不跟界面语言走
      //   （见 actions/session.js 的 GOAL_COMMAND 那一大段）。往这里塞词典就是那次
      //   「填进去了但 DSH 不认」报障的根因，不要再加回来。
    });
    keypad = new KeypadController({ voice, ops, notice: notice ? notice.showKey : null });
    knob = new KnobController({ voice, ops });
    attention = new AttentionController({ agents, log: (m) => {
      try {
      } catch (e) {
      }
    } });
    knob.setOnPress(attention.arm);
    joystick = new JoystickController({ ops, voice });
    hid = new HidBridge({ agents, keypad, knob, joystick });
    guide = new GuideController({ hid });
    device = new DeviceController({ hid, defaults: DSVI.MICRO_DEFAULTS });
    DSVI.services = { voice, agents, keypad, knob, joystick, hid, ops, guide, device, notice, attention };
    DSVI.knobTools = {
      levelRows,
      parseLevelFromLabel,
      currentLevelIndex,
      findReasoningTrigger,
      openReasoningLevels,
      closeReasoningLevels,
      ringTo,
      commitLevel,
      scrollStepSize,
      findScrollContainer,
      scrollToBottomDir,
      focusCollect,
      isTextEntry,
      // 待确认弹窗那三件：探针要能直接问「现在这张弹窗我认出来了吗、这两颗键会点哪个」，
      // 控制台也能手验（`__dshMicro.knobTools.interactionPanelRoot()`）—— 判据只有一份。
      interactionPanelRoot,
      panelAnswerOf,
      pickPanelButton
    };
    DSVI.actions = { list: () => ACTIONS, run: runAction, keycaps: keycapActions, knob: knobActions };
    DSVI.noticeTools = { NOTICE_REASON, NOTICE_TEXT_FALLBACK, NOTICE_MS, NOTICE_COALESCE_MS };
    DSVI.undoTools = { composer: composerEditable, sel: EDITABLE_SEL, exec: execUndoCommand, chord: dispatchUndoChord };
    try {
      if (typeof window !== "undefined") window.__dshMicro = DSVI;
    } catch (e) {
    }
  } catch (e) {
    err("controllers", e);
  }
  if (hid) {
    try {
      ctx.effect(() => {
        hid.start();
        return () => hid.stop();
      }, `${DSVI.NS}: hid-bridge`);
    } catch (e) {
      err("hid", e);
    }
  }
  if (guide) {
    try {
      ctx.effect(() => {
        guide.start();
        return () => guide.stop();
      }, `${DSVI.NS}: guide`);
    } catch (e) {
      err("guide", e);
    }
  }
  if (device) {
    try {
      ctx.effect(() => {
        device.start();
        return () => device.stop();
      }, `${DSVI.NS}: device`);
    } catch (e) {
      err("device", e);
    }
  }
  if (hid && joystick) {
    try {
      ctx.effect(() => {
        const tt = (key) => {
          try {
            return ctx.locale.bind(DSVI.NS)(key);
          } catch (e) {
            return key;
          }
        };
        const hud = new JoystickHud({ t: tt });
        const off = hid.subscribe((s) => {
          if (hid.simulating) hud.hide();
          else hud.feed(s);
        });
        joystick.setOnGesture(hud.notify);
        if (DSVI.services) DSVI.services.hud = hud;
        return () => {
          off();
          joystick.setOnGesture(null);
          if (DSVI.services && DSVI.services.hud === hud) DSVI.services.hud = null;
          hud.dispose();
        };
      }, `${DSVI.NS}: joy-hud`);
    } catch (e) {
      err("joy-hud", e);
    }
  }
  if (notice) {
    try {
      ctx.effect(() => () => notice.dispose(), `${DSVI.NS}: notice`);
    } catch (e) {
      err("notice", e);
    }
  }
  if (attention) {
    try {
      ctx.effect(() => {
        attention.start();
        return () => attention.stop();
      }, `${DSVI.NS}: attention`);
    } catch (e) {
      err("attention", e);
    }
  }
  try {
    ctx.effect(() => ctx.locale.register(DSVI.NS, DSVI.locales), `${DSVI.NS}: locale`);
    const t = ctx.locale.bind(DSVI.NS);
    const scope = ctx.configForms.get(DSVI.NS);
    const sessions = ctx.sessions;
    if (guide) guide.setScope(scope);
    if (device) device.setScope(scope);
    ctx.effect(() => {
      const readPrefs = () => {
        try {
          const s = scope.getSnapshot();
          return s && s.value || {};
        } catch (e) {
          return {};
        }
      };
      const list = sessions && sessions.list ? sessions.list : null;
      const wsList = ctx.workspaces && ctx.workspaces.list ? ctx.workspaces.list : null;
      const refresh = () => {
        try {
          const p = readPrefs();
          if (knob) {
            knob.setMode(p.knob || "navigate");
            knob.setCustom(p.knobCustom || {});
          }
          if (joystick) joystick.setMapping(p.joystick);
          if (keypad) keypad.setKeyMap(p.actLabels, !!p.micKey);
          if (agents) agents.refresh(p, list ? list.getSnapshot() : null);
          if (guide) guide.setPrefs(p);
          if (device) device.setPrefs(p);
        } catch (e) {
          err("agents-refresh", e);
        }
      };
      const offList = list && typeof list.subscribe === "function" ? list.subscribe(refresh) : null;
      const offWs = wsList && typeof wsList.subscribe === "function" ? wsList.subscribe(refresh) : null;
      const offScope = typeof scope.subscribe === "function" ? scope.subscribe(refresh) : null;
      refresh();
      return () => {
        if (offList) offList();
        if (offWs) offWs();
        if (offScope) offScope();
      };
    }, `${DSVI.NS}: agents`);
    ctx.slots.inject(
      DSVI.SLOT_INPUT,
      () => ctx.slots.register({ name: DSVI.SLOT_INPUT, id: "micro-voice", order: 100 }, VoiceInputButton)
    );
    ctx.slots.inject("settings.section", () => {
      const dispose = ctx.slots.register({
        name: "settings.section",
        id: "micro",
        order: 60,
        label: () => t("nav"),
        inject: () => ({
          scope,
          t,
          sessions,
          // 注意：**不再注入 services 检测函数**。设置页底部「第三方插件」卡以前靠它现场判
          // 「某插件装没装」，2026-09-26 起改成读配置（src/client/config/default.js 的
          // PLUGIN_DEPS，静态、不检测系统）。
          workspaces: ctx.workspaces
        })
      }, MicroSettingsSection);
      return () => {
        dispose();
      };
    });
  } catch (e) {
    err("ui", e);
  }
  try {
    ctx.slots.inject(FOOT_ACTION_SLOT, () => {
      const dispose = ctx.slots.register({
        name: FOOT_ACTION_SLOT,
        id: FOOT_ACTION_ID,
        order: 50,
        locale: DSVI.NS
      }, MicroSidebarAction);
      return () => {
        dispose();
      };
    });
  } catch (e) {
    err("sidebar-action", e);
  }
  try {
    ctx.effect(() => installNavIconPatch({ size: NAV_ICON_SIZE }), `${DSVI.NS}: nav-icon`);
  } catch (e) {
    err("nav-icon", e);
  }
  if (device) {
    try {
      ctx.effect(() => {
        const apply2 = () => {
          try {
            setNavRowHidden(device.hidden);
          } catch (e) {
          }
        };
        const off = device.subscribe(apply2);
        apply2();
        return () => {
          off();
          setNavRowHidden(false);
        };
      }, `${DSVI.NS}: nav-row-hidden`);
    } catch (e) {
      err("nav-row-hidden", e);
    }
  }
};
const apply = DSVI.apply;
const inject = DSVI.inject;
exports.apply = apply;
exports.inject = inject;

    return module.exports;
  }
});
