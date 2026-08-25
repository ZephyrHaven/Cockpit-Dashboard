# Cockpit Dashboard

[![Release](https://img.shields.io/github/v/release/ZephyrHaven/Cockpit-Dashboard?style=for-the-badge)](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases)
[![Support on Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-Support%20Zephyr%20Haven-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

Cockpit Dashboard 是一个本地优先的 Obsidian 驾驶舱首页插件：把待办、日历、RSS、搜索、AI 助手、统计、专注计时与本地自动化集中在一个可自由编排的工作台中。本文档只介绍项目定位与技术原理。

## 核心特性

- **仪表盘工作台**：待办今天队列、日历看板（月/周视图、拖拽排期）、统计卡片、编辑热力图、分类卡片、最近更新、收藏文件、闪念胶囊
- **AI 助手**：多模型对话侧栏，本地多会话历史、多选笔记上下文、临时文本附件、贴图对话、本地关键词 RAG、流式输出、白名单 Agent 工具
- **自动化**：番茄钟（可关联待办）、全局闹钟、定时任务（含桌面 Shell）、Server酱³/Bark/MEOW 消息推送
- **布局系统**：模块拖拽排序、显示/隐藏、折叠持久化，多情景布局可按星期/时间段/文件夹自动切换
- **其他**：Spotlight 全局搜索、RSS 双栏阅读器、双语界面、首次引导

## 技术架构

### 构建系统

插件不依赖打包器，`build.js` 按 fixed 顺序拼接 `src/` 下模块生成 `main.js` 与压缩版 `main.min.js`：

```text
constants → utils → todos → bookmarks → calendar → search → pomodoro
→ release-notes-core → ai-index → ai-context → ai-history → ai-local-tools
→ ai-tools → ai … → _framework（视图与插件主类）
```

模块间通过顶层函数声明共享作用域，各模块均可用 Node 直接 `require` 单测。测试是无框架的断言脚本（纯函数断言 + 源码模式断言），逐文件独立运行。

### 数据与存储原则

| 存储 | 内容 |
|---|---|
| `_data/todos.md` | 待办（行内 `id:`/`due:`/`p:` 元数据，插件自动维护） |
| `_data/focus.md` | 按日期累计的专注历史 |
| 插件 `data.json` | Storage V2 设置、布局情景、Toolbar、RSS 配置、AI 模型配置（**不含 API Key**） |
| Obsidian SecretStorage | AI 服务 API Key |
| 插件私有 `ai-history.json` | 最多 30 个 AI 会话（不含附件正文/RAG 片段/思考过程） |
| 插件私有 `ai-index.json` | 倒排索引快照 |
| IndexedDB | 设备本地的 RSS 正文缓存与已读状态 |

无遥测、无后台上传。只有你主动发起 AI 请求时，所选笔记片段、附件或 RAG 命中的截断片段才会发送到你配置的模型服务；自由问答在本机完成检索，不会整体上传 Vault。

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

- **白名单注册表**：Agent 只能调用注册过的工具（读取待办、搜索笔记等），参数经 JSON Schema 校验，受保护路径（`.obsidian` 配置、插件源码）硬性过滤，Shell 与任意文件写入不开放
- **三层权限模式**：`只读`（变更类工具不下发给模型）/ `读写`（默认，变更需逐次确认）/ `完整`（免确认，用户自担风险）
- **本地工具适配层**：通过组合注册表暴露系统能力——桌面通知、写剪贴板、打开链接/文件、以及**用户在配置中登记的命令允许列表**（`execFile` 执行，以 Vault 根为工作目录，20s 超时，输出封顶防刷屏）。模型只能按 id 调用允许列表内的命令，不能发明新命令
- 工具调用沿活动轨道实时展示名称、参数与结果摘要

#### 会话历史与用量统计

- 会话本地持久化，每会话记住模型、上下文选择与最近的对话轮次
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

# 构建 main.js / main.min.js
node build.js

# 构建并部署到本机 Obsidian 插件目录（不覆盖用户 data.json）
bash deploy.sh
```

发布约定：更新 `manifest.json` 版本号 → 构建并测试 → 打不带 `v` 前缀的 tag → 用 `gh release create <version>` 上传 `main.js`、`styles.css`、`manifest.json` 三个独立附件（Obsidian 插件商店据此检测更新）。源码仓库不提交构建产物。

## 赞助作者

如果这个插件确实帮你省了时间，欢迎请作者喝一杯：

[![爱发电 / Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-%E8%AF%B7%E4%BD%9C%E8%80%85%E5%96%9D%E4%B8%80%E6%9D%AF-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

也可以直接访问：<https://afdian.com/a/zephyrhaven>

## Author

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
