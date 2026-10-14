// motion.js — 仪表盘动效工具：折叠高度过渡、数字滚动、鼠标跟随高光。
// 全部尊重系统「减少动态效果」设置；不依赖第三方库，也不改动数据流。

const COCKPIT_GLOW_SELECTOR = [
  '-toolbtn', '-stat', '-cat', '-todo', '-countdown-card', '-scheduler-row', '-report-studio-item', '-recent-item'
].map((suffix) => '.' + PLUGIN_ID + suffix).join(',');

function cockpitPrefersReducedMotion() {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

// 折叠/展开：用 Web Animations 过渡高度与透明度，结束后再落到 display 状态。
function cockpitAnimateCollapse(contentEl, collapsed) {
  if (!contentEl) return;
  contentEl._cockpitCollapseAnim?.cancel();
  if (cockpitPrefersReducedMotion() || typeof contentEl.animate !== 'function') {
    contentEl.style.display = collapsed ? 'none' : '';
    return;
  }
  const easing = 'cubic-bezier(.22,1,.36,1)';
  if (collapsed) {
    const height = contentEl.offsetHeight;
    if (!height) { contentEl.style.display = 'none'; return; }
    contentEl.style.overflow = 'hidden';
    const anim = contentEl.animate([{ height:height + 'px', opacity:1 }, { height:'0px', opacity:0 }], { duration:240, easing });
    contentEl._cockpitCollapseAnim = anim;
    anim.onfinish = () => { contentEl.style.display = 'none'; contentEl.style.overflow = ''; contentEl._cockpitCollapseAnim = null; };
    anim.oncancel = () => { contentEl.style.overflow = ''; };
  } else {
    contentEl.style.display = '';
    const height = contentEl.scrollHeight;
    contentEl.style.overflow = 'hidden';
    const anim = contentEl.animate([{ height:'0px', opacity:0, transform:'translateY(-4px)' }, { height:height + 'px', opacity:1, transform:'none' }], { duration:300, easing });
    contentEl._cockpitCollapseAnim = anim;
    const done = () => { contentEl.style.overflow = ''; contentEl._cockpitCollapseAnim = null; };
    anim.onfinish = done; anim.oncancel = done;
  }
}

// 数字滚动：只对纯数字生效，其他文本直接替换。
function cockpitAnimateNumber(el, value, suffix) {
  if (!el) return;
  const text = '' + value + (suffix || '');
  const target = Number(value);
  const from = Number(el.dataset.ckValue);
  el.dataset.ckValue = String(value);
  if (!Number.isFinite(target) || !Number.isFinite(from) || from === target || cockpitPrefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    el.textContent = text;
    return;
  }
  const start = performance.now();
  const duration = Math.min(900, 380 + Math.abs(target - from) * 12);
  if (el._cockpitNumberFrame) cancelAnimationFrame(el._cockpitNumberFrame);
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * eased) + (suffix || '');
    if (t < 1) el._cockpitNumberFrame = requestAnimationFrame(step);
    else { el._cockpitNumberFrame = null; el.textContent = text; }
  };
  el._cockpitNumberFrame = requestAnimationFrame(step);
}

// 鼠标跟随高光：根节点一个委托监听，只写两个 CSS 变量。
function cockpitBindPointerGlow(root) {
  if (!root || root.dataset.ckGlowBound === '1' || cockpitPrefersReducedMotion()) return;
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

// 首次渲染 / 切换情景时给模块一个依次浮现的进场。
function cockpitPlayEntrance(root) {
  if (!root || cockpitPrefersReducedMotion()) return;
  root.classList.add(PLUGIN_ID + '-entering');
  setTimeout(() => root.classList.remove(PLUGIN_ID + '-entering'), 1400);
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { cockpitPrefersReducedMotion, cockpitAnimateCollapse, cockpitAnimateNumber, cockpitBindPointerGlow, cockpitPlayEntrance };
