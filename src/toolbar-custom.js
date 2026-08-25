// toolbar-custom.js — 用户自定义 Toolbar 按钮的数据校验、编辑器与执行器

const CUSTOM_TOOLBAR_TYPES = new Set(['url', 'script']);
const CUSTOM_TOOLBAR_RUN_MODES = new Set(['background', 'terminal']);
const CUSTOM_TOOLBAR_LOG_LIMIT = 100;

function normalizeCustomToolbarButtons(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 24).map((item) => {
    const id = String(item?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
    const label = String(item?.label || '').trim().slice(0, 24);
    const type = CUSTOM_TOOLBAR_TYPES.has(item?.type) ? item.type : 'url';
    const value = String(item?.value || '').trim().slice(0, 8000);
    if (!id || seen.has(id) || !label || !value) return null;
    seen.add(id);
    const runMode = CUSTOM_TOOLBAR_RUN_MODES.has(item?.runMode) ? item.runMode : 'background';
    return { id, label, type, value, hidden: !!item?.hidden, runMode };
  }).filter(Boolean);
}

function validateCustomToolbarDraft(draft, lang) {
  const en = lang === 'en';
  const label = String(draft.label || '').trim();
  const value = String(draft.value || '').trim();
  if (!label) return en ? 'Enter a button label.' : '请输入按钮文字。';
  if (label.length > 24) return en ? 'Keep the label within 24 characters.' : '按钮文字不能超过 24 个字符。';
  if (!value) return en ? 'Enter a URL or script.' : '请输入网址或脚本。';
  if (value.length > 8000) return en ? 'Script content is too long.' : '脚本内容不能超过 8000 个字符。';
  if (draft.type === 'url') {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch (e) {
      return en ? 'Only valid http/https URLs are supported.' : '仅支持有效的 http/https 网址。';
    }
  }
  return null;
}

async function executeCustomToolbarButton(view, button) {
  if (!button) return;
  if (button.type === 'url') {
    const error = validateCustomToolbarDraft(button, view._lang());
    if (error) { new obsidian.Notice(error); return; }
    try {
      require('electron').shell.openExternal(button.value);
    } catch (e) {
      new obsidian.Notice(view._lang() === 'en' ? 'Could not open this URL.' : '无法打开该网址。');
    }
    return;
  }
  if (button.type !== 'script') return;
  const startedAt = Date.now();
  if (button.runMode === 'terminal') {
    try {
      const target = 'macos-terminal';
      await view._launchInSystemTerminal(button.value);
      await appendCustomToolbarLog(view, { label:button.label, status:'launched-in-terminal', ok:true, durationMs:Date.now()-startedAt, exitCode:'n/a', stdout:target, stderr:'' });
      new obsidian.Notice((view._lang() === 'en' ? 'Opened in terminal: ' : '已在终端运行：') + button.label);
    } catch (e) {
      await appendCustomToolbarLog(view, { label:button.label, status:'launch-failed', ok:false, durationMs:Date.now()-startedAt, exitCode:'unknown', stdout:'', stderr:e?.message || String(e) });
      new obsidian.Notice(view._lang() === 'en' ? 'Could not open a terminal.' : '无法打开终端。');
    }
    return;
  }
  try {
    const { execFile } = require('child_process');
    const cwd = view.app.vault.adapter.getBasePath();
    new obsidian.Notice((view._lang() === 'en' ? 'Running: ' : '正在运行：') + button.label);
    execFile('/bin/zsh', ['-lc', button.value], {
      cwd,
      timeout: 300000,
      maxBuffer: 1024 * 1024
    }, async (error, stdout, stderr) => {
      const ttyError = /stdin is not a terminal|not a tty|inappropriate ioctl/i.test(String(stderr || '') + ' ' + String(error?.message || ''));
      await appendCustomToolbarLog(view, {
        label: button.label,
        status: error ? 'failed' : 'success',
        ok: !error,
        durationMs: Date.now() - startedAt,
        exitCode: typeof error?.code === 'number' ? error.code : (error ? 'unknown' : 0),
        stdout,
        stderr: stderr || (error?.message || '')
      });
      if (error) {
        console.warn('[Cockpit custom toolbar]', button.label, error);
        new obsidian.Notice(ttyError
          ? (view._lang() === 'en' ? 'This command needs a terminal. Change its run mode to Terminal.' : '该命令需要交互终端，请把运行方式改为“终端运行”。')
          : ((view._lang() === 'en' ? 'Script failed: ' : '脚本执行失败：') + button.label));
        return;
      }
      new obsidian.Notice((view._lang() === 'en' ? 'Script finished: ' : '脚本执行完成：') + button.label);
    });
  } catch (e) {
    console.warn('[Cockpit custom toolbar]', button.label, e);
    new obsidian.Notice(view._lang() === 'en' ? 'Could not start this script.' : '无法启动该脚本。');
  }
}

function sanitizeToolbarLogOutput(value) {
  const text = String(value || '').trim();
  if (!text) return '(empty)';
  return text.length > 6000 ? text.slice(0, 6000) + '\n… (truncated)' : text;
}

