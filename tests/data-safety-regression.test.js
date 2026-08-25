#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Regression coverage for the data-safety fixes:
// 1. todos.md writes use line-level patching and keep user-authored content.
// 2. An existing-but-empty todos.md is a legal "all cleared" state.
// 3. mutatePluginData skips disk writes when nothing actually changed.
// 4. SSE error payloads inside a stream surface as stream_error events.

const root = path.resolve(__dirname, '..');
const { mutatePluginData } = require(path.join(root, 'src/data-store.js'));
const { createAiSseParser } = require(path.join(root, 'src/ai.js'));

(async () => {
  // --- 1) Line-level todo patching preserves user content ------------------

  const todoContext = vm.createContext({
    console:{ warn:() => {} },
    TODO_FILE:'_data/todos.md',
    ensureTodoIds:(todos) => todos,
    parseDate:(value) => ({ value, format:() => value }),
    extractTags:(text) => ({ cleanText:text, tags:[], dueDate:null, priority:'mid' })
  });
  const todoSource = fs.readFileSync(path.join(root, 'src/todos.js'), 'utf8');
  vm.runInContext(todoSource + '\nglobalThis.mutateTodosForTest = mutateTodos; globalThis.loadTodosForTest = loadTodos;', todoContext);

  let fileContent = [
    '# 待办事项',
    '',
    '<!-- 手写的备注，必须保留 -->',
    '  - [ ] Indented child task',
    '- [ ] Buy milk | id:milk | owner:alice',
    '## 自定义小节',
    '- [ ] Ship release | id:ship'
  ].join('\n') + '\n';
  const patchVault = {
    getAbstractFileByPath:(p) => p === '_data/todos.md' ? { path:p } : (p === '_data' ? {} : null),
    read:async () => fileContent,
    modify:async (_file, content) => { fileContent = content; }
  };

  const outcome = await todoContext.mutateTodosForTest(patchVault, (todos) => {
    const ship = todos.find((t) => t.id === 'ship');
    ship.done = true;
    return true;
  });
  assert.equal(outcome.saved, true, 'Patched todo write reports success.');
  assert.match(fileContent, /<!-- 手写的备注，必须保留 -->/, 'User comments survive todo updates.');
  assert.match(fileContent, /## 自定义小节/, 'Custom sections survive todo updates.');
  assert.match(fileContent, /owner:alice/, 'Unknown metadata on untouched lines survives.');
  assert.match(fileContent, /^ {2}- \[ \] Indented child task$/m, 'Indented lines keep their indentation.');
  assert.equal(fileContent.includes('- [x] Ship release | id:ship'), true, 'The targeted todo line is updated in place.');
  assert.equal(fileContent.includes('- [ ] Ship release'), false, 'No duplicate stale line is left behind.');

  // Deleting every todo keeps unrelated content instead of rewriting a template.
  await todoContext.mutateTodosForTest(patchVault, (todos) => {
    todos.splice(0, todos.length);
    return true;
  });
  assert.equal(fileContent.includes('- [ ] Only task') || fileContent.includes('- [ ] Ship release'), false, 'Deleted todos disappear from the file.');
  assert.match(fileContent, /<!-- 手写的备注，必须保留 -->/, 'Clearing all todos still preserves user notes.');

  // --- 2) Existing-but-empty todos.md is not "missing" ---------------------

  const emptyVault = {
    getAbstractFileByPath:(p) => p === '_data/todos.md' ? { path:p } : (p === '_data' ? {} : null),
    read:async () => '# 待办事项\n',
    modify:async () => {}
  };
  const clearedTodos = await todoContext.loadTodosForTest(emptyVault);
  assert.equal(Array.isArray(clearedTodos) && clearedTodos.length === 0, true, 'An existing todos.md without items loads as an empty list, not as missing.');

  // --- 3) mutatePluginData skips unchanged writes --------------------------

  let saveCalls = 0;
  let stored = { alarms:[{ id:'a', time:'08:00' }] };
  const plugin = {
    loadData:async () => JSON.parse(JSON.stringify(stored)),
    saveData:async (data) => { saveCalls += 1; stored = JSON.parse(JSON.stringify(data)); }
  };
  for (let i = 0; i < 5; i++) {
    await mutatePluginData(plugin, (data) => {
      // 周期性 tick 的典型形态：每次都赋值 normalize 后的新数组，但内容不变。
      data.alarms = data.alarms.map((alarm) => ({ ...alarm }));
    });
  }
  assert.equal(saveCalls, 1, 'Unchanged periodic mutations only hit the disk once.');
  await mutatePluginData(plugin, (data) => { data.alarms[0].time = '09:30'; });
  assert.equal(saveCalls, 2, 'Real changes are still persisted immediately.');
  assert.equal(stored.alarms[0].time, '09:30');

  // --- 4) SSE in-stream errors surface ------------------------------------

  const events = [];
  const parser = createAiSseParser((event) => events.push(event));
  parser.push('data: {"error":{"message":"model overloaded"}}\n\n');
  parser.finish();
  const streamError = events.find((event) => event.type === 'stream_error');
  assert.ok(streamError, 'In-stream error payloads become stream_error events.');
  assert.equal(streamError.message, 'model overloaded');

  console.log('Data-safety regression checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
