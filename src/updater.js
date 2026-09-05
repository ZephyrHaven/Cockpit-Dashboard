// updater.js — 后台检查、更新交互与本地安装服务。

function cockpitUpdateMessage(error, en) {
  const code = String(error?.message || error || '');
  const messages = {
    'update-assets-missing':en ? 'This release is missing main.js, styles.css, or manifest.json.' : '这个版本缺少 main.js、styles.css 或 manifest.json 附件。',
    'update-asset-size':en ? 'A release file has an invalid size.' : '更新附件大小异常，已停止安装。',
    'update-asset-url':en ? 'A release file is not hosted by the official repository.' : '更新附件不是来自当前项目的官方仓库。',
    'update-manifest-invalid':en ? 'The downloaded manifest is invalid.' : '下载的插件清单无效。',
    'update-manifest-mismatch':en ? 'The downloaded package does not match this plugin or version.' : '下载的更新包与当前插件或目标版本不匹配。',
    'update-host-version':en ? 'This update requires a newer host app version.' : '这个更新需要更高版本的宿主应用。',
    'update-main-invalid':en ? 'The downloaded main program failed validation.' : '下载的主程序未通过校验。',
    'update-styles-invalid':en ? 'The downloaded stylesheet failed validation.' : '下载的样式文件未通过校验。'
  };
  return messages[code] || (en ? 'Update failed. Your current installation was kept.' : '更新失败，当前安装已保留。');
}

class CockpitUpdater {
  constructor(plugin) { this.plugin = plugin; this.config = normalizeUpdaterConfig(null); this.checking = null; this.installing = null; this.timer = null; this.startTimer = null; }
  async loadConfig() { this.config = normalizeUpdaterConfig((await this.plugin.loadData() || {}).updater); return this.config; }
  async saveConfig(patch) {
    const next = normalizeUpdaterConfig({ ...this.config, ...patch });
    await this.plugin.mutateData((data) => { data.updater = next; }); this.config = next; return next;
  }
  async start() {
    await this.loadConfig();
    if (this.config.installedVersion === normalizeReleaseVersion(this.plugin.manifest?.version)) await this.saveConfig({ installedVersion:'' });
    const run = () => this.backgroundCheck().catch((error) => console.warn('Cockpit background update check failed', error));
    this.startTimer = window.setTimeout(run, 8000);
    this.timer = window.setInterval(run, 6 * 60 * 60 * 1000);
    this.plugin.registerInterval?.(this.timer);
  }
  stop() { window.clearTimeout(this.startTimer); window.clearInterval(this.timer); }
  async check(options = {}) {
    if (this.checking) return this.checking;
    this.checking = (async () => {
      const currentVersion = normalizeReleaseVersion(this.plugin.manifest?.version);
      let release;
      try { release = findAvailableUpdate(await loadGitHubReleaseNotes(obs.requestUrl), currentVersion); }
      catch (error) { release = await loadLatestReleaseForUpdate(obs.requestUrl); }
      await this.saveConfig({ lastCheckedAt:Date.now() });
      const available = !!release && compareReleaseVersions(release.version, currentVersion) > 0;
      return { currentVersion, release, available, installed:available && this.config.installedVersion === release.version };
    })();
    try { return await this.checking; } finally { this.checking = null; }
  }
  async backgroundCheck() {
    await this.loadConfig();
    if (!this.config.autoCheck || Date.now() - this.config.lastCheckedAt < COCKPIT_UPDATE_CHECK_INTERVAL_MS) return null;
    const result = await this.check();
    if (!result.available) return result;
    if (result.installed) return result;
    if (this.config.autoInstall) {
      await this.install(result.release);
      new obs.Notice('Cockpit v' + result.release.version + ' 已自动安装，重载应用后生效。', 10000);
      return result;
    }
    if (this.config.lastNotifiedVersion !== result.release.version) {
      await this.saveConfig({ lastNotifiedVersion:result.release.version });
      new CockpitUpdateModal(this.plugin.app, this, (await this.plugin.loadData() || {}).language).open();
    }
    return result;
  }
  async download(release, onProgress) {
    const assets = getReleaseUpdateAssets(release); const files = {}; let completed = 0;
    for (const name of COCKPIT_UPDATE_ASSETS) {
      onProgress?.(completed, COCKPIT_UPDATE_ASSETS.length, name);
      const response = await obs.requestUrl({ url:assets[name].url, method:'GET', headers:{ Accept:'application/octet-stream' } });
      if (Number(response?.status || 0) < 200 || Number(response?.status || 0) >= 300 || typeof response.text !== 'string') throw new Error('update-download-failed');
      const size = Buffer.byteLength(response.text, 'utf8');
      if (size < 1 || size > COCKPIT_UPDATE_LIMITS[name] || (Number.isSafeInteger(assets[name].size) && size !== assets[name].size)) throw new Error('update-asset-size');
      files[name] = response.text; completed++;
    }
    validateUpdatePackage(files, release.version); onProgress?.(completed, COCKPIT_UPDATE_ASSETS.length, '');
    return files;
  }
  async install(release, onProgress) {
    if (this.installing) return this.installing;
    this.installing = (async () => {
      const files = await this.download(release, onProgress);
      const manifest = JSON.parse(files['manifest.json']);
      if (typeof obs.requireApiVersion === 'function' && !obs.requireApiVersion(manifest.minAppVersion)) throw new Error('update-host-version');
      const result = await installValidatedUpdate(this.plugin, files, release.version);
      await this.saveConfig({ lastNotifiedVersion:release.version, installedVersion:release.version });
      return result;
    })();
    try { return await this.installing; } finally { this.installing = null; }
  }
  open(language) { const modal = new CockpitUpdateModal(this.plugin.app, this, language); modal.open(); return modal; }
}

