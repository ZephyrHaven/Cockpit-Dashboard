// weekly-report.js — 周报工坊：记录制的周报生成模块。
// 每条记录 = 一份独立周报配置（名称/解释器/脚本/台账 xlsx/库内目录/周期起始日/系统清单），
// 学定时任务模块的「列表 + 新增 + 编辑」形态：新增一条就是一条记录，互不干扰，支持多台账并存。
// 插件不预置任何解释器/脚本/路径，全部由用户在记录编辑器里自行配置，保存在 data.json（weeklyReport.records）。
// 定时自动化复用「定时任务」的应用命令体系：按记录与系统动态注册命令，可分系统、分周期单独建任务。

const WEEKLY_REPORT_CONFIG_KEY = 'weeklyReport';
const WEEKLY_REPORT_RECORD_LIMIT = 20;

function weeklyReportId() {
  try { return 'wr-' + globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16); } catch (e) {}
  return 'wr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function normalizeWeeklyReportRecord(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const systems = (Array.isArray(source.systems) ? source.systems : [])
    .map((item) => String(item || '').trim()).filter(Boolean).slice(0, 32);
  const folder = String(source.vaultFolder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').slice(0, 200);
  const weekStartDayRaw = source.weekStartDay;
  const weekStartDayNumber = Number(weekStartDayRaw);
  return {
    id: String(source.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40),
    name: String(source.name || '').trim().slice(0, 60),
    pythonPath: String(source.pythonPath || '').trim().slice(0, 300),
    scriptPath: String(source.scriptPath || '').trim().slice(0, 500),
    // 台账 xlsx 路径：可选。留空 = 用脚本自己的 config.json；填了 = 调用时传 --xlsx 覆盖。
    xlsxPath: String(source.xlsxPath || '').trim().slice(0, 500),
    // 不做任何默认值填充：未配置就是空，生成前会明确提示补配置
    vaultFolder: folder,
    systems,
    // 周期起始日：''=未设置；0=周一 … 6=周日，须与脚本 config.week_start_day 一致
    weekStartDay: (weekStartDayRaw === '' || weekStartDayRaw == null)
      ? ''
      : (Number.isFinite(weekStartDayNumber) ? Math.max(0, Math.min(6, Math.round(weekStartDayNumber))) : '')
  };
}

function normalizeWeeklyReportConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const records = (Array.isArray(source.records) ? source.records : [])
    .slice(0, WEEKLY_REPORT_RECORD_LIMIT)
    .map(normalizeWeeklyReportRecord)
    .filter((record) => record.id && record.name);
  return { records };
}

async function readWeeklyReportConfig(plugin) {
  try {
    const data = (await plugin.loadData()) || {};
    return normalizeWeeklyReportConfig(data[WEEKLY_REPORT_CONFIG_KEY]);
  } catch (e) {
    console.warn('[Cockpit weekly report] 读取配置失败', e);
    return normalizeWeeklyReportConfig(null);
  }
}

async function writeWeeklyReportRecords(plugin, records) {
  await plugin.mutateData((data) => {
    data[WEEKLY_REPORT_CONFIG_KEY] = { records: normalizeWeeklyReportConfig({ records }).records };
  });
}

function weeklyReportCopyText(view, text) {
  const done = () => new obs.Notice(view._lang() === 'en' ? 'Copied to clipboard.' : '已复制到剪贴板。');
  try {
    if (navigator?.clipboard?.writeText) { navigator.clipboard.writeText(text).then(done).catch(() => weeklyReportCopyFallback(view, text, done)); return; }
  } catch (e) { /* 走降级方案 */ }
  weeklyReportCopyFallback(view, text, done);
}

function weeklyReportCopyFallback(view, text, done) {
  try {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', 'readonly');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
    done();
  } catch (e) {
    new obs.Notice(view._lang() === 'en' ? 'Copy failed. Please copy manually.' : '复制失败，请手动复制。');
  }
}

