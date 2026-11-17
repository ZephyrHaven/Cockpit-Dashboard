#!/usr/bin/env node
// module-registry-reverse.test.js — 反向守卫：_moduleRegistry() 里每个模块的 matches 谓词所引用的
// DOM 标识（class 后缀 / dataset.section 值）必须真的在某个模块源码里被产出。
// 这能抓住最容易发生、又最隐蔽的「布局/拖拽/折叠/情景静默失效」——改了某个模块的 class 或 section
// 名，但忘了同步 matches 谓词，导致该模块再也匹配不上、上述能力对它整体失效却不报错。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '../src');
const read = (name) => fs.readFileSync(path.join(srcDir, name), 'utf8');

const framework = read('_framework.js');

// 1) 从 _moduleRegistry() 中截取注册表主体。
const regStart = framework.indexOf('_moduleRegistry()');
assert.ok(regStart > 0, 'The view exposes _moduleRegistry().');
const regEnd = framework.indexOf('_defaultModuleOrder()', regStart);
const registry = framework.slice(regStart, regEnd > regStart ? regEnd : regStart + 6000);

// 汇总所有模块源码，作为「DOM 标识真实存在」的证据库。
// 关键：注册表本身就是 _framework.js 的一部分，若把它算进证据库，任何 token 都会「找到自己」，
// 反向校验就永远通过。因此先把注册表段从 _framework.js 证据里剔除。
const frameworkEvidence = framework.slice(0, regStart) + framework.slice(regEnd > regStart ? regEnd : regStart + 6000);
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js'));
const allSource = files
  .map((f) => (f === '_framework.js' ? frameworkEvidence : read(f)))
  .join('\n');

// 2) 逐个注册条目提取 id 与其 matches 内的所有标识 token。
//    条目形如 { id:'xxx', ... matches:(el) => ... }
const entryRe = /\{ id:'([a-zA-Z]+)'[\s\S]*?matches:\s*\(el\)\s*=>([\s\S]*?)(?=\n\s*\{ id:|\n\s*\.\.\.\(|\n\s*\];)/g;
const entries = [];
let m;
while ((m = entryRe.exec(registry))) {
  const id = m[1];
  const body = m[2];
  const classTokens = [];
  const sectionTokens = [];
  // class 后缀：PLUGIN_ID + '-xxx' 或 PLUGIN_ID+'-xxx'
  let c;
  const classRe = /PLUGIN_ID\s*\+\s*'(-[a-zA-Z0-9-]+)'/g;
  while ((c = classRe.exec(body))) classTokens.push(c[1]);
  // dataset.section 值
  let s;
  const sectionRe = /dataset\.section\s*===\s*'([a-zA-Z0-9-]+)'/g;
  while ((s = sectionRe.exec(body))) sectionTokens.push(s[1]);
  entries.push({ id, classTokens, sectionTokens });
}

assert.ok(entries.length >= 15, 'Registry parses at least 15 modules (found ' + entries.length + ').');

const problems = [];
for (const entry of entries) {
  assert.ok(
    entry.classTokens.length + entry.sectionTokens.length > 0,
    'Module "' + entry.id + '" has at least one recognizable DOM matcher.'
  );
  for (const suffix of entry.classTokens) {
    // 该 class 后缀必须作为 '-suffix' 字面量出现在某个源码里（PLUGIN_ID + '-suffix' 或纯字符串）。
    const needle = "'" + suffix + "'";
    if (!allSource.includes(needle)) {
      problems.push('module "' + entry.id + '" matches class ' + suffix + ' but no source emits ' + needle);
    }
  }
  for (const section of entry.sectionTokens) {
    const needle = "'" + section + "'";
    if (!allSource.includes(needle)) {
      problems.push('module "' + entry.id + '" matches dataset.section=' + section + ' but no source emits ' + needle);
    }
  }
}

assert.deepEqual(problems, [], 'Every registered module matches only DOM tokens that some source actually produces:\n' + problems.join('\n'));

// 3) 每个注册 id 还必须出现在默认排序里，否则布局能力默认就丢了它。
const defaultOrder = framework.slice(framework.indexOf('_defaultModuleOrder()'));
for (const entry of entries) {
  // 纯自定义/动态注册（customComponentRegistry 返回）不计入默认排序。
  if (entry.id === 'recent') continue;
  assert.ok(
    defaultOrder.includes("'" + entry.id + "'"),
    'Middle-priority: module "' + entry.id + '" is registered but absent from _defaultModuleOrder().'
  );
}

console.log('Module registry reverse checks passed (' + entries.length + ' modules)');
