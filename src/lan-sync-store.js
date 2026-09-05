// lan-sync-store.js — 固定白名单存储适配，不接收远端路径，不触发待办完成自动化。
class CockpitLanStore {
  constructor(plugin) {
    this.plugin = plugin; this.crypto = require('crypto'); this.queue = Promise.resolve();
    const os = require('os');
    const machine = this.crypto.createHash('sha256').update(os.hostname() + '\n' + os.homedir()).digest('hex').slice(0, 16);
    this.path = String(plugin.manifest.dir).replace(/\\/g, '/') + '/lan-sync-' + machine + '.json';
    this.state = null;
  }
  async load() {
    if (this.loading) return this.loading;
    this.loading = this._load();
    try { return await this.loading; } finally { this.loading = null; }
  }
  async _load() {
    if (this.state) return this.state;
    const adapter = this.plugin.app.vault.adapter;
    if (await adapter.exists(this.path)) {
      const text = await adapter.read(this.path);
      if (text.length > 3 * LAN_SYNC_BYTES) throw new Error('本机同步记录过大，请检查备份。');
      const state = JSON.parse(text);
      if (state.version !== 1 || !lanSyncDevice(state.device) || !Array.isArray(state.peers) || state.peers.length > 8) throw new Error('本机同步记录无效，已停止同步。');
      lanSyncValidate(state.doc);
      if (state.pending) lanSyncValidate(state.pending.doc);
      if (!lanSyncObject(state.observed)) throw new Error('同步快照无效。');
      for (const [key, value] of Object.entries(state.observed)) if (!lanSyncValue(key, value)) throw new Error('同步快照无效。');
      if (state.peers.some(peer => !lanSyncDevice(peer.id) || !lanSyncDevice(peer.device) || !/^[a-f0-9]{64}$/.test(peer.key) || !Array.isArray(peer.hosts) || peer.hosts.length > 8 || !peer.hosts.every(lanSyncPrivateIp))) throw new Error('配对记录无效。');
      this.state = state; this.lastSaved = text;
    } else this.state = { version:1, device:this.crypto.randomBytes(16).toString('hex'), enabled:false, port:0, peers:[], doc:{}, observed:{}, backupIndex:0 };
    return this.state;
  }
  async save() {
    const text = JSON.stringify(this.state);
    if (text === this.lastSaved) return;
    await this.plugin.app.vault.adapter.write(this.path, text); this.lastSaved = text;
  }
  serial(operation) { const next = this.queue.catch(() => {}).then(operation); this.queue = next; return next; }
  async configure(mutator) { return this.serial(async () => { await this.load(); await mutator(this.state); await this.save(); }); }
  async read(data) {
    const vault = this.plugin.app.vault;
    const file = vault.getAbstractFileByPath(TODO_FILE);
    let todoContent = file ? await vault.read(file) : '';
    if (todoContent.length > LAN_SYNC_BYTES / 2) throw new Error('待办文件超过同步大小限制。');
    let changed = false;
    const seen = new Set();
    const current = {};
    todoContent = todoContent.split('\n').map(line => {
      if (!/^\s*-\s+\[[xX ]\]\s+.+/.test(line)) return line;
      let id = line.split('|').map(part => part.trim()).find(part => /^id:/.test(part))?.slice(3).trim();
      if (!id) { id = this.crypto.randomBytes(16).toString('hex'); line += ' | id:' + id; changed = true; }
      if (seen.has(id)) throw new Error('待办存在重复 ID，请先修正后再同步。');
      seen.add(id);
      // 日历关联是设备专属状态，不传给其他设备。
      const value = line.trim().replace(/^-\s+\[X\]/, '- [x]').replace(/\s*\|\s*calendar:\s*(true|false)\s*/g, '');
      if (!lanSyncValue('todo:' + id, value)) throw new Error('部分待办格式暂不支持同步，请保留原文件并反馈。');
      current['todo:' + id] = value;
      return line;
    }).join('\n');
    if (changed) {
      await vault.adapter.write(this.path + '.ids-backup.json', JSON.stringify({ todoContent:await vault.read(file) }));
      await vault.modify(file, todoContent);
    }
    let bookmarks;
    if (data.storageMigrationCompleted === true) bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
    else {
      const legacy = vault.getAbstractFileByPath(BOOKMARK_FILE);
      bookmarks = legacy ? (await vault.read(legacy)).split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')) : [];
    }
    for (const bookmark of bookmarks) if (lanSyncBookmark(bookmark)) current['bookmark:' + bookmark] = '1';
    for (const key of LAN_SYNC_PREFS) if (data[key] != null && lanSyncValue('pref:' + key, data[key])) current['pref:' + key] = data[key];
    return { current, todoContent, bookmarks };
  }
  async write(data, snapshot, desired) {
    const vault = this.plugin.app.vault;
    const remaining = new Map(Object.entries(desired).filter(([key]) => key.startsWith('todo:')).map(([key, value]) => [key.slice(5), value]));
    const lines = snapshot.todoContent.split('\n').flatMap(line => {
      const id = /^\s*-\s+\[[xX ]\]\s+/.test(line) ? line.split('|').map(part => part.trim()).find(part => /^id:/.test(part))?.slice(3).trim() : null;
      if (!id) return [line];
      if (!remaining.has(id)) return [];
      const next = remaining.get(id); remaining.delete(id);
      if (snapshot.current['todo:' + id] === next) return [line];
      const indent = line.match(/^\s*/)[0];
      const calendar = line.match(/\|\s*calendar:\s*(true|false)/)?.[0] || '';
      return [indent + next + (calendar ? ' ' + calendar : '')];
    });
    if (remaining.size) lines.push(...remaining.values());
    const content = lines.join('\n');
    if (content !== snapshot.todoContent) {
      const file = vault.getAbstractFileByPath(TODO_FILE);
      if (file) await vault.modify(file, content);
      else {
        if (!vault.getAbstractFileByPath('_data')) await vault.createFolder('_data');
        await vault.create(TODO_FILE, content);
      }
    }
    const wanted = new Set(Object.keys(desired).filter(key => key.startsWith('bookmark:')).map(key => key.slice(9)));
    // 保留现有排序；本版只同步收藏成员，不改变另一台的排序。
    const bookmarks = snapshot.bookmarks.filter(path => !lanSyncBookmark(path) || wanted.has(path));
    for (const path of wanted) if (!bookmarks.includes(path)) bookmarks.push(path);
    if (JSON.stringify(bookmarks) !== JSON.stringify(snapshot.bookmarks)) {
      if (data.storageMigrationCompleted === true) data.bookmarks = bookmarks;
      else {
        if (!vault.getAbstractFileByPath('_data')) await vault.createFolder('_data');
        const file = vault.getAbstractFileByPath(BOOKMARK_FILE);
        const text = '# 收藏文件\n\n' + bookmarks.join('\n') + '\n';
        if (file) await vault.modify(file, text); else await vault.create(BOOKMARK_FILE, text);
      }
    }
    for (const key of LAN_SYNC_PREFS) {
      if (Object.prototype.hasOwnProperty.call(desired, 'pref:' + key)) data[key] = desired['pref:' + key];
      else delete data[key];
    }
  }
  async exchange(remote = {}, resolution = null) {
    return this.serial(async () => {
      await this.load(); lanSyncValidate(remote);
      if (this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE).some(leaf => leaf.view && cockpitIsSilentRefreshBlocked(leaf.view, true))) throw new Error('请先完成驾驶舱中的编辑，稍后会自动同步。');
      let output;
      // 与本机待办写入、配置写入共用队列；同步期间的编辑在下一轮捕获。
      await queueTodoFileMutation(() => this.plugin.mutateData(async data => {
        const snapshot = await this.read(data);
        // 上次落盘中断时保留实际磁盘内容为新分支，不盲目重放覆盖用户后续修改。
        let doc = lanSyncCapture(this.state.doc, this.state.observed, snapshot.current, this.state.device);
        if (this.state.pending) doc = lanSyncMerge(doc, this.state.pending.doc);
        doc = lanSyncMerge(doc, remote);
        if (resolution) doc = lanSyncResolve(doc, resolution.key, resolution.value, this.state.device);
        const desired = lanSyncProjection(doc);
        const changed = JSON.stringify(Object.entries(snapshot.current).sort()) !== JSON.stringify(Object.entries(desired).sort());
        if (changed) {
          const backupPath = this.path + '.backup-' + (this.state.backupIndex % 5) + '.json';
          await this.plugin.app.vault.adapter.write(backupPath, JSON.stringify({ time:new Date().toISOString(), todoContent:snapshot.todoContent, bookmarks:snapshot.bookmarks, preferences:Object.fromEntries(LAN_SYNC_PREFS.map(key => [key, data[key]])), doc:this.state.doc }));
          this.state.backupIndex++; this.state.lastBackup = backupPath;
          this.state.pending = { doc, desired };
          await this.save();
          await this.write(data, snapshot, desired);
        }
        output = { doc, desired, changed };
      }));
      this.state.doc = output.doc; this.state.observed = output.desired; delete this.state.pending;
      await this.save();
      if (output.changed) this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => {
        if (leaf.view) { leaf.view._vaultRefreshPending = true; cockpitRunVaultRefresh(leaf.view); }
      });
      return output.doc;
    });
  }
}
