// ai-index.js — 自动 RAG 的本地关键词倒排索引。
// 只保存“词元 → 笔记引用”的映射，不存笔记正文；查询时先取候选笔记，再做 chunk 级精排，
// 避免每次发送都全库读取与扫描。索引随 Vault 事件增量更新，并可持久化快照到插件目录。

const AI_INDEX_LIMITS = Object.freeze({
  maxFiles:6000,
  maxQueryTerms:40,
  maxTokensPerFile:4000,
  maxTermsPerFile:1500,
  candidateLimit:12,
  readBatchSize:4,
  // 单篇参与分词的最大字符数：超出部分对“主题代表性”贡献极小。
  maxScanCharsPerFile:200000,
  maxSerializedChars:3000000,
  saveDebounceMs:4000,
  // 批间让出主线程的毫秒数：后台建索引必须给 UI 与其他任务留足空间，
  // 宁可建得慢一点也不能拖累交互。每次让出期间至多读一小批文件。
  yieldMs:40
});

const AI_INDEX_STOPWORDS = new Set(['the','and','for','with','from','this','that','what','when','where','how','about','please','into','your']);

function isProtectedAiIndexPath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return path === '.obsidian' || path.startsWith('.obsidian/') || path === '.trash' || path.startsWith('.trash/');
}

// 分词：拉丁词元 + 中日韩文本的双字组合（含 ≤10 字短串本身）。
// 返回 { counts:Map<词元,出现次数>, truncated:boolean }，供倒排与查询两端共用。
function collectAiIndexTerms(value) {
  // 长文截断：分词只看开头一段已足够代表主题；避免超大笔记长时间占用主线程。
  const text = String(value || '').normalize('NFKC').toLocaleLowerCase().slice(0, AI_INDEX_LIMITS.maxScanCharsPerFile);
  const counts = new Map();
  let seen = 0;
  let truncated = false;
  const bump = (term) => {
    if (!term || term.length < 2 || term.length > 24 || AI_INDEX_STOPWORDS.has(term)) return;
    if (seen >= AI_INDEX_LIMITS.maxTokensPerFile) { truncated = true; return; }
    seen += 1;
    counts.set(term, (counts.get(term) || 0) + 1);
  };
  const latin = /[a-z0-9][a-z0-9_-]+/g;
  let match;
  while ((match = latin.exec(text))) bump(match[0]);
  const cjk = /[\u3400-\u9fff]+/g;
  while ((match = cjk.exec(text))) {
    const run = match[0];
    if (run.length <= 10) bump(run);
    // 已截断时立即停止：避免超长中文段落继续做无效的双字切片。
    for (let index = 0; !truncated && index + 1 < run.length; index++) bump(run.slice(index, index + 2));
    if (truncated) break;
  }
  return { counts, truncated };
}

