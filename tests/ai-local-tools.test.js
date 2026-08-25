#!/usr/bin/env node
// ai-local-tools.test.js — Agent 本地工具适配层：白名单、权限模式、确认门与命令允许列表。

const assert = require('node:assert/strict');

const {
  AI_LOCAL_TOOL_LIMITS,
  localToolDefinitions,
  validateLocalToolInput,
  CockpitLocalToolsRegistry
} = require('../src/ai-local-tools.js');
const { createCockpitAgentToolRegistry, CockpitAgentToolHub } = require('../src/ai-tools.js');
const { normalizeAiConfig } = require('../src/ai.js');

function makeRegistry(dependencies = {}, commands = []) {
  const registry = new CockpitLocalToolsRegistry({ app:{ vault:{ adapter:{ basePath:'/tmp/vault' } } } }, dependencies);
  if (commands.length) registry.sync({ localCommands:commands });
  return registry;
}

(async () => {
  // ── 白名单定义与权限过滤 ────────────────────────────────────────────────────
  {
    const registry = makeRegistry();
    const names = registry.definitions('read-write').map((item) => item.function.name);
    assert.deepEqual(names.sort(), ['sys_clipboard_write', 'sys_notify', 'sys_open_target'], 'Built-in local tools ship without any user commands.');
    const readonlyNames = registry.definitions('readonly').map((item) => item.function.name);
    assert.deepEqual(readonlyNames.sort(), ['sys_clipboard_write', 'sys_notify'], 'Read-only mode drops externally acting tools.');
    assert.ok(!registry.describe('write_file'), 'Unknown tools stay unresolvable.');
  }

  // ── 用户命令允许列表：登记后暴露 run_command，且枚举只含登记 id ──────────────
  {
    const registry = makeRegistry({}, [
      { id:'open-vscode', command:'code', args:['-r'], description:'Open folder in VS Code' },
      { id:'list-dir', command:'ls' }
    ]);
    const defs = registry.definitions('full');
    const runDef = defs.find((item) => item.function.name === 'sys_run_command');
    assert.ok(runDef, 'Configured commands expose the runner tool.');
    assert.deepEqual(runDef.function.parameters.properties.id.enum, ['open-vscode', 'list-dir'], 'The model can only pick ids from the user allowlist.');
    const empty = makeRegistry({});
    assert.ok(!empty.definitions('full').some((item) => item.function.name === 'sys_run_command'), 'Without allowlist entries the runner is not offered.');
  }

  // ── 系统通知与剪贴板 ────────────────────────────────────────────────────────
  {
    let notified = null;
    let clipboardText = null;
    const registry = makeRegistry({
      notify:(title, body) => { notified = title + '|' + body; return true; },
      clipboardWrite:(text) => { clipboardText = text; return true; }
    });
    await assert.rejects(
      () => registry.execute('sys_notify', { message:'x'.repeat(AI_LOCAL_TOOL_LIMITS.maxNotifyBodyChars + 1) }, {}),
      /too long/i,
      'Notification bodies respect the length cap.'
    );
    const notifyResult = await registry.execute('sys_notify', { title:'提醒', message:'番茄钟结束' });
    assert.equal(notifyResult.ok, true);
    assert.equal(notified, '提醒|番茄钟结束');
    const clipResult = await registry.execute('sys_clipboard_write', { text:'复制这段文字' });
    assert.equal(clipResult.ok, true);
    assert.equal(clipboardText, '复制这段文字');
  }

  // ── 打开目标：URL 与绝对路径分派；危险协议被拒绝 ─────────────────────────────
  {
    const openedExternal = [];
    const openedPaths = [];
    const registry = makeRegistry({
      shell:{
        openExternal:async (target) => { openedExternal.push(target); },
        openPath:async (target) => { openedPaths.push(target); return ''; }
      }
    });
    await registry.execute('sys_open_target', { target:'https://obsidian.md' }, { autoApprove:true });
    await registry.execute('sys_open_target', { target:'/Users/demo/Documents' }, { autoApprove:true });
    assert.deepEqual(openedExternal, ['https://obsidian.md'], 'Web URLs go through the OS handler.');
    assert.deepEqual(openedPaths, ['/Users/demo/Documents'], 'Absolute paths open locally.');
    await assert.rejects(
      () => registry.execute('sys_open_target', { target:'javascript:alert(1)' }, { autoApprove:true }),
      /absolute local path|http/i,
      'Non-http protocols and relative paths are rejected.'
    );
    const denied = await registry.execute('sys_open_target', { target:'https://example.com' }, {});
    assert.equal(denied.denied, true, 'Opening external targets still requires confirmation outside full mode.');
  }

  // ── 命令执行：仅允许列表内 id，参数合并，超时与输出封顶 ──────────────────────
  {
    const calls = [];
    const registry = makeRegistry({
      execFile:(command, args, options, callback) => {
        calls.push({ command, args, options });
        callback(null, 'line-one\nline-two', '');
      }
    }, [{ id:'list-dir', command:'ls', args:['-la'] }]);
    const result = await registry.execute('sys_run_command', { id:'list-dir', args:['Projects'] }, { autoApprove:true });
    assert.equal(result.ok, true, 'Allowlisted commands run successfully.');
    assert.deepEqual(calls[0].args, ['-la', 'Projects'], 'Configured base arguments come before per-call extras.');
    assert.equal(calls[0].options.cwd, '/tmp/vault', 'Commands run inside the vault working directory.');
    assert.match(result.data.stdout, /line-one/);

    const denied = await registry.execute('sys_run_command', { id:'list-dir' }, {});
    assert.equal(denied.denied, true, 'Command execution requires confirmation outside full mode.');

    await assert.rejects(
      () => registry.execute('sys_run_command', { id:'not-in-list' }, { autoApprove:true }),
      /allowlist/i,
      'The Agent cannot invoke commands outside the user allowlist.'
    );
    const timeoutRegistry = makeRegistry({
      execFile:(command, args, options, callback) => callback(Object.assign(new Error('killed'), { killed:true }))
    }, [{ id:'slow', command:'sleep' }]);
    const timedOut = await timeoutRegistry.execute('sys_run_command', { id:'slow' }, { autoApprove:true });
    assert.equal(timedOut.ok, false, 'Timed-out commands report a clean failure.');
  }

  // ── 组合 Hub：核心工具与本地工具统一暴露、按名路由 ───────────────────────────
  {
    let clipboardText = null;
    const localRegistry = makeRegistry({
      clipboardWrite:(text) => { clipboardText = text; return true; },
      shell:{ openExternal:async () => {}, openPath:async () => '' },
      notify:() => true,
      execFile:(command, args, options, callback) => callback(null, '', '')
    });
    const hub = new CockpitAgentToolHub([createCockpitAgentToolRegistry({}), localRegistry]);
    const allNames = hub.definitions('read-write').map((item) => item.function.name);
    assert.ok(allNames.includes('cockpit_list_todos') && allNames.includes('sys_open_target'), 'Core and local tools are offered together.');
    const readonlyNames = hub.definitions('readonly').map((item) => item.function.name);
    assert.ok(readonlyNames.includes('cockpit_list_todos') && readonlyNames.includes('sys_notify'), 'Read-only mode keeps safe tools from both registries.');
    assert.ok(!readonlyNames.includes('cockpit_create_todo'), 'Read-only mode still hides core mutations.');
    assert.equal(hub.describe('sys_clipboard_write')?.label, '写入系统剪贴板', 'Describe routes into the local registry.');
    const routed = await hub.execute('sys_clipboard_write', { text:'hub 路由成功' });
    assert.equal(routed.ok, true);
    assert.equal(clipboardText, 'hub 路由成功');
    hub.sync({ localCommands:[{ id:'ping', command:'ping' }] });
    assert.ok(hub.definitions('full').some((item) => item.function.name === 'sys_run_command'), 'Hub sync refreshes the local allowlist.');
    await assert.rejects(() => hub.execute('made_up_tool', {}), /not available/i, 'Unknown names fail clearly through the hub.');
  }

  // ── 配置清洗：非法条目剔除、字段封顶、重复 id 去重 ───────────────────────────
  {
    const config = normalizeAiConfig({
      profiles:[{ id:'default', providerId:'custom', baseUrl:'https://x/v1', model:'m' }],
      localCommands:[
        { id:'ok-1', command:' code ', args:['-r', 42], description:'ok' },
        { id:'', command:'no-id' },
        { id:'ok-1', command:'dup' },
        { noCommand:true }
      ]
    });
    assert.deepEqual(config.localCommands.map((item) => item.id), ['ok-1'], 'Only well-formed unique entries survive normalization.');
    assert.deepEqual(config.localCommands[0].args, ['-r', '42'], 'Scalar args are coerced to strings instead of being dropped.');
    assert.equal(config.localCommands[0].command, 'code', 'Commands are trimmed.');
  }

  console.log('AI local tool checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
