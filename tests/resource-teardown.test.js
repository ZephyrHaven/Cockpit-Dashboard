#!/usr/bin/env node
// resource-teardown.test.js — 回归守卫：视图/服务挂到长生命周期对象（window/document/ResizeObserver 等）
// 上的资源必须在卸载路径上成对释放。很多监听器挂在自己的短命 DOM 元素上，随元素回收即可，
// 本测试只覆盖一类高风险情形：视图自己持有、且不随 DOM 回收的观察器/全局监听。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const framework = read('_framework.js');

// 1) 视图创建的每个 ResizeObserver 都必须有 disconnect 调用（否则随视图重建累积强引用）。
const observerCreates = (framework.match(/new ResizeObserver/g) || []).length;
const observerDisconnects = (framework.match(/\.disconnect\(\)/g) || []).length;
assert.ok(observerCreates >= 1, 'The view creates at least one ResizeObserver for responsive width.');
assert.ok(
  observerDisconnects >= observerCreates,
  'Every ResizeObserver the view creates is disconnected on teardown (created ' +
    observerCreates + ', disconnected ' + observerDisconnects + ').'
);

// 2) 视图级的 window resize / visualViewport resize 监听必须成对移除。
assert.match(framework, /window\.addEventListener\('resize'[\s\S]*window\.removeEventListener\('resize'/, 'Viewport resize listener is added and removed.');
assert.match(framework, /visualViewport\?\.addEventListener\('resize'[\s\S]*visualViewport\?\.removeEventListener\('resize'/, 'visualViewport resize listener is added and removed.');

// 3) silent-refresh 的交互传感器必须在 unbind 中成对移除并置空。
const silent = read('silent-refresh.js');
assert.match(silent, /function cockpitBindSilentRefreshSensors[\s\S]*cockpitUnbindSilentRefreshSensors\(view\)/, 'Binding interaction sensors first clears any previous binding (idempotent).');
assert.match(silent, /removeEventListener\(eventName, view\._interactionHandler, true\)[\s\S]*view\._interactionHandler = null/, 'Interaction sensor handlers are removed and dereferenced on unbind.');

// 4) 卸载路径不得调用 detachLeavesOfType（宿主硬规定）。
const unloadStart = framework.indexOf('async onunload()');
assert.ok(unloadStart > 0, 'Plugin exposes an onunload.');
const unloadBody = framework.slice(unloadStart, unloadStart + 2500);
assert.doesNotMatch(unloadBody, /detachLeavesOfType/, 'onunload never detaches leaves; the host restores view placement.');

// 5) 全局浮层（番茄钟）必须在卸载时通过幂等销毁钩子清理。
assert.match(unloadBody, /_cockpitDestroy/, 'Global floating layers are destroyed on unload.');

console.log('Resource teardown checks passed');
