# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Layer 4 follow-ups

- **Crawlee/PlaywrightCrawler hang on localhost fixtures** — investigated
  during R9; raw Playwright `page.goto` against the fixture server loads
  in <100 ms but `PlaywrightCrawler.requestHandler` consistently times out
  at 30 s × 3 retries on the same URL. Independent of `CRAWLEE_STORAGE_DIR`
  isolation, `Connection: close`, scope strategy (`same-origin` vs
  `same-hostname`), or sitemap seeding. Two e2e tests blocked behind this
  hang ship as `test.skip` placeholders with explanatory comments:
  - `test/e2e/reporters-smoke.test.mjs` — full-audit reporter pipeline
    smoke (still validated end-to-end via R3-R7 unit tests against
    synthetic summary inputs).
  - `test/e2e/discover-timeout.test.mjs` — behavioural replacement for
    the deleted `test/unit/discover-timeout.test.mjs` source-text test.

### Layer 3b follow-ups (carry-forward)

- `auth.setupScript` runtime execution — deferred pending an explicit
  security review. Schema validates the field and the runtime emits a
  one-shot `warnSchemaAcceptedRuntimeIgnored` via the shared helper in
  `src/lib/auth.mjs`. Target: a later layer that scopes the trust model
  for executing user-supplied scripts in a Playwright context.
- `src/data/act-rule-map.json` exhaustive coverage — the R1 seed covers
  the 30 ACT rules most commonly implemented by axe-core 4.11.2; full
  coverage (70+ rules) requires either the ACT CG to publish a JSON
  feed or a DOM-parser dev dep on their HTML implementation report.
  `scripts/refresh-rule-maps.mjs` is scaffolded for the regeneration
  path.
- `tool-identity` propagation into Pino log records — currently the
  stamp appears on emitted artefacts (R13) only. Future enhancement:
  inject `tool: TOOL_IDENTITY` into every log-line's base bindings so
  downstream log aggregators can filter by tool version without
  re-parsing the artefact.

## [Layer 4] - 2026-04-30 - Pluggable reporters

### Added

- Pluggable reporter runtime: `json`, `markdown`, `html`, `earl-jsonld`,
  `junit`. Module-private registry in `src/reporters/index.mjs` exports
  only `runReporters(names, summary, ctx)`; reporter modules are
  internal per ADR-0012.
- `src/reporters/_sort.mjs` — deterministic finding-sort helper
  (`[impact desc, ruleId asc]`); every reporter routes findings through
  it for byte-stable, cross-reporter-consistent ordering.
- `src/reporters/_template.mjs` — zero-dep XSS-safe HTML template
  helpers (`text`, `attr`, `safeUrl`, `html` tagged template). No `he`
  dep, no DOMPurify; secure-by-default via API design.
- `src/reporters/html.mjs` — HTML report with run-summary table,
  findings-by-WCAG-SC section, findings-by-rule accordion, optional
  passes section. Static CSS only; no dynamic interpolation in
  `<style>` (test-enforced invariant).
- `src/reporters/earl-jsonld.mjs` — EARL JSON-LD output (per-violation
  Assertions, Alfa convention, single-vocab `@context`). Pure reformat
  of existing summary data.
- `src/reporters/junit.mjs` — Pa11y-compatible single-`<testsuite>`
  XML; `cantTell` → `<failure type="incomplete">` so CI breaks on
  ambiguous results.
- `reporting.screenshotFormat` (png|jpeg) and `reporting.screenshotQuality`
  wired through Playwright's `page.screenshot`. Conditional spread
  prevents the Playwright `quality with type=png` rejection.
- `reporting.includePasses` honoured in HTML / EARL / JUnit reporters
  with locked semantics: emits axe `passes` only; `incomplete` always
  shown; `inapplicable` never emitted (volume guard).
- Test fixture harness (`test/fixtures/server.mjs`) generalising the
  inline pattern from `test/unit/sitemap.test.mjs`. Each test gets a
  fresh server instance + tmp out-dir; ephemeral ports prevent
  parallel-run collisions. `__BASE_URL__` substitution in served
  HTML/XML/CSS/JS/JSON/text files.
- `test/e2e/authenticated-scan.test.mjs` integration test —
  `applyAuth.storageState` round-trips end-to-end via Playwright;
  pre-login → 401, post-login → 200. Closes the Layer 3b
  authenticated-scan integration test follow-up.
- `npm run test:e2e` script for end-to-end test runs.
- ADR-0008 (pluggable reporters), ADR-0009 (EARL JSON-LD output).

### Changed

- DEFAULTS at `src/lib/config.mjs` drop `reporting.markdownReport` (the
  field was schema-accepted but never read at runtime; dropping enables
  clean post-merge detection of legacy user configs). The runtime now
  emits a one-shot `warnLegacyAliasResolved` (new helper colocated with
  `warnSchemaAcceptedRuntimeIgnored` in `src/lib/auth.mjs`) when user
  configs explicitly set the deprecated field.
- `package.json` exports narrow: `./reporters/*` removed. Reporter
  modules are internal per ADR-0012.
- `summarize.mjs`'s `summary.json` write + the inline MarkdownReport
  ANCHOR block both delegate to `runReporters(...)`. The four side-
  artefact JSON writes + `manual-backlog.md` writeText remain inline —
  they are analytical artefacts orthogonal to the reporter concept.
- `buildScreenshotPath` accepts an optional `format` parameter so the
  filename extension matches `screenshotFormat` (`.png` vs `.jpg`).

### Removed

- `test/unit/discover-timeout.test.mjs` — superseded by the (currently
  skipped) e2e behavioural equivalent at
  `test/e2e/discover-timeout.test.mjs`.

### Deferred

- See `[Unreleased] / Layer 4 follow-ups` above for the Crawlee hang
  blocking the smoke + discover-timeout e2e tests.
