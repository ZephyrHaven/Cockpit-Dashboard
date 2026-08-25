#!/usr/bin/env node

const assert = require('node:assert/strict');

const {
  createCockpitAgentToolRegistry,
  isProtectedAgentPath
} = require('../src/ai-tools.js');
const {
  AI_DEFAULTS,
  createAiRequest,
  createAiSseParser,
  CockpitAIService
} = require('../src/ai.js');

assert.equal(isProtectedAgentPath('.obsidian/plugins/cockpit-dashboard/main.js'), true, 'The Agent can never address plugin source files.');
assert.equal(isProtectedAgentPath('.obsidian/plugins/another-plugin/readme.md'), true, 'The entire Obsidian configuration tree is protected.');
assert.equal(isProtectedAgentPath('_data/todos.md'), false, 'The dedicated Cockpit todo store remains available through fixed-purpose tools.');

const now = () => ({
  format:(pattern) => pattern.includes('HH') ? '2026-08-20T09:30' : '2026-08-20',
  clone() { return this; },
  startOf() { return this; },
  valueOf:() => Date.parse('2026-08-20T09:30:00+08:00')
});
const files = new Map([
  ['_data/todos.md', '# 待办事项\n\n- [ ] Existing task | id:todo-existing | created: 2026-08-19\n'],
  ['Projects/Alpha.md', '# Alpha\nAgent-accessible project note.'],
  ['.obsidian/plugins/cockpit-dashboard/README.md', 'private plugin source documentation']
]);
const fileFor = (path) => path && files.has(path) ? { path, extension:path.endsWith('.md') ? 'md' : '' } : null;
const writes = [];
const vault = {
  getAbstractFileByPath:fileFor,
  getMarkdownFiles:() => Array.from(files.keys()).map(fileFor),
  read:async (file) => files.get(file.path),
  cachedRead:async (file) => files.get(file.path),
  modify:async (file, content) => { files.set(file.path, content); writes.push(file.path); },
  create:async (path, content) => { files.set(path, content); writes.push(path); return fileFor(path); },
  createFolder:async () => {}
};

const parseTodosContent = (content) => String(content || '').split('\n').flatMap((line) => {
  const match = line.match(/^- \[([ x])\] (.+?) \| id:([^ |]+)/);
  return match ? [{ id:match[3], text:match[2], tags:[], priority:'mid', dueDate:null, done:match[1] === 'x', created:now(), doneDate:null }] : [];
});
const mutateTodos = async (_vault, mutator) => {
  const todos = parseTodosContent(files.get('_data/todos.md'));
  const result = await mutator(todos);
  if (result === false) return { saved:false, todos, result };
  const content = '# 待办事项\n\n' + todos.map((todo) => '- [' + (todo.done ? 'x' : ' ') + '] ' + todo.text + ' | id:' + todo.id).join('\n') + '\n';
  await vault.modify(fileFor('_data/todos.md'), content);
  return { saved:true, todos, result };
};
const plugin = {
  app:{
    vault,
    secretStorage:{ getSecret:() => 'runtime-only-secret' },
    workspace:{ getLeavesOfType:() => [], getActiveFile:() => null, getLastOpenFiles:() => [] }
  },
  loadData:async () => ({ ai:{ profiles:[{ id:'default', providerId:'custom', baseUrl:'https://provider.example/v1', model:'agent-model', apiKeySecret:'agent-secret' }], activeProfileId:'default' } })
};
const registry = createCockpitAgentToolRegistry(plugin, { parseTodosContent, mutateTodos, createTodoId:() => 'todo-agent', moment:now });
plugin.agentTools = registry;

const definitions = registry.definitions();
assert.deepEqual(
  definitions.map((tool) => tool.function.name),
  ['cockpit_list_todos', 'cockpit_search_notes', 'cockpit_create_todo', 'cockpit_complete_todo'],
  'The first Agent surface is an explicit capability allowlist.'
);
definitions.forEach((tool) => {
  assert.equal(tool.function.parameters.additionalProperties, false, `${tool.function.name} rejects undeclared arguments.`);
  assert.doesNotMatch(tool.function.name, /write|shell|command|script|code|source|file/i, `${tool.function.name} is not a generic execution or file tool.`);
  assert.equal(
    Object.keys(tool.function.parameters.properties || {}).some((name) => /path|command|script|code|source|content/i.test(name)),
    false,
    `${tool.function.name} accepts no arbitrary path, code, command, or file-content argument.`
  );
});

