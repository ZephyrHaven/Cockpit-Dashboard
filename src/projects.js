// projects.js — 目标/项目进度条模块：按标签把待办聚合成“项目”，展示完成度。
// 详情使用内存待办和宿主元数据缓存，避免重复读取笔记正文。

function buildProjectsModule(view, root, options = {}) {
  const en = view._lang() === 'en';
  const onOpenProject = typeof options.onOpenProject === 'function' ? options.onOpenProject : null;

  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: view._t('sections.projects') });
  title.dataset.section = 'projects-title';
  const body = root.createDiv({ cls: PLUGIN_ID + '-projects' });
  body.dataset.section = 'projects-body';

  let showCompleted = false;
  const collectProjects = () => {
    const map = new Map();
    (view._todos || []).forEach((todo) => {
      const tags = Array.isArray(todo.tags) ? todo.tags : [];
      tags.forEach((rawTag) => {
        const tag = String(rawTag || '').replace(/^#/, '').trim();
        if (!tag || tag === '_archived') return;
        const entry = map.get(tag) || { tag, total:0, done:0 };
        entry.total += 1;
        if (todo.done) entry.done += 1;
        map.set(tag, entry);
      });
    });
    // 已完成项目可切换回顾，默认仍优先展示积压任务。
    return Array.from(map.values())
      .filter((entry) => showCompleted ? entry.done === entry.total : entry.done < entry.total)
      .sort((a, b) => (b.total - b.done) - (a.total - a.done) || b.total - a.total)
      .slice(0, 8);
  };

  const render = () => {
    if (!body.isConnected) return;
    body.empty();
    cockpitDetailButton(body, showCompleted ? (en ? 'Active projects' : '进行中项目') : (en ? 'Completed projects' : '已完成项目'), () => { showCompleted = !showCompleted; render(); });
    const projects = collectProjects();
    if (!projects.length) {
      body.createDiv({ cls: PLUGIN_ID + '-projects-empty', text: en
        ? 'No active projects yet. Tag your tasks with #tags and progress shows up here.'
        : '还没有进行中的项目。给待办加上 #标签，这里就会显示每个项目的完成度。' });
      return;
    }
    projects.forEach((project) => {
      const pct = project.total > 0 ? Math.round(project.done / project.total * 100) : 0;
      const row = body.createDiv({ cls: PLUGIN_ID + '-project-row', attr:{ role:'button', tabindex:'0' } });
      row.style.setProperty('--project-clr', COLORS[Math.abs(hashCockpitString(project.tag)) % COLORS.length]);
      const head = row.createDiv({ cls: PLUGIN_ID + '-project-head' });
      head.createDiv({ cls: PLUGIN_ID + '-project-name', text: '#' + project.tag });
      head.createDiv({ cls: PLUGIN_ID + '-project-count', text: project.done + '/' + project.total + ' · ' + pct + '%' });
      const bar = row.createDiv({ cls: PLUGIN_ID + '-project-bar' });
      bar.createDiv({ cls: PLUGIN_ID + '-project-fill', attr:{ style:'width:' + pct + '%' } });
      const open = () => {
        if (view._editMode) return;
        openCockpitProject(view, project.tag, options);
      };
      row.onclick = open;
      row.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
    });
  };

  view._refreshProjectsRef = render;
  render();
  view._makeModuleCollapsible('projects', title, body);
  return render;
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
