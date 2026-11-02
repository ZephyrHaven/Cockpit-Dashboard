// custom-components.js — 自定义组件复用统一模块外壳，目录变化只刷新这些模块。
function cockpitBuildCustomComponents(view,root) {
  view._customComponentControllers ||= new Map();
  for(const entry of view._plugin.customComponents?.entries()||[]) {
    const id=customComponentModuleId(entry.manifest.id);
    const title=root.createDiv({cls:PLUGIN_ID+'-section-title',text:entry.manifest.name});title.dataset.section=id+'-title';title.dataset.customComponent=entry.manifest.id;
    cockpitSetModuleTitleIcon(title,id,entry.manifest.icon);
    const body=root.createDiv({cls:PLUGIN_ID+'-custom-component-body'});body.dataset.section=id+'-body';body.dataset.customComponent=entry.manifest.id;
    const controller={id,body,runtime:null,failed:false,
      stop(){this.runtime?.destroy();this.runtime=null;},
      start(){
        if(this.runtime||this.failed)return;
        const current=view._plugin.customComponents.get(entry.manifest.id);body.empty();
        if(!current?.enabled){
          body.createEl('p',{text:view._lang()==='en'?'This component is disabled. Enable it in the component store.':'此组件已禁用，可在组件商店中重新启用。'});
          if(current?.lastError)body.createEl('p',{cls:PLUGIN_ID+'-custom-component-error',text:current.lastError});return;
        }
        const host=body.createDiv({cls:PLUGIN_ID+'-custom-component-surface'});
        const fail=message=>{
          this.runtime=null;this.failed=true;body.empty();
          body.createEl('p',{cls:PLUGIN_ID+'-custom-component-error',text:message});
          const retry=body.createEl('button',{text:view._lang()==='en'?'Retry component':'重试组件',attr:{type:'button'}});
          retry.onclick=()=>{this.failed=false;this.start();};
          view._plugin.customComponents.recordFailure(entry.manifest.id,message,current.code).catch(error=>console.warn('Cockpit component failure save failed',error));
        };
        try{this.runtime=cockpitStartCustomRuntime(view,current,host,fail);}catch(error){host.remove();fail(error.message);}
      }
    };
    view._customComponentControllers.set(id,controller);
    view._makeModuleCollapsible(id,title,body);
  }
  if(!view._customCatalogUnsubscribe&&view._plugin.customComponents){
    const service=view._plugin.customComponents;
    const changed=()=>{if(view._customComponentsClosed)return;cockpitRefreshCustomComponents(view);view._componentStoreModal?._syncCustomCatalog?.();};
    service.listeners.add(changed);view._customCatalogUnsubscribe=()=>service.listeners.delete(changed);
    const visibility=()=>cockpitSyncCustomComponents(view);
    document.addEventListener('visibilitychange',visibility);view._customVisibilityCleanup=()=>document.removeEventListener('visibilitychange',visibility);
    if(typeof IntersectionObserver==='function'){view._customVisibilityObserver=new IntersectionObserver(visibility);view._customVisibilityObserver.observe(view.containerEl);}
  }
}
function cockpitSyncCustomComponents(view) {
  for(const controller of view._customComponentControllers?.values()||[]){
    if(view._isModuleHidden(controller.id)||view._collapsed?.[controller.id]||document.hidden||!controller.body.isConnected||!view.containerEl.getClientRects().length)controller.stop();
    else controller.start();
  }
}
function cockpitDestroyCustomComponents(view,closing=false) {
  for(const controller of view._customComponentControllers?.values()||[])controller.stop();
  view._customComponentControllers?.clear();
  if(closing){view._customComponentsClosed=true;view._customCatalogUnsubscribe?.();view._customCatalogUnsubscribe=null;view._customVisibilityCleanup?.();view._customVisibilityObserver?.disconnect();}
}
function cockpitRefreshCustomComponents(view) {
  const root=view.containerEl.querySelector('.'+PLUGIN_ID+'-root');if(!root)return;
  const previous=[...view._moduleOrder];
  cockpitDestroyCustomComponents(view);
  root.querySelectorAll('[data-module-id^="custom:"],[data-custom-component]').forEach(el=>el.remove());
  view._moduleOrder=view._normalizeModuleOrder(view._moduleOrder);
  view._hiddenModules=new Set(view._normalizeModuleSubset([...view._hiddenModules]));
  customComponentSceneDefaults(view,{moduleOrder:previous});
  cockpitBuildCustomComponents(view,root);view._applyModuleLayout(root);view._applyModuleEditState(root);
}
function cockpitNotifyCustomComponents(view,scopes) {
  for(const controller of view._customComponentControllers?.values()||[])controller.runtime?.post({type:'changed',scopes:[...scopes]});
}
