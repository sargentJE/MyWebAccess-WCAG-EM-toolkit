// @ts-check
/**
 * @file Unit tests for `src/lib/process-runner.mjs`.
 * @module test/unit/process-runner
 *
 * @description
 * Covers action routing, `fullPageScreenshots` propagation, per-step timeout
 * via Promise.race, and the error-to-state conversion path. Every mock
 * returns an explicit resolved Promise so Promise.race against the timeout
 * reaches the intended outcome.
 */

// SECTION: Imports
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { runStep, runProcessSteps, StepTimeoutError } from '../../src/lib/process-runner.mjs';

// SECTION: Helpers

function silentLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    trace: () => {},
    fatal: () => {},
  };
}

/**
 * Variadic async no-op — typed so `mock.fn(anyAsync)` captures a tuple of
 * any length in `call.arguments`, letting the test assert positional args.
 *
 * @param {...any} _args
 * @returns {Promise<any>}
 */
const anyAsync = async (..._args) => undefined;

/**
 * Build a fake StepContext whose page exposes only the methods `runStep`
 * touches. Returns the ctx plus the mock functions so tests can assert
 * call count and arguments.
 *
 * @param {Partial<{ timeoutMs: number, fullPageScreenshots: boolean | undefined }>} [overrides]
 * @returns {{ ctx: any, mocks: Record<string, any> }}
 */
function buildStepCtx(overrides = {}) {
  const click = mock.fn(anyAsync);
  const fill = mock.fn(anyAsync);
  const press = mock.fn(anyAsync);
  const waitForTimeout = mock.fn(anyAsync);
  const waitForSelector = mock.fn(anyAsync);
  const screenshot = mock.fn(anyAsync);
  const goto = mock.fn(anyAsync);

  const page = {
    goto,
    locator: () => ({
      first: () => ({ click, fill }),
    }),
    keyboard: { press },
    waitForTimeout,
    waitForSelector,
    screenshot,
  };

  // NOTE: the fake page implements only the subset runStep touches; cast
  // to `any` so TypeScript's checkJs accepts the narrow shape in place of
  // the full Playwright Page surface.
  const ctx = /** @type {any} */ ({
    page,
    config: {
      scan: {
        waitUntil: 'load',
        timeoutMs: overrides.timeoutMs ?? 5000,
        fullPageScreenshots: overrides.fullPageScreenshots,
      },
    },
    logger: silentLogger(),
    paths: {
      outDir: '/tmp/out',
      inventoryDir: '/tmp/out/inventory',
      resultsDir: '/tmp/out/results',
      reportsDir: '/tmp/out/reports',
      screenshotsDir: '/tmp/out/screenshots',
      sampleJsonPath: '/tmp/out/sample.json',
    },
    processDef: { name: 'signup', startUrl: 'https://example.com/join' },
    viewport: { id: 'desktop', width: 1280, height: 800 },
  });

  return { ctx, mocks: { goto, click, fill, press, waitForTimeout, waitForSelector, screenshot } };
}

// SECTION: Routing tests

test('goto action calls page.goto with waitUntil + timeout', async () => {
  const { ctx, mocks } = buildStepCtx();
  const result = await runStep({ action: 'goto', url: 'https://example.com/' }, ctx);
  assert.strictEqual(result, null, 'goto produces no state entry');
  assert.strictEqual(mocks.goto.mock.calls.length, 1);
  assert.strictEqual(mocks.goto.mock.calls[0].arguments[0], 'https://example.com/');
});

test('click action clicks the first matching locator', async () => {
  const { ctx, mocks } = buildStepCtx();
  const result = await runStep({ action: 'click', selector: 'button' }, ctx);
  assert.strictEqual(result, null);
  assert.strictEqual(mocks.click.mock.calls.length, 1);
});

test('fill action fills with the provided value', async () => {
  const { ctx, mocks } = buildStepCtx();
  await runStep({ action: 'fill', selector: 'input[name=email]', value: 'a@b.co' }, ctx);
  assert.strictEqual(mocks.fill.mock.calls.length, 1);
  assert.strictEqual(mocks.fill.mock.calls[0].arguments[0], 'a@b.co');
});

