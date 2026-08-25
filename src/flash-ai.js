// flash-ai.js — 闪念胶囊的 AI 整理。
// 把「稍后整理」箱里的闪念交给 Agent 聚类成主题，支持：
// 每个主题一键转待办、保存整理笔记到 _daily/、完成后清空整理箱。
// 全程非破坏性：不删除任何原始闪念行。

function parseFlashClusterPlan(raw, items) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;
  let parsed;
  try { parsed = JSON.parse(jsonMatch[0]); } catch (e) { return null; }
  if (!Array.isArray(parsed)) return null;
  const maxIndex = items.length;
  const claimed = new Set();
  const clusters = [];
  parsed.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const theme = String(entry.theme || '').trim().slice(0, 40);
    if (!theme) return;
    const summary = String(entry.summary || '').trim().slice(0, 120);
    const indices = [];
    (Array.isArray(entry.items) ? entry.items : []).forEach((value) => {
      const n = Number(value);
      // 同一簇内与跨簇都要去重，越界编号直接丢弃。
      if (!Number.isInteger(n) || n < 1 || n > maxIndex || claimed.has(n) || indices.includes(n)) return;
      indices.push(n);
    });
    indices.forEach((n) => claimed.add(n));
    if (!indices.length) return;
    clusters.push({ theme, summary, suggestion:entry.suggestion === 'todo' ? 'todo' : 'note', indices });
  });
  return clusters.length ? { clusters, covered:claimed.size } : null;
}

function formatFlashDigestMarkdown(plan, items, nowStamp, lang) {
  const en = lang === 'en';
  const lines = [];
  lines.push('# ' + (en ? 'Flash Digest ' : '闪念整理 ') + nowStamp);
  lines.push('');
  lines.push('> ' + (en
    ? `Organized by Cockpit AI from ${items.length} flash notes. Original notes are kept untouched.`
    : `由 Cockpit AI 从整理箱的 ${items.length} 条闪念归纳生成；原始记录保持不变。`));
  lines.push('');
  plan.clusters.forEach((cluster, index) => {
    lines.push('## ' + (index + 1) + '. ' + cluster.theme + (cluster.suggestion === 'todo' ? (en ? '  `actionable`' : '  `可执行`') : ''));
    if (cluster.summary) lines.push((en ? '- Summary: ' : '- 概括：') + cluster.summary);
    cluster.indices.forEach((n) => {
      const item = items[n - 1];
      if (item?.text) lines.push('- ' + String(item.text).replace(/\n+/g, ' ').slice(0, 200));
    });
    lines.push('');
  });
  return lines.join('\n');
}

