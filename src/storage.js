// storage.js — Storage V2：非破坏迁移、兼容读取、导入导出与旧文件清理

const COCKPIT_STORAGE_VERSION = 2;
const LEGACY_STORAGE_FILES = [BOOKMARK_FILE, '_data/toolbar.md', '_data/toolbar-runs.md'];

function parseToolbarConfig(content) {
  const commands = {};
  const sections = String(content || '').split(/^\[(.+?)\]/m);
  for (let i = 1; i < sections.length; i += 2) {
    const name = sections[i].trim();
    const body = sections[i + 1] || '';
    const values = {};
    body.split('\n').forEach((line) => {
      const match = line.match(/^\s*(\S+)\s*=\s*(.*)/);
      if (match) values[match[1]] = match[2].trim();
    });
    if (name) commands[name] = values;
  }
  return commands;
}

function normalizeToolbarCommands(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  Object.entries(raw).slice(0, 30).forEach(([name, values]) => {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return;
    const safeName = String(name).trim().slice(0, 64);
    if (!safeName || ['__proto__','prototype','constructor'].includes(safeName)) return;
    const next = {};
    Object.entries(values).slice(0, 20).forEach(([key, value]) => {
      const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      if (safeKey && !['__proto__','prototype','constructor'].includes(safeKey)) next[safeKey] = String(value ?? '').slice(0, 8000);
    });
    result[safeName] = next;
  });
  return result;
}

function serializeToolbarConfig(commands) {
  return '# Toolbar 自定义命令配置\n# 迁移完成前，此文件仍是命令配置来源。\n\n' + Object.entries(normalizeToolbarCommands(commands)).map(([name, values]) => {
    return '[' + name + ']\n' + Object.entries(values).map(([key, value]) => key + ' = ' + value).join('\n');
  }).join('\n\n') + '\n';
}

class CockpitStorage {
  constructor(plugin, app) { this.plugin = plugin; this.app = app; }

  async _readData() { return await this.plugin.loadData() || {}; }

  async initialize(defaultToolbarCommands) {
    let data = await this._readData();
    if (typeof data.storageMigrationCompleted !== 'boolean') {
      data = await this.plugin.mutateData((latest) => {
        if (typeof latest.storageMigrationCompleted === 'boolean') return;
        const hasLegacyStorage = !!this.app.vault.getAbstractFileByPath(BOOKMARK_FILE)
          || !!this.app.vault.getAbstractFileByPath('_data/toolbar.md');
        latest.storageMigrationCompleted = !hasLegacyStorage;
        latest.storageVersion = hasLegacyStorage ? (latest.storageVersion || 1) : COCKPIT_STORAGE_VERSION;
        if (hasLegacyStorage) latest.storageMigration = { ...(latest.storageMigration || {}), offeredAt:new Date().toISOString() };
        else latest.toolbarCommands = Object.keys(normalizeToolbarCommands(latest.toolbarCommands)).length
          ? normalizeToolbarCommands(latest.toolbarCommands)
          : normalizeToolbarCommands(defaultToolbarCommands);
      });
    }
    return data;
  }

  async isMigrationCompleted() { return (await this._readData()).storageMigrationCompleted === true; }

