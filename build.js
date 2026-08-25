#!/usr/bin/env node
// build.js — 把 src/ 模块打包压缩为发布产物，输出到 dist/：
//   dist/main.js       esbuild 压缩后的插件入口（含内嵌压缩版 CSS）
//   dist/styles.css    esbuild 压缩后的样式
//   dist/main.js.map   本地调试用 sourcemap（不随 Release 上传）
// 仓库根目录的 src/ 与 styles.css 始终是可读源码，构建不会改写它们。

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'main.js');
const CSS_FILE = path.join(ROOT, 'styles.css');

let esbuild = null;
try { esbuild = require('esbuild'); } catch (e) { esbuild = null; }

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

function minifyCss(css) {
  if (!esbuild) return css;
  return esbuild.transformSync(css, {
    loader: 'css',
    minify: true,
    target: 'es2020',
    legalComments: 'none'
  }).code;
}

function minifyJs(code) {
  // 纯压缩不改语义：不开启顶层符号改写以外的转译，target es2020 覆盖现有语法。
  if (!esbuild) return null;
  const out = esbuild.transformSync(code, {
    loader: 'js',
    minify: true,
    target: 'es2020',
    legalComments: 'none',
    sourcemap: true,
    sourcefile: 'main.js'
  });
  if (out.map) fs.writeFileSync(path.join(OUT_DIR, 'main.js.map'), out.map);
  return out.map ? out.code + '\n//# sourceMappingURL=main.js.map' : out.code;
}

function writeAndReport(filePath, content, label) {
  fs.writeFileSync(filePath, content);
  const size = fs.statSync(filePath).size;
  const lines = content.split('\n').length;
  console.log(`✅ ${label}: ${filePath} (${size} bytes, ${lines} 行)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rawCss = readFileOrExit(CSS_FILE, 'styles.css');
  const moduleBodies = MODULES.map((name) => ({ name, code: loadModuleCode(name) }));

  // CSS：压缩后既作为独立发布资产写入 dist/，也作为字符串内嵌进 main.js。
  const minifiedCss = minifyCss(rawCss);
  fs.writeFileSync(path.join(OUT_DIR, 'styles.css'), minifiedCss);
  console.log(`✅ styles.css: ${Buffer.byteLength(rawCss)} -> ${Buffer.byteLength(minifiedCss)} 字节 (dist/)`);

  const bundle = buildBundle(minifiedCss, moduleBodies, 'pretty');
  const minified = minifyJs(bundle);
  if (minified) {
    writeAndReport(OUT_FILE, minified, '构建完成(压缩产物)');
    const ratio = ((1 - Buffer.byteLength(minified) / Buffer.byteLength(bundle)) * 100).toFixed(1);
    console.log(`ℹ️ esbuild JS 压缩率 ${ratio}%，sourcemap 已生成 dist/main.js.map`);
  } else {
    writeAndReport(OUT_FILE, bundle, '构建完成(未压缩回退)');
    console.log('⚠️ 未安装 esbuild（npm install 后重跑可获得压缩产物），本次 dist/main.js 为未压缩版本');
  }
}

main().catch((e) => {
  console.error('❌ 构建失败:', e);
  process.exit(1);
});
