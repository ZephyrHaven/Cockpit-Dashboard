# 007 — 统一二级页面与浮层的进入退出语言

- **Status**: IMPLEMENTED
- **Base commit**: 292b13d
- **Severity**: HIGH
- **Category**: Cohesion, easing, physicality
- **Estimated scope**: 4 files, 100–180 lines

## Problem

二级页面目前至少存在三套互不一致的动效：`styles.css:6183-6203` 的 500ms 模态＋子内容延迟，`src/modal-motion.js:53-56` 的 560ms 触发点 morph 和过冲，以及 `src/motion.js:241-260` 的 340ms popover。它们使用不同位移、模糊、缩放与曲线，且面板子内容再次播放动画，产生闪现和双曝光。

## Target

- 建立三种统一层级：
  - 小型 popover：进入 180ms、退出 140ms；`scale(.96)`＋`translateY(-6px)`＋`opacity:0`，`var(--ck-ease-out)`。
  - 二级 modal/overlay：进入 320ms、退出 180ms；`scale(.97)`＋`translateY(10px)`＋`opacity:0`＋`blur(4px)`，`var(--ck-ease-out)`。
  - 页面/情景切换保留 320ms `var(--ck-ease-in-out)`，不套用 modal 弹性。
- 去掉 `.modal > *` 和 overlay panel children 的第二层进场动画，面板只动画一次。
- 有 trigger 的 overlay 只改变 transform-origin；帧、时长、曲线与普通 overlay 相同，不再 560ms 过冲。
- 退出前读取当前计算样式并取消仍在运行的进入动画，从当前帧连续收束，避免快速关闭时闪回完整可见状态。
- 所有退出使用同一方向的反向收束，不使用 `ease-in`。
- reduced motion 保留 180ms opacity，去掉位移、缩放和 blur。

## Repo conventions to follow

- token 使用 `--ck-motion-fast:140ms`、`--ck-motion-ui:220ms`、`--ck-motion-layout:320ms`、`--ck-ease-out:cubic-bezier(.23,1,.32,1)`、`--ck-ease-in-out:cubic-bezier(.77,0,.175,1)`。
- `CockpitModal` 与 `cockpitAnimateOverlay()` 是唯一二级浮层入口。
- 触发点坐标仍由 `cockpitAnimateOverlay(...,{trigger})` 计算。

## Steps

1. 在 `src/motion.js` 的 token 增加明确的 `popover:180`、`exit:180`、`dialog:320` 语义并统一 popover 帧。
2. 在 `src/modal-motion.js` 把 shared-origin WAAPI 改为与 CSS modal 相同的 320/180ms 帧，不再加入中段过冲。
3. 在 `styles.css` 重写 dialog/overlay keyframes，删除对子内容的独立 animation。
4. reduced motion 改为 180ms 淡入淡出，不做几何运动。
5. 更新 motion/UI regression tests，钉住时长、曲线和“单层动画”规则。

## Boundaries

- 不改变浮层 DOM、表单、保存/取消逻辑。
- 不统一首屏 rare entrance 与流程执行状态动画；它们用途不同。
- 不新增 GSAP 或其他依赖。

## Verification

- **Mechanical**: `node tests/motion.test.js`, `node tests/ui-construction-regression.test.js`, `npm test`, `node build.js`, `node --check dist/main.js`。
- **Feel check**: 依次打开待办编辑器、闹钟编辑器、组件商店、设置、场景菜单，二级页面应具有相同的加速感和收束方向；面板与内容不再分两次闪现；快速关闭不会闪回。
- **Done when**: 同层级浮层的进入/退出可被感知为同一套产品语言。
