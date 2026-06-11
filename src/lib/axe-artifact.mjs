// @ts-check
/**
 * @file Axe scan-artifact projection helpers (shared by scan + process-runner).
 * @module lib/axe-artifact
 *
 * @description
 * Projects raw axe rule-result arrays into the light `*Detail` summaries that
 * `axe-results.json` / `process-results.json` carry for the WCAG-EM widening.
 * Two projections:
 *
 * - `liftRuleSummaries` — the lean 7-key shape for `passes`/`inapplicable`.
 *   Drops the `nodes` bulk to keep the artefact size bounded on large sites
 *   (passes/inapplicable can each carry hundreds of rules × many nodes).
 * - `liftIncompleteSummaries` — a SUPERSET for `incomplete` only: the same 7
 *   keys PLUS a condensed `examples: [{ target, html }]` slice, so needs-review
 *   findings carry HTML evidence end-to-end (summarize → reporters → portal).
 *   Incomplete results are a small fraction of passes/inapplicable, so retaining
 *   their condensed node evidence is a bounded cost.
 *
 * Consolidated here (rather than duplicated in `scan.mjs` + `process-runner.mjs`)
 * so the two scan paths share ONE contract. A `lib` importing nothing from
 * `commands` keeps the dependency graph acyclic — which is exactly what the
 * previous in-file duplication was working around.
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 */

// SECTION: Helpers

/**
 * Join an axe node's `target` selector array into the canonical pipe-joined
 * string used across the pipeline (matches the violation target format in
 * `summarize.mjs`), or `null` when absent.
 *
 * @param {any} node
 * @returns {string | null}
 */
function joinTarget(node) {
  return Array.isArray(node?.target) && node.target.length ? node.target.join(' | ') : null;
}

// SECTION: Public API

/**
 * Project an axe rule-result array into the lean summary shape for the widened
 * artefact contract. Keeps `id, tags, impact, nodesCount, help, helpUrl,
 * firstTarget`; drops the `nodes` bulk that would blow up the artefact on large
 * sites. Pure.
 *
 * @param {Array<{ id?: string, tags?: string[], impact?: string|null, help?: string, helpUrl?: string, nodes?: any[] }>} rules
 * @returns {Array<{ id: string, tags: string[], impact: string|null, nodesCount: number, help: string, helpUrl: string, firstTarget: string|null }>}
 */
export function liftRuleSummaries(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map((r) => ({
    id: String(r.id ?? ''),
    tags: Array.isArray(r.tags) ? [...r.tags] : [],
    impact: typeof r.impact === 'string' ? r.impact : null,
    nodesCount: Array.isArray(r.nodes) ? r.nodes.length : 0,
    help: typeof r.help === 'string' ? r.help : '',
    helpUrl: typeof r.helpUrl === 'string' ? r.helpUrl : '',
    firstTarget:
      Array.isArray(r.nodes) && r.nodes[0]?.target?.[0] ? String(r.nodes[0].target[0]) : null,
  }));
}

/**
 * Default per-rule cap on retained incomplete examples. ADR-0016 accepted
 * unbounded condensed examples on the grounds that incompletes are few; the
 * 2026-06 review's live run hit 32 occurrences on a single rule, so the
 * artefact is now bounded here at the source (config knob
 * `reporting.maxIncompleteExamplesPerRule`). `nodesCount` keeps the TRUE
 * total, so downstream occurrence counting is unaffected by the cap.
 */
export const DEFAULT_MAX_INCOMPLETE_EXAMPLES = 25;

/**
 * Like `liftRuleSummaries` but ALSO retains a condensed
 * `{ target, html, failureSummary }` slice of the first `maxExamples` nodes
 * as `examples`, so axe "incomplete" (needs-review) findings carry evidence
 * downstream. `failureSummary` is axe's own human-readable diagnosis of WHY
 * the node needs review — the portal displays it when provided (2026-06
 * review C4). Used ONLY for `incomplete` results — passes/inapplicable stay
 * lean via `liftRuleSummaries`. A strict superset of the 7-key shape
 * (nothing removed), so ADR-0007's `nodesCount`/`firstTarget` contract is
 * preserved. Pure.
 *
 * @param {Array<{ id?: string, tags?: string[], impact?: string|null, help?: string, helpUrl?: string, nodes?: any[] }>} rules
 * @param {number} [maxExamples] - Per-rule example cap; defaults to
 *   `DEFAULT_MAX_INCOMPLETE_EXAMPLES`.
 * @returns {Array<{ id: string, tags: string[], impact: string|null, nodesCount: number, help: string, helpUrl: string, firstTarget: string|null, examples: Array<{ target: string|null, html: string|null, failureSummary: string|null }> }>}
 */
export function liftIncompleteSummaries(rules, maxExamples = DEFAULT_MAX_INCOMPLETE_EXAMPLES) {
  if (!Array.isArray(rules)) return [];
  const cap =
    Number.isFinite(maxExamples) && maxExamples >= 0
      ? maxExamples
      : DEFAULT_MAX_INCOMPLETE_EXAMPLES;
  return rules.map((r) => {
    const base = liftRuleSummaries([r])[0];
    const nodes = Array.isArray(r.nodes) ? r.nodes : [];
    const examples = nodes.slice(0, cap).map((n) => ({
      target: joinTarget(n),
      html: typeof n?.html === 'string' ? n.html : null,
      failureSummary: typeof n?.failureSummary === 'string' ? n.failureSummary : null,
    }));
    return { ...base, examples };
  });
}
