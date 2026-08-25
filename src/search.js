// search.js — 迷你搜索模块
// 导出：buildSearch(root, toolbar, allFiles, app)

function buildSearch(root, toolbar, allFiles, app) {
  let searchExpanded = false;
  const searchWrap = root.createDiv({ cls: PLUGIN_ID + '-search-row', attr:{style:'display:none'} });
  const searchInput = searchWrap.createEl('input', { cls: PLUGIN_ID + '-search-input', attr:{placeholder:'输入关键词搜索笔记...', type:'text'} });
  const searchResults = root.createDiv({ cls: PLUGIN_ID + '-search-results' });
  searchInput.addEventListener('input', ()=>{
    const q = searchInput.value.trim().toLowerCase();
    searchResults.empty();
    if (!q) return;
    allFiles.filter(f => f.basename.toLowerCase().includes(q)).slice(0,8).forEach(f=>{
      const item = searchResults.createDiv({ cls: PLUGIN_ID + '-search-item' });
      item.createSpan({ cls: PLUGIN_ID + '-search-name', text: f.basename });
      item.createSpan({ cls: PLUGIN_ID + '-search-path', text: f.path });
      item.onclick = ()=>{ app.workspace.getUnpinnedLeaf().setViewState({type:'markdown',state:{file:f.path}}); };
    });
  });
  // 重写搜索按钮行为
  toolbar.querySelector('button:nth-child(2)').onclick = ()=>{
    searchExpanded = !searchExpanded;
    searchWrap.style.display = searchExpanded ? 'flex' : 'none';
    if (searchExpanded) searchInput.focus();
    else { searchInput.value=''; searchResults.empty(); }
  };
}
