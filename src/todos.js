// todos.js — 待办数据层：加载/保存/同步

let todoFileMutationQueue = Promise.resolve();

function queueTodoFileMutation(operation) {
  const next = todoFileMutationQueue.catch(() => {}).then(operation);
  todoFileMutationQueue = next;
  return next;
}

function parseTodosContent(content) {
  const todos = [];
  for (const line of String(content || '').split('\n')) {
    const m = line.match(/^-\s+\[([ x])\]\s+(.+?)(?:\s*\|\s*(.+))?\s*$/);
    if (!m) continue;
    const meta = m[3] || '';
    const cm = meta.match(/created:\s*(\S+)/);
    const dm = meta.match(/done:\s*(\S+)/);
    const im = meta.match(/(?:^|\|)\s*id:\s*([^\s|]+)/);
    const created = cm ? parseDate(cm[1]) : null;
    const doneDate = dm ? parseDate(dm[1]) : null;
    const rawText = m[2].trim();
    const { cleanText, tags, dueDate, dueHasTime, priority } = extractTags(rawText);
    todos.push({ id:im ? im[1] : '', text:cleanText, tags, priority, dueDate, dueHasTime, done:m[1] === 'x', created, doneDate });
  }
  return todos;
}

function serializeTodos(todos) {
  const prefix = '# 待办事项\n\n';
  const lines = todos.map((t) => {
    const meta = ['id:' + t.id];
    if (t.created) meta.push('created: ' + t.created.format('YYYY-MM-DD'));
    if (t.done && t.doneDate) meta.push('done: ' + t.doneDate.format('YYYY-MM-DD'));
    let text = t.text;
    if (t.tags && t.tags.length > 0) text += ' ' + t.tags.map((tag) => '#' + tag).join(' ');
    if (t.dueDate) text += ' due:' + t.dueDate.format(t.dueHasTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD');
    if (t.priority && t.priority !== 'mid') text += ' p:' + t.priority;
    return '- [' + (t.done ? 'x' : ' ') + '] ' + text + ' | ' + meta.join(' | ');
  });
  return prefix + lines.join('\n') + '\n';
}

function patchTodoIdsInContent(content, todos, changedIndexes) {
  const changed = new Set(changedIndexes);
  let todoIndex = 0;
  return String(content || '').split('\n').map((line) => {
    // 与 parseTodosContent 使用同一条件；空标题行不会消耗 todoIndex。
    if (!/^-\s+\[[ x]\]\s+.+/.test(line)) return line;
    const index = todoIndex++;
    if (!changed.has(index) || !todos[index]?.id) return line;
    const id = todos[index].id;
    if (/(\|\s*id:\s*)[^\s|]+/.test(line)) {
      return line.replace(/(\|\s*id:\s*)[^\s|]+/, '$1' + id);
    }
    return line.replace(/\s*$/, '') + ' | id:' + id;
  }).join('\n');
}

async function writeTodosUnlocked(vault, todos) {
  try {
    const dir = TODO_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    const content = serializeTodos(todos);
    const file = vault.getAbstractFileByPath(TODO_FILE);
    if (file) await vault.modify(file, content);
    else await vault.create(TODO_FILE, content);
    return true;
  } catch(e) { console.warn('saveTodos',e); return false; }
}

async function loadTodos(vault) {
  return queueTodoFileMutation(async () => {
    try {
      const file = vault.getAbstractFileByPath(TODO_FILE);
      if (!file) return null;
      const content = await vault.read(file);
      const todos = parseTodosContent(content);
      if (!todos.length) return null;
      const originalIds = todos.map((todo) => todo.id || '');
      ensureTodoIds(todos);
      const changedIndexes = todos.flatMap((todo, index) => todo.id !== originalIds[index] ? [index] : []);
      if (changedIndexes.length) {
        let migrated = false;
        try {
          await vault.modify(file, patchTodoIdsInContent(content, todos, changedIndexes));
          migrated = true;
        } catch (e) {
          console.warn('migrate todo ids', e);
        }
        if (!migrated) {
          // 未落盘的随机 ID 不能用于番茄统计，否则下次加载会变成孤儿记录。
          changedIndexes.forEach((index) => { todos[index].id = ''; });
        }
      }
      return todos;
    } catch(e) {
      console.warn('loadTodos', e);
      return null;
    }
  });
}

async function saveTodos(vault, todos) {
  return queueTodoFileMutation(async () => {
    const originalIds = (Array.isArray(todos) ? todos : []).map((todo) => todo?.id || '');
    ensureTodoIds(todos);
    const changedIndexes = todos.flatMap((todo, index) => todo.id !== originalIds[index] ? [index] : []);
    const saved = await writeTodosUnlocked(vault, todos);
    if (!saved) changedIndexes.forEach((index) => { todos[index].id = ''; });
    return saved;
  });
}

async function mutateTodos(vault, mutator) {
  return queueTodoFileMutation(async () => {
    try {
      const file = vault.getAbstractFileByPath(TODO_FILE);
      const todos = file ? parseTodosContent(await vault.read(file)) : [];
      ensureTodoIds(todos);
      const result = await mutator(todos);
      if (result === false) return { saved:false, todos, result };
      ensureTodoIds(todos);
      const saved = await writeTodosUnlocked(vault, todos);
      return { saved, todos, result };
    } catch (e) {
      console.warn('mutateTodos', e);
      return { saved:false, todos:null, result:null };
    }
  });
}

async function syncHermesTodos(vault, existingTodos) {
  try {
    const today = window ? window.moment().format('YYYY-MM-DD') : new Date().toISOString().slice(0,10);
    const outcome = await mutateTodos(vault, (todos) => {
      let changed = false;
      if (!todos.length && Array.isArray(existingTodos) && existingTodos.length) {
        todos.push(...existingTodos.map((todo) => ({ ...todo })));
        changed = true;
      }
      for (const ht of HERMES_TODOS) {
        if (todos.some((todo) => todo.text === ht.text)) continue;
        todos.push({
          text:ht.text, tags:ht.tags, priority:ht.priority,
          dueDate:ht.dueDate ? window.moment(ht.dueDate, 'YYYY-MM-DD', true) : null,
          done:ht.done,
          created:window.moment(today, 'YYYY-MM-DD', true),
          doneDate:ht.done ? window.moment(today, 'YYYY-MM-DD', true) : null
        });
        changed = true;
      }
      return changed ? true : false;
    });
    if (outcome.saved && outcome.todos) {
      existingTodos.splice(0, existingTodos.length, ...outcome.todos);
    }
  } catch(e) { console.warn('syncHermesTodos', e); }
}
