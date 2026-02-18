# Table Wrap System (List + Non-List)

## Purpose

This document defines the responsive table-wrap behavior, header synthesis, and CLS-safe loading expectations for all list variants.

## Phase Status

1. Phase 1 complete:
   - Wrap-specific CSS/JS extracted from core bundles.
2. Phase 2 complete:
   - Variant codification standardized in runtime with per-table metadata.
3. Phase 3 complete:
   - CLS-critical asset map codified for root/category + lesson/list profiles.
4. Phase 4 complete:
   - Conditional table-wrap asset loading is active when content tables exist.

## Variant Matrix

1. `pairs` (`.table-pairs-ready`)
   - Source shape: 4/5-column paired datasets.
   - Mobile shape: 2-column key/value rows.
   - Synthetic header span: `2`.
2. `list` (`.table-list-ready`)
   - Source shape: title-row + raw datum cells.
   - Mobile shape: 1-column stacked datum rows.
   - Synthetic header span: `1`.
3. `columns` (`.table-columns-ready`)
   - Source shape: explicit column grouping (`data-stack="columns"`).
   - Mobile shape: 1-column cards containing a column label + values list.
   - Synthetic header span: `1`.
4. `simple` (`.table-simple-ready`)
   - Source shape: generic 1/2-column tables.
   - Mobile shape: card stack with labeled values.
   - Synthetic header span: source column count (`1` or `2`).
5. `stack` (`.table-stack-ready`)
   - Source shape: 3+ columns.
   - Mobile shape: stacked cards with per-cell labels.
   - Synthetic header span: `1` (never source-width on mobile wrap).

## Variant Data Contract

Each classified table now receives a canonical metadata profile:

1. `data-wrap-variant`:
   - `pairs | list | columns | simple | stack`
2. `data-wrap-source-cols`:
   - Detected source column count.
3. `data-wrap-mobile-cols`:
   - Effective wrapped column count on mobile.
4. `data-wrap-header-span`:
   - Synthetic header `colspan` used for mobile header row.
5. `data-wrap-header-mode`:
   - `text` or `cosmetic`.
6. `data-wrap-cosmetic-mode`:
   - `text` or `cosmetic` after synthetic header render.
7. `data-wrap-classifier`:
   - Runtime classifier signature (`tablewrap-v2`).

## Synthetic Header Rules

Synthetic wrap headers are generated programmatically and do not depend on source `<thead>` rendering.

1. 3+ source-column wraps
   - Use a simple cosmetic header (no text).
2. 2-column wraps
   - May show text only when columns are distinct/discrete.
   - If labels are not distinct, fallback to dataset title when available.
3. 1-column wraps
   - Use dataset title text when available for single-category/uncategorized datasets.
4. `list` variant override
   - If a list table has a wide source title row (`colspan >= 3`) but still wraps to one mobile column, keep dataset title text enabled.
5. Width invariant
   - Cosmetic wrap header row must always render full table width, including no-text headers.

Dataset title resolution order:

1. `data-wrap-title` or `data-stack-title`
2. `<caption>`
3. Single-cell title-style header row
4. Nearest previous heading / bold paragraph label

## CLS/LH Critical Assets

To keep layout stable and avoid wrap/pager flash:

1. Critical CSS in head:
   - `#theme-vars-critical`
   - `#critical-inline`
   - `#pager-style-overrides`
2. Blocking shell CSS:
   - `web-asset/css/base.css`
   - `web-asset/css/right-rail-flyout.css`
   - `web-asset/css/left-menu.css`
   - `web-asset/css/page-classes.css`
3. Runtime JS pair:
   - `web-asset/js/main.bundle.js`
   - `web-asset/js/main.legacy.js`
4. Extracted table-wrap assets (conditionally injected only when content tables are present):
   - `web-asset/css/tablewrap.css`
   - `web-asset/js/tablewrap.bundle.js`
   - `web-asset/js/tablewrap.legacy.js`

## CLS-Critical Asset Map

1. Root/category home pages (`index.html`, `index-2.html`, `grammar-lessons.html`, `grammar-exercises.html`, `lists.html`):
   - Must include critical inline styles (`theme-vars-critical`, `critical-inline`, `pager-style-overrides`).
   - Must include shell CSS (`base.css`, `left-menu.css`, `right-rail-flyout.css`, `page-classes.css`).
   - Must include bundle trio (`main.bundle.js` preload + module script + `main.legacy.js` nomodule).
2. Lesson/list section pages:
   - Same as root/category home pages.
   - Must include early mobile bootstrap script and SVG sprite before body grid.
3. Table-bearing pages:
   - Do not hard-wire `tablewrap.css`/`tablewrap.*.js` in HTML.
   - Rely on conditional loader from `main.bundle.js`/`main.legacy.js`.
   - Loader checks `main#content/#content table` presence before injecting assets.

## Split Strategy Status

Implemented:

1. Wrap-specific CSS moved to `web-asset/css/tablewrap.css`.
2. Wrap runtime moved to `web-asset/js/tablewrap.bundle.js` and `web-asset/js/tablewrap.legacy.js`.
3. Conditional loading in `main.bundle.js` and `main.legacy.js` based on candidate tables in `main#content/#content`.
4. Synthetic-header generation remains in the same runtime as wrap classification.

Future optional optimization:

1. Split by variant (`pairs`, `list`, `columns`, `simple`, `stack`) only if profiling shows clear payload gains versus added complexity.

## Root/Home Parity Checklist

Root and category homes should keep:

1. Module + nomodule bundle loading (`main.bundle.js`, `main.legacy.js`).
2. Early `<script data-mobile-nav-bootstrap>`.
3. Modern shell body/grid order (`body.base`, `.body.grid-modern`, container/row/sidebar/content/aside pattern).
4. No legacy jQuery/bootstrap template loader stack.

## Verification Commands

1. Full lesson/list parity:
   - `node tools/check-page-parity.mjs --all-lessons --all-lists`
2. Prototype behavior regression:
   - `npm run verify:prototype`
3. Internal link audit (sitewide relative links):
   - `node tools/check-internal-links.mjs`
