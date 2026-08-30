// component-store.js — 独立组件商店：组件增删排序、标题设置及容器组件的二级管理。

const COMPONENT_STORE_META = {
  hero:{icon:'sparkles',category:'basic'}, tip:{icon:'lightbulb',category:'basic',manager:'tip'}, toolbar:{icon:'panels-top-left',category:'basic',manager:'toolbar'},
  alarms:{icon:'alarm-clock',category:'focus'}, countdowns:{icon:'timer-reset',category:'focus'}, agenda:{icon:'clock-3',category:'planning'}, calendar:{icon:'calendar-days',category:'planning'},
  cats:{icon:'folders',category:'knowledge'}, stats:{icon:'chart-no-axes-column-increasing',category:'insights',manager:'stats'}, todos:{icon:'list-checks',category:'planning'},
  habits:{icon:'flame',category:'focus'}, projects:{icon:'target',category:'planning'}, focusChart:{icon:'chart-line',category:'insights'}, bookmarks:{icon:'star',category:'knowledge'},
  flash:{icon:'zap',category:'knowledge'}, resurface:{icon:'history',category:'knowledge'}, heatmap:{icon:'grid-3x3',category:'insights'}, weeklyReview:{icon:'calendar-check',category:'insights'},
  scheduledTasks:{icon:'calendar-clock',category:'automation'}, workflows:{icon:'workflow',category:'automation'}, reportStudio:{icon:'file-chart-column',category:'automation'},
  footer:{icon:'panel-bottom',category:'basic'}, recent:{icon:'history',category:'knowledge'}
};

const COMPONENT_STORE_COPY = {
  zh:{ title:'组件商店', current:'当前布局', catalog:'全部组件', search:'搜索组件', add:'添加到布局', remove:'从布局移除', configure:'设置', added:'已添加',
    cancel:'取消', apply:'应用布局', back:'返回组件商店', rename:'当前布局名称', restore:'恢复默认', componentSettings:'组件设置', layoutScope:'仅影响当前情景布局',
    globalScope:'全局设置，保存后会影响所有情景布局', toolbarItems:'Toolbar 按钮', statsItems:'统计卡片', show:'显示', hide:'隐藏', edit:'编辑', delete:'删除',
    addCustom:'添加自定义按钮', logs:'运行日志', tips:'管理提示库', empty:'当前布局还没有组件', noResults:'没有找到组件', sceneChanged:'情景布局已经切换，请重新打开组件商店。',
    categories:{all:'全部',basic:'基础',planning:'计划',focus:'效率',automation:'自动化',knowledge:'知识',insights:'洞察'} },
  en:{ title:'Component Store', current:'Current layout', catalog:'All components', search:'Search components', add:'Add to layout', remove:'Remove from layout', configure:'Settings', added:'Added',
    cancel:'Cancel', apply:'Apply layout', back:'Back to store', rename:'Name in this layout', restore:'Restore default', componentSettings:'Component settings', layoutScope:'Only affects the current layout scene',
    globalScope:'Global setting; saves immediately for every layout scene', toolbarItems:'Toolbar buttons', statsItems:'Statistic cards', show:'Show', hide:'Hide', edit:'Edit', delete:'Delete',
    addCustom:'Add custom button', logs:'Run logs', tips:'Manage tip library', empty:'No components in this layout', noResults:'No components found', sceneChanged:'The layout scene changed. Reopen the component store.',
    categories:{all:'All',basic:'Basic',planning:'Planning',focus:'Focus',automation:'Automation',knowledge:'Knowledge',insights:'Insights'} }
};

function componentStoreCopy(view) { return view._lang() === 'en' ? COMPONENT_STORE_COPY.en : COMPONENT_STORE_COPY.zh; }