  async migrate(defaultToolbarCommands) {
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) return data;
    const legacyBookmarks = await loadBookmarks(this.app.vault);
    const legacyToolbar = this.app.vault.getAbstractFileByPath('_data/toolbar.md');
    let commands = {};
    if (legacyToolbar) {
      try { commands = normalizeToolbarCommands(parseToolbarConfig(await this.app.vault.read(legacyToolbar))); } catch (e) {}
    }
    return await this.plugin.mutateData((latest) => {
      if (latest.storageMigrationCompleted === true) return;
      // 兼容上一版曾经预复制但未正式完成迁移的用户：旧文件优先，缺失时保留 data.json 中已有副本。
      latest.bookmarks = legacyBookmarks.size ? Array.from(legacyBookmarks) : (Array.isArray(latest.bookmarks) ? latest.bookmarks : []);
      latest.toolbarCommands = Object.keys(commands).length ? commands : (Object.keys(normalizeToolbarCommands(latest.toolbarCommands)).length ? normalizeToolbarCommands(latest.toolbarCommands) : normalizeToolbarCommands(defaultToolbarCommands));
      latest.storageVersion = COCKPIT_STORAGE_VERSION;
      latest.storageMigration = { ...(latest.storageMigration || {}), completedAt:new Date().toISOString(), source:'legacy-copy' };
      // 完成标记最后写入；此前任何异常都会保持旧存储模式。
      latest.storageMigrationCompleted = true;
    });
  }

  async loadBookmarks() {
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) return Array.isArray(data.bookmarks) ? data.bookmarks.map(String).filter(Boolean) : [];
    return Array.from(await loadBookmarks(this.app.vault));
  }

  async saveBookmarks(bookmarks) {
    const data = await this._readData();
    const values = Array.from(bookmarks || []).map(String).filter(Boolean);
    if (data.storageMigrationCompleted === true) {
      await this.plugin.mutateData((latest) => {
        latest.bookmarks = values;
        latest.storageVersion = COCKPIT_STORAGE_VERSION;
      });
    } else {
      await saveBookmarks(this.app.vault, new Set(values));
    }
  }

  async loadToolbarCommands(defaults) {
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) {
      const commands = normalizeToolbarCommands(data.toolbarCommands);
      return Object.keys(commands).length ? commands : normalizeToolbarCommands(defaults);
    }
    const legacy = this.app.vault.getAbstractFileByPath('_data/toolbar.md');
    if (legacy) {
      try {
        const commands = normalizeToolbarCommands(parseToolbarConfig(await this.app.vault.read(legacy)));
        if (Object.keys(commands).length) return commands;
      } catch (e) {}
    }
    return normalizeToolbarCommands(defaults);
  }

  async saveToolbarCommands(commands) {
    const normalized = normalizeToolbarCommands(commands);
    const data = await this._readData();
    if (data.storageMigrationCompleted === true) {
      await this.plugin.mutateData((latest) => {
        latest.toolbarCommands = normalized;
        latest.storageVersion = COCKPIT_STORAGE_VERSION;
      });
      return;
    }
    const file = this.app.vault.getAbstractFileByPath('_data/toolbar.md');
    if (file) {
      await this.app.vault.modify(file, serializeToolbarConfig(normalized));
      return;
    }
    // 新环境不再创建 _data/toolbar.md；旧文件不存在时直接使用私有 data.json。
    await this.plugin.mutateData((latest) => {
      latest.toolbarCommands = normalized;
      latest.storageVersion = COCKPIT_STORAGE_VERSION;
      latest.storageMigrationCompleted = true;
    });
  }

  async exportData() {
    const data = await this._readData();
    return {
      format: 'cockpit-storage-v2',
      exportedAt: new Date().toISOString(),
      data: {
        bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
        toolbarCommands: normalizeToolbarCommands(data.toolbarCommands),
        customToolbarButtons: Array.isArray(data.customToolbarButtons) ? data.customToolbarButtons : [],
        toolbarOrder: Array.isArray(data.toolbarOrder) ? data.toolbarOrder : [],
        bookmarkOrder: Array.isArray(data.bookmarkOrder) ? data.bookmarkOrder : [],
        pomodoroTaskStats: normalizePomodoroTaskStats(data.pomodoroTaskStats),
        username: data.username || '', language: data.language || DEFAULT_LANG,
        collapsed: data.collapsed || {}, moduleOrder: data.moduleOrder || [],
        hiddenModules: data.hiddenModules || [], hiddenToolbarActions: data.hiddenToolbarActions || [],
        deletedToolbarActions: data.deletedToolbarActions || []
      }
    };
  }

  async importData(payload) {
    if (!payload || payload.format !== 'cockpit-storage-v2' || !payload.data || typeof payload.data !== 'object') {
      throw new Error('invalid-format');
    }
    const incoming = payload.data;
    await this.plugin.mutateData((data) => {
      if (Array.isArray(incoming.bookmarks)) data.bookmarks = incoming.bookmarks.map(String).filter(Boolean).slice(0, 5000);
      if (incoming.toolbarCommands) data.toolbarCommands = normalizeToolbarCommands(incoming.toolbarCommands);
      if (Array.isArray(incoming.customToolbarButtons)) data.customToolbarButtons = normalizeCustomToolbarButtons(incoming.customToolbarButtons);
      if (incoming.pomodoroTaskStats && typeof incoming.pomodoroTaskStats === 'object') data.pomodoroTaskStats = normalizePomodoroTaskStats(incoming.pomodoroTaskStats);
      ['bookmarkOrder','toolbarOrder','moduleOrder','hiddenModules','hiddenToolbarActions','deletedToolbarActions'].forEach((key) => {
        if (Array.isArray(incoming[key])) data[key] = incoming[key].map(String).slice(0, 5000);
      });
      if (incoming.collapsed && typeof incoming.collapsed === 'object' && !Array.isArray(incoming.collapsed)) {
        data.collapsed = {};
        Object.entries(incoming.collapsed).slice(0, 100).forEach(([key, value]) => {
          const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
          if (safeKey && !['__proto__','prototype','constructor'].includes(safeKey)) data.collapsed[safeKey] = !!value;
        });
      }
      if (typeof incoming.username === 'string') data.username = incoming.username.slice(0, 80);
      if (typeof incoming.language === 'string') data.language = normalizeLang(incoming.language);
      data.storageVersion = COCKPIT_STORAGE_VERSION;
      data.storageMigrationCompleted = true;
      data.storageMigration = { ...(data.storageMigration || {}), importedAt: new Date().toISOString(), completedAt:new Date().toISOString(), source:'import' };
    });
  }

  async cleanupLegacy() {
    const removed = [];
    await this.plugin.mutateData(async (data) => {
      if (data.storageMigrationCompleted !== true) throw new Error('migration-incomplete');
      for (const path of LEGACY_STORAGE_FILES) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file) continue;
        await this.app.vault.delete(file);
        removed.push(path);
      }
      data.storageMigration = { ...data.storageMigration, legacyCleanedAt: new Date().toISOString(), removedLegacyFiles: removed };
    });
    return removed;
  }

  async status() {
    const data = await this._readData();
    return {
      version: data.storageVersion || 1,
      migrated: data.storageMigrationCompleted === true,
      copiedAt: data.storageMigration?.completedAt || null,
      legacyFiles: LEGACY_STORAGE_FILES.filter((path) => !!this.app.vault.getAbstractFileByPath(path))
    };
  }
}

