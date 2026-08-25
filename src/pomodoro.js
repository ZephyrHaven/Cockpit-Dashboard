// pomodoro.js — 番茄钟模块
// 导出：buildPomodoro(view, root)
// view: CockpitView 实例，root: DOM 容器

function buildPomodoro(view, root) {
  const PID = PLUGIN_ID;
  const self = view;

  // 全局单例：如果已存在则复用，不重建
  const existing = document.querySelector('.' + PID + '-pomodoro');
  if (existing) return;

  const floatEl = document.createElement('div');
  floatEl.className = PID + '-pomodoro';
  floatEl.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999;width:180px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,0.18);font-family:-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;transition:box-shadow 0.2s;';

  const header = floatEl.createDiv({ cls: PID + '-pomo-header' });
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:linear-gradient(135deg,#f97316,#ef4444);cursor:move;user-select:none;';
  const titleSpan = header.createSpan({ text: '🍅 番茄钟', attr: { style: 'font-size:0.82em;font-weight:700;color:white;' } });
  const btnGroup = header.createDiv({ attr: { style: 'display:flex;gap:6px;align-items:center;' } });
  const toggleBtn = btnGroup.createSpan({ text: '−', attr: { style: 'font-size:1.1em;color:white;cursor:pointer;padding:0 4px;', title: '最小化' } });
  const closeBtn = btnGroup.createSpan({ text: '×', attr: { style: 'font-size:1.2em;color:white;cursor:pointer;padding:0 4px;', title: '关闭番茄钟' } });

  const body = floatEl.createDiv({ cls: PID + '-pomo-body' });
  body.style.cssText = 'padding:12px;text-align:center;';

  const statusEl = body.createDiv({ text: '准备开始', attr: { style: 'font-size:0.72em;color:var(--text-muted);margin-bottom:6px;' } });
  const timerEl = body.createDiv({ text: '25:00', attr: { style: 'font-size:2.2em;font-weight:800;color:var(--text-normal);font-variant-numeric:tabular-nums;letter-spacing:2px;' } });
  const progWrap = body.createDiv({ attr: { style: 'height:4px;background:var(--background-modifier-border);border-radius:2px;margin:8px 0;overflow:hidden;' } });
  const progFill = progWrap.createDiv({ attr: { style: 'height:100%;width:0%;background:linear-gradient(90deg,#f97316,#ef4444);border-radius:2px;transition:width 0.3s;' } });
  const btnRow = body.createDiv({ attr: { style: 'display:flex;gap:6px;justify-content:center;margin-top:4px;' } });
  const startBtn = btnRow.createEl('button', { text: '▶ 开始', attr: { style: 'padding:5px 14px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--interactive-accent);color:white;font-size:0.72em;font-weight:600;cursor:pointer;transition:all 0.15s;' } });
  const resetBtn = btnRow.createEl('button', { text: '↺ 重置', attr: { style: 'padding:5px 14px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-muted);font-size:0.72em;font-weight:600;cursor:pointer;transition:all 0.15s;' } });
  const todayFocus = body.createDiv({ text: '今日专注: 0 min', attr: { style: 'font-size:0.68em;color:var(--text-muted);margin-top:8px;' } });
  const countEl = body.createDiv({ text: '🍅 × 0', attr: { style: 'font-size:0.68em;color:var(--text-muted);margin-top:2px;' } });

  document.body.appendChild(floatEl);

  let totalSeconds = 25 * 60;
  let remaining = totalSeconds;
  let isRunning = false;
  let isBreak = false;
  let pomodoroCount = 0;
  let timerInterval = null;
  let minimized = false;

  // 拖拽
  let dragOffsetX = 0, dragOffsetY = 0, isDragging = false;
  header.addEventListener('mousedown', (e) => { if (e.target === toggleBtn || e.target === closeBtn || e.target.parentElement === btnGroup) return; isDragging = true; const rect = floatEl.getBoundingClientRect(); dragOffsetX = e.clientX - rect.left; dragOffsetY = e.clientY - rect.top; floatEl.style.transition = 'none'; });
  document.addEventListener('mousemove', (e) => { if (!isDragging) return; floatEl.style.left = (e.clientX - dragOffsetX) + 'px'; floatEl.style.top = (e.clientY - dragOffsetY) + 'px'; floatEl.style.right = 'auto'; floatEl.style.bottom = 'auto'; });
  document.addEventListener('mouseup', () => { isDragging = false; floatEl.style.transition = 'box-shadow 0.2s'; });

  // 最小化
  toggleBtn.onclick = () => { minimized = !minimized; body.style.display = minimized ? 'none' : 'block'; toggleBtn.textContent = minimized ? '+' : '−'; toggleBtn.title = minimized ? '展开' : '最小化'; floatEl.style.width = minimized ? '140px' : '180px'; titleSpan.textContent = minimized ? '🍅 ' + fmtTime(remaining) : '🍅 番茄钟'; };

  // 关闭
  closeBtn.onclick = () => { clearInterval(timerInterval); floatEl.remove(); self._pomodoroTimer = null; };

  function fmtTime(s) { const m = Math.floor(s / 60); const sec = s % 60; return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0'); }

  function updateDisplay() {
    timerEl.textContent = fmtTime(remaining);
    progFill.style.width = ((totalSeconds - remaining) / totalSeconds * 100) + '%';
    todayFocus.textContent = '今日专注: ' + (self._focusMinutes || 0) + ' min';
    countEl.textContent = '🍅 × ' + pomodoroCount;
    if (minimized) titleSpan.textContent = '🍅 ' + fmtTime(remaining);
  }

  startBtn.onclick = () => {
    if (isRunning) {
      clearInterval(timerInterval); isRunning = false; startBtn.textContent = '▶ 继续';
      statusEl.textContent = isBreak ? '休息暂停' : '专注暂停'; statusEl.style.color = '#f59e0b';
    } else {
      isRunning = true; startBtn.textContent = '⏸ 暂停';
      statusEl.textContent = isBreak ? '休息中...' : '专注中...'; statusEl.style.color = isBreak ? '#22c55e' : '#ef4444';
      timerInterval = setInterval(() => {
        remaining--; updateDisplay();
        if (remaining <= 0) {
          clearInterval(timerInterval); isRunning = false;
          if (!isBreak) {
            pomodoroCount++; self._focusMinutes = (self._focusMinutes || 0) + 25;
            (async () => { try { const today = window.moment().format('YYYY-MM-DD'); const content = '# 专注记录\n\ndate: ' + today + '\nminutes: ' + self._focusMinutes + '\n'; if (!self.app.vault.getAbstractFileByPath('_data')) await self.app.vault.createFolder('_data'); const f = self.app.vault.getAbstractFileByPath('_data/focus.md'); if (f) await self.app.vault.modify(f, content); else await self.app.vault.create('_data/focus.md', content); } catch(e) { console.warn('save focus', e); } })();
            statusEl.textContent = '✅ 完成一个番茄！'; statusEl.style.color = '#22c55e'; startBtn.textContent = '▶ 开始休息'; isBreak = true; totalSeconds = 5 * 60; remaining = totalSeconds;
            if (self._updateStatsRef) self._updateStatsRef();
          } else {
            statusEl.textContent = '休息结束'; statusEl.style.color = 'var(--text-muted)'; startBtn.textContent = '▶ 开始'; isBreak = false; totalSeconds = 25 * 60; remaining = totalSeconds;
          }
          updateDisplay();
        }
      }, 1000);
    }
  };

  resetBtn.onclick = () => { clearInterval(timerInterval); isRunning = false; isBreak = false; totalSeconds = 25 * 60; remaining = totalSeconds; startBtn.textContent = '▶ 开始'; statusEl.textContent = '准备开始'; statusEl.style.color = 'var(--text-muted)'; updateDisplay(); };

  self._pomodoroTimer = timerInterval;
  updateDisplay();
}
