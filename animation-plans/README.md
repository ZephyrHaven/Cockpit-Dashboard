# Cockpit Motion V2 实施顺序

| 编号 | 标题 | 严重度 | 状态 |
|---|---|---|---|
| 001 | Motion V2 动效系统与总开关 | HIGH | IMPLEMENTED |
| 002 | 触发器、浮层与页面的空间连续性 | HIGH | IMPLEMENTED |
| 003 | 布局、列表和情景切换 FLIP 编排 | HIGH | IMPLEMENTED |
| 004 | 自动化执行能量路径 | HIGH | IMPLEMENTED |
| 005 | 修复全局按钮动效对定位与角标的破坏 | HIGH | IMPLEMENTED |
| 006 | 组件商店改为暂存选择、统一应用 | HIGH | IMPLEMENTED |
| 007 | 统一二级页面与浮层的进入退出语言 | HIGH | IMPLEMENTED |

001–007 已全部实现；后续改动仍必须单独通过 reduced-motion、快速反复操作和页面隐藏测试。

明确不纳入：全屏粒子背景、持续神经网络 Canvas、普遍 3D 倾斜、滚动驱动营销动画、对每次键盘操作做长转场。这些效果会稀释仪表盘的信息密度和响应感。
