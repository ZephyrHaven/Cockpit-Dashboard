// ai-view.js — Cockpit AI 自适应侧栏、模型切换与安全设置界面

class CockpitAIView extends obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this._language = DEFAULT_LANG;
    this._busy = false;
    this._messagesEl = null;
    this._selectedContextPath = '';
    this._abortController = null;
    this._aiConfigUnsubscribe = null;
  }
  getViewType() { return AI_VIEW_TYPE; }
  getDisplayText() { return this._language === 'en' ? 'Cockpit AI' : 'Cockpit AI 助手'; }
  getIcon() { return 'bot-message-square'; }
  async onOpen() {
    const data = await this.plugin.loadData() || {};
    this._language = normalizeLang(data.language || DEFAULT_LANG);
    await this._render();
    this._aiConfigUnsubscribe?.();
    this._aiConfigUnsubscribe = this.plugin.ai.subscribeConfig(() => this._refreshModelOptions());
    this.registerEvent(this.app.workspace.on('file-open', async (file) => {
      if (file?.extension !== 'md' || this._busy) return;
      this._selectedContextPath = file.path;
      await this._refreshContextOptions();
    }));
  }
  async _render() {
    const en = this._language === 'en';
    const container = this.contentEl;
    container.empty();
    container.addClass(PLUGIN_ID + '-ai-view');
    const shell = container.createDiv({ cls:PLUGIN_ID + '-ai-shell' });

    const header = shell.createDiv({ cls:PLUGIN_ID + '-ai-header' });
    const brand = header.createDiv({ cls:PLUGIN_ID + '-ai-brand' });
    brand.createDiv({ cls:PLUGIN_ID + '-ai-mark', text:'AI' });
    const title = brand.createDiv({ cls:PLUGIN_ID + '-ai-brand-copy' });
    title.createDiv({ cls:PLUGIN_ID + '-ai-title', text:'Cockpit AI' });
    title.createDiv({ cls:PLUGIN_ID + '-ai-subtitle', text:en ? 'A focused assistant for your notes' : '专注于笔记的轻量助手' });
    const headerControls = header.createDiv({ cls:PLUGIN_ID + '-ai-header-controls' });
    const modelSelect = headerControls.createEl('select', {
      cls:PLUGIN_ID + '-ai-model-select dropdown',
      attr:{ 'aria-label':en ? 'AI model' : 'AI 模型', title:en ? 'Switch AI model' : '切换 AI 模型' }
    });
    const config = await this.plugin.ai.getConfig();
    config.profiles.forEach((profile) => modelSelect.createEl('option', {
      value:profile.id,
      text:profile.name && profile.name !== profile.model ? profile.name + ' · ' + profile.model : profile.model,
      attr:profile.id === config.activeProfileId ? { selected:'selected' } : {}
    }));
    modelSelect.value = config.activeProfileId;
    modelSelect.onchange = async () => {
      const previous = (await this.plugin.ai.getConfig()).activeProfileId;
      modelSelect.disabled = true;
      try {
        const saved = await this.plugin.ai.setActiveProfile(modelSelect.value);
        if (saved.activeProfileId !== modelSelect.value) throw new Error('profile not found');
        new obsidian.Notice((en ? 'Model switched to ' : '已切换模型：') + modelSelect.options[modelSelect.selectedIndex]?.text);
      } catch (e) {
        modelSelect.value = previous;
        new obsidian.Notice(en ? 'Could not switch the AI model.' : '模型切换失败，请检查配置。');
      } finally { modelSelect.disabled = false; }
    };
    const settings = headerControls.createEl('button', { cls:PLUGIN_ID + '-ai-icon-button', attr:{ type:'button', title:en ? 'AI settings' : 'AI 设置', 'aria-label':en ? 'AI settings' : 'AI 设置' } });
    obsidian.setIcon(settings, 'settings-2');
    settings.onclick = () => { this.app.setting.open(); this.app.setting.openTabById(PLUGIN_ID); };
    const close = headerControls.createEl('button', { cls:PLUGIN_ID + '-ai-icon-button ' + PLUGIN_ID + '-ai-close', attr:{ type:'button', title:en ? 'Close AI sidebar' : '关闭 AI 侧栏', 'aria-label':en ? 'Close AI sidebar' : '关闭 AI 侧栏' } });
    obsidian.setIcon(close, 'x');
    close.onclick = () => this.plugin.closeAI();

    const contextCard = shell.createDiv({ cls:PLUGIN_ID + '-ai-context' });
    const contextHead = contextCard.createDiv({ cls:PLUGIN_ID + '-ai-context-head' });
    contextHead.createDiv({ cls:PLUGIN_ID + '-ai-context-label', text:en ? 'NOTE CONTEXT' : '笔记上下文' });
    const refreshContext = contextHead.createEl('button', { cls:PLUGIN_ID + '-ai-context-refresh', attr:{ type:'button', title:en ? 'Refresh recent notes' : '刷新最近笔记', 'aria-label':en ? 'Refresh recent notes' : '刷新最近笔记' } });
    obsidian.setIcon(refreshContext, 'refresh-cw');
    this._contextSelect = contextCard.createEl('select', { cls:PLUGIN_ID + '-ai-context-select dropdown', attr:{ 'aria-label':en ? 'Note context' : '笔记上下文' } });
    this._contextHint = contextCard.createDiv({ cls:PLUGIN_ID + '-ai-context-hint' });
    const contextChanged = () => { this._selectedContextPath = this._contextSelect.value; };
    this._contextSelect.onchange = contextChanged;
    refreshContext.onclick = () => this._refreshContextOptions();
    await this._refreshContextOptions();

    const actions = shell.createDiv({ cls:PLUGIN_ID + '-ai-actions' });
    const actionItems = [
      { action:'summarize', icon:'scan-text', label:en ? 'Summarize note' : '总结当前笔记', hint:en ? 'Key points and next actions' : '提炼重点与下一步' },
      { action:'extract-todos', icon:'list-checks', label:en ? 'Extract tasks' : '提取待办', hint:en ? 'Generate a Markdown checklist' : '生成 Markdown 清单' }
    ];
    actionItems.forEach((item) => {
      const button = actions.createEl('button', { cls:PLUGIN_ID + '-ai-action', attr:{ type:'button' } });
      const icon = button.createSpan({ cls:PLUGIN_ID + '-ai-action-icon' }); obsidian.setIcon(icon, item.icon);
      const copy = button.createSpan({ cls:PLUGIN_ID + '-ai-action-copy' });
      copy.createSpan({ cls:PLUGIN_ID + '-ai-action-label', text:item.label });
      copy.createSpan({ cls:PLUGIN_ID + '-ai-action-hint', text:item.hint });
      button.onclick = () => this._run(item.action, '');
    });

    this._messagesEl = shell.createDiv({ cls:PLUGIN_ID + '-ai-messages' });
    const welcome = this._messagesEl.createDiv({ cls:PLUGIN_ID + '-ai-welcome' });
    welcome.createDiv({ cls:PLUGIN_ID + '-ai-welcome-icon' });
    obsidian.setIcon(welcome.lastElementChild, 'sparkles');
    welcome.createDiv({ cls:PLUGIN_ID + '-ai-welcome-title', text:en ? 'Ask about what you are working on' : '问问你正在处理的内容' });
    welcome.createDiv({ cls:PLUGIN_ID + '-ai-welcome-copy', text:en ? 'Choose a recent note above. This preview can read it, but cannot edit your vault.' : '可在上方选择最近笔记。当前预览版只读取内容，不会修改你的 Vault。' });

    const composer = shell.createDiv({ cls:PLUGIN_ID + '-ai-composer' });
    const input = composer.createEl('textarea', { cls:PLUGIN_ID + '-ai-input', attr:{ rows:'3', maxlength:'8000', placeholder:en ? 'Ask a question about the selected note…' : '针对所选笔记提一个问题…', 'aria-label':en ? 'Ask Cockpit AI' : '向 Cockpit AI 提问' } });
    const footer = composer.createDiv({ cls:PLUGIN_ID + '-ai-composer-footer' });
    footer.createDiv({ cls:PLUGIN_ID + '-ai-shortcut', text:en ? '⌘/Ctrl + Enter to send' : '⌘/Ctrl + Enter 发送' });
    const send = footer.createEl('button', { cls:PLUGIN_ID + '-ai-send', attr:{ type:'button' } });
    obsidian.setIcon(send.createSpan(), 'arrow-up'); send.createSpan({ text:en ? 'Send' : '发送' });
    const submit = () => {
      const question = input.value.trim();
      if (!question || this._busy) return;
      input.value = '';
      this._run('custom', question);
    };
    send.onclick = () => {
      if (this._busy) { this._abortController?.abort(); return; }
      submit();
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); }
    });
    this._composerEls = { input, send, actions, modelSelect };
  }
  async _refreshContextOptions() {
    if (!this._contextSelect) return;
    const en = this._language === 'en';
    try {
      const recent = await this.plugin.ai.listRecentNotes(this._selectedContextPath);
      this._contextSelect.empty();
      if (!recent.length) {
        this._contextSelect.createEl('option', { value:'', text:en ? 'No recent Markdown note' : '没有最近打开的 Markdown 笔记' });
        this._contextSelect.disabled = true;
        this._selectedContextPath = '';
      } else {
        recent.forEach((entry) => this._contextSelect.createEl('option', { value:entry.path, text:entry.path }));
        this._contextSelect.disabled = false;
        this._selectedContextPath = recent[0].path;
        this._contextSelect.value = this._selectedContextPath;
      }
      this._contextHint.setText(en
        ? 'Only the selected note is sent after you click an action or send a question.'
        : '只有点击快捷操作或发送问题后，所选笔记内容才会发给模型。');
      this._contextHint.classList.toggle('is-empty', !recent.length);
    } catch (e) {
      this._contextSelect.empty();
      this._contextSelect.createEl('option', { value:'', text:en ? 'Could not read recent notes' : '无法读取最近笔记' });
      this._contextSelect.disabled = true;
      this._contextHint.setText(en ? 'Try refreshing after opening a Markdown note.' : '打开一篇 Markdown 笔记后再刷新。');
      this._contextHint.addClass('is-empty');
    }
  }
  async _refreshModelOptions() {
    const modelSelect = this._composerEls?.modelSelect;
    if (!modelSelect) return;
    const config = await this.plugin.ai.getConfig();
    modelSelect.empty();
    config.profiles.forEach((profile) => modelSelect.createEl('option', {
      value:profile.id,
      text:profile.name && profile.name !== profile.model ? profile.name + ' · ' + profile.model : profile.model
    }));
    modelSelect.value = config.activeProfileId;
    modelSelect.disabled = this._busy;
  }
  _appendMessage(role, text, pending) {
    this._messagesEl?.querySelector('.' + PLUGIN_ID + '-ai-welcome')?.remove();
    const row = this._messagesEl.createDiv({ cls:PLUGIN_ID + '-ai-message ' + role + (pending ? ' pending' : '') });
    row.createDiv({ cls:PLUGIN_ID + '-ai-message-role', text:role === 'user' ? (this._language === 'en' ? 'You' : '你') : 'Cockpit AI' });
    const body = row.createDiv({ cls:PLUGIN_ID + '-ai-message-body', text });
    this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    return { row, body };
  }
  _appendStreamingMessage() {
    const en = this._language === 'en';
    const message = this._appendMessage('assistant', '', false);
    message.body.addClass(PLUGIN_ID + '-ai-stream');
    const status = message.body.createDiv({
      cls:PLUGIN_ID + '-ai-stream-status is-running',
      attr:{ 'aria-live':'polite', role:'status' }
    });
    status.createSpan({ cls:PLUGIN_ID + '-ai-stream-dot', attr:{ 'aria-hidden':'true' } });
    const statusText = status.createSpan({ text:en ? 'Connecting to model…' : '正在连接模型…' });
    const reasoning = message.body.createEl('details', { cls:PLUGIN_ID + '-ai-reasoning is-empty' });
    reasoning.createEl('summary', { text:en ? 'Reasoning process' : '思考过程' });
    const reasoningText = reasoning.createDiv({ cls:PLUGIN_ID + '-ai-reasoning-text' });
    const answer = message.body.createDiv({ cls:PLUGIN_ID + '-ai-stream-answer' });
    return { ...message, status, statusText, reasoning, reasoningText, answer };
  }
  _renderSendState(running) {
    const send = this._composerEls?.send;
    if (!send) return;
    const en = this._language === 'en';
    send.empty();
    obsidian.setIcon(send.createSpan(), running ? 'square' : 'arrow-up');
    send.createSpan({ text:running ? (en ? 'Stop' : '停止') : (en ? 'Send' : '发送') });
    send.classList.toggle('is-stop', running);
    send.setAttribute('aria-label', running ? (en ? 'Stop generation' : '停止生成') : (en ? 'Send message' : '发送消息'));
  }
  _setBusy(value) {
    this._busy = value;
    const { input, send, actions, modelSelect } = this._composerEls || {};
    if (input) input.disabled = value;
    if (send) send.disabled = false;
    this._renderSendState(value);
    if (modelSelect) modelSelect.disabled = value;
    if (this._contextSelect) this._contextSelect.disabled = value || !this._selectedContextPath;
    actions?.querySelectorAll('button').forEach((button) => { button.disabled = value; });
  }
  async _run(action, question) {
    if (this._busy) return;
    const en = this._language === 'en';
    this._abortController = new AbortController();
    this._setBusy(true);
    let streamMessage = null;
    let clock = null;
    const startedAt = Date.now();
    let stage = en ? 'Connecting to model' : '正在连接模型';
    const elapsedLabel = () => Math.max(0, (Date.now() - startedAt) / 1000).toFixed(1) + 's';
    const setStatus = (text, state = 'is-running') => {
      if (!streamMessage) return;
      streamMessage.status.className = PLUGIN_ID + '-ai-stream-status ' + state;
      streamMessage.statusText.setText(text);
    };
    try {
      const note = await this.plugin.ai.getCurrentNoteContext(this._selectedContextPath);
      if (!note && action !== 'custom') throw new Error(en ? 'Open a Markdown note first.' : '请先打开一篇 Markdown 笔记');
      const userText = question || (action === 'summarize' ? (en ? 'Summarize the selected note' : '总结所选笔记') : (en ? 'Extract tasks from the selected note' : '从所选笔记提取待办'));
      this._appendMessage('user', userText, false);
      streamMessage = this._appendStreamingMessage();
      clock = window.setInterval(() => setStatus(stage + ' · ' + elapsedLabel()), 500);
      let answer = '';
      let reasoning = '';
      const result = await this.plugin.ai.completeStream(
        { action, question, note, language:this._language },
        (event) => {
          if (event.type === 'status' && event.stage === 'fallback') {
            stage = en ? 'Compatibility mode' : '兼容模式处理中';
            setStatus(stage + ' · ' + elapsedLabel());
          }
          if (event.type === 'reasoning' && event.text) {
            stage = en ? 'Reasoning' : '正在思考';
            reasoning += event.text;
            streamMessage.reasoning.removeClass('is-empty');
            streamMessage.reasoning.open = true;
            streamMessage.reasoningText.append(document.createTextNode(event.text));
            setStatus(stage + ' · ' + elapsedLabel());
          }
          if (event.type === 'content' && event.text) {
            stage = en ? 'Writing answer' : '正在生成回答';
            answer += event.text;
            streamMessage.answer.append(document.createTextNode(event.text));
            setStatus(stage + ' · ' + elapsedLabel());
          }
          this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
        },
        this._abortController.signal
      );
      answer = result.content || answer;
      reasoning = result.reasoning || reasoning;
      if (!streamMessage.answer.textContent && answer) streamMessage.answer.setText(answer);
      if (!streamMessage.reasoningText.textContent && reasoning) {
        streamMessage.reasoning.removeClass('is-empty');
        streamMessage.reasoningText.setText(reasoning);
      }
      setStatus((result.streamed ? (en ? 'Completed' : '生成完成') : (en ? 'Completed in compatibility mode' : '兼容模式完成')) + ' · ' + elapsedLabel(), 'is-done');
      const tools = streamMessage.row.createDiv({ cls:PLUGIN_ID + '-ai-message-tools' });
      const copy = tools.createEl('button', { attr:{ type:'button' }, text:en ? 'Copy' : '复制' });
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(answer); copy.setText(en ? 'Copied' : '已复制'); }
        catch (e) { new obsidian.Notice(en ? 'Could not copy the response.' : '复制失败，请手动选择文本。'); }
      };
      this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    } catch (e) {
      if (this._abortController?.signal.aborted || e?.name === 'AbortError') {
        if (streamMessage) {
          if (!streamMessage.answer.textContent && !streamMessage.reasoningText.textContent) streamMessage.answer.setText(en ? 'Generation stopped.' : '已停止生成。');
          setStatus((en ? 'Stopped' : '已停止') + ' · ' + elapsedLabel(), 'is-stopped');
        }
      } else {
        const errorText = e?.message || (en ? 'AI request failed.' : 'AI 请求失败');
        if (streamMessage) {
          setStatus(en ? 'Request failed' : '请求失败', 'is-error');
          if (!streamMessage.answer.textContent) streamMessage.answer.setText('⚠ ' + errorText);
          streamMessage.row.addClass('error');
        } else this._appendMessage('assistant', '⚠ ' + errorText, false).row.addClass('error');
      }
    } finally {
      if (clock) window.clearInterval(clock);
      this._abortController = null;
      this._setBusy(false);
      this._composerEls?.input?.focus();
    }
  }
  async onClose() {
    this._abortController?.abort();
    this._aiConfigUnsubscribe?.();
    this._aiConfigUnsubscribe = null;
    this.contentEl.removeClass(PLUGIN_ID + '-ai-view');
    this._messagesEl = null;
    this._contextSelect = null;
    this._contextHint = null;
    this._composerEls = null;
    window.setTimeout(() => this.plugin._syncAiLauncher?.(), 0);
  }
}

