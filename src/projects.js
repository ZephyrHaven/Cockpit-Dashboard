// projects.js — 目标/项目进度条模块：按标签把待办聚合成“项目”，展示完成度。
// 点击某个项目会联动下方待办列表按该标签过滤；数据全部来自内存中的待办，不额外读 vault。

function buildProjectsModule(view, root, options = {}) {
  const en = view._lang() === 'en';
  const onOpenProject = typeof options.onOpenProject === 'function' ? options.onOpenProject : null;

  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: view._t('sections.projects') });
  title.dataset.section = 'projects-title';
  const body = root.createDiv({ cls: PLUGIN_ID + '-projects' });
  body.dataset.section = 'projects-body';

  const collectProjects = () => {
    const map = new Map();
    (view._todos || []).forEach((todo) => {
      const tags = Array.isArray(todo.tags) ? todo.tags : [];
      tags.forEach((rawTag) => {
        const tag = String(rawTag || '').replace(/^#/, '').trim();
        if (!tag) return;
        const entry = map.get(tag) || { tag, total:0, done:0 };
        entry.total += 1;
        if (todo.done) entry.done += 1;
        map.set(tag, entry);
      });
    });
    // 只显示还有未完成项的项目（全部完成的归档意义不大），按积压量降序。
    return Array.from(map.values())
      .filter((entry) => entry.done < entry.total)
      .sort((a, b) => (b.total - b.done) - (a.total - a.done) || b.total - a.total)
      .slice(0, 8);
  };

  const render = () => {
    if (!body.isConnected) return;
    body.empty();
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
        if (onOpenProject) onOpenProject(project.tag);
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
