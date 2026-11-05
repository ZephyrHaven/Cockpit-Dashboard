// 插件内下拉框统一使用自绘选项菜单。
// 原生 <select> 的弹出层在 Obsidian（Electron/macOS）里，叠在毛玻璃遮罩、嵌套弹窗之上时
// 会一打开就被关闭，表现为“点击下拉一直闪烁、选不了”。这里在 mousedown 捕获阶段拦截
// 插件范围内的单选下拉框，改为渲染到 body 顶层的 DOM 菜单；选中后写回 select.value 并派发
// input/change，调用方原有的 onchange 逻辑无需改动。键盘操作仍走原生行为。

const COCKPIT_SELECT_MENU_CLASS = PLUGIN_ID + '-select-menu';

function cockpitSelectInPluginScope(select) {
  let node = select;
  while (node && node.nodeType === 1) {
    if (node.dataset && node.dataset.cockpitNativeSelect === 'true') return false;
    const cls = typeof node.className === 'string' ? node.className : '';
    if (cls.indexOf(PLUGIN_ID) !== -1 || cls.indexOf('cockpit-') !== -1) return true;
    node = node.parentElement;
  }
  return false;
}

function cockpitSelectEligible(select) {
  if (!select || String(select.tagName || '').toUpperCase() !== 'SELECT') return false;
  if (select.multiple || Number(select.size || 0) > 1 || select.disabled) return false;
  return cockpitSelectInPluginScope(select);
}

// 纯数据：把 select 的 option / optgroup 展开成菜单条目，便于测试。
function cockpitSelectMenuItems(select) {
  const items = [];
  const pushOption = (option, group) => {
    items.push({
      type:'option',
      value:String(option.value),
      label:String(option.label || option.textContent || option.value || ''),
      disabled:!!(option.disabled || group?.disabled),
      selected:String(option.value) === String(select.value) && option.selected !== false,
      hidden:!!option.hidden
    });
  };
  Array.from(select.children || []).forEach((child) => {
    const tag = String(child.tagName || '').toUpperCase();
    if (tag === 'OPTGROUP') {
      items.push({ type:'group', label:String(child.label || '') });
      Array.from(child.children || []).forEach((option) => pushOption(option, child));
    } else if (tag === 'OPTION') pushOption(child, null);
  });
  return items.filter((item) => !item.hidden);
}

function cockpitCloseSelectMenu(options = {}) {
  const state = globalThis.__cockpitSelectMenu;
  if (!state) return;
  globalThis.__cockpitSelectMenu = null;
  state.cleanup.forEach((fn) => { try { fn(); } catch (e) {} });
  state.menu.remove();
  if (options.refocus !== false && state.select?.isConnected) {
    try { state.select.focus({ preventScroll:true }); } catch (e) {}
  }
}

function cockpitCommitSelectValue(select, value) {
  if (String(select.value) === String(value)) return false;
  select.value = value;
  select.dispatchEvent(new Event('input', { bubbles:true }));
  select.dispatchEvent(new Event('change', { bubbles:true }));
  return true;
}

