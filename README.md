# Cockpit Dashboard

中文 | [English](#english)

Cockpit Dashboard 是一个面向 Obsidian Vault 的驾驶舱式首页插件，用来替代默认首页，集中展示待办、日历、统计、最近文件、收藏、搜索和专注计时等信息。

Cockpit Dashboard is a cockpit-style homepage plugin for Obsidian. It replaces the default home view with a focused dashboard for tasks, calendar, stats, recent files, bookmarks, search, and focus tracking.

## 中文

### 项目简介

这个插件的目标不是只做一个“漂亮主页”，而是把你每天会用到的知识库操作集中在一个面板里：

- 看今天和本月的待办节奏
- 快速搜索和打开笔记
- 查看知识库统计和最近更新
- 启动番茄钟、Hermes、外部驾驶舱 H5、工作日志
- 通过右键菜单在首页空白区域快速执行常见操作

### 主要功能

| 功能 | 说明 |
|---|---|
| 👋 欢迎区 | 根据时间显示问候语，支持直接修改昵称，并展示临期待办提醒 |
| 💡 每日技巧 | 内置运维/开发提示，每天轮换 |
| 🧰 工具栏 | 新建笔记、搜索、标签、图谱、命令、Hermes、驾驶舱 H5、工作日志、番茄钟 |
| 🖱️ 右键菜单 | 在首页空白区域弹出快捷菜单，支持刷新页面、新建笔记、搜索、命令面板、图谱、番茄钟 |
| 📅 日历看板 | 月视图切换、日期选中、待办点位提示、日详情面板、勾选同步 |
| ✅ 待办管理 | 状态筛选（全部/待办/已办）、动态标签页签、优先级、截止日期、编辑、删除 |
| 📊 统计卡片 | 笔记总数、待办总数、已完成、完成率、今日专注时长 |
| 📂 分类卡片 | 展示顶层目录，点击可跳到概览/MOC 类文件 |
| ✏️ 最近更新 | 按最近修改时间展示笔记，支持一键打开 |
| ⭐ 收藏文件 | 收藏/取消收藏重要笔记，并与最近更新区联动 |
| ⚡ 闪念胶囊 | 快速记录想法到 `_daily/YYYY-MM-DD.md` |
| 📈 编辑热力图 | 展示近 30 天编辑频率 |
| 🍅 番茄钟 | 浮动全局单例，可拖拽，25+5 循环，专注数据写入 `_data/focus.md` |
| 🤖 Hermes | 打开 Obsidian 集成终端并尝试启动 `hermes --tui` |
| 🛩️ 驾驶舱 H5 / 📝 工作日志 | 通过 `_data/toolbar.md` 自定义启动命令和目标地址 |
| 🧭 首次引导 | 首次打开显示分步引导，可跳过并记住状态 |
| 📦 折叠面板 | 分类、统计、待办、最近更新、闪念、热力图等区块支持折叠状态持久化 |

### 安装方式

#### 方式一：通过 BRAT 安装

1. 在 Obsidian 社区插件中安装 [BRAT](https://obsidian.md/plugins?search=BRAT)
2. 打开 BRAT 设置，选择 `Add Beta plugin`
3. 输入仓库地址：

```text
https://github.com/sadom125/Cockpit-Dashboard
```

4. 回到社区插件列表，启用 `Cockpit Dashboard`

#### 方式二：手动安装

1. 从 [GitHub Releases](https://github.com/sadom125/Cockpit-Dashboard/releases) 下载以下文件：

- `main.js`
- `manifest.json`
- `styles.css`

2. 将它们复制到：

```text
.obsidian/plugins/cockpit-dashboard/
```

3. 刷新或重载 Obsidian 插件，然后启用 `Cockpit Dashboard`

### 数据文件

插件运行时会使用或生成这些文件：

| 文件 | 作用 |
|---|---|
| `_data/todos.md` | 待办数据 |
| `_data/bookmarks.md` | 收藏文件列表 |
| `_data/focus.md` | 当日专注分钟数 |
| `_data/toolbar.md` | 驾驶舱 H5 / 工作日志等自定义命令 |
| `_daily/YYYY-MM-DD.md` | 闪念胶囊写入位置 |

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

### 开发说明

```bash
cd ~/Downloads/cockpit-dashboard
node build.js
bash deploy.sh
```

构建逻辑：

- `build.js` 会拼接 `src/` 下模块并生成 `main.js`
- `deploy.sh` 会构建并同步到本地 Obsidian 插件目录
- `data.json` 为用户配置文件，部署时不会覆盖

### 当前版本

- Manifest version: `1.0.6`

---

## English

### Overview

Cockpit Dashboard is designed to be more than a visual landing page. It centralizes the actions you actually use every day in your Obsidian vault:

- Track today’s and this month’s tasks
- Search and open notes quickly
- Check vault stats and recent edits
- Launch Pomodoro, Hermes, external Cockpit H5, and work-log tooling
- Use a context menu in blank dashboard space for common quick actions

### Features

| Feature | Description |
|---|---|
| 👋 Greeting Hero | Time-based greeting, inline editable name, and due-task reminders |
| 💡 Daily Tip | Built-in rotating dev/ops tips |
| 🧰 Toolbar | New note, search, tags, graph, command palette, Hermes, Cockpit H5, work log, Pomodoro |
| 🖱️ Context Menu | Right-click in blank dashboard space for refresh, new note, search, command palette, graph, and Pomodoro |
| 📅 Calendar Board | Monthly view, date selection, todo markers, day-detail panel, and sync back to task state |
| ✅ Todo Manager | Status filters, dynamic tag tabs, priority, due dates, edit/delete, and completion sync |
| 📊 Stats Cards | Note count, todo count, completed count, completion rate, and today’s focus minutes |
| 📂 Category Cards | Top-level folder overview cards with quick navigation to overview/MOC notes |
| ✏️ Recent Files | Recently modified notes with one-click open |
| ⭐ Bookmarks | Bookmark important files and keep them synced with the recent section |
| ⚡ Flash Notes | Quick capture into `_daily/YYYY-MM-DD.md` |
| 📈 Heatmap | 30-day edit activity heatmap |
| 🍅 Pomodoro | Draggable floating singleton timer with 25/5 cycle and persisted focus tracking |
| 🤖 Hermes | Opens Obsidian’s integrated terminal and tries to run `hermes --tui` |
| 🛩️ Cockpit H5 / 📝 Work Log | Custom launch commands configured through `_data/toolbar.md` |
| 🧭 Onboarding | First-run guided tour with persistent completion state |
| 📦 Collapsible Sections | Persistent collapsed state for dashboard sections |

### Installation

#### Option 1: Install with BRAT

1. Install [BRAT](https://obsidian.md/plugins?search=BRAT) from Obsidian Community Plugins
2. Open BRAT settings and choose `Add Beta plugin`
3. Paste the repository URL:

```text
https://github.com/sadom125/Cockpit-Dashboard
```

4. Enable `Cockpit Dashboard` in Community Plugins

#### Option 2: Manual Installation

1. Download the latest files from [GitHub Releases](https://github.com/sadom125/Cockpit-Dashboard/releases):

- `main.js`
- `manifest.json`
- `styles.css`

2. Copy them into:

```text
.obsidian/plugins/cockpit-dashboard/
```

3. Reload Obsidian plugins and enable `Cockpit Dashboard`

### Runtime Files

| File | Purpose |
|---|---|
| `_data/todos.md` | Todo storage |
| `_data/bookmarks.md` | Bookmarked files |
| `_data/focus.md` | Today’s focus minutes |
| `_data/toolbar.md` | Custom commands for Cockpit H5 / work log |
| `_daily/YYYY-MM-DD.md` | Flash note destination |

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

### Development

```bash
cd ~/Downloads/cockpit-dashboard
node build.js
bash deploy.sh
```

Build notes:

- `build.js` bundles modules from `src/` into `main.js`
- `deploy.sh` builds and syncs files into the local Obsidian plugin directory
- `data.json` stores user configuration and is not overwritten during deploy

### Current Version

- Manifest version: `1.0.6`

## Author

- GitHub: [sadom125](https://github.com/sadom125)
