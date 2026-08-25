// rss.js — 日历 RSS 订阅：配置随插件同步，内容缓存在当前设备的 IndexedDB。

const RSS_DEFAULTS = { enabled:false, refreshMinutes:60, feeds:[] };
// 保留两个月，兼顾按日期回看与本机缓存上限；仍受总条数和 5 MB 双重约束。
const RSS_LIMITS = { perFeed:100, maxAgeDays:60, maxItems:500, maxBytes:5 * 1024 * 1024, summaryChars:12000 };
const RSS_FILTER_DEFAULT_TERMS = __RSS_FILTER_DEFAULTS__;
function normalizeRssFilterTerms(value, limit = 20) { return Array.from(new Set((Array.isArray(value) ? value : String(value || '').split(/[\n,，]/)).map((term) => String(term).trim().slice(0, 40)).filter(Boolean))).slice(0, limit); }

function normalizeRssConfig(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const feeds = Array.isArray(value.feeds) ? value.feeds.map((feed) => ({
    id: String(feed.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 48) || ('rss-' + Math.random().toString(36).slice(2, 10)),
    name: String(feed.name || '').trim().slice(0, 48) || 'RSS',
    url: String(feed.url || '').trim().slice(0, 1000),
    tags: Array.from(new Set((Array.isArray(feed.tags) ? feed.tags : []).map((tag) => String(tag).trim().slice(0, 24)).filter(Boolean))).slice(0, 8),
    color: /^#[0-9a-f]{6}$/i.test(feed.color || '') ? feed.color : '#818cf8',
    enabled: feed.enabled !== false,
    filterKeywords: normalizeRssFilterTerms(feed.filterKeywords, 12)
  })).filter((feed) => /^https?:\/\//i.test(feed.url)).slice(0, 20) : [];
  const filtering = value.filtering && typeof value.filtering === 'object' ? value.filtering : {};
  const feedIds = new Set(feeds.map((feed) => feed.id));
  const sharedKeywords = filtering.sharedKeywords !== undefined ? normalizeRssFilterTerms(filtering.sharedKeywords) : normalizeRssFilterTerms([...(filtering.builtinEnabled !== false ? RSS_FILTER_DEFAULT_TERMS : []), ...(filtering.globalKeywords || [])]);
  return { enabled:value.enabled === true, refreshMinutes:[0, 60, 360].includes(value.refreshMinutes) ? value.refreshMinutes : 60, autoPlayNextArticle:value.autoPlayNextArticle === true, feeds, filtering:{ sharedKeywords, globalFeedIds:Array.isArray(filtering.globalFeedIds) ? filtering.globalFeedIds.filter((id) => feedIds.has(id)) : [] } };
}

class CockpitRssService {
  constructor(plugin) { this.plugin = plugin; this.config = normalizeRssConfig(); this._dbPromise = null; this._items = []; this._lastRefresh = 0; }
  async initialize() { const data = await this.plugin.loadData() || {}; this.config = normalizeRssConfig(data.calendarRss); await this._loadCache(); return this.config; }
  async saveConfig(next) { const normalized = normalizeRssConfig(next); this.config = normalized; await this.plugin.mutateData((data) => { data.calendarRss = normalized; }); return this.config; }
  async _db() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(PLUGIN_ID + '-rss-cache', 1);
      request.onupgradeneeded = () => { const store = request.result.createObjectStore('items', { keyPath:'id' }); store.createIndex('publishedAt', 'publishedAt'); store.createIndex('feedId', 'feedId'); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return this._dbPromise;
  }
  async _loadCache() { try { const db = await this._db(); this._items = await new Promise((resolve, reject) => { const req = db.transaction('items').objectStore('items').getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error); }); await this._prune(); } catch (e) { console.warn('Cockpit RSS cache unavailable', e); this._items = []; } }
  async _writeCache(items) { try { const db = await this._db(); await new Promise((resolve, reject) => { const tx = db.transaction('items', 'readwrite'); const store = tx.objectStore('items'); store.clear(); items.forEach((item) => store.put(item)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); } catch (e) { console.warn('Cockpit RSS cache write failed', e); } }
  async _prune(persist = false) {
    const cutoff = Date.now() - RSS_LIMITS.maxAgeDays * 86400000;
    const perFeed = new Map(); let bytes = 0; let total = 0;
    const kept = this._items.slice().sort((a,b) => b.publishedAt - a.publishedAt).filter((item) => {
      const count = perFeed.get(item.feedId) || 0; const size = item.size || 0;
      if ((!item.savedAt && item.publishedAt < cutoff) || count >= RSS_LIMITS.perFeed || bytes + size > RSS_LIMITS.maxBytes || total >= RSS_LIMITS.maxItems) return false;
      perFeed.set(item.feedId, count + 1); bytes += size; total++; return true;
    }).slice(0, RSS_LIMITS.maxItems);
    const changed = kept.length !== this._items.length || kept.some((item, index) => item.id !== this._items[index]?.id); this._items = kept; if (persist || changed) await this._writeCache(kept);
  }
  itemsForDate(date) { const key = date.format('YYYY-MM-DD'); const active = new Set(this.config.feeds.filter((f) => f.enabled).map((f) => f.id)); return this._items.filter((item) => active.has(item.feedId) && window.moment(item.publishedAt).format('YYYY-MM-DD') === key); }
  allItems() { const active = new Set(this.config.feeds.filter((f) => f.enabled).map((f) => f.id)); return this._items.filter((item) => active.has(item.feedId)).sort((a,b) => b.publishedAt - a.publishedAt); }
  savedItems() { return this.allItems().filter((item) => !!item.savedAt); }
  unreadCountForDate(date) { return this.itemsForDate(date).filter((item) => !item.readAt).length; }
  async markRead(id) { const item = this._items.find((entry) => entry.id === id); if (!item || item.readAt) return false; item.readAt = Date.now(); await this._writeCache(this._items); return true; }
  async toggleSaved(id) { const item = this._items.find((entry) => entry.id === id); if (!item) return false; item.savedAt = item.savedAt ? 0 : Date.now(); await this._writeCache(this._items); return !!item.savedAt; }
  async updateProgress(id, progress) { const item = this._items.find((entry) => entry.id === id); if (!item) return false; const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0))); if (Math.abs(value - Number(item.readProgress || 0)) < 3 && value < 100) return false; item.readProgress = value; if (value > 0 && !item.readAt) item.readAt = Date.now(); await this._writeCache(this._items); return true; }
  getFeed(id) { return this.config.feeds.find((feed) => feed.id === id); }
  getFilterTerms(feedId) {
    const feed = this.getFeed(feedId); const filtering = this.config.filtering || {}; const globalApplies = !filtering.globalFeedIds?.length || filtering.globalFeedIds.includes(feedId);
    return normalizeRssFilterTerms([...(globalApplies ? (filtering.sharedKeywords || []) : []), ...(feed?.filterKeywords || [])], 50);
  }
  async refresh(force = false) {
    if (!this.config.enabled) return { refreshed:0, failed:0 };
    if (!force && this.config.refreshMinutes && Date.now() - this._lastRefresh < this.config.refreshMinutes * 60000) return { refreshed:0, failed:0, skipped:true };
    const feeds = this.config.feeds.filter((feed) => feed.enabled); const results = await Promise.allSettled(feeds.map((feed) => this._fetchFeed(feed)));
    const incoming = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
    const byId = new Map(this._items.map((item) => [item.id, item])); incoming.forEach((item) => { const previous = byId.get(item.id); byId.set(item.id, previous ? { ...item, readAt:previous.readAt || 0, savedAt:previous.savedAt || 0, readProgress:previous.readProgress || 0 } : item); }); this._items = Array.from(byId.values()); await this._prune(true); this._lastRefresh = Date.now();
    const failedFeeds = results.flatMap((result, index) => result.status === 'rejected' ? [feeds[index].name || feeds[index].url] : []);
    return { refreshed:results.filter((r) => r.status === 'fulfilled').length, failed:failedFeeds.length, failedFeeds };
  }
  async _fetchFeed(feed) {
    const response = await obs.requestUrl({ url:feed.url, method:'GET', headers:{ Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml' }, throw:false });
    if (response.status < 200 || response.status >= 300) throw new Error('HTTP ' + response.status);
    const doc = new DOMParser().parseFromString(response.text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('RSS 格式无效');
    return Array.from(doc.querySelectorAll('item, entry')).slice(0, RSS_LIMITS.perFeed).map((node, index) => {
      const read = (...names) => names.map((name) => node.querySelector(name)?.textContent || '').find(Boolean) || '';
      const title = read('title').trim() || '无标题'; const linkNode = node.querySelector('link[href]'); const link = (linkNode?.getAttribute('href') || read('link')).trim();
      const date = Date.parse(read('pubDate', 'published', 'updated', 'date')) || Date.now();
      const summary = read('content', 'content\\:encoded', 'description', 'summary').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, RSS_LIMITS.summaryChars);
      const key = read('guid', 'id').trim() || link || (title + '|' + date + '|' + index); const id = feed.id + ':' + Array.from(key).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0).toString(36);
      const item = { id, feedId:feed.id, title:title.slice(0, 500), link:link.slice(0, 1500), publishedAt:date, summary, size:0 }; item.size = JSON.stringify(item).length; return item;
    });
  }
  async clearCache(feedId) { this._items = feedId ? this._items.filter((item) => item.feedId !== feedId) : []; await this._writeCache(this._items); }
  cacheStats() { return { count:this._items.length, bytes:this._items.reduce((sum, item) => sum + (item.size || 0), 0) }; }
}

class CockpitRssModal extends obs.Modal {
  constructor(app, view, date) { super(app); this.view = view; this.date = date || window.moment(); this.selectedId = null; this.selectedFeedId = 'all'; this.selectedTag = 'all'; this.queueMode = 'date'; this.articleCache = new Map(); this._articleRequest = 0; this._dragCleanup = null; this._preserveListScroll = false; this._progressTimer = null; this._speech = { itemId:null, chunks:[], index:0, status:'idle', rate:1, token:0, playlist:[], autoStartNext:false }; this._speechChunks = new Map(); this._speechUi = null; this._wakeLock = null; this._wakeLockVisibilityHandler = null; }
  onOpen() { this.modalEl.addClass(PLUGIN_ID + '-rss-modal'); this.contentEl.addClass(PLUGIN_ID + '-rss-modal-content'); this._wakeLockVisibilityHandler = () => { if (document.visibilityState === 'visible' && this._speech.status === 'playing') this._requestScreenWakeLock(); else if (document.visibilityState !== 'visible') this._releaseScreenWakeLock(); }; document.addEventListener('visibilitychange', this._wakeLockVisibilityHandler); this.render(); }
  async _requestScreenWakeLock() {
    if (this._wakeLock || this._speech.status !== 'playing' || document.visibilityState !== 'visible' || !navigator.wakeLock?.request) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (this._speech.status !== 'playing' || document.visibilityState !== 'visible') { await lock.release(); return; }
      this._wakeLock = lock;
      lock.addEventListener?.('release', () => { if (this._wakeLock === lock) this._wakeLock = null; });
    } catch (e) { console.debug('Cockpit RSS: screen wake lock unavailable', e); }
  }
  async _releaseScreenWakeLock() {
    const lock = this._wakeLock; this._wakeLock = null;
    if (!lock) return;
    try { await lock.release(); } catch (e) {}
  }
  render() {
    const previousList = this.contentEl.querySelector('.' + PLUGIN_ID + '-rss-list'); const savedListScroll = this._preserveListScroll ? previousList?.scrollTop : null; this._preserveListScroll = false; const service = this.view._rss; const dateItems = service.itemsForDate(this.date); const allItems = this.queueMode === 'later' ? service.savedItems() : this.queueMode === 'unread' ? service.allItems().filter((item) => !item.readAt) : dateItems; const feedIds = Array.from(new Set(allItems.map((item) => item.feedId))); const tags = Array.from(new Set(allItems.flatMap((item) => service.getFeed(item.feedId)?.tags || []))).sort(); if (this.selectedFeedId !== 'all' && !feedIds.includes(this.selectedFeedId)) this.selectedFeedId = 'all'; if (this.selectedTag !== 'all' && !tags.includes(this.selectedTag)) this.selectedTag = 'all'; const items = allItems.filter((item) => (this.selectedFeedId === 'all' || item.feedId === this.selectedFeedId) && (this.selectedTag === 'all' || service.getFeed(item.feedId)?.tags?.includes(this.selectedTag))); const selected = items.find((item) => item.id === this.selectedId) || items[0]; this.selectedId = selected?.id || null; this._speech.playlist = items.map((item) => item.id); this.contentEl.empty();
    const head = this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-modal-head' }); head.createEl('h2', { text:(this.view._lang() === 'en' ? 'Subscriptions · ' : '订阅内容 · ') + this.date.format('YYYY-MM-DD') }); this._makeDraggable(head);
    const menuButton = head.createEl('button', { cls:PLUGIN_ID + '-rss-menu-button', text:'···', attr:{ type:'button', title:this.view._lang() === 'en' ? 'Subscription actions' : '订阅管理菜单', 'aria-label':this.view._lang() === 'en' ? 'Subscription actions' : '订阅管理菜单' } }); menuButton.onclick = (evt) => this._showMenu(evt); const activeItem = (this._speech.status === 'playing' || this._speech.status === 'paused') ? (allItems.find((item) => item.id === this._speech.itemId) || selected) : selected; const player = this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-global-player' }); const speechControls = activeItem ? this._createSpeechControls(player, activeItem) : null;
    const body = this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-reader' }); const list = body.createDiv({ cls:PLUGIN_ID + '-rss-list' }); const detail = body.createDiv({ cls:PLUGIN_ID + '-rss-detail' });
    const filters = list.createDiv({ cls:PLUGIN_ID + '-rss-filters' });
    const queues = filters.createDiv({ cls:PLUGIN_ID+'-rss-queue-tabs', attr:{ role:'tablist', 'aria-label':this.view._lang()==='en'?'Reading queue':'阅读队列' } });
    const addQueue = (id, label, count) => { const button=queues.createEl('button',{cls:PLUGIN_ID+'-rss-filter'+(this.queueMode===id?' active':''),attr:{type:'button',role:'tab','aria-selected':String(this.queueMode===id)}});button.createSpan({text:label});if(Number.isFinite(count))button.createSpan({cls:PLUGIN_ID+'-rss-filter-count',text:String(count)});button.onclick=()=>{this.queueMode=id;this.selectedFeedId='all';this.selectedTag='all';this.selectedId=null;this.render();};};
    addQueue('date', this.view._lang()==='en'?'Today':'当天', dateItems.length); addQueue('unread', this.view._lang()==='en'?'Unread':'未读', service.allItems().filter((item)=>!item.readAt).length); addQueue('later', this.view._lang()==='en'?'Later':'稍后读', service.savedItems().length);
    const filterRow = filters.createDiv({ cls:PLUGIN_ID+'-rss-filter-row' });
    const filterLabel = this.selectedFeedId !== 'all' ? service.getFeed(this.selectedFeedId)?.name : this.selectedTag !== 'all' ? '#' + this.selectedTag : (this.view._lang()==='en'?'All sources':'全部来源');
    const filterSelect = filterRow.createEl('select',{cls:PLUGIN_ID+'-rss-filter-select',attr:{'aria-label':this.view._lang()==='en'?'Filter source or tag':'筛选来源或标签'}});
    filterSelect.createEl('option',{text:this.view._lang()==='en'?'All sources':'全部来源',value:'all'});
    feedIds.forEach((id)=>{const feed=service.getFeed(id);filterSelect.createEl('option',{text:feed?.name||'RSS',value:'feed:'+id});});
    tags.forEach((tag)=>filterSelect.createEl('option',{text:'#'+tag,value:'tag:'+tag}));
    filterSelect.value=this.selectedFeedId!=='all'?'feed:'+this.selectedFeedId:this.selectedTag!=='all'?'tag:'+this.selectedTag:'all';
    filterSelect.title=filterLabel;
    filterSelect.onchange=()=>{const value=filterSelect.value;this.selectedFeedId=value.startsWith('feed:')?value.slice(5):'all';this.selectedTag=value.startsWith('tag:')?value.slice(4):'all';this.selectedId=null;this.render();};
    filterRow.createSpan({cls:PLUGIN_ID+'-rss-result-count',text:(this.view._lang()==='en'?items.length+' articles':items.length+' 篇')});
    if (!items.length) { const empty=detail.createDiv({ cls:PLUGIN_ID + '-rss-empty' }); empty.createDiv({cls:PLUGIN_ID+'-rss-empty-icon',text:this.queueMode==='later'?'☆':'○'}); empty.createDiv({cls:PLUGIN_ID+'-rss-empty-title',text:this.queueMode==='later'?(this.view._lang()==='en'?'Nothing saved for later':'还没有稍后读内容'):(this.queueMode==='unread'?(this.view._lang()==='en'?'You are all caught up':'未读内容已清空'):(this.view._lang()==='en'?'No entries for this date':'这一天没有订阅内容'))}); empty.createDiv({cls:PLUGIN_ID+'-rss-empty-help',text:this.view._lang()==='en'?'Use the queue tabs above to continue browsing.':'仍可使用左上方的队列页签切换浏览。'}); return; }
    items.forEach((item) => { const feed = service.getFeed(item.feedId); const row = list.createDiv({ cls:PLUGIN_ID + '-rss-card' + (item.id === selected.id ? ' active' : '') + (!item.readAt ? ' unread' : '') + (item.savedAt ? ' saved' : ''), attr:{ role:'button', tabindex:'0', style:'--rss-color:' + (feed?.color || '#818cf8') } }); const cardHead = row.createDiv({ cls:PLUGIN_ID + '-rss-card-head' }); cardHead.createDiv({ cls:PLUGIN_ID + '-rss-source', text:feed?.name || 'RSS' }); cardHead.createSpan({ cls:PLUGIN_ID + '-rss-read-state ' + (!item.readAt ? 'unread' : 'read'), text:item.savedAt ? '★ ' + (this.view._lang()==='en'?'Later':'稍后读') : !item.readAt ? (this.view._lang() === 'en' ? 'Unread' : '未读') : (this.view._lang() === 'en' ? 'Read' : '已读') }); row.createDiv({ cls:PLUGIN_ID + '-rss-row-title', text:item.title || '无标题' }); row.createDiv({ cls:PLUGIN_ID + '-rss-row-meta', text:window.moment(item.publishedAt).format('YYYY-MM-DD HH:mm') + (feed?.tags?.length ? ' · ' + feed.tags.map((tag) => '#' + tag).join(' ') : '') }); row.createDiv({ cls:PLUGIN_ID + '-rss-row-summary', text:item.summary || (this.view._lang() === 'en' ? 'No summary' : '无内容摘要') }); if (item.readProgress) { const progress=row.createDiv({cls:PLUGIN_ID+'-rss-row-progress'});progress.createDiv({attr:{style:'width:'+item.readProgress+'%'}}); } const choose = () => { this._preserveListScroll = true; this.selectedId = item.id; this.render(); }; row.onclick = choose; row.onkeydown = (evt) => { if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); choose(); } }; });
    const detailScroll = detail.createDiv({ cls:PLUGIN_ID + '-rss-detail-scroll' }); const articleFrame = detailScroll.createDiv({ cls:PLUGIN_ID + '-rss-article-frame' }); const feed = service.getFeed(selected.feedId); articleFrame.createDiv({ cls:PLUGIN_ID + '-rss-detail-source', text:(feed?.name || 'RSS') + (feed?.tags?.length ? ' · ' + feed.tags.map((tag) => '#' + tag).join(' ') : '') }); articleFrame.createEl('h3', { text:selected.title }); articleFrame.createDiv({ cls:PLUGIN_ID + '-rss-detail-time', text:window.moment(selected.publishedAt).format('YYYY-MM-DD HH:mm') });
    const articleActions = articleFrame.createDiv({ cls:PLUGIN_ID + '-rss-article-actions' }); const later=articleActions.createEl('button',{text:selected.savedAt?(this.view._lang()==='en'?'★ Saved':'★ 已稍后读'):(this.view._lang()==='en'?'☆ Read later':'☆ 稍后读'),attr:{type:'button'}});later.onclick=async()=>{await service.toggleSaved(selected.id);this._preserveListScroll=true;this.render();}; if (/^https?:\/\//i.test(selected.link)) { const open = articleActions.createEl('button', { cls:PLUGIN_ID + '-rss-open-original mod-cta', text:this.view._lang() === 'en' ? 'Open original' : '打开原文', attr:{ type:'button' } }); open.onclick = () => window.open(selected.link, '_blank', 'noopener'); }
    articleFrame.createEl('h4', { cls:PLUGIN_ID + '-rss-original-label', text:this.view._lang() === 'en' ? 'Original article' : '链接原文' }); const article = articleFrame.createDiv({ cls:PLUGIN_ID + '-rss-detail-body' }); this._renderLinkedArticle(article, selected, (blocks) => this._prepareSpeech(selected, blocks, speechControls));
    detailScroll.addEventListener('scroll',()=>{clearTimeout(this._progressTimer);this._progressTimer=setTimeout(()=>{const max=detailScroll.scrollHeight-detailScroll.clientHeight;const progress=max<=0?100:detailScroll.scrollTop/max*100;service.updateProgress(selected.id,progress);},500);});
    requestAnimationFrame(() => { if (savedListScroll !== null && savedListScroll !== undefined) list.scrollTop = savedListScroll; else list.querySelector('.' + PLUGIN_ID + '-rss-card.active')?.scrollIntoView({ block:'nearest' }); if (selected.readProgress && detailScroll.scrollHeight > detailScroll.clientHeight) detailScroll.scrollTop=(detailScroll.scrollHeight-detailScroll.clientHeight)*selected.readProgress/100; });
    if (!selected.readAt) service.markRead(selected.id).then((changed) => { if (changed && this.selectedId === selected.id) { this.view._refreshCalendarRef?.(); if (this.queueMode !== 'unread') { this._preserveListScroll = true; this.render(); } } });
  }
  async _renderLinkedArticle(el, item, onReady) {
    const fallback = item.summary || (this.view._lang() === 'en' ? 'This feed does not provide article content.' : '该订阅源未提供正文内容。');
    if (!/^https?:\/\//i.test(item.link)) { const blocks = [{ type:'p', parts:[{ kind:'text', text:fallback }] }]; this._renderArticleBlocks(el, blocks); onReady?.(blocks); return; }
    if (this.articleCache.has(item.link)) { const blocks = this.articleCache.get(item.link); this._renderArticleBlocks(el, blocks); onReady?.(blocks); return; }
    const requestId = ++this._articleRequest; el.setText(this.view._lang() === 'en' ? 'Loading article from the source link…' : '正在加载链接原文…');
    try {
      const response = await obs.requestUrl({ url:item.link, method:'GET', headers:{ Accept:'text/html,application/xhtml+xml' }, throw:false });
      if (response.status < 200 || response.status >= 300) throw new Error('HTTP ' + response.status);
      const doc = new DOMParser().parseFromString(response.text, 'text/html'); doc.querySelectorAll('script,style,noscript,svg,iframe,nav,footer,header,form,aside,[class*="author"],[class*="share"],[class*="related"],[class*="recommend"],[class*="comment"],[class*="toolbar"],[class*="meta"]').forEach((node) => node.remove());
      const source = doc.querySelector('article, main, [role="main"], .article-content, .post-content, .entry-content, .content') || doc.body;
      const blocks = this._extractArticleBlocks(source, item.title, this.view._rss.getFilterTerms(item.feedId)); const article = blocks.length ? blocks : [{ type:'p', parts:[{ kind:'text', text:fallback }] }]; this.articleCache.set(item.link, article); if (requestId === this._articleRequest && el.isConnected) { this._renderArticleBlocks(el, article); onReady?.(article); }
    } catch (e) { if (requestId === this._articleRequest && el.isConnected) { const blocks = [{ type:'p', parts:[{ kind:'text', text:fallback }] }, { type:'note', parts:[{ kind:'text', text:'（链接原文暂时无法加载，可使用“打开原文”查看。）' }] }]; this._renderArticleBlocks(el, blocks); onReady?.(blocks); } }
  }
  _createSpeechControls(parent, item) {
    const en = this.view._lang() === 'en'; const supported = !!(window.speechSynthesis && window.SpeechSynthesisUtterance); if (this._speechCollapsed === undefined) this._speechCollapsed = false; const wrap = parent.createDiv({ cls:PLUGIN_ID + '-rss-speech' + (this._speechCollapsed ? ' is-collapsed' : '') }); const source = wrap.createDiv({ cls:PLUGIN_ID + '-rss-player-source', text:this.view._rss.getFeed(item.feedId)?.name || 'RSS' }); const title = wrap.createDiv({ cls:PLUGIN_ID + '-rss-player-title', text:item.title || (en ? 'No article selected' : '未选择文章'), attr:{ title:item.title || '' } }); const controls = wrap.createDiv({ cls:PLUGIN_ID + '-rss-player-controls' }); const play = controls.createEl('button', { cls:PLUGIN_ID + '-rss-speech-play', text:'▶', attr:{ type:'button', title:en ? 'Read this article' : '朗读当前文章', disabled:supported ? null : 'true' } }); const stop = controls.createEl('button', { cls:PLUGIN_ID + '-rss-speech-stop', text:en ? 'Stop' : '停止', attr:{ type:'button', disabled:'true' } }); const progress = controls.createEl('input', { cls:PLUGIN_ID + '-rss-speech-progress', attr:{ type:'range', min:'0', max:'1', value:'0', step:'1', disabled:'true', 'aria-label':en ? 'Reading progress' : '朗读进度' } }); const status = controls.createSpan({ cls:PLUGIN_ID + '-rss-speech-status' }); const rate = controls.createEl('select', { cls:PLUGIN_ID + '-rss-speech-rate', attr:{ disabled:supported ? null : 'true', 'aria-label':en ? 'Reading speed' : '朗读速度' } }); [[.8,'0.8×'],[1,'1×'],[1.2,'1.2×'],[1.5,'1.5×']].forEach(([value, label]) => rate.createEl('option', { text:label, value:String(value) })); const autoNext = controls.createEl('label', { cls:PLUGIN_ID + '-rss-speech-auto' }); const autoCheck = autoNext.createEl('input', { attr:{ type:'checkbox', disabled:supported ? null : 'true' } }); autoCheck.checked = this.view._rss.config.autoPlayNextArticle === true; autoNext.createSpan({ text:en ? 'Auto next' : '自动下一篇' }); const toggle = controls.createEl('button', { cls:PLUGIN_ID + '-rss-speech-toggle', text:'⌃', attr:{ type:'button', title:en ? 'Collapse player' : '收起播放器' } }); const ui = { itemId:item.id, wrap, source, title, play, stop, progress, status, rate, autoCheck, toggle, supported }; this._speechUi = ui; play.onclick = () => this._toggleSpeech(item.id); stop.onclick = () => this._stopSpeech(); progress.oninput = () => this._seekSpeech(Number(progress.value)); rate.onchange = () => this._changeSpeechRate(Number(rate.value)); autoCheck.onchange = () => this._setAutoPlayNext(autoCheck.checked); toggle.onclick = () => { this._speechCollapsed = !this._speechCollapsed; this._setSpeechPanelState(); }; this._setSpeechPanelState(); return ui;
  }
  _prepareSpeech(item, blocks, ui) {
    const text = (blocks || []).filter((block) => !['image', 'code', 'note'].includes(block.type)).flatMap((block) => (block.parts || []).map((part) => part.text || '')).join('\n').replace(/\s+/g, ' ').trim(); const chunks = this._splitSpeechText(text); this._speechChunks.set(item.id, chunks); if (this._speech.itemId === item.id && this._speech.autoStartNext) { this._speech.chunks = chunks; this._speech.index = 0; this._speech.autoStartNext = false; this._speakCurrent(); } this._updateSpeechControls();
  }
  _splitSpeechText(text) {
    const sentences = String(text || '').match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || []; const chunks = []; sentences.forEach((sentence) => { let rest = sentence.trim(); while (rest.length > 240) { let cut = rest.lastIndexOf('，', 220); if (cut < 80) cut = rest.lastIndexOf(',', 220); if (cut < 80) cut = 220; chunks.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim(); } if (rest) chunks.push(rest); }); return chunks.filter((chunk) => chunk.length > 1);
  }
  _toggleSpeech(targetId) { const speech = this._speech; if (speech.itemId !== targetId) { const chunks = this._speechChunks.get(targetId) || []; if (!chunks.length) { new obs.Notice(this.view._lang() === 'en' ? 'Article text is still loading.' : '正文仍在加载，请稍候。'); return; } this._stopSpeech(); this._speech = { itemId:targetId, chunks, index:0, status:'idle', rate:speech.rate || 1, token:speech.token || 0, playlist:speech.playlist || [], autoStartNext:false }; } if (!this._speech.chunks.length) return; if (this._speech.status === 'playing') { window.speechSynthesis.pause(); this._speech.status = 'paused'; this._releaseScreenWakeLock(); this._updateSpeechControls(); return; } if (this._speech.status === 'paused') { window.speechSynthesis.resume(); this._speech.status = 'playing'; this._requestScreenWakeLock(); this._updateSpeechControls(); return; } if (this._speech.status === 'completed') this._speech.index = 0; this._speakCurrent(); }
  _speakCurrent() { const speech = this._speech; if (!speech.chunks[speech.index]) { speech.status = 'completed'; this._releaseScreenWakeLock(); this._updateSpeechControls(); return; } window.speechSynthesis.cancel(); const token = ++speech.token; const utterance = new SpeechSynthesisUtterance(speech.chunks[speech.index]); utterance.lang = /[\u3400-\u9fff]/.test(utterance.text) ? 'zh-CN' : 'en-US'; utterance.rate = speech.rate || 1; utterance.onstart = () => { if (token === speech.token) { speech.status = 'playing'; this._requestScreenWakeLock(); this._updateSpeechControls(); } }; utterance.onend = () => { if (token !== speech.token || speech.status !== 'playing') return; speech.index += 1; if (speech.index >= speech.chunks.length) { speech.status = 'completed'; this._releaseScreenWakeLock(); this._updateSpeechControls(); if (this.view._rss.config.autoPlayNextArticle) this._playNextArticle(); } else this._speakCurrent(); }; utterance.onerror = (event) => { if (token === speech.token && event.error !== 'canceled' && event.error !== 'interrupted') { speech.status = 'idle'; this._releaseScreenWakeLock(); this._updateSpeechControls(); } }; speech.status = 'playing'; this._requestScreenWakeLock(); window.speechSynthesis.speak(utterance); this._updateSpeechControls(); }
  _playNextArticle() { const playlist = this._speech.playlist || []; const current = playlist.indexOf(this._speech.itemId); const nextId = current >= 0 ? playlist[current + 1] : null; if (!nextId) return; const chunks = this._speechChunks.get(nextId); this._speech.itemId = nextId; this._speech.index = 0; this._speech.status = 'idle'; this._speech.autoStartNext = !chunks; if (chunks?.length) { this._speech.chunks = chunks; this._speakCurrent(); } this._preserveListScroll = true; this.selectedId = nextId; this.render(); }
  async _setAutoPlayNext(value) { await this.view._rss.saveConfig({ ...this.view._rss.config, autoPlayNextArticle:value === true }); this._updateSpeechControls(); }
  _stopSpeech() { if (window.speechSynthesis) window.speechSynthesis.cancel(); this._speech.token += 1; this._speech.status = 'idle'; this._speech.index = 0; this._speech.autoStartNext = false; this._releaseScreenWakeLock(); this._updateSpeechControls(); }
  _seekSpeech(index) { if (!this._speech.chunks.length) return; window.speechSynthesis.cancel(); this._speech.token += 1; this._speech.index = Math.max(0, Math.min(this._speech.chunks.length - 1, index)); this._speech.status = 'idle'; this._updateSpeechControls(); this._speakCurrent(); }
  _changeSpeechRate(rate) { this._speech.rate = Number.isFinite(rate) ? rate : 1; if (this._speech.status === 'playing') { window.speechSynthesis.cancel(); this._speech.token += 1; this._speech.status = 'idle'; this._speakCurrent(); } else this._updateSpeechControls(); }
  _setSpeechPanelState() { const ui = this._speechUi; if (!ui) return; const en = this.view._lang() === 'en'; ui.wrap.classList.toggle('is-collapsed', this._speechCollapsed); ui.toggle.setText(this._speechCollapsed ? '⌄' : '⌃'); ui.toggle.setAttr('title', this._speechCollapsed ? (en ? 'Expand player' : '展开播放器') : (en ? 'Collapse player' : '收起播放器')); }
  _updateSpeechControls() { const ui = this._speechUi; const speech = this._speech; if (!ui?.supported) return; const active = speech.itemId === ui.itemId; const chunks = active ? speech.chunks : (this._speechChunks.get(ui.itemId) || []); const total = chunks.length; const en = this.view._lang() === 'en'; const complete = active && speech.status === 'completed'; ui.play.disabled = !total; ui.stop.disabled = !active || (speech.status !== 'playing' && speech.status !== 'paused'); ui.progress.disabled = !active || !total; ui.progress.max = String(Math.max(total - 1, 1)); ui.progress.value = String(active ? Math.min(speech.index, Math.max(total - 1, 0)) : 0); ui.rate.value = String(speech.rate || 1); const playTitle = active && speech.status === 'playing' ? (en ? 'Pause reading' : '暂停朗读') : active && speech.status === 'paused' ? (en ? 'Resume reading' : '继续朗读') : complete ? (en ? 'Read again' : '重新朗读') : (en ? 'Read this article' : '朗读当前文章'); ui.play.setText(active && speech.status === 'playing' ? 'Ⅱ' : '▶'); ui.play.setAttr('title', playTitle); ui.status.setText(!total ? (en ? 'Preparing article…' : '正在准备正文…') : !active ? (en ? 'Ready to read' : '可开始朗读') : complete ? (en ? 'Finished' : '朗读完成') : speech.status === 'paused' ? (en ? 'Paused · ' : '已暂停 · ') + (speech.index + 1) + ' / ' + total : (en ? 'Segment ' : '第 ') + (speech.index + 1) + (en ? ' of ' : ' / ') + total + (en ? '' : ' 段')); }
  _extractArticleBlocks(source, title, filterTerms = []) {
    const seen = new Set(); const blocks = []; let imageCount = 0; let recommendationSection = false;
    source?.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre,img').forEach((node) => {
      if (node.tagName === 'IMG') {
        if (recommendationSection) return;
        const src = node.getAttribute('src') || node.getAttribute('data-src') || ''; const alt = node.getAttribute('alt') || '';
        if (/^https?:\/\//i.test(src) && imageCount++ < 20 && !seen.has('img:' + src)) { seen.add('img:' + src); blocks.push({ type:'image', src, alt }); }
        return;
      }
      if (node.tagName === 'P' && node.closest('li')) return;
      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (filterTerms.some((term) => text.includes(term))) { recommendationSection = true; return; }
      if (recommendationSection) return;
      if (text.length < 2 || text === title || seen.has(text) || /^(关注|分享|扫码|阅读全文|阅读原文|收藏|举报|作者|编辑)$/.test(text)) return;
      seen.add(text); const tag = node.tagName.toLowerCase(); blocks.push({ type:tag === 'pre' ? 'code' : tag === 'blockquote' ? 'quote' : /^h[1-4]$/.test(tag) ? 'heading' : tag === 'li' ? 'list' : 'p', parts:this._extractInlineParts(node) });
    });
    if (blocks.length) return blocks;
    const text = (source?.innerText || source?.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 60000);
    return text ? text.split(/\n{2,}/).map((part) => ({ type:'p', parts:[{ kind:'text', text:part.trim() }] })).filter((part) => part.parts[0].text.length > 1) : [];
  }
  _extractInlineParts(node) {
    const parts = []; const walk = (child) => { if (child.nodeType === Node.TEXT_NODE) { const text = child.textContent || ''; if (text) parts.push({ kind:'text', text }); return; } if (child.nodeType !== Node.ELEMENT_NODE) return; const tag = child.tagName.toLowerCase(); if (tag === 'br') { parts.push({ kind:'text', text:'\n' }); return; } if (tag === 'a') { const href = child.getAttribute('href') || ''; const text = (child.textContent || href).trim(); if (text) parts.push(/^https?:\/\//i.test(href) ? { kind:'link', text, href } : { kind:'text', text }); return; } if (tag === 'code') { const text = child.textContent || ''; if (text) parts.push({ kind:'code', text }); return; } Array.from(child.childNodes).forEach(walk); }; Array.from(node.childNodes).forEach(walk); const plain = parts.map((part) => part.text).join('').replace(/\s+/g, ' ').trim(); return plain ? parts : [{ kind:'text', text:(node.textContent || '').trim() }];
  }
  _renderArticleBlocks(el, blocks) {
    el.empty(); blocks.forEach((block) => { const cls = PLUGIN_ID + '-rss-article-' + block.type; if (block.type === 'image') { const image = el.createEl('img', { cls, attr:{ src:block.src, alt:block.alt || '', loading:'lazy' } }); image.onerror = () => image.remove(); return; } const target = block.type === 'heading' ? el.createEl('h3', { cls }) : block.type === 'code' ? el.createEl('pre', { cls }) : el.createDiv({ cls }); if (block.type === 'list') target.appendText('• '); (block.parts || []).forEach((part) => { if (part.kind === 'link') { const link = target.createEl('a', { text:part.text, attr:{ href:part.href, target:'_blank', rel:'noopener' } }); link.onclick = (evt) => { evt.preventDefault(); window.open(part.href, '_blank', 'noopener'); }; } else if (part.kind === 'code') target.createEl('code', { text:part.text }); else target.appendText(part.text); }); });
  }
  _showMenu(evt) {
    const en = this.view._lang() === 'en'; const menu = new obs.Menu();
    menu.addItem((item) => item.setTitle(en ? 'Manage subscriptions' : '管理订阅源').setIcon('settings-2').onClick(() => new CockpitRssSettingsModal(this.app, this.view).open()));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle(en ? 'Refresh all subscriptions' : '刷新全部订阅').setIcon('refresh-cw').onClick(async () => { const result = await this.view._refreshRssSubscriptions(true); this.render(); }));
    menu.addItem((item) => item.setTitle(en ? 'Clear local RSS cache' : '清除本机 RSS 缓存').setIcon('trash-2').onClick(async () => { await this.view._rss.clearCache(); new obs.Notice(en ? 'Local RSS cache cleared.' : '本机 RSS 缓存已清除。'); this.view._refreshCalendarRef?.(); this.render(); }));
    menu.showAtMouseEvent(evt);
  }
  _makeDraggable(handle) {
    this._dragCleanup?.(); this._dragCleanup = null;
    const onPointerDown = (evt) => { if (evt.button !== 0 || evt.target.closest('button')) return; const rect = this.modalEl.getBoundingClientRect(); const offsetX = evt.clientX - rect.left; const offsetY = evt.clientY - rect.top; this.modalEl.style.position = 'fixed'; this.modalEl.style.left = rect.left + 'px'; this.modalEl.style.top = rect.top + 'px'; this.modalEl.style.margin = '0'; const move = (event) => { this.modalEl.style.left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - offsetX)) + 'px'; this.modalEl.style.top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, event.clientY - offsetY)) + 'px'; }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); };
    handle.addEventListener('pointerdown', onPointerDown); this._dragCleanup = () => handle.removeEventListener('pointerdown', onPointerDown);
  }
  onClose() { clearTimeout(this._progressTimer); this._dragCleanup?.(); this._stopSpeech(); if (this._wakeLockVisibilityHandler) document.removeEventListener('visibilitychange', this._wakeLockVisibilityHandler); this._wakeLockVisibilityHandler = null; this.contentEl.empty(); this.modalEl.removeClass(PLUGIN_ID + '-rss-modal'); }
}

