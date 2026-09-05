// lan-sync-transport.js — 仅局域网监听；AES-256-GCM 认证加密负载，配对密钥从不经网络明文发送。
function lanSyncSeal(crypto, key, id, payload, direction) {
  const derived = crypto.createHash('sha256').update(Buffer.from(key, 'hex')).update('cockpit-lan-v1:' + direction).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derived, iv);
  cipher.setAAD(Buffer.from(id));
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return { id, iv:iv.toString('hex'), tag:cipher.getAuthTag().toString('hex'), body:body.toString('base64') };
}
function lanSyncUnseal(crypto, key, frame, direction) {
  if (!lanSyncDevice(frame?.id) || !/^[a-f0-9]{24}$/.test(frame.iv) || !/^[a-f0-9]{32}$/.test(frame.tag) || typeof frame.body !== 'string' || frame.body.length > LAN_SYNC_BYTES) throw new Error('Invalid packet');
  const derived = crypto.createHash('sha256').update(Buffer.from(key, 'hex')).update('cockpit-lan-v1:' + direction).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', derived, Buffer.from(frame.iv, 'hex'));
  decipher.setAAD(Buffer.from(frame.id)); decipher.setAuthTag(Buffer.from(frame.tag, 'hex'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(frame.body, 'base64')), decipher.final()]).toString('utf8'));
}
function lanSyncReadBody(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    stream.on('data', chunk => {
      size += chunk.length;
      if (size > LAN_SYNC_BYTES) { reject(new Error('同步数据超过 1 MB 限制。')); stream.destroy(); }
      else chunks.push(chunk);
    });
    stream.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(new Error('Invalid packet')); } });
    stream.on('error', reject);
    stream.on('aborted', () => reject(new Error('Connection closed')));
  });
}
class CockpitLanTransport {
  constructor(options) {
    this.options = options; this.http = require('http'); this.crypto = require('crypto');
    this.server = null; this.invite = null; this.sockets = new Set(); this.requests = new Set();
    this.replays = new Map(); this.rate = []; this.pending = 0; this.closed = true;
  }
  addresses() {
    return [...new Set(Object.values(require('os').networkInterfaces()).flat().filter(item => item && !item.internal && lanSyncPrivateIp(item.address)).map(item => item.address))].slice(0, 8);
  }
  async start(port = 0, bind = '0.0.0.0') {
    if (this.server) return this.server.address().port;
    this.closed = false;
    const server = this.http.createServer((req, res) => { this._handle(req, res).catch(() => { if (!res.destroyed) { res.writeHead(400); res.end(); } }); });
    server.headersTimeout = 10000; server.requestTimeout = 15000; server.timeout = 120000;
    server.on('connection', socket => { this.sockets.add(socket); socket.on('close', () => this.sockets.delete(socket)); if (this.sockets.size > 16) socket.destroy(); });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, bind, () => { server.removeListener('error', reject); resolve(); }); });
    server.on('error', () => this.options.onError?.('局域网监听失败，请暂停后重新开启。'));
    this.server = server; return server.address().port;
  }
  offer() {
    const hosts = this.addresses();
    if (!this.server || !hosts.length) throw new Error('未找到局域网，请连接 Wi-Fi 或有线网络后重试。');
    this.invite = { kind:'cockpit-lan-v1', id:this.crypto.randomBytes(16).toString('hex'), key:this.crypto.randomBytes(32).toString('hex'), hosts, port:this.server.address().port, expires:Date.now() + 300000 };
    return this.invite;
  }
  async _handle(req, res) {
    const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    const allowed = lanSyncPrivateIp(ip) || (this.options.allowLoopback === true && ip === '127.0.0.1');
    this.rate = this.rate.filter(t => Date.now() - t < 60000);
    if (!allowed || req.method !== 'POST' || req.url !== '/cockpit-lan/v1' || req.headers.origin || this.pending >= 4 || this.rate.length >= 120) { res.writeHead(403); res.end(); return; }
    this.rate.push(Date.now()); this.pending++;
    try {
      const frame = await lanSyncReadBody(req);
      const invitation = this.invite?.id === frame.id && this.invite.expires > Date.now() ? this.invite : null;
      const peer = this.options.peers().find(item => item.id === frame.id);
      const key = invitation?.key || peer?.key;
      if (!key) throw new Error('Unknown device');
      const request = lanSyncUnseal(this.crypto, key, frame, 'request');
      for (const [id, time] of this.replays) if (Date.now() - time > 300000) this.replays.delete(id);
      if (!lanSyncDevice(request.rid) || !lanSyncDevice(request.device) || !Number.isFinite(request.time) || Math.abs(Date.now() - request.time) > 300000 || this.replays.has(request.rid)) throw new Error('Expired packet');
      this.replays.set(request.rid, Date.now());
      const compatibility = lanSyncCompatibility(this.options.metadata?.(), request.metadata);
      if (!compatibility.compatible) throw new Error('Incompatible sync protocol');
      let result;
      if (invitation && request.kind === 'pair' && request.device !== this.options.device()) {
        // 先占用这张邀请，重复扫码不会出现多个批准框。
        this.invite = null;
        const name = String(request.name || '另一台电脑').slice(0, 60);
        if (!(await this.options.confirm(name)) || this.closed) throw new Error('Pairing declined');
        // 配对后换一把持久密钥；过期二维码无法用于后续同步。
        const pairedKey = this.crypto.randomBytes(32).toString('hex');
        const hosts = Array.isArray(request.hosts) ? request.hosts.filter(lanSyncPrivateIp).slice(0, 8) : [];
        const port = Number.isInteger(request.port) && request.port >= 1024 && request.port <= 65535 ? request.port : 0;
        await this.options.addPeer({ id:frame.id, key:pairedKey, device:request.device, name, hosts, port, metadata:lanSyncMetadata(request.metadata) });
        result = { key:pairedKey, device:this.options.device(), name:this.options.name(), metadata:this.options.metadata?.() };
      } else if (peer && request.kind === 'sync' && peer.device === request.device && this.options.peers().some(item => item.id === frame.id)) {
        lanSyncValidate(request.doc);
        const merged = await this.options.merge(lanSyncFilterCapabilities(request.doc, compatibility.shared));
        result = { doc:lanSyncFilterCapabilities(merged, compatibility.shared), metadata:this.options.metadata?.() };
      } else throw new Error('Unauthorized request');
      if (this.closed) throw new Error('Stopped');
      const reply = JSON.stringify(lanSyncSeal(this.crypto, key, frame.id, { rid:request.rid, ...result }, 'response'));
      if (Buffer.byteLength(reply) > LAN_SYNC_BYTES) throw new Error('Packet too large');
      res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(reply);
    } finally { this.pending--; }
  }
  async request(peer, kind, extra = {}) {
    const rid = this.crypto.randomBytes(16).toString('hex');
    const payload = { rid, time:Date.now(), kind, device:this.options.device(), name:this.options.name(), hosts:this.addresses(), port:this.server?.address()?.port || 0, metadata:this.options.metadata?.(), ...extra };
    const body = JSON.stringify(lanSyncSeal(this.crypto, peer.key, peer.id, payload, 'request'));
    if (Buffer.byteLength(body) > LAN_SYNC_BYTES) throw new Error('同步数据过大，请减少待办后重试。');
    let lastError;
    for (const host of peer.hosts) {
      if (!lanSyncPrivateIp(host) && !(this.options.allowLoopback === true && host === '127.0.0.1')) continue;
      try {
        const response = await new Promise((resolve, reject) => {
          const req = this.http.request({ hostname:host, port:peer.port, path:'/cockpit-lan/v1', method:'POST', agent:false, headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) } }, res => {
            if (res.statusCode !== 200) { res.resume(); reject(new Error('配对未确认、已过期或设备已解除配对。')); return; }
            lanSyncReadBody(res).then(resolve, reject);
          });
          this.requests.add(req);
          const connectDeadline = setTimeout(() => req.destroy(new Error('无法连接，请检查网络或重新配对。')), 3000);
          req.once('socket', socket => {
            if (!socket.connecting) clearTimeout(connectDeadline);
            else socket.once('connect', () => clearTimeout(connectDeadline));
          });
          const deadline = setTimeout(() => req.destroy(new Error('连接超时，请确认两台电脑在同一网络、插件已开启，且防火墙允许连接。')), kind === 'pair' ? 90000 : 15000);
          req.once('close', () => { clearTimeout(deadline); clearTimeout(connectDeadline); this.requests.delete(req); });
          req.once('error', reject); req.end(body);
        });
        if (response.id !== peer.id) throw new Error('Unexpected device');
        const decoded = lanSyncUnseal(this.crypto, peer.key, response, 'response');
        if (decoded.rid !== rid) throw new Error('Unexpected response');
        return decoded;
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('设备地址不可用，请重新扫码配对。');
  }
  stop() {
    this.closed = true; this.invite = null;
    this.requests.forEach(req => req.destroy(new Error('同步已暂停。')));
    this.sockets.forEach(socket => socket.destroy()); this.sockets.clear();
    this.server?.close(); this.server = null;
  }
}
