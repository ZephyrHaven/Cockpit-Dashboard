# Cockpit AI Integration Plan

AI is intentionally not enabled in 1.2.0. This plan keeps every AI action explainable, previewable, and optional before any provider or API key is introduced.

## Best insertion points

1. **Daily planning assistant**
   - Inputs: Today queue, selected calendar range, task priority/due time, recent focus totals, and explicitly selected notes.
   - Output: a proposed time-blocked day, conflicts, and no more than three priority recommendations.
   - Safety: suggestions open in a preview; the user chooses which due times or priorities to apply.

2. **Natural-language task capture**
   - Input example: “明天下午三点前把周报发给产品组，高优先级 #工作”.
   - Output: title, due time, priority, and tags using the existing todo editor schema.
   - Safety: the structured editor always appears before saving; deterministic parsing remains the fallback.

3. **Review and retrospectives**
   - Inputs: completed/open tasks and focus aggregates for a chosen week. Note content is excluded by default.
   - Output: completion patterns, overcommit signals, and a short next-week adjustment proposal.
   - Safety: no medical/productivity diagnosis; every claim links back to the local facts used.

4. **Automation failure assistant**
   - Inputs: one user-selected scheduled-task audit record, redacted command metadata, exit code, stdout, and stderr.
   - Output: plain-language failure explanation and suggested troubleshooting steps.
   - Safety: AI can never run, enable, edit, or retry a Shell command. Execution stays behind the existing explicit controls.

## Architecture

- `AiProvider` adapter: provider-neutral interface for local models or remote APIs.
- `AiContextBuilder`: creates a minimal, visible context package with per-source consent toggles.
- `AiActionPreview`: displays proposed todo patches as a diff and applies only selected fields.
- `AiRedactor`: removes secrets, tokens, home paths, and command arguments before remote requests.
- `AiAudit`: stores request purpose, provider, source categories, duration, and result status—never raw note content by default.
- API credentials: use Obsidian's secret facilities when available; never store keys in `_data` Markdown or include them in exports/logs.

## Delivery phases

### Phase 0 — no model dependency

- Add a local “planning context preview” showing exactly what would be shared.
- Add deterministic time-conflict detection and structured task parsing baselines.
- Define provider interface, redaction tests, consent scopes, and preview/apply transaction tests.

### Phase 1 — task capture pilot

- Support one configurable provider plus a local-model adapter.
- Release natural-language task capture behind an opt-in setting.
- Measure acceptance/edit/rejection locally; no telemetry.

### Phase 2 — daily planning

- Add “Plan my day” from Today/calendar.
- Generate a proposal only; use existing atomic todo mutations for selected changes.
- Detect schedule conflicts and respect working hours configured by the user.

### Phase 3 — reviews and automation help

- Add weekly focus/task review.
- Add failure explanation for a single selected scheduler audit record.
- Keep all Shell execution and retries strictly non-AI and user initiated.

## Explicit non-goals

- No autonomous edits, command execution, background agent, or silent note scanning.
- No automatic upload of Vault content.
- No AI feature that becomes required for calendar, todos, Pomodoro, or scheduled tasks.
