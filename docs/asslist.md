# List Conversion Assistant

`tools/list-conversion-assistant.mjs` is a wrapper around `js/convert-legacy-list.mjs`.

## Direct Answers First

1. Can you run with no flags and let prompts collect values? `YES`, in an interactive TTY.
2. Can you run with no flags in non-TTY mode? `NO` for single-file mode because no prompt can collect `target`; `YES` only if `--bulk` is provided.
3. Are flags optional? `YES` in TTY (prompts fill missing values), `NO` in non-TTY when required values are missing.
4. Is `PASS` the same as shell-verified? `NO`. Conversion `PASS/FAIL` and shell verification are reported separately.
5. Does `--include-copy` control backups? `NO`. It only controls scan scope for `*.copy.html` and `*-copy.html`.

## Defaults (Current Implementation)

- `prototype`: `list-3-collective-nouns/collective-nouns-things.html`
- `diffPreview`: `false` (write mode default)
- `ukToUs`: `true`
- `verifyShell`: `true`
- `bulk`: `false`
- `root`: `.`
- `includeCopy`: `false`
- `pausePerDirectory`: `true`

## Flow (Sequence)

1. Parse CLI flags.
2. Prompt for any missing values (TTY only).
3. Print resolved settings.
4. Print final command and wait for Enter (`Q` quits).
5. Execute converter.
6. Converter behavior:
   - bulk scan starts at the first unconverted 2nd-level list file it finds
   - per-directory summary prints touched files with `PASS/FAIL` plus standalone `verify=PASS|FAIL|SKIP`
   - per-directory pause occurs unless `--no-pause`

## Write vs Dry

- `--no-diff-preview` (write): writes files and creates timestamped `.BAK-...` backup files.
- `--diff-preview` (dry): prints diff preview only; no writes, no backups.
- shell verification is skipped in dry mode and reported as `verify=SKIP`.

## Flags

- `--target, -f <path>`: single-file target.
- `--prototype, -p <path>`: prototype template.
- `--uk-to-us`: enable UK->US normalization.
- `--verify-shell` / `--no-verify-shell`: enable/disable standalone shell verification.
- `--diff-preview` / `--no-diff-preview`: dry/write mode.
- `--bulk`: bulk mode for 2nd-level `list-*` files.
- `--root <path>`: root scanned for `list-*` directories.
- `--include-copy`: include `*.copy.html` and `*-copy.html`.
- `--no-pause`: disable per-directory bulk pause.

## Real-World Commands

Single-file dry run:

```bash
node tools/list-conversion-assistant.mjs \
  --target list-3-collective-nouns/650-collective-nouns-people.html \
  --prototype list-3-collective-nouns/collective-nouns-things.html \
  --diff-preview
```

Single-file write:

```bash
node tools/list-conversion-assistant.mjs \
  --target list-3-collective-nouns/650-collective-nouns-people.html \
  --prototype list-3-collective-nouns/collective-nouns-things.html \
  --no-diff-preview \
  --verify-shell
```

Bulk dry run from first unconverted 2nd-level list file:

```bash
node tools/list-conversion-assistant.mjs \
  --bulk \
  --root . \
  --prototype list-3-collective-nouns/collective-nouns-things.html \
  --diff-preview \
  --no-pause
```

Bulk write with verification and copy files included:

```bash
node tools/list-conversion-assistant.mjs \
  --bulk \
  --root . \
  --prototype list-3-collective-nouns/collective-nouns-things.html \
  --no-diff-preview \
  --verify-shell \
  --include-copy \
  --no-pause
```

## Delegation from Master Assistant

You can launch list flow from `tools/conversion-assistant.mjs`:

```bash
node tools/conversion-assistant.mjs --list --target list-3-collective-nouns/650-collective-nouns-people.html --diff-preview
```
