// projects.js — 目标/项目进度卡片模块：按标签把待办聚合成“项目”，展示完成度。
// 详情使用内存待办和宿主元数据缓存，避免重复读取笔记正文。

function buildProjectsModule(view, root, options = {}) {
  const en = view._lang() === 'en';
  const title = root.createDiv({ cls:PLUGIN_ID + '-section-title', text:view._t('sections.projects') });
  title.dataset.section = 'projects-title';
  const body = root.createDiv({ cls:PLUGIN_ID + '-projects' });
  body.dataset.section = 'projects-body';
  const controls = body.createDiv({ cls:PLUGIN_ID + '-project-controls' });
  const tabs = controls.createDiv({ cls:PLUGIN_ID + '-workspace-tabs', attr:{ role:'tablist', 'aria-label':en ? 'Project status' : '项目状态' } });
  const activeTab = tabs.createEl('button', { attr:{ type:'button', role:'tab' } });
  const completedTab = tabs.createEl('button', { attr:{ type:'button', role:'tab' } });
  const search = controls.createEl('input', { attr:{ type:'search', placeholder:en ? 'Find a project…' : '查找项目…', 'aria-label':en ? 'Find a project' : '查找项目' } });
  const grid = body.createDiv({ cls:PLUGIN_ID + '-projects-grid' });
  const more = body.createEl('button', { cls:PLUGIN_ID + '-projects-more', attr:{ type:'button' } });
  let showCompleted = false;
  let limit = 8;
  let projectIndex = [];
  const render = () => {
    if (!body.isConnected) return;
    grid.empty();
    const all = projectIndex;
    activeTab.setText((en ? 'Active' : '进行中') + ' ' + all.filter((entry) => entry.open > 0).length);
    completedTab.setText((en ? 'Completed' : '已完成') + ' ' + all.filter((entry) => entry.open === 0).length);
    activeTab.setAttribute('aria-selected', String(!showCompleted)); completedTab.setAttribute('aria-selected', String(showCompleted));
    activeTab.tabIndex = showCompleted ? -1 : 0; completedTab.tabIndex = showCompleted ? 0 : -1;
    const query = search.value.trim().toLocaleLowerCase();
    const matches = all.filter((entry) => (showCompleted ? entry.open === 0 : entry.open > 0) && entry.tag.toLocaleLowerCase().includes(query));
    const projects = matches.slice(0,limit);
    more.hidden = matches.length <= limit;
    more.setText(en ? 'Show more projects' : '显示更多项目');
    if (!projects.length) {
      grid.createDiv({ cls:PLUGIN_ID + '-projects-empty', text:query ? (en ? 'No matching projects.' : '没有符合条件的项目。') : showCompleted ? (en ? 'No completed projects yet.' : '暂时没有已完成的项目。') : (en ? 'Tag tasks with #tags to track project progress here.' : '给待办添加 #标签，即可在这里跟踪项目进度。') });
      return;
    }
    projects.forEach((project) => {
      const pct = project.total > 0 ? Math.round(project.done / project.total * 100) : 0;
      const row = grid.createDiv({ cls:PLUGIN_ID + '-project-row', attr:{ role:'button', tabindex:'0', 'aria-label':'#' + project.tag + ' · ' + pct + '%' } });
      row.style.setProperty('--project-clr', COLORS[Math.abs(hashCockpitString(project.tag)) % COLORS.length]);
      const head = row.createDiv({ cls:PLUGIN_ID + '-project-head' });
      const icon = head.createSpan({ cls:PLUGIN_ID + '-project-icon' }); obs.setIcon(icon, 'folder-kanban');
      head.createDiv({ cls:PLUGIN_ID + '-project-name', text:'#' + project.tag });
      const arrow = head.createSpan({ cls:PLUGIN_ID + '-project-arrow' }); obs.setIcon(arrow, 'arrow-up-right');
      const metrics = row.createDiv({ cls:PLUGIN_ID + '-project-metrics' });
      metrics.createSpan({ cls:PLUGIN_ID + '-project-percent', text:pct + '%' });
      metrics.createSpan({ cls:PLUGIN_ID + '-project-count', text:en ? project.done + ' / ' + project.total + ' completed' : '已完成 ' + project.done + ' / ' + project.total });
      const bar = row.createDiv({ cls:PLUGIN_ID + '-project-bar', attr:{ role:'progressbar', 'aria-label':en ? 'Completion' : '完成进度', 'aria-valuemin':'0', 'aria-valuemax':'100', 'aria-valuenow':String(pct) } });
      bar.createDiv({ cls:PLUGIN_ID + '-project-fill', attr:{ style:'width:' + pct + '%' } });
      const status = row.createDiv({ cls:PLUGIN_ID + '-project-status' });
      status.createSpan({ text:en ? project.open + ' remaining' : '剩余 ' + project.open + ' 项' });
      if (project.overdue) status.createSpan({ cls:'is-overdue', text:en ? project.overdue + ' overdue' : project.overdue + ' 项逾期' });
      const next = row.createDiv({ cls:PLUGIN_ID + '-project-next' });
      next.createSpan({ cls:PLUGIN_ID + '-project-next-label', text:en ? 'Next' : '下一项' });
      next.createSpan({ cls:PLUGIN_ID + '-project-next-title', text:project.nextTodo?.text || (en ? 'All tasks completed' : '所有待办均已完成'), attr:{ title:project.nextTodo?.text || '' } });
      const open = () => {
        if (view._editMode) return;
        openCockpitProject(view, project.tag, options);
      };
      row.onclick = open;
      row.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
    });
  };

  const selectStatus = (completed) => { showCompleted = completed; limit = 8; render(); };
  activeTab.onclick = () => selectStatus(false); completedTab.onclick = () => selectStatus(true);
  [activeTab,completedTab].forEach((tab) => { tab.onkeydown = (event) => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    selectStatus(event.key === 'Home' ? false : event.key === 'End' ? true : !showCompleted);
    (showCompleted ? completedTab : activeTab).focus();
  }; });
  search.oninput = () => { limit = 8; render(); };
  more.onclick = () => { limit += 8; render(); };
  const refresh = () => { projectIndex = collectCockpitProjects(view._todos || []); render(); };
  view._refreshProjectsRef = refresh;
  refresh();
  view._makeModuleCollapsible('projects', title, body);
  return refresh;
}

