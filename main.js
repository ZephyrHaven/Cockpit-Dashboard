'use strict';
var obsidian = require('obsidian');

// ===== styles.css =====
const CSS = "/* styles.css — Cockpit Dashboard v2 */\n/* Note: ${PLUGIN_ID} has been replaced with cockpit-dashboard */\n\n:root {\n  --cockpit-accent: #48b4ff;\n  --cockpit-accent-light: rgba(72,180,255,0.12);\n  --cockpit-accent-glow: rgba(72,180,255,0.25);\n}\n\n.cockpit-dashboard-root { \n  padding: 16px 24px; \n  max-width: 960px; \n  margin: 0 auto; \n  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;\n  position: relative;\n  --accent: var(--cockpit-accent);\n  --accent-light: var(--cockpit-accent-light);\n}\n.cockpit-dashboard-root ::selection {\n  background: rgba(72,180,255,0.18);\n  color: var(--text-normal);\n}\n.cockpit-dashboard-hero { \n  text-align: center; \n  padding: 20px 20px 14px; \n  background: linear-gradient(135deg, rgba(72,180,255,0.06), rgba(167,139,250,0.03));\n  border-radius: 16px;\n  margin: 8px 0 12px;\n  border: 1px solid rgba(72,180,255,0.08);\n  position: relative;\n}\n.cockpit-dashboard-hero-controls {\n  position: absolute;\n  top: 14px;\n  right: 14px;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  justify-content: flex-end;\n  z-index: 3;\n}\n.cockpit-dashboard-layout-done {\n  width: 36px;\n  height: 36px;\n  display: none;\n  align-items: center;\n  justify-content: center;\n  position: fixed;\n  top: 22px;\n  right: 22px;\n  border: 1px solid rgba(72,180,255,0.2);\n  border-radius: 999px;\n  background: linear-gradient(135deg, #48b4ff, #7c9cff);\n  color: white;\n  font-size: 1em;\n  font-weight: 800;\n  cursor: pointer;\n  box-shadow: 0 10px 24px rgba(72,180,255,0.24);\n  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;\n  z-index: 120;\n}\n.cockpit-dashboard-layout-done:hover {\n  transform: translateY(-1px) scale(1.03);\n  box-shadow: 0 14px 28px rgba(72,180,255,0.28);\n  filter: saturate(1.06);\n}\n.cockpit-dashboard-lang-switch {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 4px;\n  border-radius: 999px;\n  border: 1px solid rgba(72,180,255,0.12);\n  backdrop-filter: blur(14px) saturate(1.1);\n  user-select: none;\n  -webkit-user-select: none;\n  touch-action: manipulation;\n  pointer-events: auto;\n}\n.theme-dark .cockpit-dashboard-lang-switch {\n  background: linear-gradient(180deg, rgba(37, 45, 58, 0.96), rgba(29, 36, 48, 0.94));\n  border-color: rgba(72,180,255,0.2);\n  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.2);\n}\n.theme-light .cockpit-dashboard-lang-switch {\n  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,246,252,0.96));\n  border-color: rgba(72,180,255,0.18);\n  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px rgba(72,180,255,0.08);\n}\n.cockpit-dashboard-lang-btn {\n  border: none;\n  background: transparent;\n  color: var(--text-normal);\n  font-size: 0.7em;\n  font-weight: 700;\n  letter-spacing: 0.03em;\n  padding: 5px 10px;\n  border-radius: 999px;\n  cursor: pointer;\n  position: relative;\n  overflow: hidden;\n  user-select: none;\n  -webkit-user-select: none;\n  transition: transform 0.18s ease, filter 0.18s ease, color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;\n}\n.theme-dark .cockpit-dashboard-lang-btn {\n  color: rgba(226,232,240,0.72);\n}\n.theme-light .cockpit-dashboard-lang-btn {\n  color: rgba(15,23,42,0.62);\n}\n.cockpit-dashboard-lang-btn:hover {\n  color: var(--text-normal);\n  background: rgba(72,180,255,0.1);\n  filter: saturate(1.08) brightness(1.02);\n  transform: translateY(-1px);\n}\n.cockpit-dashboard-lang-btn.active {\n  color: white;\n  background: linear-gradient(135deg, #48b4ff, #6bc8ff);\n  box-shadow: 0 6px 16px rgba(72,180,255,0.22);\n}\n.theme-light .cockpit-dashboard-lang-btn.active {\n  box-shadow: 0 6px 16px rgba(72,180,255,0.18);\n}\n.cockpit-dashboard-lang-btn::after {\n  content: '';\n  position: absolute;\n  inset: 0;\n  background: radial-gradient(circle at center, rgba(255,255,255,0.42), rgba(255,255,255,0));\n  opacity: 0;\n  transform: scale(0.6);\n  transition: opacity 0.18s ease, transform 0.22s ease;\n}\n.cockpit-dashboard-lang-btn:hover::after {\n  opacity: 0.5;\n  transform: scale(1);\n}\n.cockpit-dashboard-lang-btn.pressing {\n  transform: scale(0.96);\n  filter: saturate(1.12) brightness(0.98);\n}\n.cockpit-dashboard-lang-btn.pressing::after {\n  opacity: 0.68;\n  transform: scale(1.08);\n}\n.cockpit-dashboard-greeting { \n  font-size: 1.5em; \n  font-weight: 800; \n  background: linear-gradient(135deg, #48b4ff, #60c0ff, #a78bfa);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  background-clip: text;\n  padding: 0 88px;\n}\n.cockpit-dashboard-sub { \n  color: var(--text-muted); \n  font-size: 0.78em; \n  margin-top: 4px;\n  letter-spacing: 0.02em;\n}\n.cockpit-dashboard-toolbar { \n  display: flex; \n  gap: 10px; \n  justify-content: center; \n  flex-wrap: wrap; \n  margin: 16px 0;\n}\n.cockpit-dashboard-toolslot {\n  position: relative;\n  display: flex;\n  align-items: center;\n}\n.cockpit-dashboard-toolbtn { \n  display: flex; \n  align-items: center; \n  gap: 6px; \n  padding: 8px 16px; \n  background: var(--background-secondary); \n  border: 1px solid var(--background-modifier-border); \n  border-radius: 12px; \n  color: var(--text-normal); \n  font-size: 0.82em; \n  font-weight: 600; \n  cursor: pointer; \n  position: relative;\n  overflow: hidden;\n  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s ease;\n}\n.cockpit-dashboard-toolbtn:hover { \n  border-color: var(--interactive-accent); \n  box-shadow: 0 4px 16px rgba(72,180,255,0.15); \n  transform: translateY(-2px);\n  filter: saturate(1.06) brightness(1.01);\n}\n.cockpit-dashboard-toolbtn.primary { \n  background: var(--interactive-accent); \n  border-color: var(--interactive-accent); \n  color: white;\n  box-shadow: 0 2px 8px rgba(72,180,255,0.2);\n}\n.cockpit-dashboard-toolbtn.primary:hover {\n  box-shadow: 0 6px 20px rgba(72,180,255,0.3);\n  transform: translateY(-3px);\n}\n.cockpit-dashboard-toolbtn:disabled {\n  cursor: default;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-toolbtn:disabled:hover {\n  border-color: var(--background-modifier-border);\n  box-shadow: none;\n  transform: none;\n  filter: none;\n}\n.cockpit-dashboard-toolbtn-visibility {\n  display: none;\n  position: absolute;\n  top: 0;\n  left: 6px;\n  border: 1px solid rgba(72,180,255,0.16);\n  background: rgba(15, 23, 42, 0.88);\n  color: rgba(255,255,255,0.88);\n  font-size: 0.62em;\n  font-weight: 700;\n  letter-spacing: 0.03em;\n  min-width: 44px;\n  min-height: 24px;\n  padding: 3px 9px;\n  border-radius: 999px;\n  cursor: pointer;\n  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;\n  z-index: 3;\n}\n.cockpit-dashboard-toolbtn-visibility:hover {\n  transform: translateY(-1px);\n  border-color: rgba(72,180,255,0.32);\n  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.18);\n}\n.cockpit-dashboard-toolbtn-visibility.is-hidden {\n  background: linear-gradient(135deg, rgba(239,68,68,0.82), rgba(245,158,11,0.82));\n  border-color: rgba(255,255,255,0.14);\n  color: white;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-toolbtn-visibility {\n  display: inline-flex;\n  align-items: center;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-toolslot {\n  padding: 31px 6px 5px;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-toolbar {\n  gap: 14px 12px;\n  padding: 8px 10px 10px;\n  align-items: flex-start;\n}\n.cockpit-dashboard-toolbar-editing .cockpit-dashboard-toolslot { cursor:grab; }\n.cockpit-dashboard-toolbar-editing .cockpit-dashboard-toolslot:active { cursor:grabbing; }\n.cockpit-dashboard-toolbar-editing .cockpit-dashboard-toolslot.dragging { opacity:.42; }\n.cockpit-dashboard-toolbar-editing .cockpit-dashboard-toolslot.drop-before::before,\n.cockpit-dashboard-toolbar-editing .cockpit-dashboard-toolslot.drop-after::after {\n  content:''; position:absolute; top:10px; bottom:0; width:3px; border-radius:999px;\n  background:var(--interactive-accent); box-shadow:0 0 10px rgba(72,180,255,.4); z-index:8;\n}\n.cockpit-dashboard-toolbar-editing .cockpit-dashboard-toolslot.drop-before::before { left:-7px; }\n.cockpit-dashboard-toolbar-editing .cockpit-dashboard-toolslot.drop-after::after { right:-7px; }\n.cockpit-dashboard-custom-toolbar-tools {\n  display:none; position:absolute; top:0; right:6px; align-items:center; gap:4px; z-index:4;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-custom-toolbar-tools { display:flex; }\n.cockpit-dashboard-custom-toolbar-tool {\n  width:26px; height:24px; padding:0; display:inline-flex; align-items:center; justify-content:center;\n  border:1px solid rgba(72,180,255,.2); border-radius:999px;\n  background:rgba(15,23,42,.9); color:rgba(255,255,255,.86); cursor:pointer;\n}\n.cockpit-dashboard-custom-toolbar-tool:hover { color:#8ed7ff; border-color:rgba(72,180,255,.5); }\n.cockpit-dashboard-custom-toolbar-tool.visibility { color:#8ed7ff; }\n.cockpit-dashboard-custom-toolbar-tool.danger:hover { color:#f87171; border-color:rgba(248,113,113,.55); }\n.cockpit-dashboard-custom-toolbar-tool svg { width:13px; height:13px; }\n.cockpit-dashboard-custom-toolbar-add,\n.cockpit-dashboard-custom-toolbar-logs {\n  display:none; align-items:center; gap:6px; padding:8px 14px;\n  border:1px dashed rgba(72,180,255,.38); border-radius:12px;\n  background:rgba(72,180,255,.055); color:var(--interactive-accent); font-size:.78em; font-weight:700; cursor:pointer;\n}\n.cockpit-dashboard-custom-toolbar-add:hover,\n.cockpit-dashboard-custom-toolbar-logs:hover { background:rgba(72,180,255,.11); border-style:solid; }\n.cockpit-dashboard-custom-toolbar-add svg,\n.cockpit-dashboard-custom-toolbar-logs svg { width:15px; height:15px; }\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-toolslot.is-hidden .cockpit-dashboard-toolbtn {\n  opacity: 0.5;\n  border-style: dashed;\n  filter: saturate(0.8);\n}\n.cockpit-dashboard-toolbtn:active,\n.cockpit-dashboard-todo-tab:active,\n.cockpit-dashboard-cal-nav-btn:active,\n.cockpit-dashboard-todo-add:active,\n.cockpit-dashboard-todo-btn:active,\n.cockpit-dashboard-bookmark-btn:active,\n.cockpit-dashboard-cat:active,\n.cockpit-dashboard-stat:active,\n.cockpit-dashboard-recent-item:active:not(:has(.cockpit-dashboard-bookmark-action:active)):not(:has(.cockpit-dashboard-bookmark-btn:active)) {\n  transform: scale(0.98);\n  filter: saturate(1.08) brightness(0.98);\n}\n.cockpit-dashboard-icon { font-size: 1.1em; }\n.cockpit-dashboard-module {\n  position: relative;\n}\n.cockpit-dashboard-module-tools {\n  position: absolute;\n  top: -10px;\n  right: 10px;\n  display: none;\n  align-items: center;\n  gap: 6px;\n  z-index: 12;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module {\n  margin: 12px 0;\n  padding: 10px 12px 12px;\n  border-radius: 18px;\n  border: 1px dashed rgba(72,180,255,0.22);\n  background: linear-gradient(180deg, rgba(72,180,255,0.045), rgba(72,180,255,0.015));\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module-tools {\n  display: inline-flex;\n}\n.cockpit-dashboard-module-badge {\n  display: inline-flex;\n  align-items: center;\n  padding: 4px 10px;\n  border-radius: 999px;\n  background: rgba(15, 23, 42, 0.86);\n  color: white;\n  font-size: 0.66em;\n  font-weight: 700;\n  letter-spacing: 0.04em;\n  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22);\n}\n.cockpit-dashboard-module-visibility {\n  border: 1px solid rgba(72,180,255,0.16);\n  background: rgba(15, 23, 42, 0.82);\n  color: rgba(255,255,255,0.88);\n  font-size: 0.66em;\n  font-weight: 700;\n  letter-spacing: 0.03em;\n  padding: 5px 9px;\n  border-radius: 999px;\n  cursor: pointer;\n  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;\n}\n.cockpit-dashboard-module-visibility:hover {\n  transform: translateY(-1px);\n  border-color: rgba(72,180,255,0.32);\n  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.18);\n}\n.cockpit-dashboard-module-visibility.is-hidden {\n  background: linear-gradient(135deg, rgba(239,68,68,0.82), rgba(245,158,11,0.82));\n  border-color: rgba(255,255,255,0.14);\n  color: white;\n}\n.cockpit-dashboard-module-handle {\n  width: 28px;\n  height: 28px;\n  border: none;\n  border-radius: 999px;\n  background: linear-gradient(135deg, #48b4ff, #7c9cff);\n  color: white;\n  font-size: 0.96em;\n  font-weight: 800;\n  cursor: grab;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  box-shadow: 0 8px 18px rgba(72,180,255,0.2);\n}\n.cockpit-dashboard-module-handle:active {\n  cursor: grabbing;\n}\n.cockpit-dashboard-root:not(.cockpit-dashboard-layout-editing) .cockpit-dashboard-module-handle,\n.cockpit-dashboard-root:not(.cockpit-dashboard-layout-editing) .cockpit-dashboard-module-badge,\n.cockpit-dashboard-root:not(.cockpit-dashboard-layout-editing) .cockpit-dashboard-module-visibility {\n  display: none;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module.dragging {\n  opacity: 0.52;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module.is-hidden {\n  opacity: 0.88;\n  border-color: rgba(245,158,11,0.3);\n  background: linear-gradient(180deg, rgba(245,158,11,0.08), rgba(72,180,255,0.015));\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module.drop-before::before,\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module.drop-after::after {\n  content: '';\n  position: absolute;\n  left: 16px;\n  right: 16px;\n  height: 3px;\n  border-radius: 999px;\n  background: linear-gradient(90deg, #48b4ff, #7c9cff);\n  box-shadow: 0 0 12px rgba(72,180,255,0.3);\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module.drop-before::before {\n  top: -2px;\n}\n.cockpit-dashboard-root.cockpit-dashboard-layout-editing .cockpit-dashboard-module.drop-after::after {\n  bottom: -2px;\n}\n.cockpit-dashboard-section-title { \n  position: relative;\n  font-size: 0.92em; \n  font-weight: 700; \n  color: var(--text-normal); \n  margin: 22px 0 12px; \n  padding: 0 0 10px 2px;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n.cockpit-dashboard-section-title::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  height: 1px;\n  background: linear-gradient(90deg, rgba(72,180,255,0.16), rgba(72,180,255,0.08) 34%, rgba(72,180,255,0) 74%);\n}\n.cockpit-dashboard-section-title::after {\n  content: '';\n  position: absolute;\n  left: 2px;\n  bottom: -1px;\n  width: 44px;\n  height: 3px;\n  border-radius: 999px;\n  background: linear-gradient(90deg, rgba(72,180,255,0.9), rgba(167,139,250,0.55));\n  box-shadow: 0 0 12px rgba(72,180,255,0.16);\n}\n.cockpit-dashboard-cats { \n  display: grid; \n  grid-template-columns: repeat(4, 1fr); \n  gap: 12px;\n}\n.cockpit-dashboard-cat { \n  width: 100%;\n  color: var(--text-normal);\n  text-align: left;\n  font-family: inherit;\n  background: var(--background-secondary); \n  border: 1px solid var(--background-modifier-border); \n  border-radius: 14px; \n  padding: 14px; \n  cursor: pointer; \n  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); \n  border-left: 4px solid var(--cat-clr, var(--interactive-accent));\n  position: relative;\n  overflow: hidden;\n}\n.cockpit-dashboard-cat::before {\n  content: '';\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background: linear-gradient(135deg, var(--cat-clr), transparent);\n  opacity: 0.04;\n  transition: opacity 0.25s;\n}\n.cockpit-dashboard-cat:hover { \n  border-color: var(--cat-clr, var(--interactive-accent)); \n  box-shadow: 0 6px 24px rgba(72,180,255,0.12); \n  transform: translateY(-3px);\n}\n.cockpit-dashboard-cat:hover::before { opacity: 0.08; }\n.cockpit-dashboard-cat:focus-visible { outline:2px solid var(--interactive-accent); outline-offset:2px; }\n.cockpit-dashboard-cat-icon { font-size: 1.5em; margin-bottom: 6px; }\n.cockpit-dashboard-cat-name { font-weight: 600; font-size: 0.86em; }\n.cockpit-dashboard-cat-count { font-size: 0.72em; color: var(--text-muted); margin-top: 2px; }\n.cockpit-dashboard-todo-header { display:flex; align-items:center; gap:6px; margin:16px 0 8px; padding-bottom:6px; border-bottom:1px solid var(--background-modifier-border); }\n.cockpit-dashboard-todo-header .cockpit-dashboard-section-title { margin:0; padding:0; border:none; flex:1; }\n.cockpit-dashboard-todo-header .cockpit-dashboard-section-title::before,\n.cockpit-dashboard-todo-header .cockpit-dashboard-section-title::after { display:none; }\n.cockpit-dashboard-todo-add { \n  width: 26px; \n  height: 26px; \n  display: flex; \n  align-items: center; \n  justify-content: center; \n  background: var(--background-secondary); \n  border: 1px solid var(--background-modifier-border); \n  border-radius: 8px; \n  color: var(--text-muted); \n  font-size: 1.15em; \n  font-weight: 700; \n  cursor: pointer; \n  transition: all 0.2s; \n  line-height: 1;\n}\n.cockpit-dashboard-todo-add:hover { \n  border-color: var(--interactive-accent); \n  color: var(--interactive-accent); \n  box-shadow: 0 0 12px rgba(72,180,255,0.2);\n  transform: scale(1.1);\n}\n.cockpit-dashboard-todos { \n  display: flex; \n  flex-direction: column; \n  gap: 6px; \n  margin-bottom: 16px;\n}\n.cockpit-dashboard-todo { \n  display: flex; \n  align-items: center; \n  gap: 10px; \n  background: var(--background-secondary); \n  border: 1px solid var(--background-modifier-border); \n  border-radius: 12px; \n  padding: 10px 12px; \n  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);\n}\n.cockpit-dashboard-todo:hover { \n  border-color: var(--interactive-accent);\n  box-shadow: 0 2px 12px rgba(72,180,255,0.08);\n  transform: translateX(2px);\n}\n.cockpit-dashboard-todo-chk { \n  width: 22px; \n  height: 22px; \n  border: 2px solid var(--background-modifier-border); \n  border-radius: 7px; \n  flex-shrink: 0; \n  display: flex; \n  align-items: center; \n  justify-content: center; \n  font-size: 0.75em; \n  color: white; \n  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); \n  cursor: pointer;\n}\n.cockpit-dashboard-todo-chk:hover { \n  border-color: var(--interactive-accent); \n  box-shadow: 0 0 6px rgba(72,180,255,0.2);\n}\n.cockpit-dashboard-todo.done .cockpit-dashboard-todo-chk { background:#22c55e; border-color:#22c55e; }\n.cockpit-dashboard-todo-main { flex:1; min-width:0; }\n.cockpit-dashboard-todo-text { font-size:0.84em; cursor:pointer; }\n.cockpit-dashboard-todo.done .cockpit-dashboard-todo-text { text-decoration:line-through; color:var(--text-muted); }\n.cockpit-dashboard-todo-meta { font-size:0.68em; color:var(--text-muted); margin-top:2px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }\n.cockpit-dashboard-todo-actions { display:flex; align-items:center; gap:4px; flex-shrink:0; }\n.cockpit-dashboard-todo-btn { width:26px; height:26px; padding:0; background:transparent; border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted); transition:all 0.15s; border:1px solid transparent; }\n.cockpit-dashboard-todo-btn svg, .cockpit-dashboard-bookmark-action svg { width:14px; height:14px; stroke-width:1.9; }\n.cockpit-dashboard-todo-btn:hover { border-color:var(--interactive-accent); color:var(--interactive-accent); }\n.cockpit-dashboard-todo-btn.del:hover { border-color:#ef4444; color:#ef4444; }\n.cockpit-dashboard-todo-tag { font-size:0.64em; padding:1px 7px; border-radius:8px; flex-shrink:0; }\n.tag-todo { background:rgba(72,180,255,0.15); color:#48b4ff; }\n.tag-done { background:rgba(34,197,94,0.12); color:#4ade80; }\n.cockpit-dashboard-todo-input-row { display:flex; align-items:center; gap:6px; background:var(--background-secondary); border:1px solid var(--background-modifier-border); border-radius:9px; padding:6px 8px; margin-bottom:4px; animation:dashFadeIn 0.15s ease; }\n@keyframes dashFadeIn { \n  from {opacity:0;transform:translateY(-6px)} \n  to {opacity:1;transform:translateY(0)} \n}\n@keyframes dashSlideUp {\n  from {opacity:0;transform:translateY(8px)}\n  to {opacity:1;transform:translateY(0)}\n}\n.cockpit-dashboard-todo-input-field { flex:1; border:none; outline:none; background:transparent; color:var(--text-normal); font-size:0.84em; padding:2px 4px; }\n.cockpit-dashboard-todo-input-field::placeholder { color:var(--text-muted); opacity:0.7; }\n.cockpit-dashboard-todo-input-ok, .cockpit-dashboard-todo-input-cancel { width:24px; height:24px; border-radius:5px; border:1px solid var(--background-modifier-border); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.75em; color:var(--text-muted); background:var(--background-secondary); transition:all 0.15s; flex-shrink:0; }\n.cockpit-dashboard-todo-input-ok:hover { border-color:#22c55e; color:#22c55e; }\n.cockpit-dashboard-todo-input-cancel:hover { border-color:#ef4444; color:#ef4444; }\n.cockpit-dashboard-todo-editor-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 1400;\n  display: flex;\n  align-items: flex-end;\n  justify-content: center;\n  padding: 16px;\n  background: rgba(15, 23, 42, 0.42);\n  backdrop-filter: blur(10px);\n}\n.cockpit-dashboard-todo-editor-sheet {\n  width: min(560px, 100%);\n  max-height: min(82vh, 760px);\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  border-radius: 18px;\n  border: 1px solid rgba(72,180,255,0.12);\n  background: linear-gradient(180deg, rgba(29,36,48,0.98), rgba(20,25,34,0.98));\n  box-shadow: 0 18px 48px rgba(0,0,0,0.28);\n  animation: dashSlideUp 0.18s ease;\n}\n.theme-light .cockpit-dashboard-todo-editor-sheet {\n  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(243,247,252,0.98));\n  box-shadow: 0 18px 40px rgba(15,23,42,0.14);\n}\n.cockpit-dashboard-todo-editor-header,\n.cockpit-dashboard-todo-editor-footer {\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap:10px;\n  padding:14px 16px;\n  border-bottom:1px solid rgba(72,180,255,0.08);\n}\n.cockpit-dashboard-todo-editor-footer {\n  border-top:1px solid rgba(72,180,255,0.08);\n  border-bottom:none;\n  justify-content:flex-end;\n}\n.cockpit-dashboard-todo-editor-title {\n  font-size:0.9em;\n  font-weight:800;\n  color:var(--text-normal);\n}\n.cockpit-dashboard-todo-editor-close,\n.cockpit-dashboard-todo-editor-primary-btn,\n.cockpit-dashboard-todo-editor-secondary-btn,\n.cockpit-dashboard-todo-editor-chip,\n.cockpit-dashboard-todo-editor-selected-tag,\n.cockpit-dashboard-todo-editor-segment-btn {\n  border:none;\n  cursor:pointer;\n  touch-action:manipulation;\n}\n.cockpit-dashboard-todo-editor-close {\n  width:30px;\n  height:30px;\n  border-radius:999px;\n  background:rgba(255,255,255,0.06);\n  color:var(--text-muted);\n  font-size:0.86em;\n}\n.cockpit-dashboard-todo-editor-body {\n  padding:14px 16px 16px;\n  overflow:auto;\n  display:flex;\n  flex-direction:column;\n  gap:14px;\n}\n.cockpit-dashboard-todo-editor-field {\n  display:flex;\n  flex-direction:column;\n  gap:8px;\n}\n.cockpit-dashboard-todo-editor-label {\n  font-size:0.72em;\n  font-weight:700;\n  color:var(--text-muted);\n  letter-spacing:0.03em;\n}\n.cockpit-dashboard-todo-editor-textarea,\n.cockpit-dashboard-todo-editor-date,\n.cockpit-dashboard-todo-editor-tag-input {\n  width:100%;\n  border:1px solid var(--background-modifier-border);\n  border-radius:12px;\n  background:var(--background-secondary);\n  color:var(--text-normal);\n  font:inherit;\n  outline:none;\n}\n.cockpit-dashboard-todo-editor-textarea {\n  min-height:84px;\n  padding:12px 14px;\n  resize:vertical;\n  line-height:1.5;\n}\n.cockpit-dashboard-todo-editor-date,\n.cockpit-dashboard-todo-editor-tag-input {\n  min-height:40px;\n  padding:0 12px;\n}\n.cockpit-dashboard-todo-editor-quick,\n.cockpit-dashboard-todo-editor-tags,\n.cockpit-dashboard-todo-editor-selected-tags {\n  display:flex;\n  flex-wrap:wrap;\n  gap:8px;\n}\n.cockpit-dashboard-todo-editor-chip,\n.cockpit-dashboard-todo-editor-selected-tag,\n.cockpit-dashboard-todo-editor-secondary-btn {\n  min-height:34px;\n  padding:0 12px;\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  border-radius:999px;\n  border:1px solid var(--background-modifier-border);\n  background:var(--background-secondary);\n  color:var(--text-muted);\n  font-size:0.74em;\n  font-weight:700;\n}\n.cockpit-dashboard-todo-editor-chip.active,\n.cockpit-dashboard-todo-editor-selected-tag,\n.cockpit-dashboard-todo-editor-segment-btn.active {\n  background:rgba(72,180,255,0.14);\n  border-color:rgba(72,180,255,0.32);\n  color:#8fd7ff;\n}\n.cockpit-dashboard-todo-editor-segment {\n  display:grid;\n  grid-template-columns:repeat(3, minmax(0, 1fr));\n  gap:8px;\n}\n.cockpit-dashboard-todo-editor-segment-btn {\n  min-height:38px;\n  padding:0 12px;\n  border-radius:12px;\n  border:1px solid var(--background-modifier-border);\n  background:var(--background-secondary);\n  color:var(--text-muted);\n  font-size:0.74em;\n  font-weight:700;\n}\n.cockpit-dashboard-todo-editor-tag-input-row {\n  display:flex;\n  gap:8px;\n  align-items:center;\n}\n.cockpit-dashboard-todo-editor-tag-input-row .cockpit-dashboard-todo-editor-secondary-btn {\n  flex-shrink:0;\n}\n.cockpit-dashboard-todo-editor-empty,\n.cockpit-dashboard-todo-editor-hint {\n  font-size:0.72em;\n  color:var(--text-muted);\n}\n.cockpit-dashboard-todo-editor-primary-btn {\n  min-height:38px;\n  padding:0 16px;\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  border-radius:12px;\n  background:var(--interactive-accent);\n  color:white;\n  font-size:0.76em;\n  font-weight:800;\n}\n.cockpit-dashboard-stats { \n  display: grid; \n  grid-template-columns: repeat(5, 1fr); \n  gap: 12px;\n}\n.cockpit-dashboard-stat { \n  background: var(--background-secondary); \n  border: 1px solid var(--background-modifier-border); \n  border-radius: 14px; \n  padding: 12px 14px; \n  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);\n  position: relative;\n  overflow: hidden;\n}\n.cockpit-dashboard-stat::after {\n  content: '';\n  position: absolute;\n  top: 0;\n  right: 0;\n  width: 60px;\n  height: 60px;\n  background: radial-gradient(circle at top right, var(--stat-clr, var(--interactive-accent)), transparent 70%);\n  opacity: 0.08;\n  transition: opacity 0.25s;\n}\n.cockpit-dashboard-stat:hover {\n  box-shadow: 0 4px 20px rgba(72,180,255,0.1);\n  transform: translateY(-2px);\n}\n.cockpit-dashboard-stat:hover::after { opacity: 0.15; }\n.cockpit-dashboard-stat-label { font-size:0.64em; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:3px; }\n.cockpit-dashboard-stat-val { font-size:1.3em; font-weight:700; color:var(--stat-clr,var(--interactive-accent)); }\n.cockpit-dashboard-stat-bar { height:3px; background:var(--background-modifier-border); border-radius:2px; margin-top:5px; overflow:hidden; }\n.cockpit-dashboard-stat-fill { height:100%; border-radius:2px; background:var(--stat-clr,var(--interactive-accent)); transition:width 0.5s ease; }\n.cockpit-dashboard-recent { display:flex; flex-direction:column; gap:3px; }\n.cockpit-dashboard-recent-item { display:flex; align-items:center; justify-content:space-between; background:var(--background-secondary); border-radius:7px; padding:6px 10px; }\n.cockpit-dashboard-recent-link { color:var(--text-accent); text-decoration:none; font-size:0.84em; cursor:pointer; }\n.cockpit-dashboard-recent-link:hover { color:var(--text-accent-hover); }\n.cockpit-dashboard-recent-time { font-size:0.7em; color:var(--text-muted); flex-shrink:0; }\n.cockpit-dashboard-footer { \n  text-align: center; \n  color: var(--text-muted); \n  font-size: 0.68em; \n  padding: 16px 0 8px;\n  border-top: 1px solid var(--background-modifier-border);\n  margin-top: 16px;\n}\n/* 待办页签 */\n.cockpit-dashboard-todo-tabs-wrap { margin:4px 0 8px; }\n.cockpit-dashboard-todo-tabs { display:flex; gap:4px; flex-wrap:wrap; }\n.cockpit-dashboard-todo-tab { padding:4px 12px; border-radius:14px; border:1px solid var(--background-modifier-border); background:var(--background-secondary); color:var(--text-muted); font-size:0.76em; font-weight:500; cursor:pointer; transition:all 0.15s; }\n.cockpit-dashboard-todo-tab:hover { border-color:var(--interactive-accent); color:var(--interactive-accent); }\n.cockpit-dashboard-todo-tab.active { background:var(--interactive-accent); border-color:var(--interactive-accent); color:white; }\n/* 标签胶囊 */\n.cockpit-dashboard-todo-tag-pill { \n  display: inline-block; \n  font-size: 0.62em; \n  padding: 1px 6px; \n  margin: 0 3px; \n  border-radius: 7px; \n  background: rgba(72,180,255,0.13); \n  color: #48b4ff; \n  cursor: pointer; \n  font-weight: 500; \n  transition: all 0.12s;\n}\n.cockpit-dashboard-todo-tag-pill:hover { \n  background: rgba(72,180,255,0.28); \n  color: #1a5a1a;\n}\n/* 优先级圆点 */\n.cockpit-dashboard-todo-pdot { width:8px; height:8px; border-radius:50%; flex-shrink:0; display:inline-block; }\n.p-high { background:#ef4444; box-shadow:0 0 4px rgba(239,68,68,0.5); }\n.p-mid { background:#f59e0b; }\n.p-low { background:#22c55e; }\n/* 截止日期 */\n.cockpit-dashboard-todo-due { font-size:0.64em; margin-left:4px; padding:1px 5px; border-radius:4px; }\n.due-overdue { background:rgba(239,68,68,0.15); color:#ef4444; }\n.due-today { background:rgba(245,158,11,0.15); color:#f59e0b; }\n.due-future { color:var(--text-muted); }\n/* 优先级选择 */\n.cockpit-dashboard-prio-picker { display:flex; gap:3px; margin-left:6px; }\n.cockpit-dashboard-prio-opt { width:18px; height:18px; border-radius:50%; cursor:pointer; border:2px solid transparent; transition:all 0.12s; }\n.cockpit-dashboard-prio-opt:hover { transform:scale(1.2); }\n.cockpit-dashboard-prio-opt.sel { border-color:var(--text-normal); }\n/* 热力图 */\n.cockpit-dashboard-heatmap-wrap { padding:8px 0 4px; }\n.cockpit-dashboard-heatmap { display:grid; grid-template-columns:repeat(10,1fr); gap:4px; }\n.cockpit-dashboard-hm-cell { \n  width: 100%; \n  padding-bottom: 100%; \n  border-radius: 6px; \n  background: var(--background-modifier-border); \n  cursor: default; \n  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); \n  position: relative;\n}\n.cockpit-dashboard-hm-cell:hover { \n  transform: scale(1.25); \n  box-shadow: 0 0 8px rgba(72,180,255,0.4); \n  z-index: 2;\n}\n.cockpit-dashboard-hm-cell[title]:hover::after { content:attr(title); position:absolute; bottom:120%; left:50%; transform:translateX(-50%); background:var(--background-secondary); color:var(--text-normal); font-size:0.6em; padding:3px 7px; border-radius:5px; white-space:nowrap; z-index:10; border:1px solid var(--background-modifier-border); box-shadow:0 2px 8px rgba(0,0,0,0.12); }\n.cockpit-dashboard-hm-legend { display:flex; align-items:center; gap:4px; margin-top:6px; justify-content:flex-end; }\n.cockpit-dashboard-hm-legend-label { font-size:0.6em; color:var(--text-muted); }\n.cockpit-dashboard-hm-legend-cell { width:12px; height:12px; border-radius:3px; }\n/* 迷你搜索 */\n.cockpit-dashboard-search-row { display:flex; gap:6px; margin:8px 0; }\n.cockpit-dashboard-search-input { flex:1; padding:6px 10px; border:1px solid var(--background-modifier-border); border-radius:7px; background:var(--background-secondary); color:var(--text-normal); font-size:0.82em; outline:none; }\n.cockpit-dashboard-search-input:focus { border-color: var(--interactive-accent); box-shadow: 0 0 0 2px rgba(72,180,255,0.1); }\n.cockpit-dashboard-search-results { display:flex; flex-direction:column; gap:2px; margin-bottom:8px; }\n.cockpit-dashboard-search-item { display:flex; align-items:center; justify-content:space-between; padding:5px 8px; border-radius:6px; cursor:pointer; transition:background 0.12s; }\n.cockpit-dashboard-search-item:hover { \n  background: var(--background-secondary);\n  transform: translateX(2px);\n  filter: saturate(1.03);\n}\n.cockpit-dashboard-search-name { font-size:0.8em; color:var(--text-accent); }\n.cockpit-dashboard-search-path { font-size:0.64em; color:var(--text-muted); }\n/* 收藏 */\n.cockpit-dashboard-bookmark-btn { cursor:pointer; font-size:0.85em; color:var(--text-muted); transition:all 0.12s; padding:2px 4px; border-radius:4px; }\n.cockpit-dashboard-bookmark-btn:hover { \n  color: #f59e0b; \n  background: rgba(245,158,11,0.1);\n  transform: scale(1.1);\n  filter: saturate(1.08);\n}\n.cockpit-dashboard-bookmark-btn.starred { color:#f59e0b; }\n.cockpit-dashboard-bookmark-actions { display:flex; align-items:center; gap:2px; margin-left:auto; }\n.cockpit-dashboard-bookmark-action { width:24px; height:24px; padding:0; border:1px solid transparent; border-radius:5px; display:flex; align-items:center; justify-content:center; background:transparent; color:var(--text-muted); cursor:pointer; }\n.cockpit-dashboard-bookmark-action:hover:not(:disabled) { color:var(--interactive-accent); border-color:var(--interactive-accent); }\n.cockpit-dashboard-bookmark-action:disabled { opacity:.3; cursor:default; }\n/* Spotlight 全局搜索 */\n.cockpit-dashboard-spotlight-modal { width:min(680px,calc(100vw - 28px)); padding:0; overflow:hidden; border:1px solid rgba(72,180,255,.2); border-radius:18px; background:rgba(var(--background-primary-rgb),.96); box-shadow:0 26px 80px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.04); backdrop-filter:blur(24px) saturate(1.12); }\n.cockpit-dashboard-spotlight-modal .modal-content { padding:0; overflow:hidden; }\n.cockpit-dashboard-spotlight-modal .modal-close-button { top:8px; right:9px; z-index:3; }\n.cockpit-dashboard-spotlight { min-height:270px; background:linear-gradient(180deg,rgba(72,180,255,.035),transparent 90px); }\n.cockpit-dashboard-spotlight-dragbar { height:28px; display:flex; align-items:center; justify-content:center; color:var(--text-faint); cursor:grab; touch-action:none; user-select:none; }\n.cockpit-dashboard-spotlight-dragbar.dragging { cursor:grabbing; color:var(--interactive-accent); }\n.cockpit-dashboard-spotlight-dragbar svg { width:22px; height:16px; }\n.cockpit-dashboard-spotlight-input-row { display:flex; align-items:center; gap:12px; margin:0 14px 10px; padding:12px 14px; border:1px solid rgba(72,180,255,.18); border-radius:13px; background:var(--background-secondary); box-shadow:inset 0 1px 0 rgba(255,255,255,.035); }\n.cockpit-dashboard-spotlight-icon { color:var(--interactive-accent); display:flex; }\n.cockpit-dashboard-spotlight-icon svg { width:19px; height:19px; }\n.cockpit-dashboard-spotlight-input { flex:1; min-width:0; border:0!important; outline:0; box-shadow:none!important; background:transparent; color:var(--text-normal); font-size:1.02em; }\n.cockpit-dashboard-spotlight-hint { padding:0 18px 9px; color:var(--text-muted); font-size:.7em; border-bottom:1px solid var(--background-modifier-border); }\n.cockpit-dashboard-spotlight-results { max-height:min(58vh,520px); overflow:auto; padding:8px; }\n.cockpit-dashboard-spotlight-result { padding:10px 12px; border-radius:10px; cursor:pointer; border:1px solid transparent; }\n.cockpit-dashboard-spotlight-result:hover, .cockpit-dashboard-spotlight-result.selected { background:var(--background-secondary); border-color:rgba(72,180,255,.12); }\n.cockpit-dashboard-spotlight-name { color:var(--text-normal); font-size:.86em; font-weight:600; }\n.cockpit-dashboard-spotlight-path { margin-top:3px; color:var(--text-muted); font-size:.72em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.cockpit-dashboard-spotlight-empty { padding:26px 12px; text-align:center; color:var(--text-muted); font-size:.82em; }\n/* 自定义 Toolbar 按钮编辑器 */\n.cockpit-dashboard-custom-toolbar-backdrop {\n  position:fixed; inset:0; z-index:10020; display:flex; align-items:center; justify-content:center;\n  padding:20px; background:rgba(15,23,42,.52); backdrop-filter:blur(12px);\n}\n.cockpit-dashboard-custom-toolbar-editor {\n  width:min(560px,calc(100vw - 24px)); max-height:88vh; overflow:auto;\n  padding:20px; border:1px solid rgba(72,180,255,.18); border-radius:18px;\n  background:var(--background-primary); box-shadow:0 24px 64px rgba(0,0,0,.32);\n}\n.cockpit-dashboard-custom-toolbar-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }\n.cockpit-dashboard-custom-toolbar-title { font-size:1em; font-weight:800; color:var(--text-normal); }\n.cockpit-dashboard-custom-toolbar-close {\n  width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center;\n  border:1px solid var(--background-modifier-border); border-radius:9px; background:var(--background-secondary); color:var(--text-muted); cursor:pointer;\n}\n.cockpit-dashboard-custom-toolbar-close svg { width:15px; height:15px; }\n.cockpit-dashboard-custom-toolbar-field { display:flex; flex-direction:column; gap:7px; margin-bottom:14px; }\n.cockpit-dashboard-custom-toolbar-label { font-size:.75em; font-weight:750; color:var(--text-muted); }\n.cockpit-dashboard-custom-toolbar-input,\n.cockpit-dashboard-custom-toolbar-select,\n.cockpit-dashboard-custom-toolbar-textarea {\n  width:100%; border:1px solid var(--background-modifier-border); border-radius:10px;\n  background:var(--background-secondary); color:var(--text-normal); outline:none;\n}\n.cockpit-dashboard-custom-toolbar-input,\n.cockpit-dashboard-custom-toolbar-select { min-height:38px; padding:7px 10px; }\n.cockpit-dashboard-custom-toolbar-textarea { min-height:128px; padding:10px; resize:vertical; font-family:var(--font-monospace); line-height:1.5; }\n.cockpit-dashboard-custom-toolbar-input:focus,\n.cockpit-dashboard-custom-toolbar-select:focus,\n.cockpit-dashboard-custom-toolbar-textarea:focus { border-color:var(--interactive-accent); box-shadow:0 0 0 2px rgba(72,180,255,.09); }\n.cockpit-dashboard-custom-toolbar-hint { font-size:.68em; line-height:1.45; color:var(--text-muted); }\n.cockpit-dashboard-custom-toolbar-consent { display:flex; align-items:flex-start; gap:8px; margin:4px 0 12px; font-size:.72em; line-height:1.5; color:#f59e0b; }\n.cockpit-dashboard-custom-toolbar-consent input { margin-top:2px; }\n.cockpit-dashboard-custom-toolbar-error { min-height:18px; color:#ef4444; font-size:.72em; }\n.cockpit-dashboard-custom-toolbar-footer { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }\n.cockpit-dashboard-custom-toolbar-secondary,\n.cockpit-dashboard-custom-toolbar-primary { min-height:38px; padding:0 15px; border-radius:10px; font-size:.76em; font-weight:750; cursor:pointer; }\n.cockpit-dashboard-custom-toolbar-secondary { border:1px solid var(--background-modifier-border); background:var(--background-secondary); color:var(--text-muted); }\n.cockpit-dashboard-custom-toolbar-secondary.danger { margin-right:auto; border-color:rgba(239,68,68,.32); color:#ef4444; }\n.cockpit-dashboard-custom-toolbar-secondary.danger:hover { border-color:rgba(239,68,68,.62); background:rgba(239,68,68,.08); }\n.cockpit-dashboard-custom-toolbar-primary { border:1px solid var(--interactive-accent); background:var(--interactive-accent); color:white; }\n/* 内置 Toolbar 命令配置编辑器 */\n.cockpit-dashboard-toolbar-config-backdrop {\n  position:fixed; inset:0; z-index:10025; display:flex; align-items:center; justify-content:center;\n  padding:20px; background:rgba(15,23,42,.54); backdrop-filter:blur(12px);\n}\n.cockpit-dashboard-toolbar-config-editor {\n  width:min(580px,calc(100vw - 24px)); max-height:88vh; overflow:auto; padding:20px;\n  border:1px solid rgba(72,180,255,.18); border-radius:18px; background:var(--background-primary);\n  box-shadow:0 24px 68px rgba(0,0,0,.34);\n}\n.cockpit-dashboard-toolbar-config-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }\n.cockpit-dashboard-toolbar-config-title { font-size:1em; font-weight:850; color:var(--text-normal); }\n.cockpit-dashboard-toolbar-config-close { width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--background-modifier-border); border-radius:9px; background:var(--background-secondary); color:var(--text-muted); cursor:pointer; }\n.cockpit-dashboard-toolbar-config-close svg { width:15px; height:15px; }\n.cockpit-dashboard-toolbar-config-warning { margin-bottom:13px; padding:9px 11px; border-radius:9px; background:rgba(245,158,11,.1); color:#f59e0b; font-size:.7em; line-height:1.5; }\n.cockpit-dashboard-toolbar-config-field { display:flex; flex-direction:column; gap:7px; margin-bottom:13px; }\n.cockpit-dashboard-toolbar-config-label { color:var(--text-muted); font-size:.74em; font-weight:750; }\n.cockpit-dashboard-toolbar-config-textarea,\n.cockpit-dashboard-toolbar-config-input { width:100%; padding:10px; border:1px solid var(--background-modifier-border); border-radius:10px; background:var(--background-secondary); color:var(--text-normal); outline:none; }\n.cockpit-dashboard-toolbar-config-textarea { min-height:130px; resize:vertical; font-family:var(--font-monospace); line-height:1.5; }\n.cockpit-dashboard-toolbar-config-input { min-height:38px; }\n.cockpit-dashboard-toolbar-config-textarea:focus,\n.cockpit-dashboard-toolbar-config-input:focus { border-color:var(--interactive-accent); box-shadow:0 0 0 2px rgba(72,180,255,.09); }\n.cockpit-dashboard-toolbar-config-consent { display:flex; align-items:center; gap:8px; color:var(--text-normal); font-size:.73em; }\n.cockpit-dashboard-toolbar-config-error { min-height:18px; margin-top:6px; color:#ef4444; font-size:.7em; }\n.cockpit-dashboard-toolbar-config-footer { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; }\n.cockpit-dashboard-toolbar-config-footer button { min-height:38px; padding:0 14px; border:1px solid var(--background-modifier-border); border-radius:10px; background:var(--background-secondary); color:var(--text-normal); font-size:.75em; font-weight:750; cursor:pointer; }\n.cockpit-dashboard-toolbar-config-footer button.primary { border-color:var(--interactive-accent); background:var(--interactive-accent); color:white; }\n/* Toolbar 私有运行日志查看器 */\n.cockpit-dashboard-toolbar-log-backdrop,\n.cockpit-dashboard-storage-backdrop {\n  position:fixed; inset:0; z-index:10030; display:flex; align-items:center; justify-content:center;\n  padding:20px; background:rgba(15,23,42,.55); backdrop-filter:blur(12px);\n}\n.cockpit-dashboard-toolbar-log-viewer,\n.cockpit-dashboard-storage-manager {\n  width:min(760px,calc(100vw - 24px)); max-height:88vh; overflow:auto;\n  padding:20px; border:1px solid rgba(72,180,255,.18); border-radius:18px;\n  background:var(--background-primary); box-shadow:0 24px 68px rgba(0,0,0,.34);\n}\n.cockpit-dashboard-toolbar-log-head,\n.cockpit-dashboard-storage-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }\n.cockpit-dashboard-toolbar-log-title,\n.cockpit-dashboard-storage-title { font-size:1em; font-weight:850; color:var(--text-normal); }\n.cockpit-dashboard-toolbar-log-controls { display:flex; gap:7px; }\n.cockpit-dashboard-toolbar-log-controls button,\n.cockpit-dashboard-storage-close {\n  min-height:30px; padding:0 10px; border:1px solid var(--background-modifier-border); border-radius:8px;\n  background:var(--background-secondary); color:var(--text-muted); cursor:pointer;\n}\n.cockpit-dashboard-storage-close { width:30px; padding:0; display:flex; align-items:center; justify-content:center; }\n.cockpit-dashboard-toolbar-log-list { display:flex; flex-direction:column; gap:9px; }\n.cockpit-dashboard-toolbar-log-card { padding:12px 14px; border:1px solid var(--background-modifier-border); border-left:3px solid #ef4444; border-radius:11px; background:var(--background-secondary); }\n.cockpit-dashboard-toolbar-log-card.success { border-left-color:#22c55e; }\n.cockpit-dashboard-toolbar-log-card-title { font-size:.82em; font-weight:800; color:var(--text-normal); }\n.cockpit-dashboard-toolbar-log-meta { margin-top:3px; font-size:.66em; color:var(--text-muted); }\n.cockpit-dashboard-toolbar-log-card pre { max-height:210px; overflow:auto; margin:9px 0 0; padding:9px 10px; border-radius:8px; background:var(--background-primary); font-size:.7em; white-space:pre-wrap; word-break:break-word; }\n.cockpit-dashboard-toolbar-log-empty { padding:30px; text-align:center; color:var(--text-muted); }\n/* Storage V2 数据迁移引导 */\n.cockpit-dashboard-storage-guide { padding:14px; border:1px solid rgba(72,180,255,.14); border-radius:14px; background:linear-gradient(135deg,rgba(72,180,255,.08),rgba(167,139,250,.035)); }\n.cockpit-dashboard-storage-badge { display:inline-flex; min-height:25px; align-items:center; padding:0 9px; border-radius:999px; background:rgba(245,158,11,.13); color:#f59e0b; font-size:.68em; font-weight:800; }\n.cockpit-dashboard-storage-badge.complete { background:rgba(34,197,94,.13); color:#22c55e; }\n.cockpit-dashboard-storage-guide-title { margin-top:10px; color:var(--text-normal); font-size:.92em; font-weight:850; }\n.cockpit-dashboard-storage-guide-copy { margin-top:6px; color:var(--text-muted); font-size:.74em; line-height:1.6; }\n.cockpit-dashboard-storage-steps { display:grid; gap:7px; margin:12px 0; }\n.cockpit-dashboard-storage-step { padding:8px 10px; border-radius:9px; background:var(--background-secondary); color:var(--text-muted); font-size:.72em; line-height:1.45; }\n.cockpit-dashboard-storage-status { padding:11px 12px; border-radius:10px; background:var(--background-secondary); color:var(--text-normal); font-size:.76em; line-height:1.5; }\n.cockpit-dashboard-storage-warning { margin:9px 0; color:#f59e0b; font-size:.7em; }\n.cockpit-dashboard-storage-actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }\n.cockpit-dashboard-storage-actions button,\n.cockpit-dashboard-storage-import-btn { min-height:36px; padding:0 13px; border:1px solid var(--background-modifier-border); border-radius:9px; background:var(--background-secondary); color:var(--text-normal); font-size:.74em; font-weight:700; cursor:pointer; }\n.cockpit-dashboard-storage-actions .cockpit-dashboard-storage-migrate-btn { border-color:var(--interactive-accent); background:var(--interactive-accent); color:white; }\n.cockpit-dashboard-storage-actions button:disabled { opacity:.5; cursor:default; }\n.cockpit-dashboard-storage-actions button:hover,\n.cockpit-dashboard-storage-import-btn:hover { border-color:var(--interactive-accent); color:var(--interactive-accent); }\n.cockpit-dashboard-storage-import { width:100%; min-height:160px; padding:10px; border:1px solid var(--background-modifier-border); border-radius:10px; background:var(--background-secondary); color:var(--text-normal); font-family:var(--font-monospace); font-size:.7em; resize:vertical; }\n.cockpit-dashboard-storage-import-btn { margin-top:8px; }\n.cockpit-dashboard-storage-message { min-height:20px; margin-top:8px; color:var(--interactive-accent); font-size:.72em; }\n.cockpit-dashboard-storage-advanced { margin-top:12px; border-top:1px solid var(--background-modifier-border); padding-top:10px; }\n.cockpit-dashboard-storage-advanced summary { cursor:pointer; color:var(--text-muted); font-size:.74em; font-weight:750; }\n.cockpit-dashboard-storage-advanced-copy { margin:8px 0; color:#f59e0b; font-size:.68em; line-height:1.5; }\n/* 闪念胶囊 */\n.cockpit-dashboard-flash-row { display:flex; gap:6px; margin:4px 0 8px; }\n.cockpit-dashboard-flash-input { flex:1; padding:6px 10px; border:1px solid var(--background-modifier-border); border-radius:7px; background:var(--background-secondary); color:var(--text-normal); font-size:0.82em; outline:none; }\n.cockpit-dashboard-flash-input:focus { border-color: var(--interactive-accent); box-shadow: 0 0 0 2px rgba(72,180,255,0.1); }\n.cockpit-dashboard-flash-ok { font-size:0.72em; color:#22c55e; padding:4px 8px; border-radius:5px; }\n/* 每日小贴士 */\n.cockpit-dashboard-tip { \n  background: linear-gradient(135deg, rgba(72,180,255,0.08), rgba(72,180,255,0.03)); \n  border: 1px solid rgba(72,180,255,0.15); \n  border-radius: 12px; \n  padding: 12px 16px; \n  margin: 12px 0;\n  position: relative;\n  overflow: hidden;\n}\n.cockpit-dashboard-tip::before {\n  content: '';\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 4px;\n  height: 100%;\n  background: linear-gradient(180deg, #48b4ff, #a78bfa);\n  border-radius: 4px 0 0 4px;\n}\n.cockpit-dashboard-tip-label { font-size:0.64em; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:4px; }\n.cockpit-dashboard-tip-text { font-size:0.82em; color:var(--text-normal); line-height:1.5; }\n/* 状态筛选 */\n.cockpit-dashboard-status-select-wrap {\n  min-width:112px; height:34px; display:flex; align-items:center; gap:7px; padding:0 9px;\n  border:1px solid var(--background-modifier-border); border-radius:10px;\n  background:var(--background-secondary); color:var(--text-muted);\n  transition:border-color .15s ease,box-shadow .15s ease,color .15s ease;\n}\n.cockpit-dashboard-status-select-wrap:hover,\n.cockpit-dashboard-status-select-wrap:focus-within {\n  border-color:var(--interactive-accent); color:var(--interactive-accent);\n  box-shadow:0 0 0 2px rgba(72,180,255,.08);\n}\n.cockpit-dashboard-status-select-icon { display:flex; flex-shrink:0; pointer-events:none; }\n.cockpit-dashboard-status-select-icon svg { width:14px; height:14px; stroke-width:1.9; }\n.cockpit-dashboard-status-select {\n  width:100%; min-width:0; height:100%; margin:0; padding:0 20px 0 0;\n  border:0!important; outline:0; box-shadow:none!important; background-color:transparent;\n  color:var(--text-normal); font-size:.74em; font-weight:650; cursor:pointer;\n}\n/* 日历看板 */\n.cockpit-dashboard-cal-wrap { margin:10px 0 14px; }\n.cockpit-dashboard-cal-surface {\n  background:\n    radial-gradient(circle at top left, rgba(72,180,255,0.09), transparent 30%),\n    linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.005));\n  border: 1px solid rgba(72,180,255,0.08);\n  border-radius: 18px;\n  padding: 12px 12px 10px;\n  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 24px rgba(0,0,0,0.1);\n}\n.cockpit-dashboard-cal-header {\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap: 14px;\n  margin-bottom:6px;\n}\n.cockpit-dashboard-cal-title-wrap {\n  display:flex;\n  flex-direction:column;\n  gap: 2px;\n}\n.cockpit-dashboard-cal-title { font-size:0.94em; font-weight:800; color:var(--text-normal); letter-spacing:0.01em; }\n.cockpit-dashboard-cal-subtitle { font-size:0.66em; color:var(--text-muted); letter-spacing:0.02em; }\n.cockpit-dashboard-cal-nav { display:flex; gap:6px; }\n.cockpit-dashboard-cal-nav-btn {\n  width:28px;\n  height:28px;\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  border:1px solid rgba(255,255,255,0.06);\n  border-radius:10px;\n  background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));\n  color:var(--text-muted);\n  cursor:pointer;\n  font-size:0.84em;\n  transition:transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease;\n}\n.cockpit-dashboard-cal-nav-btn:hover { \n  border-color: rgba(72,180,255,0.28); \n  color: #7fd2ff; \n  transform: translateY(-1px) scale(1.04);\n  box-shadow: 0 8px 18px rgba(72,180,255,0.12);\n  background: linear-gradient(180deg, rgba(72,180,255,0.08), rgba(72,180,255,0.03));\n}\n.cockpit-dashboard-cal-stage {\n  overflow: hidden;\n  border-radius: 14px;\n}\n.cockpit-dashboard-cal-grid {\n  display:grid;\n  grid-template-columns:repeat(7, minmax(0, 1fr));\n  gap:4px;\n  transition:transform 0.34s cubic-bezier(0.22,1,0.36,1), opacity 0.34s ease, filter 0.34s ease;\n}\n.cockpit-dashboard-cal-grid.slide-out-left { transform:translateX(-18px) scale(0.985); opacity:0; filter:blur(4px); }\n.cockpit-dashboard-cal-grid.slide-out-right { transform:translateX(18px) scale(0.985); opacity:0; filter:blur(4px); }\n.cockpit-dashboard-cal-grid.slide-in { animation:calSlideIn 0.34s cubic-bezier(0.22,1,0.36,1) forwards; }\n@keyframes calSlideIn {\n  from { opacity:0; transform:translateX(18px) scale(0.985); filter:blur(4px); }\n  to { opacity:1; transform:translateX(0) scale(1); filter:blur(0); }\n}\n.cockpit-dashboard-cal-dow {\n  text-align:center;\n  font-size:0.62em;\n  font-weight:700;\n  color:var(--text-faint, var(--text-muted));\n  padding:4px 0 5px;\n  text-transform:uppercase;\n  letter-spacing:0.08em;\n}\n.cockpit-dashboard-cal-cell { \n  display:flex;\n  flex-direction:column;\n  align-items:stretch;\n  justify-content:flex-start;\n  border-radius:12px; \n  cursor:pointer; \n  transition:transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease, opacity 0.22s ease; \n  color: var(--text-muted); \n  border: 1px solid transparent; \n  min-height: 44px; \n  padding: 6px 6px 5px; \n  position: relative;\n  background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));\n}\n.cockpit-dashboard-cal-cell:hover { \n  background: linear-gradient(180deg, rgba(72,180,255,0.09), rgba(72,180,255,0.03)); \n  border-color: rgba(72,180,255,0.22); \n  transform: translateY(-2px); \n  box-shadow: 0 10px 24px rgba(72,180,255,0.1);\n}\n.cockpit-dashboard-cal-cell.today { \n  color: #7ed0ff; \n  background: linear-gradient(180deg, rgba(72,180,255,0.1), rgba(72,180,255,0.03));\n}\n.cockpit-dashboard-cal-cell.selected { \n  border-color: rgba(72,180,255,0.34); \n  background: linear-gradient(180deg, rgba(72,180,255,0.16), rgba(72,180,255,0.05)); \n  box-shadow: 0 12px 28px rgba(72,180,255,0.12);\n}\n.cockpit-dashboard-cal-cell.dim {\n  opacity:0.28;\n  pointer-events:none;\n  background: transparent;\n}\n.cockpit-dashboard-cal-cell-inner {\n  display:flex;\n  align-items:flex-start;\n  justify-content:space-between;\n  min-height: 16px;\n}\n.cockpit-dashboard-cal-num {\n  font-size:0.84em;\n  font-weight:700;\n  color:inherit;\n}\n.cockpit-dashboard-cal-today-mark {\n  width:6px;\n  height:6px;\n  border-radius:999px;\n  background:linear-gradient(135deg, #48b4ff, #a78bfa);\n  box-shadow:0 0 10px rgba(72,180,255,0.35);\n  margin-top:2px;\n}\n.cockpit-dashboard-cal-badge {\n  position:absolute;\n  top:6px;\n  right:6px;\n  min-width:16px;\n  height:16px;\n  padding:0 4px;\n  border-radius:999px;\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  background:rgba(72,180,255,0.16);\n  color:#8ed7ff;\n  font-size:0.56em;\n  font-weight:800;\n  letter-spacing:0.03em;\n}\n.cockpit-dashboard-cal-dots {\n  display:flex;\n  gap:3px;\n  margin-top:auto;\n  padding-top:5px;\n}\n.cockpit-dashboard-cal-dot {\n  width:5px;\n  height:5px;\n  border-radius:50%;\n  flex-shrink:0;\n  box-shadow:0 0 8px rgba(0,0,0,0.18);\n}\n.cockpit-dashboard-cal-detail { \n  background:\n    linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)),\n    rgba(0,0,0,0.06);\n  border: 1px solid rgba(255,255,255,0.06); \n  border-radius: 14px; \n  padding: 10px 12px; \n  margin-top: 8px; \n  animation: calDetailIn 0.22s cubic-bezier(0.22,1,0.36,1);\n  box-shadow: 0 8px 18px rgba(0,0,0,0.08);\n}\n@keyframes calDetailIn { from{opacity:0;transform:translateY(8px) scale(0.992)} to{opacity:1;transform:translateY(0) scale(1)} }\n.cockpit-dashboard-cal-detail-head {\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap:10px;\n  margin-bottom:6px;\n}\n.cockpit-dashboard-cal-detail-title-wrap {\n  min-width:0;\n  display:flex;\n  align-items:center;\n  gap:8px;\n}\n.cockpit-dashboard-cal-detail-title { font-size:0.82em; font-weight:800; color:var(--text-normal); }\n.cockpit-dashboard-cal-detail-count {\n  min-width:20px;\n  height:20px;\n  padding:0 6px;\n  border-radius:999px;\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  font-size:0.62em;\n  font-weight:800;\n  background:rgba(72,180,255,0.12);\n  color:#8ed7ff;\n}\n.cockpit-dashboard-cal-detail-add,\n.cockpit-dashboard-cal-detail-edit {\n  border:1px solid var(--background-modifier-border);\n  background:var(--background-secondary);\n  color:var(--text-muted);\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  cursor:pointer;\n  touch-action:manipulation;\n  transition:all 0.15s ease;\n}\n.cockpit-dashboard-cal-detail-add {\n  min-height:30px;\n  padding:0 12px;\n  border-radius:999px;\n  font-size:0.7em;\n  font-weight:700;\n  white-space:nowrap;\n}\n.cockpit-dashboard-cal-detail-add:hover,\n.cockpit-dashboard-cal-detail-edit:hover {\n  border-color:var(--interactive-accent);\n  color:var(--interactive-accent);\n}\n.cockpit-dashboard-cal-detail-item {\n  display:flex;\n  align-items:center;\n  gap:8px;\n  padding:6px 8px;\n  font-size:0.74em;\n  transition:background 0.15s ease, transform 0.15s ease;\n  border-radius:8px;\n  cursor:pointer;\n}\n.cockpit-dashboard-cal-detail-item:hover { background:rgba(72,180,255,0.08); transform:translateX(2px); }\n.cockpit-dashboard-cal-detail-empty {\n  min-height:42px;\n  display:flex;\n  flex-direction:row;\n  align-items:center;\n  justify-content:center;\n  gap:6px;\n  color:var(--text-muted);\n  text-align:center;\n}\n.cockpit-dashboard-cal-detail-empty-icon {\n  width:20px;\n  height:20px;\n  border-radius:999px;\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  background:rgba(72,180,255,0.08);\n  color:#8ed7ff;\n  font-size:0.68em;\n}\n.cockpit-dashboard-cal-detail-empty-text { font-size:0.72em; }\n.cockpit-dashboard-cal-detail-check { width:16px; height:16px; border:2px solid var(--background-modifier-border); border-radius:5px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:0.56em; color:white; cursor:pointer; transition:all 0.16s ease; }\n.cockpit-dashboard-cal-detail-check:hover { border-color:#22c55e; transform:scale(1.05); }\n.cockpit-dashboard-cal-detail-check.done { background:#22c55e; border-color:#22c55e; }\n.cockpit-dashboard-cal-detail-text { flex:1; line-height:1.45; }\n.cockpit-dashboard-cal-detail-text.done { text-decoration:line-through; color:var(--text-muted); }\n.cockpit-dashboard-cal-detail-edit {\n  width:24px;\n  height:24px;\n  padding:0;\n  border-radius:7px;\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  flex-shrink:0;\n}\n.cockpit-dashboard-cal-detail-edit svg { width:14px; height:14px; stroke-width:1.9; }\n\n.theme-dark .cockpit-dashboard-cal-surface {\n  background:\n    radial-gradient(circle at top left, rgba(72,180,255,0.05), transparent 28%),\n    linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.004));\n  border-color: rgba(72,180,255,0.06);\n  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02), 0 8px 18px rgba(0,0,0,0.08);\n}\n.theme-dark .cockpit-dashboard-cal-grid {\n  gap: 2px;\n}\n.theme-dark .cockpit-dashboard-cal-cell {\n  background: transparent;\n  border-color: transparent;\n  box-shadow: none;\n  border-radius: 10px;\n}\n.theme-dark .cockpit-dashboard-cal-cell:hover {\n  background: rgba(72,180,255,0.035);\n  border-color: rgba(72,180,255,0.08);\n  transform: none;\n  box-shadow: none;\n}\n.theme-dark .cockpit-dashboard-cal-cell.has-todos {\n  background: linear-gradient(180deg, rgba(72,180,255,0.018), rgba(72,180,255,0.008));\n}\n.theme-dark .cockpit-dashboard-cal-cell.today {\n  background: rgba(72,180,255,0.04);\n  color: #8fd7ff;\n}\n.theme-dark .cockpit-dashboard-cal-cell.selected {\n  background: rgba(72,180,255,0.06);\n  border-color: rgba(72,180,255,0.26);\n  box-shadow: inset 0 0 0 1px rgba(72,180,255,0.14);\n}\n.theme-dark .cockpit-dashboard-cal-badge {\n  background: rgba(72,180,255,0.12);\n  color: #8fd7ff;\n}\n.theme-dark .cockpit-dashboard-cal-detail {\n  background: linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0.006));\n  border-color: rgba(255,255,255,0.04);\n  box-shadow: none;\n}\n\n@media (max-width: 720px) {\n  .cockpit-dashboard-layout-done {\n    top: 16px;\n    right: 16px;\n    width: 34px;\n    height: 34px;\n  }\n}\n\n.cockpit-dashboard-release-modal .modal {\n  width: min(720px, calc(100vw - 32px));\n}\n.cockpit-dashboard-release-top {\n  margin-bottom: 12px;\n}\n.cockpit-dashboard-release-current {\n  display: inline-flex;\n  align-items: center;\n  padding: 6px 10px;\n  border-radius: 999px;\n  background: rgba(72,180,255,0.1);\n  color: var(--text-muted);\n  font-size: 0.76em;\n  font-weight: 700;\n  letter-spacing: 0.03em;\n}\n.cockpit-dashboard-release-empty {\n  padding: 24px 0;\n  color: var(--text-muted);\n  text-align: center;\n}\n.cockpit-dashboard-release-card {\n  background: linear-gradient(180deg, rgba(72,180,255,0.05), rgba(72,180,255,0.015));\n  border: 1px solid rgba(72,180,255,0.12);\n  border-radius: 16px;\n  padding: 14px 16px;\n  margin-bottom: 12px;\n}\n.cockpit-dashboard-release-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 6px;\n}\n.cockpit-dashboard-release-version {\n  font-size: 1em;\n  font-weight: 800;\n  color: var(--text-normal);\n}\n.cockpit-dashboard-release-date {\n  color: var(--text-muted);\n  font-size: 0.76em;\n  white-space: nowrap;\n}\n.cockpit-dashboard-release-title {\n  font-size: 0.82em;\n  font-weight: 700;\n  color: var(--text-normal);\n  margin-bottom: 8px;\n}\n.cockpit-dashboard-release-list {\n  margin: 0;\n  padding-left: 18px;\n  color: var(--text-muted);\n}\n.cockpit-dashboard-release-list li {\n  margin: 4px 0;\n  line-height: 1.5;\n}\n\n/* 可编辑名称 */\n.cockpit-dashboard-greeting { position:relative; }\n.cockpit-dashboard-name { cursor:pointer; }\n.cockpit-dashboard-name:hover { opacity:0.85; }\n.cockpit-dashboard-name-input { font-size:0.7em; font-weight:800; font-family:inherit; background:transparent; border:none; border-bottom:2px solid var(--cockpit-accent); color:var(--text-normal); outline:none; padding:0 2px; width:auto; min-width:3em; -webkit-text-fill-color:var(--text-normal); }\n\n@media (max-width: 720px) {\n  .cockpit-dashboard-root {\n    padding: 14px 16px;\n  }\n  .cockpit-dashboard-hero {\n    padding: 16px 14px 14px;\n  }\n  .cockpit-dashboard-hero-controls {\n    position: static;\n    justify-content: center;\n    margin-bottom: 10px;\n  }\n  .cockpit-dashboard-greeting {\n    padding: 0;\n  }\n  .cockpit-dashboard-lang-switch {\n    background: rgba(72,180,255,0.06);\n  }\n  .cockpit-dashboard-todo-actions {\n    gap: 6px;\n  }\n  .cockpit-dashboard-todo-btn {\n    width: 28px;\n    height: 28px;\n    font-size: 0.86em;\n  }\n  .cockpit-dashboard-cal-detail-head {\n    align-items: flex-start;\n    flex-wrap: wrap;\n  }\n  .cockpit-dashboard-cal-detail-add {\n    width: 100%;\n    justify-content: center;\n  }\n  .cockpit-dashboard-todo-editor-backdrop {\n    padding: 10px 10px 0;\n  }\n  .cockpit-dashboard-todo-editor-sheet {\n    width: 100%;\n    max-height: 88vh;\n    border-bottom-left-radius: 0;\n    border-bottom-right-radius: 0;\n  }\n  .cockpit-dashboard-todo-editor-tag-input-row {\n    flex-direction: column;\n    align-items: stretch;\n  }\n  .cockpit-dashboard-todo-editor-tag-input-row .cockpit-dashboard-todo-editor-secondary-btn,\n  .cockpit-dashboard-todo-editor-primary-btn,\n  .cockpit-dashboard-todo-editor-secondary-btn {\n    width: 100%;\n    justify-content: center;\n  }\n  .cockpit-dashboard-todo-editor-footer {\n    flex-direction: column-reverse;\n    align-items: stretch;\n  }\n}\n\n\n/* 首次使用引导 — 高亮脉波动画 */\n@keyframes cockpit-onboarding-pulse {\n  0%, 100% { box-shadow: 0 0 0 0 rgba(72,180,255,0.5), 0 0 0 0 rgba(72,180,255,0.2); }\n  50% { box-shadow: 0 0 0 4px rgba(72,180,255,0.4), 0 0 0 14px rgba(72,180,255,0.08); }\n}\n.cockpit-dashboard-welcome-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 9997;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 20px;\n  background: rgba(15, 23, 42, 0.52);\n  backdrop-filter: blur(14px);\n}\n.cockpit-dashboard-welcome-card {\n  width: min(720px, calc(100vw - 24px));\n  padding: 28px 28px 24px;\n  border-radius: 24px;\n  border: 1px solid rgba(72,180,255,0.16);\n  background:\n    radial-gradient(circle at top left, rgba(72,180,255,0.12), transparent 32%),\n    linear-gradient(180deg, rgba(29,36,48,0.98), rgba(19,24,34,0.98));\n  box-shadow: 0 28px 70px rgba(0,0,0,0.28);\n}\n.theme-light .cockpit-dashboard-welcome-card {\n  background:\n    radial-gradient(circle at top left, rgba(72,180,255,0.12), transparent 32%),\n    linear-gradient(180deg, rgba(255,255,255,0.99), rgba(244,247,252,0.98));\n  box-shadow: 0 22px 52px rgba(15,23,42,0.16);\n}\n.cockpit-dashboard-welcome-badge {\n  display: inline-flex;\n  align-items: center;\n  min-height: 28px;\n  padding: 0 12px;\n  border-radius: 999px;\n  background: rgba(72,180,255,0.12);\n  color: #8fd7ff;\n  font-size: 0.72em;\n  font-weight: 800;\n  letter-spacing: 0.04em;\n  margin-bottom: 14px;\n}\n.cockpit-dashboard-welcome-title {\n  font-size: 2em;\n  font-weight: 900;\n  color: var(--text-normal);\n  margin-bottom: 14px;\n}\n.cockpit-dashboard-welcome-intro {\n  display: grid;\n  gap: 10px;\n  margin-bottom: 20px;\n}\n.cockpit-dashboard-welcome-copy {\n  color: var(--text-muted);\n  line-height: 1.65;\n  font-size: 0.92em;\n}\n.cockpit-dashboard-welcome-copy.primary {\n  color: var(--text-normal);\n  font-weight: 600;\n}\n.cockpit-dashboard-welcome-lang-block {\n  margin-bottom: 20px;\n}\n.cockpit-dashboard-welcome-label {\n  font-size: 0.74em;\n  font-weight: 800;\n  color: var(--text-muted);\n  letter-spacing: 0.04em;\n  margin-bottom: 10px;\n}\n.cockpit-dashboard-welcome-lang-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n}\n.cockpit-dashboard-welcome-lang-btn,\n.cockpit-dashboard-welcome-start,\n.cockpit-dashboard-welcome-skip,\n.cockpit-dashboard-onboarding-card-btn,\n.cockpit-dashboard-onboarding-card-close {\n  border: none;\n  cursor: pointer;\n  touch-action: manipulation;\n}\n.cockpit-dashboard-welcome-lang-btn {\n  min-height: 42px;\n  padding: 0 16px;\n  border-radius: 12px;\n  border: 1px solid var(--background-modifier-border);\n  background: var(--background-secondary);\n  color: var(--text-muted);\n  font-size: 0.84em;\n  font-weight: 700;\n}\n.cockpit-dashboard-welcome-lang-btn.active {\n  background: rgba(72,180,255,0.14);\n  border-color: rgba(72,180,255,0.3);\n  color: #8fd7ff;\n  box-shadow: 0 8px 20px rgba(72,180,255,0.14);\n}\n.cockpit-dashboard-welcome-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 10px;\n}\n.cockpit-dashboard-welcome-start,\n.cockpit-dashboard-welcome-skip,\n.cockpit-dashboard-onboarding-card-btn {\n  min-height: 40px;\n  padding: 0 16px;\n  border-radius: 12px;\n  font-size: 0.8em;\n  font-weight: 800;\n}\n.cockpit-dashboard-welcome-start,\n.cockpit-dashboard-onboarding-card-btn.primary {\n  background: var(--interactive-accent);\n  color: white;\n}\n.cockpit-dashboard-welcome-skip,\n.cockpit-dashboard-onboarding-card-btn.secondary {\n  border: 1px solid var(--background-modifier-border);\n  background: var(--background-secondary);\n  color: var(--text-muted);\n}\n.cockpit-dashboard-onboarding-card {\n  position: fixed;\n  z-index: 9998;\n  max-width: 360px;\n  border-radius: 16px;\n  border: 1px solid rgba(72,180,255,0.12);\n  background: var(--background-primary);\n  box-shadow: 0 12px 36px rgba(0,0,0,0.2);\n  padding: 16px;\n  font-size: 0.85em;\n  line-height: 1.55;\n  transition: opacity 0.3s;\n}\n.cockpit-dashboard-onboarding-card-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  margin-bottom: 10px;\n}\n.cockpit-dashboard-onboarding-card-step {\n  font-size: 0.72em;\n  color: var(--text-muted);\n  font-weight: 700;\n}\n.cockpit-dashboard-onboarding-card-close {\n  min-height: 28px;\n  padding: 0 8px;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--text-muted);\n  font-size: 0.74em;\n  font-weight: 700;\n}\n.cockpit-dashboard-onboarding-card-body {\n  color: var(--text-normal);\n  margin-bottom: 12px;\n}\n.cockpit-dashboard-onboarding-card-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n}\n.cockpit-dashboard-onboarding-highlight {\n  animation: cockpit-onboarding-pulse 1.6s ease-in-out infinite;\n  border-radius: var(--radius-m, 10px);\n  outline: 2.5px solid rgba(72,180,255,0.35);\n  outline-offset: 4px;\n  position: relative;\n  transition: outline-color 0.3s;\n}\n@media (max-width: 720px) {\n  .cockpit-dashboard-welcome-card {\n    width: 100%;\n    padding: 22px 18px 18px;\n    border-radius: 20px;\n  }\n  .cockpit-dashboard-welcome-title {\n    font-size: 1.6em;\n  }\n  .cockpit-dashboard-welcome-actions,\n  .cockpit-dashboard-onboarding-card-actions {\n    flex-direction: column-reverse;\n    align-items: stretch;\n  }\n  .cockpit-dashboard-welcome-start,\n  .cockpit-dashboard-welcome-skip,\n  .cockpit-dashboard-onboarding-card-btn {\n    width: 100%;\n    justify-content: center;\n  }\n  .cockpit-dashboard-onboarding-card {\n    max-width: calc(100vw - 24px);\n  }\n}\n";

