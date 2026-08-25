// scheduled-tasks.js — 插件级定时任务服务与仪表盘模块。
// 配置保存在 data.json；审计日志写入插件 logs/，不创建新的 _data Markdown 文件。

const SCHEDULED_TASK_LIMIT = 50;
const SCHEDULED_LOG_LIMIT = 500;
const SCHEDULED_LOG_MAX_BYTES = 5 * 1024 * 1024;

function scheduledTaskId() {
  try { return 'job-' + globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16); } catch (e) {}
  return 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function normalizeScheduledTasks(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, SCHEDULED_TASK_LIMIT).map((item) => {
    const id = String(item?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const name = String(item?.name || '').trim().slice(0, 80);
    if (!id || seen.has(id) || !name) return null;
    seen.add(id);
    const kind = ['obsidian-command','toolbar-action'].includes(item?.kind) ? item.kind : 'shell';
    const command = String(item?.command || '').trim().slice(0, 12000);
    if (!command) return null;
    const scheduleType = ['interval','daily','weekly'].includes(item?.schedule?.type) ? item.schedule.type : 'daily';
    const intervalMinutes = Math.max(1, Math.min(10080, Math.round(Number(item?.schedule?.intervalMinutes) || 60)));
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(item?.schedule?.time || '') ? item.schedule.time : '09:00';
    const weekdays = Array.from(new Set((Array.isArray(item?.schedule?.weekdays) ? item.schedule.weekdays : [1,2,3,4,5])
      .map(Number).filter((day) => day >= 0 && day <= 6))).sort();
    const createdAt = Number.isFinite(Date.parse(item?.createdAt || '')) ? new Date(item.createdAt).toISOString() : new Date().toISOString();
    return {
      id, name, kind, command,
      enabled:item?.enabled === true && (kind !== 'shell' || item?.trusted === true),
      trusted:item?.trusted === true,
      schedule:{ type:scheduleType, intervalMinutes, time, weekdays:weekdays.length ? weekdays : [1,2,3,4,5] },
      missedPolicy:item?.missedPolicy === 'skip' ? 'skip' : 'run-once',
      timeoutSeconds:Math.max(5, Math.min(3600, Math.round(Number(item?.timeoutSeconds) || 300))),
      createdAt,
      updatedAt:Number.isFinite(Date.parse(item?.updatedAt || '')) ? new Date(item.updatedAt).toISOString() : createdAt,
      lastScheduledAt:Number.isFinite(Date.parse(item?.lastScheduledAt || '')) ? new Date(item.lastScheduledAt).toISOString() : '',
      lastRunAt:Number.isFinite(Date.parse(item?.lastRunAt || '')) ? new Date(item.lastRunAt).toISOString() : '',
      lastStatus:['success','failed','skipped'].includes(item?.lastStatus) ? item.lastStatus : '',
      lastDurationMs:Math.max(0, Math.round(Number(item?.lastDurationMs) || 0)),
      lastError:String(item?.lastError || '').slice(0, 400)
    };
  }).filter(Boolean);
}

function scheduledToolbarActions(view) {
  if (!view) return [];
  const blocked = new Set(['search','more']);
  const builtins = (view._toolbarButtons?.() || [])
    .filter((button) => button?.action && !blocked.has(button.action))
    .map((button) => ({ id:button.action, label:button.label || button.action, custom:false }));
  const custom = (view._customToolbarButtons || [])
    .filter((button) => button?.id && button?.label)
    .map((button) => ({ id:'custom:' + button.id, label:button.label, custom:true, type:button.type }));
  const seen = new Set();
  return [...builtins, ...custom].filter((action) => !seen.has(action.id) && (seen.add(action.id), true));
}

