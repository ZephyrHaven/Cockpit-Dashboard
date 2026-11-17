// dashboard-insights.js — 共用详情窗口与按需日志面板；只展示安全的摘要字段。
class CockpitDetailModal extends CockpitModal {
  constructor(view, title, render) { super(view.app); this.view=view; this.title=title; this.renderBody=render;this.cleanups=[]; }
  onOpen() {
    this.contentEl.createEl('h2',{text:this.title}); this.contentEl.addClass('cockpit-detail');
    this.view._plugin._cockpitDetailModals ||= new Set(); this.view._plugin._cockpitDetailModals.add(this);
    Promise.resolve(this.renderBody(this.contentEl,this)).catch(error=>{ if(!this.closed) this.contentEl.createEl('p',{text:String(error?.message||error)}); });
  }
  registerCleanup(cleanup) { if(this.closed)cleanup();else this.cleanups.push(cleanup); }
  onClose() { this.closed=true;this.cleanups.splice(0).forEach(cleanup=>cleanup()); this.view._plugin._cockpitDetailModals?.delete(this); this.contentEl.empty(); }
}
function cockpitDetailButton(parent,text,action) {
  const button=parent.createEl('button',{text,attr:{type:'button'}});
  button.onclick=async()=>{ button.disabled=true; try { await action(); } catch(error) { new obs.Notice(String(error?.message||error)); } finally { button.disabled=false; } };
  return button;
}
function cockpitTeamVisible(service) {
  const state=service?.state;
  return state?.team ? Object.values(state.tasks||{}).filter(record=>teamSyncCanSee(record,service.policy(),state.device)) : [];
}
function cockpitTeamStats(records, today=window.moment().format('YYYY-MM-DD')) {
  const owners=new Map(); let done=0,overdue=0;
  for(const record of records) {
    const value=record.value; if(value.done) done++;
    const late=!value.done && value.due && (teamTodoDueHasTime(value.due) ? Date.parse(value.due)<Date.now() : value.due.slice(0,10)<today);
    if(late) overdue++;
    const owner=owners.get(value.assignee)||{id:value.assignee,total:0,open:0,overdue:0}; owner.total++; if(!value.done) owner.open++; if(late) owner.overdue++; owners.set(value.assignee,owner);
  }
  return {total:records.length,done,overdue,owners:[...owners.values()].sort((a,b)=>b.open-a.open)};
}
function cockpitTeamCalendar(records) {
  const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Cockpit//Team tasks//EN','CALSCALE:GREGORIAN'];
  for(const record of records.filter(record=>!record.value.done&&record.value.due)) {
    const value=record.value, timed=teamTodoDueHasTime(value.due), due=timed?value.due.replace(/[-:]/g,'').padEnd(15,'0'):value.due.slice(0,10).replace(/-/g,'');
    lines.push('BEGIN:VEVENT','UID:'+record.id+'@cockpit-team','DTSTAMP:'+new Date(record.updatedAt).toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z'),(timed?'DTSTART:':'DTSTART;VALUE=DATE:')+due,'SUMMARY:'+escape(teamTodoTextParts(value.text).text),'DESCRIPTION:'+escape('Team task · '+record.origin.name),'END:VEVENT');
  }
  const folded=lines.flatMap(line=>{ const result=[];let part='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>73){result.push(part);part=' '+char;bytes=1+size;}else{part+=char;bytes+=size;}}result.push(part);return result; });
  return [...folded,'END:VCALENDAR',''].join('\r\n');
}
function cockpitSafeRunError(value) {
  return String(value||'').replace(/https?:\/\/[^\s]+/gi,'[URL]').replace(/(token|api[-_]?key|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi,'$1=[redacted]').slice(0,400);
}
async function cockpitRunRecords(plugin) {
  const data=await plugin.loadData()||{},records=[];
  for(const entry of plugin.scheduledTasks?.readLogs?.()||[]) records.push({at:entry.timestamp,name:entry.name,status:entry.status,error:entry.stderr,type:'task',id:entry.taskId});
  for(const workflow of data.workflows||[]) for(const entry of workflow.runs||[]) records.push({at:entry.at,name:workflow.name,status:entry.status,error:(entry.steps||[]).filter(step=>step.error).map(step=>step.error).join('; '),type:'workflow',id:workflow.id});
  for(const [type,history] of [['brief',data.morningBrief?.sent],['push',data.serverChan?.sentReminders]]) for(const [slot,channels] of Object.entries(history||{})) for(const [channel,entry] of Object.entries(channels||{})) {
    records.push({at:entry.at,name:(type==='brief'?'晨间简报':'待办推送')+' · '+channel,status:entry.ok?'success':'failed',error:entry.error,type,id:channel,slot});
  }
  if(data.appleCalendarSync?.lastSyncResult) records.push({...data.appleCalendarSync.lastSyncResult,name:'系统日历同步',type:'calendar',id:'calendar'});
  return records.filter(record=>record.at).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,60).map(record=>({...record,error:cockpitSafeRunError(record.error)}));
}
async function cockpitRetryRun(view,record) {
  const plugin=view._plugin;
  if(record.type==='task')return plugin.scheduledTasks.runTask(record.id,{trigger:'manual'});
  if(record.type==='workflow') { const result=await plugin.workflows.run(record.id,{trigger:'manual'});return result.ok; }
  if(record.type==='calendar')return plugin.appleCalendar.syncTodos(await loadTodos(view.app.vault)||[],{silent:false});
  if(record.type==='push')return plugin.serverChan.retryReminder(record.slot,record.id);
  if(record.type==='brief') {
    const routing=await plugin.morningBrief.getRouting();
    const config=routing.config,ids=getEnabledChannels(await plugin.serverChan.getConfig());
    const id=ids.find(id=>morningBriefChannelRecordId(config,id,routing.currentDeviceId)===record.id);
    if(!id)throw new Error('该记录属于其他发送设备，或渠道已停用，请在原设备处理。');
    return plugin.morningBrief.deliver([id],{currentDeviceId:routing.currentDeviceId});
  }
  return false;
}
// ── 日志面板共用展示助手 ───────────────────────────────────────────────
// 状态 → 语义色 / 图标 / 文案。成功绿、失败红、中止/部分灰，其余中性。
function cockpitRunStatusMeta(status, en) {
  switch (String(status || '').toLowerCase()) {
    case 'success': return { tone:'ok', icon:'check-circle-2', label:en?'Success':'成功' };
    case 'failed': return { tone:'bad', icon:'x-circle', label:en?'Failed':'失败' };
    case 'aborted': return { tone:'warn', icon:'ban', label:en?'Aborted':'中止' };
    case 'running': return { tone:'busy', icon:'loader', label:en?'Running':'进行中' };
    case 'partial': return { tone:'warn', icon:'alert-triangle', label:en?'Partial':'部分完成' };
    default: return { tone:'muted', icon:'circle', label:String(status || (en?'Unknown':'未知')) };
  }
}
// 运行类型 → 图标与中文名。
function cockpitRunTypeMeta(type, en) {
  switch (type) {
    case 'task': return { icon:'calendar-clock', label:en?'Scheduled task':'定时任务' };
    case 'workflow': return { icon:'workflow', label:en?'Workflow':'自动化流程' };
    case 'brief': return { icon:'sunrise', label:en?'Morning brief':'晨间简报' };
    case 'push': return { icon:'bell', label:en?'Reminder':'待办推送' };
    case 'calendar': return { icon:'calendar-sync', label:en?'Calendar sync':'日历同步' };
    default: return { icon:'activity', label:en?'Run':'运行' };
  }
}
// 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前，超过 30 天回落到日期。
function cockpitRelativeTime(at, en) {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return en ? 'just now' : '刚刚';
  if (min < 60) return en ? (min + ' min ago') : (min + ' 分钟前');
  const hr = Math.floor(min / 60);
  if (hr < 24) return en ? (hr + ' h ago') : (hr + ' 小时前');
  const day = Math.floor(hr / 24);
  if (day < 30) return en ? (day + ' d ago') : (day + ' 天前');
  return new Date(t).toLocaleDateString();
}
// 生成一个状态徽章元素。
function cockpitStatusBadge(parent, meta) {
  const badge = parent.createSpan({ cls:'cockpit-log-badge tone-' + meta.tone });
  try { obs.setIcon(badge.createSpan({ cls:'cockpit-log-badge-icon' }), meta.icon); } catch (e) {}
  badge.createSpan({ cls:'cockpit-log-badge-text', text:meta.label });
  return badge;
}
// 面板顶部的概览统计条（记录总数 / 成功 / 失败）。
function cockpitRunSummaryBar(parent, records, en) {
  const total = records.length;
  let ok = 0, bad = 0;
  records.forEach((r) => { const s = String(r.status || '').toLowerCase(); if (s === 'success') ok++; else if (s === 'failed') bad++; });
  const bar = parent.createDiv({ cls:'cockpit-log-summary' });
  const addStat = (cls, value, label) => {
    const item = bar.createDiv({ cls:'cockpit-log-summary-item ' + cls });
    item.createSpan({ cls:'cockpit-log-summary-value', text:String(value) });
    item.createSpan({ cls:'cockpit-log-summary-label', text:label });
  };
  addStat('', total, en ? 'total' : '总计');
  addStat('tone-ok', ok, en ? 'succeeded' : '成功');
  addStat(bad ? 'tone-bad' : '', bad, en ? 'failed' : '失败');
}

function buildRunHistory(view,root) {
  const en=view._lang()==='en';
  const body = root;
  body.classList.add('cockpit-logs-body');
  let token=0,failedOnly=false;
  const render=async()=>{const current=++token;const records=await cockpitRunRecords(view._plugin);if(current!==token||!body.isConnected)return;body.empty();
    // 工具栏：筛选分段（左） + 刷新/配置服务（右）
    const toolbar = body.createDiv({ cls:'cockpit-log-toolbar' });
    const seg = toolbar.createDiv({ cls:'cockpit-log-seg' });
    const mkSeg = (id, label, count) => {
      const btn = seg.createEl('button', { cls:'cockpit-log-seg-btn' + (failedOnly === (id === 'failed') ? ' is-active' : ''), attr:{ type:'button' } });
      btn.createSpan({ text:label });
      if (count != null) btn.createSpan({ cls:'cockpit-log-seg-count', text:String(count) });
      btn.onclick = () => { failedOnly = (id === 'failed'); return render(); };
    };
    let okCount=0, badCount=0;
    records.forEach((r) => { const s=String(r.status||'').toLowerCase(); if(s==='success') okCount++; else if(s==='failed'||s==='aborted') badCount++; });
    mkSeg('all', en ? 'All' : '全部', records.length);
    mkSeg('failed', en ? 'Failures' : '失败', badCount);
    const right = toolbar.createDiv({ cls:'cockpit-log-toolbar-right' });
    try { obs.setIcon(cockpitDetailButton(right, en?'Refresh':'刷新', render), 'refresh-cw'); } catch(e) { cockpitDetailButton(right, en?'Refresh':'刷新', render); }
    cockpitDetailButton(right, en?'Configure services':'配置服务',()=>new CockpitDetailModal(view,en?'Service settings':'服务配置',(parent,modal)=>{const tab=new CockpitServerChanSettingTab(view.app,view._plugin,cleanup=>modal.registerCleanup(cleanup));tab._activeSection='channels';tab.containerEl=parent;return tab.display();}).open());

    const rows=records.filter(record=>!failedOnly||['failed','aborted'].includes(record.status));
    if(!rows.length){ const empty=body.createDiv({cls:'cockpit-log-empty'}); empty.createEl('p',{text:failedOnly?(en?'No failures recorded.':'没有失败记录，一切正常。'):(en?'No runs recorded yet.':'还没有运行记录。')}); return; }

    // 按日期分组
    const groups = [];
    const groupKey = (at) => { const d=new Date(at); return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); };
    const groupLabel = (at) => { const d=new Date(at); const today=new Date(); const y=new Date(); y.setDate(today.getDate()-1);
      const same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
      if(same(d,today))return en?'Today':'今天'; if(same(d,y))return en?'Yesterday':'昨天';
      return d.toLocaleDateString(en?'en-US':'zh-CN',{month:'long',day:'numeric'}); };
    rows.slice(0,20).forEach((record)=>{ const key=groupKey(record.at); let g=groups[groups.length-1]; if(!g||g.key!==key){g={key,label:groupLabel(record.at),items:[]};groups.push(g);} g.items.push(record); });

    groups.forEach((group)=>{
      const title = body.createDiv({ cls:'cockpit-log-group-title' });
      title.createSpan({ cls:'cockpit-log-group-label', text:group.label });
      title.createSpan({ cls:'cockpit-log-group-count', text:String(group.items.length) });
      const list = body.createDiv({ cls:'cockpit-log-list' });
      group.items.forEach((record)=>{
        const typeMeta = cockpitRunTypeMeta(record.type, en);
        const statusMeta = cockpitRunStatusMeta(record.status, en);
        const failed = ['failed','aborted'].includes(String(record.status||'').toLowerCase());
        const card = list.createDiv({ cls:'cockpit-log-row tone-' + statusMeta.tone });
        // 左：类型图标 + 状态点
        const lead = card.createDiv({ cls:'cockpit-log-row-lead' });
        const iconWrap = lead.createDiv({ cls:'cockpit-log-row-icon' });
        try { obs.setIcon(iconWrap, typeMeta.icon); } catch (e) { iconWrap.setText('•'); }
        lead.createDiv({ cls:'cockpit-log-row-dot tone-' + statusMeta.tone, attr:{ 'aria-label':statusMeta.label } });
        // 主体：标题 + meta
        const main = card.createDiv({ cls:'cockpit-log-row-main' });
        const head = main.createDiv({ cls:'cockpit-log-row-head' });
        head.createSpan({ cls:'cockpit-log-row-title', text:record.name });
        const meta = main.createDiv({ cls:'cockpit-log-row-meta' });
        meta.createSpan({ cls:'cockpit-log-row-type', text:typeMeta.label });
        meta.createSpan({ cls:'cockpit-log-row-sep', text:'·' });
        meta.createSpan({ cls:'cockpit-log-row-time', text:new Date(record.at).toLocaleTimeString(en?'en-US':'zh-CN',{hour:'2-digit',minute:'2-digit'}) + ' · ' + cockpitRelativeTime(record.at, en) });
        if(record.error) main.createEl('p',{cls:'cockpit-log-row-error', text:record.error});
        // 右：失败时保留状态文字与重试
        if(failed || statusMeta.tone!=='ok'){ cockpitStatusBadge(card, statusMeta); }
        if(failed){ const actions = card.createDiv({cls:'cockpit-log-row-actions'}); cockpitDetailButton(actions, en?'Retry':'重试',async()=>{const ok=await cockpitRetryRun(view,record);new obs.Notice(ok?(en?'Completed':'运行完成'):(en?'Not completed; check configuration or the latest result.':'未完成，请检查配置或最新结果。'));await render();}); }
      });
    });
  };const refresh=()=>render().catch(error=>console.warn('Cockpit run history refresh failed',error));refresh();return refresh;
}
function cockpitSyncDiagnostics(plugin) {
  const personal=plugin.lanSync,state=personal?.store?.state,team=plugin.teamSync,teamState=team?.state;
  const conflicts=typeof lanSyncConflicts === 'function' ? lanSyncConflicts(state?.doc||{}).length : 0;
  return [{name:'个人同步',status:personal?.status||'尚未初始化',pending:state?.pending?1:0,conflicts,drafts:0,peers:(state?.peers||[]).map(peer=>({name:peer.name,lastSync:peer.lastSync,error:peer.error,version:peer.metadata?.pluginVersion||'未知'}))},
    {name:'团队同步',status:team?.status||'尚未初始化',pending:teamState?.pending?.length||0,conflicts:teamState?.conflicts?.length||0,drafts:teamState?.drafts?.length||0,lastSync:teamState?.lastSync,peers:(teamState?.peers||[]).map(peer=>({name:peer.name,lastSync:peer.lastSync,error:'',version:peer.metadata?.pluginVersion||'未知'}))}];
}
function buildSyncHealth(view,root) {
  const en=view._lang()==='en';const body=root;body.classList.add('cockpit-logs-body');
  const render=()=>{if(!body.isConnected)return;body.empty();
    const list = body.createDiv({ cls:'cockpit-sync-list' });
    cockpitSyncDiagnostics(view._plugin).forEach((diagnostic,index)=>{
      const connected = diagnostic.status && !/未初始化|尚未初始化|error|failed|offline/i.test(String(diagnostic.status));
      const card = list.createDiv({ cls:'cockpit-sync-card tone-' + (connected ? 'ok' : 'muted') });
      // 头部：图标 + 名称 + 状态徽章 + 操作按钮（右对齐同一行）
      const head = card.createDiv({ cls:'cockpit-sync-head' });
      const iconWrap = head.createDiv({ cls:'cockpit-sync-icon' });
      try { obs.setIcon(iconWrap, index ? 'users' : 'wifi'); } catch (e) { iconWrap.setText('•'); }
      const titleWrap = head.createDiv({ cls:'cockpit-sync-title-wrap' });
      titleWrap.createSpan({ cls:'cockpit-sync-title', text:diagnostic.name });
      cockpitStatusBadge(titleWrap, { tone:connected ? 'ok' : 'muted', icon:connected ? 'check-circle-2' : 'circle', label:String(diagnostic.status || (en?'Not set up':'尚未初始化')) });
      const actions = head.createDiv({ cls:'cockpit-sync-actions' });
      cockpitDetailButton(actions,en?'Manage':'管理',()=>index?view._plugin.teamSync.open():new CockpitDetailModal(view,en?'Nearby devices':'附近设备',(parent,modal)=>renderLanSyncSettings(parent,view._plugin,view._lang(),{registerCleanup:cleanup=>modal.registerCleanup(cleanup)})).open());
      cockpitDetailButton(actions,en?'Sync now':'立即同步',async()=>{const service=index?view._plugin.teamSync:view._plugin.lanSync;if(!service?.transport)throw new Error('请先在管理页开启同步。');await service.sync();render();});
      // 指标 chips 行
      const metrics = card.createDiv({ cls:'cockpit-sync-chips' });
      const addChip = (value, label, tone) => {
        const m = metrics.createDiv({ cls:'cockpit-sync-chip' + (tone ? ' tone-' + tone : '') });
        m.createSpan({ cls:'cockpit-sync-chip-value', text:String(value) });
        m.createSpan({ cls:'cockpit-sync-chip-label', text:label });
      };
      addChip(diagnostic.pending, en?'pending':'待提交', diagnostic.pending ? 'warn' : '');
      addChip(diagnostic.drafts, en?'drafts':'草稿', '');
      addChip(diagnostic.conflicts, en?'conflicts':'冲突', diagnostic.conflicts ? 'bad' : '');
      if(diagnostic.lastSync) metrics.createSpan({ cls:'cockpit-sync-last', text:(en?'Last success ':'最后成功 ')+new Date(diagnostic.lastSync).toLocaleString() });
      if(diagnostic.peers.length){
        const peers = card.createDiv({ cls:'cockpit-sync-peers' });
        diagnostic.peers.forEach(peer=>{
          const p = peers.createDiv({ cls:'cockpit-sync-peer' });
          try { obs.setIcon(p.createSpan({cls:'cockpit-sync-peer-icon'}), peer.error ? 'alert-triangle' : 'monitor'); } catch(e) {}
          p.createSpan({ cls:'cockpit-sync-peer-name', text:peer.name });
          p.createSpan({ cls:'cockpit-sync-peer-meta', text:peer.version + ' · ' + (peer.lastSync?new Date(peer.lastSync).toLocaleString():(en?'Never synced':'尚未同步')) + (peer.error?' · '+peer.error:'') });
        });
      }
    });
  };render();return render;
}

function openCockpitLogs(view) {
  const en = view._lang() === 'en';
  new CockpitDetailModal(view, en ? 'Logs & diagnostics' : '日志与诊断', (root, modal) => {
    root.classList.add('cockpit-logs-shell');
    const header = root.createDiv({ cls:'cockpit-logs-header' });
    header.createEl('p', { cls:'cockpit-logs-subtitle', text:en ? 'Review run results and device connection status on demand.' : '按需查看运行结果与设备连接状态。' });
    const tabs = root.createDiv({ cls:PLUGIN_ID + '-workspace-tabs cockpit-logs-tabs', attr:{ role:'tablist', 'aria-label':en ? 'Log category' : '日志分类' } });
    const panel = root.createDiv({ cls:'cockpit-logs-panel' });
    let refresh = null;
    let closed = false;
    const buttons = [];
    const select = (id) => {
      panel.empty();
      panel.className = 'cockpit-logs-panel';
      buttons.forEach((button) => { const active = button.dataset.logTab === id; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
      const host = panel.createDiv({ cls:'cockpit-logs-host' });
      refresh = id === 'runs' ? buildRunHistory(view, host) : id === 'perf' ? buildPerformancePanel(view, host) : buildSyncHealth(view, host);
    };
    [['runs',en ? 'Run history' : '运行记录'],['sync',en ? 'Sync diagnostics' : '同步诊断'],['perf',en ? 'Performance' : '性能']].forEach(([id,label]) => {
      const button = tabs.createEl('button', { text:label, attr:{ type:'button', role:'tab', 'aria-selected':'false' } });
      button.dataset.logTab = id; button.onclick = () => select(id); buttons.push(button);
      button.onkeydown = (event) => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const last = buttons.length - 1;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : (event.key === 'ArrowRight' ? (buttons.indexOf(button) + 1) % buttons.length : (buttons.indexOf(button) - 1 + buttons.length) % buttons.length);
        select(buttons[next].dataset.logTab); buttons[next].focus();
      };
    });
    cockpitDetailButton(root, en ? 'Toolbar command logs' : '查看工具栏命令日志', () => openCustomToolbarLogs(view));
    select('runs');
    const update = () => { if (!closed) refresh?.(); };
    const off = [];
    modal.registerCleanup(() => { closed = true; refresh = null; off.forEach((dispose) => dispose()); view._plugin.lanSync?.listeners?.delete(update); });
    [view._plugin.teamSync, view._plugin.scheduledTasks, view._plugin.workflows].forEach((service) => { const dispose = service?.subscribe?.(update); if (typeof dispose === 'function') off.push(dispose); });
    view._plugin.lanSync?.listeners?.add(update);
  }).open();
}


function buildPerformancePanel(view, root) {
  const en = view._lang() === 'en';
  root.classList && root.classList.add('cockpit-logs-body');
  const render = () => {
    root.empty();
    const summary = typeof cockpitPerfSummary === 'function' ? cockpitPerfSummary() : null;
    const heat = typeof cockpitPerfRefreshHeat === 'function' ? cockpitPerfRefreshHeat() : null;
    const hasHeat = !!(heat && heat.eventCount);
    if (!summary || (!summary.firstPaintMs && !summary.slowestModules.length && !summary.slowestLabels.length && !hasHeat)) {
      const empty = root.createDiv({ cls:'cockpit-log-empty' });
      empty.createEl('p', { text:en ? 'No performance samples yet. Interact with the cockpit and reopen this panel.' : '还没有性能样本。使用一下驾驶舱后再打开此面板。' });
      return;
    }
    // 顶部统计网格
    const grid = root.createDiv({ cls:'cockpit-perf-grid' });
    const addTile = (value, unit, label, tone) => {
      const tile = grid.createDiv({ cls:'cockpit-perf-tile' + (tone ? ' tone-' + tone : '') });
      tile.createDiv({ cls:'cockpit-perf-tile-label', text:label });
      const v = tile.createDiv({ cls:'cockpit-perf-tile-value' });
      v.createSpan({ cls:'cockpit-perf-tile-num', text:String(value) });
      if (unit) v.createSpan({ cls:'cockpit-perf-tile-unit', text:unit });
    };
    if (summary.firstPaintMs != null) addTile(Math.round(summary.firstPaintMs), 'ms', en ? 'Last full render' : '最近整页渲染', summary.firstPaintMs > 120 ? 'warn' : 'ok');
    if (summary.refresh) addTile(Math.round(summary.refresh.avg), 'ms', (en ? 'Refresh avg · ' : '静默刷新均值 · ') + summary.refresh.count, summary.refresh.avg > 80 ? 'warn' : 'ok');
    if (summary.refresh) addTile(Math.round(summary.refresh.max), 'ms', en ? 'Refresh peak' : '静默刷新峰值', summary.refresh.max > 200 ? 'bad' : '');
    if (hasHeat) addTile(heat.avgFiles.toFixed(1), en ? 'files' : '个', en ? 'Files / refresh' : '每轮读文件', '');

    // 分区表
    const table = (title, rows) => {
      if (!rows.length) return;
      const sec = root.createDiv({ cls:'cockpit-perf-section' });
      sec.createDiv({ cls:'cockpit-perf-section-title', text:title });
      const list = sec.createDiv({ cls:'cockpit-perf-table' });
      rows.forEach((r) => {
        const row = list.createDiv({ cls:'cockpit-perf-trow' + (r.tone ? ' tone-' + r.tone : '') });
        row.createSpan({ cls:'cockpit-perf-trow-name', text:r.name });
        const right = row.createDiv({ cls:'cockpit-perf-trow-right' });
        if (r.sub) right.createSpan({ cls:'cockpit-perf-trow-sub', text:r.sub });
        right.createSpan({ cls:'cockpit-perf-trow-val', text:r.value });
      });
    };
    if (hasHeat) {
      table(en ? 'Refresh heat' : '刷新热力', heat.scopes.map((s) => ({ name:(en?'scope ':'范围 ') + s.scope, value:'×' + s.count })));
    }
    table(en ? 'Slowest modules (last render)' : '最慢模块（最近一次渲染）',
      summary.slowestModules.map((m) => ({ name:m.module, value:Math.round(m.ms) + ' ms', tone:m.ms > 50 ? 'warn' : '' })));
    table(en ? 'Slowest operations (avg)' : '最慢操作（平均）',
      summary.slowestLabels.map((l) => ({ name:l.label, sub:'avg ' + Math.round(l.avg) + ' · max ' + Math.round(l.max) + ' ms', value:'×' + l.count, tone:l.avg > 80 ? 'warn' : '' })));

    const foot = root.createDiv({ cls:'cockpit-perf-foot' });
    foot.createSpan({ cls:'cockpit-detail-muted', text:en ? 'In-memory only; nothing is stored or uploaded.' : '仅驻留内存，不落盘、不上传。' });
    cockpitDetailButton(foot, en ? 'Reset samples' : '重置样本', () => { if (typeof cockpitPerfReset === 'function') cockpitPerfReset(); render(); });
  };
  render();
  return render;
}

function openTodoPatterns(view) {
  const en = view._lang() === 'en';
  new CockpitDetailModal(view, en ? 'Task completion patterns' : '任务完成模式', (root) => {
    const stats = computeTodoPatterns(view._todos || [], window.moment());
    if (!stats.doneCount && !stats.openCount) {
      root.createEl('p', { cls:'cockpit-detail-muted', text:en ? 'No tasks yet. Patterns appear once you complete a few tasks.' : '还没有待办。完成一些任务后，这里会出现你的完成模式。' });
      return;
    }
    const fmtDays = (v) => v == null ? '—' : (v < 1 ? (Math.round(v * 24) + (en ? ' h' : ' 小时')) : (v.toFixed(1) + (en ? ' d' : ' 天')));
    root.createEl('p', { text:(en ? 'Completed ' : '已完成 ') + stats.doneCount + (en ? ' · open ' : ' · 未完成 ') + stats.openCount });
    const summary = [];
    if (stats.avgDoneDays != null) summary.push((en ? 'Avg time to finish: ' : '平均完成耗时：') + fmtDays(stats.avgDoneDays) + (en ? ' (median ' : '（中位 ') + fmtDays(stats.medianDoneDays) + (en ? ')' : '）'));
    if (stats.peakHour != null) summary.push((en ? 'Most completions around ' : '完成高峰约在 ') + String(stats.peakHour).padStart(2, '0') + ':00');
    if (stats.mostBacklogged) summary.push((en ? 'Largest open pile: #' : '积压最多： #') + stats.mostBacklogged.tag + ' (' + stats.mostBacklogged.open + (en ? ' open)' : ' 项未完成)'));
    if (stats.mostOverdue) summary.push((en ? 'Most overdue: #' : '最易逾期： #') + stats.mostOverdue.tag + ' (' + Math.round(stats.mostOverdue.overdueRate * 100) + '% ' + (en ? 'overdue)' : '逾期)'));
    summary.forEach((line) => root.createEl('p', { text:'• ' + line }));
    if (stats.tagRows.length) {
      root.createEl('h3', { text:en ? 'By tag' : '按标签' });
      stats.tagRows.slice(0, 15).forEach((row) => {
        const line = root.createDiv({ cls:'cockpit-detail-row' });
        line.createSpan({ text:'#' + row.tag + (en ? ' · done ' : ' · 完成 ') + row.done + (en ? ' / open ' : ' / 未完成 ') + row.open + (row.avgDoneDays != null ? (en ? ' · avg ' : ' · 均 ') + fmtDays(row.avgDoneDays) : '') });
      });
    }
    root.createEl('p', { cls:'cockpit-detail-muted', text:en ? 'Read-only summary from local task history. Nothing is uploaded.' : '基于本地任务历史的只读统计，不上传任何内容。' });
  }).open();
}

function cockpitMentionedModules(data = {}) {
  const layouts=[data,...Object.values(data.sceneLayouts||{}).map(scene=>scene?.layout||{})];
  return new Set(layouts.flatMap(layout=>[...(Array.isArray(layout.moduleOrder)?layout.moduleOrder:[]),...(Array.isArray(layout.hiddenModules)?layout.hiddenModules:[])]));
}
