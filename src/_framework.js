class CockpitView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this._plugin = plugin; this._storage = null; this._rss = new CockpitRssService(plugin); this._todos = []; this._refreshTimer = null; this._minuteRefreshTimer = null; this._bookmarks = new Set(); this._bookmarkOrder = []; this._customToolbarButtons = []; this._toolbarOrder = []; this._deletedToolbarActions = new Set(); this._recentEl = null; this._recentOpened = []; this._recentPositions = {}; this._trackedWorkspaceLeaf = null; this._flashInbox = []; this._allFiles = []; this._focusMinutes = 0; this._focusHistory = new Map(); this._focusChartSettings = { range:'week', type:'line' }; this._calendarViewMode = 'month'; this._pomodoroTimer = null; this._pomodoroAutoShow = true; this._pomodoroSession = null; this._pomodoroTaskStats = {}; this._pomodoroCompletions = []; this._username = getText(DEFAULT_LANG, 'hero.defaultName'); this._language = DEFAULT_LANG; this._collapsed = {}; this._toolbarCmds = {}; this._onboardingDone = false; this._blankContextMenuItems = []; this._customModuleLabels = {}; this._moduleOrder = this._defaultModuleOrder(); this._hiddenModules = new Set(['focusChart', 'scheduledTasks']); this._hiddenToolbarActions = new Set(); this._statsCardOrder = this._defaultStatsCardOrder(); this._hiddenStatsCards = new Set(); this._dragStatId = null; this._sceneLayouts = {}; this._activeSceneId = 'default'; this._sceneSwitcherRefresh = null; this._editMode = false; this._dragModuleId = null; this._todoEditorEl = null; this._pendingOnboarding = false; this._welcomeCoverEl = null; this._heroRefs = null; this._refreshTodosRef = null; this._refreshCalendarRef = null; this._refreshHeroReminder = null; this._visibilityRefreshHandler = null; this._interactionHandler = null; this._interactionSensorEl = null; this._lastInteractionAt = 0; }
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
    const mobileDevice = this._isMobile();
    root.classList.toggle(PLUGIN_ID + '-phone-narrow', width < 390);
    root.classList.toggle(PLUGIN_ID + '-phone', mobileDevice || width < 680);
    root.classList.toggle(PLUGIN_ID + '-tablet', !mobileDevice && width >= 680 && width < 980);
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
      { id:'flash', label:this._t('sections.flash'), collapsible:true, matches:(el) => el.dataset.section === 'flash-title' || el.dataset.section === 'flash-content' },
      { id:'heatmap', label:this._t('sections.heatmap'), collapsible:true, matches:(el) => el.dataset.section === 'heatmap-title' || el.classList.contains(PLUGIN_ID + '-heatmap') },
      { id:'scheduledTasks', label:this._t('sections.scheduledTasks'), collapsible:true, matches:(el) => el.dataset.section === 'scheduled-tasks-title' || el.dataset.section === 'scheduled-tasks-body' },
      { id:'footer', label:this._t('layout.modules.footer'), matches:(el) => el.classList.contains(PLUGIN_ID + '-footer') },
      { id:'recent', label:this._t('sections.recent'), collapsible:true, matches:(el) => el.dataset.section === 'recent-title' || el.classList.contains(PLUGIN_ID + '-recent-tabs') || el.classList.contains(PLUGIN_ID + '-recent') }
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
    if (!next.length) return defaults;
    // 页脚是默认锚点：后续新增模块首次进入旧布局时放在它上方，
    // 但绝不强行移动用户已经保存过的任何现有模块。
    const missing = defaults.filter((id) => !seen.has(id));
    const missingContent = missing.filter((id) => id !== 'footer' && id !== 'recent');
    let footerIndex = next.indexOf('footer');
    if (footerIndex < 0) {
      next.push('footer');
      footerIndex = next.length - 1;
    }
    next.splice(footerIndex, 0, ...missingContent);
    if (missing.includes('recent')) {
      const footerPosition = next.indexOf('footer');
      next.splice(footerPosition + 1, 0, 'recent');
    }
    return next;
  }
  _moduleLabel(id) {
    return this._customModuleLabels?.[id] || this._moduleRegistry().find((module) => module.id === id)?.label || id;
  }
  _moduleTitleElement(wrapper) {
    if (wrapper?.dataset.moduleId === 'footer') return wrapper.querySelector('.' + PLUGIN_ID + '-footer');
    return wrapper?.querySelector('[data-section$="-title"], .' + PLUGIN_ID + '-todo-header .' + PLUGIN_ID + '-section-title') || null;
  }
  _applyCustomModuleTitle(wrapper, moduleId) {
    const title = this._moduleTitleElement(wrapper);
    if (!title) return;
    const textNode = Array.from(title.childNodes).find((node) => node.nodeType === 3 && node.textContent.trim());
    if (!textNode) return;
    if (!title.dataset.defaultModuleTitle) title.dataset.defaultModuleTitle = textNode.textContent.trim();
    textNode.textContent = this._customModuleLabels?.[moduleId] || title.dataset.defaultModuleTitle;
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
  _defaultStatsCardOrder() { return ['noteCount','todoCount','doneCount','donePct','focusMin','focusGap','tagBacklog']; }
  _normalizeStatsCardOrder(order) {
    const defaults = this._defaultStatsCardOrder();
    const seen = new Set();
    const next = Array.isArray(order) ? order.filter((id) => defaults.includes(id) && !seen.has(id) && (seen.add(id), true)) : [];
    defaults.forEach((id) => { if (!seen.has(id)) next.push(id); });
    return next;
  }
  _normalizeStatsCardSubset(list) {
    const defaults = new Set(this._defaultStatsCardOrder());
    const seen = new Set();
    return Array.isArray(list) ? list.filter((id) => defaults.has(id) && !seen.has(id) && (seen.add(id), true)) : [];
  }
  async _saveStatsCardLayout() {
    this._statsCardOrder = this._normalizeStatsCardOrder(this._statsCardOrder);
    this._hiddenStatsCards = new Set(this._normalizeStatsCardSubset(Array.from(this._hiddenStatsCards)));
    await this._saveActiveSceneLayout();
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
  _sceneSnapshot() { return { moduleOrder:[...this._moduleOrder], hiddenModules:Array.from(this._hiddenModules), toolbarOrder:[...this._toolbarOrder], hiddenToolbarActions:Array.from(this._hiddenToolbarActions), statsCardOrder:[...this._statsCardOrder], hiddenStatsCards:Array.from(this._hiddenStatsCards), moduleLabels:{...this._customModuleLabels} }; }
  _sceneLabel(scene) { return scene?.id === 'default' ? (this._lang() === 'en' ? 'Default layout' : '默认布局') : (scene?.name || (this._lang() === 'en' ? 'Untitled scene' : '未命名情景')); }
  _sceneList() { return Object.values(this._sceneLayouts); }
  _getActiveScene() { return this._sceneLayouts[this._activeSceneId] || this._sceneLayouts.default; }
  _applySceneSnapshot(scene) {
    const layout = scene?.layout || {};
    this._moduleOrder = this._normalizeModuleOrder(layout.moduleOrder);
    this._hiddenModules = new Set(this._normalizeModuleSubset(layout.hiddenModules));
    this._toolbarOrder = normalizeToolbarOrder(this, layout.toolbarOrder);
    this._hiddenToolbarActions = new Set(this._normalizeToolbarActionSubset(layout.hiddenToolbarActions));
    this._statsCardOrder = this._normalizeStatsCardOrder(layout.statsCardOrder);
    this._hiddenStatsCards = new Set(this._normalizeStatsCardSubset(layout.hiddenStatsCards));
    this._customModuleLabels = layout.moduleLabels && typeof layout.moduleLabels === 'object' && !Array.isArray(layout.moduleLabels)
      ? Object.fromEntries(Object.entries(layout.moduleLabels).filter(([id,label]) => this._defaultModuleOrder().includes(id) && typeof label === 'string' && label.trim()).map(([id,label]) => [id,label.trim().slice(0,40)]))
      : {};
  }
  async _saveActiveSceneLayout() {
    const scene = this._getActiveScene();
    if (!scene) return;
    scene.layout = this._sceneSnapshot();
    await this._mutatePluginData((data) => {
      data.sceneLayouts = this._sceneLayouts;
      data.activeSceneId = this._activeSceneId;
      data.moduleOrder = this._moduleOrder; data.hiddenModules = Array.from(this._hiddenModules);
      data.toolbarOrder = this._toolbarOrder; data.hiddenToolbarActions = Array.from(this._hiddenToolbarActions);
    });
  }
  async _switchScene(id) {
    const scene = this._sceneLayouts[id]; if (!scene || id === this._activeSceneId) return;
    this._activeSceneId = id; this._editMode = false; this._applySceneSnapshot(scene);
    await this._saveActiveSceneLayout();
    await this._renderDashboard(false, true);
  }
  _sceneRuleMatches(scene, now = window.moment()) {
    const rule = scene?.autoRule;
    if (!rule?.enabled) return false;
    const folder = String(rule.folder || '').replace(/^\/+|\/+$/g, '');
    const activePath = this.app.workspace.getActiveFile?.()?.path || '';
    if (folder && !(activePath === folder || activePath.startsWith(folder + '/'))) return false;
    if (!Array.isArray(rule.days) || !rule.days.includes(now.day())) return false;
    if (!/^\d{2}:\d{2}$/.test(rule.start || '') || !/^\d{2}:\d{2}$/.test(rule.end || '')) return false;
    const current = now.format('HH:mm');
    // 支持跨午夜的时间段，例如 22:00–06:00。
    return rule.start <= rule.end ? current >= rule.start && current < rule.end : current >= rule.start || current < rule.end;
  }
  async _setSceneAutoRule(id, rule) {
    const scene = this._sceneLayouts[id]; if (!scene) return;
    const days = Array.from(new Set((Array.isArray(rule?.days) ? rule.days : []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)));
    scene.autoRule = { enabled:rule?.enabled === true && days.length > 0, start:/^\d{2}:\d{2}$/.test(rule?.start || '') ? rule.start : '09:00', end:/^\d{2}:\d{2}$/.test(rule?.end || '') ? rule.end : '18:00', days, folder:String(rule?.folder || '').trim().replace(/^\/+|\/+$/g, '').slice(0, 300) };
    await this._mutatePluginData((data) => { data.sceneLayouts = this._sceneLayouts; });
    await this._applyAutomaticScene();
  }
  async _applyAutomaticScene() {
    const match = this._sceneList().find((scene) => scene.id !== this._activeSceneId && this._sceneRuleMatches(scene));
    if (match) await this._switchScene(match.id);
  }
  _startSceneAutoSwitching() {
    if (this._sceneAutoTimer) window.clearInterval(this._sceneAutoTimer);
    this._sceneAutoTimer = window.setInterval(() => this._applyAutomaticScene().catch((e) => console.warn('Cockpit scene automation failed', e)), 60000);
    this._applyAutomaticScene().catch((e) => console.warn('Cockpit scene automation failed', e));
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
    await this._mutatePluginData((data) => { data.pomodoroAutoShow = this._pomodoroAutoShow; });
  }
  _getFocusChartSettings() { return { range:this._focusChartSettings?.range === 'month' ? 'month' : 'week', type:this._focusChartSettings?.type === 'bar' ? 'bar' : 'line' }; }
  async _setFocusChartSettings(patch) { this._focusChartSettings = { ...this._getFocusChartSettings(), ...patch }; await this._mutatePluginData((data) => { data.focusChartSettings = this._focusChartSettings; }); }
  async _savePomodoroSession(session) {
    this._pomodoroSession = session || null;
    await this._mutatePluginData((data) => { data.pomodoroSession = this._pomodoroSession; });
  }
  async _commitPomodoroCompletion(input, nextSession) {
    let outcome = null;
    await this._mutatePluginData((data) => {
      outcome = recordPomodoroCompletion(data.pomodoroTaskStats, data.pomodoroCompletions, input);
      if (!outcome.entry) throw new Error('invalid-pomodoro-completion');
      data.pomodoroTaskStats = outcome.stats;
      data.pomodoroCompletions = outcome.completions;
      data.pomodoroSession = nextSession;
    });
    this._pomodoroTaskStats = outcome.stats;
    this._pomodoroCompletions = outcome.completions;
    this._pomodoroSession = nextSession;
    if (this._refreshTodosRef) await this._refreshTodosRef({ persist:false });
    return outcome;
  }
  async _markPomodoroCompletionsApplied(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    let next = [];
    await this._mutatePluginData((data) => {
      next = markPomodoroCompletionsApplied(data.pomodoroCompletions, ids);
      data.pomodoroCompletions = next;
    });
    this._pomodoroCompletions = next;
  }
  async _applyPomodoroCompletionToFocusHistory(entry) {
    if (!entry) return 0;
    const actualMinutes = await this._saveFocusHistory(entry.day, entry.targetMinutes);
    if (!this._focusHistory) this._focusHistory = new Map();
    this._focusHistory.set(entry.day, actualMinutes);
    if (entry.day === window.moment().format('YYYY-MM-DD')) this._focusMinutes = actualMinutes;
    await this._markPomodoroCompletionsApplied([entry.id]);
    return actualMinutes;
  }
  async _recoverPendingPomodoroCompletions() {
    const sessionCompletion = this._pomodoroSession?.pendingCompletion;
    if (sessionCompletion) {
      try {
        const nextSession = { ...this._pomodoroSession, pendingCompletion:null };
        const outcome = await this._commitPomodoroCompletion(sessionCompletion, nextSession);
        this._pomodoroCompletions = outcome.completions;
        this._pomodoroSession = nextSession;
      } catch (e) {
        console.warn('Cockpit: recover pending session completion failed', e);
      }
    }
    try {
      const recovery = await replayPomodoroCompletions(
        this._pomodoroCompletions,
        (day, targetMinutes) => this._saveFocusHistory(day, targetMinutes),
        (ids) => this._markPomodoroCompletionsApplied(ids)
      );
      recovery.focusByDay.forEach((minutes, day) => this._focusHistory.set(day, minutes));
    } catch (e) {
      // focus.md 采用 max(targetMinutes) 幂等写入；状态标记失败时，下次启动安全重放。
      console.warn('Cockpit: recover focus completions failed', e);
    }
    this._focusMinutes = this._focusHistory.get(window.moment().format('YYYY-MM-DD')) || 0;
  }
  async _mutatePluginData(mutator) { return this._plugin.mutateData(mutator); }
  async _applyPomodoroTaskAction(taskId, action) {
    const outcome = await mutateTodos(this.app.vault, (todos) => {
      const todo = todos.find((item) => item.id === taskId);
      if (!todo) return false;
      if (action === 'complete') {
        todo.done = true;
        todo.doneDate = window.moment();
      } else if (action === 'tomorrow') {
        todo.done = false;
        todo.doneDate = null;
        todo.dueDate = window.moment().add(1, 'day').startOf('day');
      } else {
        return false;
      }
      return true;
    });
    if (!outcome.saved || !outcome.todos) return false;
    this._todos = outcome.todos;
    if (this._refreshTodosRef) await this._refreshTodosRef({ persist:false });
    else {
      this._refreshCalendarRef?.();
      this._refreshHeroReminder?.();
    }
    return true;
  }
  async _deletePresetToolbarAction(action) {
    if (!['hermes', 'cockpit-h5', 'work-log'].includes(action)) return;
    this._deletedToolbarActions.add(action);
    this._hiddenToolbarActions.delete(action);
    await this._mutatePluginData((data) => {
      data.deletedToolbarActions = Array.from(this._deletedToolbarActions);
      data.hiddenToolbarActions = Array.from(this._hiddenToolbarActions);
      data.toolbarOrder = (Array.isArray(data.toolbarOrder) ? data.toolbarOrder : []).filter((item) => item !== action);
    });
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
    await this._mutatePluginData((data) => { data.customToolbarButtons = this._customToolbarButtons; });
  }
  _getGreetingByHour(hour) {
    let greeting = this._t('greetings.morning');
    if (hour >= 12 && hour < 14) greeting = this._t('greetings.noon');
    else if (hour >= 14 && hour < 18) greeting = this._t('greetings.afternoon');
    else if (hour >= 18 && hour < 22) greeting = this._t('greetings.evening');
    else if (hour >= 22 || hour < 6) greeting = this._t('greetings.night');
    return greeting;
  }
  _getHeroDueText(now = window.moment()) {
    const today = now.clone().startOf('day');
    const tomorrow = today.clone().add(1, 'day');
    const counts = { overdue:0, today:0, tomorrow:0 };
    this._todos.forEach((todo) => {
      if (todo.done || !todo.dueDate) return;
      if (todo.dueDate.isBefore(today, 'day')) counts.overdue++;
      else if (todo.dueDate.isSame(today, 'day')) counts.today++;
      else if (todo.dueDate.isSame(tomorrow, 'day')) counts.tomorrow++;
    });
    return counts.overdue || counts.today || counts.tomorrow
      ? this._t('hero.dueTodos', counts)
      : '';
  }
  _refreshHeroSection() {
    if (!this._heroRefs) return;
    const now = window.moment();
    let heroSubText = this._t('hero.today', { date: formatHeroDate(now, this._lang()) });
    const dueText = this._getHeroDueText(now);
    if (dueText) heroSubText += ' · ' + dueText;
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
    const previous = this._plugin._cockpitFocusHistoryWrite || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      const dir = '_data';
      if (!this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
      const filePath = '_data/focus.md';
      const existing = this.app.vault.getAbstractFileByPath(filePath);
      const history = existing
        ? this._parseFocusHistory(await this.app.vault.read(existing))
        : new Map();
      const nextMinutes = Math.max(history.get(date) || 0, Math.max(0, parseInt(minutes, 10) || 0));
      history.set(date, nextMinutes);
      const content = this._serializeFocusHistory(history);
      if (existing) await this.app.vault.modify(existing, content);
      else await this.app.vault.create(filePath, content);
      return nextMinutes;
    });
    this._plugin._cockpitFocusHistoryWrite = operation;
    return operation;
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
      const renameBtn = wrapper.querySelector('.' + PLUGIN_ID + '-module-rename');
      const label = this._moduleLabel(moduleId);
      if (badge) badge.textContent = hidden ? label + ' · ' + this._t('layout.hiddenTag') : label;
      if (handle) {
        handle.style.display = '';
        handle.draggable = this._editMode;
        handle.tabIndex = this._editMode ? 0 : -1;
        handle.setAttribute('aria-hidden', this._editMode ? 'false' : 'true');
      }
      if (visibilityBtn) {
        visibilityBtn.style.display = '';
        visibilityBtn.textContent = hidden ? this._t('layout.show') : this._t('layout.hide');
        visibilityBtn.title = hidden
          ? this._t('layout.showModule', { module: label })
          : this._t('layout.hideModule', { module: label });
        visibilityBtn.tabIndex = this._editMode ? 0 : -1;
        visibilityBtn.classList.toggle('is-hidden', hidden);
      }
      if (renameBtn) {
        renameBtn.style.display = this._moduleTitleElement(wrapper) ? '' : 'none';
        renameBtn.title = this._lang() === 'en' ? `Rename ${label}` : `重命名“${label}”`;
        renameBtn.setAttribute('aria-label', renameBtn.title);
        renameBtn.tabIndex = this._editMode ? 0 : -1;
      }
    });
    root.querySelectorAll('.' + PLUGIN_ID + '-tip-manage').forEach((button) => {
      button.style.display = this._editMode ? 'inline-flex' : 'none';
    });
    root.querySelectorAll('.' + PLUGIN_ID + '-stat').forEach((card) => {
      const hidden = this._hiddenStatsCards.has(card.dataset.statId);
      card.classList.toggle('is-stat-hidden', hidden);
      card.classList.toggle('is-stat-editing', this._editMode);
      card.draggable = this._editMode;
      card.style.display = !this._editMode && hidden ? 'none' : '';
      const hide = card.querySelector('.' + PLUGIN_ID + '-stat-hide');
      if (hide) {
        hide.textContent = hidden ? '＋' : '−';
        hide.title = hidden ? (this._lang() === 'en' ? 'Show this card' : '显示这张卡片') : (this._lang() === 'en' ? 'Hide this card' : '隐藏这张卡片');
        hide.setAttribute('aria-label', hide.title);
      }
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
      let renameBtn;
      if (!tools) {
        tools = document.createElement('div');
        tools.className = PLUGIN_ID + '-module-tools';
        badge = document.createElement('span');
        badge.className = PLUGIN_ID + '-module-badge';
        visibilityBtn = document.createElement('button');
        visibilityBtn.type = 'button';
        visibilityBtn.className = PLUGIN_ID + '-module-visibility';
        renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = PLUGIN_ID + '-module-rename';
        renameBtn.textContent = '✎';
        handle = document.createElement('button');
        handle.type = 'button';
        handle.className = PLUGIN_ID + '-module-handle';
        handle.textContent = '↕';
        tools.appendChild(badge);
        tools.appendChild(renameBtn);
        tools.appendChild(visibilityBtn);
        tools.appendChild(handle);
        wrapper.prepend(tools);
      } else {
        badge = tools.querySelector('.' + PLUGIN_ID + '-module-badge');
        visibilityBtn = tools.querySelector('.' + PLUGIN_ID + '-module-visibility');
        renameBtn = tools.querySelector('.' + PLUGIN_ID + '-module-rename');
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
      if (renameBtn) {
        renameBtn.onclick = async (evt) => {
          evt.preventDefault(); evt.stopPropagation();
          if (!this._editMode) return;
          const titleEl = this._moduleTitleElement(wrapper);
          const builtIn = titleEl?.dataset.defaultModuleTitle || this._moduleRegistry().find((module) => module.id === moduleId)?.label || moduleId;
          const current = this._customModuleLabels[moduleId] || builtIn;
          const input = window.prompt(this._lang() === 'en' ? 'Module title (leave empty to restore default)' : '组件标题（留空恢复默认名称）', current);
          if (input === null) return;
          const value = input.trim().slice(0,40);
          if (!value || value === builtIn) delete this._customModuleLabels[moduleId];
          else this._customModuleLabels[moduleId] = value;
          await this._saveActiveSceneLayout();
          this._applyCustomModuleTitle(wrapper, moduleId);
          wrapper.dataset.moduleLabel = this._moduleLabel(moduleId);
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
      this._applyCustomModuleTitle(wrapper, moduleId);
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
    titleEl.tabIndex = 0;
    titleEl.setAttribute('role', 'button');
    let collapsed = this._collapsed && this._collapsed[key];
    if (collapsed === undefined) collapsed = defaultCollapsed || false;
    const apply = () => {
      contentEl.style.display = collapsed ? 'none' : '';
      arrow.textContent = collapsed ? '▶' : '▼';
      titleEl.setAttribute('aria-expanded', String(!collapsed));
    };
    apply();
    titleEl.dataset.collapseBound = 'true';
    const toggle = (e) => {
      if (e.target.closest('button,input,a,textarea,select')) return;
      collapsed = !collapsed;
      apply();
      this._collapsed[key] = collapsed;
      this._mutatePluginData((data) => { data.collapsed = { ...this._collapsed }; })
        .catch((ex) => console.warn('save collapsed', ex));
    };
    titleEl.addEventListener('click', toggle);
    titleEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle(e);
    });
  }
  async _setLanguage(language) {
    const next = normalizeLang(language);
    if (next === this._language) return;
    const prev = this._language;
    this._language = next;
    try {
      await this._mutatePluginData((data) => { data.language = next; });
      await this._renderDashboard(true);
    } catch (e) {
      this._language = prev;
      console.warn('Cockpit: save language failed', e);
      new obsidian.Notice('Language switch failed: ' + (e?.message || 'unknown error'));
    }
  }
  async _setCalendarViewMode(mode) {
    const next = mode === 'week' ? 'week' : 'month';
    this._calendarViewMode = next;
    try {
      await this._mutatePluginData((data) => { data.calendarViewMode = next; });
    } catch (error) {
      console.warn('Cockpit: save calendar view failed', error);
      new obsidian.Notice(this._lang() === 'en' ? 'Could not save the calendar view preference.' : '日历视图偏好保存失败。');
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
    this._todos = loaded || ensureTodoIds(DEFAULT_TODOS.map(t=>({...t})));
    this._bookmarks = new Set(await this._storage.loadBookmarks());

    // 同步 Hermes 功能待办到 Obsidian
    await syncHermesTodos(this.app.vault, this._todos);

    // 加载用户自定义名称 + 初始化首次使用日期
    try {
      const pluginData = await this._plugin.loadData() || {};
      // 这必须在首次升级的布局兜底之前计算。兜底会在内存中创建
      // sceneLayouts，不能把一个从未编辑过布局的新用户误判为“已有布局”。
      const hadSavedLayout = Array.isArray(pluginData?.moduleOrder)
        || Array.isArray(pluginData?.hiddenModules)
        || !!(pluginData?.sceneLayouts && typeof pluginData.sceneLayouts === 'object' && !Array.isArray(pluginData.sceneLayouts));
      this._language = normalizeLang(pluginData?.language || DEFAULT_LANG);
      await this._rss.initialize();
      if (this._rss.config.enabled) this._rss.refresh().then(() => this._refreshCalendarRef?.()).catch((e) => console.warn('Cockpit RSS refresh failed', e));
      this._pomodoroAutoShow = pluginData?.pomodoroAutoShow !== false;
      this._pomodoroSession = pluginData?.pomodoroSession?.active ? pluginData.pomodoroSession : null;
      this._pomodoroTaskStats = normalizePomodoroTaskStats(pluginData?.pomodoroTaskStats);
      this._pomodoroCompletions = normalizePomodoroCompletions(pluginData?.pomodoroCompletions);
      this._focusChartSettings = { range:pluginData?.focusChartSettings?.range === 'month' ? 'month' : 'week', type:pluginData?.focusChartSettings?.type === 'bar' ? 'bar' : 'line' };
      this._calendarViewMode = pluginData?.calendarViewMode === 'week' ? 'week' : 'month';
      this._username = pluginData?.username || this._t('hero.defaultName');
      this._collapsed = pluginData?.collapsed || {};
      this._moduleOrder = this._normalizeModuleOrder(pluginData?.moduleOrder);
      this._hiddenModules = new Set(this._normalizeModuleSubset(pluginData?.hiddenModules));
      this._deletedToolbarActions = new Set((Array.isArray(pluginData?.deletedToolbarActions) ? pluginData.deletedToolbarActions : []).filter((action) => ['hermes','cockpit-h5','work-log'].includes(action)));
      this._hiddenToolbarActions = new Set(this._normalizeToolbarActionSubset(pluginData?.hiddenToolbarActions));
      this._customToolbarButtons = normalizeCustomToolbarButtons(pluginData?.customToolbarButtons);
      const workspaceState = pluginData?.workspaceState && typeof pluginData.workspaceState === 'object' ? pluginData.workspaceState : {};
      this._recentOpened = Array.isArray(workspaceState.recentOpened) ? workspaceState.recentOpened.filter((item) => item?.path).slice(0, 12) : [];
      this._recentPositions = workspaceState.recentPositions && typeof workspaceState.recentPositions === 'object' ? workspaceState.recentPositions : {};
      this._flashInbox = Array.isArray(workspaceState.flashInbox) ? workspaceState.flashInbox.filter((item) => item?.id && item?.text).slice(-100) : [];
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
        await this._mutatePluginData((data) => {
          data.sceneLayouts = this._sceneLayouts;
          data.activeSceneId = 'default';
        });
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
        await this._mutatePluginData((data) => {
          data.sceneLayouts = this._sceneLayouts;
          data.focusChartIntroduced = true;
        });
        this._applySceneSnapshot(this._getActiveScene());
      }
      // 定时任务是高级能力：只在从旧版本首次引入时隐藏。
      // 一旦用户已保存过任何布局/场景，不迁移其可见性或位置。
      if (!pluginData.scheduledTasksIntroduced) {
        const hasUserLayout = hadSavedLayout;
        if (!hasUserLayout) {
          Object.values(this._sceneLayouts).forEach((scene) => {
            const hidden = new Set(Array.isArray(scene?.layout?.hiddenModules) ? scene.layout.hiddenModules : []);
            hidden.add('scheduledTasks');
            scene.layout = { ...(scene.layout || {}), hiddenModules:Array.from(hidden) };
          });
          pluginData.sceneLayouts = this._sceneLayouts;
        }
        pluginData.scheduledTasksIntroduced = true;
        await this._mutatePluginData((data) => {
          if (!hasUserLayout) data.sceneLayouts = this._sceneLayouts;
          data.scheduledTasksIntroduced = true;
        });
        if (!hasUserLayout) this._applySceneSnapshot(this._getActiveScene());
      }
      this._bookmarkOrder = Array.isArray(pluginData?.bookmarkOrder) ? pluginData.bookmarkOrder.filter((path) => this._bookmarks.has(path)) : [];
      this._bookmarks.forEach((path) => { if (!this._bookmarkOrder.includes(path)) this._bookmarkOrder.push(path); });
      if (!pluginData.startDate) {
        pluginData.startDate = window.moment().format('YYYY-MM-DD');
        await this._mutatePluginData((data) => { if (!data.startDate) data.startDate = pluginData.startDate; });
      }
      this._startDate = pluginData.startDate;
      this._onboardingDone = pluginData?.onboardingDone || false;
    } catch(e) { this._language = DEFAULT_LANG; this._calendarViewMode = 'month'; this._pomodoroAutoShow = true; this._pomodoroSession = null; this._pomodoroTaskStats = {}; this._pomodoroCompletions = []; this._username = this._t('hero.defaultName'); this._startDate = window.moment().format('YYYY-MM-DD'); this._collapsed = {}; this._moduleOrder = this._defaultModuleOrder(); this._hiddenModules = new Set(['focusChart', 'scheduledTasks']); this._deletedToolbarActions = new Set(); this._hiddenToolbarActions = new Set(); this._bookmarkOrder = Array.from(this._bookmarks); this._customToolbarButtons = []; this._toolbarOrder = normalizeToolbarOrder(this, []); this._sceneLayouts = { default:{ id:'default', icon:'◈', layout:this._sceneSnapshot() } }; this._activeSceneId = 'default'; }

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
    await this._recoverPendingPomodoroCompletions();

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
    const initialRect = container.getBoundingClientRect();
    const initialWidth = Math.round(initialRect.width || window.innerWidth);
    const initialClasses = [PLUGIN_ID+'-root', PLUGIN_ID+'-initializing'];
    if (this._isMobile() || initialWidth < 680) initialClasses.push(PLUGIN_ID+'-phone');
    if (initialWidth < 390) initialClasses.push(PLUGIN_ID+'-phone-narrow');
    if (!this._isMobile() && initialWidth >= 680 && initialWidth < 980) initialClasses.push(PLUGIN_ID+'-tablet');
    const root = container.createDiv({ cls:initialClasses.join(' ') });
    if (previousRoot) root.classList.add(PLUGIN_ID + '-scene-preparing');
    root.createEl('style', { text: CSS });
    this._attachRootContextMenu(container);
    await this._buildAll(root);
    this._syncResponsiveViewport();
    requestAnimationFrame(() => root.classList.remove(PLUGIN_ID+'-initializing'));
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
    this._activeLeafHandler = async (leaf) => {
      const previousLeaf = this._trackedWorkspaceLeaf;
      const previousFile = previousLeaf?.view?.file;
      const cursor = previousLeaf?.view?.editor?.getCursor?.();
      if (previousFile?.path && cursor && Number.isInteger(cursor.line)) this._recentPositions[previousFile.path] = { line:cursor.line, ch:cursor.ch || 0, savedAt:Date.now() };
      this._trackedWorkspaceLeaf = leaf;
      const file = leaf?.view?.file;
      if (!file?.path || leaf === this.leaf || file.extension !== 'md') return;
      const entry = { path:file.path, openedAt:Date.now() };
      this._recentOpened = [entry, ...this._recentOpened.filter((item) => item.path !== file.path)].slice(0, 12);
      await this._mutatePluginData((data) => { const state = data.workspaceState && typeof data.workspaceState === 'object' ? data.workspaceState : {}; state.recentOpened = this._recentOpened; state.recentPositions = this._recentPositions; data.workspaceState = state; });
      const root = this.containerEl.children[1]?.querySelector('.'+PLUGIN_ID+'-root');
      if (root) this._refreshRecentSection(root, this._allFiles);
      this._applyAutomaticScene().catch((e) => console.warn('Cockpit folder scene automation failed', e));
    };
    this.registerEvent(this.app.workspace.on('active-leaf-change', this._activeLeafHandler));
    this._startSceneAutoSwitching();
    this._viewportSyncHandler = () => this._syncResponsiveViewport();
    window.addEventListener('resize', this._viewportSyncHandler);
    window.visualViewport?.addEventListener('resize', this._viewportSyncHandler);
    this._viewportResizeObserver?.disconnect();
    if (typeof ResizeObserver === 'function') {
      this._viewportResizeObserver = new ResizeObserver(this._viewportSyncHandler);
      this._viewportResizeObserver.observe(this.containerEl.children[1]);
    }
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
          try { await this._mutatePluginData((data) => { data.username = v; }); } catch(e) { console.warn('Cockpit: save username failed', e); }
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
      let heroSubText = t('hero.today', { date: todayStr });
      const dueText = this._getHeroDueText(now);
      if (dueText) heroSubText += ' · ' + dueText;
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
    const commitTodoMutation = async (mutator, failureMessage) => {
      const outcome = await mutateTodos(this.app.vault, mutator);
      if (!outcome.saved || !outcome.todos) {
        new obsidian.Notice(failureMessage || (lang === 'en' ? 'Could not save tasks. Nothing was changed.' : '待办保存失败，内容未发生变化。'));
        return false;
      }
      this._todos = outcome.todos;
      if (refreshTodosRef) await refreshTodosRef({ persist:false });
      else {
        refreshCalendarRef?.();
        this._refreshHeroReminder?.();
      }
      return true;
    };

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
      dueHasTime: !!todo?.dueHasTime,
      priority: todo?.priority || 'mid',
      ...overrides
    });
    const mergeLegacyTodoInput = (rawTitle, draft) => {
      const parsed = extractTags(rawTitle);
      const hasTagSyntax = /#([^\s#]+)/.test(rawTitle);
      const hasDueSyntax = /due:\s*\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?/.test(rawTitle);
      const hasPrioritySyntax = /p:\s*(high|mid|low)/.test(rawTitle);
      const cleanText = parsed.cleanText || rawTitle.trim();
      const tags = hasTagSyntax
        ? Array.from(new Set(parsed.tags.map((tag) => normalizeTodoTag(tag)).filter(Boolean)))
        : draft.tags.slice();
      const dueDate = hasDueSyntax ? parsed.dueDate : cloneMomentOrNull(draft.dueDate);
      const dueHasTime = hasDueSyntax ? parsed.dueHasTime : !!draft.dueHasTime;
      const priority = hasPrioritySyntax ? parsed.priority : draft.priority;
      return { text: cleanText, tags, dueDate, dueHasTime, priority };
    };
    const openTodoEditor = (options = {}) => {
      const existingTodo = options.id
        ? this._todos.find((todo) => todo.id === options.id)
        : (typeof options.index === 'number' ? this._todos[options.index] : null);
      const existingId = existingTodo?.id || '';
      const isEditing = !!existingTodo;
      const PID = PLUGIN_ID;
      const duePreset = options.dueDate ? options.dueDate.clone().startOf('day') : null;
      const draft = createTodoDraft(existingTodo, duePreset ? { dueDate: duePreset, dueHasTime:false } : {});
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
      makeCockpitDialogDraggable(sheet, header, { label: this._lang() === 'en' ? 'Drag task editor' : '拖动待办编辑窗口' });

      const body = sheet.createDiv({ cls: PID + '-todo-editor-body' });

      const fieldTask = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldTask.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorTask') });
      const titleInput = fieldTask.createEl('textarea', { cls: PID + '-todo-editor-textarea', attr: { rows: '3', placeholder: t('todo.editorTaskPlaceholder') } });
      titleInput.value = draft.text;

      const fieldDue = body.createDiv({ cls: PID + '-todo-editor-field' });
      fieldDue.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorDue') });
      const dueQuick = fieldDue.createDiv({ cls: PID + '-todo-editor-quick' });
      const dateInput = fieldDue.createEl('input', { cls: PID + '-todo-editor-date', attr: { type: 'datetime-local' } });
      const dueButtons = [
        { key: 'none', label: t('todo.noDue'), apply: () => { draft.dueDate = null; draft.dueHasTime = false; } },
        { key: 'today', label: t('todo.dueTodayBtn'), apply: () => { draft.dueDate = window.moment().startOf('day'); draft.dueHasTime = false; } },
        { key: 'tomorrow', label: t('todo.dueTomorrowBtn'), apply: () => { draft.dueDate = window.moment().add(1, 'day').startOf('day'); draft.dueHasTime = false; } }
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
        dateInput.value = draft.dueDate ? draft.dueDate.format('YYYY-MM-DDTHH:mm') : '';
        renderDueButtons();
      };
      dateInput.addEventListener('change', () => {
        draft.dueDate = dateInput.value ? parseDate(dateInput.value) : null;
        draft.dueHasTime = !!dateInput.value;
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
        const nextTodo = {
          text: merged.text,
          tags: merged.tags,
          dueDate: merged.dueDate,
          dueHasTime: merged.dueHasTime,
          priority: merged.priority,
          done: existingTodo ? !!existingTodo.done : false,
          created: existingTodo?.created || window.moment(),
          doneDate: existingTodo?.doneDate || null
        };
        const saved = await commitTodoMutation((todos) => {
          if (isEditing) {
            const target = todos.find((todo) => todo.id === existingId);
            if (!target) return false;
            Object.assign(target, nextTodo);
          } else {
            todos.unshift(nextTodo);
          }
          return true;
        }, isEditing
          ? (lang === 'en' ? 'This task changed elsewhere. Reopen it and try again.' : '这个待办已在其他窗口发生变化，请重新打开后再试。')
          : undefined);
        if (saved) this._closeTodoEditor();
        else saveLocked = false;
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
    const refreshCalendar = buildCalendar(root, () => this._todos, {
      language: lang,
      t,
      openTodoEditor,
      onTodoToggle: async (todoId, done) => commitTodoMutation((todos) => {
        const target = todos.find((todo) => todo.id === todoId);
        if (!target) return false;
        target.done = done;
        target.doneDate = done ? window.moment() : null;
        return true;
      }),
      onTodoSchedule: async (todoId, dueDate) => commitTodoMutation((todos) => {
        const target = todos.find((todo) => todo.id === todoId);
        if (!target || target.done) return false;
        target.dueDate = dueDate.clone(); target.dueHasTime = false;
        return true;
      }, lang === 'en' ? 'Could not schedule this task.' : '待办排期失败。'),
      rss:this._rss,
      openRss:(date) => new CockpitRssModal(this.app, this, date).open(),
      initialViewMode:this._calendarViewMode,
      onViewModeChange:(mode) => this._setCalendarViewMode(mode)
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
      { label:t('stats.noteCount'), max:50, color:'#818cf8', type:'static', field:'noteCount' },
      { label:t('stats.todoCount'), max:20, color:'#c084fc', type:'dynamic', field:'todoCount' },
      { label:t('stats.doneCount'), max:1,  color:'#22c55e', type:'dynamic', field:'doneCount' },
      { label:t('stats.doneRate'),  max:100,color:'#34d399', type:'dynamic', field:'donePct', suffix:'%' },
      { label:t('stats.focusToday'),max:480,color:'#f97316', type:'dynamic', field:'focusMin', suffix:' min' },
      { label:lang==='en'?'Focus gap':'连续未专注',max:7,color:'#ef4444',type:'dynamic',field:'focusGap',suffix:lang==='en'?' d':' 天' },
      { label:lang==='en'?'Largest backlog':'最大标签积压',max:20,color:'#38bdf8',type:'dynamic',field:'tagBacklog' }
    ];
    const statById = new Map(statConfig.map((cfg) => [cfg.field, cfg]));
    const statValEls = new Map(), statFillEls = new Map();
    this._normalizeStatsCardOrder(this._statsCardOrder).map((id) => statById.get(id)).filter(Boolean).forEach((cfg)=>{
      const actionable = ['todoCount', 'doneCount', 'donePct', 'focusGap', 'tagBacklog'].includes(cfg.field);
      const card = statsEl.createDiv({ cls: PLUGIN_ID+'-stat' + (actionable ? ' actionable' : ''), attr:actionable ? { role:'button', tabindex:'0', title:lang === 'en' ? 'Open the related task list' : '查看关联待办列表', 'aria-label':lang === 'en' ? 'Open the related task list' : '查看关联待办列表' } : {} });
      card.dataset.statId = cfg.field;
      card.style.setProperty('--stat-clr', cfg.color);
      const editTools = card.createDiv({ cls:PLUGIN_ID+'-stat-edit-tools' });
      const hideBtn = editTools.createEl('button', { cls:PLUGIN_ID+'-stat-hide', text:'−', attr:{ type:'button' } });
      const dragHandle = editTools.createEl('button', { cls:PLUGIN_ID+'-stat-drag', text:'⠿', attr:{ type:'button', draggable:'true', title:lang === 'en' ? 'Drag to reorder' : '拖动排序', 'aria-label':lang === 'en' ? 'Drag to reorder' : '拖动排序', tabindex:'-1' } });
      card.createDiv({ cls: PLUGIN_ID+'-stat-label', text: cfg.label });
      const valEl = card.createDiv({ cls: PLUGIN_ID+'-stat-val' });
      statValEls.set(cfg.field, valEl);
      if (cfg.max > 0) {
        const bar = card.createDiv({ cls: PLUGIN_ID+'-stat-bar' });
        const fill = bar.createDiv({ cls: PLUGIN_ID+'-stat-fill', attr:{style:'width:0%'} });
        statFillEls.set(cfg.field, fill);
      } else {
        statFillEls.set(cfg.field, null);
      }
      hideBtn.onclick = async (event) => {
        event.preventDefault(); event.stopPropagation();
        if (!this._editMode) return;
        if (this._hiddenStatsCards.has(cfg.field)) this._hiddenStatsCards.delete(cfg.field);
        else this._hiddenStatsCards.add(cfg.field);
        await this._saveStatsCardLayout();
        this._applyModuleEditState(root);
      };
      card.ondragstart = (event) => {
        if (!this._editMode) { event.preventDefault(); return; }
        this._dragStatId = cfg.field;
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-cockpit-stat', cfg.field);
      };
      card.ondragend = () => {
        this._dragStatId = null;
        card.classList.remove('dragging');
        statsEl.querySelectorAll('.stat-drop-before,.stat-drop-after').forEach((el) => el.classList.remove('stat-drop-before','stat-drop-after'));
      };
      card.ondragover = (event) => {
        const dragged = this._dragStatId || event.dataTransfer.getData('application/x-cockpit-stat');
        if (!this._editMode || !dragged || dragged === cfg.field) return;
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2 || (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && event.clientX < rect.left + rect.width / 2);
        card.classList.toggle('stat-drop-before', before);
        card.classList.toggle('stat-drop-after', !before);
      };
      card.ondragleave = () => card.classList.remove('stat-drop-before','stat-drop-after');
      card.ondrop = async (event) => {
        const draggedId = this._dragStatId || event.dataTransfer.getData('application/x-cockpit-stat');
        if (!this._editMode || !draggedId || draggedId === cfg.field) return;
        event.preventDefault(); event.stopPropagation();
        const dragged = statsEl.querySelector('[data-stat-id="' + draggedId + '"]');
        if (!dragged) return;
        const rect = card.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2 || (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && event.clientX < rect.left + rect.width / 2);
        statsEl.insertBefore(dragged, before ? card : card.nextSibling);
        statsEl.querySelectorAll('.stat-drop-before,.stat-drop-after').forEach((el) => el.classList.remove('stat-drop-before','stat-drop-after'));
        this._statsCardOrder = Array.from(statsEl.querySelectorAll('[data-stat-id]')).map((el) => el.dataset.statId);
        await this._saveStatsCardLayout();
      };
      const openRelated = async () => {
        if (!actionable || this._editMode) return;
        currentStatus = cfg.field === 'doneCount' || cfg.field === 'donePct' ? 'done' : 'todo';
        if (cfg.field === 'tagBacklog') {
          const counts = new Map(); this._todos.filter((todo)=>!todo.done).forEach((todo)=>(todo.tags||[]).forEach((tag)=>counts.set(tag,(counts.get(tag)||0)+1)));
          const top = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1])[0]; currentTag = top ? 'tag:'+top[0] : 'all';
        } else currentTag = 'all';
        if (cfg.field === 'focusGap') currentStatus = 'today';
        statusSelect.value = currentStatus;
        todoRenderLimit = 120;
        await renderTodos({ persist:false });
        todoHeader.scrollIntoView({ behavior:'smooth', block:'start' });
      };
      if (actionable) {
        card.onclick = (event) => { if (!event.target.closest('.' + PLUGIN_ID + '-stat-edit-tools')) openRelated(); };
        card.onkeydown = (event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.' + PLUGIN_ID + '-stat-edit-tools')) { event.preventDefault(); openRelated(); } };
      }
    });
    const updateStats = ()=>{
      const doneCount = this._todos.filter(t=>t.done).length;
      const todoCount = this._todos.length;
      const donePct = todoCount > 0 ? Math.round(doneCount/todoCount*100) : 0;
      const focusMin = this._focusMinutes || 0;
      let focusGap = 0; for (let offset=0; offset<30; offset++) { const key=window.moment().subtract(offset,'day').format('YYYY-MM-DD'); if ((this._focusHistory.get(key)||0)>0) break; focusGap++; }
      const tagCounts = new Map(); this._todos.filter((todo)=>!todo.done).forEach((todo)=>(todo.tags||[]).forEach((tag)=>tagCounts.set(tag,(tagCounts.get(tag)||0)+1))); const tagBacklog = Math.max(0,...tagCounts.values());
      const values = { noteCount, todoCount, doneCount, donePct, focusMin, focusGap, tagBacklog };
      Object.entries(values).forEach(([field,val])=>{
        const config = statById.get(field);
        if (statValEls.get(field)) statValEls.get(field).textContent = '' + val + (config?.suffix||'');
        const fill = statFillEls.get(field);
        if (fill) {
          const max = config.max;
          const pct = Math.min(100, max > 0 ? Math.round(val/max*100) : 0);
          fill.style.width = pct + '%';
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
    const todayBar = todoWrap.createDiv({ cls: PLUGIN_ID+'-today-bar' });
    const todosEl = todoWrap.createDiv({ cls: PLUGIN_ID+'-todos' });

    // 状态筛选：用单一下拉框收纳选项，避免待办标题栏在窄窗口中拥挤。
    let currentStatus = 'today';
    const statusOptions = [
      { key:'today', label:t('todo.today') },
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
      todoRenderLimit = 120;
      await renderTodos({ persist:false });
    };

    const getStatusFilteredTodos = (preparedTodayGroups)=>{
      let filtered = this._todos;
      if (currentStatus === 'today') {
        filtered = (preparedTodayGroups || []).flatMap((group) => group.items);
      }
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
    let todoRenderLimit = 120;
    const getVisibleTags = (statusFiltered)=>{
      const tagSet = new Set();
      statusFiltered.forEach(t => { if (t.tags) t.tags.forEach(tag => tagSet.add(tag)); });
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
          todoRenderLimit = 120;
          await renderTodos({ persist:false });
        };
      });
    };

    // 渲染待办列表（从内存数据渲染）
    let renderTodos = async (options = {})=>{
      todosEl.empty();
      updateStats();

      const todayKey = window.moment().format('YYYY-MM-DD');
      const baseTodayGroups = currentStatus === 'today' ? groupTodayTodos(this._todos, todayKey) : null;
      const statusFiltered = getStatusFilteredTodos(baseTodayGroups);

      // 如果没有页签容器，创建它（插在 todoHeader 之后）
      let tabsWrap = root.querySelector('.'+PLUGIN_ID+'-todo-tabs-wrap');
      if (!tabsWrap) {
        tabsWrap = document.createElement('div');
        tabsWrap.className = PLUGIN_ID+'-todo-tabs-wrap';
        todoWrap.prepend(tabsWrap);
      }
      const allTags = getVisibleTags(statusFiltered);
      if (currentTag !== 'all' && !allTags.includes(currentTag.replace('tag:',''))) currentTag = 'all';
      renderTabs(allTags, tabsWrap);

      const visibleStatusTodos = currentTag === 'all'
        ? statusFiltered
        : statusFiltered.filter(t => t.tags && t.tags.includes(currentTag.replace('tag:','')));
      const activeTag = currentTag === 'all' ? '' : currentTag.replace('tag:', '');
      const todayGroups = currentStatus === 'today'
        ? baseTodayGroups.map((group) => ({
          ...group,
          items:activeTag ? group.items.filter((todo) => todo.tags?.includes(activeTag)) : group.items
        })).filter((group) => group.items.length)
        : [];
      todayBar.empty();
      todayBar.style.display = currentStatus === 'today' ? 'flex' : 'none';
      if (currentStatus === 'today') {
        const todayCount = todayGroups.reduce((sum, group) => sum + group.items.length, 0);
        const summary = todayBar.createDiv({ cls:PLUGIN_ID+'-today-summary' });
        summary.createSpan({ cls:PLUGIN_ID+'-today-summary-label', text:t('todo.todaySummary', { count:todayCount }) });
        const groupLabels = {
          overdue:t('todo.groupOverdue'), today:t('todo.groupToday'),
          priority:t('todo.groupPriority'), inbox:t('todo.groupInbox')
        };
        todayGroups.forEach((group) => summary.createSpan({ cls:PLUGIN_ID+'-today-count '+group.key, text:groupLabels[group.key]+' '+group.items.length }));
        const overdue = todayGroups.find((group) => group.key === 'overdue');
        if (overdue?.items.length) {
          const deferOverdue = todayBar.createEl('button', { cls:PLUGIN_ID+'-today-defer', text:t('todo.deferOverdue'), attr:{type:'button'} });
          deferOverdue.onclick = async () => {
            const tomorrow = window.moment().add(1, 'day').startOf('day');
            const ids = new Set(overdue.items.map((todo) => todo.id));
            await commitTodoMutation((todos) => {
              todos.forEach((todo) => {
                if (ids.has(todo.id) && !todo.done) todo.dueDate = tomorrow.clone();
              });
              return true;
            }, lang === 'en' ? 'Could not defer overdue tasks. Nothing was changed.' : '延期失败，所有待办已保持原状。');
          };
        }
      }

      // 根据当前选中页签过滤
      const tagFiltered = visibleStatusTodos.slice();

      // 排序：优先级 high>mid+low，同优先级内按创建时间倒序，已过期的置顶
      const prioOrder = { high:0, mid:1, low:2 };
      const now = window.moment();
      if (currentStatus !== 'today') tagFiltered.sort((a,b)=>{
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

      const todoEntries = [];
      let totalVisibleTodos = tagFiltered.length;
      let renderedTodos = 0;
      if (currentStatus === 'today') {
        const limited = limitTodoGroups(todayGroups, todoRenderLimit);
        totalVisibleTodos = limited.total;
        renderedTodos = limited.rendered;
        limited.groups.forEach((group) => {
          todoEntries.push({ group });
          group.items.forEach((todo) => todoEntries.push({ todo }));
        });
      } else {
        const visible = tagFiltered.slice(0, todoRenderLimit);
        renderedTodos = visible.length;
        visible.forEach((todo) => todoEntries.push({ todo }));
      }
      if (!todoEntries.length) todosEl.createDiv({ cls:PLUGIN_ID+'-todo-empty', text:currentStatus === 'today' ? t('todo.todayEmpty') : t('todo.filterEmpty') });

      const groupLabels = {
        overdue:t('todo.groupOverdue'), today:t('todo.groupToday'),
        priority:t('todo.groupPriority'), inbox:t('todo.groupInbox')
      };
      todoEntries.forEach((entry)=>{
        if (entry.group) {
          const heading = todosEl.createEl('h3', { cls:PLUGIN_ID+'-today-group '+entry.group.key });
          heading.createSpan({ text:groupLabels[entry.group.key] });
          heading.createSpan({ cls:PLUGIN_ID+'-today-group-count', text:String(entry.group.items.length) });
          const groupActions = heading.createSpan({ cls:PLUGIN_ID+'-today-group-actions' });
          const completeGroup = groupActions.createEl('button', { text:lang === 'en' ? 'Complete all' : '全部完成', attr:{ type:'button', title:lang === 'en' ? 'Complete every task in this group' : '完成本组全部待办' } });
          completeGroup.onclick = async () => {
            const ids = new Set(entry.group.items.map((todo) => todo.id));
            await commitTodoMutation((todos) => { const completedAt = window.moment(); todos.forEach((todo) => { if (ids.has(todo.id) && !todo.done) { todo.done = true; todo.doneDate = completedAt.clone(); } }); return true; });
          };
          const deferGroup = groupActions.createEl('button', { text:lang === 'en' ? 'Tomorrow' : '延期明天', attr:{ type:'button', title:lang === 'en' ? 'Move every task in this group to tomorrow' : '将本组全部待办延期到明天' } });
          deferGroup.onclick = async () => {
            const ids = new Set(entry.group.items.map((todo) => todo.id)); const tomorrow = window.moment().add(1, 'day').startOf('day');
            await commitTodoMutation((todos) => { todos.forEach((todo) => { if (ids.has(todo.id) && !todo.done) { todo.dueDate = tomorrow.clone(); todo.dueHasTime = false; } }); return true; });
          };
          return;
        }
        const todo = entry.todo;
        const done = todo.done;
        const item = todosEl.createDiv({ cls: PLUGIN_ID+'-todo'+(done?' done':''), attr:{ draggable:done ? 'false' : 'true', title:done ? '' : (lang === 'en' ? 'Drag onto a calendar date to schedule' : '拖到日历日期上进行排期') } });
        item.addEventListener('dragstart', (event) => { if (done) { event.preventDefault(); return; } event.dataTransfer.setData('application/x-cockpit-todo', todo.id); event.dataTransfer.effectAllowed = 'move'; item.classList.add('is-dragging'); });
        item.addEventListener('dragend', () => item.classList.remove('is-dragging'));

        // 优先级圆点
        const pdot = item.createDiv({
          cls: PLUGIN_ID+'-todo-pdot p-'+(todo.priority||'mid'),
          attr:{title:(todo.priority||'mid')==='high'?this._t('todo.priorityHigh'):(todo.priority||'mid')==='mid'?this._t('todo.priorityMid'):this._t('todo.priorityLow')}
        });

        // 复选框 - 切换完成状态，连带更新日期
        const chk = item.createEl('button', { cls: PLUGIN_ID+'-todo-chk', text:done?'✓':'', attr:{ type:'button', 'aria-label':done ? (lang === 'en' ? 'Mark task open' : '恢复为待办') : (lang === 'en' ? 'Complete task' : '完成待办'), 'aria-pressed':String(done) } });
        chk.onclick = async (e)=>{
          e.stopPropagation();
          await commitTodoMutation((todos) => {
            const target = todos.find((entry) => entry.id === todo.id);
            if (!target) return false;
            target.done = !target.done;
            target.doneDate = target.done ? window.moment() : null;
            return true;
          });
        };

        // 主内容区
        const main = item.createDiv({ cls: PLUGIN_ID+'-todo-main' });
        const txt = main.createDiv({ cls: PLUGIN_ID+'-todo-text', text:todo.text });
        txt.onclick = async (e)=>{
          e.stopPropagation();
          openTodoEditor({ id:todo.id });
        };

        // 时间元信息 + 截止日期 + 标签胶囊
        const meta = main.createDiv({ cls: PLUGIN_ID+'-todo-meta' });
        if (todo.created) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.cal+' '+fmtDate(todo.created, lang)});
        if (done && todo.doneDate) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.check+' '+fmtDate(todo.doneDate, lang)});
        const focusStat = getTodoFocusStat(this._pomodoroTaskStats, todo);
        if (focusStat) meta.createSpan({ cls:PLUGIN_ID+'-todo-focus-stat', text:'🍅 '+focusStat.sessions+' · '+focusStat.totalMinutes+' min' });
        // 截止日期显示
        if (todo.dueDate && !done) {
          const nowM = window.moment();
          let dueCls = 'due-future', dueLabel = formatTodoDue(todo.dueDate, lang, todo.dueHasTime);
          if (todo.dueDate.isBefore(nowM, 'day')) { dueCls = 'due-overdue'; dueLabel = t('todo.overdue', { date: formatTodoDue(todo.dueDate, lang, todo.dueHasTime) }); }
          else if (todo.dueDate.isSame(nowM, 'day')) { dueCls = 'due-today'; dueLabel = t('todo.dueToday') + (todo.dueHasTime ? ' · ' + todo.dueDate.format('HH:mm') : ''); }
          meta.createSpan({ cls: PLUGIN_ID+'-todo-due '+dueCls, text: dueLabel });
        }
        // 标签显示
        if (todo.tags && todo.tags.length > 0) {
          todo.tags.forEach(tag => {
            const pill = meta.createSpan({ cls: PLUGIN_ID+'-todo-tag-pill', text:'#'+tag });
            pill.onclick = async (e) => {
              e.stopPropagation();
              currentTag = 'tag:'+tag;
              await renderTodos({ persist:false });
            };
          });
        }

        // 状态标签
        item.createDiv({ cls: PLUGIN_ID+'-todo-tag '+(done?'tag-done':'tag-todo'), text:done?t('todo.stateDone'):t('todo.stateDoing') });

        // 优先级选择器（hover 时显示）
        const prioWrap = item.createDiv({ cls: PLUGIN_ID+'-prio-picker' });
        ['high','mid','low'].forEach(p => {
          const dot = prioWrap.createEl('button', { cls: PLUGIN_ID+'-prio-opt p-' + p + ((todo.priority||'mid')===p?' sel':''), attr:{ type:'button', 'aria-label':p==='high'?t('todo.priorityHigh'):p==='mid'?t('todo.priorityMid'):t('todo.priorityLow'), 'aria-pressed':String((todo.priority||'mid')===p) } });
          dot.title = p==='high'?t('todo.priorityHigh'):p==='mid'?t('todo.priorityMid'):t('todo.priorityLow');
          dot.onclick = async (e)=>{
            e.stopPropagation();
            if ((todo.priority||'mid') === p) return;
            await commitTodoMutation((todos) => {
              const target = todos.find((entry) => entry.id === todo.id);
              if (!target) return false;
              target.priority = p;
              return true;
            });
          };
        });

        // 操作按钮
        const actions = item.createDiv({ cls: PLUGIN_ID+'-todo-actions' });

        // 延期、编辑与删除使用 Obsidian 同一套 Lucide 图标，避免 emoji 风格割裂。
        if (!done && pomodoroTaskRef(todo)) {
          const focusBtn = actions.createEl('button', { cls:PLUGIN_ID+'-todo-btn focus', attr:{type:'button', 'aria-label':lang === 'en' ? 'Start a Pomodoro linked to this task' : '专注此任务：启动并关联番茄钟'} });
          obsidian.setIcon(focusBtn, 'timer');
          focusBtn.onclick = (e) => {
            e.stopPropagation();
            buildPomodoro(this, root, todo);
          };
        }
        if (!done) {
          const deferBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', 'aria-label':lang === 'en' ? 'Move this task to tomorrow' : '延期到明天：保留任务并调整截止日期'} });
          obsidian.setIcon(deferBtn, 'calendar-clock');
          deferBtn.onclick = async (e) => {
            e.stopPropagation();
            await commitTodoMutation((todos) => {
              const target = todos.find((entry) => entry.id === todo.id);
              if (!target) return false;
              target.dueDate = window.moment().add(1, 'day').startOf('day');
              return true;
            });
          };
        }
        const editBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', 'aria-label':lang === 'en' ? 'Edit title, date, priority, and tags' : '编辑：修改标题、日期、优先级和标签'} });
        obsidian.setIcon(editBtn, 'square-pen');
        editBtn.onclick = (e)=>{
          e.stopPropagation();
          openTodoEditor({ id:todo.id });
        };

        // 删除按钮
        const delBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn del', attr:{type:'button', 'aria-label':lang === 'en' ? 'Delete this task permanently' : '删除：永久移除此待办'} });
        obsidian.setIcon(delBtn, 'trash-2');
        delBtn.onclick = async (e)=>{
          e.stopPropagation();
          await commitTodoMutation((todos) => {
            const index = todos.findIndex((entry) => entry.id === todo.id);
            if (index < 0) return false;
            todos.splice(index, 1);
            return true;
          });
        };
      });
      if (renderedTodos < totalVisibleTodos) {
        const more = todosEl.createEl('button', {
          cls:PLUGIN_ID+'-todo-load-more',
          text:lang === 'en' ? `Show more (${totalVisibleTodos - renderedTodos} remaining)` : `显示更多（还剩 ${totalVisibleTodos - renderedTodos} 项）`,
          attr:{ type:'button' }
        });
        obsidian.setIcon(more.createSpan({ cls:PLUGIN_ID+'-todo-load-more-icon' }), 'chevrons-down');
        more.onclick = async () => {
          todoRenderLimit += 120;
          await renderTodos({ persist:false });
        };
      }
      return true;
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
      // loadTodos 已在同一队列内完成旧格式 ID 的一次性回写，无需再重复写文件。
      await renderTodos({ persist:false });
    };

    await renderTodos({ persist:false });
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

    // ===== 5.6 定时任务（独立插件级调度器，配置不写 Markdown） =====
    try {
      this._refreshScheduledTasksRef = buildScheduledTasksModule(this, root);
    } catch (e) {
      this._refreshScheduledTasksRef = null;
      console.warn('Cockpit scheduled tasks failed; dashboard layout remains available', e);
    }

    // ===== 6. Continue working: recent opened and recent modified =====
    const recentTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.recent') });
    recentTitle.dataset.section = 'recent-title';
    const recentMode = root.createDiv({ cls:PLUGIN_ID+'-recent-tabs' });
    this._recentEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
    this._allFiles = allFiles;
    const renderRecentMode = (mode) => {
      recentMode.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
      this._recentEl.dataset.mode = mode;
      this._refreshRecentSection(root, this._allFiles);
    };
    [['opened',lang==='en'?'Recently opened':'最近打开'],['modified',lang==='en'?'Recently modified':'最近修改']].forEach(([mode,label])=>{const button=recentMode.createEl('button',{text:label,attr:{type:'button','data-mode':mode}});button.dataset.mode=mode;button.onclick=()=>renderRecentMode(mode);});
    this._recentEl.dataset.mode = 'opened';
    this._recentOpened.map((entry)=>allFiles.find((file)=>file.path===entry.path)).filter(Boolean).slice(0,5).forEach(file=>{
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
    if (!this._recentEl.children.length) this._refreshRecentSection(root, allFiles);
    renderRecentMode('opened');
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
    const flashActions = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-actions', attr:{style:'display:none', 'aria-live':'polite'} });
    let lastFlash = '';
    const hideFlashActions = () => { flashActions.style.display = 'none'; flashActions.empty(); };
    const showFlashActions = (text, filePath) => {
      hideFlashActions();
      const en = this._lang() === 'en';
      const makeAction = (label, title, action) => {
        const button = flashActions.createEl('button', { text:label, attr:{ type:'button', title, 'aria-label':title } });
        button.onclick = action;
      };
      makeAction(en ? 'Make todo' : '转为待办', en ? 'Create a todo from this thought' : '将刚才的闪念创建为待办', () => openTodoEditor({ text }));
      makeAction(en ? 'Add tag' : '添加标签', en ? 'Add a tag to this thought in today\'s note' : '给今日日记里的这条闪念添加标签', async () => {
        const tag = window.prompt(en ? 'Tag name' : '标签名称'); if (!tag) return;
        const file = this.app.vault.getAbstractFileByPath(filePath); if (!file) return;
        const content = await this.app.vault.read(file); const marker = '- ['; const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await this.app.vault.modify(file, content.replace(new RegExp('(^- \\[[^\\]]+\\] ' + escaped + ')(?!.*#' + tag + ')', 'm'), '$1 #' + tag.replace(/^#/, '')));
        new obsidian.Notice(en ? 'Tag added.' : '标签已添加。');
      });
      makeAction(en ? 'Open today' : '打开今日日记', en ? 'Open today\'s daily note' : '打开保存这条闪念的今日日记', () => this.app.workspace.getUnpinnedLeaf().setViewState({ type:'markdown', state:{ file:filePath } }));
      makeAction(en ? 'Organize later' : '稍后整理', en ? 'Keep this thought in the dashboard inbox' : '把这条闪念保留在驾驶舱整理箱', async () => { const entry={id:'flash-'+Date.now().toString(36),text,filePath,createdAt:new Date().toISOString()};this._flashInbox=[...this._flashInbox,entry].slice(-100);await this._mutatePluginData((data)=>{const state=data.workspaceState&&typeof data.workspaceState==='object'?data.workspaceState:{};state.flashInbox=this._flashInbox;data.workspaceState=state;});flashTitle.dataset.pending=String(this._flashInbox.length);flashTitle.setText(t('sections.flash')+' · '+this._flashInbox.length);new obsidian.Notice(en?'Added to the organize-later inbox.':'已加入稍后整理。'); });
      makeAction(en ? 'Keep writing' : '继续记录', en ? 'Focus the quick-capture input' : '回到输入框继续记录', () => { hideFlashActions(); flashInput.focus(); });
      flashActions.style.display = 'flex';
    };
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
        lastFlash = v;
        flashInput.value = '';
        flashMsg.style.display = 'block';
        setTimeout(()=>{ flashMsg.style.display = 'none'; }, 2000);
        showFlashActions(lastFlash, filePath);
      } catch(e) { console.warn('flash save',e); }
    };
    flashInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();saveFlash();} });
    flashOk.onclick = saveFlash;
    if (this._flashInbox.length) { flashTitle.setText(t('sections.flash')+' · '+this._flashInbox.length); flashTitle.dataset.pending=String(this._flashInbox.length); const inbox=flashContent.createDiv({cls:PLUGIN_ID+'-flash-inbox'}); inbox.createSpan({text:(lang==='en'?'To organize: ':'待整理：')+this._flashInbox.length}); const clear=inbox.createEl('button',{text:lang==='en'?'Mark organized':'标记已整理',attr:{type:'button'}});clear.onclick=async()=>{this._flashInbox=[];await this._mutatePluginData((data)=>{const state=data.workspaceState&&typeof data.workspaceState==='object'?data.workspaceState:{};state.flashInbox=[];data.workspaceState=state;});inbox.remove();flashTitle.setText(t('sections.flash'));}; }
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
      cell.tabIndex = 0; cell.setAttribute('role','button');
      const openDay = async () => { const candidates=allFiles.filter((file)=>window.moment(file.stat.mtime).format('YYYY-MM-DD')===key).sort((a,b)=>b.stat.mtime-a.stat.mtime);if(candidates[0])await this.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:candidates[0].path}});else new obsidian.Notice(lang==='en'?'No edited notes on this date.':'这一天没有编辑过的笔记。'); };
      cell.onclick=openDay;cell.onkeydown=(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openDay();}};
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
    await this._mutatePluginData((data) => { data.bookmarkOrder = this._bookmarkOrder; });
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
    const mode = recentEl.dataset.mode || 'opened';
    const openedAt = new Map(this._recentOpened.map((entry) => [entry.path, entry.openedAt]));
    const files = mode === 'opened'
      ? this._recentOpened.map((entry) => allFiles.find((file) => file.path === entry.path)).filter(Boolean).slice(0, 5)
      : this._allFiles.filter((file) => file.basename !== 'Home').sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, 5);
    files
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
        link.onclick = async (e) => {
          e.preventDefault();
          const leaf=this.app.workspace.getUnpinnedLeaf();await leaf.setViewState({ type: 'markdown', state: { file: file.path } });
          const position=this._recentPositions[file.path];if(position?.line>=0)setTimeout(()=>{leaf.view?.editor?.setCursor?.({line:position.line,ch:position.ch||0});leaf.view?.editor?.scrollIntoView?.({from:{line:position.line,ch:0},to:{line:position.line,ch:0}},true);},40);
        };
        const timestamp = mode === 'opened' ? openedAt.get(file.path) : file.stat.mtime;
        const position = this._recentPositions[file.path];
        item.createDiv({ cls: PLUGIN_ID + '-recent-time', text:(mode === 'opened' ? (this._lang()==='en'?'Opened ':'打开于 ') : (this._lang()==='en'?'Modified ':'修改于 ')) + window.moment(timestamp).fromNow() + (position?.line>=0 ? (this._lang()==='en'?' · line ':' · 第 ')+(position.line+1)+(this._lang()==='en'?'':' 行') : '') });
      });
    if (!files.length) recentEl.createDiv({ cls:PLUGIN_ID+'-todo-empty', text:this._lang()==='en'?'Open a note to start your workspace history.':'打开一篇笔记后，这里会形成继续工作记录。' });
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
      return executeCustomToolbarButton(this, this._customToolbarButtons.find((button) => button.id === id));
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
    if (this._sceneAutoTimer) { clearInterval(this._sceneAutoTimer); this._sceneAutoTimer = null; }
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
    this._mutatePluginData((data) => { data.onboardingDone = true; })
      .catch((e) => console.warn('save onboard', e));
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
    const welcomeHandle = card.createDiv({ cls: PID + '-welcome-drag-area' });
    welcomeHandle.createDiv({ cls: PID + '-welcome-badge', text: t('welcome.badge') });
    welcomeHandle.createDiv({ cls: PID + '-welcome-title', text: t('welcome.title') });
    makeCockpitDialogDraggable(card, welcomeHandle, { label: this._lang() === 'en' ? 'Drag welcome window' : '拖动欢迎窗口' });
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

    let cur = 0, hlEl = null, card = null, tourDragCleanup = null;

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
      tourDragCleanup?.();
      tourDragCleanup = makeCockpitDialogDraggable(card, top, { label: this._lang() === 'en' ? 'Drag onboarding guide' : '拖动新手引导窗口' });
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
      tourDragCleanup?.();
      tourDragCleanup = null;
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
    this._dragCleanup = makeCockpitModalDraggable(this, titleEl, this._language === 'en' ? 'Drag release notes' : '拖动最近更新窗口');
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
    this._dragCleanup?.();
    this._dragCleanup = null;
    this._scheduledTasksUnsubscribe?.();
    this._scheduledTasksUnsubscribe = null;
    this._viewportResizeObserver?.disconnect();
    this._viewportResizeObserver = null;
    this.contentEl.empty();
  }
}

class CockpitPlugin extends obsidian.Plugin {
  async mutateData(mutator) {
    return mutatePluginData(this, mutator);
  }
  async onload() {
    this.scheduledTasks = new ScheduledTaskService(this);
    this.scheduledTasks.start();
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
  async onunload() { this.scheduledTasks?.stop(); this.app.workspace.detachLeavesOfType(VIEW_TYPE); }
}
module.exports = CockpitPlugin;
