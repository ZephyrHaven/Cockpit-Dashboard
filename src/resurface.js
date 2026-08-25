// resurface.js — 旧笔记重现模块：优先展示“往年今天”编辑过的笔记，
// 没有时按日期种子从长期未动的旧笔记里挑一篇，激活存量内容。
// 一天内结果稳定（同一天换一换之外不变化），不做任何定时器。

const RESURFACE_MIN_AGE_DAYS = 180;

async function buildResurfaceModule(view, root) {
  const en = view._lang() === 'en';

  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: view._t('sections.resurface') });
  title.dataset.section = 'resurface-title';
  const body = root.createDiv({ cls: PLUGIN_ID + '-resurface' });
  body.dataset.section = 'resurface-body';

  let manualOffset = 0; // 「换一批」计数：在候选列表里向后取

  const pickCandidates = (files) => {
    const now = window.moment();
    const mdFiles = files.filter((file) => file.extension === 'md');
    // 1) 往年同月同日（±1 天）编辑过的笔记 —— “一年前的今天”
    const anniversary = mdFiles.filter((file) => {
      const mtime = window.moment(file.stat.mtime);
      return mtime.year() < now.year()
        && mtime.month() === now.month()
        && Math.abs(mtime.date() - now.date()) <= 1;
    });
    if (anniversary.length) return { list:anniversary.slice().sort((a, b) => b.stat.mtime - a.stat.mtime), kind:'anniversary' };
    // 2) 长期未动的旧笔记，按日期做稳定随机种子
    const old = mdFiles.filter((file) => now.diff(window.moment(file.stat.mtime), 'days') >= RESURFACE_MIN_AGE_DAYS)
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path));
    if (!old.length) return { list:[], kind:'empty' };
    const seed = Number(now.format('YYYYMMDD')) + manualOffset;
    const start = Math.abs(hashCockpitString(String(seed))) % old.length;
    const rotated = old.slice(start).concat(old.slice(0, start));
    return { list:rotated, kind:'old' };
  };

  const renderCard = async () => {
    body.empty();
    const files = view.app.vault.getMarkdownFiles();
    const { list, kind } = pickCandidates(files);
    if (!list.length) {
      body.createDiv({ cls: PLUGIN_ID + '-resurface-empty', text: en
        ? 'Not enough history yet. Notes untouched for a while will resurface here.'
        : '历史还不够多。超过半年没动过的笔记会出现在这里。' });
      return;
    }
    const start = list.length ? (manualOffset % list.length) : 0;
    const shown = list.slice(start, start + 3);
    if (!shown.length) return;
    const headingText = kind === 'anniversary'
      ? (en ? 'On this day in past years' : '往年今天的笔记')
      : (en ? 'Dust off an old note' : '翻翻旧笔记');
    body.createDiv({ cls: PLUGIN_ID + '-resurface-caption', text: headingText });

    for (const file of shown) {
      const card = body.createDiv({ cls: PLUGIN_ID + '-resurface-card', attr:{ role:'button', tabindex:'0' } });
      const main = card.createDiv({ cls: PLUGIN_ID + '-resurface-main' });
      main.createDiv({ cls: PLUGIN_ID + '-resurface-name', text: file.basename });
      const years = Math.max(1, Math.floor(window.moment().diff(window.moment(file.stat.mtime), 'days') / 365));
      main.createDiv({ cls: PLUGIN_ID + '-resurface-meta', text: window.moment(file.stat.mtime).format('YYYY-MM-DD') + ' · ' + (en ? years + ' yr(s) ago' : years + ' 年前') });
      const open = () => { if (!view._editMode) view.app.workspace.getUnpinnedLeaf().setViewState({ type:'markdown', state:{ file:file.path } }); };
      card.onclick = open;
      card.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
    }

    const shuffle = body.createEl('button', { cls: PLUGIN_ID + '-resurface-shuffle', attr:{ type:'button', title:en ? 'Show others' : '换一批', 'aria-label':en ? 'Show other notes' : '换一批笔记' } });
    obs.setIcon(shuffle, 'dices');
    shuffle.createSpan({ text: en ? 'Shuffle' : '换一批' });
    shuffle.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      manualOffset += 1;
      renderCard().catch((e) => console.warn('Cockpit resurface re-render failed', e));
    };
  };

  const render = () => renderCard().catch((e) => console.warn('Cockpit resurface failed; dashboard basics remain available', e));
  view._refreshResurfaceRef = render;
  await render();
  view._makeModuleCollapsible('resurface', title, body);
  return render;
}
