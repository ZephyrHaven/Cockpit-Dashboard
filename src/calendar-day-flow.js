// calendar-day-flow.js — 日历下方的统一日期运行视图：待办、RSS 与自动化共用一条时间线。

function summarizeCalendarRss(items, getFeed) {
  const articles = (Array.isArray(items) ? items : []).map((entry) => entry?.rssItem || entry).filter(Boolean);
  const sources = [];
  articles.forEach((article) => {
    const source = getFeed?.(article.feedId)?.name || 'RSS';
    if (!sources.includes(source)) sources.push(source);
  });
  return {
    count:articles.length,
    unreadCount:articles.filter((article) => !article.readAt).length,
    sources,
    latestAt:articles.reduce((latest, article) => Math.max(latest, Number(article.publishedAt) || 0), 0)
  };
}

function calendarCountdownItemsForDate(items, dateValue) {
  const dateKey = window.moment(dateValue).format('YYYY-MM-DD');
  return (Array.isArray(items) ? items : []).map((item) => {
    if (!item || !Number.isFinite(Date.parse(item.targetAt || ''))) return null;
    const target = window.moment(item.targetAt);
    if (target.format('YYYY-MM-DD') !== dateKey) return null;
    return {
      ...item,
      id:String(item.id || ''),
      name:String(item.name || ''),
      time:target.format('HH:mm'),
      sortTime:target.valueOf()
    };
  }).filter((item) => item?.id && item.name).sort((a,b) => a.sortTime - b.sortTime || a.name.localeCompare(b.name));
}

