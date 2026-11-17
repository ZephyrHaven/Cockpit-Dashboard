#!/usr/bin/env node
// resurface scoring 纯函数测试：相关性加权重浮的核心逻辑。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 极简 moment 桩：只实现测试用到的接口。以固定"现在"为基准。
const NOW = new Date('2026-11-17T12:00:00');
function makeMoment(value) {
  const d = value == null ? new Date(NOW.getTime()) : new Date(value instanceof Date ? value.getTime() : value);
  const self = {
    _d: d,
    year: () => d.getFullYear(),
    month: () => d.getMonth(),
    date: () => d.getDate(),
    diff: (other, unit) => {
      const ms = d.getTime() - other._d.getTime();
      if (unit === 'days') return Math.floor(ms / 86400000);
      if (unit === 'years') return Math.floor(ms / (86400000 * 365));
      return ms;
    },
    valueOf: () => d.getTime(),
  };
  return self;
}
makeMoment.now = () => makeMoment(NOW);

const context = vm.createContext({
  console,
  PLUGIN_ID: 'cockpit-dashboard',
  window: { moment: makeMoment },
  Math, Set, Map, Array, Object, Number, String, JSON,
});
// hashCockpitString 依赖（来自 projects.js，测试内联同实现）
const hashSrc = 'function hashCockpitString(value){let hash=5381;for(let i=0;i<value.length;i++)hash=((hash<<5)+hash+value.charCodeAt(i))|0;return hash;}';
const source = fs.readFileSync(path.join(__dirname, '../src/resurface.js'), 'utf8');
vm.runInContext(hashSrc + '\n' + source + ';globalThis.rApi={scoreResurfaceCandidates,resurfaceFileTags,RESURFACE_MIN_AGE_DAYS};', context);
const api = context.rApi;

// 构造文件：file.extension='md'，stat.mtime 为 Date。
function file(p, daysAgo) {
  return { path: p, basename: p.split('/').pop(), extension: 'md', stat: { mtime: new Date(NOW.getTime() - daysAgo * 86400000) } };
}

// 1) 相关性优先：与活跃标签重合的旧笔记排在无标签旧笔记之前。
const files = [
  file('notes/unrelated.md', 400),
  file('notes/work-related.md', 400),
  file('notes/very-old.md', 900),
];
const metadataCache = {
  getFileCache: (f) => f.path.includes('work-related') ? { tags: [{ tag: '#work' }] } : null,
};
const ranked = api.scoreResurfaceCandidates(files, { activeTags: ['work'], metadataCache, now: NOW });
assert.equal(ranked[0].file.path, 'notes/work-related.md', 'tag overlap should rank first');
assert.ok(ranked[0].score > ranked[1].score, 'overlap must dominate score');

// 2) 太新的笔记被排除（未到 180 天且非往年今天）。
const fresh = api.scoreResurfaceCandidates([file('notes/new.md', 10)], { now: NOW });
assert.equal(fresh.length, 0, 'notes newer than min age are excluded');

// 3) 往年今天：同月同日（不同年）即便较新也纳入，并带 anniversary 标记。
const anniversaryFile = { path: 'notes/same-day.md', basename: 'same-day.md', extension: 'md', stat: { mtime: new Date('2024-11-17T09:00:00') } };
const ann = api.scoreResurfaceCandidates([anniversaryFile], { now: NOW });
assert.equal(ann.length, 1, 'anniversary note included');
assert.equal(ann[0].anniversary, true, 'anniversary flag set');

// 4) 排序稳定：同一输入两次调用结果一致（jitter 基于路径哈希，不随时间变）。
const again = api.scoreResurfaceCandidates(files, { activeTags: ['work'], metadataCache, now: NOW });
assert.equal(JSON.stringify(again.map((x) => x.file.path)), JSON.stringify(ranked.map((x) => x.file.path)), 'ranking is stable across calls');

// 5) 无 metadataCache 时不报错，tags 为空。
const noMeta = api.scoreResurfaceCandidates([file('notes/a.md', 300)], { now: NOW });
assert.equal(noMeta.length, 1);
assert.equal(noMeta[0].tags.length, 0, 'no tags without metadata cache');

// 6) resurfaceFileTags 解析行内 + frontmatter，去 # 与小写化。
const tags = api.resurfaceFileTags({ getFileCache: () => ({ tags: [{ tag: '#Work' }], frontmatter: { tags: 'a, #B' } }) }, files[0]);
assert.ok(tags.includes('work') && tags.includes('a') && tags.includes('b'), 'tags parsed and normalized');

console.log('resurface scoring: all assertions passed');
