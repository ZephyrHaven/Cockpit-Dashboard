// custom-components-ui.js — 导入前展示组件信息及权限；管理操作不执行包内代码。
function cockpitDownloadComponent(pkg,filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(pkg,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();URL.revokeObjectURL(url);
}
function cockpitCustomPermissionLabel(permission,en) { return ({'todos.read':en?'Read personal task summaries':'读取个人待办摘要','focus.read':en?'Read focus statistics':'读取专注统计'})[permission]||permission; }
class CockpitComponentImportModal extends CockpitModal {
  constructor(view,store,expectedId=null){super(view.app);this.view=view;this.store=store;this.expectedId=expectedId;this.busy=false;this.closed=false;}
  onOpen(){this.view._plugin.customComponents.modals.add(this);this.contentEl.addClass(PLUGIN_ID+'-component-import');this.render();}
  render(){
    const en=this.view._lang()==='en';this.contentEl.empty();
    this.contentEl.createEl('h2',{text:en?'Import component':'导入组件'});
    this.contentEl.createEl('p',{text:en?'Choose a component JSON package, or a folder containing manifest.json and its source files.':'选择组件 JSON 包，或包含 manifest.json 与源码文件的组件文件夹。'});
    const actions=this.contentEl.createDiv({cls:PLUGIN_ID+'-component-detail-actions'});
    const choose=(folder)=>{
      const input=actions.createEl('input',{attr:{type:'file',accept:folder?'':'.json', 'aria-label':en?'Component package':'组件包'}});input.hidden=true;
      if(folder){input.setAttribute('webkitdirectory','');input.multiple=true;}
      input.onchange=async()=>{
        try{this.pkg=await readCustomComponentFiles(input.files);customComponentAssert(!this.expectedId||this.pkg.manifest.id===this.expectedId,'更新包的组件 ID 不匹配 / Update package ID does not match.');if(!this.closed)this.preview();}
        catch(error){if(!this.closed)new obs.Notice(String(error.message));}
        finally{input.remove();}
      };
      input.click();
    };
    actions.createEl('button',{text:en?'Choose JSON package':'选择 JSON 组件包',attr:{type:'button'}}).onclick=()=>choose(false);
    actions.createEl('button',{text:en?'Choose component folder':'选择组件文件夹',attr:{type:'button'}}).onclick=()=>choose(true);
    actions.createEl('button',{text:en?'Download example':'下载示例组件',attr:{type:'button'}}).onclick=()=>cockpitDownloadComponent(cockpitCustomExamplePackage(),'reading-progress.cockpit-component.json');
  }
  preview(){
    const en=this.view._lang()==='en',pkg=this.pkg,m=pkg.manifest,service=this.view._plugin.customComponents,old=service.get(m.id);
    this.contentEl.empty();this.contentEl.createEl('h2',{text:old?(en?'Update component':'更新组件'):(en?'Install component':'安装组件')});
    this.contentEl.createEl('h3',{text:m.name});this.contentEl.createEl('p',{text:m.description});
    this.contentEl.createEl('p',{text:m.id+' · '+(old?old.manifest.version+' → ':'')+m.version});
    this.contentEl.createEl('p',{text:(en?'Requested access: ':'申请权限：')+(m.permissions.length?m.permissions.map(p=>cockpitCustomPermissionLabel(p,en)).join('、'):(en?'Component private storage only':'仅组件自己的本机存储'))});
    this.contentEl.createEl('p',{text:en?'This package runs code. Only install components whose source you trust. File access, commands and network access are unavailable.':'此组件包包含可执行代码，请确认来源可信。组件无法访问文件、执行命令或联网。'});
    if(old)this.contentEl.createEl('p',{text:en?'Updating preserves private data and existing layouts.':'更新会保留组件的私有数据和已有布局。'});
    const actions=this.contentEl.createDiv({cls:PLUGIN_ID+'-component-detail-actions'});
    actions.createEl('button',{text:en?'Back':'返回',attr:{type:'button'}}).onclick=()=>this.render();
    const install=actions.createEl('button',{cls:'mod-cta',text:en?'Install and add to this layout':'安装并添加到当前布局',attr:{type:'button'}});
    install.onclick=async()=>{
      if(this.busy)return;this.busy=true;install.disabled=true;
      try{await service.install(pkg);if(this.closed)return;this.store._syncCustomCatalog();this.store._setVisible(customComponentModuleId(m.id),true);this.store.tab='current';this.store.detailId='';this.store.render();this.close();}
      catch(error){new obs.Notice(String(error.message));}
      finally{this.busy=false;install.disabled=false;}
    };
  }
  onClose(){this.closed=true;this.view._plugin.customComponents.modals.delete(this);this.contentEl.empty();}
}
function cockpitRenderCustomComponentManager(store,body,entry) {
  const en=store.view._lang()==='en',service=store.view._plugin.customComponents,pkg=entry.custom;
  const section=body.createDiv({cls:PLUGIN_ID+'-component-detail-section'});
  section.createEl('p',{text:pkg.manifest.id+' · '+pkg.manifest.version});
  section.createEl('p',{text:(en?'Access: ':'权限：')+(pkg.manifest.permissions.map(p=>cockpitCustomPermissionLabel(p,en)).join('、')||(en?'Private component storage':'组件独立存储'))});
  if(pkg.lastError)section.createEl('p',{cls:PLUGIN_ID+'-custom-component-error',text:pkg.lastError});
  const actions=section.createDiv({cls:PLUGIN_ID+'-component-detail-actions'});
  const action=(text,fn)=>{const button=actions.createEl('button',{text,attr:{type:'button'}});button.onclick=async()=>{button.disabled=true;try{await fn();}catch(error){new obs.Notice(String(error.message));}finally{button.disabled=false;}};return button;};
  action(pkg.enabled?(en?'Disable everywhere':'在所有布局中禁用'):(en?'Enable component':'启用组件'),()=>service.setEnabled(pkg.manifest.id,!pkg.enabled));
  action(en?'Import update':'导入更新',()=>{new CockpitComponentImportModal(store.view,store,pkg.manifest.id).open();});
  action(en?'Export package':'导出组件包',()=>cockpitDownloadComponent({manifest:pkg.manifest,code:pkg.code,styles:pkg.styles},pkg.manifest.id+'.cockpit-component.json'));
  const dataLabel=section.createEl('label',{cls:PLUGIN_ID+'-component-delete-data'});const removeData=dataLabel.createEl('input',{attr:{type:'checkbox'}});dataLabel.createSpan({text:en?'Delete private data when uninstalling':'卸载时同时清除组件私有数据'});
  action(en?'Uninstall component':'卸载组件',async()=>{
    if(!window.confirm(en?'Uninstall this component from every layout?':'从所有布局中卸载此组件？'))return;
    await service.uninstall(pkg.manifest.id,removeData.checked);store.detailId='';store._syncCustomCatalog();store.render();
  }).addClass('danger');
  section.createEl('p',{cls:PLUGIN_ID+'-component-global-note',text:en?'Install, update and enable state apply to all layouts. Uninstall preserves private data unless selected above.':'安装、更新和启用状态作用于所有布局；卸载默认保留私有数据，重新导入同一 ID 后恢复。'});
}
class CockpitComponentGuideModal extends CockpitModal {
  constructor(app,service){super(app);this.service=service;}
  onOpen(){
    this.service?.modals.add(this);
    this.contentEl.addClass(PLUGIN_ID+'-component-import');this.contentEl.createEl('h2',{text:'组件开发规范 / Component SDK v1'});
    this.contentEl.createEl('p',{text:'组件包含 manifest.json、main.js 和可选 styles.css。代码导出 mount(ctx)，通过 ctx.render(tree) 创建界面；无需重新构建驾驶舱。 / Export mount(ctx) and render a UI tree.'});
    this.contentEl.createEl('pre',{text:'module.exports = {\n  async mount(ctx) {\n    const saved = await ctx.storage.get();\n    ctx.on("hello", () => ctx.render({tag:"p",text:"Hello!"}));\n    ctx.render({tag:"button",key:"hello",text:"Hello",action:"hello"});\n  }\n};'});
    this.contentEl.createEl('p',{text:'接口 / API：ctx.storage.get/set、ctx.data.todos/focus（需清单授权）、ctx.on、ctx.onDataChanged、ctx.setInterval。界面可用 div、p、span、button、input、textarea、select、progress 等标签；不接收 HTML 或事件代码。'});
    this.contentEl.createEl('p',{text:'样式限定在组件内部，只允许颜色、边框、间距、排版和尺寸等展示属性。完整规范见源码 docs/component-authoring-spec.md。 / Styles stay scoped to the component.'});
    this.contentEl.createEl('button',{text:'下载示例组件 / Download example',attr:{type:'button'}}).onclick=()=>cockpitDownloadComponent(cockpitCustomExamplePackage(),'reading-progress.cockpit-component.json');
  }
  onClose(){this.service?.modals.delete(this);this.contentEl.empty();}
}
