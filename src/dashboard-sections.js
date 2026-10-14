// dashboard-sections.js — 从 _framework.js 的 _buildAll() 拆出的独立仪表盘区块。
// 每个函数只负责自身 DOM 与交互；共享状态仍挂在 view 上，跨区块协作通过 ctx 传入。

function cockpitBuildCategoriesSection(view, root, ctx) {
  const { t, lang, allFiles, makeCollapsible } = ctx;
  // ===== 3. Categories =====
  const catsTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.cats') });
  catsTitle.dataset.section = 'cats-title';
  const catsEl = root.createDiv({ cls: PLUGIN_ID+'-cats' });
  const allFolders = view.app.vault.getAllLoadedFiles()
    .filter(f=>f.children && f.path!=='' && f.path!=='/' && !f.path.includes('/') && !f.path.startsWith('.') && !f.path.startsWith('_') && f.path!=='Templates');
  const folderCounts = {};
  allFiles.forEach(f=>{
    const p=f.path.split('/');
    if (p.length>=2) folderCounts[p[0]]=(folderCounts[p[0]]||0)+1;
  });
  allFolders.sort((a,b)=>a.path.localeCompare(b.path));
  allFolders.forEach((folder,idx)=>{
    const count = folderCounts[folder.path]||0;
    const name = folder.path.replace(/^\d+[-_]/,'')||folder.path;
    const card = catsEl.createEl('button', { cls: PLUGIN_ID+'-cat', attr:{ type:'button', title:t('categories.openFolder', { folder:name }) } });
    card.style.setProperty('--cat-clr', COLORS[idx%COLORS.length]);
    card.createDiv({ cls: PLUGIN_ID+'-cat-icon', text: ICONS[idx%ICONS.length] });
    card.createDiv({ cls: PLUGIN_ID+'-cat-name', text: name });
    card.createDiv({ cls: PLUGIN_ID+'-cat-count', text: t('categories.noteCount', { count }) });
    card.onclick=async ()=>{
      const files = allFiles.filter(f=>f.path.startsWith(folder.path+'/')).sort((a,b)=>a.path.localeCompare(b.path));
      const overview = files.find(f=>f.basename.includes('概览')||f.basename.includes('MOC')||f.basename.includes('概述'));
      const target = overview || files[0];
      if (target) await view.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:target.path}});
      else new obs.Notice(t('categories.emptyFolder', { folder:name }));
    };
  });



  makeCollapsible(catsTitle, catsEl, 'cats');
}

