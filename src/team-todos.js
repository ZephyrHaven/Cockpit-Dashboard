// team-todos.js — 团队模块仅刷新自身；布局能力统一由模块注册表与折叠助手提供。
class CockpitTeamShareModal extends obs.Modal {
  constructor(app, service) { super(app); this.service = service; }
  async onOpen() {
    teamSyncModalFrame(this, 'share');
    teamSyncHeader(this.contentEl, '分享个人待办', '选择一条待办，下一步确认内容和负责人。个人原件会独立保留。');
    const todos = await loadTodos(this.app.vault);
    if (this.closed) return;
    if (!todos?.length) { this.contentEl.createEl('p', { text:'没有可分享的个人待办。' }); return; }
    const filter = teamSyncField(this.contentEl, '搜索个人待办'); filter.placeholder = '输入任务关键词…';
    const count = this.contentEl.createDiv({ cls:'cockpit-team-list-count', attr:{ role:'status' } });
    const list = this.contentEl.createDiv({ cls:'cockpit-team-share-list' });
    const render = () => {
      list.empty();
      const matches = todos.filter(todo => todo.text.toLowerCase().includes(filter.value.toLowerCase()));
      count.setText('可分享待办 · ' + matches.length + ' 条');
      if (!matches.length) list.createDiv({ text:'没有匹配的待办，试试其他关键词。', cls:'cockpit-team-empty' });
      matches.slice(0,50).forEach(todo => {
        const row = teamSyncButton(list, '', () => {
          this.service.openModal(new CockpitTeamEditorModal(this.app,this.service,null, { text:todo.text + (todo.tags?.length ? ' ' + todo.tags.map(tag => '#' + tag).join(' ') : ''),
          priority:todo.priority || 'mid', due:todo.dueDate ? todo.dueDate.format(todo.dueHasTime ? 'YYYY-MM-DDTHH:mm:ss' : 'YYYY-MM-DD') : '', done:!!todo.done, assignee:this.service.state.device }));
          this.close();
        });
        row.addClass('cockpit-team-share-row');
        row.setAttribute?.('aria-label', '分享个人待办：' + todo.text);
        row.createSpan({ text:todo.done ? '✓' : '○', cls:'cockpit-team-share-status' });
        const copy = row.createSpan({ cls:'cockpit-team-share-copy' });
        copy.createSpan({ text:todo.text, cls:'cockpit-team-share-title' });
        copy.createSpan({ text:(todo.done ? '已完成' : '未完成') + ' · ' + ({ high:'高优先级', mid:'中优先级', low:'低优先级' }[todo.priority] || '中优先级') + (todo.dueDate ? ' · ' + todo.dueDate.format('MM-DD') + ' 截止' : ''), cls:'cockpit-team-share-meta' });
        row.createSpan({ text:'→', cls:'cockpit-team-share-arrow' });
      });
      if (matches.length > 50) list.createEl('p', { text:'仅显示前 50 条，请输入关键词缩小范围。' });
    };
    filter.oninput = render; render();
  }
  onClose() { this.closed = true; this.service.modals.delete(this); this.contentEl.empty(); }
}
function teamTodoViewSignature(state) {
  if (!state) return '';
  const tasks = Object.values(state.tasks || {}).map((task) => [task.id, task.revision, task.value]).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify({ team:state.team, name:state.name, members:state.members, peers:(state.peers || []).map(peer => [peer.device,peer.name,peer.policy]), policy:state.policy, tasks, pending:state.pending, drafts:state.drafts, conflicts:state.conflicts });
}
async function buildTeamTodosModule(view, root) {
  view._teamUnsubscribe?.(); view._teamUnsubscribe = null;
  const token = {}; view._teamBuildToken = token;
  const title = root.createDiv({ cls:PLUGIN_ID + '-section-title', text:view._lang() === 'en' ? 'Team tasks' : '团队待办' });
  title.dataset.section = 'teamTodos-title';
  const body = root.createDiv({ cls:'cockpit-team-todos' }); body.dataset.section = 'teamTodos-body';
  view._makeModuleCollapsible('teamTodos', title, body);
  const service = view._plugin.teamSync;
  if (!service) { body.createEl('p', { text:'团队服务不可用，请重新加载插件。' }); return; }
  await service.load();
  if (view._teamBuildToken !== token) return;
  let filter = 'open', tagFilter = '', limit = 50, statusEl = null, signature = teamTodoViewSignature(service.state);
  const statusText = (state) => service.status + (state.pending.length ? ' · 待提交 ' + state.pending.length : '') + (state.drafts.length ? ' · 草稿 ' + state.drafts.length : '')
    + (state.conflicts.length ? ' · 冲突 ' + state.conflicts.length : '');
  const render = () => {
    body.empty();
    const state = service.state;
    const toolbar = body.createDiv({ cls:'cockpit-team-list-header' });
    const summary = toolbar.createDiv({cls:'cockpit-team-list-summary'});
    summary.createSpan({ text:state.team ? state.team.name : '和同事协作' });
    statusEl = summary.createSpan({ text:statusText(state), cls:'cockpit-team-list-status', attr:{ role:'status', 'aria-live':'polite' } });
    const actions = toolbar.createDiv({cls:'cockpit-team-list-tools'});
    const iconButton = (parent, label, icon, action, text = '') => {
      const button = teamSyncButton(parent, text, action);
      button.className = PLUGIN_ID + '-todo-add';
      button.setAttribute?.('title',label); button.setAttribute?.('aria-label',label);
      if (icon) {
        button.empty(); obs.setIcon?.(button,icon);
        if (!button.querySelector?.('svg')) button.setText(text);
      }
      return button;
    };
    iconButton(actions, state.team ? '管理团队' : '创建 / 加入团队', 'settings', () => service.open(), '⚙');
    if (!state.team) { body.createEl('p', { text:'个人待办默认留在本机。加入后，仅同步主动创建或分享的团队待办。', cls:'cockpit-lan-muted' }); return; }
    const policy = service.policy();
    if (policy.syncTodos && policy.role !== 'viewer' && (policy.canCreate || service.isHost())) {
      iconButton(actions, '分享个人待办', 'share-2', () => service.openModal(new CockpitTeamShareModal(view.app,service)), '↗');
      iconButton(actions, '新增团队待办', null, () => service.openModal(new CockpitTeamEditorModal(view.app,service)), '+');
    }
    const filterWrap = actions.createDiv({ cls:PLUGIN_ID + '-status-select-wrap' });
    obs.setIcon?.(filterWrap.createSpan({ cls:PLUGIN_ID + '-status-select-icon' }), 'list-filter');
    const select = filterWrap.createEl('select', {cls:PLUGIN_ID + '-status-select', attr:{'aria-label':'团队待办状态筛选'}});
    [['open','未完成'],['all','全部'],['done','已完成'],['mine','分配给我']].forEach(([key,label]) => select.createEl('option',{text:label,attr:{value:key}}));
    select.value = filter;
    select.onchange = () => { filter = select.value; limit = 50; render(); };
    const records = new Map(Object.values(state.tasks).filter(task => task.value).map(task => [task.id,task]));
    for (const op of state.pending) {
      if (op.value) records.set(op.id, { ...(records.get(op.id) || { id:op.id, revision:0, origin:{ device:state.device,name:state.name }, createdAt:Date.now() }), value:op.value,
        updatedBy:{ device:state.device,name:state.name }, updatedAt:Date.now() });
    }
    const filtered = [...records.values()].filter(task => filter === 'all' || (filter === 'open' && !task.value.done) || (filter === 'done' && task.value.done) || (filter === 'mine' && task.value.assignee === state.device));
    const availableTags = [...new Set(filtered.flatMap(task => teamTodoTextParts(task.value.text).tags))].sort();
    if (!availableTags.includes(tagFilter)) tagFilter = '';
    const tabs = body.createDiv({cls:PLUGIN_ID + '-todo-tabs cockpit-team-list-tabs'});
    ['',...availableTags].forEach(tag => {
      const tab = tabs.createEl('button',{cls:PLUGIN_ID + '-todo-tab' + (tagFilter === tag ? ' active' : ''),text:tag ? '#' + tag : '全部',attr:{type:'button'}});
      tab.onclick = () => { tagFilter = tag; limit = 50; render(); };
    });
    const rows = filtered.filter(task => !tagFilter || teamTodoTextParts(task.value.text).tags.includes(tagFilter));
    const priorityOrder = {high:0,mid:1,low:2};
    rows.sort((a,b) => Number(a.value.done) - Number(b.value.done) || priorityOrder[a.value.priority] - priorityOrder[b.value.priority] || b.updatedAt - a.updatedAt);
    const list = body.createDiv({cls:PLUGIN_ID + '-todos'});
    if (!rows.length) {
      const empty = body.createDiv({ cls:'cockpit-team-empty' });
      empty.createDiv({ text:policy.syncTodos ? '还没有符合条件的团队待办' : '团队待办同步尚未开启', cls:'cockpit-team-empty-title' });
      empty.createEl('p', { text:policy.syncTodos ? '新建一条任务，或从个人待办中选择分享。' : '联系主设备管理员，为本机开启同步权限。' });
    }
    for (const record of rows.slice(0,limit)) {
      const pending = state.pending.find(op => op.id === record.id);
      const editable = !pending && teamSyncCanEdit(record,policy,state.device);
      const card = list.createDiv({ cls:PLUGIN_ID + '-todo' + (record.value.done ? ' done' : '') });
      const change = async (changes) => { await service.submit(record.id,record.revision,{...record.value,...changes}); };
      card.createDiv({cls:PLUGIN_ID + '-todo-pdot p-' + record.value.priority});
      const toggle = teamSyncButton(card, record.value.done ? '✓' : '', () => change({done:!record.value.done}));
      toggle.className = PLUGIN_ID + '-todo-chk'; toggle.disabled = !editable;
      toggle.setAttribute?.('aria-label','完成：' + record.value.text); toggle.setAttribute?.('aria-pressed',String(record.value.done));
      const main = card.createDiv({cls:PLUGIN_ID + '-todo-main'});
      const parts = teamTodoTextParts(record.value.text);
      const text = main.createDiv({cls:PLUGIN_ID + '-todo-text',text:parts.text});
      if (editable) text.onclick = () => service.openModal(new CockpitTeamEditorModal(view.app,service,record));
      const owner = service.members().find(member => member.device === record.value.assignee);
      const meta = main.createDiv({cls:PLUGIN_ID + '-todo-meta'});
      meta.createSpan({text:'负责人：' + (owner?.name || '未分配')});
      if (record.value.due) meta.createSpan({cls:PLUGIN_ID + '-todo-due due-future',text:record.value.due.replace('T',' ')});
      meta.createSpan({text:'来源：' + record.origin.name});
      parts.tags.forEach(tag => {
        const pill = meta.createSpan({cls:PLUGIN_ID + '-todo-tag-pill',text:'#' + tag});
        pill.onclick = () => { tagFilter = tag; render(); };
      });
      meta.title = '创建设备：' + record.origin.name + '（' + record.origin.device + '）\n修改设备：' + record.updatedBy.name + '（' + record.updatedBy.device + '）\n更新时间：' + new Date(record.updatedAt).toLocaleString();
      card.createDiv({cls:PLUGIN_ID + '-todo-tag ' + (record.value.done ? 'tag-done' : 'tag-todo'),text:pending ? '待同步' : record.value.done ? '已完成' : '进行中'});
      if (editable) {
        const picker = card.createDiv({cls:PLUGIN_ID + '-prio-picker'});
        ['high','mid','low'].forEach(priority => {
          const button = teamSyncButton(picker, '', () => change({priority}));
          button.className = PLUGIN_ID + '-prio-opt p-' + priority + (priority === record.value.priority ? ' sel' : '');
          button.setAttribute?.('aria-label',({high:'高',mid:'中',low:'低'}[priority]) + '优先级');
        });
        const controls = card.createDiv({ cls:PLUGIN_ID + '-todo-actions' });
        const edit = iconButton(controls, '编辑团队待办', 'square-pen', () => service.openModal(new CockpitTeamEditorModal(view.app,service,record)), '✎');
        edit.className = PLUGIN_ID + '-todo-btn';
        if (policy.canDelete) {
          const remove = iconButton(controls, '删除团队待办', 'trash-2', () => service.openModal(new CockpitTeamConfirmModal(view.app,service,'删除此团队待办？删除会同步到有权查看的成员设备。',
            () => service.submit(record.id,record.revision,null))), '×');
          remove.className = PLUGIN_ID + '-todo-btn del';
        }
      }
    }
    if (rows.length > limit) teamSyncButton(body, '加载更多（共 ' + rows.length + ' 条）', () => { limit += 50; render(); });
  };
  render();
  view._teamUnsubscribe = service.subscribe(() => {
    const nextSignature = teamTodoViewSignature(service.state);
    // A 30-second sync heartbeat updates transport timestamps and status text,
    // but should not rebuild the task cards underneath the user's pointer.
    if (nextSignature !== signature) { signature = nextSignature; render(); }
    else statusEl?.setText(statusText(service.state));
  });
}
