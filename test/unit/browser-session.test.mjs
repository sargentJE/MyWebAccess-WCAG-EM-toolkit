// @ts-check
/**
 * @file Browser transport seam — launch-branch lifecycle.
 * @module test/unit/browser-session
 *
 * @description
 * Locks the seam PREP's behaviour (the launch transport) without a real browser:
 *   - `openPageView` creates exactly one context with `{ viewport, ...auth }`,
 *     opens a page in it, and returns `{ page, release }` where `release` closes
 *     that context exactly once (and not before it is called).
 *   - empty auth options → only the viewport reaches `newContext`.
 *   - `disposeBrowserSession` closes the browser once.
 *
 * The per-attempt / per-process `try/finally` that CALLS `release` lives in the
 * commands; its error/teardown paths are exercised by
 * `scan-processes-isolation.test.mjs` and the e2e scan-health test.
 */

// SECTION: Imports
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { openPageView, disposeBrowserSession } from '../../src/lib/browser.mjs';

// SECTION: Helpers

const anyAsync = async () => undefined;

/**
 * A fake launch session: a browser whose `newContext` returns a context whose
 * `newPage` returns a sentinel page. Spies expose call counts + captured args.
 *
 * @returns {{ session: any, browser: any, context: any, page: any }}
 */
function fakeLaunchSession() {
  const page = /** @type {any} */ ({ __sentinel: 'page' });
  const context = {
    newPage: mock.fn(async () => page),
    close: mock.fn(anyAsync),
  };
  const browser = {
    newContext: mock.fn(async (/** @type {any} */ _opts) => context),
    close: mock.fn(anyAsync),
  };
  const session = /** @type {any} */ ({ transport: 'launch', browser, warnings: [] });
  return { session, browser, context, page };
}

/**
 * A fake CDP session: a connected browser exposing an existing default context
 * (unless `withDefaultContext:false`) plus a page that records `setViewportSize`
 * + `close`. Spies expose call counts.
 *
 * @param {{ withDefaultContext?: boolean }} [opts]
 * @returns {{ session: any, browser: any, defaultContext: any, page: any }}
 */
function fakeCdpSession(opts = {}) {
  const withDefaultContext = opts.withDefaultContext !== false;
  const page = /** @type {any} */ ({
    __sentinel: 'page',
    setViewportSize: mock.fn(anyAsync),
    close: mock.fn(anyAsync),
  });
  const defaultContext = { newPage: mock.fn(async () => page), close: mock.fn(anyAsync) };
  /** @type {any[]} */
  const contextsArr = withDefaultContext ? [defaultContext] : [];
  const browser = {
    contexts: mock.fn(() => contextsArr),
    newContext: mock.fn(async () => {
      const c = { newPage: mock.fn(async () => page), close: mock.fn(anyAsync) };
      contextsArr.push(c);
      return c;
    }),
    close: mock.fn(anyAsync),
  };
  const session = /** @type {any} */ ({ transport: 'cdp', browser, warnings: [] });
  return { session, browser, defaultContext, page };
}

const VP = { id: 'desktop', width: 1280, height: 800 };

// SECTION: Tests

test('openPageView (launch): one context with viewport+auth, page from that context', async () => {
  const { session, browser, context, page } = fakeLaunchSession();

  const view = await openPageView(session, VP, {
    httpCredentials: { username: 'u', password: 'p' },
  });

  assert.strictEqual(browser.newContext.mock.callCount(), 1);
  const opts = browser.newContext.mock.calls[0].arguments[0];
  assert.deepStrictEqual(opts.viewport, { width: 1280, height: 800 });
  assert.deepStrictEqual(opts.httpCredentials, { username: 'u', password: 'p' });
  assert.strictEqual(context.newPage.mock.callCount(), 1);
  assert.strictEqual(view.page, page, 'page comes from the created context');
  assert.strictEqual(typeof view.release, 'function');
});

test('openPageView (launch): release() closes the context exactly once, not before', async () => {
  const { session, context } = fakeLaunchSession();
  const view = await openPageView(session, VP, {});
  assert.strictEqual(context.close.mock.callCount(), 0, 'not closed until release');
  await view.release();
  assert.strictEqual(context.close.mock.callCount(), 1);
});

test('openPageView (launch): empty auth options → only viewport in newContext', async () => {
  const { session, browser } = fakeLaunchSession();
  await openPageView(session, VP, {});
  const opts = browser.newContext.mock.calls[0].arguments[0];
  assert.deepStrictEqual(opts.viewport, { width: 1280, height: 800 });
  assert.strictEqual(opts.httpCredentials, undefined);
  assert.strictEqual(opts.storageState, undefined);
});

test('disposeBrowserSession (launch): closes the browser once', async () => {
  const { session, browser } = fakeLaunchSession();
  await disposeBrowserSession(session);
  assert.strictEqual(browser.close.mock.callCount(), 1);
});

// SECTION: CDP transport — the keystone (reuse the human-cleared default context)

test('openPageView (cdp): reuses contexts()[0], sets viewport on the page, NEVER newContext', async () => {
  const { session, browser, defaultContext, page } = fakeCdpSession();

  const view = await openPageView(session, VP, {
    httpCredentials: { username: 'u', password: 'p' },
  });

  assert.ok(browser.contexts.mock.callCount() >= 1, 'reads the existing contexts');
  assert.strictEqual(
    browser.newContext.mock.callCount(),
    0,
    'must NOT create a fresh (incognito) context under cdp — it would drop cf_clearance',
  );
  assert.strictEqual(
    defaultContext.newPage.mock.callCount(),
    1,
    'page opened in the shared context',
  );
  assert.strictEqual(view.page, page);
  assert.deepStrictEqual(page.setViewportSize.mock.calls[0].arguments[0], {
    width: 1280,
    height: 800,
  });
});

test('openPageView (cdp): release closes the PAGE, never the shared context', async () => {
  const { session, defaultContext, page } = fakeCdpSession();
  const view = await openPageView(session, VP, {});
  await view.release();
  assert.strictEqual(page.close.mock.callCount(), 1, 'page closed');
  assert.strictEqual(defaultContext.close.mock.callCount(), 0, 'shared context NOT closed');
});

test('openPageView (cdp): falls back to newContext only when no default context exists', async () => {
  const { session, browser } = fakeCdpSession({ withDefaultContext: false });
  await openPageView(session, VP, {});
  assert.strictEqual(browser.newContext.mock.callCount(), 1, 'fallback context created');
});

test('disposeBrowserSession (cdp): disconnects via browser.close once', async () => {
  const { session, browser } = fakeCdpSession();
  await disposeBrowserSession(session);
  assert.strictEqual(browser.close.mock.callCount(), 1);
});

test('disposeBrowserSession (cdp): a disconnect error is swallowed (never fails the run)', async () => {
  const { session, browser } = fakeCdpSession();
  browser.close = mock.fn(async () => {
    throw new Error('disconnect blip');
  });
  await disposeBrowserSession(session); // must not throw
  assert.strictEqual(browser.close.mock.callCount(), 1);
});
