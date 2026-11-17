// perf-trace.js — 极轻量的性能自观测工具：记录渲染 / 模块构建 / 静默刷新的耗时。
// 设计约束：纯内存、无依赖、不落盘、绝不进入网络；埋点失败绝不影响主流程
//（与 cockpit-events.js 同一哲学：观测器异常不影响被观测对象）。

const COCKPIT_PERF_MAX_SAMPLES = 400;

const cockpitPerfState = {
  samples: [],       // { label, ms, at }
  marks: new Map(),  // name -> timestamp（performance.now）
  moduleBuilds: [],  // { module, ms } 最近一次 _buildAll 各模块耗时
  refreshEvents: [], // { scopes:[], filesRead, at } 静默刷新热力数据（环形）
};

function cockpitPerfNow() {
  try { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  catch (e) { return Date.now(); }
}

// 标记起点；随后用 cockpitPerfEnd(name, label) 结算。
function cockpitPerfMark(name) {
  try { cockpitPerfState.marks.set(String(name), cockpitPerfNow()); } catch (e) {}
}

// 结算某个标记，记录一条样本。label 缺省用 name。
function cockpitPerfEnd(name, label) {
  try {
    const start = cockpitPerfState.marks.get(String(name));
    if (start == null) return null;
    cockpitPerfState.marks.delete(String(name));
    const ms = cockpitPerfNow() - start;
    cockpitPerfRecord(label || name, ms);
    return ms;
  } catch (e) { return null; }
}

// 直接记录一条耗时样本（环形缓冲，超出丢弃最旧）。
function cockpitPerfRecord(label, ms) {
  try {
    const value = Number(ms);
    if (!isFinite(value) || value < 0) return;
    const sample = { label: String(label || 'unknown'), ms: value, at: Date.now() };
    cockpitPerfState.samples.push(sample);
    if (cockpitPerfState.samples.length > COCKPIT_PERF_MAX_SAMPLES) cockpitPerfState.samples.shift();
  } catch (e) {}
}

// 包裹一次同步/异步调用并计时；无论成功失败都记录，异常照常抛出。
async function cockpitPerfMeasure(label, fn) {
  const start = cockpitPerfNow();
  try { return await fn(); }
  finally { cockpitPerfRecord(label, cockpitPerfNow() - start); }
}

// 记录 _buildAll 中单个模块的构建耗时（每轮渲染开始前先 reset）。
function cockpitPerfResetModuleBuilds() {
  try { cockpitPerfState.moduleBuilds = []; } catch (e) {}
}
function cockpitPerfRecordModule(module, ms) {
  try {
    const value = Number(ms);
    if (!isFinite(value) || value < 0) return;
    cockpitPerfState.moduleBuilds.push({ module: String(module || 'unknown'), ms: value });
  } catch (e) {}
}

// 汇总视图（供诊断面板只读展示）：
//   - firstPaint：最近一次整页渲染（_renderDashboard）耗时
//   - slowestModules：本轮各模块构建耗时降序 Top N
//   - slowestLabels：所有样本按标签聚合的均值/次数，找出最慢/最常刷新的标签
//   - refresh：静默刷新循环样本统计
function cockpitPerfSummary(topN = 8) {
  const byLabel = new Map();
  cockpitPerfState.samples.forEach((s) => {
    const entry = byLabel.get(s.label) || { label: s.label, count: 0, total: 0, max: 0 };
    entry.count += 1; entry.total += s.ms; if (s.ms > entry.max) entry.max = s.ms;
    byLabel.set(s.label, entry);
  });
  const labels = Array.from(byLabel.values()).map((e) => ({ label: e.label, count: e.count, avg: e.total / e.count, max: e.max }))
    .sort((a, b) => b.avg - a.avg);
  const paint = cockpitPerfState.samples.filter((s) => s.label === 'renderDashboard').slice(-1)[0] || null;
  const refreshSamples = cockpitPerfState.samples.filter((s) => s.label === 'silentRefresh');
  const refresh = refreshSamples.length
    ? { count: refreshSamples.length, avg: refreshSamples.reduce((a, s) => a + s.ms, 0) / refreshSamples.length, max: Math.max(...refreshSamples.map((s) => s.ms)) }
    : null;
  return {
    firstPaintMs: paint ? paint.ms : null,
    slowestModules: cockpitPerfState.moduleBuilds.slice().sort((a, b) => b.ms - a.ms).slice(0, topN),
    slowestLabels: labels.slice(0, topN),
    refresh,
    sampleCount: cockpitPerfState.samples.length,
  };
}


// 记录一次静默刷新的热力数据：触发 scope 列表 + 期间读了多少文件。
function cockpitPerfRecordRefresh(scopeNames, filesRead) {
  try {
    const scopes = Array.isArray(scopeNames) ? scopeNames.map((s) => String(s)) : [];
    const files = Number(filesRead) || 0;
    cockpitPerfState.refreshEvents.push({ scopes, filesRead: files, at: Date.now() });
    if (cockpitPerfState.refreshEvents.length > COCKPIT_PERF_MAX_SAMPLES) cockpitPerfState.refreshEvents.shift();
  } catch (e) {}
}

// 热力图汇总：每个 scope 被触发的次数；最常读文件的刷新次数分布；总文件读取量。
function cockpitPerfRefreshHeat(topN = 8) {
  const scopeCounts = new Map();
  let totalFiles = 0;
  cockpitPerfState.refreshEvents.forEach((ev) => {
    totalFiles += ev.filesRead;
    (ev.scopes.length ? ev.scopes : ['(none)']).forEach((scope) => scopeCounts.set(scope, (scopeCounts.get(scope) || 0) + 1));
  });
  const scopes = Array.from(scopeCounts.entries()).map(([scope, count]) => ({ scope, count })).sort((a, b) => b.count - a.count);
  return {
    eventCount: cockpitPerfState.refreshEvents.length,
    totalFiles,
    avgFiles: cockpitPerfState.refreshEvents.length ? totalFiles / cockpitPerfState.refreshEvents.length : 0,
    scopes: scopes.slice(0, topN),
  };
}

function cockpitPerfReset() {
  try { cockpitPerfState.samples = []; cockpitPerfState.marks.clear(); cockpitPerfState.moduleBuilds = []; cockpitPerfState.refreshEvents = []; } catch (e) {}
}