function scheduledSlot(task, nowValue = Date.now()) {
  const now = window.moment(nowValue);
  const schedule = task?.schedule || {};
  if (schedule.type === 'interval') {
    const base = window.moment(task.lastScheduledAt || task.createdAt);
    const step = Math.max(1, Number(schedule.intervalMinutes) || 60);
    const elapsed = now.diff(base, 'minutes');
    return elapsed >= step ? base.clone().add(Math.floor(elapsed / step) * step, 'minutes') : null;
  }
  if (schedule.type === 'daily') {
    const [hour, minute] = String(schedule.time || '09:00').split(':').map(Number);
    const slot = now.clone().startOf('day').hour(hour).minute(minute);
    if (slot.isAfter(now)) slot.subtract(1, 'day');
    return slot;
  }
  const allowed = new Set(schedule.weekdays || []);
  const [hour, minute] = String(schedule.time || '09:00').split(':').map(Number);
  for (let back = 0; back < 8; back++) {
    const slot = now.clone().startOf('day').subtract(back, 'day').hour(hour).minute(minute);
    if (allowed.has(slot.day()) && !slot.isAfter(now)) return slot;
  }
  return null;
}

function nextScheduledRun(task, nowValue = Date.now()) {
  const now = window.moment(nowValue);
  const schedule = task?.schedule || {};
  if (schedule.type === 'interval') {
    const base = window.moment(task.lastScheduledAt || task.createdAt);
    const step = Math.max(1, Number(schedule.intervalMinutes) || 60);
    const elapsed = Math.max(0, now.diff(base, 'minutes'));
    base.add(Math.floor(elapsed / step + 1) * step, 'minutes');
    return base;
  }
  const [hour, minute] = String(schedule.time || '09:00').split(':').map(Number);
  if (schedule.type === 'daily') {
    const next = now.clone().startOf('day').hour(hour).minute(minute);
    if (!next.isAfter(now)) next.add(1, 'day');
    return next;
  }
  const allowed = new Set(schedule.weekdays || []);
  for (let forward = 0; forward < 8; forward++) {
    const next = now.clone().startOf('day').add(forward, 'day').hour(hour).minute(minute);
    if (allowed.has(next.day()) && next.isAfter(now)) return next;
  }
  return null;
}

function scheduleLabel(task, lang = 'zh') {
  const en = lang === 'en';
  const schedule = task.schedule;
  if (schedule.type === 'interval') return en ? `Every ${schedule.intervalMinutes} min` : `每 ${schedule.intervalMinutes} 分钟`;
  if (schedule.type === 'daily') return en ? `Daily at ${schedule.time}` : `每天 ${schedule.time}`;
  const labels = en ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : ['日','一','二','三','四','五','六'];
  return (en ? 'Weekly ' : '每周') + schedule.weekdays.map((day) => labels[day]).join('、') + ' · ' + schedule.time;
}

