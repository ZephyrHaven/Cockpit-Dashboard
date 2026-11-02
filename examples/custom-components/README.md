# 自定义组件示例

在组件商店选择「导入组件 → 选择 JSON 组件包」，导入 `reading-progress.cockpit-component.json`；或选择整个 `reading-progress/` 文件夹。确认安装后，点击商店「应用布局」开始使用。

阅读进度示例不申请待办或专注权限，只保存自己的阅读数量。点击「读完一章」，重新打开组件后进度仍在。可修改 main.js、样式和清单后重新导入同一 ID 更新；已保存进度保留。

完整接口与限制见 [组件开发规范](../../docs/component-authoring-spec.md)。示例单文件包与文件夹内容应保持一致；源码中的 `cockpitCustomExamplePackage()` 同时用于商店下载模板。
