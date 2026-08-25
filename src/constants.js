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
const RELEASE_HISTORY = [
  {
    version: '1.1.3',
    date: '2026-07-27',
    title: {
      'zh-CN': 'RSS 朗读与日历刷新优化',
      en: 'RSS Playback and Calendar Refresh Improvements'
    },
    highlights: {
      'zh-CN': [
        'RSS 阅读器新增顶部全局朗读播放器，日历也会在跨日后静默更新当天状态。'
      ],
      en: [
        'Added a top-level RSS text-to-speech player and silent calendar updates when the date changes.'
      ]
    }
  },
  {
    version: '1.1.2',
    date: '2026-07-24',
    title: {
      'zh-CN': '日历 RSS 订阅',
      en: 'Calendar RSS Subscriptions'
    },
    highlights: {
      'zh-CN': [
        '新增日历 RSS 订阅：支持多源按日期查看、已读未读提醒、正文过滤与顶部全局朗读播放器。'
      ],
      en: [
        'Added calendar RSS subscriptions with multi-source date-based entries, read/unread reminders, content filters, and a top-level text-to-speech player.'
      ]
    }
  },
  {
    version: '1.1.1',
    date: '2026-07-21',
    title: {
      'zh-CN': '情景布局、模块化与专注趋势',
      en: 'Layout Scenes, Modular Dashboard, and Focus Trends'
    },
    highlights: {
      'zh-CN': [
        '新增情景布局，让模块与 Toolbar 可按不同工作场景独立保存、排序、显示和折叠。',
        '每日一语与 Toolbar 编辑支持按当前语言维护、拖拽调整和局部保存。',
        '新增默认隐藏的专注趋势，可查看近 7 / 30 天记录并切换折线或柱状图。',
        '番茄钟支持自动显示控制，并会随 Obsidian 切换深浅主题。'
      ],
      en: [
        'Added layout scenes for independently saving, ordering, showing, and collapsing modules and Toolbar items by workflow.',
        'Daily Note and Toolbar editing now support language-aware maintenance, drag adjustment, and local saves.',
        'Added a hidden-by-default Focus Trend with 7/30-day history and line or bar views.',
        'Pomodoro supports auto-show control and follows Obsidian’s light/dark theme.'
      ]
    }
  },
  {
    version: '1.1.0',
    date: '2026-07-19',
    title: {
      'zh-CN': '定时待办消息推送',
      en: 'Scheduled Task Notifications'
    },
    highlights: {
      'zh-CN': [
        '支持 Server酱³、Bark 与 MEOW 多渠道待办消息推送。',
        '可设置每天、指定星期或指定月日的推送时间。'
      ],
      en: [
        'Added multi-channel task notifications through ServerChan³, Bark, and MEOW.',
        'Choose daily, selected weekday, or selected month-day delivery times.'
      ]
    }
  },
  {
    version: '1.0.10',
    date: '2026-07-12',
    title: {
      'zh-CN': '全局搜索、优先待办与收藏工作流升级',
      en: 'Global Search, Priority Tasks, and Bookmark Workflow'
    },
    highlights: {
      'zh-CN': [
        '新增可拖动的全局搜索，支持按文件名、路径和正文查找笔记。',
        '优化待办优先处理、收藏排序和日历编辑体验。',
        'Toolbar 支持更完整的自定义与管理。'
      ],
      en: [
        'Added draggable global search across note names, paths, and content.',
        'Improved priority tasks, bookmark ordering, and calendar editing.',
        'Expanded Toolbar customization and management.'
      ]
    }
  },
  {
    version: '1.0.9',
    date: '2026-07-08',
    title: {
      'zh-CN': '静默刷新、番茄钟历史记录与 Toolbar 可定制',
      en: 'Silent Refresh, Pomodoro History, and Customizable Toolbar'
    },
    highlights: {
      'zh-CN': [
        '首页关键数据支持静默刷新，尽量不打断当前操作。',
        '优化番茄钟体验，并支持按日期保留专注历史。'
      ],
      en: [
        'Added silent refresh for key dashboard data while avoiding active work.',
        'Improved Pomodoro and preserved focus history by date.'
      ]
    }
  },
  {
    version: '1.0.8',
    date: '2026-07-06',
    title: {
      'zh-CN': '编辑模式、更新记录与日历体验升级',
      en: 'Edit Mode, Release Notes, and Calendar Refresh'
    },
    highlights: {
      'zh-CN': [
        '新增编辑模式，可拖拽排序和隐藏模块。',
        '新增本地更新记录与优化后的日历看板。'
      ],
      en: [
        'Added Edit Mode for reordering and hiding dashboard modules.',
        'Added local release notes and refreshed the calendar board.'
      ]
    }
  },
  {
    version: '1.0.7',
    date: '2026-07-04',
    title: {
      'zh-CN': '语言切换与交互细节优化',
      en: 'Language Toggle and Interaction Polish'
    },
    highlights: {
      'zh-CN': [
        '新增中英文界面切换，并优化主要交互反馈。'
      ],
      en: [
        'Added Chinese and English UI switching with improved interaction feedback.'
      ]
    }
  },


  {
    version: '1.0.3',
    date: '2026-06-13',
    title: {
      'zh-CN': '支持工具栏命令自定义',
      en: 'Custom Toolbar Command Support'
    },
    highlights: {
      'zh-CN': [
        '支持按需自定义驾驶舱和工作日志等 Toolbar 命令。'
      ],
      en: [
        'Added customizable Toolbar commands for Cockpit, work log, and more.'
      ]
    }
  },

];

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
      dueTodos: ({ count, icon }) => '您有 ' + count + ' 件' + icon + '截止待办',
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
      all: '全部',
      todo: '待办',
      done: '已办',
      stateDone: '已完成',
      stateDoing: '进行中',
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
      legacyHint: '也兼容 #标签 due:YYYY-MM-DD p:high'
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
      empty: '暂时没有可展示的更新记录。'
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
      focusLogTitle: '专注记录'
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
      dueTodos: ({ count, icon }) => 'You have ' + count + ' ' + icon + ' tasks due soon',
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
      all: 'All',
      todo: 'Open',
      done: 'Done',
      stateDone: 'Done',
      stateDoing: 'In progress',
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
      legacyHint: 'Also supports #tags due:YYYY-MM-DD p:high'
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
      empty: 'No update records are available yet.'
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
      focusLogTitle: 'Focus Log'
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
