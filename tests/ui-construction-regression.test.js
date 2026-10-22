#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflows = fs.readFileSync(path.join(__dirname, '../src/workflows.js'), 'utf8');
const weeklyReport = fs.readFileSync(path.join(__dirname, '../src/weekly-report.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
const motion = fs.readFileSync(path.join(__dirname, '../src/motion.js'), 'utf8');
const modalMotion = fs.readFileSync(path.join(__dirname, '../src/modal-motion.js'), 'utf8');
const framework = fs.readFileSync(path.join(__dirname, '../src/_framework.js'), 'utf8');
const serverchan = fs.readFileSync(path.join(__dirname, '../src/serverchan.js'), 'utf8');

assert.doesNotMatch(workflows, /\.create(?:Label|Small)\s*\(/, 'UI construction must use supported createEl/createDiv/createSpan helpers.');
assert.match(workflows, /panel\.classList\.add\(PLUGIN_ID\+'-workflow-editor'\)/, 'Workflow editor must opt into the bounded scrolling layout.');
assert.match(workflows, /const revision = \+\+renderRevision;[\s\S]*if \(revision !== renderRevision\) return;[\s\S]*body\.empty\(\)/, 'Workflow module must discard stale async renders before mutating the DOM.');
assert.match(workflows, /openScheduledTaskEditor\(view, draft, \{ asNew:true \}\)/, 'Workflow scheduling must reuse the scheduled task editor with a new prefilled task.');
assert.match(workflows, /workflowOverviewStats\(workflows, scheduledTasks\)/, 'Workflow module must derive its overview from workflow and trigger health.');
assert.match(workflows, /workflow-card-chain/, 'Workflow cards must expose a visible step chain.');
assert.match(styles, /\.cockpit-dashboard-scheduler-dialog\.cockpit-dashboard-workflow-editor\s*\{[^}]*overflow:hidden/s, 'Workflow editor shell must stay fixed instead of scrolling out of view.');
assert.match(styles, /\.cockpit-dashboard-workflow-overview-metrics\s*\{[^}]*grid-template-columns:repeat\(4/s, 'Workflow overview must keep a scan-friendly metric grid.');
assert.match(styles, /@media \(prefers-reduced-motion:reduce\)[\s\S]*\.cockpit-dashboard-workflow-card:hover\s*\{[^}]*transform:none/s, 'Workflow motion must respect reduced-motion preferences.');
assert.match(styles, /\.cockpit-dashboard-workflow-steps\s*\{[^}]*overflow-y:auto/s, 'Only the workflow step list should scroll.');
assert.match(styles, /data-run-state="conduct"[\s\S]*ck-workflow-conduct/, 'Workflow execution must expose a visible conducting path.');
assert.match(styles, /\.cockpit-dashboard-settings-layout\s*\{[^}]*grid-template-columns:\s*176px minmax\(0, 1fr\)/s, 'Settings use a visible side navigation on wide windows.');
assert.match(styles, /@container \(max-width: 760px\)[\s\S]*\.cockpit-dashboard-settings-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/s, 'Settings categories wrap according to the actual pane width.');
assert.doesNotMatch(styles, /\.cockpit-dashboard-settings-tabs\s*\{[^}]*overflow-x:\s*auto/s, 'Settings categories must not require horizontal scrolling.');
assert.match(styles, /\.cockpit-dashboard-settings-panel \.setting-item\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) fit-content\(42%\)/s, 'Every settings row reserves separate space for text and controls.');
assert.match(styles, /\.cockpit-dashboard-settings-panel \.setting-item-info\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/s, 'Long setting descriptions must wrap inside their column.');
assert.match(styles, /\.view-content:has\(> \.cockpit-dashboard-root\[data-glass="on"\]\)[\s\S]*background:[^}]*transparent/s, 'Glass mode leaves the dashboard canvas translucent.');
assert.match(serverchan, /\['ArrowRight', 'ArrowDown'\][\s\S]*\['ArrowLeft', 'ArrowUp'\]/, 'All arrow directions can reach settings categories.');
assert.match(motion, /function cockpitPlayFlip\(/, 'Motion V2 must centralize FLIP layout transitions.');
assert.match(motion, /function cockpitBindMotionInteractions\(/, 'Motion V2 must centralize press and ripple feedback.');
assert.match(motion, /function cockpitBindCinematicMotion\(/, 'Motion V2 must centralize hero and card pointer lighting.');
assert.match(motion, /function cockpitReplayMotion\(/, 'Motion V2 must expose a replayable showcase.');
assert.match(styles, /@keyframes ck-hero-aurora/, 'The hero must expose a visible ambient motion layer.');
assert.match(styles, /\.cockpit-dashboard-root\[data-motion="full"\] \.ck-tilting/, 'Interactive cards must expose a high-signal pointer state without changing layout.');
assert.match(styles, /\.cockpit-dashboard-motion-settings-preview\.is-demoing/, 'Settings must provide a visible motion preview.');
assert.match(styles, /\.cockpit-dashboard-root\[data-motion="full"\] \.cockpit-dashboard-cal-rss-btn\s*\{[^}]*overflow:visible/s, 'Calendar RSS unread badges must not be clipped by the global button ripple mask.');
const globalMotionButtonRule = styles.match(/\.cockpit-dashboard-root\[data-motion="full"\] button:not\(:disabled\),[\s\S]*?\{([^}]*)\}/)?.[1] || '';
assert.doesNotMatch(globalMotionButtonRule, /position\s*:|overflow\s*:/, 'Global motion feedback must not override positioned handles or badge overflow.');
assert.match(styles, /\.ck-motion-relative\s*\{\s*position:relative/, 'Only static ripple hosts receive relative positioning.');
assert.match(styles, /\.ck-motion-ripple-host\s*\{\s*overflow:hidden/, 'Only actual ripple hosts receive clipping.');
assert.match(styles, /\.cockpit-dashboard-content-resize-handle\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*right:\s*-10px;/s, 'The dashboard width handle remains absolutely positioned at the outer edge.');
assert.match(styles, /@keyframes ck-dialog-in\s*\{\s*from\s*\{[^}]*translateY\(10px\) scale\(\.97\)[^}]*blur\(4px\)/s, 'Dialogs and overlays share one restrained entrance frame.');
assert.match(styles, /\.modal-container\.cockpit-dashboard-modal-motion \.modal\s*\{[^}]*ck-dialog-in 320ms[^}]*--ck-ease-out/s, 'Secondary modals use the shared 320ms entrance and easing.');
assert.match(modalMotion, /function cockpitAnimateSurfaceExit\([\s\S]*getComputedStyle\(panel\)[\s\S]*duration:COCKPIT_MODAL_LEAVE_MS[\s\S]*translateY\(10px\) scale\(\.97\)/, 'Overlay exits continue from the current rendered frame through the shared 180ms surface target.');
assert.doesNotMatch(styles, /cockpit-dashboard-modal-motion \.modal > \*\s*\{[^}]*animation|cockpit-dashboard-motion-overlay > :first-child > \*\s*\{[^}]*animation/s, 'Secondary surface children must not replay a second entrance animation.');
assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*ck-dialog-opacity-in 180ms/s, 'Reduced motion keeps an opacity-only 180ms entrance.');
assert.match(modalMotion, /reduced\s*\?\s*\{ opacity:0, transform:panelStart\.transform, filter:'none' \}/, 'Reduced motion exits without adding movement, scale, or blur.');
assert.match(styles, /cockpit-dashboard-scene-leaving[^}]*cockpit-scene-out 320ms[^}]*--ck-ease-in-out[\s\S]*cockpit-dashboard-scene-entering[^}]*cockpit-scene-enter 320ms[^}]*--ck-ease-in-out/s, 'Page and scene changes keep the separate 320ms layout-transition language.');
assert.match(framework, /setTimeout\(\(\) => previousRoot\.remove\(\), 340\)/, 'The outgoing scene is removed immediately after the shared 320ms transition.');
assert.match(modalMotion, /COCKPIT_MODAL_LEAVE_MS = 180/, 'Modal and overlay removal waits for the shared exit token.');
assert.doesNotMatch(modalMotion, /duration:\s*560|scale\(1\.018\)|rotate\(/, 'Trigger-origin overlays reuse the shared surface frame instead of a private overshooting animation.');
assert.match(styles, /\.cockpit-dashboard-workflow-inline-toggle[^}]*\.cockpit-dashboard-workflow-switch/s, 'Inline step toggles must override generic field sizing.');

const actionsDeclaration = weeklyReport.indexOf("const actions = row.createDiv({ cls: PLUGIN_ID + '-report-studio-record-actions'");
const actionsBinding = weeklyReport.indexOf('actions.onpointerdown');
assert.ok(actionsDeclaration >= 0 && actionsBinding > actionsDeclaration, 'Report card actions must be created before event handlers are attached.');

console.log('UI construction regression checks passed');
