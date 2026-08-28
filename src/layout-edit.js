// layout-edit.js — 布局编辑能力：模块拖拽排序、显示/隐藏、重命名、折叠，
// 以及统计卡片与工具栏按钮的编辑态。全部实现为接收 view 的自由函数，
// 由 CockpitView 上的同名方法一行委托，保持既有调用点不变。
// 其他模块统一通过 view._makeModuleCollapsible(moduleId, titleEl, contentEl) 接入折叠，
// 不允许模块自行重复实现。

function cockpitGetModuleIdForElement(view, el) {
  if (!(el instanceof HTMLElement)) return null;
  if (el.tagName === 'STYLE') return null;
  return view._moduleRegistry().find((module) => module.matches(el))?.id || null;
}
function cockpitClearModuleDropHints(view, root) {
  root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
    wrapper.classList.remove('dragging', 'drop-before', 'drop-after');
  });
}
function cockpitApplyToolbarButtonEditState(view, root) {
  const toolbar = root.querySelector('.' + PLUGIN_ID + '-toolbar');
  if (!toolbar) return;
  toolbar.classList.toggle(PLUGIN_ID + '-toolbar-editing', view._editMode);
  toolbar.querySelectorAll('.' + PLUGIN_ID + '-toolslot').forEach((slot) => {
    const action = slot.dataset.action;
    const customId = slot.dataset.customId;
    const hidden = view._isToolbarActionHidden(action);
    const customHidden = customId && slot.dataset.hidden === 'true';
    const label = customId ? (slot.dataset.label || customId) : view._toolbarActionLabel(action);
    const btn = slot.querySelector('.' + PLUGIN_ID + '-toolbtn');
    const isHidden = customId ? customHidden : hidden;
    slot.classList.toggle('is-hidden', isHidden);
    slot.style.display = !view._editMode && isHidden ? 'none' : '';
    slot.draggable = view._editMode;
    if (btn) {
      btn.disabled = view._editMode;
      btn.setAttribute('aria-label', label);
    }
    const visibility = slot.querySelector('.' + PLUGIN_ID + '-toolbtn-visibility');
    if (visibility) {
      visibility.textContent = isHidden ? view._t('layout.show') : view._t('layout.hide');
      visibility.title = isHidden
        ? (view._lang() === 'en' ? 'Show button' : '显示按钮')
        : (view._lang() === 'en' ? 'Hide button' : '隐藏按钮');
      visibility.classList.toggle('is-hidden', isHidden);
      visibility.tabIndex = view._editMode ? 0 : -1;
    }
  });
  const addCustom = toolbar.querySelector('.' + PLUGIN_ID + '-custom-toolbar-add');
  if (addCustom) addCustom.style.display = view._editMode ? 'inline-flex' : 'none';
  const logs = toolbar.querySelector('.' + PLUGIN_ID + '-custom-toolbar-logs');
  if (logs) logs.style.display = view._editMode ? 'inline-flex' : 'none';
}
function cockpitApplyModuleEditState(view, root) {
  root.classList.toggle(PLUGIN_ID + '-layout-editing', view._editMode);
  const quickDoneBtn = root.querySelector('.' + PLUGIN_ID + '-layout-done');
  if (quickDoneBtn) {
    quickDoneBtn.style.display = view._editMode ? 'inline-flex' : 'none';
    quickDoneBtn.title = view._t('layout.done');
    quickDoneBtn.setAttribute('aria-label', view._t('layout.done'));
  }
  root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
    const moduleId = wrapper.dataset.moduleId;
    const hidden = view._isModuleHidden(moduleId);
    wrapper.classList.toggle('is-editing', view._editMode);
    wrapper.classList.toggle('is-hidden', hidden);
    wrapper.style.display = !view._editMode && hidden ? 'none' : '';
    const handle = wrapper.querySelector('.' + PLUGIN_ID + '-module-handle');
    const badge = wrapper.querySelector('.' + PLUGIN_ID + '-module-badge');
    const visibilityBtn = wrapper.querySelector('.' + PLUGIN_ID + '-module-visibility');
    const renameBtn = wrapper.querySelector('.' + PLUGIN_ID + '-module-rename');
    const label = view._moduleLabel(moduleId);
    if (badge) badge.textContent = hidden ? label + ' · ' + view._t('layout.hiddenTag') : label;
    if (handle) {
      handle.style.display = '';
      handle.draggable = view._editMode;
      handle.tabIndex = view._editMode ? 0 : -1;
      handle.setAttribute('aria-hidden', view._editMode ? 'false' : 'true');
    }
    if (visibilityBtn) {
      visibilityBtn.style.display = '';
      visibilityBtn.textContent = hidden ? view._t('layout.show') : view._t('layout.hide');
      visibilityBtn.title = hidden
        ? view._t('layout.showModule', { module: label })
        : view._t('layout.hideModule', { module: label });
      visibilityBtn.tabIndex = view._editMode ? 0 : -1;
      visibilityBtn.classList.toggle('is-hidden', hidden);
    }
    if (renameBtn) {
      renameBtn.style.display = view._moduleTitleElement(wrapper) ? '' : 'none';
      renameBtn.title = view._lang() === 'en' ? `Rename ${label}` : `重命名“${label}”`;
      renameBtn.setAttribute('aria-label', renameBtn.title);
      renameBtn.tabIndex = view._editMode ? 0 : -1;
    }
  });
  root.querySelectorAll('.' + PLUGIN_ID + '-tip-manage').forEach((button) => {
    button.style.display = view._editMode ? 'inline-flex' : 'none';
  });
  root.querySelectorAll('.' + PLUGIN_ID + '-stat').forEach((card) => {
    const hidden = view._hiddenStatsCards.has(card.dataset.statId);
    card.classList.toggle('is-stat-hidden', hidden);
    card.classList.toggle('is-stat-editing', view._editMode);
    card.draggable = view._editMode;
    card.style.display = !view._editMode && hidden ? 'none' : '';
    const hide = card.querySelector('.' + PLUGIN_ID + '-stat-hide');
    if (hide) {
      hide.textContent = hidden ? '＋' : '−';
      hide.title = hidden ? (view._lang() === 'en' ? 'Show this card' : '显示这张卡片') : (view._lang() === 'en' ? 'Hide this card' : '隐藏这张卡片');
      hide.setAttribute('aria-label', hide.title);
    }
  });
  cockpitApplyToolbarButtonEditState(view, root);
}
function cockpitWireModuleDnD(view, root) {
  root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
    const moduleId = wrapper.dataset.moduleId;
    const label = view._moduleLabel(moduleId);
    let tools = wrapper.querySelector(':scope > .' + PLUGIN_ID + '-module-tools');
    let badge;
    let handle;
    let visibilityBtn;
    let renameBtn;
    if (!tools) {
      tools = document.createElement('div');
      tools.className = PLUGIN_ID + '-module-tools';
      badge = document.createElement('span');
      badge.className = PLUGIN_ID + '-module-badge';
      visibilityBtn = document.createElement('button');
      visibilityBtn.type = 'button';
      visibilityBtn.className = PLUGIN_ID + '-module-visibility';
      renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = PLUGIN_ID + '-module-rename';
      renameBtn.textContent = '✎';
      handle = document.createElement('button');
      handle.type = 'button';
      handle.className = PLUGIN_ID + '-module-handle';
      handle.textContent = '↕';
      tools.appendChild(badge);
      tools.appendChild(renameBtn);
      tools.appendChild(visibilityBtn);
      tools.appendChild(handle);
      wrapper.prepend(tools);
    } else {
      badge = tools.querySelector('.' + PLUGIN_ID + '-module-badge');
      visibilityBtn = tools.querySelector('.' + PLUGIN_ID + '-module-visibility');
      renameBtn = tools.querySelector('.' + PLUGIN_ID + '-module-rename');
      handle = tools.querySelector('.' + PLUGIN_ID + '-module-handle');
    }
    if (badge) badge.textContent = label;
    if (visibilityBtn) {
      visibilityBtn.onclick = async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const nextHidden = !view._isModuleHidden(moduleId);
        const hiddenModules = new Set(view._hiddenModules);
        if (nextHidden) hiddenModules.add(moduleId);
        else hiddenModules.delete(moduleId);
        await view._saveHiddenModules(Array.from(hiddenModules));
        cockpitApplyModuleEditState(view, root);
      };
    }
    if (renameBtn) {
      renameBtn.onclick = async (evt) => {
        evt.preventDefault(); evt.stopPropagation();
        if (!view._editMode) return;
        const titleEl = view._moduleTitleElement(wrapper);
        const builtIn = titleEl?.dataset.defaultModuleTitle || view._moduleRegistry().find((module) => module.id === moduleId)?.label || moduleId;
        const current = view._customModuleLabels[moduleId] || builtIn;
        const input = window.prompt(view._lang() === 'en' ? 'Module title (leave empty to restore default)' : '组件标题（留空恢复默认名称）', current);
        if (input === null) return;
        const value = input.trim().slice(0,40);
        if (!value || value === builtIn) delete view._customModuleLabels[moduleId];
        else view._customModuleLabels[moduleId] = value;
        await view._saveActiveSceneLayout();
        view._applyCustomModuleTitle(wrapper, moduleId);
        wrapper.dataset.moduleLabel = view._moduleLabel(moduleId);
        cockpitApplyModuleEditState(view, root);
      };
    }
    if (handle) {
      handle.title = view._t('layout.dragHandle', { module: label });
      handle.draggable = view._editMode;
      handle.tabIndex = view._editMode ? 0 : -1;
      handle.ondragstart = (evt) => {
        if (!view._editMode) {
          evt.preventDefault();
          return;
        }
        view._dragModuleId = moduleId;
        wrapper.classList.add('dragging');
        evt.dataTransfer.effectAllowed = 'move';
        evt.dataTransfer.setData('text/plain', moduleId);
      };
      handle.ondragend = () => {
        view._dragModuleId = null;
        cockpitClearModuleDropHints(view, root);
      };
    }
    wrapper.ondragover = (evt) => {
      const draggedId = view._dragModuleId || evt.dataTransfer.getData('text/plain');
      if (!view._editMode || !draggedId || draggedId === moduleId) return;
      evt.preventDefault();
      const rect = wrapper.getBoundingClientRect();
      const before = evt.clientY < rect.top + rect.height / 2;
      wrapper.classList.toggle('drop-before', before);
      wrapper.classList.toggle('drop-after', !before);
    };
    wrapper.ondragleave = () => {
      wrapper.classList.remove('drop-before', 'drop-after');
    };
    wrapper.ondrop = async (evt) => {
      const draggedId = view._dragModuleId || evt.dataTransfer.getData('text/plain');
      if (!view._editMode || !draggedId || draggedId === moduleId) return;
      evt.preventDefault();
      const dragged = root.querySelector('.' + PLUGIN_ID + '-module[data-module-id="' + draggedId + '"]');
      if (!dragged) return;
      const rect = wrapper.getBoundingClientRect();
      const before = evt.clientY < rect.top + rect.height / 2;
      if (before) root.insertBefore(dragged, wrapper);
      else root.insertBefore(dragged, wrapper.nextSibling);
      cockpitClearModuleDropHints(view, root);
      await view._saveModuleOrder(Array.from(root.querySelectorAll('.' + PLUGIN_ID + '-module')).map((el) => el.dataset.moduleId));
    };
  });
  cockpitApplyModuleEditState(view, root);
}
function cockpitApplyModuleLayout(view, root) {
  Array.from(root.querySelectorAll(':scope > .' + PLUGIN_ID + '-module')).forEach((wrapper) => {
    while (wrapper.firstChild) {
      const child = wrapper.firstChild;
      if (child.classList && child.classList.contains(PLUGIN_ID + '-module-tools')) {
        child.remove();
        continue;
      }
      root.insertBefore(child, wrapper);
    }
    wrapper.remove();
  });
  const groups = new Map(view._defaultModuleOrder().map((id) => [id, []]));
  const unclassified = [];
  Array.from(root.children).forEach((child) => {
    if (child.tagName === 'STYLE') return;
    const moduleId = cockpitGetModuleIdForElement(view, child);
    if (moduleId && groups.has(moduleId)) groups.get(moduleId).push(child);
    else unclassified.push(child);
  });
  const fragment = document.createDocumentFragment();
  view._normalizeModuleOrder(view._moduleOrder).forEach((moduleId) => {
    const nodes = groups.get(moduleId) || [];
    if (!nodes.length) return;
    const wrapper = document.createElement('section');
    wrapper.className = PLUGIN_ID + '-module';
    wrapper.dataset.moduleId = moduleId;
    wrapper.dataset.moduleLabel = view._moduleLabel(moduleId);
    nodes.forEach((node) => wrapper.appendChild(node));
    view._applyCustomModuleTitle(wrapper, moduleId);
    fragment.appendChild(wrapper);
  });
  unclassified.forEach((node) => fragment.appendChild(node));
  root.appendChild(fragment);
  cockpitWireModuleDnD(view, root);
}
function cockpitMakeModuleCollapsible(view, moduleId, titleEl, contentEl, defaultCollapsed) {
  const module = view._moduleRegistry().find((entry) => entry.id === moduleId);
  if (!module?.collapsible || !titleEl || !contentEl) return;
  cockpitMakeCollapsible(view, titleEl, contentEl, moduleId, defaultCollapsed);
}
function cockpitMakeCollapsible(view, titleEl, contentEl, key, defaultCollapsed) {
  if (titleEl.dataset.collapseBound === 'true') return;
  const arrow = titleEl.createSpan({ cls: PLUGIN_ID+'-collapse-arrow', text: '▼', attr:{ style:'margin-left:6px;font-size:0.7em;opacity:0.45;transition:transform 0.2s;display:inline-block;' } });
  titleEl.style.cursor = 'pointer';
  titleEl.tabIndex = 0;
  titleEl.setAttribute('role', 'button');
  let collapsed = view._collapsed && view._collapsed[key];
  if (collapsed === undefined) collapsed = defaultCollapsed || false;
  const apply = () => {
    contentEl.style.display = collapsed ? 'none' : '';
    arrow.textContent = collapsed ? '▶' : '▼';
    titleEl.setAttribute('aria-expanded', String(!collapsed));
  };
  apply();
  titleEl.dataset.collapseBound = 'true';
  const toggle = (e) => {
    if (e.target.closest('button,input,a,textarea,select')) return;
    collapsed = !collapsed;
    apply();
    view._collapsed[key] = collapsed;
    view._mutatePluginData((data) => { data.collapsed = { ...view._collapsed }; })
      .catch((ex) => console.warn('save collapsed', ex));
  };
  titleEl.addEventListener('click', toggle);
  titleEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggle(e);
  });
}
