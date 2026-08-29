// ai-vault-tools.js — Agent 的库内笔记工具层（受控读写）。
// 安全模型：
// - 保护路径（.obsidian 配置目录、.trash、插件目录）一律拒绝，与核心工具同规则；
// - 只提供「移动」，绝不提供删除；移动要求源存在、目标不存在；
// - 变更类工具全部 mutates:true，走三档权限：readonly 不暴露、读写逐次确认、full 跳确认；
// - 路径与内容长度全部封顶；路径不允许 .. 越级与绝对路径；
// - 标签使用库内通用的行内 #标签 形式（与闪念/待办一致），不做 frontmatter 改写，避免破坏用户 YAML。

const AI_VAULT_TOOL_LIMITS = Object.freeze({
  pathChars:300,
  titleChars:120,
  readMaxChars:20000,
  createMaxChars:40000,
  appendMaxChars:8000,
  listLimit:50,
  listScanCap:300,
  tagsMax:12,
  tagChars:40,
  folderChars:200
});

function vaultToolLocalProtectedPath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return path === '.obsidian' || path.startsWith('.obsidian/') || path === '.trash' || path.startsWith('.trash/');
}

// 路径规范化：拒绝越级、绝对路径与控制字符；返回库内相对路径或抛错。
function vaultToolSafePath(value, { mustBeMarkdown = true } = {}) {
  const raw = String(value || '').replace(/\\/g, '/').trim();
  if (!raw) throw new Error('A note path is required.');
  if (raw.length > AI_VAULT_TOOL_LIMITS.pathChars) throw new Error('The note path is too long.');
  if (/[\u0000-\u001f\u007f]/.test(raw)) throw new Error('The note path contains forbidden characters.');
  const normalized = raw.replace(/^\.\/+/, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (!normalized) throw new Error('The note path is invalid.');
  normalized.split('/').forEach((segment) => {
    if (!segment || segment === '.' || segment === '..') throw new Error('The note path cannot traverse directories.');
  });
  if (mustBeMarkdown && !/\.md$/i.test(normalized)) throw new Error('Only Markdown notes (.md) are supported.');
  return normalized;
}

function vaultToolSafeFolder(value) {
  const raw = String(value || '').replace(/\\/g, '/').trim();
  if (!raw) return '';
  if (raw.length > AI_VAULT_TOOL_LIMITS.folderChars) throw new Error('The folder path is too long.');
  const normalized = raw.replace(/^\.\/+/, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (!normalized) return '';
  normalized.split('/').forEach((segment) => {
    if (!segment || segment === '.' || segment === '..') throw new Error('The folder path cannot traverse directories.');
  });
  return normalized;
}

function vaultToolSafeTag(value) {
  return String(value || '').replace(/^#/, '').replace(/[\u0000-\u001f\u007f/#\s]+/g, '').trim().slice(0, AI_VAULT_TOOL_LIMITS.tagChars);
}

function hasVaultToolTag(content, tag) {
  if (!tag) return false;
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 只做尾部边界：防止 #work 匹配到 #workspace；前置不限制（中文紧贴 # 也是合法标签）。
  return new RegExp('#' + escaped + '(?![\\w\\u4e00-\\u9fff])', 'i').test(String(content || ''));
}

function validateVaultToolInput(tool, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object.');
  if (Object.keys(args).some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('Tool arguments contain a forbidden field.');
  const properties = tool?.parameters?.properties || {};
  Object.keys(args).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(properties, key)) throw new Error('Tool argument is not allowed: ' + key);
  });
  (Array.isArray(tool?.parameters?.required) ? tool.parameters.required : []).forEach((name) => {
    if (!Object.prototype.hasOwnProperty.call(args, name)) throw new Error('Required tool argument is missing: ' + name);
  });
  Object.entries(args).forEach(([name, value]) => {
    const rule = properties[name];
    if (!rule) return;
    if (rule.type === 'string') {
      if (typeof value !== 'string') throw new Error('Tool argument ' + name + ' must be a string.');
      if (Number.isFinite(rule.maxLength) && value.length > rule.maxLength) throw new Error('Tool argument ' + name + ' is too long.');
      if (Number.isFinite(rule.minLength) && value.length < rule.minLength) throw new Error('Tool argument ' + name + ' is too short.');
    } else if (rule.type === 'integer') {
      if (!Number.isInteger(value)) throw new Error('Tool argument ' + name + ' must be an integer.');
      if (Number.isFinite(rule.minimum) && value < rule.minimum) throw new Error('Tool argument ' + name + ' is below the minimum.');
      if (Number.isFinite(rule.maximum) && value > rule.maximum) throw new Error('Tool argument ' + name + ' exceeds the maximum.');
    } else if (rule.type === 'array') {
      if (!Array.isArray(value)) throw new Error('Tool argument ' + name + ' must be an array.');
      if (Number.isFinite(rule.maxItems) && value.length > rule.maxItems) throw new Error('Tool argument ' + name + ' contains too many items.');
      if (rule.items?.type === 'string' && value.some((item) => typeof item !== 'string')) throw new Error('Tool argument ' + name + ' must contain strings.');
    }
  });
  return args;
}

function vaultToolDefinitions() {
  return [
    {
      name:'vault_list_notes',
      label:'列出库内笔记',
      description:'List Markdown notes, optionally filtered by folder prefix or an inline #tag. Read-only.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false,
        properties:{
          folder:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.folderChars, description:'Optional folder prefix, e.g. "Projects".' },
          tag:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.tagChars, description:'Optional inline #tag to require.' },
          limit:{ type:'integer', minimum:1, maximum:AI_VAULT_TOOL_LIMITS.listLimit, description:'Maximum number of notes (default 30).' }
        }
      }
    },
    {
      name:'vault_read_note',
      label:'读取库内笔记',
      description:'Read one Markdown note by its vault-relative path. Configuration and plugin files are always excluded.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false, required:['path'],
        properties:{
          path:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.pathChars, description:'Vault-relative note path, e.g. "Projects/Plan.md".' },
          maxChars:{ type:'integer', minimum:200, maximum:AI_VAULT_TOOL_LIMITS.readMaxChars, description:'Maximum characters returned (default 12000).' }
        }
      }
    },
    {
      name:'vault_create_note',
      label:'创建库内笔记',
      description:'Create a new Markdown note. Fails if the note already exists. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['title'],
        properties:{
          title:{ type:'string', minLength:1, maxLength:AI_VAULT_TOOL_LIMITS.titleChars, description:'Note title (file name without extension).' },
          folder:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.folderChars, description:'Target folder. Defaults to the daily-notes folder.' },
          content:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.createMaxChars, description:'Initial Markdown content.' }
        }
      }
    },
    {
      name:'vault_append_note',
      label:'追加笔记内容',
      description:'Append Markdown text to the end of an existing note. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['path', 'content'],
        properties:{
          path:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.pathChars, description:'Vault-relative note path.' },
          content:{ type:'string', minLength:1, maxLength:AI_VAULT_TOOL_LIMITS.appendMaxChars, description:'Text to append.' }
        }
      }
    },
    {
      name:'vault_move_note',
      label:'移动或重命名笔记',
      description:'Move or rename a note. Deletion is not supported. Target must not exist. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['path', 'newPath'],
        properties:{
          path:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.pathChars, description:'Current vault-relative note path.' },
          newPath:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.pathChars, description:'New vault-relative note path (must end with .md).' }
        }
      }
    },
    {
      name:'vault_add_tags',
      label:'为笔记添加标签',
      description:'Append inline #tags to a note, skipping tags it already has. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['path', 'tags'],
        properties:{
          path:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.pathChars, description:'Vault-relative note path.' },
          tags:{ type:'array', minItems:1, maxItems:AI_VAULT_TOOL_LIMITS.tagsMax, items:{ type:'string', maxLength:AI_VAULT_TOOL_LIMITS.tagChars }, description:'Tags to add (without #).' }
        }
      }
    }
  ];
}

