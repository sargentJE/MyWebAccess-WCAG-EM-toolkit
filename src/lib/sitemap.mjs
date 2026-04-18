// @ts-check
/**
 * @file Sitemap discovery — pulls URLs from sitemap.xml / sitemap_index.xml.
 * @module lib/sitemap
 *
 * @description
 * Best-effort sitemap crawler used by `discover` to seed the inventory with
 * URLs the user's site advertises. Recurses into nested `<loc>.../*.xml` index
 * entries up to the configured `maxUrls` cap. Failures are swallowed by design
 * — a missing sitemap must not abort discovery.
 *
 * Scope enforcement delegates to `urlAllowedByScope` from `./urls.mjs` so all
 * three modes (`same-hostname`, `same-origin`, `allowed-hosts`) are respected
 * uniformly with the rest of the crawler.
 *
 * @see docs/adr/0005-fail-fast-on-config.md
 * @see https://www.sitemaps.org/protocol.html
 */

// SECTION: Imports
import { normalizeUrl, urlAllowedByScope } from './urls.mjs';

// SECTION: Public API

/**
 * @typedef {object} SitemapSeeding
 * @property {boolean} [enabled] - Run the sitemap walker at all.
 * @property {string[]} [urls] - Explicit sitemap URLs (absolute).
 * @property {string[]} [commonPaths] - Paths resolved against `rootUrl` (e.g. `/sitemap.xml`).
 * @property {number} [maxUrls] - Cap on total URLs returned; default 500.
 */

/**
 * @typedef {object} Scope
 * @property {'same-hostname' | 'same-origin' | 'allowed-hosts'} mode - Scope discipline.
 * @property {string[]} [allowedHosts] - Extra hostnames when `mode === 'allowed-hosts'`.
 */

/**
 * Walk a site's sitemap(s) and return a deduplicated array of in-scope page URLs.
 *
 * @param {string} rootUrl - Absolute URL of the site root; used to resolve
 *   relative `commonPaths` and for hostname scoping.
 * @param {SitemapSeeding | undefined} sitemapSeeding - Subsection of
 *   `config.crawl.sitemapSeeding`. Returns `[]` when disabled or absent.
 * @param {Scope} scope - Run scope; controls hostname filtering.
 * @returns {Promise<string[]>} Normalised URLs (hash-stripped, slash-trimmed,
 *   tracking-params-stripped per `normalizeUrl`).
 */
export async function getSitemapSeeds(rootUrl, sitemapSeeding, scope) {
  if (!sitemapSeeding?.enabled) return [];

  // ANCHOR: InitialQueue — explicit URLs plus common paths resolved to absolute
  const queue = [
    ...new Set([
      ...(sitemapSeeding.urls || []),
      ...(sitemapSeeding.commonPaths || []).map((p) => new URL(p, rootUrl).toString()),
    ]),
  ];
  /** @type {Set<string>} */
  const seenDocs = new Set();
  /** @type {Set<string>} */
  const foundUrls = new Set();
  const maxUrls = Number(sitemapSeeding.maxUrls ?? 500);

  // ANCHOR: CrawlLoop — BFS with maxUrls cap
  while (queue.length > 0 && foundUrls.size < maxUrls) {
    const sitemapUrl = /** @type {string} */ (queue.shift());
    if (seenDocs.has(sitemapUrl)) continue;
    seenDocs.add(sitemapUrl);

    try {
      const res = await fetch(sitemapUrl, { redirect: 'follow' });
      if (!res.ok) continue;
      const text = await res.text();
      // NOTE: `<loc>` regex is good enough here — we don't need a full XML parser
      // for sitemaps, which are flat and well-formed by convention.
      const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
      for (const loc of locs) {
        if (/\.xml($|\?)/i.test(loc)) {
          // Nested sitemap index — enqueue for recursion.
          if (!seenDocs.has(loc)) queue.push(loc);
          continue;
        }
        try {
          const normalized = normalizeUrl(loc);
          // LINK: src/lib/urls.mjs → urlAllowedByScope handles all three modes.
          if (urlAllowedByScope(normalized, rootUrl, scope)) {
            foundUrls.add(normalized);
            if (foundUrls.size >= maxUrls) break;
          }
        } catch {
          // ignore malformed URLs
        }
      }
    } catch {
      // ignore sitemap fetch failures — discovery tolerates missing sitemaps
    }
  }

  return [...foundUrls];
}
