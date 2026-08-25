// ai-context.js — 多笔记、临时文本附件与本地关键词 RAG；内容仅在内存中索引。

const AI_UPLOAD_LIMITS = Object.freeze({
  maxFiles:5,
  maxBytesPerFile:1024 * 1024,
  maxTotalChars:100000,
  extensions:Object.freeze(['md','txt','csv','json','yaml','yml','log','html','htm','xml'])
});

function createAiContextAbortError() {
  const error = new Error('Context retrieval stopped.');
  error.name = 'AbortError';
  return error;
}

function assertAiContextNotAborted(signal) {
  if (signal?.aborted) throw createAiContextAbortError();
}

function isProtectedAiContextPath(value) {
  const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  return path === '.obsidian' || path.startsWith('.obsidian/') || path === '.trash' || path.startsWith('.trash/');
}

function safeAiContextPath(value) {
  return String(value || '').replace(/[\r\n\0]/g, '').replace(/\\/g, '/').trim().slice(0, 1000);
}

function extractAiKeywords(value) {
  const text = String(value || '').normalize('NFKC').toLocaleLowerCase();
  const result = [];
  const seen = new Set();
  const add = (keyword) => {
    const normalized = String(keyword || '').trim();
    if (normalized.length < 2 || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };
  const latinStop = new Set(['the','and','for','with','from','this','that','what','when','where','how','about','please','into','your','我的','一个']);
  (text.match(/[a-z0-9][a-z0-9_-]{1,}/g) || []).forEach((word) => { if (!latinStop.has(word)) add(word); });
  (text.match(/[\u3400-\u9fff]{2,}/g) || []).forEach((run) => {
    if (run.length <= 10) add(run);
    for (let index = 0; index < run.length - 1; index++) add(run.slice(index, index + 2));
  });
  return result.slice(0, 40);
}

async function computeAiContentHash(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  bytes.forEach((byte) => { hash ^= byte; hash = Math.imul(hash, 16777619); });
  return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
}

function chunkAiDocument(document, requestedSize = 1200, requestedOverlap = 160) {
  const path = safeAiContextPath(document?.path || document?.name || 'Untitled');
  const source = document?.source === 'upload' ? 'upload' : 'vault';
  const content = String(document?.content || '').replace(/\r\n?/g, '\n').trim();
  if (!content) return [];
  const size = Math.max(32, Math.min(4000, Math.floor(Number(requestedSize) || 1200)));
  const overlap = Math.max(0, Math.min(size - 1, Math.floor(Number(requestedOverlap) || 0)));
  const chunks = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(content.length, start + size);
    if (end < content.length) {
      const boundary = Math.max(content.lastIndexOf('\n\n', end), content.lastIndexOf('\n', end));
      if (boundary > start + Math.floor(size * 0.55)) end = boundary;
    }
    const text = content.slice(start, end).trim();
    if (text) chunks.push({ path, source, content:text, chunkIndex:chunks.length });
    if (end >= content.length) break;
    const next = Math.max(start + 1, end - overlap);
    start = next;
  }
  return chunks;
}

function countAiKeywordMatches(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) >= 0 && count < 20) { count += 1; offset += needle.length; }
  return count;
}

