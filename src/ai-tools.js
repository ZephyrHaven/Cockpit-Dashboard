// ai-tools.js — 内置 Agent 的受控能力层；只暴露白名单工具，绝不提供任意文件或代码执行。

// 编码类任务（读文件→改代码→跑验证）单轮需要的工具调用远多于待办操作，
// 上限从 6 提升到 24，配合工作区工具的粒度仍然可控。
const COCKPIT_AGENT_MAX_TOOL_CALLS = 24;

function isProtectedAgentPath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return path === '.obsidian' || path.startsWith('.obsidian/') || path === '.trash' || path.startsWith('.trash/');
}

function agentBoundedInteger(value, fallback, min, max) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function agentSafeText(value, maxLength) {
  return String(value || '').replace(/[\r\n\0]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function agentToolArguments(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Tool arguments must be an object.');
  if (Object.keys(value).some((key) => ['__proto__','prototype','constructor'].includes(key))) throw new Error('Tool arguments contain a forbidden field.');
  return value;
}

function validateAgentToolInput(tool, args) {
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
      if (Array.isArray(rule.enum) && !rule.enum.includes(value)) throw new Error('Tool argument ' + name + ' is not an allowed value.');
      if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) throw new Error('Tool argument ' + name + ' has an invalid format.');
    } else if (rule.type === 'integer') {
      if (!Number.isInteger(value)) throw new Error('Tool argument ' + name + ' must be an integer.');
      if (Number.isFinite(rule.minimum) && value < rule.minimum) throw new Error('Tool argument ' + name + ' is below the minimum.');
      if (Number.isFinite(rule.maximum) && value > rule.maximum) throw new Error('Tool argument ' + name + ' exceeds the maximum.');
    } else if (rule.type === 'array') {
      if (!Array.isArray(value)) throw new Error('Tool argument ' + name + ' must be an array.');
      if (Number.isFinite(rule.maxItems) && value.length > rule.maxItems) throw new Error('Tool argument ' + name + ' contains too many items.');
      if (rule.items?.type === 'string' && value.some((item) => typeof item !== 'string')) throw new Error('Tool argument ' + name + ' must contain strings.');
      if (rule.items?.minLength && value.some((item) => item.length < rule.items.minLength)) throw new Error('Tool argument ' + name + ' contains an empty item.');
      if (rule.items?.maxLength && value.some((item) => item.length > rule.items.maxLength)) throw new Error('Tool argument ' + name + ' contains an item that is too long.');
    }
  });
  return args;
}

function agentTodoDate(value) {
  if (!value) return '';
  if (typeof value.format === 'function') return String(value.format('YYYY-MM-DD') || '');
  return String(value).slice(0, 10);
}

function toAgentTodo(todo) {
  return {
    id:agentSafeText(todo?.id, 72),
    text:agentSafeText(todo?.text, 180),
    tags:(Array.isArray(todo?.tags) ? todo.tags : []).map((tag) => agentSafeText(tag, 40)).filter(Boolean).slice(0, 8),
    priority:['high','mid','low'].includes(todo?.priority) ? todo.priority : 'mid',
    dueDate:agentTodoDate(todo?.dueDate),
    done:todo?.done === true
  };
}

