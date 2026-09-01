// apple-calendar.js — Mac 单向日历同步；通过固定 JXA 脚本写入用户明确选择的系统日历。

const APPLE_CALENDAR_DEFAULTS = Object.freeze({ enabled:false, calendarId:'', calendarName:'', durationMinutes:30, mappings:{} });

function appleCalendarSafeText(value, maxLength) {
  return String(value || '').replace(/\0/g, '').trim().slice(0, maxLength);
}

function normalizeAppleCalendarConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const duration = Math.round(Number(source.durationMinutes) || APPLE_CALENDAR_DEFAULTS.durationMinutes);
  const mappings = {};
  const entries = source.mappings && typeof source.mappings === 'object' && !Array.isArray(source.mappings)
    ? Object.entries(source.mappings).slice(0, 500)
    : [];
  entries.forEach(([todoId, mapping]) => {
    if (!/^[a-zA-Z0-9_-]{1,72}$/.test(todoId) || !mapping || typeof mapping !== 'object') return;
    const uid = appleCalendarSafeText(mapping.uid, 300);
    const calendarId = appleCalendarSafeText(mapping.calendarId, 300);
    const hash = appleCalendarSafeText(mapping.hash, 80);
    if (uid && calendarId) mappings[todoId] = { uid, calendarId, hash };
  });
  return {
    enabled:source.enabled === true,
    calendarId:appleCalendarSafeText(source.calendarId, 300),
    calendarName:appleCalendarSafeText(source.calendarName, 160),
    durationMinutes:Math.max(15, Math.min(480, duration)),
    mappings
  };
}

function appleCalendarFormatLocalDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

function appleCalendarNextDay(day) {
  const parts = String(day || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) return '';
  return appleCalendarFormatLocalDate(new Date(parts[0], parts[1] - 1, parts[2] + 1, 0, 0, 0));
}

function appleCalendarAddMinutes(value, minutes) {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return '';
  return appleCalendarFormatLocalDate(new Date(date.getTime() + minutes * 60000));
}

