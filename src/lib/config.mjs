// @ts-check
/**
 * @file Configuration loader and DEFAULTS merge base.
 * @module lib/config
 *
 * @description
 * Reads the config JSON from disk and deep-merges it against `DEFAULTS`.
 * Validation lives in `lib/validate-config.mjs` (Ajv 2020 +
 * better-ajv-errors against `schemas/config.schema.json`) and runs in
 * `context.mjs` during `buildContext()`. This module has no opinion on
 * validity beyond what JSON.parse enforces.
 *
 * The compile-at-load step that attaches `crawl.excludeUrlPatternsCompiled`
 * also lives in `context.mjs` because it must run AFTER Ajv has confirmed
 * each pattern compiles.
 *
 * @see docs/adr/0001-project-conventions.md
 * @see docs/adr/0002-config-is-ajv-validated.md
 * @see docs/adr/0005-fail-fast-on-config.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from './args.mjs';

// SECTION: Constants

// ANCHOR: DEFAULT_DOCUMENT_LINK_PATTERNS — pathname-anchored regex sources matching
// non-HTML document/archive/installer/media/e-book/design-binary/data-file URLs.
// Wired into discover.mjs's transformRequestFunction (and sitemap-seed loop) via
// `config.crawl.documentLinkPatternsCompiled`; matching links are dropped before
// Crawlee enqueues them. Each entry is one regex per logical filetype family so the
// compiled `RegExp[]` stays compact and the source list reads as a taxonomy.
//
// AU dogfood (2026-05-02) showed Crawlee retrying 7 broken document links 3× each
// before dropping (~27s wasted). On real client sites with hundreds of document
// references this could 10× the discover stage. Power users override via
// `crawl.documentLinkPatterns: [...]` (e.g. set to `[]` to crawl PDFs as page-
// equivalents on a docs-site audit).
export const DEFAULT_DOCUMENT_LINK_PATTERNS = [
  '\\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf)$', // documents
  '\\.(zip|tar|tar\\.gz|tgz|gz|bz2|xz|7z|rar)$', // archives
  '\\.(dmg|exe|iso|pkg|deb|rpm|msi)$', // installers
  '\\.(mp4|mov|avi|mkv|webm|flv|m4v)$', // video
  '\\.(mp3|wav|flac|ogg|m4a|aac)$', // audio
  '\\.(epub|mobi|azw3?)$', // e-books
  '\\.(psd|ai|sketch|fig|xd)$', // design binaries
  '\\.(sqlite|db)$', // data files
];

// ANCHOR: DEFAULTS — every key the toolkit understands, with a shippable default.
// Layer 3a landed `scan.viewports` (sentinel), `crawl.requestDelayMs`, the
// default axe tag profile, `reporting.failOnFindings`, and deleted the legacy
// `scan.viewport` singleton so DEFAULT_VIEWPORTS becomes reachable via
// `resolveViewports`. Layer 3b adds `auth`, `wcagEm`. Layer 4 adds
// `reporting.reporters`.
const DEFAULTS = {
  scope: {
    mode: 'same-hostname',
    allowedHosts: [],
  },
  crawl: {
    maxPages: 80,
    maxConcurrency: 5,
    requestTimeoutSecs: 90,
    // Crawl throttle in ms; wired into the Crawlee crawler's
    // `preNavigationHooks` in `src/commands/discover.mjs` (R7). 0 = no delay.
    requestDelayMs: 0,
    sitemapSeeding: {
      enabled: true,
      urls: [],
      commonPaths: ['/sitemap.xml', '/sitemap_index.xml'],
      maxUrls: 500,
    },
    excludeUrlPatterns: [],
    documentLinkPatterns: DEFAULT_DOCUMENT_LINK_PATTERNS,
  },
  discovery: {
    captureH1: true,
    captureCanonical: true,
    captureForms: true,
    captureLandmarks: true,
    captureSearchInputs: true,
  },
  sample: {
    structuredManual: [],
    autoSuggest: {
      enabled: true,
      perCluster: 1,
      preferTypes: ['homepage', 'form-or-contact', 'policy', 'listing', 'detail', 'content'],
    },
    randomPercentOfStructured: 0.1,
    minRandomPages: 2,
    randomSeed: 1,
    smallSiteSupplementaryScanThreshold: 50,
  },
  scan: {
    // Neither `viewports` nor `viewport` is shipped in DEFAULTS. Users who
    // want multi-viewport scans set `scan.viewports: [...]` explicitly; the
    // schema's `minItems: 1` rejects an empty-array opt-in, so there is no
    // meaningful sentinel to ship. When both are absent, `resolveViewports`
    // falls through to `DEFAULT_VIEWPORTS` (desktop + reflow).
    waitUntil: 'domcontentloaded',
    timeoutMs: 60000,
    retries: 1,
    fullPageScreenshots: true,
    axe: {
      include: [],
      exclude: [],
      withRules: [],
      // Layer 3a default tag profile — WCAG 2.0/2.1/2.2 A + AA. ACT tag
      // lands in Layer 3b alongside the ACT rule map.
      withTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      runOnly: null,
    },
  },
  reporting: {
    groupBestPracticeSeparately: true,
    // Layer 4 R2: `markdownReport` dropped from DEFAULTS (it was schema-
    // accepted but never read at runtime). `reporters` intentionally absent
    // from DEFAULTS too — summarize.mjs applies `?? ['json','markdown']`
    // inline so that absence in user config means "default set," while
    // presence of `markdownReport` in user config triggers a one-shot
    // deprecation warning via `warnLegacyAliasResolved`.
    // Threshold-based exit code 2 wiring lives in summarize.mjs (R8).
    // `impacts` matches any axe impact; `classifications` matches the
    // classifyRule buckets; count ≥ threshold → exit 2.
    failOnFindings: {
      impacts: ['critical', 'serious'],
      classifications: [],
      threshold: 1,
    },
  },
  // WCAG-EM Step 5 report metadata. Layer 3b's `toWcagEmSummary` (R10)
  // reads these fields into the emitted `wcag-em-summary.json` alongside
  // auto-computed `evaluationDate` and `processesEvaluated`. Sensible
  // defaults so users without explicit wcagEm config still get a valid
  // WCAG 2.2 AA report shell — they can override any field.
  wcagEm: {
    wcagVersion: '2.2',
    conformanceTarget: 'AA',
    atBaseline: [],
    technologiesReliedUpon: ['HTML', 'CSS', 'JavaScript', 'WAI-ARIA'],
    samplingMethodNotes: '',
    evaluator: { name: '', contact: '' },
  },
  // `auth` is intentionally ABSENT from DEFAULTS — absence means "no auth
  // required". `applyAuth` in auth.mjs handles the no-auth case by
  // returning empty contextOptions. Users who want authenticated scans
  // see the sidecar `configs/example-site-with-auth.json` for a worked
  // example.
  processes: [],
};

// SECTION: Public API

/**
 * @typedef {object} LoadConfigResult
 * @property {Record<string, any>} config - DEFAULTS-merged, validated config.
 * @property {string} configPath - Absolute path to the source JSON file.
 * @property {Record<string, string | boolean>} args - Parsed CLI arguments.
 */

/**
 * Load, default-merge, and validate a config file.
 *
 * Resolution priority: explicit `overridePath` argument → `--config` CLI
 * flag → `configs/example-site.json` fallback. `overridePath` is the hook
 * programmatic API callers use to point at an arbitrary config file without
 * having to mutate `process.argv`.
 *
 * @param {string} [overridePath] - Absolute or relative path; wins over argv.
 * @returns {Promise<LoadConfigResult>}
 */
export async function loadConfig(overridePath) {
  const args = parseArgs();
  const configPath =
    overridePath ?? (typeof args.config === 'string' ? args.config : 'configs/example-site.json');
  const resolved = path.resolve(configPath);
  const raw = await fs.readFile(resolved, 'utf8');
  const config = deepMerge(DEFAULTS, JSON.parse(raw));
  return { config, configPath: resolved, args };
}

// SECTION: Internal helpers

/**
 * Recursively merge `override` on top of `base`. Arrays replace wholesale so
 * user-supplied arrays don't accidentally concat with DEFAULTS.
 *
 * @param {any} base
 * @param {any} override
 * @returns {any}
 */
function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (typeof base !== 'object' || typeof override !== 'object' || !base || !override) {
    return override ?? base;
  }
  /** @type {Record<string, any>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return out;
}
