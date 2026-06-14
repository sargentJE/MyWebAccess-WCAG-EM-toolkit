// @ts-check
/**
 * @file `acquireBrowserSession` transport dispatch (E8).
 * @module test/unit/browser-acquire
 *
 * @description
 * Verifies acquireBrowserSession routes to launch vs connectOverCDP correctly,
 * preserves the byte-identical default launch options, threads the engine + the
 * launch `channel`, and pushes the empty-default-context warning under CDP — all
 * without a real browser, via the injectable engine loader.
 */

// SECTION: Imports
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { acquireBrowserSession } from '../../src/lib/browser.mjs';

// SECTION: Helpers

const anyAsync = async () => undefined;

/**
 * A fake engine loader returning a `chromium` whose `launch`/`connectOverCDP`
 * are spies. `cdpContexts` controls what the connected browser's `contexts()`
 * returns (default: one existing context; `[]` ⇒ the empty-context path).
 *
 * @param {{ cdpContexts?: any[] }} [opts]
 * @returns {{ loadEngine: any, chromium: any, cdpBrowser: any, launchBrowser: any }}
 */
function fakeEngine(opts = {}) {
  const cdpContexts = opts.cdpContexts ?? [{ id: 'default' }];
  const cdpBrowser = { contexts: mock.fn(() => cdpContexts), close: mock.fn(anyAsync) };
  const launchBrowser = { close: mock.fn(anyAsync) };
  const chromium = {
    connectOverCDP: mock.fn(async (/** @type {any} */ _endpoint) => cdpBrowser),
    launch: mock.fn(async (/** @type {any} */ _opts) => launchBrowser),
  };
  const loadEngine = mock.fn(async (/** @type {any} */ _engine) => ({ chromium }));
  return { loadEngine, chromium, cdpBrowser, launchBrowser };
}

// SECTION: Tests

test('acquireBrowserSession: default config → launch({ headless: true }), no channel key', async () => {
  const f = fakeEngine();
  const s = await acquireBrowserSession({}, undefined, {}, f.loadEngine);
  assert.strictEqual(s.transport, 'launch');
  assert.strictEqual(f.chromium.connectOverCDP.mock.callCount(), 0);
  assert.strictEqual(f.chromium.launch.mock.callCount(), 1);
  // Byte-identical to the pre-E8 call: exactly { headless: true }, no channel key.
  assert.deepStrictEqual(f.chromium.launch.mock.calls[0].arguments[0], { headless: true });
  assert.strictEqual(f.loadEngine.mock.calls[0].arguments[0], 'playwright');
});

test('acquireBrowserSession: headless:false + channel pass through on launch', async () => {
  const f = fakeEngine();
  await acquireBrowserSession(
    { scan: { browser: { headless: false, channel: 'chrome' } } },
    undefined,
    {},
    f.loadEngine,
  );
  const opts = f.chromium.launch.mock.calls[0].arguments[0];
  assert.strictEqual(opts.headless, false);
  assert.strictEqual(opts.channel, 'chrome');
});

test('acquireBrowserSession: engine patchright is requested from the loader', async () => {
  const f = fakeEngine();
  await acquireBrowserSession(
    { scan: { browser: { engine: 'patchright' } } },
    undefined,
    {},
    f.loadEngine,
  );
  assert.strictEqual(f.loadEngine.mock.calls[0].arguments[0], 'patchright');
});

test('acquireBrowserSession: cdpEndpoint → connectOverCDP(endpoint), not launch', async () => {
  const f = fakeEngine();
  const s = await acquireBrowserSession(
    { scan: { browser: { cdpEndpoint: 'http://x:1' } } },
    undefined,
    {},
    f.loadEngine,
  );
  assert.strictEqual(s.transport, 'cdp');
  assert.strictEqual(f.chromium.connectOverCDP.mock.callCount(), 1);
  assert.strictEqual(f.chromium.connectOverCDP.mock.calls[0].arguments[0], 'http://x:1');
  assert.strictEqual(f.chromium.launch.mock.callCount(), 0);
});

test('acquireBrowserSession: WCAG_EM_CDP_ENDPOINT env → connectOverCDP', async () => {
  const f = fakeEngine();
  const s = await acquireBrowserSession(
    {},
    undefined,
    { WCAG_EM_CDP_ENDPOINT: 'http://env:2' },
    f.loadEngine,
  );
  assert.strictEqual(s.transport, 'cdp');
  assert.strictEqual(f.chromium.connectOverCDP.mock.calls[0].arguments[0], 'http://env:2');
});

test('acquireBrowserSession: CDP with NO existing context → warns it will not inherit the cleared session', async () => {
  const f = fakeEngine({ cdpContexts: [] });
  const s = await acquireBrowserSession(
    { scan: { browser: { cdpEndpoint: 'http://x:1' } } },
    undefined,
    {},
    f.loadEngine,
  );
  assert.ok(
    s.warnings.some((w) => /no existing context|cf_clearance/i.test(w)),
    'warns that a fresh isolated context will not inherit the cleared session',
  );
});

test('acquireBrowserSession: CDP with an existing context → no empty-context warning', async () => {
  const f = fakeEngine({ cdpContexts: [{ id: 'default' }] });
  const s = await acquireBrowserSession(
    { scan: { browser: { cdpEndpoint: 'http://x:1' } } },
    undefined,
    {},
    f.loadEngine,
  );
  assert.ok(!s.warnings.some((w) => /no existing context/i.test(w)));
});
