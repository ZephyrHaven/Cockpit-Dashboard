// ai-workspace.js — Agent 的工作区（沙箱）能力层。
// 类似 DeepSeek Harness 的模型：用户在设置里指定一个绝对路径作为「工作区」，
// Agent 获得该目录内的 list / read / write / edit / search 与命令执行工具；
// 一切路径都被约束在沙箱根目录内（词法 + realpath 双重校验，拒绝符号链接逃逸），
// 全部工具仍受三档权限模式（readonly / read-write / full）与确认机制约束。
// 未配置工作区或非桌面环境时，本注册表不下发任何工具。

const AI_WORKSPACE_LIMITS = Object.freeze({
  maxRootChars:600,
  maxPathChars:400,
  maxQueryChars:200,
  maxGlobChars:120,
  readMaxLines:2000,
  readDefaultLines:800,
  maxReadSourceBytes:1048576,
  maxLineChars:2000,
  maxReadOutputChars:60000,
  maxWriteChars:900000,
  maxWriteBytes:1048576,
  maxEditOldChars:16000,
  maxEditNewChars:32000,
  maxEditTargetBytes:4194304,
  listDefaultLimit:200,
  listMaxLimit:500,
  searchDefaultResults:20,
  searchMaxResults:40,
  searchMaxFiles:1500,
  searchMaxFileBytes:524288,
  searchPerFileHits:5,
  commandTimeoutMs:120000,
  maxCommandChars:600,
  maxStdoutChars:8000,
  maxStderrChars:4000
});

// 命令执行始终拒绝的程序：提权类操作必须由用户亲自完成，Agent 无权代劳。
const AI_WORKSPACE_DENIED_PROGRAMS = Object.freeze(['sudo', 'su', 'doas']);

function sanitizeWorkspaceRoot(value) {
  return String(value ?? '').replace(/[\r\n\0]+/g, '').trim().slice(0, AI_WORKSPACE_LIMITS.maxRootChars);
}

// 设置值支持以 ~ 开头的家目录简写；其余必须是绝对路径。
function expandWorkspaceRoot(value, homedir) {
  const raw = sanitizeWorkspaceRoot(value);
  if (!raw) return '';
  if ((raw === '~' || raw.startsWith('~/')) && homedir) {
    const rest = raw.slice(1).replace(/^\/+/, '');
    return rest ? homedir + '/' + rest : homedir;
  }
  return raw;
}

// .git 目录承载版本库内部状态，禁止 Agent 通过文件工具改写。
function isProtectedWorkspaceRelPath(rel) {
  const value = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return value === '.git' || value.startsWith('.git/');
}

function clampWorkspaceInteger(value, fallback, min, max) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function clipWorkspaceLine(text, maxLength) {
  const line = String(text ?? '');
  return line.length > maxLength ? line.slice(0, maxLength) + '…' : line;
}

function looksLikeWorkspaceBinary(buffer) {
  const empty = typeof Buffer !== 'undefined' ? Buffer.alloc(0) : new Uint8Array(0);
  const sample = buffer instanceof Uint8Array ? buffer.subarray(0, 8192) : empty;
  for (const byte of sample) { if (byte === 0) return true; }
  return false;
}

// 渲染进程与 Node 都可用的 UTF-8 字节数；极端环境退回字符数估算。
function workspaceByteLength(text) {
  const value = String(text ?? '');
  if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') return Buffer.byteLength(value, 'utf8');
  try { return new TextEncoder().encode(value).length; } catch (error) { return value.length; }
}

// 极简 glob（*、**、?），锚定整个相对路径；非法输入返回 null 由调用方报错。
function workspaceGlobToRegExp(pattern) {
  const raw = String(pattern ?? '').trim();
  if (!raw || raw.length > AI_WORKSPACE_LIMITS.maxGlobChars) return null;
  let output = '';
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (char === '*') {
      if (raw[index + 1] === '*') { output += '.*'; index++; }
      else output += '[^/]*';
    } else if (char === '?') output += '[^/]';
    else output += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  try { return new RegExp('^' + output + '$', 'i'); }
  catch (error) { return null; }
}

