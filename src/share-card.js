// share-card.js — 周统计分享卡片：把本周专注/待办/最佳时段渲染成一张
// 可直接保存的 PNG 卡片（tokyo-night 风格），纯 Canvas 绘制，无外部依赖。

function collectShareCardData(view) {
  const now = window.moment();
  const insights = computeFocusInsights({ history:view._focusHistory || new Map(), completions:view._pomodoroCompletions || [], taskStats:view._pomodoroTaskStats || {}, now });
  const weekStart = now.clone().startOf('isoWeek');
  const weekEnd = weekStart.clone().add(6, 'day');
  const startValue = weekStart.valueOf();
  const endValue = weekEnd.clone().endOf('day').valueOf();
  // doneDate/created 可能是 moment 对象或字符串，统一转毫秒比较，避免依赖插件。
  const toValue = (value) => {
    if (!value) return NaN;
    if (window.moment.isMoment(value)) return value.valueOf();
    const at = Date.parse(value);
    return Number.isFinite(at) ? at : NaN;
  };
  const inRange = (value) => { const at = toValue(value); return Number.isFinite(at) && at >= startValue && at <= endValue; };
  const todos = Array.isArray(view._todos) ? view._todos : [];
  const doneThisWeek = todos.filter((todo) => todo.done && todo.doneDate && inRange(todo.doneDate)).length;
  const createdThisWeek = todos.filter((todo) => todo.created && inRange(todo.created)).length;
  return {
    rangeLabel:weekStart.format('M/D') + ' – ' + weekEnd.format('M/D'),
    weekNumber:(() => { try { return weekStart.isoWeek(); } catch (e) { return ''; } })(),
    thisWeekMinutes:insights.thisWeekMinutes,
    lastWeekMinutes:insights.lastWeekMinutes,
    weekDeltaPct:insights.weekDeltaPct,
    bestHours:insights.bestHours,
    topTasks:insights.topTasks,
    doneThisWeek,
    createdThisWeek
  };
}

function drawShareCard(canvas, data, lang) {
  const en = lang === 'en';
  const W = 900;
  const H = 520;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-2d-unavailable');
  // 背景：tokyo-night 深色渐变
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1a1b2e');
  bg.addColorStop(0.55, '#161623');
  bg.addColorStop(1, '#1f2036');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 霓虹装饰光斑
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(26,27,46,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(120, 90, 220, 'rgba(72,180,255,0.16)');
  glow(W - 100, H - 80, 240, 'rgba(167,139,250,0.14)');
  // 标题区
  ctx.fillStyle = '#8ed7ff';
  ctx.font = '600 22px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText(en ? 'COCKPIT WEEKLY' : 'COCKPIT 周报', 56, 72);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText(data.rangeLabel + (data.weekNumber ? (en ? '  ·  W' + data.weekNumber : '  ·  第' + data.weekNumber + '周') : ''), 54, 126);
  // 三大指标
  const cards = [
    { label:en ? 'Focus minutes' : '专注分钟', value:String(data.thisWeekMinutes),
      sub:data.weekDeltaPct == null ? '' : ((data.weekDeltaPct >= 0 ? '↑ ' : '↓ ') + Math.abs(data.weekDeltaPct) + '% ' + (en ? 'vs last week' : '对比上周')),
      accent:data.weekDeltaPct == null || data.weekDeltaPct >= 0 ? '#34d399' : '#f87171' },
    { label:en ? 'Tasks done' : '本周完成待办', value:String(data.doneThisWeek),
      sub:en ? `${data.createdThisWeek} new this week` : `本周新增 ${data.createdThisWeek} 件`,
      accent:'#48b4ff' },
    { label:en ? 'Golden hours' : '黄金专注时段', value:data.bestHours ? (String(data.bestHours.from).padStart(2,'0') + '–' + String(data.bestHours.to).padStart(2,'0')) : '—',
      sub:data.bestHours ? (en ? `${data.bestHours.minutes} min in 30d` : `近30天 ${data.bestHours.minutes} 分钟`) : (en ? 'No data yet' : '暂无数据'),
      accent:'#f59e0b' }
  ];
  cards.forEach((card, index) => {
    const x = 54 + index * 270;
    const y = 170;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, x, y, 244, 150, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(129,140,248,0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, 244, 150, 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 17px "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillText(card.label, x + 20, y + 36);
    ctx.fillStyle = card.accent;
    ctx.font = '800 52px "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillText(card.value, x + 20, y + 96);
    if (card.sub) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '400 15px "Segoe UI", "PingFang SC", sans-serif';
      ctx.fillText(card.sub, x + 20, y + 128);
    }
  });
  // Top 任务条
  if (data.topTasks.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 18px "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillText(en ? 'Top focus tasks' : '投入最多的任务', 56, 372);
    const maxTask = Math.max(...data.topTasks.map((task) => task.minutes));
    data.topTasks.slice(0, 3).forEach((task, index) => {
      const y = 396 + index * 34;
      const nameWidth = 300;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = '400 16px "Segoe UI", "PingFang SC", sans-serif';
      let label = task.name.length > 22 ? task.name.slice(0, 21) + '…' : task.name;
      ctx.fillText(label, 56, y + 14, nameWidth);
      const barX = 380;
      const barW = Math.max(24, (task.minutes / maxTask) * 400);
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#48b4ff');
      grad.addColorStop(1, '#a78bfa');
      ctx.fillStyle = grad;
      roundRect(ctx, barX, y, barW, 16, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 14px "Segoe UI", "PingFang SC", sans-serif';
      ctx.fillText(task.minutes + 'm', barX + barW + 12, y + 13);
    });
  }
  // 页脚水印
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '400 15px "Segoe UI", "PingFang SC", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Cockpit Dashboard', W - 48, H - 30);
  ctx.textAlign = 'left';
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function downloadShareCard(view, lang) {
  const canvas = document.createElement('canvas');
  const data = collectShareCardData(view);
  drawShareCard(canvas, data, lang);
  canvas.toBlob((blob) => {
    if (!blob) { new obs.Notice(lang === 'en' ? 'Could not export the image.' : '图片导出失败。'); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cockpit-weekly-' + window.moment().format('YYYY-MM-DD') + '.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    new obs.Notice(lang === 'en' ? '✅ Weekly card saved' : '✅ 周报卡片已保存');
  }, 'image/png');
}
