# ADR-0019 — Redirect-aware scanning (final-URL identity)

## Status

Accepted. Builds on [ADR-0017](./0017-page-outcome-could-not-audit.md) (the
shared `scan-results` predicates).

## Context

Redirect identity was captured at discovery (`discover.mjs` records
`normalizeUrl(page.url())`) but **discarded at scan** — `scan.mjs` keyed results
on the requested URL only. When both a redirect source and its target were in
the sample (sources enter via `sample.structuredManual` or a process
`forceInclude` startUrl), each was scanned and counted separately: a live run
reported `region` `pageCount=147` double-counting `/contact-us` + its
`301 → /get-in-touch` target.

## Decision

1. **Capture `finalUrl` at the scan write-site.** `runForPage` records
   `finalUrl = normalizeUrl(page.url())` after `goto` (mirroring `discover.mjs`).
   A **per-viewport seen-set** of final URLs skips re-scanning: the second view
   of the same final URL is recorded `redirectedToAlreadyScanned: true` with
   empty violations (excluded everywhere via `isAuditableView`). The set is
   updated only **after a successful axe run**, so a thrown retry of the same URL
   is not mistaken for a duplicate.
2. **Group by `viewIdentity` (finalUrl ?? url).** `groupFindings`,
   `buildExecutionHealth`, and the incomplete-grouping loops key page identity on
   `viewIdentity` so source + target fold to one page. This also **fixes a
   pre-existing inventory-lookup miss**: the inventory is final-URL-keyed
   (`discover.mjs`), so a source-keyed lookup previously dropped `pageType`/
   `clusterKey` for every redirected page.
3. **Sample-tier membership carve-out.** `structured-sample.txt` /
   `random-sample.txt` list the URLs that were _scanned_ (sources for manual
   entries), so `addRuleFinding` tests tier membership against the original
   sample URL (`sampleKey`), **not** the folded identity — otherwise a redirected
   structured page would silently vanish from the WCAG-EM Step 3c random-vs-
   structured comparison.

## Consequences

- `axe-results.json` entries gain `finalUrl` and (for redirect duplicates)
  `redirectedToAlreadyScanned`. `summary.findings[].pages` now carry the **final**
  URL, so `earl-jsonld` `earl:subject` and `junit` `<testcase name>` (which read
  `f.pages[]`) shift from source → target. This is _more_ correct (the audited
  page is the target) but is a machine-readable-contract change — noted here + in
  CHANGELOG.
- `region` / `link-name` page counts drop (the intended de-duplication).
- **Portal-export / report-builder already avoid the redirect double-count** —
  the `redirectedToAlreadyScanned` entry is skipped by their `isAuditableView`
  guard (ADR-0017), so each redirected page appears once. They still key the
  surviving row on `entry.url`, so a redirect finding may be _labelled_ by the
  source URL (no double-count, just a label). Re-keying those two
  companion-ingested files to `viewIdentity` would shift portal fingerprints for
  redirected pages and is **deferred to a companion-coordinated follow-up**
  (verify the MyAccess Portal `CanonicalAdapter` tolerance + diff first).

## References

- `src/commands/scan.mjs` — `finalUrl` capture + per-viewport seen-set.
- `src/lib/group-findings.mjs` — `viewIdentity` group key + `sampleKey` carve-out.
- `src/commands/summarize.mjs` — `buildExecutionHealth` + incomplete loops keyed on identity.
- `src/lib/scan-results.mjs` — `viewIdentity` (ADR-0017).
- Tests: `group-findings` (carve-out), `summarize-url-dedup`, `test/e2e/scan-redirect`.
- `docs/reviews/2026-06-epics-E1-E7.md` (E4) — the evidence.
