// @ts-check
/**
 * @file HTTP fixture server for e2e + integration tests.
 * @module test/fixtures/server
 *
 * @description
 * Generalises the `createServer`/`listen(0)`/`once(server,'listening')`
 * pattern that `test/unit/sitemap.test.mjs` has used since Layer 2 into a
 * reusable harness for reporter smoke tests, reporter XSS tests, the
 * discover-timeout behavioural test, and the authenticated-scan
 * integration test.
 *
 * Each call to `startFixtureServer` returns a distinct instance with no
 * shared state; ephemeral `listen(0)` ports mean parallel `node --test`
 * runs never collide. The caller is responsible for `await stop()`.
 *
 * @see docs/adr/0008-pluggable-reporters.md (Layer 4 test-infrastructure notes)
 */

// SECTION: Imports
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

// SECTION: MIME types

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

// SECTION: Types

/**
 * @typedef {object} FixtureServerOptions
 * @property {string} [staticDir]
 *   Absolute or repo-relative directory served from the root path. Files are
 *   resolved by concatenating the request URL path to the directory. Set to
 *   `undefined` to skip static serving.
 * @property {Record<string, (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void | Promise<void>>} [routes]
 *   Exact-match URL paths that pre-empt static serving. Matched BEFORE
 *   `staticDir`. Use for `/slow`, `/login`, etc.
 * @property {{ username: string, password: string, cookieName?: string, cookieValue?: string }} [auth]
 *   When set, the harness installs `/login` (GET returns the form, POST sets
 *   the cookie if credentials match) and guards `/protected/*` (returns 401
 *   without the cookie). Leaving this undefined disables the auth layer.
 * @property {number} [slowMs]
 *   When set, the harness installs `/slow` which waits this many ms before
 *   responding with a minimal 200 page. Used for discover-timeout behavioural
 *   testing.
 */

/**
 * @typedef {object} FixtureServerHandle
 * @property {string} baseUrl        Full `http://127.0.0.1:<port>` with no trailing slash.
 * @property {() => Promise<void>} stop  Closes the server. Idempotent.
 */

// SECTION: Helpers

/**
 * Safely resolve a request URL path to a filesystem path inside `staticDir`,
 * blocking path-traversal attempts (`../`).
 *
 * @param {string} staticDir
 * @param {string} urlPath
 * @returns {string | null}
 */
function safeResolve(staticDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.resolve(staticDir, '.' + decoded);
  const normalisedRoot = path.resolve(staticDir) + path.sep;
  if (!resolved.startsWith(normalisedRoot) && resolved !== path.resolve(staticDir)) {
    return null;
  }
  return resolved;
}

/**
 * Read the request body, up to 64 KiB. Rejects larger payloads to prevent
 * fixture-server DoS from a misbehaving test.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>}
 */
