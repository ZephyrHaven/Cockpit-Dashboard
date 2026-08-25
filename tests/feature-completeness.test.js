#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (name) => fs.readFileSync('src/' + name, 'utf8');
const framework = read('_framework.js');
const calendar = read('calendar.js');
const rss = read('rss.js');
const scenes = read('scenes.js');

assert.match(rss, /toggleSaved[\s\S]*savedAt/, 'RSS has a persistent local read-later state.');
assert.match(rss, /queueMode === 'later'[\s\S]*queueMode === 'unread'/, 'RSS exposes unread and read-later queues across dates.');
assert.match(rss, /activeItem \? this\._createSpeechControls/, 'Empty RSS queues do not construct a player with an undefined article.');
assert.match(rss, /rss-queue-tabs[\s\S]*rss-filter-select/, 'RSS keeps queue navigation visible while consolidating source and tag filters.');
assert.match(rss, /if \(!items\.length\)[\s\S]*return/, 'RSS renders a navigable empty state after the queue controls.');
assert.match(rss, /updateProgress[\s\S]*readProgress/, 'RSS reading progress is persisted in the local cache.');
assert.match(scenes, /Workdays|工作日/, 'Scene rules include workday presets.');
assert.match(scenes, /folder\.value/, 'Scene rules support active-folder triggers.');
assert.match(framework, /workspaceState[\s\S]*flashInbox/, 'Unprocessed quick captures use a bounded namespaced workspace state.');
assert.match(framework, /Add tag|添加标签/, 'Quick capture offers tag post-processing.');
assert.match(framework, /recentOpened[\s\S]*recentPositions/, 'Continue working distinguishes open history and stores the last editor position.');
assert.match(calendar, /viewMode === 'week'/, 'Calendar can switch to a seven-day view.');
assert.match(calendar, /initialViewMode === 'week'/, 'Calendar initializes from the saved month/week preference.');
assert.match(calendar, /onViewModeChange\?\.\(viewMode\)/, 'Calendar reports month/week changes for persistence.');
assert.match(framework, /calendarViewMode[\s\S]*_setCalendarViewMode/, 'The selected calendar view is restored and persisted through plugin data.');
assert.match(framework, /field:'focusGap'/, 'Statistics exposes consecutive no-focus days as an action.');
assert.match(framework, /field:'tagBacklog'/, 'Statistics exposes the largest tag backlog as an action.');
assert.match(framework, /statsCardOrder:[\s\S]*hiddenStatsCards/, 'Statistics card order and visibility are stored with the active scene.');
assert.match(framework, /application\/x-cockpit-stat/, 'Statistics cards support edit-mode drag ordering.');
assert.match(framework, /const missingContent[\s\S]*next\.indexOf\('footer'\)/, 'New modules are inserted before the footer anchor without pinning existing modules.');
assert.match(framework, /moduleLabels:[\s\S]*_customModuleLabels/, 'Layout scenes persist editable module titles.');
assert.match(framework, /recent-tabs'[\s\S]*classList\.contains\(PLUGIN_ID \+ '-recent'\)/, 'Recent tabs and content belong to the same layout module.');
assert.match(calendar, /cal-indicators[\s\S]*cal-indicator-counts/, 'Calendar task and RSS counts share a non-overlapping indicator rail.');
assert.match(calendar, /cal-timeline-content[\s\S]*title:todo\.text/, 'Timeline keeps a single-row title with full text available on hover.');
assert.match(framework, /hm-cell[\s\S]*role','button'/, 'Heatmap days are keyboard-operable review entry points.');

console.log('Feature completeness checks passed');
