#!/usr/bin/env node
// build.js — 把 src/ 下的模块打包成 main.js，并额外产出压缩版 main.min.js

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'src');
const OUT_FILE = path.join(ROOT, 'main.js');
const MIN_OUT_FILE = path.join(ROOT, 'main.min.js');
const CSS_FILE = path.join(ROOT, 'styles.css');

const MODULES = [
  'constants.js',
  'data-store.js',
  'ai-index.js',
  'ai-context.js',
  'ai-history.js',
  'ai-local-tools.js',
  'ai-workspace.js',
  'ai-tools.js',
  'ai.js',
  'ai-quick.js',
  'flash-ai.js',
  'ai-dialogs.js',
  'ai-view.js',
  'ai-settings.js',
  'ai-launcher.js',
  'daily-tips.js',
  'tip-store.js',
  'utils.js',
  'todos.js',
  'todo-focus.js',
  'focus-insights.js',
  'share-card.js',
  'habits-core.js',
  'habits.js',
  'weekly-review.js',
  'projects.js',
  'resurface.js',
  'morning-brief.js',
  'serverchan.js',
  'bookmarks.js',
  'storage.js',
  'rss.js',
  'lunar.js',
  'calendar.js',
  'search.js',
  'toolbar-config.js',
  'toolbar-custom.js',
  'toolbar.js',
  'scenes.js',
  'scheduled-tasks.js',
  'alarm-core.js',
  'alarm.js',
  'agenda.js',
  'pomodoro.js',
  'focus-chart.js',
  'release-notes-core.js',
  'release-notes.js',
  '_framework.js'
];

function readFileOrExit(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error(`❌ 读取 ${label} 失败:`, e.message);
    process.exit(1);
  }
}

function loadModuleCode(mod) {
  const filePath = path.join(SRC_DIR, mod);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 缺少模块: ${mod}`);
    process.exit(1);
  }
  let code = readFileOrExit(filePath, mod).trim().replace(/^'use strict';\s*/gm, '');
  if (mod === 'daily-tips.js') {
    const defaults = readFileOrExit(path.join(SRC_DIR, 'data', 'daily-tips.default.json'), 'daily tips defaults');
    try {
      code = code.replace('__DAILY_TIPS_DEFAULTS__', JSON.stringify(JSON.parse(defaults)));
    } catch (e) {
      console.error('❌ daily-tips.default.json 格式无效:', e.message);
      process.exit(1);
    }
  }
  if (mod === 'rss.js') {
    const defaults = readFileOrExit(path.join(SRC_DIR, 'data', 'rss-filter-defaults.json'), 'RSS filter defaults');
    try {
      code = code.replace('__RSS_FILTER_DEFAULTS__', JSON.stringify(JSON.parse(defaults)));
    } catch (e) {
      console.error('❌ rss-filter-defaults.json 格式无效:', e.message);
      process.exit(1);
    }
  }
  return code;
}

function buildBundle(css, moduleBodies, mode) {
  if (mode === 'pretty') {
    const parts = moduleBodies.map(({ name, code }) => `// ===== ${name} =====\n${code}`);
    return `'use strict';
var obs = require('obsidian');

// ===== styles.css =====
const CSS = ${JSON.stringify(css)};

// ===== modules =====
${parts.join('\n\n')}
`;
  }

  const compactCss = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
  const compactModules = moduleBodies
    .map(({ code }) => code
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() && !line.trim().startsWith('//'))
      .join('\n'))
    .join('\n');
  return `'use strict';var obs=require('obsidian');const CSS=${JSON.stringify(compactCss)};\n${compactModules}\n`;
}

async function tryMinifyWithTool(code) {
  try {
    const terser = require('terser');
    const result = await terser.minify(code, {
      compress: true,
      mangle: true,
      format: { comments: false }
    });
    if (result && result.code) return { code: result.code, tool: 'terser' };
  } catch (e) {}
  return null;
}

function writeAndReport(filePath, content, label) {
  fs.writeFileSync(filePath, content);
  const size = fs.statSync(filePath).size;
  const lines = content.split('\n').length;
  console.log(`✅ ${label}: ${filePath} (${size} bytes, ${lines} 行)`);
}

async function main() {
  const css = readFileOrExit(CSS_FILE, 'styles.css');
  const moduleBodies = MODULES.map((name) => ({ name, code: loadModuleCode(name) }));

  const prettyOutput = buildBundle(css, moduleBodies, 'pretty');
  writeAndReport(OUT_FILE, prettyOutput, '构建完成');

  const toolMinified = await tryMinifyWithTool(prettyOutput);
  if (toolMinified) {
    writeAndReport(MIN_OUT_FILE, toolMinified.code, `压缩构建完成 (${toolMinified.tool})`);
    return;
  }

  const compactOutput = buildBundle(css, moduleBodies, 'compact');
  writeAndReport(MIN_OUT_FILE, compactOutput, '压缩构建完成 (fallback compact)');
  console.log('ℹ️ 未检测到 terser，main.min.js 使用内置轻量压缩模式');
}

main().catch((e) => {
  console.error('❌ 构建失败:', e);
  process.exit(1);
});
