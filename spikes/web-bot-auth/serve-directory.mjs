// @ts-nocheck
/**
 * Phase-1 OPS HELPER (not toolkit code) — serve the signed Web Bot Auth key
 * directory at /.well-known/http-message-signatures-directory so it can be exposed
 * over a tunnel (cloudflared/ngrok) for the Cloudflare self-test + submission.
 *
 * It signs the directory PER REQUEST using the incoming Host, so the `@authority`
 * in the directory signature matches whatever public hostname the tunnel presents
 * — you do not need to know the final host in advance.
 *
 * KEY HANDLING (read carefully):
 *   --key <path>  (or env WBA_PRIVATE_JWK)  → your PRODUCTION private JWK. The
 *                                             private key is used only to sign; it
 *                                             is never served. Only the PUBLIC key
 *                                             appears in the directory body.
 *   (no key)      → an EPHEMERAL throwaway key is generated and a loud warning is
 *                   printed. Fine for wiring/tunnel tests; NEVER the real submission.
 *
 * Usage:
 *   node --no-warnings serve-directory.mjs --key /secure/path/production.jwk --port 8788
 *   node --no-warnings serve-directory.mjs                 # ephemeral key, :8788
 *   # in another shell, expose it:
 *   cloudflared tunnel --url http://localhost:8788
 *   # then self-test the public URL (see README "Phase 1 — human runbook").
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { directoryResponseHeaders, MediaType, jwkToKeyID, helpers } from 'web-bot-auth';
import { Ed25519Signer } from 'web-bot-auth/crypto';
import { generateKeys } from './01-generate-keys.mjs';
import { DIRECTORY_PURPOSE, WELL_KNOWN_PATH } from './lib/profile.mjs';

// A generous directory-signature window (IETF allows ≤24h). Each fetch is signed
// fresh anyway; a longer window avoids an expiry-during-verify edge case at the CDN.
const DIRECTORY_EXPIRES_MS = 6 * 60 * 60 * 1000;

/** Read `--name value` from argv. @param {string} name */
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const port = Number(arg('port') || process.env.WBA_PORT || 8788);
const keyPath = arg('key') || process.env.WBA_PRIVATE_JWK;

let privateJwk;
let publicJwk;
let ephemeral = false;
if (keyPath) {
  try {
    privateJwk = JSON.parse(await readFile(keyPath, 'utf8'));
  } catch (err) {
    console.error(`Could not read --key "${keyPath}": ${err.message}`);
    process.exit(1);
  }
  if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519' || !privateJwk.d) {
    console.error(`--key must be an Ed25519 (OKP) PRIVATE JWK with a "d" field; got kty=${privateJwk.kty}, crv=${privateJwk.crv}`);
    process.exit(1);
  }
  publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x };
} else {
  ({ publicJwk, privateJwk } = await generateKeys({ persist: false }));
  ephemeral = true;
}

const kid = await jwkToKeyID(publicJwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE);
const directory = {
  keys: [{ kid, kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x }],
  purpose: DIRECTORY_PURPOSE,
};
const body = JSON.stringify(directory);
const signer = await Ed25519Signer.fromJWK(privateJwk);

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method !== 'GET' || pathname !== WELL_KNOWN_PATH) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
    return;
  }
  try {
    // Sign for the ACTUAL public host the request arrived on (tunnel sets these).
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${port}`;
    const request = new Request(`https://${host}${WELL_KNOWN_PATH}`, { method: 'GET' });
    const response = new Response(body, {
      headers: { 'content-type': MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY },
    });
    const created = new Date();
    const expires = new Date(created.getTime() + DIRECTORY_EXPIRES_MS);
    const signed = await directoryResponseHeaders({ request, response }, [signer], { created, expires });
    res.writeHead(200, {
      'content-type': MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY,
      Signature: signed['Signature'],
      'Signature-Input': signed['Signature-Input'],
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`signing error: ${err.message}\n`);
  }
});

server.on('error', (err) => {
  console.error(
    err.code === 'EADDRINUSE'
      ? `Port ${port} is in use — pick another with --port <n>.`
      : `server error: ${err.message}`,
  );
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Web Bot Auth directory server → http://localhost:${port}${WELL_KNOWN_PATH}`);
  console.log(`  keyid (kid): ${kid}`);
  if (ephemeral) {
    console.log('  ⚠  EPHEMERAL throwaway key (no --key) — wiring/tunnel test ONLY, never the real submission.');
  } else {
    console.log(`  key: ${keyPath} (private key signs only; never served)`);
  }
  console.log(`  Expose it:   cloudflared tunnel --url http://localhost:${port}`);
  console.log(`  Submit then: https://<tunnel-host>${WELL_KNOWN_PATH}`);
});
