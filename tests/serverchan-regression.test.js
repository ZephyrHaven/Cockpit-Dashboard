#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/serverchan.js'), 'utf8');

assert.match(source, /this\._config = null/, 'ServerChan configuration is cached in memory.');
assert.match(source, /if \(this\._config\) return normalizeServerChanConfig\(this\._config\)/, 'Scheduler reuses the cached configuration.');
assert.match(source, /if \(!config\.enabled \|\| !isServerChanScheduleDue\(config, now\).*allEnabledChannelsSent\(config, key\)\) return;[\s\S]*?const data = await this\.plugin\.loadData\(\)/, 'Scheduler checks schedule eligibility before reading Vault state.');
assert.match(source, /this\._displayVersion = 0/, 'Settings tab tracks render versions.');
assert.match(source, /if \(renderVersion !== this\._displayVersion\) return;/, 'Stale asynchronous settings renders are discarded.');
assert.match(source, /heading: 'Message notifications'/, 'English settings heading is localized.');
assert.match(source, /heading: '消息推送'/, 'Chinese settings heading is localized.');
assert.match(source, /getServerChanScheduleSlot\(config, now\)/, 'The scheduler chooses from multiple configured delivery times.');
assert.match(source, /notification-time-list[\s\S]*type:'time'[\s\S]*addTime/, 'Settings use a visual list of native time pickers with an add action.');
assert.doesNotMatch(source, /setValue\(config\.time\)/, 'Settings no longer expose one legacy time input.');
assert.doesNotMatch(source, /next\[index\] = normalized; await persistTimes\(next\); renderTimes\(\);/, 'Keyboard edits do not rebuild the list and move focus to the first row.');
assert.match(source, /saveConfig\(next, options\)[\s\S]*suppressElapsedNotificationSlots/, 'Saving edited delivery times suppresses elapsed slots for the current day.');

console.log('ServerChan regression checks passed');