async function appendCustomToolbarLog(view, entry) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(view.app.vault.adapter.getBasePath(), view.app.vault.configDir, 'plugins', PLUGIN_ID, 'logs');
    const file = path.join(dir, 'toolbar-runs.jsonl');
    fs.mkdirSync(dir, { recursive:true });
    let rows = [];
    try { rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch (e) {}
    rows.push(JSON.stringify({
      timestamp:new Date().toISOString(), label:String(entry.label || '').slice(0, 80),
      status:entry.status || (entry.ok ? 'success' : 'failed'), exitCode:entry.exitCode,
      durationMs:entry.durationMs, stdout:sanitizeToolbarLogOutput(entry.stdout), stderr:sanitizeToolbarLogOutput(entry.stderr)
    }));
    rows = rows.slice(-CUSTOM_TOOLBAR_LOG_LIMIT);
    while (Buffer.byteLength(rows.join('\n'), 'utf8') > 1024 * 1024 && rows.length > 1) rows.shift();
    fs.writeFileSync(file, rows.join('\n') + '\n', 'utf8');
  } catch (e) {
    console.warn('[Cockpit toolbar log]', e);
  }
}

async function openCustomToolbarLogs(view) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(view.app.vault.adapter.getBasePath(), view.app.vault.configDir, 'plugins', PLUGIN_ID, 'logs');
    const file = path.join(dir, 'toolbar-runs.jsonl');
    let entries = [];
    try { entries = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)).reverse(); } catch (e) {}
    const overlay = document.createElement('div');
    overlay.className = PLUGIN_ID + '-toolbar-log-backdrop';
    const panel = overlay.createDiv({ cls:PLUGIN_ID + '-toolbar-log-viewer' });
    overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
    const head = panel.createDiv({ cls:PLUGIN_ID + '-toolbar-log-head' });
    head.createDiv({ cls:PLUGIN_ID + '-toolbar-log-title', text:view._lang()==='en'?'Toolbar run logs':'Toolbar 运行日志' });
    const controls = head.createDiv({ cls:PLUGIN_ID + '-toolbar-log-controls' });
    const clear = controls.createEl('button', { text:view._lang()==='en'?'Clear':'清空', attr:{type:'button'} });
    const close = controls.createEl('button', { attr:{type:'button'} }); obsidian.setIcon(close, 'x'); close.onclick = () => overlay.remove();
    clear.onclick = () => {
      if (!window.confirm(view._lang()==='en'?'Clear all Toolbar logs?':'清空所有 Toolbar 运行日志？')) return;
      try { fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(file,'','utf8'); } catch (e) {}
      overlay.remove(); openCustomToolbarLogs(view);
    };
    const list = panel.createDiv({ cls:PLUGIN_ID + '-toolbar-log-list' });
    if (!entries.length) list.createDiv({ cls:PLUGIN_ID + '-toolbar-log-empty', text:view._lang()==='en'?'No run logs yet.':'暂无运行日志。' });
    entries.forEach((entry) => {
      const card = list.createDiv({ cls:PLUGIN_ID + '-toolbar-log-card ' + (entry.status === 'success' || entry.status === 'launched-in-terminal' ? 'success' : 'failed') });
      card.createDiv({ cls:PLUGIN_ID + '-toolbar-log-card-title', text:entry.label + ' · ' + entry.status });
      card.createDiv({ cls:PLUGIN_ID + '-toolbar-log-meta', text:window.moment(entry.timestamp).format('YYYY-MM-DD HH:mm:ss') + ' · exit ' + entry.exitCode + ' · ' + entry.durationMs + ' ms' });
      if (entry.stdout && entry.stdout !== '(empty)') card.createEl('pre', { text:'stdout\n' + entry.stdout });
      if (entry.stderr && entry.stderr !== '(empty)') card.createEl('pre', { text:'stderr\n' + entry.stderr });
    });
    document.body.appendChild(overlay);
  } catch (e) {
    new obsidian.Notice(view._lang() === 'en' ? 'Could not open Toolbar logs.' : '无法打开 Toolbar 运行日志。');
  }
}

