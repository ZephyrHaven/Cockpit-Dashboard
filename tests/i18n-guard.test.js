#!/usr/bin/env node
// i18n-guard.test.js — 回归守卫：核心框架文件不得再用内联 `=== 'en' ? zh : en` 双语三元表达式，
// 统一走 constants.js 的 getText 文案表（_t / t）。历史上 _framework.js 散落 32 处硬编码双语，
// 已全部收口到 I18N.framework 段。本测试防止回退。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// 核心框架层文件：新代码不应在此写内联双语三元，应登记到 constants.js。
const coreFiles = ['_framework.js', 'dashboard-sections.js', 'onboarding.js', 'silent-refresh.js'];

const cnRe = /['"“][^'"”]*[\u4e00-\u9fff][^'"]*['"]/;
const ternaryRe = /=== 'en' \?/g;

for (const file of coreFiles) {
  const src = read('src/' + file);
  const hits = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (!/=== 'en' \?/.test(line)) return;
    // 只关心双语 UI 文案：同一行三元两侧同时出现中文字符串。
    if (cnRe.test(line)) hits.push((i + 1) + ': ' + line.trim());
  });
  assert.equal(
    hits.length, 0,
    file + ' 不应残留内联双语三元表达式（应改用 constants.js 文案表 _t/t）：\n' + hits.join('\n')
  );
}

// constants.js 必须提供 framework 文案段，且 zh / en 双语齐备。
const constants = read('src/constants.js');
assert.match(constants, /framework: \{/, 'constants.js 提供 framework 文案段。');
const frameworkBlocks = (constants.match(/framework: \{/g) || []).length;
assert.equal(frameworkBlocks, 2, 'framework 文案段在 zh 与 en 两个语言包中都要存在。');

// 关键键必须双语存在（防止单边遗漏）。
for (const key of ['completeAll', 'manageTips', 'saveTodosFail', 'desktopOnly']) {
  const occurrences = (constants.match(new RegExp(key + ':', 'g')) || []).length;
  assert.ok(occurrences >= 2, key + ' 在 zh/en 两包中都要定义。');
}

console.log('i18n guard checks passed');
