// data-store.js — data.json 的统一串行读写入口，避免并发写入互相覆盖。

async function mutatePluginData(plugin, mutator) {
  const previous = plugin._cockpitDataWrite || Promise.resolve();
  const operation = Promise.resolve(previous).catch(() => {}).then(async () => {
    const data = await plugin.loadData() || {};
    await mutator(data);
    await plugin.saveData(data);
    return data;
  });
  plugin._cockpitDataWrite = operation;
  return operation;
}

// 独立源码测试时导出；打包环境已先定义 PLUGIN_ID，因此不会改写插件入口。
if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { mutatePluginData };
}