// ===== modules =====
// ===== constants.js =====
// constants.js — 全局常量（纯数据，无函数）

const VIEW_TYPE = 'cockpit-dashboard';
const PLUGIN_ID = 'cockpit-dashboard';
const TODO_FILE = '_data/todos.md';
const BOOKMARK_FILE = '_data/bookmarks.md';
const DEFAULT_LANG = 'zh-CN';
const LANG_OPTIONS = [
  { code: 'zh-CN', label: '中文', short: '中文' },
  { code: 'en', label: 'English', short: 'EN' }
];

const E = { wave:'👋', search:'🔍', tag:'🏷️', graph:'🕸️', bolt:'⚡', folder:'📂', rule:'📋', gear:'⚙️', robot:'🤖', box:'📦', chart:'📊', pencil:'✏️', check:'✅', save:'💾', edit:'✏️', del:'✕', cal:'📅' };
const COLORS = ['#818cf8','#f59e0b','#3b82f6','#22c55e','#ec4899','#14b8a6','#f97316','#6366f1'];
const ICONS  = ['📁','📂','🗂️','📋','📌','🏷️','🔖','📊'];
const RELEASE_HISTORY = [
  {
    version: '1.0.10',
    date: '2026-07-12',
    title: {
      'zh-CN': '全局搜索、优先待办与收藏工作流升级',
      en: 'Global Search, Priority Tasks, and Bookmark Workflow'
    },
    highlights: {
      'zh-CN': [
        '新增 Spotlight 风格 Vault 全局搜索，支持文件名、路径和正文匹配、输入防抖、键盘操作与拖动窗口。',
        '待办状态筛选改为紧凑下拉框；“优先处理”聚合高优先级或明天到期的未完成任务，并支持一键延期。',
        '日历详情与待办列表统一编辑图标和操作风格。',
        '收藏支持折叠、固定顺序、上下调整，并可一键在分栏中打开笔记。',
        'Toolbar 编辑模式支持新增、编辑、隐藏和删除自定义网址或 Shell 脚本按钮；后台脚本提供日志，交互命令统一使用 macOS 系统终端。',
        '新增带通俗引导的显式数据迁移；storageMigrationCompleted 完成前继续旧文件读写，完成后才切换 Storage V2。',
        'Toolbar 编辑态改为疏朗布局与统一文字显示/隐藏；自定义按钮及 Hermes、驾驶舱、工作日志均支持直接删除，三个预制按钮也可修改名称和命令。',
        '修复知识分类卡片在缺少概览/MOC 文件时无法点击的问题；现在会自动打开分类中的第一篇笔记，空目录会显示提示。'
      ],
      en: [
        'Added draggable Spotlight-style Vault search across note names, paths, and content, with debounced input and keyboard navigation.',
        'Changed task status filtering to a compact dropdown; Next includes unfinished high-priority tasks or tasks due tomorrow, with one-click deferral.',
        'Unified edit icons and action styling between calendar details and the main todo list.',
        'Added collapsible bookmarks with persistent ordering, move controls, and one-click split-pane opening.',
        'Toolbar Edit Mode can add, edit, hide, and delete custom URL or Shell-script buttons; background scripts expose logs and interactive commands always use macOS Terminal.',
        'Added an explicit guided data migration: legacy files remain active until storageMigrationCompleted is true, then Storage V2 becomes the only write target.',
        'Toolbar Edit Mode now uses a cleaner layout and consistent text Show/Hide controls; custom buttons and the seeded Hermes, Cockpit, and Work Log buttons can all be deleted, while seeded buttons remain editable.',
        'Fixed category cards that did nothing when no overview/MOC note existed; they now open the first note in the category or explain that the folder is empty.'
      ]
    }
  },
  {
    version: '1.0.9',
    date: '2026-07-08',
    title: {
      'zh-CN': '静默刷新、番茄钟历史记录与 Toolbar 可定制',
      en: 'Silent Refresh, Pomodoro History, and Customizable Toolbar'
    },
    highlights: {
      'zh-CN': [
        '新增局部静默刷新，问候语与首页关键区块会按周期更新，并尽量避开用户输入与编辑状态。',
        '番茄钟专注数据改为按日期累计写入 `_data/focus.md`，保留历史记录而不再只覆盖当天。',
        '重做番茄钟浮窗，强化深浅色适配，精简大小视图信息负载，并在休息结束后提示继续专注。',
        '修复 Hermes 启动链路，编辑模式下支持自定义隐藏 Toolbar 按钮。'
      ],
      en: [
        'Added partial silent refresh so the greeting and key dashboard sections update on a schedule while avoiding active input and edit states.',
        'Changed Pomodoro focus persistence to accumulate by date in `_data/focus.md`, preserving history instead of overwriting only today.',
        'Refined the floating Pomodoro with better light/dark support, leaner compact and expanded views, and a reminder when breaks end.',
        'Fixed the Hermes launch flow and added per-button Toolbar visibility controls in Edit Mode.'
      ]
    }
  },
  {
    version: '1.0.8',
    date: '2026-07-06',
    title: {
      'zh-CN': '编辑模式、更新记录与日历体验升级',
      en: 'Edit Mode, Release Notes, and Calendar Refresh'
    },
    highlights: {
      'zh-CN': [
        '新增编辑模式，支持模块拖拽排序、隐藏与持久化布局。',
        '右键菜单新增最近更新记录，内置本地版本历史弹窗。',
        '重做日历看板，优化深浅色观感与语言切换可读性。'
      ],
      en: [
        'Added Edit Mode with drag-to-reorder, hide/show controls, and persistent layout state.',
        'Added Recent Updates to the context menu with a built-in local release-notes modal.',
        'Refreshed the calendar board with better light/dark visuals and improved language-toggle legibility.'
      ]
    }
  },
  {
    version: '1.0.7',
    date: '2026-07-04',
    title: {
      'zh-CN': '语言切换与交互细节优化',
      en: 'Language Toggle and Interaction Polish'
    },
    highlights: {
      'zh-CN': [
        '新增中英文界面切换。',
        '增强按钮按压、悬停和动效反馈。',
        '整体交互细节更顺手。'
      ],
      en: [
        'Added Chinese and English UI switching.',
        'Improved hover, press, and motion feedback for key actions.',
        'Polished interaction details across the dashboard.'
      ]
    }
  },
  {
    version: '1.0.6',
    date: '2026-07-04',
    title: {
      'zh-CN': '界面打磨与 README 双语化',
      en: 'Dashboard Polish and Bilingual README'
    },
    highlights: {
      'zh-CN': [
        '优化 Dashboard 视觉细节。',
        '补充并整理双语 README。',
        '发布流程说明更完整。'
      ],
      en: [
        'Refined the visual details of the dashboard.',
        'Expanded and organized the bilingual README.',
        'Made the release workflow documentation more complete.'
      ]
    }
  },
  {
    version: '1.0.4',
    date: '2026-06-13',
    title: {
      'zh-CN': '修复配置解析异常',
      en: 'Fix Configuration Parsing Errors'
    },
    highlights: {
      'zh-CN': [
        '修复模板字面量中的正则反斜杠转义问题。',
        '修复换行解析错误导致的配置读取失败。',
        '重新构建主入口文件。'
      ],
      en: [
        'Fixed regex backslash escaping inside template literals.',
        'Fixed config loading failures caused by newline parsing issues.',
        'Rebuilt the main bundled entry file.'
      ]
    }
  },
  {
    version: '1.0.3',
    date: '2026-06-13',
    title: {
      'zh-CN': '支持工具栏命令自定义',
      en: 'Custom Toolbar Command Support'
    },
    highlights: {
      'zh-CN': [
        '新增 `_data/toolbar.md` 作为工具栏配置源。',
        '驾驶舱和工作日志命令可按需修改。',
        '首次加载时自动生成默认配置文件。'
      ],
      en: [
        'Added `_data/toolbar.md` as the toolbar configuration source.',
        'Made Cockpit and work-log commands customizable.',
        'Generated default config automatically on first load.'
      ]
    }
  },
  {
    version: '1.0.2',
    date: '2026-06-11',
    title: {
      'zh-CN': '插件商店描述与样式修正',
      en: 'Marketplace Copy and Style Cleanup'
    },
    highlights: {
      'zh-CN': [
        '修正插件描述文案。',
        '去除不必要的 `!important`。',
        '清理样式兼容性问题。'
      ],
      en: [
        'Revised plugin marketplace copy.',
        'Removed unnecessary `!important` rules.',
        'Cleaned up style compatibility issues.'
      ]
    }
  },
  {
    version: '1.0.1',
    date: '2026-06-11',
    title: {
      'zh-CN': '通过插件商店审核准备',
      en: 'Marketplace Review Preparation'
    },
    highlights: {
      'zh-CN': [
        '调整 manifest 与 README 以满足审核要求。',
        '统一 CSS 注释格式。',
        '补充 MIT LICENSE。'
      ],
      en: [
        'Adjusted the manifest and README for marketplace review requirements.',
        'Unified CSS comment formatting.',
        'Added the MIT LICENSE.'
      ]
    }
  }
];

