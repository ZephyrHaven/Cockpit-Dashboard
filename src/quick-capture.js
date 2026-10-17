// quick-capture.js — 全局快速记录窗口：边输入边预览识别结果，回车即建待办（解析见 quick-parse.js）。

function quickParsedMoment(parsed) {
  if (!parsed?.date) return null;
  const due = window.moment([parsed.date.y, parsed.date.m, parsed.date.d]);
  if (parsed.hasTime) due.hour(parsed.hour).minute(parsed.minute);
  return due;
}

function formatQuickDueLabel(parsed, language) {
  const due = quickParsedMoment(parsed);
  if (!due) return '';
  const en = language === 'en';
  const today = window.moment().startOf('day');
  const diff = due.clone().startOf('day').diff(today, 'days');
  const relative = en
    ? (diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === 2 ? 'In 2 days' : '')
    : (diff === 0 ? '今天' : diff === 1 ? '明天' : diff === 2 ? '后天' : '');
  const dayText = en ? due.format('ddd MMM D') : due.format('M月D日') + ' ' + getWeekdayLabels(language, 'long')[due.day()];
  return (relative ? relative + ' · ' : '') + dayText;
}

// 写入待办文件；已打开的驾驶舱由文件监听做局部刷新，未打开时这里补做闹钟 / 系统日历同步。
async function createQuickTodo(plugin, parsed) {
  const due = quickParsedMoment(parsed);
  const todo = {
    id:createTodoId(), text:parsed.text, tags:parsed.tags.slice(0, 8), priority:parsed.priority || 'mid',
    dueDate:due, dueHasTime:!!(due && parsed.hasTime), calendarSync:false, repeat:null,
    done:false, created:window.moment(), doneDate:null
  };
  // 标签写在正文里时交给解析层拆出，避免重复存储。
  todo.text = todo.text.replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim() || parsed.text;
  const outcome = await mutateTodos(plugin.app.vault, (todos) => { todos.unshift(todo); return true; });
  if (!outcome?.saved || !outcome?.todos) return null;
  if (!plugin.app.workspace.getLeavesOfType(VIEW_TYPE).length) {
    await plugin.alarms?.syncTodos?.(outcome.todos).catch((error) => console.warn('Cockpit quick capture alarm sync failed', error));
    plugin.appleCalendar?.syncTodos?.(outcome.todos).catch((error) => console.warn('Cockpit quick capture calendar sync failed', error));
  }
  return todo;
}

class CockpitQuickCaptureModal extends CockpitModal {
  constructor(app, plugin) { super(app); this.plugin = plugin; this.busy = false; }
  onOpen() {
    // 优先跟随已打开驾驶舱的界面语言，否则按系统语言。
    const viewLang = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view?._lang?.();
    const en = (viewLang ? normalizeLang(viewLang) : (String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en')) === 'en';
    const lang = en ? 'en' : 'zh';
    this.modalEl.addClass(PLUGIN_ID + '-quick-capture');
    const { contentEl } = this;
    contentEl.createDiv({ cls:PLUGIN_ID + '-qc-kicker', text:en ? 'QUICK CAPTURE' : '快速记录' });
    const input = contentEl.createEl('input', { cls:PLUGIN_ID + '-qc-input', attr:{ type:'text', placeholder:en ? 'Call Alex tomorrow 3pm !high #work' : '明天下午3点 给客户回电话 !高 #工作', 'aria-label':en ? 'New task' : '新待办', spellcheck:'false' } });
    const preview = contentEl.createDiv({ cls:PLUGIN_ID + '-qc-preview', attr:{ 'aria-live':'polite' } });
    const footer = contentEl.createDiv({ cls:PLUGIN_ID + '-qc-footer' });
    footer.createSpan({ text:en ? 'Enter add · Shift+Enter add & continue · Esc close' : 'Enter 添加 · Shift+Enter 添加并继续 · Esc 关闭' });
    footer.createSpan({ cls:PLUGIN_ID + '-qc-examples', text:en ? 'today · fri · next mon · 10/20 · 3pm' : '今天 · 周五 · 下周一 · 10月20日 · 3天后 · 9点半' });
    const chip = (cls, icon, text) => { const el = preview.createSpan({ cls:PLUGIN_ID + '-qc-chip ' + cls }); obs.setIcon(el.createSpan({ cls:PLUGIN_ID + '-qc-chip-icon' }), icon); el.createSpan({ text }); };
    const render = () => {
      preview.empty();
      const parsed = parseQuickTodoInput(input.value);
      if (!input.value.trim()) { preview.createSpan({ cls:PLUGIN_ID + '-qc-empty', text:en ? 'Dates, times, !priority and #tags are recognized as you type.' : '边输入边识别日期、时间、!优先级 和 #标签' }); return parsed; }
      if (parsed.date) chip('is-date', 'calendar-days', formatQuickDueLabel(parsed, lang));
      if (parsed.hasTime) chip('is-time', 'clock', String(parsed.hour).padStart(2, '0') + ':' + String(parsed.minute).padStart(2, '0'));
      if (parsed.priority) chip('is-priority p-' + parsed.priority, 'flag', en ? { high:'High', mid:'Normal', low:'Low' }[parsed.priority] : { high:'高优先级', mid:'普通', low:'低优先级' }[parsed.priority]);
      parsed.tags.slice(0, 4).forEach((tag) => chip('is-tag', 'hash', tag));
      if (!parsed.date && !parsed.hasTime) chip('is-muted', 'inbox', en ? 'No date' : '无日期');
      return parsed;
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' || event.isComposing || this.busy) return;
      event.preventDefault();
      const parsed = render();
      if (!parsed.text || !parsed.text.replace(/#[^\s#]+/g, '').trim()) { input.focus(); return; }
      this.busy = true;
      try {
        const todo = await createQuickTodo(this.plugin, parsed);
        if (!todo) { new obs.Notice(en ? 'Could not save the task.' : '待办保存失败。'); return; }
        const when = [parsed.date ? formatQuickDueLabel(parsed, lang) : '', parsed.hasTime ? todo.dueDate.format('HH:mm') : ''].filter(Boolean).join(' ');
        new obs.Notice((en ? 'Added: ' : '已添加：') + todo.text + (when ? ' · ' + when : ''));
        if (event.shiftKey) { input.value = ''; render(); input.focus(); }
        else this.close();
      } catch (error) {
        console.warn('Cockpit quick capture failed', error);
        new obs.Notice(en ? 'Could not save the task.' : '待办保存失败。');
      } finally { this.busy = false; }
    });
    render();
    setTimeout(() => input.focus(), 30);
  }
  onClose() { this.contentEl.empty(); }
}
