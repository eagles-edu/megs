# Agents Operating Manual

## AGENTS.md - Instructions for Coding

Mindset of a 15+ yr full-stack, AI-enabled app dev.

### Core behaviors

_Critically, consistently, and before every coding attempt, ALWAYS reread agents.md instructions. Reread docs/exercise-system.md on startup!_

**Startup checklist (every session)**:

1. Reread AGENTS.md instructions.
2. Reread `docs/exercise-system.md` and `docs/asscon.md`.
3. Determine context: **#1 online codex**, **#2 local codex**, or **#3 temp override**.
4. If **#1 online**, rescan the repo and identify changed files.
5. Flush working memory, refresh canonical state, and verify alignment.
6. Record the current working tree state (clean/dirty) before computing diffs or edits.
7. Keep critical systems documents current with regular updates (at least daily).

### Global Instructions (All Modes)

1. Apply **MANDATORY** + **IMPORTANT** unless a mode below explicitly overrides.
2. If instructions conflict, state the conflict and re-evaluate which mode (#1/#2/#3) is active before continuing.
3. **No inline styles**: never add or reintroduce `style="..."` in legacy exercise `<p>` content; preserve existing HTML and follow `docs/asscon.md` conventions for answer highlighting.
4. Use AL/ALT/QB nomenclature for `tools/input.txt` formatting (see Obfuscation SOP).

---

### Mode Behaviors (Pick One)

#### #1 Online Codex (GitHub connector)

- Rerun discovery (`git status -sb`, `rg`, etc.) immediately before changes and report the current working tree state.
- Flush and refresh working memory; confirm it matches the canonical repo state.
- Follow online-only cadence: refresh repo view before each patch and report updated state after each edit.

#### #2 Local Codex (IDE workspace)

- Follow standard local workflow with concise outputs.
- Do not interrupt for dirty state or unexpected deltas; note repo state is updated periodically.
- Before edits, run `git status -sb` and report the current state.

#### #3 Temp Override (Local + Save my Tokens)

- Triggered only when the prompt includes this exact line:
  - `Save my Tokens! [agents.md temp override] - Whenever you are writing edits to local repo files, do not create a unified diff, print the edits, or run other non-requested, token burning machinations, etc.; rather, perform this command, verify completion, and end it.`
- Execute only the requested action, verify completion with the minimum required command(s), then end the response.
- Skip unified diff/full-file printing/extra commands unless a higher-priority instruction explicitly requires them.
- If a higher-priority instruction conflicts, state the conflict, re-evaluate which mode (#1/#2/#3) is active, then follow that mode.

#### MANDATORY

> **_BEFORE_** you (codex) evaluate any code to craft or suggest edits and/or provide unified differential patches, or perform terminal Operation you MUST ALWAYS, WITHOUT EXCEPTION:

#### Set Node v20.19.4 BEFORE you (codex) run terminal operations; Other Node versions are prohibited

1. RESCAN REPO FOR CHANGED CANONICAL files (only in **#1 online mode**).
2. COMPLETELY FLUSH working memory (head).
3. REFRESH working memory with freshly updated canonical state.
4. **ALWAYS** cautious, incremental, validation-first problem solving.
5. **No assumptions**; clarify missing context with focused questions.
6. **Recency obsession**: verify versions, syntax, deprecations, and compatibility online, **from today to your (the GPT model’s) info cutoff date** before advising.
7. **Defer to current sources** when legacy conflicts appear; note impacts.
8. **Focused-diff edits**; change only what’s required; avoid over-engineering.
9. **Break down large problems** into multiple simple, specific, detailed steps when creating Implementation steps.
10. Dont '**reinvent the wheel**' or **modify existing code** unless requested or absolutely necessary to fulfill this documents instructions.
11. **Look for ways to implement changes by using existing code first**; then, if not possible, create new code solutions.
12. **Work slowly and go step-by-step** to make compact, requirement fulfilling, working, elegant, best-practices code.

### CRITICAL RESOURCES

**Always rescan** `docs/exercise-system.md` and `docs/asscon.md` on startup.
**Always update documentation** maintain critical systems information documents current with regular updates (at least daily). include

    1. AGENTS.md
    2. docs/asscon.md
    3. docs/exercise-system.md

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

- **RESCAN REPO mandate (online)**: rerun discovery (`git status -sb`, `rg`, etc.) immediately before computing changes in files, and explicitly note in responses the current working tree state (clean/dirty) and memory refresh status.
- **Before edits, recheck repo state**: run `git status -sb` and call it out in replies (required in #1/#2; skip only in #3).
- **Working-memory cadence (online)**: before drafting any new patch, refresh your view of the repo and report the current tree state; after supplying an edit, re-run `git status -sb` and report the updated state before the next edit.
- **Always document** the current working tree state (clean/dirty) before presenting a diff or set of edits.
- **Note prototype impact**: call out when edits touch prototype vs. live flows and reference the `npm run verify:prototype` script when relevant.
- **Always use Unified Differential Format** patches for every file you modify unless **#3 temp override** requires skipping; ensure compatibility with vscode extension 'nakadehitsujiko.paste-and-apply-patch' so requestors can apply patches easily.
- **Keep the instructions scoped** to just the new changes.
- **Backup naming**: when creating backups, use a `.BAK` suffix or `-copy` suffix without asking.
- When a request asks for complete, fully updated files **provide the latest, full, post-change file content (per-file) alongside a verified clean `patch diff`** so downstream users can apply or verify changes without hunting prior diffs. The previous "Requirement" for this instruction has now been downgraded to "provide only if asked (POIA)."
- **Direct-edit delivery rule (overrides POIA full-file guidance)**: When I edit a file directly, provide **only** the unified diff by default; include the full post-change file (or `sed -i`/download for >2000 lines) **only if explicitly requested**.
- (POIA, only on explicit request) For files under 2000 lines, include the entire post-change file inline (copy/paste ready) and **also** include the unified diff required elsewhere in this SOP.
- (POIA, only on explicit request) For files 2000 lines or longer, provide a `sed -i` script or download link for the complete file instead of inline content. Use exactly one of these options per file; never mix both or omit the mandated delivery format.
- "**Inline content**" = the full, ready-to-paste body of a file (no ellipses, no truncation), enclosed in a code fence, matching the exact post-change file.
- (POIA, only on explicit request) For files 2000 lines or longer, provide one or both of the following so requestors can fetch the canonical file without scrolling in chat:

  - A shell command using the current repo state, e.g., `git show HEAD:path/to/file > path/to/file` (or substitute a specific commit/branch ref as needed).

  - A direct download URL (e.g., GitHub raw link to the targeted ref) if remote retrieval is requested.

#### Using provided full-file outputs

- When a full file is printed in chat, treat it as the canonical post-change source: copy-paste it into the matching path to mirror the assistant’s working tree, or use it to diff against your local copy for verification.

- Step-by-step to apply a full-file output **POIA**:

  1. Copy the content block exactly as printed (preserving trailing newlines) into the target file path from repo root.

  2. Run `git diff --stat` and `git diff` to confirm only the intended file changed and the patch matches what was provided.

  3. Execute any requested lint/test commands _before_ committing.

  4. If something looks off, re-copy the printed content and re-run the diff to verify the file matches the canonical output.

### Best-Practice Checklist (When Optional)

- Recency: verify versions, deprecations, and compatibility when the task depends on tooling or APIs.
- Repo rescan: run `git status -sb` and `rg` before edits to capture current deltas.
- Memory refresh: flush and reload working memory after rescans to keep state aligned.
- Git status cadence: capture state before crafting each edit.
- Unified diffs: generate **only when explicitly requested** or when a patch is the safest delivery format.
- Full-file output: provide only when explicitly requested; prefer focused diffs otherwise.

### Delivery

- Provide complete, executable code **when asked** (POIA); never abridge.

- Mention the filename + full path for every file you touch in your summary.

- **Prefer focused diffs**: annotate notable CSS/JS changes with succinct inline comments when the intent is not obvious.

- **Keep prose purposeful**; use short checklists (3+ items) followed by focused steps when outlining work.

- Close each major edit or suggestion with a one-line **validation of the expected outcome**.

- **Never reprint edits** that have already been provided unless additional clarification is explicitly required (POIA).

- **Unified Diff Format on Request**: include an aggregated unified diff snippet (e.g., from `git diff --unified`) for every change set, even when full files are provided elsewhere in the response.
- When presenting prompts/commands from `docs/asscon.md`, always substitute user-provided values (e.g., target path, title, source choice) before printing—never leave placeholders in displayed prompts or commands.

### Scope & safety rails

- Stay strictly within the user’s scope. Don’t modify or mention unrelated code or files.

- Discuss material changes before implementation when risk/impact is high; otherwise proceed with documented intent.

- If anything is unclear or risky, pause and ask.

- **Unexpected changes policy**: the "stop immediately if unexpected changes appear" rule applies only when working with Codex online in GitHub; for local workflows, note the delta and continue without interrupting the prompt (repo state is updated periodically).

- **Assistant edit controls**: only edit files explicitly requested; if another file is required, ask before touching it.

- **Undo capture**: before any edit, save a timestamped `.BAK-<YYYYmmdd-HHMMSS>` copy of each target file and write an undo patch to `/tmp/codex-undo-<timestamp>.patch` with `git diff -- <files>`; keep until the user asks to delete it.

- **Undo restore**: when reverting, use the stored `.BAK` or reverse patch and limit changes to the files requested.

### Memory & continuity

- Track and recall project versions, toolchains, linters, build targets, browser support, and prior decisions. Reuse working patterns; avoid past mistakes.

- Record lessons learned in agents.md in discreet categories (successes/failures) and apply them in later sessions.

## Recent exercise system improvements

- Universal answer keys now live in page-level JSON with hashed `answersAccepted` entries. Update hashes when expected responses change instead of exposing plain text.

- Recipient lists inside exercise configs are obfuscated tokens (e.g., numeric code points or utf8 hex objects); always decode before sending mail but keep the stored values unreadable.

- Developer QA helpers ship in `web-asset/js/exercise-devtools.js`. Set `data-exercise-devtools="auto"` on a page to expose the floating “Auto-fill answers” button; use `data-exercise-devtools="manual"` or remove the attribute to hide it.

- Universal gate logic honors per-question flags (ordered comparisons, manual review, case sensitivity). Only add overrides when deviating from defaults to keep payloads lean.

- Accordion gating no longer depends on visual underlines. Clone the scaffold from `exercise-1-nouns/111-common-nouns.html` for new exercises and wire it to the JSON answer key.

### Front-end navigation notes

- The left sidebar menu scales via the responsive `--left-menu-font-size` clamp with a paired icon clamp; adjust those tokens instead of hard-coding pixel values.

- Critical inline CSS in `docs/111-common-nouns-codex-copy6.html` mirrors `web-asset/css/left-menu.css` for the sidebar; keep the custom property values and layout rules in sync when updating either file.

- Keep sidebar labels single-line on desktop. If you must wrap, document the rationale in-code.

- Exercise conversions: when cloning legacy accordion pages, always source the full gate scaffold (form, config JSON, and auto submitUrl helper script) from `exercise-1-nouns/111-common-nouns.html`; ensure the generated markup preserves the boolean `data-exercise-*` attributes without empty values.

**KISS**: simplest, best practices,solution or tweak that aligns with current instructions, stay focused, on-task, passes tests, meets requirements, ensures future-proof choices, and respects existing arch.

### Obfuscation SOP

- Never ignore a directive to update this or any SOP; acknowledge or refuse explicitly—no silent drops.
- Hash flow stays primary: `answersAccepted` hashes are canonical for gating/autofill.
- When hashes are absent,notify user immediately; do not expose readable answers anywhere.
- Example blocks are non-graded: never add example answers to `answersAccepted` or `dev/<title>.txt`; keep examples excluded from autofill.
- Answer extraction for `tools/input.txt`: exclude example blocks from answer arrays without requesting confirmation.
- `tools/input.txt` formatting uses AL/ALT/QB: AL (answer line) `\n`, ALT (alternate group) `\n\n`, QB (question block) `\n\n\n`.
- Normalization for extracted answers: strip HTML, remove leading question numbers (e.g., `1.`), preserve sentence case and punctuation, and collapse internal whitespace to single spaces.
- Dev-only plaintext dictionaries live in `dev/<title>.txt` (generated by `tools/fnv1a64-convert.mjs --round-trip --title <title>`). `title` must be set in the page answer-key JSON; devtools must fetch `../dev/<title>.txt` for autofill. Do not embed inline `data-exercise-dev-dict` blocks on pages.

## Daily Updates

- 2026-01-19: Restored conversion assistant diff-preview default and added auto Example detection plus sentence-mode artifact review to prevent input regressions.
- 2026-01-19: Clarified sentence-mode prompts to require full sentences and added optional USA spelling/usage normalization (including quote punctuation fixes).

## Edit Instruction Standards

When proposing code changes, the assistant MUST provide:

1. **File path** (absolute from repo root).

2. **Exact line numbers** and **context** (3–5 lines around changes).
   - If line numbers aren’t known, include a grep to locate anchors:

    `nl -ba path/to/file | sed -n 120,150p`
    `rg -n anchor text path/to/file`

3. **Unified diff** (copy-pasteable) **and** a shell-ready way to apply it:
   1. Prefer (in order) `diff patch from freshly updated rescan of repo`, `in-chat manual code window`, `patch` then `git apply` ;

4. **Post-change verification** steps (lint/test/run commands).

5. **Rollback** note (how to revert the commit or restore backup).

6. **Completed full file-update delivery**: Only when a full file is explicitly requested; otherwise (direct edits) provide the unified diff only.

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
