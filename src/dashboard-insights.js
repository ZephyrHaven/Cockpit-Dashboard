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
function buildRunHistory(view,root) {
  const en=view._lang()==='en';
  const body = root;
  body.classList.add('cockpit-insights');
  let token=0,failedOnly=false;
  const render=async()=>{const current=++token;const records=await cockpitRunRecords(view._plugin);if(current!==token||!body.isConnected)return;body.empty();
    cockpitDetailButton(body,en?'Refresh':'刷新',render);cockpitDetailButton(body,failedOnly?(en?'Show all':'显示全部'):(en?'Failures only':'只看失败'),()=>{failedOnly=!failedOnly;return render();});
    cockpitDetailButton(body,en?'Configure services':'配置服务',()=>new CockpitDetailModal(view,en?'Service settings':'服务配置',(parent,modal)=>{const tab=new CockpitServerChanSettingTab(view.app,view._plugin,cleanup=>modal.registerCleanup(cleanup));tab._activeSection='channels';tab.containerEl=parent;return tab.display();}).open());
    const rows=records.filter(record=>!failedOnly||['failed','aborted'].includes(record.status));
    if(!rows.length)body.createEl('p',{text:en?'No matching runs yet.':'暂无符合条件的运行记录。'});
    rows.slice(0,12).forEach(record=>{const row=body.createDiv({cls:'cockpit-detail-row'});row.createEl('strong',{text:record.name});row.createSpan({text:new Date(record.at).toLocaleString()+' · '+record.status});if(record.error)row.createEl('p',{text:record.error});
      if(['failed','aborted'].includes(record.status))cockpitDetailButton(row,record.type==='workflow'?(en?'Rerun entire workflow':'重新运行整个流程'):(en?'Retry using current configuration':'按当前配置重试'),async()=>{const ok=await cockpitRetryRun(view,record);new obs.Notice(ok?(en?'Completed':'运行完成'):(en?'Not completed; check configuration or the latest result.':'未完成，请检查配置或最新结果。'));await render();});
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
  const render=()=>{if(!body.isConnected)return;body.empty();cockpitSyncDiagnostics(view._plugin).forEach((diagnostic,index)=>{const row=body.createDiv({cls:'cockpit-detail-row'});
    row.createEl('strong',{text:diagnostic.name+' · '+diagnostic.status});row.createSpan({text:'待提交 '+diagnostic.pending+' · 草稿 '+diagnostic.drafts+' · 冲突 '+diagnostic.conflicts});
    if(diagnostic.lastSync)row.createSpan({text:'最后成功：'+new Date(diagnostic.lastSync).toLocaleString()});
    diagnostic.peers.forEach(peer=>row.createEl('p',{text:peer.name+' · '+peer.version+' · '+(peer.lastSync?new Date(peer.lastSync).toLocaleString():'尚未同步')+(peer.error?' · '+peer.error:'')}));
    cockpitDetailButton(row,en?'Manage / resolve':'管理 / 处理冲突',()=>index?view._plugin.teamSync.open():new CockpitDetailModal(view,en?'Nearby devices':'附近设备',(parent,modal)=>renderLanSyncSettings(parent,view._plugin,view._lang(),{registerCleanup:cleanup=>modal.registerCleanup(cleanup)})).open());
    cockpitDetailButton(row,en?'Sync now':'立即同步',async()=>{const service=index?view._plugin.teamSync:view._plugin.lanSync;if(!service?.transport)throw new Error('请先在管理页开启同步。');await service.sync();render();});
  });};render();return render;
}

function openCockpitLogs(view) {
  const en = view._lang() === 'en';
  new CockpitDetailModal(view, en ? 'Logs & diagnostics' : '日志与诊断', (root, modal) => {
    root.createEl('p', { cls:'cockpit-detail-muted', text:en ? 'Run results and connection status are available here when needed.' : '在这里按需查看运行结果与设备连接状态。' });
    const tabs = root.createDiv({ cls:PLUGIN_ID + '-workspace-tabs', attr:{ role:'tablist', 'aria-label':en ? 'Log category' : '日志分类' } });
    const panel = root.createDiv();
    let refresh = null;
    let closed = false;
    const buttons = [];
    const select = (id) => {
      panel.empty();
      panel.className = '';
      buttons.forEach((button) => { const active = button.dataset.logTab === id; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
      const host = panel.createDiv();
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
  const render = () => {
    root.empty();
    const summary = typeof cockpitPerfSummary === 'function' ? cockpitPerfSummary() : null;
    if (!summary || (!summary.firstPaintMs && !summary.slowestModules.length && !summary.slowestLabels.length)) {
      root.createEl('p', { cls:'cockpit-detail-muted', text:en ? 'No performance samples yet. Interact with the cockpit and reopen this panel.' : '还没有性能样本。使用一下驾驶舱后再打开此面板。' });
      return;
    }
    if (summary.firstPaintMs != null) {
      root.createEl('p', { text:(en ? 'Last full render: ' : '最近整页渲染：') + Math.round(summary.firstPaintMs) + ' ms' });
    }
    if (summary.refresh) {
      root.createEl('p', { text:(en ? 'Silent refresh: ' : '静默刷新：') + Math.round(summary.refresh.avg) + ' ms avg · ' + Math.round(summary.refresh.max) + ' ms max · x' + summary.refresh.count });
    }
    const heat = typeof cockpitPerfRefreshHeat === 'function' ? cockpitPerfRefreshHeat() : null;
    if (heat && heat.eventCount) {
      root.createEl('h3', { text:en ? 'Refresh heat' : '刷新热力' });
      root.createEl('p', { text:(en ? 'Refresh cycles: ' : '刷新轮次：') + heat.eventCount + (en ? ' · avg files read ' : ' · 平均读文件 ') + heat.avgFiles.toFixed(1) });
      heat.scopes.forEach((s) => {
        root.createDiv({ cls:'cockpit-detail-row', text:(en ? 'scope ' : '范围 ') + s.scope + ' · x' + s.count });
      });
    }
    if (summary.slowestModules.length) {
      root.createEl('h3', { text:en ? 'Slowest modules (last render)' : '最慢模块（最近一次渲染）' });
      summary.slowestModules.forEach((m) => {
        root.createDiv({ cls:'cockpit-detail-row', text:m.module + ' · ' + Math.round(m.ms) + ' ms' });
      });
    }
    if (summary.slowestLabels.length) {
      root.createEl('h3', { text:en ? 'Slowest operations (avg)' : '最慢操作（平均）' });
      summary.slowestLabels.forEach((l) => {
        root.createDiv({ cls:'cockpit-detail-row', text:l.label + ' · avg ' + Math.round(l.avg) + ' ms · max ' + Math.round(l.max) + ' ms · x' + l.count });
      });
    }
    root.createEl('p', { cls:'cockpit-detail-muted', text:en ? 'In-memory only; nothing is stored or uploaded.' : '仅驻留内存，不落盘、不上传。' });
    cockpitDetailButton(root, en ? 'Reset samples' : '重置样本', () => { if (typeof cockpitPerfReset === 'function') cockpitPerfReset(); render(); });
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
