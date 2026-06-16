// @ts-nocheck
/**
 * Cloudflare Worker for `auditor.mywebaccess.co.uk` — serves the signed Web Bot Auth
 * key directory at /.well-known/http-message-signatures-directory, plus a public
 * "about" identity page at / (used as the bot's documentation URL).
 *
 * This is the production port of ../serve-directory.mjs: it signs the directory
 * PER REQUEST using the incoming Host (so it's correct for whatever hostname the
 * route serves), and the private key never leaves the Worker — it is read from a
 * Wrangler secret and used only to sign. Only the PUBLIC key is in the body.
 *
 * Deploy: see ../README.md "Phase 1 — human runbook", step 3. In short:
 *   cd spikes/web-bot-auth/cf-worker
 *   npm i web-bot-auth@0.1.3
 *   npx wrangler secret put WBA_PRIVATE_JWK   # paste your production private JWK
 *   npx wrangler deploy
 * then bind the custom domain auditor.mywebaccess.co.uk to this Worker.
 */
import { directoryResponseHeaders, MediaType, jwkToKeyID, helpers } from 'web-bot-auth';
import { Ed25519Signer } from 'web-bot-auth/crypto';

const WELL_KNOWN_PATH = '/.well-known/http-message-signatures-directory';
const DIRECTORY_PURPOSE =
  'Authorized WCAG-EM accessibility auditing for contracted MyWeb Access engagements';
const DIRECTORY_EXPIRES_MS = 6 * 60 * 60 * 1000; // 6h; re-signed each request

// Human-readable identity page served at "/" — the Bot documentation URL for
// Cloudflare's Bot Submission Form. Kept accessible (lang, semantic landmarks,
// headings, descriptive links) — fitting for an accessibility auditor's own page.
const ABOUT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MyWeb Access Accessibility Auditor</title>
  </head>
  <body>
    <main>
      <h1>MyWeb Access Accessibility Auditor</h1>
      <p>
        This is the public identity page for the automated web accessibility auditor
        operated by the <strong>MyWeb Access</strong> service.
      </p>
      <h2>What it does</h2>
      <p>
        It runs authorized, per-engagement accessibility audits (WCAG, using the
        WCAG-EM methodology) of websites we are contracted to assess, crawling and
        scanning a sample of pages with a real browser.
      </p>
      <h2>How it behaves</h2>
      <ul>
        <li>Audits only sites we are authorized and contracted to assess.</li>
        <li>Respects <code>robots.txt</code>.</li>
        <li>Runs locally and uses no AI.</li>
        <li>
          Identifies itself cryptographically via Web Bot Auth (RFC 9421 HTTP Message
          Signatures) &mdash; it announces who it is rather than evading detection.
        </li>
      </ul>
      <h2>Key directory</h2>
      <p>
        Public keys used to sign its requests:
        <a href="/.well-known/http-message-signatures-directory">/.well-known/http-message-signatures-directory</a>.
      </p>
      <h2>Contact</h2>
      <p>
        Operated by the MyWeb Access service &mdash;
        <a href="https://www.mywebaccess.co.uk">www.mywebaccess.co.uk</a>. To report an
        issue, or to allow or block this auditor on your site, please contact us there.
      </p>
    </main>
  </body>
</html>
`;

export default {
  /**
   * @param {Request} request
   * @param {{ WBA_PRIVATE_JWK: string }} env  WBA_PRIVATE_JWK = the private JWK (Wrangler secret)
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      // Public "about" page = the bot's documentation URL.
      return new Response(ABOUT_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (request.method !== 'GET' || url.pathname !== WELL_KNOWN_PATH) {
      return new Response('not found\n', { status: 404, headers: { 'content-type': 'text/plain' } });
    }
    if (!env.WBA_PRIVATE_JWK) {
      return new Response('WBA_PRIVATE_JWK secret not set\n', { status: 500 });
    }

    try {
      const stored = JSON.parse(env.WBA_PRIVATE_JWK);
      // workerd's crypto.subtle.importKey rejects an Ed25519 JWK whose `alg` !== "EdDSA"
      // (workerd ec.c++: JSG_REQUIRE(alg == "EdDSA", DOMDataError, ...)). Our generator may
      // stamp alg:"Ed25519"/use/key_ops; strip to the members importKey needs so an
      // already-deployed key works unchanged. Mirrors the library's own verify-path strip.
      const privateJwk = { kty: stored.kty, crv: stored.crv, x: stored.x, d: stored.d };
      const publicJwk = { kty: stored.kty, crv: stored.crv, x: stored.x };
      const kid = await jwkToKeyID(publicJwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE);

      const directory = { keys: [{ kid, ...publicJwk }], purpose: DIRECTORY_PURPOSE };
      const body = JSON.stringify(directory);

      const signer = await Ed25519Signer.fromJWK(privateJwk);
      const response = new Response(body, {
        headers: { 'content-type': MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY },
      });
      const created = new Date();
      const expires = new Date(created.getTime() + DIRECTORY_EXPIRES_MS);
      const signed = await directoryResponseHeaders({ request, response }, [signer], { created, expires });

      return new Response(body, {
        headers: {
          'content-type': MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY,
          Signature: signed['Signature'],
          'Signature-Input': signed['Signature-Input'],
          'cache-control': 'no-store',
        },
      });
    } catch (err) {
      // Surface the real reason instead of a bare Cloudflare 1101.
      return new Response(`directory signing error: ${err && err.message ? err.message : err}\n`, {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
    }
  },
};
