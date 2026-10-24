# Changeset Management & Release Pipeline

This document details the changeset protocol for `@luism/adt-ts`. All changes intended for release must follow this specification.

---

## 1. When to Add a Changeset

| Change Type               | Conventional Commit             | Requires Changeset? | Bump Level |
| :------------------------ | :------------------------------ | :-----------------: | :--------- |
| Breaking API change       | `feat!:`, `fix!:`, `refactor!:` |       **YES**       | `major`    |
| New feature or combinator | `feat:`                         |       **YES**       | `minor`    |
| Bug fix                   | `fix:`                          |       **YES**       | `patch`    |
| Performance improvement   | `perf:`                         |       **YES**       | `patch`    |
| Packaging / bundle fix    | `fix(packaging):`               |       **YES**       | `patch`    |
| Documentation updates     | `docs:`                         |       **NO**        | None       |
| Tests / Test fixtures     | `test:`                         |       **NO**        | None       |
| CI / Workflow adjustments | `ci:`                           |       **NO**        | None       |
| Internal tooling tweaks   | `chore(tooling):`               |       **NO**        | None       |

---

## 2. Agent Changeset Generation Protocol

> [!WARNING]
> **Do NOT run `pnpm changeset` directly from automated scripts or agents.**
> The `changeset` CLI launches an interactive terminal prompt (inquiring about package selection, bump type, and change summary) that blocks or hangs headless execution environments.

### Non-Interactive Direct File Creation

Agents must write a markdown file directly into the `.changeset/` directory:

- **File Path**: `.changeset/<unique-kebab-slug>.md`
  - Example: `.changeset/add-result-try-catch-helper.md`
  - Example: `.changeset/fix-option-unwrap-error-message.md`
- **File Structure**:
  ```markdown
  ---
  "@luism/adt-ts": <major | minor | patch>
  ---

  <type>(<scope>): <concise description of the change>
  ```

---

## 3. Changeset Content Guidelines

### Patch & Minor Changesets

Use Conventional Commit format for the first line. Provide concise context on what changed and why:

```markdown
---
"@luism/adt-ts": minor
---

feat(task): add `Task.parallel` combinator to run multiple tasks concurrently
```

```markdown
---
"@luism/adt-ts": patch
---

fix(result): ensure `Result.tryCatch` retains original error stack trace
```

### Major Changesets (Breaking Changes)

For major version bumps, the changeset description **must** include both a `### Breaking Changes` section and a `### Migration Guide`:

````markdown
---
"@luism/adt-ts": major
---

feat(option): replace `Option.fold` with `Option.match`

### Breaking Changes

- `Option.fold` has been removed in favor of `Option.match` to unify pattern matching across all ADTs.

### Migration Guide

Replace all occurrences of `.fold(onNone, onSome)` with `.match({ none: onNone, some: onSome })`:

```typescript
// Before
const value = opt.fold(
  () => "empty",
  (val) => val,
);

// After
const value = opt.match({
  none: () => "empty",
  some: (val) => val,
});
```
````

````

---

## 4. Automated Release Pipeline Lifecycle

The release process is fully automated via GitHub Actions in [`.github/workflows/release.yml`](../.github/workflows/release.yml):

```mermaid
sequenceDiagram
    autonumber
    actor Contributor as Contributor / Agent
    participant Branch as Feature Branch
    participant PR as Feature PR
    participant Main as main Branch
    participant CI as Release Workflow
    participant VersionPR as "chore: version packages" PR
    participant Registries as npm / JSR / GitHub Packages

    Contributor->>Branch: Commit code + .changeset/<slug>.md
    Branch->>PR: Open pull request
    PR->>Main: Squash & merge PR into main
    Main->>CI: Trigger release.yml (on push to main)
    CI->>VersionPR: changesets/action opens/updates release PR
    Note over VersionPR: Accumulates changesets, runs `pnpm ci:version`, updates CHANGELOG.md
    Contributor->>VersionPR: Review & merge release PR into main
    Main->>CI: Trigger release.yml with published condition
    CI->>Registries: pnpm ci:publish (npm with provenance)
    CI->>Registries: pnpm dlx jsr publish
    CI->>Registries: pnpm ci:publish:github (GitHub Packages)
    CI->>Main: Creates GitHub Releases tag & notes
````

### Pipeline Key Facts:

1. **Accumulation**: Multiple feature PRs with changesets can merge into `main`. The `changesets/action` keeps a single open `chore: version packages` PR updated with all accumulated version bumps and changelog notes.
2. **Atomic Releases**: When a release is desired, merging the `chore: version packages` PR into `main` performs the actual publishing to:
   - **npm**: With provenance (`--provenance`) and `--access=public`.
   - **JSR**: Via `pnpm dlx jsr publish`.
   - **GitHub Packages**: Via `@luism/adt-ts` to `npm.pkg.github.com`.
   - **GitHub Releases**: Automated release notes corresponding to the new Git tag.
