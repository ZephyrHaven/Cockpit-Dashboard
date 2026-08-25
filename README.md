# Cockpit Dashboard

A customizable cockpit-style dashboard homepage for your Obsidian vault.
替代 Obsidian 默认首页，提供知识库管理的"仪表盘"体验。

## Features

| Feature | Description |
|---------|-------------|
| 👋 Greeting | Time-based greeting with **editable name** (double-click), shows due task reminders (🔴🟡🟢) |
| 📂 Categories | Top-level folder cards, click to open overview, **collapsible** |
| 📊 Statistics | Note count, todo stats, completion rate, focus minutes, **collapsible** |
| 📅 Calendar | Monthly calendar view with todo dot markers |
| ✅ Todos | Tag filter, priority (high/mid/low), due dates, **collapsible** |
| ✏️ Recent Files | Recently edited files list, **collapsible** |
| ⭐ Bookmarks | Bookmark/unbookmark with real-time sync |
| ⚡ Quick Notes | Save fleeting thoughts to `_daily/YYYY-MM-DD.md`, **collapsible** |
| 📈 Heatmap | 30-day editing heatmap with color intensity, **collapsible** |
| 🔍 Search | Inline search from toolbar, real-time file matching |
| 🛩️ Cockpit H5 | Launch H5 dashboard at `http://localhost:3456` |
| 📝 Work Log | Run Python script for automated work logging |
| 🍅 Pomodoro | Draggable floating timer, 25+5 cycle, **minimize/close** support |
| 🤖 Hermes | Open integrated terminal and launch Hermes TUI |
| 💡 Daily Tips | Built-in dev-ops tips, rotates daily |

## Installation

### Option 1: BRAT (Recommended)

1. Install the [BRAT](https://obsidian.md/plugins?search=BRAT) plugin from Community Plugins
2. Go to BRAT Settings → `Add Beta plugin` → Enter:
   ```
   https://github.com/sadom125/Cockpit-Dashboard
   ```
3. Enable "Cockpit Dashboard" in Community Plugins

> Updates are auto-detected by BRAT from GitHub Releases.

### Option 2: Manual

1. Download the latest `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/sadom125/Cockpit-Dashboard/releases)
2. Copy them to your vault's `.obsidian/plugins/cockpit-dashboard/` folder
3. Reload plugins and enable "Cockpit Dashboard"

## Usage

### Todo Syntax

In `_data/todos.md`:

```markdown
- [ ] Normal task
- [x] Completed task | created: 2026-06-01 | done: 2026-06-02
- [ ] High priority p:high
- [ ] With due date due: 2026-06-10
- [ ] With tags #work #urgent
```

### Data Files

| File | Purpose |
|------|---------|
| `_data/todos.md` | Todo list |
| `_data/bookmarks.md` | Bookmarked files |
| `_daily/YYYY-MM-DD.md` | Quick notes / flash thoughts |

## Author

h (sadom125)
