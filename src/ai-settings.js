// ai-settings.js — AI 模型配置页。

async function renderAiSettings(containerEl, plugin, language) {
  const en = language === 'en';
  const config = await plugin.ai.getConfig();
  const section = containerEl.createDiv({ cls:PLUGIN_ID + '-ai-settings' });
  section.createEl('h2', { text:'Cockpit AI' });
  section.createEl('p', { text:en
    ? 'Configure several OpenAI-compatible model profiles and switch between them in the AI sidebar. Requests go directly to the selected provider.'
    : '可配置多个 OpenAI 兼容模型，并在 AI 侧栏直接切换。请求会直达所选模型服务，不经过 Cockpit 中转。' });
  const save = async () => { await plugin.ai.saveConfig(config); };
  const activeSetting = new obsidian.Setting(section).setName(en ? 'Active model' : '当前模型').setDesc(en ? 'The default profile used by the AI sidebar.' : 'AI 侧栏默认使用的模型配置。');
  let activeDropdown = null;
  const refreshActiveDropdown = () => {
    if (!activeDropdown) return;
    activeDropdown.selectEl.empty(); config.profiles.forEach((profile) => activeDropdown.addOption(profile.id, profile.name || profile.model)); activeDropdown.setValue(config.activeProfileId);
  };
  activeSetting.addDropdown((dropdown) => {
    activeDropdown = dropdown; config.profiles.forEach((profile) => dropdown.addOption(profile.id, profile.name || profile.model));
    dropdown.setValue(config.activeProfileId).onChange(async (value) => { config.activeProfileId = value; await save(); });
  });
  const addSetting = new obsidian.Setting(section).setName(en ? 'Add provider' : '添加模型服务')
    .setDesc(en ? 'Presets remain editable, so newer model IDs and compatible gateways also work.' : '预设地址和模型名都可编辑，后续新模型或兼容网关也能接入。');
  let providerToAdd = 'deepseek';
  addSetting.addDropdown((dropdown) => { AI_PROVIDER_PRESETS.forEach((provider) => dropdown.addOption(provider.id, provider.name)); dropdown.setValue(providerToAdd).onChange((value) => { providerToAdd = value; }); });
  const cards = section.createDiv({ cls:PLUGIN_ID + '-ai-profile-list' });
  const renderCards = () => {
    cards.empty();
    config.profiles.forEach((profile, index) => {
      const preset = getAiProviderPreset(profile.providerId);
      const card = cards.createDiv({ cls:PLUGIN_ID + '-ai-profile-card' });
      const heading = card.createDiv({ cls:PLUGIN_ID + '-ai-profile-heading' }); heading.createEl('strong', { text:profile.name || profile.model });
      const headingActions = heading.createDiv({ cls:PLUGIN_ID + '-ai-profile-actions' });
      const test = headingActions.createEl('button', { cls:PLUGIN_ID + '-ai-profile-test', attr:{ type:'button', 'aria-label':en ? 'Test this model profile' : '测试这个模型配置' } });
      obsidian.setIcon(test, 'plug-zap'); test.createSpan({ text:en ? 'Test' : '测试' });
      test.onclick = async () => {
        test.disabled = true;
        try { await save(); await plugin.ai.testProfile(profile.id, language); new obsidian.Notice(en ? 'This model connection is working.' : '这个模型连接正常'); }
        catch (error) { new obsidian.Notice((en ? 'Model connection failed: ' : '模型连接失败：') + (error?.message || 'unknown error')); }
        finally { test.disabled = false; }
      };
      if (config.profiles.length > 1) {
        const remove = headingActions.createEl('button', { cls:PLUGIN_ID + '-ai-profile-remove', attr:{ type:'button', 'aria-label':en ? 'Remove profile' : '删除配置' } }); obsidian.setIcon(remove, 'trash-2');
        remove.onclick = async () => { config.profiles.splice(index, 1); if (config.activeProfileId === profile.id) config.activeProfileId = config.profiles[0].id; await save(); refreshActiveDropdown(); renderCards(); };
      }
      new obsidian.Setting(card).setName(en ? 'Display name' : '显示名称').addText((text) => text.setValue(profile.name).onChange(async (value) => { profile.name = value; await save(); refreshActiveDropdown(); }));
      new obsidian.Setting(card).setName(en ? 'Provider preset' : '服务商预设').addDropdown((dropdown) => {
        AI_PROVIDER_PRESETS.forEach((provider) => dropdown.addOption(provider.id, provider.name));
        dropdown.setValue(profile.providerId).onChange(async (value) => { const next = getAiProviderPreset(value); profile.providerId = value; profile.baseUrl = next.baseUrl; profile.model = next.models[0] || profile.model; await save(); renderCards(); });
      });
      new obsidian.Setting(card).setName(en ? 'API base URL' : 'API 基础地址').setDesc(en ? 'Remote URLs require HTTPS; localhost may use HTTP.' : '远程地址必须使用 HTTPS；本机服务可使用 HTTP。')
        .addText((text) => text.setPlaceholder(preset.baseUrl).setValue(profile.baseUrl).onChange(async (value) => { profile.baseUrl = value; await save(); }));
      new obsidian.Setting(card).setName(en ? 'Model ID' : '模型 ID').setDesc(preset.models.length ? (en ? 'Examples: ' : '示例：') + preset.models.join('、') : (en ? 'Enter the model identifier from your provider.' : '填写服务商给出的模型标识。'))
        .addText((text) => text.setValue(profile.model).onChange(async (value) => { profile.model = value; await save(); }));
      const secretSetting = new obsidian.Setting(card).setName(en ? 'API key' : 'API Key').setDesc(en ? 'Stored by Obsidian SecretStorage; only the secret name is kept in Cockpit data.' : '由 Obsidian SecretStorage 保管；Cockpit 数据中只保存密钥名称。');
      if (obsidian.SecretComponent && typeof secretSetting.addComponent === 'function' && plugin.app.secretStorage) {
        secretSetting.addComponent((el) => new obsidian.SecretComponent(plugin.app, el).setValue(profile.apiKeySecret).onChange(async (value) => { profile.apiKeySecret = value; await save(); }));
      } else secretSetting.setDesc(en ? 'Upgrade Obsidian to a version with SecretStorage before using an API key.' : '请先升级到支持 SecretStorage 的 Obsidian 版本，再配置 API Key。');
    });
  };
  addSetting.addButton((button) => button.setButtonText(en ? 'Add' : '添加').onClick(async () => {
    if (config.profiles.length >= 20) return new obsidian.Notice(en ? 'Up to 20 model profiles are supported.' : '最多支持 20 个模型配置。');
    const preset = getAiProviderPreset(providerToAdd); const id = 'model-' + Date.now().toString(36);
    config.profiles.push({ id, name:preset.name + ' · ' + (preset.models[0] || AI_DEFAULTS.model), providerId:preset.id, baseUrl:preset.baseUrl, model:preset.models[0] || AI_DEFAULTS.model, apiKeySecret:'' });
    config.activeProfileId = id; await save(); refreshActiveDropdown(); renderCards();
  }));
  renderCards();
  new obsidian.Setting(section).setName(en ? 'Note context limit' : '笔记上下文上限').setDesc(en ? 'Maximum characters sent from selected notes or local RAG (2,000–50,000).' : '所选笔记或本地 RAG 单次最多发送的字符数（2,000–50,000）。')
    .addText((text) => { text.inputEl.type = 'number'; text.inputEl.min = '2000'; text.inputEl.max = '50000'; text.inputEl.step = '1000'; return text.setValue(String(config.maxContextChars)).onChange(async (value) => { config.maxContextChars = Number(value); await save(); }); });
  section.createEl('p', { cls:PLUGIN_ID + '-ai-settings-footnote', text:en
    ? 'Conversation history is stored separately in plugin-private ai-history.json. It excludes attachments, retrieved note excerpts, reasoning, and tool arguments.'
    : '会话历史单独保存在插件私有的 ai-history.json 中，不保存附件、检索到的笔记片段、思考过程或工具参数。' });
  section.createEl('p', { cls:PLUGIN_ID + '-ai-settings-footnote', text:en
    ? 'Agent tools can list tasks and search notes. Creating or completing a task always requires confirmation. Plugin source, Obsidian configuration, Shell, and arbitrary file writes are never exposed.'
    : 'Agent 工具可以读取待办和搜索笔记；创建或完成待办始终需要确认。插件源码、Obsidian 配置、Shell 与任意文件写入永远不会开放。' });
  containerEl.createEl('hr', { cls:PLUGIN_ID + '-settings-divider' });
}
