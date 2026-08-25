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
    version: '1.1.0',
    date: '2026-07-19',
    title: {
      'zh-CN': '定时待办消息推送',
      en: 'Scheduled Task Notifications'
    },
    highlights: {
      'zh-CN': [
        '消息推送支持 Server酱³、Bark 与 MEOW，可同时启用，并分别测试。',
        '支持每天、指定星期或指定月日，并可设置精确到秒的自动推送时间。',
        '抽取统一的排程、消息组装、渠道适配与逐渠道去重逻辑，单个渠道失败不会阻断其他渠道。',
        'Bark 支持 HTTPS 服务地址、Device Key 与分组；MEOW 使用昵称和 Markdown 消息接口。'
      ],
      en: [
        'Added ServerChan³, Bark, and MEOW delivery; channels can be enabled and tested independently.',
        'Supports daily, selected weekday, or selected day-of-month schedules with second-level delivery time.',
        'Shared scheduling, message composition, adapters, and per-channel de-duplication so one delivery failure does not block another.',
        'Bark supports an HTTPS server URL, Device Key, and group; MEOW uses its nickname and Markdown API.'
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
        '新增 Spotlight 风格 Vault 全局搜索，支持文件名、路径和正文匹配、输入防抖、键盘操作与拖动窗口。',
        '待办状态筛选改为紧凑下拉框；“优先处理”聚合高优先级或明天到期的未完成任务，并支持一键延期。',
        '日历详情与待办列表统一编辑图标和操作风格。',
        '收藏支持折叠、固定顺序、上下调整，并可一键在分栏中打开笔记。',
        'Toolbar 编辑模式支持新增、编辑、隐藏和删除自定义网址或 Shell 脚本按钮；后台脚本提供日志，交互命令统一使用 macOS 系统终端。',
        '新增带通俗引导的显式数据迁移；storageMigrationCompleted 完成前继续旧文件读写，完成后才切换 Storage V2。',
        'Toolbar 编辑态改为疏朗布局与统一文字显示/隐藏；自定义按钮及 Hermes、驾驶舱、工作日志均支持直接删除，三个预制按钮也可修改名称和命令。',
        '修复知识分类卡片在缺少概览/MOC 文件时无法点击的问题；现在会自动打开分类中的第一篇笔记，空目录会显示提示。'
      ],
      en: [
        'Added draggable Spotlight-style Vault search across note names, paths, and content, with debounced input and keyboard navigation.',
        'Changed task status filtering to a compact dropdown; Next includes unfinished high-priority tasks or tasks due tomorrow, with one-click deferral.',
        'Unified edit icons and action styling between calendar details and the main todo list.',
        'Added collapsible bookmarks with persistent ordering, move controls, and one-click split-pane opening.',
        'Toolbar Edit Mode can add, edit, hide, and delete custom URL or Shell-script buttons; background scripts expose logs and interactive commands always use macOS Terminal.',
        'Added an explicit guided data migration: legacy files remain active until storageMigrationCompleted is true, then Storage V2 becomes the only write target.',
        'Toolbar Edit Mode now uses a cleaner layout and consistent text Show/Hide controls; custom buttons and the seeded Hermes, Cockpit, and Work Log buttons can all be deleted, while seeded buttons remain editable.',
        'Fixed category cards that did nothing when no overview/MOC note existed; they now open the first note in the category or explain that the folder is empty.'
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
        '新增局部静默刷新，问候语与首页关键区块会按周期更新，并尽量避开用户输入与编辑状态。',
        '番茄钟专注数据改为按日期累计写入 `_data/focus.md`，保留历史记录而不再只覆盖当天。',
        '重做番茄钟浮窗，强化深浅色适配，精简大小视图信息负载，并在休息结束后提示继续专注。',
        '修复 Hermes 启动链路，编辑模式下支持自定义隐藏 Toolbar 按钮。'
      ],
      en: [
        'Added partial silent refresh so the greeting and key dashboard sections update on a schedule while avoiding active input and edit states.',
        'Changed Pomodoro focus persistence to accumulate by date in `_data/focus.md`, preserving history instead of overwriting only today.',
        'Refined the floating Pomodoro with better light/dark support, leaner compact and expanded views, and a reminder when breaks end.',
        'Fixed the Hermes launch flow and added per-button Toolbar visibility controls in Edit Mode.'
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
        '新增编辑模式，支持模块拖拽排序、隐藏与持久化布局。',
        '右键菜单新增最近更新记录，内置本地版本历史弹窗。',
        '重做日历看板，优化深浅色观感与语言切换可读性。'
      ],
      en: [
        'Added Edit Mode with drag-to-reorder, hide/show controls, and persistent layout state.',
        'Added Recent Updates to the context menu with a built-in local release-notes modal.',
        'Refreshed the calendar board with better light/dark visuals and improved language-toggle legibility.'
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
        '新增中英文界面切换。',
        '增强按钮按压、悬停和动效反馈。',
        '整体交互细节更顺手。'
      ],
      en: [
        'Added Chinese and English UI switching.',
        'Improved hover, press, and motion feedback for key actions.',
        'Polished interaction details across the dashboard.'
      ]
    }
  },
  {
    version: '1.0.6',
    date: '2026-07-04',
    title: {
      'zh-CN': '界面打磨与 README 双语化',
      en: 'Dashboard Polish and Bilingual README'
    },
    highlights: {
      'zh-CN': [
        '优化 Dashboard 视觉细节。',
        '补充并整理双语 README。',
        '发布流程说明更完整。'
      ],
      en: [
        'Refined the visual details of the dashboard.',
        'Expanded and organized the bilingual README.',
        'Made the release workflow documentation more complete.'
      ]
    }
  },
  {
    version: '1.0.4',
    date: '2026-06-13',
    title: {
      'zh-CN': '修复配置解析异常',
      en: 'Fix Configuration Parsing Errors'
    },
    highlights: {
      'zh-CN': [
        '修复模板字面量中的正则反斜杠转义问题。',
        '修复换行解析错误导致的配置读取失败。',
        '重新构建主入口文件。'
      ],
      en: [
        'Fixed regex backslash escaping inside template literals.',
        'Fixed config loading failures caused by newline parsing issues.',
        'Rebuilt the main bundled entry file.'
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
        '新增 `_data/toolbar.md` 作为工具栏配置源。',
        '驾驶舱和工作日志命令可按需修改。',
        '首次加载时自动生成默认配置文件。'
      ],
      en: [
        'Added `_data/toolbar.md` as the toolbar configuration source.',
        'Made Cockpit and work-log commands customizable.',
        'Generated default config automatically on first load.'
      ]
    }
  },
  {
    version: '1.0.2',
    date: '2026-06-11',
    title: {
      'zh-CN': '插件商店描述与样式修正',
      en: 'Marketplace Copy and Style Cleanup'
    },
    highlights: {
      'zh-CN': [
        '修正插件描述文案。',
        '去除不必要的 `!important`。',
        '清理样式兼容性问题。'
      ],
      en: [
        'Revised plugin marketplace copy.',
        'Removed unnecessary `!important` rules.',
        'Cleaned up style compatibility issues.'
      ]
    }
  },
  {
    version: '1.0.1',
    date: '2026-06-11',
    title: {
      'zh-CN': '通过插件商店审核准备',
      en: 'Marketplace Review Preparation'
    },
    highlights: {
      'zh-CN': [
        '调整 manifest 与 README 以满足审核要求。',
        '统一 CSS 注释格式。',
        '补充 MIT LICENSE。'
      ],
      en: [
        'Adjusted the manifest and README for marketplace review requirements.',
        'Unified CSS comment formatting.',
        'Added the MIT LICENSE.'
      ]
    }
  }
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
      label: '💡 今日运维技巧'
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
      label: '💡 Daily Ops Tip'
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

