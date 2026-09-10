// morning-brief.js — AI 晨间简报：插件级定时服务，把「今日待办 / 逾期 / 习惯 /
// 昨日专注」汇总成一条简报，复用推送渠道（Server酱³ / Bark / MEOW）在早上发到手机。
// 可选调用已配置的 AI 模型生成一句开场总结；未配置或失败时静默回退到纯模板。

const MORNING_BRIEF_DEFAULTS = {
  enabled:false,
  time:'08:30',
  aiPolish:true,
  deliveryMode:'selected-device',
  senderDeviceId:'',
  // 团队待办属于晨间全局概览，默认合并进简报，避免用户再收到一条内容重复的提醒。
  includeTeamTodos:true,
  includeTodayTodos:true,
  includeOverdue:true,
  includeHabits:true,
  includeFocus:true,
  // 发送记录：'YYYY-MM-DD' -> { channelId: { at, ok, attempts, error } }，只保留近 120 天。
  sent:{}
};

const MORNING_BRIEF_ATTEMPT_CAP = 3;
const MORNING_BRIEF_AI_TIMEOUT_MS = 20000;

function normalizeMorningBriefDeviceId(value) {
  const id = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(id) ? id : '';
}

function morningBriefDeviceOptions(state, currentName = '') {
  const devices = [];
  const seen = new Set();
  const add = (id, name, current = false, lastSync = null) => {
    const safeId = normalizeMorningBriefDeviceId(id);
    if (!safeId || seen.has(safeId)) return;
    seen.add(safeId);
    devices.push({ id:safeId, name:String(name || '').trim().slice(0, 60) || (current ? 'This computer' : 'Another computer'), current, lastSync:Number(lastSync) || null });
  };
  add(state?.device, currentName, true);
  (Array.isArray(state?.peers) ? state.peers : []).forEach((peer) => add(peer?.device, peer?.name, false, peer?.lastSync));
  return devices;
}

function morningBriefDefaultSenderId(state) {
  return morningBriefDeviceOptions(state).map((device) => device.id).sort()[0] || '';
}

function morningBriefShouldAutoSend(config, currentDeviceId) {
  const normalized = normalizeMorningBriefConfig(config);
  if (normalized.deliveryMode === 'every-device') return true;
  const localId = normalizeMorningBriefDeviceId(currentDeviceId);
  return !!localId && normalized.senderDeviceId === localId;
}

function morningBriefChannelRecordId(config, channelId, currentDeviceId) {
  const id = String(channelId || '');
  const deviceId = normalizeMorningBriefDeviceId(currentDeviceId);
  return config?.deliveryMode === 'every-device' && deviceId ? id + '@' + deviceId : id;
}

function normalizeMorningBriefTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return MORNING_BRIEF_DEFAULTS.time;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function normalizeMorningBriefSent(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const keep = /^\d{4}-\d{2}-\d{2}$/;
  const cleanRecord = (stamp) => ({
    at:String(stamp?.at || ''), ok:stamp?.ok === true,
    attempts:Math.max(1, Math.min(9, Number(stamp?.attempts) || 1)),
    error:String(stamp?.error || '').slice(0, 200)
  });
  return Object.fromEntries(Object.entries(source).filter(([key]) => keep.test(key)).slice(-120)
    .map(([key, value]) => [key, value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([id]) => {
        const [channelId, deviceId = ''] = id.split('@');
        return !!NOTIFICATION_CHANNELS[channelId] && (!deviceId || !!normalizeMorningBriefDeviceId(deviceId));
      }).map(([id, stamp]) => [id, stamp && typeof stamp === 'object' ? cleanRecord(stamp) : stamp]))
      : {}]));
}

