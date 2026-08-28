// utils.js — 工具函数

function fmtDate(d, lang = DEFAULT_LANG) {
  if (!d) return '';
  const locale = normalizeLang(lang);
  const now = window.moment();
  if (d.isSame(now,'day')) return locale === 'en' ? 'Today' : '今天';
  if (d.clone().add(1,'day').isSame(now,'day')) return locale === 'en' ? 'Yesterday' : '昨天';
  if (d.isSame(now,'year')) return locale === 'en' ? formatMonthDay(d, locale) : d.format('M月D日');
  return d.format('YYYY-M-D');
}

function parseDate(s) {
  if (!s) return null;
  const d = window.moment(s.trim(), ['YYYY-MM-DDTHH:mm','YYYY-MM-DD'], true);
  return d.isValid() ? d : null;
}

function formatTodoDue(d, lang = DEFAULT_LANG, includeTime = false) {
  if (!d) return '';
  const date = fmtDate(d, lang);
  return includeTime ? date + ' ' + d.format('HH:mm') : date;
}

function extractTags(text) {
  const tags = [];
  const re = /#([^\s#]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) tags.push(m[1]);
  let dueDate = null;
  const dueM = text.match(/due:\s*(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?)/);
  if (dueM) dueDate = parseDate(dueM[1]);
  const dueHasTime = !!(dueM && dueM[1].includes('T'));
  let priority = 'mid';
  const pM = text.match(/p:\s*(high|mid|low)/);
  if (pM) priority = pM[1];
  const cleanText = text.replace(/#[^\s#]+/g,'').replace(/due:\s*\S+/g,'').replace(/p:\s*\S+/g,'').trim();
  return { cleanText, tags, dueDate, dueHasTime, priority };
}

function getDailyTip(lang = DEFAULT_LANG, tipLibrary = DEFAULT_DAILY_TIPS) {
  const dayOfYear = window.moment().dayOfYear();
  const tips = tipLibrary[normalizeLang(lang)] || tipLibrary[DEFAULT_LANG] || DEFAULT_DAILY_TIPS[DEFAULT_LANG];
  return tips[dayOfYear % tips.length];
}

function getWeekdayLabels(lang = DEFAULT_LANG, style = 'short') {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    if (style === 'header') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (style === 'long') return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }
  if (style === 'header') return ['一', '二', '三', '四', '五', '六', '日'];
  if (style === 'long') return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return ['日', '一', '二', '三', '四', '五', '六'];
}

function getMonthLabels(lang = DEFAULT_LANG, style = 'short') {
  const locale = normalizeLang(lang);
  if (locale !== 'en') return null;
  if (style === 'long') return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

function formatMonthDay(d, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    return getMonthLabels(locale, 'short')[d.month()] + ' ' + d.date();
  }
  return d.format('M月D日');
}

function formatHeroDate(d, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    return getWeekdayLabels(locale, 'long')[d.day()] + ', ' + getMonthLabels(locale, 'short')[d.month()] + ' ' + d.date() + ', ' + d.year();
  }
  return d.year() + '年' + (d.month() + 1) + '月' + d.date() + '日 ' + getWeekdayLabels(locale, 'long')[d.day()];
}

function formatMonthTitle(year, monthIndex, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') return getMonthLabels(locale, 'long')[monthIndex] + ' ' + year;
  return year + '年' + (monthIndex + 1) + '月';
}

function formatCalendarDetailHeading(d, lang = DEFAULT_LANG) {
  const locale = normalizeLang(lang);
  if (locale === 'en') {
    return getMonthLabels(locale, 'short')[d.month()] + ' ' + d.date() + ' ' + getWeekdayLabels(locale, 'short')[d.day()];
  }
  return d.format('M月D日') + ' ' + getWeekdayLabels(locale, 'long')[d.day()];
}

// 插件自有二级页面共用的桌面拖动能力。handle 只负责拖动，按钮和表单控件
// 继续保留原生点击/输入行为；面板始终被限制在当前可视窗口内。
function makeCockpitDialogDraggable(panel, handle, options = {}) {
  if (!panel || !handle || panel.dataset.cockpitDragBound === 'true') return () => {};
  panel.dataset.cockpitDragBound = 'true';
  handle.classList.add(PLUGIN_ID + '-dialog-drag-handle');
  if (!handle.getAttribute('title')) handle.setAttribute('title', options.label || '拖动窗口');
  let drag = null;
  const interactive = 'button,input,textarea,select,option,a,[contenteditable="true"],[data-no-drag]';
  const clamp = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));
  const move = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const maxLeft = window.innerWidth - drag.width - 8;
    const maxTop = window.innerHeight - drag.height - 8;
    panel.style.left = clamp(drag.left + event.clientX - drag.x, 8, maxLeft) + 'px';
    panel.style.top = clamp(drag.top + event.clientY - drag.y, 8, maxTop) + 'px';
  };
  const end = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    handle.classList.remove('is-dragging');
    try { handle.releasePointerCapture(event.pointerId); } catch (e) {}
  };
  const down = (event) => {
    if (event.button !== 0 || event.target.closest(interactive)) return;
    const rect = panel.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.margin = '0';
    panel.style.transform = 'none';
    drag = { pointerId:event.pointerId, x:event.clientX, y:event.clientY, left:rect.left, top:rect.top, width:rect.width, height:rect.height };
    handle.classList.add('is-dragging');
    try { handle.setPointerCapture(event.pointerId); } catch (e) {}
    event.preventDefault();
  };
  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  return () => {
    handle.removeEventListener('pointerdown', down);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    delete panel.dataset.cockpitDragBound;
  };
}

function makeCockpitModalDraggable(modal, handle, label) {
  if (!modal?.modalEl) return () => {};
  const dragHandle = handle || modal.titleEl || modal.contentEl?.querySelector('h2,h3');
  return makeCockpitDialogDraggable(modal.modalEl, dragHandle, { label });
}

// 视图级 Markdown 文件清单的统一入口：优先复用驾驶舱视图已缓存的
// _allFiles（onOpen / 静默刷新 / 库内事件都会及时更新它），
// 避免每个模块在渲染路径上各自触发一次全库扫描；无缓存可用时兜底现扫。
function getViewMarkdownFiles(view) {
  const cached = view?._allFiles;
  if (Array.isArray(cached) && cached.length) return cached;
  const vault = view?.app?.vault;
  return typeof vault?.getMarkdownFiles === 'function' ? vault.getMarkdownFiles() : [];
}
