#!/usr/bin/env node
// run-all.js — 依次运行 tests/ 下全部 *.test.js，汇总结果。
// 已知历史失败基线：ai-context / notification-channels / p0-regression / release-notes / today-focus
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();
let pass = 0, fail = 0; const failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 120000 });
  if (r.status === 0) { pass++; console.log(`  ✅ ${f}`); }
  else { fail++; failed.push(f); console.log(`  ❌ ${f}`); }
}
console.log(`\n通过 ${pass} / 失败 ${fail}`);
if (failed.length) { console.log('失败列表:', failed.join(', ')); process.exit(1); }
