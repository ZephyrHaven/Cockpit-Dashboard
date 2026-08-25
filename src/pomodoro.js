// pomodoro.js — 番茄钟入口
// 真正实现位于 CockpitView._buildPomodoro，避免双份代码继续分叉。

function buildPomodoro(view, root) {
  if (view && typeof view._buildPomodoro === 'function') {
    return view._buildPomodoro(root);
  }
  console.warn('Cockpit: buildPomodoro bridge failed, _buildPomodoro is unavailable');
}
