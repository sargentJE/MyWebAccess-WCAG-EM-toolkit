// @ts-check
/**
 * @file Deterministic finding sort for all reporters (internal).
 * @module reporters/_sort
 *
 * @description
 * Every reporter — JSON, markdown, HTML, EARL JSON-LD, JUnit — consumes
 * `summary.findings[]` and must emit byte-stable output. Ordering is the
 * only source of byte non-determinism once inner arrays (`urls`, `targets`,
 * `pageTypes`, `clusters`) are sorted upstream in `summarize.mjs`.
 *
 * Contract:
 *   1. impact desc, using the impact order critical > serious > moderate >
 *      minor > null (null impacts sort last).
 *   2. ruleId asc (ASCII tiebreak) — adds a deterministic secondary key the
 *      previous inline sort at `summarize.mjs` lacked.
 *
 * Pure function: returns a NEW array; does not mutate its argument. Stable
 * against the identity of the input array (`sortFindings(findings) !==
 * findings` always).
 *
 * @see docs/adr/0008-pluggable-reporters.md (Layer 4 sort contract)
 */

/**
 * Canonical impact ordering used by `sortFindings`. Higher number = earlier
 * in sorted output. `null` maps to 0 so findings without an impact sort last.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const IMPACT_ORDER = Object.freeze({
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
  null: 0,
});

/**
 * Sort findings by the canonical reporter contract. Returns a new array.
 *
 * @template {{ id?: string, impact?: string | null }} F
 * @param {ReadonlyArray<F>} findings
 * @returns {F[]}
 */
export function sortFindings(findings) {
  if (!Array.isArray(findings)) return [];
  return [...findings].sort((a, b) => {
    const aImpact = typeof a.impact === 'string' ? a.impact : 'null';
    const bImpact = typeof b.impact === 'string' ? b.impact : 'null';
    const impactDelta = (IMPACT_ORDER[bImpact] ?? 0) - (IMPACT_ORDER[aImpact] ?? 0);
    if (impactDelta !== 0) return impactDelta;
    const aId = typeof a.id === 'string' ? a.id : '';
    const bId = typeof b.id === 'string' ? b.id : '';
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  });
}
