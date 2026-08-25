// scenes.js — 情景模式选择与管理

function buildSceneSwitcher(view, parent) {
  const wrap = parent.createDiv({ cls: PLUGIN_ID + '-scene-switcher' });
  const trigger = wrap.createEl('button', { cls: PLUGIN_ID + '-scene-trigger', attr: { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' } });
  const icon = trigger.createSpan({ cls: PLUGIN_ID + '-scene-icon' });
  obsidian.setIcon(icon, 'layers-3');
  const label = trigger.createSpan({ cls: PLUGIN_ID + '-scene-label' });
  trigger.createSpan({ cls: PLUGIN_ID + '-scene-chevron', text: '⌄' });
  let menu = null;

  const close = () => {
    if (!menu) return;
    menu.remove(); menu = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
  };
  const onOutside = (evt) => { if (!wrap.contains(evt.target)) close(); };
  const refresh = () => {
    const scene = view._getActiveScene();
    label.textContent = view._sceneLabel(scene);
    trigger.title = view._lang() === 'en' ? 'Switch layout scene' : '切换情景布局';
    icon.empty();
    obsidian.setIcon(icon, 'layers-3');
  };
  const open = () => {
    if (menu) { close(); return; }
    menu = wrap.createDiv({ cls: PLUGIN_ID + '-scene-menu', attr: { role: 'menu' } });
    menu.createDiv({ cls:PLUGIN_ID + '-scene-menu-caption', text:view._lang() === 'en' ? 'LAYOUT SCENES' : '布局情景' });
    const sceneList = menu.createDiv({ cls:PLUGIN_ID + '-scene-menu-list' });
    view._sceneList().forEach((scene) => {
      const item = sceneList.createEl('button', { cls: PLUGIN_ID + '-scene-menu-item' + (scene.id === view._activeSceneId ? ' active' : ''), attr: { type: 'button', role: 'menuitem' } });
      item.createSpan({ cls: PLUGIN_ID + '-scene-menu-icon', text: scene.icon || '◈' });
      item.createSpan({ cls: PLUGIN_ID + '-scene-menu-name', text: view._sceneLabel(scene) });
      if (scene.id === view._activeSceneId) item.createSpan({ cls: PLUGIN_ID + '-scene-menu-check', text: '✓' });
      item.onclick = async () => { close(); await view._switchScene(scene.id); };
    });
    menu.createDiv({ cls: PLUGIN_ID + '-scene-menu-divider' });
    menu.createDiv({ cls:PLUGIN_ID + '-scene-menu-caption', text:view._lang() === 'en' ? 'MANAGE' : '管理' });
    const actions = menu.createDiv({ cls:PLUGIN_ID + '-scene-menu-actions' });
    const createAction = (iconName, text, extraClass = '') => {
      const button = actions.createEl('button', { cls:PLUGIN_ID + '-scene-menu-action' + (extraClass ? ' ' + extraClass : ''), attr:{ type:'button' } });
      const iconEl = button.createSpan({ cls:PLUGIN_ID + '-scene-menu-action-icon' });
      obsidian.setIcon(iconEl, iconName);
      button.createSpan({ cls:PLUGIN_ID + '-scene-menu-action-label', text });
      return button;
    };
    const create = createAction('plus', view._lang() === 'en' ? 'New scene' : '新建情景');
    create.onclick = async () => { close(); await view._createScene(); };
    const edit = createAction(view._editMode ? 'check' : 'panels-top-left', view._editMode ? (view._lang() === 'en' ? 'Finish editing' : '完成布局编辑') : (view._lang() === 'en' ? 'Edit current layout' : '编辑当前布局'));
    edit.onclick = () => { close(); view._toggleLayoutEdit(); };
    const automate = createAction('calendar-clock', view._lang() === 'en' ? 'Automatic schedule' : '自动切换规则');
    automate.onclick = () => { close(); new CockpitSceneScheduleModal(view.app, view).open(); };
    if (view._activeSceneId !== 'default') {
      const remove = createAction('trash-2', view._lang() === 'en' ? 'Delete current scene' : '删除当前情景', 'danger');
      remove.onclick = async () => { close(); await view._deleteActiveScene(); };
    }
    trigger.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0);
  };
  trigger.onclick = (evt) => { evt.preventDefault(); evt.stopPropagation(); open(); };
  view._sceneSwitcherRefresh = refresh;
  refresh();
}

class CockpitSceneNameModal extends obsidian.Modal {
  constructor(app, view) { super(app); this.view = view; }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass(PLUGIN_ID + '-scene-name-modal');
    const heading = contentEl.createEl('h2', { text:this.view._lang() === 'en' ? 'New layout scene' : '新建情景' });
    this._dragCleanup = makeCockpitModalDraggable(this, heading, this.view._lang() === 'en' ? 'Drag scene dialog' : '拖动情景窗口');
    contentEl.createDiv({ cls:PLUGIN_ID + '-scene-name-help', text:this.view._lang() === 'en' ? 'Copies the current layout. You can edit it afterwards.' : '将复制当前布局，保存后可继续编辑。' });
    const input = contentEl.createEl('input', { cls:PLUGIN_ID + '-scene-name-input', attr:{ type:'text', maxlength:'24', placeholder:this.view._lang() === 'en' ? 'e.g. Focus' : '例如：专注工作' } });
    const actions = contentEl.createDiv({ cls:PLUGIN_ID + '-scene-name-actions' });
    const cancel = actions.createEl('button', { text:this.view._lang() === 'en' ? 'Cancel' : '取消' });
    const save = actions.createEl('button', { cls:'mod-cta', text:this.view._lang() === 'en' ? 'Create' : '创建' });
    const submit = async () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      await this.view._createScene(name);
      this.close();
    };
    cancel.onclick = () => this.close();
    save.onclick = submit;
    input.addEventListener('keydown', (evt) => { if (evt.key === 'Enter') submit(); if (evt.key === 'Escape') this.close(); });
    setTimeout(() => input.focus(), 40);
  }
  onClose() { this._dragCleanup?.(); this._dragCleanup = null; this.contentEl.empty(); }
}

