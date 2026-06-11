// @ts-check
/**
 * @file `discover` command — builds the URL inventory from the site root.
 * @module commands/discover
 *
 * @description
 * Stage 1 of the pipeline. Seeds a PlaywrightCrawler from `config.rootUrl`
 * plus any URLs returned by `getSitemapSeeds`, applies scope + exclude
 * filters, and captures per-page metadata for clustering and process
 * detection downstream.
 *
 * Writes to `${ctx.paths.inventoryDir}/`:
 *   - inventory.json           (canonical; read by sample + summarize)
 *   - urls.txt                 (diagnostic)
 *   - page-clusters.json       (canonical; read by sample)
 *   - process-candidates.json  (diagnostic)
 *   - inventory-metadata.json  (diagnostic)
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 */

// SECTION: Imports
import path from 'node:path';
import { PlaywrightCrawler } from 'crawlee';
import { writeJson, writeText } from '../lib/fs-utils.mjs';
import {
  normalizeUrl,
  guessPageType,
  clusterKeyFor,
  guessProcessTypes,
  urlAllowedByScope,
  urlExcludedByPatterns,
  urlSkippedByExtension,
} from '../lib/urls.mjs';
import { getSitemapSeeds } from '../lib/sitemap.mjs';
import { TOOL_IDENTITY } from '../lib/version.mjs';
import { buildContext, ensurePreflight } from '../lib/context.mjs';

// SECTION: Pure helpers (exported for testability)

/**
 * Build a Crawlee-compatible `preNavigationHooks` entry that sleeps for
 * `requestDelayMs` before each navigation. Extracted as a pure async
 * function so tests exercise the timing contract without spinning up
 * Crawlee + Playwright.
 *
 * Treats any non-positive, NaN, or missing value as 0 (no delay) — this
 * matches the DEFAULTS and keeps bad configs inert rather than crashing.
 *
 * @param {number | undefined} requestDelayMs
 * @returns {() => Promise<void>}
 */
export function buildRequestDelayHook(requestDelayMs) {
  const ms = Number(requestDelayMs);
  return async () => {
    if (Number.isFinite(ms) && ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  };
}

/**
 * Capture per-page discovery metadata using plain DOM API. Designed to be
 * passed to `page.evaluate` so it executes in the browser context (Playwright
 * serializes the function source over CDP). Pure with respect to the
 * `document` global + `flags` arg — no closures over Node-side state.
 *
 * Replaces the previous locator-based capture chain that auto-waited on each
 * missing element up to the page default timeout, hanging the handler on any
 * page lacking `<h1>` or `<link rel=canonical>` (the toolkit's exact target
 * population — sites being audited for accessibility issues). plain
 * `document.querySelector*` returns null/0 immediately for missing elements.
 *
 * Tested in Node by stubbing `globalThis.document` before invocation.
 *
 * @param {{ captureH1: boolean, captureCanonical: boolean, captureForms: boolean, captureLandmarks: boolean, captureSearchInputs: boolean }} flags
 * @returns {{ h1: string|null, canonical: string|null, formCount: number, landmarkCount: number, searchInputCount: number }}
 */
export function captureDiscoveryMetadata(flags) {
  /* global document */
  const text = (/** @type {string} */ sel) => {
    const el = document.querySelector(sel);
    return el ? (el.textContent ?? null) : null;
  };
  const attr = (/** @type {string} */ sel, /** @type {string} */ name) => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute(name) : null;
  };
  const count = (/** @type {string} */ sel) => document.querySelectorAll(sel).length;
  return {
    h1: flags.captureH1 ? text('h1') : null,
    canonical: flags.captureCanonical ? attr('link[rel="canonical"]', 'href') : null,
    formCount: flags.captureForms ? count('form') : 0,
    landmarkCount: flags.captureLandmarks
      ? count(
          'main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]',
        )
      : 0,
    searchInputCount: flags.captureSearchInputs
      ? count('input[type="search"], input[role="searchbox"], form[role="search"] input')
      : 0,
  };
}

// SECTION: Public API

