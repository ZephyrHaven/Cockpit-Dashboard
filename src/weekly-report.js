// weekly-report.js — 周报工坊：记录制的周报生成模块。
// 每条记录 = 一份独立周报配置（名称/解释器/脚本/台账 xlsx/库内目录/周期起始日/系统清单），
// 学定时任务模块的「列表 + 新增 + 编辑」形态：新增一条就是一条记录，互不干扰，支持多台账并存。
// 插件不预置任何解释器/脚本/路径，全部由用户在记录编辑器里自行配置，保存在 data.json（weeklyReport.records）。
// 定时自动化复用「定时任务」的应用命令体系：按记录与系统动态注册命令，可分系统、分周期单独建任务。

const WEEKLY_REPORT_CONFIG_KEY = 'weeklyReport';
const WEEKLY_REPORT_RECORD_LIMIT = 20;
const WEEKLY_REPORT_AI_HISTORY_CHARS = 6800;

function weeklyReportAiStyleInstruction(style, en) {
  const labels = {
    professional: en ? 'Use a professional, clear operations-report tone.' : '使用专业、清晰的运维周报语气。',
    concise: en ? 'Make the report concise. Remove repetition while keeping every important fact.' : '尽量精简，去掉重复表达，但保留所有重要事实。',
    executive: en ? 'Prioritize outcomes, impact, risks, and next actions for management readers.' : '面向管理者，突出结果、影响、风险和下一步行动。',
    preserve: en ? 'Polish wording and structure lightly while preserving the original voice.' : '只轻度润色措辞和结构，尽量保留原有表达风格。'
  };
  return labels[style] || labels.professional;
}

function weeklyReportAiPrompt(style, en) {
  const styleInstruction = weeklyReportAiStyleInstruction(style, en);
  return en
    ? [
      'Rewrite the supplied weekly report as polished Markdown.',
      styleInstruction,
      'Preserve all facts, dates, numbers, system names, outcomes, risks, and next-week plans.',
      'Do not invent work, incidents, causes, owners, metrics, or conclusions.',
      'Keep useful Markdown headings and lists. Return only the revised report, with no preface or explanation.'
    ].join(' ')
    : [
      '请将提供的周报优化为可直接保存的 Markdown。',
      styleInstruction,
      '必须保留全部事实、日期、数字、系统名称、工作结果、风险和下周计划。',
      '不得编造工作、故障、原因、负责人、指标或结论。',
      '保留有用的 Markdown 标题与列表，只输出优化后的周报正文，不要附加解释或前言。'
    ].join('');
}