function componentStoreDescriptions(view) {
  const en = view._lang() === 'en';
  return en ? {
    hero:'Greeting and today overview',tip:'Daily prompt and personal tip library',toolbar:'Built-in and custom quick actions',alarms:'Recurring and one-time alarms',countdowns:'Deadline countdowns and notifications',agenda:'Today timeline',calendar:'Month and week planning',cats:'Knowledge-area shortcuts',stats:'Progress and activity cards',todos:'Task management',habits:'Habit check-ins',projects:'Project progress',focusChart:'Focus trends',bookmarks:'Starred notes',flash:'Quick capture inbox',resurface:'Bring old notes back',heatmap:'Recent editing activity',weeklyReview:'Weekly reflection',scheduledTasks:'Time and event automations',workflows:'Multi-step operations',reportStudio:'Weekly report generation',footer:'Dashboard footer',recent:'Recently opened and edited notes'
  } : {
    hero:'问候与今日概览',tip:'每日提示与个人提示库',toolbar:'内置和自定义快捷操作',alarms:'重复及单次闹钟',countdowns:'截止倒计时与多渠道提醒',agenda:'今日时间线',calendar:'月视图和周视图计划',cats:'知识分类入口',stats:'进度与活动统计卡片',todos:'待办事项管理',habits:'习惯打卡',projects:'项目进度',focusChart:'专注趋势',bookmarks:'收藏文件',flash:'快速记录入口',resurface:'重新发现旧笔记',heatmap:'近期编辑活跃度',weeklyReview:'每周回顾',scheduledTasks:'时间与事件自动化',workflows:'多步骤运维流程',reportStudio:'周报生成与优化',footer:'驾驶舱页脚',recent:'最近打开和修改的内容'
  };
}

function componentStoreEntries(view) {
  const descriptions = componentStoreDescriptions(view);
  return view._moduleRegistry().map((module) => ({ ...module, ...(COMPONENT_STORE_META[module.id] || {icon:'layout-grid',category:'basic'}), description:descriptions[module.id] || '' }));
}

function componentStoreStats(view) {
  const en = view._lang() === 'en';
  return [
    ['noteCount',view._t('stats.noteCount')],['todoCount',view._t('stats.todoCount')],['doneCount',view._t('stats.doneCount')],['donePct',view._t('stats.doneRate')],
    ['focusMin',view._t('stats.focusToday')],['focusGap',en?'Focus gap':'连续未专注'],['tagBacklog',en?'Largest backlog':'最大标签积压']
  ].map(([id,label]) => ({id,label}));
}

function renderComponentPreview(parent, entry, variant='card') {
  const surfaceClass=variant==='detail'?PLUGIN_ID+'-component-detail-preview':PLUGIN_ID+'-component-card-preview';
  const preview=parent.createDiv({cls:PLUGIN_ID+'-component-preview '+surfaceClass});preview.setAttribute('aria-hidden','true');
  const frame=preview.createDiv({cls:PLUGIN_ID+'-component-preview-frame'});
  const title=frame.createDiv({cls:PLUGIN_ID+'-component-preview-title'});title.createSpan();title.createSpan();
  const id=entry.id;
  if(id==='toolbar'){
    const strip=frame.createDiv({cls:PLUGIN_ID+'-component-preview-toolbar'});for(let i=0;i<6;i+=1)strip.createSpan({cls:i===1?'active':''});
  }else if(id==='calendar'||id==='heatmap'){
    const grid=frame.createDiv({cls:PLUGIN_ID+'-component-preview-calendar'});for(let i=0;i<28;i+=1)grid.createSpan({cls:[5,11,12,18,24].includes(i)?'active':''});
  }else if(id==='stats'||id==='focusChart'){
    const cards=frame.createDiv({cls:PLUGIN_ID+'-component-preview-stats'});[72,48,86].forEach((width)=>{const card=cards.createDiv();card.createSpan();const bar=card.createDiv();bar.createSpan({attr:{style:`width:${width}%`}});});
  }else if(id==='todos'||id==='habits'||id==='projects'||id==='agenda'){
    const list=frame.createDiv({cls:PLUGIN_ID+'-component-preview-list'});for(let i=0;i<3;i+=1){const row=list.createDiv();row.createSpan({cls:i===0?'checked':''});row.createSpan();row.createSpan();}
  }else if(id==='countdowns'||id==='alarms'){
    const timer=frame.createDiv({cls:PLUGIN_ID+'-component-preview-timer'});timer.createDiv({text:id==='countdowns'?'03 : 08 : 24':'08 : 30'});const progress=timer.createDiv();progress.createSpan();const chips=timer.createDiv();chips.createSpan();chips.createSpan();
  }else if(entry.category==='automation'){
    const flow=frame.createDiv({cls:PLUGIN_ID+'-component-preview-flow'});for(let i=0;i<3;i+=1){flow.createSpan({cls:i===1?'active':''});if(i<2)flow.createDiv();}
  }else{
    const summary=frame.createDiv({cls:PLUGIN_ID+'-component-preview-summary'});const accent=summary.createSpan();obs.setIcon(accent,entry.icon);const copy=summary.createDiv();copy.createSpan();copy.createSpan();copy.createSpan();
  }
  return preview;
}

