// resurface.js — 旧笔记重现模块：优先展示"往年今天"编辑过的笔记，
// 没有时从长期未动的旧笔记里按"相关性 + 久未访问"加权挑选，激活存量内容。
// 一天内结果稳定（同一天换一换之外不变化），不做任何定时器。

const RESURFACE_MIN_AGE_DAYS = 180;

// 纯函数：从文件元数据中提取标签（行内 #tag + frontmatter tags），供相关性打分使用。
function resurfaceFileTags(metadataCache, file) {
  const tags = new Set();
  try {
    const cache = metadataCache?.getFileCache?.(file);
    (cache?.tags || []).forEach((item) => {
      const tag = String(item?.tag || '').replace(/^#/, '').trim().toLowerCase();
      if (tag) tags.add(tag);
    });
    const fm = cache?.frontmatter?.tags;
    if (fm != null) {
      const list = Array.isArray(fm) ? fm : String(fm).split(/[,\s]+/);
      list.forEach((value) => {
        const tag = String(value || '').replace(/^#/, '').trim().toLowerCase();
        if (tag) tags.add(tag);
      });
    }
  } catch (e) {
    // 元数据不可用时按无标签处理，绝不中断渲染。
  }
  return Array.from(tags);
}

// 纯函数：对候选笔记做相关性打分并排序。
// 打分维度：
//   - 标签重合：与当前未完成待办的标签集合重合越多越高（权重最高，直接关联"你正在做的事"）
//   - 久未访问：距上次修改越久，分数越高（鼓励重拾更久没碰的内容，但封顶避免极端主导）
//   - 往年今天：同日历日期的旧笔记额外加成（保留原来的纪念意义）
//   - 稳定微扰：用文件路径的哈希产生固定小抖动，让同分候选顺序稳定但每天可"换一批"
// 返回 [{ file, score, tags, ageDays, anniversary }]，按分数从高到低排序。
function scoreResurfaceCandidates(files, options = {}) {
  const now = options.now ? window.moment(options.now) : window.moment();
  const activeTags = new Set((options.activeTags || []).map((tag) => String(tag || '').replace(/^#/, '').trim().toLowerCase()).filter(Boolean));
  const metadataCache = options.metadataCache || null;
  const minAgeDays = Number.isFinite(options.minAgeDays) ? options.minAgeDays : RESURFACE_MIN_AGE_DAYS;
  const scored = [];
  (files || []).forEach((file) => {
    if (!file || file.extension !== 'md') return;
    const mtime = window.moment(file.stat.mtime);
    const ageDays = Math.max(0, now.diff(mtime, 'days'));
    const sameMonthDay = mtime.year() < now.year() && mtime.month() === now.month() && Math.abs(mtime.date() - now.date()) <= 1;
    // 非重浮范围（太新且不是往年今天）直接跳过
    if (!sameMonthDay && ageDays < minAgeDays) return;
    const tags = metadataCache ? resurfaceFileTags(metadataCache, file) : [];
    let overlap = 0;
    if (activeTags.size) tags.forEach((tag) => { if (activeTags.has(tag)) overlap++; });
    // 标签重合：每个重合 +100（主导项）
    let score = overlap * 100;
    // 久未访问：按年数线性加成，封顶 50，避免超老笔记永远霸榜
    score += Math.min(50, ageDays / 30);
    // 往年今天：+40
    if (sameMonthDay) score += 40;
    // 稳定微扰：0~1 的小数，来自路径哈希，保证同一天顺序稳定
    const jitter = Math.abs(hashCockpitString(String(file.path || ''))) % 1000 / 1000;
    score += jitter;
    scored.push({ file, score, tags, ageDays, anniversary: sameMonthDay });
  });
  scored.sort((a, b) => b.score - a.score || String(a.file.path).localeCompare(String(b.file.path)));
  return scored;
}

async function buildResurfaceModule(view, root) {
  const en = view._lang() === 'en';

  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: view._t('sections.resurface') });
  title.dataset.section = 'resurface-title';
  const body = root.createDiv({ cls: PLUGIN_ID + '-resurface' });
  body.dataset.section = 'resurface-body';

  let manualOffset = 0; // 「换一批」计数：在加权排序后的候选列表里向后取

  // 收集当前未完成待办的标签，作为"你正在做的事"的相关性信号。
  const collectActiveTags = () => {
    const tags = new Set();
    (view._todos || []).forEach((todo) => {
      if (!todo || todo.done) return;
      (Array.isArray(todo.tags) ? todo.tags : []).forEach((tag) => {
        const normalized = String(tag || '').replace(/^#/, '').trim().toLowerCase();
        if (normalized && normalized !== '_archived') tags.add(normalized);
      });
    });
    return Array.from(tags);
  };

  const pickCandidates = (files) => {
    const scored = scoreResurfaceCandidates(files, {
      activeTags: collectActiveTags(),
      metadataCache: view.app?.metadataCache || null,
      now: window.moment(),
    });
    if (!scored.length) return { list: [], kind: 'empty' };
    // 只要存在往年今天的笔记，"纪念"优先作为标题语义
    const hasAnniversary = scored.some((item) => item.anniversary);
    return { list: scored.map((item) => item.file), kind: hasAnniversary ? 'anniversary' : 'old' };
  };

  const renderCard = async () => {
    body.empty();
    const files = getViewMarkdownFiles(view);
    const { list, kind } = pickCandidates(files);
    if (!list.length) {
      view._resurfaceSummary = '';
      if (typeof cockpitRefreshModuleSummaries === 'function') cockpitRefreshModuleSummaries(view);
      body.createDiv({ cls: PLUGIN_ID + '-resurface-empty', text: en
        ? 'Not enough history yet. Notes untouched for a while will resurface here.'
        : '历史还不够多。超过半年没动过的笔记会出现在这里。' });
      return;
    }
    const start = list.length ? (manualOffset % list.length) : 0;
    const rotated = list.slice(start).concat(list.slice(0, start));
    const shown = rotated.slice(0, 3);
    if (!shown.length) return;
    const headingText = kind === 'anniversary'
      ? (en ? 'On this day in past years' : '往年今天的笔记')
      : (en ? 'Dust off an old note' : '翻翻旧笔记');
    body.createDiv({ cls: PLUGIN_ID + '-resurface-caption', text: headingText });
    view._resurfaceSummary = (kind === 'anniversary' ? (en ? 'On this day · ' : '往年今天 · ') : (en ? 'Old notes · ' : '旧笔记 · ')) + list.length;
    if (typeof cockpitRefreshModuleSummaries === 'function') cockpitRefreshModuleSummaries(view);

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
      manualOffset += 3;
      renderCard().catch((e) => console.warn('Cockpit resurface re-render failed', e));
    };
  };

  const render = () => renderCard().catch((e) => console.warn('Cockpit resurface failed; dashboard basics remain available', e));
  view._refreshResurfaceRef = render;
  await render();
  view._makeModuleCollapsible('resurface', title, body);
  return render;
}
