#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/serverchan.js'), 'utf8');
const requests = [];
const context = vm.createContext({
  URL,
  Date,
  console,
  navigator: { language: 'en-US' },
  obsidian: {
    PluginSettingTab: class {},
    requestUrl: async (request) => { requests.push(request); return { status: 200, json: { code: 0, status: 200 } }; }
  }
});
vm.runInContext(source + ';globalThis.channelTestApi = { normalizeServerChanConfig, safeHttpsBase, sendNotificationChannel, NOTIFICATION_CHANNELS };', context);
const api = context.channelTestApi;

assert.deepEqual(Object.keys(api.NOTIFICATION_CHANNELS), ['serverChan', 'bark', 'meow']);
assert.equal(api.normalizeServerChanConfig({ apiUrl: 'https://5923.push.ft07.com/send/key.send' }).channels.serverChan.enabled, true, 'Legacy ServerChan config migrates to the shared channel shape.');
assert.equal(api.normalizeServerChanConfig({}).channels.serverChan.enabled, false, 'A fresh install never enables an unconfigured channel.');
assert.equal(api.safeHttpsBase('http://unsafe.example', 'https://api.day.app'), 'https://api.day.app', 'Bark credentials never fall back to HTTP.');
assert.equal(api.normalizeServerChanConfig({ channels:{ meow:{ nickname:'a/b' } } }).channels.meow.nickname, 'ab', 'MEOW nickname cannot inject URL path separators.');

(async () => {
  await api.sendNotificationChannel('bark', { serverUrl:'https://api.day.app/push', deviceKey:'abcdefgh', group:'cockpit' }, 'Title', 'Body');
  assert.equal(requests[0].url, 'https://api.day.app/push');
  assert.deepEqual(JSON.parse(requests[0].body), { device_key:'abcdefgh', title:'Title', body:'Body', group:'cockpit' });
  await api.sendNotificationChannel('meow', { nickname:'John Doe' }, 'Title', 'Body');
  assert.equal(requests[1].url, 'https://api.chuckfang.com/John%20Doe?msgType=markdown');
  assert.deepEqual(JSON.parse(requests[1].body), { title:'Title', msg:'Body' });
  console.log('Notification channel regression checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
