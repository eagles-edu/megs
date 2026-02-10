# Lesson Conversion Assistant

`tools/lesson-conversion-assistant.mjs` is a wrapper around `js/convert-legacy-lesson.mjs`.

## Direct Answers First

1. Can you run with no flags and let prompts collect values? `YES`, if running in an interactive TTY terminal.
2. Can you run with no flags in non-TTY mode (CI, piped stdin)? `NO` for single-file mode, because no prompt can collect `target`; `YES` only if `--bulk` is provided.
3. Does `--include-copy` control backup creation? `NO`. It only controls whether `*.copy.html` and `*-copy.html` lesson pages are included in bulk scan scope.

## Backup Behavior (Write vs Dry)

- Write mode (`--no-diff-preview`): converter writes files and creates timestamped `.BAK-...` backup files.
- Dry mode (`--diff-preview`): converter prints preview output and does not write or create backups.
- This backup behavior is independent of `--include-copy`.

## Defaults (Current Implementation)

- `prototype`: `lesson-6-prepositions/1-prepositions-of-time.html`
- `diffPreview`: `false` (write mode by default)
- `ukToUs`: `true`
- `verifyShell`: `true`
- `bulk`: `false`
- `root`: `.`
- `includeCopy`: `false`
- `pausePerDirectory`: `true`

## End-to-End Flow (Sequence)

1. Parse CLI flags.
2. If a setting is missing and stdin is TTY, prompt for it.
3. Resolve paths and print final settings.
4. Print final command and ask for `Enter` to execute (`Q` quits).
5. Run `js/convert-legacy-lesson.mjs` with assembled flags.
6. Post-run checks:
   - single-file mode: run `verifyLessonShell` only when `verifyShell=true` and `diffPreview=false`
   - bulk mode: skip `verifyLessonShell` and print that it was skipped when `verifyShell=true`

## Prompt Order (When TTY and Value Not Already Set via CLI)

1. Bulk mode? (`Run bulk conversion scan?`)
2. Root path (`Lesson root directory`)
3. Include copy lessons in bulk scan (`Include copy.html files when scanning?`)
4. Pause after each bulk directory summary (`Pause after each directory summary?`)
5. Target path (`Enter legacy lesson <target-path>`) only when not bulk
6. Prototype path
7. Write or dry
8. UK->US normalization
9. Verify shell after write

## Flags

- `--target, -f <path>`: target lesson file in single-file mode.
- `--prototype, -p <path>`: prototype lesson template file.
- `--uk-to-us`: enable UK->US normalization.
- `--verify-shell`: enable post-write shell verification.
- `--no-verify-shell`: disable post-write shell verification.
- `--diff-preview`: dry mode.
- `--no-diff-preview`: write mode.
- `--bulk`: bulk conversion mode.
- `--root <path>`: bulk scan root directory.
- `--include-copy`: include `*.copy.html` and `*-copy.html` in bulk scan scope.
- `--no-pause`: disable per-directory pause in bulk mode.
- `--help, -h`: print usage.

## Real-World Full Commands

Single-file write with explicit options:

```bash
node tools/lesson-conversion-assistant.mjs \
  --target lesson-6-prepositions/6-same-word-used-as-preposition-and-adverb.html \
  --prototype lesson-6-prepositions/1-prepositions-of-time.html \
  --no-diff-preview \
  --uk-to-us \
  --verify-shell
```

Single-file dry run, no shell verification:

```bash
node tools/lesson-conversion-assistant.mjs \
  --target lesson-6-prepositions/6-same-word-used-as-preposition-and-adverb.html \
  --prototype lesson-6-prepositions/1-prepositions-of-time.html \
  --diff-preview \
  --no-verify-shell
```

Bulk write (skip pauses), excluding copy lessons:

```bash
node tools/lesson-conversion-assistant.mjs \
  --bulk \
  --root . \
  --prototype lesson-6-prepositions/1-prepositions-of-time.html \
  --no-diff-preview \
  --uk-to-us \
  --no-pause
```

Bulk dry run including copy lessons:

```bash
node tools/lesson-conversion-assistant.mjs \
  --bulk \
  --root . \
  --prototype lesson-6-prepositions/1-prepositions-of-time.html \
  --diff-preview \
  --include-copy \
  --no-pause
```

## Minimal Invocation Rules

- Interactive shell:
  - `node tools/lesson-conversion-assistant.mjs` works; prompts collect missing values.
- Non-interactive shell:
  - single-file requires `--target` (or positional target)
  - bulk requires `--bulk`
  - all unspecified options use defaults

## Daily Updates

- 2026-02-10: Reorganized documentation into a strict sequence, added explicit yes/no behavior, corrected `includeCopy` default to `false`, and clarified that backups are controlled by write/dry mode, not `--include-copy`.
