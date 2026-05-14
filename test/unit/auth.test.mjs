// @ts-check
/**
 * @file Tests for `applyAuth` + `warnSchemaAcceptedRuntimeIgnored` —
 *   authenticated-scan context builder.
 * @module test/unit/auth
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  applyAuth,
  warnSchemaAcceptedRuntimeIgnored,
  warnLegacyAliasResolved,
} from '../../src/lib/auth.mjs';

// SECTION: Helpers

/**
 * Mock pino-compatible logger capturing warn calls.
 *
 * @returns {{ warn: (obj: any, msg?: string) => void, calls: Array<{obj: any, msg: string|undefined}> }}
 */
function mockLogger() {
  /** @type {Array<{obj: any, msg: string|undefined}>} */
  const calls = [];
  return {
    calls,
    warn(obj, msg) {
      calls.push({ obj, msg });
    },
  };
}

// SECTION: applyAuth — no auth configured

test('applyAuth: no auth field → empty options, no warnings', () => {
  const result = applyAuth({});
  assert.deepEqual(result.contextOptions, {});
  assert.deepEqual(result.warnings, []);
});

test('applyAuth: auth:null → empty options', () => {
  const result = applyAuth({ auth: null });
  assert.deepEqual(result.contextOptions, {});
  assert.deepEqual(result.warnings, []);
});

// SECTION: applyAuth — storageState as inline object

test('applyAuth: storageState as inline object → passed through verbatim', () => {
  const inline = { cookies: [{ name: 'sid', value: 'abc' }], origins: [] };
  const result = applyAuth({ auth: { storageState: inline } });
  assert.equal(result.contextOptions.storageState, inline);
  assert.deepEqual(result.warnings, []);
});

// SECTION: applyAuth — storageState as path (filesystem)

test('applyAuth: storageState as path (file exists, fresh mtime) → absolute path, no warn', async (t) => {
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'auth-test-'));
  t.after(() => fs.promises.rm(tmpdir, { recursive: true, force: true }));
  const statePath = path.join(tmpdir, 'state.json');
  fs.writeFileSync(statePath, '{"cookies":[],"origins":[]}');

  const result = applyAuth({ auth: { storageState: statePath } });
  assert.equal(result.contextOptions.storageState, statePath);
  assert.equal(result.warnings.length, 0);
});

test('applyAuth: storageState path does not exist → warn, no storageState in options', () => {
  const result = applyAuth({ auth: { storageState: '/nonexistent/path/state.json' } });
  assert.equal(result.contextOptions.storageState, undefined);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /unreadable/);
  assert.match(result.warnings[0], /ENOENT/);
});

test('applyAuth: storageState path older than ttlMinutes → staleness warn', async (t) => {
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'auth-test-'));
  t.after(() => fs.promises.rm(tmpdir, { recursive: true, force: true }));
  const statePath = path.join(tmpdir, 'state.json');
  fs.writeFileSync(statePath, '{"cookies":[],"origins":[]}');
  // Force mtime to 2 hours ago.
  const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
  fs.utimesSync(statePath, oldTime, oldTime);

  const result = applyAuth({ auth: { storageState: statePath, ttlMinutes: 60 } });
  assert.equal(result.contextOptions.storageState, statePath);
  assert.ok(
    result.warnings.some((w) => /exceeds ttlMinutes/.test(w)),
    'expected a staleness warning',
  );
});

test('applyAuth: storageState within ttlMinutes → no staleness warn', async (t) => {
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'auth-test-'));
  t.after(() => fs.promises.rm(tmpdir, { recursive: true, force: true }));
  const statePath = path.join(tmpdir, 'state.json');
  fs.writeFileSync(statePath, '{"cookies":[],"origins":[]}');

  const result = applyAuth({ auth: { storageState: statePath, ttlMinutes: 1440 } });
  assert.equal(result.contextOptions.storageState, statePath);
  const staleWarns = result.warnings.filter((w) => /exceeds ttlMinutes/.test(w));
  assert.equal(staleWarns.length, 0);
});

// SECTION: applyAuth — httpCredentials

test('applyAuth: httpCredentials → pass-through with coerced strings', () => {
  const result = applyAuth({
    auth: { httpCredentials: { username: 'user', password: 'secret' } },
  });
  assert.deepEqual(result.contextOptions.httpCredentials, {
    username: 'user',
    password: 'secret',
  });
});

// SECTION: applyAuth — extraHttpHeaders

