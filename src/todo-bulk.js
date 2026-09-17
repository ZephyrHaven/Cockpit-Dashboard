// todo-bulk.js — 基于已提交的行差异撤销；遇到后续编辑时整组拒绝覆盖。
const cockpitTodoUndo = new WeakMap();
function captureTodoUndo(vault, before, after) {
  const rows = text => new Map(parseTodosContent(text).map((todo, index) => [todo.id, { line:buildTodoLine(todo), index }]));
  const old = rows(before), next = rows(after), changes = [];
  for (const id of new Set([...old.keys(), ...next.keys()])) {
    if (old.get(id)?.line !== next.get(id)?.line) changes.push({ id, before:old.get(id) || null, after:next.get(id) || null });
  }
  if (!changes.length) return;
  const history = cockpitTodoUndo.get(vault) || [];
  history.push(changes);
  while (history.length > 20 || JSON.stringify(history).length > 1024 * 1024) history.shift();
  cockpitTodoUndo.set(vault, history);
}
function applyTodoUndo(todos, changes) {
  const current = new Map(todos.map(todo => [todo.id, buildTodoLine(todo)]));
  if (changes.some(change => (current.get(change.id) || null) !== (change.after?.line || null))) return false;
  for (const change of changes) {
    const index = todos.findIndex(todo => todo.id === change.id);
    if (index >= 0) todos.splice(index, 1);
  }
  changes.filter(change => change.before).sort((a,b) => a.before.index - b.before.index).forEach(change => {
    todos.splice(Math.min(change.before.index, todos.length), 0, parseTodosContent(change.before.line)[0]);
  });
  return true;
}
function addTodoBulkSelector(view, item, todo) {
  const selection = view._todoSelection || (view._todoSelection = new Set());
  const input = item.createEl('input', { cls:'cockpit-bulk-check', attr:{ type:'checkbox', 'aria-label':(view._lang() === 'en' ? 'Select: ' : '选择：') + todo.text } });
  input.checked = selection.has(todo.id);
  input.onchange = () => { if (input.checked) selection.add(todo.id); else selection.delete(todo.id); view._updateBulkCount?.(); };
  input.onclick = event => event.stopPropagation();
}
function buildTodoBulkBar(view, parent, visible, commit) {
  const en = view._lang() === 'en', selection = view._todoSelection || (view._todoSelection = new Set());
  const visibleIds = new Set(visible.map(todo => todo.id));
  for (const id of selection) if (!visibleIds.has(id)) selection.delete(id);
  const bar = parent.createDiv({ cls:'cockpit-bulk-bar' });
  const button = (text, action) => { const el = bar.createEl('button',{ text, attr:{type:'button'} }); el.onclick = action; return el; };
  button(en ? 'Select matching tasks' : '选择当前筛选', () => { visible.forEach(todo => selection.add(todo.id)); view._refreshTodosRef?.({persist:false}); });
  button(en ? 'Clear selection' : '清空选择', () => { selection.clear(); view._refreshTodosRef?.({persist:false}); });
  const count = bar.createSpan(); view._updateBulkCount = () => count.setText((en ? 'Selected ' : '已选 ') + selection.size); view._updateBulkCount();
  const action = bar.createEl('select',{attr:{'aria-label':en ? 'Batch operation' : '批量操作'}});
  const actions = [['complete',en?'Complete':'完成'],['due',en?'Set due date':'截止日期'],['high',en?'High priority':'高优先级'],['mid',en?'Medium priority':'中优先级'],['low',en?'Low priority':'低优先级'],['tag',en?'Add tags':'添加标签'],['untag',en?'Remove tags':'移除标签'],['archive',en?'Archive completed':'归档已办'],['restore',en?'Unarchive':'取消归档'],['delete',en?'Delete':'删除']];
  actions.forEach(([value,text]) => action.createEl('option',{text,attr:{value}}));
  const date = bar.createEl('input',{attr:{type:'date','aria-label':en?'Batch due date':'批量截止日期'}});
  const tags = bar.createEl('input',{attr:{type:'text',placeholder:en?'#tags':'#标签','aria-label':en?'Batch tags':'批量标签'}});
  const update = () => { date.hidden = action.value !== 'due'; tags.hidden = !['tag','untag'].includes(action.value); }; action.onchange = update; update();
  let busy = false;
  const apply = button(en?'Apply':'应用', async () => {
    if (busy || !selection.size) return;
    const ids = new Set(selection), operation = action.value;
    const due = date.value ? parseDate(date.value) : null;
    const selectedTags = [...new Set(tags.value.split(/\s+/).map(tag=>tag.replace(/^#+/,'')).filter(Boolean))];
    if ((operation === 'due' && !due) || (['tag','untag'].includes(operation) && !selectedTags.length)) { new obs.Notice(en?'Fill in a date or tags first.':'请先填写日期或标签。'); return; }
    busy = true; apply.disabled = true;
    try {
      const saved = await commit(todos => {
        const targets = todos.filter(todo => ids.has(todo.id));
        if (targets.length !== ids.size || (operation === 'archive' && targets.some(todo=>!todo.done))) return false;
        if (operation === 'delete') { for (let i=todos.length-1;i>=0;i--) if(ids.has(todos[i].id)) todos.splice(i,1); return true; }
        targets.forEach(todo => {
          if (operation === 'complete') { if (!todo.done) { todo.done = true; todo.doneDate = window.moment(); } }
          else if (operation === 'due') { todo.dueDate = due.clone(); todo.dueHasTime = false; }
          else if (['high','mid','low'].includes(operation)) todo.priority = operation;
          else if (operation === 'tag' || operation === 'archive') todo.tags = [...new Set([...(todo.tags||[]), ...(operation==='archive'?['_archived']:selectedTags)])];
          else todo.tags = (todo.tags||[]).filter(tag => !(operation==='restore'?['_archived']:selectedTags).includes(tag));
        });
        return true;
      }, en?'Tasks changed, or archiving includes open tasks. Refresh and select completed tasks.':'任务已变化，或选择中含有未完成项；请刷新，归档时只选择已办任务。');
      if (saved) { selection.clear(); await view._refreshTodosRef?.({persist:false}); }
    } finally { busy = false; apply.disabled = false; }
  });
  const history = cockpitTodoUndo.get(view.app.vault);
  const undo = button(en?'Undo last change':'撤销上次修改', async () => {
    if (busy) return;
    const changes = cockpitTodoUndo.get(view.app.vault)?.at(-1); if (!changes) return;
    busy = true; undo.disabled = true;
    try { if(await commit(todos=>applyTodoUndo(todos,changes),en?'A task changed since this operation. Undo was not applied.':'相关任务已有后续修改，无法安全撤销；内容未覆盖。',{undo:false})) { const entries=cockpitTodoUndo.get(view.app.vault); if(entries?.at(-1)===changes) entries.pop(); await view._refreshTodosRef?.({persist:false}); } }
    finally { busy = false; undo.disabled = false; }
  }); undo.disabled = !history?.length;
}
