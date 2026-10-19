# 006 — 组件商店改为暂存选择、统一应用

- **Status**: IMPLEMENTED
- **Base commit**: 292b13d
- **Severity**: HIGH
- **Category**: Purpose, interruptibility
- **Estimated scope**: 3 files, 80–140 lines

## Problem

`src/component-store.js:101-102` 在每次添加或移除组件时清空并重画组件商店主体：

```javascript
_rerenderInPlace() { /* capture */ this.render(...); cockpitPlayFlip(...); }
_setVisible(id, visible) { this.draft=setComponentVisibility(this.draft,id,visible); this._rerenderInPlace(); }
```

当前布局页中，点击“移除”后该行立刻消失；目录页也整块刷新。这破坏了“先选择改动、点击应用后一次生效”的编辑模型，并造成滚动和视觉上下文跳变。

## Target

- `_setVisible()` 只更新 `draft`，不调用 `render()`、`_rerenderInPlace()` 或驾驶舱刷新。
- 当前布局中的待移除项保留原位置，增加 `is-pending-remove`，按钮变为“撤销”；恢复后移除 pending 状态。
- 目录卡片不重画，只原地更新 `added`、`is-pending-add`、`is-pending-remove`、按钮文字/样式与“已添加”标记。
- 点击底部“应用”后才保存场景并关闭；`onClose()` 只在 applied/globalChanged 时刷新驾驶舱一次。
- 取消关闭时丢弃 draft，不刷新驾驶舱。

## Repo conventions to follow

- draft 仍使用 `cloneComponentLayoutSnapshot()` 与 `setComponentVisibility()`。
- 所有 DOM 使用 `createEl/createDiv/createSpan`。
- 组件商店滚动位置和拖拽排序逻辑保持不变。

## Steps

1. 为 current row、catalog card 与 visibility action 增加稳定的 `data-module-id` / `data-component-visibility-action`。
2. 新增 `_syncVisibilityItem(id)`，根据初始 snapshot 与当前 draft 更新 class、按钮文案、ARIA 和 added 标记。
3. `_setVisible()` 仅变更 draft 后调用 `_syncVisibilityItem()`。
4. 当前页 `_filteredEntries(true)` 的初次渲染保持不变；点击移除后行不消失。
5. 增加测试断言 `_setVisible` 不调用 `_rerenderInPlace`，apply 仍是唯一场景保存入口。

## Boundaries

- 不改变排序、重命名、工具栏/统计细项的保存语义。
- 不在点击添加/移除时刷新驾驶舱。
- 不新增依赖。

## Verification

- **Mechanical**: `node tests/component-store.test.js`, `npm test`, `git diff --check`。
- **Feel check**: 连续添加/移除多个组件时商店不跳、不丢滚动位置；点击取消驾驶舱不变；点击应用后驾驶舱只刷新一次并反映全部修改。
- **Done when**: 添加/移除成为可撤销的暂存选择，而不是即时刷新。
