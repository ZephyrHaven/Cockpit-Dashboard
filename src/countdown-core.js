// countdown-core.js — 倒计时纯数据、阈值与到期计算；不依赖宿主 API 或 DOM。

const COUNTDOWN_MAX_ITEMS = 50;
const COUNTDOWN_MAX_THRESHOLDS = 8;
const COUNTDOWN_MAX_DELIVERY_ATTEMPTS = 3;
const COUNTDOWN_CHANNEL_IDS = ['serverChan', 'bark', 'meow', 'email'];
const COUNTDOWN_DURATION_UNITS = { minutes:60000, hours:3600000, days:86400000 };

function countdownId() {
  try { return 'countdown-' + globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16); } catch (e) {}
  return 'countdown-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function normalizeCountdownThreshold(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const mode = raw.mode === 'duration' ? 'duration' : raw.mode === 'percent' ? 'percent' : null;
  const value = Number(raw.value);
  if (!mode || !Number.isFinite(value) || value <= 0) return null;
  if (mode === 'percent' && value > 100) return null;
  const unit = Object.prototype.hasOwnProperty.call(COUNTDOWN_DURATION_UNITS, raw.unit) ? raw.unit : 'hours';
  const id = String(raw.id || 'threshold-' + (index + 1)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'threshold-' + (index + 1);
  return { id, mode, value:Math.round(value * 100) / 100, unit:mode === 'duration' ? unit : 'percent' };
}

function normalizeCountdownDeliveries(raw, thresholdIds) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const validKeys = new Set(['finished', ...thresholdIds.map((id) => 'threshold:' + id)]);
  const validChannels = new Set([...COUNTDOWN_CHANNEL_IDS, 'local', 'event']);
  const result = {};
  Object.entries(source).forEach(([eventKey, records]) => {
    if (!validKeys.has(eventKey) || !records || typeof records !== 'object' || Array.isArray(records)) return;
    const cleaned = {};
    Object.entries(records).forEach(([channelId, record]) => {
      if (!validChannels.has(channelId) || !record || typeof record !== 'object') return;
      const attempts = Math.max(1, Math.min(COUNTDOWN_MAX_DELIVERY_ATTEMPTS, Math.round(Number(record.attempts) || 1)));
      const at = Number.isFinite(Date.parse(record.at || '')) ? new Date(record.at).toISOString() : new Date().toISOString();
      cleaned[channelId] = { ok:record.ok === true, attempts, at, error:String(record.error || '').slice(0, 240) };
    });
    if (Object.keys(cleaned).length) result[eventKey] = cleaned;
  });
  return result;
}

function normalizeCountdown(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 100);
  const start = new Date(raw.startAt || '');
  const target = new Date(raw.targetAt || '');
  if (!name || !Number.isFinite(start.getTime()) || !Number.isFinite(target.getTime()) || target.getTime() <= start.getTime()) return null;
  const id = String(raw.id || countdownId()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || countdownId();
  const seenThresholds = new Set();
  const thresholds = (Array.isArray(raw.thresholds) ? raw.thresholds : [])
    .slice(0, COUNTDOWN_MAX_THRESHOLDS)
    .map(normalizeCountdownThreshold)
    .filter((item) => item && !seenThresholds.has(item.id) && (seenThresholds.add(item.id), true));
  const channelIds = Array.from(new Set((Array.isArray(raw.channelIds) ? raw.channelIds : [])
    .filter((item) => COUNTDOWN_CHANNEL_IDS.includes(item))));
  return {
    id, name, enabled:raw.enabled !== false,
    startAt:start.toISOString(), targetAt:target.toISOString(),
    thresholds, channelIds,
    localNotification:raw.localNotification !== false,
    notifyAtEnd:raw.notifyAtEnd !== false,
    deliveries:normalizeCountdownDeliveries(raw.deliveries, thresholds.map((item) => item.id)),
    createdAt:Number.isFinite(Date.parse(raw.createdAt || '')) ? new Date(raw.createdAt).toISOString() : new Date().toISOString()
  };
}

function normalizeCountdowns(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, COUNTDOWN_MAX_ITEMS).map(normalizeCountdown).filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id); return true;
  });
}

