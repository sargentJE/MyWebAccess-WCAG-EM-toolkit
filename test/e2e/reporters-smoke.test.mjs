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
 * `requestHandler` invocation times out at 30s × 3 retries even though
 * the fixture HTTP server returns the page within milliseconds (raw
 * Playwright `page.goto` against the same fixture loads in <100 ms).
 * The hang appears to be inside Crawlee 3.16's PlaywrightCrawler
 * lifecycle and is independent of:
 *   - storage isolation (`CRAWLEE_STORAGE_DIR` set per-test, fresh dir)
 *   - HTTP keep-alive (set `Connection: close` server-side, no change)
 *   - scope strategy (`same-hostname` vs `same-origin` both hang)
 *   - sitemap seeding (disabled, no change)
 *
 * Tracked in `CHANGELOG.md [Unreleased]` as a Layer 4 follow-up. The
 * fixture harness, deterministic-sort helper, and reporter modules
 * landed in R1-R8 are independently exercised by the unit suites; this
 * smoke test will unskip once the Crawlee hang is diagnosed.
 */

// SECTION: Imports
import { test } from 'node:test';

// SECTION: Tests

test.skip('reporters smoke: full audit produces all 5 reporter outputs (DEFERRED — Crawlee hang)', async () => {
  // Body kept minimal; see file-level comment for the investigation log.
});
