// search.js — Spotlight 风格的 Vault 全局搜索

class CockpitGlobalSearchModal extends obsidian.Modal {
  constructor(app, language) {
    super(app);
    this.language = language || DEFAULT_LANG;
    this._cursor = 0;
    this._results = [];
    this._timer = null;
    this._queryVersion = 0;
  }

  _text(cn, en) { return this.language === 'en' ? en : cn; }

  onOpen() {
    this.modalEl.addClass(PLUGIN_ID + '-spotlight-modal');
    this.contentEl.empty();
    const box = this.contentEl.createDiv({ cls: PLUGIN_ID + '-spotlight' });
    const dragBar = box.createDiv({ cls: PLUGIN_ID + '-spotlight-dragbar', attr: { title: this._text('拖动搜索窗口', 'Drag search window') } });
    obsidian.setIcon(dragBar.createSpan(), 'grip-horizontal');
    this._bindDrag(dragBar);
    const searchRow = box.createDiv({ cls: PLUGIN_ID + '-spotlight-input-row' });
    obsidian.setIcon(searchRow.createSpan({ cls: PLUGIN_ID + '-spotlight-icon' }), 'search');
    this.input = searchRow.createEl('input', {
      cls: PLUGIN_ID + '-spotlight-input',
      attr: { type: 'text', placeholder: this._text('搜索笔记内容、文件名或路径…', 'Search notes, content, or paths…') }
    });
    this.hint = box.createDiv({ cls: PLUGIN_ID + '-spotlight-hint', text: this._text('输入关键词 · ↑↓ 选择 · Enter 打开 · Esc 关闭', 'Type to search · ↑↓ select · Enter open · Esc close') });
    this.resultsEl = box.createDiv({ cls: PLUGIN_ID + '-spotlight-results' });
    this.input.addEventListener('input', () => {
      clearTimeout(this._timer);
      // 输入一变化就使正在进行的正文扫描失效，再对下一次搜索做防抖。
      const version = ++this._queryVersion;
      this.hint.setText(this._text('继续输入以缩小范围…', 'Keep typing to narrow results…'));
      this._timer = setTimeout(() => this._search(this.input.value, version), 280);
    });
    this.input.addEventListener('keydown', (evt) => this._onKeydown(evt));
    this.input.focus();
    this._renderEmpty();
  }

  _bindDrag(handle) {
    let drag = null;
    const move = (evt) => {
      if (!drag || evt.pointerId !== drag.pointerId) return;
      const maxLeft = Math.max(8, window.innerWidth - drag.width - 8);
      const maxTop = Math.max(8, window.innerHeight - drag.height - 8);
      this.modalEl.style.left = Math.max(8, Math.min(maxLeft, drag.left + evt.clientX - drag.x)) + 'px';
      this.modalEl.style.top = Math.max(8, Math.min(maxTop, drag.top + evt.clientY - drag.y)) + 'px';
    };
    const end = (evt) => {
      if (!drag || evt.pointerId !== drag.pointerId) return;
      drag = null;
      handle.classList.remove('dragging');
      try { handle.releasePointerCapture(evt.pointerId); } catch (e) {}
    };
    handle.addEventListener('pointerdown', (evt) => {
      if (evt.button !== 0) return;
      const rect = this.modalEl.getBoundingClientRect();
      this.modalEl.style.position = 'fixed';
      this.modalEl.style.left = rect.left + 'px';
      this.modalEl.style.top = rect.top + 'px';
      this.modalEl.style.margin = '0';
      this.modalEl.style.transform = 'none';
      drag = { pointerId: evt.pointerId, x: evt.clientX, y: evt.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      handle.classList.add('dragging');
      handle.setPointerCapture(evt.pointerId);
      evt.preventDefault();
    });
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  async _search(rawQuery, version) {
    const query = rawQuery.trim().toLowerCase();
    if (version !== this._queryVersion) return;
    if (!query) { this._results = []; this._renderEmpty(); return; }
    const files = this.app.vault.getMarkdownFiles();
    const named = files.filter((file) => (file.basename + ' ' + file.path).toLowerCase().includes(query));
    const seen = new Set(named.map((file) => file.path));
    const results = named.slice(0, 20).map((file) => ({ file, match: '', score: 3 }));
    this.hint.setText(this._text('正在搜索笔记内容…', 'Searching note content…'));
    this._results = results;
    this._cursor = 0;
    this._renderResults();

    // 内容搜索在一次输入后只运行一次，结果随扫描渐进出现；避免每次键入都阻塞界面。
    for (let index = 0; index < files.length; index++) {
      if (version !== this._queryVersion) return;
      const file = files[index];
      if (!seen.has(file.path)) {
        try {
          const content = await this.app.vault.cachedRead(file);
          const pos = content.toLowerCase().indexOf(query);
          if (pos >= 0) {
            const start = Math.max(0, pos - 42);
            const end = Math.min(content.length, pos + query.length + 72);
            results.push({ file, match: content.slice(start, end).replace(/\s+/g, ' ').trim(), score: 1 });
            seen.add(file.path);
          }
        } catch (e) {}
      }
      if (index % 24 === 0) {
        this._results = results.slice(0, 40);
        this._renderResults();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }
    if (version !== this._queryVersion) return;
    this._results = results.slice(0, 40);
    this.hint.setText(this._text('↑↓ 选择 · Enter 打开 · Esc 关闭', '↑↓ select · Enter open · Esc close'));
    this._renderResults();
  }

  _renderEmpty() {
    this.resultsEl.empty();
    this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-empty', text: this._text('搜索整个 Vault', 'Search your entire vault') });
  }

  _renderResults() {
    this.resultsEl.empty();
    if (!this._results.length) {
      this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-empty', text: this._text('没有找到匹配的笔记', 'No matching notes found') });
      return;
    }
    this._results.forEach((result, index) => {
      const row = this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-result' + (index === this._cursor ? ' selected' : '') });
      const copy = row.createDiv({ cls: PLUGIN_ID + '-spotlight-copy' });
      copy.createDiv({ cls: PLUGIN_ID + '-spotlight-name', text: result.file.basename });
      copy.createDiv({ cls: PLUGIN_ID + '-spotlight-path', text: result.match || result.file.path });
      row.onclick = () => this._openResult(result);
    });
  }

  _onKeydown(evt) {
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();
      if (!this._results.length) return;
      this._cursor = (this._cursor + (evt.key === 'ArrowDown' ? 1 : -1) + this._results.length) % this._results.length;
      this._renderResults();
    } else if (evt.key === 'Enter' && this._results[this._cursor]) {
      evt.preventDefault(); this._openResult(this._results[this._cursor]);
    }
  }

  _openResult(result) {
    this.app.workspace.getUnpinnedLeaf().setViewState({ type: 'markdown', state: { file: result.file.path } });
    this.close();
  }

  onClose() { clearTimeout(this._timer); this._queryVersion++; this.contentEl.empty(); }
}

function openGlobalSearch(app, language) { new CockpitGlobalSearchModal(app, language).open(); }

// 保留旧入口，工具栏按钮现在打开同一套全局搜索。
function buildSearch(root, toolbar, allFiles, app, texts) {
  const searchBtn = toolbar.querySelector('.' + PLUGIN_ID + '-toolbtn[data-action="search"]');
  if (searchBtn) searchBtn.onclick = () => openGlobalSearch(app, texts && texts.language);
  return () => openGlobalSearch(app, texts && texts.language);
}