function rankAiContextChunks(chunks, keywords, options = {}) {
  const terms = (Array.isArray(keywords) ? keywords : []).map((item) => String(item || '').toLocaleLowerCase()).filter((item) => item.length >= 2).slice(0, 40);
  const limit = Math.max(1, Math.min(12, Math.floor(Number(options.limit) || 6)));
  const maxChars = Math.max(1, Math.min(50000, Math.floor(Number(options.maxChars) || 12000)));
  const scored = (Array.isArray(chunks) ? chunks : []).map((chunk, order) => {
    const path = safeAiContextPath(chunk?.path);
    const content = String(chunk?.content || '').trim();
    const lowerPath = path.toLocaleLowerCase();
    const lowerContent = content.toLocaleLowerCase();
    let score = 0;
    terms.forEach((term) => {
      score += countAiKeywordMatches(lowerPath, term) * 8;
      score += countAiKeywordMatches(lowerContent.slice(0, 220), term) * 3;
      score += countAiKeywordMatches(lowerContent, term);
    });
    return { ...chunk, path, content, score, order };
  }).filter((item) => item.content && (terms.length ? item.score > 0 : true));
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const perPath = new Map();
  const result = [];
  let remaining = maxChars;
  for (const item of scored) {
    if (!remaining || result.length >= limit) break;
    const used = perPath.get(item.path) || 0;
    if (used >= 2) continue;
    const content = item.content.slice(0, remaining);
    if (!content) continue;
    result.push({ path:item.path, source:item.source || 'rag', content, score:item.score, chunkIndex:item.chunkIndex || 0 });
    perPath.set(item.path, used + 1);
    remaining -= content.length;
  }
  return result;
}

function isSupportedAiUpload(file) {
  const name = String(file?.name || '').toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() : '';
  const type = String(file?.type || '').toLowerCase();
  const typeAllowed = !type || type.startsWith('text/') || ['application/json','application/xml','application/yaml','application/x-yaml'].includes(type);
  return AI_UPLOAD_LIMITS.extensions.includes(extension) && typeAllowed;
}

async function readAiUploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length > AI_UPLOAD_LIMITS.maxFiles) throw new Error('Too many files. Upload at most ' + AI_UPLOAD_LIMITS.maxFiles + '.');
  const result = [];
  let totalChars = 0;
  for (const file of files) {
    if (!isSupportedAiUpload(file)) throw new Error('This file type is not supported: ' + String(file?.name || 'unknown'));
    const size = Math.max(0, Number(file?.size) || 0);
    if (size > AI_UPLOAD_LIMITS.maxBytesPerFile) throw new Error('File is too large: ' + String(file?.name || 'unknown'));
    if (typeof file?.text !== 'function') throw new Error('This file cannot be read as text: ' + String(file?.name || 'unknown'));
    const content = String(await file.text()).replace(/\0/g, '').replace(/\r\n?/g, '\n').trim();
    totalChars += content.length;
    if (totalChars > AI_UPLOAD_LIMITS.maxTotalChars) throw new Error('Uploaded text is too large in total.');
    const name = String(file.name || 'attachment.txt').replace(/[\\/\r\n\0]/g, '_').trim().slice(0, 120) || 'attachment.txt';
    result.push({ name, path:'附件:' + name, content, source:'upload', size, hash:await computeAiContentHash(content) });
  }
  return result;
}

