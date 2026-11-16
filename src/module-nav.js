// Dock 导航跟随仪表盘的滚动面板，在首屏以外提供模块跳转。

function cockpitNormalizeModuleNavPosition(value) {
  return value === 'left' || value === 'bottom' ? value : 'top';
}

function cockpitDestroyModuleNav(view) {
  view._moduleNavCleanup?.();
  view._moduleNavCleanup = null;
  view._syncModuleNav = null;
  view._jumpToModule = null;
}

function cockpitRefreshModuleNavEnabled(plugin, enabled) {
  plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(({ view }) => {
    if (!view) return;
    view._moduleNavEnabled = enabled;
    view.containerEl?.querySelectorAll('.' + PLUGIN_ID + '-root').forEach((root) => {
      root.dataset.moduleNavEnabled = enabled ? 'on' : 'off';
    });
    view._syncModuleNav?.();
  });
}

// 设置页切换位置后，已打开的仪表盘即时换挡，无需整页重渲染。
function cockpitRefreshModuleNavPosition(plugin, position) {
  const normalized = cockpitNormalizeModuleNavPosition(position);
  plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
    const view = leaf.view;
    if (!view) return;
    view._moduleNavPosition = normalized;
    view.containerEl?.querySelectorAll('.' + PLUGIN_ID + '-root').forEach((root) => {
      root.dataset.moduleNavPosition = normalized;
    });
    if (typeof view._syncModuleNav === 'function') view._syncModuleNav();
  });
}

function cockpitRefreshModuleNavAutoHide(plugin, enabled) {
  plugin.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
    const view = leaf.view;
    if (!view) return;
    view._moduleNavAutoHide = enabled !== false;
    view.containerEl?.querySelectorAll('.' + PLUGIN_ID + '-root').forEach((root) => {
      root.dataset.moduleNavAutoHide = enabled !== false ? 'on' : 'off';
    });
    if (typeof view._syncModuleNav === 'function') view._syncModuleNav();
  });
}

