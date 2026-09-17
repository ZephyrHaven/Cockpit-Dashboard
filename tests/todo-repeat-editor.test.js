const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag, options = {}) { this.tag = tag; this.text = options.text || ''; this.attr = options.attr || {}; this.value = this.attr.value || ''; this.children = []; this.events = {}; }
  createEl(tag, options) { const element = new Element(tag, options); this.children.push(element); return element; }
  createDiv(options) { return this.createEl('div', options); }
  addEventListener(name, fn) { this.events[name] = fn; }
  setText(text) { this.text = text; }
  focus() { this.focused = true; }
  find(tag) { return this.children.flatMap((element) => [ ...(element.tag === tag ? [element] : []), ...element.find(tag) ]); }
}
const context = vm.createContext({ PLUGIN_ID:'cockpit-dashboard', window:{ moment:() => '2026-01-31' } });
vm.runInContext(fs.readFileSync('src/todo-repeat.js', 'utf8') + '\n' + fs.readFileSync('src/todo-repeat-editor.js', 'utf8')
  + '\nthis.build=buildTodoRepeatEditor;', context);
const body = new Element('div'), draft = { dueDate:'2026-01-31', dueHasTime:false };
const editor = context.build(body, draft, 'zh', false);
const [unit, mode] = body.find('select'), [interval] = body.find('input');
assert.equal(mode.disabled, true);
unit.value = 'month'; unit.events.change();
assert.equal(mode.disabled, false);
assert.equal(body.find('div').some((element) => element.text.includes('2026-02-28')), true);
assert.equal(editor.validate(draft.dueDate), true);
interval.value = '0'; interval.events.change();
assert.equal(editor.validate(draft.dueDate), false);
assert.equal(interval.focused, true);
interval.value = '2'; interval.events.change(); draft.dueDate = null; editor.refresh();
assert.equal(editor.validate(null), false, 'Fixed schedules require a first due date.');
mode.value = 'completion'; mode.events.change();
assert.equal(editor.validate(null), true, 'Completion-based intervals also work without an existing due date.');
unit.value = ''; unit.events.change();
assert.equal(draft.repeat, null, 'Never disables repeating tasks.');
assert.equal(editor.validate(null), true);
const completed = new Element('div'); context.build(completed, { repeat:{ unit:'week', interval:1, mode:'scheduled' }, dueDate:'2026-01-31' }, 'en', true);
assert.equal(completed.find('select').every((element) => element.disabled), true);
assert.equal(completed.find('div').some((element) => element.text.includes('next open task')), true);
console.log('Repeat editor interaction checks passed');
