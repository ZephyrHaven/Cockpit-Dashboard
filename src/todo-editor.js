// todo-editor.js — 个人待办编辑器与列表进度控件。
function renderTodoProgress(parent, todo, lang, openTodoEditor, onIncrement) {
  const progress = todo.progress;
  if (!progress) return;
  const en = lang === 'en';
  const fraction = progress.completed + ' / ' + progress.total;
  const editLabel = en ? 'Edit progress' : '修改进度';
  const controls = parent.createSpan({ cls:PLUGIN_ID + '-todo-progress' });
  const edit = controls.createEl('button', {
    cls:PLUGIN_ID + '-todo-progress-count', text:fraction,
    attr:{ type:'button', title:editLabel, 'aria-label':editLabel + ' ' + fraction }
  });
  edit.onclick = (event) => {
    event.stopPropagation();
    openTodoEditor({ id:todo.id, focusProgress:true });
  };
  if (todo.done || progress.completed >= progress.total) return;

  const incrementLabel = en ? 'Add one completed item' : '已完成数加一';
  const increment = controls.createEl('button', {
    cls:PLUGIN_ID + '-todo-progress-increment', text:'+1',
    attr:{ type:'button', title:incrementLabel, 'aria-label':incrementLabel }
  });
  increment.onclick = async (event) => {
    event.stopPropagation();
    if (increment.disabled) return;
    increment.disabled = true;
    try { await onIncrement(todo.id); }
    finally { increment.disabled = false; }
  };
}

