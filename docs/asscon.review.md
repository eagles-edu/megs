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
   2. **Select # of answer fields (1-6) or 7 for textarea [default 1]**: 1-7:
      1. Enter 1–6 to set: `--answer-fields` (default 1; options 1-6)
      2. Enter 7 to set `--answer-ui textarea` (fields remain 1)
   3. **title/ID**: default to filename slug sans .html
   4. **p-tag answers bolded or underlined**: to set `--answer-source` for the extraction prompt: `<undies|p|auto|sentence>` (default auto):
      1. **undies**: extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks
      2. **p**: derive from reading p-tag directions and answering questions, then extract
      3. **auto**: (default) extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks; if none, derive from reading p-tag directions and answering questions, then extract
      4. **sentence**: extract everything verbatim between form-based question block (p-tag) answers, sans HTML, and copy to file; warn about spacing/grammar/usage/punctuation artifacts and offer optional normalization to USA spelling/grammar/vernacular/usage only (including punctuation fixes) with explicit approval
   5. **multiple provided answers**: to set `--answers-mode`:
      1. **all** - each answer in group _required mode_ (default)
      2. **alts** - _alternative answers mode_
   6. **obfuscation scope** (default `form`):
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

Runtime rules for all prompts/commands: replace every placeholder (e.g., `<target-path>`, `<title/ID>`, `<undies/p/auto/sentence>`, answer counts, obfuscation choice) with the user input values before printing; keep the surrounding prompt/command text unchanged.

1. **Print Prompt1**: "`<target-path>` pull answers from question p-tags, `<undies/p/auto/sentence>`, then copy the individual words to `tools/input.txt` separating each question's answer group or alternate answer group by a blank line."

   - replace `<target-path>`, `<undies/p/auto/sentence>` with user input flag text:

    1. **undies**: "by extracting p-tag answers from between `<span class="undies">`, `<b>`, and `<strong>` tags in the target HTML"
    2. **p**: "by reading exercise p-tag instructions, reading each question, determining each correct answer"
    3. **auto**: (default) "by extracting p-tag answers from between `<span class="undies">`, `<b>`, and `<strong>` tags in the target HTML question blocks; else, if tags aren't present, via **p** by reading exercise p-tag instructions, reading each question, determining each correct answer"
    4. **sentence**: "by extracting everything verbatim between form-based question block (p-tag) answers, sans HTML"; warn about spacing/grammar/usage/punctuation artifacts and offer optional normalization to USA spelling/grammar/vernacular/usage only (including punctuation fixes) with explicit approval

#### For example

_User input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html
- `<undies/p/auto/sentence>`: undies

_CMD produced_:

"`exercise-4-adverbs/411-using-adverbs-part-1.html` pull answers from question p-tags, by extracting p-tag answers from between `<span class="undies">`, `<b>`, and `<strong>` tags in the target HTML, then copying the individual words/phrases to tools/input.txt and separating each question's answer group or alternate answer groups by a blank line."

>PAUSE, DISPLAY PROMPT, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

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

3. **Execute CMD3**: using earlier input from user:

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

**For example**:

_User input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html
- `<# of answer fields>`: 2

_CMD produced_:

`node js/convert-legacy-gated.mjs exercise-4-adverbs/411-using-adverbs-part-1.html --answer-fields 2 --diff-preview`

> PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

4. **Print Prompt4**:

"inject `tools/hashes.txt` into the answer array JSON in `<target-path>` following user input for answersAccepted shaping: `<all|alts>`"

- replace `<target-path>` and `<all|alts>` with user input values; **keep prompt text unchanged**.

  - **all**: "ALL: single combo per question with all hashes required for correct (default): `"answersAccepted": [["hash1","hash2",...]]`"

  - **alts**: "ALTS: separate combos, one per hash (group), only one hash (group) combo required for correct: `"answersAccepted": [["hash1"],["hash2"],...]`"

**For example**:

_user input_:

- `<target-path>`: exercise-4-adverbs/411-using-adverbs-part-1.html
- `<all|alts>`: alts

**Prompt produced**:

"inject `tools/hashes.txt` into the answer array JSON in exercise-4-adverbs/411-using-adverbs-part-1.html following user input for answersAccepted shaping: ALTS: separate combos, one per hash (group), only one hash (group) combo required for correct: `"answersAccepted": [["hash1"],["hash2"],...]`"

>PAUSE, DISPLAY PROMPT, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

5. Run `normalize-exinstruct.mjs` unless normalize-exinstruct=skip:

```bash
node tools/normalize-exinstruct.mjs --target <target-path> --write
```

- replace `<target-path>` with the user input target path; keep command text unchanged.
- if normalize-exinstruct mode is `dry-run`, use `--dry-run` instead of `--write`.
- if normalize-exinstruct mode is `skip`, do not run this step.

---

6. Run `encode-p-text.mjs` for obfuscation per user input (skip if scope is `none`):
--scope `<form|form-highlighted|highlighted|all>` (default form):

   - form-highlighted: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` within `form.exercise-form`
   - form: obfuscate all `<p>` text nodes within `form.exercise-form` (leave tags)
   - highlighted: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` (global)
   - all: obfuscate all `<p>` text nodes (leave tags, global)

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

- never sanitize (i.e., trim, strip quotes/trailing punctuation); only allow sentence-mode normalization with explicit user approval (USA spelling/grammar/vernacular/usage only + punctuation fixes). These are all grammar questions, so **there are flags in the conversion system to set for this already.**
- --target `<target-path>` (required as --flag or user input)
- --answer-fields <1-6> or <7> --answer-ui textarea (set UI to textarea; default is fields=1, ui unset)
- --answer-source `<undies|p|auto|sentence>` (default auto):
  - **undies**: extract from between `<span class="undies">`, `<b>`, and `<strong>` tags in question blocks
  - **p**: extract bold/underlined/strong from `<p>` (or prompt to derive from directions if missing)
  - **auto**: default; use **undies** if present, otherwise derive from reading p-tag directions and answering questions
  - **sentence**: extract everything verbatim between form-based question block (p-tag) answers, sans HTML, and copy to file; warn about spacing/grammar/usage/punctuation artifacts and offer optional normalization to USA spelling/grammar/vernacular/usage only (including punctuation fixes) with explicit approval
- --answers-mode `<all|alts>` (default all; sets answersAccepted combos)
  - all: single combo with all hashes
  - alts: separate combos, one per hash
- --scope `<form|form-highlighted|highlighted|all>` (default form):
  - **form-highlighted**: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` within `form.exercise-form`
  - **form**: obfuscate all `<p>` text nodes within `form.exercise-form` (leave tags)
  - **highlighted**: obfuscate only `<span>`, `<b>`, `<strong>` text inside `<p>` (global)
  - **all**: obfuscate all `<p>` text nodes (leave tags, global)
- obfuscation scope `none`: skip (do not run encode-p-text)
