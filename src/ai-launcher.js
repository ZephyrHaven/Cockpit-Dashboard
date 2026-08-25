// ai-launcher.js — 可拖拽的全局 AI 悬浮入口；始终可见并负责开关侧栏。

function normalizeAiLauncherPosition(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x); const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x:Math.max(0, Math.min(1, x)), y:Math.max(0, Math.min(1, y)) };
}

function calculateAiLauncherPoint(position, viewport, size = 48, margin = 12) {
  const normalized = normalizeAiLauncherPosition(position) || { x:1, y:1 };
  const width = Math.max(size + margin * 2, Number(viewport?.width) || 0);
  const height = Math.max(size + margin * 2, Number(viewport?.height) || 0);
  return {
    left:Math.round(margin + normalized.x * Math.max(0, width - size - margin * 2)),
    top:Math.round(margin + normalized.y * Math.max(0, height - size - margin * 2))
  };
}

function positionFromAiLauncherPoint(point, viewport, size = 48, margin = 12) {
  const width = Math.max(size + margin * 2, Number(viewport?.width) || 0);
  const height = Math.max(size + margin * 2, Number(viewport?.height) || 0);
  const spanX = Math.max(1, width - size - margin * 2);
  const spanY = Math.max(1, height - size - margin * 2);
  return normalizeAiLauncherPosition({ x:(Number(point?.left) - margin) / spanX, y:(Number(point?.top) - margin) / spanY });
}

function mountAiLauncher(plugin) {
  document.querySelectorAll('.' + PLUGIN_ID + '-ai-launcher').forEach((element) => element.remove());

  const launcher = document.createElement('button');
  launcher.className = PLUGIN_ID + '-ai-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', '打开 Cockpit AI 助手');
  launcher.setAttribute('title', 'Cockpit AI');

  const icon = launcher.createSpan({ cls:PLUGIN_ID + '-ai-launcher-icon', attr:{ 'aria-hidden':'true' } });
  obsidian.setIcon(icon, 'bot-message-square');
  const label = launcher.createSpan({ cls:PLUGIN_ID + '-ai-launcher-label', text:'AI 助手' });

  let savedPosition = null;
  let drag = null;
  let suppressClick = false;
  const viewport = () => ({ width:window.innerWidth, height:window.innerHeight });
  const applySavedPosition = () => {
    if (!savedPosition) {
      launcher.removeClass(PLUGIN_ID + '-ai-launcher-custom-position');
      launcher.style.removeProperty('left');
      launcher.style.removeProperty('top');
      launcher.style.removeProperty('right');
      launcher.style.removeProperty('bottom');
      return false;
    }
    const point = calculateAiLauncherPoint(savedPosition, viewport());
    launcher.addClass(PLUGIN_ID + '-ai-launcher-custom-position');
    launcher.style.left = point.left + 'px';
    launcher.style.top = point.top + 'px';
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';
    return true;
  };
  const persistPosition = () => plugin.mutateData((data) => { data.aiLauncherPosition = savedPosition; })
    .catch((e) => console.warn('Cockpit AI launcher position could not be saved', e));

  launcher.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = launcher.getBoundingClientRect();
    drag = { pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, left:rect.left, top:rect.top, moved:false };
    launcher.setPointerCapture?.(event.pointerId);
  });
  launcher.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX; const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    suppressClick = true;
    launcher.addClass('is-dragging');
    const point = calculateAiLauncherPoint(
      positionFromAiLauncherPoint({ left:drag.left + dx, top:drag.top + dy }, viewport()),
      viewport()
    );
    launcher.style.left = point.left + 'px';
    launcher.style.top = point.top + 'px';
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';
    event.preventDefault();
  });
  const finishDrag = (event, cancelled = false) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    drag = null;
    launcher.removeClass('is-dragging');
    try { launcher.releasePointerCapture?.(event.pointerId); } catch (e) {}
    if (moved && !cancelled) {
      savedPosition = positionFromAiLauncherPoint({ left:parseFloat(launcher.style.left), top:parseFloat(launcher.style.top) }, viewport());
      applySavedPosition();
      persistPosition();
      window.setTimeout(() => { suppressClick = false; }, 0);
    } else if (cancelled) suppressClick = false;
  };
  launcher.addEventListener('pointerup', (event) => finishDrag(event));
  launcher.addEventListener('pointercancel', (event) => finishDrag(event, true));

  launcher.onclick = async () => {
    if (suppressClick) { suppressClick = false; return; }
    if (launcher.classList.contains('is-launching')) return;
    launcher.classList.add('is-launching');
    try { await plugin.toggleAI(); }
    catch (e) {
      console.warn('Cockpit AI view failed to open', e);
      new obsidian.Notice('无法打开 Cockpit AI。');
    } finally {
      launcher.classList.remove('is-launching');
    }
  };

  document.body.appendChild(launcher);
  plugin._aiLauncherEl = launcher;
  plugin._syncAiLauncher = () => {
    if (!launcher.isConnected) return;
    const leaves = plugin.app.workspace.getLeavesOfType(AI_VIEW_TYPE);
    const isOpen = leaves.length > 0;
    const leafEl = leaves[0]?.containerEl || leaves[0]?.view?.containerEl?.closest?.('.workspace-leaf') || leaves[0]?.view?.containerEl;
    const leafBounds = leafEl?.getBoundingClientRect?.();
    const besideLeaf = isOpen && leafBounds && leafBounds.left > 64 && leafBounds.left < window.innerWidth;
    if (savedPosition) applySavedPosition();
    else if (besideLeaf) {
      const right = Math.max(20, Math.round(window.innerWidth - leafBounds.left + 12));
      launcher.style.setProperty('--cockpit-ai-launcher-right', right + 'px');
    } else launcher.style.removeProperty('--cockpit-ai-launcher-right');
    launcher.classList.toggle('is-open', isOpen);
    obsidian.setIcon(icon, isOpen ? 'panel-right-close' : 'bot-message-square');
    label.setText(isOpen ? '关闭 AI' : 'AI 助手');
    launcher.setAttribute('aria-label', isOpen ? '关闭 Cockpit AI 助手' : '打开 Cockpit AI 助手');
    launcher.setAttribute('title', isOpen ? '关闭 Cockpit AI' : '打开 Cockpit AI');
  };
  const syncPosition = () => plugin._syncAiLauncher?.();
  window.addEventListener('resize', syncPosition);
  plugin.registerEvent?.(plugin.app.workspace.on('layout-change', syncPosition));
  plugin._syncAiLauncher();
  plugin.loadData().then((data) => {
    if (!launcher.isConnected) return;
    savedPosition = normalizeAiLauncherPosition(data?.aiLauncherPosition);
    plugin._syncAiLauncher?.();
  }).catch((e) => console.warn('Cockpit AI launcher position could not be loaded', e));

  return () => {
    window.removeEventListener('resize', syncPosition);
    launcher.remove();
    if (plugin._aiLauncherEl === launcher) plugin._aiLauncherEl = null;
    plugin._syncAiLauncher = null;
  };
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { normalizeAiLauncherPosition, calculateAiLauncherPoint, positionFromAiLauncherPoint };
}