function cockpitBuildModuleNav(view, root) {
  cockpitDestroyModuleNav(view);
  if (!root) return;
  root.dataset.moduleNavEnabled = view._moduleNavEnabled === false ? 'off' : 'on';
  root.dataset.moduleNavPosition = cockpitNormalizeModuleNavPosition(view._moduleNavPosition);
  root.dataset.moduleNavAutoHide = view._moduleNavAutoHide === false ? 'off' : 'on';

  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const page = doc.scrollingElement || doc.documentElement;
  let scrollport = root.parentElement;
  while (scrollport && scrollport !== doc.body) {
    if (/^(auto|scroll|overlay)$/.test(win.getComputedStyle(scrollport).overflowY)) break;
    scrollport = scrollport.parentElement;
  }
  if (!scrollport || scrollport === doc.body) scrollport = page;

  const en = view._lang() === 'en';
  const cls = PLUGIN_ID + '-module-nav';
  const anchor = doc.createElement('div');
  anchor.className = cls + '-anchor';
  const nav = anchor.createDiv({ cls, attr:{ role:'navigation', 'aria-label':en ? 'Dashboard sections' : '驾驶舱模块导航' } });
  nav.inert = true;
  const reducedMotion = () => root.dataset.motion === 'reduced' || cockpitPrefersReducedMotion();
  const scrollBehavior = () => reducedMotion() ? 'instant' : 'smooth';
  const moduleSelector = '.' + PLUGIN_ID + '-module';
  const findModule = (moduleId) => root.querySelector(':scope > ' + moduleSelector + '[data-module-id="' + moduleId + '"]');
  let jumpTarget = null;
  let jumpOffset = 0;

  const focusSection = (section) => {
    if (!section.hasAttribute('tabindex')) {
      section.setAttribute('tabindex', '-1');
      section.addEventListener('blur', () => section.removeAttribute('tabindex'), { once:true });
    }
    section.focus({ preventScroll:true });
  };

  const jump = (moduleId, focus = false) => {
    const wrapper = findModule(moduleId);
    if (!wrapper || view._isModuleHidden(moduleId)) return;
    jumpTarget = wrapper;
    jumpOffset = Math.max(0, Math.min(
      scrollport.scrollHeight - scrollport.clientHeight,
      scrollport.scrollTop + wrapper.getBoundingClientRect().top - viewportTop() - jumpInset()
    ));
    scrollport.scrollTo({ top:jumpOffset, behavior:scrollBehavior() });
    if (focus) focusSection(wrapper);
    schedule();
  };
  view._jumpToModule = jump;

  const addButton = (parent, label, iconName, action) => {
    const button = parent.createEl('button', { cls:cls + '-item', attr:{ type:'button', 'aria-label':label } });
    obs.setIcon(button.createSpan({ cls:cls + '-icon', attr:{ 'aria-hidden':'true' } }), iconName);
    button.onclick = action;
    return button;
  };
  addButton(nav, en ? 'Back to top' : '回到顶部', 'arrow-up', (event) => {
    jumpTarget = null;
    scrollport.scrollTo({ top:0, behavior:scrollBehavior() });
    if (event.detail === 0) focusSection(root);
  });
  const addDivider = () => nav.createDiv({ cls:cls + '-divider', attr:{ 'aria-hidden':'true' } });
  addDivider();
  const list = nav.createDiv({ cls:cls + '-list' });
  addDivider();
  addButton(nav, en ? 'Search & commands' : '搜索与命令', 'search', () => openGlobalSearch(view.app, view._lang(), view));
  const tooltip = nav.createDiv({ cls:cls + '-tooltip', attr:{ 'aria-hidden':'true' } });
  tooltip.hidden = true;
  root.insertBefore(anchor, root.firstChild);

  const viewportTop = () => scrollport === page ? 0 : scrollport.getBoundingClientRect().top + scrollport.clientTop;
  const position = () => root.dataset.moduleNavPosition;
  const enabled = () => root.dataset.moduleNavEnabled === 'on';
  const jumpInset = () => enabled() && position() === 'top' ? nav.offsetHeight + 16 : 12;
  let frame = 0;
  let viewportHeight = 0;
  let visible = false;
  let activeButton = null;
  let pointedButton = null;
  let entries = [];

  const showLabel = () => {
    const button = pointedButton || nav.querySelector('button:focus-visible');
    if (!visible || !button) {
      tooltip.hidden = true;
      return;
    }
    const buttonRect = button.getBoundingClientRect();
    if (list.contains(button)) {
      const bounds = list.getBoundingClientRect();
      if (buttonRect.left < bounds.left || buttonRect.right > bounds.right ||
          buttonRect.top < bounds.top || buttonRect.bottom > bounds.bottom) {
        tooltip.hidden = true;
        return;
      }
    }
    const bounds = nav.getBoundingClientRect();
    const label = button.getAttribute('aria-label');
    if (tooltip.textContent !== label) tooltip.textContent = label;
    tooltip.hidden = false;
    if (position() === 'left') {
      tooltip.style.left = '';
      tooltip.style.top = (buttonRect.top - bounds.top + (buttonRect.height - tooltip.offsetHeight) / 2) + 'px';
    } else {
      const center = buttonRect.left - bounds.left + buttonRect.width / 2;
      tooltip.style.top = '';
      tooltip.style.left = Math.max(0, Math.min(bounds.width - tooltip.offsetWidth, center - tooltip.offsetWidth / 2)) + 'px';
    }
  };

  const update = () => {
    frame = 0;
    if (!nav.isConnected) return;
    if (!enabled()) {
      visible = false;
      nav.inert = true;
      nav.classList.remove('is-visible');
      tooltip.hidden = true;
      return;
    }
    const height = scrollport.clientHeight;
    if (height !== viewportHeight) {
      viewportHeight = height;
      anchor.style.setProperty('--ck-dock-viewport', height + 'px');
    }
    const top = viewportTop();
    const distance = top - root.getBoundingClientRect().top;
    // 回到首屏时留一点滞后，避免触控板在阈值附近来回触发。
    const threshold = Math.max(64, height - (visible ? 72 : 24));
    const atEnd = scrollport.scrollHeight - height - scrollport.scrollTop <= 4;
    visible = height > 0 && (root.dataset.moduleNavAutoHide === 'off' || distance >= threshold || (atEnd && distance >= 64));
    nav.inert = !visible;
    nav.classList.toggle('is-visible', visible);
    if (!visible) {
      pointedButton = null;
      tooltip.hidden = true;
      return;
    }

    const probe = top + jumpInset() + 4;
    let next = null;
    for (const { wrapper, button } of entries) {
      if (wrapper.getBoundingClientRect().top <= probe) next = button;
      if (wrapper === jumpTarget && Math.abs(scrollport.scrollTop - jumpOffset) <= 2) {
        next = button;
        break;
      }
    }

    if (next !== activeButton) {
      activeButton?.removeAttribute('aria-current');
      activeButton = next;
      activeButton?.setAttribute('aria-current', 'location');
      // 只滚动 Dock 内部列表，不影响仪表盘的阅读位置。
      if (activeButton && !pointedButton && !list.querySelector('button:focus-visible')) {
        const button = activeButton.getBoundingClientRect();
        const bounds = list.getBoundingClientRect();
        list.scrollBy({
          left:Math.min(0, button.left - bounds.left - 6) || Math.max(0, button.right - bounds.right + 6),
          top:Math.min(0, button.top - bounds.top - 6) || Math.max(0, button.bottom - bounds.bottom + 6),
          behavior:'instant'
        });
      }
    }
    showLabel();
  };
  const schedule = () => { if (!frame && (enabled() || visible)) frame = win.requestAnimationFrame(update); };

  view._syncModuleNav = () => {
    if (!enabled()) {
      schedule();
      return;
    }
    const focusedId = list.contains(doc.activeElement) ? doc.activeElement.dataset.navModule : null;
    list.empty();
    activeButton = null;
    pointedButton = null;
    entries = [];
    const customIcons = new Map(view._moduleRegistry().filter(({ custom }) => custom)
      .map(({ id, custom }) => [id, custom.manifest.icon]));
    for (const moduleId of view._normalizeModuleOrder(view._moduleOrder)) {
      if (view._isModuleHidden(moduleId)) continue;
      const wrapper = findModule(moduleId);
      if (!wrapper) continue;
      const iconName = customIcons.get(moduleId) || cockpitModuleIcon(moduleId);
      const button = addButton(list, view._moduleLabel(moduleId), iconName,
        (event) => jump(moduleId, event.detail === 0));
      button.dataset.navModule = moduleId;
      entries.push({ wrapper, button });
      if (moduleId === focusedId) button.focus({ preventScroll:true });
    }
    schedule();
  };

  // 滚轮可浏览横向溢出的图标，触控板仍保留原生横向滚动。
  list.addEventListener('wheel', (event) => {
    if (position() === 'left' || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const limit = list.scrollWidth - list.clientWidth;
    if (limit <= 0 || (event.deltaY < 0 ? list.scrollLeft <= 0 : list.scrollLeft >= limit - 1)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientWidth : 1;
    list.scrollLeft += event.deltaY * unit;
    event.preventDefault();
  }, { passive:false });
  list.addEventListener('scroll', schedule, { passive:true });
  nav.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    pointedButton = event.target.closest('button');
    schedule();
  });
  nav.addEventListener('pointerleave', () => { pointedButton = null; schedule(); });
  nav.addEventListener('focusin', schedule);
  nav.addEventListener('focusout', schedule);

  const clearJumpTarget = (event) => {
    if (nav.contains(event.target)) return;
    jumpTarget = null;
  };
  const scrollEvents = scrollport === page ? win : scrollport;
  scrollEvents.addEventListener('scroll', schedule, { passive:true });
  scrollEvents.addEventListener('wheel', clearJumpTarget, { passive:true });
  scrollEvents.addEventListener('pointerdown', clearJumpTarget, { passive:true });
  scrollEvents.addEventListener('keydown', clearJumpTarget);
  const resize = new win.ResizeObserver(schedule);
  resize.observe(root);
  resize.observe(scrollport);
  view._syncModuleNav();
  view._moduleNavCleanup = () => {
    scrollEvents.removeEventListener('scroll', schedule);
    scrollEvents.removeEventListener('wheel', clearJumpTarget);
    scrollEvents.removeEventListener('pointerdown', clearJumpTarget);
    scrollEvents.removeEventListener('keydown', clearJumpTarget);
    resize.disconnect();
    if (frame) win.cancelAnimationFrame(frame);
    anchor.remove();
  };
}
