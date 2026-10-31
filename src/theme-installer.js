// theme-installer.js — 随插件内置主题，使用库的公开文件接口安装。
const COCKPIT_GLASS_BUNDLE = '__COCKPIT_GLASS_BUNDLE__';
const cockpitThemeInstallLocks = new WeakMap();

function cockpitThemeFiles(bundle = COCKPIT_GLASS_BUNDLE) {
  if (!bundle || bundle.manifest?.name !== 'Cockpit Glass' || !/^\d+\.\d+\.\d+$/.test(bundle.manifest.version)
    || typeof bundle.css !== 'string' || !bundle.css.includes('--cg-shell')) {
    throw new Error('theme-bundle-invalid');
  }
  return { 'theme.css':bundle.css, 'manifest.json':JSON.stringify(bundle.manifest, null, 2) + '\n' };
}

function cockpitThemeDirectory(vault) {
  const configDir = String(vault?.configDir || '').replace(/\\/g, '/');
  if (!configDir || configDir.split('/').some((part) => !part || part === '.' || part === '..' || /[:\u0000-\u001f]/.test(part))) {
    throw new Error('theme-path-invalid');
  }
  return configDir + '/themes/Cockpit Glass';
}

async function cockpitReadTheme(vault, bundle = COCKPIT_GLASS_BUNDLE) {
  const files = cockpitThemeFiles(bundle);
  const directory = cockpitThemeDirectory(vault);
  const previous = {};
  for (const name of Object.keys(files)) {
    const path = directory + '/' + name;
    previous[name] = await vault.adapter.exists(path) ? await vault.adapter.read(path) : null;
  }
  let manifest = null;
  try { manifest = JSON.parse(previous['manifest.json']); } catch (_) { /* 损坏的清单也先备份。 */ }
  const current = Object.keys(files).every((name) => previous[name] === files[name]);
  const installed = Object.values(previous).some((content) => content !== null);
  const versionParts = (value) => /^\d+\.\d+\.\d+$/.test(value || '') ? value.split('.').map(Number) : [0, 0, 0];
  const oldVersion = versionParts(manifest?.version);
  const nextVersion = versionParts(bundle.manifest.version);
  let newer = false;
  for (let i = 0; i < 3; i++) {
    if (oldVersion[i] !== nextVersion[i]) { newer = oldVersion[i] > nextVersion[i]; break; }
  }
  return { directory, files, previous, manifest, state:current ? 'current' : !installed ? 'missing' : newer ? 'newer' : manifest?.version === bundle.manifest.version ? 'modified' : 'update' };
}

async function cockpitEnsureThemeDirectory(adapter, directory) {
  let current = '';
  for (const part of directory.split('/')) {
    current = current ? current + '/' + part : part;
    if (!await adapter.exists(current)) await adapter.mkdir(current);
  }
}

async function cockpitInstallTheme(vault, bundle = COCKPIT_GLASS_BUNDLE) {
  const adapter = vault.adapter;
  if (cockpitThemeInstallLocks.has(adapter)) return cockpitThemeInstallLocks.get(adapter);
  const install = (async () => {
    const snapshot = await cockpitReadTheme(vault, bundle);
    if (snapshot.state === 'current') return { ...snapshot, backupDirectory:null };
    if (snapshot.state === 'newer') throw new Error('theme-newer-installed');
    await cockpitEnsureThemeDirectory(adapter, snapshot.directory);
    let backupDirectory = null;
    if (Object.values(snapshot.previous).some((content) => content !== null)) {
      const backupRoot = snapshot.directory + '/.cockpit-backups';
      const stamp = String(Date.now());
      backupDirectory = backupRoot + '/' + stamp;
      let suffix = 0;
      while (await adapter.exists(backupDirectory)) backupDirectory = backupRoot + '/' + stamp + '-' + (++suffix);
      await cockpitEnsureThemeDirectory(adapter, backupDirectory);
      for (const [name, content] of Object.entries(snapshot.previous)) {
        if (content !== null) {
          await adapter.write(backupDirectory + '/' + name, content);
          if (await adapter.read(backupDirectory + '/' + name) !== content) throw new Error('theme-backup-verification-failed');
        }
      }
    }
    // 备份期间外部修改了主题时停止，避免覆盖编辑器或同步刚写入的内容。
    const latest = await cockpitReadTheme(vault, bundle);
    if (Object.keys(snapshot.files).some((name) => snapshot.previous[name] !== latest.previous[name])) throw new Error('theme-changed-during-install');
    const attempted = [];
    try {
      for (const [name, content] of Object.entries(snapshot.files)) {
        attempted.push(name);
        await adapter.write(snapshot.directory + '/' + name, content);
      }
      if ((await cockpitReadTheme(vault, bundle)).state !== 'current') throw new Error('theme-verification-failed');
    } catch (cause) {
      const rollbackErrors = [];
      for (const name of attempted.reverse()) {
        const path = snapshot.directory + '/' + name;
        try {
          if (snapshot.previous[name] !== null) {
            await adapter.write(path, snapshot.previous[name]);
            if (await adapter.read(path) !== snapshot.previous[name]) throw new Error('theme-restore-verification-failed');
          } else {
            if (await adapter.exists(path)) await adapter.remove(path);
            if (await adapter.exists(path)) throw new Error('theme-remove-verification-failed');
          }
        } catch (error) { rollbackErrors.push(error); }
      }
      const error = new Error(rollbackErrors.length ? 'theme-rollback-failed' : 'theme-install-failed');
      error.cause = cause;
      error.backupDirectory = backupDirectory;
      throw error;
    }
    return { state:'current', directory:snapshot.directory, backupDirectory };
  })();
  cockpitThemeInstallLocks.set(adapter, install);
  try { return await install; } finally { cockpitThemeInstallLocks.delete(adapter); }
}

