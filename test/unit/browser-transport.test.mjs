// @ts-check
/**
 * @file Transport selection — `resolveTransport` + `browserNeedsLocalBinary` (E8).
 * @module test/unit/browser-transport
 *
 * @description
 * Pure decision logic, unit-testable without a browser: how config + environment
 * map to a launch-vs-cdp plan, the `WCAG_EM_CDP_ENDPOINT` env override, the
 * ignored-knob warnings under CDP, and which combinations still need a local
 * Playwright browser binary (the preflight input).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTransport, browserNeedsLocalBinary } from '../../src/lib/browser.mjs';

// SECTION: resolveTransport

test('resolveTransport: no scan.browser → launch / playwright / headless true, no warnings', () => {
  const p = resolveTransport({}, {});
  assert.strictEqual(p.transport, 'launch');
  assert.strictEqual(p.engine, 'playwright');
  assert.strictEqual(p.headless, true);
  assert.deepStrictEqual(p.warnings, []);
});

test('resolveTransport: launch honours headless:false and channel', () => {
  const p = resolveTransport({ scan: { browser: { headless: false, channel: 'chrome' } } }, {});
  assert.strictEqual(p.transport, 'launch');
  assert.strictEqual(p.headless, false);
  assert.strictEqual(p.channel, 'chrome');
});

test('resolveTransport: engine patchright is selected', () => {
  const p = resolveTransport({ scan: { browser: { engine: 'patchright' } } }, {});
  assert.strictEqual(p.engine, 'patchright');
});

test('resolveTransport: cdpEndpoint from config → cdp transport', () => {
  const p = resolveTransport({ scan: { browser: { cdpEndpoint: 'http://127.0.0.1:9222' } } }, {});
  assert.strictEqual(p.transport, 'cdp');
  assert.strictEqual(p.cdpEndpoint, 'http://127.0.0.1:9222');
});

test('resolveTransport: WCAG_EM_CDP_ENDPOINT env alone → cdp', () => {
  const p = resolveTransport({}, { WCAG_EM_CDP_ENDPOINT: 'http://env:2222' });
  assert.strictEqual(p.transport, 'cdp');
  assert.strictEqual(p.cdpEndpoint, 'http://env:2222');
});

test('resolveTransport: env endpoint OVERRIDES the config endpoint and warns', () => {
  const p = resolveTransport(
    { scan: { browser: { cdpEndpoint: 'http://config:1111' } } },
    { WCAG_EM_CDP_ENDPOINT: 'http://env:2222' },
  );
  assert.strictEqual(p.cdpEndpoint, 'http://env:2222');
  assert.ok(p.warnings.some((w) => /overrides scan\.browser\.cdpEndpoint/.test(w)));
});

test('resolveTransport: cdp + auth/channel/headless set → an ignored-knob warning for each', () => {
  const p = resolveTransport(
    {
      auth: { storageState: {} },
      scan: { browser: { cdpEndpoint: 'http://x:1', channel: 'chrome', headless: false } },
    },
    {},
  );
  assert.strictEqual(p.transport, 'cdp');
  assert.ok(p.warnings.some((w) => /config\.auth is ignored/.test(w)));
  assert.ok(p.warnings.some((w) => /channel is ignored/.test(w)));
  assert.ok(p.warnings.some((w) => /headless is ignored/.test(w)));
});

test('resolveTransport: blank/whitespace endpoints are ignored (stay launch)', () => {
  assert.strictEqual(
    resolveTransport({ scan: { browser: { cdpEndpoint: '   ' } } }, {}).transport,
    'launch',
  );
  assert.strictEqual(resolveTransport({}, { WCAG_EM_CDP_ENDPOINT: '  ' }).transport, 'launch');
});

// SECTION: browserNeedsLocalBinary

test('browserNeedsLocalBinary: true only for launch + playwright', () => {
  assert.strictEqual(browserNeedsLocalBinary({}, {}), true);
  assert.strictEqual(
    browserNeedsLocalBinary({ scan: { browser: { engine: 'patchright' } } }, {}),
    false,
    'patchright manages its own browser',
  );
  assert.strictEqual(
    browserNeedsLocalBinary({ scan: { browser: { cdpEndpoint: 'http://x:1' } } }, {}),
    false,
    'cdp attaches to an external browser',
  );
  assert.strictEqual(
    browserNeedsLocalBinary({}, { WCAG_EM_CDP_ENDPOINT: 'http://x:1' }),
    false,
    'env endpoint also implies cdp',
  );
});
