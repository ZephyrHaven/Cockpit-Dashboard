// lan-sync-core.js — 受限数据协议与多版本寄存器；版本向量不依赖设备时钟。
const LAN_SYNC_LIMIT = 1500;
const LAN_SYNC_BYTES = 1024 * 1024;
const LAN_SYNC_PREFS = ['username', 'language'];
function lanSyncObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function lanSyncDevice(value) { return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value); }
function lanSyncBookmark(value) {
  return typeof value === 'string' && value.length <= 500 && !/[\\\r\n\0]/.test(value)
    && !value.startsWith('/') && !value.includes(':') && !value.split('/').some(part => !part || part === '..' || part === '.' || part.startsWith('.'));
}
function lanSyncValue(key, value) {
  if (typeof key !== 'string' || key.length > 520) return false;
  if (key.startsWith('todo:')) {
    const id = key.slice(5);
    return /^[\w-]{1,100}$/.test(id) && (value === null || (typeof value === 'string' && value.length <= 8000
      && !/[\r\n\0]/.test(value) && /^- \[[ x]\] .+/.test(value)
      && value.split('|').some(part => part.trim() === 'id:' + id)));
  }
  if (key.startsWith('bookmark:')) return lanSyncBookmark(key.slice(9)) && (value === null || value === '1');
  if (key === 'pref:username') return value === null || (typeof value === 'string' && value.length <= 80 && !/[\r\n\0]/.test(value));
  if (key === 'pref:language') return value === null || ['en', 'zh-CN'].includes(value);
  return false;
}
function lanSyncValidate(doc) {
  if (!lanSyncObject(doc) || Object.keys(doc).length > LAN_SYNC_LIMIT || JSON.stringify(doc).length > LAN_SYNC_BYTES / 2) throw new Error('同步数据格式或大小不受支持。');
  for (const [key, versions] of Object.entries(doc)) {
    if (!Array.isArray(versions) || !versions.length || versions.length > 16) throw new Error('同步版本数量超限。');
    for (const version of versions) {
      if (!lanSyncObject(version) || !lanSyncValue(key, version.value) || !lanSyncObject(version.clock)) throw new Error('同步数据包含不允许的字段。');
      const entries = Object.entries(version.clock);
      if (!entries.length || entries.length > 16 || entries.some(([id, count]) => !lanSyncDevice(id) || !Number.isSafeInteger(count) || count < 1 || count > 1e12)) throw new Error('同步版本无效。');
    }
  }
  return doc;
}
function lanSyncClock(versions) {
  const clock = {};
  for (const version of versions) for (const [id, count] of Object.entries(version.clock)) clock[id] = Math.max(clock[id] || 0, count);
  return clock;
}
function lanSyncDominates(a, b) {
  return Object.entries(b).every(([id, count]) => (a[id] || 0) >= count)
    && Object.keys(a).some(id => a[id] > (b[id] || 0));
}
function lanSyncVersionKey(version) {
  return JSON.stringify([Object.entries(version.clock).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0), version.value]);
}
function lanSyncMerge(a, b) {
  lanSyncValidate(a); lanSyncValidate(b);
  const result = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const all = [...new Map([...(a[key] || []), ...(b[key] || [])].map(v => [lanSyncVersionKey(v), v])).values()];
    result[key] = all.filter(v => !all.some(other => lanSyncDominates(other.clock, v.clock)))
      .sort((x, y) => lanSyncVersionKey(x) < lanSyncVersionKey(y) ? -1 : lanSyncVersionKey(x) > lanSyncVersionKey(y) ? 1 : 0);
  }
  return lanSyncValidate(result);
}
function lanSyncProjection(doc) {
  const result = {};
  for (const [key, versions] of Object.entries(doc)) {
    // 删除与编辑并发时先显示编辑版；全部分支保留，直到用户选择。
    const chosen = versions.find(v => v.value !== null) || versions[0];
    if (chosen.value !== null) result[key] = chosen.value;
  }
  return result;
}
function lanSyncCapture(doc, before, current, device) {
  const next = { ...doc };
  for (const key of new Set([...Object.keys(before), ...Object.keys(current)])) {
    if ((before[key] ?? null) === (current[key] ?? null)) continue;
    const clock = lanSyncClock(next[key] || []);
    clock[device] = (clock[device] || 0) + 1;
    next[key] = [{ clock, value:current[key] ?? null }];
  }
  return lanSyncValidate(next);
}
function lanSyncConflicts(doc) { return Object.entries(doc).filter(([, versions]) => new Set(versions.map(v => v.value)).size > 1); }
function lanSyncResolve(doc, key, value, device) {
  if (!doc[key]?.some(v => v.value === value)) throw new Error('冲突版本已更新，请重新打开。');
  const clock = lanSyncClock(doc[key]); clock[device] = (clock[device] || 0) + 1;
  return lanSyncValidate({ ...doc, [key]:[{ clock, value }] });
}
function lanSyncPrivateIp(value) {
  if (typeof value !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
  const parts = value.split('.').map(Number);
  if (parts.some((n, i) => n > 255 || String(n) !== value.split('.')[i])) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 169 && parts[1] === 254);
}
function lanSyncParseInvite(text, now = Date.now()) {
  let data;
  try { data = JSON.parse(String(text).trim()); } catch (error) { throw new Error('未识别配对信息，请导入完整二维码或重新复制。'); }
  if (data?.kind !== 'cockpit-lan-v1' || !lanSyncDevice(data.id) || !/^[a-f0-9]{64}$/.test(data.key)
    || !Array.isArray(data.hosts) || !data.hosts.length || data.hosts.length > 8 || !data.hosts.every(lanSyncPrivateIp)
    || !Number.isInteger(data.port) || data.port < 1024 || data.port > 65535
    || !Number.isFinite(data.expires) || data.expires <= now || data.expires > now + 6 * 60 * 1000) throw new Error('配对信息已过期或不是受支持的局域网设备。');
  return data;
}
if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { LAN_SYNC_BYTES, lanSyncValidate, lanSyncMerge, lanSyncProjection, lanSyncCapture, lanSyncConflicts, lanSyncResolve, lanSyncPrivateIp, lanSyncParseInvite, lanSyncBookmark, lanSyncDevice };
}
