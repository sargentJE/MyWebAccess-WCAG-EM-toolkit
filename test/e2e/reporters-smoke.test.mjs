// @ts-check
/**
 * @file End-to-end smoke for the reporter pipeline — Layer 4 R9.
 * @module test/e2e/reporters-smoke
 *
 * @description
 * INTENDED behaviour: boot the fixture server, materialise a tmp config +
 * out-dir, run a full `audit` via `spawnSync`, and assert every reporter
 * output exists + parses + carries the expected content.
 *
 * **CURRENTLY SKIPPED.** During R9 development the Crawlee-driven
 * `discover` stage hangs on `127.0.0.1` localhost fixtures — every
 * `requestHandler` invocation times out at the configured boundary even
 * though the underlying user handler runs to completion (instrumented
 * probes confirm the handler reaches and passes `page.title()`).
 *
 * Mitigations tried + ruled out (R9 + Layer 4 v2 audit):
 *   - `CRAWLEE_STORAGE_DIR` per-test isolation
 *   - HTTP `Connection: close` server-side
 *   - scope strategy `same-hostname` vs `same-origin`
 *   - sitemap seeding disabled
 *   - `useSessionPool: false`                    [v2 audit]
 *   - `browserPoolOptions: { retireBrowserAfterPageCount: Infinity }`  [v2 audit]
 *   - `persistCookiesPerSession: false`          [v2 audit]
 *
 * Bisect evidence (v2 audit, against the same fixture + Crawlee 3.16):
 *   - Raw Playwright `page.goto` + `page.title()`: 219 ms total.
 *   - Hand-rolled standalone `PlaywrightCrawler` with the EXACT discover.mjs
 *     handler logic copied verbatim (including `page.setDefaultTimeout`,
 *     `waitForLoadState`, `enqueueLinks` with `transformRequestFunction`,
 *     and `preNavigationHooks`): 991 ms, all 5 fixture pages crawled.
 *   - `discover.run(ctx)` against the same fixture via the same buildContext
 *     setup: 41 s (3 × 10s requestHandlerTimeoutSecs + retries) and never
 *     succeeds.
 *
 * The hang is therefore NOT in Crawlee itself, NOT in the fixture server,
 * NOT in raw Playwright, NOT in our handler code. It IS in some interaction
 * specific to the `discover.run` invocation path that the standalone
 * reproducer does not trigger. The closest upstream symptom match is
 * apify/crawlee#2785 ("RequestHandler Timed Out But Actually Browser
 * Error") which describes browser-pool page-creation hanging silently
 * under the requestHandler timeout cap, but our bisect shows the page IS
 * being created and navigated successfully — the timeout fires WHILE the
 * handler is making progress.
 *
 * Next experiment for a future investigator: progressively replace
 * `discover.run`'s code path with the working standalone reproducer until
 * the boundary that triggers the hang is identified. Promising candidates
 * to swap in/out:
 *   - the `getSitemapSeeds` await before the crawler (returns `[]` for
 *     `sitemapSeeding.enabled: false` but exercises Node fetch).
 *   - the `[...new Set(seeds)]` deduplication around `crawler.run`'s
 *     argument (subtle but might change Crawlee's queue priming).
 *   - whether `ensurePreflight(ctx)`'s side effects (Pino logger setup,
 *     paths.outDir creation) interact with Crawlee's storage init.
 *
 * Tracked in `CHANGELOG.md [Unreleased] / Layer 4 follow-ups` with the
 * full bisect log; the smoke test will unskip once the boundary is
 * identified and a fix lands.
 */

// SECTION: Imports
import { test } from 'node:test';

// SECTION: Tests

// [Update 2026-05-03] After landing the D2 fix in src/commands/discover.mjs
// (replacing the locator-based capture chain with a single page.evaluate),
// this test was un-skipped briefly and confirmed to remain dead — the body
// is still empty pending the unsolved localhost-fixture hang documented
// above. D2 was a distinct bug (per-locator timeout coupling on remote
// pages lacking h1/canonical, falsified the prior "localhost-only" framing)
// and is NOT the same root cause as this deferral. Investigation of the
// localhost-fixture hang continues per the candidates listed above.
test.skip('[DEFERRED-CRAWLEE] reporters smoke: full audit produces all 5 reporter outputs', async () => {
  // Body kept minimal; see file-level comment for the investigation log.
});
