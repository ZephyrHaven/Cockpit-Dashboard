// ai-local-tools.js — Agent 的本地（笔记库之外）工具适配层。
// 安全模型：模型永远不能发明命令——只能使用这里内置的窄能力工具，
// 以及用户在配置中显式登记的命令允许列表；全部受三层权限模式约束。

const AI_LOCAL_TOOL_LIMITS = Object.freeze({
  commandTimeoutMs:20000,
  maxStdoutChars:4000,
  maxStderrChars:2000,
  maxArgs:8,
  maxArgChars:200,
  maxTargetChars:600,
  maxNotifyTitleChars:80,
  maxNotifyBodyChars:280,
  maxClipboardChars:8000
});

function isProtectedAiLocalPath() { /* 占位保持模块形状一致 */ }

// 轻量参数校验（与核心工具同语义的子集）：字符串长度、数组条目。
function validateLocalToolArguments(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Tool arguments must be an object.');
  if (Object.keys(value).some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('Tool arguments contain a forbidden field.');
  return value;
}

function validateLocalToolInput(tool, args) {
  const properties = tool?.parameters?.properties || {};
  const unknown = Object.keys(args).find((key) => !Object.prototype.hasOwnProperty.call(properties, key));
  if (unknown) throw new Error('Tool argument is not allowed: ' + unknown);
  (Array.isArray(tool?.parameters?.required) ? tool.parameters.required : []).forEach((name) => {
    if (!Object.prototype.hasOwnProperty.call(args, name)) throw new Error('Required tool argument is missing: ' + name);
  });
  Object.entries(args).forEach(([name, value]) => {
    const rule = properties[name];
    if (!rule) return;
    if (rule.type === 'string') {
      if (typeof value !== 'string') throw new Error('Tool argument ' + name + ' must be a string.');
      if (Number.isFinite(rule.minLength) && value.length < rule.minLength) throw new Error('Tool argument ' + name + ' is too short.');
      if (Number.isFinite(rule.maxLength) && value.length > rule.maxLength) throw new Error('Tool argument ' + name + ' is too long.');
    } else if (rule.type === 'array') {
      if (!Array.isArray(value)) throw new Error('Tool argument ' + name + ' must be an array.');
      if (Number.isFinite(rule.maxItems) && value.length > rule.maxItems) throw new Error('Tool argument ' + name + ' contains too many items.');
      if (rule.items?.type === 'string' && value.some((item) => typeof item !== 'string' || !item.length)) throw new Error('Tool argument ' + name + ' must contain non-empty strings.');
      if (rule.items?.maxLength && value.some((item) => String(item).length > rule.items.maxLength)) throw new Error('Tool argument ' + name + ' contains an item that is too long.');
    }
  });
  return args;
}

function localToolDefinitions(commands) {
  const runParameters = {
    type:'object', additionalProperties:false, required:['id'],
    properties:{
      id:{
        type:'string', minLength:1, maxLength:48,
        description:'Identifier of one user-configured allowlisted command.',
        enum:Array.isArray(commands) && commands.length ? commands.map((item) => item.id) : ['__none_configured__']
      },
      args:{ type:'array', maxItems:AI_LOCAL_TOOL_LIMITS.maxArgs, items:{ type:'string', minLength:1, maxLength:AI_LOCAL_TOOL_LIMITS.maxArgChars }, description:'Extra arguments appended after the configured base arguments.' }
    }
  };
  return [
    {
      name:'sys_notify',
      label:'系统通知',
      description:'Show a desktop notification outside the note-taking app.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false, required:['message'],
        properties:{
          title:{ type:'string', minLength:1, maxLength:AI_LOCAL_TOOL_LIMITS.maxNotifyTitleChars, description:'Short notification title.' },
          message:{ type:'string', minLength:1, maxLength:AI_LOCAL_TOOL_LIMITS.maxNotifyBodyChars, description:'Notification body text.' }
        }
      }
    },
    {
      name:'sys_clipboard_write',
      label:'写入系统剪贴板',
      description:'Copy the supplied text to the operating system clipboard so other apps can paste it.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false, required:['text'],
        properties:{ text:{ type:'string', minLength:1, maxLength:AI_LOCAL_TOOL_LIMITS.maxClipboardChars, description:'Text to place on the clipboard.' } }
      }
    },
    {
      name:'sys_open_target',
      label:'打开链接或文件',
      description:'Open an http(s) URL or an absolute local file/folder path with the OS default handler (browser, app, Finder/Explorer). Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['target'],
        properties:{ target:{ type:'string', minLength:2, maxLength:AI_LOCAL_TOOL_LIMITS.maxTargetChars, description:'http(s) URL, or absolute path to a local file or folder.' } }
      }
    },
    {
      name:'sys_run_command',
      label:'运行本地命令',
      description:'Execute one user-configured allowlisted local command by its id. The allowlist is owned by the user; the Agent cannot invent new commands. Requires user confirmation.',
      mutates:true,
      parameters:runParameters
    }
  ];
}

