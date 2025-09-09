# Manual commands you’ll use (no auto-fixing on save)

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/bff050e86a174d83b4bba4b866d9487f)](https://app.codacy.com/gh/eagles-edu/megs?utm_source=github.com&utm_medium=referral&utm_content=eagles-edu/megs&utm_campaign=Badge_Grade)

See problems as you type: extensions surface diagnostics automatically.

Format everything: npm run format

Format only HTML: npm run fmt:html

Lint HTML: npm run lint:html

Lint JS: npm run lint:js (and npm run lint:js:fix when you want fixes)

Lint CSS: npm run lint:css (and npm run lint:css:fix when you want fixes)

Or use Tasks:

Terminal → Run Task → Format: Prettier (all) etc.

Notes on things we fixed/avoided

No stylelint-config-prettier: it’s unmaintained and conflicts with Stylelint v16 peer range. We keep overlap low by disabling a couple of purely stylistic rules (max-line-length), and let Prettier handle formatting.

No custom problemMatcher for html-validate: the stylish formatter doesn’t match built-in patterns. Leaving it empty avoids schema errors while still showing diagnostics via the extension.

- Disabled `close-order` (html-validate): legacy pages include mixed/implicit nesting leading to many false positives. We’ll revisit enabling once pages are normalized.

Live Server “unknown setting”: if you don’t have that extension installed, VS Code marks those keys as unknown. You can delete that block from settings.json if you’re not using it.

## Preferences

- Location: `.codex/prefs.json`
- Purpose: stores assistant/session preferences (verbosity, planning, diffs, patch style, etc.) so they persist across sessions.
- Edit: update the JSON values directly; changes take effect next session.

## Logging

- Source of truth: `docs/codex-log.md` (no summaries or extra logs).
- Session header: `===== CODEx SESSION START @ 2025-08-31T13:45:22Z =====`
- Append a note: `npm run log -- "your message"` (writes to `docs/codex-log.md`).
- Startup ingest: `npm start` silently reads either the latest session block or a 300-line tail; if the current log has <300 lines, it backfills from the most recent archives until 300 are gathered; only a one-line status summary is printed.
- Rotation: archives to `docs/codex-archive/` when file > ~5MB, and weekly at Mon 08:00 (+07). Archived filenames include local +07 timestamp.
- Scripts: `scripts/log.js` (appender), `scripts/show-last-note.sh` (viewer), `scripts/startup.sh` (startup + rotation + ingest).

## Startup Tasks

- VS Code Task: a task is provided to show the last CODEx note on folder open.
- Manual run: Terminal → Run Task → “Show: Last CODEx Note”.
- Add a quick log: Terminal → Run Task → “Log: Append CODEx Note” (prompts for a message and appends it).
