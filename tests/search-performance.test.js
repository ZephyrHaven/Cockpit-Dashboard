const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, Map, Set, Promise, setTimeout, clearTimeout,
  window:{ setTimeout }, PLUGIN_ID:'cockpit-dashboard', DEFAULT_LANG:'zh', TODO_FILE:'_data/todos.md', obs:{ Modal:class { constructor(app) { this.app = app; } } } });
vm.runInContext(fs.readFileSync('src/search.js', 'utf8')
  + '\nthis.api={CockpitGlobalSearchModal,CockpitSearchContentCache,prioritizeSearchFiles};', context);

(async () => {
  const files = Array.from({ length:100 }, (_, index) => ({ path:'note-' + index + '.md', basename:'Note ' + index, stat:{ mtime:1, size:100 } }));
  const index = { ready:true, query:() => [{ path:files[90].path }] };
  assert.equal(context.api.prioritizeSearchFiles(files, index, 'needle')[0].path, files[90].path);
  let reads = 0, active = 0, peak = 0;
  const readOrder = [];
  const vault = { getMarkdownFiles:() => files, cachedRead:async (file) => {
    reads++; active++; peak = Math.max(peak, active); readOrder.push(file.path);
    await new Promise((resolve) => setTimeout(resolve, 1)); active--;
    return file.path === files[95].path || file.path === files[90].path ? 'contains needle text' : 'other content';
  } };
  const plugin = { rag:{ index } };
  const makeModal = () => {
    const modal = new context.api.CockpitGlobalSearchModal({ vault }, 'en', { _plugin:plugin, _todos:[] });
    modal.hint = { setText:() => {} }; modal._renderResults = () => {}; modal.contentEl = { empty:() => {} };
    return modal;
  };
  const first = makeModal(); await first._search('needle', 0);
  assert.equal(peak, 4, 'Reads are parallel with a bounded batch size.');
  assert.equal(readOrder[0], files[90].path);
  assert.equal(first._results.some((result) => result.file.path === files[95].path), true, 'Exact substring matches outside index candidates remain discoverable.');
  assert.equal(reads, 100);
  let removed = 0; vault.offref = () => { removed++; };
  plugin._cockpitSearchModals = new Set([first]); first._vaultRefs = [{}, {}, {}, {}];
  first.onClose();
  assert.equal(removed, 4, 'Closing a search removes each vault listener.');
  assert.equal(plugin._cockpitSearchModals.size, 0, 'Closed modals are released from plugin lifecycle tracking.');
  const withoutDashboard = new context.api.CockpitGlobalSearchModal({ vault }, 'en', null, plugin);
  assert.equal(withoutDashboard._contentCache, plugin._cockpitSearchContentCache);
  const second = makeModal(); await second._search('needle', 0);
  assert.equal(reads, 100, 'Reopening search reuses a bounded shared cache.');
  files[90].stat.mtime++;
  second._queryCache.clear(); await second._search('needle', 0);
  assert.equal(reads, 101, 'Changed files are re-read rather than returning stale cached content.');

  const bounded = new context.api.CockpitSearchContentCache(30);
  bounded.set('a\n1', '1234567890'); bounded.set('b\n1', 'abcdefghij');
  assert.equal(bounded.chars <= 30, true); assert.equal(bounded.get('a\n1'), undefined);
  bounded.deletePath('b'); assert.equal(bounded.chars, 0);

  const cancelled = makeModal(); cancelled._contentCache = new context.api.CockpitSearchContentCache();
  // Resolve all batch reads together, then verify a closed modal never publishes them.
  const waiting = []; vault.cachedRead = () => new Promise((resolve) => waiting.push(resolve));
  const pending = cancelled._search('needle', 0); cancelled.onClose();
  waiting.forEach((resolve) => resolve('needle')); await pending;
  assert.equal(cancelled._results.length, 0, 'Closing search cancels in-flight results.');
  assert.equal(waiting.length, 4, 'Cancellation prevents any later batches from starting.');
  console.log('Search batching, completeness and cache checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
