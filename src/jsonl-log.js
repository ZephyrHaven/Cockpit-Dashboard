// jsonl-log.js — 插件私有 JSONL 运行日志：异步追加、按文件串行、超限才整理。
// 取代「每写一条就同步读全文件再整体重写」的做法，避免阻塞界面线程。

const COCKPIT_JSONL_QUEUES = new Map();
const COCKPIT_JSONL_COUNTS = new Map();

function cockpitPluginLogDir(app, manifest) {
  const path = require('path');
  const base = app.vault.adapter.getBasePath();
  const pluginDir = manifest && manifest.dir ? manifest.dir : [app.vault.configDir, 'plugins', PLUGIN_ID].join('/');
  return path.join(base, pluginDir, 'logs');
}

function cockpitTrimJsonlRows(rows, limit, maxBytes) {
  let next = rows.filter(Boolean).slice(-limit);
  let bytes = Buffer.byteLength(next.join('\n'), 'utf8');
  while (bytes > maxBytes && next.length > 1) { bytes -= Buffer.byteLength(next[0], 'utf8') + 1; next = next.slice(1); }
  return next;
}

function cockpitAppendJsonl(file, record, options = {}) {
  const limit = Math.max(1, options.limit || 500);
  const maxBytes = Math.max(1024, options.maxBytes || 1024 * 1024);
  const previous = COCKPIT_JSONL_QUEUES.get(file) || Promise.resolve();
  const job = previous.catch(() => {}).then(async () => {
    const fsp = require('fs').promises; const path = require('path');
    await fsp.mkdir(path.dirname(file), { recursive:true });
    if (!COCKPIT_JSONL_COUNTS.has(file)) {
      let existing = 0;
      try { existing = (await fsp.readFile(file, 'utf8')).split('\n').filter(Boolean).length; } catch (e) {}
      COCKPIT_JSONL_COUNTS.set(file, existing);
    }
    await fsp.appendFile(file, JSON.stringify(record) + '\n', 'utf8');
    const count = COCKPIT_JSONL_COUNTS.get(file) + 1;
    COCKPIT_JSONL_COUNTS.set(file, count);
    const stat = await fsp.stat(file);
    // 只有超出条数（留 20% 余量，减少整理频率）或体积上限时才整理一次，平时只追加。
    if (stat.size <= maxBytes && count <= Math.ceil(limit * 1.2)) return;
    const kept = cockpitTrimJsonlRows((await fsp.readFile(file, 'utf8')).split('\n'), limit, maxBytes);
    await fsp.writeFile(file, kept.join('\n') + '\n', 'utf8');
    COCKPIT_JSONL_COUNTS.set(file, kept.length);
  });
  COCKPIT_JSONL_QUEUES.set(file, job);
  job.finally(() => { if (COCKPIT_JSONL_QUEUES.get(file) === job) COCKPIT_JSONL_QUEUES.delete(file); }).catch(() => {});
  return job;
}

function cockpitReadJsonl(file, limit) {
  try {
    const rows = require('fs').readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const out = [];
    for (const line of rows.slice(-(limit || rows.length))) { try { out.push(JSON.parse(line)); } catch (e) {} }
    return out.reverse();
  } catch (e) { return []; }
}

async function cockpitClearJsonl(file) {
  const fsp = require('fs').promises; const path = require('path');
  await (COCKPIT_JSONL_QUEUES.get(file) || Promise.resolve()).catch(() => {});
  await fsp.mkdir(path.dirname(file), { recursive:true });
  await fsp.writeFile(file, '', 'utf8');
  COCKPIT_JSONL_COUNTS.set(file, 0);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { cockpitPluginLogDir, cockpitTrimJsonlRows, cockpitAppendJsonl, cockpitReadJsonl, cockpitClearJsonl };
