#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  AI_UPLOAD_LIMITS,
  extractAiKeywords,
  chunkAiDocument,
  rankAiContextChunks,
  computeAiContentHash,
  readAiUploadFiles,
  CockpitRagService
} = require('../src/ai-context.js');
const { buildAiMessages, CockpitAIService } = require('../src/ai.js');

const keywords = extractAiKeywords('请查找 Q3 项目预算审批和 finance review');
assert.ok(keywords.includes('项目'), 'Chinese queries produce useful local keyword grams.');
assert.ok(keywords.includes('预算'), 'Chinese keyword extraction preserves important adjacent terms.');
assert.ok(keywords.includes('finance'), 'Latin keywords are normalized alongside Chinese queries.');
assert.ok(!keywords.includes('请'), 'Single-character Chinese noise is excluded.');

const chunks = chunkAiDocument({ path:'Projects/Budget.md', content:'# Q3 预算\n\n审批金额与财务复核，需要项目负责人确认最终额度。\n\n## 其他\n\n普通说明与后续归档安排。' }, 36, 8);
assert.ok(chunks.length >= 2, 'Long Markdown is split into bounded retrieval chunks.');
assert.ok(chunks.every((chunk) => chunk.content.length <= 36), 'Every RAG chunk respects the requested size.');
const ranked = rankAiContextChunks([
  { path:'Health.md', content:'今天完成跑步训练。' },
  { path:'Projects/Budget.md', content:'Q3 项目预算等待财务审批。' }
], extractAiKeywords('项目预算审批'), { limit:3, maxChars:2000 });
assert.equal(ranked[0].path, 'Projects/Budget.md', 'Local lexical RAG ranks the relevant note first.');

