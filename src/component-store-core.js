// component-store-core.js — 组件商店的纯布局草稿操作；不依赖宿主 API 或 DOM。

const COMPONENT_LAYOUT_ARRAY_FIELDS = ['moduleOrder','hiddenModules','toolbarOrder','hiddenToolbarActions','statsCardOrder','hiddenStatsCards'];

function migrateCockpitModuleLayout(layout = {}) {
  const retired = new Set(['agenda','footer','teamStats','runHistory','syncHealth']);
  const order = Array.isArray(layout.moduleOrder) ? layout.moduleOrder : [];
  const hidden = new Set(Array.isArray(layout.hiddenModules) ? layout.hiddenModules : []);
  const reviewVisible = order.includes('weeklyReview') && !hidden.has('weeklyReview');
  const studioVisible = order.includes('reportStudio') && !hidden.has('reportStudio');
  const convert = (list) => uniqueComponentIds(list.map((id) => id === 'weeklyReview' ? 'reportStudio' : id).filter((id) => !retired.has(id)));
  const next = { ...layout, moduleOrder:convert(order), hiddenModules:convert(Array.from(hidden)), moduleLabels:{ ...(layout.moduleLabels || {}) } };
  if (reviewVisible || studioVisible) next.hiddenModules = next.hiddenModules.filter((id) => id !== 'reportStudio');
  [...retired, 'weeklyReview'].forEach((id) => { delete next.moduleLabels[id]; });
  return next;
}

function migrateCockpitDashboardComponents(data) {
  const next = { ...data, ...migrateCockpitModuleLayout(data), dashboardComponentsRevision:1 };
  if (!Array.isArray(data.moduleOrder)) delete next.moduleOrder;
  if (!Array.isArray(data.hiddenModules)) delete next.hiddenModules;
  if (data.sceneLayouts && typeof data.sceneLayouts === 'object' && !Array.isArray(data.sceneLayouts)) next.sceneLayouts = Object.fromEntries(Object.entries(data.sceneLayouts).map(([id, scene]) => [id, { ...scene, layout:migrateCockpitModuleLayout(scene?.layout) }]));
  next.collapsed = { ...(data.collapsed || {}) };
  if (next.collapsed.reportStudio == null && next.collapsed.weeklyReview != null) next.collapsed.reportStudio = next.collapsed.weeklyReview;
  ['weeklyReview','agenda','footer','teamStats','runHistory','syncHealth'].forEach((id) => { delete next.collapsed[id]; });
  if (Array.isArray(data.optionalModulesSeen)) next.optionalModulesSeen = uniqueComponentIds(data.optionalModulesSeen.map((id) => id === 'weeklyReview' ? 'reportStudio' : id).filter((id) => !['agenda','footer','teamStats','runHistory','syncHealth'].includes(id)));
  return next;
}

function cloneComponentLayoutSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const clone = { ...source };
  COMPONENT_LAYOUT_ARRAY_FIELDS.forEach((field) => { clone[field] = Array.isArray(source[field]) ? source[field].slice() : []; });
  clone.moduleLabels = source.moduleLabels && typeof source.moduleLabels === 'object' && !Array.isArray(source.moduleLabels) ? { ...source.moduleLabels } : {};
  return clone;
}

function uniqueComponentIds(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((id) => typeof id === 'string' && id && !seen.has(id) && (seen.add(id), true));
}

function setComponentVisibility(snapshot, moduleId, visible) {
  const next = cloneComponentLayoutSnapshot(snapshot);
  if (!next.moduleOrder.includes(moduleId)) next.moduleOrder.push(moduleId);
  const hidden = new Set(next.hiddenModules);
  if (visible) hidden.delete(moduleId); else hidden.add(moduleId);
  next.hiddenModules = uniqueComponentIds(Array.from(hidden));
  return next;
}

function moveIdBefore(order, itemId, beforeId) {
  const next = uniqueComponentIds(order);
  const from = next.indexOf(itemId);
  if (from < 0 || itemId === beforeId) return next;
  next.splice(from, 1);
  const target = beforeId ? next.indexOf(beforeId) : -1;
  if (target < 0) next.push(itemId); else next.splice(target, 0, itemId);
  return next;
}

function moveComponentBefore(snapshot, moduleId, beforeId) {
  const next = cloneComponentLayoutSnapshot(snapshot);
  next.moduleOrder = moveIdBefore(next.moduleOrder, moduleId, beforeId);
  return next;
}

function moveComponentAtDrop(snapshot, moduleId, targetId, placeAfter) {
  const next = cloneComponentLayoutSnapshot(snapshot);
  const order = uniqueComponentIds(next.moduleOrder);
  if (moduleId === targetId || !order.includes(moduleId)) return next;
  order.splice(order.indexOf(moduleId), 1);
  const targetIndex = order.indexOf(targetId);
  if (targetIndex < 0) order.push(moduleId);
  else order.splice(targetIndex + (placeAfter ? 1 : 0), 0, moduleId);
  next.moduleOrder = order;
  return next;
}

function setNestedItemVisibility(snapshot, hiddenField, itemId, visible) {
  const next = cloneComponentLayoutSnapshot(snapshot);
  const allowed = hiddenField === 'hiddenStatsCards' ? 'hiddenStatsCards' : 'hiddenToolbarActions';
  const hidden = new Set(next[allowed]);
  if (visible) hidden.delete(itemId); else hidden.add(itemId);
  next[allowed] = uniqueComponentIds(Array.from(hidden));
  return next;
}

function moveNestedItemBefore(snapshot, orderField, itemId, beforeId) {
  const next = cloneComponentLayoutSnapshot(snapshot);
  const allowed = orderField === 'statsCardOrder' ? 'statsCardOrder' : 'toolbarOrder';
  next[allowed] = moveIdBefore(next[allowed], itemId, beforeId);
  return next;
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { migrateCockpitModuleLayout, migrateCockpitDashboardComponents, cloneComponentLayoutSnapshot, setComponentVisibility, moveComponentBefore, moveComponentAtDrop, setNestedItemVisibility, moveNestedItemBefore };
}