class ScheduledTaskService {
  constructor(plugin) { this.plugin = plugin; this.running = new Set(); this.listeners = new Set(); this.started = false; }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() { this.listeners.forEach((listener) => { try { listener(); } catch (e) {} }); }
  async load() { return normalizeScheduledTasks((await this.plugin.loadData())?.scheduledTasks); }
  async save(tasks) {
    const normalized = normalizeScheduledTasks(tasks);
    await this.plugin.mutateData((data) => { data.scheduledTasks = normalized; });
    this.notify();
    return normalized;
  }
  async upsert(task) {
    const normalizedTask = normalizeScheduledTasks([task])[0];
    if (!normalizedTask) throw new Error('invalid-task');
    let result = normalizedTask;
    await this.plugin.mutateData((data) => {
      const tasks = normalizeScheduledTasks(data.scheduledTasks);
      const index = tasks.findIndex((item) => item.id === normalizedTask.id);
      if (index >= 0) tasks[index] = normalizedTask;
      else tasks.push(normalizedTask);
      data.scheduledTasks = normalizeScheduledTasks(tasks);
      result = data.scheduledTasks.find((item) => item.id === normalizedTask.id) || normalizedTask;
    });
    this.notify();
    return result;
  }
  async remove(id) {
    const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!safeId) return false;
    let removed = false;
    await this.plugin.mutateData((data) => {
      const tasks = normalizeScheduledTasks(data.scheduledTasks);
      const next = tasks.filter((item) => item.id !== safeId);
      removed = next.length !== tasks.length;
      data.scheduledTasks = next;
    });
    if (removed) this.notify();
    return removed;
  }
  async toggle(id) {
    const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    let updated = null;
    await this.plugin.mutateData((data) => {
      const tasks = normalizeScheduledTasks(data.scheduledTasks);
      const current = tasks.find((item) => item.id === safeId);
      if (!current) return;
      current.enabled = !current.enabled && (current.kind !== 'shell' || current.trusted === true);
      current.updatedAt = new Date().toISOString();
      updated = { ...current };
      data.scheduledTasks = tasks;
    });
    if (updated) this.notify();
    return updated;
  }
  start() {
    if (this.started) return;
    this.started = true;
    const timer = window.setInterval(() => this.tick().catch((e) => console.warn('[Cockpit scheduler]', e)), 30000);
    this.plugin.registerInterval(timer);
    this.plugin.app.workspace.onLayoutReady(() => this.tick().catch((e) => console.warn('[Cockpit scheduler]', e)));
  }
  stop() { this.started = false; this.listeners.clear(); }
  _toolbarView() {
    return this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE)
      .map((leaf) => leaf?.view)
      .find((view) => typeof view?._doAction === 'function') || null;
  }
  async runToolbarAction(actionId) {
    let view = this._toolbarView();
    if (!view && typeof this.plugin._open === 'function') {
      await this.plugin._open();
      view = this._toolbarView();
    }
    if (!view) throw new Error('Cockpit dashboard is not available.');
    // 每次运行前读取最新配置。定时任务只保存稳定 action ID，按钮改名或脚本更新后自动使用新内容。
    const data = await this.plugin.loadData() || {};
    view._customToolbarButtons = normalizeCustomToolbarButtons(data.customToolbarButtons);
    view._deletedToolbarActions = new Set((Array.isArray(data.deletedToolbarActions) ? data.deletedToolbarActions : [])
      .filter((action) => ['hermes','cockpit-h5','work-log'].includes(action)));
    if (view._storage) view._toolbarCmds = await view._storage.loadToolbarCommands(view._defaultToolbarCommands());
    const action = scheduledToolbarActions(view).find((item) => item.id === actionId);
    if (!action) throw new Error('Toolbar action no longer exists: ' + actionId);
    const result = await Promise.resolve(view._doAction(action.id));
    if (result?.ok === false) {
      const error = new Error(result.error || 'Toolbar action failed.');
      error.stdout = result.stdout || '';
      error.stderr = result.stderr || result.error || '';
      error.code = result.exitCode;
      throw error;
    }
    return { stdout:'Toolbar action executed: ' + action.label + ' (' + action.id + ')', stderr:'' };
  }
  async tick(nowValue = Date.now()) {
    const now = window.moment(nowValue);
    const claimed = [];
    const skippedClaims = [];
    await this.plugin.mutateData((data) => {
      const tasks = normalizeScheduledTasks(data.scheduledTasks);
      tasks.forEach((task) => {
        if (!task.enabled || this.running.has(task.id)) return;
        const slot = scheduledSlot(task, now.valueOf());
        if (!slot || (task.lastScheduledAt && !slot.isAfter(window.moment(task.lastScheduledAt)))) return;
        task.lastScheduledAt = slot.toISOString();
        const lateMinutes = now.diff(slot, 'minutes');
        if (task.missedPolicy === 'skip' && lateMinutes > 2) {
          task.lastStatus = 'skipped';
          skippedClaims.push({ task:{ ...task }, slot:slot.toISOString(), skip:true });
        } else claimed.push({ task:{ ...task }, slot:slot.toISOString(), skip:false });
      });
      data.scheduledTasks = tasks;
    });
    for (const claim of skippedClaims) await this.appendLog({ task:claim.task, trigger:'schedule', scheduledAt:claim.slot, status:'skipped', durationMs:0, stdout:'', stderr:'Missed run skipped by policy.' });
    for (const claim of claimed) this.runTask(claim.task.id, { trigger:'schedule', scheduledAt:claim.slot }).catch((e) => console.warn('[Cockpit scheduler run]', e));
    if (claimed.length || skippedClaims.length) this.notify();
  }
  async runTask(id, options = {}) {
    if (this.running.has(id)) throw new Error('task-already-running');
    const task = (await this.load()).find((entry) => entry.id === id);
    if (!task) throw new Error('task-not-found');
    if (options.trigger === 'schedule' && !task.enabled) return false;
    if (task.kind === 'shell' && !task.trusted) throw new Error('shell-task-not-trusted');
    if (task.kind === 'shell' && this.plugin.app.isMobile) throw new Error('desktop-only');
    const startedAt = Date.now();
    this.running.add(id); this.notify();
    let status = 'success', stdout = '', stderr = '', exitCode = 0;
    try {
      if (task.kind === 'obsidian-command') {
        const ok = this.plugin.app.commands.executeCommandById(task.command);
        if (ok === false) throw new Error('Command is not available.');
        stdout = 'Command executed: ' + task.command;
      } else if (task.kind === 'toolbar-action') {
        const result = await this.runToolbarAction(task.command);
        stdout = result.stdout; stderr = result.stderr;
      } else {
        const result = await new Promise((resolve, reject) => {
          const { execFile } = require('child_process');
          execFile('/bin/zsh', ['-lc', task.command], {
            cwd:this.plugin.app.vault.adapter.getBasePath(), timeout:task.timeoutSeconds * 1000, maxBuffer:1024 * 1024
          }, (error, out, err) => error ? reject(Object.assign(error, { stdout:out, stderr:err })) : resolve({ stdout:out, stderr:err }));
        });
        stdout = result.stdout; stderr = result.stderr;
      }
    } catch (error) {
      status = 'failed'; stdout = error?.stdout || ''; stderr = error?.stderr || error?.message || String(error);
      exitCode = typeof error?.code === 'number' ? error.code : 'unknown';
    }
    const durationMs = Date.now() - startedAt;
    try {
      await this.appendLog({ task, trigger:options.trigger || 'manual', scheduledAt:options.scheduledAt || '', status, durationMs, stdout, stderr, exitCode });
      await this.plugin.mutateData((data) => {
        const tasks = normalizeScheduledTasks(data.scheduledTasks);
        const current = tasks.find((entry) => entry.id === id);
        if (!current) return;
        current.lastRunAt = new Date().toISOString(); current.lastStatus = status; current.lastDurationMs = durationMs;
        current.lastError = status === 'failed' ? String(stderr).slice(0, 400) : '';
        data.scheduledTasks = tasks;
      });
    } finally {
      this.running.delete(id); this.notify();
    }
    return status === 'success';
  }
  logPath() {
    const path = require('path');
    return path.join(this.plugin.app.vault.adapter.getBasePath(), this.plugin.app.vault.configDir, 'plugins', PLUGIN_ID, 'logs', 'scheduled-tasks.jsonl');
  }
  async appendLog(entry) {
    if (this.plugin.app.isMobile) return;
    try {
      const fs = require('fs'); const path = require('path'); const file = this.logPath();
      fs.mkdirSync(path.dirname(file), { recursive:true });
      let rows = [];
      try { rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch (e) {}
      const sanitize = (value) => { const text = String(value || '').trim(); return text.length > 12000 ? text.slice(0, 12000) + '\n… (truncated)' : text; };
      rows.push(JSON.stringify({ runId:scheduledTaskId(), timestamp:new Date().toISOString(), taskId:entry.task.id, name:entry.task.name,
        kind:entry.task.kind, trigger:entry.trigger, scheduledAt:entry.scheduledAt || '', status:entry.status, exitCode:entry.exitCode ?? '',
        durationMs:entry.durationMs || 0, stdout:sanitize(entry.stdout), stderr:sanitize(entry.stderr) }));
      rows = rows.slice(-SCHEDULED_LOG_LIMIT);
      while (Buffer.byteLength(rows.join('\n'), 'utf8') > SCHEDULED_LOG_MAX_BYTES && rows.length > 1) rows.shift();
      fs.writeFileSync(file, rows.join('\n') + '\n', 'utf8');
    } catch (e) { console.warn('[Cockpit scheduled task log]', e); }
  }
  readLogs() {
    if (this.plugin.app.isMobile) return [];
    try { return require('fs').readFileSync(this.logPath(), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)).reverse(); } catch (e) { return []; }
  }
  async clearLogs() {
    if (this.plugin.app.isMobile) return false;
    try {
      const fs = require('fs'); const path = require('path'); const file = this.logPath();
      fs.mkdirSync(path.dirname(file), { recursive:true });
      fs.writeFileSync(file, '', 'utf8');
      return true;
    } catch (e) {
      console.warn('[Cockpit scheduled task log clear]', e);
      return false;
    }
  }
}

