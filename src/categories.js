// categories.js — 基于文件索引的分类导航，不读取笔记正文。
function collectCockpitCategories(files, folders) {
  const groups = new Map((folders || []).filter((folder) => folder.children && folder.path && !folder.path.includes('/') && !folder.path.startsWith('.') && !folder.path.startsWith('_') && folder.path !== 'Templates').map((folder) => [folder.path, { path:folder.path, name:folder.path.replace(/^\d+[-_]/,'') || folder.path, files:[], updatedAt:0 }]));
  (files || []).forEach((file) => {
    const folder = groups.get(file.path.split('/')[0]);
    if (!folder || !file.path.includes('/')) return;
    folder.files.push(file);
    folder.updatedAt = Math.max(folder.updatedAt, Number(file.stat?.mtime) || 0);
  });
  return Array.from(groups.values()).sort((a,b) => a.path.localeCompare(b.path));
}

function openCockpitCategory(view, category) {
  const en = view._lang() === 'en';
  new CockpitDetailModal(view, category.name, (body, modal) => {
    const files = (view._allFiles || []).filter((file) => file.path.startsWith(category.path + '/'));
    body.createEl('p', { cls:'cockpit-detail-muted', text:category.path + ' · ' + (en ? files.length + ' notes' : files.length + ' 篇笔记') });
    const openFile = async (file) => {
      try { await view.app.workspace.getLeaf('tab').openFile(file); modal.close(); }
      catch (error) { console.warn('Cockpit category note open failed', error); new obs.Notice(en ? 'Could not open the note.' : '无法打开这篇笔记。'); }
    };
    const overview = files.find((file) => /概览|概述|\bMOC\b/i.test(file.basename));
    if (overview) cockpitDetailButton(body, (en ? 'Open overview · ' : '打开概览 · ') + overview.basename, () => openFile(overview));
    const controls = body.createDiv({ cls:PLUGIN_ID + '-category-controls' });
    const search = controls.createEl('input', { attr:{ type:'search', placeholder:en ? 'Find a note or subfolder…' : '查找笔记或子目录…', 'aria-label':en ? 'Find notes in category' : '查找分类笔记' } });
    const sort = controls.createEl('select', { attr:{ 'aria-label':en ? 'Sort notes' : '笔记排序' } });
    [['updated',en?'Recently updated':'最近更新'],['name',en?'Name':'名称']].forEach(([value,text]) => sort.createEl('option', { text, attr:{value} }));
    const count = body.createDiv({ cls:PLUGIN_ID + '-category-result-count', attr:{ 'aria-live':'polite' } });
    const list = body.createDiv({ cls:PLUGIN_ID + '-category-notes' });
    let limit = 80;
    const render = () => {
      list.empty();
      const query = search.value.trim().toLocaleLowerCase();
      const matches = files.filter((file) => file.path.toLocaleLowerCase().includes(query)).sort((a,b) => sort.value === 'name' ? a.path.localeCompare(b.path) : (Number(b.stat?.mtime)||0) - (Number(a.stat?.mtime)||0) || a.path.localeCompare(b.path));
      count.setText(en ? matches.length + ' matching notes' : matches.length + ' 篇笔记');
      if (!matches.length) list.createEl('p', { cls:'cockpit-detail-muted', text:en ? 'No matching notes in this folder.' : '这个文件夹内暂无符合条件的笔记。' });
      matches.slice(0,limit).forEach((file) => {
        const row = list.createEl('button', { cls:PLUGIN_ID + '-category-note', attr:{ type:'button' } });
        row.createSpan({ cls:PLUGIN_ID + '-category-note-name', text:file.basename });
        row.createSpan({ cls:PLUGIN_ID + '-category-note-path', text:file.path.slice(category.path.length + 1) });
        row.onclick = () => openFile(file);
      });
      if (matches.length > limit) cockpitDetailButton(list, en ? 'Show more notes' : '显示更多笔记', () => { limit += 80; render(); });
    };
    search.oninput = () => { limit = 80; render(); }; sort.onchange = render;
    render();
  }).open();
}

function cockpitBuildCategoriesSection(view, root, ctx) {
  const { t, lang, allFiles, makeCollapsible } = ctx;
  const en = lang === 'en';
  view._allFiles = allFiles;
  const title = root.createDiv({ cls:PLUGIN_ID + '-section-title', text:t('sections.cats') });
  title.dataset.section = 'cats-title';
  const body = root.createDiv({ cls:PLUGIN_ID + '-cats' });
  const controls = body.createDiv({ cls:PLUGIN_ID + '-category-controls' });
  const count = controls.createSpan({ cls:PLUGIN_ID + '-category-result-count', attr:{ 'aria-live':'polite' } });
  const search = controls.createEl('input', { attr:{ type:'search', placeholder:en ? 'Find a category…' : '查找分类…', 'aria-label':en ? 'Find a category' : '查找知识分类' } });
  const sort = controls.createEl('select', { attr:{ 'aria-label':en ? 'Sort categories' : '分类排序' } });
  [['name',en?'Name':'名称'],['updated',en?'Recently updated':'最近更新'],['count',en?'Note count':'笔记数量']].forEach(([value,text]) => sort.createEl('option', { text, attr:{value} }));
  const grid = body.createDiv({ cls:PLUGIN_ID + '-cats-grid' });
  let categoryIndex = [];
  const render = () => {
    if (!body.isConnected) return;
    const query = search.value.trim().toLocaleLowerCase();
    const categories = categoryIndex.filter((category) => category.path.toLocaleLowerCase().includes(query));
    categories.sort((a,b) => (sort.value === 'updated' ? b.updatedAt - a.updatedAt : sort.value === 'count' ? b.files.length - a.files.length : 0) || a.path.localeCompare(b.path));
    count.setText(en ? categories.length + ' categories' : categories.length + ' 个分类');
    grid.empty();
    categories.forEach((category) => {
      const card = grid.createEl('button', { cls:PLUGIN_ID + '-cat', attr:{ type:'button', title:category.path } });
      const icon = card.createSpan({ cls:PLUGIN_ID + '-cat-icon' }); obs.setIcon(icon, 'folder');
      const copy = card.createSpan({ cls:PLUGIN_ID + '-cat-copy' });
      copy.createSpan({ cls:PLUGIN_ID + '-cat-name', text:category.name });
      copy.createSpan({ cls:PLUGIN_ID + '-cat-count', text:t('categories.noteCount', { count:category.files.length }) });
      const arrow = card.createSpan({ cls:PLUGIN_ID + '-cat-arrow' }); obs.setIcon(arrow, 'chevron-right');
      card.onclick = () => { if (!view._editMode) openCockpitCategory(view, category); };
    });
    if (!categories.length) grid.createDiv({ cls:PLUGIN_ID + '-categories-empty', text:en ? 'No matching categories. Categories follow your top-level note folders.' : '没有匹配的分类。分类来自库内顶层笔记文件夹。' });
  };
  search.oninput = render; sort.onchange = render;
  const refresh = () => { categoryIndex = collectCockpitCategories(view._allFiles, view.app.vault.getAllLoadedFiles()); render(); };
  view._refreshCategoriesRef = refresh;
  refresh(); makeCollapsible(title, body, 'cats');
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={collectCockpitCategories};
