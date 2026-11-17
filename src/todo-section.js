// todo-section.js — 从 _framework.js 的 _buildAll() 拆出的待办列表区块。
// 负责待办的状态筛选、标签页、渲染、批量操作、行内操作与统计联动。
// 有状态的渲染单元：内部维护 currentStatus/currentTag/todoRenderLimit 与 renderTodos 闭包，
// 通过 ctx 注入 _buildAll 侧的共享闭包（commitTodoMutation/openTodoEditor/incrementTodoProgress/
// updateStats/refreshCalendarRef/makeCollapsible/todoHooks），并返回块外仍需使用的句柄。
async function cockpitBuildTodoSection(view, root, ctx) {
  const { t, lang, makeCollapsible, commitTodoMutation, openTodoEditor, incrementTodoProgress, updateStats, refreshCalendarOnce, refreshHero, refreshLinkedAlarmTodoIds, openTodoAlarm, decomposeTodoWithAi, getLinkedAlarmTodoIds, todoHooks } = ctx;

  // ===== 5. TODOs =====
  const todoTitleEl = root.createDiv({ cls: PLUGIN_ID+'-section-title '+PLUGIN_ID+'-todo-header', text: t('sections.todos') });
  todoTitleEl.dataset.section = 'todos-title';
  const todoWrap = root.createDiv();
  todoWrap.dataset.section = 'todos-body';
  const todoActions = todoWrap.createDiv({ cls: PLUGIN_ID+'-module-actions' });
  const tabsWrap = todoWrap.createDiv({ cls: PLUGIN_ID+'-todo-tabs-wrap' });
  const todayBar = todoWrap.createDiv({ cls: PLUGIN_ID+'-today-bar' });
  const todosEl = todoWrap.createDiv({ cls: PLUGIN_ID+'-todos' });

  // 状态筛选：用单一下拉框收纳选项，避免待办标题栏在窄窗口中拥挤。
  let currentStatus = 'today';
  const statusOptions = [
    { key:'today', label:t('todo.today') },
    { key:'next', label:t('framework.next') },
    { key:'all', label:t('todo.all') },
    { key:'todo', label:t('todo.todo') },
    { key:'done', label:t('todo.done') }
  ];
  const statusSelectWrap = todoActions.createDiv({ cls: PLUGIN_ID+'-status-select-wrap' });
  obs.setIcon(statusSelectWrap.createSpan({ cls: PLUGIN_ID+'-status-select-icon' }), 'list-filter');
  const statusSelect = statusSelectWrap.createEl('select', {
    cls: PLUGIN_ID+'-status-select',
    attr: { title: t('framework.filterByStatus'), 'aria-label': t('framework.statusFilter') }
  });
  statusOptions.push({key:'archived',label:t('framework.archived')});
  statusOptions.forEach((option) => {
    const optionEl = statusSelect.createEl('option', { text: option.label, attr: { value: option.key } });
    optionEl.selected = option.key === currentStatus;
  });
  statusSelect.onchange = async () => {
    currentStatus = statusSelect.value;
    todoRenderLimit = 120;
    await renderTodos({ persist:false });
  };

  const getStatusFilteredTodos = (preparedTodayGroups)=>{
    let filtered = view._todos.filter(todo => currentStatus === 'archived' ? todo.tags?.includes('_archived') : !todo.tags?.includes('_archived'));
    if (currentStatus === 'today') {
      filtered = (preparedTodayGroups || []).flatMap((group) => group.items);
    }
    if (currentStatus === 'next') {
      const tomorrow = window.moment().add(1, 'day');
      filtered = filtered.filter(t => !t.done && (
        t.priority === 'high' ||
        (t.dueDate && t.dueDate.isSame(tomorrow, 'day'))
      ));
    }
    if (currentStatus === 'todo') filtered = filtered.filter(t => !t.done);
    if (currentStatus === 'done') filtered = filtered.filter(t => t.done);
    return filtered;
  };

  // 动态收集当前状态下可见的标签
  let currentTag = 'all'; // 当前选中页签
  let todoRenderLimit = 120;
  const getVisibleTags = (statusFiltered)=>{
    const tagSet = new Set();
    statusFiltered.forEach(t => { if (t.tags) t.tags.forEach(tag => tagSet.add(tag)); });
    return Array.from(tagSet).sort();
  };

  // 动态生成页签栏
  const renderTabs = (allTags, wrapEl)=>{
    wrapEl.empty();
    const tabsEl = wrapEl.createDiv({ cls: PLUGIN_ID+'-todo-tabs' });
    // 构造页签：全部 + 动态标签
    const tabs = [{ key:'all', label:t('todo.all') }];
    allTags.forEach(tag => tabs.push({ key:'tag:'+tag, label:'#'+tag }));
    tabs.forEach(tab => {
      const tabBtn = tabsEl.createEl('button', {
        cls: PLUGIN_ID+'-todo-tab' + (currentTag===tab.key?' active':''),
        text: tab.label
      });
      tabBtn.onclick = async ()=>{
        currentTag = tab.key;
        todoRenderLimit = 120;
        await renderTodos({ persist:false });
      };
    });
  };

  // 渲染待办列表（从内存数据渲染）
  let renderTodos = async (options = {})=>{
    updateStats();
    await refreshLinkedAlarmTodoIds();
    // AI 拆解按钮的可见性：整个列表渲染只查询一次（内部带缓存）。
    const aiReady = await isCockpitAiReady(view._plugin);
    todosEl.empty();

    const todayKey = window.moment().format('YYYY-MM-DD');
    const baseTodayGroups = currentStatus === 'today' ? groupTodayTodos(view._todos.filter(todo=>!todo.tags?.includes('_archived')), todayKey) : null;
    const statusFiltered = getStatusFilteredTodos(baseTodayGroups);

    const allTags = getVisibleTags(statusFiltered);
    if (currentTag !== 'all' && !allTags.includes(currentTag.replace('tag:',''))) currentTag = 'all';
    renderTabs(allTags, tabsWrap);
    buildTodoBulkBar(view, tabsWrap, statusFiltered.filter(todo => currentTag === 'all' || todo.tags?.includes(currentTag.slice(4))), commitTodoMutation);

    const visibleStatusTodos = currentTag === 'all'
      ? statusFiltered
      : statusFiltered.filter(t => t.tags && t.tags.includes(currentTag.replace('tag:','')));
    const activeTag = currentTag === 'all' ? '' : currentTag.replace('tag:', '');
    const todayGroups = currentStatus === 'today'
      ? baseTodayGroups.map((group) => ({
        ...group,
        items:activeTag ? group.items.filter((todo) => todo.tags?.includes(activeTag)) : group.items
      })).filter((group) => group.items.length)
      : [];
    todayBar.empty();
    todayBar.style.display = currentStatus === 'today' ? 'flex' : 'none';
    if (currentStatus === 'today') {
      const todayCount = todayGroups.reduce((sum, group) => sum + group.items.length, 0);
      const summary = todayBar.createDiv({ cls:PLUGIN_ID+'-today-summary' });
      summary.createSpan({ cls:PLUGIN_ID+'-today-summary-label', text:t('todo.todaySummary', { count:todayCount }) });
      const groupLabels = {
        overdue:t('todo.groupOverdue'), today:t('todo.groupToday'),
        priority:t('todo.groupPriority'), inbox:t('todo.groupInbox')
      };
      todayGroups.forEach((group) => summary.createSpan({ cls:PLUGIN_ID+'-today-count '+group.key, text:groupLabels[group.key]+' '+group.items.length }));
      const overdue = todayGroups.find((group) => group.key === 'overdue');
      if (overdue?.items.length) {
        const deferOverdue = todayBar.createEl('button', { cls:PLUGIN_ID+'-today-defer', text:t('todo.deferOverdue'), attr:{type:'button'} });
        deferOverdue.onclick = async () => {
          const tomorrow = window.moment().add(1, 'day').startOf('day');
          const ids = new Set(overdue.items.map((todo) => todo.id));
          await commitTodoMutation((todos) => {
            todos.forEach((todo) => {
              if (ids.has(todo.id) && !todo.done) todo.dueDate = tomorrow.clone();
            });
            return true;
          }, t('framework.deferOverdueFail'));
        };
      }
    }

    // 根据当前选中页签过滤
    const tagFiltered = visibleStatusTodos.slice();

    // 排序：优先级 high>mid+low，同优先级内按创建时间倒序，已过期的置顶
    const prioOrder = { high:0, mid:1, low:2 };
    const now = window.moment();
    if (currentStatus !== 'today') tagFiltered.sort((a,b)=>{
      // 已过期的未完成置顶
      const aOver = !a.done && a.dueDate && a.dueDate.isBefore(now, 'day') ? 0 : 1;
      const bOver = !b.done && b.dueDate && b.dueDate.isBefore(now, 'day') ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      // 按优先级
      const pa = prioOrder[a.priority||'mid'];
      const pb = prioOrder[b.priority||'mid'];
      if (pa !== pb) return pa - pb;
      // 按创建时间倒序
      return (b.created?.valueOf()||0) - (a.created?.valueOf()||0);
    });

    const todoEntries = [];
    let totalVisibleTodos = tagFiltered.length;
    let renderedTodos = 0;
    if (currentStatus === 'today') {
      const limited = limitTodoGroups(todayGroups, todoRenderLimit);
      totalVisibleTodos = limited.total;
      renderedTodos = limited.rendered;
      limited.groups.forEach((group) => {
        todoEntries.push({ group });
        group.items.forEach((todo) => todoEntries.push({ todo }));
      });
    } else {
      const visible = tagFiltered.slice(0, todoRenderLimit);
      renderedTodos = visible.length;
      visible.forEach((todo) => todoEntries.push({ todo }));
    }
    if (!todoEntries.length) todosEl.createDiv({ cls:PLUGIN_ID+'-todo-empty', text:currentStatus === 'today' ? t('todo.todayEmpty') : t('todo.filterEmpty') });

    const groupLabels = {
      overdue:t('todo.groupOverdue'), today:t('todo.groupToday'),
      priority:t('todo.groupPriority'), inbox:t('todo.groupInbox')
    };
    todoEntries.forEach((entry)=>{
      if (entry.group) {
        const heading = todosEl.createEl('h3', { cls:PLUGIN_ID+'-today-group '+entry.group.key });
        heading.createSpan({ text:groupLabels[entry.group.key] });
        heading.createSpan({ cls:PLUGIN_ID+'-today-group-count', text:String(entry.group.items.length) });
        const groupActions = heading.createSpan({ cls:PLUGIN_ID+'-today-group-actions' });
        const completeGroup = groupActions.createEl('button', { text:t('framework.completeAll'), attr:{ type:'button', title:t('framework.completeAllTitle') } });
        completeGroup.onclick = async () => {
          const ids = new Set(entry.group.items.map((todo) => todo.id));
          await commitTodoMutation((todos) => { const completedAt = window.moment(); todos.forEach((todo) => { if (ids.has(todo.id) && !todo.done) { todo.done = true; todo.doneDate = completedAt.clone(); } }); return true; });
        };
        const deferGroup = groupActions.createEl('button', { text:t('framework.tomorrow'), attr:{ type:'button', title:t('framework.tomorrowTitle') } });
        deferGroup.onclick = async () => {
          const ids = new Set(entry.group.items.map((todo) => todo.id)); const tomorrow = window.moment().add(1, 'day').startOf('day');
          await commitTodoMutation((todos) => { todos.forEach((todo) => { if (ids.has(todo.id) && !todo.done) { todo.dueDate = tomorrow.clone(); todo.dueHasTime = false; } }); return true; });
        };
        return;
      }
      const todo = entry.todo;
      const done = todo.done;
      const item = todosEl.createDiv({ cls: PLUGIN_ID+'-todo'+(done?' done':''), attr:{ draggable:done ? 'false' : 'true', title:done ? '' : t('framework.dragToSchedule') } });
      item.addEventListener('dragstart', (event) => { if (done) { event.preventDefault(); return; } event.dataTransfer.setData('application/x-cockpit-todo', todo.id); event.dataTransfer.effectAllowed = 'move'; item.classList.add('is-dragging'); });
      item.addEventListener('dragend', () => item.classList.remove('is-dragging'));

      addTodoBulkSelector(view, item, todo);

      // 优先级圆点
      const pdot = item.createDiv({
        cls: PLUGIN_ID+'-todo-pdot p-'+(todo.priority||'mid'),
        attr:{title:(todo.priority||'mid')==='high'?view._t('todo.priorityHigh'):(todo.priority||'mid')==='mid'?view._t('todo.priorityMid'):view._t('todo.priorityLow')}
      });

      // 复选框 - 切换完成状态，连带更新日期
      const chk = item.createEl('button', { cls: PLUGIN_ID+'-todo-chk', text:done?'✓':'', attr:{ type:'button', 'aria-label':done ? t('framework.markOpen') : t('framework.completeTask'), 'aria-pressed':String(done) } });
      chk.onclick = async (e)=>{
        e.stopPropagation();
        // 勾选完成：先播放打勾 + 划线动画，再提交并局部刷新列表。
        if (item.classList.contains('is-completing')) return;
        if (!done && !cockpitPrefersReducedMotion()) {
          item.classList.add('is-completing');
          chk.textContent = '✓';
          await new Promise((resolve) => setTimeout(resolve, 360));
        }
        const saved = await commitTodoMutation((todos) => {
          const target = todos.find((entry) => entry.id === todo.id);
          if (!target) return false;
          target.done = !target.done;
          target.doneDate = target.done ? window.moment() : null;
          return true;
        });
        if (!saved && item.isConnected) { item.classList.remove('is-completing'); chk.textContent = done ? '✓' : ''; }
      };

      // 主内容区
      const main = item.createDiv({ cls: PLUGIN_ID+'-todo-main' });
      const txt = main.createDiv({ cls: PLUGIN_ID+'-todo-text', text:todo.text });
      txt.onclick = async (e)=>{
        e.stopPropagation();
        openTodoEditor({ id:todo.id });
      };

      // 时间元信息 + 截止日期 + 标签胶囊
      const meta = main.createDiv({ cls: PLUGIN_ID+'-todo-meta' });
      renderTodoProgress(meta, todo, lang, openTodoEditor, incrementTodoProgress);
      if (todo.created) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.cal+' '+fmtDate(todo.created, lang)});
      if (done && todo.doneDate) meta.createDiv({cls:PLUGIN_ID+'-todo-meta-item'}).createSpan({text:E.check+' '+fmtDate(todo.doneDate, lang)});
      if (todo.repeat) meta.createDiv({ cls:PLUGIN_ID+'-todo-meta-item', text:t('framework.repeats') });
      const focusStat = getTodoFocusStat(view._pomodoroTaskStats, todo);
      if (focusStat) meta.createSpan({ cls:PLUGIN_ID+'-todo-focus-stat', text:'🍅 '+focusStat.sessions+' · '+focusStat.totalMinutes+' min' });
      // 截止日期显示
      if (todo.dueDate && !done) {
        const nowM = window.moment();
        let dueCls = 'due-future', dueLabel = formatTodoDue(todo.dueDate, lang, todo.dueHasTime);
        if (todo.dueDate.isBefore(nowM, 'day')) { dueCls = 'due-overdue'; dueLabel = t('todo.overdue', { date: formatTodoDue(todo.dueDate, lang, todo.dueHasTime) }); }
        else if (todo.dueDate.isSame(nowM, 'day')) { dueCls = 'due-today'; dueLabel = t('todo.dueToday') + (todo.dueHasTime ? ' · ' + todo.dueDate.format('HH:mm') : ''); }
        meta.createSpan({ cls: PLUGIN_ID+'-todo-due '+dueCls, text: dueLabel });
      }
      // 标签显示
      if (todo.tags && todo.tags.length > 0) {
        todo.tags.forEach(tag => {
          const pill = meta.createSpan({ cls: PLUGIN_ID+'-todo-tag-pill', text:'#'+tag });
          pill.onclick = async (e) => {
            e.stopPropagation();
            currentTag = 'tag:'+tag;
            await renderTodos({ persist:false });
          };
        });
      }

      // 状态标签
      item.createDiv({ cls: PLUGIN_ID+'-todo-tag '+(done?'tag-done':'tag-todo'), text:done?t('todo.stateDone'):t('todo.stateDoing') });

      // 优先级选择器（hover 时显示）
      const prioWrap = item.createDiv({ cls: PLUGIN_ID+'-prio-picker' });
      ['high','mid','low'].forEach(p => {
        const dot = prioWrap.createEl('button', { cls: PLUGIN_ID+'-prio-opt p-' + p + ((todo.priority||'mid')===p?' sel':''), attr:{ type:'button', 'aria-label':p==='high'?t('todo.priorityHigh'):p==='mid'?t('todo.priorityMid'):t('todo.priorityLow'), 'aria-pressed':String((todo.priority||'mid')===p) } });
        dot.title = p==='high'?t('todo.priorityHigh'):p==='mid'?t('todo.priorityMid'):t('todo.priorityLow');
        dot.onclick = async (e)=>{
          e.stopPropagation();
          if ((todo.priority||'mid') === p) return;
          await commitTodoMutation((todos) => {
            const target = todos.find((entry) => entry.id === todo.id);
            if (!target) return false;
            target.priority = p;
            return true;
          });
        };
      });

      // 操作按钮
      const actions = item.createDiv({ cls: PLUGIN_ID+'-todo-actions' });

      // 延期、编辑与删除与宿主应用共用同一套 Lucide 图标，避免 emoji 风格割裂。
      if (!done && pomodoroTaskRef(todo)) {
        const focusBtn = actions.createEl('button', { cls:PLUGIN_ID+'-todo-btn focus', attr:{type:'button', 'aria-label':t('framework.startPomodoroTask')} });
        obs.setIcon(focusBtn, 'timer');
        focusBtn.onclick = (e) => {
          e.stopPropagation();
          buildPomodoro(view, root, todo);
        };
      }
      if (!done && todo.id) {
        const hasLinkedAlarm = getLinkedAlarmTodoIds().has(todo.id);
        const alarmBtn = actions.createEl('button', { cls:PLUGIN_ID+'-todo-btn alarm'+(hasLinkedAlarm ? ' active' : ''), attr:{type:'button', 'aria-label':t(hasLinkedAlarm ? 'todo.editAlarm' : 'todo.createAlarm'), 'aria-pressed':String(hasLinkedAlarm)} });
        obs.setIcon(alarmBtn, 'alarm-clock');
        alarmBtn.onclick = async (e) => { e.stopPropagation(); await openTodoAlarm(todo); };
      }
      if (!done && aiReady && todo.text) {
        const aiBtn = actions.createEl('button', { cls:PLUGIN_ID+'-todo-btn ai', attr:{type:'button', 'aria-label':t('framework.breakTaskAI')} });
        obs.setIcon(aiBtn, 'sparkles');
        aiBtn.onclick = async (e) => {
          e.stopPropagation();
          if (aiBtn.disabled) return;
          aiBtn.disabled = true;
          try { await decomposeTodoWithAi(todo); }
          finally { aiBtn.disabled = false; }
        };
      }
      if (!done) {
        const deferBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', 'aria-label':t('framework.moveTaskTomorrow')} });
        obs.setIcon(deferBtn, 'calendar-clock');
        deferBtn.onclick = async (e) => {
          e.stopPropagation();
          await commitTodoMutation((todos) => {
            const target = todos.find((entry) => entry.id === todo.id);
            if (!target) return false;
            target.dueDate = window.moment().add(1, 'day').startOf('day');
            return true;
          });
        };
      }
      const editBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn', attr:{type:'button', 'aria-label':t('framework.editTaskTitle')} });
      obs.setIcon(editBtn, 'square-pen');
      editBtn.onclick = (e)=>{
        e.stopPropagation();
        openTodoEditor({ id:todo.id });
      };

      // 删除按钮
      const delBtn = actions.createEl('button', { cls: PLUGIN_ID+'-todo-btn del', attr:{type:'button', 'aria-label':t('framework.deleteTask')} });
      obs.setIcon(delBtn, 'trash-2');
      delBtn.onclick = async (e)=>{
        e.stopPropagation();
        await commitTodoMutation((todos) => {
          const index = todos.findIndex((entry) => entry.id === todo.id);
          if (index < 0) return false;
          todos.splice(index, 1);
          return true;
        });
      };
    });
    if (renderedTodos < totalVisibleTodos) {
      const more = todosEl.createEl('button', {
        cls:PLUGIN_ID+'-todo-load-more',
        text:t('framework.showMore', { n: totalVisibleTodos - renderedTodos }),
        attr:{ type:'button' }
      });
      obs.setIcon(more.createSpan({ cls:PLUGIN_ID+'-todo-load-more-icon' }), 'chevrons-down');
      more.onclick = async () => {
        todoRenderLimit += 120;
        await renderTodos({ persist:false });
      };
    }
    return true;
  };

  // 待办变化后同步刷新日历（深度计数器避免递归重复刷新）
  let _rtDepth = 0;
  const _rtOrig = renderTodos;
  renderTodos = async function(options = {}) {
    _rtDepth++;
    try { await _rtOrig(options); }
    finally {
      _rtDepth--;
      if (_rtDepth === 0) {
        if (refreshCalendarOnce) refreshCalendarOnce();
        if (refreshHero) refreshHero();
      }
    }
  };

  // 日历勾选待办后同步刷新下方列表
  view._refreshTodosRef = renderTodos;

  // 刷新按钮：从 MD 文件重新加载数据
  cockpitCreateModuleAction(todoActions, 'refresh-cw', t('todo.refresh'), async () => {
    const loaded = await loadTodos(view.app.vault);
    if (loaded) {
      view._todos = loaded;
      await view._plugin.alarms.syncTodos(view._todos).catch((e) => console.warn('Cockpit refreshed todo alarm sync failed', e));
      view._plugin.appleCalendar?.syncTodos(view._todos).catch((e) => console.warn('Cockpit refreshed Apple calendar sync failed', e));
    }
    // loadTodos 已在同一队列内完成旧格式 ID 的一次性回写，无需再重复写文件。
    await renderTodos({ persist:false });
  });
  cockpitCreateModuleAction(todoActions, 'plus', t('todo.add'), () => openTodoEditor());

  await renderTodos({ persist:false });
  makeCollapsible(todoTitleEl, todoWrap, 'todos');

  try { await view._perfBuild('teamTodos', () => buildTeamTodosModule(view, root)); }
  catch (error) { console.warn('Cockpit team module failed; dashboard basics remain available', error); }

  // 统计卡片点击 → 切换待办筛选并滚动到列表（统计区块通过 ctx.todoHooks 调用）。
  todoHooks.openRelated = async (field) => {
    const cfg = { field };
    currentStatus = cfg.field === 'doneCount' || cfg.field === 'donePct' ? 'done' : 'todo';
    if (cfg.field === 'tagBacklog') {
      const counts = new Map(); view._todos.filter((todo)=>!todo.done).forEach((todo)=>(todo.tags||[]).forEach((tag)=>counts.set(tag,(counts.get(tag)||0)+1)));
      const top = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1])[0]; currentTag = top ? 'tag:'+top[0] : 'all';
    } else currentTag = 'all';
    if (cfg.field === 'focusGap') currentStatus = 'today';
    statusSelect.value = currentStatus;
    todoRenderLimit = 120;
    await renderTodos({ persist:false });
    todoTitleEl.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  // 供块外（项目模块）复用的过滤器与滚动定位。
  const setFilter = async (status, tag) => {
    if (status != null) { currentStatus = status; if (statusSelect) statusSelect.value = status; }
    if (tag != null) currentTag = tag;
    todoRenderLimit = 120;
    await renderTodos({ persist:false });
  };
  const scrollToTodo = () => { if (todoTitleEl) todoTitleEl.scrollIntoView({ behavior:"smooth", block:"start" }); };
  return { refreshTodos: renderTodos, openTodoEditor, statusSelect, setFilter, scrollToTodo };
}
