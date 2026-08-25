class CockpitView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this._plugin = plugin; this._storage = null; this._rss = new CockpitRssService(plugin); this._todos = []; this._refreshTimer = null; this._minuteRefreshTimer = null; this._bookmarks = new Set(); this._bookmarkOrder = []; this._customToolbarButtons = []; this._toolbarOrder = []; this._deletedToolbarActions = new Set(); this._recentEl = null; this._allFiles = []; this._focusMinutes = 0; this._focusHistory = new Map(); this._focusChartSettings = { range:'week', type:'line' }; this._pomodoroTimer = null; this._pomodoroAutoShow = true; this._pomodoroSession = null; this._username = getText(DEFAULT_LANG, 'hero.defaultName'); this._language = DEFAULT_LANG; this._collapsed = {}; this._toolbarCmds = {}; this._onboardingDone = false; this._blankContextMenuItems = []; this._moduleOrder = this._defaultModuleOrder(); this._hiddenModules = new Set(['focusChart']); this._hiddenToolbarActions = new Set(); this._sceneLayouts = {}; this._activeSceneId = 'default'; this._sceneSwitcherRefresh = null; this._editMode = false; this._dragModuleId = null; this._todoEditorEl = null; this._pendingOnboarding = false; this._welcomeCoverEl = null; this._heroRefs = null; this._refreshTodosRef = null; this._refreshCalendarRef = null; this._refreshHeroReminder = null; this._visibilityRefreshHandler = null; this._interactionHandler = null; this._interactionSensorEl = null; this._lastInteractionAt = 0; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Cockpit'; }
  getIcon() { return 'layout-dashboard'; }
  _lang() { return normalizeLang(this._language); }
  _t(key, vars) { return getText(this._language, key, vars); }
  _isMobile() { return this.app.isMobile === true; }
  _syncResponsiveViewport() {
    const root = this.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
    if (!root) return;
    const rect = root.parentElement?.getBoundingClientRect() || root.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = Math.round(rect.width || window.innerWidth);
    const height = Math.round(Math.min(viewport?.height || window.innerHeight, window.innerHeight));
    root.style.setProperty('--cockpit-available-width', width + 'px');
    root.style.setProperty('--cockpit-available-height', height + 'px');
    root.classList.toggle(PLUGIN_ID + '-phone-narrow', this._isMobile() && width < 390);
    root.classList.toggle(PLUGIN_ID + '-phone', this._isMobile() && width < 680);
    root.classList.toggle(PLUGIN_ID + '-tablet', this._isMobile() && width >= 680 && width < 980);
  }
  // 模块契约：新增模块必须在此注册 id、默认排序、编辑态显示名与 DOM 归属规则。
  // 布局编辑、排序、隐藏和情景布局都只认这份注册表，避免新模块成为页面里的“例外”。
  _moduleRegistry() {
    return [
      { id:'hero', label:this._t('layout.modules.hero'), matches:(el) => el.classList.contains(PLUGIN_ID + '-hero') },
      { id:'tip', label:this._t('layout.modules.tip'), matches:(el) => el.classList.contains(PLUGIN_ID + '-tip') },
      { id:'toolbar', label:this._t('layout.modules.toolbar'), matches:(el) => el.classList.contains(PLUGIN_ID + '-toolbar') || el.classList.contains(PLUGIN_ID + '-search-row') || el.classList.contains(PLUGIN_ID + '-search-results') },
      { id:'calendar', label:this._t('layout.modules.calendar'), matches:(el) => el.classList.contains(PLUGIN_ID + '-cal-wrap') || el.classList.contains(PLUGIN_ID + '-cal-detail') },
      { id:'cats', label:this._t('sections.cats'), collapsible:true, matches:(el) => el.dataset.section === 'cats-title' || el.classList.contains(PLUGIN_ID + '-cats') },
      { id:'stats', label:this._t('sections.stats'), collapsible:true, matches:(el) => el.dataset.section === 'stats-title' || el.classList.contains(PLUGIN_ID + '-stats') },
      { id:'todos', label:this._t('sections.todos'), collapsible:true, matches:(el) => el.classList.contains(PLUGIN_ID + '-todo-header') || el.dataset.section === 'todos-body' },
      { id:'focusChart', label:this._t('layout.modules.focusChart'), collapsible:true, matches:(el) => el.dataset.section === 'focus-chart-title' || el.dataset.section === 'focus-chart' },
      { id:'bookmarks', label:this._t('sections.bookmarks'), collapsible:true, matches:(el) => el.dataset.section === 'bookmarks-title' || el.dataset.section === 'bookmarks-list' },
      { id:'recent', label:this._t('sections.recent'), collapsible:true, matches:(el) => el.dataset.section === 'recent-title' || el.classList.contains(PLUGIN_ID + '-recent') },
      { id:'flash', label:this._t('sections.flash'), collapsible:true, matches:(el) => el.dataset.section === 'flash-title' || el.dataset.section === 'flash-content' },
      { id:'heatmap', label:this._t('sections.heatmap'), collapsible:true, matches:(el) => el.dataset.section === 'heatmap-title' || el.classList.contains(PLUGIN_ID + '-heatmap') },
      { id:'footer', label:this._t('layout.modules.footer'), matches:(el) => el.classList.contains(PLUGIN_ID + '-footer') }
    ];
  }
  _defaultModuleOrder() {
    return this._moduleRegistry().map((module) => module.id);
  }
  _normalizeModuleOrder(order) {
    const defaults = this._defaultModuleOrder();
    const seen = new Set();
    const next = Array.isArray(order)
      ? order.filter((id) => defaults.includes(id) && !seen.has(id) && (seen.add(id), true))
      : [];
    defaults.forEach((id) => {
      if (!seen.has(id)) next.push(id);
    });
    return next;
  }
  _moduleLabel(id) {
    return this._moduleRegistry().find((module) => module.id === id)?.label || id;
  }
  _toolbarButtons() {
    const desktopOnly = this._isMobile() ? new Set(['hermes','cockpit-h5','work-log']) : new Set();
    const buttons = [
      { icon: '+', label: this._t('toolbar.new'), action: 'new', primary: true },
      { icon: E.search, label: this._t('toolbar.search'), action: 'search' },
      { icon: E.tag, label: this._t('toolbar.tag'), action: 'tag' },
      { icon: E.graph, label: this._t('toolbar.graph'), action: 'graph' },
      { icon: E.bolt, label: this._t('toolbar.command'), action: 'command' },
      { icon: '🤖', label: this._toolbarCmds?.Hermes?.label || this._t('toolbar.hermes'), action: 'hermes' },
      { icon: '🛩️', label: this._toolbarCmds?.['驾驶舱']?.label || this._t('toolbar.cockpit'), action: 'cockpit-h5' },
      { icon: '📝', label: this._toolbarCmds?.['工作日志']?.label || this._t('toolbar.workLog'), action: 'work-log' },
      { icon: '🔔', label: this._lang() === 'en' ? 'Notifications' : '通知设置', action: 'notifications' },
      { icon: '🍅', label: this._t('toolbar.pomodoro'), action: 'pomodoro' }
    ].filter((button) => !this._deletedToolbarActions.has(button.action) && !desktopOnly.has(button.action));
    if (!this._isMobile()) return buttons;
    const primary = buttons.filter((button) => ['new','search','pomodoro'].includes(button.action));
    primary.push({ icon:'•••', label:this._lang() === 'en' ? 'More' : '更多', action:'more' });
    return primary;
  }
  _toolbarActionIds() {
    return this._toolbarButtons().map((button) => button.action);
  }
  _toolbarActionLabel(action) {
    const match = this._toolbarButtons().find((button) => button.action === action);
    return match ? match.label : action;
  }
  _normalizeModuleSubset(list) {
    const defaults = new Set(this._defaultModuleOrder());
    const seen = new Set();
    return Array.isArray(list)
      ? list.filter((id) => defaults.has(id) && !seen.has(id) && (seen.add(id), true))
      : [];
  }
  _normalizeToolbarActionSubset(list) {
    const defaults = new Set(this._toolbarActionIds());
    const seen = new Set();
    return Array.isArray(list)
      ? list.filter((id) => defaults.has(id) && !seen.has(id) && (seen.add(id), true))
      : [];
  }
  _isModuleHidden(moduleId) {
    return this._hiddenModules.has(moduleId);
  }
  _isToolbarActionHidden(action) {
    return this._hiddenToolbarActions.has(action);
  }
  _sceneSnapshot() { return { moduleOrder:[...this._moduleOrder], hiddenModules:Array.from(this._hiddenModules), toolbarOrder:[...this._toolbarOrder], hiddenToolbarActions:Array.from(this._hiddenToolbarActions) }; }
  _sceneLabel(scene) { return scene?.id === 'default' ? (this._lang() === 'en' ? 'Default layout' : '默认布局') : (scene?.name || (this._lang() === 'en' ? 'Untitled scene' : '未命名情景')); }
  _sceneList() { return Object.values(this._sceneLayouts); }
  _getActiveScene() { return this._sceneLayouts[this._activeSceneId] || this._sceneLayouts.default; }
  _applySceneSnapshot(scene) {
    const layout = scene?.layout || {};
    this._moduleOrder = this._normalizeModuleOrder(layout.moduleOrder);
    this._hiddenModules = new Set(this._normalizeModuleSubset(layout.hiddenModules));
    this._toolbarOrder = normalizeToolbarOrder(this, layout.toolbarOrder);
    this._hiddenToolbarActions = new Set(this._normalizeToolbarActionSubset(layout.hiddenToolbarActions));
  }
  async _saveActiveSceneLayout() {
    const scene = this._getActiveScene();
    if (!scene) return;
    scene.layout = this._sceneSnapshot();
    const data = await this._plugin.loadData() || {};
    data.sceneLayouts = this._sceneLayouts;
    data.activeSceneId = this._activeSceneId;
    data.moduleOrder = this._moduleOrder; data.hiddenModules = Array.from(this._hiddenModules);
    data.toolbarOrder = this._toolbarOrder; data.hiddenToolbarActions = Array.from(this._hiddenToolbarActions);
    await this._plugin.saveData(data);
  }
  async _switchScene(id) {
    const scene = this._sceneLayouts[id]; if (!scene || id === this._activeSceneId) return;
    this._activeSceneId = id; this._editMode = false; this._applySceneSnapshot(scene);
    await this._saveActiveSceneLayout();
    await this._renderDashboard(false, true);
  }
  async _createScene(name) {
    if (name === undefined) { new CockpitSceneNameModal(this.app, this).open(); return; }
    const cleaned = name.trim(); if (!cleaned) return;
    const id = 'scene-' + Date.now().toString(36);
    this._sceneLayouts[id] = { id, name:cleaned.slice(0, 24), icon:'◈', layout:this._sceneSnapshot() };
    this._activeSceneId = id;
    await this._saveActiveSceneLayout();
    if (this._sceneSwitcherRefresh) this._sceneSwitcherRefresh();
  }
  async _deleteActiveScene() {
    if (this._activeSceneId === 'default') return;
    const scene = this._getActiveScene();
    if (!window.confirm(this._lang() === 'en' ? `Delete “${this._sceneLabel(scene)}”?` : `确定删除“${this._sceneLabel(scene)}”吗？`)) return;
    delete this._sceneLayouts[this._activeSceneId]; this._activeSceneId = 'default'; this._applySceneSnapshot(this._sceneLayouts.default);
    await this._saveActiveSceneLayout(); await this._renderDashboard(false);
  }
  _toggleLayoutEdit() {
    this._editMode = !this._editMode;
    if (!this._editMode) {
      this._renderDashboard(false).catch((e) => console.warn('Cockpit: finalize layout edit failed', e));
      return;
    }
    const root = this.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
    if (root) this._applyModuleEditState(root);
    if (this._sceneSwitcherRefresh) this._sceneSwitcherRefresh();
  }
  _refreshTipSection() {
    const root = this.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
    const tipText = root?.querySelector('.' + PLUGIN_ID + '-tip-text');
    if (tipText) tipText.textContent = getDailyTip(this._language, this._dailyTips).replace(/^💡\s*/, '');
  }
  async _saveModuleOrder(order) {
    const next = this._normalizeModuleOrder(order);
    this._moduleOrder = next;
    try {
      await this._saveActiveSceneLayout();
    } catch (e) {
      console.warn('Cockpit: save module order failed', e);
    }
  }
  async _saveHiddenModules(hiddenModules) {
    const next = this._normalizeModuleSubset(hiddenModules);
    this._hiddenModules = new Set(next);
    try {
      await this._saveActiveSceneLayout();
    } catch (e) {
      console.warn('Cockpit: save hidden modules failed', e);
    }
  }
  async _saveHiddenToolbarActions(hiddenActions) {
    const next = this._normalizeToolbarActionSubset(hiddenActions);
    this._hiddenToolbarActions = new Set(next);
    try {
      await this._saveActiveSceneLayout();
    } catch (e) {
      console.warn('Cockpit: save hidden toolbar actions failed', e);
    }
  }
  async _setPomodoroAutoShow(enabled) {
    this._pomodoroAutoShow = enabled !== false;
    const data = await this._plugin.loadData() || {};
    data.pomodoroAutoShow = this._pomodoroAutoShow;
    await this._plugin.saveData(data);
  }
  _getFocusChartSettings() { return { range:this._focusChartSettings?.range === 'month' ? 'month' : 'week', type:this._focusChartSettings?.type === 'bar' ? 'bar' : 'line' }; }
  async _setFocusChartSettings(patch) { this._focusChartSettings = { ...this._getFocusChartSettings(), ...patch }; const data = await this._plugin.loadData() || {}; data.focusChartSettings = this._focusChartSettings; await this._plugin.saveData(data); }
  async _savePomodoroSession(session) {
    this._pomodoroSession = session || null;
    const data = await this._plugin.loadData() || {};
    data.pomodoroSession = this._pomodoroSession;
    await this._plugin.saveData(data);
  }
  async _deletePresetToolbarAction(action) {
    if (!['hermes', 'cockpit-h5', 'work-log'].includes(action)) return;
    this._deletedToolbarActions.add(action);
    this._hiddenToolbarActions.delete(action);
    const data = await this._plugin.loadData() || {};
    data.deletedToolbarActions = Array.from(this._deletedToolbarActions);
    data.hiddenToolbarActions = Array.from(this._hiddenToolbarActions);
    data.toolbarOrder = (Array.isArray(data.toolbarOrder) ? data.toolbarOrder : []).filter((item) => item !== action);
    await this._plugin.saveData(data);
  }
  _getModuleIdForElement(el) {
    if (!(el instanceof HTMLElement)) return null;
    if (el.tagName === 'STYLE') return null;
    return this._moduleRegistry().find((module) => module.matches(el))?.id || null;
  }
  _clearModuleDropHints(root) {
    root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
      wrapper.classList.remove('dragging', 'drop-before', 'drop-after');
    });
  }
  _closeTodoEditor() {
    if (this._todoEditorEl && this._todoEditorEl.parentNode) this._todoEditorEl.remove();
    this._todoEditorEl = null;
  }
  _closeWelcomeCover() {
    if (this._welcomeCoverEl && this._welcomeCoverEl.parentNode) this._welcomeCoverEl.remove();
    this._welcomeCoverEl = null;
  }
  _closeOnboardingCard() {
    const card = document.getElementById(PLUGIN_ID + '-tour');
    if (card) card.remove();
    document.querySelectorAll('.' + PLUGIN_ID + '-onboarding-highlight').forEach((el) => {
      el.classList.remove(PLUGIN_ID + '-onboarding-highlight');
    });
  }
  _applyToolbarButtonEditState(root) {
    const toolbar = root.querySelector('.' + PLUGIN_ID + '-toolbar');
    if (!toolbar) return;
    toolbar.classList.toggle(PLUGIN_ID + '-toolbar-editing', this._editMode);
    toolbar.querySelectorAll('.' + PLUGIN_ID + '-toolslot').forEach((slot) => {
      const action = slot.dataset.action;
      const customId = slot.dataset.customId;
      const hidden = this._isToolbarActionHidden(action);
      const customHidden = customId && slot.dataset.hidden === 'true';
      const label = customId ? (slot.dataset.label || customId) : this._toolbarActionLabel(action);
      const btn = slot.querySelector('.' + PLUGIN_ID + '-toolbtn');
      const isHidden = customId ? customHidden : hidden;
      slot.classList.toggle('is-hidden', isHidden);
      slot.style.display = !this._editMode && isHidden ? 'none' : '';
      slot.draggable = this._editMode;
      if (btn) {
        btn.disabled = this._editMode;
        btn.setAttribute('aria-label', label);
      }
      const visibility = slot.querySelector('.' + PLUGIN_ID + '-toolbtn-visibility');
      if (visibility) {
        visibility.textContent = isHidden ? this._t('layout.show') : this._t('layout.hide');
        visibility.title = isHidden
          ? (this._lang() === 'en' ? 'Show button' : '显示按钮')
          : (this._lang() === 'en' ? 'Hide button' : '隐藏按钮');
        visibility.classList.toggle('is-hidden', isHidden);
        visibility.tabIndex = this._editMode ? 0 : -1;
      }
    });
    const addCustom = toolbar.querySelector('.' + PLUGIN_ID + '-custom-toolbar-add');
    if (addCustom) addCustom.style.display = this._editMode ? 'inline-flex' : 'none';
    const logs = toolbar.querySelector('.' + PLUGIN_ID + '-custom-toolbar-logs');
    if (logs) logs.style.display = this._editMode ? 'inline-flex' : 'none';
  }

  async _saveCustomToolbarButtons(buttons) {
    this._customToolbarButtons = normalizeCustomToolbarButtons(buttons);
    const data = await this._plugin.loadData() || {};
    data.customToolbarButtons = this._customToolbarButtons;
    await this._plugin.saveData(data);
  }
  _getGreetingByHour(hour) {
    let greeting = this._t('greetings.morning');
    if (hour >= 12 && hour < 14) greeting = this._t('greetings.noon');
    else if (hour >= 14 && hour < 18) greeting = this._t('greetings.afternoon');
    else if (hour >= 18 && hour < 22) greeting = this._t('greetings.evening');
    else if (hour >= 22 || hour < 6) greeting = this._t('greetings.night');
    return greeting;
  }
  _refreshHeroSection() {
    if (!this._heroRefs) return;
    const now = window.moment();
    const dueTodos = this._todos.filter((todo) => !todo.done && todo.dueDate && (
      todo.dueDate.isBefore(now.clone().add(1, 'day'), 'day') ||
      todo.dueDate.isSame(now.clone().add(1, 'day'), 'day')
    ));
    const dueIcon = dueTodos.some((todo) => todo.priority === 'high')
      ? '🔴'
      : dueTodos.some((todo) => todo.priority === 'mid')
        ? '🟡'
        : '🟢';
    let heroSubText = this._t('hero.today', { date: formatHeroDate(now, this._lang()) });
    if (dueTodos.length > 0) {
      heroSubText += ' · ' + this._t('hero.dueTodos', { count: dueTodos.length, icon: dueIcon });
    }
    if (this._heroRefs.greetingPrefixEl) {
      this._heroRefs.greetingPrefixEl.textContent = E.wave + ' ' + this._getGreetingByHour(now.hour()) + '，';
    }
    if (this._heroRefs.summaryEl) this._heroRefs.summaryEl.textContent = heroSubText;
    if (this._heroRefs.daysEl) {
      const days = Math.max(0, now.diff(window.moment(this._startDate), 'days'));
      this._heroRefs.daysEl.textContent = this._t('hero.vaultDays', { days });
    }
  }
  _parseFocusHistory(content) {
    const history = new Map();
    const re = /date:\s*(\S+)\s*\nminutes:\s*(\d+)/g;
    let match;
    while ((match = re.exec(content || '')) !== null) {
      history.set(match[1], parseInt(match[2], 10) || 0);
    }
    return history;
  }
  _serializeFocusHistory(history) {
    const lines = ['# ' + this._t('pomodoro.focusLogTitle'), ''];
    Array.from(history.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, minutes], index) => {
        if (index > 0) lines.push('');
        lines.push('date: ' + date);
        lines.push('minutes: ' + minutes);
      });
    lines.push('');
    return lines.join('\n');
  }
  async _saveFocusHistory(date, minutes) {
    const dir = '_data';
    if (!this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
    const filePath = '_data/focus.md';
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    const history = existing
      ? this._parseFocusHistory(await this.app.vault.read(existing))
      : new Map();
    history.set(date, Math.max(0, parseInt(minutes, 10) || 0));
    const content = this._serializeFocusHistory(history);
    if (existing) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(filePath, content);
  }
  _bindSilentRefreshSensors() {
    this._unbindSilentRefreshSensors();
    const container = this.containerEl.children[1];
    if (!container) return;
    this._interactionSensorEl = container;
    this._interactionHandler = () => { this._lastInteractionAt = Date.now(); };
    ['pointerdown', 'keydown', 'input'].forEach((eventName) => {
      container.addEventListener(eventName, this._interactionHandler, true);
    });
  }
  _unbindSilentRefreshSensors() {
    if (!this._interactionSensorEl || !this._interactionHandler) return;
    ['pointerdown', 'keydown', 'input'].forEach((eventName) => {
      this._interactionSensorEl.removeEventListener(eventName, this._interactionHandler, true);
    });
    this._interactionSensorEl = null;
    this._interactionHandler = null;
  }
  _isSilentRefreshBlocked(ignoreRecentActivity) {
    if (this._todoEditorEl || this._welcomeCoverEl || this._editMode) return true;
    if (!ignoreRecentActivity && Date.now() - (this._lastInteractionAt || 0) < 30 * 1000) return true;
    const activeEl = document.activeElement;
    if (!(activeEl instanceof HTMLElement)) return false;
    if (!activeEl.closest('.' + PLUGIN_ID + '-root')) return false;
    return activeEl.matches('input, textarea, select, [contenteditable="true"]');
  }
  _startSilentRefreshLoops() {
    if (this._minuteRefreshTimer) clearInterval(this._minuteRefreshTimer);
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    if (this._visibilityRefreshHandler) {
      document.removeEventListener('visibilitychange', this._visibilityRefreshHandler);
    }
    this._refreshHeroSection();
    this._lastCalendarDateKey = window.moment().format('YYYY-MM-DD');
    this._minuteRefreshTimer = window.setInterval(() => {
      try {
        this._refreshHeroSection();
        const dateKey = window.moment().format('YYYY-MM-DD');
        if (dateKey !== this._lastCalendarDateKey) {
          this._lastCalendarDateKey = dateKey;
          if (!document.hidden && !this._isSilentRefreshBlocked(true)) this._refreshCalendarRef?.();
        }
      } catch (e) {
        console.warn('Cockpit hero refresh failed', e);
      }
    }, 60 * 1000);
    this._refreshTimer = window.setInterval(async () => {
      try {
        await this._runSilentRefreshCycle();
      } catch (e) {
        console.warn('Cockpit silent refresh failed', e);
      }
    }, 15 * 60 * 1000);
    this._visibilityRefreshHandler = () => {
      if (document.hidden) return;
      this._runSilentRefreshCycle({ ignoreRecentActivity: true }).catch((e) => {
        console.warn('Cockpit visibility refresh failed', e);
      });
    };
    document.addEventListener('visibilitychange', this._visibilityRefreshHandler);
  }
  async _runSilentRefreshCycle(options = {}) {
    this._refreshHeroSection();
    if (document.hidden || this._isSilentRefreshBlocked(options.ignoreRecentActivity)) return;
    const root = this.containerEl.children[1]?.querySelector('.' + PLUGIN_ID + '-root');
    if (!root) return;
    await this._reloadDashboardState();
    this._allFiles = this.app.vault.getMarkdownFiles();
    if (this._refreshCalendarRef) this._refreshCalendarRef();
    if (this._refreshFocusChartRef) this._refreshFocusChartRef();
    if (this._refreshTodosRef) await this._refreshTodosRef({ persist: false });
    else if (this._updateStatsRef) this._updateStatsRef();
    this._refreshHeroSection();
    this._refreshRecentSection(root, this._allFiles);
    await this._refreshBookmarkSection(root, this._allFiles);
    this._rebuildRecentStars();
  }
  _applyModuleEditState(root) {
    root.classList.toggle(PLUGIN_ID + '-layout-editing', this._editMode);
    const quickDoneBtn = root.querySelector('.' + PLUGIN_ID + '-layout-done');
    if (quickDoneBtn) {
      quickDoneBtn.style.display = this._editMode ? 'inline-flex' : 'none';
      quickDoneBtn.title = this._t('layout.done');
      quickDoneBtn.setAttribute('aria-label', this._t('layout.done'));
    }
    root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
      const moduleId = wrapper.dataset.moduleId;
      const hidden = this._isModuleHidden(moduleId);
      wrapper.classList.toggle('is-editing', this._editMode);
      wrapper.classList.toggle('is-hidden', hidden);
      wrapper.style.display = !this._editMode && hidden ? 'none' : '';
      const handle = wrapper.querySelector('.' + PLUGIN_ID + '-module-handle');
      const badge = wrapper.querySelector('.' + PLUGIN_ID + '-module-badge');
      const visibilityBtn = wrapper.querySelector('.' + PLUGIN_ID + '-module-visibility');
      const label = this._moduleLabel(moduleId);
      if (badge) badge.textContent = hidden ? label + ' · ' + this._t('layout.hiddenTag') : label;
      if (handle) {
        handle.draggable = this._editMode;
        handle.tabIndex = this._editMode ? 0 : -1;
        handle.setAttribute('aria-hidden', this._editMode ? 'false' : 'true');
      }
      if (visibilityBtn) {
        visibilityBtn.textContent = hidden ? this._t('layout.show') : this._t('layout.hide');
        visibilityBtn.title = hidden
          ? this._t('layout.showModule', { module: label })
          : this._t('layout.hideModule', { module: label });
        visibilityBtn.tabIndex = this._editMode ? 0 : -1;
        visibilityBtn.classList.toggle('is-hidden', hidden);
      }
    });
    root.querySelectorAll('.' + PLUGIN_ID + '-tip-manage').forEach((button) => {
      button.style.display = this._editMode ? 'inline-flex' : 'none';
    });
    this._applyToolbarButtonEditState(root);
  }
  _wireModuleDnD(root) {
    root.querySelectorAll('.' + PLUGIN_ID + '-module').forEach((wrapper) => {
      const moduleId = wrapper.dataset.moduleId;
      const label = this._moduleLabel(moduleId);
      let tools = wrapper.querySelector(':scope > .' + PLUGIN_ID + '-module-tools');
      let badge;
      let handle;
      let visibilityBtn;
      if (!tools) {
        tools = document.createElement('div');
        tools.className = PLUGIN_ID + '-module-tools';
        badge = document.createElement('span');
        badge.className = PLUGIN_ID + '-module-badge';
        visibilityBtn = document.createElement('button');
        visibilityBtn.type = 'button';
        visibilityBtn.className = PLUGIN_ID + '-module-visibility';
        handle = document.createElement('button');
        handle.type = 'button';
        handle.className = PLUGIN_ID + '-module-handle';
        handle.textContent = '↕';
        tools.appendChild(badge);
        tools.appendChild(visibilityBtn);
        tools.appendChild(handle);
        wrapper.prepend(tools);
      } else {
        badge = tools.querySelector('.' + PLUGIN_ID + '-module-badge');
        visibilityBtn = tools.querySelector('.' + PLUGIN_ID + '-module-visibility');
        handle = tools.querySelector('.' + PLUGIN_ID + '-module-handle');
      }
      if (badge) badge.textContent = label;
      if (visibilityBtn) {
        visibilityBtn.onclick = async (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          const nextHidden = !this._isModuleHidden(moduleId);
          const hiddenModules = new Set(this._hiddenModules);
          if (nextHidden) hiddenModules.add(moduleId);
          else hiddenModules.delete(moduleId);
          await this._saveHiddenModules(Array.from(hiddenModules));
          this._applyModuleEditState(root);
        };
      }
      if (handle) {
        handle.title = this._t('layout.dragHandle', { module: label });
        handle.draggable = this._editMode;
        handle.tabIndex = this._editMode ? 0 : -1;
        handle.ondragstart = (evt) => {
          if (!this._editMode) {
            evt.preventDefault();
            return;
          }
          this._dragModuleId = moduleId;
          wrapper.classList.add('dragging');
          evt.dataTransfer.effectAllowed = 'move';
          evt.dataTransfer.setData('text/plain', moduleId);
        };
        handle.ondragend = () => {
          this._dragModuleId = null;
          this._clearModuleDropHints(root);
        };
      }
      wrapper.ondragover = (evt) => {
        const draggedId = this._dragModuleId || evt.dataTransfer.getData('text/plain');
        if (!this._editMode || !draggedId || draggedId === moduleId) return;
        evt.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const before = evt.clientY < rect.top + rect.height / 2;
        wrapper.classList.toggle('drop-before', before);
        wrapper.classList.toggle('drop-after', !before);
      };
      wrapper.ondragleave = () => {
        wrapper.classList.remove('drop-before', 'drop-after');
      };
      wrapper.ondrop = async (evt) => {
        const draggedId = this._dragModuleId || evt.dataTransfer.getData('text/plain');
        if (!this._editMode || !draggedId || draggedId === moduleId) return;
        evt.preventDefault();
        const dragged = root.querySelector('.' + PLUGIN_ID + '-module[data-module-id="' + draggedId + '"]');
        if (!dragged) return;
        const rect = wrapper.getBoundingClientRect();
        const before = evt.clientY < rect.top + rect.height / 2;
        if (before) root.insertBefore(dragged, wrapper);
        else root.insertBefore(dragged, wrapper.nextSibling);
        this._clearModuleDropHints(root);
        await this._saveModuleOrder(Array.from(root.querySelectorAll('.' + PLUGIN_ID + '-module')).map((el) => el.dataset.moduleId));
      };
    });
    this._applyModuleEditState(root);
  }
  _applyModuleLayout(root) {
    Array.from(root.querySelectorAll(':scope > .' + PLUGIN_ID + '-module')).forEach((wrapper) => {
      while (wrapper.firstChild) {
        const child = wrapper.firstChild;
        if (child.classList && child.classList.contains(PLUGIN_ID + '-module-tools')) {
          child.remove();
          continue;
        }
        root.insertBefore(child, wrapper);
      }
      wrapper.remove();
    });
    const groups = new Map(this._defaultModuleOrder().map((id) => [id, []]));
    const unclassified = [];
    Array.from(root.children).forEach((child) => {
      if (child.tagName === 'STYLE') return;
      const moduleId = this._getModuleIdForElement(child);
      if (moduleId && groups.has(moduleId)) groups.get(moduleId).push(child);
      else unclassified.push(child);
    });
    const fragment = document.createDocumentFragment();
    this._normalizeModuleOrder(this._moduleOrder).forEach((moduleId) => {
      const nodes = groups.get(moduleId) || [];
      if (!nodes.length) return;
      const wrapper = document.createElement('section');
      wrapper.className = PLUGIN_ID + '-module';
      wrapper.dataset.moduleId = moduleId;
      wrapper.dataset.moduleLabel = this._moduleLabel(moduleId);
      nodes.forEach((node) => wrapper.appendChild(node));
      fragment.appendChild(wrapper);
    });
    unclassified.forEach((node) => fragment.appendChild(node));
    root.appendChild(fragment);
    this._wireModuleDnD(root);
  }
  _makeModuleCollapsible(moduleId, titleEl, contentEl, defaultCollapsed) {
    const module = this._moduleRegistry().find((entry) => entry.id === moduleId);
    if (!module?.collapsible || !titleEl || !contentEl) return;
    this._makeCollapsible(titleEl, contentEl, moduleId, defaultCollapsed);
  }
  _makeCollapsible(titleEl, contentEl, key, defaultCollapsed) {
    if (titleEl.dataset.collapseBound === 'true') return;
    const arrow = titleEl.createSpan({ cls: PLUGIN_ID+'-collapse-arrow', text: '▼', attr:{ style:'margin-left:6px;font-size:0.7em;opacity:0.45;transition:transform 0.2s;display:inline-block;' } });
    titleEl.style.cursor = 'pointer';
    let collapsed = this._collapsed && this._collapsed[key];
    if (collapsed === undefined) collapsed = defaultCollapsed || false;
    const apply = () => { contentEl.style.display = collapsed ? 'none' : ''; arrow.textContent = collapsed ? '▶' : '▼'; };
    apply();
    titleEl.dataset.collapseBound = 'true';
    titleEl.addEventListener('click', (e) => {
      if (e.target.closest('button,input,a,textarea,select')) return;
      collapsed = !collapsed;
      apply();
      this._collapsed[key] = collapsed;
      (async () => { try { const d = await this._plugin.loadData() || {}; d.collapsed = { ...this._collapsed }; await this._plugin.saveData(d); } catch(ex) { console.warn('save collapsed', ex); } })();
    });
  }
  async _setLanguage(language) {
    const next = normalizeLang(language);
    if (next === this._language) return;
    const prev = this._language;
    this._language = next;
    try {
      const data = await this._plugin.loadData() || {};
      data.language = next;
      await this._plugin.saveData(data);
      await this._renderDashboard(true);
    } catch (e) {
      this._language = prev;
      console.warn('Cockpit: save language failed', e);
      new obsidian.Notice('Language switch failed: ' + (e?.message || 'unknown error'));
    }
  }

  async _reloadDashboardState() {
    if (!this._storage) this._storage = new CockpitStorage(this._plugin, this.app);
    if (!this._tipStore) this._tipStore = new CockpitTipStore(this._plugin);
    const tipState = await this._tipStore.load();
    this._dailyTips = tipState.display;
    this._editableTips = tipState.editable;
    this._tipRotationMode = tipState.rotationMode;
    await this._storage.initialize(this._defaultToolbarCommands());
    const loaded = await loadTodos(this.app.vault);
    this._todos = loaded || DEFAULT_TODOS.map(t=>({...t}));
    this._bookmarks = new Set(await this._storage.loadBookmarks());

    // 同步 Hermes 功能待办到 Obsidian
    await syncHermesTodos(this.app.vault, this._todos);

    // 加载用户自定义名称 + 初始化首次使用日期
    try {
      const pluginData = await this._plugin.loadData() || {};
      this._language = normalizeLang(pluginData?.language || DEFAULT_LANG);
      await this._rss.initialize();
      if (this._rss.config.enabled) this._rss.refresh().then(() => this._refreshCalendarRef?.()).catch((e) => console.warn('Cockpit RSS refresh failed', e));
      this._pomodoroAutoShow = pluginData?.pomodoroAutoShow !== false;
      this._pomodoroSession = pluginData?.pomodoroSession?.active ? pluginData.pomodoroSession : null;
      this._focusChartSettings = { range:pluginData?.focusChartSettings?.range === 'month' ? 'month' : 'week', type:pluginData?.focusChartSettings?.type === 'bar' ? 'bar' : 'line' };
      this._username = pluginData?.username || this._t('hero.defaultName');
      this._collapsed = pluginData?.collapsed || {};
      this._moduleOrder = this._normalizeModuleOrder(pluginData?.moduleOrder);
      this._hiddenModules = new Set(this._normalizeModuleSubset(pluginData?.hiddenModules));
      this._deletedToolbarActions = new Set((Array.isArray(pluginData?.deletedToolbarActions) ? pluginData.deletedToolbarActions : []).filter((action) => ['hermes','cockpit-h5','work-log'].includes(action)));
      this._hiddenToolbarActions = new Set(this._normalizeToolbarActionSubset(pluginData?.hiddenToolbarActions));
      this._customToolbarButtons = normalizeCustomToolbarButtons(pluginData?.customToolbarButtons);
      this._toolbarOrder = normalizeToolbarOrder(this, pluginData?.toolbarOrder);
      const legacyLayout = this._sceneSnapshot();
      const rawScenes = pluginData?.sceneLayouts;
      if (rawScenes && typeof rawScenes === 'object' && !Array.isArray(rawScenes)) {
        this._sceneLayouts = rawScenes;
        if (!this._sceneLayouts.default) this._sceneLayouts.default = { id:'default', icon:'◈', layout:legacyLayout };
      } else {
        // 首次升级：把用户现有布局原样保留为默认布局。
        this._sceneLayouts = { default:{ id:'default', icon:'◈', layout:legacyLayout } };
        pluginData.sceneLayouts = this._sceneLayouts;
        pluginData.activeSceneId = 'default';
        await this._plugin.saveData(pluginData);
      }
      this._activeSceneId = this._sceneLayouts[pluginData?.activeSceneId] ? pluginData.activeSceneId : 'default';
      this._applySceneSnapshot(this._getActiveScene());
      if (!pluginData.focusChartIntroduced) {
        Object.values(this._sceneLayouts).forEach((scene) => {
          const hidden = new Set(Array.isArray(scene?.layout?.hiddenModules) ? scene.layout.hiddenModules : []);
          hidden.add('focusChart');
          scene.layout = { ...(scene.layout || {}), hiddenModules:Array.from(hidden) };
        });
        pluginData.sceneLayouts = this._sceneLayouts;
        pluginData.focusChartIntroduced = true;
        await this._plugin.saveData(pluginData);
        this._applySceneSnapshot(this._getActiveScene());
      }
      this._bookmarkOrder = Array.isArray(pluginData?.bookmarkOrder) ? pluginData.bookmarkOrder.filter((path) => this._bookmarks.has(path)) : [];
      this._bookmarks.forEach((path) => { if (!this._bookmarkOrder.includes(path)) this._bookmarkOrder.push(path); });
      if (!pluginData.startDate) { pluginData.startDate = window.moment().format('YYYY-MM-DD'); await this._plugin.saveData(pluginData); }
      this._startDate = pluginData.startDate;
      this._onboardingDone = pluginData?.onboardingDone || false;
    } catch(e) { this._language = DEFAULT_LANG; this._pomodoroAutoShow = true; this._pomodoroSession = null; this._username = this._t('hero.defaultName'); this._startDate = window.moment().format('YYYY-MM-DD'); this._collapsed = {}; this._moduleOrder = this._defaultModuleOrder(); this._hiddenModules = new Set(); this._deletedToolbarActions = new Set(); this._hiddenToolbarActions = new Set(); this._bookmarkOrder = Array.from(this._bookmarks); this._customToolbarButtons = []; this._toolbarOrder = normalizeToolbarOrder(this, []); this._sceneLayouts = { default:{ id:'default', icon:'◈', layout:this._sceneSnapshot() } }; this._activeSceneId = 'default'; }

    // 加载今日专注时长
    const today = window.moment().format('YYYY-MM-DD');
    this._focusMinutes = 0;
    this._focusHistory = new Map();
    try {
      const f = this.app.vault.getAbstractFileByPath('_data/focus.md');
      if (f) {
        const content = await this.app.vault.read(f);
        this._focusHistory = this._parseFocusHistory(content);
        this._focusMinutes = this._focusHistory.get(today) || 0;
      }
    } catch(e) { this._focusHistory = new Map(); }

    this._toolbarCmds = await this._storage.loadToolbarCommands(this._defaultToolbarCommands());
  }

  _defaultToolbarCommands() {
    if (this._isMobile()) return {};
    try {
      const homedir = require('os').homedir();
      const vaultBase = this.app.vault.adapter.getBasePath();
      const scriptPath = require('path').join(vaultBase, '.obsidian', 'plugins', 'cockpit-dashboard', 'oaAtuoLogin_obsidian.py');
      return {
        Hermes: { command:'hermes --tui', mode:'auto' },
        '驾驶舱': { command:'cd ' + homedir + '/Downloads/cockpit && ' + homedir + '/.local/bin/node server.js', url:'http://localhost:3456' },
        '工作日志': { command:'/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 ' + scriptPath, url:'' }
      };
    } catch (e) {
      console.warn('Cockpit: failed to build default toolbar commands', e);
      return {};
    }
  }

  _shouldOpenContextMenu(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('button,input,a,textarea,select,[contenteditable="true"]')) return false;
    const blockedSelectors = [
      '.' + PLUGIN_ID + '-hero',
      '.' + PLUGIN_ID + '-tip',
      '.' + PLUGIN_ID + '-toolbar',
      '.' + PLUGIN_ID + '-search-item',
      '.' + PLUGIN_ID + '-cal-header',
      '.' + PLUGIN_ID + '-cal-grid',
      '.' + PLUGIN_ID + '-cal-detail',
      '.' + PLUGIN_ID + '-cat',
      '.' + PLUGIN_ID + '-stat',
      '.' + PLUGIN_ID + '-todo-header',
      '.' + PLUGIN_ID + '-todo-tabs',
      '.' + PLUGIN_ID + '-todo',
      '.' + PLUGIN_ID + '-recent-item',
      '.' + PLUGIN_ID + '-flash-row',
      '.' + PLUGIN_ID + '-heatmap',
      '.' + PLUGIN_ID + '-footer'
    ];
    return !target.closest(blockedSelectors.join(','));
  }
  _getDashboardMenuItems() {
    return [
      ...this._blankContextMenuItems,
      {
        title: this._lang() === 'en' ? 'Manage RSS subscriptions' : '管理 RSS 订阅源',
        icon: 'settings-2',
        onClick: () => new CockpitRssSettingsModal(this.app, this).open()
      },
      {
        title: this._lang() === 'en' ? 'Refresh RSS subscriptions' : '刷新 RSS 订阅',
        icon: 'rss',
        onClick: async () => { await this._refreshRssSubscriptions(true); }
      },
      {
        title: this._lang() === 'en' ? 'Clear local RSS cache' : '清除本机 RSS 缓存',
        icon: 'trash-2',
        onClick: async () => { await this._rss.clearCache(); this._refreshCalendarRef?.(); new obsidian.Notice(this._lang() === 'en' ? 'Local RSS cache cleared.' : '本机 RSS 缓存已清除。'); }
      },
      {
        title: this._t('contextMenu.releaseNotes'),
        icon: 'history',
        onClick: () => {
          new CockpitReleaseNotesModal(this.app, this._plugin, this._language).open();
        }
      },
      {
        title: this._editMode ? this._t('layout.done') : this._t('layout.edit'),
        icon: 'grip-vertical',
        onClick: () => {
          this._toggleLayoutEdit();
        }
      },
      {
        title: this._lang() === 'en' ? 'Data migration' : '数据迁移',
        icon: 'database',
        onClick: () => openStorageMigration(this)
      },
      {
        title: this._t('contextMenu.refreshPage'),
        icon: 'refresh-cw',
        onClick: async () => { await this._renderDashboard(true); }
      }
    ];
  }
  async _refreshRssSubscriptions(force) {
    const result = await this._rss.refresh(force);
    const en = this._lang() === 'en';
    let message = (en ? 'Updated ' : '已更新 ') + result.refreshed + (en ? ' sources' : ' 个订阅源');
    if (result.failed) message += (en ? '; failed: ' : '；更新失败：') + result.failedFeeds.join('、');
    new obsidian.Notice(message);
    this._refreshCalendarRef?.();
    return result;
  }
  _openDashboardMenu(anchorEl, sourceEvent) {
    const menu = new obsidian.Menu();
    this._getDashboardMenuItems().forEach(({ title, icon, onClick }) => {
      menu.addItem((item) => {
        item.setTitle(title).setIcon(icon).onClick(onClick);
      });
    });
    if (sourceEvent) {
      menu.showAtMouseEvent(sourceEvent);
      return;
    }
    const rect = anchorEl?.getBoundingClientRect ? anchorEl.getBoundingClientRect() : { left: window.innerWidth / 2, bottom: window.innerHeight / 2, width: 0 };
    const evt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.bottom + 8)
    });
    menu.showAtMouseEvent(evt);
  }

  _attachRootContextMenu(container) {
    container.addEventListener('contextmenu', (evt) => {
      if (!this._shouldOpenContextMenu(evt.target)) return;
      evt.preventDefault();
      this._openDashboardMenu(null, evt);
    });
  }

  async _renderDashboard(reloadState, crossfadeScene) {
    if (reloadState) await this._reloadDashboardState();
    this._blankContextMenuItems = [];
    this._heroRefs = null;
    this._recentEl = null;
    this._refreshTodosRef = null;
    this._refreshCalendarRef = null;
    this._refreshHeroReminder = null;
    this._updateStatsRef = null;
    this._closeTodoEditor();
    this._closeWelcomeCover();
    this._closeOnboardingCard();
    const container = this.containerEl.children[1];
    if (crossfadeScene) container.style.position = 'relative';
    const previousRoot = crossfadeScene ? container.querySelector(':scope > .' + PLUGIN_ID + '-root') : null;
    if (!previousRoot) container.empty();
    const root = container.createDiv({ cls: PLUGIN_ID+'-root' });
    if (previousRoot) root.classList.add(PLUGIN_ID + '-scene-preparing');
    root.createEl('style', { text: CSS });
    this._attachRootContextMenu(container);
    await this._buildAll(root);
    this._syncResponsiveViewport();
    if (previousRoot) {
      requestAnimationFrame(() => {
        previousRoot.classList.add(PLUGIN_ID + '-scene-leaving');
        root.classList.remove(PLUGIN_ID + '-scene-preparing');
        root.classList.add(PLUGIN_ID + '-scene-entering');
        setTimeout(() => previousRoot.remove(), 460);
      });
    }
    if (this._pendingOnboarding) {
      this._pendingOnboarding = false;
      setTimeout(() => {
        const liveRoot = this.containerEl.children[1]?.querySelector('.'+PLUGIN_ID+'-root');
        if (liveRoot) this._showOnboarding(liveRoot);
      }, 80);
    }
    return root;
  }

  async onOpen() {
    await this._renderDashboard(true);
    this._viewportSyncHandler = () => this._syncResponsiveViewport();
    window.addEventListener('resize', this._viewportSyncHandler);
    window.visualViewport?.addEventListener('resize', this._viewportSyncHandler);
    this._bindSilentRefreshSensors();
    this._startSilentRefreshLoops();
    setTimeout(() => {
      const root = this.containerEl.children[1]?.querySelector('.'+PLUGIN_ID+'-root');
      if (!root || this._onboardingDone) return;
      this._showWelcomeCover(root);
    }, 80);
  }

  async _buildAll(root) {
    const now = window.moment();
    const lang = this._lang();
    const t = (key, vars) => this._t(key, vars);
    const hr = new Date().getHours();
    const gr = this._getGreetingByHour(hr);
    const days = Math.max(0, now.diff(window.moment(this._startDate), 'days'));
    const allFiles = this.app.vault.getMarkdownFiles();

    // ===== 1. Hero — 三行结构 =====
    root.createDiv({ cls: PLUGIN_ID+'-hero' }, el => {
      const heroControls = el.createDiv({ cls: PLUGIN_ID+'-hero-controls' });
      const langSwitch = heroControls.createDiv({ cls: PLUGIN_ID+'-lang-switch', attr:{ 'aria-label': t('hero.language') } });
      const applyLang = async (btn, nextLang) => {
        if (!nextLang || nextLang === this._lang()) return;
        langSwitch.querySelectorAll('.' + PLUGIN_ID + '-lang-btn').forEach(elm => {
          elm.classList.toggle('active', elm === btn);
          elm.classList.remove('pressing');
        });
        btn.classList.add('pressing');
        setTimeout(() => btn.classList.remove('pressing'), 220);
        await this._setLanguage(nextLang);
      };
      LANG_OPTIONS.forEach((option) => {
        const btn = langSwitch.createEl('button', {
          cls: PLUGIN_ID+'-lang-btn'+(lang===option.code?' active':''),
          attr: { title: option.label, type: 'button', 'data-lang': option.code },
          text: option.short,
        });
        btn.addEventListener('pointerdown', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          btn.classList.add('pressing');
        });
        btn.addEventListener('pointerup', async (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          await applyLang(btn, option.code);
        });
        btn.addEventListener('keydown', async (evt) => {
          if (evt.key !== 'Enter' && evt.key !== ' ') return;
          evt.preventDefault();
          evt.stopPropagation();
          await applyLang(btn, option.code);
        });
        btn.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
        });
      });
      langSwitch.addEventListener('pointerleave', () => {
        langSwitch.querySelectorAll('.' + PLUGIN_ID + '-lang-btn').forEach(elm => elm.classList.remove('pressing'));
      });
      buildSceneSwitcher(this, heroControls);
      const greetLine = el.createDiv({ cls: PLUGIN_ID+'-greeting' });
      const greetingPrefixEl = greetLine.createSpan({ text: E.wave+' '+gr+'，' });
      let currNameSpan = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: this._username });
      const startEdit = (span) => {
        const inp = document.createElement('input');
        inp.className = PLUGIN_ID+'-name-input';
        inp.type = 'text';
        inp.value = this._username;
        span.replaceWith(inp);
        inp.focus();
        inp.select();
        let saved = false;
        const finish = async (cancel) => {
          if (saved) return;
          saved = true;
          if (cancel) { const ns = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: this._username }); inp.replaceWith(ns); ns.onclick = () => startEdit(ns); return; }
          const v = inp.value.trim() || t('hero.defaultName');
          this._username = v;
          try { const d = await this._plugin.loadData() || {}; d.username = v; await this._plugin.saveData(d); } catch(e) { console.warn('Cockpit: save username failed', e); }
          const ns = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: v });
          inp.replaceWith(ns);
          ns.onclick = () => startEdit(ns);
        };
        inp.addEventListener('keydown', ke => { if (ke.key === 'Enter') { ke.preventDefault(); finish(false); } if (ke.key === 'Escape') { ke.preventDefault(); finish(true); } });
        inp.addEventListener('blur', () => finish(false));
      };
      currNameSpan.onclick = () => startEdit(currNameSpan);
      greetLine.createSpan({ text: '！' });
      const todayStr = formatHeroDate(now, lang);
      const dueTodos = this._todos.filter(t => !t.done && t.dueDate && (t.dueDate.isBefore(now.clone().add(1,'day'),'day') || t.dueDate.isSame(now.clone().add(1,'day'),'day')));
      const dueIcon = dueTodos.some(t => t.priority==='high') ? '🔴' : dueTodos.some(t => t.priority==='mid') ? '🟡' : '🟢';
      let heroSubText = t('hero.today', { date: todayStr });
      if (dueTodos.length > 0) heroSubText += ' · ' + t('hero.dueTodos', { count: dueTodos.length, icon: dueIcon });
      const heroSummaryEl = el.createDiv({ cls: PLUGIN_ID+'-sub', text: heroSubText });
      const heroDaysEl = el.createDiv({ cls: PLUGIN_ID+'-sub', text: t('hero.vaultDays', { days }) });
      this._heroRefs = { greetingPrefixEl, summaryEl: heroSummaryEl, daysEl: heroDaysEl };
    });

    this._refreshHeroReminder = this._refreshHeroSection.bind(this);
    this._refreshHeroReminder();
    // 向后兼容现有构建代码；折叠实现统一由模块注册表校验和管理。
    const makeCollapsible = (titleEl, contentEl, key, defaultCollapsed) => this._makeModuleCollapsible(key, titleEl, contentEl, defaultCollapsed);
    let refreshTodosRef = null;
    let refreshCalendarRef = null;

    const normalizeTodoTag = (value) => {
      const next = String(value || '').trim().replace(/^#+/, '').replace(/\s+/g, '');
      return next || null;
    };
    const cloneMomentOrNull = (value) => value && window.moment.isMoment(value) ? value.clone() : null;
    const getAllTodoTags = () => {
      const tagSet = new Set();
      (this._todos || []).forEach((todo) => {
        if (!todo.tags) return;
        todo.tags.forEach((tag) => {
          const normalized = normalizeTodoTag(tag);
          if (normalized) tagSet.add(normalized);
        });
      });
      return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
    };
    const createTodoDraft = (todo, overrides = {}) => ({
      text: todo?.text || '',
      tags: Array.isArray(todo?.tags) ? todo.tags.slice() : [],
      dueDate: cloneMomentOrNull(todo?.dueDate),
      priority: todo?.priority || 'mid',
      ...overrides
    });
    const mergeLegacyTodoInput = (rawTitle, draft) => {
      const parsed = extractTags(rawTitle);
      const hasTagSyntax = /#([^\s#]+)/.test(rawTitle);
      const hasDueSyntax = /due:\s*\d{4}-\d{2}-\d{2}/.test(rawTitle);
      const hasPrioritySyntax = /p:\s*(high|mid|low)/.test(rawTitle);
      const cleanText = parsed.cleanText || rawTitle.trim();
      const tags = hasTagSyntax
        ? Array.from(new Set(parsed.tags.map((tag) => normalizeTodoTag(tag)).filter(Boolean)))
        : draft.tags.slice();
      const dueDate = hasDueSyntax ? parsed.dueDate : cloneMomentOrNull(draft.dueDate);
      const priority = hasPrioritySyntax ? parsed.priority : draft.priority;
      return { text: cleanText, tags, dueDate, priority };
    };
    const openTodoEditor = (options = {}) => {
      const existingTodo = typeof options.index === 'number' ? this._todos[options.index] : null;
      const isEditing = !!existingTodo;
      const PID = PLUGIN_ID;
      const duePreset = options.dueDate ? options.dueDate.clone().startOf('day') : null;
      const draft = createTodoDraft(existingTodo, duePreset ? { dueDate: duePreset } : {});
      const knownTags = getAllTodoTags();
      let saveLocked = false;

      this._closeTodoEditor();

      const overlay = document.createElement('div');
      overlay.className = PID + '-todo-editor-backdrop';
      overlay.addEventListener('click', (evt) => {
        if (evt.target === overlay) this._closeTodoEditor();
      });

      const sheet = overlay.createDiv({ cls: PID + '-todo-editor-sheet' });
      sheet.addEventListener('click', (evt) => evt.stopPropagation());
      sheet.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape') {
          evt.preventDefault();
          this._closeTodoEditor();
          return;
        }
        if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
          evt.preventDefault();
          saveBtn.click();
        }
      });

      const header = sheet.createDiv({ cls: PID + '-todo-editor-header' });
      header.createDiv({ cls: PID + '-todo-editor-title', text: isEditing ? t('todo.editorEdit') : t('todo.editorCreate') });
      const closeBtn = header.createEl('button', { cls: PID + '-todo-editor-close', text: '✕', attr: { type: 'button', title: t('todo.cancel') } });
      closeBtn.onclick = () => this._closeTodoEditor();

      const body = sheet.createDiv({ cls: PID + '-todo-editor-body' });

      const fieldTask = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldTask.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorTask') });
      const titleInput = fieldTask.createEl('textarea', { cls: PID + '-todo-editor-textarea', attr: { rows: '3', placeholder: t('todo.editorTaskPlaceholder') } });
      titleInput.value = draft.text;

      const fieldDue = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldDue.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorDue') });
      const dueQuick = fieldDue.createDiv({ cls: PID + '-todo-editor-quick' });
      const dateInput = fieldDue.createEl('input', { cls: PID + '-todo-editor-date', attr: { type: 'date' } });
      const dueButtons = [
        { key: 'none', label: t('todo.noDue'), apply: () => { draft.dueDate = null; } },
        { key: 'today', label: t('todo.dueTodayBtn'), apply: () => { draft.dueDate = window.moment().startOf('day'); } },
        { key: 'tomorrow', label: t('todo.dueTomorrowBtn'), apply: () => { draft.dueDate = window.moment().add(1, 'day').startOf('day'); } }
      ];
      const renderDueButtons = () => {
        dueQuick.querySelectorAll('.' + PID + '-todo-editor-chip').forEach((chip) => chip.remove());
        dueButtons.forEach((item) => {
          const btn = dueQuick.createEl('button', { cls: PID + '-todo-editor-chip', text: item.label, attr: { type: 'button' } });
          const due = draft.dueDate;
          const today = window.moment().startOf('day');
          const tomorrow = today.clone().add(1, 'day');
          const active = item.key === 'none'
            ? !due
            : item.key === 'today'
              ? !!(due && due.isSame(today, 'day'))
              : !!(due && due.isSame(tomorrow, 'day'));
          btn.classList.toggle('active', !!active);
          btn.onclick = () => {
            item.apply();
            renderDue();
          };
        });
      };
      const renderDue = () => {
        dateInput.value = draft.dueDate ? draft.dueDate.format('YYYY-MM-DD') : '';
        renderDueButtons();
      };
      dateInput.addEventListener('change', () => {
        draft.dueDate = dateInput.value ? parseDate(dateInput.value) : null;
        renderDueButtons();
      });

      const fieldPriority = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldPriority.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorPriority') });
      const priorityRow = fieldPriority.createDiv({ cls: PID + '-todo-editor-segment' });
      const priorityOptions = [
        { key: 'high', label: t('todo.priorityHigh') },
        { key: 'mid', label: t('todo.priorityMid') },
        { key: 'low', label: t('todo.priorityLow') }
      ];
      const renderPriority = () => {
        priorityRow.empty();
        priorityOptions.forEach((option) => {
          const btn = priorityRow.createEl('button', {
            cls: PID + '-todo-editor-segment-btn' + (draft.priority === option.key ? ' active' : ''),
            text: option.label,
            attr: { type: 'button' }
          });
          btn.onclick = () => {
            draft.priority = option.key;
            renderPriority();
          };
        });
      };

      const fieldTags = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldTags.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorTags') });
      const selectedTags = fieldTags.createDiv({ cls: PID + '-todo-editor-selected-tags' });
      const tagSuggestions = fieldTags.createDiv({ cls: PID + '-todo-editor-tags' });
      const tagInputRow = fieldTags.createDiv({ cls: PID + '-todo-editor-tag-input-row' });
      const tagInput = tagInputRow.createEl('input', {
        cls: PID + '-todo-editor-tag-input',
        attr: { type: 'text', placeholder: t('todo.editorTagPlaceholder') }
      });
      const tagAddBtn = tagInputRow.createEl('button', {
        cls: PID + '-todo-editor-secondary-btn',
        text: t('todo.editorAddTag'),
        attr: { type: 'button' }
      });
      const addTag = (value) => {
        const normalized = normalizeTodoTag(value);
        if (!normalized) return false;
        if (!draft.tags.includes(normalized)) draft.tags.push(normalized);
        tagInput.value = '';
        renderTags();
        return true;
      };
      const removeTag = (tag) => {
        draft.tags = draft.tags.filter((item) => item !== tag);
        renderTags();
      };
      const renderTags = () => {
        selectedTags.empty();
        if (!draft.tags.length) {
          selectedTags.createDiv({ cls: PID + '-todo-editor-empty', text: t('todo.editorNoTags') });
        } else {
          draft.tags.forEach((tag) => {
            const pill = selectedTags.createEl('button', {
              cls: PID + '-todo-editor-selected-tag',
              text: '#' + tag + ' ×',
              attr: { type: 'button' }
            });
            pill.onclick = () => removeTag(tag);
          });
        }
        tagSuggestions.empty();
        knownTags.forEach((tag) => {
          const btn = tagSuggestions.createEl('button', {
            cls: PID + '-todo-editor-chip' + (draft.tags.includes(tag) ? ' active' : ''),
            text: '#' + tag,
            attr: { type: 'button' }
          });
          btn.onclick = () => {
            if (draft.tags.includes(tag)) removeTag(tag);
            else addTag(tag);
          };
        });
      };
      tagAddBtn.onclick = () => addTag(tagInput.value);
      tagInput.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          addTag(tagInput.value);
        }
      });

      body.createDiv({ cls: PID + '-todo-editor-hint', text: t('todo.legacyHint') });

      const footer = sheet.createDiv({ cls: PID + '-todo-editor-footer' });
      const cancelBtn = footer.createEl('button', {
        cls: PID + '-todo-editor-secondary-btn',
        text: t('todo.cancel'),
        attr: { type: 'button' }
      });
      cancelBtn.onclick = () => this._closeTodoEditor();
      const saveBtn = footer.createEl('button', {
        cls: PID + '-todo-editor-primary-btn',
        text: isEditing ? t('todo.saveEdit') : t('todo.saveNew'),
        attr: { type: 'button' }
      });
      saveBtn.onclick = async () => {
        if (saveLocked) return;
        const rawTitle = titleInput.value.trim();
        if (!rawTitle) {
          titleInput.focus();
          return;
        }
        saveLocked = true;
        const merged = mergeLegacyTodoInput(rawTitle, draft);
        const target = existingTodo || {};
        const nextTodo = {
          text: merged.text,
          tags: merged.tags,
          dueDate: merged.dueDate,
          priority: merged.priority,
          done: existingTodo ? !!existingTodo.done : false,
          created: existingTodo?.created || window.moment(),
          doneDate: existingTodo?.doneDate || null
        };
        if (isEditing) this._todos[options.index] = { ...target, ...nextTodo };
        else this._todos.unshift(nextTodo);
        this._closeTodoEditor();
        if (refreshTodosRef) await refreshTodosRef();
        else {
          await saveTodos(this.app.vault, this._todos);
          if (refreshCalendarRef) refreshCalendarRef();
        }
      };

      renderDue();
      renderPriority();
      renderTags();

      this._todoEditorEl = overlay;
      document.body.appendChild(overlay);
      setTimeout(() => titleInput.focus(), 16);
    };

    // ===== 1.5 每日小贴士 =====
    const tip = getDailyTip(lang, this._dailyTips).replace(/^💡\s*/, '');
    root.createDiv({ cls: PLUGIN_ID+'-tip' }, el => {
      el.createDiv({ cls: PLUGIN_ID+'-tip-label', text: t('tip.label') });
      const manage = el.createEl('button', { cls:PLUGIN_ID+'-tip-manage', text:lang === 'en' ? 'Manage tips' : '管理提示', attr:{ type:'button' } });
      manage.style.display = this._editMode ? 'inline-flex' : 'none';
      manage.onclick = (evt) => { evt.preventDefault(); evt.stopPropagation(); new CockpitTipLibraryModal(this.app, this).open(); };
      el.createDiv({ cls: PLUGIN_ID+'-tip-text', text: tip });
    });

    // ===== 2. Toolbar（渲染与编辑交互由独立模块负责） =====
    const { toggleSearch } = buildToolbar(this, root, allFiles, t);
    this._blankContextMenuItems = [
      { title: t('contextMenu.newNote'), icon: 'plus', onClick: () => this._doAction('new') },
      { title: t('contextMenu.searchNotes'), icon: 'search', onClick: toggleSearch },
      { title: t('contextMenu.commandPalette'), icon: 'terminal', onClick: () => this._doAction('command') },
      { title: t('contextMenu.openGraph'), icon: 'git-fork', onClick: () => this._doAction('graph') },
      { title: t('contextMenu.startPomodoro'), icon: 'timer', onClick: () => this._doAction('pomodoro') }
    ];

    // ===== 3.5 日历看板（模块化实现） =====
    const refreshCalendar = buildCalendar(root, this._todos, {
      language: lang,
      t,
      openTodoEditor,
      onTodoToggle: async () => {
        await saveTodos(this.app.vault, this._todos);
        if (refreshTodosRef) await refreshTodosRef({ persist: false });
      },
      rss:this._rss,
      openRss:(date) => new CockpitRssModal(this.app, this, date).open()
    });
    refreshCalendarRef = refreshCalendar;
    this._refreshCalendarRef = refreshCalendar;

    // ===== 3. Categories =====
    const catsTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.cats') });
    catsTitle.dataset.section = 'cats-title';
    const catsEl = root.createDiv({ cls: PLUGIN_ID+'-cats' });
    const allFolders = this.app.vault.getAllLoadedFiles()
      .filter(f=>f.children && f.path!=='' && f.path!=='/' && !f.path.includes('/') && !f.path.startsWith('.') && !f.path.startsWith('_') && f.path!=='Templates');
    const folderCounts = {};
    allFiles.forEach(f=>{
      const p=f.path.split('/');
      if (p.length>=2) folderCounts[p[0]]=(folderCounts[p[0]]||0)+1;
    });
    allFolders.sort((a,b)=>a.path.localeCompare(b.path));
    allFolders.forEach((folder,idx)=>{
      const count = folderCounts[folder.path]||0;
      const name = folder.path.replace(/^\d+[-_]/,'')||folder.path;
      const card = catsEl.createEl('button', { cls: PLUGIN_ID+'-cat', attr:{ type:'button', title:t('categories.openFolder', { folder:name }) } });
      card.style.setProperty('--cat-clr', COLORS[idx%COLORS.length]);
      card.createDiv({ cls: PLUGIN_ID+'-cat-icon', text: ICONS[idx%ICONS.length] });
      card.createDiv({ cls: PLUGIN_ID+'-cat-name', text: name });
      card.createDiv({ cls: PLUGIN_ID+'-cat-count', text: t('categories.noteCount', { count }) });
      card.onclick=async ()=>{
        const files = allFiles.filter(f=>f.path.startsWith(folder.path+'/')).sort((a,b)=>a.path.localeCompare(b.path));
        const overview = files.find(f=>f.basename.includes('概览')||f.basename.includes('MOC')||f.basename.includes('概述'));
        const target = overview || files[0];
        if (target) await this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:target.path}});
        else new obsidian.Notice(t('categories.emptyFolder', { folder:name }));
      };
    });



    makeCollapsible(catsTitle, catsEl, 'cats');

    // ===== 4. Stats（可动态更新）=====
    const statsTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.stats') });
    statsTitle.dataset.section = 'stats-title';
    const statsEl = root.createDiv({ cls: PLUGIN_ID+'-stats' });
    const noteCount = allFiles.filter(f=>f.basename!=='Home'&&f.basename!=='欢迎').length;
    const statConfig = [
      { label:t('stats.noteCount'), max:50, color:'#818cf8', type:'static', value:noteCount },
      { label:t('stats.todoCount'), max:20, color:'#c084fc', type:'dynamic', field:'todoCount' },
      { label:t('stats.doneCount'), max:1,  color:'#22c55e', type:'dynamic', field:'doneCount' },
      { label:t('stats.doneRate'),  max:100,color:'#34d399', type:'dynamic', field:'donePct', suffix:'%' },
      { label:t('stats.focusToday'),max:480,color:'#f97316', type:'dynamic', field:'focusMin', suffix:' min' }
    ];
    const statValEls = [], statFillEls = [];
    statConfig.forEach(cfg=>{
      const card = statsEl.createDiv({ cls: PLUGIN_ID+'-stat' });
      card.style.setProperty('--stat-clr', cfg.color);
      card.createDiv({ cls: PLUGIN_ID+'-stat-label', text: cfg.label });
      const valEl = card.createDiv({ cls: PLUGIN_ID+'-stat-val' });
      statValEls.push(valEl);
      if (cfg.max > 0) {
        const bar = card.createDiv({ cls: PLUGIN_ID+'-stat-bar' });
        const fill = bar.createDiv({ cls: PLUGIN_ID+'-stat-fill', attr:{style:'width:0%'} });
        statFillEls.push(fill);
      } else {
        statFillEls.push(null);
      }
    });
    const updateStats = ()=>{
      const doneCount = this._todos.filter(t=>t.done).length;
      const todoCount = this._todos.length;
      const donePct = todoCount > 0 ? Math.round(doneCount/todoCount*100) : 0;
      const focusMin = this._focusMinutes || 0;
      const values = [noteCount, todoCount, doneCount, donePct, focusMin];
      values.forEach((val,i)=>{
        statValEls[i].textContent = '' + val + (statConfig[i].suffix||'');
        if (statFillEls[i]) {
          const max = statConfig[i].max;
          const pct = Math.min(100, max > 0 ? Math.round(val/max*100) : 0);
          statFillEls[i].style.width = pct + '%';
        }
      });
    };
    this._updateStatsRef = updateStats.bind(this);
    updateStats();
    makeCollapsible(statsTitle, statsEl, 'stats');

    // ===== 5. TODOs =====
    const todoHeader = root.createDiv({ cls: PLUGIN_ID+'-todo-header' });
    const todoTitleEl = todoHeader.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.todos') });
    todoTitleEl.dataset.section = 'todos-title';
    const addBtn = todoHeader.createEl('button', { cls: PLUGIN_ID+'-todo-add', text:'+', attr:{title:t('todo.add')} });
    const refreshBtn = todoHeader.createEl('button', { cls: PLUGIN_ID+'-todo-add', text:'↻', attr:{title:t('todo.refresh')} });
    const todoWrap = root.createDiv();
    todoWrap.dataset.section = 'todos-body';
    const todosEl = todoWrap.createDiv({ cls: PLUGIN_ID+'-todos' });

    // 状态筛选：用单一下拉框收纳选项，避免待办标题栏在窄窗口中拥挤。
    let currentStatus = 'todo';
    const statusOptions = [
      { key:'next', label:lang === 'en' ? 'Next' : '优先处理' },
      { key:'all', label:t('todo.all') },
      { key:'todo', label:t('todo.todo') },
      { key:'done', label:t('todo.done') }
    ];
    const statusSelectWrap = todoHeader.createDiv({ cls: PLUGIN_ID+'-status-select-wrap' });
    obsidian.setIcon(statusSelectWrap.createSpan({ cls: PLUGIN_ID+'-status-select-icon' }), 'list-filter');
    const statusSelect = statusSelectWrap.createEl('select', {
      cls: PLUGIN_ID+'-status-select',
      attr: { title: lang === 'en' ? 'Filter tasks by status' : '按状态筛选待办', 'aria-label': lang === 'en' ? 'Task status filter' : '待办状态筛选' }
    });
    statusOptions.forEach((option) => {
      const optionEl = statusSelect.createEl('option', { text: option.label, attr: { value: option.key } });
      optionEl.selected = option.key === currentStatus;
    });
    statusSelect.onchange = async () => {
      currentStatus = statusSelect.value;
      await renderTodos();
    };

    const getStatusFilteredTodos = ()=>{
      let filtered = this._todos;
      if (currentStatus === 'next') {
        const tomorrow = window.moment().add(1, 'day');
        filtered = filtered.filter(t => !t.done && (
          t.priority === 'high' ||
          (t.dueDate && t.dueDate.isSame(tomorrow, 'day'))
        ));
      }
      if (currentStatus === 'todo') filtered = filtered.filter(t => !t.done);
      if (currentStatus === 'done') filtered = filtered.filter(t => t.done);
      return filtered;
    };

    // 动态收集当前状态下可见的标签
    let currentTag = 'all'; // 当前选中页签
    const getVisibleTags = ()=>{
      const tagSet = new Set();
      getStatusFilteredTodos().forEach(t => { if (t.tags) t.tags.forEach(tag => tagSet.add(tag)); });
      return Array.from(tagSet).sort();
    };

    // 动态生成页签栏
    const renderTabs = (allTags, wrapEl)=>{
      wrapEl.empty();
      const tabsEl = wrapEl.createDiv({ cls: PLUGIN_ID+'-todo-tabs' });
      // 构造页签：全部 + 动态标签
      const tabs = [{ key:'all', label:t('todo.all') }];
      allTags.forEach(tag => tabs.push({ key:'tag:'+tag, label:'#'+tag }));
      tabs.forEach(tab => {
        const tabBtn = tabsEl.createEl('button', {
          cls: PLUGIN_ID+'-todo-tab' + (currentTag===tab.key?' active':''),
          text: tab.label
        });
        tabBtn.onclick = async ()=>{
          currentTag = tab.key;
          await renderTodos();
        };
      });
    };

    // 渲染待办列表（从内存数据渲染）
    let renderTodos = async (options = {})=>{
      const persist = options.persist !== false;
      todosEl.empty();
      if (persist) await saveTodos(this.app.vault, this._todos);
      updateStats();

      // 如果没有页签容器，创建它（插在 todoHeader 之后）
      let tabsWrap = root.querySelector('.'+PLUGIN_ID+'-todo-tabs-wrap');
      if (!tabsWrap) {
        tabsWrap = document.createElement('div');
        tabsWrap.className = PLUGIN_ID+'-todo-tabs-wrap';
        todoWrap.prepend(tabsWrap);
      }
      const allTags = getVisibleTags();
      if (currentTag !== 'all' && !allTags.includes(currentTag.replace('tag:',''))) currentTag = 'all';
      renderTabs(allTags, tabsWrap);

      // 根据状态过滤（全部/待办/已办）
      const statusFiltered = getStatusFilteredTodos();

      // 根据当前选中页签过滤
      const tagFiltered = currentTag === 'all'
        ? statusFiltered
        : statusFiltered.filter(t => t.tags && t.tags.includes(currentTag.replace('tag:','')));

      // 排序：优先级 high>mid+low，同优先级内按创建时间倒序，已过期的置顶
      const prioOrder = { high:0, mid:1, low:2 };
      const now = window.moment();
      tagFiltered.sort((a,b)=>{
        // 已过期的未完成置顶
        const aOver = !a.done && a.dueDate && a.dueDate.isBefore(now, 'day') ? 0 : 1;
        const bOver = !b.done && b.dueDate && b.dueDate.isBefore(now, 'day') ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        // 按优先级
        const pa = prioOrder[a.priority||'mid'];
        const pb = prioOrder[b.priority||'mid'];
        if (pa !== pb) return pa - pb;
        // 按创建时间倒序
        return (b.created?.valueOf()||0) - (a.created?.valueOf()||0);
      });

      tagFiltered.forEach((todo,i)=>{
        const realIdx = this._todos.indexOf(todo);
        const done = todo.done;
        const item = todosEl.createDiv({ cls: PLUGIN_ID+'-todo'+(done?' done':'') });

        // 优先级圆点
        const pdot = item.createDiv({
          cls: PLUGIN_ID+'-todo-pdot p-'+(todo.priority||'mid'),
          attr:{title:(todo.priority||'mid')==='high'?this._t('todo.priorityHigh'):(todo.priority||'mid')==='mid'?this._t('todo.priorityMid'):this._t('todo.priorityLow')}
        });

        // 复选框 - 切换完成状态，连带更新日期
        const chk = item.createDiv({ cls: PLUGIN_ID+'-todo-chk', text:done?'✓':'' });
        chk.onclick = async (e)=>{
          e.stopPropagation();
          this._todos[realIdx].done = !this._todos[realIdx].done;
          this._todos[realIdx].doneDate = this._todos[realIdx].done ? window.moment() : null;
          await renderTodos();
        };

        // 主内容区
        const main = item.createDiv({ cls: PLUGIN_ID+'-todo-main' });
        const txt = main.createDiv({ cls: PLUGIN_ID+'-todo-text', text:todo.text });
        txt.onclick = async (e)=>{
          e.stopPropagation();
          openTodoEditor({ index: realIdx });
        };

        // 时间元信息 + 截止日期 + 标签胶囊
        const meta = main.createDiv({ cls: PLUGIN_ID+'-todo-meta' });
        if (todo.created) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.cal+' '+fmtDate(todo.created, lang)});
        if (done && todo.doneDate) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.check+' '+fmtDate(todo.doneDate, lang)});
        // 截止日期显示
        if (todo.dueDate && !done) {
          const nowM = window.moment();
          let dueCls = 'due-future', dueLabel = fmtDate(todo.dueDate, lang);
          if (todo.dueDate.isBefore(nowM, 'day')) { dueCls = 'due-overdue'; dueLabel = t('todo.overdue', { date: fmtDate(todo.dueDate, lang) }); }
          else if (todo.dueDate.isSame(nowM, 'day')) { dueCls = 'due-today'; dueLabel = t('todo.dueToday'); }
          meta.createSpan({ cls: PLUGIN_ID+'-todo-due '+dueCls, text: dueLabel });
        }
        // 标签显示
        if (todo.tags && todo.tags.length > 0) {
          todo.tags.forEach(tag => {
            const pill = meta.createSpan({ cls: PLUGIN_ID+'-todo-tag-pill', text:'#'+tag });
            pill.onclick = async (e) => {
              e.stopPropagation();
              currentTag = 'tag:'+tag;
              await renderTodos();
            };
          });
        }

        // 状态标签
        item.createDiv({ cls: PLUGIN_ID+'-todo-tag '+(done?'tag-done':'tag-todo'), text:done?t('todo.stateDone'):t('todo.stateDoing') });

        // 优先级选择器（hover 时显示）
        const prioWrap = item.createDiv({ cls: PLUGIN_ID+'-prio-picker' });
        ['high','mid','low'].forEach(p => {
          const dot = prioWrap.createDiv({ cls: PLUGIN_ID+'-prio-opt p-' + p + ((todo.priority||'mid')===p?' sel':'') });
          dot.title = p==='high'?t('todo.priorityHigh'):p==='mid'?t('todo.priorityMid'):t('todo.priorityLow');
          dot.onclick = async (e)=>{
            e.stopPropagation();
            if ((todo.priority||'mid') === p) return;
            this._todos[realIdx].priority = p;
            prioWrap.querySelectorAll('.'+PLUGIN_ID+'-prio-opt').forEach(x => x.classList.remove('sel'));
            dot.classList.add('sel');
            item.querySelector('.'+PLUGIN_ID+'-todo-pdot').className = PLUGIN_ID+'-todo-pdot p-'+p;
            await saveTodos(this.app.vault, this._todos);
            if (this._refreshHeroReminder) this._refreshHeroReminder();
          };
        });

        // 操作按钮
        const actions = item.createDiv({ cls: PLUGIN_ID+'-todo-actions' });

        // 延期、编辑与删除使用 Obsidian 同一套 Lucide 图标，避免 emoji 风格割裂。
        if (!done) {
          const deferBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', title:lang === 'en' ? 'Move to tomorrow' : '延期到明天'} });
          obsidian.setIcon(deferBtn, 'calendar-clock');
          deferBtn.onclick = async (e) => {
            e.stopPropagation();
            this._todos[realIdx].dueDate = window.moment().add(1, 'day').startOf('day');
            await renderTodos();
          };
        }
        const editBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', title:t('todo.edit')} });
        obsidian.setIcon(editBtn, 'square-pen');
        editBtn.onclick = (e)=>{
          e.stopPropagation();
          openTodoEditor({ index: realIdx });
        };

        // 删除按钮
        const delBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn del', attr:{type:'button', title:t('todo.remove')} });
        obsidian.setIcon(delBtn, 'trash-2');
        delBtn.onclick = async (e)=>{ e.stopPropagation(); this._todos.splice(realIdx,1); await renderTodos(); };
      });
    };

    // 待办变化后同步刷新日历（深度计数器避免递归重复刷新）
    let _rtDepth = 0;
    const _rtOrig = renderTodos;
    const _refreshHero = this._refreshHeroReminder;
    renderTodos = async function(options = {}) {
      _rtDepth++;
      try { await _rtOrig(options); }
      finally {
        _rtDepth--;
        if (_rtDepth === 0) {
          if (refreshCalendarRef) refreshCalendarRef();
          if (_refreshHero) _refreshHero();
        }
      }
    };

    // 日历勾选待办后同步刷新下方列表
    refreshTodosRef = renderTodos;
    this._refreshTodosRef = renderTodos;

    // 刷新按钮：从 MD 文件重新加载数据
    refreshBtn.onclick = async ()=>{
      const loaded = await loadTodos(this.app.vault);
      if (loaded) {
        this._todos = loaded;
      }
      await renderTodos();
    };

    await renderTodos();
    makeCollapsible(todoTitleEl, todoWrap, 'todos');

    // 新增待办（结构化编辑器，兼容旧格式）
    addBtn.onclick = async ()=>{
      openTodoEditor();
    };

    // ===== 5.5 专注趋势 =====
    // 图表是可选模块，绝不能阻断后面的模块布局、编辑模式或情景布局初始化。
    try {
      this._refreshFocusChartRef = buildFocusChart(this, root);
    } catch (e) {
      this._refreshFocusChartRef = null;
      console.warn('Cockpit focus chart failed; dashboard layout remains available', e);
    }

    // ===== 6. Recent =====
    const recentTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.recent') });
    recentTitle.dataset.section = 'recent-title';
    this._recentEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
    this._allFiles = allFiles;
    this._allFiles.filter(f=>f.basename!=='Home').sort((a,b)=>b.stat.mtime-a.stat.mtime).slice(0,5).forEach(file=>{
      const item = this._recentEl.createDiv({ cls: PLUGIN_ID+'-recent-item', attr:{'data-path':file.path} });
      const isStarred = this._bookmarks.has(file.path);
      const starBtn = item.createSpan({ cls: PLUGIN_ID+'-bookmark-btn'+(isStarred?' starred':''), text: isStarred?'★':'☆', attr:{title:isStarred?t('recent.unstar'):t('recent.star')} });
      starBtn.onclick = async (e)=>{
        e.stopPropagation();
        if (this._bookmarks.has(file.path)) this._bookmarks.delete(file.path);
        else this._bookmarks.add(file.path);
        await this._storage.saveBookmarks(this._bookmarks);
        // 更新按钮状态
        const nowStarred = this._bookmarks.has(file.path);
        starBtn.textContent = nowStarred ? '★' : '☆';
        starBtn.className = PLUGIN_ID+'-bookmark-btn'+(nowStarred?' starred':'');
        starBtn.title = nowStarred ? t('recent.unstar') : t('recent.star');
        // 异步刷新收藏 section + 重建最近更新星星
        await this._refreshBookmarkSection(root, this._allFiles);
        this._rebuildRecentStars();
      };
      const link = item.createEl('a',{cls:PLUGIN_ID+'-recent-link',text:file.basename,href:'#'});
      link.onclick=e=>{e.preventDefault();this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:file.path}})};
      item.createDiv({ cls: PLUGIN_ID+'-recent-time', text: window.moment(file.stat.mtime).fromNow() });
    });
    makeCollapsible(recentTitle, this._recentEl, 'recent');

    // ===== 6.5 收藏文件 =====
    if (this._bookmarks.size > 0) {
      const bookmarkTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.bookmarks') });
      bookmarkTitle.dataset.section = 'bookmarks-title';
      const bmEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
      bmEl.dataset.section = 'bookmarks-list';
      this._orderedBookmarks().forEach(path=>{
        const f = allFiles.find(ff=>ff.path===path);
        if (!f) return;
        const item = bmEl.createDiv({ cls: PLUGIN_ID+'-recent-item' });
        const starBtn = item.createSpan({ cls: PLUGIN_ID+'-bookmark-btn starred', text: '★', attr:{title:t('recent.unstar')} });
        starBtn.onclick = async (e)=>{
          e.stopPropagation();
          this._bookmarks.delete(path);
          await this._storage.saveBookmarks(this._bookmarks);
          try {
            await this._refreshBookmarkSection(root, this._allFiles);
            this._rebuildRecentStars();
          } catch(err) { console.error('[Cockpit] rebuild failed', err); }
        };
        const link = item.createEl('a',{cls:PLUGIN_ID+'-recent-link',text:f.basename,href:'#'});
        link.onclick=e=>{e.preventDefault();this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:f.path}})};
        item.createDiv({ cls: PLUGIN_ID+'-recent-time', text: f.path });
      });
      // 统一用局部刷新渲染收藏操作按钮、固定顺序和折叠状态。
      await this._refreshBookmarkSection(root, allFiles);
    }

    // ===== 6.8 闪念胶囊 =====
    const flashTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.flash') });
    flashTitle.dataset.section = 'flash-title';
    const flashContent = root.createDiv();
    flashContent.dataset.section = 'flash-content';
    const flashWrap = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-row' });
    const flashInput = flashWrap.createEl('input', { cls: PLUGIN_ID+'-flash-input', attr:{placeholder:t('flash.placeholder'), type:'text'} });
    const flashOk = flashWrap.createEl('button', { cls: PLUGIN_ID+'-todo-input-ok', text:'✓' });
    const flashMsg = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-ok', attr:{style:'display:none'}, text:t('flash.saved') });
    const saveFlash = async ()=>{
      const v = flashInput.value.trim();
      if (!v) return;
      const today = window.moment().format('YYYY-MM-DD');
      const timeStr = window.moment().format('HH:mm');
      const filePath = `_daily/${today}.md`;
      const prefix = `# ${today} ${t('flash.fileHeading')}\n\n`;
      const line = `- [${timeStr}] ${v}\n`;
      try {
        const f = this.app.vault.getAbstractFileByPath('_daily');
        if (!f) await this.app.createFolder('_daily');
        const ex = this.app.vault.getAbstractFileByPath(filePath);
        if (ex) {
          const old = await this.app.vault.read(ex);
          await this.app.vault.modify(ex, old + line);
        } else {
          await this.app.vault.create(filePath, prefix + line);
        }
        flashInput.value = '';
        flashMsg.style.display = 'block';
        setTimeout(()=>{ flashMsg.style.display = 'none'; }, 2000);
      } catch(e) { console.warn('flash save',e); }
    };
    flashInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();saveFlash();} });
    flashOk.onclick = saveFlash;
    makeCollapsible(flashTitle, flashContent, 'flash');

    // ===== 底部：编辑热力图 =====
    const hmTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.heatmap') });
    hmTitle.dataset.section = 'heatmap-title';
    const heatmapEl = root.createDiv({ cls: PLUGIN_ID+'-heatmap' });
    const today = window.moment();
    const dayCounts = {};
    allFiles.forEach(f=>{
      const d = window.moment(f.stat.mtime);
      const diff = today.diff(d, 'days');
      if (diff >= 0 && diff < 30) {
        const key = d.format('YYYY-MM-DD');
        dayCounts[key] = (dayCounts[key]||0) + 1;
      }
    });
    const maxCount = Math.max(1, ...Object.values(dayCounts));
    // 5 级色阶：无→低→中→高→极高
    const colors = ['rgba(129,140,248,0.12)','rgba(129,140,248,0.3)','rgba(129,140,248,0.5)','rgba(99,102,241,0.7)','rgba(79,70,229,0.9)'];
    const getColor = (count) => {
      if (count === 0) return 'var(--background-modifier-border)';
      if (count >= maxCount * 0.8) return colors[4];
      if (count >= maxCount * 0.5) return colors[3];
      if (count >= maxCount * 0.25) return colors[2];
      return colors[1];
    };
    for (let i = 29; i >= 0; i--) {
      const d = today.clone().subtract(i, 'days');
      const key = d.format('YYYY-MM-DD');
      const count = dayCounts[key] || 0;
      const cell = heatmapEl.createDiv({ cls: PLUGIN_ID+'-hm-cell' });
      cell.title = key + ': ' + t('heatmap.files', { count });
      cell.style.background = getColor(count);
    }
    // 图例
    const legend = hmTitle.createDiv({ cls: PLUGIN_ID+'-hm-legend' });
    legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: t('heatmap.low') });
    colors.forEach(c => {
      const dot = legend.createDiv({ cls: PLUGIN_ID+'-hm-legend-cell' });
      dot.style.background = c;
    });
    legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: t('heatmap.high') });
    makeCollapsible(hmTitle, heatmapEl, 'heatmap');

    root.createDiv({ cls: PLUGIN_ID+'-footer', text: t('footer.text') });

    this._applyModuleLayout(root);

    const quickDoneBtn = root.createEl('button', {
      cls: PLUGIN_ID+'-layout-done',
      attr: { type: 'button', title: t('layout.done'), 'aria-label': t('layout.done') },
      text: '✓'
    });
    quickDoneBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this._editMode = false;
      this._applyModuleEditState(root);
      if (this._sceneSwitcherRefresh) this._sceneSwitcherRefresh();
    };
    this._applyModuleEditState(root);

    // ===== 番茄钟浮动组件 =====
    if (this._pomodoroAutoShow || this._pomodoroSession?.active) buildPomodoro(this, root);
  }

  // ========== 番茄钟 ==========
  _rebuildRecentStars() {
    const recentEl = this._recentEl;
    if (!recentEl) return;
    let count = 0;
    for (let i = 0; i < recentEl.children.length; i++) {
      const item = recentEl.children[i];
      const dp = item.getAttribute('data-path');
      if (!dp) continue;
      const isStarred = this._bookmarks.has(dp);
      // 找星星按钮
      let starBtn = item.querySelector('[class*="bookmark-btn"]');
      if (!starBtn) continue;
      starBtn.textContent = isStarred ? '★' : '☆';
      starBtn.className = PLUGIN_ID + '-bookmark-btn' + (isStarred ? ' starred' : '');
      starBtn.title = isStarred ? this._t('recent.unstar') : this._t('recent.star');
      count++;
    }
  }
  _orderedBookmarks() {
    const ordered = this._bookmarkOrder.filter((path) => this._bookmarks.has(path));
    this._bookmarks.forEach((path) => { if (!ordered.includes(path)) { ordered.push(path); this._bookmarkOrder.push(path); } });
    return ordered;
  }
  async _saveBookmarkOrder() {
    this._bookmarkOrder = this._orderedBookmarks();
    const data = await this._plugin.loadData() || {};
    data.bookmarkOrder = this._bookmarkOrder;
    await this._plugin.saveData(data);
  }
  async _openBookmarkInSplit(path) {
    const leaf = this.app.workspace.getLeaf('split', 'vertical');
    await leaf.setViewState({ type: 'markdown', state: { file: path }, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  _bindBookmarkCollapse(titleEl, contentEl) {
    this._makeModuleCollapsible('bookmarks', titleEl, contentEl);
  }
  _refreshRecentSection(root, allFiles) {
    const recentEl = this._recentEl || root.querySelector('.' + PLUGIN_ID + '-recent');
    if (!recentEl) return;
    recentEl.innerHTML = '';
    this._recentEl = recentEl;
    this._allFiles = allFiles;
    this._allFiles
      .filter((file) => file.basename !== 'Home')
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 5)
      .forEach((file) => {
        const item = recentEl.createDiv({ cls: PLUGIN_ID + '-recent-item', attr: { 'data-path': file.path } });
        const isStarred = this._bookmarks.has(file.path);
        const starBtn = item.createSpan({
          cls: PLUGIN_ID + '-bookmark-btn' + (isStarred ? ' starred' : ''),
          text: isStarred ? '★' : '☆',
          attr: { title: isStarred ? this._t('recent.unstar') : this._t('recent.star') }
        });
        starBtn.onclick = async (e) => {
          e.stopPropagation();
          if (this._bookmarks.has(file.path)) this._bookmarks.delete(file.path);
          else this._bookmarks.add(file.path);
          await this._storage.saveBookmarks(this._bookmarks);
          const nowStarred = this._bookmarks.has(file.path);
          starBtn.textContent = nowStarred ? '★' : '☆';
          starBtn.className = PLUGIN_ID + '-bookmark-btn' + (nowStarred ? ' starred' : '');
          starBtn.title = nowStarred ? this._t('recent.unstar') : this._t('recent.star');
          await this._refreshBookmarkSection(root, this._allFiles);
          this._rebuildRecentStars();
        };
        const link = item.createEl('a', { cls: PLUGIN_ID + '-recent-link', text: file.basename, href: '#' });
        link.onclick = (e) => {
          e.preventDefault();
          this.app.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: file.path } });
        };
        item.createDiv({ cls: PLUGIN_ID + '-recent-time', text: window.moment(file.stat.mtime).fromNow() });
      });
  }

  // 异步刷新收藏 section（局部 DOM 更新，不重建整个页面）
  async _refreshBookmarkSection(root, allFiles) {
    // 找到收藏 section 的标题和容器
    let bmTitle = root.querySelector('[data-section="bookmarks-title"]');
    let bmEl = root.querySelector('[data-section="bookmarks-list"]');

    if (this._bookmarks.size === 0) {
      // 没有收藏了，移除整个 section
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      this._applyModuleLayout(root);
      return;
    }

    // 收藏列表容器不存在则创建
    if (!bmEl || !bmEl.classList.contains(PLUGIN_ID + '-recent')) {
      // 旧的残留要先清
      if (bmTitle) bmTitle.remove();
      if (bmEl) bmEl.remove();
      bmTitle = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: this._t('sections.bookmarks') });
      bmTitle.dataset.section = 'bookmarks-title';
      bmEl = root.createDiv({ cls: PLUGIN_ID + '-recent' });
      bmEl.dataset.section = 'bookmarks-list';
      // 插到"最近更新"section 后面
      const recentTitle = root.querySelector('[data-section="recent-title"]');
      if (recentTitle && recentTitle.nextElementSibling) {
        recentTitle.nextElementSibling.after(bmEl);
        bmEl.before(bmTitle);
      }
    }

    // 重新渲染收藏列表
    bmEl.innerHTML = '';
    let hasVisible = false;
    const orderedPaths = this._orderedBookmarks();
    for (let index = 0; index < orderedPaths.length; index++) {
      const path = orderedPaths[index];
      const f = allFiles.find(ff => ff.path === path);
      if (!f) { this._bookmarks.delete(path); continue; } // 文件已删除，同步清理
      hasVisible = true;
      const item = bmEl.createDiv({ cls: PLUGIN_ID + '-recent-item' });
      const starBtn = item.createSpan({ cls: PLUGIN_ID + '-bookmark-btn starred', text: '★', attr: { title: this._t('recent.unstar') } });
      starBtn.onclick = async (e) => {
        e.stopPropagation();
        this._bookmarks.delete(path);
        await this._storage.saveBookmarks(this._bookmarks);
        await this._refreshBookmarkSection(root, allFiles);
        this._rebuildRecentStars();
      };
      const link = item.createEl('a', { cls: PLUGIN_ID + '-recent-link', text: f.basename, href: '#' });
      link.onclick = e => {
        e.preventDefault();
        this.app.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: f.path } });
      };
      const actions = item.createDiv({ cls: PLUGIN_ID + '-bookmark-actions' });
      const splitBtn = actions.createEl('button', {
        cls: PLUGIN_ID + '-bookmark-action',
        attr: { type: 'button', title: this._lang() === 'en' ? 'Open in split' : '在分栏打开' }
      });
      obsidian.setIcon(splitBtn, 'panel-right-open');
      splitBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this._openBookmarkInSplit(path);
      };
      const upBtn = actions.createEl('button', { cls: PLUGIN_ID + '-bookmark-action', attr: { type: 'button', title: this._lang() === 'en' ? 'Move up' : '上移' } });
      upBtn.disabled = index === 0;
      obsidian.setIcon(upBtn, 'chevron-up');
      upBtn.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); if (index === 0) return; [this._bookmarkOrder[index - 1], this._bookmarkOrder[index]] = [this._bookmarkOrder[index], this._bookmarkOrder[index - 1]]; await this._saveBookmarkOrder(); await this._refreshBookmarkSection(root, allFiles); };
      const downBtn = actions.createEl('button', { cls: PLUGIN_ID + '-bookmark-action', attr: { type: 'button', title: this._lang() === 'en' ? 'Move down' : '下移' } });
      downBtn.disabled = index === orderedPaths.length - 1;
      obsidian.setIcon(downBtn, 'chevron-down');
      downBtn.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); if (index >= orderedPaths.length - 1) return; [this._bookmarkOrder[index + 1], this._bookmarkOrder[index]] = [this._bookmarkOrder[index], this._bookmarkOrder[index + 1]]; await this._saveBookmarkOrder(); await this._refreshBookmarkSection(root, allFiles); };
      item.createDiv({ cls: PLUGIN_ID + '-recent-time', text: f.path });
    }
    if (!hasVisible) {
      bmTitle.remove(); bmEl.remove();
    } else {
      this._bindBookmarkCollapse(bmTitle, bmEl);
    }
    this._applyModuleLayout(root);
  }

  _getToolbarCommandConfig(...names) {
    for (const name of names) {
      if (name && this._toolbarCmds[name]) return this._toolbarCmds[name];
    }
    return null;
  }
  _launchInSystemTerminal(command) {
    if (this._isMobile()) return Promise.reject(new Error('desktop-only'));
    return new Promise((resolve, reject) => {
      try {
        const { execFile } = require('child_process');
        execFile('osascript', [
          '-e', 'on run argv',
          '-e', 'tell application "Terminal"',
          '-e', 'activate',
          '-e', 'do script (item 1 of argv)',
          '-e', 'end tell',
          '-e', 'end run',
          String(command || '')
        ], (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  _doAction(a, sourceEl) {
    if (String(a || '').startsWith('custom:')) {
      const id = String(a).slice('custom:'.length);
      executeCustomToolbarButton(this, this._customToolbarButtons.find((button) => button.id === id));
      return;
    }
    if (this._isMobile() && ['hermes','cockpit-h5','work-log'].includes(a)) {
      new obsidian.Notice(this._t('notices.desktopOnly', { action: a }) || (this._lang() === 'en' ? 'This action is only available on desktop.' : '此功能仅在桌面端可用。'));
      return;
    }
    if (a === 'hermes') {
      (async () => {
        try {
          const cfg = this._getToolbarCommandConfig('Hermes', 'hermes') || {};
          const command = cfg.command || 'hermes --tui';
          await this._launchInSystemTerminal(command);
          new obsidian.Notice(this._t('notices.hermesStartingExternal'));
        } catch(e) {
          console.warn('Hermes failed', e);
          new obsidian.Notice(this._t('notices.hermesFailed', { message: e?.message || 'unknown error' }));
        }
      })();
      return;
    }
    if (a === 'cockpit-h5') {
      try {
        const { exec } = require('child_process');
        const cfg = this._toolbarCmds['驾驶舱'];
        const cmd = cfg && cfg.command;
        if (!cmd) { new obsidian.Notice(this._t('notices.cockpitMissing')); return; }
        const url = cfg && cfg.url || 'http://localhost:3456';
        exec(cmd, (err) => {
          if (err) {
            if (!err.message.includes('EADDRINUSE')) {
              console.warn('驾驶舱 启动失败', err);
              new obsidian.Notice(this._t('notices.cockpitFailed', { message: err.message }));
              return;
            }
          }
          setTimeout(() => { exec('open ' + url); }, 800);
        });
        new obsidian.Notice(this._t('notices.cockpitStarting'));
      } catch(e) {
        console.warn('驾驶舱 launch failed', e);
      }
      return;
    }
    if (a === 'work-log') {
      try {
        const { exec } = require('child_process');
        const cfg = this._toolbarCmds['工作日志'];
        const cmd = cfg && cfg.command;
        if (!cmd) { new obsidian.Notice(this._t('notices.workLogMissing')); return; }
        exec(cmd, (err, stdout, stderr) => {
          if (err) {
            console.warn('工作日志执行失败', err);
            new obsidian.Notice(this._t('notices.workLogFailed', { message: err.message }));
            return;
          }
          if (stdout) console.log('[工作日志]', stdout);
          if (stderr) console.warn('[工作日志 stderr]', stderr);
          new obsidian.Notice(this._t('notices.workLogDone'));
        });
      } catch(e) {
        console.warn('工作日志启动失败', e);
      }
      return;
    }
    if (a === 'pomodoro') {
      try {
        const existing = document.querySelector('.'+PLUGIN_ID+'-pomodoro');
        if (!existing) buildPomodoro(this, this.containerEl);
      } catch(e) { console.warn('Pomodoro failed', e); }
      return;
    }
    if (a === 'notifications') {
      this.app.setting.open();
      this.app.setting.openTabById(PLUGIN_ID);
      return;
    }
    if (a === 'more') {
      try {
        this._openDashboardMenu(sourceEl);
      } catch(e) { console.warn('More menu failed', e); }
      return;
    }
    switch(a) {
      case 'new': this.app.commands.executeCommandById('file-explorer:new-file'); break;
      case 'search': /* 搜索已内嵌到 Dashboard，点击 toolbar 按钮展开 */ break;
      case 'tag': this.app.workspace.rightSplit.expand(); break;
      case 'graph': this.app.commands.executeCommandById('graph:open'); break;
      case 'command': this.app.commands.executeCommandById('command-palette:open'); break;
    }
  }
  async onClose() {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
    if (this._minuteRefreshTimer) { clearInterval(this._minuteRefreshTimer); this._minuteRefreshTimer = null; }
    if (this._visibilityRefreshHandler) {
      document.removeEventListener('visibilitychange', this._visibilityRefreshHandler);
      this._visibilityRefreshHandler = null;
    }
    this._unbindSilentRefreshSensors();
    if (this._viewportSyncHandler) {
      window.removeEventListener('resize', this._viewportSyncHandler);
      window.visualViewport?.removeEventListener('resize', this._viewportSyncHandler);
      this._viewportSyncHandler = null;
    }
    this._closeTodoEditor();
    this._closeWelcomeCover();
    this._closeOnboardingCard();
    // 番茄钟是全局单例，不随驾驶舱关闭而销毁
    // 只清理引用，不移除 DOM
    this._pomodoroTimer = null;
    this._heroRefs = null;
    this._refreshTodosRef = null;
    this._refreshCalendarRef = null;
    this._refreshHeroReminder = null;
  }
        // ========== 首次使用引导 — 区域引导卡片 ==========
  _markOnboardingDone() {
    this._onboardingDone = true;
    (async () => {
      try {
        const d = await this._plugin.loadData() || {};
        d.onboardingDone = true;
        await this._plugin.saveData(d);
      } catch(e) { console.warn('save onboard', e); }
    })();
  }
  _showWelcomeCover(root) {
    if (this._onboardingDone) return;
    this._closeWelcomeCover();
    const PID = PLUGIN_ID;
    const t = (key, vars) => this._t(key, vars);
    let selectedLang = this._language;

    const overlay = document.createElement('div');
    overlay.className = PID + '-welcome-backdrop';
    const card = overlay.createDiv({ cls: PID + '-welcome-card' });
    card.createDiv({ cls: PID + '-welcome-badge', text: t('welcome.badge') });
    card.createDiv({ cls: PID + '-welcome-title', text: t('welcome.title') });
    const intro = card.createDiv({ cls: PID + '-welcome-intro' });
    intro.createDiv({ cls: PID + '-welcome-copy primary', text: t('welcome.introCn') });
    intro.createDiv({ cls: PID + '-welcome-copy', text: t('welcome.introEn') });

    const langBlock = card.createDiv({ cls: PID + '-welcome-lang-block' });
    langBlock.createDiv({ cls: PID + '-welcome-label', text: t('welcome.chooseLanguage') });
    const langRow = langBlock.createDiv({ cls: PID + '-welcome-lang-row' });
    const renderLangs = () => {
      langRow.empty();
      LANG_OPTIONS.forEach((option) => {
        const btn = langRow.createEl('button', {
          cls: PID + '-welcome-lang-btn' + (selectedLang === option.code ? ' active' : ''),
          text: option.label,
          attr: { type: 'button' }
        });
        btn.onclick = () => {
          selectedLang = option.code;
          renderLangs();
        };
      });
    };
    renderLangs();

    const actions = card.createDiv({ cls: PID + '-welcome-actions' });
    const skipBtn = actions.createEl('button', {
      cls: PID + '-welcome-skip',
      text: t('welcome.skip'),
      attr: { type: 'button' }
    });
    skipBtn.onclick = async () => {
      this._closeWelcomeCover();
      if (selectedLang !== this._language) {
        await this._setLanguage(selectedLang);
      }
      this._markOnboardingDone();
    };
    const startBtn = actions.createEl('button', {
      cls: PID + '-welcome-start',
      text: t('welcome.continue'),
      attr: { type: 'button' }
    });
    startBtn.onclick = async () => {
      this._closeWelcomeCover();
      if (selectedLang !== this._language) {
        this._pendingOnboarding = true;
        await this._setLanguage(selectedLang);
        return;
      }
      this._showOnboarding(root);
    };

    this._welcomeCoverEl = overlay;
    document.body.appendChild(overlay);
  }
  _showOnboarding(root) {
    if (this._onboardingDone) return;
    this._closeWelcomeCover();
    const PID = PLUGIN_ID;
    const t = (key, vars) => this._t(key, vars);

    const steps = [
      { sel: '.'+PID+'-name', text: t('onboarding.stepName'), pos: 'below' },
      { sel: '.'+PID+'-toolbar', text: t('onboarding.stepToolbar'), pos: 'below' },
      { sel: '.'+PID+'-cal-wrap', text: t('onboarding.stepCalendar'), pos: 'above' },
      { sel: '.'+PID+'-todo-header', text: t('onboarding.stepTodo'), pos: 'above' },
      { sel: '.'+PID+'-toolbar', text: t('onboarding.stepContextMenu'), pos: 'below' },
      { sel: '.'+PID+'-stats', text: t('onboarding.stepStats'), pos: 'above' },
    ];
    const pomoEl = document.querySelector('.'+PID+'-pomodoro');
    if (pomoEl) steps.push({ el: pomoEl, text: t('onboarding.stepPomodoro'), pos: 'pomo' });

    let cur = 0, hlEl = null, card = null;

    const highlight = (s) => {
      if (hlEl) { hlEl.classList.remove(PID+'-onboarding-highlight'); hlEl = null; }
      const a = s.el || root.querySelector(s.sel);
      if (a) { hlEl = a; a.classList.add(PID+'-onboarding-highlight'); if (s.pos !== 'pomo') a.scrollIntoView({behavior:'smooth',block:'center'}); }
    };

    const positionCard = (s) => {
      if (!card) return;
      const a = s.el || root.querySelector(s.sel);
      if (!a || s.pos === 'pomo') {
        // fallback: bottom-right
        card.style.bottom = '80px';
        card.style.right = '220px';
        card.style.top = 'auto';
        card.style.left = 'auto';
        return;
      }
      const rect = a.getBoundingClientRect();
      const pad = 12;
      let top, left;
      if (s.pos === 'below') {
        top = rect.bottom + pad;
        left = Math.max(12, Math.min(rect.left, window.innerWidth - 360));
      } else {
        top = rect.top - pad - (card.firstChild ? card.offsetHeight || 120 : 120);
        left = Math.max(12, Math.min(rect.left, window.innerWidth - 360));
      }
      // clamp
      top = Math.max(8, Math.min(top, window.innerHeight - 160));
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      card.style.bottom = 'auto';
      card.style.right = 'auto';
    };

    const buildCard = (i) => {
      if (i >= steps.length) { finish(); return; }
      const s = steps[i];
      if (!card) {
        card = document.createElement('div');
        card.id = PID+'-tour';
        card.className = PID + '-onboarding-card';
        document.body.appendChild(card);
      }
      card.innerHTML = '';
      card.style.opacity = '1';
      // header
      const top = document.createElement('div');
      top.className = PID + '-onboarding-card-head';
      const num = document.createElement('span');
      num.textContent = (i+1)+'/'+steps.length;
      num.className = PID + '-onboarding-card-step';
      top.appendChild(num);
      const cl = document.createElement('button');
      cl.textContent = t('onboarding.close');
      cl.className = PID + '-onboarding-card-close';
      cl.onclick = finish;
      top.appendChild(cl);
      card.appendChild(top);
      // body
      const body = document.createElement('div');
      body.textContent = s.text;
      body.className = PID + '-onboarding-card-body';
      card.appendChild(body);
      // buttons
      const btnRow = document.createElement('div');
      btnRow.className = PID + '-onboarding-card-actions';
      if (i > 0) {
        const pb = document.createElement('button');
        pb.textContent = t('onboarding.prev');
        pb.className = PID + '-onboarding-card-btn secondary';
        pb.onclick = () => { cur = i-1; buildCard(cur); };
        btnRow.appendChild(pb);
      }
      const nb = document.createElement('button');
      nb.textContent = i < steps.length-1 ? t('onboarding.next') : t('onboarding.done');
      nb.className = PID + '-onboarding-card-btn primary';
      nb.onclick = () => { cur = i+1; buildCard(cur); };
      btnRow.appendChild(nb);
      card.appendChild(btnRow);
      highlight(s);
      requestAnimationFrame(() => { positionCard(s); });
      cur = i;
    };

    const finish = () => {
      if (hlEl) hlEl.classList.remove(PID+'-onboarding-highlight');
      const c = document.getElementById(PID+'-tour');
      if (c) { c.style.opacity = '0'; setTimeout(() => c.remove(), 300); }
      this._markOnboardingDone();
    };

    buildCard(0);
  }
}

class CockpitReleaseNotesModal extends obsidian.Modal {
  constructor(app, plugin, language) {
    super(app);
    this._plugin = plugin;
    this._language = language;
  }

  _t(key, vars) {
    return getText(this._language, key, vars);
  }

  _pickLocalizedReleaseField(field, fallback) {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    const lang = normalizeLang(this._language);
    return field[lang] || field.en || field['zh-CN'] || fallback;
  }

  onOpen() {
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(PLUGIN_ID + '-release-modal');
    titleEl.setText(this._t('releases.title'));
    contentEl.empty();

    const top = contentEl.createDiv({ cls: PLUGIN_ID + '-release-top' });
    top.createDiv({ cls: PLUGIN_ID + '-release-current', text: this._t('releases.current') + ' · v' + (this._plugin.manifest?.version || 'unknown') });

    if (!RELEASE_HISTORY.length) {
      contentEl.createDiv({ cls: PLUGIN_ID + '-release-empty', text: this._t('releases.empty') });
      return;
    }

    RELEASE_HISTORY.forEach((release) => {
      const card = contentEl.createDiv({ cls: PLUGIN_ID + '-release-card' });
      const head = card.createDiv({ cls: PLUGIN_ID + '-release-head' });
      head.createDiv({ cls: PLUGIN_ID + '-release-version', text: 'v' + release.version });
      head.createDiv({ cls: PLUGIN_ID + '-release-date', text: release.date });
      card.createDiv({
        cls: PLUGIN_ID + '-release-title',
        text: this._pickLocalizedReleaseField(release.title, release.version)
      });
      const list = card.createEl('ul', { cls: PLUGIN_ID + '-release-list' });
      const highlights = this._pickLocalizedReleaseField(release.highlights, []);
      (Array.isArray(highlights) ? highlights : []).forEach((item) => {
        list.createEl('li', { text: item });
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class CockpitPlugin extends obsidian.Plugin {
  async onload() {
    this.serverChan = new ServerChanService(this);
    this.serverChan.startScheduler();
    this.addSettingTab(new CockpitServerChanSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, l=>new CockpitView(l, this));
    this.addRibbonIcon('layout-dashboard','Cockpit',()=>this._open());
    this.addCommand({id:'open-cockpit',name:'打开 Cockpit 驾驶舱',callback:()=>this._open()});
    this.addCommand({ id:'global-search', name:'打开 Cockpit 全局搜索', callback:() => openGlobalSearch(this.app) });
    this.addCommand({ id:'open-data-migration', name:'打开 Cockpit 数据迁移', callback:async () => { await this._open(); const view = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view; if (view) openStorageMigration(view); } });
    this.app.workspace.onLayoutReady(()=>this._open());
  }
  async _open() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('split','vertical'); await leaf.setViewState({type:VIEW_TYPE,active:true}); }
    this.app.workspace.revealLeaf(leaf);
    return leaf;
  }
  async onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); }
}
module.exports = CockpitPlugin;
