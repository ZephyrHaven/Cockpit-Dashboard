// lan-sync-ui.js — 配对、扫码和冲突管理；摄像头仅在用户点击后开启。
class CockpitLanConfirmModal extends obs.Modal {
  constructor(app, name, resolve) { super(app); this.name = name; this.resolve = resolve; }
  onOpen() {
    this.contentEl.createEl('h2', { text:'允许这台设备同步？' });
    this.contentEl.createEl('p', { text:this.name });
    this.contentEl.createEl('p', { text:'确认这是你的电脑。配对后会双向同步待办、收藏、昵称和语言；首次合并会自动备份。' });
    const actions = this.contentEl.createDiv({ cls:'cockpit-lan-actions' });
    actions.createEl('button', { text:'取消' }).onclick = () => this.close();
    actions.createEl('button', { text:'确认配对', cls:'mod-cta' }).onclick = () => { this.resolve?.(true); this.resolve = null; this.close(); };
    this.timer = setTimeout(() => this.close(), 60000);
  }
  onClose() { clearTimeout(this.timer); this.resolve?.(false); this.resolve = null; this.contentEl.empty(); }
}
class CockpitLanPairModal extends obs.Modal {
  constructor(app, service, mode) { super(app); this.service = service; this.mode = mode; this.closed = false; this.stream = null; }
  async onOpen() {
    this.contentEl.addClass('cockpit-lan-modal');
    this.contentEl.createEl('h2', { text:this.mode === 'show' ? '让另一台电脑扫这里' : '连接我的另一台电脑' });
    this.contentEl.createEl('p', { text:'两台电脑连接同一 Wi-Fi 或有线局域网，并开启 Cockpit。首次连接还需在对方电脑确认。', cls:'cockpit-lan-muted' });
    this.status = this.contentEl.createEl('p', { attr:{ role:'status', 'aria-live':'polite' } });
    if (this.mode === 'show') {
      try {
        const text = await this.service.offer();
        if (this.closed) return;
        this.offerId = JSON.parse(text).id;
        const canvas = this.contentEl.createEl('canvas', { cls:'cockpit-lan-qr', attr:{ 'aria-label':'局域网配对二维码' } });
        await CockpitLanQr.encode(canvas, text, { width:320, margin:3, errorCorrectionLevel:'M' });
        this.status.setText('二维码五分钟内有效，请勿发给他人。');
        const actions = this.contentEl.createDiv({ cls:'cockpit-lan-actions' });
        actions.createEl('button', { text:'复制配对信息' }).onclick = async () => {
          try { await navigator.clipboard.writeText(text); this.status.setText('已复制，可在另一台电脑粘贴配对。'); } catch (error) { this.status.setText('无法读取剪贴板，请保存二维码图片。'); }
        };
        actions.createEl('button', { text:'保存二维码图片' }).onclick = () => {
          const link = this.contentEl.createEl('a', { attr:{ href:canvas.toDataURL('image/png'), download:'cockpit-pair.png' } }); link.click(); link.remove();
        };
        this.expiryTimer = setTimeout(() => { canvas.remove(); actions.remove(); this.status.setText('二维码已过期，请关闭后重新生成。'); }, 300000);
      } catch (error) { this.status.setText(error.message); }
      return;
    }
    const actions = this.contentEl.createDiv({ cls:'cockpit-lan-actions' });
    const camera = actions.createEl('button', { text:'摄像头扫码', cls:'mod-cta' });
    const imageInput = this.contentEl.createEl('input', { attr:{ type:'file', accept:'image/png,image/jpeg,image/webp' } }); imageInput.hidden = true;
    actions.createEl('button', { text:'导入二维码图片' }).onclick = () => imageInput.click();
    this.video = this.contentEl.createEl('video', { cls:'cockpit-lan-video', attr:{ autoplay:'', playsinline:'', muted:'' } }); this.video.hidden = true;
    camera.onclick = async () => {
      if (this.stream) return;
      camera.disabled = true;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前环境不支持摄像头，请导入二维码图片。');
        const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:{ ideal:640 }, height:{ ideal:480 } }, audio:false });
        if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
        this.stream = stream; this.video.srcObject = stream; this.video.hidden = false; await this.video.play();
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently:true });
        this.scanTimer = setInterval(() => {
          if (!this.video.videoWidth || this.joining) return;
          canvas.width = 640; canvas.height = Math.round(640 * this.video.videoHeight / this.video.videoWidth);
          ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = CockpitLanQr.decode(pixels.data, pixels.width, pixels.height);
          if (found?.data) { this.stopCamera(); this.join(found.data); }
        }, 250);
        this.status.setText('将另一台电脑的二维码放入画面。');
      } catch (error) { this.stopCamera(); this.status.setText('摄像头不可用或权限未允许，请导入二维码图片。'); }
      finally { camera.disabled = false; }
    };
    imageInput.onchange = async () => {
      const file = imageInput.files?.[0]; if (!file) return;
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error('请选择小于 8 MB 的二维码图片。');
        const bitmap = await createImageBitmap(file);
        try {
          const canvas = document.createElement('canvas'); const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
          canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          const ctx = canvas.getContext('2d', { willReadFrequently:true }); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height); const found = CockpitLanQr.decode(pixels.data, pixels.width, pixels.height);
          if (!found?.data) throw new Error('没有识别到二维码，请使用清晰完整的图片。');
          if (!this.closed) await this.join(found.data);
        } finally { bitmap.close(); }
      } catch (error) { if (!this.closed) this.status.setText(error.message); }
      finally { imageInput.value = ''; }
    };
    const details = this.contentEl.createEl('details'); details.createEl('summary', { text:'也可以粘贴配对信息' });
    const text = details.createEl('textarea', { cls:'cockpit-lan-paste', attr:{ rows:'4', placeholder:'粘贴另一台电脑复制的配对信息', 'aria-label':'配对信息' } });
    details.createEl('button', { text:'确认连接' }).onclick = () => this.join(text.value);
  }
  async join(text) {
    if (this.joining || this.closed) return;
    this.joining = true; this.status.setText('连接中，请在另一台电脑确认…');
    try { await this.service.pair(text); if (!this.closed) { new obs.Notice('设备已配对'); this.close(); } }
    catch (error) { if (!this.closed) this.status.setText(error.message); }
    finally { this.joining = false; }
  }
  stopCamera() { clearInterval(this.scanTimer); this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; if (this.video) { this.video.srcObject = null; this.video.hidden = true; } }
  onClose() {
    this.service.modals.delete(this);
    this.closed = true; this.stopCamera(); clearTimeout(this.expiryTimer);
    if (this.service.transport?.invite?.id === this.offerId) this.service.transport.invite = null;
    this.contentEl.empty();
  }
}
class CockpitLanConflictsModal extends obs.Modal {
  constructor(app, service) { super(app); this.service = service; }
  onOpen() { this.render(); }
  render() {
    this.contentEl.empty(); this.contentEl.createEl('h2', { text:'选择要保留的版本' });
    this.contentEl.createEl('p', { text:'两台设备同时修改了同一条数据。选择后会在下次同步传到其他设备；未选择前，两个版本都会保留。' });
    const conflicts = lanSyncConflicts(this.service.store.state.doc);
    if (!conflicts.length) this.contentEl.createEl('p', { text:'没有待处理的冲突。' });
    for (const [key, versions] of conflicts.slice(0, 30)) {
      const card = this.contentEl.createDiv({ cls:'cockpit-lan-card' }); card.createEl('strong', { text:key });
      for (const value of new Set(versions.map(v => v.value))) {
        const row = card.createDiv(); row.createEl('pre', { text:value === null ? '删除此条目' : value, cls:'cockpit-lan-conflict' });
        const button = row.createEl('button', { text:'保留此版本' });
        button.onclick = async () => { button.disabled = true; try { await this.service.resolve(key, value); this.render(); } catch (error) { new obs.Notice(error.message); button.disabled = false; } };
      }
    }
  }
  onClose() { this.service.modals.delete(this); this.contentEl.empty(); }
}
async function renderLanSyncSettings(container, plugin, language) {
  const en = language === 'en'; const service = plugin.lanSync;
  container.createEl('h2', { text:en ? 'Nearby devices · Preview' : '附近设备 · 预览版' });
  container.createEl('p', { cls:'cockpit-lan-muted', text:en ? 'Pair your computers on the same network. Sync tasks, bookmarks, display name and language.' : '把你的电脑连接起来。在同一网络下，共享待办、收藏、昵称和语言。' });
  if (!service) { container.createEl('p', { text:'同步服务不可用，请重新加载插件。' }); return; }
  try { await service.store.load(); } catch (error) { container.createEl('p', { text:error.message }); return; }
  const hero = container.createDiv({ cls:'cockpit-lan-card' });
  const status = hero.createEl('p', { attr:{ role:'status', 'aria-live':'polite' } });
  const actions = hero.createDiv({ cls:'cockpit-lan-actions' });
  const toggle = actions.createEl('button');
  const run = async action => { try { await action(); } catch (error) { new obs.Notice(error.message); } refresh(); };
  toggle.onclick = () => run(() => service.transport ? service.pause() : service.start());
  actions.createEl('button', { text:en ? 'Show pairing QR' : '显示配对二维码', cls:'mod-cta' }).onclick = () => {
    if (service.modals.size) return;
    const modal = new CockpitLanPairModal(plugin.app, service, 'show'); service.modals.add(modal); modal.open();
  };
  actions.createEl('button', { text:en ? 'Scan / import QR' : '扫码 / 导入二维码' }).onclick = () => {
    if (service.modals.size) return;
    const modal = new CockpitLanPairModal(plugin.app, service, 'scan'); service.modals.add(modal); modal.open();
  };
  actions.createEl('button', { text:en ? 'Sync now' : '立即同步' }).onclick = () => run(async () => { await service.start(); await service.sync(); });
  const devices = container.createDiv();
  const conflicts = container.createEl('button');
  conflicts.onclick = () => { const modal = new CockpitLanConflictsModal(plugin.app, service); service.modals.add(modal); modal.open(); };
  const backup = container.createEl('p', { cls:'cockpit-lan-muted' });
  container.createEl('p', { cls:'cockpit-lan-muted', text:en ? 'Every 30 seconds while enabled. Both apps must be running. Keys, commands, workspace paths, AI history and note contents stay on this computer. Bookmark targets are not copied.' : '开启后每 30 秒同步，两端均需运行。密钥、命令、工作区路径、AI 会话和笔记正文不参与；收藏只同步路径，不复制笔记。' });
  container.createEl('p', { cls:'cockpit-lan-muted', text:en ? 'If a firewall prompt appears, allow access on your private network. A changed network address may require pairing again. Avoid syncing these same records with another tool.' : '首次连接若出现防火墙提示，请允许专用网络访问。网络地址变化后可能需要重新配对；避免其他同步工具同时改写这些数据。' });
  const refresh = () => {
    status.setText(service.status); toggle.setText(service.transport ? (en ? 'Pause sync' : '暂停同步') : (en ? 'Enable sync' : '开启同步'));
    devices.empty();
    const peers = service.store.state.peers;
    if (!peers.length) devices.createEl('p', { text:en ? 'No paired devices yet.' : '还没有配对的设备。', cls:'cockpit-lan-muted' });
    peers.forEach(peer => {
      const row = devices.createDiv({ cls:'cockpit-lan-device' });
      const copy = row.createDiv(); copy.createEl('strong', { text:peer.name });
      const compatibility = lanSyncCompatibility(service.metadata(), peer.metadata);
      const remoteVersion = compatibility.remote.pluginVersion || (en ? 'legacy / unknown' : '旧版 / 未知');
      copy.createEl('p', { text:peer.error || (peer.lastSync ? (en ? 'Last sync ' : '上次同步 ') + new Date(peer.lastSync).toLocaleTimeString() : (en ? 'Paired' : '已配对')), cls:'cockpit-lan-muted' });
      copy.createEl('p', { text:(en ? 'Version ' : '版本 ') + remoteVersion + ' · ' + (compatibility.compatible ? (en ? 'Protocol compatible' : '协议兼容') : (en ? 'Sync blocked: update required' : '无法同步：需要先更新版本')), cls:'cockpit-lan-muted' });
      const labels = { todos:en?'tasks':'待办', bookmarks:en?'bookmarks':'收藏', 'display-name':en?'display name':'昵称', language:en?'language':'语言' };
      const unavailable = [...compatibility.unavailableThere.map(id => (labels[id] || id) + (en ? ' (unsupported remotely)' : '（对方不支持）')), ...compatibility.unavailableHere.map(id => (labels[id] || id) + (en ? ' (unsupported here)' : '（本机不支持）'))];
      copy.createEl('p', { text:unavailable.length ? (en ? 'Not synchronized: ' : '无法同步：') + unavailable.join(', ') : (compatibility.local.pluginVersion && compatibility.remote.pluginVersion && compatibility.local.pluginVersion !== compatibility.remote.pluginVersion ? (en ? 'Versions differ, but all current sync items remain compatible.' : '版本不同，但当前同步项目全部兼容。') : (en ? 'Sync items: tasks, bookmarks, display name, language.' : '同步项目：待办、收藏、昵称、语言。')), cls:'cockpit-lan-muted' });
      row.createEl('button', { text:en ? 'Unpair' : '解除配对' }).onclick = () => run(() => service.remove(peer.id));
    });
    const count = lanSyncConflicts(service.store.state.doc).length;
    conflicts.hidden = !count; conflicts.setText((en ? 'Review conflicts: ' : '处理冲突：') + count);
    backup.setText(service.store.state.lastBackup ? (en ? 'Last backup: ' : '最近备份：') + service.store.state.lastBackup : (en ? 'The last five pre-merge backups are kept locally.' : '合并前自动备份，本机保留最近五份。'));
  };
  refresh();
  // 设置页重建时移除旧订阅，避免每次打开都累积监听器。
  plugin._lanSettingsCleanup?.();
  service.listeners.add(refresh); plugin._lanSettingsCleanup = () => service.listeners.delete(refresh);
}