function normalizeMorningBriefConfig(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled:value.enabled === true,
    time:normalizeMorningBriefTime(value.time),
    aiPolish:value.aiPolish !== false,
    deliveryMode:value.deliveryMode === 'every-device' ? 'every-device' : 'selected-device',
    senderDeviceId:normalizeMorningBriefDeviceId(value.senderDeviceId),
    includeTeamTodos:value.includeTeamTodos !== false,
    includeTodayTodos:value.includeTodayTodos !== false,
    includeOverdue:value.includeOverdue !== false,
    includeHabits:value.includeHabits !== false,
    includeFocus:value.includeFocus !== false,
    sent:normalizeMorningBriefSent(value.sent)
  };
}

// 与 _framework 的 focus 日志格式保持一致：date: YYYY-MM-DD\nminutes: N
function parseFocusMinutesByDay(content) {
  const history = new Map();
  const re = /date:\s*(\S+)\s*\nminutes:\s*(\d+)/g;
  let match;
  while ((match = re.exec(String(content || ''))) !== null) {
    history.set(match[1], Number.parseInt(match[2], 10) || 0);
  }
  return history;
}

function briefChannelRecord(config, key, id, currentDeviceId = '') {
  const recordId = morningBriefChannelRecordId(config, id, currentDeviceId);
  return config.sent[key]?.[recordId] || (recordId !== id ? config.sent[key]?.[id] : null);
}

function briefChannelAttempts(config, key, id, currentDeviceId = '') {
  const record = briefChannelRecord(config, key, id, currentDeviceId);
  if (typeof record === 'string') return 1;
  return Number(record?.attempts) || (record ? 1 : 0);
}

function briefChannelWasSent(config, key, id, currentDeviceId = '') {
  const record = briefChannelRecord(config, key, id, currentDeviceId);
  if (!record) return false;
  if (typeof record === 'string') return true;
  return record.ok === true;
}

function briefAllChannelsSent(config, key, channelIds, currentDeviceId = '') {
  return channelIds.length > 0 && channelIds.every((id) => briefChannelWasSent(config, key, id, currentDeviceId));
}

// —— 简报内容组装（纯函数，便于测试与手动预览） ——
function collectBriefingFacts({ todos = [], habits = [], focusHistory = null, now }) {
  const today = now.clone().startOf('day');
  const yesterdayKey = today.clone().subtract(1, 'day').format('YYYY-MM-DD');
  const dueToday = todos.filter((todo) => !todo.done && todo.dueDate && todo.dueDate.isSame(today, 'day'));
  const overdue = todos.filter((todo) => !todo.done && todo.dueDate && todo.dueDate.valueOf() < today.valueOf());
  const pendingHabits = habits.filter((habit) => !(habit.log || []).includes(now.format('YYYY-MM-DD')));
  const monday = now.clone().startOf('isoWeek');
  let weekFocus = 0;
  if (focusHistory && focusHistory.get) {
    let cursor = monday.clone();
    while (cursor.valueOf() <= today.valueOf()) { weekFocus += focusHistory.get(cursor.format('YYYY-MM-DD')) || 0; cursor = cursor.add(1, 'day'); }
  }
  return {
    dueToday:dueToday.map((todo) => ({ text:todo.text, due:todo.dueDate })),
    overdue:overdue.map((todo) => ({ text:todo.text, due:todo.dueDate })),
    pendingHabitNames:pendingHabits.map((habit) => ({ icon:habit.icon || '🔥', name:habit.name })),
    habitTotal:habits.length,
    habitDoneToday:habits.length - pendingHabits.length,
    focusYesterday:(focusHistory && focusHistory.get) ? (focusHistory.get(yesterdayKey) || 0) : 0,
    focusWeek:weekFocus
  };
}

// 没配 AI 或生成失败时的兜底结语：按日期轮换，避免每天重复同一句。
const BRIEFING_CLOSINGS = {
  'zh-CN': [
    '愿你专注当下，收获满满。',
    '把最重要的事，放进精力最好的时段。',
    '完成比完美更重要，慢慢来比较快。',
    '小步前进也是前进，今天也加油。',
    '忙里偷闲，张弛有度。'
  ],
  en: [
    'Stay present, and make it a good one.',
    'Put the most important thing in your best hours.',
    'Done is better than perfect. Ease in.',
    'Small steps still move you forward.',
    'Pace yourself — rest is part of the work.'
  ]
};