function cockpitBuildStatsSection(view, root, ctx) {
  const { t, lang, allFiles, makeCollapsible } = ctx;
  // ===== 4. Stats（可动态更新）=====
  const statsTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.stats') });
  statsTitle.dataset.section = 'stats-title';
  const statsEl = root.createDiv({ cls: PLUGIN_ID+'-stats' });
  const noteCount = allFiles.filter(f=>f.basename!=='Home'&&f.basename!=='欢迎').length;
  const statConfig = [
    { label:t('stats.noteCount'), max:50, color:'#818cf8', type:'static', field:'noteCount' },
    { label:t('stats.todoCount'), max:20, color:'#c084fc', type:'dynamic', field:'todoCount' },
    { label:t('stats.doneCount'), max:1,  color:'#22c55e', type:'dynamic', field:'doneCount' },
    { label:t('stats.doneRate'),  max:100,color:'#34d399', type:'dynamic', field:'donePct', suffix:'%' },
    { label:t('stats.focusToday'),max:480,color:'#f97316', type:'dynamic', field:'focusMin', suffix:' min' },
    { label:lang==='en'?'Focus gap':'连续未专注',max:7,color:'#ef4444',type:'dynamic',field:'focusGap',suffix:lang==='en'?' d':' 天' },
    { label:lang==='en'?'Largest backlog':'最大标签积压',max:20,color:'#38bdf8',type:'dynamic',field:'tagBacklog' }
  ];
  const statById = new Map(statConfig.map((cfg) => [cfg.field, cfg]));
  const statValEls = new Map(), statFillEls = new Map();
  view._normalizeStatsCardOrder(view._statsCardOrder).map((id) => statById.get(id)).filter(Boolean).forEach((cfg)=>{
    const actionable = ['todoCount', 'doneCount', 'donePct', 'focusGap', 'tagBacklog'].includes(cfg.field);
    const card = statsEl.createDiv({ cls: PLUGIN_ID+'-stat' + (actionable ? ' actionable' : ''), attr:actionable ? { role:'button', tabindex:'0', title:lang === 'en' ? 'Open the related task list' : '查看关联待办列表', 'aria-label':lang === 'en' ? 'Open the related task list' : '查看关联待办列表' } : {} });
    card.dataset.statId = cfg.field;
    card.style.setProperty('--stat-clr', cfg.color);
    const editTools = card.createDiv({ cls:PLUGIN_ID+'-stat-edit-tools' });
    const hideBtn = editTools.createEl('button', { cls:PLUGIN_ID+'-stat-hide', text:'−', attr:{ type:'button' } });
    const dragHandle = editTools.createEl('button', { cls:PLUGIN_ID+'-stat-drag', text:'⠿', attr:{ type:'button', draggable:'true', title:lang === 'en' ? 'Drag to reorder' : '拖动排序', 'aria-label':lang === 'en' ? 'Drag to reorder' : '拖动排序', tabindex:'-1' } });
    card.createDiv({ cls: PLUGIN_ID+'-stat-label', text: cfg.label });
    const valEl = card.createDiv({ cls: PLUGIN_ID+'-stat-val' });
    statValEls.set(cfg.field, valEl);
    if (cfg.max > 0) {
      const bar = card.createDiv({ cls: PLUGIN_ID+'-stat-bar' });
      const fill = bar.createDiv({ cls: PLUGIN_ID+'-stat-fill', attr:{style:'width:0%'} });
      statFillEls.set(cfg.field, fill);
    } else {
      statFillEls.set(cfg.field, null);
    }
    hideBtn.onclick = async (event) => {
      event.preventDefault(); event.stopPropagation();
      if (!view._editMode) return;
      if (view._hiddenStatsCards.has(cfg.field)) view._hiddenStatsCards.delete(cfg.field);
      else view._hiddenStatsCards.add(cfg.field);
      await view._saveStatsCardLayout();
      view._applyModuleEditState(root);
    };
    card.ondragstart = (event) => {
      if (!view._editMode) { event.preventDefault(); return; }
      view._dragStatId = cfg.field;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-cockpit-stat', cfg.field);
    };
    card.ondragend = () => {
      view._dragStatId = null;
      card.classList.remove('dragging');
      statsEl.querySelectorAll('.stat-drop-before,.stat-drop-after').forEach((el) => el.classList.remove('stat-drop-before','stat-drop-after'));
    };
    card.ondragover = (event) => {
      const dragged = view._dragStatId || event.dataTransfer.getData('application/x-cockpit-stat');
      if (!view._editMode || !dragged || dragged === cfg.field) return;
      event.preventDefault();
      const rect = card.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2 || (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && event.clientX < rect.left + rect.width / 2);
      card.classList.toggle('stat-drop-before', before);
      card.classList.toggle('stat-drop-after', !before);
    };
    card.ondragleave = () => card.classList.remove('stat-drop-before','stat-drop-after');
    card.ondrop = async (event) => {
      const draggedId = view._dragStatId || event.dataTransfer.getData('application/x-cockpit-stat');
      if (!view._editMode || !draggedId || draggedId === cfg.field) return;
      event.preventDefault(); event.stopPropagation();
      const dragged = statsEl.querySelector('[data-stat-id="' + draggedId + '"]');
      if (!dragged) return;
      const rect = card.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2 || (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && event.clientX < rect.left + rect.width / 2);
      statsEl.insertBefore(dragged, before ? card : card.nextSibling);
      statsEl.querySelectorAll('.stat-drop-before,.stat-drop-after').forEach((el) => el.classList.remove('stat-drop-before','stat-drop-after'));
      view._statsCardOrder = Array.from(statsEl.querySelectorAll('[data-stat-id]')).map((el) => el.dataset.statId);
      await view._saveStatsCardLayout();
    };
    const openRelated = async () => {
      if (!actionable || view._editMode) return;
      await ctx.todoHooks.openRelated?.(cfg.field);
    };
    if (actionable) {
      card.onclick = (event) => { if (!event.target.closest('.' + PLUGIN_ID + '-stat-edit-tools')) openRelated(); };
      card.onkeydown = (event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.' + PLUGIN_ID + '-stat-edit-tools')) { event.preventDefault(); openRelated(); } };
    }
  });
  const updateStats = ()=>{
    const doneCount = view._todos.filter(t=>t.done).length;
    const todoCount = view._todos.length;
    const donePct = todoCount > 0 ? Math.round(doneCount/todoCount*100) : 0;
    const focusMin = view._focusMinutes || 0;
    let focusGap = 0; for (let offset=0; offset<30; offset++) { const key=window.moment().subtract(offset,'day').format('YYYY-MM-DD'); if ((view._focusHistory.get(key)||0)>0) break; focusGap++; }
    const tagCounts = new Map(); view._todos.filter((todo)=>!todo.done).forEach((todo)=>(todo.tags||[]).forEach((tag)=>tagCounts.set(tag,(tagCounts.get(tag)||0)+1))); const tagBacklog = Math.max(0,...tagCounts.values());
    const values = { noteCount, todoCount, doneCount, donePct, focusMin, focusGap, tagBacklog };
    Object.entries(values).forEach(([field,val])=>{
      const config = statById.get(field);
      if (statValEls.get(field)) cockpitAnimateNumber(statValEls.get(field), val, config?.suffix||'');
      const fill = statFillEls.get(field);
      if (fill) {
        const max = config.max;
        const pct = Math.min(100, max > 0 ? Math.round(val/max*100) : 0);
        fill.style.width = pct + '%';
      }
    });
  };
  view._updateStatsRef = updateStats;
  updateStats();
  makeCollapsible(statsTitle, statsEl, 'stats');
  return updateStats;
}

function cockpitBuildRecentSection(view, root, ctx) {
  const { t, lang, allFiles, makeCollapsible } = ctx;
  // ===== 6. Continue working: recent opened and recent modified =====
  const recentTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.recent') });
  recentTitle.dataset.section = 'recent-title';
  const recentMode = root.createDiv({ cls:PLUGIN_ID+'-recent-tabs' });
  view._recentEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
  view._allFiles = allFiles;
  const renderRecentMode = (mode) => {
    recentMode.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    view._recentEl.dataset.mode = mode;
    view._refreshRecentSection(root, view._allFiles);
  };
  [['opened',lang==='en'?'Recently opened':'最近打开'],['modified',lang==='en'?'Recently modified':'最近修改']].forEach(([mode,label])=>{const button=recentMode.createEl('button',{text:label,attr:{type:'button','data-mode':mode}});button.dataset.mode=mode;button.onclick=()=>renderRecentMode(mode);});
  view._recentEl.dataset.mode = 'opened';
  renderRecentMode('opened');
  makeCollapsible(recentTitle, view._recentEl, 'recent');
}

async function cockpitBuildBookmarksSection(view, root, ctx) {
  const { t, lang, allFiles, makeCollapsible } = ctx;
  // ===== 6.5 收藏文件 =====
  if (view._bookmarks.size > 0) {
    const bookmarkTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.bookmarks') });
    bookmarkTitle.dataset.section = 'bookmarks-title';
    const bmEl = root.createDiv({ cls: PLUGIN_ID+'-recent' });
    bmEl.dataset.section = 'bookmarks-list';
    // 列表、操作按钮、固定顺序与折叠状态统一由局部刷新渲染。
    await view._refreshBookmarkSection(root, allFiles);
  }
}

function cockpitBuildFlashSection(view, root, ctx) {
  const { t, lang, allFiles, makeCollapsible, commitTodoMutation, openTodoEditor } = ctx;
  // ===== 6.8 闪念胶囊 =====
  const flashTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.flash') });
  flashTitle.dataset.section = 'flash-title';
  const flashContent = root.createDiv();
  flashContent.dataset.section = 'flash-content';
  const flashWrap = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-row' });
  const flashInput = flashWrap.createEl('input', { cls: PLUGIN_ID+'-flash-input', attr:{placeholder:t('flash.placeholder'), type:'text'} });
  const flashOk = flashWrap.createEl('button', { cls: PLUGIN_ID+'-todo-input-ok', text:'✓' });
  const flashMsg = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-ok', attr:{style:'display:none'}, text:t('flash.saved') });
  const flashActions = flashContent.createDiv({ cls: PLUGIN_ID+'-flash-actions', attr:{style:'display:none', 'aria-live':'polite'} });
  let lastFlash = '';
  const hideFlashActions = () => { flashActions.style.display = 'none'; flashActions.empty(); };
  const showFlashActions = (text, filePath) => {
    hideFlashActions();
    const en = view._lang() === 'en';
    const makeAction = (label, title, action) => {
      const button = flashActions.createEl('button', { text:label, attr:{ type:'button', title, 'aria-label':title } });
      button.onclick = action;
    };
    makeAction(en ? 'Make todo' : '转为待办', en ? 'Create a todo from view thought' : '将刚才的闪念创建为待办', () => openTodoEditor({ text }));
    makeAction(en ? 'Add tag' : '添加标签', en ? 'Add a tag to view thought in today\'s note' : '给今日日记里的这条闪念添加标签', async () => {
      const tag = window.prompt(en ? 'Tag name' : '标签名称'); if (!tag) return;
      const file = view.app.vault.getAbstractFileByPath(filePath); if (!file) return;
      const rawTag = tag.replace(/^#/, '');
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 标签同样来自用户输入，必须转义后才能进 RegExp，否则含 + ( * 等字符会抛异常。
      const escapedTag = rawTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const content = await view.app.vault.read(file);
        await view.app.vault.modify(file, content.replace(new RegExp('(^- \\[[^\\]]+\\] ' + escaped + ')(?!.*#' + escapedTag + ')', 'm'), '$1 #' + rawTag));
        new obs.Notice(en ? 'Tag added.' : '标签已添加。');
      } catch (e) {
        console.warn('Cockpit: add flash tag failed', e);
        new obs.Notice(en ? 'Could not add a tag to view line.' : '无法给这条闪念添加标签。');
      }
    });
    makeAction(en ? 'Open today' : '打开今日日记', en ? 'Open today\'s daily note' : '打开保存这条闪念的今日日记', () => view.app.workspace.getUnpinnedLeaf().setViewState({ type:'markdown', state:{ file:filePath } }));
    makeAction(en ? 'Organize later' : '稍后整理', en ? 'Keep view thought in the dashboard inbox' : '把这条闪念保留在驾驶舱整理箱', async () => { const entry={id:'flash-'+Date.now().toString(36),text,filePath,createdAt:new Date().toISOString()};view._flashInbox=[...view._flashInbox,entry].slice(-100);await view._mutatePluginData((data)=>{const state=data.workspaceState&&typeof data.workspaceState==='object'?data.workspaceState:{};state.flashInbox=view._flashInbox;data.workspaceState=state;});flashTitle.dataset.pending=String(view._flashInbox.length);flashTitle.setText(t('sections.flash')+' · '+view._flashInbox.length);new obs.Notice(en?'Added to the organize-later inbox.':'已加入稍后整理。'); });
    makeAction(en ? 'Keep writing' : '继续记录', en ? 'Focus the quick-capture input' : '回到输入框继续记录', () => { hideFlashActions(); flashInput.focus(); });
    flashActions.style.display = 'flex';
  };
  const saveFlash = async ()=>{
    const v = flashInput.value.trim();
    if (!v) return;
    const today = window.moment().format('YYYY-MM-DD');
    const timeStr = window.moment().format('HH:mm');
    const filePath = `${DAILY_DIR}/${today}.md`;
    const prefix = `# ${today} ${t('flash.fileHeading')}\n\n`;
    const line = `- [${timeStr}] ${v}\n`;
    try {
      const f = view.app.vault.getAbstractFileByPath(DAILY_DIR);
      if (!f) await view.app.createFolder(DAILY_DIR);
      const ex = view.app.vault.getAbstractFileByPath(filePath);
      if (ex) {
        const old = await view.app.vault.read(ex);
        await view.app.vault.modify(ex, old + line);
      } else {
        await view.app.vault.create(filePath, prefix + line);
      }
      lastFlash = v;
      flashInput.value = '';
      flashMsg.style.display = 'block';
      setTimeout(()=>{ flashMsg.style.display = 'none'; }, 2000);
      showFlashActions(lastFlash, filePath);
    } catch(e) { console.warn('flash save',e); }
  };
  flashInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();saveFlash();} });
  flashOk.onclick = saveFlash;
  // 「稍后整理」箱：计数、标记已整理、AI 整理（聚类 → 转待办 / 保存笔记）。
  // 渲染封装成可重复调用的函数，AI 操作完成后局部刷新，不整页重绘。
  const renderFlashInboxUi = async () => {
    flashContent.querySelector('.' + PLUGIN_ID + '-flash-inbox')?.remove();
    if (!view._flashInbox.length) { flashTitle.setText(t('sections.flash')); delete flashTitle.dataset.pending; return; }
    flashTitle.setText(t('sections.flash')+' · '+view._flashInbox.length);
    flashTitle.dataset.pending = String(view._flashInbox.length);
    const inbox = flashContent.createDiv({ cls:PLUGIN_ID+'-flash-inbox' });
    inbox.createSpan({ text:(lang==='en'?'To organize: ':'待整理：')+view._flashInbox.length });
    const persistInbox = () => view._mutatePluginData((data)=>{const state=data.workspaceState&&typeof data.workspaceState==='object'?data.workspaceState:{};state.flashInbox=view._flashInbox;data.workspaceState=state;});
    const clear=inbox.createEl('button',{text:lang==='en'?'Mark organized':'标记已整理',attr:{type:'button'}});
    clear.onclick=async()=>{view._flashInbox=[];await persistInbox();await renderFlashInboxUi();};
    try {
      if (await isCockpitAiReady(view._plugin)) {
        const aiBtn=inbox.createEl('button',{cls:PLUGIN_ID+'-flash-inbox-ai',text:'✨ '+(lang==='en'?'AI organize':'AI 整理'),attr:{type:'button'}});
        aiBtn.onclick=async()=>{
          if (aiBtn.disabled) return;
          aiBtn.disabled=true;
          try {
            await organizeFlashInboxWithAi(view, {
              lang,
              addTodo:async(text)=>{
                const saved = await commitTodoMutation((todos)=>{
                  todos.unshift({ text, tags:[], priority:'mid', dueDate:null, dueHasTime:false, done:false, created:window.moment(), doneDate:null });
                  return true;
                }, lang==='en'?'Could not save the task.':'待办保存失败。');
                return !!saved;
              },
              saveNote:async(markdown)=>{
                const dirFile=view.app.vault.getAbstractFileByPath(DAILY_DIR);
                if (!dirFile) await view.app.createFolder(DAILY_DIR);
                const stamp=window.moment().format('YYYY-MM-DD HHmm');
                const notePath=`${DAILY_DIR}/${lang==='en'?'Flash Digest':'闪念整理'} ${stamp}.md`;
                const created=await view.app.vault.create(notePath, markdown);
                await view.app.workspace.getUnpinnedLeaf().setViewState({ type:'markdown', state:{ file:created.path } });
              },
              clearInbox:async()=>{ view._flashInbox=[]; await persistInbox(); await renderFlashInboxUi(); }
            });
          } catch(e){ console.warn('Cockpit flash AI organize failed', e); }
          finally { aiBtn.disabled=false; }
        };
      }
    } catch(e) {}
  };
  renderFlashInboxUi();
  makeCollapsible(flashTitle, flashContent, 'flash');
}