class CockpitSceneScheduleModal extends obsidian.Modal {
  constructor(app, view) { super(app); this.view = view; }
  onOpen() {
    const en = this.view._lang() === 'en'; const { contentEl } = this;
    const scene = this.view._getActiveScene(); const rule = scene?.autoRule || {};
    contentEl.addClass(PLUGIN_ID + '-scene-name-modal');
    const heading = contentEl.createEl('h2', { text:en ? 'Automatic scene schedule' : '情景自动切换规则' });
    this._dragCleanup = makeCockpitModalDraggable(this, heading, en ? 'Drag scene schedule dialog' : '拖动情景规则窗口');
    contentEl.createDiv({ cls:PLUGIN_ID + '-scene-name-help', text:en ? 'This scene is selected when the current time is in its rule. Manual switching always remains available.' : '当前时间命中规则时自动切换到此情景；仍可随时手动切换。' });
    const enabledLabel = contentEl.createEl('label'); const enabled = enabledLabel.createEl('input', { attr:{ type:'checkbox' } }); enabled.checked = rule.enabled === true; enabledLabel.createSpan({ text:en ? ' Enable automatic switching' : ' 启用自动切换' });
    const row = contentEl.createDiv({ cls:PLUGIN_ID + '-scene-schedule-row' });
    const start = row.createEl('input', { attr:{ type:'time', 'aria-label':en ? 'Start time' : '开始时间' } }); start.value = /^\d{2}:\d{2}$/.test(rule.start || '') ? rule.start : '09:00';
    row.createSpan({ text:'–' });
    const end = row.createEl('input', { attr:{ type:'time', 'aria-label':en ? 'End time' : '结束时间' } }); end.value = /^\d{2}:\d{2}$/.test(rule.end || '') ? rule.end : '18:00';
    const days = contentEl.createDiv({ cls:PLUGIN_ID + '-scene-schedule-days' });
    const labels = en ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : ['日','一','二','三','四','五','六'];
    const selected = new Set(Array.isArray(rule.days) && rule.days.length ? rule.days : [1,2,3,4,5]); const boxes = [];
    labels.forEach((label, day) => { const item = days.createEl('label'); const box = item.createEl('input', { attr:{ type:'checkbox' } }); box.checked = selected.has(day); item.createSpan({ text:label }); boxes.push(box); });
    const presets = contentEl.createDiv({ cls:PLUGIN_ID + '-scene-schedule-presets' });
    const applyDays = (values) => boxes.forEach((box, day) => { box.checked = values.includes(day); });
    const workdays = presets.createEl('button',{text:en?'Workdays':'工作日',attr:{type:'button'}});workdays.onclick=()=>applyDays([1,2,3,4,5]);
    const weekend = presets.createEl('button',{text:en?'Weekend':'周末',attr:{type:'button'}});weekend.onclick=()=>applyDays([0,6]);
    const allDays = presets.createEl('button',{text:en?'Every day':'每天',attr:{type:'button'}});allDays.onclick=()=>applyDays([0,1,2,3,4,5,6]);
    const folderLabel = contentEl.createEl('label', { cls:PLUGIN_ID + '-scene-schedule-folder' });
    folderLabel.createSpan({ text:en ? 'Only while the active file is under this folder (optional)' : '仅在当前文件位于此文件夹时触发（可选）' });
    const folder = folderLabel.createEl('input',{attr:{type:'text',placeholder:en?'e.g. Projects/Work':'例如：Projects/工作'}});folder.value=rule.folder||'';
    const actions = contentEl.createDiv({ cls:PLUGIN_ID + '-scene-name-actions' });
    const cancel = actions.createEl('button', { text:en ? 'Cancel' : '取消' }); const save = actions.createEl('button', { cls:'mod-cta', text:en ? 'Save rule' : '保存规则' });
    cancel.onclick = () => this.close(); save.onclick = async () => { await this.view._setSceneAutoRule(scene.id, { enabled:enabled.checked, start:start.value, end:end.value, days:boxes.map((box, day) => box.checked ? day : -1).filter((day) => day >= 0), folder:folder.value }); this.close(); };
  }
  onClose() { this._dragCleanup?.(); this._dragCleanup = null; this.contentEl.empty(); }
}