// 命令分词：支持单双引号与反斜杠转义；不经过 shell，杜绝管道/注入语法。
function splitWorkspaceCommand(input) {
  const text = String(input ?? '');
  const tokens = [];
  let current = '';
  let hasToken = false;
  let quote = '';
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = '';
      else if (quote === '"' && char === '\\' && index + 1 < text.length && '"\\$`'.includes(text[index + 1])) current += text[++index];
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; hasToken = true; continue; }
    if (char === '\\' && index + 1 < text.length) { current += text[++index]; hasToken = true; continue; }
    if (/\s/.test(char)) {
      if (hasToken) { tokens.push(current); current = ''; hasToken = false; }
      continue;
    }
    current += char; hasToken = true;
  }
  if (quote) throw new Error('The command has an unclosed quote.');
  if (hasToken) tokens.push(current);
  return tokens.map((token) => token.slice(0, 300)).slice(0, 32);
}

function validateWorkspaceToolInput(tool, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object.');
  if (Object.keys(args).some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('Tool arguments contain a forbidden field.');
  const schema = tool?.parameters || {};
  const properties = schema.properties || {};
  const unknown = Object.keys(args).find((key) => !Object.prototype.hasOwnProperty.call(properties, key));
  if (unknown) throw new Error('Tool argument is not allowed: ' + unknown);
  (Array.isArray(schema.required) ? schema.required : []).forEach((name) => {
    if (!Object.prototype.hasOwnProperty.call(args, name)) throw new Error('Required tool argument is missing: ' + name);
  });
  Object.entries(args).forEach(([name, value]) => {
    const rule = properties[name];
    if (!rule) return;
    if (rule.type === 'string') {
      if (typeof value !== 'string') throw new Error('Tool argument ' + name + ' must be a string.');
      if (Number.isFinite(rule.minLength) && value.length < rule.minLength) throw new Error('Tool argument ' + name + ' is too short.');
      if (Number.isFinite(rule.maxLength) && value.length > rule.maxLength) throw new Error('Tool argument ' + name + ' is too long.');
    } else if (rule.type === 'integer') {
      if (!Number.isInteger(value)) throw new Error('Tool argument ' + name + ' must be an integer.');
      if (Number.isFinite(rule.minimum) && value < rule.minimum) throw new Error('Tool argument ' + name + ' is below the minimum.');
      if (Number.isFinite(rule.maximum) && value > rule.maximum) throw new Error('Tool argument ' + name + ' exceeds the maximum.');
    } else if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error('Tool argument ' + name + ' must be a boolean.');
    }
  });
  return args;
}

// 从 webkitdirectory 选择器返回的若干文件绝对路径中，推导用户所选的文件夹：
// 即所有文件目录段的最长公共前缀（兼容「所选文件夹只包含子目录」的情况）。
function workspaceCommonDirPrefix(paths) {
  const raw = (Array.isArray(paths) ? paths : []).map((item) => String(item || '')).filter(Boolean);
  if (!raw.length) return '';
  const sep = /\\/.test(raw[0]) ? '\\' : '/';
  const dirs = raw.slice(0, 300).map((value) => {
    const segments = value.split(/[\\/]+/);
    segments.pop(); // 去掉文件名本身
    return segments;
  });
  let prefix = dirs[0];
  for (const segments of dirs.slice(1)) {
    let index = 0;
    while (index < prefix.length && index < segments.length && prefix[index].toLowerCase() === segments[index].toLowerCase()) index += 1;
    prefix = prefix.slice(0, index);
    if (!prefix.length) return '';
  }
  // Unix 绝对路径的公共前缀至少含开头的 '' 段；Windows 盘根形如 'C:'
  if (prefix.length === 1 && prefix[0] === '') return '/';
  const joined = prefix.join(sep);
  if (/^[A-Za-z]:$/.test(joined)) return joined + '\\';
  return joined || '';
}

// 回退方案：用隐藏的 <input type="file" webkitdirectory> 打开原生文件夹选择器，
// 再经 Electron 的 webUtils.getPathForFile（或旧版 File.path）还原绝对路径。
function pickWorkspaceFolderViaInput(webUtils) {
  if (typeof document === 'undefined' || !document.body) throw new Error('No DOM available.');
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.style.display = 'none';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { input.remove(); } catch (error) { /* 已移除 */ }
      resolve(value);
    };
    input.addEventListener('change', () => {
      try {
        const files = Array.from(input.files || []);
        if (!files.length) return finish(null);
        const paths = files.map((file) => {
          try { if (webUtils?.getPathForFile) return String(webUtils.getPathForFile(file) || ''); } catch (error) { /* 老接口兜底 */ }
          return String(file.path || '');
        }).filter(Boolean);
        finish(paths.length ? workspaceCommonDirPrefix(paths) : null);
      } catch (error) { reject(error); }
    });
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
    // 部分环境取消选择不派发 cancel 事件，超时兜底避免悬挂。
    window.setTimeout(() => finish(null), 10 * 60 * 1000);
  });
}

