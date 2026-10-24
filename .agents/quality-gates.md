# Quality Gates & Verification Guide

This document defines the quality gates, validation commands, and verification criteria for `@luism/adt-ts`. All changes must pass these checks prior to merging.

---

## 1. Quick Verification Matrix

Before committing code or submitting a pull request, agents must run and pass the following quality gates:

| Gate                 | Command                   | Tool                        | Purpose                                            |
| :------------------- | :------------------------ | :-------------------------- | :------------------------------------------------- |
| **Lint**             | `pnpm lint`               | Oxlint                      | Fast static analysis and AST-based linting         |
| **Format Check**     | `pnpm format:check`       | Oxfmt                       | Verifies consistent code style and formatting      |
| **Format Fix**       | `pnpm format`             | Oxfmt                       | Auto-formats code to match formatting rules        |
| **Type Check**       | `pnpm typecheck`          | TypeScript (`tsc --noEmit`) | Strict type checking against `tsconfig.json`       |
| **Unit Tests**       | `pnpm test`               | Vitest                      | Executes test suite across all ADTs                |
| **Code Coverage**    | `pnpm coverage`           | Vitest Coverage (v8)        | Evaluates statement, branch, and function coverage |
| **Full Pre-flight**  | `pnpm check && pnpm test` | Combined                    | Composite gate required by CI                      |
| **Build Validation** | `pnpm build`              | Rslib (`@rslib/core`)       | Validates dual ESM/CJS build and `.d.ts` emit      |

---

## 2. Command Details & Workflows

### Static Analysis: Oxlint

```bash
# Run lint check
pnpm lint

# Automatically fix fixable issues
pnpm lint:fix
```

Configuration is stored in `.oxlintrc.json`. Do not disable lint rules without documented rationale.

### Formatting: Oxfmt

```bash
# Verify formatting without altering files
pnpm format:check

# Format all files in place
pnpm format
```

Configuration is defined in `.oxfmtrc.json`.

### Type Checking: TypeScript

```bash
pnpm typecheck
```

Executes `tsc --noEmit` under strict mode. All public types, generic constraints, and inference boundaries must typecheck cleanly without using `any` unless explicitly justified in low-level internals.

### Test Runner: Vitest

```bash
# Run all tests once
pnpm test

# Run tests with coverage reporting
pnpm coverage
```

Unit test files reside alongside code in `src/**/__tests__/*.test.ts` or `src/**/*.test.ts`.

### Build Verification: Rslib

```bash
pnpm build
```

Generates artifacts in `dist/`:

- `dist/esm`: Modern ECMAScript modules + TypeScript declaration files (`.d.ts`).
- `dist/cjs`: CommonJS modules + CommonJS declaration files (`.d.cts`).

---

## 3. Pre-PR Checklist for Agents

Agents must verify the following checklist before raising a pull request:

- [ ] `pnpm format:check` passes with zero discrepancies.
- [ ] `pnpm lint` passes with zero warnings or errors.
- [ ] `pnpm typecheck` compiles cleanly.
- [ ] `pnpm test` passes 100% of test cases.
- [ ] `pnpm build` completes and outputs valid artifacts into `dist/`.
- [ ] If user-facing package behavior was modified, a changeset was added in `.changeset/<slug>.md`.
