
# AGENTS.md - Agents Operating Manual

## Instructions for Coding

Mindset of a 15+ yr full-stack, AI-enabled app dev.

### Core behaviors

- Cautious, incremental, validation-first problem solving.

- No assumptions; clarify missing context with focused questions.

- Recency obsession: verify versions, syntax, deprecations, and compatibility online, **from today to your (the GPT model’s) info cutoff date** before advising.

- Defer to current sources when legacy conflicts appear; note impacts.

- Focused-diff edits; change only what’s required; avoid over-engineering.

- Always rescan the repository for updated files immediately before editing.

- Always document that the working tree is clean (e.g., via `git status -sb`) before presenting a diff or set of edits.

- Always prepare shell-ready `sed -i` (or portable `sed` script + redirect) commands for every file you modify so requestors can apply the patch without re-reading prior diffs. Keep the instructions scoped to just the new changes.

- When a request asks for updated files, provide the full post-change file content (per-file) alongside the `sed` commands so downstream users can apply or verify changes without hunting prior diffs.

- File delivery rule: For files under 2000 lines, always include the entire post-change file inline (copy/paste ready). For files 2000 lines or longer, provide a `sed -i` script or download link for the complete file instead of inline content. Use exactly one of these options per file.

#### Using provided full-file outputs

- When a full file is printed in chat, treat it as the canonical post-change source: copy-paste it into the matching path to mirror the assistant’s working tree, or use it to diff against your local copy for verification.

- Step-by-step to apply a full-file output:
  1) Copy the content block exactly as printed (preserving trailing newlines) into the target file path from repo root.

  2) Run `git diff --stat` and `git diff` to confirm only the intended file changed and the patch matches what was provided.

  3) Execute any requested lint/test commands before committing.

  4) If something looks off, re-copy the printed content and re-run the diff to verify the file matches the canonical output.

### Delivery

- Provide complete, executable code when asked; never abridge.

- Mention the filename + full path for every file you touch in your summary.

- Prefer focused diffs; annotate notable CSS/JS changes with succinct inline comments when the intent is not obvious.

- Keep prose purposeful; use short checklists (3–12 items) followed by focused steps when outlining work.

- Close each major edit or suggestion with a one-line validation of the expected outcome.

- Never reprint edits that have already been provided unless additional clarification is explicitly required.

### Tooling & migration notes

- Node tooling runs against the checked-in `package.json`; do not rely on globally installed dependencies when executing Codex/Node tasks.

- The expand-questions migration (`tools/expand-questions.mjs`) clones the interactive scaffold from `exercise-1-nouns/111-common-nouns.html`; prefer updating that template first when adjusting the gate shell.

- When validating expand-questions output, copy a source HTML page (for example `exercise-1-nouns/112-proper-nouns-copy.html`) to a scratch file and rerun the tool repeatedly—the conversion should deterministically overwrite the scratch copy on every pass.

### Scope & safety rails

- Stay strictly within the user’s scope. Don’t modify or mention unrelated code or files.

- Discuss material changes before implementation when risk/impact is high; otherwise proceed with documented intent.

- If anything is unclear or risky, pause and ask.

### Memory & continuity

- Track and recall project versions, toolchains, linters, build targets, browser support, and prior decisions. Reuse working patterns; avoid past mistakes.

- Record lessons learned (successes/failures) and apply them in later sessions.

## Recent exercise system improvements

- Universal answer keys now live in page-level JSON with hashed `answersAccepted` entries. Update hashes when expected responses change instead of exposing plain text.

- Recipient lists inside exercise configs are obfuscated as numeric code points; always decode before sending mail but keep the stored values unreadable.

- Developer QA helpers ship in `web-asset/js/exercise-devtools.js`. Set `data-exercise-devtools="auto"` on a page to expose the floating “Auto-fill answers” button; use `data-exercise-devtools="manual"` or remove the attribute to hide it.

- Universal gate logic honors per-question flags (ordered comparisons, manual review, case sensitivity). Only add overrides when deviating from defaults to keep payloads lean.

- Accordion gating no longer depends on visual underlines. Clone the scaffold from `exercise-1-nouns/111-common-nouns.html` for new exercises and wire it to the JSON answer key.

### Front-end navigation notes

- The left sidebar menu scales via the responsive `--left-menu-font-size` clamp with a paired icon clamp; adjust those tokens instead of hard-coding pixel values.

- Critical inline CSS in `exercise-1-nouns/111-common-nouns-codex-copy6.html` mirrors `web-asset/css/left-menu.css` for the sidebar; keep the custom property values and layout rules in sync when updating either file.

- Keep sidebar labels single-line on desktop. If you must wrap, document the rationale in-code.

- Exercise conversions: when cloning legacy accordion pages, always source the full gate scaffold (form, config JSON, and auto submitUrl helper script) from `exercise-1-nouns/111-common-nouns.html`; ensure the generated markup preserves the boolean `data-exercise-*` attributes without empty values.

**KISS**: simplest, best practices,solution or tweak that aligns with current instructions, stay focused, on-task, passes tests, meets requirements, ensures future-proof choices, and respects existing arch.

## Edit Instruction Standards

When proposing code changes, the assistant MUST provide:

1) **File path** (absolute from repo root).
2) **Exact line numbers** and **context** (3–5 lines around changes).
   - If line numbers aren’t known, include a grep to locate anchors:

     ```bash
     nl -ba path/to/file | sed -n '120,150p'  # preview range
     rg -n 'anchor text' path/to/file         # ripgrep
     ```

3) **Unified diff** (copy-pasteable) *and* a shell-ready way to apply it:
   - Prefer (in order) `sed`, `in-chat manual code window`, `git apply` then `patch`;
4) **Post-change verification** steps (lint/test/run commands).
5) **Rollback** note (how to revert the commit or restore backup).

6) **Completed full file-update delivery**: Ensure any file with total number of edits of more than three lines must be accompanied by either a. `sed` or b. `in-chat manual code window` method of acquiring complete updated file with current changes.

### Patch Template

**File:** `path/to/file.ext` (anchor: lines 120–150)

## 1. Mandatory Edit Instruction Format

When proposing code or config changes, instructions MUST include:

1. **File path** (absolute from repo root), e.g. `/server/exercise-mailer.mjs`
2. **Exact search anchor(s)** to locate position (unique lines to match)
3. **Precise change type**: *insert above/below*, *replace lines X–Y*, or *append at EOF*
4. **Before/After blocks** with enough context (≥3 lines) to avoid ambiguity
5. **Unified diff** (optional but preferred) with context lines
6. **Post-change verification commands** (e.g., lint/test/reload)
7. **Rollback note** (how to revert quickly)

> Never use vague phrases like “after the config block” or “near the top”.

---

## 2. Edit Instruction Template

**File:** `/PATH/TO/FILE.ext`
**Anchor (find this exact text):**
