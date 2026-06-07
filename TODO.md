# TODO / working board

Operational checklist for active and upcoming work. The **canonical** home for
release-bound deferred work is `CHANGELOG.md` `[Unreleased]` (ADR-0001); this
board is the prioritised working view, kept in sync with it. There are no stray
`TODO`/`FIXME` markers in the source — items here come from the CHANGELOG
roadmap, the Layer-3b carry-forwards, and the post-`portal-export` review.

_Last updated: 2026-06-07_

## Active

- [ ] Push `feat/portal-export-reporter` and open a PR for review.
- [ ] Re-point the stale roadmap reference in auto-memory (the named v1.0 plan
      file no longer exists on disk).

## P1 — reliability & contract

- [ ] **Portal contract source-of-truth.** Replace the empirically-derived
      `schemas/portal-canonical-scan.schema.json` with the portal's published
      schema; add a `contractVersion` to the payload, negotiated at upload, so
      drift is caught at the boundary instead of via a failed upload.
- [ ] **`occurrenceCount` semantics.** Reconcile (or rename) the distinct-element
      count emitted by `portal-export` vs the Σ-`nodesCount` shown in
      `summary.json` / html / markdown, so auditors diffing artefacts see
      consistent numbers.
- [ ] **Incomplete-evidence size cap.** Add `reporting.maxIncompleteExamplesPerRule`
      (default generous) applied in `liftIncompleteSummaries`, to bound
      `axe-results.json` on incomplete-heavy sites.

## P2 — product value

- [ ] **Per-rule remediation library.** Seed remediation templates (summary +
      steps, optional code) keyed by axe `ruleId`, so `portal-export` cards
      arrive pre-populated and the portal's "actionable" gate is met without
      manual writing. Source from Deque help text + standard fixes; surface via
      a `remediation` field on each rawFinding.
- [ ] **WCAG SC tag coverage.** Map the rules that currently emit `wcag: []`
      (best-practice / experimental) to SCs where one applies, to satisfy the
      portal's "provide WCAG criteria tags" prompt.

## P3 — polish & tech-debt

- [ ] Drop the `scan.mjs` `liftRuleSummaries` re-export; repoint the widening
      tests at `src/lib/axe-artifact.mjs`.
- [ ] Add a process-sourced incomplete-evidence end-to-end test (a needs-review
      finding originating from a `process-results.json` state, through to
      `portal-export` / html).
- [ ] Add a cross-reporter consistency test (the same finding's numbers agree
      across `portal-export` vs html / markdown) — would surface the
      `occurrenceCount` divergence above.

## Existing project roadmap (from `CHANGELOG.md` `[Unreleased]`)

- [ ] Baseline/regression mode — diff successive audits to surface new and
      resolved findings between runs.
- [ ] Plugin API — public extension surface for custom reporters and crawl
      strategies (ADR-0012 scopes the internal-only v1.0 boundary).
- [ ] Authenticated SPA crawler — `auth.setupScript` runtime execution, pending
      a security review of executing user-supplied scripts in a Playwright
      context.
- [ ] Localisation — i18n for CLI output and reporter artefacts.

## Carry-forward (from CHANGELOG Layer 3b follow-ups)

- [ ] `src/data/act-rule-map.json` exhaustive coverage (70+ ACT rules; currently
      ~30). `scripts/refresh-rule-maps.mjs` is scaffolded for the regeneration
      path.
- [ ] `tool-identity` propagation into Pino log base bindings (currently stamped
      on emitted artefacts only).