class CockpitUpdateModal extends obs.Modal {
  constructor(app, updater, language) { super(app); this.updater = updater; this.language = normalizeLang(language); this.closed = false; }
  onOpen() { this.modalEl.addClass(PLUGIN_ID + '-update-modal'); this.renderChecking(); }
  renderShell(title) { this.contentEl.empty(); this.contentEl.createEl('h2', { text:title }); return this.contentEl.createDiv({ cls:PLUGIN_ID + '-update-body', attr:{role:'status','aria-live':'polite'} }); }
  async renderChecking() {
    const en = this.language === 'en'; const body = this.renderShell(en ? 'Software update' : '软件更新');
    body.createEl('p', { text:en ? 'Checking GitHub Releases…' : '正在检查 GitHub Releases…' });
    try { const result = await this.updater.check({ force:true }); if (!this.closed) this.renderResult(result); }
    catch (error) { if (!this.closed) this.renderError(error); }
  }
  renderResult(result) {
    const en = this.language === 'en'; const body = this.renderShell(en ? 'Software update' : '软件更新');
    if (result.installed) { this.renderInstalled(result.release.version); return; }
    if (!result.available) {
      body.createDiv({ cls:PLUGIN_ID + '-update-status success', text:(en ? 'You are up to date · v' : '当前已是最新版本 · v') + (result.currentVersion || 'unknown') });
      body.createEl('button', { text:en ? 'Close' : '关闭' }).onclick = () => this.close(); return;
    }
    body.createDiv({ cls:PLUGIN_ID + '-update-status available', text:(en ? 'New version available · v' : '发现新版本 · v') + result.release.version });
    body.createEl('p', { text:(en ? 'Installed: v' : '当前版本：v') + result.currentVersion + (en ? ' · The update will keep all local settings and data.' : '；更新不会覆盖本地设置和数据。') });
    const actions = body.createDiv({ cls:PLUGIN_ID + '-update-actions' });
    actions.createEl('button', { text:en ? 'Later' : '稍后' }).onclick = () => this.close();
    const notes = actions.createEl('button', { text:en ? 'Release notes' : '更新说明' });
    notes.onclick = () => new CockpitReleaseNotesModal(this.app, this.updater.plugin, this.language).open();
    const install = actions.createEl('button', { cls:'mod-cta', text:en ? 'Download and install' : '下载并安装' });
    install.onclick = async () => {
      if (!window.confirm(en ? 'Download and replace the current plugin files? A local backup will be kept.' : '下载并替换当前插件文件？安装前会在本地保留备份。')) return;
      install.disabled = true; notes.disabled = true;
      const progress = body.createEl('p', { cls:PLUGIN_ID + '-update-progress' });
      try {
        await this.updater.install(result.release, (done, total, name) => progress.setText((en ? 'Downloading ' : '正在下载 ') + (name || '') + ' · ' + done + '/' + total));
        if (!this.closed) this.renderInstalled(result.release.version);
      } catch (error) { if (!this.closed) { progress.setText(cockpitUpdateMessage(error, en)); install.disabled = false; notes.disabled = false; } }
    };
  }
  renderInstalled(version) {
    const en = this.language === 'en'; const body = this.renderShell(en ? 'Update installed' : '更新已安装');
    body.createDiv({ cls:PLUGIN_ID + '-update-status success', text:(en ? 'Cockpit v' : 'Cockpit v') + version + (en ? ' is ready.' : ' 已准备就绪。') });
    body.createEl('p', { text:en ? 'Reload the app to activate the new version. Your settings were preserved.' : '重载应用后启用新版本；所有设置均已保留。' });
    const actions = body.createDiv({ cls:PLUGIN_ID + '-update-actions' });
    actions.createEl('button', { text:en ? 'Later' : '稍后' }).onclick = () => this.close();
    actions.createEl('button', { cls:'mod-cta', text:en ? 'Reload now' : '立即重载' }).onclick = () => window.location.reload();
  }
  renderError(error) { const en = this.language === 'en'; const body = this.renderShell(en ? 'Software update' : '软件更新'); body.createDiv({ cls:PLUGIN_ID + '-update-status error', text:cockpitUpdateMessage(error, en) }); body.createEl('button', { text:en ? 'Retry' : '重试' }).onclick = () => this.renderChecking(); }
  onClose() { this.closed = true; this.contentEl.empty(); }
}

