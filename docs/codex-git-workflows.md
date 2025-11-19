# eagles-edu/megs – Codex + Git Workflows

## 0. Assumptions

* Repo: `eagles-edu/megs`
* Remote: `origin`
* Branches:

  * `main` = *primordial / unused, for now*
  * `PT-BETA-0.0.04.01` = current real working branch
* You are the only person pushing to this repo.
* All commands are run in **local VS Code terminal** from the repo root.

---

## 1. One-Time Migration: Promote `PT-BETA-0.0.04.01` to Real `main`

### 1.1 Goal

* Make `main` the **canonical, up-to-date branch**.
* Preserve the old primordial `main` under an archive branch.
* Keep `PT-BETA-0.0.04.01` around initially, then optionally retire it.

### 1.2 Pre-flight checklist

Before running commands:

* Worktree is clean: no uncommitted changes (`git status` should say “clean”).
* Remote has both `origin/main` and `origin/PT-BETA-0.0.04.01`.
* You’re OK with `origin/main` being replaced by `PT-BETA-0.0.04.01`’s history.

### 1.3 Exact command sequence

> All commands in **local VS Code terminal**.

```bash
# 0. Go to repo
cd /path/to/eagles-edu/megs

# 1. Make sure you see all remote branches
git fetch origin --prune

# 2. Ensure primordial main is up-to-date locally
git checkout main
git pull origin main

# 3. Create an archive branch from primordial main and push it
#    This preserves that old history in case you ever need it.
git branch archive/main-primordial
git push origin archive/main-primordial

# 4. Ensure PT-BETA-0.0.04.01 is up-to-date locally
git checkout PT-BETA-0.0.04.01
git pull origin PT-BETA-0.0.04.01

# 5. Point local 'main' at PT-BETA-0.0.04.01's commit
#    (this rewrites the local 'main' pointer; you stay on PT-BETA-*)
git branch -f main PT-BETA-0.0.04.01

# 6. Push the new 'main' history to origin, overwriting primordial main there
#    --force-with-lease = safe-force (won’t clobber unexpected remote changes)
git push --force-with-lease origin main
```

At this point:

* `origin/main` == `PT-BETA-0.0.04.01` (same commit).
* Old primordial main is preserved as `origin/archive/main-primordial`.

### 1.4 Optional clean-up of `PT-BETA-0.0.04.01` (later)

Once you’re comfortable working directly on `main`, you can retire `PT-BETA-0.0.04.01`.

```bash
# Only do this once you're sure main is the new truth.

# 1. Make sure main is checked out
git checkout main

# 2. Delete local PT-BETA branch
git branch -d PT-BETA-0.0.04.01    # will refuse if not fully merged into main

# 3. Delete remote PT-BETA branch
git push origin :PT-BETA-0.0.04.01
```

### 1.5 GitHub UI check

In the GitHub web UI for `eagles-edu/megs`:

1. Go to **Settings → Branches**.
2. Ensure **Default branch** is set to `main`.
   (It probably already is, but confirm.)

---

## 2. Everyday Development Loop (Codex-Assisted Work)

After migration, treat `main` as “truth” and use short-lived branches for refactors/experiments.

### 2.1 Update `main` before starting new work

```bash
cd /path/to/eagles-edu/megs

git checkout main
git pull origin main
```

### 2.2 Create a refactor/feature branch

Use descriptive names. Example:

```bash
# Example for a layout refactor
git checkout -b refactor-pt-0.0.05-layout
```

You’ll now do all Codex-driven edits on this branch.

### 2.3 Apply Codex changes & test (conceptual steps)

On branch `refactor-pt-0.0.05-layout`:

1. Use Codex (via the GitHub connector) to propose changes (diff or full file).
2. Apply those changes to your **local** files (manually or via patch).
3. Run local checks:

   * Lint: `npm run lint` (or your actual lint command).
   * Build/serve and check browser console is clean.

*No Git commands here other than normal editing; this step is about making sure the Codex changes actually work locally.*

### 2.4 Commit and push the branch

```bash
# See what changed
git status

# Stage relevant files
git add path/to/file1 path/to/file2
# or, if you’re confident:
# git add .

# Commit with a clear message
git commit -m "refactor: layout changes for PT 0.0.05"

# Push branch to origin and set upstream
git push -u origin refactor-pt-0.0.05-layout
```

GitHub Actions will run on this branch according to your workflow files.

### 2.5 Merge into `main` when stable

Once the branch is lint-clean, browser-console clean, and GH Actions are green:

