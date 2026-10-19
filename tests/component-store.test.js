#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  cloneComponentLayoutSnapshot,
  setComponentVisibility,
  moveComponentBefore,
  moveComponentAtDrop,
  setNestedItemVisibility,
  moveNestedItemBefore
} = require('../src/component-store-core.js');

global.CockpitModal = class {};
const { scheduleComponentStoreScrollRestore } = require('../src/component-store.js');
delete global.CockpitModal;

const animationFrames = new Map();
let nextAnimationFrame = 1;
const previousWindow = global.window;
global.window = {
  requestAnimationFrame(callback) { const id=nextAnimationFrame++; animationFrames.set(id,callback); return id; },
  cancelAnimationFrame(id) { animationFrames.delete(id); }
};
const scrollModal = {_scrollRestoreFrame:0};
const firstBody = {isConnected:true,scrollTop:0,scrollHeight:1200,clientHeight:400};
scheduleComponentStoreScrollRestore(scrollModal,firstBody,620);
assert.equal(firstBody.scrollTop,0,'Scroll restoration waits until the replacement list has completed layout.');
assert.equal(animationFrames.size,1);
const firstFrame = [...animationFrames.entries()][0]; animationFrames.delete(firstFrame[0]); firstFrame[1]();
assert.equal(firstBody.scrollTop,620,'The current-layout list returns to its previous position on the next animation frame.');

const staleBody = {isConnected:true,scrollTop:0,scrollHeight:1200,clientHeight:400};
const latestBody = {isConnected:true,scrollTop:0,scrollHeight:900,clientHeight:400};
scheduleComponentStoreScrollRestore(scrollModal,staleBody,700);
scheduleComponentStoreScrollRestore(scrollModal,latestBody,680);
assert.equal(animationFrames.size,1,'Rapid component changes cancel stale scroll restoration work.');
const latestFrame = [...animationFrames.entries()][0]; animationFrames.delete(latestFrame[0]); latestFrame[1]();
assert.equal(staleBody.scrollTop,0,'A replaced list is never scrolled by a stale callback.');
assert.equal(latestBody.scrollTop,500,'Restoration clamps to the shortened list instead of jumping to the top.');
global.window = previousWindow;

const existing = {
  moduleOrder:['hero','toolbar','stats','calendar','todos'],
  hiddenModules:['stats'],
  toolbarOrder:['new','custom:deploy','search'],
  hiddenToolbarActions:['search'],
  statsCardOrder:['focusMin','noteCount','donePct'],
  hiddenStatsCards:['donePct'],
  moduleLabels:{ toolbar:'运维入口' }
};

const cloned = cloneComponentLayoutSnapshot(existing);
assert.deepEqual(cloned, existing, 'Opening the component store starts from the exact existing scene state.');
cloned.moduleOrder.push('agenda');
cloned.moduleLabels.toolbar = 'changed';
assert.deepEqual(existing.moduleOrder, ['hero','toolbar','stats','calendar','todos'], 'The store draft never mutates the live scene arrays.');
assert.equal(existing.moduleLabels.toolbar, '运维入口', 'The store draft never mutates live scene labels.');

let next = setComponentVisibility(existing, 'stats', true);
assert.deepEqual(next.hiddenModules, [], 'Adding a component only removes it from the hidden set.');
assert.deepEqual(next.toolbarOrder, existing.toolbarOrder, 'Adding a component preserves nested Toolbar state byte-for-byte.');
assert.deepEqual(next.statsCardOrder, existing.statsCardOrder, 'Adding a component preserves existing statistics-card state.');
next = setComponentVisibility(next, 'agenda', false);
assert.deepEqual(next.hiddenModules, ['agenda']);
assert.deepEqual(next.moduleOrder, [...existing.moduleOrder, 'agenda'], 'A newly encountered component is appended without reordering existing components.');

next = moveComponentBefore(existing, 'todos', 'toolbar');
assert.deepEqual(next.moduleOrder, ['hero','todos','toolbar','stats','calendar']);
assert.deepEqual(next.hiddenModules, existing.hiddenModules, 'Reordering never changes visibility.');
assert.deepEqual(moveComponentAtDrop(existing, 'todos', 'toolbar', false).moduleOrder, ['hero','todos','toolbar','stats','calendar'], 'Dropping in the upper half inserts before the target.');
assert.deepEqual(moveComponentAtDrop(existing, 'todos', 'toolbar', true).moduleOrder, ['hero','toolbar','todos','stats','calendar'], 'Dropping in the lower half inserts after the target.');

next = setNestedItemVisibility(existing, 'hiddenToolbarActions', 'search', true);
assert.deepEqual(next.hiddenToolbarActions, []);
next = setNestedItemVisibility(next, 'hiddenToolbarActions', 'new', false);
assert.deepEqual(next.hiddenToolbarActions, ['new']);
assert.deepEqual(next.moduleOrder, existing.moduleOrder, 'Nested settings never reorder top-level components.');

