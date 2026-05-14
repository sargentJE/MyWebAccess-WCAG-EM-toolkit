// @ts-check
/**
 * @file URL normalisation, scoping, and classification helpers.
 * @module lib/urls
 *
 * @description
 * The URL-shaped swiss army knife of the toolkit. Used by every pipeline stage:
 *  - `normalizeUrl` — canonical form (hash strip, default ports drop, tracking
 *    params strip, query sort, trailing slash trim) so the same page discovered
 *    via two links dedupes correctly.
 *  - `fileSafeFromUrl` — safe filesystem names for screenshots / artefacts.
 *  - `guessPageType`, `clusterKeyFor`, `guessProcessTypes`, `selectorComponentHint`
 *    — heuristic classifiers used for sampling and grouped reporting.
 *    NOTE: these classifiers are intentionally marked `@internal` in v1.0 —
 *    ADR-0012 records the decision to defer a plugin API to v2.0.
 *  - `urlAllowedByScope`, `urlExcludedByPatterns` — scope enforcement.
 *
 * @see docs/adr/0012-extensibility-is-internal-for-v1.md
 */

// SECTION: Constants

// ANCHOR: TRACKING_PARAM_PATTERNS — query params stripped during normalisation
const TRACKING_PARAM_PATTERNS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_/i];

// SECTION: Public API — URL shape

/**
 * Return a canonicalised URL string.
 *
 * Normalisation rules (locked in ADR-0001 via the reuse-over-rewrite clause):
 *  - Strip `#fragment`.
 *  - Drop default ports (`:443` for https, `:80` for http).
 *  - Remove tracking params (`utm_*`, `fbclid`, `gclid`, `mc_*`) unless
 *    `options.removeTrackingParams === false`.
 *  - Sort remaining query params alphabetically.
 *  - Trim trailing slash (except when the path is just `/`).
 *
 * @param {string} rawUrl
 * @param {{ removeTrackingParams?: boolean }} [options]
 * @returns {string} Canonical URL.
 */
export function normalizeUrl(rawUrl, options = {}) {
  const url = new URL(rawUrl);
  url.hash = '';

  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = '';
  }

  if (options.removeTrackingParams !== false) {
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
        url.searchParams.delete(key);
      }
    }
  }

  const ordered = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [key, value] of ordered) url.searchParams.append(key, value);

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

/**
 * Produce a filename-safe version of a URL (used for screenshot paths).
 *
 * @param {string} url
 * @returns {string}
 */
export function fileSafeFromUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
}

/**
 * First non-empty path segment (or `(root)` for `/`).
 *
 * @param {string} urlString
 * @returns {string}
 */
export function firstPathSegment(urlString) {
  const url = new URL(urlString);
  return url.pathname.split('/').filter(Boolean)[0] ?? '(root)';
}

// SECTION: Public API — classification (internal, plugin API deferred)

/**
 * Heuristic page-type classifier used for sampling and clustering.
 * Plugin API deferred to v2.0 per ADR-0012.
 *
 * @internal
 * @param {string} urlString
 * @returns {'homepage' | 'policy' | 'form-or-contact' | 'search-or-results'
 *   | 'process-entry' | 'listing' | 'detail' | 'content'}
 */
export function guessPageType(urlString) {
  const url = new URL(urlString);
  const segments = url.pathname.split('/').filter(Boolean);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '') return 'homepage';
  if (/privacy|terms|cookies|policy|accessibility/i.test(pathname)) return 'policy';
  if (/contact|support|get-in-touch/i.test(pathname)) return 'form-or-contact';
  if (/search|results/i.test(pathname)) return 'search-or-results';
  if (/cart|basket|checkout|book|apply|register|signup|sign-up/i.test(pathname))
    return 'process-entry';
  if (
    (/blog|latest|news|articles/i.test(pathname) ||
      /our-work|portfolio|projects|case-studies/i.test(pathname)) &&
    segments.length === 1
  )
    return 'listing';
  if (segments.length >= 2) return 'detail';
  return 'content';
}

/**
 * Cluster key — pairs page type with its first path segment so similarly-
 * shaped URLs group together (e.g. all `detail::our-work` pages cluster).
 *
 * @internal
 * @param {string} urlString
 * @param {string} pageType
 * @returns {string}
 */
export function clusterKeyFor(urlString, pageType) {
  const seg = firstPathSegment(urlString);
  return `${pageType}::${seg}`;
}

