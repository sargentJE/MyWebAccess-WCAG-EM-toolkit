// @ts-check
/**
 * @file Unit tests for `buildExecutionHealth` (src/commands/summarize.mjs).
 * @module test/unit/summarize-execution-health
 *
 * @description
 * Locks the pages / page-views / failures arithmetic that the 2026-06 review
 * found unguarded (probes P1/P4): failed page-views were counted as scanned
 * pages and surfaced nowhere. The fixtures mirror the real artefact shapes
 * scan.mjs writes (success entries vs `{url, viewport, error, attempts,
 * violations: []}` failure entries; `_preScanStates`; process `.error`).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionHealth } from '../../src/commands/summarize.mjs';

// SECTION: Fixtures

/**
 * Two viewports x three pages: A ok+ok, B ok+failed (degraded), C failed+failed.
 *
 * @returns {any[]} axe-results entries in the shape scan.mjs writes.
 */
function mixedAxeResults() {
  const ok = (/** @type {string} */ url, /** @type {string} */ viewport) => ({
    url,
    viewport,
    attempts: 1,
    violations: [],
  });
  const fail = (/** @type {string} */ url, /** @type {string} */ viewport) => ({
    url,
    viewport,
    attempts: 1,
    error: 'page.goto: Timeout 3000ms exceeded',
    violations: [],
  });
  return [
    ok('https://site.example/a', 'desktop'),
    ok('https://site.example/b', 'desktop'),
    fail('https://site.example/c', 'desktop'),
    ok('https://site.example/a', 'reflow'),
    fail('https://site.example/b', 'reflow'),
    fail('https://site.example/c', 'reflow'),
  ];
}

// SECTION: Tests

test('pages vs page-views: degraded and failed pages are split, not conflated', () => {
  const { executionHealth } = buildExecutionHealth({
    axeResults: mixedAxeResults(),
    processResults: [],
    sampleMetadata: { finalSampleCount: 3 },
    inventoryMetadata: {},
  });

  assert.strictEqual(executionHealth.pagesInSample, 3, 'three unique pages attempted');
  assert.strictEqual(executionHealth.pagesFullyScanned, 1, 'only A succeeded on every viewport');
  assert.strictEqual(executionHealth.pagesDegraded.length, 1, 'B failed one of two viewports');
  assert.strictEqual(executionHealth.pagesDegraded[0].url, 'https://site.example/b');
  assert.deepStrictEqual(
    executionHealth.pagesDegraded[0].failures.map((/** @type {any} */ f) => f.viewport),
    ['reflow'],
  );
  assert.strictEqual(executionHealth.pagesFailed.length, 1, 'C failed every viewport');
  assert.strictEqual(executionHealth.pagesFailed[0].url, 'https://site.example/c');
  assert.strictEqual(executionHealth.pageViewsScanned, 3, 'three successful page-views');
  assert.strictEqual(executionHealth.pageViewsFailed, 3, 'three failed page-views');
  assert.strictEqual(executionHealth.sampleListedCount, 3);

  // The redefined samplePagesScanned derivation (fullyScanned + degraded):
  // pages with at least one successful view. C contributed nothing and must
  // not be counted as scanned.
  assert.strictEqual(
    executionHealth.pagesFullyScanned + executionHealth.pagesDegraded.length,
    2,
    'samplePagesScanned counts pages with >=1 successful view',
  );
});

test('failure warnings name every failed/degraded page for the scanWarnings channel', () => {
  const { warnings } = buildExecutionHealth({
    axeResults: mixedAxeResults(),
    processResults: [],
    sampleMetadata: {},
    inventoryMetadata: {},
  });
  assert.ok(
    warnings.some((w) => w.includes('failed to scan on all viewports') && w.includes('/c')),
    'fully-failed page warned',
  );
  assert.ok(
    warnings.some((w) => w.includes('failed on viewport(s) reflow') && w.includes('/b')),
    'degraded page warned with the failing viewport',
  );
});

test('process failures and pre-scan failures are inverted from their artefacts', () => {
  const axeResults = [
    {
      url: 'https://site.example/a',
      viewport: 'desktop',
      violations: [],
      _preScanStates: [
        { state: 'step-timeout', name: 'click', error: 'step "click" exceeded stepTimeoutMs=4000' },
        { state: 'screenshot:before', screenshot: '/tmp/x.png' },
      ],
    },
  ];
  const processResults = [
    { name: 'signup', startUrl: 'https://site.example/join', states: [], error: 'boom' },
    { name: 'search', startUrl: 'https://site.example/', states: [] },
  ];
  const { executionHealth, warnings } = buildExecutionHealth({
    axeResults,
    processResults,
    sampleMetadata: {},
    inventoryMetadata: {},
  });

  assert.deepStrictEqual(executionHealth.processFailures, [
    { name: 'signup', startUrl: 'https://site.example/join', error: 'boom' },
  ]);
  assert.strictEqual(executionHealth.preScanFailures.length, 1, 'ok states are not failures');
  assert.strictEqual(executionHealth.preScanFailures[0].action, 'click');
  assert.strictEqual(executionHealth.preScanFailures[0].state, 'step-timeout');
  assert.ok(warnings.some((w) => w.includes('process "signup" failed')));
  assert.ok(warnings.some((w) => w.includes('pre-scan action "click" step-timeout')));
});

