#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = require('../src/weekly-report.js');

const zh = api.weeklyReportAiPrompt('executive', false);
assert.match(zh, /管理者/);
assert.match(zh, /保留全部事实/);
assert.match(zh, /不得编造/);
assert.match(zh, /只输出优化后的周报正文/);

const en = api.weeklyReportAiPrompt('concise', true);
assert.match(en, /concise/i);
assert.match(en, /Preserve all facts/);
assert.match(en, /Do not invent/);
assert.match(en, /Return only the revised report/);
assert.equal(api.WEEKLY_REPORT_AI_HISTORY_CHARS <= 8000, true, 'History excerpts stay within the shared per-message limit.');

let selectedId = null;
selectedId = api.weeklyReportNextSelectedId(selectedId, 'record-a');
assert.equal(selectedId, 'record-a', 'Clicking a collapsed record expands it.');
selectedId = api.weeklyReportNextSelectedId(selectedId, 'record-a');
assert.equal(selectedId, null, 'Clicking the expanded record collapses it.');
selectedId = api.weeklyReportNextSelectedId(selectedId, 'record-a');
assert.equal(selectedId, 'record-a', 'The same record can be expanded again after collapsing.');
selectedId = api.weeklyReportNextSelectedId(selectedId, 'record-b');
assert.equal(selectedId, 'record-b', 'Clicking another record switches the expanded card.');

const source = fs.readFileSync(path.join(__dirname, '../src/weekly-report.js'), 'utf8');
assert.match(source, /completeStream\(/, 'The preview reuses the shared streaming AI service.');
assert.match(source, /Save original/);
assert.match(source, /Save AI version/);
assert.match(source, /cockpitEmit\('weekly-report-saved'/, 'Saving a report emits a reusable internal event.');
assert.match(source, /abortController\?\.abort\(\)/, 'Closing or stopping the workbench aborts the active request.');
assert.match(source, /row\.onclick = \(event\) =>/, 'The full record summary row controls expand and collapse.');
assert.doesNotMatch(source, /if \(isActive\) \{\s*state\.selectedId = null;/, 'The click handler never relies on stale render-time expansion state.');

const styles = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
assert.match(styles, /report-compare[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/s);
assert.match(styles, /report-version textarea[^}]*overflow:auto/s, 'Each report version owns its scrolling area.');
assert.match(styles, /report-preview[^}]*overflow:hidden/s, 'The workbench does not rely on an outer scrolling modal.');

console.log('Weekly report AI workbench checks passed');