// 生成周报：execFile 参数数组调用，不经 shell，避免空格/中文引号问题。
function weeklyReportRunScript(record, options) {
  return new Promise((resolve) => {
    const args = [record.scriptPath, '--stdout'];
    if (record.xlsxPath) args.push('--xlsx', record.xlsxPath);
    if (options.week) args.push('--week', options.week);
    if (options.start) args.push('--start', options.start);
    if (options.end) args.push('--end', options.end);
    (options.systems || []).forEach((item) => args.push('--system', item));
    (options.plans || []).forEach((item) => args.push('--plan', item));
    const { execFile } = require('child_process');
    execFile(record.pythonPath, args, { timeout: 60000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8', windowsHide: true }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, error: err, stdout: String(stdout || ''), stderr: String(stderr || '') });
      else resolve({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

// 计算周期日期区间（与脚本 week_period_start 同一套规则）。
// weekStartDay: ''=未设置；0=周一 … 6=周日；this=当前周期第一天~今天；last=上一完整周期。
function weeklyReportPeriodDates(weekStartDay, preset) {
  if (weekStartDay === '' || weekStartDay == null) return { start: '', end: '' };
  const today = window.moment();
  const pythonWeekday = (today.day() + 6) % 7; // moment.day(): 0=周日；转成 0=周一 口径
  const offset = ((pythonWeekday - weekStartDay) % 7 + 7) % 7;
  const start = today.clone().subtract(offset, 'day');
  if (preset === 'last') {
    const lastStart = start.clone().subtract(7, 'day');
    return { start: lastStart.format('YYYY-MM-DD'), end: lastStart.clone().add(6, 'day').format('YYYY-MM-DD') };
  }
  return { start: start.format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') };
}

function weeklyReportFileName(start, systems) {
  const moment = window.moment(start);
  const suffix = systems && systems.length ? '-' + systems.join('+').replace(/[\\/:*?"<>|]/g, '_') : '';
  return `${moment.isoWeekYear()}-W${String(moment.isoWeek()).padStart(2, '0')}${suffix}.md`;
}

async function weeklyReportSaveToVault(app, record, body, start, systems) {
  const folder = record.vaultFolder || '';
  if (!folder) throw new Error('未配置库内存放目录，请先在该记录设置里填写');
  if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  const systemsLine = systems && systems.length ? `systems: [${systems.join(', ')}]\n` : '';
  const content = `---\ntags: [运维周报]\nstart: ${start}\n${systemsLine}---\n\n${body}\n`;
  const path = folder + '/' + weeklyReportFileName(start, systems);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) await app.vault.modify(existing, content);
  else await app.vault.create(path, content);
  return path;
}

function weeklyReportMissingConfig(record) {
  return !record || !record.pythonPath || !record.scriptPath || !record.vaultFolder;
}

// 定时任务/命令面板共用的直生成入口：不弹预览，直接写库（配置缺失或缺命令时只提示并引导配置）。
// system 为空生成该记录的全部系统；传入单个系统名则生成该系统的独立周报。
async function runWeeklyReportCommand(plugin, record, preset, system) {
  const en = (plugin._lang?.() || DEFAULT_LANG) === 'en';
  if (weeklyReportMissingConfig(record)) {
    new obs.Notice(en ? 'This weekly report record is not fully configured. Open the module settings first.' : '这条周报配置不完整：请先补齐解释器、脚本路径与库内目录。');
    try {
      plugin._open?.();
      const view = plugin.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
      if (view) openWeeklyReportRecordEditor(view, record, null);
    } catch (e) { console.warn('[Cockpit weekly report] open editor failed', e); }
    return;
  }
  new obs.Notice(en ? '📊 Generating weekly report…' : '📊 正在生成周报…');
  const result = await weeklyReportRunScript(record, { week: preset, systems: system ? [system] : [] });
  if (!result.ok) {
    const detail = (result.stderr || '').trim().split('\n').filter(Boolean).slice(-1)[0] || result.error?.message || 'unknown error';
    new obs.Notice((en ? '❌ Weekly report failed: ' : '❌ 周报生成失败：') + detail, 8000);
    const missingCommand = result.error && /ENOENT|command not found/i.test(String(result.error.message || ''));
    if (missingCommand) {
      new obs.Notice(en ? 'Interpreter or script not found. Check the record settings.' : '找不到解释器或脚本，请检查这条记录的配置。');
      try {
        plugin._open?.();
        const view = plugin.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
        if (view) openWeeklyReportRecordEditor(view, record, null);
      } catch (e) { console.warn('[Cockpit weekly report] open editor failed', e); }
    }
    return;
  }
  const matched = /\[i\] 区间 (\d{4}-\d{2}-\d{2}) ~ (\d{4}-\d{2}-\d{2})/.exec(result.stderr || '');
  const start = (matched && matched[1]) || window.moment().format('YYYY-MM-DD');
  try {
    const path = await weeklyReportSaveToVault(plugin.app, record, result.stdout, start, system ? [system] : []);
    new obs.Notice((en ? '✅ Weekly report saved: ' : '✅ 周报已保存：') + path, 8000);
  } catch (e) {
    new obs.Notice((en ? '❌ Save failed: ' : '❌ 保存失败：') + (e?.message || e), 8000);
  }
}

// 按系统名生成稳定短键，用于动态命令 id（清单重排不漂移）。
function weeklyReportSystemKey(name) {
  let hash = 5381;
  const text = String(name || '');
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}

// 动态注册周报命令：每条记录注册 全部系统(本/上周期) + 每系统(本/上周期)。
// 记录或系统清单变更后调用本函数，命令随之增删，定时任务里始终可选到最新清单。
let weeklyReportDynamicCommandIds = [];
function refreshWeeklyReportCommands(plugin) {
  if (!plugin || plugin.app?.isMobile) return;
  weeklyReportDynamicCommandIds.forEach((id) => { try { plugin.removeCommand(id); } catch (e) { /* 未注册过则忽略 */ } });
  weeklyReportDynamicCommandIds = [];
  const register = (id, name, record, preset, system) => {
    try {
      plugin.addCommand({ id, name, callback: async () => { await runWeeklyReportCommand(plugin, record, preset, system); } });
      weeklyReportDynamicCommandIds.push(id);
    } catch (e) { console.warn('[Cockpit weekly report] register command failed', id, e); }
  };
  readWeeklyReportConfig(plugin).then((cfg) => {
    cfg.records.forEach((record) => {
      const base = 'wr-' + record.id;
      register(base + '-this', '周报工坊·' + record.name + '：生成本周期周报', record, 'this', null);
      register(base + '-last', '周报工坊·' + record.name + '：生成上一周期周报', record, 'last', null);
      record.systems.forEach((system) => {
        const sysKey = base + '-sys-' + weeklyReportSystemKey(system);
        register(sysKey, '周报工坊·' + record.name + '：生成「' + system + '」本周期周报', record, 'this', system);
        register(sysKey + '-last', '周报工坊·' + record.name + '：生成「' + system + '」上一周期周报', record, 'last', system);
      });
    });
  }).catch((e) => console.warn('[Cockpit weekly report] load records for commands failed', e));
}

// 快捷创建定时任务：预填一条「应用命令」类任务草稿，交给既有定时任务编辑器确认保存。
function openWeeklyReportScheduledTask(view, taskName, fullCommandId) {
  const en = view._lang() === 'en';
  if (!fullCommandId) { new obs.Notice(en ? 'Command is not registered yet. Save this record first.' : '命令尚未注册，请先保存这条记录。'); return; }
  const draft = {
    id: scheduledTaskId(),
    name: taskName,
    kind: 'obsidian-command',
    command: fullCommandId,
    enabled: true,
    trusted: false,
    schedule: { type: 'weekly', intervalMinutes: 60, time: '09:00', weekdays: [3], event: 'file-saved', folder: '' },
    missedPolicy: 'run-once',
    timeoutSeconds: 300,
    createdAt: new Date().toISOString()
  };
  openScheduledTaskEditor(view, draft);
}

// 记录编辑器：新增/编辑一条周报配置。existing 为空即新增。
function openWeeklyReportRecordEditor(view, existing, onDone) {
  const en = view._lang() === 'en';
  const isNew = !existing;
  const draftId = existing?.id || weeklyReportId();
  const overlay = document.createElement('div'); overlay.className = PLUGIN_ID + '-scheduler-backdrop';
  const panel = overlay.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog' });
  const head = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-head' });
  head.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-title', text: existing ? (en ? 'Edit report record' : '编辑周报配置') : (en ? 'New report record' : '新增周报配置') });
  const close = head.createEl('button', { attr: { type: 'button', 'aria-label': en ? 'Close' : '关闭' } });
  obs.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  makeCockpitDialogDraggable(panel, head, { label: en ? 'Drag record editor' : '拖动周报配置窗口' });
  const field = (label) => { const wrap = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-field' }); wrap.createDiv({ cls: PLUGIN_ID + '-scheduler-label', text: label }); return wrap; };
  const name = field(en ? 'Name' : '名称').createEl('input', { attr: { type: 'text', maxlength: '60', placeholder: en ? 'e.g. Project 01 ops weekly' : '例如：南通01项目运维周报' } });
  const pythonInput = field(en ? 'Python interpreter (e.g. python3)' : 'Python 解释器（例如 python3）').createEl('input', { attr: { type: 'text', maxlength: '300', placeholder: en ? 'e.g. python3' : '例如：python3' } });
  const scriptInput = field(en ? 'Report script path (weekly_report.py)' : '周报脚本路径（weekly_report.py）').createEl('input', { attr: { type: 'text', maxlength: '500', placeholder: en ? 'Absolute path to your script' : '脚本的绝对路径，由你自己维护' } });
  const xlsxInput = field(en ? 'Ledger xlsx path (optional, blank = script config)' : '台账 xlsx 路径（可选，留空用脚本自身配置）').createEl('input', { attr: { type: 'text', maxlength: '500', placeholder: en ? 'Optional: exported ledger xlsx' : '可选：导出的台账 xlsx 绝对路径' } });
  const folderInput = field(en ? 'Vault folder for reports' : '库内存放目录').createEl('input', { attr: { type: 'text', maxlength: '200', placeholder: en ? 'e.g. _weekly' : '例如：_weekly' } });
  const weekdayLabels = en
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const weekSel = field(en ? 'Week start day (keep same as script config week_start_day)' : '周期起始日（与脚本 config.week_start_day 保持一致）').createEl('select');
  weekSel.createEl('option', { text: en ? 'Not set' : '未设置', attr: { value: '' } });
  weekdayLabels.forEach((label, index) => weekSel.createEl('option', { text: label, attr: { value: String(index) } }));
  const systemsInput = field(en ? 'System/module list (one per line)' : '系统/模块清单（每行一个，用于面板与分系统定时）').createEl('textarea', { attr: { rows: '4', placeholder: en ? 'e.g. Contract system' : '例如：合约系统\n资产系统\n门户系统' } });

  // 快捷创建定时任务：仅已保存过的记录可用（命令以记录 id 注册，保存后即生效）。
  const tip = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-field' });
  if (isNew) {
    tip.createDiv({ cls: PLUGIN_ID + '-scheduler-empty', text: en
      ? 'Quick-create of scheduled tasks appears after the record is saved once.'
      : '保存这条记录后，这里会出现「快捷创建定时任务」按钮（应用命令，无需 Shell 权限）。' });
  } else {
    tip.createDiv({ cls: PLUGIN_ID + '-scheduler-label', text: en ? 'Quick create scheduled task (app command, no shell permission)' : '快捷创建定时任务（应用命令，无需 Shell 权限）' });
    const quickRow = tip.createDiv({ cls: PLUGIN_ID + '-report-studio-chips' });
    const manifestId = view._plugin.manifest?.id || PLUGIN_ID;
    const base = 'wr-' + draftId;
    const quickCreate = (label, taskName, commandId) => {
      const btn = quickRow.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip', text: label, attr: { type: 'button' } });
      btn.onclick = () => openWeeklyReportScheduledTask(view, taskName, manifestId + ':' + commandId);
    };
    quickCreate(en ? 'All · this period' : '全部 · 本周期', recordNameForTask(en, existing, en ? 'all, this period' : '全部 · 本周期'), base + '-this');
    quickCreate(en ? 'All · last period' : '全部 · 上一周期', recordNameForTask(en, existing, en ? 'all, last period' : '全部 · 上一周期'), base + '-last');
    const quickSystemRow = tip.createDiv({ cls: PLUGIN_ID + '-report-studio-chips' });
    (existing?.systems || []).forEach((system) => {
      const sysKey = base + '-sys-' + weeklyReportSystemKey(system);
      const mkBtn = (label, taskName, commandId) => {
        const btn = quickSystemRow.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip', text: label, attr: { type: 'button' } });
        btn.onclick = () => openWeeklyReportScheduledTask(view, taskName, manifestId + ':' + commandId);
      };
      mkBtn(system + (en ? ' · this period' : ' · 本周期'),
        en ? 'Weekly report (' + existing.name + ', ' + system + ', this period)' : '周报工坊（' + existing.name + ' · ' + system + ' · 本周期）', sysKey);
      mkBtn(system + (en ? ' · last period' : ' · 上一周期'),
        en ? 'Weekly report (' + existing.name + ', ' + system + ', last period)' : '周报工坊（' + existing.name + ' · ' + system + ' · 上一周期）', sysKey + '-last');
    });
  }

  readWeeklyReportConfig(view._plugin).then(() => {
    if (existing) {
      name.value = existing.name; pythonInput.value = existing.pythonPath; scriptInput.value = existing.scriptPath;
      xlsxInput.value = existing.xlsxPath; folderInput.value = existing.vaultFolder;
      systemsInput.value = existing.systems.join('\n');
      weekSel.value = String(existing.weekStartDay == null ? '' : existing.weekStartDay);
    }
  });

  const error = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-error' });
  const footer = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-footer' });
  if (existing) {
    const remove = footer.createEl('button', { cls: 'danger', text: en ? 'Delete' : '删除', attr: { type: 'button' } });
    remove.onclick = async () => {
      if (!window.confirm(en ? 'Delete this report record? Scheduled tasks built on it will no longer run.' : '删除这条周报配置？基于它创建的定时任务将不再可用。')) return;
      const cfg = await readWeeklyReportConfig(view._plugin);
      await writeWeeklyReportRecords(view._plugin, cfg.records.filter((record) => record.id !== draftId));
      refreshWeeklyReportCommands(view._plugin);
      overlay.remove();
      onDone?.();
    };
  }
  const cancel = footer.createEl('button', { text: en ? 'Cancel' : '取消', attr: { type: 'button' } }); cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls: 'primary', text: en ? 'Save' : '保存', attr: { type: 'button' } });
  save.onclick = async () => {
    error.setText('');
    const systems = systemsInput.value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 32);
    const record = normalizeWeeklyReportRecord({
      id: draftId,
      name: name.value,
      pythonPath: pythonInput.value,
      scriptPath: scriptInput.value,
      xlsxPath: xlsxInput.value,
      vaultFolder: folderInput.value,
      systems,
      weekStartDay: weekSel.value === '' ? '' : (Number(weekSel.value) || 0)
    });
    if (!record.name) { error.setText(en ? 'Name is required.' : '名称不能为空。'); return; }
    if (!record.pythonPath || !record.scriptPath) { error.setText(en ? 'Interpreter and script path are required to generate.' : '要生成周报，解释器和脚本路径不能为空。'); return; }
    if (!record.vaultFolder) { error.setText(en ? 'Vault folder is required: reports are saved there.' : '库内存放目录不能为空，周报要写进这个目录。'); return; }
    save.disabled = true;
    try {
      const cfg = await readWeeklyReportConfig(view._plugin);
      const records = cfg.records.filter((item) => item.id !== record.id);
      records.push(record);
      await writeWeeklyReportRecords(view._plugin, records);
      refreshWeeklyReportCommands(view._plugin);
      overlay.remove();
      onDone?.(record);
    }
    catch (e) { error.setText((en ? 'Save failed: ' : '保存失败：') + (e?.message || e)); save.disabled = false; }
  };
  overlay.onclick = (event) => { if (event.target === overlay) overlay.remove(); };
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); overlay.remove(); } });
  document.body.appendChild(overlay);
}

function recordNameForTask(en, record, suffixLabel) {
  return en ? 'Weekly report (' + (record?.name || '') + ', ' + suffixLabel + ')' : '周报工坊（' + (record?.name || '') + ' · ' + suffixLabel + '）';
}

function openWeeklyReportPreview(view, draft) {
  const en = view._lang() === 'en';
  const overlay = document.createElement('div'); overlay.className = PLUGIN_ID + '-scheduler-backdrop';
  const panel = overlay.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog logs' });
  const head = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-head' });
  head.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-title', text: en ? 'Weekly report preview' : '周报预览（保存前可修改）' });
  const controls = head.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-controls' });
  const close = controls.createEl('button', { attr: { type: 'button', 'aria-label': en ? 'Close' : '关闭' } });
  obs.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  makeCockpitDialogDraggable(panel, head, { label: en ? 'Drag preview window' : '拖动预览窗口' });
  const editor = panel.createEl('textarea', { attr: { rows: '18', spellcheck: 'false' } });
  editor.value = draft.body;
  const footer = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-footer' });
  const copy = footer.createEl('button', { text: en ? 'Copy content' : '复制内容', attr: { type: 'button' } });
  copy.onclick = () => weeklyReportCopyText(view, editor.value);
  const cancel = footer.createEl('button', { text: en ? 'Cancel' : '取消', attr: { type: 'button' } }); cancel.onclick = () => overlay.remove();
  const save = footer.createEl('button', { cls: 'primary', text: en ? 'Save to vault' : '保存到库内', attr: { type: 'button' } });
  save.onclick = async () => {
    save.disabled = true;
    try {
      const path = await weeklyReportSaveToVault(view.app, draft.record, editor.value, draft.start, draft.systems);
      overlay.remove();
      new obs.Notice((en ? 'Saved: ' : '已保存：') + path);
    } catch (e) {
      new obs.Notice((en ? 'Save failed: ' : '保存失败：') + (e?.message || e));
      save.disabled = false;
    }
  };
  overlay.onclick = (event) => { if (event.target === overlay) overlay.remove(); };
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); overlay.remove(); } });
  document.body.appendChild(overlay);
  setTimeout(() => editor.focus(), 20);
}

