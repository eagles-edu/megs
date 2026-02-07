# Conversion Assistant

This utility sequentially forms, executes, and verifies already working scripts within the _convert legacy gated system_ and injects target-path details into prepared Codex prompts (with repo write permission). Don't build more than a thin executive wrapper that coordinates each milestone segment; don't reinvent the wheel.

`tools/conversion-assistant.mjs`

This program coordinates three core functions in a fixed workflow sequence.

1. First, it **collects** user input of legacy exercise data necessary for proper conversion to a modern code base; these details fill variables throughout the program.

2. Using the input data, the program **prints** pasteable, ready-to-use, preprogrammed Codex prompt text. It pauses and prints out each prompt when needed in sequence with the target file path injected throughout; the user then pastes and presses enter to continue as it progresses.

3. Using the input data, the program **formulates and executes** various dedicated scripts of the conversion system, setting appropriate cmd flags and CLI options programmatically, then executes and verifies them.

## Program Workflow Sequence

### I. Collection of Target Data

If flags are not present, pause for user to enter input; enter conversion detail variables:

   1. `<target-path>` relative path*:
   2. **title/ID**: default to filename slug sans .html
   3. **p-tag answers bolded or underlined**: to set `--answer-source` for the extraction prompt: `<undies|p|auto|sentence>` (default undies):
      1. **undies**: (default) extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks
      2. **p**: derive from AI reading p-tag directions, answering each question (per p-tag directions), and writing these to file
      3. **auto**: extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks; if none, derive from AI reading p-tag directions, answering each question (per p-tag directions), and writing these to file
      4. **sentence**: extract the full sentence text verbatim from each form-based question block (p-tag), sans HTML (include all non-blank words, not just the underlined answers), and copy to file; warn that linting/IDE wrapping and source text can introduce spacing/punctuation artifacts, and offer optional USA spelling/grammar/vernacular/usage-only normalization (including fixing \", -> ,\") with explicit approval
   4. **multiple provided answers**: to set `--answers-mode`:
      1. **all** - one combo per QB (question block); if a QB contains ALT blocks, keep one combo per ALT block; all hashes required per combo (default)
      2. **alts** - one combo per ALT block (blank-line separated); only one combo required
   5. **Example handling**: to set `--ignore-example [mode]`:
      1. **auto** scan for `Example.`-prefixed questions, report findings, pause for a choice, and default to **none** if no Example blocks are found; if no TTY and examples are found, default to **prefix**
      2. **prefix** (default when `--ignore-example` is provided with no value): skip questions that start with `Example.`
      3. **first**: skip the first question block
      4. **none**: (default when flag is unset): skip nothing (convert all questions)
   6. **obfuscation scope** (default `form-highlighted`):
      1. `form` p-tag contents inside `form.exercise-form`
      2. `form-highlighted` highlighted p-tag contents inside `form.exercise-form`
      3. `highlighted` p-tag contents (global)
      4. `all` p-tag contents (global)
      5. `none` (skip obfuscation)

        > ```html
        >   <span class="undies">...</span>, <b>...</b>, and <strong>...</strong>
        > ```

   7. **diff preview**: true (default) or false

### II. Program Execution

Runtime rules for all prompts/commands: replace every placeholder (e.g., `<target-path>`, `<title/ID>`, `<undies/p/auto/sentence>`, answer counts, obfuscation choice, etcetera.) using the user input values before prompt printing or command execution; keep the surrounding prompt/command text unchanged.

---

1. **Print Prompt1**: "`<target-path>` pull answers from question p-tags, `<undies/p/auto/sentence>`, then copying those words / phrases / sentences (sentence mode: full sentences, not just the blanked answers) to`tools/input.txt`. Format tools/input.txt using Answer Line (AL) / ALTernate answers (ALT) / Question Block (QB): AL separated by \n, ALT separated by \n\n, QB separated by \n\n\n. Include all ALT combos when multiple answers are possible."

Prompts append the `Save my Tokens! [agents.md temp override]` line at the end; keep it intact in Prompt1 and Prompt4.

- replace `<target-path>`, `<undies/p/auto/sentence>` with user input flag text:

    1. **undies**: (default) extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks
    2. **p**: derive from AI reading p-tag directions, answering  each question (per p-tag directions), and writing these to file
    3. **auto**: extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks; if none, derive from AI reading p-tag directions, answering each question (per p-tag directions), and writing these to file
    4. **sentence**: extract the full sentence text verbatim from each form-based question block (p-tag), sans HTML (include all non-blank words, not just the underlined answers), and copy to file; warn if linting/IDE wrapping or source text has introduced spacing/punctuation artifacts in this plain-text copy, and offer optional USA spelling/grammar/vernacular/usage-only normalization (including fixing \", -> ,\") with explicit approval

#### For example

_User input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html
- `<undies/p/auto/sentence>`: undies

_CMD produced_:

"`exercise-4-adverbs/411-using-adverbs-part-1.html` pull answers from question p-tags, by extracting p-tag answers from between `<span class="undies">`, `<b>`, and `<strong>` tags in the target HTML, then copying those words / phrases / sentences to `tools/input.txt`. Format tools/input.txt using Answer Line (AL) / ALTernate answers (ALT) / Question Block (QB): AL separated by \\n, ALT separated by \\n\\n, QB separated by \\n\\n\\n. Include all ALT combos when multiple answers are possible."

>PAUSE, DISPLAY PROMPT, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

**After Prompt1** (sentence only): scan `tools/input.txt` for linting/IDE spacing artifacts, quote punctuation order, and visible punctuation irregularities; warn if many lines are 1-2 words (possible incomplete sentence extraction), and ask whether to normalize to USA spelling/grammar/vernacular/usage (includes spacing/punctuation fixes and \", -> ,\"; no rewording beyond that). If yes, apply only the approved normalization; otherwise keep verbatim.

**After Prompt1** (all modes): validate `tools/input.txt` so each ALT block in a QB has the same number of lines (one per blank). If mismatched, expand per-blank alternatives into full ALT combos (cartesian product) and rewrite `tools/input.txt`; stop if mismatches remain.

**After Prompt1** (before CMD2), if `--answer-fields` / `--answer-ui` are not set, prompt:

- **Select # of answer fields (1-6) or 7 for textarea [default 1]**: 1-7:
      1. Enter 1–6 to set: `--answer-fields` (default 1; options 1-6)
      2. Enter 7 to set `--answer-ui textarea` (fields remain 1)

2. **Execute CMD2**: prepare & print (also writes `dev/<title>.txt` when title provided):

```bash
node tools/fnv1a64-convert.mjs --round-trip --input tools/input.txt --title <title/ID>
```

- replace `<title/ID>` with the user input title; keep command text unchanged.

**For example**:

_User input_:

- `<title/ID>`: 411-using-adverbs-part-1

_CMD produced_:

`node tools/fnv1a64-convert.mjs --round-trip --input tools/input.txt --title 411-using-adverbs-part-1`

> PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

3. **Execute CMD3**: using earlier input from user (include `--ignore-example` if selected):

- #1–#6 sets: `--answer-fields` (1-6; default 1)

```bash
node js/convert-legacy-gated.mjs <target-path> --answer-fields <# of answer fields> --diff-preview
```

or,

- #7 sets `--answer-fields 1 --answer-ui textarea`

```bash
node js/convert-legacy-gated.mjs <target-path> --answer-fields 1 --answer-ui textarea --diff-preview
```

- replace placeholders (`<target-path>`, `<# of answer fields>`) with user input values; keep command text unchanged.
- if diff preview is false, omit `--diff-preview`.
- if Example handling is selected, append `--ignore-example` (standalone = prefix) or `--ignore-example <auto|prefix|first|none>`.

**For example**:

_User input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html
- `<# of answer fields>`: 2

_CMD produced_:

`node js/convert-legacy-gated.mjs exercise-4-adverbs/411-using-adverbs-part-1.html --answer-fields 2 --diff-preview`

> PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

4. **Print Prompt4** (then auto-inject hashes into the answer key JSON):

"inject `tools/hashes.txt` into the answer array JSON in `<target-path>` following user input for answersAccepted shaping: `<all|alts>`"

- replace `<target-path>` and `<all|alts>` with user input values; **keep prompt text unchanged**.

  - **all**: "ALL: one combo per QB (question block); if a QB contains ALT blocks, keep one combo per ALT block; all hashes in each combo required: `"answersAccepted": [["hash1","hash2",...]]`"

  - **alts**: "ALTS: one combo per ALT block (blank-line separated inside a QB); each combo may contain multiple hashes; only one combo required: `"answersAccepted": [["hash1","hash2"],["hash1","hash3"],...]`"

**For example**:

_user input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html
- `<all|alts>`: alts

**Prompt produced**:

"inject `tools/hashes.txt` into the answer array JSON in exercise-4-adverbs/411-using-adverbs-part-1.html following user input for answersAccepted shaping: ALTS: one combo per ALT block (blank-line separated inside a QB); each combo may contain multiple hashes; only one combo required: `"answersAccepted": [["hash1","hash2"],["hash1","hash3"],...]`"

>PAUSE, DISPLAY PROMPT, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

After Prompt4, the conversion assistant injects `tools/hashes.txt` into the target file's
`answersAccepted` arrays using the chosen answers-mode (all/alts), then proceeds to the
sync-lengths step.

---

5. **Execute CMD4**: sync `lengths`, `minLength`, `maxLength` to match `answersAccepted` combos:

```bash
node tools/sync-answer-lengths.mjs <target-path>
```

- replace `<target-path>` with the user input target path; keep command text unchanged.
- run after Prompt4 injection so combos are final.

**For example**:

_user input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html

**CMD produced**:

`node tools/sync-answer-lengths.mjs exercise-4-adverbs/411-using-adverbs-part-1.html`

> PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

6. Run `normalize-exinstruct.mjs` unless normalize-exinstruct=skip:

```bash
node tools/normalize-exinstruct.mjs --target <target-path> --write
```

- replace `<target-path>` with the user input target path; keep command text unchanged.
- if normalize-exinstruct mode is `dry-run`, use `--dry-run` instead of `--write`.
- if normalize-exinstruct mode is `skip`, do not run this step.

---

7. Run `encode-p-text.mjs` for obfuscation per user input (skip if scope is `none`):
--scope `<form|form-highlighted|highlighted|all>` (default form-highlighted):

   - **form-highlighted**: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` within `form.exercise-form`
   - **form**: obfuscate all `<p>` text nodes within `form.exercise-form` (omit HTML tags from encoding; leave tags intact)
   - **highlighted**: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` (global)
   - **all**: obfuscate all `<p>` text nodes (omit HTML tags from encoding; leave tags intact, global)

```bash
node tools/encode-p-text.mjs --write --scope <form|form-highlighted|highlighted|all> <target-path>
```

> replace `<target-path>`, `<form|form-highlighted|highlighted|all>` with the user input target path and apply only when obfuscation choice requires it; keep command text unchanged.

**For example**:

_user input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html
- `<form|form-highlighted|highlighted|all>`: form-highlighted

**Prompt produced**:

`node tools/encode-p-text.mjs --write --scope form-highlighted exercise-4-adverbs/411-using-adverbs-part-1.html`

#### extras

- **Optional quick check**: node tools/encode-p-text.mjs /tmp/sample.html | head
- **Rollback**: git restore `<target-path>`
- node tools/encode-p-text.mjs [--write|--apply] [--scope <all|highlighted|form|form-highlighted>] <file...>
- **Default is dry-run to stdout**; use --write/--apply to rewrite files in place.
- **Prompt**: encode each question's p-tag answers from between `<span class="undies">`, `<b>`, and `<strong>` or whole `<p>` tags exactly like the following, based on its existing structure:

- `<p>2. I forgot to renew my <b>&#109;&#101;&#109;&#98;&#101;&#114;&#115;&#104;&#105;&#112;</b> at the sailing club.</p>`

  OR

- `<p>&#109;&#101;&#109;&#98;&#101;&#114;&#115;&#104;&#105;&#112;</p>`

### NOTES

- **Priority rule**: Obfuscation SOP applies only when it does not conflict with the requirement that no human-readable answers remain visible/un-obfuscated after conversion. If there is a conflict, enforce "no readable answers after conversion."
- **Execution**: the full conversion workflow must run end-to-end without interruption; do not pause between steps unless the user explicitly requests a stop.
- **Session continuity**: treat the latest user-corrected state in this chat (e.g., `tools/input.txt` and visible GUI text) as canonical; do not reintroduce removed variants or undo approved changes unless explicitly requested.
- never sanitize (i.e., trim, strip quotes/trailing punctuation); only allow sentence-mode normalization with explicit user approval: fix lint/IDE spacing artifacts, quote punctuation order, and optional USA spelling/grammar/vernacular/usage normalization (no rewording beyond that).
- --target `<target-path>` (required as --flag or user input)
- --answer-fields <1-6> or <7> --answer-ui textarea (set UI to textarea; default is fields=1, ui unset)
- --answer-source `<undies|p|auto|sentence>` (default undies):
  - **undies**: default; extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks
  - **p**: extract bold/underlined/strong from `<p>` (or prompt to derive from directions if missing)
  - **auto**: use **undies** if present, otherwise derive by **p** answer-source reading p-tag directions and answering questions
  - **sentence**: extract the full sentence text verbatim from each form-based question block (p-tag), sans HTML (include all non-blank words, not just the underlined answers), and copy to file; warn that linting/IDE wrapping and source text can introduce spacing/punctuation artifacts, and offer optional USA spelling/grammar/vernacular/usage-only normalization (including fixing \", -> ,\") with explicit approval
- --answers-mode `<all|alts>` (default all; sets answersAccepted combos)
  - all: one combo per QB (question block); if ALT blocks exist, keep one combo per ALT block; all hashes required per combo
  - alts: one combo per ALT block (blank-line separated); combos may include multiple hashes
- --ignore-example `[auto|prefix|first|none]` (default none when flag is unset)
  - auto: scan for Example.* and prompt; defaults to none if no Example blocks are found; if examples are found without a TTY, default to prefix
  - prefix: skip questions that start with `Example.`
  - first: skip the first question block
  - none: skip nothing (convert all questions)
- --scope `<form|form-highlighted|highlighted|all>` (default form-highlighted):
  - **form-highlighted**: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` within `form.exercise-form`
  - **form**: obfuscate all `<p>` text nodes within `form.exercise-form` (leave tags)
  - **highlighted**: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` (global)
  - **all**: obfuscate all `<p>` text nodes (omit HTML tags from encoding; leave tags intact, global)
- obfuscation scope `none`: skip (do not run encode-p-text)
- Alternates in answers: keep a single `<p>` per question block and separate multiple acceptable sentences with `<br>` tags; do not split a question’s answers across multiple `<p>` tags.

## Daily Updates

- 2026-02-06: Recorded system-doc maintenance requirement and scope exemption alignment with AGENTS.md.
- 2026-02-07: Documented lean prototype head-shell baseline (critical-inline only, early mobile-nav bootstrap, and externalized layout/menu rules).
- 2026-02-07: Rolled the prototype head-shell baseline to `lesson-6-prepositions/1-4` to remove speculation-driven 404 noise and reduce CLS drift.
