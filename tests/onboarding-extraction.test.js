#!/usr/bin/env node
// onboarding-extraction.test.js — 回归守卫：首次使用引导已拆到 onboarding.js，
// _framework.js 只保留薄委托。防止引导逻辑被重新堆回 God 文件，或委托与方法名脱节。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const framework = read('src/_framework.js');
const onboardingPath = path.join(root, 'src', 'onboarding.js');
assert.ok(fs.existsSync(onboardingPath), 'onboarding.js exists as its own module.');
const onboarding = read('src/onboarding.js');
const build = read('build.js');

// 1) 模块必须注册到 build.js 的 MODULES，且在 _framework.js 之前拼接。
assert.ok(build.includes("'onboarding.js'"), 'onboarding.js is registered in build.js MODULES.');
assert.ok(
  build.indexOf("'onboarding.js'") < build.indexOf("'_framework.js'"),
  'onboarding.js is concatenated before _framework.js.'
);

// 2) onboarding.js 导出四个 cockpit 函数实现。
for (const fn of ['cockpitMarkOnboardingDone', 'cockpitCloseWelcomeCover', 'cockpitShowWelcomeCover', 'cockpitShowOnboarding']) {
  assert.match(onboarding, new RegExp('function ' + fn + '\\('), fn + ' is implemented in onboarding.js.');
}

// 3) _framework.js 的四个方法名保留为薄委托，且不再携带引导实现主体。
const delegators = {
  '_markOnboardingDone': 'cockpitMarkOnboardingDone(this)',
  '_closeWelcomeCover': 'cockpitCloseWelcomeCover(this)',
  '_showWelcomeCover': 'cockpitShowWelcomeCover(this, root)',
  '_showOnboarding': 'cockpitShowOnboarding(this, root)',
};
for (const [method, call] of Object.entries(delegators)) {
  assert.ok(
    framework.includes(method + '(root) { ' + call) || framework.includes(method + '() { ' + call),
    method + ' delegates to onboarding.js.'
  );
}

// 4) 引导主体不应再出现在 _framework.js（welcome-backdrop 只在 onboarding.js 构建）。
assert.doesNotMatch(framework, /-welcome-backdrop/, 'Welcome cover DOM is built in onboarding.js, not _framework.js.');
assert.match(onboarding, /-welcome-backdrop/, 'onboarding.js owns the welcome cover DOM.');

// 5) 不允许再次出现重复的 _closeWelcomeCover 定义（历史上曾有一处孤立的重复实现）。
const closeDefs = (framework.match(/\n  _closeWelcomeCover\(\)/g) || []).length;
assert.equal(closeDefs, 1, 'Exactly one _closeWelcomeCover definition remains in _framework.js (the delegator).');

console.log('Onboarding extraction checks passed');
