// ai-plugin-tools.js — Agent 对驾驶舱领域数据的第一批只读能力。
// 写操作继续通过各领域服务的专用工具逐项开放，禁止直接暴露 data.json。

const AI_PLUGIN_TOOL_LIST_LIMIT = 50;

function pluginToolText(value, maxLength) {
  return String(value || '').replace(/[\r\n\0]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function pluginToolLimit(value) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(1, Math.min(AI_PLUGIN_TOOL_LIST_LIMIT, parsed)) : 20;
}

function pluginDataToolDefinitions() {
  const parameters = {
    type:'object', additionalProperties:false,
    properties:{ limit:{ type:'integer', minimum:1, maximum:AI_PLUGIN_TOOL_LIST_LIMIT, description:'Maximum number of items.' } }
  };
  return [
    { name:'cockpit_list_projects', label:'读取 Cockpit 项目', description:'List project progress derived from task tags. Read-only.', mutates:false, parameters },
    { name:'cockpit_list_habits', label:'读取 Cockpit 习惯', description:'List habits and bounded check-in summaries. Read-only.', mutates:false, parameters },
    { name:'cockpit_list_alarms', label:'读取 Cockpit 闹钟', description:'List configured alarms without private delivery data. Read-only.', mutates:false, parameters },
    { name:'cockpit_list_countdowns', label:'读取 Cockpit 倒计时', description:'List countdown status without notification-channel details. Read-only.', mutates:false, parameters }
  ];
}

function validatePluginDataToolInput(tool, raw) {
  const args = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (Object.keys(args).some((key) => key !== 'limit' || ['__proto__','prototype','constructor'].includes(key))) throw new Error('Tool argument is not allowed.');
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > AI_PLUGIN_TOOL_LIST_LIMIT)) throw new Error('Tool argument limit is invalid.');
  return args;
}

function resolvePluginDataToolDependencies(plugin, overrides = {}) {
  return {
    loadTodos:overrides.loadTodos || (async () => {
      if (typeof parseTodosContent !== 'function') throw new Error('Cockpit todo parser is unavailable.');
      const vault = plugin.app.vault;
      const file = vault.getAbstractFileByPath(typeof TODO_FILE === 'undefined' ? '_data/todos.md' : TODO_FILE);
      return file ? parseTodosContent(await vault.read(file)) : [];
    }),
    loadHabits:overrides.loadHabits || (async () => {
      if (typeof loadHabits !== 'function') throw new Error('Cockpit habit store is unavailable.');
      return loadHabits(plugin.app.vault);
    }),
    now:overrides.now || (() => Date.now()),
    today:overrides.today || (() => window.moment().format('YYYY-MM-DD'))
  };
}

