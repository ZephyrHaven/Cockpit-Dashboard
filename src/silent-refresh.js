// silent-refresh.js — 静默刷新：让驾驶舱在后台保持数据新鲜，同时绝不打断正在输入的用户。
// 三条触发路径汇聚到同一个刷新循环：
//   1. 每分钟心跳：只刷英雄区文案，跨天时重建日历；
//   2. 每 15 分钟一次完整静默刷新（兜底轮询，防止事件丢失导致数据陈旧）；
//   3. 库内事件驱动（新增）：笔记变动后短防抖触发一次刷新，
//      待办/日历/统计在文件保存后秒级跟随，不再等待下一个轮询周期。
// 所有路径都经过同一道闸门：待办编辑器/欢迎层打开、布局编辑中、用户正在
// 面板内输入时绝不刷新；被闸下的事件记为待办，在空闲后的下一分钟心跳补跑。

const COCKPIT_VAULT_REFRESH_DEBOUNCE_MS = 2500;

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
    cockpitRunSilentRefreshCycle(view, { ignoreRecentActivity: true }).catch((e) => {
      console.warn('Cockpit visibility refresh failed', e);
    });
  };
  document.addEventListener('visibilitychange', view._visibilityRefreshHandler);
}
async function cockpitRunSilentRefreshCycle(view, options = {}) {
  view._refreshHeroSection();
  if (document.hidden || cockpitIsSilentRefreshBlocked(view, options.ignoreRecentActivity)) return;
  const root = view.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
  if (!root) return;
  view._vaultRefreshPending = false;
  await view._reloadDashboardState();
  view._allFiles = view.app.vault.getMarkdownFiles();
  if (view._refreshCalendarRef) view._refreshCalendarRef();
  if (view._refreshFocusChartRef) view._refreshFocusChartRef();
  if (view._refreshTodosRef) await view._refreshTodosRef({ persist: false });
  else if (view._updateStatsRef) view._updateStatsRef();
  view._refreshHeroSection();
  view._refreshRecentSection(root, view._allFiles);
  await view._refreshBookmarkSection(root, view._allFiles);
  view._rebuildRecentStars();
}
function cockpitRunVaultRefresh(view) {
  if (document.hidden) return;
  if (cockpitIsSilentRefreshBlocked(view, true)) { view._vaultRefreshPending = true; return; }
  cockpitRunSilentRefreshCycle(view, { ignoreRecentActivity: true }).catch((e) => {
    console.warn('Cockpit vault-event refresh failed', e);
  });
}
function cockpitRegisterVaultRefreshEvents(view) {
  // 库内事件驱动刷新：挂在与视图同生命周期的宿主事件注册表上，视图关闭自动解绑。
  // 面板自己维护的数据文件（待办/专注/日记）在写入后本就同步了内存状态，
  // 跳过它们避免「自己写 → 自己刷」的无谓抖动。
  if (view._vaultRefreshEventsRegistered) return;
  view._vaultRefreshEventsRegistered = true;
  let debounceTimer = null;
  const isSelfManagedPath = (filePath) => {
    if (!filePath) return true;
    return filePath === TODO_FILE || filePath === FOCUS_FILE
      || (DAILY_DIR && filePath.startsWith(DAILY_DIR + '/'))
      || filePath === '_data/team-todos.md'
      || filePath === view._plugin.teamSync?.path;
  };
  const scheduleVaultRefresh = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      cockpitRunVaultRefresh(view);
    }, COCKPIT_VAULT_REFRESH_DEBOUNCE_MS);
  };
  const onVaultChange = (file) => {
    if (document.hidden) return;
    if (isSelfManagedPath(file?.path)) return;
    if (file && file.extension !== 'md') return;
    scheduleVaultRefresh();
  };
  view.registerEvent(view.app.vault.on('modify', onVaultChange));
  view.registerEvent(view.app.vault.on('delete', onVaultChange));
  view.registerEvent(view.app.vault.on('rename', (file) => onVaultChange(file)));
  view._cockpitVaultRefreshCancel = () => {
    if (debounceTimer) { window.clearTimeout(debounceTimer); debounceTimer = null; }
  };
}
