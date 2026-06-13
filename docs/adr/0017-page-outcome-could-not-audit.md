# ADR-0017 — `pageOutcome`: a first-class "could-not-audit" status

## Status

Accepted. Extends the artefact-projection contract in
[ADR-0007](./0007-wcag-em-summary-shape.md) and the execution-health visibility
work that ADR records.

## Context

A 2-hour run against a live Cloudflare-protected site produced a
plausible-looking but partly false audit. Two failure modes shared one root:
the toolkit had **no first-class notion of a page it could not audit**.

- The scan stage discarded the `goto` Response and ran axe over whatever
  loaded. Cloudflare **challenge** interstitials (HTTP 200/403 + a
  `cf-mitigated` header, an "I'm under attack" body) and **empty** documents
  (`about:blank` after a failed navigation) were scanned as real content,
  emitting false findings (e.g. a `meta-refresh` "critical" on the challenge
  markup) into every artefact.
- Four reporters (`portal-export`, `report-builder-starter`, `html`,
  `wcag-em-summary`) **re-read the raw `axe-results.json` /
  `process-results.json`** independently of `summary.json`, so a fix applied
  only in `summarize` would still ship a poisoned portal upload + client draft.

The mirror-image risk appeared once exclusion was added: **excluding pages from
the per-SC verdicts manufactures false _passes_** — a criterion reads `passed`
purely because the page that would have failed it was skipped, and the portal
`averageScore` rises as coverage shrinks. Exclusion without disclosure is the
same plausible-but-false-audit class, relocated.

## Decision

1. **Write the outcome at the write-site, not the read-sites.** `scan.mjs`
   captures the `goto` Response, classifies the landed page
   (`src/lib/page-guard.mjs classifyPageOutcome`), and on a non-`ok` outcome
   records `{ pageOutcome, degradedReason, violations: [] }` instead of running
   axe + screenshot. It **never throws** — Cloudflare returns HTTP 200 so `goto`
   resolves, and throwing would burn a `scan.retries` attempt and mis-bucket the
   page as `pagesFailed`. The process path threads the navigation Response via
   `ctx.lastResponse` (the `goto` and `axe` steps are separate `runStep` calls)
   so a process step that lands on a challenge is classified the same way.
2. **Classify header/status-primary.** `cf-mitigated` is authoritative (host-
   independent); an interstitial **title is corroborating only** and the weaker
   title+status heuristic is gated to a host allowlist (`scan.challenge.hosts`,
   defaulting to the audited host) so a charity blog post that legitimately
   contains "just a moment" stays `ok`. `empty` is content-thinness only — a
   404/500 serving real markup stays `ok`.
3. **Consume through one shared predicate.** `src/lib/scan-results.mjs` exports
   `viewStatus` (`auditable｜errored｜challenge｜empty｜redirect-duplicate`),
   `isAuditableView`, and `viewIdentity`. Every raw-artefact consumer — the
   grouping (`group-findings.mjs`), `buildExecutionHealth`, the WCAG-EM
   inversion, and the portal/report-builder/html reporters — routes through it.
   A source-text invariant
   (`test/unit/scan-results-consumers-invariant.test.mjs`) fails the build if a
   future reader forgets the guard.
4. **Name it `pageOutcome` on results, never `outcome` on findings rows** —
   `earl-jsonld.mjs` and `junit.mjs` already read `f.outcome` as a control field
   and would silently downgrade real violations.
5. **Disclose the coverage gap.** `toWcagEmSummary` emits an
   `automatedCoverage` object (`status`, `pagesSelected`/`pagesAudited`/
   `pagesExcluded`, `scopeExclusions`) and `buildExecutionHealth` adds
   `pagesUnauditable`/`challengePages` + per-state `processStepFailures`. A
   per-SC denominator is deliberately **not** synthesized: an excluded page's
   axe never ran, so which criteria it would have touched is unknown — the
   honest statement is run-level.
6. **§0a challenge access.** A bounded `scan.challenge.waitForAutoSolveMs`
   (default 0) re-checks page state after a wait, for managed challenges that
   auto-clear. The WAF bypass header reuses `auth.extraHTTPHeaders` and
   `cf_clearance` reuses `auth.storageState` — no new auth surface. A page that
   stays challenged routes to the manual-review queue, never to findings.

## Consequences

- `axe-results.json` / `process-results.json` entries gain optional
  `pageOutcome` / `degradedReason` fields; a non-`ok` entry carries
  `violations: []`. Legacy artefacts (no `pageOutcome`) classify as `auditable`,
  so the change is backward-compatible.
- **Output changes (breaking for diff-based consumers):** challenge/empty pages
  no longer contribute findings, no longer increment `pageViewsScanned` /
  `samplePagesScanned`, and no longer flip SC verdicts; `executionHealth` gains
  `pagesUnauditable`/`challengePages`/`processStepFailures`; `wcag-em-summary`
  gains `automatedCoverage`. Recorded under `CHANGELOG.md [Unreleased]`.
- New config `scan.challenge.{waitForAutoSolveMs,hosts}` (schema + DEFAULTS +
  config guide + regenerated `config.d.ts`).
- The §5 contract-safety checklist is enforced by
  `test/unit/page-outcome-contract.test.mjs`: a synthetic challenge entry
  carrying fake violations whose rule-id is absent from `summary.findings`
  produces zero findings in `portal-export.json` + `report-builder-draft.json`
  and no SC flip — proving the skip works at the raw read sites, not by
  empty-array luck.

## Out of scope

- The actual Cloudflare WAF rule and the operational re-run (Track B) — this ADR
  ships only the config surface. A confidence-scored, multi-WAF classifier and a
  full `axe-results.json` JSON schema are noted follow-ups.

## References

- `src/lib/page-guard.mjs`, `src/lib/scan-results.mjs` — classifier + predicates.
- `src/commands/scan.mjs`, `src/lib/process-runner.mjs` — the write-sites.
- `src/commands/summarize.mjs` (`buildExecutionHealth`, grouping),
  `src/lib/wcag-em-summary.mjs` (`automatedCoverage`), the four reporters.
- `src/commands/discover.mjs` — `classifyCrawlFailure` crawl-loss telemetry.
- Tests: `page-outcome-contract`, `scan-results-consumers-invariant`,
  `scan-page-guard`, `scan-results-helpers`, `discover-failed-request`,
  `process-runner` (§5.5), `summarize-execution-health`, `test/e2e/scan-challenge`.
- `docs/reviews/2026-06-epics-E1-E7.md` — the evidence + §5 checklist.
