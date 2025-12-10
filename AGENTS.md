# AGENTS.md - Agents Operating Manual

## Instructions for Coding

Mindset of a 15+ yr full-stack, AI-enabled app dev.

### Core behaviors

_Critically, consistently, and before every coding attempt, ALWAYS reread agents.md instructions._

**Prepare to continue** dev by:

1. rescanning repo,
2. identifying all changed files in  repo,
3. fully purging your working memory,
4. refreshing repo working memory with current canonical repo state,
5. verifying repo working memory state is equal to canonical repo state, and
6. performing All per agents.md rules.

#### MANDATORY

> **_BEFORE_** you (codex) evaluates any code to suggest edits and/or provide unified differential patches, you MUST ALWAYS, WITHOUT EXCEPTION:

1. RESCAN REPO FOR CHANGED CANONICAL files,

2. COMPLETELY FLUSH working memory (head),

3. REFRESH working memory with freshly updated canonical state.

4. ALWAYS Cautious, incremental, validation-first problem solving.

5. **No assumptions**; clarify missing context with focused questions.

6. **Recency obsession**: verify versions, syntax, deprecations, and compatibility online, **from today to your (the GPT model’s) info cutoff date** before advising.

7. **Defer to current sources** when legacy conflicts appear; note impacts.

8. **Focused-diff edits**; change only what’s required; avoid over-engineering.

9. Break down large problems into multiple simple, specific, detailed steps when creating Implementation steps.

10. Dont '**reinvent the wheel**' or **modify existing code** unless requested or absolutely necessary to fulfill this documents instructions.

11. Look for ways to implement changes by using existing code first; then, if not possible, create new code solutions.

12. Work slowly and go step-by-step to make compact, requirement fulfilling, working, elegant, best-practices code.

### CRITICAL RESOURCES

**Always rescan docs/exercise-system.md on startup!** Maintain current, regularly updated ancilary repositories of _critical_ systems' information.

#### I. Exercise System and Conversion Guide

**CONTENTS** of docs/exercise-system.md

    1. Exercise Runtime (Gate) Behavior
    2. Conversion Pipeline (js/convert-legacy-gated.mjs)
      -- Key options (CLI)
      -- CMD line flags
    3. Behavioral Overview
      -- Hash generation
      -- Defaults/Requirement
    4. Obfuscating GUI Answer Text
      -- Safety checks

### IMPORTANT

- **RESCAN REPO mandate**: rerun discovery (`git status -sb`, `rg`, etc.) immediately before changing files, and explicitly note in responses that the working tree was clean, updated, working memory was flushed, then refreshed at that moment.

- **Between edits, recheck repo state**: after each edit is applied (and before starting another), run `git status -sb` to confirm the current tree state and call it out in replies.

- **Working-memory cadence**: before drafting any new patch, refresh your view of the repo (`git status -sb`, `rg`, etc.) and state that the tree is clean at that moment; after supplying an edit, re-run `git status -sb` and report the updated tree state before beginning the next edit.

- **Always document** that the working tree is clean (e.g., via `git status -sb`) before presenting a diff or set of edits.

- **Note prototype impact**: call out when edits touch prototype vs. live flows and reference the `npm run verify:prototype` script when relevant.

- **Always use Unified Differential Format** patches for every file you modify; ensure compatibility with vscode extension 'nakadehitsujiko.paste-and-apply-patch' so requestors can apply the new new patches easily.

- **Keep the instructions scoped** to just the new changes.

- When a request asks for complete, fully updated files **provide the latest, full, post-change file content (per-file) alongside a verified clean `patch diff`** so downstream users can apply or verify changes without hunting prior diffs. The previous "Requirement" for this instruction has now been downgraded to "provide only if asked (POIA)."

- **File delivery rule** (POIA): For _files under 2000 lines_, always **include the entire post-change file inline (copy/paste ready)** and skip redundant inline diffs for that same file.

- (POIA) For files 2000 lines or longer, provide a `sed -i` script or download link for the complete file instead of inline content. Use exactly one of these options per file; never mix both or omit the mandated delivery format.

