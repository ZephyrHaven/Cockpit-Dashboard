// alarm.js — 全屏提醒运行时、插件级调度服务与驾驶舱闹钟界面。

class AlarmOverlayRuntime {
  constructor(plugin) {
    this.plugin = plugin;
    this.overlay = null;
    this.clockTimer = null;
    this.soundTimer = null;
    this.audioContext = null;
    this.enteredFullscreen = false;
    this.queue = [];
    this.active = null;
  }

  enqueue(payload) {
    if (!payload) return;
    const id = payload.id || ('reminder-' + Date.now());
    if (this.active?.id === id || this.queue.some((item) => item.id === id)) return;
    this.queue.push({ ...payload, id });
    if (!this.active) this._showNext();
  }

  _showNext() {
    const next = this.queue.shift();
    if (!next) return;
    this.active = next;
    const en = next.language === 'en';
    const overlay = document.createElement('div');
    overlay.className = PLUGIN_ID + '-alarm-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', next.title || (en ? 'Alarm' : '闹钟'));

    const ambientA = overlay.createDiv({ cls:PLUGIN_ID + '-alarm-ambient ' + PLUGIN_ID + '-alarm-ambient-a' });
    const ambientB = overlay.createDiv({ cls:PLUGIN_ID + '-alarm-ambient ' + PLUGIN_ID + '-alarm-ambient-b' });
    ambientA.setAttribute('aria-hidden', 'true'); ambientB.setAttribute('aria-hidden', 'true');
    const content = overlay.createDiv({ cls:PLUGIN_ID + '-alarm-ringing' });
    const glyph = content.createDiv({ cls:PLUGIN_ID + '-alarm-glyph' });
    obsidian.setIcon(glyph, next.kind === 'pomodoro' ? 'timer' : 'alarm-clock');
    const clock = content.createDiv({ cls:PLUGIN_ID + '-alarm-clock' });
    const date = content.createDiv({ cls:PLUGIN_ID + '-alarm-date' });
    content.createDiv({ cls:PLUGIN_ID + '-alarm-name', text:next.title || (en ? 'Alarm' : '闹钟') });
    if (next.subtitle) content.createDiv({ cls:PLUGIN_ID + '-alarm-subtitle', text:next.subtitle });
    const actions = content.createDiv({ cls:PLUGIN_ID + '-alarm-actions' });
    if (next.allowSnooze !== false) {
      const snooze = actions.createEl('button', { cls:PLUGIN_ID + '-alarm-action secondary', attr:{type:'button'} });
      obsidian.setIcon(snooze.createSpan(), 'bed-double');
      snooze.createSpan({ text:en ? 'Remind me in 10 minutes' : '稍后提醒 10 分钟' });
      snooze.onclick = () => this.dismiss('snooze');
    }
    const stop = actions.createEl('button', { cls:PLUGIN_ID + '-alarm-action primary', attr:{type:'button'} });
    obsidian.setIcon(stop.createSpan(), 'square');
    stop.createSpan({ text:next.stopLabel || (en ? 'Stop' : '停止') });
    stop.onclick = () => this.dismiss('stop');
    content.createDiv({ cls:PLUGIN_ID + '-alarm-shortcuts', text:next.allowSnooze === false
      ? (en ? 'Return to close' : 'Return 关闭')
      : (en ? 'Space to snooze · Return to stop' : '空格键稍后提醒 · Return 停止') });

