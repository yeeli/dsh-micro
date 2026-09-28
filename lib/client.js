// dsh-omkb · 客户端（Client）· 由 Vite + client_build.js 生成，勿手改。
// 源码在 src/client/，改后执行：npm run build:client
window.__ModuleLoader__.load({
  id: 'dsh-omkb',
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
var _recognizer, _listening, _unsupported, _official, _stopWait, _beforeDraft, _finalText, _interimText, _commit, _listeners, _officialActive, _emit, _setListening, _fullText, _push, _stopOfficial, _clearStopWait, _last, _lastEnc, _lastJoy, _lastJoyT, _lastJoyPush, _lastKnobPress, _lastDown, _tapTimer, _warned, _subs, _sim, _dispatch, _emit2, _consumeReleases, _release, _guardTap, _baseline, _consumeJoystick, _consumeKnob, _knobPress, _noteUnhandled, _slots, _pushTimer, _allIdle, _lastSentBody, _services, _log, _service, _capAction, _factoryAction, _note, _ref, _customGesture, _mapping, _ops, _voice, _log2, _hid, _scope, _prefs, _open, _step, _shown, _off, _subs2, _canRemember, _emit3, _onState, _remember, _hid2, _scope2, _defaults, _prefs2, _open2, _seen, _off2, _subs3, _restoring, _restoreWarned, _emit4, _onState2, _snapshot, _readBack, _unset, _restore, _services2, _log3, _composer, _navIndex, _navList, _service2, _answerOnPanel;
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
const NS = "dsh-omkb";
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
  // 症状：用户报「布局里原来是圆形的图标变成圆角的形状了」——像素法实测 `.omkb-key-dot`
  // （22px / 50%）顶边第一行就有 16px 宽、整条轮廓与「圆角半径 = 边长 38% 的圆角方形」
  // 逐行吻合，而 computed 明明是 `50%`。
  // DSH 自己知道这个坑：它的组件逐条写了 `corner-shape: round` 抵消（跑 `probe:corner-shape`
  // 能看到一长串 `→ round`），我们的元素一个都没写。这里按同样办法补上。
  // 不认这个属性的浏览器直接忽略这条声明，无副作用。
  '[class*="omkb-"],[class*="dsvi-"]{corner-shape:round}'
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
  const popup = findActivePopup();
  const root = popup || findChatRoot();
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
    const prev = document.querySelector("[data-omkb-knob]");
    if (prev) {
      prev.removeAttribute("data-omkb-knob");
      if (prev.__omkbPrevOutline !== void 0) {
        prev.style.outline = prev.__omkbPrevOutline;
        delete prev.__omkbPrevOutline;
      }
      if (prev.__omkbPrevShadow !== void 0) {
        prev.style.boxShadow = prev.__omkbPrevShadow;
        delete prev.__omkbPrevShadow;
      }
    }
  } catch (e) {
  }
};
const highlight = (el) => {
  clearHighlight();
  if (!el) return;
  el.setAttribute("data-omkb-knob", "1");
  el.__omkbPrevShadow = el.style.boxShadow;
  el.style.boxShadow = "inset 0 0 0 2px #304FFE";
  el.__omkbPrevOutline = el.style.outline;
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
const composerTextarea = () => {
  if (typeof document === "undefined") return null;
  let nodes = [];
  try {
    nodes = Array.from(document.querySelectorAll("textarea"));
  } catch (e) {
    return null;
  }
  const visible = nodes.filter(nodeVisible);
  const active = typeof document.activeElement !== "undefined" ? document.activeElement : null;
  if (active && visible.includes(active)) return active;
  return visible.length ? visible[visible.length - 1] : null;
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
const interactionPanelButtons = () => {
  if (typeof document === "undefined") return [];
  for (const sel of ["[data-approval-key]", "[data-plan-review-key]"]) {
    let card = null;
    try {
      card = document.querySelector(sel);
    } catch (e) {
      card = null;
    }
    if (!card) continue;
    let btns = [];
    try {
      btns = Array.from(card.querySelectorAll("button"));
    } catch (e) {
      btns = [];
    }
    if (btns.length) return btns;
  }
  return [];
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
const dispatchUndoChord = (shift) => {
  if (typeof document === "undefined" || typeof KeyboardEvent === "undefined") return false;
  const el = composerTextarea();
  if (!el) return false;
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
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    return true;
  } catch (e) {
    return false;
  }
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
     *   __dshOmkb.services.voice.diagnose()
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
const HID_STATE_URL = "/omkb/state";
const POLL_MS$1 = 120;
const KNOB_KEYS = /* @__PURE__ */ new Set(["ENC", "ENC_CW", "ENC_CC"]);
const MAX_CATCHUP = 3;
const TAP_HOLD_MS = 400;
class HidBridge {
  // 注意：这里**不收** voice。语音只能由显式动作（ACT10/ACT11 或设置页里绑定的动作）
  // 触发，桥接层拿不到也不该拿到语音控制器——少一条隐式通路，就少一类误触发。
  constructor({ agents, keypad, knob, joystick } = {}) {
    __publicField(this, "agents", null);
    /** 按键控制器（./keypad.js）：键码 → 动作。 */
    __publicField(this, "keypad", null);
    __publicField(this, "knob", null);
    __publicField(this, "joystick", null);
    __publicField(this, "timer", null);
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
    /** 上一次轮询看到的「当前按住的键」集合（null = 还没建立基线）。差集就是本次松开的那几颗。 */
    __privateAdd(this, _lastDown, null);
    /** 快按兜底的收尾定时器（见 TAP_HOLD_MS）。 */
    __privateAdd(this, _tapTimer, null);
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
      __privateSet(this, _lastDown, null);
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(this.poll, POLL_MS$1);
    });
    __publicField(this, "stop", () => {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      if (__privateGet(this, _tapTimer)) {
        clearTimeout(__privateGet(this, _tapTimer));
        __privateSet(this, _tapTimer, null);
      }
      __privateSet(this, _lastDown, null);
    });
    /**
     * 订阅状态快照：每次轮询拿到 /omkb/state 后广播一次（**不管有没有事件**）。
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
     * 测试注入：把一段 /omkb/state 形状的快照直接广播给订阅者。
     * 只给自检与真机探针用（宿主没重启、手边没设备时，验「按键特效 / 摇杆推拉」不必真的按键）。
     * **它只广播**：不建立基线、不做事件归属，所以绝不会触发任何真实功能。
     */
    __publicField(this, "feed", (snap) => {
      __privateGet(this, _emit2).call(this, snap || {});
    });
    /** 诊断快照：出问题时先看这里（浏览器控制台 `__dshOmkb.services.hid.diagnose()`）。 */
    __publicField(this, "diagnose", () => ({
      unhandledCount: this.unhandledCount,
      unhandled: this.unhandled.slice(),
      voice: "仅显式动作（ACT10/ACT11 或设置页绑定的动作），桥接层不触发语音"
    }));
    __publicField(this, "poll", () => {
      fetch(HID_STATE_URL, { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then((s) => {
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
      }).catch(() => {
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
      return seen;
    });
    __privateAdd(this, _knobPress, () => {
      __privateGet(this, _dispatch).call(this, () => {
        if (this.knob && typeof this.knob.press === "function") this.knob.press();
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
          console.warn(`[omkb] 未归属的按键事件（已忽略，不会触发语音）：${name}`);
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
_lastDown = new WeakMap();
_tapTimer = new WeakMap();
_warned = new WeakMap();
_subs = new WeakMap();
_sim = new WeakMap();
_dispatch = new WeakMap();
_emit2 = new WeakMap();
_consumeReleases = new WeakMap();
_release = new WeakMap();
_guardTap = new WeakMap();
_baseline = new WeakMap();
_consumeJoystick = new WeakMap();
_consumeKnob = new WeakMap();
_knobPress = new WeakMap();
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
    // 内容级去重的账本 =「**宿主此刻持有的**那份请求体」。**只有发成功才更新**；null = 还没成功发过。
    // ⚠ 失败**不重置**它 —— 理由见 pushLeds 里的推演（清账会让「切回原状态」白发一条）。
    __privateAdd(this, _lastSentBody, null);
    // 跨插件服务**延迟取值**（与 actions/index.js 的 DshOps 同一套写法）：别的客户端插件
    // 晚于本插件加载，建对象时缓存下来会永远是 undefined。
    __privateAdd(this, _services, () => void 0);
    __privateAdd(this, _log, (msg) => {
      try {
        console.log("[omkb] " + msg);
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
      this.pushLeds(slots, prefs && prefs.brightness, allIdle, currentSessionIdIn(snapshot2));
      return slots;
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
        fetch("/omkb/agents", {
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
_lastSentBody = new WeakMap();
_services = new WeakMap();
_log = new WeakMap();
_service = new WeakMap();
const defaultLog = (msg) => {
  try {
    console.log("[omkb] " + msg);
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
    id: "none",
    name: "FAST",
    icon: "fast",
    capId: "ACT06",
    label: "act.none",
    desc: "保留：按下不执行任何操作",
    knob: true,
    run: () => false
  },
  {
    id: "archive",
    name: "ARCH",
    icon: "arch",
    capId: "ACT07",
    label: "act.archive",
    desc: "归档当前会话：立刻从会话列表收起，可在「已归档」里找回",
    knob: true,
    run: (c) => call(c.ops, "archive")
  },
  {
    id: "reject",
    name: "REJ",
    icon: "rej",
    capId: "ACT08",
    label: "act.reject",
    desc: "拒绝当前待确认的交互（审批 → 拒绝；计划确认 → 拒绝执行）",
    knob: true,
    run: (c) => call(c.ops, "respond", "reject")
  },
  {
    id: "approve",
    name: "APPR",
    icon: "appr",
    capId: "ACT09",
    label: "act.approve",
    desc: "批准当前待确认的交互（审批 → 允许一次；计划确认 → 确认执行）",
    knob: true,
    // 历史动作名：knobCustom 里老值存的是 'agree'（见 ALIASES）。
    run: (c) => call(c.ops, "respond", "approve")
  },
  {
    id: "fork",
    name: "FORK",
    icon: "fork",
    capId: "FORK",
    label: "act.fork",
    desc: "分叉当前会话：从当前这条复制出一条新的分支会话，原会话保留",
    knob: true,
    run: (c) => call(c.ops, "fork")
  },
  {
    id: "voice",
    name: "MIC",
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
    name: "SEND",
    icon: "send",
    capId: "ACT12",
    label: "act.send",
    desc: "发送当前输入",
    knob: true,
    run: (c) => call(c.ops, "send")
  },
  // ---- 以下是「旋钮自定义分配」专属（没有 capId：它们是手势语义，不是一颗键的功能）----
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
  },
  {
    id: "reasoning_up",
    label: "act.reasoningUp",
    desc: "仅推理：把蓝环向上移一档（转动不提交）",
    knob: true,
    run: (c) => call(c.ops, "reasoningStep", 1)
  },
  {
    id: "reasoning_down",
    label: "act.reasoningDown",
    desc: "仅推理：把蓝环向下移一档（转动不提交）",
    knob: true,
    run: (c) => call(c.ops, "reasoningStep", -1)
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
const OMKB_DEFAULTS = {
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
  ACT06: "none",
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
const MIC_MERGED_ID = "act11";
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
    return labels.ACT11 || labels.ACT10 || factoryCapOf("ACT11");
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
  if (MIC_SWITCHES.includes(c)) return split ? [c] : [...MIC_SWITCHES].reverse();
  return [c];
};
const CUSTOM_LABEL = "自定义";
const CUSTOM_ICON = "custom";
const KEYCAPS = keycapActions().map((a) => ({
  id: a.capId,
  label: a.name,
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
  constructor({ voice, ops, log } = {}) {
    /**
     * 出厂「键码 → 动作」表（保留为公开字段：诊断与控制台拿它对照）。
     * 由键帽表派生 —— 两份手写的表迟早对不上，而这里的每一行都直接决定按下的行为。
     * `'none'`（FAST 那颗保留键）不进表：它表示「什么都不做」，写进去反而像「有个动作叫 none」。
     */
    __publicField(this, "ACTION_KEYS", Object.fromEntries(
      ["ACT06", "ACT07", "ACT08", "ACT09", "ACT10", "ACT11", "ACT12"].map((id) => [id, keycapAction(id)]).filter(([, action]) => action && action !== "none")
    ));
    __publicField(this, "voice", null);
    /** DSH 功能门面（./actions/index.js）：发送、批准/拒绝、归档、分叉都从它走。 */
    __publicField(this, "ops", null);
    /** 日志（可选；功能总表执行失败时用它记一行，没给就用控制台）。 */
    __publicField(this, "log", null);
    /** 设置里的键帽（键码 → 键帽 id，也就是「这颗键要当什么用」）；由 entry.js 随偏好灌入。 */
    __publicField(this, "keyMap", {});
    /** 独立麦克风键：打开时 Mic 的两颗开关各读各的，关闭时共用一颗宽键（取值链见 ./utils/keycaps.js）。 */
    __publicField(this, "micSplit", false);
    /**
     * 诊断：最近几次真实按键「上报的键码 → 解析出的动作」（最多 8 条，最新的在后）。
     * 设备按键类问题排查入口：`__dshOmkb.services.keypad.lastRuns`。
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
     * 键帽 id → 动作；ACT06（保留）是明确的「按下什么都不做」。不认识的 id 返回 undefined。
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
     */
    __publicField(this, "run", (act) => {
      const fn = this.resolve(act);
      __privateGet(this, _note).call(this, act, fn, "press");
      pressAction(fn, { ops: this.ops, voice: this.voice, log: this.log });
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
  }
}
_capAction = new WeakMap();
_factoryAction = new WeakMap();
_note = new WeakMap();
class KnobController {
  constructor({ voice, ops }) {
    __privateAdd(this, _ref, { mode: "navigate", custom: {} });
    __publicField(this, "voice", null);
    /** DSH 功能门面（./actions/index.js）。 */
    __publicField(this, "ops", null);
    __publicField(this, "setMode", (m) => {
      __privateGet(this, _ref).mode = m;
    });
    __publicField(this, "setCustom", (obj) => {
      __privateGet(this, _ref).custom = obj;
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
      const ops = this.ops;
      const mode = __privateGet(this, _ref).mode || "navigate";
      if (mode === "scroll") {
        if (ops) ops.scrollToBottom();
      } else if (mode === "reasoning") {
        if (ops) ops.reasoningPress();
      } else if (mode === "custom") __privateGet(this, _customGesture).call(this, "click");
      else if (ops) ops.navActivate();
    });
    __publicField(this, "long", () => {
      const mode = __privateGet(this, _ref).mode || "navigate";
      if (mode === "custom") __privateGet(this, _customGesture).call(this, "long");
    });
    this.voice = voice || null;
    this.ops = ops || null;
  }
  get mode() {
    return __privateGet(this, _ref).mode;
  }
}
_ref = new WeakMap();
_customGesture = new WeakMap();
const MONITOR_URL = "/omkb/monitor";
const PRIVACY_URL = "/omkb/open-privacy";
const monitorDot = (m) => {
  if (m && m.granted === true) return { cls: "omkb-dot--ok", statusCls: "omkb-status--ok", labelKey: "monitor.granted" };
  if (m && m.granted === false) return { cls: "omkb-dot--err", statusCls: "omkb-status--err", labelKey: "monitor.denied" };
  return { cls: "omkb-dot--idle", statusCls: "omkb-status--idle", labelKey: "monitor.unknown" };
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
    nav: "OMKB 键盘",
    "settings.title": "OMKB 键盘",
    "settings.subtitle": "连接状态与按键 / 灯光配置",
    "conn.title": "连接",
    "conn.connected": "已连接",
    "conn.disconnected": "连接未成功",
    "conn.desc": "OMKB 正在自动重连。请确认设备已配对，并关闭键盘重映射或安全类工具。",
    // 「电池」那一行（**只在设备连上时展示**；电量来自设备上报的 device.status）
    "conn.battery": "电池",
    "conn.charging": "充电中",
    "conn.retry": "重新连接",
    "conn.remove": "移除",
    "monitor.title": "输入监控",
    "monitor.desc": "omkb 按键需要系统「输入监控」授权",
    "monitor.granted": "已授权",
    "monitor.denied": "未授权",
    "monitor.unknown": "无法判定",
    "monitor.hintDenied": "请在「系统设置 → 隐私与安全性 → 输入监控」中勾选 DeepSeek Harness，然后回来重新检测",
    "monitor.hintUnknown": "系统没有返回明确结果，可点重新检测再试一次",
    "monitor.open": "打开系统设置",
    "monitor.retry": "重新检测",
    "brightness.title": "亮度",
    "brightness.desc": "调整所有 omkb 灯光的亮度",
    "autoDim.title": "自动调暗",
    "autoDim.desc": "所有会话空闲达到设定时长后关闭灯光；按任意键或会话开始运行即点亮",
    "autoDim.off": "关闭",
    "autoDim.30s": "30 秒",
    "autoDim.1m": "1 分钟",
    "autoDim.2m": "2 分钟",
    "autoDim.5m": "5 分钟",
    "layout.title": "布局",
    "layout.reset": "重置布局",
    "layout.desc": "omkb 物理按键布局",
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
    "opts.knob.custom.desc": "为每次旋转、点击和长按选择操作",
    "opts.knobCustom": "自定义分配",
    "opts.knobCustomDesc": "为旋钮的每种操作选择要执行的命令",
    "opts.knobCustom.cw": "顺时针旋转",
    "opts.knobCustom.ccw": "逆时针旋转",
    "opts.knobCustom.click": "点击",
    "opts.knobCustom.long": "长按",
    "act.none": "无",
    "act.navFwd": "焦点后移",
    "act.navBack": "焦点前移",
    "act.scrollUp": "向上滚动",
    "act.scrollDown": "向下滚动",
    "act.scrollBottom": "滚动到底部",
    "act.voice": "语音输入",
    "act.send": "发送",
    "act.approve": "批准当前交互",
    "act.reject": "拒绝当前交互",
    "act.archive": "归档当前会话",
    "act.fork": "分叉当前会话",
    "act.reasoning": "切换推理",
    "act.reasoningUp": "增强推理强度",
    "act.reasoningDown": "减弱推理强度",
    // ---------- 第三方插件依赖（设置页底部，**常驻卡片**）----------
    // 清单来自 config/default.js 的 PLUGIN_DEPS（静态配置、不检测系统）；清单为空时显示
    // plugins.empty 那一行占位。要加插件条目请改那个文件，不要动这里的文案结构。
    "plugins.title": "第三方插件",
    "plugins.desc": "以下按键功能需要额外安装对应的 DSH 插件；安装状态按插件自带配置显示",
    "plugins.empty": "暂无需要额外安装的插件",
    "plugins.installed": "已安装",
    "plugins.missing": "未安装",
    "plugins.usedBy": "用于：",
    "opts.micKey": "使用独立麦克风键",
    "opts.micKeyDesc": "下方宽 Mic 键有两个开关，打开后各自独立（布局里拆成两颗键，可分别指定功能）",
    "settings.saving": "保存中…",
    "settings.saved": "已保存",
    "settings.saveError": "保存失败",
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
    "guide.welcome.title": "欢迎使用 OMKB 键盘",
    "guide.welcome.desc": "检测到你的 omkb 小键盘已经连上。接下来用两步带你看清 6 颗智能体键和命令键 —— 大概半分钟。",
    "guide.agents.title": "智能体按键",
    "guide.agents.desc": "第一、二排的 6 颗键对应你的会话：按下就切过去。灯的颜色实时反映每个会话的状态，不用盯着屏幕也知道谁在忙。",
    "guide.commands.title": "命令键",
    "guide.commands.desc": "第三排是四颗命令键（FAST / ARCH / REJ / APPR），底部是麦克风键和发送键 —— 最常用的操作都在手边。",
    "guide.commands.note": "这些键都能改：设置 → OMKB 键盘，可以逐颗换键帽、给摇杆四个方向绑动作、切换旋钮模式。",
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
    "remove.item2": "设置页里的「OMKB 键盘」分区会隐藏",
    "remove.item3": "侧边栏底部的小键盘图标会隐藏",
    "remove.item4": "「首次连接引导」的已读标记一起清掉",
    "remove.item5": "重新连接这台键盘后以上全部恢复显示（引导会像新装一样再弹一次）",
    "remove.hint": "只在设备没连上时才需要移除；如果只是暂时断开，先试「重新连接」。",
    "remove.cancel": "取消",
    "remove.confirm": "移除"
  },
  en: {
    nav: "OMKB Keypad",
    "settings.title": "OMKB Keypad",
    "settings.subtitle": "Connection status and key / lighting configuration",
    "conn.title": "Connection",
    "conn.connected": "Connected",
    "conn.disconnected": "Connection failed",
    "conn.desc": "omkb is reconnecting. Make sure the device is paired and no keyboard remapper or security tool is blocking access.",
    "conn.battery": "Battery",
    "conn.charging": "Charging",
    "conn.retry": "Reconnect",
    "conn.remove": "Remove",
    "monitor.title": "Input Monitoring",
    "monitor.desc": "omkb keys require the system Input Monitoring permission",
    "monitor.granted": "Granted",
    "monitor.denied": "Not granted",
    "monitor.unknown": "Unknown",
    "monitor.hintDenied": "Tick DeepSeek Harness in System Settings → Privacy & Security → Input Monitoring, then check again",
    "monitor.hintUnknown": "The system did not return a clear result — try checking again",
    "monitor.open": "Open System Settings",
    "monitor.retry": "Check again",
    "brightness.title": "Brightness",
    "brightness.desc": "Adjust the brightness of all omkb lights",
    "autoDim.title": "Auto-Dim",
    "autoDim.desc": "Turn lights off after every session has been idle for the chosen time; a keypress or a running session relights them",
    "autoDim.off": "Off",
    "autoDim.30s": "30 seconds",
    "autoDim.1m": "1 minute",
    "autoDim.2m": "2 minutes",
    "autoDim.5m": "5 minutes",
    "layout.title": "Layout",
    "layout.reset": "Reset Layout",
    "layout.desc": "Physical key layout of the omkb",
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
    "opts.knob.custom.desc": "Choose actions for each rotate, click, and long-press",
    "opts.knobCustom": "Custom assignment",
    "opts.knobCustomDesc": "Choose the command for each knob gesture",
    "opts.knobCustom.cw": "Rotate clockwise",
    "opts.knobCustom.ccw": "Rotate counter-clockwise",
    "opts.knobCustom.click": "Click",
    "opts.knobCustom.long": "Long-press",
    "act.none": "None",
    "act.navFwd": "Focus next",
    "act.navBack": "Focus previous",
    "act.scrollUp": "Scroll up",
    "act.scrollDown": "Scroll down",
    "act.scrollBottom": "Scroll to bottom",
    "act.voice": "Voice input",
    "act.send": "Send",
    "act.approve": "Approve the pending request",
    "act.reject": "Reject the pending request",
    "act.archive": "Archive this session",
    "act.fork": "Fork this session",
    "act.reasoning": "Toggle reasoning",
    "act.reasoningUp": "Increase reasoning",
    "act.reasoningDown": "Decrease reasoning",
    // ---------- Third-party plugin dependencies (always-on card at the bottom of the page) ----------
    // The list comes from config/default.js (PLUGIN_DEPS, static config — no system probing);
    // an empty list shows the plugins.empty placeholder line.
    "plugins.title": "Third-party Plugins",
    "plugins.desc": "The key actions below need extra DSH plugins; the status shown follows the plugin’s own config",
    "plugins.empty": "No extra plugins needed",
    "plugins.installed": "Installed",
    "plugins.missing": "Missing",
    "plugins.usedBy": "Used by: ",
    "opts.micKey": "Use separate mic keys",
    "opts.micKeyDesc": "The wide mic key has two switches; map them independently (the layout splits into two keys, each with its own action)",
    "settings.saving": "Saving…",
    "settings.saved": "Saved",
    "settings.saveError": "Save failed",
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
    "guide.welcome.title": "Welcome to OMKB Keypad",
    "guide.welcome.desc": "Your omkb keypad is connected. Two short steps show you the 6 smart agent keys and the command keys — about half a minute.",
    "guide.agents.title": "Smart agent keys",
    "guide.agents.desc": "The 6 keys in the first two rows map to your sessions: press one to switch to it. The LED color tracks each session live, so you can tell who is busy without looking at the screen.",
    "guide.commands.title": "Command keys",
    "guide.commands.desc": "Row three holds four command keys (FAST / ARCH / REJ / APPR); the bottom row has the mic and send keys — the most used actions are always at hand.",
    "guide.commands.note": "All of these can be changed: Settings → OMKB Keypad lets you swap keycaps, bind the four joystick directions, and switch knob modes.",
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
    "remove.item2": "The “OMKB Keypad” section disappears from Settings",
    "remove.item3": "The small keypad icon in the sidebar disappears",
    "remove.item4": "The “first-connect guide” read flag is cleared as well",
    "remove.item5": "Reconnect this keypad and everything above comes back (the guide shows again like on a fresh install)",
    "remove.hint": "Removing is only meant for when the device is not connected; if it is just temporarily offline, try “Reconnect” first.",
    "remove.cancel": "Cancel",
    "remove.confirm": "Remove"
  }
};
DSVI.locales = locales;
const settingsCss = '\n\n/* dsh-omkb · client/src/settings.css — 设置面板样式\n * 以 ?raw 引入，追加到 DSVI.css，随 installStyles 一起注入。 */\n.omkb-key--act{position:relative}\n.omkb-modal-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(15,18,25,.4);backdrop-filter:blur(4px)}\n.omkb-modal{width:min(520px,92vw);background:#fff;border-radius:14px;padding:18px;box-shadow:0 24px 60px rgba(0,0,0,.25)}\n.omkb-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}\n.omkb-modal-title{font-size:18px;font-weight:600;color:#1f2937}\n.omkb-modal-sub{margin-top:2px;font-size:13px;color:#4b5563}\n.omkb-modal-x{background:0 0;border:0;font-size:22px;line-height:1;color:#4b5563;cursor:pointer;border-radius:6px;width:30px;height:30px}\n.omkb-modal-x:hover{background:rgba(0,0,0,.06)}\n.omkb-modal-search{width:100%;margin:14px 0;padding:8px 12px;border:1px solid #e5e7eb;border-radius:9px;font-size:13px;outline:none;box-sizing:border-box}\n.omkb-modal-search:focus{border-color:#3b82f6}\n.omkb-modal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:10px;max-height:300px;overflow:auto}\n/* 「编辑按键」的候选 = **和外面那排键同一套外观**。\n * 组件直接复用 .omkb-key（同一个圆角、同一条投影、同一个图标），这里只覆盖网格尺寸、\n * 选中态与「键下面那行名字」—— 以前候选项是一排 emoji 小方卡片，弹窗里挑的东西和选完之后\n * 键盘上看到的东西长得完全不一样，用户得自己脑补。 */\n.omkb-capgrid{grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:12px}\n/* 一格 = 键 + 键下面的名字。名字在键**外面**：布局的键已经不带文字了（像真键盘），\n * 弹窗是唯一还有名字的地方。以前那行字是 .omkb-key-cap（绝对定位，只在 .omkb-key--act 里\n * 定得住），而候选不是 .omkb-key--act —— 于是所有候选的名字被甩到遮罩底部叠成一堆。 */\n.omkb-cap-cell{display:flex;flex-direction:column;gap:6px;cursor:pointer}\n.omkb-cap-name{text-align:center;font-size:11px;font-weight:600;letter-spacing:.3px;color:var(--dsw-alias-label-secondary,#374151)}\n.omkb-cap{background:#f7f5f1;border:1px solid rgba(255,255,255,.6)}\n.omkb-cap-cell:hover .omkb-cap{border-color:#93c5fd}\n.omkb-cap--sel,.omkb-cap--sel:hover{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.35),0 2px 6px rgba(0,0,0,.06)}\n.omkb-cap-cell--sel .omkb-cap-name{color:#2563eb}\n/* 未指派的自定义键（拆分态那颗 Mic 右开关）：虚框 + 淡一点，\n * 一眼看出「这里还没选功能」，而不是「又一颗 MIC 键」。 */\n.omkb-key--custom{border-style:dashed;border-color:rgba(0,0,0,.16);background:#f2efe9;box-shadow:none}\n.omkb-modal-spacer{flex:1}\n/* 置灰的按钮要真的看得出不能点（「保存」在没换键帽时是禁用的）。 */\n.omkb-modal .omkb-ghost[disabled],.omkb-modal .omkb-primary[disabled]{opacity:.4;cursor:default}\n.omkb-modal .omkb-ghost[disabled]:hover{background:transparent}\n.omkb-modal .omkb-primary[disabled]:hover{opacity:.4}\n/* 「重置布局」确认弹窗：把会重置成什么一条条列出来 */\n.omkb-reset-body{max-height:320px;overflow:auto;margin-top:8px}\n.omkb-reset-list{margin:0 0 4px;padding-left:18px;color:#4b5563;font-size:12.5px;line-height:1.65}\n.omkb-modal-hint{margin-top:10px;font-size:12px;line-height:1.5;color:#9ca3af}\n.omkb-modal-foot{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:16px}\n.omkb-modal .omkb-ghost{background:transparent;color:#4b5563;border:0;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px}\n.omkb-modal .omkb-ghost:hover{background:rgba(0,0,0,.06)}\n.omkb-modal .omkb-primary{background:#000;color:#fff;border:0;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500}\n.omkb-modal .omkb-primary:hover{opacity:.88}\n.omkb-control-item{cursor:default}\n.omkb-joy-ctrl{cursor:pointer}\n.omkb-joy-body{display:flex;gap:16px;align-items:stretch;margin-top:14px}\n/* 摇杆弹窗里的方向盘底盘：与布局里那颗摇杆同形（正圆），不再是圆角方框 —— 见上面 .omkb-control-base 的注释。 */\n.omkb-joy-pad{flex:none;align-self:center;width:64px;height:64px;border-radius:50%;background:#eef2f6;display:grid;place-items:center}\n.omkb-joy-knob{width:26px;height:26px;border-radius:50%;background:#111;box-shadow:0 2px 4px rgba(0,0,0,.25)}\n.omkb-joy-list{flex:1;display:flex;flex-direction:column;gap:6px}\n.omkb-joy-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer}\n.omkb-joy-row:hover{border-color:#93c5fd}\n.omkb-joy-row--sel,.omkb-joy-row--sel:hover{border-color:#3b82f6;background:#eff6ff}\n.omkb-joy-arrow{font-size:15px;color:#4b5563;width:16px;text-align:center}\n.omkb-joy-dir{font-weight:600;color:#1f2937}\n.omkb-joy-val{margin-left:auto;color:#4b5563;font-size:13px;max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.omkb-joy-foot{display:flex;justify-content:flex-end;margin-top:16px}\n.omkb-joy-done{width:100%}\n.omkb-overlay--sub{z-index:10002}\n.omkb-modal--sub{width:min(480px,92vw)}\n.omkb-sub-title{font-size:16px;font-weight:700;color:#1f2937}\n.omkb-sub-clear{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid #e5e7eb;color:#4b5563;border-radius:20px;padding:3px 10px;font-size:12px;cursor:pointer}\n.omkb-sub-clear span{color:#999;font-size:14px}\n.omkb-sub-body{max-height:320px;overflow:auto}\n.omkb-sub-cat{font-size:13px;font-weight:700;color:#374151;margin:12px 0 4px}\n.omkb-sub-pick{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer}\n.omkb-sub-pick:hover{background:#f3f4f6}\n.omkb-sub-pick--soon{opacity:.45;cursor:default}\n.omkb-sub-pick--soon:hover{background:transparent}\n.omkb-sub-name{flex:none;font-weight:600;color:#1f2937}\n.omkb-sub-des{margin-left:auto;color:#4b5563;font-size:12px;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.omkb-sub-empty{padding:18px;text-align:center;color:#9ca3af;font-size:13px}\n.omkb-wrap{display:flex;flex-direction:column;gap:16px;padding:0 0 24px;max-width:560px}\n.omkb-heading{margin-bottom:4px}\n.omkb-title{font-size:18px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0}\n.omkb-subtitle{font-size:13px;color:#4b5563;margin:4px 0 0}\n.omkb-card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 16px}\n.omkb-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0}\n.omkb-row + .omkb-row{border-top:1px solid var(--dsw-alias-border-l2)}\n.omkb-row__label{min-width:0;flex:1}\n.omkb-row__title{font-size:14px;color:var(--dsw-alias-label-primary)}\n/* 模块描述文字：固定 #999（不跟随主题令牌——令牌在浅色主题下太浅，读不清） */\n.omkb-row__desc{font-size:12px;color:#999;margin-top:2px}\n.omkb-row__ctrl{flex:none;display:flex;align-items:center;gap:8px}\n.omkb-dot{width:8px;height:8px;border-radius:999px;flex:none}\n.omkb-dot--ok{background:var(--dsw-alias-state-success-primary)}\n.omkb-dot--err{background:var(--dsw-alias-state-error-primary)}\n/* 「无法判定」：既不是成功也不是失败，用中性灰（别拿红点吓人） */\n.omkb-dot--idle{background:var(--dsw-alias-label-tertiary)}\n.omkb-status{font-size:13px;font-weight:500}\n.omkb-status--ok{color:var(--dsw-alias-state-success-primary)}\n.omkb-status--err{color:var(--dsw-alias-state-error-primary)}\n.omkb-status--idle{color:var(--dsw-alias-label-secondary)}\n.omkb-hint{font-size:12px;color:var(--dsw-alias-state-warn-label);margin-top:8px;line-height:1.5}\n/* 设置页里「这一页只演示、不触发功能」的说明（闸门见 hid-bridge 的 enterSim）。\n * 贴在键盘插图正上方、居中；用告警色是刻意的 —— 用户按了键没反应时，这行字是唯一解释。 */\n.omkb-sim-hint{text-align:center;margin:12px 0 0}\n.omkb-slider{width:160px;accent-color:var(--dsw-alias-brand-primary)}\n.omkb-val{font-size:12px;color:var(--dsw-alias-label-secondary);min-width:34px;text-align:right}\n/* ---------- 电量（设置页「电池」那一行；只在设备连上时出现）----------\n * 颜色三档：正常跟随次级文字色；**低电量**（阈值见 utils/device.js 的 BATTERY_LOW_PCT）\n * 图标与数字一起转告警红 —— 数字也要红，因为图标小、红点容易被当成装饰。\n * 「充电中」用中性文字的小胶囊，不抢告警色（此刻低电量已经不告警了，见 batteryView）。 */\n.omkb-batt{display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary)}\n.omkb-batt--low{color:var(--dsw-alias-state-error-primary)}\n.omkb-batt__val{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary);min-width:34px;text-align:right}\n.omkb-batt__val--low{color:var(--dsw-alias-state-error-primary)}\n.omkb-batt__tag{font-size:11px;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 6px}\n.omkb-select{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 8px;font-size:13px}\n.omkb-switch{position:relative;width:38px;height:22px;border-radius:999px;border:none;background:var(--dsw-alias-label-tertiary);cursor:pointer;transition:background .15s}\n.omkb-switch[data-on]{background:var(--dsw-alias-brand-primary)}\n.omkb-switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:999px;background:#fff;transition:transform .15s}\n.omkb-switch[data-on]::after{transform:translateX(16px)}\n.omkb-ghost{background:0 0;border:none;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer;padding:4px 8px;border-radius:8px}\n.omkb-ghost:hover{background:var(--dsw-alias-interactive-bg-hover)}\n/* 破坏性操作（「移除」）：平时与其它 ghost 按钮同形，只有文字用告警色 ——\n * 按钮长得越像普通按钮，越要让人一眼看出它不一样。 */\n.omkb-ghost--danger{color:var(--dsw-alias-state-error-primary)}\n.omkb-ghost--danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}\n.omkb-modal .omkb-primary--danger{background:var(--dsw-alias-state-error-primary)}\n.omkb-modal .omkb-primary--danger:hover{opacity:.88}\n/* ---------- 保存提示：顶部悬浮 message ----------\n * 由设置页 OmkbSaveToast 渲染，只在 saved / saving / error 时存在。\n * 三条硬约束：\n *   1) position:fixed —— 必须**脱离文档流**（原来的行内文本每次出现都把下方卡片顶动一行）；\n *   2) z-index 高于本插件的弹窗遮罩（.omkb-modal-overlay 9999 / 二级 10002），\n *      否则在「编辑键帽」弹窗关掉的那一拍会被盖住 —— 保存提示恰好出现在那一拍；\n *   3) pointer-events:none —— 它是通知不是控件，绝不能挡住底下任何点击\n *      （视口顶部正中在设置弹窗的头部区域，那里有 DSH 自己的关闭按钮附近的可点区域）。\n * 颜色走 DSH 主题令牌：浅色/深色主题自动跟随，不写死背景。 */\n.omkb-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10050;display:flex;align-items:center;gap:7px;max-width:70vw;padding:7px 14px 7px 12px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));box-shadow:0 10px 26px rgba(15,18,25,.16),0 2px 6px rgba(15,18,25,.08);font-size:13px;font-weight:500;line-height:1.25;color:var(--dsw-alias-label-primary,#111);pointer-events:none;animation:omkb_toast_in .18s ease-out}\n.omkb-toast__ico{display:flex;align-items:center;justify-content:center;flex:none;width:14px;height:14px}\n.omkb-toast__text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.omkb-toast--saving .omkb-toast__ico{color:var(--dsw-alias-label-secondary,#6b7280)}\n.omkb-toast--saved .omkb-toast__ico{color:var(--dsw-alias-state-success-primary,#16a34a)}\n.omkb-toast--error .omkb-toast__ico{color:var(--dsw-alias-state-error-primary,#dc2626)}\n.omkb-toast--error{color:var(--dsw-alias-state-error-primary,#dc2626)}\n/* 「保存中」用转圈而不是静态图标：写盘快慢不定，转圈说明还在进行中。 */\n.omkb-toast__spin{box-sizing:border-box;width:13px;height:13px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:omkb_toast_spin .7s linear infinite}\n@keyframes omkb_toast_in{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}\n@keyframes omkb_toast_spin{to{transform:rotate(360deg)}}\n@media (prefers-reduced-motion:reduce){.omkb-toast{animation:none}.omkb-toast__spin{animation-duration:1.6s}}\n\n.omkb-page-wrap {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n}\n\n.omkb-keyboard-wrap {\n  width: 420px;\n  padding: 24px;\n  background: #eae8e3;\n  border-radius: 28px;\n  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);\n}\n\n.omkb-grid-4col {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 16px;\n}\n\n.omkb-key {\n  aspect-ratio: 1 / 1;\n  background: #f7f5f1;\n  border-radius: 18px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);\n  cursor: pointer;\n  /* 回弹曲线：按下时快（配合 --pressed 里的 transition-duration），松开时轻轻回弹 */\n  transition: transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.18s ease, background 0.18s ease;\n  border: 1px solid rgba(255, 255, 255, 0.6);\n}\n\n.omkb-key:active {\n  transform: translateY(2px);\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);\n}\n\n/* 真机按键时布局里对应键的按压特效（纯视觉，见 components/settings/keyboard-layout.jsx 的 useHidSignals）：\n   按下 = 陷下去 + 内阴影 + 底色变暗；松开时用上面的回弹曲线弹回来。 */\n.omkb-key--pressed {\n  transform: translateY(3px) scale(0.95);\n  background: #e9e6df;\n  box-shadow: 0 0 0 rgba(0, 0, 0, 0.05), inset 0 2px 6px rgba(0, 0, 0, 0.14);\n  transition-duration: 0.06s;\n}\n\n.omkb-key-dot {\n  width: 22px;\n  height: 22px;\n  border-radius: 50%;\n  background: #7b68bc;\n}\n\n.omkb-control-item {\n  aspect-ratio: 1 / 1;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: transparent;\n  box-shadow: none;\n  border: none;\n  cursor: default;\n}\n\n/* 旋钮 / 摇杆的**凹槽底盘**：必须跟里面的圆零件（.omkb-circle-knob-inner / .omkb-joystick-dot）\n * 同形 —— 都是正圆。改回 px 圆角会让"圆零件"看上去像被套进一个圆角方框里\n * （用户 2026-09-23 报的「原来圆形的图标变成圆角形状」就是这层底盘造成的：\n *  白芯 #f1f1ef 与底盘 #e6e4df 对比度极低，整体看就是个圆角方形）。\n * 契约由 test/verify_layout.js 的【圆形零件】一节守着。 */\n.omkb-control-base {\n  width: 92px;\n  height: 92px;\n  border-radius: 50%;\n  background: #e6e4df;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.4);\n  border: 1px solid rgba(0, 0, 0, 0.04);\n}\n\n.omkb-circle-knob-inner {\n  width: 72px;\n  height: 72px;\n  /* 定位祖先：转动指示的环与蓝点都画在它里面（见下面 .omkb-knob-ring / .omkb-knob-dot） */\n  position: relative;\n  border-radius: 50%;\n  background: #f1f1ef;\n  box-shadow: 0 6px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -4px 8px rgba(0,0,0,0.08);\n  border: 1px solid rgba(0, 0, 0, 0.06);\n}\n\n/* ---------- 旋钮的「转动指示」（2026-09-25，判据见 utils/knob-state.js）----------\n * 设备转动 / 按下旋钮时，圆盘上亮起一圈淡蓝描边，蓝点落在**这次转动的方向**上：\n * 顺时针 → 右侧 3 点（90°），逆时针 → 左侧 9 点（-90°）。活性窗口过期后两者一起淡出 ——\n * 静止时与以前完全一样，看不见环也看不见点。\n * 几何：盘半径 36、环宽 2 → 内缘 34；点到圆心 27 + 点半径 6 = 33，外缘贴着环内侧\n * （KNOB_DOT_R，见 components/settings/keyboard-layout.jsx）。 */\n.omkb-knob-ring {\n  position: absolute;\n  inset: 0;\n  border-radius: 50%;\n  border: 2px solid #a8c8f8;\n  opacity: 0;\n  transition: opacity 0.18s ease;\n}\n\n.omkb-knob-dot {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  width: 12px;\n  height: 12px;\n  border-radius: 50%;\n  background: #7ba7f5;\n  opacity: 0;\n  /* 兜底角度 = 静止位（左侧）。组件每次都写 inline 角度，transition 让它在左右之间滑过去 ——\n   * 所以这里**不能**省：写成点停在圆心会让第一次转动时蓝点从中心飞出去。 */\n  transform: translate(-50%, -50%) rotate(-90deg) translateY(-27px);\n  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;\n}\n\n.omkb-control-base.omkb-knob--active .omkb-knob-ring { opacity: 1; }\n.omkb-control-base.omkb-knob--active .omkb-knob-dot { opacity: 1; }\n\n.omkb-joystick-dot {\n  width: 72px;\n  height: 72px;\n  border-radius: 50%;\n  background: #1a1a1a;\n  /* 推杆时抖得很快（inline style 覆盖成 .1s），松手按这条回弹曲线归位 ——\n     所以默认值就是「回弹」那条，飘出去的方向感由 JS 写 transform。 */\n  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);\n  will-change: transform;\n}\n\n.omkb-svg-icon {\n  width: 32px;\n  height: 32px;\n}\n\n.omkb-bottom-row {\n  margin-top: 16px;\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 16px;\n  align-items: stretch;\n}\n\n.omkb-knob-panel {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n}\n\n.omkb-knob-lights {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n}\n\n.omkb-knob-light {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n}\n\n.omkb-blue { background: #74a9ff; }\n.omkb-green { background: #90c968; }\n.omkb-amber { background: #e0c05a; }\n\n.omkb-circle-knob {\n  width: 70px;\n  height: 70px;\n  border-radius: 50%;\n  background: #222;\n  flex-shrink: 0;\n}\n\n.omkb-key-mic {\n  grid-column: span 2;\n  aspect-ratio: unset;\n}\n\n/* 预览模式（首次连接引导里的键盘插图，见 components/modals/guide.jsx）：\n * 只画不响应 —— 整张插图对指针透明（连 :active 的按压回弹也不要），背景交还给外层卡片。 */\n.omkb-page-wrap--preview{background:transparent}\n.omkb-page-wrap--preview .omkb-key{cursor:default;pointer-events:none}\n/* 示意色圆点（引导里那 6 颗智能体键）：白色/黑色在浅色键面上会看不见，\n * 统一加一圈极淡的内描边，让「灯珠」在四种颜色下都有轮廓。 */\n.omkb-key-dot--swatch{box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}\n\n/* ---------- 首次连接引导 ----------\n * 层级夹在本插件自己的弹窗（9999 / 二级 10002）之上、保存提示（10050）之下：\n * 引导是整屏遮罩，必须在所有设置弹窗之上；但保存提示只出现在设置页里，\n * 万一同时出现也不该被引导盖住。\n * 注意：**没有**「点遮罩关闭」——引导一旦关掉就永久记住「看过了」（见 modals/guide.jsx 顶部），\n * 误点一次等于再也看不到，所以出口只有右上角 × / 跳过 / 走完两步。 */\n.omkb-guide-overlay{z-index:10040}\n.omkb-guide{position:relative;width:min(600px,94vw);max-height:92vh;overflow:auto;padding:18px 18px 0;display:flex;flex-direction:column}\n.omkb-guide-x{position:absolute;top:6px;right:8px;z-index:2}\n.omkb-guide-shot{display:flex;justify-content:center;margin-bottom:14px;pointer-events:none}\n.omkb-guide-shot .omkb-keyboard-wrap{width:min(480px,100%);box-sizing:border-box;padding:18px;border-radius:22px;box-shadow:0 6px 20px rgba(0,0,0,.08)}\n.omkb-guide-body{padding:0 6px}\n.omkb-guide-title{font-size:20px;font-weight:700;color:#1f2937;text-align:center}\n.omkb-guide-desc{margin-top:8px;font-size:13px;line-height:1.65;color:#4b5563;text-align:center}\n.omkb-guide-status{margin-top:12px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px;font-size:13px;font-weight:500}\n.omkb-guide-sep{color:#c9c9c9}\n.omkb-guide-legend{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;text-align:left;border:1px solid #ececec;border-radius:12px;padding:12px 14px}\n.omkb-guide-legend-row{display:flex;align-items:center;gap:8px;font-size:12.5px;min-width:0}\n.omkb-guide-swatch{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}\n.omkb-guide-legend-name{font-weight:600;color:#374151;flex:none}\n.omkb-guide-legend-hint{color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.omkb-guide-note{margin-top:14px;padding:12px 14px;border-radius:12px;background:#f7f5f1;font-size:12.5px;line-height:1.65;color:#4b5563;text-align:left}\n.omkb-guide-foot{margin-top:16px;padding-bottom:18px;justify-content:center}\n@media (max-width:560px){.omkb-guide-legend{grid-template-columns:1fr}}\n\n/* ---------- 侧边栏底部：设置按钮旁边的方形键盘入口 ----------\n * 展开态：36×36 方块，**覆盖定位**贴到「设置」那一行的右端（与齿轮同一行并列），\n * 因此它不占文档流，底栏不会为它多出一行。top/right 由 JS 现场量出来写在 style 上\n * （见 components/sidebar/action.jsx 的 placeFootAction）：DSH 的类名是模块哈希、行高还会随\n * 展开/收起变化，量着放才稳。量不到就退回文档流（仍可用，只是多占一行）。\n * 收起成 56px 导轨时留在流里：36×36 居中，正好落在齿轮正上方（与 DSH 自己的导轨按钮同规格）。 */\n.omkb-foot-action{box-sizing:border-box;position:relative;width:36px;height:36px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:10px;flex:none;align-items:center;justify-content:center;margin:0;padding:0;font-family:inherit;display:flex;overflow:hidden}\n.omkb-foot-action:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.omkb-foot-action>svg{flex:none;display:block}\n/* 覆盖到设置行右端时：抬一层（压住设置行的 hover 反馈也不影响点击），并确保外边距为 0\n * ——绝对定位的 top/right 是从**外边距盒**起算的，留白由几何常量控制。 */\n.omkb-foot-action--pinned{position:absolute;z-index:1;margin:0}\n/* 导轨态：留在文档流，居中（footerActions 是横向 flex，这里只有它一个）。 */\n.omkb-foot-action--rail{align-self:center;margin:0 0 4px}\n/* 「键盘已断开」的红点（判据在 utils/device.js 的 isDeviceOffline，见 sidebar/action.jsx）。\n * 画在按钮**内圈**：按钮是 overflow:hidden（画到框外会被裁掉），而按钮 36px、图标 20px 居中，\n * 所以贴着内圈右上角 = 看起来正落在图标右上。描边用底层的颜色给红点垫开一点，\n * 免得它跟图标的线条糊在一起（`corner-shape` 由 core.js 的 omkb- 兜底规则抵掉，这里是正圆）。\n * pointer-events:none：它纯装饰，点下去仍然是「打开键盘设置页」，不把点击语义劈成两个。 */\n.omkb-foot-action__dot{position:absolute;top:3px;right:3px;width:7px;height:7px;border-radius:999px;background:var(--dsw-alias-state-error-primary,#ef4444);box-shadow:0 0 0 1.5px var(--dsw-alias-bg-layer-1,#fff);pointer-events:none}\n\n/* ---------- 「与后台断开」气泡（替代 DSH 画在「设置」那一行里的连接指示器）----------\n * 背景：DSH 的 triggerRow 里除了「设置」按钮，还并排放着一个连接状态指示器 —— 与后台断开时\n * 它是那条橙色的「自动重连中」，刚恢复时是绿色的「连接成功」。那一行是 `flex-start` 布局、\n * 设置按钮是 `flex:1`（吃满剩余宽度），所以指示器**正好落在我们贴右端的地方**：要么被键盘\n * 图标压住（2026-09-25 第一版用户截图），要么逼得我们退回文档流、图标孤零零多占一行\n * （第二版用户截图：「这个错误更加严重了」）。\n * 现行处置：**把那个指示器藏起来**（宿主 DOM 上打 data-omkb-conn-hide，React 重渲染也顶不掉），\n * 改用这个气泡展示同一句话 —— 那一行恢复成「只有一个设置按钮」，覆盖定位照常；\n * 提示没丢，点气泡还能「立即重连」（= 点那颗被藏起来的指示器，见 sidebar/action.jsx）。\n * 深色 + 小尾巴是用户指定的样式（与原生 tooltip 一致），明暗两套主题下都用深色。\n * ⚠ 2026-09-26 用户第三次报「重新连接又改回黄色错位了」：**这套气泡一直没显示出来**，\n *   因为 `gearRowOf` 取的是 `gear.parentElement`（display:contents 的槽位出口），\n *   压根找不到那个指示器 —— 于是它既没被藏、气泡也没弹，就地压住方块。根因与修法见\n *   sidebar/action.jsx 的 `gearRowOf`（改用 layoutParent）。CSS 这边没问题，别改。\n * 节点挂在 body 上、position:fixed：① 不被 footer 那一行的 overflow 裁掉；\n * ② 不在 React 管的子树里，React 重渲染不会把它顶掉（它压根管不着这个节点）。\n * top/right 由 JS 现场量（sidebar/action.jsx 的 placeConnTip），这里只管长相。\n * 小尾巴是个真元素（不是 ::after）：位置要按方块中心算，真元素写 inline style 更省事。 */\n[data-omkb-conn-hide]{display:none!important}\n.omkb-conn-tip{position:fixed;z-index:60;box-sizing:border-box;display:block;max-width:calc(100vw - 20px);padding:6px 10px;border-radius:10px;background:#1f2124;color:#fff;font-size:12.5px;line-height:18px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease}\n.omkb-conn-tip--on{opacity:1;visibility:visible;pointer-events:auto;cursor:pointer}\n.omkb-conn-tip__text{display:block;overflow:hidden;text-overflow:ellipsis}\n.omkb-conn-tip__tail{position:absolute;top:100%;right:11px;width:0;height:0;border:6px solid transparent;border-bottom:0;border-top-color:#1f2124;font-size:0;line-height:0;pointer-events:none}\n.omkb-conn-tip--below .omkb-conn-tip__tail{top:auto;bottom:100%;border-top:0;border-bottom:6px solid #1f2124}\n\n/* ── 「设置」的悬停提示：挪到行上方 + 补一根朝下的小尾巴（2026-09-26）────────────\n * DSH 的 Tooltip（dsh-client-ui-primitives）默认 side:"right"：`left = 锚点右缘 + 10px`、\n * 竖直居中。「设置」按钮被我们收窄之后，那个落点在侧边栏里面、正好压住键盘方块。\n * 用户要的位置是「在设置上面」——这里把它改到**行上方**：\n *   * 行打 data-omkb-gear-row（sidebar/action.jsx 的 markGearTip）→ position:relative 做包含块；\n *   * 提示打 data-omkb-gear-tip → 改成 absolute、贴着行上缘、左缘对齐齿轮。\n * ⚠ 内联 left/top 是 DSH 的 JS 写的（悬停时算一次、ResizeObserver 每次重算都重写），\n *   不带 !important 压不住；transform 也要清 —— [data-side=right] 自带 translateY(-50%)。\n * ⚠ `calc(100% + 8px)` 里的 8 = sidebar/action.jsx 的 TIP_ABOVE_GAP，两处数字改要一起改。\n * 标记只在「我们贴右端」的展开态打（unpin 时摘掉）：收起成导轨 / 退回文档流时提示回 DSH 默认。\n *\n * 小尾巴（::after）：用户给的样式图就是「深色圆角气泡 + 下方一个小三角」（工具提示的标准形状）。\n * 一个悬在行上方的气泡没有尾巴，看起来就像「一块压在那里的东西」——正是上一轮报的那个画面。\n * DSH 自己的 bubble 没有尾巴（它的实现是一句话 + 快捷键，没有装饰节点），所以我们自己补一根。\n * 颜色用 DSH 的 tooltip 令牌（跟主题走），别写死深色。::after 不会被裁：bubble 的 CSS 里没有\n * overflow:hidden（`.{bubble}` 只有 display/position/padding/圆角这些）。\n * `left:14px` = 齿轮左缘往右 14px，正落在齿轮图标（20px、左内边距约 10px）那一片上。 */\n[data-omkb-gear-row]{position:relative}\n[data-omkb-gear-tip]{position:absolute!important;left:var(--omkb-gear-tip-left,0)!important;right:auto!important;top:auto!important;bottom:calc(100% + 8px)!important;transform:none!important}\n[data-omkb-gear-tip]::after{content:\'\';position:absolute;top:100%;left:14px;width:0;height:0;border:6px solid transparent;border-bottom:0;border-top-color:var(--dsw-alias-tooltip-bg,#1f2124);font-size:0;line-height:0;pointer-events:none}\n\n/* ── 第三方插件依赖（设置页底部；清单来自 config/default.js 的 PLUGIN_DEPS，**常驻渲染**，\n * 清单为空时给一行占位提示 —— 见 settings/panel.jsx）──\n * 徽标复刻 .omkb-batt__tag 的胶囊造型，但用绿/红两态表达「已安装 / 未安装」。\n * 绿色/红色取 DSH 设计令牌的状态色，跟随主题（不写死色值，避免暗色主题下看不清）。 */\n.omkb-plugin-badge{font-size:11px;line-height:1;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:4px 8px;white-space:nowrap}\n.omkb-plugin-badge--on{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}\n.omkb-plugin-badge--off{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}\n';
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
  return /* @__PURE__ */ jsxRuntime.jsx("div", { onClick, className: `omkb-key ${className}`, ...rest, children });
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
const SvgIcon = ({ children }) => /* @__PURE__ */ jsxRuntime.jsx("svg", { viewBox: "0 0 24 24", className: "omkb-svg-icon", stroke: "#222", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round", children });
const CAP_ICON = {
  fast: /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" }),
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
function OmkbKeycapModal({ target, current, fallback, onCancel, onClear, onSave }) {
  const initial = current || fallback || null;
  const [pick, setPick] = React.useState(initial);
  const [q2, setQ] = React.useState("");
  const s = q2.trim().toLowerCase();
  const list = KEYCAPS.filter((c) => !s || c.id.toLowerCase().includes(s) || c.label.toLowerCase().includes(s) || c.desc.includes(s));
  const picked = keycapOf(pick);
  const dirty = pick !== initial;
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-overlay", onMouseDown: onCancel, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal", onMouseDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-head", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-title", children: "编辑按键" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-sub", children: [
          "给 ",
          target,
          " 选一颗键帽 —— 这颗键按下后就执行它对应的动作"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-modal-x", onClick: onCancel, children: "×" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(
      "input",
      {
        className: "omkb-modal-search",
        placeholder: "搜索…",
        value: q2,
        onChange: (e) => setQ(e.target.value)
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-grid omkb-capgrid", children: [
      list.map((c) => (
        /* 一格 = 键（图标）+ **键下面的名字**。名字在键**外面**：布局那边已经不带文字，
           弹窗是唯一还有名字的地方，压回键面里就又跟布局长成一样了（也把「那行字绝对定位
           甩到遮罩底部」的老毛病带回来）。点击落在外层格子，名字那一下也能选中。 */
        /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: "omkb-cap-cell" + (pick === c.id ? " omkb-cap-cell--sel" : ""),
            onClick: () => setPick(c.id),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                Key,
                {
                  className: "omkb-cap" + (pick === c.id ? " omkb-cap--sel" : ""),
                  "data-omkb-cap": c.id,
                  children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId: c.id })
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-cap-name", children: c.label })
            ]
          },
          c.id
        )
      )),
      !list.length && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-sub-empty", children: "无匹配结果" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-hint", children: picked ? `${picked.label} —— ${picked.desc}` : `当前是${CUSTOM_LABEL}：这颗键没有指派功能，按下不执行任何操作` }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-foot", children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          type: "button",
          className: "omkb-ghost",
          onClick: onClear,
          disabled: !current,
          title: "清掉这颗键的自定义键帽，回到出厂设置",
          children: "恢复默认"
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-modal-spacer" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: onCancel, children: "取消" }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          type: "button",
          className: "omkb-primary",
          disabled: !dirty,
          onClick: () => {
            if (dirty) onSave(pick);
          },
          children: "保存"
        }
      )
    ] })
  ] }) });
}
const JOY_DIRS$1 = ["up", "right", "down", "left"];
const JOY_NONE = "none";
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
   * @param options.log - 记一行日志。
   */
  constructor(options = {}) {
    __privateAdd(this, _mapping, { ...JOY_DEFAULTS });
    __privateAdd(this, _ops, null);
    __privateAdd(this, _voice, null);
    __privateAdd(this, _log2, null);
    /** 设置页写入的映射（可残缺、可为空对象）。 */
    __publicField(this, "setMapping", (saved) => {
      __privateSet(this, _mapping, resolveJoyMapping(saved));
      return this.getMapping();
    });
    /** 当前生效的映射（未绑定为 null）。 */
    __publicField(this, "getMapping", () => ({ ...__privateGet(this, _mapping) }));
    /** 某方向绑定的动作名；未绑定 / 未知方向 = null。 */
    __publicField(this, "actionOf", (dir) => dir && typeof __privateGet(this, _mapping)[dir] === "string" ? __privateGet(this, _mapping)[dir] : null);
    /** 由 hid-bridge 在方向事件时调用：查设置映射 → 执行。 */
    __publicField(this, "handle", (dir) => {
      const name = this.actionOf(dir);
      if (!name) {
        __privateGet(this, _log2).call(this, `摇杆方向「${dir}」未绑定动作，忽略`);
        return false;
      }
      return this.run(name);
    });
    /** 动作名 → 执行（设置页里选了什么就执行什么）。 */
    __publicField(this, "run", (name) => {
      const action = normalizeJoyAction(name);
      if (!action) return false;
      try {
        if (action === JOY_ACTION.BACK) return this.back();
        if (action === JOY_ACTION.FORWARD) return this.forward();
        if (action === JOY_ACTION.SIDEBAR) return this.toggleSidebar();
        if (action === JOY_ACTION.PLAN) return this.togglePlanMode();
        if (action === JOY_ACTION.SCROLL_BOTTOM) return this.scrollToBottom();
        if (action === "none") return false;
        if (action.indexOf("语音") !== -1) return this.toggleVoice();
        __privateGet(this, _log2).call(this, `摇杆动作「${action}」未接线（设置页技能类动作尚未实现），忽略`);
        return false;
      } catch (e) {
        __privateGet(this, _log2).call(this, `摇杆动作「${action}」执行异常：${e && e.message || e}`);
        return false;
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
    __privateSet(this, _log2, typeof o.log === "function" ? o.log : (msg) => {
      try {
        console.log("[omkb] " + msg);
      } catch (e) {
      }
    });
  }
}
_mapping = new WeakMap();
_ops = new WeakMap();
_voice = new WeakMap();
_log2 = new WeakMap();
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
function OmkbJoystickModal({ value, onClose, onSave }) {
  var _a;
  const [local, setLocal] = React.useState(value && Object.keys(value).length ? { ...value } : { ...JOY_DEFAULTS });
  const [editDir, setEditDir] = React.useState(null);
  const setDir = (dir, name) => setLocal({ ...local, [dir]: name });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-overlay", onMouseDown: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal omkb-modal--joy", onMouseDown: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-head", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-title", children: "模拟摇杆" }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-sub", children: "选择每个方向触发的操作" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-modal-x", onClick: onClose, children: "×" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-joy-body", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-joy-pad", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-joy-knob" }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-joy-list", children: JOY_DIRS.map(({ dir, label, arrow }) => /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: "omkb-joy-row" + (editDir === dir ? " omkb-joy-row--sel" : ""),
            onClick: () => setEditDir(dir),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-joy-arrow", children: arrow }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-joy-dir", children: label }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-joy-val", children: joyLabel(local[dir] ?? JOY_DEFAULTS[dir]) })
            ]
          },
          dir
        )) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-joy-foot", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-primary omkb-joy-done", onClick: () => onSave(local), children: "完成" }) })
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
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-overlay omkb-overlay--sub", onMouseDown: onClose, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal omkb-modal--sub", onMouseDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-head", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-sub-title", children: [
        "指定",
        title
      ] }),
      current && /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "omkb-sub-clear", onClick: onClear, children: [
        current,
        " ",
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "×" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("input", { className: "omkb-modal-search", placeholder: "搜索操作和技能", value: q2, onChange: (e) => setQ(e.target.value) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-sub-body", children: [
      cats.map((cat) => /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-sub-cat", children: cat }),
        items.filter((a) => a.cat === cat).map((a, i) => /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: "omkb-sub-pick" + (a.soon ? " omkb-sub-pick--soon" : ""),
            onClick: a.soon ? void 0 : () => onPick(a.name),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-sub-name", children: joyLabel(a.name) }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-sub-des", children: a.des })
            ]
          },
          cat + i
        ))
      ] }, cat)),
      !items.length && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-sub-empty", children: "无匹配结果" })
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
function OmkbLayout({ update, prefs = {}, clearField, preview = null }) {
  const actLabels = prefs.actLabels || {};
  const [editor, setEditor] = React.useState(null);
  const [joyOpen, setJoyOpen] = React.useState(false);
  const staticShot = !!preview;
  const swatch = preview && preview.colors || null;
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
    if (!staticShot) setEditor({ target });
  };
  const saveCap = (target, pick) => update("actLabels", { ...actLabels, [target]: pick });
  const clearCap = (target) => {
    const next = { ...actLabels };
    delete next[target];
    if (!Object.keys(next).length && typeof clearField === "function") return clearField("actLabels");
    return update("actLabels", next);
  };
  const dot = (visualId) => /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: "omkb-key-dot" + (swatch && swatch[visualId] ? " omkb-key-dot--swatch" : ""),
      style: swatch && swatch[visualId] ? { background: swatch[visualId] } : void 0
    }
  );
  const slot = (visualId, onClick, extra = "") => ({
    "data-omkb-key": visualId,
    className: [extra, shownPressed[visualId] ? "omkb-key--pressed" : ""].filter(Boolean).join(" "),
    onClick: staticShot ? void 0 : onClick || (() => tap(visualId))
  });
  const [jx, jy] = JOY_OFFSET[shownJoy] || [0, 0];
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-page-wrap" + (staticShot ? " omkb-page-wrap--preview" : ""), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-keyboard-wrap", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-grid-4col", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-control-item", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-control-base" + (shownKnob.active ? " omkb-knob--active" : ""), children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-circle-knob-inner", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-knob-ring" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: "omkb-knob-dot",
              "data-omkb-knob-dot": shownKnob.dir || "off",
              style: { transform: `translate(-50%, -50%) rotate(${knobDeg}deg) translateY(${-27}px)` }
            }
          )
        ] }) }) }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r1-2"), children: dot("r1-2") }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r1-3"), children: dot("r1-3") }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: "omkb-control-item omkb-joy-ctrl",
            "data-omkb-key": "joy",
            onClick: staticShot ? void 0 : () => setJoyOpen(true),
            children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-control-base", children: /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                className: "omkb-joystick-dot",
                "data-joy": shownJoy || "center",
                style: {
                  transform: `translate(${jx}px, ${jy}px)`,
                  transition: shownJoy ? "transform .1s ease-out" : "transform .28s cubic-bezier(.34,1.56,.64,1)"
                }
              }
            ) })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-1"), children: dot("r2-1") }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-2"), children: dot("r2-2") }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-3"), children: dot("r2-3") }),
        /* @__PURE__ */ jsxRuntime.jsx(Key, { ...slot("r2-4"), children: dot("r2-4") }),
        ACT_ROW_CODES.map((code) => {
          const capId = capFor(code, prefs);
          const visualId = code.toLowerCase();
          return /* @__PURE__ */ jsxRuntime.jsx(
            Key,
            {
              ...slot(visualId, openKeycap(code), "omkb-key--act" + (capId ? "" : " omkb-key--custom")),
              "data-omkb-cap": capId || CUSTOM_ICON,
              children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId })
            },
            code
          );
        })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-bottom-row", "data-omkb-mic": micSplit ? "split" : "merged", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-knob-panel", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-knob-lights", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-knob-light omkb-blue" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-knob-light omkb-green" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-knob-light omkb-amber" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-circle-knob" })
        ] }),
        micKeys.map((k) => /* @__PURE__ */ jsxRuntime.jsx(
          Key,
          {
            ...slot(
              k.visualId,
              openKeycap(k.code),
              (k.wide ? "omkb-key-mic " : "") + "omkb-key--act" + (k.custom ? " omkb-key--custom" : "")
            ),
            "data-omkb-cap": k.capId || CUSTOM_ICON,
            children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId: k.capId })
          },
          k.visualId
        )),
        (() => {
          const capId = capFor("ACT12", prefs);
          return /* @__PURE__ */ jsxRuntime.jsx(
            Key,
            {
              ...slot("act12", openKeycap("ACT12"), "omkb-key--act" + (capId ? "" : " omkb-key--custom")),
              "data-omkb-cap": capId || CUSTOM_ICON,
              children: /* @__PURE__ */ jsxRuntime.jsx(KeyFace, { capId })
            }
          );
        })()
      ] })
    ] }),
    !staticShot && editor && /* @__PURE__ */ jsxRuntime.jsx(
      OmkbKeycapModal,
      {
        target: editor.target,
        current: actLabels[editor.target] || null,
        fallback: capFor(editor.target, prefs),
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
      OmkbJoystickModal,
      {
        value: prefs.joystick,
        onClose: () => setJoyOpen(false),
        onSave: (cfg) => {
          update("joystick", cfg);
          setJoyOpen(false);
        }
      }
    )
  ] });
}
const RESET_GROUPS = [
  {
    title: "键盘布局",
    items: [
      "键帽：动作键回到 FAST / ARCH / REJ / APPR / MIC / SEND；拆分态的右开关回到「自定义」（未指派）",
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
function OmkbResetModal({ onCancel, onConfirm }) {
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-overlay", onMouseDown: onCancel, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal", onMouseDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-head", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-title", children: "重置布局" }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-sub", children: "把下面这些改回出厂设置，并保存" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-modal-x", onClick: onCancel, children: "×" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-reset-body", children: RESET_GROUPS.map((g) => /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-sub-cat", children: g.title }),
      /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "omkb-reset-list", children: g.items.map((it) => /* @__PURE__ */ jsxRuntime.jsx("li", { children: it }, it)) })
    ] }, g.title)) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-foot", children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: onCancel, children: "取消" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-primary", onClick: onConfirm, children: "重置" })
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
function OmkbRemoveModal({ tt, onCancel, onConfirm }) {
  const t = typeof tt === "function" ? tt : (k) => k;
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-overlay", onMouseDown: onCancel, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal", onMouseDown: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-head", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-title", children: t("remove.title") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-sub", children: t("remove.sub") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-modal-x", "aria-label": t("remove.cancel"), onClick: onCancel, children: "×" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-reset-body", children: [
      /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "omkb-reset-list", children: ITEM_KEYS.map((k) => /* @__PURE__ */ jsxRuntime.jsx("li", { children: t(k) }, k)) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-hint", children: t("remove.hint") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-foot", children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: onCancel, children: t("remove.cancel") }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-primary omkb-primary--danger", onClick: onConfirm, children: t("remove.confirm") })
    ] })
  ] }) });
}
const SAVE_TOAST_TEXT = { saving: "settings.saving", saved: "settings.saved", error: "settings.saveError" };
function OmkbSaveToast({ status, t }) {
  if (!status) return null;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-toast omkb-toast--" + status, role: "status", "aria-live": "polite", children: [
    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-toast__ico", "aria-hidden": "true", children: status === "saving" ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-toast__spin" }) : /* @__PURE__ */ jsxRuntime.jsxs(
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
    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-toast__text", children: t(SAVE_TOAST_TEXT[status] || "settings.saveError") })
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
const AGENT_CODES = ["AG00", "AG01", "AG02", "AG03", "AG04", "AG05"];
const agentVisualIds = () => AGENT_CODES.map((code) => KEY_LAYOUT[code]).filter(Boolean);
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
const GUIDE_AGENT_SWATCH = [
  AGENT_COLOR_RGB.working,
  AGENT_COLOR_RGB.idle,
  AGENT_COLOR_RGB.working,
  AGENT_COLOR_RGB.off,
  AGENT_COLOR_RGB.error,
  AGENT_COLOR_RGB.idle
];
const agentSwatchByVisualId = () => {
  const ids = agentVisualIds();
  const out = {};
  ids.forEach((id, i) => {
    if (i < GUIDE_AGENT_SWATCH.length) out[id] = rgbHex(GUIDE_AGENT_SWATCH[i]);
  });
  return out;
};
const SWATCH = agentSwatchByVisualId();
const TITLE = { welcome: "guide.welcome.title", agents: "guide.agents.title", commands: "guide.commands.title" };
const DESC = { welcome: "guide.welcome.desc", agents: "guide.agents.desc", commands: "guide.commands.desc" };
const LEGEND_HINT = {
  "guide.legend.running": "guide.legend.runningHint",
  "guide.legend.idle": "guide.legend.idleHint",
  "guide.legend.error": "guide.legend.errorHint",
  "guide.legend.empty": "guide.legend.emptyHint"
};
const snapshot = (g) => ({ open: !!(g && g.open), step: g && g.step || "welcome" });
function OmkbGuideHost({ t, onOpenSettings }) {
  const guide = DSVI.services ? DSVI.services.guide : null;
  const [snap, setSnap] = React.useState(() => snapshot(guide));
  React.useEffect(() => {
    if (!guide || typeof guide.subscribe !== "function") return void 0;
    setSnap(snapshot(guide));
    return guide.subscribe(() => setSnap(snapshot(guide)));
  }, [guide]);
  if (!guide || !snap.open) return null;
  return /* @__PURE__ */ jsxRuntime.jsx(OmkbGuide, { t, guide, step: snap.step, onOpenSettings });
}
function OmkbGuide({ t, guide, step, onOpenSettings }) {
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
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-modal-overlay omkb-guide-overlay", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal omkb-guide", "data-omkb-guide": step, role: "dialog", "aria-modal": "true", children: [
    /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-modal-x omkb-guide-x", onClick: close, "aria-label": tt("guide.close"), children: "×" }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-guide-shot", children: /* @__PURE__ */ jsxRuntime.jsx(OmkbLayout, { update: noop, prefs: guide.prefs || {}, preview: { colors: SWATCH } }) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-guide-body", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-guide-title", children: tt(TITLE[step] || TITLE.welcome) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-guide-desc", children: tt(DESC[step] || DESC.welcome) }),
      step === "welcome" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-guide-status", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-dot omkb-dot--ok" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: tt("guide.connected") }),
        monitorVisible(monitor) && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-guide-sep", children: "·" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-dot " + md.cls }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: md.statusCls, children: [
            tt("guide.monitor"),
            " ",
            tt(md.labelKey)
          ] })
        ] })
      ] }),
      step === "agents" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-guide-legend", children: GUIDE_LEGEND.map((row) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-guide-legend-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-guide-swatch", style: { background: rgbHex(row.color) } }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-guide-legend-name", children: tt(row.labelKey) }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-guide-legend-hint", children: tt(LEGEND_HINT[row.labelKey] || "") })
      ] }, row.key)) }),
      step === "commands" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-guide-note", children: tt("guide.commands.note") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-modal-foot omkb-guide-foot", children: [
      !isFirstStep(step) && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: () => guide.back(), children: tt("guide.back") }),
      step === "welcome" && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: close, children: tt("guide.skip") }),
      last && typeof onOpenSettings === "function" && /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: goSettings, children: tt("guide.settings") }),
      last ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-primary", onClick: close, children: tt("guide.finish") }) : /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-primary", onClick: () => guide.next(), children: tt(step === "welcome" ? "guide.start" : "guide.last") })
    ] })
  ] }) });
}
const noop = () => {
};
const FOOT_ACTION_SLOT = DSVI.SLOT_FOOT_ACTION;
const FOOT_ACTION_ID = "omkb-keyboard";
const SETTINGS_OUTLET_SEL = '[data-slot="sidebar.settings"]';
const SETTINGS_TRIGGER_SEL = 'button[aria-haspopup="dialog"]';
const NAV_SCOPE_SEL = 'nav, [role="dialog"]';
const BUTTON_SIZE = 36;
const ICON_SIZE = 20;
const GEAR_INSET = 10;
const GEAR_GAP = 8;
const MIN_GEAR_WIDTH = 96;
const CONN_NOTICE_SEL = 'button[data-phase],[role="status"]';
const NOTICE_HIDE_ATTR = "data-omkb-conn-hide";
const TIP_GAP = 6;
const TIP_TAIL = 12;
const GEAR_ROW_ATTR = "data-omkb-gear-row";
const GEAR_TIP_ATTR = "data-omkb-gear-tip";
const NAV_WAIT_MS = 1200;
const POLL_MS = 16;
const warn$1 = (msg) => {
  try {
    console.warn("[omkb] " + msg);
  } catch (e) {
  }
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
  return q(outlet, SETTINGS_TRIGGER_SEL) || q(root, SETTINGS_TRIGGER_SEL);
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
const openKeyboardSettings = async (label, opts = {}) => {
  if (typeof document === "undefined") return false;
  const waitMs = opts && Number.isFinite(opts.waitMs) ? opts.waitMs : NAV_WAIT_MS;
  const outlet = q(document, SETTINGS_OUTLET_SEL);
  const scopes = [outlet, document].filter(Boolean);
  const labels = candidateLabels(label);
  const found = findSectionRow(labels, scopes);
  if (found) {
    if (isActiveRow(found)) return true;
    return clickEl(found, "分区导航行");
  }
  const trigger = triggerEl(document);
  if (!trigger) {
    warn$1('找不到侧边栏设置按钮（[data-slot="sidebar.settings"] button[aria-haspopup="dialog"]），无法打开键盘设置页');
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
  warn$1(`设置弹窗里没找到本插件的分区行（候选标题：${labels.join(" / ") || "无"}）`);
  return false;
};
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
    if (typeof row.style.setProperty === "function") row.style.setProperty("--omkb-gear-tip-left", left + "px");
    else row.style["--omkb-gear-tip-left"] = left + "px";
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
    if (typeof row.style.removeProperty === "function") row.style.removeProperty("--omkb-gear-tip-left");
    else delete row.style["--omkb-gear-tip-left"];
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
  button.__omkbGear = hosts.gear;
  button.style.position = "absolute";
  setClass(button, "omkb-foot-action--pinned", true);
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
  unmarkGearTip(button.__omkbGear || hosts0 && hosts0.gear);
  setClass(button, "omkb-foot-action--pinned", false);
  for (const k of ["position", "top", "right", "left"]) {
    try {
      button.style[k] = "";
    } catch (e) {
    }
  }
  narrowGear(button.__omkbGear || (findFootHosts(button) || {}).gear, null);
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
  setClass(tipEl, "omkb-conn-tip", true);
  setClass(tipTextEl, "omkb-conn-tip__text", true);
  setClass(tipTailEl, "omkb-conn-tip__tail", true);
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
  setClass(tip, "omkb-conn-tip--below", below);
  return { top, right, below };
};
const syncConnTip = (button, notice, opts = {}) => {
  const tip = connTipNode();
  if (!button || !notice) {
    if (tip) setClass(tip, "omkb-conn-tip--on", false);
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
  setClass(tip, "omkb-conn-tip--on", true);
  placeConnTip(tip, button, opts);
  return true;
};
const disposeConnTip = () => {
  if (!tipEl) return;
  setClass(tipEl, "omkb-conn-tip--on", false);
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
DSVI.openKeyboardSettings = openKeyboardSettings;
DSVI.leaveOurSection = leaveOurSection;
DSVI.footAction = {
  open: openKeyboardSettings,
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
  // `__dshOmkb.footAction.tipNode()` 看那颗气泡节点长什么样）。
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
function OmkbSidebarAction({ wide, t }) {
  const ref = React.useRef(null);
  const tr = typeof t === "function" ? t : null;
  const dict = DSVI && DSVI.locales && DSVI.locales.zh || {};
  const label = tr && tr("sidebar.action") || dict["sidebar.action"] || "OMKB";
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
      if (!ok) warn$1("没能直接打开键盘设置页，可手动从设置里进入「" + (dict.nav || "OMKB") + "」");
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
        "data-omkb-foot": "1",
        className: "omkb-foot-action" + (wide ? "" : " omkb-foot-action--rail"),
        "aria-label": tip,
        title: tip,
        onClick,
        children: offline ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          KeypadIcon(ICON_SIZE),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-foot-action__dot" })
        ] }) : KeypadIcon(ICON_SIZE)
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(OmkbGuideHost, { t: tr, onOpenSettings: () => {
      onClick();
    } })
  ] });
}
DSVI.OMKB_DEFAULTS = OMKB_DEFAULTS;
DSVI.css += settingsCss;
const listSessions = (snapshot2, workspaces) => visibleSessions(snapshot2, archivedIdsOf(workspaces));
const KNOB_ACTION_OPTIONS = knobActions().map((a) => [a.id, a.label]);
const GESTURES = [
  ["cw", "opts.knobCustom.cw"],
  ["ccw", "opts.knobCustom.ccw"],
  ["click", "opts.knobCustom.click"],
  ["long", "opts.knobCustom.long"]
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
function OmkbSettingsSection({ scope, t, sessions, workspaces }) {
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
  const [prefs, setPrefs] = React.useState(() => ({ ...DSVI.OMKB_DEFAULTS, ...initial }));
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
    if (typeof sc.unset !== "function") return persist(key, DSVI.OMKB_DEFAULTS[key], opts);
    return persistWrite(key, () => sc.unset(key), DSVI.OMKB_DEFAULTS[key], opts);
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
      fetch("/omkb/config", {
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
      for (const key of keys) next[key] = DSVI.OMKB_DEFAULTS[key];
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
        const run = canUnset ? Promise.resolve(sc.unset(key)) : Promise.resolve(sc.set(key, DSVI.OMKB_DEFAULTS[key]));
        return run.catch(() => {
        });
      });
    }
    chain.then(() => readBack((snap) => keys.every(
      // 「清掉了」有两种同样正确的样子：DSH 的镜像会把 schema 默认值补齐（unset 之后读回来
      // 是默认值），有的版本则干脆不返回这个字段。两种都算成功 —— 只认前者，换个 DSH
      // 版本就会把「写成功了」报成失败（见 client/device.js 里同一处判据）。
      (key) => (snap.value || {})[key] === void 0 || sameJson((snap.value || {})[key], DSVI.OMKB_DEFAULTS[key])
    ))).then((ok) => {
      if (seq === writeSeq.current) showSaveStatus(ok ? "saved" : "error");
    });
  };
  React.useEffect(() => {
    if (typeof fetch !== "function") return void 0;
    const poll = () => {
      fetch("/omkb/state", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
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
    if (typeof fetch === "function") fetch("/omkb/reconnect", { method: "POST" }).catch(() => {
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
      if (ok) {
        try {
          leaveOurSection(tt("nav"));
        } catch (e) {
        }
      }
    });
  };
  React.useEffect(() => {
    const hid = DSVI.services ? DSVI.services.hid : null;
    if (!hid || typeof hid.enterSim !== "function") return void 0;
    return hid.enterSim();
  }, []);
  const brightnessPct = Math.round((prefs.brightness ?? DSVI.OMKB_DEFAULTS.brightness) * 100);
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
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-wrap", children: [
    /* @__PURE__ */ jsxRuntime.jsx(OmkbSaveToast, { status: saveStatus, t: tt }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-heading", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "omkb-title", children: tt("settings.title") }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: "omkb-subtitle", children: tt("settings.subtitle") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", style: { borderTop: "none" }, children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("conn.title") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: conn.open ? "omkb-dot omkb-dot--ok" : "omkb-dot omkb-dot--err" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: conn.open ? "omkb-status omkb-status--ok" : "omkb-status omkb-status--err", children: conn.open ? tt("conn.connected") : tt("conn.disconnected") })
        ] })
      ] }),
      conn.open ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", "data-omkb-battery": batt.known ? String(batt.pct) : "unknown", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("conn.battery") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-batt" + (batt.low ? " omkb-batt--low" : ""), children: /* @__PURE__ */ jsxRuntime.jsx(BatteryIcon, { pct: batt.pct, charging: batt.charging }) }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-batt__val" + (batt.low ? " omkb-batt__val--low" : ""), children: batt.known ? batt.pct + "%" : "—" }),
          batt.charging ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-batt__tag", children: tt("conn.charging") }) : null
        ] })
      ] }) : null,
      conn.open ? null : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-hint", style: { marginTop: 0 }, children: tt("conn.desc") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: reconnect, children: tt("conn.retry") }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost omkb-ghost--danger", onClick: () => setRemoveOpen(true), children: tt("conn.remove") })
        ] })
      ] })
    ] }),
    removeOpen ? /* @__PURE__ */ jsxRuntime.jsx(
      OmkbRemoveModal,
      {
        tt,
        onCancel: () => setRemoveOpen(false),
        onConfirm: doRemove
      }
    ) : null,
    monitorVisible(monitor) ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("monitor.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("monitor.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-dot " + monitorDot(monitor).cls }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-status " + monitorDot(monitor).statusCls, children: tt(monitorDot(monitor).labelKey) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-hint", style: { marginTop: 0 }, children: monitor.granted === false ? tt("monitor.hintDenied") : monitor.granted === true ? monitor.detail || "" : tt("monitor.hintUnknown") }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__ctrl", children: [
          monitorNeedsSettings(monitor) ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: openPrivacy, children: tt("monitor.open") }) : null,
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "omkb-ghost", onClick: recheckMonitor, children: tt("monitor.retry") })
        ] })
      ] })
    ] }) : null,
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("brightness.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("brightness.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__ctrl", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "range",
              min: 0,
              max: 100,
              step: 1,
              value: brightnessPct,
              className: "omkb-slider",
              "aria-label": tt("brightness.title"),
              onChange: (e) => setBrightness(Number(e.target.value) / 100)
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-val", children: brightnessPct + "%" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("autoDim.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("autoDim.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "select",
          {
            className: "omkb-select",
            value: String(autoDim),
            "aria-label": tt("autoDim.title"),
            onChange: (e) => setAutoDim(Number(e.target.value)),
            children: AUTO_DIM_OPTIONS.map(([v, key]) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: String(v), children: tt(key) }, String(v)))
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("layout.title") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("layout.desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            className: "omkb-ghost",
            onClick: () => setResetOpen(true),
            children: tt("layout.reset")
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-hint omkb-sim-hint", "data-omkb-simhint": "1", children: tt("layout.simHint") }),
      /* @__PURE__ */ jsxRuntime.jsx(OmkbLayout, { prefs, update, clearField })
    ] }),
    resetOpen ? /* @__PURE__ */ jsxRuntime.jsx(
      OmkbResetModal,
      {
        onCancel: () => setResetOpen(false),
        onConfirm: () => {
          setResetOpen(false);
          resetLayout();
        }
      }
    ) : null,
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("opts.agentKey") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("opts.agentKeyDesc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsxs(
          "select",
          {
            className: "omkb-select",
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
      agentKey === "custom" ? [0, 1, 2, 3, 4, 5].map((n) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("opts.agentAssign.slot") + " " + (n + 1) }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsxs(
          "select",
          {
            className: "omkb-select",
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
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("opts.knob") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("opts.knob." + knob + ".desc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsxs(
          "select",
          {
            className: "omkb-select",
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
      knob === "custom" ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("opts.knobCustom") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("opts.knobCustomDesc") })
      ] }) }) : null,
      knob === "custom" ? GESTURES.map(([g, labelKey]) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt(labelKey) }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "select",
          {
            className: "omkb-select",
            value: String(knobCustom[g] || "none"),
            "aria-label": tt(labelKey),
            onChange: (e) => update("knobCustom", { ...knobCustom, [g]: e.target.value }),
            children: KNOB_ACTION_OPTIONS.map(([v, key]) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: v, children: tt(key) }, v))
          }
        ) })
      ] }, "knob-gesture-" + g)) : null,
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("opts.micKey") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("opts.micKeyDesc") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": !!prefs.micKey,
            "aria-label": tt("opts.micKey"),
            className: "omkb-switch",
            "data-on": prefs.micKey || void 0,
            onClick: () => update("micKey", !prefs.micKey)
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-card", "data-omkb-plugins": "1", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: tt("plugins.title") }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("plugins.desc") })
      ] }) }),
      plugins.length ? plugins.map((p) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row", "data-omkb-plugin": p.plugin, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__label", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__title", children: p.name }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "omkb-row__desc", children: [
            p.desc || null,
            p.desc && p.usedBy.length ? " · " : null,
            p.usedBy.length ? tt("plugins.usedBy") + p.usedBy.map((id) => pluginKeyLabel(id, tt)).join("、") : null
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__ctrl", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "omkb-plugin-badge" + (p.installed ? " omkb-plugin-badge--on" : " omkb-plugin-badge--off"), children: p.installed ? tt("plugins.installed") : tt("plugins.missing") }) })
      ] }, p.plugin)) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row", "data-omkb-plugins-empty": "1", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__label", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "omkb-row__desc", children: tt("plugins.empty") }) }) })
    ] })
  ] });
}
const WHY$1 = {
  ready: "ok",
  seen: "已看过（guideSeen=true）",
  offline: "设备未连接（/omkb/state.open !== true）",
  already: "本次页面会话里已经弹过",
  norecord: "设置作用域不可写，弹了也记不住",
  nodeps: "没有 hid 桥（收不到 /omkb/state 广播）"
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
    __privateAdd(this, _shown, false);
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
      if (was && !this.seen) __privateSet(this, _shown, false);
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
     * 每帧 /omkb/state 都会走这里 —— 所以第一件事就是短路，
     * 别让一个纯界面的判断跑在 120ms 的热路径上做大动作。
     */
    __privateAdd(this, _onState, (s) => {
      if (__privateGet(this, _shown) || __privateGet(this, _open)) return;
      const open = !!(s && s.open === true);
      if (!__privateGet(this, _canRemember).call(this)) return;
      if (!shouldShowGuide({ open, seen: this.seen })) return;
      __privateSet(this, _shown, true);
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
      __privateSet(this, _shown, true);
      __privateGet(this, _emit3).call(this);
      return true;
    });
    /** 诊断快照：`__dshOmkb.services.guide.diagnose()` 直接答「为什么没弹」。 */
    __publicField(this, "diagnose", () => {
      let why = WHY$1.ready;
      if (__privateGet(this, _shown) || __privateGet(this, _open)) why = WHY$1.already;
      else if (!__privateGet(this, _hid) || typeof __privateGet(this, _hid).subscribe !== "function") why = WHY$1.nodeps;
      else if (!__privateGet(this, _canRemember).call(this)) why = WHY$1.norecord;
      else if (this.seen) why = WHY$1.seen;
      else why = WHY$1.offline;
      return {
        shown: __privateGet(this, _shown),
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
    return __privateGet(this, _shown);
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
_shown = new WeakMap();
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
  nodeps: "没有 hid 桥（收不到 /omkb/state 广播）",
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
     * 每帧 /omkb/state 都会走这里（120ms），所以先比再发，不做多余的重渲染。
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
          console.warn("[omkb] 设备已重连，但没能把「已移除」标记写回设置（界面照常显示，只是下次拔掉设备会再收起来一次）");
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
   * @param options.log - 记一行日志（默认 console.log 加 `[omkb] ` 前缀）。
   */
  constructor(options = {}) {
    /** ctx.sessions（会话快照 / 投影）。 */
    __publicField(this, "sessions", null);
    /** ctx 上的 conversation 服务（composer 输入机的入口）。 */
    __publicField(this, "conversation", null);
    __privateAdd(this, _services2, () => void 0);
    __privateAdd(this, _log3, null);
    /** composer 的输入动作（由对话输入区槽位组件在挂载时交给我们，见 bindComposer）。 */
    __privateAdd(this, _composer, null);
    /** 输入区导航的当前位置（环停在第几个候选上）。 */
    __privateAdd(this, _navIndex, -1);
    __privateAdd(this, _navList, []);
    __publicField(this, "log", (msg) => {
      __privateGet(this, _log3).call(this, msg);
    });
    __privateAdd(this, _service2, (name) => {
      try {
        return __privateGet(this, _services2).call(this, name);
      } catch (e) {
        return void 0;
      }
    });
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
    // ---------------- 待确认交互（APPR 批准 / REJ 拒绝） ----------------
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
          this.log(`待确认交互是「${pending.kind || "?"}」：需要逐项作答，${approve ? "批准" : "拒绝"}键不代替你选，忽略`);
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
     * 两个面板的按钮顺序一致（拒绝在左、允许/确认在右，见 ./dom.js 的 interactionPanelButtons），
     * 所以取「最后一个 = 批准、第一个 = 拒绝」。只在服务拿不到时走这条路。
     */
    __privateAdd(this, _answerOnPanel, (approve) => {
      const btns = interactionPanelButtons();
      if (!btns.length) {
        this.log(`${approve ? "批准" : "拒绝"}失败：当前会话没有待确认的交互（也没找到审批面板）`);
        return false;
      }
      const el = approve ? btns[btns.length - 1] : btns[0];
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
      const composer = __privateGet(this, _composer);
      if (composer && typeof composer.setDraft === "function") {
        try {
          composer.setDraft(next);
          return true;
        } catch (e) {
        }
      }
      const input = this.input();
      if (input && typeof input.setDraft === "function") {
        try {
          input.setDraft(next);
          return true;
        } catch (e) {
        }
      }
      this.log("写回输入框失败：既没有 composer 输入动作，输入机也不提供 setDraft");
      return false;
    });
    // ---------------- 会话动作（ARCH 归档 / FORK 分叉） ----------------
    /**
     * 归档当前会话。
     * ① 官方客户端服务 `uiWorkspace.archiveSession` —— DSH 侧边栏里那个「归档」动作走的就是它
     *    （会同时处理「归档的正好是当前会话 → 清掉当前选择」）。
     * ② 退路：宿主旁路路由 POST /omkb/archive（宿主 workspaceRegistry.archiveSession；见 src/core/index.js）。
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
        this.log("归档失败：认不出当前会话（快照里既没有 current，也没有被主视图持有的那条）");
        return false;
      }
      const ui = __privateGet(this, _service2).call(this, "uiWorkspace");
      if (ui && typeof ui.archiveSession === "function") {
        Promise.resolve().then(() => ui.archiveSession(sid)).catch((e) => this.log(archiveFailureText(e)));
        return true;
      }
      if (typeof fetch === "function") {
        fetch("/omkb/archive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sid })
        }).then(
          (res) => {
            if (res && res.ok === false) this.log(`归档失败：宿主路由 /omkb/archive 返回 ${res.status}`);
          },
          (e) => this.log(`归档失败：宿主路由 /omkb/archive 不可达（${e && e.message || e}）`)
        );
        return true;
      }
      this.log("拿不到归档入口：既没有 uiWorkspace 服务，也不在浏览器环境里");
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
        this.log("当前没有会话，无法分叉");
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
      this.log("拿不到分叉入口：既没有 uiWorkspace.forkSession，sessions 也没有 fork");
      return false;
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
      this.log("拿不到 layout 服务，界面上也找不到侧边栏开关，忽略");
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
        this.log("当前没有会话，无法切换规划模式");
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
      this.log("拿不到 /plan 命令通道，无法切换规划模式");
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
      let idx = list.indexOf(document.querySelector("[data-omkb-knob]"));
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
      if (idx < 0 || idx >= list.length) idx = list.indexOf(document.querySelector("[data-omkb-knob]"));
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
    // ---------------- 仅推理 ----------------
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
    const o = options || {};
    this.sessions = o.sessions || null;
    this.conversation = o.conversation || null;
    __privateSet(this, _services2, typeof o.services === "function" ? o.services : () => void 0);
    __privateSet(this, _log3, typeof o.log === "function" ? o.log : (msg) => {
      try {
        console.log("[omkb] " + msg);
      } catch (e) {
      }
    });
  }
}
_services2 = new WeakMap();
_log3 = new WeakMap();
_composer = new WeakMap();
_navIndex = new WeakMap();
_navList = new WeakMap();
_service2 = new WeakMap();
_answerOnPanel = new WeakMap();
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
const NAV_MARK = "data-omkb-navicon";
const NAV_ICON_SEL = "svg.dshp-settings-nav-icon";
const NAV_SIDE_SEL = '[data-slot-sidebar="dsh-tauri-ui"]';
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
    console.warn("[omkb] " + msg);
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
    return !!document.querySelector(NAV_SIDE_SEL);
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
    status: navRowStatus
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
DSVI.inject = ["slots", "locale", "configForms", "sessions", "workspaces"];
const err = (tag, e) => {
  try {
    console.error("[omkb] 装配失败 " + tag + ":", e);
  } catch (_) {
  }
};
DSVI.apply = (ctx) => {
  try {
    ctx.effect(DSVI.installStyles, `${DSVI.NS}: styles`);
  } catch (e) {
    err("styles", e);
  }
  let voice = null, agents = null, keypad = null, knob = null, joystick = null, hid = null, ops = null, guide = null, device = null;
  try {
    voice = new VoiceController();
    agents = new AgentController({ services: (name) => ctx.get(name) });
    agents.setSessions(ctx.sessions);
    agents.setWorkspaces(ctx.workspaces);
    const conversation = ctx.get("conversation") || null;
    if (conversation) agents.setConversation(conversation);
    ops = new DshOps({
      sessions: ctx.sessions,
      conversation,
      services: (name) => ctx.get(name)
    });
    keypad = new KeypadController({ voice, ops });
    knob = new KnobController({ voice, ops });
    joystick = new JoystickController({ ops, voice });
    hid = new HidBridge({ agents, keypad, knob, joystick });
    guide = new GuideController({ hid });
    device = new DeviceController({ hid, defaults: DSVI.OMKB_DEFAULTS });
    DSVI.services = { voice, agents, keypad, knob, joystick, hid, ops, guide, device };
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
      isTextEntry
    };
    DSVI.actions = { list: () => ACTIONS, run: runAction, keycaps: keycapActions, knob: knobActions };
    try {
      if (typeof window !== "undefined") window.__dshOmkb = DSVI;
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
      () => ctx.slots.register({ name: DSVI.SLOT_INPUT, id: "omkb-voice", order: 100 }, VoiceInputButton)
    );
    ctx.slots.inject("settings.section", () => {
      const dispose = ctx.slots.register({
        name: "settings.section",
        id: "omkb",
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
      }, OmkbSettingsSection);
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
      }, OmkbSidebarAction);
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
