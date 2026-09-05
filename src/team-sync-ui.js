// team-sync-ui.js — 团队管理与编辑弹窗；网络刷新不重建正在填写的表单。
function teamSyncButton(container, label, action, primary = false) {
  const button = container.createEl('button', { text:label, cls:'cockpit-team-button' + (primary ? ' mod-cta' : ''), attr:{ type:'button' } });
  button.onclick = async () => {
    button.disabled = true;
    try { await action(); } catch (error) { new obs.Notice(error.message || '操作失败，请重试。'); }
    finally { button.disabled = false; }
  };
  return button;
}
function teamSyncModalFrame(modal, variant = '') {
  modal.modalEl?.addClass('cockpit-team-dialog');
  if (variant) modal.modalEl?.addClass('cockpit-team-dialog-' + variant);
  modal.contentEl.addClass('cockpit-team-modal');
}
function teamSyncHeader(container, title, description = '') {
  const header = container.createDiv({ cls:'cockpit-team-dialog-header' });
  header.createSpan({ text:'团队空间', cls:'cockpit-team-eyebrow' });
  header.createEl('h2', { text:title });
  if (description) header.createEl('p', { text:description, cls:'cockpit-team-subtitle' });
}
function teamSyncSection(container, title, description = '') {
  const section = container.createDiv({ cls:'cockpit-team-section' });
  section.createEl('h3', { text:title });
  if (description) section.createEl('p', { text:description, cls:'cockpit-team-subtitle' });
  return section;
}
function teamSyncField(container, label, value = '', type = 'text') {
  const row = container.createEl('label', { cls:type === 'checkbox' ? 'cockpit-team-switch-row' : 'cockpit-team-field' }); row.createSpan({ text:label });
  const input = row.createEl('input', { attr:{ type } }); input.value = value;
  if (type === 'checkbox') {
    input.addClass('cockpit-team-switch'); input.setAttribute?.('role', 'switch');
    row.createSpan({ cls:'cockpit-team-switch-track', attr:{ 'aria-hidden':'true' } });
  }
  return input;
}
function teamSyncSelect(container, label, values, selected, options = {}) {
  const row = container.createEl('label', { cls:'cockpit-team-field' + (options.className ? ' ' + options.className : '') });
  if (!options.hideLabel) row.createSpan({ text:label });
  const input = row.createEl('select', { attr:{ 'aria-label':label, title:label } });
  values.forEach(([value,text]) => input.createEl('option', { text, attr:{ value } }));
  input.value = selected; return input;
}
function teamSyncPolicyFields(container, policy = teamSyncDefaultPolicy()) {
  const grid = container.createDiv({ cls:'cockpit-team-form-grid' });
  const role = teamSyncSelect(grid, '成员角色', [['editor','协作成员'],['viewer','只读成员']], policy.role);
  const visibility = teamSyncSelect(grid, '可见范围', [['all','全部团队待办'],['assigned','仅分配给该设备的待办']], policy.visibility);
  const create = teamSyncField(container, '允许创建团队待办', '', 'checkbox'); create.checked = policy.canCreate;
  const remove = teamSyncField(container, '允许删除分配给自己的待办', '', 'checkbox'); remove.checked = policy.canDelete;
  const sync = teamSyncField(container, '同步团队待办', '', 'checkbox'); sync.checked = policy.syncTodos;
  container.createEl('p', { text:'关闭同步后，对方下次连接会清空团队缓存；只读成员不可创建、修改或删除。', cls:'cockpit-team-hint' });
  const update = () => { create.disabled = remove.disabled = role.value === 'viewer'; }; role.onchange = update; update();
  return () => ({ role:role.value, visibility:visibility.value, canCreate:role.value === 'editor' && create.checked,
    canDelete:role.value === 'editor' && remove.checked, syncTodos:sync.checked });
}
class CockpitTeamApprovalModal extends obs.Modal {
  constructor(app, service, name, resolve) { super(app); this.service = service; this.name = name; this.resolve = resolve; }
  onOpen() {
    teamSyncModalFrame(this, 'approval');
    teamSyncHeader(this.contentEl, '批准设备加入团队');
    this.contentEl.createEl('p', { text:this.name + ' 申请加入「' + this.service.state.team.name + '」。请核对这是你要邀请的设备。' });
    const policy = teamSyncPolicyFields(this.contentEl);
    this.contentEl.createEl('p', { text:'协作成员默认只能修改分配给自己的待办。个人待办、昵称、语言和收藏不参与团队同步。', cls:'cockpit-lan-muted' });
    const actions = this.contentEl.createDiv({ cls:'cockpit-team-footer' });
    teamSyncButton(actions, '拒绝', () => this.close());
    teamSyncButton(actions, '批准加入', () => { this.resolve?.(policy()); this.resolve = null; this.close(); }, true);
    this.timer = setTimeout(() => this.close(), 60000);
  }
  onClose() { clearTimeout(this.timer); this.resolve?.(false); this.resolve = null; this.service.modals.delete(this); this.contentEl.empty(); }
}
class CockpitTeamConfirmModal extends obs.Modal {
  constructor(app, service, text, action) { super(app); this.service = service; this.text = text; this.action = action; }
  onOpen() {
    teamSyncModalFrame(this, 'confirm');
    teamSyncHeader(this.contentEl, '确认操作'); this.contentEl.createEl('p', { text:this.text });
    const actions = this.contentEl.createDiv({ cls:'cockpit-team-footer' });
    teamSyncButton(actions, '取消', () => this.close());
    teamSyncButton(actions, '确认', async () => { await this.action(); this.close(); });
  }
  onClose() { this.service.modals.delete(this); this.contentEl.empty(); }
}
class CockpitTeamEditorModal {
  constructor(app, service, record = null, initial = null) { this.app = app; this.service = service; this.record = record; this.initial = initial; }
  open() { this.onOpen(); }
  close() { this.onClose(); }
  onOpen() {
    const service = this.service; const record = this.record;
    const value = this.initial || record?.value || { text:'', done:false, priority:'mid', due:'', assignee:service.state.device };
    const PID = PLUGIN_ID;
    const overlay = document.body.createDiv({ cls:PID + '-todo-editor-backdrop' });
    overlay.onclick = event => { if (event.target === overlay) this.close(); };
    this.overlay = overlay;
    this.contentEl = overlay.createDiv({ cls:PID + '-todo-editor-sheet' });
    const header = this.contentEl.createDiv({ cls:PID + '-todo-editor-header' });
    header.createDiv({ cls:PID + '-todo-editor-title', text:record ? '编辑团队待办' : '新增团队待办' });
    const close = header.createEl('button', { cls:PID + '-todo-editor-close', text:'✕', attr:{type:'button', 'aria-label':'关闭'} });
    close.onclick = () => this.close();
    this.dragCleanup = makeCockpitDialogDraggable(this.contentEl, header, { label:'拖动团队待办编辑窗口' });
    const form = this.contentEl.createDiv({ cls:PID + '-todo-editor-body' });
    const field = (label) => {
      const row = form.createDiv({ cls:PID + '-todo-editor-field' });
      row.createDiv({ cls:PID + '-todo-editor-label', text:label });
      return row;
    };
    const parts = teamTodoTextParts(value.text);
    let tags = parts.tags, priority = value.priority;
    const title = field('待办内容').createEl('textarea', { cls:PID + '-todo-editor-textarea', attr:{rows:'3', placeholder:'例如：整理周报', 'aria-label':'待办内容'} });
    title.value = parts.text; title.maxLength = 2000;
    const dueField = field('截止日期');
    const quick = dueField.createDiv({ cls:PID + '-todo-editor-quick' });
    const due = dueField.createEl('input', { cls:PID + '-todo-editor-date', attr:{type:'datetime-local', step:'1', 'aria-label':'截止日期'} });
    due.value = value.due?.length === 10 ? value.due + 'T00:00:00' : value.due || '';
    const datePreset = (offset) => {
      const d = new Date(); d.setDate(d.getDate() + offset);
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    };
    const renderDue = () => {
      quick.empty();
      [['不设置',''], ['今天',datePreset(0)], ['明天',datePreset(1)]].forEach(([label,date]) => {
        const active = date ? due.value.startsWith(date) : !due.value;
        const button = quick.createEl('button', {cls:PID + '-todo-editor-chip' + (active ? ' active' : ''), text:label, attr:{type:'button', 'aria-pressed':String(active)}});
        button.onclick = () => { due.value = date ? date + 'T00:00:00' : ''; renderDue(); };
      });
    };
    due.onchange = renderDue; renderDue();
    const priorityRow = field('优先级').createDiv({ cls:PID + '-todo-editor-segment' });
    const renderPriority = () => {
      priorityRow.empty();
      [['high','高优先级'],['mid','中优先级'],['low','低优先级']].forEach(([key,label]) => {
        const button = priorityRow.createEl('button', {cls:PID + '-todo-editor-segment-btn' + (priority === key ? ' active' : ''), text:label, attr:{type:'button', 'aria-pressed':String(priority === key)}});
        button.onclick = () => { priority = key; renderPriority(); };
      });
    };
    renderPriority();
    const tagField = field('标签');
    const selectedTags = tagField.createDiv({cls:PID + '-todo-editor-selected-tags'});
    const suggestions = tagField.createDiv({cls:PID + '-todo-editor-tags'});
    const knownTags = new Set(Object.values(service.state.tasks || {}).flatMap(task => teamTodoTextParts(task.value?.text).tags));
    const tagInputRow = tagField.createDiv({cls:PID + '-todo-editor-tag-input-row'});
    const tagInput = tagInputRow.createEl('input', {cls:PID + '-todo-editor-tag-input', attr:{type:'text', placeholder:'新标签', 'aria-label':'新标签'}});
    const renderTags = () => {
      selectedTags.empty(); suggestions.empty();
      if (!tags.length) selectedTags.createDiv({cls:PID + '-todo-editor-empty', text:'未选择标签'});
      const toggle = tag => { tags = tags.includes(tag) ? tags.filter(item => item !== tag) : [...tags,tag]; renderTags(); };
      tags.forEach(tag => {
        const button = selectedTags.createEl('button', {cls:PID + '-todo-editor-selected-tag', text:'#' + tag + ' ×', attr:{type:'button'}});
        button.onclick = () => toggle(tag);
      });
      knownTags.forEach(tag => {
        const button = suggestions.createEl('button', {cls:PID + '-todo-editor-chip' + (tags.includes(tag) ? ' active' : ''), text:'#' + tag, attr:{type:'button'}});
        button.onclick = () => toggle(tag);
      });
    };
    const addTag = () => {
      const tag = tagInput.value.trim().replace(/^#+/,'').replace(/\s+/g,'-');
      if (!tag) return;
      knownTags.add(tag); if (!tags.includes(tag)) tags.push(tag);
      tagInput.value = ''; renderTags();
    };
    const addTagButton = tagInputRow.createEl('button', {cls:PID + '-todo-editor-secondary-btn', text:'添加标签', attr:{type:'button'}});
    addTagButton.onclick = addTag;
    tagInput.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } };
    renderTags();
    const members = service.members();
    if (value.assignee && !members.some(member => member.device === value.assignee)) members.push({ device:value.assignee, name:'已退出的成员' });
    const assignee = field('负责人设备').createEl('select', {cls:PID + '-todo-editor-date', attr:{'aria-label':'负责人设备'}});
    [['','未分配'], ...members.map(member => [member.device,member.name])].forEach(([id,name]) => assignee.createEl('option', {text:name, attr:{value:id}}));
    assignee.value = value.assignee;
    assignee.disabled = !service.isHost();
    const done = teamSyncField(form, '标记为已完成', '', 'checkbox'); done.checked = value.done;
    form.createDiv({text:'标签随团队待办同步。保存后按团队权限分发给成员。', cls:PID + '-todo-editor-hint'});
    const actions = this.contentEl.createDiv({ cls:PID + '-todo-editor-footer' });
    teamSyncButton(actions, '取消', () => this.close()).className = PID + '-todo-editor-secondary-btn';
    const save = teamSyncButton(actions, '保存', async () => {
      if (!title.value.trim()) { title.focus(); return; }
      await service.submit(record?.id || null, record?.revision || 0, { text:teamTodoComposeText(title.value, tags), priority, due:due.value, assignee:assignee.value, done:done.checked });
      this.close();
    }, true);
    save.className = PID + '-todo-editor-primary-btn';
    this.contentEl.onkeydown = event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); if (!save.disabled) save.onclick(); } };
    title.focus();
  }
  onClose() {
    this.dragCleanup?.(); this.dragCleanup = null;
    this.service.modals.delete(this); this.overlay?.remove?.(); this.overlay = null;
  }
}
function teamSyncDescribe(value) {
  if (!value) return '删除此待办';
  return (value.done ? '已完成 · ' : '未完成 · ') + value.text + '\n优先级：' + ({ high:'高',mid:'中',low:'低' }[value.priority])
    + (value.due ? ' · 截止：' + value.due : '') + '\n负责人设备 ID：' + (value.assignee || '未分配');
}
class CockpitTeamModal extends obs.Modal {
  constructor(app, service) { super(app); this.service = service; }
  async onOpen() {
    teamSyncModalFrame(this, 'manager');
    try { await this.service.load(); if (this.closed) return; this.render(); }
    catch (error) { if (!this.closed) this.contentEl.createEl('p', { text:error.message }); }
  }
  render() {
    const service = this.service; const state = service.state;
    this.unsubscribe?.(); this.contentEl.empty();
    teamSyncHeader(this.contentEl, state.team ? state.team.name : '建立你的团队空间', state.team ? (service.isHost() ? '主设备 · 管理成员、授权与同步' : '成员设备 · 查看连接与同步状态') : '连接附近的同事，共同推进团队待办。');
    const status = this.contentEl.createEl('p', { text:service.status, cls:'cockpit-team-connection', attr:{ role:'status', 'aria-live':'polite' } });
    this.unsubscribe = service.subscribe(() => status.setText(service.status));
    const deviceSection = teamSyncSection(this.contentEl, '本机设备', '使用容易辨认的名称，方便同事识别待办来源。');
    const deviceRow = deviceSection.createDiv({ cls:'cockpit-team-device-form' });
    const deviceName = teamSyncField(deviceRow, '本机设备名称', state.name); deviceName.maxLength = 60;
    teamSyncButton(deviceRow, '保存名称', async () => {
      teamSyncAssert(teamSyncText(deviceName.value,60) && deviceName.value.trim(), '请填写设备名称。');
      await service.transaction(next => { next.name = deviceName.value.trim(); });
      new obs.Notice(service.isHost() ? '设备名称已保存，历史来源名称保留。' : '设备名称已保存；主设备上的名称需重新配对后更新。');
    });
    if (!state.team) {
      const setup = teamSyncSection(this.contentEl, '开始协作', '选择一台常用电脑作为主设备。成员只需与主设备配对，主设备统一审批和分发团队待办。');
      const name = teamSyncField(setup, '团队名称'); name.maxLength = 80; name.placeholder = '例如：产品研发小组';
      const actions = setup.createDiv({ cls:'cockpit-team-footer' });
      teamSyncButton(actions, '创建团队（本机为主设备）', async () => { await service.create(name.value); this.render(); }, true);
      teamSyncButton(actions, '扫码 / 导入邀请加入', () => service.openModal(new CockpitLanPairModal(this.app, service, 'scan')));
      teamSyncButton(actions, '刷新加入结果', () => this.render());
      return;
    }
    this.contentEl.createEl('p', { text:service.isHost() ? '本机是主设备。成员修改必须由本机确认；主设备离线期间，成员可以查看缓存并暂存修改。' : '本机是成员设备。只接收主设备授权的团队待办；来源始终记录最初创建的设备。' });
    const actions = this.contentEl.createDiv({ cls:'cockpit-lan-actions' });
    teamSyncButton(actions, service.transport ? '暂停同步' : '开启同步', async () => { await (service.transport ? service.pause() : service.start()); this.render(); });
    if (service.isHost()) teamSyncButton(actions, '邀请成员', () => service.openModal(new CockpitLanPairModal(this.app, service, 'show')), true);
    else {
      teamSyncButton(actions, '立即同步', async () => { await service.start(); await service.sync(); this.render(); });
      teamSyncButton(actions, '重新配对主设备', () => service.openModal(new CockpitLanPairModal(this.app, service, 'scan')));
    }
    teamSyncButton(actions, '刷新管理列表', () => this.render());
    if (service.policy().canCreate || service.isHost()) teamSyncButton(actions, '新建团队待办', () => service.openModal(new CockpitTeamEditorModal(this.app,service)));
    if (service.isHost()) this.renderMembers();
    this.renderDrafts();
    if (service.isHost()) this.renderConflicts();
    this.contentEl.createEl('p', { cls:'cockpit-lan-muted', text:'仅同步团队待办、设备来源和成员名称。授权范围外的内容不会发送；移除成员无法远程收回已下载副本。成员设备更换网络地址后，可用新邀请重新配对。' });
    const danger = this.contentEl.createDiv({ cls:'cockpit-team-danger-zone' });
    teamSyncButton(danger, service.isHost() ? '解散本机团队' : '退出团队', () => service.openModal(new CockpitTeamConfirmModal(this.app, service,
      '将清空本机团队缓存、待提交修改和草稿，并关闭团队连接。原记录先备份到插件目录；其他电脑已有的副本不会被远程删除。', async () => { await service.leave(); this.render(); })));
  }
  renderMembers() {
    const service = this.service;
    const members = teamSyncSection(this.contentEl, '成员与权限', '展开成员卡片，分别设置可见范围与操作权限。');
    if (!service.state.peers.length) members.createDiv({ text:'尚无成员 · 点击「邀请成员」开始协作', cls:'cockpit-team-empty' });
    for (const peer of service.state.peers) {
      const card = members.createEl('details', { cls:'cockpit-team-member' });
      const summary = card.createEl('summary');
      summary.createSpan({ text:peer.name.slice(0,1), cls:'cockpit-team-avatar' });
      summary.createSpan({ text:peer.name, cls:'cockpit-team-member-name' });
      summary.createSpan({ text:peer.policy.role === 'viewer' ? '只读成员' : '协作成员', cls:'cockpit-team-badge' });
      const panel = card.createDiv({ cls:'cockpit-team-member-body' });
      panel.createEl('p', { text:'设备 ID：' + peer.device + (peer.lastSync ? ' · 上次同步：' + new Date(peer.lastSync).toLocaleString() : ' · 尚未同步'), cls:'cockpit-lan-muted' });
      const getPolicy = teamSyncPolicyFields(panel, peer.policy);
      const actions = panel.createDiv({ cls:'cockpit-team-footer' });
      teamSyncButton(actions, '保存权限', async () => { await service.updateMember(peer.device, getPolicy()); this.render(); }, true);
      teamSyncButton(actions, '移除成员', () => service.openModal(new CockpitTeamConfirmModal(this.app,service,
        '撤销「' + peer.name + '」的连接权限。对方已下载的内容无法远程收回。', async () => { await service.removeMember(peer.device); this.render(); })));
    }
  }
  renderDrafts() {
    const service = this.service; const state = service.state;
    if (state.pending.length) this.contentEl.createEl('p', { text:'等待主设备确认：' + state.pending.length + ' 项。尚未确认的同一条待办暂时不能再次编辑。' });
    if (!state.drafts.length) return;
    this.contentEl.createEl('h3', { text:'保留的本机草稿' });
    this.contentEl.createEl('p', { text:'被拒绝或产生冲突的修改保存在这里，不会自动重试覆盖团队版本。处理后可手动移除草稿。' });
    for (const draft of state.drafts) {
      const card = this.contentEl.createDiv({ cls:'cockpit-lan-card' });
      card.createEl('p', { text:draft.reason }); card.createEl('pre', { text:teamSyncDescribe(draft.value), cls:'cockpit-team-detail' });
      const actions = card.createDiv({ cls:'cockpit-lan-actions' });
      teamSyncButton(actions, '复制草稿', () => navigator.clipboard.writeText(teamSyncDescribe(draft.value)));
      const current = state.tasks[draft.id];
      if (draft.value && teamSyncCanEdit(current, service.policy(), state.device)) {
        teamSyncButton(actions, '以最新版本重新编辑', () => service.openModal(new CockpitTeamEditorModal(this.app, service, current, { ...draft.value, assignee:current.value.assignee })));
      }
      teamSyncButton(actions, '移除草稿', () => service.openModal(new CockpitTeamConfirmModal(this.app,service,'移除此本机草稿？团队待办不受影响。',async () => { await service.removeDraft(draft.draftId); this.render(); })));
    }
  }
  renderConflicts() {
    const service = this.service;
    if (!service.state.conflicts.length) return;
    this.contentEl.createEl('h3', { text:'待处理冲突' });
    for (const conflict of service.state.conflicts) {
      const current = service.state.tasks[conflict.id];
      const card = this.contentEl.createDiv({ cls:'cockpit-lan-card' });
      card.createEl('p', { text:conflict.name + ' 提交于 ' + new Date(conflict.time).toLocaleString() });
      card.createEl('strong', { text:'当前团队版本' }); card.createEl('pre', { text:teamSyncDescribe(current?.value), cls:'cockpit-team-detail' });
      card.createEl('strong', { text:'成员提交版本' }); card.createEl('pre', { text:teamSyncDescribe(conflict.value), cls:'cockpit-team-detail' });
      const actions = card.createDiv({ cls:'cockpit-lan-actions' });
      teamSyncButton(actions, '保留当前版本', async () => { await service.resolve(conflict,false,current?.revision || 0); this.render(); });
      teamSyncButton(actions, '采用成员版本', async () => { await service.resolve(conflict,true,current?.revision || 0); this.render(); });
    }
  }
  onClose() { this.closed = true; this.unsubscribe?.(); this.service.modals.delete(this); this.contentEl.empty(); }
}
