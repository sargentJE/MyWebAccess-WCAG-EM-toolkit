# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Added

- **`portal-export` reporter** (`portal-export.json`) — emits the MyAccess
  Portal "canonical-scan" envelope (`scanMetadata` / `summary` / `rawFindings`)
  for direct upload, with no manual transformation. Compliance-affecting
  violations feed `totalIssues`/`distribution`; best-practice and needs-review
  rows are emitted as `manual-review` (`countsTowardCompliance: false`) so the
  compliance score is unaffected. Per-element `instances[]` carry HTML evidence
  and `occurrenceCount === instances.length` (the portal reconciles to the
  instance list). Report-time self-validation `warn`s when a critical/high
  finding lacks `evidence.html`. Added to the `reporting.reporters` enum.
- **`schemas/portal-canonical-scan.schema.json`** — vendored (empirically
  derived) portal contract, validated in
  `test/unit/portal-export-schema.test.mjs` as a regression gate: critical/high
  findings must carry `evidence.html` plus an instance htmlSnippet.
- **`src/lib/axe-artifact.mjs`** — shared `liftRuleSummaries` /
  `liftIncompleteSummaries`, consolidating a helper previously duplicated (and
  diverged: 7-key in `scan.mjs` vs 4-key in `process-runner.mjs`).
- ADR-0016 (incomplete-node evidence).

### Changed

- **axe `incomplete` (needs-review) results now retain condensed
  `{ target, html }` node evidence end-to-end** — scan captures it into
  `incompleteDetail[].examples`, summarize threads it into
  `summary.incompleteFindings[]` (which gain `examples`/`occurrences`/`targets`,
  mirroring grouped findings), and every reporter (html, markdown, junit,
  portal-export) surfaces it. The `incompleteDetail` artefact is a strict
  superset (adds `examples`; `nodesCount`/`firstTarget` unchanged) so ADR-0007's
  F8 reviewable-vs-infra-failure split is unaffected; the `process-runner.mjs`
  detail projection widens from the diverged 4-key copy to the shared
  7-key+examples shape.
- `incompleteFindings` now sort `[impact desc, ruleId asc]` (matching
  `sortFindings`) so html/markdown/junit order needs-review deterministically.

### Fixed

- Markdown reporter's incomplete "Example HTML" is whitespace-collapsed and
  backtick-neutralised, so multi-line / backtick-bearing axe `outerHTML` can no
  longer corrupt the inline code span.

### Roadmap

- Portal contract source-of-truth — replace the empirically-derived
  `portal-canonical-scan.schema.json` with the portal's published schema plus a
  `contractVersion` negotiated at upload, so drift is caught at the boundary
  rather than via a failed upload.
- Per-rule remediation library — seed remediation templates keyed by axe
  `ruleId` so `portal-export` cards arrive pre-populated (the portal's
  "actionable" gate currently needs manual remediation).
- `occurrenceCount` semantics — reconcile/rename the distinct-element count
  (`portal-export`) vs the Σ-`nodesCount` shown in `summary.json`/html/markdown.
- Incomplete-evidence cap — config knob to bound `axe-results.json` on
  incomplete-heavy sites.
- Baseline/regression mode — diff successive audits to surface new and
  resolved findings between runs.
- Plugin API — public extension surface for custom reporters and crawl
  strategies (ADR-0012 scopes the internal-only v1.0 boundary).
- Authenticated SPA crawler — `auth.setupScript` runtime execution
  pending security review (see carry-forward below).
- Localisation — i18n for CLI output and reporter artefacts.

## [1.1.0] - 2026-05-14

### Fixed

- Normalize URLs in summarize grouping stage — process-scan URLs with
  trailing slashes no longer create duplicate findings.
- Propagate axe `incomplete` results to EARL (`earl:cantTell`) and JUnit
  (`<failure type="incomplete">`) reporters. HTML and markdown reporters
  gain an "Incomplete results (needs review)" section.
- HTML report screenshots use descriptive alt text (page URL + viewport)
  instead of generic "Page screenshot". Homepage paths render as
  `hostname homepage` (not `hostnamehomepage`).
- Create `src/types/index.d.ts` barrel — resolves missing types export
  for TypeScript consumers of the programmatic API.

### Added

- `wcag-em-summary.json` emits `notTested` for all WCAG 2.2 SC at or
  below the configured conformance target, providing a complete SC
  matrix for the manual-review backlog.
- EARL JSON-LD includes evaluation-level WCAG-EM metadata wrapper
  (`earl:Evaluation`, `dct:date`, `wcag-em:conformanceTarget`).

## [1.0.0] - 2026-05-14

### Added

- **EARL evaluator identity** — `earl:assertedBy` now includes `foaf:name`
  and `foaf:mbox` from `wcagEm.evaluator` config when non-empty. Toolkit
  identity (`doap:name`, `doap:release`) is preserved alongside. Allows
  EARL consumers to identify both the automated tool and the human
  evaluator who configured the audit. ADR-0009 §5 amended.
