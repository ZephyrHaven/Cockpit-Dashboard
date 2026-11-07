// pomodoro.js — 番茄钟的唯一公共入口。
// 视图只负责提供运行时依赖；浮窗复用和绑定都从这里进入，避免调用方耦合内部实现。

// 默认轮次时长（分钟）；自定义专注轮按实际分钟记账，番茄数仍按 25 分钟折算。
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
      if (existing._cockpitPomodoroFeatureVersion !== 7) {
        new obs.Notice(view._lang() === 'en' ? 'Close the existing timer, then reopen it to use the new stretchable timer.' : '请关闭当前旧番茄钟，再重新打开以使用可拉伸番茄钟。');
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

    const shell = createPomodoroShell(PID, isMobile, () => self._lang());
    const { floatEl, header, modeChip, titleSpan, btnGroup, toggleBtn, closeBtn, body,
      statusEl, taskRow, taskSelect, taskMeta, timerEl, cueEl, metricsRow, todayFocus, countEl,
      fullscreenRow, fullscreenToggle, fullscreenText, breakReminderRow, breakReminderToggle, breakReminderText,
      taskActions, taskActionAnnouncement, completeTaskBtn, keepTaskBtn, deferTaskBtn, startBtn, resetBtn } = shell;

    const reminderOwners = new Set();
    floatEl._cockpitSetReminderVisible = (owner, visible) => {
      if (visible) reminderOwners.add(owner); else reminderOwners.delete(owner);
      shell.setReminderVisible(reminderOwners.size > 0);
    };

    // 状态变量：会话独立于“是否自动显示”保存，避免正在使用时被设置误伤。
    const restoredSession = view._pomodoroSession?.active ? view._pomodoroSession : null;
    let focusMinutes = pomodoroDuration(restoredSession?.focusMinutes, POMODORO_FOCUS_MINUTES);
    let totalSeconds = pomodoroDuration(restoredSession?.totalSeconds / 60, restoredSession?.isBreak ? POMODORO_BREAK_MINUTES : focusMinutes) * 60;
    let layoutWidth = Number.isFinite(restoredSession?.layoutWidth) ? Math.max(POMODORO_MIN_WIDTH, Math.min(680, restoredSession.layoutWidth)) : 260;
    let awaitingChoice = ['focus','break'].includes(restoredSession?.awaitingChoice) ? restoredSession.awaitingChoice : null;
    let reminderModal = null;
    let remark = typeof restoredSession?.remark === 'string' ? restoredSession.remark.slice(0, 280) : '';
    shell.remarkInput.value = remark;
    let remaining = Number.isFinite(restoredSession?.remaining) ? Math.max(0, Math.min(totalSeconds, restoredSession.remaining)) : totalSeconds;
    if (restoredSession?.isRunning && Number.isFinite(restoredSession.endAt)) {
      remaining = Math.max(1, Math.ceil((restoredSession.endAt - Date.now()) / 1000));
    }
    let isRunning = false;
    let isBreak = !!restoredSession?.isBreak;
    let timerInterval = null;
    // 运行期以墙钟为准（endAt），后台标签页被节流或系统休眠后仍能正确倒计时。
    let endAt = null;
    let pinnedMinimal = restoredSession?.displayMode === 'minimal';
    let minimized = pinnedMinimal || (restoredSession?.displayMode ? restoredSession.displayMode === 'simple' : typeof restoredSession?.minimized === 'boolean' ? restoredSession.minimized : !!restoredSession?.isRunning);
    let restoringSession = !!restoredSession?.isRunning;
    let minimalHintShown = pinnedMinimal;
    let reminderResetTimer = null;
    let cueTimer = null;
    let themeObserver = null;
    let statusKey = restoredSession && remaining < totalSeconds ? (isBreak ? 'pomodoro.breakPaused' : 'pomodoro.focusPaused') : 'pomodoro.ready';
    let startLabelKey = restoredSession && remaining < totalSeconds ? 'pomodoro.resume' : 'pomodoro.start';
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
        totalSeconds,
        focusMinutes,
        layoutWidth,
        awaitingChoice,
        remark,
        endAt: isRunning ? endAt : null,
        minimized,
        displayMode:pinnedMinimal ? 'minimal' : minimized ? 'simple' : 'normal',
        position:shell.getPosition(),
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
          new obs.Notice(self._lang() === 'en' ? 'The linked task was completed or removed. This focus session will stay unlinked.' : '关联待办已完成或删除，本轮专注将不再关联任务。');
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
      return { accentShadow:'rgba(2,6,23,0.18)' };
    }

    function currentAccent() { return isBreak ? BREAK_ACCENT : FOCUS_ACCENT; }

    function applyVisualState(accentOverride) {
      const accent = accentOverride || currentAccent();
      const handAngle = Math.max(0, totalSeconds - remaining) * 6;
      floatEl.style.removeProperty('border-color');
      floatEl.style.removeProperty('box-shadow');
      floatEl.style.setProperty('--pomo-accent', accent);
      floatEl.style.setProperty('--pomo-hand-angle', handAngle + 'deg');
      modeChip.textContent = t(isBreak ? 'pomodoro.modeBreak' : 'pomodoro.modeFocus');
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
      titleSpan.textContent = fmtTime(remaining);
      toggleBtn.title = minimized ? t('pomodoro.expand') : t('pomodoro.minimize');
      closeBtn.title = t('pomodoro.close');
      toggleBtn.setAttribute('aria-label', minimized ? t('pomodoro.expand') : t('pomodoro.minimize'));
      closeBtn.setAttribute('aria-label', t('pomodoro.close'));
      statusEl.textContent = t(statusKey);
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
      breakReminderToggle.disabled = false;
      breakReminderText.textContent = t('pomodoro.breakReminder');
      breakReminderRow.title = t('pomodoro.breakReminderHint');
      breakReminderRow.classList.toggle('is-disabled', breakReminderToggle.disabled);
      syncTaskMeta();
      taskSelect.disabled = isRunning || (!isBreak && remaining < totalSeconds);
      taskActions.style.display = !minimized && taskActionsVisible ? 'grid' : 'none';
      shell.update({ minimized, pinnedMinimal, isRunning, hasProgress:remaining < totalSeconds, minutes:totalSeconds / 60,
        remaining, time:fmtTime(remaining), layoutWidth, taskText:boundTask?.text, remark, startLabel:t(startLabelKey), taskActionsVisible });
      applyVisualState();
    }

    floatEl._cockpitBindPomodoroView = (nextView) => {
      if (nextView) self = nextView;
      fullscreenToggle.checked = self._pomodoroFullscreen === true;
      breakReminderToggle.checked = self._pomodoroBreakReminder !== false;
      breakReminderToggle.disabled = false;
      renderTaskPicker();
    };
    floatEl._cockpitPomodoroFeatureVersion = 7;
    floatEl._cockpitSelectTask = (todo) => {
      const ref = pomodoroTaskRef(todo);
      if (!ref) return false;
      const hasProgress = !isBreak && remaining < totalSeconds;
      if (!canChangePomodoroTask(isRunning, hasProgress, boundTask, ref)) {
        new obs.Notice(self._lang() === 'en' ? 'Reset this focus session before switching tasks.' : '当前专注轮已有进度，请重置后再切换待办。');
        return false;
      }
      boundTask = ref;
      setTaskActionsVisible(false);
      pinnedMinimal = false;
      minimized = false;
      shell.showDetails();
      renderTaskPicker();
      setCue(t('pomodoro.taskBound', { task:ref.text }), '');
      syncPomodoroText();
      persistSession();
      return true;
    };
    floatEl._cockpitSyncLanguage = syncPomodoroText;
    floatEl._cockpitSyncTheme = () => applyVisualState();
    // 宿主应用会在定时主题切换时替换 body 的 theme-light/theme-dark class；运行中的浮窗不重建，也要同步重绘。
    themeObserver = new MutationObserver(() => {
      if (floatEl.isConnected) applyVisualState();
    });
    themeObserver.observe(document.body, { attributes:true, attributeFilter:['class'] });

    taskSelect.onchange = () => {
      const todo = (self._todos || []).find((item) => item.id === taskSelect.value && !item.done);
      const nextTask = todo ? pomodoroTaskRef(todo) : null;
      const hasProgress = !isBreak && remaining < totalSeconds;
      if (!canChangePomodoroTask(isRunning, hasProgress, boundTask, nextTask)) {
        new obs.Notice(self._lang() === 'en' ? 'Reset this focus session before switching tasks.' : '当前专注轮已有进度，请重置后再切换待办。');
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
      breakReminderToggle.disabled = false;
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
      } else new obs.Notice(self._lang() === 'en' ? 'This task no longer exists or could not be saved.' : '这个待办已不存在或保存失败。');
    };
    deferTaskBtn.onclick = async () => {
      if (!boundTask) return;
      if (await self._applyPomodoroTaskAction(boundTask.id, 'tomorrow')) {
        setTaskActionsVisible(false);
        renderTaskPicker();
        persistSession();
      } else new obs.Notice(self._lang() === 'en' ? 'This task no longer exists or could not be saved.' : '这个待办已不存在或保存失败。');
    };

    // 时长与备注只保存会话；运行后先重置再调整，避免改变已记账的专注时长。
    shell.onDuration = (minutes) => {
      if (isRunning || remaining < totalSeconds) return;
      totalSeconds = minutes * 60;
      remaining = totalSeconds;
      if (!isBreak) focusMinutes = minutes;
      updateDisplay();
    };
    shell.onPinMinimal = () => {
      pinnedMinimal = true; minimized = true;
      syncPomodoroText();
      if (!minimalHintShown) {
        minimalHintShown = true;
        new obs.Notice(self._lang() === 'en' ? 'Minimal timer pinned: drag to move; click to expand.' : '已固定极简模式：拖动移动，单击回到简洁模式。', 2600);
      }
    };
    shell.onUnpinMinimal = () => {
      pinnedMinimal = false; minimized = true;
      syncPomodoroText(); persistSession();
    };
    shell.onWidth = (width) => { layoutWidth = width; syncPomodoroText(); };
    shell.onRemark = (value) => { remark = value; };
    shell.onCommit = () => persistSession();
    toggleBtn.onclick = () => {
      pinnedMinimal = false;
      minimized = !minimized;
      if (!minimized) shell.showDetails();
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
      closeReminder();
      shell.destroy();
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
    let dragFeedbackX = 0, dragFeedbackY = 0;
    let dragPending = false;
    let isDragging = false;
    const dragThreshold = 6;

    function isHeaderControl(target) {
      return !!target.closest('button, input, select, label') || btnGroup.contains(target);
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
      const moved = isDragging;
      if (pointerId != null && header.hasPointerCapture && header.hasPointerCapture(pointerId)) {
        header.releasePointerCapture(pointerId);
      }
      dragPointerId = null;
      dragPending = false;
      isDragging = false;
      floatEl.style.removeProperty('transition');
      shell.endFeedback();
      if (moved && !destroyed) persistSession();
    }

    header.addEventListener('pointerdown', (e) => {
      if (isMobile) return;
      if (isHeaderControl(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = floatEl.getBoundingClientRect();
      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragFeedbackX = e.clientX;
      dragFeedbackY = e.clientY;
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
      if (Math.hypot(e.clientX - dragFeedbackX, e.clientY - dragFeedbackY) >= 12) {
        shell.feedbackTick(); dragFeedbackX = e.clientX; dragFeedbackY = e.clientY;
      }
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
      const seconds = Math.max(0, Math.floor(s));
      const h = Math.floor(seconds / 3600);
      const m = Math.floor(seconds / 60) % 60;
      const sec = seconds % 60;
      return (h > 0 ? [h, m, sec] : [m, sec]).map((value) => String(value).padStart(2, '0')).join(':');
    }

    function pulseReminder(message, accent, forceNotice) {
      const tokens = getThemeTokens();
      clearTimeout(reminderResetTimer);
      floatEl.style.borderColor = accent;
      floatEl.style.boxShadow = '0 0 0 1px ' + accent + ', 0 16px 32px ' + tokens.accentShadow;
      // 完成时不移动玻璃图层，避免与提醒层的背景采样叠加。
      reminderResetTimer = setTimeout(() => {
        applyVisualState();
        floatEl.style.removeProperty('transform');
      }, 1800);
      if (forceNotice || minimized || document.hidden) {
        new obs.Notice(message, 2600);
      }
    }

    // 更新显示
    function updateDisplay() {
      timerEl.textContent = fmtTime(remaining);
      syncPomodoroText();
    }

    function closeReminder() {
      const previous = reminderModal;
      reminderModal = null;
      previous?.close();
      floatEl._cockpitSetReminderVisible('pomodoro', false);
    }

    function startBreakFromReminder() {
      if (!floatEl.isConnected || !isBreak || isRunning) return;
      awaitingChoice = null;
      startBtn.click();
    }

    function startNextFocusFromReminder() {
      if (!floatEl.isConnected || isRunning) return;
      awaitingChoice = null;
      isBreak = false;
      totalSeconds = focusMinutes * 60;
      remaining = totalSeconds;
      startLabelKey = 'pomodoro.start';
      setTaskActionsVisible(false);
      setCue('', '');
      updateDisplay();
      startBtn.click();
    }

    function showCompletionReminder(kind, minutes) {
      if (destroyed || awaitingChoice !== kind || !floatEl.isConnected) return;
      closeReminder();
      const modal = new PomodoroReminderModal(self.app, {
        isBreak:kind === 'break', minutes, language:self._lang(), fullscreen:self._pomodoroFullscreen === true,
        remark:remark || boundTask?.text || '',
        onPrimary:kind === 'focus' ? startBreakFromReminder : startNextFocusFromReminder,
        onSecondary:kind === 'focus' ? startNextFocusFromReminder : () => { awaitingChoice = null; persistSession(); },
        onDismiss:(selected) => {
          if (reminderModal !== modal) return;
          reminderModal = null;
          floatEl._cockpitSetReminderVisible('pomodoro', false);
          if (!selected) { awaitingChoice = null; if (!destroyed) persistSession(); }
        }
      });
      reminderModal = modal;
      floatEl._cockpitSetReminderVisible('pomodoro', true);
      modal.open();
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
          const completedMinutes = totalSeconds / 60;
          minimized = pinnedMinimal;
          totalSeconds = POMODORO_BREAK_MINUTES * 60;
          remaining = totalSeconds;
          flashCue(t('pomodoro.readyForBreak'), '#22c55e', 3600, false, 'pomodoro.readyForBreak');
          awaitingChoice = 'focus';
          const completion = {
            id:'focus-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
            day:window.moment().format('YYYY-MM-DD'),
            minutes:completedMinutes,
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
            new obs.Notice(self._lang() === 'en' ? 'Focus was completed, but saving failed. Cockpit will retry on next launch.' : '专注已完成，但保存失败；Cockpit 会在下次启动时重试。');
            await persistSession();
          }
          if (self._updateStatsRef) self._updateStatsRef();
          showCompletionReminder('focus', completedMinutes);
        } else {
          // 休息完成
          statusKey = 'pomodoro.breakEnd';
          statusEl.style.color = BREAK_ACCENT;
          startLabelKey = 'pomodoro.start';
          isBreak = false;
          minimized = pinnedMinimal;
          const completedBreakMinutes = totalSeconds / 60;
          totalSeconds = focusMinutes * 60;
          remaining = totalSeconds;
          flashCue(t('pomodoro.readyForFocus'), BREAK_ACCENT, 5200, minimized || document.hidden, 'pomodoro.readyForFocus');
          if (self._pomodoroBreakReminder !== false) {
            awaitingChoice = 'break';
            await persistSession();
            showCompletionReminder('break', completedBreakMinutes);
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
      closeReminder();
      awaitingChoice = null;
      if (remaining === totalSeconds) shell.onDuration(pomodoroDuration(shell.durationInput.value, totalSeconds / 60));
      if (!isBreak && remaining === totalSeconds && boundTask) {
        const liveTodo = (self._todos || []).find((todo) => todo.id === boundTask.id && !todo.done);
        if (!liveTodo) {
          boundTask = null;
          setTaskActionsVisible(false);
          renderTaskPicker();
          persistSession();
          new obs.Notice(self._lang() === 'en' ? 'The linked task is no longer pending. Choose another task.' : '关联待办已完成或不存在，请重新选择。');
          return;
        }
        boundTask = pomodoroTaskRef(liveTodo);
      }
      isRunning = true;
      if (!restoringSession) minimized = true;
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
      closeReminder();
      awaitingChoice = null;
      clearInterval(timerInterval);
      timerInterval = null;
      endAt = null;
      isRunning = false;
      isBreak = false;
      minimized = pinnedMinimal;
      totalSeconds = focusMinutes * 60;
      remaining = totalSeconds;
      startLabelKey = 'pomodoro.start';
      statusKey = 'pomodoro.ready';
      statusEl.style.color = 'var(--text-muted)';
      setTaskActionsVisible(false);
      setCue('', '');
      updateDisplay();
      persistSession();
    };

    // 保存引用
    self._pomodoroTimer = timerInterval;

    startBtn.onmouseenter = () => { startBtn.style.transform = 'translateY(-1px)'; };
    startBtn.onmouseleave = () => { startBtn.style.transform = 'translateY(0)'; };
    resetBtn.onmouseenter = () => { resetBtn.style.transform = 'translateY(-1px)'; };
    resetBtn.onmouseleave = () => { resetBtn.style.transform = 'translateY(0)'; };

    renderTaskPicker();
    if (initialTodo) floatEl._cockpitSelectTask(initialTodo);
    updateDisplay();
    shell.restorePosition(restoredSession?.position);
    if (restoredSession && !minimized) shell.showDetails();
    if (restoredSession?.isRunning) startBtn.onclick();
    else if (awaitingChoice) showCompletionReminder(awaitingChoice, awaitingChoice === 'focus' ? focusMinutes : POMODORO_BREAK_MINUTES);
    restoringSession = false;
    return floatEl;
}
