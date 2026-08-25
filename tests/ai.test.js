#!/usr/bin/env node

const assert = require('node:assert/strict');

const {
  AI_DEFAULTS,
  AI_PROVIDER_PRESETS,
  normalizeAiConfig,
  getActiveAiProfile,
  collectRecentMarkdownPaths,
  normalizeAiBaseUrl,
  buildAiEndpoint,
  truncateAiContext,
  buildAiMessages,
  parseAiResponseText,
  createAiRequest,
  createAiSseParser,
  CockpitAIService
} = require('../src/ai.js');
const {
  normalizeAiLauncherPosition,
  calculateAiLauncherPoint
} = require('../src/ai-launcher.js');

for (const providerId of ['openai', 'deepseek', 'kimi', 'zhipu', 'qwen', 'minimax', 'siliconflow', 'openrouter', 'ollama', 'omnirouter', 'custom']) {
  assert.ok(AI_PROVIDER_PRESETS.some((provider) => provider.id === providerId), `AI provider preset exists: ${providerId}`);
}
assert.ok(
  AI_PROVIDER_PRESETS.find((provider) => provider.id === 'omnirouter').models.includes('auto/best-reasoning'),
  'OmniRouter offers an explicit reasoning route for users who want visible model reasoning.'
);

assert.equal(
  normalizeAiBaseUrl('https://api.openai.com/v1/'),
  'https://api.openai.com/v1',
  'AI accepts HTTPS provider URLs and removes the trailing slash.'
);
assert.equal(
  normalizeAiBaseUrl('http://127.0.0.1:11434/v1'),
  'http://127.0.0.1:11434/v1',
  'AI allows an HTTP loopback endpoint for local models.'
);
assert.equal(
  normalizeAiBaseUrl('http://models.example.com/v1'),
  AI_DEFAULTS.baseUrl,
  'AI rejects insecure remote HTTP endpoints.'
);
assert.equal(
  normalizeAiBaseUrl('https://user:password@example.com/v1'),
  AI_DEFAULTS.baseUrl,
  'AI rejects credentials embedded in provider URLs.'
);

const normalized = normalizeAiConfig({
  baseUrl:' http://localhost:1234/v1/ ',
  model:'  demo-model\nignored ',
  apiKeySecret:'  cockpit-ai-key  ',
  maxContextChars:999999
});
assert.equal(normalized.profiles.length, 1, 'Legacy single-provider settings migrate to one model profile.');
assert.equal(getActiveAiProfile(normalized).baseUrl, 'http://localhost:1234/v1');
assert.equal(getActiveAiProfile(normalized).model, 'demo-model ignored');
assert.equal(getActiveAiProfile(normalized).apiKeySecret, 'cockpit-ai-key');
assert.equal(normalized.maxContextChars, 50000, 'Context length is capped to bound outbound note data.');

const multiProvider = normalizeAiConfig({
  activeProfileId:'kimi-main',
  maxContextChars:8000,
  profiles:[
    { id:'deepseek-fast', name:'DeepSeek 快速', providerId:'deepseek', model:'deepseek-v4-flash', apiKeySecret:'deepseek-key' },
    { id:'kimi-main', name:'Kimi', providerId:'kimi', model:'kimi-k2.6', apiKeySecret:'kimi-key' }
  ]
});
assert.equal(multiProvider.profiles[0].baseUrl, 'https://api.deepseek.com', 'Provider presets supply their official base URL.');
assert.equal(getActiveAiProfile(multiProvider).model, 'kimi-k2.6', 'The selected model profile is resolved independently.');
assert.deepEqual(
  collectRecentMarkdownPaths({
    selectedPath:'Selected.md',
    activePath:'Active.md',
    lastActivePath:'Active.md',
    workspacePaths:['Canvas.canvas', 'Recent.md', 'Selected.md'],
    persistedEntries:[{ path:'Older.md' }, { path:'Recent.md' }]
  }),
  ['Selected.md', 'Active.md', 'Recent.md', 'Older.md'],
  'Recent note candidates are Markdown-only, stable, and deduplicated.'
);

assert.equal(
  buildAiEndpoint('https://api.openai.com/v1'),
  'https://api.openai.com/v1/chat/completions'
);
assert.equal(
  buildAiEndpoint('https://example.com/v1/chat/completions'),
  'https://example.com/v1/chat/completions',
  'A complete chat-completions endpoint is not duplicated.'
);

const longContext = 'A'.repeat(80) + 'MIDDLE' + 'Z'.repeat(80);
const truncated = truncateAiContext(longContext, 100);
assert.ok(truncated.length <= 100, 'Truncated context respects its hard limit.');
assert.ok(truncated.startsWith('A'.repeat(40)), 'Truncation keeps the start of a note.');
assert.ok(truncated.endsWith('Z'.repeat(40)), 'Truncation keeps the end of a note.');
assert.match(truncated, /内容过长，已省略/, 'Truncation is disclosed to the model.');

