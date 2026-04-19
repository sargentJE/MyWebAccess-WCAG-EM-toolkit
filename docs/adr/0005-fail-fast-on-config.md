# 0005. Fail fast on config

- Status: accepted
- Date: 2026-04-19
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions), ADR-0002 (config is Ajv-validated)

## Context and Problem Statement

v0.3 surfaced configuration problems mid-run. A malformed regex in
`crawl.excludeUrlPatterns` crashed the crawler on the first matching URL,
not at config-load. A missing `playwright install` step manifested as a
Chromium launch failure deep inside stage 3 (scan). A typo in `scope.mode`
let the crawler run in a nonsense mode and emit empty results. Every case
cost the user time they didn't need to spend — "why did the scan die"
instead of "fix your config".

Layer 2 **narrows** this class of failure for the v0.3 bug list —
mechanism 2 below documents which regex-bearing schema fields are fully
compile-at-load today and which are only validated (Layer 3 completes
the story). We want one coherent story — a principle, not a grab-bag of
checks — that future maintainers can extend in Layer 3+ without
re-deciding the philosophy.

## Decision

**Fail fast on config.** Every configuration problem the toolkit can
detect before stage 1 must be detected before stage 1. Four layered
mechanisms, each catching a narrower class of error:

### 1. Ajv 2020 + better-ajv-errors (from ADR-0002)

Structural validation at config-load. Human-readable error output
includes the JSON pointer, received value, and closest matching schema
alternative. Runs in `src/lib/validate-config.mjs:assertValidConfig` via
`src/lib/context.mjs:buildContext` before any command's `run()` body
touches the filesystem.

Layer 2 also tightens the `name` field to `"pattern": "\\S"` so
whitespace-only names (`"   "`) are rejected at load — closing the one
gap where the retired v0.3 imperative validator was stricter than Ajv.

### 2. Custom `validRegex` keyword

Defined by the `validRegex` custom Ajv keyword in
`src/lib/validate-config.mjs`. Compiles every regex-typed string at
validation time. Bad regex source strings produce a validation error at
config-load with the exact offending pattern in the message; they never
reach the crawl path.

Currently attached at three schema fields (line numbers are supplementary
navigation — the authoritative reference is the symbol form):

| Schema location (symbol-first) | Schema line | Compiled at load? |
|---|---|---|
| `crawl.excludeUrlPatterns[]` — `validRegex: true` | 59 | **yes** (mechanism 3) |
| `scan.axe.overrides[].urlPattern` — `validRegex: true` | 212 | no (deferred to Layer 3) |
| `processes[].actions[].urlPattern` — `validRegex: true` | 371 | no (deferred to Layer 3) |

All three are *validated* on load; only the first is *compiled* on load.
Expanding compile-at-load to the other two is tracked as a Layer 3
addition to this ADR when `scan.axe.overrides` and `processes.actions`
are wired into the crawl/scan hot paths.

### 3. Compile-at-load attachment (this ADR's new work)

`src/lib/context.mjs` attaches `config.crawl.excludeUrlPatternsCompiled`
as a `RegExp[]` after Ajv passes. The attachment goes through the
`defineHidden` helper (also in `context.mjs`), which codifies the
descriptor shape (`enumerable: false`, `writable: false`,
`configurable: true`) in one place. Hot paths —
`urlExcludedByPatterns` in `src/lib/urls.mjs`, called from the two
scope-filter sites in `src/commands/discover.mjs` — accept `RegExp[]`
directly and never touch `new RegExp(...)`.

Descriptor contract locked by `test/unit/context-compile-regex.test.mjs`
(which asserts the `Object.getOwnPropertyDescriptor` shape directly) and
by `test/unit/smoke.test.mjs` for the companion `preflightRan` flag:

- `enumerable: false` — never serialises into JSON artefacts.
- `configurable: true` — future watch-mode can `delete` + redefine.
- `writable: false` — prevents accidental mutation.
- Every compiled entry must be `instanceof RegExp` (no fallback re-compile).

### 4. Preflight

From ADR-0003 and `src/lib/preflight.mjs`. Checks: config file readable,
output directory writable, Playwright browsers installed (when required).
Runs inside `buildContext` before returning.

Layer 2 also adds `ensurePreflight(ctx)` (co-located in
`src/lib/context.mjs`) and wires it as the first line of every command's
`run(ctx)` body. This is defence-in-depth for programmatic API callers
who construct a `RunContext` by hand rather than via `buildContext`.
`ctx.preflightRan` is a non-enumerable flag that guards against
double-running.

## Consequences

- **Migration surface.** Strict regex validation may reject legitimate-
  but-quirky v0.3 configs. Advice: run
  `node bin/wcag-em.mjs discover --config <file>` against any v0.3 config
  to surface all errors at once; better-ajv-errors prints the exact
  offending pattern.

- **No artefact leakage.** Non-enumerable descriptors on
  `excludeUrlPatternsCompiled` and `preflightRan` keep both fields out of
  JSON-serialised reporter output, logs, and summaries. A future reporter
  can rely on `JSON.stringify(config)` being safe to include verbatim.

- **Programmatic API parity.** `runAudit({ configPath })` and direct
  `run(ctx)` invocations inherit all four mechanisms because
  `ensurePreflight` is idempotent — the flag short-circuits after the
  first check.

- **Layer 3 watch-mode constraint.** `writable: false` on the compiled
  array means any future watch-mode (hot-reload on schema change) must
  `delete ctx.config.crawl.excludeUrlPatternsCompiled` followed by a
  fresh `Object.defineProperty`. The descriptor is `configurable: true`
  specifically to permit this; the constraint is deliberate.

## More Information

- [ADR-0001 — Project conventions](./0001-project-conventions.md) (the
  husky + gen-types wiring lives there; not in this ADR's scope)
- [ADR-0002 — Config is Ajv-validated](./0002-config-is-ajv-validated.md)
- [ADR-0003 — Commander CLI](./0003-commander-cli.md)
- `schemas/config.schema.json` — the three `validRegex` attachments on
  `crawl.excludeUrlPatterns[]`, `scan.axe.overrides[].urlPattern`, and
  `processes[].actions[].urlPattern`
- `src/lib/validate-config.mjs` — custom `validRegex` Ajv keyword
- `src/lib/context.mjs` — `buildContext`, `ensurePreflight`,
  `defineHidden`, and the `CompileRuntimeFields` attach site
- `src/lib/process-runner.mjs` — exported `DISPATCH_ACTIONS` and the
  schema ↔ dispatch invariant locked by
  `test/unit/process-runner-invariant.test.mjs`
- `src/lib/preflight.mjs` — preflight check implementation
- `CHANGELOG.md [Unreleased]` — Layer 3 follow-ups for the two
  `urlPattern` fields still waiting on compile-at-load
