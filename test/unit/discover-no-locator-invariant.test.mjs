// @ts-check
/**
 * @file Lock D2's setDefaultTimeout safety against future regression.
 * @module test/unit/discover-no-locator-invariant
 *
 * @description
 * The discover requestHandler runs with `page.setDefaultTimeout(90s)` — the
 * per-method default that bounds `page.waitForLoadState('domcontentloaded')`
 * on slow networks. Removing it would default `waitForLoadState` to
 * Playwright's 30s default (verified at plan-time via
 * `node_modules/playwright-core/lib/client/timeoutSettings.js`), regressing
 * slow-network audits.
 *
 * But the same 90s default also applies to any Playwright locator query
 * (auto-wait per call). The AU dogfood (2026-05-02) proved that pattern hangs
 * the full 90s on any page missing the queried element — fixed in commit
 * 468f5c1 by replacing six locator queries with one `page.evaluate`. With
 * no current locator consumer in the handler, the 90s safety is dead-as-
 * currently-written; a future contributor adding a Playwright locator query
 * would silently re-introduce the regression bounded at 90s.
 *
 * This test brace-matches the requestHandler function body and asserts zero
 * literal `.locator(` substrings appear within. Mirrors the source-text
 * invariant pattern at `test/unit/process-runner-invariant.test.mjs`.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SECTION: Paths
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__filename, '../../..');
const DISCOVER_PATH = path.join(REPO_ROOT, 'src', 'commands', 'discover.mjs');

// SECTION: Test

test('discover requestHandler body contains zero Playwright locator queries', async () => {
  const source = await readFile(DISCOVER_PATH, 'utf8');

  // Find `async requestHandler(` and walk braces to capture the body range.
  const handlerStart = source.indexOf('async requestHandler(');
  assert.ok(handlerStart !== -1, 'requestHandler must exist in discover.mjs');

  const paramsClose = source.indexOf(')', handlerStart);
  assert.ok(paramsClose !== -1, 'requestHandler signature must close with )');

  const openBrace = source.indexOf('{', paramsClose);
  assert.ok(openBrace !== -1, 'requestHandler body must start with {');

  let depth = 0;
  let closeBrace = -1;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        closeBrace = i;
        break;
      }
    }
  }
  assert.ok(closeBrace !== -1, 'requestHandler body must have a matching close brace');

  const body = source.slice(openBrace, closeBrace);
  const locatorMatches = [...body.matchAll(/\.locator\(/g)];

  assert.strictEqual(
    locatorMatches.length,
    0,
    'discover requestHandler must use page.evaluate for DOM probes, never ' +
      'Playwright locator queries. page.setDefaultTimeout(requestTimeoutSecs * 1000) ' +
      'sets the per-method default that bounds waitForLoadState (slow-network ' +
      'safety); reintroducing locator-based queries couples per-call auto-wait ' +
      'to the 90s handler budget and re-causes the AU dogfood hang fixed in ' +
      'commit 468f5c1. Use page.evaluate(fn, ...args) instead — it does not ' +
      'auto-wait and returns null/0 immediately for missing elements.',
  );
});
