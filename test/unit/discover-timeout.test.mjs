// @ts-check
/**
 * @file Source-text regression for `page.setDefaultTimeout` in discover.
 * @module test/unit/discover-timeout
 *
 * @description
 * Layer 2 adds per-page timeout inside discover's Crawlee `requestHandler`
 * so a single slow locator op can't stall the handler up to Crawlee's outer
 * `requestHandlerTimeoutSecs` cap. Full behavioural coverage requires the
 * Layer 3 e2e fixture server; this test is a narrow source-text regression
 * that catches accidental deletion of the line during future refactors.
 *
 * Weak by design. The trade-off is documented in commit 8's message and
 * in ADR-0005.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SECTION: Tests

test('discover.mjs calls page.setDefaultTimeout from requestHandler', async () => {
  const __filename = fileURLToPath(import.meta.url);
  const discoverPath = path.resolve(__filename, '../../../src/commands/discover.mjs');
  const contents = await fs.readFile(discoverPath, 'utf8');
  assert.match(
    contents,
    /page\.setDefaultTimeout\(config\.crawl\.requestTimeoutSecs \* 1000\)/,
    'expected page.setDefaultTimeout line inside requestHandler',
  );
});
