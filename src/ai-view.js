// ai-view.js — Chat-first AI 侧栏：多会话、底部组合输入、上下文选择与分段式 Agent 活动轨道。

class CockpitAIView extends obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this._language = DEFAULT_LANG;
    this._busy = false;
    this._messagesEl = null;
    this._selectedContextPaths = [];
    this._uploadedContexts = [];
    this._contextEntries = [];
    this._historyState = { version:1, activeSessionId:'', sessions:[] };
    this._activeSessionId = '';
    this._abortController = null;
    this._aiConfigUnsubscribe = null;
    this._toolConfirmModal = null;
  }
  getViewType() { return AI_VIEW_TYPE; }
  getDisplayText() { return this._language === 'en' ? 'Cockpit AI' : 'Cockpit AI 助手'; }
  getIcon() { return 'bot-message-square'; }
  _activeSession() { return this._historyState.sessions.find((session) => session.id === this._activeSessionId) || null; }
  async onOpen() {
    const data = await this.plugin.loadData() || {};
    this._language = normalizeLang(data.language || DEFAULT_LANG);
    const config = await this.plugin.ai.getConfig();
    this._historyState = await this.plugin.aiHistory.load();
    let session = this._historyState.sessions.find((item) => item.id === this._historyState.activeSessionId);
    if (!session) {
      session = await this.plugin.aiHistory.create({ language:this._language, profileId:config.activeProfileId, contextPaths:[] });
      this._historyState = await this.plugin.aiHistory.load();
    }
    this._activeSessionId = session.id;
    this._selectedContextPaths = [...session.contextPaths];
    if (session.profileId && config.profiles.some((profile) => profile.id === session.profileId) && session.profileId !== config.activeProfileId) {
      await this.plugin.ai.setActiveProfile(session.profileId);
    }
    await this._render();
    this._aiConfigUnsubscribe?.();
    this._aiConfigUnsubscribe = this.plugin.ai.subscribeConfig(() => this._refreshModelOptions());
    this.registerEvent(this.app.workspace.on('file-open', async (file) => {
      if (file?.extension !== 'md' || this._busy) return;
      await this._refreshContextOptions();
    }));
  }
  _iconButton(parent, iconName, label, className = '') {
    const button = parent.createEl('button', { cls:PLUGIN_ID + '-ai-header-button ' + className, attr:{ type:'button', title:label, 'aria-label':label } });
    obsidian.setIcon(button, iconName);
    return button;
  }
  async _render() {
    const en = this._language === 'en';
    const container = this.contentEl;
    container.empty();
    container.addClass(PLUGIN_ID + '-ai-view');
    const shell = container.createDiv({ cls:PLUGIN_ID + '-ai-shell' });

    const header = shell.createEl('header', { cls:PLUGIN_ID + '-ai-header' });
    const historyButton = this._iconButton(header, 'panel-left', en ? 'Conversation history' : '会话历史');
    const titleWrap = header.createDiv({ cls:PLUGIN_ID + '-ai-conversation-heading' });
    this._sessionTitleEl = titleWrap.createDiv({ cls:PLUGIN_ID + '-ai-conversation-title' });
    titleWrap.createDiv({ cls:PLUGIN_ID + '-ai-conversation-subtitle', text:en ? 'Stored locally' : '本地会话' });
    const headerControls = header.createDiv({ cls:PLUGIN_ID + '-ai-header-controls' });
    const newChat = this._iconButton(headerControls, 'square-pen', en ? 'New conversation' : '新建对话');
    const settings = this._iconButton(headerControls, 'settings-2', en ? 'AI settings' : 'AI 设置');
    const close = this._iconButton(headerControls, 'x', en ? 'Close AI sidebar' : '关闭 AI 侧栏', PLUGIN_ID + '-ai-close');
    historyButton.onclick = () => this._toggleSessionDrawer(true);
    newChat.onclick = () => this._newSession();
    settings.onclick = () => { this.app.setting.open(); this.app.setting.openTabById(PLUGIN_ID); };
    close.onclick = () => this.plugin.closeAI();

    this._buildSessionDrawer(shell);
    this._messagesEl = shell.createEl('main', { cls:PLUGIN_ID + '-ai-messages', attr:{ 'aria-live':'polite' } });
    await this._buildComposer(shell);
    await this._refreshContextOptions();
    this._renderActiveSession();
    this._renderSessionList();
    this.registerDomEvent(document, 'click', () => this._closeContextPopover());
  }
  _buildSessionDrawer(shell) {
    const en = this._language === 'en';
    const layer = shell.createDiv({ cls:PLUGIN_ID + '-ai-session-drawer-layer' });
    layer.hidden = true;
    const backdrop = layer.createDiv({ cls:PLUGIN_ID + '-ai-session-backdrop' });
    const drawer = layer.createEl('aside', { cls:PLUGIN_ID + '-ai-session-drawer', attr:{ 'aria-label':en ? 'Conversation history' : '会话历史' } });
    const head = drawer.createDiv({ cls:PLUGIN_ID + '-ai-session-drawer-head' });
    head.createEl('strong', { text:en ? 'Conversations' : '对话' });
    const add = this._iconButton(head, 'square-pen', en ? 'New conversation' : '新建对话');
    const search = drawer.createEl('input', { cls:PLUGIN_ID + '-ai-session-search', attr:{ type:'search', placeholder:en ? 'Search conversations' : '搜索对话', 'aria-label':en ? 'Search conversations' : '搜索对话' } });
    const list = drawer.createDiv({ cls:PLUGIN_ID + '-ai-session-list' });
    drawer.createDiv({ cls:PLUGIN_ID + '-ai-session-privacy', text:en
      ? 'Local history excludes attachments, RAG excerpts, reasoning, and tool arguments.'
      : '本地历史不保存附件、RAG 片段、思考过程和工具参数。' });
    backdrop.onclick = () => this._toggleSessionDrawer(false);
    add.onclick = () => this._newSession();
    search.oninput = () => this._renderSessionList(search.value);
    drawer.onclick = (event) => event.stopPropagation();
    this._sessionDrawerEls = { layer, drawer, list, search };
  }
  _toggleSessionDrawer(open) {
    const layer = this._sessionDrawerEls?.layer;
    if (!layer) return;
    layer.hidden = !open;
    layer.classList.toggle('is-open', open);
    if (open) { this._renderSessionList(this._sessionDrawerEls.search.value); window.setTimeout(() => this._sessionDrawerEls.search.focus(), 0); }
  }
  _sessionGroup(session) {
    const en = this._language === 'en';
    const age = Date.now() - session.updatedAt;
    if (age < 86400000 && new Date(session.updatedAt).toDateString() === new Date().toDateString()) return en ? 'Today' : '今天';
    if (age < 7 * 86400000) return en ? 'Previous 7 days' : '过去 7 天';
    return en ? 'Earlier' : '更早';
  }
  _renderSessionList(query = '') {
    const list = this._sessionDrawerEls?.list;
    if (!list) return;
    const en = this._language === 'en';
    const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
    const sessions = this._historyState.sessions.filter((session) => !normalizedQuery || session.title.toLocaleLowerCase().includes(normalizedQuery));
    list.empty();
    if (!sessions.length) {
      list.createDiv({ cls:PLUGIN_ID + '-ai-session-empty', text:normalizedQuery ? (en ? 'No matching conversations' : '没有匹配的对话') : (en ? 'No conversations yet' : '还没有历史对话') });
      return;
    }
    let lastGroup = '';
    sessions.forEach((session) => {
      const group = this._sessionGroup(session);
      if (group !== lastGroup) { list.createDiv({ cls:PLUGIN_ID + '-ai-session-group', text:group }); lastGroup = group; }
      const row = list.createDiv({ cls:PLUGIN_ID + '-ai-session-row' + (session.id === this._activeSessionId ? ' is-active' : '') });
      const open = row.createEl('button', { cls:PLUGIN_ID + '-ai-session-open', attr:{ type:'button' } });
      open.createSpan({ cls:PLUGIN_ID + '-ai-session-row-title', text:session.title });
      open.createSpan({ cls:PLUGIN_ID + '-ai-session-row-meta', text:(session.messages.length || 0) + (en ? ' messages' : ' 条消息') });
      const more = this._iconButton(row, 'ellipsis', en ? 'Conversation actions' : '对话操作', PLUGIN_ID + '-ai-session-more');
      open.onclick = () => this._switchSession(session.id);
      more.onclick = (event) => { event.stopPropagation(); this._openSessionMenu(event, session); };
    });
  }
  _openSessionMenu(event, session) {
    const en = this._language === 'en';
    const menu = new obsidian.Menu();
    menu.addItem((item) => item.setTitle(en ? 'Rename' : '重命名').setIcon('pencil').onClick(() => {
      new CockpitAISessionNameModal(this.app, session.title, this._language, async (title) => {
        await this.plugin.aiHistory.rename(session.id, title, this._language); await this._refreshHistoryUi();
      }).open();
    }));
    menu.addItem((item) => item.setTitle(en ? 'Delete' : '删除').setIcon('trash-2').onClick(() => {
      new CockpitAISessionDeleteModal(this.app, session.title, this._language, async () => {
        await this.plugin.aiHistory.remove(session.id);
        this._historyState = await this.plugin.aiHistory.load();
        if (!this._historyState.sessions.length) await this._newSession();
        else await this._switchSession(this._historyState.activeSessionId || this._historyState.sessions[0].id);
      }).open();
    }));
    menu.showAtMouseEvent(event);
  }
  async _newSession() {
    if (this._busy) return;
    const config = await this.plugin.ai.getConfig();
    const session = await this.plugin.aiHistory.create({ language:this._language, profileId:config.activeProfileId, contextPaths:[] });
    this._historyState = await this.plugin.aiHistory.load();
    this._activeSessionId = session.id;
    this._selectedContextPaths = [];
    this._uploadedContexts = [];
    this._toggleSessionDrawer(false);
    await this._refreshContextOptions();
    this._renderActiveSession();
    this._renderSessionList();
    this._composerEls?.input?.focus();
  }
  async _switchSession(sessionId) {
    if (this._busy || sessionId === this._activeSessionId) { this._toggleSessionDrawer(false); return; }
    const session = await this.plugin.aiHistory.setActive(sessionId);
    if (!session) return;
    this._historyState = await this.plugin.aiHistory.load();
    this._activeSessionId = session.id;
    this._selectedContextPaths = [...session.contextPaths];
    this._uploadedContexts = [];
    const config = await this.plugin.ai.getConfig();
    if (session.profileId && config.profiles.some((profile) => profile.id === session.profileId) && session.profileId !== config.activeProfileId) await this.plugin.ai.setActiveProfile(session.profileId);
    await this._refreshContextOptions();
    this._renderActiveSession();
    this._renderSessionList();
    this._toggleSessionDrawer(false);
  }
  async _refreshHistoryUi() {
    this._historyState = await this.plugin.aiHistory.load();
    this._renderSessionList(this._sessionDrawerEls?.search?.value || '');
    const session = this._activeSession();
    if (this._sessionTitleEl) this._sessionTitleEl.setText(session?.title || (this._language === 'en' ? 'New chat' : '新对话'));
  }
  _renderWelcome() {
    const en = this._language === 'en';
    const welcome = this._messagesEl.createDiv({ cls:PLUGIN_ID + '-ai-welcome' });
    const icon = welcome.createDiv({ cls:PLUGIN_ID + '-ai-welcome-icon' }); obsidian.setIcon(icon, 'sparkles');
    welcome.createDiv({ cls:PLUGIN_ID + '-ai-welcome-title', text:en ? 'What are we working on?' : '今天想处理什么？' });
    welcome.createDiv({ cls:PLUGIN_ID + '-ai-welcome-copy', text:en ? 'Ask directly, or add notes and files from the composer.' : '直接提问，或者从输入框添加笔记与文件。' });
    const prompts = welcome.createDiv({ cls:PLUGIN_ID + '-ai-welcome-prompts' });
    const summarize = prompts.createEl('button', { text:en ? 'Summarize selected notes' : '总结所选笔记' });
    const todos = prompts.createEl('button', { text:en ? 'Extract next actions' : '提取下一步行动' });
    summarize.onclick = () => this._run('summarize', ''); todos.onclick = () => this._run('extract-todos', '');
  }
  _renderActiveSession() {
    if (!this._messagesEl) return;
    const session = this._activeSession();
    if (this._sessionTitleEl) this._sessionTitleEl.setText(session?.title || (this._language === 'en' ? 'New chat' : '新对话'));
    this._messagesEl.empty();
    if (!session?.messages?.length) this._renderWelcome();
    else session.messages.forEach((message) => this._appendMessage(message.role, message.content, false, { markdown:message.role === 'assistant' }));
    this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
  }
  async _buildComposer(shell) {
    const en = this._language === 'en';
    const composer = shell.createEl('section', { cls:PLUGIN_ID + '-ai-composer' });
    const uploadInput = composer.createEl('input', { cls:PLUGIN_ID + '-ai-upload-input', attr:{ type:'file', multiple:'multiple', accept:'.md,.txt,.csv,.json,.yaml,.yml,.log,.html,.htm,.xml,text/*' } });
    const chips = composer.createDiv({ cls:PLUGIN_ID + '-ai-context-chips' });
    const input = composer.createEl('textarea', { cls:PLUGIN_ID + '-ai-input', attr:{ rows:'1', maxlength:'8000', placeholder:en ? 'Message Cockpit AI' : '向 Cockpit AI 提问', 'aria-label':en ? 'Ask Cockpit AI' : '向 Cockpit AI 提问' } });
    const footer = composer.createDiv({ cls:PLUGIN_ID + '-ai-composer-footer' });
    const tools = footer.createDiv({ cls:PLUGIN_ID + '-ai-composer-tools' });
    const add = tools.createEl('button', { cls:PLUGIN_ID + '-ai-composer-add', attr:{ type:'button', title:en ? 'Add context or file' : '添加上下文或文件', 'aria-label':en ? 'Add context or file' : '添加上下文或文件', 'aria-expanded':'false' } }); obsidian.setIcon(add, 'plus');
    const contextButton = tools.createEl('button', { cls:PLUGIN_ID + '-ai-context-summary', attr:{ type:'button', 'aria-expanded':'false' } });
    const contextIcon = contextButton.createSpan(); obsidian.setIcon(contextIcon, 'database-zap');
    const contextLabel = contextButton.createSpan({ cls:PLUGIN_ID + '-ai-context-summary-label' });
    const right = footer.createDiv({ cls:PLUGIN_ID + '-ai-composer-right' });
    const modelSelect = right.createEl('select', { cls:PLUGIN_ID + '-ai-model-select dropdown', attr:{ 'aria-label':en ? 'AI model' : 'AI 模型', title:en ? 'Switch AI model' : '切换 AI 模型' } });
    const config = await this.plugin.ai.getConfig();
    this._fillModelOptions(modelSelect, config);
    const send = right.createEl('button', { cls:PLUGIN_ID + '-ai-send', attr:{ type:'button' } });
    const popover = composer.createDiv({ cls:PLUGIN_ID + '-ai-context-popover' }); popover.hidden = true;
    const menu = popover.createDiv({ cls:PLUGIN_ID + '-ai-context-menu', attr:{ role:'menu' } });
    this._contextPickerEls = { composer, popover, menu, chips, uploadInput, add, contextButton, contextLabel };
    const togglePopover = (event) => { event.stopPropagation(); const open = popover.hidden; popover.hidden = !open; add.setAttribute('aria-expanded', String(open)); contextButton.setAttribute('aria-expanded', String(open)); };
    add.onclick = togglePopover; contextButton.onclick = togglePopover; popover.onclick = (event) => event.stopPropagation();
    uploadInput.onchange = async () => {
      try {
        const additions = await readAiUploadFiles(uploadInput.files); const merged = [...this._uploadedContexts];
        additions.forEach((item) => { if (!merged.some((existing) => existing.hash === item.hash && existing.name === item.name)) merged.push(item); });
        if (merged.length > AI_UPLOAD_LIMITS.maxFiles) throw new Error(en ? 'Attach at most five files.' : '最多上传 5 个文件。');
        this._uploadedContexts = merged; this._renderContextPicker();
      } catch (error) { new obsidian.Notice((en ? 'Could not attach file: ' : '文件上传失败：') + (error?.message || 'unknown error')); }
      finally { uploadInput.value = ''; }
    };
    const resize = () => { input.style.height = 'auto'; input.style.height = Math.min(160, Math.max(30, input.scrollHeight)) + 'px'; };
    input.oninput = resize;
    const submit = () => { const question = input.value.trim(); if (!question || this._busy) return; input.value = ''; resize(); this._run('custom', question); };
    send.onclick = () => { if (this._busy) this._abortController?.abort(); else submit(); };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); }
    });
    modelSelect.onchange = async () => {
      const previous = (await this.plugin.ai.getConfig()).activeProfileId; modelSelect.disabled = true;
      try {
        const saved = await this.plugin.ai.setActiveProfile(modelSelect.value); if (saved.activeProfileId !== modelSelect.value) throw new Error('profile not found');
        await this.plugin.aiHistory.update(this._activeSessionId, { profileId:modelSelect.value }); await this._refreshHistoryUi();
      } catch (error) { modelSelect.value = previous; new obsidian.Notice(en ? 'Could not switch the AI model.' : '模型切换失败，请检查配置。'); }
      finally { modelSelect.disabled = false; }
    };
    this._composerEls = { input, send, modelSelect, composer };
    this._renderSendState(false);
  }
  _fillModelOptions(modelSelect, config) {
    modelSelect.empty();
    config.profiles.forEach((profile) => modelSelect.createEl('option', { value:profile.id, text:profile.name || profile.model }));
    modelSelect.value = config.activeProfileId;
  }
  _closeContextPopover() {
    if (!this._contextPickerEls?.popover) return;
    this._contextPickerEls.popover.hidden = true;
    this._contextPickerEls.add.setAttribute('aria-expanded', 'false');
    this._contextPickerEls.contextButton.setAttribute('aria-expanded', 'false');
  }
  async _refreshContextOptions() {
    if (!this._contextPickerEls) return;
    try {
      const recent = await this.plugin.ai.listRecentNotes(this._selectedContextPaths[0] || '');
      const byPath = new Map(recent.map((entry) => [entry.path, entry]));
      this._selectedContextPaths.forEach((path) => { if (!byPath.has(path)) byPath.set(path, { path }); });
      this._contextEntries = Array.from(byPath.values()).slice(0, 20);
    } catch (error) { this._contextEntries = this._selectedContextPaths.map((path) => ({ path })); }
    this._renderContextPicker();
  }
  _renderContextPicker() {
    const elements = this._contextPickerEls;
    if (!elements) return;
    const en = this._language === 'en';
    const selected = new Set(this._selectedContextPaths);
    const selectedCount = selected.size; const attachmentCount = this._uploadedContexts.length;
    elements.contextLabel.setText(selectedCount || attachmentCount
      ? (en ? `${selectedCount} notes · ${attachmentCount} files` : `${selectedCount} 篇 · ${attachmentCount} 附件`)
      : (en ? 'Auto RAG' : '自动 RAG'));
    elements.menu.empty();
    const menuHead = elements.menu.createDiv({ cls:PLUGIN_ID + '-ai-context-menu-head' });
    menuHead.createEl('strong', { text:en ? 'Add context' : '添加上下文' });
    const menuActions = menuHead.createDiv();
    const upload = this._iconButton(menuActions, 'paperclip', en ? 'Attach text files' : '上传文本文件');
    const refresh = this._iconButton(menuActions, 'refresh-cw', en ? 'Refresh recent notes' : '刷新最近笔记');
    upload.onclick = () => elements.uploadInput.click(); refresh.onclick = () => this._refreshContextOptions();
    const auto = elements.menu.createEl('button', { cls:PLUGIN_ID + '-ai-context-option is-auto' + (!selectedCount ? ' is-selected' : ''), attr:{ type:'button', role:'menuitem' } });
    const autoIcon = auto.createSpan({ cls:PLUGIN_ID + '-ai-context-option-icon' }); obsidian.setIcon(autoIcon, 'sparkles');
    const autoCopy = auto.createSpan({ cls:PLUGIN_ID + '-ai-context-option-copy' }); autoCopy.createSpan({ text:en ? 'Automatic local RAG' : '自动本地 RAG' }); autoCopy.createSpan({ text:en ? 'Search the Vault only when you send' : '仅在发送问题时检索知识库' });
    auto.onclick = () => { this._selectedContextPaths = []; this._renderContextPicker(); };
    this._contextEntries.forEach((entry) => {
      const row = elements.menu.createEl('label', { cls:PLUGIN_ID + '-ai-context-option' + (selected.has(entry.path) ? ' is-selected' : '') });
      const checkbox = row.createEl('input', { attr:{ type:'checkbox', value:entry.path } }); checkbox.checked = selected.has(entry.path);
      const copy = row.createSpan({ cls:PLUGIN_ID + '-ai-context-option-copy' }); copy.createSpan({ text:entry.path.split('/').pop()?.replace(/\.md$/i, '') || entry.path }); copy.createSpan({ text:entry.path });
      checkbox.onchange = () => { const next = new Set(this._selectedContextPaths); if (checkbox.checked) next.add(entry.path); else next.delete(entry.path); this._selectedContextPaths = Array.from(next).slice(0, 12); this._renderContextPicker(); };
    });
    const quick = elements.menu.createDiv({ cls:PLUGIN_ID + '-ai-context-quick-actions' });
    const summarize = quick.createEl('button', { text:en ? 'Summarize' : '总结' }); const todos = quick.createEl('button', { text:en ? 'Extract tasks' : '提取待办' });
    summarize.onclick = () => { this._closeContextPopover(); this._run('summarize', ''); };
    todos.onclick = () => { this._closeContextPopover(); this._run('extract-todos', ''); };
    elements.chips.empty();
    const addChip = (label, iconName, remove, title) => {
      const chip = elements.chips.createDiv({ cls:PLUGIN_ID + '-ai-context-chip', attr:{ title:title || label } });
      const icon = chip.createSpan({ cls:PLUGIN_ID + '-ai-context-chip-icon' }); obsidian.setIcon(icon, iconName);
      chip.createSpan({ cls:PLUGIN_ID + '-ai-context-chip-label', text:label });
      const close = chip.createEl('button', { attr:{ type:'button', 'aria-label':(en ? 'Remove ' : '移除 ') + label } }); obsidian.setIcon(close, 'x'); close.onclick = remove;
    };
    this._selectedContextPaths.forEach((path) => addChip(path.split('/').pop()?.replace(/\.md$/i, '') || path, 'file-text', () => { this._selectedContextPaths = this._selectedContextPaths.filter((item) => item !== path); this._renderContextPicker(); }, path));
    this._uploadedContexts.forEach((item) => addChip(item.name, 'paperclip', () => { this._uploadedContexts = this._uploadedContexts.filter((entry) => entry !== item); this._renderContextPicker(); }, item.name));
  }
  async _refreshModelOptions() {
    const modelSelect = this._composerEls?.modelSelect;
    if (!modelSelect) return;
    const config = await this.plugin.ai.getConfig(); this._fillModelOptions(modelSelect, config); modelSelect.disabled = this._busy;
  }
  async _renderMarkdown(element, text) {
    try { element.empty(); await obsidian.MarkdownRenderer.render(this.app, String(text || ''), element, '', this); }
    catch (error) { element.setText(String(text || '')); }
  }
  _appendMessage(role, text, pending, options = {}) {
    this._messagesEl?.querySelector('.' + PLUGIN_ID + '-ai-welcome')?.remove();
    const row = this._messagesEl.createDiv({ cls:PLUGIN_ID + '-ai-message ' + role + (pending ? ' pending' : '') });
    if (role === 'assistant') { const avatar = row.createDiv({ cls:PLUGIN_ID + '-ai-message-avatar' }); obsidian.setIcon(avatar, 'sparkles'); }
    const content = row.createDiv({ cls:PLUGIN_ID + '-ai-message-content' });
    const body = content.createDiv({ cls:PLUGIN_ID + '-ai-message-body' });
    if (options.markdown && role === 'assistant') this._renderMarkdown(body, text); else body.setText(text || '');
    this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    return { row, content, body };
  }
  _appendStreamingMessage() {
    const en = this._language === 'en';
    const message = this._appendMessage('assistant', '', false);
    message.body.addClass(PLUGIN_ID + '-ai-stream');
    const activity = message.body.createEl('details', { cls:PLUGIN_ID + '-ai-activity', attr:{ open:'open' } });
    activity.createEl('summary', { text:en ? 'Work log' : '处理过程' });
    const toolActivity = activity.createDiv({ cls:PLUGIN_ID + '-ai-activity-track', attr:{ 'aria-live':'polite' } });
    const status = toolActivity.createDiv({ cls:PLUGIN_ID + '-ai-activity-step is-running', attr:{ role:'status' } });
    const statusIcon = status.createSpan({ cls:PLUGIN_ID + '-ai-activity-icon' }); obsidian.setIcon(statusIcon, 'loader-circle');
    const statusText = status.createSpan({ cls:PLUGIN_ID + '-ai-activity-label', text:en ? 'Connecting to model' : '正在连接模型' });
    status.createSpan({ cls:PLUGIN_ID + '-ai-tool-state' });
    const reasoning = message.body.createEl('details', { cls:PLUGIN_ID + '-ai-reasoning is-empty' }); reasoning.createEl('summary', { text:en ? 'Reasoning' : '思考过程' });
    const reasoningText = reasoning.createDiv({ cls:PLUGIN_ID + '-ai-reasoning-text' });
    const answer = message.body.createDiv({ cls:PLUGIN_ID + '-ai-stream-answer' });
    return { ...message, activity, status, statusText, reasoning, reasoningText, answer, toolActivity, toolRows:new Map() };
  }
  _renderToolEvent(message, event) {
    if (!message?.toolActivity || !event?.callId) return;
    const en = this._language === 'en';
    let row = message.toolRows.get(event.callId);
    if (!row) {
      row = message.toolActivity.createDiv({ cls:PLUGIN_ID + '-ai-activity-step' });
      const icon = row.createSpan({ cls:PLUGIN_ID + '-ai-activity-icon' });
      const iconName = event.name === 'local_context' ? 'search' : event.name === 'reasoning' ? 'brain' : event.name === 'writing' ? 'pencil-line' : 'wrench'; obsidian.setIcon(icon, iconName);
      row.createSpan({ cls:PLUGIN_ID + '-ai-activity-label', text:event.label || event.name || (en ? 'Cockpit tool' : 'Cockpit 工具') }); row.createSpan({ cls:PLUGIN_ID + '-ai-tool-state' });
      message.toolRows.set(event.callId, row);
    }
    const states = en ? { requested:'Queued', awaiting_confirmation:'Waiting', executing:'Running', completed:'Done', denied:'Denied', error:'Failed' }
      : { requested:'已排队', awaiting_confirmation:'等待确认', executing:'执行中', completed:'已完成', denied:'已拒绝', error:'失败' };
    row.className = PLUGIN_ID + '-ai-activity-step is-' + String(event.stage || 'requested').replace(/_/g, '-');
    if (event.label) row.querySelector('.' + PLUGIN_ID + '-ai-activity-label')?.setText(event.label);
    row.querySelector('.' + PLUGIN_ID + '-ai-tool-state')?.setText(states[event.stage] || event.stage || '');
  }
  _confirmAgentTool(tool) {
    return new Promise((resolve) => {
      const signal = this._abortController?.signal; let modal = null;
      const finish = (value) => { signal?.removeEventListener?.('abort', onAbort); if (this._toolConfirmModal === modal) this._toolConfirmModal = null; resolve(value); };
      const onAbort = () => modal?.close(); modal = new CockpitAgentConfirmationModal(this.app, tool, this._language, finish); this._toolConfirmModal = modal;
      signal?.addEventListener?.('abort', onAbort, { once:true }); modal.open();
    });
  }
  _renderSendState(running) {
    const send = this._composerEls?.send;
    if (!send) return;
    const en = this._language === 'en'; send.empty(); obsidian.setIcon(send, running ? 'square' : 'arrow-up'); send.classList.toggle('is-stop', running);
    send.setAttribute('aria-label', running ? (en ? 'Stop generation' : '停止生成') : (en ? 'Send message' : '发送消息'));
    send.setAttribute('title', running ? (en ? 'Stop generation' : '停止生成') : (en ? 'Send message' : '发送消息'));
  }
  _setBusy(value) {
    this._busy = value;
    const { input, send, modelSelect, composer } = this._composerEls || {};
    if (input) input.disabled = value; if (send) send.disabled = false; if (modelSelect) modelSelect.disabled = value; this._renderSendState(value);
    composer?.querySelectorAll('.' + PLUGIN_ID + '-ai-context-popover button').forEach((button) => { button.disabled = value; });
  }
  async _safeHistory(operation) {
    try { return await operation; }
    catch (error) { console.warn('Cockpit: could not save AI conversation history'); return null; }
  }
  async _run(action, question) {
    if (this._busy) return;
    const en = this._language === 'en';
    if (action !== 'custom' && !this._selectedContextPaths.length && !this._uploadedContexts.length) {
      new obsidian.Notice(en ? 'Select at least one note or attach a text file for this action.' : '请先选择笔记或添加文本文件'); this._closeContextPopover(); return;
    }
    const session = this._activeSession();
    const priorHistory = (session?.messages || []).map((message) => ({ role:message.role, content:message.content }));
    const config = await this.plugin.ai.getConfig();
    const runAttachments = this._uploadedContexts.map((item) => ({ ...item }));
    const userText = question || (action === 'summarize' ? (en ? 'Summarize the selected notes' : '总结所选笔记') : (en ? 'Extract tasks from the selected notes' : '从所选笔记提取待办'));
    this._abortController = new AbortController(); this._setBusy(true); this._closeContextPopover();
    this._appendMessage('user', userText, false);
    await this._safeHistory(this.plugin.aiHistory.update(this._activeSessionId, { profileId:config.activeProfileId, contextPaths:this._selectedContextPaths }));
    await this._safeHistory(this.plugin.aiHistory.appendMessage(this._activeSessionId, { role:'user', content:userText, language:this._language }));
    await this._refreshHistoryUi();
    let streamMessage = this._appendStreamingMessage(); let clock = null; const startedAt = Date.now(); let stage = en ? 'Connecting to model' : '正在连接模型';
    const elapsedLabel = () => Math.max(0, (Date.now() - startedAt) / 1000).toFixed(1) + 's';
    const setStatus = (text, state = 'is-running') => { streamMessage.status.className = PLUGIN_ID + '-ai-activity-step ' + state; streamMessage.statusText.setText(text); };
    try {
      clock = window.setInterval(() => setStatus(stage + ' · ' + elapsedLabel()), 500);
      let answer = ''; let reasoning = '';
      const result = await this.plugin.ai.completeAgentStream({
        action, question, history:priorHistory, contextPaths:[...this._selectedContextPaths], attachments:runAttachments, language:this._language
      }, (event) => {
        if (event.type === 'status' && event.stage === 'fallback') stage = en ? 'Using compatibility mode' : '正在使用兼容模式';
        if (event.type === 'status' && event.stage === 'tools_unavailable') stage = en ? 'Answering without tools' : '模型不支持工具，正在直接回答';
        if (event.type === 'status' && event.stage === 'retrieving_context') {
          stage = en ? 'Searching local knowledge base' : '正在检索本地知识库';
          this._renderToolEvent(streamMessage, { callId:'context-' + startedAt, name:'local_context', label:stage, stage:'executing' });
        }
        if (event.type === 'status' && event.stage === 'context_progress') {
          stage = en ? `Indexing notes ${event.indexed || 0}/${event.total || 0}` : `正在索引笔记 ${event.indexed || 0}/${event.total || 0}`;
          this._renderToolEvent(streamMessage, { callId:'context-' + startedAt, name:'local_context', label:stage, stage:'executing' });
          streamMessage.toolRows.get('context-' + startedAt)?.querySelector('.' + PLUGIN_ID + '-ai-activity-label')?.setText(stage);
        }
        if (event.type === 'status' && event.stage === 'context_ready') {
          const isRag = String(event.mode || '').startsWith('rag-');
          const label = isRag ? (en ? `Selected ${event.count || 0} local excerpts` : `已选取 ${event.count || 0} 个本地片段`) : (en ? `Loaded ${event.count || 0} contexts` : `已载入 ${event.count || 0} 个上下文`);
          this._renderToolEvent(streamMessage, { callId:'context-' + startedAt, name:'local_context', label, stage:'completed' });
          streamMessage.toolRows.get('context-' + startedAt)?.querySelector('.' + PLUGIN_ID + '-ai-activity-label')?.setText(label); stage = label;
        }
        if (event.type === 'reasoning' && event.text) {
          stage = en ? 'Reasoning' : '正在思考'; reasoning += event.text;
          this._renderToolEvent(streamMessage, { callId:'reasoning-' + startedAt, name:'reasoning', label:stage, stage:'executing' });
          streamMessage.reasoning.removeClass('is-empty'); streamMessage.reasoningText.append(document.createTextNode(event.text));
        }
        if (event.type === 'content' && event.text) {
          stage = en ? 'Writing answer' : '正在生成回答'; answer += event.text;
          this._renderToolEvent(streamMessage, { callId:'writing-' + startedAt, name:'writing', label:stage, stage:'executing' });
          streamMessage.answer.append(document.createTextNode(event.text));
        }
        if (event.type === 'tool') {
          this._renderToolEvent(streamMessage, event);
          if (event.stage === 'awaiting_confirmation') stage = en ? 'Waiting for approval' : '等待你的确认';
          else if (event.stage === 'executing') stage = en ? 'Running Cockpit tool' : '正在执行 Cockpit 工具';
          else if (event.stage === 'completed') stage = en ? 'Tool completed' : '工具执行完成';
          else if (event.stage === 'denied') stage = en ? 'Tool denied' : '工具已拒绝';
        }
        setStatus(stage + ' · ' + elapsedLabel()); this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
      }, this._abortController.signal, { confirmTool:(tool) => this._confirmAgentTool(tool) });
      answer = result.content || answer; reasoning = result.reasoning || reasoning;
      if (!streamMessage.answer.textContent && answer) streamMessage.answer.setText(answer);
      if (!streamMessage.reasoningText.textContent && reasoning) { streamMessage.reasoning.removeClass('is-empty'); streamMessage.reasoningText.setText(reasoning); }
      if (reasoning) this._renderToolEvent(streamMessage, { callId:'reasoning-' + startedAt, name:'reasoning', label:en ? 'Reasoned through the request' : '已完成思考', stage:'completed' });
      if (answer) this._renderToolEvent(streamMessage, { callId:'writing-' + startedAt, name:'writing', label:en ? 'Answer completed' : '回答已生成', stage:'completed' });
      setStatus((en ? 'Completed' : '已完成') + ' · ' + elapsedLabel(), 'is-done');
      await this._renderMarkdown(streamMessage.answer, answer);
      const tools = streamMessage.content.createDiv({ cls:PLUGIN_ID + '-ai-message-tools' });
      const copy = tools.createEl('button', { attr:{ type:'button' }, text:en ? 'Copy' : '复制' });
      copy.onclick = async () => { try { await navigator.clipboard.writeText(answer); copy.setText(en ? 'Copied' : '已复制'); } catch (error) { new obsidian.Notice(en ? 'Could not copy the response.' : '复制失败，请手动选择文本。'); } };
      await this._safeHistory(this.plugin.aiHistory.appendMessage(this._activeSessionId, { role:'assistant', content:answer, language:this._language }));
    } catch (error) {
      if (this._abortController?.signal.aborted || error?.name === 'AbortError') {
        const partial = streamMessage.answer.textContent || '';
        if (!partial && !streamMessage.reasoningText.textContent) streamMessage.answer.setText(en ? 'Generation stopped.' : '已停止生成。');
        setStatus((en ? 'Stopped' : '已停止') + ' · ' + elapsedLabel(), 'is-stopped');
        if (partial) await this._safeHistory(this.plugin.aiHistory.appendMessage(this._activeSessionId, { role:'assistant', content:partial, language:this._language }));
      } else {
        const errorText = error?.message || (en ? 'AI request failed.' : 'AI 请求失败'); setStatus(en ? 'Request failed' : '请求失败', 'is-error');
        if (!streamMessage.answer.textContent) streamMessage.answer.setText('⚠ ' + errorText); streamMessage.row.addClass('error');
      }
    } finally {
      if (clock) window.clearInterval(clock); this._abortController = null; this._uploadedContexts = []; this._setBusy(false);
      await this._refreshHistoryUi(); this._renderContextPicker(); this._composerEls?.input?.focus(); this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    }
  }
  async onClose() {
    this._abortController?.abort(); this._toolConfirmModal?.close(); this._toolConfirmModal = null;
    this._aiConfigUnsubscribe?.(); this._aiConfigUnsubscribe = null; this.contentEl.removeClass(PLUGIN_ID + '-ai-view');
    this._messagesEl = null; this._contextPickerEls = null; this._sessionDrawerEls = null; this._uploadedContexts = []; this._composerEls = null;
    window.setTimeout(() => this.plugin._syncAiLauncher?.(), 0);
  }
}