    const updateClock = () => {
      const now = new Date();
      clock.textContent = new Intl.DateTimeFormat(en ? 'en-US' : 'zh-CN', { hour:'2-digit', minute:'2-digit', hour12:false }).format(now);
      date.textContent = new Intl.DateTimeFormat(en ? 'en-US' : 'zh-CN', { month:'long', day:'numeric', weekday:'long' }).format(now);
    };
    updateClock();
    this.clockTimer = window.setInterval(updateClock, 1000);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === ' ' && next.allowSnooze !== false) { event.preventDefault(); this.dismiss('snooze'); }
      if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); this.dismiss('stop'); }
    });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this._startSound();
    this._requestFullscreen();
    window.focus?.();
    setTimeout(() => stop.focus(), 20);
    if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(next.title || (en ? 'Alarm' : '闹钟'), { body:next.subtitle || '', silent:false }); } catch (e) {}
    }
  }

  _requestFullscreen() {
    if (document.fullscreenElement || typeof document.documentElement.requestFullscreen !== 'function') return;
    try {
      Promise.resolve(document.documentElement.requestFullscreen({ navigationUI:'hide' }))
        .then(() => { this.enteredFullscreen = true; })
        .catch(() => {});
    } catch (e) {}
  }

  _startSound() {
    const playChime = () => {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) throw new Error('audio-context-unavailable');
        if (!this.audioContext) this.audioContext = new AudioContextCtor();
        const start = this.audioContext.currentTime;
        [0, 0.18, 0.38].forEach((offset, index) => {
          const oscillator = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = [659, 784, 988][index];
          gain.gain.setValueAtTime(0.0001, start + offset);
          gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.28);
          oscillator.connect(gain); gain.connect(this.audioContext.destination);
          oscillator.start(start + offset); oscillator.stop(start + offset + 0.3);
        });
      } catch (e) {
        try { require('electron').shell?.beep?.(); } catch (ignored) {}
      }
    };
    playChime();
    this.soundTimer = window.setInterval(playChime, 2400);
  }

  dismiss(reason = 'stop') {
    const current = this.active;
    clearInterval(this.clockTimer); clearInterval(this.soundTimer);
    this.clockTimer = null; this.soundTimer = null;
    if (this.audioContext) { this.audioContext.close?.().catch?.(() => {}); this.audioContext = null; }
    this.overlay?.remove(); this.overlay = null; this.active = null;
    if (this.enteredFullscreen && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      Promise.resolve(document.exitFullscreen()).catch(() => {});
    }
    this.enteredFullscreen = false;
    // destroy 只是插件卸载时的清理，不能走 onStop/onSnooze 回调，
    // 否则卸载瞬间会误触“开始休息”之类的动作。
    if (reason !== 'destroy') {
      try {
        if (reason === 'snooze') current?.onSnooze?.();
        else current?.onStop?.();
      } catch (e) { console.warn('Cockpit alarm action failed', e); }
    }
    this._showNext();
  }

  destroy() {
    this.queue = [];
    if (this.active) this.dismiss('destroy');
    else {
      clearInterval(this.clockTimer); clearInterval(this.soundTimer);
      this.overlay?.remove(); this.overlay = null;
    }
  }
}

