# Legacy converter conservative workflow (js/convert-legacy-gated.mjs)

This workflow uses the Node CLI at `js/convert-legacy-gated.mjs` to transform a legacy accordion exercise into the gated template while minimizing risk. Each operation set is ordered from lowest to highest impact.

## 0) Prep and verify inputs

1. Confirm a clean working tree:

   ```bash
   git status -sb
   ```

2. Locate the legacy page you plan to convert (e.g., `exercise-1-nouns/111-common-nouns.html`).

3. Ensure the gated template exists (defaults to `exercise-1-nouns/111-common-nouns.html`).

## I) Inspect the CLI (no file I/O)

Example: show options and defaults without touching files.

```bash
node js/convert-legacy-gated.mjs --help
```

## II) Scrape and validate without writing (safe dry-run)

Use this to confirm scraping succeeds, counts match, and validation passes.

```bash
node js/convert-legacy-gated.mjs exercise-1-nouns/111-common-nouns.html --dry-run
```

### Optional diff-only preview (still no writes)

Add `--diff-preview` to inspect proposed changes while keeping the source untouched.

```bash
node js/convert-legacy-gated.mjs exercise-1-nouns/111-common-nouns.html --dry-run --diff-preview
```

## III) Override checks before applying (if needed)

If you must enforce a specific question count or answer-field count, set the overrides while still in dry-run mode first.

```bash
node js/convert-legacy-gated.mjs path/to/page.html --questions 12 --answer-fields 3 --dry-run
```

## IV) Conversion with safety nets

When dry-run output looks good, run the converter without `--dry-run` to write in place. A timestamped backup is created automatically.

```bash
node js/convert-legacy-gated.mjs path/to/page.html
```

- The original file is copied to `path/to/page.html.bak-<timestamp>` before writing.
- The updated page keeps scraped answer-field counts unless you supplied `--answer-fields`.

### Include a diff preview during the write (optional)

```bash
node js/convert-legacy-gated.mjs path/to/page.html --diff-preview
```

### Test mode for QA (accordion open + auto-fill sample answers)

```bash
node js/convert-legacy-gated.mjs path/to/page.html --test-mode --dry-run
# When ready to write with test-mode markup
node js/convert-legacy-gated.mjs path/to/page.html --test-mode
```

## V) Post-write validation

1. Re-open the converted HTML in a browser to verify the accordion gating, breadcrumb/pager links, and injected answer/config JSON.
2. Run repository linters/tests as needed (example):

   ```bash
   npm test
   ```

3. Confirm the working tree is only changed where expected:

   ```bash
   git status -sb
   git diff
   ```

## VI) Rollback

- To restore the pre-conversion file, copy the generated backup over the converted file:

  ```bash
  cp path/to/page.html.bak-<timestamp> path/to/page.html
  ```

- If already committed, revert via git:

  ```bash
  git revert <commit_sha>
  ```

## VII) Checklist for conservative runs

- [ ] Working tree clean before starting.
- [ ] `--dry-run` passes without errors.
- [ ] `--diff-preview` reviewed (optional but recommended).
- [ ] Overrides (`--questions`, `--answer-fields`) validated in dry-run before writing.
- [ ] Backup file noted after write.
- [ ] Post-write spot-check completed.
- [ ] Working tree confirmed clean after commit.