async function readBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 65536) {
        reject(new Error('request body exceeds 64 KiB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// SECTION: Public API

/**
 * Start a fresh fixture HTTP server on an ephemeral port.
 *
 * @param {FixtureServerOptions} [options]
 * @returns {Promise<FixtureServerHandle>}
 */
export async function startFixtureServer(options = {}) {
  const { staticDir, routes = {}, auth, slowMs } = options;
  // baseUrl is set after `listen(0)` resolves; closures below read it.
  // String captured by closure so request handlers see the assigned value.
  /** @type {string} */
  let baseUrl = '';

  const server = createServer(async (req, res) => {
    // Force connection close on every response. Default keep-alive
    // (Keep-Alive: timeout=5) causes some headless-browser navigation
    // strategies (waitUntil: 'load' / 'networkidle') to wait the full
    // keep-alive interval before declaring the page settled, which
    // makes test runs flaky and slow.
    res.setHeader('Connection', 'close');
    try {
      const url = req.url ?? '/';
      const urlPath = url.split('?')[0];

      // 1. Auth handlers take precedence over everything else so the test can
      //    hit /login before any static-file lookup.
      if (auth) {
        if (urlPath === '/login' && req.method === 'GET') {
          res.setHeader('content-type', MIME['.html']);
          res.end(loginFormHtml());
          return;
        }
        if (urlPath === '/login' && req.method === 'POST') {
          const body = await readBody(req);
          const params = new URLSearchParams(body);
          if (
            params.get('username') === auth.username &&
            params.get('password') === auth.password
          ) {
            const name = auth.cookieName ?? 'session';
            const value = auth.cookieValue ?? 'fixture-session-token';
            res.setHeader('set-cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`);
            res.setHeader('content-type', MIME['.html']);
            res.end('<p>Logged in</p>');
            return;
          }
          res.statusCode = 401;
          res.end('Invalid credentials');
          return;
        }
        if (urlPath.startsWith('/protected')) {
          const cookie = req.headers.cookie ?? '';
          const expected = `${auth.cookieName ?? 'session'}=${auth.cookieValue ?? 'fixture-session-token'}`;
          if (!cookie.split(';').some((c) => c.trim() === expected)) {
            res.statusCode = 401;
            res.setHeader('content-type', MIME['.html']);
            res.end('<h1>401 Unauthorized</h1>');
            return;
          }
          // Fall through to static serving for the protected path.
        }
      }

      // 2. Slow route (explicit opt-in via slowMs option).
      if (typeof slowMs === 'number' && urlPath === '/slow') {
        await new Promise((r) => setTimeout(r, slowMs));
        res.setHeader('content-type', MIME['.html']);
        res.end('<!DOCTYPE html><title>Slow</title><h1>Eventually responded</h1>');
        return;
      }

      // 3. Caller-supplied exact-match routes.
      const customHandler = routes[urlPath];
      if (customHandler) {
        await customHandler(req, res);
        return;
      }

      // 4. Static file serving.
      if (staticDir) {
        const filePath =
          urlPath === '/' ? path.join(staticDir, 'index.html') : safeResolve(staticDir, urlPath);
        if (filePath === null) {
          res.statusCode = 400;
          res.end('Bad path');
          return;
        }
        try {
          const body = await fs.readFile(filePath);
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream');
          // Server-side `__BASE_URL__` substitution for text-format files
          // (HTML, XML, CSS, JS, JSON, plain text). Lets fixture files
          // reference the dynamic ephemeral baseUrl by placeholder without
          // a build step. Binary files (PNG, JPEG, SVG bytes) pass through
          // unchanged.
          if (
            ext === '.html' ||
            ext === '.xml' ||
            ext === '.css' ||
            ext === '.js' ||
            ext === '.mjs' ||
            ext === '.json' ||
            ext === '.txt'
          ) {
            res.end(body.toString('utf8').replaceAll('__BASE_URL__', baseUrl));
          } else {
            res.end(body);
          }
          return;
        } catch (err) {
          if (/** @type {any} */ (err)?.code === 'ENOENT') {
            res.statusCode = 404;
            res.setHeader('content-type', MIME['.html']);
            res.end('<h1>404 Not Found</h1>');
            return;
          }
          throw err;
        }
      }

      // 5. No handler matched.
      res.statusCode = 404;
      res.end('Not found');
    } catch (err) {
      // Failsafe — never leave a request hanging.
      res.statusCode = 500;
      res.end(String(err instanceof Error ? err.message : err));
    }
  });

  server.listen(0);
  await once(server, 'listening');
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  baseUrl = `http://127.0.0.1:${address.port}`;

  /** @type {FixtureServerHandle} */
  return {
    baseUrl,
    stop: () => new Promise((resolve) => server.close(() => resolve(undefined))),
  };
}

// SECTION: Internal HTML snippets

/** @returns {string} */
function loginFormHtml() {
  return `<!DOCTYPE html>
<html><head><title>Login</title></head><body>
<form method="POST" action="/login">
  <label for="u">Username</label><input id="u" name="username" type="text">
  <label for="p">Password</label><input id="p" name="password" type="password">
  <button type="submit">Sign in</button>
</form>
</body></html>`;
}
