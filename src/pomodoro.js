// pomodoro.js — 番茄钟的唯一公共入口。
// 视图只负责提供运行时依赖；浮窗复用和绑定都从这里进入，避免调用方耦合内部实现。

// 番茄钟时长（分钟）：专注轮 / 休息轮。统计、倒计时、番茄数换算都以此为唯一来源。
const POMODORO_FOCUS_MINUTES = 25;
const POMODORO_BREAK_MINUTES = 5;

function buildPomodoro(view, root, initialTodo) {
  if (!view) {
    console.warn('Cockpit: buildPomodoro failed, view is unavailable');
    return;
  }
  return createPomodoro(view, root, initialTodo);
}

function createPomodoro(view, root, initialTodo) {
    const PID = PLUGIN_ID;
    let self = view;
    const isMobile = !!(self._isMobile && self._isMobile());
    const t = (key, vars) => self._t(key, vars);

    // 全局单例：如果已存在则复用，不重建
    const existing = document.querySelector('.' + PID + '-pomodoro');
    if (existing) {
      // 即使是旧浮窗，也先把闭包里的 view 切到当前插件实例，避免热升级后继续用旧的直写路径。
      if (typeof existing._cockpitBindPomodoroView === 'function') {
        existing._cockpitBindPomodoroView(view);
      }
      // 旧版浮窗没有可安全调用的销毁钩子；保留本轮计时并要求用户主动关闭后再打开。
      if (existing._cockpitPomodoroFeatureVersion !== 3) {
        new obsidian.Notice(view._lang() === 'en' ? 'Close the existing timer, then reopen it to use the latest reminder settings.' : '请关闭当前旧番茄钟，再重新打开以使用最新提醒设置。');
        return existing;
      }
      if (typeof existing._cockpitSyncLanguage === 'function') {
        existing._cockpitSyncLanguage();
      }
      if (typeof existing._cockpitSyncTheme === 'function') {
        existing._cockpitSyncTheme();
      }
      if (initialTodo && typeof existing._cockpitSelectTask === 'function') existing._cockpitSelectTask(initialTodo);
      return existing;
    }

    // 创建浮动容器
    const floatEl = document.createElement('div');
    floatEl.className = PID + '-pomodoro';
    if (isMobile) floatEl.classList.add(PID + '-pomodoro-mobile');
    floatEl.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:999;width:218px;max-width:calc(100vw - 24px);font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;border-radius:18px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:box-shadow 0.25s,border-color 0.25s,transform 0.25s,background 0.25s;';

    // 标题栏（拖拽区域）
    const header = floatEl.createDiv({ cls: PID + '-pomo-header' });
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;cursor:' + (isMobile ? 'default' : 'move') + ';user-select:none;-webkit-user-select:none;touch-action:' + (isMobile ? 'manipulation' : 'none') + ';border-bottom:1px solid transparent;';
    const headerLeft = header.createDiv({ attr: { style: 'display:flex;flex-direction:column;gap:0;min-width:0;' } });
    const modeChip = headerLeft.createDiv({ attr: { style: 'display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:3px 8px;border-radius:999px;font-size:0.6em;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;' } });
    const titleSpan = headerLeft.createSpan({ text: t('pomodoro.title'), attr: { style: 'display:none;font-size:1.05em;font-weight:800;color:var(--text-normal);line-height:1.05;' } });
    const dragHint = headerLeft.createSpan({ text: t('pomodoro.dragHint'), attr: { style: 'display:none;font-size:0.62em;color:var(--text-muted);line-height:1;' } });
    const btnGroup = header.createDiv({ attr: { style: 'display:flex;gap:6px;align-items:center;flex-shrink:0;' } });
    const toggleBtn = btnGroup.createEl('button', { text: '−', attr: { type:'button', style: 'width:24px;height:24px;padding:0;border:0;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:var(--text-normal);cursor:pointer;touch-action:manipulation;font-size:1em;font-weight:700;', title: t('pomodoro.minimize'), 'aria-label':t('pomodoro.minimize') } });
    const closeBtn = btnGroup.createEl('button', { text: '×', attr: { type:'button', style: 'width:24px;height:24px;padding:0;border:0;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:var(--text-normal);cursor:pointer;touch-action:manipulation;font-size:1.05em;font-weight:700;', title: t('pomodoro.close'), 'aria-label':t('pomodoro.close') } });

    // 内容区
    const body = floatEl.createDiv({ cls: PID + '-pomo-body' });
    body.style.cssText = 'padding:6px 10px 10px;text-align:center;';

    const statusEl = body.createDiv({ text: t('pomodoro.ready'), attr: { 'aria-live':'polite', style: 'display:none;align-items:center;justify-content:center;min-height:22px;padding:4px 9px;border-radius:999px;font-size:0.64em;font-weight:700;color:var(--text-muted);margin-bottom:0;' } });

    const taskRow = body.createDiv({ cls: PID + '-pomodoro-task' });
    obsidian.setIcon(taskRow.createSpan({ cls:PID + '-pomodoro-task-icon' }), 'list-checks');
    const taskSelect = taskRow.createEl('select', { cls:PID + '-pomodoro-task-select', attr:{ 'aria-label':t('pomodoro.selectTask') } });
    const taskMeta = taskRow.createSpan({ cls:PID + '-pomodoro-task-meta' });

    const dialWrap = body.createDiv({ attr: { style: 'display:flex;justify-content:center;margin-bottom:6px;' } });
    const dialEl = dialWrap.createDiv({ attr: { style: 'position:relative;width:112px;height:112px;border-radius:50%;padding:7px;display:flex;align-items:center;justify-content:center;' } });
    const dialInner = dialEl.createDiv({ attr: { style: 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;' } });
    const timerStack = dialInner.createDiv({ attr: { style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;' } });
    const timerEl = timerStack.createDiv({ text: '25:00', attr: { style: 'font-size:1.75em;font-weight:800;color:var(--text-normal);font-variant-numeric:tabular-nums;letter-spacing:1px;line-height:1;' } });
    const timerSub = timerStack.createDiv({ text: t('pomodoro.backToWork'), attr: { style: 'display:none;font-size:0.62em;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:var(--text-muted);opacity:0.82;' } });

    const cueEl = body.createDiv({ attr: { 'aria-live':'polite', style: 'display:none;min-height:16px;margin:0 auto 6px;padding:0 6px;font-size:0.62em;font-weight:700;line-height:1.25;' } });

    const metricsRow = body.createDiv({ attr: { style: 'display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:8px;padding:6px 10px;border-radius:12px;font-size:0.62em;font-weight:700;color:var(--text-muted);line-height:1;white-space:nowrap;' } });
    const todayFocus = metricsRow.createSpan({ text: t('pomodoro.focusToday', { minutes: 0 }) });
    const metricsSep = metricsRow.createSpan({ text: '·', attr: { style: 'opacity:0.45;' } });
    const countEl = metricsRow.createSpan({ text: '🍅 × 0' });

    const fullscreenRow = body.createEl('label', { cls:PID + '-pomodoro-fullscreen' });
    const fullscreenToggle = fullscreenRow.createEl('input', { attr:{type:'checkbox'} });
    fullscreenToggle.checked = self._pomodoroFullscreen === true;
    const fullscreenText = fullscreenRow.createSpan({ text:t('pomodoro.fullscreenReminder') });
    fullscreenRow.title = t('pomodoro.fullscreenHint');
    const breakReminderRow = body.createEl('label', { cls:PID + '-pomodoro-fullscreen ' + PID + '-pomodoro-break-reminder' });
    const breakReminderToggle = breakReminderRow.createEl('input', { attr:{type:'checkbox'} });
    breakReminderToggle.checked = self._pomodoroBreakReminder !== false;
    const breakReminderText = breakReminderRow.createSpan({ text:t('pomodoro.breakReminder') });
    breakReminderRow.title = t('pomodoro.breakReminderHint');

    const taskActions = body.createDiv({ cls:PID + '-pomodoro-task-actions', attr:{ role:'group', 'aria-live':'polite', 'aria-label':t('pomodoro.taskNextAction') } });
    const taskActionAnnouncement = taskActions.createSpan({ attr:{ style:'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;' } });
    const completeTaskBtn = taskActions.createEl('button', { attr:{type:'button'} });
    const keepTaskBtn = taskActions.createEl('button', { attr:{type:'button'} });
    const deferTaskBtn = taskActions.createEl('button', { attr:{type:'button'} });

    const btnRow = body.createDiv({ attr: { style: 'display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:8px;' } });
    const startBtn = btnRow.createEl('button', { text: t('pomodoro.start'), attr: { style: 'min-height:32px;padding:7px 10px;border-radius:11px;border:1px solid transparent;color:white;font-size:0.7em;font-weight:800;cursor:pointer;transition:transform 0.15s,box-shadow 0.2s,background 0.2s;' } });
    const resetBtn = btnRow.createEl('button', { text: t('pomodoro.reset'), attr: { style: 'min-height:32px;padding:7px 10px;border-radius:11px;border:1px solid var(--background-modifier-border);background:transparent;color:var(--text-normal);font-size:0.68em;font-weight:700;cursor:pointer;transition:transform 0.15s,background 0.2s,border-color 0.2s;' } });

    document.body.appendChild(floatEl);

    // 状态变量：会话独立于“是否自动显示”保存，避免正在使用时被设置误伤。
    const restoredSession = view._pomodoroSession?.active ? view._pomodoroSession : null;
    let totalSeconds = restoredSession?.isBreak ? POMODORO_BREAK_MINUTES * 60 : POMODORO_FOCUS_MINUTES * 60;
    let remaining = Number.isFinite(restoredSession?.remaining) ? Math.max(0, Math.min(totalSeconds, restoredSession.remaining)) : totalSeconds;
    if (restoredSession?.isRunning && Number.isFinite(restoredSession.endAt)) {
      remaining = Math.max(1, Math.ceil((restoredSession.endAt - Date.now()) / 1000));
    }
    let isRunning = false;
    let isBreak = !!restoredSession?.isBreak;
    let timerInterval = null;
    // 运行期以墙钟为准（endAt），后台标签页被节流或系统休眠后仍能正确倒计时。
    let endAt = null;
    let minimized = !!restoredSession?.minimized;
    let reminderResetTimer = null;
    let cueTimer = null;
    let themeObserver = null;
    let statusKey = 'pomodoro.ready';
    let startLabelKey = 'pomodoro.start';
    let cueText = '';
    let cueKey = '';
    let boundTask = restoredSession?.task ? pomodoroTaskRef({ ...restoredSession.task, done:false }) : null;
    let taskActionsVisible = !!restoredSession?.awaitingTaskAction && !!boundTask;
    let pendingCompletion = restoredSession?.pendingCompletion || null;

    function currentSession() {
      const session = {
        active: true,
        isBreak,
        isRunning,
        remaining,
        endAt: isRunning ? Date.now() + remaining * 1000 : null,
        minimized,
        task:boundTask ? { id:boundTask.id, text:boundTask.text } : null,
        awaitingTaskAction:taskActionsVisible,
        pendingCompletion
      };
      return session;
    }

    function persistSession() {
      return self._savePomodoroSession(currentSession()).catch((e) => {
        console.warn('Cockpit: save pomodoro session failed', e);
        return null;
      });
    }

    function clearSession() {
      if (pendingCompletion) return persistSession();
      self._savePomodoroSession(null).catch((e) => console.warn('Cockpit: clear pomodoro session failed', e));
    }

    const FOCUS_ACCENT = '#ff6b57';
    const BREAK_ACCENT = '#48b4ff';

    function getPomodoroCount() {
      return Math.max(0, Math.floor((self._focusMinutes || 0) / POMODORO_FOCUS_MINUTES));
    }

    function getPendingTaskOptions() {
      const pending = (self._todos || []).filter((todo) => !todo.done && pomodoroTaskRef(todo));
      const todayKey = window.moment().format('YYYY-MM-DD');
      const priority = groupTodayTodos(pending, todayKey).flatMap((group) => group.items);
      const seen = new Set(priority.map((todo) => todo.id));
      return priority.concat(pending.filter((todo) => !seen.has(todo.id))).slice(0, 50);
    }

    function syncTaskMeta() {
      const stat = boundTask ? getTodoFocusStat(self._pomodoroTaskStats, boundTask) : null;
      taskMeta.textContent = stat ? t('pomodoro.taskMinutes', { minutes:stat.totalMinutes }) : '';
      taskMeta.style.display = stat ? 'inline-flex' : 'none';
    }

    function renderTaskPicker() {
      const options = getPendingTaskOptions();
      const taskLocked = isRunning || (!isBreak && remaining < totalSeconds);
      if (boundTask && !options.some((todo) => todo.id === boundTask.id)) {
        boundTask = null;
        setTaskActionsVisible(false);
        if (taskLocked) {
          new obsidian.Notice(self._lang() === 'en' ? 'The linked task was completed or removed. This focus session will stay unlinked.' : '关联待办已完成或删除，本轮专注将不再关联任务。');
        }
      }
      taskSelect.empty();
      taskSelect.createEl('option', { text:t('pomodoro.noTask'), attr:{value:''} });
      options.forEach((todo) => taskSelect.createEl('option', { text:todo.text, attr:{value:todo.id} }));
      taskSelect.value = boundTask?.id || '';
      taskSelect.title = boundTask?.text || t('pomodoro.noTask');
      syncTaskMeta();
    }

    function setTaskActionsVisible(visible) {
      taskActionsVisible = !!visible && !!boundTask;
      taskActions.style.display = !minimized && taskActionsVisible ? 'grid' : 'none';
      taskActions.setAttribute('aria-hidden', taskActionsVisible ? 'false' : 'true');
      taskActionAnnouncement.textContent = taskActionsVisible ? t('pomodoro.taskNextAction') : '';
    }

    function getThemeTokens() {
      const isLight = document.body.classList.contains('theme-light');
      if (isLight) {
        return {
          shellTop: 'rgba(255,255,255,0.94)',
          shellBottom: 'rgba(246,248,252,0.96)',
          border: 'rgba(148,163,184,0.24)',
          borderSoft: 'rgba(148,163,184,0.14)',
          headerGlow: 'rgba(255,255,255,0.36)',
          headerAccent: 'rgba(244,247,251,0.28)',
          textSoft: 'rgba(71,85,105,0.88)',
          ringTrack: 'rgba(148,163,184,0.18)',
          dialInnerTop: 'rgba(255,255,255,0.92)',
          dialInnerBottom: 'rgba(239,244,249,0.96)',
          metricBg: 'rgba(255,255,255,0.84)',
          cueBg: 'rgba(255,255,255,0.88)',
          buttonGhost: 'rgba(255,255,255,0.72)',
          buttonGhostHover: 'rgba(255,255,255,0.96)',
          shadow: '0 10px 26px rgba(15,23,42,0.12)',
          accentShadow: 'rgba(15,23,42,0.12)'
        };
      }
      return {
        shellTop: 'rgba(24,31,40,0.96)',
        shellBottom: 'rgba(18,24,33,0.98)',
        border: 'rgba(72,180,255,0.14)',
        borderSoft: 'rgba(72,180,255,0.08)',
        headerGlow: 'rgba(255,255,255,0.03)',
        headerAccent: 'rgba(72,180,255,0.035)',
        textSoft: 'rgba(203,213,225,0.78)',
        ringTrack: 'rgba(148,163,184,0.12)',
        dialInnerTop: 'rgba(29,37,49,0.96)',
        dialInnerBottom: 'rgba(24,31,42,0.98)',
        metricBg: 'rgba(20,27,36,0.78)',
        cueBg: 'rgba(20,27,36,0.74)',
        buttonGhost: 'rgba(20,27,36,0.78)',
        buttonGhostHover: 'rgba(30,41,59,0.84)',
        shadow: '0 14px 34px rgba(2,6,23,0.28)',
        accentShadow: 'rgba(2,6,23,0.18)'
      };
    }

    function currentAccent() {
      return isBreak ? BREAK_ACCENT : FOCUS_ACCENT;
    }

    function updateModeTone() {
      const accent = currentAccent();
      modeChip.textContent = t(isBreak ? 'pomodoro.modeBreak' : 'pomodoro.modeFocus');
      modeChip.style.color = accent;
      timerSub.textContent = isBreak ? t('pomodoro.resting') : t('pomodoro.backToWork');
      timerSub.style.color = isBreak ? BREAK_ACCENT : 'var(--text-muted)';
    }

    function applyVisualState(accentOverride) {
      const tokens = getThemeTokens();
      const accent = accentOverride || currentAccent();
      const progress = Math.max(0, Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100));
      floatEl.style.background = 'linear-gradient(180deg,' + tokens.shellTop + ',' + tokens.shellBottom + ')';
      floatEl.style.border = '1px solid ' + tokens.border;
      floatEl.style.boxShadow = tokens.shadow;
      header.style.background = 'linear-gradient(135deg,' + tokens.headerGlow + ',' + tokens.headerAccent + ')';
      header.style.borderBottomColor = tokens.borderSoft;
      dragHint.style.color = tokens.textSoft;
      modeChip.style.background = tokens.metricBg;
      toggleBtn.style.background = tokens.buttonGhost;
      closeBtn.style.background = tokens.buttonGhost;
      statusEl.style.background = tokens.metricBg;
      metricsRow.style.background = tokens.metricBg;
      metricsRow.style.border = '1px solid ' + tokens.borderSoft;
      taskRow.style.background = tokens.metricBg;
      taskRow.style.border = '1px solid ' + tokens.borderSoft;
      resetBtn.style.background = tokens.buttonGhost;
      dialEl.style.background = 'conic-gradient(' + accent + ' ' + progress + '%, ' + tokens.ringTrack + ' ' + progress + '% 100%)';
      dialInner.style.background = 'linear-gradient(180deg,' + tokens.dialInnerTop + ',' + tokens.dialInnerBottom + ')';
      cueEl.style.background = tokens.cueBg;
      cueEl.style.border = '1px solid ' + tokens.borderSoft;
      startBtn.style.background = 'linear-gradient(135deg,' + accent + ', ' + (isBreak ? '#7dd3fc' : '#fb7185') + ')';
      startBtn.style.boxShadow = '0 8px 18px ' + tokens.accentShadow;
      resetBtn.onmouseenter = () => { resetBtn.style.background = tokens.buttonGhostHover; };
      resetBtn.onmouseleave = () => { resetBtn.style.background = tokens.buttonGhost; };
      toggleBtn.onmouseenter = () => { toggleBtn.style.transform = 'translateY(-1px)'; };
      closeBtn.onmouseenter = () => { closeBtn.style.transform = 'translateY(-1px)'; };
      toggleBtn.onmouseleave = () => { toggleBtn.style.transform = 'translateY(0)'; };
      closeBtn.onmouseleave = () => { closeBtn.style.transform = 'translateY(0)'; };
      updateModeTone();
    }

    function setCue(message, key) {
      cueText = message || '';
      cueKey = key || '';
      cueEl.textContent = cueText;
      cueEl.style.display = cueText ? 'block' : 'none';
      cueEl.style.color = cueText ? currentAccent() : 'var(--text-muted)';
    }

    function flashCue(message, accent, duration, forceNotice, key) {
      clearTimeout(cueTimer);
      setCue(message, key);
      pulseReminder(message, accent, forceNotice);
      cueTimer = setTimeout(() => {
        setCue('', '');
      }, duration || 4200);
    }

    function syncPomodoroText() {
      header.title = t('pomodoro.dragHint');
      titleSpan.textContent = t('pomodoro.title');
      dragHint.textContent = t('pomodoro.dragHint');
      toggleBtn.title = minimized ? t('pomodoro.expand') : t('pomodoro.minimize');
      closeBtn.title = t('pomodoro.close');
      toggleBtn.setAttribute('aria-label', minimized ? t('pomodoro.expand') : t('pomodoro.minimize'));
      closeBtn.setAttribute('aria-label', t('pomodoro.close'));
      statusEl.textContent = t(statusKey);
      startBtn.textContent = t(startLabelKey);
      resetBtn.textContent = t('pomodoro.reset');
      taskSelect.setAttribute('aria-label', t('pomodoro.selectTask'));
      if (taskSelect.options[0]) taskSelect.options[0].textContent = t('pomodoro.noTask');
      completeTaskBtn.textContent = t('pomodoro.completeTask');
      keepTaskBtn.textContent = t('pomodoro.keepTask');
      deferTaskBtn.textContent = t('pomodoro.deferTask');
      taskActions.setAttribute('aria-label', t('pomodoro.taskNextAction'));
      taskActions.setAttribute('aria-hidden', taskActionsVisible ? 'false' : 'true');
      if (taskActionsVisible) taskActionAnnouncement.textContent = t('pomodoro.taskNextAction');
      todayFocus.textContent = t('pomodoro.focusToday', { minutes: self._focusMinutes || 0 });
      if (cueKey) {
        cueText = t(cueKey);
        cueEl.textContent = cueText;
      }
      countEl.textContent = '🍅 × ' + getPomodoroCount();
      fullscreenToggle.checked = self._pomodoroFullscreen === true;
      fullscreenText.textContent = t('pomodoro.fullscreenReminder');
      fullscreenRow.title = t('pomodoro.fullscreenHint');
      breakReminderToggle.checked = self._pomodoroBreakReminder !== false;
      breakReminderToggle.disabled = self._pomodoroFullscreen !== true;
      breakReminderText.textContent = t('pomodoro.breakReminder');
      breakReminderRow.title = t('pomodoro.breakReminderHint');
      breakReminderRow.classList.toggle('is-disabled', breakReminderToggle.disabled);
      syncTaskMeta();
      taskSelect.disabled = isRunning || (!isBreak && remaining < totalSeconds);
      if (minimized) {
        modeChip.style.display = 'none';
        titleSpan.style.display = 'block';
        titleSpan.textContent = fmtTime(remaining);
        metricsRow.style.display = 'none';
        taskRow.style.display = 'none';
        taskActions.style.display = 'none';
        btnRow.style.display = 'none';
        cueEl.style.display = 'none';
      } else {
        modeChip.style.display = 'inline-flex';
        titleSpan.style.display = 'none';
        metricsRow.style.display = 'flex';
        taskRow.style.display = 'grid';
        taskActions.style.display = taskActionsVisible ? 'grid' : 'none';
        btnRow.style.display = 'grid';
        if (!cueText) cueEl.style.display = 'none';
      }
      applyVisualState();
    }

    floatEl._cockpitBindPomodoroView = (nextView) => {
      if (nextView) self = nextView;
      fullscreenToggle.checked = self._pomodoroFullscreen === true;
      breakReminderToggle.checked = self._pomodoroBreakReminder !== false;
      breakReminderToggle.disabled = self._pomodoroFullscreen !== true;
      renderTaskPicker();
    };
    floatEl._cockpitPomodoroFeatureVersion = 3;
    floatEl._cockpitSelectTask = (todo) => {
      const ref = pomodoroTaskRef(todo);
      if (!ref) return false;
      const hasProgress = !isBreak && remaining < totalSeconds;
      if (!canChangePomodoroTask(isRunning, hasProgress, boundTask, ref)) {
        new obsidian.Notice(self._lang() === 'en' ? 'Reset this focus session before switching tasks.' : '当前专注轮已有进度，请重置后再切换待办。');
        return false;
      }
      boundTask = ref;
      setTaskActionsVisible(false);
      if (minimized) {
        minimized = false;
        body.style.display = 'block';
        floatEl.classList.remove(PID + '-pomodoro-minimized');
        toggleBtn.textContent = '−';
        if (!isMobile) floatEl.style.width = '218px';
      }
      renderTaskPicker();
      setCue(t('pomodoro.taskBound', { task:ref.text }), '');
      syncPomodoroText();
      persistSession();
      return true;
    };
    floatEl._cockpitSyncLanguage = syncPomodoroText;
    floatEl._cockpitSyncTheme = () => applyVisualState();
    // Obsidian 会在定时主题切换时替换 body 的 theme-light/theme-dark class；运行中的浮窗不重建，也要同步重绘。
    themeObserver = new MutationObserver(() => {
      if (floatEl.isConnected) applyVisualState();
    });
    themeObserver.observe(document.body, { attributes:true, attributeFilter:['class'] });

    taskSelect.onchange = () => {
      const todo = (self._todos || []).find((item) => item.id === taskSelect.value && !item.done);
      const nextTask = todo ? pomodoroTaskRef(todo) : null;
      const hasProgress = !isBreak && remaining < totalSeconds;
      if (!canChangePomodoroTask(isRunning, hasProgress, boundTask, nextTask)) {
        new obsidian.Notice(self._lang() === 'en' ? 'Reset this focus session before switching tasks.' : '当前专注轮已有进度，请重置后再切换待办。');
        renderTaskPicker();
        return;
      }
      boundTask = nextTask;
      setTaskActionsVisible(false);
      renderTaskPicker();
      persistSession();
    };
    fullscreenToggle.onchange = () => {
      self._pomodoroFullscreen = fullscreenToggle.checked;
      breakReminderToggle.disabled = !self._pomodoroFullscreen;
      breakReminderRow.classList.toggle('is-disabled', breakReminderToggle.disabled);
      self._mutatePluginData((data) => { data.pomodoroFullscreen = self._pomodoroFullscreen; })
        .catch((e) => console.warn('Cockpit: save Pomodoro full-screen setting failed', e));
    };
    breakReminderToggle.onchange = () => {
      self._pomodoroBreakReminder = breakReminderToggle.checked;
      self._mutatePluginData((data) => { data.pomodoroBreakReminder = self._pomodoroBreakReminder; })
        .catch((e) => console.warn('Cockpit: save Pomodoro break reminder setting failed', e));
    };
    keepTaskBtn.onclick = () => { setTaskActionsVisible(false); persistSession(); };
    completeTaskBtn.onclick = async () => {
      if (!boundTask) return;
      const taskId = boundTask.id;
      if (await self._applyPomodoroTaskAction(taskId, 'complete')) {
        boundTask = null;
        setTaskActionsVisible(false);
        renderTaskPicker();
        persistSession();
      } else new obsidian.Notice(self._lang() === 'en' ? 'This task no longer exists or could not be saved.' : '这个待办已不存在或保存失败。');
    };
    deferTaskBtn.onclick = async () => {
      if (!boundTask) return;
      if (await self._applyPomodoroTaskAction(boundTask.id, 'tomorrow')) {
        setTaskActionsVisible(false);
        renderTaskPicker();
        persistSession();
      } else new obsidian.Notice(self._lang() === 'en' ? 'This task no longer exists or could not be saved.' : '这个待办已不存在或保存失败。');
    };

    // 最小化
    toggleBtn.onclick = () => {
      minimized = !minimized;
      body.style.display = minimized ? 'none' : 'block';
      floatEl.classList.toggle(PID + '-pomodoro-minimized', minimized);
      toggleBtn.textContent = minimized ? '+' : '−';
      if (!isMobile) floatEl.style.width = minimized ? '126px' : '218px';
      syncPomodoroText();
      persistSession();
    };

    // 关闭；同时暴露幂等销毁钩子，供后续热升级安全清理 interval / observer。
    let destroyed = false;
    function destroyPomodoro(options = {}) {
      if (destroyed) return;
      destroyed = true;
      clearInterval(timerInterval);
      timerInterval = null;
      clearTimeout(reminderResetTimer);
      clearTimeout(cueTimer);
      if (typeof visibilityTick === 'function') document.removeEventListener('visibilitychange', visibilityTick);
      if (themeObserver) themeObserver.disconnect();
      finishDrag(dragPointerId);
      floatEl.remove();
      self._pomodoroTimer = null;
      if (options.preserveSession) persistSession();
      else clearSession();
    }
    floatEl._cockpitDestroy = destroyPomodoro;
    closeBtn.onclick = () => destroyPomodoro();

    // 拖拽
    let dragOffsetX = 0, dragOffsetY = 0;
    let dragPointerId = null;
    let dragStartX = 0, dragStartY = 0;
    let dragPending = false;
    let isDragging = false;
    const dragThreshold = 6;

    function isHeaderControl(target) {
      return target === toggleBtn || target === closeBtn || btnGroup.contains(target);
    }

    function clampPosition(left, top) {
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - floatEl.offsetWidth - margin);
      const maxTop = Math.max(margin, window.innerHeight - floatEl.offsetHeight - margin);
      return {
        left: Math.min(Math.max(margin, left), maxLeft),
        top: Math.min(Math.max(margin, top), maxTop)
      };
    }

    function finishDrag(pointerId) {
      if (pointerId != null && header.hasPointerCapture && header.hasPointerCapture(pointerId)) {
        header.releasePointerCapture(pointerId);
      }
      dragPointerId = null;
      dragPending = false;
      isDragging = false;
      floatEl.style.transition = 'box-shadow 0.25s,border-color 0.25s,transform 0.25s,background 0.25s';
    }

    header.addEventListener('pointerdown', (e) => {
      if (isMobile) return;
      if (isHeaderControl(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = floatEl.getBoundingClientRect();
      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      dragPending = true;
      isDragging = false;
      if (header.setPointerCapture) header.setPointerCapture(e.pointerId);
    });

    header.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dragPointerId) return;
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      if (dragPending) {
        if (Math.hypot(deltaX, deltaY) < dragThreshold) return;
        dragPending = false;
        isDragging = true;
        floatEl.style.transition = 'none';
      }
      if (!isDragging) return;
      const next = clampPosition(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
      floatEl.style.left = next.left + 'px';
      floatEl.style.top = next.top + 'px';
      floatEl.style.right = 'auto';
      floatEl.style.bottom = 'auto';
    });

    header.addEventListener('pointerup', (e) => {
      if (e.pointerId !== dragPointerId) return;
      finishDrag(e.pointerId);
    });
    header.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== dragPointerId) return;
      finishDrag(e.pointerId);
    });
    // 格式化时间
    function fmtTime(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    }

    function pulseReminder(message, accent, forceNotice) {
      const tokens = getThemeTokens();
      clearTimeout(reminderResetTimer);
      floatEl.style.borderColor = accent;
      floatEl.style.boxShadow = '0 0 0 1px ' + accent + ', 0 16px 32px ' + tokens.accentShadow;
      floatEl.style.transform = 'translateY(-3px)';
      reminderResetTimer = setTimeout(() => {
        applyVisualState();
        floatEl.style.transform = 'translateY(0)';
      }, 1800);
      if (forceNotice || minimized || document.hidden) {
        new obsidian.Notice(message, 2600);
      }
    }

    // 更新显示
    function updateDisplay() {
      timerEl.textContent = fmtTime(remaining);
      syncPomodoroText();
    }

    function startBreakFromReminder() {
      if (!floatEl.isConnected || !isBreak || isRunning) return;
      startBtn.click();
    }

    // 开始/暂停
    const pausePomodoro = () => {
      clearInterval(timerInterval);
      timerInterval = null;
      if (Number.isFinite(endAt)) remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      endAt = null;
      isRunning = false;
      startLabelKey = 'pomodoro.resume';
      statusKey = isBreak ? 'pomodoro.breakPaused' : 'pomodoro.focusPaused';
      statusEl.style.color = '#f59e0b';
      syncPomodoroText();
      persistSession();
    };

    let pomodoroTicking = false;
    const tickPomodoro = async () => {
      if (pomodoroTicking || !isRunning) return;
      pomodoroTicking = true;
      try {
        // 用 endAt 换算剩余时间：interval 被浏览器节流或系统休眠暂停后，恢复时能立即校正，
        // 完成事件按真实时间触发，不再随后台节流漂移。
        if (Number.isFinite(endAt)) {
          const synced = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
          if (synced !== remaining) { remaining = synced; updateDisplay(); }
        }
        if (remaining > 0) return;
        clearInterval(timerInterval);
        timerInterval = null;
        endAt = null;
        isRunning = false;
        if (!isBreak) {
          // 专注完成
          if (boundTask) {
            setTaskActionsVisible(true);
          }
          statusKey = 'pomodoro.completedOne';
          statusEl.style.color = '#22c55e';
          startLabelKey = 'pomodoro.startBreak';
          isBreak = true;
          totalSeconds = POMODORO_BREAK_MINUTES * 60;
          remaining = totalSeconds;
          flashCue(t('pomodoro.readyForBreak'), '#22c55e', 3600, false, 'pomodoro.readyForBreak');
          if (self._pomodoroFullscreen === true) {
            self._plugin.alarms?.showFullscreenReminder({
              id:'pomodoro-focus-' + Date.now(),
              language:self._lang(),
              title:t('pomodoro.focusFinishedTitle'),
              subtitle:t('pomodoro.focusFinishedSubtitle'),
              stopLabel:self._lang() === 'en' ? 'Start break' : '开始休息',
              onStop:startBreakFromReminder
            });
          }
          const completion = {
            id:'focus-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
            day:window.moment().format('YYYY-MM-DD'),
            minutes:POMODORO_FOCUS_MINUTES,
            currentFocusMinutes:self._focusMinutes || 0,
            task:boundTask ? { id:boundTask.id, text:boundTask.text } : null,
            completedAt:new Date().toISOString()
          };
          pendingCompletion = completion;
          try {
            // data.json 中的任务统计与“已切到休息”状态一次提交；focus.md 失败时会在下次启动补写。
            pendingCompletion = null;
            const outcome = await self._commitPomodoroCompletion(completion, currentSession());
            await self._applyPomodoroCompletionToFocusHistory(outcome.entry);
            syncTaskMeta();
          } catch (e) {
            console.warn('Cockpit: commit focus completion failed', e);
            // 若首次 data.json 提交失败，把同一个 completion ID 放进会话；恢复时仍按幂等键补记。
            pendingCompletion = completion;
            new obsidian.Notice(self._lang() === 'en' ? 'Focus was completed, but saving failed. Cockpit will retry on next launch.' : '专注已完成，但保存失败；Cockpit 会在下次启动时重试。');
            await persistSession();
          }
          if (self._updateStatsRef) self._updateStatsRef();
        } else {
          // 休息完成
          statusKey = 'pomodoro.breakEnd';
          statusEl.style.color = BREAK_ACCENT;
          startLabelKey = 'pomodoro.start';
          isBreak = false;
          totalSeconds = POMODORO_FOCUS_MINUTES * 60;
          remaining = totalSeconds;
          flashCue(t('pomodoro.readyForFocus'), BREAK_ACCENT, 5200, minimized || document.hidden, 'pomodoro.readyForFocus');
          if (self._pomodoroFullscreen === true && self._pomodoroBreakReminder !== false) {
            self._plugin.alarms?.showFullscreenReminder({
              id:'pomodoro-break-' + Date.now(),
              language:self._lang(),
              title:t('pomodoro.breakFinishedTitle'),
              subtitle:t('pomodoro.breakFinishedSubtitle'),
              stopLabel:self._lang() === 'en' ? 'Back to focus' : '回到专注'
            });
          }
        }
        if (isBreak === false) await persistSession();
        updateDisplay();
      } finally { pomodoroTicking = false; }
    };

    // 窗口重新可见时立即校正一次，避免等待下一个被节流的 interval。
    const visibilityTick = () => { if (!document.hidden && isRunning) void tickPomodoro(); };
    document.addEventListener('visibilitychange', visibilityTick);

    startBtn.onclick = () => {
      if (isRunning) {
        pausePomodoro();
        return;
      }
      // 开始
      if (!isBreak && remaining === totalSeconds && boundTask) {
        const liveTodo = (self._todos || []).find((todo) => todo.id === boundTask.id && !todo.done);
        if (!liveTodo) {
          boundTask = null;
          setTaskActionsVisible(false);
          renderTaskPicker();
          persistSession();
          new obsidian.Notice(self._lang() === 'en' ? 'The linked task is no longer pending. Choose another task.' : '关联待办已完成或不存在，请重新选择。');
          return;
        }
        boundTask = pomodoroTaskRef(liveTodo);
      }
      isRunning = true;
      endAt = Date.now() + remaining * 1000;
      startLabelKey = 'pomodoro.pause';
      statusKey = isBreak ? 'pomodoro.resting' : 'pomodoro.focusing';
      statusEl.style.color = isBreak ? '#22c55e' : '#ef4444';
      syncPomodoroText();
      persistSession();
      timerInterval = setInterval(() => { void tickPomodoro(); }, 1000);
    };

    // 重置
    resetBtn.onclick = () => {
      clearInterval(timerInterval);
      timerInterval = null;
      endAt = null;
      isRunning = false;
      isBreak = false;
      totalSeconds = POMODORO_FOCUS_MINUTES * 60;
      remaining = totalSeconds;
      startLabelKey = 'pomodoro.start';
      statusKey = 'pomodoro.ready';
      statusEl.style.color = 'var(--text-muted)';
      setCue('', '');
      updateDisplay();
      clearSession();
    };

    // 保存引用
    self._pomodoroTimer = timerInterval;

    startBtn.onmouseenter = () => { startBtn.style.transform = 'translateY(-1px)'; };
    startBtn.onmouseleave = () => { startBtn.style.transform = 'translateY(0)'; };
    resetBtn.onmouseenter = () => { resetBtn.style.transform = 'translateY(-1px)'; };
    resetBtn.onmouseleave = () => { resetBtn.style.transform = 'translateY(0)'; };

    if (minimized) {
      body.style.display = 'none';
      floatEl.classList.add(PID + '-pomodoro-minimized');
      toggleBtn.textContent = '+';
      if (!isMobile) floatEl.style.width = '126px';
    }
    renderTaskPicker();
    if (initialTodo) floatEl._cockpitSelectTask(initialTodo);
    updateDisplay();
    if (restoredSession?.isRunning) startBtn.onclick();
    return floatEl;
}