function agentToolDefinitions() {
  return [
    {
      name:'cockpit_list_todos',
      label:'读取 Cockpit 待办',
      description:'List Cockpit tasks with optional status filtering. This is read-only.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false,
        properties:{
          status:{ type:'string', enum:['open','done','all'], description:'Task status filter.' },
          limit:{ type:'integer', minimum:1, maximum:100, description:'Maximum number of tasks.' }
        }
      }
    },
    {
      name:'cockpit_search_notes',
      label:'搜索 Vault 笔记',
      description:'Search Markdown note names and content excerpts. App configuration and plugin files are always excluded.',
      mutates:false,
      parameters:{
        type:'object', additionalProperties:false, required:['query'],
        properties:{
          query:{ type:'string', minLength:1, maxLength:120, description:'Text to search for.' },
          limit:{ type:'integer', minimum:1, maximum:20, description:'Maximum number of note matches.' }
        }
      }
    },
    {
      name:'cockpit_create_todo',
      label:'创建 Cockpit 待办',
      description:'Create one task in the fixed Cockpit todo store. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['text'],
        properties:{
          text:{ type:'string', minLength:1, maxLength:180, description:'Task title.' },
          priority:{ type:'string', enum:['high','mid','low'], description:'Task priority.' },
          dueDate:{ type:'string', pattern:'^\\d{4}-\\d{2}-\\d{2}$', description:'Optional due date in YYYY-MM-DD format.' },
          tags:{ type:'array', maxItems:8, items:{ type:'string', minLength:1, maxLength:40 }, description:'Optional task tags.' }
        }
      }
    },
    {
      name:'cockpit_complete_todo',
      label:'完成 Cockpit 待办',
      description:'Mark one Cockpit task complete by its stable ID. Requires user confirmation.',
      mutates:true,
      parameters:{
        type:'object', additionalProperties:false, required:['id'],
        properties:{ id:{ type:'string', pattern:'^[a-zA-Z0-9_-]{1,72}$', description:'Stable task ID returned by cockpit_list_todos.' } }
      }
    }
  ];
}

function resolveAgentToolDependencies(overrides = {}) {
  return {
    parseTodosContent:overrides.parseTodosContent || (typeof parseTodosContent === 'function' ? parseTodosContent : null),
    mutateTodos:overrides.mutateTodos || (typeof mutateTodos === 'function' ? mutateTodos : null),
    createTodoId:overrides.createTodoId || (typeof createTodoId === 'function' ? createTodoId : null),
    moment:overrides.moment || ((...args) => window.moment(...args))
  };
}

async function refreshCockpitAfterAgentMutation(plugin, todos) {
  await plugin.alarms?.syncTodos?.(todos).catch((error) => console.warn('Cockpit Agent alarm sync failed', error));
  const leaves = plugin.app.workspace.getLeavesOfType?.(typeof VIEW_TYPE === 'undefined' ? 'cockpit-dashboard-view' : VIEW_TYPE) || [];
  await Promise.all(leaves.map(async (leaf) => {
    const view = leaf?.view;
    if (typeof view?._renderDashboard === 'function') await view._renderDashboard(true);
  })).catch((error) => console.warn('Cockpit Agent dashboard refresh failed', error));
}

