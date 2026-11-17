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
  body.classList.add('cockpit-insights');
  let token=0,failedOnly=false;
  const render=async()=>{const current=++token;const records=await cockpitRunRecords(view._plugin);if(current!==token||!body.isConnected)return;body.empty();
    // 工具栏：刷新 + 筛选分段 + 配置服务
    const toolbar = body.createDiv({ cls:'cockpit-log-toolbar' });
    const left = toolbar.createDiv({ cls:'cockpit-log-toolbar-left' });
    const seg = left.createDiv({ cls:'cockpit-log-seg' });
    const mkSeg = (id, label) => {
      const btn = seg.createEl('button', { cls:'cockpit-log-seg-btn' + (failedOnly === (id === 'failed') ? ' is-active' : ''), attr:{ type:'button' }, text:label });
      btn.onclick = () => { failedOnly = (id === 'failed'); return render(); };
      return btn;
    };
    mkSeg('all', en ? 'All' : '全部');
    mkSeg('failed', en ? 'Failures' : '只看失败');
    const right = toolbar.createDiv({ cls:'cockpit-log-toolbar-right' });
    try { obs.setIcon(cockpitDetailButton(right, en?'Refresh':'刷新', render), 'refresh-cw'); } catch(e) { cockpitDetailButton(right, en?'Refresh':'刷新', render); }
    cockpitDetailButton(right, en?'Configure services':'配置服务',()=>new CockpitDetailModal(view,en?'Service settings':'服务配置',(parent,modal)=>{const tab=new CockpitServerChanSettingTab(view.app,view._plugin,cleanup=>modal.registerCleanup(cleanup));tab._activeSection='channels';tab.containerEl=parent;return tab.display();}).open());
    // 概览条（基于全部记录）
    cockpitRunSummaryBar(body, records, en);
    const rows=records.filter(record=>!failedOnly||['failed','aborted'].includes(record.status));
    if(!rows.length){ const empty=body.createDiv({cls:'cockpit-log-empty'}); empty.createEl('p',{text:en?'No matching runs yet.':'暂无符合条件的运行记录。'}); return; }
    const list = body.createDiv({ cls:'cockpit-log-list' });
    rows.slice(0,12).forEach(record=>{
      const typeMeta = cockpitRunTypeMeta(record.type, en);
      const statusMeta = cockpitRunStatusMeta(record.status, en);
      const failed = ['failed','aborted'].includes(String(record.status||'').toLowerCase());
      const card= list.createDiv({ cls:'cockpit-log-card tone-' + statusMeta.tone });
      const accent = card.createDiv({ cls:'cockpit-log-card-accent' });
      const iconWrap = card.createDiv({ cls:'cockpit-log-card-icon' });
      try { obs.setIcon(iconWrap, typeMeta.icon); } catch (e) { iconWrap.setText('•'); }
      const main = card.createDiv({ cls:'cockpit-log-card-main' });
      const head = main.createDiv({ cls:'cockpit-log-card-head' });
      head.createSpan({ cls:'cockpit-log-card-title', text:record.name });
      cockpitStatusBadge(head, statusMeta);
      const meta = main.createDiv({ cls:'cockpit-log-card-meta' });
      meta.createSpan({ cls:'cockpit-log-card-type', text:typeMeta.label });
      meta.createSpan({ cls:'cockpit-log-card-dot', text:'·' });
      meta.createSpan({ cls:'cockpit-log-card-rel', text:cockpitRelativeTime(record.at, en) });
      meta.createSpan({ cls:'cockpit-log-card-dot', text:'·' });
      meta.createSpan({ cls:'cockpit-log-card-abs', text:new Date(record.at).toLocaleString() });
      if(record.error) main.createEl('p',{cls:'cockpit-log-card-error', text:record.error});
      if(failed){ const actions = card.createDiv({cls:'cockpit-log-card-actions'}); cockpitDetailButton(actions,record.type==='workflow'?(en?'Rerun entire workflow':'重新运行整个流程'):(en?'Retry using current configuration':'按当前配置重试'),async()=>{const ok=await cockpitRetryRun(view,record);new obs.Notice(ok?(en?'Completed':'运行完成'):(en?'Not completed; check configuration or the latest result.':'未完成，请检查配置或最新结果。'));await render();}); }
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
  const en=view._lang()==='en';const body=root;body.classList.add('cockpit-insights');
  const render=()=>{if(!body.isConnected)return;body.empty();
    const list = body.createDiv({ cls:'cockpit-log-list' });
    cockpitSyncDiagnostics(view._plugin).forEach((diagnostic,index)=>{
      const connected = diagnostic.status && !/未初始化|尚未初始化|error|failed|offline/i.test(String(diagnostic.status));
      const card = list.createDiv({ cls:'cockpit-log-card tone-' + (connected ? 'ok' : 'muted') });
      card.createDiv({ cls:'cockpit-log-card-accent' });
      const iconWrap = card.createDiv({ cls:'cockpit-log-card-icon' });
      try { obs.setIcon(iconWrap, index ? 'users' : 'wifi'); } catch (e) { iconWrap.setText('•'); }
      const main = card.createDiv({ cls:'cockpit-log-card-main' });
      const head = main.createDiv({ cls:'cockpit-log-card-head' });
      head.createSpan({ cls:'cockpit-log-card-title', text:diagnostic.name });
      cockpitStatusBadge(head, { tone:connected ? 'ok' : 'muted', icon:connected ? 'check-circle-2' : 'circle', label:String(diagnostic.status || (en?'Not set up':'尚未初始化')) });
      // 指标行
      const metrics = main.createDiv({ cls:'cockpit-log-metrics' });
      const addMetric = (value, label, tone) => {
        const m = metrics.createDiv({ cls:'cockpit-log-metric' + (tone ? ' tone-' + tone : '') });
        m.createSpan({ cls:'cockpit-log-metric-value', text:String(value) });
        m.createSpan({ cls:'cockpit-log-metric-label', text:label });
      };
      addMetric(diagnostic.pending, en?'pending':'待提交', diagnostic.pending ? 'warn' : '');
      addMetric(diagnostic.drafts, en?'drafts':'草稿', '');
      addMetric(diagnostic.conflicts, en?'conflicts':'冲突', diagnostic.conflicts ? 'bad' : '');
      if(diagnostic.lastSync) main.createEl('p',{cls:'cockpit-log-card-sub', text:(en?'Last success: ':'最后成功：')+new Date(diagnostic.lastSync).toLocaleString()});
      if(diagnostic.peers.length){
        const peers = main.createDiv({ cls:'cockpit-log-peers' });
        diagnostic.peers.forEach(peer=>{
          const p = peers.createDiv({ cls:'cockpit-log-peer' });
          try { obs.setIcon(p.createSpan({cls:'cockpit-log-peer-icon'}), peer.error ? 'alert-triangle' : 'monitor'); } catch(e) {}
          p.createSpan({ cls:'cockpit-log-peer-name', text:peer.name });
          p.createSpan({ cls:'cockpit-log-peer-meta', text:peer.version + ' · ' + (peer.lastSync?new Date(peer.lastSync).toLocaleString():(en?'Never synced':'尚未同步')) + (peer.error?' · '+peer.error:'') });
        });
      }
      const actions = card.createDiv({ cls:'cockpit-log-card-actions' });
      cockpitDetailButton(actions,en?'Manage / resolve':'管理 / 处理冲突',()=>index?view._plugin.teamSync.open():new CockpitDetailModal(view,en?'Nearby devices':'附近设备',(parent,modal)=>renderLanSyncSettings(parent,view._plugin,view._lang(),{registerCleanup:cleanup=>modal.registerCleanup(cleanup)})).open());
      cockpitDetailButton(actions,en?'Sync now':'立即同步',async()=>{const service=index?view._plugin.teamSync:view._plugin.lanSync;if(!service?.transport)throw new Error('请先在管理页开启同步。');await service.sync();render();});
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
  root.classList && root.classList.add('cockpit-insights');
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
    // 顶部概览指标卡
    const metrics = root.createDiv({ cls:'cockpit-log-metrics cockpit-log-metrics-wide' });
    const addCard = (value, unit, label, tone) => {
      const card = metrics.createDiv({ cls:'cockpit-log-metric-card' + (tone ? ' tone-' + tone : '') });
      const v = card.createDiv({ cls:'cockpit-log-metric-card-value' });
      v.createSpan({ text:String(value) });
      if (unit) v.createSpan({ cls:'cockpit-log-metric-card-unit', text:unit });
      card.createDiv({ cls:'cockpit-log-metric-card-label', text:label });
    };
    if (summary.firstPaintMs != null) addCard(Math.round(summary.firstPaintMs), 'ms', en ? 'Last full render' : '最近整页渲染', summary.firstPaintMs > 120 ? 'warn' : 'ok');
    if (summary.refresh) addCard(Math.round(summary.refresh.avg), 'ms', (en ? 'Silent refresh avg ×' : '静默刷新均值 ×') + summary.refresh.count, summary.refresh.avg > 80 ? 'warn' : 'ok');
    if (summary.refresh) addCard(Math.round(summary.refresh.max), 'ms', en ? 'Silent refresh max' : '静默刷新峰值', summary.refresh.max > 200 ? 'bad' : '');
    if (hasHeat) addCard(heat.avgFiles.toFixed(1), en ? 'files' : '文件', (en ? 'Avg files/refresh' : '每轮平均读文件'), '');

    const section = (title) => root.createDiv({ cls:'cockpit-log-section-title', text:title });
    const metricRow = (label, value, tone) => {
      const row = root.createDiv({ cls:'cockpit-log-perf-row' + (tone ? ' tone-' + tone : '') });
      row.createSpan({ cls:'cockpit-log-perf-label', text:label });
      row.createSpan({ cls:'cockpit-log-perf-value', text:value });
    };
    if (hasHeat) {
      section(en ? 'Refresh heat' : '刷新热力');
      const wrap = root.createDiv({ cls:'cockpit-log-list' });
      heat.scopes.forEach((s) => {
        const row = wrap.createDiv({ cls:'cockpit-log-perf-row' });
        row.createSpan({ cls:'cockpit-log-perf-label', text:(en ? 'scope ' : '范围 ') + s.scope });
        row.createSpan({ cls:'cockpit-log-perf-value', text:'×' + s.count });
      });
      if (!heat.scopes.length) metricRow(en ? 'Refresh cycles' : '刷新轮次', String(heat.eventCount));
    }
    if (summary.slowestModules.length) {
      section(en ? 'Slowest modules (last render)' : '最慢模块（最近一次渲染）');
      summary.slowestModules.forEach((m) => metricRow(m.module, Math.round(m.ms) + ' ms', m.ms > 50 ? 'warn' : ''));
    }
    if (summary.slowestLabels.length) {
      section(en ? 'Slowest operations (avg)' : '最慢操作（平均）');
      summary.slowestLabels.forEach((l) => metricRow(l.label + ' · avg ' + Math.round(l.avg) + ' ms · max ' + Math.round(l.max) + ' ms', '×' + l.count, l.avg > 80 ? 'warn' : ''));
    }
    const foot = root.createDiv({ cls:'cockpit-log-toolbar' });
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
