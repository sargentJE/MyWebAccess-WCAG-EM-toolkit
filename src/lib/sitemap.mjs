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
 * @property {number} [maxSitemapDocs] - Anti-amplification cap on sitemap
 *   DOCUMENTS fetched while expanding the index tree; default 50.
 */

/**
 * @typedef {object} SitemapSeedResult
 * @property {string[]} seeds - Deduplicated, in-scope page URLs (the seed list).
 * @property {Array<{ url: string, found: number, contributed: number, clipped: number }>} perSitemap
 *   - Per-leaf telemetry: URLs found, contributed to the seed list, and clipped by the budget.
 * @property {boolean} reachedSitemapCap - True if any leaf had URLs clipped by `maxUrls`.
 * @property {string[]} neverReached - Sitemap documents left unfetched by the `maxSitemapDocs` bound.
 * @property {number} sitemapDocsFetched - Total sitemap documents actually fetched.
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
 * @returns {Promise<SitemapSeedResult>} The seed list plus per-leaf telemetry.
 *   Seeds are normalised (hash-stripped, slash-trimmed, tracking-params-stripped).
 */
export async function getSitemapSeeds(rootUrl, sitemapSeeding, scope) {
  /** @type {SitemapSeedResult} */
  const empty = {
    seeds: [],
    perSitemap: [],
    reachedSitemapCap: false,
    neverReached: [],
    sitemapDocsFetched: 0,
  };
  if (!sitemapSeeding?.enabled) return empty;

  const maxUrls = Number(sitemapSeeding.maxUrls ?? 500);
  const maxSitemapDocs = Number(sitemapSeeding.maxSitemapDocs ?? 50);

  // ANCHOR: ExpandIndexTree — Phase 1. BFS over the sitemap tree, classifying
  // each document by its ROOT ELEMENT (<sitemapindex> vs <urlset>) rather than
  // by per-loc URL extension — so `/sitemap?page=2` index children and `.xml`
  // content URLs are handled correctly. Bounds total DOCUMENTS fetched
  // (anti-amplification: a malicious index could otherwise fan out to thousands
  // of fetches). Fetches are sequential — see DeterminismNote below.
  const queue = [
    ...new Set([
      ...(sitemapSeeding.urls || []),
      ...(sitemapSeeding.commonPaths || []).map((p) => new URL(p, rootUrl).toString()),
    ]),
  ];
  /** @type {Set<string>} */
  const seenDocs = new Set();
  /** @type {Array<{ url: string, locs: string[] }>} */
  const leaves = [];
  /** @type {string[]} */
  const neverReached = [];
  let sitemapDocsFetched = 0;

  while (queue.length > 0) {
    const sitemapUrl = /** @type {string} */ (queue.shift());
    if (seenDocs.has(sitemapUrl)) continue;
    seenDocs.add(sitemapUrl);
    if (sitemapDocsFetched >= maxSitemapDocs) {
      // Bound hit — record the rest as never-reached instead of fetching them.
      neverReached.push(sitemapUrl);
      continue;
    }

    let text;
    try {
      const res = await fetch(sitemapUrl, { redirect: 'follow' });
      if (!res.ok) continue;
      text = await res.text();
      sitemapDocsFetched += 1;
    } catch {
      // ignore sitemap fetch failures — discovery tolerates missing sitemaps
      continue;
    }

    // NOTE: `<loc>` regex is good enough — sitemaps are flat and well-formed by
    // convention; a full XML parser would be overkill.
    const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
    if (/<sitemapindex[\s>]/i.test(text)) {
      // Index document — every loc is a child sitemap. Enqueue for recursion.
      for (const loc of locs) if (!seenDocs.has(loc)) queue.push(loc);
      continue;
    }

    // Leaf (urlset) — every loc is a page URL. Collect in-scope URLs, sorted +
    // deduped so the round-robin below is deterministic regardless of the order
    // the bytes arrived in.
    /** @type {Set<string>} */
    const pages = new Set();
    for (const loc of locs) {
      try {
        const normalized = normalizeUrl(loc);
        // LINK: src/lib/urls.mjs → urlAllowedByScope handles all three modes.
        if (urlAllowedByScope(normalized, rootUrl, scope)) pages.add(normalized);
      } catch {
        // ignore malformed URLs
      }
    }
    leaves.push({ url: sitemapUrl, locs: [...pages].sort() });
  }

  // ANCHOR: RoundRobinReservoir — Phase 2. Pure round-robin across leaves sorted
  // by URL: round `r` takes each leaf's `r`-th URL until `maxUrls`. No
  // proportional/floor allocation — round-robin maximizes content-TYPE
  // representation (a 9-URL form sitemap gets in before a 1001-URL events
  // sitemap drowns it), and the downstream sampler clusters by pageType.
  //
  // DeterminismNote (WCAG-EM Step 3c): seeds must be reproducible given a fixed
  // randomSeed. Leaves are URL-sorted and each leaf's locs are pre-sorted, so
  // the positional pick is independent of fetch arrival order — do NOT
  // parallelize the fetches above.
  leaves.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  /** @type {Set<string>} */
  const seeds = new Set();
  /** @type {Map<string, number>} */
  const contributed = new Map();
  let round = 0;
  cap: while (seeds.size < maxUrls) {
    let anyThisRound = false;
    for (const leaf of leaves) {
      if (round >= leaf.locs.length) continue;
      anyThisRound = true;
      const url = leaf.locs[round];
      if (!seeds.has(url)) {
        seeds.add(url);
        contributed.set(leaf.url, (contributed.get(leaf.url) ?? 0) + 1);
        if (seeds.size >= maxUrls) break cap;
      }
    }
    if (!anyThisRound) break; // every leaf exhausted
    round += 1;
  }

  const perSitemap = leaves.map((l) => {
    const c = contributed.get(l.url) ?? 0;
    return { url: l.url, found: l.locs.length, contributed: c, clipped: l.locs.length - c };
  });

  return {
    seeds: [...seeds],
    perSitemap,
    reachedSitemapCap: perSitemap.some((s) => s.clipped > 0),
    neverReached,
    sitemapDocsFetched,
  };
}