class CockpitPluginDataToolsRegistry {
  constructor(plugin, dependencies = {}) {
    this.plugin = plugin;
    this.dependencies = resolvePluginDataToolDependencies(plugin, dependencies);
    this.tools = pluginDataToolDefinitions();
    this.byName = new Map(this.tools.map((tool) => [tool.name, tool]));
  }
  definitions() {
    return this.tools.map((tool) => ({ type:'function', function:{ name:tool.name, description:tool.description, parameters:tool.parameters } }));
  }
  describe(name) {
    const tool = this.byName.get(String(name || ''));
    return tool ? { name:tool.name, label:tool.label, description:tool.description, mutates:false } : null;
  }
  async execute(name, rawArguments) {
    const tool = this.byName.get(String(name || ''));
    if (!tool) return null;
    const args = validatePluginDataToolInput(tool, rawArguments);
    if (tool.name === 'cockpit_list_projects') return this._listProjects(args);
    if (tool.name === 'cockpit_list_habits') return this._listHabits(args);
    if (tool.name === 'cockpit_list_alarms') return this._listAlarms(args);
    if (tool.name === 'cockpit_list_countdowns') return this._listCountdowns(args);
    return null;
  }
  async _listProjects(args) {
    const projects = new Map();
    (await this.dependencies.loadTodos()).forEach((todo) => {
      (Array.isArray(todo?.tags) ? todo.tags : []).forEach((rawTag) => {
        const tag = pluginToolText(rawTag, 40).replace(/^#/, '');
        if (!tag || tag === '_archived') return;
        const entry = projects.get(tag) || { tag, total:0, done:0, open:0, progress:0 };
        entry.total += 1;
        if (todo?.done === true) entry.done += 1; else entry.open += 1;
        projects.set(tag, entry);
      });
    });
    const items = Array.from(projects.values()).map((item) => ({ ...item, progress:item.total ? Math.round(item.done / item.total * 100) : 0 }))
      .sort((a, b) => b.open - a.open || b.total - a.total || a.tag.localeCompare(b.tag))
      .slice(0, pluginToolLimit(args.limit));
    return { ok:true, data:{ items, total:projects.size, truncated:projects.size > items.length } };
  }
  async _listHabits(args) {
    const today = this.dependencies.today();
    const source = await this.dependencies.loadHabits();
    const items = source.slice(0, pluginToolLimit(args.limit)).map((habit) => {
      const log = (Array.isArray(habit?.log) ? habit.log : []).map((item) => String(item || '').slice(0, 10)).filter(Boolean).sort();
      return {
        id:pluginToolText(habit?.id, 72), name:pluginToolText(habit?.name, 120), icon:pluginToolText(habit?.icon, 8),
        created:String(habit?.created || '').slice(0, 10), totalCheckIns:log.length, lastCheckIn:log.at(-1) || '', checkedToday:log.includes(today)
      };
    });
    return { ok:true, data:{ items, total:source.length, truncated:source.length > items.length } };
  }
  async _listAlarms(args) {
    if (typeof this.plugin.alarms?.load !== 'function') throw new Error('Cockpit alarm service is unavailable.');
    const source = await this.plugin.alarms.load();
    const items = source.slice(0, pluginToolLimit(args.limit)).map((alarm) => ({
      id:pluginToolText(alarm?.id, 72), name:pluginToolText(alarm?.name, 80), enabled:alarm?.enabled !== false,
      scheduleType:['once','daily','weekdays'].includes(alarm?.scheduleType) ? alarm.scheduleType : 'daily',
      time:String(alarm?.time || '').slice(0, 5), weekdays:(Array.isArray(alarm?.weekdays) ? alarm.weekdays : []).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
      onceAt:alarm?.onceAt || null, snoozedUntil:alarm?.snoozedUntil || null, todoId:pluginToolText(alarm?.todoId, 72)
    }));
    return { ok:true, data:{ items, total:source.length, truncated:source.length > items.length } };
  }
  async _listCountdowns(args) {
    if (typeof this.plugin.countdowns?.load !== 'function') throw new Error('Cockpit countdown service is unavailable.');
    const source = await this.plugin.countdowns.load();
    const now = this.dependencies.now();
    const items = source.slice(0, pluginToolLimit(args.limit)).map((countdown) => {
      const targetAt = String(countdown?.targetAt || '');
      const targetMs = Date.parse(targetAt);
      return {
        id:pluginToolText(countdown?.id, 72), name:pluginToolText(countdown?.name, 100), enabled:countdown?.enabled !== false,
        startAt:String(countdown?.startAt || ''), targetAt, remainingMs:Number.isFinite(targetMs) ? Math.max(0, targetMs - now) : 0
      };
    });
    return { ok:true, data:{ items, total:source.length, truncated:source.length > items.length } };
  }
}

function createCockpitPluginDataToolsRegistry(plugin, dependencies) {
  return new CockpitPluginDataToolsRegistry(plugin, dependencies);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { AI_PLUGIN_TOOL_LIST_LIMIT, pluginDataToolDefinitions, CockpitPluginDataToolsRegistry, createCockpitPluginDataToolsRegistry };
}
