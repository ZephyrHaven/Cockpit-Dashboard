# 自定义组件开发规范 — SDK v1

组件商店现支持本地导入、更新、启用/禁用、导出与卸载自定义组件。组件使用 JavaScript 编写，通过受控界面树生成内容，不直接访问页面 DOM 或宿主插件对象。

## 快速开始

1. 在组件商店点击「导入组件 → 下载示例组件」，或使用源码中的 [阅读进度示例包](../examples/custom-components/reading-progress.cockpit-component.json)。
2. 选择 JSON 包，或选择包含清单、代码和样式的整个组件文件夹。
3. 查看组件名称、版本与申请的数据权限，确认安装。新组件默认加入商店的当前布局草稿；点击「应用布局」开始运行。取消布局草稿会保留安装，但不添加到仪表盘。
4. 在组件详情中禁用、导出、更新或卸载。导入同一 ID 视为更新；更新前再次展示权限，并保留已有私有数据和布局位置。

首次导入最多 512 KB，每个安装最多 20 个组件，组件存储总量最多 5 MB。暂不支持 ZIP、远程下载、npm 依赖或自动更新。

## 包结构

文件夹形式：

```text
reading-progress/
├── manifest.json
├── main.js
└── styles.css       可选
```

入口与样式路径使用英文字母、数字、连字符或下划线，必须是包内相对路径；禁止绝对路径、`..` 或同名文件。支持包内子目录。文件夹最多 30 个文件，总大小不超过 512 KB。

```json
{
  "id": "example.reading-progress",
  "name": "阅读进度",
  "description": "记录本周阅读目标与进度",
  "version": "1.0.0",
  "apiVersion": 1,
  "icon": "book-open",
  "category": "knowledge",
  "entry": "main.js",
  "styles": "styles.css",
  "permissions": []
}
```

单文件 JSON 形式将三个文件合并：

```json
{
  "manifest": { "id": "example.hello", "name": "问候", "version": "1.0.0", "apiVersion": 1, "icon": "smile", "category": "basic", "entry": "main.js", "permissions": [] },
  "code": "module.exports = { mount(ctx) { ctx.render({tag:'p', text:'Hello!'}); } };",
  "styles": "p { color:var(--text-normal); }"
}
```

ID 使用作者命名空间与组件名称，只使用小写字母、数字和连字符；安装后保持不变。名称最多 60 字，描述最多 300 字。版本使用 `1.0.0` 格式，SDK 接口版本固定为数字 `1`。图标使用宿主提供的 Lucide 名称，不使用表情符号。

| category | 商店分组 |
|---|---|
| basic | 基础与快捷操作 |
| planning | 任务与日历 |
| focus | 专注与习惯 |
| knowledge | 笔记与知识 |
| insights | 统计与回顾 |
| automation | 自动化 |
| team | 团队与同步 |

## 运行接口

```javascript
module.exports = {
  async mount(ctx) {
    let count = Number((await ctx.storage.get())?.count) || 0;
    const draw = () => ctx.render({
      tag: 'div', class: 'counter', children: [
        { tag: 'p', key: 'value', text: String(count) },
        { tag: 'button', key: 'increment', text: '加一', action: 'increment' }
      ]
    });
    ctx.on('increment', async () => {
      await ctx.storage.set({ count: ++count });
      draw();
    });
    draw();
  }
};
```

`mount(ctx)` 必须在启动后 12 秒内完成，并至少调用一次 `ctx.render()`。不要使用 `import` / `require`，代码运行在独立 Worker 中，不能使用 `window`、`document` 或宿主插件实例。

| 接口 | 行为 |
|---|---|
| `ctx.language` | 挂载时的语言，例如 `zh-CN` / `en` |
| `ctx.theme` | 挂载时的 `dark` / `light`；样式变量随宿主实时更新 |
| `ctx.render(tree)` | 用新界面树更新组件；每次最多 200 个节点、12 层深度 |
| `ctx.on(action, handler)` | 注册按钮或输入动作，返回取消注册函数 |
| `ctx.storage.get()` | 异步读取当前组件的私有 JSON 数据，首次为 `null` |
| `ctx.storage.set(value)` | 异步替换当前组件的私有 JSON 数据，最多 64 KB |
| `ctx.data.todos()` | 有 `todos.read` 权限时读取最多 100 条个人待办摘要 |
| `ctx.data.focus()` | 有 `focus.read` 权限时读取今日专注分钟和最多 90 天的历史 |
| `ctx.onDataChanged(handler)` | 订阅数据变化；参数为作用域数组，如 `['todos']`、`['focus']` |
| `ctx.setInterval(handler, ms)` | 注册定时回调，间隔限定为 1 秒至 1 小时；返回取消函数 |

