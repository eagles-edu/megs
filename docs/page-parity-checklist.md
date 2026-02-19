# Page Parity Checklist (111 Shell Standard)

Use this checklist when modernizing any page so parity is consistent and repeatable.

## Purpose

- **Single shell standard**: `exercise-1-nouns/111-common-nouns.html` is the structural source of truth (SoT).
- **Profile split**:
  - **Exercise profile**: full 111 shell **with** exercise runtime.
  - **Lesson/List/Static profile**: 111 shell **without** exercise runtime.
- **No whack-a-mole**: apply the full checklist in one pass, then run verification.

## Scope Decision (first step)

Choose one profile before editing:

1. **Exercise page**
   - Keep gate runtime and exercise JSON/config blocks.
   - Keep `exercise-gate.js` and `exercise-devtools.js` (mode by environment policy).
2. **Lesson/List/Static page**
   - Remove exercise runtime and exercise-only attributes/scripts/JSON.
   - Keep shell/nav/menu/perf architecture from 111.

## Required Head Architecture

Apply these in order:

1. **Meta order/parity**
   - `charset`, `viewport`, `theme-color`, `keywords`, `description`, `generator`.
   - Generator string: `English Grammar - IELTS intermediate levels A2 and above`.
2. **Theme tokens block**
   - Keep `theme-vars-critical` structure.
   - Keep sidebar/flyout tokens (`--left-menu-*`, `--r-flyout-*`).
   - Lesson/List/Static profile: keep menu state tokens (`--menu-state-bg`, `--menu-state-border`, `--menu-state-text`).
   - Exercise profile: keep textarea sizing tokens (`--sizetextarea`, `--sizeformtextarea`).
3. **Core CSS loading**
   - `base.css`: preload + blocking stylesheet + noscript fallback.
   - Keep `pager-style-overrides` and `critical-inline` (and `critical-inline-augment` when present in target architecture).
4. **Shared CSS loading**
   - `right-rail-flyout.css`, `left-menu.css`, `page-classes.css` as preload + blocking stylesheet + noscript fallback.
   - Exercise profile: include exercise page stylesheet block(s) used by the current architecture.
5. **JS loading**
   - Keep bundle trio:
     - `modulepreload` for `main.bundle.js`
     - `type="module"` script for `main.bundle.js`
     - `nomodule` fallback `main.legacy.js`
   - Keep `right-rail-flyout.js` deferred.
   - Exercise profile only: keep exercise runtime scripts.
6. **Speculation rules policy**
   - Do **not** add/keep speculationrules prerender/prefetch injections unless explicitly requested.
   - Keep the comment documenting prerender-removal baseline where used.

## Required DOM Order

1. `<body>` starts with early mobile bootstrap script:
   - `<script data-mobile-nav-bootstrap>document.body.classList.add("mobile-nav-enabled")</script>`
2. Then inline SVG sprite block (require `xmlns`; allow `xmlns:xlink` but do not require it).
3. Then body shell container/grid (`.body.grid-modern`, `.container`, `.row-fluid`, sidebar/content/aside order).
4. Sidebar menu template/markup must remain structurally aligned with the current shell pattern.

## Responsive/Menu Parity

- Keep responsive menu token clamps (`--left-menu-font-size`, paired icon sizing tokens).
- Keep desktop single-line sidebar labels unless a documented exception is required.
- Keep mobile menu bootstrap path and class toggling behavior stable.
- Do not reintroduce legacy jQuery-driven menu handlers on converted shell pages.
- Keep shared `<=480px` shell spacing parity from shared CSS (`.container/.container2` zero side padding, `.row-fluid` `-30px` gutters, span/aside columns `15px` inner padding) and avoid page-level overrides.

## Profile Exclusions (to prevent drift)

### Lesson/List/Static profile must NOT include

- `data-exercise-*` attributes.
- exercise answer-key/config JSON blobs.
- `exercise-gate.js` and `exercise-devtools.js`.
- exercise submit UI/runtime blocks.

### Converted modern shell pages must NOT include

- `media="print"` CSS swap loading pattern.
- legacy template/bootstrap/jQuery includes from old Joomla-era shells.
- ad hoc speculationrules injection blocks (unless explicitly approved).

## Content/UX Consistency Checks

- Breadcrumb schema/labels/positions intact and valid.
- Pager links preserve semantic labels and icon ordering.
- Heading hierarchy remains semantically correct after migration.
- Relative paths are correct for nested directories (`../` depth).
- Main content flow in the center column is ordered as: `title` -> `breadcrumbs` -> `top pager` -> `content` -> `bottom pager` -> `breadcrumbs`.
- List-table stack mode applies to 3+ column tables by default; add `data-stack="off"` on a specific `<table>` to opt out without code changes.

## Quick Audit Commands

Run these against a target file before/after edits:

```bash
rg -n "theme-color|generator|modulepreload|main\\.legacy|data-mobile-nav-bootstrap|icon-sprite|xmlns=" <target-file>
rg -n "exercise-gate|exercise-devtools|data-exercise|exercise-answer-key|exercise-config" <target-file>
rg -n "media=\"print\"|speculationrules|template592f|jquery\\.min592f|bootstrap\\.min592f" <target-file>
```

Interpretation:

- Exercise profile: second command should match expected exercise markers.
- Lesson/List/Static profile: second command should return no matches.
- Third command should return no matches on modernized pages.

## Optional Automation

For section-wide parity upgrades (prototype shell transplant + breadcrumb normalization + right-flyout reflow), use:

```bash
node tools/upgrade-section-parity.mjs --prototype <prototype-file> --targets-file <targets-file> --write
```

See `docs/section-parity-runbook.md` for target-list generation, dry-run/apply commands, and verification flow.

## Verification and Rollback

1. Save backup and undo patch before edits (`.BAK-<timestamp>` + `/tmp/codex-undo-<timestamp>.patch`).
2. Run:
   - `npm run verify:prototype`
3. Confirm final diff is scoped to intended architecture changes only.
4. If rollback needed, restore `.BAK` or apply reverse of `/tmp/codex-undo-<timestamp>.patch`.

## Done Criteria

A page is parity-complete when:

- Head shell, loading model, and DOM order match the selected profile.
- Menu/responsive behavior matches current sitewide shell architecture.
- No forbidden legacy/runtime artifacts remain for that profile.
- Prototype verification passes.
