# Creating a New Branch from a Previous Commit

This quick reference expands on the basic workflow for branching from an older commit by providing additional context, validation steps, and follow-up commands.

## 1. Identify the target commit

```bash
# Inspect history and copy the commit hash you want to branch from
$ git log --oneline --graph
```

If you know the branch but not the exact commit, you can shorten the history output:

```bash
# Show only the most recent 20 commits on the current branch
$ git log --oneline -20
```

## 2. Create the new branch pointing at that commit

```bash
# Replace <commit> with the commit hash and <new-branch> with your desired branch name
$ git branch <new-branch> <commit>
```

Alternatively, create and switch in one command:

```bash
$ git switch --create <new-branch> <commit>
```

## 3. Verify the branch tip

```bash
# Confirm that the new branch starts at the intended commit
$ git log --oneline --decorate --graph HEAD~3..HEAD
```

Use `git status` to make sure you have no stray changes before continuing work.

## 4. Push the new branch to the remote

```bash
# First checkout the branch if you created it without switching
$ git switch <new-branch>

# Push to origin and set upstream tracking
$ git push -u origin <new-branch>
```

## 5. Continue development

Now you can make changes, commit them, and open pull requests from the branch. To keep the branch up-to-date with the base branch, periodically rebase or merge as appropriate:

```bash
# Example: rebase onto main
$ git fetch origin
$ git rebase origin/main
```

Remember that rebasing rewrites history, so coordinate with teammates if the branch is shared.