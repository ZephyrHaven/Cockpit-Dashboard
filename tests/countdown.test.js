#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeCountdown,
  normalizeCountdowns,
  countdownThresholdMs,
  countdownState,
  dueCountdownEvent,
  formatCountdownRemaining
} = require('../src/countdown-core.js');

const start = Date.parse('2026-08-30T00:00:00.000Z');
const target = Date.parse('2026-09-09T00:00:00.000Z');
const countdown = normalizeCountdown({
  id:'release', name:'版本发布', enabled:true,
  startAt:new Date(start).toISOString(), targetAt:new Date(target).toISOString(),
  channelIds:['serverChan','email','unknown','email'], localNotification:true, notifyAtEnd:true,
  thresholds:[
    { id:'pct-20', mode:'percent', value:20 },
    { id:'fixed-2d', mode:'duration', value:2, unit:'days' },
    { id:'bad', mode:'percent', value:0 }
  ]
});

assert.equal(countdown.thresholds.length, 2, 'Invalid thresholds are discarded.');
assert.deepEqual(countdown.channelIds, ['serverChan','email'], 'Countdown delivery channels are allowlisted and deduplicated.');
assert.equal(countdownThresholdMs(countdown.thresholds[0], target - start), 2 * 86400000);
assert.equal(countdownThresholdMs(countdown.thresholds[1], target - start), 2 * 86400000);
assert.equal(countdownState(countdown, Date.parse('2026-09-08T00:00:00Z')).progress, 90);
assert.equal(countdownState(countdown, Date.parse('2026-09-10T00:00:00Z')).remainingMs, 0);

let event = dueCountdownEvent(countdown, Date.parse('2026-09-07T00:00:01Z'), ['serverChan','email']);
assert.equal(event.kind, 'threshold');
assert.equal(event.threshold.id, 'fixed-2d', 'When several thresholds are crossed together, only the one closest to the deadline is delivered.');
assert.deepEqual(event.pendingChannelIds, ['serverChan','email']);

const partlyDelivered = normalizeCountdown({
  ...countdown,
  deliveries:{ 'threshold:fixed-2d':{ serverChan:{ ok:true, attempts:1, at:'2026-09-07T00:00:02Z' } } }
});
event = dueCountdownEvent(partlyDelivered, Date.parse('2026-09-07T00:01:00Z'), ['serverChan','email']);
assert.deepEqual(event.pendingChannelIds, ['email'], 'A successful channel is never sent the same countdown event twice.');

const retried = normalizeCountdown({
  ...countdown,
  localNotification:false,
  deliveries:{ 'threshold:fixed-2d':{ email:{ ok:false, attempts:3, at:'2026-09-07T00:02:00Z', error:'offline' } } }
});
event = dueCountdownEvent(retried, Date.parse('2026-09-07T00:03:00Z'), ['email']);
assert.deepEqual(event.pendingChannelIds, [], 'A failing notification channel stops retrying after the bounded attempt limit.');
assert.equal(event.eventPending, true, 'Notification retry exhaustion does not suppress the independent module event.');

event = dueCountdownEvent(countdown, Date.parse('2026-09-09T00:00:01Z'), ['email']);
assert.equal(event.kind, 'finished', 'The deadline has its own configurable completion notification.');
assert.equal(event.eventPending, true, 'A countdown lifecycle event is available for module automation.');

const automationOnly = normalizeCountdown({
  id:'automation-only', name:'自动化截止点', enabled:true,
  startAt:new Date(start).toISOString(), targetAt:new Date(target).toISOString(),
  channelIds:[], localNotification:false, notifyAtEnd:false, thresholds:[]
});
event = dueCountdownEvent(automationOnly, Date.parse('2026-09-09T00:00:01Z'), []);
assert.equal(event.kind, 'finished', 'Countdown completion remains an automation event even when user notifications are disabled.');
assert.equal(event.eventPending, true);
assert.deepEqual(event.pendingChannelIds, []);
assert.equal(event.localPending, false);
const automationDelivered = normalizeCountdown({
  ...automationOnly,
  deliveries:{ finished:{ event:{ ok:true, attempts:1, at:'2026-09-09T00:00:02Z' } } }
});
assert.equal(dueCountdownEvent(automationDelivered, Date.parse('2026-09-09T00:01:00Z'), []), null, 'Each countdown lifecycle event is emitted only once.');
assert.match(formatCountdownRemaining(90061000, 'zh-CN'), /1天/);
assert.match(formatCountdownRemaining(59000, 'en'), /59 sec/);

assert.equal(normalizeCountdown({ name:'bad', startAt:new Date(target).toISOString(), targetAt:new Date(start).toISOString() }), null);
assert.equal(normalizeCountdown(null), null);
assert.equal(normalizeCountdowns([countdown, countdown]).length, 1, 'Duplicate countdown IDs are removed.');

const framework = fs.readFileSync(path.join(__dirname, '../src/_framework.js'), 'utf8');
const build = fs.readFileSync(path.join(__dirname, '../build.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
const countdownModule = fs.readFileSync(path.join(__dirname, '../src/countdown.js'), 'utf8');
const countdownUi = require('../src/countdown.js');
assert.match(framework, /id:'countdowns'[\s\S]*collapsible:true/, 'Countdowns participate in layout, visibility, scenes, and collapse state.');
assert.match(framework, /buildCountdownModule/, 'The dashboard renders the countdown module.');
assert.match(framework, /new CountdownService/, 'The plugin owns a countdown scheduler.');
assert.match(build, /'countdown-core\.js'[\s\S]*'countdown\.js'/, 'Countdown modules are included in the production bundle.');
assert.match(countdownModule, /cockpitEmit\('countdown-'\s*\+\s*event\.kind/, 'Countdown threshold and completion signals enter the shared module event bus.');
assert.match(countdownModule, /countdownAutomationDraft[\s\S]*countdown-finished[\s\S]*openScheduledTaskEditor/, 'A countdown card exposes a direct path for creating a linked automation.');
const linkedDraft = countdownUi.countdownAutomationDraft(countdown, 'zh-CN');
assert.equal(linkedDraft.kind, 'workflow', 'Countdown linkage opens with automation workflow selected instead of hiding it behind app commands.');
assert.deepEqual(linkedDraft.schedule, {type:'event',event:'countdown-finished',sourceId:'release',sourceLabel:'版本发布'});
assert.match(countdownModule, /countdown-link-automation[\s\S]*stopPropagation/, 'The linkage control owns its click instead of leaking into layout interactions.');
assert.match(styles, /\.cockpit-dashboard-countdown-title\s*\{[^}]*justify-content:flex-start/, 'Countdown actions follow the same left-aligned title layout as other collapsible modules.');
assert.match(styles, /\.cockpit-dashboard-countdown-title\s*>\s*\.cockpit-dashboard-collapse-arrow\s*\{[^}]*order:2/, 'The collapse control stays beside the countdown title.');
assert.match(styles, /\.cockpit-dashboard-countdown-add\s*\{[^}]*order:3[^}]*margin-left:auto/, 'The add-countdown action stays at the far edge of the title row.');
assert.match(styles, /data-module-id="countdowns"[^}]*pointer-events:auto/, 'Countdown controls remain usable while arranging the layout.');
assert.match(styles, /\.cockpit-dashboard-countdown-actions button\s*\{[^}]*transition:/, 'Countdown card buttons animate state changes.');
assert.match(styles, /\.cockpit-dashboard-countdown-actions button:active\s*\{[^}]*transform:/, 'Countdown card buttons provide tactile press feedback.');

console.log('Countdown checks passed');
