// @ts-check
/**
 * @file WCAG-EM Step 5 per-SC inversion of axe findings.
 * @module lib/wcag-em-summary
 *
 * @description
 * Inverts axe's rule-grouped output into WCAG-EM Step 5's criterion-grouped
 * shape. One verdict per Success Criterion the run actually touched, using
 * EARL's outcome vocabulary (`passed`, `failed`, `inapplicable`, `cantTell`,
 * `untested`). Industry-standard per Alfa / Accessibility Insights / VPAT.
 *
 * Input shape is the widened `axe-results.json` and `process-results.json`
 * from R6: each page-result carries
 *   - `violations`: full rule objects with tags.
 *   - `passesDetail`: light `{id, tags, impact, nodesCount}` per pass.
 *   - `incompleteDetail`: same, per incomplete.
 *   - `inapplicableDetail`: same, per inapplicable.
 *
 * Output shape (stable contract documented in ADR-0007 at R14):
 *   {
 *     criteriaOutcomes: [{ sc, level, outcome, examples, pagesExamined, relatedRules }],
 *     evaluationDate: ISO-8601 string,
 *     processesEvaluated: string[],
 *     scanWarnings: string[],          // infra failures routed here (F8)
 *     ...config.wcagEm                 // spread user-config metadata
 *   }
 *
 * Algorithm (O(N + K) — linear sweep + per-SC verdict):
 *   1. Walk every page result's four rule arrays once, bucketing entries
 *      by each WCAG SC tag (parsed via `withActAndWcagMetadata`).
 *   2. For each SC bucket, emit one verdict.
 *   3. Infra-failure incompletes (nodesCount === 0) route to scanWarnings,
 *      NOT to SC verdicts (F8 — prevents spurious cantTell from network flake).
 *
 * Pure function; tests pass synthesized fixtures.
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 * @see https://www.w3.org/TR/WCAG-EM/#step5
 * @see https://www.w3.org/TR/EARL10-Schema/#outcome
 */

// SECTION: Imports
import { withActAndWcagMetadata } from './axe-utils.mjs';

// SECTION: Constants

// ANCHOR: SC_LEVEL_MAP — minimal WCAG 2.2 level table used for the `level`
// field in each criterion outcome. Only covers SCs up to WCAG 2.2. When a rule
// references an SC we don't have a level for (unlikely — would mean a newer
// WCAG version than 2.2), the verdict is still emitted with `level: null`.
const SC_LEVEL_MAP = /** @type {const} */ ({
  // Principle 1 — Perceivable
  '1.1.1': 'A', '1.2.1': 'A', '1.2.2': 'A', '1.2.3': 'A', '1.2.4': 'AA',
  '1.2.5': 'AA', '1.2.6': 'AAA', '1.2.7': 'AAA', '1.2.8': 'AAA', '1.2.9': 'AAA',
  '1.3.1': 'A', '1.3.2': 'A', '1.3.3': 'A', '1.3.4': 'AA', '1.3.5': 'AA', '1.3.6': 'AAA',
  '1.4.1': 'A', '1.4.2': 'A', '1.4.3': 'AA', '1.4.4': 'AA', '1.4.5': 'AA',
  '1.4.6': 'AAA', '1.4.7': 'AAA', '1.4.8': 'AAA', '1.4.9': 'AAA',
  '1.4.10': 'AA', '1.4.11': 'AA', '1.4.12': 'AA', '1.4.13': 'AA',
  // Principle 2 — Operable
  '2.1.1': 'A', '2.1.2': 'A', '2.1.3': 'AAA', '2.1.4': 'A',
  '2.2.1': 'A', '2.2.2': 'A', '2.2.3': 'AAA', '2.2.4': 'AAA', '2.2.5': 'AAA', '2.2.6': 'AAA',
  '2.3.1': 'A', '2.3.2': 'AAA', '2.3.3': 'AAA',
  '2.4.1': 'A', '2.4.2': 'A', '2.4.3': 'A', '2.4.4': 'A', '2.4.5': 'AA',
  '2.4.6': 'AA', '2.4.7': 'AA', '2.4.8': 'AAA', '2.4.9': 'AAA', '2.4.10': 'AAA',
  '2.4.11': 'AA', '2.4.12': 'AAA', '2.4.13': 'AAA',
  '2.5.1': 'A', '2.5.2': 'A', '2.5.3': 'A', '2.5.4': 'A',
  '2.5.5': 'AAA', '2.5.6': 'AAA', '2.5.7': 'AA', '2.5.8': 'AA',
  // Principle 3 — Understandable
  '3.1.1': 'A', '3.1.2': 'AA', '3.1.3': 'AAA', '3.1.4': 'AAA', '3.1.5': 'AAA', '3.1.6': 'AAA',
  '3.2.1': 'A', '3.2.2': 'A', '3.2.3': 'AA', '3.2.4': 'AA', '3.2.5': 'AAA', '3.2.6': 'A',
  '3.3.1': 'A', '3.3.2': 'A', '3.3.3': 'AA', '3.3.4': 'AA', '3.3.5': 'AAA',
  '3.3.6': 'AAA', '3.3.7': 'A', '3.3.8': 'AA', '3.3.9': 'AAA',
  // Principle 4 — Robust
  '4.1.1': 'A', '4.1.2': 'A', '4.1.3': 'AA',
});

