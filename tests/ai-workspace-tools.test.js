#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  AI_WORKSPACE_LIMITS,
  sanitizeWorkspaceRoot,
  expandWorkspaceRoot,
  isProtectedWorkspaceRelPath,
  workspaceGlobToRegExp,
  splitWorkspaceCommand,
  workspaceCommonDirPrefix,
  createCockpitWorkspaceToolsRegistry
} = require('../src/ai-workspace.js');
const { CockpitAgentToolHub, createCockpitAgentToolRegistry } = require('../src/ai-tools.js');
const { createCockpitLocalToolsRegistry } = require('../src/ai-local-tools.js');
const { normalizeAiConfig } = require('../src/ai.js');
const { groupAiSessionsByWorkspace } = require('../src/ai-history.js');

// ── 纯函数：路径归一化 / 保护规则 / glob / 命令分词 ─────────────────────────────
assert.equal(sanitizeWorkspaceRoot(' /tmp/a\n/b '), '/tmp/a/b', 'Control characters are stripped from the configured root.');
assert.equal(expandWorkspaceRoot('~', '/home/u'), '/home/u', 'A bare ~ expands to the home directory.');
assert.equal(expandWorkspaceRoot('~/proj', '/home/u'), '/home/u/proj', '~/proj expands under the home directory.');
assert.equal(isProtectedWorkspaceRelPath('.git/HEAD'), true, '.git internals are never writable.');
assert.equal(isProtectedWorkspaceRelPath('.gitignore'), false, 'Ordinary dotfiles stay editable.');
assert.ok(workspaceGlobToRegExp('src/**/*.ts').test('src/a/b.ts'), 'Double-star globs match nested paths.');
assert.ok(!workspaceGlobToRegExp('src/*.ts').test('src/a/b.ts'), 'Single-star globs do not cross directories.');
assert.deepEqual(
  splitWorkspaceCommand('node -e "console.log(\'a b\')" \'x y\''),
  ['node', '-e', "console.log('a b')", 'x y'],
  'The command tokenizer understands single and double quotes without a shell.'
);
assert.throws(() => splitWorkspaceCommand('echo "unterminated'), /unclosed quote/i);

// ── 沙箱集成测试：真实临时目录 ────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-ws-'));
const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-outside-'));
fs.mkdirSync(path.join(tmp, 'src'), { recursive:true });
fs.mkdirSync(path.join(tmp, 'node_modules'), { recursive:true });
fs.mkdirSync(path.join(tmp, '.git'), { recursive:true });
fs.writeFileSync(path.join(tmp, 'src', 'app.js'), 'const answer = 42;\nconsole.log("answer", answer);\n');
fs.writeFileSync(path.join(tmp, 'README.md'), '# Demo\n\nhello workspace\n');
fs.writeFileSync(path.join(tmp, 'node_modules', 'evil.js'), 'needle hidden in dependencies\n');
fs.writeFileSync(path.join(tmp, '.git', 'HEAD'), 'needle inside git metadata\n');
fs.writeFileSync(path.join(tmp, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02]));
fs.writeFileSync(path.join(outside, 'secret.txt'), 'top secret outside\n');

const plugin = {};
const registry = createCockpitWorkspaceToolsRegistry(plugin);
registry.sync({ workspaceRoot:tmp });
assert.equal(registry.available(), true, 'A valid absolute root makes the registry available.');

// 未配置工作区时不下发任何工具，也不产生环境简报。
const dormant = createCockpitWorkspaceToolsRegistry(plugin);
dormant.sync({});
assert.deepEqual(dormant.definitions('full'), [], 'No tools are advertised without a configured workspace.');
assert.equal(dormant.environment(), '', 'No environment brief without a configured workspace.');

// 权限模式：只读不下发写/编辑/命令工具；读写暴露全部六个。
const readonlyNames = registry.definitions('readonly').map((tool) => tool.function.name).sort();
assert.deepEqual(readonlyNames, ['ws_list_dir', 'ws_read_file', 'ws_search_text'], 'Read-only mode only offers read tools.');
assert.equal(registry.definitions('read-write').length, 6, 'Read/write mode exposes every workspace tool.');
registry.definitions('full').forEach((tool) => {
  assert.equal(tool.function.parameters.additionalProperties, false, tool.function.name + ' rejects undeclared arguments.');
});