function workspaceToolDefinitions() {  const limits = AI_WORKSPACE_LIMITS;
  const pathRule = { type:'string', minLength:1, maxLength:limits.maxPathChars, description:'Path relative to the workspace sandbox root. Absolute paths are accepted only when they stay inside the root.' };
  return [
    {
      name:'ws_list_dir',
      label:'浏览工作区目录',
      description:'List one directory inside the workspace sandbox with entry types and sizes.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false,
        properties:{
          path:{ ...pathRule, minLength:0, description:'Directory path relative to the workspace root. Empty means the root itself.' },
          limit:{ type:'integer', minimum:1, maximum:limits.listMaxLimit, description:'Maximum number of entries.' }
        }
      }
    },
    {
      name:'ws_read_file',
      label:'读取工作区文件',
      description:'Read a text file inside the workspace as numbered-free lines with optional line offset/limit. Must be called before editing the same file.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false, required:['path'],
        properties:{
          path:pathRule,
          offset:{ type:'integer', minimum:1, maximum:1000000, description:'1-based first line to return.' },
          limit:{ type:'integer', minimum:1, maximum:limits.readMaxLines, description:'Maximum number of lines to return.' }
        }
      }
    },
    {
      name:'ws_search_text',
      label:'搜索工作区文本',
      description:'Case-insensitive text search across workspace files (.git and node_modules are skipped). Supports a glob path filter and an optional regex mode.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false, required:['query'],
        properties:{
          query:{ type:'string', minLength:1, maxLength:limits.maxQueryChars, description:'Text or regular expression to search for.' },
          glob:{ type:'string', minLength:1, maxLength:limits.maxGlobChars, description:'Optional glob filter for relative paths, e.g. "src/**/*.ts".' },
          regex:{ type:'boolean', description:'Treat the query as a JavaScript-compatible regular expression.' },
          maxResults:{ type:'integer', minimum:1, maximum:limits.searchMaxResults, description:'Maximum number of matches.' }
        }
      }
    },
    {
      name:'ws_write_file',
      label:'写入工作区文件',
      description:'Create or fully overwrite one text file inside the workspace (parent folders are created automatically). Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['path', 'content'],
        properties:{
          path:pathRule,
          content:{ type:'string', minLength:0, maxLength:limits.maxWriteChars, description:'Full UTF-8 text content to write.' }
        }
      }
    },
    {
      name:'ws_edit_file',
      label:'编辑工作区文件',
      description:'Replace an exact unique string in a previously read workspace file. Fails when the text is not found or matches several times unless replace_all is set. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['path', 'old_string', 'new_string'],
        properties:{
          path:pathRule,
          old_string:{ type:'string', minLength:1, maxLength:limits.maxEditOldChars, description:'Exact literal text to replace.' },
          new_string:{ type:'string', minLength:0, maxLength:limits.maxEditNewChars, description:'Replacement text (empty deletes).' },
          replace_all:{ type:'boolean', description:'Replace every occurrence instead of requiring a unique match.' }
        }
      }
    },
    {
      name:'ws_run_command',
      label:'运行工作区命令',
      description:'Execute one program (single command, no shell chaining) with its arguments inside the workspace directory and capture stdout/stderr/exit code. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['command'],
        properties:{ command:{ type:'string', minLength:1, maxLength:limits.maxCommandChars, description:'Command line to execute, e.g. "npm test" or "node build.js".' } }
      }
    }
  ];
}

class CockpitWorkspaceToolsRegistry {
  constructor(plugin, dependencies = {}) {
    this.plugin = plugin;
    this._dependencyOverrides = dependencies;
    this._deps = null;
    this._rawRoot = '';
    this._root = '';
    this._tools = workspaceToolDefinitions();
    this.byName = new Map(this._tools.map((tool) => [tool.name, tool]));
    this._readSnapshots = new Map(); // absPath -> { mtimeMs, size }，编辑前检测外部修改
  }

  // 配置同步：由框架在启动与 AI 配置变更时调用（workspaceRoot 完全归用户所有）。
  sync(config) {
    this._rawRoot = sanitizeWorkspaceRoot(config?.workspaceRoot);
    this._root = '';
    this._readSnapshots.clear();
  }