function briefingClosing(lang, now) {
  const pool = BRIEFING_CLOSINGS[lang] || BRIEFING_CLOSINGS['zh-CN'];
  return pool[Math.abs(now.dayOfYear()) % pool.length];
}

function formatNotificationDueLabel(todo, lang = 'zh-CN', now = null) {
  const en = lang === 'en';
  if (!todo?.dueDate?.format) return '';
  const time = todo.dueHasTime ? ' ' + todo.dueDate.format('HH:mm') : '';
  if (now && todo.dueDate.isSame?.(now, 'day')) return (en ? 'Today' : '今天') + time;
  const date = todo.dueDate.format(en ? 'MMM D' : 'M月D日') + time;
  if (now && todo.dueDate.isBefore?.(now, 'day')) return (en ? 'Overdue · ' : '已逾期 · ') + date;
  return date;
}

function formatTodoNotificationLine(todo, lang = 'zh-CN', index = 0, now = null, includeDue = false) {
  const due = includeDue ? formatNotificationDueLabel(todo, lang, now) : '';
  return (index + 1) + '. ' + String(todo?.text || '').trim() + (due ? ' — ' + due : '');
}

function formatTeamTodoNotification(todo, lang = 'zh-CN', index = 0, now = null) {
  return formatTodoNotificationLine(todo, lang, index, now, true);
}

function buildBriefingMessage({ lang, username, facts, now, aiSummary }) {
  const en = lang === 'en';
  const weekdayNames = en
    ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    : ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const lines = [];
  // 每个视觉块都用 emoji 开头并独立成段：即使通知栏把换行折叠成一行，也能快速扫读。
  // 标题已经包含问候与待办总数；正文从日期开始，避免在手机通知详情里重复一遍标题。
  lines.push('📅 ' + now.format(en ? 'MMM D' : 'M月D日') + ' · ' + weekdayNames[now.day()]);
  lines.push('');

  const isEmptyDay = !facts.teamTodos?.length && !facts.dueToday.length && !facts.overdue.length && !facts.pendingHabitNames.length;
  if (isEmptyDay) {
    lines.push('🗓 ' + (en ? 'Nothing scheduled today. Enjoy the open day.' : '今天没有排期任务，享受自由的一天。'));
    lines.push('');
  }
  if (facts.dueToday.length) {
    lines.push('📋 ' + (en ? 'Due today · ' : '今日到期 · ') + facts.dueToday.length + (en ? '' : ' 项'));
    lines.push('');
    lines.push(facts.dueToday.slice(0, 8).map((item, index) => formatTodoNotificationLine(item, lang, index, now)).join('\n\n'));
    lines.push('');
  }
  if (facts.overdue.length) {
    lines.push('⚠️ ' + (en ? 'Overdue · ' : '已逾期 · ') + facts.overdue.length + (en ? '' : ' 项'));
    lines.push('');
    lines.push(facts.overdue.slice(0, 5).map((item, index) => formatTodoNotificationLine(item, lang, index, now, true)).join('\n\n'));
    lines.push('');
  }
  if (facts.teamTodos?.length) {
    lines.push('👥 ' + (en ? 'Team tasks · ' : '团队待办 · ') + facts.teamTodos.length + (en ? '' : ' 项'));
    lines.push('');
    lines.push(facts.teamTodos.slice(0, 8).map((item, index) => formatTeamTodoNotification(item, lang, index, now)).join('\n\n'));
    lines.push('');
  }
  if (facts.pendingHabitNames.length && facts.habitTotal > 0) {
    lines.push('🔥 ' + (en ? 'Habits to check in (' : '习惯待打卡（') + facts.habitDoneToday + '/' + facts.habitTotal + (en ? ' done）：' : '）：') + facts.pendingHabitNames.slice(0, 6).map((item) => item.icon + item.name).join('、'));
    lines.push('');
  }
  if (facts.focusYesterday > 0 || facts.focusWeek > 0) {
    lines.push('🍅 ' + (en
      ? 'Focused ' + facts.focusYesterday + ' min yesterday · ' + facts.focusWeek + ' min this week'
      : '昨日专注 ' + facts.focusYesterday + ' 分钟 · 本周累计 ' + facts.focusWeek + ' 分钟'));
    lines.push('');
  }
  // 结语自然收尾：AI 生成的一句话直接作为正文最后一段，不标注来源。
  const closing = String(aiSummary || '').trim() || briefingClosing(lang, now);
  if (closing) lines.push('✨ ' + closing.slice(0, 160));
  return lines.join('\n').trim();
}

