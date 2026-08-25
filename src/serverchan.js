// serverchan.js — 多渠道消息推送：排程、消息组装与渠道适配器

const NOTIFICATION_CHANNELS = {
  serverChan: { id:'serverChan', label:'Server酱³' },
  bark: { id:'bark', label:'Bark' },
  meow: { id:'meow', label:'MEOW' }
};

const SERVERCHAN_DEFAULTS = {
  enabled:false, notifyToday:true, notifyOverdue:true, schedule:'daily', time:'09:00:00', times:['09:00:00'],
  weekdays:[1,2,3,4,5], monthDays:[1], messageTemplate:'', sentReminders:{},
  channels:{
    serverChan:{ enabled:true, apiUrl:'', uid:'', sendKey:'' },
    bark:{ enabled:false, serverUrl:'https://api.day.app', deviceKey:'', group:'cockpit' },
    meow:{ enabled:false, nickname:'' }
  }
};

function normalizeNotificationTime(value) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]); const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return [hour, minute, second].map((part) => String(part).padStart(2, '0')).join(':');
}

function normalizeNotificationTimes(value, fallback = SERVERCHAN_DEFAULTS.times) {
  const normalizeList = (items) => Array.from(new Set((Array.isArray(items) ? items : [items])
    .map(normalizeNotificationTime).filter(Boolean))).slice(0, 24);
  const times = normalizeList(value);
  if (times.length) return times;
  const fallbackTimes = normalizeList(fallback);
  return fallbackTimes.length ? fallbackTimes : ['09:00:00'];
}

function suggestNotificationTime(value) {
  const times = normalizeNotificationTimes(value);
  const used = new Set(times);
  const [hour, minute, second] = times[times.length - 1].split(':').map(Number);
  const start = hour * 3600 + minute * 60 + second;
  for (let offset = 1; offset <= 24; offset++) {
    const total = (start + offset * 3600) % 86400;
    const candidate = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((part) => String(part).padStart(2, '0')).join(':');
    if (!used.has(candidate)) return candidate;
  }
  return SERVERCHAN_DEFAULTS.time;
}

function normalizeNumberList(value, min, max, fallback) {
  const seen = new Set();
  (Array.isArray(value) ? value : String(value || '').split(',')).forEach((item) => {
    const number = parseInt(String(item).trim(), 10);
    if (number >= min && number <= max) seen.add(number);
  });
  return seen.size ? Array.from(seen).sort((a, b) => a - b) : fallback.slice();
}

function safeText(value, max) { return String(value || '').trim().slice(0, max); }
function safeHttpsBase(value, fallback) {
  try {
    const url = new URL(safeText(value, 300) || fallback);
    if (url.protocol !== 'https:' || url.username || url.password) return fallback;
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch (e) { return fallback; }
}
function normalizeSentReminders(raw) {
  const sent = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(sent).filter(([key]) => /^\d{4}-\d{2}-\d{2}\|\d{2}:\d{2}:\d{2}$/.test(key)).map(([key, value]) => {
    const perChannel = value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([id, stamp]) => NOTIFICATION_CHANNELS[id] && typeof stamp === 'string'))
      : { serverChan: typeof value === 'string' ? value : new Date().toISOString() };
    return [key, perChannel];
  }).slice(-90));
}

