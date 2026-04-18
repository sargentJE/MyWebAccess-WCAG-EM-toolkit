import path from 'node:path';
import { PlaywrightCrawler } from 'crawlee';
import { loadConfig } from './lib/config.mjs';
import { ensureDir, writeJson, writeText } from './lib/fs-utils.mjs';
import {
  normalizeUrl,
  guessPageType,
  clusterKeyFor,
  guessProcessTypes,
  urlAllowedByScope,
  urlExcludedByPatterns,
} from './lib/urls.mjs';
import { getSitemapSeeds } from './lib/sitemap.mjs';

const { config } = await loadConfig();
const inventoryDir = await ensureDir('output', 'inventory');

const discovered = new Map();
const excludedOutOfScope = new Set();
const excludedByPattern = new Set();
const seeds = [normalizeUrl(config.rootUrl)];

for (const url of await getSitemapSeeds(
  config.rootUrl,
  config.crawl.sitemapSeeding,
  config.scope,
)) {
  if (
    urlAllowedByScope(url, config.rootUrl, config.scope) &&
    !urlExcludedByPatterns(url, config.crawl.excludeUrlPatterns)
  ) {
    seeds.push(url);
  }
}

const crawler = new PlaywrightCrawler({
  maxRequestsPerCrawl: config.crawl.maxPages,
  maxConcurrency: config.crawl.maxConcurrency,
  requestHandlerTimeoutSecs: config.crawl.requestTimeoutSecs,

  async requestHandler({ page, request, enqueueLinks, log }) {
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
      log.info(`Saved: ${currentUrl}`);
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
        if (urlExcludedByPatterns(normalized, config.crawl.excludeUrlPatterns)) {
          excludedByPattern.add(normalized);
          return false;
        }
        req.url = normalized;
        return req;
      },
    });
  },

  failedRequestHandler({ request, log }) {
    log.error(`Failed: ${request.url}`);
  },
});

await crawler.run([...new Set(seeds)]);

const inventory = [...discovered.values()].sort((a, b) => a.url.localeCompare(b.url));
const pageClusters = Object.values(Object.groupBy(inventory, (item) => item.clusterKey))
  .map((group) => ({
    clusterKey: group[0].clusterKey,
    pageType: group[0].pageType,
    firstPathSegment: group[0].firstPathSegment,
    count: group.length,
    representativeUrl: group.map((i) => i.url).sort((a, b) => a.length - b.length)[0],
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

await writeJson(path.join(inventoryDir, 'inventory.json'), inventory);
await writeText(
  path.join(inventoryDir, 'urls.txt'),
  inventory.map((item) => item.url).join('\n') + '\n',
);
await writeJson(path.join(inventoryDir, 'page-clusters.json'), pageClusters);
await writeJson(path.join(inventoryDir, 'process-candidates.json'), processCandidates);
await writeJson(path.join(inventoryDir, 'inventory-metadata.json'), {
  site: config.name,
  rootUrl: config.rootUrl,
  seedCount: [...new Set(seeds)].length,
  discoveredCount: inventory.length,
  outOfScopeLinkCount: excludedOutOfScope.size,
  excludedByPatternCount: excludedByPattern.size,
  generatedAt: new Date().toISOString(),
});

console.log(`Saved ${inventory.length} URLs to ${inventoryDir}`);