async function renderCockpitThemeInstaller(container, plugin, language) {
  const en = language === 'en';
  const section = container.createDiv({ cls:PLUGIN_ID + '-theme-installer' });
  const setting = new obs.Setting(section)
    .setName('Cockpit Glass')
    .setDesc(en ? 'Install the bundled theme in this vault. No download or folder selection needed.' : '将内置主题安装到当前库，无需下载文件或选择文件夹。');
  const status = section.createDiv({ cls:PLUGIN_ID + '-theme-install-status', attr:{ role:'status', 'aria-live':'polite' } });
  const instructions = section.createDiv({ cls:PLUGIN_ID + '-theme-install-help' });
  instructions.createEl('p', { text:en
    ? 'After installation, select Cockpit Glass in Settings → Appearance → Themes, then enable Unified glass appearance below.'
    : '安装后，在“设置 → 外观 → 主题”选择 Cockpit Glass，再开启下方“一体式玻璃外观”。' });
  instructions.createEl('p', { text:obs.Platform?.isMacOS
    ? (en ? 'On Mac, enable Appearance → Translucent window for native window frost. Without it, the theme uses a soft solid background.' : 'Mac 可在“外观”开启“半透明窗口”，获得原生毛玻璃；未开启时使用柔和实色背景。')
    : (en ? 'Windows uses a soft solid background with layered cards. Desktop wallpaper transparency is not provided by this theme.' : 'Windows 使用柔和实色背景与分层卡片；此主题不提供桌面壁纸透视。') });
  let button;
  setting.addButton((control) => { button = control; control.setButtonText(en ? 'Checking…' : '检查中…').setDisabled(true); });
  const compatible = typeof obs.requireApiVersion === 'function' && obs.requireApiVersion(COCKPIT_GLASS_BUNDLE.manifest.minAppVersion);
  const refresh = async () => {
    const snapshot = await cockpitReadTheme(plugin.app.vault);
    const labels = en ? {
      missing:'Not installed', current:'Installed · matches the bundled version', update:'Theme files found · update available',
      modified:'Local changes found · reinstalling backs up existing files', newer:'A newer theme is installed · keeping your version'
    } : {
      missing:'尚未安装', current:'已安装，与内置版本一致', update:'已发现主题文件，可更新',
      modified:'检测到本地修改，重新安装前会备份', newer:'已安装更新版本，将保留现有主题'
    };
    status.textContent = 'v' + COCKPIT_GLASS_BUNDLE.manifest.version + ' · ' + labels[snapshot.state];
    button.setButtonText(snapshot.state === 'missing' ? (en ? 'Install theme' : '安装主题')
      : snapshot.state === 'modified' ? (en ? 'Back up & reinstall' : '备份并重新安装')
      : snapshot.state === 'current' || snapshot.state === 'newer' ? (en ? 'Installed' : '已安装') : (en ? 'Update theme' : '更新主题'));
    button.setDisabled(!compatible || snapshot.state === 'current' || snapshot.state === 'newer');
    if (!compatible) status.textContent = en ? 'Requires host version ' + COCKPIT_GLASS_BUNDLE.manifest.minAppVersion + ' or newer.' : '需要宿主应用 ' + COCKPIT_GLASS_BUNDLE.manifest.minAppVersion + ' 或更新版本。';
  };
  button.onClick(async () => {
    button.setDisabled(true).setButtonText(en ? 'Installing…' : '安装中…');
    status.textContent = en ? 'Installing the bundled theme…' : '正在安装内置主题…';
    try {
      const result = await cockpitInstallTheme(plugin.app.vault);
      await refresh();
      status.textContent += en ? ' · Select it in Appearance → Themes.' : ' · 请在“外观 → 主题”中选择。';
      if (result.backupDirectory) status.textContent += en ? ' Previous files were backed up.' : ' 原有文件已备份。';
      new obs.Notice(en ? 'Theme installed. Select Cockpit Glass in Appearance → Themes.' : '主题已安装，请在“外观 → 主题”选择 Cockpit Glass。');
    } catch (error) {
      console.warn('Cockpit theme installation failed', error);
      button.setDisabled(false).setButtonText(en ? 'Check & retry' : '检查并重试');
      status.textContent = error.message === 'theme-rollback-failed'
        ? (en ? 'Installation failed and some files could not be restored. Recover the previous files from the theme’s .cockpit-backups folder.' : '安装失败，部分文件未能恢复。请从主题目录的 .cockpit-backups 文件夹恢复原文件。')
        : (en ? 'Installation failed. Check folder permissions and sync activity, then retry. Existing backups are preserved.' : '安装失败，请检查文件夹权限与同步状态后重试；已有备份会保留。');
    }
  });
  try { await refresh(); } catch (error) {
    console.warn('Cockpit theme status failed', error);
    status.textContent = en ? 'Unable to read the theme folder. Check its permissions and reopen this page.' : '无法读取主题文件夹，请检查权限后重新打开此页面。';
  }
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { cockpitThemeFiles, cockpitThemeDirectory, cockpitReadTheme, cockpitInstallTheme };
}
