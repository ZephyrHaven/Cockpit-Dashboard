# Cockpit Dashboard

[![Release](https://img.shields.io/github/v/release/ZephyrHaven/Cockpit-Dashboard?style=for-the-badge)](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases)
[![Support on Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-Support%20Zephyr%20Haven-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

中文 | [English](#english)

Cockpit Dashboard 是一个本地优先的 Obsidian 驾驶舱首页：待办、日历、搜索、统计、收藏和专注计时放在一处，也支持布局编辑与静默刷新。

Cockpit Dashboard is a local-first Obsidian dashboard for tasks, calendar, search, stats, bookmarks, and focus tracking, with persistent layout customization and silent refresh.

## 中文

### 项目简介

这个插件的目标不是只做一个“漂亮主页”，而是把你每天会用到的知识库操作集中在一个面板里：

- 看今天和本月的待办节奏
- 快速搜索和打开笔记
- 查看知识库统计和最近更新
- 按自己的习惯调整模块顺序与可见性
- 在不打断当前输入或编辑的情况下静默刷新首页数据
- 启动番茄钟、Hermes、外部驾驶舱 H5、工作日志
- 通过右键菜单在首页空白区域快速执行常见操作

### 主要功能

| 功能 | 说明 |
|---|---|
| 👋 欢迎区 | 根据时间显示问候语，支持直接修改昵称，并展示临期待办提醒 |
| 🔄 静默刷新 | 按分钟刷新问候语，按周期局部刷新待办 / 日历 / 最近更新 / 收藏，尽量避开输入与编辑态 |
| 💡 每日一语 | 内置提示每天轮换；编辑模式下可按当前语言维护、排序并选择轮询方式 |
| 🧰 工具栏 | 新建笔记、全局搜索、标签、图谱、命令、Hermes、驾驶舱 H5、工作日志、番茄钟；编辑模式支持拖拽排序、显示/隐藏和自定义按钮，保存时局部更新工具栏 |
| 🔍 全局搜索 | Spotlight 风格悬浮搜索，支持文件名、路径和笔记正文，带输入防抖、键盘选择和可拖动窗口；也可通过 Obsidian 命令快捷呼出 |
| 🧩 编辑模式 | 所有仪表盘模块统一支持上下拖动排序、显示/隐藏、折叠状态持久化与情景布局；也可单独隐藏 Toolbar 按钮 |
| 🖱️ 右键菜单 | 在首页空白区域弹出快捷菜单，支持刷新页面、新建笔记、搜索、命令面板、图谱、番茄钟、最近更新记录、进入编辑模式 |
| 📅 日历看板 | 紧凑月视图、月份切换动画、日期选中、待办点位提示、日详情面板、快捷新增/编辑和勾选同步；支持多源 RSS、日期总数、未读角标与已读/未读文章状态 |
| 📰 RSS 阅读器 | 可在日常模式打开的双栏订阅阅读器，支持来源筛选、文章卡片、结构化正文、链接/图片、全局朗读播放器、右键快捷操作，以及公共/单源正文过滤词 |
| ✅ 待办管理 | 下拉状态筛选、动态标签页签、优先处理（高优先级或明天到期）、优先级、截止日期、一键延期、编辑和删除 |
| 📊 统计卡片 | 笔记总数、待办总数、已完成、完成率、今日专注时长 |
| 🍅 专注趋势 | 默认隐藏、可在编辑模式启用；从 `_data/focus.md` 汇总近 7 / 30 天专注时长，并支持平滑折线与柱状图切换 |
| 📂 分类卡片 | 展示顶层目录，优先打开概览/MOC 类文件；没有概览时打开分类中的第一篇笔记，空目录会明确提示 |
| ✏️ 最近更新 | 按最近修改时间展示笔记，支持一键打开 |
| 📝 更新记录 | 内置本地版本记录弹窗，可在右键菜单中查看最近版本、日期和更新内容 |
| ⭐ 收藏文件 | 收藏/取消收藏重要笔记，与最近更新区联动；支持折叠、固定排序、上下调整及一键在分栏打开 |
| ⚡ 闪念胶囊 | 快速记录想法到 `_daily/YYYY-MM-DD.md` |
| 📈 编辑热力图 | 展示近 30 天编辑频率 |
| 🍅 番茄钟 | 可拖拽的全局单例，支持 25+5 循环与深浅色；编辑模式可关闭“自动显示”。进行中或暂停中的计时会在刷新后恢复，并会跟随 Obsidian 自动切换深浅主题；专注历史写入 `_data/focus.md` |
| 🔔 消息推送 | 可选集成 Server酱³、Bark 与 MEOW。可同时启用多个渠道，支持每天、指定星期或指定月日的秒级定时推送，以及今日到期 / 逾期待办汇总或自定义正文 |
| 🌐 多语言界面 | 支持 `中文 / EN` 一键切换，覆盖首页主要文案并持久化语言设置，且语言开关会适配深浅色模式 |
| ✨ 交互动效 | 语言切换、工具栏、筛选和卡片增加 hover / press 反馈，让点击更有层次 |
| 🤖 Hermes | 统一通过 macOS 系统终端启动，不依赖 Obsidian 集成终端；迁移前仍支持通过 `_data/toolbar.md` 自定义命令 |
| 🛩️ 驾驶舱 H5 / 📝 工作日志 | 通过 `_data/toolbar.md` 自定义启动命令和目标地址 |
| 🧭 首次引导 | 首次打开显示分步引导，可跳过并记住状态 |
| 📦 折叠面板 | 分类、统计、待办、专注趋势、最近更新、收藏、闪念、热力图等区块支持折叠状态持久化 |

### 安装方式

#### 通过 Obsidian 社区插件市场安装（推荐）

Cockpit Dashboard 已上架 Obsidian 社区插件市场：

1. 打开 Obsidian 的 **设置 → 第三方插件 → 浏览**。
2. 搜索 **Cockpit Dashboard**。
3. 点击“安装”，安装完成后启用插件。

#### 手动安装

1. 从 [GitHub Releases](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases) 下载以下文件：

- `main.js`
- `manifest.json`
- `styles.css`

2. 将它们复制到：

```text
.obsidian/plugins/cockpit-dashboard/
```

3. 刷新或重载 Obsidian 插件，然后启用 `Cockpit Dashboard`

### 本地优先与用户数据权利

你的数据归你：插件不收集或上传 Vault 数据，也没有遥测。数据迁移、清理和本地命令都需要你主动操作；插件产生的数据尽量使用 Markdown 和 JSON，便于查看、备份与删除。第三方推送或自定义命令仅在你自行启用时才会访问外部服务。

### 数据文件

插件运行时会使用或生成这些文件：

| 文件 | 作用 |
|---|---|
| `_data/todos.md` | 待办数据 |
| 插件 `data.json` | Storage V2 设置、自定义按钮、收藏、排序、Toolbar 命令与 RSS 订阅/过滤配置（不含正文缓存） |
| 浏览器 IndexedDB | 当前设备的 RSS 正文摘要、已读状态和受限缓存；不参与 Obsidian Sync，可随时在 RSS 菜单清除 |
| `_data/bookmarks.md` | 未完成数据迁移时的收藏存储；迁移后停止写入，可由用户主动清理 |
| `_data/focus.md` | 按日期累计的专注历史记录 |
| `_data/toolbar.md` | 未完成数据迁移时的 Toolbar 命令配置；迁移后停止读取和写入 |
| `.obsidian/plugins/cockpit-dashboard/logs/toolbar-runs.jsonl` | 最近 100 次自定义脚本运行日志，最大约 1 MB，不记录脚本文本 |
| `_daily/YYYY-MM-DD.md` | 闪念胶囊写入位置 |

### Storage V2 与数据迁移

- 迁移不会自动进行；未迁移时，收藏和 Toolbar 配置继续使用旧 `_data` 文件。
- 在“数据迁移”引导中确认后，配置会复制到插件 `data.json`；旧文件会保留，直到你主动清理。
- 待办与专注历史始终使用可读的 Markdown；清理旧配置不会删除它们。

### 待办语法

在 `_data/todos.md` 中可以使用：

```markdown
- [ ] 普通待办
- [x] 已完成待办 | created: 2026-06-01 | done: 2026-06-02
- [ ] 高优先级待办 p:high
- [ ] 带截止日期 due:2026-07-10
- [ ] 带标签 #work #urgent
- [ ] 组合写法 #project due:2026-07-10 p:low
```

说明：

- `#tag` 用于标签
- `due:YYYY-MM-DD` 用于截止日期
- `p:high | p:mid | p:low` 用于优先级
- `created:` 与 `done:` 由插件保存时自动维护

### 消息推送（Server酱³）

在 **设置 → Cockpit Dashboard → 消息推送** 中启用。可分别开启 Server酱³、Bark 和 MEOW，并用各渠道自己的“发送测试”按钮验证配置。

- Server酱³：推荐粘贴 SendKey 页面的完整 API URL；也可填写 UID 与 SendKey，请求使用 `cockpit` 分类标签。
- Bark：填写 HTTPS 服务地址（默认 `https://api.day.app`）、Device Key 和可选分组。支持官方服务及 HTTPS 自建服务。
- MEOW：填写 App 中的用户昵称；插件使用官方 HTTPS Markdown 接口发送内容。
- 计划可选择每天、每周指定星期或每月指定日期，并设置精确到秒的发送时间。
- 未填写自定义正文时，仅在存在“今日到期”或“已逾期”的未完成待办时推送汇总。
- 填写自定义正文后，会在计划时间发送；正文保持原样，系统仅附上日期与时间。
- 各渠道逐一记录同一计划时段的发送状态；某个渠道失败不会阻断其他渠道。Obsidian 必须保持运行，才能执行本地定时检查。

### 开发说明

```bash
cd ~/Downloads/cockpit-dashboard
node build.js
bash deploy.sh
# 或部署压缩版入口
bash deploy.sh --min
```

构建逻辑：

- `build.js` 会拼接 `src/` 下模块并生成 `main.js` 与 `main.min.js`
- `deploy.sh` 默认部署可读版 `main.js`，`deploy.sh --min` 会把 `main.min.js` 部署为插件入口
- `data.json` 为用户配置文件，部署时不会覆盖

### 当前版本

- Manifest version: `1.1.2`
- Latest update date: `2026-07-27`

### 1.1.2 最近更新

- 新增日历 RSS 订阅：支持多源筛选、日期总数、已读状态、正文过滤、仅本机缓存、顶部全局播放器与跨日静默更新。

### 1.1.1 最近更新

- 新增情景布局，让模块和 Toolbar 可按不同工作场景独立保存、排序、显示和折叠。
- 每日一语与 Toolbar 编辑支持按当前语言维护、拖拽调整和局部保存。
- 新增默认隐藏的专注趋势，可查看近 7 / 30 天记录并切换折线或柱状图。
- 番茄钟支持自动显示控制，并会随 Obsidian 切换深浅主题。

### 赞助作者

如果这个插件确实帮你省了时间，欢迎请作者喝一杯：

[![爱发电 / Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-%E8%AF%B7%E4%BD%9C%E8%80%85%E5%96%9D%E4%B8%80%E6%9D%AF-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

也可以直接访问：

- [https://afdian.com/a/zephyrhaven](https://afdian.com/a/zephyrhaven)

---

## English

### Overview

Cockpit Dashboard is designed to be more than a visual landing page. It centralizes the actions you actually use every day in your Obsidian vault:

- Track today’s and this month’s tasks
- Search and open notes quickly
- Check vault stats and recent edits
- Reorder and hide dashboard modules based on your own workflow
- Refresh key dashboard regions silently without disrupting active editing
- Launch Pomodoro, Hermes, external Cockpit H5, and work-log tooling
- Use a context menu in blank dashboard space for common quick actions

### Features

| Feature | Description |
|---|---|
| 👋 Greeting Hero | Time-based greeting, inline editable name, and due-task reminders |
| 🔄 Silent Refresh | Minute-level greeting refresh plus periodic partial refresh for todos, calendar, recent files, and bookmarks while avoiding active input/edit states |
| 💡 Daily Note | Built-in tips rotate daily; Edit Mode supports per-language editing, sorting, and rotation modes |
| 🧰 Toolbar | New note, global search, tags, graph, command palette, Hermes, Cockpit H5, work log, and Pomodoro; Edit Mode supports sorting, visibility controls, custom buttons, and local Toolbar updates on save |
| 🔍 Global Search | Draggable Spotlight-style search across note names, paths, and content, with input debouncing, keyboard navigation, and an Obsidian command entry point |
| 🧩 Edit Mode | All dashboard modules share drag reordering, visibility controls, persistent collapsed state, and layout-scene support; individual toolbar buttons can also be hidden |
| 🖱️ Context Menu | Right-click in blank dashboard space for refresh, new note, search, command palette, graph, Pomodoro, recent updates, and Edit Mode |
| 📅 Calendar Board | Compact monthly view, month-switch animation, date selection, todo markers, detail panel, quick create/edit, and task-state sync; supports multi-source RSS, daily totals, unread badges, and read/unread articles |
| 📰 RSS Reader | Daily-access two-pane subscription reader with source filters, article cards, structured text, links/images, a global text-to-speech player, context-menu actions, and shared/per-source content filters |
| ✅ Todo Manager | Compact status dropdown, dynamic tag tabs, Next filtering for high-priority or tomorrow-due tasks, priority, due dates, one-click deferral, edit/delete, and completion sync |
| 📊 Stats Cards | Note count, todo count, completed count, completion rate, and today’s focus minutes |
| 🍅 Focus Trend | Hidden by default and enabled from Edit Mode; summarizes 7/30-day focus history from `_data/focus.md` with smooth line and bar chart views |
| 📂 Category Cards | Top-level folder cards that prefer overview/MOC notes, fall back to the first note, and clearly report empty folders |
| ✏️ Recent Files | Recently modified notes with one-click open |
| 📝 Release Notes | Built-in local update-history modal with versions, dates, and highlights |
| ⭐ Bookmarks | Bookmark important files, keep them synced with recent files, collapse the section, persist ordering, move items, and open a note in a split pane |
| ⚡ Flash Notes | Quick capture into `_daily/YYYY-MM-DD.md` |
| 📈 Heatmap | 30-day edit activity heatmap |
| 🍅 Pomodoro | Draggable global timer with a 25/5 cycle and light/dark support. Edit Mode can disable auto-show; active or paused sessions return after refresh and follow Obsidian’s automatic light/dark theme changes, while focus history is saved by date |
| 🔔 Message Notifications | Optional ServerChan³, Bark, and MEOW delivery. Enable multiple channels at once with second-level daily, weekday, or monthly schedules, task summaries, or a custom body |
| 🌐 Multi-language UI | One-tap `中文 / EN` switching with persisted preference and better light/dark readability |
| ✨ Interaction Polish | Hover and press feedback for language toggle, toolbar actions, filters, and cards |
| 🤖 Hermes | Always launches through the macOS system Terminal without depending on Obsidian’s integrated terminal; legacy custom commands remain available through `_data/toolbar.md` before migration |
| 🛩️ Cockpit H5 / 📝 Work Log | Custom launch commands configured through `_data/toolbar.md` |
| 🧭 Onboarding | First-run guided tour with persistent completion state |
| 📦 Collapsible Sections | Persistent collapsed state for categories, stats, todos, Focus Trend, recent files, bookmarks, flash notes, heatmap, and other registered modules |

### Installation

#### Install from Obsidian Community Plugins (recommended)

Cockpit Dashboard is available in the Obsidian Community Plugins marketplace:

1. Open **Settings → Community plugins → Browse** in Obsidian.
2. Search for **Cockpit Dashboard**.
3. Select **Install**, then enable the plugin when installation finishes.

#### Manual installation

1. Download the latest files from [GitHub Releases](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases):

- `main.js`
- `manifest.json`
- `styles.css`

2. Copy them into:

```text
.obsidian/plugins/cockpit-dashboard/
```

3. Reload Obsidian plugins and enable `Cockpit Dashboard`

### Local-first and user data rights

Your data stays yours: the plugin does not collect or upload Vault data and includes no telemetry. Migration, cleanup, and local commands require your action. Plugin data uses readable Markdown and JSON where possible, and third-party services are contacted only when you enable them.

### Runtime Files

| File | Purpose |
|---|---|
| `_data/todos.md` | Todo storage |
| Plugin `data.json` | Storage V2 settings, custom buttons, bookmarks, ordering, Toolbar commands, and RSS subscription/filter configuration (not article cache) |
| Browser IndexedDB | Device-local RSS summaries, read states, and bounded cache; excluded from Obsidian Sync and removable from the RSS menu |
| `_data/bookmarks.md` | Bookmark storage before migration; no longer written after migration and removable by the user |
| `_data/focus.md` | Focus history accumulated by date |
| `_data/toolbar.md` | Toolbar command configuration before migration; no longer read or written after migration |
| `.obsidian/plugins/cockpit-dashboard/logs/toolbar-runs.jsonl` | Last 100 custom-script runs, capped near 1 MB; script source is not logged |
| `_daily/YYYY-MM-DD.md` | Flash note destination |

### Storage V2 and data migration

- Migration is never automatic. Before it runs, bookmarks and Toolbar configuration keep using legacy `_data` files.
- After you confirm the guide, configuration is copied to plugin `data.json`; old files remain until you explicitly clean them.
- Todos and focus history always remain readable Markdown, and cleanup never deletes them.

### Todo Syntax

```markdown
- [ ] Normal task
- [x] Completed task | created: 2026-06-01 | done: 2026-06-02
- [ ] High priority p:high
- [ ] Due soon due:2026-07-10
- [ ] Tagged task #work #urgent
- [ ] Combined syntax #project due:2026-07-10 p:low
```

Notes:

- `#tag` adds tags
- `due:YYYY-MM-DD` sets a due date
- `p:high | p:mid | p:low` sets priority
- `created:` and `done:` are maintained automatically by the plugin

### Message Notifications (ServerChan³)

Enable this under **Settings → Cockpit Dashboard → Message notifications**. ServerChan³, Bark, and MEOW can be enabled independently and each has its own test button.

- ServerChan³: paste the complete API URL from the SendKey page, or provide a UID and SendKey. Requests carry the `cockpit` category tag.
- Bark: enter an HTTPS server URL (default: `https://api.day.app`), Device Key, and optional group. Official and HTTPS self-hosted servers are supported.
- MEOW: enter the nickname used in the App; the plugin sends through its official HTTPS Markdown endpoint.
- Choose daily, selected weekdays, or selected month days, then set a delivery time including seconds.
- Without a custom body, a summary is sent only when there are incomplete tasks due today or overdue.
- With a custom body, it is sent on schedule without template syntax; the body remains unchanged and the system adds the date and time.
- Each channel records its own delivery state per schedule slot, so one failing channel does not block the others. Obsidian must remain running for the local scheduler to run.

### Development

```bash
cd ~/Downloads/cockpit-dashboard
node build.js
bash deploy.sh
# Or deploy the minified entry
bash deploy.sh --min
```

Build notes:

- `build.js` bundles modules from `src/` into `main.js` and `main.min.js`
- `deploy.sh` ships the readable `main.js` by default, while `deploy.sh --min` deploys `main.min.js` as the plugin entry
- `data.json` stores user configuration and is not overwritten during deploy

### Current Version

- Manifest version: `1.1.2`
- Latest update date: `2026-07-27`

### What’s New in 1.1.2

- Added calendar RSS subscriptions with multi-source filtering, daily totals, read state, content filters, device-local cache, a top-level player for reading the current article aloud, and silent date-change updates.

### What’s New in 1.1.1

- Added layout scenes for independently saving, ordering, showing, and collapsing modules and Toolbar items by workflow.
- Daily Note and Toolbar editing now support language-aware maintenance, drag adjustment, and local saves.
- Added a hidden-by-default Focus Trend with 7/30-day history and line or bar views.
- Pomodoro supports auto-show control and follows Obsidian’s light/dark theme.

### Sponsor

If this plugin saves you time, you can support the author here:

[![Support on Afdian](https://img.shields.io/badge/Afdian-Support%20the%20Author-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

Direct link:

- [https://afdian.com/a/zephyrhaven](https://afdian.com/a/zephyrhaven)

## Author

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