/**
 * Run the discover stage.
 *
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ inventoryCount: number }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;

  /** @type {Map<string, any>} */
  const discovered = new Map();
  /** @type {Set<string>} */
  const excludedOutOfScope = new Set();
  /** @type {Set<string>} */
  const excludedByPattern = new Set();
  /** @type {Set<string>} */
  const excludedByExtension = new Set();
  const seeds = [normalizeUrl(config.rootUrl)];

  // ANCHOR: SitemapSeeding — optional uplift when the site advertises a sitemap.
  // Filters early-exit per check (mirrors the per-filter return-false pattern in
  // transformRequestFunction below) so the extension-skip counter only fires for
  // URLs that would otherwise have been seeded — out-of-scope and pattern-excluded
  // URLs are silently dropped (matches existing sitemap-loop behaviour, which
  // tracks neither in telemetry).
  for (const url of await getSitemapSeeds(
    config.rootUrl,
    config.crawl.sitemapSeeding,
    config.scope,
  )) {
    if (!urlAllowedByScope(url, config.rootUrl, config.scope)) continue;
    if (urlExcludedByPatterns(url, config.crawl.excludeUrlPatternsCompiled ?? [])) continue;
    if (urlSkippedByExtension(url, config.crawl.documentLinkPatternsCompiled ?? [])) {
      excludedByExtension.add(url);
      continue;
    }
    seeds.push(url);
  }

  // ANCHOR: Crawler — PlaywrightCrawler with bounded maxPages + concurrency
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: config.crawl.maxPages,
    maxConcurrency: config.crawl.maxConcurrency,
    requestHandlerTimeoutSecs: config.crawl.requestTimeoutSecs,
    navigationTimeoutSecs: config.crawl.navigationTimeoutSecs,
    // ANCHOR: RequestDelayHook — per-navigation throttle honouring
    // `config.crawl.requestDelayMs`. Zero (the DEFAULT) is a no-op.
    preNavigationHooks: [buildRequestDelayHook(config.crawl.requestDelayMs)],

    async requestHandler({ page, request, enqueueLinks }) {
      // NOTE: Crawlee's requestHandlerTimeoutSecs caps the whole handler at
      // requestTimeoutSecs. page.setDefaultTimeout below configures the
      // per-method default that bounds waitForLoadState (slow-network
      // safety) and any future interactive locator work; per-element
      // metadata capture has been moved to a single page.evaluate (no
      // auto-wait — see captureDiscoveryMetadata).
      //
      // INVARIANT: this handler must NOT use Playwright locator queries —
      // use page.evaluate instead. The 90s default would couple per-call
      // auto-wait to the handler budget and re-cause the AU dogfood hang.
      // Enforced by test/unit/discover-no-locator-invariant.test.mjs.
      page.setDefaultTimeout(config.crawl.requestTimeoutSecs * 1000);
      await page.waitForLoadState('domcontentloaded');

      const currentUrl = normalizeUrl(page.url());
      const title = await page.title().catch(() => '');
      const probe = await page.evaluate(captureDiscoveryMetadata, config.discovery).catch(() => ({
        h1: null,
        canonical: null,
        formCount: 0,
        landmarkCount: 0,
        searchInputCount: 0,
      }));
      const { h1, canonical, formCount, landmarkCount, searchInputCount } = probe;

      const pageType = guessPageType(currentUrl);
      const clusterKey = clusterKeyFor(currentUrl, pageType);
      const processTypes = guessProcessTypes({ url: currentUrl, formCount, searchInputCount });

      if (!discovered.has(currentUrl)) {
        discovered.set(currentUrl, {
          url: currentUrl,
          sourceUrl: request.url,
          title: title.trim() || null,
          h1: h1?.trim() || null,
          canonical: canonical || null,
          pageType,
          clusterKey,
          firstPathSegment: new URL(currentUrl).pathname.split('/').filter(Boolean)[0] ?? '(root)',
          hasForms: formCount > 0,
          formCount,
          searchInputCount,
          landmarkCount,
          processTypes,
        });
        logger.debug({ url: currentUrl, pageType }, 'page discovered');
      }

      await enqueueLinks({
        selector: 'a[href]',
        strategy: config.scope.mode === 'same-origin' ? 'same-origin' : 'same-hostname',
        transformRequestFunction(req) {
          const normalized = normalizeUrl(req.url);
          if (!urlAllowedByScope(normalized, config.rootUrl, config.scope)) {
            excludedOutOfScope.add(normalized);
            return false;
          }
          if (urlExcludedByPatterns(normalized, config.crawl.excludeUrlPatternsCompiled ?? [])) {
            excludedByPattern.add(normalized);
            return false;
          }
          if (urlSkippedByExtension(normalized, config.crawl.documentLinkPatternsCompiled ?? [])) {
            excludedByExtension.add(normalized);
            return false;
          }
          req.url = normalized;
          return req;
        },
      });
    },

    failedRequestHandler({ request }) {
      logger.warn({ url: request.url }, 'crawl request failed');
    },
  });

  await crawler.run([...new Set(seeds)]);

  // SECTION: Post-processing — cluster + process candidates
  const inventory = [...discovered.values()].sort((a, b) => a.url.localeCompare(b.url));

  // ANCHOR: ClusterGrouping — Object.groupBy requires Node 21+ (pinned 22.11+)
  const pageClusters = Object.values(
    Object.groupBy(inventory, /** @type {(item: any) => string} */ ((item) => item.clusterKey)),
  )
    .filter(
      /** @type {(g: any) => g is any[]} */ ((group) => Array.isArray(group) && group.length > 0),
    )
    .map((group) => ({
      clusterKey: group[0].clusterKey,
      pageType: group[0].pageType,
      firstPathSegment: group[0].firstPathSegment,
      count: group.length,
      representativeUrl: group
        .map(/** @type {(i: any) => string} */ ((i) => i.url))
        .sort(/** @type {(a: string, b: string) => number} */ ((a, b) => a.length - b.length))[0],
    }))
    .sort((a, b) => b.count - a.count || a.clusterKey.localeCompare(b.clusterKey));

  const processCandidates = inventory
    .filter((item) => item.processTypes.length > 0)
    .map((item) => ({
      url: item.url,
      processTypes: item.processTypes,
      pageType: item.pageType,
      formCount: item.formCount,
    }));

  // SECTION: Persist artefacts
  await writeJson(path.join(paths.inventoryDir, 'inventory.json'), inventory);
  await writeText(
    path.join(paths.inventoryDir, 'urls.txt'),
    inventory.map((item) => item.url).join('\n') + '\n',
  );
  await writeJson(path.join(paths.inventoryDir, 'page-clusters.json'), pageClusters);
  await writeJson(path.join(paths.inventoryDir, 'process-candidates.json'), processCandidates);
  await writeJson(path.join(paths.inventoryDir, 'inventory-metadata.json'), {
    tool: TOOL_IDENTITY,
    site: config.name,
    rootUrl: config.rootUrl,
    seedCount: [...new Set(seeds)].length,
    discoveredCount: inventory.length,
    outOfScopeLinkCount: excludedOutOfScope.size,
    excludedByPatternCount: excludedByPattern.size,
    excludedByExtensionCount: excludedByExtension.size,
    // NOTE: cap visibility (2026-06 review C1). Without these two fields a
    // reader cannot distinguish "thorough crawl found N pages" from "crawl
    // hit the ceiling at N" — summarize surfaces reachedMaxPages as a
    // scan warning so the truncation is visible in every report.
    maxPagesConfigured: typeof config.crawl?.maxPages === 'number' ? config.crawl.maxPages : null,
    reachedMaxPages:
      typeof config.crawl?.maxPages === 'number' && inventory.length >= config.crawl.maxPages,
    generatedAt: new Date().toISOString(),
  });

  logger.info({ count: inventory.length, outDir: paths.inventoryDir }, 'discover done');
  return { inventoryCount: inventory.length };
}

// SECTION: Standalone runner — backward compat for `node src/commands/discover.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  // discover launches Playwright via Crawlee — require the browser preflight.
  const ctx = await buildContext({ requirePlaywright: true });
  await run(ctx);
}
