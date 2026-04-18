// @ts-check
/**
 * @file Deterministic sampling primitives used by the sample-building stage.
 * @module lib/sample-utils
 *
 * @description
 * Two tiny helpers:
 *  - `seededSample` — Fisher–Yates shuffle backed by a Linear Congruential
 *    Generator (LCG), so the same seed always produces the same output.
 *  - `unique` — dedupe an array while dropping falsy entries.
 *
 * NOTE: The LCG is chosen for **reproducibility**, not statistical rigour.
 * WCAG-EM Step 3 requires the random sample selection method to be recorded
 * so audits are repeatable. A cryptographic RNG would be overkill and would
 * break that contract. See the `sample.randomSeed` field in the config schema.
 *
 * ANCHOR: LCG_CONSTANTS — 9301 / 49297 / 233280 are the Park–Miller / Numerical
 * Recipes variant; the combination is widely used for cheap reproducible PRNGs.
 *
 * @see https://www.w3.org/TR/WCAG-EM/#step3c
 */

// SECTION: Public API

/**
 * Seeded Fisher–Yates shuffle returning the first `count` elements.
 *
 * @template T
 * @param {T[]} pool - Candidate elements; not mutated.
 * @param {number} count - Desired sample size (clamped to `pool.length`).
 * @param {number} seed - Integer seed — same seed ⇒ same output.
 * @returns {T[]} Shuffled slice.
 */
export function seededSample(pool, count, seed) {
  const copy = [...pool];
  let t = seed;
  // ANCHOR: LCG_CONSTANTS
  function rng() {
    t = (t * 9301 + 49297) % 233280;
    return t / 233280;
  }
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/**
 * Remove duplicates and falsy entries, preserving first-seen order.
 *
 * @template T
 * @param {T[]} items
 * @returns {T[]}
 */
export function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
