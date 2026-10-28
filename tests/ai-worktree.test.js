#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { createCockpitWorkspaceToolsRegistry } = require('../src/ai-workspace.js');

if (spawnSync('git', ['--version'], { stdio:'ignore' }).status !== 0) {
  console.log('AI Git worktree checks skipped: Git is unavailable');
} else {
  (async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-isolated-'));
    const repo = path.join(base, 'project');
    fs.mkdirSync(repo);
    let created = null;
    try {
      execFileSync('git', ['-C', repo, 'init', '-q']);
      fs.writeFileSync(path.join(repo, 'committed.txt'), 'committed\n');
      execFileSync('git', ['-C', repo, 'add', 'committed.txt']);
      execFileSync('git', ['-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial']);
      fs.writeFileSync(path.join(repo, 'uncommitted.txt'), 'private draft\n');
      const registry = createCockpitWorkspaceToolsRegistry({});
      registry.sync({ workspaceRoot:repo });
      created = await registry.createIsolatedWorktree();
      assert.equal(created.ok, true);
      assert.ok(created.root.startsWith(path.join(base, '.cockpit-agent-worktrees') + path.sep));
      assert.equal(fs.readFileSync(path.join(created.root, 'committed.txt'), 'utf8'), 'committed\n');
      assert.equal(fs.existsSync(path.join(created.root, 'uncommitted.txt')), false, 'Uncommitted source work is never copied.');
      const nested = createCockpitWorkspaceToolsRegistry({});
      nested.sync({ workspaceRoot:path.join(repo, 'subfolder') });
      fs.mkdirSync(path.join(repo, 'subfolder'));
      await assert.rejects(() => nested.createIsolatedWorktree(), /repository root/i);
      console.log('AI Git worktree checks passed');
    } finally {
      if (created?.root) { try { execFileSync('git', ['-C', repo, 'worktree', 'remove', '--force', created.root]); } catch (error) {} }
      fs.rmSync(base, { recursive:true, force:true });
    }
  })().catch((error) => { console.error(error); process.exitCode = 1; });
}