function openScheduledTaskLogs(view) {
  const en = view._lang() === 'en';
  const overlay = document.createElement('div'); overlay.className = PLUGIN_ID + '-scheduler-backdrop';
  const panel = overlay.createDiv({ cls:PLUGIN_ID + '-scheduler-dialog logs' });
  const head = panel.createDiv({ cls:PLUGIN_ID + '-scheduler-dialog-head' });
  head.createDiv({ cls:PLUGIN_ID + '-scheduler-dialog-title', text:en ? 'Scheduled task audit log' : '定时任务审计日志' });
  const controls = head.createDiv({ cls:PLUGIN_ID + '-scheduler-dialog-controls' });
  const clear = controls.createEl('button', { cls:'danger', text:en ? 'Clear logs' : '清除日志', attr:{type:'button'} });
  const close = controls.createEl('button', { attr:{type:'button','aria-label':en?'Close':'关闭'} }); obs.setIcon(close,'x'); close.onclick=()=>overlay.remove();
  const list = panel.createDiv({ cls:PLUGIN_ID + '-scheduler-log-list' });
  const renderLogs = () => {
    list.empty();
    const logs = view._plugin.scheduledTasks.readLogs();
    clear.disabled = !logs.length || view.app.isMobile;
    if (!logs.length) list.createDiv({ cls:PLUGIN_ID+'-scheduler-empty', text:en ? 'No run records yet.' : '暂无运行记录。' });
    logs.forEach((entry) => {
      const card = list.createDiv({ cls:PLUGIN_ID+'-scheduler-log-card '+entry.status });
      card.createDiv({ cls:PLUGIN_ID+'-scheduler-log-title', text:entry.name + ' · ' + entry.status });
      card.createDiv({ cls:PLUGIN_ID+'-scheduler-log-meta', text:window.moment(entry.timestamp).format('YYYY-MM-DD HH:mm:ss') + ' · ' + entry.trigger + ' · ' + entry.durationMs + ' ms' });
      if (entry.stdout) card.createEl('pre',{text:'stdout\n'+entry.stdout});
      if (entry.stderr) card.createEl('pre',{text:'stderr\n'+entry.stderr});
    });
  };
  clear.onclick = async () => {
    if (!window.confirm(en ? 'Clear all scheduled task audit logs? This cannot be undone.' : '确定清除全部定时任务审计日志吗？此操作无法撤销。')) return;
    clear.disabled = true;
    const ok = await view._plugin.scheduledTasks.clearLogs();
    if (!ok) new obs.Notice(en ? 'Could not clear the audit logs.' : '审计日志清除失败。');
    renderLogs();
  };
  makeCockpitDialogDraggable(panel, head, { label:en ? 'Drag audit log window' : '拖动审计日志窗口' });
  renderLogs();
  overlay.onclick=(event)=>{if(event.target===overlay)overlay.remove();};
  overlay.addEventListener('keydown',(event)=>{if(event.key==='Escape'){event.preventDefault();overlay.remove();}});
  document.body.appendChild(overlay);
}

