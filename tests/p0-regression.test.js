#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const framework = fs.readFileSync(path.join(root, 'src/_framework.js'), 'utf8');
const layoutEdit = fs.readFileSync(path.join(root, 'src/layout-edit.js'), 'utf8');
const silentRefresh = fs.readFileSync(path.join(root, 'src/silent-refresh.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'src/calendar.js'), 'utf8');
const pomodoro = fs.readFileSync(path.join(root, 'src/pomodoro.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(calendar, /openTodoEditor/, 'Calendar owns its add/edit interactions.');
assert.match(framework, /buildCalendar\(root, \(\) => this\._todos/, 'Calendar reads the current todo state instead of an initial stale array.');
assert.doesNotMatch(framework, /===== 3\.5 日历看板 =====[\s\S]*?===== 3\. Categories =====/, 'Framework must not retain a second calendar implementation.');
assert.match(silentRefresh, /_refreshTodosRef\(\{ persist: false \}\)/, 'Calendar toggles refresh the list without a second Markdown write.');
assert.doesNotMatch(calendar, /await onTodoToggle\(\);\s*renderAll\(\);/, 'Calendar toggles must not redraw the calendar twice.');
assert.match(pomodoro, /function buildPomodoro\(/, 'Pomodoro has a dedicated module entry point.');
assert.match(pomodoro, /function createPomodoro\(/, 'Pomodoro implementation lives in its dedicated module.');
assert.doesNotMatch(framework, /_createPomodoro\(/, 'Framework must not retain the pomodoro implementation.');
assert.match(framework, /mobileDevice\s*=\s*this\._isMobile\(\)[\s\S]*?classList\.toggle\(PLUGIN_ID \+ '-phone', mobileDevice \|\| width < 680\)/, 'Mobile landscape uses the mobile layout regardless of its wide CSS viewport.');
assert.match(framework, /initialClasses[\s\S]*?this\._isMobile\(\) \|\| initialWidth < 680[\s\S]*?_buildAll\(root\)/, 'Responsive classes are applied before first-paint modules are built.');
assert.match(framework, /new ResizeObserver\(this\._viewportSyncHandler\)/, 'Split-pane and rotation changes continuously resync the container layout.');
assert.match(framework, /typeof ResizeObserver === 'function'/, 'Older runtimes safely skip the optional container observer.');
assert.match(framework, /new Set\(\['focusChart', 'scheduledTasks', 'habits', 'weeklyReview', 'projects', 'resurface', 'agenda', 'workflows'\]\)/, 'Advanced modules stay hidden until the user opts in on a fresh dashboard.');
assert.match(framework, /const hadSavedLayout/, 'Scheduler migration distinguishes a user-saved layout from first-run layout initialization.');
assert.match(framework, /const hasUserLayout = hadSavedLayout/, 'Scheduler visibility is preserved for existing user layouts.');
assert.match(layoutEdit, /titleEl\.setAttribute\('role', 'button'\)/, 'Collapsible module headings have a semantic keyboard-operable role.');
assert.match(layoutEdit, /e\.key !== 'Enter' && e\.key !== ' '/, 'Collapsible module headings support Enter and Space.');
assert.match(calendar, /cal-timeline-row p-/, 'Timeline row carries priority for a colored status node.');
assert.match(styles, /cal-timeline-rail\.first::before,[\s\S]*?cal-timeline-rail\.last::after \{ display:none; \}/, 'The timeline starts at the first node and ends at the last node.');
assert.doesNotMatch(styles, /^\.p-(high|mid|low)\s*\{/m, 'Priority colors must not use global selectors that paint entire calendar rows.');
assert.match(styles, /todo-pdot\.p-high/, 'Todo priority dots retain their high-priority color.');
assert.match(framework, /'aria-label':lang === 'en' \? 'Start a Pomodoro linked to this task' : '专注此任务：启动并关联番茄钟'/, 'Todo action buttons provide one accessible hover explanation.');
assert.doesNotMatch(framework, /todo-btn[^\n]*title:/, 'Todo action buttons must not emit duplicate title and aria-label tooltips.');
assert.match(framework, /_getHeroDueText/, 'The hero uses an exact overdue/today/tomorrow task summary.');
assert.match(framework, /flash-actions/, 'Flash capture offers post-save follow-up actions.');

console.log('P0 regression checks passed');