function buildWeeklyReportModule(view, root) {
  const en = view._lang() === 'en';
  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: en ? 'Weekly report studio' : '周报工坊' });
  title.dataset.section = 'report-studio-title';
  const body = root.createDiv({ cls: PLUGIN_ID + '-report-studio' });
  body.dataset.section = 'report-studio-body';

  const state = { selectedId: null, preset: 'this', start: '', end: '', systems: new Set(), plans: '', busy: false, status: '', error: false };

  const render = async () => {
    body.empty();
    const cfg = await readWeeklyReportConfig(view._plugin);
    const records = cfg.records;

    // ── 记录列表头部：数量 + 新增 ──
    const header = body.createDiv({ cls: PLUGIN_ID + '-report-studio-row' });
    header.createDiv({ cls: PLUGIN_ID + '-report-studio-label', text: en
      ? records.length + ' record' + (records.length === 1 ? '' : 's') + ' · each record is one independent report config'
      : records.length + ' 条配置 · 每条是一份独立的周报来源' });
    const add = header.createEl('button', { cls: 'primary', text: '+ ' + (en ? 'New record' : '新增配置'), attr: { type: 'button' } });
    add.onclick = () => openWeeklyReportRecordEditor(view, null, () => render());

    if (!records.length) {
      body.createDiv({ cls: PLUGIN_ID + '-scheduler-empty', text: en
        ? 'No report records yet. Click "New record": set interpreter, script, ledger xlsx and vault folder, then generate here or schedule it in Scheduled tasks.'
        : '还没有周报配置。点「新增配置」：填好解释器、脚本、台账 xlsx 与库内目录，就能在这里生成，也能去定时任务里建自动化。' });
      return;
    }

    // ── 记录列表 ──
    const list = body.createDiv({ cls: PLUGIN_ID + '-report-studio-list' });
    records.forEach((record) => {
      const row = list.createDiv({ cls: PLUGIN_ID + '-report-studio-record' + (state.selectedId === record.id || (!state.selectedId && record.id === records[0].id) ? ' active' : '') });
      const nameBtn = row.createEl('button', { cls: PLUGIN_ID + '-report-studio-record-name', text: record.name, attr: { type: 'button' } });
      nameBtn.onclick = () => {
        state.selectedId = record.id;
        state.preset = 'this'; state.start = ''; state.end = ''; state.systems = new Set(); state.plans = ''; state.status = ''; state.error = false;
        render();
      };
      row.createDiv({ cls: PLUGIN_ID + '-report-studio-record-meta', text:
        (record.scriptPath ? record.scriptPath.split('/').pop() : (en ? 'no script' : '未配脚本'))
        + ' · ' + (record.vaultFolder || (en ? 'no folder' : '未配目录'))
        + (record.xlsxPath ? ' · xlsx' : '') });
      const edit = row.createEl('button', { cls: PLUGIN_ID + '-scheduler-icon-btn', attr: { type: 'button', 'aria-label': en ? 'Edit' : '编辑' } });
      obs.setIcon(edit, 'settings');
      edit.onclick = () => openWeeklyReportRecordEditor(view, record, () => render());
      const del = row.createEl('button', { cls: PLUGIN_ID + '-scheduler-icon-btn', attr: { type: 'button', 'aria-label': en ? 'Delete' : '删除' } });
      obs.setIcon(del, 'trash');
      del.onclick = async () => {
        if (!window.confirm(en ? 'Delete this report record?' : '删除这条周报配置？')) return;
        await writeWeeklyReportRecords(view._plugin, records.filter((item) => item.id !== record.id));
        if (state.selectedId === record.id) state.selectedId = null;
        refreshWeeklyReportCommands(view._plugin);
        render();
      };
    });

    // ── 选中记录的生成面板 ──
    const record = records.find((item) => item.id === state.selectedId) || records[0];
    if (state.selectedId !== record.id) state.selectedId = record.id;

    const rowTop = body.createDiv({ cls: PLUGIN_ID + '-report-studio-row' });
    const presetGroup = rowTop.createDiv({ cls: PLUGIN_ID + '-report-studio-chips' });
    const presets = [['this', en ? 'This period' : '本周期'], ['last', en ? 'Last period' : '上一周期'], ['custom', en ? 'Custom' : '自定义']];
    presets.forEach(([value, label]) => {
      const chip = presetGroup.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip' + (state.preset === value ? ' active' : ''), text: label, attr: { type: 'button' } });
      chip.onclick = () => { state.preset = value; render(); };
    });
    const dateGroup = rowTop.createDiv({ cls: PLUGIN_ID + '-report-studio-dates' });
    const startInput = dateGroup.createEl('input', { attr: { type: 'date', 'aria-label': en ? 'Start date' : '开始日期' } });
    const endInput = dateGroup.createEl('input', { attr: { type: 'date', 'aria-label': en ? 'End date' : '结束日期' } });
    if (state.preset === 'custom') {
      if (!state.start || !state.end) {
        const current = weeklyReportPeriodDates(record.weekStartDay, 'this');
        if (!state.start) state.start = current.start;
        if (!state.end) state.end = current.end;
      }
      startInput.value = state.start; endInput.value = state.end;
      startInput.onchange = () => { state.start = startInput.value; };
      endInput.onchange = () => { state.end = endInput.value; };
    } else {
      const presetDates = weeklyReportPeriodDates(record.weekStartDay, state.preset);
      state.start = presetDates.start; state.end = presetDates.end;
      startInput.value = presetDates.start; endInput.value = presetDates.end;
      startInput.disabled = true; endInput.disabled = true;
      const hint = record.weekStartDay === ''
        ? (en ? 'Week start day is not set in this record. Set it to see period dates.' : '该记录未设置周期起始日，设置后这里会显示区间')
        : (en ? 'Computed from week start day. Switch to Custom to edit.' : '由周期起始日自动算出，切到「自定义」可修改');
      startInput.setAttribute('title', hint);
      endInput.setAttribute('title', hint);
    }

    if (record.systems.length) {
      const rowSystems = body.createDiv({ cls: PLUGIN_ID + '-report-studio-row' });
      rowSystems.createDiv({ cls: PLUGIN_ID + '-report-studio-label', text: en ? 'System' : '系统' });
      const chips = rowSystems.createDiv({ cls: PLUGIN_ID + '-report-studio-chips' });
      const all = chips.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip' + (state.systems.size ? '' : ' active'), text: en ? 'All' : '全部', attr: { type: 'button' } });
      all.onclick = () => { state.systems.clear(); render(); };
      record.systems.forEach((sysName) => {
        const active = state.systems.has(sysName);
        const chip = chips.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip' + (active ? ' active' : ''), text: sysName, attr: { type: 'button' } });
        chip.onclick = () => { active ? state.systems.delete(sysName) : state.systems.add(sysName); render(); };
      });
    }

    const rowPlan = body.createDiv({ cls: PLUGIN_ID + '-report-studio-row column' });
    rowPlan.createDiv({ cls: PLUGIN_ID + '-report-studio-label', text: en ? 'Next-week plan (one per line, blank = script presets)' : '下周计划（每行一条，留空用脚本预设）' });
    const planInput = rowPlan.createEl('textarea', { attr: { rows: '3', placeholder: en ? 'e.g. Daily ops support' : '例如：系统日常使用的运维' } });
    planInput.value = state.plans || '';
    planInput.oninput = () => { state.plans = planInput.value; };

    const rowAction = body.createDiv({ cls: PLUGIN_ID + '-report-studio-row' });
    const generate = rowAction.createEl('button', { cls: 'primary', text: state.busy ? (en ? 'Generating…' : '生成中…') : (en ? 'Generate report' : '生成周报'), attr: { type: 'button' } });
    generate.disabled = state.busy;
    const status = rowAction.createDiv({ cls: PLUGIN_ID + '-report-studio-status', text: state.status || '' });
    if (state.error) status.addClass('error');
    generate.onclick = async () => {
      if (state.busy) return;
      if (weeklyReportMissingConfig(record)) {
        state.error = true;
        state.status = en ? 'Configure interpreter, script and vault folder in this record first.' : '请先在这条记录里配置解释器、脚本与库内目录。';
        render();
        openWeeklyReportRecordEditor(view, record, () => render());
        return;
      }
      state.busy = true; state.error = false; state.status = en ? 'Running script…' : '正在调用脚本…'; render();
      const options = { systems: Array.from(state.systems) };
      if (state.preset === 'custom') {
        if (!state.start || !state.end) { state.busy = false; state.error = true; state.status = en ? 'Pick a date range first.' : '请先选择起止日期。'; render(); return; }
        options.start = state.start; options.end = state.end;
      } else options.week = state.preset;
      options.plans = (state.plans || '').split('\n').map((item) => item.trim()).filter(Boolean);
      const result = await weeklyReportRunScript(record, options);
      state.busy = false;
      if (!result.ok) {
        state.error = true;
        state.status = result.stderr ? result.stderr.trim().split('\n').pop() : (result.error?.message || 'failed');
        render();
        if (view._isCommandMissingError(result.error)) {
          new obs.Notice(en ? 'Report command not found. Check interpreter/script paths.' : '找不到周报命令，请检查解释器与脚本路径配置。');
          openWeeklyReportRecordEditor(view, record, () => render());
        }
        return;
      }
      state.error = false;
      state.status = (result.stderr || '').trim().split('\n').filter(Boolean).slice(-1)[0] || (en ? 'Done.' : '完成。');
      const matched = /\[i\] 区间 (\d{4}-\d{2}-\d{2}) ~ (\d{4}-\d{2}-\d{2})/.exec(result.stderr || '');
      const startForName = (options.start || (matched && matched[1]) || window.moment().format('YYYY-MM-DD'));
      render();
      openWeeklyReportPreview(view, { record, body: result.stdout, start: startForName, systems: options.systems });
    };
  };

  render();
  view._makeModuleCollapsible('reportStudio', title, body);
  return render;
}
