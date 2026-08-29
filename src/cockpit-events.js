// cockpit-events.js — 插件内部轻量事件总线：让数据层（待办保存、番茄钟提交）
// 与自动化服务（定时任务的事件触发器）解耦。
// 设计约束：极小、无依赖、处理器异常绝不影响事件源；只用于插件内部信号，
// 不承载库内文件事件（文件事件直接挂宿主 vault 事件，带防抖与生命周期管理）。

const cockpitEventListeners = new Map();

function cockpitOn(eventName, handler) {
  const name = String(eventName || '');
  if (!name || typeof handler !== 'function') return () => {};
  if (!cockpitEventListeners.has(name)) cockpitEventListeners.set(name, new Set());
  cockpitEventListeners.get(name).add(handler);
  return () => cockpitOff(name, handler);
}

function cockpitOff(eventName, handler) {
  const bucket = cockpitEventListeners.get(String(eventName || ''));
  if (bucket) bucket.delete(handler);
}

function cockpitEmit(eventName, payload) {
  const bucket = cockpitEventListeners.get(String(eventName || ''));
  if (!bucket || !bucket.size) return;
  Array.from(bucket).forEach((handler) => {
    try { handler(payload); } catch (error) { console.warn('Cockpit event handler failed: ' + eventName, error); }
  });
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { cockpitOn, cockpitOff, cockpitEmit };
}