function buildBriefingTitle({ lang, username, facts }) {
  const en = lang === 'en';
  const total = facts.dueToday.length + facts.overdue.length + (facts.teamTodos?.length || 0);
  if (!total) return en ? '☀️ ' + username + ', an easy day ahead' : '☀️ 早安 ' + username + '，今天是轻快的一天';
  return en
    ? '☀️ ' + username + ', ' + total + ' task(s) waiting today'
    : '☀️ 早安 ' + username + '，有 ' + total + ' 项待办等你';
}

async function polishBriefingWithAi(plugin, lang, facts) {
  const en = lang === 'en';
  try {
    const config = await plugin.ai.getConfig();
    const profile = typeof getActiveAiProfile === 'function' ? getActiveAiProfile(config) : null;
    if (!profile?.model) return null;
    if (profile.apiKey || profile.apiKeySecret) { try { if (!plugin.ai.getProfileApiKey(profile)) return null; } catch (e) { return null; } }
    const payload = {
      dueToday:facts.dueToday.map((item) => item.text),
      overdueCount:facts.overdue.length,
      habitsPending:facts.pendingHabitNames.map((item) => item.name),
      focusYesterdayMin:facts.focusYesterday,
      focusWeekMin:facts.focusWeek
    };
    const instruction = en
      ? 'You are a concise morning assistant. Based on the JSON facts, write ONE short encouraging sentence (max 40 words) for a morning push notification. No lists, no quotes.'
      : '你是晨间助手。根据 JSON 数据写一句不超过 40 字的晨间鼓励语，用于推送通知。只输出这一句话，不要列表和引号。';
    const question = instruction + '\n' + JSON.stringify(payload);
    const result = await Promise.race([
      plugin.ai.complete({ question, language:lang }),
      new Promise((resolve) => setTimeout(() => resolve(null), MORNING_BRIEF_AI_TIMEOUT_MS))
    ]);
    const text = String(result || '').trim().replace(/^["“]|["”]$/g, '');
    return text ? text.slice(0, 160) : null;
  } catch (e) {
    console.warn('Cockpit morning brief AI polish skipped:', e?.message || e);
    return null;
  }
}

class CockpitMorningBriefService {
  constructor(plugin) { this.plugin = plugin; this._config = null; this._sending = false; }

  startScheduler() {
    const check = () => this.check().catch((e) => console.warn('Cockpit morning brief scheduler failed', e));
    check();
    this.plugin.registerInterval(window.setInterval(check, 30000));
  }

  async getConfig(options = {}) {
    if (!options.fresh && this._config) return normalizeMorningBriefConfig(this._config);
    const data = await this.plugin.loadData() || {};
    this._config = normalizeMorningBriefConfig(data.morningBrief);
    return normalizeMorningBriefConfig(this._config);
  }

