// weekly-workspace.js — 周回顾与周报共用一个可排序、可折叠的模块。
async function buildWeeklyWorkspaceModule(view, root) {
  const en = view._lang() === 'en';
  const title = root.createDiv({ cls:PLUGIN_ID + '-section-title', text:view._t('sections.reportStudio') });
  title.dataset.section = 'report-studio-title';
  const body = root.createDiv({ cls:PLUGIN_ID + '-weekly-workspace' });
  body.dataset.section = 'report-studio-body';
  const tabs = body.createDiv({ cls:PLUGIN_ID + '-workspace-tabs', attr:{ role:'tablist', 'aria-label':en ? 'Weekly workspace' : '周报与回顾' } });
  const entries = [['review', en ? 'Weekly review' : '每周回顾'], ['report', en ? 'Report studio' : '周报工坊']].map(([id,label]) => {
    const button = tabs.createEl('button', { text:label, attr:{ type:'button', role:'tab', 'aria-selected':String(id === 'review'), tabindex:id === 'review' ? '0' : '-1' } });
    const panel = body.createDiv({ cls:PLUGIN_ID + '-workspace-panel', attr:{ role:'tabpanel', 'aria-label':label } });
    panel.hidden = id !== 'review';
    button.id = PLUGIN_ID + '-weekly-tab-' + id;
    panel.id = PLUGIN_ID + '-weekly-panel-' + id;
    button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', button.id);
    return { id, button, panel };
  });
  const select = (id) => {
    entries.forEach((entry) => {
      const active = entry.id === id;
      entry.button.setAttribute('aria-selected', String(active));
      entry.button.tabIndex = active ? 0 : -1;
      entry.panel.hidden = !active;
    });
  };
  entries.forEach((entry, index) => {
    entry.button.onclick = () => select(entry.id);
    entry.button.onkeydown = (event) => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
      select(entries[next].id); entries[next].button.focus();
    };
  });
  view._refreshWeeklyReviewRef = null;
  view._refreshWeeklyReportRef = null;
  for (const entry of entries) {
    try {
      if (entry.id === 'review') await buildWeeklyReviewModule(view, entry.panel, { embedded:true });
      else view._refreshWeeklyReportRef = buildWeeklyReportModule(view, entry.panel, { embedded:true });
    } catch (error) {
      entry.panel.createEl('p', { text:en ? 'This section is temporarily unavailable.' : '这个功能暂时无法加载。' });
      console.warn('Cockpit weekly workspace section failed', entry.id, error);
    }
  }
  view._makeModuleCollapsible('reportStudio', title, body);
}
