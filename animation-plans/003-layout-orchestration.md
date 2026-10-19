# 003 — 为布局、列表和情景切换建立 FLIP 编排

- **Status**: IMPLEMENTED on `codex/motion-v2`
- **Base commit**: 292b13d
- **Severity**: HIGH
- **Category**: Interruptibility, performance, missed opportunity
- **Estimated scope**: 6 files, 300–500 lines

## Problem

`src/layout-edit.js:209-220` 拖放模块后直接 `insertBefore`，相邻模块瞬移：

```javascript
if (before) root.insertBefore(dragged, wrapper);
else root.insertBefore(dragged, wrapper.nextSibling);
await view._saveModuleOrder(...);
```

`src/_framework.js:946-952` 的情景切换只做全根交叉淡入淡出，没有保留相同模块的空间连续性。组件商店的列表增删会清空并重画。

## Target

- 原生 FLIP helper：读取 First/Last rect，只动画 `transform`/`opacity`，320ms `--ck-ease-in-out`；新动作取消旧动画并从当前视觉位置继续。
- 模块拖放、组件商店增删/排序、workflow 步骤增删、情景切换中相同 `data-motion-key` 的元素使用 FLIP。
- 删除元素使用 180ms 淡出/缩小到 .96；新增使用 220ms `translateY(6px) scale(.98)` 到原位。
- 场景切换只对保留模块做空间移动；真正新增/删除模块分别进出，避免整个页面长时间双重叠加。
- 列表 reveal 限制在首屏可见项，30–60ms stagger，绝不阻断交互。

## Repo conventions to follow

- 布局重排仍由 `layout-edit.js` 保存，Motion helper 不写业务状态。
- 情景切换仍由 `_switchScene()` / `_renderDashboard()` 驱动。
- 组件商店滚动恢复逻辑必须保留。

## Steps

1. 在 `src/motion.js` 添加 `cockpitCaptureLayout`、`cockpitPlayFlip`、`cockpitRevealList` 和取消机制。
2. 在 `src/layout-edit.js` 拖放前后捕获模块 rect，并给 wrapper 稳定 `data-motion-key="module:<id>"`。
3. 在 `src/component-store.js` 原地重画前保存可见卡片 rect，重画后播放 FLIP，同时继续恢复 scrollTop。
4. 在 `src/workflows.js` 步骤编辑器增删/调整时为 step 加稳定 key，使用 FLIP 而不是整列跳动。
5. 在 `src/_framework.js` 情景切换中配对相同模块；把全页 crossfade 降级为背景保护层。
6. 添加布局顺序、DOM 身份、取消旧动画和 reduced-motion 测试。

## Boundaries

- 只动画 transform/opacity，不动画 top/left/width/height。
- 不能因为测量布局而增加持续 rAF 循环。
- 不破坏拖放保存、组件商店滚动和场景数据兼容。

## Verification

- **Mechanical**: 全量测试、构建、语法与 diff 检查通过。
- **Feel check**: 慢放 10% 检查相邻模块让位而非瞬移；连续拖放没有回弹到旧位置；场景切换中相同模块移动到新位置而不是先消失后出现。
- **Done when**: 所有主要布局变化都能解释空间关系，且动画可被下一次动作自然打断。
