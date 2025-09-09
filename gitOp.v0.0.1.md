# gh Cheatsheet — Commands Used Today

## 1) Authenticate to GitHub
```bash
# Purpose: Log in and verify the session
# Use when: First-time setup or re-authentication

gh auth login
gh auth status
```

## 2) Fix “Permission denied” on /etc/gitconfig
```bash
# Purpose: Make system Git config readable
# Use when: You see "unable to access '/etc/gitconfig': Permission denied"

sudo chmod 644 /etc/gitconfig
sudo chown root:root /etc/gitconfig
ls -l /etc/gitconfig
```

## 3) Temporarily bypass system config
```bash
# Purpose: Run commands without reading /etc/gitconfig
# Use when: Quick, non-sudo workaround

export GIT_CONFIG_NOSYSTEM=1

# Single-command bypass (no persistent env change)
env GIT_CONFIG_NOSYSTEM=1 gh auth setup-git
```

## 4) Set global Git author identity
```bash
# Purpose: Ensure correct commit name/email
# Use when: Not set or needs correction

git config --global user.name "eagles-edu"
git config --global user.email "admin@eagles.edu.vn"
```

## 5) Inspect Git configuration and set a friendlier pager
```bash
# Purpose: Verify effective config and improve output UX
# Use when: Debug/confirm config, avoid pager noise

git config --global --list --show-origin
git --no-pager config --list --show-origin
git config --global core.pager "less -+F -+X"
```

## 6) Verify Git availability
```bash
# Purpose: Baseline diagnostics
# Use when: Confirm Git is installed/working

git --version
```

## 7) Configure GitHub CLI as credential helper
```bash
# Purpose: Use gh for Git credentials
# Use when: Move away from plain-text store; centralize auth

# Attempt (may fail if /etc/gitconfig unreadable)
gh auth setup-git

# Successful with system-config bypass
env GIT_CONFIG_NOSYSTEM=1 gh auth setup-git

# Check helper after setup
git config --global --get-all credential.helper
```

## 8) Manual credential helper setup (if not set by setup-git)
```bash
# Purpose: Force Git to use gh as the credential helper
# Use when: `git config --global --get-all credential.helper` returns nothing

git config --global --unset credential.helper || true
git config --global credential.helper "!$(command -v gh) auth git-credential"
git config --global --get-all credential.helper
```

## 9) Validate repo connectivity without pushing
```bash
# Purpose: Sanity check remote/auth
# Use when: After auth/credential changes

git push --dry-run
```

## 10) Check/reset the bypass environment variable
```bash
# Purpose: Confirm or clear session-only override
# Use when: Ensure normal config is in effect

echo "${GIT_CONFIG_NOSYSTEM:-unset}"
unset GIT_CONFIG_NOSYSTEM
```

## 11) Optional cleanup: remove plain-text credentials
```bash
# Purpose: Remove old plain-text store
# Use when: You previously used `credential.helper=store`

rm -f ~/.git-credentials
```

# Core Git/GitHub Command Sets — Setup → Operate/Maintain → Archive/Delete

## A) Environment & Prerequisites
```bash
# Prereqs: Git and GitHub CLI installed; internet access.
# Checks: versions, auth, identity, default branch name.

git --version
gh --version

# Auth to GitHub (if needed)
gh auth status || gh auth login

# Ensure identity (global)
(git config --global user.name && git config --global user.email) || \
{ git config --global user.name "Your Name"; git config --global user.email "you@example.com"; }

# Optional: default to 'main' for new repos
git config --global init.defaultBranch main
```

## B) New Repository Setup (create local + GitHub)
```bash
# Prereqs: In project directory that should become a repo; authenticated gh.
# Creates repo, initial commit, pushes to GitHub with 'main'.

git init -b main
printf "# %s\n" "$(basename "$PWD")" > README.md

git add -A
git commit -m "chore: initial commit"

gh repo create --source . --public --remote origin --push
# Alternatives: --private | --internal (org only)
```

## C) Clone Existing Repository
```bash
# Prereqs: Repo exists on GitHub; you have access; authenticated gh.
# Clones and sets origin; checks out default branch.

gh repo clone OWNER/REPO
cd REPO

git remote -v
git branch -vv
```

## D) Remote Management
```bash
# Prereqs: Local repo initialized.
# Add/inspect/remove remotes and fetch with prune.

git remote add origin https://github.com/OWNER/REPO.git  # if missing
# Optional upstream (fork workflows)
git remote add upstream https://github.com/UPSTREAM_OWNER/REPO.git || true

git remote -v

git fetch --all --prune
```

## E) Branching Model (create/use/cleanup)
```bash
# Prereqs: Local repo with tracked main; working tree clean for creates/switches.
# Create feature branch, push, and set upstream; list and delete when done.

git switch main && git pull --rebase --autostash

git switch -c feat/short-description
# ...edit files...

git add -A
git commit -m "feat: implement X"

git push -u origin HEAD

# List branches (local + remote)
git branch -a -vv

# Delete branches
git switch main
git branch -d feat/short-description              # local
git push origin --delete feat/short-description    # remote
```

## F) Daily Work: Stage → Commit → Sync
```bash
# Prereqs: On a working branch; remote set; clean up WIP via stash if needed.

git status -sb

git add -p        # interactively stage
# or stage all tracked & new
# git add -A

git commit -m "type(scope): concise message"

# Sync with latest main before pushing (rebased workflow)
git fetch origin
git rebase origin/main   # or: git pull --rebase --autostash

# Push
git push --set-upstream origin HEAD
```