// SECTION: Public API

/**
 * @typedef {object} CriterionOutcome
 * @property {string} sc - Success Criterion number, e.g. "1.4.3".
 * @property {string | null} level - Conformance level "A" / "AA" / "AAA" / null (if unknown).
 * @property {'passed' | 'failed' | 'cantTell' | 'inapplicable' | 'untested'} outcome - EARL outcome verdict.
 * @property {Array<{ pageUrl: string, ruleId: string, impact: string | null }>} examples - Up to 5 example offenders.
 * @property {number} pagesExamined - Number of unique page URLs that contributed to this verdict.
 * @property {string[]} relatedRules - Unique axe rule IDs that reference this SC in the run.
 */

/**
 * Produce the WCAG-EM Step 5 per-SC summary.
 *
 * Note on naming: the second parameter is a *bundle of raw results*, not a
 * draft of the returned summary. `rawResults = { axeResults, processResults }`
 * is the input feedstock; the return value is the inverted per-SC summary.
 *
 * @param {{ config: Record<string, any> }} ctx
 * @param {{
 *   axeResults?: any[],
 *   processResults?: any[],
 * }} rawResults - Bundle of raw axe + process results. Not a draft summary.
 * @returns {{
 *   criteriaOutcomes: CriterionOutcome[],
 *   evaluationDate: string,
 *   processesEvaluated: string[],
 *   scanWarnings: string[],
 *   wcagVersion: string,
 *   conformanceTarget: string,
 *   atBaseline: string[],
 *   technologiesReliedUpon: string[],
 *   samplingMethodNotes: string,
 *   evaluator: { name: string, contact: string },
 * }}
 */
