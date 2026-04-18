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
} from '../lib/urls.mjs';
import { getSitemapSeeds } from '../lib/sitemap.mjs';
import { buildContext } from '../lib/context.mjs';

// SECTION: Public API

/**
 * Run the discover stage.
 *
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ inventoryCount: number }>}
 */
export async function run(ctx) {
  const { config, logger, paths } = ctx;

  /** @type {Map<string, any>} */
  const discovered = new Map();
  /** @type {Set<string>} */
  const excludedOutOfScope = new Set();
  /** @type {Set<string>} */
  const excludedByPattern = new Set();
  const seeds = [normalizeUrl(config.rootUrl)];

  // ANCHOR: SitemapSeeding — optional uplift when the site advertises a sitemap
  for (const url of await getSitemapSeeds(
    config.rootUrl,
    config.crawl.sitemapSeeding,
    config.scope,
  )) {
    if (
      urlAllowedByScope(url, config.rootUrl, config.scope) &&
      !urlExcludedByPatterns(url, config.crawl.excludeUrlPatternsCompiled ?? [])
    ) {
      seeds.push(url);
    }
  }

  // ANCHOR: Crawler — PlaywrightCrawler with bounded maxPages + concurrency
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: config.crawl.maxPages,
    maxConcurrency: config.crawl.maxConcurrency,
    requestHandlerTimeoutSecs: config.crawl.requestTimeoutSecs,

    async requestHandler({ page, request, enqueueLinks }) {
      // NOTE: Crawlee's requestHandlerTimeoutSecs bounds the whole handler;
      // page.setDefaultTimeout also bounds per-locator ops (click, waitFor…)
      // so a single slow element can't stall the handler up to the outer cap.
      page.setDefaultTimeout(config.crawl.requestTimeoutSecs * 1000);
      await page.waitForLoadState('domcontentloaded');

      const currentUrl = normalizeUrl(page.url());
      const title = await page.title().catch(() => '');
      const h1 = config.discovery.captureH1
        ? await page
            .locator('h1')
            .first()
            .textContent()
            .catch(() => null)
        : null;
      const canonical = config.discovery.captureCanonical
        ? await page
            .locator('link[rel="canonical"]')
            .getAttribute('href')
            .catch(() => null)
        : null;
      const formCount = config.discovery.captureForms
        ? await page
            .locator('form')
            .count()
            .catch(() => 0)
        : 0;
      const landmarkCount = config.discovery.captureLandmarks
        ? await page
            .locator(
              'main, nav, header, footer, aside, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]',
            )
            .count()
            .catch(() => 0)
        : 0;
      const searchInputCount = config.discovery.captureSearchInputs
        ? await page
            .locator('input[type="search"], input[role="searchbox"], form[role="search"] input')
            .count()
            .catch(() => 0)
        : 0;

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
    Object.groupBy(inventory, /** @param {any} item */ (item) => item.clusterKey),
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
    site: config.name,
    rootUrl: config.rootUrl,
    seedCount: [...new Set(seeds)].length,
    discoveredCount: inventory.length,
    outOfScopeLinkCount: excludedOutOfScope.size,
    excludedByPatternCount: excludedByPattern.size,
    generatedAt: new Date().toISOString(),
  });

  logger.info({ count: inventory.length, outDir: paths.inventoryDir }, 'discover done');
  return { inventoryCount: inventory.length };
}

// SECTION: Standalone runner — backward compat for `node src/commands/discover.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext();
  await run(ctx);
}