function openCockpitTodoEditor(options = {}, helpers = {}) {
  const { lang, t, createTodoDraft, getAllTodoTags, mergeLegacyTodoInput, normalizeTodoTag, commitTodoMutation } = helpers;
  const existingTodo = options.id
    ? this._todos.find((todo) => todo.id === options.id)
    : (typeof options.index === 'number' ? this._todos[options.index] : null);
  const existingId = existingTodo?.id || '';
  const originalLine = existingTodo ? buildTodoLine(existingTodo) : null;
  const isEditing = !!existingTodo;
  const PID = PLUGIN_ID;
  const duePreset = options.dueDate ? options.dueDate.clone().startOf('day') : null;
  const draft = createTodoDraft(existingTodo, duePreset ? { dueDate: duePreset, dueHasTime:false } : {});
  const knownTags = getAllTodoTags();
  let saveLocked = false;

  this._closeTodoEditor();

  const overlay = document.createElement('div');
  overlay.className = PID + '-todo-editor-backdrop'; if (typeof cockpitAnimateOverlay === 'function') cockpitAnimateOverlay(overlay);
  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) this._closeTodoEditor();
  });

  const sheet = overlay.createDiv({ cls: PID + '-todo-editor-sheet' });
  sheet.addEventListener('click', (evt) => evt.stopPropagation());
  sheet.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      this._closeTodoEditor();
      return;
    }
    if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
      evt.preventDefault();
      saveBtn.click();
    }
  });

  const header = sheet.createDiv({ cls: PID + '-todo-editor-header' });
  header.createDiv({ cls: PID + '-todo-editor-title', text: isEditing ? t('todo.editorEdit') : t('todo.editorCreate') });
  const closeBtn = header.createEl('button', { cls: PID + '-todo-editor-close', text: '✕', attr: { type: 'button', title: t('todo.cancel') } });
  closeBtn.onclick = () => this._closeTodoEditor();
  makeCockpitDialogDraggable(sheet, header, { label: this._lang() === 'en' ? 'Drag task editor' : '拖动待办编辑窗口' });

  const body = sheet.createDiv({ cls: PID + '-todo-editor-body' });

  const fieldTask = body.createDiv({ cls: PID + '-todo-editor-field' });
  fieldTask.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorTask') });
  const titleInput = fieldTask.createEl('textarea', { cls: PID + '-todo-editor-textarea', attr: { rows: '3', placeholder: t('todo.editorTaskPlaceholder') } });
  titleInput.value = draft.text;

  const progressDetails = document.createElement('details');
  progressDetails.className = PID + '-todo-editor-options';
  const progressSummary = progressDetails.createEl('summary');
  progressDetails.open = options.focusProgress === true;
  const progressFields = progressDetails.createDiv({ cls:PID + '-todo-editor-progress' });
  const progressInput = (label, value, placeholder) => {
    const field = progressFields.createEl('label', { cls:PID + '-todo-editor-field' });
    field.createSpan({ cls:PID + '-todo-editor-label', text:label });
    const input = field.createEl('input', {
      cls:PID + '-todo-editor-tag-input', attr:{ type:'text', inputmode:'numeric', placeholder }
    });
    input.value = value ?? '';
    return input;
  };
  const progressTotal = progressInput(lang === 'en' ? 'Total quantity (optional)' : '总数量（选填）', existingTodo?.progress?.total, '');
  const progressCompleted = progressInput(lang === 'en' ? 'Completed quantity' : '已完成数量', existingTodo?.progress?.completed, '0');
  const updateProgressFields = () => {
    progressCompleted.disabled = !progressTotal.value.trim();
    const label = lang === 'en' ? 'Quantity progress' : '数量进度';
    progressSummary.setText(progressCompleted.disabled ? label : label + ' · ' + (progressCompleted.value.trim() || '0') + ' / ' + progressTotal.value.trim());
  };
  progressTotal.addEventListener('input', updateProgressFields);
  progressCompleted.addEventListener('input', updateProgressFields);
  updateProgressFields();

  const fieldDue = body.createDiv({ cls: PID + '-todo-editor-field' });
  fieldDue.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorDue') });
  const dueQuick = fieldDue.createDiv({ cls: PID + '-todo-editor-quick' });
  const dateInput = fieldDue.createEl('input', { cls: PID + '-todo-editor-date', attr: { type: 'datetime-local' } });
  let repeatEditor = null;
  const dueButtons = [
    { key: 'none', label: t('todo.noDue'), apply: () => { draft.dueDate = null; draft.dueHasTime = false; } },
    { key: 'today', label: t('todo.dueTodayBtn'), apply: () => { draft.dueDate = window.moment().startOf('day'); draft.dueHasTime = false; } },
    { key: 'tomorrow', label: t('todo.dueTomorrowBtn'), apply: () => { draft.dueDate = window.moment().add(1, 'day').startOf('day'); draft.dueHasTime = false; } }
  ];
  const renderDueButtons = () => {
    dueQuick.querySelectorAll('.' + PID + '-todo-editor-chip').forEach((chip) => chip.remove());
    dueButtons.forEach((item) => {
      const btn = dueQuick.createEl('button', { cls: PID + '-todo-editor-chip', text: item.label, attr: { type: 'button' } });
      const due = draft.dueDate;
      const today = window.moment().startOf('day');
      const tomorrow = today.clone().add(1, 'day');
      const active = item.key === 'none'
        ? !due
        : item.key === 'today'
          ? !!(due && due.isSame(today, 'day'))
          : !!(due && due.isSame(tomorrow, 'day'));
      btn.classList.toggle('active', !!active);
      btn.onclick = () => {
        item.apply();
        renderDue();
      };
    });
  };
  const renderDue = () => {
    dateInput.value = draft.dueDate ? draft.dueDate.format('YYYY-MM-DDTHH:mm') : '';
    renderDueButtons();
    repeatEditor?.refresh();
  };
  dateInput.addEventListener('change', () => {
    draft.dueDate = dateInput.value ? parseDate(dateInput.value) : null;
    draft.dueHasTime = !!dateInput.value;
    renderDueButtons();
    repeatEditor?.refresh();
  });

  const repeatDetails = document.createElement('details');
  repeatDetails.className = PID + '-todo-editor-options';
  const repeatSummary = repeatDetails.createEl('summary');
  repeatEditor = buildTodoRepeatEditor(repeatDetails, draft, lang, !!existingTodo?.done, repeatSummary);

  const calendarSyncSupported = this._plugin.appleCalendar?.isSupported?.() === true;
  const calendarSyncField = body.createEl('label', { cls: PID + '-todo-editor-calendar-sync' + (calendarSyncSupported ? '' : ' is-disabled') });
  const calendarSyncCopy = calendarSyncField.createDiv({ cls: PID + '-todo-editor-calendar-copy' });
  const calendarSyncHeading = calendarSyncCopy.createDiv({ cls: PID + '-todo-editor-calendar-heading' });
  const calendarSyncIcon = calendarSyncHeading.createSpan({ cls: PID + '-todo-editor-calendar-icon' });
  obs.setIcon(calendarSyncIcon, 'calendar-days');
  calendarSyncHeading.createSpan({ text:lang === 'en' ? 'Sync to iPhone calendar' : '同步到 iPhone 日历' });
  calendarSyncHeading.createSpan({ cls: PID + '-todo-editor-calendar-badge', text:lang === 'en' ? 'Mac only' : '仅 Mac' });
  calendarSyncCopy.createDiv({
    cls:PID + '-todo-editor-calendar-note',
    text:lang === 'en'
      ? 'When this task has a due date, save it to the iCloud calendar selected in settings.'
      : '有截止日期时，保存到设置中选择的 iCloud 日历，并同步到 iPhone。'
  });
  const calendarSyncInput = calendarSyncField.createEl('input', {
    cls:PID + '-todo-editor-calendar-toggle',
    attr:{ type:'checkbox', role:'switch', 'aria-label':lang === 'en' ? 'Sync this task to iPhone calendar' : '将这个待办同步到 iPhone 日历' }
  });
  calendarSyncInput.checked = draft.calendarSync;
  calendarSyncInput.disabled = !calendarSyncSupported;
  calendarSyncInput.addEventListener('change', () => { draft.calendarSync = calendarSyncInput.checked; });

  const fieldPriority = body.createDiv({ cls: PID + '-todo-editor-field' });
  body.insertBefore(fieldPriority, calendarSyncField);
  fieldPriority.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorPriority') });
  const priorityRow = fieldPriority.createDiv({ cls: PID + '-todo-editor-segment' });
  const priorityOptions = [
    { key: 'high', label: t('todo.priorityHigh') },
    { key: 'mid', label: t('todo.priorityMid') },
    { key: 'low', label: t('todo.priorityLow') }
  ];
  const renderPriority = () => {
    priorityRow.empty();
    priorityOptions.forEach((option) => {
      const btn = priorityRow.createEl('button', {
        cls: PID + '-todo-editor-segment-btn' + (draft.priority === option.key ? ' active' : ''),
        text: option.label,
        attr: { type: 'button' }
      });
      btn.onclick = () => {
        draft.priority = option.key;
        renderPriority();
      };
    });
  };

  const fieldTags = body.createDiv({ cls: PID + '-todo-editor-field' });
  fieldTags.createDiv({ cls: PID + '-todo-editor-label', text: t('todo.editorTags') });
  const selectedTags = fieldTags.createDiv({ cls: PID + '-todo-editor-selected-tags' });
  const tagSuggestions = fieldTags.createDiv({ cls: PID + '-todo-editor-tags' });
  const tagInputRow = fieldTags.createDiv({ cls: PID + '-todo-editor-tag-input-row' });
  const tagInput = tagInputRow.createEl('input', {
    cls: PID + '-todo-editor-tag-input',
    attr: { type: 'text', placeholder: t('todo.editorTagPlaceholder') }
  });
  const tagAddBtn = tagInputRow.createEl('button', {
    cls: PID + '-todo-editor-secondary-btn',
    text: t('todo.editorAddTag'),
    attr: { type: 'button' }
  });
  const addTag = (value) => {
    const normalized = normalizeTodoTag(value);
    if (!normalized) return false;
    if (!draft.tags.includes(normalized)) draft.tags.push(normalized);
    tagInput.value = '';
    renderTags();
    return true;
  };
  const removeTag = (tag) => {
    draft.tags = draft.tags.filter((item) => item !== tag);
    renderTags();
  };
  const renderTags = () => {
    selectedTags.empty();
    if (!draft.tags.length) {
      selectedTags.createDiv({ cls: PID + '-todo-editor-empty', text: t('todo.editorNoTags') });
    } else {
      draft.tags.forEach((tag) => {
        const pill = selectedTags.createEl('button', {
          cls: PID + '-todo-editor-selected-tag',
          text: '#' + tag + ' ×',
          attr: { type: 'button' }
        });
        pill.onclick = () => removeTag(tag);
      });
    }
    tagSuggestions.empty();
    knownTags.forEach((tag) => {
      const btn = tagSuggestions.createEl('button', {
        cls: PID + '-todo-editor-chip' + (draft.tags.includes(tag) ? ' active' : ''),
        text: '#' + tag,
        attr: { type: 'button' }
      });
      btn.onclick = () => {
        if (draft.tags.includes(tag)) removeTag(tag);
        else addTag(tag);
      };
    });
  };
  tagAddBtn.onclick = () => addTag(tagInput.value);
  tagInput.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      addTag(tagInput.value);
    }
  });

  body.append(progressDetails, repeatDetails);
  body.createDiv({ cls: PID + '-todo-editor-hint', text: t('todo.legacyHint') });

  const footer = sheet.createDiv({ cls: PID + '-todo-editor-footer' });
  const cancelBtn = footer.createEl('button', {
    cls: PID + '-todo-editor-secondary-btn',
    text: t('todo.cancel'),
    attr: { type: 'button' }
  });
  cancelBtn.onclick = () => this._closeTodoEditor();
  const saveBtn = footer.createEl('button', {
    cls: PID + '-todo-editor-primary-btn',
    text: isEditing ? t('todo.saveEdit') : t('todo.saveNew'),
    attr: { type: 'button' }
  });
  saveBtn.onclick = async () => {
    if (saveLocked) return;
    const rawTitle = titleInput.value.trim();
    if (!rawTitle) {
      titleInput.focus();
      return;
    }
    const merged = mergeLegacyTodoInput(rawTitle, draft);
    const total = progressTotal.value.trim();
    const progress = total ? parseTodoProgress(total, progressCompleted.value.trim()) : null;
    if (total && !progress) {
      progressDetails.open = true;
      const validTotal = parseTodoProgress(total);
      new obs.Notice(lang === 'en'
        ? 'Enter a positive whole number for the total and a whole number from zero to the total for completed.'
        : '总数量须为正整数，已完成数量须为 0 到总数量之间的整数。');
      (validTotal ? progressCompleted : progressTotal).focus();
      return;
    }
    if (!repeatEditor.validate(merged.dueDate, () => { repeatDetails.open = true; })) {
      new obs.Notice(lang === 'en' ? 'Set a valid repeat interval and a due date for a fixed schedule.' : '请填写有效的重复间隔；按固定排期时还需设置截止日期。');
      return;
    }
    saveLocked = true;
    let calendarSetupError = null;
    if (draft.calendarSync) {
      try { await this._plugin.appleCalendar.ensureReady({ enable:true }); }
      catch (error) { calendarSetupError = error; }
    }
    const nextTodo = {
      text: merged.text,
      tags: merged.tags,
      dueDate: merged.dueDate,
      dueHasTime: merged.dueHasTime,
      calendarSync: draft.calendarSync,
      progress,
      repeat: draft.repeat ? { ...draft.repeat, anchor:existingTodo?.dueDate?.format('YYYY-MM-DD') === merged.dueDate?.format('YYYY-MM-DD')
        ? (draft.repeat.anchor || merged.dueDate?.format('YYYY-MM-DD')) : merged.dueDate?.format('YYYY-MM-DD') } : null,
      priority: merged.priority,
      done: existingTodo ? !!existingTodo.done : false,
      created: existingTodo?.created || window.moment(),
      doneDate: existingTodo?.doneDate || null
    };
    const saved = await commitTodoMutation((todos) => {
      if (isEditing) {
        const target = todos.find((todo) => todo.id === existingId);
        if (!target || buildTodoLine(target) !== originalLine) return false;
        Object.assign(target, nextTodo);
      } else {
        todos.unshift(nextTodo);
      }
      return true;
    }, isEditing
      ? (lang === 'en' ? 'This task changed elsewhere. Reopen it and try again.' : '这个待办已在其他窗口发生变化，请重新打开后再试。')
      : undefined);
    if (saved) {
      this._closeTodoEditor();
      if (calendarSetupError) new obs.Notice(this._plugin.appleCalendar.userMessage(calendarSetupError, lang), 10000);
    }
    else saveLocked = false;
  };

  renderDue();
  renderPriority();
  renderTags();

  this._todoEditorEl = overlay;
  document.body.appendChild(overlay);
  setTimeout(() => {
    if (options.focusProgress && !progressCompleted.disabled) {
      progressCompleted.focus();
      progressCompleted.select();
    } else titleInput.focus();
  }, 16);
}
