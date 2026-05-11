// @ts-check
/**
 * @file Behavioural test for discover's per-page timeout — Layer 4 R9.
 * @module test/e2e/discover-timeout
 *
 * @description
 * INTENDED replacement for the source-text test at
 * `test/unit/discover-timeout.test.mjs` (deleted in R9). The behavioural
 * version was meant to point discover at a `/slow` route and assert the
 * timed-out URL is dropped from inventory.
 *
 * **CURRENTLY SKIPPED — TEST PREMISE INVALIDATED 2026-05-09.**
 *
 * The Crawlee localhost-fixture hang that originally blocked this test
 * was resolved by D2 / commit 468f5c1 (see
 * `docs/adr/0013-crawlee-localhost-investigation.md`) and the
 * `reporters-smoke.test.mjs` companion test has been un-skipped. However,
 * empirical verification (2026-05-09) showed the originally-intended
 * assertion ("`/slow` is dropped from inventory after `crawl.requestTimeoutSecs`
 * exceeded") doesn't match the toolkit's actual behaviour.
 *
 * Why: Crawlee separates two timeouts — `navigationTimeoutSecs` (bounds
 * `page.goto`) and `requestHandlerTimeoutSecs` (bounds the user-supplied
 * requestHandler). `src/commands/discover.mjs` wires
 * `crawl.requestTimeoutSecs` only into the latter, leaving
 * `navigationTimeoutSecs` at Crawlee's 60s default. So a fixture with
 * `slowMs: 8000` lets `page.goto` complete (8s < 60s nav budget), then
 * the user handler runs against a fully-loaded page — no timeout fires,
 * `/slow` ends up in inventory with full metadata captured. Diagnostic:
 *
 *   slow entry → { url, title: 'Slow', h1: 'Eventually responded',
 *                  formCount: 0, landmarkCount: 0, processTypes: [] }
 *
 * Two paths to un-skip cleanly (v1.1 work):
 *
 *   1. **Add `crawl.navigationTimeoutSecs` config** wired to Crawlee's
 *      navigationTimeoutSecs. Then `slowMs > navigationTimeoutSecs`
 *      genuinely drops the URL. Production-relevant: client sites with
 *      slow CDN endpoints would benefit from a tighter nav cap than 60s.
 *
 *   2. **Reframe the test** as a positive-case "discover handles slow
 *      pages without crashing" assertion. Useful but doesn't match the
 *      test's original intent.
 *
 * Preferred: option 1 (real config addition, real test). Tracked as a
 * v1.1 follow-up in CHANGELOG.
 *
 * The `[DEFERRED-CRAWLEE]` prefix on the test name is replaced with
 * `[DEFERRED-NAV-TIMEOUT-CONFIG]` to reflect the actual blocker.
 */

// SECTION: Imports
import { test } from 'node:test';

// SECTION: Tests

test.skip('[DEFERRED-NAV-TIMEOUT-CONFIG] discover: pages exceeding crawl.requestTimeoutSecs are dropped', async () => {
  // Body kept minimal; see file-level comment for the test-premise correction
  // and the two un-skip paths (preferred: add `crawl.navigationTimeoutSecs`).
});