const I18N = {
  'zh-CN': {
    sections: {
      cats: '📂 知识分类',
      todos: '✅ 待办事项',
      stats: '📊 统计进度',
      recent: '✏️ 最近更新',
      bookmarks: '⭐ 收藏文件',
      flash: '⚡ 闪念胶囊',
      heatmap: '📈 编辑热力图（近30天）'
    },
    greetings: {
      morning: '早上好',
      noon: '中午好',
      afternoon: '下午好',
      evening: '晚上好',
      night: '夜深了'
    },
    hero: {
      defaultName: '点击修改名称',
      today: ({ date }) => '今天是 ' + date,
      dueTodos: ({ count, icon }) => '您有 ' + count + ' 件' + icon + '截止待办',
      vaultDays: ({ days }) => '• 知识库已陪伴你 ' + days + ' 天',
      language: '界面语言'
    },
    tip: {
      label: '💡 今日运维技巧'
    },
    toolbar: {
      new: '新建笔记',
      search: '搜索',
      tag: '标签',
      graph: '图谱',
      command: '命令',
      more: '更多',
      hermes: 'Hermes',
      cockpit: '驾驶舱',
      workLog: '工作日志',
      pomodoro: '番茄钟'
    },
    search: {
      placeholder: '输入关键词搜索笔记...'
    },
    contextMenu: {
      refreshPage: '刷新页面',
      newNote: '新建笔记',
      searchNotes: '搜索笔记',
      commandPalette: '命令面板',
      openGraph: '打开图谱',
      startPomodoro: '启动番茄钟',
      releaseNotes: '最近更新记录'
    },
    layout: {
      edit: '编辑模式',
      done: '完成编辑',
      editHint: '进入编辑模式后可上下拖动模块排序',
      doneHint: '退出编辑模式',
      dragHandle: ({ module }) => '拖动排序：' + module,
      hide: '隐藏',
      show: '显示',
      hiddenTag: '已隐藏',
      hideModule: ({ module }) => '隐藏模块：' + module,
      showModule: ({ module }) => '显示模块：' + module,
      hideToolbarButton: ({ button }) => '隐藏按钮：' + button,
      showToolbarButton: ({ button }) => '显示按钮：' + button,
      modules: {
        hero: '欢迎区',
        tip: '每日小贴士',
        toolbar: '快捷工具栏',
        calendar: '日历看板',
        footer: '页脚'
      }
    },
    notices: {
      hermesStarting: '🤖 Hermes 正在启动…',
      hermesStartingExternal: '🤖 已在外部终端启动 Hermes',
      hermesFallbackExternal: '🤖 已切换到外部终端启动 Hermes',
      hermesFailed: ({ message }) => '🤖 Hermes 启动失败: ' + message,
      cockpitMissing: '🛩️ 驾驶舱未配置',
      cockpitStarting: '🛩️ 驾驶舱正在启动…',
      cockpitFailed: ({ message }) => '🛩️ 驾驶舱启动失败: ' + message,
      workLogMissing: '📝 工作日志未配置',
      workLogFailed: ({ message }) => '📝 工作日志执行失败: ' + message,
      workLogDone: '📝 工作日志已执行完毕'
    },
    calendar: {
      emptyDay: '这一天没有待办 🎉',
      backToToday: '回到今天',
      addTodo: '新增待办'
    },
    categories: {
      noteCount: ({ count }) => count + ' 篇笔记',
      openFolder: ({ folder }) => '打开分类：' + folder,
      emptyFolder: ({ folder }) => '“' + folder + '”分类中还没有笔记'
    },
    stats: {
      noteCount: '✏️ 笔记总数',
      todoCount: '✅ 待办总数',
      doneCount: '✅ 已完成',
      doneRate: '✅ 完成率',
      focusToday: '🍅 今日专注'
    },
    todo: {
      add: '新增待办',
      refresh: '刷新待办',
      all: '全部',
      todo: '待办',
      done: '已办',
      stateDone: '已完成',
      stateDoing: '进行中',
      placeholder: '输入待办标题...',
      overdue: ({ date }) => '⚠️ 已过期: ' + date,
      dueToday: '⏰ 今天到期',
      priorityHigh: '高优先级',
      priorityMid: '中优先级',
      priorityLow: '低优先级',
      priorityTitle: ({ value }) => '优先级: ' + value,
      edit: '编辑',
      remove: '删除',
      editorCreate: '新增待办',
      editorEdit: '编辑待办',
      editorTask: '待办内容',
      editorTaskPlaceholder: '例如：整理周报',
      editorDue: '截止日期',
      noDue: '不设置',
      dueTodayBtn: '今天',
      dueTomorrowBtn: '明天',
      editorPriority: '优先级',
      editorTags: '标签',
      editorNoTags: '未选择标签',
      editorTagPlaceholder: '新标签',
      editorAddTag: '添加标签',
      cancel: '取消',
      saveNew: '创建',
      saveEdit: '保存',
      legacyHint: '也兼容 #标签 due:YYYY-MM-DD p:high'
    },
    recent: {
      star: '收藏',
      unstar: '取消收藏'
    },
    flash: {
      placeholder: '随手记一条想法...',
      saved: '✓ 已保存',
      fileHeading: '闪念'
    },
    heatmap: {
      low: '少',
      high: '多',
      files: ({ count }) => count + ' 个文件'
    },
    footer: {
      text: '💾 h 持续维护 · 知识库是活的'
    },
    releases: {
      title: '最近更新记录',
      current: '当前版本',
      empty: '暂时没有可展示的更新记录。'
    },
    pomodoro: {
      title: '🍅 番茄钟',
      close: '关闭番茄钟',
      minimize: '最小化',
      expand: '展开',
      modeFocus: '专注轮',
      modeBreak: '休息轮',
      ready: '准备开始',
      dragHint: '拖动标题栏可移动',
      start: '▶ 开始',
      resume: '▶ 继续',
      pause: '⏸ 暂停',
      reset: '↺ 重置',
      focusToday: ({ minutes }) => '今日专注: ' + minutes + ' min',
      focusPaused: '专注暂停',
      breakPaused: '休息暂停',
      focusing: '专注中...',
      resting: '休息中...',
      completedOne: '✅ 完成一个番茄！',
      readyForBreak: '专注结束，准备休息',
      startBreak: '▶ 开始休息',
      breakEnd: '休息结束',
      readyForFocus: '休息完成，继续工作',
      backToWork: '回到专注',
      focusLogTitle: '专注记录'
    },
    onboarding: {
      stepName: '✏️ 这里可以切换界面语言，也可以点击昵称直接修改名字',
      stepToolbar: '⚡ 工具栏里可以快速新建笔记、搜索、打开标签和图谱，也能直接启动番茄钟',
      stepCalendar: '📅 日历看板显示每日待办，左右箭头切换月份，点击日期查看详情',
      stepTodo: '✅ 待办支持标签分类、红黄绿优先级、截止日期提醒，点击复选框完成',
      stepContextMenu: '🖱️ 桌面端在空白区域右键，可以打开快捷菜单，里面有刷新页面、最近更新和布局编辑',
      stepStats: '📊 统计卡片实时展示数据，各区域标题可点击折叠收起',
      stepPomodoro: '🍅 番茄钟 25 分专注 + 5 分休息，右下角浮动可拖拽',
      close: '✕ 关闭',
      prev: '← 上一步',
      next: '下一步 →',
      done: '✓ 完成'
    },
    welcome: {
      title: 'Cockpit Dashboard',
      badge: '首次设置',
      introCn: '欢迎使用 Cockpit Dashboard。先选择你的界面语言，再开始功能引导。',
      introEn: 'Welcome to Cockpit Dashboard. Choose your interface language first, then continue to the guided tour.',
      chooseLanguage: '选择语言',
      continue: '开始使用',
      skip: '跳过引导'
    }
  },
  en: {
    sections: {
      cats: '📂 Knowledge Areas',
      todos: '✅ Tasks',
      stats: '📊 Progress Stats',
      recent: '✏️ Recent Updates',
      bookmarks: '⭐ Starred Notes',
      flash: '⚡ Quick Capture',
      heatmap: '📈 Edit Heatmap (30d)'
    },
    greetings: {
      morning: 'Good morning',
      noon: 'Good noon',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Up late'
    },
    hero: {
      defaultName: 'Click to rename',
      today: ({ date }) => 'Today is ' + date,
      dueTodos: ({ count, icon }) => 'You have ' + count + ' ' + icon + ' tasks due soon',
      vaultDays: ({ days }) => '• Your vault has been with you for ' + days + ' days',
      language: 'Interface language'
    },
    tip: {
      label: '💡 Daily Ops Tip'
    },
    toolbar: {
      new: 'New Note',
      search: 'Search',
      tag: 'Tags',
      graph: 'Graph',
      command: 'Commands',
      more: 'More',
      hermes: 'Hermes',
      cockpit: 'Dashboard',
      workLog: 'Work Log',
      pomodoro: 'Pomodoro'
    },
    search: {
      placeholder: 'Search notes by keyword...'
    },
    contextMenu: {
      refreshPage: 'Refresh dashboard',
      newNote: 'New note',
      searchNotes: 'Search notes',
      commandPalette: 'Command palette',
      openGraph: 'Open graph view',
      startPomodoro: 'Start Pomodoro',
      releaseNotes: 'Recent updates'
    },
    layout: {
      edit: 'Edit Mode',
      done: 'Done',
      editHint: 'Turn on layout editing to drag modules up or down',
      doneHint: 'Exit layout editing',
      dragHandle: ({ module }) => 'Drag to reorder: ' + module,
      hide: 'Hide',
      show: 'Show',
      hiddenTag: 'Hidden',
      hideModule: ({ module }) => 'Hide module: ' + module,
      showModule: ({ module }) => 'Show module: ' + module,
      hideToolbarButton: ({ button }) => 'Hide toolbar button: ' + button,
      showToolbarButton: ({ button }) => 'Show toolbar button: ' + button,
      modules: {
        hero: 'Hero',
        tip: 'Daily Tip',
        toolbar: 'Toolbar',
        calendar: 'Calendar',
        footer: 'Footer'
      }
    },
    notices: {
      hermesStarting: '🤖 Starting Hermes…',
      hermesStartingExternal: '🤖 Hermes opened in an external terminal',
      hermesFallbackExternal: '🤖 Hermes fell back to an external terminal',
      hermesFailed: ({ message }) => '🤖 Hermes failed to start: ' + message,
      cockpitMissing: '🛩️ Dashboard command is not configured',
      cockpitStarting: '🛩️ Launching dashboard…',
      cockpitFailed: ({ message }) => '🛩️ Failed to launch dashboard: ' + message,
      workLogMissing: '📝 Work log command is not configured',
      workLogFailed: ({ message }) => '📝 Work log failed: ' + message,
      workLogDone: '📝 Work log finished'
    },
    calendar: {
      emptyDay: 'No tasks on this day 🎉',
      backToToday: 'Back to today',
      addTodo: 'Add task'
    },
    categories: {
      noteCount: ({ count }) => count + ' notes',
      openFolder: ({ folder }) => 'Open category: ' + folder,
      emptyFolder: ({ folder }) => 'No notes yet in “' + folder + '”'
    },
    stats: {
      noteCount: '✏️ Notes',
      todoCount: '✅ Open Tasks',
      doneCount: '✅ Done',
      doneRate: '✅ Completion',
      focusToday: '🍅 Focus Today'
    },
    todo: {
      add: 'Add task',
      refresh: 'Refresh tasks',
      all: 'All',
      todo: 'Open',
      done: 'Done',
      stateDone: 'Done',
      stateDoing: 'In progress',
      placeholder: 'Type a task title...',
      overdue: ({ date }) => '⚠️ Overdue: ' + date,
      dueToday: '⏰ Due today',
      priorityHigh: 'High priority',
      priorityMid: 'Medium priority',
      priorityLow: 'Low priority',
      priorityTitle: ({ value }) => 'Priority: ' + value,
      edit: 'Edit',
      remove: 'Delete',
      editorCreate: 'Add task',
      editorEdit: 'Edit task',
      editorTask: 'Task',
      editorTaskPlaceholder: 'Example: Finish weekly review',
      editorDue: 'Due date',
      noDue: 'No due date',
      dueTodayBtn: 'Today',
      dueTomorrowBtn: 'Tomorrow',
      editorPriority: 'Priority',
      editorTags: 'Tags',
      editorNoTags: 'No tags selected',
      editorTagPlaceholder: 'New tag',
      editorAddTag: 'Add tag',
      cancel: 'Cancel',
      saveNew: 'Create',
      saveEdit: 'Save',
      legacyHint: 'Also supports #tags due:YYYY-MM-DD p:high'
    },
    recent: {
      star: 'Star',
      unstar: 'Unstar'
    },
    flash: {
      placeholder: 'Capture a quick thought...',
      saved: '✓ Saved',
      fileHeading: 'Quick Capture'
    },
    heatmap: {
      low: 'Low',
      high: 'High',
      files: ({ count }) => count + ' files'
    },
    footer: {
      text: '💾 Maintained continuously · Keep the vault alive'
    },
    releases: {
      title: 'Recent updates',
      current: 'Current version',
      empty: 'No update records are available yet.'
    },
    pomodoro: {
      title: '🍅 Pomodoro',
      close: 'Close Pomodoro',
      minimize: 'Minimize',
      expand: 'Expand',
      modeFocus: 'Focus session',
      modeBreak: 'Break session',
      ready: 'Ready to focus',
      dragHint: 'Drag the header to move',
      start: '▶ Start',
      resume: '▶ Resume',
      pause: '⏸ Pause',
      reset: '↺ Reset',
      focusToday: ({ minutes }) => 'Focus today: ' + minutes + ' min',
      focusPaused: 'Focus paused',
      breakPaused: 'Break paused',
      focusing: 'Focusing...',
      resting: 'On break...',
      completedOne: '✅ One Pomodoro done!',
      readyForBreak: 'Focus finished, ready for a break',
      startBreak: '▶ Start break',
      breakEnd: 'Break finished',
      readyForFocus: 'Break over, back to focus',
      backToWork: 'Back to focus',
      focusLogTitle: 'Focus Log'
    },
    onboarding: {
      stepName: '✏️ Use this area to switch interface language and rename yourself quickly.',
      stepToolbar: '⚡ Use the toolbar for quick note actions, search, tags, graph view, and Pomodoro.',
      stepCalendar: '📅 The calendar shows daily tasks. Use arrows to switch months and click a day for details.',
      stepTodo: '✅ Tasks support tags, red-yellow-green priority, and due reminders. Click the checkbox to complete.',
      stepContextMenu: '🖱️ On desktop, right-click any blank area to open the quick menu for refresh, recent updates, and layout editing.',
      stepStats: '📊 Stat cards update live, and each section title can collapse its content.',
      stepPomodoro: '🍅 Pomodoro runs 25 minutes focus + 5 minutes break, and the floating card can be dragged.',
      close: '✕ Close',
      prev: '← Back',
      next: 'Next →',
      done: '✓ Finish'
    },
    welcome: {
      title: 'Cockpit Dashboard',
      badge: 'First-time setup',
      introCn: '欢迎使用 Cockpit Dashboard。先选择你的界面语言，再开始功能引导。',
      introEn: 'Welcome to Cockpit Dashboard. Choose your interface language first, then continue to the guided tour.',
      chooseLanguage: 'Choose Language',
      continue: 'Get Started',
      skip: 'Skip Guide'
    }
  }
};
const T = I18N[DEFAULT_LANG].sections;

const DAILY_TIPS = {
  'zh-CN': [
    '💡 Linux: `lsof -i :端口号` 快速查看哪个进程占用了端口',
    '💡 SQL: 大表加索引时用 `CREATE INDEX CONCURRENTLY`（PG）或 `ALTER TABLE ... ALGORITHM=INPLACE`（MySQL），避免锁表',
    '💡 Git: `git reflog` 可以找回被 reset/drop 的 commit，HEAD@{n} 定位',
    '💡 网络: `ss -tlnp` 比 netstat 更快，查看监听端口首选',
    '💡 Docker: `docker system prune -a --volumes` 一键清理悬空镜像和卷（慎用）',
    '💡 Nginx: `nginx -t` 测试配置语法，reload 前先跑一遍',
    '💡 低代码: 表单联动用 watch/effect 比 onChange 更可控，避免回调地狱',
    '💡 Oracle: `SELECT * FROM v$locked_object` 查锁表，`ALTER SYSTEM KILL SESSION` 解锁',
    '💡 内网穿透: frp 的 `transport.tls.enable = true` 加密流量，公网暴露必备',
    '💡 AI工具: Claude Code 的 CLAUDE.md 放项目根目录，每次会话自动加载上下文',
    '💡 运维: `journalctl -u 服务名 --since "1 hour ago"` 快速查最近日志',
    '💡 数据库: EXPLAIN ANALYZE 比 EXPLAIN 更准，会实际执行并返回真实耗时',
    '💡 Linux: `watch -n 1 命令` 每秒刷新执行，监控神器',
    '💡 Git: `git stash push -m "描述"` 给 stash 加注释，找起来不迷路',
    '💡 网络: `mtr 目标IP` 结合 ping + traceroute，定位网络抖动神器'
  ],
  en: [
    '💡 Linux: use `lsof -i :PORT` to see which process is holding a port.',
    '💡 SQL: build big-table indexes online with `CREATE INDEX CONCURRENTLY` or in-place alter options.',
    '💡 Git: `git reflog` can recover commits after a reset or dropped branch.',
    '💡 Network: `ss -tlnp` is usually faster than netstat for listening ports.',
    '💡 Docker: `docker system prune -a --volumes` clears dangling images and volumes. Use carefully.',
    '💡 Nginx: always run `nginx -t` before reloading config.',
    '💡 Low-code: watch/effect chains are easier to control than nested onChange callbacks.',
    '💡 Oracle: `SELECT * FROM v$locked_object` helps inspect table locks quickly.',
    '💡 Tunneling: enable `transport.tls.enable = true` in frp when exposing services publicly.',
    '💡 AI tools: keep `CLAUDE.md` at repo root so each session loads project context automatically.',
    '💡 Ops: `journalctl -u service --since \"1 hour ago\"` is a fast way to inspect fresh logs.',
    '💡 Databases: `EXPLAIN ANALYZE` is more truthful than `EXPLAIN` because it really runs the query.',
    '💡 Linux: `watch -n 1 <cmd>` is still one of the best lightweight monitors.',
    '💡 Git: annotate stashes with `git stash push -m \"desc\"` so you can find them later.',
    '💡 Network: `mtr <host>` is great for locating packet loss or routing jitter.'
  ]
};

function normalizeLang(lang) {
  return lang === 'en' ? 'en' : DEFAULT_LANG;
}

function getLangPack(lang) {
  return I18N[normalizeLang(lang)] || I18N[DEFAULT_LANG];
}

function getText(lang, key, vars) {
  const read = (pack, path) => path.split('.').reduce((acc, part) => acc && acc[part], pack);
  let value = read(getLangPack(lang), key);
  if (value == null) value = read(I18N[DEFAULT_LANG], key);
  if (typeof value === 'function') return value(vars || {});
  return value == null ? key : String(value);
}

const HERMES_TODOS = [
  { text: '📅 日历/日程看板', done: true, tags: ['obsidian'], priority: 'high', dueDate: '2026-06-02' },
  { text: '🍅 番茄钟/专注计时器', done: true, tags: ['obsidian'], priority: 'low', dueDate: null },
];

const DEFAULT_TODOS = [
  { text:'完善 Dashboard 驾驶舱功能', tags:['工作'], priority:'high', dueDate:null, done:false, created:null, doneDate:null },
  { text:'整理 gbrain 代码片段分类', tags:['工作'], priority:'mid', dueDate:null, done:false, created:null, doneDate:null },
  { text:'Gateway 配置文档补充', tags:['运维'], priority:'mid', dueDate:null, done:false, created:null, doneDate:null },
  { text:'Obsidian vault 创建和分类', tags:['工作'], priority:'low', dueDate:null, done:true, created:null, doneDate:null }
];

// ===== utils.js =====
// utils.js — 工具函数

function fmtDate(d, lang = DEFAULT_LANG) {
  if (!d) return '';
  const locale = normalizeLang(lang);
  const now = window.moment();
  if (d.isSame(now,'day')) return locale === 'en' ? 'Today' : '今天';
  if (d.clone().add(1,'day').isSame(now,'day')) return locale === 'en' ? 'Yesterday' : '昨天';
  if (d.isSame(now,'year')) return locale === 'en' ? formatMonthDay(d, locale) : d.format('M月D日');
  return d.format('YYYY-M-D');
}

function parseDate(s) {
  if (!s) return null;
  const d = window.moment(s.trim(),'YYYY-MM-DD',true);
  return d.isValid() ? d : null;
}

function extractTags(text) {
  const tags = [];
  const re = /#([^\s#]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) tags.push(m[1]);
  let dueDate = null;
  const dueM = text.match(/due:\s*(\d{4}-\d{2}-\d{2})/);
  if (dueM) dueDate = parseDate(dueM[1]);
  let priority = 'mid';
  const pM = text.match(/p:\s*(high|mid|low)/);
  if (pM) priority = pM[1];
  const cleanText = text.replace(/#[^\s#]+/g,'').replace(/due:\s*\S+/g,'').replace(/p:\s*\S+/g,'').trim();
  return { cleanText, tags, dueDate, priority };
}

function getDailyTip(lang = DEFAULT_LANG) {
  const dayOfYear = window.moment().dayOfYear();
  const tips = DAILY_TIPS[normalizeLang(lang)] || DAILY_TIPS[DEFAULT_LANG];
  return tips[dayOfYear % tips.length];
}

function getWeekdayLabels(lang = DEFAULT_LANG, style = 'short') {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    if (style === 'header') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (style === 'long') return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }
  if (style === 'header') return ['一', '二', '三', '四', '五', '六', '日'];
  if (style === 'long') return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return ['日', '一', '二', '三', '四', '五', '六'];
}

function getMonthLabels(lang = DEFAULT_LANG, style = 'short') {
  const locale = normalizeLang(lang);
  if (locale !== 'en') return null;
  if (style === 'long') return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

function formatMonthDay(d, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    return getMonthLabels(locale, 'short')[d.month()] + ' ' + d.date();
  }
  return d.format('M月D日');
}

function formatHeroDate(d, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    return getWeekdayLabels(locale, 'long')[d.day()] + ', ' + getMonthLabels(locale, 'short')[d.month()] + ' ' + d.date() + ', ' + d.year();
  }
  return d.year() + '年' + (d.month() + 1) + '月' + d.date() + '日 ' + getWeekdayLabels(locale, 'long')[d.day()];
}

function formatMonthTitle(year, monthIndex, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') return getMonthLabels(locale, 'long')[monthIndex] + ' ' + year;
  return year + '年' + (monthIndex + 1) + '月';
}

function formatCalendarDetailHeading(d, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    return getMonthLabels(locale, 'short')[d.month()] + ' ' + d.date() + ' ' + getWeekdayLabels(locale, 'short')[d.day()];
  }
  return d.format('M月D日') + ' ' + getWeekdayLabels(locale, 'long')[d.day()];
}

// ===== todos.js =====
// todos.js — 待办数据层：加载/保存/同步

async function loadTodos(vault) {
  try {
    const f = vault.getAbstractFileByPath(TODO_FILE);
    if (!f) return null;
    const content = await vault.read(f);
    const todos = [];
    for (const line of content.split('\n')) {
      const m = line.match(/^-\s+\[([ x])\]\s+(.+?)(?:\s*\|\s*(.+))?\s*$/);
      if (m) {
        const meta = m[3]||'';
        const cm = meta.match(/created:\s*(\S+)/);
        const dm = meta.match(/done:\s*(\S+)/);
        const created = cm ? parseDate(cm[1]) : null;
        const doneDate = dm ? parseDate(dm[1]) : null;
        const rawText = m[2].trim();
        const { cleanText, tags, dueDate, priority } = extractTags(rawText);
        todos.push({ text:cleanText, tags, priority, dueDate, done: m[1]==='x', created, doneDate });
      }
    }
    return todos.length > 0 ? todos : null;
  } catch(e) { return null; }
}

async function saveTodos(vault, todos) {
  try {
    const dir = TODO_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    const prefix = '# 待办事项\n\n';
    const lines = todos.map(t => {
      const meta = [];
      if (t.created) meta.push('created: '+t.created.format('YYYY-MM-DD'));
      if (t.done && t.doneDate) meta.push('done: '+t.doneDate.format('YYYY-MM-DD'));
      let text = t.text;
      if (t.tags && t.tags.length > 0) text += ' ' + t.tags.map(tag => '#'+tag).join(' ');
      if (t.dueDate) text += ' due:'+t.dueDate.format('YYYY-MM-DD');
      if (t.priority && t.priority !== 'mid') text += ' p:'+t.priority;
      return meta.length ? '- ['+(t.done?'x':' ')+'] '+text+' | '+meta.join(' | ') : '- ['+(t.done?'x':' ')+'] '+text;
    });
    const file = vault.getAbstractFileByPath(TODO_FILE);
    if (file) await vault.modify(file, prefix+lines.join('\n')+'\n');
    else await vault.create(TODO_FILE, prefix+lines.join('\n')+'\n');
  } catch(e) { console.warn('saveTodos',e); }
}

