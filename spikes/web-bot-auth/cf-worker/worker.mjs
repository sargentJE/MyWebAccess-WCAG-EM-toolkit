// @ts-nocheck
/**
 * Cloudflare Worker — serves the signed Web Bot Auth key directory at
 * /.well-known/http-message-signatures-directory for `auditor.mywebaccess.co.uk`.
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

export default {
  /**
   * @param {Request} request
   * @param {{ WBA_PRIVATE_JWK: string }} env  WBA_PRIVATE_JWK = the private JWK (Wrangler secret)
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== WELL_KNOWN_PATH) {
      return new Response('not found\n', { status: 404, headers: { 'content-type': 'text/plain' } });
    }
    if (!env.WBA_PRIVATE_JWK) {
      return new Response('WBA_PRIVATE_JWK secret not set\n', { status: 500 });
    }

    const privateJwk = JSON.parse(env.WBA_PRIVATE_JWK);
    const publicJwk = { kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x };
    const kid = await jwkToKeyID(publicJwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE);

    const directory = {
      keys: [{ kid, kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x }],
      purpose: DIRECTORY_PURPOSE,
    };
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
  },
};
