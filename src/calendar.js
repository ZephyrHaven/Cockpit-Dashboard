// calendar.js — 日历看板模块

function buildCalendar(root, todos, opts) {
  const { language, t, openTodoEditor, onTodoToggle } = opts;
  let calYear = window.moment().year();
  let calMonth = window.moment().month();
  let selDay = window.moment().date();
  let calRoot = null;
  let gridEl = null;
  let subtitleEl = null;
  const now = window.moment();
  const getSelectedDate = () => window.moment([calYear, calMonth, selDay]);
  const updateCalendarSubtitle = () => {
    if (subtitleEl) subtitleEl.setText(formatCalendarDetailHeading(getSelectedDate(), language));
  };
  const buildTodoMap = () => {
    const map = {};
    (todos || []).forEach((todo) => {
      if (!todo.dueDate) return;
      const key = todo.dueDate.format('YYYY-MM-DD');
      (map[key] ||= []).push({ ...todo, raw: todo });
    });
    return map;
  };
  const ensureRoot = () => {
    if (!calRoot || !calRoot.parentNode) {
      calRoot = document.createElement('div');
      calRoot.className = PLUGIN_ID + '-cal-wrap';
      const ref = root.querySelector('.' + PLUGIN_ID + '-search-results');
      if (ref?.parentNode) ref.parentNode.insertBefore(calRoot, ref.nextSibling);
      else root.prepend(calRoot);
    }
    calRoot.empty();
  };
  const renderDetail = (todoMap) => {
    const old = calRoot?.parentNode?.querySelector('.' + PLUGIN_ID + '-cal-detail');
    if (old) old.remove();
    if (!calRoot?.parentNode) return;
    const date = getSelectedDate();
    const items = todoMap[date.format('YYYY-MM-DD')] || [];
    const detail = document.createElement('div');
    detail.className = PLUGIN_ID + '-cal-detail';
    calRoot.parentNode.insertBefore(detail, calRoot.nextSibling);
    const head = detail.createDiv({ cls: PLUGIN_ID + '-cal-detail-head' });
    const title = head.createDiv({ cls: PLUGIN_ID + '-cal-detail-title-wrap' });
    title.createDiv({ cls: PLUGIN_ID + '-cal-detail-title', text: formatCalendarDetailHeading(date, language) });
    title.createDiv({ cls: PLUGIN_ID + '-cal-detail-count', text: String(items.length) });
    const add = head.createEl('button', { cls: PLUGIN_ID + '-cal-detail-add', text: '+ ' + t('calendar.addTodo'), attr: { type: 'button' } });
    add.onclick = () => openTodoEditor({ dueDate: date });
    if (!items.length) {
      const empty = detail.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty' });
      empty.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty-icon', text: '✦' });
      empty.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty-text', text: t('calendar.emptyDay') });
      return;
    }
    items.forEach((todo) => {
      const item = detail.createDiv({ cls: PLUGIN_ID + '-cal-detail-item' });
      const check = item.createDiv({ cls: PLUGIN_ID + '-cal-detail-check' + (todo.done ? ' done' : ''), text: todo.done ? '✓' : '' });
      const text = item.createSpan({ cls: PLUGIN_ID + '-cal-detail-text' + (todo.done ? ' done' : ''), text: (todo.done ? '🟢 ' : todo.priority === 'high' ? '🔴 ' : todo.priority === 'mid' ? '🟡 ' : '🟢 ') + todo.text });
      const edit = item.createEl('button', { cls: PLUGIN_ID + '-cal-detail-edit', attr: { type: 'button', title: t('todo.edit') } });
      obsidian.setIcon(edit, 'square-pen');
      check.onclick = async (event) => {
        event.stopPropagation();
        todo.raw.done = !todo.raw.done;
        todo.raw.doneDate = todo.raw.done ? window.moment() : null;
        await onTodoToggle();
      };
      text.onclick = (event) => { event.stopPropagation(); openTodoEditor({ index: todos.indexOf(todo.raw) }); };
      edit.onclick = (event) => { event.stopPropagation(); openTodoEditor({ index: todos.indexOf(todo.raw) }); };
    });
  };
  const renderAll = () => {
    const todoMap = buildTodoMap();
    ensureRoot();
    const surface = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-surface' });
    const header = surface.createDiv({ cls: PLUGIN_ID + '-cal-header' });
    const title = header.createDiv({ cls: PLUGIN_ID + '-cal-title-wrap' });
    title.createDiv({ cls: PLUGIN_ID + '-cal-title', text: formatMonthTitle(calYear, calMonth, language) });
    subtitleEl = title.createDiv({ cls: PLUGIN_ID + '-cal-subtitle', text: '' });
    updateCalendarSubtitle();
    const nav = header.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
    const prev = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '‹' });
    const today = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '●', attr: { title: t('calendar.backToToday') } });
    const next = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '›' });
    const stage = surface.createDiv({ cls: PLUGIN_ID + '-cal-stage' });
    gridEl = stage.createDiv({ cls: PLUGIN_ID + '-cal-grid' });
    getWeekdayLabels(language, 'header').forEach((day) => gridEl.createDiv({ cls: PLUGIN_ID + '-cal-dow', text: day }));
    const first = window.moment([calYear, calMonth, 1]);
    const offset = first.day() === 0 ? 6 : first.day() - 1;
    const daysInMonth = first.daysInMonth();
    const prevDays = first.clone().subtract(1, 'month').daysInMonth();
    for (let i = offset - 1; i >= 0; i--) createDimCell(prevDays - i);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = window.moment([calYear, calMonth, day]);
      const dayTodos = todoMap[date.format('YYYY-MM-DD')] || [];
      const cell = gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell' + (date.isSame(now, 'day') ? ' today' : '') + (dayTodos.length ? ' has-todos' : '') + (day === selDay ? ' selected' : '') });
      const inner = cell.createDiv({ cls: PLUGIN_ID + '-cal-cell-inner' });
      inner.createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(day) });
      if (date.isSame(now, 'day')) inner.createDiv({ cls: PLUGIN_ID + '-cal-today-mark' });
      if (dayTodos.length) {
        cell.createSpan({ cls: PLUGIN_ID + '-cal-badge', text: dayTodos.length > 3 ? '3+' : String(dayTodos.length) });
        const dots = cell.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
        const colors = { high: '#ef4444', mid: '#f59e0b', low: '#22c55e' };
        dayTodos.slice(0, 3).forEach((todo) => dots.createDiv({ cls: PLUGIN_ID + '-cal-dot', attr: { style: 'background:' + (todo.done ? '#22c55e' : (colors[todo.priority] || '#818cf8')) } }));
      }
      cell.onclick = () => { selDay = day; renderDayDetailOnly(todoMap); };
    }
    const total = offset + daysInMonth;
    const fill = Math.max(0, 42 - total - ((7 - total % 7) % 7)) + ((7 - total % 7) % 7);
    for (let day = 1; day <= fill; day++) createDimCell(day);
    const goMonth = (direction) => {
      gridEl.classList.remove('slide-in');
      gridEl.classList.add(direction > 0 ? 'slide-out-left' : 'slide-out-right');
      setTimeout(() => {
        calMonth += direction;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        if (calMonth > 11) { calMonth = 0; calYear++; }
        selDay = Math.min(selDay, window.moment([calYear, calMonth, 1]).daysInMonth());
        renderAll();
        requestAnimationFrame(() => calRoot.querySelector('.' + PLUGIN_ID + '-cal-grid')?.classList.add('slide-in'));
      }, 200);
    };
    prev.onclick = () => goMonth(-1);
    next.onclick = () => goMonth(1);
    today.onclick = () => { calYear = now.year(); calMonth = now.month(); selDay = now.date(); renderAll(); };
    renderDetail(todoMap);
  };
  const createDimCell = (day) => {
    const cell = gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim' });
    cell.createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(day) });
  };
  const renderDayDetailOnly = (todoMap) => {
    let current = 0;
    gridEl?.querySelectorAll('.' + PLUGIN_ID + '-cal-cell').forEach((cell) => {
      if (cell.classList.contains('dim')) return;
      cell.classList.toggle('selected', ++current === selDay);
    });
    updateCalendarSubtitle();
    renderDetail(todoMap);
  };
  renderAll();
  return renderAll;
}
