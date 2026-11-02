// custom-components-core.js — 组件包与消息的纯数据契约，不执行导入代码。
const CUSTOM_COMPONENT_LIMITS = Object.freeze({ packageBytes:512*1024, totalBytes:5*1024*1024, installed:20, storageBytes:64*1024, messageBytes:128*1024, nodes:200 });
const CUSTOM_COMPONENT_CATEGORIES = ['basic','planning','focus','knowledge','insights','automation','team'];
const CUSTOM_COMPONENT_PERMISSIONS = ['todos.read','focus.read'];
function customComponentAssert(ok, message) { if (!ok) throw new Error(message); }
function customComponentJson(value, limit) {
  const text = JSON.stringify(value);
  customComponentAssert(typeof text === 'string' && new TextEncoder().encode(text).length <= limit, '组件数据超过大小限制 / Component data exceeds the size limit.');
  return JSON.parse(text);
}
function customComponentPath(value) {
  customComponentAssert(typeof value === 'string' && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:js|css)$/.test(value), '组件入口必须是包内相对路径 / Entry must be a relative path inside the package.');
  return value;
}
function validateCustomComponentPackage(raw) {
  customComponentAssert(raw && typeof raw === 'object' && !Array.isArray(raw), '组件包格式无效 / Invalid component package.');
  customComponentJson({manifest:raw.manifest,code:raw.code,styles:raw.styles}, CUSTOM_COMPONENT_LIMITS.packageBytes);
  const m = raw.manifest;
  customComponentAssert(m && typeof m === 'object' && !Array.isArray(m), '缺少 manifest / Missing manifest.');
  customComponentAssert(typeof m.id === 'string' && /^[a-z][a-z0-9-]{0,39}\.[a-z][a-z0-9-]{0,49}$/.test(m.id), '组件 ID 应为 author.component / ID must use author.component.');
  customComponentAssert(typeof m.name === 'string' && m.name.trim().length > 0 && m.name.length <= 60, '组件名称应为 1–60 字 / Name must contain 1–60 characters.');
  customComponentAssert(typeof m.version === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[a-zA-Z0-9.-]{1,30})?$/.test(m.version), '版本应为 1.0.0 格式 / Use a version such as 1.0.0.');
  customComponentAssert(m.apiVersion === 1, '不支持此组件接口版本 / Unsupported component API version.');
  customComponentAssert(CUSTOM_COMPONENT_CATEGORIES.includes(m.category), '组件分类无效 / Invalid component category.');
  customComponentAssert(Array.isArray(m.permissions) && m.permissions.every(p => CUSTOM_COMPONENT_PERMISSIONS.includes(p)), '包含未开放的权限 / The package requests unsupported permissions.');
  customComponentAssert(typeof raw.code === 'string' && raw.code.trim() && raw.code.length <= 300000, '缺少有效的组件代码 / Missing component code.');
  customComponentAssert(raw.styles === undefined || (typeof raw.styles === 'string' && raw.styles.length <= 50000), '组件样式过大 / Component stylesheet is too large.');
  const manifest = { id:m.id, name:m.name.trim(), description:typeof m.description === 'string' ? m.description.slice(0,300) : '', version:m.version, apiVersion:1,
    category:m.category, icon:typeof m.icon === 'string' && /^[a-z0-9-]{1,60}$/.test(m.icon) ? m.icon : 'layout-grid',
    entry:customComponentPath(m.entry), permissions:[...new Set(m.permissions)] };
  if (m.styles) manifest.styles = customComponentPath(m.styles);
  customComponentAssert(manifest.entry.endsWith('.js')&&(!manifest.styles||manifest.styles.endsWith('.css')), '入口应为 JS，样式应为 CSS / Entry must be JS and styles must be CSS.');
  return { manifest, code:raw.code, styles:raw.styles || '' };
}
async function readCustomComponentFiles(files) {
  const list = Array.from(files || []);
  customComponentAssert(list.length && list.length <= 30 && list.reduce((n,f) => n+f.size,0) <= CUSTOM_COMPONENT_LIMITS.packageBytes, '请选择不超过 512 KB 的组件包 / Choose a component package up to 512 KB.');
  if (list.length === 1 && !list[0].webkitRelativePath) return validateCustomComponentPackage(JSON.parse(await list[0].text()));
  const paths = list.map(f => f.webkitRelativePath || f.name);
  const prefix = paths.every(p => p.includes('/')) ? paths[0].split('/')[0]+'/' : '';
  const byPath = new Map();
  list.forEach((f,i) => { const path = prefix && paths[i].startsWith(prefix) ? paths[i].slice(prefix.length) : paths[i]; customComponentAssert(!byPath.has(path), '组件包中存在重复文件 / Duplicate package file.'); byPath.set(path,f); });
  customComponentAssert(byPath.has('manifest.json'), '文件夹中缺少 manifest.json / The folder needs manifest.json.');
  const manifest = JSON.parse(await byPath.get('manifest.json').text());
  const entry = customComponentPath(manifest.entry); const css = manifest.styles ? customComponentPath(manifest.styles) : null;
  customComponentAssert(byPath.has(entry) && (!css || byPath.has(css)), '找不到组件入口或样式文件 / Entry or stylesheet is missing.');
  return validateCustomComponentPackage({manifest, code:await byPath.get(entry).text(), styles:css ? await byPath.get(css).text() : ''});
}
function customComponentModuleId(id) { return 'custom:'+id; }
function customComponentRegistry(view) {
  return (view._plugin?.customComponents?.entries() || []).map(entry => ({ id:customComponentModuleId(entry.manifest.id), label:entry.manifest.name, collapsible:true, custom:entry,
    matches:el => el.dataset.customComponent === entry.manifest.id }));
}
function customComponentSceneDefaults(view, layout) {
  for (const entry of view._plugin?.customComponents?.entries() || []) {
    const id = customComponentModuleId(entry.manifest.id);
    if (!Array.isArray(layout?.moduleOrder) || !layout.moduleOrder.includes(id)) view._hiddenModules.add(id);
  }
}
function normalizeCustomComponentTree(raw) {
  customComponentJson(raw, CUSTOM_COMPONENT_LIMITS.messageBytes);
  let count = 0; const keys = new Set();
  const tags = ['div','span','p','strong','em','h3','label','button','input','textarea','select','option','progress','ul','li'];
  const visit = (node, depth, path) => {
    customComponentAssert(node && typeof node === 'object' && !Array.isArray(node) && depth <= 12 && ++count <= CUSTOM_COMPONENT_LIMITS.nodes && tags.includes(node.tag), '组件界面结构无效 / Invalid component UI tree.');
    const key = typeof node.key === 'string' ? node.key.slice(0,80) : path;
    customComponentAssert(!keys.has(key), '组件界面 key 重复 / Duplicate UI key.'); keys.add(key);
    const next = {tag:node.tag,key};
    for (const field of ['text','placeholder','label','value']) if (typeof node[field] === 'string') next[field]=node[field].slice(0,4000);
    if (typeof node.class === 'string' && /^[a-zA-Z0-9 _-]{0,200}$/.test(node.class)) next.class=node.class;
    for (const field of ['action','change']) if (typeof node[field] === 'string' && /^[a-zA-Z0-9._-]{1,60}$/.test(node[field])) next[field]=node[field];
    for (const field of ['disabled','checked']) if (typeof node[field] === 'boolean') next[field]=node[field];
    if (node.tag === 'input') next.type=['text','number','checkbox'].includes(node.type) ? node.type : 'text';
    if (node.tag === 'progress') next.value=Math.max(0,Math.min(100,Number(node.value)||0));
    if (Array.isArray(node.children)) next.children=node.children.map((child,i)=>visit(child,depth+1,path+'.'+i));
    customComponentAssert(!(next.children?.length && next.text), '文字与子节点请分别声明 / Put text and child nodes in separate elements.');
    return next;
  };
  return visit(raw,0,'root');
}
if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { CUSTOM_COMPONENT_LIMITS,customComponentAssert,validateCustomComponentPackage,readCustomComponentFiles,customComponentJson,customComponentModuleId,customComponentRegistry,customComponentSceneDefaults,normalizeCustomComponentTree };
