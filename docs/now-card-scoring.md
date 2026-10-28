# 「此刻」卡片 · 打分函数设计草案 v0.1

> 目标：在任意时刻只给出 **1 条主推荐 + 2 条备选**，让用户不用扫清单就知道现在该做什么。
> 非目标：不做另一个 AI 对话入口；不在第一版引入 LLM 调用；不新增任何网络请求。

## 1. 现有信号盘点

| 信号 | 来源 | 关键字段 | 时间精度 | 备注 |
|---|---|---|---|---|
| 系统日程 | `appleCalendar.readEvents(start,end)` | `uid,title,calendar,startAt,endAt,allDay,location` | 秒 | 需 `showEvents` 开启；仅 Mac 桌面端 |
| 待办 | `_data/todos.md` | `id,text,tags,priority,dueDate,dueHasTime,done,created,doneDate` | `dueDate` 到分钟；`created/doneDate` **仅日期** | `doneDate` 无法回答"几点完成" |
| 习惯 | `_data/habits.md` | `id,name,icon,created,log[]` | **仅日期** | 配合 `computeStreak()` |
| 专注日志 | `_data/focus.md` | `date → minutes` | **仅日期** | 日总量，无时段 |
| 番茄钟任务统计 | `data.json` `pomodoroTaskStats` | `taskId,text,totalMinutes,sessions,lastFocusedAt` | **ISO 秒** | 唯一现成的精确时段信号 |
| 番茄钟完成记录 | `data.json` `pomodoroCompletions` | `id,day,minutes,completedAt` | **ISO 秒** | 同上 |
| 倒计时 | `data.json` `countdowns` | `id,name,enabled,targetAt` | 秒 | |
| 番茄钟运行态 | `pomodoro.js` 闭包 | — | — | **当前无对外读取接口**，需新增 |

结论：**"用户 9 点想干什么" 这件事，现有数据只能从番茄钟里学到一小部分**。要真正按时段学习，必须新增一份本地交互日志（见 §5）。这也决定了分期：第一版靠手写规则 + 番茄钟信号，日志攒够后再叠加偏好。

## 2. 候选池

一次评估最多产出以下候选（同 `kind:id` 去重）：

| kind | 入选条件 |
|---|---|
| `focus` | 番茄钟正在运行且非休息 |
| `event` | 当天日程，`endAt > now` |
| `todo` | `done === false`，且（有 `dueDate` ≤ 今天+1 ｜ `priority === 'high'` ｜ 24h 内专注过 ｜ 创建 ≥ 3 天） |
| `habit` | 今天未打卡的习惯 **合并为一条**候选（取最大 streak 作代表） |
| `countdown` | `enabled` 且剩余 ≤ 72h |
| `rss` | 未读 ≥ 20 且距上次打开 RSS > 8h |

明确排除：`resurface`、`projects`、收藏、闪念——它们是"回顾/整理"类，不是"此刻要动手"类。

## 3. 分层与打分

### 3.1 三层，层间顺序固定

层间不可被分数或偏好跨越，这样"12 分钟后开会"永远不会被一条待办挤下去。

| 层 | 内容 | 说明 |
|---|---|---|
| **A（承诺）** | 番茄钟运行中 / 日程进行中 / 日程 20 分钟内开始 / **有具体时间的待办 30 分钟内到期** | 第四项让非 Mac 用户也有 A 层可用 |
| **B（该做）** | 其余待办、倒计时 | |
| **C（可选）** | 习惯、RSS、今天更晚的日程 | 基本只做备选 |

### 3.2 A 层分数

| 情形 | 分数 |
|---|---|
| 番茄钟运行中（非休息） | 覆盖规则：唯一推荐，不出备选 |
| 日程进行中 | `100` |
| 日程 `0 ≤ 距开始 ≤ 20 分钟` | `70 + (20 - 剩余分钟)` → 70…89 |
| 待办 `dueHasTime` 且 `0 ≤ 距到期 ≤ 30 分钟` | `65 + (30 - 剩余分钟) * 0.6` → 65…83 |

### 3.3 B 层分数（待办）

