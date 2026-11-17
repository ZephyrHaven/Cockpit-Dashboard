// module-presentation.js — 模块标题图标与临时聚焦。
function cockpitModuleIcon(moduleId) {
  return COMPONENT_STORE_META[moduleId]?.icon || 'layout-grid';
}
function cockpitSetModuleTitleIcon(title, moduleId, language, iconName) {
  if (!title || title.querySelector('.' + PLUGIN_ID + '-module-title-icon')) return;
  const en = language === 'en';
  const icon = title.createEl('button', {
    cls:PLUGIN_ID + '-module-title-icon',
    attr:{ type:'button', title:en ? 'Double-click to focus for 10 seconds' : '双击聚焦 10 秒',
      'aria-label':en ? 'Focus this section for 10 seconds' : '聚焦此模块 10 秒' }
  });
  obs.setIcon(icon.createSpan({ attr:{ 'aria-hidden':'true' } }), iconName || cockpitModuleIcon(moduleId));
  title.insertBefore(icon, title.firstChild);
}
function cockpitApplyModuleTitleIcon(wrapper, moduleId, language) {
  const selectors = {
    hero:'.' + PLUGIN_ID + '-greeting', tip:'.' + PLUGIN_ID + '-tip-label',
    calendar:'.' + PLUGIN_ID + '-cal-title', footer:'.' + PLUGIN_ID + '-footer'
  };
  const title = wrapper.querySelector(selectors[moduleId] || '.' + PLUGIN_ID + '-section-title');
  cockpitSetModuleTitleIcon(title, moduleId, language);
}

function cockpitClearModuleFocus(view) {
  const focus = view._moduleFocus;
  if (!focus) return;
  clearTimeout(focus.timer);
  focus.wrapper.classList.remove('is-module-focused');
  delete focus.root.dataset.moduleFocus;
  view._moduleFocus = null;
}

function cockpitSyncModuleFocus(view, root) {
  const focus = view._moduleFocus;
  if (focus?.root !== root) return;
  const wrapper = Array.from(root.children).find(el => el.dataset.moduleId === focus.moduleId);
  if (view._editMode || !wrapper || view._isModuleHidden(focus.moduleId)) {
    cockpitClearModuleFocus(view);
  } else if (wrapper !== focus.wrapper) {
    focus.wrapper.classList.remove('is-module-focused');
    wrapper.classList.add('is-module-focused');
    focus.wrapper = wrapper;
  }
}

function cockpitBindModuleFocus(view, root) {
  const titleIcon = '.' + PLUGIN_ID + '-module-title-icon';
  const section = '.' + PLUGIN_ID + '-module';
  const listeners = new AbortController();
  const options = { signal:listeners.signal };
  const activate = (moduleId, wrapper) => {
    if (wrapper?.parentElement !== root || view._editMode || view._isModuleHidden(moduleId)) return;
    cockpitClearModuleFocus(view);
    wrapper.classList.add('is-module-focused');
    root.dataset.moduleFocus = moduleId;
    view._moduleFocus = { root, wrapper, moduleId, timer:setTimeout(() => cockpitClearModuleFocus(view), 10000) };
  };
  const onActivate = event => {
    const doubleClick = event.type === 'dblclick';
    if (!doubleClick && event.detail !== 0) return;
    const icon = event.target.closest(titleIcon);
    if (icon) {
      const wrapper = icon.closest(section);
      activate(wrapper?.dataset.moduleId, wrapper);
    } else if (doubleClick) {
      const moduleId = event.target.closest('.' + PLUGIN_ID + '-module-nav-item')?.dataset.navModule;
      if (!moduleId) return;
      const wrapper = Array.from(root.children).find(el => el.dataset.moduleId === moduleId);
      activate(moduleId, wrapper);
    }
  };
  root.addEventListener('dblclick', onActivate, options);
  root.addEventListener('click', onActivate, options);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented && view._moduleFocus?.root === root) {
      cockpitClearModuleFocus(view);
    }
  }, options);
  return () => {
    listeners.abort();
    cockpitClearModuleFocus(view);
  };
}

function cockpitRefreshModuleTitleIcons(plugin, enabled) {
  plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(({ view }) => {
    view._moduleTitleIconsEnabled = enabled;
    view.containerEl?.querySelectorAll('.' + PLUGIN_ID + '-root').forEach(root => {
      root.dataset.moduleTitleIcons = enabled ? 'on' : 'off';
    });
  });
}
