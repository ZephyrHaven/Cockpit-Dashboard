# 002 — 用空间连续性连接触发器、浮层与页面状态

- **Status**: IMPLEMENTED on `codex/motion-v2`
- **Base commit**: 292b13d
- **Severity**: HIGH
- **Category**: Physicality, origin, interruptibility
- **Estimated scope**: 6 files, 250–450 lines

## Problem

`src/modal-motion.js:34-49` 为所有自建遮罩使用同一中心进出场，无法表达浮层来自哪个卡片或按钮：

```javascript
function cockpitAnimateOverlay(overlay) {
  overlay.classList.add(PLUGIN_ID + '-motion-overlay');
}
```

`src/scenes.js:27-63` 的情景菜单直接插入和移除，缺少触发器原点；设置页切换也只是 `hidden` 瞬时切换。

## Target

- `cockpitAnimateOverlay(overlay,{trigger,sharedElement})` 计算触发器中心并写入 `--ck-origin-x/y`，支持触发器到弹窗的共享元素 morph；没有触发器时保持中心模态。
- trigger-origin 进入 320–420ms `--ck-ease-out`，退出 180–220ms；可中断，关闭期间屏蔽 pointer。
- 场景菜单从 trigger 边缘展开，`transform-origin` 与触发器对齐，200ms 内完成。
- 设置页签、编辑器分段控件使用滑动 active indicator，移动用 `--ck-ease-in-out`，颜色用 `ease`。
- Workflow 卡片标题/编辑按钮到编辑器优先作为首个 shared-element 实例。

## Repo conventions to follow

- 模态基类仍是 `CockpitModal`，自建浮层仍通过 `cockpitAnimateOverlay`，不复制关闭逻辑。
- 所有 DOM 使用 `createEl/createDiv`，不使用 `innerHTML`。
- reduced motion 只保留透明度，不做 morph。

## Steps

1. 扩展 `src/modal-motion.js`：保存来源矩形、计算目标矩形、播放可取消的 FLIP/morph，关闭时逆向回来源（来源仍连接时）。
2. 修改 `src/workflows.js`，从新建按钮、标题、编辑按钮传入实际 trigger；编辑器表面标记 shared-element key。
3. 为 `src/scenes.js` 场景菜单接入 trigger-origin popover helper，并为 close 播放短退出。
4. 为 `src/serverchan.js` 设置 tab 创建单一滑动 indicator，键盘切换时不引入额外延迟。
5. 在 `styles.css` 添加共享元素、popover、indicator 状态，并限制 blur 小于 8px。
6. 添加测试验证 trigger 参数、ARIA 状态、reduced-motion 分支与关闭清理。

## Boundaries

- 不改变表单字段、保存逻辑和快捷键。
- 高频键盘动作不得等待动画完成。
- 不对所有模态强制共享元素；无明确来源的模态保持中心进出。

## Verification

- **Mechanical**: 全量测试、构建、语法与 diff 检查通过。
- **Feel check**: 从不同 workflow 卡片打开编辑器，弹窗应从对应来源自然放大；快速开关不会闪回；场景菜单从按钮附近出现；reduced motion 下只淡入淡出。
- **Done when**: 用户始终能从运动方向理解“新界面来自哪里、关闭后回到哪里”。
