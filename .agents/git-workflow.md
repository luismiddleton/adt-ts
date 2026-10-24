# Git & Pull Request Workflow

This document outlines the git workflow, branch isolation strategy, and pull request conventions for `@luism/adt-ts`.

---

## 1. Worktree Isolation

To prevent collisions with existing unstaged changes or parallel tasks in the main workspace, agents should utilize Git worktrees for branch isolation.

### Creating an Isolated Worktree

```bash
# Fetch latest remote state
git fetch origin

# Create a clean worktree in a sibling folder on a new branch tracking origin/main
git worktree add -b <branch-name> ../<worktree-folder> origin/main
```

### Removing the Worktree Post-Completion

```bash
# Return to main workspace
cd /path/to/main-workspace

# Remove the worktree directory once work is committed & pushed
git worktree remove ../<worktree-folder>
```

---

## 2. Branch Naming Conventions

Branches must adhere to the following taxonomy:

- `feat/<short-description>`: New functional features or combinators (e.g. `feat/task-retry-policy`).
- `fix/<short-description>`: Bug fixes (e.g. `fix/result-unwrap-stack`).
- `docs/<short-description>`: Documentation, guides, or agent operating manuals (e.g. `docs/agents-md-changesets`).
- `refactor/<short-description>`: Internal code refactoring without external API changes (e.g. `refactor/option-tag-representation`).
- `chore/<short-description>`: Build tooling, CI maintenance, or configuration adjustments (e.g. `chore/upgrade-rslib`).

---

## 3. Commit Message Format (Conventional Commits)

Commit messages must follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Allowed Types:

- `feat`: A new feature or public capability.
- `fix`: A bug fix.
- `docs`: Documentation-only updates.
- `test`: Adding or refactoring tests.
- `refactor`: Code changes that neither fix bugs nor add features.
- `perf`: Performance optimizations.
- `chore`: Tooling, build pipeline, or non-production adjustments.
- `ci`: CI configuration and workflow files.

### Examples:

```bash
git commit -m "feat(option): introduce Option.filter combinator"
git commit -m "fix(result): retain original error cause in Result.tryCatch"
git commit -m "docs: add AGENTS.md router and modular topic guides"
```

---

## 4. Pull Request Submission

### Pushing the Branch

```bash
git push -u origin <branch-name>
```

### Creating PR with GitHub CLI (`gh`)

Agents must raise pull requests using `gh pr create`:

```bash
gh pr create \
  --repo luismiddleton/adt-ts \
  --base main \
  --head <branch-name> \
  --title "<type>(<scope>): <clear title>" \
  --body "## Summary
- <bullet points explaining the change>

## Motivation & Context
- <context on why this change is necessary>

## Changeset Status
- [ ] Changeset included in \`.changeset/<slug>.md\` OR
- [x] Not required (reason: documentation / internal test update)

## Verification
- [x] \`pnpm check\` passed
- [x] \`pnpm test\` passed
- [x] \`pnpm build\` passed"
```
