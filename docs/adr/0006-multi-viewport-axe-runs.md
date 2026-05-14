# 0006. Multi-viewport axe runs

- Status: accepted
- Date: 2026-04-19
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions; symbol-first citation rule),
  ADR-0005 (fail fast on config; shares the `defineHidden` mechanism)

## Context and Problem Statement

v0.3 scans every sampled URL once, at a single viewport
(`config.scan.viewport`, singleton). Several WCAG 2.1 + 2.2 success
criteria are **viewport-conditional** — notably SC 1.4.10 (Reflow), SC
1.4.4 (Resize Text), SC 1.4.12 (Text Spacing), and orientation-dependent
failures. A single-viewport pass cannot find defects that only manifest
below a particular width. The WCAG-EM "structured sample" practice
explicitly names viewport variety as a sampling dimension.

This version introduces a viewports dimension. The open design question is
**how much concurrency the toolkit should attempt across that
dimension**. axe-core is CPU-bound; Playwright contexts are cheap per
viewport but share browser process memory; CI runners commonly cap at
2 vCPU. A naive "N viewports × M URL-concurrency" cross-product
multiplies resource consumption by the viewport count and risks OOM on
CI, eliminating the toolkit's CI-friendly-by-default positioning.

We want a rule — not a tunable — so that default behaviour is
predictable and auditors who know their runner can opt into more
parallelism later without re-deciding the principle.

## Decision

**Sequential viewports; URL concurrency lives inside a viewport; no
viewport-level parallelism in v1.0.**

Four aspects of the decision, in dependency order:

### 1. Viewport resolution and default set

`src/lib/viewports.mjs` exports `resolveViewports(config, logger?)` and
`DEFAULT_VIEWPORTS`. Precedence:

1. `config.scan.viewports` if present and non-empty → user wins.
2. Legacy `config.scan.viewport` singleton if present → wrap as
   `[{id:'legacy', ...viewport}]` and emit a one-shot deprecation
   warning via the injected logger.
3. Otherwise → `DEFAULT_VIEWPORTS`.

`DEFAULT_VIEWPORTS` is intentionally minimal:

| id        | width | height | Rationale                                                        |
| --------- | ----- | ------ | ---------------------------------------------------------------- |
| `desktop` | 1280  | 800    | Representative desktop; CI-stable; axe-core tested at this size. |
| `reflow`  | 320   | 800    | SC 1.4.10 reflow baseline.                                       |

Mobile (e.g. 375×667) and tablet (768×1024) are **not** default — a real
WCAG-EM audit should sample them explicitly via `scan.viewports`, and
adding them by default would silently double or triple scan time for
users who want only desktop + reflow. A future version may revisit this once the
reporter-side determinism contract is settled.

### 2. Loop ordering — outer viewport × inner URL

Both `scan.mjs` (`ScanLoop` anchor) and `scan-processes.mjs`
(`ProcessLoop` anchor) wrap the existing URL / process iteration in an
outer viewport loop:

```
for (const vp of resolveViewports(config, logger)) {
  for (const url of sampleUrls) { ... }     // scan.mjs
  for (const processDef of processes) { ... } // scan-processes.mjs
}
```

The ordering gives us three invariants:

- **Deterministic output ordering** — every `desktop` result appears in
  `axe-results.json` before every `reflow` result. Report diffs between
  runs remain stable even if URL enumeration order shifts.
- **Per-viewport retry budget** — an attempt failure on URL X at
  `desktop` does not borrow from URL X's `reflow` retry budget. Each
  viewport has an independent reliability accounting.
- **Single active browser-context per moment** — because the inner URL
  loop still creates a fresh Playwright context per attempt, outer
  viewport adds one more layer of iteration without adding concurrency.

The flipped ordering (outer URL × inner viewport) was considered and
rejected: output becomes URL-major (less useful for reporter diffing),
and a URL that fails catastrophically at viewport 1 still consumes the
retry budget for viewport 2 before the next URL gets a chance.

### 3. Result and artefact shape — `viewport: vp.id` everywhere

- Every entry in `axe-results.json` and `process-results.json` includes
  a `viewport` field carrying `vp.id`.
