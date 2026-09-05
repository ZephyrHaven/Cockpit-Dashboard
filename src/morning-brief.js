// morning-brief.js — AI 晨间简报：插件级定时服务，把「今日待办 / 逾期 / 习惯 /
// 昨日专注」汇总成一条简报，复用推送渠道（Server酱³ / Bark / MEOW）在早上发到手机。
// 可选调用已配置的 AI 模型生成一句开场总结；未配置或失败时静默回退到纯模板。

const MORNING_BRIEF_DEFAULTS = {
  enabled:false,
  time:'08:30',
  aiPolish:true,
  includeTeamTodos:false,
  includeTodayTodos:true,
  includeOverdue:true,
  includeHabits:true,
  includeFocus:true,
  // 发送记录：'YYYY-MM-DD' -> { channelId: { at, ok, attempts, error } }，只保留近 120 天。
  sent:{}
};

const MORNING_BRIEF_ATTEMPT_CAP = 3;
const MORNING_BRIEF_AI_TIMEOUT_MS = 20000;

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
      ? Object.fromEntries(Object.entries(value).filter(([id]) => NOTIFICATION_CHANNELS[id]).map(([id, stamp]) => [id, stamp && typeof stamp === 'object' ? cleanRecord(stamp) : stamp]))
      : {}]));
}

function normalizeMorningBriefConfig(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled:value.enabled === true,
    time:normalizeMorningBriefTime(value.time),
    aiPolish:value.aiPolish !== false,
    includeTeamTodos:value.includeTeamTodos === true,
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

function briefChannelAttempts(config, key, id) {
  const record = config.sent[key]?.[id];
  if (typeof record === 'string') return 1;
  return Number(record?.attempts) || (record ? 1 : 0);
}

function briefChannelWasSent(config, key, id) {
  const record = config.sent[key]?.[id];
  if (!record) return false;
  if (typeof record === 'string') return true;
  return record.ok === true;
}

function briefAllChannelsSent(config, key, channelIds) {
  return channelIds.length > 0 && channelIds.every((id) => briefChannelWasSent(config, key, id));
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

function buildBriefingMessage({ lang, username, facts, now, aiSummary }) {
  const en = lang === 'en';
  const weekdayNames = en
    ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    : ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const lines = [];
  // 每个视觉块都用 emoji 开头并独立成段：即使通知栏把换行折叠成一行，也能快速扫读。
  lines.push('☀️ ' + (en ? 'Good morning, ' : '早安，') + username + '！');
  lines.push(now.format(en ? 'MMM D' : 'M月D日') + ' · ' + weekdayNames[now.day()]);
  lines.push('');

  const isEmptyDay = !facts.teamTodos?.length && !facts.dueToday.length && !facts.overdue.length && !facts.pendingHabitNames.length;
  if (isEmptyDay) {
    lines.push('🗓 ' + (en ? 'Nothing scheduled today. Enjoy the open day.' : '今天没有排期任务，享受自由的一天。'));
    lines.push('');
  }
  if (facts.dueToday.length) {
    lines.push('📋 ' + (en ? 'Due today · ' : '今日到期 · ') + facts.dueToday.length + (en ? '' : ' 项'));
    facts.dueToday.slice(0, 8).forEach((item) => lines.push('· ' + item.text));
    lines.push('');
  }
  if (facts.overdue.length) {
    lines.push('⚠️ ' + (en ? 'Overdue · ' : '已逾期 · ') + facts.overdue.length + (en ? '' : ' 项'));
    facts.overdue.slice(0, 5).forEach((item) => lines.push('· ' + item.text));
    lines.push('');
  }
  if (facts.teamTodos?.length) {
    lines.push('👥 ' + (en ? 'Team tasks · ' : '团队待办 · ') + facts.teamTodos.length);
    facts.teamTodos.slice(0, 8).forEach(item => lines.push('· ' + item.text + ' · ' + item.dueDate.format('YYYY-MM-DD HH:mm:ss')));
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

  async getConfig() {
    if (this._config) return normalizeMorningBriefConfig(this._config);
    const data = await this.plugin.loadData() || {};
    this._config = normalizeMorningBriefConfig(data.morningBrief);
    return normalizeMorningBriefConfig(this._config);
  }

  async saveConfig(next) {
    const normalized = normalizeMorningBriefConfig(next);
    await this.plugin.mutateData((data) => { data.morningBrief = normalized; });
    this._config = normalized;
    return normalizeMorningBriefConfig(this._config);
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
    const config = await this.getConfig();
    if (!config.enabled || this._sending) return false;
    const now = window.moment();
    if (now.format('HH:mm') < config.time) return false;
    const key = now.format('YYYY-MM-DD');
    const channelConfig = await this.plugin.serverChan.getConfig();
    const ids = getEnabledChannels(channelConfig).filter((id) => !briefChannelWasSent(config, key, id) && briefChannelAttempts(config, key, id) < MORNING_BRIEF_ATTEMPT_CAP);
    if (!ids.length) return false;
    return this.deliver(ids);
  }

  // 手动触发（命令 / 设置页按钮）：忽略时间窗，立即向全部启用渠道发送一次。
  async sendNow() {
    const channelConfig = await this.plugin.serverChan.getConfig();
    const ids = getEnabledChannels(channelConfig);
    if (!ids.length) {
      const language = await getServerChanSettingsLanguage(this.plugin).catch(() => 'zh-CN');
      throw new Error(getMorningBriefSettingsCopy(language).noChannel);
    }
    return this.deliver(ids);
  }

  async deliver(ids) {
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
        records[id] = {
          at:new Date().toISOString(),
          ok:result.status === 'fulfilled',
          attempts:briefChannelAttempts(config, key, id) + 1,
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
  const config = await plugin.morningBrief.getConfig();

  const header = panel.createDiv({ cls:PLUGIN_ID + '-settings-panel-header' });
  header.createEl('h2', { text:copy.heading });
  header.createEl('p', { text:copy.intro });

  const save = () => plugin.morningBrief.saveConfig(config);

  new obs.Setting(panel).setName(copy.enabled).setDesc(copy.enabledDesc)
    .addToggle((toggle) => toggle.setValue(config.enabled).onChange(async (value) => { config.enabled = value; await save(); }));

  new obs.Setting(panel).setName(copy.time)
    .addText((text) => { text.inputEl.type = 'time'; text.setValue(config.time).onChange(async (value) => { config.time = normalizeMorningBriefTime(value); await save(); }); });

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
    const channelConfig = await plugin.serverChan.getConfig();
    const ids = getEnabledChannels(channelConfig);
    const record = current.sent[key] || {};
    const okIds = ids.filter((id) => record[id]?.ok === true || typeof record[id] === 'string');
    const failIds = ids.filter((id) => record[id] && record[id].ok === false);
    let text;
    if (!ids.length) text = copy.noChannel;
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
