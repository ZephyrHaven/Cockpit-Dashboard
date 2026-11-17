// constants.js — 全局常量（纯数据，无函数）

const VIEW_TYPE = 'cockpit-dashboard';
const AI_VIEW_TYPE = 'cockpit-dashboard-ai';
const PLUGIN_ID = 'cockpit-dashboard';
const TODO_FILE = '_data/todos.md';
const BOOKMARK_FILE = '_data/bookmarks.md';
const FOCUS_FILE = '_data/focus.md';
const HABIT_FILE = '_data/habits.md';
const DAILY_DIR = '_daily';
const DATA_DIR = '_data';
const DEFAULT_LANG = 'zh-CN';
const LANG_OPTIONS = [
  { code: 'zh-CN', label: '中文', short: '中文' },
  { code: 'en', label: 'English', short: 'EN' }
];

const E = { wave:'👋', search:'🔍', tag:'🏷️', graph:'🕸️', bolt:'⚡', folder:'📂', rule:'📋', gear:'⚙️', robot:'🤖', box:'📦', chart:'📊', pencil:'✏️', check:'✅', save:'💾', edit:'✏️', del:'✕', cal:'📅' };
// 可选仪表盘模块：首次引入且用户布局未提及时默认隐藏，用户可在编辑模式里自行开启。
const OPTIONAL_DASH_MODULES = ['habits', 'projects', 'resurface', 'reportStudio'];
const COLORS = ['#818cf8','#f59e0b','#3b82f6','#22c55e','#ec4899','#14b8a6','#f97316','#6366f1'];
const ICONS  = ['📁','📂','🗂️','📋','📌','🏷️','🔖','📊'];
const I18N = {
  'zh-CN': {
    sections: {
      cats: '知识分类',
      todos: '待办事项',
      stats: '统计进度',
      recent: '最近更新',
      bookmarks: '收藏文件',
      flash: '闪念胶囊',
      focusChart: '专注趋势',
      alarms: '闹钟',
      countdowns: '倒计时',
      habits: '习惯打卡',
      agenda: '今日时间流',
      weeklyReview: '周回顾',
      projects: '项目进度',
      resurface: '旧笔记重现',
      scheduledTasks: '定时任务',
      workflows: '自动化流程',
      reportStudio: '周报与回顾',
      heatmap: '编辑热力图（近30天）'
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
      ai: 'AI 助手',
      more: '更多',
      workLog: '工作日志',
      todayNote: '今日笔记',
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
      exportBackup: '导出数据备份',
      releaseNotes: '最近更新记录',
      checkUpdate: '检查更新'
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
        countdowns: '倒计时',
        calendar: '日历看板',
        focusChart: '专注趋势',
        habits: '习惯打卡',
        agenda: '今日时间流',
        weeklyReview: '周回顾',
        projects: '项目进度',
        resurface: '旧笔记重现',
        footer: '页脚'
      }
    },
    notices: {
      workLogMissing: '📝 工作日志未配置',
      workLogFailed: ({ message }) => '📝 工作日志执行失败: ' + message,
      workLogDone: '📝 工作日志已执行完毕',
      commandNotAvailable: '⚙️ 命令不可用或未安装，请在弹出的工具栏设置中修改'
    },
    calendar: {
      emptyDay: '这一天没有待办 🎉',
      backToToday: '回到今天',
      addTodo: '新增待办'
    },
    focusChart: {
      range: '统计范围', chartType: '图表类型', week: '近 7 天', month: '近 30 天', line: '折线', bar: '柱状',
      total: ({ minutes }) => minutes + ' min', activeDays: ({ count, days }) => days + ' 天内专注 ' + count + ' 天',
      peak: ({ minutes, date }) => '最高：' + date + ' · ' + minutes + ' min', empty: '还没有专注记录，完成一个番茄钟后这里会亮起来。',
      insightWeek: ({ thisWeek, lastWeek }) => `本周专注 ${thisWeek} 分钟，上周 ${lastWeek} 分钟`,
      insightBestHours: ({ from, to, minutes }) => `黄金时段 ${from}:00–${to}:00（近30天 ${minutes} 分钟）`,
      shareCard: '📸 生成本周分享卡片',
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
      text: '💾 持续维护 · 知识库是活的'
    },
    releases: {
      title: '最近更新记录',
      current: '当前版本',
      empty: 'GitHub 暂时没有可展示的 Release。',
      versionPicker: '选择版本',
      onlineSource: 'GitHub Releases · 全量加载 · 30 分钟缓存',
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
      minimize: '简洁模式',
      expand: '展开设置',
      modeFocus: '专注轮',
      modeBreak: '休息轮',
      ready: '准备开始',
      dragHint: '拖动标题栏可移动',
      start: '开始',
      resume: '继续',
      pause: '暂停',
      reset: '↺ 重置',
      focusToday: ({ minutes }) => '今日专注: ' + minutes + ' min',
      focusPaused: '专注暂停',
      breakPaused: '休息暂停',
      focusing: '专注中...',
      resting: '休息中...',
      completedOne: '✅ 完成一个番茄！',
      readyForBreak: '专注结束，准备休息',
      startBreak: '开始休息',
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
      fullscreenReminder: '结束提示进入全屏',
      fullscreenHint: '显示结束提示时，额外请求当前应用窗口进入全屏',
      breakReminder: '休息结束也提醒',
      breakReminderHint: '休息结束后显示下一轮提示，不依赖全屏设置',
      focusFinishedTitle: '专注完成',
      focusFinishedSubtitle: '做得很好，起来活动一下吧。',
      breakFinishedTitle: '休息结束',
      breakFinishedSubtitle: '准备好后，开始下一轮专注。'
    },
    alarm: {
      runningNote: '应用运行时会准点响铃，休眠唤醒后 10 分钟内可补响。'
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
    },
    framework: {
      teamTodos: '团队待办',
      sceneDefault: '默认布局',
      sceneUntitled: '未命名情景',
      deleteScene: ({ name }) => '确定删除“' + name + '”吗？',
      delete: '删除',
      saveCalViewFail: '日历视图偏好保存失败。',
      saveCalWidthFail: '日历分栏宽度保存失败。',
      saveTodosFail: '待办保存失败，内容未发生变化。',
      manageTips: '管理提示',
      nothingToBackup: '没有可备份的数据文件。',
      backupFailed: ({ msg }) => '备份失败：' + msg,
      schedTaskFail: '待办排期失败。',
      createTaskFail: '待办创建失败。',
      openMeetingFail: ({ msg }) => '会议笔记打开失败：' + msg,
      automationOk: '自动化执行完成。',
      automationFail: '自动化执行失败，请查看审计日志。',
      next: '优先处理',
      filterByStatus: '按状态筛选待办',
      statusFilter: '待办状态筛选',
      archived: '已归档',
      deferOverdueFail: '延期失败，所有待办已保持原状。',
      completeAll: '全部完成',
      completeAllTitle: '完成本组全部待办',
      tomorrow: '延期明天',
      tomorrowTitle: '将本组全部待办延期到明天',
      dragToSchedule: '拖到日历日期上进行排期',
      markOpen: '恢复为待办',
      completeTask: '完成待办',
      repeats: '重复待办',
      startPomodoroTask: '专注此任务：启动并关联番茄钟',
      breakTaskAI: '用 AI 把这个任务拆解为子任务',
      moveTaskTomorrow: '延期到明天：保留任务并调整截止日期',
      editTaskTitle: '编辑：修改标题、日期、优先级和标签',
      deleteTask: '删除：永久移除此待办',
      showMore: ({ n }) => '显示更多（还剩 ' + n + ' 项）',
      openInSplit: '在分栏打开',
      moveUp: '上移',
      moveDown: '下移',
      desktopOnly: '此功能仅在桌面端可用。',
      openRelated: '查看关联待办列表',
      dragToReorder: '拖动排序',
      dragWelcome: '拖动欢迎窗口',
      dragOnboarding: '拖动新手引导窗口'
    }
  },
  en: {
    sections: {
      cats: 'Knowledge Areas',
      todos: 'Tasks',
      stats: 'Progress Stats',
      recent: 'Recent Updates',
      bookmarks: 'Starred Notes',
      flash: 'Quick Capture',
      focusChart: 'Focus Trend',
      alarms: 'Alarms',
      countdowns: 'Countdowns',
      habits: 'Habits',
      agenda: 'Today Timeline',
      weeklyReview: 'Weekly Review',
      projects: 'Project Progress',
      resurface: 'Resurface Old Notes',
      scheduledTasks: 'Scheduled Tasks',
      workflows: 'Workflows',
      reportStudio: 'Reports & review',
      heatmap: 'Edit Heatmap (30d)'
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
      ai: 'AI assistant',
      more: 'More',
      workLog: 'Work Log',
      todayNote: 'Today note',
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
      exportBackup: 'Export data backup',
      releaseNotes: 'Recent updates',
      checkUpdate: 'Check for updates'
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
        countdowns: 'Countdowns',
        calendar: 'Calendar',
        focusChart: 'Focus Trend',
        habits: 'Habits',
        agenda: 'Today Timeline',
        weeklyReview: 'Weekly Review',
        projects: 'Project Progress',
        resurface: 'Resurface Notes',
        footer: 'Footer'
      }
    },
    notices: {
      workLogMissing: '📝 Work log command is not configured',
      workLogFailed: ({ message }) => '📝 Work log failed: ' + message,
      workLogDone: '📝 Work log finished',
      commandNotAvailable: '⚙️ Command unavailable or not installed. Update it in the toolbar settings that just opened.'
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
      onlineSource: 'GitHub Releases · Full load · 30-minute cache',
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
      minimize: 'Compact timer',
      expand: 'Expand settings',
      modeFocus: 'Focus session',
      modeBreak: 'Break session',
      ready: 'Ready to focus',
      dragHint: 'Drag the header to move',
      start: 'Start',
      resume: 'Resume',
      pause: 'Pause',
      reset: '↺ Reset',
      focusToday: ({ minutes }) => 'Focus today: ' + minutes + ' min',
      focusPaused: 'Focus paused',
      breakPaused: 'Break paused',
      focusing: 'Focusing...',
      resting: 'On break...',
      completedOne: '✅ One Pomodoro done!',
      readyForBreak: 'Focus finished, ready for a break',
      startBreak: 'Start break',
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
      fullscreenReminder: 'Show completion in full screen',
      fullscreenHint: 'Also request window full screen when showing the completion layer',
      breakReminder: 'Also remind after break',
      breakReminderHint: 'Prompt for the next round after a break, independently of full screen',
      focusFinishedTitle: 'Focus complete',
      focusFinishedSubtitle: 'Nice work. Take a moment to move and reset.',
      breakFinishedTitle: 'Break complete',
      breakFinishedSubtitle: 'Start the next focus session when you are ready.'
    },
    alarm: {
      runningNote: 'Alarms ring while the app is running and recover within 10 minutes after wake.'
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
    },
    framework: {
      teamTodos: 'Team tasks',
      sceneDefault: 'Default layout',
      sceneUntitled: 'Untitled scene',
      deleteScene: ({ name }) => 'Delete “' + name + '”?',
      delete: 'Delete',
      saveCalViewFail: 'Could not save the calendar view preference.',
      saveCalWidthFail: 'Could not save the calendar column width.',
      saveTodosFail: 'Could not save tasks. Nothing was changed.',
      manageTips: 'Manage tips',
      nothingToBackup: 'Nothing to back up.',
      backupFailed: ({ msg }) => 'Backup failed: ' + msg,
      schedTaskFail: 'Could not schedule this task.',
      createTaskFail: 'Could not create this task.',
      openMeetingFail: ({ msg }) => 'Could not open the meeting note: ' + msg,
      automationOk: 'Automation completed.',
      automationFail: 'Automation failed. Check the audit log.',
      next: 'Next',
      filterByStatus: 'Filter tasks by status',
      statusFilter: 'Task status filter',
      archived: 'Archived',
      deferOverdueFail: 'Could not defer overdue tasks. Nothing was changed.',
      completeAll: 'Complete all',
      completeAllTitle: 'Complete every task in this group',
      tomorrow: 'Tomorrow',
      tomorrowTitle: 'Move every task in this group to tomorrow',
      dragToSchedule: 'Drag onto a calendar date to schedule',
      markOpen: 'Mark task open',
      completeTask: 'Complete task',
      repeats: 'Repeats',
      startPomodoroTask: 'Start a Pomodoro linked to this task',
      breakTaskAI: 'Break this task into subtasks with AI',
      moveTaskTomorrow: 'Move this task to tomorrow',
      editTaskTitle: 'Edit title, date, priority, and tags',
      deleteTask: 'Delete this task permanently',
      showMore: ({ n }) => 'Show more (' + n + ' remaining)',
      openInSplit: 'Open in split',
      moveUp: 'Move up',
      moveDown: 'Move down',
      desktopOnly: 'This action is only available on desktop.',
      openRelated: 'Open the related task list',
      dragToReorder: 'Drag to reorder',
      dragWelcome: 'Drag welcome window',
      dragOnboarding: 'Drag onboarding guide'
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

const DEFAULT_TODOS = [
  { text:'欢迎使用 Cockpit Dashboard，点击左侧圆圈即可完成这条待办', tags:['入门'], priority:'mid', dueDate:null, done:false, created:null, doneDate:null },
  { text:'试试右键点击空白区域，可以打开快捷菜单', tags:['入门'], priority:'low', dueDate:null, done:false, created:null, doneDate:null },
  { text:'点击标题栏可以把任意模块折叠或展开', tags:['入门'], priority:'low', dueDate:null, done:true, created:null, doneDate:null }
];
