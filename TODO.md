# TODO / working board

Operational checklist for active and upcoming work. The **canonical** home for
release-bound deferred work is `CHANGELOG.md` `[Unreleased]` (ADR-0001); this
board is the prioritised working view, kept in sync with it. There are no stray
`TODO`/`FIXME` markers in the source — items here come from the CHANGELOG
roadmap, the Layer-3b carry-forwards, the post-`portal-export` review, and the
2026-06 systematic toolkit review
([docs/reviews/2026-06-toolkit-review.md](docs/reviews/2026-06-toolkit-review.md),
which carries evidence, the full roadmap rationale, and the Sprint 1 plan).

_Last updated: 2026-06-12 (pre-push board accuracy audit: every open item
re-verified against code; Sprint 1 merged to main; docs sprint D1-D6 +
review fix on `docs/guides-sprint` — see CHANGELOG [Unreleased])_

## Docs

- [x] Docs sprint (2026-06 docs review execution): accuracy repairs, three
      guides under docs/guides/, CONTRIBUTING.md, README slim-and-route,
      committed process example + two docs drift-guard tests.
- [ ] Enforce the ADR-0001 coverage floors (70% src/lib, 50% src/commands) as
      an actual CI step — ci.yml's header claimed a check that never existed
      (caught by the docs-sprint post-execution review).
- [ ] schema `$id` advertises `github.com/jamiesargent/...` — not the real
      `sargentJE/MyWebAccess-WCAG-EM-toolkit` remote. Fixing touches Ajv ref
      identity; do as its own change.

## Active

- [x] Push `feat/portal-export-reporter` and open a PR for review.
      _Superseded 2026-06-11: branch chain merged directly to main at Jamie's
      direction after the accuracy-validation gate (see review doc)._
- [x] Re-point the stale roadmap reference in auto-memory (done 2026-06-10
      during the review; the board + review doc are now the canonical record).
- [x] Approve and schedule Sprint 1 "Truthful outputs" (top-cluster plan in the
      review doc: T1-T7).

## Maintenance (time-sensitive)

- [ ] **GitHub Actions Node 24 runtime — deadline 2026-06-16.** Every CI run
      warns that `actions/checkout@v4` / `actions/setup-node@v4` run on
      Node 20; GitHub forces actions onto Node 24 from June 16 and removes
      Node 20 from runners 2026-09-16. Bump to versions supporting Node 24
      (or set the opt-in env), then watch both jobs green.
- [ ] **npm audit: 14 moderate advisories**, all via transitive `ws`
      (uninitialized memory disclosure, GHSA-58qx-3vcg-4xpx); `npm audit fix`
      reports a clean path. Apply, re-run the full gate + e2e (ws sits under
      the crawler/Playwright tree).

## P1 — reliability & contract

- [x] **Execution-health visibility.** Failed pages (`{url, error, violations: []}`),
      failed process states, and pre-scan action failures are recorded in raw
      artifacts but surface in NO report; `samplePagesScanned` counts page-views
      and includes failures, and flows to the portal export. Review C1,
      reproduced end-to-end (probes P1/P2/P4). Fix shape: `summary.executionHealth`
      block rendered by all reporters; counts split pages/page-views. -> Sprint 1 T2.
- [x] **report-builder contract breaks (x2) + starter exporter.** Live v1.1 output
      breaks `evidence-from-toolkit` twice: `samplingMethodNotes: ''` vs Zod
      `min(1)`, and `notTested` absent from the consumer outcome enum. Add the
      commissioned `report-builder-starter` reporter emitting DraftReportSchema
      directly (site-derived ID prefix, synthesized sampling notes, screenshots
      as evidence), with a versioned vendored contract. Review C4. -> Sprint 1 T6.
- [x] **`waitFor` ignores its selector.** process-runner.mjs:213-215 sleeps
      `timeoutMs ?? 500` and never polls `step.selector`; README's SPA guidance
      documents polling that does not exist. Review C5 (probe-confirmed).
      -> Sprint 1 T1.