function countdownThresholdMs(threshold, totalMs) {
  if (!threshold || !Number.isFinite(totalMs) || totalMs <= 0) return 0;
  if (threshold.mode === 'percent') return totalMs * Math.max(0, Math.min(100, Number(threshold.value) || 0)) / 100;
  return (COUNTDOWN_DURATION_UNITS[threshold.unit] || COUNTDOWN_DURATION_UNITS.hours) * Math.max(0, Number(threshold.value) || 0);
}

function countdownState(raw, nowValue = Date.now()) {
  const countdown = normalizeCountdown(raw);
  if (!countdown) return null;
  const nowMs = new Date(nowValue).getTime();
  const startMs = new Date(countdown.startAt).getTime();
  const targetMs = new Date(countdown.targetAt).getTime();
  const totalMs = targetMs - startMs;
  const remainingMs = Math.max(0, targetMs - nowMs);
  const elapsedMs = Math.max(0, Math.min(totalMs, nowMs - startMs));
  return { totalMs, remainingMs, elapsedMs, progress:Math.max(0, Math.min(100, Math.round(elapsedMs / totalMs * 100))), started:nowMs >= startMs, finished:nowMs >= targetMs };
}

function pendingCountdownChannels(countdown, eventKey, availableChannelIds) {
  const records = countdown.deliveries[eventKey] || {};
  const allowed = new Set(countdown.channelIds);
  return (Array.isArray(availableChannelIds) ? availableChannelIds : []).filter((id) => {
    if (!allowed.has(id)) return false;
    const record = records[id];
    return !record?.ok && (Number(record?.attempts) || 0) < COUNTDOWN_MAX_DELIVERY_ATTEMPTS;
  });
}

function dueCountdownEvent(raw, nowValue = Date.now(), availableChannelIds = COUNTDOWN_CHANNEL_IDS) {
  const countdown = normalizeCountdown(raw);
  if (!countdown || !countdown.enabled) return null;
  const state = countdownState(countdown, nowValue);
  if (!state?.started) return null;
  let kind = 'threshold'; let threshold = null; let eventKey = '';
  if (state.finished) {
    kind = 'finished'; eventKey = 'finished';
  } else {
    const crossed = countdown.thresholds.filter((item) => state.remainingMs <= countdownThresholdMs(item, state.totalMs));
    if (!crossed.length) return null;
    threshold = crossed.reduce((selected, item) => {
      if (!selected) return item;
      return countdownThresholdMs(item, state.totalMs) <= countdownThresholdMs(selected, state.totalMs) ? item : selected;
    }, null);
    eventKey = 'threshold:' + threshold.id;
  }
  const pendingChannelIds = countdown.notifyAtEnd || kind !== 'finished' ? pendingCountdownChannels(countdown, eventKey, availableChannelIds) : [];
  const localRecord = countdown.deliveries[eventKey]?.local;
  const localPending = (countdown.notifyAtEnd || kind !== 'finished') && countdown.localNotification && !localRecord?.ok && (Number(localRecord?.attempts) || 0) < COUNTDOWN_MAX_DELIVERY_ATTEMPTS;
  const eventRecord = countdown.deliveries[eventKey]?.event;
  const eventPending = !eventRecord?.ok && (Number(eventRecord?.attempts) || 0) < COUNTDOWN_MAX_DELIVERY_ATTEMPTS;
  if (!pendingChannelIds.length && !localPending && !eventPending) return null;
  return { countdown, kind, threshold, eventKey, state, pendingChannelIds, localPending, eventPending };
}

function formatCountdownRemaining(ms, language = 'zh-CN') {
  const en = language === 'en';
  let seconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  const parts = [];
  if (days) parts.push(en ? days + ' day' + (days === 1 ? '' : 's') : days + '天');
  if (hours && parts.length < 2) parts.push(en ? hours + ' hr' : hours + '小时');
  if (minutes && parts.length < 2) parts.push(en ? minutes + ' min' : minutes + '分钟');
  if (!parts.length) parts.push(en ? seconds + ' sec' : seconds + '秒');
  return parts.join(en ? ' ' : '');
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { COUNTDOWN_CHANNEL_IDS, COUNTDOWN_MAX_DELIVERY_ATTEMPTS, normalizeCountdownThreshold, normalizeCountdown, normalizeCountdowns, countdownThresholdMs, countdownState, dueCountdownEvent, formatCountdownRemaining };
}
