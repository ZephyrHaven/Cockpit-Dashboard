// focus-insights.js — 专注洞察的纯计算层。
// 从 _focusHistory（按日分钟数）与 _pomodoroCompletions（带时间戳的会话）里算出：
// 本周 vs 上周对比、最佳专注时段（近30天）、任务投入 Top3。不含任何 DOM。

function startOfIsoWeekKey(momentLike) {
  return momentLike.clone().startOf('isoWeek').format('YYYY-MM-DD');
}

function sumFocusRange(history, startMoment, days) {
  let total = 0;
  for (let offset = 0; offset < days; offset++) {
    const key = startMoment.clone().add(offset, 'day').format('YYYY-MM-DD');
    total += Number(history.get(key)) || 0;
  }
  return total;
}

function computeFocusInsights(options = {}) {
  const history = options.history instanceof Map ? options.history : new Map();
  const completions = Array.isArray(options.completions) ? options.completions : [];
  const taskStats = options.taskStats && typeof options.taskStats === 'object' ? options.taskStats : {};
  const now = options.now;

  // —— 本周 vs 上周（ISO 周，周一为起点）
  const thisWeekStart = now.clone().startOf('isoWeek');
  const lastWeekStart = thisWeekStart.clone().subtract(7, 'day');
  const thisWeekMinutes = sumFocusRange(history, thisWeekStart, 7);
  const lastWeekMinutes = sumFocusRange(history, lastWeekStart, 7);
  let weekDeltaPct = null;
  if (lastWeekMinutes > 0) weekDeltaPct = Math.round((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes * 100);
  else if (thisWeekMinutes > 0) weekDeltaPct = null; // 上周为零时不给误导性的 +∞

  // —— 最佳时段：近 30 天会话按小时聚合，取连续两小时窗口（允许跨午夜）
  const cutoff = now.clone().subtract(30, 'day').valueOf();
  const hourBuckets = new Array(24).fill(0);
  completions.forEach((entry) => {
    const at = Date.parse(entry?.completedAt || '');
    if (!Number.isFinite(at) || at < cutoff.valueOf()) return;
    const minutes = Math.max(0, Math.min(1440, Math.round(Number(entry?.minutes) || 0)));
    const hour = new Date(at).getHours();
    hourBuckets[hour] += minutes;
  });
  const totalTracked = hourBuckets.reduce((sum, value) => sum + value, 0);
  let bestHours = null;
  if (totalTracked >= 25) {
    let bestSum = -1;
    let bestHour = 0;
    for (let hour = 0; hour < 24; hour++) {
      const windowSum = hourBuckets[hour] + hourBuckets[(hour + 1) % 24];
      if (windowSum > bestSum) { bestSum = windowSum; bestHour = hour; }
    }
    if (bestSum > 0) bestHours = { from:bestHour, to:(bestHour + 2) % 24, minutes:bestSum };
  }

  // —— 任务投入 Top3
  const topTasks = Object.values(taskStats)
    .filter((entry) => entry && Number(entry.totalMinutes) > 0)
    .sort((a, b) => Number(b.totalMinutes) - Number(a.totalMinutes))
    .slice(0, 3)
    .map((entry) => ({ name:String(entry.text || entry.taskId || '').slice(0, 40), minutes:Number(entry.totalMinutes) || 0 }));

  return { thisWeekMinutes, lastWeekMinutes, weekDeltaPct, bestHours, topTasks };
}
