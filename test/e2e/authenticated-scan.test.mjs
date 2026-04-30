// @ts-check
/**
 * @file Integration test for storageState-based auth — Layer 4 R9.
 * @module test/e2e/authenticated-scan
 *
 * @description
 * Proves that `applyAuth`'s storageState wiring round-trips end-to-end
 * via Playwright: a context launched WITHOUT the cookie hits 401 on a
 * `/protected/*` URL, and a context launched WITH the cookie via the
 * applyAuth-derived `storageState` reaches 200. No spawnSync — direct
 * Playwright keeps this test fast (~5s) and lets the assertions be
 * specific about HTTP status codes rather than parsing axe output.
 *
 * Closes the Layer 3b follow-up CHANGELOG entry "Integration-level
 * authenticated-scan test".
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { startFixtureServer } from '../fixtures/server.mjs';
import { applyAuth } from '../../src/lib/auth.mjs';

// SECTION: Tests

test('authenticated scan: applyAuth.storageState lets Playwright pass /protected guard', { timeout: 60_000 }, async (t) => {
  const fixture = await startFixtureServer({
    auth: { username: 'audit-user', password: 's3cret' },
    routes: {
      '/protected/page': (req, res) => {
        // Auth handler in fixture/server.mjs already gates this path; if
        // we reach here with a valid cookie, return real HTML.
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(
          '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
            '<title>Protected</title></head><body><main><h1>Protected page</h1>' +
            '<p>You reached an authenticated resource.</p></main></body></html>',
        );
      },
    },
  });
  t.after(() => fixture.stop());

  // Persist a storageState JSON containing the fixture's session cookie.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'auth-e2e-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const statePath = path.join(tmp, 'storage-state.json');
  // The cookie's `domain` MUST match the fixture's host (127.0.0.1) so
  // Playwright sends it on requests to the fixture server.
  const url = new URL(fixture.baseUrl);
  const storageState = {
    cookies: [
      {
        name: 'session',
        value: 'fixture-session-token',
        domain: url.hostname,
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  };
  await fs.writeFile(statePath, JSON.stringify(storageState));

  // 1. Without storageState: /protected returns 401.
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const noAuthCtx = await browser.newContext();
  const noAuthPage = await noAuthCtx.newPage();
  const noAuthResponse = await noAuthPage.goto(`${fixture.baseUrl}/protected/page`);
  assert.equal(
    noAuthResponse?.status(),
    401,
    'without cookie, /protected must return 401',
  );
  await noAuthCtx.close();

  // 2. With storageState via applyAuth: /protected returns 200.
  const { contextOptions, warnings } = applyAuth({
    auth: { storageState: statePath },
  });
  assert.equal(warnings.length, 0, `applyAuth warnings unexpected: ${warnings.join('|')}`);
  // applyAuth's typedef returns `storageState: string | object` — looser
  // than Playwright's strict union. The cast is sound here: we wrote the
  // file ourselves at `statePath` and Playwright will read+parse it.
  const authedCtx = await browser.newContext(
    /** @type {import('playwright').BrowserContextOptions} */ (contextOptions),
  );
  const authedPage = await authedCtx.newPage();
  const authedResponse = await authedPage.goto(`${fixture.baseUrl}/protected/page`);
  assert.equal(
    authedResponse?.status(),
    200,
    'with cookie via applyAuth.storageState, /protected must return 200',
  );
  const body = await authedPage.content();
  assert.ok(
    body.includes('Protected page'),
    'protected page body must render with valid auth',
  );
  await authedCtx.close();
});
