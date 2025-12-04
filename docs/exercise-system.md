# Exercise System and Conversion Guide

## Exercise Runtime (Gate) Behavior

- **Hashing**: Accepts answers via hashes; default algorithm is `fnv1a-64`. Exact match only (case and punctuation preserved). No normalization unless you explicitly encode with `--normalize`.
- **Answer key JSON**: Each entry under `answerArrays.answerArray` uses:

  - `id`: question slug (e.g., `q1-my-uncle-visits-his-nephew-every-weekend`).

  - `answersAccepted`: array of hash strings, e.g., `"fnv1a-64:abc123..."`. Multiple alternatives = multiple strings.

  - `lengths`, `minLength`, `maxLength`: number of required fields; default `1` (single input).

  - `manualCheckOk`: when `true`, gate can allow manual review; default `false`.

  - `requireCorrectBeforeReveal`: set globally in `options`; defaults to `true` to keep panels closed until correct.

- **UI/Gating flow**:
  1. User enters answers.
  2. Gate hashes inputs and compares to `answersAccepted`.
  3. If all required fields match, panel opens and question locks as correct.
  4. If incorrect, panel stays closed and status shows a warning; for manual-review items, panels stay closed and answers are included in the submission email for teacher grading.
  5. Textareas auto-size; text inputs stay single-line, while the textarea variant expands as the text wraps.
- **Forms**: `data-storage-key` persists attempts locally; submission posts JSON payload with answers, email, and studentId when enabled.

## Conversion Pipeline (`js/convert-legacy-gated.mjs`)

- **Purpose**: Convert legacy accordion pages into gated exercises with structured answer keys and consistent markup.

### Key options (CLI)

#### CMD line flags

- `--answer-fields <n>`: override number of input fields per question (1–6). **Default**: scraped count or 1.
- `--answer-ui <kind>`: force UI for all questions (use `textarea` for full-width, responsive, vertically expanding single-answer fields). **Default**: scraped `data-answer-ui` or compact inputs.
- `--template <path>`: source gated template; default `exercise-1-nouns/111-common-nouns.html`.
- `--diff-preview`: show git-style diff instead of writing output.
- `--dry-run`: skip writing output.
- `--test-mode`: auto-fill answers and keep accordions open (dev only; disables gating).
- `--questions <n>`: optional question-count validation override.
- **Sequence**: see Behavioral Overview below.

#### Behavioral Overview

1. Scrape legacy HTML (questions, IDs, instructions, breadcrumbs, pager).
2. Build answer key stub (hashes injected later) with `requireCorrectBeforeReveal=true` by default.
3. Inject scraped content into template; rebuild `.quest-bg` blocks with chosen UI (`--answer-ui`).
4. Validate answer-field counts vs overrides.
5. Write back to the target file (with backup) unless `--dry-run` or `--diff-preview`.

#### Hash generation

- Use `tools/fnv1a64-convert.mjs --encode --input tools/input.txt > tools/hashes.txt` (exact match).
- Populate `answersAccepted` with quoted hashes (e.g., `"fnv1a-64:...`").

#### Defaults/Requirements

- Exact-match hashing enforced (no normalization).
- Panels remain closed until correct (`requireCorrectBeforeReveal=true`).
- `manualCheckOk` is `false` unless a question truly needs manual review.
- Ensure answer key JSON stays valid (quoted hash strings) so the gate can parse it.

### Operational Tips

- Keep `answersAccepted` hashes quoted strings; avoid bare tokens.
- For textarea/full-width responses, set `data-answer-ui="textarea"` in legacy or run with `--answer-ui textarea`.
- When adding alternatives, place all variants for a question in `tools/input.txt` separated by blank lines before re-hashing.
- If panels open without correct answers, verify `requireCorrectBeforeReveal` is `true` and hashes match exactly.**
