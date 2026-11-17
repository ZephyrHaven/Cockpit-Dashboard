// motion.js — Cockpit Motion V2：统一动效语义、生命周期、FLIP 与交互反馈。
// 业务模块只声明“发生了什么”，本文件负责时长、曲线、降级和清理。

const COCKPIT_MOTION = Object.freeze({
  fast:140, popover:180, exit:180, ui:220, layout:320, dialog:320,
  easeOut:'cubic-bezier(.23,1,.32,1)',
  easeInOut:'cubic-bezier(.77,0,.175,1)',
  easeDrawer:'cubic-bezier(.32,.72,0,1)'
});
const COCKPIT_GLOW_SELECTOR = [
  '-toolbtn', '-stat', '-cat', '-todo', '-countdown-card', '-scheduler-row', '-workflow-card', '-report-studio-item', '-recent-item'
].map((suffix) => '.' + PLUGIN_ID + suffix).join(',');
const COCKPIT_TILT_SELECTOR = [
  '-countdown-card', '-scheduler-row', '-workflow-card', '-report-studio-item', '-resurface-card', '-agenda-row', '-project-row'
].map((suffix) => '.' + PLUGIN_ID + suffix).join(',');
const COCKPIT_PRESS_SELECTOR = 'button:not(:disabled),[role="button"]:not([aria-disabled="true"])';
const cockpitMotionAnimations = new Set();
const cockpitPaperPlaneLayers = new Set();
const cockpitCelebrationLayers = new Set();
let cockpitPaperPlaneSeq = 0;

function cockpitPrefersReducedMotion() {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
function cockpitMotionEnabled(owner) {
  const value = owner?._motionV2Enabled ?? owner?._plugin?._motionV2Enabled ?? owner?.plugin?._motionV2Enabled ?? globalThis.__cockpitMotionV2Enabled;
  return value !== false;
}
function cockpitMotionAllowed(owner) {
  return cockpitMotionEnabled(owner) && !cockpitPrefersReducedMotion() && (typeof document === 'undefined' || !document.hidden);
}
function cockpitTrackAnimation(animation) {
  if (!animation) return animation;
  cockpitMotionAnimations.add(animation);
  const clear = () => cockpitMotionAnimations.delete(animation);
  animation.addEventListener?.('finish', clear, { once:true });
  animation.addEventListener?.('cancel', clear, { once:true });
  return animation;
}
function cockpitCancelMotion() {
  Array.from(cockpitPaperPlaneLayers).forEach((cleanup) => cleanup());
  Array.from(cockpitCelebrationLayers).forEach((cleanup) => cleanup());
  cockpitMotionAnimations.forEach((animation) => { try { animation.finish?.(); } catch (e) { try { animation.cancel?.(); } catch (ignore) {} } });
  cockpitMotionAnimations.clear();
}
function cockpitMotionMode(owner) {
  if (!cockpitMotionEnabled(owner)) return 'off';
  return cockpitPrefersReducedMotion() ? 'reduced' : 'full';
}
function cockpitApplyMotionState(root, owner) {
  if (!root?.dataset) return;
  root.dataset.motion = cockpitMotionMode(owner);
  root.classList.toggle('ck-motion-v2', root.dataset.motion === 'full');
}
function cockpitRefreshMotionRoots(plugin, enabled) {
  if (plugin) plugin._motionV2Enabled = enabled !== false;
  globalThis.__cockpitMotionV2Enabled = enabled !== false;
  const viewType = typeof VIEW_TYPE !== 'undefined' ? VIEW_TYPE : 'cockpit-dashboard';
  const leaves = plugin?.app?.workspace?.getLeavesOfType?.(viewType) || [];
  leaves.forEach((leaf) => {
    const view = leaf?.view;
    if (!view) return;
    view._motionV2Enabled = enabled !== false;
    const root = view.containerEl?.children?.[1]?.querySelector?.('.' + PLUGIN_ID + '-root');
    cockpitApplyMotionState(root, view);
  });
  if (enabled === false) cockpitCancelMotion();
}

function cockpitAnimateCollapse(contentEl, collapsed, owner) {
  if (!contentEl) return;
  contentEl._cockpitCollapseAnim?.cancel();
  if (!cockpitMotionAllowed(owner) || typeof contentEl.animate !== 'function') {
    contentEl.style.display = collapsed ? 'none' : '';
    return;
  }
  if (collapsed) {
    const height = contentEl.offsetHeight;
    if (!height) { contentEl.style.display = 'none'; return; }
    contentEl.style.overflow = 'hidden';
    const anim = cockpitTrackAnimation(contentEl.animate([{ height:height + 'px', opacity:1 }, { height:'0px', opacity:0 }], { duration:COCKPIT_MOTION.ui, easing:COCKPIT_MOTION.easeOut }));
    contentEl._cockpitCollapseAnim = anim;
    anim.onfinish = () => { contentEl.style.display = 'none'; contentEl.style.overflow = ''; contentEl._cockpitCollapseAnim = null; };
    anim.oncancel = () => { contentEl.style.overflow = ''; contentEl._cockpitCollapseAnim = null; };
  } else {
    contentEl.style.display = '';
    const height = contentEl.scrollHeight;
    contentEl.style.overflow = 'hidden';
    const anim = cockpitTrackAnimation(contentEl.animate([{ height:'0px', opacity:0, transform:'translateY(-4px)' }, { height:height + 'px', opacity:1, transform:'none' }], { duration:COCKPIT_MOTION.layout, easing:COCKPIT_MOTION.easeOut }));
    contentEl._cockpitCollapseAnim = anim;
    const done = () => { contentEl.style.overflow = ''; contentEl._cockpitCollapseAnim = null; };
    anim.onfinish = done; anim.oncancel = done;
  }
}

function cockpitAnimateNumber(el, value, suffix, owner) {
  if (!el) return;
  const text = '' + value + (suffix || '');
  const target = Number(value);
  const from = Number(el.dataset.ckValue);
  el.dataset.ckValue = String(value);
  if (!Number.isFinite(target) || !Number.isFinite(from) || from === target || !cockpitMotionAllowed(owner) || typeof requestAnimationFrame !== 'function') {
    el.textContent = text;
    return;
  }
  const start = performance.now();
  const duration = Math.min(300, 180 + Math.abs(target - from) * 4);
  if (el._cockpitNumberFrame) cancelAnimationFrame(el._cockpitNumberFrame);
  el.classList.add('ck-number-changing');
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * eased) + (suffix || '');
    if (t < 1 && cockpitMotionAllowed(owner)) el._cockpitNumberFrame = requestAnimationFrame(step);
    else { el._cockpitNumberFrame = null; el.textContent = text; el.classList.remove('ck-number-changing'); }
  };
  el._cockpitNumberFrame = requestAnimationFrame(step);
}