- **`crawl.navigationTimeoutSecs`** — integer config field (5–300, default 60) wired to Crawlee's `PlaywrightCrawler.navigationTimeoutSecs`.
  Bounds `page.goto` independently from the request-handler budget
  (`requestTimeoutSecs`). Client sites with slow CDN endpoints or heavy
  server-side rendering can tighten the navigation cap without affecting
  the handler's page-evaluation budget. Default 60 matches Crawlee's
  prior implicit value — zero behaviour change for existing configs.
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
  per page). Confirmed via the 2026-05-09 commit-bisect (recorded in
  `docs/adr/0013-crawlee-localhost-investigation.md`), this same fix also
  resolved the previously-deferred localhost-fixture hang — see the
  separate Fixed bullet below. See `output/au-run-1/AU-DOGFOOD-REPORT.md`
  for the AU-dogfood diagnostic.
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
- **Crawlee/PlaywrightCrawler hang on localhost fixtures (long-deferred,
  now resolved)** — first observed during R9 (Layer 4) and revisited
  during the v2 audit; documented under `Layer 4 follow-ups` while two
  e2e tests (`test/e2e/reporters-smoke.test.mjs`,
  `test/e2e/discover-timeout.test.mjs`) shipped as `test.skip`
  placeholders. The 2026-05-09 commit-bisect (Phase 2 of the P1
  investigation; harness at `p1-bisect.mjs`, untracked) flipped the
  verdict on the 2026-05-03 update note that claimed D2 didn't unblock
  these tests: pre-D2 (`32f27cd`) reproducibly hangs at 60s × 3 runs;
  D2 (`468f5c1`) onwards completes in <2s. The original update note was
  wrong because the test bodies were empty — re-running them passed
  trivially without exercising the hang. D2 (commit `468f5c1`)
  inadvertently fixed both surfaces while addressing the AU-dogfood
  remote-pages hang. Mechanism (CDP message-queue interaction with
  Crawlee's session/queue management when the handler issues many small
  awaits in series) is hypothesised in
  `docs/adr/0013-crawlee-localhost-investigation.md` § Mechanism;
  framework-internals confirmation is Phase 3 work for a future session.
  `test/e2e/reporters-smoke.test.mjs` un-skipped in the same release with
  a real async-spawn-based body exercising all 5 reporters end-to-end (the
  test uses async `child_process.spawn` rather than `spawnSync` to sidestep
  a Node-level deadlock between sync waitpid and the CLI's subprocess
  tree). `test/e2e/discover-timeout.test.mjs` un-skipped with a real
  assertion body; the `crawl.navigationTimeoutSecs` config addition
  (see Added above) provides the missing config surface that the
  original test premise required.
  Bisect intellectual capital migrated from CHANGELOG and the e2e
  file-level comments into the ADR's Bisect history section.
- **`wcagEm.*` config not propagated to `summary.json`** — `summarize.mjs`
  computed the WCAG-EM summary (wcagVersion, conformanceTarget, evaluator,
  criteriaOutcomes) but never attached it to the summary object passed to
  reporters. `summary.json` now includes a `wcagEmSummary` property; EARL
  and HTML reporters can also read `criteriaOutcomes` (previously silently
  `undefined`, breaking `includePasses` and the HTML criteria table).
- **`criteriaOutcomes` field-name mismatch in EARL and HTML reporters** —
  reporters read `c.criterion` but `toWcagEmSummary()` returns entries
  keyed by `sc` (per ADR-0007 §5). Latent bug masked because
  `criteriaOutcomes` never reached reporters until the above fix. Now
  aligned to `sc` in both `earl-jsonld.mjs` and `html.mjs`.

### Layer 3b follow-ups (carry-forward)

- `auth.setupScript` runtime execution — deferred pending an explicit
  security review. Schema validates the field and the runtime emits a
  one-shot `warnSchemaAcceptedRuntimeIgnored` via the shared helper in
  `src/lib/auth.mjs`. Target: a future release that scopes the trust model
  for executing user-supplied scripts in a Playwright context.
- `src/data/act-rule-map.json` exhaustive coverage — the initial seed covers
  the 30 ACT rules most commonly implemented by axe-core 4.11.2; full
  coverage (70+ rules) requires either the ACT CG to publish a JSON
  feed or a DOM-parser dev dep on their HTML implementation report.
  `scripts/refresh-rule-maps.mjs` is scaffolded for the regeneration
  path.
- `tool-identity` propagation into Pino log records — currently the
  stamp appears on emitted artefacts only. Future enhancement:
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

- ~~Crawlee hang blocking smoke + discover-timeout e2e tests~~ — resolved
  in [1.0.0]; see Fixed bullets above.
