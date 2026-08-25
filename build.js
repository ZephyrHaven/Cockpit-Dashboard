#!/usr/bin/env node
// build.js — 把 src/ 下的模块打包成 main.js

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'src');
const OUT_FILE = path.join(ROOT, 'main.js');
const CSS_FILE = path.join(ROOT, 'styles.css');

const MODULES = [
  'constants.js',
  'utils.js',
  'todos.js',
  'bookmarks.js',
  'calendar.js',
  'search.js',
  'pomodoro.js',
  '_framework.js'
];

let css;
try {
  css = fs.readFileSync(CSS_FILE, 'utf8');
} catch (e) {
  console.error('❌ 读取 styles.css 失败:', e.message);
  process.exit(1);
}

const parts = [];
for (const mod of MODULES) {
  const filePath = path.join(SRC_DIR, mod);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 缺少模块: ${mod}`);
    process.exit(1);
  }
  let code = fs.readFileSync(filePath, 'utf8').trim();
  code = code.replace(/^'use strict';\s*/gm, '');
  parts.push(`// ===== ${mod} =====\n${code}`);
}

const output = `'use strict';
var obsidian = require('obsidian');

// ===== styles.css =====
const CSS = ${JSON.stringify(css)};

// ===== modules =====
${parts.join('\n\n')}
`;

fs.writeFileSync(OUT_FILE, output);
const outSize = fs.statSync(OUT_FILE).size;
const outLines = output.split('\n').length;
console.log(`✅ 构建完成: ${OUT_FILE} (${outSize} bytes, ${outLines} 行)`);
