# Contributing

## Setup

Node.js >= 22.11.0 (see `.nvmrc`; the repo assumes nvm). Then:

```bash
npm ci
npx playwright install chromium   # needed by the e2e suite + scan stages
```

## The gate

Every commit must pass the full gate locally before it lands:

```bash
npm run lint          # ESLint (flat config; JSDoc required on exports)
npm run typecheck     # tsc over JSDoc types (strict, checkJs)
npm test              # unit suite (node:test)
npm run test:e2e      # pipeline e2e against local fixture servers
npm run format:check  # prettier, markdown included
```

`npm run test:coverage` reports per-module coverage; the project targets
70% line coverage on `src/lib` and 50% on `src/commands` (ADR-0001) —
check the report when touching those trees (CI does not yet enforce the
floors automatically). A husky pre-commit hook regenerates
`src/types/config.d.ts` from the config schema — commit the regenerated
file when the schema changes.

## Conventions

The canonical record is [ADR-0001](./docs/adr/0001-project-conventions.md):
ESM-only `.mjs`, JSDoc + `@ts-check` types, Pino logging, Ajv-validated
config, exit codes 0/1/2, Comment Anchors (`SECTION` / `ANCHOR` / `NOTE` /
`LINK`) in source files. Commits follow Conventional Commits with bodies that
explain WHY, not just what; no AI attribution trailers; no emoji in code,
commits, or docs.

Two documentation guards will fail your build by name if skipped: every
committed config in `configs/` must validate
(`test/unit/configs-valid.test.mjs` — register new examples there), and every
config-schema field must appear backticked in
[the config guide](./docs/guides/config-guide.md)
(`test/unit/docs-config-coverage.test.mjs`).

## Making changes

- **Bug fixes**: test first — the failing test and the fix land in the same
  commit so the gate stays green.
- **New config fields**: schema + DEFAULTS + config-guide line + regenerated
  types, in one commit (the guards enforce most of this).
- **New reporters**: the contract and registration touchpoints are documented
  in [ADR-0008](./docs/adr/0008-pluggable-reporters.md); note the registry is
  internal API per [ADR-0012](./docs/adr/0012-extensibility-is-internal.md).
- **Architecture decisions**: anything that changes how the toolkit works
  gets an ADR — process and numbering in [docs/adr/README.md](./docs/adr/README.md).
- **CHANGELOG**: notable changes go under `[Unreleased]`
  (Added/Changed/Fixed), the canonical home for deferred work per ADR-0001.

## Releases

Manual, maintainer-driven; policy in
[ADR-0015](./docs/adr/0015-publish-and-deprecation-policy.md).