```
基础
  逾期         30 + min(逾期天数, 14) * 2          → 32 … 58
  今天到期·有时 28（到期 ≤2h 再加 10）             → 28 … 38
  今天到期·无时 22
  明天到期     8
  无期限       0
加成
  priority:high  +10        priority:mid +3
  创建时长      +min(天数, 30) * 0.3               → 0 … 9
  24h 内专注过未完成  +12
  正被番茄钟关联（未运行）+8
  重复任务今天到期    +2
```

上限 63，恒低于「20 分钟内日程」的 70，这是刻意的。

### 3.4 B 层分数（倒计时）

`周≤1h: 55` ｜ `≤24h: 30` ｜ `≤72h: 10`

### 3.5 C 层分数

| 来源 | 分数 |
|---|---|
| 习惯（大一统候选） | `12 + min(streak, 12)` → ≤24；18:00 后仍未打卡再 `+8` |
| 日程今天更晚 | 8（`allDay`：5） |
| RSS | 10 |

C 层封顶 32，先天进不了主推荐，除非 A/B 层全空——这正是想要的降级行为。

## 4. 时段偏好

### 4.1 分桶

`6-9` / `9-12` / `12-14` / `14-18` / `18-22` / `22-6`，共 6 桶。工作日与周末暂不区分（先看样本密度，Phase 2 再说）。

### 4.2 从日志聚合

对每个 `(kind, bucket)`，取最近 30 天记录：

```
net   = 3*complete + 1*click - 2*dismiss - 0.3*ignore
mass  = 3*complete + 1*click + 2*dismiss + 0.3*ignore
pref  = mass < 6 ? 0 : clamp(net / mass, -1, 1) * min(1, mass / 12)
```

`min(1, mass/12)` 是样本量收缩：样本少时自动趋近 0，因此冷启动期不需要特殊分支。

### 4.3 应用方式：乘性，且只在层内

```
层内排序键 = score * (1 + 0.3 * pref[kind][bucket])
```

乘性而非加性有两个理由：
1. 偏好永远无法跨越层（A 层不会被偏好影响）；
2. 高分项被偏好放大得更多，符合"你确实喜欢，那就更靠前"的直觉。

词表以外的细分（如按标签 `#work` / `#life` 区分待办）留到 Phase 2，届时把 `kind` 扩展成 `todo#work` 之类。

## 5. 交互日志

存储：`cockpitPluginLogDir(app, manifest) + '/now.jsonl'`（插件目录 `logs/`，不进 vault、不参与同步）。
复用 `jsonl-log.js` 的 `cockpitAppendJsonl(file, record, {limit:4000, maxBytes:524288})` 与 `cockpitClearJsonl`。

每行：

```json
{"at":"2026-10-28T09:12:04.000Z","bucket":"9-12","kind":"todo","id":"abc12345",
 "action":"click","rank":1,"score":58,"pref":0.17}
```

`action` 取值：

| action | 触发时机 | 含义 |
|---|---|---|
| `impression` | 主推荐发生变化并渲染完成 | 曝光 |
| `click` | 点击主推荐或备选的行为按钮 | 有兴趣 |
| `complete` | 从卡片直接勾选完成待办 / 打卡习惯 | 命中，权重最高 |
| `dismiss` | 点「不是这个」 | 明确否定 |
| `ignore` | 距上次 `impression` ≥ 3 分钟且无任何交互，下一次评估时补记 | 弱否定 |

`ignore` 不需要额外事件监听，借下一次评估的时机补记即可，避免挂全局监听器。

隐私：纯本地、无网络；设置页提供"个别化排序"开关与"清空记录"按钮；README「数据存储」表按现有规则补充一行。

## 6. 展示与稳定性

- 主推荐：标题 + 一行理由（≤ 14 字）+ 主动作按钮 + 「不是这个」。
  理由模板：`12 分钟后 · 站会` / `逾期 3 天 · 报销` / `连了 6 天 · 别断在今天` / `进行中 · 还剩 18 分钟`。
