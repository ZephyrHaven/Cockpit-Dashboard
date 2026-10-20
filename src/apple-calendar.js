// apple-calendar.js — Mac 单向日历同步；通过固定 JXA 脚本写入用户明确选择的系统日历。

const APPLE_CALENDAR_DEFAULTS = Object.freeze({ enabled:false, calendarId:'', calendarName:'', durationMinutes:30, mappings:{}, showEvents:false, hiddenCalendars:[] });

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
    mappings,
    showEvents:source.showEvents === true,
    hiddenCalendars:(Array.isArray(source.hiddenCalendars) ? source.hiddenCalendars : []).map((name) => appleCalendarSafeText(name, 160)).filter(Boolean).slice(0, 40),
    lastSyncResult:source.lastSyncResult && ['success','failed'].includes(source.lastSyncResult.status) ? {
      at:appleCalendarSafeText(source.lastSyncResult.at,40),status:source.lastSyncResult.status,error:appleCalendarSafeText(source.lastSyncResult.error,400)
    } : null
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

// 只读日程：固定 JXA 脚本按时间窗查询各日历事件，仅返回标题、时间、地点与所属日历，不做任何写入。
// 重复事件由系统返回母事件 + RRULE，再在插件内展开（Calendar 脚本接口不会展开重复实例）。
const APPLE_CALENDAR_READ_JXA = String.raw`
function run(argv) {
  const payload = JSON.parse(argv[0]);
  if (payload.action !== 'read') throw new Error('invalid-action');
  const calendarApp = Application('Calendar');
  const start = new Date(payload.startAt);
  const end = new Date(payload.endAt);
  const hidden = new Set((Array.isArray(payload.hidden) ? payload.hidden : []).map(String));
  let names = [];
  try { names = calendarApp.calendars.name(); } catch (ignored) { names = []; }
  const out = [];
  const collect = (query, name, recurring) => {
    let records = [];
    try { records = query.properties() || []; }
    catch (bulkError) {
      try { records = (query() || []).map((event) => { try { return event.properties(); } catch (ignored) { return null; } }).filter(Boolean); }
      catch (ignored) { return; }
    }
    for (let index = 0; index < records.length && out.length < 1500; index++) {
      try {
        // Fetch the filtered collection as one array of property records. This
        // avoids one cross-process Calendar call per event; older bridges fall
        // back to resolving individual records without rerunning each field.
        const properties = records[index];
        const startDate = properties.startDate; const endDate = properties.endDate;
        if (!(startDate instanceof Date)) continue;
        const excluded = recurring ? properties.excludedDates : [];
        out.push({
          uid:String(properties.uid || ''), title:String(properties.summary || ''), calendar:String(name),
          startAt:startDate.toISOString(), endAt:(endDate instanceof Date ? endDate : startDate).toISOString(),
          allDay:properties.alldayEvent === true, location:String(properties.location || ''),
          recurrence:recurring ? String(properties.recurrence || '') : '',
          excluded:recurring && Array.isArray(excluded) ? excluded.filter((item) => item instanceof Date).map((item) => item.toISOString()) : []
        });
      } catch (ignored) {}
    }
  };
  names.forEach((name, index) => {
    if (hidden.has(String(name))) return;
    const calendar = calendarApp.calendars[index];
    try { collect(calendar.events.whose({ _and:[{ startDate:{ _lessThan:end } }, { endDate:{ _greaterThan:start } }] }), name, false); } catch (ignored) {}
    try { collect(calendar.events.whose({ _and:[{ startDate:{ _lessThan:end } }, { recurrence:{ _beginsWith:'FREQ' } }] }), name, true); } catch (ignored) {}
  });
  return JSON.stringify({ events:out });
}`;

function parseAppleCalendarRule(rule) {
  const parts = {};
  String(rule || '').split(';').forEach((segment) => {
    const [key, value] = segment.split('=');
    if (key && value) parts[key.trim().toUpperCase()] = value.trim();
  });
  return parts;
}

