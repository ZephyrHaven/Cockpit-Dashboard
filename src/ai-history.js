// ai-history.js — 独立、受限的本地 AI 会话历史；不保存附件正文、RAG 片段、思考过程或工具参数。

const AI_HISTORY_LIMITS = Object.freeze({
  maxSessions:30,
  maxMessagesPerSession:60,
  maxMessageChars:8000,
  maxSessionChars:120000,
  maxSerializedChars:700000,
  maxReadChars:1200000
});

function cleanAiHistoryText(value, maxLength) {
  return String(value || '').replace(/[\0\r]/g, '').trim().slice(0, maxLength);
}

function cleanAiHistoryId(value) {
  return cleanAiHistoryText(value, 100).replace(/[^a-zA-Z0-9_-]/g, '');
}

function isProtectedAiHistoryContextPath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return path === '.obsidian' || path.startsWith('.obsidian/') || path === '.trash' || path.startsWith('.trash/');
}

function cleanAiHistoryContextPaths(value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map((item) => String(item || '')
    .replace(/[\0\r\n]/g, '').replace(/\\/g, '/').replace(/^\/+/, '').trim().slice(0, 1000))
    .filter((item) => item && /\.md$/i.test(item) && !isProtectedAiHistoryContextPath(item)))).slice(0, 12);
}

function createAiHistoryId() {
  if (globalThis.crypto?.randomUUID) return 'chat-' + globalThis.crypto.randomUUID();
  return 'chat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function buildAiSessionTitle(value, language = 'zh-CN') {
  const text = cleanAiHistoryText(value, 500).replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();
  if (!text) return language === 'en' ? 'New chat' : '新对话';
  return text.length > 36 ? text.slice(0, 36).trimEnd() + '…' : text;
}

function normalizeAiHistoryMessage(value) {
  const role = value?.role === 'user' || value?.role === 'assistant' ? value.role : '';
  const content = cleanAiHistoryText(value?.content, AI_HISTORY_LIMITS.maxMessageChars);
  if (!role || !content) return null;
  const createdAt = Math.max(0, Number(value?.createdAt) || Date.now());
  return { role, content, createdAt };
}

function normalizeAiHistorySession(value, index = 0) {
  const fallbackId = 'chat-' + (index + 1);
  const id = cleanAiHistoryId(value?.id) || fallbackId;
  const createdAt = Math.max(0, Number(value?.createdAt) || Date.now());
  const updatedAt = Math.max(createdAt, Number(value?.updatedAt) || createdAt);
  const messages = (Array.isArray(value?.messages) ? value.messages : []).map(normalizeAiHistoryMessage).filter(Boolean)
    .slice(-AI_HISTORY_LIMITS.maxMessagesPerSession);
  let messageChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  while (messages.length > 1 && messageChars > AI_HISTORY_LIMITS.maxSessionChars) {
    messageChars -= messages.shift().content.length;
  }
  if (messages.length && messageChars > AI_HISTORY_LIMITS.maxSessionChars) {
    messages[0].content = messages[0].content.slice(-AI_HISTORY_LIMITS.maxSessionChars);
  }
  return {
    id,
    title:buildAiSessionTitle(value?.title, value?.language),
    createdAt,
    updatedAt,
    profileId:cleanAiHistoryId(value?.profileId),
    contextPaths:cleanAiHistoryContextPaths(value?.contextPaths),
    messages
  };
}

