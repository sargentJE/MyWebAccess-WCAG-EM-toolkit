// @ts-check
/**
 * @file Tests for the Ajv-based config validator, including the `validRegex`
 *   custom keyword.
 * @module test/unit/validate-config
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, assertValidConfig } from '../../src/lib/validate-config.mjs';

// SECTION: Fixtures
const validConfig = {
  name: 'unit-test',
  rootUrl: 'https://example.com/',
  scope: { mode: 'same-hostname' },
  crawl: { maxPages: 10 },
  sample: { structuredManual: ['https://example.com/'], randomSeed: 1 },
  scan: {},
};

// SECTION: Tests

test('accepts a minimal valid config', async () => {
  const result = await validateConfig(validConfig);
  assert.equal(result.valid, true);
  assert.equal(result.errors, null);
});

test('rejects missing rootUrl', async () => {
  // eslint-disable-next-line no-unused-vars
  const { rootUrl: _rootUrl, ...broken } = validConfig;
  const result = await validateConfig(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors && result.errors.length > 0);
});

test('rejects invalid scope.mode enum', async () => {
  const broken = { ...validConfig, scope: { mode: 'nonsense' } };
  const result = await validateConfig(broken);
  assert.equal(result.valid, false);
  const msg = (result.formatted ?? '').toLowerCase();
  assert.ok(
    msg.includes('mode') || msg.includes('enum'),
    'expected enum error in formatted output',
  );
});

test('validRegex keyword rejects an unparseable pattern', async () => {
  const broken = {
    ...validConfig,
    crawl: { ...validConfig.crawl, excludeUrlPatterns: ['(unclosed-group', '/good'] },
  };
  const result = await validateConfig(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors && result.errors.some((e) => e.keyword === 'validRegex'));
});

test('validRegex keyword accepts a valid pattern', async () => {
  const ok = {
    ...validConfig,
    crawl: { ...validConfig.crawl, excludeUrlPatterns: ['\\?replytocom=', '/good'] },
  };
  const result = await validateConfig(ok);
  assert.equal(result.valid, true);
});

test('runOnly enforces {type, values} object shape', async () => {
  const broken = {
    ...validConfig,
    scan: { axe: { runOnly: ['wcag2aa'] } }, // old bad shape
  };
  const result = await validateConfig(broken);
  assert.equal(result.valid, false);
});

test('runOnly accepts correct shape', async () => {
  const ok = {
    ...validConfig,
    scan: { axe: { runOnly: { type: 'tag', values: ['wcag2aa'] } } },
  };
  const result = await validateConfig(ok);
  assert.equal(result.valid, true);
});

test('assertValidConfig throws on invalid input with ConfigValidationError name', async () => {
  const broken = { ...validConfig, scope: { mode: 'nope' } };
  await assert.rejects(
    () => assertValidConfig(broken, '/tmp/test.json'),
    (err) => err instanceof Error && err.name === 'ConfigValidationError',
  );
});

test('rejects whitespace-only name (schema pattern "\\S")', async () => {
  const broken = { ...validConfig, name: '   ' };
  const result = await validateConfig(broken);
  assert.equal(result.valid, false);
  const msg = (result.formatted ?? '').toLowerCase();
  assert.ok(
    msg.includes('name') || msg.includes('pattern'),
    'expected name/pattern error in formatted output',
  );
});
