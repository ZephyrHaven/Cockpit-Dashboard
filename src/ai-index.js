// ai-index.js — 自动 RAG 的本地关键词倒排索引。
// 只保存“词元 → 笔记引用”的映射，不存笔记正文；查询时先取候选笔记，再做 chunk 级精排，
// 避免每次发送都全库读取与扫描。索引随 Vault 事件增量更新，并可持久化快照到插件目录。
//
// 规模约束：每篇进入倒排的词元数按库大小自适应，全库 posting 总量与堆占用有上界；
// 快照用增量编码，真实规模的库也能落盘——否则每次启动都要全量重建，表现为界面假死。

const AI_INDEX_LIMITS = Object.freeze({
  maxFiles:6000,
  maxQueryTerms:40,
  // 单篇参与分词的最大字符数：超出部分对“主题代表性”贡献极小。
  maxScanCharsPerFile:80000,
  // 单篇最多处理多少个词元位置（含重复），避免超长笔记长时间占用主线程。
  maxTokensPerFile:2000,
  // 单篇进入倒排的词元上限（上限值）；实际预算按库大小下调，见 _termBudgetFor。
  maxTermsPerFile:200,
  minTermsPerFile:40,
  // 全库 posting 总量上限：约 24 万条时堆占用约 40-60MB，不再随笔记数线性膨胀。
  maxPostings:240000,
  candidateLimit:12,
  maxSerializedChars:8000000,
  saveDebounceMs:4000,
  // 每个空闲切片内允许占用的主线程毫秒数：宁可建得慢，也不能拖累交互。
  idleBudgetMs:6,
  progressIntervalMs:400
});

const AI_INDEX_STOPWORDS = new Set(['the','and','for','with','from','this','that','what','when','where','how','about','please','into','your']);

function isProtectedAiIndexPath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return path === '_data/team-todos.md' || path === '.obsidian' || path.startsWith('.obsidian/') || path === '.trash' || path.startsWith('.trash/');
}