function rankAiIndexTerms(counts) {
  // 出现次数多的词元更能代表笔记主题；次数相同时保持首次出现顺序，保证结果稳定。
  return Array.from(counts.entries())
    .map(([term, count], order) => ({ term, count, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, AI_INDEX_LIMITS.maxTermsPerFile)
    .map((item) => item.term);
}

function yieldToAiIndexQueue() { return new Promise((resolve) => setTimeout(resolve, AI_INDEX_LIMITS.yieldMs)); }

class CockpitAiSearchIndex {
  constructor(plugin) {
    this.plugin = plugin;
    this.postings = new Map();   // 词元 -> Set(文档ID)
    this.docs = new Map();       // 文档ID -> { path, mtime, size }
    this.docTerms = new Map();   // 文档ID -> Set(词元)
    this.pathToId = new Map();   // 路径 -> 文档ID
    this.ready = false;
    this.buildPromise = null;
    this._nextId = 1;
    this._queue = [];
    this._queued = new Set();
    this._draining = false;
    this._saveTimer = null;
    this._disposed = false;
  }
  get storagePath() {
    const configDir = String(this.plugin?.app?.vault?.configDir || '.obsidian').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const pluginId = typeof PLUGIN_ID === 'string' ? PLUGIN_ID : 'cockpit-dashboard';
    return configDir + '/plugins/' + pluginId + '/ai-index.json';
  }
  _adapter() { return this.plugin?.app?.vault?.adapter || null; }
  dispose() {
    this._disposed = true;
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
  }
  _addDocument(id, path, stat, content) {
    const counts = collectAiIndexTerms(content).counts;
    const terms = rankAiIndexTerms(counts);
    this.docTerms.set(id, new Set(terms));
    terms.forEach((term) => {
      let set = this.postings.get(term);
      if (!set) { set = new Set(); this.postings.set(term, set); }
      set.add(id);
    });
    this.docs.set(id, { path, mtime:Number(stat?.mtime) || 0, size:Number(stat?.size) || 0 });
    this.pathToId.set(path, id);
  }
  _removeDocument(id) {
    const terms = this.docTerms.get(id);
    if (terms) terms.forEach((term) => {
      const set = this.postings.get(term);
      if (!set) return;
      set.delete(id);
      if (!set.size) this.postings.delete(term);
    });
    this.docTerms.delete(id);
    const doc = this.docs.get(id);
    if (doc) this.pathToId.delete(doc.path);
    this.docs.delete(id);
  }
  async updateFile(input) {
    const vault = this.plugin?.app?.vault;
    if (!vault) return false;
    const file = typeof input === 'string' ? vault.getAbstractFileByPath?.(input) : input;
    const path = String(typeof input === 'string' ? input : file?.path || '').replace(/\\/g, '/');
    if (!file || !path || file.extension !== 'md' || isProtectedAiIndexPath(path)) return false;
    const mtime = Number(file.stat?.mtime) || 0;
    const size = Number(file.stat?.size) || 0;
    const existingId = this.pathToId.get(path);
    if (existingId != null) {
      const doc = this.docs.get(existingId);
      if (doc && doc.mtime === mtime && doc.size === size) return false;
      this._removeDocument(existingId);
    }
    if (this.docs.size >= AI_INDEX_LIMITS.maxFiles && existingId == null) return false;
    const content = String(await (typeof vault.cachedRead === 'function' ? vault.cachedRead(file) : vault.read(file)) || '');
    this._addDocument(existingId != null ? existingId : this._nextId++, path, { mtime, size }, content);
    this.scheduleSave();
    return true;
  }
  removePath(value) {
    const path = String(value || '').replace(/\\/g, '/');
    const id = this.pathToId.get(path);
    if (id == null) return false;
    this._removeDocument(id);
    this.scheduleSave();
    return true;
  }
  renamePath(oldPath, newPath) {
    const id = this.pathToId.get(String(oldPath || '').replace(/\\/g, '/'));
    if (id == null) return this.queuePath(newPath);
    const doc = this.docs.get(id);
    if (doc) { this.pathToId.delete(doc.path); doc.path = String(newPath || '').replace(/\\/g, '/'); this.pathToId.set(doc.path, id); }
    return true;
  }
  queuePath(value) {
    const path = String(value || '').replace(/\\/g, '/');
    if (!path || !/\.md$/i.test(path) || isProtectedAiIndexPath(path) || this._queued.has(path)) return false;
    this._queued.add(path);
    this._queue.push(path);
    this._drain();
    return true;
  }
  async _drain() {
    if (this._draining) return;
    this._draining = true;
    try {
      while (this._queue.length) {
        const path = this._queue.shift();
        this._queued.delete(path);
        try { await this.updateFile(path); } catch (error) { console.warn('Cockpit AI index update failed', error); }
        if (this._queue.length) await yieldToAiIndexQueue();
      }
    } finally { this._draining = false; }
  }
  async ensure(options = {}) {
    if (this.ready) return true;
    if (this.buildPromise) return this.buildPromise;
    this.buildPromise = this._build(options).finally(() => { this.buildPromise = null; });
    return this.buildPromise;
  }
  warmUp() { this.ensure().catch((error) => console.warn('Cockpit AI index warm-up failed', error)); }
  async _build(options = {}) {
    const signal = options.signal;
    if (signal?.aborted) throw new Error('Aborted');
    if (await this._tryLoad()) { this.ready = true; return true; }
    const vault = this.plugin?.app?.vault;
    if (!vault) return false;
    const files = (vault.getMarkdownFiles?.() || [])
      .filter((file) => file?.extension === 'md' && !isProtectedAiIndexPath(file.path))
      .sort((a, b) => Number(b?.stat?.mtime || 0) - Number(a?.stat?.mtime || 0))
      .slice(0, AI_INDEX_LIMITS.maxFiles);
    for (let offset = 0; offset < files.length; offset += AI_INDEX_LIMITS.readBatchSize) {
      if (signal?.aborted) throw new Error('Aborted');
      const batch = files.slice(offset, offset + AI_INDEX_LIMITS.readBatchSize);
      await Promise.all(batch.map(async (file) => {
        try { await this.updateFile(file); } catch (error) { /* 单篇失败不影响整体 */ }
      }));
      options.onProgress?.({ indexed:Math.min(files.length, offset + batch.length), total:files.length });
      if (offset + batch.length < files.length) await yieldToAiIndexQueue();
    }
    this.ready = true;
    this.scheduleSave();
    return true;
  }
  query(queryText, options = {}) {
    const limit = Math.max(1, Math.min(AI_INDEX_LIMITS.candidateLimit, Math.floor(Number(options.limit)) || AI_INDEX_LIMITS.candidateLimit));
    const now = Number(options.now) || Date.now();
    const terms = Array.from(collectAiIndexTerms(queryText).counts.keys()).slice(0, AI_INDEX_LIMITS.maxQueryTerms);
    const scores = new Map();
    terms.forEach((term) => {
      const set = this.postings.get(term);
      if (!set?.size) return;
      // 稀有词元区分度高，权重更高；长词元比双字组合更可信。
      const weight = (1 + Math.min(term.length, 8) / 8) / Math.log2(2 + set.size);
      set.forEach((id) => scores.set(id, (scores.get(id) || 0) + weight));
    });
    const normalizedQuery = String(queryText || '').trim().toLocaleLowerCase();
    const results = [];
    scores.forEach((score, id) => {
      const doc = this.docs.get(id);
      if (!doc) return;
      let total = score;
      const lowerPath = doc.path.toLocaleLowerCase();
      if (normalizedQuery && lowerPath.includes(normalizedQuery)) total += 25;
      results.push({ path:doc.path, score:total + this._recencyBoost(doc, now), mtime:doc.mtime });
    });
    if (!results.length) {
      // 没有任何词元命中时退化为“最近修改”候选，保证 RAG 仍有可用上下文。
      Array.from(this.docs.values())
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit)
        .forEach((doc) => results.push({ path:doc.path, score:this._recencyBoost(doc, now), mtime:doc.mtime }));
      return results.slice(0, limit).map(({ path, score }) => ({ path, score }));
    }
    // 词元重叠相同时，最近修改的笔记优先（内容更新过的笔记更可能相关）。
    return results
      .sort((a, b) => b.score - a.score || b.mtime - a.mtime)
      .slice(0, limit)
      .map(({ path, score }) => ({ path, score }));
  }
  _recencyBoost(doc, now) {
    const ageDays = Math.max(0, (now - (Number(doc?.mtime) || 0)) / 86400000);
    return 2.5 * Math.exp(-ageDays / 21);
  }
  serialize() {
    if (!this.ready || !this.docs.size) return null;
    const files = {};
    this.docs.forEach((doc, id) => { files[id] = { p:doc.path, m:doc.mtime, s:doc.size }; });
    const post = {};
    this.postings.forEach((set, term) => { post[term] = Array.from(set); });
    const text = JSON.stringify({ v:1, nextId:this._nextId, files, post });
    if (text.length > AI_INDEX_LIMITS.maxSerializedChars) return null;
    return text;
  }
  _adopt(raw) {
    if (!raw || raw.v !== 1 || !raw.files || !raw.post) return false;
    const entries = Object.entries(raw.files);
    if (!entries.length || entries.length > AI_INDEX_LIMITS.maxFiles) return false;
    const docs = new Map();
    for (const [key, value] of entries) {
      const id = Number(key);
      const path = String(value?.p || '');
      if (!Number.isInteger(id) || id < 1 || !path || docs.has(id)) return false;
      docs.set(id, { path, mtime:Number(value?.m) || 0, size:Number(value?.s) || 0 });
    }
    const postings = new Map();
    for (const [term, ids] of Object.entries(raw.post)) {
      if (typeof term !== 'string' || !Array.isArray(ids)) continue;
      const set = new Set();
      ids.forEach((id) => { if (docs.has(Number(id))) set.add(Number(id)); });
      if (set.size) postings.set(term, set);
    }
    this.postings = postings;
    this.docs = docs;
    this.docTerms = new Map();
    this.pathToId = new Map();
    docs.forEach((doc, id) => { this.pathToId.set(doc.path, id); this.docTerms.set(id, new Set()); });
    postings.forEach((set, term) => set.forEach((id) => { this.docTerms.get(id)?.add(term); }));
    this._nextId = Math.max(1, Number(raw.nextId) || (docs.size + 1));
    return true;
  }
  async _tryLoad() {
    const adapter = this._adapter();
    try {
      if (!adapter || !(await adapter.exists(this.storagePath))) return false;
      const content = String(await adapter.read(this.storagePath) || '');
      if (!content.length || content.length > AI_INDEX_LIMITS.maxSerializedChars) return false;
      return this._adopt(JSON.parse(content));
    } catch (error) {
      console.warn('Cockpit: could not load AI search index', error);
      return false;
    }
  }
  scheduleSave() {
    if (this._disposed || this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._saveNow().catch(() => {});
    }, AI_INDEX_LIMITS.saveDebounceMs);
    if (typeof this._saveTimer.unref === 'function') this._saveTimer.unref();
  }
  async _saveNow() {
    const snapshot = this.serialize();
    const adapter = this._adapter();
    if (!snapshot || !adapter || this._disposed) return false;
    try { await adapter.write(this.storagePath, snapshot); return true; }
    catch (error) { console.warn('Cockpit: could not save AI search index', error); return false; }
  }
  async flushSave() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    return this._saveNow();
  }
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = { AI_INDEX_LIMITS, collectAiIndexTerms, CockpitAiSearchIndex };
}
