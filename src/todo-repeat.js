// todo-repeat.js — 重复待办的日期计算与幂等展开；完成记录仍保留在原待办文件中。
function normalizeTodoRepeat(raw) {
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { return null; } }
  if (!raw || !['day', 'week', 'month', 'year'].includes(raw.unit)) return null;
  if (raw.mode != null && !['scheduled', 'completion'].includes(raw.mode)) return null;
  const interval = Number(raw.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) return null;
  const rule = { unit:raw.unit, interval, mode:raw.mode === 'completion' ? 'completion' : 'scheduled' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.anchor || '')) rule.anchor = raw.anchor;
  return rule;
}

function todoRepeatDateParts(value) {
  const text = value && typeof value.format === 'function'
    ? value.format('YYYY-MM-DDTHH:mm') : String(value || '');
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, h = '0', min = '0'] = match;
  const date = new Date(0);
  date.setFullYear(Number(y), Number(m) - 1, Number(d));
  date.setHours(Number(h), Number(min), 0, 0);
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)
    || Number(h) > 23 || Number(min) > 59) return null;
  return date;
}

function todoRepeatDateText(date, hasTime) {
  const pad = (value) => String(value).padStart(2, '0');
  const key = String(date.getFullYear()).padStart(4, '0') + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  return key + (hasTime ? 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) : '');
}

function nextTodoRepeatDate(todo, completedAt) {
  const rule = normalizeTodoRepeat(todo?.repeat);
  const completed = todoRepeatDateParts(completedAt);
  const due = todoRepeatDateParts(todo?.dueDate);
  if (!rule || !completed || (rule.mode === 'scheduled' && !due)) return '';
  const base = rule.mode === 'completion' ? completed : due;
  const anchor = rule.mode === 'scheduled' ? (todoRepeatDateParts(rule.anchor) || due) : base;
  const advance = (steps) => {
    const next = new Date(base.valueOf());
    const amount = steps * rule.interval;
    if (rule.unit === 'day' || rule.unit === 'week') next.setDate(base.getDate() + amount * (rule.unit === 'week' ? 7 : 1));
    else {
      next.setDate(1);
      if (rule.unit === 'month') next.setMonth(base.getMonth() + amount);
      else { next.setFullYear(base.getFullYear() + amount); next.setMonth(anchor.getMonth()); }
      const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(anchor.getDate(), last));
    }
    if (todo.dueHasTime && due) next.setHours(due.getHours(), due.getMinutes(), 0, 0);
    else next.setHours(0, 0, 0, 0);
    return next;
  };
  let steps = 1;
  if (rule.mode === 'scheduled') {
    let difference;
    if (rule.unit === 'month') difference = (completed.getFullYear() - base.getFullYear()) * 12 + completed.getMonth() - base.getMonth();
    else if (rule.unit === 'year') difference = completed.getFullYear() - base.getFullYear();
    else difference = (Date.UTC(completed.getFullYear(), completed.getMonth(), completed.getDate())
      - Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) / 86400000 / (rule.unit === 'week' ? 7 : 1);
    steps = Math.max(1, Math.floor(difference / rule.interval));
  }
  let next = advance(steps);
  const floor = new Date(completed.valueOf());
  if (!todo.dueHasTime) floor.setHours(0, 0, 0, 0);
  while (next <= floor) next = advance(++steps);
  return next.getFullYear() <= 9999 ? todoRepeatDateText(next, !!todo.dueHasTime) : '';
}

function expandTodoRepeats(todos, now) {
  const list = todos.slice();
  const ids = new Set(list.map((todo) => todo.id));
  let changed = false;
  todos.forEach((todo, index) => {
    const rule = normalizeTodoRepeat(todo.repeat);
    if (!todo.done || !todo.id || !rule || todo.repeatNext) return;
    const date = nextTodoRepeatDate(todo, todo.doneDate || now);
    if (!date) return;
    const root = todo.repeatRoot || todo.id;
    const occurrence = Math.max(0, Number.isSafeInteger(todo.repeatIndex) ? todo.repeatIndex : 0) + 1;
    const id = 'repeat-' + require('crypto').createHash('sha256').update(root).digest('hex').slice(0, 24) + '-' + occurrence;
    const repeat = { ...rule, anchor:rule.anchor || todoRepeatDateText(todoRepeatDateParts(todo.dueDate) || todoRepeatDateParts(now), false) };
    list[index] = { ...todo, repeat, repeatRoot:root, repeatIndex:occurrence - 1, repeatNext:id };
    if (!ids.has(id)) {
      ids.add(id);
      list.push({ ...todo, id, repeat, repeatRoot:root, repeatIndex:occurrence, repeatNext:'',
        done:false, doneDate:null, created:parseDate(todoRepeatDateText(todoRepeatDateParts(now), false)), dueDate:parseDate(date),
        tags:Array.isArray(todo.tags) ? todo.tags.slice() : [], _extraMeta:Array.isArray(todo._extraMeta) ? todo._extraMeta.slice() : [] });
    }
    changed = true;
  });
  return { todos:list, changed };
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { normalizeTodoRepeat, nextTodoRepeatDate, expandTodoRepeats };
}