(async () => {
  const confirmYes = { confirm:async () => true };

  // 目录浏览
  const listed = await registry.execute('ws_list_dir', {}, confirmYes);
  assert.equal(listed.ok, true);
  assert.ok(listed.data.items.some((item) => item.name === 'src' && item.type === 'dir'), 'Directories are listed with their type.');

  // 文件读取 + 行窗口
  const fullRead = await registry.execute('ws_read_file', { path:'src/app.js' });
  assert.equal(fullRead.data.totalLines, 2, 'Trailing newline does not count as an extra line.');
  assert.equal(fullRead.data.lines[0], 'const answer = 42;');
  const windowed = await registry.execute('ws_read_file', { path:'src/app.js', offset:1, limit:1 });
  assert.deepEqual(windowed.data.lines, ['const answer = 42;']);
  assert.equal(windowed.data.truncated, true, 'Unread trailing lines set the truncated flag.');

  // 二进制拒绝
  await assert.rejects(() => registry.execute('ws_read_file', { path:'blob.bin' }), /binary/i);

  // 沙箱边界：相对路径逃逸、绝对路径逃逸、符号链接逃逸一律拒绝。
  await assert.rejects(() => registry.execute('ws_read_file', { path:'../outside/secret.txt' }), /outside/i);
  await assert.rejects(() => registry.execute('ws_read_file', { path:path.join(outside, 'secret.txt') }), /outside/i);
  try {
    fs.symlinkSync(outside, path.join(tmp, 'escape-link'), 'dir');
    await assert.rejects(() => registry.execute('ws_read_file', { path:'escape-link/secret.txt' }), /(escapes|outside)/i, 'Symlink escapes are blocked via realpath.');
    await assert.rejects(
      () => registry.execute('ws_write_file', { path:'escape-link/leaked.txt', content:'x' }, confirmYes),
      /(escapes|outside|Refusing)/i,
      'Writes through symlinked directories are blocked.'
    );
  } finally {
    try { fs.unlinkSync(path.join(tmp, 'escape-link')); } catch (e) {}
  }

  // 写入：确认门 + 创建嵌套目录 + .git 保护
  const deniedWrite = await registry.execute('ws_write_file', { path:'notes/new.md', content:'hi' }, { confirm:async () => false });
  assert.equal(deniedWrite.denied, true, 'Mutating writes require user confirmation.');
  assert.ok(!fs.existsSync(path.join(tmp, 'notes')), 'A denied write creates nothing.');
  const created = await registry.execute('ws_write_file', { path:'notes/deep/new.md', content:'# new' }, confirmYes);
  assert.equal(created.data.created, true);
  assert.equal(fs.readFileSync(path.join(tmp, 'notes/deep/new.md'), 'utf8'), '# new', 'Parent folders are created automatically.');
  await assert.rejects(() => registry.execute('ws_write_file', { path:'.git/hooks/x', content:'x' }, confirmYes), /\.git/i);
  await assert.rejects(() => registry.execute('ws_write_file', { path:'', content:'' }, confirmYes));

  // 编辑：先读后改、唯一匹配、多义报错、replace_all、外部修改检测
  await assert.rejects(() => registry.execute('ws_edit_file', { path:'README.md', old_string:'hello', new_string:'bye' }, confirmYes), /read/i, 'Editing requires a prior ws_read_file.');
  await registry.execute('ws_read_file', { path:'README.md' });
  const edited = await registry.execute('ws_edit_file', { path:'README.md', old_string:'hello workspace', new_string:'hello edited workspace' }, confirmYes);
  assert.equal(edited.data.replacements, 1);
  assert.match(fs.readFileSync(path.join(tmp, 'README.md'), 'utf8'), /hello edited workspace/);
  fs.writeFileSync(path.join(tmp, 'dup.txt'), 'same same\n');
  await registry.execute('ws_read_file', { path:'dup.txt' });
  await assert.rejects(() => registry.execute('ws_edit_file', { path:'dup.txt', old_string:'same', new_string:'x' }, confirmYes), /matches 2|2 locations|replace_all/i, 'Ambiguous matches refuse to edit.');
  const allReplaced = await registry.execute('ws_edit_file', { path:'dup.txt', old_string:'same', new_string:'x', replace_all:true }, confirmYes);
  assert.equal(allReplaced.data.replacements, 2);
  fs.writeFileSync(path.join(tmp, 'dup.txt'), 'externally changed\n');
  await assert.rejects(() => registry.execute('ws_edit_file', { path:'dup.txt', old_string:'x', new_string:'y' }, confirmYes), /changed since/i, 'External modifications invalidate the read snapshot.');
  await registry.execute('ws_read_file', { path:'dup.txt' });

  // 搜索：跳过 node_modules/.git、glob 过滤、regex、上限
  for (let i = 0; i < 3; i++) fs.writeFileSync(path.join(tmp, 'src', 'hit' + i + '.js'), 'needle here\n');
  const searched = await registry.execute('ws_search_text', { query:'needle' });
  assert.ok(searched.data.items.every((item) => !item.path.startsWith('node_modules') && !item.path.startsWith('.git')), 'Dependency and git folders are skipped.');
  const globbed = await registry.execute('ws_search_text', { query:'workspace', glob:'*.md' });
  assert.deepEqual(globbed.data.items.map((item) => item.path), ['README.md'], 'Glob filters restrict searched files.');
  const regexHit = await registry.execute('ws_search_text', { query:'\\d+;', regex:true });
  assert.equal(regexHit.data.items[0]?.path, 'src/app.js');
  const capped = await registry.execute('ws_search_text', { query:'needle', maxResults:2 });
  assert.equal(capped.data.items.length, 2);
  assert.equal(capped.data.truncated, true);

  // 命令执行：cwd 为工作区、输出捕获、提权拒绝
  const ran = await registry.execute('ws_run_command', { command:"node -e console.log(process.cwd())" }, confirmYes);
  assert.equal(ran.ok, true);
  const realTmp = fs.realpathSync(tmp);
  assert.ok(realTmp.endsWith(path.basename(ran.data.stdout.trim())) || ran.data.stdout.trim() === realTmp, 'Commands run inside the sandbox root.');
  const failing = await registry.execute('ws_run_command', { command:'node -e process.exit(3)' }, confirmYes);
  assert.equal(failing.data.exitCode, 3, 'Non-zero exits surface to the model.');
  await assert.rejects(() => registry.execute('ws_run_command', { command:'sudo -l' }), /privilege/i, 'Privilege elevation is always refused.');
  const deniedRun = await registry.execute('ws_run_command', { command:'node -v' }, { confirm:async () => false });
  assert.equal(deniedRun.denied, true, 'Command execution requires confirmation outside full mode.');

  // Hub 聚合：工作区简报进入 environment，工具名进入 definitions
  const hub = new CockpitAgentToolHub([
    createCockpitAgentToolRegistry(plugin),
    createCockpitLocalToolsRegistry(plugin),
    registry
  ]);
  hub.sync({ workspaceRoot:tmp, localCommands:[{ id:'ping', command:'echo', args:['pong'] }] });
  assert.match(hub.environment('read-write'), /sandbox root/, 'The hub aggregates the workspace brief.');
  const hubNames = hub.definitions('read-write').map((tool) => tool.function.name);
  ['ws_write_file', 'sys_run_command', 'cockpit_create_todo'].forEach((name) => assert.ok(hubNames.includes(name), name + ' stays available through the hub.'));

  // checkPath：聊天面板在应用前即时校验用户输入
  assert.equal((await registry.checkPath('')).ok, false, 'Empty input is rejected.');
  const relativeCheck = await registry.checkPath('some/relative/path');
  assert.equal(relativeCheck.ok, false);
  assert.equal(relativeCheck.reason, 'relative', 'Relative paths are refused with a clear reason.');
  const missingCheck = await registry.checkPath(path.join(tmp, 'does-not-exist'));
  assert.equal(missingCheck.ok, false);
  assert.equal(missingCheck.reason, 'missing');
  const fileCheck = await registry.checkPath(path.join(tmp, 'README.md'));
  assert.equal(fileCheck.ok, false);
  assert.equal(fileCheck.reason, 'not-directory', 'Files are not valid workspace roots.');
  const dirCheck = await registry.checkPath(path.join(tmp, 'src'));
  assert.equal(dirCheck.ok, true);
  assert.ok(dirCheck.root.endsWith('/src'), 'A valid folder resolves to its absolute path.');
  const homeRegistry = createCockpitWorkspaceToolsRegistry({}, { homedir:'/home/tester' });
  const tildeCheck = await homeRegistry.checkPath('~/proj');
  assert.equal(tildeCheck.ok, false);
  assert.equal(tildeCheck.reason, 'missing');
  assert.equal(tildeCheck.root, '/home/tester/proj', '~ expands against the injected home directory.');

  // 配置归一化：最近工作区去重、去空、封顶 5 条
  const normalizedConfig = normalizeAiConfig({
    profiles:[{ id:'default', providerId:'custom', baseUrl:'https://provider.example/v1', model:'m' }],
    workspaceRecents:[' /a ', '/a', '/b', '', null, '/c', '/d', '/e', '/f']
  });
  assert.deepEqual(normalizedConfig.workspaceRecents, ['/a', '/b', '/c', '/d', '/e'], 'Recent workspaces are trimmed, deduped, and capped at five.');

  // 会话列表按工作区分组：活跃工作区最前，其余按最新活跃排序，未绑定归入空根组
  {
    const grouped = groupAiSessionsByWorkspace([
      { id:'s1', workspaceRoot:'/proj/a', updatedAt:100 },
      { id:'s2', workspaceRoot:'/proj/b', updatedAt:400 },
      { id:'s3', workspaceRoot:'', updatedAt:300 },
      { id:'s4', workspaceRoot:'/proj/a', updatedAt:500 },
      { id:'s5', workspaceRoot:'/proj/c', updatedAt:50 }
    ], '/proj/b');
    assert.deepEqual(grouped.map((group) => group.root), ['/proj/b', '/proj/a', '', '/proj/c'], 'Active workspace first; other groups follow by newest activity.');
    assert.deepEqual(grouped[1].sessions.map((session) => session.id), ['s4', 's1'], 'Sessions inside a group stay newest-first.');
    const noActive = groupAiSessionsByWorkspace([{ id:'s6', workspaceRoot:'', updatedAt:1 }, { id:'s7', workspaceRoot:'/proj/a', updatedAt:9 }], '');
    assert.equal(noActive[0].root, '', 'With no active root the unbound group leads.');
    assert.equal(groupAiSessionsByWorkspace(null, '').length, 0, 'Null input yields zero groups.');
  }

  // 文件夹选择器：公共前缀推导 + 无桌面环境的降级行为
  assert.equal(
    workspaceCommonDirPrefix(['/home/u/proj/src/a.js', '/home/u/proj/README.md', '/home/u/proj/src/deep/b.js']),
    '/home/u/proj',
    'The picked folder is the longest common directory prefix.'
  );
  assert.equal(workspaceCommonDirPrefix(['C:\\work\\demo\\a.ts', 'C:\\work\\demo\\pkg\\b.ts']), 'C:\\work\\demo', 'Windows paths keep their drive prefix.');
  assert.equal(workspaceCommonDirPrefix(['/p/x/a/f.js', '/p/y/b.js']), '/p', 'A folder that only contains subdirectories still resolves.');
  assert.equal(workspaceCommonDirPrefix([]), '');
  const unsupported = await registry.pickFolder();
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.reason, 'unsupported', 'Without Electron the picker reports unsupported so the UI can fall back to pasting.');

  // 回归：侧栏只接触 Hub，checkPath/pickFolder/describeWorkspace 必须经 Hub 透传。
  // （此前这三个方法只在内部注册表上，导致“选择文件夹”误报非桌面环境、“使用”按钮静默无响应。）
  assert.equal(typeof hub.checkPath, 'function', 'Hub must expose checkPath.');
  assert.equal(typeof hub.pickFolder, 'function', 'Hub must expose pickFolder.');
  const hubCheck = await hub.checkPath(path.join(tmp, 'src'));
  assert.equal(hubCheck.ok, true, 'Hub.checkPath proxies to the workspace registry.');
  const hubMissing = await hub.checkPath(path.join(tmp, 'nope'));
  assert.equal(hubMissing.ok, false);
  assert.equal(hubMissing.reason, 'missing', 'Hub.checkPath keeps structured reasons.');
  assert.equal((await hub.pickFolder()).reason, 'unsupported', 'Without Electron, Hub.pickFolder degrades gracefully.');
  assert.equal(hub.describeWorkspace()?.root, tmp, 'Hub.describeWorkspace exposes the sandbox root.');

  console.log('AI workspace tool checks passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(tmp, { recursive:true, force:true });
  fs.rmSync(outside, { recursive:true, force:true });
});