async function syncHermesTodos(vault, existingTodos) {
  try {
    const today = window ? window.moment().format('YYYY-MM-DD') : new Date().toISOString().slice(0,10);
    let changed = false;
    for (const ht of HERMES_TODOS) {
      const exists = existingTodos.find(t => t.text === ht.text);
      if (!exists) {
        // 只在文件里不存在时才新增，以 HERMES_TODOS 的值为准
        existingTodos.push({
          text: ht.text, tags: ht.tags, priority: ht.priority,
          dueDate: ht.dueDate ? window.moment(ht.dueDate, 'YYYY-MM-DD', true) : null,
          done: ht.done,
          created: window.moment(today, 'YYYY-MM-DD', true),
          doneDate: ht.done ? window.moment(today, 'YYYY-MM-DD', true) : null,
        });
        changed = true;
      }
      // 文件里已有的条目，以文件为准，不覆盖用户的修改
    }
    if (changed) await saveTodos(vault, existingTodos);
  } catch(e) { console.warn('syncHermesTodos', e); }
}

// ===== bookmarks.js =====
async function loadBookmarks(vault) {
  try {
    const f = vault.getAbstractFileByPath(BOOKMARK_FILE);
    if (!f) return new Set();
    const content = await vault.read(f);
    const set = new Set();
    content.split('\n').forEach(l => { const t=l.trim(); if(t && !t.startsWith('#')) set.add(t); });
    return set;
  } catch(e) { return new Set(); }
}
async function saveBookmarks(vault, bmSet) {
  try {
    const dir = BOOKMARK_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    // Set 的插入顺序就是用户的收藏顺序，不能排序后再写回。
    const content = '# 收藏文件\n\n' + Array.from(bmSet).join('\n') + '\n';
    const file = vault.getAbstractFileByPath(BOOKMARK_FILE);
    if (file) await vault.modify(file, content);
    else await vault.create(BOOKMARK_FILE, content);
  } catch(e) { console.warn('saveBookmarks',e); }
}

// ===== storage.js =====
// storage.js — Storage V2：非破坏迁移、兼容读取、导入导出与旧文件清理

const COCKPIT_STORAGE_VERSION = 2;
const LEGACY_STORAGE_FILES = [BOOKMARK_FILE, '_data/toolbar.md', '_data/toolbar-runs.md'];

function parseToolbarConfig(content) {
  const commands = {};
  const sections = String(content || '').split(/^\[(.+?)\]/m);
  for (let i = 1; i < sections.length; i += 2) {
    const name = sections[i].trim();
    const body = sections[i + 1] || '';
    const values = {};
    body.split('\n').forEach((line) => {
      const match = line.match(/^\s*(\S+)\s*=\s*(.*)/);
      if (match) values[match[1]] = match[2].trim();
    });
    if (name) commands[name] = values;
  }
  return commands;
}

function normalizeToolbarCommands(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  Object.entries(raw).slice(0, 30).forEach(([name, values]) => {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return;
    const safeName = String(name).trim().slice(0, 64);
    if (!safeName || ['__proto__','prototype','constructor'].includes(safeName)) return;
    const next = {};
    Object.entries(values).slice(0, 20).forEach(([key, value]) => {
      const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      if (safeKey && !['__proto__','prototype','constructor'].includes(safeKey)) next[safeKey] = String(value ?? '').slice(0, 8000);
    });
    result[safeName] = next;
  });
  return result;
}

function serializeToolbarConfig(commands) {
  return '# Toolbar 自定义命令配置\n# 迁移完成前，此文件仍是命令配置来源。\n\n' + Object.entries(normalizeToolbarCommands(commands)).map(([name, values]) => {
    return '[' + name + ']\n' + Object.entries(values).map(([key, value]) => key + ' = ' + value).join('\n');
  }).join('\n\n') + '\n';
}

class CockpitStorage {
  constructor(plugin, app) { this.plugin = plugin; this.app = app; }

  async _readData() { return await this.plugin.loadData() || {}; }
  async _writeData(data) { await this.plugin.saveData(data); return data; }

  async initialize(defaultToolbarCommands) {
    const data = await this._readData();
    if (typeof data.storageMigrationCompleted !== 'boolean') {
      data.storageMigrationCompleted = false;
      data.storageMigration = { ...(data.storageMigration || {}), offeredAt:new Date().toISOString() };
      await this._writeData(data);
    }
    // 未迁移用户继续使用旧文件；缺少旧 Toolbar 文件时按旧格式创建默认配置。
    if (!data.storageMigrationCompleted && !this.app.vault.getAbstractFileByPath('_data/toolbar.md')) {
      if (!this.app.vault.getAbstractFileByPath('_data')) await this.app.vault.createFolder('_data');
      await this.app.vault.create('_data/toolbar.md', serializeToolbarConfig(defaultToolbarCommands));
    }
    return data;
  }

  async isMigrationCompleted() { return (await this._readData()).storageMigrationCompleted === true; }

  async migrate(defaultToolbarCommands) {
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) return data;
    const legacyBookmarks = await loadBookmarks(this.app.vault);
    const legacyToolbar = this.app.vault.getAbstractFileByPath('_data/toolbar.md');
    let commands = {};
    if (legacyToolbar) {
      try { commands = normalizeToolbarCommands(parseToolbarConfig(await this.app.vault.read(legacyToolbar))); } catch (e) {}
    }
    // 兼容上一版曾经预复制但未正式完成迁移的用户：旧文件优先，缺失时保留 data.json 中已有副本。
    data.bookmarks = legacyBookmarks.size ? Array.from(legacyBookmarks) : (Array.isArray(data.bookmarks) ? data.bookmarks : []);
    data.toolbarCommands = Object.keys(commands).length ? commands : (Object.keys(normalizeToolbarCommands(data.toolbarCommands)).length ? normalizeToolbarCommands(data.toolbarCommands) : normalizeToolbarCommands(defaultToolbarCommands));
    data.storageVersion = COCKPIT_STORAGE_VERSION;
    data.storageMigration = { ...(data.storageMigration || {}), completedAt:new Date().toISOString(), source:'legacy-copy' };
    // 完成标记最后写入；此前任何异常都会保持旧存储模式。
    data.storageMigrationCompleted = true;
    await this._writeData(data);
    return data;
  }

  async loadBookmarks() {
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) return Array.isArray(data.bookmarks) ? data.bookmarks.map(String).filter(Boolean) : [];
    return Array.from(await loadBookmarks(this.app.vault));
  }

  async saveBookmarks(bookmarks) {
    const data = await this._readData();
    const values = Array.from(bookmarks || []).map(String).filter(Boolean);
    if (data.storageMigrationCompleted === true) {
      data.bookmarks = values;
      data.storageVersion = COCKPIT_STORAGE_VERSION;
      await this._writeData(data);
    } else {
      await saveBookmarks(this.app.vault, new Set(values));
    }
  }

  async loadToolbarCommands(defaults) {
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) {
      const commands = normalizeToolbarCommands(data.toolbarCommands);
      return Object.keys(commands).length ? commands : normalizeToolbarCommands(defaults);
    }
    const legacy = this.app.vault.getAbstractFileByPath('_data/toolbar.md');
    if (legacy) {
      try {
        const commands = normalizeToolbarCommands(parseToolbarConfig(await this.app.vault.read(legacy)));
        if (Object.keys(commands).length) return commands;
      } catch (e) {}
    }
    return normalizeToolbarCommands(defaults);
  }

  async saveToolbarCommands(commands) {
    const normalized = normalizeToolbarCommands(commands);
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) {
      data.toolbarCommands = normalized;
      data.storageVersion = COCKPIT_STORAGE_VERSION;
      await this._writeData(data);
      return;
    }
    if (!this.app.vault.getAbstractFileByPath('_data')) await this.app.vault.createFolder('_data');
    const content = serializeToolbarConfig(normalized);
    const file = this.app.vault.getAbstractFileByPath('_data/toolbar.md');
    if (file) await this.app.vault.modify(file, content);
    else await this.app.vault.create('_data/toolbar.md', content);
  }

  async exportData() {
    const data = await this._readData();
    return {
      format: 'cockpit-storage-v2',
      exportedAt: new Date().toISOString(),
      data: {
        bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
        toolbarCommands: normalizeToolbarCommands(data.toolbarCommands),
        customToolbarButtons: Array.isArray(data.customToolbarButtons) ? data.customToolbarButtons : [],
        toolbarOrder: Array.isArray(data.toolbarOrder) ? data.toolbarOrder : [],
        bookmarkOrder: Array.isArray(data.bookmarkOrder) ? data.bookmarkOrder : [],
        username: data.username || '', language: data.language || DEFAULT_LANG,
        collapsed: data.collapsed || {}, moduleOrder: data.moduleOrder || [],
        hiddenModules: data.hiddenModules || [], hiddenToolbarActions: data.hiddenToolbarActions || [],
        deletedToolbarActions: data.deletedToolbarActions || []
      }
    };
  }

  async importData(payload) {
    if (!payload || payload.format !== 'cockpit-storage-v2' || !payload.data || typeof payload.data !== 'object') {
      throw new Error('invalid-format');
    }
    const incoming = payload.data;
    const data = await this._readData();
    if (Array.isArray(incoming.bookmarks)) data.bookmarks = incoming.bookmarks.map(String).filter(Boolean).slice(0, 5000);
    if (incoming.toolbarCommands) data.toolbarCommands = normalizeToolbarCommands(incoming.toolbarCommands);
    if (Array.isArray(incoming.customToolbarButtons)) data.customToolbarButtons = normalizeCustomToolbarButtons(incoming.customToolbarButtons);
    ['bookmarkOrder','toolbarOrder','moduleOrder','hiddenModules','hiddenToolbarActions','deletedToolbarActions'].forEach((key) => {
      if (Array.isArray(incoming[key])) data[key] = incoming[key].map(String).slice(0, 5000);
    });
    if (incoming.collapsed && typeof incoming.collapsed === 'object' && !Array.isArray(incoming.collapsed)) {
      data.collapsed = {};
      Object.entries(incoming.collapsed).slice(0, 100).forEach(([key, value]) => {
        const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
        if (safeKey && !['__proto__','prototype','constructor'].includes(safeKey)) data.collapsed[safeKey] = !!value;
      });
    }
    if (typeof incoming.username === 'string') data.username = incoming.username.slice(0, 80);
    if (typeof incoming.language === 'string') data.language = normalizeLang(incoming.language);
    data.storageVersion = COCKPIT_STORAGE_VERSION;
    data.storageMigrationCompleted = true;
    data.storageMigration = { ...(data.storageMigration || {}), importedAt: new Date().toISOString(), completedAt:new Date().toISOString(), source:'import' };
    await this._writeData(data);
  }

  async cleanupLegacy() {
    const data = await this._readData();
    if (data.storageMigrationCompleted !== true) {
      throw new Error('migration-incomplete');
    }
    const removed = [];
    for (const path of LEGACY_STORAGE_FILES) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file) continue;
      await this.app.vault.delete(file);
      removed.push(path);
    }
    data.storageMigration = { ...data.storageMigration, legacyCleanedAt: new Date().toISOString(), removedLegacyFiles: removed };
    await this._writeData(data);
    return removed;
  }

  async status() {
    const data = await this._readData();
    return {
      version: data.storageVersion || 1,
      migrated: data.storageMigrationCompleted === true,
      copiedAt: data.storageMigration?.completedAt || null,
      legacyFiles: LEGACY_STORAGE_FILES.filter((path) => !!this.app.vault.getAbstractFileByPath(path))
    };
  }
}

function openStorageMigration(view) {
  const en = view._lang() === 'en';
  const PID = PLUGIN_ID;
  const overlay = document.createElement('div');
  overlay.className = PID + '-storage-backdrop';
  const panel = overlay.createDiv({ cls: PID + '-storage-manager' });
  overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
  panel.onclick = (evt) => evt.stopPropagation();
  const head = panel.createDiv({ cls: PID + '-storage-head' });
  head.createDiv({ cls: PID + '-storage-title', text: en ? 'Data migration' : '数据迁移' });
  const close = head.createEl('button', { cls: PID + '-storage-close', attr:{type:'button'} });
  obsidian.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  const hero = panel.createDiv({ cls:PID + '-storage-guide' });
  const badge = hero.createDiv({ cls:PID + '-storage-badge', text:en?'Checking…':'正在检查…' });
  hero.createDiv({ cls:PID + '-storage-guide-title', text:en?'Move internal settings out of visible _data files':'把内部设置从可见的 _data 文件迁移出去' });
  hero.createDiv({ cls:PID + '-storage-guide-copy', text:en?'Migration copies bookmarks and Toolbar configuration into the plugin’s private data.json. Todos and focus history remain readable Markdown. Nothing is deleted automatically.':'迁移会把收藏和 Toolbar 配置复制到插件私有的 data.json。待办和专注历史仍保留为可读 Markdown，任何旧文件都不会被自动删除。' });
  const steps = panel.createDiv({ cls:PID + '-storage-steps' });
  [
    en?'1. Check the existing bookmark and Toolbar files.':'1. 检查现有收藏和 Toolbar 配置文件。',
    en?'2. Copy their current contents into Storage V2.':'2. 把当前内容安全复制到 Storage V2。',
    en?'3. Set storageMigrationCompleted = true only after the copy succeeds.':'3. 只有复制成功后才写入 storageMigrationCompleted = true。',
    en?'4. Future writes use the new storage; old files remain as a backup until you choose cleanup.':'4. 后续只写新存储；旧文件继续作为备份，直到你主动清理。'
  ].forEach((text) => steps.createDiv({ cls:PID + '-storage-step', text }));
  const statusEl = panel.createDiv({ cls: PID + '-storage-status', text: en ? 'Loading migration status…' : '正在读取迁移状态…' });
  const warning = panel.createDiv({ cls: PID + '-storage-warning', text: en ? 'Safe by default: migration copies data and never removes todos, focus history, or old files.' : '默认安全：迁移只复制数据，不会删除待办、专注历史或任何旧文件。' });
  const actions = panel.createDiv({ cls: PID + '-storage-actions' });
  const migrateBtn = actions.createEl('button', { cls:PID + '-storage-migrate-btn', text: en ? 'Start safe migration' : '开始安全迁移', attr:{type:'button'} });
  const exportBtn = actions.createEl('button', { text: en ? 'Copy export JSON' : '复制导出 JSON', attr:{type:'button'} });
  const cleanupBtn = actions.createEl('button', { text: en ? 'Clean migrated legacy files' : '清理已迁移旧文件', attr:{type:'button'} });
  const advanced = panel.createEl('details', { cls:PID + '-storage-advanced' });
  advanced.createEl('summary', { text:en?'Advanced: import or inspect JSON':'高级选项：导入或检查 JSON' });
  advanced.createDiv({ cls:PID + '-storage-advanced-copy', text:en?'Only use import with a Cockpit Storage V2 export you trust. Exported custom scripts are plain text.':'只导入你信任的 Cockpit Storage V2 备份；导出的自定义脚本是明文内容。' });
  const input = advanced.createEl('textarea', { cls: PID + '-storage-import', attr:{rows:'9',placeholder:en?'Paste cockpit-storage-v2 JSON here':'在这里粘贴 cockpit-storage-v2 JSON'} });
  const importBtn = advanced.createEl('button', { cls: PID + '-storage-import-btn', text: en ? 'Import JSON' : '导入 JSON', attr:{type:'button'} });
  const message = panel.createDiv({ cls: PID + '-storage-message' });
  const refreshStatus = async () => {
    const status = await view._storage.status();
    badge.textContent = status.migrated ? (en?'✓ Migration complete':'✓ 已完成迁移') : (en?'Migration not started':'尚未完成迁移');
    badge.classList.toggle('complete', status.migrated);
    statusEl.textContent = status.migrated
      ? (en?'Storage V2 is active. New bookmark and Toolbar writes now go only to data.json.':'Storage V2 已启用，新的收藏和 Toolbar 配置只会写入 data.json。')
      : (en?'Legacy mode is active. Bookmarks and Toolbar configuration still read and write the old _data files.':'当前仍是旧版存储模式，收藏和 Toolbar 配置继续读写原来的 _data 文件。');
    migrateBtn.disabled = status.migrated;
    migrateBtn.textContent = status.migrated ? (en?'Migration completed':'迁移已完成') : (en?'Start safe migration':'开始安全迁移');
    cleanupBtn.disabled = !status.migrated;
  };
  migrateBtn.onclick = async () => {
    if (!window.confirm(en?'Start migration now? Existing files will be copied and kept unchanged.':'现在开始迁移？现有文件只会被复制，并保持原样。')) return;
    migrateBtn.disabled = true;
    message.textContent = en?'Copying current data…':'正在复制当前数据…';
    try {
      await view._storage.migrate(view._defaultToolbarCommands());
      message.textContent = en?'Migration completed. Reloading the dashboard…':'迁移完成，正在刷新驾驶舱…';
      await refreshStatus();
      setTimeout(async () => { overlay.remove(); await view._renderDashboard(true); }, 500);
    } catch (e) {
      message.textContent = en?'Migration failed. Legacy mode remains active and no old files were deleted.':'迁移失败，仍保持旧版存储模式，旧文件没有被删除。';
      migrateBtn.disabled = false;
    }
  };
  exportBtn.onclick = async () => {
    const json = JSON.stringify(await view._storage.exportData(), null, 2);
    input.value = json;
    try {
      await navigator.clipboard.writeText(json);
      message.textContent = en ? 'Export JSON copied and shown below.' : '导出 JSON 已复制，并显示在下方。';
    } catch (e) { message.textContent = en ? 'Export JSON is shown below; copy it manually.' : '导出 JSON 已显示在下方，请手动复制。'; }
  };
  importBtn.onclick = async () => {
    try {
      if (!window.confirm(en ? 'Import and overwrite the corresponding Cockpit settings?' : '导入并覆盖对应的 Cockpit 设置？')) return;
      await view._storage.importData(JSON.parse(input.value));
      message.textContent = en ? 'Import complete. Reloading…' : '导入完成，正在刷新…';
      overlay.remove(); await view._renderDashboard(true);
    } catch (e) { message.textContent = en ? 'Invalid or unsupported import JSON.' : '导入 JSON 无效或格式不受支持。'; }
  };
  cleanupBtn.onclick = async () => {
    const ok = window.confirm(en ? 'Delete only the migrated legacy bookmark, Toolbar config, and old log files? Todos and focus history will remain.' : '仅删除已迁移的旧收藏、Toolbar 配置和旧日志文件？待办和专注历史会保留。');
    if (!ok) return;
    try {
      const removed = await view._storage.cleanupLegacy();
      message.textContent = (en?'Removed: ':'已清理：') + (removed.join(', ') || (en?'nothing':'无'));
      await refreshStatus();
    } catch (e) { message.textContent = en ? 'Migration is not complete; nothing was deleted.' : '迁移尚未完成，没有删除任何文件。'; }
  };
  document.body.appendChild(overlay); refreshStatus();
}

// ===== calendar.js =====
// calendar.js — 日历看板模块
// 导出：buildCalendar(root, todos, opts) → renderAll 函数

function buildCalendar(root, todos, opts) {
  const { getVault, onTodoToggle, getCurrentTodos } = opts;
  let calYear  = window.moment().year();
  let calMonth = window.moment().month();
  let selDay   = window.moment().date();
  let calRoot  = null;
  let gridEl   = null;
  let subtitleEl = null;
  const DOW_LABELS = ['一','二','三','四','五','六','日'];
  const now = window.moment();
  const getSelectedDate = () => window.moment([calYear, calMonth, selDay]);
  const updateCalendarSubtitle = () => {
    if (!subtitleEl) return;
    const selDate = getSelectedDate();
    const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][selDate.day()];
    subtitleEl.setText(selDate.format('M月D日') + ' ' + weekDay);
  };

  function buildTodoMap() {
    const m = {};
    (todos || []).forEach(t => {
      if (t.dueDate) {
        const key = t.dueDate.format('YYYY-MM-DD');
        if (!m[key]) m[key] = [];
        m[key].push({ text: t.text, done: t.done, priority: t.priority, raw: t });
      }
    });
    return m;
  }

  function ensureRoot() {
    if (!calRoot || !calRoot.parentNode) {
      calRoot = document.createElement('div');
      calRoot.className = PLUGIN_ID + '-cal-wrap';
      const ref = root.querySelector('.' + PLUGIN_ID + '-search-results');
      if (ref && ref.parentNode) ref.parentNode.insertBefore(calRoot, ref.nextSibling);
      else root.prepend(calRoot);
    }
    calRoot.innerHTML = '';
  }

  function renderDetail(tm) {
    if (!calRoot || !calRoot.parentNode) return;
    const old = calRoot.parentNode.querySelector('.' + PLUGIN_ID + '-cal-detail');
    if (old) old.remove();
    const selDate  = getSelectedDate();
    const selKey   = selDate.format('YYYY-MM-DD');
    const items    = tm[selKey] || [];
    const det      = document.createElement('div');
    det.className  = PLUGIN_ID + '-cal-detail';
    calRoot.parentNode.insertBefore(det, calRoot.nextSibling);
    const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][selDate.day()];
    det.createDiv({ cls: PLUGIN_ID + '-cal-detail-title', text: selDate.format('M月D日') + ' ' + weekDay });
    if (!items.length) {
      det.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty', text: '这一天没有待办 🎉' });
    } else {
      items.forEach(td => {
        const citem = det.createDiv({ cls: PLUGIN_ID + '-cal-detail-item' });
        const chk   = citem.createDiv({ cls: PLUGIN_ID + '-cal-detail-check' + (td.done ? ' done' : ''), text: td.done ? '✓' : '' });
        const span  = citem.createSpan({ cls: PLUGIN_ID + '-cal-detail-text' + (td.done ? ' done' : ''), text: (td.done ? '🟢 ' : td.priority === 'high' ? '🔴 ' : td.priority === 'mid' ? '🟡 ' : '🟢 ') + td.text });
        const toggle = async (e) => {
          if (e) e.stopPropagation();
          td.raw.done = !td.raw.done;
          td.raw.doneDate = td.raw.done ? window.moment() : null;
          if (getVault) await saveTodos(getVault(), getCurrentTodos ? getCurrentTodos() : todos);
          renderAll();
          if (onTodoToggle) onTodoToggle();
        };
        chk.onclick  = toggle;
        span.onclick = toggle;
      });
    }
  }

  function renderAll() {
    const todoMap = buildTodoMap();
    ensureRoot();
    const header = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-header' });
    const titleWrap = header.createDiv({ cls: PLUGIN_ID + '-cal-title-wrap' });
    titleWrap.createDiv({ cls: PLUGIN_ID + '-cal-title', text: calYear + '年' + (calMonth + 1) + '月' });
    subtitleEl = titleWrap.createDiv({ cls: PLUGIN_ID + '-cal-subtitle', text: '' });
    updateCalendarSubtitle();
    const nav = header.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
    const prevBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '‹' });
    const todayBtn = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '●', attr:{ title:'回到今天' } });
    const nextBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '›' });
    gridEl = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-grid' });
    DOW_LABELS.forEach(d => gridEl.createDiv({ cls: PLUGIN_ID + '-cal-dow', text: d }));
    const firstDay    = window.moment([calYear, calMonth, 1]);
    const startDow    = firstDay.day();
    const offset      = startDow === 0 ? 6 : startDow - 1;
    const daysInMonth = firstDay.daysInMonth();
    const prevDays    = window.moment([calYear, calMonth, 1]).subtract(1,'month').daysInMonth();
    for (let i = offset - 1; i >= 0; i--) gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(prevDays - i) });
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = window.moment([calYear, calMonth, d]);
      const dateKey  = cellDate.format('YYYY-MM-DD');
      const dayTodos = todoMap[dateKey] || [];
      const isToday  = cellDate.isSame(now, 'day');
      const isSel    = d === selDay;
      const cls = PLUGIN_ID + '-cal-cell' + (isToday ? ' today' : '') + (dayTodos.length ? ' has-todos' : '') + (isSel ? ' selected' : '');
      const cell = gridEl.createDiv({ cls });
      cell.createSpan({ text: String(d) });
      if (dayTodos.length) {
        const dots = cell.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
        const pc = { high:'#ef4444', mid:'#f59e0b', low:'#22c55e' };
        dayTodos.slice(0,3).forEach(t => { dots.createDiv({ cls: PLUGIN_ID+'-cal-dot', attr:{ style:'background:' + (t.done ? '#22c55e' : (pc[t.priority] || '#818cf8')) } }); });
      }
      cell.onclick = () => { selDay = d; renderDayDetailOnly(todoMap); };
    }
    const total = offset + daysInMonth;
    const needTrail = (7 - (total % 7)) % 7;
    const fill = Math.max(0, 42 - total - needTrail) + needTrail;
    for (let i = 1; i <= fill; i++) gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(i) });
    const goMonth = (dir) => {
      gridEl.classList.remove('slide-in');
      gridEl.classList.add(dir > 0 ? 'slide-out-left' : 'slide-out-right');
      setTimeout(() => {
        calMonth += dir;
        if (calMonth < 0)  { calMonth = 11; calYear--; }
        if (calMonth > 11) { calMonth = 0;  calYear++; }
        selDay = Math.min(selDay, window.moment([calYear, calMonth, 1]).daysInMonth());
        renderAll();
        requestAnimationFrame(() => { const g = calRoot.querySelector('.' + PLUGIN_ID + '-cal-grid'); if (g) { g.classList.remove('slide-out-left','slide-out-right'); g.classList.add('slide-in'); } });
      }, 200);
    };
    prevBtn.onclick  = () => goMonth(-1);
    nextBtn.onclick  = () => goMonth(1);
    todayBtn.onclick = () => { calYear = now.year(); calMonth = now.month(); selDay = now.date(); renderAll(); };
    renderDetail(todoMap);
  }

  function renderDayDetailOnly(tm) {
    if (gridEl) { const allCells = gridEl.querySelectorAll('.' + PLUGIN_ID + '-cal-cell'); let cur = 0; allCells.forEach(c => { if (c.classList.contains('dim')) return; cur++; c.classList.toggle('selected', cur === selDay); }); }
    updateCalendarSubtitle();
    renderDetail(tm);
  }

  renderAll();
  return renderAll;
}

// ===== search.js =====
// search.js — Spotlight 风格的 Vault 全局搜索

class CockpitGlobalSearchModal extends obsidian.Modal {
  constructor(app, language) {
    super(app);
    this.language = language || DEFAULT_LANG;
    this._cursor = 0;
    this._results = [];
    this._timer = null;
    this._queryVersion = 0;
  }

  _text(cn, en) { return this.language === 'en' ? en : cn; }

  onOpen() {
    this.modalEl.addClass(PLUGIN_ID + '-spotlight-modal');
    this.contentEl.empty();
    const box = this.contentEl.createDiv({ cls: PLUGIN_ID + '-spotlight' });
    const dragBar = box.createDiv({ cls: PLUGIN_ID + '-spotlight-dragbar', attr: { title: this._text('拖动搜索窗口', 'Drag search window') } });
    obsidian.setIcon(dragBar.createSpan(), 'grip-horizontal');
    this._bindDrag(dragBar);
    const searchRow = box.createDiv({ cls: PLUGIN_ID + '-spotlight-input-row' });
    obsidian.setIcon(searchRow.createSpan({ cls: PLUGIN_ID + '-spotlight-icon' }), 'search');
    this.input = searchRow.createEl('input', {
      cls: PLUGIN_ID + '-spotlight-input',
      attr: { type: 'text', placeholder: this._text('搜索笔记内容、文件名或路径…', 'Search notes, content, or paths…') }
    });
    this.hint = box.createDiv({ cls: PLUGIN_ID + '-spotlight-hint', text: this._text('输入关键词 · ↑↓ 选择 · Enter 打开 · Esc 关闭', 'Type to search · ↑↓ select · Enter open · Esc close') });
    this.resultsEl = box.createDiv({ cls: PLUGIN_ID + '-spotlight-results' });
    this.input.addEventListener('input', () => {
      clearTimeout(this._timer);
      // 输入一变化就使正在进行的正文扫描失效，再对下一次搜索做防抖。
      const version = ++this._queryVersion;
      this.hint.setText(this._text('继续输入以缩小范围…', 'Keep typing to narrow results…'));
      this._timer = setTimeout(() => this._search(this.input.value, version), 280);
    });
    this.input.addEventListener('keydown', (evt) => this._onKeydown(evt));
    this.input.focus();
    this._renderEmpty();
  }

  _bindDrag(handle) {
    let drag = null;
    const move = (evt) => {
      if (!drag || evt.pointerId !== drag.pointerId) return;
      const maxLeft = Math.max(8, window.innerWidth - drag.width - 8);
      const maxTop = Math.max(8, window.innerHeight - drag.height - 8);
      this.modalEl.style.left = Math.max(8, Math.min(maxLeft, drag.left + evt.clientX - drag.x)) + 'px';
      this.modalEl.style.top = Math.max(8, Math.min(maxTop, drag.top + evt.clientY - drag.y)) + 'px';
    };
    const end = (evt) => {
      if (!drag || evt.pointerId !== drag.pointerId) return;
      drag = null;
      handle.classList.remove('dragging');
      try { handle.releasePointerCapture(evt.pointerId); } catch (e) {}
    };
    handle.addEventListener('pointerdown', (evt) => {
      if (evt.button !== 0) return;
      const rect = this.modalEl.getBoundingClientRect();
      this.modalEl.style.position = 'fixed';
      this.modalEl.style.left = rect.left + 'px';
      this.modalEl.style.top = rect.top + 'px';
      this.modalEl.style.margin = '0';
      this.modalEl.style.transform = 'none';
      drag = { pointerId: evt.pointerId, x: evt.clientX, y: evt.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      handle.classList.add('dragging');
      handle.setPointerCapture(evt.pointerId);
      evt.preventDefault();
    });
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  async _search(rawQuery, version) {
    const query = rawQuery.trim().toLowerCase();
    if (version !== this._queryVersion) return;
    if (!query) { this._results = []; this._renderEmpty(); return; }
    const files = this.app.vault.getMarkdownFiles();
    const named = files.filter((file) => (file.basename + ' ' + file.path).toLowerCase().includes(query));
    const seen = new Set(named.map((file) => file.path));
    const results = named.slice(0, 20).map((file) => ({ file, match: '', score: 3 }));
    this.hint.setText(this._text('正在搜索笔记内容…', 'Searching note content…'));
    this._results = results;
    this._cursor = 0;
    this._renderResults();

    // 内容搜索在一次输入后只运行一次，结果随扫描渐进出现；避免每次键入都阻塞界面。
    for (let index = 0; index < files.length; index++) {
      if (version !== this._queryVersion) return;
      const file = files[index];
      if (!seen.has(file.path)) {
        try {
          const content = await this.app.vault.cachedRead(file);
          const pos = content.toLowerCase().indexOf(query);
          if (pos >= 0) {
            const start = Math.max(0, pos - 42);
            const end = Math.min(content.length, pos + query.length + 72);
            results.push({ file, match: content.slice(start, end).replace(/\s+/g, ' ').trim(), score: 1 });
            seen.add(file.path);
          }
        } catch (e) {}
      }
      if (index % 24 === 0) {
        this._results = results.slice(0, 40);
        this._renderResults();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }
    if (version !== this._queryVersion) return;
    this._results = results.slice(0, 40);
    this.hint.setText(this._text('↑↓ 选择 · Enter 打开 · Esc 关闭', '↑↓ select · Enter open · Esc close'));
    this._renderResults();
  }

  _renderEmpty() {
    this.resultsEl.empty();
    this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-empty', text: this._text('搜索整个 Vault', 'Search your entire vault') });
  }

  _renderResults() {
    this.resultsEl.empty();
    if (!this._results.length) {
      this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-empty', text: this._text('没有找到匹配的笔记', 'No matching notes found') });
      return;
    }
    this._results.forEach((result, index) => {
      const row = this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-result' + (index === this._cursor ? ' selected' : '') });
      const copy = row.createDiv({ cls: PLUGIN_ID + '-spotlight-copy' });
      copy.createDiv({ cls: PLUGIN_ID + '-spotlight-name', text: result.file.basename });
      copy.createDiv({ cls: PLUGIN_ID + '-spotlight-path', text: result.match || result.file.path });
      row.onclick = () => this._openResult(result);
    });
  }

  _onKeydown(evt) {
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();
      if (!this._results.length) return;
      this._cursor = (this._cursor + (evt.key === 'ArrowDown' ? 1 : -1) + this._results.length) % this._results.length;
      this._renderResults();
    } else if (evt.key === 'Enter' && this._results[this._cursor]) {
      evt.preventDefault(); this._openResult(this._results[this._cursor]);
    }
  }

  _openResult(result) {
    this.app.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: result.file.path } });
    this.close();
  }

  onClose() { clearTimeout(this._timer); this._queryVersion++; this.contentEl.empty(); }
}

function openGlobalSearch(app, language) { new CockpitGlobalSearchModal(app, language).open(); }

// 保留旧入口，工具栏按钮现在打开同一套全局搜索。
function buildSearch(root, toolbar, allFiles, app, texts) {
  const searchBtn = toolbar.querySelector('.' + PLUGIN_ID + '-toolbtn[data-action="search"]');
  if (searchBtn) searchBtn.onclick = () => openGlobalSearch(app, texts && texts.language);
  return () => openGlobalSearch(app, texts && texts.language);
}

// ===== toolbar-config.js =====
// toolbar-config.js — 可配置内置 Toolbar 按钮的编辑器

const BUILTIN_TOOLBAR_CONFIG = {
  hermes: { section:'Hermes', titleCn:'编辑 Hermes 配置', titleEn:'Edit Hermes configuration', hasUrl:false },
  'cockpit-h5': { section:'驾驶舱', titleCn:'编辑驾驶舱配置', titleEn:'Edit Cockpit configuration', hasUrl:true },
  'work-log': { section:'工作日志', titleCn:'编辑工作日志配置', titleEn:'Edit work-log configuration', hasUrl:false }
};

function isConfigurableToolbarAction(action) { return !!BUILTIN_TOOLBAR_CONFIG[action]; }

function validateBuiltinToolbarConfig(command, url, spec, lang) {
  const en = lang === 'en';
  if (!String(command || '').trim()) return en ? 'Command cannot be empty.' : '命令不能为空。';
  if (String(command).length > 8000) return en ? 'Command is too long.' : '命令不能超过 8000 个字符。';
  if (spec.hasUrl && String(url || '').trim()) {
    try {
      const parsed = new URL(String(url).trim());
      if (!['http:','https:'].includes(parsed.protocol)) throw new Error('protocol');
    } catch (e) { return en ? 'Only valid http/https URLs are supported.' : '仅支持有效的 http/https 网址。'; }
  }
  return null;
}

function openBuiltinToolbarConfigEditor(view, root, action) {
  const spec = BUILTIN_TOOLBAR_CONFIG[action];
  if (!spec) return;
  const en = view._lang() === 'en';
  const current = view._toolbarCmds[spec.section] || {};
  const fallbackLabel = view._toolbarButtons().find((button) => button.action === action)?.label || spec.section;
  const overlay = document.createElement('div');
  overlay.className = PLUGIN_ID + '-custom-toolbar-backdrop';
  const panel = overlay.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-editor' });
  overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
  panel.onclick = (evt) => evt.stopPropagation();
  const head = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-head' });
  head.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-title', text:en?spec.titleEn:spec.titleCn });
  const close = head.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-close', attr:{type:'button'} });
  obsidian.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  panel.createDiv({ cls:PLUGIN_ID + '-toolbar-config-warning', text:en?'This command runs with your local user permissions and is stored as plain text. Do not include passwords or tokens.':'该命令会以当前本机用户权限运行并以明文保存，请勿写入密码或令牌。' });
  const labelField = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-field' });
  labelField.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-label', text:en?'Button label':'按钮名称' });
  const labelInput = labelField.createEl('input', { cls:PLUGIN_ID + '-custom-toolbar-input', attr:{type:'text',maxlength:'24'} });
  labelInput.value = current.label || fallbackLabel;
  const commandField = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-field' });
  commandField.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-label', text:en?'Command':'运行命令' });
  const commandInput = commandField.createEl('textarea', { cls:PLUGIN_ID + '-custom-toolbar-textarea', attr:{rows:'7',maxlength:'8000'} });
  commandInput.value = current.command || '';
  let urlInput = null;
  if (spec.hasUrl) {
    const urlField = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-field' });
    urlField.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-label', text:en?'Target URL':'目标网址' });
    urlInput = urlField.createEl('input', { cls:PLUGIN_ID + '-custom-toolbar-input', attr:{type:'url',placeholder:'http://localhost:3456'} });
    urlInput.value = current.url || '';
  }
  const consentWrap = panel.createEl('label', { cls:PLUGIN_ID + '-custom-toolbar-consent' });
  const consent = consentWrap.createEl('input', { attr:{type:'checkbox'} });
  consentWrap.createSpan({ text:en?'I understand and trust this command.':'我理解并信任这条命令。' });
  const errorEl = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-error' });
  const footer = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-footer' });
  const cancel = footer.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-secondary', text:en?'Cancel':'取消', attr:{type:'button'} }); cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-primary', text:en?'Save configuration':'保存配置', attr:{type:'button'} });
  save.onclick = async () => {
    const command = commandInput.value.trim();
    const label = labelInput.value.trim();
    const url = urlInput ? urlInput.value.trim() : '';
    if (!label) { errorEl.textContent = en?'Button label cannot be empty.':'按钮名称不能为空。'; return; }
    const error = validateBuiltinToolbarConfig(command, url, spec, view._lang());
    if (error) { errorEl.textContent = error; return; }
    if (!consent.checked) { errorEl.textContent = en?'Confirm that you trust this command first.':'请先确认你信任这条命令。'; return; }
    const commands = { ...view._toolbarCmds, [spec.section]:{ ...current, label, command } };
    if (spec.hasUrl) commands[spec.section].url = url;
    await view._storage.saveToolbarCommands(commands);
    view._toolbarCmds = commands;
    overlay.remove();
    new obsidian.Notice(en?'Toolbar configuration saved.':'Toolbar 配置已保存。');
    await view._renderDashboard(false);
  };
  panel.addEventListener('keydown', (evt) => { if (evt.key === 'Escape') overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => commandInput.focus(), 20);
}

