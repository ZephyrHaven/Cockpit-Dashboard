# 001 — 建立 Motion V2 动效系统与总开关

- **Status**: IMPLEMENTED on `codex/motion-v2`
- **Base commit**: 292b13d
- **Severity**: HIGH
- **Category**: Cohesion, accessibility, performance
- **Estimated scope**: 5 files, 250–400 lines

## Problem

现有动效散落在 `src/motion.js`、`src/modal-motion.js` 与 `styles.css`，只有系统级减少动态判断，没有产品级总开关，也没有统一的生命周期、语义、时长和曲线。`src/motion.js:20-33` 直接写入不同曲线和时长：

```javascript
const easing = 'cubic-bezier(.22,1,.36,1)';
contentEl.animate([...], { duration:240, easing });
contentEl.animate([...], { duration:300, easing });
```

`src/motion.js:51-59` 的数字动画最长 900ms，超出高频仪表盘 UI 的 300ms 预算，并用独立 rAF 循环实现：

```javascript
const duration = Math.min(900, 380 + Math.abs(target - from) * 12);
```

## Target

- 新增持久化布尔配置 `motionV2Enabled`，默认开启；设置页新增“外观与动效”页签和总开关。
- 统一 JS/CSS token：`--ck-motion-fast:140ms`、`--ck-motion-ui:220ms`、`--ck-motion-layout:320ms`、`--ck-motion-dialog:420ms`、`--ck-ease-out:cubic-bezier(.23,1,.32,1)`、`--ck-ease-in-out:cubic-bezier(.77,0,.175,1)`、`--ck-ease-drawer:cubic-bezier(.32,.72,0,1)`。
- `cockpitMotionAllowed(viewOrPlugin)` 同时检查产品总开关、`document.hidden`、系统 `prefers-reduced-motion`。
- reduced motion 保留 160–200ms 的透明度/颜色反馈，移除位移、缩放和路径运动。
- 页面卸载、标签隐藏时取消 frame/animation；任何动态动画可以被新状态中断。
- 根元素同步 `data-motion="full|reduced|off"`，CSS 只依赖该状态，不散落读取配置。

## Repo conventions to follow

- 配置写入必须走 `plugin.mutateData()`，参考 `src/serverchan.js:485-535`。
- 动效工具集中在 `src/motion.js`；CSS token 追加到 `styles.css` 的“轻盈玻璃设计层”。
- 根视图初始化和入口绑定位于 `src/_framework.js:911-945`。

## Steps

1. 在 `src/motion.js` 建立 Motion V2 状态、token 常量、可见性生命周期、根状态同步、全局动画取消和 reduced-motion 监听。
2. 把折叠、数字、入口和鼠标高光迁移到统一开关；数字动画压到 300ms 内，并在不可见时直接落最终值。
3. 在 `src/serverchan.js` 的设置分区增加 `appearance`，渲染总开关、系统减少动态状态说明和“恢复推荐设置”。
4. 在 `src/_framework.js` 加载根节点时同步 Motion V2 配置；设置变更时即时更新所有已打开视图，不整页重建。
5. 在 `styles.css` 定义 token、off/reduced 覆盖和键盘焦点不移动规则。
6. 在 `tests/motion.test.js` 和设置回归测试中验证默认值、开关、系统偏好、隐藏页面和持久化路径。

## Boundaries

- 不改变业务数据结构，仅增加向后兼容的可选配置字段。
- 不把开关塞进通知配置对象。
- 不使用无限循环装饰动画。

## Verification

- **Mechanical**: `npm test`, `node build.js`, `node --check dist/main.js`, `git diff --check` 全通过。
- **Feel check**: 打开/关闭总开关后无需重载即可生效；系统减少动态时无位移/缩放；快速重复折叠不从零重播；切后台后没有继续运行的 frame。
- **Done when**: 所有新动效都能由一个持久化开关关闭，并统一服从系统偏好。
