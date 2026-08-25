#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/search.js', 'utf8');
const context = { obsidian: { Modal: class {} }, PLUGIN_ID: 'cockpit-dashboard', DEFAULT_LANG: 'zh' };
vm.createContext(context);
vm.runInContext(source + '\nthis.rankSearchFiles = rankSearchFiles;', context);

const files = [
  { path: 'work/project/weekly-plan.md', basename: 'Plan weekly', stat: { mtime: 10 } },
  { path: 'archive/plan-notes.md', basename: '旧笔记', stat: { mtime: 99 } },
  { path: 'daily/2026-07-16.md', basename: '日记', stat: { mtime: 100 } }
];

const ranked = context.rankSearchFiles(files, 'plan');
assert.deepEqual(ranked.map((file) => file.path), ['work/project/weekly-plan.md', 'archive/plan-notes.md']);
assert.equal(context.rankSearchFiles(files, '   ').length, 0);
assert.match(source, /_contentCache/, 'Content reads are cached while the modal remains open.');
assert.match(source, /_queryCache/, 'Repeated queries reuse completed results.');
console.log('Search ranking checks passed');