function cockpitBindPointerGlow(root, owner) {
  if (!root || root.dataset.ckGlowBound === '1' || !cockpitMotionAllowed(owner)) return;
  root.dataset.ckGlowBound = '1';
  let frame = 0; let pending = null;
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    pending = event;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const target = pending?.target?.closest?.(COCKPIT_GLOW_SELECTOR);
      if (!target || !root.contains(target)) return;
      if (!target.classList.contains('ck-glow')) target.classList.add('ck-glow');
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--ck-mx', (pending.clientX - rect.left) + 'px');
      target.style.setProperty('--ck-my', (pending.clientY - rect.top) + 'px');
    });
  }, { passive:true });
}

function cockpitBindMotionInteractions(root, owner) {
  if (!root || root.dataset.ckMotionBound === '1') return;
  root.dataset.ckMotionBound = '1';
  let pressed = null;
  const release = () => { pressed?.classList?.remove('ck-pressed'); pressed = null; };
  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !cockpitMotionAllowed(owner)) return;
    const target = event.target?.closest?.(COCKPIT_PRESS_SELECTOR);
    if (!target || !root.contains(target)) return;
    if (target.classList.contains(PLUGIN_ID + '-content-resize-handle')) return;
    pressed = target; target.classList.add('ck-pressed');
    if (target.classList.contains(PLUGIN_ID + '-cal-rss-btn')) return;
    const position = window.getComputedStyle?.(target)?.position;
    const addedRelative = !position || position === 'static';
    if (addedRelative) target.classList.add('ck-motion-relative');
    target.classList.add('ck-motion-ripple-host');
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ck-motion-ripple'; ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = (event.clientX - rect.left) + 'px'; ripple.style.top = (event.clientY - rect.top) + 'px';
    target.appendChild(ripple);
    const animation = cockpitTrackAnimation(ripple.animate([{ transform:'translate(-50%,-50%) scale(.2)', opacity:.28 }, { transform:'translate(-50%,-50%) scale(1)', opacity:0 }], { duration:420, easing:COCKPIT_MOTION.easeOut }));
    const cleanup = () => {
      ripple.remove();
      target.classList.remove('ck-motion-ripple-host');
      if (addedRelative) target.classList.remove('ck-motion-relative');
    };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }, { passive:true });
  root.addEventListener('pointerup', release, { passive:true });
  root.addEventListener('pointercancel', release, { passive:true });
  root.addEventListener('pointerleave', release, { passive:true });
}