async function renderUpdaterSettings(container, plugin, language) {
  const en = language === 'en'; const updater = plugin.updater;
  container.createEl('h2', { text:en ? 'Software update' : '软件更新' });
  container.createEl('p', { text:en ? 'Updates come from this project’s GitHub Releases. Local settings and data are not replaced.' : '更新包来自当前项目的 GitHub Releases，本地设置与数据不会被覆盖。' });
  if (!updater) { container.createEl('p', { text:en ? 'The update service is unavailable.' : '更新服务不可用。' }); return; }
  const config = await updater.loadConfig();
  new obs.Setting(container).setName(en ? 'Check automatically' : '自动检查更新').setDesc(en ? 'Check once every 24 hours while the app is running.' : '应用运行期间每 24 小时检查一次。').addToggle((toggle) => toggle.setValue(config.autoCheck).onChange((value) => updater.saveConfig({ autoCheck:value })));
  new obs.Setting(container).setName(en ? 'Install automatically' : '自动下载并安装').setDesc(en ? 'When enabled, validated update files are installed in the background. Reload is still required.' : '开启后，校验通过的更新包会在后台自动安装；仍需重载应用后生效。').addToggle((toggle) => toggle.setValue(config.autoInstall).onChange((value) => updater.saveConfig({ autoInstall:value })));
  new obs.Setting(container).setName(en ? 'Current version' : '当前版本').setDesc('v' + normalizeReleaseVersion(plugin.manifest?.version)).addButton((button) => button.setButtonText(en ? 'Check now' : '立即检查').setCta().onClick(() => updater.open(language)));
  container.createEl('p', { cls:'cockpit-lan-muted', text:en ? 'Installation validates the plugin ID, target version, file names, download origin, sizes, and basic contents. A local rollback backup is kept.' : '安装前会校验插件 ID、目标版本、文件名、下载来源、体积和基本内容，并保留本地回滚备份。' });
}