class CockpitRssSettingsModal extends obs.Modal {
  constructor(app, view) { super(app); this.view = view; this.config = normalizeRssConfig(view._rss?.config); }
  onOpen() { this.contentEl.addClass(PLUGIN_ID + '-rss-settings-modal'); this.render(); }
  render() {
    const en = this.view._lang() === 'en'; const service = this.view._rss; const stats = service.cacheStats(); this.contentEl.empty(); const heading = this.contentEl.createEl('h2', { text:en ? 'RSS subscriptions' : 'RSS 订阅' }); this._dragCleanup?.(); this._dragCleanup = makeCockpitModalDraggable(this, heading, en ? 'Drag RSS settings' : '拖动 RSS 设置窗口'); this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-network-note', text:en ? 'RSS uses your network to fetch the feed addresses you add. Feed configuration syncs with the plugin; cached entries stay only on this device and never enter data.json or your synced configuration.' : '启用后会联网访问你添加的订阅地址。订阅配置会随插件同步；缓存仅保存在当前设备，不写入 data.json，也不参与配置同步。' });
    new obs.Setting(this.contentEl).setName(en ? 'Enable RSS subscriptions' : '启用 RSS 订阅').addToggle((toggle) => toggle.setValue(this.config.enabled).onChange((value) => { this.config.enabled = value; }));
    new obs.Setting(this.contentEl).setName(en ? 'Refresh interval' : '刷新频率').setDesc(en ? 'Automatic refresh is skipped while the dashboard is hidden.' : '驾驶舱隐藏时不会自动刷新。').addDropdown((drop) => drop.addOptions({ 0:en ? 'Manual only' : '仅手动', 60:en ? 'Every hour' : '每小时', 360:en ? 'Every 6 hours' : '每 6 小时' }).setValue(String(this.config.refreshMinutes)).onChange((value) => { this.config.refreshMinutes = Number(value); }));
    this.contentEl.createEl('h3', { text:en ? 'Sources' : '订阅源' }); this.config.feeds.forEach((feed, index) => { const card = this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-feed-form' }); const name = card.createEl('input', { attr:{ placeholder:en ? 'Alias / name' : '别名或名称', maxlength:'48' } }); name.value = feed.name; const url = card.createEl('input', { attr:{ placeholder:'https://example.com/feed.xml', maxlength:'1000' } }); url.value = feed.url; const tags = card.createEl('input', { attr:{ placeholder:en ? 'Tags, comma separated' : '标签，使用逗号分隔', maxlength:'200' } }); tags.value = feed.tags.join(', '); const filter = card.createEl('input', { attr:{ placeholder:en ? 'Extra filter terms' : '本源额外过滤词', maxlength:'300' } }); filter.value = (feed.filterKeywords || []).join(', '); const enabled = card.createEl('input', { attr:{ type:'checkbox', title:en ? 'Enabled' : '启用' } }); enabled.checked = feed.enabled; const remove = card.createEl('button', { text:'×', attr:{ type:'button', title:en ? 'Remove source' : '删除订阅源' } }); name.oninput = () => { feed.name = name.value; }; url.oninput = () => { feed.url = url.value; }; tags.oninput = () => { feed.tags = tags.value.split(',').map((tag) => tag.trim()).filter(Boolean); }; filter.oninput = () => { feed.filterKeywords = normalizeRssFilterTerms(filter.value, 12); }; enabled.onchange = () => { feed.enabled = enabled.checked; }; remove.onclick = () => { this.config.feeds.splice(index, 1); this.render(); }; });
    const add = this.contentEl.createEl('button', { text:en ? '+ Add source' : '+ 添加订阅源', attr:{ type:'button' } }); add.onclick = () => { this.config.feeds.push({ id:'rss-' + Date.now().toString(36), name:'RSS', url:'', tags:[], color:'#818cf8', enabled:true }); this.render(); };
    const filtering = this.config.filtering || (this.config.filtering = { sharedKeywords:RSS_FILTER_DEFAULT_TERMS.slice(), globalFeedIds:[] }); this.contentEl.createEl('h3', { text:en ? 'Content filtering' : '内容过滤' }); new obs.Setting(this.contentEl).setName(en ? 'Shared filter terms' : '公共过滤词').setDesc(en ? 'Starts with editable defaults. One per line or separated by commas; matching hides that section and everything after it.' : '已预置可编辑的默认词。一行一个或用逗号分隔；命中后会隐藏该段及其后续内容。').addTextArea((area) => area.setValue((filtering.sharedKeywords || []).join('\n')).onChange((value) => { filtering.sharedKeywords = normalizeRssFilterTerms(value); })); const scope = this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-filter-scope' }); scope.createDiv({ cls:PLUGIN_ID + '-rss-filter-scope-note', text:en ? 'Shared terms apply to all sources when none are selected. Otherwise, only checked sources use them.' : '未勾选任何源时公共词对全部源生效；勾选后仅对已勾选源生效。' }); this.config.feeds.forEach((feed) => { const label = scope.createEl('label', { cls:PLUGIN_ID + '-rss-filter-source' }); const check = label.createEl('input', { attr:{ type:'checkbox' } }); check.checked = (filtering.globalFeedIds || []).includes(feed.id); label.createSpan({ text:feed.name }); check.onchange = () => { const ids = new Set(filtering.globalFeedIds || []); if (check.checked) ids.add(feed.id); else ids.delete(feed.id); filtering.globalFeedIds = Array.from(ids); }; });
    this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-cache-note', text:(en ? 'Local cache: ' : '本机缓存：') + stats.count + (en ? ' entries, ' : ' 条，') + Math.ceil(stats.bytes / 1024) + ' KB · ' + (en ? 'max 100/source, 500 total, 60 days, 5 MB.' : '每源最多 100 条、总计 500 条、最长 60 天、最大 5 MB。') });
    const actions = this.contentEl.createDiv({ cls:PLUGIN_ID + '-rss-settings-actions' }); const clear = actions.createEl('button', { text:en ? 'Clear local cache' : '清除本机缓存', attr:{ type:'button' } }); clear.onclick = async () => { await service.clearCache(); this.render(); }; const save = actions.createEl('button', { cls:'mod-cta', text:en ? 'Save' : '保存', attr:{ type:'button' } }); save.onclick = async () => { const before = new Set(service.config.feeds.map((feed) => feed.id)); this.config.feeds = this.config.feeds.filter((feed) => /^https?:\/\//i.test(feed.url.trim())); await service.saveConfig(this.config); for (const id of before) if (!service.config.feeds.some((feed) => feed.id === id)) await service.clearCache(id); this.view._refreshCalendarRef?.(); this.close(); };
  }
  onClose() { this._dragCleanup?.(); this._dragCleanup = null; this.contentEl.empty(); }
}
