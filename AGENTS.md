# Cockpit Dashboard — 项目档案

> **版本**: v1.0.9
> **源码路径**: `~/Downloads/cockpit-dashboard`（Git 仓库）
> **Obsidian 插件部署目录**: `~/.obsidian/plugins/cockpit-dashboard/`（仅运行时文件）
> **部署命令**: `cd ~/Downloads/cockpit-dashboard && bash deploy.sh`
> **GitHub**: `sadom125/Cockpit-Dashboard`

---

## 目录结构

```
~/Downloads/cockpit-dashboard/       ← 源码 + Git 仓库
├── build.js                         ← 打包脚本
├── deploy.sh                        ← 构建 → 部署到 Obsidian
├── main.js                          ← 构建产物
├── styles.css                       ← 样式
├── manifest.json                    ← 插件清单
├── data.json                        ← 默认配置（首次安装）
├── src/                             ← 模块源码
│   ├── constants.js                 ← 常量（VIEW_TYPE, PLUGIN_ID, 颜色, 图标, 默认待办）
│   ├── utils.js                     ← fmtDate, extractTags, getDailyTip
│   ├── todos.js                     ← loadTodos, saveTodos, syncHermesTodos
│   ├── bookmarks.js                 ← loadBookmarks, saveBookmarks
│   ├── calendar.js                  ← buildCalendar（月视图 + 待办同步）
│   ├── search.js                    ← buildSearch（内嵌搜索）
│   ├── pomodoro.js                  ← buildPomodoro（浮动全局单例）
│   └── _framework.js                ← CockpitView / CockpitPlugin 主逻辑
├── AGENTS.md
└── .git/

~/.obsidian/plugins/cockpit-dashboard/  ← 仅运行时文件（部署目标）
├── main.js
├── styles.css
├── manifest.json
└── data.json                         ← 用户配置（部署不覆盖）
```

## 关键特性

- **首次使用引导**：非遮挡浮动引导卡片 + 蓝色脉动高亮圈，点「下一步」逐步浏览各功能，可跳过
- **日历看板**：月视图，支持左右箭头切换月份（带动画），点击日期查看待办详情
- **待办管理**：状态筛选（全部/待办/已办）、标签分类、红黄绿优先级、截止日期提醒
- **番茄钟**：浮动可拖拽全局单例，25+5 循环，数据持久化到 `_data/focus.md`
- **统计卡片**：笔记总数、待办完成率、今日专注时长（带进度条）
- **编辑热力图**：近 30 天编辑频率
- **闪念胶囊**：快速记录想法，保存到 `_daily/` 目录
- **工具栏**：新笔记、搜索、标签、图谱、Hermes、驾驶舱 H5、工作日志、番茄钟
- **收藏文件**：⭐ 收藏重要的笔记文件
- **tokyo-night 风格**：深色渐变 + 霓虹蓝紫主题

## 开发流程

```bash
cd ~/Downloads/cockpit-dashboard
# 修改 src/ 下的源码
bash deploy.sh     # 自动 node build.js + 复制到 Obsidian 插件目录
# 刷新 Obsidian 插件页面生效
```

> `data.json` 包含用户配置（昵称、折叠状态、引导完成等），部署时不覆盖。

## 构建说明

- `build.js` 读取 `src/` 模块 + `styles.css`，拼接生成 `main.js`
- 模块加载顺序：constants → utils → todos → bookmarks → calendar → search → pomodoro
- `_framework.js` 包含 CockpitView 完整逻辑，在 build.js 模板中定义
- `styles.css` 在运行时通过 `loadCss()` 读取嵌入页面

## 发布流程

```bash
# 1. 更新 manifest.json 版本号
# 2. 同步更新 src/constants.js 里的 RELEASE_HISTORY，补上本地“最近更新”版本说明
# 3. 重新构建 main.js / main.min.js
# 4. git tag <version> && git push origin <version>
# 5. gh release create <version> --title "<version>" --notes "## 更新内容\n- ..." main.js styles.css manifest.json
```

> Release 附件必须上传 **main.js、styles.css、manifest.json** 三个独立文件（不支持 zip），
> 否则 Obsidian 插件商店无法检测更新。
> Tag 名不加 `v` 前缀（如 `1.0.9` 而非 `v1.0.9`）。

## 备份安全

源码在 `~/Downloads/cockpit-dashboard/`（独立 Git 仓库，同步 GitHub），
删除 Obsidian 插件不会丢失源码。恢复只需重新部署。