function normalizeServerChanConfig(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const channels = value.channels && typeof value.channels === 'object' ? value.channels : {};
  const legacyServerChan = channels.serverChan || value;
  const times = normalizeNotificationTimes(Array.isArray(value.times) && value.times.length ? value.times : value.time);
  return {
    ...SERVERCHAN_DEFAULTS,
    enabled:value.enabled === true, notifyToday:value.notifyToday !== false, notifyOverdue:value.notifyOverdue !== false,
    schedule:['daily','weekly','monthly'].includes(value.schedule) ? value.schedule : 'daily',
    time:times[0], times,
    weekdays:normalizeNumberList(value.weekdays, 1, 7, SERVERCHAN_DEFAULTS.weekdays),
    monthDays:normalizeNumberList(value.monthDays, 1, 31, SERVERCHAN_DEFAULTS.monthDays),
    messageTemplate:safeText(value.messageTemplate, 4000), sentReminders:normalizeSentReminders(value.sentReminders),
    channels:{
      serverChan:{ enabled:channels.serverChan ? legacyServerChan.enabled !== false : !!(value.apiUrl || value.uid || value.sendKey), apiUrl:safeText(legacyServerChan.apiUrl, 500), uid:safeText(legacyServerChan.uid, 32), sendKey:safeText(legacyServerChan.sendKey, 240) },
      bark:{ enabled:channels.bark?.enabled === true, serverUrl:safeHttpsBase(channels.bark?.serverUrl, 'https://api.day.app'), deviceKey:safeText(channels.bark?.deviceKey, 240), group:safeText(channels.bark?.group || 'cockpit', 64) || 'cockpit' },
      meow:{ enabled:channels.meow?.enabled === true, nickname:safeText(channels.meow?.nickname, 64).replace(/\//g, '') }
    }
  };
}

function suppressElapsedNotificationSlots(previousValue, nextValue, now) {
  const previous = normalizeServerChanConfig(previousValue);
  const next = normalizeServerChanConfig(nextValue);
  const previousTimes = new Set(previous.times);
  const current = now.format('HH:mm:ss');
  const date = now.format('YYYY-MM-DD');
  const sentReminders = { ...next.sentReminders };
  const stamp = new Date().toISOString();
  next.times.forEach((time) => {
    if (previousTimes.has(time) || time > current) return;
    const key = date + '|' + time;
    const records = { ...(sentReminders[key] || {}) };
    Object.keys(NOTIFICATION_CHANNELS).forEach((id) => { records[id] = records[id] || stamp; });
    sentReminders[key] = records;
  });
  return { ...next, sentReminders:normalizeSentReminders(sentReminders) };
}

function isServerChanScheduleDue(config, now) {
  return config.schedule === 'weekly' ? config.weekdays.includes(now.isoWeekday()) : config.schedule === 'monthly' ? config.monthDays.includes(now.date()) : true;
}
function getServerChanScheduleSlot(config, now) {
  const current = now.format('HH:mm:ss');
  const times = normalizeNotificationTimes(config?.times || config?.time).slice().sort();
  let time = null;
  for (const candidate of times) {
    if (candidate > current) break;
    time = candidate;
  }
  return time ? { time, key:now.format('YYYY-MM-DD') + '|' + time } : null;
}
function formatServerChanDateTime(now) {
  const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  return now.format('YYYY 年 M 月 D 日') + ' · ' + weekdays[now.day()] + ' · ' + now.format('HH:mm:ss');
}
function getEnabledChannels(config) { return Object.keys(NOTIFICATION_CHANNELS).filter((id) => config.channels[id]?.enabled); }
function channelWasSent(config, key, id) { return !!config.sentReminders[key]?.[id]; }
function allEnabledChannelsSent(config, key) { const ids = getEnabledChannels(config); return ids.length > 0 && ids.every((id) => channelWasSent(config, key, id)); }
function getServerChanEndpoint(channel) {
  if (channel.apiUrl) {
    const url = new URL(channel.apiUrl);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.push\.ft07\.com$/i.test(url.hostname) || !/^\/send\/[^/]+\.send$/.test(url.pathname)) throw new Error('Server酱³ API URL 无效');
    return url.toString();
  }
  if (!/^\d+$/.test(channel.uid) || !channel.sendKey) throw new Error('请填写 Server酱³ API URL，或 UID 与 SendKey');
  return 'https://' + channel.uid + '.push.ft07.com/send/' + encodeURIComponent(channel.sendKey) + '.send';
}
function parseResponse(response) {
  if (response.json) return response.json;
  try { return JSON.parse(response.text || '{}'); } catch (e) { return {}; }
}

async function sendNotificationChannel(channelId, channel, title, body) {
  let request;
  if (channelId === 'serverChan') {
    request = { url:getServerChanEndpoint(channel), method:'POST', contentType:'application/json', body:JSON.stringify({ title:String(title).slice(0,100), desp:String(body), tags:'cockpit' }), throw:false };
  } else if (channelId === 'bark') {
    if (!/^[A-Za-z0-9_-]{8,240}$/.test(channel.deviceKey)) throw new Error('Bark Device Key 无效');
    request = { url:safeHttpsBase(channel.serverUrl, 'https://api.day.app').replace(/\/push$/, '') + '/push', method:'POST', contentType:'application/json', body:JSON.stringify({ device_key:channel.deviceKey, title:String(title).slice(0,100), body:String(body), group:channel.group }), throw:false };
  } else if (channelId === 'meow') {
    if (!channel.nickname) throw new Error('请填写 MEOW 昵称');
    request = { url:'https://api.chuckfang.com/' + encodeURIComponent(channel.nickname) + '?msgType=markdown', method:'POST', contentType:'application/json', body:JSON.stringify({ title:String(title).slice(0,100), msg:String(body) }), throw:false };
  } else throw new Error('未知推送渠道');
  const response = await obsidian.requestUrl(request);
  const payload = parseResponse(response);
  if (response.status < 200 || response.status >= 300) throw new Error(NOTIFICATION_CHANNELS[channelId].label + ' 返回 HTTP ' + response.status);
  if (channelId === 'serverChan' && payload.code != null && Number(payload.code) !== 0) throw new Error(payload.message || payload.msg || 'Server酱³ 推送失败');
  if (channelId === 'bark' && payload.code != null && ![0, 200].includes(Number(payload.code))) throw new Error(payload.message || 'Bark 推送失败');
  if (channelId === 'meow' && payload.status != null && Number(payload.status) !== 200) throw new Error(payload.message || payload.msg || 'MEOW 推送失败');
  return payload;
}

function getServerChanSettingsCopy(language) {
  const en = language === 'en';
  return en ? {
    heading: 'Message notifications', intro:'Configure one or more delivery apps. Keys are saved only in this plugin’s private data.json.', enabled:'Enable scheduled reminders', enabledDesc:'Checks automatically while Obsidian is running; each enabled channel sends once per schedule slot.',
    channels:'Delivery channels', serverChan:'ServerChan³', bark:'Bark', meow:'MEOW', enableChannel:'Enable this channel', apiUrl:'Complete API URL (recommended)', apiUrlDesc:'Paste the ServerChan³ API URL, or use UID and SendKey below.', uid:'UID', sendKey:'SendKey', barkServer:'Bark server URL', barkKey:'Bark Device Key', barkGroup:'Bark group', meowName:'MEOW nickname',
    schedule:'Schedule', scheduleDesc:'Choose when the shared notification should be sent.', daily:'Every day', weekly:'Selected weekdays', monthly:'Selected month days', time:'Delivery times', timeDesc:'Choose one or more times. Each time is sent once per scheduled day.', addTime:'Add time', removeTime:'Remove time', weekdays:'Weekdays', weekdaysDesc:'Comma-separated: 1 = Monday through 7 = Sunday. Example: 1,3,5.', monthDays:'Month days', monthDaysDesc:'Comma-separated dates. Example: 1,15,28.',
    scope:'Task reminder scope', today:'Include tasks due today', todayDesc:'Includes incomplete tasks whose due date is today.', overdue:'Include overdue tasks', overdueDesc:'Includes incomplete tasks due before today.', custom:'Custom reminder body', customDesc:'Optional. Your text is sent unchanged, with the system date and time above it.', customPlaceholder:'For example: Remember to reserve an hour to plan next week.', test:'Test channel', testDesc:'Send a test only through this channel.', sendTest:'Send test', sent:'Test notification sent', failed:'Send failed: '
  } : {
    heading: '消息推送', intro:'可配置一个或多个推送 APP。密钥仅保存在本插件的私有 data.json 中。', enabled:'启用计划提醒', enabledDesc:'Obsidian 运行期间自动检查；每个已启用渠道在同一计划时段仅发送一次。',
    channels:'推送渠道', serverChan:'Server酱³', bark:'Bark', meow:'MEOW', enableChannel:'启用此渠道', apiUrl:'完整 API URL（推荐）', apiUrlDesc:'粘贴 Server酱³ API URL，或使用下方 UID 与 SendKey。', uid:'UID', sendKey:'SendKey', barkServer:'Bark 服务地址', barkKey:'Bark Device Key', barkGroup:'Bark 分组', meowName:'MEOW 昵称',
    schedule:'推送周期', scheduleDesc:'选择各渠道共用的发送时间。', daily:'每天', weekly:'每周指定星期', monthly:'每月指定日期', time:'推送时间', timeDesc:'可选择一个或多个时间点，每个时间点在计划日分别推送一次。', addTime:'添加时间', removeTime:'删除时间', weekdays:'每周提醒日', weekdaysDesc:'用逗号输入：1=周一，…，7=周日。例如 1,3,5。', monthDays:'每月提醒日', monthDaysDesc:'用逗号输入日期，例如 1,15,28。',
    scope:'待办提醒范围', today:'包含今日到期', todayDesc:'推送截止日期为当天的未完成待办。', overdue:'包含已逾期', overdueDesc:'推送截止日期早于当天的未完成待办。', custom:'自定义提醒内容', customDesc:'可选。用户输入内容会原样发送，系统仅在上方附上日期与时间。', customPlaceholder:'例如：今天记得留出一小时整理下周计划。', test:'测试渠道', testDesc:'仅通过此渠道发送测试通知。', sendTest:'发送测试', sent:'测试通知已发送', failed:'发送失败：'
  };
}

async function getServerChanSettingsLanguage(plugin) {
  const data = await plugin.loadData() || {};
  if (data.language) return normalizeLang(data.language);
  return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

class ServerChanService {
  constructor(plugin) { this.plugin = plugin; this._reminderPromise = null; this._schedulerRunning = false; this._config = null; }
  startScheduler() { const check = () => this._runScheduledCheck().catch((e) => console.warn('Cockpit notification scheduler failed', e)); check(); this.plugin.registerInterval(window.setInterval(check, 1000)); }
  async getConfig() { if (this._config) return normalizeServerChanConfig(this._config); const data = await this.plugin.loadData() || {}; this._config = normalizeServerChanConfig(data.serverChan); return normalizeServerChanConfig(this._config); }
  async saveConfig(next, options) {
    const previous = options?.suppressElapsedSlots ? await this.getConfig() : null;
    let normalized = normalizeServerChanConfig(next);
    if (previous) normalized = suppressElapsedNotificationSlots(previous, normalized, window.moment());
    await this.plugin.mutateData((data) => { data.serverChan = normalized; });
    this._config = normalized;
    return normalizeServerChanConfig(this._config);
  }
  async _runScheduledCheck() {
    if (this._schedulerRunning) return;
    this._schedulerRunning = true;
    try {
      const config = await this.getConfig(); const now = window.moment(); const slot = getServerChanScheduleSlot(config, now); const key = slot?.key;
      if (!config.enabled || !isServerChanScheduleDue(config, now) || !key || allEnabledChannelsSent(config, key)) return;
      const data = await this.plugin.loadData() || {}; const todos = await loadTodos(this.plugin.app.vault);
      await this.sendDueReminder(todos || [], data.username || '你', slot);
    } finally { this._schedulerRunning = false; }
  }
  async sendChannel(channelId, title, body) { const config = await this.getConfig(); return sendNotificationChannel(channelId, config.channels[channelId], title, body); }
  async sendDueReminder(todos, username, slot) { if (this._reminderPromise) return this._reminderPromise; this._reminderPromise = this._sendDueReminder(todos, username, slot).finally(() => { this._reminderPromise = null; }); return this._reminderPromise; }
  async _sendDueReminder(todos, username, scheduledSlot) {
    const config = await this.getConfig(); const now = window.moment(); const day = now.clone().startOf('day'); const slot = scheduledSlot || getServerChanScheduleSlot(config, now); const key = slot?.key;
    if (!config.enabled || !isServerChanScheduleDue(config, now) || !key || allEnabledChannelsSent(config, key)) return false;
    const due = (todos || []).filter((todo) => !todo.done && todo.dueDate && ((config.notifyToday && todo.dueDate.isSame(day, 'day')) || (config.notifyOverdue && todo.dueDate.isBefore(day, 'day'))));
    if (!due.length && !config.messageTemplate) return false;
    const name = safeText(username || '你', 80) || '你'; const dateTime = formatServerChanDateTime(now); const todayItems = due.filter((todo) => todo.dueDate.isSame(day, 'day')); const overdueItems = due.filter((todo) => todo.dueDate.isBefore(day, 'day'));
    let title; let body;
    if (config.messageTemplate) { title = name + '，提醒时间到了'; body = dateTime + '\n\n' + config.messageTemplate; }
    else {
      title = todayItems.length && overdueItems.length ? name + '，' + due.length + ' 项待办等你处理' : todayItems.length ? name + '，' + todayItems.length + ' 项待办今天到期' : name + '，' + overdueItems.length + ' 项待办已经逾期';
      const sections = [];
      if (todayItems.length) sections.push('今日到期 · ' + todayItems.length + ' 项\n' + todayItems.map((todo) => '• ' + todo.text + '（截止 ' + todo.dueDate.format('YYYY-MM-DD') + '）').join('\n'));
      if (overdueItems.length) sections.push('已逾期 · ' + overdueItems.length + ' 项\n' + overdueItems.map((todo) => '• ' + todo.text + '（截止 ' + todo.dueDate.format('YYYY-MM-DD') + '）').join('\n'));
      body = name + '，你好！\n\n' + dateTime + '\n\n' + sections.join('\n\n');
    }
    const ids = getEnabledChannels(config).filter((id) => !channelWasSent(config, key, id));
    if (!ids.length) return false;
    const results = await Promise.allSettled(ids.map((id) => sendNotificationChannel(id, config.channels[id], title, body)));
    const attemptedAt = new Date().toISOString(); const records = { ...(config.sentReminders[key] || {}) };
    results.forEach((result, index) => { records[ids[index]] = attemptedAt; if (result.status === 'rejected') console.warn('Cockpit notification failed for ' + ids[index], result.reason?.message || result.reason); });
    config.sentReminders[key] = records; await this.saveConfig(config);
    return results.some((result) => result.status === 'fulfilled');
  }
}

class CockpitServerChanSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; this._displayVersion = 0; }
  async display() {
    const { containerEl } = this; const renderVersion = ++this._displayVersion; containerEl.empty();
    const [config, language] = await Promise.all([this.plugin.serverChan.getConfig(), getServerChanSettingsLanguage(this.plugin)]);
    if (renderVersion !== this._displayVersion) return; containerEl.empty(); const copy = getServerChanSettingsCopy(language); const save = async (options) => {
      const saved = await this.plugin.serverChan.saveConfig(config, options);
      config.time = saved.time; config.times = saved.times; config.sentReminders = saved.sentReminders;
      return saved;
    };
    containerEl.createEl('h2', { text:copy.heading }); containerEl.createEl('p', { text:copy.intro });
    new obsidian.Setting(containerEl).setName(copy.enabled).setDesc(copy.enabledDesc).addToggle((toggle) => toggle.setValue(config.enabled).onChange(async (value) => { config.enabled = value; await save(); }));
    containerEl.createEl('h3', { text:copy.channels });
    const addChannel = (id, fields) => {
      const channel = config.channels[id]; containerEl.createEl('h4', { text:copy[id] });
      new obsidian.Setting(containerEl).setName(copy.enableChannel).setDesc(copy[id]).addToggle((toggle) => toggle.setValue(channel.enabled).onChange(async (value) => { channel.enabled = value; await save(); }));
      fields(channel, save);
      new obsidian.Setting(containerEl).setName(copy.test).setDesc(copy.testDesc).addButton((button) => button.setButtonText(copy.sendTest).onClick(async () => { button.setDisabled(true); try { await this.plugin.serverChan.sendChannel(id, copy.sent, formatServerChanDateTime(window.moment()) + '\n\n' + copy.sent); new obsidian.Notice(copy.sent); } catch (e) { new obsidian.Notice(copy.failed + (e?.message || 'unknown error')); } finally { button.setDisabled(false); } }));
    };
    addChannel('serverChan', (channel, save) => {
      new obsidian.Setting(containerEl).setName(copy.apiUrl).setDesc(copy.apiUrlDesc).addText((text) => text.setPlaceholder('https://…push.ft07.com/send/….send').setValue(channel.apiUrl).onChange(async (value) => { channel.apiUrl = safeText(value, 500); await save(); }));
      new obsidian.Setting(containerEl).setName(copy.uid).addText((text) => text.setValue(channel.uid).onChange(async (value) => { channel.uid = safeText(value, 32); await save(); }));
      new obsidian.Setting(containerEl).setName(copy.sendKey).addText((text) => { text.inputEl.type = 'password'; return text.setValue(channel.sendKey).onChange(async (value) => { channel.sendKey = safeText(value, 240); await save(); }); });
    });
    addChannel('bark', (channel, save) => {
      new obsidian.Setting(containerEl).setName(copy.barkServer).setDesc('HTTPS only').addText((text) => text.setValue(channel.serverUrl).onChange(async (value) => { channel.serverUrl = safeHttpsBase(value, 'https://api.day.app'); await save(); }));
      new obsidian.Setting(containerEl).setName(copy.barkKey).addText((text) => { text.inputEl.type = 'password'; return text.setValue(channel.deviceKey).onChange(async (value) => { channel.deviceKey = safeText(value, 240); await save(); }); });
      new obsidian.Setting(containerEl).setName(copy.barkGroup).addText((text) => text.setValue(channel.group).onChange(async (value) => { channel.group = safeText(value, 64) || 'cockpit'; await save(); }));
    });
    addChannel('meow', (channel, save) => new obsidian.Setting(containerEl).setName(copy.meowName).addText((text) => text.setValue(channel.nickname).onChange(async (value) => { channel.nickname = safeText(value, 64).replace(/\//g, ''); await save(); })));
    containerEl.createEl('h3', { text:copy.schedule });
    new obsidian.Setting(containerEl).setName(copy.schedule).setDesc(copy.scheduleDesc).addDropdown((dropdown) => dropdown.addOptions({ daily:copy.daily, weekly:copy.weekly, monthly:copy.monthly }).setValue(config.schedule).onChange(async (value) => { config.schedule = value; await save(); this.display(); }));
    const timeSetting = new obsidian.Setting(containerEl).setName(copy.time).setDesc(copy.timeDesc);
    timeSetting.settingEl.addClass(PLUGIN_ID + '-notification-time-setting');
    const timeList = timeSetting.controlEl.createDiv({ cls:PLUGIN_ID + '-notification-time-list' });
    const persistTimes = async (next) => { config.times = normalizeNotificationTimes(next); config.time = config.times[0]; await save({ suppressElapsedSlots:true }); };
    const renderTimes = () => {
      timeList.empty();
      config.times.forEach((time, index) => {
        const row = timeList.createDiv({ cls:PLUGIN_ID + '-notification-time-row' });
        const input = row.createEl('input', { cls:PLUGIN_ID + '-notification-time-input', attr:{type:'time', step:'1', 'aria-label':copy.time + ' ' + (index + 1)} });
        input.value = time;
        input.onchange = async () => {
          const normalized = normalizeNotificationTime(input.value);
          if (!normalized) { input.value = time; return; }
          if (config.times.some((value, itemIndex) => itemIndex !== index && value === normalized)) { input.value = time; return; }
          const next = config.times.slice(); next[index] = normalized; await persistTimes(next); input.value = normalized;
        };
        const remove = row.createEl('button', { cls:PLUGIN_ID + '-notification-time-remove', attr:{type:'button', title:copy.removeTime, 'aria-label':copy.removeTime} });
        remove.disabled = config.times.length <= 1;
        obsidian.setIcon(remove, 'trash-2');
        remove.onclick = async () => { if (config.times.length <= 1) return; await persistTimes(config.times.filter((_, itemIndex) => itemIndex !== index)); renderTimes(); };
      });
      const add = timeList.createEl('button', { cls:PLUGIN_ID + '-notification-time-add', attr:{type:'button'} });
      add.disabled = config.times.length >= 24;
      obsidian.setIcon(add, 'plus'); add.createSpan({ text:copy.addTime });
      add.onclick = async () => { if (config.times.length >= 24) return; await persistTimes([...config.times, suggestNotificationTime(config.times)]); renderTimes(); };
    };
    renderTimes();
    if (config.schedule === 'weekly') new obsidian.Setting(containerEl).setName(copy.weekdays).setDesc(copy.weekdaysDesc).addText((text) => text.setValue(config.weekdays.join(',')).onChange(async (value) => { config.weekdays = normalizeNumberList(value,1,7,SERVERCHAN_DEFAULTS.weekdays); await save(); }));
    if (config.schedule === 'monthly') new obsidian.Setting(containerEl).setName(copy.monthDays).setDesc(copy.monthDaysDesc).addText((text) => text.setValue(config.monthDays.join(',')).onChange(async (value) => { config.monthDays = normalizeNumberList(value,1,31,SERVERCHAN_DEFAULTS.monthDays); await save(); }));
    containerEl.createEl('h3', { text:copy.scope });
    new obsidian.Setting(containerEl).setName(copy.today).setDesc(copy.todayDesc).addToggle((toggle) => toggle.setValue(config.notifyToday).onChange(async (value) => { config.notifyToday = value; await save(); }));
    new obsidian.Setting(containerEl).setName(copy.overdue).setDesc(copy.overdueDesc).addToggle((toggle) => toggle.setValue(config.notifyOverdue).onChange(async (value) => { config.notifyOverdue = value; await save(); }));
    new obsidian.Setting(containerEl).setName(copy.custom).setDesc(copy.customDesc).addTextArea((text) => text.setPlaceholder(copy.customPlaceholder).setValue(config.messageTemplate).onChange(async (value) => { config.messageTemplate = safeText(value,4000); await save(); }));
  }
}