class CockpitLocalToolsRegistry {
  constructor(plugin, dependencies = {}) {
    this.plugin = plugin;
    this._dependencyOverrides = dependencies;
    this._deps = null;
    this._commands = [];
    this.byName = new Map(localToolDefinitions([]).map((tool) => [tool.name, tool]));
  }
  // 配置同步：由框架在启动与 AI 配置变更时调用；命令允许列表完全归用户所有。
  sync(config) {
    const raw = Array.isArray(config?.localCommands) ? config.localCommands : [];
    this._commands = raw
      .map((item) => ({
        id:String(item?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48),
        name:String(item?.name || '').slice(0, 60),
        command:String(item?.command || '').trim(),
        args:Array.isArray(item?.args) ? item.args.map((arg) => String(arg)).slice(0, AI_LOCAL_TOOL_LIMITS.maxArgs) : [],
        description:String(item?.description || '').slice(0, 200)
      }))
      .filter((item) => item.id && item.command);
  }
  _resolveDeps() {
    if (this._deps) return this._deps;
    const safeRequire = (moduleName) => { try { return typeof require === 'function' ? require(moduleName) : null; } catch (error) { return null; } };
    const electron = safeRequire('electron');
    const childProcess = safeRequire('child_process');
    const defaults = {
      shell:electron?.shell || null,
      clipboardWrite:(text) => {
        if (electron?.clipboard?.writeText) { electron.clipboard.writeText(text); return true; }
        return false;
      },
      notify:(title, body) => {
        if (typeof Notification === 'undefined') return false;
        try { new Notification(title, { body }); return true; } catch (error) { return false; }
      },
      execFile:childProcess?.execFile || null,
      workingDir:() => {
        try { return this.plugin?.app?.vault?.adapter?.basePath || ''; } catch (error) { return ''; }
      }
    };
    this._deps = { ...defaults, ...(this._dependencyOverrides || {}) };
    return this._deps;
  }
  definitions(mode) {
    const allowMutating = mode !== 'readonly';
    return localToolDefinitions(this._commands)
      .filter((tool) => {
        if (!allowMutating && tool.mutates) return false;
        if (tool.name === 'sys_run_command' && !this._commands.length) return false;
        return true;
      })
      .map((tool) => ({ type:'function', function:{ name:tool.name, description:tool.description, parameters:tool.parameters } }));
  }
  describe(name) {
    const tool = this.byName.get(String(name || ''));
    return tool ? { name:tool.name, label:tool.label, description:tool.description, mutates:tool.mutates } : null;
  }
  async execute(name, rawArguments, options = {}) {
    const tool = this.byName.get(String(name || ''));
    if (!tool) return null; // 让上层 hub 继续找其他注册表
    const args = validateLocalToolInput(tool, validateLocalToolArguments(rawArguments));
    if (tool.mutates && options.autoApprove !== true) {
      const confirmed = typeof options.confirm === 'function' && await options.confirm({
        name:tool.name, label:tool.label, description:tool.description, args, mutates:true
      });
      if (!confirmed) return { ok:false, denied:true, error:'User confirmation was not granted.' };
    }
    if (tool.name === 'sys_notify') return this._notify(args);
    if (tool.name === 'sys_clipboard_write') return this._writeClipboard(args);
    if (tool.name === 'sys_open_target') return this._openTarget(args);
    if (tool.name === 'sys_run_command') return this._runCommand(args);
    return null;
  }
  _notify(args) {
    const deps = this._resolveDeps();
    if (!deps.notify) throw new Error('Desktop notifications are unavailable in this environment.');
    const delivered = Boolean(deps.notify(String(args.title || 'Cockpit AI'), String(args.message)));
    return { ok:delivered, data:{ delivered } };
  }
  _writeClipboard(args) {
    const deps = this._resolveDeps();
    const delivered = Boolean(deps.clipboardWrite(String(args.text)));
    if (!delivered && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(String(args.text)).then(() => ({ ok:true, data:{ delivered:true } }))
        .catch(() => { throw new Error('Could not write the system clipboard.'); });
    }
    if (!delivered) throw new Error('Could not write the system clipboard.');
    return { ok:true, data:{ delivered:true } };
  }
  async _openTarget(args) {
    const deps = this._resolveDeps();
    if (!deps.shell) throw new Error('Opening external targets requires the desktop app.');
    const target = String(args.target || '').replace(/[\r\n\0]/g, '').trim();
    if (/^https?:\/\//i.test(target)) {
      await deps.shell.openExternal(target);
      return { ok:true, data:{ opened:target, via:'external' } };
    }
    if (/^[A-Za-z]:[\\/]/.test(target) || target.startsWith('/')) {
      const failureMessage = await deps.shell.openPath(target);
      if (failureMessage) throw new Error(failureMessage);
      return { ok:true, data:{ opened:target, via:'path' } };
    }
    throw new Error('Target must be an http(s) URL or an absolute local path.');
  }
  _runCommand(args) {
    const deps = this._resolveDeps();
    if (!deps.execFile) throw new Error('Running local commands requires the desktop app.');
    const entry = this._commands.find((item) => item.id === args.id);
    if (!entry) throw new Error('The requested command is not on the user allowlist.');
    const extraArgs = Array.isArray(args.args) ? args.args.map((item) => String(item)) : [];
    const finalArgs = [...entry.args, ...extraArgs];
    return new Promise((resolve) => {
      deps.execFile(entry.command, finalArgs, {
        timeout:AI_LOCAL_TOOL_LIMITS.commandTimeoutMs,
        windowsHide:true,
        maxBuffer:1024 * 1024,
        cwd:deps.workingDir() || undefined
      }, (error, stdout, stderr) => {
        if (error && error.killed) { resolve({ ok:false, error:'The command timed out.' }); return; }
        resolve({
          ok:!error || Boolean(String(stdout || '').length),
          data:{
            command:entry.command,
            exitCode:Number.isFinite(error?.code) ? error.code : 0,
            stdout:String(stdout || '').slice(0, AI_LOCAL_TOOL_LIMITS.maxStdoutChars),
            stderr:String(stderr || '').slice(0, AI_LOCAL_TOOL_LIMITS.maxStderrChars)
          }
        });
      });
    });
  }
}

function createCockpitLocalToolsRegistry(plugin, dependencies) {
  return new CockpitLocalToolsRegistry(plugin, dependencies);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    AI_LOCAL_TOOL_LIMITS, localToolDefinitions,
    validateLocalToolInput, CockpitLocalToolsRegistry, createCockpitLocalToolsRegistry
  };
}
