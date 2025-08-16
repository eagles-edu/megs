

# Git Commands for Tagging
# This command creates an annotated tag named v1.0 with a message "Release version
git tag -a v1.0 -m "Release version 1.0"

# Lightweight tags:
# Essentially a name for a commit like a branch that does not change and does not store extra metadata
git tag v1.0-light

# git tag
# Pushing tags:
# By default, tags aren’t pushed with commits so push them explicitly:
git push origin --tags

# ---------------------------------
# If git is not installed, you can install it using the following command:
# For Debian/Ubuntu-based systems:
# Git, Git LFS, and GitHub CLI
sudo apt update && sudo apt install -y git  # git-lfs

# gh
git lfs install

gh auth login
# Choose: GitHub.com  →  HTTPS or SSH  →  "Login with a web browser"

# a. Make sure Git knows who you are on this machine
git config --global user.name  "Your Name"
git config --global user.email "your_email@example.com"


# (b) OPTIONAL: check if the local clone is shallow (limited history)
git rev-parse --is-shallow-repository
# If "true", you only have partial history. Without access to the old remote,

# (c) Create a new repo on your new GitHub account and wire it up
gh repo create NEW-USER/REPO-NAME --private --source=. --confirm
# (that sets 'origin' to the new repo)

# (d) Push everything
git push -u origin --all
git push origin --tags

# If the repo uses Git LFS
# If you have the large files locally, also do:
git lfs push --all origin

# Want a one-liner for a single repo?
gh repo create NEW-USER/REPO --private --source=. --confirm \
&& git push -u origin --all && git push origin --tags && git lfs push --all origin

# A Git repo/clone is a folder that has a .git/ directory inside.
# A workspace can contain one or many Git repos.
# How to check if your current workspace folder is a clone

# Open a terminal in the folder VS Code Terminal New Terminal and run
# 1) Am I inside a git repo?
git rev-parse --is-inside-work-tree

# 2) Where is the repo’s root folder?
git rev-parse --show-toplevel

# 3) Do I have a remote (likely 'origin')?
git remote -v

# 4) Is this a shallow clone (partial history)?
git rev-parse --is-shallow-repository


git remote -v

# If --is-inside-work-tree prints true and you see a .git/ folder, you’ve got a local clone/repo.
# If git remote -v shows a URL (probably the old GitHub URL), that’s where it used to sync.

# Not a clone? (No .git/ folder)
# No problem—just make it a repo and push it to your new GitHub account.

# in your project folder
git init
git add -A
git commit -m "Initial commit (recovered workspace)"

# Then create and push to a new repo (pick one auth method):
# Using GitHub CLI (easy)

gh auth login                   # sign into your new account
gh repo create NEW-USER/REPO --private --source=. --confirm

# set fetch URL
git remote set-url origin https://github.com/eagles-edu/megs.git

# set push URL explicitly (covers the case a separate pushurl was set)
git remote set-url --push origin https://github.com/eagles-edu/megs.git

# verify
git remote -v

git push -u origin --all
git push origin --tags
# That command wires origin to the new remote automatically.

# if you used Git LFS and have the files locally:
git lfs push --all origin

# (Optional) Quick checks
# Do you you use LFS?
git lfs ls-files   # shows tracked LFS files if any


# Make sure your commits map to your new profile: add any old commit emails to Settings → Emails on the new account:
git log --format='%ae' | sort -u |


gh auth login
# choose: GitHub.com → HTTPS → "Login with a web browser"
# Follow the instructions in the terminal to authorize GitHub CLI with your browser.
# You’ll see a line like: “First copy your one-time code: ABCD-EFGH” and it will open a browser to the device page. Paste that terminal code into the page and continue → Authorize GitHub CLI → done. ✔️ GitHub CLI

# If your browser didn’t open automatically:
https://github.com/login/device


# Open that URL, then paste the one-time code shown in your terminal.
# GitHub  Awesome — since you’re logged in as eagles-edu, let’s publish your local repo and push everything (branches, tags, LFS). I’ll do the single-repo steps first (for ~/Documents/dockerz/vuepy05)

# Publish vuepy05 to your new account
# 0) (once) let Git use GH CLI as your HTTPS credential helper
gh auth setup-git
# (this makes pushes over HTTPS “just work” with your gh login)

# figure out your current branch name
git branch --show-current

# pull the remote default branch and rebase your work on top
git pull --rebase origin main

# resolve conflicts if any, then push normally
git push -u origin --all
git push origin --tags


# If you use Git LFS and have the files locally:
git lfs ls-files && git lfs push --all origin

# 3) Quick sanity checks (optional)
# confirm you're in the right repo
git rev-parse --show-toplevel

# show exactly what Git thinks the origin URL is
git config --get remote.origin.url
git config --get-all remote.origin.pushurl


# After the push, your branches and tags should be live at https://github.com/eagles-edu/vuepy05. If you hit an auth prompt, run once:

gh auth setup-git


#############################################

# create a new repository on the command line
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/eagles-edu/megs.git
git push -u origin main

# or push an existing repository from the command line
git remote add origin https://github.com/eagles-edu/megs.git
git branch -M main
git push -u origin main


# https://github.com/eagles-edu/megs.git


