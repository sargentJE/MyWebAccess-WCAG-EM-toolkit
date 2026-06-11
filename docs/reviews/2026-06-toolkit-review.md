# Toolkit review — 2026-06-10

Systematic review of wcag-em-a11y-toolkit v1.1.0 (branch `feat/portal-export-reporter` @ 224de33)
across four lenses: code quality, verdict accuracy, product capability, and contract alignment
with the two downstream consumers (MyAccess Portal, myweb-report-builder).

**Method.** Three-agent reconnaissance produced a 33-claim risk register; every claim was then
adversarially verified against source (refute-first); the highest-stakes claims were reproduced
with hostile local fixtures; a live run against the Accessible University demo site (which
documents its 22 intentional barriers and ships broken/fixed page pairs) validated real output
finding-by-finding for precision and recall; both downstream consumers were driven with the live
export. Cross-layer false-positive discipline: 7 of 40+ claims were refuted along the way and are
quarantined in Appendix A rather than reported.

**Evidence tiers** used below: `[live]` reproduced on the AU run or a fixture probe,
`[source]` verified at file:line, `[probe]` reproduced with a hostile fixture.

---

## Verdict summary

The toolkit is structurally strong: conventions are real and enforced, the verdict engine is
deliberately conservative, evidence rendering is XSS-hardened, and the live run produced
**zero false positives** with a clean before/after differential. The accuracy risk is not in what
it reports — it is in what it **omits**: pipeline failures (pages, processes, pre-scan actions)
are recorded in raw artifacts and then silently dropped by every report, so a WCAG-EM Step 5
deliverable can over-claim coverage with no operator signal. The downstream story is more urgent
than the board knows: the report-builder integration is **broken today** on any v1.1 output, and
the portal ingests cleanly but silently rewrites and back-fills fields the toolkit could own.

| Lens                         | Grade           | Headline                                                          |
| ---------------------------- | --------------- | ----------------------------------------------------------------- |
| Code quality                 | Strong          | 97.4% line coverage; gaps concentrated exactly on failure paths   |
| Accuracy (reported findings) | Strong          | 9/9 live findings verified true; differential 6/6 correct         |
| Accuracy (coverage claims)   | Weak            | Failed pages/processes invisible; counts conflate page-views      |
| Product capability           | Good, loop open | Manual results cannot re-enter; backlog not feature-aware         |
| Downstream contracts         | At risk         | report-builder broken x2 on live output; portal silently diverges |

---

## Strengths (held to the same evidence bar)

- **Zero false positives** on the live run: all 6 violations and 3 needs-review items verified
  against page source; `label` occurrence count (10) matched the static HTML exactly. `[live]`
- **Differential correctness**: all 6 violations appear on `before.html` only; the fixed
  `after.html` is violation-clean. `[live]`
- **Conservative verdict engine**: `failed` requires a violation, `passed` requires a real
  non-best-practice pass, infra-failure incompletes are routed to `scanWarnings` instead of
  polluting verdicts (F8 guard works as ADR-0007 documents). `[source]` wcag-em-summary.mjs:404-413
- **XSS-hardened reporting**: tagged-template escaping with a five-context test matrix including
  Trojan Source (bidi/control chars); evidence HTML rendered safely in html and markdown.
  `[source]` reporters/\_template.mjs:120-142, test/unit/reporters-template.test.mjs
- **Discipline is real**: 17 ADRs honored in recent code (anchors, conventions, exit codes);
  gate green (lint, typecheck, 373 unit + 4 e2e); coverage 97.35% line / 83.13% branch;
  deterministic seeded sampling; honest README scoping ("what this toolkit does not claim").
- **Incomplete-evidence flow (v1.1) delivers**: 32-occurrence `color-contrast` needs-review on the
  live run (including the fixed page — gradient backgrounds axe cannot compute) carried per-node
  HTML evidence through to all reporters. `[live]`
- **A catch beyond the ground truth**: `target-size` (WCAG 2.2, 2.5.8) flagged 6 real sub-24px
  checkboxes that AU's own documented barrier list (which predates WCAG 2.2) does not mention. `[live]`