function renderCalendarDayFlow(options) {
  const { anchor, date, language, t, todosForDate, rssItems, automationItems, countdownItems, filter, onFilterChange, openTodoEditor, onTeamTodoOpen, onTeamTodoToggle, onTodoToggle, onTodoAlarm, hasLinkedTodoAlarm, openRss, onAutomationOpen, onAutomationRun, onCountdownOpen, rerender, rss } = options;
  const parent = anchor?.parentNode;
  if (!parent) return null;
  parent.querySelector('.' + PLUGIN_ID + '-cal-detail')?.remove();
  const en = language === 'en';
  const dayStart = date.clone().startOf('day').valueOf();
  const todos = (Array.isArray(todosForDate) ? todosForDate : []).slice();
  const articles = (Array.isArray(rssItems) ? rssItems : []).map((entry) => entry?.rssItem || entry).filter(Boolean);
  const rssSummary = summarizeCalendarRss(articles, (feedId) => rss?.getFeed?.(feedId));
  const automations = Array.isArray(automationItems) ? automationItems : [];
  const countdowns = calendarCountdownItemsForDate(countdownItems, date);
  const flowItems = [
    ...todos.map((todo) => ({ kind:todo.teamTodo ? 'teamTodo' : 'todo', todo, sortTime:todo.dueHasTime ? todo.dueDate.valueOf() : dayStart - 1 })),
    ...(rssSummary.count ? [{ kind:'rss', rssSummary, sortTime:dayStart }] : []),
    ...countdowns.map((countdown) => ({ kind:'countdown', countdown, sortTime:countdown.sortTime })),
    ...automations.map((automation) => ({ kind:'automation', automation, sortTime:Number(automation.sortTime) || Number.MAX_SAFE_INTEGER }))
  ].sort((a, b) => a.sortTime - b.sortTime || a.kind.localeCompare(b.kind));

  const detail = document.createElement('div');
  detail.className = PLUGIN_ID + '-cal-detail' + (flowItems.length ? ' has-items' : ' is-empty');
  parent.insertBefore(detail, anchor.nextSibling);
  const head = detail.createDiv({ cls:PLUGIN_ID + '-cal-detail-head' });
  const title = head.createDiv({ cls:PLUGIN_ID + '-cal-detail-title-wrap' });
  title.createDiv({ cls:PLUGIN_ID + '-cal-detail-kicker', text:date.isSame(window.moment(), 'day') ? (en ? 'TODAY OPERATIONS' : '今日运行总览') : (en ? 'DAY PLAN' : '日期事项总览') });
  title.createDiv({ cls:PLUGIN_ID + '-cal-detail-title', text:formatCalendarDetailHeading(date, language) });
  title.createDiv({ cls:PLUGIN_ID + '-cal-detail-count', text:en ? `${flowItems.length} items` : `共 ${flowItems.length} 项` });
  const actions = head.createDiv({ cls:PLUGIN_ID + '-cal-detail-actions' });
  const add = actions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-add', text:'+ ' + t('calendar.addTodo'), attr:{ type:'button' } });
  add.onclick = () => openTodoEditor({ dueDate:date });

  const counts = { all:flowItems.length, todo:todos.filter((todo) => !todo.teamTodo).length, teamTodo:todos.filter((todo) => todo.teamTodo).length, countdown:countdowns.length, automation:automations.length, rss:articles.length };
  const filters = detail.createDiv({ cls:PLUGIN_ID + '-cal-flow-filters', attr:{ role:'tablist', 'aria-label':en ? 'Filter day items' : '筛选日期事项' } });
  [['all',en?'All':'全部'],['todo',en?'Personal':'个人待办'],['teamTodo',en?'Team tasks':'团队待办'],['countdown',en?'Countdowns':'倒计时'],['automation',en?'Automations':'自动化'],['rss','RSS']].forEach(([id,label]) => {
    const button = filters.createEl('button', { cls:PLUGIN_ID + '-cal-flow-filter' + (filter === id ? ' active' : ''), attr:{ type:'button', role:'tab', 'aria-selected':String(filter === id) } });
    button.createSpan({ text:label });
    button.createSpan({ cls:PLUGIN_ID + '-cal-flow-filter-count', text:String(counts[id]) });
    button.onclick = () => onFilterChange?.(id);
  });

  const visibleItems = filter === 'all' ? flowItems : flowItems.filter((item) => item.kind === filter);
  if (!visibleItems.length) {
    const empty = detail.createDiv({ cls:PLUGIN_ID + '-cal-detail-empty' });
    empty.createDiv({ cls:PLUGIN_ID + '-cal-detail-empty-icon', text:'✦' });
    empty.createDiv({ cls:PLUGIN_ID + '-cal-detail-empty-text', text:flowItems.length ? (en ? 'Nothing in this category.' : '这个分类今天没有事项。') : t('calendar.emptyDay') });
    return detail;
  }

  const timeline = detail.createDiv({ cls:PLUGIN_ID + '-cal-timeline', attr:{ role:'list' } });
  const now = window.moment();
  const nextTimed = date.isSame(now, 'day') ? todos.find((todo) => !todo.done && todo.dueHasTime && todo.dueDate?.isSameOrAfter?.(now)) : null;
  const priorityText = en ? {high:'High',mid:'Normal',low:'Low'} : {high:'高',mid:'普通',low:'低'};
  const priorityIcon = {high:'arrow-up',mid:'minus',low:'arrow-down'};
  const statusText = en
    ? {pending:'Pending',due:'Due',listening:'Listening',success:'Done',failed:'Failed',skipped:'Skipped'}
    : {pending:'待执行',due:'待补跑',listening:'监听中',success:'已完成',failed:'失败',skipped:'已跳过'};

  visibleItems.forEach((flow, index) => {
    const todo = flow.todo;
    const rssEntry = flow.rssSummary;
    const countdown = flow.countdown;
    const automation = flow.automation;
    const rowClass = todo
      ? PLUGIN_ID + '-cal-timeline-row p-' + (todo.priority || 'mid') + ' kind-todo' + (todo.done ? ' done' : '') + (todo === nextTimed ? ' is-next' : '')
      : PLUGIN_ID + '-cal-timeline-row kind-' + flow.kind;
    const row = timeline.createDiv({ cls:rowClass, attr:{ role:'listitem' } });
    const time = row.createDiv({ cls:PLUGIN_ID + '-cal-timeline-time' });
      time.createSpan({ text:todo
      ? (todo.dueHasTime ? todo.dueDate.format(todo.teamTodo ? 'HH:mm:ss' : 'HH:mm') : (en ? 'All day' : '全天'))
      : rssEntry ? 'RSS' : countdown ? countdown.time : (automation.time || (en ? 'Event' : '事件')) });
    const rail = row.createDiv({ cls:PLUGIN_ID + '-cal-timeline-rail' + (index === 0 ? ' first' : '') + (index === visibleItems.length - 1 ? ' last' : '') });
    let check = null;
    if (todo) {
      check = rail.createEl('button', { cls:PLUGIN_ID + '-cal-timeline-node p-' + (todo.priority || 'mid') + (todo.done ? ' done' : ''), attr:{ type:'button', 'aria-label':todo.done ? (en ? 'Mark task open' : '恢复为待办') : (en ? 'Complete task' : '完成待办'), 'aria-pressed':String(todo.done) } });
      if (todo.done) obs.setIcon(check, 'check');
    } else {
      const node = rail.createSpan({ cls:PLUGIN_ID + '-cal-timeline-node source-' + flow.kind });
      obs.setIcon(node, rssEntry ? 'rss' : countdown ? 'timer-reset' : (automation.kind === 'workflow' ? 'workflow' : 'zap'));
    }

    const content = row.createDiv({ cls:PLUGIN_ID + '-cal-timeline-content' });
    const summary = content.createDiv({ cls:PLUGIN_ID + '-cal-timeline-summary' });
    let text = null;
    if (todo) text = summary.createEl('button', { cls:PLUGIN_ID + '-cal-timeline-title', text:todo.text, attr:{ type:'button', title:todo.text } });
    else if (rssEntry) {
      const rssTitle = en ? `RSS digest · ${rssEntry.count} updates` : `RSS 今日摘要 · ${rssEntry.count} 条更新`;
      text = summary.createEl('button', { cls:PLUGIN_ID + '-cal-timeline-title', text:rssTitle, attr:{ type:'button', title:rssTitle } });
    }
    else if (countdown) text = summary.createEl('button', { cls:PLUGIN_ID + '-cal-timeline-title', text:countdown.name, attr:{ type:'button', title:countdown.name } });
    else text = summary.createEl('button', { cls:PLUGIN_ID + '-cal-timeline-title', text:automation.name, attr:{ type:'button', title:automation.name } });
    const meta = summary.createDiv({ cls:PLUGIN_ID + '-cal-timeline-meta' });
    if (todo) {
      const due = meta.createSpan({ cls:PLUGIN_ID + '-cal-timeline-date' }); obs.setIcon(due.createSpan(), 'calendar-days'); due.createSpan({ text:todo.teamTodo && todo.dueHasTime ? todo.dueDate.format('YYYY-MM-DD HH:mm:ss') : formatTodoDue(todo.dueDate, language, todo.dueHasTime) });
      const priority = meta.createSpan({ cls:PLUGIN_ID + '-cal-timeline-priority p-' + (todo.priority || 'mid') }); obs.setIcon(priority.createSpan(), priorityIcon[todo.priority] || 'minus'); priority.createSpan({ text:priorityText[todo.priority] || priorityText.mid });
    } else if (rssEntry) {
      meta.createSpan({ cls:PLUGIN_ID + '-cal-flow-chip source-rss', text:rssEntry.sources.slice(0, 3).join(' · ') || 'RSS' });
      meta.createSpan({ cls:PLUGIN_ID + '-cal-flow-chip', text:en ? `${rssEntry.unreadCount} unread` : `${rssEntry.unreadCount} 条未读` });
    } else if (countdown) {
      const target = window.moment(countdown.targetAt);
      meta.createSpan({ cls:PLUGIN_ID + '-cal-flow-chip source-countdown', text:(en ? 'Completes ' : '完成于 ')+target.format('MM-DD HH:mm') });
      const finished = target.valueOf() <= now.valueOf();
      meta.createSpan({ cls:PLUGIN_ID + '-cal-flow-chip status-' + (finished ? 'success' : countdown.enabled === false ? 'paused' : 'pending'), text:finished ? (en?'Completed':'已完成') : countdown.enabled === false ? (en?'Paused':'已暂停') : (en?'Pending':'待完成') });
    } else {
      meta.createSpan({ cls:PLUGIN_ID + '-cal-flow-chip source-automation', text:automation.scheduleLabel });
      meta.createSpan({ cls:PLUGIN_ID + '-cal-flow-chip', text:automation.actionLabel });
      meta.createSpan({ cls:PLUGIN_ID + '-cal-flow-chip status-' + automation.status, text:statusText[automation.status] || automation.status });
    }
    if (todo && todo === nextTimed) summary.createSpan({ cls:PLUGIN_ID + '-cal-timeline-now', text:'NOW' });
    const rowActions = content.createDiv({ cls:PLUGIN_ID + '-cal-timeline-actions' });

    if (todo && !todo.teamTodo && !todo.done && todo.raw.id) {
      const linked = hasLinkedTodoAlarm?.(todo.raw.id) === true;
      const alarm = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit ' + PLUGIN_ID + '-cal-detail-alarm' + (linked ? ' active' : ''), attr:{ type:'button', title:t(linked ? 'todo.editAlarm' : 'todo.createAlarm'), 'aria-label':t(linked ? 'todo.editAlarm' : 'todo.createAlarm'), 'aria-pressed':String(linked) } });
      obs.setIcon(alarm, 'alarm-clock'); alarm.onclick = async (event) => { event.stopPropagation(); await onTodoAlarm?.(todo.raw); };
    }
    if (todo) {
      const edit = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit', attr:{ type:'button', title:t('todo.edit'), 'aria-label':t('todo.edit') } }); obs.setIcon(edit, 'square-pen');
      check.onclick = async (event) => { event.stopPropagation(); await (todo.teamTodo ? onTeamTodoToggle?.(todo.raw, !todo.raw.done) : onTodoToggle(todo.raw.id, !todo.raw.done)); };
      const open = (event) => { event.stopPropagation(); todo.teamTodo ? onTeamTodoOpen?.(todo.raw) : openTodoEditor({ id:todo.raw.id }); };
      text.onclick = open;
      edit.onclick = open;
    } else if (rssEntry) {
      const open = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit', attr:{ type:'button', title:en ? 'Open RSS updates' : '查看 RSS 更新', 'aria-label':en ? 'Open RSS updates' : '查看 RSS 更新' } }); obs.setIcon(open, 'external-link');
      const show = (event) => { event?.stopPropagation?.(); openRss?.(date); }; text.onclick=show; open.onclick=show;
    } else if (countdown) {
      const edit = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit', attr:{ type:'button', title:en ? 'Edit countdown' : '编辑倒计时', 'aria-label':en ? 'Edit countdown' : '编辑倒计时' } }); obs.setIcon(edit, 'square-pen');
      const inspect = (event) => { event?.stopPropagation?.(); onCountdownOpen?.(countdown); }; text.onclick=inspect; edit.onclick=inspect;
    } else {
      const edit = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit', attr:{ type:'button', title:en ? 'Edit automation' : '编辑自动化', 'aria-label':en ? 'Edit automation' : '编辑自动化' } }); obs.setIcon(edit, 'settings-2');
      const run = rowActions.createEl('button', { cls:PLUGIN_ID + '-cal-detail-edit', attr:{ type:'button', title:en ? 'Run now' : '立即运行', 'aria-label':en ? 'Run now' : '立即运行' } }); obs.setIcon(run, 'play');
      const inspect = (event) => { event?.stopPropagation?.(); onAutomationOpen?.(automation.task); }; text.onclick=inspect; edit.onclick=inspect;
      run.onclick = async (event) => { event.stopPropagation(); run.disabled=true; try { await onAutomationRun?.(automation.task); await rerender?.(); } finally { run.disabled=false; } };
    }
  });
  return detail;
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={summarizeCalendarRss,calendarCountdownItemsForDate};