- [x] **`sample.json` resolves against CWD** (context.mjs:232), ignoring
      `--out-dir` — concurrent/sequential runs from one shell cross-contaminate
      (demonstrated during the review). Move under outDir. -> Sprint 1 T4.
- [x] **Corrupt-artifact hardening.** `readJsonMaybe` treats `SyntaxError` like
      ENOENT (fs-utils.mjs:69-75) and `writeJson` is non-atomic — a corrupt
      `axe-results.json` yields an exit-0 "clean" report (probe P3). Distinguish + warn loudly; temp+rename writes. -> Sprint 1 T3.
- [ ] **Portal contract source-of-truth.** Replace the empirically-derived
      `schemas/portal-canonical-scan.schema.json` with the portal's published
      schema; add a `contractVersion` to the payload, negotiated at upload, so
      drift is caught at the boundary instead of via a failed upload.
      _Review-confirmed with sharper threat model: the portal ingests with zero
      warnings and silently rewrites (`scoreSource`), derives (`fingerprint`,
      `priorityScore`, `manualReviewIssues`) and truncates (2000-char evidence)
      — the risk is silent shadowing, not rejection. Authoritative source:
      portal `backend/src/scans/ingestion/scan-ingestion.types.ts`
      (`canonicalSchemaVersion: 'scan-canonical/v1'` already exists). Partial
      progress (Sprint 1 T5): `reporting.validateExports` now gates emission
      against the vendored copy at write time; the published-schema swap and
      payload `contractVersion` remain (verified absent 2026-06-12)._
- [ ] **`occurrenceCount` semantics.** Reconcile (or rename) the distinct-element
      count emitted by `portal-export` vs the Σ-`nodesCount` shown in
      `summary.json` / html / markdown, so auditors diffing artefacts see
      consistent numbers. _Review-confirmed (probe P4); single-viewport runs
      mask it, multi-viewport runs diverge. Also note render-state dependence:
      hidden carousel slides undercounted `image-alt` on the live AU run.
      Partial progress: the CHANGELOG counts glossary now DOCUMENTS the four
      numbers; the reconcile/rename itself remains (verified divergent
      2026-06-12)._
- [x] **Incomplete-evidence size cap.** Add `reporting.maxIncompleteExamplesPerRule`
      (default generous) applied in `liftIncompleteSummaries`, to bound
      `axe-results.json` on incomplete-heavy sites. _Review-confirmed: cap
      hardcoded at 5 (summarize.mjs:274); live AU run hit 32 occurrences on one
      rule with 5 evidenced._

## P2 — product value

- [ ] **Per-rule remediation library.** Seed remediation templates (summary +
      steps, optional code) keyed by axe `ruleId`, so `portal-export` cards
      arrive pre-populated and the portal's "actionable" gate is met without
      manual writing. Source from Deque help text + standard fixes; surface via
      a `remediation` field on each rawFinding. _Review-confirmed live: the
      portal's `remediation.proposals` slot arrives empty and is preserved._
- [ ] **WCAG SC tag coverage.** Map the rules that currently emit `wcag: []`
      (best-practice / experimental) to SCs where one applies, to satisfy the
      portal's "provide WCAG criteria tags" prompt. _Report-builder side
      mitigated (the starter draft synthesizes the consumer's own
      Best-practice reference when a rule has no SC); the portal-side
      `wcag: []` gap remains._
- [x] **`scoreBasis` in portal export.** `averageScore: 50` shipped with 36 of the 56 A/AA
      SCs notTested and nothing in the payload conveying it (live AU run). Emit
      `{passed, failed, cantTell, notTested, inapplicable}` + `manualReviewIssues`.
      Review C3/C4. -> Sprint 1 T5.
- [x] **Fill portal-consumable evidence fields.** `evidence.failureSummary`
      (axe emits it; artifact lift drops it), `taxonomy.wcagTechniques`
      (always `[]`), `context.pageRegion/elementType`. Non-breaking pass-through
      on the portal side, confirmed live. Review C4. -> Sprint 1 T5.
