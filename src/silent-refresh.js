// silent-refresh.js — 静默刷新：让驾驶舱在后台保持数据新鲜，同时绝不打断正在输入的用户。
// 三条触发路径汇聚到同一个刷新循环：
//   1. 每分钟心跳：只刷英雄区文案，跨天时重建日历；
//   2. 每 15 分钟一次完整静默刷新（兜底轮询，防止事件丢失导致数据陈旧）；
//   3. 库内事件驱动（新增）：笔记变动后短防抖触发一次刷新，
//      待办/日历/统计在文件保存后秒级跟随，不再等待下一个轮询周期。
// 所有路径都经过同一道闸门：待办编辑器/欢迎层打开、布局编辑中、用户正在
// 面板内输入时绝不刷新；被闸下的事件记为待办，在空闲后的下一分钟心跳补跑。

const COCKPIT_VAULT_REFRESH_DEBOUNCE_MS = 2500;
const COCKPIT_MANAGED_WRITES = new WeakMap();

function cockpitMarkManagedWrite(vault, path, content) {
  let writes = COCKPIT_MANAGED_WRITES.get(vault);
  if (!writes) { writes = new Map(); COCKPIT_MANAGED_WRITES.set(vault, writes); }
  writes.set(path, { content, until:Date.now() + 10000 });
}
function cockpitVaultRefreshScope(path) {
  if (path === TODO_FILE) return 'todos';
  if (path === FOCUS_FILE) return 'focus';
  if (typeof HABIT_FILE === 'string' && path === HABIT_FILE) return 'habits';
  return 'notes';
}
function cockpitQueueRefreshScopes(view, scopes) {
  if (!view._vaultRefreshScopes) view._vaultRefreshScopes = new Set();
  scopes.forEach((scope) => view._vaultRefreshScopes.add(scope));
  view._vaultRefreshPending = true;
}
function cockpitManagedEchoMatches(view, scope, content) {
  if (scope === 'todos') return serializeTodos(parseTodosContent(content)) === serializeTodos(view._todos || []);
  if (scope === 'focus') return JSON.stringify(Array.from(view._parseFocusHistory(content)).sort()) === JSON.stringify(Array.from(view._focusHistory || []).sort());
  return false;
}
async function cockpitRefreshOptionalModule(view, name) {
  try { await view[name]?.(); }
  catch (error) { console.warn('Cockpit optional module refresh failed', name, error); }
}

