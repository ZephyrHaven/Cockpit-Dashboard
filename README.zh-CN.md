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

## 推荐

### Cockpit Glass

推荐搭配我们独立开发的 [Cockpit Glass](https://github.com/ZephyrHaven/cockpit-glass) 主题，提供雾面玻璃、分层卡片和深浅色外观。主题已上架 Obsidian 主题商店：**设置 → 外观 → 主题 → 管理 → 搜索 Cockpit Glass → 安装并使用**。

想让驾驶舱卡片与主题保持一致，可开启「设置 → Cockpit → 外观与动效 → 一体式玻璃外观」。Mac 可配合宿主的「半透明窗口」获得原生毛玻璃；平台要求与外观选项见[主题安装指南](https://github.com/ZephyrHaven/cockpit-glass#readme)。

主题通过主题商店单独安装和更新；升级插件会保留已经安装的主题。

## 闹钟雾面提醒

点击闹钟模块的调节图标，可选择并预览「半屏」或「全屏」。设置应用到所有闹钟并保存在本机，旧配置默认保持全屏；两种模式都用雾面遮住提醒后方的底层内容，保证文字清晰。

响铃时可以停止提醒，或稍后 10 分钟再次提醒；多个闹钟依次排队。只有全屏模式会请求窗口进入全屏。

## 弹性番茄钟

开始前拖动长条两端设置 1–120 分钟，也可直接输入时长；展开设置可填写备注或关联待办。计时中拉伸只调整显示宽度：窄时保留倒计时和必要按钮，拉宽后显示更多内容，达到一小时才显示小时。

支持正常、简洁和常驻极简三种状态。简洁长条收至最短后，继续向内收短并松手即可固定为圆盘；拖动圆盘可移动，单击返回简洁模式，再展开进入正常状态。形态、位置、宽度与备注保存在本机。简洁模式闲置 12 秒也会自动收缩，悬停后恢复；固定的极简圆盘在悬停时保持不变。

移动和拉伸有轻微视觉刻度反馈，设备与系统设置支持时提供触感反馈，包括 Mac 的 Force Touch 触控板。极简圆盘以旋转秒针呈现计时。

计时结束后，下半屏雾面提醒提供「去休息 5 分钟」和「继续下一轮」。可分别设置全屏提醒与休息结束提醒。计时已有进度时，先重置再调整时长；休息不计入专注统计。

## 自定义组件

在组件商店点击「导入组件」，选择本地 JSON 包或组件文件夹，确认名称与权限后安装，再点击「应用布局」。详情页支持更新、禁用、导出和卸载；新组件在其他情景默认隐藏。

可先下载商店内的阅读进度示例。开发方式与界面、存储、权限规范见 [组件 SDK v1](docs/component-authoring-spec.md) 和 [示例](examples/custom-components/README.md)。组件代码在受限 Worker 中执行，不提供文件、命令或网络接口。

## 数据与隐私

所有数据都保存在库内或插件目录，没有遥测，也不会上传给插件作者。

| 存储 | 内容 |
|---|---|
| `_data/todos.md`、`_data/team-todos.md` | 待办（行内元数据与重复规则），以及团队待办的可读镜像 |
| `_data/focus.md` | 按日期累计的专注历史 |
| `data.json` | 设置、布局情景、番茄钟会话（时长、备注、形态与位置）、闹钟提醒外观、Toolbar、RSS 配置、Apple 日历映射、AI 模型配置与永久允许的低风险 Agent 操作（**API Key 以明文保存在此处**） |
| `lan-sync-<machine>.json`、`team-sync-<machine>.json` 及备份 | 可选的局域网/团队同步状态，含仅保存在本机的明文配对密钥 |
| `ai-history.json`、`ai-index.json`、`logs/agent-tools.jsonl` | 最多 30 个 AI 会话、本地索引快照、最近 500 条 Agent 工具回执 |
| `custom-components.json`、`.backup` | 本地导入的组件代码、启用状态、运行错误及组件私有 JSON 数据；卸载可保留数据以便重装，不自动联网或参与同步 |
| IndexedDB | 本地 RSS 正文缓存与已读状态 |

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

发布 tag 不加 `v` 前缀，附件包含 `main.js`、`styles.css`、`manifest.json` 三个独立文件。

## 赞助作者

如果这个插件帮你省下了时间，欢迎请作者喝一杯：

[![爱发电 Afdian](assets/afdian-badge-zh.svg)](https://afdian.com/a/zephyrhaven)

<https://afdian.com/a/zephyrhaven>

## 作者

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
