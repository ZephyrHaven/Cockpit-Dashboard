const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const A = 'a'.repeat(32);
const B = 'b'.repeat(32);
const C = 'c'.repeat(32);
const ctx = vm.createContext({
  console,
  require,
  setTimeout,
  clearTimeout,
  obs:{ PluginSettingTab:class {} },
  window:{ moment:() => ({ format:(pattern) => pattern === 'HH:mm' ? '09:30' : '2026-09-10' }) }
});

for (const file of ['serverchan', 'morning-brief']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/' + file + '.js'), 'utf8'), ctx);
}
vm.runInContext(`globalThis.api = {
  normalizeMorningBriefConfig,
  morningBriefDeviceOptions:typeof morningBriefDeviceOptions === 'function' ? morningBriefDeviceOptions : null,
  morningBriefDefaultSenderId:typeof morningBriefDefaultSenderId === 'function' ? morningBriefDefaultSenderId : null,
  morningBriefShouldAutoSend:typeof morningBriefShouldAutoSend === 'function' ? morningBriefShouldAutoSend : null
};`, ctx);

const api = ctx.api;
assert.equal(api.normalizeMorningBriefConfig({}).deliveryMode, 'selected-device', 'Existing users default to one selected sender device.');
assert.equal(api.normalizeMorningBriefConfig({ deliveryMode:'every-device' }).deliveryMode, 'every-device');
assert.equal(api.normalizeMorningBriefConfig({ deliveryMode:'invalid' }).deliveryMode, 'selected-device');
assert.equal(api.normalizeMorningBriefConfig({ senderDeviceId:A }).senderDeviceId, A);
assert.equal(api.normalizeMorningBriefConfig({ senderDeviceId:'not-a-device' }).senderDeviceId, '');

assert.equal(typeof api.morningBriefDeviceOptions, 'function');
assert.equal(typeof api.morningBriefDefaultSenderId, 'function');
assert.equal(typeof api.morningBriefShouldAutoSend, 'function');

const state = {
  device:B,
  peers:[
    { device:C, name:'Desktop', lastSync:20 },
    { device:A, name:'Laptop', lastSync:10 },
    { device:'invalid', name:'Ignored' }
  ]
};
const devices = api.morningBriefDeviceOptions(state, 'Current computer');
assert.deepEqual(Array.from(devices, item => item.id), [B, C, A]);
assert.equal(devices[0].current, true);
assert.equal(devices[1].name, 'Desktop');
assert.equal(api.morningBriefDefaultSenderId(state), A, 'Every paired device deterministically elects the same migration default.');

assert.equal(api.morningBriefShouldAutoSend({ deliveryMode:'every-device', senderDeviceId:A }, B), true);
assert.equal(api.morningBriefShouldAutoSend({ deliveryMode:'selected-device', senderDeviceId:B }, B), true);
assert.equal(api.morningBriefShouldAutoSend({ deliveryMode:'selected-device', senderDeviceId:A }, B), false);
assert.equal(api.morningBriefShouldAutoSend({ deliveryMode:'selected-device', senderDeviceId:'' }, B), false);

console.log('Morning brief multi-device routing tests passed');
