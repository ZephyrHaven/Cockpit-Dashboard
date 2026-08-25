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
  const activeSetting = new obs.Setting(section).setName(en ? 'Active model' : '当前模型').setDesc(en ? 'The default profile used by the AI sidebar.' : 'AI 侧栏默认使用的模型配置。');
  let activeDropdown = null;
  const refreshActiveDropdown = () => {
    if (!activeDropdown) return;
    activeDropdown.selectEl.empty(); config.profiles.forEach((profile) => activeDropdown.addOption(profile.id, profile.name || profile.model)); activeDropdown.setValue(config.activeProfileId);
  };
  activeSetting.addDropdown((dropdown) => {
    activeDropdown = dropdown; config.profiles.forEach((profile) => dropdown.addOption(profile.id, profile.name || profile.model));
    dropdown.setValue(config.activeProfileId).onChange(async (value) => { config.activeProfileId = value; await save(); });
  });
  const addSetting = new obs.Setting(section).setName(en ? 'Add provider' : '添加模型服务')
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
      obs.setIcon(test, 'plug-zap'); test.createSpan({ text:en ? 'Test' : '测试' });
      test.onclick = async () => {
        test.disabled = true;
        try { await save(); await plugin.ai.testProfile(profile.id, language); new obs.Notice(en ? 'This model connection is working.' : '这个模型连接正常'); }
        catch (error) { new obs.Notice((en ? 'Model connection failed: ' : '模型连接失败：') + (error?.message || 'unknown error')); }
        finally { test.disabled = false; }
      };
      if (config.profiles.length > 1) {
        const remove = headingActions.createEl('button', { cls:PLUGIN_ID + '-ai-profile-remove', attr:{ type:'button', 'aria-label':en ? 'Remove profile' : '删除配置' } }); obs.setIcon(remove, 'trash-2');
        remove.onclick = async () => { config.profiles.splice(index, 1); if (config.activeProfileId === profile.id) config.activeProfileId = config.profiles[0].id; await save(); refreshActiveDropdown(); renderCards(); };
      }
      new obs.Setting(card).setName(en ? 'Display name' : '显示名称').addText((text) => text.setValue(profile.name).onChange(async (value) => { profile.name = value; await save(); refreshActiveDropdown(); }));
      new obs.Setting(card).setName(en ? 'Provider preset' : '服务商预设').addDropdown((dropdown) => {
        AI_PROVIDER_PRESETS.forEach((provider) => dropdown.addOption(provider.id, provider.name));
        dropdown.setValue(profile.providerId).onChange(async (value) => { const next = getAiProviderPreset(value); profile.providerId = value; profile.baseUrl = next.baseUrl; profile.model = next.models[0] || profile.model; await save(); renderCards(); });
      });
      new obs.Setting(card).setName(en ? 'API base URL' : 'API 基础地址').setDesc(en ? 'Remote URLs require HTTPS; localhost may use HTTP.' : '远程地址必须使用 HTTPS；本机服务可使用 HTTP。')
        .addText((text) => text.setPlaceholder(preset.baseUrl).setValue(profile.baseUrl).onChange(async (value) => { profile.baseUrl = value; await save(); }));
      new obs.Setting(card).setName(en ? 'Model ID' : '模型 ID').setDesc(preset.models.length ? (en ? 'Examples: ' : '示例：') + preset.models.join('、') : (en ? 'Enter the model identifier from your provider.' : '填写服务商给出的模型标识。'))
        .addText((text) => text.setValue(profile.model).onChange(async (value) => { profile.model = value; await save(); }));
      const secretSetting = new obs.Setting(card).setName(en ? 'API key' : 'API Key').setDesc(en ? 'Stored in plain text inside this vault\'s data.json. Avoid shared devices.' : '明文保存在本库的 data.json 中，请勿在共享设备上使用。');
      secretSetting.addText((text) => {
        text.inputEl.type = 'password';
        text.setPlaceholder('sk-…').setValue(profile.apiKey || '').onChange(async (value) => { profile.apiKey = String(value || '').trim(); profile.apiKeySecret = ''; await save(); });
      });
    });
  };
  addSetting.addButton((button) => button.setButtonText(en ? 'Add' : '添加').onClick(async () => {
    if (config.profiles.length >= 20) return new obs.Notice(en ? 'Up to 20 model profiles are supported.' : '最多支持 20 个模型配置。');
    const preset = getAiProviderPreset(providerToAdd); const id = 'model-' + Date.now().toString(36);
    config.profiles.push({ id, name:preset.name + ' · ' + (preset.models[0] || AI_DEFAULTS.model), providerId:preset.id, baseUrl:preset.baseUrl, model:preset.models[0] || AI_DEFAULTS.model, apiKey:'', apiKeySecret:'' });
    config.activeProfileId = id; await save(); refreshActiveDropdown(); renderCards();
  }));
  renderCards();
  // Agent 编码工作区：绝对路径沙箱；留空关闭。仅桌面端（需要 Node 文件能力）生效。
  let workspaceInputEl = null;
  const setWorkspaceValue = async (value) => {
    config.workspaceRoot = String(value ?? '');
    await save();
    if (workspaceInputEl) workspaceInputEl.value = config.workspaceRoot;
    new obs.Notice(config.workspaceRoot
      ? ((language === 'en' ? 'Workspace switched to ' : '工作区已切换到 ') + config.workspaceRoot)
      : (language === 'en' ? 'Coding workspace cleared.' : '已清除编码工作区。'));
  };
  const workspaceSetting = new obs.Setting(section).setName(en ? 'Coding workspace' : 'Agent 工作区')
    .setDesc(en
      ? 'Default folder the Agent may work in ("~" allowed). You can switch it anytime from the workspace chip in the AI sidebar; leave empty to disable. Desktop app only.'
      : 'Agent 工作区的默认文件夹（支持 ~）。可随时在 AI 侧栏的工作区徽标里直接切换；留空关闭。仅桌面端可用。');
  workspaceSetting.addText((text) => {
    text.setPlaceholder(en ? '/path/to/project or pick a folder' : '/path/to/project 或点右侧图标选择')
      .setValue(String(config.workspaceRoot || ''))
      .onChange(async (value) => { config.workspaceRoot = value; await save(); });
    text.inputEl.setAttribute('spellcheck', 'false');
    workspaceInputEl = text.inputEl;
    return text;
  }).addExtraButton((button) => button
    .setIcon('folder-open')
    .setTooltip(en ? 'Pick a folder' : '选择文件夹')
    .onClick(async () => {
      try {
        if (typeof plugin.agentTools?.pickFolder !== 'function') {
          new obs.Notice(en ? 'Picking a folder needs the desktop app.' : '选择文件夹需要桌面端。');
          return;
        }
        const verdict = await plugin.agentTools.pickFolder();
        if (verdict?.ok && verdict.root) await setWorkspaceValue(verdict.root);
        else if (!verdict || verdict.reason === 'unsupported') new obs.Notice(en ? 'No folder picker available here; paste an absolute path instead.' : '此环境无法打开文件夹选择器，请直接粘贴绝对路径。');
      } catch (error) { new obs.Notice((en ? 'Could not open the folder picker: ' : '无法打开文件夹选择器：') + (error?.message || 'unknown')); }
    }))
  .addExtraButton((button) => button
    .setIcon('trash-2')
    .setTooltip(en ? 'Clear workspace' : '清空工作区')
    .onClick(() => setWorkspaceValue('')));
  new obs.Setting(section).setName(en ? 'Note context limit' : '笔记上下文上限').setDesc(en ? 'Maximum characters sent from selected notes or local RAG (2,000–50,000).' : '所选笔记或本地 RAG 单次最多发送的字符数（2,000–50,000）。')
    .addText((text) => { text.inputEl.type = 'number'; text.inputEl.min = '2000'; text.inputEl.max = '50000'; text.inputEl.step = '1000'; return text.setValue(String(config.maxContextChars)).onChange(async (value) => { config.maxContextChars = Number(value); await save(); }); });
  section.createEl('p', { cls:PLUGIN_ID + '-ai-settings-footnote', text:en
    ? 'Conversation history is stored separately in plugin-private ai-history.json. It excludes attachments, retrieved note excerpts, reasoning, and tool arguments.'
    : '会话历史单独保存在插件私有的 ai-history.json 中，不保存附件、检索到的笔记片段、思考过程或工具参数。' });
  section.createEl('p', { cls:PLUGIN_ID + '-ai-settings-footnote', text:en
    ? 'Agent tools can list tasks and search notes. Creating or completing a task always requires confirmation.'
    : 'Agent 工具可以读取待办和搜索笔记；创建或完成待办始终需要确认。' });
  section.createEl('p', { cls:PLUGIN_ID + '-ai-settings-footnote', text:en
    ? 'When a coding workspace is set, the Agent additionally gets sandboxed file tools (list/read/write/edit/search) and command execution inside that folder only. Writes and commands follow the permission mode chosen in the sidebar; paths outside the folder and privilege elevation are always refused.'
    : '设置工作区后，Agent 会额外获得沙箱化的文件工具（浏览/读取/写入/编辑/搜索）与命令执行能力，且只能在该文件夹内活动。写操作与命令遵循侧栏选择的权限模式；目录之外的路径与提权命令永远被拒绝。' });
  containerEl.createEl('hr', { cls:PLUGIN_ID + '-settings-divider' });
}
