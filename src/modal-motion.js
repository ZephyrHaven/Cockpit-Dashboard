// modal-motion.js — 二级弹窗统一的进入 / 退出动效。
// 宿主 Modal 子类继承 CockpitModal；自建遮罩层调用 cockpitAnimateOverlay(overlay)。
// 进入动画纯 CSS；退出时先播放收起动画再真正移除。系统开启“减少动态效果”时直接关闭。

const COCKPIT_MODAL_LEAVE_MS = 200;

function cockpitPrefersReducedMotion() {
  try { return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true; }
  catch (e) { return false; }
}

class CockpitModal extends obs.Modal {
  open() {
    this._cockpitLeaving = false;
    const result = super.open();
    this.containerEl?.classList?.add(PLUGIN_ID + '-modal-motion');
    return result;
  }
  close() {
    const container = this.containerEl;
    if (this._cockpitLeaving) return;
    if (!container?.isConnected || !container.classList || cockpitPrefersReducedMotion()) return super.close();
    this._cockpitLeaving = true;
    container.classList.add('is-leaving');
    setTimeout(() => {
      container.classList.remove('is-leaving');
      super.close();
      this._cockpitLeaving = false;
    }, COCKPIT_MODAL_LEAVE_MS);
  }
}

// 自建遮罩层：只替换这一个元素实例的 remove / detach，调用方原有的关闭逻辑无需改动。
function cockpitAnimateOverlay(overlay) {
  if (!overlay || overlay._cockpitMotion || typeof overlay.remove !== 'function' || !overlay.classList?.add) return overlay;
  overlay._cockpitMotion = true;
  overlay.classList.add(PLUGIN_ID + '-motion-overlay');
  const removeNow = overlay.remove;
  let leaving = false;
  const animatedRemove = () => {
    if (leaving) return;
    if (!overlay.isConnected || cockpitPrefersReducedMotion()) { removeNow.call(overlay); return; }
    leaving = true;
    overlay.classList.add('is-leaving');
    setTimeout(() => removeNow.call(overlay), COCKPIT_MODAL_LEAVE_MS);
  };
  overlay.remove = animatedRemove;
  if (typeof overlay.detach === 'function') overlay.detach = animatedRemove;
  return overlay;
}
