# 0007. WCAG-EM Step 5 summary shape

- Status: accepted
- Date: 2026-04-19
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions; symbol-first citation rule),
  ADR-0005 (fail fast on config; shares the `defineHidden` mechanism),
  ADR-0006 (multi-viewport axe runs; the scan loop widens artefacts
  for this)

## Context and Problem Statement

Up to v0.3 this toolkit produced rule-grouped output: findings
keyed by axe rule id (`image-alt`, `color-contrast`, …) with per-rule
tallies. That is useful for axe-familiar engineers but not
well-matched to the WCAG-EM Step 5 workflow, which demands per-**SC**
outcomes. The WCAG Evaluation Methodology (W3C, _WCAG-EM 1.0_) Step 5
asks evaluators to record, for every SC in scope, whether the target
conforms — `passed`, `failed`, needs manual review (`cantTell`), the
SC is `inapplicable` to the sampled content, or the automated run did
not cover it (`untested`). This matches the EARL `earl:outcome` enum
used as machine-readable verdicts by peer tools (Alfa, Accessibility
Insights, the W3C WAI-ACT report templates, VPAT/ACR).

The WCAG-EM summary step ships `toWcagEmSummary` which inverts axe's rule-grouped
output into criterion-grouped EARL-aligned verdicts. This ADR records
the decision tree, the scope boundary (what we do and don't count),
and the refinement that separates reviewable incompletes from
infrastructure failures.

## Decision

**Invert axe findings into per-SC outcomes using the EARL outcome
vocabulary.** Emit one verdict per SC the run actually touched — not
an exhaustive WCAG 2.2 enumeration.

### 1. Outcome decision tree

For each SC bucket (populated by `withActAndWcagMetadata` tag
parse across the widened rule arrays), determine the outcome by
checking in order:

| #   | Check                                                              | Verdict        |
| --- | ------------------------------------------------------------------ | -------------- |
| 1   | Any violation tagged with this SC                                  | `failed`       |
| 2   | Any incomplete tagged with this SC **and** `nodesCount > 0`        | `cantTell`     |
| 3   | Any **non-best-practice** rule passed at this SC                   | `passed`       |
| 4   | Any rule inapplicable at this SC (no pass / fail / cantTell above) | `inapplicable` |
| 5   | Bucket populated by tag but no arm fired                           | `untested`     |

### 2. F8 refinement — `cantTell` excludes infrastructure failures

Axe's `incomplete` array mixes (a) genuinely ambiguous findings (color
contrast on gradient backgrounds, ARIA state requiring human review)
from (b) infrastructure failures (script timeout, cross-origin iframe
blocked, engine snag producing zero candidate nodes). Mapping _all_
incompletes to `cantTell` would produce spurious SC-verdict flips
whenever the network or sandbox flakes.

**Refinement:** `cantTell` requires `incompleteDetail[i].nodesCount >
0`. Zero-node incompletes are infra failures; they route into a new
`summary.scanWarnings: string[]` field (top-level of both `summary.json`
and `wcag-em-summary.json`) instead of elevating to an SC verdict.
Partial-reviewable incompletes (3 of 5 nodes reviewable) still count
as reviewable — if ANY node is reviewable, the verdict is reviewable.

### 3. `passed` excludes best-practice rules

Best-practice rules (tagged `best-practice`) cover non-WCAG
conventions (e.g. `region` landmarks are an industry convention, not
an SC requirement). A best-practice rule passing does NOT contribute
to a `passed` verdict for any SC it happens to share a tag with.
Otherwise the verdict is misleading — a site could "pass" SC 1.3.1
purely because its best-practice landmark checks ran.

This is implemented by tracking a separate
`anyNonBestPracticePass` flag per SC bucket.

### 4. SC scope — only emit SCs the run touched

The output does **not** enumerate every SC in WCAG 2.2. An SC appears
in `criteriaOutcomes` only if at least one axe rule in this run was
tagged with it (pass, fail, incomplete, or inapplicable). A scan with
no applicable rules for SC 1.4.6 (AAA Contrast Enhanced) produces zero
output for 1.4.6, not an `untested` entry.

**Rationale:** an exhaustive enumeration would emit ~80 `untested`
verdicts per run for SCs outside the configured tag profile, which
readers would have to filter out. The WCAG-EM report template does
not demand exhaustiveness; it asks for "outcomes observed during
evaluation".