function openStorageMigration(view) {
  const en = view._lang() === 'en';
  const PID = PLUGIN_ID;
  const overlay = document.createElement('div');
  overlay.className = PID + '-storage-backdrop';
  const panel = overlay.createDiv({ cls: PID + '-storage-manager' });
  overlay.onclick = (evt) => { if (evt.target === overlay) overlay.remove(); };
  panel.onclick = (evt) => evt.stopPropagation();
  const head = panel.createDiv({ cls: PID + '-storage-head' });
  head.createDiv({ cls: PID + '-storage-title', text: en ? 'Data migration' : '数据迁移' });
  const close = head.createEl('button', { cls: PID + '-storage-close', attr:{type:'button'} });
  obsidian.setIcon(close, 'x'); close.onclick = () => overlay.remove();
  makeCockpitDialogDraggable(panel, head, { label:en ? 'Drag data migration window' : '拖动数据迁移窗口' });
  const hero = panel.createDiv({ cls:PID + '-storage-guide' });
  const badge = hero.createDiv({ cls:PID + '-storage-badge', text:en?'Checking…':'正在检查…' });
  hero.createDiv({ cls:PID + '-storage-guide-title', text:en?'Move internal settings out of visible _data files':'把内部设置从可见的 _data 文件迁移出去' });
  hero.createDiv({ cls:PID + '-storage-guide-copy', text:en?'Migration copies bookmarks and Toolbar configuration into the plugin’s private data.json. Todos and focus history remain readable Markdown. Nothing is deleted automatically.':'迁移会把收藏和 Toolbar 配置复制到插件私有的 data.json。待办和专注历史仍保留为可读 Markdown，任何旧文件都不会被自动删除。' });
  const steps = panel.createDiv({ cls:PID + '-storage-steps' });
  [
    en?'1. Check the existing bookmark and Toolbar files.':'1. 检查现有收藏和 Toolbar 配置文件。',
    en?'2. Copy their current contents into Storage V2.':'2. 把当前内容安全复制到 Storage V2。',
    en?'3. Set storageMigrationCompleted = true only after the copy succeeds.':'3. 只有复制成功后才写入 storageMigrationCompleted = true。',
    en?'4. Future writes use the new storage; old files remain as a backup until you choose cleanup.':'4. 后续只写新存储；旧文件继续作为备份，直到你主动清理。'
  ].forEach((text) => steps.createDiv({ cls:PID + '-storage-step', text }));
  const statusEl = panel.createDiv({ cls: PID + '-storage-status', text: en ? 'Loading migration status…' : '正在读取迁移状态…' });
  const warning = panel.createDiv({ cls: PID + '-storage-warning', text: en ? 'Safe by default: migration copies data and never removes todos, focus history, or old files.' : '默认安全：迁移只复制数据，不会删除待办、专注历史或任何旧文件。' });
  const actions = panel.createDiv({ cls: PID + '-storage-actions' });
  const migrateBtn = actions.createEl('button', { cls:PID + '-storage-migrate-btn', text: en ? 'Start safe migration' : '开始安全迁移', attr:{type:'button'} });
  const exportBtn = actions.createEl('button', { text: en ? 'Copy export JSON' : '复制导出 JSON', attr:{type:'button'} });
  const cleanupBtn = actions.createEl('button', { text: en ? 'Clean migrated legacy files' : '清理已迁移旧文件', attr:{type:'button'} });
  const advanced = panel.createEl('details', { cls:PID + '-storage-advanced' });
  advanced.createEl('summary', { text:en?'Advanced: import or inspect JSON':'高级选项：导入或检查 JSON' });
  advanced.createDiv({ cls:PID + '-storage-advanced-copy', text:en?'Only use import with a Cockpit Storage V2 export you trust. Exported custom scripts are plain text.':'只导入你信任的 Cockpit Storage V2 备份；导出的自定义脚本是明文内容。' });
  const input = advanced.createEl('textarea', { cls: PID + '-storage-import', attr:{rows:'9',placeholder:en?'Paste cockpit-storage-v2 JSON here':'在这里粘贴 cockpit-storage-v2 JSON'} });
  const importBtn = advanced.createEl('button', { cls: PID + '-storage-import-btn', text: en ? 'Import JSON' : '导入 JSON', attr:{type:'button'} });
  const message = panel.createDiv({ cls: PID + '-storage-message' });
  const refreshStatus = async () => {
    const status = await view._storage.status();
    badge.textContent = status.migrated ? (en?'✓ Migration complete':'✓ 已完成迁移') : (en?'Migration not started':'尚未完成迁移');
    badge.classList.toggle('complete', status.migrated);
    statusEl.textContent = status.migrated
      ? (en?'Storage V2 is active. New bookmark and Toolbar writes now go only to data.json.':'Storage V2 已启用，新的收藏和 Toolbar 配置只会写入 data.json。')
      : (en?'Legacy mode is active. Bookmarks and Toolbar configuration still read and write the old _data files.':'当前仍是旧版存储模式，收藏和 Toolbar 配置继续读写原来的 _data 文件。');
    migrateBtn.disabled = status.migrated;
    migrateBtn.textContent = status.migrated ? (en?'Migration completed':'迁移已完成') : (en?'Start safe migration':'开始安全迁移');
    cleanupBtn.disabled = !status.migrated;
  };
  migrateBtn.onclick = async () => {
    if (!window.confirm(en?'Start migration now? Existing files will be copied and kept unchanged.':'现在开始迁移？现有文件只会被复制，并保持原样。')) return;
    migrateBtn.disabled = true;
    message.textContent = en?'Copying current data…':'正在复制当前数据…';
    try {
      await view._storage.migrate(view._defaultToolbarCommands());
      message.textContent = en?'Migration completed. Reloading the dashboard…':'迁移完成，正在刷新驾驶舱…';
      await refreshStatus();
      setTimeout(async () => { overlay.remove(); await view._renderDashboard(true); }, 500);
    } catch (e) {
      message.textContent = en?'Migration failed. Legacy mode remains active and no old files were deleted.':'迁移失败，仍保持旧版存储模式，旧文件没有被删除。';
      migrateBtn.disabled = false;
    }
  };
  exportBtn.onclick = async () => {
    const json = JSON.stringify(await view._storage.exportData(), null, 2);
    input.value = json;
    try {
      await navigator.clipboard.writeText(json);
      message.textContent = en ? 'Export JSON copied and shown below.' : '导出 JSON 已复制，并显示在下方。';
    } catch (e) { message.textContent = en ? 'Export JSON is shown below; copy it manually.' : '导出 JSON 已显示在下方，请手动复制。'; }
  };
  importBtn.onclick = async () => {
    try {
      if (!window.confirm(en ? 'Import and overwrite the corresponding Cockpit settings?' : '导入并覆盖对应的 Cockpit 设置？')) return;
      await view._storage.importData(JSON.parse(input.value));
      message.textContent = en ? 'Import complete. Reloading…' : '导入完成，正在刷新…';
      overlay.remove(); await view._renderDashboard(true);
    } catch (e) { message.textContent = en ? 'Invalid or unsupported import JSON.' : '导入 JSON 无效或格式不受支持。'; }
  };
  cleanupBtn.onclick = async () => {
    const ok = window.confirm(en ? 'Delete only the migrated legacy bookmark, Toolbar config, and old log files? Todos and focus history will remain.' : '仅删除已迁移的旧收藏、Toolbar 配置和旧日志文件？待办和专注历史会保留。');
    if (!ok) return;
    try {
      const removed = await view._storage.cleanupLegacy();
      message.textContent = (en?'Removed: ':'已清理：') + (removed.join(', ') || (en?'nothing':'无'));
      await refreshStatus();
    } catch (e) { message.textContent = en ? 'Migration is not complete; nothing was deleted.' : '迁移尚未完成，没有删除任何文件。'; }
  };
  document.body.appendChild(overlay); refreshStatus();
}
