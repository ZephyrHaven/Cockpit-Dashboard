// toolbar-config.js — 可配置内置 Toolbar 按钮的编辑器

const BUILTIN_TOOLBAR_CONFIG = {
  hermes: { section:'Hermes', titleCn:'编辑 Hermes 配置', titleEn:'Edit Hermes configuration', hasUrl:false },
  'cockpit-h5': { section:'驾驶舱', titleCn:'编辑驾驶舱配置', titleEn:'Edit Cockpit configuration', hasUrl:true },
  'work-log': { section:'工作日志', titleCn:'编辑工作日志配置', titleEn:'Edit work-log configuration', hasUrl:false }
};

function isConfigurableToolbarAction(action) { return !!BUILTIN_TOOLBAR_CONFIG[action]; }

function openPomodoroToolbarConfigEditor(view, root, options = {}) {
  const en = view._lang() === 'en';
  const overlay = document.createElement('div');
  overlay.className = PLUGIN_ID + '-custom-toolbar-backdrop';
  const panel = overlay.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-editor' });
  overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
  panel.onclick = (evt) => evt.stopPropagation();
  const head = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-head' });
  head.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-title', text:en ? 'Pomodoro settings' : '番茄钟设置' });
  const close = head.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-close', attr:{type:'button'} });
  obs.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  makeCockpitDialogDraggable(panel, head, { label:en ? 'Drag Pomodoro settings' : '拖动番茄钟设置窗口' });
  const field = panel.createEl('label', { cls:PLUGIN_ID + '-custom-toolbar-consent' });
  const autoShow = field.createEl('input', { attr:{type:'checkbox'} });
  autoShow.checked = view._pomodoroAutoShow !== false;
  field.createSpan({ text:en ? 'Automatically show Pomodoro when Cockpit opens.' : '打开驾驶舱时自动显示番茄钟' });
  panel.createDiv({ cls:PLUGIN_ID + '-toolbar-config-warning', text:en ? 'Turning this off never stops a running or paused timer. It will still be restored after a refresh until you reset or close it.' : '关闭后不会中断正在运行或暂停中的番茄钟；在重置或关闭前，刷新后仍会恢复。' });
  const footer = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-footer' });
  const cancel = footer.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-secondary', text:en?'Cancel':'取消', attr:{type:'button'} });
  cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-primary', text:en?'Save':'保存', attr:{type:'button'} });
  save.onclick = async () => { await view._setPomodoroAutoShow(autoShow.checked); overlay.remove(); options.onChanged?.('saved'); new obs.Notice(en?'Pomodoro settings saved.':'番茄钟设置已保存。'); };
  panel.addEventListener('keydown', (evt) => { if (evt.key === 'Escape') overlay.remove(); });
  document.body.appendChild(overlay);
}

function validateBuiltinToolbarConfig(command, url, spec, lang) {
  const en = lang === 'en';
  if (!String(command || '').trim()) return en ? 'Command cannot be empty.' : '命令不能为空。';
  if (String(command).length > 8000) return en ? 'Command is too long.' : '命令不能超过 8000 个字符。';
  if (spec.hasUrl && String(url || '').trim()) {
    try {
      const parsed = new URL(String(url).trim());
      if (!['http:','https:'].includes(parsed.protocol)) throw new Error('protocol');
    } catch (e) { return en ? 'Only valid http/https URLs are supported.' : '仅支持有效的 http/https 网址。'; }
  }
  return null;
}

function openBuiltinToolbarConfigEditor(view, root, action, options = {}) {
  if (view._isMobile && view._isMobile()) {
    new obs.Notice(view._lang() === 'en' ? 'This configuration is only available on desktop.' : '此配置仅在桌面端可用。');
    return;
  }
  const spec = BUILTIN_TOOLBAR_CONFIG[action];
  if (!spec) return;
  const en = view._lang() === 'en';
  const current = view._toolbarCmds[spec.section] || {};
  const fallbackLabel = view._toolbarButtons().find((button) => button.action === action)?.label || spec.section;
  const overlay = document.createElement('div');
  overlay.className = PLUGIN_ID + '-custom-toolbar-backdrop';
  const panel = overlay.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-editor' });
  overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
  panel.onclick = (evt) => evt.stopPropagation();
  const head = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-head' });
  head.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-title', text:en?spec.titleEn:spec.titleCn });
  const close = head.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-close', attr:{type:'button'} });
  obs.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  makeCockpitDialogDraggable(panel, head, { label:en ? 'Drag toolbar settings' : '拖动工具栏设置窗口' });
  panel.createDiv({ cls:PLUGIN_ID + '-toolbar-config-warning', text:en?'This command runs with your local user permissions and is stored as plain text. Do not include passwords or tokens.':'该命令会以当前本机用户权限运行并以明文保存，请勿写入密码或令牌。' });
  const labelField = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-field' });
  labelField.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-label', text:en?'Button label':'按钮名称' });
  const labelInput = labelField.createEl('input', { cls:PLUGIN_ID + '-custom-toolbar-input', attr:{type:'text',maxlength:'24'} });
  labelInput.value = current.label || fallbackLabel;
  const commandField = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-field' });
  commandField.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-label', text:en?'Command':'运行命令' });
  const commandInput = commandField.createEl('textarea', { cls:PLUGIN_ID + '-custom-toolbar-textarea', attr:{rows:'7',maxlength:'8000'} });
  commandInput.value = current.command || '';
  let urlInput = null;
  if (spec.hasUrl) {
    const urlField = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-field' });
    urlField.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-label', text:en?'Target URL':'目标网址' });
    urlInput = urlField.createEl('input', { cls:PLUGIN_ID + '-custom-toolbar-input', attr:{type:'url',placeholder:DEFAULT_COCKPIT_URL} });
    urlInput.value = current.url || '';
  }
  const consentWrap = panel.createEl('label', { cls:PLUGIN_ID + '-custom-toolbar-consent' });
  const consent = consentWrap.createEl('input', { attr:{type:'checkbox'} });
  consentWrap.createSpan({ text:en?'I understand and trust this command.':'我理解并信任这条命令。' });
  const errorEl = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-error' });
  const footer = panel.createDiv({ cls:PLUGIN_ID + '-custom-toolbar-footer' });
  const cancel = footer.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-secondary', text:en?'Cancel':'取消', attr:{type:'button'} }); cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls:PLUGIN_ID + '-custom-toolbar-primary', text:en?'Save configuration':'保存配置', attr:{type:'button'} });
  save.onclick = async () => {
    const command = commandInput.value.trim();
    const label = labelInput.value.trim();
    const url = urlInput ? urlInput.value.trim() : '';
    if (!label) { errorEl.textContent = en?'Button label cannot be empty.':'按钮名称不能为空。'; return; }
    const error = validateBuiltinToolbarConfig(command, url, spec, view._lang());
    if (error) { errorEl.textContent = error; return; }
    if (!consent.checked) { errorEl.textContent = en?'Confirm that you trust this command first.':'请先确认你信任这条命令。'; return; }
    const commands = { ...view._toolbarCmds, [spec.section]:{ ...current, label, command } };
    if (spec.hasUrl) commands[spec.section].url = url;
    await view._storage.saveToolbarCommands(commands);
    view._toolbarCmds = commands;
    overlay.remove();
    new obs.Notice(en?'Toolbar configuration saved.':'Toolbar 配置已保存。');
    refreshToolbar(view, root);
    options.onChanged?.('saved');
  };
  panel.addEventListener('keydown', (evt) => { if (evt.key === 'Escape') overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => commandInput.focus(), 20);
}
