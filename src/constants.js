// constants.js — 全局常量（纯数据，无函数）

const VIEW_TYPE = 'cockpit-dashboard';
const PLUGIN_ID = 'cockpit-dashboard';
const TODO_FILE = '_data/todos.md';
const BOOKMARK_FILE = '_data/bookmarks.md';
const DEFAULT_LANG = 'zh-CN';
const LANG_OPTIONS = [
  { code: 'zh-CN', label: '中文', short: '中文' },
  { code: 'en', label: 'English', short: 'EN' }
];

const E = { wave:'👋', search:'🔍', tag:'🏷️', graph:'🕸️', bolt:'⚡', folder:'📂', rule:'📋', gear:'⚙️', robot:'🤖', box:'📦', chart:'📊', pencil:'✏️', check:'✅', save:'💾', edit:'✏️', del:'✕', cal:'📅' };
const COLORS = ['#818cf8','#f59e0b','#3b82f6','#22c55e','#ec4899','#14b8a6','#f97316','#6366f1'];
const ICONS  = ['📁','📂','🗂️','📋','📌','🏷️','🔖','📊'];
const I18N = {
  'zh-CN': {
    sections: {
      cats: '📂 知识分类',
      todos: '✅ 待办事项',
      stats: '📊 统计进度',
      recent: '✏️ 最近更新',
      bookmarks: '⭐ 收藏文件',
      flash: '⚡ 闪念胶囊',
      focusChart: '🍅 专注趋势',
      alarms: '⏰ 闹钟',
      scheduledTasks: '⏱ 定时任务',
      heatmap: '📈 编辑热力图（近30天）'
    },
    greetings: {
      morning: '早上好',
      noon: '中午好',
      afternoon: '下午好',
      evening: '晚上好',
      night: '夜深了'
    },
    hero: {
      defaultName: '点击修改名称',
      today: ({ date }) => '今天是 ' + date,
      dueTodos: ({ overdue, today, tomorrow }) => [
        overdue ? '已逾期 ' + overdue + ' 项' : '',
        today ? '今日到期 ' + today + ' 项' : '',
        tomorrow ? '明日到期 ' + tomorrow + ' 项' : ''
      ].filter(Boolean).join(' · '),
      vaultDays: ({ days }) => '• 知识库已陪伴你 ' + days + ' 天',
      language: '界面语言'
    },
    tip: {
      label: '每日一语'
    },
    toolbar: {
      new: '新建笔记',
      search: '搜索',
      tag: '标签',
      graph: '图谱',
      command: '命令',
      more: '更多',
      hermes: 'Hermes',
      cockpit: '驾驶舱',
      workLog: '工作日志',
      pomodoro: '番茄钟'
    },
    search: {
      placeholder: '输入关键词搜索笔记...'
    },
    contextMenu: {
      refreshPage: '刷新页面',
      newNote: '新建笔记',
      searchNotes: '搜索笔记',
      commandPalette: '命令面板',
      openGraph: '打开图谱',
      startPomodoro: '启动番茄钟',
      releaseNotes: '最近更新记录'
    },
    layout: {
      edit: '编辑模式',
      done: '完成编辑',
      editHint: '进入编辑模式后可上下拖动模块排序',
      doneHint: '退出编辑模式',
      dragHandle: ({ module }) => '拖动排序：' + module,
      hide: '隐藏',
      show: '显示',
      hiddenTag: '已隐藏',
      hideModule: ({ module }) => '隐藏模块：' + module,
      showModule: ({ module }) => '显示模块：' + module,
      hideToolbarButton: ({ button }) => '隐藏按钮：' + button,
      showToolbarButton: ({ button }) => '显示按钮：' + button,
      modules: {
        hero: '欢迎区',
        tip: '每日小贴士',
        toolbar: '快捷工具栏',
        alarms: '闹钟',
        calendar: '日历看板',
        focusChart: '专注趋势',
        footer: '页脚'
      }
    },
    notices: {
      hermesStarting: '🤖 Hermes 正在启动…',
      hermesStartingExternal: '🤖 已在外部终端启动 Hermes',
      hermesFallbackExternal: '🤖 已切换到外部终端启动 Hermes',
      hermesFailed: ({ message }) => '🤖 Hermes 启动失败: ' + message,
      cockpitMissing: '🛩️ 驾驶舱未配置',
      cockpitStarting: '🛩️ 驾驶舱正在启动…',
      cockpitFailed: ({ message }) => '🛩️ 驾驶舱启动失败: ' + message,
      workLogMissing: '📝 工作日志未配置',
      workLogFailed: ({ message }) => '📝 工作日志执行失败: ' + message,
      workLogDone: '📝 工作日志已执行完毕'
    },
    calendar: {
      emptyDay: '这一天没有待办 🎉',
      backToToday: '回到今天',
      addTodo: '新增待办'
    },
    focusChart: {
      range: '统计范围', chartType: '图表类型', week: '近 7 天', month: '近 30 天', line: '折线', bar: '柱状',
      total: ({ minutes }) => minutes + ' min', activeDays: ({ count, days }) => days + ' 天内专注 ' + count + ' 天',
      peak: ({ minutes, date }) => '最高：' + date + ' · ' + minutes + ' min', empty: '还没有专注记录，完成一个番茄钟后这里会亮起来。'
    },
    categories: {
      noteCount: ({ count }) => count + ' 篇笔记',
      openFolder: ({ folder }) => '打开分类：' + folder,
      emptyFolder: ({ folder }) => '“' + folder + '”分类中还没有笔记'
    },
    stats: {
      noteCount: '✏️ 笔记总数',
      todoCount: '✅ 待办总数',
      doneCount: '✅ 已完成',
      doneRate: '✅ 完成率',
      focusToday: '🍅 今日专注'
    },
    todo: {
      add: '新增待办',
      refresh: '刷新待办',
      today: '今天行动',
      all: '全部',
      todo: '待办',
      done: '已办',
      stateDone: '已完成',
      stateDoing: '进行中',
      todaySummary: ({ count }) => '今天行动 · ' + count + ' 项',
      groupOverdue: '已逾期',
      groupToday: '今天到期',
      groupPriority: '高优先级',
      groupInbox: '待安排',
      deferOverdue: '逾期全部移到明天',
      todayEmpty: '今天已经清空了，做点真正重要的事吧 ✦',
      filterEmpty: '当前筛选下没有待办',
      focusTask: '专注此任务',
      createAlarm: '创建关联闹钟',
      editAlarm: '编辑关联闹钟',
      placeholder: '输入待办标题...',
      overdue: ({ date }) => '⚠️ 已过期: ' + date,
      dueToday: '⏰ 今天到期',
      priorityHigh: '高优先级',
      priorityMid: '中优先级',
      priorityLow: '低优先级',
      priorityTitle: ({ value }) => '优先级: ' + value,
      edit: '编辑',
      remove: '删除',
      editorCreate: '新增待办',
      editorEdit: '编辑待办',
      editorTask: '待办内容',
      editorTaskPlaceholder: '例如：整理周报',
      editorDue: '截止日期',
      noDue: '不设置',
      dueTodayBtn: '今天',
      dueTomorrowBtn: '明天',
      editorPriority: '优先级',
      editorTags: '标签',
      editorNoTags: '未选择标签',
      editorTagPlaceholder: '新标签',
      editorAddTag: '添加标签',
      cancel: '取消',
      saveNew: '创建',
      saveEdit: '保存',
      legacyHint: '也兼容 #标签 due:YYYY-MM-DDTHH:mm p:high'
    },
    recent: {
      star: '收藏',
      unstar: '取消收藏'
    },
    flash: {
      placeholder: '随手记一条想法...',
      saved: '✓ 已保存',
      fileHeading: '闪念'
    },
    heatmap: {
      low: '少',
      high: '多',
      files: ({ count }) => count + ' 个文件'
    },
    footer: {
      text: '💾 h 持续维护 · 知识库是活的'
    },
    releases: {
      title: '最近更新记录',
      current: '当前版本',
      empty: 'GitHub 暂时没有可展示的 Release。',
      versionPicker: '选择版本',
      onlineSource: '更新内容在线读取自 GitHub Releases',
      loading: '正在从 GitHub 读取更新记录…',
      errorTitle: '暂时无法读取更新记录',
      errorHint: '请检查网络后重试，或直接前往 GitHub Releases 查看。',
      retry: '重新加载',
      prerelease: '预发布',
      bodyEmpty: '这个 Release 没有填写更新说明。',
      github: '在 GitHub 查看全部更新',
      githubHint: '完整发布历史与附件由 GitHub Releases 提供。',
      githubError: '无法打开 GitHub Releases。'
    },
    pomodoro: {
      title: '🍅 番茄钟',
      close: '关闭番茄钟',
      minimize: '最小化',
      expand: '展开',
      modeFocus: '专注轮',
      modeBreak: '休息轮',
      ready: '准备开始',
      dragHint: '拖动标题栏可移动',
      start: '▶ 开始',
      resume: '▶ 继续',
      pause: '⏸ 暂停',
      reset: '↺ 重置',
      focusToday: ({ minutes }) => '今日专注: ' + minutes + ' min',
      focusPaused: '专注暂停',
      breakPaused: '休息暂停',
      focusing: '专注中...',
      resting: '休息中...',
      completedOne: '✅ 完成一个番茄！',
      readyForBreak: '专注结束，准备休息',
      startBreak: '▶ 开始休息',
      breakEnd: '休息结束',
      readyForFocus: '休息完成，继续工作',
      backToWork: '回到专注',
      focusLogTitle: '专注记录',
      selectTask: '关联待办',
      noTask: '不关联任务',
      taskMinutes: ({ minutes }) => minutes + ' min',
      taskBound: ({ task }) => '已关联：' + task,
      completeTask: '完成任务',
      keepTask: '继续任务',
      deferTask: '移到明天',
      taskNextAction: '本轮专注后的任务操作',
      fullscreenReminder: '专注结束全屏提醒',
      fullscreenHint: '25 分钟专注结束时覆盖当前 Obsidian 窗口',
      breakReminder: '休息结束也提醒',
      breakReminderHint: '开启全屏提醒后，5 分钟休息结束时提醒开始工作',
      focusFinishedTitle: '专注完成',
      focusFinishedSubtitle: '做得很好，起来活动一下吧。',
      breakFinishedTitle: '休息结束',
      breakFinishedSubtitle: '准备好后，开始下一轮专注。'
    },
    alarm: {
      runningNote: 'Obsidian 运行时会准点响铃，休眠唤醒后 10 分钟内可补响。'
    },
    onboarding: {
      stepName: '✏️ 这里可以切换界面语言，也可以点击昵称直接修改名字',
      stepToolbar: '⚡ 工具栏里可以快速新建笔记、搜索、打开标签和图谱，也能直接启动番茄钟',
      stepCalendar: '📅 日历看板显示每日待办，左右箭头切换月份，点击日期查看详情',
      stepTodo: '✅ 待办支持标签分类、红黄绿优先级、截止日期提醒，点击复选框完成',
      stepContextMenu: '🖱️ 桌面端在空白区域右键，可以打开快捷菜单，里面有刷新页面、最近更新和布局编辑',
      stepStats: '📊 统计卡片实时展示数据，各区域标题可点击折叠收起',
      stepPomodoro: '🍅 番茄钟 25 分专注 + 5 分休息，右下角浮动可拖拽',
      close: '✕ 关闭',
      prev: '← 上一步',
      next: '下一步 →',
      done: '✓ 完成'
    },
    welcome: {
      title: 'Cockpit Dashboard',
      badge: '首次设置',
      introCn: '欢迎使用 Cockpit Dashboard。先选择你的界面语言，再开始功能引导。',
      introEn: 'Welcome to Cockpit Dashboard. Choose your interface language first, then continue to the guided tour.',
      chooseLanguage: '选择语言',
      continue: '开始使用',
      skip: '跳过引导'
    }
  },
  en: {
    sections: {
      cats: '📂 Knowledge Areas',
      todos: '✅ Tasks',
      stats: '📊 Progress Stats',
      recent: '✏️ Recent Updates',
      bookmarks: '⭐ Starred Notes',
      flash: '⚡ Quick Capture',
      focusChart: '🍅 Focus Trend',
      alarms: '⏰ Alarms',
      scheduledTasks: '⏱ Scheduled Tasks',
      heatmap: '📈 Edit Heatmap (30d)'
    },
    greetings: {
      morning: 'Good morning',
      noon: 'Good noon',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Up late'
    },
    hero: {
      defaultName: 'Click to rename',
      today: ({ date }) => 'Today is ' + date,
      dueTodos: ({ overdue, today, tomorrow }) => [
        overdue ? overdue + ' overdue' : '',
        today ? today + ' due today' : '',
        tomorrow ? tomorrow + ' due tomorrow' : ''
      ].filter(Boolean).join(' · '),
      vaultDays: ({ days }) => '• Your vault has been with you for ' + days + ' days',
      language: 'Interface language'
    },
    tip: {
      label: 'Daily Note'
    },
    toolbar: {
      new: 'New Note',
      search: 'Search',
      tag: 'Tags',
      graph: 'Graph',
      command: 'Commands',
      more: 'More',
      hermes: 'Hermes',
      cockpit: 'Dashboard',
      workLog: 'Work Log',
      pomodoro: 'Pomodoro'
    },
    search: {
      placeholder: 'Search notes by keyword...'
    },
    contextMenu: {
      refreshPage: 'Refresh dashboard',
      newNote: 'New note',
      searchNotes: 'Search notes',
      commandPalette: 'Command palette',
      openGraph: 'Open graph view',
      startPomodoro: 'Start Pomodoro',
      releaseNotes: 'Recent updates'
    },
    layout: {
      edit: 'Edit Mode',
      done: 'Done',
      editHint: 'Turn on layout editing to drag modules up or down',
      doneHint: 'Exit layout editing',
      dragHandle: ({ module }) => 'Drag to reorder: ' + module,
      hide: 'Hide',
      show: 'Show',
      hiddenTag: 'Hidden',
      hideModule: ({ module }) => 'Hide module: ' + module,
      showModule: ({ module }) => 'Show module: ' + module,
      hideToolbarButton: ({ button }) => 'Hide toolbar button: ' + button,
      showToolbarButton: ({ button }) => 'Show toolbar button: ' + button,
      modules: {
        hero: 'Hero',
        tip: 'Daily Tip',
        toolbar: 'Toolbar',
        alarms: 'Alarms',
        calendar: 'Calendar',
        focusChart: 'Focus Trend',
        footer: 'Footer'
      }
    },
    notices: {
      hermesStarting: '🤖 Starting Hermes…',
      hermesStartingExternal: '🤖 Hermes opened in an external terminal',
      hermesFallbackExternal: '🤖 Hermes fell back to an external terminal',
      hermesFailed: ({ message }) => '🤖 Hermes failed to start: ' + message,
      cockpitMissing: '🛩️ Dashboard command is not configured',
      cockpitStarting: '🛩️ Launching dashboard…',
      cockpitFailed: ({ message }) => '🛩️ Failed to launch dashboard: ' + message,
      workLogMissing: '📝 Work log command is not configured',
      workLogFailed: ({ message }) => '📝 Work log failed: ' + message,
      workLogDone: '📝 Work log finished'
    },
    calendar: {
      emptyDay: 'No tasks on this day 🎉',
      backToToday: 'Back to today',
      addTodo: 'Add task'
    },
    focusChart: {
      range: 'Time range', chartType: 'Chart type', week: '7 days', month: '30 days', line: 'Line', bar: 'Bars',
      total: ({ minutes }) => minutes + ' min', activeDays: ({ count, days }) => count + ' active days in ' + days + ' days',
      peak: ({ minutes, date }) => 'Peak: ' + date + ' · ' + minutes + ' min', empty: 'No focus records yet. Complete a Pomodoro to light up this chart.'
    },
    categories: {
      noteCount: ({ count }) => count + ' notes',
      openFolder: ({ folder }) => 'Open category: ' + folder,
      emptyFolder: ({ folder }) => 'No notes yet in “' + folder + '”'
    },
    stats: {
      noteCount: '✏️ Notes',
      todoCount: '✅ Open Tasks',
      doneCount: '✅ Done',
      doneRate: '✅ Completion',
      focusToday: '🍅 Focus Today'
    },
    todo: {
      add: 'Add task',
      refresh: 'Refresh tasks',
      today: 'Today',
      all: 'All',
      todo: 'Open',
      done: 'Done',
      stateDone: 'Done',
      stateDoing: 'In progress',
      todaySummary: ({ count }) => 'Today · ' + count + ' actions',
      groupOverdue: 'Overdue',
      groupToday: 'Due today',
      groupPriority: 'High priority',
      groupInbox: 'Unscheduled',
      deferOverdue: 'Move overdue to tomorrow',
      todayEmpty: 'Today is clear. Make room for what matters ✦',
      filterEmpty: 'No tasks match this filter',
      focusTask: 'Focus on this task',
      createAlarm: 'Create linked alarm',
      editAlarm: 'Edit linked alarm',
      placeholder: 'Type a task title...',
      overdue: ({ date }) => '⚠️ Overdue: ' + date,
      dueToday: '⏰ Due today',
      priorityHigh: 'High priority',
      priorityMid: 'Medium priority',
      priorityLow: 'Low priority',
      priorityTitle: ({ value }) => 'Priority: ' + value,
      edit: 'Edit',
      remove: 'Delete',
      editorCreate: 'Add task',
      editorEdit: 'Edit task',
      editorTask: 'Task',
      editorTaskPlaceholder: 'Example: Finish weekly review',
      editorDue: 'Due date',
      noDue: 'No due date',
      dueTodayBtn: 'Today',
      dueTomorrowBtn: 'Tomorrow',
      editorPriority: 'Priority',
      editorTags: 'Tags',
      editorNoTags: 'No tags selected',
      editorTagPlaceholder: 'New tag',
      editorAddTag: 'Add tag',
      cancel: 'Cancel',
      saveNew: 'Create',
      saveEdit: 'Save',
      legacyHint: 'Also supports #tags due:YYYY-MM-DDTHH:mm p:high'
    },
    recent: {
      star: 'Star',
      unstar: 'Unstar'
    },
    flash: {
      placeholder: 'Capture a quick thought...',
      saved: '✓ Saved',
      fileHeading: 'Quick Capture'
    },
    heatmap: {
      low: 'Low',
      high: 'High',
      files: ({ count }) => count + ' files'
    },
    footer: {
      text: '💾 Maintained continuously · Keep the vault alive'
    },
    releases: {
      title: 'Recent updates',
      current: 'Current version',
      empty: 'No GitHub Releases are available yet.',
      versionPicker: 'Version',
      onlineSource: 'Update content is loaded online from GitHub Releases',
      loading: 'Loading release notes from GitHub…',
      errorTitle: 'Release notes are unavailable',
      errorHint: 'Check your connection and retry, or open GitHub Releases directly.',
      retry: 'Retry',
      prerelease: 'Pre-release',
      bodyEmpty: 'This release does not include release notes.',
      github: 'View all updates on GitHub',
      githubHint: 'GitHub Releases provides the complete history and downloadable files.',
      githubError: 'Could not open GitHub Releases.'
    },
    pomodoro: {
      title: '🍅 Pomodoro',
      close: 'Close Pomodoro',
      minimize: 'Minimize',
      expand: 'Expand',
      modeFocus: 'Focus session',
      modeBreak: 'Break session',
      ready: 'Ready to focus',
      dragHint: 'Drag the header to move',
      start: '▶ Start',
      resume: '▶ Resume',
      pause: '⏸ Pause',
      reset: '↺ Reset',
      focusToday: ({ minutes }) => 'Focus today: ' + minutes + ' min',
      focusPaused: 'Focus paused',
      breakPaused: 'Break paused',
      focusing: 'Focusing...',
      resting: 'On break...',
      completedOne: '✅ One Pomodoro done!',
      readyForBreak: 'Focus finished, ready for a break',
      startBreak: '▶ Start break',
      breakEnd: 'Break finished',
      readyForFocus: 'Break over, back to focus',
      backToWork: 'Back to focus',
      focusLogTitle: 'Focus Log',
      selectTask: 'Linked task',
      noTask: 'No linked task',
      taskMinutes: ({ minutes }) => minutes + ' min',
      taskBound: ({ task }) => 'Linked: ' + task,
      completeTask: 'Complete task',
      keepTask: 'Keep working',
      deferTask: 'Move to tomorrow',
      taskNextAction: 'Task actions after this focus session',
      fullscreenReminder: 'Full-screen focus reminder',
      fullscreenHint: 'Cover the current Obsidian window when a 25-minute focus session ends',
      breakReminder: 'Also remind after break',
      breakReminderHint: 'When full-screen reminders are enabled, prompt to resume work after the five-minute break',
      focusFinishedTitle: 'Focus complete',
      focusFinishedSubtitle: 'Nice work. Take a moment to move and reset.',
      breakFinishedTitle: 'Break complete',
      breakFinishedSubtitle: 'Start the next focus session when you are ready.'
    },
    alarm: {
      runningNote: 'Alarms ring while Obsidian is running and recover within 10 minutes after wake.'
    },
    onboarding: {
      stepName: '✏️ Use this area to switch interface language and rename yourself quickly.',
      stepToolbar: '⚡ Use the toolbar for quick note actions, search, tags, graph view, and Pomodoro.',
      stepCalendar: '📅 The calendar shows daily tasks. Use arrows to switch months and click a day for details.',
      stepTodo: '✅ Tasks support tags, red-yellow-green priority, and due reminders. Click the checkbox to complete.',
      stepContextMenu: '🖱️ On desktop, right-click any blank area to open the quick menu for refresh, recent updates, and layout editing.',
      stepStats: '📊 Stat cards update live, and each section title can collapse its content.',
      stepPomodoro: '🍅 Pomodoro runs 25 minutes focus + 5 minutes break, and the floating card can be dragged.',
      close: '✕ Close',
      prev: '← Back',
      next: 'Next →',
      done: '✓ Finish'
    },
    welcome: {
      title: 'Cockpit Dashboard',
      badge: 'First-time setup',
      introCn: '欢迎使用 Cockpit Dashboard。先选择你的界面语言，再开始功能引导。',
      introEn: 'Welcome to Cockpit Dashboard. Choose your interface language first, then continue to the guided tour.',
      chooseLanguage: 'Choose Language',
      continue: 'Get Started',
      skip: 'Skip Guide'
    }
  }
};
const T = I18N[DEFAULT_LANG].sections;