function resolveVaultToolDependencies(overrides = {}) {
  return {
    moment:overrides.moment || ((...args) => window.moment(...args)),
    protectedPath:overrides.protectedPath
      || (typeof isProtectedAgentPath === 'function' ? isProtectedAgentPath : vaultToolLocalProtectedPath),
    dailyDir:overrides.dailyDir !== undefined ? overrides.dailyDir : (typeof DAILY_DIR === 'string' ? DAILY_DIR : '_daily')
  };
}

class CockpitVaultToolsRegistry {
  constructor(plugin, dependencies = {}) {
    this.plugin = plugin;
    this.dependencies = resolveVaultToolDependencies(dependencies);
    this.tools = vaultToolDefinitions();
    this.byName = new Map(this.tools.map((tool) => [tool.name, tool]));
  }
  definitions(mode) {
    const allowMutating = mode !== 'readonly';
    return this.tools
      .filter((tool) => allowMutating || !tool.mutates)
      .map((tool) => ({ type:'function', function:{ name:tool.name, description:tool.description, parameters:tool.parameters } }));
  }
  describe(name) {
    const tool = this.byName.get(String(name || ''));
    return tool ? { name:tool.name, label:tool.label, description:tool.description, mutates:tool.mutates } : null;
  }
  async execute(name, rawArguments, options = {}) {
    const tool = this.byName.get(String(name || ''));
    if (!tool) return null;
    const args = validateVaultToolInput(tool, rawArguments);
    if (tool.mutates && options.autoApprove !== true) {
      const confirmed = typeof options.confirm === 'function' && await options.confirm({
        name:tool.name, label:tool.label, description:tool.description, args, mutates:true
      });
      if (!confirmed) return { ok:false, denied:true, error:'User confirmation was not granted.' };
    }
    if (tool.name === 'vault_list_notes') return this._listNotes(args);
    if (tool.name === 'vault_read_note') return this._readNote(args);
    if (tool.name === 'vault_create_note') return this._createNote(args);
    if (tool.name === 'vault_append_note') return this._appendNote(args);
    if (tool.name === 'vault_move_note') return this._moveNote(args);
    if (tool.name === 'vault_add_tags') return this._addTags(args);
    return null;
  }
  _guard(path) {
    if (this.dependencies.protectedPath(path)) throw new Error('This path is protected and never accessible to the Agent.');
    return path;
  }
  _markdownFile(path) {
    const vault = this.plugin.app.vault;
    const file = vault.getAbstractFileByPath?.(path);
    if (!file || file.extension !== 'md') throw new Error('Note not found: ' + path);
    return file;
  }
  async _readContent(file) {
    const vault = this.plugin.app.vault;
    return typeof vault.cachedRead === 'function' ? vault.cachedRead(file) : vault.read(file);
  }
  async _ensureFolder(folder) {
    if (!folder) return;
    const vault = this.plugin.app.vault;
    let current = '';
    for (const segment of folder.split('/')) {
      current = current ? current + '/' + segment : segment;
      if (!vault.getAbstractFileByPath?.(current)) {
        try { await vault.createFolder(current); } catch (error) { if (!/exist/i.test(String(error?.message))) throw error; }
      }
    }
  }
  async _listNotes(args) {
    const folder = vaultToolSafeFolder(args.folder);
    const tag = vaultToolSafeTag(args.tag);
    const limit = Math.max(1, Math.min(AI_VAULT_TOOL_LIMITS.listLimit, Number(args.limit) || 30));
    const vault = this.plugin.app.vault;
    let files = (vault.getMarkdownFiles?.() || [])
      .filter((file) => file?.extension === 'md' && !this.dependencies.protectedPath(file.path))
      .sort((a, b) => Number(b?.stat?.mtime || 0) - Number(a?.stat?.mtime || 0));
    if (folder) files = files.filter((file) => String(file.path || '').startsWith(folder + '/'));
    const items = [];
    const withoutTag = !tag;
    for (const file of files) {
      if (items.length >= limit) break;
      let content = '';
      if (!withoutTag) {
        if (items.length + files.length > AI_VAULT_TOOL_LIMITS.listScanCap && files.indexOf(file) >= AI_VAULT_TOOL_LIMITS.listScanCap) break;
        try { content = await this._readContent(file); } catch (error) { continue; }
        if (!hasVaultToolTag(content, tag)) continue;
      }
      const path = String(file.path || '');
      items.push({ path, title:path.split('/').pop()?.replace(/\.md$/i, '') || path, mtime:new Date(Number(file?.stat?.mtime || 0)).toISOString(), size:Number(file?.stat?.size || 0) });
    }
    return { ok:true, data:{ items, total:items.length, truncated:withoutTag ? files.length > limit : false } };
  }
  async _readNote(args) {
    const path = this._guard(vaultToolSafePath(args.path));
    const maxChars = Math.max(200, Math.min(AI_VAULT_TOOL_LIMITS.readMaxChars, Number(args.maxChars) || 12000));
    const content = await this._readContent(this._markdownFile(path));
    const text = String(content || '');
    return { ok:true, data:{ path, content:text.slice(0, maxChars), totalChars:text.length, truncated:text.length > maxChars } };
  }
  async _createNote(args) {
    const title = String(args.title || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, AI_VAULT_TOOL_LIMITS.titleChars);
    if (!title) throw new Error('A valid note title is required.');
    const folder = args.folder === undefined ? this.dependencies.dailyDir : vaultToolSafeFolder(args.folder);
    const path = this._guard((folder ? folder + '/' : '') + title + '.md');
    const vault = this.plugin.app.vault;
    if (vault.getAbstractFileByPath?.(path)) throw new Error('A note already exists at ' + path + '. Choose another title or use append instead.');
    const content = String(args.content || '').slice(0, AI_VAULT_TOOL_LIMITS.createMaxChars);
    await this._ensureFolder(folder);
    await vault.create(path, content);
    return { ok:true, data:{ path, bytes:content.length } };
  }
  async _appendNote(args) {
    const path = this._guard(vaultToolSafePath(args.path));
    const vault = this.plugin.app.vault;
    const file = this._markdownFile(path);
    const existing = await this._readContent(file);
    const text = String(existing || '');
    const separator = !text ? '' : (text.endsWith('\n') ? '' : '\n\n');
    const addition = String(args.content || '');
    await vault.modify(file, text + separator + addition + '\n');
    return { ok:true, data:{ path, appendedChars:addition.length, totalChars:(text + separator + addition + '\n').length } };
  }
  async _moveNote(args) {
    const from = this._guard(vaultToolSafePath(args.path));
    const to = this._guard(vaultToolSafePath(args.newPath));
    if (from === to) throw new Error('The new path is identical to the current path.');
    const vault = this.plugin.app.vault;
    const file = this._markdownFile(from);
    if (vault.getAbstractFileByPath?.(to)) throw new Error('A note already exists at ' + to + '.');
    await this._ensureFolder(vaultToolSafeFolder(to.split('/').slice(0, -1).join('/')));
    await vault.rename(file, to);
    return { ok:true, data:{ from, to } };
  }
  async _addTags(args) {
    const path = this._guard(vaultToolSafePath(args.path));
    const tags = (Array.isArray(args.tags) ? args.tags : []).map(vaultToolSafeTag).filter(Boolean);
    if (!tags.length) throw new Error('At least one valid tag is required.');
    const vault = this.plugin.app.vault;
    const file = this._markdownFile(path);
    const content = String(await this._readContent(file) || '');
    const missing = tags.filter((tag) => !hasVaultToolTag(content, tag));
    if (!missing.length) return { ok:true, data:{ path, added:[], note:'All requested tags already exist.' } };
    const trimmed = content.replace(/\s+$/, '');
    const addition = (trimmed ? '\n\n' : '') + missing.map((tag) => '#' + tag).join(' ') + '\n';
    await vault.modify(file, trimmed + addition);
    return { ok:true, data:{ path, added:missing } };
  }
}

function createCockpitVaultToolsRegistry(plugin, dependencies) {
  return new CockpitVaultToolsRegistry(plugin, dependencies);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    AI_VAULT_TOOL_LIMITS, vaultToolDefinitions, vaultToolSafePath, vaultToolSafeFolder,
    vaultToolSafeTag, hasVaultToolTag, validateVaultToolInput,
    CockpitVaultToolsRegistry, createCockpitVaultToolsRegistry
  };
}