(async () => {
  await assert.rejects(
    () => registry.execute('cockpit_list_todos', { status:'open', path:'src/ai.js' }),
    /not allowed/i,
    'Runtime validation rejects undeclared arguments even if a model bypasses its advertised schema.'
  );
  await assert.rejects(
    () => registry.execute('cockpit_create_todo', { text:{ injected:true } }, { confirm:async () => true }),
    /must be a string/i,
    'Runtime validation rejects wrong argument types before asking for confirmation or mutating data.'
  );
  const listed = await registry.execute('cockpit_list_todos', { status:'open', limit:10 });
  assert.equal(listed.ok, true);
  assert.equal(listed.data.items[0].text, 'Existing task');

  const searched = await registry.execute('cockpit_search_notes', { query:'project', limit:10 });
  assert.deepEqual(searched.data.items.map((item) => item.path), ['Projects/Alpha.md'], 'Protected .obsidian paths never enter Agent search results.');

  const denied = await registry.execute('cockpit_create_todo', { text:'Agent task' }, { confirm:async () => false });
  assert.equal(denied.denied, true, 'Mutating tools require explicit user confirmation.');
  assert.equal(writes.length, 0, 'A denied tool call performs no Vault write.');

  const created = await registry.execute('cockpit_create_todo', { text:'Agent task', priority:'high' }, { confirm:async () => true });
  assert.equal(created.ok, true);
  assert.equal(created.data.todo.id, 'todo-agent');
  assert.deepEqual(writes, ['_data/todos.md'], 'Agent todo creation can only write the fixed Cockpit todo file.');

  await assert.rejects(
    () => registry.execute('write_file', { path:'src/ai.js', content:'changed' }, { confirm:async () => true }),
    /not available/i,
    'Unknown or source-writing tools are rejected even if a model invents them.'
  );

  const toolRequest = createAiRequest(
    { id:'default', providerId:'custom', baseUrl:AI_DEFAULTS.baseUrl, model:'agent-model' },
    'runtime-only-secret',
    [{ role:'user', content:'Add a task' }],
    { stream:true, tools:definitions }
  );
  const toolRequestBody = JSON.parse(toolRequest.body);
  assert.equal(toolRequestBody.tool_choice, 'auto');
  assert.equal(toolRequestBody.tools.length, 4, 'Only allowlisted tools are sent to the model.');

  // ── 三层权限：只读不下发写工具；完整权限免确认执行写操作 ─────────────────────
  const readonlyDefs = registry.definitions('readonly');
  assert.deepEqual(
    readonlyDefs.map((definition) => definition.function.name).sort(),
    ['cockpit_list_todos', 'cockpit_search_notes'],
    'Read-only mode never offers mutating tools to the model.'
  );
  assert.equal(registry.definitions('read-write').length, 4, 'Read/write mode exposes every allowlisted tool.');
  assert.equal(registry.definitions('full').length, 4, 'Full access keeps every allowlisted tool available.');

  const autoApproved = await registry.execute('cockpit_create_todo', { text:'免确认任务' }, { autoApprove:true });
  assert.equal(autoApproved.ok, true, 'Full-permission mode executes mutations without a confirmation modal.');

  const parserEvents = [];
  const parser = createAiSseParser((event) => parserEvents.push(event));
  parser.push('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"cockpit_create_todo","arguments":"{\\"text\\":\\"Agent task\\"}"}}]}}]}\n\n');
  parser.push('data: [DONE]\n\n');
  parser.finish();
  assert.ok(parserEvents.some((event) => event.type === 'tool_call_delta'), 'Streaming tool-call deltas are exposed to the Agent loop.');

  const service = new CockpitAIService(plugin);
  const originalFetch = global.fetch;
  const encoder = new TextEncoder();
  const rounds = [
    [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-2","type":"function","function":{"name":"cockpit_create_todo","arguments":"{\\"text\\":\\"Created through loop\\"}"}}]}}]}\n\n',
      'data: [DONE]\n\n'
    ],
    [
      'data: {"choices":[{"delta":{"content":"已创建待办。"}}]}\n\n',
      'data: [DONE]\n\n'
    ]
  ];
  const requestBodies = [];
  global.fetch = async (_url, options) => {
    requestBodies.push(JSON.parse(options.body));
    const chunks = rounds.shift();
    let index = 0;
    return {
      ok:true,
      status:200,
      headers:{ get:() => 'text/event-stream' },
      body:{ getReader:() => ({ read:async () => index < chunks.length ? { done:false, value:encoder.encode(chunks[index++]) } : { done:true } }) }
    };
  };
  const events = [];
  const result = await service.completeAgentStream(
    { action:'custom', question:'创建一个待办', language:'zh-CN' },
    (event) => events.push(event),
    null,
    { confirmTool:async () => true }
  );
  global.fetch = originalFetch;
  assert.equal(result.content, '已创建待办。');
  assert.equal(requestBodies.length, 2, 'The Agent returns tool results to the model for a final answer.');
  assert.ok(requestBodies[1].messages.some((message) => message.role === 'tool'), 'Tool output is isolated in an OpenAI-compatible tool message.');
  assert.ok(events.some((event) => event.type === 'tool' && event.stage === 'completed'), 'Tool execution progress is visible to the sidebar.');

  let compatibilityRequest = null;
  global.fetch = async () => ({ ok:false, status:400, headers:{ get:() => 'application/json' } });
  global.obsidian = {
    requestUrl:async (options) => {
      compatibilityRequest = JSON.parse(options.body);
      return { status:200, json:{ choices:[{ message:{ content:'兼容模式回答' } }] } };
    }
  };
  const compatibilityEvents = [];
  const compatibilityResult = await service.completeAgentStream(
    { action:'custom', question:'普通问题', language:'zh-CN' },
    (event) => compatibilityEvents.push(event)
  );
  global.fetch = originalFetch;
  delete global.obsidian;
  assert.equal(compatibilityResult.content, '兼容模式回答', 'Models without tool calling keep the original assistant available.');
  assert.equal(compatibilityRequest.tools, undefined, 'Compatibility retry removes tool definitions instead of weakening the registry.');
  assert.ok(compatibilityEvents.some((event) => event.type === 'status' && event.stage === 'tools_unavailable'), 'The sidebar can disclose when a model lacks Agent tool support.');

  // ── 服务层权限模式与用量汇总 ─────────────────────────────────────────────────
  {
    const readonlyService = new CockpitAIService(plugin);
    let readonlyToolNames = null;
    readonlyService._requestAgentRound = async (_profile, _key, _messages, tools) => {
      readonlyToolNames = tools.map((definition) => definition.function.name);
      return { reasoning:'', content:'只读完成', toolCalls:[], streamed:true };
    };
    const readonlyEvents = [];
    await readonlyService.completeAgentStream(
      { action:'custom', question:'查一下待办', language:'zh-CN' },
      (event) => readonlyEvents.push(event),
      null,
      { mode:'readonly', confirmTool:async () => { throw new Error('read-only mode must not prompt'); } }
    );
    assert.deepEqual(readonlyToolNames, ['cockpit_list_todos', 'cockpit_search_notes'], 'Read-only requests filter mutating tools before contacting the model.');
    assert.ok(readonlyEvents.some((event) => event.type === 'status' && event.stage === 'agent_mode'), 'The sidebar can show the active permission mode.');

    const fullService = new CockpitAIService(plugin);
    let fullRound = 0;
    fullService._requestAgentRound = async (_profile, _key, _messages, _tools) => {
      fullRound += 1;
      if (fullRound === 1) {
        return {
          reasoning:'', content:'', streamed:true,
          toolCalls:[{ id:'call-full', type:'function', function:{ name:'cockpit_create_todo', arguments:'{"text":"完整权限任务"}' } }]
        };
      }
      return { reasoning:'', content:'已直接创建。', toolCalls:[], streamed:true, usage:{ prompt:12, completion:7, cached:9, cachedKnown:true, total:19 } };
    };
    const fullEvents = [];
    const fullResult = await fullService.completeAgentStream(
      { action:'custom', question:'创建一个任务', language:'zh-CN' },
      (event) => fullEvents.push(event),
      null,
      { mode:'full', confirmTool:async () => { throw new Error('full-permission mode must not prompt'); } }
    );
    assert.equal(fullResult.content, '已直接创建。');
    assert.ok(!fullEvents.some((event) => event.type === 'tool' && event.stage === 'awaiting_confirmation'), 'Full-permission mode never waits for confirmation.');
    assert.ok(fullEvents.some((event) => event.type === 'tool' && event.stage === 'completed'), 'Full-permission tools still report completion.');
    assert.deepEqual(
      fullResult.usage,
      { prompt:12, completion:7, cached:9, cachedKnown:true, total:19 },
      'Provider usage (including cache hits) reaches the caller for display.'
    );
  }

  console.log('AI Agent tool checks passed');
})().catch((error) => {
  delete global.obsidian;
  console.error(error);
  process.exitCode = 1;
});
