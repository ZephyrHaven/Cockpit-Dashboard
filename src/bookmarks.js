async function loadBookmarks(vault) {
  try {
    const f = vault.getAbstractFileByPath(BOOKMARK_FILE);
    if (!f) return new Set();
    const content = await vault.read(f);
    const set = new Set();
    content.split('\n').forEach(l => { const t=l.trim(); if(t && !t.startsWith('#')) set.add(t); });
    return set;
  } catch(e) { return new Set(); }
}
async function saveBookmarks(vault, bmSet) {
  try {
    const dir = BOOKMARK_FILE.split('/')[0];
    if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
    const content = '# 收藏文件\n\n' + Array.from(bmSet).sort().join('\n') + '\n';
    const file = vault.getAbstractFileByPath(BOOKMARK_FILE);
    if (file) await vault.modify(file, content);
    else await vault.create(BOOKMARK_FILE, content);
  } catch(e) { console.warn('saveBookmarks',e); }
}