// constants.js — 全局常量（纯数据，无函数）

const VIEW_TYPE = 'cockpit-dashboard';
const PLUGIN_ID = 'cockpit-dashboard';
const TODO_FILE = '_data/todos.md';
const BOOKMARK_FILE = '_data/bookmarks.md';

const E = { wave:'👋', search:'🔍', tag:'🏷️', graph:'🕸️', bolt:'⚡', folder:'📂', rule:'📋', gear:'⚙️', robot:'🤖', box:'📦', chart:'📊', pencil:'✏️', check:'✅', save:'💾', edit:'✏️', del:'✕', cal:'📅' };
const T = { cats:'📂 知识分类', todos:'✅ 待办事项', stats:'📊 统计进度', recent:'✏️ 最近更新' };
const COLORS = ['#818cf8','#f59e0b','#3b82f6','#22c55e','#ec4899','#14b8a6','#f97316','#6366f1'];
const ICONS  = ['📁','📂','🗂️','📋','📌','🏷️','🔖','📊'];

const DAILY_TIPS = [
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
];

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
