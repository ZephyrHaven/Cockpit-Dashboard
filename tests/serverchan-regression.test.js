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

console.log('ServerChan regression checks passed');
