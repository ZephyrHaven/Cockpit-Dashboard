// 会话结束的轻雾提示层。宿主 Modal 负责焦点约束、键盘关闭和焦点还原。
class PomodoroReminderModal extends obs.Modal {
  constructor(app, options) { super(app); this.options = options; this._pomoEnteredFullscreen = false; this._pomoClosed = false; }
  onOpen() {
    const opts = this.options, en = opts.language === 'en';
    this.containerEl.classList.add(PLUGIN_ID + '-pomo-reminder-container');
    this.containerEl.classList.add(opts.fullscreen ? 'is-fullscreen' : 'is-half-sheet');
    this.modalEl.classList.add(PLUGIN_ID + '-pomo-reminder');
    this.contentEl.empty();
    const content = this.contentEl;
    content.createDiv({ cls:PLUGIN_ID + '-pomo-reminder-eyebrow', text:en ? 'A MOMENT TO RESET' : '给自己一点呼吸的时间' });
    const heading = content.createEl('h2', { text:opts.isBreak ? (en ? 'Rested and ready.' : '休息好了，再出发。') : (en ? 'One good session.' : '这一轮，完成了。') });
    heading.id = PLUGIN_ID + '-pomo-reminder-title';
    this.modalEl.setAttribute('role', 'alertdialog');
    this.modalEl.setAttribute('aria-modal', 'true');
    this.modalEl.setAttribute('aria-labelledby', heading.id);
    const amount = content.createDiv({ cls:PLUGIN_ID + '-pomo-reminder-amount' });
    amount.createSpan({ text:String(opts.minutes) });
    amount.createSpan({ text:en ? 'MIN' : '分钟' });
    content.createEl('p', { cls:PLUGIN_ID + '-pomo-reminder-note', text:opts.remark || (opts.isBreak ? (en ? 'Ready when you are.' : '准备好了，就开始下一轮。') : (en ? 'Take a break, or keep your flow.' : '去休息一下，或继续下一轮专注。')) });
    const actions = content.createDiv({ cls:PLUGIN_ID + '-pomo-reminder-actions' });
    const primary = actions.createEl('button', { text:opts.isBreak ? (en ? 'Start next round' : '开始下一轮') : (en ? 'Take a 5-minute break' : '去休息 5 分钟'), cls:'primary', attr:{type:'button'} });
    const secondary = actions.createEl('button', { text:opts.isBreak ? (en ? 'Later' : '稍后再开始') : (en ? 'Continue next round' : '继续下一轮'), attr:{type:'button'} });
    let selected = false;
    const choose = (callback) => {
      if (selected || this._pomoClosed) return;
      selected = true; this._pomoSelected = true; this.close(); callback?.();
    };
    primary.onclick = () => choose(opts.onPrimary);
    secondary.onclick = () => choose(opts.onSecondary);
    primary.focus();
    if (opts.fullscreen && !document.fullscreenElement && document.documentElement?.requestFullscreen) {
      try { Promise.resolve(document.documentElement.requestFullscreen({navigationUI:'hide'})).then(() => {
        this._pomoEnteredFullscreen = true;
        if (this._pomoClosed) this.exitFullscreen();
      }).catch(() => {}); } catch (_) {}
    }
  }
  exitFullscreen() {
    if (this._pomoEnteredFullscreen && document.fullscreenElement === document.documentElement) {
      try { Promise.resolve(document.exitFullscreen?.()).catch(() => {}); } catch (_) {}
    }
    this._pomoEnteredFullscreen = false;
  }
  onClose() {
    if (this._pomoClosed) return;
    this._pomoClosed = true; this.exitFullscreen(); this.contentEl.empty(); this.options.onDismiss?.(!!this._pomoSelected);
  }
}