class CockpitAgentToolRegistry {
  constructor(plugin, dependencies = {}) {
    this.plugin = plugin;
    this.dependencies = resolveAgentToolDependencies(dependencies);
    this.tools = agentToolDefinitions();
    this.byName = new Map(this.tools.map((tool) => [tool.name, tool]));
  }
  definitions(mode) {
    // 三层权限：'readonly' 只暴露只读工具；其余模式提供全部工具。
    const allowMutating = mode !== 'readonly';
    return this.tools
      .filter((tool) => allowMutating || !tool.mutates)
      .map((tool) => ({
        type:'function',
        function:{ name:tool.name, description:tool.description, parameters:tool.parameters }
      }));
  }
  describe(name) {
    const tool = this.byName.get(String(name || ''));
    return tool ? { name:tool.name, label:tool.label, description:tool.description, mutates:tool.mutates } : null;
  }
  async execute(name, rawArguments, options = {}) {
    const tool = this.byName.get(String(name || ''));
    if (!tool) throw new Error('This Agent tool is not available.');
    const args = validateAgentToolInput(tool, agentToolArguments(rawArguments));
    // 'full' 权限模式经 autoApprove 显式跳过交互确认；其余模式写操作仍需用户批准。
    if (tool.mutates && options.autoApprove !== true) {
      const confirmed = typeof options.confirm === 'function' && await options.confirm({
        name:tool.name, label:tool.label, description:tool.description, args, mutates:true
      });
      if (!confirmed) return { ok:false, denied:true, error:'User confirmation was not granted.' };
    }
    if (tool.name === 'cockpit_list_todos') return this._listTodos(args);
    if (tool.name === 'cockpit_search_notes') return this._searchNotes(args);
    if (tool.name === 'cockpit_create_todo') return this._createTodo(args);
    if (tool.name === 'cockpit_complete_todo') return this._completeTodo(args);
    throw new Error('This Agent tool is not available.');
  }
  async _readTodos() {
    const parser = this.dependencies.parseTodosContent;
    if (typeof parser !== 'function') throw new Error('Cockpit todo parser is unavailable.');
    const vault = this.plugin.app.vault;
    const file = vault.getAbstractFileByPath(typeof TODO_FILE === 'undefined' ? '_data/todos.md' : TODO_FILE);
    if (!file) return [];
    const content = typeof vault.cachedRead === 'function' ? await vault.cachedRead(file) : await vault.read(file);
    return parser(content) || [];
  }
  async _listTodos(args) {
    const status = ['open','done','all'].includes(args.status) ? args.status : 'open';
    const limit = agentBoundedInteger(args.limit, 50, 1, 100);
    const todos = (await this._readTodos()).filter((todo) => status === 'all' || (status === 'done' ? todo.done : !todo.done));
    return { ok:true, data:{ items:todos.slice(0, limit).map(toAgentTodo), total:todos.length, truncated:todos.length > limit } };
  }
  async _searchNotes(args) {
    const query = agentSafeText(args.query, 120);
    if (!query) throw new Error('A search query is required.');
    const limit = agentBoundedInteger(args.limit, 8, 1, 20);
    const needle = query.toLocaleLowerCase();
    const vault = this.plugin.app.vault;
    const files = (vault.getMarkdownFiles?.() || [])
      .filter((file) => file?.extension === 'md' && !isProtectedAgentPath(file.path))
      .sort((a, b) => Number(b?.stat?.mtime || 0) - Number(a?.stat?.mtime || 0))
      .slice(0, 300);
    const items = [];
    for (const file of files) {
      if (items.length >= limit) break;
      let content = '';
      try { content = await (typeof vault.cachedRead === 'function' ? vault.cachedRead(file) : vault.read(file)); }
      catch (error) { continue; }
      const pathIndex = String(file.path || '').toLocaleLowerCase().indexOf(needle);
      const contentIndex = String(content || '').toLocaleLowerCase().indexOf(needle);
      if (pathIndex < 0 && contentIndex < 0) continue;
      const excerptStart = contentIndex < 0 ? 0 : Math.max(0, contentIndex - 90);
      const excerpt = String(content || '').slice(excerptStart, excerptStart + 280).replace(/\s+/g, ' ').trim();
      const path = String(file.path || '');
      items.push({ path, title:path.split('/').pop()?.replace(/\.md$/i, '') || path, excerpt });
    }
    return { ok:true, data:{ items, total:items.length, truncated:items.length >= limit } };
  }
  _moment(value, pattern, strict) {
    const factory = this.dependencies.moment;
    const momentValue = factory(value, pattern, strict);
    if (!momentValue || (typeof momentValue.isValid === 'function' && !momentValue.isValid())) throw new Error('The supplied date is invalid.');
    return momentValue;
  }
  async _createTodo(args) {
    const text = agentSafeText(args.text, 180);
    if (!text) throw new Error('Task text is required.');
    const priority = ['high','mid','low'].includes(args.priority) ? args.priority : 'mid';
    const dueText = agentSafeText(args.dueDate, 10);
    if (dueText && !/^\d{4}-\d{2}-\d{2}$/.test(dueText)) throw new Error('Task due date must use YYYY-MM-DD.');
    const tags = (Array.isArray(args.tags) ? args.tags : []).map((tag) => agentSafeText(tag, 40).replace(/^#/, '')).filter(Boolean).slice(0, 8);
    const idFactory = this.dependencies.createTodoId;
    const mutate = this.dependencies.mutateTodos;
    if (typeof idFactory !== 'function' || typeof mutate !== 'function') throw new Error('Cockpit todo mutation is unavailable.');
    const todo = {
      id:idFactory(), text, tags, priority,
      dueDate:dueText ? this._moment(dueText, 'YYYY-MM-DD', true) : null,
      dueHasTime:false, done:false, created:this._moment(), doneDate:null
    };
    const outcome = await mutate(this.plugin.app.vault, (todos) => { todos.push(todo); return true; });
    if (!outcome?.saved || !outcome?.todos) throw new Error('The task could not be saved.');
    await refreshCockpitAfterAgentMutation(this.plugin, outcome.todos);
    return { ok:true, data:{ todo:toAgentTodo(todo) } };
  }
  async _completeTodo(args) {
    const id = agentSafeText(args.id, 72);
    if (!/^[a-zA-Z0-9_-]{1,72}$/.test(id)) throw new Error('A valid task ID is required.');
    const mutate = this.dependencies.mutateTodos;
    if (typeof mutate !== 'function') throw new Error('Cockpit todo mutation is unavailable.');
    let completed = null;
    const outcome = await mutate(this.plugin.app.vault, (todos) => {
      const todo = todos.find((item) => item?.id === id);
      if (!todo || todo.done) return false;
      todo.done = true;
      todo.doneDate = this._moment();
      completed = todo;
      return true;
    });
    if (!outcome?.saved || !completed) throw new Error('The requested open task was not found.');
    await refreshCockpitAfterAgentMutation(this.plugin, outcome.todos);
    return { ok:true, data:{ todo:toAgentTodo(completed) } };
  }
}

function createCockpitAgentToolRegistry(plugin, dependencies) {
  return new CockpitAgentToolRegistry(plugin, dependencies);
}

// 组合注册表：把多个工具注册表（核心 Cockpit 工具、本地工具适配层…）统一成一个接口，
// 对 Agent 请求侧透明；组合关系由调用方（框架/测试）显式给出。
class CockpitAgentToolHub {
  constructor(providers = []) {
    this.providers = (Array.isArray(providers) ? providers : []).filter(Boolean);
  }
  sync(config) { this.providers.forEach((provider) => { try { provider.sync?.(config); } catch (error) { console.warn('Cockpit Agent tool sync failed', error); } }); }
  definitions(mode) { return this.providers.flatMap((provider) => provider.definitions?.(mode) || []); }
  // 聚合各注册表的系统提示补充（如工作区沙箱说明），供 Agent 循环注入 system 消息。
  environment(mode) {
    return this.providers
      .map((provider) => String(provider.environment?.(mode) || '').trim())
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 2000);
  }
  // 工作区能力透传：侧栏只接触 Hub，校验/选择器必须在这里代理到内部注册表。
  // 能力缺失时返回结构化结果而不是 undefined，避免界面静默失败或误报“非桌面环境”。
  describeWorkspace() {
    for (const provider of this.providers) {
      if (typeof provider.describeWorkspace === 'function') return provider.describeWorkspace();
    }
    return null;
  }
  async checkPath(value) {
    for (const provider of this.providers) {
      if (typeof provider.checkPath === 'function') return provider.checkPath(value);
    }
    return { ok:false, reason:'unsupported' };
  }
  async pickFolder() {
    for (const provider of this.providers) {
      if (typeof provider.pickFolder === 'function') return provider.pickFolder();
    }
    return { ok:false, reason:'unsupported' };
  }
  describe(name) {
    for (const provider of this.providers) {
      const meta = provider.describe?.(name);
      if (meta) return meta;
    }
    return null;
  }
  async execute(name, args, options = {}) {
    for (const provider of this.providers) {
      if (!provider.describe?.(name)) continue;
      const result = await provider.execute(name, args, options);
      // 注册表返回 null 表示该名称不属于它，继续向后查找。
      if (result === null) continue;
      return result;
    }
    throw new Error('This Agent tool is not available.');
  }
}
function createCockpitAgentToolHub(plugin, extraRegistries = []) {
  const providers = [createCockpitAgentToolRegistry(plugin)];
  for (const registry of (Array.isArray(extraRegistries) ? extraRegistries : [])) {
    if (registry) providers.push(registry);
  }
  return new CockpitAgentToolHub(providers);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    COCKPIT_AGENT_MAX_TOOL_CALLS, isProtectedAgentPath, agentToolDefinitions,
    validateAgentToolInput, CockpitAgentToolRegistry, createCockpitAgentToolRegistry,
    CockpitAgentToolHub, createCockpitAgentToolHub
  };
}
