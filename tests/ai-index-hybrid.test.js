#!/usr/bin/env node
// A2 RAG 语义混合检索：纯函数测试
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ console, Math, Set, Map, Array, Object, Number, String, JSON, Date, Boolean, isFinite, parseInt, PLUGIN_ID:'cockpit-dashboard' });
const source = fs.readFileSync(path.join(__dirname, '../src/ai-index.js'), 'utf8');
vm.runInContext(source + ';globalThis.sdk={aiIndexCharGrams,aiIndexCosine,rankAiIndexHybrid};', context);
const { aiIndexCharGrams, aiIndexCosine, rankAiIndexHybrid } = context.sdk;

const grams = aiIndexCharGrams('abcab', 3);
assert.equal(grams.get('abc'), 1, 'abc once');
assert.equal(grams.get('bca'), 1, 'bca once');
assert.equal(grams.get('cab'), 1, 'cab once');

assert.ok(Math.abs(aiIndexCosine('项目总结', '项目总结') - 1) < 1e-9, 'identical cosine 1');
assert.equal(aiIndexCosine('完全无关', 'zzz qqq'), 0, 'disjoint cosine 0');
const partial = aiIndexCosine('项目总结报告', '项目总结');
assert.ok(partial > 0 && partial < 1, 'partial between');

const now = Date.parse('2026-11-17T12:00:00Z');
const docs = [
  { id:1, path:'notes/a.md', mtime:now },
  { id:2, path:'notes/b.md', mtime:now },
];
const termsById = new Map([
  [1, new Set(['项目','总结','季度'])],
  [2, new Set(['项目','总结','报告'])],
]);
const lexical = new Map([[2, 3]]);
const ranked = rankAiIndexHybrid(docs, (id)=>termsById.get(id), lexical, '项目总结', { now });
assert.equal(ranked.length, 2, 'both recalled');
assert.ok(ranked.find(x=>x.id===2).lexical > 0, 'doc2 lexical');
assert.ok(ranked.find(x=>x.id===1).semantic > 0, 'doc1 semantic only');
assert.equal(ranked[0].id, 2, 'doc2 ranks first');

const recencyOld = rankAiIndexHybrid([{id:3,path:'x.md',mtime:now-90*86400000}], ()=>new Set(['项目']), new Map([[3,5]]), '项目', { now });
assert.ok(recencyOld[0].score < 5 + 9, 'old doc recency decayed');

console.log('ai-index-hybrid: all assertions passed');