  async saveConfig(next) {
    const previous = await this.getConfig();
    const normalized = normalizeMorningBriefConfig(next);
    await this.plugin.mutateData((data) => { data.morningBrief = normalized; });
    this._config = normalized;
    if (previous.deliveryMode !== normalized.deliveryMode || previous.senderDeviceId !== normalized.senderDeviceId) {
      Promise.resolve().then(() => this.plugin.lanSync?.sync?.()).catch((e) => console.warn('Cockpit morning brief routing sync failed', e));
    }
    return normalizeMorningBriefConfig(this._config);
  }

  async getRouting(config = null, options = {}) {
    let resolved = normalizeMorningBriefConfig(config || await this.getConfig());
    let state = null;
    try {
      await this.plugin.lanSync?.store?.load?.();
      state = this.plugin.lanSync?.store?.state || null;
    } catch (e) { state = null; }
    let currentName = '';
    try { currentName = require('os').hostname(); } catch (e) {}
    const devices = morningBriefDeviceOptions(state, currentName);
    const currentDeviceId = normalizeMorningBriefDeviceId(state?.device);
    if (resolved.deliveryMode === 'selected-device' && !resolved.senderDeviceId && currentDeviceId) {
      resolved.senderDeviceId = morningBriefDefaultSenderId(state) || currentDeviceId;
      if (options.persistDefault !== false) resolved = await this.saveConfig(resolved);
    }
    return { config:resolved, devices, currentDeviceId, shouldSend:morningBriefShouldAutoSend(resolved, currentDeviceId) };
  }

  // 组装简报内容；独立出来便于设置页「预览」。
  async assemble() {
    const [config, channelConfig] = await Promise.all([this.getConfig(), this.plugin.serverChan.getConfig()]);
    let language = 'zh-CN';
    try { language = await getServerChanSettingsLanguage(this.plugin); } catch (e) {}
    const en = language === 'en';
    const data = await this.plugin.loadData() || {};
    const username = String(data.username || '').trim() || (en ? 'there' : '你');
    const now = window.moment();
    const [todos, habits] = await Promise.all([
      loadTodos(this.plugin.app.vault).catch(() => []),
      loadHabits(this.plugin.app.vault).catch(() => [])
    ]);
    let focusHistory = null;
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(FOCUS_FILE);
      if (file) focusHistory = parseFocusMinutesByDay(await this.plugin.app.vault.read(file));
    } catch (e) { focusHistory = null; }

    const facts = collectBriefingFacts({
      todos:todos || [],
      habits:config.includeHabits ? (habits || []) : [],
      focusHistory:config.includeFocus ? focusHistory : null,
      now
    });
    if (!config.includeTodayTodos) facts.dueToday = [];
    if (!config.includeOverdue) facts.overdue = [];

    facts.teamTodos = config.includeTeamTodos && this.plugin.teamSync
      ? (await this.plugin.teamSync.notificationTodos()).filter(todo => !todo.done &&
        (todo.dueDate.isSame(now, 'day') || todo.dueDate.isBefore(now, 'day'))) : [];

    let aiSummary = null;
    if (config.aiPolish && this.plugin.ai) aiSummary = await polishBriefingWithAi(this.plugin, language, facts);