function normalizeAiHistory(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const ids = new Set();
  const sessions = (Array.isArray(raw.sessions) ? raw.sessions : []).map(normalizeAiHistorySession)
    .filter((session) => {
      if (ids.has(session.id)) return false;
      ids.add(session.id);
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, AI_HISTORY_LIMITS.maxSessions);
  let state = { version:1, activeSessionId:cleanAiHistoryId(raw.activeSessionId), sessions };
  if (!sessions.some((session) => session.id === state.activeSessionId)) state.activeSessionId = sessions[0]?.id || '';
  while (state.sessions.length > 1 && JSON.stringify(state).length > AI_HISTORY_LIMITS.maxSerializedChars) state.sessions.pop();
  if (state.sessions.length && JSON.stringify(state).length > AI_HISTORY_LIMITS.maxSerializedChars) {
    const session = state.sessions[0];
    while (session.messages.length > 1 && JSON.stringify(state).length > AI_HISTORY_LIMITS.maxSerializedChars) session.messages.shift();
    if (JSON.stringify(state).length > AI_HISTORY_LIMITS.maxSerializedChars && session.messages[0]) {
      const overflow = JSON.stringify(state).length - AI_HISTORY_LIMITS.maxSerializedChars;
      session.messages[0].content = session.messages[0].content.slice(Math.min(session.messages[0].content.length, overflow + 64));
    }
  }
  return state;
}

class CockpitAIHistoryService {
  constructor(plugin) {
    this.plugin = plugin;
    this._state = null;
    this._write = Promise.resolve();
  }
  get path() {
    const configDir = String(this.plugin?.app?.vault?.configDir || '.obsidian').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const pluginId = typeof PLUGIN_ID === 'string' ? PLUGIN_ID : 'cockpit-dashboard';
    return configDir + '/plugins/' + pluginId + '/ai-history.json';
  }
  async load() {
    if (this._state) return normalizeAiHistory(this._state);
    const adapter = this.plugin?.app?.vault?.adapter;
    try {
      if (!adapter || !(await adapter.exists(this.path))) this._state = normalizeAiHistory({});
      else {
        const content = String(await adapter.read(this.path) || '');
        if (content.length > AI_HISTORY_LIMITS.maxReadChars) throw new Error('AI history file exceeds the safety limit.');
        this._state = normalizeAiHistory(JSON.parse(content));
      }
    } catch (error) {
      console.warn('Cockpit: could not load AI conversation history');
      this._state = normalizeAiHistory({});
    }
    return normalizeAiHistory(this._state);
  }
  async _save(nextState) {
    const normalized = normalizeAiHistory(nextState);
    const operation = this._write.catch(() => {}).then(async () => {
      await this.plugin.app.vault.adapter.write(this.path, JSON.stringify(normalized));
      this._state = normalized;
      return normalizeAiHistory(normalized);
    });
    this._write = operation;
    return operation;
  }
  async create(options = {}) {
    const state = await this.load();
    state.sessions = state.sessions.filter((session) => session.messages.length);
    const now = Date.now();
    const session = normalizeAiHistorySession({
      id:createAiHistoryId(),
      title:options.title || (options.language === 'en' ? 'New chat' : '新对话'),
      language:options.language,
      profileId:options.profileId,
      contextPaths:options.contextPaths,
      createdAt:now,
      updatedAt:now,
      messages:[]
    });
    state.sessions.unshift(session);
    state.activeSessionId = session.id;
    await this._save(state);
    return session;
  }
  async setActive(sessionId) {
    const state = await this.load();
    const id = cleanAiHistoryId(sessionId);
    if (!state.sessions.some((session) => session.id === id)) return null;
    state.activeSessionId = id;
    await this._save(state);
    return state.sessions.find((session) => session.id === id) || null;
  }
  async appendMessage(sessionId, message) {
    const state = await this.load();
    const session = state.sessions.find((item) => item.id === cleanAiHistoryId(sessionId));
    const normalizedMessage = normalizeAiHistoryMessage(message);
    if (!session || !normalizedMessage) return null;
    session.messages.push(normalizedMessage);
    if (session.messages.length > AI_HISTORY_LIMITS.maxMessagesPerSession) session.messages = session.messages.slice(-AI_HISTORY_LIMITS.maxMessagesPerSession);
    if (normalizedMessage.role === 'user' && (!session.title || session.title === '新对话' || session.title === 'New chat')) {
      session.title = buildAiSessionTitle(normalizedMessage.content, message?.language);
    }
    session.updatedAt = Date.now();
    state.activeSessionId = session.id;
    await this._save(state);
    return normalizeAiHistorySession(session);
  }
  async update(sessionId, patch = {}) {
    const state = await this.load();
    const session = state.sessions.find((item) => item.id === cleanAiHistoryId(sessionId));
    if (!session) return null;
    if (Object.prototype.hasOwnProperty.call(patch, 'title')) session.title = buildAiSessionTitle(patch.title, patch.language);
    if (Object.prototype.hasOwnProperty.call(patch, 'profileId')) session.profileId = cleanAiHistoryId(patch.profileId);
    if (Object.prototype.hasOwnProperty.call(patch, 'contextPaths')) session.contextPaths = cleanAiHistoryContextPaths(patch.contextPaths);
    session.updatedAt = Date.now();
    await this._save(state);
    return normalizeAiHistorySession(session);
  }
  async rename(sessionId, title, language) { return this.update(sessionId, { title, language }); }
  async remove(sessionId) {
    const state = await this.load();
    const id = cleanAiHistoryId(sessionId);
    state.sessions = state.sessions.filter((session) => session.id !== id);
    if (state.activeSessionId === id) state.activeSessionId = state.sessions[0]?.id || '';
    return this._save(state);
  }
  async clear() { return this._save({ version:1, activeSessionId:'', sessions:[] }); }
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { AI_HISTORY_LIMITS, buildAiSessionTitle, normalizeAiHistory, CockpitAIHistoryService };
}
