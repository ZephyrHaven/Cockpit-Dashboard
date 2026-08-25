// pomodoro.js — 番茄钟的唯一公共入口。
// 视图只负责提供运行时依赖；浮窗复用和绑定都从这里进入，避免调用方耦合内部实现。

function buildPomodoro(view, root) {
  if (!view) {
    console.warn('Cockpit: buildPomodoro failed, view is unavailable');
    return;
  }
  return createPomodoro(view, root);
}

function createPomodoro(view, root) {
    const PID = PLUGIN_ID;
    let self = view;
    const t = (key, vars) => self._t(key, vars);

    // 全局单例：如果已存在则复用，不重建
    const existing = document.querySelector('.' + PID + '-pomodoro');
    if (existing) {
      if (typeof existing._cockpitBindPomodoroView === 'function') {
        existing._cockpitBindPomodoroView(view);
      }
      if (typeof existing._cockpitSyncLanguage === 'function') {
        existing._cockpitSyncLanguage();
      }
      if (typeof existing._cockpitSyncTheme === 'function') {
        existing._cockpitSyncTheme();
      }
      return;
    }

    // 创建浮动容器
    const floatEl = document.createElement('div');
    floatEl.className = PID + '-pomodoro';
    floatEl.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:999;width:198px;max-width:calc(100vw - 24px);font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;border-radius:18px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:box-shadow 0.25s,border-color 0.25s,transform 0.25s,background 0.25s;';

    // 标题栏（拖拽区域）
    const header = floatEl.createDiv({ cls: PID + '-pomo-header' });
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;cursor:move;user-select:none;-webkit-user-select:none;touch-action:none;border-bottom:1px solid transparent;';
    const headerLeft = header.createDiv({ attr: { style: 'display:flex;flex-direction:column;gap:0;min-width:0;' } });
    const modeChip = headerLeft.createDiv({ attr: { style: 'display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:3px 8px;border-radius:999px;font-size:0.6em;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;' } });
    const titleSpan = headerLeft.createSpan({ text: t('pomodoro.title'), attr: { style: 'display:none;font-size:1.05em;font-weight:800;color:var(--text-normal);line-height:1.05;' } });
    const dragHint = headerLeft.createSpan({ text: t('pomodoro.dragHint'), attr: { style: 'display:none;font-size:0.62em;color:var(--text-muted);line-height:1;' } });
    const btnGroup = header.createDiv({ attr: { style: 'display:flex;gap:6px;align-items:center;flex-shrink:0;' } });
    const toggleBtn = btnGroup.createSpan({ text: '−', attr: { style: 'width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:var(--text-normal);cursor:pointer;touch-action:manipulation;font-size:1em;font-weight:700;', title: t('pomodoro.minimize') } });
    const closeBtn = btnGroup.createSpan({ text: '×', attr: { style: 'width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;color:var(--text-normal);cursor:pointer;touch-action:manipulation;font-size:1.05em;font-weight:700;', title: t('pomodoro.close') } });

    // 内容区
    const body = floatEl.createDiv({ cls: PID + '-pomo-body' });
    body.style.cssText = 'padding:6px 10px 10px;text-align:center;';

    const statusEl = body.createDiv({ text: t('pomodoro.ready'), attr: { style: 'display:none;align-items:center;justify-content:center;min-height:22px;padding:4px 9px;border-radius:999px;font-size:0.64em;font-weight:700;color:var(--text-muted);margin-bottom:0;' } });

    const dialWrap = body.createDiv({ attr: { style: 'display:flex;justify-content:center;margin-bottom:6px;' } });
    const dialEl = dialWrap.createDiv({ attr: { style: 'position:relative;width:112px;height:112px;border-radius:50%;padding:7px;display:flex;align-items:center;justify-content:center;' } });
    const dialInner = dialEl.createDiv({ attr: { style: 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;' } });
    const timerStack = dialInner.createDiv({ attr: { style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;' } });
    const timerEl = timerStack.createDiv({ text: '25:00', attr: { style: 'font-size:1.75em;font-weight:800;color:var(--text-normal);font-variant-numeric:tabular-nums;letter-spacing:1px;line-height:1;' } });
    const timerSub = timerStack.createDiv({ text: t('pomodoro.backToWork'), attr: { style: 'display:none;font-size:0.62em;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:var(--text-muted);opacity:0.82;' } });

    const cueEl = body.createDiv({ attr: { style: 'display:none;min-height:16px;margin:0 auto 6px;padding:0 6px;font-size:0.62em;font-weight:700;line-height:1.25;' } });

    const metricsRow = body.createDiv({ attr: { style: 'display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:8px;padding:6px 10px;border-radius:12px;font-size:0.62em;font-weight:700;color:var(--text-muted);line-height:1;white-space:nowrap;' } });
    const todayFocus = metricsRow.createSpan({ text: t('pomodoro.focusToday', { minutes: 0 }) });
    const metricsSep = metricsRow.createSpan({ text: '·', attr: { style: 'opacity:0.45;' } });
    const countEl = metricsRow.createSpan({ text: '🍅 × 0' });

    const btnRow = body.createDiv({ attr: { style: 'display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr);gap:8px;' } });
    const startBtn = btnRow.createEl('button', { text: t('pomodoro.start'), attr: { style: 'min-height:32px;padding:7px 10px;border-radius:11px;border:1px solid transparent;color:white;font-size:0.7em;font-weight:800;cursor:pointer;transition:transform 0.15s,box-shadow 0.2s,background 0.2s;' } });
    const resetBtn = btnRow.createEl('button', { text: t('pomodoro.reset'), attr: { style: 'min-height:32px;padding:7px 10px;border-radius:11px;border:1px solid var(--background-modifier-border);background:transparent;color:var(--text-normal);font-size:0.68em;font-weight:700;cursor:pointer;transition:transform 0.15s,background 0.2s,border-color 0.2s;' } });

    document.body.appendChild(floatEl);

    // 状态变量：会话独立于“是否自动显示”保存，避免正在使用时被设置误伤。
    const restoredSession = view._pomodoroSession?.active ? view._pomodoroSession : null;
    let totalSeconds = restoredSession?.isBreak ? 5 * 60 : 25 * 60;
    let remaining = Number.isFinite(restoredSession?.remaining) ? Math.max(0, Math.min(totalSeconds, restoredSession.remaining)) : totalSeconds;
    if (restoredSession?.isRunning && Number.isFinite(restoredSession.endAt)) {
      remaining = Math.max(1, Math.ceil((restoredSession.endAt - Date.now()) / 1000));
    }
    let isRunning = false;
    let isBreak = false;
    let timerInterval = null;
    let minimized = !!restoredSession?.minimized;
    let reminderResetTimer = null;
    let cueTimer = null;
    let themeObserver = null;
    let statusKey = 'pomodoro.ready';
    let startLabelKey = 'pomodoro.start';
    let cueText = '';
    let cueKey = '';

    function persistSession() {
      const session = {
        active: true,
        isBreak,
        isRunning,
        remaining,
        endAt: isRunning ? Date.now() + remaining * 1000 : null,
        minimized
      };
      self._savePomodoroSession(session).catch((e) => console.warn('Cockpit: save pomodoro session failed', e));
    }

    function clearSession() {
      self._savePomodoroSession(null).catch((e) => console.warn('Cockpit: clear pomodoro session failed', e));
    }

    const FOCUS_ACCENT = '#ff6b57';
    const BREAK_ACCENT = '#48b4ff';

    function getPomodoroCount() {
      return Math.max(0, Math.floor((self._focusMinutes || 0) / 25));
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
      statusEl.textContent = t(statusKey);
      startBtn.textContent = t(startLabelKey);
      resetBtn.textContent = t('pomodoro.reset');
      todayFocus.textContent = t('pomodoro.focusToday', { minutes: self._focusMinutes || 0 });
      if (cueKey) {
        cueText = t(cueKey);
        cueEl.textContent = cueText;
      }
      countEl.textContent = '🍅 × ' + getPomodoroCount();
      if (minimized) {
        modeChip.style.display = 'none';
        titleSpan.style.display = 'block';
        titleSpan.textContent = fmtTime(remaining);
        metricsRow.style.display = 'none';
        btnRow.style.display = 'none';
        cueEl.style.display = 'none';
      } else {
        modeChip.style.display = 'inline-flex';
        titleSpan.style.display = 'none';
        metricsRow.style.display = 'flex';
        btnRow.style.display = 'grid';
        if (!cueText) cueEl.style.display = 'none';
      }
      applyVisualState();
    }

    floatEl._cockpitBindPomodoroView = (nextView) => {
      if (nextView) self = nextView;
    };
    floatEl._cockpitSyncLanguage = syncPomodoroText;
    floatEl._cockpitSyncTheme = () => applyVisualState();
    // Obsidian 会在定时主题切换时替换 body 的 theme-light/theme-dark class；运行中的浮窗不重建，也要同步重绘。
    themeObserver = new MutationObserver(() => {
      if (floatEl.isConnected) applyVisualState();
    });
    themeObserver.observe(document.body, { attributes:true, attributeFilter:['class'] });

    // 最小化
    toggleBtn.onclick = () => {
      minimized = !minimized;
      body.style.display = minimized ? 'none' : 'block';
      toggleBtn.textContent = minimized ? '+' : '−';
      floatEl.style.width = minimized ? '126px' : '198px';
      syncPomodoroText();
      persistSession();
    };

    // 关闭
    closeBtn.onclick = () => { clearInterval(timerInterval); clearTimeout(reminderResetTimer); clearTimeout(cueTimer); if (themeObserver) themeObserver.disconnect(); finishDrag(dragPointerId); floatEl.remove(); self._pomodoroTimer = null; clearSession(); };

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

    // 开始/暂停
    startBtn.onclick = () => {
      if (isRunning) {
        // 暂停
        clearInterval(timerInterval);
        isRunning = false;
        startLabelKey = 'pomodoro.resume';
        statusKey = isBreak ? 'pomodoro.breakPaused' : 'pomodoro.focusPaused';
        statusEl.style.color = '#f59e0b';
        syncPomodoroText();
        persistSession();
      } else {
        // 开始
        isRunning = true;
        startLabelKey = 'pomodoro.pause';
        statusKey = isBreak ? 'pomodoro.resting' : 'pomodoro.focusing';
        statusEl.style.color = isBreak ? '#22c55e' : '#ef4444';
        syncPomodoroText();
        persistSession();
        timerInterval = setInterval(() => {
          remaining--;
          updateDisplay();
          if (remaining <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            if (!isBreak) {
              // 专注完成
              self._focusMinutes = (self._focusMinutes || 0) + 25;
              // 持久化到文件
              (async () => {
                try {
                  const today = window.moment().format('YYYY-MM-DD');
                  await self._saveFocusHistory(today, self._focusMinutes);
                  if (self._focusHistory) self._focusHistory.set(today, self._focusMinutes);
                } catch(e) { console.warn('save focus', e); }
              })();
              statusKey = 'pomodoro.completedOne';
              statusEl.style.color = '#22c55e';
              startLabelKey = 'pomodoro.startBreak';
              isBreak = true;
              totalSeconds = 5 * 60;
              remaining = totalSeconds;
              flashCue(t('pomodoro.readyForBreak'), '#22c55e', 3600, false, 'pomodoro.readyForBreak');
              // 刷新统计
              if (self._updateStatsRef) self._updateStatsRef();
            } else {
              // 休息完成
              statusKey = 'pomodoro.breakEnd';
              statusEl.style.color = BREAK_ACCENT;
              startLabelKey = 'pomodoro.start';
              isBreak = false;
              totalSeconds = 25 * 60;
              remaining = totalSeconds;
              flashCue(t('pomodoro.readyForFocus'), BREAK_ACCENT, 5200, minimized || document.hidden, 'pomodoro.readyForFocus');
            }
            persistSession();
            updateDisplay();
          }
        }, 1000);
      }
    };

    // 重置
    resetBtn.onclick = () => {
      clearInterval(timerInterval);
      isRunning = false;
      isBreak = false;
      totalSeconds = 25 * 60;
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
    self._updateStatsRef = null; // 将在 _buildAll 中设置

    startBtn.onmouseenter = () => { startBtn.style.transform = 'translateY(-1px)'; };
    startBtn.onmouseleave = () => { startBtn.style.transform = 'translateY(0)'; };
    resetBtn.onmouseenter = () => { resetBtn.style.transform = 'translateY(-1px)'; };
    resetBtn.onmouseleave = () => { resetBtn.style.transform = 'translateY(0)'; };

    if (minimized) {
      body.style.display = 'none';
      toggleBtn.textContent = '+';
      floatEl.style.width = '126px';
    }
    updateDisplay();
    if (restoredSession?.isRunning) startBtn.onclick();
}
