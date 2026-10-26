// modal-motion.js — 二级弹窗统一的进入 / 退出动效。
// 宿主 Modal 子类继承 CockpitModal；自建遮罩层调用 cockpitAnimateOverlay(overlay)。
// 进入动画纯 CSS；退出时先播放收起动画再真正移除；减少动态效果时仅保留淡入淡出。

const COCKPIT_MODAL_LEAVE_MS = 180;

function cockpitPrefersReducedMotion() {
  try { return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true; }
  catch (e) { return false; }
}

function cockpitAnimateSurfaceExit(shell, panel, backdrop) {
  if (!shell || !panel || typeof panel.animate !== 'function' || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return false;
  const reduced = cockpitPrefersReducedMotion();
  const panelStyle = window.getComputedStyle(panel);
  const backdropStyle = backdrop && backdrop !== panel ? window.getComputedStyle(backdrop) : null;
  const panelStart = { opacity:panelStyle.opacity, transform:panelStyle.transform };
  const backdropOpacity = backdropStyle?.opacity || '1';
  [shell, backdrop, panel].filter(Boolean).forEach((element) => element.getAnimations?.().forEach((animation) => animation.cancel()));
  shell.classList.add('is-leaving', 'is-waapi-leaving');
  const track = (animation) => typeof cockpitTrackAnimation === 'function' ? cockpitTrackAnimation(animation) : animation;
  if (backdrop && backdrop !== panel) track(backdrop.animate([{ opacity:backdropOpacity }, { opacity:0 }], {
    duration:COCKPIT_MODAL_LEAVE_MS, easing:'cubic-bezier(.23,1,.32,1)', fill:'forwards'
  }));
  track(panel.animate([
    panelStart,
    reduced
      ? { opacity:0, transform:panelStart.transform }
      : { opacity:0, transform:'translateY(6px) scale(.985)' }
  ], { duration:COCKPIT_MODAL_LEAVE_MS, easing:'cubic-bezier(.23,1,.32,1)', fill:'forwards' }));
  return true;
}

class CockpitModal extends obs.Modal {
  open() {
    this._cockpitLeaving = false;
    const result = super.open();
    if (typeof cockpitMotionEnabled !== 'function' || cockpitMotionEnabled(this)) this.containerEl?.classList?.add(PLUGIN_ID + '-modal-motion');
    return result;
  }
  close() {
    const container = this.containerEl;
    if (this._cockpitLeaving) return;
    if (!container?.isConnected || !container.classList || (typeof cockpitMotionEnabled === 'function' && !cockpitMotionEnabled(this))) return super.close();
    this._cockpitLeaving = true;
    if (!cockpitAnimateSurfaceExit(container, container.querySelector?.('.modal'), container.querySelector?.('.modal-bg'))) container.classList.add('is-leaving');
    setTimeout(() => {
      container.classList.remove('is-leaving', 'is-waapi-leaving');
      super.close();
      this._cockpitLeaving = false;
    }, COCKPIT_MODAL_LEAVE_MS);
  }
}

// 自建遮罩层：只替换这一个元素实例的 remove / detach，调用方原有的关闭逻辑无需改动。
function cockpitAnimateOverlay(overlay, options = {}) {
  if (!overlay || overlay._cockpitMotion || typeof overlay.remove !== 'function' || !overlay.classList?.add) return overlay;
  if (typeof cockpitMotionEnabled === 'function' && !cockpitMotionEnabled(options.owner)) return overlay;
  overlay._cockpitMotion = true;
  overlay.classList.add(PLUGIN_ID + '-motion-overlay');
  const trigger = options.trigger;
  const sourceRect = trigger?.isConnected ? trigger.getBoundingClientRect?.() : null;
  if (sourceRect?.width && sourceRect?.height) {
    overlay.classList.add('has-shared-origin');
    const panel = overlay.firstElementChild;
    const target = panel?.getBoundingClientRect?.();
    if (target?.width && target?.height) {
      panel.style.setProperty('--ck-origin-x', (sourceRect.left + sourceRect.width / 2 - target.left) + 'px');
      panel.style.setProperty('--ck-origin-y', (sourceRect.top + sourceRect.height / 2 - target.top) + 'px');
    }
  }
  const removeNow = overlay.remove;
  let leaving = false;
  const animatedRemove = () => {
    if (leaving) return;
    if (!overlay.isConnected || (typeof cockpitMotionEnabled === 'function' && !cockpitMotionEnabled(options.owner))) { removeNow.call(overlay); return; }
    leaving = true;
    if (!cockpitAnimateSurfaceExit(overlay, overlay.firstElementChild, overlay)) overlay.classList.add('is-leaving');
    setTimeout(() => removeNow.call(overlay), COCKPIT_MODAL_LEAVE_MS);
  };
  overlay.remove = animatedRemove;
  if (typeof overlay.detach === 'function') overlay.detach = animatedRemove;
  return overlay;
}
