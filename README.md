# Cockpit Dashboard

[![Release](https://img.shields.io/github/v/release/ZephyrHaven/Cockpit-Dashboard?style=for-the-badge)](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases)
[![Support on Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-Support%20Zephyr%20Haven-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

中文 | [English](#english)

Cockpit Dashboard 是一个本地优先的 Obsidian 驾驶舱首页：把待办、日历、RSS、搜索、AI 助手、统计、收藏、专注计时与本地自动化集中在一个可自由编排的工作台中。

Cockpit Dashboard is a local-first Obsidian workspace for tasks, calendar, RSS, search, an optional AI assistant, statistics, bookmarks, focus tracking, and trusted local automation, with persistent layout scenes.

## 中文

### 项目简介

这个插件的目标不是只做一个“漂亮主页”，而是把你每天会用到的知识库操作集中在一个面板里：

- 看今天和本月的待办节奏
- 快速搜索和打开笔记
- 使用可选的 AI 助手组合多篇笔记与临时文本附件，进行总结、提取待办或继续追问
- 查看知识库统计和最近更新
- 按自己的习惯调整模块顺序与可见性
- 为工作、阅读、回顾等场景保存不同布局，并按时间或文件夹自动切换
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
| 🤖 AI 助手 | ChatGPT 式对话优先侧栏：底部统一放置模型、上下文、附件与发送操作；支持本地多会话历史、多选笔记、临时文本附件、本地关键词 RAG、流式回答和分段 Agent 过程轨道 |
| 🧩 编辑模式 | 所有仪表盘模块统一支持上下拖动排序、显示/隐藏、修改标题和折叠状态持久化；统计卡片和 Toolbar 按钮也可分别排序、隐藏 |
| ◈ 情景布局 | 保存多套模块与 Toolbar 布局；支持手动切换，也可按工作日、时间段或当前打开文件夹自动进入指定情景 |
| 🖱️ 右键菜单 | 在首页空白区域弹出快捷菜单，支持刷新页面、新建笔记、搜索、命令面板、图谱、番茄钟、最近更新记录、进入编辑模式 |
| 📅 日历看板 | 月视图与 7 天周视图一键切换并记住选择；日期格显示紧凑的待办/RSS 数量，选中日期后展示可完成、编辑和关联闹钟的左对齐时间流，并支持把待办拖入日期排期 |
| 📰 RSS 阅读器 | 双栏订阅阅读器提供当天、未读、稍后读三类队列，来源/标签下拉筛选、阅读进度、结构化正文、链接/图片和全局朗读播放器；缓存只保存在当前设备 |
| ✅ 待办管理 | 默认进入“今天”行动队列，按逾期、今日到期、高优先级、待安排分组；支持动态标签、批量完成/延期、拖入日历排期、编辑和删除 |
| 📊 统计卡片 | 笔记、待办、完成率、今日专注、连续未专注和标签积压；点击可跳转到关联待办，在编辑布局中可排序和隐藏 |
| 🍅 专注趋势 | 默认隐藏、可在编辑模式启用；从 `_data/focus.md` 汇总近 7 / 30 天专注时长，并支持平滑折线与柱状图切换 |
| 📂 分类卡片 | 展示顶层目录，优先打开概览/MOC 类文件；没有概览时打开分类中的第一篇笔记，空目录会明确提示 |
| ✏️ 最近更新 | 按最近修改时间展示笔记，支持一键打开 |
| 📝 更新记录 | 一次加载全部 GitHub Releases 并缓存 30 分钟，默认展示最新版本；下拉切换只读取内存缓存，源码中不再内置更新文案 |
| ⭐ 收藏文件 | 收藏/取消收藏重要笔记，与最近更新区联动；支持折叠、固定排序、上下调整及一键在分栏打开 |
| ⚡ 闪念胶囊 | 快速记录想法到 `_daily/YYYY-MM-DD.md` |
| 📈 编辑热力图 | 展示近 30 天编辑频率 |
| 🍅 番茄钟 | 可关联具体待办，完成一轮后显示完成、继续或延期操作，并累计该任务的专注次数与分钟；支持专注结束全屏提醒、按钮直接启动 5 分钟休息，以及可选的休息结束提醒 |
| ⏰ 全局闹钟 | 支持单次、每天和指定星期闹钟、全屏响铃、稍后提醒及启停管理；待办列表和日历待办都可直接创建、编辑关联闹钟，完成或删除待办会同步停用提醒 |
| ⏱ 定时任务 | 默认隐藏，可从编辑布局启用；按间隔、每天或每周运行 Toolbar 动作、Obsidian 命令与桌面端 Shell 命令，支持立即运行、重叠保护、错过任务策略，以及可清除的成功/失败审计日志 |
| 🔔 消息推送 | 可选集成 Server酱³、Bark 与 MEOW。可同时启用多个渠道和多个可视化时间点，支持每天、指定星期或指定月日推送，以及今日到期 / 逾期待办汇总或自定义正文 |
| 🌐 多语言界面 | 支持 `中文 / EN` 一键切换，覆盖首页主要文案并持久化语言设置，且语言开关会适配深浅色模式 |
| ✨ 交互动效 | 语言切换、工具栏、筛选和卡片增加 hover / press 反馈，让点击更有层次 |
| 🧭 首次引导 | 首次打开显示分步引导，可跳过并记住状态 |
| ⚙️ 模块化设置 | AI 模型、推送渠道、提醒计划和消息内容按页签归类，避免所有配置堆在一个长页面中 |
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

你的数据归你：插件没有遥测，也不会在后台收集或上传 Vault 数据。只有你主动向 AI 助手发送问题、总结或提取待办时，所选笔记、临时文本附件或本地关键词 RAG 命中的截断片段，才会和问题一起直接发送到你配置的模型服务。未手动选择上下文的自由问答会在本机扫描 Markdown 笔记并检索相关片段；原始知识库不会因此整体上传。会话历史单独保存在插件私有文件中，只记录有限数量的用户问题、最终回答、模型 ID 与笔记路径；不记录附件正文、RAG 片段、思考过程或工具参数。API Key 使用 Obsidian SecretStorage 保存，不写入插件 `data.json`。数据迁移、清理和本地命令都需要你主动操作；第三方推送仅在自行启用时访问对应服务。

### 数据文件

插件运行时会使用或生成这些文件：

| 文件 | 作用 |
|---|---|
| `_data/todos.md` | 待办数据 |
| `data.json` | Storage V2 设置、自定义按钮、收藏、排序、Toolbar 命令、RSS 配置、AI 模型配置（不含 API Key），以及番茄钟会话与按任务聚合的专注统计 |
| `.obsidian/plugins/cockpit-dashboard/ai-history.json` | 最多 30 个本地 AI 会话及受限消息历史；不包含 API Key、附件正文、RAG 片段、思考过程或工具参数 |
| Obsidian SecretStorage | AI 服务 API Key；由 Obsidian 安全存储接口管理，不写入源码或 `data.json` |
| IndexedDB | 当前设备的 RSS 正文摘要、已读状态和受限缓存；不参与 Obsidian Sync，可随时在 RSS 菜单清除 |
| `_data/bookmarks.md` | 未完成数据迁移时的收藏存储；迁移后停止写入，可由用户主动清理 |
| `_data/focus.md` | 按日期累计的专注历史记录 |
| `_data/toolbar.md` | 未完成数据迁移时的 Toolbar 命令配置；迁移后停止读取和写入 |
| `.obsidian/plugins/cockpit-dashboard/logs/toolbar-runs.jsonl` | 最近 100 次自定义脚本运行日志，最大约 1 MB，不记录脚本文本 |
| `_daily/YYYY-MM-DD.md` | 闪念胶囊写入位置 |

### Storage V2 与数据迁移

- 迁移不会自动进行；未迁移时，收藏和 Toolbar 配置继续使用旧 `_data` 文件。
- 在“数据迁移”引导中确认后，配置会复制到插件 `data.json`；旧文件会保留，直到你主动清理。
- 待办与专注历史始终使用可读的 Markdown；清理旧配置不会删除它们。

### RSS 使用说明

1. 在日历右上角打开 RSS 菜单，进入“管理订阅源”，添加 RSS/Atom 地址并启用 RSS。
2. 点击日期上的 RSS 数量或日详情里的 RSS 按钮，打开双栏阅读器。
3. 左侧顶部只有三个固定队列：`当天`、`未读`、`稍后读`；来源和标签统一放在下拉筛选中，避免页签过多。
4. 阅读文章会保存本机已读状态与阅读进度；点击“稍后读”可跨日期保留文章，再次点击可移除。
5. 订阅配置保存在 `data.json`，文章缓存、已读与稍后读状态保存在当前设备 IndexedDB；RSS 菜单可以随时清空本机缓存。

### AI 助手使用说明

1. 在 **设置 → Cockpit Dashboard → AI 模型** 中新增模型配置，选择预设服务或填写 OpenAI 兼容接口地址、模型 ID 与 API Key。
2. 内置预设包括 OpenAI、DeepSeek、Kimi、智谱 GLM、通义千问、MiniMax、硅基流动、OpenRouter、Ollama、OmniRouter，并支持自定义 OpenAI 兼容服务。
3. 每个配置卡片都可以独立测试连接；修改名称、模型或当前配置后，已打开的 AI 侧栏会立即同步模型下拉框。
4. 点击可拖动的全局 AI 按钮打开或关闭侧栏。顶部只保留会话历史、新建、设置和关闭；模型、上下文与附件统一位于底部输入框。
5. 左上角打开会话抽屉，可搜索、切换、重命名或删除本地会话。每个会话记住自己的模型与所选笔记，并把最近的用户/助手消息作为后续提问的连续上下文。
6. 点击输入框左下角 `+`，可以多选最近打开的 Markdown 笔记，或临时上传最多 5 个文本文件（单个不超过 1 MB，支持 `md/txt/csv/json/yaml/yml/log/html/xml`）。附件只保留在当前输入轮次的内存中。
7. 多选内容超过上下文上限时，插件会先在本机按关键词切片检索；自由问答未选择任何上下文时，会对 Vault 中的 Markdown 笔记执行同样的全局检索，再仅注入命中的受限片段。这是轻量的本地关键词 RAG，不是向量数据库或语义嵌入检索。
8. 回答采用流式输出；检索、思考、工具调用和回答生成会沿左侧分段轨道实时更新。兼容模型返回的思考正文仍可单独展开，点击停止也会中止尚未完成的检索或生成。
9. Agent 只能调用插件注册的白名单工具：可读取待办、搜索 Markdown 笔记，并在你逐次确认后创建或完成待办。插件源码、`.obsidian` 配置、Shell 和任意文件写入不会开放给 Agent。
10. 发送前请确认所选模型服务及其数据处理政策符合你的要求；笔记正文或附件仍只会在你主动发起请求后发送。

### 情景布局与编辑布局

- 在欢迎区右上角打开情景菜单，可以新建、切换或删除情景。新情景会复制当前布局。
- 进入“编辑当前布局”后，模块可以拖动、隐藏和重命名；统计卡片与 Toolbar 动作也有自己的排序和可见性控制。
- 新增模块首次进入旧布局时默认放在页脚“持续维护 · 知识库是活的”上方，不会重排用户已经保存的位置。
- 自动切换规则支持星期、开始/结束时间和文件夹条件。手动切换始终可用。

### 定时任务与审计日志

- 定时任务模块默认隐藏；在编辑布局中显示后即可新建任务。
- 支持 Toolbar 动作、Obsidian 命令和桌面端 Shell 命令。Toolbar 动作包含插件内置按钮和用户自定义按钮；任务只保存稳定的动作 ID，每次运行都会读取按钮的最新名称、网址或脚本配置。
- 自定义按钮被删除后，对应定时任务不会偷偷执行旧脚本，而会记录一次明确的失败；Shell 仅适用于桌面端，请只运行自己信任的内容。
- 可选择间隔、每天或每周计划；Obsidian 必须保持运行才能触发本地调度。
- 审计日志记录触发方式、成功/失败、退出码、耗时、标准输出与错误输出，并设置数量和文件大小上限；可从审计页面手动清除。
- 配置保存在插件 `data.json`，日志保存在插件私有 `logs/` 目录，不会新增 `_data` Markdown 文件。

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

插件会在现有行末自动补充稳定的 `id:` 元数据，用于关联番茄钟与统计；无需手动填写，也不会为此创建新的 Markdown 文件。

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

- Manifest version: `1.5.1`
- Latest update date: `2026-08-20`

### 1.5.1 最近更新

- 清理了旧版本内置的硬编码默认命令与个人示例数据：新安装不再带入指向特定电脑的路径或作者待办，开箱即用。
- 升级到本版本后，若你的驾驶舱或工作日志命令仍是旧版写入的默认值、且在当前电脑上无法运行，点击对应按钮时会自动弹窗并打开配置窗口，引导你填写自己的命令；命令在本机仍可正常使用的用户不会受到任何影响。

### 1.5.0 最近更新

- AI 侧栏改为 ChatGPT 式对话布局，模型、笔记上下文、临时附件和发送操作统一收进底部输入区，并用分段过程轨道实时展示检索、思考、工具调用与回答生成。
- 新增本地多会话历史，可搜索、切换、重命名和删除会话；每个会话独立记住模型与笔记上下文，历史文件不会保存 API Key、附件正文、RAG 片段、思考过程或工具参数。
- 新增多篇笔记与临时文本附件上下文；上下文过长或未手动选择笔记时，会在本机执行关键词 RAG，只向模型注入受限的相关片段。
- 内置 Agent 新增受控工具，可读取待办和搜索 Markdown 笔记；创建或完成待办必须逐次确认，且无法访问插件源码、`.obsidian` 配置、Shell 或任意文件写入。

升级无需迁移现有配置；首次使用多会话时会自动创建插件私有的 `ai-history.json`。部分模型服务不返回独立思考内容，此时过程轨道仍会显示检索、工具与生成状态。

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
- Summarize the current note, extract tasks, or ask follow-up questions with the optional AI assistant
- Check vault stats and recent edits
- Reorder and hide dashboard modules based on your own workflow
- Save separate layouts for work, reading, and review, with optional time/folder automation
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
| 🤖 AI Assistant | Chat-first sidebar with model, context, attachments, and send controls consolidated in the bottom composer; includes local multi-conversation history, multi-note context, temporary text attachments, lexical RAG, streaming, and a segmented Agent activity rail |
| 🧩 Edit Mode | Dashboard modules can be reordered, hidden, renamed, and collapsed; stat cards and Toolbar actions have their own ordering and visibility controls |
| ◈ Layout Scenes | Save multiple module/Toolbar layouts and switch manually or automatically by weekday, time range, or active folder |
| 🖱️ Context Menu | Right-click in blank dashboard space for refresh, new note, search, command palette, graph, Pomodoro, recent updates, and Edit Mode |
| 📅 Calendar Board | Month and seven-day week views, compact todo/RSS indicators, drag-to-schedule, and a left-aligned selected-day task timeline with completion, edit, and linked-alarm actions |
| 📰 RSS Reader | Two-pane reader with Today, Unread, and Later queues; a single source/tag dropdown; reading progress, structured articles, links/images, and global text-to-speech |
| ✅ Todo Manager | Opens on a Today action queue grouped into overdue, due today, high priority, and unscheduled work, with dynamic tags, batch deferral, Next filtering, edit/delete, and completion sync |
| 📊 Stats Cards | Notes, todos, completion rate, focus gap, and tag backlog; cards jump to related work and can be reordered or hidden in Edit Mode |
| 🍅 Focus Trend | Hidden by default and enabled from Edit Mode; summarizes 7/30-day focus history from `_data/focus.md` with smooth line and bar chart views |
| 📂 Category Cards | Top-level folder cards that prefer overview/MOC notes, fall back to the first note, and clearly report empty folders |
| ✏️ Recent Files | Recently modified notes with one-click open |
| 📝 Release Notes | Loads all GitHub Releases once and caches them for 30 minutes; version switching reads only the in-memory cache, with no bundled update copy in source |
| ⭐ Bookmarks | Bookmark important files, keep them synced with recent files, collapse the section, persist ordering, move items, and open a note in a split pane |
| ⚡ Flash Notes | Quick capture into `_daily/YYYY-MM-DD.md` |
| 📈 Heatmap | 30-day edit activity heatmap |
| 🍅 Pomodoro | Links focus sessions to todos and supports full-screen focus completion, starting the five-minute break directly from the reminder, and an optional return-to-work reminder after the break |
| ⏰ Global Alarms | One-time, daily, or selected-weekday alarms with full-screen ringing, snooze, and enable/disable controls; todo rows and Calendar tasks can create or edit linked alarms that disable when the task is completed or deleted |
| ⏱ Scheduled Tasks | Runs Toolbar actions, Obsidian commands, or trusted desktop Shell commands on interval, daily, or weekly schedules; supports missed-run policy, manual runs, overlap protection, and bounded audit logs |
| 🔔 Message Notifications | Optional ServerChan³, Bark, and MEOW delivery. Enable multiple channels and multiple visual delivery times with daily, weekday, or monthly schedules, task summaries, or a custom body |
| 🌐 Multi-language UI | One-tap `中文 / EN` switching with persisted preference and better light/dark readability |
| ✨ Interaction Polish | Hover and press feedback for language toggle, toolbar actions, filters, and cards |
| 🧭 Onboarding | First-run guided tour with persistent completion state |
| ⚙️ Modular Settings | AI models, delivery channels, notification schedules, and message content are organized into focused tabs instead of one long page |
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

Your data stays yours: the plugin includes no telemetry and does not collect or upload Vault data in the background. Only after an explicit AI request are selected notes, temporary text attachments, or bounded excerpts found by local keyword RAG sent with your question directly to the configured model service. A free-form question with no manual context searches Markdown notes locally; it does not upload the entire Vault. Conversation history is stored in a separate plugin-private file and retains only bounded user questions, final answers, model IDs, and note paths—never attachment bodies, RAG excerpts, reasoning, or tool arguments. API keys remain in Obsidian SecretStorage, not plugin data.

### Runtime Files

| File | Purpose |
|---|---|
| `_data/todos.md` | Todo storage |
| `data.json` | Storage V2 settings, custom buttons, bookmarks, ordering, Toolbar commands, RSS configuration, AI model metadata (never API keys), Pomodoro sessions, per-task focus aggregates, and scheduled-task configuration/status |
| `.obsidian/plugins/cockpit-dashboard/ai-history.json` | Up to 30 bounded local AI conversations; excludes API keys, attachment bodies, RAG excerpts, reasoning, and tool arguments |
| Obsidian SecretStorage | API keys for AI services, managed by Obsidian and excluded from source code and `data.json` |
| IndexedDB | Device-local RSS summaries, read states, and bounded cache; excluded from Obsidian Sync and removable from the RSS menu |
| `_data/bookmarks.md` | Bookmark storage before migration; no longer written after migration and removable by the user |
| `_data/focus.md` | Focus history accumulated by date |
| `_data/toolbar.md` | Toolbar command configuration before migration; no longer read or written after migration |
| `.obsidian/plugins/cockpit-dashboard/logs/toolbar-runs.jsonl` | Last 100 custom-script runs, capped near 1 MB; script source is not logged |
| `.obsidian/plugins/cockpit-dashboard/logs/scheduled-tasks.jsonl` | Last 500 scheduled/manual task runs, capped near 5 MB, including trigger, result, exit code, duration, stdout, and stderr |
| `_daily/YYYY-MM-DD.md` | Flash note destination |

New modules and features do not create additional Markdown files under `_data`. Scheduled-task configuration stays in the plugin's private `data.json`; audit records stay in the bounded plugin log directory.

### Storage V2 and data migration

- Migration is never automatic. Before it runs, bookmarks and Toolbar configuration keep using legacy `_data` files.
- After you confirm the guide, configuration is copied to plugin `data.json`; old files remain until you explicitly clean them.
- Todos and focus history always remain readable Markdown, and cleanup never deletes them.

### RSS workflow

1. Open the RSS menu from Calendar and add enabled RSS/Atom sources under Manage subscriptions.
2. Open the reader from a calendar day or its detail panel.
3. Use the three fixed queues—Today, Unread, and Later—then narrow results with one source/tag dropdown.
4. Reading saves local progress. Read Later keeps an article across dates and can be toggled off again.
5. Feed configuration lives in `data.json`; cached articles and reading state stay in device-local IndexedDB and can be cleared from the RSS menu.

### AI assistant workflow

1. Open **Settings → Cockpit Dashboard → AI models**, add a profile, then choose a preset or enter an OpenAI-compatible endpoint, model ID, and API key.
2. Presets include OpenAI, DeepSeek, Kimi, Zhipu GLM, Qwen, MiniMax, SiliconFlow, OpenRouter, Ollama, and OmniRouter, plus custom OpenAI-compatible services.
3. Test each profile independently. Editing a profile or changing the active model updates the model picker in an already-open AI sidebar immediately.
4. Use the draggable global AI button to open or close the sidebar. The header contains only history, new chat, settings, and close; model and context controls live in the bottom composer.
5. Open the history drawer to search, switch, rename, or delete local conversations. Each conversation remembers its model and selected note paths and supplies recent user/assistant turns to follow-up requests.
6. Use the composer's `+` button to select several recent Markdown notes or temporarily attach up to five text files (1 MB each; `md/txt/csv/json/yaml/yml/log/html/xml`). Attachments remain in memory for the current turn only.
7. If selected context exceeds the limit, Cockpit locally ranks bounded keyword-matched chunks. With no manual context, a free-form question searches Markdown notes across the Vault and sends only matching excerpts. This is lightweight lexical RAG, not vector or embedding search.
8. Retrieval, reasoning, tool calls, and answer generation update along a segmented activity rail. Compatible reasoning text remains separately expandable, and Stop aborts pending retrieval or generation.
9. The Agent can call only registered allowlisted tools: it may list tasks, search Markdown notes, and create or complete a task after per-action confirmation. Plugin source, `.obsidian` configuration, Shell access, and arbitrary file writes are never exposed.
10. Review the selected model service's privacy and data-processing terms; note or attachment content is transmitted only after an explicit request.

### Layout scenes and Edit Mode

- Create and switch scenes from the greeting card. New scenes copy the active layout.
- Edit Mode supports module drag ordering, visibility, and custom titles, plus per-card/per-action controls for Statistics and Toolbar.
- Newly introduced modules are inserted above the footer anchor in old layouts without moving positions the user already saved.
- Automatic rules support weekdays, time ranges, and active-folder conditions; manual switching remains available.

### Scheduled tasks and audit logs

- The module is hidden by default and can be enabled from Edit Mode.
- Run Toolbar actions, Obsidian commands, or trusted desktop Shell commands on interval, daily, or weekly schedules. Toolbar tasks store a stable action ID and resolve the latest custom-button URL/script at run time. Obsidian must remain running.
- If a referenced custom button is deleted, the run fails explicitly instead of executing a stale copy.
- Audit logs include trigger, status, exit code, duration, stdout, and stderr, are size/count bounded, and can be cleared from the audit view.
- Configuration stays in `data.json`; logs use the private plugin `logs/` directory and do not create new `_data` Markdown files.

### Todo Syntax

```markdown
- [ ] Normal task
- [x] Completed task | created: 2026-06-01 | done: 2026-06-02
- [ ] High priority p:high
- [ ] Due soon due:2026-07-10
- [ ] Tagged task #work #urgent
- [ ] Combined syntax #project due:2026-07-10 p:low
```

The plugin automatically appends a stable `id:` to the existing line for Pomodoro linking and statistics. You do not need to enter it, and it does not create another Markdown file.

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

- Manifest version: `1.5.1`
- Latest update date: `2026-08-20`

### What’s New in 1.5.1

- Removed hardcoded default commands and personal sample data from earlier versions: fresh installs no longer ship paths tied to a specific machine or the author's todos, so the plugin works out of the box.
- After upgrading, if your Cockpit or work-log command is still the legacy default and cannot run on this computer, clicking the button now opens a prompt and the configuration window so you can enter your own command; machines where the command still works are unaffected.

### What’s New in 1.5.0

- Redesigned the AI sidebar around a ChatGPT-style conversation flow. Model, note context, temporary attachments, and send controls now live in the bottom composer, while a segmented activity rail streams retrieval, reasoning, tool, and answer progress.
- Added local multi-session history with search, switch, rename, and delete actions. Each session remembers its model and note context without storing API keys, attachment bodies, RAG excerpts, reasoning traces, or tool arguments.
- Added multi-note and temporary text-file context. When the selection is too large—or no note is selected—the plugin runs local keyword RAG and sends only bounded, relevant excerpts to the configured model.
- Added restricted Agent tools for reading tasks and searching Markdown notes. Creating or completing a task requires per-action confirmation, and the Agent cannot access plugin source, `.obsidian` settings, Shell, or arbitrary file writes.

No settings migration is required. The private `ai-history.json` file is created automatically when multi-session history is first used. Some model providers do not expose separate reasoning text; in that case, the activity rail still reports retrieval, tool, and generation progress.

### Sponsor

If this plugin saves you time, you can support the author here:

[![Support on Afdian](https://img.shields.io/badge/Afdian-Support%20the%20Author-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

Direct link:

- [https://afdian.com/a/zephyrhaven](https://afdian.com/a/zephyrhaven)

## Author

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