function buildAppleCalendarDesiredEvents(todos, rawConfig) {
  const config = normalizeAppleCalendarConfig(rawConfig);
  return (Array.isArray(todos) ? todos : []).flatMap((todo) => {
    if (!todo || todo.done || todo.calendarSync !== true || !todo.dueDate || !/^[a-zA-Z0-9_-]{1,72}$/.test(String(todo.id || ''))) return [];
    const allDay = todo.dueHasTime !== true;
    const dateText = todo.dueDate?.format?.(allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm:ss');
    if (!dateText) return [];
    const startAt = allDay ? dateText + 'T00:00:00' : dateText;
    const endAt = allDay ? appleCalendarNextDay(dateText) : appleCalendarAddMinutes(dateText, config.durationMinutes);
    if (!endAt) return [];
    const tags = (Array.isArray(todo.tags) ? todo.tags : []).map((tag) => appleCalendarSafeText(tag, 40)).filter(Boolean).slice(0, 8);
    const noteLines = ['由 Cockpit 管理', 'Cockpit task ID: ' + todo.id];
    if (tags.length) noteLines.push('标签: ' + tags.map((tag) => '#' + tag).join(' '));
    noteLines.push('优先级: ' + (['high','mid','low'].includes(todo.priority) ? todo.priority : 'mid'));
    return [{
      todoId:String(todo.id), title:appleCalendarSafeText(todo.text, 180), startAt, endAt, allDay,
      notes:noteLines.join('\n').slice(0, 1200)
    }];
  }).filter((item) => item.title);
}

// 日历对象在部分系统版本的 JXA 桥接中会触发 -1700 类型转换错误。
// 读取列表改用 AppleScript 直接取纯文本属性；待办内容仍只通过 JSON 参数传给固定 JXA 脚本。
const APPLE_CALENDAR_LIST_SCRIPT = String.raw`
set outputRows to {}
tell application "Calendar"
  repeat with calendarRef in calendars
    try
      if writable of calendarRef is true then
        set calendarName to (name of calendarRef) as text
        set end of outputRows to calendarName
      end if
    end try
  end repeat
end tell
set AppleScript's text item delimiters to linefeed
return outputRows as text`;

const APPLE_CALENDAR_CREATE_SCRIPT = String.raw`
tell application "Calendar"
  make new calendar with properties {name:"Cockpit"}
end tell
return "Cockpit"`;

function appleCalendarEventHash(item) {
  const source = JSON.stringify([item.title,item.startAt,item.endAt,item.allDay,item.notes]);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

const APPLE_CALENDAR_JXA = String.raw`
function run(argv) {
  const payload = JSON.parse(argv[0]);
  if (payload.action !== 'sync') throw new Error('invalid-action');
  const calendarApp = Application('Calendar');
  const calendar = calendarApp.calendars.byName(String(payload.calendarName || ''));
  if (!calendar.exists() || calendar.writable() !== true) throw new Error('calendar-not-found');
  const desired = Array.isArray(payload.desired) ? payload.desired : [];
  const desiredIds = new Set(desired.map((item) => String(item.todoId || '')));
  const previous = payload.mappings && typeof payload.mappings === 'object' ? payload.mappings : {};
  const existingByUid = {};
  calendar.events().forEach((event) => {
    try { const uid = String(event.uid() || ''); if (uid) existingByUid[uid] = event; } catch (ignored) {}
  });
  const nextMappings = {};
  desired.forEach((item) => {
    const old = previous[item.todoId];
    let event = old && old.calendarId === payload.calendarId ? existingByUid[old.uid] : null;
    if (!event) {
      event = calendarApp.Event({
        summary:String(item.title || ''), description:String(item.notes || ''),
        startDate:new Date(item.startAt), endDate:new Date(item.endAt), alldayEvent:item.allDay === true
      });
      calendar.events.push(event);
      calendarApp.save();
    } else if (old.hash !== item.hash) {
      event.summary = String(item.title || '');
      event.description = String(item.notes || '');
      event.startDate = new Date(item.startAt);
      event.endDate = new Date(item.endAt);
      event.alldayEvent = item.allDay === true;
    }
    const uid = String(event.uid() || '');
    if (uid) nextMappings[item.todoId] = { uid, calendarId:String(payload.calendarId || ''), hash:String(item.hash || '') };
  });
  Object.keys(previous).forEach((todoId) => {
    const mapping = previous[todoId];
    if (desiredIds.has(todoId) || !mapping || mapping.calendarId !== payload.calendarId) return;
    const event = existingByUid[mapping.uid];
    if (event) calendarApp.delete(event);
  });
  calendarApp.save();
  return JSON.stringify({ mappings:nextMappings });
}`;

function appleCalendarAutomationMessage(error, language = 'zh-CN') {
  const en = language === 'en';
  const detail = String(error?.stderr || error?.message || error || 'unknown error');
  if (/not authorized|-1743|not permitted|权限|授权/i.test(detail)) {
    return en
      ? 'Calendar access was denied. Open System Settings → Privacy & Security → Automation, then allow the host app to control Calendar.'
      : '日历权限未授权。请打开“系统设置 → 隐私与安全性 → 自动化”，允许宿主应用控制“日历”。';
  }
  if (/calendar-not-found/i.test(detail)) return en ? 'The selected writable calendar is no longer available.' : '所选的可写日历已不存在，请重新读取并选择。';
  if (/-1700|不能转换类型|can.?t make/i.test(detail)) return en ? 'Calendar data could not be read. Close and reopen Calendar, then try again.' : '无法读取日历数据。请关闭并重新打开系统日历后再试。';
  if (/unsupported-platform/i.test(detail)) return en ? 'Apple Calendar sync is available on Mac only.' : 'Apple 日历同步仅 Mac 可用。';
  return (en ? 'Apple Calendar sync failed: ' : 'Apple 日历同步失败：') + detail.replace(/\s+/g, ' ').slice(0, 180);
}

class AppleCalendarService {
  constructor(plugin, options = {}) { this.plugin = plugin; this._config = null; this._queue = Promise.resolve(); this._cachedCalendars = []; this._platform = options.platform || (typeof process !== 'undefined' ? process.platform : ''); this._execFile = options.execFile || null; }
  isSupported() { return this._platform === 'darwin' && this.plugin?.app?.isMobile !== true; }
  getCachedCalendars() { return this._cachedCalendars.map((item) => ({ ...item })); }
  async getConfig() {
    if (this._config) return normalizeAppleCalendarConfig(this._config);
    this._config = normalizeAppleCalendarConfig((await this.plugin.loadData() || {}).appleCalendarSync);
    return normalizeAppleCalendarConfig(this._config);
  }
  async saveConfig(next) {
    const normalized = normalizeAppleCalendarConfig(next);
    await this.plugin.mutateData((data) => { data.appleCalendarSync = normalized; });
    this._config = normalized;
    return normalizeAppleCalendarConfig(normalized);
  }
  async _run(payload) {
    if (!this.isSupported()) throw new Error('unsupported-platform');
    const execFile = this._execFile || require('child_process').execFile;
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-l','JavaScript','-e',APPLE_CALENDAR_JXA,JSON.stringify(payload)], { timeout:20000, maxBuffer:1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { error.stderr = stderr; reject(error); return; }
        try { resolve(JSON.parse(String(stdout || '').trim() || 'null')); }
        catch (parseError) { parseError.stderr = stderr; reject(parseError); }
      });
    });
  }
  async _list() {
    if (!this.isSupported()) throw new Error('unsupported-platform');
    const execFile = this._execFile || require('child_process').execFile;
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-e',APPLE_CALENDAR_LIST_SCRIPT], { timeout:20000, maxBuffer:1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { error.stderr = stderr; reject(error); return; }
        const seen = new Set();
        const calendars = String(stdout || '').split(/\r?\n/).flatMap((line) => {
          const name = appleCalendarSafeText(line, 160);
          if (!name || seen.has(name)) return [];
          seen.add(name);
          return [{ id:name, name, writable:true }];
        });
        resolve(calendars);
      });
    });
  }
  async _createDedicatedCalendar() {
    if (!this.isSupported()) throw new Error('unsupported-platform');
    const execFile = this._execFile || require('child_process').execFile;
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-e',APPLE_CALENDAR_CREATE_SCRIPT], { timeout:20000, maxBuffer:1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { error.stderr = stderr; reject(error); return; }
        resolve(appleCalendarSafeText(stdout, 160) || 'Cockpit');
      });
    });
  }
  async listCalendars() {
    const result = await this._list();
    this._cachedCalendars = (Array.isArray(result) ? result : []).filter((item) => item?.id && item?.name && item.writable).map((item) => ({ id:String(item.id), name:String(item.name), writable:true }));
    return this.getCachedCalendars();
  }
  async ensureReady(options = {}) {
    const task = async () => {
      const current = await this.getConfig();
      let calendars = await this.listCalendars();
      let target = calendars.find((item) => current.calendarName && item.name === current.calendarName)
        || calendars.find((item) => item.name === 'Cockpit');
      if (!target) {
        await this._createDedicatedCalendar();
        calendars = await this.listCalendars();
        target = calendars.find((item) => item.name === 'Cockpit');
      }
      if (!target) throw new Error('calendar-create-failed');
      const changedTarget = current.calendarName !== target.name || current.calendarId !== target.id;
      return this.saveConfig({
        ...current,
        enabled:options.enable === true ? true : current.enabled,
        calendarId:target.id,
        calendarName:target.name,
        mappings:changedTarget ? {} : current.mappings
      });
    };
    this._queue = this._queue.catch(() => {}).then(task);
    return this._queue;
  }
  async selectCalendar(calendarId, calendarName) {
    const nextId = appleCalendarSafeText(calendarId, 300); const nextName = appleCalendarSafeText(calendarName, 160);
    const task = async () => {
      const current = await this.getConfig();
      if (!nextId) return this.saveConfig({ ...current, enabled:false, calendarId:'', calendarName:'', mappings:{} });
      if (current.calendarId === nextId) return this.saveConfig({ ...current, calendarName:nextName || current.calendarName });
      if (current.calendarId && Object.keys(current.mappings).length) {
        await this._run({ action:'sync', calendarId:current.calendarId, calendarName:current.calendarName, desired:[], mappings:current.mappings });
      }
      return this.saveConfig({ ...current, calendarId:nextId, calendarName:nextName, mappings:{} });
    };
    this._queue = this._queue.catch(() => {}).then(task);
    return this._queue;
  }
  async syncTodos(todos, options = {}) {
    const desiredSnapshot = buildAppleCalendarDesiredEvents(todos, await this.getConfig());
    const task = async () => {
      const config = await this.getConfig();
      if (!this.isSupported() || !config.enabled || !config.calendarId || !config.calendarName) return false;
      const desired = desiredSnapshot.map((item) => ({ ...item, hash:appleCalendarEventHash(item) }));
      const result = await this._run({ action:'sync', calendarId:config.calendarId, calendarName:config.calendarName, desired, mappings:config.mappings });
      const latest = await this.getConfig();
      if (latest.calendarId !== config.calendarId) return false;
      await this.saveConfig({ ...latest, mappings:result?.mappings || {} });
      return true;
    };
    this._queue = this._queue.catch(() => {}).then(task);
    if (options.silent !== false) return this._queue.catch((error) => { console.warn('Cockpit Apple calendar sync failed', error?.message || error); return false; });
    return this._queue;
  }
  userMessage(error, language) { return appleCalendarAutomationMessage(error, language); }
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { normalizeAppleCalendarConfig, buildAppleCalendarDesiredEvents, appleCalendarEventHash, appleCalendarAutomationMessage, APPLE_CALENDAR_CREATE_SCRIPT, APPLE_CALENDAR_LIST_SCRIPT, APPLE_CALENDAR_JXA, AppleCalendarService };
}
