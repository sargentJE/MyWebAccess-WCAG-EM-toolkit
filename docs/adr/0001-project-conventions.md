# 0001. Project conventions

- Status: accepted
- Date: 2026-04-18
- Deciders: Jamie Sargent
- Consulted: the v0.3 `box/` decision records (now superseded by the numbered ADRs in this directory)

## Context and Problem Statement

The v0.3 toolkit was a single-author spike without tests, lint, type checking, CI, an
engine pin, a structured logger, or a canonical commenting style. Promoting it to v1.0
as a best-in-class WCAG-EM-aligned automated accessibility testing toolkit requires a
single, codified convention document so every subsequent PR respects the same bar.

This ADR is the **"higher standard of edits"** reference: every commit in every layer
of the promotion plan must conform to it, and every future change to the project
should cite it.

## Decision

### Runtime

- Node `>=22.11.0` pinned via `package.json` `engines`.
- `.nvmrc` contains `22`; contributors use `nvm use` before working.
- `Object.groupBy`, native `node:test`, and 2023+ ECMAScript features are freely available.

### Language and types

- JavaScript + ES modules only; `.mjs` extension everywhere.
- **No TypeScript migration.** Types come from JSDoc + `// @ts-check` + `jsconfig.json`
  (`checkJs: true`, `strict: true`, `module: "NodeNext"`, `target: "ES2023"`).
- Config types in `src/types/config.d.ts` are **generated** from
  `schemas/config.schema.json` by `json-schema-to-typescript`; the generated file is
  committed (pre-commit hook keeps it in sync).
- Exported types for programmatic API consumers are emitted via
  `tsc --emitDeclarationOnly` into `src/types/`; the `exports` map in `package.json`
  uses the dual-export shape (`"types"` alongside `"default"`).

### Validation

- Ajv 2020 + `ajv-formats` + `better-ajv-errors` validates every config at load.
- Custom Ajv keyword `validRegex` compiles user-supplied regex patterns at validation
  time so bad patterns fail at config-load, not mid-crawl.
- Validation errors are human-readable (better-ajv-errors formatting) and include the
  offending file path, JSON pointer, and received value.

### CLI

- Commander 12 at `bin/wcag-em.mjs`; shebanged `#!/usr/bin/env node`.
- Subcommands: `discover`, `sample`, `scan`, `scan-processes`, `summarize`, `audit`.
- Global flags: `--config`, `--out-dir`, `--log-level`, `--verbose`, `--quiet`.
- Exit codes: `0` clean, `1` runtime error, `2` findings exceeded
  `reporting.failOnFindings` threshold. Pa11y-compatible.
- Every command starts with a preflight check (config valid, Playwright browsers
  installed, output dir writable); preflight failure exits `1` with a clear message.

### Logging

- Pino 9 via `src/lib/logger.mjs`; `pino-pretty` when TTY, JSON when piped.
- Findings summary is printed to **stdout**; operational events (progress, errors,
  warnings) go to **stderr** — Unix convention.
- Redact list applied to every logger instance: `Authorization`, `Cookie`, `Set-Cookie`,
  `*.password`, `*.token`, `*.secret`, `*.key` (case-insensitive JSON-path globs).

### Lint and format

- ESLint 9 flat config at `eslint.config.mjs`.
- Plugins: `eslint-plugin-n` (Node-specific), `eslint-plugin-jsdoc`.
- Rule `jsdoc/require-jsdoc` with `publicOnly: true` — JSDoc required on every exported
  symbol, optional on internal helpers.
- Prettier 3 with `printWidth: 100`, `singleQuote: true`, `semi: true`,
  `trailingComma: 'all'`, `arrowParens: 'always'`.
- `eslint-config-prettier` turns off ESLint style rules that conflict with Prettier.

### Tests

- `node:test` + `node:assert/strict`. No Jest, no Vitest.
- Unit tests live in `test/unit/<module>.test.mjs` (one per `src/lib/*` or
  `src/reporters/*` module).
- End-to-end tests live in `test/e2e/` and boot a local `http.createServer` fixture
  in `test/fixtures/static-site/` with deliberately-seeded accessibility violations.
- Coverage floor enforced in CI: 70 % line coverage on `src/lib/**`, 50 % on
  `src/commands/**`.
- We **do not re-test axe-core** — it has its own test suite.

### Errors and process lifecycle

- Every command's top level is wrapped so unhandled rejections log via pino and set
  `process.exitCode`.
