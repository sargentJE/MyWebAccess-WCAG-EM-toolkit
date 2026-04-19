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

// SECTION: Constants

// ANCHOR: REPLACEABLE_KEYS — axe-config keys that a per-URL override may replace.
// `urlPattern`, `actions`, and internal helpers (`regex`) are NOT in this set —
// they are matching / orchestration metadata, not axe-config surface.
const REPLACEABLE_KEYS = /** @type {const} */ ([
  'include',
  'exclude',
  'withRules',
  'withTags',
  'runOnly',
]);

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

// ANCHOR: isValidRunOnly — shape guard for axe `runOnly` option
/**
 * Is an `axe.runOnly` value structurally valid?
 *
 * Layer 1's Ajv schema rejects malformed `runOnly` at config-load, but stale
 * v0.3 configs constructed programmatically may still reach `scan.mjs` with
 * the wrong shape. This defence-in-depth predicate keeps the builder call
 * off a clearly-bad value rather than letting axe throw a cryptic error.
 *
 * Valid shape: `{ type: string, values: string[] }`.
 *
 * @param {unknown} runOnly
 * @returns {boolean}
 */
export function isValidRunOnly(runOnly) {
  return (
    typeof runOnly === 'object' &&
    runOnly !== null &&
    typeof /** @type {any} */ (runOnly).type === 'string' &&
    Array.isArray(/** @type {any} */ (runOnly).values)
  );
}

// ANCHOR: findMatchingOverride — first-match-wins per-URL override lookup.
/**
 * Return the first compiled override whose `.regex` matches `url`, or null.
 *
 * Precedence is first-match-wins (not last-match, not all-matches-merge):
 * predictable config-file ordering for users; matches Pa11y's per-URL
 * precedence. `overridesCompiled` entries are built by `context.mjs`
 * (ANCHOR: CompileOverrides) — each has `.regex` plus the original
 * override's own-keys.
 *
 * @param {string} url
 * @param {Array<{regex: RegExp} & Record<string, any>>} overridesCompiled
 * @returns {(Record<string, any>) | null}
 */
export function findMatchingOverride(url, overridesCompiled) {
  if (!Array.isArray(overridesCompiled) || overridesCompiled.length === 0) return null;
  for (const entry of overridesCompiled) {
    if (entry && entry.regex instanceof RegExp && entry.regex.test(url)) return entry;
  }
  return null;
}

// ANCHOR: applyAxeOverride — replace-if-defined merge for per-URL overrides.
/**
 * Merge a per-URL override on top of a base axe-config.
 *
 * For each key in REPLACEABLE_KEYS, the override replaces the base IF the
 * override's own object has the key — using
 * `Object.prototype.hasOwnProperty.call(override, key)` as the detection
 * predicate. This correctly distinguishes `runOnly: null` (defined-as-null =
 * clear runOnly) from absent (inherit base). Otherwise the base is
 * inherited. No array-merge — consistent with `deepMerge`'s array-replace
 * behaviour at config-load.
 *
 * Pure function; neither argument is mutated.
 *
 * @param {Record<string, any>} baseAxeConfig
 * @param {Record<string, any> | null} [override]
 * @returns {Record<string, any>}
 */
export function applyAxeOverride(baseAxeConfig, override) {
  if (!override) return baseAxeConfig;
  /** @type {Record<string, any>} */
  const merged = { ...baseAxeConfig };
  for (const key of REPLACEABLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(override, key)) {
      merged[key] = override[key];
    }
  }
  return merged;
}
