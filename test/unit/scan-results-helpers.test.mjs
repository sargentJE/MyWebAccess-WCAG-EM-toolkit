// @ts-check
/**
 * @file Unit tests for the shared scan-result predicates.
 * @module test/unit/scan-results-helpers
 *
 * @description
 * Locks the three predicates every raw-artefact consumer routes through:
 * viewStatus / isAuditableView / viewIdentity. The legacy-entry cases are the
 * load-bearing backward-compat guard — every pre-feature fixture (no
 * pageOutcome / finalUrl) must stay `auditable` so introducing the field set is
 * behaviour-neutral for prior artefacts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewStatus, isAuditableView, viewIdentity } from '../../src/lib/scan-results.mjs';
import { normalizeUrl } from '../../src/lib/urls.mjs';

// SECTION: viewStatus

test('viewStatus: a legacy entry with no status fields is auditable', () => {
  assert.equal(viewStatus({ url: 'https://x.com/a', violations: [] }), 'auditable');
  assert.equal(viewStatus({}), 'auditable');
});

test('viewStatus: a string error is errored (execution fault)', () => {
  assert.equal(viewStatus({ url: 'https://x.com/a', error: 'timeout', violations: [] }), 'errored');
});

test('viewStatus: pageOutcome maps to challenge / empty / errored / auditable', () => {
  assert.equal(viewStatus({ pageOutcome: 'challenge' }), 'challenge');
  assert.equal(viewStatus({ pageOutcome: 'empty' }), 'empty');
  assert.equal(viewStatus({ pageOutcome: 'error' }), 'errored');
  assert.equal(viewStatus({ pageOutcome: 'ok' }), 'auditable');
});

test('viewStatus: a string error wins over a pageOutcome tag', () => {
  assert.equal(viewStatus({ error: 'boom', pageOutcome: 'challenge' }), 'errored');
});

test('viewStatus: redirectedToAlreadyScanned is redirect-duplicate', () => {
  assert.equal(
    viewStatus({ url: 'https://x.com/a', redirectedToAlreadyScanned: true }),
    'redirect-duplicate',
  );
});

// SECTION: isAuditableView

test('isAuditableView: true only for auditable views', () => {
  assert.equal(isAuditableView({ violations: [] }), true);
  assert.equal(isAuditableView({ pageOutcome: 'challenge' }), false);
  assert.equal(isAuditableView({ pageOutcome: 'empty' }), false);
  assert.equal(isAuditableView({ error: 'x' }), false);
  assert.equal(isAuditableView({ redirectedToAlreadyScanned: true }), false);
});

// SECTION: viewIdentity

test('viewIdentity: prefers finalUrl over url, normalised', () => {
  assert.equal(
    viewIdentity({ url: 'https://x.com/contact-us', finalUrl: 'https://x.com/get-in-touch/' }),
    normalizeUrl('https://x.com/get-in-touch/'),
  );
});

test('viewIdentity: falls back to the requested url when finalUrl is absent', () => {
  assert.equal(viewIdentity({ url: 'https://x.com/a/' }), normalizeUrl('https://x.com/a/'));
});

test('viewIdentity: returns the raw string when normalization throws', () => {
  assert.equal(viewIdentity({ url: 'not a url' }), 'not a url');
});

test('viewIdentity: about:blank does not throw', () => {
  assert.equal(viewIdentity({ url: 'about:blank' }), 'about:blank');
});