---

## Findings by root cause

### C1. Execution health is invisible (accuracy of coverage claims) — top severity

**Root cause:** stages faithfully record their own failures into raw artifacts, but no channel
carries execution outcomes into `summary.json` or any report; counts conflate attempted,
succeeded, and page-views.

| Symptom                                                                                                                                                                                             | Evidence                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Page failing all retries recorded as `{url, error, violations: []}`; summarize never reads `.error`; zero mention in any report; counted in `samplePagesScanned`; portal `pagesScanned` inherits it | `[probe P1]` scan.mjs:326-336, summarize.mjs:411                                          |
| `samplePagesScanned` counts page-views: 5 pages x 2 viewports reported as 10 "pages scanned", exported to the portal alongside `sampleSize: 5` in the same payload                                  | `[probe P4]`                                                                              |
| Failed process states (`.error` on process-results entries) consumed by nothing                                                                                                                     | `[source]` scan-processes.mjs:151-164, summarize.mjs:240-256                              |
| Pre-scan action failures recorded raw (`_preScanStates`) and consumed by zero downstream code; axe scans the un-prepared DOM with no qualifier                                                      | `[probe P2]` `{state: 'step-timeout', name: 'click'}` in artifact, absent from summary/md |
| URLs failing at discover appear in no artifact (log-only)                                                                                                                                           | `[source]` discover.mjs:229-231                                                           |
| `audit` orchestrator discards scan's `pagesFailed` return value                                                                                                                                     | `[source]` bin/wcag-em.mjs:193                                                            |
| maxPages truncation not flagged (`discoveredCount` recorded, but no `reachedMaxPages`)                                                                                                              | `[source]` discover.mjs:274-284                                                           |
| Reporter crashes surface in logs/exit code only, never in artifacts                                                                                                                                 | `[source]` summarize.mjs:434-439                                                          |

WCAG-EM consequence: a Step 5 report can claim a sample of N pages when M never loaded, with the
operator none the wiser unless they read pino output or diff raw artifacts.

### C2. Artifacts are bare JSON with no envelope (provenance and integrity)

**Root cause:** stage outputs carry no run-id, timestamp, engine version, or config binding, and
the loader tolerates anything.

| Symptom                                                                                                                                    | Evidence                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-summarize over missing or **corrupt** results: exit 0, zero findings, stale `finalSampleCount` intact, plausible "clean" portal payload | `[probe P3]` corrupt JSON -> clean report                                                                                                             |
| `readJsonMaybe` swallows `SyntaxError` identically to ENOENT                                                                               | `[source]` fs-utils.mjs:69-75                                                                                                                         |
| `writeJson` is non-atomic (no temp+rename) — mid-write crash produces the corrupt-input case above                                         | `[source]` fs-utils.mjs:55                                                                                                                            |
| `sample.json` resolves against **CWD**, ignoring `--out-dir`: two runs from one shell cross-contaminate                                    | `[live]` context.mjs:232 — this review's own fixture probes overwrote the repo-root sample.json (regenerate with `npx wcag-em sample --config <cfg>`) |
| No timestamp on scan entries; `evaluationDate` is summarize-time; no engine version recorded at scan time                                  | `[source]` wcag-em-summary.mjs:369, scan.mjs result shape                                                                                             |
| Reports dir never cleaned: disabling a reporter leaves the stale file from the previous run                                                | `[source]` context.mjs:249-253                                                                                                                        |
| `inventoryCount`/`finalSampleCount` silently fall back to differently-meaninged sources                                                    | `[source]` summarize.mjs:409-410                                                                                                                      |

### C3. Verdict semantics differ per surface (presentation accuracy)

**Root cause:** each reporter independently interprets cantTell/notTested/counts; there is no
shared verdict-presentation contract.