function cockpitBuildHeatmapSection(view, root, ctx) {
  const { t, lang, allFiles, makeCollapsible } = ctx;
  // ===== 底部：编辑热力图 =====
  const hmTitle = root.createDiv({ cls: PLUGIN_ID+'-section-title', text: t('sections.heatmap') });
  hmTitle.dataset.section = 'heatmap-title';
  const heatmapEl = root.createDiv({ cls: PLUGIN_ID+'-heatmap' });
  const today = window.moment();
  const dayCounts = {};
  const dayKeyByStart = new Map();
  const startOfToday = today.clone().startOf('day').valueOf();
  for (let i = 0; i < 30; i++) { const d = today.clone().subtract(i, 'days'); dayKeyByStart.set(d.clone().startOf('day').valueOf(), d.format('YYYY-MM-DD')); }
  const windowStart = startOfToday - 29 * 86400000;
  allFiles.forEach(f=>{
    const mtime = f.stat.mtime;
    if (mtime < windowStart) return;
    const key = dayKeyByStart.get(new Date(mtime).setHours(0, 0, 0, 0));
    if (key) dayCounts[key] = (dayCounts[key]||0) + 1;
  });
  const maxCount = Math.max(1, ...Object.values(dayCounts));
  // 5 级色阶：无→低→中→高→极高
  const colors = ['rgba(129,140,248,0.12)','rgba(129,140,248,0.3)','rgba(129,140,248,0.5)','rgba(99,102,241,0.7)','rgba(79,70,229,0.9)'];
  const getColor = (count) => {
    if (count === 0) return 'var(--background-modifier-border)';
    if (count >= maxCount * 0.8) return colors[4];
    if (count >= maxCount * 0.5) return colors[3];
    if (count >= maxCount * 0.25) return colors[2];
    return colors[1];
  };
  for (let i = 29; i >= 0; i--) {
    const d = today.clone().subtract(i, 'days');
    const key = d.format('YYYY-MM-DD');
    const count = dayCounts[key] || 0;
    const cell = heatmapEl.createDiv({ cls: PLUGIN_ID+'-hm-cell' });
    cell.title = key + ': ' + t('heatmap.files', { count });
    cell.tabIndex = 0; cell.setAttribute('role','button');
    const openDay = async () => { const dayStart=window.moment(key,'YYYY-MM-DD').valueOf(); const candidates=allFiles.filter((file)=>file.stat.mtime>=dayStart&&file.stat.mtime<dayStart+86400000).sort((a,b)=>b.stat.mtime-a.stat.mtime);if(candidates[0])await view.app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:candidates[0].path}});else new obs.Notice(lang==='en'?'No edited notes on view date.':'这一天没有编辑过的笔记。'); };
    cell.onclick=openDay;cell.onkeydown=(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openDay();}};
    cell.style.background = getColor(count);
  }
  // 图例
  const legend = hmTitle.createDiv({ cls: PLUGIN_ID+'-hm-legend' });
  legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: t('heatmap.low') });
  colors.forEach(c => {
    const dot = legend.createDiv({ cls: PLUGIN_ID+'-hm-legend-cell' });
    dot.style.background = c;
  });
  legend.createSpan({ cls: PLUGIN_ID+'-hm-legend-label', text: t('heatmap.high') });
  makeCollapsible(hmTitle, heatmapEl, 'heatmap');
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { cockpitBuildCategoriesSection, cockpitBuildStatsSection, cockpitBuildRecentSection, cockpitBuildBookmarksSection, cockpitBuildFlashSection, cockpitBuildHeatmapSection };