- "**Inline content**" = the full, ready-to-paste body of a file (no ellipses, no truncation), enclosed in a code fence, matching the exact post-change file.

- (POIA) For files 2000 lines or longer, provide one or both of the following so requestors can fetch the canonical file without scrolling in chat:

  - A shell command using the current repo state, e.g., `git show HEAD:path/to/file > path/to/file` (or substitute a specific commit/branch ref as needed).

  - A direct download URL (e.g., GitHub raw link to the targeted ref) if remote retrieval is requested.

#### Using provided full-file outputs

- When a full file is printed in chat, treat it as the canonical post-change source: copy-paste it into the matching path to mirror the assistant’s working tree, or use it to diff against your local copy for verification.

- Step-by-step to apply a full-file output **POIA**:

  1. Copy the content block exactly as printed (preserving trailing newlines) into the target file path from repo root.

  2. Run `git diff --stat` and `git diff` to confirm only the intended file changed and the patch matches what was provided.

  3. Execute any requested lint/test commands _before_ committing.

  4. If something looks off, re-copy the printed content and re-run the diff to verify the file matches the canonical output.

### Delivery

- Provide complete, executable code when asked (POIA); never abridge.

- Mention the filename + full path for every file you touch in your summary.

- **Prefer focused diffs**: annotate notable CSS/JS changes with succinct inline comments when the intent is not obvious.

- **Keep prose purposeful**; use short checklists (3+ items) followed by focused steps when outlining work.

- Close each major edit or suggestion with a one-line **validation of the expected outcome**.

- **Never reprint edits** that have already been provided unless additional clarification is explicitly required (POIA).

- **Unified Diff Format forever**: include an aggregated unified diff snippet (e.g., from `git diff --unified`) for every change set, even when full files are provided elsewhere in the response.

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

### Obfuscation SOP

- Never ignore a directive to update this SOP; acknowledge or refuse explicitly—no silent drops.
- Hash flow stays primary: `answersAccepted` hashes are canonical for gating/autofill.
- When hashes are absent, allow obfuscation fallback via `answersObfuscated` values (base64-encoded plaintext answers). Decode and treat as the single accepted answer; do not expose readable answers elsewhere.
- Do not scrape or rely on panel `<p>` text for autofill or decoding.
- Dev-only plaintext dictionaries live in `dev/<title>.txt` (generated by `tools/fnv1a64-convert.mjs --round-trip --title <title>`). `title` must be set in the page answer-key JSON; devtools must fetch `../dev/<title>.txt` for autofill. Do not embed inline `data-exercise-dev-dict` blocks on pages.

## Edit Instruction Standards

When proposing code changes, the assistant MUST provide:

1. **File path** (absolute from repo root).

2. **Exact line numbers** and **context** (3–5 lines around changes).
   - If line numbers aren’t known, include a grep to locate anchors:

  ```bash
    nl -ba path/to/file | sed -n '120,150p'  # preview range
    rg -n 'anchor text' path/to/file         # ripgrep
  ```

3. **Unified diff** (copy-pasteable) **and** a shell-ready way to apply it:
   - Prefer (in order) `diff patch from freshly updated rescan of repo`, `in-chat manual code window`, `patch` then `git apply` ;

2. **Post-change verification** steps (lint/test/run commands).

3. **Rollback** note (how to revert the commit or restore backup).

4. **Completed full file-update delivery**: Ensure any file with total number of edits of more than three lines must be accompanied by either a. `sed` or b. `in-chat manual code window` method of acquiring complete updated file with current changes.

### Patch Template

**File:** `path/to/file.ext` (anchor: lines 120–150)

## I. Mandatory Edit Instruction Format

When proposing code or config changes, instructions MUST include:

1. **File path** (relative to repo root), e.g. `/server/exercise-mailer.mjs`

2. **Unified diff** (REQUIRED) from updated and verified clean, then refresh working memory (head)

3. **Post-change verification commands** (e.g., lint, test, verify, refresh memory, serve)

4. **Rollback note** (how to revert quickly)

> Never use vague phrases like “after the config block” or “near the top”.

---

## 2. Edit Instruction Template

**File:** `/PATH/TO/FILE.ext`
**Anchor (find this exact text):**
