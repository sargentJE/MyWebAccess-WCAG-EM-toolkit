// @ts-check
/**
 * @file Per-process failure isolation in `runOneProcess`.
 * @module test/unit/scan-processes-isolation
 *
 * @description
 * `browser.newContext()` and `context.newPage()` used to live *outside* the
 * per-process try/catch in `scan-processes.mjs`, so a bad viewport config or
 * Playwright allocation failure aborted the whole `config.processes[]` loop
 * (ALL subsequent processes lost). After the extraction, `runOneProcess`
 * acquires its page-view through the browser seam (`withScannedPage`) inside a
 * try/catch; a failing process becomes an `{ error }` result and the loop
 * continues.
 *
 * This test injects a fake browser **session** whose `newContext()` throws on
 * the second call and confirms:
 *   - Three process definitions → three result entries.
 *   - First + third have valid `states` populated.
 *   - Second has `error` set and did NOT abort the outer loop.
 *
 * The seam takes a `BrowserSession` ({ transport, browser, warnings }) rather
 * than a raw browser, so the harness wraps the fake browser in a launch session.
 */

// SECTION: Imports
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { runOneProcess } from '../../src/commands/scan-processes.mjs';

// SECTION: Helpers

/**
 * @param {...any} _args
 * @returns {Promise<any>}
 */
const anyAsync = async (..._args) => undefined;

/** @returns {Record<string, any>} */
function silentLogger() {
  return {
    info: mock.fn(),
    warn: mock.fn(),
    error: mock.fn(),
    debug: mock.fn(),
    trace: mock.fn(),
    fatal: mock.fn(),
  };
}

/** @returns {Record<string, any>} */
function fakePage() {
  return {
    goto: mock.fn(anyAsync),
    locator: () => ({ first: () => ({ click: mock.fn(anyAsync), fill: mock.fn(anyAsync) }) }),
    keyboard: { press: mock.fn(anyAsync) },
    waitForTimeout: mock.fn(anyAsync),
    screenshot: mock.fn(anyAsync),
  };
}

/**
 * Build a fake browser **session** whose `newContext` throws on the Nth call
 * (1-indexed). Captures the options object passed to each `newContext` call so
 * tests can assert the auth contextOptions were threaded through.
 *
 * @param {number} throwOnCall - Which call to throw on (1-indexed).
 * @returns {{ session: any, callCount: () => number, lastOptions: () => any }}
 */
function fakeSessionThrowingOn(throwOnCall) {
  let callCount = 0;
  /** @type {any} */
  let lastOptions = null;
  const browser = {
    newContext: /** @type {any} */ (
      async (/** @type {any} */ options) => {
        callCount++;
        lastOptions = options;
        if (callCount === throwOnCall) {
          throw new Error('viewport allocation failed');
        }
        return {
          newPage: /** @type {any} */ (async () => fakePage()),
          close: mock.fn(anyAsync),
        };
      }
    ),
  };
  const session = /** @type {any} */ ({ transport: 'launch', browser, warnings: [] });
  return { session, callCount: () => callCount, lastOptions: () => lastOptions };
}

/** @returns {any} */
function buildCtx() {
  return /** @type {any} */ ({
    config: {
      scan: {
        viewport: { width: 1440, height: 900 },
        waitUntil: 'load',
        timeoutMs: 5000,
        fullPageScreenshots: true,
      },
    },
    configPath: '/tmp/fake-config.json',
    logger: silentLogger(),
    paths: {
      outDir: '/tmp/out',
      inventoryDir: '/tmp/out/inventory',
      resultsDir: '/tmp/out/results',
      reportsDir: '/tmp/out/reports',
      screenshotsDir: '/tmp/out/screenshots',
      sampleJsonPath: '/tmp/out/sample.json',
    },
    args: {},
  });
}

// SECTION: Tests

test('runOneProcess returns error-result when newContext throws (loop continues)', async () => {
  const { session } = fakeSessionThrowingOn(1);
  const ctx = buildCtx();

  const result = await runOneProcess(
    session,
    {
      name: 'broken',
      startUrl: 'https://example.com/',
      steps: [{ action: 'goto', url: 'https://example.com/' }],
    },
    ctx,
    { id: 'desktop', width: 1440, height: 900 },
    { httpCredentials: { username: 'u', password: 'p' } },
  );

  assert.strictEqual(result.name, 'broken');
  assert.strictEqual(result.error, 'viewport allocation failed');
  assert.deepStrictEqual(result.states, []);
});

