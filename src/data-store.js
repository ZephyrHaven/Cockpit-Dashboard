// data-store.js — data.json 的统一串行读写入口，避免并发写入互相覆盖。

async function mutatePluginData(plugin, mutator) {
  const previous = plugin._cockpitDataWrite || Promise.resolve();
  const operation = Promise.resolve(previous).catch(() => {}).then(async () => {
    const data = await plugin.loadData() || {};
    await mutator(data);
    // 内容与上次落盘一致时跳过写入：周期性 tick（闹钟/定时任务等）即使毫无变化
    // 也不再触发全量序列化落盘，避免每天数千次无效磁盘写入。
    let serialized = null;
    try { serialized = JSON.stringify(data); } catch (e) { serialized = null; }
    if (serialized !== null && plugin._cockpitDataSnapshot === serialized) return data;
    await plugin.saveData(data);
    plugin._cockpitDataSnapshot = serialized;
    return data;
  });
  plugin._cockpitDataWrite = operation;
  return operation;
}

// 独立源码测试时导出；打包环境已先定义 PLUGIN_ID，因此不会改写插件入口。
if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { mutatePluginData };
}