class CockpitRagService {
  constructor(plugin) {
    this.plugin = plugin;
    this.pathCache = new Map();
    this.chunkCache = new Map();
  }
  async _readVaultDocument(file) {
    const path = safeAiContextPath(file?.path);
    if (!path || file?.extension !== 'md' || isProtectedAiContextPath(path)) return null;
    const mtime = Number(file?.stat?.mtime || 0);
    const size = Number(file?.stat?.size || 0);
    const cachedPath = this.pathCache.get(path);
    if (cachedPath && cachedPath.mtime === mtime && cachedPath.size === size) return cachedPath.document;
    const vault = this.plugin.app.vault;
    const content = String(await (typeof vault.cachedRead === 'function' ? vault.cachedRead(file) : vault.read(file)) || '');
    const hash = await computeAiContentHash(content);
    let templates = this.chunkCache.get(hash);
    if (!templates) {
      templates = chunkAiDocument({ path:'', content, source:'vault' }).map((chunk) => ({ content:chunk.content, chunkIndex:chunk.chunkIndex }));
      this.chunkCache.set(hash, templates);
      while (this.chunkCache.size > 1600) this.chunkCache.delete(this.chunkCache.keys().next().value);
    }
    const document = { path, content, source:'vault', hash, chunks:templates.map((chunk) => ({ ...chunk, path, source:'vault' })) };
    this.pathCache.set(path, { mtime, size, hash, document });
    return document;
  }
  async _readSelected(paths, signal) {
    const vault = this.plugin.app.vault;
    const result = [];
    for (const path of paths) {
      assertAiContextNotAborted(signal);
      if (isProtectedAiContextPath(path)) continue;
      const file = vault.getAbstractFileByPath?.(path);
      const document = await this._readVaultDocument(file);
      if (document) result.push(document);
    }
    return result;
  }
  async _readAll(onProgress, signal) {
    const files = (this.plugin.app.vault.getMarkdownFiles?.() || []).filter((file) => file?.extension === 'md' && !isProtectedAiContextPath(file.path));
    const result = [];
    for (let offset = 0; offset < files.length; offset += 12) {
      assertAiContextNotAborted(signal);
      const batch = await Promise.all(files.slice(offset, offset + 12).map((file) => this._readVaultDocument(file).catch(() => null)));
      assertAiContextNotAborted(signal);
      result.push(...batch.filter(Boolean));
      onProgress?.({ indexed:Math.min(files.length, offset + 12), total:files.length });
    }
    return result;
  }
  async prepare(options = {}) {
    assertAiContextNotAborted(options.signal);
    const selectedPaths = Array.from(new Set((Array.isArray(options.selectedPaths) ? options.selectedPaths : [])
      .map(safeAiContextPath).filter((path) => path && !isProtectedAiContextPath(path)))).slice(0, 12);
    const attachments = (Array.isArray(options.attachments) ? options.attachments : []).slice(0, AI_UPLOAD_LIMITS.maxFiles)
      .map((item) => ({ path:safeAiContextPath(item?.path || ('附件:' + item?.name)), content:String(item?.content || ''), source:'upload' }))
      .filter((item) => item.path && item.content);
    const maxChars = Math.max(64, Math.min(50000, Math.floor(Number(options.maxChars) || 12000)));
    const query = String(options.query || '').trim().slice(0, 8000);
    const selected = await this._readSelected(selectedPaths, options.signal);
    const manual = [...selected.map((item) => ({ path:item.path, content:item.content, source:'vault' })), ...attachments];
    const manualChars = manual.reduce((sum, item) => sum + item.content.length, 0);
    if (manual.length && manualChars <= maxChars) return { mode:'manual', contexts:manual, searchedFiles:selected.length, truncated:false };

    const global = !selectedPaths.length && !attachments.length;
    const documents = global ? await this._readAll(options.onProgress, options.signal) : selected;
    assertAiContextNotAborted(options.signal);
    const chunks = documents.flatMap((item) => item.chunks || chunkAiDocument(item));
    chunks.push(...attachments.flatMap((item) => chunkAiDocument(item)));
    const fallbackQuery = [...selectedPaths, ...attachments.map((item) => item.path)].join(' ');
    const keywords = extractAiKeywords(query || fallbackQuery);
    let contexts = rankAiContextChunks(chunks, keywords, { limit:8, maxChars });
    if (!contexts.length && !global && chunks.length) contexts = rankAiContextChunks(chunks, [], { limit:8, maxChars });
    contexts = contexts.map((item) => ({ ...item, source:item.source === 'upload' ? 'upload' : 'rag' }));
    return {
      mode:global ? 'rag-global' : 'rag-selected',
      contexts,
      searchedFiles:documents.length,
      truncated:true,
      keywords:keywords.slice(0, 12)
    };
  }
  invalidatePath(value) {
    const path = safeAiContextPath(value);
    if (path) this.pathCache.delete(path);
  }
  clear() {
    this.pathCache.clear();
    this.chunkCache.clear();
  }
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') {
  module.exports = {
    AI_UPLOAD_LIMITS, isProtectedAiContextPath, extractAiKeywords, computeAiContentHash,
    chunkAiDocument, rankAiContextChunks, readAiUploadFiles, CockpitRagService
  };
}
