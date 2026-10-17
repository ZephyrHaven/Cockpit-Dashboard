// meeting-notes.js — 从系统日程一键生成会议笔记：已存在则直接打开，并在当天日记里留一条链接。
// 只在用户点击时写入库内文件；不读取参会人等额外日历字段，不联网。

const MEETING_NOTE_DEFAULT_FOLDER = { zh:'会议笔记', en:'Meetings' };

function meetingNoteSafeTitle(title) {
  return String(title || '').replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Meeting';
}

function meetingNoteFileName(event) {
  const start = window.moment(event.start);
  return (event.allDay ? start.format('YYYY-MM-DD') : start.format('YYYY-MM-DD HHmm')) + ' ' + meetingNoteSafeTitle(event.title) + '.md';
}

function buildMeetingNoteContent(event, en) {
  const start = window.moment(event.start);
  const end = window.moment(event.end);
  const time = event.allDay ? (en ? 'All day' : '全天') : start.format('HH:mm') + '–' + end.format(end.isSame(start, 'day') ? 'HH:mm' : 'MM-DD HH:mm');
  // 字符串统一用 JSON 转义写入 frontmatter，兼容标题里的冒号、引号。
  const front = ['---', 'type: meeting', 'date: ' + start.format('YYYY-MM-DD'), 'time: ' + JSON.stringify(time)];
  if (event.calendar) front.push('calendar: ' + JSON.stringify(event.calendar));
  if (event.location) front.push('location: ' + JSON.stringify(event.location));
  front.push('---', '');
  const sections = en
    ? ['## Attendees', '- ', '', '## Agenda', '- ', '', '## Notes', '', '', '## Action items', '- [ ] ', '']
    : ['## 参会人', '- ', '', '## 议程', '- ', '', '## 记录', '', '', '## 待办', '- [ ] ', ''];
  return front.concat(['# ' + String(event.title || ''), '', '> ' + start.format('YYYY-MM-DD') + ' · ' + time + (event.location ? ' · ' + event.location : ''), ''], sections).join('\n');
}

async function ensureMeetingFolder(vault, folder) {
  let current = '';
  for (const part of folder.split('/').filter(Boolean)) {
    current = current ? current + '/' + part : part;
    if (!vault.getAbstractFileByPath(current)) await vault.createFolder(current);
  }
}

async function openMeetingNote(plugin, event) {
  const app = plugin.app;
  const data = await plugin.loadData() || {};
  const viewLang = app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view?._lang?.();
  const en = (viewLang ? normalizeLang(viewLang) : 'zh-CN') === 'en';
  const folder = obs.normalizePath(String(data.meetingNoteFolder || '').trim() || (en ? MEETING_NOTE_DEFAULT_FOLDER.en : MEETING_NOTE_DEFAULT_FOLDER.zh));
  const path = obs.normalizePath(folder + '/' + meetingNoteFileName(event));
  let file = app.vault.getAbstractFileByPath(path);
  const created = !file;
  if (!file) {
    await ensureMeetingFolder(app.vault, folder);
    file = await app.vault.create(path, buildMeetingNoteContent(event, en));
    await linkMeetingNoteInDaily(app, file, event);
  }
  await app.workspace.getLeaf('tab').openFile(file);
  new obs.Notice(created ? (en ? 'Meeting note created.' : '已创建会议笔记。') : (en ? 'Opened the existing meeting note.' : '已打开已有的会议笔记。'));
  return file;
}

// 只追加到已存在的当天日记，避免为了加链接而凭空新建日记文件。
async function linkMeetingNoteInDaily(app, file, event) {
  const daily = app.vault.getAbstractFileByPath(DAILY_DIR + '/' + window.moment(event.start).format('YYYY-MM-DD') + '.md');
  if (!daily) return;
  const link = '[[' + file.basename + ']]';
  const time = event.allDay ? '' : window.moment(event.start).format('HH:mm') + ' ';
  try {
    await app.vault.process(daily, (content) => (content.includes(link) ? content : content.replace(/\s*$/, '') + '\n- ' + time + link + '\n'));
  } catch (error) { console.warn('Cockpit meeting note daily link failed', error); }
}

if (typeof module !== 'undefined' && module.exports && typeof PLUGIN_ID === 'undefined') module.exports = { meetingNoteFileName, buildMeetingNoteContent, meetingNoteSafeTitle };