const DAILY_TIPS = {
  'zh-CN': [
    '💡 Linux: `lsof -i :端口号` 快速查看哪个进程占用了端口',
    '💡 SQL: 大表加索引时用 `CREATE INDEX CONCURRENTLY`（PG）或 `ALTER TABLE ... ALGORITHM=INPLACE`（MySQL），避免锁表',
    '💡 Git: `git reflog` 可以找回被 reset/drop 的 commit，HEAD@{n} 定位',
    '💡 网络: `ss -tlnp` 比 netstat 更快，查看监听端口首选',
    '💡 Docker: `docker system prune -a --volumes` 一键清理悬空镜像和卷（慎用）',
    '💡 Nginx: `nginx -t` 测试配置语法，reload 前先跑一遍',
    '💡 低代码: 表单联动用 watch/effect 比 onChange 更可控，避免回调地狱',
    '💡 Oracle: `SELECT * FROM v$locked_object` 查锁表，`ALTER SYSTEM KILL SESSION` 解锁',
    '💡 内网穿透: frp 的 `transport.tls.enable = true` 加密流量，公网暴露必备',
    '💡 AI工具: Claude Code 的 CLAUDE.md 放项目根目录，每次会话自动加载上下文',
    '💡 运维: `journalctl -u 服务名 --since "1 hour ago"` 快速查最近日志',
    '💡 数据库: EXPLAIN ANALYZE 比 EXPLAIN 更准，会实际执行并返回真实耗时',
    '💡 Linux: `watch -n 1 命令` 每秒刷新执行，监控神器',
    '💡 Git: `git stash push -m "描述"` 给 stash 加注释，找起来不迷路',
    '💡 网络: `mtr 目标IP` 结合 ping + traceroute，定位网络抖动神器'
  ],
  en: [
    '💡 Linux: use `lsof -i :PORT` to see which process is holding a port.',
    '💡 SQL: build big-table indexes online with `CREATE INDEX CONCURRENTLY` or in-place alter options.',
    '💡 Git: `git reflog` can recover commits after a reset or dropped branch.',
    '💡 Network: `ss -tlnp` is usually faster than netstat for listening ports.',
    '💡 Docker: `docker system prune -a --volumes` clears dangling images and volumes. Use carefully.',
    '💡 Nginx: always run `nginx -t` before reloading config.',
    '💡 Low-code: watch/effect chains are easier to control than nested onChange callbacks.',
    '💡 Oracle: `SELECT * FROM v$locked_object` helps inspect table locks quickly.',
    '💡 Tunneling: enable `transport.tls.enable = true` in frp when exposing services publicly.',
    '💡 AI tools: keep `CLAUDE.md` at repo root so each session loads project context automatically.',
    '💡 Ops: `journalctl -u service --since \"1 hour ago\"` is a fast way to inspect fresh logs.',
    '💡 Databases: `EXPLAIN ANALYZE` is more truthful than `EXPLAIN` because it really runs the query.',
    '💡 Linux: `watch -n 1 <cmd>` is still one of the best lightweight monitors.',
    '💡 Git: annotate stashes with `git stash push -m \"desc\"` so you can find them later.',
    '💡 Network: `mtr <host>` is great for locating packet loss or routing jitter.'
  ]
};

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