function openCustomToolbarButtonEditor(view, root, existing) {
  const en = view._lang() === 'en';
  const PID = PLUGIN_ID;
  const draft = {
    label: existing?.label || '',
    type: existing?.type || 'url',
    value: existing?.value || '',
    hidden: !!existing?.hidden,
    runMode: existing?.runMode || 'background'
  };
  const overlay = document.createElement('div');
  overlay.className = PID + '-custom-toolbar-backdrop';
  const panel = overlay.createDiv({ cls: PID + '-custom-toolbar-editor' });
  overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
  panel.onclick = (evt) => evt.stopPropagation();

  const head = panel.createDiv({ cls: PID + '-custom-toolbar-head' });
  head.createDiv({ cls: PID + '-custom-toolbar-title', text: existing ? (en ? 'Edit custom button' : '编辑自定义按钮') : (en ? 'Add custom button' : '添加自定义按钮') });
  const close = head.createEl('button', { cls: PID + '-custom-toolbar-close', attr: { type:'button', title: en ? 'Close' : '关闭' } });
  obsidian.setIcon(close, 'x');
  close.onclick = () => overlay.remove();

  const field = (label) => {
    const wrap = panel.createDiv({ cls: PID + '-custom-toolbar-field' });
    wrap.createDiv({ cls: PID + '-custom-toolbar-label', text: label });
    return wrap;
  };
  const labelInput = field(en ? 'Button label' : '按钮文字').createEl('input', {
    cls: PID + '-custom-toolbar-input', attr: { type:'text', maxlength:'24', placeholder: en ? 'e.g. Project site' : '例如：项目网站' }
  });
  labelInput.value = draft.label;
  const typeSelect = field(en ? 'Action type' : '按钮类型').createEl('select', { cls: PID + '-custom-toolbar-select' });
  typeSelect.createEl('option', { text: en ? 'Open URL' : '打开网址', attr: { value:'url' } });
  typeSelect.createEl('option', { text: en ? 'Run shell script' : '运行 Shell 脚本', attr: { value:'script' } });
  typeSelect.value = draft.type;
  const valueField = field(en ? 'URL or script' : '网址或脚本');
  const valueInput = valueField.createEl('textarea', { cls: PID + '-custom-toolbar-textarea', attr: { rows:'7', maxlength:'8000' } });
  valueInput.value = draft.value;
  const hint = valueField.createDiv({ cls: PID + '-custom-toolbar-hint' });
  const modeField = field(en ? 'Run mode' : '运行方式');
  const modeSelect = modeField.createEl('select', { cls:PID + '-custom-toolbar-select' });
  modeSelect.createEl('option', { text:en?'Background (captures logs)':'后台运行（可记录输出）', attr:{value:'background'} });
  modeSelect.createEl('option', { text:en?'Terminal (interactive CLI/TUI)':'终端运行（交互式 CLI/TUI）', attr:{value:'terminal'} });
  modeSelect.value = draft.runMode;
  const consentWrap = panel.createEl('label', { cls: PID + '-custom-toolbar-consent' });
  const consent = consentWrap.createEl('input', { attr: { type:'checkbox' } });
  consentWrap.createSpan({ text: en ? 'I understand this script runs with my local user permissions.' : '我明白该脚本会以当前本机用户权限运行。' });
  const errorEl = panel.createDiv({ cls: PID + '-custom-toolbar-error' });
  const updateType = () => {
    const script = typeSelect.value === 'script';
    valueInput.placeholder = script ? (en ? 'Shell commands executed by /bin/zsh' : '由 /bin/zsh 执行的 Shell 命令') : 'https://example.com';
    hint.textContent = script
      ? (en ? 'Runs from the Vault folder. Saved as plain text; do not include passwords or tokens.' : '脚本从 Vault 目录运行并以明文保存，请勿写入密码或令牌。')
      : (en ? 'Only http/https URLs are accepted.' : '仅允许 http/https 网址。');
    consentWrap.style.display = script ? 'flex' : 'none';
    modeField.style.display = script ? 'flex' : 'none';
  };
  typeSelect.onchange = updateType;
  updateType();

  const footer = panel.createDiv({ cls: PID + '-custom-toolbar-footer' });
  if (existing) {
    const remove = footer.createEl('button', { cls:PID + '-custom-toolbar-secondary danger', text:en?'Delete button':'删除按钮', attr:{type:'button'} });
    remove.onclick = async () => {
      if (!window.confirm(en?'Delete this custom button?':'确定删除这个自定义按钮吗？')) return;
      await view._saveCustomToolbarButtons(view._customToolbarButtons.filter((button) => button.id !== existing.id));
      overlay.remove();
      await view._renderDashboard(false);
    };
  }
  const cancel = footer.createEl('button', { cls: PID + '-custom-toolbar-secondary', text: en ? 'Cancel' : '取消', attr: { type:'button' } });
  cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls: PID + '-custom-toolbar-primary', text: en ? 'Save button' : '保存按钮', attr: { type:'button' } });
  save.onclick = async () => {
    const next = { label: labelInput.value, type: typeSelect.value, value: valueInput.value, hidden: !!existing?.hidden, runMode: modeSelect.value };
    const error = validateCustomToolbarDraft(next, view._lang());
    if (error) { errorEl.textContent = error; return; }
    if (next.type === 'script' && !consent.checked) {
      errorEl.textContent = en ? 'Confirm the local-script permission warning first.' : '请先确认本机脚本权限提示。';
      return;
    }
    const id = existing?.id || ('custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7));
    const buttons = view._customToolbarButtons.filter((button) => button.id !== id);
    const normalized = normalizeCustomToolbarButtons([...buttons, { id, ...next }]);
    await view._saveCustomToolbarButtons(normalized);
    overlay.remove();
    await view._renderDashboard(false);
  };
  panel.addEventListener('keydown', (evt) => { if (evt.key === 'Escape') overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(() => labelInput.focus(), 20);
}
