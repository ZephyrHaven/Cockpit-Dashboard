// ui-dialogs.js — 应用内的确认与文本输入对话框，替代 window.confirm / window.prompt。
// 全部走 CockpitModal，自动继承玻璃主题与进入/退出动效；Promise 只结算一次。

function cockpitDialogLang(target) {
  try {
    if (typeof target?._lang === 'function') return target._lang();
    if (target?.language === 'en') return 'en';
  } catch (e) {}
  return 'zh-CN';
}
function cockpitDialogCopy(target, cn, en) { return cockpitDialogLang(target) === 'en' ? en : cn; }

class CockpitDialogModal extends CockpitModal {
  constructor(app, options) {
    super(app);
    this.options = options || {};
    this._settled = false;
    this._resolve = null;
    this.result = this.options.kind === 'prompt' ? null : false;
    this.promise = new Promise((resolve) => { this._resolve = resolve; });
  }
  _settle(value) {
    if (this._settled) return;
    this._settled = true;
    this._resolve(value);
  }
  _finish(value) { this._settle(value); this.close(); }
  open() {
    this._settled = false;
    this.result = this.options.kind === 'prompt' ? null : false;
    return super.open();
  }
  onOpen() {
    const o = this.options;
    const lang = o.language || cockpitDialogLang(o.target);
    const copy = (cn, en) => lang === 'en' ? en : cn;
    const { contentEl } = this;
    contentEl.addClass(PLUGIN_ID + '-dialog-modal');
    if (o.danger) contentEl.addClass(PLUGIN_ID + '-dialog-danger');
    const heading = contentEl.createEl('h2', { text:o.title || copy('确认操作', 'Confirm') });
    if (typeof makeCockpitModalDraggable === 'function') {
      this._dragCleanup = makeCockpitModalDraggable(this, heading, copy('拖动对话框', 'Drag dialog'));
    }
    if (o.message) contentEl.createDiv({ cls:PLUGIN_ID + '-dialog-message', text:o.message });
    if (o.detail) contentEl.createDiv({ cls:PLUGIN_ID + '-dialog-detail', text:o.detail });
    let input = null;
    if (o.kind === 'prompt') {
      const field = contentEl.createEl('label', { cls:PLUGIN_ID + '-dialog-field' });
      if (o.inputLabel) field.createSpan({ cls:PLUGIN_ID + '-dialog-field-label', text:o.inputLabel });
      input = field.createEl('input', {
        cls:PLUGIN_ID + '-dialog-input',
        attr:{ type:'text', maxlength:String(o.maxLength || 120), placeholder:o.placeholder || '', value:o.defaultValue || '' }
      });
      input.value = o.defaultValue || '';
    }
    const actions = contentEl.createDiv({ cls:PLUGIN_ID + '-dialog-actions' });
    const cancel = actions.createEl('button', { text:o.cancelText || copy('取消', 'Cancel'), attr:{ type:'button' } });
    const confirm = actions.createEl('button', {
      cls:'mod-cta' + (o.danger ? ' ' + PLUGIN_ID + '-dialog-confirm-danger' : ''),
      text:o.confirmText || copy('确定', 'Confirm'),
      attr:{ type:'button' }
    });
    const submit = () => {
      if (o.kind === 'prompt') {
        const value = input.value.trim();
        if (!value && !o.allowEmpty) { input.focus(); return; }
        this._finish(value);
      } else this._finish(true);
    };
    cancel.onclick = () => this._finish(o.kind === 'prompt' ? null : false);
    confirm.onclick = submit;
    input?.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') { evt.preventDefault(); submit(); }
      if (evt.key === 'Escape') { evt.preventDefault(); this._finish(null); }
    });
    setTimeout(() => (input || confirm).focus(), 40);
  }
  onClose() {
    this._settle(this.options.kind === 'prompt' ? null : false);
    this._dragCleanup?.();
    this._dragCleanup = null;
    this.contentEl.empty();
  }
}

function cockpitConfirm(target, message, options = {}) {
  if (typeof message === 'object' && message) { options = message; message = options.message; }
  const app = target?.app || target;
  if (!app) return Promise.resolve(false);
  const lang = options.language || cockpitDialogLang(target);
  const modal = new CockpitDialogModal(app, {
    ...options,
    target,
    kind:'confirm',
    message,
    title:options.title || (lang === 'en' ? 'Confirm' : '确认操作')
  });
  modal.open();
  return modal.promise;
}

function cockpitPrompt(target, message, defaultValue = '', options = {}) {
  if (typeof message === 'object' && message) { options = message; defaultValue = options.defaultValue || ''; message = options.message; }
  const app = target?.app || target;
  if (!app) return Promise.resolve(null);
  const lang = options.language || cockpitDialogLang(target);
  const modal = new CockpitDialogModal(app, {
    ...options,
    target,
    kind:'prompt',
    message,
    defaultValue:defaultValue || '',
    title:options.title || (lang === 'en' ? 'Enter a value' : '输入内容')
  });
  modal.open();
  return modal.promise;
}
