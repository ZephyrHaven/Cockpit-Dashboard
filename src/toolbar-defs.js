// toolbar-defs.js — 工具栏按钮与默认命令的定义层：预置按钮清单、
// 移动端精简规则、默认 shell 命令占位与按钮集合的规范化。
// 只有定义；按钮的 DOM 构建在 toolbar.js，编辑态在 layout-edit.js。

function cockpitToolbarButtonDefs(view) {
  const desktopOnly = view._isMobile() ? new Set(['hermes','cockpit-h5','work-log']) : new Set();
  const buttons = [
    { icon: '+', label: view._t('toolbar.new'), action: 'new', primary: true },
    { icon: E.search, label: view._t('toolbar.search'), action: 'search' },
    { icon: E.tag, label: view._t('toolbar.tag'), action: 'tag' },
    { icon: E.graph, label: view._t('toolbar.graph'), action: 'graph' },
    { icon: E.bolt, label: view._t('toolbar.command'), action: 'command' },
    { icon: '🤖', label: view._toolbarCmds?.Hermes?.label || view._t('toolbar.hermes'), action: 'hermes' },
    { icon: '🛩️', label: view._toolbarCmds?.['驾驶舱']?.label || view._t('toolbar.cockpit'), action: 'cockpit-h5' },
    { icon: '📝', label: view._toolbarCmds?.['工作日志']?.label || view._t('toolbar.workLog'), action: 'work-log' },
    { icon: E.cal, label: view._t('toolbar.todayNote'), action: 'today-note' },
    { icon: '🔔', label: view._lang() === 'en' ? 'Notifications' : '通知设置', action: 'notifications' },
    { icon: '🍅', label: view._t('toolbar.pomodoro'), action: 'pomodoro' }
  ].filter((button) => !view._deletedToolbarActions.has(button.action) && !desktopOnly.has(button.action));
  if (!view._isMobile()) return buttons;
  const primary = buttons.filter((button) => ['new','search','pomodoro'].includes(button.action));
  primary.push({ icon:'•••', label:view._lang() === 'en' ? 'More' : '更多', action:'more' });
  return primary;
}
function cockpitDefaultToolbarCommands(view) {
  // 通用默认值：不含任何本机路径。个人命令通过工具栏配置写入 data.json。
  if (view._isMobile()) return {};
  return {
    Hermes: { command:'', mode:'auto' },
    '驾驶舱': { command:'', url:DEFAULT_COCKPIT_URL },
    '工作日志': { command:'', url:'' }
  };
}
function cockpitNormalizeToolbarActionSubset(view, list) {
  const defaults = new Set(view._toolbarActionIds());
  const seen = new Set();
  return Array.isArray(list)
    ? list.filter((id) => defaults.has(id) && !seen.has(id) && (seen.add(id), true))
    : [];
}
