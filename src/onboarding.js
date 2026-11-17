// onboarding.js — 首次使用引导：欢迎封面兜底 + 区域引导卡片。
// 从 _framework.js 拆出的独立职责：只负责引导流程自身 DOM 与交互；
// 共享状态仍挂在 view 上（视图侧提供 _mutatePluginData / _t / _lang / _setLanguage 等）。
// _framework.js 中的方法名保留为薄委托，兼容插件生命周期内的既有调用点。

// 首次使用引导的完成状态落盘。
function cockpitMarkOnboardingDone(view) {
  view._onboardingDone = true;
  view._mutatePluginData((data) => { data.onboardingDone = true; })
    .catch((e) => console.warn('save onboard', e));
}

function cockpitCloseWelcomeCover(view) {
  if (view._welcomeCoverEl && view._welcomeCoverEl.parentNode) view._welcomeCoverEl.remove();
  view._welcomeCoverEl = null;
}

function cockpitShowWelcomeCover(view, root) {
  if (view._onboardingDone) return;
  cockpitCloseWelcomeCover(view);
  const PID = PLUGIN_ID;
  const t = (key, vars) => view._t(key, vars);
  let selectedLang = view._language;

  const overlay = document.createElement('div');
  overlay.className = PID + '-welcome-backdrop'; if (typeof cockpitAnimateOverlay === 'function') cockpitAnimateOverlay(overlay);
  const card = overlay.createDiv({ cls: PID + '-welcome-card' });
  const welcomeHandle = card.createDiv({ cls: PID + '-welcome-drag-area' });
  welcomeHandle.createDiv({ cls: PID + '-welcome-badge', text: t('welcome.badge') });
  welcomeHandle.createDiv({ cls: PID + '-welcome-title', text: t('welcome.title') });
  makeCockpitDialogDraggable(card, welcomeHandle, { label: view._lang() === 'en' ? 'Drag welcome window' : '拖动欢迎窗口' });
  const intro = card.createDiv({ cls: PID + '-welcome-intro' });
  intro.createDiv({ cls: PID + '-welcome-copy primary', text: t('welcome.introCn') });
  intro.createDiv({ cls: PID + '-welcome-copy', text: t('welcome.introEn') });

  const langBlock = card.createDiv({ cls: PID + '-welcome-lang-block' });
  langBlock.createDiv({ cls: PID + '-welcome-label', text: t('welcome.chooseLanguage') });
  const langRow = langBlock.createDiv({ cls: PID + '-welcome-lang-row' });
  const renderLangs = () => {
    langRow.empty();
    LANG_OPTIONS.forEach((option) => {
      const btn = langRow.createEl('button', {
        cls: PID + '-welcome-lang-btn' + (selectedLang === option.code ? ' active' : ''),
        text: option.label,
        attr: { type: 'button' }
      });
      btn.onclick = () => {
        selectedLang = option.code;
        renderLangs();
      };
    });
  };
  renderLangs();

  const actions = card.createDiv({ cls: PID + '-welcome-actions' });
  const skipBtn = actions.createEl('button', {
    cls: PID + '-welcome-skip',
    text: t('welcome.skip'),
    attr: { type: 'button' }
  });
  skipBtn.onclick = async () => {
    cockpitCloseWelcomeCover(view);
    if (selectedLang !== view._language) {
      await view._setLanguage(selectedLang);
    }
    cockpitMarkOnboardingDone(view);
  };
  const startBtn = actions.createEl('button', {
    cls: PID + '-welcome-start',
    text: t('welcome.continue'),
    attr: { type: 'button' }
  });
  startBtn.onclick = async () => {
    cockpitCloseWelcomeCover(view);
    if (selectedLang !== view._language) {
      view._pendingOnboarding = true;
      await view._setLanguage(selectedLang);
      return;
    }
    cockpitShowOnboarding(view, root);
  };

  view._welcomeCoverEl = overlay;
  document.body.appendChild(overlay);
}

