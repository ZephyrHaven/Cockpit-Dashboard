# Cockpit Dashboard

**English** | [中文](README.zh-CN.md)

Cockpit Dashboard is a local-first home dashboard for Obsidian. Todos, calendar, RSS, AI assistant, focus stats and local automation live in one workbench you can rearrange freely — no account, no cloud, no telemetry.

## Highlights

- **Today at a glance** — a today queue, a refined calendar (month/week views, drag to reschedule, lunar calendar and statutory holidays), and a per-day timeline that merges todos, scheduled/event automations and an RSS digest. Around it: stats cards, edit heatmap, project progress, recent updates, starred notes, quick-capture capsules and resurfaced notes.
- **Tasks that behave** — repeating todos with fixed schedules or completion-based intervals, batch edits, archive with undo, a focus queue, and one-click AI breakdown into subtasks.
- **AI assistant** — multi-model sidebar with local sessions, multi-select note context, image input, local lexical RAG (keyword search, no embeddings), streaming output and allowlisted Agent tools. Choose read-only, read-write (confirm each change) or full mode; every todo write is read back before success is reported. An optional coding workspace lets the Agent read, edit and run commands inside a folder you pick.
- **Automation** — pomodoro, global alarms, countdown cards, time- and event-driven tasks, multi-step workflows, and delivery through local notifications, ServerChan³, Bark, MEOW, Resend or SMTP.
- **Reviews** — morning brief, weekly report studio with a side-by-side AI-polished draft, focus analytics and shareable PNG cards.
- **Layout** — a searchable component store, scene layouts that switch by weekday, time range or folder, and an optional unified glass look.
- **Also included** — natural-language quick capture, Spotlight search across todos, notes and filenames, a two-pane RSS reader, Apple Calendar sync on Mac, encrypted sync between your own computers and a shared team space (both in preview), bilingual UI and first-run onboarding.

## Installation

**Community plugins (recommended)**: Settings → Community plugins → Browse → search **Cockpit Dashboard** → install and enable.

**Manual install**: download the latest release from [GitHub Releases](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases), copy `main.js`, `manifest.json` and `styles.css` into `.obsidian/plugins/cockpit-dashboard/`, then enable the plugin. To upgrade, replace only those three files so your `data.json` settings stay intact.

## Recommendations

### Cockpit Glass

