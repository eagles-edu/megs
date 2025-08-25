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

Live Server “unknown setting”: if you don’t have that extension installed, VS Code marks those keys as unknown. You can delete that block from settings.json if you’re not using it.
