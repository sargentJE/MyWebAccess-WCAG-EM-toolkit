// @ts-check
/**
 * @file Viewport resolution for multi-viewport scans.
 * @module lib/viewports
 *
 * @description
 * Single authoritative helper for resolving which viewports a scan should
 * iterate. Consumed by `scan.mjs` and `scan-processes.mjs` so both commands
 * agree on the "defaults ∨ legacy-singleton ∨ user-array" precedence. Future
 * changes to viewport defaults (e.g. Layer 5's opt-in tablet / mobile)
 * touch only this file.
 *
 * Resolution order:
 *   1. `config.scan.viewports` — user-supplied array wins when non-empty.
 *   2. `config.scan.viewport` — legacy singleton wrapped as
 *      `[{ id: 'legacy', ...viewport }]` with a deprecation warn.
 *   3. `DEFAULT_VIEWPORTS` — desktop + reflow baseline (WCAG 2.1 SC 1.4.10).
 *
 * @see docs/adr/0006-multi-viewport-axe-runs.md
 * @see https://www.w3.org/TR/WCAG21/#reflow
 */

// SECTION: Constants

/**
 * @typedef {object} Viewport
 * @property {string} id - Stable identifier (used in filenames, result keys).
 * @property {number} width - CSS pixels.
 * @property {number} height - CSS pixels.
 */

// ANCHOR: DEFAULT_VIEWPORTS — desktop + reflow baseline (WCAG 2.1 SC 1.4.10).
// Intentionally minimal — ADR-0006 records the narrow-scope decision and
// points auditors at `scan.viewports` for mobile / tablet additions.
/** @type {ReadonlyArray<Viewport>} */
export const DEFAULT_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'desktop', width: 1280, height: 800 }),
  Object.freeze({ id: 'reflow', width: 320, height: 800 }),
]);

// SECTION: Public API

/**
 * Resolve the viewport list for a scan.
 *
 * Pure function — no filesystem, no env. Tests pass a config object directly
 * rather than loading from disk so they remain valid across DEFAULTS evolution.
 *
 * @param {{ scan?: { viewports?: Viewport[], viewport?: { width?: number, height?: number } } }} config
 * @param {{ warn?: (obj: any, msg?: string) => void }} [logger]
 *   - Optional pino-compatible logger. When present and the legacy-singleton
 *     path is taken, a single deprecation warn is emitted.
 * @returns {ReadonlyArray<Viewport>}
 */
export function resolveViewports(config, logger) {
  const scan = config?.scan ?? {};

  // 1. User-supplied viewports[] wins when present AND non-empty.
  //    Ajv schema enforces minItems: 1, so a user-side empty array is
  //    unreachable from real configs; the empty-array branch here is
  //    reachable only from the DEFAULTS-side sentinel (config.mjs ships
  //    `scan.viewports: []`) and falls through to DEFAULT_VIEWPORTS.
  if (Array.isArray(scan.viewports) && scan.viewports.length > 0) {
    return scan.viewports;
  }

  // 2. Legacy singleton — wrap + warn once.
  //    Layer 5 deprecation policy: warn for one minor version, then remove.
  if (scan.viewport && typeof scan.viewport === 'object') {
    const { width, height } = scan.viewport;
    if (typeof width === 'number' && typeof height === 'number') {
      logger?.warn?.({ width, height }, 'scan.viewport is deprecated; migrate to scan.viewports[]');
      return [{ id: 'legacy', width, height }];
    }
  }

  // 3. Default: desktop + reflow.
  return DEFAULT_VIEWPORTS;
}
