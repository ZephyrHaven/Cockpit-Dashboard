// tip-store.js — 每日提示的私有配置与编辑器

const TIP_LIBRARY_VERSION = 2;
const TIP_LANGUAGES = ['zh-CN', 'en'];
const TIP_LIMIT = 200;
const TIP_TEXT_LIMIT = 1000;
const TIP_ROTATION_MODES = ['custom-first', 'custom-only', 'defaults-only'];

function cloneDefaultTipLibrary() {
  return Object.fromEntries(TIP_LANGUAGES.map((lang) => [lang, [...(DEFAULT_DAILY_TIPS[lang] || [])]]));
}

function cleanTipList(values) {
  return (Array.isArray(values) ? values : []).map((value) => String(value ?? '').trim()).filter(Boolean).slice(0, TIP_LIMIT).map((value) => value.slice(0, TIP_TEXT_LIMIT));
}

function rotateTipLibrary(tips, offset) {
  return tips.map((_, index) => tips[(index - offset + tips.length) % tips.length]);
}

function normalizeTipRotationMode(mode) {
  return TIP_ROTATION_MODES.includes(mode) ? mode : 'custom-first';
}

class CockpitTipStore {
  constructor(plugin) { this.plugin = plugin; }

  async load() {
    const data = await this.plugin.loadData() || {};
    const defaults = cloneDefaultTipLibrary();
    const rawTips = data.tipLibrary?.mode === 'custom' && data.tipLibrary.tips && typeof data.tipLibrary.tips === 'object' ? data.tipLibrary.tips : {};
    const rotationStarts = data.tipLibrary?.mode === 'custom' && data.tipLibrary.rotationStarts && typeof data.tipLibrary.rotationStarts === 'object' ? data.tipLibrary.rotationStarts : {};
    const featuredTips = data.tipLibrary?.mode === 'custom' && data.tipLibrary.featuredTips && typeof data.tipLibrary.featuredTips === 'object' ? data.tipLibrary.featuredTips : {};
    const rotationMode = normalizeTipRotationMode(data.tipLibrary?.rotationMode);
    const editable = {};
    const display = {};
    let migratedRotationStart = false;
    const rotationStartUpdates = {};
    TIP_LANGUAGES.forEach((lang) => {
      const custom = cleanTipList(rawTips[lang]);
      editable[lang] = custom.length ? custom : [...defaults[lang]];
      const sequence = rotationMode === 'defaults-only' || !custom.length ? defaults[lang] : rotationMode === 'custom-only' ? custom : [...custom, ...defaults[lang]];
      const startDay = Number.isInteger(rotationStarts[lang]) ? rotationStarts[lang] : window.moment().dayOfYear();
      if (custom.length && !Number.isInteger(rotationStarts[lang])) { rotationStarts[lang] = startDay; rotationStartUpdates[lang] = startDay; migratedRotationStart = true; }
      display[lang] = custom.length && rotationMode !== 'defaults-only' ? rotateTipLibrary(sequence, startDay % sequence.length) : [...defaults[lang]];
      const featured = featuredTips[lang];
      if (custom.length && rotationMode !== 'defaults-only' && featured?.date === window.moment().format('YYYY-MM-DD') && typeof featured.text === 'string') {
        display[lang][window.moment().dayOfYear() % display[lang].length] = featured.text;
      }
    });
    if (migratedRotationStart) {
      await this.plugin.mutateData((latest) => {
        if (latest.tipLibrary?.mode !== 'custom') return;
        const latestTips = latest.tipLibrary.tips && typeof latest.tipLibrary.tips === 'object' ? latest.tipLibrary.tips : {};
        const latestStarts = latest.tipLibrary.rotationStarts && typeof latest.tipLibrary.rotationStarts === 'object' ? latest.tipLibrary.rotationStarts : {};
        const mergedStarts = { ...latestStarts };
        Object.entries(rotationStartUpdates).forEach(([lang, startDay]) => {
          if (cleanTipList(latestTips[lang]).length && !Number.isInteger(mergedStarts[lang])) mergedStarts[lang] = startDay;
        });
        latest.tipLibrary = { ...latest.tipLibrary, rotationStarts:mergedStarts };
      });
    }
    return { display, editable, rotationMode };
  }