function parseAppleCalendarRuleDate(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;
  const [, y, mo, d, h = '23', mi = '59', se = '59', utc] = match;
  return utc ? Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) : new Date(+y, +mo - 1, +d, +h, +mi, +se).getTime();
}

// 把母事件 + RRULE 展开成时间窗内的实例；支持 DAILY/WEEKLY(BYDAY)/MONTHLY/YEARLY、INTERVAL、COUNT、UNTIL 与排除日期。
function expandAppleCalendarOccurrences(event, rangeStart, rangeEnd) {
  const start = Date.parse(event.startAt);
  const end = Date.parse(event.endAt);
  if (!Number.isFinite(start)) return [];
  const duration = Math.max(0, (Number.isFinite(end) ? end : start) - start);
  const rule = parseAppleCalendarRule(event.recurrence);
  const freq = rule.FREQ;
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return [{ start, end:start + duration }];
  const interval = Math.max(1, Math.min(366, parseInt(rule.INTERVAL, 10) || 1));
  const maxCount = parseInt(rule.COUNT, 10) > 0 ? parseInt(rule.COUNT, 10) : Infinity;
  const until = rule.UNTIL ? parseAppleCalendarRuleDate(rule.UNTIL) : null;
  const excluded = new Set((Array.isArray(event.excluded) ? event.excluded : []).map((value) => Date.parse(value)).filter(Number.isFinite));
  const base = new Date(start);
  const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const byDay = freq === 'WEEKLY' && rule.BYDAY
    ? rule.BYDAY.split(',').map((code) => dayCodes.indexOf(code.replace(/^[+-]?\d+/, '').trim())).filter((day) => day >= 0)
    : [];
  const at = (y, m, d) => new Date(y, m, d, base.getHours(), base.getMinutes(), base.getSeconds()).getTime();
  const out = [];
  let count = 0;
  const accept = (occurrence) => {
    if (occurrence < start) return true;
    if ((until !== null && occurrence > until) || count >= maxCount || occurrence >= rangeEnd) return false;
    count++;
    if (!excluded.has(occurrence) && occurrence + Math.max(duration, 1) > rangeStart) out.push({ start:occurrence, end:occurrence + duration });
    return true;
  };
  for (let step = 0; step < 5000; step++) {
    if (freq === 'DAILY') {
      if (!accept(at(base.getFullYear(), base.getMonth(), base.getDate() + step * interval))) break;
    } else if (freq === 'WEEKLY') {
      const mondayOffset = (base.getDay() + 6) % 7;
      const weekStart = new Date(base.getFullYear(), base.getMonth(), base.getDate() - mondayOffset + step * 7 * interval);
      const days = byDay.length ? byDay.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) : [base.getDay()];
      let keepGoing = true;
      for (const day of days) {
        if (!accept(at(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + ((day + 6) % 7)))) { keepGoing = false; break; }
      }
      if (!keepGoing) break;
    } else if (freq === 'MONTHLY') {
      const monthIndex = base.getMonth() + step * interval;
      const candidate = new Date(base.getFullYear(), monthIndex, base.getDate());
      if (candidate.getDate() !== base.getDate()) continue;
      if (!accept(at(candidate.getFullYear(), candidate.getMonth(), candidate.getDate()))) break;
    } else {
      const candidate = new Date(base.getFullYear() + step * interval, base.getMonth(), base.getDate());
      if (candidate.getMonth() !== base.getMonth()) continue;
      if (!accept(at(candidate.getFullYear(), candidate.getMonth(), candidate.getDate()))) break;
    }
  }
  return out;
}