- [x] **Synthesize `samplingMethodNotes`** from sample-metadata (structured/random
      counts, seed, auto-suggest) when `wcagEm.samplingMethodNotes` is unset —
      the toolkit knows the method; `''` breaks the report-builder. -> Sprint 1 T6.
- [ ] **Feature-aware manual backlog.** Live AU join: backlog covered 8/13
      manual-class barrier categories, missing carousel, modal, data tables,
      abbreviations, link-text quality — all detectable at discover time
      (discover already counts forms/landmarks/search; verified 2026-06-12 it
      still detects none of the missing five). Review C6. _Enabler landed in
      the docs sprint: backlog items are now structured data
      (`buildManualBacklogItems`), so detection-driven items have a clean
      insertion point._

## P3 — polish & tech-debt

- [ ] Drop the `scan.mjs` `liftRuleSummaries` re-export; repoint the widening
      tests at `src/lib/axe-artifact.mjs`. _Review-confirmed (scan.mjs:66)._
- [ ] Add a process-sourced incomplete-evidence end-to-end test (a needs-review
      finding originating from a `process-results.json` state, through to
      `portal-export` / html).
- [ ] Add a cross-reporter consistency test (the same finding's numbers agree
      across `portal-export` vs html / markdown) — would surface the
      `occurrenceCount` divergence above.
- [x] Carry toolkit screenshots into the report-builder chain as typed
      `screenshot` evidence (path + alt) — currently lost. -> Sprint 1 T6.
- [ ] Express notTested SCs in EARL (`earl:untested` exists in the vocabulary;
      OUTCOME_MAP has no key and emit() never asserts them — review C3).
- [ ] Artifact envelope (Sprint 2): runId + timestamps + engine versions +
      config hash on every stage output; strict loader; reports-dir clean
      policy; per-URL override application trace.

## Existing project roadmap (from `CHANGELOG.md` `[Unreleased]`)

- [ ] **Manual-result ingestion (Sprint 3, ADR first).** The audit loop is open:
      manual-backlog.md is write-only and criteriaOutcomes can never progress
      past automation's ceiling. An auditor-editable results file merged by
      summarize (-> combined Step 5 record, `earl:manual` assertions, portal
      cards, report-builder drafts) is the single biggest product unlock.
      Review C6.
- [ ] Baseline/regression mode — diff successive audits to surface new and
      resolved findings between runs.
- [ ] Plugin API — public extension surface for custom reporters and crawl
      strategies (ADR-0012 scopes the internal-only v1.0 boundary).
- [ ] Authenticated SPA crawler — `auth.setupScript` runtime execution, pending
      a security review of executing user-supplied scripts in a Playwright
      context.
- [ ] Localisation — i18n for CLI output and reporter artefacts.

## Carry-forward (from CHANGELOG Layer 3b follow-ups)

- [ ] ~~`src/data/act-rule-map.json` exhaustive coverage (70+ ACT rules)~~
      **Superseded by review finding:** axe-core 4.11.3 natively exposes
      `actIds` on 56/104 rules via `axe.getRules()` — derive the map from axe
      metadata in `scripts/refresh-rule-maps.mjs` instead of expanding by hand,
      and add a CI drift check (map generated against 4.11.2; installed 4.11.3).
- [ ] `tool-identity` propagation into Pino log base bindings (currently stamped
      on emitted artefacts only).

## Consumer-side notes (tracked here until moved to their boards)

- myweb-report-builder: accept or version `notTested` in the outcome enum;
  derive draft finding-ID prefix from site (hardcoded `LE-` today); add a
  draft-mode to `validate:report` (drafts validate against DraftReportSchema).
- myaccess-portal: publish `scan-ingestion.types.ts` as the contract the
  toolkit vendors; consider surfacing the `scoreSource` rewrite as a warning.
