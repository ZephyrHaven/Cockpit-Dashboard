const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const prefix = 'cockpit-dashboard';
const timers = new Map();
let nextTimer = 0;
const context = vm.createContext({
  PLUGIN_ID:prefix,
  AbortController,
  setTimeout(callback, delay) {
    assert.equal(delay, 10000);
    timers.set(++nextTimer, callback);
    return nextTimer;
  },
  clearTimeout:id => timers.delete(id),
  cockpitAnimateCollapse:() => {}
});
for (const name of ['module-presentation.js', 'layout-edit.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', name), 'utf8'), context);
}

const root = Object.assign(new EventTarget(), { children:[], dataset:{} });
function createModule(moduleId) {
  const classes = new Set();
  const wrapper = {
    parentElement:root,
    dataset:{ moduleId },
    classList:{ add:name => classes.add(name), remove:name => classes.delete(name), contains:name => classes.has(name) },
    closest:selector => selector === `.${prefix}-module` ? wrapper : null
  };
  return wrapper;
}
const tasks = createModule('todos');
const calendar = createModule('calendar');
root.children = [tasks, calendar];
let collapseWrites = 0;
const view = {
  _collapsed:{},
  _isModuleHidden:() => false,
  _mutatePluginData() { collapseWrites++; return Promise.resolve(); }
};
const cleanup = context.cockpitBindModuleFocus(view, root);

const title = Object.assign(new EventTarget(), {
  dataset:{}, style:{}, setAttribute() {}, closest:() => null, createSpan:() => ({ classList:{ toggle() {} } })
});
const content = { style:{} };
const titleIcon = { closest:selector => selector === `.${prefix}-module-title-icon` || selector.startsWith('button,') ? tasks : null };
const calendarDockIcon = { closest:selector => selector === `.${prefix}-module-nav-item` ? { dataset:{ navModule:'calendar' } } : null };
function dispatch(element, type, target, properties = {}) {
  const event = Object.assign(new Event(type, { cancelable:true }), properties);
  Object.defineProperty(event, 'target', { value:target });
  element.dispatchEvent(event);
  return event;
}

context.cockpitMakeCollapsible(view, title, content, 'todos');
for (const detail of [1, 2]) {
  dispatch(title, 'click', titleIcon, { detail });
  dispatch(root, 'click', titleIcon, { detail });
}
assert.equal(collapseWrites, 0);
assert.equal(view._moduleFocus, undefined);
dispatch(root, 'dblclick', titleIcon);
assert.equal(root.dataset.moduleFocus, 'todos');
assert.equal(tasks.classList.contains('is-module-focused'), true);
const firstTimer = view._moduleFocus.timer;

dispatch(root, 'dblclick', calendarDockIcon);
assert.equal(root.dataset.moduleFocus, 'calendar');
assert.equal(tasks.classList.contains('is-module-focused'), false);
assert.equal(timers.has(firstTimer), false);

const replacement = createModule('calendar');
root.children = [tasks, replacement];
context.cockpitSyncModuleFocus(view, root);
assert.equal(replacement.classList.contains('is-module-focused'), true);
const currentTimer = view._moduleFocus.timer;
timers.get(currentTimer)();
assert.equal(root.dataset.moduleFocus, undefined);
assert.equal(replacement.classList.contains('is-module-focused'), false);

assert.equal(dispatch(title, 'keydown', titleIcon, { key:'Enter' }).defaultPrevented, false);
dispatch(root, 'click', titleIcon, { detail:0 });
assert.equal(root.dataset.moduleFocus, 'todos');
dispatch(root, 'keydown', titleIcon, { key:'Escape' });
assert.equal(root.dataset.moduleFocus, undefined);
assert.equal(collapseWrites, 0);

dispatch(root, 'dblclick', titleIcon);
view._editMode = true;
context.cockpitSyncModuleFocus(view, root);
dispatch(root, 'dblclick', titleIcon);
assert.equal(root.dataset.moduleFocus, undefined);
view._editMode = false;
dispatch(root, 'dblclick', titleIcon);
cleanup();
dispatch(root, 'dblclick', titleIcon);
assert.equal(root.dataset.moduleFocus, undefined);
assert.equal(timers.size, 0);

dispatch(title, 'click', title, { detail:1 });
assert.equal(collapseWrites, 1);
assert.equal(view._collapsed.todos, true);
