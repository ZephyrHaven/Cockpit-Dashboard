// hero-section.js — 从 _framework.js 的 _buildAll() 拆出的 Hero 首屏区块（三行结构）。
// 负责语言切换器、情景切换入口、问候语与昵称内联编辑、今日概览与库内天数，
// 并把问候/概览/天数元素句柄回写到 view._heroRefs 供 _refreshHeroSection 局部刷新。
// 通过 ctx 注入 _buildAll 侧共享的 t/lang/now/days/gr 上下文。
function cockpitBuildHeroSection(view, root, ctx) {
  const { t, lang, now, days, gr } = ctx;
  // ===== 1. Hero — 三行结构 =====
root.createDiv({ cls: PLUGIN_ID+'-hero' }, el => {
  const heroControls = el.createDiv({ cls: PLUGIN_ID+'-hero-controls' });
  const langSwitch = heroControls.createDiv({ cls: PLUGIN_ID+'-lang-switch', attr:{ 'aria-label': t('hero.language') } });
  const applyLang = async (btn, nextLang) => {
    if (!nextLang || nextLang === view._lang()) return;
    langSwitch.querySelectorAll('.' + PLUGIN_ID + '-lang-btn').forEach(elm => {
      elm.classList.toggle('active', elm === btn);
      elm.classList.remove('pressing');
    });
    btn.classList.add('pressing');
    setTimeout(() => btn.classList.remove('pressing'), 220);
    await view._setLanguage(nextLang);
  };
  LANG_OPTIONS.forEach((option) => {
    const btn = langSwitch.createEl('button', {
      cls: PLUGIN_ID+'-lang-btn'+(lang===option.code?' active':''),
      attr: { title: option.label, type: 'button', 'data-lang': option.code },
      text: option.short,
    });
    btn.addEventListener('pointerdown', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      btn.classList.add('pressing');
    });
    btn.addEventListener('pointerup', async (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      await applyLang(btn, option.code);
    });
    btn.addEventListener('keydown', async (evt) => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return;
      evt.preventDefault();
      evt.stopPropagation();
      await applyLang(btn, option.code);
    });
    btn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
    });
  });
  langSwitch.addEventListener('pointerleave', () => {
    langSwitch.querySelectorAll('.' + PLUGIN_ID + '-lang-btn').forEach(elm => elm.classList.remove('pressing'));
  });
  buildSceneSwitcher(this, heroControls);
  const greetLine = el.createDiv({ cls: PLUGIN_ID+'-greeting' });
  const greetingPrefixEl = greetLine.createSpan({ text: gr+'，' });
  let currNameSpan = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: view._username });
  const startEdit = (span) => {
    const inp = document.createElement('input');
    inp.className = PLUGIN_ID+'-name-input';
    inp.type = 'text';
    inp.value = view._username;
    span.replaceWith(inp);
    inp.focus();
    inp.select();
    let saved = false;
    const finish = async (cancel) => {
      if (saved) return;
      saved = true;
      if (cancel) { const ns = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: view._username }); inp.replaceWith(ns); ns.onclick = () => startEdit(ns); return; }
      const v = inp.value.trim() || t('hero.defaultName');
      view._username = v;
      try { await view._mutatePluginData((data) => { data.username = v; }); } catch(e) { console.warn('Cockpit: save username failed', e); }
      const ns = greetLine.createSpan({ cls: PLUGIN_ID+'-name', text: v });
      inp.replaceWith(ns);
      ns.onclick = () => startEdit(ns);
    };
    inp.addEventListener('keydown', ke => { if (ke.key === 'Enter') { ke.preventDefault(); finish(false); } if (ke.key === 'Escape') { ke.preventDefault(); finish(true); } });
    inp.addEventListener('blur', () => finish(false));
  };
  currNameSpan.onclick = () => startEdit(currNameSpan);
  greetLine.createSpan({ text: '！' });
  const todayStr = formatHeroDate(now, lang);
  let heroSubText = t('hero.today', { date: todayStr });
  const dueText = view._getHeroDueText(now);
  if (dueText) heroSubText += ' · ' + dueText;
  const heroSummaryEl = el.createDiv({ cls: PLUGIN_ID+'-sub', text: heroSubText });
  const heroDaysEl = el.createDiv({ cls: PLUGIN_ID+'-sub', text: t('hero.vaultDays', { days }) });
  view._heroRefs = { greetingPrefixEl, summaryEl: heroSummaryEl, daysEl: heroDaysEl };
});

  view._refreshHeroReminder = view._refreshHeroSection.bind(view);
  view._refreshHeroReminder();
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { cockpitBuildHeroSection };
