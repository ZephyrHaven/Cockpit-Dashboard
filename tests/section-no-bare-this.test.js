#!/usr/bin/env node
// section-no-bare-this.test.js — 静态守卫：section 类 free-function 模块不得残留裸 this。
//
// 背景：_framework.js 以 `cockpitBuildXxxSection(this, root, ctx)` 形式把视图实例作为
// 第一个「参数」传入——模块顶部是普通函数（bundle 顶 'use strict'），函数内 `this` 为
// undefined。若模块里误用 `this.xxx`（本意 `view.xxx`），运行时会抛
// "Cannot set properties of undefined"，_buildAll 中断、_renderDashboard 未解除
// -initializing，整页空白。此问题已在 todo-section / hero-section 上连续复发（P4/P5 后第 3 次）。
//
// 规则：把这些当作「纯 DOM 构建 free function」的 src 模块视为必须零 `this`
// （剥离注释与字符串/模板字面量后仍不得出现 `this` token）。
// custom-components.js 例外：其 `this` 属于函数内对象字面量的方法（真实接收者），
// 属合理用法，显式列入 ALLOWLIST。

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

// 合理使用 this（对象字面量/类方法接收者）的文件，显式豁免。
const ALLOWLIST = new Set(['custom-components.js']);

// 去注释 + 去字符串/模板字面量，保留换行以便报行号。
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && c2 === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'sq'; out += ' '; i++; continue; }
      if (c === '"') { state = 'dq'; out += ' '; i++; continue; }
      if (c === '`') { state = 'tpl'; out += ' '; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += '\n'; } i++; continue; }
    if (state === 'block') { if (c === '*' && c2 === '/') { state = 'code'; i += 2; } else { if (c === '\n') out += '\n'; i++; } continue; }
    if (state === 'sq') { if (c === '\\') { i += 2; continue; } if (c === "'") { state = 'code'; } i++; continue; }
    if (state === 'dq') { if (c === '\\') { i += 2; continue; } if (c === '"') { state = 'code'; } i++; continue; }
    if (state === 'tpl') { if (c === '\\') { i += 2; continue; } if (c === '`') { state = 'code'; } i++; continue; }
  }
  return out;
}

// 该文件是否声明了顶层 `function/async function cockpitBuild*` free function。
function declaresBuildFreeFunction(src) {
  return /^(?:async\s+)?function\s+cockpitBuild[A-Za-z0-9_]*\s*\(/m.test(src);
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const failures = [];
const checked = [];

for (const f of files) {
  if (ALLOWLIST.has(f)) continue;
  const full = path.join(SRC, f);
  const raw = fs.readFileSync(full, 'utf8');
  if (!declaresBuildFreeFunction(raw)) continue;
  checked.push(f);

  const stripped = stripCommentsAndStrings(raw);
  const lines = stripped.split('\n');
  const rawLines = raw.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const re = /\bthis\b/g;
    let m;
    while ((m = re.exec(lines[li]))) {
      failures.push({
        file: f,
        line: li + 1,
        snippet: (rawLines[li] || '').trim().slice(0, 160),
      });
    }
  }
}

let ok = true;
console.log('section-no-bare-this: 检查 free-function 模块 ' + checked.length + ' 个');
console.log('  ' + checked.join(', '));

if (failures.length) {
  ok = false;
  console.error('\n❌ 检测到 section free-function 模块内的裸 this（应为 view）：');
  for (const fx of failures) {
    console.error(`  src/${fx.file}:${fx.line}  ${fx.snippet}`);
  }
  console.error('\n修复：把 this.xxx / this.yyy 改为 view.xxx / view.yyy。');
  console.error('（若确属对象字面量方法的合法 this，请把该文件加入 ALLOWLIST 并说明理由。）');
}

// 冒烟守卫：确认已知核心文件确实被纳入检查，防止匹配规则失效导致「假绿」。
const MUST_INCLUDE = ['dashboard-sections.js', 'hero-section.js', 'todo-section.js'];
const missing = MUST_INCLUDE.filter((f) => !checked.includes(f));
if (missing.length) {
  ok = false;
  console.error('\n❌ 未纳入检查的核心文件（匹配规则可能失效）: ' + missing.join(', '));
}

if (!ok) process.exit(1);
console.log('\n✅ section free-function 模块均无裸 this');
process.exit(0);
