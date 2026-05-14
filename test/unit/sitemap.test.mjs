// @ts-check
/**
 * @file Sitemap scope-enforcement regression tests.
 * @module test/unit/sitemap
 *
 * @description
 * v0.3 bypassed the hostname filter whenever `scope.mode === 'allowed-hosts'`,
 * so a sitemap listing an unrelated host would seed inventory with URLs that
 * the rest of the crawler refused to visit. The config validation overhaul replaces the bypass with
 * a call into `urlAllowedByScope`; these tests prove the bypass is dead.
 *
 * The suite boots a real `http.createServer` on an ephemeral port so the
 * sitemap walker's `fetch(...)` path exercises end-to-end. One server for
 * the whole suite; `before` uses `once(server, 'listening')` to prevent
 * the fetch-before-listen race.
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

// SECTION: Server lifecycle

/** @type {import('node:http').Server} */
let server;
/** @type {string} */
let baseUrl;

before(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/sitemap-a.xml') {
      res.setHeader('content-type', 'application/xml');
      res.end(FIXTURE_A.replaceAll('__BASE__', baseUrl));
      return;
    }
    if (url === '/sitemap-b.xml') {
      res.setHeader('content-type', 'application/xml');
      res.end(FIXTURE_B);
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

// SECTION: Tests

test('same-hostname mode filters out off-host sitemap entries', async () => {
  const seeds = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-a.xml'], maxUrls: 10 },
    { mode: 'same-hostname' },
  );
  assert.strictEqual(seeds.length, 3, 'three on-host URLs, evil.example.com excluded');
  assert.ok(!seeds.some((url) => url.includes('evil.example.com')));
});

test('same-origin mode filters out off-origin sitemap entries', async () => {
  const seeds = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-a.xml'], maxUrls: 10 },
    { mode: 'same-origin' },
  );
  assert.strictEqual(seeds.length, 3);
  assert.ok(!seeds.some((url) => url.includes('evil.example.com')));
});

test('allowed-hosts mode admits explicitly-listed external hosts', async () => {
  const seeds = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-b.xml'], maxUrls: 10 },
    { mode: 'allowed-hosts', allowedHosts: ['partner.example.com'] },
  );
  assert.strictEqual(seeds.length, 1);
  assert.strictEqual(seeds[0], 'https://partner.example.com/joint');
});

test('allowed-hosts with empty list still rejects unrelated hosts (bypass is dead)', async () => {
  const seeds = await getSitemapSeeds(
    baseUrl + '/',
    { enabled: true, urls: [baseUrl + '/sitemap-a.xml'], maxUrls: 10 },
    { mode: 'allowed-hosts', allowedHosts: [] },
  );
  assert.strictEqual(seeds.length, 3, 'only root host admitted; evil.example.com excluded');
  assert.ok(!seeds.some((url) => url.includes('evil.example.com')));
});