test('press action presses the keyboard key', async () => {
  const { ctx, mocks } = buildStepCtx();
  await runStep({ action: 'press', key: 'Enter' }, ctx);
  assert.strictEqual(mocks.press.mock.calls.length, 1);
  assert.strictEqual(mocks.press.mock.calls[0].arguments[0], 'Enter');
});

test('waitFor action calls page.waitForTimeout', async () => {
  const { ctx, mocks } = buildStepCtx();
  await runStep({ action: 'waitFor', timeoutMs: 100 }, ctx);
  assert.strictEqual(mocks.waitForTimeout.mock.calls.length, 1);
  assert.strictEqual(mocks.waitForTimeout.mock.calls[0].arguments[0], 100);
});

test('waitFor with a selector polls page.waitForSelector, not the sleep path', async () => {
  const { ctx, mocks } = buildStepCtx({ timeoutMs: 5000 });
  const result = await runStep({ action: 'waitFor', selector: '[data-hydrated]' }, ctx);
  assert.strictEqual(result, null, 'successful selector wait produces no state entry');
  assert.strictEqual(mocks.waitForSelector.mock.calls.length, 1);
  assert.strictEqual(mocks.waitForSelector.mock.calls[0].arguments[0], '[data-hydrated]');
  // No explicit step.timeoutMs -> the shared step budget (scan.timeoutMs)
  // minus the 50ms undercut that lets Playwright's selector-naming
  // TimeoutError deterministically beat runStep's rejectAfter race.
  assert.deepStrictEqual(mocks.waitForSelector.mock.calls[0].arguments[1], { timeout: 4950 });
  assert.strictEqual(mocks.waitForTimeout.mock.calls.length, 0, 'sleep path must not run');
});

test('waitFor with selector + timeoutMs passes the explicit timeout through', async () => {
  const { ctx, mocks } = buildStepCtx({ timeoutMs: 5000 });
  await runStep({ action: 'waitFor', selector: '#app', timeoutMs: 250 }, ctx);
  assert.deepStrictEqual(mocks.waitForSelector.mock.calls[0].arguments[1], { timeout: 250 });
});

test('waitFor with neither selector nor timeoutMs sleeps the 500ms default', async () => {
  const { ctx, mocks } = buildStepCtx();
  await runStep({ action: 'waitFor' }, ctx);
  assert.strictEqual(mocks.waitForSelector.mock.calls.length, 0);
  assert.strictEqual(mocks.waitForTimeout.mock.calls[0].arguments[0], 500);
});

test('a failing waitForSelector surfaces as state: error (absorbed, not thrown)', async () => {
  const { ctx } = buildStepCtx();
  ctx.page.waitForSelector = mock.fn(
    /** @type {any} */ (() => Promise.reject(new Error('Timeout 250ms exceeded'))),
  );
  const result = await runStep({ action: 'waitFor', selector: '#never', timeoutMs: 250 }, ctx);
  assert.ok(result);
  assert.strictEqual(result.state, 'error');
  assert.strictEqual(result.name, 'waitFor');
  assert.match(result.error ?? '', /Timeout 250ms exceeded/);
});

// SECTION: fullPageScreenshots propagation

test('screenshot honours fullPageScreenshots=false', async () => {
  const { ctx, mocks } = buildStepCtx({ fullPageScreenshots: false });
  const result = await runStep({ action: 'screenshot', name: 'blank' }, ctx);
  assert.strictEqual(mocks.screenshot.mock.calls.length, 1);
  assert.strictEqual(mocks.screenshot.mock.calls[0].arguments[0].fullPage, false);
  assert.ok(result);
  assert.strictEqual(result.state, 'screenshot:blank');
});

test('screenshot defaults to fullPage=true when flag is undefined', async () => {
  const { ctx, mocks } = buildStepCtx({ fullPageScreenshots: undefined });
  await runStep({ action: 'screenshot', name: 'blank' }, ctx);
  assert.strictEqual(mocks.screenshot.mock.calls[0].arguments[0].fullPage, true);
});

test('screenshot filename includes the viewport id suffix', async () => {
  const { ctx, mocks } = buildStepCtx();
  // buildStepCtx defaults viewport.id to "desktop".
  await runStep({ action: 'screenshot', name: 'confirmation' }, ctx);
  const pathArg = mocks.screenshot.mock.calls[0].arguments[0].path;
  assert.match(
    pathArg,
    /__confirmation__desktop\.png$/,
    `expected __confirmation__desktop.png suffix; got ${pathArg}`,
  );
});