    return {
      title:buildBriefingTitle({ lang:language, username, facts }),
      body:buildBriefingMessage({ lang:language, username, facts, now, aiSummary }),
      channelIds:getEnabledChannels(channelConfig),
      usedAi:!!aiSummary
    };
  }

  // 定时触发路径：开关 + 时间窗 + 每渠道一次/有限重试。
  async check() {
    const config = await this.getConfig({ fresh:true });
    if (!config.enabled || this._sending) return false;
    const now = window.moment();
    if (now.format('HH:mm') < config.time) return false;
    const routing = await this.getRouting(config);
    if (!routing.shouldSend) return false;
    const key = now.format('YYYY-MM-DD');
    const channelConfig = await this.plugin.serverChan.getConfig();
    const ids = getEnabledChannels(channelConfig).filter((id) => !briefChannelWasSent(config, key, id, routing.currentDeviceId) && briefChannelAttempts(config, key, id, routing.currentDeviceId) < MORNING_BRIEF_ATTEMPT_CAP);
    if (!ids.length) return false;
    return this.deliver(ids, { currentDeviceId:routing.currentDeviceId });
  }

  // 手动触发（命令 / 设置页按钮）：忽略时间窗，立即向全部启用渠道发送一次。
  async sendNow() {
    const channelConfig = await this.plugin.serverChan.getConfig();
    const ids = getEnabledChannels(channelConfig);
    if (!ids.length) {
      const language = await getServerChanSettingsLanguage(this.plugin).catch(() => 'zh-CN');
      throw new Error(getMorningBriefSettingsCopy(language).noChannel);
    }
    const routing = await this.getRouting();
    return this.deliver(ids, { currentDeviceId:routing.currentDeviceId });
  }

  async deliver(ids, options = {}) {
    if (this._sending) return false;
    this._sending = true;
    try {
      const brief = await this.assemble();
      if (!brief.channelIds.length) return false;
      const targets = ids.filter((id) => brief.channelIds.includes(id));
      if (!targets.length) return false;
      const channelConfig = await this.plugin.serverChan.getConfig();
      const results = await Promise.allSettled(targets.map((id) => sendNotificationChannel(id, channelConfig.channels[id], brief.title, brief.body)));
      const config = await this.getConfig();
      const key = window.moment().format('YYYY-MM-DD');
      const records = { ...(config.sent[key] || {}) };
      results.forEach((result, index) => {
        const id = targets[index];
        const recordId = morningBriefChannelRecordId(config, id, options.currentDeviceId);
        records[recordId] = {
          at:new Date().toISOString(),
          ok:result.status === 'fulfilled',
          attempts:briefChannelAttempts(config, key, id, options.currentDeviceId) + 1,
          error:result.status === 'fulfilled' ? '' : String(result.reason?.message || result.reason || 'send failed').slice(0, 200)
        };
        if (result.status === 'rejected') console.warn('Cockpit morning brief failed for ' + id, result.reason?.message || result.reason);
      });
      config.sent = normalizeMorningBriefSent({ ...(config.sent || {}), [key]:records });
      await this.saveConfig(config);
      return results.some((result) => result.status === 'fulfilled');
    } finally { this._sending = false; }
  }
}

function getMorningBriefSettingsCopy(language) {
  const en = language === 'en';
  return {
    heading:en ? 'Morning brief' : '晨间简报',
    intro:en ? 'A daily digest of tasks, habits and focus time, pushed to your phone at a set time. Delivery channels are shared with message notifications.' : '每天定时把「今日待办 / 逾期 / 习惯 / 专注」汇总推送到手机。推送渠道与消息推送共用配置。',
    enabled:en ? 'Enable morning brief' : '启用晨间简报',
    enabledDesc:en ? 'Sends automatically while the app is running; each channel receives one brief per day.' : '应用运行期间自动检查；每个已启用渠道每天最多收到一条简报。',
    time:en ? 'Send time' : '发送时间',
    noChannel:en ? 'No delivery channel is enabled yet. Configure one in the Channels tab first.' : '还没有启用任何推送渠道，请先在「推送渠道」里配置。',
    sections:en ? 'Brief contents' : '简报内容',
    todayTodos:en ? 'Include tasks due today' : '包含今日到期待办',
    overdue:en ? 'Include overdue tasks' : '包含已逾期任务',
    habits:en ? 'Include habit check-in status' : '包含习惯打卡情况',
    focus:en ? 'Include focus statistics' : '包含专注统计',
    routing:en ? 'Multi-device delivery' : '多设备发送',
    routingDesc:en ? 'Choose one paired computer to prevent duplicate briefs, or keep delivery from every computer.' : '指定一台已配对设备可避免重复晨报，也可以保留每台设备都发送。',
    selectedDevice:en ? 'Send from a selected computer' : '指定设备发送',
    everyDevice:en ? 'Send from every computer' : '所有设备都发送',
    senderDevice:en ? 'Sending computer' : '发送设备',
    senderDeviceDesc:en ? 'Pair another computer under Nearby devices before selecting it here.' : '需要选择其他电脑时，请先在“附近设备”中完成配对。',
    aiPolish:en ? 'AI opening line' : 'AI 开场小结',
    aiPolishDesc:en ? 'Adds one AI-written sentence on top of the template. Configure a model in “AI models” first; falls back silently when unavailable.' : '在模板上方追加一句 AI 生成的总结。需先在「AI 模型」里完成配置；不可用时自动跳过，不影响发送。',
    test:en ? 'Preview & send now' : '立即预览发送',
    testDesc:en ? 'Assemble a brief immediately and deliver it through all enabled channels.' : '立即组装一条简报并通过所有启用渠道发送。',
    sending:en ? 'Sending…' : '发送中…',
    sentOk:en ? 'Morning brief sent' : '晨间简报已发送',
    sentFail:en ? 'Send failed: ' : '发送失败：',
    statusPrefix:en ? 'Today: ' : '今日：'
  };
}