  _resolveDeps() {
    if (this._deps) return this._deps;
    const safeRequire = (...names) => {
      for (const moduleName of names) {
        try { if (typeof require === 'function') { const loaded = require(moduleName); if (loaded) return loaded; } }
        catch (error) { /* 非桌面环境继续尝试下一个名称 */ }
      }
      return null;
    };
    const fsModule = safeRequire('node:fs', 'fs');
    const pathModule = safeRequire('node:path', 'path');
    const osModule = safeRequire('node:os', 'os');
    const childProcess = safeRequire('node:child_process', 'child_process');
    const defaults = {
      fsp:fsModule?.promises || null,
      path:pathModule || null,
      homedir:typeof osModule?.homedir === 'function' ? (() => { try { return osModule.homedir(); } catch (error) { return ''; } })() : '',
      execFile:childProcess?.execFile || null,
      env:() => {
        try { return { ...(typeof process !== 'undefined' ? process.env : {}) }; }
        catch (error) { return undefined; }
      },
      cwd:() => this.root
    };
    this._deps = { ...defaults, ...(this._dependencyOverrides || {}) };
    return this._deps;
  }

  get root() {
    if (this._root) return this._root;
    const deps = this._resolveDeps();
    if (!deps.path || !deps.fsp) return '';
    const expanded = expandWorkspaceRoot(this._rawRoot, deps.homedir);
    if (!expanded || !deps.path.isAbsolute(expanded)) return '';
    this._root = deps.path.resolve(expanded);
    return this._root;
  }

  configured() { return Boolean(this.root); }

  describeWorkspace() {
    return { root:this.root, available:this.available() };
  }

  available() {
    const deps = this._resolveDeps();
    return Boolean(deps.path && deps.fsp && this.root);
  }

  // 供聊天侧栏在应用前即时校验用户输入的工作区路径；不抛错，返回结构化结果。
  async checkPath(value) {
    const deps = this._resolveDeps();
    if (!deps.path || !deps.fsp) return { ok:false, reason:'desktop-only' };
    const expanded = expandWorkspaceRoot(value, deps.homedir);
    if (!expanded) return { ok:false, reason:'empty' };
    if (!deps.path.isAbsolute(expanded)) return { ok:false, reason:'relative' };
    const resolved = deps.path.resolve(expanded);
    let stat = null;
    try { stat = await deps.fsp.stat(resolved); }
    catch (error) { return { ok:false, reason:'missing', root:resolved }; }
    if (!stat.isDirectory()) return { ok:false, reason:'not-directory', root:resolved };
    return { ok:true, root:resolved };
  }

  _safeElectron() {
    try { return typeof require === 'function' ? require('electron') : null; }
    catch (error) { return null; }
  }

  // 弹出系统文件夹选择器：优先 Electron 原生对话框（remote 可用时），
  // 回退到 webkitdirectory 隐藏 input + webUtils；都不可用则返回 unsupported，
  // 由界面提示用户手动粘贴绝对路径。
  async pickFolder() {
    const electron = this._safeElectron();
    const dialog = electron?.remote?.dialog;
    if (dialog && typeof dialog.showOpenDialog === 'function') {
      try {
        const result = await dialog.showOpenDialog({
          title:'选择编码工作区 / Choose coding workspace',
          defaultPath:this.root || undefined,
          properties:['openDirectory', 'createDirectory']
        });
        const picked = Array.isArray(result?.filePaths) ? result.filePaths[0] : '';
        if (picked) return { ok:true, root:picked };
        return { ok:false, reason:'canceled' };
      } catch (error) { /* remote 不可用或失败，尝试回退方案 */ }
    }
    try {
      const root = await pickWorkspaceFolderViaInput(electron?.webUtils || null);
      return root ? { ok:true, root } : { ok:false, reason:'canceled' };
    } catch (error) {
      return { ok:false, reason:'unsupported' };
    }
  }

  definitions(mode) {
    if (!this.available()) return [];
    const allowMutating = mode !== 'readonly';
    return this._tools
      .filter((tool) => allowMutating || !tool.mutates)
      .map((tool) => ({ type:'function', function:{ name:tool.name, description:tool.description, parameters:tool.parameters } }));
  }

  describe(name) {
    const tool = this.byName.get(String(name || ''));
    return tool ? { name:tool.name, label:tool.label, description:tool.description, mutates:tool.mutates } : null;
  }

