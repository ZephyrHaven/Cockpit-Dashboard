#!/usr/bin/env node

const assert = require('node:assert/strict');
const {
  vaultToolDefinitions, vaultToolSafePath, vaultToolSafeFolder, vaultToolSafeTag,
  hasVaultToolTag, createCockpitVaultToolsRegistry
} = require('../src/ai-vault-tools.js');

(async () => {
// ── 路径安全 ────────────────────────────────────────────────────────────────
assert.equal(vaultToolSafePath('Projects/Plan.md'), 'Projects/Plan.md');
assert.equal(vaultToolSafePath('\\Projects\\Plan.md'), 'Projects/Plan.md', 'Backslashes normalize to slashes.');
assert.equal(vaultToolSafePath('/Leading.md'), 'Leading.md', 'Leading slashes are stripped.');
assert.throws(() => vaultToolSafePath('../escape.md'), /traverse/, 'Parent traversal is rejected.');
assert.throws(() => vaultToolSafePath('a/../../b.md'), /traverse/);
assert.throws(() => vaultToolSafePath('notes/plan.txt'), /\.md/, 'Only Markdown notes are accepted.');
assert.throws(() => vaultToolSafePath(''), /required/);
assert.equal(vaultToolSafeFolder('/Projects//'), 'Projects');
assert.throws(() => vaultToolSafeFolder('a/../b'), /traverse/);
assert.equal(vaultToolSafeTag('#Work'), 'Work', 'A leading hash is stripped.');
assert.equal(vaultToolSafeTag('a/b c'), 'abc', 'Tag-unsafe characters are removed.');

// ── 行内标签检测 ────────────────────────────────────────────────────────────
assert.equal(hasVaultToolTag('计划 #work 进行中', 'work'), true);
assert.equal(hasVaultToolTag('#workspace only', 'work'), false, 'Longer tags never count as shorter tags.');
assert.equal(hasVaultToolTag('中文#项目 标签', '项目'), true);
assert.equal(hasVaultToolTag('no tags here', 'work'), false);

// ── Vault 夹具 ──────────────────────────────────────────────────────────────
const files = new Map([
  ['Projects/Plan.md', '# 计划\n\n先做地基 #work'],
  ['Notes/Idea.md', '一个没有标签的想法'],
  ['.obsidian/plugins/x/README.md', 'private']
]);
const folders = new Set(['Projects', 'Notes', '.obsidian', '.obsidian/plugins']);
const fileFor = (path) => ({ path, extension: path.endsWith('.md') ? 'md' : '', stat:{ mtime:1, size:(files.get(path) || '').length } });
const writes = [];
const vault = {
  getAbstractFileByPath:(path) => {
    if (files.has(path)) return fileFor(path);
    if (folders.has(path)) return { path, type:'folder' };
    return null;
  },
  getMarkdownFiles:() => Array.from(files.keys()).filter((path) => path.endsWith('.md')).map(fileFor),
  cachedRead:async (file) => files.get(file.path),
  read:async (file) => files.get(file.path),
  create:async (path, content) => { files.set(path, content); writes.push('create:' + path); return fileFor(path); },
  modify:async (file, content) => { files.set(file.path, content); writes.push('modify:' + file.path); },
  rename:async (file, newPath) => { files.set(newPath, files.get(file.path)); files.delete(file.path); writes.push('rename:' + file.path + '->' + newPath); },
  createFolder:async () => {}
};
const registry = createCockpitVaultToolsRegistry({ app:{ vault } });

// ── 定义与权限档位 ──────────────────────────────────────────────────────────
assert.equal(vaultToolDefinitions().length, 6);
const allNames = registry.definitions().map((tool) => tool.function.name);
assert.deepEqual(allNames.sort(), [
  'vault_add_tags', 'vault_append_note', 'vault_create_note', 'vault_list_notes', 'vault_move_note', 'vault_read_note'
].sort());
const readonlyNames = registry.definitions('readonly').map((tool) => tool.function.name);
assert.deepEqual(readonlyNames, ['vault_list_notes', 'vault_read_note'], 'Read-only mode never exposes mutating note tools.');

// ── 列出笔记 ────────────────────────────────────────────────────────────────
{
  const listed = await registry.execute('vault_list_notes', { folder:'Projects' });
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.data.items.map((item) => item.path), ['Projects/Plan.md'], 'Folder filter keeps the protected tree out by prefix scoping.');
  const tagged = await registry.execute('vault_list_notes', { tag:'work' });
  assert.deepEqual(tagged.data.items.map((item) => item.path), ['Projects/Plan.md'], 'Tag filter matches inline hashtags only.');
  assert.equal((await registry.execute('vault_list_notes', { tag:'missing-tag' })).data.items.length, 0);
  assert.equal((await registry.execute('vault_list_notes', {})).data.items.length, 2, 'The protected configuration tree is never listed.');
}

// ── 读取笔记 ────────────────────────────────────────────────────────────────
{
  files.set('Notes/Long.md', '长'.repeat(500));
  const read = await registry.execute('vault_read_note', { path:'Notes/Long.md', maxChars:200 });
  assert.equal(read.data.content.length, 200);
  assert.equal(read.data.truncated, true, 'Oversized notes are truncated to the requested budget.');
  assert.equal(read.data.totalChars, 500);
  const full = await registry.execute('vault_read_note', { path:'Projects/Plan.md' });
  assert.equal(full.data.truncated, false, 'Short notes are returned in full.');
  await assert.rejects(() => registry.execute('vault_read_note', { path:'.obsidian/plugins/x/README.md' }), /protected/, 'Protected paths are rejected even when a file exists.');
  await assert.rejects(() => registry.execute('vault_read_note', { path:'Notes/Missing.md' }), /not found/i);
}

// ── 创建笔记 ────────────────────────────────────────────────────────────────
{
  const created = await registry.execute('vault_create_note', { title:'会议记录', content:'第一条' }, { autoApprove:true });
  assert.equal(created.data.path, '_daily/会议记录.md', 'Fresh notes default to the daily-notes folder.');
  assert.equal(files.get('_daily/会议记录.md'), '第一条');
  await assert.rejects(() => registry.execute('vault_create_note', { title:'会议记录' }, { autoApprove:true }), /already exists/i, 'Existing notes are never overwritten.');
  await assert.rejects(() => registry.execute('vault_create_note', { title:'x', folder:'../escape' }, { autoApprove:true }), /traverse/);
  const custom = await registry.execute('vault_create_note', { title:'Spec', folder:'Projects/Specs', content:'内容' }, { autoApprove:true });
  assert.equal(custom.data.path, 'Projects/Specs/Spec.md');
}

// ── 追加内容 ────────────────────────────────────────────────────────────────
{
  const appended = await registry.execute('vault_append_note', { path:'Notes/Idea.md', content:'补充内容' }, { autoApprove:true });
  assert.equal(appended.data.ok !== false, true);
  assert.match(files.get('Notes/Idea.md'), /想法\n\n补充内容\n$/, 'A missing trailing newline gets a blank-line separator.');
  await registry.execute('vault_append_note', { path:'Notes/Idea.md', content:'再追加' }, { autoApprove:true });
  assert.match(files.get('Notes/Idea.md'), /补充内容\n再追加\n$/, 'Already-newline-terminated content appends with a single newline.');
  await assert.rejects(() => registry.execute('vault_append_note', { path:'Notes/Absent.md', content:'x' }, { autoApprove:true }), /not found/i);
}

// ── 移动 / 重命名 ───────────────────────────────────────────────────────────
{
  const moved = await registry.execute('vault_move_note', { path:'Notes/Idea.md', newPath:'Archive/Idea-2026.md' }, { autoApprove:true });
  assert.equal(moved.data.from, 'Notes/Idea.md');
  assert.equal(files.has('Archive/Idea-2026.md'), true, 'The note is moved into a freshly ensured folder.');
  assert.equal(files.has('Notes/Idea.md'), false);
  await assert.rejects(() => registry.execute('vault_move_note', { path:'Projects/Plan.md', newPath:'Projects/Plan.md' }, { autoApprove:true }), /identical/);
  await assert.rejects(() => registry.execute('vault_move_note', { path:'Projects/Plan.md', newPath:'Projects/Specs/Spec.md' }, { autoApprove:true }), /already exists/i, 'Moving never overwrites an existing note.');
  await assert.rejects(() => registry.execute('vault_move_note', { path:'Projects/Plan.md', newPath:'.obsidian/plan.md' }, { autoApprove:true }), /protected/);
}

// ── 添加标签 ────────────────────────────────────────────────────────────────
{
  files.set('Projects/Plan.md', '# 计划\n\n先做地基 #work');
  const tagged = await registry.execute('vault_add_tags', { path:'Projects/Plan.md', tags:['work', 'plan', '#q3'] }, { autoApprove:true });
  assert.deepEqual(tagged.data.added, ['plan', 'q3'], 'Only missing tags are appended, hashes stripped.');
  assert.match(files.get('Projects/Plan.md'), /#plan #q3\n$/);
  const again = await registry.execute('vault_add_tags', { path:'Projects/Plan.md', tags:['plan'] }, { autoApprove:true });
  assert.deepEqual(again.data.added, [], 'A repeated tagging is a no-op.');
}

// ── 确认链路 ────────────────────────────────────────────────────────────────
{
  const denied = await registry.execute('vault_create_note', { title:'未确认' });
  assert.equal(denied.denied, true, 'A mutating tool without a confirm callback is denied by default.');
  const refused = await registry.execute('vault_create_note', { title:'未确认' }, { confirm:async () => false });
  assert.equal(refused.denied, true);
  assert.equal(files.has('_daily/未确认.md'), false, 'Denied tools never touch the vault.');
  let asked = null;
  const allowed = await registry.execute('vault_create_note', { title:'已确认' }, { confirm:async (request) => { asked = request; return true; } });
  assert.equal(allowed.ok, true);
  assert.equal(asked.mutates, true, 'The confirm callback receives the mutation metadata.');
  const auto = await registry.execute('vault_create_note', { title:'免确认' }, { autoApprove:true });
  assert.equal(auto.ok, true, 'Full-permission mode skips the interactive confirmation.');
}

console.log('Agent vault tool checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