  async saveLanguage(lang, tips, rotationMode, featuredTip) {
    const cleaned = cleanTipList(tips);
    if (!cleaned.length) throw new Error('empty-tip-library');
    const featured = String(featuredTip || '').trim();
    await this.plugin.mutateData((data) => {
      const existing = data.tipLibrary?.mode === 'custom' && data.tipLibrary.tips && typeof data.tipLibrary.tips === 'object' ? data.tipLibrary.tips : {};
      const rotationStarts = data.tipLibrary?.mode === 'custom' && data.tipLibrary.rotationStarts && typeof data.tipLibrary.rotationStarts === 'object' ? data.tipLibrary.rotationStarts : {};
      const featuredTips = data.tipLibrary?.mode === 'custom' && data.tipLibrary.featuredTips && typeof data.tipLibrary.featuredTips === 'object' ? data.tipLibrary.featuredTips : {};
      data.tipLibrary = { mode:'custom', version:TIP_LIBRARY_VERSION, tips:{ ...existing, [lang]:cleaned }, rotationStarts:{ ...rotationStarts, [lang]:window.moment().dayOfYear() }, rotationMode:normalizeTipRotationMode(rotationMode), featuredTips:featured ? { ...featuredTips, [lang]:{ date:window.moment().format('YYYY-MM-DD'), text:featured } } : featuredTips };
    });
    return this.load();
  }

  async resetLanguage(lang) {
    await this.plugin.mutateData((data) => {
      const existing = data.tipLibrary?.mode === 'custom' && data.tipLibrary.tips && typeof data.tipLibrary.tips === 'object' ? { ...data.tipLibrary.tips } : {};
      const rotationStarts = data.tipLibrary?.mode === 'custom' && data.tipLibrary.rotationStarts && typeof data.tipLibrary.rotationStarts === 'object' ? { ...data.tipLibrary.rotationStarts } : {};
      const featuredTips = data.tipLibrary?.mode === 'custom' && data.tipLibrary.featuredTips && typeof data.tipLibrary.featuredTips === 'object' ? { ...data.tipLibrary.featuredTips } : {};
      delete existing[lang];
      delete rotationStarts[lang];
      delete featuredTips[lang];
      data.tipLibrary = Object.keys(existing).length ? { mode:'custom', version:TIP_LIBRARY_VERSION, tips:existing, rotationStarts, rotationMode:normalizeTipRotationMode(data.tipLibrary?.rotationMode), featuredTips } : { mode:'default', version:TIP_LIBRARY_VERSION };
    });
    return this.load();
  }
}

class CockpitTipLibraryModal extends obs.Modal {
  constructor(app, view) { super(app); this.view = view; this.activeLang = view._lang(); this.draft = [...(view._editableTips[this.activeLang] || [])]; this.rotationMode = view._tipRotationMode || 'custom-first'; this.draggedIndex = null; this.lastChangedTip = ''; }

  _copy() {
    const en = this.view._lang() === 'en';
    return en ? {
      title:'Manage daily tips', help:'You are editing the English tips. Drag rows to set their order.', rotation:'Rotation', customFirst:'Custom first, then defaults', customOnly:'Custom tips only', defaultsOnly:'Defaults only', add:'Add tip', remove:'Remove', cancel:'Cancel', save:'Save changes', reset:'Restore defaults', placeholder:'Enter a tip…', empty:'Add at least one tip before saving.', resetConfirm:'Restore the built-in English tips? Your custom tips will be replaced.', drag:'Drag to reorder'
    } : {
      title:'管理每日提示', help:'当前仅维护中文提示。可拖拽每行来调整展示顺序。', rotation:'轮询方式', customFirst:'用户提示优先，再展示默认提示', customOnly:'只轮询用户提示', defaultsOnly:'只使用默认提示', add:'新增提示', remove:'删除', cancel:'取消', save:'保存修改', reset:'恢复默认', placeholder:'输入一条提示…', empty:'请至少保留一条提示后再保存。', resetConfirm:'确定恢复内置中文提示吗？你编辑过的中文提示将被替换。', drag:'拖拽排序'
    };
  }

  onOpen() {
    this.modalEl.addClass(PLUGIN_ID + '-tip-library-modal');
    this.render();
    this._dragCleanup = makeCockpitModalDraggable(this, this.titleEl, this.view._lang() === 'en' ? 'Drag tip library' : '拖动每日提示库');
  }

