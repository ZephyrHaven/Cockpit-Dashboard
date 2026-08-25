// habits.js — 习惯打卡仪表盘模块：列表、最近 7 天补卡、连续天数。
// 数据读写全部走 habits-core 的行级队列；模块自身只做局部渲染，不触发整页刷新。

async function buildHabitsModule(view, root) {
  const en = view._lang() === 'en';
  const t = (key, vars) => view._t(key, vars);
  const vault = view.app.vault;

  // 与 stats/cats 相同的标题写法：裸文本节点 + 按钮子元素，支持模块重命名。
  const title = root.createDiv({ cls: PLUGIN_ID + '-section-title ' + PLUGIN_ID + '-habits-title', text: t('sections.habits') });
  title.dataset.section = 'habits-title';
  const addBtn = title.createEl('button', { cls: PLUGIN_ID + '-alarm-add', attr: { type:'button', title:en?'New habit':'新建习惯', 'aria-label':en?'New habit':'新建习惯' } });
  obs.setIcon(addBtn, 'plus');

  const body = root.createDiv({ cls: PLUGIN_ID + '-habits' });
  body.dataset.section = 'habits-body';

  // 最近 7 天的日期键（含今天，升序）。
  const weekKeys = (() => {
    const today = window.moment();
    return Array.from({ length:7 }, (_, index) => today.clone().subtract(6 - index, 'day').format('YYYY-MM-DD'));
  })();
  const todayKey = weekKeys[weekKeys.length - 1];

  const notifyFail = () => new obs.Notice(en ? 'Could not save habits. Nothing was changed.' : '习惯保存失败，内容未发生变化。');

  const render = async () => {
    let habits = [];
    try { habits = await loadHabits(vault); } catch (e) { console.warn('Cockpit habits load failed', e); }
    // 兼容手写/旧文件里没有 id 的行：一次性回写随机 ID，否则后续勾选无法定位。
    if (habits.some((habit) => !habit.id)) {
      try {
        const migrated = await mutateHabits(vault, (list) => {
          list.forEach((habit) => { if (!habit.id) habit.id = habitId(); });
          return true;
        });
        if (migrated.saved && Array.isArray(migrated.habits)) habits = migrated.habits;
      } catch (e) { console.warn('Cockpit habit id migration failed', e); }
    }
    body.empty();

    const streakOf = (habit) => computeStreak(habit.log || [], window.moment());
    const doneToday = (habit) => (habit.log || []).includes(todayKey);

    if (!habits.length) {
      const empty = body.createDiv({ cls: PLUGIN_ID + '-habit-empty' });
      obs.setIcon(empty.createSpan(), 'flame');
      empty.createDiv({ text: en ? 'No habits yet. Track a small daily win here.' : '还没有习惯。在这里记录每天的小胜利。' });
    }

    habits.forEach((habit) => {
      const logSet = new Set(habit.log || []);
      const row = body.createDiv({ cls: PLUGIN_ID + '-habit-row' + (doneToday(habit) ? ' done' : '') });
      row.dataset.habitId = habit.id || '';

      const icon = row.createDiv({ cls: PLUGIN_ID + '-habit-icon', text: habit.icon || '🔥' });

      const main = row.createDiv({ cls: PLUGIN_ID + '-habit-main' });
      main.createDiv({ cls: PLUGIN_ID + '-habit-name', text: habit.name });
      const meta = main.createDiv({ cls: PLUGIN_ID + '-habit-meta' });
      const streak = streakOf(habit);
      if (streak > 0) {
        const badge = meta.createSpan({ cls: PLUGIN_ID + '-habit-streak', text: '🔥 ' + streak + (en ? 'd streak' : ' 天连胜') });
        badge.title = en ? 'Consecutive days including today (or yesterday)' : '连续打卡天数（今天未打卡时按昨天计）';
      } else {
        meta.createSpan({ cls: PLUGIN_ID + '-habit-streak none', text: en ? 'Start a streak today' : '今天开始连击' });
      }

      // 最近 7 天打卡格：点击即可打卡 / 取消（支持补卡）。
      const strip = row.createDiv({ cls: PLUGIN_ID + '-habit-week' });
      weekKeys.forEach((key) => {
        const cell = strip.createEl('button', {
          cls: PLUGIN_ID + '-habit-day' + (logSet.has(key) ? ' on' : '') + (key === todayKey ? ' today' : ''),
          attr: { type:'button', title:key, 'aria-label':habit.name + ' · ' + key }
        });
        cell.textContent = String(window.moment(key).date());
        cell.onclick = async (event) => {
          event.preventDefault();
          const outcome = await mutateHabits(vault, (list) => {
            const target = list.find((item) => item.id === habit.id);
            if (!target) return false;
            const set = new Set(target.log || []);
            if (set.has(key)) set.delete(key);
            else set.add(key);
            target.log = normalizeHabitLog(Array.from(set));
            return true;
          });
          if (!outcome.saved) { notifyFail(); return; }
          render().catch((e) => console.warn('Cockpit habit re-render failed', e));
          view._refreshWeeklyReviewRef?.();
        };
      });

      const actions = row.createDiv({ cls: PLUGIN_ID + '-habit-actions' });
      const edit = actions.createEl('button', { attr:{ type:'button', title:en?'Rename / icon':'改名 / 图标', 'aria-label':en?'Edit habit':'编辑习惯' } });
      obs.setIcon(edit, 'pencil');
      edit.onclick = () => {
        const nextName = normalizeHabitName(window.prompt(en ? 'Habit name' : '习惯名称', habit.name) || '');
        if (!nextName) return;
        const rawIcon = window.prompt(en ? 'Icon (single emoji or letter)' : '图标（一个 emoji 或字符）', habit.icon || '🔥') || '';
        mutateHabits(vault, (list) => {
          const target = list.find((item) => item.id === habit.id);
          if (!target) return false;
          target.name = nextName;
          const icon2 = normalizeHabitIcon(rawIcon);
          if (icon2) target.icon = icon2;
          return true;
        }).then((outcome) => { if (!outcome.saved) { notifyFail(); return; } render(); })
          .catch((e) => console.warn('Cockpit habit edit failed', e));
      };
      const remove = actions.createEl('button', { attr:{ type:'button', title:en?'Delete':'删除', 'aria-label':en?'Delete habit':'删除习惯' } });
      obs.setIcon(remove, 'trash-2');
      remove.onclick = async () => {
        if (!window.confirm(en ? ('Delete "' + habit.name + '"? Check-in history will be removed too.') : ('删除「' + habit.name + '」？打卡记录会一并删除。'))) return;
        const outcome = await mutateHabits(vault, (list) => {
          const index = list.findIndex((item) => item.id === habit.id);
          if (index === -1) return false;
          list.splice(index, 1);
          return true;
        });
        if (!outcome.saved) { notifyFail(); return; }
        render();
        view._refreshWeeklyReviewRef?.();
      };

      // 点击图标或名字 = 快速切换今天的打卡。
      const toggleToday = async () => {
        const key = todayKey;
        const outcome = await mutateHabits(vault, (list) => {
          const target = list.find((item) => item.id === habit.id);
          if (!target) return false;
          const set = new Set(target.log || []);
          if (set.has(key)) set.delete(key);
          else set.add(key);
          target.log = normalizeHabitLog(Array.from(set));
          return true;
        });
        if (!outcome.saved) { notifyFail(); return; }
        render();
        view._refreshWeeklyReviewRef?.();
      };
      icon.onclick = toggleToday;
      icon.setAttribute('role', 'button');
      icon.setAttribute('aria-label', (doneToday(habit) ? (en ? 'Undo today' : '取消今日打卡') : (en ? 'Check in today' : '今日打卡')));
      icon.classList.add('clickable');
    });

    // 底部快速新增：输入名称回车即创建，图标自动轮换分配。
    const addRow = body.createDiv({ cls: PLUGIN_ID + '-habit-add-row' });
    const input = addRow.createEl('input', { cls: PLUGIN_ID + '-habit-add-input', attr: { type:'text', maxlength:'60', placeholder:en?'New habit, e.g. Read 30 min':'新习惯，例如：阅读 30 分钟' } });
    const ok = addRow.createEl('button', { cls: PLUGIN_ID + '-todo-input-ok', text:'+', attr:{ type:'button', title:en?'Add habit':'添加习惯' } });
    const submit = async () => {
      const name = normalizeHabitName(input.value);
      if (!name) return;
      const icons = ['📚','🏃','💧','🧘','💪','🌱','🎸','🛏️','✍️','☀️'];
      const outcome = await mutateHabits(vault, (list) => {
        if (list.some((item) => item.name === name)) return false;
        list.push({ id:habitId(), name, icon:icons[list.length % icons.length], created:window.moment().format('YYYY-MM-DD'), log:[], _extraMeta:[] });
        return true;
      });
      if (!outcome.saved) {
        if (outcome.habits && outcome.habits.some((item) => item.name === name)) new obs.Notice(en ? 'This habit already exists.' : '已经存在同名习惯。');
        else notifyFail();
        return;
      }
      input.value = '';
      render();
      view._refreshWeeklyReviewRef?.();
    };
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
    ok.onclick = submit;
  };

  addBtn.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const input = body.querySelector('.' + PLUGIN_ID + '-habit-add-input');
    if (input) { input.focus(); return; }
    render().then(() => body.querySelector('.' + PLUGIN_ID + '-habit-add-input')?.focus()).catch(() => {});
  };

  view._refreshHabitsRef = render;
  try { await render(); } catch (e) { console.warn('Cockpit habits module failed; dashboard basics remain available', e); }
  view._makeModuleCollapsible('habits', title, body);
  return render;
}
