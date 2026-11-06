// calendar-drag.js — 日历事项共用原生拖放；宿主负责移动阈值与跟手预览。
function bindCalendarTodoDrag(el, todo, getRoot) {
  if (todo.teamTodo || todo.done || !todo.raw?.id) return;
  let dragged = false;
  let blocked = false;
  el.setAttribute('draggable', 'true');
  el.classList.add('is-calendar-draggable');
  el.addEventListener('pointerdown', (event) => {
    dragged = false;
    const control = event.target.closest('button, input, select, textarea, a');
    blocked = !!control && !control.classList.contains(PLUGIN_ID + '-cal-timeline-title') && !control.classList.contains(PLUGIN_ID + '-cal-line');
  });
  el.addEventListener('keydown', () => { dragged = false; });
  // 拖拽后的合成 click 不得打开详情；下一次主动按下仍正常打开。
  el.addEventListener('click', (event) => {
    if (!dragged) return;
    event.preventDefault(); event.stopImmediatePropagation();
    dragged = false;
  }, true);
  el.addEventListener('dragstart', (event) => {
    const root = getRoot();
    if (blocked || !event.dataTransfer || root?.closest('.' + PLUGIN_ID + '-layout-editing')) { event.preventDefault(); return; }
    event.stopPropagation();
    dragged = true;
    event.dataTransfer.setData('application/x-cockpit-todo', todo.raw.id);
    event.dataTransfer.setData('application/x-cockpit-calendar', '1');
    event.dataTransfer.effectAllowed = 'move';
    el.classList.add('is-dragging');
    root?.classList.add('is-dragging-todo');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
    const root = getRoot();
    root?.classList.remove('is-dragging-todo');
    root?.querySelectorAll('.todo-drop-target').forEach((target) => target.classList.remove('todo-drop-target'));
  });
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports={bindCalendarTodoDrag};
