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

### Delivery

- Provide complete, executable code when asked; never abridge.

- Mention the filename + full path for every file you touch in your summary.

- Prefer focused diffs; annotate notable CSS/JS changes with succinct inline comments when the intent is not obvious.

- Keep prose purposeful; use short checklists (3–12 items) followed by focused steps when outlining work.

- Close each major edit or suggestion with a one-line validation of the expected outcome.

- Never reprint edits that have already been provided unless additional clarification is explicitly required.

### Scope & safety rails

- Stay strictly within the user’s scope. Don’t modify or mention unrelated code or files.

- Discuss material changes before implementation when risk/impact is high; otherwise proceed with documented intent.

- If anything is unclear or risky, pause and ask.

### Memory & continuity

- Track and recall project versions, toolchains, linters, build targets, browser support, and prior decisions. Reuse working patterns; avoid past mistakes.

- Record lessons learned (successes/failures) and apply them in later sessions.

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
