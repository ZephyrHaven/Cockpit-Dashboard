# Cockpit Dashboard

[![Release](https://img.shields.io/github/v/release/ZephyrHaven/Cockpit-Dashboard?style=for-the-badge)](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases)
[![Support on Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-Support%20Zephyr%20Haven-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

[English](README.md) | **简体中文**

Cockpit Dashboard 是一个本地优先的 Obsidian 驾驶舱首页插件：把待办、日历、RSS、搜索、AI 助手、统计、专注计时与本地自动化集中在一个可自由编排的工作台中。本文档只介绍项目定位与技术原理。

## 核心特性

- **仪表盘工作台**：待办今天队列、日历看板（月/周视图、拖拽排期、农历与法定节假日调休显示、可开关）、今日 Agenda 时间流、统计卡片、编辑热力图、项目进度条、分类卡片、最近更新、收藏文件、闪念胶囊、旧笔记重现；面板数据基于库内事件驱动刷新，文件保存后数秒内自动跟随
- **AI 助手**：多模型对话侧栏，本地多会话历史、多选笔记上下文、临时文本附件、贴图对话、本地关键词 RAG、流式输出、白名单 Agent 工具（含库内笔记工具：读取、创建、追加、移动、添加行内标签，每次修改都需逐条确认，只读模式下完全不暴露）；待办一键 AI 拆解子任务，闪念整理箱 Agent 聚类成主题后转待办或存为整理笔记；可选「编码工作区」——指定本地文件夹后 Agent 可在其中读写代码、搜索并运行命令验证
- **自动化**：番茄钟（可关联待办）、全局闹钟（后台全屏提醒 + 手势追赶）、定时任务（时间计划之外支持事件触发——指定文件夹保存笔记、待办完成、番茄钟结束，可自动追加日记、创建待办、推送通知、运行 Toolbar 动作 / 应用命令 / 桌面端 Shell）、自动化流程——多步骤运维流水线（条件跳过、失败重试、输出传递 `{{last_output}}`、失败推送、运行日志落盘），可从磁盘空间 / 网站可达性 / 备份新鲜度等巡检模板一键创建，手动运行或挂到定时任务按时间/事件触发、Server酱³/Bark/MEOW 消息推送
- **专注分析**：专注趋势图表（折线/柱状），本周对比上周、黄金专注时段、任务投入 Top3 洞察，一键生成周报分享卡片 PNG
- **布局系统**：模块拖拽排序、显示/隐藏、折叠持久化，多情景布局可按星期/时间段/文件夹自动切换
- **其他**：Spotlight 统一搜索（待办 / 笔记内容 / 文件名一次出结果）、RSS 双栏阅读器、双语界面、首次引导

## 技术架构

### 构建系统

插件不依赖打包器，`build.js` 按固定顺序拼接 `src/` 下模块，经 esbuild 与 terser 双引擎竞争压缩取更小者，产物输出到 `dist/`：`dist/main.js` 与独立的 `dist/styles.css`（由宿主自动加载，不内嵌进 JS），sourcemap 仅本地调试用：

```text
constants → data-store → ai-index → ai-context → ai … → ai-launcher
→ daily-tips → utils → todos → todo-focus → focus-insights → share-card
→ habits → weekly-review → projects → resurface → morning-brief
→ serverchan → bookmarks → rss → lunar → calendar → search → toolbar
→ scenes → scheduled-tasks → alarm → pomodoro → …
→ toolbar-defs → layout-edit → silent-refresh → commands → _framework（视图与插件主类）
```

模块间通过顶层函数声明共享作用域，各模块均可用 Node 直接 `require` 单测。测试是无框架的断言脚本（纯函数断言 + 源码模式断言），逐文件独立运行。

### 数据与存储原则

| 存储 | 内容 |
|---|---|
| `_data/todos.md` | 待办（行内 `id:`/`due:`/`p:` 元数据，插件自动维护） |
| `_data/focus.md` | 按日期累计的专注历史 |
| 插件 `data.json` | Storage V2 设置、布局情景、Toolbar、RSS 配置、AI 模型配置（**API Key 以明文保存在此处**） |
| 插件私有 `ai-history.json` | 最多 30 个 AI 会话（不含附件正文/RAG 片段/思考过程） |
| 插件私有 `ai-index.json` | 倒排索引快照 |
| IndexedDB | 设备本地的 RSS 正文缓存与已读状态 |

无遥测、无后台上传。只有你主动发起 AI 请求时，所选笔记片段、附件或 RAG 命中的截断片段才会发送到你配置的模型服务；自由问答在本机完成检索，不会整体上传 Vault。Agent 的库内笔记工具只会创建、追加、移动笔记或添加行内标签（绝不删除），且每次修改都需你在对话中逐条确认；只读权限模式下这些工具完全不可见。定时任务的推送动作会把任务模板内容发送到你已启用的推送渠道。自动化流程的运行历史保存在本机配置文件中（每流程最近 20 条）；若你为流程填写了「运行日志笔记」，运行摘要会追加到你指定的那篇笔记；失败推送同样只发送到你已启用的推送渠道。

### AI 助手实现原理

#### 多模型接入与流式输出

- 统一走 OpenAI 兼容 `/chat/completions`；内置 OpenAI、DeepSeek、Kimi、GLM、通义、MiniMax、硅基流动、OpenRouter、Ollama 等预设，任意兼容服务可自定义接入
- SSE 流式解析逐 token 渲染，携带 `stream_options:{include_usage:true}` 获取真实计费 token；高频滚动与状态刷新合并节流，长回答不掉帧
- 超时分层控制：连接 15s、流空闲 60s、整请求 60s、非流式兜底 120s；fetch 失败自动降级为 `obsidian.requestUrl` 非流式请求；供应商对 `stream_options` 返回 400/422 时自动去除该参数重试一次
- 思考内容（reasoning）单独轨道展示，可随时中止检索或生成

#### 本地倒排索引 RAG（词法检索，非向量）

- 维护 `term → Set(docId)` 倒排表，监听 Vault 修改/删除/重命名事件做增量更新，索引快照持久化到 `ai-index.json`
- 打开 AI 侧栏时后台预热全库索引；查询时先取候选文档集，再并行读取命中笔记的缓存小写切片打分，只注入受限长度的相关片段
- 多选上下文超出上限时执行同样的切片检索；自由问答未手动选择上下文时对全库 Markdown 执行全局检索
- 这是轻量的本地关键词检索：不建向量库、不做语义嵌入，数据不出设备

#### 图片多模态

- 支持 Ctrl/Cmd+V 粘贴截图或文件选择器添加（`files` 与 `items` 双路提取），最多 4 张、单张原始 ≤8MB
- 压缩管线：FileReader → dataURL → Image 解码 → canvas 等比缩放（最长边 ≤1568px）→ JPEG 质量 0.85 重编码
- 以 `{type:'text'} + {type:'image_url'}` 数组形式进入用户消息；已发送气泡回显缩略图，点击灯箱放大预览（Esc/遮罩关闭）。需要视觉模型才能识图

#### Agent 工具系统与三层权限

- **白名单注册表**：Agent 只能调用注册过的工具（读取待办、搜索笔记等），参数经 JSON Schema 校验，受保护路径（`.obsidian` 配置、插件源码）硬性过滤；未配置编码工作区时不开放任何文件写入与命令执行
- **三层权限模式**：`只读`（变更类工具不下发给模型）/ `读写`（默认，变更需逐次确认）/ `完整`（免确认，用户自担风险）
- **本地工具适配层**：通过组合注册表暴露系统能力——桌面通知、写剪贴板、打开链接/文件、以及**用户在配置中登记的命令允许列表**（`execFile` 执行，以 Vault 根为工作目录，20s 超时，输出封顶防刷屏）。模型只能按 id 调用允许列表内的命令，不能发明新命令
- **编码工作区（沙箱）**：指定一个本地文件夹后，Agent 额外获得该目录内的文件工具——浏览目录、按行读取、全文搜索（跳过 `.git`/`node_modules`）、创建/覆盖文件、精确字符串替换编辑（先读后改、多义拒绝、外部修改检测）——以及工作区内单条命令执行（无 shell 链接，输出/超时受限）。安全约束：路径词法 + realpath 双重校验拒绝符号链接逃逸，`.git` 禁止改写，sudo/su/doas 在确认之前直接拒绝；文件夹可用系统选择器选取或粘贴路径，支持最近使用一键切换
- 工具调用沿活动轨道实时展示名称、参数与结果摘要

#### 会话历史与用量统计

- 会话本地持久化，每会话记住模型、上下文选择、权限模式与绑定的编码工作区；会话列表按工作区分组，切换会话自动恢复其工作区
- 归一化各家 usage 字段（DeepSeek 的 `prompt_cache_hit_tokens`、OpenAI 的 `cached_tokens` 等），会话级累计输入/输出 token、缓存命中率与生成速度

## 安装

**社区插件市场（推荐）**：设置 → 第三方插件 → 浏览 → 搜索 **Cockpit Dashboard** → 安装并启用。

**手动安装**：从 [Releases](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases) 下载 `main.js`、`manifest.json`、`styles.css` 三个文件，放入 `.obsidian/plugins/cockpit-dashboard/` 后启用插件。

## 开发

```bash
git clone https://github.com/ZephyrHaven/Cockpit-Dashboard.git
cd Cockpit-Dashboard

# 运行测试（无框架断言脚本，逐文件执行）
for t in tests/*.test.js; do node "$t"; done

# 构建压缩产物到 dist/
node build.js

# 构建并部署到本机宿主插件目录（不覆盖用户 data.json）
bash deploy.sh
```

发布约定：更新 `manifest.json` 版本号 → 构建并测试 → 打不带 `v` 前缀的 tag → 用 `gh release create <version>` 上传 `dist/main.js`、`dist/styles.css`、`manifest.json` 三个独立附件（宿主插件商店据此检测更新）。源码仓库不提交构建产物。

## 赞助作者

如果这个插件确实帮你省了时间，欢迎请作者喝一杯：

[![爱发电 / Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-%E8%AF%B7%E4%BD%9C%E8%80%85%E5%96%9D%E4%B8%80%E6%9D%AF-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

也可以直接访问：<https://afdian.com/a/zephyrhaven>

## Author

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
