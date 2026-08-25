// search.js — Spotlight 风格的 Vault 全局搜索

function normalizeSearchQuery(rawQuery) {
  return String(rawQuery || '').trim().toLowerCase();
}

// 统一搜索的待办来源：文本包含即命中，未完成的排在前面。
function matchSearchTodos(rawTodos, rawQuery) {
  const query = normalizeSearchQuery(rawQuery);
  if (!query || !Array.isArray(rawTodos)) return [];
  return rawTodos
    .filter((todo) => todo && typeof todo.text === 'string')
    .map((todo) => ({ todo, at:todo.text.toLowerCase().indexOf(query) }))
    .filter((item) => item.at >= 0)
    .sort((a, b) => Number(a.todo.done) - Number(b.todo.done) || a.at - b.at)
    .slice(0, 8)
    .map((item) => ({
      kind:'todo',
      todoId:item.todo.id,
      name:item.todo.text,
      sub:item.todo.done ? 'done' : 'todo',
      count:1,
      score:90 - item.at
    }));
}

function rankSearchFiles(files, rawQuery) {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return [];
  return files
    .map((file) => {
      const name = file.basename.toLowerCase();
      const path = file.path.toLowerCase();
      let score = 0;
      if (name === query) score = 120;
      else if (name.startsWith(query)) score = 100;
      else if (name.includes(query)) score = 80;
      else if (path.includes(query)) score = 40;
      return { file, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.file.stat.mtime - a.file.stat.mtime || a.file.path.localeCompare(b.file.path))
    .map((item) => item.file);
}

class CockpitGlobalSearchModal extends obs.Modal {
  constructor(app, language, view) {
    super(app);
    this.language = language || DEFAULT_LANG;
    this.view = view || null;
    this._cursor = 0;
    this._results = [];
    this._timer = null;
    this._queryVersion = 0;
    this._contentCache = new Map();
    this._queryCache = new Map();
  }

  _text(cn, en) { return this.language === 'en' ? en : cn; }

  onOpen() {
    this.modalEl.addClass(PLUGIN_ID + '-spotlight-modal');
    this.contentEl.empty();
    const box = this.contentEl.createDiv({ cls: PLUGIN_ID + '-spotlight' });
    const dragBar = box.createDiv({ cls: PLUGIN_ID + '-spotlight-dragbar', attr: { title: this._text('拖动搜索窗口', 'Drag search window') } });
    obs.setIcon(dragBar.createSpan(), 'grip-horizontal');
    this._bindDrag(dragBar);
    const searchRow = box.createDiv({ cls: PLUGIN_ID + '-spotlight-input-row' });
    obs.setIcon(searchRow.createSpan({ cls: PLUGIN_ID + '-spotlight-icon' }), 'search');
    this.input = searchRow.createEl('input', {
      cls: PLUGIN_ID + '-spotlight-input',
      attr: { type: 'text', placeholder: this._text('搜索待办、笔记内容、文件名或路径…', 'Search todos, notes, content, or paths…') }
    });
    this.hint = box.createDiv({ cls: PLUGIN_ID + '-spotlight-hint', text: this._text('↑↓ 选择 · Enter 打开 · ⌘↵ 分栏 · ⌘⇧C 复制 · ⌘P 收藏', '↑↓ select · Enter open · ⌘↵ split · ⌘⇧C copy · ⌘P pin') });
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
    const query = normalizeSearchQuery(rawQuery);
    if (version !== this._queryVersion) return;
    if (!query) { this._results = []; this._renderEmpty(); return; }
    const files = this.app.vault.getMarkdownFiles();
    const cached = this._queryCache.get(query);
    if (cached) {
      this._results = cached;
      this._cursor = 0;
      this.hint.setText(this._text('↑↓ 选择 · Enter 打开 · Esc 关闭', '↑↓ select · Enter open · Esc close'));
      this._renderResults();
      return;
    }
    let named = rankSearchFiles(files, query);
    const seen = new Set(named.map((file) => file.path));
    // 统一搜索：待办命中排最前。待办本体存在 TODO_FILE 里，正文搜索会再次翻出这个
    // 文件造成重复 —— 有待办命中时把该文件从文件名与正文结果中去重。
    const todoResults = matchSearchTodos(this.view?._todos, query);
    if (todoResults.length) { seen.add(TODO_FILE); named = named.filter((file) => file.path !== TODO_FILE); }
    const results = todoResults
      .concat(named.slice(0, 20).map((file, index) => ({ file, match: '', count:1, kind:'name', score: 120 - index })));
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
          const cacheKey = file.path + ':' + file.stat.mtime;
          let content = this._contentCache.get(cacheKey);
          if (content === undefined) {
            content = await this.app.vault.cachedRead(file);
            this._contentCache.set(cacheKey, content);
          }
          const lowered = content.toLowerCase();
          const pos = lowered.indexOf(query);
          if (pos >= 0) {
            const start = Math.max(0, pos - 42);
            const end = Math.min(content.length, pos + query.length + 72);
            let count = 0, cursor = 0;
            while ((cursor = lowered.indexOf(query, cursor)) >= 0 && count < 999) { count++; cursor += Math.max(1, query.length); }
            results.push({ file, match: content.slice(start, end).replace(/\s+/g, ' ').trim(), count, kind:'body', score: 1 });
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
    this._queryCache.set(query, this._results);
    if (this._queryCache.size > 24) this._queryCache.delete(this._queryCache.keys().next().value);
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
      this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-empty', text: this._text('没有找到匹配的待办或笔记', 'No matching todos or notes') });
      return;
    }
    let previousKind = '';
    const query = normalizeSearchQuery(this.input?.value);
    const groupLabel = (kind) => kind === 'todo' ? this._text('待办命中', 'Todo matches')
      : kind === 'name' ? this._text('文件名命中', 'Filename matches')
      : this._text('正文命中', 'Content matches');
    const kindIcon = (result, kind) => {
      if (kind === 'todo') return result.sub === 'done' ? '✅' : '🔲';
      return kind === 'name' ? '📄' : '📝';
    };
    this._results.forEach((result, index) => {
      const kind = result.kind || (result.match ? 'body' : 'name');
      if (kind !== previousKind) {
        const count = this._results.filter((item) => (item.kind || (item.match ? 'body' : 'name')) === kind).length;
        const header = this.resultsEl.createDiv({ cls:PLUGIN_ID + '-spotlight-group' });
        header.createSpan({ text:groupLabel(kind) });
        header.createSpan({ cls:PLUGIN_ID + '-spotlight-group-count', text:String(count) });
        previousKind = kind;
      }
      const row = this.resultsEl.createDiv({ cls: PLUGIN_ID + '-spotlight-result is-' + kind + (index === this._cursor ? ' selected' : '') });
      row.createDiv({ cls:PLUGIN_ID + '-spotlight-kindicon', text:kindIcon(result, kind) });
      const copy = row.createDiv({ cls: PLUGIN_ID + '-spotlight-copy' });
      const displayName = kind === 'todo' ? result.name : result.file.basename;
      const displayPath = kind === 'todo'
        ? (result.sub === 'done' ? this._text('已完成待办 · 点击编辑', 'Done todo · click to edit') : this._text('未完成待办 · 点击编辑', 'Open todo · click to edit'))
        : (result.match || result.file.path);
      this._appendHighlighted(copy.createDiv({ cls: PLUGIN_ID + '-spotlight-name' }), displayName, query);
      this._appendHighlighted(copy.createDiv({ cls: PLUGIN_ID + '-spotlight-path' }), displayPath, query);
      // 右侧徽章：正文命中显示次数，待办显示状态；文件名命中不放冗余徽章。
      if (kind === 'body' && Number(result.count) > 1) row.createSpan({ cls:PLUGIN_ID + '-spotlight-badge is-count', text:'×' + result.count });
      else if (kind === 'todo') row.createSpan({ cls:PLUGIN_ID + '-spotlight-badge ' + (result.sub === 'done' ? 'is-done' : 'is-open'), text:result.sub === 'done' ? this._text('已完成', 'Done') : this._text('进行中', 'Open') });
      row.onclick = () => this._openResult(result);
    });
  }

  _appendHighlighted(target, text, query) {
    const value = String(text || '');
    if (!query) { target.setText(value); return; }
    let cursor = 0; const lower = value.toLowerCase();
    while (cursor < value.length) {
      const index = lower.indexOf(query, cursor);
      if (index < 0) { target.appendText(value.slice(cursor)); break; }
      if (index > cursor) target.appendText(value.slice(cursor, index));
      target.createEl('mark', { text:value.slice(index, index + query.length) });
      cursor = index + query.length;
    }
  }

  _onKeydown(evt) {
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();
      if (!this._results.length) return;
      this._cursor = (this._cursor + (evt.key === 'ArrowDown' ? 1 : -1) + this._results.length) % this._results.length;
      this._renderResults();
    } else if (evt.key === 'Enter' && this._results[this._cursor]) {
      evt.preventDefault(); this._openResult(this._results[this._cursor], evt.metaKey || evt.ctrlKey);
    } else if ((evt.metaKey || evt.ctrlKey) && evt.shiftKey && evt.key.toLowerCase() === 'c' && this._results[this._cursor]) {
      evt.preventDefault(); this._copyResult(this._results[this._cursor]);
    } else if ((evt.metaKey || evt.ctrlKey) && evt.key.toLowerCase() === 'p' && this._results[this._cursor]) {
      evt.preventDefault(); this._toggleBookmark(this._results[this._cursor]);
    }
  }

  async _copyResult(result) {
    if (!result.file) { new obs.Notice(this._text('待办不支持复制链接', 'Todos have no link to copy')); return; }
    try { await navigator.clipboard.writeText(`[[${result.file.path.replace(/\.md$/i, '')}]]`); new obs.Notice(this._text('已复制笔记链接', 'Note link copied')); } catch (e) { new obs.Notice(this._text('复制失败', 'Could not copy')); }
  }

  async _toggleBookmark(result) {
    if (!result.file) return;
    if (!this.view?._storage) { new obs.Notice(this._text('请从驾驶舱内打开搜索以使用收藏', 'Open search from Cockpit to pin files')); return; }
    if (this.view._bookmarks.has(result.file.path)) this.view._bookmarks.delete(result.file.path); else this.view._bookmarks.add(result.file.path);
    await this.view._storage.saveBookmarks(this.view._bookmarks);
    await this.view._saveBookmarkOrder?.();
    new obs.Notice(this.view._bookmarks.has(result.file.path) ? this._text('已收藏', 'Pinned') : this._text('已取消收藏', 'Unpinned'));
  }

  _openResult(result, split = false) {
    // 待办命中：打开待办编辑器而不是文件。
    if (result.kind === 'todo') {
      if (this.view?._openTodoEditorRef) { this.close(); this.view._openTodoEditorRef({ id:result.todoId }); }
      else new obs.Notice(this._text('请先打开驾驶舱面板', 'Open the dashboard first'));
      return;
    }
    const leaf = split ? this.app.workspace.getLeaf('split', 'vertical') : this.app.workspace.getUnpinnedLeaf();
    leaf.setViewState({ type: 'markdown', state: { file: result.file.path }, active:true });
    if (split) this.app.workspace.revealLeaf(leaf);
    this.close();
  }

  onClose() { clearTimeout(this._timer); this._queryVersion++; this.contentEl.empty(); }
}

function openGlobalSearch(app, language, view) { const dashboardView = view || app.workspace.getLeavesOfType?.(VIEW_TYPE)?.[0]?.view || null; new CockpitGlobalSearchModal(app, language, dashboardView).open(); }

// 保留旧入口，工具栏按钮现在打开同一套全局搜索。
function buildSearch(root, toolbar, allFiles, app, texts, view) {
  const searchBtn = toolbar.querySelector('.' + PLUGIN_ID + '-toolbtn[data-action="search"]');
  if (searchBtn) searchBtn.onclick = () => openGlobalSearch(app, texts && texts.language, view);
  return () => openGlobalSearch(app, texts && texts.language, view);
}