  // 系统提示补充：让模型知道当前沙箱边界与工具约定（未配置工作区时为空）。
  environment() {
    if (!this.available()) return '';
    const root = this.root;
    return [
      'Coding workspace active (sandbox root): ' + root,
      'ws_* file tools only operate inside this directory; paths are relative to it and can never escape it.',
      'Always call ws_read_file before ws_edit_file on the same file; edits use exact literal old_string matches.',
      'Use ws_list_dir / ws_search_text to explore before changing code, and verify changes with ws_run_command when the project provides checks.',
      'ws_run_command runs a single program without shell chaining; it cannot elevate privileges.'
    ].join('\n').slice(0, 1200);
  }

  // 提权类命令在任何交互之前直接拒绝：不弹确认框、不给执行机会。
  _assertAllowedProgram(rawCommand) {
    const tokens = splitWorkspaceCommand(String(rawCommand ?? '').replace(/[\r\n\0]+/g, ' ').trim());
    const program = tokens[0] || '';
    const base = program.replace(/\.exe$/i, '').split(/[\\/]/).pop()?.toLowerCase() || program.toLowerCase();
    if (AI_WORKSPACE_DENIED_PROGRAMS.includes(base)) {
      throw new Error('Privilege elevation commands are never allowed for the Agent.');
    }
    return tokens;
  }

  async execute(name, rawArguments, options = {}) {
    const tool = this.byName.get(String(name || ''));
    if (!tool) return null; // 让上层 hub 继续查找其他注册表
    if (!this.available()) throw new Error('No coding workspace is configured. Set one in the Cockpit AI settings first.');
    const args = validateWorkspaceToolInput(tool, rawArguments == null ? {} : rawArguments);
    if (tool.name === 'ws_run_command') this._assertAllowedProgram(args.command);
    if (tool.mutates && options.autoApprove !== true) {
      const confirmed = typeof options.confirm === 'function' && await options.confirm({
        name:tool.name, label:tool.label, description:tool.description, args, mutates:true
      });
      if (!confirmed) return { ok:false, denied:true, error:'User confirmation was not granted.' };
    }
    if (tool.name === 'ws_list_dir') return this._listDir(args);
    if (tool.name === 'ws_read_file') return this._readFile(args);
    if (tool.name === 'ws_search_text') return this._searchText(args);
    if (tool.name === 'ws_write_file') return this._writeFile(args);
    if (tool.name === 'ws_edit_file') return this._editFile(args);
    if (tool.name === 'ws_run_command') return this._runCommand(args);
    return null;
  }

  async _rootReal() {
    const deps = this._resolveDeps();
    try { return await deps.fsp.realpath(this.root); }
    catch (error) {
      if (error?.code === 'ENOENT') throw new Error('The workspace folder does not exist. Create it or fix the path in settings.');
      throw error;
    }
  }

  async _realOfExistingAncestor(candidate) {
    const deps = this._resolveDeps();
    const suffixes = [];
    let current = candidate;
    for (;;) {
      try {
        const base = await deps.fsp.realpath(current);
        const joined = suffixes.length ? base + '/' + suffixes.reverse().join('/') : base;
        return deps.path.normalize(joined);
      } catch (error) {
        const parent = deps.path.dirname(current);
        if (parent === current) throw error;
        suffixes.push(deps.path.basename(current));
        current = parent;
      }
    }
  }