const messages = buildAiMessages({
  action:'summarize',
  question:'',
  note:{ path:'Projects/Test.md', content:'Heading\nBody' },
  maxContextChars:12000,
  language:'zh-CN'
});
assert.equal(messages[0].role, 'system');
assert.equal(messages[1].role, 'user');
assert.match(messages[1].content, /Projects\/Test\.md/);
assert.match(messages[1].content, /总结/);
assert.match(messages[1].content, /Heading\nBody/);

assert.equal(
  parseAiResponseText({ choices:[{ message:{ content:'  finished  ' } }] }),
  'finished'
);
assert.equal(
  parseAiResponseText({ choices:[{ message:{ content:[{ type:'text', text:'part one' }, { type:'text', text:'part two' }] } }] }),
  'part one\npart two',
  'Array-form compatible responses are supported.'
);
assert.throws(
  () => parseAiResponseText({ choices:[] }),
  /没有返回可显示的内容/,
  'Empty provider responses fail with a user-facing error.'
);

const request = createAiRequest(getActiveAiProfile(normalized), 'secret-value', messages);
assert.equal(request.url, 'http://localhost:1234/v1/chat/completions');
assert.equal(request.method, 'POST');
assert.equal(request.headers.Authorization, 'Bearer secret-value');
assert.doesNotMatch(request.body, /secret-value/, 'The API key is never copied into the request body.');
assert.equal(JSON.parse(request.body).stream, false, 'The request uses requestUrl-compatible non-streaming responses.');

const streamRequest = createAiRequest(getActiveAiProfile(normalized), 'secret-value', messages, { stream:true });
assert.equal(JSON.parse(streamRequest.body).stream, true, 'Streaming requests explicitly opt into SSE responses.');

const streamEvents = [];
const streamParser = createAiSseParser((event) => streamEvents.push(event));
streamParser.push('data: {"choices":[{"delta":{"reasoning_content":"先分析"}}]}\n\ndata: {"choices":[{"del');
streamParser.push('ta":{"content":"结论"}}]}\n\ndata: [DONE]\n\n');
streamParser.finish();
assert.deepEqual(streamEvents, [
  { type:'reasoning', text:'先分析' },
  { type:'content', text:'结论' },
  { type:'done' }
], 'SSE parsing preserves reasoning and answer deltas across arbitrary network chunks.');

