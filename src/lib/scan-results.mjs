// @ts-check
/**
 * @file Shared predicates for reasoning about scan/process result entries.
 * @module lib/scan-results
 *
 * @description
 * One canonical answer to the two questions every raw-artefact consumer must
 * agree on for each `axe-results.json` / `process-results.json` entry (and each
 * process state):
 *
 *   - {@link viewStatus}     — what kind of page-view is this?
 *   - {@link isAuditableView} — should it contribute to findings, counters and
 *                               SC verdicts?
 *   - {@link viewIdentity}    — what canonical URL identifies the page?
 *
 * Before this module each consumer (summarize's grouping + execution-health,
 * the WCAG-EM inversion, and the portal-export / report-builder / html
 * reporters) re-derived these ad-hoc — some guarded on `error`, some on
 * nothing — which let could-not-audit pages and redirect duplicates leak into
 * some artefacts but not others. Routing every consumer through these
 * predicates closes that class of defect; an invariant test
 * (`test/unit/scan-results-consumers-invariant.test.mjs`) keeps new consumers
 * honest.
 *
 * Pure module — no I/O, safe to import anywhere.
 *
 * @see docs/reviews/2026-06-epics-E1-E7.md (E1, §5 contract-safety checklist)
 */

// SECTION: Imports
import { normalizeUrl } from './urls.mjs';

// SECTION: Public API

/**
 * @typedef {'auditable' | 'errored' | 'challenge' | 'empty' | 'redirect-duplicate'} ViewStatus
 */

/**
 * Classify a result entry (a page-view in `axe-results.json`, a process state,
 * or a synthetic test fixture). Order matters: a hard execution error wins over
 * a page-outcome tag, which wins over a redirect-duplicate marker.
 *
 * Legacy / pre-feature entries carry none of these fields; the `?? 'ok'`
 * fallback keeps them — and every existing test fixture — fully `auditable`,
 * so introducing the field set is behaviour-neutral for prior artefacts.
 *
 * @param {any} entry - One scan/process result object (or process state).
 * @returns {ViewStatus}
 */
export function viewStatus(entry) {
  // A thrown navigation/scan failure is recorded as a string `error` on the
  // result (scan.mjs failure-path push); that is an execution fault, distinct
  // from a could-not-audit page.
  if (typeof entry?.error === 'string') return 'errored';

  const outcome = entry?.pageOutcome ?? 'ok';
  if (outcome === 'challenge') return 'challenge';
  if (outcome === 'empty') return 'empty';
  if (outcome === 'error') return 'errored';

  // A page-view that resolved to an already-scanned final URL (redirect
  // dedupe): real, but its findings belong to the canonical view, not here.
  if (entry?.redirectedToAlreadyScanned === true) return 'redirect-duplicate';

  return 'auditable';
}

/**
 * The single predicate every raw-artefact consumer must use to decide whether
 * an entry contributes to findings, coverage counters and SC verdicts.
 *
 * @param {any} entry
 * @returns {boolean} True only for genuinely audited page-views.
 */
export function isAuditableView(entry) {
  return viewStatus(entry) === 'auditable';
}

/**
 * The canonical URL identifying a page-view: the post-redirect `finalUrl` when
 * present, else the requested `url`. Normalised so redirect source + target
 * fold to one identity and so the (final-URL-keyed) inventory lookup resolves.
 * Falls back to the raw string if normalization throws (e.g. `about:blank`).
 *
 * @param {any} entry
 * @returns {string}
 */
export function viewIdentity(entry) {
  const raw = entry?.finalUrl ?? entry?.url ?? '';
  try {
    return normalizeUrl(raw);
  } catch {
    return String(raw);
  }
}
