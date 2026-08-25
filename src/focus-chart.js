// focus-chart.js — 专注趋势组件（使用 _data/focus.md 中按日保存的分钟数）
function buildFocusChart(view, root) {
  const t = (key, vars) => view._t(key, vars);
  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title', text: t('sections.focusChart') });
  title.dataset.section = 'focus-chart-title';
  const panel = root.createDiv({ cls: PLUGIN_ID + '-focus-chart' });
  panel.dataset.section = 'focus-chart';
  const header = panel.createDiv({ cls: PLUGIN_ID + '-focus-chart-header' });
  const summary = header.createDiv({ cls: PLUGIN_ID + '-focus-chart-summary' });
  const controls = header.createDiv({ cls: PLUGIN_ID + '-focus-chart-controls' });
  const rangeControl = controls.createDiv({ cls: PLUGIN_ID + '-focus-chart-toggle', attr: { role:'group', 'aria-label':t('focusChart.range') } });
  const typeControl = controls.createDiv({ cls: PLUGIN_ID + '-focus-chart-toggle', attr: { role:'group', 'aria-label':t('focusChart.chartType') } });
  const content = panel.createDiv({ cls: PLUGIN_ID + '-focus-chart-content' });
  const render = () => {
    const settings = view._getFocusChartSettings(), isWeek = settings.range === 'week', days = isWeek ? 7 : 30;
    const today = window.moment().startOf('day'), history = view._focusHistory || new Map();
    const data = Array.from({length:days}, (_, i) => { const date = today.clone().subtract(days - 1 - i, 'days'); return { date, minutes:history.get(date.format('YYYY-MM-DD')) || 0 }; });
    const total = data.reduce((sum, item) => sum + item.minutes, 0), max = Math.max(25, ...data.map((item) => item.minutes)), active = data.filter((item) => item.minutes > 0).length;
    summary.empty(); summary.createDiv({ cls:PLUGIN_ID + '-focus-chart-kicker', text:t('focusChart.total', {minutes:total}) }); summary.createDiv({ cls:PLUGIN_ID + '-focus-chart-meta', text:t('focusChart.activeDays', {count:active, days}) });
    const addToggle = (target, values, selected, field) => { target.empty(); values.forEach(([value, label]) => { const button = target.createEl('button', { text:label, attr:{type:'button', 'aria-pressed':String(selected === value)} }); button.classList.toggle('is-active', selected === value); button.onclick = async () => { await view._setFocusChartSettings({[field]:value}); render(); }; }); };
    addToggle(rangeControl, [['week',t('focusChart.week')],['month',t('focusChart.month')]], settings.range, 'range');
    addToggle(typeControl, [['line',t('focusChart.line')],['bar',t('focusChart.bar')]], settings.type, 'type');
    content.empty(); const chart = content.createDiv({ cls:PLUGIN_ID + '-focus-chart-plot' }), graph = chart.createDiv({ cls:PLUGIN_ID + '-focus-chart-graph' });
    const points = data.map((item, i) => ({x:(i / (days - 1)) * 100, y:100 - (item.minutes / max) * 88}));
    const smoothPath = (items) => {
      if (items.length < 2) return '';
      let path = 'M ' + items[0].x + ' ' + items[0].y;
      for (let i = 0; i < items.length - 1; i++) {
        const previous = items[i - 1] || items[i];
        const current = items[i];
        const next = items[i + 1];
        const after = items[i + 2] || next;
        path += ' C ' + (current.x + (next.x - previous.x) / 6) + ' ' + (current.y + (next.y - previous.y) / 6) + ' ' + (next.x - (after.x - current.x) / 6) + ' ' + (next.y - (after.y - current.y) / 6) + ' ' + next.x + ' ' + next.y;
      }
      return path;
    };
    // 不依赖宿主的 DOM 扩展：SVG 子节点使用原生 namespace 创建，避免中断整页布局渲染。
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.entries({ viewBox:'0 0 100 100', preserveAspectRatio:'none', 'aria-hidden':'true' }).forEach(([key, value]) => svg.setAttribute(key, value));
    graph.appendChild(svg);
    const addSvg = (tag, attrs) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value))); svg.appendChild(el); return el; };
    addSvg('line', {x1:0,y1:100,x2:100,y2:100,class:PLUGIN_ID + '-focus-chart-baseline'});
    if (settings.type === 'line') { const linePath = smoothPath(points); addSvg('path', {d:linePath + ' L ' + points[points.length - 1].x + ' 100 L ' + points[0].x + ' 100 Z',class:PLUGIN_ID + '-focus-chart-area'}); addSvg('path', {d:linePath,class:PLUGIN_ID + '-focus-chart-line'}); }
    else { const width = Math.min(8, 74 / days); points.forEach((p, i) => addSvg('rect', {x:Math.max(0,p.x - width / 2),y:p.y,width,height:100-p.y,rx:Math.min(1.4,width/3),class:PLUGIN_ID + '-focus-chart-bar',title:data[i].date.format('YYYY-MM-DD') + ' · ' + data[i].minutes + ' min'})); }
    const labels = chart.createDiv({ cls:PLUGIN_ID + '-focus-chart-labels' }); (isWeek ? data.map((_, i) => i) : [0,7,14,21,29]).forEach((i) => labels.createSpan({text:isWeek ? data[i].date.format('dd').replace('.','') : data[i].date.format('M/D')}));
    const peak = data.reduce((best, item) => item.minutes > best.minutes ? item : best, data[0]); content.createDiv({ cls:PLUGIN_ID + '-focus-chart-caption', text:total ? t('focusChart.peak', {minutes:peak.minutes,date:peak.date.format(isWeek ? 'M/D ddd':'M/D')}) : t('focusChart.empty') });
    // —— 专注洞察：本周 vs 上周 / 最佳时段 / 任务 Top3（数据不足时自动省略对应行）
    try {
      const insights = computeFocusInsights({ history, completions:view._pomodoroCompletions, taskStats:view._pomodoroTaskStats, now:window.moment() });
      const box = content.createDiv({ cls:PLUGIN_ID + '-focus-insights' });
      if (insights.thisWeekMinutes > 0 || insights.lastWeekMinutes > 0) {
        const deltaText = insights.weekDeltaPct == null ? '' : (insights.weekDeltaPct >= 0 ? ' ↑' : ' ↓') + Math.abs(insights.weekDeltaPct) + '%';
        const row = box.createDiv({ cls:PLUGIN_ID + '-fi-row' });
        row.createSpan({ cls:PLUGIN_ID + '-fi-icon', text:'📈' });
        row.createSpan({ text:t('focusChart.insightWeek', { thisWeek:insights.thisWeekMinutes, lastWeek:insights.lastWeekMinutes }) });
        if (deltaText) row.createSpan({ cls:PLUGIN_ID + '-fi-delta ' + (insights.weekDeltaPct >= 0 ? 'is-up' : 'is-down'), text:deltaText });
      }
      if (insights.bestHours) {
        const pad = (n) => String(n).padStart(2, '0');
        const row = box.createDiv({ cls:PLUGIN_ID + '-fi-row' });
        row.createSpan({ cls:PLUGIN_ID + '-fi-icon', text:'⏰' });
        row.createSpan({ text:t('focusChart.insightBestHours', { from:pad(insights.bestHours.from), to:pad(insights.bestHours.to), minutes:insights.bestHours.minutes }) });
      }
      if (insights.topTasks.length) {
        const maxTask = Math.max(...insights.topTasks.map((task) => task.minutes));
        const wrap = box.createDiv({ cls:PLUGIN_ID + '-fi-tasks' });
        insights.topTasks.forEach((task) => {
          const line = wrap.createDiv({ cls:PLUGIN_ID + '-fi-task' });
          line.createDiv({ cls:PLUGIN_ID + '-fi-task-name', text:task.name || '—' });
          const track = line.createDiv({ cls:PLUGIN_ID + '-fi-task-track' });
          track.createDiv({ cls:PLUGIN_ID + '-fi-task-fill', attr:{ style:'width:' + Math.max(6, Math.round(task.minutes / maxTask * 100)) + '%' } });
          line.createDiv({ cls:PLUGIN_ID + '-fi-task-minutes', text:task.minutes + 'm' });
        });
      }
      // 周报分享卡片：Canvas 绘制 PNG，一键保存
      if (insights.thisWeekMinutes > 0 || insights.doneHint !== false) {
        try {
          const shareRow = box.createDiv({ cls:PLUGIN_ID + '-fi-share' });
          const shareBtn = shareRow.createEl('button', { cls:PLUGIN_ID + '-fi-share-btn', attr:{ type:'button' } });
          obs.setIcon(shareBtn.createSpan({ cls:PLUGIN_ID + '-fi-share-icon' }), 'image-down');
          shareBtn.createSpan({ text:t('focusChart.shareCard') });
          shareBtn.onclick = async () => {
            if (shareBtn.disabled) return;
            shareBtn.disabled = true;
            try { downloadShareCard(view, view._lang()); }
            catch (e) { console.warn('Cockpit share card failed', e); new obs.Notice(view._lang() === 'en' ? 'Could not generate the card.' : '卡片生成失败。'); }
            finally { shareBtn.disabled = false; }
          };
        } catch (e) { console.warn('Cockpit share button failed', e); }
      }
    } catch (e) { console.warn('Cockpit focus insights failed', e); }
  };
  render(); view._makeModuleCollapsible('focusChart', title, panel); return render;
}
