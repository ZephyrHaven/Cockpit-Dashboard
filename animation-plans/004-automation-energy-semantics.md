# 004 — 把自动化执行过程做成可感知的能量路径

- **Status**: IMPLEMENTED on `codex/motion-v2`
- **Base commit**: 292b13d
- **Severity**: HIGH
- **Category**: Purpose, state indication, missed opportunity
- **Estimated scope**: 4 files, 300–500 lines

## Problem

Workflow UI 已有步骤链，但 `src/workflows.js:514-523` 只渲染静态节点；运行时只把整张卡变成 `running`，看不到正在执行哪个步骤、成功如何向前传递、失败停在哪里。

```javascript
const chain = row.createDiv({ cls:PLUGIN_ID+'-workflow-card-chain' });
workflow.steps.slice(0, 4).forEach((step, index) => {
  const node = chain.createDiv({ cls:PLUGIN_ID+'-workflow-card-step' });
});
```

## Target

- 引入清晰的能量语义：`charge`（按下/准备）、`conduct`（步骤间传递）、`crystallize`（成功收束）、`halt`（失败停止）。
- Engine 在 `run-start`、`step-start`、`step-success`、`step-failure`、`run-complete` 发结构化进度事件，包含 workflowId、stepIndex、状态，不包含敏感命令正文。
- UI 保持卡片 DOM，不因每个步骤刷新整模块；只更新对应节点 class/ARIA live 状态。
- 连接线用 SVG `stroke-dashoffset` 或 transform 进度表达传递；单段 180–260ms，执行等待期间使用低频非位移动画。
- 成功节点 220ms settle pop（最大 scale 1.04），失败节点短促高亮后静止；reduced motion 直接切换颜色和图标。
- 指标数字使用克制的 odometer/clip 切换，状态徽章用 blur 2px 的 crossfade，避免双曝光。

## Repo conventions to follow

- `CockpitWorkflowEngine` 已有订阅器和 `running` Set；扩展事件 payload，不另建并行状态源。
- 运行日志与业务结果保持现有格式；进度事件仅内存态。
- UI 更新优先局部操作，不调用 `_renderDashboard(true)`。

## Steps

1. 扩展 `src/workflows.js` 的 engine notify/subscribe，加入无敏感正文的结构化进度事件。
2. 在 `run()` 每个阶段发事件，异常和 abort 都必须以终态收束。
3. `buildWorkflowsModule()` 为 card/step 建 ref map；订阅进度并局部更新 `data-run-state`、`aria-current`、图标和连接线。
4. 在 `styles.css` 实现 charge/conduct/crystallize/halt；所有循环动画在结束、隐藏、关闭总开关时停止。
5. 在 `src/motion.js` 增加数字 clip/odometer 与 SVG path helper，使用统一 token。
6. 测试事件顺序、失败位置、敏感内容不泄漏、取消清理和 reduced-motion。

## Boundaries

- 不改变 workflow 执行顺序、命令权限、安全确认或运行日志内容。
- 不能通过轮询更新 UI。
- 不使用持续粒子背景或 Canvas 神经网络装饰。

## Verification

- **Mechanical**: `npm test`, `node build.js`, `node --check dist/main.js`, `git diff --check` 全通过。
- **Feel check**: 运行三步流程时，能明确看到当前步骤、已完成路径和失败停点；快速再次运行不会残留旧状态；切后台后动画停止，回来显示真实终态。
- **Done when**: 用户无需打开日志也能理解流程此刻做到哪一步、为何停止。
