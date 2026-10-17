// quick-parse.js — 快速记录的自然语言解析：一句话识别日期 / 时间 / 优先级 / 标签。
// 纯函数，只依赖原生 Date；日历双击新建与全局快速记录命令共用同一套规则。

const QUICK_CN_NUM = { 一:1, 二:2, 两:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 };
const QUICK_WEEKDAY = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 日:0, 天:0, 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:0 };
const QUICK_EN_WEEKDAY = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };

function quickParseCount(text) {
  if (/^\d+$/.test(text)) return Number(text);
  if (text === '十') return 10;
  if (/^十[一二三四五六七八九]$/.test(text)) return 10 + QUICK_CN_NUM[text[1]];
  return QUICK_CN_NUM[text] || 0;
}

function quickParseValidDate(year, monthIndex, day) {
  const expectedMonth = new Date(year, monthIndex, 1);
  const value = new Date(year, monthIndex, day);
  return value.getFullYear() === expectedMonth.getFullYear()
    && value.getMonth() === expectedMonth.getMonth()
    && value.getDate() === day ? value : null;
}

// 返回 { text, date:{y,m,d}|null, hasTime, hour, minute, priority:'high'|'mid'|'low'|null, tags, dateFromInput }
// options.defaultDate：未识别到日期时使用（日历格双击传入格子日期）。
function parseQuickTodoInput(raw, now = new Date(), options = {}) {
  let text = ' ' + String(raw || '').replace(/\s+/g, ' ').trim() + ' ';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (base, n) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const take = (re, handler) => {
    const match = text.match(re);
    if (!match) return false;
    const result = handler(match);
    if (result === false) return false;
    text = text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length);
    return true;
  };
  let date = null;
  let hasTime = false; let hour = 0; let minute = 0;
  let priority = null;
  const evening = /今晚|tonight/i.test(text);

  // 优先级：!高 / !!! / !high 等显式标记，不吞掉正文里的普通感叹号。
  take(/[!！](?:高|紧急|high|h)(?=\s)|[!！]{2,}(?=\s)/i, () => { priority = 'high'; });
  if (!priority) take(/[!！](?:中|普通|mid|m)(?=\s)/i, () => { priority = 'mid'; });
  if (!priority) take(/[!！](?:低|low|l)(?=\s)/i, () => { priority = 'low'; });

  // 日期：按从具体到模糊的顺序，只取第一个命中。
  const dateRules = [
    [/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/, (m) => quickParseValidDate(+m[1], +m[2] - 1, +m[3]) || false],
    [/(\d{1,2})月(\d{1,2})[日号]?/, (m) => {
      const candidate = quickParseValidDate(today.getFullYear(), +m[1] - 1, +m[2]);
      if (!candidate) return false;
      return candidate < today ? quickParseValidDate(today.getFullYear() + 1, +m[1] - 1, +m[2]) || false : candidate;
    }],
    [/大后天/, () => addDays(today, 3)],
    [/后天/, () => addDays(today, 2)],
    [/明天|明日|tomorrow/i, () => addDays(today, 1)],
    [/今天|今日|今晚|today|tonight/i, () => today],
    [/(下下|下|本|这)?(?:个)?(?:周|星期|礼拜)([一二三四五六日天1-7])/, (m) => {
      const target = QUICK_WEEKDAY[m[2]];
      const mondayOffset = (today.getDay() + 6) % 7;
      const weekShift = m[1] === '下下' ? 14 : m[1] === '下' ? 7 : 0;
      let candidate = addDays(today, -mondayOffset + ((target + 6) % 7) + weekShift);
      if (!m[1] && candidate < today) candidate = addDays(candidate, 7);
      return candidate;
    }],
    [/\b(next\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i, (m) => {
      // “fri” 指最近的周五（含今天）；“next fri” 与“下周五”一致，取下一自然周的那一天。
      const target = QUICK_EN_WEEKDAY[m[2].toLowerCase()];
      if (m[1]) return addDays(today, 7 - ((today.getDay() + 6) % 7) + ((target + 6) % 7));
      return addDays(today, (target - today.getDay() + 7) % 7);
    }],
    [/(?:这|本)?周末|weekend/i, () => addDays(today, (6 - today.getDay() + 7) % 7)],
    [/下(?:个)?周/, () => addDays(today, 7 - ((today.getDay() + 6) % 7))],
    [/(\d+|[一两二三四五六七八九十]{1,2})天[后以]后?/, (m) => { const n = quickParseCount(m[1]); return n ? addDays(today, n) : false; }],
    [/(?:^|\s)(\d{1,2})号/, (m) => {
      const day = +m[1];
      if (day < 1 || day > 31) return false;
      for (let offset = 0; offset <= 12; offset += 1) {
        const candidate = quickParseValidDate(today.getFullYear(), today.getMonth() + offset, day);
        if (candidate && candidate >= today) return candidate;
      }
      return false;
    }]
  ];
  for (const [re, build] of dateRules) {
    if (take(re, (m) => { const result = build(m); if (result === false) return false; date = result; })) break;
  }

  // 时间：“14:30”“下午3点”“9点半”“晚上8点15分”“3pm”。
  const periodHour = (period, h, bareClock) => {
    if ((/下午|晚上|今晚|pm/i.test(period || '') || (!period && evening)) && h < 12) return h + 12;
    // “两点半开会”这类没写时段的 1–5 点，按下午理解。
    if (bareClock && !period && h >= 1 && h <= 5) return h + 12;
    if (/中午/.test(period || '') && h < 11) return h + 12;
    if (/am/i.test(period || '') && h === 12) return 0;
    return h;
  };
  const timeRules = [
    [/(上午|早上|中午|下午|晚上|今晚)?\s*(\d{1,2})[:：](\d{2})/, (m) => [periodHour(m[1], +m[2]), +m[3]]],
    [/(上午|早上|中午|下午|晚上|今晚)?\s*(\d{1,2}|[一两二三四五六七八九十]{1,3})点(?:(半)|(\d{1,2})分?)?/, (m) => {
      // 中文数字的“一点”“两点”常是普通措辞（快一点），只有带时段词或“半/分”时才当作时间。
      if (!/\d/.test(m[2]) && !m[1] && !m[3] && !m[4]) return [-1, 0];
      return [periodHour(m[1], quickParseCount(m[2]), true), m[3] ? 30 : m[4] ? +m[4] : 0];
    }],
    [/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, (m) => [periodHour(m[3], +m[1]), m[2] ? +m[2] : 0]]
  ];
  for (const [re, build] of timeRules) {
    if (take(re, (m) => {
      const [h, mi] = build(m);
      if (!(h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) return false;
      hasTime = true; hour = h; minute = mi;
    })) break;
  }

  const tags = Array.from(new Set((text.match(/#([^\s#]+)/g) || []).map((tag) => tag.slice(1))));
  const dateFromInput = !!date;
  if (!date && options.defaultDate) date = new Date(options.defaultDate.getFullYear(), options.defaultDate.getMonth(), options.defaultDate.getDate());
  // 只写了时间：今天这个时刻已过就顺延到明天（日历格双击时以格子日期为准）。
  if (!date && hasTime) date = (hour * 60 + minute) <= now.getHours() * 60 + now.getMinutes() ? addDays(today, 1) : today;
  const cleaned = text.replace(/\s+/g, ' ').replace(/^[\s,，、;；]+|[\s,，、;；]+$/g, '').trim();
  return {
    text:cleaned, hasTime, hour, minute, priority, tags, dateFromInput,
    date:date ? { y:date.getFullYear(), m:date.getMonth(), d:date.getDate() } : null
  };
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { parseQuickTodoInput };
