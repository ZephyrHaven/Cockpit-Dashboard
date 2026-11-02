// module-presentation.js — 标题装饰统一使用宿主提供的线条图标。
function cockpitSetModuleTitleIcon(title, moduleId, iconName) {
  if (!title || title.querySelector('.' + PLUGIN_ID + '-module-title-icon')) return;
  const icon = title.createSpan({ cls:PLUGIN_ID + '-module-title-icon', attr:{ 'aria-hidden':'true' } });
  obs.setIcon(icon, iconName || COMPONENT_STORE_META[moduleId]?.icon || 'layout-grid');
  title.insertBefore(icon, title.firstChild);
}
function cockpitApplyModuleTitleIcon(wrapper, moduleId) {
  const selectors = {
    hero:'.' + PLUGIN_ID + '-greeting', tip:'.' + PLUGIN_ID + '-tip-label',
    calendar:'.' + PLUGIN_ID + '-cal-title', footer:'.' + PLUGIN_ID + '-footer'
  };
  const title = wrapper.querySelector(selectors[moduleId] || '.' + PLUGIN_ID + '-section-title');
  cockpitSetModuleTitleIcon(title, moduleId);
}
function cockpitRefreshModuleTitleIcons(plugin, enabled) {
  plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(({ view }) => {
    view._moduleTitleIconsEnabled = enabled;
    view.containerEl?.querySelectorAll('.' + PLUGIN_ID + '-root').forEach(root => {
      root.dataset.moduleTitleIcons = enabled ? 'on' : 'off';
    });
  });
}