| Symptom                                                                                                                                                                              | Evidence                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Identical run: junit says **10 failures** (cantTell escalated), portal says **score 50**, html/md say "6 findings + 3 needs review"                                                  | `[live]` junit.mjs:100-126 vs portal-export.mjs:91-101                                            |
| `averageScore: 50` exported while **36 of the 56** Level A/AA SCs are notTested — nothing in the payload conveys the adjudication basis                                              | `[live]` portal-export.mjs:368,392-398                                                            |
| Dual vocabulary `notTested` vs `untested` for "no adjudication"                                                                                                                      | `[source]` wcag-em-summary.mjs:359 vs :412 — and the consumer enum break in C4 is its direct cost |
| `pagesExamined` counts every bucket contributor (passes/inapplicable included) — over-reads as "pages tested"                                                                        | `[source]` wcag-em-summary.mjs:344                                                                |
| EARL emits only failed/cantTell assertions (+passed behind includePasses); notTested/untested never expressed though `earl:untested` exists; OUTCOME_MAP has no key for them         | `[source]` earl-jsonld.mjs:48-53,117-135                                                          |
| `occurrences` (per-node) vs portal `occurrenceCount` (deduped instances) — board P1 already owns; note: single-viewport runs mask it (AU counts agreed), multi-viewport runs diverge | `[probe P4]` summarize.mjs:182 vs portal-export.mjs:245                                           |
| Occurrence counts are render-state-dependent: AU `image-alt` reported 2 of 5 alt-less images because 3 carousel slides were hidden at scan instant                                   | `[live]`                                                                                          |

### C4. Downstream contracts are unversioned and half-filled — commissioned priority

**Root cause:** both consumers evolved against snapshots of toolkit output; nothing versions the
contract; the toolkit under-fills fields the consumers already accept.

**Report builder (myweb-report-builder) — broken on current output, twice:**

1. `scope.samplingMethodNotes` Zod `min(1)` vs toolkit default `''` when `wcagEm.samplingMethodNotes`
   is unset — **any config without the hand-written note fails the chain**. `[live]`
   wcag-em-summary.mjs:380. The toolkit can synthesize this from sample-metadata (counts, seed,
   percent) instead of emitting an empty string.
2. `criteriaOutcomes.outcome` consumer enum is `passed|failed|cantTell|inapplicable` — the v1.1
   `notTested` matrix (36 of the 56 A/AA outcomes on the live run) **breaks the consumer outright**. `[live]`
   A v1.1 feature silently broke the integration; no contractVersion exists to catch it.

Chain friction once unblocked: toolkit screenshots never reach draft evidence; finding IDs are
hardcoded `LE-*` (consumer bug, draft-from-evidence.js:99); `validate:report` has no draft mode
(the generated draft IS DraftReportSchema-valid).

**Portal (myaccess-portal-plan) — ingests cleanly, diverges silently:**

Live AU export through `CanonicalAdapter`: **zero warnings**, but the adapter derives
`fingerprint` (dedup identity is portal-controlled), adds `priorityScore`/`manualReviewIssues`,
rewrites `scoreSource` from `'wcag-em-criterion-outcomes'` to its own enum value, and truncation
rules (2000-char evidence, 500-char display snippets) live only portal-side. Hard rejects are
nearly unreachable for toolkit-shaped payloads (unknown format, >50k findings) — the vendored
schema's threat model ("upload rejection") is the wrong one; the real risk is **silent shadowing**.

Fields the portal accepts today that arrive empty: `evidence.failureSummary` (axe produces it;
the artifact lift drops it), `taxonomy.wcagTechniques` (always `[]`), `context.pageRegion/
elementType`, `remediation.proposals` (board P2 remediation library lands exactly here),
`summary.manualReviewIssues`. The portal preserves `taxonomy` pass-through, so enrichment is
non-breaking.

### C5. The SPA story over-promises (docs vs code)

