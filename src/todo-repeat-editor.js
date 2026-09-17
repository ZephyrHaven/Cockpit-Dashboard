// todo-repeat-editor.js — 复用现有待办编辑器；无需额外的仪表盘模块或浮层。
function buildTodoRepeatEditor(body, draft, language, completed) {
  const en = language === 'en';
  const field = body.createDiv({ cls:PLUGIN_ID + '-todo-editor-field' });
  field.createDiv({ cls:PLUGIN_ID + '-todo-editor-label', text:en ? 'Repeat' : '重复' });
  const row = field.createDiv({ cls:PLUGIN_ID + '-todo-repeat-controls' });
  const unit = row.createEl('select', { attr:{ 'aria-label':en ? 'Repeat frequency' : '重复频率' } });
  [['', en ? 'Never' : '不重复'], ['day', en ? 'Day' : '天'], ['week', en ? 'Week' : '周'],
    ['month', en ? 'Month' : '月'], ['year', en ? 'Year' : '年']].forEach(([value, text]) => unit.createEl('option', { text, attr:{ value } }));
  const interval = row.createEl('input', { attr:{ type:'number', min:'1', max:'365', step:'1', 'aria-label':en ? 'Repeat interval' : '重复间隔' } });
  const mode = row.createEl('select', { attr:{ 'aria-label':en ? 'Repeat schedule' : '重复排期方式' } });
  mode.createEl('option', { text:en ? 'Fixed schedule' : '按固定排期', attr:{ value:'scheduled' } });
  mode.createEl('option', { text:en ? 'After completion' : '完成后间隔', attr:{ value:'completion' } });
  const note = field.createDiv({ cls:PLUGIN_ID + '-todo-editor-hint', attr:{ 'aria-live':'polite' } });
  const original = normalizeTodoRepeat(draft.repeat);
  unit.value = original?.unit || '';
  interval.value = String(original?.interval || 1);
  mode.value = original?.mode || 'scheduled';
  const read = () => unit.value ? normalizeTodoRepeat({ unit:unit.value, interval:Number(interval.value), mode:mode.value,
    anchor:original?.unit === unit.value && original?.mode === mode.value ? original.anchor : undefined }) : null;
  const refresh = () => {
    interval.disabled = mode.disabled = completed || !unit.value;
    unit.disabled = completed;
    draft.repeat = read();
    if (completed) { note.setText(en ? 'Completed occurrences keep their history. Edit the next open task to change the series.' : '已完成记录保留原规则；请编辑下一条未完成待办来调整或停止重复。'); return; }
    if (!unit.value) { note.setText(en ? 'One-time task.' : '只执行一次。'); return; }
    const next = nextTodoRepeatDate({ ...draft, repeat:draft.repeat }, window.moment());
    note.setText(!draft.repeat ? (en ? 'Enter an interval from 1 to 365.' : '重复间隔须为 1–365 的整数。')
      : !next ? (en ? 'Set a due date for a fixed schedule.' : '按固定排期需要设置截止日期。')
      : (en ? 'If completed today, next due: ' : '今天完成后，下次截止：') + next.replace('T', ' ') + (en ? '. Each completion is kept; missed cycles are skipped.' : '。每次完成记录独立保留，错过的周期会跳过。'));
  };
  [unit, interval, mode].forEach((input) => input.addEventListener('change', refresh));
  refresh();
  return { refresh, validate(dueDate) {
    if (!unit.value) return true;
    draft.repeat = read();
    if (!draft.repeat) { interval.focus(); return false; }
    if (draft.repeat.mode === 'scheduled' && !dueDate) return false;
    return true;
  } };
}
