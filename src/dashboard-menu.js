// dashboard-menu.js — 全局菜单只保留常用操作与集中管理入口。
function openCockpitPluginSettings(view, section = 'appearance') {
  const existing = view._plugin._cockpitSettingsModal;
  if (existing && !existing.closed) return;
  const en = view._lang() === 'en';
  const modal = new CockpitDetailModal(view, en ? 'Plugin settings' : '插件设置', (parent, surface) => {
    surface.modalEl.addClass(PLUGIN_ID + '-plugin-settings-modal');
    parent.querySelector(':scope > h2')?.remove();
    const tab = new CockpitServerChanSettingTab(view.app, view._plugin, cleanup => surface.registerCleanup(cleanup));
    surface.registerCleanup(() => { ++tab._displayVersion; });
    surface.registerCleanup(() => { if (view._plugin._cockpitSettingsModal === surface) view._plugin._cockpitSettingsModal = null; });
    tab._activeSection = normalizeCockpitSettingsSection(section);
    tab.containerEl = parent.createDiv();
    return tab.display();
  });
  view._plugin._cockpitSettingsModal = modal;
  modal.open();
}
function cockpitDashboardMenuItems(view) {
  const en = view._lang() === 'en';
  const actions = view._blankContextMenuItems || [];
  return [
    ...actions.filter(item => ['newNote','searchNotes','startPomodoro'].includes(item.id)),
    { separator:true },
    { title:en ? 'Component store' : '组件商店', icon:'blocks', onClick:() => openComponentStore(view) },
    { title:en ? 'Plugin settings' : '插件设置', icon:'settings', onClick:() => openCockpitPluginSettings(view) },
    { title:en ? 'Logs & diagnostics' : '日志与诊断', icon:'scroll-text', onClick:() => openCockpitLogs(view) },
    { title:en ? 'Manage RSS subscriptions' : '管理 RSS 订阅源', icon:'rss', onClick:() => new CockpitRssSettingsModal(view.app, view).open() },
    { separator:true },
    ...actions.filter(item => item.id === 'exportBackup'),
    { title:en ? 'Data migration' : '数据迁移', icon:'database', onClick:() => openStorageMigration(view) },
    { separator:true },
    { title:view._t('contextMenu.refreshPage'), icon:'refresh-cw', onClick:() => view._renderDashboard(true) }
  ];
}
