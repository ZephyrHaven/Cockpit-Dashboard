// agenda.js — 今日时间流：把「今天到期的待办 + 今天的闹钟 + 今日 RSS 条目」
// 合并成一条按时间排序的时间线。数据全部来自内存/已有服务，不额外读 vault 文件。

async function buildAgendaModule(view, root, options = {}) {
  const en = view._lang() === 'en';
  const openTodoEditor = typeof options.openTodoEditor === 'function' ? options.openTodoEditor : null;
  const rss = options.rss || null;
  const openRss = typeof options.openRss === 'function' ? options.openRss : null;

  // 标题与待办/闹钟模块同一套写法，支持编辑模式重命名。
  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title' });
  title.dataset.section = 'agenda-title';
  title.createSpan({ text: view._t('sections.agenda') });
  const countEl = title.createSpan({ cls: PLUGIN_ID + '-agenda-count' });

  const body = root.createDiv({ cls: PLUGIN_ID + '-agenda' });
  body.dataset.section = 'agenda-body';

  const collectItems = async () => {
    const now = window.moment();
    const todayKey = now.format('YYYY-MM-DD');
    const items = [];

    (view._todos || []).forEach((todo) => {
      if (todo.done || !todo.dueDate || !todo.dueDate.isSame(now, 'day')) return;
      items.push({
        kind:'todo',
        time:todo.dueHasTime ? todo.dueDate.format('HH:mm') : '',
        sortTime:todo.dueHasTime ? todo.dueDate.valueOf() : Number.MAX_SAFE_INTEGER,
        text:todo.text,
        priority:todo.priority || 'mid',
        id:todo.id
      });
    });

    try {
      const alarms = await view._plugin.alarms.load();
      (alarms || []).forEach((alarm) => {
        if (!alarm.enabled) return;
        const occurrence = nextAlarmOccurrence(alarm);
        if (!occurrence) return;
        const occMoment = window.moment(occurrence);
        if (!occMoment.isSame(now, 'day')) return;
        items.push({ kind:'alarm', time:alarm.time, sortTime:occurrence.valueOf(), text:alarm.name || (en ? 'Alarm' : '闹钟'), id:alarm.id });
      });
    } catch (e) { console.warn('Cockpit agenda alarm load failed', e); }

    try {
      if (rss?.config?.enabled) {
        rss.itemsForDate(now).slice(0, 12).forEach((item) => {
          items.push({ kind:'rss', time:'', sortTime:Number(item.publishedAt) || Number.MAX_SAFE_INTEGER - 1, text:item.title || (en ? 'RSS entry' : '订阅条目'), feedName:rss.getFeed(item.feedId)?.name || 'RSS', id:item.id });
        });
      }
    } catch (e) { console.warn('Cockpit agenda rss load failed', e); }

    return items.sort((a, b) => a.sortTime - b.sortTime || a.kind.localeCompare(b.kind));
  };

  const render = async () => {
    if (!body.isConnected) return;
    const items = await collectItems();
    body.empty();
    countEl.setText(items.length ? String(items.length) : '');
    if (!items.length) {
      body.createDiv({ cls: PLUGIN_ID + '-agenda-empty', text: en
        ? 'Nothing on the timeline today.'
        : '今天的时间流是空的。' });
      return;
    }
    items.forEach((item) => {
      const row = body.createDiv({ cls: PLUGIN_ID + '-agenda-row kind-' + item.kind, attr:{ role:'button', tabindex:'0' } });
      row.createSpan({ cls: PLUGIN_ID + '-agenda-time', text: item.time || '--:--' });
      const iconMap = { todo:'check-circle-2', alarm:'alarm-clock', rss:'rss' };
      obs.setIcon(row.createSpan({ cls:PLUGIN_ID + '-agenda-icon' }), iconMap[item.kind] || 'circle');
      const main = row.createDiv({ cls: PLUGIN_ID + '-agenda-main' });
      main.createDiv({ cls: PLUGIN_ID + '-agenda-text prio-' + (item.priority || 'mid'), text:item.text });
      let subText = '';
      if (item.kind === 'rss') subText = item.feedName;
      else if (item.kind === 'todo') subText = en ? 'Task due today' : '今日到期';
      else if (item.kind === 'alarm') subText = en ? 'Alarm' : '闹钟';
      if (subText) main.createDiv({ cls: PLUGIN_ID + '-agenda-sub', text:subText });

      const open = () => {
        if (view._editMode) return;
        if (item.kind === 'todo' && openTodoEditor && item.id) openTodoEditor({ id:item.id });
        else if (item.kind === 'rss' && openRss) openRss(window.moment());
      };
      row.onclick = open;
      row.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
    });
  };

  // 闹钟变化时跟随刷新（与闹钟模块同一订阅通道，各自独立清理）。
  view._agendaAlarmUnsubscribe?.();
  try {
    view._agendaAlarmUnsubscribe = view._plugin.alarms.subscribe(() => render().catch((e) => console.warn('Cockpit agenda re-render failed', e)));
  } catch (e) {}

  view._refreshAgendaRef = render;
  try { await render(); } catch (e) { console.warn('Cockpit agenda failed; dashboard basics remain available', e); }
  view._makeModuleCollapsible('agenda', title, body);
  return render;
}