  // 沙箱核心：词法包含检查 + realpath 包含检查；写入路径额外拒绝符号链接本体。
  async _resolveSafe(rawPath, options = {}) {
    const deps = this._resolveDeps();
    const root = this.root;
    if (!root) throw new Error('No coding workspace is configured.');
    const clean = String(rawPath ?? '').replace(/\0+/g, '').trim();
    if (!clean) {
      if (options.allowEmpty) return { abs:root, rel:'' };
      throw new Error('A file path relative to the workspace is required.');
    }
    if (clean.length > AI_WORKSPACE_LIMITS.maxPathChars) throw new Error('The path is too long.');
    const candidate = deps.path.isAbsolute(clean) ? deps.path.resolve(clean) : deps.path.resolve(root, clean);
    const insideLexical = candidate === root || candidate.startsWith(root + deps.path.sep);
    if (!insideLexical) throw new Error('The path points outside the workspace sandbox.');
    if (options.forWrite) {
      let linkStat = null;
      try { linkStat = await deps.fsp.lstat(candidate); }
      catch (error) { if (error?.code !== 'ENOENT') throw error; }
      if (linkStat?.isSymbolicLink?.()) throw new Error('Refusing to write through a symbolic link.');
    }
    const rootReal = await this._rootReal();
    let real;
    try { real = await deps.fsp.realpath(candidate); }
    catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      real = await this._realOfExistingAncestor(candidate);
    }
    const insideReal = real === rootReal || real.startsWith(rootReal + deps.path.sep);
    if (!insideReal) throw new Error('The path escapes the workspace through a symbolic link.');
    const rel = deps.path.relative(root, candidate).split(deps.path.sep).join('/');
    if (options.forWrite && isProtectedWorkspaceRelPath(rel)) throw new Error('The .git directory is protected and cannot be modified by the Agent.');
    return { abs:candidate, rel };
  }

  async _listDir(args) {
    const deps = this._resolveDeps();
    const target = await this._resolveSafe(args.path, { allowEmpty:true });
    const stat = await deps.fsp.stat(target.abs).catch(() => null);
    if (!stat) throw new Error('The directory does not exist: ' + (target.rel || '.'));
    if (!stat.isDirectory()) throw new Error('Not a directory: ' + (target.rel || '.'));
    const dirents = await deps.fsp.readdir(target.abs, { withFileTypes:true });
    dirents.sort((a, b) => (Number(b.isDirectory()) - Number(a.isDirectory())) || a.name.localeCompare(b.name));
    const limit = clampWorkspaceInteger(args.limit, AI_WORKSPACE_LIMITS.listDefaultLimit, 1, AI_WORKSPACE_LIMITS.listMaxLimit);
    const visible = dirents.filter((entry) => !entry.name.startsWith('.DS_Store'));
    const items = [];
    for (const entry of visible.slice(0, limit)) {
      const entryAbs = deps.path.join(target.abs, entry.name);
      const entryStat = await deps.fsp.lstat(entryAbs).catch(() => null);
      items.push({
        name:entry.name,
        type:entry.isDirectory() ? 'dir' : entry.isSymbolicLink() ? 'link' : 'file',
        bytes:Number.isFinite(entryStat?.size) ? entryStat.size : undefined,
        modified:Number.isFinite(entryStat?.mtimeMs) ? Math.round(entryStat.mtimeMs) : undefined
      });
    }
    return { ok:true, data:{ path:target.rel, items, total:dirents.length, truncated:dirents.length > limit } };
  }

  async _readFile(args) {
    const deps = this._resolveDeps();
    const target = await this._resolveSafe(args.path);
    const stat = await deps.fsp.stat(target.abs).catch(() => null);
    if (!stat) throw new Error('The file does not exist: ' + target.rel);
    if (!stat.isFile()) throw new Error('Not a regular file: ' + target.rel);
    if (stat.size > AI_WORKSPACE_LIMITS.maxReadSourceBytes) throw new Error('The file is larger than 1 MB; read it in smaller pieces or with a project tool.');
    const buffer = await deps.fsp.readFile(target.abs);
    if (looksLikeWorkspaceBinary(buffer)) throw new Error('The file looks binary and is not readable as text: ' + target.rel);
    const allLines = buffer.toString('utf8').split('\n');
    if (allLines.length > 1 && allLines[allLines.length - 1] === '') allLines.pop();
    const totalLines = allLines.length;
    const offset = clampWorkspaceInteger(args.offset, 1, 1, Math.max(totalLines, 1));
    const limit = clampWorkspaceInteger(args.limit, AI_WORKSPACE_LIMITS.readDefaultLines, 1, AI_WORKSPACE_LIMITS.readMaxLines);
    const lines = [];
    let charsUsed = 0;
    let charTruncated = false;
    for (let index = offset - 1; index < totalLines && lines.length < limit; index++) {
      const clipped = clipWorkspaceLine(allLines[index], AI_WORKSPACE_LIMITS.maxLineChars);
      if (charsUsed + clipped.length + 1 > AI_WORKSPACE_LIMITS.maxReadOutputChars) { charTruncated = true; break; }
      lines.push(clipped);
      charsUsed += clipped.length + 1;
    }
    this._readSnapshots.set(target.abs, { mtimeMs:stat.mtimeMs, size:stat.size });
    return {
      ok:true,
      data:{
        path:target.rel, totalLines, offset, lines,
        truncated:charTruncated || offset - 1 + lines.length < totalLines,
        bytes:stat.size
      }
    };
  }

  async _searchText(args) {
    const deps = this._resolveDeps();
    const query = String(args.query ?? '');
    let matcher;
    if (args.regex === true) {
      if (query.length > AI_WORKSPACE_LIMITS.maxQueryChars) throw new Error('The query is too long.');
      try { matcher = new RegExp(query, 'i'); }
      catch (error) { throw new Error('Invalid regular expression: ' + (error?.message || 'unknown')); }
    } else {
      const needle = query.toLowerCase();
      matcher = { test:(text) => text.toLowerCase().includes(needle) };
    }
    let globFilter = null;
    if (args.glob != null && String(args.glob).trim()) {
      globFilter = workspaceGlobToRegExp(args.glob);
      if (!globFilter) throw new Error('Invalid glob filter.');
    }
    const maxResults = clampWorkspaceInteger(args.maxResults, AI_WORKSPACE_LIMITS.searchDefaultResults, 1, AI_WORKSPACE_LIMITS.searchMaxResults);
    const rootReal = await this._rootReal();
    const skipNames = new Set(['.git', 'node_modules']);
    const matches = [];
    let scannedFiles = 0;
    const queue = [{ abs:this.root, rel:'' }];
    while (queue.length && scannedFiles < AI_WORKSPACE_LIMITS.searchMaxFiles && matches.length < maxResults) {
      const current = queue.shift();
      let dirents = [];
      try { dirents = await deps.fsp.readdir(current.abs, { withFileTypes:true }); }
      catch (error) { continue; }
      for (const entry of dirents) {
        if (skipNames.has(entry.name)) continue;
        const entryRel = current.rel ? current.rel + '/' + entry.name : entry.name;
        const entryAbs = deps.path.join(current.abs, entry.name);
        if (entry.isDirectory()) { queue.push({ abs:entryAbs, rel:entryRel }); continue; }
        if (!entry.isFile() || matches.length >= maxResults) continue;
        if (globFilter && !globFilter.test(entryRel)) continue;
        scannedFiles += 1;
        if (scannedFiles > AI_WORKSPACE_LIMITS.searchMaxFiles) break;
        const stat = await deps.fsp.stat(entryAbs).catch(() => null);
        if (!stat || stat.size > AI_WORKSPACE_LIMITS.searchMaxFileBytes) continue;
        const buffer = await deps.fsp.readFile(entryAbs).catch(() => null);
        if (!buffer || looksLikeWorkspaceBinary(buffer)) continue;
        let hitsInFile = 0;
        const lines = buffer.toString('utf8').split('\n');
        for (let index = 0; index < lines.length && hitsInFile < AI_WORKSPACE_LIMITS.searchPerFileHits; index++) {
          if (!matcher.test(lines[index])) continue;
          matches.push({ path:entryRel, line:index + 1, text:clipWorkspaceLine(lines[index].trim(), 240) });
          hitsInFile += 1;
          if (matches.length >= maxResults) break;
        }
      }
    }
    void rootReal;
    return { ok:true, data:{ query, items:matches, total:matches.length, scannedFiles, truncated:matches.length >= maxResults } };
  }

  async _writeFile(args) {
    const deps = this._resolveDeps();
    const target = await this._resolveSafe(args.path, { forWrite:true });
    if (!target.rel) throw new Error('Refusing to overwrite the workspace root itself.');
    const content = String(args.content ?? '');
    const bytes = workspaceByteLength(content);
    if (bytes > AI_WORKSPACE_LIMITS.maxWriteBytes) throw new Error('The content exceeds the 1 MB write limit.');
    await deps.fsp.mkdir(deps.path.dirname(target.abs), { recursive:true });
    let created = true;
    try { const existing = await deps.fsp.lstat(target.abs); created = false; void existing; } catch (error) { /* 不存在即创建 */ }
    await deps.fsp.writeFile(target.abs, content, 'utf8');
    const stat = await deps.fsp.stat(target.abs);
    this._readSnapshots.set(target.abs, { mtimeMs:stat.mtimeMs, size:stat.size });
    return { ok:true, data:{ path:target.rel, created, bytes } };
  }

  async _editFile(args) {
    const deps = this._resolveDeps();
    const target = await this._resolveSafe(args.path, { forWrite:true });
    if (!target.rel) throw new Error('Refusing to edit the workspace root itself.');
    const snapshot = this._readSnapshots.get(target.abs);
    if (!snapshot) throw new Error('Call ws_read_file on this file before editing it.');
    const oldString = String(args.old_string ?? '');
    const newString = String(args.new_string ?? '');
    if (!oldString) throw new Error('old_string must not be empty.');
    if (oldString === newString) throw new Error('old_string and new_string are identical; nothing would change.');
    const stat = await deps.fsp.stat(target.abs).catch(() => null);
    if (!stat) throw new Error('The file disappeared before it could be edited: ' + target.rel);
    if (stat.mtimeMs !== snapshot.mtimeMs || stat.size !== snapshot.size) {
      throw new Error('The file changed since it was last read; read it again before editing.');
    }
    if (stat.size > AI_WORKSPACE_LIMITS.maxEditTargetBytes) throw new Error('The file is too large to edit with exact-match replacement.');
    const content = (await deps.fsp.readFile(target.abs, 'utf8')).toString();
    const parts = content.split(oldString);
    const occurrences = parts.length - 1;
    if (!occurrences) throw new Error('old_string was not found in ' + target.rel + '; read the file again and copy the text exactly.');
    if (occurrences > 1 && args.replace_all !== true) {
      throw new Error('old_string matches ' + occurrences + ' locations; extend it to be unique or set replace_all=true.');
    }
    const next = args.replace_all === true ? parts.join(newString) : parts[0] + newString + parts.slice(1).join(oldString);
    const bytes = workspaceByteLength(next);
    if (bytes > AI_WORKSPACE_LIMITS.maxWriteBytes) throw new Error('The edited file would exceed the 1 MB write limit.');
    await deps.fsp.writeFile(target.abs, next, 'utf8');
    const updatedStat = await deps.fsp.stat(target.abs);
    this._readSnapshots.set(target.abs, { mtimeMs:updatedStat.mtimeMs, size:updatedStat.size });
    const previewAt = Math.max(0, next.indexOf(newString));
    const previewStart = Math.max(0, previewAt - 80);
    return {
      ok:true,
      data:{
        path:target.rel,
        replacements:args.replace_all === true ? occurrences : 1,
        bytes,
        preview:clipWorkspaceLine(next.slice(previewStart, previewAt + newString.length + 80).replace(/\s+/g, ' ').trim(), 240)
      }
    };
  }

  _runCommand(args) {
    const deps = this._resolveDeps();
    if (!deps.execFile) throw new Error('Running commands requires the desktop app.');
    const rawCommand = String(args.command ?? '').replace(/[\r\n\0]+/g, ' ').trim();
    if (!rawCommand) throw new Error('A command is required.');
    if (rawCommand.length > AI_WORKSPACE_LIMITS.maxCommandChars) throw new Error('The command is too long.');
    const tokens = splitWorkspaceCommand(rawCommand);
    if (!tokens.length) throw new Error('A command is required.');
    const program = tokens[0];
    const base = program.replace(/\.exe$/i, '').split(/[\\/]/).pop()?.toLowerCase() || program.toLowerCase();
    if (AI_WORKSPACE_DENIED_PROGRAMS.includes(base)) throw new Error('Privilege elevation commands are never allowed for the Agent.');
    const finalArgs = tokens.slice(1);
    const cwd = deps.cwd();
    if (!cwd) throw new Error('No coding workspace is configured.');
    return new Promise((resolve) => {
      deps.execFile(program, finalArgs, {
        timeout:AI_WORKSPACE_LIMITS.commandTimeoutMs,
        killSignal:'SIGKILL',
        windowsHide:true,
        maxBuffer:2 * 1024 * 1024,
        cwd,
        env:deps.env()
      }, (error, stdout, stderr) => {
        const timedOut = Boolean(error && error.killed);
        const exitCode = Number.isFinite(error?.code) ? error.code : error ? -1 : 0;
        resolve({
          ok:!error && exitCode === 0,
          data:{
            command:program,
            args:finalArgs.map((item) => item.slice(0, 120)),
            exitCode:timedOut ? null : exitCode,
            timedOut,
            signal:error?.signal || undefined,
            stdout:String(stdout || '').slice(0, AI_WORKSPACE_LIMITS.maxStdoutChars),
            stderr:String(stderr || '').slice(0, AI_WORKSPACE_LIMITS.maxStderrChars)
          }
        });
      });
    });
  }
}

function createCockpitWorkspaceToolsRegistry(plugin, dependencies) {
  return new CockpitWorkspaceToolsRegistry(plugin, dependencies);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    AI_WORKSPACE_LIMITS, AI_WORKSPACE_DENIED_PROGRAMS,
    sanitizeWorkspaceRoot, expandWorkspaceRoot, isProtectedWorkspaceRelPath,
    workspaceGlobToRegExp, splitWorkspaceCommand, workspaceToolDefinitions,
    looksLikeWorkspaceBinary, workspaceByteLength,
    workspaceCommonDirPrefix, pickWorkspaceFolderViaInput,
    CockpitWorkspaceToolsRegistry, createCockpitWorkspaceToolsRegistry
  };
}
