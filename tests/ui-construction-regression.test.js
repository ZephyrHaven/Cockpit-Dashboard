#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflows = fs.readFileSync(path.join(__dirname, '../src/workflows.js'), 'utf8');
const weeklyReport = fs.readFileSync(path.join(__dirname, '../src/weekly-report.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');

assert.doesNotMatch(workflows, /\.create(?:Label|Small)\s*\(/, 'UI construction must use supported createEl/createDiv/createSpan helpers.');
assert.match(workflows, /panel\.classList\.add\(PLUGIN_ID\+'-workflow-editor'\)/, 'Workflow editor must opt into the bounded scrolling layout.');
assert.match(workflows, /const revision = \+\+renderRevision;[\s\S]*if \(revision !== renderRevision\) return;[\s\S]*body\.empty\(\)/, 'Workflow module must discard stale async renders before mutating the DOM.');
assert.match(workflows, /openScheduledTaskEditor\(view, draft, \{ asNew:true \}\)/, 'Workflow scheduling must reuse the scheduled task editor with a new prefilled task.');
assert.match(styles, /\.cockpit-dashboard-scheduler-dialog\.cockpit-dashboard-workflow-editor\s*\{[^}]*overflow:hidden/s, 'Workflow editor shell must stay fixed instead of scrolling out of view.');
assert.match(styles, /\.cockpit-dashboard-workflow-steps\s*\{[^}]*overflow-y:auto/s, 'Only the workflow step list should scroll.');
assert.match(styles, /\.cockpit-dashboard-workflow-inline-toggle[^}]*\.cockpit-dashboard-workflow-switch/s, 'Inline step toggles must override generic field sizing.');

const actionsDeclaration = weeklyReport.indexOf("const actions = row.createDiv({ cls: PLUGIN_ID + '-report-studio-record-actions'");
const actionsBinding = weeklyReport.indexOf('actions.onpointerdown');
assert.ok(actionsDeclaration >= 0 && actionsBinding > actionsDeclaration, 'Report card actions must be created before event handlers are attached.');

console.log('UI construction regression checks passed');
