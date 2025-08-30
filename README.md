# Manual commands you’ll use (no auto-fixing on save)

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

- Command: `npm run log -- "your message"` (appends to `docs/codex-working.txt`).
- Pipe stdin: `echo "multi-line\nmessage" | npm run log`.
- View last entry: `npm start` (prints the latest CODEx note or last 200 lines).
- Script location: `scripts/log.js` (appender) and `scripts/show-last-note.sh` (viewer).

## Startup Tasks

- VS Code Task: a task is provided to show the last CODEx note on folder open.
- Manual run: Terminal → Run Task → “Show: Last CODEx Note”.
- Add a quick log: Terminal → Run Task → “Log: Append CODEx Note” (prompts for a message and appends it).
