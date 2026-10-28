// ai-dialogs.js — Agent 授权、会话重命名与删除确认对话框。

class CockpitAgentConfirmationModal extends CockpitModal {
  constructor(app, tool, language, resolve) {
    super(app); this.tool = tool; this.language = language; this.resolveResult = resolve; this.settled = false;
  }
  _finish(value) { if (this.settled) return; this.settled = true; this.resolveResult(['once','session','always'].includes(value) ? value : 'deny'); this.close(); }
  onOpen() {
    const en = this.language === 'en';
    this.modalEl.addClass(PLUGIN_ID + '-ai-tool-confirm-modal');
    this.titleEl.setText(en ? 'Allow Cockpit Agent action?' : '允许 Cockpit Agent 执行？');
    const body = this.contentEl.createDiv({ cls:PLUGIN_ID + '-ai-tool-confirm' });
    const summary = body.createDiv({ cls:PLUGIN_ID + '-ai-tool-confirm-summary' });
    const icon = summary.createSpan({ cls:PLUGIN_ID + '-ai-tool-confirm-icon' }); obs.setIcon(icon, 'shield-check');
    const copy = summary.createDiv();
    copy.createEl('strong', { text:this.tool?.label || this.tool?.name || (en ? 'Agent action' : 'Agent 操作') });
    const review = buildAgentToolReview(this.tool, this.language);
    copy.createEl('p', { text:review.description });
    if (review.target) {
      const target = body.createDiv({ cls:PLUGIN_ID + '-ai-tool-confirm-target' });
      target.createSpan({ text:en ? 'Target' : '目标' });
      target.createEl('code', { text:review.target });
    }
    review.sections.forEach((section) => {
      const block = body.createDiv({ cls:PLUGIN_ID + '-ai-tool-review-section' + (section.tone ? ' is-' + section.tone : '') });
      block.createEl('strong', { text:section.title });
      const preview = block.createEl('pre');
      if (section.tone === 'diff') section.text.split('\n').forEach((line, index, lines) => {
        const tone = line.startsWith('+++') || line.startsWith('---') ? 'header'
          : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'context';
        preview.createSpan({ cls:PLUGIN_ID + '-ai-tool-review-line is-' + tone, text:line + (index < lines.length - 1 ? '\n' : '') });
      });
      else preview.setText(section.text);
      if (section.truncated) {
        const expand = block.createEl('button', { cls:PLUGIN_ID + '-ai-tool-review-expand', attr:{ type:'button' }, text:en
          ? `Showing ${section.text.length} of ${section.length} characters · Show all`
          : `显示 ${section.text.length} / ${section.length} 个字符 · 查看完整内容` });
        expand.onclick = () => { preview.setText(section.fullText); expand.remove(); };
      }
    });
    body.createEl('p', { cls:PLUGIN_ID + '-ai-tool-confirm-boundary', text:en
      ? 'Persistent approval is limited to fixed-purpose, low-risk actions. Commands and arbitrary file writes always require a fresh confirmation.'
      : '永久授权仅适用于固定用途的低风险操作；命令与任意文件写入始终需要重新确认。' });
    const actions = body.createDiv({ cls:PLUGIN_ID + '-ai-tool-confirm-actions' });
    const cancel = actions.createEl('button', { attr:{ type:'button' }, text:en ? 'Deny' : '拒绝' });
    const allow = actions.createEl('button', { cls:'mod-cta', attr:{ type:'button' }, text:en ? 'Allow once' : '仅允许本次' });
    cancel.onclick = () => this._finish('deny'); allow.onclick = () => this._finish('once');
    if (this.tool?.maxGrant === 'session' || this.tool?.maxGrant === 'always') {
      const session = actions.createEl('button', { attr:{ type:'button' }, text:en ? 'Allow for this conversation' : '本会话允许' });
      session.onclick = () => this._finish('session');
    }
    if (this.tool?.maxGrant === 'always') {
      const always = actions.createEl('button', { attr:{ type:'button' }, text:en ? 'Always allow this action' : '始终允许此操作' });
      always.onclick = () => this._finish('always');
    }
    window.setTimeout(() => cancel.focus(), 0);
  }
  onClose() { this.contentEl.empty(); if (!this.settled) { this.settled = true; this.resolveResult('deny'); } }
}

class CockpitAISessionNameModal extends CockpitModal {
  constructor(app, currentTitle, language, onSave) { super(app); this.currentTitle = currentTitle; this.language = language; this.onSave = onSave; }
  onOpen() {
    const en = this.language === 'en';
    this.titleEl.setText(en ? 'Rename conversation' : '重命名对话');
    const input = this.contentEl.createEl('input', { cls:PLUGIN_ID + '-ai-session-name-input', attr:{ type:'text', maxlength:'60', 'aria-label':en ? 'Conversation title' : '对话标题' } });
    input.value = this.currentTitle || '';
    const actions = this.contentEl.createDiv({ cls:PLUGIN_ID + '-ai-session-modal-actions' });
    const cancel = actions.createEl('button', { text:en ? 'Cancel' : '取消' });
    const save = actions.createEl('button', { cls:'mod-cta', text:en ? 'Save' : '保存' });
    const submit = async () => { const value = input.value.trim(); if (!value) return; await this.onSave(value); this.close(); };
    cancel.onclick = () => this.close(); save.onclick = submit;
    input.onkeydown = (event) => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(); } };
    window.setTimeout(() => { input.focus(); input.select(); }, 0);
  }
  onClose() { this.contentEl.empty(); }
}

class CockpitAISessionDeleteModal extends CockpitModal {
  constructor(app, title, language, onDelete) { super(app); this.sessionTitle = title; this.language = language; this.onDelete = onDelete; }
  onOpen() {
    const en = this.language === 'en';
    this.titleEl.setText(en ? 'Delete conversation?' : '删除这段对话？');
    this.contentEl.createEl('p', { text:en
      ? `“${this.sessionTitle}” will be removed from local AI history. This cannot be undone.`
      : `“${this.sessionTitle}”将从本地 AI 历史中移除，此操作无法撤销。` });
    const actions = this.contentEl.createDiv({ cls:PLUGIN_ID + '-ai-session-modal-actions' });
    const cancel = actions.createEl('button', { text:en ? 'Cancel' : '取消' });
    const remove = actions.createEl('button', { cls:'mod-warning', text:en ? 'Delete' : '删除' });
    cancel.onclick = () => this.close(); remove.onclick = async () => { await this.onDelete(); this.close(); };
    window.setTimeout(() => cancel.focus(), 0);
  }
  onClose() { this.contentEl.empty(); }
}