function expandAppleCalendarEvents(rawEvents, rangeStart, rangeEnd) {
  const seen = new Set();
  const events = [];
  (Array.isArray(rawEvents) ? rawEvents : []).forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const title = appleCalendarSafeText(raw.title, 180);
    const uid = appleCalendarSafeText(raw.uid, 300);
    if (!title) return;
    const occurrences = raw.recurrence
      ? expandAppleCalendarOccurrences(raw, rangeStart, rangeEnd)
      : [{ start:Date.parse(raw.startAt), end:Date.parse(raw.endAt) }];
    occurrences.forEach(({ start, end }) => {
      if (!Number.isFinite(start)) return;
      const safeEnd = Number.isFinite(end) && end >= start ? end : start;
      if (start >= rangeEnd || Math.max(safeEnd, start + 1) <= rangeStart) return;
      const id = (uid || title) + '@' + start;
      if (seen.has(id)) return;
      seen.add(id);
      events.push({
        id, uid, title, start, end:safeEnd, allDay:raw.allDay === true,
        calendar:appleCalendarSafeText(raw.calendar, 160), location:appleCalendarSafeText(raw.location, 200)
      });
    });
  });
  return events.sort((a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || a.start - b.start || a.title.localeCompare(b.title));
}

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

function appleCalendarStoredError(error) {
  const detail = String(error?.stderr || error?.message || error || 'Calendar sync failed').replace(/\s+/g, ' ').trim();
  const safe = typeof cockpitSafeRunError === 'function' ? cockpitSafeRunError(detail) : detail;
  return appleCalendarSafeText(safe, 400) || 'Calendar sync failed';
}

const APPLE_CALENDAR_EVENT_CACHE_VERSION = 1;
const APPLE_CALENDAR_EVENT_CACHE_FRESH_MS = 5 * 60000;
const APPLE_CALENDAR_EVENT_CACHE_STALE_MS = 24 * 60 * 60000;

function appleCalendarEventSourceKey(config) {
  return JSON.stringify([
    config?.enabled === true ? appleCalendarSafeText(config.calendarName, 160) : '',
    (Array.isArray(config?.hiddenCalendars) ? config.hiddenCalendars : []).map((name) => appleCalendarSafeText(name, 160)).filter(Boolean).sort()
  ]);
}

function normalizeAppleCalendarEventCache(raw) {
  if (!raw || raw.version !== APPLE_CALENDAR_EVENT_CACHE_VERSION) return null;
  const rangeStart = Number(raw.rangeStart); const rangeEnd = Number(raw.rangeEnd); const at = Number(raw.at);
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart || !Number.isFinite(at)) return null;
  const events = (Array.isArray(raw.events) ? raw.events : []).slice(0, 1500).flatMap((event) => {
    const start = Number(event?.start); const end = Number(event?.end);
    const title = appleCalendarSafeText(event?.title, 180);
    if (!title || !Number.isFinite(start) || !Number.isFinite(end)) return [];
    return [{
      id:appleCalendarSafeText(event.id, 520), uid:appleCalendarSafeText(event.uid, 300), title,
      start, end:Math.max(start, end), allDay:event.allDay === true,
      calendar:appleCalendarSafeText(event.calendar, 160), location:appleCalendarSafeText(event.location, 200)
    }];
  });
  return { version:APPLE_CALENDAR_EVENT_CACHE_VERSION, rangeStart, rangeEnd, at, sourceKey:appleCalendarSafeText(raw.sourceKey, 1200), events };
}