**Root cause:** `waitFor` dispatch ignores `step.selector` entirely and sleeps
`step.timeoutMs ?? 500`. `[probe]` process-runner.mjs:213-215. The README's SPA guidance
("waitFor polls for a hydration marker") describes behavior that does not exist; a
client-rendered SPA gets a 500ms sleep and axe scans whatever DOM exists. Combined with C1's
invisible pre-scan failures, the SPA accuracy story is materially weaker than documented.
One-line fix shape: `page.waitForSelector(step.selector, ...)` when selector present.

### C6. The audit loop is open (product capability)

- **Manual-result ingestion does not exist** (verified exhaustively): manual-backlog.md is
  write-only; criteriaOutcomes can never progress past automation's ceiling; the combined
  automated+manual WCAG-EM Step 5 record — the thing a client audit actually delivers — must be
  assembled outside the toolkit. This is the single biggest product unlock and feeds both
  consumers (portal cards, report-builder drafts).
- **Backlog is not feature-aware**: live join against AU's 22 documented barriers — the 13-item
  backlog covers 8 of 13 manual-class categories but misses carousel, modal dialog, data tables,
  abbreviations, and link-text quality, all detectable at discover time (discover already counts
  forms/landmarks/search; tables/videos/dialogs are the same one-liner).
- **ACT map**: hand-vendored 30-rule map vs axe-core 4.11.3 natively exposing `actIds` on 56 of
  104 rules — derive at refresh time instead of expanding by hand (supersedes the carry-forward).
- Already-roadmapped and review-confirmed: baseline/regression mode, remediation library (P2),
  occurrenceCount reconciliation (P1), incomplete-evidence cap knob (P1).
- Smaller: per-URL override application is untraced in artifacts (axe-utils first-match-wins);
  no VPAT/ACR export though criteriaOutcomes is VPAT-shaped.

---

## Live AU run — validation tables

Run: 4 pages (before/after/info/index), 1 viewport, 37s wall-clock
(discover 27.1s, sample 0.2s, scan 9.1s, processes 0.5s, summarize 0.2s). Snapshots archived with
run output. Inventory 22 URLs (the `somepage.html?ref=*` near-duplicates clustered as expected).

**Precision — 9/9 true positives, 0 false positives**

| Finding                       | Occ | Verification                                                                                          |
| ----------------------------- | --- | ----------------------------------------------------------------------------------------------------- |
| image-alt (critical)          | 2   | 5 alt-less imgs in source; 3 carousel slides hidden at scan instant (render-state undercount, see C3) |
| label (critical)              | 10  | Exactly 10 unlabeled controls in source                                                               |
| color-contrast (serious)      | 4   | All 4 example snippets verbatim in source; AU documents the barrier                                   |
| html-has-lang (serious)       | 1   | `<html>` bare on before, `lang="en"` on after                                                         |
| link-in-text-block (serious)  | 3   | 3/3 snippets verbatim; AU "color used to communicate"                                                 |
| target-size (serious)         | 6   | 6 checkbox inputs; WCAG 2.2 catch beyond AU's documented list                                         |
| video-caption (needs review)  | 1   | Legitimate cantTell (carousel video region)                                                           |
| bypass (needs review)         | 1   | Skip link genuinely absent; correctly not auto-failed                                                 |
| color-contrast (needs review) | 32  | Gradient/image backgrounds; appears on both pages; correctly undecided                                |

**Recall vs AU's 22 documented intentional barriers**

| Class                                                                             | Count | Barriers                                                                                             |
| --------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- |
| Caught as violations                                                              | 4     | language, informative-image alt, contrast, form labels                                               |
| Surfaced as needs-review                                                          | 2     | skip link (bypass), video captions                                                                   |
| Partially caught                                                                  | 1     | color-as-communication (links only, via link-in-text-block)                                          |
| Toolkit-config class (best-practice tags off in this config; backlog covers both) | 2     | landmarks, headings                                                                                  |
| Automated-undetectable, **covered by manual backlog**                             | 8     | keyboard, focus, nav menu, CAPTCHA, input validation, decorative alt, color-comm (rest), audio/video |
| Automated-undetectable, **NOT in backlog**                                        | 5     | carousel, modal, data tables, abbreviations, link-text quality                                       |
| Beyond documented list                                                            | +1    | target-size (WCAG 2.2)                                                                               |

