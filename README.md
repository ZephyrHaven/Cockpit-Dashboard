# Cockpit Dashboard

[![Release](https://img.shields.io/github/v/release/sadom125/Cockpit-Dashboard?style=for-the-badge)](https://github.com/sadom125/Cockpit-Dashboard/releases)
[![Support on Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-Support%20Zephyr%20Haven-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

中文 | [English](#english)

Cockpit Dashboard 是一个面向 Obsidian Vault 的驾驶舱式首页插件，用来替代默认首页，集中展示待办、日历、统计、最近文件、收藏、搜索和专注计时等信息，并支持可持久化的模块布局编辑、局部静默刷新与轻量化悬浮番茄钟。

Cockpit Dashboard is a cockpit-style homepage plugin for Obsidian. It replaces the default home view with a focused dashboard for tasks, calendar, stats, recent files, bookmarks, search, focus tracking, plus persistent layout customization, partial silent refresh, and a lighter floating Pomodoro.

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
| 💡 每日技巧 | 内置运维/开发提示，每天轮换 |
| 🧰 工具栏 | 新建笔记、搜索、标签、图谱、命令、Hermes、驾驶舱 H5、工作日志、番茄钟 |
| 🧩 编辑模式 | 支持模块上下拖动排序、隐藏/恢复模块，并持久化保存布局；也可单独隐藏 Toolbar 按钮 |
| 🖱️ 右键菜单 | 在首页空白区域弹出快捷菜单，支持刷新页面、新建笔记、搜索、命令面板、图谱、番茄钟、最近更新记录、进入编辑模式 |
| 📅 日历看板 | 紧凑月视图、月份切换动画、日期选中、待办点位提示、日详情面板、勾选同步 |
| ✅ 待办管理 | 状态筛选（全部/待办/已办）、动态标签页签、优先级、截止日期、编辑、删除 |
| 📊 统计卡片 | 笔记总数、待办总数、已完成、完成率、今日专注时长 |
| 📂 分类卡片 | 展示顶层目录，点击可跳到概览/MOC 类文件 |
| ✏️ 最近更新 | 按最近修改时间展示笔记，支持一键打开 |
| 📝 更新记录 | 内置本地版本记录弹窗，可在右键菜单中查看最近版本、日期和更新内容 |
| ⭐ 收藏文件 | 收藏/取消收藏重要笔记，并与最近更新区联动 |
| ⚡ 闪念胶囊 | 快速记录想法到 `_daily/YYYY-MM-DD.md` |
| 📈 编辑热力图 | 展示近 30 天编辑频率 |
| 🍅 番茄钟 | 浮动全局单例，可拖拽，深浅色适配；小视图以倒计时为主，大视图更精简，25+5 循环，休息结束会提示继续专注，专注数据会按日期累计写入 `_data/focus.md` |
| 🌐 多语言界面 | 支持 `中文 / EN` 一键切换，覆盖首页主要文案并持久化语言设置，且语言开关会适配深浅色模式 |
| ✨ 交互动效 | 语言切换、工具栏、筛选和卡片增加 hover / press 反馈，让点击更有层次 |
| 🤖 Hermes | 优先打开 Obsidian 集成终端启动 Hermes，失败时可回退到系统终端，也支持通过 `_data/toolbar.md` 自定义命令 |
| 🛩️ 驾驶舱 H5 / 📝 工作日志 | 通过 `_data/toolbar.md` 自定义启动命令和目标地址 |
| 🧭 首次引导 | 首次打开显示分步引导，可跳过并记住状态 |
| 📦 折叠面板 | 分类、统计、待办、最近更新、闪念、热力图等区块支持折叠状态持久化 |

### 安装方式



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
| `_data/focus.md` | 按日期累计的专注历史记录 |
| `_data/toolbar.md` | Hermes / 驾驶舱 H5 / 工作日志等自定义命令 |
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
# 或部署压缩版入口
bash deploy.sh --min
```

构建逻辑：

- `build.js` 会拼接 `src/` 下模块并生成 `main.js` 与 `main.min.js`
- `deploy.sh` 默认部署可读版 `main.js`，`deploy.sh --min` 会把 `main.min.js` 部署为插件入口
- `data.json` 为用户配置文件，部署时不会覆盖

### 当前版本

- Manifest version: `1.0.9`
- Latest update date: `2026-07-08`

### 1.0.9 最近更新

- 番茄钟专注记录改为按日期累计保存到 `_data/focus.md`，历史数据不会再被当天覆盖。
- 保留局部静默刷新、轻量化番茄钟浮窗和 Toolbar 可定制能力。
- 应用内“最近更新记录”弹窗已同步这版说明。

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
| 💡 Daily Tip | Built-in rotating dev/ops tips |
| 🧰 Toolbar | New note, search, tags, graph, command palette, Hermes, Cockpit H5, work log, Pomodoro |
| 🧩 Edit Mode | Drag modules to reorder them, hide/show sections, persist your dashboard layout, and optionally hide individual toolbar buttons |
| 🖱️ Context Menu | Right-click in blank dashboard space for refresh, new note, search, command palette, graph, Pomodoro, recent updates, and Edit Mode |
| 📅 Calendar Board | Compact monthly view, month-switch animation, date selection, todo markers, detail panel, and task-state sync |
| ✅ Todo Manager | Status filters, dynamic tag tabs, priority, due dates, edit/delete, and completion sync |
| 📊 Stats Cards | Note count, todo count, completed count, completion rate, and today’s focus minutes |
| 📂 Category Cards | Top-level folder overview cards with quick navigation to overview/MOC notes |
| ✏️ Recent Files | Recently modified notes with one-click open |
| 📝 Release Notes | Built-in local update-history modal with versions, dates, and highlights |
| ⭐ Bookmarks | Bookmark important files and keep them synced with the recent section |
| ⚡ Flash Notes | Quick capture into `_daily/YYYY-MM-DD.md` |
| 📈 Heatmap | 30-day edit activity heatmap |
| 🍅 Pomodoro | Draggable floating singleton timer with light/dark support, a countdown-first compact view, a cleaner expanded panel, a 25/5 cycle, break-finished reminders, and focus history persisted by date |
| 🌐 Multi-language UI | One-tap `中文 / EN` switching with persisted preference and better light/dark readability |
| ✨ Interaction Polish | Hover and press feedback for language toggle, toolbar actions, filters, and cards |
| 🤖 Hermes | Prefers Obsidian’s integrated terminal, can fall back to the system terminal, and supports custom launch commands via `_data/toolbar.md` |
| 🛩️ Cockpit H5 / 📝 Work Log | Custom launch commands configured through `_data/toolbar.md` |
| 🧭 Onboarding | First-run guided tour with persistent completion state |
| 📦 Collapsible Sections | Persistent collapsed state for dashboard sections |

### Installation

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
| `_data/focus.md` | Focus history accumulated by date |
| `_data/toolbar.md` | Custom commands for Hermes / Cockpit H5 / work log |
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
# Or deploy the minified entry
bash deploy.sh --min
```

Build notes:

- `build.js` bundles modules from `src/` into `main.js` and `main.min.js`
- `deploy.sh` ships the readable `main.js` by default, while `deploy.sh --min` deploys `main.min.js` as the plugin entry
- `data.json` stores user configuration and is not overwritten during deploy

### Current Version

- Manifest version: `1.0.9`
- Latest update date: `2026-07-08`

### What’s New in 1.0.9

- Pomodoro focus logs now accumulate by date in `_data/focus.md`, so history is preserved instead of being overwritten by the current day.
- This release also keeps the partial silent refresh, lighter Pomodoro panel, and customizable Toolbar workflow.
- The in-app local release-notes modal has been updated to match this release.

### Sponsor

If this plugin saves you time, you can support the author here:

[![Support on Afdian](https://img.shields.io/badge/Afdian-Support%20the%20Author-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

Direct link:

- [https://afdian.com/a/zephyrhaven](https://afdian.com/a/zephyrhaven)

## Author

- GitHub: [sadom125](https://github.com/sadom125)
