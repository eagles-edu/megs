# QA Accordion + Navigation Refactor (Codex Variant)

This document summarizes the transition to a Single Source of Truth (SSOT) for the in‑content Q&A accordion and the split/rename of left and flyout navigation behaviors and styles.

## Summary

- Q&A accordion behavior consolidated in dedicated CSS/JS for content area.
- Left navigation (accordion menu) and Flyout navigation have dedicated CSS/JS with clear names.
- Backward‑compatibility shims/stubs are kept for existing includes.
- CI runs verification and smoke tests via jsdom.

## File Map (Added/Renamed)

- Q&A (content area)
  - Added: `web-asset/js/qa-accordion.js` (SSOT behavior)
  - Tweaked: `web-asset/css/qa-accordion.css` (SSOT styles; imports theme vars)

- Left menu (accordion navigation)
  - Renamed: `web-asset/js/megs-behavior.js` → `web-asset/js/left-menu.js`
  - Stub: `web-asset/js/megs-behavior.js` (loads `left-menu.js`)
  - Renamed: `web-asset/css/accordion.css` → `web-asset/css/left-menu.css`
  - Shim: `web-asset/css/accordion.css` now `@import url("left-menu.css")`

- Flyout menu (hover navigation)
  - Added: `web-asset/js/flyout-menu.js`
  - Added: `web-asset/css/flyout-menu.css` (currently imports `flyout.css`)

- Page wiring (example)
  - Updated: `exercise-1-nouns/111-common-nouns-codex.html` to include new CSS/JS

- Verification and CI
  - Added: `scripts/verify-prototype.js` (accordion + menus)
  - Added: `scripts/smoke-pages.js` (smoke across multiple pages)
  - Updated: `package.json` scripts and devDependencies (`jsdom`)
  - Updated: `.github/workflows/ci.yml` to run verification and smoke tests

## HTML Integration (Codex Page Example)

```html
<!-- CSS -->
<link href="../web-asset/css/flyout-menu.css" rel="stylesheet">
<link href="../web-asset/css/left-menu.css" rel="stylesheet">
<link rel="stylesheet" href="../web-asset/css/qa-accordion.css">

<!-- JS -->
<script src="../web-asset/js/template592f.js" defer></script>
<script src="../web-asset/js/left-menu.js" defer></script>
<script src="../web-asset/js/flyout-menu.js" defer></script>
<script src="../web-asset/js/qa-accordion.js" defer></script>
```

## Markup Pattern (Accordion Item)

```html
<div class="nn_sliders accordion panel-group" id="set-nn_sliders-1">
  <div class="accordion-group panel nn_sliders-group">
    <div class="accordion-heading panel-heading">
      <a
        class="accordion-toggle nn_sliders-toggle"
        data-toggle="collapse"
        data-id="sec-1-example"
        data-parent="#set-nn_sliders-1"
        href="#sec-1-example"
      >
        <span class="nn_sliders-toggle-inner">1. Example sentence.</span>
      </a>
    </div>
    <div class="accordion-body nn_sliders-body collapse" id="sec-1-example">
      <div class="accordion-inner panel-body">
        <h2 class="nn_sliders-title">1. Example sentence.</h2>
        <p>Answer content…</p>
      </div>
    </div>
  </div>
  <!-- more .accordion-group items -->
  <!-- data-parent enforces one-open-at-a-time per group -->
  <!-- .collapse + .in/.show control visibility -->
  <!-- aria-expanded updated dynamically -->
</div>
```

## Behavior Details

### Q&A Accordion (SSOT)

- File: `web-asset/js/qa-accordion.js`
- Key points:
  - Delegated click handler within `#content` toggles matching `.accordion-body`.
  - Normalizes `href` to same‑page hash to avoid navigation.
  - Updates `aria-expanded`, toggles `.in` and `.show`, and sets inline height for smooth behavior.
  - Respects `data-parent` to close siblings (one-open-at-a-time).
  - Keyboard support: Enter/Space on the toggle.

Minimal excerpt:

```js
content.addEventListener('click', (e) => {
  const toggle = e.target && e.target.closest('a.accordion-toggle');
  if (!toggle) return;
  e.preventDefault();
  let targetId = toggle.getAttribute('data-id') || (toggle.getAttribute('href')||'').split('#')[1];
  const body = document.getElementById(targetId) || toggle.closest('.accordion-group')?.querySelector('.accordion-body');
  if (!body) return;
  const isOpen = body.classList.contains('in') || body.classList.contains('show');
  // close siblings if data-parent
  // …
  if (isOpen) { /* remove in/show, height=0, aria=false */ }
  else { /* add in/show, height=auto, aria=true */ }
});
```

### Q&A Styles (SSOT)

- File: `web-asset/css/qa-accordion.css`
- Scope: `#content` area only; imports `theme-vars.css`.
- Supports legacy `.in` and modern `.show` states; hides duplicate legacy titles.

### Left Menu (Accordion Navigation)

- Behavior: `web-asset/js/left-menu.js` (hover open/close of `#accordion_menu_90`).
- Styles: `web-asset/css/left-menu.css` (renamed from `accordion.css`).
- Back‑compat: old paths left in place with shims.

### Flyout Menu (Hover Navigation)

- Behavior: `web-asset/js/flyout-menu.js` (hover open/close, anchor navigation).
- Styles: `web-asset/css/flyout-menu.css` imports `flyout.css` for now.

## Backward Compatibility

- `web-asset/js/megs-behavior.js` now a stub that loads `left-menu.js` and logs a deprecation notice.
- `web-asset/css/accordion.css` now imports `left-menu.css`.
- `web-asset/css/flyout-menu.css` currently imports the original `flyout.css`; pages can migrate to the new name without losing styles.

## Tests and CI

- Package scripts (added):

```json
{
  "scripts": {
    "verify:prototype": "node scripts/verify-prototype.js",
    "smoke:pages": "node scripts/smoke-pages.js"
  },
  "devDependencies": {
    "jsdom": "^24.1.0"
  }
}
```

- Verification: `scripts/verify-prototype.js`
  - Validates Q&A open/close (click + Enter), aria updates, one‑open‑per‑group when `data-parent` present.
  - Confirms left and flyout hover behaviors.

- Smoke tests: `scripts/smoke-pages.js`
  - Loads a small set of pages, injects left/flyout JS, checks open/close on hover.

- GitHub Actions: `.github/workflows/ci.yml`
  - Runs lint, then `verify:prototype` and `smoke:pages` on push/PR.

CI excerpt:

```yaml
      - name: Verify Prototype (QA/menus)
        run: npm run verify:prototype

      - name: Smoke Test Multiple Pages
        run: npm run smoke:pages
```

## Migration Guide (Other Pages)

1) Include the new CSS/JS:

```html
<link href="/web-asset/css/flyout-menu.css" rel="stylesheet">
<link href="/web-asset/css/left-menu.css" rel="stylesheet">
<link href="/web-asset/css/qa-accordion.css" rel="stylesheet">

<script src="/web-asset/js/left-menu.js" defer></script>
<script src="/web-asset/js/flyout-menu.js" defer></script>
<script src="/web-asset/js/qa-accordion.js" defer></script>
```

2) Ensure Q&A markup matches the pattern above (toggle `data-id`/`href` hash matches the body `id`). Optional `data-parent` for exclusivity.

3) Remove legacy jQuery/Bootstrap accordion initializers on content pages (if any). The codex variant does not rely on jQuery.

## Local Verification

```bash
npm ci
npm run verify:prototype
npm run smoke:pages
```

All checks should report OK.

