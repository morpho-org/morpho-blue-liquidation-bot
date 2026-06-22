# PR Describe

Generate a PR title and description from the current branch diff.

## Workflow

### 1. Gather context

```bash
# Current branch
git branch --show-current

# Base branch (default: main)
git merge-base main HEAD

# Check for existing PR
gh pr view --json number,title,body 2>/dev/null
```

### 2. Analyze changes

```bash
# Commits since divergence from base
git log --oneline main..HEAD

# Full diff against base
git diff main...HEAD
```

Read through the diff carefully. Understand what changed and why.

### 3. Generate PR content

**Title**: Use conventional commits format, under 70 characters:
- `feat: ...` for new features
- `fix: ...` for bug fixes
- `refactor: ...` for refactoring
- `chore: ...` for maintenance
- `docs: ...` for documentation

**Body**: Use this format:

```markdown
## Summary
<1-3 bullet points explaining what changed and why>

## Key changes
<Bulleted list of the notable changes, grouped by area if many>

## Test plan
<How to verify the changes work — tests to run, manual steps, etc.>
```

### 4. Present to user

Show the generated title and body to the user for review.

### 5. Create or update PR

Ask the user if they want to:
- **Create a new PR** via `gh pr create --title "..." --body "..."`
- **Update an existing PR** via `gh pr edit <number> --title "..." --body "..."`
- **Copy to clipboard only** (no PR action)

If creating/updating, push the branch first if needed:
```bash
git push -u origin $(git branch --show-current)
```
