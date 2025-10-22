# Commands to Diagnose Sync Issues

## (Pre-flight checks)

### Run these to understand your current branch, remote wiring, and pending changes before touching history

```bash
git status
git status -sb                     # concise working tree summary
git branch --show-current          # confirm the checked-out branch
git remote -v                      # verify remote URLs
git remote show origin             # inspect tracked branches & fetch/push URLs
git fetch --all --prune            # refresh refs and drop deleted remote branches
git branch -vv                     # compare local tracking branches vs remotes
git log --oneline --graph --decorate --all  # visualize the commit graph context
git log -5 --oneline               # quick glance at recent local commits
git diff                           # review staged vs working tree deltas
git diff --stat                    # summary of pending changes
git diff origin/<branch>           # compare local branch to remote tracking tip
git show-branch --more=20          # inspect how branches diverge
```

### Commands to Handle Local Changes Before Syncing

**Stash, stage, or discard edits so your tree is clean prior to pulls/rebases.**

```bash
git add <files>
git add -p                         # interactively stage hunks
git commit -m "<message>"
git commit --amend                 # rewrite the latest commit message/content
git restore <file>                 # discard unstaged edits for a file
git restore --staged <file>        # unstage a file while keeping changes
git checkout -- <file>             # legacy equivalent of git restore
git reset HEAD~                    # move HEAD back one commit (soft reset)
git stash push -m "<reason>"
git stash push --include-untracked -m "<reason>"
git stash list
git stash show -p stash@{0}        # preview stash contents
git stash pop
git stash apply
git stash drop
git stash clear
```

### Branch Preparation & Creation

**Create or switch branches deliberately to avoid editing the wrong ref.**

```bash
git switch <branch>
git switch -c <new-branch>
git checkout <branch>              # legacy equivalent of git switch
git checkout -b <new-branch>
git branch                         # list local branches
git branch -r                      # list remote branches
git branch -a                      # list all branches
git branch --merged                # branches already merged into current
git branch --no-merged             # branches still unmerged
git branch -vv                     # branches with upstream and last commit info
```

### Commands to Pull Remote Updates Cleanly

**Choose the strategy that matches your workflow (merge vs rebase vs fast-forward).**

```bash
git pull --no-rebase               # merge remote changes with a merge commit
git pull --rebase origin <branch>  # replay local commits atop remote history
git pull --ff-only                 # abort if a merge is required (fast-forward only)
git pull origin <branch>           # explicit merge pull for a branch
git fetch origin <branch>
git merge origin/<branch>
git merge --ff-only origin/<branch>
git rebase origin/<branch>
git rebase --autostash origin/<branch>  # stash/unstash automatically during rebase
git reset --hard origin/<branch>   # discard local commits and match remote tip
```

### Commands to Push Safely

**Verify history alignment before publishing local commits.**

```bash
git push origin <branch>
git push --set-upstream origin <branch>
git push --force-with-lease origin <branch>
git push --force-with-lease --no-verify origin <branch>
git push --atomic origin <branch1> <branch2>
git push --dry-run origin <branch> # preview what would be pushed
git push --tags                    # publish local tags
git tag <tag-name>                 # create annotated or lightweight tags first
```

### Commands for Conflict Resolution

**Use these when merges or rebases report conflicts.**

```bash
q   # exit merge/diff tools (e.g., less, mergetool)
git status --short   # list unresolved files
Edit files to resolve conflicts
git diff --name-only --diff-filter=U
git checkout --ours <file>
git checkout --theirs <file>
git add <resolved-file>
git rebase --continue
git rebase --skip
git rebase --abort
git merge --continue
git merge --abort
git mergetool   # launch configured merge tool
```

### Commands to Reconcile Diverged Histories

**Diagnose and recover when local and remote histories disagree.**

```bash
git log origin/<branch>..HEAD --oneline
git log HEAD..origin/<branch> --oneline
git log origin/refactor-2025-08-25..HEAD --oneline
git push origin <branch>
git push --force-with-lease origin <branch>
git cherry-pick <commit>
git revert <commit>
git reset --hard <commit>
git clean -fd
git reflog   # inspect local HEAD movement
git bisect start   # binary search regressions
git bisect bad
git bisect good <commit>
```

### Syncing Local and Remote Git Branches (workflow reference)

1. Verify your working tree

   ```bash
   git status
   git status -sb
   git branch --show-current
   ```

2. Fetch remote updates

   ```bash
   git fetch origin <branch>
   git fetch --all --prune
   git status -sb   # confirm you stayed clean after fetching
   git log --oneline --decorate --max-count=5 origin/<branch>   # review new commits that arrived remotely
3. Switch to (or confirm you’re on) the branch

   ```bash
   git switch <branch>
   ```

4. Rebase local work on top of the remote branch

    ```bash
   git pull --rebase origin <branch>
   # If the pull is rejected because the remote advanced, replay manually
   git rebase origin/<branch>
   # If conflicts occur: fix them, then run
   git status --short              # double-check unresolved files
   git add <files>
   git rebase --continue
    ```

5. Push local commits back to the remote

    ```bash
   git push origin <branch>
   git push --force-with-lease origin <branch>   # only when history was rewritten
    ```

6. Optional cleanup

    ```bash
   git fetch --prune
   git branch --merged
   git branch --no-merged
   git log origin/<branch>..HEAD --oneline   # verify only expected commits remain local
    ```

### Commands to Verify Sync Completion (Post-flight checks)

  **Run these after syncing to confirm you’re aligned with the remote.**

#### Verify

   ```bash
    git status
    git status -sb
    git log origin&sol;branch..HEAD
    git log HEAD..origin&sol;<branch>
    git diff origin&sol;<branch>
    git fetch --all --prune
    git branch -vv
    git remote show origin
   ```
