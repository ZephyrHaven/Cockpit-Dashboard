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
  obs: {
    PluginSettingTab: class {},
    requestUrl: async (request) => { requests.push(request); return { status: 200, json: { code: 0, status: 200 } }; }
  }
});
vm.runInContext(source + ';globalThis.channelTestApi = { normalizeServerChanConfig, normalizeNotificationTimes, getServerChanScheduleSlot, suppressElapsedNotificationSlots, safeHttpsBase, sendNotificationChannel, NOTIFICATION_CHANNELS, getCockpitSettingsSections, normalizeCockpitSettingsSection };', context);
const api = context.channelTestApi;

assert.deepEqual(
  JSON.parse(JSON.stringify(api.getCockpitSettingsSections('zh-CN'))),
  [
    { id:'ai', label:'AI 模型', icon:'bot-message-square' },
    { id:'updates', label:'软件更新', icon:'download' },
    { id:'sync', label:'附近设备', icon:'scan-line' },
    { id:'channels', label:'推送渠道', icon:'send' },
    { id:'brief', label:'晨间简报', icon:'sunrise' },
    { id:'schedule', label:'提醒计划', icon:'calendar-clock' },
    { id:'scope', label:'消息内容', icon:'list-checks' },
    { id:'calendar', label:'日历', icon:'calendar-days' }
  ],
  'Settings are grouped into clear user-facing modules.'
);
assert.equal(api.normalizeCockpitSettingsSection('schedule'), 'schedule');
assert.equal(api.normalizeCockpitSettingsSection('updates'), 'updates');
assert.equal(api.normalizeCockpitSettingsSection('unknown'), 'ai', 'Invalid remembered tabs safely fall back to the AI module.');

assert.deepEqual(Object.keys(api.NOTIFICATION_CHANNELS), ['serverChan', 'bark', 'meow', 'email']);
assert.equal(api.normalizeServerChanConfig({ apiUrl: 'https://5923.push.ft07.com/send/key.send' }).channels.serverChan.enabled, true, 'Legacy ServerChan config migrates to the shared channel shape.');
assert.equal(api.normalizeServerChanConfig({}).channels.serverChan.enabled, false, 'A fresh install never enables an unconfigured channel.');
assert.equal(api.safeHttpsBase('http://unsafe.example', 'https://api.day.app'), 'https://api.day.app', 'Bark credentials never fall back to HTTP.');
assert.equal(api.normalizeServerChanConfig({ channels:{ meow:{ nickname:'a/b' } } }).channels.meow.nickname, 'ab', 'MEOW nickname cannot inject URL path separators.');
const email = api.normalizeServerChanConfig({ channels:{ email:{ enabled:true, apiKey:'re_test', from:'Cockpit <ops@example.com>', to:'one@example.com, two@example.com' } } }).channels.email;
assert.equal(email.enabled, true);
assert.deepEqual(Array.from(email.to), ['one@example.com','two@example.com']);
assert.deepEqual(Array.from(api.normalizeNotificationTimes(['18:00', '09:30:00', '18:00:00', 'bad'])), ['18:00:00', '09:30:00'], 'Notification times are valid, unique, normalized to seconds, and keep the user-visible row order.');
assert.deepEqual(Array.from(api.normalizeServerChanConfig({ time:'11:30:00' }).times), ['11:30:00'], 'Legacy single-time settings migrate without changing the selected time.');
assert.equal(api.normalizeServerChanConfig({ times:['08:00', '20:15'] }).time, '08:00:00', 'The legacy time alias follows the first normalized time.');

const fakeNow = (date, time) => ({ format:(pattern) => pattern === 'HH:mm:ss' ? time : pattern === 'YYYY-MM-DD' ? date : '' });
const multiTimeConfig = api.normalizeServerChanConfig({ times:['18:00', '09:00', '11:30'] });
const activeSlot = api.getServerChanScheduleSlot(multiTimeConfig, fakeNow('2026-08-13', '12:00:00'));
assert.equal(activeSlot.time, '11:30:00', 'Only the latest elapsed time is eligible after the app resumes.');
assert.equal(activeSlot.key, '2026-08-13|11:30:00');
assert.equal(api.getServerChanScheduleSlot(multiTimeConfig, fakeNow('2026-08-13', '08:59:59')), null, 'No slot is due before the first configured time.');

const previousTimes = api.normalizeServerChanConfig({ times:['11:30'] });
const editedTimes = api.normalizeServerChanConfig({ ...previousTimes, times:['11:30', '09:00', '18:00'] });
const suppressed = api.suppressElapsedNotificationSlots(previousTimes, editedTimes, fakeNow('2026-08-13', '12:00:00'));
assert.deepEqual(Object.keys(suppressed.sentReminders['2026-08-13|09:00:00']).sort(), ['bark', 'email', 'meow', 'serverChan'], 'Editing a time into the past suppresses an immediate push through every channel.');
assert.equal(suppressed.sentReminders['2026-08-13|18:00:00'], undefined, 'A newly configured future time remains eligible later today.');

(async () => {
  await api.sendNotificationChannel('bark', { serverUrl:'https://api.day.app/push', deviceKey:'abcdefgh', group:'cockpit' }, 'Title', 'Body');
  assert.equal(requests[0].url, 'https://api.day.app/push');
  assert.deepEqual(JSON.parse(requests[0].body), { device_key:'abcdefgh', title:'Title', body:'Body', group:'cockpit' });
  await api.sendNotificationChannel('meow', { nickname:'John Doe' }, 'Title', 'Body');
  assert.equal(requests[1].url, 'https://api.chuckfang.com/John%20Doe?msgType=markdown');
  assert.deepEqual(JSON.parse(requests[1].body), { title:'Title', msg:'Body' });
  await api.sendNotificationChannel('email', { apiKey:'re_test', from:'Cockpit <ops@example.com>', to:['one@example.com'] }, 'Title', 'Body');
  assert.equal(requests[2].url, 'https://api.resend.com/emails');
  assert.equal(requests[2].headers.Authorization, 'Bearer re_test');
  assert.deepEqual(JSON.parse(requests[2].body).to, ['one@example.com']);
  console.log('Notification channel regression checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
