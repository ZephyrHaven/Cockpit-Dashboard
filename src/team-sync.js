// team-sync.js — 独立团队存储、主设备权限裁决和成员离线提交队列。
class CockpitTeamSync {
  constructor(plugin) {
    this.isTeam = true; this.plugin = plugin; this.state = null; this.queue = Promise.resolve(); this.listeners = new Set();
    this.modals = new Set(); this.transport = null; this.stopped = false; this.status = '尚未加入团队';
    this.crypto = require('crypto');
  }
  id() { return this.crypto.randomBytes(16).toString('hex'); }
  notify(message) {
    if (message) this.status = message;
    this.listeners.forEach(listener => { try { listener(); } catch (error) { console.warn('Team view refresh failed', error); } });
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async notificationTodos() {
    await this.load();
    if (!this.state?.team) return [];
    const policy = this.policy();
    return Object.values(this.state.tasks || {}).filter(record =>
      record?.value?.due && teamSyncCanSee(record, policy, this.state.device)
    ).map(record => ({
      text:record.value.text + '（来源：' + record.origin.name + '）',
      done:record.value.done,
      dueDate:window.moment(record.value.due, ['YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DD'], true)
    })).filter(todo => todo.dueDate.isValid());
  }
  isHost(state = this.state) { return !!state?.team && state.team.host === state.device; }
  policy(state = this.state) {
    return this.isHost(state) ? { role:'admin', visibility:'all', canCreate:true, canDelete:true, syncTodos:true } : state?.policy || { role:'viewer', visibility:'assigned', canCreate:false, canDelete:false, syncTodos:false };
  }
  members() {
    return this.isHost() ? [{ device:this.state.device, name:this.state.name }, ...this.state.peers.map(peer => ({ device:peer.device, name:peer.name }))] : this.state?.members || [];
  }
  validate(state) {
    teamSyncAssert(state?.version === 1 && lanSyncDevice(state.device) && teamSyncText(state.name) && teamSyncInteger(state.generation)
      && teamSyncInteger(state.revision) && teamSyncInteger(state.nextSeq) && state.nextSeq > 0
      && typeof state.enabled === 'boolean' && Number.isInteger(state.port) && state.port >= 0 && state.port <= 65535
      && lanSyncObject(state.tasks) && Object.keys(state.tasks).length <= TEAM_SYNC_LIMIT
      && Array.isArray(state.peers) && state.peers.length <= 8 && Array.isArray(state.pending) && state.pending.length <= 100
      && Array.isArray(state.drafts) && state.drafts.length <= 100 && Array.isArray(state.conflicts) && state.conflicts.length <= 100
      && Array.isArray(state.members) && state.members.length <= 9);
    if (state.team) teamSyncInfo(state.team);
    teamSyncAssert(state.policy == null || teamSyncPolicy(state.policy).role !== 'admin');
    for (const [id, record] of Object.entries(state.tasks)) teamSyncAssert(teamSyncRecord(record).id === id && record.revision <= state.revision);
    state.members.forEach(teamSyncActor);
    const names = [state.name, ...state.peers.map(peer => peer.name)].map(name => String(name).trim().toLowerCase());
    teamSyncAssert(new Set(names).size === names.length, '团队内设备名称不能重复，请修改后再保存。');
    state.pending.forEach(teamSyncOperation);
    state.drafts.forEach(draft => { teamSyncOperation(draft); teamSyncAssert(lanSyncDevice(draft.draftId) && teamSyncText(draft.reason, 300)); });
    state.conflicts.forEach(conflict => { teamSyncOperation(conflict); teamSyncAssert(typeof conflict.token === 'string' && /^[a-f0-9]{32}:[0-9]+$/.test(conflict.token)); teamSyncActor({ device:conflict.device, name:conflict.name }); teamSyncActor(conflict.origin); });
    for (const peer of state.peers) {
      teamSyncAssert(lanSyncDevice(peer.id) && lanSyncDevice(peer.device) && /^[a-f0-9]{64}$/.test(peer.key) && teamSyncText(peer.name)
        && Array.isArray(peer.hosts) && peer.hosts.length <= 8 && peer.hosts.every(lanSyncPrivateIp)
        && Number.isInteger(peer.port) && peer.port >= 0 && peer.port <= 65535);
      teamSyncAssert(teamSyncPolicy(peer.policy).role !== 'admin');
      if (peer.receipt) teamSyncAssert(teamSyncInteger(peer.receipt.seq) && ['accepted','rejected','conflict'].includes(peer.receipt.status));
    }
    teamSyncAssert(new Set(state.peers.map(peer => peer.device)).size === state.peers.length);
    teamSyncAssert(this.isHost(state) || (state.peers.length <= 1 && state.peers.every(peer => peer.device === state.team?.host)));
    teamSyncAssert(state.pending.every((operation,index) => operation.seq < state.nextSeq && (!index || operation.seq === state.pending[index-1].seq + 1)));
    teamSyncAssert(JSON.stringify(state).length < 3 * LAN_SYNC_BYTES, '团队记录超过本机存储上限，请先处理草稿或冲突。');
    return state;
  }
  async writeTeamMarkdown(state) {
    const vault = this.plugin.app.vault;
    const path = '_data/team-todos.md';
    const lines = ['# 团队待办', '', '> 此文件是团队待办的可读镜像；来源设备、权限和冲突记录保存在插件私有记录中。', ''];
    Object.values(state.tasks).filter(task => task?.value).sort((a,b) => a.createdAt - b.createdAt).forEach((task) => {
      const value = task.value;
      const checked = value.done ? 'x' : ' ';
      const due = value.due ? ' | due:' + value.due : '';
      const assignee = value.assignee ? ' | assignee:' + value.assignee : '';
      lines.push(`- [${checked}] ${value.text} | team-id:${task.id} | priority:${value.priority}${due}${assignee} | source:${task.origin.name}`);
    });
    const text = lines.join('\n') + '\n';
    const file = vault.getAbstractFileByPath(path);
    if (file) await vault.modify(file, text);
    else {
      if (!vault.getAbstractFileByPath('_data')) await vault.createFolder('_data');
      await vault.create(path, text);
    }
  }
  async readTeamMarkdown(state) {
    if (!this.isHost(state)) return;
    const file = this.plugin.app.vault.getAbstractFileByPath?.('_data/team-todos.md');
    if (!file) return;
    const text = await this.plugin.app.vault.read(file);
    let changed = false;
    for (const line of String(text).split('\n')) {
      const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+?)\s+\|\s*team-id:([a-f0-9]{32})\s+\|\s*priority:(high|mid|low)(?:\s*\|\s*due:([^|]+))?(?:\s*\|\s*assignee:([^|]+))?/);
      if (!match || !state.tasks[match[3]]?.value) continue;
      const current = state.tasks[match[3]].value;
      const next = { ...current, text:match[2].trim(), done:match[1].toLowerCase() === 'x', priority:match[4], due:(match[5] || '').trim(), assignee:(match[6] || current.assignee || '').trim() };
      if (JSON.stringify(current) !== JSON.stringify(next)) { state.tasks[match[3]].value = next; state.tasks[match[3]].updatedAt = Date.now(); state.tasks[match[3]].updatedBy = { device:state.device, name:state.name }; state.revision++; state.tasks[match[3]].revision = state.revision; changed = true; }
    }
    return changed;
  }
  async load() {
    if (this.state) return this.state;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      await this.plugin.lanSync.store.load();
      const personal = this.plugin.lanSync.store;
      this.path = personal.path.replace('/lan-sync-', '/team-sync-');
      const adapter = this.plugin.app.vault.adapter;
      const candidates = []; let found = false;
      // 先写完整日志再替换主文件。中断重启时取最后一份完整记录，避免重复执行已接收操作。
      for (const path of [this.path, this.path + '.next']) {
        if (!(await adapter.exists(path))) continue;
        found = true;
        try {
          const text = await adapter.read(path);
          teamSyncAssert(text.length < 3 * LAN_SYNC_BYTES);
          candidates.push(this.validate(JSON.parse(text)));
        } catch (error) { console.warn('Team state copy could not be read', error); }
      }
      teamSyncAssert(!found || candidates.length, '团队记录无法读取，请保留备份并恢复后重试。');
      if (candidates.length) this.state = candidates.sort((a,b) => b.generation - a.generation)[0];
      else this.state = { version:1, generation:0, device:personal.state.device, name:require('os').hostname().slice(0,60), enabled:false,
        port:0, team:null, peers:[], tasks:{}, revision:0, pending:[], drafts:[], conflicts:[], nextSeq:1, members:[], policy:null };
      try { await this.readTeamMarkdown(this.state); } catch (error) { console.warn('Team Markdown mirror could not be read', error); }
      return this.state;
    })();
    try { return await this.loading; } finally { this.loading = null; }
  }
  transaction(operation) {
    const run = this.queue.catch(() => {}).then(async () => {
      await this.load();
      teamSyncAssert(!this.stopped, '插件已卸载。');
      const next = JSON.parse(JSON.stringify(this.state));
      const result = await operation(next);
      if (JSON.stringify(next) === JSON.stringify(this.state)) return result;
      next.generation++;
      const text = JSON.stringify(this.validate(next));
      const adapter = this.plugin.app.vault.adapter;
      await adapter.write(this.path + '.backup-' + (this.state.generation % 5) + '.json', JSON.stringify(this.state));
      await adapter.write(this.path + '.next', text);
      // 日志落盘即提交；主文件失败也不能在内存撤回已提交的序号。
      this.state = next;
      try { await adapter.write(this.path, text); }
      catch (error) { this.notify('团队记录已保存在恢复日志中，请检查磁盘空间。'); throw error; }
      try { await this.writeTeamMarkdown(next); } catch (error) { this.notify('团队记录已保存，但 Markdown 镜像写入失败。'); }
      this.notify();
      return result;
    });
    this.queue = run; return run;
  }
  async initialize() {
    try { await this.load(); if (this.state.enabled && this.state.team) await this.start(); this.notify(); }
    catch (error) { this.notify(error.message); }
  }
  async create(name) {
    teamSyncAssert(teamSyncText(name) && name.trim(), '请填写团队名称。');
    await this.transaction(state => {
      teamSyncAssert(!state.team, '请先退出当前团队。');
      state.team = { id:this.id(), host:state.device, name:name.trim() };
    });
    await this.start(); this.notify('团队已创建 · 等待成员加入');
  }
  async start() {
    if (this.starting) return this.starting;
    this.starting = this._start();
    try { return await this.starting; } finally { this.starting = null; }
  }
  async _start() {
    await this.load(); teamSyncAssert(!this.stopped, '插件已卸载。');
    if (this.transport) return;
    const transport = new CockpitLanTransport({ scope:'team-v1', device:() => this.state.device, name:() => this.state.name,
      peers:() => this.state.peers, pairContext:() => this.state.team,
      confirm:name => new Promise(resolve => {
        if (!this.isHost()) { resolve(false); return; }
        this.openModal(new CockpitTeamApprovalModal(this.plugin.app, this, name, resolve));
      }),
      addPeer:(peer, policy) => this.transaction(state => {
        teamSyncAssert(this.isHost(state), '只有主设备能批准成员。');
        const existing = state.peers.find(item => item.device === peer.device);
        teamSyncAssert(existing || state.peers.length < 8, '最多加入 8 台成员设备。');
        const checked = teamSyncPolicy(policy); teamSyncAssert(checked.role !== 'admin');
        state.peers = [...state.peers.filter(item => item.device !== peer.device), { ...peer, policy:checked, receipt:existing?.receipt || null }];
        return { receipt:existing?.receipt || null };
      }),
      exchangeTeam:(peer, request) => this.receive(peer.id, request), onError:message => this.notify(message)
    });
    try {
      let port;
      try { port = await transport.start(this.state.port || 0); }
      catch (error) { if (error.code !== 'EADDRINUSE') throw error; port = await transport.start(0); }
      await this.transaction(state => { state.port = port; state.enabled = true; });
      if (this.stopped) { transport.stop(); return; }
      this.transport = transport;
      this.timer = setInterval(() => { void this.sync().catch(error => this.notify(error.message)); }, 30000);
      this.plugin.registerInterval?.(this.timer);
      this.notify(this.isHost() ? '主设备在线' : '等待连接主设备');
    } catch (error) { transport.stop(); throw error; }
  }
  async pause() {
    if (this.starting) await this.starting.catch(() => {});
    this.transport?.stop(); this.transport = null; clearInterval(this.timer);
    [...this.modals].filter(modal => modal instanceof CockpitTeamApprovalModal).forEach(modal => modal.close());
    await this.transaction(state => { state.enabled = false; }); this.notify('同步已暂停 · 修改保留在本机');
  }
  async offer() {
    teamSyncAssert(this.isHost(), '只有主设备可以邀请成员。');
    await this.start(); return JSON.stringify(this.transport.offer());
  }
  async pair(text) {
    const invite = lanSyncParseInvite(text);
    teamSyncAssert(invite.scope === 'team-v1', '请使用主设备生成的团队邀请。');
    const team = teamSyncInfo(invite.context);
    await this.load();
    teamSyncAssert(team.host !== this.state.device && (!this.state.team || (this.state.team.id === team.id && this.state.team.host === team.host)), '请先退出当前团队，再加入其他团队。');
    await this.start(); const transport = this.transport;
    this.notify('等待主设备批准加入…');
    const result = await transport.request(invite, 'pair');
    teamSyncAssert(this.transport === transport && result.scope === 'team-v1' && result.device === team.host
      && /^[a-f0-9]{64}$/.test(result.key) && result.context?.id === team.id && result.context?.host === team.host, '团队邀请与主设备身份不匹配。');
    await this.transaction(state => {
      teamSyncAssert(!state.team || (state.team.id === team.id && state.team.host === team.host), '团队状态已变化，请重试。');
      const receipt = result.pairState?.receipt;
      if (receipt) {
        teamSyncAssert(teamSyncInteger(receipt.seq) && ['accepted','rejected','conflict'].includes(receipt.status) && teamSyncText(receipt.reason,300));
        const first = state.pending[0];
        teamSyncAssert(!first || first.seq >= receipt.seq, '本机队列落后于主设备，请保留记录并检查备份。');
        if (first?.seq === receipt.seq) {
          if (receipt.status !== 'accepted') {
            teamSyncAssert(state.drafts.length < 100, '请先处理本机草稿。');
            state.drafts.push({ ...first, draftId:this.id(), reason:receipt.reason });
          }
          state.pending.shift();
        }
      }
      let sequence = (receipt?.seq || 0) + 1;
      state.pending.forEach(operation => { operation.seq = sequence++; });
      state.nextSeq = sequence;
      state.team = team;
      state.peers = [{ id:invite.id, key:result.key, device:team.host, name:String(result.name || '主设备').slice(0,60),
        hosts:invite.hosts, port:invite.port, policy:teamSyncDefaultPolicy() }];
    });
    await this.sync();
  }
  async receive(peerId, raw) {
    teamSyncAssert(lanSyncObject(raw), '团队请求无效。');
    return this.transaction(state => {
      teamSyncAssert(this.isHost(state) && raw.teamId === state.team.id, '团队身份不匹配。');
      const peer = state.peers.find(item => item.id === peerId);
      teamSyncAssert(peer, '设备授权已撤销。');
      const receipt = raw.operation == null ? null : teamSyncProcess(state, peer, raw.operation);
      peer.lastSync = Date.now();
      return { ...teamSyncSnapshot(state, peer), receipt };
    });
  }
  async sync() {
    if (this.running || !this.transport || !this.state?.team || this.isHost() || this.stopped) return;
    this.running = true; const transport = this.transport;
    try {
      for (let round = 0; round < 10; round++) {
        const peer = this.state.peers[0]; teamSyncAssert(peer, '主设备授权不可用，请重新加入。');
        const team = this.state.team; const operation = this.state.pending[0] || null;
        const result = await transport.request(peer, 'team-sync', { team:{ teamId:team.id, operation } });
        if (this.transport !== transport || this.stopped) return;
        await this.transaction(state => {
          teamSyncAssert(state.team?.id === team.id && state.peers[0]?.id === peer.id, '团队连接已变化。');
          const snapshot = teamSyncReadSnapshot(result.team, team, state.device);
          teamSyncAssert(snapshot.revision >= state.revision, '主设备记录落后于本机，请检查主设备备份。');
          if (operation) {
            const receipt = result.team.receipt;
            teamSyncAssert(receipt?.seq === operation.seq && ['accepted','rejected','conflict'].includes(receipt.status) && teamSyncText(receipt.reason,300));
            teamSyncAssert(state.pending[0]?.seq === operation.seq, '本机提交队列已变化。');
            if (receipt.status !== 'accepted') {
              teamSyncAssert(state.drafts.length < 100, '草稿已满，请先处理草稿再同步。');
              state.drafts.push({ ...operation, draftId:this.id(), reason:receipt.reason });
            }
            state.pending.shift();
          }
          // 完整授权快照替换本地团队缓存。失去可见性不产生删除操作。
          Object.assign(state, snapshot); state.lastSync = Date.now();
        });
        if (!this.state.pending.length) break;
      }
      this.notify(this.state.pending.length ? '正在同步 · 仍有待提交修改' : '已同步 · ' + new Date().toLocaleTimeString());
    } catch (error) {
      this.notify('主设备暂不可用或授权已变化 · 本机修改已保留');
      throw error;
    } finally { this.running = false; }
  }
  async submit(id, base, value) {
    const checked = teamSyncValue(value);
    await this.transaction(state => {
      teamSyncAssert(state.team, '请先创建或加入团队。');
      const op = teamSyncOperation({ id:id || this.id(), base, value:checked, seq:state.nextSeq });
      const actor = { device:state.device, name:state.name };
      teamSyncAuthorize(state, actor, this.policy(state), op);
      if (checked?.assignee) teamSyncAssert(this.members().some(member => member.device === checked.assignee), '负责人已退出，请重新选择。');
      if (this.isHost(state)) {
        teamSyncAssert((state.tasks[op.id]?.revision || 0) === base, '待办已更新，请重新打开编辑。');
        teamSyncApply(state, actor, op);
      } else {
        teamSyncAssert(state.pending.length < 100 && !state.pending.some(item => item.id === op.id), '此待办尚未同步，或待提交队列已满。');
        state.pending.push(op); state.nextSeq++;
      }
    });
    if (!this.isHost()) { this.notify('修改已保存 · 等待主设备确认'); void this.sync().catch(() => {}); }
  }
  async updateMember(device, policy) {
    const checked = teamSyncPolicy(policy); teamSyncAssert(checked.role !== 'admin');
    await this.transaction(state => {
      teamSyncAssert(this.isHost(state), '只有主设备可以管理权限。');
      const peer = state.peers.find(item => item.device === device); teamSyncAssert(peer, '成员已退出。');
      peer.policy = checked;
    });
  }
  async removeMember(device) {
    await this.transaction(state => {
      teamSyncAssert(this.isHost(state), '只有主设备可以移除成员。');
      state.peers = state.peers.filter(peer => peer.device !== device);
    });
    this.notify('成员授权已撤销 · 已下载的副本无法远程收回');
  }
  async resolve(conflict, useIncoming, expectedRevision) {
    await this.transaction(state => {
      teamSyncAssert(this.isHost(state), '只有主设备可以处理冲突。');
      const index = state.conflicts.findIndex(item => item.token === conflict.token);
      teamSyncAssert(index >= 0, '冲突已处理。');
      const saved = state.conflicts[index];
      teamSyncAssert((state.tasks[saved.id]?.revision || 0) === expectedRevision, '待办已再次更新，请重新查看冲突。');
      if (useIncoming) {
        teamSyncApply(state, { device:state.device, name:state.name }, saved, Date.now(), saved.origin);
      }
      state.conflicts.splice(index, 1);
    });
  }
  async removeDraft(draftId) { await this.transaction(state => { state.drafts = state.drafts.filter(item => item.draftId !== draftId); }); }
  async leave() {
    await this.pause();
    await this.transaction(state => {
      state.team = null; state.peers = []; state.tasks = {}; state.pending = []; state.drafts = []; state.conflicts = [];
      state.policy = null; state.members = []; state.nextSeq = 1; state.revision = 0; delete state.lastSync;
    });
    this.notify('已退出团队 · 原记录保留在本机备份');
  }
  openModal(modal) { if (this.stopped) return; this.modals.add(modal); modal.open(); }
  open() { this.openModal(new CockpitTeamModal(this.plugin.app, this)); }
  stop() {
    this.stopped = true; clearInterval(this.timer); this.transport?.stop(); this.transport = null;
    [...this.modals].forEach(modal => modal.close()); this.modals.clear(); this.listeners.clear();
  }
}
