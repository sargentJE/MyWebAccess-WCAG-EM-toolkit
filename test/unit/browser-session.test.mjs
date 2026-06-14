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
