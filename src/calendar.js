// calendar.js — 日历看板模块
// 导出：buildCalendar(root, todos, opts) → renderAll 函数

function buildCalendar(root, todos, opts) {
  const { getVault, onTodoToggle, getCurrentTodos } = opts;
  let calYear  = window.moment().year();
  let calMonth = window.moment().month();
  let selDay   = window.moment().date();
  let calRoot  = null;
  let gridEl   = null;
  const DOW_LABELS = ['一','二','三','四','五','六','日'];
  const now = window.moment();

  function buildTodoMap() {
    const m = {};
    (todos || []).forEach(t => {
      if (t.dueDate) {
        const key = t.dueDate.format('YYYY-MM-DD');
        if (!m[key]) m[key] = [];
        m[key].push({ text: t.text, done: t.done, priority: t.priority, raw: t });
      }
    });
    return m;
  }

  function ensureRoot() {
    if (!calRoot || !calRoot.parentNode) {
      calRoot = document.createElement('div');
      calRoot.className = PLUGIN_ID + '-cal-wrap';
      const ref = root.querySelector('.' + PLUGIN_ID + '-search-results');
      if (ref && ref.parentNode) ref.parentNode.insertBefore(calRoot, ref.nextSibling);
      else root.prepend(calRoot);
    }
    calRoot.innerHTML = '';
  }

  function renderDetail(tm) {
    if (!calRoot || !calRoot.parentNode) return;
    const old = calRoot.parentNode.querySelector('.' + PLUGIN_ID + '-cal-detail');
    if (old) old.remove();
    const selDate  = window.moment([calYear, calMonth, selDay]);
    const selKey   = selDate.format('YYYY-MM-DD');
    const items    = tm[selKey] || [];
    const det      = document.createElement('div');
    det.className  = PLUGIN_ID + '-cal-detail';
    calRoot.parentNode.insertBefore(det, calRoot.nextSibling);
    const weekDay = ['周日','周一','周二','周三','周四','周五','周六'][selDate.day()];
    det.createDiv({ cls: PLUGIN_ID + '-cal-detail-title', text: selDate.format('M月D日') + ' ' + weekDay });
    if (!items.length) {
      det.createDiv({ cls: PLUGIN_ID + '-cal-detail-empty', text: '这一天没有待办 🎉' });
    } else {
      items.forEach(td => {
        const citem = det.createDiv({ cls: PLUGIN_ID + '-cal-detail-item' });
        const chk   = citem.createDiv({ cls: PLUGIN_ID + '-cal-detail-check' + (td.done ? ' done' : ''), text: td.done ? '✓' : '' });
        const span  = citem.createSpan({ cls: PLUGIN_ID + '-cal-detail-text' + (td.done ? ' done' : ''), text: (td.done ? '🟢 ' : td.priority === 'high' ? '🔴 ' : td.priority === 'mid' ? '🟡 ' : '🟢 ') + td.text });
        const toggle = async (e) => {
          if (e) e.stopPropagation();
          td.raw.done = !td.raw.done;
          td.raw.doneDate = td.raw.done ? window.moment() : null;
          if (getVault) await saveTodos(getVault(), getCurrentTodos ? getCurrentTodos() : todos);
          renderAll();
          if (onTodoToggle) onTodoToggle();
        };
        chk.onclick  = toggle;
        span.onclick = toggle;
      });
    }
  }

  function renderAll() {
    const todoMap = buildTodoMap();
    ensureRoot();
    const header = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-header' });
    header.createDiv({ cls: PLUGIN_ID + '-cal-title', text: calYear + '年' + (calMonth + 1) + '月' });
    const nav = header.createDiv({ cls: PLUGIN_ID + '-cal-nav' });
    const prevBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '‹' });
    const todayBtn = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '●', attr:{ title:'回到今天' } });
    const nextBtn  = nav.createDiv({ cls: PLUGIN_ID + '-cal-nav-btn', text: '›' });
    gridEl = calRoot.createDiv({ cls: PLUGIN_ID + '-cal-grid' });
    DOW_LABELS.forEach(d => gridEl.createDiv({ cls: PLUGIN_ID + '-cal-dow', text: d }));
    const firstDay    = window.moment([calYear, calMonth, 1]);
    const startDow    = firstDay.day();
    const offset      = startDow === 0 ? 6 : startDow - 1;
    const daysInMonth = firstDay.daysInMonth();
    const prevDays    = window.moment([calYear, calMonth, 1]).subtract(1,'month').daysInMonth();
    for (let i = offset - 1; i >= 0; i--) gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(prevDays - i) });
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = window.moment([calYear, calMonth, d]);
      const dateKey  = cellDate.format('YYYY-MM-DD');
      const dayTodos = todoMap[dateKey] || [];
      const isToday  = cellDate.isSame(now, 'day');
      const isSel    = d === selDay;
      const cls = PLUGIN_ID + '-cal-cell' + (isToday ? ' today' : '') + (dayTodos.length ? ' has-todos' : '') + (isSel ? ' selected' : '');
      const cell = gridEl.createDiv({ cls });
      cell.createSpan({ text: String(d) });
      if (dayTodos.length) {
        const dots = cell.createDiv({ cls: PLUGIN_ID + '-cal-dots' });
        const pc = { high:'#ef4444', mid:'#f59e0b', low:'#22c55e' };
        dayTodos.slice(0,3).forEach(t => { dots.createDiv({ cls: PLUGIN_ID+'-cal-dot', attr:{ style:'background:' + (t.done ? '#22c55e' : (pc[t.priority] || '#818cf8')) } }); });
      }
      cell.onclick = () => { selDay = d; renderDayDetailOnly(todoMap); };
    }
    const total = offset + daysInMonth;
    const needTrail = (7 - (total % 7)) % 7;
    const fill = Math.max(0, 42 - total - needTrail) + needTrail;
    for (let i = 1; i <= fill; i++) gridEl.createDiv({ cls: PLUGIN_ID + '-cal-cell dim', text: String(i) });
    const goMonth = (dir) => {
      gridEl.classList.remove('slide-in');
      gridEl.classList.add(dir > 0 ? 'slide-out-left' : 'slide-out-right');
      setTimeout(() => {
        calMonth += dir;
        if (calMonth < 0)  { calMonth = 11; calYear--; }
        if (calMonth > 11) { calMonth = 0;  calYear++; }
        selDay = Math.min(selDay, window.moment([calYear, calMonth, 1]).daysInMonth());
        renderAll();
        requestAnimationFrame(() => { const g = calRoot.querySelector('.' + PLUGIN_ID + '-cal-grid'); if (g) { g.classList.remove('slide-out-left','slide-out-right'); g.classList.add('slide-in'); } });
      }, 200);
    };
    prevBtn.onclick  = () => goMonth(-1);
    nextBtn.onclick  = () => goMonth(1);
    todayBtn.onclick = () => { calYear = now.year(); calMonth = now.month(); selDay = now.date(); renderAll(); };
    renderDetail(todoMap);
  }

  function renderDayDetailOnly(tm) {
    if (gridEl) { const allCells = gridEl.querySelectorAll('.' + PLUGIN_ID + '-cal-cell'); let cur = 0; allCells.forEach(c => { if (c.classList.contains('dim')) return; cur++; c.classList.toggle('selected', cur === selDay); }); }
    renderDetail(tm);
  }

  renderAll();
  return renderAll;
}