assert.equal(normalizeAiLauncherPosition(null), null);
assert.deepEqual(normalizeAiLauncherPosition({ x:1.8, y:-0.3 }), { x:1, y:0 }, 'Saved launcher coordinates are clamped to the viewport ratio.');
assert.deepEqual(
  calculateAiLauncherPoint({ x:1, y:0 }, { width:1000, height:800 }, 48, 12),
  { left:940, top:12 },
  'A dragged launcher remains fully visible inside the viewport margin.'
);

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const build = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
const framework = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/serverchan.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(build, /'ai\.js'[\s\S]*'ai-view\.js'/, 'AI core and UI are bundled as dedicated modules.');
assert.match(build, /'ai-launcher\.js'/, 'The global AI launcher is bundled as a dedicated module.');
assert.match(framework, /registerView\(AI_VIEW_TYPE/, 'The plugin registers a dedicated AI workspace view.');
assert.doesNotMatch(framework, /action:\s*'ai'/, 'The dashboard toolbar does not duplicate the global AI launcher.');
assert.doesNotMatch(framework, /addRibbonIcon\('bot-message-square'/, 'The AI launcher replaces the redundant ribbon icon.');
assert.match(framework, /mountAiLauncher\(this\)/, 'The plugin mounts one global AI launcher during startup.');
assert.match(framework, /_aiLauncherCleanup/, 'The plugin cleans up the global launcher on unload.');
assert.match(framework, /openAI\(\)/, 'The plugin owns one reusable AI view opening path.');
assert.match(framework, /closeAI\(\)/, 'The plugin exposes a dedicated AI sidebar close path.');
assert.match(framework, /toggleAI\(\)/, 'The plugin exposes one shared AI sidebar toggle path.');
assert.match(settings, /renderAiSettings/, 'AI provider settings are integrated into the plugin settings tab.');
assert.match(styles, /cockpit-dashboard-ai-view/, 'The AI sidebar has scoped presentation styles.');
const aiView = fs.readFileSync(path.join(root, 'src/ai-view.js'), 'utf8');
const aiLauncher = fs.readFileSync(path.join(root, 'src/ai-launcher.js'), 'utf8');
assert.match(aiView, /ai-model-select/, 'The sidebar exposes a model profile selector.');
assert.match(aiView, /ai-context-select/, 'The sidebar exposes a recent-note context selector.');
assert.match(aiView, /ai-close/, 'The AI sidebar has an explicit close control.');
assert.match(aiView, /subscribeConfig/, 'An open AI sidebar subscribes to model configuration changes.');
assert.match(aiView, /_refreshModelOptions/, 'The open sidebar refreshes its model selector without reopening.');
assert.match(aiView, /ai-profile-test/, 'Every model profile card exposes its own connection test.');
assert.match(aiView, /testProfile\(profile\.id/, 'Profile test buttons target the card configuration instead of the active model.');
assert.doesNotMatch(aiView, /Test active model|测试当前模型/, 'The redundant global active-model test is removed.');
assert.match(aiView, /ai-reasoning/, 'Reasoning deltas render in a dedicated collapsible region.');
assert.match(aiView, /AbortController/, 'Users can stop an in-flight streamed response.');
assert.match(aiView, /aria-live/, 'Streaming progress is announced accessibly.');
assert.match(aiView, /ai-shell/, 'The sidebar uses a bounded responsive shell instead of stretching controls across the pane.');
assert.match(styles, /min-height:\s*64px/, 'Quick actions override Obsidian button height so their labels cannot be clipped.');
assert.match(styles, /cockpit-dashboard-ai-launcher/, 'The global launcher has scoped visual styles.');
assert.match(styles, /prefers-reduced-motion/, 'The launcher respects reduced-motion preferences.');
assert.match(aiLauncher, /plugin\.toggleAI\(\)/, 'The persistent global launcher toggles the AI sidebar in both directions.');
assert.doesNotMatch(aiLauncher, /tabIndex\s*=\s*isOpen\s*\?\s*-1/, 'Opening the sidebar does not make the launcher unreachable.');
assert.doesNotMatch(styles, /\.cockpit-dashboard-ai-launcher\.is-open\s*\{[^}]*opacity:\s*0/s, 'The launcher remains visible while the sidebar is open.');
assert.doesNotMatch(aiLauncher, /ai-launcher-glow/, 'The launcher avoids the previous decorative watermark layer.');
assert.match(aiLauncher, /--cockpit-ai-launcher-right/, 'The open launcher moves beside the AI leaf instead of covering the composer.');
assert.match(aiLauncher, /pointerdown/, 'The global AI launcher supports pointer dragging.');
assert.match(aiLauncher, /aiLauncherPosition/, 'Dragged launcher coordinates are persisted in plugin data.');
assert.match(aiLauncher, /suppressClick/, 'Dragging does not accidentally toggle the AI sidebar.');
assert.match(styles, /container-type:\s*inline-size/, 'The AI sidebar responds to its own pane width.');
assert.match(styles, /@container\s+cockpit-ai-view\s*\(max-width:\s*460px\)/, 'Narrow AI panes receive a compact header layout.');

(async () => {
  let stored = {
    ai:{ baseUrl:'https://provider.example/v1', model:'test-model', apiKeySecret:'cockpit-key', maxContextChars:4000 }
  };
  let capturedRequest = null;
  global.obsidian = {
    requestUrl:async (requestOptions) => {
      capturedRequest = requestOptions;
      return { status:200, json:{ choices:[{ message:{ content:'Service response' } }] } };
    }
  };
  const noteFile = { path:'Current.md', extension:'md' };
  const plugin = {
    _lastActiveMarkdownFile:noteFile,
    loadData:async () => stored,
    mutateData:async (mutator) => { await mutator(stored); },
    app:{
      secretStorage:{ getSecret:(name) => name === 'cockpit-key' ? 'runtime-secret' : null },
      workspace:{ getActiveFile:() => null, getLastOpenFiles:() => ['Fallback.md'] },
      vault:{
        getAbstractFileByPath:(filePath) => filePath === 'Fallback.md' ? { path:'Fallback.md', extension:'md' } : null,
        cachedRead:async (file) => file.path === 'Fallback.md' ? 'Fallback note content' : 'Current note content'
      }
    }
  };
  const service = new CockpitAIService(plugin);
  let configEvent = null;
  const unsubscribeConfig = service.subscribeConfig((next) => { configEvent = next; });
  assert.deepEqual(await service.getCurrentNoteContext(), { path:'Current.md', content:'Current note content' });
  plugin._lastActiveMarkdownFile = null;
  assert.deepEqual(await service.getCurrentNoteContext(), { path:'Fallback.md', content:'Fallback note content' }, 'Workspace open history is used after Cockpit takes focus.');
  plugin._lastActiveMarkdownFile = noteFile;
  assert.equal(await service.complete({ action:'summarize', note:{ path:'Current.md', content:'Body' }, language:'zh-CN' }), 'Service response');
  assert.equal(capturedRequest.headers.Authorization, 'Bearer runtime-secret');
  assert.doesNotMatch(capturedRequest.body, /runtime-secret/);

  const originalFetch = global.fetch;
  let capturedStreamRequest = null;
  const encoder = new TextEncoder();
  const chunks = [
    'data: {"choices":[{"delta":{"reasoning_content":"检查上下文"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"流式回答"}}]}\n\n',
    'data: [DONE]\n\n'
  ];
  global.fetch = async (url, options) => {
    capturedStreamRequest = { url, options };
    let index = 0;
    return {
      ok:true,
      status:200,
      headers:{ get:() => 'text/event-stream' },
      body:{ getReader:() => ({ read:async () => index < chunks.length ? { done:false, value:encoder.encode(chunks[index++]) } : { done:true } }) }
    };
  };
  const streamed = [];
  const streamResult = await service.completeStream(
    { action:'custom', question:'stream test', language:'zh-CN' },
    (event) => streamed.push(event)
  );
  assert.equal(capturedStreamRequest.url, 'https://provider.example/v1/chat/completions');
  assert.equal(capturedStreamRequest.options.headers.Authorization, 'Bearer runtime-secret');
  assert.equal(JSON.parse(capturedStreamRequest.options.body).stream, true);
  assert.deepEqual(streamResult, { reasoning:'检查上下文', content:'流式回答', streamed:true });
  assert.ok(streamed.some((event) => event.type === 'reasoning'), 'The service exposes model-provided reasoning as it arrives.');
  assert.ok(streamed.some((event) => event.type === 'content'), 'The service exposes answer text as it arrives.');

  global.fetch = async () => { throw new TypeError('CORS blocked'); };
  global.obsidian.requestUrl = async () => new Promise((resolve) => setTimeout(() => resolve({
    status:200, json:{ choices:[{ message:{ content:'late fallback' } }] }
  }), 30));
  const abortController = new AbortController();
  const abortedFallback = service.completeStream({ action:'custom', question:'stop test', language:'zh-CN' }, () => {}, abortController.signal);
  abortController.abort();
  await assert.rejects(abortedFallback, (error) => error?.name === 'AbortError', 'Stop generation interrupts the UI even when a provider falls back to requestUrl.');
  global.fetch = originalFetch;
  global.obsidian.requestUrl = async (requestOptions) => {
    capturedRequest = requestOptions;
    return { status:200, json:{ choices:[{ message:{ content:'Service response' } }] } };
  };

  await service.setActiveProfile('default');
  assert.equal((await service.getConfig()).activeProfileId, 'default', 'Sidebar model changes are persisted through the service.');
  assert.equal(configEvent.activeProfileId, 'default', 'Configuration saves notify an already-open AI sidebar immediately.');
  unsubscribeConfig();

  await service.saveConfig({
    activeProfileId:'router-a',
    maxContextChars:4000,
    profiles:[
      { id:'router-a', name:'Router A', providerId:'custom', baseUrl:'http://localhost:20128/v1', model:'auto/best-chat', apiKeySecret:'cockpit-key' },
      { id:'router-b', name:'Router B', providerId:'custom', baseUrl:'http://localhost:20128/v1', model:'oc/deepseek-v4-flash-free', apiKeySecret:'cockpit-key' }
    ]
  });
  await service.setActiveProfile('router-b');
  await service.complete({ action:'custom', question:'switch test', language:'zh-CN' });
  assert.equal(JSON.parse(capturedRequest.body).model, 'oc/deepseek-v4-flash-free', 'A sidebar model switch changes the model used by the next request.');
  assert.equal(capturedRequest.url, 'http://localhost:20128/v1/chat/completions');

  await service.testProfile('router-a', 'zh-CN');
  assert.equal(JSON.parse(capturedRequest.body).model, 'auto/best-chat', 'A profile-card test calls that profile even when another model is active.');
  assert.equal((await service.getConfig()).activeProfileId, 'router-b', 'Testing one profile does not change the active sidebar model.');

  global.obsidian.requestUrl = async () => ({ status:401, json:{ error:{ message:'provider detail must stay hidden' } } });
  await assert.rejects(
    () => service.complete({ action:'custom', question:'hello', language:'zh-CN' }),
    /API Key 无效或没有访问权限/,
    'Provider failures expose a safe localized error rather than the raw response.'
  );
  delete global.obsidian;
  console.log('AI core checks passed');
})().catch((error) => {
  delete global.obsidian;
  console.error(error);
  process.exitCode = 1;
});
