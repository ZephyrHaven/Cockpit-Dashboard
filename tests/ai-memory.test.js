const vm = require('vm');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai-memory.js'), 'utf8');
const sandbox = { module:{ exports:{} }, console, Date };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const M = sandbox.module.exports;

const turns = [
  { role:'user', content:'我决定采用 terser 作为主压缩引擎。' },
  { role:'assistant', content:'好的' },
  { role:'assistant', content:'该模块基于环形缓冲实现，位于 perf-trace.js。' },
  { role:'user', content:'下一步还需要补一个刷新热力图。' }
];
const cands = M.extractAiMemoryCandidates(turns, { now:1000, sessionId:'s1' });
assert.ok(cands.length >= 3, 'expected >=3 candidates, got ' + cands.length);
assert.ok(cands.some(function(c){return c.kind === 'decision';}), 'has decision');
assert.ok(cands.some(function(c){return c.kind === 'open';}), 'has open');
assert.ok(!cands.some(function(c){return /^好的$/.test(c.text);}), 'greeting filtered');

const kws = M.extractAiMemoryKeywords('terser 压缩引擎');
assert.ok(kws.indexOf('terser') >= 0);

const norm = M.normalizeAiMemory({ entries:[
  { text:'甲 决定 使用 A', at:100 },
  { text:'甲 决定 使用 A', at:200 },
  { text:'乙 是 置顶', at:50, pinned:true }
]});
assert.strictEqual(norm.entries.length, 2, 'dedupe');
assert.strictEqual(norm.entries[0].pinned, true, 'pinned first');

const picked = M.scoreAiMemoryEntries(norm.entries, 'terser', { limit:5 });
assert.ok(picked.length >= 1);

const block = M.buildAiMemoryPromptBlock(norm.entries, 'zh-CN');
assert.ok(block.indexOf('长期记忆') >= 0);
assert.strictEqual(M.buildAiMemoryPromptBlock([], 'zh-CN'), '');

const store = {};
const fakeAdapter = { exists: async function(){ return false; }, read: async function(){ return ''; }, write: async function(p, c){ store[p] = c; } };
const fakePlugin = { app:{ vault:{ configDir:'.obsidian', adapter:fakeAdapter } } };
const svc = new M.CockpitAiMemoryService(fakePlugin);
(async function(){
  const added1 = await svc.learnFromSession([{ role:'user', content:'我决定采用方案 B 来重构。' }], { sessionId:'s1', now:5000 });
  assert.ok(added1.length >= 1, 'first learn adds');
  const added2 = await svc.learnFromSession([{ role:'user', content:'我决定采用方案 B 来重构。' }], { sessionId:'s1', now:6000 });
  assert.strictEqual(added2.length, 0, 'duplicate not added again');
  const st = await svc.load();
  assert.ok(st.entries.length >= 1);
  console.log('ai-memory.test.js OK');
})().catch(function(e){ console.error(e); process.exit(1); });