## G) Pull Requests: Create → Review → Merge
```bash
# Prereqs: Branch pushed to origin; authenticated gh; repo permissions to open PRs.
# Create PR

gh pr create \
  --fill \
  --base main \
  --head $(git rev-parse --abbrev-ref HEAD) \
  --title "feat: implement X" \
  --body "Summary, rationale, tests, and risk notes."

# Review locally or view in browser
gh pr view --web
# Checkout PR locally (for testing)
gh pr checkout <PR_NUMBER>

# Merge PR (choose method)
# --merge (merge commit), --squash, or --rebase

gh pr merge <PR_NUMBER> --squash --delete-branch --auto
```

## H) Tags and Releases
```bash
# Prereqs: Clean main with version bump committed.
# Create annotated tag and GitHub release with notes.

git switch main && git pull --rebase

tag=v1.0.0
git tag -a "$tag" -m "Release $tag"
git push origin "$tag"

# Create release on GitHub with changelog
gh release create "$tag" --generate-notes --latest
# Attach assets (optional)
# gh release upload "$tag" build/artifact.zip
```

## I) Sync Forks (upstream → your fork)
```bash
# Prereqs: Fork workflow; 'upstream' remote configured; no local uncommitted changes.

git fetch --all --prune

git switch main
git rebase upstream/main

git push --force-with-lease origin main
```

## J) Resolve Conflicts (quick patterns)
```bash
# Prereqs: A rebase/merge in progress and conflicts shown by Git.

# Inspect conflicts
git status

# Edit files to resolve, then mark as resolved
git add <resolved_file>...

# Continue the operation
git rebase --continue   # if rebasing
# or
git merge --continue    # if merging

# Abort if needed
git rebase --abort || git merge --abort
```

## K) Stash Work-in-Progress
```bash
# Prereqs: Dirty working tree you want to shelve temporarily.

git stash push -u -m "wip: quick save"

git stash list

git stash show -p stash@{0}

git stash pop stash@{0}   # apply and drop
# or
git stash apply stash@{0} # apply, keep stash
```

## L) Find and Fix Regressions (bisect)
```bash
# Prereqs: A failing test or reproducible bug; a known good commit.

git bisect start
git bisect bad            # current is bad
git bisect good <good_sha>
# Run your test each step, then mark good/bad
# ... repeat ...

git bisect reset
```

## M) Revert or Cherry-pick
```bash
# Prereqs: Identify commit SHA(s) on a clean branch.

# Revert (new commit that undoes a commit)
git revert <sha>

# Cherry-pick specific commit(s) onto current branch
git cherry-pick <sha1> [<sha2> ...]
```

## N) Maintenance & Cleanup
```bash
# Prereqs: Any repo; frequent periodic use recommended.

# Prune stale remote branches and refs
git fetch --all --prune

git remote prune origin

# Lightweight maintenance (Git >= 2.30)
git maintenance run --auto

# Pack/garbage-collect (safe default)
git gc --prune=now
```

## O) Recovery with Reflog
```bash
# Prereqs: You need to restore a previous HEAD or lost branch.

git reflog --date=iso
# Reset hard to a previous state (DANGEROUS: moves branch pointer)
# Pick the correct entry from reflog before running:
# git reset --hard HEAD@{3}
```

## P) Submodules (if used)
```bash
# Prereqs: You need to include another repo at a path.

git submodule add https://github.com/OWNER/OTHER.git path/other

git submodule update --init --recursive

git submodule foreach git pull --rebase
```

## Q) Large Files (Git LFS) (if needed)
```bash
# Prereqs: git-lfs installed; repository requires large file tracking.

git lfs install

git lfs track "*.psd"
echo "*.psd" >> .gitattributes

git add .gitattributes
git commit -m "chore: track PSD files with LFS"
```

## R) Backup / Mirror / Bundle
```bash
# Prereqs: Want an offsite mirror or portable backup.

# Create a bare mirror clone (all refs)
git clone --mirror https://github.com/OWNER/REPO.git REPO.git
cd REPO.git
# Push mirror to another remote
# git remote add backup git@github.com:OWNER/REPO-backup.git
# git push --mirror backup

# Create a single-file bundle (portable backup)
cd ..
git clone https://github.com/OWNER/REPO.git REPO
cd REPO
git bundle create ../repo.bundle --all --tags
# To restore: git clone repo.bundle restored-repo
```

## S) Archive Repository on GitHub
```bash
# Prereqs: You are repo admin/maintainer; authenticated gh.

gh repo archive OWNER/REPO --yes
# Unarchive (if needed)
# gh repo unarchive OWNER/REPO --yes
```

## T) Delete Branches/Tags and Repository (DANGEROUS)
```bash
# Prereqs: You truly intend to delete; you have backups; permissions granted.

# Delete branches
git branch -d <local_branch>
git push origin --delete <remote_branch>

# Delete tags
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Delete GitHub repository (cannot be undone)
# You will be prompted to confirm the repo name

gh repo delete OWNER/REPO --yes --confirm OWNER/REPO
```

## U) Useful Views & Diagnostics
```bash
# Quick overviews

git log --oneline --graph --decorate --all

git shortlog -sn            # top committers

git status -sb

gh pr list --state open

gh release list
```