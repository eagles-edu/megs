# Syncing a Diverged Branch

If `git pull` stops with “Need to specify how to reconcile divergent branches,” your local history and the remote history contain different commits. Use the checklist below to bring them back together safely.

## 1. Fetch and review

```bash
git fetch origin
git log --oneline --decorate --graph --left-right HEAD...origin/Prototype_BETA_0.0.01
```

- `git fetch` updates the remote tracking branch without touching your working tree.
- The `git log` command shows commits unique to each side so you know what will be replayed.

## 2. Tell Git how to pull

Configure the repository (or your global config) with the pull behavior you want:

- Merge (default, creates a merge commit):

  ```bash
  git config pull.rebase false
  ```

- Rebase (linear history, recommended for feature branches):

  ```bash
  git config pull.rebase true
  ```

- Fast-forward only (fails if histories diverge):

  ```bash
  git config pull.ff only
  ```

Once set, Git remembers the preference so future `git pull` calls work without extra flags.

## 3. Replay remote commits

With the strategy chosen, pull the remote branch explicitly. Rebasing keeps the history clean:

```bash
git pull --rebase origin Prototype_BETA_0.0.01
```

Resolve conflicts as they appear:

```bash
git status
# edit conflicted files
git add <resolved-file>
git rebase --continue
```

To abandon the attempt and restore the previous state:

```bash
git rebase --abort
```

## 4. Finish and push

Verify the branch is aligned and then update the remote:

```bash
git status
git log --oneline --decorate --graph | head
git push --force-with-lease origin Prototype_BETA_0.0.01
```

Use `--force-with-lease` after a rebase so you do not accidentally overwrite someone else’s work.

---
**Expected outcome:** Your local branch now matches `origin/Prototype_BETA_0.0.01`, and subsequent pulls succeed without extra prompts.

## To Force Local to Match Remote (Hard Reset)

Assuming:

Remote is origin

Branch is main (or master or any other branch)

Here's the command:

git fetch origin
git reset --hard origin/main
git clean -fd

🔧 Explanation:

git fetch origin
Gets the latest from remote without changing your working files.

git reset --hard origin/main
Resets your local branch and working directory to match the remote.

git clean -fd
Removes untracked files and directories — cleans up anything not in the repo.

⚠️ DANGER ZONE

This will delete all local changes (committed, staged, unstaged) not in the remote.

Make sure you’re okay losing everything local that’s not in origin/main.

💡 Optional (Force Checkout Remote Branch)

If you want to completely discard the local branch:

git checkout -B main origin/main

This forcibly creates/reset the local main branch to match origin/main.