// 分词：拉丁词元 + 中日韩文本的双字组合（含 ≤10 字短串本身）。
// 返回 { counts:Map<词元,出现次数>, truncated:boolean }，供倒排与查询两端共用。
function collectAiIndexTerms(value) {
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

function rankAiIndexTerms(counts, limit = AI_INDEX_LIMITS.maxTermsPerFile) {
  // 出现次数多的词元更能代表笔记主题；次数相同时保持首次出现顺序，保证结果稳定。
  const cap = Math.max(1, Math.floor(Number(limit) || AI_INDEX_LIMITS.maxTermsPerFile));
  return Array.from(counts.entries())
    .map(([term, count], order) => ({ term, count, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, cap)
    .map((item) => item.term);
}

// 空闲调度：优先 requestIdleCallback（带超时兜底），不可用时退化为宏任务。
function nextAiIndexSlot() {
  if (typeof requestIdleCallback === 'function') {
    return new Promise((resolve) => { requestIdleCallback(() => resolve(), { timeout:250 }); });
  }
  return new Promise((resolve) => setTimeout(resolve, 16));
}

class CockpitAiSearchIndex {
  constructor(plugin) {
    this.plugin = plugin;
    this.postings = new Map();   // 词元 -> Set(文档ID)
    this.docs = new Map();       // 文档ID -> { path, mtime, size }
    this.docTerms = new Map();   // 文档ID -> Set(词元)
    this.pathToId = new Map();   // 路径 -> 文档ID
    this.termBudget = AI_INDEX_LIMITS.maxTermsPerFile;
    this.ready = false;
    this.buildPromise = null;
    this._nextId = 1;
    this._queue = [];
    this._queued = new Set();
    this._draining = false;
    this._saveTimer = null;
    this._lastProgressAt = 0;
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
  _termBudgetFor(fileCount) {
    const count = Math.max(1, Math.floor(Number(fileCount) || 1));
    const perFile = Math.floor(AI_INDEX_LIMITS.maxPostings / count);
    return Math.max(AI_INDEX_LIMITS.minTermsPerFile, Math.min(AI_INDEX_LIMITS.maxTermsPerFile, perFile));
  }
  _addDocument(id, path, stat, content) {
    const limit = this.termBudget;
    // 开头部分（标题、开头几段）承载主题信息，单独留出配额；
    // 其余配额给正文里重复出现的词，兼顾“具体短语命中”和“主题词命中”。
    const introQuota = Math.min(80, Math.max(16, Math.floor(limit * 0.4)));
    const introTerms = rankAiIndexTerms(collectAiIndexTerms(String(content || '').slice(0, 1200)).counts, introQuota);
    const bodyTerms = rankAiIndexTerms(collectAiIndexTerms(content).counts, limit);
    const terms = Array.from(new Set([...introTerms, ...bodyTerms])).slice(0, limit);
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
  async updateFile(input, options = {}) {
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
      if (doc && doc.mtime === mtime && doc.size === size && options.force !== true) return false;
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
        if (this._queue.length) await nextAiIndexSlot();
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
  _throwIfStopped(signal) {
    if (this._disposed) throw new Error('AI index disposed');
    if (signal?.aborted) throw new Error('Aborted');
  }
  // 已落盘快照可能落后于离线改动：只比对元数据，把变化的笔记交给增量队列，不重建。
  _reconcile() {
    const vault = this.plugin?.app?.vault;
    const files = vault?.getMarkdownFiles?.() || [];
    const changed = [];
    files.forEach((file) => {
      if (!file || file.extension !== 'md' || isProtectedAiIndexPath(file.path)) return;
      const id = this.pathToId.get(file.path);
      if (id == null) { if (this.docs.size + changed.length < AI_INDEX_LIMITS.maxFiles) changed.push(file.path); return; }
      const doc = this.docs.get(id);
      if (!doc || doc.mtime !== (Number(file.stat?.mtime) || 0) || doc.size !== (Number(file.stat?.size) || 0)) changed.push(file.path);
    });
    changed.slice(0, 200).forEach((path) => this.queuePath(path));
  }
  async _build(options = {}) {
    this._throwIfStopped(options.signal);
    if (await this._tryLoad()) { this.ready = true; this._reconcile(); return true; }
    const vault = this.plugin?.app?.vault;
    if (!vault) return false;
    const files = (vault.getMarkdownFiles?.() || [])
      .filter((file) => file?.extension === 'md' && !isProtectedAiIndexPath(file.path))
      .sort((a, b) => Number(b?.stat?.mtime || 0) - Number(a?.stat?.mtime || 0))
      .slice(0, AI_INDEX_LIMITS.maxFiles);
    this.termBudget = this._termBudgetFor(files.length);
    let deadline = 0;
    let lastProgress = 0;
    for (let offset = 0; offset < files.length; offset++) {
      this._throwIfStopped(options.signal);
      const now = Date.now();
      if (now >= deadline) {
        await nextAiIndexSlot();
        deadline = Date.now() + AI_INDEX_LIMITS.idleBudgetMs;
      }
      try { await this.updateFile(files[offset]); } catch (error) { /* 单篇失败不影响整体 */ }
      const at = Date.now();
      if (options.onProgress && at - lastProgress >= AI_INDEX_LIMITS.progressIntervalMs) {
        lastProgress = at;
        options.onProgress({ indexed:offset + 1, total:files.length });
      }
    }
    this.ready = true;
    this.scheduleSave();
    options.onProgress?.({ indexed:files.length, total:files.length });
    return true;
  }
  recentPaths(limit = AI_INDEX_LIMITS.candidateLimit) {
    return Array.from(this.docs.values())
      .sort((a, b) => (Number(b?.mtime) || 0) - (Number(a?.mtime) || 0))
      .slice(0, Math.max(1, Math.floor(Number(limit) || AI_INDEX_LIMITS.candidateLimit)))
      .map((doc) => doc.path);
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
      return this.recentPaths(limit).map((path) => {
        const doc = this.docs.get(this.pathToId.get(path));
        return { path, score:this._recencyBoost(doc, now) };
      });
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
  // 快照格式 v2：文件按位置编号、词元表与增量编码的 posting 分开存放。
  // 同样的索引内容比 v1 的 {term: [id...]} 小 60% 以上，真实规模的库才不会超限。
  serialize() {
    if (!this.ready || !this.docs.size) return null;
    const order = Array.from(this.docs.keys()).sort((a, b) => a - b);
    const files = [];
    const positionById = new Map();
    order.forEach((id) => {
      const doc = this.docs.get(id);
      files.push([id, doc.path, doc.mtime, doc.size]);
      positionById.set(id, files.length);
    });
    const records = [];
    this.postings.forEach((set, term) => {
      if (!set.size) return;
      const positions = Array.from(set).map((id) => positionById.get(id)).filter((pos) => pos > 0).sort((a, b) => a - b);
      if (!positions.length) return;
      let prev = 0;
      const parts = positions.map((pos) => { const delta = pos - prev; prev = pos; return delta.toString(36); });
      records.push({ term, text:parts.join(','), df:positions.length });
    });
    const head = { v:2, nextId:this._nextId, files };
    const budget = AI_INDEX_LIMITS.maxSerializedChars;
    const terms = [];
    const postings = [];
    // 兜底：posting 预算已经限制了总量，正常情况下不会触发截断；
    // 真触发时按入库顺序保留（越早入库的笔记越新），整体仍然可用。
    let used = JSON.stringify({ ...head, terms:[], postings:[] }).length + 64;
    for (const record of records) {
      const cost = record.term.length + record.text.length + 6;
      if (used + cost > budget) break;
      used += cost;
      terms.push(record.term);
      postings.push(record.text);
    }
    return JSON.stringify({ ...head, terms, postings });
  }
  _adopt(raw) {
    if (!raw || typeof raw !== 'object') return false;
    if (raw.v === 2 && Array.isArray(raw.files) && Array.isArray(raw.terms) && Array.isArray(raw.postings)) {
      const docs = new Map();
      const idsByPosition = new Map();
      let maxId = 0;
      for (const row of raw.files) {
        if (!Array.isArray(row) || row.length < 4) return false;
        if (!Number.isInteger(row[0])) return false;
        const position = idsByPosition.size + 1;
        const id = Number(row[0]);
        const path = String(row[1] || '');
        idsByPosition.set(position, id);
        if (id < 1 || !path || docs.has(id) || isProtectedAiIndexPath(path)) continue;
        docs.set(id, { path, mtime:Number(row[2]) || 0, size:Number(row[3]) || 0 });
        maxId = Math.max(maxId, id);
      }
      if (!docs.size || docs.size > AI_INDEX_LIMITS.maxFiles) return false;
      const postings = new Map();
      raw.terms.forEach((term, index) => {
        if (typeof term !== 'string' || !term) return;
        const encoded = String(raw.postings[index] || '');
        if (!encoded) return;
        const set = new Set();
        let prev = 0;
        encoded.split(',').forEach((part) => {
          const delta = parseInt(part, 36);
          if (!Number.isInteger(delta) || delta <= 0) return;
          prev += delta;
          const id = idsByPosition.get(prev);
          if (id != null) set.add(id);
        });
        if (set.size) postings.set(term, set);
      });
      this.postings = postings;
      this.docs = docs;
      this._rebuildTermMaps();
      this._nextId = Math.max(maxId + 1, Number(raw.nextId) || 1);
      this.termBudget = this._termBudgetFor(docs.size);
      return true;
    }
    return this._adoptLegacy(raw);
  }
  _adoptLegacy(raw) {
    if (!raw || raw.v !== 1 || !raw.files || !raw.post) return false;
    const entries = Object.entries(raw.files);
    if (!entries.length || entries.length > AI_INDEX_LIMITS.maxFiles) return false;
    const docs = new Map();
    for (const [key, value] of entries) {
      const id = Number(key);
      const path = String(value?.p || '');
      if (!Number.isInteger(id) || id < 1 || !path || docs.has(id)) return false;
      if (isProtectedAiIndexPath(path)) continue;
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
    this._rebuildTermMaps();
    this._nextId = Math.max(1, Number(raw.nextId) || (docs.size + 1));
    return true;
  }
  _rebuildTermMaps() {
    this.docTerms = new Map();
    this.pathToId = new Map();
    this.docs.forEach((doc, id) => { this.pathToId.set(doc.path, id); this.docTerms.set(id, new Set()); });
    this.postings.forEach((set, term) => set.forEach((id) => { this.docTerms.get(id)?.add(term); }));
  }
  async _tryLoad() {
    const adapter = this._adapter();
    try {
      if (!adapter || !(await adapter.exists(this.storagePath))) return false;
      const content = String(await adapter.read(this.storagePath) || '');
      if (!content.length) return false;
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
  module.exports = { AI_INDEX_LIMITS, collectAiIndexTerms, rankAiIndexTerms, CockpitAiSearchIndex };
}
