// @ts-check
/**
 * @file Sitemap seeding: scope, recursion, fairness, determinism, telemetry.
 * @module test/unit/sitemap
 *
 * @description
 * Scope tests (the original suite) prove the hostname filter is enforced. E2
 * adds: nested `<sitemapindex>` recursion (previously untested), round-robin
 * FAIRNESS so one large sitemap can't starve the rest, leaf-vs-index
 * classification by document body (not URL extension), determinism (sorted +
 * fetch-order-independent), and per-sitemap telemetry.
 *
 * A real `http.createServer` on an ephemeral port exercises the `fetch(...)`
 * path end-to-end.
 */

// SECTION: Imports
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { getSitemapSeeds } from '../../src/lib/sitemap.mjs';

// SECTION: Fixtures

const FIXTURE_A = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>__BASE__/home</loc></url>
  <url><loc>__BASE__/about</loc></url>
  <url><loc>__BASE__/contact</loc></url>
  <url><loc>https://evil.example.com/phish</loc></url>
</urlset>`;

const FIXTURE_B = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>https://partner.example.com/joint</loc></url>
</urlset>`;

// A nested index pointing at two leaves; the events leaf is large, the pages
// leaf small — the fairness fixture. Event locs are deliberately UNSORTED.
const INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex>
  <sitemap><loc>__BASE__/sitemap-events.xml</loc></sitemap>
  <sitemap><loc>__BASE__/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`;

const EVENTS = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>__BASE__/event/e3</loc></url>
  <url><loc>__BASE__/event/e1</loc></url>
  <url><loc>__BASE__/event/e5</loc></url>
  <url><loc>__BASE__/event/e2</loc></url>
  <url><loc>__BASE__/event/e4</loc></url>
</urlset>`;

const PAGES = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>__BASE__/page/p1</loc></url>
  <url><loc>__BASE__/page/p2</loc></url>
</urlset>`;

// A leaf whose page URL ends in `.xml` — the old per-loc extension regex would
// have mis-treated it as a sub-sitemap. Body-classification keeps it a page.
const LEAF_WITH_XML_PAGE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>__BASE__/data/report.xml</loc></url>
  <url><loc>__BASE__/data/index</loc></url>
</urlset>`;

// SECTION: Server lifecycle

/** @type {import('node:http').Server} */
let server;
/** @type {string} */
let baseUrl;

/** @type {Record<string, string>} */
const ROUTES = {
  '/sitemap-a.xml': FIXTURE_A,
  '/sitemap-b.xml': FIXTURE_B,
  '/sitemap_index.xml': INDEX,
  '/sitemap-events.xml': EVENTS,
  '/sitemap-pages.xml': PAGES,
  '/sitemap-leafxml.xml': LEAF_WITH_XML_PAGE,
};

before(async () => {
  server = createServer((req, res) => {
    const body = ROUTES[(req.url ?? '/').split('?')[0]];
    if (body) {
      res.setHeader('content-type', 'application/xml');
      res.end(body.replaceAll('__BASE__', baseUrl));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(0);
  await once(server, 'listening');
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise((resolve) => server.close(() => resolve(undefined))));

// SECTION: Scope enforcement (original suite)

test('same-hostname mode filters out off-host sitemap entries', async () => {
  const { seeds } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-a.xml'], maxUrls: 10 },
    { mode: 'same-hostname' },
  );
  assert.strictEqual(seeds.length, 3, 'three on-host URLs, evil.example.com excluded');
  assert.ok(!seeds.some((url) => url.includes('evil.example.com')));
});

test('same-origin mode filters out off-origin sitemap entries', async () => {
  const { seeds } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-a.xml'], maxUrls: 10 },
    { mode: 'same-origin' },
  );
  assert.strictEqual(seeds.length, 3);
  assert.ok(!seeds.some((url) => url.includes('evil.example.com')));
});

test('allowed-hosts mode admits explicitly-listed external hosts', async () => {
  const { seeds } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-b.xml'], maxUrls: 10 },
    { mode: 'allowed-hosts', allowedHosts: ['partner.example.com'] },
  );
  assert.strictEqual(seeds.length, 1);
  assert.strictEqual(seeds[0], 'https://partner.example.com/joint');
});

test('allowed-hosts with empty list still rejects unrelated hosts (bypass is dead)', async () => {
  const { seeds } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-a.xml'], maxUrls: 10 },
    { mode: 'allowed-hosts', allowedHosts: [] },
  );
  assert.strictEqual(seeds.length, 3, 'only root host admitted; evil.example.com excluded');
  assert.ok(!seeds.some((url) => url.includes('evil.example.com')));
});