/**
 * Heuristic process-type guess from URL + page metadata.
 *
 * @internal
 * @param {{ url: string, formCount?: number, searchInputCount?: number }} input
 * @returns {string[]}
 */
export function guessProcessTypes({ url, formCount = 0, searchInputCount = 0 }) {
  /** @type {string[]} */
  const types = [];
  if (/contact|support/i.test(url) || formCount > 0) types.push('form');
  if (/search|results/i.test(url) || searchInputCount > 0) types.push('search');
  if (/checkout|basket|cart|book|register|apply/i.test(url)) types.push('critical-process');
  return [...new Set(types)];
}

/**
 * Best-effort "component hint" from a CSS selector — used to group axe
 * findings by likely design-system component. Crude by design; see ADR-0012.
 *
 * @internal
 * @param {string} [selector]
 * @returns {string}
 */
export function selectorComponentHint(selector = '') {
  if (!selector) return 'unknown';
  const first = selector.split(' | ')[0].trim();
  if (first.startsWith('#')) return `id:${first.slice(1).split(/[ >.:[]/, 1)[0]}`;
  if (first.startsWith('.')) return `class:${first.slice(1).split(/[ >.:[]/, 1)[0]}`;
  return `selector:${first.split(/[ >]/, 1)[0]}`;
}

// SECTION: Public API — scope enforcement

/**
 * @typedef {object} Scope
 * @property {'same-hostname' | 'same-origin' | 'allowed-hosts'} mode - Scope discipline.
 * @property {string[]} [allowedHosts] - Extra hostnames when `mode === 'allowed-hosts'`.
 */

/**
 * Is a target URL in scope for the current run?
 *
 * @param {string} targetUrl
 * @param {string} rootUrl
 * @param {Scope} scope
 * @returns {boolean}
 */
export function urlAllowedByScope(targetUrl, rootUrl, scope) {
  const target = new URL(targetUrl);
  const root = new URL(rootUrl);

  if (scope.mode === 'same-origin') return target.origin === root.origin;
  if (scope.mode === 'same-hostname') return target.hostname === root.hostname;
  if (scope.mode === 'allowed-hosts') {
    const allowedHosts = new Set([root.hostname, ...(scope.allowedHosts || [])]);
    return allowedHosts.has(target.hostname);
  }
  return false;
}

/**
 * Match a URL against user-supplied exclude patterns.
 *
 * Patterns are compiled once at config-load (see the `CompileRuntimeFields`
 * block in `src/lib/context.mjs`) and threaded through as a `RegExp[]` so
 * this hot path never touches `new RegExp(...)`. Bad regex source strings
 * fail at Ajv validation time via the `validRegex` keyword, not mid-crawl.
 *
 * @param {string} urlString
 * @param {RegExp[]} [compiledPatterns] - Pre-compiled patterns.
 * @returns {boolean}
 * @see docs/adr/0005-fail-fast-on-config.md
 */
export function urlExcludedByPatterns(urlString, compiledPatterns = []) {
  return compiledPatterns.some((rx) => rx.test(urlString));
}

/**
 * Skip a URL if its pathname matches any of the compiled document-link patterns.
 *
 * Pathname-only check is a deliberate departure from `urlExcludedByPatterns`'s
 * full-URL matching: extensions are pathname-properties (`file.pdf?download=1`'s
 * pathname is `/file.pdf`), and matching against pathname sidesteps querystring
 * + fragment gotchas without coupling regex sources to URL syntax.
 *
 * Defensive try/catch mirrors `normalizeUrl`'s style — bad URL strings return
 * `false` (safe default: don't skip; let downstream handlers surface the
 * malformation).
 *
 * Wired into `src/commands/discover.mjs`'s `transformRequestFunction` and
 * sitemap-seed loop. Compiled patterns live at
 * `config.crawl.documentLinkPatternsCompiled` (set in `context.mjs` post-Ajv
 * validation, mirroring the `excludeUrlPatternsCompiled` discipline).
 *
 * @param {string} urlString
 * @param {RegExp[]} [compiledPatterns]
 * @returns {boolean}
 * @see docs/adr/0005-fail-fast-on-config.md
 */
export function urlSkippedByExtension(urlString, compiledPatterns = []) {
  if (!compiledPatterns.length) return false;
  let pathname;
  try {
    pathname = new URL(urlString).pathname;
  } catch {
    return false;
  }
  return compiledPatterns.some((rx) => rx.test(pathname));
}
