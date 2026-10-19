# 005 — 修复全局按钮动效对定位与角标的破坏

- **Status**: IMPLEMENTED
- **Base commit**: 292b13d
- **Severity**: HIGH
- **Category**: Performance, cohesion
- **Estimated scope**: 3 files, 30–60 lines

## Problem

`styles.css:6271` 为所有按钮强制写入 `position:relative` 与 `overflow:hidden`：

```css
.cockpit-dashboard-root[data-motion="full"] button:not(:disabled),
.cockpit-dashboard-root[data-motion="full"] [role="button"]:not([aria-disabled="true"]) {
  position:relative;
  overflow:hidden;
}
```

这会覆盖 `.cockpit-dashboard-content-resize-handle { position:absolute; }`，导致整页宽度拖拽手柄掉进普通文档流；也会覆盖 `.cockpit-dashboard-cal-rss-btn { overflow:visible; }`，把未读角标裁成一小截。

## Target

- 通用按钮规则只保留 transform、颜色、描边和阴影 transition，不再修改定位与溢出。
- `cockpitBindMotionInteractions()` 只在实际产生 ripple 时标记宿主：静态定位按钮增加 `ck-motion-relative`，所有 ripple 宿主增加 `ck-motion-ripple-host`。
- `.ck-motion-relative { position:relative; }`；`.ck-motion-ripple-host { overflow:hidden; }`。
- ripple 完成或取消后立即移除上述辅助 class，避免短暂反馈永久改变按钮的布局与裁切行为。
- 日历 RSS 按钮保持 `overflow:visible` 并禁用该按钮的 ripple，完整显示角标。
- 内容宽度手柄始终保持 `position:absolute; top:50%; right:-10px`。

## Repo conventions to follow

- 动效绑定集中在 `src/motion.js`。
- Motion V2 CSS 位于 `styles.css` 的统一动效区。
- 使用已有 `--ck-motion-fast` 与 `--ck-ease-out`。

## Steps

1. 修改 `src/motion.js` 的 pointerdown：读取按钮 computed position，仅在 `static` 时增加 `ck-motion-relative`，并增加 `ck-motion-ripple-host`。
2. 修改 `styles.css`，从通用按钮选择器移除 `position`/`overflow`，增加两个按需 class。
3. 保留 RSS 专用 `overflow:visible` 与 ripple 禁用规则。
4. 在 `tests/ui-construction-regression.test.js` 增加断言，防止通用按钮规则再次写入定位/裁切，并验证 RSS 例外。

## Boundaries

- 不改拖拽宽度的业务逻辑、持久化字段或日历 DOM。
- 不删除按钮按压反馈。
- 不新增依赖。

## Verification

- **Mechanical**: `node tests/motion.test.js`, `node tests/ui-construction-regression.test.js`, `npm test`, `git diff --check`。
- **Feel check**: 内容宽度手柄位于整个驾驶舱右边缘垂直居中；RSS `80` 圆角标完整显示在按钮右上角；普通按钮 ripple 仍被按钮自身裁切。
- **Done when**: 两个错位回归消失，且按钮反馈仍正常。