// ===== toolbar-custom.js =====
// toolbar-custom.js — 用户自定义 Toolbar 按钮的数据校验、编辑器与执行器

const CUSTOM_TOOLBAR_TYPES = new Set(['url', 'script']);
const CUSTOM_TOOLBAR_RUN_MODES = new Set(['background', 'terminal']);
const CUSTOM_TOOLBAR_LOG_LIMIT = 100;

function normalizeCustomToolbarButtons(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 24).map((item) => {
    const id = String(item?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
    const label = String(item?.label || '').trim().slice(0, 24);
    const type = CUSTOM_TOOLBAR_TYPES.has(item?.type) ? item.type : 'url';
    const value = String(item?.value || '').trim().slice(0, 8000);
    if (!id || seen.has(id) || !label || !value) return null;
    seen.add(id);
    const runMode = CUSTOM_TOOLBAR_RUN_MODES.has(item?.runMode) ? item.runMode : 'background';
    return { id, label, type, value, hidden: !!item?.hidden, runMode };
  }).filter(Boolean);
}

function validateCustomToolbarDraft(draft, lang) {
  const en = lang === 'en';
  const label = String(draft.label || '').trim();
  const value = String(draft.value || '').trim();
  if (!label) return en ? 'Enter a button label.' : '请输入按钮文字。';
  if (label.length > 24) return en ? 'Keep the label within 24 characters.' : '按钮文字不能超过 24 个字符。';
  if (!value) return en ? 'Enter a URL or script.' : '请输入网址或脚本。';
  if (value.length > 8000) return en ? 'Script content is too long.' : '脚本内容不能超过 8000 个字符。';
  if (draft.type === 'url') {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch (e) {
      return en ? 'Only valid http/https URLs are supported.' : '仅支持有效的 http/https 网址。';
    }
  }
  return null;
}

async function executeCustomToolbarButton(view, button) {
  if (!button) return;
  if (button.type === 'url') {
    const error = validateCustomToolbarDraft(button, view._lang());
    if (error) { new obsidian.Notice(error); return; }
    try {
      require('electron').shell.openExternal(button.value);
    } catch (e) {
      new obsidian.Notice(view._lang() === 'en' ? 'Could not open this URL.' : '无法打开该网址。');
    }
    return;
  }
  if (button.type !== 'script') return;
  const startedAt = Date.now();
  if (button.runMode === 'terminal') {
    try {
      const target = 'macos-terminal';
      await view._launchInSystemTerminal(button.value);
      await appendCustomToolbarLog(view, { label:button.label, status:'launched-in-terminal', ok:true, durationMs:Date.now()-startedAt, exitCode:'n/a', stdout:target, stderr:'' });
      new obsidian.Notice((view._lang() === 'en' ? 'Opened in terminal: ' : '已在终端运行：') + button.label);
    } catch (e) {
      await appendCustomToolbarLog(view, { label:button.label, status:'launch-failed', ok:false, durationMs:Date.now()-startedAt, exitCode:'unknown', stdout:'', stderr:e?.message || String(e) });
      new obsidian.Notice(view._lang() === 'en' ? 'Could not open a terminal.' : '无法打开终端。');
    }
    return;
  }
  try {
    const { execFile } = require('child_process');
    const cwd = view.app.vault.adapter.getBasePath();
    new obsidian.Notice((view._lang() === 'en' ? 'Running: ' : '正在运行：') + button.label);
    execFile('/bin/zsh', ['-lc', button.value], {
      cwd,
      timeout: 300000,
      maxBuffer: 1024 * 1024
    }, async (error, stdout, stderr) => {
      const ttyError = /stdin is not a terminal|not a tty|inappropriate ioctl/i.test(String(stderr || '') + ' ' + String(error?.message || ''));
      await appendCustomToolbarLog(view, {
        label: button.label,
        status: error ? 'failed' : 'success',
        ok: !error,
        durationMs: Date.now() - startedAt,
        exitCode: typeof error?.code === 'number' ? error.code : (error ? 'unknown' : 0),
        stdout,
        stderr: stderr || (error?.message || '')
      });
      if (error) {
        console.warn('[Cockpit custom toolbar]', button.label, error);
        new obsidian.Notice(ttyError
          ? (view._lang() === 'en' ? 'This command needs a terminal. Change its run mode to Terminal.' : '该命令需要交互终端，请把运行方式改为“终端运行”。')
          : ((view._lang() === 'en' ? 'Script failed: ' : '脚本执行失败：') + button.label));
        return;
      }
      new obsidian.Notice((view._lang() === 'en' ? 'Script finished: ' : '脚本执行完成：') + button.label);
    });
  } catch (e) {
    console.warn('[Cockpit custom toolbar]', button.label, e);
    new obsidian.Notice(view._lang() === 'en' ? 'Could not start this script.' : '无法启动该脚本。');
  }
}

function sanitizeToolbarLogOutput(value) {
  const text = String(value || '').trim();
  if (!text) return '(empty)';
  return text.length > 6000 ? text.slice(0, 6000) + '\n… (truncated)' : text;
}

async function appendCustomToolbarLog(view, entry) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(view.app.vault.adapter.getBasePath(), view.app.vault.configDir, 'plugins', PLUGIN_ID, 'logs');
    const file = path.join(dir, 'toolbar-runs.jsonl');
    fs.mkdirSync(dir, { recursive:true });
    let rows = [];
    try { rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch (e) {}
    rows.push(JSON.stringify({
      timestamp:new Date().toISOString(), label:String(entry.label || '').slice(0, 80),
      status:entry.status || (entry.ok ? 'success' : 'failed'), exitCode:entry.exitCode,
      durationMs:entry.durationMs, stdout:sanitizeToolbarLogOutput(entry.stdout), stderr:sanitizeToolbarLogOutput(entry.stderr)
    }));
    rows = rows.slice(-CUSTOM_TOOLBAR_LOG_LIMIT);
    while (Buffer.byteLength(rows.join('\n'), 'utf8') > 1024 * 1024 && rows.length > 1) rows.shift();
    fs.writeFileSync(file, rows.join('\n') + '\n', 'utf8');
  } catch (e) {
    console.warn('[Cockpit toolbar log]', e);
  }
}

async function openCustomToolbarLogs(view) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(view.app.vault.adapter.getBasePath(), view.app.vault.configDir, 'plugins', PLUGIN_ID, 'logs');
    const file = path.join(dir, 'toolbar-runs.jsonl');
    let entries = [];
    try { entries = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)).reverse(); } catch (e) {}
    const overlay = document.createElement('div');
    overlay.className = PLUGIN_ID + '-toolbar-log-backdrop';
    const panel = overlay.createDiv({ cls:PLUGIN_ID + '-toolbar-log-viewer' });
    overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
    const head = panel.createDiv({ cls:PLUGIN_ID + '-toolbar-log-head' });
    head.createDiv({ cls:PLUGIN_ID + '-toolbar-log-title', text:view._lang()==='en'?'Toolbar run logs':'Toolbar 运行日志' });
    const controls = head.createDiv({ cls:PLUGIN_ID + '-toolbar-log-controls' });
    const clear = controls.createEl('button', { text:view._lang()==='en'?'Clear':'清空', attr:{type:'button'} });
    const close = controls.createEl('button', { attr:{type:'button'} }); obsidian.setIcon(close, 'x'); close.onclick = () => overlay.remove();
    clear.onclick = () => {
      if (!window.confirm(view._lang()==='en'?'Clear all Toolbar logs?':'清空所有 Toolbar 运行日志？')) return;
      try { fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(file,'','utf8'); } catch (e) {}
      overlay.remove(); openCustomToolbarLogs(view);
    };
    const list = panel.createDiv({ cls:PLUGIN_ID + '-toolbar-log-list' });
    if (!entries.length) list.createDiv({ cls:PLUGIN_ID + '-toolbar-log-empty', text:view._lang()==='en'?'No run logs yet.':'暂无运行日志。' });
    entries.forEach((entry) => {
      const card = list.createDiv({ cls:PLUGIN_ID + '-toolbar-log-card ' + (entry.status === 'success' || entry.status === 'launched-in-terminal' ? 'success' : 'failed') });
      card.createDiv({ cls:PLUGIN_ID + '-toolbar-log-card-title', text:entry.label + ' · ' + entry.status });
      card.createDiv({ cls:PLUGIN_ID + '-toolbar-log-meta', text:window.moment(entry.timestamp).format('YYYY-MM-DD HH:mm:ss') + ' · exit ' + entry.exitCode + ' · ' + entry.durationMs + ' ms' });
      if (entry.stdout && entry.stdout !== '(empty)') card.createEl('pre', { text:'stdout\n' + entry.stdout });
      if (entry.stderr && entry.stderr !== '(empty)') card.createEl('pre', { text:'stderr\n' + entry.stderr });
    });
    document.body.appendChild(overlay);
  } catch (e) {
    new obsidian.Notice(view._lang() === 'en' ? 'Could not open Toolbar logs.' : '无法打开 Toolbar 运行日志。');
  }
}

