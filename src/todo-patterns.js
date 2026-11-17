// todo-patterns.js — 已完成任务模式分析（纯计算层）：从待办历史里提炼
// "平均完成耗时 / 最易拖延标签 / 完成高峰时段"等模式，供只读详情窗展示。
// 只读取已在内存中的 view._todos，无副作用、无存储改动。

// 纯函数：把待办集合归纳成完成模式统计。
// 依赖待办字段：done、created、doneDate、dueDate、priority、tags（均为 moment 或数组）。
// now 用于计算逾期；缺时间字段的条目会被安全跳过，不抛错。
function computeTodoPatterns(todos, now = (typeof window !== 'undefined' && window.moment ? window.moment() : null)) {
  const list = Array.isArray(todos) ? todos.filter((t) => t && typeof t === 'object') : [];
  const doneTodos = list.filter((t) => t.done);
  const openTodos = list.filter((t) => !t.done);

  // 1) 完成耗时：created → doneDate 的天数
  const durations = [];
  doneTodos.forEach((t) => {
    if (t.created && t.doneDate && typeof t.created.diff === 'function') {
      const days = t.doneDate.diff(t.created, 'days');
      if (Number.isFinite(days) && days >= 0) durations.push(days);
    }
  });
  const avgDoneDays = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const medianDoneDays = durations.length ? durations.slice().sort((a, b) => a - b)[Math.floor(durations.length / 2)] : null;

  // 2) 按标签聚合：完成数、平均耗时、逾期占比（仅统计有标签的条目；_archived 排除）
  const tagStats = new Map();
  const addTag = (tag, patch) => {
    const key = String(tag || '').replace(/^#/, '').trim().toLowerCase();
    if (!key || key === '_archived') return;
    const entry = tagStats.get(key) || { tag: key, done: 0, open: 0, overdue: 0, doneDaysSum: 0, doneDaysCount: 0 };
    patch(entry);
    tagStats.set(key, entry);
  };
  const isOverdue = (t) => {
    if (t.done || !t.dueDate) return false;
    const dueMs = typeof t.dueDate.valueOf === 'function' ? t.dueDate.valueOf() : NaN;
    const nowMs = now && typeof now.valueOf === 'function' ? now.valueOf() : Date.now();
    if (!Number.isFinite(dueMs)) return false;
    if (t.dueHasTime) return dueMs < nowMs;
    const dueDay = new Date(dueMs); dueDay.setHours(0, 0, 0, 0);
    const today = new Date(nowMs); today.setHours(0, 0, 0, 0);
    return dueDay.getTime() < today.getTime();
  };
  list.forEach((t) => {
    const tags = Array.isArray(t.tags) ? t.tags : [];
    const overdue = isOverdue(t);
    const dur = (t.done && t.created && t.doneDate && typeof t.created.diff === 'function') ? t.doneDate.diff(t.created, 'days') : null;
    tags.forEach((tag) => addTag(tag, (e) => {
      if (t.done) { e.done++; if (Number.isFinite(dur) && dur >= 0) { e.doneDaysSum += dur; e.doneDaysCount++; } }
      else { e.open++; if (overdue) e.overdue++; }
    }));
  });
  const tagRows = Array.from(tagStats.values()).map((e) => ({
    tag: e.tag,
    done: e.done,
    open: e.open,
    overdue: e.overdue,
    avgDoneDays: e.doneDaysCount ? e.doneDaysSum / e.doneDaysCount : null,
    overdueRate: (e.open + e.done) ? e.overdue / (e.open + e.done) : 0,
  }));

  // 3) 完成高峰：按 doneDate 的小时分布
  const hourBuckets = new Array(24).fill(0);
  doneTodos.forEach((t) => {
    if (t.doneDate && typeof t.doneDate.hour === 'function') hourBuckets[t.doneDate.hour()] += 1;
  });
  let peakHour = null, peakCount = 0;
  hourBuckets.forEach((count, hour) => { if (count > peakCount) { peakCount = count; peakHour = hour; } });

  // 4) 最易拖延：open 数最多的标签 / 逾期率最高的标签（要求至少 1 项未完成）
  const mostBacklogged = tagRows.filter((r) => r.open > 0).sort((a, b) => b.open - a.open)[0] || null;
  const mostOverdue = tagRows.filter((r) => r.overdue > 0).sort((a, b) => b.overdueRate - a.overdueRate || b.overdue - a.overdue)[0] || null;

  return {
    doneCount: doneTodos.length,
    openCount: openTodos.length,
    avgDoneDays,
    medianDoneDays,
    sampleSize: durations.length,
    peakHour,
    peakCount,
    tagRows: tagRows.sort((a, b) => b.done - a.done || b.open - a.open),
    mostBacklogged,
    mostOverdue,
  };
}
