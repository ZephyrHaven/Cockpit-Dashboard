#!/usr/bin/env node
// ai-index.test.js — 自动 RAG 倒排索引：构建、查询相关性、增量更新、持久化与边界。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { AI_INDEX_LIMITS, collectAiIndexTerms, CockpitAiSearchIndex } = require('../src/ai-index.js');

function createVault(state, options = {}) {
  const toFile = (p) => ({ path:p, extension:'md', stat:{ mtime:state[p].mtime, size:state[p].content.length } });
  return {
    configDir:'.obsidian',
    getMarkdownFiles:(options.onListFiles || (() => Object.keys(state).map(toFile))),
    getAbstractFileByPath:(p) => (state[p] ? toFile(p) : null),
    cachedRead:async (file) => {
      options.onRead?.(file.path);
      return state[file.path].content;
    }
  };
}

const CORPUS = {
  'Projects/Budget.md':{ content:'# Q3 项目预算\n等待财务审批，金额需要复核，项目负责人确认供应商报价。', mtime:100 },
  'Health/Run.md':{ content:'# 跑步日记\n今天完成五公里训练，记录配速与心率。', mtime:90 },
  'Ideas.md':{ content:'# 灵感\n头脑风暴：把阅读摘录做成每周回顾。', mtime:80 }
};

async function buildIndex(state = CORPUS, options = {}) {
  const plugin = { app:{ vault:createVault(state, options) } };
  const index = new CockpitAiSearchIndex(plugin);
  await index.ensure();
  return index;
}

(async () => {
  // ── 分词 ────────────────────────────────────────────────────────────────────
  {
    const { counts, truncated } = collectAiIndexTerms('The Project Budget 项目预算审批');
    assert.ok(counts.has('project') && counts.has('budget'), 'Latin words become lowercase index terms.');
    assert.ok(!counts.has('the'), 'Common stopwords are not indexed.');
    assert.ok(counts.has('项目') && counts.has('预算') && counts.has('审批'), 'Chinese text is indexed as overlapping bigrams.');
    assert.ok(counts.has('项目预算审批'), 'Short Chinese runs stay queryable as whole terms.');
    assert.equal(truncated, false, 'Normal documents are not truncated.');
  }

  // ── 构建与查询相关性 ────────────────────────────────────────────────────────
  {
    const index = await buildIndex(CORPUS);
    assert.equal(index.ready, true, 'Index reports readiness after the initial build.');
    const top = index.query('财务审批 金额 复核');
    assert.equal(top[0]?.path, 'Projects/Budget.md', 'Keyword query surfaces the matching note first.');
    assert.ok(top.length <= AI_INDEX_LIMITS.candidateLimit, 'Query results stay bounded.');
  }

  // ── 无命中时退化为最近修改候选 ──────────────────────────────────────────────
  {
    const index = await buildIndex();
    const fallback = index.query('zzz 完全不存在的词组');
    assert.ok(fallback.length > 0, 'Zero-hit queries still return recent-note candidates.');
    assert.deepEqual(fallback.map((item) => item.path), ['Projects/Budget.md','Health/Run.md','Ideas.md'], 'Fallback candidates follow recency.');
  }

  // ── 增量更新改变排序；删除立即生效 ──────────────────────────────────────────
  {
    const state = JSON.parse(JSON.stringify(CORPUS));
    const index = await buildIndex(state);
    assert.notEqual(index.query('财务审批')[0]?.path, 'Health/Run.md');
    state['Health/Run.md'].content += '\n跑步后整理财务审批报销单。';
    state['Health/Run.md'].mtime = 200;
    await index.updateFile('Health/Run.md');
    assert.equal(index.query('财务审批')[0]?.path, 'Health/Run.md', 'Incremental updates reshuffle candidate ranking.');

    assert.ok(index.removePath('Ideas.md'), 'Removing a tracked path succeeds.');
    assert.equal(index.pathToId.has('Ideas.md'), false, 'Removed paths leave the index.');
    assert.ok(!index.postings.get('头脑风暴')?.size, 'Postings of removed documents are cleaned up.');
  }

  // ── 重命名保持索引有效 ──────────────────────────────────────────────────────
  {
    const index = await buildIndex();
    index.renamePath('Health/Run.md', 'Archive/Run.md');
    const hits = index.query('配速 心率');
    assert.ok(hits.some((item) => item.path === 'Archive/Run.md'), 'Renamed notes remain retrievable under the new path.');
  }

  // ── 持久化：写出快照并在新实例中免重建加载 ──────────────────────────────────
  {
    let savedText = null;
    const adapter = {
      exists:async (p) => savedText !== null && p.endsWith('ai-index.json'),
      read:async () => savedText,
      write:async (p, text) => { savedText = text; }
    };
    const writerPlugin = { app:{ vault:{ ...createVault(CORPUS), adapter } } };
    const writer = new CockpitAiSearchIndex(writerPlugin);
    await writer.ensure();
    assert.equal(await writer.flushSave(), true, 'Flushed snapshot is written through the adapter.');
    assert.ok(savedText && savedText.length < AI_INDEX_LIMITS.maxSerializedChars, 'Snapshot respects the size budget.');
    assert.match(savedText, /"v":1/, 'Snapshot carries a format version.');

    const readerPlugin = { app:{ vault:{ ...createVault(CORPUS, { onRead:() => assert.fail('loaded index must not re-read the vault') }), adapter } } };
    const reader = new CockpitAiSearchIndex(readerPlugin);
    await reader.ensure();
    assert.equal(reader.ready, true, 'Persisted snapshot makes the index instantly ready.');
    assert.equal(reader.query('财务审批')[0]?.path, 'Projects/Budget.md', 'Loaded index answers queries like the original.');

    const corruptAdapter = { exists:async () => true, read:async () => '{broken json' };
    const corruptVault = Object.assign(createVault(CORPUS), { adapter:corruptAdapter });
    const corrupt = new CockpitAiSearchIndex({ app:{ vault:corruptVault } });
    await assert.doesNotReject(() => corrupt.ensure(), 'Corrupt snapshots degrade to a fresh build instead of throwing.');
    assert.equal(corrupt.ready, true, 'Rebuilt index becomes ready after corrupt snapshot is discarded.');
  }

  // ── 队列入口的路径守卫 ──────────────────────────────────────────────────────
  {
    const index = await buildIndex();
    assert.equal(index.queuePath('.obsidian/plugins/x/README.md'), false, 'Protected paths never enter the update queue.');
    assert.equal(index.queuePath('notes/image.txt'), false, 'Non-Markdown paths never enter the update queue.');
    assert.equal(index.queuePath('notes/fresh.md'), true, 'Markdown paths are queued for incremental indexing.');
    await index.flushSave();
  }

  // ── 未就绪时不产出快照 ──────────────────────────────────────────────────────
  {
    const empty = new CockpitAiSearchIndex({ app:{ vault:createVault(CORPUS) } });
    assert.equal(empty.serialize(), null, 'Un-built indexes refuse to serialize partial data.');
  }

  // ── 构建序列与框架事件接线 ──────────────────────────────────────────────────
  {
    const root = path.resolve(__dirname, '..');
    const build = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
    const framework = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
    assert.match(build, /'ai-index\.js'[\s\S]*'ai-context\.js'/, 'The inverted index is bundled before the RAG service.');
    assert.match(framework, /queueIndexUpdate/, 'Vault modify events feed incremental index updates.');
    assert.match(framework, /removeFromIndex/, 'Vault delete events evict index entries.');
  }

  console.log('AI inverted index checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
