# ADR-0016 — Incomplete results carry condensed node evidence

## Status

Accepted. Extends the artefact-projection contract in
[ADR-0007](./0007-wcag-em-summary-shape.md).

## Context

axe **"incomplete"** (needs-review) results were condensed at scan time by
`liftRuleSummaries` into a 7-key summary that **dropped the `nodes` bulk**
(`{id, tags, impact, nodesCount, help, helpUrl, firstTarget}`). Violations kept
their full nodes. That asymmetry cascaded: `summary.incompleteFindings[]`
carried no `examples`/`occurrences`/`targets`, so every reporter — and the
MyAccess Portal upload via `portal-export` — rendered needs-review items
without HTML evidence. The portal flagged critical/high needs-review cards as
_"missing evidence.html and instance htmlSnippet"_.

A second issue surfaced during the fix: `liftRuleSummaries` was **duplicated**
in `scan.mjs` (7-key) and `process-runner.mjs` (a diverged **4-key** copy), so
process-sourced needs-review findings were even poorer.

## Decision

1. Consolidate both lift helpers into `src/lib/axe-artifact.mjs`, imported by
   `scan.mjs` and `process-runner.mjs` — a `lib` importing nothing from
   `commands`, so the dependency graph stays acyclic (the duplication's original
   reason).
2. Add `liftIncompleteSummaries`: a **strict superset** of the 7-key shape that
   also retains `examples: [{ target, html }]` (condensed node evidence).
   Applied to `incomplete` ONLY — `passes`/`inapplicable` (the real size risk)
   stay lean via `liftRuleSummaries`.
3. `summarize.mjs` enriches `incompleteFindings` with `examples` (capped 5),
   `occurrences` (= Σ `nodesCount`), and sorted `targets[]`, mirroring grouped
   findings. All reporters (html, markdown, junit, portal-export) surface the
   evidence.

## Consequences

- `incompleteDetail` in `axe-results.json` / `process-results.json` is now a
  superset (adds `examples`; `nodesCount`/`firstTarget` intact). ADR-0007's F8
  reviewable-vs-infra-failure split (keyed on `nodesCount`) is unaffected.
- The process-path `*Detail` arrays widen from 4-key to the full 7-key (+
  `examples` for incomplete), healing the scan/process divergence.
- `axe-results.json` grows by the condensed incomplete evidence on
  incomplete-heavy sites — bounded: incomplete-only, condensed nodes; the
  bulk producers (passes/inapplicable) remain node-free.
- `schemas/portal-canonical-scan.schema.json` + `portal-export-schema.test.mjs`
  vendor the portal contract (critical/high findings must carry `evidence.html`)
  as a checked regression gate.

## References

- `src/lib/axe-artifact.mjs` — the consolidated `liftRuleSummaries` /
  `liftIncompleteSummaries`.
- `src/commands/scan.mjs`, `src/lib/process-runner.mjs` — both wire to the lib.
- `src/commands/summarize.mjs` — `incompleteFindings` enrichment.
- `src/reporters/portal-export.mjs` + `schemas/portal-canonical-scan.schema.json`.
- `test/unit/axe-artifact.test.mjs`, `test/unit/portal-export-schema.test.mjs`.
- ADR-0007 — the WCAG-EM summary / artefact-widening contract this extends.
