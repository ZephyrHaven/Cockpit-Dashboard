// command-palette.js — Spotlight 内的命令模式：输入 > 后跳转模块、执行常用动作或切换情景。
// 只复用现有入口（_doAction、组件商店、设置、情景方法），不新增独立的命令系统。

function cockpitCommandItems(view) {
  if (!view) return [];
  const en = view._lang() === 'en';
  const items = [];
  view._normalizeModuleOrder(view._moduleOrder).forEach((moduleId) => {
    if (view._isModuleHidden(moduleId)) return;
    items.push({
      kind:'command', group:en ? 'Jump to section' : '跳转模块', name:view._moduleLabel(moduleId),
      sub:en ? 'Scroll to this dashboard section' : '滚动到该仪表盘分区',
      icon:cockpitModuleIcon(moduleId),
      action:() => view._jumpToModule?.(moduleId)
    });
  });
  const menu = typeof cockpitDashboardMenuItems === 'function' ? cockpitDashboardMenuItems(view).filter((item) => !item.separator) : [];
  menu.forEach((item) => items.push({
    kind:'command', group:en ? 'Actions' : '常用动作', name:item.title, sub:en ? 'Run command' : '执行命令',
    icon:item.icon || 'terminal', action:item.onClick
  }));
  items.push({
    kind:'command', group:en ? 'Actions' : '常用动作', name:en ? 'Quick capture' : '快速记录待办',
    sub:en ? 'Capture a task with dates and priorities' : '识别日期、时间与优先级并创建待办',
    icon:'zap', action:() => new CockpitQuickCaptureModal(view.app, view._plugin).open()
  });
  items.push({
    kind:'command', group:en ? 'Actions' : '常用动作', name:en ? 'Open or create today’s note' : '打开 / 创建今日笔记',
    sub:en ? 'Jump to the daily note' : '直达今日日记', icon:'calendar', action:() => view._doAction('today-note')
  });
  view._sceneList().forEach((scene) => items.push({
    kind:'command', group:en ? 'Layout scenes' : '切换情景', name:view._sceneLabel(scene),
    sub:scene.id === view._activeSceneId ? (en ? 'Current scene' : '当前情景') : (en ? 'Switch layout' : '切换到该布局'),
    icon:'layers-3', action:() => view._switchScene(scene.id)
  }));
  return items;
}

function cockpitSearchCommands(view, rawQuery) {
  const items = cockpitCommandItems(view);
  const query = String(rawQuery || '').replace(/^\s*>/, '').trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => (item.name + ' ' + (item.sub || '') + ' ' + (item.group || '')).toLowerCase().includes(query));
}