// 稳定的小字符串哈希：为项目条分配固定颜色，避免每次渲染换色。
function hashCockpitString(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  return hash;
}

function openCockpitProject(view, tag, options = {}) {
  const en = view._lang() === 'en';
  new CockpitDetailModal(view, '#' + tag, (body, modal) => {
    const tasks = (view._todos || []).filter(todo=>todo.tags?.includes(tag));
    const overdue = tasks.filter(todo=>!todo.done && todo.dueDate && (todo.dueHasTime ? todo.dueDate.isBefore(window.moment()) : todo.dueDate.isBefore(window.moment(),'day'))).length;
    const focus = tasks.reduce((sum,todo)=>sum+(getTodoFocusStat(view._pomodoroTaskStats,todo)?.totalMinutes||0),0);
    body.createEl('p',{text:(en?'Completed ':'已办 ')+tasks.filter(todo=>todo.done).length+'/'+tasks.length+' · '+(en?'Overdue ':'逾期 ')+overdue+' · '+focus+' min'});
    cockpitDetailButton(body,en?'Filter in task list':'在待办中筛选',()=>{options.onOpenProject?.(tag);modal.close();});
    tasks.slice(0,120).forEach(todo=>{
      const row=body.createDiv({cls:'cockpit-detail-row'}), stat=getTodoFocusStat(view._pomodoroTaskStats,todo);
      row.createSpan({text:(todo.done?'✓ ':'○ ')+todo.text+(todo.dueDate?' · '+todo.dueDate.format('YYYY-MM-DD'):'')+(stat?' · '+stat.totalMinutes+' min':'')});
      cockpitDetailButton(row,en?'Edit':'编辑',()=>{modal.close();options.onEditTodo?.(todo);});
      if(!todo.done)cockpitDetailButton(row,en?'Focus':'专注',()=>{modal.close();options.onFocusTodo?.(todo);});
    });
    if(tasks.length>120)body.createEl('p',{text:en?'Showing 120 tasks; use the filtered task list to see more.':'显示前 120 项，使用待办筛选查看其余任务。'});
    body.createEl('h3',{text:en?'Related notes':'相关笔记'});
    const files=(view._allFiles||[]).filter(file=>{
      const cache=view.app.metadataCache?.getFileCache?.(file), tags=[...(cache?.tags||[]).map(item=>item.tag.replace(/^#/,'')), ...[].concat(cache?.frontmatter?.tags||[]).flatMap(value=>String(value).split(/[,\s]+/)).map(value=>value.replace(/^#/,''))];
      return tags.includes(tag);
    });
    if(!files.length)body.createEl('p',{text:en?'No notes share this tag.':'暂无同标签的笔记。'});
    files.slice(0,30).forEach(file=>cockpitDetailButton(body,file.basename||file.path,async()=>{await view.app.workspace.getLeaf('tab').openFile(file);modal.close();}));
  }).open();
}

function collectCockpitProjects(todos, now = Date.now()) {
  const groups = new Map();
  const today = new Date(now); today.setHours(0,0,0,0);
  (todos || []).forEach((todo) => {
    const tags = new Set((Array.isArray(todo.tags) ? todo.tags : []).map((tag) => String(tag || '').replace(/^#/, '').trim()).filter(Boolean));
    if (tags.has('_archived')) return;
    tags.forEach((tag) => {
      const entry = groups.get(tag) || { tag, total:0, done:0, open:0, overdue:0, nextTodo:null };
      entry.total++;
      if (todo.done) entry.done++;
      else {
        entry.open++;
        const due = todo.dueDate ? Number(todo.dueDate.valueOf()) : Infinity;
        if (due < (todo.dueHasTime ? now : today.valueOf())) entry.overdue++;
        const nextDue = entry.nextTodo?.dueDate ? Number(entry.nextTodo.dueDate.valueOf()) : Infinity;
        if (!entry.nextTodo || due < nextDue) entry.nextTodo = todo;
      }
      groups.set(tag, entry);
    });
  });
  return Array.from(groups.values()).sort((a,b) => b.open - a.open || b.total - a.total || a.tag.localeCompare(b.tag));
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={collectCockpitProjects};