test('runOneProcess succeeds when newContext succeeds', async () => {
  const { session } = fakeSessionThrowingOn(999); // never throws
  const ctx = buildCtx();

  const result = await runOneProcess(
    session,
    {
      name: 'happy',
      startUrl: 'https://example.com/',
      steps: [{ action: 'goto', url: 'https://example.com/' }],
    },
    ctx,
    { id: 'desktop', width: 1440, height: 900 },
    { httpCredentials: { username: 'u', password: 'p' } },
  );

  assert.strictEqual(result.name, 'happy');
  assert.strictEqual(result.error, undefined, 'no error on happy path');
  assert.ok(Array.isArray(result.states));
});

test('three processes with the second throwing — all three get results, loop does not abort', async () => {
  const { session } = fakeSessionThrowingOn(2);
  const ctx = buildCtx();

  const defs = [
    { name: 'first', startUrl: 'https://a/', steps: [{ action: 'goto', url: 'https://a/' }] },
    { name: 'second', startUrl: 'https://b/', steps: [{ action: 'goto', url: 'https://b/' }] },
    { name: 'third', startUrl: 'https://c/', steps: [{ action: 'goto', url: 'https://c/' }] },
  ];

  /** @type {any[]} */
  const results = [];
  for (const def of defs) {
    results.push(
      await runOneProcess(
        session,
        def,
        ctx,
        { id: 'desktop', width: 1440, height: 900 },
        { httpCredentials: { username: 'u', password: 'p' } },
      ),
    );
  }

  assert.strictEqual(results.length, 3, 'loop ran all three processes');
  assert.strictEqual(results[0].error, undefined);
  assert.strictEqual(results[1].error, 'viewport allocation failed');
  assert.strictEqual(results[2].error, undefined);
  assert.strictEqual(results[0].name, 'first');
  assert.strictEqual(results[1].name, 'second');
  assert.strictEqual(results[2].name, 'third');
});

test('runOneProcess threads contextOptions (httpCredentials) into newContext', async () => {
  const harness = fakeSessionThrowingOn(999);
  const ctx = buildCtx();

  await runOneProcess(
    harness.session,
    {
      name: 'auth-probe',
      startUrl: 'https://example.com/',
      steps: [{ action: 'goto', url: 'https://example.com/' }],
    },
    ctx,
    { id: 'desktop', width: 1440, height: 900 },
    { httpCredentials: { username: 'audit-user', password: 'secret' } },
  );

  const opts = harness.lastOptions();
  assert.ok(opts, 'newContext should have been called with options');
  assert.deepStrictEqual(opts.viewport, { width: 1440, height: 900 });
  assert.deepStrictEqual(opts.httpCredentials, {
    username: 'audit-user',
    password: 'secret',
  });
});

test('runOneProcess uses empty contextOptions default when not passed', async () => {
  const harness = fakeSessionThrowingOn(999);
  const ctx = buildCtx();

  await runOneProcess(
    harness.session,
    {
      name: 'no-auth',
      startUrl: 'https://example.com/',
      steps: [{ action: 'goto', url: 'https://example.com/' }],
    },
    ctx,
    { id: 'desktop', width: 1440, height: 900 },
    // 5th param omitted on purpose — default {} kicks in.
  );

  const opts = harness.lastOptions();
  assert.ok(opts);
  assert.strictEqual(opts.httpCredentials, undefined, 'no auth options when not provided');
  assert.deepStrictEqual(opts.viewport, { width: 1440, height: 900 });
});

test('empty pattern returns state:not-run without invoking the dispatch', async () => {
  const { session } = fakeSessionThrowingOn(999);
  const ctx = buildCtx();

  const result = await runOneProcess(
    session,
    { name: 'empty', startUrl: 'https://x/', pattern: null, steps: [] },
    ctx,
    { id: 'desktop', width: 1440, height: 900 },
    { httpCredentials: { username: 'u', password: 'p' } },
  );

  assert.strictEqual(result.states.length, 1);
  assert.strictEqual(result.states[0].state, 'not-run');
});
