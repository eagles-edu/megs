# Conversion Assistant

<style>
pre code {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

This utility sequentially forms, executes, and verifies already working scripts  within the _convert legacy gated system_ and injects target path details into prepared Codex prompts (with repo write permission). Dont develop more than a solid executive wrapper executing systematic executive control of each milestone segment, dont reinvent the wheel..

`tools/conversion-assistant.mjs`

This program performs three core coordination of functions fixed in a workflow sequence.

1. First, it **collects** user input of legacy exercise data necessary for proper conversion to a modern code base; these details fill variables throughout program.

2. Using the input data, program **prints** pasteable, ready to use, preprogrammed codex prompt text. Pauses and prints out each prompt when needed in sequence with target file path injected/populated throughout; user then pastes and presses enter to continue as it progresses.

3. Using the input data, program **formulates and executes** various dedicated scripts of the conversion system, setting appropriate cmd flags and CLI options programmatically, then executes and verifies it.

## Program Workflow Sequence

### I. Collection of Target Data

If flags are not present, pause for user to enter input; enter conversion detail variables:

   1. `<target-path>` relative path*:
   2. **Select # of answer fields (1-6) or 7 for textarea [default 1]**: 1-7:
      1. Enter 1–6 to set: `--answer-fields (default 1; options 1-6)`
      2. Enter 7 to set `--answer-ui textarea (fields remain 1)`
   3. **title/ID**: default to filename slug sans .html
   4. **p-tag answers bolded or underlined**: to set --answer-source for prompt_pull: `<undies|p|auto>` (default auto):
      1. **undies**: extract from between `<span class="undies">, <b>, or <strong>`
      2. **p**: derive from reading p-tag directions and answering questions, then extract
      3. **auto**: (default) extract from between `<span class="undies">, <b>, or <strong>` if none, derive from reading p-tag directions and answering questions, then extract
   5. **multiple provided answers**:
      1. **all** - each answer in group _required mode_ (default) or
      2. **any** - _alternative answers mode_

   6. **obfuscation mode enabled**: true (default) or false
   7. obfuscation mode:
      1. `all` p-tag contents.
      2. `highlighted` p-tag contents.

        > ```html
        >   <span class="undies">, <b>, or <strong>]
        > ```

   8. **diff preview**: true (default) or false

### II. Program Execution

Runtime rule for all prompts/commands: replace every placeholder (e.g., `<target-path>`, `<title/ID>`, `<undies/p/auto>`, answer counts, obfuscation choice) with the chosen values before printing; keep the surrounding prompt/command text unchanged.

1. **Print Prompt1**: "`<target-path>` pull answers from question p-tags,   <undies/p/auto>,  then copy the individual words to `tools/input.txt` separating each question's answer (group) or alternate answer by a new line."
   - replace  <undies/p/auto> with user input flag text
    1. **undies**: "by extracting p-tag answers from between `<span class="undies">, <b>, or <strong>` tags in the target HTML"
    2. **p**: "by reading exercise p-tag instructions, reading each question, determining each answer"
    3. **auto**: (default) derive via **undies** "by extracting p-tag answers from between `<span class="undies">, <b>, or <strong>` tags;  else, if tags aren't present, via **p** by reading exercise p-tag instructions, reading each question, determining each answer"
   - Example (user selects `p`): "`<target-path>` pull answers from question p-tags, by reading exercise p-tag instructions, reading each question, determining each answer, then copy the individual words to tools/input.txt separating each question's answer (group) or alternate answer by a new line."
   - replace `<target-path>` with the chosen path; keep prompt text unchanged.

>PAUSE, DISPLAY PROMPT, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

---

1. **Execute CMD2**: prepare & print (also writes `dev/<title>.txt` when title provided)

```bash
node tools/fnv1a64-convert.mjs --round-trip --input tools/input.txt --title <title/ID>
```

> PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

- replace `<title/ID>` with the chosen title; keep command text unchanged.

---

1. **Execute CMD3**: using earlier input from user:

- #1–#6 sets: `--answer-fields (1-6; default 1)`

```bash
node js/convert-legacy-gated.mjs <target-path> --answer-fields <# of answer fields> --diff-preview
```

or,

- #7 sets `--answer-fields 1 --answer-ui textarea`

```bash
node js/convert-legacy-gated.mjs <target-path>  --answer-fields 1 --answer-ui textarea --diff-preview
```

> PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

- replace placeholders (`<target-path>`, `<# of answer fields>`) with chosen values; keep command text unchanged.

---

1. Print Prompt4:

"inject `tools/hashes.txt` to the answer aray json in `<target-path>` following user 'required' input for answersAccepted shaping:  `<all|alts>`:

- **all**: single combo per question with all hashes required for correct (default): `"answersAccepted": [["hash1","hash2",...]]`
- **alts**: separate combos, one per hash (group), only one hash (group) combo required for correct:  `"answersAccepted": [[ "hash1"],["hash2"],...]`
"

>PAUSE, DISPLAY PROMPT, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS.

- replace `<target-path>` and `<all|alts>` with chosen values; keep prompt text unchanged.

---

5. Run `encode-p-text.mjs` answers in `<p>` tag for obfuscation per user input:
--obfuscate `<p|span|none>` - (default span):

   - p: obfuscate full `<p>` text (leave tags)
   - span: obfuscate span-only text
   - none: skip

```bash
node tools/encode-p-text.mjs --write  <target-path>
```

> replace `<target-path>` with the chosen path and apply only when obfuscation choice requires it; keep command text unchanged.

#### Apply in place

```bash
- node tools/encode-p-text.mjs --write exercise-2-verbs/211-transitive-and-intransitive-verbs.html
 **Optional quick check**: node tools/encode-p-text.mjs /tmp/sample.html | head
- **Rollback**: rm tools/encode-p-t
- node tools/encode-p-text.mjs [--write|--apply] <file...>
- **Default is dry-run to stdout**; use --write/--apply to rewrite files in place.
```

#### extra

 **prompt**: format each question's p-tag answers from between `<span class="undies">, <b>, or <strong>` or whole `<p>` tags exactly like the following, based on its existing structure:

- `<p>`2. I forgot to renew my `<b>`&#109;&#101;&#109;&#98;&#101;&#114;&#115;&#104;&#105;&#112; `</b>` in the sailing club.`</p>`  OR

- `<p>`&#109;&#101;&#109;&#98;&#101;&#114;&#115;&#104;&#105;&#112;`</p>`

---p-tag answers from between `<span class="undies">, <b>, or <strong>`
NOTES:

- never sanitize (i.e., trim, strip quotes/trailing punctuation), these are all grammar questions, so... **there are flags in conversion system to set for this already.**
- --target `<path>` (required if no prompt available)
- --answer-fields <1-6> and --answer-ui textarea (set UI to textarea; default fields=1, ui unset)
- --answer-source `<undies|p|auto>` (default auto):
  - **undies**: extract from from between `<span class="undies">, <b>, or <strong>`
  - **p**: extract bold/underlined/strong from `<p>` (or prompt to derive from directions if missing)
  - **auto**: current fallback (undies then `<strong>, <b>` list)
- --answers-mode `<all|alts>` (default all; sets answersAccepted combos)

  - all: single combo with all hashes
  - alts: separate combos, one per hash
- --obfuscate `<p|span|none>` (default span):
  - **p**: obfuscate full `<p>` text (leave tags)
  - **span**: obfuscate span-only text
  - **none**: skip
