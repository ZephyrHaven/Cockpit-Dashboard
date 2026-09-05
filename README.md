# Cockpit Dashboard

[![Release](https://img.shields.io/github/v/release/ZephyrHaven/Cockpit-Dashboard?style=for-the-badge)](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases)
[![Support on Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-Support%20Zephyr%20Haven-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

**English** | [中文](README.zh-CN.md)

Cockpit Dashboard is a local-first Obsidian home-page plugin that brings todos, calendar, RSS, search, an AI assistant, statistics, focus tracking, and local automation together in one freely arrangeable cockpit. This document covers the project positioning and how it works under the hood.

## 1.8.6 update

- The dashboard now fills its available pane instead of stopping at 960 px, with adaptive side spacing for large displays and split views.
- Dashboard content width is adjustable from the subtle grip on the right edge. Drag it to set a comfortable reading width; double-click the grip (or press End) to return to automatic full width. The preference is stored locally and re-clamped when the pane is smaller.
- Nearby devices (preview) adds QR pairing and encrypted LAN synchronization for tasks, bookmarks, display name and language, with backups and conflict review.
- AI startup failures now show the failed stage and a retry button instead of leaving an unexplained blank panel; this improves diagnosis but does not establish the cause of every Windows startup issue.

LAN sync remains opt-in and in preview: real Windows/macOS device pairing, camera permissions and firewall behavior still need cross-device acceptance testing.

## 1.8.7 update

The dashboard keeps automatic full width by default, while a subtle handle on the right edge lets you choose a comfortable content width. The choice is stored locally, follows the current pane size, and can be reset by double-clicking the handle or pressing End when it has focus.

## Core Features

- **Dashboard workbench**: today todo queue, a refined calendar board (month/week views, drag-to-schedule, lunar calendar with statutory holidays & make-up workdays, toggleable), and a per-day operations view that brings todos, scheduled/event automations, their concrete actions and status, plus a compact RSS digest into one timeline; the independent today agenda remains available alongside stat cards, edit heatmap, project progress bars, category cards, recent updates, starred files, quick-capture capsules, and resurfacing old notes; event-driven refresh keeps panel data in sync seconds after a file is saved
- **Apple Calendar sync (Mac only)**: select “Sync to iPhone calendar” per todo while creating or editing it; the first selection requests system access and automatically reuses or creates a dedicated Cockpit calendar in the default calendar account, with no settings prerequisite. Selected open todos with due dates are mirrored into it, date-only todos become all-day events, timed todos become 30-minute events, and iCloud handles delivery to iPhone
- **AI assistant**: multi-model chat sidebar with local multi-session history, multi-select note context, temporary text attachments, image chat, local keyword RAG, streaming output, and allowlisted agent tools — including vault note tools (read, create, append, move, and add inline tags; every mutation requires per-action confirmation and read-only mode never exposes them); one-click AI breakdown of a todo into subtasks; the flash-capture inbox can be clustered by the agent into topics and converted to todos or organized notes. Optional **coding workspace**: point it at a local folder and the agent can read/write code inside it, search files, and run commands to verify its changes
- **Automation**: pomodoro timer (linkable to todos), global alarms (fullscreen reminders + catch-up on missed alerts), compact countdown cards designed for larger lists, configurable percentage/fixed-time thresholds, local notifications, ServerChan³/Bark/MEOW/Resend delivery, and per-trigger SMTP rules using QQ personal mail or NetEase enterprise mail; countdowns can directly trigger a selected workflow or other scheduled-task action at a threshold or completion. Scheduled tasks support time schedules plus event triggers — a note saved in a folder, a completed todo, a finished pomodoro, or a countdown event can append to the daily note, create a todo, push a notification, or run toolbar actions / app commands / desktop shell / workflows. Workflows provide multi-step ops pipelines with condition skipping, failure retries, output passing (`{{last_output}}`), failure pushes, and run logs written to a note you choose, plus one-click inspection templates for disk space, website reachability, and backup freshness
- **Weekly report studio**: keep multiple report configurations in reliable full-row accordions, generate drafts manually, compare the untouched script output with a streaming AI-polished version, continue the same optimization in Agent, and explicitly choose which version to save. A saved report can trigger the existing scheduled-task event pipeline
- **Focus analytics**: focus trend charts (line/bar), this week vs last week, golden focus hours, top-3 task investment insights, one-click weekly-report share card PNG
- **Layout system**: a searchable component store with previews for adding, hiding, and reordering modules without covering the live dashboard in edit controls; dedicated Toolbar, statistics-card, and tip-library managers; preservation of existing user order/visibility/collapse state; and multi-scene layouts that switch automatically by weekday/time range/folder
- **Also included**: unified Spotlight search (todos / note content / file names in one query), two-pane RSS reader, bilingual UI, first-run onboarding

## Architecture

### Build System

The plugin bundles its QR generation/decoding dependencies locally with esbuild; for its own source, `build.js` concatenates the modules under `src/` in a fixed order, then races esbuild against terser and keeps the smaller minified output in `dist/` — `dist/main.js` plus a standalone `dist/styles.css` (loaded by the host, never embedded in the JS); a sourcemap is written locally for debugging only:

```text
constants → data-store → lan-sync (core / transport / store / service / UI) → ai-index → ai-context → ai … → ai-launcher
→ daily-tips → utils → todos → apple-calendar → todo-focus → focus-insights → share-card
→ habits → weekly-review → projects → resurface → morning-brief
→ serverchan → bookmarks → rss → lunar → calendar → search → toolbar
→ scenes → scheduled-tasks → alarm → pomodoro → …
→ toolbar-defs → layout-edit → silent-refresh → commands → _framework (views & plugin main class)
```

Modules share scope through top-level function declarations, so each module can be `require`d directly by Node for unit testing. Tests are framework-free assertion scripts (pure-function assertions plus source-pattern assertions) run file by file.

### Nearby devices (preview)

Open **Settings → Cockpit → Nearby devices**. On the first computer choose **Show pairing QR**; on the other choose **Scan / import QR**. You can use its camera, import a saved QR image, or paste the pairing information. Confirm on the first computer to begin two-way synchronization. No address entry, account, cloud service, or command execution is required.

This preview supports desktop IPv4 private networks. Both applications must be running and the private-network firewall must permit incoming connections. Each paired computer polls every 30 seconds; **Sync now** performs a manual round. **Pause sync** closes the listener and persists the disabled state. **Unpair** revokes the local pairing key. Changing IP addresses may require pairing again; automatic discovery and mobile devices are not yet supported.

Tasks are matched by stable IDs. Bookmarks sync membership, preserving each device's order; their target notes must already exist on the receiving device. Only display name and language preferences are included; profile preference changes take effect on reopening the dashboard. Concurrent edits keep both versions under **Review conflicts**; choose one to propagate the resolution. Deletions retain tombstones so an older device cannot restore them silently. Sync writes do not emit task-completion automation events.

Backups are named `lan-sync-<machine>.json.backup-0.json` through `backup-4.json` in the plugin folder. Each contains the previous task file text, bookmarks, preferences and sync versions. If recovery is needed, pause sync on **all** devices first, keep a copy of the current files, and restore the required content from a backup. Do not delete version metadata as a routine cleanup step. Avoid running another synchronization tool against these same data files. This first version caps the sync document at 1,500 records (including deletion markers), 16 version-vector devices and eight paired peers; exceeding a limit stops the operation instead of dropping records.

### Data & Storage Principles

| Storage | Contents |
|---|---|
| `_data/todos.md` | Todos (inline `id:`/`due:`/`p:` metadata maintained by the plugin) |
| `_data/focus.md` | Focus history accumulated per day |
| Plugin `lan-sync-<machine>.json` and backup files | Opt-in LAN sync: device identity, pairing secrets (plain text locally), record versions, deletion markers, unresolved conflicts, and the last five pre-merge backups |
| Plugin `data.json` | Storage V2 settings, layout scenes, toolbar, RSS config, Apple Calendar target/event-UID mappings, AI model config (**API keys are stored here in plain text**) |
| Plugin-private `ai-history.json` | Up to 30 AI sessions (no attachment bodies / RAG excerpts / reasoning) |
| Plugin-private `ai-index.json` | Inverted-index snapshot |
| IndexedDB | Device-local RSS article cache and read state |

No telemetry or uploads to the plugin developer. Optional LAN sync sends only tasks, bookmark paths, display name and language to computers you explicitly pair; once enabled it checks every 30 seconds while both apps run. Payloads are authenticated and encrypted with AES-256-GCM over a local HTTP connection; QR generation and decoding happen locally. The pairing secret expires after five minutes and is replaced on acceptance. API keys, executable commands, workspace paths, AI history and note contents are excluded. Pairing keys are stored in plain text in the machine-specific plugin file; do not share this file or QR images. Conflicting versions and deletion markers are retained, and the last five pre-merge backups stay in the plugin folder. Apple Calendar sync is Mac-only and sends no calendar data to the plugin developer: only after you explicitly select synchronization does the fixed local automation request access, reuse or create the dedicated calendar, and write selected open todos with due dates into it; `data.json` keeps only the target calendar name and managed event UIDs for safe updates/deletions. Only when you actively send an AI request are selected note excerpts, attachments, truncated RAG matches, or the weekly-report draft you explicitly choose to optimize sent to the model service you configured; free-form Q&A performs retrieval locally and never uploads your whole vault. Weekly-report AI optimization keeps the script output unchanged, streams a separate editable version, and saves only the version you select; a bounded original/optimized excerpt is retained in the private local AI history so you can continue the same request in Agent. The agent's vault note tools only ever create, append to, move, or inline-tag notes (never delete), and every mutation requires your per-action confirmation in the chat; under read-only permission they are not exposed at all. Scheduled-task and countdown messages are sent only to the notification channels you enable. The optional Resend channel sends the notification title, body, sender, and recipient addresses to Resend; its API key and addresses are stored in plain text in the plugin configuration. Optional QQ and NetEase SMTP accounts send countdown subjects, bodies, sender addresses, and recipients directly to the configured mail provider over TLS; their client authorization codes and addresses are also stored in plain text in the plugin configuration. Workflow run history stays in the local config file (last 20 runs per workflow); if you fill in a run-log note, the run summary is appended to that note only; failure pushes likewise go only to the push channels you have enabled.

### AI Assistant Implementation

#### Multi-Model Access & Streaming Output

- Everything goes through the OpenAI-compatible `/chat/completions`; built-in presets cover OpenAI, DeepSeek, Kimi, GLM, Qwen, MiniMax, SiliconFlow, OpenRouter, Ollama, and any compatible endpoint can be added manually
- SSE streaming is parsed token by token; `stream_options:{include_usage:true}` fetches real billed tokens; high-frequency scrolling and status refreshes are coalesced so long answers never drop frames
- Layered timeouts: connect 15s, stream idle 60s, whole request 60s, non-streaming fallback 120s; if `fetch` fails it degrades to a non-streaming `obsidian.requestUrl` call; when a provider rejects `stream_options` with 400/422 the parameter is dropped and retried once
- Reasoning content gets its own track, and retrieval or generation can be aborted at any time

#### Local Inverted-Index RAG (Lexical, Not Vector)

- Maintains a `term → Set(docId)` inverted table, incrementally updated from vault modify/delete/rename events, with the snapshot persisted to `ai-index.json`
- The full-vault index warms up in the background when the AI sidebar opens; queries narrow to a candidate document set first, then read cached lowercased slices of matching notes in parallel for scoring, injecting only length-limited relevant excerpts
- The same sliced retrieval runs when multi-select context exceeds the limit; free-form Q&A without manually chosen context searches all Markdown globally
- It is deliberately lightweight keyword retrieval: no vector store, no embeddings — data never leaves the device

#### Image Multimodal

- Paste screenshots with Ctrl/Cmd+V or add via file picker (`files` and `items` dual extraction), up to 4 images, ≤8MB raw each
- Compression pipeline: FileReader → dataURL → Image decode → canvas proportional scaling (long edge ≤1568px) → JPEG re-encode at quality 0.85
- Sent as a `{type:'text'} + {type:'image_url'}` array inside the user message; sent bubbles show thumbnails with lightbox zoom (Esc/backdrop closes). Vision models required for image understanding

#### Agent Tool System & Three-Tier Permissions

- **Allowlist registry**: the agent can only call registered tools (read todos, search notes, etc.), arguments validated against JSON Schema, protected paths (`.obsidian` config, plugin source) hard-filtered; with no coding workspace configured, no file writes or command execution are exposed at all
- **Three-tier permission modes**: `Read-only` (mutating tools never reach the model) / `Read-write` (default; every mutation requires confirmation) / `Full` (no confirmations, at your own risk)
- **Local tool adapter layer**: system capabilities exposed through composed registries — desktop notifications, clipboard write, opening links/files, and a **user-managed command allowlist** (run with `execFile`, vault root as working directory, 20s timeout, capped output). The model can only invoke allowlisted commands by id, never invent new ones
- **Coding workspace (sandbox)**: once you designate a local folder, the agent additionally gains file tools inside that directory — list directory, line-based read, full-text search (skipping `.git`/`node_modules`), create/overwrite files, exact string-replacement editing (read-before-edit, ambiguous-match refusal, external-modification detection) — plus single-command execution inside the workspace (no shell chaining, bounded output/timeouts). Safety constraints: paths pass both lexical and realpath checks to block symlink escapes, `.git` cannot be modified, and sudo/su/doas are refused before any confirmation prompt; folders can be picked via the native folder chooser or pasted as paths, with one-click switching among recent workspaces
- Tool calls stream live along the activity track with name, arguments, and result summaries

#### Conversation History & Usage Stats

- Sessions persist locally; each remembers its model, context selection, permission mode, and bound coding workspace; the session list groups by workspace, and switching sessions restores the bound workspace
- Provider usage fields are normalized (DeepSeek's `prompt_cache_hit_tokens`, OpenAI's `cached_tokens`, etc.) with session-level input/output token totals, cache-hit rate, and generation speed

## Installation

**Community plugins (recommended)**: Settings → Community plugins → Browse → search **Cockpit Dashboard** → install & enable.

**Manual install**: download `main.js`, `manifest.json`, and `styles.css` from [Releases](https://github.com/ZephyrHaven/Cockpit-Dashboard/releases), drop them into `.obsidian/plugins/cockpit-dashboard/`, then enable the plugin.

## Development

```bash
git clone https://github.com/ZephyrHaven/Cockpit-Dashboard.git
cd Cockpit-Dashboard

# Run tests (framework-free assertion scripts, executed per file)
for t in tests/*.test.js; do node "$t"; done

# Build minified artifacts into dist/
node build.js

# Build and deploy to your local host plugin directory (never overwrites user data.json)
bash deploy.sh
```

Release convention: bump the version in `manifest.json` → build and test → tag without a `v` prefix → use `gh release create <version>` to upload `dist/main.js`, `dist/styles.css`, and `manifest.json` as three separate assets (the plugin store relies on them for update detection). Build artifacts are never committed to the source repository.

## Sponsor

If this plugin genuinely saves you time, buying the author a coffee is appreciated:

[![Afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-%E8%AF%B7%E4%BD%9C%E8%80%85%E5%96%9D%E4%B8%80%E6%9D%AF-8b5cf6?style=for-the-badge)](https://afdian.com/a/zephyrhaven)

Or visit directly: <https://afdian.com/a/zephyrhaven>

## Author

- GitHub: [ZephyrHaven](https://github.com/ZephyrHaven)
