const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { nextTodoRepeatDate, normalizeTodoRepeat } = require('../src/todo-repeat.js');
const { ensureTodoIds } = require('../src/todo-focus.js');

const scheduled = (date, unit, interval = 1, anchor = date) => ({ dueDate:date, repeat:{ unit, interval, mode:'scheduled', anchor } });
assert.equal(nextTodoRepeatDate(scheduled('2026-01-31', 'month'), '2026-01-31'), '2026-02-28');
assert.equal(nextTodoRepeatDate(scheduled('2026-02-28', 'month', 1, '2026-01-31'), '2026-02-28'), '2026-03-31', 'The original month-end anchor survives short months.');
assert.equal(nextTodoRepeatDate(scheduled('2024-02-29', 'year'), '2027-03-01'), '2028-02-29', 'Leap-day schedules recover their original day.');
assert.equal(nextTodoRepeatDate(scheduled('2026-09-07', 'week'), '2026-09-17'), '2026-09-21', 'Missed occurrences do not create a backlog.');
assert.equal(nextTodoRepeatDate(scheduled('2000-01-01', 'day'), '2026-09-17'), '2026-09-18', 'Long-overdue schedules advance directly.');
assert.equal(nextTodoRepeatDate({ ...scheduled('2026-09-16T09:30', 'day'), dueHasTime:true }, '2026-09-17T10:00'), '2026-09-18T09:30');
assert.equal(nextTodoRepeatDate({ repeat:{ unit:'day', interval:3, mode:'completion' } }, '2026-09-17'), '2026-09-20');
assert.equal(nextTodoRepeatDate({ repeat:{ unit:'month', interval:1, mode:'scheduled' } }, '2026-09-17'), '');
assert.equal(normalizeTodoRepeat({ unit:'week', interval:0 }), null);
assert.equal(normalizeTodoRepeat({ unit:'week', interval:1.5 }), null);
assert.equal(normalizeTodoRepeat('{broken'), null);
assert.equal(normalizeTodoRepeat({ unit:'day', interval:1, mode:'unknown' }), null);
assert.equal(nextTodoRepeatDate(scheduled('2026-02-30', 'month'), '2026-09-17'), '');

const dateRef = (text) => ({ format:(format) => format === 'YYYY-MM-DD' ? text.slice(0, 10) : text });
const context = vm.createContext({ require, console:{ warn:() => {} }, TODO_FILE:'_data/todos.md', ensureTodoIds,
  window:{ moment:() => dateRef('2026-09-17T12:00') }, parseDate:dateRef,
  extractTags:(raw) => {
    const match = raw.match(/ due:(\S+)/);
    return { cleanText:raw.replace(/ due:\S+/, ''), tags:[], priority:'mid', dueDate:match ? dateRef(match[1]) : null, dueHasTime:!!match?.[1].includes('T') };
  } });
vm.runInContext(fs.readFileSync('src/todo-repeat.js', 'utf8') + '\n' + fs.readFileSync('src/todos.js', 'utf8')
  + '\nthis.api={loadTodos,mutateTodos,saveTodos,parseTodosContent};', context);

(async () => {
  let content = '# Tasks\n<!-- keep notes -->\n- [ ] Meeting due:2026-09-14 | id:meeting | owner:alice | repeat:{"unit":"week","interval":1,"mode":"scheduled","anchor":"2026-09-14"}\n';
  let writes = 0, fail = false;
  const file = { path:'_data/todos.md' };
  const vault = { getAbstractFileByPath:() => file, read:async () => content,
    modify:async (_file, next) => { if (fail) throw new Error('disk full'); writes++; content = next; } };
  const complete = (todos) => { const task = todos.find((item) => item.id === 'meeting'); task.done = true; task.doneDate = dateRef('2026-09-17T12:00'); return true; };
  await Promise.all([context.api.mutateTodos(vault, complete), context.api.mutateTodos(vault, complete)]);
  let tasks = await context.api.loadTodos(vault);
  assert.equal(tasks.length, 2, 'Concurrent completion generates only one next occurrence.');
  assert.equal(tasks[0].done, true);
  assert.equal(tasks[1].dueDate.format('YYYY-MM-DD'), '2026-09-21');
  assert.equal(tasks[0].repeatNext, tasks[1].id);
  assert.match(content, /<!-- keep notes -->/);
  assert.match(content, /owner:alice/);
  assert.equal(tasks[1].repeatRoot, 'meeting');
  const savedWrites = writes;
  await context.api.loadTodos(vault); await context.api.loadTodos(vault);
  assert.equal(writes, savedWrites, 'Reopening a completed series does not rewrite it or generate duplicates.');
  await context.api.mutateTodos(vault, (todos) => { const task = todos.find((item) => item.id === 'meeting'); task.done = false; return true; });
  await context.api.mutateTodos(vault, complete);
  assert.equal((await context.api.loadTodos(vault)).length, 2, 'Re-completing a historical occurrence does not clone its successor.');
  await context.api.mutateTodos(vault, (todos) => { todos[1].repeat = null; todos[1].done = true; return true; });
  assert.equal((await context.api.loadTodos(vault)).length, 2, 'Turning repeat off on the next task stops the series.');

  // Hand-written completion is recovered as one atomic parent + successor write.
  content = '- [x] Manual due:2026-09-14 | id:manual | repeat:{"unit":"week","interval":1,"mode":"scheduled"}\n';
  fail = true;
  tasks = await context.api.loadTodos(vault);
  assert.equal(tasks.length, 1, 'Failed recovery never invents an unpersisted occurrence.');
  assert.equal(tasks[0].repeatNext, '');
  fail = false;
  tasks = await context.api.loadTodos(vault);
  assert.equal(tasks.length, 2);
  const nextId = tasks[1].id;
  assert.equal((await context.api.loadTodos(vault))[1].id, nextId);

  content = content.replace('- [x] Manual', '- [ ] Manual');
  tasks = await context.api.loadTodos(vault);
  tasks[1].repeat = { unit:'day', interval:1, mode:'completion' }; tasks[1].done = true;
  fail = true;
  assert.equal(await context.api.saveTodos(vault, tasks), false);
  assert.equal(tasks.length, 2, 'A failed save leaves generated successors out of caller state.');
  assert.equal(tasks[1].repeatNext, '');
  fail = false;
  assert.equal(await context.api.saveTodos(vault, tasks), true);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[2].id.startsWith('repeat-'), true);
  content = '- [ ] Future rule | id:future | repeat:{"unit":"future","interval":1}\n';
  await context.api.mutateTodos(vault, (todos) => { todos[0].text = 'Keep future rule'; return true; });
  assert.match(content, /repeat:\{"unit":"future","interval":1\}/, 'Unknown repeat formats survive unrelated task edits.');
  console.log('Repeat schedule and persistence checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