export function toWcagEmSummary(ctx, rawResults) {
  const wcagEmConfig = ctx?.config?.wcagEm ?? {};
  const axeResults = Array.isArray(rawResults?.axeResults) ? rawResults.axeResults : [];
  const processResults = Array.isArray(rawResults?.processResults)
    ? rawResults.processResults
    : [];

  /** @type {string[]} */
  const scanWarnings = [];

  // ANCHOR: SCBucket — per-SC aggregation.
  // Each bucket tracks whether we've seen a violation, a pass (non-best-practice),
  // a reviewable incomplete, an inapplicable, and the set of rules that touch
  // this SC in this run.
  /**
   * @typedef {object} ScBucket
   * @property {boolean} anyViolation - At least one rule violation tagged this SC.
   * @property {boolean} anyNonBestPracticePass - At least one non-best-practice rule passed at this SC.
   * @property {boolean} anyReviewableIncomplete - At least one incomplete with `nodesCount > 0` tagged this SC.
   * @property {boolean} anyInapplicable - At least one rule was inapplicable at this SC.
   * @property {Set<string>} relatedRules - All axe rule IDs that touch this SC in the run.
   * @property {Array<{ pageUrl: string, ruleId: string, impact: string | null }>} examples - Up to 5 example offenders.
   * @property {Set<string>} pages - Unique page URLs that contributed to this bucket.
   */
  /** @type {Map<string, ScBucket>} */
  const buckets = new Map();

  /**
   * @param {string} sc
   * @returns {ScBucket}
   */
  function bucketFor(sc) {
    let b = buckets.get(sc);
    if (!b) {
      b = {
        anyViolation: false,
        anyNonBestPracticePass: false,
        anyReviewableIncomplete: false,
        anyInapplicable: false,
        relatedRules: new Set(),
        examples: [],
        pages: new Set(),
      };
      buckets.set(sc, b);
    }
    return b;
  }

  /**
   * Walk a single page's axe output, feeding rule entries into their SC buckets.
   *
   * @param {string} pageUrl
   * @param {any[]} violations - Full rule objects (with nodes).
   * @param {any[]} passesDetail - Light summaries from R6.
   * @param {any[]} incompleteDetail - Light summaries from R6.
   * @param {any[]} inapplicableDetail - Light summaries from R6.
   */
  function ingestPage(pageUrl, violations, passesDetail, incompleteDetail, inapplicableDetail) {
    for (const v of violations ?? []) {
      const meta = withActAndWcagMetadata(v);
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyViolation = true;
        b.relatedRules.add(v.id);
        b.pages.add(pageUrl);
        if (b.examples.length < 5) {
          b.examples.push({ pageUrl, ruleId: v.id, impact: v.impact ?? null });
        }
      }
    }
    for (const p of passesDetail ?? []) {
      const meta = withActAndWcagMetadata(p);
      const isBestPractice = Array.isArray(p.tags) && p.tags.includes('best-practice');
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.relatedRules.add(p.id);
        b.pages.add(pageUrl);
        if (!isBestPractice) b.anyNonBestPracticePass = true;
      }
    }
    for (const inc of incompleteDetail ?? []) {
      const meta = withActAndWcagMetadata(inc);
      const hasReviewableNodes = typeof inc.nodesCount === 'number' && inc.nodesCount > 0;
      if (!hasReviewableNodes) {
        // Infra failure — route to scanWarnings (F8), do NOT elevate to SC verdict.
        scanWarnings.push(
          `axe rule ${inc.id} reported incomplete with zero reviewable nodes on ${pageUrl}; ` +
            `infra failure (script timeout / cross-origin / engine snag). Does not affect SC verdicts.`,
        );
        continue;
      }
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyReviewableIncomplete = true;
        b.relatedRules.add(inc.id);
        b.pages.add(pageUrl);
        if (b.examples.length < 5) {
          b.examples.push({ pageUrl, ruleId: inc.id, impact: inc.impact ?? null });
        }
      }
    }
    for (const ina of inapplicableDetail ?? []) {
      const meta = withActAndWcagMetadata(ina);
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyInapplicable = true;
        b.relatedRules.add(ina.id);
        b.pages.add(pageUrl);
      }
    }
  }

  for (const page of axeResults) {
    ingestPage(
      String(page?.url ?? ''),
      page?.violations ?? [],
      page?.passesDetail ?? [],
      page?.incompleteDetail ?? [],
      page?.inapplicableDetail ?? [],
    );
  }

  for (const proc of processResults) {
    for (const state of proc?.states ?? []) {
      const stateUrl = `${proc?.startUrl ?? ''}#${state?.state ?? 'state'}`;
      ingestPage(
        stateUrl,
        state?.violations ?? [],
        state?.passesDetail ?? [],
        state?.incompleteDetail ?? [],
        state?.inapplicableDetail ?? [],
      );
    }
  }

  // ANCHOR: VerdictEmit — one outcome per SC bucket.
  /** @type {CriterionOutcome[]} */
  const criteriaOutcomes = [];
  const sortedScs = [...buckets.keys()].sort(compareScs);
  for (const sc of sortedScs) {
    const b = /** @type {ScBucket} */ (buckets.get(sc));
    criteriaOutcomes.push({
      sc,
      level: /** @type {string | null} */ (
        Object.prototype.hasOwnProperty.call(SC_LEVEL_MAP, sc)
          ? SC_LEVEL_MAP[/** @type {keyof typeof SC_LEVEL_MAP} */ (sc)]
          : null
      ),
      outcome: decideOutcome(b),
      examples: [...b.examples],
      pagesExamined: b.pages.size,
      relatedRules: [...b.relatedRules].sort(),
    });
  }

  return {
    criteriaOutcomes,
    evaluationDate: new Date().toISOString(),
    processesEvaluated: Array.isArray(ctx?.config?.processes)
      ? ctx.config.processes
          .map((p) => (typeof p?.name === 'string' ? p.name : ''))
          .filter(Boolean)
      : [],
    scanWarnings,
    wcagVersion: wcagEmConfig.wcagVersion ?? '2.2',
    conformanceTarget: wcagEmConfig.conformanceTarget ?? 'AA',
    atBaseline: Array.isArray(wcagEmConfig.atBaseline) ? [...wcagEmConfig.atBaseline] : [],
    technologiesReliedUpon: Array.isArray(wcagEmConfig.technologiesReliedUpon)
      ? [...wcagEmConfig.technologiesReliedUpon]
      : [],
    samplingMethodNotes:
      typeof wcagEmConfig.samplingMethodNotes === 'string' ? wcagEmConfig.samplingMethodNotes : '',
    evaluator: {
      name: typeof wcagEmConfig.evaluator?.name === 'string' ? wcagEmConfig.evaluator.name : '',
      contact:
        typeof wcagEmConfig.evaluator?.contact === 'string' ? wcagEmConfig.evaluator.contact : '',
    },
  };
}

// SECTION: Internal helpers

/**
 * EARL outcome decision tree. Order matters — earliest match wins so
 * `failed` overrides everything else.
 *
 * @param {{
 *   anyViolation: boolean,
 *   anyNonBestPracticePass: boolean,
 *   anyReviewableIncomplete: boolean,
 *   anyInapplicable: boolean,
 * }} bucket
 * @returns {'passed' | 'failed' | 'cantTell' | 'inapplicable' | 'untested'}
 */
function decideOutcome(bucket) {
  if (bucket.anyViolation) return 'failed';
  if (bucket.anyReviewableIncomplete) return 'cantTell';
  if (bucket.anyNonBestPracticePass) return 'passed';
  if (bucket.anyInapplicable) return 'inapplicable';
  // Bucket exists only because SOME rule tagged this SC — but none of the above
  // fired. This shouldn't happen in practice (a bucket is always populated by
  // at least one arm), but if it does, `untested` is the safest fallback.
  return 'untested';
}

/**
 * Natural numeric sort for SC strings like "1.2.10" (10 must sort after 9).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareScs(a, b) {
  const [ap, ag, ac] = a.split('.').map(Number);
  const [bp, bg, bc] = b.split('.').map(Number);
  return ap - bp || ag - bg || ac - bc;
}