// SECTION: E2 — recursion, fairness, classification, determinism, telemetry

test('recursion: a <sitemapindex> is expanded into its child leaves', async () => {
  const { seeds } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap_index.xml'], maxUrls: 100 },
    { mode: 'same-hostname' },
  );
  assert.equal(seeds.length, 7, '5 events + 2 pages discovered via the index');
  assert.ok(seeds.some((u) => u.includes('/event/e1')));
  assert.ok(seeds.some((u) => u.includes('/page/p1')));
});

test('fairness: round-robin lets a small leaf in before a large one drowns it', async () => {
  // maxUrls below the events count — FIFO drain would seed only events and
  // starve pages. Round-robin must include the pages leaf.
  const { seeds, reachedSitemapCap } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap_index.xml'], maxUrls: 4 },
    { mode: 'same-hostname' },
  );
  assert.equal(seeds.length, 4);
  assert.ok(
    seeds.some((u) => u.includes('/page/')),
    'the small pages leaf is represented, not starved',
  );
  assert.ok(
    seeds.some((u) => u.includes('/event/')),
    'the large events leaf is also represented',
  );
  assert.equal(reachedSitemapCap, true, 'the events leaf was clipped by maxUrls');
});

test('classification by body: a urlset page URL ending in .xml stays a page (not recursed)', async () => {
  const { seeds } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-leafxml.xml'], maxUrls: 100 },
    { mode: 'same-hostname' },
  );
  assert.ok(
    seeds.some((u) => u.endsWith('/data/report.xml')),
    'a .xml page in a <urlset> is collected, not mistaken for a sub-sitemap',
  );
  assert.ok(seeds.some((u) => u.endsWith('/data/index')));
});

test('determinism: locs are sorted and two runs produce byte-identical seeds', async () => {
  const opts = {
    enabled: true,
    urls: [baseUrl + '/sitemap-events.xml'],
    maxUrls: 100,
  };
  const run1 = await getSitemapSeeds(baseUrl + '/', { ...opts }, { mode: 'same-hostname' });
  const run2 = await getSitemapSeeds(baseUrl + '/', { ...opts }, { mode: 'same-hostname' });
  // The events fixture lists e3,e1,e5,e2,e4 — output must be sorted e1..e5
  // (intra-leaf sort), so the round-robin pick is independent of byte order.
  const tails = run1.seeds.map((u) => u.split('/event/')[1]);
  assert.deepEqual(tails, ['e1', 'e2', 'e3', 'e4', 'e5'], 'locs sorted, not in document order');
  assert.deepEqual(run1.seeds, run2.seeds, 'two runs are byte-identical');
});

test('telemetry: perSitemap records found/contributed/clipped per leaf', async () => {
  const { perSitemap } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap_index.xml'], maxUrls: 4 },
    { mode: 'same-hostname' },
  );
  const events = perSitemap.find((s) => s.url.endsWith('/sitemap-events.xml'));
  assert.ok(events, 'events leaf present in telemetry');
  assert.equal(events.found, 5);
  assert.ok(events.clipped > 0, 'events was clipped by the budget');
  assert.equal(events.contributed + events.clipped, events.found, 'contributed + clipped == found');
});

test('anti-amplification: maxSitemapDocs bounds fetches; unfetched children are neverReached', async () => {
  const { seeds, neverReached, sitemapDocsFetched } = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap_index.xml'], maxUrls: 100, maxSitemapDocs: 1 },
    { mode: 'same-hostname' },
  );
  // Only the index document is fetched; its two children are recorded but not fetched.
  assert.equal(sitemapDocsFetched, 1);
  assert.equal(seeds.length, 0, 'no leaves fetched, so no page seeds');
  assert.equal(neverReached.length, 2, 'both child sitemaps recorded as never-reached');
});