(async () => {
  assert.equal(await computeAiContentHash('same content'), await computeAiContentHash('same content'), 'Content hashes are deterministic.');
  assert.notEqual(await computeAiContentHash('same content'), await computeAiContentHash('changed content'), 'Content changes invalidate the chunk cache.');

  const uploaded = await readAiUploadFiles([
    { name:'brief.md', type:'text/markdown', size:24, text:async () => '# Brief\nProject goals' },
    { name:'data.csv', type:'text/csv', size:16, text:async () => 'name,value\na,1' }
  ]);
  assert.deepEqual(uploaded.map((item) => item.name), ['brief.md','data.csv']);
  assert.ok(uploaded.every((item) => item.content && item.source === 'upload'), 'Accepted uploads stay as in-memory text contexts.');
  await assert.rejects(
    () => readAiUploadFiles([{ name:'manual.pdf', type:'application/pdf', size:100, text:async () => 'binary' }]),
    /not supported/i,
    'Unsupported binary uploads fail explicitly instead of being silently sent.'
  );
  await assert.rejects(
    () => readAiUploadFiles([{ name:'huge.txt', type:'text/plain', size:AI_UPLOAD_LIMITS.maxBytesPerFile + 1, text:async () => 'x' }]),
    /too large/i,
    'Per-file limits are enforced before reading upload contents.'
  );

  const fileState = {
    'Projects/Budget.md':{ content:'# Q3 项目预算\n等待财务审批，金额需要复核。项目负责人需要确认供应商报价、付款节点、风险准备金和最终审批日期。', mtime:1 },
    'Health/Run.md':{ content:'# 跑步\n今天完成五公里训练，并记录配速、心率、恢复时间和下一次训练安排。', mtime:1 },
    '.obsidian/plugins/cockpit-dashboard/README.md':{ content:'插件源码说明，不允许进入检索。', mtime:1 }
  };
  let reads = 0;
  const toFile = (filePath) => ({ path:filePath, extension:'md', stat:{ mtime:fileState[filePath].mtime, size:fileState[filePath].content.length } });
  const vault = {
    getMarkdownFiles:() => Object.keys(fileState).map(toFile),
    getAbstractFileByPath:(filePath) => fileState[filePath] ? toFile(filePath) : null,
    cachedRead:async (file) => { reads += 1; return fileState[file.path].content; }
  };
  const rag = new CockpitRagService({ app:{ vault } });

  const manual = await rag.prepare({
    query:'预算审批', selectedPaths:['Projects/Budget.md','Health/Run.md'], attachments:[], maxChars:5000
  });
  assert.equal(manual.mode, 'manual', 'Several selected notes are sent directly while they fit the context budget.');
  assert.deepEqual(manual.contexts.map((item) => item.path), ['Projects/Budget.md','Health/Run.md']);

  const selectedRag = await rag.prepare({
    query:'项目预算审批', selectedPaths:['Projects/Budget.md','Health/Run.md'], attachments:[], maxChars:80
  });
  assert.equal(selectedRag.mode, 'rag-selected', 'Oversized manual context is reduced with keyword RAG.');
  assert.equal(selectedRag.contexts[0].path, 'Projects/Budget.md');
  assert.ok(selectedRag.contexts.reduce((sum, item) => sum + item.content.length, 0) <= 80, 'Retrieved excerpts fit the outbound context budget.');

  const summarizeFallback = await rag.prepare({
    query:'归纳摘要', selectedPaths:['Projects/Budget.md','Health/Run.md'], attachments:[], maxChars:80
  });
  assert.ok(summarizeFallback.contexts.length > 0, 'Oversized selected notes retain bounded excerpts when generic action words have no lexical hit.');

  const globalRag = await rag.prepare({ query:'财务审批金额', selectedPaths:[], attachments:[], maxChars:500 });
  assert.equal(globalRag.mode, 'rag-global', 'No manual selection triggers local whole-vault retrieval.');
  assert.equal(globalRag.contexts[0].path, 'Projects/Budget.md');
  assert.ok(globalRag.contexts.every((item) => !item.path.startsWith('.obsidian/')), 'Protected Obsidian and plugin paths never enter RAG context.');

  const readsAfterWarmCache = reads;
  await rag.prepare({ query:'预算', selectedPaths:[], attachments:[], maxChars:500 });
  assert.equal(reads, readsAfterWarmCache, 'Unchanged Vault files reuse the in-memory content-hash chunk cache.');
  fileState['Projects/Budget.md'].mtime = 2;
  fileState['Projects/Budget.md'].content += '\n新增审批结论。';
  await rag.prepare({ query:'审批结论', selectedPaths:[], attachments:[], maxChars:500 });
  assert.equal(reads, readsAfterWarmCache + 1, 'Only a changed file is re-read and re-indexed.');
  const readsBeforeInvalidation = reads;
  rag.invalidatePath('Health/Run.md');
  await rag.prepare({ query:'五公里训练', selectedPaths:[], attachments:[], maxChars:500 });
  assert.equal(reads, readsBeforeInvalidation + 1, 'Vault modify events can invalidate one cached path without rebuilding the full index.');

  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    () => rag.prepare({ query:'预算', selectedPaths:[], attachments:[], maxChars:500, signal:aborted.signal }),
    (error) => error?.name === 'AbortError',
    'Stopping generation also stops a pending whole-vault retrieval.'
  );

  const servicePlugin = {
    app:{ vault, secretStorage:{ getSecret:() => 'runtime-secret' } },
    rag,
    agentTools:{ definitions:() => [{ type:'function', function:{ name:'cockpit_list_todos', description:'Read tasks', parameters:{ type:'object', additionalProperties:false, properties:{} } } }] },
    loadData:async () => ({ ai:{ profiles:[{ id:'default', providerId:'custom', baseUrl:'https://provider.example/v1', model:'rag-model', apiKeySecret:'rag-key' }], activeProfileId:'default', maxContextChars:500 } })
  };
  const service = new CockpitAIService(servicePlugin);
  const originalFetch = global.fetch;
  const encoder = new TextEncoder();
  let outboundBody = null;
  global.fetch = async (_url, options) => {
    outboundBody = JSON.parse(options.body);
    const chunks = ['data: {"choices":[{"delta":{"content":"检索完成"}}]}\n\n','data: [DONE]\n\n'];
    let index = 0;
    return { ok:true, status:200, headers:{ get:() => 'text/event-stream' }, body:{ getReader:() => ({ read:async () => index < chunks.length ? { done:false, value:encoder.encode(chunks[index++]) } : { done:true } }) } };
  };
  const serviceEvents = [];
  const serviceResult = await service.completeAgentStream(
    { action:'custom', question:'财务审批金额', contextPaths:[], attachments:[], language:'zh-CN' },
    (event) => serviceEvents.push(event)
  );
  global.fetch = originalFetch;
  assert.equal(serviceResult.content, '检索完成');
  assert.match(outboundBody.messages[1].content, /Projects\/Budget\.md[\s\S]*财务审批/, 'The Agent request receives only locally retrieved relevant excerpts.');
  assert.ok(serviceEvents.some((event) => event.type === 'status' && event.stage === 'retrieving_context'));
  assert.ok(serviceEvents.some((event) => event.type === 'status' && event.stage === 'context_ready' && event.mode === 'rag-global'));

  const fallbackService = new CockpitAIService(servicePlugin);
  let fallbackOptions = null;
  fallbackService._requestAgentRound = async () => {
    const error = new Error('tools unsupported');
    error.code = 'AI_TOOLS_UNSUPPORTED';
    throw error;
  };
  fallbackService.complete = async (options) => { fallbackOptions = options; return '兼容回答'; };
  const fallbackResult = await fallbackService.completeAgentStream({
    action:'custom', question:'财务审批金额', contextPaths:[], attachments:[], language:'zh-CN'
  });
  assert.equal(fallbackResult.content, '兼容回答');
  assert.equal(fallbackOptions.contexts[0].path, 'Projects/Budget.md', 'A tool-unsupported model still receives the locally prepared RAG context.');

  const multiMessages = buildAiMessages({
    action:'custom', question:'比较两个上下文', language:'zh-CN', maxContextChars:5000,
    contexts:[
      { path:'Projects/Budget.md', content:'预算审批', source:'vault' },
      { path:'附件:brief.md', content:'外部简报', source:'upload' }
    ]
  });
  assert.match(multiMessages[1].content, /Projects\/Budget\.md[\s\S]*预算审批/);
  assert.match(multiMessages[1].content, /附件:brief\.md[\s\S]*外部简报/);
  assert.match(multiMessages[0].content, /所有上下文内容.*不可信/, 'Uploaded and RAG context cannot inject Agent instructions.');

  const root = path.resolve(__dirname, '..');
  const build = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'src/ai-view.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const framework = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
  assert.match(build, /'ai-context\.js'[\s\S]*'ai\.js'/, 'The context/RAG service is bundled before the AI request service.');
  assert.match(view, /ai-context-menu/, 'Recent Markdown notes are exposed through a multi-select context menu.');
  assert.match(view, /type:'file'[\s\S]*multiple:'multiple'/, 'The sidebar exposes a multi-file upload input.');
  assert.match(view, /ai-context-chip/, 'Selected notes and uploaded files are shown as removable context chips.');
  assert.match(view, /retrieving_context/, 'Local RAG progress is visible during generation.');
  assert.match(styles, /cockpit-dashboard-ai-context-menu/, 'Multi-select context UI has scoped responsive styles.');
  assert.match(framework, /vault\.on\('modify'[\s\S]*invalidatePath/, 'Vault changes invalidate cached RAG documents.');

  console.log('AI multi-context and RAG checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