  render() {
    const copy = this._copy();
    const { contentEl, titleEl } = this;
    titleEl.setText(copy.title); contentEl.empty();
    contentEl.createDiv({ cls:PLUGIN_ID + '-tip-library-help', text:copy.help });
    const rotation = contentEl.createDiv({ cls:PLUGIN_ID + '-tip-library-rotation' });
    rotation.createSpan({ text:copy.rotation });
    const rotationSelect = rotation.createEl('select', { cls:PLUGIN_ID + '-tip-library-rotation-select', attr:{ 'aria-label':copy.rotation } });
    [['custom-first', copy.customFirst], ['custom-only', copy.customOnly], ['defaults-only', copy.defaultsOnly]].forEach(([value, label]) => { const option = rotationSelect.createEl('option', { text:label }); option.value = value; });
    rotationSelect.value = this.rotationMode;
    rotationSelect.onchange = () => { this.rotationMode = normalizeTipRotationMode(rotationSelect.value); };
    const list = contentEl.createDiv({ cls:PLUGIN_ID + '-tip-library-list' });
    this.draft.forEach((value, index) => {
      const row = list.createDiv({ cls:PLUGIN_ID + '-tip-library-row', attr:{ draggable:'true' } });
      row.createEl('button', { cls:PLUGIN_ID + '-tip-library-drag', text:'⠿', attr:{ type:'button', title:copy.drag, 'aria-label':copy.drag } });
      row.createSpan({ cls:PLUGIN_ID + '-tip-library-index', text:String(index + 1) });
      const input = row.createEl('textarea', { cls:PLUGIN_ID + '-tip-library-input', attr:{ rows:'2', maxlength:String(TIP_TEXT_LIMIT), placeholder:copy.placeholder, 'aria-label':copy.placeholder } });
      input.value = value;
      input.oninput = () => { this.draft[index] = input.value; this.lastChangedTip = input.value; };
      const remove = row.createEl('button', { cls:PLUGIN_ID + '-tip-library-remove', text:'×', attr:{ type:'button', 'aria-label':copy.remove, title:copy.remove } });
      remove.onclick = () => { this.draft.splice(index, 1); this.render(); };
      row.ondragstart = (evt) => { this.draggedIndex = index; row.classList.add('is-dragging'); evt.dataTransfer.effectAllowed = 'move'; };
      row.ondragend = () => { this.draggedIndex = null; row.classList.remove('is-dragging'); list.querySelectorAll('.' + PLUGIN_ID + '-tip-library-row').forEach((item) => item.classList.remove('is-drop-target')); };
      row.ondragover = (evt) => { if (this.draggedIndex == null || this.draggedIndex === index) return; evt.preventDefault(); row.classList.add('is-drop-target'); };
      row.ondragleave = () => row.classList.remove('is-drop-target');
      row.ondrop = (evt) => { evt.preventDefault(); const from = this.draggedIndex; if (from == null || from === index) return; const [moved] = this.draft.splice(from, 1); this.draft.splice(index, 0, moved); this.draggedIndex = null; this.render(); };
    });
    const add = contentEl.createEl('button', { cls:PLUGIN_ID + '-tip-library-add', text:'＋ ' + copy.add, attr:{ type:'button' } });
    add.onclick = () => { this._listScrollTop = list.scrollTop; this.draft.push(''); this._focusNewTip = true; this.render(); };
    if (this._focusNewTip) {
      this._focusNewTip = false;
      requestAnimationFrame(() => {
        const inputs = list.querySelectorAll('.' + PLUGIN_ID + '-tip-library-input');
        const input = inputs[inputs.length - 1];
        if (!input) return;
        list.scrollTop = list.scrollHeight;
        input.focus();
      });
    } else if (typeof this._listScrollTop === 'number') {
      list.scrollTop = this._listScrollTop;
      this._listScrollTop = undefined;
    }
    const actions = contentEl.createDiv({ cls:PLUGIN_ID + '-tip-library-actions' });
    const reset = actions.createEl('button', { cls:PLUGIN_ID + '-tip-library-reset', text:copy.reset, attr:{ type:'button' } });
    const cancel = actions.createEl('button', { text:copy.cancel, attr:{ type:'button' } });
    const save = actions.createEl('button', { cls:'mod-cta', text:copy.save, attr:{ type:'button' } });
    reset.onclick = async () => { if (!window.confirm(copy.resetConfirm)) return; const state = await this.view._tipStore.resetLanguage(this.activeLang); this.view._dailyTips = state.display; this.view._editableTips = state.editable; this.view._tipRotationMode = state.rotationMode; this.view._refreshTipSection(); this.close(); };
    cancel.onclick = () => this.close();
    save.onclick = async () => {
      if (!this.draft.some((tip) => String(tip || '').trim())) { new obs.Notice(copy.empty); return; }
      const state = await this.view._tipStore.saveLanguage(this.activeLang, this.draft, this.rotationMode, this.lastChangedTip);
      this.view._dailyTips = state.display;
      this.view._editableTips = state.editable;
      this.view._tipRotationMode = state.rotationMode;
      this.view._refreshTipSection();
      this.close();
    };
  }

  onClose() { this._dragCleanup?.(); this._dragCleanup = null; this.contentEl.empty(); }
}