// 只在鼠标主动经过时计算一次视差，不启动常驻动画循环。CSS 负责真正绘制。
function cockpitBindCinematicMotion(root, owner) {
  if (!root || root.dataset.ckCinematicBound === '1') return;
  root.dataset.ckCinematicBound = '1';
  const hero = root.querySelector('.' + PLUGIN_ID + '-hero');
  let frame = 0; let pending = null; let activeCard = null;
  const resetCard = () => {
    if (!activeCard) return;
    activeCard.classList.remove('ck-tilting');
    activeCard.style.removeProperty('--ck-tilt-x');
    activeCard.style.removeProperty('--ck-tilt-y');
    activeCard.style.removeProperty('--ck-card-x');
    activeCard.style.removeProperty('--ck-card-y');
    activeCard = null;
  };
  root.addEventListener('pointermove', (event) => {
    if ((event.pointerType && event.pointerType !== 'mouse') || !cockpitMotionAllowed(owner)) return;
    pending = event;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const current = pending;
      if (!current) return;
      if (hero) {
        const rect = hero.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (current.clientX - rect.left) / Math.max(1, rect.width)));
        const y = Math.max(0, Math.min(1, (current.clientY - rect.top) / Math.max(1, rect.height)));
        hero.style.setProperty('--ck-hero-x', Math.round(x * 100) + '%');
        hero.style.setProperty('--ck-hero-y', Math.round(y * 100) + '%');
      }
      const card = current.target?.closest?.(COCKPIT_TILT_SELECTOR);
      if (!card || !root.contains(card)) { resetCard(); return; }
      if (activeCard !== card) { resetCard(); activeCard = card; card.classList.add('ck-tilting'); }
      const rect = card.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (current.clientX - rect.left) / Math.max(1, rect.width)));
      const py = Math.max(0, Math.min(1, (current.clientY - rect.top) / Math.max(1, rect.height)));
      card.style.setProperty('--ck-card-x', Math.round(px * 100) + '%');
      card.style.setProperty('--ck-card-y', Math.round(py * 100) + '%');
    });
  }, { passive:true });
  root.addEventListener('pointerleave', () => {
    resetCard();
  }, { passive:true });
}

function cockpitCaptureLayout(elements) {
  const result = new Map();
  Array.from(elements || []).forEach((element) => {
    const key = element?.dataset?.motionKey;
    if (key && element.isConnected) result.set(key, element.getBoundingClientRect());
  });
  return result;
}
function cockpitPlayFlip(container, first, owner) {
  if (!container || !first || !cockpitMotionAllowed(owner)) return;
  container.querySelectorAll('[data-motion-key]').forEach((element) => {
    const before = first.get(element.dataset.motionKey);
    if (!before) return;
    const after = element.getBoundingClientRect();
    const dx = before.left - after.left; const dy = before.top - after.top;
    const sx = after.width ? before.width / after.width : 1; const sy = after.height ? before.height / after.height : 1;
    if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
    element._cockpitFlip?.cancel?.();
    element._cockpitFlip = cockpitTrackAnimation(element.animate([
      { transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transform:'none' }
    ], { duration:COCKPIT_MOTION.layout, easing:COCKPIT_MOTION.easeInOut }));
  });
}
function cockpitRevealList(container, selector, owner) {
  if (!container || !cockpitMotionAllowed(owner)) return;
  if (container.closest?.('.' + PLUGIN_ID + '-root[data-glass="on"]')) return;
  Array.from(container.querySelectorAll(selector)).slice(0, 8).forEach((element, index) => {
    cockpitTrackAnimation(element.animate([
      { opacity:0, transform:'translateY(20px) scale(.955)', filter:'blur(7px)' },
      { opacity:1, transform:'none', filter:'blur(0)' }
    ], { duration:460, delay:index * 64, easing:COCKPIT_MOTION.easeOut, fill:'backwards' }));
  });
}
function cockpitSettle(element, status, owner) {
  if (!element) return;
  element.dataset.motionState = status || '';
  if (!cockpitMotionAllowed(owner)) return;
  const frames = status === 'failed'
    ? [{ transform:'translateX(0)', filter:'none' }, { transform:'translateX(-9px)', filter:'saturate(1.4)' }, { transform:'translateX(7px)' }, { transform:'translateX(-4px)' }, { transform:'translateX(0)', filter:'none' }]
    : [{ transform:'scale(.94)' }, { transform:'scale(1.085)' }, { transform:'scale(.985)' }, { transform:'scale(1)' }];
  cockpitTrackAnimation(element.animate(frames, { duration:status === 'failed' ? 460 : 380, easing:COCKPIT_MOTION.easeOut }));
}

