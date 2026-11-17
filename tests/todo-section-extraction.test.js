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

console.log('Todo section extraction checks passed');