function cockpitOpenSelectMenu(select) {
  cockpitCloseSelectMenu({ refocus:false });
  const doc = select.ownerDocument || document;
  const win = doc.defaultView || window;
  const menu = doc.createElement('div');
  menu.className = COCKPIT_SELECT_MENU_CLASS;
  menu.setAttribute('role', 'listbox');
  menu.tabIndex = -1;
  const buttons = [];
  cockpitSelectMenuItems(select).forEach((item) => {
    if (item.type === 'group') {
      const head = doc.createElement('div');
      head.className = COCKPIT_SELECT_MENU_CLASS + '-group';
      head.textContent = item.label;
      menu.appendChild(head);
      return;
    }
    const btn = doc.createElement('div');
    btn.className = COCKPIT_SELECT_MENU_CLASS + '-item' + (item.selected ? ' is-selected' : '') + (item.disabled ? ' is-disabled' : '');
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', item.selected ? 'true' : 'false');
    btn.textContent = item.label || '\u00a0';
    if (!item.disabled) {
      buttons.push({ el:btn, value:item.value });
      btn.addEventListener('mousedown', (event) => event.preventDefault());
      btn.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation();
        cockpitCloseSelectMenu();
        cockpitCommitSelectValue(select, item.value);
      });
    }
    menu.appendChild(btn);
  });
  if (!buttons.length) return null;

  // 主题变量跟随 select 所在的容器（毛玻璃 / 明暗主题）。
  const style = win.getComputedStyle ? win.getComputedStyle(select) : null;
  if (style) menu.style.fontSize = style.fontSize;
  doc.body.appendChild(menu);

  const place = () => {
    const rect = select.getBoundingClientRect();
    const vw = win.innerWidth; const vh = win.innerHeight;
    const width = Math.min(Math.max(rect.width, 160), vw - 16);
    menu.style.minWidth = width + 'px';
    menu.style.maxWidth = Math.max(width, Math.min(420, vw - 16)) + 'px';
    const below = vh - rect.bottom - 8; const above = rect.top - 8;
    const natural = Math.min(menu.scrollHeight, 320);
    const openUp = below < Math.min(natural, 180) && above > below;
    const maxH = Math.max(120, Math.min(320, openUp ? above - 4 : below - 4));
    menu.style.maxHeight = maxH + 'px';
    const h = Math.min(natural, maxH);
    const left = Math.max(8, Math.min(rect.left, vw - menu.offsetWidth - 8));
    menu.style.left = left + 'px';
    menu.style.top = (openUp ? Math.max(8, rect.top - h - 4) : rect.bottom + 4) + 'px';
  };
  place();

  let active = Math.max(0, buttons.findIndex((b) => b.el.classList.contains('is-selected')));
  const highlight = (index) => {
    buttons.forEach((b, i) => b.el.classList.toggle('is-active', i === index));
    active = index;
    buttons[index]?.el.scrollIntoView?.({ block:'nearest' });
  };
  highlight(active);

  const onOutside = (event) => {
    if (menu.contains(event.target)) return;
    if (event.target === select) return; // 由 select 的 mousedown 处理器负责切换
    cockpitCloseSelectMenu({ refocus:false });
  };
  const onKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cockpitCloseSelectMenu(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); highlight(Math.min(buttons.length - 1, active + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); highlight(Math.max(0, active - 1)); }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation();
      const chosen = buttons[active]; cockpitCloseSelectMenu();
      if (chosen) cockpitCommitSelectValue(select, chosen.value);
    } else if (event.key === 'Tab') cockpitCloseSelectMenu({ refocus:false });
  };
  const onScroll = (event) => { if (!menu.contains(event.target)) cockpitCloseSelectMenu({ refocus:false }); };
  const onResize = () => cockpitCloseSelectMenu({ refocus:false });
  const onBlur = () => cockpitCloseSelectMenu({ refocus:false });
  doc.addEventListener('pointerdown', onOutside, true);
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('scroll', onScroll, true);
  win.addEventListener('resize', onResize);
  win.addEventListener('blur', onBlur);
  // select 被移出 DOM（所在弹窗关闭）时一并关闭菜单。
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => { if (!select.isConnected) cockpitCloseSelectMenu({ refocus:false }); }) : null;
  observer?.observe(doc.body, { childList:true, subtree:true });
  globalThis.__cockpitSelectMenu = {
    select, menu,
    cleanup:[
      () => doc.removeEventListener('pointerdown', onOutside, true),
      () => doc.removeEventListener('keydown', onKey, true),
      () => doc.removeEventListener('scroll', onScroll, true),
      () => win.removeEventListener('resize', onResize),
      () => win.removeEventListener('blur', onBlur),
      () => observer?.disconnect()
    ]
  };
  return menu;
}

function cockpitHandleSelectMouseDown(event) {
  if (event.button !== 0 || event.defaultPrevented) return;
  const select = event.target?.closest?.('select');
  if (!cockpitSelectEligible(select)) return;
  event.preventDefault();
  const open = globalThis.__cockpitSelectMenu;
  if (open && open.select === select) { cockpitCloseSelectMenu(); return; }
  try { select.focus({ preventScroll:true }); } catch (e) {}
  cockpitOpenSelectMenu(select);
}

function cockpitInstallSelectPopover(plugin) {
  if (typeof document === 'undefined') return;
  if (plugin?.registerDomEvent) plugin.registerDomEvent(document, 'mousedown', cockpitHandleSelectMouseDown, true);
  else document.addEventListener('mousedown', cockpitHandleSelectMouseDown, true);
  plugin?.register?.(() => cockpitCloseSelectMenu({ refocus:false }));
}
