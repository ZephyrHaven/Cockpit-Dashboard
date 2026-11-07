// 闹钟雾面提醒视图；调度、响铃与队列由 AlarmOverlayRuntime 管理。
function createAlarmReminderOverlay(payload, dismiss) {
  const en = payload.language === 'en';
  const overlay = document.createElement('div');
  overlay.className = PLUGIN_ID + '-alarm-overlay ' + PLUGIN_ID + '-fog-reminder ' + (payload.displayMode === 'half' ? 'is-half-sheet' : 'is-fullscreen');
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.createDiv({ cls:'modal-bg', attr:{'aria-hidden':'true'} });
  const content = overlay.createDiv({ cls:PLUGIN_ID + '-alarm-ringing' });
  content.createDiv({ cls:PLUGIN_ID + '-alarm-eyebrow', text:en ? 'ALARM' : '闹钟提醒' });
  const title = content.createEl('h2', { cls:PLUGIN_ID + '-alarm-name', text:payload.title || (en ? 'Alarm' : '闹钟') });
  title.id = PLUGIN_ID + '-alarm-reminder-title';
  overlay.setAttribute('aria-labelledby', title.id);
  const clock = content.createDiv({ cls:PLUGIN_ID + '-alarm-clock' });
  const date = content.createDiv({ cls:PLUGIN_ID + '-alarm-date' });
  if (payload.subtitle) content.createEl('p', { cls:PLUGIN_ID + '-alarm-subtitle', text:payload.subtitle });
  const actions = content.createDiv({ cls:PLUGIN_ID + '-alarm-actions' });
  const stop = actions.createEl('button', { cls:PLUGIN_ID + '-alarm-action primary', text:payload.stopLabel || (en ? 'Stop alarm' : '停止闹钟'), attr:{type:'button'} });
  stop.onclick = () => dismiss('stop');
  let snooze = null;
  if (payload.allowSnooze !== false) {
    snooze = actions.createEl('button', { cls:PLUGIN_ID + '-alarm-action secondary', text:en ? 'Snooze 10 minutes' : '稍后提醒 10 分钟', attr:{type:'button'} });
    snooze.onclick = () => dismiss('snooze');
  }
  content.createDiv({ cls:PLUGIN_ID + '-alarm-shortcuts', text:payload.allowSnooze === false
    ? (en ? 'Enter or Esc to close' : 'Enter 或 Esc 关闭')
    : (en ? 'Space to snooze · Enter to stop' : '空格稍后提醒 · Enter 停止') });
  const updateClock = () => {
    const now = new Date();
    clock.textContent = new Intl.DateTimeFormat(en ? 'en-US' : 'zh-CN', {hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
    date.textContent = new Intl.DateTimeFormat(en ? 'en-US' : 'zh-CN', {month:'long',day:'numeric',weekday:'long'}).format(now);
  };
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const last = snooze || stop;
      if (event.shiftKey && document.activeElement === stop) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); stop.focus(); }
    } else if (event.key === ' ' && snooze) { event.preventDefault(); dismiss('snooze'); }
    else if (event.key === 'Enter') { event.preventDefault(); dismiss(event.target === snooze ? 'snooze' : 'stop'); }
    else if (event.key === 'Escape') { event.preventDefault(); dismiss('stop'); }
  });
  return {overlay,stop,snooze,updateClock};
}