Pair the dashboard with [Cockpit Glass](https://github.com/ZephyrHaven/cockpit-glass), our companion theme with frosted surfaces, layered cards, and light and dark modes. It is available in the Obsidian theme store: **Settings → Appearance → Themes → Manage → search Cockpit Glass → Install and use**.

For matching dashboard surfaces, enable **Settings → Cockpit → Appearance & motion → Unified glass appearance**. On macOS, the host’s **Translucent window** option enables native window frost. See the [theme’s installation guide](https://github.com/ZephyrHaven/cockpit-glass#readme) for platform requirements and appearance options.

The theme is installed and updated separately through the theme store. Existing theme files remain in place when you upgrade the plugin.

## Glass alarm reminders

Open the sliders icon in the alarm module to choose **Half screen** or **Full screen** and preview it. The choice applies to all alarms and is saved locally; existing installations keep full screen by default. Both modes use a frosted surface that obscures the content behind the reminder.

Use **Stop** to dismiss an alarm or snooze it for ten minutes. Multiple alarms are queued. Only full-screen mode requests window full screen.

## Elastic Pomodoro

Stretch either edge to choose 1–120 minutes before starting, or enter the duration directly. Add a remark or link a task in the settings. During a session, stretching adjusts the width: narrow layouts keep the countdown and essential controls; wider layouts reveal more details. Hours appear only when needed.

Choose normal, compact or persistent minimal mode. To keep the dial visible, shrink the compact bar to its minimum, continue inward and release. Drag the dial to move it; click it to return to compact mode, then expand for settings. Its mode, position, width and remark are saved locally. An idle compact timer also shrinks automatically after 12 seconds; hover restores it, while a pinned dial stays minimal.

Moving and stretching provide subtle visual feedback, with tactile feedback where supported by the device and system settings, including Force Touch trackpads on Mac. The dial uses a rotating second hand.

When a session ends, the lower-half frosted reminder offers a five-minute break or another focus round. Full-screen reminders and break-end reminders are configurable separately. Reset before changing a session’s duration once progress has begun; breaks do not count toward focus totals.

## Custom components

Choose **Import component** in the component store, select a local JSON package or component folder, review its identity and permissions, then apply the layout. Component details support updates, disabling, export and uninstall. New components remain hidden in other layout scenes.

Download the reading-progress example from the store, or see the [SDK v1 guide](docs/component-authoring-spec.md) and [examples](examples/custom-components/README.md). Component code runs in a restricted Worker with no file, command or network API.

## Data & privacy

Everything is stored in your vault or the plugin folder. There is no telemetry, and nothing is uploaded to the developer.

| Where | What |
|---|---|
| `_data/todos.md`, `_data/team-todos.md` | Todos (inline metadata and repeat rules) and a readable mirror of team tasks |
| `_data/focus.md` | Focus history per day |
| `data.json` | Settings, layout scenes, Pomodoro session (duration, remark, presentation and position), alarm reminder appearance, toolbar, RSS config, Apple Calendar mappings, AI model config and persistently approved low-risk Agent actions (**API keys are stored here in plain text**) |
| `lan-sync-<machine>.json`, `team-sync-<machine>.json` + backups | Opt-in LAN/team sync state, including plaintext pairing secrets local to this machine |
| `ai-history.json`, `ai-index.json`, `logs/agent-tools.jsonl` | Up to 30 AI sessions, the local search index snapshot, and the last 500 Agent tool receipts |
| `custom-components.json`, `.backup` | Locally imported component code, enable state, runtime errors and private JSON data; uninstall can retain data for reinstall. No automatic network access or sync |
| IndexedDB | Local RSS article cache and read state |

**Network access happens only when you use the related feature:**

- **AI** — selected note excerpts, attachments, local RAG matches or the report draft you choose are sent to the model endpoint you configure. Free-form Q&A retrieves locally and never uploads the whole vault.
- **LAN and team sync** — tasks, bookmark paths, display name, language and the morning-brief routing choice are sent only to devices you explicitly pair, encrypted with AES-256-GCM and kept inside your local network. API keys, commands, workspace paths, AI history and note contents are excluded.
- **Notifications and mail** — messages go only to the channels you enable (local, ServerChan³, Bark, MEOW, Resend, SMTP).
- **Apple Calendar (Mac only)** — a fixed local script reads or writes the Calendar app after you opt in; no calendar data reaches the developer. "Show system calendar events" is off by default and caches event titles, times, locations and calendar names locally for up to 24 hours. Meeting notes are created only when you click an event.
- **RSS** — subscribed feeds are fetched directly into a local IndexedDB cache.
- **Updates** — a standard HTTPS request to the public GitHub Releases API at most once every 24 hours.

## Development

```bash
git clone https://github.com/ZephyrHaven/Cockpit-Dashboard.git
cd Cockpit-Dashboard

node tests/run-all.js   # framework-free assertion tests
node build.js           # minified artifacts into dist/
bash deploy.sh          # build and copy into your local plugin folder
```

Source modules are plain scripts concatenated in a fixed order by `build.js`, then minified with esbuild/terser; `dist/styles.css` is built separately.

Releases are tagged without a `v` prefix and include `main.js`, `styles.css`, `manifest.json` as three separate assets.

## Sponsor

If this plugin saves you time, you can buy the author a coffee:

[![Support on Afdian](assets/afdian-badge.svg)](https://afdian.com/a/zephyrhaven)

<https://afdian.com/a/zephyrhaven>

## Author

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
