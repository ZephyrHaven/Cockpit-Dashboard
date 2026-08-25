// calendar.js — 日历看板模块

function buildCalendar(root, todos, opts) {
  const { language, t, openTodoEditor, onTodoToggle, onTodoSchedule, onTodoAlarm, hasLinkedTodoAlarm, rss, openRss, initialViewMode, onViewModeChange } = opts;
  // 刷新时必须读取视图的最新待办数组；不能闭包捕获初次渲染的旧快照。
  const getTodos = typeof todos === 'function' ? todos : () => todos;
  let calYear = window.moment().year();
  let calMonth = window.moment().month();
  let selDay = window.moment().date();
  let calRoot = null;
  let gridEl = null;
  let subtitleEl = null;
  let rssButtonEl = null;
  let followsToday = true;
  let viewMode = initialViewMode === 'week' ? 'week' : 'month';
  const getSelectedDate = () => window.moment([calYear, calMonth, selDay]);
  const updateCalendarSubtitle = () => {
    if (subtitleEl) subtitleEl.setText(formatCalendarDetailHeading(getSelectedDate(), language));
    if (rssButtonEl && rss?.config.enabled) {
      const count = rss.unreadCountForDate(getSelectedDate());
      rssButtonEl.setText('RSS');
      if (count) rssButtonEl.createSpan({ cls:PLUGIN_ID + '-cal-rss-count', text:count > 99 ? '99+' : String(count) });
      rssButtonEl.setAttribute('aria-label', (language === 'en' ? 'Unread RSS entries: ' : '未读 RSS 订阅：') + count);
    }
  };
  const buildTodoMap = () => {
    const map = {};
    (getTodos() || []).forEach((todo) => {
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
    const priorityOrder = { high:0, mid:1, low:2 };
    const items = (todoMap[date.format('YYYY-MM-DD')] || []).slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.dueHasTime !== b.dueHasTime) return a.dueHasTime ? -1 : 1;
      const timeDiff = Number(a.dueDate?.valueOf?.() || 0) - Number(b.dueDate?.valueOf?.() || 0);
      if (a.dueHasTime && timeDiff) return timeDiff;
      const priorityDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      return priorityDiff || String(a.text || '').localeCompare(String(b.text || ''));
    });
    const rssItems = rss?.config.enabled ? rss.itemsForDate(date) : [];
    const detail = document.createElement('div');
    detail.className = PLUGIN_ID + '-cal-detail' + (items.length ? ' has-items' : ' is-empty');
    calRoot.parentNode.insertBefore(detail, calRoot.nextSibling);
    const head = detail.createDiv({ cls: PLUGIN_ID + '-cal-detail-head' });
    const title = head.createDiv({ cls: PLUGIN_ID + '-cal-detail-title-wrap' });
    title.createDiv({ cls: PLUGIN_ID + '-cal-detail-kicker', text: date.isSame(window.moment(), 'day') ? (language === 'en' ? 'TODAY FLOW' : '今天时间流') : (language === 'en' ? 'DAY FLOW' : '日期时间流') });
    title.createDiv({ cls: PLUGIN_ID + '-cal-detail-title', text: formatCalendarDetailHeading(date, language) });
    title.createDiv({ cls: PLUGIN_ID + '-cal-detail-count', text: String(items.length) });
    const actions = head.createDiv({ cls: PLUGIN_ID + '-cal-detail-actions' });
    const add = actions.createEl('button', { cls: PLUGIN_ID + '-cal-detail-add', text: '+ ' + t('calendar.addTodo'), attr: { type: 'button' } });
    add.onclick = () => openTodoEditor({ dueDate: date });
    if (!items.length && !rssItems.length) {
      const empty = detail.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty' });
      empty.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty-icon', text: '✦' });
      empty.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty-text', text: t('calendar.emptyDay') });
      return;
    }
    const timeline = detail.createDiv({ cls:PLUGIN_ID + '-cal-timeline', attr:{ role:'list' } });
    const now = window.moment();
    const nextTimed = date.isSame(now, 'day')
      ? items.find((todo) => !todo.done && todo.dueHasTime && todo.dueDate?.isSameOrAfter?.(now))
      : null;
    const priorityText = language === 'en'
      ? { high:'High', mid:'Normal', low:'Low' }
      : { high:'高', mid:'普通', low:'低' };
    const priorityIcon = { high:'arrow-up', mid:'minus', low:'arrow-down' };
    items.forEach((todo, index) => {
      const item = timeline.createDiv({ cls:PLUGIN_ID + '-cal-timeline-row p-' + (todo.priority || 'mid') + (todo.done ? ' done' : '') + (todo === nextTimed ? ' is-next' : ''), attr:{ role:'listitem' } });
      const time = item.createDiv({ cls:PLUGIN_ID + '-cal-timeline-time' });
      time.createSpan({ text:todo.dueHasTime ? todo.dueDate.format('HH:mm') : (language === 'en' ? 'All day' : '全天') });
      const rail = item.createDiv({ cls:PLUGIN_ID + '-cal-timeline-rail' + (index === 0 ? ' first' : '') + (index === items.length - 1 ? ' last' : '') });
      const check = rail.createEl('button', {
        cls:PLUGIN_ID + '-cal-timeline-node p-' + (todo.priority || 'mid') + (todo.done ? ' done' : ''),
        attr:{ type:'button', 'aria-label':todo.done ? (language === 'en' ? 'Mark task open' : '恢复为待办') : (language === 'en' ? 'Complete task' : '完成待办'), 'aria-pressed':String(todo.done) }
      });
      if (todo.done) obsidian.setIcon(check, 'check');
      const content = item.createDiv({ cls:PLUGIN_ID + '-cal-timeline-content' });
      const text = content.createEl('button', { cls:PLUGIN_ID + '-cal-timeline-title', text:todo.text, attr:{ type:'button', title:todo.text } });
      const meta = content.createDiv({ cls:PLUGIN_ID + '-cal-timeline-meta' });
      const dueChip = meta.createSpan({ cls:PLUGIN_ID + '-cal-timeline-date' });
      obsidian.setIcon(dueChip.createSpan(), 'calendar-days');
      dueChip.createSpan({ text:formatTodoDue(todo.dueDate, language, todo.dueHasTime) });
      const prio = meta.createSpan({ cls:PLUGIN_ID + '-cal-timeline-priority p-' + (todo.priority || 'mid') });
      obsidian.setIcon(prio.createSpan(), priorityIcon[todo.priority] || 'minus');
      prio.createSpan({ text:priorityText[todo.priority] || priorityText.mid });
      if (todo === nextTimed) content.createSpan({ cls:PLUGIN_ID + '-cal-timeline-now', text:'NOW' });
      const rowActions = content.createDiv({ cls:PLUGIN_ID + '-cal-timeline-actions' });
      if (!todo.done && todo.raw.id) {
        const hasLinkedAlarm = hasLinkedTodoAlarm?.(todo.raw.id) === true;
        const alarm = rowActions.createEl('button', {
          cls:PLUGIN_ID + '-cal-detail-edit ' + PLUGIN_ID + '-cal-detail-alarm' + (hasLinkedAlarm ? ' active' : ''),
          attr:{ type:'button', title:t(hasLinkedAlarm ? 'todo.editAlarm' : 'todo.createAlarm'), 'aria-label':t(hasLinkedAlarm ? 'todo.editAlarm' : 'todo.createAlarm'), 'aria-pressed':String(hasLinkedAlarm) }
        });
        obsidian.setIcon(alarm, 'alarm-clock');
        alarm.onclick = async (event) => { event.stopPropagation(); await onTodoAlarm?.(todo.raw); };
      }
      const edit = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit', attr:{ type:'button', title:t('todo.edit'), 'aria-label':t('todo.edit') } });
      obsidian.setIcon(edit, 'square-pen');
      check.onclick = async (event) => { event.stopPropagation(); await onTodoToggle(todo.raw.id, !todo.raw.done); };
      text.onclick = (event) => { event.stopPropagation(); openTodoEditor({ id:todo.raw.id }); };
      edit.onclick = (event) => { event.stopPropagation(); openTodoEditor({ id:todo.raw.id }); };
    });
  };
  const renderAll = () => {
    const now = window.moment();
    if (followsToday) {
      calYear = now.year();
      calMonth = now.month();
      selDay = now.date();
    }
    const todoMap = buildTodoMap();
    ensureRoot();
    const surface = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-surface' });
    const header = surface.createDiv({ cls: PLUGIN_ID + '-cal-header' });
    const title = header.createDiv({ cls: PLUGIN_ID + '-cal-title-wrap' });
    title.createDiv({ cls: PLUGIN_ID + '-cal-title', text: formatMonthTitle(calYear, calMonth, language) });
    subtitleEl = title.createDiv({ cls: PLUGIN_ID + '-cal-subtitle', text: '' });
    updateCalendarSubtitle();
    const controls = header.createDiv({ cls: PLUGIN_ID + '-cal-controls' });
    const nav = controls.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
    const prev = nav.createEl('button', { cls: PLUGIN_ID + '-cal-nav-btn', text: '‹', attr: { type:'button', 'aria-label':language === 'en' ? 'Previous month' : '上个月' } });
    const today = nav.createEl('button', { cls: PLUGIN_ID + '-cal-nav-btn', text: '●', attr: { type:'button', title:t('calendar.backToToday'), 'aria-label':t('calendar.backToToday') } });
    const next = nav.createEl('button', { cls: PLUGIN_ID + '-cal-nav-btn', text: '›', attr: { type:'button', 'aria-label':language === 'en' ? 'Next month' : '下个月' } });
    const mode = controls.createEl('button', { cls:PLUGIN_ID + '-cal-mode-btn', text:viewMode === 'month' ? (language === 'en' ? 'Week' : '周视图') : (language === 'en' ? 'Month' : '月视图'), attr:{ type:'button', title:language === 'en' ? 'Switch calendar density' : '切换日历视图' } });
    mode.onclick = () => {
      viewMode = viewMode === 'month' ? 'week' : 'month';
      renderAll();
      Promise.resolve(onViewModeChange?.(viewMode)).catch((error) => console.warn('[Cockpit calendar preference]', error));
    };
    if (rss?.config.enabled) {
      const selectedRss = rss.itemsForDate(getSelectedDate());
      rssButtonEl = controls.createEl('button', { cls:PLUGIN_ID + '-cal-rss-btn', text:'RSS', attr:{ type:'button', title:language === 'en' ? 'Subscription entries for selected date' : '当前所选日期的订阅内容' } });
      const unreadRss = rss.unreadCountForDate(getSelectedDate());
      if (unreadRss) rssButtonEl.createSpan({ cls:PLUGIN_ID + '-cal-rss-count', text:unreadRss > 99 ? '99+' : String(unreadRss) });
      rssButtonEl.onclick = () => openRss?.(getSelectedDate());
    }
    const stage = surface.createDiv({ cls: PLUGIN_ID + '-cal-stage' });
    if (viewMode === 'week') {
      const week = stage.createDiv({ cls:PLUGIN_ID + '-cal-week' });
      const start = getSelectedDate().clone().startOf('isoWeek');
      for (let offset = 0; offset < 7; offset++) {
        const date = start.clone().add(offset, 'day'); const key = date.format('YYYY-MM-DD'); const dayTodos = todoMap[key] || []; const dayRss = rss?.config.enabled ? rss.itemsForDate(date) : [];
        const day = week.createEl('button', { cls:PLUGIN_ID + '-cal-week-day' + (date.isSame(now,'day')?' today':'') + (date.isSame(getSelectedDate(),'day')?' selected':''), attr:{type:'button'} });
        day.createDiv({ cls:PLUGIN_ID+'-cal-week-name', text:getWeekdayLabels(language,'short')[date.day()] }); day.createDiv({ cls:PLUGIN_ID+'-cal-week-date', text:date.format('MM/DD') });
        const metrics=day.createDiv({cls:PLUGIN_ID+'-cal-week-metrics'}); if(dayTodos.length)metrics.createSpan({text:(language==='en'?'Tasks ':'待办 ')+dayTodos.length});if(dayRss.length)metrics.createSpan({text:'RSS '+dayRss.length});
        day.addEventListener('dragover',(event)=>{if(!event.dataTransfer?.types?.includes('application/x-cockpit-todo'))return;event.preventDefault();day.classList.add('todo-drop-target');});day.addEventListener('dragleave',()=>day.classList.remove('todo-drop-target'));day.addEventListener('drop',async(event)=>{const id=event.dataTransfer?.getData('application/x-cockpit-todo');if(!id)return;event.preventDefault();day.classList.remove('todo-drop-target');await onTodoSchedule?.(id,date.clone().startOf('day'));});
        day.onclick=()=>{calYear=date.year();calMonth=date.month();selDay=date.date();followsToday=date.isSame(window.moment(),'day');renderAll();};
      }
      const goWeek=(direction)=>{const target=getSelectedDate().clone().add(direction,'week');calYear=target.year();calMonth=target.month();selDay=target.date();followsToday=false;renderAll();};
      prev.onclick=()=>goWeek(-1);next.onclick=()=>goWeek(1);today.onclick=()=>{followsToday=true;renderAll();};renderDetail(todoMap);return;
    }
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
      const dayRss = rss?.config.enabled ? rss.itemsForDate(date) : [];
      const cell = gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell' + (date.isSame(now, 'day') ? ' today' : '') + (dayTodos.length ? ' has-todos' : '') + (dayRss.length ? ' has-rss' : '') + (day === selDay ? ' selected' : '') });
      cell.addEventListener('dragover', (event) => { if (!event.dataTransfer?.types?.includes('application/x-cockpit-todo')) return; event.preventDefault(); cell.classList.add('todo-drop-target'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('todo-drop-target'));
      cell.addEventListener('drop', async (event) => {
        const todoId = event.dataTransfer?.getData('application/x-cockpit-todo');
        if (!todoId) return;
        event.preventDefault(); event.stopPropagation(); cell.classList.remove('todo-drop-target');
        await onTodoSchedule?.(todoId, date.clone().startOf('day'));
      });
      const inner = cell.createDiv({ cls: PLUGIN_ID + '-cal-cell-inner' });
      inner.createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(day) });
      if (date.isSame(now, 'day')) inner.createDiv({ cls: PLUGIN_ID + '-cal-today-mark' });
      const indicators = cell.createDiv({ cls:PLUGIN_ID + '-cal-indicators' + (dayTodos.length && dayRss.length ? ' has-both' : '') });
      if (dayTodos.length) {
        const dots = indicators.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
        const colors = { high: '#ef4444', mid: '#f59e0b', low: '#22c55e' };
        dayTodos.slice(0, 3).forEach((todo) => dots.createDiv({ cls: PLUGIN_ID + '-cal-dot', attr: { style: 'background:' + (todo.done ? '#22c55e' : (colors[todo.priority] || '#818cf8')) } }));
      }
      const counts = indicators.createDiv({ cls:PLUGIN_ID + '-cal-indicator-counts' });
      if (dayTodos.length) counts.createSpan({ cls: PLUGIN_ID + '-cal-badge', text:'✓' + (dayTodos.length > 99 ? '99+' : String(dayTodos.length)), attr:{ title:(language === 'en' ? 'Tasks: ' : '待办：') + dayTodos.length } });
      if (dayRss.length) counts.createSpan({ cls:PLUGIN_ID + '-cal-rss-badge', text:'R·' + (dayRss.length > 99 ? '99+' : dayRss.length), attr:{ title:'RSS: ' + dayRss.length } });
      cell.onclick = () => { selDay = day; followsToday = date.isSame(window.moment(), 'day'); renderDayDetailOnly(todoMap); };
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
        followsToday = false;
        selDay = Math.min(selDay, window.moment([calYear, calMonth, 1]).daysInMonth());
        renderAll();
        requestAnimationFrame(() => calRoot.querySelector('.' + PLUGIN_ID + '-cal-grid')?.classList.add('slide-in'));
      }, 200);
    };
    prev.onclick = () => goMonth(-1);
    next.onclick = () => goMonth(1);
    today.onclick = () => { followsToday = true; renderAll(); };
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