// 嵌入现有 Cockpit 设置页的「晨间简报」面板。
async function renderMorningBriefSettings(panel, plugin, language) {
  const copy = getMorningBriefSettingsCopy(language);
  const en = language === 'en';
  let config = await plugin.morningBrief.getConfig();
  let routing = await plugin.morningBrief.getRouting(config);
  config = routing.config;

  const header = panel.createDiv({ cls:PLUGIN_ID + '-settings-panel-header' });
  header.createEl('h2', { text:copy.heading });
  header.createEl('p', { text:copy.intro });

  const save = () => plugin.morningBrief.saveConfig(config);

  new obs.Setting(panel).setName(copy.enabled).setDesc(copy.enabledDesc)
    .addToggle((toggle) => toggle.setValue(config.enabled).onChange(async (value) => { config.enabled = value; await save(); }));

  new obs.Setting(panel).setName(copy.time)
    .addText((text) => { text.inputEl.type = 'time'; text.setValue(config.time).onChange(async (value) => { config.time = normalizeMorningBriefTime(value); await save(); }); });

  let senderDropdown = null;
  new obs.Setting(panel).setName(copy.routing).setDesc(copy.routingDesc)
    .addDropdown((dropdown) => dropdown.addOptions({ 'selected-device':copy.selectedDevice, 'every-device':copy.everyDevice }).setValue(config.deliveryMode).onChange(async (value) => {
      config.deliveryMode = value; await save(); senderDropdown?.setDisabled(value === 'every-device');
    }));
  const senderSetting = new obs.Setting(panel).setName(copy.senderDevice).setDesc(copy.senderDeviceDesc);
  senderSetting.addDropdown((dropdown) => {
    senderDropdown = dropdown;
    const options = {};
    routing.devices.forEach((device) => { options[device.id] = device.name + (device.current ? (en ? ' (this computer)' : '（本机）') : ''); });
    if (config.senderDeviceId && !options[config.senderDeviceId]) options[config.senderDeviceId] = en ? 'Previously selected computer (not paired)' : '原发送设备（当前未配对）';
    if (!Object.keys(options).length) options[''] = en ? 'Device identity unavailable' : '设备身份不可用';
    dropdown.addOptions(options).setValue(config.senderDeviceId).setDisabled(config.deliveryMode === 'every-device').onChange(async (value) => {
      config.senderDeviceId = normalizeMorningBriefDeviceId(value); await save();
    });
  });

  panel.createDiv({ cls:PLUGIN_ID + '-settings-panel-header' }).createEl('h3', { text:copy.sections });
  new obs.Setting(panel).setName(en ? 'Team tasks' : '团队待办').setDesc(en ? 'Include visible team tasks due today or overdue.' : '包含当前设备有权查看的今日到期、逾期团队待办。')
    .addToggle(toggle => toggle.setValue(config.includeTeamTodos).onChange(async value => { config.includeTeamTodos = value; await save(); }));
  new obs.Setting(panel).setName(copy.todayTodos).addToggle((toggle) => toggle.setValue(config.includeTodayTodos).onChange(async (value) => { config.includeTodayTodos = value; await save(); }));
  new obs.Setting(panel).setName(copy.overdue).addToggle((toggle) => toggle.setValue(config.includeOverdue).onChange(async (value) => { config.includeOverdue = value; await save(); }));
  new obs.Setting(panel).setName(copy.habits).addToggle((toggle) => toggle.setValue(config.includeHabits).onChange(async (value) => { config.includeHabits = value; await save(); }));
  new obs.Setting(panel).setName(copy.focus).addToggle((toggle) => toggle.setValue(config.includeFocus).onChange(async (value) => { config.includeFocus = value; await save(); }));
  new obs.Setting(panel).setName(copy.aiPolish).setDesc(copy.aiPolishDesc)
    .addToggle((toggle) => toggle.setValue(config.aiPolish).onChange(async (value) => { config.aiPolish = value; await save(); }));

  const status = panel.createDiv({ cls:PLUGIN_ID + '-brief-status' });
  const renderStatus = async () => {
    status.empty();
    const key = window.moment().format('YYYY-MM-DD');
    const current = await plugin.morningBrief.getConfig();
    routing = await plugin.morningBrief.getRouting(current, { persistDefault:false });
    const channelConfig = await plugin.serverChan.getConfig();
    const ids = getEnabledChannels(channelConfig);
    const okIds = ids.filter((id) => briefChannelWasSent(current, key, id, routing.currentDeviceId));
    const failIds = ids.filter((id) => {
      const record = briefChannelRecord(current, key, id, routing.currentDeviceId);
      return record && record.ok === false;
    });
    let text;
    if (current.deliveryMode === 'selected-device' && !routing.shouldSend) {
      const sender = routing.devices.find((device) => device.id === current.senderDeviceId);
      text = en ? 'This computer will not send · sender: ' + (sender?.name || 'unavailable computer') : '本机不自动发送 · 发送设备：' + (sender?.name || '当前不可用的设备');
    }
    else if (!ids.length) text = copy.noChannel;
    else if (okIds.length === ids.length) text = copy.statusPrefix + (en ? 'sent ✓ (' : '已发送 ✓（') + okIds.map((id) => NOTIFICATION_CHANNELS[id].label).join('、') + '）';
    else if (failIds.length) text = copy.statusPrefix + (en ? 'last attempt failed (' : '最近一次失败（') + failIds.map((id) => NOTIFICATION_CHANNELS[id].label).join('、') + (en ? '), will retry automatically.' : '），稍后会自动重试。');
    else text = copy.statusPrefix + (current.enabled ? (en ? 'scheduled at ' : '计划 ') + current.time : (en ? 'disabled' : '未启用'));
    status.createSpan({ text });
  };

  const actions = new obs.Setting(panel).setName(copy.test).setDesc(copy.testDesc);
  actions.addButton((button) => button.setButtonText(copy.test).onClick(async () => {
    button.setDisabled(true); button.setButtonText(copy.sending);
    try {
      const ok = await plugin.morningBrief.sendNow();
      new obs.Notice(ok ? copy.sentOk : (copy.sentFail + (en ? 'no enabled channel' : '没有可用渠道')));
    } catch (e) {
      new obs.Notice(copy.sentFail + (e?.message || 'unknown error'));
    } finally {
      button.setDisabled(false); button.setButtonText(copy.test);
      renderStatus().catch(() => {});
    }
  }));

  renderStatus().catch((e) => console.warn('Cockpit brief status render failed', e));
}
