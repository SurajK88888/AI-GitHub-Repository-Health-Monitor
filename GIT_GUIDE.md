# 🛠️ Professional Git & GitHub Guide

This guide contains the exact procedures for managing repositories, fixing mistakes, and maintaining a clean workflow.

---

## 1. 🔗 Connecting to GitHub (New Project)
Use these steps when you have code locally and want to push it to a *new* GitHub repo.

```powershell
# 1. Initialize git locally
git init

# 2. Add all files (respecting .gitignore)
git add .

# 3. Create initial commit
git commit -m "Initial commit"

# 4. Create a main branch
git branch -M main

# 5. Link to your GitHub Repo
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# 6. Push to GitHub
git push -u origin main
```

---

## 2. 🔌 Disconnecting from GitHub
If you want to stop syncing with a specific GitHub repo but **keep** your local history.

```powershell
# View current remote
git remote -v

# Remove the link to GitHub
git remote remove origin
```

---

## 3. ♻️ The "Fresh Start" (Total Reset)
Use this if your Git history is messy or you have "Submodule/Embedded" errors and want to start zero.

```powershell
# 1. Delete the hidden .git folders (BE CAREFUL)
Remove-Item -Path ".git" -Recurse -Force

# 2. If sub-folders (like frontend) have their own git:
Remove-Item -Path "frontend\.git" -Recurse -Force

# 3. Start over
git init
git add .
git commit -m "Fresh Start"
```

---

## 4. 🧹 Managing Tracking (Files & Folders)

### How to stop tracking a file (but keep it on your PC)
Use this if you accidentally uploaded something like `database.db` or `node_modules` and want to remove it from GitHub.

```powershell
# 1. Add the file/folder to .gitignore first
# 2. Remove from Git index (untrack)
git rm -r --cached folder_name/   # For folders
git rm --cached file_name.txt     # For files

# 3. Commit the change
git commit -m "Stopped tracking unwanted files"
```

---

## 5. ⏪ Managing Commits (Undo/Delete)

### Undo the last commit (Keep your code changes)
```powershell
git reset --soft HEAD~1
```

### Delete the last commit (Discard all code changes)
```powershell
git reset --hard HEAD~1
```

### Change the last commit message
```powershell
git commit --amend -m "New better message"
```

---

## 6. 🛠️ Fixing Common Issues

### "Embedded Repository" Warning
This happens if a subfolder has its own `.git`.
1. Delete `subfolder/.git` folder.
2. `git rm --cached subfolder`
3. `git add .`
4. `git commit -m "Fixed embedded repo"`

### Branch is behind/diverged
If GitHub has changes you don't have:
```powershell
git pull origin main --rebase
```

---
## 💡 Best Practices
1. **Always check status:** Run `git status` before every `git add`.
2. **Atomic Commits:** Commit one feature at a time (e.g., "Added login UI" instead of "Big update").
3. **Branching:** Use branches for new features: `git checkout -b feature-name`.

## Branching - Complete Workflow for branch wise Development

# Step 1. Start from main

git checkout main
git pull origin main

* Why: Always begin from the latest stable code.
* What: Ensures your local main matches GitHub’s main.
* When: Before starting any new phase/feature.
* How: checkout switches branch, pull updates it.

# Step 2. Create a new branch

git checkout -b [branch-name]

* Why: Keeps changes isolated from production-ready main.
* What: Creates a new branch named [branch-name].
* When: At the start of [branch-name] development.
* How: -b both creates and switches to the branch.

# Step 3. Develop [branch-name] features

git add .
git commit -m "feat: complete [branch-name] core functionality"

* Why: Save checkpoints of your work.
* What: add stages changes, commit records them.
* When: After finishing a logical chunk of work.
* How: Use clear commit messages (feat:, fix:, chore:).

# Step 4. Push [branch-name] branch to GitHub

git push -u origin [branch-name]

* Why: Makes the branch visible on GitHub for testing/review.
* What: Uploads your local branch to remote.
* When: Once [branch-name] is ready for testing.
* How: -u sets upstream so future pushes are simpler.

# Step 5. Test & Review [branch-name] (optional)
Run unit tests, integration tests, manual QA.

Optionally open a Pull Request (PR) on GitHub:

Lets you review changes side-by-side.

CI/CD pipelines can run automatically.

Teammates can comment before merging.

# Step 6. Merge [branch-name] into main

After successful testing:

git checkout main
git pull origin main          # update local main
git merge [branch-name]       # merge tested code
git push origin main          # push merged code

* Why: Incorporates [branch-name] into production-ready branch.
* What: merge integrates changes, push updates GitHub.
* When: Only after [branch-name] passes all checks.
* How: Always pull latest main before merging to avoid conflicts.

# Step 7. Clean up (optional)

git branch -d [branch-name]
git push origin --delete [branch-name]

* Why: Keeps repo tidy, avoids clutter.
* What: Deletes local and remote branch.
* When: After merge is complete and no longer needed.
* How: Safe because history is preserved in main.

## 🚀 Best Practices

One branch per phase/feature → keeps history clean.
PRs for merging → adds review + CI/CD safety net.
Meaningful commit messages → helps track progress.
Always test before merging → keeps main stable.










# Important to do
# ---------------------------------------------------------------------
# ---------------------------------------------------------------------

## Before declaring anything complete I will run the full CI suite locally:

# Backend — full CI equivalent
.venv\Scripts\python.exe -m ruff check app/ tests/
.venv\Scripts\python.exe -m mypy app --ignore-missing-imports
.venv\Scripts\python.exe -m pytest tests/ -v

# Frontend — full CI equivalent  
npm run lint
npm run type-check

* This ensures zero surprises when the real CI runs.