test('reachedMaxPages from inventory-metadata surfaces as a truncation warning', () => {
  const { executionHealth, warnings } = buildExecutionHealth({
    axeResults: [],
    processResults: [],
    sampleMetadata: {},
    inventoryMetadata: { maxPagesConfigured: 50, reachedMaxPages: true },
  });
  assert.strictEqual(executionHealth.reachedMaxPages, true);
  assert.strictEqual(executionHealth.maxPagesConfigured, 50);
  assert.ok(warnings.some((w) => w.includes('maxPages=50')));
});

test('a clean run produces an empty-failure block and zero warnings', () => {
  const { executionHealth, warnings } = buildExecutionHealth({
    axeResults: [{ url: 'https://site.example/', viewport: 'desktop', violations: [] }],
    processResults: [{ name: 'search', startUrl: 'https://site.example/', states: [] }],
    sampleMetadata: { finalSampleCount: 1 },
    inventoryMetadata: { maxPagesConfigured: 50, reachedMaxPages: false },
  });
  assert.deepStrictEqual(executionHealth.pagesFailed, []);
  assert.deepStrictEqual(executionHealth.pagesDegraded, []);
  assert.deepStrictEqual(executionHealth.processFailures, []);
  assert.deepStrictEqual(executionHealth.preScanFailures, []);
  assert.deepStrictEqual(warnings, []);
});

// SECTION: E1 — could-not-audit accounting

test('E1: a challenge page-view is unauditable, not scanned, and never fully-scanned', () => {
  const { executionHealth, warnings } = buildExecutionHealth({
    axeResults: [
      { url: 'https://site.example/ok', viewport: 'desktop', violations: [] },
      {
        url: 'https://site.example/event',
        viewport: 'desktop',
        pageOutcome: 'challenge',
        degradedReason: 'cf-mitigated',
        violations: [],
      },
      {
        url: 'https://site.example/event',
        viewport: 'reflow',
        pageOutcome: 'challenge',
        degradedReason: 'cf-mitigated',
        violations: [],
      },
    ],
    processResults: [],
    sampleMetadata: { finalSampleCount: 2 },
    inventoryMetadata: {},
  });
  assert.strictEqual(executionHealth.pageViewsScanned, 1, 'only the ok view counts as scanned');
  assert.strictEqual(executionHealth.pageViewsUnauditable, 2, 'two challenge views');
  assert.strictEqual(executionHealth.challengePages, 1, 'one distinct challenge page');
  assert.strictEqual(executionHealth.pagesUnauditable.length, 1);
  assert.strictEqual(executionHealth.pagesUnauditable[0].url, 'https://site.example/event');
  // The all-challenge page must NOT be in byUrl, so it cannot inflate
  // pagesInSample or be miscounted as fully scanned.
  assert.strictEqual(executionHealth.pagesInSample, 1, 'all-challenge page is not in byUrl');
  assert.strictEqual(executionHealth.pagesFullyScanned, 1, 'only the ok page is fully scanned');
  assert.ok(
    warnings.some((w) => w.includes('could not audit') && w.includes('/event')),
    'a manual-review warning is emitted for the challenge page',
  );
});

test('E1 (H5 regression): an execution error stays in pagesFailed, not the unauditable bucket', () => {
  const { executionHealth } = buildExecutionHealth({
    axeResults: [
      {
        url: 'https://site.example/boom',
        viewport: 'desktop',
        error: 'page.goto: Timeout 60000ms exceeded',
        violations: [],
      },
    ],
    processResults: [],
    sampleMetadata: {},
    inventoryMetadata: {},
  });
  assert.strictEqual(executionHealth.pagesFailed.length, 1, 'error -> pagesFailed');
  assert.strictEqual(executionHealth.pagesUnauditable.length, 0, 'error is NOT unauditable');
  assert.strictEqual(executionHealth.pageViewsFailed, 1);
  assert.strictEqual(executionHealth.pageViewsUnauditable, 0);
});

test('E1: per-state process step failures are surfaced (the hidden step-failure defect)', () => {
  const { executionHealth, warnings } = buildExecutionHealth({
    axeResults: [],
    processResults: [
      {
        name: 'checkout',
        startUrl: 'https://site.example/checkout',
        states: [
          { state: 'loaded', violations: [] },
          { state: 'error', error: 'click timed out' },
        ],
      },
    ],
    sampleMetadata: {},
    inventoryMetadata: {},
  });
  assert.strictEqual(executionHealth.processStepFailures.length, 1);
  assert.strictEqual(executionHealth.processStepFailures[0].state, 'error');
  assert.strictEqual(executionHealth.processStepFailures[0].name, 'checkout');
  assert.ok(
    warnings.some((w) => w.includes('checkout') && w.includes('error')),
    'a process-step warning is emitted',
  );
});