```bash
# 1. Ensure local main is up-to-date
git checkout main
git pull origin main

# 2. Merge the refactor branch into main
git merge --no-ff refactor-pt-0.0.05-layout
# Resolve any merge conflicts if prompted, then:
#   git add <resolved-files>
#   git commit    # if Git asks for a merge commit message

# 3. Run tests/lint one more time on main
#    (same local commands you use for branches)

# 4. Push updated main
git push origin main
```

Optional clean-up:

```bash
# Delete local branch
git branch -d refactor-pt-0.0.05-layout

# Delete remote branch
git push origin :refactor-pt-0.0.05-layout
```

---

## 3. “Destructive Refactor” Pattern with Snapshot Tags

Before heavy / destructive refactors, capture a known-good snapshot of `main` you can always return to.

### 3.1 Create a snapshot tag and refactor branch

```bash
cd /path/to/eagles-edu/megs

# 1. Make sure main is current
git checkout main
git pull origin main

# 2. Tag the current state of main
#    Use your own date/label; example:
git tag pre-refactor-2025-11-19-pt-0.0.05
git push origin pre-refactor-2025-11-19-pt-0.0.05

# 3. Create refactor branch off main
git checkout -b refactor-pt-0.0.05-major-cleanup
```

Now:

* `pre-refactor-2025-11-19-pt-0.0.05` is a permanent “bookmark” you can always check out.
* `refactor-pt-0.0.05-major-cleanup` is where you let Codex help you with destructive changes.

### 3.2 If refactor goes badly

You have options:

* **Abandon branch**: just stop using `refactor-*`. Switch back to main:

  ```bash
  git checkout main
  ```

  (Later, delete the bad branch if you want.)

* **Hard reset refactor branch back to snapshot:**

  ```bash
  git checkout refactor-pt-0.0.05-major-cleanup
  git reset --hard pre-refactor-2025-11-19-pt-0.0.05
  # Now the refactor branch is identical to that tag.
  ```

You never touch `main` until you’re ready and confident.

---

## 4. Rebase Workflow (When `main` Moves Ahead)

Use this when:

* You’re working on `refactor-*` for a while, and
* `main` has new commits (e.g., other work or previous branches merged).

You want `refactor-*` to be replayed on top of the latest `main`.

### 4.1 Rebase sequence

```bash
cd /path/to/eagles-edu/megs

# 1. Ensure main is current
git checkout main
git pull origin main

# 2. Rebase your refactor branch onto the new main
git checkout refactor-pt-0.0.05-layout
git rebase main
```

If there are **no conflicts**, the rebase completes. Continue:

```bash
# 3. Run tests/lint
#    (same commands as usual)

# 4. Push rewritten branch (history was changed by rebase)
git push --force-with-lease origin refactor-pt-0.0.05-layout
```

### 4.2 Handling rebase conflicts

During `git rebase main`, Git may stop and show conflicts.

1. Fix conflicts in each reported file (VS Code will highlight them).

2. Stage resolved files:

   ```bash
   git add path/to/conflicted-file
   ```

3. Continue the rebase:

   ```bash
   git rebase --continue
   ```

Repeat until rebase completes.

If it goes sideways and you want to **give up**:

```bash
git rebase --abort
# Your branch returns to the state it was in before the rebase.
```

---

## 5. Undo / Recovery Cheatsheet

### 5.1 Throw away uncommitted changes

```bash
# Discard changes in a single file
git restore path/to/file

# Discard ALL uncommitted changes in the working tree
git restore .
```

### 5.2 “Undo last commit” (not pushed yet)

```bash
# Move branch pointer back one commit, drop the last commit's changes
git reset --hard HEAD^
```

If you want to keep the changes in your working tree but uncommit them:

```bash
git reset --soft HEAD^
# Now the changes from the last commit are staged but uncommitted.
```

### 5.3 Undo a commit that has already been pushed

Safer to use **revert** instead of rewriting history:

```bash
# Find the commit hash (e.g., with `git log --oneline`)
git revert <commit-hash>
# This creates a new commit that undoes the changes.
git push origin <branch-name>
```

Use this on `main` once it’s shared or if you want a clean “undo” trail.

---

## 6. Naming & Branching Conventions (Recommended)

* **Canonical branch:** `main`

  * Always reflects your best current project state.
  * Codex, CI, and GitHub default to this.

* **Working branches:**

  * `refactor-<short-description>` for bigger restructures.
  * `feat-<short-description>` for new features.

* **Tags for snapshots:**

  * `pre-refactor-YYYY-MM-DD-<label>` before major destructive work.
  * `vX.Y.Z` for releases if/when you want semantic versioning.

This structure keeps your current habits (“branch before destructive refactor”, “use previous commit to undo”) but plugs them into a conventional, tool-friendly layout where `main` is the truth, and everything else is clearly scoped “work in progress”.
