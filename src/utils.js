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
  const d = window.moment(s.trim(),'YYYY-MM-DD',true);
  return d.isValid() ? d : null;
}

function extractTags(text) {
  const tags = [];
  const re = /#([^\s#]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) tags.push(m[1]);
  let dueDate = null;
  const dueM = text.match(/due:\s*(\d{4}-\d{2}-\d{2})/);
  if (dueM) dueDate = parseDate(dueM[1]);
  let priority = 'mid';
  const pM = text.match(/p:\s*(high|mid|low)/);
  if (pM) priority = pM[1];
  const cleanText = text.replace(/#[^\s#]+/g,'').replace(/due:\s*\S+/g,'').replace(/p:\s*\S+/g,'').trim();
  return { cleanText, tags, dueDate, priority };
}

function getDailyTip(lang = DEFAULT_LANG) {
  const dayOfYear = window.moment().dayOfYear();
  const tips = DAILY_TIPS[normalizeLang(lang)] || DAILY_TIPS[DEFAULT_LANG];
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