// SECTION: Timeout + error paths

test('a hanging step produces state: step-timeout', async () => {
  const { ctx } = buildStepCtx({ timeoutMs: 50 });
  // Override goto to never resolve.
  ctx.page.goto = mock.fn(/** @type {any} */ (() => new Promise(() => {})));
  const start = Date.now();
  const result = await runStep({ action: 'goto', url: 'https://example.com/' }, ctx);
  const elapsed = Date.now() - start;
  assert.ok(result);
  assert.strictEqual(result.state, 'step-timeout');
  assert.strictEqual(result.name, 'goto');
  assert.ok(elapsed < 5000, 'should return shortly after stepTimeoutMs, not hang');
});

test('unknown action type produces state: error with a useful message', async () => {
  const { ctx } = buildStepCtx();
  const result = await runStep({ action: 'mystery' }, ctx);
  assert.ok(result);
  assert.strictEqual(result.state, 'error');
  assert.match(result.error ?? '', /unknown action: mystery/);
});

test('StepTimeoutError is the named error surface', () => {
  const err = new StepTimeoutError('click', 1000);
  assert.strictEqual(err.name, 'StepTimeoutError');
  assert.strictEqual(err.action, 'click');
  assert.strictEqual(err.timeoutMs, 1000);
});

test('timeout handle is cleared when step resolves first (no dangling timer)', async () => {
  // If the timer isn't cancelled when dispatch wins the race, Node keeps the
  // event loop alive for `stepTimeoutMs` past the step's completion. The test
  // uses a 10 s timeout and a trivially-fast click, asserts we're back in
  // < 200 ms, and relies on `--test`'s wall clock as the oracle.
  const { ctx } = buildStepCtx({ timeoutMs: 10000 });
  const started = Date.now();
  await runStep({ action: 'click', selector: 'button' }, ctx);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 200, `expected quick return (<200ms); got ${elapsed}ms`);
});

// SECTION: E1 — process-path page-outcome

test('E1 (§5.5): an axe step on a Cloudflare challenge records pageOutcome, not findings', async () => {
  const challengeResponse = {
    status: () => 403,
    headers: () => ({ 'cf-mitigated': 'challenge', 'cf-ray': 'abc123' }),
  };
  const ctx = /** @type {any} */ ({
    page: {
      goto: async () => challengeResponse,
      title: async () => 'Just a moment...',
      evaluate: async () => 'Checking your browser before accessing the site',
      url: () => 'https://example.com/events/blocked',
    },
    config: { rootUrl: 'https://example.com/', scan: { waitUntil: 'load', timeoutMs: 5000 } },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    processDef: { name: 'events', startUrl: 'https://example.com/events/' },
    viewport: { id: 'desktop', width: 1280, height: 800 },
  });
  // goto threads ctx.lastResponse (cf-mitigated); axe classifies it and skips
  // running the real axe engine.
  await runStep({ action: 'goto', url: 'https://example.com/events/blocked' }, ctx);
  const axeState = /** @type {any} */ (
    await runStep({ action: 'axe', state: 'events-landing' }, ctx)
  );
  assert.strictEqual(axeState.pageOutcome, 'challenge', 'state carries the challenge outcome');
  assert.deepStrictEqual(axeState.violations, [], 'no findings from a challenge page');
  assert.strictEqual(axeState.state, 'events-landing', 'the user-supplied state label is kept');
});

test('E1: states recorded after an errored step are tagged degraded', async () => {
  const { ctx } = buildStepCtx();
  const states = await runProcessSteps(
    ctx.processDef,
    [
      { action: 'mystery' }, // unknown action -> { state: 'error', ... }
      { action: 'screenshot', name: 'after' }, // recorded after the error
    ],
    ctx,
  );
  assert.strictEqual(states.length, 2);
  assert.strictEqual(states[0].state, 'error');
  assert.strictEqual(states[0].degraded, undefined, 'the failing step itself is not degraded');
  assert.strictEqual(states[1].degraded, true, 'a state recorded after the error is degraded');
});