function openCustomToolbarButtonEditor(view, root, existing) {
  const en = view._lang() === 'en';
  const PID = PLUGIN_ID;
  const draft = {
    label: existing?.label || '',
    type: existing?.type || 'url',
    value: existing?.value || '',
    hidden: !!existing?.hidden,
    runMode: existing?.runMode || 'background'
  };
  const overlay = document.createElement('div');
  overlay.className = PID + '-custom-toolbar-backdrop';
  const panel = overlay.createDiv({ cls: PID + '-custom-toolbar-editor' });
  overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
  panel.onclick = (evt) => evt.stopPropagation();

  const head = panel.createDiv({ cls: PID + '-custom-toolbar-head' });
  head.createDiv({ cls: PID + '-custom-toolbar-title', text: existing ? (en ? 'Edit custom button' : '编辑自定义按钮') : (en ? 'Add custom button' : '添加自定义按钮') });
  const close = head.createEl('button', { cls: PID + '-custom-toolbar-close', attr: { type:'button', title: en ? 'Close' : '关闭' } });
  obsidian.setIcon(close, 'x');
  close.onclick = () => overlay.remove();

  const field = (label) => {
    const wrap = panel.createDiv({ cls: PID + '-custom-toolbar-field' });
    wrap.createDiv({ cls: PID + '-custom-toolbar-label', text: label });
    return wrap;
  };
  const labelInput = field(en ? 'Button label' : '按钮文字').createEl('input', {
    cls: PID + '-custom-toolbar-input', attr: { type:'text', maxlength:'24', placeholder: en ? 'e.g. Project site' : '例如：项目网站' }
  });
  labelInput.value = draft.label;
  const typeSelect = field(en ? 'Action type' : '按钮类型').createEl('select', { cls: PID + '-custom-toolbar-select' });
  typeSelect.createEl('option', { text: en ? 'Open URL' : '打开网址', attr: { value:'url' } });
  typeSelect.createEl('option', { text: en ? 'Run shell script' : '运行 Shell 脚本', attr: { value:'script' } });
  typeSelect.value = draft.type;
  const valueField = field(en ? 'URL or script' : '网址或脚本');
  const valueInput = valueField.createEl('textarea', { cls: PID + '-custom-toolbar-textarea', attr: { rows:'7', maxlength:'8000' } });
  valueInput.value = draft.value;
  const hint = valueField.createDiv({ cls: PID + '-custom-toolbar-hint' });
  const modeField = field(en ? 'Run mode' : '运行方式');
  const modeSelect = modeField.createEl('select', { cls:PID + '-custom-toolbar-select' });
  modeSelect.createEl('option', { text:en?'Background (captures logs)':'后台运行（可记录输出）', attr:{value:'background'} });
  modeSelect.createEl('option', { text:en?'Terminal (interactive CLI/TUI)':'终端运行（交互式 CLI/TUI）', attr:{value:'terminal'} });
  modeSelect.value = draft.runMode;
  const consentWrap = panel.createEl('label', { cls: PID + '-custom-toolbar-consent' });
  const consent = consentWrap.createEl('input', { attr: { type:'checkbox' } });
  consentWrap.createSpan({ text: en ? 'I understand this script runs with my local user permissions.' : '我明白该脚本会以当前本机用户权限运行。' });
  const errorEl = panel.createDiv({ cls: PID + '-custom-toolbar-error' });
  const updateType = () => {
    const script = typeSelect.value === 'script';
    valueInput.placeholder = script ? (en ? 'Shell commands executed by /bin/zsh' : '由 /bin/zsh 执行的 Shell 命令') : 'https://example.com';
    hint.textContent = script
      ? (en ? 'Runs from the Vault folder. Saved as plain text; do not include passwords or tokens.' : '脚本从 Vault 目录运行并以明文保存，请勿写入密码或令牌。')
      : (en ? 'Only http/https URLs are accepted.' : '仅允许 http/https 网址。');
    consentWrap.style.display = script ? 'flex' : 'none';
    modeField.style.display = script ? 'flex' : 'none';
  };
  typeSelect.onchange = updateType;
  updateType();

  const footer = panel.createDiv({ cls: PID + '-custom-toolbar-footer' });
  if (existing) {
    const remove = footer.createEl('button', { cls:PID + '-custom-toolbar-secondary danger', text:en?'Delete button':'删除按钮', attr:{type:'button'} });
    remove.onclick = async () => {
      if (!window.confirm(en?'Delete this custom button?':'确定删除这个自定义按钮吗？')) return;
      await view._saveCustomToolbarButtons(view._customToolbarButtons.filter((button) => button.id !== existing.id));
      overlay.remove();
      await view._renderDashboard(false);
    };
  }
  const cancel = footer.createEl('button', { cls: PID + '-custom-toolbar-secondary', text: en ? 'Cancel' : '取消', attr: { type:'button' } });
  cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls: PID + '-custom-toolbar-primary', text: en ? 'Save button' : '保存按钮', attr: { type:'button' } });
  save.onclick = async () => {
    const next = { label: labelInput.value, type: typeSelect.value, value: valueInput.value, hidden: !!existing?.hidden, runMode: modeSelect.value };
    const error = validateCustomToolbarDraft(next, view._lang());
    if (error) { errorEl.textContent = error; return; }
    if (next.type === 'script' && !consent.checked) {
      errorEl.textContent = en ? 'Confirm the local-script permission warning first.' : '请先确认本机脚本权限提示。';
      return;
    }
    const id = existing?.id || ('custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
    const buttons = view._customToolbarButtons.filter((button) => button.id !== id);
    const normalized = normalizeCustomToolbarButtons([...buttons, { id, ...next }]);
    await view._saveCustomToolbarButtons(normalized);
    overlay.remove();
    await view._renderDashboard(false);
  };
  panel.addEventListener('keydown', (evt) => { if (evt.key === 'Escape') overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => labelInput.focus(), 20);
}

// ===== toolbar.js =====
// toolbar.js — Toolbar 排序、渲染与统一编辑交互

function normalizeToolbarOrder(view, rawOrder) {
  const available = [
    ...view._toolbarButtons().map((button) => button.action),
    ...view._customToolbarButtons.map((button) => 'custom:' + button.id)
  ];
  const allowed = new Set(available);
  const result = [];
  (Array.isArray(rawOrder) ? rawOrder : []).forEach((action) => {
    if (allowed.has(action) && !result.includes(action)) result.push(action);
  });
  available.forEach((action) => { if (!result.includes(action)) result.push(action); });
  return result;
}

async function saveToolbarOrder(view, order) {
  const normalized = normalizeToolbarOrder(view, order);
  view._toolbarOrder = normalized;
  const data = await view._plugin.loadData() || {};
  data.toolbarOrder = normalized;
  await view._plugin.saveData(data);
}

function clearToolbarDropHints(toolbar) {
  toolbar.querySelectorAll('.' + PLUGIN_ID + '-toolslot').forEach((slot) => slot.classList.remove('dragging','drop-before','drop-after'));
}

function attachToolbarDrag(view, toolbar, slot) {
  slot.addEventListener('dragstart', (evt) => {
    if (!view._editMode) { evt.preventDefault(); return; }
    clearToolbarDropHints(toolbar);
    slot.classList.add('dragging');
    evt.dataTransfer.effectAllowed = 'move';
    evt.dataTransfer.setData('text/plain', slot.dataset.action);
  });
  slot.addEventListener('dragover', (evt) => {
    if (!view._editMode) return;
    const source = toolbar.querySelector('.' + PLUGIN_ID + '-toolslot.dragging');
    if (!source || source === slot) return;
    evt.preventDefault();
    const before = evt.clientX < slot.getBoundingClientRect().left + slot.getBoundingClientRect().width / 2;
    slot.classList.toggle('drop-before', before);
    slot.classList.toggle('drop-after', !before);
  });
  slot.addEventListener('dragleave', () => slot.classList.remove('drop-before','drop-after'));
  slot.addEventListener('drop', async (evt) => {
    if (!view._editMode) return;
    evt.preventDefault();
    const source = toolbar.querySelector('.' + PLUGIN_ID + '-toolslot.dragging');
    if (!source || source === slot) { clearToolbarDropHints(toolbar); return; }
    const before = evt.clientX < slot.getBoundingClientRect().left + slot.getBoundingClientRect().width / 2;
    if (before) toolbar.insertBefore(source, slot); else toolbar.insertBefore(source, slot.nextSibling);
    clearToolbarDropHints(toolbar);
    await saveToolbarOrder(view, Array.from(toolbar.querySelectorAll('.' + PLUGIN_ID + '-toolslot')).map((item) => item.dataset.action));
  });
  slot.addEventListener('dragend', () => clearToolbarDropHints(toolbar));
}

function createToolbarTool(parent, icon, title, extraClass) {
  const button = parent.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-tool' + (extraClass ? ' ' + extraClass : ''), attr:{type:'button',title} });
  button.draggable = false;
  button.addEventListener('dragstart', (evt) => evt.preventDefault());
  obsidian.setIcon(button, icon);
  return button;
}

function createToolbarDeleteTool(view, root, tools, button) {
  const remove = createToolbarTool(tools, 'trash-2', view._lang()==='en'?'Delete button':'删除按钮', 'danger');
  remove.onclick = async (evt) => {
    evt.preventDefault(); evt.stopPropagation();
    const label = button.label || (view._lang()==='en'?'this button':'这个按钮');
    if (!window.confirm(view._lang()==='en' ? `Delete “${label}”?` : `确定删除“${label}”吗？`)) return;
    if (button.builtin) await view._deletePresetToolbarAction(button.action);
    else await view._saveCustomToolbarButtons(view._customToolbarButtons.filter((item) => item.id !== button.id));
    await view._renderDashboard(false);
  };
}

function buildToolbar(view, root, allFiles, t) {
  const toolbar = root.createDiv({ cls:PLUGIN_ID+'-toolbar' });
  const rawButtons = [
    ...view._toolbarButtons().map((button) => ({ ...button, builtin:true })),
    ...view._customToolbarButtons.map((button) => ({ ...button, action:'custom:' + button.id, icon:button.type === 'url' ? '🌐' : '⌘', builtin:false }))
  ];
  view._toolbarOrder = normalizeToolbarOrder(view, view._toolbarOrder);
  const orderIndex = new Map(view._toolbarOrder.map((action, index) => [action, index]));
  const buttons = rawButtons.sort((a, b) => orderIndex.get(a.action) - orderIndex.get(b.action));

  buttons.forEach((button) => {
    const slot = toolbar.createDiv({ cls:PLUGIN_ID + '-toolslot' });
    slot.dataset.action = button.action;
    slot.dataset.label = button.label;
    if (!button.builtin) { slot.dataset.customId = button.id; slot.dataset.hidden = button.hidden ? 'true' : 'false'; }
    const el = slot.createEl('button', { cls:PLUGIN_ID+'-toolbtn'+(button.primary?' primary':''), attr:{type:'button'} });
    el.dataset.action = button.action;
    el.createSpan({ cls:PLUGIN_ID+'-icon', text:button.icon });
    el.createSpan({ text:button.label });
    el.onclick = () => { if (!view._editMode) view._doAction(button.action, el); };

    const hidden = button.builtin ? view._hiddenToolbarActions.has(button.action) : !!button.hidden;
    const visibility = slot.createEl('button', {
      cls:PLUGIN_ID + '-toolbtn-visibility' + (hidden ? ' is-hidden' : ''),
      text:hidden ? view._t('layout.show') : view._t('layout.hide'),
      attr:{type:'button',title:hidden ? (view._lang()==='en'?'Show button':'显示按钮') : (view._lang()==='en'?'Hide button':'隐藏按钮')}
    });
    visibility.draggable = false;
    visibility.addEventListener('dragstart', (evt) => evt.preventDefault());
    visibility.onclick = async (evt) => {
      evt.preventDefault(); evt.stopPropagation();
      if (button.builtin) {
        const next = new Set(view._hiddenToolbarActions);
        if (next.has(button.action)) next.delete(button.action); else next.add(button.action);
        await view._saveHiddenToolbarActions(Array.from(next));
      } else {
        await view._saveCustomToolbarButtons(view._customToolbarButtons.map((item) => item.id === button.id ? { ...item, hidden:!item.hidden } : item));
        button.hidden = !button.hidden;
        slot.dataset.hidden = button.hidden ? 'true' : 'false';
      }
      view._applyToolbarButtonEditState(root);
    };

    let tools = null;
    if (button.builtin && isConfigurableToolbarAction(button.action)) {
      tools = slot.createDiv({ cls:PLUGIN_ID+'-custom-toolbar-tools' });
      const editConfig = createToolbarTool(tools, 'square-pen', view._lang()==='en'?'Edit button':'编辑按钮');
      editConfig.onclick = (evt) => { evt.preventDefault(); evt.stopPropagation(); openBuiltinToolbarConfigEditor(view, root, button.action); };
      createToolbarDeleteTool(view, root, tools, button);
    }
    if (!button.builtin) {
      tools = slot.createDiv({ cls:PLUGIN_ID+'-custom-toolbar-tools' });
      const edit = createToolbarTool(tools, 'square-pen', view._lang()==='en'?'Edit custom button':'编辑自定义按钮');
      edit.onclick = (evt) => { evt.preventDefault(); evt.stopPropagation(); openCustomToolbarButtonEditor(view, root, button); };
      createToolbarDeleteTool(view, root, tools, button);
    }
    attachToolbarDrag(view, toolbar, slot);
  });

  const add = toolbar.createEl('button', { cls:PLUGIN_ID+'-custom-toolbar-add', attr:{type:'button'} });
  obsidian.setIcon(add.createSpan(), 'plus'); add.createSpan({ text:view._lang()==='en'?'Custom button':'自定义按钮' });
  add.onclick = () => openCustomToolbarButtonEditor(view, root);
  const logs = toolbar.createEl('button', { cls:PLUGIN_ID+'-custom-toolbar-logs', attr:{type:'button'} });
  obsidian.setIcon(logs.createSpan(), 'scroll-text'); logs.createSpan({ text:view._lang()==='en'?'Run logs':'运行日志' });
  logs.onclick = () => openCustomToolbarLogs(view);

  view._applyToolbarButtonEditState(root);
  const toggleSearch = buildSearch(root, toolbar, allFiles, view.app, { placeholder:t('search.placeholder'), language:view._lang() });
  return { toolbar, toggleSearch };
}

// ===== pomodoro.js =====
// pomodoro.js — 番茄钟入口
// 真正实现位于 CockpitView._buildPomodoro，避免双份代码继续分叉。

function buildPomodoro(view, root) {
  if (view && typeof view._buildPomodoro === 'function') {
    return view._buildPomodoro(root);
  }
  console.warn('Cockpit: buildPomodoro bridge failed, _buildPomodoro is unavailable');
}

// ===== _framework.js =====
class CockpitView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this._plugin = plugin; this._storage = null; this._todos = []; this._refreshTimer = null; this._minuteRefreshTimer = null; this._bookmarks = new Set(); this._bookmarkOrder = []; this._customToolbarButtons = []; this._toolbarOrder = []; this._deletedToolbarActions = new Set(); this._recentEl = null; this._allFiles = []; this._focusMinutes = 0; this._pomodoroTimer = null; this._username = getText(DEFAULT_LANG, 'hero.defaultName'); this._language = DEFAULT_LANG; this._collapsed = {}; this._toolbarCmds = {}; this._onboardingDone = false; this._blankContextMenuItems = []; this._moduleOrder = this._defaultModuleOrder(); this._hiddenModules = new Set(); this._hiddenToolbarActions = new Set(); this._editMode = false; this._dragModuleId = null; this._todoEditorEl = null; this._pendingOnboarding = false; this._welcomeCoverEl = null; this._heroRefs = null; this._refreshTodosRef = null; this._refreshCalendarRef = null; this._refreshHeroReminder = null; this._visibilityRefreshHandler = null; this._interactionHandler = null; this._interactionSensorEl = null; this._lastInteractionAt = 0; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Cockpit'; }
  getIcon() { return 'layout-dashboard'; }
  _lang() { return normalizeLang(this._language); }
  _t(key, vars) { return getText(this._language, key, vars); }
  _defaultModuleOrder() {
    return ['hero', 'tip', 'toolbar', 'calendar', 'cats', 'stats', 'todos', 'recent', 'bookmarks', 'flash', 'heatmap', 'footer'];
  }
  _normalizeModuleOrder(order) {
    const defaults = this._defaultModuleOrder();
    const seen = new Set();
    const next = Array.isArray(order)
      ? order.filter((id) => defaults.includes(id) && !seen.has(id) && (seen.add(id), true))
      : [];
    defaults.forEach((id) => {
      if (!seen.has(id)) next.push(id);
    });
    return next;
  }
  _moduleLabel(id) {
    const labels = {
      hero: this._t('layout.modules.hero'),
      tip: this._t('layout.modules.tip'),
      toolbar: this._t('layout.modules.toolbar'),
      calendar: this._t('layout.modules.calendar'),
      cats: this._t('sections.cats'),
      stats: this._t('sections.stats'),
      todos: this._t('sections.todos'),
      recent: this._t('sections.recent'),
      bookmarks: this._t('sections.bookmarks'),
      flash: this._t('sections.flash'),
      heatmap: this._t('sections.heatmap'),
      footer: this._t('layout.modules.footer')
    };
    return labels[id] || id;
  }
  _toolbarButtons() {
    return [
      { icon: '+', label: this._t('toolbar.new'), action: 'new', primary: true },
      { icon: E.search, label: this._t('toolbar.search'), action: 'search' },
      { icon: E.tag, label: this._t('toolbar.tag'), action: 'tag' },
      { icon: E.graph, label: this._t('toolbar.graph'), action: 'graph' },
      { icon: E.bolt, label: this._t('toolbar.command'), action: 'command' },
      { icon: '🤖', label: this._toolbarCmds?.Hermes?.label || this._t('toolbar.hermes'), action: 'hermes' },
      { icon: '🛩️', label: this._toolbarCmds?.['驾驶舱']?.label || this._t('toolbar.cockpit'), action: 'cockpit-h5' },
      { icon: '📝', label: this._toolbarCmds?.['工作日志']?.label || this._t('toolbar.workLog'), action: 'work-log' },
      { icon: '🍅', label: this._t('toolbar.pomodoro'), action: 'pomodoro' }
    ].filter((button) => !this._deletedToolbarActions.has(button.action));
  }
  _toolbarActionIds() {
    return this._toolbarButtons().map((button) => button.action);
  }
  _toolbarActionLabel(action) {
    const match = this._toolbarButtons().find((button) => button.action === action);
    return match ? match.label : action;
  }
  _normalizeModuleSubset(list) {
    const defaults = new Set(this._defaultModuleOrder());
    const seen = new Set();
    return Array.isArray(list)
      ? list.filter((id) => defaults.has(id) && !seen.has(id) && (seen.add(id), true))
      : [];
  }
  _normalizeToolbarActionSubset(list) {
    const defaults = new Set(this._toolbarActionIds());
    const seen = new Set();
    return Array.isArray(list)
      ? list.filter((id) => defaults.has(id) && !seen.has(id) && (seen.add(id), true))
      : [];
  }
  _isModuleHidden(moduleId) {
    return this._hiddenModules.has(moduleId);
  }
  _isToolbarActionHidden(action) {
    return this._hiddenToolbarActions.has(action);
  }
  async _saveModuleOrder(order) {
    const next = this._normalizeModuleOrder(order);
    this._moduleOrder = next;
    try {
      const data = await this._plugin.loadData() || {};
      data.moduleOrder = next;
      await this._plugin.saveData(data);
    } catch (e) {
      console.warn('Cockpit: save module order failed', e);
    }
  }
  async _saveHiddenModules(hiddenModules) {
    const next = this._normalizeModuleSubset(hiddenModules);
    this._hiddenModules = new Set(next);
    try {
      const data = await this._plugin.loadData() || {};
      data.hiddenModules = next;
      await this._plugin.saveData(data);
    } catch (e) {
      console.warn('Cockpit: save hidden modules failed', e);
    }
  }
  async _saveHiddenToolbarActions(hiddenActions) {
    const next = this._normalizeToolbarActionSubset(hiddenActions);
    this._hiddenToolbarActions = new Set(next);
    try {
      const data = await this._plugin.loadData() || {};
      data.hiddenToolbarActions = next;
      await this._plugin.saveData(data);
    } catch (e) {
      console.warn('Cockpit: save hidden toolbar actions failed', e);
    }
  }
  async _deletePresetToolbarAction(action) {
    if (!['hermes', 'cockpit-h5', 'work-log'].includes(action)) return;
    this._deletedToolbarActions.add(action);
    this._hiddenToolbarActions.delete(action);
    const data = await this._plugin.loadData() || {};
    data.deletedToolbarActions = Array.from(this._deletedToolbarActions);
    data.hiddenToolbarActions = Array.from(this._hiddenToolbarActions);
    data.toolbarOrder = (Array.isArray(data.toolbarOrder) ? data.toolbarOrder : []).filter((item) => item !== action);
    await this._plugin.saveData(data);
  }
  _getModuleIdForElement(el) {
    if (!(el instanceof HTMLElement)) return null;
    if (el.tagName === 'STYLE') return null;
    if (el.classList.contains(PLUGIN_ID + '-hero')) return 'hero';
    if (el.classList.contains(PLUGIN_ID + '-tip')) return 'tip';
    if (
      el.classList.contains(PLUGIN_ID + '-toolbar') ||
      el.classList.contains(PLUGIN_ID + '-search-row') ||
      el.classList.contains(PLUGIN_ID + '-search-results')
    ) return 'toolbar';
    if (
      el.classList.contains(PLUGIN_ID + '-cal-wrap') ||
      el.classList.contains(PLUGIN_ID + '-cal-detail')
    ) return 'calendar';
    if (el.dataset.section === 'cats-title' || el.classList.contains(PLUGIN_ID + '-cats')) return 'cats';
    if (el.dataset.section === 'stats-title' || el.classList.contains(PLUGIN_ID + '-stats')) return 'stats';
    if (el.classList.contains(PLUGIN_ID + '-todo-header') || el.dataset.section === 'todos-body') return 'todos';
    if (el.dataset.section === 'recent-title') return 'recent';
    if (el.dataset.section === 'bookmarks-title' || el.dataset.section === 'bookmarks-list') return 'bookmarks';
    if (el.classList.contains(PLUGIN_ID + '-recent')) return 'recent';
    if (el.dataset.section === 'flash-title' || el.dataset.section === 'flash-content') return 'flash';
    if (el.dataset.section === 'heatmap-title' || el.classList.contains(PLUGIN_ID + '-heatmap')) return 'heatmap';
    if (el.classList.contains(PLUGIN_ID + '-footer')) return 'footer';
    return null;
  }
  _clearModuleDropHints(root) {
    root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
      wrapper.classList.remove('dragging', 'drop-before', 'drop-after');
    });
  }
  _closeTodoEditor() {
    if (this._todoEditorEl && this._todoEditorEl.parentNode) this._todoEditorEl.remove();
    this._todoEditorEl = null;
  }
  _closeWelcomeCover() {
    if (this._welcomeCoverEl && this._welcomeCoverEl.parentNode) this._welcomeCoverEl.remove();
    this._welcomeCoverEl = null;
  }
  _closeOnboardingCard() {
    const card = document.getElementById(PLUGIN_ID + '-tour');
    if (card) card.remove();
    document.querySelectorAll('.' + PLUGIN_ID + '-onboarding-highlight').forEach((el) => {
      el.classList.remove(PLUGIN_ID + '-onboarding-highlight');
    });
  }
  _applyToolbarButtonEditState(root) {
    const toolbar = root.querySelector('.' + PLUGIN_ID + '-toolbar');
    if (!toolbar) return;
    toolbar.classList.toggle(PLUGIN_ID + '-toolbar-editing', this._editMode);
    toolbar.querySelectorAll('.' + PLUGIN_ID + '-toolslot').forEach((slot) => {
      const action = slot.dataset.action;
      const customId = slot.dataset.customId;
      const hidden = this._isToolbarActionHidden(action);
      const customHidden = customId && slot.dataset.hidden === 'true';
      const label = customId ? (slot.dataset.label || customId) : this._toolbarActionLabel(action);
      const btn = slot.querySelector('.' + PLUGIN_ID + '-toolbtn');
      const isHidden = customId ? customHidden : hidden;
      slot.classList.toggle('is-hidden', isHidden);
      slot.style.display = !this._editMode && isHidden ? 'none' : '';
      slot.draggable = this._editMode;
      if (btn) {
        btn.disabled = this._editMode;
        btn.setAttribute('aria-label', label);
      }
      const visibility = slot.querySelector('.' + PLUGIN_ID + '-toolbtn-visibility');
      if (visibility) {
        visibility.textContent = isHidden ? this._t('layout.show') : this._t('layout.hide');
        visibility.title = isHidden
          ? (this._lang() === 'en' ? 'Show button' : '显示按钮')
          : (this._lang() === 'en' ? 'Hide button' : '隐藏按钮');
        visibility.classList.toggle('is-hidden', isHidden);
        visibility.tabIndex = this._editMode ? 0 : -1;
      }
    });
    const addCustom = toolbar.querySelector('.' + PLUGIN_ID + '-custom-toolbar-add');
    if (addCustom) addCustom.style.display = this._editMode ? 'inline-flex' : 'none';
    const logs = toolbar.querySelector('.' + PLUGIN_ID + '-custom-toolbar-logs');
    if (logs) logs.style.display = this._editMode ? 'inline-flex' : 'none';
  }

  async _saveCustomToolbarButtons(buttons) {
    this._customToolbarButtons = normalizeCustomToolbarButtons(buttons);
    const data = await this._plugin.loadData() || {};
    data.customToolbarButtons = this._customToolbarButtons;
    await this._plugin.saveData(data);
  }
  _getGreetingByHour(hour) {
    let greeting = this._t('greetings.morning');
    if (hour >= 12 && hour < 14) greeting = this._t('greetings.noon');
    else if (hour >= 14 && hour < 18) greeting = this._t('greetings.afternoon');
    else if (hour >= 18 && hour < 22) greeting = this._t('greetings.evening');
    else if (hour >= 22 || hour < 6) greeting = this._t('greetings.night');
    return greeting;
  }
  _refreshHeroSection() {
    if (!this._heroRefs) return;
    const now = window.moment();
    const dueTodos = this._todos.filter((todo) => !todo.done && todo.dueDate && (
      todo.dueDate.isBefore(now.clone().add(1, 'day'), 'day') ||
      todo.dueDate.isSame(now.clone().add(1, 'day'), 'day')
    ));
    const dueIcon = dueTodos.some((todo) => todo.priority === 'high')
      ? '🔴'
      : dueTodos.some((todo) => todo.priority === 'mid')
        ? '🟡'
        : '🟢';
    let heroSubText = this._t('hero.today', { date: formatHeroDate(now, this._lang()) });
    if (dueTodos.length > 0) {
      heroSubText += ' · ' + this._t('hero.dueTodos', { count: dueTodos.length, icon: dueIcon });
    }
    if (this._heroRefs.greetingPrefixEl) {
      this._heroRefs.greetingPrefixEl.textContent = E.wave + ' ' + this._getGreetingByHour(now.hour()) + '，';
    }
    if (this._heroRefs.summaryEl) this._heroRefs.summaryEl.textContent = heroSubText;
    if (this._heroRefs.daysEl) {
      const days = Math.max(0, now.diff(window.moment(this._startDate), 'days'));
      this._heroRefs.daysEl.textContent = this._t('hero.vaultDays', { days });
    }
  }
  _parseFocusHistory(content) {
    const history = new Map();
    const re = /date:\s*(\S+)\s*\nminutes:\s*(\d+)/g;
    let match;
    while ((match = re.exec(content || '')) !== null) {
      history.set(match[1], parseInt(match[2], 10) || 0);
    }
    return history;
  }
  _serializeFocusHistory(history) {
    const lines = ['# ' + this._t('pomodoro.focusLogTitle'), ''];
    Array.from(history.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, minutes], index) => {
        if (index > 0) lines.push('');
        lines.push('date: ' + date);
        lines.push('minutes: ' + minutes);
      });
    lines.push('');
    return lines.join('\n');
  }
  async _saveFocusHistory(date, minutes) {
    const dir = '_data';
    if (!this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
    const filePath = '_data/focus.md';
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    const history = existing
      ? this._parseFocusHistory(await this.app.vault.read(existing))
      : new Map();
    history.set(date, Math.max(0, parseInt(minutes, 10) || 0));
    const content = this._serializeFocusHistory(history);
    if (existing) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(filePath, content);
  }
  _bindSilentRefreshSensors() {
    this._unbindSilentRefreshSensors();
    const container = this.containerEl.children[1];
    if (!container) return;
    this._interactionSensorEl = container;
    this._interactionHandler = () => { this._lastInteractionAt = Date.now(); };
    ['pointerdown', 'keydown', 'input'].forEach((eventName) => {
      container.addEventListener(eventName, this._interactionHandler, true);
    });
  }
  _unbindSilentRefreshSensors() {
    if (!this._interactionSensorEl || !this._interactionHandler) return;
    ['pointerdown', 'keydown', 'input'].forEach((eventName) => {
      this._interactionSensorEl.removeEventListener(eventName, this._interactionHandler, true);
    });
    this._interactionSensorEl = null;
    this._interactionHandler = null;
  }
  _isSilentRefreshBlocked(ignoreRecentActivity) {
    if (this._todoEditorEl || this._welcomeCoverEl || this._editMode) return true;
    if (!ignoreRecentActivity && Date.now() - (this._lastInteractionAt || 0) < 30 * 1000) return true;
    const activeEl = document.activeElement;
    if (!(activeEl instanceof HTMLElement)) return false;
    if (!activeEl.closest('.' + PLUGIN_ID + '-root')) return false;
    return activeEl.matches('input, textarea, select, [contenteditable="true"]');
  }
  _startSilentRefreshLoops() {
    if (this._minuteRefreshTimer) clearInterval(this._minuteRefreshTimer);
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    if (this._visibilityRefreshHandler) {
      document.removeEventListener('visibilitychange', this._visibilityRefreshHandler);
    }
    this._refreshHeroSection();
    this._minuteRefreshTimer = window.setInterval(() => {
      try {
        this._refreshHeroSection();
      } catch (e) {
        console.warn('Cockpit hero refresh failed', e);
      }
    }, 60 * 1000);
    this._refreshTimer = window.setInterval(async () => {
      try {
        await this._runSilentRefreshCycle();
      } catch (e) {
        console.warn('Cockpit silent refresh failed', e);
      }
    }, 15 * 60 * 1000);
    this._visibilityRefreshHandler = () => {
      if (document.hidden) return;
      this._runSilentRefreshCycle({ ignoreRecentActivity: true }).catch((e) => {
        console.warn('Cockpit visibility refresh failed', e);
      });
    };
    document.addEventListener('visibilitychange', this._visibilityRefreshHandler);
  }
  async _runSilentRefreshCycle(options = {}) {
    this._refreshHeroSection();
    if (document.hidden || this._isSilentRefreshBlocked(options.ignoreRecentActivity)) return;
    const root = this.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
    if (!root) return;
    await this._reloadDashboardState();
    this._allFiles = this.app.vault.getMarkdownFiles();
    if (this._refreshCalendarRef) this._refreshCalendarRef();
    if (this._refreshTodosRef) await this._refreshTodosRef({ persist: false });
    else if (this._updateStatsRef) this._updateStatsRef();
    this._refreshHeroSection();
    this._refreshRecentSection(root, this._allFiles);
    await this._refreshBookmarkSection(root, this._allFiles);
    this._rebuildRecentStars();
  }
  _applyModuleEditState(root) {
    root.classList.toggle(PLUGIN_ID + '-layout-editing', this._editMode);
    const quickDoneBtn = root.querySelector('.' + PLUGIN_ID + '-layout-done');
    if (quickDoneBtn) {
      quickDoneBtn.style.display = this._editMode ? 'inline-flex' : 'none';
      quickDoneBtn.title = this._t('layout.done');
      quickDoneBtn.setAttribute('aria-label', this._t('layout.done'));
    }
    root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
      const moduleId = wrapper.dataset.moduleId;
      const hidden = this._isModuleHidden(moduleId);
      wrapper.classList.toggle('is-editing', this._editMode);
      wrapper.classList.toggle('is-hidden', hidden);
      wrapper.style.display = !this._editMode && hidden ? 'none' : '';
      const handle = wrapper.querySelector('.' + PLUGIN_ID + '-module-handle');
      const badge = wrapper.querySelector('.' + PLUGIN_ID + '-module-badge');
      const visibilityBtn = wrapper.querySelector('.' + PLUGIN_ID + '-module-visibility');
      const label = this._moduleLabel(moduleId);
      if (badge) badge.textContent = hidden ? label + ' · ' + this._t('layout.hiddenTag') : label;
      if (handle) {
        handle.draggable = this._editMode;
        handle.tabIndex = this._editMode ? 0 : -1;
        handle.setAttribute('aria-hidden', this._editMode ? 'false' : 'true');
      }
      if (visibilityBtn) {
        visibilityBtn.textContent = hidden ? this._t('layout.show') : this._t('layout.hide');
        visibilityBtn.title = hidden
          ? this._t('layout.showModule', { module: label })
          : this._t('layout.hideModule', { module: label });
        visibilityBtn.tabIndex = this._editMode ? 0 : -1;
        visibilityBtn.classList.toggle('is-hidden', hidden);
      }
    });
    this._applyToolbarButtonEditState(root);
  }
  _wireModuleDnD(root) {
    root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
      const moduleId = wrapper.dataset.moduleId;
      const label = this._moduleLabel(moduleId);
      let tools = wrapper.querySelector(':scope > .' + PLUGIN_ID + '-module-tools');
      let badge;
      let handle;
      let visibilityBtn;
      if (!tools) {
        tools = document.createElement('div');
        tools.className = PLUGIN_ID + '-module-tools';
        badge = document.createElement('span');
        badge.className = PLUGIN_ID + '-module-badge';
        visibilityBtn = document.createElement('button');
        visibilityBtn.type = 'button';
        visibilityBtn.className = PLUGIN_ID + '-module-visibility';
        handle = document.createElement('button');
        handle.type = 'button';
        handle.className = PLUGIN_ID + '-module-handle';
        handle.textContent = '↕';
        tools.appendChild(badge);
        tools.appendChild(visibilityBtn);
        tools.appendChild(handle);
        wrapper.prepend(tools);
      } else {
        badge = tools.querySelector('.' + PLUGIN_ID + '-module-badge');
        visibilityBtn = tools.querySelector('.' + PLUGIN_ID + '-module-visibility');
        handle = tools.querySelector('.' + PLUGIN_ID + '-module-handle');
      }
      if (badge) badge.textContent = label;
      if (visibilityBtn) {
        visibilityBtn.onclick = async (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          const nextHidden = !this._isModuleHidden(moduleId);
          const hiddenModules = new Set(this._hiddenModules);
          if (nextHidden) hiddenModules.add(moduleId);
          else hiddenModules.delete(moduleId);
          await this._saveHiddenModules(Array.from(hiddenModules));
          this._applyModuleEditState(root);
        };
      }
      if (handle) {
        handle.title = this._t('layout.dragHandle', { module: label });
        handle.draggable = this._editMode;
        handle.tabIndex = this._editMode ? 0 : -1;
        handle.ondragstart = (evt) => {
          if (!this._editMode) {
            evt.preventDefault();
            return;
          }
          this._dragModuleId = moduleId;
          wrapper.classList.add('dragging');
          evt.dataTransfer.effectAllowed = 'move';
          evt.dataTransfer.setData('text/plain', moduleId);
        };
        handle.ondragend = () => {
          this._dragModuleId = null;
          this._clearModuleDropHints(root);
        };
      }
      wrapper.ondragover = (evt) => {
        const draggedId = this._dragModuleId || evt.dataTransfer.getData('text/plain');
        if (!this._editMode || !draggedId || draggedId === moduleId) return;
        evt.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const before = evt.clientY < rect.top + rect.height / 2;
        wrapper.classList.toggle('drop-before', before);
        wrapper.classList.toggle('drop-after', !before);
      };
      wrapper.ondragleave = () => {
        wrapper.classList.remove('drop-before', 'drop-after');
      };
      wrapper.ondrop = async (evt) => {
        const draggedId = this._dragModuleId || evt.dataTransfer.getData('text/plain');
        if (!this._editMode || !draggedId || draggedId === moduleId) return;
        evt.preventDefault();
        const dragged = root.querySelector('.' + PLUGIN_ID + '-module[data-module-id="' + draggedId + '"]');
        if (!dragged) return;
        const rect = wrapper.getBoundingClientRect();
        const before = evt.clientY < rect.top + rect.height / 2;
        if (before) root.insertBefore(dragged, wrapper);
        else root.insertBefore(dragged, wrapper.nextSibling);
        this._clearModuleDropHints(root);
        await this._saveModuleOrder(Array.from(root.querySelectorAll('.' + PLUGIN_ID + '-module')).map((el) => el.dataset.moduleId));
      };
    });
    this._applyModuleEditState(root);
  }
  _applyModuleLayout(root) {
    Array.from(root.querySelectorAll(':scope > .' + PLUGIN_ID + '-module')).forEach((wrapper) => {
      while (wrapper.firstChild) {
        const child = wrapper.firstChild;
        if (child.classList && child.classList.contains(PLUGIN_ID + '-module-tools')) {
          child.remove();
          continue;
        }
        root.insertBefore(child, wrapper);
      }
      wrapper.remove();
    });
    const groups = new Map(this._defaultModuleOrder().map((id) => [id, []]));
    const unclassified = [];
    Array.from(root.children).forEach((child) => {
      if (child.tagName === 'STYLE') return;
      const moduleId = this._getModuleIdForElement(child);
      if (moduleId && groups.has(moduleId)) groups.get(moduleId).push(child);
      else unclassified.push(child);
    });
    const fragment = document.createDocumentFragment();
    this._normalizeModuleOrder(this._moduleOrder).forEach((moduleId) => {
      const nodes = groups.get(moduleId) || [];
      if (!nodes.length) return;
      const wrapper = document.createElement('section');
      wrapper.className = PLUGIN_ID + '-module';
      wrapper.dataset.moduleId = moduleId;
      wrapper.dataset.moduleLabel = this._moduleLabel(moduleId);
      nodes.forEach((node) => wrapper.appendChild(node));
      fragment.appendChild(wrapper);
    });
    unclassified.forEach((node) => fragment.appendChild(node));
    root.appendChild(fragment);
    this._wireModuleDnD(root);
  }
  async _setLanguage(language) {
    const next = normalizeLang(language);
    if (next === this._language) return;
    const prev = this._language;
    this._language = next;
    try {
      const data = await this._plugin.loadData() || {};
      data.language = next;
      await this._plugin.saveData(data);
      await this._renderDashboard(true);
    } catch (e) {
      this._language = prev;
      console.warn('Cockpit: save language failed', e);
      new obsidian.Notice('Language switch failed: ' + (e?.message || 'unknown error'));
    }
  }

  async _reloadDashboardState() {
    if (!this._storage) this._storage = new CockpitStorage(this._plugin, this.app);
    await this._storage.initialize(this._defaultToolbarCommands());
    const loaded = await loadTodos(this.app.vault);
    this._todos = loaded || DEFAULT_TODOS.map(t=>({...t}));
    this._bookmarks = new Set(await this._storage.loadBookmarks());

    // 同步 Hermes 功能待办到 Obsidian
    await syncHermesTodos(this.app.vault, this._todos);

    // 加载用户自定义名称 + 初始化首次使用日期
    try {
      const pluginData = await this._plugin.loadData() || {};
      this._language = normalizeLang(pluginData?.language || DEFAULT_LANG);
      this._username = pluginData?.username || this._t('hero.defaultName');
      this._collapsed = pluginData?.collapsed || {};
      this._moduleOrder = this._normalizeModuleOrder(pluginData?.moduleOrder);
      this._hiddenModules = new Set(this._normalizeModuleSubset(pluginData?.hiddenModules));
      this._deletedToolbarActions = new Set((Array.isArray(pluginData?.deletedToolbarActions) ? pluginData.deletedToolbarActions : []).filter((action) => ['hermes','cockpit-h5','work-log'].includes(action)));
      this._hiddenToolbarActions = new Set(this._normalizeToolbarActionSubset(pluginData?.hiddenToolbarActions));
      this._customToolbarButtons = normalizeCustomToolbarButtons(pluginData?.customToolbarButtons);
      this._toolbarOrder = normalizeToolbarOrder(this, pluginData?.toolbarOrder);
      this._bookmarkOrder = Array.isArray(pluginData?.bookmarkOrder) ? pluginData.bookmarkOrder.filter((path) => this._bookmarks.has(path)) : [];
      this._bookmarks.forEach((path) => { if (!this._bookmarkOrder.includes(path)) this._bookmarkOrder.push(path); });
      if (!pluginData.startDate) { pluginData.startDate = window.moment().format('YYYY-MM-DD'); await this._plugin.saveData(pluginData); }
      this._startDate = pluginData.startDate;
      this._onboardingDone = pluginData?.onboardingDone || false;
    } catch(e) { this._language = DEFAULT_LANG; this._username = this._t('hero.defaultName'); this._startDate = window.moment().format('YYYY-MM-DD'); this._collapsed = {}; this._moduleOrder = this._defaultModuleOrder(); this._hiddenModules = new Set(); this._deletedToolbarActions = new Set(); this._hiddenToolbarActions = new Set(); this._bookmarkOrder = Array.from(this._bookmarks); this._customToolbarButtons = []; this._toolbarOrder = normalizeToolbarOrder(this, []); }

    // 加载今日专注时长
    const today = window.moment().format('YYYY-MM-DD');
    this._focusMinutes = 0;
    try {
      const f = this.app.vault.getAbstractFileByPath('_data/focus.md');
      if (f) {
        const content = await this.app.vault.read(f);
        this._focusMinutes = this._parseFocusHistory(content).get(today) || 0;
      }
    } catch(e) {}

    this._toolbarCmds = await this._storage.loadToolbarCommands(this._defaultToolbarCommands());
  }

  _defaultToolbarCommands() {
    const homedir = require('os').homedir();
    const vaultBase = this.app.vault.adapter.getBasePath();
    const scriptPath = require('path').join(vaultBase, '.obsidian', 'plugins', 'cockpit-dashboard', 'oaAtuoLogin_obsidian.py');
    return {
      Hermes: { command:'hermes --tui', mode:'auto' },
      '驾驶舱': { command:'cd ' + homedir + '/Downloads/cockpit && ' + homedir + '/.local/bin/node server.js', url:'http://localhost:3456' },
      '工作日志': { command:'/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 ' + scriptPath, url:'' }
    };
  }

  _shouldOpenContextMenu(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('button,input,a,textarea,select,[contenteditable="true"]')) return false;
    const blockedSelectors = [
      '.' + PLUGIN_ID + '-hero',
      '.' + PLUGIN_ID + '-tip',
      '.' + PLUGIN_ID + '-toolbar',
      '.' + PLUGIN_ID + '-search-item',
      '.' + PLUGIN_ID + '-cal-header',
      '.' + PLUGIN_ID + '-cal-grid',
      '.' + PLUGIN_ID + '-cal-detail',
      '.' + PLUGIN_ID + '-cat',
      '.' + PLUGIN_ID + '-stat',
      '.' + PLUGIN_ID + '-todo-header',
      '.' + PLUGIN_ID + '-todo-tabs',
      '.' + PLUGIN_ID + '-todo',
      '.' + PLUGIN_ID + '-recent-item',
      '.' + PLUGIN_ID + '-flash-row',
      '.' + PLUGIN_ID + '-heatmap',
      '.' + PLUGIN_ID + '-footer'
    ];
    return !target.closest(blockedSelectors.join(','));
  }
  _getDashboardMenuItems() {
    return [
      ...this._blankContextMenuItems,
      {
        title: this._t('contextMenu.releaseNotes'),
        icon: 'history',
        onClick: () => {
          new CockpitReleaseNotesModal(this.app, this._plugin, this._language).open();
        }
      },
      {
        title: this._editMode ? this._t('layout.done') : this._t('layout.edit'),
        icon: 'grip-vertical',
        onClick: () => {
          this._editMode = !this._editMode;
          const root = this.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
          if (root) this._applyModuleEditState(root);
        }
      },
      {
        title: this._lang() === 'en' ? 'Data migration' : '数据迁移',
        icon: 'database',
        onClick: () => openStorageMigration(this)
      },
      {
        title: this._t('contextMenu.refreshPage'),
        icon: 'refresh-cw',
        onClick: async () => { await this._renderDashboard(true); }
      }
    ];
  }
  _openDashboardMenu(anchorEl, sourceEvent) {
    const menu = new obsidian.Menu();
    this._getDashboardMenuItems().forEach(({ title, icon, onClick }) => {
      menu.addItem((item) => {
        item.setTitle(title).setIcon(icon).onClick(onClick);
      });
    });
    if (sourceEvent) {
      menu.showAtMouseEvent(sourceEvent);
      return;
    }
    const rect = anchorEl?.getBoundingClientRect ? anchorEl.getBoundingClientRect() : { left: window.innerWidth / 2, bottom: window.innerHeight / 2, width: 0 };
    const evt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.bottom + 8)
    });
    menu.showAtMouseEvent(evt);
  }

  _attachRootContextMenu(container) {
    container.addEventListener('contextmenu', (evt) => {
      if (!this._shouldOpenContextMenu(evt.target)) return;
      evt.preventDefault();
      this._openDashboardMenu(null, evt);
    });
  }

  async _renderDashboard(reloadState) {
    if (reloadState) await this._reloadDashboardState();
    this._blankContextMenuItems = [];
    this._heroRefs = null;
    this._recentEl = null;
    this._refreshTodosRef = null;
    this._refreshCalendarRef = null;
    this._refreshHeroReminder = null;
    this._updateStatsRef = null;
    this._closeTodoEditor();
    this._closeWelcomeCover();
    this._closeOnboardingCard();
    const container = this.containerEl.children[1];
    container.empty();
    const root = container.createDiv({ cls: PLUGIN_ID+'-root' });
    root.createEl('style', { text: CSS });
    this._attachRootContextMenu(container);
    await this._buildAll(root);
    if (this._pendingOnboarding) {
      this._pendingOnboarding = false;
      setTimeout(() => {
        const liveRoot = this.containerEl.children[1]?.querySelector('.'+PLUGIN_ID+'-root');
        if (liveRoot) this._showOnboarding(liveRoot);
      }, 80);
    }
    return root;
  }

  async onOpen() {
    await this._renderDashboard(true);
    this._bindSilentRefreshSensors();
    this._startSilentRefreshLoops();
    setTimeout(() => {
      const root = this.containerEl.children[1]?.querySelector('.'+PLUGIN_ID+'-root');
      if (!root || this._onboardingDone) return;
      this._showWelcomeCover(root);
    }, 80);
  }

  async _buildAll(root) {
    const now = window.moment();
    const lang = this._lang();
    const t = (key, vars) => this._t(key, vars);
    const hr = new Date().getHours();
    const gr = this._getGreetingByHour(hr);
    const days = Math.max(0, now.diff(window.moment(this._startDate), 'days'));
    const allFiles = this.app.vault.getMarkdownFiles();

    // ===== 1. Hero — 三行结构 =====
    root.createDiv({ cls: PLUGIN_ID+'-hero' }, el => {
      const heroControls = el.createDiv({ cls: PLUGIN_ID+'-hero-controls' });
      const langSwitch = heroControls.createDiv({ cls: PLUGIN_ID+'-lang-switch', attr:{ 'aria-label': t('hero.language') } });
      const applyLang = async (btn, nextLang) => {
        if (!nextLang || nextLang === this._lang()) return;
        langSwitch.querySelectorAll('.' + PLUGIN_ID + '-lang-btn').forEach(elm => {
          elm.classList.toggle('active', elm === btn);
          elm.classList.remove('pressing');
        });
        btn.classList.add('pressing');
        setTimeout(() => btn.classList.remove('pressing'), 220);
        await this._setLanguage(nextLang);
      };
      LANG_OPTIONS.forEach((option) => {
        const btn = langSwitch.createEl('button', {
          cls: PLUGIN_ID+'-lang-btn'+(lang===option.code?' active':''),
          attr: { title: option.label, type: 'button', 'data-lang': option.code },
          text: option.short,
        });
        btn.addEventListener('pointerdown', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          btn.classList.add('pressing');
        });
        btn.addEventListener('pointerup', async (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          await applyLang(btn, option.code);
        });
        btn.addEventListener('keydown', async (evt) => {
          if (evt.key !== 'Enter' && evt.key !== ' ') return;
          evt.preventDefault();
          evt.stopPropagation();
          await applyLang(btn, option.code);
        });
        btn.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
        });
      });
      langSwitch.addEventListener('pointerleave', () => {
        langSwitch.querySelectorAll('.' + PLUGIN_ID + '-lang-btn').forEach(elm => elm.classList.remove('pressing'));
      });
      const greetLine = el.createDiv({ cls: PLUGIN_ID+'-greeting' });
      const greetingPrefixEl = greetLine.createSpan({ text: E.wave+' '+gr+'，' });
      let currNameSpan = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: this._username });
      const startEdit = (span) => {
        const inp = document.createElement('input');
        inp.className = PLUGIN_ID+'-name-input';
        inp.type = 'text';
        inp.value = this._username;
        span.replaceWith(inp);
        inp.focus();
        inp.select();
        let saved = false;
        const finish = async (cancel) => {
          if (saved) return;
          saved = true;
          if (cancel) { const ns = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: this._username }); inp.replaceWith(ns); ns.onclick = () => startEdit(ns); return; }
          const v = inp.value.trim() || t('hero.defaultName');
          this._username = v;
          try { const d = await this._plugin.loadData() || {}; d.username = v; await this._plugin.saveData(d); } catch(e) { console.warn('Cockpit: save username failed', e); }
          const ns = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: v });
          inp.replaceWith(ns);
          ns.onclick = () => startEdit(ns);
        };
        inp.addEventListener('keydown', ke => { if (ke.key === 'Enter') { ke.preventDefault(); finish(false); } if (ke.key === 'Escape') { ke.preventDefault(); finish(true); } });
        inp.addEventListener('blur', () => finish(false));
      };
      currNameSpan.onclick = () => startEdit(currNameSpan);
      greetLine.createSpan({ text: '！' });
      const todayStr = formatHeroDate(now, lang);
      const dueTodos = this._todos.filter(t => !t.done && t.dueDate && (t.dueDate.isBefore(now.clone().add(1,'day'),'day') || t.dueDate.isSame(now.clone().add(1,'day'),'day')));
      const dueIcon = dueTodos.some(t => t.priority==='high') ? '🔴' : dueTodos.some(t => t.priority==='mid') ? '🟡' : '🟢';
      let heroSubText = t('hero.today', { date: todayStr });
      if (dueTodos.length > 0) heroSubText += ' · ' + t('hero.dueTodos', { count: dueTodos.length, icon: dueIcon });
      const heroSummaryEl = el.createDiv({ cls: PLUGIN_ID+'-sub', text: heroSubText });
      const heroDaysEl = el.createDiv({ cls: PLUGIN_ID+'-sub', text: t('hero.vaultDays', { days }) });
      this._heroRefs = { greetingPrefixEl, summaryEl: heroSummaryEl, daysEl: heroDaysEl };
    });

    this._refreshHeroReminder = this._refreshHeroSection.bind(this);
    this._refreshHeroReminder();
    // 折叠/展开工具
    const makeCollapsible = (titleEl, contentEl, key, defaultCollapsed) => {
      const arrow = titleEl.createSpan({ cls: PLUGIN_ID+'-collapse-arrow', text: '▼', attr:{ style:'margin-left:6px;font-size:0.7em;opacity:0.45;transition:transform 0.2s;display:inline-block;' } });
      titleEl.style.cursor = 'pointer';
      let collapsed = this._collapsed && this._collapsed[key];
      if (collapsed === undefined) collapsed = defaultCollapsed || false;
      const apply = () => {
        contentEl.style.display = collapsed ? 'none' : '';
        arrow.textContent = collapsed ? '▶' : '▼';
      };
      apply();
      titleEl.addEventListener('click', (e) => {
        if (e.target.closest('button,input,a,textarea,select')) return;
        collapsed = !collapsed;
        apply();
        this._collapsed[key] = collapsed;
        (async () => {
          try { const d = await this._plugin.loadData() || {}; d.collapsed = { ...this._collapsed }; await this._plugin.saveData(d); } catch(ex) { console.warn('save collapsed', ex); }
        })();
      });
    };
    let refreshTodosRef = null;
    let refreshCalendarRef = null;

    const normalizeTodoTag = (value) => {
      const next = String(value || '').trim().replace(/^#+/, '').replace(/\s+/g, '');
      return next || null;
    };
    const cloneMomentOrNull = (value) => value && window.moment.isMoment(value) ? value.clone() : null;
    const getAllTodoTags = () => {
      const tagSet = new Set();
      (this._todos || []).forEach((todo) => {
        if (!todo.tags) return;
        todo.tags.forEach((tag) => {
          const normalized = normalizeTodoTag(tag);
          if (normalized) tagSet.add(normalized);
        });
      });
      return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    };
    const createTodoDraft = (todo, overrides = {}) => ({
      text: todo?.text || '',
      tags: Array.isArray(todo?.tags) ? todo.tags.slice() : [],
      dueDate: cloneMomentOrNull(todo?.dueDate),
      priority: todo?.priority || 'mid',
      ...overrides
    });
    const mergeLegacyTodoInput = (rawTitle, draft) => {
      const parsed = extractTags(rawTitle);
      const hasTagSyntax = /#([^\s#]+)/.test(rawTitle);
      const hasDueSyntax = /due:\s*\d{4}-\d{2}-\d{2}/.test(rawTitle);
      const hasPrioritySyntax = /p:\s*(high|mid|low)/.test(rawTitle);
      const cleanText = parsed.cleanText || rawTitle.trim();
      const tags = hasTagSyntax
        ? Array.from(new Set(parsed.tags.map((tag) => normalizeTodoTag(tag)).filter(Boolean)))
        : draft.tags.slice();
      const dueDate = hasDueSyntax ? parsed.dueDate : cloneMomentOrNull(draft.dueDate);
      const priority = hasPrioritySyntax ? parsed.priority : draft.priority;
      return { text: cleanText, tags, dueDate, priority };
    };
    const openTodoEditor = (options = {}) => {
      const existingTodo = typeof options.index === 'number' ? this._todos[options.index] : null;
      const isEditing = !!existingTodo;
      const PID = PLUGIN_ID;
      const duePreset = options.dueDate ? options.dueDate.clone().startOf('day') : null;
      const draft = createTodoDraft(existingTodo, duePreset ? { dueDate: duePreset } : {});
      const knownTags = getAllTodoTags();
      let saveLocked = false;

      this._closeTodoEditor();

      const overlay = document.createElement('div');
      overlay.className = PID + '-todo-editor-backdrop';
      overlay.addEventListener('click', (evt) => {
        if (evt.target === overlay) this._closeTodoEditor();
      });

      const sheet = overlay.createDiv({ cls: PID + '-todo-editor-sheet' });
      sheet.addEventListener('click', (evt) => evt.stopPropagation());
      sheet.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape') {
          evt.preventDefault();
          this._closeTodoEditor();
          return;
        }
        if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
          evt.preventDefault();
          saveBtn.click();
        }
      });

      const header = sheet.createDiv({ cls: PID + '-todo-editor-header' });
      header.createDiv({ cls: PID + '-todo-editor-title', text: isEditing ? t('todo.editorEdit') : t('todo.editorCreate') });
      const closeBtn = header.createEl('button', { cls: PID + '-todo-editor-close', text: '✕', attr: { type: 'button', title: t('todo.cancel') } });
      closeBtn.onclick = () => this._closeTodoEditor();

      const body = sheet.createDiv({ cls: PID + '-todo-editor-body' });

      const fieldTask = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldTask.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorTask') });
      const titleInput = fieldTask.createEl('textarea', { cls: PID + '-todo-editor-textarea', attr: { rows: '3', placeholder: t('todo.editorTaskPlaceholder') } });
      titleInput.value = draft.text;

      const fieldDue = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldDue.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorDue') });
      const dueQuick = fieldDue.createDiv({ cls: PID + '-todo-editor-quick' });
      const dateInput = fieldDue.createEl('input', { cls: PID + '-todo-editor-date', attr: { type: 'date' } });
      const dueButtons = [
        { key: 'none', label: t('todo.noDue'), apply: () => { draft.dueDate = null; } },
        { key: 'today', label: t('todo.dueTodayBtn'), apply: () => { draft.dueDate = window.moment().startOf('day'); } },
        { key: 'tomorrow', label: t('todo.dueTomorrowBtn'), apply: () => { draft.dueDate = window.moment().add(1, 'day').startOf('day'); } }
      ];
      const renderDueButtons = () => {
        dueQuick.querySelectorAll('.' + PID + '-todo-editor-chip').forEach((chip) => chip.remove());
        dueButtons.forEach((item) => {
          const btn = dueQuick.createEl('button', { cls: PID + '-todo-editor-chip', text: item.label, attr: { type: 'button' } });
          const due = draft.dueDate;
          const today = window.moment().startOf('day');
          const tomorrow = today.clone().add(1, 'day');
          const active = item.key === 'none'
            ? !due
            : item.key === 'today'
              ? !!(due && due.isSame(today, 'day'))
              : !!(due && due.isSame(tomorrow, 'day'));
          btn.classList.toggle('active', !!active);
          btn.onclick = () => {
            item.apply();
            renderDue();
          };
        });
      };
      const renderDue = () => {
        dateInput.value = draft.dueDate ? draft.dueDate.format('YYYY-MM-DD') : '';
        renderDueButtons();
      };
      dateInput.addEventListener('change', () => {
        draft.dueDate = dateInput.value ? parseDate(dateInput.value) : null;
        renderDueButtons();
      });

      const fieldPriority = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldPriority.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorPriority') });
      const priorityRow = fieldPriority.createDiv({ cls: PID + '-todo-editor-segment' });
      const priorityOptions = [
        { key: 'high', label: t('todo.priorityHigh') },
        { key: 'mid', label: t('todo.priorityMid') },
        { key: 'low', label: t('todo.priorityLow') }
      ];
      const renderPriority = () => {
        priorityRow.empty();
        priorityOptions.forEach((option) => {
          const btn = priorityRow.createEl('button', {
            cls: PID + '-todo-editor-segment-btn' + (draft.priority === option.key ? ' active' : ''),
            text: option.label,
            attr: { type: 'button' }
          });
          btn.onclick = () => {
            draft.priority = option.key;
            renderPriority();
          };
        });
      };

      const fieldTags = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldTags.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorTags') });
      const selectedTags = fieldTags.createDiv({ cls: PID + '-todo-editor-selected-tags' });
      const tagSuggestions = fieldTags.createDiv({ cls: PID + '-todo-editor-tags' });
      const tagInputRow = fieldTags.createDiv({ cls: PID + '-todo-editor-tag-input-row' });
      const tagInput = tagInputRow.createEl('input', {
        cls: PID + '-todo-editor-tag-input',
        attr: { type: 'text', placeholder: t('todo.editorTagPlaceholder') }
      });
      const tagAddBtn = tagInputRow.createEl('button', {
        cls: PID + '-todo-editor-secondary-btn',
        text: t('todo.editorAddTag'),
        attr: { type: 'button' }
      });
      const addTag = (value) => {
        const normalized = normalizeTodoTag(value);
        if (!normalized) return false;
        if (!draft.tags.includes(normalized)) draft.tags.push(normalized);
        tagInput.value = '';
        renderTags();
        return true;
      };
      const removeTag = (tag) => {
        draft.tags = draft.tags.filter((item) => item !== tag);
        renderTags();
      };
      const renderTags = () => {
        selectedTags.empty();
        if (!draft.tags.length) {
          selectedTags.createDiv({ cls: PID + '-todo-editor-empty', text: t('todo.editorNoTags') });
        } else {
          draft.tags.forEach((tag) => {
            const pill = selectedTags.createEl('button', {
              cls: PID + '-todo-editor-selected-tag',
              text: '#' + tag + ' ×',
              attr: { type: 'button' }
            });
            pill.onclick = () => removeTag(tag);
          });
        }
        tagSuggestions.empty();
        knownTags.forEach((tag) => {
          const btn = tagSuggestions.createEl('button', {
            cls: PID + '-todo-editor-chip' + (draft.tags.includes(tag) ? ' active' : ''),
            text: '#' + tag,
            attr: { type: 'button' }
          });
          btn.onclick = () => {
            if (draft.tags.includes(tag)) removeTag(tag);
            else addTag(tag);
          };
        });
      };
      tagAddBtn.onclick = () => addTag(tagInput.value);
      tagInput.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          addTag(tagInput.value);
        }
      });

      body.createDiv({ cls: PID + '-todo-editor-hint', text: t('todo.legacyHint') });

      const footer = sheet.createDiv({ cls: PID + '-todo-editor-footer' });
      const cancelBtn = footer.createEl('button', {
        cls: PID + '-todo-editor-secondary-btn',
        text: t('todo.cancel'),
        attr: { type: 'button' }
      });
      cancelBtn.onclick = () => this._closeTodoEditor();
      const saveBtn = footer.createEl('button', {
        cls: PID + '-todo-editor-primary-btn',
        text: isEditing ? t('todo.saveEdit') : t('todo.saveNew'),
        attr: { type: 'button' }
      });
      saveBtn.onclick = async () => {
        if (saveLocked) return;
        const rawTitle = titleInput.value.trim();
        if (!rawTitle) {
          titleInput.focus();
          return;
        }
        saveLocked = true;
        const merged = mergeLegacyTodoInput(rawTitle, draft);
        const target = existingTodo || {};
        const nextTodo = {
          text: merged.text,
          tags: merged.tags,
          dueDate: merged.dueDate,
          priority: merged.priority,
          done: existingTodo ? !!existingTodo.done : false,
          created: existingTodo?.created || window.moment(),
          doneDate: existingTodo?.doneDate || null
        };
        if (isEditing) this._todos[options.index] = { ...target, ...nextTodo };
        else this._todos.unshift(nextTodo);
        this._closeTodoEditor();
        if (refreshTodosRef) await refreshTodosRef();
        else {
          await saveTodos(this.app.vault, this._todos);
          if (refreshCalendarRef) refreshCalendarRef();
        }
      };

      renderDue();
      renderPriority();
      renderTags();

      this._todoEditorEl = overlay;
      document.body.appendChild(overlay);
      setTimeout(() => titleInput.focus(), 16);
    };

    // ===== 1.5 每日小贴士 =====
    const tip = getDailyTip(lang);
    root.createDiv({ cls: PLUGIN_ID+'-tip' }, el => {
      el.createDiv({ cls: PLUGIN_ID+'-tip-label', text: t('tip.label') });
      el.createDiv({ cls: PLUGIN_ID+'-tip-text', text: tip });
    });

    // ===== 2. Toolbar（渲染与编辑交互由独立模块负责） =====
    const { toggleSearch } = buildToolbar(this, root, allFiles, t);
    this._blankContextMenuItems = [
      { title: t('contextMenu.newNote'), icon: 'plus', onClick: () => this._doAction('new') },
      { title: t('contextMenu.searchNotes'), icon: 'search', onClick: toggleSearch },
      { title: t('contextMenu.commandPalette'), icon: 'terminal', onClick: () => this._doAction('command') },
      { title: t('contextMenu.openGraph'), icon: 'git-fork', onClick: () => this._doAction('graph') },
      { title: t('contextMenu.startPomodoro'), icon: 'timer', onClick: () => this._doAction('pomodoro') }
    ];

    // ===== 3.5 日历看板 =====
    (() => {
      let calYear  = now.year();
      let calMonth = now.month();
      let selDay   = now.date();
      let calRoot  = null;
      let gridEl   = null;
      let subtitleEl = null;
      const DOW_LABELS = getWeekdayLabels(lang, 'header');
      const getSelectedDate = () => window.moment([calYear, calMonth, selDay]);
      const updateCalendarSubtitle = () => {
        if (subtitleEl) subtitleEl.setText(formatCalendarDetailHeading(getSelectedDate(), lang));
      };

      const buildTodoMap = () => {
        const m = {};
        (this._todos || []).forEach(t => {
          if (t.dueDate) {
            const key = t.dueDate.format('YYYY-MM-DD');
            if (!m[key]) m[key] = [];
            m[key].push({ text: t.text, done: t.done, priority: t.priority, raw: t });
          }
        });
        return m;
      };

      // 日历插入锚点：搜索区域后面
      const ensureRoot = () => {
        if (!calRoot || !calRoot.parentNode) {
          calRoot = document.createElement('div');
          calRoot.className = PLUGIN_ID + '-cal-wrap';
          const ref = root.querySelector('.' + PLUGIN_ID + '-search-results');
          if (ref && ref.parentNode) ref.parentNode.insertBefore(calRoot, ref.nextSibling);
          else root.prepend(calRoot);
        }
        calRoot.innerHTML = '';
      };

      const renderDetail = (tm) => {
        const old = calRoot.parentNode.querySelector('.' + PLUGIN_ID + '-cal-detail');
        if (old) old.remove();
        const selDate  = getSelectedDate();
        const selKey   = selDate.format('YYYY-MM-DD');
        const items    = tm[selKey] || [];
        const det      = document.createElement('div');
        det.className  = PLUGIN_ID + '-cal-detail';
        calRoot.parentNode.insertBefore(det, calRoot.nextSibling);
        const detailHead = det.createDiv({ cls: PLUGIN_ID + '-cal-detail-head' });
        const detailTitleWrap = detailHead.createDiv({ cls: PLUGIN_ID + '-cal-detail-title-wrap' });
        detailTitleWrap.createDiv({ cls: PLUGIN_ID + '-cal-detail-title',
          text: formatCalendarDetailHeading(selDate, lang) });
        detailTitleWrap.createDiv({
          cls: PLUGIN_ID + '-cal-detail-count',
          text: items.length ? String(items.length) : '0'
        });
        const detailAddBtn = detailHead.createEl('button', {
          cls: PLUGIN_ID + '-cal-detail-add',
          text: '+' + ' ' + t('calendar.addTodo'),
          attr: { type: 'button' }
        });
        detailAddBtn.onclick = () => openTodoEditor({ dueDate: selDate });
        if (!items.length) {
          const empty = det.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty' });
          empty.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty-icon', text: '✦' });
          empty.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty-text', text: t('calendar.emptyDay') });
        } else {
          items.forEach(td => {
            const item = det.createDiv({ cls: PLUGIN_ID + '-cal-detail-item' });
            const chk  = item.createDiv({ cls: PLUGIN_ID + '-cal-detail-check' + (td.done ? ' done' : ''),
                                         text: td.done ? '✓' : '' });
            const span = item.createSpan({ cls: PLUGIN_ID + '-cal-detail-text' + (td.done ? ' done' : ''),
              text: (td.done ? '🟢 ' : td.priority === 'high' ? '🔴 ' : td.priority === 'mid' ? '🟡 ' : '🟢 ') + td.text });
            const editBtn = item.createEl('button', {
              cls: PLUGIN_ID + '-cal-detail-edit',
              attr: { type: 'button', title: t('todo.edit') }
            });
            obsidian.setIcon(editBtn, 'square-pen');
            const toggle = async (e) => {
              if (e) e.stopPropagation();
              td.raw.done = !td.raw.done;
              td.raw.doneDate = td.raw.done ? window.moment() : null;
              await saveTodos(this.app.vault, this._todos);
              renderAll();
              if (refreshTodosRef) refreshTodosRef();
            };
            chk.onclick  = toggle;
            span.onclick = (e) => {
              e.stopPropagation();
              openTodoEditor({ index: this._todos.indexOf(td.raw) });
            };
            editBtn.onclick = (e) => {
              e.stopPropagation();
              openTodoEditor({ index: this._todos.indexOf(td.raw) });
            };
          });
        }
      };

      const renderAll = () => {
        const todoMap = buildTodoMap();
        ensureRoot();
        const surface = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-surface' });
        const header = surface.createDiv({ cls: PLUGIN_ID + '-cal-header' });
        const titleWrap = header.createDiv({ cls: PLUGIN_ID + '-cal-title-wrap' });
        titleWrap.createDiv({ cls: PLUGIN_ID + '-cal-title', text: formatMonthTitle(calYear, calMonth, lang) });
        subtitleEl = titleWrap.createDiv({
          cls: PLUGIN_ID + '-cal-subtitle',
          text: ''
        });
        updateCalendarSubtitle();
        const nav = header.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
        const prevBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '‹' });
        const todayBtn = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '●', attr:{ title:t('calendar.backToToday') } });
        const nextBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '›' });
        const stage = surface.createDiv({ cls: PLUGIN_ID + '-cal-stage' });
        gridEl = stage.createDiv({ cls: PLUGIN_ID + '-cal-grid' });
        DOW_LABELS.forEach(d => gridEl.createDiv({ cls: PLUGIN_ID + '-cal-dow', text: d }));
        const firstDay    = window.moment([calYear, calMonth, 1]);
        const startDow    = firstDay.day();
        const offset      = startDow === 0 ? 6 : startDow - 1;
        const daysInMonth = firstDay.daysInMonth();
        const prevDays    = window.moment([calYear, calMonth, 1]).subtract(1,'month').daysInMonth();
        for (let i = offset - 1; i >= 0; i--) {
          const dimCell = gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim' });
          dimCell.createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(prevDays - i) });
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const cellDate = window.moment([calYear, calMonth, d]);
          const dateKey  = cellDate.format('YYYY-MM-DD');
          const dayTodos = todoMap[dateKey] || [];
          const isToday  = cellDate.isSame(now, 'day');
          const isSel    = d === selDay;
          const cls = PLUGIN_ID + '-cal-cell'
                    + (isToday ? ' today' : '')
                    + (dayTodos.length ? ' has-todos' : '')
                    + (isSel   ? ' selected' : '');
          const cell = gridEl.createDiv({ cls });
          const inner = cell.createDiv({ cls: PLUGIN_ID + '-cal-cell-inner' });
          inner.createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(d) });
          if (isToday) inner.createDiv({ cls: PLUGIN_ID + '-cal-today-mark' });
          if (dayTodos.length) {
            cell.createSpan({ cls: PLUGIN_ID + '-cal-badge', text: dayTodos.length > 3 ? '3+' : String(dayTodos.length) });
            const dots = cell.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
            const pc = { high:'#ef4444', mid:'#f59e0b', low:'#22c55e' };
            dayTodos.slice(0,3).forEach(t => {
              const color = t.done ? '#22c55e' : (pc[t.priority] || '#818cf8');
              dots.createDiv({ cls: PLUGIN_ID+'-cal-dot', attr:{ style:'background:'+color } });
            });
          }
          cell.onclick = () => { selDay = d; renderDayDetailOnly(todoMap); };
        }
        const total = offset + daysInMonth;
        const needTrail = (7 - (total % 7)) % 7;
        const fill = Math.max(0, 42 - total - needTrail) + needTrail;
        for (let i = 1; i <= fill; i++) {
          const dimCell = gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim' });
          dimCell.createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(i) });
        }
        const goMonth = (dir) => {
          gridEl.classList.remove('slide-in');
          gridEl.classList.add(dir > 0 ? 'slide-out-left' : 'slide-out-right');
          setTimeout(() => {
            calMonth += dir;
            if (calMonth < 0)  { calMonth = 11; calYear--; }
            if (calMonth > 11) { calMonth = 0;  calYear++; }
            selDay = Math.min(selDay, window.moment([calYear, calMonth, 1]).daysInMonth());
            renderAll();
            requestAnimationFrame(() => {
              const g = calRoot.querySelector('.' + PLUGIN_ID + '-cal-grid');
              if (g) { g.classList.remove('slide-out-left','slide-out-right'); g.classList.add('slide-in'); }
            });
          }, 200);
        };
        prevBtn.onclick  = () => goMonth(-1);
        nextBtn.onclick  = () => goMonth(1);
        todayBtn.onclick = () => { calYear = now.year(); calMonth = now.month(); selDay = now.date(); renderAll(); };
        renderDetail(todoMap);
      };

      const renderDayDetailOnly = (tm) => {
        if (gridEl) {
          const allCells = gridEl.querySelectorAll('.' + PLUGIN_ID + '-cal-cell');
          let cur = 0;
          allCells.forEach(c => {
            if (c.classList.contains('dim')) return;
            cur++;
            c.classList.toggle('selected', cur === selDay);
          });
        }
        updateCalendarSubtitle();
        renderDetail(tm);
      };

      renderAll();
      refreshCalendarRef = renderAll;
      this._refreshCalendarRef = renderAll;
    })();

    // ===== 3. Categories =====
    const catsTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.cats') });
    catsTitle.dataset.section = 'cats-title';
    const catsEl = root.createDiv({ cls: PLUGIN_ID+'-cats' });
    const allFolders = this.app.vault.getAllLoadedFiles()
      .filter(f=>f.children && f.path!=='' && f.path!=='/' && !f.path.includes('/') && !f.path.startsWith('.') && !f.path.startsWith('_') && f.path!=='Templates');
    const folderCounts = {};
    allFiles.forEach(f=>{
      const p=f.path.split('/');
      if (p.length>=2) folderCounts[p[0]]=(folderCounts[p[0]]||0)+1;
    });
    allFolders.sort((a,b)=>a.path.localeCompare(b.path));
    allFolders.forEach((folder,idx)=>{
      const count = folderCounts[folder.path]||0;
      const name = folder.path.replace(/^\d+[-_]/,'')||folder.path;
      const card = catsEl.createEl('button', { cls: PLUGIN_ID+'-cat', attr:{ type:'button', title:t('categories.openFolder', { folder:name }) } });
      card.style.setProperty('--cat-clr', COLORS[idx%COLORS.length]);
      card.createDiv({ cls: PLUGIN_ID+'-cat-icon', text: ICONS[idx%ICONS.length] });
      card.createDiv({ cls: PLUGIN_ID+'-cat-name', text: name });
      card.createDiv({ cls: PLUGIN_ID+'-cat-count', text: t('categories.noteCount', { count }) });
      card.onclick=async ()=>{
        const files = allFiles.filter(f=>f.path.startsWith(folder.path+'/')).sort((a,b)=>a.path.localeCompare(b.path));
        const overview = files.find(f=>f.basename.includes('概览')||f.basename.includes('MOC')||f.basename.includes('概述'));
        const target = overview || files[0];
        if (target) await this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:target.path}});
        else new obsidian.Notice(t('categories.emptyFolder', { folder:name }));
      };
    });

  

    makeCollapsible(catsTitle, catsEl, 'cats');

    // ===== 4. Stats（可动态更新）=====
    const statsTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.stats') });
    statsTitle.dataset.section = 'stats-title';
    const statsEl = root.createDiv({ cls: PLUGIN_ID+'-stats' });
    const noteCount = allFiles.filter(f=>f.basename!=='Home'&&f.basename!=='欢迎').length;
    const statConfig = [
      { label:t('stats.noteCount'), max:50, color:'#818cf8', type:'static', value:noteCount },
      { label:t('stats.todoCount'), max:20, color:'#c084fc', type:'dynamic', field:'todoCount' },
      { label:t('stats.doneCount'), max:1,  color:'#22c55e', type:'dynamic', field:'doneCount' },
      { label:t('stats.doneRate'),  max:100,color:'#34d399', type:'dynamic', field:'donePct', suffix:'%' },
      { label:t('stats.focusToday'),max:480,color:'#f97316', type:'dynamic', field:'focusMin', suffix:' min' }
    ];
    const statValEls = [], statFillEls = [];
    statConfig.forEach(cfg=>{
      const card = statsEl.createDiv({ cls: PLUGIN_ID+'-stat' });
      card.style.setProperty('--stat-clr', cfg.color);
      card.createDiv({ cls: PLUGIN_ID+'-stat-label', text: cfg.label });
      const valEl = card.createDiv({ cls: PLUGIN_ID+'-stat-val' });
      statValEls.push(valEl);
      if (cfg.max > 0) {
        const bar = card.createDiv({ cls: PLUGIN_ID+'-stat-bar' });
        const fill = bar.createDiv({ cls: PLUGIN_ID+'-stat-fill', attr:{style:'width:0%'} });
        statFillEls.push(fill);
      } else {
        statFillEls.push(null);
      }
    });
    const updateStats = ()=>{
      const doneCount = this._todos.filter(t=>t.done).length;
      const todoCount = this._todos.length;
      const donePct = todoCount > 0 ? Math.round(doneCount/todoCount*100) : 0;
      const focusMin = this._focusMinutes || 0;
      const values = [noteCount, todoCount, doneCount, donePct, focusMin];
      values.forEach((val,i)=>{
        statValEls[i].textContent = '' + val + (statConfig[i].suffix||'');
        if (statFillEls[i]) {
          const max = statConfig[i].max;
          const pct = Math.min(100, max > 0 ? Math.round(val/max*100) : 0);
          statFillEls[i].style.width = pct + '%';
        }
      });
    };
    this._updateStatsRef = updateStats.bind(this);
    updateStats();
    makeCollapsible(statsTitle, statsEl, 'stats');

    // ===== 5. TODOs =====
    const todoHeader = root.createDiv({ cls: PLUGIN_ID+'-todo-header' });
    const todoTitleEl = todoHeader.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.todos') });
    todoTitleEl.dataset.section = 'todos-title';
    const addBtn = todoHeader.createEl('button', { cls: PLUGIN_ID+'-todo-add', text:'+', attr:{title:t('todo.add')} });
    const refreshBtn = todoHeader.createEl('button', { cls: PLUGIN_ID+'-todo-add', text:'↻', attr:{title:t('todo.refresh')} });
    const todoWrap = root.createDiv();
    todoWrap.dataset.section = 'todos-body';
    const todosEl = todoWrap.createDiv({ cls: PLUGIN_ID+'-todos' });

    // 状态筛选：用单一下拉框收纳选项，避免待办标题栏在窄窗口中拥挤。
    let currentStatus = 'todo';
    const statusOptions = [
      { key:'next', label:lang === 'en' ? 'Next' : '优先处理' },
      { key:'all', label:t('todo.all') },
      { key:'todo', label:t('todo.todo') },
      { key:'done', label:t('todo.done') }
    ];
    const statusSelectWrap = todoHeader.createDiv({ cls: PLUGIN_ID+'-status-select-wrap' });
    obsidian.setIcon(statusSelectWrap.createSpan({ cls: PLUGIN_ID+'-status-select-icon' }), 'list-filter');
    const statusSelect = statusSelectWrap.createEl('select', {
      cls: PLUGIN_ID+'-status-select',
      attr: { title: lang === 'en' ? 'Filter tasks by status' : '按状态筛选待办', 'aria-label': lang === 'en' ? 'Task status filter' : '待办状态筛选' }
    });
    statusOptions.forEach((option) => {
      const optionEl = statusSelect.createEl('option', { text: option.label, attr: { value: option.key } });
      optionEl.selected = option.key === currentStatus;
    });
    statusSelect.onchange = async () => {
      currentStatus = statusSelect.value;
      await renderTodos();
    };

    const getStatusFilteredTodos = ()=>{
      let filtered = this._todos;
      if (currentStatus === 'next') {
        const tomorrow = window.moment().add(1, 'day');
        filtered = filtered.filter(t => !t.done && (
          t.priority === 'high' ||
          (t.dueDate && t.dueDate.isSame(tomorrow, 'day'))
        ));
      }
      if (currentStatus === 'todo') filtered = filtered.filter(t => !t.done);
      if (currentStatus === 'done') filtered = filtered.filter(t => t.done);
      return filtered;
    };

    // 动态收集当前状态下可见的标签
    let currentTag = 'all'; // 当前选中页签
    const getVisibleTags = ()=>{
      const tagSet = new Set();
      getStatusFilteredTodos().forEach(t => { if (t.tags) t.tags.forEach(tag => tagSet.add(tag)); });
      return Array.from(tagSet).sort();
    };

    // 动态生成页签栏
    const renderTabs = (allTags, wrapEl)=>{
      wrapEl.empty();
      const tabsEl = wrapEl.createDiv({ cls: PLUGIN_ID+'-todo-tabs' });
      // 构造页签：全部 + 动态标签
      const tabs = [{ key:'all', label:t('todo.all') }];
      allTags.forEach(tag => tabs.push({ key:'tag:'+tag, label:'#'+tag }));
      tabs.forEach(tab => {
        const tabBtn = tabsEl.createEl('button', {
          cls: PLUGIN_ID+'-todo-tab' + (currentTag===tab.key?' active':''),
          text: tab.label
        });
        tabBtn.onclick = async ()=>{
          currentTag = tab.key;
          await renderTodos();
        };
      });
    };

    // 渲染待办列表（从内存数据渲染）
    let renderTodos = async (options = {})=>{
      const persist = options.persist !== false;
      todosEl.empty();
      if (persist) await saveTodos(this.app.vault, this._todos);
      updateStats();

      // 如果没有页签容器，创建它（插在 todoHeader 之后）
      let tabsWrap = root.querySelector('.'+PLUGIN_ID+'-todo-tabs-wrap');
      if (!tabsWrap) {
        tabsWrap = document.createElement('div');
        tabsWrap.className = PLUGIN_ID+'-todo-tabs-wrap';
        todoWrap.prepend(tabsWrap);
      }
      const allTags = getVisibleTags();
      if (currentTag !== 'all' && !allTags.includes(currentTag.replace('tag:',''))) currentTag = 'all';
      renderTabs(allTags, tabsWrap);

      // 根据状态过滤（全部/待办/已办）
      const statusFiltered = getStatusFilteredTodos();

      // 根据当前选中页签过滤
      const tagFiltered = currentTag === 'all'
        ? statusFiltered
        : statusFiltered.filter(t => t.tags && t.tags.includes(currentTag.replace('tag:','')));

      // 排序：优先级 high>mid+low，同优先级内按创建时间倒序，已过期的置顶
      const prioOrder = { high:0, mid:1, low:2 };
      const now = window.moment();
      tagFiltered.sort((a,b)=>{
        // 已过期的未完成置顶
        const aOver = !a.done && a.dueDate && a.dueDate.isBefore(now, 'day') ? 0 : 1;
        const bOver = !b.done && b.dueDate && b.dueDate.isBefore(now, 'day') ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        // 按优先级
        const pa = prioOrder[a.priority||'mid'];
        const pb = prioOrder[b.priority||'mid'];
        if (pa !== pb) return pa - pb;
        // 按创建时间倒序
        return (b.created?.valueOf()||0) - (a.created?.valueOf()||0);
      });

      tagFiltered.forEach((todo,i)=>{
        const realIdx = this._todos.indexOf(todo);
        const done = todo.done;
        const item = todosEl.createDiv({ cls: PLUGIN_ID+'-todo'+(done?' done':'') });

        // 优先级圆点
        const pdot = item.createDiv({
          cls: PLUGIN_ID+'-todo-pdot p-'+(todo.priority||'mid'),
          attr:{title:(todo.priority||'mid')==='high'?this._t('todo.priorityHigh'):(todo.priority||'mid')==='mid'?this._t('todo.priorityMid'):this._t('todo.priorityLow')}
        });

        // 复选框 - 切换完成状态，连带更新日期
        const chk = item.createDiv({ cls: PLUGIN_ID+'-todo-chk', text:done?'✓':'' });
        chk.onclick = async (e)=>{
          e.stopPropagation();
          this._todos[realIdx].done = !this._todos[realIdx].done;
          this._todos[realIdx].doneDate = this._todos[realIdx].done ? window.moment() : null;
          await renderTodos();
        };

        // 主内容区
        const main = item.createDiv({ cls: PLUGIN_ID+'-todo-main' });
        const txt = main.createDiv({ cls: PLUGIN_ID+'-todo-text', text:todo.text });
        txt.onclick = async (e)=>{
          e.stopPropagation();
          openTodoEditor({ index: realIdx });
        };

        // 时间元信息 + 截止日期 + 标签胶囊
        const meta = main.createDiv({ cls: PLUGIN_ID+'-todo-meta' });
        if (todo.created) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.cal+' '+fmtDate(todo.created, lang)});
        if (done && todo.doneDate) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.check+' '+fmtDate(todo.doneDate, lang)});
        // 截止日期显示
        if (todo.dueDate && !done) {
          const nowM = window.moment();
          let dueCls = 'due-future', dueLabel = fmtDate(todo.dueDate, lang);
          if (todo.dueDate.isBefore(nowM, 'day')) { dueCls = 'due-overdue'; dueLabel = t('todo.overdue', { date: fmtDate(todo.dueDate, lang) }); }
          else if (todo.dueDate.isSame(nowM, 'day')) { dueCls = 'due-today'; dueLabel = t('todo.dueToday'); }
          meta.createSpan({ cls: PLUGIN_ID+'-todo-due '+dueCls, text: dueLabel });
        }
        // 标签显示
        if (todo.tags && todo.tags.length > 0) {
          todo.tags.forEach(tag => {
            const pill = meta.createSpan({ cls: PLUGIN_ID+'-todo-tag-pill', text:'#'+tag });
            pill.onclick = async (e) => {
              e.stopPropagation();
              currentTag = 'tag:'+tag;
              await renderTodos();
            };
          });
        }

        // 状态标签
        item.createDiv({ cls: PLUGIN_ID+'-todo-tag '+(done?'tag-done':'tag-todo'), text:done?t('todo.stateDone'):t('todo.stateDoing') });

        // 优先级选择器（hover 时显示）
        const prioWrap = item.createDiv({ cls: PLUGIN_ID+'-prio-picker' });
        ['high','mid','low'].forEach(p => {
          const dot = prioWrap.createDiv({ cls: PLUGIN_ID+'-prio-opt p-' + p + ((todo.priority||'mid')===p?' sel':'') });
          dot.title = p==='high'?t('todo.priorityHigh'):p==='mid'?t('todo.priorityMid'):t('todo.priorityLow');
          dot.onclick = async (e)=>{
            e.stopPropagation();
            if ((todo.priority||'mid') === p) return;
            this._todos[realIdx].priority = p;
            prioWrap.querySelectorAll('.'+PLUGIN_ID+'-prio-opt').forEach(x => x.classList.remove('sel'));
            dot.classList.add('sel');
            item.querySelector('.'+PLUGIN_ID+'-todo-pdot').className = PLUGIN_ID+'-todo-pdot p-'+p;
            await saveTodos(this.app.vault, this._todos);
            if (this._refreshHeroReminder) this._refreshHeroReminder();
          };
        });

        // 操作按钮
        const actions = item.createDiv({ cls: PLUGIN_ID+'-todo-actions' });

        // 延期、编辑与删除使用 Obsidian 同一套 Lucide 图标，避免 emoji 风格割裂。
        if (!done) {
          const deferBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', title:lang === 'en' ? 'Move to tomorrow' : '延期到明天'} });
          obsidian.setIcon(deferBtn, 'calendar-clock');
          deferBtn.onclick = async (e) => {
            e.stopPropagation();
            this._todos[realIdx].dueDate = window.moment().add(1, 'day').startOf('day');
            await renderTodos();
          };
        }
        const editBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', title:t('todo.edit')} });
        obsidian.setIcon(editBtn, 'square-pen');
        editBtn.onclick = (e)=>{
          e.stopPropagation();
          openTodoEditor({ index: realIdx });
        };

        // 删除按钮
        const delBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn del', attr:{type:'button', title:t('todo.remove')} });
        obsidian.setIcon(delBtn, 'trash-2');
        delBtn.onclick = async (e)=>{ e.stopPropagation(); this._todos.splice(realIdx,1); await renderTodos(); };
      });
    };

    // 待办变化后同步刷新日历（深度计数器避免递归重复刷新）
    let _rtDepth = 0;
    const _rtOrig = renderTodos;
    const _refreshHero = this._refreshHeroReminder;
    renderTodos = async function(options = {}) {
      _rtDepth++;
      try { await _rtOrig(options); }
      finally {
        _rtDepth--;
        if (_rtDepth === 0) {
          if (refreshCalendarRef) refreshCalendarRef();
          if (_refreshHero) _refreshHero();
        }
      }
    };

    // 日历勾选待办后同步刷新下方列表
    refreshTodosRef = renderTodos;
    this._refreshTodosRef = renderTodos;

    // 刷新按钮：从 MD 文件重新加载数据
    refreshBtn.onclick = async ()=>{
      const loaded = await loadTodos(this.app.vault);
      if (loaded) {
        this._todos = loaded;
      }
      await renderTodos();
    };

    await renderTodos();
    makeCollapsible(todoTitleEl, todoWrap, 'todos');

    // 新增待办（结构化编辑器，兼容旧格式）
    addBtn.onclick = async ()=>{
      openTodoEditor();
    };

    // ===== 6. Recent =====
    const recentTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.recent') });
    recentTitle.dataset.section = 'recent-title';
    this._recentEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
    this._allFiles = allFiles;
    this._allFiles.filter(f=>f.basename!=='Home').sort((a,b)=>b.stat.mtime-a.stat.mtime).slice(0,5).forEach(file=>{
      const item = this._recentEl.createDiv({ cls: PLUGIN_ID+'-recent-item', attr:{'data-path':file.path} });
      const isStarred = this._bookmarks.has(file.path);
      const starBtn = item.createSpan({ cls: PLUGIN_ID+'-bookmark-btn'+(isStarred?' starred':''), text: isStarred?'★':'☆', attr:{title:isStarred?t('recent.unstar'):t('recent.star')} });
      starBtn.onclick = async (e)=>{
        e.stopPropagation();
        if (this._bookmarks.has(file.path)) this._bookmarks.delete(file.path);
        else this._bookmarks.add(file.path);
        await this._storage.saveBookmarks(this._bookmarks);
        // 更新按钮状态
        const nowStarred = this._bookmarks.has(file.path);
        starBtn.textContent = nowStarred ? '★' : '☆';
        starBtn.className = PLUGIN_ID+'-bookmark-btn'+(nowStarred?' starred':'');
        starBtn.title = nowStarred ? t('recent.unstar') : t('recent.star');
        // 异步刷新收藏 section + 重建最近更新星星
        await this._refreshBookmarkSection(root, this._allFiles);
        this._rebuildRecentStars();
      };
      const link = item.createEl('a',{cls:PLUGIN_ID+'-recent-link',text:file.basename,href:'#'});
      link.onclick=e=>{e.preventDefault();this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:file.path}})};
      item.createDiv({ cls: PLUGIN_ID+'-recent-time', text: window.moment(file.stat.mtime).fromNow() });
    });
    makeCollapsible(recentTitle, this._recentEl, 'recent');

    // ===== 6.5 收藏文件 =====
    if (this._bookmarks.size > 0) {
      const bookmarkTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.bookmarks') });
      bookmarkTitle.dataset.section = 'bookmarks-title';
      const bmEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
      bmEl.dataset.section = 'bookmarks-list';
      this._orderedBookmarks().forEach(path=>{
        const f = allFiles.find(ff=>ff.path===path);
        if (!f) return;
        const item = bmEl.createDiv({ cls: PLUGIN_ID+'-recent-item' });
        const starBtn = item.createSpan({ cls: PLUGIN_ID+'-bookmark-btn starred', text: '★', attr:{title:t('recent.unstar')} });
        starBtn.onclick = async (e)=>{
          e.stopPropagation();
          this._bookmarks.delete(path);
          await this._storage.saveBookmarks(this._bookmarks);
          try {
            await this._refreshBookmarkSection(root, this._allFiles);
            this._rebuildRecentStars();
          } catch(err) { console.error('[Cockpit] rebuild failed', err); }
        };
        const link = item.createEl('a',{cls:PLUGIN_ID+'-recent-link',text:f.basename,href:'#'});
        link.onclick=e=>{e.preventDefault();this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:f.path}})};
        item.createDiv({ cls: PLUGIN_ID+'-recent-time', text: f.path });
      });
      // 统一用局部刷新渲染收藏操作按钮、固定顺序和折叠状态。
      await this._refreshBookmarkSection(root, allFiles);
    }

    // ===== 6.8 闪念胶囊 =====
    const flashTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.flash') });
    flashTitle.dataset.section = 'flash-title';
    const flashContent = root.createDiv();
    flashContent.dataset.section = 'flash-content';
    const flashWrap = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-row' });
    const flashInput = flashWrap.createEl('input', { cls: PLUGIN_ID+'-flash-input', attr:{placeholder:t('flash.placeholder'), type:'text'} });
    const flashOk = flashWrap.createEl('button', { cls: PLUGIN_ID+'-todo-input-ok', text:'✓' });
    const flashMsg = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-ok', attr:{style:'display:none'}, text:t('flash.saved') });
    const saveFlash = async ()=>{
      const v = flashInput.value.trim();
      if (!v) return;
      const today = window.moment().format('YYYY-MM-DD');
      const timeStr = window.moment().format('HH:mm');
      const filePath = `_daily/${today}.md`;
      const prefix = `# ${today} ${t('flash.fileHeading')}\n\n`;
      const line = `- [${timeStr}] ${v}\n`;
      try {
        const f = this.app.vault.getAbstractFileByPath('_daily');
        if (!f) await this.app.createFolder('_daily');
        const ex = this.app.vault.getAbstractFileByPath(filePath);
        if (ex) {
          const old = await this.app.vault.read(ex);
          await this.app.vault.modify(ex, old + line);
        } else {
          await this.app.vault.create(filePath, prefix + line);
        }
        flashInput.value = '';
        flashMsg.style.display = 'block';
        setTimeout(()=>{ flashMsg.style.display = 'none'; }, 2000);
      } catch(e) { console.warn('flash save',e); }
    };
    flashInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();saveFlash();} });
    flashOk.onclick = saveFlash;
    makeCollapsible(flashTitle, flashContent, 'flash');

    // ===== 底部：编辑热力图 =====
    const hmTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.heatmap') });
    hmTitle.dataset.section = 'heatmap-title';
    const heatmapEl = root.createDiv({ cls: PLUGIN_ID+'-heatmap' });
    const today = window.moment();
    const dayCounts = {};
    allFiles.forEach(f=>{
      const d = window.moment(f.stat.mtime);
      const diff = today.diff(d, 'days');
      if (diff >= 0 && diff < 30) {
        const key = d.format('YYYY-MM-DD');
        dayCounts[key] = (dayCounts[key]||0) + 1;
      }
    });
    const maxCount = Math.max(1, ...Object.values(dayCounts));
    // 5 级色阶：无→低→中→高→极高
    const colors = ['rgba(129,140,248,0.12)','rgba(129,140,248,0.3)','rgba(129,140,248,0.5)','rgba(99,102,241,0.7)','rgba(79,70,229,0.9)'];
    const getColor = (count) => {
      if (count === 0) return 'var(--background-modifier-border)';
      if (count >= maxCount * 0.8) return colors[4];
      if (count >= maxCount * 0.5) return colors[3];
      if (count >= maxCount * 0.25) return colors[2];
      return colors[1];
    };
    for (let i = 29; i >= 0; i--) {
      const d = today.clone().subtract(i, 'days');
      const key = d.format('YYYY-MM-DD');
      const count = dayCounts[key] || 0;
      const cell = heatmapEl.createDiv({ cls: PLUGIN_ID+'-hm-cell' });
      cell.title = key + ': ' + t('heatmap.files', { count });
      cell.style.background = getColor(count);
    }
    // 图例
    const legend = hmTitle.createDiv({ cls: PLUGIN_ID+'-hm-legend' });
    legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: t('heatmap.low') });
    colors.forEach(c => {
      const dot = legend.createDiv({ cls: PLUGIN_ID+'-hm-legend-cell' });
      dot.style.background = c;
    });
    legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: t('heatmap.high') });
    makeCollapsible(hmTitle, heatmapEl, 'heatmap');

    root.createDiv({ cls: PLUGIN_ID+'-footer', text: t('footer.text') });

    this._applyModuleLayout(root);

    const quickDoneBtn = root.createEl('button', {
      cls: PLUGIN_ID+'-layout-done',
      attr: { type: 'button', title: t('layout.done'), 'aria-label': t('layout.done') },
      text: '✓'
    });
    quickDoneBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this._editMode = false;
      this._applyModuleEditState(root);
    };
    this._applyModuleEditState(root);

    // ===== 番茄钟浮动组件 =====
    this._buildPomodoro(root);
  }

  // ========== 番茄钟 ==========
  _buildPomodoro(root) {
    const PID = PLUGIN_ID;
    let self = this;
    const t = (key, vars) => self._t(key, vars);

    // 全局单例：如果已存在则复用，不重建
    const existing = document.querySelector('.' + PID + '-pomodoro');
    if (existing) {
      if (typeof existing._cockpitBindPomodoroView === 'function') {
        existing._cockpitBindPomodoroView(this);
      }
      if (typeof existing._cockpitSyncLanguage === 'function') {
        existing._cockpitSyncLanguage();
      }
      return;
    }

    // 创建浮动容器
    const floatEl = document.createElement('div');
    floatEl.className = PID + '-pomodoro';
    floatEl.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:999;width:198px;max-width:calc(100vw - 24px);font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;border-radius:18px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:box-shadow 0.25s,border-color 0.25s,transform 0.25s,background 0.25s;';

    // 标题栏（拖拽区域）
    const header = floatEl.createDiv({ cls: PID + '-pomo-header' });
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;cursor:move;user-select:none;-webkit-user-select:none;touch-action:none;border-bottom:1px solid transparent;';
    const headerLeft = header.createDiv({ attr: { style: 'display:flex;flex-direction:column;gap:0;min-width:0;' } });
    const modeChip = headerLeft.createDiv({ attr: { style: 'display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:3px 8px;border-radius:999px;font-size:0.6em;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;' } });
    const titleSpan = headerLeft.createSpan({ text: t('pomodoro.title'), attr: { style: 'display:none;font-size:1.05em;font-weight:800;color:var(--text-normal);line-height:1.05;' } });
    const dragHint = headerLeft.createSpan({ text: t('pomodoro.dragHint'), attr: { style: 'display:none;font-size:0.62em;color:var(--text-muted);line-height:1;' } });
    const btnGroup = header.createDiv({ attr: { style: 'display:flex;gap:6px;align-items:center;flex-shrink:0;' } });
    const toggleBtn = btnGroup.createSpan({ text: '−', attr: { style: 'width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:var(--text-normal);cursor:pointer;touch-action:manipulation;font-size:1em;font-weight:700;', title: t('pomodoro.minimize') } });
    const closeBtn = btnGroup.createSpan({ text: '×', attr: { style: 'width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:var(--text-normal);cursor:pointer;touch-action:manipulation;font-size:1.05em;font-weight:700;', title: t('pomodoro.close') } });

    // 内容区
    const body = floatEl.createDiv({ cls: PID + '-pomo-body' });
    body.style.cssText = 'padding:6px 10px 10px;text-align:center;';

    const statusEl = body.createDiv({ text: t('pomodoro.ready'), attr: { style: 'display:none;align-items:center;justify-content:center;min-height:22px;padding:4px 9px;border-radius:999px;font-size:0.64em;font-weight:700;color:var(--text-muted);margin-bottom:0;' } });

    const dialWrap = body.createDiv({ attr: { style: 'display:flex;justify-content:center;margin-bottom:6px;' } });
    const dialEl = dialWrap.createDiv({ attr: { style: 'position:relative;width:112px;height:112px;border-radius:50%;padding:7px;display:flex;align-items:center;justify-content:center;' } });
    const dialInner = dialEl.createDiv({ attr: { style: 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;' } });
    const timerStack = dialInner.createDiv({ attr: { style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;' } });
    const timerEl = timerStack.createDiv({ text: '25:00', attr: { style: 'font-size:1.75em;font-weight:800;color:var(--text-normal);font-variant-numeric:tabular-nums;letter-spacing:1px;line-height:1;' } });
    const timerSub = timerStack.createDiv({ text: t('pomodoro.backToWork'), attr: { style: 'display:none;font-size:0.62em;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:var(--text-muted);opacity:0.82;' } });

    const cueEl = body.createDiv({ attr: { style: 'display:none;min-height:16px;margin:0 auto 6px;padding:0 6px;font-size:0.62em;font-weight:700;line-height:1.25;' } });

    const metricsRow = body.createDiv({ attr: { style: 'display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:8px;padding:6px 10px;border-radius:12px;font-size:0.62em;font-weight:700;color:var(--text-muted);line-height:1;white-space:nowrap;' } });
    const todayFocus = metricsRow.createSpan({ text: t('pomodoro.focusToday', { minutes: 0 }) });
    const metricsSep = metricsRow.createSpan({ text: '·', attr: { style: 'opacity:0.45;' } });
    const countEl = metricsRow.createSpan({ text: '🍅 × 0' });

    const btnRow = body.createDiv({ attr: { style: 'display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:8px;' } });
    const startBtn = btnRow.createEl('button', { text: t('pomodoro.start'), attr: { style: 'min-height:32px;padding:7px 10px;border-radius:11px;border:1px solid transparent;color:white;font-size:0.7em;font-weight:800;cursor:pointer;transition:transform 0.15s,box-shadow 0.2s,background 0.2s;' } });
    const resetBtn = btnRow.createEl('button', { text: t('pomodoro.reset'), attr: { style: 'min-height:32px;padding:7px 10px;border-radius:11px;border:1px solid var(--background-modifier-border);background:transparent;color:var(--text-normal);font-size:0.68em;font-weight:700;cursor:pointer;transition:transform 0.15s,background 0.2s,border-color 0.2s;' } });

    document.body.appendChild(floatEl);

    // 状态变量
    let totalSeconds = 25 * 60;
    let remaining = totalSeconds;
    let isRunning = false;
    let isBreak = false;
    let timerInterval = null;
    let minimized = false;
    let reminderResetTimer = null;
    let cueTimer = null;
    let statusKey = 'pomodoro.ready';
    let startLabelKey = 'pomodoro.start';
    let cueText = '';
    let cueKey = '';

    const FOCUS_ACCENT = '#ff6b57';
    const BREAK_ACCENT = '#48b4ff';

    function getPomodoroCount() {
      return Math.max(0, Math.floor((self._focusMinutes || 0) / 25));
    }

    function getThemeTokens() {
      const isLight = document.body.classList.contains('theme-light');
      if (isLight) {
        return {
          shellTop: 'rgba(255,255,255,0.94)',
          shellBottom: 'rgba(246,248,252,0.96)',
          border: 'rgba(148,163,184,0.24)',
          borderSoft: 'rgba(148,163,184,0.14)',
          headerGlow: 'rgba(255,255,255,0.36)',
          headerAccent: 'rgba(244,247,251,0.28)',
          textSoft: 'rgba(71,85,105,0.88)',
          ringTrack: 'rgba(148,163,184,0.18)',
          dialInnerTop: 'rgba(255,255,255,0.92)',
          dialInnerBottom: 'rgba(239,244,249,0.96)',
          metricBg: 'rgba(255,255,255,0.84)',
          cueBg: 'rgba(255,255,255,0.88)',
          buttonGhost: 'rgba(255,255,255,0.72)',
          buttonGhostHover: 'rgba(255,255,255,0.96)',
          shadow: '0 10px 26px rgba(15,23,42,0.12)',
          accentShadow: 'rgba(15,23,42,0.12)'
        };
      }
      return {
        shellTop: 'rgba(24,31,40,0.96)',
        shellBottom: 'rgba(18,24,33,0.98)',
        border: 'rgba(72,180,255,0.14)',
        borderSoft: 'rgba(72,180,255,0.08)',
        headerGlow: 'rgba(255,255,255,0.03)',
        headerAccent: 'rgba(72,180,255,0.035)',
        textSoft: 'rgba(203,213,225,0.78)',
        ringTrack: 'rgba(148,163,184,0.12)',
        dialInnerTop: 'rgba(29,37,49,0.96)',
        dialInnerBottom: 'rgba(24,31,42,0.98)',
        metricBg: 'rgba(20,27,36,0.78)',
        cueBg: 'rgba(20,27,36,0.74)',
        buttonGhost: 'rgba(20,27,36,0.78)',
        buttonGhostHover: 'rgba(30,41,59,0.84)',
        shadow: '0 14px 34px rgba(2,6,23,0.28)',
        accentShadow: 'rgba(2,6,23,0.18)'
      };
    }

    function currentAccent() {
      return isBreak ? BREAK_ACCENT : FOCUS_ACCENT;
    }

    function updateModeTone() {
      const accent = currentAccent();
      modeChip.textContent = t(isBreak ? 'pomodoro.modeBreak' : 'pomodoro.modeFocus');
      modeChip.style.color = accent;
      timerSub.textContent = isBreak ? t('pomodoro.resting') : t('pomodoro.backToWork');
      timerSub.style.color = isBreak ? BREAK_ACCENT : 'var(--text-muted)';
    }

    function applyVisualState(accentOverride) {
      const tokens = getThemeTokens();
      const accent = accentOverride || currentAccent();
      const progress = Math.max(0, Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100));
      floatEl.style.background = 'linear-gradient(180deg,' + tokens.shellTop + ',' + tokens.shellBottom + ')';
      floatEl.style.border = '1px solid ' + tokens.border;
      floatEl.style.boxShadow = tokens.shadow;
      header.style.background = 'linear-gradient(135deg,' + tokens.headerGlow + ',' + tokens.headerAccent + ')';
      header.style.borderBottomColor = tokens.borderSoft;
      dragHint.style.color = tokens.textSoft;
      modeChip.style.background = tokens.metricBg;
      toggleBtn.style.background = tokens.buttonGhost;
      closeBtn.style.background = tokens.buttonGhost;
      statusEl.style.background = tokens.metricBg;
      metricsRow.style.background = tokens.metricBg;
      metricsRow.style.border = '1px solid ' + tokens.borderSoft;
      resetBtn.style.background = tokens.buttonGhost;
      dialEl.style.background = 'conic-gradient(' + accent + ' ' + progress + '%, ' + tokens.ringTrack + ' ' + progress + '% 100%)';
      dialInner.style.background = 'linear-gradient(180deg,' + tokens.dialInnerTop + ',' + tokens.dialInnerBottom + ')';
      cueEl.style.background = tokens.cueBg;
      cueEl.style.border = '1px solid ' + tokens.borderSoft;
      startBtn.style.background = 'linear-gradient(135deg,' + accent + ', ' + (isBreak ? '#7dd3fc' : '#fb7185') + ')';
      startBtn.style.boxShadow = '0 8px 18px ' + tokens.accentShadow;
      resetBtn.onmouseenter = () => { resetBtn.style.background = tokens.buttonGhostHover; };
      resetBtn.onmouseleave = () => { resetBtn.style.background = tokens.buttonGhost; };
      toggleBtn.onmouseenter = () => { toggleBtn.style.transform = 'translateY(-1px)'; };
      closeBtn.onmouseenter = () => { closeBtn.style.transform = 'translateY(-1px)'; };
      toggleBtn.onmouseleave = () => { toggleBtn.style.transform = 'translateY(0)'; };
      closeBtn.onmouseleave = () => { closeBtn.style.transform = 'translateY(0)'; };
      updateModeTone();
    }

    function setCue(message, key) {
      cueText = message || '';
      cueKey = key || '';
      cueEl.textContent = cueText;
      cueEl.style.display = cueText ? 'block' : 'none';
      cueEl.style.color = cueText ? currentAccent() : 'var(--text-muted)';
    }

    function flashCue(message, accent, duration, forceNotice, key) {
      clearTimeout(cueTimer);
      setCue(message, key);
      pulseReminder(message, accent, forceNotice);
      cueTimer = setTimeout(() => {
        setCue('', '');
      }, duration || 4200);
    }

    function syncPomodoroText() {
      header.title = t('pomodoro.dragHint');
      titleSpan.textContent = t('pomodoro.title');
      dragHint.textContent = t('pomodoro.dragHint');
      toggleBtn.title = minimized ? t('pomodoro.expand') : t('pomodoro.minimize');
      closeBtn.title = t('pomodoro.close');
      statusEl.textContent = t(statusKey);
      startBtn.textContent = t(startLabelKey);
      resetBtn.textContent = t('pomodoro.reset');
      todayFocus.textContent = t('pomodoro.focusToday', { minutes: self._focusMinutes || 0 });
      if (cueKey) {
        cueText = t(cueKey);
        cueEl.textContent = cueText;
      }
      countEl.textContent = '🍅 × ' + getPomodoroCount();
      if (minimized) {
        modeChip.style.display = 'none';
        titleSpan.style.display = 'block';
        titleSpan.textContent = fmtTime(remaining);
        metricsRow.style.display = 'none';
        btnRow.style.display = 'none';
        cueEl.style.display = 'none';
      } else {
        modeChip.style.display = 'inline-flex';
        titleSpan.style.display = 'none';
        metricsRow.style.display = 'flex';
        btnRow.style.display = 'grid';
        if (!cueText) cueEl.style.display = 'none';
      }
      applyVisualState();
    }

    floatEl._cockpitBindPomodoroView = (nextView) => {
      if (nextView) self = nextView;
    };
    floatEl._cockpitSyncLanguage = syncPomodoroText;

    // 最小化
    toggleBtn.onclick = () => {
      minimized = !minimized;
      body.style.display = minimized ? 'none' : 'block';
      toggleBtn.textContent = minimized ? '+' : '−';
      floatEl.style.width = minimized ? '126px' : '198px';
      syncPomodoroText();
    };

    // 关闭
    closeBtn.onclick = () => { clearInterval(timerInterval); clearTimeout(reminderResetTimer); clearTimeout(cueTimer); finishDrag(dragPointerId); floatEl.remove(); self._pomodoroTimer = null; };

    // 拖拽
    let dragOffsetX = 0, dragOffsetY = 0;
    let dragPointerId = null;
    let dragStartX = 0, dragStartY = 0;
    let dragPending = false;
    let isDragging = false;
    const dragThreshold = 6;

    function isHeaderControl(target) {
      return target === toggleBtn || target === closeBtn || btnGroup.contains(target);
    }

    function clampPosition(left, top) {
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - floatEl.offsetWidth - margin);
      const maxTop = Math.max(margin, window.innerHeight - floatEl.offsetHeight - margin);
      return {
        left: Math.min(Math.max(margin, left), maxLeft),
        top: Math.min(Math.max(margin, top), maxTop)
      };
    }

    function finishDrag(pointerId) {
      if (pointerId != null && header.hasPointerCapture && header.hasPointerCapture(pointerId)) {
        header.releasePointerCapture(pointerId);
      }
      dragPointerId = null;
      dragPending = false;
      isDragging = false;
      floatEl.style.transition = 'box-shadow 0.25s,border-color 0.25s,transform 0.25s,background 0.25s';
    }

    header.addEventListener('pointerdown', (e) => {
      if (isHeaderControl(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = floatEl.getBoundingClientRect();
      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      dragPending = true;
      isDragging = false;
      if (header.setPointerCapture) header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dragPointerId) return;
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      if (dragPending) {
        if (Math.hypot(deltaX, deltaY) < dragThreshold) return;
        dragPending = false;
        isDragging = true;
        floatEl.style.transition = 'none';
      }
      if (!isDragging) return;
      const next = clampPosition(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
      floatEl.style.left = next.left + 'px';
      floatEl.style.top = next.top + 'px';
      floatEl.style.right = 'auto';
      floatEl.style.bottom = 'auto';
    });

    header.addEventListener('pointerup', (e) => {
      if (e.pointerId !== dragPointerId) return;
      finishDrag(e.pointerId);
    });
    header.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== dragPointerId) return;
      finishDrag(e.pointerId);
    });
    // 格式化时间
    function fmtTime(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    }

    function pulseReminder(message, accent, forceNotice) {
      const tokens = getThemeTokens();
      clearTimeout(reminderResetTimer);
      floatEl.style.borderColor = accent;
      floatEl.style.boxShadow = '0 0 0 1px ' + accent + ', 0 16px 32px ' + tokens.accentShadow;
      floatEl.style.transform = 'translateY(-3px)';
      reminderResetTimer = setTimeout(() => {
        applyVisualState();
        floatEl.style.transform = 'translateY(0)';
      }, 1800);
      if (forceNotice || minimized || document.hidden) {
        new obsidian.Notice(message, 2600);
      }
    }

    // 更新显示
    function updateDisplay() {
      timerEl.textContent = fmtTime(remaining);
      syncPomodoroText();
    }

    // 开始/暂停
    startBtn.onclick = () => {
      if (isRunning) {
        // 暂停
        clearInterval(timerInterval);
        isRunning = false;
        startLabelKey = 'pomodoro.resume';
        statusKey = isBreak ? 'pomodoro.breakPaused' : 'pomodoro.focusPaused';
        statusEl.style.color = '#f59e0b';
        syncPomodoroText();
      } else {
        // 开始
        isRunning = true;
        startLabelKey = 'pomodoro.pause';
        statusKey = isBreak ? 'pomodoro.resting' : 'pomodoro.focusing';
        statusEl.style.color = isBreak ? '#22c55e' : '#ef4444';
        syncPomodoroText();
        timerInterval = setInterval(() => {
          remaining--;
          updateDisplay();
          if (remaining <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            if (!isBreak) {
              // 专注完成
              self._focusMinutes = (self._focusMinutes || 0) + 25;
              // 持久化到文件
              (async () => {
                try {
                  const today = window.moment().format('YYYY-MM-DD');
                  await self._saveFocusHistory(today, self._focusMinutes);
                } catch(e) { console.warn('save focus', e); }
              })();
              statusKey = 'pomodoro.completedOne';
              statusEl.style.color = '#22c55e';
              startLabelKey = 'pomodoro.startBreak';
              isBreak = true;
              totalSeconds = 5 * 60;
              remaining = totalSeconds;
              flashCue(t('pomodoro.readyForBreak'), '#22c55e', 3600, false, 'pomodoro.readyForBreak');
              // 刷新统计
              if (self._updateStatsRef) self._updateStatsRef();
            } else {
              // 休息完成
              statusKey = 'pomodoro.breakEnd';
              statusEl.style.color = BREAK_ACCENT;
              startLabelKey = 'pomodoro.start';
              isBreak = false;
              totalSeconds = 25 * 60;
              remaining = totalSeconds;
              flashCue(t('pomodoro.readyForFocus'), BREAK_ACCENT, 5200, minimized || document.hidden, 'pomodoro.readyForFocus');
            }
            updateDisplay();
          }
        }, 1000);
      }
    };

    // 重置
    resetBtn.onclick = () => {
      clearInterval(timerInterval);
      isRunning = false;
      isBreak = false;
      totalSeconds = 25 * 60;
      remaining = totalSeconds;
      startLabelKey = 'pomodoro.start';
      statusKey = 'pomodoro.ready';
      statusEl.style.color = 'var(--text-muted)';
      setCue('', '');
      updateDisplay();
    };

    // 保存引用
    this._pomodoroTimer = timerInterval;
    this._updateStatsRef = null; // 将在 _buildAll 中设置

    startBtn.onmouseenter = () => { startBtn.style.transform = 'translateY(-1px)'; };
    startBtn.onmouseleave = () => { startBtn.style.transform = 'translateY(0)'; };
    resetBtn.onmouseenter = () => { resetBtn.style.transform = 'translateY(-1px)'; };
    resetBtn.onmouseleave = () => { resetBtn.style.transform = 'translateY(0)'; };

    updateDisplay();
  }
  _rebuildRecentStars() {
    const recentEl = this._recentEl;
    if (!recentEl) return;
    let count = 0;
    for (let i = 0; i < recentEl.children.length; i++) {
      const item = recentEl.children[i];
      const dp = item.getAttribute('data-path');
      if (!dp) continue;
      const isStarred = this._bookmarks.has(dp);
      // 找星星按钮
      let starBtn = item.querySelector('[class*="bookmark-btn"]');
      if (!starBtn) continue;
      starBtn.textContent = isStarred ? '★' : '☆';
      starBtn.className = PLUGIN_ID + '-bookmark-btn' + (isStarred ? ' starred' : '');
      starBtn.title = isStarred ? this._t('recent.unstar') : this._t('recent.star');
      count++;
    }
  }
  _orderedBookmarks() {
    const ordered = this._bookmarkOrder.filter((path) => this._bookmarks.has(path));
    this._bookmarks.forEach((path) => { if (!ordered.includes(path)) { ordered.push(path); this._bookmarkOrder.push(path); } });
    return ordered;
  }
  async _saveBookmarkOrder() {
    this._bookmarkOrder = this._orderedBookmarks();
    const data = await this._plugin.loadData() || {};
    data.bookmarkOrder = this._bookmarkOrder;
    await this._plugin.saveData(data);
  }
  async _openBookmarkInSplit(path) {
    const leaf = this.app.workspace.getLeaf('split', 'vertical');
    await leaf.setViewState({ type: 'markdown', state: { file: path }, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  _bindBookmarkCollapse(titleEl, contentEl) {
    if (!titleEl || !contentEl) return;
    let arrow = titleEl.querySelector('.' + PLUGIN_ID + '-collapse-arrow');
    if (!arrow) arrow = titleEl.createSpan({ cls: PLUGIN_ID + '-collapse-arrow', attr: { style:'margin-left:6px;font-size:0.7em;opacity:0.45;transition:transform 0.2s;display:inline-block;' } });
    const apply = () => {
      const collapsed = !!this._collapsed.bookmarks;
      contentEl.style.display = collapsed ? 'none' : '';
      arrow.textContent = collapsed ? '▶' : '▼';
    };
    titleEl.style.cursor = 'pointer';
    apply();
    if (titleEl.dataset.collapseBound === 'true') return;
    titleEl.dataset.collapseBound = 'true';
    titleEl.addEventListener('click', (evt) => {
      if (evt.target.closest('button,input,a,textarea,select')) return;
      this._collapsed.bookmarks = !this._collapsed.bookmarks;
      apply();
      (async () => {
        try {
          const data = await this._plugin.loadData() || {};
          data.collapsed = { ...this._collapsed };
          await this._plugin.saveData(data);
        } catch (e) { console.warn('save bookmark collapsed', e); }
      })();
    });
  }
  _refreshRecentSection(root, allFiles) {
    const recentEl = this._recentEl || root.querySelector('.' + PLUGIN_ID + '-recent');
    if (!recentEl) return;
    recentEl.innerHTML = '';
    this._recentEl = recentEl;
    this._allFiles = allFiles;
    this._allFiles
      .filter((file) => file.basename !== 'Home')
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 5)
      .forEach((file) => {
        const item = recentEl.createDiv({ cls: PLUGIN_ID + '-recent-item', attr: { 'data-path': file.path } });
        const isStarred = this._bookmarks.has(file.path);
        const starBtn = item.createSpan({
          cls: PLUGIN_ID + '-bookmark-btn' + (isStarred ? ' starred' : ''),
          text: isStarred ? '★' : '☆',
          attr: { title: isStarred ? this._t('recent.unstar') : this._t('recent.star') }
        });
        starBtn.onclick = async (e) => {
          e.stopPropagation();
          if (this._bookmarks.has(file.path)) this._bookmarks.delete(file.path);
          else this._bookmarks.add(file.path);
          await this._storage.saveBookmarks(this._bookmarks);
          const nowStarred = this._bookmarks.has(file.path);
          starBtn.textContent = nowStarred ? '★' : '☆';
          starBtn.className = PLUGIN_ID + '-bookmark-btn' + (nowStarred ? ' starred' : '');
          starBtn.title = nowStarred ? this._t('recent.unstar') : this._t('recent.star');
          await this._refreshBookmarkSection(root, this._allFiles);
          this._rebuildRecentStars();
        };
        const link = item.createEl('a', { cls: PLUGIN_ID + '-recent-link', text: file.basename, href: '#' });
        link.onclick = (e) => {
          e.preventDefault();
          this.app.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: file.path } });
        };
        item.createDiv({ cls: PLUGIN_ID + '-recent-time', text: window.moment(file.stat.mtime).fromNow() });
      });
  }

  // 异步刷新收藏 section（局部 DOM 更新，不重建整个页面）
  async _refreshBookmarkSection(root, allFiles) {
    // 找到收藏 section 的标题和容器
    let bmTitle = root.querySelector('[data-section="bookmarks-title"]');
    let bmEl = root.querySelector('[data-section="bookmarks-list"]');

    if (this._bookmarks.size === 0) {
      // 没有收藏了，移除整个 section
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      this._applyModuleLayout(root);
      return;
    }

    // 收藏列表容器不存在则创建
    if (!bmEl || !bmEl.classList.contains(PLUGIN_ID + '-recent')) {
      // 旧的残留要先清
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      bmTitle = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: this._t('sections.bookmarks') });
      bmTitle.dataset.section = 'bookmarks-title';
      bmEl = root.createDiv({ cls: PLUGIN_ID + '-recent' });
      bmEl.dataset.section = 'bookmarks-list';
      // 插到"最近更新"section 后面
      const recentTitle = root.querySelector('[data-section="recent-title"]');
      if (recentTitle && recentTitle.nextElementSibling) {
        recentTitle.nextElementSibling.after(bmEl);
        bmEl.before(bmTitle);
      }
    }

    // 重新渲染收藏列表
    bmEl.innerHTML = '';
    let hasVisible = false;
    const orderedPaths = this._orderedBookmarks();
    for (let index = 0; index < orderedPaths.length; index++) {
      const path = orderedPaths[index];
      const f = allFiles.find(ff => ff.path === path);
      if (!f) { this._bookmarks.delete(path); continue; } // 文件已删除，同步清理
      hasVisible = true;
      const item = bmEl.createDiv({ cls: PLUGIN_ID + '-recent-item' });
      const starBtn = item.createSpan({ cls: PLUGIN_ID + '-bookmark-btn starred', text: '★', attr: { title: this._t('recent.unstar') } });
      starBtn.onclick = async (e) => {
        e.stopPropagation();
        this._bookmarks.delete(path);
        await this._storage.saveBookmarks(this._bookmarks);
        await this._refreshBookmarkSection(root, allFiles);
        this._rebuildRecentStars();
      };
      const link = item.createEl('a', { cls: PLUGIN_ID + '-recent-link', text: f.basename, href: '#' });
      link.onclick = e => {
        e.preventDefault();
        this.app.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: f.path } });
      };
      const actions = item.createDiv({ cls: PLUGIN_ID + '-bookmark-actions' });
      const splitBtn = actions.createEl('button', {
        cls: PLUGIN_ID + '-bookmark-action',
        attr: { type: 'button', title: this._lang() === 'en' ? 'Open in split' : '在分栏打开' }
      });
      obsidian.setIcon(splitBtn, 'panel-right-open');
      splitBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this._openBookmarkInSplit(path);
      };
      const upBtn = actions.createEl('button', { cls: PLUGIN_ID + '-bookmark-action', attr: { type: 'button', title: this._lang() === 'en' ? 'Move up' : '上移' } });
      upBtn.disabled = index === 0;
      obsidian.setIcon(upBtn, 'chevron-up');
      upBtn.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); if (index === 0) return; [this._bookmarkOrder[index - 1], this._bookmarkOrder[index]] = [this._bookmarkOrder[index], this._bookmarkOrder[index - 1]]; await this._saveBookmarkOrder(); await this._refreshBookmarkSection(root, allFiles); };
      const downBtn = actions.createEl('button', { cls: PLUGIN_ID + '-bookmark-action', attr: { type: 'button', title: this._lang() === 'en' ? 'Move down' : '下移' } });
      downBtn.disabled = index === orderedPaths.length - 1;
      obsidian.setIcon(downBtn, 'chevron-down');
      downBtn.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); if (index >= orderedPaths.length - 1) return; [this._bookmarkOrder[index + 1], this._bookmarkOrder[index]] = [this._bookmarkOrder[index], this._bookmarkOrder[index + 1]]; await this._saveBookmarkOrder(); await this._refreshBookmarkSection(root, allFiles); };
      item.createDiv({ cls: PLUGIN_ID + '-recent-time', text: f.path });
    }
    if (!hasVisible) {
      bmTitle.remove(); bmEl.remove();
    } else {
      this._bindBookmarkCollapse(bmTitle, bmEl);
    }
    this._applyModuleLayout(root);
  }

  _getToolbarCommandConfig(...names) {
    for (const name of names) {
      if (name && this._toolbarCmds[name]) return this._toolbarCmds[name];
    }
    return null;
  }
  _launchInSystemTerminal(command) {
    return new Promise((resolve, reject) => {
      try {
        const { execFile } = require('child_process');
        execFile('osascript', [
          '-e', 'on run argv',
          '-e', 'tell application "Terminal"',
          '-e', 'activate',
          '-e', 'do script (item 1 of argv)',
          '-e', 'end tell',
          '-e', 'end run',
          String(command || '')
        ], (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  _doAction(a, sourceEl) {
    if (String(a || '').startsWith('custom:')) {
      const id = String(a).slice('custom:'.length);
      executeCustomToolbarButton(this, this._customToolbarButtons.find((button) => button.id === id));
      return;
    }
    if (a === 'hermes') {
      (async () => {
        try {
          const cfg = this._getToolbarCommandConfig('Hermes', 'hermes') || {};
          const command = cfg.command || 'hermes --tui';
          await this._launchInSystemTerminal(command);
          new obsidian.Notice(this._t('notices.hermesStartingExternal'));
        } catch(e) {
          console.warn('Hermes failed', e);
          new obsidian.Notice(this._t('notices.hermesFailed', { message: e?.message || 'unknown error' }));
        }
      })();
      return;
    }
    if (a === 'cockpit-h5') {
      try {
        const { exec } = require('child_process');
        const cfg = this._toolbarCmds['驾驶舱'];
        const cmd = cfg && cfg.command;
        if (!cmd) { new obsidian.Notice(this._t('notices.cockpitMissing')); return; }
        const url = cfg && cfg.url || 'http://localhost:3456';
        exec(cmd, (err) => {
          if (err) {
            if (!err.message.includes('EADDRINUSE')) {
              console.warn('驾驶舱 启动失败', err);
              new obsidian.Notice(this._t('notices.cockpitFailed', { message: err.message }));
              return;
            }
          }
          setTimeout(() => { exec('open ' + url); }, 800);
        });
        new obsidian.Notice(this._t('notices.cockpitStarting'));
      } catch(e) {
        console.warn('驾驶舱 launch failed', e);
      }
      return;
    }
    if (a === 'work-log') {
      try {
        const { exec } = require('child_process');
        const cfg = this._toolbarCmds['工作日志'];
        const cmd = cfg && cfg.command;
        if (!cmd) { new obsidian.Notice(this._t('notices.workLogMissing')); return; }
        exec(cmd, (err, stdout, stderr) => {
          if (err) {
            console.warn('工作日志执行失败', err);
            new obsidian.Notice(this._t('notices.workLogFailed', { message: err.message }));
            return;
          }
          if (stdout) console.log('[工作日志]', stdout);
          if (stderr) console.warn('[工作日志 stderr]', stderr);
          new obsidian.Notice(this._t('notices.workLogDone'));
        });
      } catch(e) {
        console.warn('工作日志启动失败', e);
      }
      return;
    }
    if (a === 'pomodoro') {
      try {
        const existing = document.querySelector('.'+PLUGIN_ID+'-pomodoro');
        if (!existing) this._buildPomodoro(this.containerEl);
      } catch(e) { console.warn('Pomodoro failed', e); }
      return;
    }
    if (a === 'more') {
      try {
        this._openDashboardMenu(sourceEl);
      } catch(e) { console.warn('More menu failed', e); }
      return;
    }
    switch(a) {
      case 'new': this.app.commands.executeCommandById('file-explorer:new-file'); break;
      case 'search': /* 搜索已内嵌到 Dashboard，点击 toolbar 按钮展开 */ break;
      case 'tag': this.app.workspace.rightSplit.expand(); break;
      case 'graph': this.app.commands.executeCommandById('graph:open'); break;
      case 'command': this.app.commands.executeCommandById('command-palette:open'); break;
    }
  }
  async onClose() {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
    if (this._minuteRefreshTimer) { clearInterval(this._minuteRefreshTimer); this._minuteRefreshTimer = null; }
    if (this._visibilityRefreshHandler) {
      document.removeEventListener('visibilitychange', this._visibilityRefreshHandler);
      this._visibilityRefreshHandler = null;
    }
    this._unbindSilentRefreshSensors();
    this._closeTodoEditor();
    this._closeWelcomeCover();
    this._closeOnboardingCard();
    // 番茄钟是全局单例，不随驾驶舱关闭而销毁
    // 只清理引用，不移除 DOM
    this._pomodoroTimer = null;
    this._heroRefs = null;
    this._refreshTodosRef = null;
    this._refreshCalendarRef = null;
    this._refreshHeroReminder = null;
  }
        // ========== 首次使用引导 — 区域引导卡片 ==========
  _markOnboardingDone() {
    this._onboardingDone = true;
    (async () => {
      try {
        const d = await this._plugin.loadData() || {};
        d.onboardingDone = true;
        await this._plugin.saveData(d);
      } catch(e) { console.warn('save onboard', e); }
    })();
  }
  _showWelcomeCover(root) {
    if (this._onboardingDone) return;
    this._closeWelcomeCover();
    const PID = PLUGIN_ID;
    const t = (key, vars) => this._t(key, vars);
    let selectedLang = this._language;

    const overlay = document.createElement('div');
    overlay.className = PID + '-welcome-backdrop';
    const card = overlay.createDiv({ cls: PID + '-welcome-card' });
    card.createDiv({ cls: PID + '-welcome-badge', text: t('welcome.badge') });
    card.createDiv({ cls: PID + '-welcome-title', text: t('welcome.title') });
    const intro = card.createDiv({ cls: PID + '-welcome-intro' });
    intro.createDiv({ cls: PID + '-welcome-copy primary', text: t('welcome.introCn') });
    intro.createDiv({ cls: PID + '-welcome-copy', text: t('welcome.introEn') });

    const langBlock = card.createDiv({ cls: PID + '-welcome-lang-block' });
    langBlock.createDiv({ cls: PID + '-welcome-label', text: t('welcome.chooseLanguage') });
    const langRow = langBlock.createDiv({ cls: PID + '-welcome-lang-row' });
    const renderLangs = () => {
      langRow.empty();
      LANG_OPTIONS.forEach((option) => {
        const btn = langRow.createEl('button', {
          cls: PID + '-welcome-lang-btn' + (selectedLang === option.code ? ' active' : ''),
          text: option.label,
          attr: { type: 'button' }
        });
        btn.onclick = () => {
          selectedLang = option.code;
          renderLangs();
        };
      });
    };
    renderLangs();

    const actions = card.createDiv({ cls: PID + '-welcome-actions' });
    const skipBtn = actions.createEl('button', {
      cls: PID + '-welcome-skip',
      text: t('welcome.skip'),
      attr: { type: 'button' }
    });
    skipBtn.onclick = async () => {
      this._closeWelcomeCover();
      if (selectedLang !== this._language) {
        await this._setLanguage(selectedLang);
      }
      this._markOnboardingDone();
    };
    const startBtn = actions.createEl('button', {
      cls: PID + '-welcome-start',
      text: t('welcome.continue'),
      attr: { type: 'button' }
    });
    startBtn.onclick = async () => {
      this._closeWelcomeCover();
      if (selectedLang !== this._language) {
        this._pendingOnboarding = true;
        await this._setLanguage(selectedLang);
        return;
      }
      this._showOnboarding(root);
    };

    this._welcomeCoverEl = overlay;
    document.body.appendChild(overlay);
  }
  _showOnboarding(root) {
    if (this._onboardingDone) return;
    this._closeWelcomeCover();
    const PID = PLUGIN_ID;
    const t = (key, vars) => this._t(key, vars);

    const steps = [
      { sel: '.'+PID+'-name', text: t('onboarding.stepName'), pos: 'below' },
      { sel: '.'+PID+'-toolbar', text: t('onboarding.stepToolbar'), pos: 'below' },
      { sel: '.'+PID+'-cal-wrap', text: t('onboarding.stepCalendar'), pos: 'above' },
      { sel: '.'+PID+'-todo-header', text: t('onboarding.stepTodo'), pos: 'above' },
      { sel: '.'+PID+'-toolbar', text: t('onboarding.stepContextMenu'), pos: 'below' },
      { sel: '.'+PID+'-stats', text: t('onboarding.stepStats'), pos: 'above' },
    ];
    const pomoEl = document.querySelector('.'+PID+'-pomodoro');
    if (pomoEl) steps.push({ el: pomoEl, text: t('onboarding.stepPomodoro'), pos: 'pomo' });

    let cur = 0, hlEl = null, card = null;

    const highlight = (s) => {
      if (hlEl) { hlEl.classList.remove(PID+'-onboarding-highlight'); hlEl = null; }
      const a = s.el || root.querySelector(s.sel);
      if (a) { hlEl = a; a.classList.add(PID+'-onboarding-highlight'); if (s.pos !== 'pomo') a.scrollIntoView({behavior:'smooth',block:'center'}); }
    };

    const positionCard = (s) => {
      if (!card) return;
      const a = s.el || root.querySelector(s.sel);
      if (!a || s.pos === 'pomo') {
        // fallback: bottom-right
        card.style.bottom = '80px';
        card.style.right = '220px';
        card.style.top = 'auto';
        card.style.left = 'auto';
        return;
      }
      const rect = a.getBoundingClientRect();
      const pad = 12;
      let top, left;
      if (s.pos === 'below') {
        top = rect.bottom + pad;
        left = Math.max(12, Math.min(rect.left, window.innerWidth - 360));
      } else {
        top = rect.top - pad - (card.firstChild ? card.offsetHeight || 120 : 120);
        left = Math.max(12, Math.min(rect.left, window.innerWidth - 360));
      }
      // clamp
      top = Math.max(8, Math.min(top, window.innerHeight - 160));
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      card.style.bottom = 'auto';
      card.style.right = 'auto';
    };

    const buildCard = (i) => {
      if (i >= steps.length) { finish(); return; }
      const s = steps[i];
      if (!card) {
        card = document.createElement('div');
        card.id = PID+'-tour';
        card.className = PID + '-onboarding-card';
        document.body.appendChild(card);
      }
      card.innerHTML = '';
      card.style.opacity = '1';
      // header
      const top = document.createElement('div');
      top.className = PID + '-onboarding-card-head';
      const num = document.createElement('span');
      num.textContent = (i+1)+'/'+steps.length;
      num.className = PID + '-onboarding-card-step';
      top.appendChild(num);
      const cl = document.createElement('button');
      cl.textContent = t('onboarding.close');
      cl.className = PID + '-onboarding-card-close';
      cl.onclick = finish;
      top.appendChild(cl);
      card.appendChild(top);
      // body
      const body = document.createElement('div');
      body.textContent = s.text;
      body.className = PID + '-onboarding-card-body';
      card.appendChild(body);
      // buttons
      const btnRow = document.createElement('div');
      btnRow.className = PID + '-onboarding-card-actions';
      if (i > 0) {
        const pb = document.createElement('button');
        pb.textContent = t('onboarding.prev');
        pb.className = PID + '-onboarding-card-btn secondary';
        pb.onclick = () => { cur = i-1; buildCard(cur); };
        btnRow.appendChild(pb);
      }
      const nb = document.createElement('button');
      nb.textContent = i < steps.length-1 ? t('onboarding.next') : t('onboarding.done');
      nb.className = PID + '-onboarding-card-btn primary';
      nb.onclick = () => { cur = i+1; buildCard(cur); };
      btnRow.appendChild(nb);
      card.appendChild(btnRow);
      highlight(s);
      requestAnimationFrame(() => { positionCard(s); });
      cur = i;
    };

    const finish = () => {
      if (hlEl) hlEl.classList.remove(PID+'-onboarding-highlight');
      const c = document.getElementById(PID+'-tour');
      if (c) { c.style.opacity = '0'; setTimeout(() => c.remove(), 300); }
      this._markOnboardingDone();
    };

    buildCard(0);
  }
}

class CockpitReleaseNotesModal extends obsidian.Modal {
  constructor(app, plugin, language) {
    super(app);
    this._plugin = plugin;
    this._language = language;
  }

  _t(key, vars) {
    return getText(this._language, key, vars);
  }

  _pickLocalizedReleaseField(field, fallback) {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    const lang = normalizeLang(this._language);
    return field[lang] || field.en || field['zh-CN'] || fallback;
  }

  onOpen() {
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(PLUGIN_ID + '-release-modal');
    titleEl.setText(this._t('releases.title'));
    contentEl.empty();

    const top = contentEl.createDiv({ cls: PLUGIN_ID + '-release-top' });
    top.createDiv({ cls: PLUGIN_ID + '-release-current', text: this._t('releases.current') + ' · v' + (this._plugin.manifest?.version || 'unknown') });

    if (!RELEASE_HISTORY.length) {
      contentEl.createDiv({ cls: PLUGIN_ID + '-release-empty', text: this._t('releases.empty') });
      return;
    }

    RELEASE_HISTORY.forEach((release) => {
      const card = contentEl.createDiv({ cls: PLUGIN_ID + '-release-card' });
      const head = card.createDiv({ cls: PLUGIN_ID + '-release-head' });
      head.createDiv({ cls: PLUGIN_ID + '-release-version', text: 'v' + release.version });
      head.createDiv({ cls: PLUGIN_ID + '-release-date', text: release.date });
      card.createDiv({
        cls: PLUGIN_ID + '-release-title',
        text: this._pickLocalizedReleaseField(release.title, release.version)
      });
      const list = card.createEl('ul', { cls: PLUGIN_ID + '-release-list' });
      const highlights = this._pickLocalizedReleaseField(release.highlights, []);
      (Array.isArray(highlights) ? highlights : []).forEach((item) => {
        list.createEl('li', { text: item });
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class CockpitPlugin extends obsidian.Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, l=>new CockpitView(l, this));
    this.addRibbonIcon('layout-dashboard','Cockpit',()=>this._open());
    this.addCommand({id:'open-cockpit',name:'打开 Cockpit 驾驶舱',callback:()=>this._open()});
    this.addCommand({ id:'global-search', name:'打开 Cockpit 全局搜索', callback:() => openGlobalSearch(this.app) });
    this.addCommand({ id:'open-data-migration', name:'打开 Cockpit 数据迁移', callback:async () => { await this._open(); const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view; if (view) openStorageMigration(view); } });
    this.app.workspace.onLayoutReady(()=>this._open());
  }
  async _open() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('split','vertical'); await leaf.setViewState({type:VIEW_TYPE,active:true}); }
    this.app.workspace.revealLeaf(leaf);
    return leaf;
  }
  async onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); }
}
module.exports = CockpitPlugin;