This is the expected shape for an axe-based layer (roughly a third of barriers surfaced
automatically, zero noise) — the gap that matters is the 5 uncovered manual categories, all
feature-detectable.

**Cross-artifact consistency:** rule-level counts agreed across summary/grouped/portal on this
single-viewport run; the three human-facing surfaces disagreed on severity framing (C3).

---

## Runtime and dependency notes

- Live audit of a small real site: ~37s end-to-end; scan ~2.3s/page. No wall-clock budget on
  discover (only per-request timeouts) — pathological sites bound only by maxPages (schema cap 5000).
- `npm audit`: 14 moderate, all via transitive `ws` (fix available); deps otherwise current-minor
  (playwright 1.59.1 vs 1.60, crawlee 3.16 vs 3.17, @axe-core/playwright 4.11.2 vs 4.11.3).
- ACT map generated against axe-core 4.11.2; resolved version is 4.11.3; no CI drift check.

---

## Roadmap (sequenced)

**Sprint 1 — "Truthful outputs" (top cluster, execution plan below):** C1 core + C4 + C5 + the
two C3 items exports inherit. Makes the three deliverables Jamie named (scan results, manual
checklist, portal/report-builder exports) truthful and contract-stable.

**Sprint 2 — "Artifact envelope" (C2):** stamped envelope (runId, generatedAt, toolkit+axe
versions, config hash) on every stage output; strict loader (corrupt != missing, loud on both);
atomic writes; `sample.json` under outDir; reports-dir clean policy.

**Sprint 3 — "Close the loop" (C6, ADR first):** manual-result ingestion — a results file an
auditor edits (per-SC and per-backlog-item verdicts + notes) that summarize merges into
criteriaOutcomes/EARL/portal/report-builder as `earl:manual`-mode assertions; feature-aware
backlog items from discover-time detection (tables/video/dialog/carousel); ACT map derived from
axe-native `actIds`.

**Later / board-tracked:** baseline-regression mode, remediation library (P2), VPAT/ACR export,
verdict-presentation unification (full C3), trend reporting, plugin API (ADR-0012 boundary).

**Consumer-side notes (their boards):** report-builder — accept or version `notTested`, derive ID
prefix from site, add draft mode to validate:report; portal — publish the ingestion contract
(scan-ingestion.types.ts) as the source the toolkit vendors, surface `scoreSource` rewrite as a
warning.

---

## Top-cluster execution plan — Sprint 1 "Truthful outputs"

Branch `feat/truthful-outputs` off main after the portal-export PR merges. Seven commits, gate
green at each, tests-first-for-bugfix per house style. Probe scripts from this review become the
regression tests landing WITH each fix (they assert broken behavior today, so they were not
committed with this review).

