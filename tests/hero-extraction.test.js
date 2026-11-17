#!/usr/bin/env node
// hero-extraction.test.js — 回归守卫：Hero 首屏区块（语言/情景切换、问候昵称编辑、今日概览）
// 已拆到 hero-section.js，_framework.js 只保留一行委托调用。防止 Hero 逻辑被重新堆回 God 文件。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const framework = read('src/_framework.js');
const heroPath = path.join(root, 'src', 'hero-section.js');
assert.ok(fs.existsSync(heroPath), 'hero-section.js exists as its own module.');
const hero = read('src/hero-section.js');
const build = read('build.js');

// 1) 模块必须注册到 build.js 的 MODULES，且在 _framework.js 之前拼接。
assert.ok(build.includes("'hero-section.js'"), 'hero-section.js is registered in build.js MODULES.');
assert.ok(
  build.indexOf("'hero-section.js'") < build.indexOf("'_framework.js'"),
  'hero-section.js is concatenated before _framework.js.'
);

// 2) hero-section.js 导出 cockpitBuildHeroSection 实现。
assert.match(hero, /function cockpitBuildHeroSection\(view, root, ctx\)/, 'cockpitBuildHeroSection is implemented in hero-section.js.');

// 3) _framework.js 只保留一行委托，且 ctx 传入 t/lang/now/days/gr。
assert.match(
  framework,
  /cockpitBuildHeroSection\(this, root, \{ t, lang, now, days, gr \}\);/,
  '_framework.js delegates to hero-section.js with the shared build context.'
);

// 4) Hero 主体 DOM 不应再出现在 _framework.js（-hero 容器只在 hero-section.js 构建）。
assert.doesNotMatch(framework, /PLUGIN_ID\+'-hero' \}, el =>/, 'Hero DOM must be built in hero-section.js, not _framework.js.');
assert.match(hero, /PLUGIN_ID\+'-hero' \}, el =>/, 'hero-section.js owns the hero container DOM.');

// 5) _refreshHeroReminder 的绑定在拆分后的 hero-section 尾部完成，_framework.js 不得残留旧的原地绑定行。
assert.doesNotMatch(framework, /this\._refreshHeroReminder = this\._refreshHeroSection\.bind\(this\);/, 'The hero reminder bind moves into hero-section.js.');

console.log('Hero extraction checks passed');
