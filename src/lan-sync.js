// lan-sync.js — 按需开启的局域网服务；设置能力，无仪表盘模块 DOM。
class CockpitLanSync {
  constructor(plugin) {
    this.plugin = plugin; this.store = new CockpitLanStore(plugin); this.transport = null;
    this.listeners = new Set(); this.status = '尚未开启'; this.running = false; this.stopped = false; this.confirmModal = null; this.modals = new Set();
  }
  notify(status) { if (status) this.status = status; this.listeners.forEach(fn => { try { fn(); } catch (error) { console.warn('LAN sync status refresh failed'); } }); }
  metadata() { return { protocolVersion:LAN_SYNC_PROTOCOL_VERSION, pluginVersion:String(this.plugin.manifest?.version || ''), capabilities:LAN_SYNC_CAPABILITIES.slice() }; }
  async initialize() {
    try { await this.store.load(); if (this.store.state.enabled && !this.stopped) await this.start(); }
    catch (error) { this.notify(error.message); }
  }
  async start() {
    if (this.starting) return this.starting;
    this.starting = this._start();
    try { return await this.starting; } finally { this.starting = null; }
  }
  async _start() {
    if (this.stopped) throw new Error('插件已卸载。');
    if (this.transport) return;
    await this.store.load();
    const transport = new CockpitLanTransport({
      device:() => this.store.state.device,
      name:() => require('os').hostname().slice(0, 60),
      metadata:() => this.metadata(),
      peers:() => this.store.state.peers,
      confirm:name => new Promise(resolve => { this.confirmModal = new CockpitLanConfirmModal(this.plugin.app, name, resolve); this.confirmModal.open(); }),
      addPeer:peer => this.store.configure(state => {
        if (state.peers.length >= 8) throw new Error('最多配对 8 台设备，请先移除旧设备。');
        state.peers = [...state.peers.filter(item => item.device !== peer.device), peer]; this.notify('配对完成，可开始同步');
      }),
      merge:async doc => { const result = await this.store.exchange(doc); this.notify('已同步 · ' + new Date().toLocaleTimeString()); return result; },
      onError:message => this.notify(message)
    });
    try {
      let port;
      try { port = await transport.start(this.store.state.port || 0); }
      catch (error) { if (error.code !== 'EADDRINUSE') throw error; port = await transport.start(0); }
      await this.store.configure(state => { state.enabled = true; state.port = port; });
      if (this.stopped) { transport.stop(); return; }
      this.transport = transport;
      this.timer = setInterval(() => this.sync().catch(error => this.notify(error.message)), 30000);
      this.notify('已开启 · 等待设备连接');
    } catch (error) { transport.stop(); throw error; }
  }
  async pause() {
    if (this.starting) await this.starting.catch(() => {});
    this.transport?.stop(); this.transport = null; clearInterval(this.timer); this.confirmModal?.close();
    await this.store.configure(state => { state.enabled = false; }); this.notify('同步已暂停');
  }
  async offer() { await this.start(); const offer = this.transport.offer(); this.notify('等待配对 · 二维码五分钟内有效'); return JSON.stringify(offer); }
  async pair(text) {
    const invite = lanSyncParseInvite(text);
    if (invite.scope && invite.scope !== 'personal') throw new Error('这是团队邀请，请从「团队待办」加入。');
    await this.start();
    this.notify('请在另一台电脑上确认配对…');
    const transport = this.transport;
    const result = await transport.request(invite, 'pair');
    if (!lanSyncDevice(result.device) || !/^[a-f0-9]{64}$/.test(result.key) || result.device === this.store.state.device) throw new Error('无法与本机或无效设备配对。');
    await this.store.configure(state => {
      if (state.peers.length >= 8) throw new Error('最多配对 8 台设备。');
      state.peers = [...state.peers.filter(peer => peer.device !== result.device), { id:invite.id, key:result.key, device:result.device, name:String(result.name || '另一台电脑').slice(0, 60), hosts:invite.hosts, port:invite.port, metadata:lanSyncMetadata(result.metadata) }];
    });
    this.notify('配对成功 · 开始首次同步'); await this.sync();
  }
  async sync() {
    if (this.running || !this.transport || this.stopped || !this.store.state.peers.length) return;
    this.running = true;
    const transport = this.transport;
    try {
      let doc = await this.store.exchange();
      let count = 0;
      for (const peer of [...this.store.state.peers]) {
        if (!peer.hosts.length || !peer.port) continue;
        try {
          const compatibility = lanSyncCompatibility(this.metadata(), peer.metadata);
          if (!compatibility.compatible) { peer.error = '版本协议不兼容，请先更新版本。'; continue; }
          const result = await transport.request(peer, 'sync', { doc:lanSyncFilterCapabilities(doc, compatibility.shared) });
          if (this.transport !== transport || !this.store.state.peers.some(item => item.id === peer.id)) return;
          peer.metadata = lanSyncMetadata(result.metadata);
          doc = await this.store.exchange(result.doc); count++;
          peer.lastSync = Date.now(); peer.error = '';
        } catch (error) { peer.error = '连接失败：请检查网络、对端开关或重新配对。'; }
      }
      await this.store.save();
      this.notify(count ? '已同步 · ' + new Date().toLocaleTimeString() : this.store.state.peers.length ? '设备暂未连接 · 联网后自动重试' : '已开启 · 尚未配对设备');
    } finally { this.running = false; }
  }
  async remove(id) {
    await this.store.configure(state => { state.peers = state.peers.filter(peer => peer.id !== id); });
    this.notify('已解除本机配对');
  }
  async resolve(key, value) { await this.store.exchange({}, { key, value }); this.notify('冲突已处理，下次同步会传到其他设备'); }
  stop() { this.stopped = true; clearInterval(this.timer); this.transport?.stop(); this.transport = null; this.confirmModal?.close(); this.modals.forEach(modal => modal.close()); this.modals.clear(); this.listeners.clear(); }
}
