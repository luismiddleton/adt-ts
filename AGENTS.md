# Agent Operating Manual & Router

This document is the primary operational router and entrypoint for AI coding agents and human contributors interacting with this repository.

---

## 1. Project Overview & Architecture

- **Library**: `@luism/adt-ts`
- **Purpose**: Lightweight, tree-shakable TypeScript library providing Algebraic Data Types (`Option`, `Result`, `Task`, `ADT`).
- **Design Philosophy**: Zero runtime dependencies, functional purity, strict type safety, ergonomic pattern matching.
- **Build System**: Rslib (`@rslib/core`) emitting dual ESM (`dist/esm`) and CJS (`dist/cjs`) outputs with declaration files.
- **Publishing Targets**: Automated multi-registry publishing to **npm** (with Sigstore provenance via OIDC), **JSR**, and **GitHub Releases**.

---

## 2. Topic Router & Operational Navigation

Agents must consult the relevant dedicated guide before initiating tasks:

| Intent / Domain                 | Target Document                                                    | Description                                                                                              |
| :------------------------------ | :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| **API Changes & SemVer**        | [`.agents/semantic-versioning.md`](.agents/semantic-versioning.md) | SemVer 2.0.0 rules, breaking change checklists, and compatibility criteria for TypeScript ADTs.          |
| **Changesets & Releases**       | [`.agents/changesets.md`](.agents/changesets.md)                   | Changeset generation protocols for agents, non-interactive markdown templates, and CI release lifecycle. |
| **Testing & Quality Assurance** | [`.agents/quality-gates.md`](.agents/quality-gates.md)             | Verification commands (`oxlint`, `oxfmt`, `tsc`, `vitest`, `rslib`) and failure remediation.             |
| **Branching, Worktrees & PRs**  | [`.agents/git-workflow.md`](.agents/git-workflow.md)               | Worktree isolation, branch naming conventions, Conventional Commits, and PR submission via `gh`.         |

---

## 3. Core Rules of Engagement for Agents

1. **Verify Before Committing**:
   Always run the complete quality check before finalizing changes:
   ```bash
   pnpm check && pnpm test
   ```
2. **Adhere to Semantic Versioning**:
   Evaluate every public API change against [`.agents/semantic-versioning.md`](.agents/semantic-versioning.md).
3. **Never Block on Interactive Changesets**:
   Do **not** execute interactive `pnpm changeset`. Instead, generate `.changeset/<slug>.md` directly as detailed in [`.agents/changesets.md`](.agents/changesets.md).
4. **Isolate Branches in Worktrees**:
   Avoid working directly on uncommitted or dirty working directories. Follow the worktree workflow in [`.agents/git-workflow.md`](.agents/git-workflow.md).
