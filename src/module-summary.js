// module-summary.js — 折叠状态下的模块摘要。
// 模块渲染时把轻量结果挂到 view 上（_alarmSummary 等），标题折叠后即可显示关键信息，
// 不需要为了摘要再读一次 Vault 或等待异步服务。

function cockpitModuleSummary(view, moduleId) {
  const en = view._lang() === 'en';
  const todos = Array.isArray(view._todos) ? view._todos : [];
  switch (moduleId) {
    case 'todos': {
      const open = todos.filter((todo) => !todo.done);
      const now = window.moment();
      const today = now.clone().startOf('day');
      const overdue = open.filter((todo) => todo.dueDate && todo.dueDate.isBefore(today, 'day')).length;
      const dueToday = open.filter((todo) => todo.dueDate && todo.dueDate.isSame(today, 'day')).length;
      const parts = [en ? open.length + ' open' : open.length + ' 项未完成'];
      if (overdue) parts.push(en ? overdue + ' overdue' : overdue + ' 项逾期');
      if (dueToday) parts.push(en ? dueToday + ' today' : dueToday + ' 项今天到期');
      return open.length ? parts.join(' · ') : (en ? 'All clear' : '已全部完成');
    }
    case 'calendar':
      return view._calendarSummary || '';
    case 'cats':
      return view._categorySummary || '';
    case 'stats': {
      const done = todos.filter((todo) => todo.done).length;
      const pct = todos.length ? Math.round(done / todos.length * 100) : 0;
      return todos.length ? (en ? pct + '% done · ' + todos.length + ' tasks' : '完成率 ' + pct + '% · 共 ' + todos.length + ' 项') : '';
    }
    case 'teamTodos':
      return view._teamSummary || '';
    case 'habits':
      return view._habitSummary || '';
    case 'projects':
      return view._projectSummary || '';
    case 'focusChart': {
      const minutes = Number(view._focusMinutes) || 0;
      return minutes ? (en ? minutes + ' min today' : '今日专注 ' + minutes + ' 分钟') : (en ? 'No focus yet today' : '今天还没有专注记录');
    }
    case 'bookmarks':
      return view._bookmarks?.size ? (en ? view._bookmarks.size + ' pinned' : view._bookmarks.size + ' 篇收藏') : '';
    case 'flash': {
      const pending = Array.isArray(view._flashInbox) ? view._flashInbox.length : 0;
      return pending ? (en ? pending + ' to organize' : pending + ' 条待整理') : '';
    }
    case 'recent':
      return view._recentOpened?.length ? (en ? view._recentOpened.length + ' visited' : view._recentOpened.length + ' 篇最近打开') : '';
    case 'heatmap':
      return view._heatmapSummary || '';
    case 'alarms':
      return view._alarmSummary || '';
    case 'countdowns':
      return view._countdownSummary || '';
    case 'scheduledTasks':
      return view._scheduledSummary || '';
    case 'workflows':
      return view._workflowSummary || '';
    case 'reportStudio':
      return view._reportSummary || '';
    case 'resurface':
      return view._resurfaceSummary || '';
    default:
      return view._moduleSummaries?.[moduleId] || '';
  }
}

function cockpitRefreshModuleSummaries(view) {
  const root = view.containerEl?.children?.[1]?.querySelector('.' + PLUGIN_ID + '-root');
  if (!root) return;
  root.querySelectorAll('[data-module-summary-for]').forEach((node) => {
    const moduleId = node.dataset.moduleSummaryFor;
    const text = cockpitModuleSummary(view, moduleId);
    node.textContent = text;
    const title = node.closest('.' + PLUGIN_ID + '-section-title');
    const collapsed = title?.getAttribute('aria-expanded') === 'false';
    node.style.display = collapsed && text ? '' : 'none';
  });
}

function cockpitSyncCollapseSummary(view, titleEl) {
  const node = titleEl?.querySelector?.('[data-module-summary-for]');
  if (!node) return;
  const moduleId = node.dataset.moduleSummaryFor;
  const text = cockpitModuleSummary(view, moduleId);
  node.textContent = text;
  node.style.display = titleEl.getAttribute('aria-expanded') === 'false' && text ? '' : 'none';
}
