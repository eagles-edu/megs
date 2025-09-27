Bulk Cleanup Guide (VS Code)

Overview
- Goal: centralize styling, remove deprecated head assets, align colors/typography to theme variables, and improve performance.
- Prototype reference: `exercise-1-nouns/111-common-nouns-codex.html`.

Important
- Backups: Run the backup task first; it creates `*.bak` files next to originals.
- Review: Use “Replace All” only after previewing changes in a few files.

Preload guidance
- Preloading many assets can harm first paint and bandwidth contention.
- Preload only critical, above-the-fold fonts (typically 2–4 WOFF2 files: body regular + header regular/bold).
- Always match preload URLs with the CSS `@font-face` URLs, include `as="font"`, `type="font/woff2"`, and `crossorigin`.
- Avoid preloading images or non-critical CSS unless proven beneficial.

Tasks (VS Code)
1) Open the repo in VS Code.
2) Run the tasks from Terminal → Run Task… (or Ctrl/Cmd+Shift+P → “Tasks: Run Task”).

Available tasks
- backup-html: Creates `*.bak` for all `*.html` files.
- remove-feed-links: Removes RSS/Atom `<link ...feed?type=rss|atom>` lines.
- remove-google-fonts-cssd2d5: Removes legacy Google Fonts includes (`cssd2d5.css`).
- remove-head-style-blocks: Strips `<style>...</style>` blocks inside `<head>`.
- async-sliders-css: Converts blocking sliders CSS include to preload + async pattern.
- async-content-accordion-css: Same for `media/css/content-accordion.css`.
- report-inline-hex-html: Lists files with inline hex colors (top 200 lines).
- map-safe-theme-hex-html: Applies safe theme mappings to common inline hex codes.

Regex reference (manual S&R)
- Remove feed links: `^\s*<link\b[^>]*\bfeed\?type=(?:rss|atom)[^>]*>\s*\r?\n?`
- Remove Google Fonts include: `^\s*<link\b[^>]*href=\"[^\"]*cssd2d5[^\"]*\"[^>]*>\s*\r?\n?`
- Remove `<style>` in head (selection): `(?s)<style\b[\s\S]*?<\/style>\s*`

Theme mappings used (safe subset)
- `#E0162B` → `var(--primary-color)`
- `#004c75`, `#000d4d` → `var(--link-color)`
- `#f4f6f7`, `#f0f0ee` → `var(--surface-1)`
- `#fff`/`#ffffff` → `var(--surface-color)`
- `#000`/`#000000` → `var(--text-color)`
- `#333333` → `var(--color-strong)`

Caveats
- Inline styles with unusual or content-meaningful colors (purples/oranges) were not auto-mapped. Decide per section whether to map to brand colors or keep as-is.
- If a page doesn’t need sliders or the content accordion, consider removing those CSS imports entirely rather than async loading.

Rollout plan
1) Run tasks on a small subset of pages, verify visually.
2) Expand to section folders.
3) Once confident, run across the site.