class AlarmService {
  constructor(plugin) {
    this.plugin = plugin;
    this.overlay = new AlarmOverlayRuntime(plugin);
    this.listeners = new Set();
    this.started = false;
    this.ticking = false;
    this.timer = null;
    this.visibilityHandler = null;
    this.focusHandler = null;
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() { this.listeners.forEach((listener) => { try { listener(); } catch (e) {} }); }
  async load() { return normalizeAlarms((await this.plugin.loadData() || {}).alarms); }
  async findForTodo(todoId) { return (await this.load()).find((alarm) => alarm.todoId === todoId) || null; }
  async upsert(rawAlarm) {
    const alarm = normalizeAlarm(rawAlarm);
    if (!alarm || (alarm.scheduleType === 'once' && !alarm.onceAt) || (alarm.scheduleType === 'weekdays' && !alarm.weekdays.length)) throw new Error('invalid-alarm');
    await this.plugin.mutateData((data) => {
      const alarms = normalizeAlarms(data.alarms);
      const index = alarms.findIndex((item) => item.id === alarm.id);
      if (index >= 0) alarms[index] = alarm; else alarms.push(alarm);
      data.alarms = alarms;
    });
    this.notify();
    return alarm;
  }
  async remove(id) {
    let removed = false;
    await this.plugin.mutateData((data) => {
      const alarms = normalizeAlarms(data.alarms);
      const next = alarms.filter((alarm) => alarm.id !== id);
      removed = next.length !== alarms.length; data.alarms = next;
    });
    if (removed) this.notify();
    return removed;
  }
  async toggle(id, enabled) {
    let updated = null;
    await this.plugin.mutateData((data) => {
      const alarms = normalizeAlarms(data.alarms);
      const alarm = alarms.find((item) => item.id === id);
      if (!alarm) return;
      alarm.enabled = !!enabled;
      alarm.snoozedUntil = null;
      if (alarm.enabled && alarm.scheduleType === 'once' && alarm.onceAt && new Date(alarm.onceAt).getTime() <= Date.now()) alarm.enabled = false;
      updated = { ...alarm }; data.alarms = alarms;
    });
    if (updated) this.notify();
    return updated;
  }
  async snooze(id) {
    await this.plugin.mutateData((data) => {
      const alarms = normalizeAlarms(data.alarms);
      const alarm = alarms.find((item) => item.id === id);
      if (alarm) alarm.snoozedUntil = new Date(Date.now() + ALARM_SNOOZE_MS).toISOString();
      data.alarms = alarms;
    });
    this.notify();
  }
  async syncTodos(todos) {
    let changed = false;
    await this.plugin.mutateData((data) => {
      const current = normalizeAlarms(data.alarms);
      const reconciled = reconcileTodoAlarms(current, todos);
      changed = JSON.stringify(current) !== JSON.stringify(reconciled);
      if (changed) data.alarms = reconciled;
    });
    if (changed) this.notify();
    return changed;
  }
  ring(alarm, preview = false) {
    const language = this.plugin.app.workspace.getLeavesOfType?.(VIEW_TYPE)?.[0]?.view?._lang?.() || DEFAULT_LANG;
    this.overlay.enqueue({
      id:(preview ? 'preview-' : '') + alarm.id,
      kind:'alarm', language, title:alarm.name,
      subtitle:preview
        ? (language === 'en' ? 'Full-screen alarm preview' : '全屏闹钟预览')
        : [formatAlarmSchedule(alarm, language), alarm.linkedTodoText ? ((language === 'en' ? 'Task: ' : '待办：') + alarm.linkedTodoText) : ''].filter(Boolean).join(' · '),
      allowSnooze:!preview,
      onSnooze:() => this.snooze(alarm.id).catch((e) => console.warn('Cockpit alarm snooze failed', e))
    });
  }
  showFullscreenReminder(payload) {
    this.overlay.enqueue({ kind:'pomodoro', allowSnooze:false, ...payload });
  }
  async tick(nowValue = Date.now()) {
    if (this.ticking) return;
    this.ticking = true;
    let due = [];
    try {
      await this.plugin.mutateData((data) => {
        const claim = claimDueAlarms(data.alarms, nowValue, ALARM_RECOVERY_WINDOW_MS);
        data.alarms = claim.alarms; due = claim.due;
      });
      if (due.length) { due.forEach((alarm) => this.ring(alarm)); this.notify(); }
    } finally { this.ticking = false; }
  }
  async start() {
    if (this.started) return;
    this.started = true;
    try { await this.tick(); } catch (e) { console.warn('Cockpit alarm initial check failed', e); }
    this.timer = window.setInterval(() => this.tick().catch((e) => console.warn('Cockpit alarm tick failed', e)), 15000);
    this.plugin.registerInterval(this.timer);
    this.visibilityHandler = () => { if (!document.hidden) this.tick().catch((e) => console.warn('Cockpit alarm wake check failed', e)); };
    this.focusHandler = () => this.tick().catch((e) => console.warn('Cockpit alarm focus check failed', e));
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('focus', this.focusHandler);
  }
  stop() {
    this.started = false;
    clearInterval(this.timer); this.timer = null;
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.focusHandler) window.removeEventListener('focus', this.focusHandler);
    this.visibilityHandler = null; this.focusHandler = null;
    this.listeners.clear(); this.overlay.destroy();
  }
}

function alarmInputField(parent, label, input) {
  const field = parent.createDiv({ cls:PLUGIN_ID + '-alarm-editor-field' });
  field.createDiv({ cls:PLUGIN_ID + '-alarm-editor-label', text:label });
  field.appendChild(input);
  return field;
}