function normalizeLang(lang) {
  return lang === 'en' ? 'en' : DEFAULT_LANG;
}

function getLangPack(lang) {
  return I18N[normalizeLang(lang)] || I18N[DEFAULT_LANG];
}

function getText(lang, key, vars) {
  const read = (pack, path) => path.split('.').reduce((acc, part) => acc && acc[part], pack);
  let value = read(getLangPack(lang), key);
  if (value == null) value = read(I18N[DEFAULT_LANG], key);
  if (typeof value === 'function') return value(vars || {});
  return value == null ? key : String(value);
}

const HERMES_TODOS = [
  { text: '📅 日历/日程看板', done: true, tags: ['obsidian'], priority: 'high', dueDate: '2026-06-02' },
  { text: '🍅 番茄钟/专注计时器', done: true, tags: ['obsidian'], priority: 'low', dueDate: null },
];

const DEFAULT_TODOS = [
  { text:'完善 Dashboard 驾驶舱功能', tags:['工作'], priority:'high', dueDate:null, done:false, created:null, doneDate:null },
  { text:'整理 gbrain 代码片段分类', tags:['工作'], priority:'mid', dueDate:null, done:false, created:null, doneDate:null },
  { text:'Gateway 配置文档补充', tags:['运维'], priority:'mid', dueDate:null, done:false, created:null, doneDate:null },
  { text:'Obsidian vault 创建和分类', tags:['工作'], priority:'low', dueDate:null, done:true, created:null, doneDate:null }
];