next = moveNestedItemBefore(existing, 'toolbarOrder', 'search', 'new');
assert.deepEqual(next.toolbarOrder, ['search','new','custom:deploy']);
assert.deepEqual(next.statsCardOrder, existing.statsCardOrder);
assert.deepEqual(moveNestedItemBefore(existing, 'statsCardOrder', 'donePct', 'focusMin').statsCardOrder, ['donePct','focusMin','noteCount']);

const root = path.resolve(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'src/component-store.js'), 'utf8');
const scenes = fs.readFileSync(path.join(root, 'src/scenes.js'), 'utf8');
const framework = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(build, /'component-store-core\.js'[\s\S]*'component-store\.js'/, 'The component store is included in the production bundle.');
assert.match(scenes, /openComponentStore\(view\)/, 'Scene management opens the component store.');
assert.doesNotMatch(scenes, /view\._toggleLayoutEdit\(\)/, 'The scene menu no longer exposes the noisy live editor.');
assert.match(framework, /openComponentStore\(this\)/, 'The dashboard context menu opens the same component store.');
assert.match(store, /renderToolbarManager/, 'Toolbar has a dedicated component manager.');
assert.match(store, /openBuiltinToolbarConfigEditor/, 'Toolbar retains built-in button configuration.');
assert.match(store, /openCustomToolbarButtonEditor/, 'Toolbar retains custom-button creation and editing.');
assert.match(store, /openPomodoroToolbarConfigEditor/, 'Toolbar retains Pomodoro button settings.');
assert.match(store, /openCustomToolbarLogs/, 'Toolbar retains run-log access.');
assert.match(store, /renderStatsManager[\s\S]*hiddenStatsCards/, 'Statistics-card ordering and visibility move into the statistics component manager.');
assert.match(store, /CockpitTipLibraryModal/, 'Daily-tip management remains available from its component detail.');
assert.match(store, /sceneId[\s\S]*activeSceneId/, 'Applying a stale store draft is guarded when the active scene changes.');
const currentLayoutStart = store.indexOf('\n  renderCurrent(body,c)');
const currentLayoutSource = store.slice(currentLayoutStart, store.indexOf('\n  renderCatalog(body,c)', currentLayoutStart));
assert.doesNotMatch(currentLayoutSource, /component-layout-row[^\n]*draggable:'true'/, 'A layout row itself is not draggable, so buttons and text remain easy to use.');
assert.match(currentLayoutSource, /component-row-handle[\s\S]*draggable:'true'/, 'Only the explicit handle starts a layout drag.');
assert.match(currentLayoutSource, /drop-before[\s\S]*drop-after/, 'Layout dragging exposes an exact before/after insertion target.');
assert.match(store, /_rerenderInPlace\(\)[\s\S]*body\?\.scrollTop\?\?0[\s\S]*bodyScrollTop/, 'In-place component changes capture the store body scroll offset before rendering.');
assert.match(store, /if\(bodyScrollTop!==null\)scheduleComponentStoreScrollRestore\(this,body,bodyScrollTop\)/, 'The component store restores its body scroll offset after layout completes.');
const setVisibleSource = store.slice(store.indexOf('_setVisible(id, visible)'), store.indexOf('\n  _syncVisibilityItem', store.indexOf('_setVisible(id, visible)')));
assert.doesNotMatch(setVisibleSource, /render|_rerenderInPlace|_renderDashboard/, 'Adding or removing a component only updates the draft and never redraws either surface.');
assert.match(setVisibleSource, /_syncVisibilityItem\(id\)/, 'Adding or removing a component synchronizes only its existing row or card.');
assert.match(store, /initialSnapshot[\s\S]*is-pending-add[\s\S]*is-pending-remove/, 'The component store compares draft visibility with the opening snapshot.');
assert.match(store, /data-component-visibility-action/, 'Visibility actions expose stable in-place synchronization hooks.');
assert.match(store, /onClose\(\)[\s\S]*this\.applied \|\| this\.globalChanged/, 'Cancel discards the visibility draft without refreshing the dashboard.');
assert.match(styles, /\.cockpit-dashboard-component-layout-row\.is-pending-remove/, 'Pending removals remain visible in their current-layout position.');
assert.match(styles, /\.cockpit-dashboard-component-card\.is-pending-add[\s\S]*\.cockpit-dashboard-component-card\.is-pending-remove/, 'Catalog cards expose both staged visibility states.');
assert.match(currentLayoutSource, /ondrop=[^\n]*_rerenderInPlace\(\)/, 'Drag reordering keeps the current layout viewport.');
assert.match(store, /function renderComponentPreview\(/, 'The store provides a reusable component preview renderer.');
assert.match(store, /component-card-preview/, 'Catalog cards include a component preview.');
assert.match(store, /component-detail-preview/, 'Component details include a larger preview.');

console.log('Component store checks passed');
