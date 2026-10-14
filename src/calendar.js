// calendar.js — 日历看板模块

// 双击日期快速新建：“14:30 开会”“下午3点 复盘”“9点半 晨会”带时间，其余整句作为全天待办。
function parseCalendarQuickInput(raw) {
  const input = String(raw || '').replace(/\s+/g, ' ').trim();
  const match = input.match(/^(上午|早上|中午|下午|晚上)?\s*(\d{1,2})(?:[:：.](\d{2})|点(?:(半)|(\d{1,2})分?)?)\s*(.*)$/);
  if (!match) return { text:input, hasTime:false, hour:0, minute:0 };
  const [, period, hourText, colonMinute, half, pointMinute, rest] = match;
  let hour = Number(hourText);
  const minute = colonMinute ? Number(colonMinute) : half ? 30 : pointMinute ? Number(pointMinute) : 0;
  if ((period === '下午' || period === '晚上') && hour < 12) hour += 12;
  if (period === '中午' && hour < 11) hour += 12;
  if (hour > 23 || minute > 59 || !rest.trim()) return { text:input, hasTime:false, hour:0, minute:0 };
  return { text:rest.trim(), hasTime:true, hour, minute };
}


function buildCalendar(root, todos, opts) {
  const { language, t, openTodoEditor, onTeamTodoOpen, onTeamTodoToggle, onTodoToggle, onTodoSchedule, onTodoAlarm, hasLinkedTodoAlarm, rss, openRss, loadAutomationItems, loadCountdownItems, onAutomationOpen, onAutomationRun, onCountdownOpen, initialViewMode, onViewModeChange, lunarEnabled, teamTodos, loadCalendarEvents, onQuickCreate } = opts;
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
  let flowFilter = 'all';
  let detailRequest = 0;
  // 系统日程（只读）：按可见时间窗异步加载，加载完成后整体重绘一次。
  let eventStore = { key:'', at:0, events:[] };
  let eventRequestKey = '';
  let titleMonthEl = null;
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
    (typeof teamTodos === 'function' ? teamTodos() : teamTodos || []).forEach((todo) => {
      if (!todo?.dueDate) return;
      const key = todo.dueDate.format('YYYY-MM-DD');
      (map[key] ||= []).push({ ...todo, raw: todo, teamTodo:true });
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
  const renderLegacyDetail = (todoMap) => {
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
      if (todo.done) obs.setIcon(check, 'check');
      const content = item.createDiv({ cls:PLUGIN_ID + '-cal-timeline-content' });
      const text = content.createEl('button', { cls:PLUGIN_ID + '-cal-timeline-title', text:todo.text, attr:{ type:'button', title:todo.text } });
      const meta = content.createDiv({ cls:PLUGIN_ID + '-cal-timeline-meta' });
      const dueChip = meta.createSpan({ cls:PLUGIN_ID + '-cal-timeline-date' });
      obs.setIcon(dueChip.createSpan(), 'calendar-days');
      dueChip.createSpan({ text:formatTodoDue(todo.dueDate, language, todo.dueHasTime) });
      const prio = meta.createSpan({ cls:PLUGIN_ID + '-cal-timeline-priority p-' + (todo.priority || 'mid') });
      obs.setIcon(prio.createSpan(), priorityIcon[todo.priority] || 'minus');
      prio.createSpan({ text:priorityText[todo.priority] || priorityText.mid });
      if (todo === nextTimed) content.createSpan({ cls:PLUGIN_ID + '-cal-timeline-now', text:'NOW' });
      const rowActions = content.createDiv({ cls:PLUGIN_ID + '-cal-timeline-actions' });
      if (!todo.done && todo.raw.id) {
        const hasLinkedAlarm = hasLinkedTodoAlarm?.(todo.raw.id) === true;
        const alarm = rowActions.createEl('button', {
          cls:PLUGIN_ID + '-cal-detail-edit ' + PLUGIN_ID + '-cal-detail-alarm' + (hasLinkedAlarm ? ' active' : ''),
          attr:{ type:'button', title:t(hasLinkedAlarm ? 'todo.editAlarm' : 'todo.createAlarm'), 'aria-label':t(hasLinkedAlarm ? 'todo.editAlarm' : 'todo.createAlarm'), 'aria-pressed':String(hasLinkedAlarm) }
        });
        obs.setIcon(alarm, 'alarm-clock');
        alarm.onclick = async (event) => { event.stopPropagation(); await onTodoAlarm?.(todo.raw); };
      }
      const edit = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit', attr:{ type:'button', title:t('todo.edit'), 'aria-label':t('todo.edit') } });
      obs.setIcon(edit, 'square-pen');
      check.onclick = async (event) => { event.stopPropagation(); await onTodoToggle(todo.raw.id, !todo.raw.done); };
      text.onclick = (event) => { event.stopPropagation(); openTodoEditor({ id:todo.raw.id }); };
      edit.onclick = (event) => { event.stopPropagation(); openTodoEditor({ id:todo.raw.id }); };
    });
  };
  const renderDetail = (todoMap) => {
    if (typeof renderCalendarDayFlow !== 'function') return renderLegacyDetail(todoMap);
    const request = ++detailRequest;
    const date = getSelectedDate();
    const todosForDate = todoMap[date.format('YYYY-MM-DD')] || [];
    const rssItems = (rss?.config.enabled ? rss.itemsForDate(date) : []).map((rssItem) => ({ kind:'rss', rssItem }));
    return Promise.all([
      Promise.resolve(loadAutomationItems?.(date.clone()) || []),
      Promise.resolve(loadCountdownItems?.(date.clone()) || [])
    ]).then(([automationItems,countdownItems]) => {
      if (request !== detailRequest || !calRoot?.parentNode) return;
      return renderCalendarDayFlow({
        anchor:calRoot, date, language, t, todosForDate, rssItems, calendarEvents:eventsForDate(date),
        automationItems:Array.isArray(automationItems) ? automationItems : [],
        countdownItems:Array.isArray(countdownItems) ? countdownItems : [],
        filter:flowFilter,
        onFilterChange:(nextFilter) => { flowFilter=nextFilter; renderDetail(todoMap); },
        openTodoEditor, onTeamTodoOpen, onTeamTodoToggle, onTodoToggle, onTodoAlarm, hasLinkedTodoAlarm,
        openRss, onAutomationOpen, onAutomationRun, onCountdownOpen,
        rerender:() => renderDetail(todoMap), rss
      });
    }).catch((error) => {
      console.warn('Cockpit calendar day flow failed', error);
      if (request === detailRequest) renderLegacyDetail(todoMap);
    });
  };
  const priorityRank = { high:0, mid:1, low:2 };
  const sortDayTodos = (list) => list.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueHasTime !== b.dueHasTime) return a.dueHasTime ? -1 : 1;
    if (a.dueHasTime) {
      const timeDiff = Number(a.dueDate?.valueOf?.() || 0) - Number(b.dueDate?.valueOf?.() || 0);
      if (timeDiff) return timeDiff;
    }
    return ((priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1)) || String(a.text || '').localeCompare(String(b.text || ''));
  });
  const openCalendarTodo = (todo) => (todo.teamTodo ? onTeamTodoOpen?.(todo.raw) : openTodoEditor({ id:todo.raw.id }));
  const loadLevel = (count) => (count >= 5 ? 4 : count >= 3 ? 3 : count);
  const buildEventMap = () => {
    const map = {};
    (eventStore.events || []).forEach((event) => {
      const startDay = window.moment(event.start).startOf('day');
      const lastMoment = window.moment(Math.max(event.start, event.end - 1));
      for (let cursor = startDay.clone(), guard = 0; cursor.isSameOrBefore(lastMoment, 'day') && guard < 14; cursor.add(1, 'day'), guard++) {
        (map[cursor.format('YYYY-MM-DD')] ||= []).push(event);
      }
    });
    return map;
  };
  let eventMap = {};
  const eventsForDate = (date) => eventMap[date.format('YYYY-MM-DD')] || [];
  const eventTimeText = (event, date) => {
    const en = language === 'en';
    if (event.allDay) return en ? 'All day' : '全天';
    const start = window.moment(event.start);
    return start.isSame(date, 'day') ? start.format('HH:mm') : (en ? 'Cont.' : '续');
  };
  const eventTitle = (event) => [event.title, event.calendar && '📅 ' + event.calendar, event.location && '📍 ' + event.location].filter(Boolean).join('\n');
  const requestEvents = (rangeStart, rangeEnd) => {
    if (typeof loadCalendarEvents !== 'function') return;
    const key = rangeStart.valueOf() + '_' + rangeEnd.valueOf();
    const fresh = eventStore.key === key && Date.now() - eventStore.at < 5 * 60000;
    if (fresh || eventRequestKey === key) return;
    eventRequestKey = key;
    Promise.resolve(loadCalendarEvents(rangeStart.valueOf(), rangeEnd.valueOf())).then((events) => {
      if (eventRequestKey !== key) return;
      eventRequestKey = '';
      const list = Array.isArray(events) ? events : [];
      const changed = eventStore.key !== key || JSON.stringify(list.map((event) => event.id)) !== JSON.stringify((eventStore.events || []).map((event) => event.id));
      eventStore = { key, at:Date.now(), events:list };
      if (changed && calRoot?.parentNode) renderAll();
    }).catch((error) => {
      if (eventRequestKey === key) eventRequestKey = '';
      eventStore = { key, at:Date.now(), events:[] };
      console.warn('[Cockpit calendar events]', error?.message || error);
    });
  };
  // 日历内拖拽：月格关键事项 / 周卡事项都可拖到其他日期；带时间的待办保留原时刻。
  const makeTodoDraggable = (el, todo) => {
    if (todo.teamTodo || todo.done || !todo.raw?.id) return;
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (event) => {
      event.stopPropagation();
      event.dataTransfer.setData('application/x-cockpit-todo', todo.raw.id);
      event.dataTransfer.setData('application/x-cockpit-calendar', '1');
      event.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-dragging');
      calRoot?.classList.add('is-dragging-todo');
    });
    el.addEventListener('dragend', () => { el.classList.remove('is-dragging'); calRoot?.classList.remove('is-dragging-todo'); });
  };
  const createEventRow = (parent, event, date, cls) => {
    const row = parent.createDiv({ cls:PLUGIN_ID + '-cal-ev' + (cls ? ' ' + cls : '') + (event.allDay ? ' all-day' : ''), attr:{ title:eventTitle(event) } });
    row.createSpan({ cls:PLUGIN_ID + '-cal-ev-time', text:eventTimeText(event, date) });
    row.createSpan({ cls:PLUGIN_ID + '-cal-ev-text', text:event.title });
    return row;
  };
  // 双击日期弹出内联输入框，回车创建，Esc / 失焦取消。
  const openQuickCreate = (host, date) => {
    if (typeof onQuickCreate !== 'function' || host.querySelector('.' + PLUGIN_ID + '-cal-quick')) return;
    const en = language === 'en';
    const box = host.createDiv({ cls:PLUGIN_ID + '-cal-quick' });
    const input = box.createEl('input', { cls:PLUGIN_ID + '-cal-quick-input', attr:{ type:'text', placeholder:en ? '14:30 Meeting' : '14:30 开会', 'aria-label':en ? 'New task for this day' : '为这一天新建待办' } });
    let busy = false;
    const close = () => box.remove();
    ['click', 'dblclick', 'mousedown'].forEach((type) => box.addEventListener(type, (event) => event.stopPropagation()));
    input.addEventListener('keydown', async (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Enter' || event.isComposing || busy) return;
      event.preventDefault();
      const parsed = parseCalendarQuickInput(input.value);
      if (!parsed.text) { close(); return; }
      busy = true;
      const due = date.clone().startOf('day');
      if (parsed.hasTime) due.hour(parsed.hour).minute(parsed.minute);
      try {
        const saved = await onQuickCreate(parsed.text, due, parsed.hasTime);
        if (saved === false) { busy = false; input.focus(); return; }
        close();
      } catch (error) {
        busy = false;
        console.warn('[Cockpit calendar quick create]', error);
      }
    });
    input.addEventListener('blur', () => { if (!busy) setTimeout(close, 120); });
    input.focus();
  };
  // 周视图事项行：优先级圆点 + 时间 + 标题，点击直接打开编辑。
  const createEventLine = (parent, todo) => {
    const time = todo.dueHasTime ? todo.dueDate.format('HH:mm') : '';
    const line = parent.createEl('button', {
      cls:PLUGIN_ID + '-cal-line p-' + (todo.priority || 'mid') + (todo.done ? ' done' : '') + (todo.teamTodo ? ' team' : ''),
      attr:{ type:'button', title:(time ? time + ' ' : '') + (todo.text || '') }
    });
    line.createSpan({ cls:PLUGIN_ID + '-cal-line-dot' });
    if (time) line.createSpan({ cls:PLUGIN_ID + '-cal-line-time', text:time });
    line.createSpan({ cls:PLUGIN_ID + '-cal-line-text', text:todo.text || '' });
    line.onclick = (event) => { event.stopPropagation(); openCalendarTodo(todo); };
    return line;
  };
  const bindTodoDrop = (target, date) => {
    target.addEventListener('dragover', (event) => { if (!event.dataTransfer?.types?.includes('application/x-cockpit-todo')) return; event.preventDefault(); target.classList.add('todo-drop-target'); });
    target.addEventListener('dragleave', () => target.classList.remove('todo-drop-target'));
    target.addEventListener('drop', async (event) => {
      const todoId = event.dataTransfer?.getData('application/x-cockpit-todo');
      if (!todoId) return;
      event.preventDefault(); event.stopPropagation(); target.classList.remove('todo-drop-target');
      const keepTime = event.dataTransfer?.types?.includes('application/x-cockpit-calendar') === true;
      await onTodoSchedule?.(todoId, date.clone().startOf('day'), { keepTime });
    });
  };
  const getDayInfo = (date) => ((lunarEnabled === false || language === 'en') ? null : getCockpitDayInfo(date));
  const selectDate = (date) => { calYear = date.year(); calMonth = date.month(); selDay = date.date(); followsToday = date.isSame(window.moment(), 'day'); renderAll(); };
  // 顶部脉搏条：今天剩余、下一项、逾期、本周负载，一眼看清关键信息。
  const renderPulse = (surface, todoMap, now) => {
    const en = language === 'en';
    const todayOpen = sortDayTodos((todoMap[now.format('YYYY-MM-DD')] || []).filter((todo) => !todo.done));
    const upcomingTodo = todayOpen.find((todo) => todo.dueHasTime && todo.dueDate.isSameOrAfter(now));
    const upcomingEvent = eventsForDate(now).find((event) => !event.allDay && event.start >= now.valueOf());
    // 下一项在“带时间的待办”和“系统日程”里取更早的；都没有时退回今天的全天待办。
    const nextEvent = upcomingEvent && (!upcomingTodo || upcomingEvent.start < upcomingTodo.dueDate.valueOf()) ? upcomingEvent : null;
    const nextTodo = nextEvent ? null : (upcomingTodo || todayOpen.find((todo) => !todo.dueHasTime) || null);
    const todayStart = now.clone().startOf('day');
    const overdue = (getTodos() || []).filter((todo) => !todo.done && todo.dueDate && todo.dueDate.isBefore(todayStart)).sort((a, b) => a.dueDate.valueOf() - b.dueDate.valueOf());
    const weekStart = now.clone().startOf('isoWeek');
    let weekOpen = 0;
    for (let i = 0; i < 7; i++) weekOpen += (todoMap[weekStart.clone().add(i, 'day').format('YYYY-MM-DD')] || []).filter((todo) => !todo.done).length;
    const pulse = surface.createDiv({ cls:PLUGIN_ID + '-cal-pulse' });
    const stat = (cls, value, label, onClick) => {
      const item = pulse.createEl('button', { cls:PLUGIN_ID + '-cal-pulse-item ' + cls, attr:{ type:'button' } });
      item.createSpan({ cls:PLUGIN_ID + '-cal-pulse-value', text:String(value) });
      item.createSpan({ cls:PLUGIN_ID + '-cal-pulse-label', text:label });
      item.onclick = onClick;
      return item;
    };
    stat('is-today' + (todayOpen.length ? '' : ' is-clear'), todayOpen.length, en ? 'open today' : '今天待办', () => { followsToday = true; renderAll(); });
    const next = pulse.createEl('button', { cls:PLUGIN_ID + '-cal-pulse-next' + (nextEvent ? ' is-event' : nextTodo ? ' p-' + (nextTodo.priority || 'mid') : ' is-clear'), attr:{ type:'button', title:nextEvent ? eventTitle(nextEvent) : (nextTodo?.text || '') } });
    next.createSpan({ cls:PLUGIN_ID + '-cal-pulse-kicker', text:nextEvent ? (en ? 'NEXT EVENT' : '下一个日程') : nextTodo ? (en ? 'UP NEXT' : '下一项') : (en ? 'ALL CLEAR' : '今天已清空') });
    const nextBody = next.createSpan({ cls:PLUGIN_ID + '-cal-pulse-next-body' });
    if (nextEvent) nextBody.createSpan({ cls:PLUGIN_ID + '-cal-pulse-time', text:window.moment(nextEvent.start).format('HH:mm') });
    else if (nextTodo?.dueHasTime) nextBody.createSpan({ cls:PLUGIN_ID + '-cal-pulse-time', text:nextTodo.dueDate.format('HH:mm') });
    nextBody.createSpan({ cls:PLUGIN_ID + '-cal-pulse-text', text:nextEvent ? nextEvent.title : nextTodo ? nextTodo.text : (en ? 'Nothing left for today' : '没有剩余待办，享受空档') });
    if (nextEvent?.location) nextBody.createSpan({ cls:PLUGIN_ID + '-cal-pulse-where', text:nextEvent.location });
    next.onclick = () => (nextEvent ? selectDate(now.clone().startOf('day')) : nextTodo ? openCalendarTodo(nextTodo) : openTodoEditor({ dueDate:now.clone().startOf('day') }));
    if (overdue.length) stat('is-overdue', overdue.length, en ? 'overdue' : '已逾期', () => selectDate(overdue[0].dueDate.clone().startOf('day')));
    stat('is-week', weekOpen, en ? 'this week' : '本周待办', () => { viewMode = 'week'; followsToday = true; renderAll(); Promise.resolve(onViewModeChange?.(viewMode)).catch(() => {}); });
  };
  const renderAll = () => {
    const now = window.moment();
    if (followsToday) {
      calYear = now.year();
      calMonth = now.month();
      selDay = now.date();
    }
    const en = language === 'en';
    const todoMap = buildTodoMap();
    const firstOfMonth = window.moment([calYear, calMonth, 1]);
    const rangeStart = viewMode === 'week'
      ? getSelectedDate().clone().startOf('isoWeek')
      : firstOfMonth.clone().subtract(firstOfMonth.day() === 0 ? 6 : firstOfMonth.day() - 1, 'day');
    const rangeEnd = viewMode === 'week' ? rangeStart.clone().add(7, 'day') : rangeStart.clone().add(42, 'day');
    // 只按可见时间窗读取系统日程；翻到不含今天的月份时，脉搏条的“下一项”只看待办。
    requestEvents(rangeStart, rangeEnd);
    eventMap = buildEventMap();
    ensureRoot();
    const surface = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-surface is-' + viewMode });
    const header = surface.createDiv({ cls: PLUGIN_ID + '-cal-header' });
    const title = header.createDiv({ cls: PLUGIN_ID + '-cal-title-wrap' });
    const titleLine = title.createDiv({ cls: PLUGIN_ID + '-cal-title', attr:{ 'aria-label':formatMonthTitle(calYear, calMonth, language) } });
    titleMonthEl = titleLine.createSpan({ cls:PLUGIN_ID + '-cal-title-month', text:en ? getMonthLabels(language, 'long')[calMonth] : (calMonth + 1) + '月' });
    titleLine.createSpan({ cls:PLUGIN_ID + '-cal-title-year', text:String(calYear) });
    if (viewMode === 'week') titleLine.createSpan({ cls:PLUGIN_ID + '-cal-title-week', text:(en ? 'W' : '第') + getSelectedDate().isoWeek() + (en ? '' : '周') });
    subtitleEl = title.createDiv({ cls: PLUGIN_ID + '-cal-subtitle', text: '' });
    updateCalendarSubtitle();
    const controls = header.createDiv({ cls: PLUGIN_ID + '-cal-controls' });
    const switcher = controls.createDiv({ cls:PLUGIN_ID + '-cal-view-switch is-' + viewMode, attr:{ role:'group', 'aria-label':en ? 'Calendar view' : '日历视图' } });
    switcher.createSpan({ cls:PLUGIN_ID + '-cal-view-thumb', attr:{ 'aria-hidden':'true' } });
    [['month', en ? 'Month' : '月'], ['week', en ? 'Week' : '周']].forEach(([value, label]) => {
      const option = switcher.createEl('button', { cls:PLUGIN_ID + '-cal-view-opt' + (viewMode === value ? ' active' : ''), text:label, attr:{ type:'button', 'aria-pressed':String(viewMode === value) } });
      option.onclick = () => {
        if (viewMode === value) return;
        viewMode = value;
        renderAll();
        Promise.resolve(onViewModeChange?.(viewMode)).catch((error) => console.warn('[Cockpit calendar preference]', error));
      };
    });
    const nav = controls.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
    const prevLabel = viewMode === 'week' ? (en ? 'Previous week' : '上一周') : (en ? 'Previous month' : '上个月');
    const nextLabel = viewMode === 'week' ? (en ? 'Next week' : '下一周') : (en ? 'Next month' : '下个月');
    const prev = nav.createEl('button', { cls: PLUGIN_ID + '-cal-nav-btn', attr: { type:'button', 'aria-label':prevLabel, title:prevLabel } });
    obs.setIcon(prev, 'chevron-left');
    const today = nav.createEl('button', { cls: PLUGIN_ID + '-cal-nav-btn is-today', text: en ? 'Today' : '今天', attr: { type:'button', title:t('calendar.backToToday'), 'aria-label':t('calendar.backToToday') } });
    const next = nav.createEl('button', { cls: PLUGIN_ID + '-cal-nav-btn', attr: { type:'button', 'aria-label':nextLabel, title:nextLabel } });
    obs.setIcon(next, 'chevron-right');
    if (rss?.config.enabled) {
      rssButtonEl = controls.createEl('button', { cls:PLUGIN_ID + '-cal-rss-btn', text:'RSS', attr:{ type:'button', title:en ? 'Subscription entries for selected date' : '当前所选日期的订阅内容' } });
      const unreadRss = rss.unreadCountForDate(getSelectedDate());
      if (unreadRss) rssButtonEl.createSpan({ cls:PLUGIN_ID + '-cal-rss-count', text:unreadRss > 99 ? '99+' : String(unreadRss) });
      rssButtonEl.onclick = () => openRss?.(getSelectedDate());
    }
    renderPulse(surface, todoMap, now);
    const stage = surface.createDiv({ cls: PLUGIN_ID + '-cal-stage' });
    if (viewMode === 'week') {
      const week = stage.createDiv({ cls:PLUGIN_ID + '-cal-week' });
      const start = getSelectedDate().clone().startOf('isoWeek');
      // 周内切换选中日只改样式和下方日程，不重建卡片，保证双击能命中同一个元素。
      const selectWeekDay = (el, date) => {
        if (date.isSame(getSelectedDate(), 'day')) return;
        calYear = date.year(); calMonth = date.month(); selDay = date.date(); followsToday = date.isSame(window.moment(), 'day');
        week.querySelectorAll('.' + PLUGIN_ID + '-cal-week-day.selected').forEach((node) => { node.classList.remove('selected'); node.setAttribute('aria-pressed', 'false'); });
        el.classList.add('selected'); el.setAttribute('aria-pressed', 'true');
        titleMonthEl?.setText(en ? getMonthLabels(language, 'long')[calMonth] : (calMonth + 1) + '月');
        updateCalendarSubtitle();
        renderDetail(todoMap);
      };
      for (let offset = 0; offset < 7; offset++) {
        const date = start.clone().add(offset, 'day');
        const dayTodos = sortDayTodos(todoMap[date.format('YYYY-MM-DD')] || []);
        const dayRss = rss?.config.enabled ? rss.itemsForDate(date) : [];
        const dayEvents = eventsForDate(date);
        const dayInfo = getDayInfo(date);
        const isToday = date.isSame(now, 'day');
        const isSelected = date.isSame(getSelectedDate(), 'day');
        const totalItems = dayTodos.length + dayRss.length + dayEvents.length;
        const openCount = dayTodos.filter((todo) => !todo.done).length;
        const label = formatCalendarDetailHeading(date, language) + (totalItems ? ' · ' + (en ? totalItems + ' items' : '共 ' + totalItems + ' 项') : '');
        const day = week.createDiv({
          cls:PLUGIN_ID + '-cal-week-day load-' + loadLevel(openCount) + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + (date.isBefore(now, 'day') ? ' past' : '') + (totalItems ? ' has-events' : '') + ([0, 6].includes(date.day()) ? ' weekend' : '') + (dayInfo?.offMark === 'off' ? ' holiday' : '') + (dayInfo?.offMark === 'work' ? ' workday' : ''),
          attr:{ role:'button', tabindex:'0', title:label, 'aria-label':label, 'aria-pressed':String(isSelected) }
        });
        const head = day.createDiv({ cls:PLUGIN_ID + '-cal-week-head' });
        head.createSpan({ cls:PLUGIN_ID + '-cal-week-name', text:isToday ? (en ? 'TODAY' : '今天') : getWeekdayLabels(language, 'long')[date.day()] });
        const sub = dayInfo?.offMark === 'work' ? '班' : (dayInfo?.festival || dayInfo?.label || (en ? date.format('MMM') : ''));
        if (sub) head.createSpan({ cls:PLUGIN_ID + '-cal-week-sub' + (dayInfo?.festival ? ' festival' : ''), text:sub });
        const dateLine = day.createDiv({ cls:PLUGIN_ID + '-cal-week-date' });
        dateLine.createSpan({ cls:PLUGIN_ID + '-cal-week-day-number', text:date.format('D') });
        if (dayTodos.length) dateLine.createSpan({ cls:PLUGIN_ID + '-cal-week-count' + (openCount ? '' : ' is-done'), text:openCount ? String(openCount) : '✓' });
        const list = day.createDiv({ cls:PLUGIN_ID + '-cal-week-list' });
        const shownEvents = dayEvents.slice(0, 3);
        shownEvents.forEach((event) => createEventRow(list, event, date));
        const visible = dayTodos.slice(0, Math.max(2, 5 - shownEvents.length));
        visible.forEach((todo) => makeTodoDraggable(createEventLine(list, todo), todo));
        const hidden = dayTodos.length - visible.length + dayEvents.length - shownEvents.length;
        if (hidden > 0) list.createDiv({ cls:PLUGIN_ID + '-cal-more', text:'+' + hidden + (en ? ' more' : ' 项') });
        if (dayRss.length) list.createDiv({ cls:PLUGIN_ID + '-cal-week-rss', text:'RSS · ' + (dayRss.length > 99 ? '99+' : dayRss.length) });
        if (!totalItems) list.createDiv({ cls:PLUGIN_ID + '-cal-week-empty', text:en ? 'Free' : '空闲' });
        const meter = day.createDiv({ cls:PLUGIN_ID + '-cal-week-meter', attr:{ 'aria-hidden':'true' } });
        for (let i = 0; i < 4; i++) meter.createSpan({ cls:i < loadLevel(openCount) ? 'on' : '' });
        bindTodoDrop(day, date);
        day.onclick = () => selectWeekDay(day, date);
        day.addEventListener('dblclick', (event) => { if (event.target.closest?.('.' + PLUGIN_ID + '-cal-line')) return; openQuickCreate(day, date); });
        day.addEventListener('keydown', (event) => { if (event.target !== day || (event.key !== 'Enter' && event.key !== ' ')) return; event.preventDefault(); selectWeekDay(day, date); });
      }
      const goWeek = (direction) => { const target = getSelectedDate().clone().add(direction, 'week'); calYear = target.year(); calMonth = target.month(); selDay = target.date(); followsToday = false; renderAll(); };
      prev.onclick = () => goWeek(-1); next.onclick = () => goWeek(1); today.onclick = () => { followsToday = true; renderAll(); };
      renderDetail(todoMap);
      return;
    }
    gridEl = stage.createDiv({ cls: PLUGIN_ID + '-cal-grid' });
    getWeekdayLabels(language, 'header').forEach((day, index) => gridEl.createDiv({ cls: PLUGIN_ID + '-cal-dow' + (index >= 5 ? ' weekend' : ''), text: day }));
    const first = window.moment([calYear, calMonth, 1]);
    const offset = first.day() === 0 ? 6 : first.day() - 1;
    const daysInMonth = first.daysInMonth();
    const prevDays = first.clone().subtract(1, 'month').daysInMonth();
    for (let i = offset - 1; i >= 0; i--) createDimCell(prevDays - i);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = window.moment([calYear, calMonth, day]);
      const dayTodos = sortDayTodos(todoMap[date.format('YYYY-MM-DD')] || []);
      const dayRss = rss?.config.enabled ? rss.itemsForDate(date) : [];
      // 农历 / 节日 / 法定假日标记：lunar.js 纯函数，查表无 IO；可在设置中关闭，英文界面只保留悬停提示与配色。
      const dayInfo = getDayInfo(date);
      const isToday = date.isSame(now, 'day');
      const isPast = date.isBefore(now, 'day');
      const openTodos = dayTodos.filter((todo) => !todo.done);
      const dayEvents = eventsForDate(date);
      const cell = gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell load-' + loadLevel(openTodos.length) + (dayEvents.length ? ' has-cal-events' : '') + (isToday ? ' today' : '') + (isPast ? ' past' : '') + (isPast && openTodos.length ? ' has-overdue' : '') + (dayTodos.length && !openTodos.length ? ' all-done' : '') + (openTodos.some((todo) => todo.priority === 'high') ? ' has-high' : '') + (dayTodos.length ? ' has-todos' : '') + (dayRss.length ? ' has-rss' : '') + (day === selDay ? ' selected' : '') + ([0, 6].includes(date.day()) ? ' weekend' : '') + (dayInfo?.offMark === 'off' ? ' holiday' : '') + (dayInfo?.offMark === 'work' ? ' workday' : '') });
      const tipParts = [date.format('YYYY-MM-DD')];
      if (dayInfo?.lunarText) tipParts.push('农历' + dayInfo.lunarText);
      if (dayInfo?.festival) tipParts.push(dayInfo.festival);
      if (dayInfo?.offMark === 'off') tipParts.push('法定假日');
      if (dayInfo?.offMark === 'work') tipParts.push('调休上班');
      dayEvents.slice(0, 6).forEach((event) => tipParts.push('◷ ' + eventTimeText(event, date) + ' ' + event.title));
      dayTodos.slice(0, 6).forEach((todo) => tipParts.push((todo.done ? '✓ ' : '• ') + (todo.dueHasTime ? todo.dueDate.format('HH:mm') + ' ' : '') + todo.text));
      cell.setAttribute('title', tipParts.join('\n'));
      bindTodoDrop(cell, date);
      const inner = cell.createDiv({ cls: PLUGIN_ID + '-cal-cell-inner' });
      inner.createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(day) });
      if (dayTodos.length) inner.createSpan({ cls: PLUGIN_ID + '-cal-badge', text:openTodos.length ? String(openTodos.length > 99 ? '99+' : openTodos.length) : '✓', attr:{ title:(en ? 'Open tasks: ' : '未完成待办：') + openTodos.length } });
      if (dayInfo && dayInfo.label) {
        cell.createSpan({ cls: PLUGIN_ID + '-cal-lunar' + (dayInfo.festival ? ' festival' : '') + (dayInfo.offMark === 'work' ? ' workday' : ''), text: dayInfo.offMark === 'work' ? '班' : dayInfo.label });
      }
      // 每格只露出最关键的一项（未完成里最早 / 优先级最高），其余进 tooltip 与下方日程。
      // 系统日程同样只露出第一条，多出的用 +N 提示。
      const keyTodo = openTodos[0];
      if (keyTodo || dayEvents.length) {
        const lines = cell.createDiv({ cls:PLUGIN_ID + '-cal-cell-lines' });
        if (dayEvents.length) {
          const eventRow = createEventRow(lines, dayEvents[0], date, 'is-compact');
          if (dayEvents.length > 1) eventRow.createSpan({ cls:PLUGIN_ID + '-cal-ev-more', text:'+' + (dayEvents.length - 1) });
        }
        if (keyTodo) {
          const key = lines.createDiv({ cls:PLUGIN_ID + '-cal-key p-' + (keyTodo.priority || 'mid') });
          if (keyTodo.dueHasTime) key.createSpan({ cls:PLUGIN_ID + '-cal-key-time', text:keyTodo.dueDate.format('HH:mm') });
          key.createSpan({ cls:PLUGIN_ID + '-cal-key-text', text:keyTodo.text || '' });
          makeTodoDraggable(key, keyTodo);
        }
      }
      const indicators = cell.createDiv({ cls:PLUGIN_ID + '-cal-indicators' + (dayTodos.length && dayRss.length ? ' has-both' : '') });
      if (dayTodos.length) {
        const dots = indicators.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
        dayTodos.slice(0, 4).forEach((todo) => dots.createDiv({ cls: PLUGIN_ID + '-cal-dot p-' + (todo.priority || 'mid') + (todo.done ? ' done' : '') }));
      }
      const counts = indicators.createDiv({ cls:PLUGIN_ID + '-cal-indicator-counts' });
      if (dayRss.length) counts.createSpan({ cls:PLUGIN_ID + '-cal-rss-badge', text:'RSS ' + (dayRss.length > 99 ? '99+' : dayRss.length), attr:{ title:'RSS: ' + dayRss.length } });
      cell.onclick = () => { selDay = day; followsToday = date.isSame(window.moment(), 'day'); renderDayDetailOnly(todoMap); };
      cell.addEventListener('dblclick', () => openQuickCreate(cell, date));
    }
    const total = offset + daysInMonth;
    // 只补齐最后一周，避免整行空白的下月日期把月视图撑高。
    const fill = (7 - total % 7) % 7;
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
    cell.createDiv({ cls: PLUGIN_ID + '-cal-cell-inner' }).createSpan({ cls: PLUGIN_ID + '-cal-num', text: String(day) });
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
  // 设置变更（开关系统日程、隐藏日历）后由宿主调用，丢弃已加载的日程并重新读取。
  renderAll.reloadEvents = () => { eventStore = { key:'', at:0, events:[] }; eventRequestKey = ''; renderAll(); };
  return renderAll;
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { parseCalendarQuickInput };
