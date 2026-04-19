// @ts-check
/**
 * @file Tests for `buildRequestDelayHook` — Layer 3a's crawl throttle.
 * @module test/unit/discover-throttle
 *
 * @description
 * The throttle hook is a pure async function: sleep for `requestDelayMs`
 * milliseconds if the value is finite and positive; otherwise return
 * immediately. Tests use the wall clock as the oracle. No Crawlee, no
 * Playwright.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequestDelayHook } from '../../src/commands/discover.mjs';

// SECTION: Tests

test('buildRequestDelayHook sleeps for the configured number of ms', async () => {
  const hook = buildRequestDelayHook(50);
  const started = Date.now();
  await hook();
  const elapsed = Date.now() - started;
  // Allow a small scheduler tolerance; the floor is the only assertion that matters.
  assert.ok(elapsed >= 45, `expected >= ~50ms; got ${elapsed}ms`);
});

test('buildRequestDelayHook returns fast when requestDelayMs is 0', async () => {
  const hook = buildRequestDelayHook(0);
  const started = Date.now();
  await hook();
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 20, `expected < 20ms; got ${elapsed}ms`);
});

test('buildRequestDelayHook returns fast when requestDelayMs is undefined', async () => {
  const hook = buildRequestDelayHook(undefined);
  const started = Date.now();
  await hook();
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 20, `expected < 20ms; got ${elapsed}ms`);
});

test('buildRequestDelayHook returns fast for NaN / negative values (inert, not throw)', async () => {
  for (const bad of [NaN, -100, /** @type {any} */ ('not-a-number')]) {
    const hook = buildRequestDelayHook(bad);
    const started = Date.now();
    await hook(); // must not throw
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 20, `expected < 20ms for input ${bad}; got ${elapsed}ms`);
  }
});

test('buildRequestDelayHook returns a callable (can be invoked more than once)', async () => {
  const hook = buildRequestDelayHook(10);
  await hook();
  await hook();
  // No exception is the contract — two consecutive calls both resolve.
});
