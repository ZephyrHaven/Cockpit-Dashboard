// commands.js — 宿主命令注册：命令面板里可绑定快捷键的入口统一在此声明。
// 注册只做「入口声明」，不携带任何默认 shell 命令或个人路径；
// shell 类能力未配置时必须只提示、不执行（见 toolbar-custom 的配置编辑器）。

function registerCockpitCommands(plugin) {
  plugin.addCommand({id:'open-cockpit',name:'打开 Cockpit 驾驶舱',callback:() => plugin._open()});
  plugin.addCommand({
    id:'global-search',
    name:'全局搜索（待办 / 笔记内容 / 文件名）',
    callback:() => {
      const view = plugin.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
      openGlobalSearch(plugin.app, plugin._lang?.() || DEFAULT_LANG, view || null);
      if (!view) plugin._open();
    }
  });
  plugin.addCommand({id:'open-cockpit-ai',name:'打开 Cockpit AI 助手',callback:() => plugin.openAI()});
  plugin.addCommand({
    id:'send-morning-brief',
    name:'发送晨间简报',
    callback:async () => {
      new obs.Notice('📮 正在发送晨间简报…');
      try {
        const ok = await plugin.morningBrief.sendNow();
        new obs.Notice(ok ? '✅ 晨间简报已发送' : '⚠️ 没有已启用的推送渠道，请先在设置里配置');
      } catch (e) {
        new obs.Notice('❌ 晨间简报发送失败：' + (e?.message || 'unknown error'));
      }
    }
  });
  plugin.addCommand({
    id:'export-data-backup',
    name:'导出数据备份（待办/专注/习惯/收藏）',
    callback:async () => {
      try {
        const path = await exportCockpitBackup(plugin);
        new obs.Notice(path ? ('✅ 已备份到 ' + path) : '没有可备份的数据文件。', 8000);
      } catch (e) {
        console.warn('Cockpit backup export failed', e);
        new obs.Notice('❌ 备份失败：' + (e?.message || 'unknown error'));
      }
    }
  });
  plugin.addCommand({
    id:'open-data-migration',
    name:'打开 Cockpit 数据迁移',
    callback:async () => {
      await plugin._open();
      const view = plugin.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
      if (view) openStorageMigration(view);
    }
  });
  // 周报工坊命令（全局两条 + 按用户配置的系统清单动态注册分系统命令）
  refreshWeeklyReportCommands(plugin);
}
