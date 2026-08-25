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
    view._sceneList().forEach((scene) => {
      const item = menu.createEl('button', { cls: PLUGIN_ID + '-scene-menu-item' + (scene.id === view._activeSceneId ? ' active' : ''), attr: { type: 'button', role: 'menuitem' } });
      item.createSpan({ cls: PLUGIN_ID + '-scene-menu-icon', text: scene.icon || '◈' });
      item.createSpan({ cls: PLUGIN_ID + '-scene-menu-name', text: view._sceneLabel(scene) });
      if (scene.id === view._activeSceneId) item.createSpan({ cls: PLUGIN_ID + '-scene-menu-check', text: '✓' });
      item.onclick = async () => { close(); await view._switchScene(scene.id); };
    });
    const divider = menu.createDiv({ cls: PLUGIN_ID + '-scene-menu-divider' });
    const create = menu.createEl('button', { cls: PLUGIN_ID + '-scene-menu-action', text: view._lang() === 'en' ? '+ New scene…' : '+ 新建情景…', attr: { type: 'button' } });
    create.onclick = async () => { close(); await view._createScene(); };
    const edit = menu.createEl('button', { cls: PLUGIN_ID + '-scene-menu-action', text: view._editMode ? (view._lang() === 'en' ? '✓ Finish editing' : '✓ 完成布局编辑') : (view._lang() === 'en' ? 'Edit current layout' : '编辑当前布局'), attr: { type: 'button' } });
    edit.onclick = () => { close(); view._toggleLayoutEdit(); };
    if (view._activeSceneId !== 'default') {
      const remove = menu.createEl('button', { cls: PLUGIN_ID + '-scene-menu-action danger', text: view._lang() === 'en' ? 'Delete current scene' : '删除当前情景', attr: { type: 'button' } });
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
    contentEl.createEl('h2', { text:this.view._lang() === 'en' ? 'New layout scene' : '新建情景' });
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
  onClose() { this.contentEl.empty(); }
}