function weeklyReportNextSelectedId(selectedId, recordId) {
  const current = String(selectedId || '');
  const target = String(recordId || '');
  return target && current !== target ? target : null;
}

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
    if (typeof cockpitEmit === 'function') cockpitEmit('weekly-report-saved', {
      path,
      recordId:record.id,
      recordName:record.name,
      version:'original',
      start,
      systems:system ? [system] : [],
      savedAt:new Date().toISOString()
    });
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
  openScheduledTaskEditor(view, draft, { asNew:true });
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
  let abortController = null;
  let aiSessionId = '';
  let optimizing = false;
  let activePane = 'original';
  const overlay = document.createElement('div'); overlay.className = PLUGIN_ID + '-scheduler-backdrop';
  const panel = overlay.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog logs ' + PLUGIN_ID + '-report-preview' });
  const head = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-head' });
  const heading = head.createDiv({ cls: PLUGIN_ID + '-report-preview-heading' });
  heading.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-title', text: en ? 'Weekly report workbench' : '周报优化工作台' });
  heading.createDiv({ cls: PLUGIN_ID + '-report-preview-subtitle', text: en ? 'Compare both versions, then choose which one to save.' : '对照两个版本，再选择最终保存哪一版。' });
  const controls = head.createDiv({ cls: PLUGIN_ID + '-scheduler-dialog-controls' });
  const close = controls.createEl('button', { attr: { type: 'button', 'aria-label': en ? 'Close' : '关闭' } });
  const closePreview = () => { abortController?.abort(); overlay.remove(); };
  obs.setIcon(close, 'x'); close.onclick = closePreview;
  makeCockpitDialogDraggable(panel, head, { label: en ? 'Drag preview window' : '拖动预览窗口' });

  const aiBar = panel.createDiv({ cls: PLUGIN_ID + '-report-ai-bar' });
  const aiBarMain = aiBar.createDiv({ cls: PLUGIN_ID + '-report-ai-bar-main' });
  const profileBadge = aiBarMain.createDiv({ cls: PLUGIN_ID + '-report-ai-profile', text: en ? 'Loading AI profile…' : '正在读取 AI 配置…' });
  aiBarMain.createDiv({ cls: PLUGIN_ID + '-report-ai-privacy', text: en
    ? 'AI Optimize sends the current report text to your configured model provider.'
    : '点击 AI 优化后，当前周报内容会发送到你配置的模型服务商。' });
  const aiActions = aiBar.createDiv({ cls: PLUGIN_ID + '-report-ai-actions' });
  const style = aiActions.createEl('select', { attr: { 'aria-label': en ? 'Optimization style' : '优化风格' } });
  [['professional', en ? 'Professional' : '专业清晰'], ['concise', en ? 'Concise' : '精简提炼'], ['executive', en ? 'Executive' : '管理视角'], ['preserve', en ? 'Light polish' : '轻度润色']]
    .forEach(([value, label]) => style.createEl('option', { text: label, attr: { value } }));
  const optimize = aiActions.createEl('button', { cls: 'primary', text: en ? 'AI Optimize' : 'AI 优化', attr: { type: 'button' } });
  const stop = aiActions.createEl('button', { text: en ? 'Stop' : '停止', attr: { type: 'button' } });
  stop.disabled = true;
  const openAgent = aiActions.createEl('button', { text: en ? 'Continue in Agent' : '在 Agent 中继续', attr: { type: 'button' } });
  openAgent.disabled = true;

  const status = panel.createDiv({ cls: PLUGIN_ID + '-report-ai-status', attr: { role: 'status', 'aria-live': 'polite' } });
  status.createSpan({ cls: PLUGIN_ID + '-report-ai-status-dot' });
  const statusText = status.createSpan({ text: en ? 'Original report is ready. AI optimization is optional.' : '原稿已生成；AI 优化为可选操作。' });

  const tabs = panel.createDiv({ cls: PLUGIN_ID + '-report-version-tabs' });
  const originalTab = tabs.createEl('button', { cls: 'active', text: en ? 'Original' : '原稿', attr: { type: 'button', 'aria-pressed': 'true' } });
  const aiTab = tabs.createEl('button', { text: en ? 'AI version' : 'AI 优化稿', attr: { type: 'button', 'aria-pressed': 'false' } });
  const compare = panel.createDiv({ cls: PLUGIN_ID + '-report-compare' });
  const makeVersion = (kind, titleText, badgeText) => {
    const card = compare.createDiv({ cls: PLUGIN_ID + '-report-version ' + kind + (kind === 'original' ? ' active' : '') });
    const cardHead = card.createDiv({ cls: PLUGIN_ID + '-report-version-head' });
    const label = cardHead.createDiv({ cls: PLUGIN_ID + '-report-version-label' });
    label.createSpan({ text: titleText });
    label.createSpan({ cls: PLUGIN_ID + '-report-version-badge', text: badgeText });
    const copy = cardHead.createEl('button', { attr: { type: 'button', 'aria-label': en ? 'Copy this version' : '复制这个版本' } });
    obs.setIcon(copy, 'copy');
    const editor = card.createEl('textarea', { attr: { spellcheck: 'false', 'aria-label': titleText } });
    copy.onclick = () => weeklyReportCopyText(view, editor.value);
    return { card, editor };
  };
  const originalVersion = makeVersion('original', en ? 'Original report' : '原始版本', en ? 'Script output' : '脚本生成');
  const aiVersion = makeVersion('ai', en ? 'AI optimized report' : 'AI 优化版本', en ? 'Not generated' : '尚未生成');
  originalVersion.editor.value = draft.body;
  aiVersion.editor.placeholder = en ? 'Click AI Optimize to generate a second version. Your original stays unchanged.' : '点击「AI 优化」生成第二个版本；原稿始终保持不变。';

  const switchPane = (pane) => {
    activePane = pane === 'ai' ? 'ai' : 'original';
    originalVersion.card.toggleClass('active', activePane === 'original');
    aiVersion.card.toggleClass('active', activePane === 'ai');
    originalTab.toggleClass('active', activePane === 'original');
    aiTab.toggleClass('active', activePane === 'ai');
    originalTab.setAttribute('aria-pressed', String(activePane === 'original'));
    aiTab.setAttribute('aria-pressed', String(activePane === 'ai'));
  };
  originalTab.onclick = () => switchPane('original');
  aiTab.onclick = () => switchPane('ai');

  const footer = panel.createDiv({ cls: PLUGIN_ID + '-scheduler-footer' });
  const cancel = footer.createEl('button', { text: en ? 'Cancel' : '取消', attr: { type: 'button' } }); cancel.onclick = closePreview;
  const saveOriginal = footer.createEl('button', { text: en ? 'Save original' : '保存原稿', attr: { type: 'button' } });
  const saveAi = footer.createEl('button', { cls: 'primary', text: en ? 'Save AI version' : '保存 AI 版', attr: { type: 'button' } });
  saveAi.disabled = true;

  const setStatus = (text, state = '') => {
    statusText.setText(text);
    status.classList.remove('working', 'success', 'error');
    if (state) status.addClass(state);
  };
  const setOptimizing = (value) => {
    optimizing = value;
    optimize.disabled = value;
    stop.disabled = !value;
    style.disabled = value;
    saveOriginal.disabled = value;
    saveAi.disabled = value || !aiVersion.editor.value.trim();
    optimize.setText(value ? (en ? 'Optimizing…' : '优化中…') : (aiVersion.editor.value.trim() ? (en ? 'Optimize again' : '重新优化') : (en ? 'AI Optimize' : 'AI 优化')));
  };
  const emitSaved = (path, version) => {
    if (typeof cockpitEmit !== 'function') return;
    cockpitEmit('weekly-report-saved', {
      path,
      recordId:draft.record?.id || '',
      recordName:draft.record?.name || '',
      version,
      start:draft.start,
      systems:Array.isArray(draft.systems) ? draft.systems.slice() : [],
      savedAt:new Date().toISOString()
    });
  };
  const saveVersion = async (version) => {
    if (optimizing) return;
    const editor = version === 'ai' ? aiVersion.editor : originalVersion.editor;
    if (!editor.value.trim()) {
      new obs.Notice(en ? 'This version is empty.' : '这个版本还是空的。');
      return;
    }
    saveOriginal.disabled = true; saveAi.disabled = true;
    try {
      const path = await weeklyReportSaveToVault(view.app, draft.record, editor.value, draft.start, draft.systems);
      emitSaved(path, version);
      closePreview();
      new obs.Notice((version === 'ai' ? (en ? 'AI version saved: ' : 'AI 优化版已保存：') : (en ? 'Original saved: ' : '原稿已保存：')) + path);
    } catch (e) {
      new obs.Notice((en ? 'Save failed: ' : '保存失败：') + (e?.message || e));
      saveOriginal.disabled = false;
      saveAi.disabled = !aiVersion.editor.value.trim();
    }
  };
  saveOriginal.onclick = () => saveVersion('original');
  saveAi.onclick = () => saveVersion('ai');

  const loadProfile = async () => {
    if (!view._plugin?.ai) throw new Error(en ? 'AI service is unavailable.' : 'AI 服务当前不可用。');
    const config = await view._plugin.ai.getConfig();
    const profile = getActiveAiProfile(config);
    profileBadge.setText(profile?.model ? `${profile.name || (en ? 'Current profile' : '当前配置')} · ${profile.model}` : (en ? 'AI model is not configured' : '尚未配置 AI 模型'));
    return { config, profile };
  };
  loadProfile().then(({ profile }) => {
    if (!profile?.model) optimize.disabled = true;
  }).catch((error) => {
    profileBadge.setText(en ? 'AI configuration unavailable' : 'AI 配置不可用');
    optimize.disabled = true;
    setStatus((en ? 'Could not load AI settings: ' : '无法读取 AI 设置：') + (error?.message || error), 'error');
  });

  optimize.onclick = async () => {
    if (optimizing) return;
    const source = originalVersion.editor.value.trim();
    if (!source) { setStatus(en ? 'The original report is empty.' : '原稿为空，无法优化。', 'error'); return; }
    let config;
    let profile;
    try {
      ({ config, profile } = await loadProfile());
      if (!profile?.model) throw new Error(en ? 'Configure an AI model first.' : '请先配置 AI 模型。');
      if (source.length > config.maxContextChars) throw new Error(en
        ? `The report has ${source.length} characters, above the current AI context limit of ${config.maxContextChars}. Shorten it or raise the limit in AI settings.`
        : `当前周报共 ${source.length} 字，超过 AI 设置中的 ${config.maxContextChars} 字上下文上限；请先精简，或调高 AI 上限。`);
    } catch (error) {
      setStatus(error?.message || String(error), 'error');
      return;
    }

    abortController = new AbortController();
    aiVersion.editor.value = '';
    aiVersion.editor.placeholder = en ? 'The optimized report will appear here as it is generated…' : '优化内容会在这里实时生成…';
    aiVersion.card.querySelector('.' + PLUGIN_ID + '-report-version-badge')?.setText(en ? 'Generating' : '生成中');
    switchPane('ai');
    setOptimizing(true);
    setStatus(en ? 'Connecting to the configured model provider…' : '正在连接已配置的模型服务商…', 'working');

    try {
      if (view._plugin.aiHistory) {
        const session = await view._plugin.aiHistory.create({
          title:(en ? 'Weekly report polish · ' : '周报优化 · ') + (draft.record?.name || draft.start || ''),
          language:en ? 'en' : 'zh-CN',
          profileId:config.activeProfileId,
          contextPaths:[]
        });
        aiSessionId = session?.id || '';
        if (aiSessionId) {
          await view._plugin.aiHistory.appendMessage(aiSessionId, {
            role:'user',
            language:en ? 'en' : 'zh-CN',
            content:weeklyReportAiPrompt(style.value, en) + '\n\n' + source.slice(0, WEEKLY_REPORT_AI_HISTORY_CHARS)
          });
          openAgent.disabled = false;
        }
      }
    } catch (error) {
      console.warn('[Cockpit weekly report] could not create AI history', error);
    }

    try {
      const result = await view._plugin.ai.completeStream({
        language:en ? 'en' : 'zh-CN',
        action:'custom',
        question:weeklyReportAiPrompt(style.value, en),
        contexts:[{ path:(draft.record?.name || 'weekly-report') + '-' + draft.start + '.md', content:source, source:'upload' }]
      }, (event) => {
        if (event?.type === 'status') setStatus(event.stage === 'fallback'
          ? (en ? 'Streaming is unavailable; waiting for the complete response…' : '当前接口不支持流式输出，正在等待完整结果…')
          : (en ? 'The model is preparing the report…' : '模型正在准备优化内容…'), 'working');
        if (event?.type === 'content' && event.text) {
          aiVersion.editor.value += event.text;
          aiVersion.editor.scrollTop = aiVersion.editor.scrollHeight;
          saveAi.disabled = true;
          setStatus(en ? 'AI version is being generated. The original is unchanged.' : 'AI 优化稿正在生成，原稿不会被改动。', 'working');
        }
      }, abortController.signal);
      if (!aiVersion.editor.value.trim() && result?.content) aiVersion.editor.value = result.content;
      aiVersion.editor.value = aiVersion.editor.value.trim();
      aiVersion.card.querySelector('.' + PLUGIN_ID + '-report-version-badge')?.setText(en ? 'AI generated' : 'AI 生成');
      if (aiSessionId && aiVersion.editor.value) {
        try { await view._plugin.aiHistory.appendMessage(aiSessionId, { role:'assistant', language:en ? 'en' : 'zh-CN', content:aiVersion.editor.value }); }
        catch (error) { console.warn('[Cockpit weekly report] could not save AI answer history', error); }
      }
      setStatus(en ? 'Optimization complete. Review both versions before saving.' : '优化完成，请对照检查后选择保存版本。', 'success');
    } catch (error) {
      const stopped = abortController?.signal?.aborted || error?.name === 'AbortError' || error?.code === 'AI_ABORTED';
      aiVersion.card.querySelector('.' + PLUGIN_ID + '-report-version-badge')?.setText(aiVersion.editor.value.trim() ? (en ? 'Partial draft' : '未完成草稿') : (en ? 'Not generated' : '尚未生成'));
      setStatus(stopped
        ? (en ? 'AI optimization stopped. The original is safe; you can retry.' : '已停止 AI 优化；原稿未受影响，可以重新尝试。')
        : ((en ? 'AI optimization failed: ' : 'AI 优化失败：') + (error?.message || error)), stopped ? '' : 'error');
    } finally {
      abortController = null;
      setOptimizing(false);
    }
  };
  stop.onclick = () => abortController?.abort();
  openAgent.onclick = async () => {
    if (!aiSessionId) return;
    try {
      await view._plugin.aiHistory?.setActive(aiSessionId);
      await view._plugin.openAI?.();
    } catch (error) {
      new obs.Notice((en ? 'Could not open Agent: ' : '无法打开 Agent：') + (error?.message || error));
    }
  };

  overlay.onclick = (event) => { if (event.target === overlay) closePreview(); };
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closePreview(); } });
  document.body.appendChild(overlay);
  setTimeout(() => originalVersion.editor.focus(), 20);
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

    // ── 每条配置都是一张独立的折叠卡片；默认只显示摘要。 ──
    const header = body.createDiv({ cls: PLUGIN_ID + '-report-studio-header' });
    const headerCopy = header.createDiv({ cls: PLUGIN_ID + '-report-studio-header-copy' });
    headerCopy.createDiv({ cls: PLUGIN_ID + '-report-studio-label', text: en
      ? records.length + ' report config' + (records.length === 1 ? '' : 's')
      : records.length + ' 条周报配置' });
    const add = header.createEl('button', { cls: 'primary', text: '+ ' + (en ? 'New record' : '新增配置'), attr: { type: 'button' } });
    add.onclick = () => openWeeklyReportRecordEditor(view, null, () => render());

    if (!records.length) {
      body.createDiv({ cls: PLUGIN_ID + '-scheduler-empty', text: en
        ? 'No report records yet. Click "New record": set interpreter, script, ledger xlsx and vault folder, then generate here or schedule it in Scheduled tasks.'
        : '还没有周报配置。点「新增配置」：填好解释器、脚本、台账 xlsx 与库内目录，就能在这里生成，也能去定时任务里建自动化。' });
      return;
    }

    // ── 配置卡片 ──
    const list = body.createDiv({ cls: PLUGIN_ID + '-report-studio-list' });
    let activeHost = null;
    records.forEach((record) => {
      const isActive = state.selectedId === record.id;
      const item = list.createDiv({ cls: PLUGIN_ID + '-report-studio-item' + (isActive ? ' expanded' : '') });
      const row = item.createDiv({ cls: PLUGIN_ID + '-report-studio-record' });
      if (isActive) activeHost = item;
      const toggle = row.createEl('button', { cls: PLUGIN_ID + '-report-studio-record-toggle', attr: { type: 'button', 'aria-label': isActive ? (en ? 'Collapse report config' : '收起周报配置') : (en ? 'Expand report config' : '展开周报配置'), 'aria-expanded': String(isActive) } });
      obs.setIcon(toggle, 'chevron-right');
      const nameBtn = row.createEl('button', { cls: PLUGIN_ID + '-report-studio-record-name', text: record.name, attr: { type: 'button', 'aria-expanded': String(isActive) } });
      const toggleRecord = (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const nextSelectedId = weeklyReportNextSelectedId(state.selectedId, record.id);
        if (nextSelectedId) {
          state.preset = 'this'; state.start = ''; state.end = ''; state.systems = new Set(); state.plans = ''; state.status = ''; state.error = false;
        }
        state.selectedId = nextSelectedId;
        render();
      };
      toggle.onpointerdown = (event) => { event.stopPropagation(); };
      toggle.onclick = toggleRecord;
      nameBtn.onpointerdown = (event) => { event.stopPropagation(); };
      nameBtn.onclick = toggleRecord;
      row.createDiv({ cls: PLUGIN_ID + '-report-studio-record-meta', text:
        (record.scriptPath ? record.scriptPath.split('/').pop() : (en ? 'no script' : '未配脚本'))
        + ' · ' + (record.vaultFolder || (en ? 'no folder' : '未配目录'))
        + (record.xlsxPath ? ' · xlsx' : '') });
      const actions = row.createDiv({ cls: PLUGIN_ID + '-report-studio-record-actions' });
      actions.onpointerdown = (event) => { event.stopPropagation(); };
      actions.onclick = (event) => { event.stopPropagation(); };
      const edit = actions.createEl('button', { cls: PLUGIN_ID + '-scheduler-icon-btn', attr: { type: 'button', 'aria-label': en ? 'Edit' : '编辑' } });
      obs.setIcon(edit, 'settings');
      edit.onclick = () => openWeeklyReportRecordEditor(view, record, () => render());
      const del = actions.createEl('button', { cls: PLUGIN_ID + '-scheduler-icon-btn', attr: { type: 'button', 'aria-label': en ? 'Delete' : '删除' } });
      obs.setIcon(del, 'trash');
      del.onclick = async () => {
        if (!window.confirm(en ? 'Delete this report record?' : '删除这条周报配置？')) return;
        await writeWeeklyReportRecords(view._plugin, records.filter((item) => item.id !== record.id));
        if (state.selectedId === record.id) state.selectedId = null;
        refreshWeeklyReportCommands(view._plugin);
        render();
      };
      row.onpointerdown = (event) => { event.stopPropagation(); };
      row.onclick = (event) => {
        if (event.target.closest('.' + PLUGIN_ID + '-report-studio-record-actions')) return;
        toggleRecord(event);
      };
    });

    // 默认保持折叠；仅为当前展开的配置创建生成区域。
    const record = records.find((item) => item.id === state.selectedId);
    if (!record || !activeHost) return;

    const composer = activeHost.createDiv({ cls: PLUGIN_ID + '-report-studio-composer' });
    const composerHead = composer.createDiv({ cls: PLUGIN_ID + '-report-studio-composer-head' });
    const composerTitle = composerHead.createDiv();
    composerTitle.createDiv({ cls: PLUGIN_ID + '-report-studio-eyebrow', text: en ? 'CREATE REPORT' : '生成周报' });
    composerTitle.createDiv({ cls: PLUGIN_ID + '-report-studio-composer-title', text: record.name });
    composerHead.createDiv({ cls: PLUGIN_ID + '-report-studio-ready', text: weeklyReportMissingConfig(record) ? (en ? 'Setup required' : '待完善配置') : (en ? 'Ready' : '已就绪') });

    const rowTop = composer.createDiv({ cls: PLUGIN_ID + '-report-studio-section' });
    rowTop.createDiv({ cls: PLUGIN_ID + '-report-studio-section-label', text: en ? '01 · Period' : '01 · 周报周期' });
    const periodControls = rowTop.createDiv({ cls: PLUGIN_ID + '-report-studio-period-controls' });
    const presetGroup = periodControls.createDiv({ cls: PLUGIN_ID + '-report-studio-chips' });
    const presets = [['this', en ? 'This period' : '本周期'], ['last', en ? 'Last period' : '上一周期'], ['custom', en ? 'Custom' : '自定义']];
    presets.forEach(([value, label]) => {
      const chip = presetGroup.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip' + (state.preset === value ? ' active' : ''), text: label, attr: { type: 'button', 'aria-pressed': String(state.preset === value) } });
      chip.onclick = () => { state.preset = value; render(); };
    });
    const dateGroup = periodControls.createDiv({ cls: PLUGIN_ID + '-report-studio-dates' });
    const startInput = dateGroup.createEl('input', { attr: { type: 'date', 'aria-label': en ? 'Start date' : '开始日期' } });
    dateGroup.createSpan({ cls: PLUGIN_ID + '-report-studio-date-separator', text: '→' });
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
      const rowSystems = composer.createDiv({ cls: PLUGIN_ID + '-report-studio-section' });
      rowSystems.createDiv({ cls: PLUGIN_ID + '-report-studio-section-label', text: en ? '02 · Scope' : '02 · 系统范围' });
      const chips = rowSystems.createDiv({ cls: PLUGIN_ID + '-report-studio-chips' });
      const all = chips.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip' + (state.systems.size ? '' : ' active'), text: en ? 'All systems' : '全部系统', attr: { type: 'button', 'aria-pressed': String(!state.systems.size) } });
      all.onclick = () => { state.systems.clear(); render(); };
      record.systems.forEach((sysName) => {
        const active = state.systems.has(sysName);
        const chip = chips.createEl('button', { cls: PLUGIN_ID + '-report-studio-chip' + (active ? ' active' : ''), text: sysName, attr: { type: 'button', 'aria-pressed': String(active) } });
        chip.onclick = () => { active ? state.systems.delete(sysName) : state.systems.add(sysName); render(); };
      });
    }

    const rowPlan = composer.createDiv({ cls: PLUGIN_ID + '-report-studio-section' });
    rowPlan.createDiv({ cls: PLUGIN_ID + '-report-studio-section-label', text: en ? (record.systems.length ? '03 · Next week' : '02 · Next week') : (record.systems.length ? '03 · 下周计划' : '02 · 下周计划') });
    rowPlan.createDiv({ cls: PLUGIN_ID + '-report-studio-section-hint', text: en ? 'One item per line · leave blank to use script presets' : '每行一条 · 留空则使用脚本预设' });
    const planInput = rowPlan.createEl('textarea', { attr: { rows: '3', placeholder: en ? 'e.g. Daily ops support' : '例如：系统日常使用的运维' } });
    planInput.value = state.plans || '';
    planInput.oninput = () => { state.plans = planInput.value; };

    const rowAction = composer.createDiv({ cls: PLUGIN_ID + '-report-studio-actions' });
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

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={
  normalizeWeeklyReportRecord,
  normalizeWeeklyReportConfig,
  weeklyReportAiStyleInstruction,
  weeklyReportAiPrompt,
  weeklyReportNextSelectedId,
  WEEKLY_REPORT_AI_HISTORY_CHARS
};