function cockpitBindSilentRefreshSensors(view) {
  cockpitUnbindSilentRefreshSensors(view);
  const container = view.containerEl.children[1];
  if (!container) return;
  view._interactionSensorEl = container;
  view._interactionHandler = () => { view._lastInteractionAt = Date.now(); };
  ['pointerdown', 'keydown', 'input'].forEach((eventName) => {
    container.addEventListener(eventName, view._interactionHandler, true);
  });
}
function cockpitUnbindSilentRefreshSensors(view) {
  if (!view._interactionSensorEl || !view._interactionHandler) return;
  ['pointerdown', 'keydown', 'input'].forEach((eventName) => {
    view._interactionSensorEl.removeEventListener(eventName, view._interactionHandler, true);
  });
  view._interactionSensorEl = null;
  view._interactionHandler = null;
}
function cockpitIsSilentRefreshBlocked(view, ignoreRecentActivity) {
  if (view._todoEditorEl || view._welcomeCoverEl || view._editMode) return true;
  if (!ignoreRecentActivity && Date.now() - (view._lastInteractionAt || 0) < 30 * 1000) return true;
  const activeEl = document.activeElement;
  if (!(activeEl instanceof HTMLElement)) return false;
  if (!activeEl.closest('.' + PLUGIN_ID + '-root')) return false;
  return activeEl.matches('input, textarea, select, [contenteditable="true"]');
}
function cockpitStartSilentRefreshLoops(view) {
  if (view._minuteRefreshTimer) clearInterval(view._minuteRefreshTimer);
  if (view._refreshTimer) clearInterval(view._refreshTimer);
  if (view._visibilityRefreshHandler) {
    document.removeEventListener('visibilitychange', view._visibilityRefreshHandler);
  }
  view._refreshHeroSection();
  view._lastCalendarDateKey = window.moment().format('YYYY-MM-DD');
  view._minuteRefreshTimer = window.setInterval(() => {
    try {
      view._refreshHeroSection();
      const dateKey = window.moment().format('YYYY-MM-DD');
      if (dateKey !== view._lastCalendarDateKey) {
        view._lastCalendarDateKey = dateKey;
        if (!document.hidden && !cockpitIsSilentRefreshBlocked(view, true)) view._refreshCalendarRef?.();
      }
      // 事件驱动刷新被用户操作闸下时的补跑出口：空闲后立即追赶一次。
      if (view._vaultRefreshPending) cockpitRunVaultRefresh(view);
    } catch (e) {
      console.warn('Cockpit hero refresh failed', e);
    }
  }, 60 * 1000);
  view._refreshTimer = window.setInterval(async () => {
    try {
      await cockpitRunSilentRefreshCycle(view);
    } catch (e) {
      console.warn('Cockpit silent refresh failed', e);
    }
  }, 15 * 60 * 1000);
  view._visibilityRefreshHandler = () => {
    if (document.hidden) return;
    cockpitRunSilentRefreshCycle(view, { ignoreRecentActivity:true, scopes:view._vaultRefreshScopes?.size ? [] : ['full'] }).catch((e) => {
      console.warn('Cockpit visibility refresh failed', e);
    });
  };
  document.addEventListener('visibilitychange', view._visibilityRefreshHandler);
}
async function cockpitRunSilentRefreshCycle(view, options = {}) {
  view._refreshHeroSection();
  cockpitQueueRefreshScopes(view, options.scopes || ['full']);
  if (document.hidden || cockpitIsSilentRefreshBlocked(view, options.ignoreRecentActivity)) return;
  if (view._vaultRefreshInFlight) return view._vaultRefreshInFlight;
  view._vaultRefreshInFlight = (async () => {
    while (view._vaultRefreshScopes?.size && !view._vaultRefreshClosed && !document.hidden
      && !cockpitIsSilentRefreshBlocked(view, options.ignoreRecentActivity)) {
      const root = view.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
      if (!root) break;
      const scopes = new Set(view._vaultRefreshScopes);
      view._vaultRefreshScopes.clear();
      for (const [scope, content] of view._vaultRefreshEchoes || []) {
        if (cockpitManagedEchoMatches(view, scope, content)) scopes.delete(scope);
      }
      view._vaultRefreshEchoes?.clear();
      if (!scopes.size) continue;
      const current = () => {
        if (!view._vaultRefreshClosed && root === view.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root')) return true;
        if (!view._vaultRefreshClosed) cockpitQueueRefreshScopes(view, Array.from(scopes));
        return false;
      };
      const full = scopes.has('full');
      try {
        if (full) await view._reloadDashboardState();
        else {
          if (scopes.has('todos')) {
            const todos = await loadTodos(view.app.vault);
            if (!current()) return;
            view._todos = todos || [];
            await view._plugin.alarms?.syncTodos(view._todos).catch((error) => console.warn('Cockpit todo alarm sync failed', error));
            view._plugin.appleCalendar?.syncTodos(view._todos).catch((e) => console.warn('Cockpit calendar sync failed', e));
          }
          if (scopes.has('focus')) {
            const file = view.app.vault.getAbstractFileByPath(FOCUS_FILE);
            const content = file ? await view.app.vault.read(file) : '';
            if (!current()) return;
            view._focusHistory = view._parseFocusHistory(content);
            view._focusMinutes = view._focusHistory.get(window.moment().format('YYYY-MM-DD')) || 0;
          }
        }
        if (!current()) return;
        if (full || scopes.has('notes')) {
          view._allFiles = view.app.vault.getMarkdownFiles();
          view._updateStatsRef?.();
          view._refreshRecentSection(root, view._allFiles);
          await view._refreshBookmarkSection(root, view._allFiles);
          if (!current()) return;
          view._rebuildRecentStars();
        }
        if (full || scopes.has('focus')) await cockpitRefreshOptionalModule(view, '_refreshFocusChartRef');
        if (!current()) return;
        if (full || scopes.has('todos')) {
          if (view._refreshTodosRef) await view._refreshTodosRef({ persist: false });
          else { view._updateStatsRef?.(); view._refreshCalendarRef?.(); }
          await cockpitRefreshOptionalModule(view, '_refreshProjectsRef');
        } else if (scopes.has('focus')) view._updateStatsRef?.();
        if (!current()) return;
        if (full || scopes.has('habits')) await cockpitRefreshOptionalModule(view, '_refreshHabitsRef');
        if (!current()) return;
        if (full || scopes.has('todos') || scopes.has('focus') || scopes.has('habits')) {
          await cockpitRefreshOptionalModule(view, '_refreshAgendaRef');
          if (!current()) return;
          await cockpitRefreshOptionalModule(view, '_refreshWeeklyReviewRef');
        }
        if (!current()) return;
        if(full) { await cockpitRefreshOptionalModule(view,'_refreshRunHistoryRef'); await cockpitRefreshOptionalModule(view,'_refreshSyncHealthRef'); }
        view._refreshHeroSection();
      } catch (error) {
        if (!view._vaultRefreshClosed) scopes.forEach((scope) => view._vaultRefreshScopes.add(scope));
        throw error;
      }
    }
  })();
  try { await view._vaultRefreshInFlight; }
  finally { view._vaultRefreshInFlight = null; view._vaultRefreshPending = !!view._vaultRefreshScopes?.size; }
}
function cockpitRunVaultRefresh(view) {
  if (document.hidden) return;
  if (cockpitIsSilentRefreshBlocked(view, true)) { view._vaultRefreshPending = true; return; }
  cockpitRunSilentRefreshCycle(view, { ignoreRecentActivity:true, scopes:[] }).catch((e) => {
    console.warn('Cockpit vault-event refresh failed', e);
  });
}
function cockpitRegisterVaultRefreshEvents(view) {
  // 库内事件驱动刷新：挂在与视图同生命周期的宿主事件注册表上，视图关闭自动解绑。
  // 面板自己维护的数据文件（待办/专注/日记）在写入后本就同步了内存状态，
  // 跳过它们避免「自己写 → 自己刷」的无谓抖动。
  if (view._vaultRefreshEventsRegistered) return;
  view._vaultRefreshEventsRegistered = true;
  view._vaultRefreshClosed = false;
  let debounceTimer = null;
  const scheduleVaultRefresh = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      cockpitRunVaultRefresh(view);
    }, COCKPIT_VAULT_REFRESH_DEBOUNCE_MS);
  };
  const onVaultChange = async (file, oldPath, checkManaged = true) => {
    if (view._vaultRefreshClosed) return;
    if (file && file.extension !== 'md' && !/\.md$/i.test(oldPath || '')) return;
    const path = file?.path;
    if (!path || path === '_data/team-todos.md') return;
    // 只跳过内容完全一致的插件写入。手工编辑同一文件仍会触发局部刷新。
    const hint = COCKPIT_MANAGED_WRITES.get(view.app.vault)?.get(path);
    const scope = cockpitVaultRefreshScope(path);
    view._vaultRefreshEchoes?.delete(scope);
    if (checkManaged && !oldPath && hint?.until > Date.now()) {
      try {
        if (await view.app.vault.cachedRead(file) === hint.content) {
          if (cockpitManagedEchoMatches(view, scope, hint.content)) return;
          if (!view._vaultRefreshEchoes) view._vaultRefreshEchoes = new Map();
          view._vaultRefreshEchoes.set(scope, hint.content);
        }
      } catch (e) { /* 删除或读取失败仍需刷新 */ }
      if (view._vaultRefreshClosed) return;
    }
    cockpitQueueRefreshScopes(view, [cockpitVaultRefreshScope(path), ...(oldPath ? [cockpitVaultRefreshScope(oldPath)] : [])]);
    scheduleVaultRefresh();
  };
  view.registerEvent(view.app.vault.on('create', (file) => onVaultChange(file)));
  view.registerEvent(view.app.vault.on('modify', (file) => onVaultChange(file)));
  view.registerEvent(view.app.vault.on('delete', (file) => onVaultChange(file, null, false)));
  view.registerEvent(view.app.vault.on('rename', (file, oldPath) => onVaultChange(file, oldPath, false)));
  view._cockpitVaultRefreshCancel = () => {
    if (debounceTimer) { window.clearTimeout(debounceTimer); debounceTimer = null; }
    view._vaultRefreshClosed = true;
    view._vaultRefreshEventsRegistered = false;
    view._vaultRefreshScopes?.clear();
    view._vaultRefreshEchoes?.clear();
  };
}
