# Cockpit Dashboard

[English](README.md) | **简体中文**

Cockpit Dashboard 是一个本地优先的 Obsidian 驾驶舱首页插件：把待办、日历、RSS、AI 助手、专注统计与本地自动化放进一个可自由编排的工作台。不需要账号，不上传云端，也没有遥测。

## 主要功能

- **今日总览**：待办队列、精细化日历（月/周视图、拖拽改期、农历与法定节假日调休），以及按日期聚合待办、定时/事件自动化与 RSS 摘要的时间线；周围是统计卡片、编辑热力图、项目进度、最近更新、收藏文件、闪念胶囊与旧笔记重现。
- **待办**：支持固定排期或完成后间隔的重复规则、批量修改、归档与撤销、今日专注队列，以及一键 AI 拆解子任务。
- **AI 助手**：多模型侧栏，本地会话、多选笔记上下文、贴图对话、本地关键词 RAG、流式输出与白名单 Agent 工具。可选只读 / 读写（逐次确认）/ 完整三种权限；每次待办写入都会回读校验后才报告成功。可选的编码工作区允许 Agent 在你指定的文件夹内读写代码并运行命令验证。
- **自动化**：番茄钟、全局闹钟、倒计时卡片，定时与事件驱动的任务、多步骤自动化流程，支持本地通知、ServerChan³、Bark、MEOW、Resend 与 SMTP 投递。
- **回顾**：晨间简报、可并排对照 AI 优化稿的周报工坊、专注分析与可分享的 PNG 卡片。
- **布局**：带搜索的组件商店、按星期/时间段/文件夹自动切换的情景布局，以及可选的一体式玻璃外观。
- **其他**：自然语言快速记录、跨待办/笔记/文件名的 Spotlight 搜索、双栏 RSS 阅读器、Mac 上的 Apple 日历同步、多台自有电脑间的加密同步与团队空间（预览版）、双语界面与首次引导。

## 安装

**社区插件市场（推荐）**：设置 → 第三方插件 → 浏览 → 搜索 **Cockpit Dashboard** → 安装并启用。

**手动安装**：从 [GitHub Releases](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases) 下载最新版，把 `main.js`、`manifest.json`、`styles.css` 复制到 `.obsidian/plugins/cockpit-dashboard/` 后启用插件。升级时只覆盖这三个文件，保留 `data.json` 中的设置。

### 可选的玻璃外观

使用宿主应用 1.14 或更新版本，在「设置 → Cockpit → 外观与动效」点击「安装主题」，然后在「设置 → 外观 → 主题」选择 **Cockpit Glass**，再开启插件的「一体式玻璃外观」。主题随插件内置，安装无需联网，也无需寻找文件夹；插件根据当前库实际的配置目录安装，支持自定义目录。选择主题和开启宿主半透明窗口仍由你手动完成。

Mac 在「设置 → 外观」开启「半透明窗口」后可获得原生毛玻璃。Windows 及未开启半透明窗口的 Mac 使用完整的柔和背景、侧栏、标签与分层卡片，不提供桌面壁纸透视。各平台均支持浅色、深色和减少动态效果。

已有主题可在同一入口更新；重新安装本地修改过的主题时，原文件会备份到主题目录内的 `.cockpit-backups/<时间戳>/`。需要恢复时，把对应备份中的 `theme.css` 和 `manifest.json` 复制回主题目录。安装失败会尝试恢复原文件，无法恢复时会显示提示。安装器不会修改宿主外观配置，也不会覆盖更新版本的主题。仍可[手动安装](theme/cockpit-glass/README.md)。

## 数据与隐私

所有数据都保存在库内或插件目录，没有遥测，也不会上传给插件作者。

| 存储 | 内容 |
|---|---|
| `_data/todos.md`、`_data/team-todos.md` | 待办（行内元数据与重复规则），以及团队待办的可读镜像 |
| `_data/focus.md` | 按日期累计的专注历史 |
| `data.json` | 设置、布局情景、Toolbar、RSS 配置、Apple 日历映射、AI 模型配置与永久允许的低风险 Agent 操作（**API Key 以明文保存在此处**） |
| `lan-sync-<machine>.json`、`team-sync-<machine>.json` 及备份 | 可选的局域网/团队同步状态，含仅保存在本机的明文配对密钥 |
| `ai-history.json`、`ai-index.json`、`logs/agent-tools.jsonl` | 最多 30 个 AI 会话、本地索引快照、最近 500 条 Agent 工具回执 |
| IndexedDB | 本地 RSS 正文缓存与已读状态 |
| 当前配置目录下的 `themes/Cockpit Glass/` | 主动安装的配套主题及更新前的本地备份（`.cockpit-backups/`）；不联网、不修改其他主题 |

**只有在你使用相关功能时才会联网：**

- **AI**：所选笔记片段、附件、本地 RAG 命中片段或你选择优化的周报草稿会发送到你配置的模型服务；自由问答在本机完成检索，不会整体上传 Vault。
- **局域网与团队同步**：待办、收藏路径、昵称、语言与晨报发送策略只会发送给你明确配对的设备，经 AES-256-GCM 加密并仅限局域网；不包含 API Key、命令、工作区路径、AI 历史与笔记正文。
- **通知与邮件**：消息只发送到你启用的渠道（本地、ServerChan³、Bark、MEOW、Resend、SMTP）。
- **Apple 日历（仅 Mac）**：在你逐项启用后，由固定的本机脚本读写系统日历，不会把日历数据发给插件作者。「显示系统日程」默认关闭，事件标题、时间、地点与日历名称最多在本机缓存 24 小时；只有点击日程时才会创建会议笔记。
- **RSS**：订阅源直接抓取到本地 IndexedDB 缓存。
- **更新检查**：最多每 24 小时向公开的 GitHub Releases API 发起一次 HTTPS 请求。

## 开发

```bash
git clone https://github.com/ZephyrHaven/Cockpit-Dashboard.git
cd Cockpit-Dashboard

node tests/run-all.js   # 无框架断言测试
node build.js           # 构建压缩产物到 dist/
bash deploy.sh          # 构建并复制到本机插件目录
```

源码模块由 `build.js` 按固定顺序拼接，再经 esbuild / terser 压缩；`dist/styles.css` 单独构建。

发布 tag 不加 `v` 前缀，附件包含 `main.js`、`styles.css`、`manifest.json` 以及供手动安装的 zip。

## 赞助作者

如果这个插件帮你省下了时间，欢迎请作者喝一杯：

[![爱发电 Afdian](assets/afdian-badge-zh.svg)](https://afdian.com/a/zephyrhaven)

<https://afdian.com/a/zephyrhaven>

## 作者

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