function cockpitShowOnboarding(view, root) {
  if (view._onboardingDone) return;
  cockpitCloseWelcomeCover(view);
  const PID = PLUGIN_ID;
  const t = (key, vars) => view._t(key, vars);

  const steps = [
    { sel: '.'+PID+'-name', text: t('onboarding.stepName'), pos: 'below' },
    { sel: '.'+PID+'-toolbar', text: t('onboarding.stepToolbar'), pos: 'below' },
    { sel: '.'+PID+'-cal-wrap', text: t('onboarding.stepCalendar'), pos: 'above' },
    { sel: '.'+PID+'-todo-header', text: t('onboarding.stepTodo'), pos: 'above' },
    { sel: '.'+PID+'-toolbar', text: t('onboarding.stepContextMenu'), pos: 'below' },
    { sel: '.'+PID+'-stats', text: t('onboarding.stepStats'), pos: 'above' },
  ];
  const pomoEl = document.querySelector('.'+PID+'-pomodoro');
  if (pomoEl) steps.push({ el: pomoEl, text: t('onboarding.stepPomodoro'), pos: 'pomo' });

  let cur = 0, hlEl = null, card = null, tourDragCleanup = null;

  const highlight = (s) => {
    if (hlEl) { hlEl.classList.remove(PID+'-onboarding-highlight'); hlEl = null; }
    const a = s.el || root.querySelector(s.sel);
    if (a) { hlEl = a; a.classList.add(PID+'-onboarding-highlight'); if (s.pos !== 'pomo') a.scrollIntoView({behavior:'smooth',block:'center'}); }
  };

  const positionCard = (s) => {
    if (!card) return;
    const a = s.el || root.querySelector(s.sel);
    if (!a || s.pos === 'pomo') {
      // fallback: bottom-right
      card.style.bottom = '80px';
      card.style.right = '220px';
      card.style.top = 'auto';
      card.style.left = 'auto';
      return;
    }
    const rect = a.getBoundingClientRect();
    const pad = 12;
    let top, left;
    if (s.pos === 'below') {
      top = rect.bottom + pad;
      left = Math.max(12, Math.min(rect.left, window.innerWidth - 360));
    } else {
      top = rect.top - pad - (card.firstChild ? card.offsetHeight || 120 : 120);
      left = Math.max(12, Math.min(rect.left, window.innerWidth - 360));
    }
    // clamp
    top = Math.max(8, Math.min(top, window.innerHeight - 160));
    card.style.top = top + 'px';
    card.style.left = left + 'px';
    card.style.bottom = 'auto';
    card.style.right = 'auto';
  };

  const buildCard = (i) => {
    if (i >= steps.length) { finish(); return; }
    const s = steps[i];
    if (!card) {
      card = document.createElement('div');
      card.id = PID+'-tour';
      card.className = PID + '-onboarding-card';
      document.body.appendChild(card);
    }
    card.empty();
    card.style.opacity = '1';
    // header
    const top = document.createElement('div');
    top.className = PID + '-onboarding-card-head';
    const num = document.createElement('span');
    num.textContent = (i+1)+'/'+steps.length;
    num.className = PID + '-onboarding-card-step';
    top.appendChild(num);
    const cl = document.createElement('button');
    cl.textContent = t('onboarding.close');
    cl.className = PID + '-onboarding-card-close';
    cl.onclick = finish;
    top.appendChild(cl);
    card.appendChild(top);
    tourDragCleanup?.();
    tourDragCleanup = makeCockpitDialogDraggable(card, top, { label: view._lang() === 'en' ? 'Drag onboarding guide' : '拖动新手引导窗口' });
    // body
    const body = document.createElement('div');
    body.textContent = s.text;
    body.className = PID + '-onboarding-card-body';
    card.appendChild(body);
    // buttons
    const btnRow = document.createElement('div');
    btnRow.className = PID + '-onboarding-card-actions';
    if (i > 0) {
      const pb = document.createElement('button');
      pb.textContent = t('onboarding.prev');
      pb.className = PID + '-onboarding-card-btn secondary';
      pb.onclick = () => { cur = i-1; buildCard(cur); };
      btnRow.appendChild(pb);
    }
    const nb = document.createElement('button');
    nb.textContent = i < steps.length-1 ? t('onboarding.next') : t('onboarding.done');
    nb.className = PID + '-onboarding-card-btn primary';
    nb.onclick = () => { cur = i+1; buildCard(cur); };
    btnRow.appendChild(nb);
    card.appendChild(btnRow);
    highlight(s);
    requestAnimationFrame(() => { positionCard(s); });
    cur = i;
  };

  const finish = () => {
    tourDragCleanup?.();
    tourDragCleanup = null;
    if (hlEl) hlEl.classList.remove(PID+'-onboarding-highlight');
    const c = document.getElementById(PID+'-tour');
    if (c) { c.style.opacity = '0'; setTimeout(() => c.remove(), 300); }
    cockpitMarkOnboardingDone(view);
  };

  buildCard(0);
}
