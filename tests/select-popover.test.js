#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ PLUGIN_ID:'cockpit-dashboard', globalThis:{}, Array, String, Number });
context.globalThis = context;
const source = fs.readFileSync(path.join(__dirname, '../src/select-popover.js'), 'utf8');
vm.runInContext(source + ';globalThis.api={cockpitSelectEligible,cockpitSelectMenuItems,cockpitCommitSelectValue};', context);
const { api } = context;

const el = (tagName, props = {}, children = []) => {
  const node = { nodeType:1, tagName, className:'', dataset:{}, children, parentElement:null, ...props };
  children.forEach((child) => { child.parentElement = node; });
  return node;
};
const option = (value, label, extra = {}) => el('OPTION', { value, label, textContent:label, ...extra });

const select = el('SELECT', { value:'url' }, [option('url', '打开网址', { selected:true }), option('script', '运行 Shell 脚本')]);
const panel = el('DIV', { className:'cockpit-dashboard-custom-toolbar-editor' }, [select]);
assert.equal(api.cockpitSelectEligible(select), true, 'Selects inside plugin surfaces use the custom menu.');
assert.equal(api.cockpitSelectEligible(el('SELECT', {}, [])), false, 'Selects outside the plugin keep the native popup.');
const multi = el('SELECT', { multiple:true }); el('DIV', { className:'cockpit-dashboard-root' }, [multi]);
assert.equal(api.cockpitSelectEligible(multi), false, 'Multi-selects are left native.');
const disabled = el('SELECT', { disabled:true }); el('DIV', { className:'cockpit-dashboard-root' }, [disabled]);
assert.equal(api.cockpitSelectEligible(disabled), false);
const optOut = el('SELECT'); el('DIV', { className:'cockpit-dashboard-root', dataset:{ cockpitNativeSelect:'true' } }, [optOut]);
assert.equal(api.cockpitSelectEligible(optOut), false, 'data-cockpit-native-select opts a subtree out.');
const team = el('SELECT'); el('DIV', { className:'cockpit-team-field' }, [team]);
assert.equal(api.cockpitSelectEligible(team), true);
void panel;

const items = api.cockpitSelectMenuItems(select);
assert.deepEqual(JSON.parse(JSON.stringify(items.map((i) => [i.value, i.label, i.selected]))), [['url', '打开网址', true], ['script', '运行 Shell 脚本', false]]);
const grouped = el('SELECT', { value:'b' }, [el('OPTGROUP', { label:'G', disabled:true }, [option('a', 'A')]), option('b', 'B'), option('c', 'C', { hidden:true })]);
assert.deepEqual(JSON.parse(JSON.stringify(api.cockpitSelectMenuItems(grouped).map((i) => [i.type, i.label, !!i.disabled]))), [['group', 'G', false], ['option', 'A', true], ['option', 'B', false]]);

const events = [];
context.Event = class { constructor(type) { this.type = type; } };
const target = { value:'url', dispatchEvent:(e) => events.push(e.type) };
assert.equal(api.cockpitCommitSelectValue(target, 'url'), false, 'Picking the current value fires nothing.');
assert.equal(api.cockpitCommitSelectValue(target, 'script'), true);
assert.equal(target.value, 'script');
assert.deepEqual([...events], ['input', 'change'], 'Existing onchange handlers still run.');
console.log('select-popover tests passed');