async function renderAiSettings(containerEl, plugin, language) {
  const en = language === 'en';
  const config = await plugin.ai.getConfig();
  const section = containerEl.createDiv({ cls:PLUGIN_ID + '-ai-settings' });
  section.createEl('h2', { text:'Cockpit AI' });
  section.createEl('p', { text:en
    ? 'Configure several OpenAI-compatible model profiles and switch between them in the AI sidebar. Requests go directly to the selected provider.'
    : '可配置多个 OpenAI 兼容模型，并在 AI 侧栏直接切换。请求会直达所选模型服务，不经过 Cockpit 中转。' });
  const save = async () => { await plugin.ai.saveConfig(config); };

  const activeSetting = new obsidian.Setting(section)
    .setName(en ? 'Active model' : '当前模型')
    .setDesc(en ? 'The default profile used by the AI sidebar.' : 'AI 侧栏默认使用的模型配置。');
  let activeDropdown = null;
  const refreshActiveDropdown = () => {
    if (!activeDropdown) return;
    activeDropdown.selectEl.empty();
    config.profiles.forEach((profile) => activeDropdown.addOption(profile.id, profile.name || profile.model));
    activeDropdown.setValue(config.activeProfileId);
  };
  activeSetting.addDropdown((dropdown) => {
    activeDropdown = dropdown;
    config.profiles.forEach((profile) => dropdown.addOption(profile.id, profile.name || profile.model));
    dropdown.setValue(config.activeProfileId).onChange(async (value) => { config.activeProfileId = value; await save(); });
  });

  const addSetting = new obsidian.Setting(section)
    .setName(en ? 'Add provider' : '添加模型服务')
    .setDesc(en ? 'Presets remain editable, so newer model IDs and compatible gateways also work.' : '预设地址和模型名都可编辑，后续新模型或兼容网关也能接入。');
  let providerToAdd = 'deepseek';
  addSetting.addDropdown((dropdown) => {
    AI_PROVIDER_PRESETS.forEach((provider) => dropdown.addOption(provider.id, provider.name));
    dropdown.setValue(providerToAdd).onChange((value) => { providerToAdd = value; });
  });

  const cards = section.createDiv({ cls:PLUGIN_ID + '-ai-profile-list' });
  const renderCards = () => {
    cards.empty();
    config.profiles.forEach((profile, index) => {
      const preset = getAiProviderPreset(profile.providerId);
      const card = cards.createDiv({ cls:PLUGIN_ID + '-ai-profile-card' });
      const heading = card.createDiv({ cls:PLUGIN_ID + '-ai-profile-heading' });
      heading.createEl('strong', { text:profile.name || profile.model });
      const headingActions = heading.createDiv({ cls:PLUGIN_ID + '-ai-profile-actions' });
      const test = headingActions.createEl('button', { cls:PLUGIN_ID + '-ai-profile-test', attr:{ type:'button', 'aria-label':en ? 'Test this model profile' : '测试这个模型配置' } });
      obsidian.setIcon(test, 'plug-zap');
      test.createSpan({ text:en ? 'Test' : '测试' });
      test.onclick = async () => {
        test.disabled = true;
        try { await save(); await plugin.ai.testProfile(profile.id, language); new obsidian.Notice(en ? 'This model connection is working.' : '这个模型连接正常'); }
        catch (e) { new obsidian.Notice((en ? 'Model connection failed: ' : '模型连接失败：') + (e?.message || 'unknown error')); }
        finally { test.disabled = false; }
      };
      if (config.profiles.length > 1) {
        const remove = headingActions.createEl('button', { cls:PLUGIN_ID + '-ai-profile-remove', attr:{ type:'button', 'aria-label':en ? 'Remove profile' : '删除配置' } });
        obsidian.setIcon(remove, 'trash-2');
        remove.onclick = async () => {
          config.profiles.splice(index, 1);
          if (config.activeProfileId === profile.id) config.activeProfileId = config.profiles[0].id;
          await save(); refreshActiveDropdown(); renderCards();
        };
      }
      new obsidian.Setting(card).setName(en ? 'Display name' : '显示名称')
        .addText((text) => text.setValue(profile.name).onChange(async (value) => { profile.name = value; await save(); refreshActiveDropdown(); }));
      new obsidian.Setting(card).setName(en ? 'Provider preset' : '服务商预设')
        .addDropdown((dropdown) => {
          AI_PROVIDER_PRESETS.forEach((provider) => dropdown.addOption(provider.id, provider.name));
          dropdown.setValue(profile.providerId).onChange(async (value) => {
            const next = getAiProviderPreset(value);
            profile.providerId = value; profile.baseUrl = next.baseUrl; profile.model = next.models[0] || profile.model;
            await save(); renderCards();
          });
        });
      new obsidian.Setting(card).setName(en ? 'API base URL' : 'API 基础地址')
        .setDesc(en ? 'Remote URLs require HTTPS; localhost may use HTTP.' : '远程地址必须使用 HTTPS；本机服务可使用 HTTP。')
        .addText((text) => text.setPlaceholder(preset.baseUrl).setValue(profile.baseUrl).onChange(async (value) => { profile.baseUrl = value; await save(); }));
      new obsidian.Setting(card).setName(en ? 'Model ID' : '模型 ID')
        .setDesc((preset.models.length ? (en ? 'Examples: ' : '示例：') + preset.models.join('、') : (en ? 'Enter the model identifier from your provider.' : '填写服务商给出的模型标识。')))
        .addText((text) => text.setValue(profile.model).onChange(async (value) => { profile.model = value; await save(); }));
      const secretSetting = new obsidian.Setting(card).setName(en ? 'API key' : 'API Key')
        .setDesc(en ? 'Stored by Obsidian SecretStorage; only the secret name is kept in Cockpit data.' : '由 Obsidian SecretStorage 保管；Cockpit 数据中只保存密钥名称。');
      if (obsidian.SecretComponent && typeof secretSetting.addComponent === 'function' && plugin.app.secretStorage) {
        secretSetting.addComponent((el) => new obsidian.SecretComponent(plugin.app, el).setValue(profile.apiKeySecret).onChange(async (value) => { profile.apiKeySecret = value; await save(); }));
      } else {
        secretSetting.setDesc(en ? 'Upgrade Obsidian to a version with SecretStorage before using an API key.' : '请先升级到支持 SecretStorage 的 Obsidian 版本，再配置 API Key。');
      }
    });
  };
  addSetting.addButton((button) => button.setButtonText(en ? 'Add' : '添加').onClick(async () => {
    if (config.profiles.length >= 20) return new obsidian.Notice(en ? 'Up to 20 model profiles are supported.' : '最多支持 20 个模型配置。');
    const preset = getAiProviderPreset(providerToAdd);
    const id = 'model-' + Date.now().toString(36);
    config.profiles.push({ id, name:preset.name + ' · ' + (preset.models[0] || AI_DEFAULTS.model), providerId:preset.id, baseUrl:preset.baseUrl, model:preset.models[0] || AI_DEFAULTS.model, apiKeySecret:'' });
    config.activeProfileId = id;
    await save(); refreshActiveDropdown(); renderCards();
  }));
  renderCards();

  new obsidian.Setting(section)
    .setName(en ? 'Note context limit' : '笔记上下文上限')
    .setDesc(en ? 'Maximum characters sent from the selected note (2,000–50,000).' : '单次最多发送的所选笔记字符数（2,000–50,000）。')
    .addText((text) => { text.inputEl.type = 'number'; text.inputEl.min = '2000'; text.inputEl.max = '50000'; text.inputEl.step = '1000'; return text.setValue(String(config.maxContextChars)).onChange(async (value) => { config.maxContextChars = Number(value); await save(); }); });
  section.createEl('p', { cls:PLUGIN_ID + '-ai-settings-footnote', text:en
    ? 'Cockpit AI remains read-only: it can summarize, extract tasks, and answer questions, but cannot write to the vault.'
    : 'Cockpit AI 仍为只读：可以总结、提取待办和回答问题，但不能写入 Vault。' });
  containerEl.createEl('hr', { cls:PLUGIN_ID + '-settings-divider' });
}
