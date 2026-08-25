// toolbar.js — Toolbar 排序、渲染与统一编辑交互

function normalizeToolbarOrder(view, rawOrder) {
  const available = [
    ...view._toolbarButtons().map((button) => button.action),
    ...view._customToolbarButtons.map((button) => 'custom:' + button.id)
  ];
  const allowed = new Set(available);
  const result = [];
  (Array.isArray(rawOrder) ? rawOrder : []).forEach((action) => {
    if (allowed.has(action) && !result.includes(action)) result.push(action);
  });
  available.forEach((action) => { if (!result.includes(action)) result.push(action); });
  return result;
}

async function saveToolbarOrder(view, order) {
  const normalized = normalizeToolbarOrder(view, order);
  view._toolbarOrder = normalized;
  await view._saveActiveSceneLayout();
}

function refreshToolbar(view, root) {
  if (!root) return;
  const previous = root.querySelector('.' + PLUGIN_ID + '-toolbar');
  if (!previous) return;
  const anchor = document.createComment('cockpit-toolbar');
  previous.replaceWith(anchor);
  const { toolbar } = buildToolbar(view, root, view.app.vault.getMarkdownFiles(), (key, vars) => view._t(key, vars));
  anchor.replaceWith(toolbar);
}

function clearToolbarDropHints(toolbar) {
  toolbar.querySelectorAll('.' + PLUGIN_ID + '-toolslot').forEach((slot) => slot.classList.remove('dragging','drop-before','drop-after'));
}

function attachToolbarDrag(view, toolbar, slot) {
  slot.addEventListener('dragstart', (evt) => {
    if (!view._editMode) { evt.preventDefault(); return; }
    clearToolbarDropHints(toolbar);
    slot.classList.add('dragging');
    evt.dataTransfer.effectAllowed = 'move';
    evt.dataTransfer.setData('text/plain', slot.dataset.action);
  });
  slot.addEventListener('dragover', (evt) => {
    if (!view._editMode) return;
    const source = toolbar.querySelector('.' + PLUGIN_ID + '-toolslot.dragging');
    if (!source || source === slot) return;
    evt.preventDefault();
    const before = evt.clientX < slot.getBoundingClientRect().left + slot.getBoundingClientRect().width / 2;
    slot.classList.toggle('drop-before', before);
    slot.classList.toggle('drop-after', !before);
  });
  slot.addEventListener('dragleave', () => slot.classList.remove('drop-before','drop-after'));
  slot.addEventListener('drop', async (evt) => {
    if (!view._editMode) return;
    evt.preventDefault();
    const source = toolbar.querySelector('.' + PLUGIN_ID + '-toolslot.dragging');
    if (!source || source === slot) { clearToolbarDropHints(toolbar); return; }
    const before = evt.clientX < slot.getBoundingClientRect().left + slot.getBoundingClientRect().width / 2;
    if (before) toolbar.insertBefore(source, slot); else toolbar.insertBefore(source, slot.nextSibling);
    clearToolbarDropHints(toolbar);
    await saveToolbarOrder(view, Array.from(toolbar.querySelectorAll('.' + PLUGIN_ID + '-toolslot')).map((item) => item.dataset.action));
  });
  slot.addEventListener('dragend', () => clearToolbarDropHints(toolbar));
}

function createToolbarTool(parent, icon, title, extraClass) {
  const button = parent.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-tool' + (extraClass ? ' ' + extraClass : ''), attr:{type:'button',title} });
  button.draggable = false;
  button.addEventListener('dragstart', (evt) => evt.preventDefault());
  obs.setIcon(button, icon);
  return button;
}

function createToolbarDeleteTool(view, root, tools, button) {
  const remove = createToolbarTool(tools, 'trash-2', view._lang()==='en'?'Delete button':'删除按钮', 'danger');
  remove.onclick = async (evt) => {
    evt.preventDefault(); evt.stopPropagation();
    const label = button.label || (view._lang()==='en'?'this button':'这个按钮');
    if (!window.confirm(view._lang()==='en' ? `Delete “${label}”?` : `确定删除“${label}”吗？`)) return;
    if (button.builtin) await view._deletePresetToolbarAction(button.action);
    else await view._saveCustomToolbarButtons(view._customToolbarButtons.filter((item) => item.id !== button.id));
    const slot = tools.closest('.' + PLUGIN_ID + '-toolslot');
    if (slot) slot.remove();
    await saveToolbarOrder(view, Array.from(root.querySelectorAll('.' + PLUGIN_ID + '-toolslot')).map((item) => item.dataset.action));
  };
}

