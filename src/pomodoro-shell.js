// 番茄钟外壳：长条设置、简洁计时与闲置圆点；计时和持久化由 pomodoro.js 管理。
const POMODORO_MAX_MINUTES = 120;
const POMODORO_IDLE_MS = 12000;
const POMODORO_MIN_WIDTH = 216;

function pomodoroDuration(value, fallback = 25) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(POMODORO_MAX_MINUTES, Math.max(1, Math.round(number))) : fallback;
}

function createPomodoroShell(PID, isMobile, language) {
  const label = (zh, en) => language() === 'en' ? en : zh;
  const floatEl = document.createElement('div');
  floatEl.className = PID + '-pomodoro ' + PID + '-pomo-elastic';
  if (isMobile) floatEl.classList.add(PID + '-pomodoro-mobile');
  floatEl.setAttribute('role', 'region');
  const header = floatEl.createDiv({ cls:PID + '-pomo-header' });
  const leftResizeHandle = header.createEl('button', { cls:PID + '-pomo-stretch ' + PID + '-pomo-stretch-left', attr:{type:'button', role:'slider', 'aria-valuemin':'1', 'aria-valuemax':String(POMODORO_MAX_MINUTES)} });
  leftResizeHandle.createSpan();
  const headerLeft = header.createDiv({ cls:PID + '-pomo-clock' });
  const modeChip = headerLeft.createSpan({ cls:PID + '-pomo-mode' });
  const durationWrap = headerLeft.createEl('label', { cls:PID + '-pomo-duration' });
  obs.setIcon(durationWrap.createSpan(), 'timer');
  const durationInput = durationWrap.createEl('input', { attr:{type:'number', min:'1', max:String(POMODORO_MAX_MINUTES), step:'1', value:'25', inputmode:'numeric'} });
  const durationUnit = durationWrap.createSpan({ text:'min' });
  const timerEl = headerLeft.createSpan({ cls:PID + '-pomo-time' });
  const taskLabel = headerLeft.createSpan({ cls:PID + '-pomo-running-task' });
  const titleSpan = headerLeft.createSpan({ cls:PID + '-pomo-compact-time' });
  const remarkInput = header.createEl('input', { cls:PID + '-pomo-remark', attr:{type:'text', maxlength:'280'} });
  const startBtn = header.createEl('button', { cls:PID + '-pomo-start', attr:{type:'button'} });
  const btnGroup = header.createDiv({ cls:PID + '-pomo-tools' });
  const toggleBtn = btnGroup.createEl('button', { attr:{type:'button'} });
  const settingsBtn = btnGroup.createEl('button', { attr:{type:'button'} });
  obs.setIcon(settingsBtn, 'sliders-horizontal');
  const closeBtn = btnGroup.createEl('button', { text:'×', attr:{type:'button'} });
  const resizeHandle = header.createEl('button', { cls:PID + '-pomo-stretch ' + PID + '-pomo-stretch-right', attr:{type:'button', role:'slider', 'aria-valuemin':'1', 'aria-valuemax':String(POMODORO_MAX_MINUTES)} });
  resizeHandle.createSpan();
  const body = floatEl.createDiv({ cls:PID + '-pomo-body' });
  const statusEl = body.createDiv({ cls:PID + '-pomo-status', attr:{'aria-live':'polite'} });
  const taskRow = body.createDiv({ cls:PID + '-pomodoro-task' });
  obs.setIcon(taskRow.createSpan({ cls:PID + '-pomodoro-task-icon' }), 'list-checks');
  const taskSelect = taskRow.createEl('select', { cls:PID + '-pomodoro-task-select' });
  const taskMeta = taskRow.createSpan({ cls:PID + '-pomodoro-task-meta' });
  const metricsRow = body.createDiv({ cls:PID + '-pomo-metrics' });
  const todayFocus = metricsRow.createSpan();
  metricsRow.createSpan({text:'·'});
  const countEl = metricsRow.createSpan();
  const fullscreenRow = body.createEl('label', { cls:PID + '-pomodoro-fullscreen' });
  const fullscreenToggle = fullscreenRow.createEl('input', { attr:{type:'checkbox'} });
  const fullscreenText = fullscreenRow.createSpan();
  const breakReminderRow = body.createEl('label', { cls:PID + '-pomodoro-fullscreen ' + PID + '-pomodoro-break-reminder' });
  const breakReminderToggle = breakReminderRow.createEl('input', { attr:{type:'checkbox'} });
  const breakReminderText = breakReminderRow.createSpan();
  const taskActions = body.createDiv({ cls:PID + '-pomodoro-task-actions', attr:{role:'group', 'aria-live':'polite'} });
  const taskActionAnnouncement = taskActions.createSpan({ cls:PID + '-pomo-sr' });
  const completeTaskBtn = taskActions.createEl('button', {attr:{type:'button'}});
  const keepTaskBtn = taskActions.createEl('button', {attr:{type:'button'}});
  const deferTaskBtn = taskActions.createEl('button', {attr:{type:'button'}});
  const resetBtn = body.createEl('button', { cls:PID + '-pomo-reset', attr:{type:'button'} });
  const cueEl = floatEl.createDiv({ cls:PID + '-pomo-cue', attr:{'aria-live':'polite'} });
  const orbBtn = floatEl.createEl('button', { cls:PID + '-pomo-orb', attr:{type:'button'} });
  const orbNumber = orbBtn.createSpan({ cls:PID + '-pomo-orb-number' });
  orbBtn.createSpan({ cls:PID + '-pomo-orb-hand', attr:{'aria-hidden':'true'} });
  document.body.appendChild(floatEl);

  let state = {}, details = false, idleTimer = null, destroyed = false;
  let hovered = false, resizing = null, lastWidth = null;
  let orbDrag = null, suppressOrbClick = false;
  const api = { floatEl, header, headerLeft, modeChip, titleSpan, btnGroup, toggleBtn, closeBtn, body,
    statusEl, taskRow, taskSelect, taskMeta, timerEl, cueEl, metricsRow, todayFocus, countEl,
    fullscreenRow, fullscreenToggle, fullscreenText, breakReminderRow, breakReminderToggle, breakReminderText,
    taskActions, taskActionAnnouncement, completeTaskBtn, keepTaskBtn, deferTaskBtn, startBtn, resetBtn,
    durationInput, remarkInput, resizeHandle };
  const resizeHandles = [leftResizeHandle, resizeHandle];
  const feedback = createPomodoroFeedback(floatEl);
  function widthMode() { return !!state.minimized || !!state.isRunning || !!state.hasProgress; }

  function fitPosition() {
    if (floatEl.classList.contains('is-reminding') || !floatEl.isConnected || !floatEl.style.left || floatEl.style.left === 'auto') return;
    const rect = floatEl.getBoundingClientRect();
    floatEl.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)) + 'px';
    floatEl.style.setProperty('--pomo-left', floatEl.style.left);
    if (floatEl.style.top && floatEl.style.top !== 'auto') {
      floatEl.style.top = Math.max(8, Math.min(rect.top, window.innerHeight - rect.height - 8)) + 'px';
      floatEl.style.setProperty('--pomo-top', floatEl.style.top);
    }
  }
  function setOrb(value) {
    floatEl.classList.toggle('is-orb', value);
    fitPosition();
  }
  function clearIdle() { clearTimeout(idleTimer); idleTimer = null; }
  function hasKeyboardFocus() { return !!floatEl.querySelector(':focus-visible'); }
  function scheduleIdle() {
    clearIdle();
    if (destroyed || state.pinnedMinimal || !state.minimized || !state.isRunning || hovered || resizing || hasKeyboardFocus()) return;
    idleTimer = setTimeout(() => {
      if (!destroyed && state.minimized && state.isRunning && !hovered && !hasKeyboardFocus()) setOrb(true);
    }, POMODORO_IDLE_MS);
  }
  function wake() { clearIdle(); if (!state.pinnedMinimal) setOrb(false); }
  floatEl.addEventListener('pointerenter', () => { hovered = true; wake(); });
  floatEl.addEventListener('pointerleave', () => { hovered = false; scheduleIdle(); });
  floatEl.addEventListener('focusin', wake);
  floatEl.addEventListener('focusout', () => queueMicrotask(scheduleIdle));
  orbBtn.onclick = () => {
    if (suppressOrbClick) { suppressOrbClick = false; return; }
    if (state.pinnedMinimal) api.onUnpinMinimal?.();
    else wake();
    toggleBtn.focus();
  };

  function place(left, top) {
    const size = floatEl.classList.contains('is-orb') ? {width:64,height:64} : floatEl.getBoundingClientRect();
    const x = Math.max(8, Math.min(left, window.innerWidth - size.width - 8));
    const y = Math.max(8, Math.min(top, window.innerHeight - size.height - 8));
    floatEl.style.left = x + 'px'; floatEl.style.top = y + 'px';
    floatEl.style.right = 'auto'; floatEl.style.bottom = 'auto';
    floatEl.style.setProperty('--pomo-left', x + 'px'); floatEl.style.setProperty('--pomo-top', y + 'px');
    floatEl.classList.add('is-manual-position');
  }
  function finishOrbDrag(event, cancelled = false) {
    if (!orbDrag || (event && event.pointerId !== orbDrag.id)) return;
    const drag = orbDrag; orbDrag = null;
    if (orbBtn.hasPointerCapture?.(drag.id)) orbBtn.releasePointerCapture(drag.id);
    suppressOrbClick = drag.moved && !cancelled;
    floatEl.classList.remove('is-orb-dragging');
    feedback.end();
    if (drag.moved && !destroyed) api.onCommit?.();
  }
  orbBtn.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const rect = floatEl.getBoundingClientRect();
    suppressOrbClick = false;
    orbDrag = { id:event.pointerId, startX:event.clientX, startY:event.clientY, left:rect.left, top:rect.top, moved:false };
    orbBtn.setPointerCapture?.(event.pointerId);
    clearIdle();
  });
  orbBtn.addEventListener('pointermove', (event) => {
    if (!orbDrag || event.pointerId !== orbDrag.id) return;
    const dx = event.clientX - orbDrag.startX, dy = event.clientY - orbDrag.startY;
    if (!orbDrag.moved && Math.hypot(dx, dy) < 6) return;
    orbDrag.moved = true;
    if (!state.pinnedMinimal) api.onPinMinimal?.();
    floatEl.classList.add('is-orb-dragging');
    place(orbDrag.left + dx, orbDrag.top + dy);
    feedback.tick();
  });
  orbBtn.addEventListener('pointerup', (event) => finishOrbDrag(event));
  orbBtn.addEventListener('pointercancel', (event) => finishOrbDrag(event, true));
  orbBtn.addEventListener('lostpointercapture', (event) => finishOrbDrag(event, true));
  orbBtn.addEventListener('keydown', (event) => {
    const directions = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const rect = floatEl.getBoundingClientRect(), step = event.shiftKey ? 40 : 10;
    if (!state.pinnedMinimal) api.onPinMinimal?.();
    place(rect.left + direction[0] * step, rect.top + direction[1] * step);
    api.onCommit?.();
  });
  settingsBtn.onclick = () => {
    if (state.minimized) { toggleBtn.click(); return; }
    details = !details; api.update(state);
  };

  function availableWidth() { return Math.min(680, Math.max(260, window.innerWidth - 28)); }
  function minimumWidth() { return state.minimized ? (state.remaining >= 3600 ? 248 : POMODORO_MIN_WIDTH) : Math.min(420, availableWidth()); }
  function widthFor(minutes) { return Math.min(availableWidth(), 350 + (minutes - 1) / (POMODORO_MAX_MINUTES - 1) * 330); }
  function syncWidth() {
    const width = widthMode() ? Math.min(availableWidth(), Math.max(minimumWidth(), state.layoutWidth || 260)) : widthFor(state.minutes || 25);
    floatEl.setAttribute('data-pomo-density', width < 320 ? 'minimal' : width < 480 ? 'compact' : width < 600 ? 'wide' : 'full');
    if (width !== lastWidth) {
      lastWidth = width;
      floatEl.style.setProperty('--pomo-width', width + 'px');
      fitPosition();
    }
  }
  function finishResize(event) {
    if (!resizing || (event && event.pointerId !== resizing.id)) return;
    const pinMinimal = resizing.pinMinimal && event?.type === 'pointerup';
    const pinPosition = pinMinimal ? {left:resizing.lastX - 32, top:floatEl.getBoundingClientRect().top} : null;
    const id = resizing.id;
    const resizingHandle = resizing.handle;
    resizing = null;
    if (resizingHandle?.hasPointerCapture?.(id)) resizingHandle.releasePointerCapture(id);
    floatEl.classList.remove('is-stretching');
    floatEl.classList.remove('is-orb-ready');
    feedback.end();
    if (pinMinimal && !destroyed) { api.onPinMinimal?.(); place(pinPosition.left, pinPosition.top); }
    syncWidth();
    api.onCommit?.();
    scheduleIdle();
  }
  resizeHandles.forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      const rect = floatEl.getBoundingClientRect();
      const direction = handle === leftResizeHandle ? -1 : 1;
      resizing = { id:event.pointerId, x:event.clientX, minutes:state.minutes, width:rect.width,
        handle, direction, lastX:event.clientX, widthMode:widthMode(), detent:0, pinMinimal:false };
      floatEl.style.left = direction === 1 ? rect.left + 'px' : 'auto';
      floatEl.style.right = direction === -1 ? (window.innerWidth - rect.right) + 'px' : 'auto';
      floatEl.classList.add('is-stretching');
      handle.setPointerCapture?.(event.pointerId);
      clearIdle();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!resizing || resizing.id !== event.pointerId) return;
      resizing.lastX = event.clientX;
      const delta = (event.clientX - resizing.x) * resizing.direction;
      let detent;
      if (resizing.widthMode) {
        const rawWidth = resizing.width + delta;
        resizing.pinMinimal = state.minimized && rawWidth <= minimumWidth() - 28;
        floatEl.classList.toggle('is-orb-ready', resizing.pinMinimal);
        const width = Math.max(minimumWidth(), Math.min(availableWidth(), rawWidth));
        detent = Math.round((width - resizing.width) / 8);
        api.onWidth?.(Math.round(width));
      } else {
        const perMinute = Math.max(.75, (availableWidth() - 350) / (POMODORO_MAX_MINUTES - 1));
        const minutes = pomodoroDuration(resizing.minutes + delta / perMinute, 1);
        detent = minutes - resizing.minutes;
        api.onDuration?.(minutes);
      }
      if (detent !== resizing.detent) { resizing.detent = detent; feedback.tick(); }
    });
    handle.addEventListener('pointerup', finishResize);
    handle.addEventListener('pointercancel', finishResize);
    handle.addEventListener('lostpointercapture', finishResize);
    handle.addEventListener('keydown', (event) => {
      const steps = {ArrowRight:1, ArrowUp:1, ArrowLeft:-1, ArrowDown:-1, PageUp:5, PageDown:-5};
      if (!(event.key in steps) && !['Home','End'].includes(event.key)) return;
      event.preventDefault();
      if (widthMode()) {
        const width = event.key === 'Home' ? minimumWidth() : event.key === 'End' ? availableWidth() : (state.layoutWidth || 260) + steps[event.key] * 8;
        if (state.minimized && width < minimumWidth()) api.onPinMinimal?.();
        else api.onWidth?.(Math.max(minimumWidth(), Math.min(availableWidth(), width)));
      } else {
        const minutes = event.key === 'Home' ? 1 : event.key === 'End' ? POMODORO_MAX_MINUTES : state.minutes + steps[event.key];
        api.onDuration?.(pomodoroDuration(minutes, 1));
      }
      api.onCommit?.();
    });
  });
  durationInput.onchange = () => { api.onDuration?.(pomodoroDuration(durationInput.value, state.minutes)); api.onCommit?.(); };
  remarkInput.oninput = () => api.onRemark?.(remarkInput.value.slice(0, 280));
  remarkInput.onchange = () => api.onCommit?.();
  remarkInput.onkeydown = (event) => { if (event.key === 'Enter') startBtn.click(); };
  durationInput.onkeydown = (event) => {
    if (event.key === 'Enter') { durationInput.blur(); startBtn.click(); }
  };

  api.update = (next) => {
    const wasPinned = !!state.pinnedMinimal;
    const modeChanged = state.minimized !== next.minimized || state.isRunning !== next.isRunning || wasPinned !== !!next.pinnedMinimal;
    state = { ...next };
    floatEl.setAttribute('data-display-mode', state.pinnedMinimal ? 'minimal' : state.minimized ? 'simple' : 'normal');
    floatEl.classList.toggle('is-compact', !!state.minimized);
    floatEl.classList.toggle('is-running', !!state.isRunning);
    floatEl.classList.toggle('is-started', !!state.hasProgress || !!state.isRunning);
    floatEl.classList.toggle('is-resizable-layout', widthMode());
    floatEl.classList.toggle('is-details', !state.minimized && (details || !!state.taskActionsVisible));
    const detailsVisible = details || state.taskActionsVisible;
    body.hidden = !!state.minimized || !detailsVisible;
    body.style.display = body.hidden ? 'none' : 'block';
    floatEl.classList.toggle('is-pinned-minimal', !!state.pinnedMinimal);
    if (state.pinnedMinimal) setOrb(true);
    else if ((!state.minimized || !state.isRunning || wasPinned) && floatEl.classList.contains('is-orb')) setOrb(false);
    durationInput.disabled = !!state.isRunning || !!state.hasProgress;
    durationInput.value = String(state.minutes);
    resizeHandles.forEach((handle) => {
      handle.disabled = false;
      handle.setAttribute('aria-valuemin', String(widthMode() ? minimumWidth() : 1));
      handle.setAttribute('aria-valuemax', String(widthMode() ? availableWidth() : POMODORO_MAX_MINUTES));
      handle.setAttribute('aria-valuenow', String(widthMode() ? Math.min(availableWidth(), Math.max(minimumWidth(), state.layoutWidth || 260)) : state.minutes));
      handle.setAttribute('aria-valuetext', widthMode() ? Math.min(availableWidth(), Math.max(minimumWidth(), state.layoutWidth || 260)) + ' px' : state.minutes + ' min');
      handle.setAttribute('aria-label', handle === leftResizeHandle
        ? label('向左拉伸设置时长（方向键微调）', 'Stretch left for duration (arrow keys to adjust)')
        : label('向右拉伸设置时长（方向键微调）', 'Stretch right for duration (arrow keys to adjust)'));
      if (widthMode()) handle.setAttribute('aria-label', handle === leftResizeHandle ? label('向左拉伸显示宽度（方向键微调）', 'Stretch left to resize (arrow keys to adjust)') : label('向右拉伸显示宽度（方向键微调）', 'Stretch right to resize (arrow keys to adjust)'));
      handle.title = handle.getAttribute('aria-label');
      if (state.minimized && state.layoutWidth <= minimumWidth()) handle.title += label('；继续收短可固定极简模式', '; shrink further to keep the minimal dial');
    });
    durationInput.setAttribute('aria-label', label('时长（分钟）', 'Duration in minutes'));
    remarkInput.placeholder = label('备注…', 'Remark…');
    remarkInput.setAttribute('aria-label', label('专注备注', 'Focus remark'));
    settingsBtn.title = label('待办与提醒设置', 'Task and reminder settings');
    settingsBtn.setAttribute('aria-label', settingsBtn.title);
    settingsBtn.setAttribute('aria-expanded', String(!body.hidden));
    floatEl.setAttribute('aria-label', label('番茄钟', 'Pomodoro'));
    const timeLabel = state.time + (state.remark ? ' · ' + state.remark : '');
    titleSpan.title = timeLabel;
    orbNumber.textContent = String(Math.ceil(state.remaining / 60));
    orbBtn.setAttribute('aria-label', label('剩余 ', 'Remaining ') + state.time + label('，展开计时器', ', expand timer'));
    orbBtn.title = timeLabel + (state.pinnedMinimal ? label(' · 拖动移动，单击回到简洁模式', ' · Drag to move; click for compact timer') : '');
    if (state.pinnedMinimal) orbBtn.setAttribute('aria-label', label('常驻极简模式，剩余 ', 'Persistent minimal timer, remaining ') + state.time + label('；拖动移动，单击展开', '; drag to move, click to expand'));
    startBtn.title = state.startLabel;
    startBtn.setAttribute('aria-label', state.startLabel);
    if (startBtn.getAttribute('data-label') !== state.startLabel) {
      const shortLabel = document.createElement('span');
      shortLabel.className = PID + '-pomo-start-symbol';
      shortLabel.textContent = state.isRunning ? 'Ⅱ' : '▶';
      const wordLabel = document.createElement('span');
      wordLabel.className = PID + '-pomo-start-word';
      wordLabel.textContent = state.startLabel;
      // 只在标签变化时更新节点；每秒刷新不重复构建按钮。
      startBtn.empty(); startBtn.appendChild(shortLabel); startBtn.appendChild(wordLabel);
      startBtn.setAttribute('data-label', state.startLabel);
    }
    taskLabel.textContent = state.taskText || '';
    taskLabel.title = state.taskText || '';
    toggleBtn.textContent = state.minimized ? '+' : '−';
    syncWidth();
    if (modeChanged) { fitPosition(); scheduleIdle(); }
  };
  const onResize = () => { syncWidth(); fitPosition(); };
  window.addEventListener('resize', onResize);
  api.destroy = () => { destroyed = true; clearIdle(); finishOrbDrag(null, true); finishResize(); feedback.destroy(); window.removeEventListener('resize', onResize); };
  api.getPosition = () => {
    const left = parseFloat(floatEl.style.left), top = parseFloat(floatEl.style.top);
    return Number.isFinite(left) && Number.isFinite(top) ? {left,top} : null;
  };
  api.restorePosition = (position) => {
    if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) place(position.left, position.top);
  };
  api.setReminderVisible = (visible) => {
    floatEl.classList.toggle('is-reminding', !!visible);
    floatEl.setAttribute('aria-hidden', visible ? 'true' : 'false');
    if (visible) { clearIdle(); finishOrbDrag(null, true); }
    else { fitPosition(); scheduleIdle(); }
  };
  api.feedbackTick = () => feedback.tick();
  api.endFeedback = () => feedback.end();
  api.showDetails = () => { details = true; api.update(state); };
  return api;
}
