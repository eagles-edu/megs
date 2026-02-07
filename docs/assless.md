# Lesson Conversion Assistant Notes

`tools/lesson-conversion-assistant.mjs` wraps `js/convert-legacy-lesson.mjs` to modernize legacy lesson pages against a prototype template.

- **Prototype default**: `lesson-6-prepositions/1-prepositions-of-time.html`.
- **Diff preview**: enabled by default; specify `--no-diff-preview` to write files.
- **UK→US normalization**: `--uk-to-us` switches spellings/usage (e.g., “in hospital” → “in the hospital”).
- **Shell verification**: `--verify-shell` (default on) ensures the converted lesson still loads the shared nav/responsive/performance shell (`base.css`, `left-menu.css`, `right-rail-flyout.css`, `main.bundle.js`, `main.legacy.js`, `right-rail-flyout.js`) and that pager links include `<span class="pager-label">…</span>`. Use `--no-verify-shell` to skip the check.
- **Pager labels**: the converter writes pager text into `.pager-label` spans while preserving icons so truncation/ellipsis styling stays intact.
- **Heading hierarchy**: the converter ensures the first content heading inside `itemprop="articleBody"` is an `h3`; if missing it inserts one (derived from page headline), and if another heading level is first it normalizes that node to `h3`.
- **Conversion behavior**:
  - Copies the lesson body into the prototype article, keeping the prototype’s breadcrumb/pager layout.
  - Updates `<title>`/headline and breadcrumbs/pager links with legacy metadata and canonical URLs.
  - Normalizes content by stripping inline `style` attributes and dropping class tokens absent from the prototype CSS/template.
  - Normalizes replacement characters (`�` / U+FFFD), collapses repeated spaces, and optionally normalizes UK usage via `--uk-to-us`.
