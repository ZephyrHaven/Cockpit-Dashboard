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
  'ai-vault-tools.js',
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
  'cockpit-events.js',
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
  'workflows.js',
  'weekly-report.js',
  'alarm-core.js',
  'alarm.js',
  'agenda.js',
  'pomodoro.js',
  'focus-chart.js',
  'release-notes-core.js',
  'release-notes.js',
  'toolbar-defs.js',
  'layout-edit.js',
  'silent-refresh.js',
  'commands.js',
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

function buildBundle(moduleBodies) {
  const parts = moduleBodies.map(({ name, code }) => `// ===== ${name} =====\n${code}`);
  return `'use strict';
var obs = require('obsidian');

// ===== modules =====
${parts.join('\n\n')}
`;
}

function minifyCss(css) {
  // 多引擎竞争：esbuild 与 lightningcss 各压一遍，取更小结果。
  const candidates = [];
  if (esbuild) {
    try {
      candidates.push(esbuild.transformSync(css, {
        loader: 'css', minify: true, target: 'es2020', legalComments: 'none'
      }).code);
    } catch (e) { console.warn('esbuild CSS 压缩失败:', e.message); }
  }
  try {
    const lightningcss = require('lightningcss');
    const out = lightningcss.transform({ filename: 'styles.css', code: Buffer.from(css), minify: true });
    candidates.push(out.code.toString('utf8'));
  } catch (e) { /* 未安装则跳过 */ }
  if (!candidates.length) return css;
  return candidates.reduce((a, b) => (Buffer.byteLength(b) < Buffer.byteLength(a) ? b : a));
}

async function minifyJsBest(bundle) {
  // 极致压缩：多引擎各跑一遍取最小。只求机器可读；可读源码始终在 src/。
  const jobs = [];
  if (esbuild) {
    jobs.push((async () => {
      const out = esbuild.transformSync(bundle, {
        loader: 'js', minify: true, target: 'es2020', legalComments: 'none',
        sourcemap: true, sourcefile: 'main.js'
      });
      return { engine: 'esbuild', code: out.code, map: out.map };
    })().catch((e) => { console.warn('esbuild JS 压缩失败:', e.message); return null; }));
  }
  jobs.push((async () => {
    let terser = null;
    try { terser = require('terser'); } catch (e) { return null; }
    const result = await terser.minify(bundle, {
      compress: {
        passes: 3,
        unsafe: true,
        // 剥离调试日志（保留 warn/error），不影响任何运行行为
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: { toplevel: true },
      format: { comments: false },
      sourceMap: false
    });
    return result.code ? { engine: 'terser', code: result.code, map: null } : null;
  })().catch((e) => { console.warn('terser 压缩失败:', e.message); return null; }));

  const results = (await Promise.all(jobs)).filter(Boolean);
  if (!results.length) return null;
  return results.reduce((a, b) => (Buffer.byteLength(b.code) < Buffer.byteLength(a.code) ? b : a));
}

function writeAndReport(filePath, content, label) {
  fs.writeFileSync(filePath, content);
  const size = fs.statSync(filePath).size;
  const lines = content.split('\n').length;
  console.log(`✅ ${label}: ${filePath} (${size} bytes, ${lines} 行)`);
}

// ===== 体积治理 =====
// 产物是单文件分发（宿主商店只下发 main.js/styles.css/manifest.json 三个文件，
// 无法拆分为多个 JS 分片），体积只能靠源头治理。这里让每个模块的体积占比
// 在每次构建时可见，并用预算线拦截失控增长：新功能合入时一眼看出谁在变胖。
const SIZE_BUDGET = { warnBytes: 700 * 1024, failBytes: 1024 * 1024 };

function reportModuleSizes(moduleBodies) {
  const rows = moduleBodies
    .map(({ name, code }) => ({ name, bytes: Buffer.byteLength(code) }))
    .sort((a, b) => b.bytes - a.bytes);
  const total = rows.reduce((sum, row) => sum + row.bytes, 0);
  console.log('📦 模块体积 TOP10（拼接前源码）：');
  rows.slice(0, 10).forEach(({ name, bytes }, index) => {
    const pct = ((bytes / total) * 100).toFixed(1).padStart(4);
    console.log(`   ${String(index + 1).padStart(2)}. ${name.padEnd(24)} ${ (bytes / 1024).toFixed(1).padStart(7)} KB  ${pct}%`);
  });
  console.log(`   合计 ${(total / 1024).toFixed(1)} KB（${rows.length} 个模块）`);
}

function checkSizeBudget(finalBytes) {
  const kb = (finalBytes / 1024).toFixed(1);
  if (finalBytes > SIZE_BUDGET.failBytes) {
    console.error(`❌ JS 产物 ${kb} KB 超过硬上限 ${SIZE_BUDGET.failBytes / 1024} KB：先做体积治理（拆分插件/裁剪功能）再发布`);
    process.exitCode = 1;
  } else if (finalBytes > SIZE_BUDGET.warnBytes) {
    console.warn(`⚠️ JS 产物 ${kb} KB 已超过预算告警线 ${SIZE_BUDGET.warnBytes / 1024} KB，新增功能请同步评估体积`);
  } else {
    console.log(`📦 体积预算: ${kb} KB / 告警 ${SIZE_BUDGET.warnBytes / 1024} KB / 上限 ${SIZE_BUDGET.failBytes / 1024} KB ✅`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rawCss = readFileOrExit(CSS_FILE, 'styles.css');
  const moduleBodies = MODULES.map((name) => ({ name, code: loadModuleCode(name) }));

  // CSS：压缩后既作为独立发布资产写入 dist/，也作为字符串内嵌进 main.js。
  const minifiedCss = minifyCss(rawCss);
  fs.writeFileSync(path.join(OUT_DIR, 'styles.css'), minifiedCss);
  console.log(`✅ styles.css: ${Buffer.byteLength(rawCss)} -> ${Buffer.byteLength(minifiedCss)} 字节 (dist/)`);

  // CSS 不再内嵌进 main.js：宿主会自动加载插件目录的 styles.css，
  // 视图侧仅保留 _ensureStylesheetLoaded() 兜底探测。
  const bundle = buildBundle(moduleBodies);
  reportModuleSizes(moduleBodies);
  const best = await minifyJsBest(bundle);
  if (best) {
    fs.writeFileSync(path.join(OUT_DIR, 'main.js.map'), best.map || '');
    writeAndReport(OUT_FILE, best.map ? best.code + '\n//# sourceMappingURL=main.js.map' : best.code, `构建完成(压缩产物, ${best.engine})`);
    const ratio = ((1 - Buffer.byteLength(best.code) / Buffer.byteLength(bundle)) * 100).toFixed(1);
    console.log(`ℹ️ 胜出引擎: ${best.engine}，JS 压缩率 ${ratio}%`);
    checkSizeBudget(Buffer.byteLength(best.code));
  } else {
    writeAndReport(OUT_FILE, bundle, '构建完成(未压缩回退)');
    console.log('⚠️ 未安装任何压缩引擎（npm install 后重跑），本次 dist/main.js 为未压缩版本');
    checkSizeBudget(Buffer.byteLength(bundle));
  }
}

main().catch((e) => {
  console.error('❌ 构建失败:', e);
  process.exit(1);
});