**Update (v1.1.0):** the dogfood audit proved auditors need a complete
SC matrix for the manual-review backlog. `toWcagEmSummary` now emits
`notTested` for every SC at or below the configured conformance target
(`A`, `AA`, or `AAA`) that no axe rule touched in the run. The ~80-row
concern from the original rationale is mitigated by the HTML reporter
styling `notTested` rows as grey italic — the visual weight falls on
actionable verdicts.

### 5. Output shape

```jsonc
{
  "tool": { "name": "…", "version": "…", "axeCore": "…" },
  "criteriaOutcomes": [
    {
      "sc": "1.4.3",
      "level": "AA",
      "outcome": "failed",
      "examples": [
        { "pageUrl": "https://…/admin", "ruleId": "color-contrast", "impact": "serious" },
      ],
      "pagesExamined": 12,
      "relatedRules": ["color-contrast"],
    },
  ],
  "evaluationDate": "2026-04-19T12:00:00.000Z",
  "processesEvaluated": ["signup", "checkout"],
  "scanWarnings": [
    "axe rule color-contrast reported incomplete with zero reviewable nodes on https://…/admin; infra failure (script timeout / cross-origin / engine snag). Does not affect SC verdicts.",
  ],
  "wcagVersion": "2.2",
  "conformanceTarget": "AA",
  "atBaseline": [],
  "technologiesReliedUpon": ["HTML", "CSS", "JavaScript", "WAI-ARIA"],
  "samplingMethodNotes": "",
  "evaluator": { "name": "", "contact": "" },
}
```

### 6. Algorithm — bucket-first, verdict-once

The implementation sweeps every page's rule arrays once, feeding
entries into per-SC buckets keyed by `withActAndWcagMetadata.wcagCriteria`.
After the sweep, one verdict is emitted per populated bucket in natural-
numeric SC order (so `1.2.10` appears after `1.2.9`, not between `1`
and `2`). This is O(N + K) where N is the total rule-executions and K
is the number of unique SCs touched. Avoids a quadratic per-SC × per-
rule pass on large sites.

## Consequences

- **Ecosystem alignment** — the outcome enum matches EARL / Alfa /
  Accessibility Insights / VPAT, so consumers can parse
  `wcag-em-summary.json` with existing tooling.
- **Honest `untested` scope** — the output does not pretend to have
  covered SCs the configured tag profile excluded. Readers see the
  actual coverage.
- **Per-SC verdicts depend on the widened artefact** — if a future
  refactor narrows `passesDetail`/`incompleteDetail`/`inapplicableDetail`
  back to counts, the WCAG-EM verdicts degrade to `failed` + `untested`
  only. The artefact contract is therefore load-bearing for Step 5.
- **`cantTell` vs `scanWarnings` boundary is documented** — future
  maintainers diagnosing "why did 1.4.3 flip between `cantTell` and
  `passed` run-to-run" now have a clear answer (network flake; see
  scanWarnings).
- **Best-practice rules can still help reviewers** — they appear in
  `summary.findings` with `classification: 'best-practice-or-manual-review'`
  so reviewers see them, but they do not contribute to per-SC
  conformance verdicts. Separation of concerns.

## More Information

- [ADR-0001 — Project conventions](./0001-project-conventions.md)
- [ADR-0005 — Fail fast on config](./0005-fail-fast-on-config.md) —
  shares `defineHidden`.
- [ADR-0006 — Multi-viewport axe runs](./0006-multi-viewport-axe-runs.md) —
  the scan loop whose widened artefact feeds this inversion.
- [ADR-0012 — Extensibility is internal for v1.0](./0012-extensibility-is-internal.md) —
  rationale for marking `guessPageType`/`guessProcessTypes`/
  `selectorComponentHint`/`clusterKeyFor` `@internal`.
- `src/lib/wcag-em-summary.mjs` — `toWcagEmSummary` implementation.
- `src/lib/axe-utils.mjs` — `withActAndWcagMetadata` (the SC-tag parser
  the bucket pass leans on).
- `src/commands/summarize.mjs` — the summarize run emits
  `output/reports/wcag-em-summary.json` from this helper.
- `test/unit/wcag-em-summary.test.mjs` — decision-tree coverage +
  scan-warnings routing.
- W3C WCAG-EM 1.0 — <https://www.w3.org/TR/WCAG-EM/>.
- EARL 1.0 outcome vocabulary — <https://www.w3.org/TR/EARL10-Schema/#outcome>.