class CockpitFlashOrganizeModal extends obs.Modal {
  // options: { lang, plan|null, rawAnswer, items, addTodo(text)->Promise<bool>,
  //            saveNote(markdown)->Promise<void>, clearInbox()->Promise<void> }
  constructor(app, options) {
    super(app);
    this.opts = options;
    this._done = false;
  }
  onOpen() {
    const en = this.opts.lang === 'en';
    const o = this.opts;
    this.modalEl.addClass(PLUGIN_ID + '-flash-digest-modal');
    this.titleEl.setText(en ? 'AI flash organizer' : 'AI 闪念整理');
    const body = this.contentEl.createDiv({ cls:PLUGIN_ID + '-flash-digest' });

    if (o.plan) {
      body.createEl('p', { cls:PLUGIN_ID + '-flash-digest-intro', text:(en
        ? `Grouped ${o.plan.covered}/${o.items.length} flash notes into ${o.plan.clusters.length} themes.`
        : `已把 ${o.plan.covered}/${o.items.length} 条闪念归入 ${o.plan.clusters.length} 个主题。`) });
      o.plan.clusters.forEach((cluster) => {
        const card = body.createDiv({ cls:PLUGIN_ID + '-flash-digest-cluster' });
        const head = card.createDiv({ cls:PLUGIN_ID + '-flash-digest-head' });
        head.createSpan({ cls:PLUGIN_ID + '-flash-digest-theme', text:cluster.theme });
        const add = head.createEl('button', {
          cls:PLUGIN_ID + '-flash-digest-add', attr:{ type:'button' },
          text:cluster.suggestion === 'todo' ? (en ? 'Add as task' : '转为待办') : (en ? 'Add as task' : '转为待办')
        });
        add.onclick = async () => {
          add.disabled = true;
          const text = cluster.summary
            ? cluster.theme + '：' + cluster.summary
            : cluster.theme;
          try {
            const ok = await o.addTodo(text);
            new obs.Notice(ok ? (en ? '✅ Task added' : '✅ 已添加待办') : (en ? 'Could not save the task.' : '待办保存失败。'));
          } finally { add.disabled = false; }
        };
        if (cluster.summary) card.createDiv({ cls:PLUGIN_ID + '-flash-digest-summary', text:cluster.summary });
        const list = card.createDiv({ cls:PLUGIN_ID + '-flash-digest-items' });
        cluster.indices.forEach((n) => {
          const item = o.items[n - 1];
          if (item?.text) list.createDiv({ cls:PLUGIN_ID + '-flash-digest-item', text:String(item.text).replace(/\n+/g, ' ').slice(0, 160) });
        });
      });
    } else {
      body.createEl('p', { cls:PLUGIN_ID + '-flash-digest-intro', text:(en
        ? 'The model did not return structured clusters. Raw answer is shown below; you can still save it as a note.'
        : '模型没有返回结构化的聚类结果，以下为原始回答；仍可保存为笔记。') });
      body.createDiv({ cls:PLUGIN_ID + '-flash-digest-raw', text:String(o.rawAnswer || '').slice(0, 4000) });
    }

    const actions = body.createDiv({ cls:PLUGIN_ID + '-flash-digest-actions' });
    const save = actions.createEl('button', { attr:{ type:'button' }, text:en ? 'Save digest note' : '保存整理笔记' });
    save.onclick = async () => {
      save.disabled = true;
      try {
        const markdown = o.plan
          ? formatFlashDigestMarkdown(o.plan, o.items, window.moment().format('YYYY-MM-DD HH:mm'), o.lang)
          : '# ' + (en ? 'Flash Digest ' : '闪念整理 ') + window.moment().format('YYYY-MM-DD HH:mm') + '\n\n' + String(o.rawAnswer || '');
        await o.saveNote(markdown);
        new obs.Notice(en ? '✅ Digest note saved and opened' : '✅ 整理笔记已保存并打开');
      } catch (e) {
        console.warn('Cockpit flash digest save failed', e);
        new obs.Notice(en ? 'Could not save the digest note.' : '整理笔记保存失败。');
      } finally { save.disabled = false; }
    };
    const clear = actions.createEl('button', { cls:'mod-warning', attr:{ type:'button' }, text:en ? 'Clear inbox when done' : '完成后清空整理箱' });
    clear.onclick = async () => {
      clear.disabled = true;
      try { await o.clearInbox(); this._done = true; this.close(); }
      finally { clear.disabled = false; }
    };
    const close = actions.createEl('button', { attr:{ type:'button' }, text:en ? 'Close' : '关闭' });
    close.onclick = () => this.close();
  }
  onClose() { this.contentEl.empty(); }
}

// 入口：读整理箱 → Agent 聚类 → 弹出整理面板。任何失败都不动原始数据。
async function organizeFlashInboxWithAi(view, hooks) {
  const en = hooks.lang === 'en';
  const items = (view._flashInbox || []).map((entry) => ({ id:entry?.id, text:String(entry?.text || '') })).filter((item) => item.text);
  if (!items.length) { new obs.Notice(en ? 'Nothing to organize yet.' : '整理箱是空的。'); return; }
  const listing = items.map((item, index) => (index + 1) + '. ' + item.text.replace(/\s+/g, ' ').slice(0, 120)).join('\n');
  const question = (en
    ? 'Group these flash notes into 2-6 themes. Reply ONLY with a JSON array, no extra text:\n'
      + '[{"theme":"short theme","summary":"one sentence","suggestion":"todo|note","items":[numbers]}]\n'
      + 'Every note must belong to exactly one theme. suggestion=todo means it can become an actionable task.\nNotes:\n'
    : '把下面的闪念按主题分成 2-6 组。只回复一个 JSON 数组，不要多余文字：\n'
      + '[{"theme":"简短主题","summary":"一句话概括","suggestion":"todo|note","items":[编号]}]\n'
      + '每条闪念必须恰好属于一组；suggestion=todo 表示适合转成可执行的待办。\n闪念列表：\n') + listing;
  let plan = null;
  let rawAnswer = '';
  try {
    rawAnswer = await cockpitAgentOneShot(view._plugin, question, hooks.lang, 90000);
    plan = parseFlashClusterPlan(rawAnswer, items);
  } catch (e) {
    console.warn('Cockpit flash organize failed', e);
    rawAnswer = '';
  }
  if (!plan && !rawAnswer) {
    new obs.Notice(en ? 'AI organizing failed. Check the AI model settings.' : 'AI 整理失败，请检查「AI 模型」配置。');
    return;
  }
  new CockpitFlashOrganizeModal(view.app, {
    lang:hooks.lang, plan, rawAnswer, items,
    addTodo:hooks.addTodo,
    saveNote:hooks.saveNote,
    clearInbox:hooks.clearInbox
  }).open();
}