// 完成待办的局部仪式：粒子与光圈挂在固定层上，列表随后重绘也不会打断动画。
function cockpitCelebrate(anchorEl, owner) {
  if (!anchorEl?.isConnected || !cockpitMotionAllowed(owner) || typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function' || typeof anchorEl.animate !== 'function') return false;
  const rect = anchorEl.getBoundingClientRect?.();
  if (!rect || (!rect.width && !rect.height)) return false;
  const layer = document.createElement('div');
  layer.className = 'ck-celebrate-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.left = (rect.left + rect.width / 2) + 'px';
  layer.style.top = (rect.top + rect.height / 2) + 'px';
  const flash = document.createElement('span');
  flash.className = 'ck-celebrate-flash';
  layer.appendChild(flash);
  const ring = document.createElement('span');
  ring.className = 'ck-celebrate-ring';
  layer.appendChild(ring);
  const sparks = [];
  for (let index = 0; index < 10; index++) {
    const spark = document.createElement('span');
    spark.className = 'ck-celebrate-spark';
    if (index % 3 === 2) spark.style.background = 'var(--ck-accent-2,#8b5cf6)';
    layer.appendChild(spark);
    const angle = Math.PI * 2 * index / 10 + (Math.random() - .5) * .4;
    const distance = 18 + Math.random() * 10;
    sparks.push({ spark, dx:Math.cos(angle) * distance, dy:Math.sin(angle) * distance - 4 });
  }
  document.body.appendChild(layer);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    cockpitCelebrationLayers.delete(cleanup);
    layer.remove();
  };
  cockpitCelebrationLayers.add(cleanup);
  let pending = sparks.length;
  const settle = () => { pending -= 1; if (pending <= 0) cleanup(); };
  try {
    cockpitTrackAnimation(flash.animate([
      { transform:'scale(.55)', opacity:.55 },
      { transform:'scale(1.25)', opacity:0 }
    ], { duration:300, easing:COCKPIT_MOTION.easeOut }));
    cockpitTrackAnimation(ring.animate([
      { transform:'scale(.32)', opacity:.9 },
      { transform:'scale(2.1)', opacity:0 }
    ], { duration:620, easing:COCKPIT_MOTION.easeOut }));
    sparks.forEach(({ spark, dx, dy }) => {
      const animation = cockpitTrackAnimation(spark.animate([
        { transform:'translate(0,0) scale(.7)', opacity:1 },
        { transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(.18)`, opacity:0 }
      ], { duration:540 + Math.random() * 110, delay:Math.random() * 30, easing:COCKPIT_MOTION.easeOut }));
      animation.onfinish = settle;
      animation.oncancel = settle;
    });
  } catch (error) {
    cleanup();
    return false;
  }
  return true;
}

// 纸飞机投递：业务侧只上报起落矩形，轨迹、曲线、降级与清理都由这里负责。
function cockpitFlightNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function cockpitFlightProgress(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}
function cockpitFlightCurve(from, to) {
  const start = { x:cockpitFlightNumber(from?.x), y:cockpitFlightNumber(from?.y) };
  const end = { x:cockpitFlightNumber(to?.x), y:cockpitFlightNumber(to?.y) };
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const lift = Math.max(26, Math.min(150, distance * .3));
  // 每圈的前进距离要小于圆周长，圈才能真正合拢。
  const loops = distance >= 240 ? 2 : 1;
  const loopRadius = Math.max(20, Math.min(78, distance * 1.9 / (loops * Math.PI * 2)));
  return { start, end, control:{ x:(start.x + end.x) / 2, y:Math.min(start.y, end.y) - lift }, distance, lift, loopRadius, loops };
}
function cockpitFlightBasePoint(curve, progress) {
  const t = cockpitFlightProgress(progress);
  const u = 1 - t;
  return {
    x:u * u * curve.start.x + 2 * u * t * curve.control.x + t * t * curve.end.x,
    y:u * u * curve.start.y + 2 * u * t * curve.control.y + t * t * curve.end.y
  };
}
function cockpitFlightTangent(curve, progress) {
  const t = cockpitFlightProgress(progress);
  const u = 1 - t;
  const dx = 2 * u * (curve.control.x - curve.start.x) + 2 * t * (curve.end.x - curve.control.x);
  const dy = 2 * u * (curve.control.y - curve.start.y) + 2 * t * (curve.end.y - curve.control.y);
  const length = Math.hypot(dx, dy) || 1;
  return { x:dx / length, y:dy / length };
}
// 在基础弧线上叠加两圈逐渐收拢的盘旋，终点精确回到日期格中心。
function cockpitFlightPoint(curve, progress) {
  const t = cockpitFlightProgress(progress);
  if (t === 0) return { x:curve.start.x, y:curve.start.y };
  if (t === 1) return { x:curve.end.x, y:curve.end.y };
  const base = cockpitFlightBasePoint(curve, t);
  const tangent = cockpitFlightTangent(curve, t);
  const normal = { x:-tangent.y, y:tangent.x };
  const theta = Math.PI * 2 * (curve.loops || 0) * t;
  const radius = curve.loopRadius || 0;
  const along = Math.sin(theta) * radius;
  const across = (1 - Math.cos(theta)) * radius;
  return {
    x:base.x + tangent.x * along + normal.x * across,
    y:base.y + tangent.y * along + normal.y * across
  };
}
function cockpitFlightAngle(curve, progress) {
  const t = cockpitFlightProgress(progress);
  const step = .002;
  const before = cockpitFlightPoint(curve, Math.max(0, t - step));
  const after = cockpitFlightPoint(curve, Math.min(1, t + step));
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  if (!dx && !dy) return 0;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}
function cockpitFlightPath(curve, count = 160) {
  const parts = [];
  for (let i = 0; i <= count; i++) {
    const point = cockpitFlightPoint(curve, i / count);
    parts.push((i ? 'L ' : 'M ') + point.x.toFixed(2) + ' ' + point.y.toFixed(2));
  }
  return parts.join(' ');
}
function cockpitSvgNode(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
  return node;
}
function cockpitFlyPaperPlane({ fromRect, toRect, owner } = {}) {
  const center = (rect) => (rect && ['left', 'top', 'width', 'height'].every((key) => Number.isFinite(Number(rect[key]))))
    ? { x:Number(rect.left) + Number(rect.width) / 2, y:Number(rect.top) + Number(rect.height) / 2 }
    : null;
  const from = center(fromRect);
  const to = center(toRect);
  if (!from || !to || !cockpitMotionAllowed(owner) || typeof document === 'undefined' || !document.body || typeof document.createElementNS !== 'function') return false;
  const curve = cockpitFlightCurve(from, to);
  if (curve.distance < 16) return false;
  const id = 'ck-paper-plane-mask-' + (++cockpitPaperPlaneSeq);
  const pathData = cockpitFlightPath(curve, Math.round(Math.max(96, Math.min(220, curve.distance / 2))));
  const layer = document.createElement('div');
  layer.className = 'ck-paper-plane-layer';
  layer.setAttribute('aria-hidden', 'true');
  const svg = cockpitSvgNode('svg', { class:'ck-paper-plane-canvas' });
  const mask = cockpitSvgNode('mask', { id, maskUnits:'userSpaceOnUse', x:0, y:0, width:'100%', height:'100%' });
  const reveal = cockpitSvgNode('path', { d:pathData, fill:'none', stroke:'#fff', 'stroke-width':6, 'stroke-linecap':'round', 'stroke-dasharray':'1 1', 'stroke-dashoffset':1, pathLength:1 });
  mask.appendChild(reveal);
  const defs = cockpitSvgNode('defs', {});
  defs.appendChild(mask);
  const arc = cockpitSvgNode('path', { class:'ck-paper-plane-arc', d:pathData, pathLength:1, mask:`url(#${id})` });
  const plane = cockpitSvgNode('g', { class:'ck-paper-plane-glyph' });
  // Telegram 纸飞机轮廓；轮廓本身朝右上约 34°，先旋正再随航向转动。
  const glyph = cockpitSvgNode('path', {
    class:'ck-paper-plane-body',
    d:'M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931L23.93 3.821c.321-1.496-.541-2.081-1.527-1.714L1.36 10.174c-1.453.564-1.431 1.374-.247 1.742l5.405 1.686L18.97 5.685c.593-.393 1.136-.175.69.218l-9.246 8.309z',
    transform:'translate(-12.6 -11.4) rotate(34 12.6 11.4)'
  });
  plane.appendChild(glyph);
  const ring = cockpitSvgNode('circle', { class:'ck-paper-plane-ring', cx:to.x, cy:to.y, r:16 });
  [defs, arc, plane, ring].forEach((node) => svg.appendChild(node));
  layer.appendChild(svg);
  document.body.appendChild(layer);

  const duration = Math.round(Math.max(900, Math.min(1500, 760 + curve.distance * .45 + curve.loops * 120)));
  const launch = cockpitFlightPoint(curve, 0);
  plane.setAttribute('transform', `translate(${launch.x.toFixed(2)} ${launch.y.toFixed(2)}) rotate(${cockpitFlightAngle(curve, 0).toFixed(2)})`);
  let frame = 0;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (frame) cancelAnimationFrame(frame);
    cockpitPaperPlaneLayers.delete(cleanup);
    layer.remove();
  };
  cockpitPaperPlaneLayers.add(cleanup);
  const started = performance.now();
  const step = (now) => {
    const raw = Math.max(0, Math.min(1, (now - started) / duration));
    const eased = raw < .5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
    const point = cockpitFlightPoint(curve, eased);
    const scale = 1.12 - .34 * raw * raw;
    plane.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${cockpitFlightAngle(curve, eased).toFixed(2)}) scale(${scale.toFixed(3)})`);
    reveal.setAttribute('stroke-dashoffset', (1 - eased).toFixed(4));
    if (raw < 1) { frame = requestAnimationFrame(step); return; }
    frame = 0;
    layer.classList.add('is-landing');
    const fade = typeof layer.animate === 'function'
      ? cockpitTrackAnimation(layer.animate([{ opacity:1 }, { opacity:0 }], { duration:COCKPIT_MOTION.exit + 80, delay:160, easing:'ease-out', fill:'forwards' }))
      : null;
    if (fade) { fade.onfinish = cleanup; fade.oncancel = cleanup; } else cleanup();
  };
  frame = requestAnimationFrame(step);
  return true;
}

function cockpitAnimatePopover(popover, trigger, owner) {
  if (!popover || !trigger || !cockpitMotionEnabled(owner) || (typeof document !== 'undefined' && document.hidden) || typeof popover.animate !== 'function') return;
  const anchor = trigger.getBoundingClientRect();
  const surface = popover.getBoundingClientRect();
  const originX = Math.max(0, Math.min(surface.width, anchor.left + anchor.width / 2 - surface.left));
  popover.style.transformOrigin = originX + 'px 0';
  const reduced = cockpitPrefersReducedMotion();
  const frames = reduced
    ? [{ opacity:0 }, { opacity:1 }]
    : [{ opacity:0, transform:'translateY(-6px) scale(.96)' }, { opacity:1, transform:'none' }];
  popover._cockpitPopoverAnim = cockpitTrackAnimation(popover.animate(frames, { duration:COCKPIT_MOTION.popover, easing:COCKPIT_MOTION.easeOut, fill:'backwards' }));
}
function cockpitClosePopover(popover, owner, done) {
  if (!popover) return;
  if (!cockpitMotionEnabled(owner) || (typeof document !== 'undefined' && document.hidden) || typeof popover.animate !== 'function') { done?.(); return; }
  popover._cockpitPopoverAnim?.cancel?.();
  const reduced = cockpitPrefersReducedMotion();
  const frames = reduced
    ? [{ opacity:1 }, { opacity:0 }]
    : [{ opacity:1, transform:'none' }, { opacity:0, transform:'translateY(-6px) scale(.96)' }];
  const animation = cockpitTrackAnimation(popover.animate(frames, { duration:reduced ? COCKPIT_MOTION.exit : COCKPIT_MOTION.fast, easing:COCKPIT_MOTION.easeOut, fill:'forwards' }));
  animation.onfinish = () => done?.();
}

function cockpitPlayEntrance(root, owner) {
  if (!root || !cockpitMotionAllowed(owner)) return;
  root.classList.add(PLUGIN_ID + '-entering');
  const hero = root.querySelector('.' + PLUGIN_ID + '-hero');
  const modules = Array.from(root.querySelectorAll(':scope > .' + PLUGIN_ID + '-module')).slice(0, 14);
  const glass = root.dataset.glass === 'on';
  const canAnimate = typeof root.animate === 'function' && (!hero || typeof hero.animate === 'function');
  if (canAnimate) {
    root.classList.add('ck-waapi-entrance');
    if (hero) cockpitTrackAnimation(hero.animate(glass ? [
      { opacity:0 }, { opacity:1 }
    ] : [
      { opacity:0, transform:'scale(.94)', filter:'blur(14px)', clipPath:'inset(0 0 42% 0 round 22px)' },
      { opacity:1, transform:'scale(1)', filter:'blur(0)', clipPath:'inset(0 0 0 0 round 18px)', offset:.76 },
      { opacity:1, transform:'none', filter:'blur(0)', clipPath:'inset(0 0 0 0 round 18px)' }
    ], { duration:glass ? 260 : 820, easing:COCKPIT_MOTION.easeOut, fill:'backwards' }));
    modules.forEach((element, index) => cockpitTrackAnimation(element.animate(glass ? [
      { opacity:0 }, { opacity:1 }
    ] : [
      { opacity:0, transform:'scale(.955)', filter:'blur(11px)', clipPath:'inset(14% 0 0 0 round 18px)' },
      { opacity:1, transform:'scale(1)', filter:'blur(0)', clipPath:'inset(0 0 0 0 round 18px)', offset:.78 },
      { opacity:1, transform:'none', filter:'blur(0)' }
    ], { duration:glass ? 220 : 720, delay:glass ? 40 + index * 20 : 150 + index * 72, easing:COCKPIT_MOTION.easeOut, fill:'backwards' })));
  }
  const timeout = glass ? 40 + Math.max(0, modules.length - 1) * 20 + 260 : 150 + Math.max(0, modules.length - 1) * 72 + 820;
  setTimeout(() => {
    root.classList.remove(PLUGIN_ID + '-entering');
    root.classList.remove('ck-waapi-entrance');
  }, glass ? timeout : Math.max(1050, timeout));
}

function cockpitReplayMotion(plugin, previewEl) {
  const owner = plugin || {};
  if (!cockpitMotionAllowed(owner)) return false;
  if (previewEl) {
    previewEl.classList.remove('is-demoing');
    void previewEl.offsetWidth;
    previewEl.classList.add('is-demoing');
    setTimeout(() => previewEl.classList.remove('is-demoing'), 1300);
  }
  const viewType = typeof VIEW_TYPE !== 'undefined' ? VIEW_TYPE : 'cockpit-dashboard';
  const leaves = plugin?.app?.workspace?.getLeavesOfType?.(viewType) || [];
  leaves.forEach((leaf) => {
    const view = leaf?.view;
    const root = view?.containerEl?.children?.[1]?.querySelector?.('.' + PLUGIN_ID + '-root');
    if (root) cockpitPlayEntrance(root, view);
  });
  return true;
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) cockpitCancelMotion(); });

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = {
  COCKPIT_MOTION, cockpitPrefersReducedMotion, cockpitMotionEnabled, cockpitMotionAllowed, cockpitApplyMotionState,
  cockpitRefreshMotionRoots, cockpitCancelMotion, cockpitAnimateCollapse, cockpitAnimateNumber, cockpitBindPointerGlow,
  cockpitBindMotionInteractions, cockpitBindCinematicMotion, cockpitCaptureLayout, cockpitPlayFlip, cockpitRevealList, cockpitSettle, cockpitCelebrate, cockpitPlayEntrance, cockpitReplayMotion
  , cockpitAnimatePopover, cockpitClosePopover, cockpitFlightCurve, cockpitFlightPoint, cockpitFlightAngle, cockpitFlyPaperPlane
};