更新待办摘要的例子：

```javascript
module.exports = {
  async mount(ctx) {
    const refresh = async () => {
      const tasks = await ctx.data.todos();
      ctx.render({ tag:'p', text:'未完成：' + tasks.filter(task => !task.done).length });
    };
    ctx.onDataChanged(scopes => { if (scopes.includes('todos') || scopes.includes('full')) return refresh(); });
    await refresh();
  }
};
```

此例的清单需声明 `"permissions": ["todos.read"]`。待办摘要字段为 `text`、`done`、`priority`、`due`；不包含团队记录、笔记正文或宿主配置。专注摘要为 `{ todayMinutes, history:[{date,minutes}] }`。数据接口只读；未授权调用会拒绝，不接受组件自行传入的其他组件 ID。

## 界面树

每个节点包含 `tag`，可选 `key`、`text`、`children`、`class`、`label`。文字与子节点分开声明。`key` 在同一棵树中唯一，用于保留输入框和按钮节点；可交互元素建议始终提供稳定的 `key`。

允许标签：`div`、`span`、`p`、`strong`、`em`、`h3`、`label`、`button`、`input`、`textarea`、`select`、`option`、`progress`、`ul`、`li`。文字使用纯文本，单字段最多 4000 字，不接受 HTML、链接、脚本、图片地址或事件代码。

- 按钮声明 `action:'save'`，点击后调用 `ctx.on('save', handler)`。
- 输入框声明 `change:'title'`；变化后收到 `{ value, checked }`。文本输入在提交 change 事件时通知；输入类型支持 `text`、`number`、`checkbox`。
- 表单支持 `value`、`placeholder`、`checked`、`disabled`；`label` 生成无障碍标签。
- `progress` 的 `value` 为 0–100。
- 界面消息最多 128 KB，每秒最多 60 条；同时最多 8 个待完成的数据请求。

## 样式与系统能力

内容区位于独立 Shadow DOM，标题、线条图标、折叠、重命名、拖动与显隐由驾驶舱提供。组件自身不要重复生成标题外壳。组件标题遵守外观设置的图标开关。

`styles.css` 只接受普通选择器及颜色、背景色、边框、间距、排版、flex/grid、尺寸等展示属性；`@import`、`@font-face`、其他 at-rule、图片、定位、filter 及加载外部资源的属性会被忽略。复用 `--ck-accent`、`--text-normal`、`--text-muted`、`--background-secondary` 等变量，兼容深浅主题与窄屏。当前接口不提供自定义动画。

安装与启用状态为全局；位置、显隐、名称为情景配置。新组件只在确认应用的当前情景显示，其他情景默认隐藏。隐藏、折叠、切换情景、关闭视图、禁用及卸载都会停止实例；重新显示后重新执行 `mount`。需要保留的状态应写入私有存储。重排模块不会移动或重启隔离 Worker。

Worker 被终止时，其计时器和执行环境一并释放；SDK v1 不提供卸载回调，也不调用 mount 返回的清理函数；资源由运行时统一释放。组件不得假设自己会一直运行。

## 本地存储、恢复与执行边界

组件包、启用状态、错误次数与各组件的私有数据保存在插件目录 `custom-components.json`，上一次有效状态保存为 `.backup`。不修改用户笔记，不自动同步给团队或发送给外部服务。代码和私有数据均为本机明文，请勿保存密钥。

更新失败保留原内存状态；更新后的首次启动若失败，会自动恢复上一版本及其私有数据。候选版本第一次完成 mount 并生成界面后，视为启动成功；读取文件损坏时尝试本机备份；不支持的存储版本不会被自动覆盖。卸载默认保留私有数据，重新导入同一 ID 后恢复；勾选「卸载时同时清除组件私有数据」会删除当前存储中的数据。上一状态备份仍可能含有这些数据，需彻底清除时同时处理 `.backup`。导出的组件包只包含代码与清单，不包含私有数据。

执行代码的 Worker 由不含 `allow-same-origin` 的 sandbox iframe 创建。iframe 的 CSP 禁止网络请求与外部资源，Blob Worker 继承这份策略；主页面仅接收经过验证的界面树和权限受控的数据请求。执行前检查 Worker 是否暴露 Node 环境，发现暴露时拒绝加载组件代码。

参考：[Worker 与 CSP](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy)、[iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox)。浏览器进程仍有共享的系统资源，这不是对恶意内存耗尽的操作系统级配额隔离。仅安装来源可信的组件。

运行异常只显示在当前组件中；无响应约 6 秒后停止 Worker，连续 3 次运行失败后自动禁用，可在组件详情中重新启用。遇到问题也可从宿主命令面板执行「停止并禁用所有自定义组件」，无需先打开组件界面。
