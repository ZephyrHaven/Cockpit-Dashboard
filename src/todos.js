// todos.js — 待办数据层：加载/保存/同步

let todoFileMutationQueue = Promise.resolve();

function queueTodoFileMutation(operation) {
  const next = todoFileMutationQueue.catch(() => {}).then(operation);
  todoFileMutationQueue = next;
  return next;
}

function splitTodoMeta(meta) {
  const managed = {};
  const extra = [];
  String(meta || '').split('|').forEach((segment) => {
    const part = segment.trim();
    if (!part) return;
    const km = part.match(/^(id|created|done)\s*:\s*([\s\S]+)$/);
    if (!km) { extra.push(part); return; }
    managed[km[1]] = km[2].trim();
  });
  return { managed, extra };
}

function parseTodoLine(line) {
  const m = String(line || '').match(/^(\s*)-\s+\[([xX ])\]\s+(.+?)(?:\s*\|\s*(.+))?\s*$/);
  if (!m) return null;
  const { managed, extra } = splitTodoMeta(m[4]);
  const created = managed.created ? parseDate(managed.created) : null;
  const doneDate = managed.done ? parseDate(managed.done) : null;
  const rawText = m[3].trim();
  const { cleanText, tags, dueDate, dueHasTime, priority } = extractTags(rawText);
  return {
    indent:m[1], id:managed.id || '', text:cleanText, tags, priority,
    dueDate, dueHasTime, done:m[2].toLowerCase() === 'x', created, doneDate,
    // 行上无法识别的元数据（如 owner:xxx）原样带回，写入时回填，避免被规范化抹掉。
    _extraMeta:extra
  };
}

function parseTodosContent(content) {
  const todos = [];
  for (const line of String(content || '').split('\n')) {
    const entry = parseTodoLine(line);
    if (!entry) continue;
    todos.push({ id:entry.id, text:entry.text, tags:entry.tags, priority:entry.priority, dueDate:entry.dueDate, dueHasTime:entry.dueHasTime, done:entry.done, created:entry.created, doneDate:entry.doneDate, _extraMeta:entry._extraMeta });
  }
  return todos;
}

function buildTodoLine(t, indent = '') {
  const meta = [];
  if (t.id) meta.push('id:' + t.id);
  if (t.created) meta.push('created: ' + t.created.format('YYYY-MM-DD'));
  if (t.done && t.doneDate) meta.push('done: ' + t.doneDate.format('YYYY-MM-DD'));
  // 回填行上原有的非受管元数据段（如 owner:xxx）。
  if (Array.isArray(t._extraMeta)) {
    t._extraMeta.forEach((segment) => { const part = String(segment || '').trim(); if (part) meta.push(part); });
  }
  let text = t.text;
  if (t.tags && t.tags.length > 0) text += ' ' + t.tags.map((tag) => '#' + tag).join(' ');
  if (t.dueDate) text += ' due:' + t.dueDate.format(t.dueHasTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD');
  if (t.priority && t.priority !== 'mid') text += ' p:' + t.priority;
  return indent + '- [' + (t.done ? 'x' : ' ') + '] ' + text + (meta.length ? ' | ' + meta.join(' | ') : '');
}

function serializeTodos(todos) {
  const prefix = '# 待办事项\n\n';
  const lines = todos.map((t) => buildTodoLine(t));
  return prefix + lines.join('\n') + '\n';
}

function patchTodoIdsInContent(content, todos, changedIndexes) {
  const changed = new Set(changedIndexes);
  let todoIndex = 0;
  return String(content || '').split('\n').map((line) => {
    // 与 parseTodoLine 使用同一条件；空标题行不会消耗 todoIndex。
    if (!/^(\s*)-\s+\[[xX ]\]\s+.+/.test(line)) return line;
    const index = todoIndex++;
    if (!changed.has(index) || !todos[index]?.id) return line;
    const id = todos[index].id;
    if (/(\|\s*id:\s*)[^\s|]+/.test(line)) {
      return line.replace(/(\|\s*id:\s*)[^\s|]+/, '$1' + id);
    }
    return line.replace(/\s*$/, '') + ' | id:' + id;
  }).join('\n');
}

// 行级补丁写入：按 id 原位更新/删除待办行，新增行追加在最后一个待办行之后；
// 用户手写的注释、子任务缩进、其它小节等内容原样保留，不再整体重新生成文件。
function buildPatchedTodoContent(content, todos) {
  const list = Array.isArray(todos) ? todos : [];
  const lines = String(content || '').split('\n');
  const parsed = lines.map(parseTodoLine);
  const todoById = new Map(list.filter((t) => t && t.id).map((t) => [t.id, t]));
  const claimedLines = new Set();
  // 1) 带 id 的行：id 不在目标集合（或重复出现）→ 删除；存在 → 原位重写为最新内容。
  parsed.forEach((entry, index) => {
    if (!entry || !entry.id) return;
    const todo = todoById.get(entry.id);
    if (!todo || claimedLines.has(todo.id)) { lines[index] = null; return; }
    claimedLines.add(todo.id);
    lines[index] = buildTodoLine(todo, entry.indent || '');
  });
  // 2) 无 id 的旧行按 cleanText 匹配剩余待办（兼容旧文件 / 随机 ID 未落盘的场景）。
  const remaining = list.filter((todo) => todo && (!todo.id || !claimedLines.has(todo.id)));
  parsed.forEach((entry, index) => {
    if (!entry || entry.id || !entry.text || !remaining.length) return;
    const matchIndex = remaining.findIndex((todo) => todo && todo.text === entry.text);
    if (matchIndex === -1) return;
    lines[index] = buildTodoLine(remaining[matchIndex], entry.indent || '');
    remaining.splice(matchIndex, 1);
  });
  // 3) 其余待办视为新条目，追加到最后一个待办行之后。
  let lastTodoLine = -1;
  parsed.forEach((entry, index) => { if (entry && lines[index] != null) lastTodoLine = index; });
  if (lastTodoLine === -1) {
    if (!remaining.length) return null;
    return serializeTodos(list);
  }
  lines.splice(lastTodoLine + 1, 0, ...remaining.map((todo) => buildTodoLine(todo, '')));
  const body = lines.filter((line) => line != null).join('\n');
  return body.endsWith('\n') ? body : body + '\n';
}

async function writeTodosUnlocked(vault, todos) {
  try {
    const dir = TODO_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    const file = vault.getAbstractFileByPath(TODO_FILE);
    if (!file) {
      await vault.create(TODO_FILE, serializeTodos(todos));
      return true;
    }
    let content = null;
    try { content = typeof vault.read === 'function' ? await vault.read(file) : null; } catch (e) { content = null; }
    // 无法读取现有内容时退回整文件写入：宁可牺牲对未知内容的保留，也不能丢掉本次待办更新。
    if (typeof content !== 'string') {
      await vault.modify(file, serializeTodos(todos));
      return true;
    }
    const patched = buildPatchedTodoContent(content, todos);
    // 文件里已没有任何可识别的待办行且也没有新行要追加时，说明是空结构文件，
    // 保持原样即可（清空全部待办后不应被默认内容或模板重写）。
    if (patched !== null && patched !== content) await vault.modify(file, patched);
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
      // 文件存在但没有待办：返回空数组（合法的“已清空”状态），
      // 与“文件不存在”（返回 null，触发默认待办）区分开。
      if (!todos.length) return [];
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
