const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() { this.children = []; }
  empty() { this.children = []; }
  removeClass() {}
  createEl(tag, options) { const child = new Element(); Object.assign(child, { tag, ...options }); this.children.push(child); return child; }
  remove() {}
}
const context = vm.createContext({
  obs:{ ItemView:class { constructor() { this.contentEl = new Element(); } } },
  DEFAULT_LANG:'zh-CN', PLUGIN_ID:'cockpit-dashboard', normalizeLang:value => value,
  console:{ error() {} }
});
vm.runInContext(fs.readFileSync(require.resolve('../src/ai-view.js'), 'utf8') + '\nthis.View = CockpitAIView;', context);
(async () => {
  for (const stage of ['settings', 'history-read', 'history-create', 'render']) {
    const plugin = {
      loadData:async () => { if (stage === 'settings') throw new Error('read failed'); return {}; },
      ai:{ getConfig:async () => ({ profiles:[] }) },
      aiHistory:{
        load:async () => { if (stage === 'history-read') throw new Error('read failed'); return { sessions:[] }; },
        create:async () => { if (stage === 'history-create') throw new Error('EACCES'); return { id:'test', contextPaths:[] }; }
      }
    };
    const view = new context.View({}, plugin);
    view._resetSessionStats = () => {};
    view._render = async () => { throw new Error('render failed'); };
    await view.onOpen();
    assert.equal(view._openStage, stage);
    assert.ok(view.contentEl.children.some(el => el.attr?.role === 'alert'));
    const retry = view.contentEl.children.find(el => el.tag === 'button');
    let opened = 0;
    view._initializeView = async () => { opened++; };
    await retry.onclick();
    assert.equal(opened, 1);
    assert.equal(view._opening, null);
  }
  console.log('AI startup failure and retry tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