function openAlarmEditor(view, alarm, onSaved, linkedTodo) {
  const en = view._lang() === 'en';
  const existing = normalizeAlarm(alarm);
  const overlay = document.createElement('div');
  overlay.className = PLUGIN_ID + '-alarm-editor-backdrop';
  const sheet = overlay.createDiv({ cls:PLUGIN_ID + '-alarm-editor-sheet', attr:{role:'dialog', 'aria-modal':'true'} });
  const header = sheet.createDiv({ cls:PLUGIN_ID + '-alarm-editor-header' });
  header.createEl('h2', { text:existing ? (en ? 'Edit alarm' : '编辑闹钟') : (en ? 'New alarm' : '新建闹钟') });
  const close = header.createEl('button', { text:'×', attr:{type:'button', 'aria-label':en ? 'Close' : '关闭'} });
  const body = sheet.createDiv({ cls:PLUGIN_ID + '-alarm-editor-body' });
  const name = document.createElement('input'); name.type = 'text'; name.maxLength = 80; name.value = existing?.name || linkedTodo?.text || (en ? 'Alarm' : '闹钟');
  alarmInputField(body, en ? 'Name' : '名称', name);
  const schedule = document.createElement('select');
  [['once', en ? 'One time' : '仅一次'], ['daily', en ? 'Daily' : '每天'], ['weekdays', en ? 'Selected weekdays' : '指定星期']]
    .forEach(([value, label]) => schedule.createEl('option', { text:label, attr:{value} }));
  schedule.value = existing?.scheduleType || (linkedTodo ? 'once' : 'daily');
  alarmInputField(body, en ? 'Repeat' : '重复', schedule);
  const linkedDueMs = linkedTodo?.dueDate?.valueOf?.();
  let suggestedDate = Number.isFinite(linkedDueMs) ? new Date(linkedDueMs) : new Date(Date.now() + 3600000);
  if (linkedTodo && !linkedTodo.dueHasTime) suggestedDate.setHours(9, 0, 0, 0);
  if (suggestedDate.getTime() <= Date.now()) {
    suggestedDate = new Date(Date.now() + 3600000);
    suggestedDate.setMinutes(0, 0, 0);
  }
  const initialDate = existing?.onceAt ? new Date(existing.onceAt) : suggestedDate;
  const time = document.createElement('input'); time.type = 'time'; time.value = existing?.time || initialDate.toTimeString().slice(0, 5);
  const timeField = alarmInputField(body, en ? 'Time' : '时间', time);
  const date = document.createElement('input'); date.type = 'date';
  date.value = [initialDate.getFullYear(), String(initialDate.getMonth() + 1).padStart(2, '0'), String(initialDate.getDate()).padStart(2, '0')].join('-');
  const dateField = alarmInputField(body, en ? 'Date' : '日期', date);
  const weekdaysField = body.createDiv({ cls:PLUGIN_ID + '-alarm-editor-field' });
  weekdaysField.createDiv({ cls:PLUGIN_ID + '-alarm-editor-label', text:en ? 'Weekdays' : '星期' });
  const weekdayPicker = weekdaysField.createDiv({ cls:PLUGIN_ID + '-alarm-weekdays' });
  const selected = new Set(existing?.weekdays?.length ? existing.weekdays : [1,2,3,4,5]);
  const labels = en ? ['S','M','T','W','T','F','S'] : ['日','一','二','三','四','五','六'];
  labels.forEach((label, day) => {
    const button = weekdayPicker.createEl('button', { text:label, cls:selected.has(day) ? 'active' : '', attr:{type:'button', 'aria-pressed':String(selected.has(day))} });
    button.onclick = () => { if (selected.has(day)) selected.delete(day); else selected.add(day); button.classList.toggle('active', selected.has(day)); button.setAttribute('aria-pressed', String(selected.has(day))); };
  });
  const note = body.createDiv({ cls:PLUGIN_ID + '-alarm-editor-note', text:en
    ? (linkedTodo ? 'Linked to this task. Completing or deleting the task disables the alarm automatically.' : 'Alarms ring while Obsidian is running. A 10-minute recovery window handles sleep and background timer throttling.')
    : (linkedTodo ? '已关联此待办；完成或删除待办后，闹钟会自动停用。' : '闹钟会在 Obsidian 运行时响铃；电脑休眠或后台计时延迟后，会在 10 分钟内补响。') });
  const error = body.createDiv({ cls:PLUGIN_ID + '-alarm-editor-error' });
  const footer = sheet.createDiv({ cls:PLUGIN_ID + '-alarm-editor-footer' });
  const preview = footer.createEl('button', { text:en ? 'Preview' : '预览', attr:{type:'button'} });
  const save = footer.createEl('button', { cls:'mod-cta', text:en ? 'Save' : '保存', attr:{type:'button'} });
  const syncFields = () => { dateField.style.display = schedule.value === 'once' ? 'grid' : 'none'; weekdaysField.style.display = schedule.value === 'weekdays' ? 'grid' : 'none'; timeField.style.display = 'grid'; };
  schedule.onchange = syncFields; syncFields();
  const draft = () => {
    const onceAt = schedule.value === 'once' ? new Date(date.value + 'T' + time.value + ':00') : null;
    // 只改名称等无关字段时保留 lastTriggeredAt/snoozedUntil；否则刚响完就编辑
    // 会被 10 分钟补跑窗口判定为“漏响”，导致立刻二次响铃。
    let scheduleChanged = true;
    if (existing) {
      scheduleChanged = existing.scheduleType !== schedule.value
        || normalizeAlarmTime(existing.time) !== normalizeAlarmTime(time.value);
      if (!scheduleChanged && schedule.value === 'weekdays') {
        const nextDays = Array.from(selected).sort((a, b) => a - b);
        const prevDays = Array.isArray(existing.weekdays) ? existing.weekdays.slice().sort((a, b) => a - b) : [];
        scheduleChanged = JSON.stringify(nextDays) !== JSON.stringify(prevDays);
      }
      if (!scheduleChanged && schedule.value === 'once') {
        const prevMs = existing.onceAt ? new Date(existing.onceAt).getTime() : NaN;
        scheduleChanged = !onceAt || !Number.isFinite(onceAt.getTime()) || onceAt.getTime() !== prevMs;
      }
    }
    return normalizeAlarm({
      ...existing, id:existing?.id || alarmId(), name:name.value, enabled:existing?.enabled !== false,
      scheduleType:schedule.value, time:time.value, weekdays:Array.from(selected),
      onceAt:onceAt && Number.isFinite(onceAt.getTime()) ? onceAt.toISOString() : null,
      lastTriggeredAt:scheduleChanged ? null : (existing?.lastTriggeredAt || null),
      snoozedUntil:scheduleChanged ? null : (existing?.snoozedUntil || null),
      todoId:existing?.todoId || linkedTodo?.id || '',
      linkedTodoText:linkedTodo?.text || existing?.linkedTodoText || ''
    });
  };
  preview.onclick = () => { const value = draft(); if (value) view._plugin.alarms.ring(value, true); };
  save.onclick = async () => {
    error.textContent = '';
    const value = draft();
    if (!value || (value.scheduleType === 'weekdays' && !value.weekdays.length)) { error.textContent = en ? 'Enter a name and choose at least one weekday.' : '请输入名称，并至少选择一个星期。'; return; }
    if (value.scheduleType === 'once' && (!value.onceAt || new Date(value.onceAt).getTime() <= Date.now())) { error.textContent = en ? 'The one-time alarm must be in the future.' : '仅一次闹钟必须晚于当前时间。'; return; }
    await view._plugin.alarms.upsert(value); closeEditor(); onSaved?.();
  };
  const closeEditor = () => { overlay.remove(); };
  close.onclick = closeEditor;
  overlay.onclick = (event) => { if (event.target === overlay) closeEditor(); };
  sheet.onkeydown = (event) => { if (event.key === 'Escape') closeEditor(); };
  makeCockpitDialogDraggable(sheet, header, { label:en ? 'Drag alarm editor' : '拖动闹钟编辑窗口' });
  document.body.appendChild(overlay); setTimeout(() => name.focus(), 20);
}