class AppleCalendarService {
  constructor(plugin, options = {}) { this.plugin = plugin; this._config = null; this._eventCache = new Map(); this._eventInflight = new Map(); this._eventListeners = new Set(); this._eventCacheGeneration = 0; this._queue = Promise.resolve(); this._cachedCalendars = []; this._platform = options.platform || (typeof process !== 'undefined' ? process.platform : ''); this._execFile = options.execFile || null; }
  isSupported() { return this._platform === 'darwin' && this.plugin?.app?.isMobile !== true; }
  getCachedCalendars() { return this._cachedCalendars.map((item) => ({ ...item })); }
  async getConfig() {
    if (this._config) return normalizeAppleCalendarConfig(this._config);
    const data = await this.plugin.loadData() || {};
    this._config = normalizeAppleCalendarConfig(data.appleCalendarSync);
    const persisted = normalizeAppleCalendarEventCache(data.appleCalendarEventCache);
    if (persisted && Date.now() - persisted.at < APPLE_CALENDAR_EVENT_CACHE_STALE_MS) {
      this._eventCache.set(this._eventRangeKey(persisted.rangeStart, persisted.rangeEnd), persisted);
    }
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
  async _ensureReadyNow(options = {}, knownCalendars = null) {
    const current = await this.getConfig();
    let calendars = Array.isArray(knownCalendars) ? knownCalendars : await this.listCalendars();
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
      mappings:options.resetMappings === true || changedTarget ? {} : current.mappings
    });
  }
  async ensureReady(options = {}) {
    this._queue = this._queue.catch(() => {}).then(() => this._ensureReadyNow(options));
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
      let config = await this.getConfig();
      if (!this.isSupported() || !config.enabled || !config.calendarId || !config.calendarName) return false;
      const desired = desiredSnapshot.map((item) => ({ ...item, hash:appleCalendarEventHash(item) }));
      if (!desired.length && !Object.keys(config.mappings).length) {
        if (config.lastSyncResult?.status === 'failed') {
          config = await this.saveConfig({ ...config, lastSyncResult:{at:new Date().toISOString(),status:'success',error:''} });
        }
        return true;
      }
      try {
        let result;
        try {
          result = await this._run({ action:'sync', calendarId:config.calendarId, calendarName:config.calendarName, desired, mappings:config.mappings });
        } catch (firstError) {
          let calendars;
          try { calendars = await this.listCalendars(); }
          catch (listError) { throw firstError; }
          if (calendars.some((item) => item.name === config.calendarName)) throw firstError;
          config = await this._ensureReadyNow({ enable:true, resetMappings:true }, calendars);
          result = await this._run({ action:'sync', calendarId:config.calendarId, calendarName:config.calendarName, desired, mappings:config.mappings });
        }
        const latest = await this.getConfig();
        if (latest.calendarId !== config.calendarId || latest.calendarName !== config.calendarName) return false;
        await this.saveConfig({ ...latest, mappings:result?.mappings || {}, lastSyncResult:{at:new Date().toISOString(),status:'success',error:''} });
        return true;
      } catch(error) {
        const latest=await this.getConfig();
        if(latest.calendarId===config.calendarId && latest.calendarName===config.calendarName) { try { await this.saveConfig({...latest,lastSyncResult:{at:new Date().toISOString(),status:'failed',error:appleCalendarStoredError(error)}}); } catch(saveError) { console.warn('Cockpit calendar status could not be saved',saveError); } }
        throw error;
      }
    };
    this._queue = this._queue.catch(() => {}).then(task);
    if (options.silent !== false) return this._queue.catch((error) => { console.warn('Cockpit Apple calendar sync failed', error?.message || error); return false; });
    return this._queue;
  }
  _eventRangeKey(rangeStart, rangeEnd) { return Math.floor(rangeStart / 60000) + '_' + Math.floor(rangeEnd / 60000); }
  _findEventCache(rangeStart, rangeEnd, sourceKey) {
    const entries = Array.from(this._eventCache.values()).filter((entry) => entry.rangeStart <= rangeStart && entry.rangeEnd >= rangeEnd && entry.sourceKey === sourceKey);
    if (!entries.length) return null;
    const cached = entries.sort((a, b) => b.at - a.at)[0];
    return { ...cached, events:cached.events.filter((event) => event.start < rangeEnd && Math.max(event.end, event.start + 1) > rangeStart) };
  }
  peekEvents(rangeStart, rangeEnd) {
    const config = this._config ? normalizeAppleCalendarConfig(this._config) : null;
    const cached = config ? this._findEventCache(rangeStart, rangeEnd, appleCalendarEventSourceKey(config)) : null;
    return cached ? cached.events : null;
  }
  subscribeEvents(listener) { if (typeof listener !== 'function') return () => {}; this._eventListeners.add(listener); return () => this._eventListeners.delete(listener); }
  clearEventCache() {
    this._eventCacheGeneration += 1;
    this._eventCache.clear();
    if (typeof this.plugin?.mutateData !== 'function') return Promise.resolve();
    return Promise.resolve(this.plugin.mutateData((data) => { delete data.appleCalendarEventCache; })).catch((error) => console.warn('Cockpit Apple calendar cache clear failed', error));
  }
  async _storeEventCache(entry) {
    this._eventCache.set(this._eventRangeKey(entry.rangeStart, entry.rangeEnd), entry);
    if (this._eventCache.size > 12) this._eventCache.delete(this._eventCache.keys().next().value);
    if (typeof this.plugin?.mutateData !== 'function') return;
    await this.plugin.mutateData((data) => { data.appleCalendarEventCache = entry; });
  }
  async _readRaw(payload) {
    if (!this.isSupported()) throw new Error('unsupported-platform');
    const execFile = this._execFile || require('child_process').execFile;
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-l','JavaScript','-e',APPLE_CALENDAR_READ_JXA,JSON.stringify(payload)], { timeout:60000, maxBuffer:8 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { error.stderr = stderr; reject(error); return; }
        try { resolve(JSON.parse(String(stdout || '').trim() || 'null')); }
        catch (parseError) { parseError.stderr = stderr; reject(parseError); }
      });
    });
  }
  async _refreshEvents(rangeStart, rangeEnd, config, sourceKey, options = {}) {
    const key = this._eventRangeKey(rangeStart, rangeEnd);
    const generation = this._eventCacheGeneration;
    const inflightKey = key + '|' + sourceKey + '|' + generation;
    if (this._eventInflight.has(inflightKey)) return this._eventInflight.get(inflightKey);
    const hidden = config.hiddenCalendars.slice();
    if (config.enabled && config.calendarName) hidden.push(config.calendarName);
    const request = this._readRaw({ action:'read', startAt:new Date(rangeStart).toISOString(), endAt:new Date(rangeEnd).toISOString(), hidden })
      .then(async (result) => {
        const events = expandAppleCalendarEvents(result?.events, rangeStart, rangeEnd);
        if (generation !== this._eventCacheGeneration) return events;
        await this._storeEventCache({ version:APPLE_CALENDAR_EVENT_CACHE_VERSION, rangeStart, rangeEnd, at:Date.now(), sourceKey, events });
        if (options.notify === true) this._eventListeners.forEach((listener) => { try { listener({ rangeStart, rangeEnd, events }); } catch (error) {} });
        return events;
      })
      .finally(() => this._eventInflight.delete(inflightKey));
    this._eventInflight.set(inflightKey, request);
    return request;
  }
  // 读取时间窗内的系统日程（只读）。5 分钟内直接复用；重启后先显示最多 24 小时的本机缓存，再在后台更新。
  async readEvents(rangeStart, rangeEnd, options = {}) {
    const config = await this.getConfig();
    if (!this.isSupported() || !config.showEvents) return [];
    const sourceKey = appleCalendarEventSourceKey(config);
    const cached = this._findEventCache(rangeStart, rangeEnd, sourceKey);
    const age = cached ? Date.now() - cached.at : Infinity;
    if (cached && options.force !== true && age < APPLE_CALENDAR_EVENT_CACHE_FRESH_MS) return cached.events;
    if (cached && options.force !== true && age < APPLE_CALENDAR_EVENT_CACHE_STALE_MS) {
      this._refreshEvents(rangeStart, rangeEnd, config, sourceKey, { notify:true }).catch((error) => console.warn('Cockpit Apple calendar background refresh failed', error?.message || error));
      return cached.events;
    }
    return this._refreshEvents(rangeStart, rangeEnd, config, sourceKey);
  }
  userMessage(error, language) { return appleCalendarAutomationMessage(error, language); }
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { normalizeAppleCalendarConfig, normalizeAppleCalendarEventCache, buildAppleCalendarDesiredEvents, expandAppleCalendarEvents, expandAppleCalendarOccurrences, APPLE_CALENDAR_READ_JXA, appleCalendarEventHash, appleCalendarAutomationMessage, APPLE_CALENDAR_CREATE_SCRIPT, APPLE_CALENDAR_LIST_SCRIPT, APPLE_CALENDAR_JXA, AppleCalendarService };
}