- `SIGINT` / `SIGTERM` handlers close the Playwright browser and flush pino, exit `130`.
- Per-URL operations use try/catch; one bad page does not kill the scan (failures are
  recorded in the result object's `error` field and the scan continues).

### Architectural Decision Records

- MADR 4.0 in `docs/adr/` — see [ADR-0000](./0000-record-architecture-decisions.md).
- One ADR per architectural decision; PRs that make such changes add or reference an ADR
  in the same commit.

### Commits

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`,
  `ci:`).
- Every commit must leave `npm run lint && npm run typecheck && npm test` green.
- Bulk-format commits (Prettier / lint `--fix`) are recorded in
  `.git-blame-ignore-revs` so `git blame` skips them.

### File-header comments and navigation tags

Every `.mjs` file starts with a module-level JSDoc block and uses
[Comment Anchors](https://marketplace.visualstudio.com/items?itemName=ExodiusStudios.comment-anchors)
tags for in-file navigation. The canonical template is:

```js
// @ts-check
/**
 * @file Short name of module (< 10 words).
 * @module path/to/module
 *
 * @description
 * One to three sentences on what this module is for and when to use it.
 * Mention the stage of the pipeline it belongs to and cross-link peers.
 *
 * @see {@link ../types/config.d.ts} for Config shape
 * @see docs/adr/0007-wcag-em-summary-shape.md for the report contract
 */

// SECTION: Imports
import ...

// SECTION: Constants
// ANCHOR: DEFAULT_VIEWPORTS — desktop + reflow baseline (WCAG 2.1 SC 1.4.10)
export const DEFAULT_VIEWPORTS = [...];

// SECTION: Public API
/**
 * JSDoc on every export.
 * @param {import('../types/config.d.ts').Config} config
 * @returns {Viewport[]}
 */
export function resolveViewports(config) { /* ... */ }

// SECTION: Internal helpers
// NOTE: kept local because it has no reuse outside this file.
function clampToBounds(vp) { /* ... */ }
```

**Recognised tags** (all at-start-of-comment, upper-case, colon-terminated):

| Tag        | Purpose                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `SECTION:` | Top-level navigation divider; one per major block (Imports / Constants / Public API / Internal helpers / etc). |
| `ANCHOR:`  | Named jump-point on a specific declaration of interest.                                                        |
| `NOTE:`    | Informational remark; _why_, not _what_.                                                                       |
| `TODO:`    | Deferred work; must cite an ADR or `CHANGELOG.md [Unreleased]` entry.                                          |
| `FIXME:`   | Known bug; rare, prefer fixing over annotating.                                                                |
| `REVIEW:`  | Flagged for later reviewer attention.                                                                          |
| `LINK:`    | Cross-reference to another file/line; keeps navigation bidirectional.                                          |
| `STUB:`    | Intentional placeholder; must have a matching `TODO:`.                                                         |

JSDoc on **every exported symbol** is mandatory. Internal helpers get JSDoc when
non-obvious.

### Dependency and supply-chain posture

- Runtime dependencies are pinned with caret (`^`) ranges and committed via
  `package-lock.json`.
- CI runs `npm audit --production` as a non-blocking warning step.
- Dependabot / Renovate can be enabled with a weekly schedule; we do not auto-merge.
- Playwright and `@axe-core/playwright` are runtime dependencies (users of
  `wcag-em audit` need them), not devDependencies.

### Privacy and portability

- **No telemetry.** The tool does not phone home.
- **Offline-capable** after the first `npx playwright install`; running the tool
  against local fixtures requires no network.
- **English-only** CLI output in v1.0. Localisation is listed in the v1.1 roadmap
  in `CHANGELOG.md [Unreleased]`.

### Reuse over rewrite

Every existing utility in the v0.3 `scripts/lib/` (and now `src/lib/`) tree is
preserved — moved, renamed, or extended, but not rewritten from scratch. New
utilities are only introduced where the v1.0 research identified a concrete gap.
This respects the audit-method reasoning the original author encoded in each
function and reduces regression risk.

## Consequences

- Every PR cites this ADR by number when asked "why is it like this?".
- Onboarding is one document: read ADR-0001, then the rest of `docs/adr/` in order.
- Deviations are proposed via a new ADR that deprecates or amends this one.

## More Information

- [ADR-0000](./0000-record-architecture-decisions.md) — why we use ADRs.
- Plan: `/Users/jamiesargent/.claude/plans/okay-i-d-like-you-crystalline-beaver.md`
  (the v0.3 → v1.0 promotion roadmap).