test('applyAuth: extraHttpHeaders → pass-through with Playwright-cased key', () => {
  const result = applyAuth({
    auth: { extraHttpHeaders: { 'X-Audit': 'run-id-42' } },
  });
  assert.deepEqual(result.contextOptions.extraHTTPHeaders, { 'X-Audit': 'run-id-42' });
  assert.equal(
    /** @type {any} */ (result.contextOptions).extraHttpHeaders,
    undefined,
    'camelCase key must NOT appear (Playwright expects extraHTTPHeaders)',
  );
});

// SECTION: applyAuth — setupScript deferral

test('applyAuth: setupScript set → warn emitted via shared helper phrasing', () => {
  const result = applyAuth({ auth: { setupScript: './setup.mjs' } });
  assert.ok(
    result.warnings.some((w) => /auth\.setupScript.*schema-accepted but runtime-ignored/.test(w)),
    'expected a setupScript deferral warning',
  );
});

test('applyAuth: empty setupScript string → no warn', () => {
  const result = applyAuth({ auth: { setupScript: '' } });
  assert.equal(
    result.warnings.filter((w) => /setupScript/.test(w)).length,
    0,
    'empty setupScript should not trigger the warn',
  );
});

// SECTION: applyAuth — combined fields

test('applyAuth: storageState + httpCredentials + extraHttpHeaders all threaded', async (t) => {
  const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'auth-test-'));
  t.after(() => fs.promises.rm(tmpdir, { recursive: true, force: true }));
  const statePath = path.join(tmpdir, 'state.json');
  fs.writeFileSync(statePath, '{"cookies":[],"origins":[]}');

  const result = applyAuth({
    auth: {
      storageState: statePath,
      httpCredentials: { username: 'u', password: 'p' },
      extraHttpHeaders: { 'X-Audit': '1' },
    },
  });
  assert.equal(result.contextOptions.storageState, statePath);
  assert.deepEqual(result.contextOptions.httpCredentials, { username: 'u', password: 'p' });
  assert.deepEqual(result.contextOptions.extraHTTPHeaders, { 'X-Audit': '1' });
});

// SECTION: warnSchemaAcceptedRuntimeIgnored helper

test('warnSchemaAcceptedRuntimeIgnored: emits a uniform message format', () => {
  const logger = mockLogger();
  // The helper signature types the logger as pino's full Logger; tests
  // inject a minimal shim so cast to any at the call site.
  warnSchemaAcceptedRuntimeIgnored(/** @type {any} */ (logger), {
    feature: 'auth.setupScript',
    deferralLayer: 'a later layer',
  });
  warnSchemaAcceptedRuntimeIgnored(/** @type {any} */ (logger), {
    feature: 'reporting.reporters',
    deferralLayer: 'the reporter pipeline',
  });
  assert.equal(logger.calls.length, 2);
  assert.match(logger.calls[0].msg ?? '', /auth\.setupScript.*schema-accepted but runtime-ignored/);
  assert.match(
    logger.calls[1].msg ?? '',
    /reporting\.reporters.*schema-accepted but runtime-ignored/,
  );
  // Uniform structural shape: both pass {feature} as the obj.
  assert.equal(logger.calls[0].obj.feature, 'auth.setupScript');
  assert.equal(logger.calls[1].obj.feature, 'reporting.reporters');
});

// SECTION: warnLegacyAliasResolved helper

test('warnLegacyAliasResolved: emits oldField → newField pointer with deprecation phrasing', () => {
  const logger = mockLogger();
  warnLegacyAliasResolved(/** @type {any} */ (logger), {
    oldField: 'reporting.markdownReport',
    newField: 'reporting.reporters',
    guidance: "Omit the field to keep the default ['json','markdown'] set.",
  });
  assert.equal(logger.calls.length, 1);
  assert.match(
    logger.calls[0].msg ?? '',
    /reporting\.markdownReport is deprecated and ignored; use reporting\.reporters instead/,
  );
  assert.match(logger.calls[0].msg ?? '', /Omit the field/);
  assert.equal(logger.calls[0].obj.oldField, 'reporting.markdownReport');
  assert.equal(logger.calls[0].obj.newField, 'reporting.reporters');
});

test('warnLegacyAliasResolved: guidance is optional', () => {
  const logger = mockLogger();
  warnLegacyAliasResolved(/** @type {any} */ (logger), {
    oldField: 'legacy.foo',
    newField: 'modern.foo',
  });
  assert.equal(logger.calls.length, 1);
  assert.equal(
    logger.calls[0].msg,
    'legacy.foo is deprecated and ignored; use modern.foo instead.',
  );
});