| #   | Commit                                                                          | Root cause addressed | Shape                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | `fix(process-runner): waitFor honors selector`                                  | C5                   | `page.waitForSelector(step.selector)` when selector present; `waitForTimeout` only when only timeoutMs given; unit test on dispatch; README already describes the fixed behavior                                                                                                                                                                                                                      |
| T2  | `feat(summarize): execution-health block in summary + reporters`                | C1                   | `summary.executionHealth = {pagesAttempted, pagesSucceeded, pagesFailed: [{url, viewport, error, attempts}], pageViewsScanned, processFailures, preScanFailures, reachedMaxPages}`; `samplePagesScanned` redefined to pages (CHANGELOG breaking note); html/md/junit/portal render a Scan Health section; promote probe P1 to e2e                                                                     |
| T3  | `fix(fs-utils): distinguish corrupt from missing; atomic writes`                | C2 (enabler)         | parse errors warn loudly before fallback; writeJson temp+rename; promote probe P3 to unit/e2e                                                                                                                                                                                                                                                                                                         |
| T4  | `fix(context): sample.json lives under outDir`                                  | C2 (enabler)         | kills the CWD collision; CHANGELOG migration note                                                                                                                                                                                                                                                                                                                                                     |
| T5  | `feat(portal-export): scoreBasis + evidence enrichment + write-time validation` | C3/C4                | `summary.scoreBasis = {passed, failed, cantTell, notTested, inapplicable}` + `manualReviewIssues`; lift `failureSummary` through axe-artifact into evidence; fill `taxonomy.wcagTechniques` where derivable; optional `reporting.validateExports` Ajv gate (default warn)                                                                                                                             |
| T6  | `feat(reporters): report-builder-starter exporter`                              | C4 commissioned      | Emits DraftReportSchema-compliant JSON directly: site-derived ID prefix, samplingMethodNotes synthesized from sample-metadata when config blank, criteriaOutcomes mapped to consumer enum (notTested carried in draft meta), screenshots as typed evidence entries with alt+path; Zod schema vendored as generated JSON Schema with contractVersion (the lesson of the portal-schema episode applied) |
| T7  | `docs: CHANGELOG + README truth pass`                                           | C5/C1                | SPA section reflects real waitFor; failure-visibility documented; counts glossary (pages vs page-views vs occurrences vs instances)                                                                                                                                                                                                                                                                   |

Out of scope for Sprint 1: artifact envelope (Sprint 2), manual-result ingestion (Sprint 3 +
ADR), any portal-side or report-builder-side change.

---

## Appendix A — refuted claims (kept so they are not re-discovered)

| Claim                                                               | Refutation                                                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Infra-failure incompletes can make an SC "appear passed"            | decideOutcome requires a real pass; untouched SCs get notTested; F8 guard works (wcag-em-summary.mjs:404-413)                   |
| structuredManual URLs missing from inventory are silently excluded  | Warned AND included in the sample; scanned (sample.mjs:69-98, probe P1 used this)                                               |
| Random-vs-structured comparison over-reports                        | structuredRuleIds is global; logic correct (summarize.mjs:380-397)                                                              |
| Best-practice rules with WCAG SC tags skew verdicts                 | 0 of 104 rules in axe-core 4.11.3 carry both tags (probe P6); latent only                                                       |
| Five lib modules have zero test coverage                            | args/sample-utils 100%, fs-utils 94.7%, logger 84.4%, preflight 85.9% via indirect tests; the real gap is failure-path branches |
| Auto-suggest is inert without preferTypes                           | DEFAULTS ship a six-type list (config.mjs:92)                                                                                   |
| AU documents/\* crawl risk needs config excludes                    | documentLinkPatterns defaults skip them (config.mjs:78, discover.mjs:140)                                                       |
| Portal hard-rejects on missing fingerprint/message/url/distribution | Adapter derives/back-fills all of them; validation runs post-adapter (canonical.adapter.ts:330-336)                             |

## Appendix B — probe transcript excerpts

```
P1  failed /slow entry exists in axe-results with error field      expected true   actual true
P1  summary.json mentions /slow anywhere                           expected false  actual false
P1  portal pagesScanned == axeResults.length (failed included)     expected 6      actual 6
P2  _preScanStates: [{"state":"step-timeout","name":"click",...}]  summary/md trace: none
P3  summarize over CORRUPT axe-results exits 0 (clean)             expected 0      actual 0
P4  summary.samplePagesScanned reports page-views, not pages       expected 10     actual 10
P6  axe 4.11.3: rules tagged both best-practice and wcagXXX        []   (104 rules, 56 with native actIds)
RB  evidence:from-toolkit on AU output                             ZodError scope.samplingMethodNotes min(1)
RB  after note added                                               ZodError criteriaOutcomes outcome 'notTested' not in enum
Portal CanonicalAdapter on AU export                               0 warnings; scoreSource rewritten; fingerprint derived
```

Review conducted 2026-06-10. Full probe scripts and the AU run archive (artifacts, snapshots,
report-builder evidence/draft) at `/tmp/wcag-em-probes/` and `/tmp/wcag-em-au-run/` (ephemeral).
