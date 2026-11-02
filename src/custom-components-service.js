// custom-components-service.js — 代码与私有数据独立保存，不增加 data.json 的周期性写入负担。
class CockpitCustomComponentService {
  constructor(plugin) { this.plugin=plugin; this.state={schemaVersion:1,entries:[],savedData:[]}; this.listeners=new Set(); this.runtimes=new Set(); this.modals=new Set(); this.queue=Promise.resolve(); this.closed=false; this.available=false; }
  get path() { return (this.plugin.manifest.dir || this.plugin.app.vault.configDir+'/plugins/'+PLUGIN_ID)+'/custom-components.json'; }
  entries() { return this.state.entries; }
  get(id) { return this.entries().find(e=>e.manifest.id===id); }
  async load() {
    const adapter=this.plugin.app.vault.adapter;
    try {
      if (!await adapter.exists(this.path)) { this.available=true; return; }
      let state;
      try { state=JSON.parse(await adapter.read(this.path)); }
      catch (error) {
        if (!await adapter.exists(this.path+'.backup')) throw error;
        state=JSON.parse(await adapter.read(this.path+'.backup'));
        new obs.Notice('组件存储已从本机备份恢复 / Component storage recovered from local backup.');
      }
      customComponentAssert(state?.schemaVersion===1 && Array.isArray(state.entries) && state.entries.length<=CUSTOM_COMPONENT_LIMITS.installed, '组件存储版本无效 / Unsupported component storage version.');
      const seen=new Set();
      const normalizeEntry=e=>({...validateCustomComponentPackage(e),enabled:e.enabled===true,data:customComponentJson(e.data??null,CUSTOM_COMPONENT_LIMITS.storageBytes),failures:Math.max(0,Math.min(3,Number(e.failures)||0)),lastError:typeof e.lastError==='string'?e.lastError.slice(0,300):''});
      this.state={schemaVersion:1,savedData:(Array.isArray(state.savedData)?state.savedData:[]).map(item=>{ customComponentAssert(/^[a-z][a-z0-9-]{0,39}\.[a-z][a-z0-9-]{0,49}$/.test(item.id),'Invalid saved component ID.');return {id:item.id,data:customComponentJson(item.data??null,CUSTOM_COMPONENT_LIMITS.storageBytes)}; }),entries:state.entries.map(e=>{
        const pkg=validateCustomComponentPackage(e); customComponentAssert(!seen.has(pkg.manifest.id),'Duplicate component ID.'); seen.add(pkg.manifest.id);
        const entry=normalizeEntry(e);
        if(e.rollback){entry.rollback=normalizeEntry(e.rollback);customComponentAssert(entry.rollback.manifest.id===entry.manifest.id,'Invalid component rollback ID.');}
        return entry;
      })};
      customComponentJson(this.state,CUSTOM_COMPONENT_LIMITS.totalBytes);
      this.available=true;
    } catch(error) { this.loadError=String(error?.message||error); console.warn('Cockpit component storage unavailable',error); }
  }
  transact(change, catalog=false) {
    const operation=this.queue.catch(()=>{}).then(async()=>{
      customComponentAssert(this.available&&!this.closed,'组件存储不可用，请重新加载插件 / Component storage unavailable. Reload the plugin.');
      const next=customComponentJson(this.state,CUSTOM_COMPONENT_LIMITS.totalBytes); await change(next);
      const payload=JSON.stringify(next); customComponentJson(next,CUSTOM_COMPONENT_LIMITS.totalBytes);
      if(payload===JSON.stringify(this.state))return this.state;
      const adapter=this.plugin.app.vault.adapter;
      await adapter.write(this.path+'.backup',JSON.stringify(this.state));
      await adapter.write(this.path,payload);
      this.state=next;
      if(catalog)for(const listener of [...this.listeners]){try{listener();}catch(error){console.warn('Cockpit component catalog listener failed',error);}}
      return next;
    });
    this.queue=operation; return operation;
  }
  install(raw) {
    const pkg=validateCustomComponentPackage(raw);
    return this.transact(state=>{
      const old=state.entries.find(e=>e.manifest.id===pkg.manifest.id);
      customComponentAssert(old||state.entries.length<CUSTOM_COMPONENT_LIMITS.installed,'最多安装 20 个自定义组件 / Up to 20 custom components.');
      const entry={...pkg,enabled:true,data:old?.data??state.savedData.find(item=>item.id===pkg.manifest.id)?.data??null,failures:0,lastError:''};
      if(old){const previous=old.rollback||old;entry.rollback={...previous};delete entry.rollback.rollback;}
      state.savedData=state.savedData.filter(item=>item.id!==pkg.manifest.id);
      if(old)state.entries[state.entries.indexOf(old)]=entry;else state.entries.push(entry);
    },true);
  }
  setEnabled(id,enabled) { return this.transact(state=>{const e=state.entries.find(e=>e.manifest.id===id);customComponentAssert(e,'组件已卸载 / Component removed.');e.enabled=enabled;e.failures=0;e.lastError='';},true); }
  disableAll() {
    for(const runtime of [...this.runtimes])runtime.destroy();
    return this.transact(state=>{for(const e of state.entries)e.enabled=false;},true);
  }
  uninstall(id,removeData=true) {
    return this.transact(state=>{
      const entry=state.entries.find(e=>e.manifest.id===id);state.savedData=state.savedData.filter(item=>item.id!==id);
      if(entry&&!removeData)state.savedData.push({id,data:entry.data});
      state.entries=state.entries.filter(e=>e.manifest.id!==id);
    },true);
  }
  markHealthy(id,code) {
    if(!this.get(id)?.rollback)return Promise.resolve();
    return this.transact(state=>{const e=state.entries.find(e=>e.manifest.id===id);if(e?.code===code)delete e.rollback;});
  }
  recordFailure(id,message,code) {
    let rolledBack=false;
    return this.transact(state=>{
      const e=state.entries.find(e=>e.manifest.id===id);if(!e||(code&&e.code!==code))return;
      if(e.rollback){state.entries[state.entries.indexOf(e)]={...e.rollback,lastError:'更新启动失败，已恢复上一版本 / Update failed; previous version restored. '+String(message).slice(0,180)};rolledBack=true;return;}
      e.failures++;e.lastError=String(message).slice(0,300);if(e.failures>=3)e.enabled=false;
    }).then(()=>{
      if(rolledBack)new obs.Notice('组件更新失败，已恢复上一版本 / Component update failed; previous version restored.');
      if(rolledBack||this.get(id)?.enabled===false)for(const listener of [...this.listeners])listener();
    });
  }
  async request(id,method,value,view,active) {
    const entry=this.get(id); customComponentAssert(entry?.enabled&&active(),'组件已停止 / Component stopped.');
    if(method==='storage.get')return customComponentJson(entry.data,CUSTOM_COMPONENT_LIMITS.storageBytes);
    if(method==='storage.set') {
      const data=customComponentJson(value,CUSTOM_COMPONENT_LIMITS.storageBytes);
      await this.transact(state=>{customComponentAssert(active(),'Component stopped.');const e=state.entries.find(e=>e.manifest.id===id);customComponentAssert(e?.enabled,'Component stopped.');e.data=data;}); return true;
    }
    const permission=method==='data.todos'?'todos.read':method==='data.focus'?'focus.read':null;
    customComponentAssert(permission&&entry.manifest.permissions.includes(permission),'未授权此数据 / Permission not granted.');
    if(method==='data.focus')return {todayMinutes:Number(view._focusMinutes)||0,history:[...view._focusHistory||[]].slice(-90).map(([date,minutes])=>({date,minutes}))};
    return (view._todos||[]).slice(0,100).map(todo=>({text:String(todo.text||'').slice(0,300),done:!!todo.done,priority:todo.priority||'mid',due:todo.dueDate?.format?.('YYYY-MM-DDTHH:mm:ss')||null}));
  }
  stop() { this.closed=true;for(const modal of [...this.modals])modal.close();for(const runtime of [...this.runtimes])runtime.destroy();this.listeners.clear(); }
}
if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={CockpitCustomComponentService};