- 备选 2 条：单行，点击直接打开对应编辑器。
- **不自动轮播**。重排时机：模块构建、每分钟一次的轻量重算、`silent-refresh` 作用域触发。只有 A 层状态变化才重建 DOM，其余只更新文本与顺序。
- 锚定：记住上一次主推荐 `kind:id`（内存，可选持久化到 `data.json` 的 `now.anchor`）。新第一名需超出 `35%` 才顶替。
- dismissed 的候选 4 小时内不再作为主推荐（由日志派生，不额外存状态）。
- 冷却：非 A 层候选作为主推荐后 90 分钟内降为备选；若池中无其他可选项则不冷却，避免"唯一急事被藏起来"。
- 空状态：`接下来 3 小时没有安排 · 从待办里挑一件开始？` + 「随便来一件」（取无期限待办中 `创建天数 × 优先级` 最高者）。

## 7. 工程拆分

| 文件 | 职责 |
|---|---|
| `src/now-core.js` | 纯函数：`nowBucket(now)`、`collectNowCandidates(ctx)`、`scoreNowCandidate()`、`rankNowCandidates({pref,anchor,bucket})`、`nowReasonText()`。无 DOM / 无 `obs`，可直接被测试 require |
| `src/now-log.js` | 日志路径、`appendNowAction`、`readNowActions`、`buildNowPreference`、`clearNowLog` |
| `src/now.js` | `buildNowModule(view, root)`、`view._refreshNowRef`、`_makeModuleCollapsible('now', ...)` |

接入点：

- `build.js` `MODULES`：`now-core` → `now-log` → `now`（置于 `habits` 之后、`_framework` 之前）。
- `_framework.js` `_moduleRegistry()` 增加 `{ id:'now', label: this._t('layout.modules.now'), collapsible:true, matches: dataset.section 为 now-title / now-body }`；`_buildAll` 在 5.3 习惯模块后以 try/catch 接入。
- `component-store.js` `COMPONENT_STORE_META` 登记图标与分类。
- `silent-refresh.js`：`todos` / `habits` / `focus` 作用域触发 `_refreshNowRef`；日程通过 `appleCalendar.subscribeEvents` 触发。
- `pomodoro.js`：新增只读快照 `floatEl._cockpitPomodoroState = () => ({ running, isBreak, remaining, endAt, task })`，不改变现有行为。
- `i18n`：`sections.now`、`layout.modules.now`、理由模板与按钮文案（中/英各一份）。

## 8. 测试清单（`tests/now-core.test.js` + `tests/now-log.test.js`）

1. 番茄钟运行中 → 只有一个推荐，且 `kind === 'focus'`。
2. 15 分钟后开始的日程排在"逾期 10 天 + 高优先级"待办之前。
3. 逾期待办 > 今天到期待办 > 无期限待办（稳定顺序）。
4. 构造 `pref.todo = 1`，A 层日程仍居第一（层不可跨越）。
5. 锚定：新候选分数仅高 20% 时不换主推荐；高 40% 时更换。
6. 样本量 < 6 时 `pref === 0`。
7. dismiss 后 4 小时内该候选不再作为主推荐。
8. 无任何候选 → 返回空状态标记，不抛错。
9. `allDay` 日程不会抢占主推荐（除非 A/B 层为空）。
10. 聚合函数：`complete` 为正、`dismiss` 为负、截断到 ±1。

## 9. 风险与降级

| 风险 | 应对 |
|---|---|
| 冷启动误推 | C 层封顶 32、偏好样本收缩、dismiss 冷却 |
| 未开启 `showEvents` / 非 Mac | A 层退化为"有时间的待办"，文案不得假装知道日程 |
| 每分钟重算带来的开销 | 纯内存计算；不读文件；文件变化只经 refresh 作用域进入 |
| 卡片频繁跳动引起不信任 | 锚定 + 90 分钟冷却 + 只有 A 层变化才重建 DOM |
| 与「今日运行总览」职责重叠 | `calendar-day-flow` 是**清单**，本模块是**建议**；不合并、不复用其排序 |

## 10. 待确认

1. 模块默认显示，还是按 `OPTIONAL_DASH_MODULES` 惯例默认隐藏？（我倾向默认显示——它就是这个功能本身。）
2. 「个别化排序」开关默认开还是关？
3. 是否允许从卡片直接完成待办 / 打卡习惯？（`complete` 是最强信号，但有误触风险。）
4. 第一版是否只保留「不是这个」这一种负反馈？（建议是，避免反馈项过多反而没人用。）