function buildToolbar(view, root, allFiles, t) {
  const toolbar = root.createDiv({ cls:PLUGIN_ID+'-toolbar' });
  const rawButtons = [
    ...view._toolbarButtons().map((button) => ({ ...button, builtin:true })),
    ...view._customToolbarButtons.map((button) => ({ ...button, action:'custom:' + button.id, icon:button.type === 'url' ? '🌐' : '⌘', builtin:false }))
  ];
  view._toolbarOrder = normalizeToolbarOrder(view, view._toolbarOrder);
  const orderIndex = new Map(view._toolbarOrder.map((action, index) => [action, index]));
  const buttons = rawButtons.sort((a, b) => orderIndex.get(a.action) - orderIndex.get(b.action));

  buttons.forEach((button) => {
    const slot = toolbar.createDiv({ cls:PLUGIN_ID + '-toolslot' });
    slot.dataset.action = button.action;
    slot.dataset.label = button.label;
    if (!button.builtin) { slot.dataset.customId = button.id; slot.dataset.hidden = button.hidden ? 'true' : 'false'; }
    const el = slot.createEl('button', { cls:PLUGIN_ID+'-toolbtn'+(button.primary?' primary':''), attr:{type:'button'} });
    el.dataset.action = button.action;
    el.createSpan({ cls:PLUGIN_ID+'-icon', text:button.icon });
    el.createSpan({ cls:PLUGIN_ID+'-toolbtn-label', text:button.label });
    el.onclick = () => { if (!view._editMode) view._doAction(button.action, el); };

    const hidden = button.builtin ? view._hiddenToolbarActions.has(button.action) : !!button.hidden;
    const visibility = slot.createEl('button', {
      cls:PLUGIN_ID + '-toolbtn-visibility' + (hidden ? ' is-hidden' : ''),
      text:hidden ? view._t('layout.show') : view._t('layout.hide'),
      attr:{type:'button',title:hidden ? (view._lang()==='en'?'Show button':'显示按钮') : (view._lang()==='en'?'Hide button':'隐藏按钮')}
    });
    visibility.draggable = false;
    visibility.addEventListener('dragstart', (evt) => evt.preventDefault());
    visibility.onclick = async (evt) => {
      evt.preventDefault(); evt.stopPropagation();
      if (button.builtin) {
        const next = new Set(view._hiddenToolbarActions);
        if (next.has(button.action)) next.delete(button.action); else next.add(button.action);
        await view._saveHiddenToolbarActions(Array.from(next));
      } else {
        await view._saveCustomToolbarButtons(view._customToolbarButtons.map((item) => item.id === button.id ? { ...item, hidden:!item.hidden } : item));
        button.hidden = !button.hidden;
        slot.dataset.hidden = button.hidden ? 'true' : 'false';
      }
      view._applyToolbarButtonEditState(root);
    };

    let tools = null;
    if (button.builtin && isConfigurableToolbarAction(button.action)) {
      tools = slot.createDiv({ cls:PLUGIN_ID+'-custom-toolbar-tools' });
      const editConfig = createToolbarTool(tools, 'square-pen', view._lang()==='en'?'Edit button':'编辑按钮');
      editConfig.onclick = (evt) => { evt.preventDefault(); evt.stopPropagation(); openBuiltinToolbarConfigEditor(view, root, button.action); };
      createToolbarDeleteTool(view, root, tools, button);
    }
    if (button.builtin && button.action === 'pomodoro') {
      tools = slot.createDiv({ cls:PLUGIN_ID+'-custom-toolbar-tools' });
      const editConfig = createToolbarTool(tools, 'settings-2', view._lang()==='en'?'Pomodoro settings':'番茄钟设置');
      editConfig.onclick = (evt) => { evt.preventDefault(); evt.stopPropagation(); openPomodoroToolbarConfigEditor(view, root); };
    }
    if (!button.builtin) {
      tools = slot.createDiv({ cls:PLUGIN_ID+'-custom-toolbar-tools' });
      const edit = createToolbarTool(tools, 'square-pen', view._lang()==='en'?'Edit custom button':'编辑自定义按钮');
      edit.onclick = (evt) => { evt.preventDefault(); evt.stopPropagation(); openCustomToolbarButtonEditor(view, root, button); };
      createToolbarDeleteTool(view, root, tools, button);
    }
    attachToolbarDrag(view, toolbar, slot);
  });

  const add = toolbar.createEl('button', { cls:PLUGIN_ID+'-custom-toolbar-add', attr:{type:'button'} });
  obs.setIcon(add.createSpan(), 'plus'); add.createSpan({ text:view._lang()==='en'?'Custom button':'自定义按钮' });
  add.onclick = () => openCustomToolbarButtonEditor(view, root);
  const logs = toolbar.createEl('button', { cls:PLUGIN_ID+'-custom-toolbar-logs', attr:{type:'button'} });
  obs.setIcon(logs.createSpan(), 'scroll-text'); logs.createSpan({ text:view._lang()==='en'?'Run logs':'运行日志' });
  logs.onclick = () => openCustomToolbarLogs(view);

  view._applyToolbarButtonEditState(root);
  const toggleSearch = buildSearch(root, toolbar, allFiles, view.app, { placeholder:t('search.placeholder'), language:view._lang() }, view);
  return { toolbar, toggleSearch };
}