- Every screenshot filename uses the pattern
  `${fileSafeFromUrl(url)}__${vp.id}.png` (scan) or
  `${fileSafeFromUrl(startUrl)}__${processDef.name}__${state}__${vp.id}.png`
  (scan-processes). Reuses the `buildScreenshotPath` helper in
  `scan.mjs` and the inline construction in `process-runner.mjs`'s
  `screenshot` dispatch case.
- Every structured log entry that names a URL also names the viewport
  (`{url, viewport: vp.id, ...}`).

### 4. Per-URL overrides stay out of this ADR — deliberately

Per-URL axe overrides (`scan.axe.overrides[]`) landed in the same release
and mutate the same `scan.mjs` file, but they are **a separate design
concern**: overrides affect **AxeBuilder chain construction**, not
viewport concurrency. Conflating the two in one ADR would blur the
boundary between "how many times do we visit each URL" (this ADR) and
"what axe rules do we run per URL" (inline design).

Per-URL override design detail lives at the symbol level:
`findMatchingOverride` and `applyAxeOverride` in `src/lib/axe-utils.mjs`
carry the precedence rule (**first match wins**) and the
replace-if-defined merge contract (**`hasOwnProperty.call(override,
key)` as the detection predicate, so `runOnly: null` clears rather than
inherits**) in their JSDoc. An inline NOTE at the scan.mjs
`AxeBuilderChain` anchor cross-references the two helpers. This ADR's
narrow scope matches ADR-0005's pattern (one coherent principle per
ADR).

## Consequences

- **Behaviour change v0.3 → v1.0**: the default scan for users with
  no explicit viewport config shifts from the legacy
  1440×900 singleton to the 1280×800 + 320×800 cross-product. Scan time
  approximately doubles for those users. Users with an explicit
  `scan.viewport` entry retain the singleton (wrapped, with a
  deprecation warn).
- **Screenshot filename encoding edge case**: a URL path containing the
  literal substring `__<vp.id>` could in principle collide with the
  viewport suffix separator. Low likelihood in practice (URL paths
  rarely carry `__desktop`, `__reflow`, or `__legacy`); documented
  rather than mitigated in v1.0. Future work could move to a non-
  collidable separator.
- **CI runtime budget**: doubled wall-clock scan time is the main cost.
  `crawl.requestDelayMs` gives a throttle lever if the
  target site's rate limits need respecting; concurrency tuning stays a
  v2.0 agenda item.
- **Future viewport-level parallelism** (v2.0 candidate): would
  require a reporter-side determinism contract (stable ordering
  independent of completion order) and a per-viewport browser-context
  pool. Out of scope for v1.0; the sequential-viewport rule is the
  stable baseline to build on.
- **Programmatic API**: callers constructing a `RunContext` by hand
  must either populate `config.scan.viewports` explicitly or accept the
  DEFAULT_VIEWPORTS behaviour. The legacy-singleton fallback exists
  only for configs loaded via `loadConfig`; a programmatically-built
  ctx with neither field hits the default.

## More Information

- [ADR-0001 — Project conventions](./0001-project-conventions.md)
  (symbol-first citation rule used throughout this ADR)
- [ADR-0005 — Fail fast on config](./0005-fail-fast-on-config.md)
  (shares the `defineHidden` mechanism attached to
  `scan.axe.overridesCompiled` in the compile-at-load commit)
- `src/lib/viewports.mjs` — `DEFAULT_VIEWPORTS` and `resolveViewports`.
- `src/commands/scan.mjs` — `ScanLoop` anchor, `buildScreenshotPath`
  helper, `AxeBuilderChain` anchor (per-URL override integration).
- `src/commands/scan-processes.mjs` — `ProcessLoop` anchor,
  `runOneProcess` (viewport parameter threading).
- `src/lib/process-runner.mjs` — `StepContext.viewport` and the
  screenshot dispatch case's filename suffix.
- `src/lib/axe-utils.mjs` — `findMatchingOverride`, `applyAxeOverride`
  (deliberately out-of-scope for this ADR; design detail inline).
- `CHANGELOG.md [Unreleased]` — follow-ups updated in the
  compile-at-load and multi-viewport commits.
