# Exercise System and Conversion Guide

## Exercise Runtime (Gate) Behavior

- **Hashing**: Accepts answers via hashes; default algorithm is `fnv1a-64`. Exact match only (case and punctuation preserved). No normalization unless you explicitly encode with `--normalize`.
- **Answer key JSON**: Each entry under `answerArrays.answerArray` uses:

  - `id`: question slug (e.g., `q1-my-uncle-visits-his-nephew-every-weekend`).

  - `answersAccepted`: array of combos (array of hash arrays), e.g., `[["fnv1a-64:abc123..."]]`. Multiple alternatives = multiple combos.

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
- Populate `answersAccepted` with quoted hashes inside combos (e.g., `[["fnv1a-64:..."]]`).

#### Defaults/Requirements

- Exact-match hashing enforced (no normalization).
- Panels remain closed until correct (`requireCorrectBeforeReveal=true`).
- `manualCheckOk` is `false` unless a question truly needs manual review.
- Ensure answer key JSON stays valid (quoted hash strings) so the gate can parse it.

### Obfuscating GUI Answer Text

- **Why**: Keep visible answers hidden from learners while preserving formatting inside `<p>` blocks (bold, `<br>`, etc.). Only encode text nodes; HTML tags must remain intact.

- **Tool**: `tools/encode-p-text.mjs` (Node 20, cheerio + dom-serializer). It converts raw text in `<p>` tags to decimal HTML entities and skips already-encoded runs and whitespace-only nodes.

- **Dry-run preview**:

  ```bash
  node tools/encode-p-text.mjs exercise-1-nouns/151-gender.html
  ```

  Streams the transformed HTML to stdout so you can diff without touching files.

- **Apply in place**:

  ```bash
  node tools/encode-p-text.mjs --write exercise-1-nouns/151-gender.html
  ```

  Use `--apply` as an alias. The script reports how many `<p>` elements were encoded.

- **Safety checks**:
  - Run on pages where answers must be obscured; do not run on non-answer content.
  - Use `--scope form` (or `--scope form-highlighted`) to avoid encoding instructions outside `form.exercise-form`.
  - The encoder skips runs that look already encoded (`&#…;`) to avoid double-encoding.
  - Verify output keeps tags and `<br>` line breaks unchanged; confirm decoded text still matches the intended answer strings.
  - After applying, re-open the page locally and confirm rendered text remains readable and hashes still match expected answers.
- **Validation**: After obfuscation, run `npm run verify:prototype` (or the relevant smoke/lint target) to ensure gating and markup still pass checks.

### Operational Tips

- Keep `answersAccepted` as a list of hash arrays; hashes are quoted strings; avoid bare tokens.
- For textarea/full-width responses, set `data-answer-ui="textarea"` in legacy or run with `--answer-ui textarea`.
- When adding alternatives, place all variants for a question in `tools/input.txt` separated by blank lines before re-hashing.
- If panels open without correct answers, verify `requireCorrectBeforeReveal` is `true` and hashes match exactly.**

### New _autofill_ system

#### *_Supersedes all other References_

In the answer key,

`answersAccepted`

is an array of **“combos**.” Each combo is itself an array of tokens that must all be matched to satisfy that combo.

**Single-field with alternates**: one combo per alternate, each with one hash.

Example:

`[["fnv1a-64:a..."], ["fnv1a-64:b..."]]`

means _either hash is acceptable_; _only one is required_ because there’s one field and each **combo length is 1**.

**Multi-field/all-required**: a single combo containing multiple hashes. Example:

`[["fnv1a-64:080f6…", "fnv1a-64:30bb…", "fnv1a-64:b561…", "fnv1a-64:f263…"]]`

means all four must match, in any order, across four fields (or one field if that combo is expected to be multiple tokens concatenated, depending on UI).

The gate checks each token in the combo; all must succeed for that combo to pass.

#### So brackets

- **Outer** [ ]: list of combos (**alternatives**).
- **Inner** [ ]: the tokens **required together** for that combo.
