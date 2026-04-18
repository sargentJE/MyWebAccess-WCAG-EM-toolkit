// @ts-check
/**
 * @file axe-core rule classification helpers.
 * @module lib/axe-utils
 *
 * @description
 * Shared logic for interpreting axe-core rule metadata. v1.0 only exports
 * `classifyRule`; Layer 3b extends this module with `withActAndWcagMetadata`
 * (enriches a rule with ACT rule IDs and WCAG SC numbers from the static
 * maps under `src/data/`).
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 * @see https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md
 */

// SECTION: Public API

/**
 * @typedef {object} ClassifyResult
 * @property {boolean} bestPractice - True when axe tagged the rule `best-practice`.
 * @property {'best-practice-or-manual-review' | 'primary-automated-finding'} classification
 *   - Bucket used by the reporters to split best-practice findings from
 *     WCAG-tagged primary findings, per ADR-0007.
 */

/**
 * Classify an axe-core rule object against the run's reporting configuration.
 *
 * `best-practice` findings are separated from primary findings by default so
 * reports do not conflate industry-convention issues with WCAG failures. The
 * caller can override this by setting
 * `reportingConfig.groupBestPracticeSeparately = false`.
 *
 * @param {{ tags?: string[] }} rule - axe rule object (shape: `axe.Rule`).
 * @param {{ groupBestPracticeSeparately?: boolean }} [reportingConfig]
 * @returns {ClassifyResult}
 */
export function classifyRule(rule, reportingConfig = {}) {
  const tags = new Set(rule.tags || []);
  const bestPractice = tags.has('best-practice');
  return {
    bestPractice,
    classification:
      bestPractice && reportingConfig.groupBestPracticeSeparately !== false
        ? 'best-practice-or-manual-review'
        : 'primary-automated-finding',
  };
}
