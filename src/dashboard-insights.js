// dashboard-insights.js — 共用详情窗口与可选运维模块；只展示安全的摘要字段。
class CockpitDetailModal extends obs.Modal {
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
function buildTeamInsights(view,root) {
  const en=view._lang()==='en',service=view._plugin.teamSync;
  const title=root.createDiv({cls:PLUGIN_ID+'-section-title',text:en?'Team overview':'团队概览'});title.dataset.section='teamStats-title';
  const body=root.createDiv({cls:'cockpit-insights'});body.dataset.section='teamStats-body';view._makeModuleCollapsible('teamStats',title,body);
  let signature='';
  const render=()=>{
    if(!body.isConnected)return;const records=cockpitTeamVisible(service);
    const nextSignature=JSON.stringify([records.map(record=>[record.id,record.revision]),service?.members?.(),window.moment().format('YYYY-MM-DD')]);
    if(signature===nextSignature)return;signature=nextSignature;body.empty();const stats=cockpitTeamStats(records);
    body.createEl('p',{text:(en?'Visible team tasks':'当前可见团队任务')+' · '+stats.total+' / '+(en?'Completed ':'已办 ')+stats.done+' / '+(en?'Overdue ':'逾期 ')+stats.overdue});
    stats.owners.forEach(owner=>{
      const name=service.members().find(member=>member.device===owner.id)?.name||(en?'Unassigned':'未分配');
      cockpitDetailButton(body,name+' · '+(en?'Open ':'待办 ')+owner.open+' · '+(en?'Overdue ':'逾期 ')+owner.overdue,()=>new CockpitDetailModal(view,name,parent=>{
        cockpitTeamVisible(service).filter(record=>record.value.assignee===owner.id).forEach(record=>{
          const row=parent.createDiv({cls:'cockpit-detail-row'});row.createSpan({text:(record.value.done?'✓ ':'○ ')+record.value.text+(record.value.due?' · '+record.value.due:'')});
          if(teamSyncCanEdit(record,service.policy(),service.state.device)||teamSyncCanReassign(record,service.policy(),service.state.device)) cockpitDetailButton(row,en?'Edit':'编辑',()=>service.openModal(new CockpitTeamEditorModal(view.app,service,record)));
        });
      }).open());
    });
    cockpitDetailButton(body,en?'Export current team calendar':'导出当前团队日历',()=>{
      const url=URL.createObjectURL(new Blob([cockpitTeamCalendar(cockpitTeamVisible(service))],{type:'text/calendar;charset=utf-8'}));
      const link=body.createEl('a',{attr:{href:url,download:'cockpit-team.ics'}});try{link.click();}finally{link.remove();URL.revokeObjectURL(url);}
    });
  };view._refreshTeamStatsRef=render;render();return render;
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
  const title=root.createDiv({cls:PLUGIN_ID+'-section-title',text:en?'Run history':'运行记录'});title.dataset.section='runHistory-title';
  const body=root.createDiv({cls:'cockpit-insights'});body.dataset.section='runHistory-body';view._makeModuleCollapsible('runHistory',title,body);
  let token=0,failedOnly=false;
  const render=async()=>{const current=++token;const records=await cockpitRunRecords(view._plugin);if(current!==token||!body.isConnected)return;body.empty();
    cockpitDetailButton(body,en?'Refresh':'刷新',render);cockpitDetailButton(body,failedOnly?(en?'Show all':'显示全部'):(en?'Failures only':'只看失败'),()=>{failedOnly=!failedOnly;return render();});
    cockpitDetailButton(body,en?'Configure services':'配置服务',()=>new CockpitDetailModal(view,en?'Service settings':'服务配置',(parent,modal)=>{const tab=new CockpitServerChanSettingTab(view.app,view._plugin,cleanup=>modal.registerCleanup(cleanup));tab._activeSection='channels';tab.containerEl=parent;return tab.display();}).open());
    const rows=records.filter(record=>!failedOnly||['failed','aborted'].includes(record.status));
    if(!rows.length)body.createEl('p',{text:en?'No matching runs yet.':'暂无符合条件的运行记录。'});
    rows.slice(0,12).forEach(record=>{const row=body.createDiv({cls:'cockpit-detail-row'});row.createEl('strong',{text:record.name});row.createSpan({text:new Date(record.at).toLocaleString()+' · '+record.status});if(record.error)row.createEl('p',{text:record.error});
      if(['failed','aborted'].includes(record.status))cockpitDetailButton(row,record.type==='workflow'?(en?'Rerun entire workflow':'重新运行整个流程'):(en?'Retry using current configuration':'按当前配置重试'),async()=>{const ok=await cockpitRetryRun(view,record);new obs.Notice(ok?(en?'Completed':'运行完成'):(en?'Not completed; check configuration or the latest result.':'未完成，请检查配置或最新结果。'));await render();});
    });
  };view._refreshRunHistoryRef=()=>render().catch(error=>console.warn('Cockpit run history refresh failed',error));view._refreshRunHistoryRef();return view._refreshRunHistoryRef;
}
function cockpitSyncDiagnostics(plugin) {
  const personal=plugin.lanSync,state=personal?.store?.state,team=plugin.teamSync,teamState=team?.state;
  const conflicts=typeof lanSyncConflicts === 'function' ? lanSyncConflicts(state?.doc||{}).length : 0;
  return [{name:'个人同步',status:personal?.status||'尚未初始化',pending:state?.pending?1:0,conflicts,drafts:0,peers:(state?.peers||[]).map(peer=>({name:peer.name,lastSync:peer.lastSync,error:peer.error,version:peer.metadata?.pluginVersion||'未知'}))},
    {name:'团队同步',status:team?.status||'尚未初始化',pending:teamState?.pending?.length||0,conflicts:teamState?.conflicts?.length||0,drafts:teamState?.drafts?.length||0,lastSync:teamState?.lastSync,peers:(teamState?.peers||[]).map(peer=>({name:peer.name,lastSync:peer.lastSync,error:'',version:peer.metadata?.pluginVersion||'未知'}))}];
}
function buildSyncHealth(view,root) {
  const en=view._lang()==='en';const title=root.createDiv({cls:PLUGIN_ID+'-section-title',text:en?'Sync diagnostics':'同步诊断'});title.dataset.section='syncHealth-title';
  const body=root.createDiv({cls:'cockpit-insights'});body.dataset.section='syncHealth-body';view._makeModuleCollapsible('syncHealth',title,body);
  const render=()=>{if(!body.isConnected)return;body.empty();cockpitSyncDiagnostics(view._plugin).forEach((diagnostic,index)=>{const row=body.createDiv({cls:'cockpit-detail-row'});
    row.createEl('strong',{text:diagnostic.name+' · '+diagnostic.status});row.createSpan({text:'待提交 '+diagnostic.pending+' · 草稿 '+diagnostic.drafts+' · 冲突 '+diagnostic.conflicts});
    if(diagnostic.lastSync)row.createSpan({text:'最后成功：'+new Date(diagnostic.lastSync).toLocaleString()});
    diagnostic.peers.forEach(peer=>row.createEl('p',{text:peer.name+' · '+peer.version+' · '+(peer.lastSync?new Date(peer.lastSync).toLocaleString():'尚未同步')+(peer.error?' · '+peer.error:'')}));
    cockpitDetailButton(row,en?'Manage / resolve':'管理 / 处理冲突',()=>index?view._plugin.teamSync.open():new CockpitDetailModal(view,en?'Nearby devices':'附近设备',(parent,modal)=>renderLanSyncSettings(parent,view._plugin,view._lang(),{registerCleanup:cleanup=>modal.registerCleanup(cleanup)})).open());
    cockpitDetailButton(row,en?'Sync now':'立即同步',async()=>{const service=index?view._plugin.teamSync:view._plugin.lanSync;if(!service?.transport)throw new Error('请先在管理页开启同步。');await service.sync();render();});
  });};view._refreshSyncHealthRef=render;render();return render;
}

function subscribeCockpitInsights(view) {
  const refreshTeam=()=>{view._refreshTeamStatsRef?.();view._refreshSyncHealthRef?.();};
  const refreshRuns=()=>view._refreshRunHistoryRef?.();
  const off=[view._plugin.teamSync?.subscribe(refreshTeam),view._plugin.scheduledTasks?.subscribe(refreshRuns),view._plugin.workflows?.subscribe(refreshRuns)].filter(Boolean);
  view._plugin.lanSync?.listeners.add(refreshTeam);
  return ()=>{off.forEach(unsubscribe=>unsubscribe());view._plugin.lanSync?.listeners.delete(refreshTeam);};
}

function cockpitMentionedModules(data = {}) {
  const layouts=[data,...Object.values(data.sceneLayouts||{}).map(scene=>scene?.layout||{})];
  return new Set(layouts.flatMap(layout=>[...(Array.isArray(layout.moduleOrder)?layout.moduleOrder:[]),...(Array.isArray(layout.hiddenModules)?layout.hiddenModules:[])]));
}
