# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Added

- **`crawl.documentLinkPatterns`** — regex array (validated by the existing
  `validRegex` Ajv keyword) matched against `URL.pathname`. Matching links
  are skipped at enqueue time inside `discover.mjs`'s
  `transformRequestFunction` and the sitemap-seed loop, so non-HTML
  document URLs never reach Crawlee's `page.goto` (which would otherwise
  spend the full `requestHandlerTimeoutSecs` budget rendering a binary
  before retrying 3× and dropping it). Default ships strict — covers
  document / archive / installer / media / e-book / design-binary /
  data-file extensions across 8 regex families. Skipped count surfaces
  alongside `outOfScopeLinkCount` and `excludedByPatternCount` in
  `inventory-metadata.json` as `excludedByExtensionCount`.

### Changed

- **Behaviour change (DEFAULTS-only, schema-additive)**: existing audit
  configs that previously crawled `.pdf` / `.docx` / `.zip` / `.mp4` etc.
  URLs as page-equivalents now silently exclude them. To restore prior
  behaviour, set `crawl.documentLinkPatterns: []` in the site config.
  Driven by the AU dogfood (2026-05-02) where 7 broken document links
  cost ~27s of wall time per audit before being dropped from inventory.
  On large client sites with hundreds of document references this could
  10× the discover stage; the strict default is the safer ship for the
  v1.0 toolkit's primary auditor population.

### Fixed

- **Crawlee/PlaywrightCrawler hang on remote pages lacking `<h1>` or
  `<link rel="canonical">`** — root-caused via 2026-05-02 dogfood against
  UW's Accessible University demo
  (`projects.accesscomputing.uw.edu/au/before.html`). The previous CHANGELOG
  framing as "localhost fixtures only" was partially falsified: the dogfood
  surfaced a distinct second hang in `discover.mjs` where
  `page.setDefaultTimeout(requestTimeoutSecs * 1000)` coupled per-locator
  auto-wait to the outer 90s handler budget, so each
  `.first().textContent()` (h1) and `.getAttribute()` (canonical) on a
  missing element burned the full budget; Crawlee reclaimed the request as
  failed and retried infinitely. Bites the toolkit's exact target population
  — sites being audited for accessibility issues, often missing one or
  more of those elements. Fix in `src/commands/discover.mjs`: replaced the
  six locator-based capture queries with a single `page.evaluate` running
  `document.querySelector*` in-browser (no auto-wait; one CDP round-trip
  per page). The pre-existing localhost-fixture mystery hang remains
  unsolved and distinct — bisect evidence preserved in the
  `Layer 4 follow-ups` entry below. See `output/au-run-1/AU-DOGFOOD-REPORT.md`
  for the full diagnostic.
- **`wcag-em-summary.json` `examples[]` mislabelled cantTell entries as
  failure offenders** — when an SC's outcome was `failed`, the bucket
  surfaced `incompleteDetail` entries from negative-control pages (or from
  the same page) inside the same `examples[]` array as real violations,
  making clean pages look like they had a finding they did not. Fix in
  `src/lib/wcag-em-summary.mjs`: bucket now tracks `violationExamples`
  and `incompleteExamples` separately and the emitter composes the
  output `examples[]` based on outcome (`failed` → violations;
  `cantTell` → incompletes). Output shape is unchanged; semantics are
  now correct per EARL outcome and consistent with ADR-0007's
  documented strict per-outcome contract.
- **Stale `warnSchemaAcceptedRuntimeIgnored` warning for
  `reporting.reporters`** — the guard was never removed when Layer 4
  shipped the `runReporters` runtime, so every audit emitted a misleading
  `warn` entry. Removed from `summarize.mjs`; companion narrative comment
  in `scan.mjs` updated.

### Layer 4 follow-ups

- **Crawlee/PlaywrightCrawler hang on localhost fixtures** — first
  investigated during R9; revisited during the v2 audit with refined
  diagnosis. Raw Playwright `page.goto` against the fixture server
  loads in <250 ms but `PlaywrightCrawler.requestHandler` consistently
  times out at the configured `requestHandlerTimeoutSecs` × retries on
  the same URL — even though instrumented probes confirm the handler
  enters and passes `page.title()` successfully. Mitigations ruled out:
  `CRAWLEE_STORAGE_DIR` per-test isolation; `Connection: close`
  server-side; scope strategy (`same-origin` vs `same-hostname`);
  sitemap seeding; and (v2 audit) `useSessionPool: false`,
  `browserPoolOptions.retireBrowserAfterPageCount: Infinity`,
  `persistCookiesPerSession: false`. v2 bisect: a hand-rolled standalone
  `PlaywrightCrawler` with the EXACT discover.mjs handler logic copied
  verbatim crawls all 5 fixture pages in 991 ms — so the hang is
  somewhere in `discover.run`'s invocation path (not Crawlee itself,
  not the handler, not the fixture). Closest upstream symptom match:
  apify/crawlee#2785. Next experiment is to progressively replace
  `discover.run`'s wrapping code with the working standalone setup
  until the boundary that triggers the hang is identified. Two e2e
  tests blocked behind this hang ship as `test.skip` placeholders:
  - `test/e2e/reporters-smoke.test.mjs` — full-audit reporter pipeline
    smoke (still validated end-to-end via R3-R7 unit tests against
    synthetic summary inputs and via `test/e2e/reporters-html-axe.
test.mjs` for the HTML reporter's own a11y).
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

### Security

- HTML reporter strips Unicode bidirectional override / isolate
  formatting characters (U+202A-U+202E, U+2066-U+2069) from rendered
  output. Defends `summary.html` against Trojan Source-style visual
  spoofing (CVE-2021-42574) where attacker-controlled axe rule
  metadata could embed bidi codepoints to mask the real content from
  a human auditor. HTML-entity escaping is insufficient because the
  browser decodes the entity and re-applies the bidi behaviour;
  stripping is the correct mitigation.
- JUnit reporter strips XML 1.0-illegal control bytes (0x00-0x08,
  0x0b, 0x0c, 0x0e-0x1f) from CDATA payloads. Mirrors the discipline
  already applied to attribute context. Without this fix, axe-captured
  `outerHTML` containing a NUL byte would produce a JUnit XML the
  strict parsers in CI consumers (Jenkins, GitLab, jUnit XML schema
  validators) reject, dropping the entire test report.

### Fixed

- HTML reporter impact-color classes (and the `.tool-banner` subtitle)
  meet WCAG 2.1 AA 4.5:1 contrast in both light and dark `prefers-color-
scheme` modes. Pre-fix, 5 of 10 (impact × scheme) combinations failed
  — most severely `.impact-minor` on dark background at 2.5:1, with
  `.tool-banner` failing identically. The dark-mode `@media` block now
  overrides the four impact-color classes plus `.tool-banner` with
  brighter hues that pass 4.5:1 on `#121212`; `.impact-null` shifts
  from `#888` (3.6:1 on white) to `#767676` (4.5:1 on white). Locked
  by a new e2e regression guard at `test/e2e/reporters-html-axe.test.
mjs` that runs `@axe-core/playwright` against the rendered reporter
  in both color schemes.

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