async function buildAlarmModule(view, root) {
  const en = view._lang() === 'en';
  const service = view._plugin.alarms;
  const title = root.createDiv({ cls:PLUGIN_ID + '-section-title ' + PLUGIN_ID + '-alarm-title' });
  title.dataset.section = 'alarms-title';
  title.createSpan({ text:view._t('sections.alarms') });
  const add = title.createEl('button', { cls:PLUGIN_ID + '-alarm-add', attr:{type:'button', title:en ? 'New alarm' : '新建闹钟', 'aria-label':en ? 'New alarm' : '新建闹钟'} });
  obsidian.setIcon(add, 'plus');
  const content = root.createDiv({ cls:PLUGIN_ID + '-alarms' });
  content.dataset.section = 'alarms-body';
  const render = async () => {
    const alarms = await service.load();
    content.empty();
    if (!alarms.length) {
      const empty = content.createDiv({ cls:PLUGIN_ID + '-alarm-empty' });
      obsidian.setIcon(empty.createSpan(), 'alarm-clock');
      empty.createDiv({ text:en ? 'No alarms yet' : '还没有闹钟' });
      empty.createEl('button', { text:en ? 'Create alarm' : '创建闹钟', attr:{type:'button'} }).onclick = () => openAlarmEditor(view, null, render);
      return;
    }
    const sorted = alarms.slice().sort((a, b) => (nextAlarmOccurrence(a)?.getTime() || Infinity) - (nextAlarmOccurrence(b)?.getTime() || Infinity));
    sorted.forEach((alarm) => {
      const card = content.createDiv({ cls:PLUGIN_ID + '-alarm-card' + (alarm.enabled ? '' : ' disabled') });
      const main = card.createDiv({ cls:PLUGIN_ID + '-alarm-card-main' });
      main.createDiv({ cls:PLUGIN_ID + '-alarm-card-time', text:alarm.time });
      const meta = main.createDiv({ cls:PLUGIN_ID + '-alarm-card-meta' });
      meta.createDiv({ cls:PLUGIN_ID + '-alarm-card-name', text:alarm.name });
      meta.createDiv({ cls:PLUGIN_ID + '-alarm-card-schedule', text:formatAlarmSchedule(alarm, view._lang()) });
      if (alarm.linkedTodoText) {
        const link = meta.createDiv({ cls:PLUGIN_ID + '-alarm-card-link' });
        obsidian.setIcon(link.createSpan(), 'list-checks');
        link.createSpan({ text:alarm.linkedTodoText });
      }
      const actions = card.createDiv({ cls:PLUGIN_ID + '-alarm-card-actions' });
      const toggle = actions.createEl('input', { attr:{type:'checkbox', title:en ? 'Enable alarm' : '启用闹钟', 'aria-label':en ? 'Enable alarm' : '启用闹钟'} });
      toggle.checked = alarm.enabled; toggle.onchange = async () => { await service.toggle(alarm.id, toggle.checked); render(); };
      const edit = actions.createEl('button', { attr:{type:'button', title:en ? 'Edit' : '编辑', 'aria-label':en ? 'Edit' : '编辑'} }); obsidian.setIcon(edit, 'pencil');
      edit.onclick = () => openAlarmEditor(view, alarm, render);
      const preview = actions.createEl('button', { attr:{type:'button', title:en ? 'Preview' : '预览', 'aria-label':en ? 'Preview' : '预览'} }); obsidian.setIcon(preview, 'play');
      preview.onclick = () => service.ring(alarm, true);
      const remove = actions.createEl('button', { attr:{type:'button', title:en ? 'Delete' : '删除', 'aria-label':en ? 'Delete' : '删除'} }); obsidian.setIcon(remove, 'trash-2');
      remove.onclick = async () => { if (window.confirm(en ? 'Delete this alarm?' : '删除这个闹钟？')) { await service.remove(alarm.id); render(); } };
    });
  };
  add.onclick = (event) => { event.preventDefault(); event.stopPropagation(); openAlarmEditor(view, null, render); };
  view._alarmUnsubscribe?.();
  view._alarmUnsubscribe = service.subscribe(() => render().catch((e) => console.warn('Cockpit alarm render failed', e)));
  await render();
  view._makeModuleCollapsible('alarms', title, content);
  return content;
}