class CockpitComponentStoreModal extends obs.Modal {
  constructor(app, view) {
    super(app); this.view=view; this.sceneId=view._activeSceneId; this.draft=cloneComponentLayoutSnapshot(view._sceneSnapshot());
    this.tab='current'; this.category='all'; this.query=''; this.detailId=''; this.applied=false; this.globalChanged=false; this.dragId='';
  }
  onOpen() {
    this.modalEl.addClass(PLUGIN_ID+'-component-store-modal'); this.contentEl.addClass(PLUGIN_ID+'-component-store');
    this.render();
  }
  onClose() {
    this.contentEl.empty();
    if (this.view._componentStoreModal === this) this.view._componentStoreModal = null;
    if (this.applied || this.globalChanged) this.view._renderDashboard(false, true).catch((e)=>console.warn('Cockpit component store refresh failed',e));
  }
  _visible(id) { return !this.draft.hiddenModules.includes(id); }
  _setVisible(id, visible) { this.draft=setComponentVisibility(this.draft,id,visible); this.render(); }
  _dashboardRoot() { return this.view.containerEl.children[1]?.querySelector('.'+PLUGIN_ID+'-root') || null; }
  _markGlobalChanged() { this.globalChanged=true; this.draft.toolbarOrder=normalizeToolbarOrder(this.view,this.draft.toolbarOrder); this.render(); }
  async apply() {
    if (this.sceneId !== this.view._activeSceneId) { new obs.Notice(componentStoreCopy(this.view).sceneChanged); this.close(); return; }
    this.view._moduleOrder=this.view._normalizeModuleOrder(this.draft.moduleOrder);
    this.view._hiddenModules=new Set(this.view._normalizeModuleSubset(this.draft.hiddenModules));
    this.view._toolbarOrder=normalizeToolbarOrder(this.view,this.draft.toolbarOrder);
    this.view._hiddenToolbarActions=new Set(this.view._normalizeToolbarActionSubset(this.draft.hiddenToolbarActions));
    this.view._statsCardOrder=this.view._normalizeStatsCardOrder(this.draft.statsCardOrder);
    this.view._hiddenStatsCards=new Set(this.view._normalizeStatsCardSubset(this.draft.hiddenStatsCards));
    this.view._customModuleLabels=Object.fromEntries(Object.entries(this.draft.moduleLabels||{}).filter(([id,label])=>this.view._defaultModuleOrder().includes(id)&&typeof label==='string'&&label.trim()).map(([id,label])=>[id,label.trim().slice(0,40)]));
    await this.view._saveActiveSceneLayout(); this.applied=true; this.close();
  }
  render() {
    const c=componentStoreCopy(this.view); this.contentEl.empty();
    const head=this.contentEl.createDiv({cls:PLUGIN_ID+'-component-store-head'});
    const heading=head.createDiv({cls:PLUGIN_ID+'-component-store-heading'}); const icon=heading.createSpan();obs.setIcon(icon,'blocks');
    const headingText=heading.createDiv();headingText.createEl('h2',{text:this.detailId?c.componentSettings:c.title});headingText.createDiv({text:this.view._sceneLabel(this.view._sceneLayouts[this.sceneId])});
    if(this.detailId){const back=head.createEl('button',{cls:PLUGIN_ID+'-component-store-back',text:'← '+c.back,attr:{type:'button'}});back.onclick=()=>{this.detailId='';this.render();};}
    if(!this.detailId)this.renderNavigation(c);
    const body=this.contentEl.createDiv({cls:PLUGIN_ID+'-component-store-body'});
    if(this.detailId)this.renderDetail(body,c);else if(this.tab==='current')this.renderCurrent(body,c);else this.renderCatalog(body,c);
    const footer=this.contentEl.createDiv({cls:PLUGIN_ID+'-component-store-footer'});
    footer.createDiv({cls:PLUGIN_ID+'-component-store-scope',text:c.layoutScope});
    const cancel=footer.createEl('button',{text:c.cancel,attr:{type:'button'}});cancel.onclick=()=>this.close();
    const apply=footer.createEl('button',{cls:'mod-cta',text:c.apply,attr:{type:'button'}});apply.onclick=()=>this.apply();
  }
  renderNavigation(c) {
    const nav=this.contentEl.createDiv({cls:PLUGIN_ID+'-component-store-nav'});
    const tabs=nav.createDiv({cls:PLUGIN_ID+'-component-store-tabs'});
    [['current',c.current],['catalog',c.catalog]].forEach(([id,label])=>{const btn=tabs.createEl('button',{cls:this.tab===id?'active':'',text:label,attr:{type:'button'}});btn.onclick=()=>{this.tab=id;this.render();};});
    const search=nav.createEl('input',{attr:{type:'search',placeholder:c.search,'aria-label':c.search}});search.value=this.query;search.oninput=()=>{this.query=search.value;this.render();setTimeout(()=>this.contentEl.querySelector('input[type="search"]')?.focus(),0);};
    if(this.tab==='catalog'){
      const cats=nav.createDiv({cls:PLUGIN_ID+'-component-store-categories'});
      Object.entries(c.categories).forEach(([id,label])=>{const btn=cats.createEl('button',{cls:this.category===id?'active':'',text:label,attr:{type:'button'}});btn.onclick=()=>{this.category=id;this.render();};});
    }
  }
  _filteredEntries(visibleOnly=false) {
    const query=this.query.trim().toLowerCase();
    const byId=new Map(componentStoreEntries(this.view).map((entry)=>[entry.id,entry]));
    const ordered=this.draft.moduleOrder.map((id)=>byId.get(id)).filter(Boolean);
    componentStoreEntries(this.view).forEach((entry)=>{if(!ordered.some((item)=>item.id===entry.id))ordered.push(entry);});
    return ordered.filter((entry)=>(!visibleOnly||this._visible(entry.id))&&(this.category==='all'||entry.category===this.category)&&(!query||`${entry.label} ${entry.description}`.toLowerCase().includes(query)));
  }
  renderCurrent(body,c) {
    const list=body.createDiv({cls:PLUGIN_ID+'-component-layout-list'});const entries=this._filteredEntries(true);
    if(!entries.length){list.createDiv({cls:PLUGIN_ID+'-component-store-empty',text:this.query?c.noResults:c.empty});return;}
    entries.forEach((entry,index)=>{
      const row=list.createDiv({cls:PLUGIN_ID+'-component-layout-row',attr:{'data-module-id':entry.id}});
      row.ondragover=(event)=>{if(!this.dragId||this.dragId===entry.id)return;event.preventDefault();const after=event.clientY>=row.getBoundingClientRect().top+(row.getBoundingClientRect().height/2);list.querySelectorAll('.'+PLUGIN_ID+'-component-layout-row').forEach((item)=>{if(item!==row)item.classList.remove('drop-before','drop-after');});row.classList.toggle('drop-before',!after);row.classList.toggle('drop-after',after);if(event.dataTransfer)event.dataTransfer.dropEffect='move';};
      row.ondragleave=(event)=>{if(!row.contains(event.relatedTarget))row.classList.remove('drop-before','drop-after');};
      row.ondrop=(event)=>{event.preventDefault();if(this.dragId&&this.dragId!==entry.id){const placeAfter=row.classList.contains('drop-after');this.draft=moveComponentAtDrop(this.draft,this.dragId,entry.id,placeAfter);this.dragId='';this.render();}};
      const handle=row.createEl('button',{cls:PLUGIN_ID+'-component-row-handle',attr:{type:'button',draggable:'true','aria-label':this.view._t('layout.dragHandle',{module:entry.label})}});handle.title=this.view._t('layout.dragHandle',{module:entry.label});obs.setIcon(handle,'grip-vertical');
      handle.ondragstart=(event)=>{this.dragId=entry.id;if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',entry.id);}row.classList.add('dragging');};
      handle.ondragend=()=>{this.dragId='';list.querySelectorAll('.'+PLUGIN_ID+'-component-layout-row').forEach((item)=>item.classList.remove('dragging','drop-before','drop-after'));};
      const icon=row.createSpan({cls:PLUGIN_ID+'-component-row-icon'});obs.setIcon(icon,entry.icon);
      const text=row.createDiv({cls:PLUGIN_ID+'-component-row-text'});text.createDiv({cls:PLUGIN_ID+'-component-row-name',text:this.draft.moduleLabels[entry.id]||entry.label});text.createDiv({cls:PLUGIN_ID+'-component-row-description',text:entry.description});
      const tools=row.createDiv({cls:PLUGIN_ID+'-component-row-tools'});
      const up=tools.createEl('button',{text:'↑',attr:{type:'button','aria-label':'Up'}});up.disabled=index===0;up.onclick=()=>{if(index>0){this.draft=moveComponentBefore(this.draft,entry.id,entries[index-1].id);this.render();}};
      const down=tools.createEl('button',{text:'↓',attr:{type:'button','aria-label':'Down'}});down.disabled=index===entries.length-1;down.onclick=()=>{if(index<entries.length-1){const after=entries[index+2]?.id||null;this.draft=moveComponentBefore(this.draft,entry.id,after);this.render();}};
      const settings=tools.createEl('button',{text:c.configure,attr:{type:'button'}});settings.onclick=()=>{this.detailId=entry.id;this.render();};
      const remove=tools.createEl('button',{cls:'danger',text:c.remove,attr:{type:'button'}});remove.onclick=()=>this._setVisible(entry.id,false);
    });
  }
  renderCatalog(body,c) {
    const grid=body.createDiv({cls:PLUGIN_ID+'-component-catalog-grid'});const entries=this._filteredEntries(false);
    if(!entries.length){grid.createDiv({cls:PLUGIN_ID+'-component-store-empty',text:c.noResults});return;}
    entries.forEach((entry)=>{
      const card=grid.createDiv({cls:PLUGIN_ID+'-component-card'+(this._visible(entry.id)?' added':'')});
      const icon=card.createSpan({cls:PLUGIN_ID+'-component-card-icon'});obs.setIcon(icon,entry.icon);
      const main=card.createDiv({cls:PLUGIN_ID+'-component-card-main'});main.createDiv({cls:PLUGIN_ID+'-component-card-name',text:entry.label});main.createDiv({cls:PLUGIN_ID+'-component-card-category',text:c.categories[entry.category]});main.createDiv({cls:PLUGIN_ID+'-component-card-description',text:entry.description});
      renderComponentPreview(card,entry,'card');
      const actions=card.createDiv({cls:PLUGIN_ID+'-component-card-actions'});
      const settings=actions.createEl('button',{text:c.configure,attr:{type:'button'}});settings.onclick=()=>{this.detailId=entry.id;this.render();};
      const visible=this._visible(entry.id);const toggle=actions.createEl('button',{cls:visible?'':'mod-cta',text:visible?c.remove:c.add,attr:{type:'button'}});toggle.onclick=()=>this._setVisible(entry.id,!visible);
      if(visible)card.createSpan({cls:PLUGIN_ID+'-component-card-added',text:'✓ '+c.added});
    });
  }
  renderDetail(body,c) {
    const entry=componentStoreEntries(this.view).find((item)=>item.id===this.detailId);if(!entry){this.detailId='';this.render();return;}
    const hero=body.createDiv({cls:PLUGIN_ID+'-component-detail-hero'});const icon=hero.createSpan();obs.setIcon(icon,entry.icon);const text=hero.createDiv();text.createEl('h3',{text:entry.label});text.createDiv({text:entry.description});
    renderComponentPreview(body,entry,'detail');
    const generic=body.createDiv({cls:PLUGIN_ID+'-component-detail-generic'});generic.createDiv({cls:PLUGIN_ID+'-component-detail-section-title',text:c.rename});
    const rename=generic.createDiv({cls:PLUGIN_ID+'-component-rename-row'});const input=rename.createEl('input',{attr:{type:'text',maxlength:'40'}});input.value=this.draft.moduleLabels[entry.id]||'';input.placeholder=entry.label;
    input.oninput=()=>{const value=input.value.trim().slice(0,40);if(value)this.draft.moduleLabels[entry.id]=value;else delete this.draft.moduleLabels[entry.id];};
    const restore=rename.createEl('button',{text:c.restore,attr:{type:'button'}});restore.onclick=()=>{delete this.draft.moduleLabels[entry.id];this.render();};
    const visibility=generic.createEl('button',{cls:this._visible(entry.id)?'danger':'mod-cta',text:this._visible(entry.id)?c.remove:c.add,attr:{type:'button'}});visibility.onclick=()=>this._setVisible(entry.id,!this._visible(entry.id));
    if(entry.manager==='toolbar')this.renderToolbarManager(body,c);else if(entry.manager==='stats')this.renderStatsManager(body,c);else if(entry.manager==='tip')this.renderTipManager(body,c);
  }
  _toolbarButtons() {
    const raw=[...this.view._toolbarButtons().map((button)=>({...button,builtin:true})),...this.view._customToolbarButtons.map((button)=>({...button,action:'custom:'+button.id,builtin:false,icon:button.type==='url'?'🌐':'⌘'}))];
    const order=normalizeToolbarOrder(this.view,this.draft.toolbarOrder);this.draft.toolbarOrder=order;const positions=new Map(order.map((id,index)=>[id,index]));return raw.sort((a,b)=>positions.get(a.action)-positions.get(b.action));
  }
  renderToolbarManager(body,c) {
    const section=body.createDiv({cls:PLUGIN_ID+'-component-detail-section'});const title=section.createDiv({cls:PLUGIN_ID+'-component-detail-section-head'});title.createDiv({text:c.toolbarItems});title.createSpan({text:c.layoutScope});
    const list=section.createDiv({cls:PLUGIN_ID+'-component-nested-list'});const buttons=this._toolbarButtons();
    buttons.forEach((button,index)=>{
      const row=list.createDiv({cls:PLUGIN_ID+'-component-nested-row',attr:{draggable:'true'}});row.ondragstart=()=>{this.dragId=button.action;};row.ondragover=(e)=>{if(this.dragId&&this.dragId!==button.action)e.preventDefault();};row.ondrop=(e)=>{e.preventDefault();if(this.dragId&&this.dragId!==button.action){this.draft=moveNestedItemBefore(this.draft,'toolbarOrder',this.dragId,button.action);this.render();}};
      row.createSpan({cls:PLUGIN_ID+'-component-row-handle',text:'⠿'});row.createSpan({cls:PLUGIN_ID+'-component-nested-icon',text:button.icon});row.createDiv({cls:PLUGIN_ID+'-component-nested-name',text:button.label});
      const tools=row.createDiv({cls:PLUGIN_ID+'-component-nested-tools'});const hidden=button.builtin?this.draft.hiddenToolbarActions.includes(button.action):!!button.hidden;
      const toggle=tools.createEl('button',{text:hidden?c.show:c.hide,attr:{type:'button'}});toggle.onclick=async()=>{if(button.builtin){this.draft=setNestedItemVisibility(this.draft,'hiddenToolbarActions',button.action,hidden);this.render();}else{await this.view._saveCustomToolbarButtons(this.view._customToolbarButtons.map((item)=>item.id===button.id?{...item,hidden:!item.hidden}:item));this._markGlobalChanged();}};
      const root=this._dashboardRoot();
      if(button.builtin&&isConfigurableToolbarAction(button.action)){const edit=tools.createEl('button',{text:c.edit,attr:{type:'button'}});edit.onclick=()=>openBuiltinToolbarConfigEditor(this.view,root,button.action,{onChanged:()=>this._markGlobalChanged()});}
      if(button.builtin&&['hermes','cockpit-h5','work-log'].includes(button.action)){const remove=tools.createEl('button',{cls:'danger',text:c.delete,attr:{type:'button'}});remove.onclick=async()=>{if(!window.confirm(this.view._lang()==='en'?`Delete “${button.label}” from every layout?`:`从所有布局永久删除“${button.label}”？`))return;await this.view._deletePresetToolbarAction(button.action);this.draft.toolbarOrder=this.draft.toolbarOrder.filter((id)=>id!==button.action);this.draft.hiddenToolbarActions=this.draft.hiddenToolbarActions.filter((id)=>id!==button.action);this._markGlobalChanged();};}
      if(button.builtin&&button.action==='pomodoro'){const edit=tools.createEl('button',{text:c.configure,attr:{type:'button'}});edit.onclick=()=>openPomodoroToolbarConfigEditor(this.view,root,{onChanged:()=>this._markGlobalChanged()});}
      if(!button.builtin){const edit=tools.createEl('button',{text:c.edit,attr:{type:'button'}});edit.onclick=()=>openCustomToolbarButtonEditor(this.view,root,button,{onChanged:()=>this._markGlobalChanged()});}
    });
    const actions=section.createDiv({cls:PLUGIN_ID+'-component-detail-actions'});const root=this._dashboardRoot();
    const add=actions.createEl('button',{cls:'mod-cta',text:'+ '+c.addCustom,attr:{type:'button'}});add.onclick=()=>openCustomToolbarButtonEditor(this.view,root,null,{onChanged:()=>this._markGlobalChanged()});
    const logs=actions.createEl('button',{text:c.logs,attr:{type:'button'}});logs.onclick=()=>openCustomToolbarLogs(this.view);
    section.createDiv({cls:PLUGIN_ID+'-component-global-note',text:c.globalScope});
  }
  renderStatsManager(body,c) {
    const section=body.createDiv({cls:PLUGIN_ID+'-component-detail-section'});const title=section.createDiv({cls:PLUGIN_ID+'-component-detail-section-head'});title.createDiv({text:c.statsItems});title.createSpan({text:c.layoutScope});
    const byId=new Map(componentStoreStats(this.view).map((item)=>[item.id,item]));const order=this.view._normalizeStatsCardOrder(this.draft.statsCardOrder);this.draft.statsCardOrder=order;
    const list=section.createDiv({cls:PLUGIN_ID+'-component-nested-list'});order.map((id)=>byId.get(id)).filter(Boolean).forEach((item)=>{
      const row=list.createDiv({cls:PLUGIN_ID+'-component-nested-row',attr:{draggable:'true'}});row.ondragstart=()=>{this.dragId=item.id;};row.ondragover=(e)=>{if(this.dragId&&this.dragId!==item.id)e.preventDefault();};row.ondrop=(e)=>{e.preventDefault();if(this.dragId&&this.dragId!==item.id){this.draft=moveNestedItemBefore(this.draft,'statsCardOrder',this.dragId,item.id);this.render();}};
      row.createSpan({cls:PLUGIN_ID+'-component-row-handle',text:'⠿'});const icon=row.createSpan({cls:PLUGIN_ID+'-component-row-icon'});obs.setIcon(icon,'chart-no-axes-column-increasing');row.createDiv({cls:PLUGIN_ID+'-component-nested-name',text:item.label});
      const hidden=this.draft.hiddenStatsCards.includes(item.id);const toggle=row.createEl('button',{text:hidden?c.show:c.hide,attr:{type:'button'}});toggle.onclick=()=>{this.draft=setNestedItemVisibility(this.draft,'hiddenStatsCards',item.id,hidden);this.render();};
    });
  }
  renderTipManager(body,c) {
    const section=body.createDiv({cls:PLUGIN_ID+'-component-detail-section'});section.createDiv({cls:PLUGIN_ID+'-component-detail-section-title',text:c.tips});
    const button=section.createEl('button',{cls:'mod-cta',text:c.tips,attr:{type:'button'}});button.onclick=()=>new CockpitTipLibraryModal(this.view.app,this.view).open();
  }
}

function openComponentStore(view) {
  view._componentStoreModal?.close(); const modal=new CockpitComponentStoreModal(view.app,view);view._componentStoreModal=modal;modal.open();return modal;
}
