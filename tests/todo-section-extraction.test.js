#!/usr/bin/env node
// todo-section-extraction.test.js — 回归守卫：待办列表区已拆到 todo-section.js，
// _framework.js 只保留薄调用。防止待办渲染逻辑被重新堆回 God 文件，或拆出的模块与委托脱节。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const framework = read('src/_framework.js');
const todoPath = path.join(root, 'src', 'todo-section.js');
assert.ok(fs.existsSync(todoPath), 'todo-section.js exists as its own module.');
const todo = read('src/todo-section.js');
const build = read('build.js');

// 1) 模块注册到 build.js MODULES，且在 _framework.js 之前拼接。
assert.ok(build.includes("'todo-section.js'"), 'todo-section.js is registered in build.js MODULES.');
assert.ok(
  build.indexOf("'todo-section.js'") < build.indexOf("'_framework.js'"),
  'todo-section.js is concatenated before _framework.js.'
);

// 2) 导出函数实现 + 返回句柄。
assert.match(todo, /async function cockpitBuildTodoSection\(view, root, ctx\)/, 'cockpitBuildTodoSection is implemented in todo-section.js.');
assert.match(todo, /return \{ refreshTodos: renderTodos, openTodoEditor, statusSelect, setFilter, scrollToTodo \}/, 'The todo module returns the handles the framework still needs.');

// 3) _framework.js 不再携带待办渲染主体：这些实现特有 token 只应出现在 todo-section.js。
const movedTokens = ['-todo-btn alarm', 'groupTodayTodos(', 'buildTodoBulkBar(', 'renderTodos = async function'];
for (const token of movedTokens) {
  assert.ok(todo.includes(token), token + ' lives in todo-section.js.');
  assert.ok(!framework.includes(token), token + ' must not reappear in _framework.js.');
}

// 4) 框架侧通过薄调用使用该模块，并持有返回的过滤器句柄。
assert.match(framework, /await cockpitBuildTodoSection\(this, root, \{/, 'Framework builds the todo section via the module.');
assert.match(framework, /const \{ setFilter: setTodoFilter, scrollToTodo \} = todoSection;/, 'Framework destructures the returned handles.');

// 5) 拆出后 _framework.js 体积明显缩小（待办区曾约 400 行）。
const frameworkLines = framework.split('\n').length;
assert.ok(frameworkLines < 2000, '_framework.js stays lean after the todo extraction (now ' + frameworkLines + ' lines).');

// 6) ctx 依赖完整性守卫：todo-section 引用的 _buildAll 局部函数/数据必须经 ctx 注入，
//    防止拆分后引用未注入的块内局部变量导致运行时 ReferenceError（曾致整页空白）。
{
  // 这些是曾从 _buildAll 泄漏进待办区的块内局部绑定，必须出现在委托处传入的 ctx 对象构造里。
  const requiredCtx = [
    'refreshLinkedAlarmTodoIds',
    'openTodoAlarm',
    'decomposeTodoWithAi',
    'getLinkedAlarmTodoIds',
    'commitTodoMutation',
    'openTodoEditor',
    'incrementTodoProgress',
    'updateStats',
    'makeCollapsible',
  ];
  // 委托调用区（await cockpitBuildTodoSection(...) 到分号收尾）里必须逐一声明。
  const callMatch = framework.match(/await cockpitBuildTodoSection\(this, root, \{([\s\S]*?)\}\);/);
  assert.ok(callMatch, 'Framework passes a ctx object to cockpitBuildTodoSection.');
  const ctxBody = callMatch[1];
  for (const name of requiredCtx) {
    assert.ok(
      new RegExp('(^|[\\s,{])' + name + '\\s*[:,]').test(ctxBody),
      'ctx passed to cockpitBuildTodoSection must provide ' + name + '.'
    );
  }
  // todo-section 顶部必须从 ctx 解构这些注入项。
  const destructure = todo.match(/const\s*\{([\s\S]*?)\}\s*=\s*ctx/);
  assert.ok(destructure, 'todo-section destructures its ctx dependencies.');
  for (const name of requiredCtx) {
    assert.ok(
      destructure[1].includes(name),
      'todo-section must destructure ' + name + ' from ctx.'
    );
  }
  // 拆出后的 todo-section 不得再直接引用 linkedAlarmTodoIds（应改用 getLinkedAlarmTodoIds()）。
  assert.ok(!/\blinkedAlarmTodoIds\b/.test(todo), 'todo-section must read linked alarm ids via getLinkedAlarmTodoIds(), not the block-local variable.');
}

console.log('Todo section extraction checks passed');