function openScheduledTaskEditor(view, existing) {
  const en = view._lang() === 'en';
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : { id:scheduledTaskId(), name:'', kind:'obsidian-command', command:'', enabled:true, trusted:false,
    schedule:{type:'daily',intervalMinutes:60,time:'09:00',weekdays:[1,2,3,4,5]}, missedPolicy:'run-once', timeoutSeconds:300, createdAt:new Date().toISOString() };
  const overlay=document.createElement('div'); overlay.className=PLUGIN_ID+'-scheduler-backdrop';
  const panel=overlay.createDiv({cls:PLUGIN_ID+'-scheduler-dialog'}); const head=panel.createDiv({cls:PLUGIN_ID+'-scheduler-dialog-head'});
  head.createDiv({cls:PLUGIN_ID+'-scheduler-dialog-title',text:existing?(en?'Edit scheduled task':'编辑定时任务'):(en?'New scheduled task':'新建定时任务')});
  const close=head.createEl('button',{attr:{type:'button','aria-label':en?'Close':'关闭'}}); obs.setIcon(close,'x'); close.onclick=()=>overlay.remove();
  makeCockpitDialogDraggable(panel, head, { label:en ? 'Drag scheduled task editor' : '拖动定时任务编辑窗口' });
  const field=(label)=>{const wrap=panel.createDiv({cls:PLUGIN_ID+'-scheduler-field'});wrap.createDiv({cls:PLUGIN_ID+'-scheduler-label',text:label});return wrap;};
  const name=field(en?'Name':'名称').createEl('input',{attr:{type:'text',maxlength:'80',placeholder:en?'e.g. Daily backup':'例如：每日备份'}}); name.value=draft.name;
  const kind=field(en?'Task type':'任务类型').createEl('select'); kind.createEl('option',{text:en?'Toolbar action':'Toolbar 动作',attr:{value:'toolbar-action'}}); kind.createEl('option',{text:en?'Obsidian command':'Obsidian 命令',attr:{value:'obsidian-command'}}); kind.createEl('option',{text:en?'Shell command (desktop)':'Shell 命令（仅桌面端）',attr:{value:'shell'}}); kind.value=draft.kind;
  const commandWrap=field(en?'Command':'命令'); const command=commandWrap.createEl('textarea',{attr:{rows:'5',maxlength:'12000'}}); command.value=draft.command;
  const commandPicker=commandWrap.createEl('select'); commandPicker.createEl('option',{text:en?'Choose an app command…':'选择应用命令…',attr:{value:''}});
  (view.app.commands.listCommands?.()||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach((item)=>commandPicker.createEl('option',{text:item.name,attr:{value:item.id}}));
  commandPicker.value=draft.kind==='obsidian-command'?draft.command:''; commandPicker.onchange=()=>{if(commandPicker.value)command.value=commandPicker.value;};
  const toolbarPicker=commandWrap.createEl('select'); toolbarPicker.createEl('option',{text:en?'Choose a Toolbar action…':'选择 Toolbar 动作…',attr:{value:''}});
  const toolbarActions=scheduledToolbarActions(view); const builtinGroup=toolbarPicker.createEl('optgroup',{attr:{label:en?'Built-in buttons':'内置按钮'}}); const customGroup=toolbarPicker.createEl('optgroup',{attr:{label:en?'Custom buttons':'自定义按钮'}});
  toolbarActions.forEach((action)=>(action.custom?customGroup:builtinGroup).createEl('option',{text:action.label,attr:{value:action.id}}));
  if(draft.kind==='toolbar-action'&&draft.command&&!toolbarActions.some((action)=>action.id===draft.command))toolbarPicker.createEl('option',{text:(en?'Unavailable: ':'已失效：')+draft.command,attr:{value:draft.command,disabled:'disabled'}});
  toolbarPicker.value=draft.kind==='toolbar-action'?draft.command:''; toolbarPicker.onchange=()=>{if(toolbarPicker.value)command.value=toolbarPicker.value;};
  const scheduleType=field(en?'Schedule':'运行计划').createEl('select'); [['interval',en?'Interval':'按间隔'],['daily',en?'Daily':'每天'],['weekly',en?'Weekly':'每周']].forEach(([value,label])=>scheduleType.createEl('option',{text:label,attr:{value}})); scheduleType.value=draft.schedule.type;
  const interval=field(en?'Interval minutes':'间隔分钟数').createEl('input',{attr:{type:'number',min:'1',max:'10080'}}); interval.value=String(draft.schedule.intervalMinutes);
  const time=field(en?'Run time':'运行时间').createEl('input',{attr:{type:'time'}}); time.value=draft.schedule.time;
  const days=field(en?'Weekdays (0=Sun … 6=Sat)':'星期（0=周日 … 6=周六）').createEl('input',{attr:{type:'text',placeholder:'1,2,3,4,5'}}); days.value=draft.schedule.weekdays.join(',');
  const missed=field(en?'After the app was closed':'应用关闭期间错过后').createEl('select'); missed.createEl('option',{text:en?'Run once on next launch':'下次启动补跑一次',attr:{value:'run-once'}}); missed.createEl('option',{text:en?'Skip missed runs':'跳过错过的运行',attr:{value:'skip'}}); missed.value=draft.missedPolicy;
  const trusted=field(en?'Shell permission':'Shell 权限').createEl('label',{cls:PLUGIN_ID+'-scheduler-check'}); const trustBox=trusted.createEl('input',{attr:{type:'checkbox'}}); trustBox.checked=draft.trusted; trusted.createSpan({text:en?'I understand this command can change files and system data.':'我了解此命令可能修改文件与系统数据。'});
  const enabled=field(en?'Status':'状态').createEl('label',{cls:PLUGIN_ID+'-scheduler-check'}); const enabledBox=enabled.createEl('input',{attr:{type:'checkbox'}}); enabledBox.checked=draft.enabled; enabled.createSpan({text:en?'Enable this schedule':'启用此计划'});
  const error=panel.createDiv({cls:PLUGIN_ID+'-scheduler-error'}); const footer=panel.createDiv({cls:PLUGIN_ID+'-scheduler-footer'});
  if(existing){const remove=footer.createEl('button',{cls:'danger',text:en?'Delete':'删除',attr:{type:'button'}});remove.onclick=async()=>{if(!window.confirm(en?'Delete this scheduled task?':'删除这个定时任务？'))return;await view._plugin.scheduledTasks.remove(draft.id);overlay.remove();};}
  const cancel=footer.createEl('button',{text:en?'Cancel':'取消',attr:{type:'button'}});cancel.onclick=()=>overlay.remove(); const save=footer.createEl('button',{cls:'primary',text:en?'Save':'保存',attr:{type:'button'}});
  const syncVisibility=()=>{const shell=kind.value==='shell';const obsidianCommand=kind.value==='obsidian-command';command.style.display=shell?'':'none';commandPicker.style.display=obsidianCommand?'':'none';toolbarPicker.style.display=kind.value==='toolbar-action'?'':'none';interval.parentElement.style.display=scheduleType.value==='interval'?'':'none';time.parentElement.style.display=scheduleType.value==='interval'?'none':'';days.parentElement.style.display=scheduleType.value==='weekly'?'':'none';trusted.parentElement.style.display=shell?'':'none';}; kind.onchange=syncVisibility;scheduleType.onchange=syncVisibility;syncVisibility();
  save.onclick=async()=>{error.setText('');const selectedCommand=kind.value==='shell'?command.value.trim():(kind.value==='toolbar-action'?toolbarPicker.value:commandPicker.value);const task={...draft,name:name.value.trim(),kind:kind.value,command:selectedCommand,enabled:enabledBox.checked,trusted:trustBox.checked,schedule:{type:scheduleType.value,intervalMinutes:Number(interval.value),time:time.value,weekdays:days.value.split(',').map(Number)},missedPolicy:missed.value,updatedAt:new Date().toISOString()};if(!task.name||!task.command){error.setText(en?'Name and action are required.':'名称和执行动作不能为空。');return;}if(task.kind==='obsidian-command'&&!commandPicker.value){error.setText(en?'Choose an available Obsidian command.':'请选择一个可用的 Obsidian 命令。');return;}if(task.kind==='toolbar-action'&&!toolbarActions.some((action)=>action.id===toolbarPicker.value)){error.setText(en?'Choose an available Toolbar action.':'请选择一个当前可用的 Toolbar 动作。');return;}if(task.kind==='shell'&&task.enabled&&!task.trusted){error.setText(en?'Confirm Shell permission before enabling.':'启用 Shell 任务前请确认权限。');return;}save.disabled=true;try{await view._plugin.scheduledTasks.upsert(task);overlay.remove();}catch(e){error.setText((en?'Could not save: ':'保存失败：')+(e?.message||e));save.disabled=false;}};
  overlay.onclick=(event)=>{if(event.target===overlay)overlay.remove();};overlay.addEventListener('keydown',(event)=>{if(event.key==='Escape'){event.preventDefault();overlay.remove();}});document.body.appendChild(overlay);setTimeout(()=>name.focus(),20);
}

function buildScheduledTasksModule(view, root) {
  const en=view._lang()==='en'; const title=root.createDiv({cls:PLUGIN_ID+'-section-title',text:en?'Scheduled tasks':'定时任务'});title.dataset.section='scheduled-tasks-title';
  const body=root.createDiv({cls:PLUGIN_ID+'-scheduler'});body.dataset.section='scheduled-tasks-body';
  const render=async()=>{body.empty();const tasks=await view._plugin.scheduledTasks.load();const top=body.createDiv({cls:PLUGIN_ID+'-scheduler-summary'});top.createDiv({cls:PLUGIN_ID+'-scheduler-summary-text',text:en?`${tasks.filter(t=>t.enabled).length} enabled · ${tasks.length} total`:`已启用 ${tasks.filter(t=>t.enabled).length} 项 · 共 ${tasks.length} 项`});const controls=top.createDiv({cls:PLUGIN_ID+'-scheduler-controls'});const logs=controls.createEl('button',{text:en?'Logs':'审计日志',attr:{type:'button'}});logs.onclick=()=>openScheduledTaskLogs(view);const add=controls.createEl('button',{cls:'primary',text:'+ '+(en?'New task':'新建任务'),attr:{type:'button'}});add.onclick=()=>openScheduledTaskEditor(view);
    if(!tasks.length)body.createDiv({cls:PLUGIN_ID+'-scheduler-empty',text:en?'No scheduled tasks. Automate Toolbar actions, app commands, or desktop Shell commands.':'暂无定时任务。你可以自动运行 Toolbar 动作、应用命令或桌面端 Shell 命令。'});
    const list=body.createDiv({cls:PLUGIN_ID+'-scheduler-list'});tasks.forEach((task)=>{const row=list.createDiv({cls:PLUGIN_ID+'-scheduler-row'});const main=row.createDiv({cls:PLUGIN_ID+'-scheduler-main'});const name=main.createEl('button',{cls:PLUGIN_ID+'-scheduler-name',text:task.name,attr:{type:'button'}});name.onclick=()=>openScheduledTaskEditor(view,task);const kindLabel=task.kind==='shell'?'Shell':(task.kind==='toolbar-action'?'Toolbar':'App');main.createDiv({cls:PLUGIN_ID+'-scheduler-meta',text:scheduleLabel(task,view._lang())+' · '+kindLabel});const next=nextScheduledRun(task);main.createDiv({cls:PLUGIN_ID+'-scheduler-next',text:task.enabled&&next?(en?'Next: ':'下次：')+next.format('MM-DD HH:mm'):(en?'Paused':'已暂停')});const status=row.createSpan({cls:PLUGIN_ID+'-scheduler-status '+(task.lastStatus||'idle'),text:task.lastStatus||(en?'Not run':'未运行')});const toggle=row.createEl('button',{cls:PLUGIN_ID+'-scheduler-icon-btn',attr:{type:'button','aria-label':task.enabled?(en?'Pause':'暂停'):(en?'Enable':'启用')}});obs.setIcon(toggle,task.enabled?'pause':'play');toggle.onclick=async()=>{if(task.kind==='shell'&&!task.trusted){new obs.Notice(en?'Edit the task and confirm Shell permission first.':'请先编辑任务并确认 Shell 权限。');return;}await view._plugin.scheduledTasks.toggle(task.id);};const run=row.createEl('button',{cls:PLUGIN_ID+'-scheduler-run',text:view._plugin.scheduledTasks.running.has(task.id)?(en?'Running…':'运行中…'):(en?'Run now':'立即运行'),attr:{type:'button'}});run.disabled=view._plugin.scheduledTasks.running.has(task.id)||view.app.isMobile&&task.kind==='shell';run.onclick=async()=>{run.disabled=true;run.setText(en?'Running…':'运行中…');try{const ok=await view._plugin.scheduledTasks.runTask(task.id,{trigger:'manual'});new obs.Notice(ok?(en?'Task succeeded.':'任务运行成功。'):(en?'Task failed. Check the audit log.':'任务运行失败，请查看审计日志。'));}catch(error){new obs.Notice((en?'Could not run task: ':'无法运行任务：')+(error?.message||error));}};});};
  view._scheduledTasksUnsubscribe?.();view._scheduledTasksUnsubscribe=view._plugin.scheduledTasks.subscribe(()=>render().catch((e)=>console.warn('[Cockpit scheduler UI]',e)));render();view._makeModuleCollapsible('scheduledTasks',title,body);return render;
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={normalizeScheduledTasks,scheduledSlot,nextScheduledRun,scheduleLabel,scheduledToolbarActions};
