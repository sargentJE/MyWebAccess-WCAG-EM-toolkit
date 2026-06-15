// @ts-nocheck
/**
 * Step 01 — generate a THROWAWAY Ed25519 keypair as a JWK.
 *
 * The library ships no keygen, so we use Node 22's built-in WebCrypto Ed25519
 * (confirmed accepted by `Ed25519Signer.fromJWK`). Keys are written ONLY into
 * `.keys/`, which the spike-local .gitignore (written before this script ever
 * ran) excludes from git. NEVER commit `.keys/`.
 *
 * Node prints `ExperimentalWarning: Ed25519 Web Crypto API` to stderr — expected,
 * and itself an R6 signal (the API may change). Run with NODE_OPTIONS=--no-warnings
 * to silence it for a clean PASS line; see README.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { jwkToKeyID, helpers } from 'web-bot-auth';

const HERE = dirname(fileURLToPath(import.meta.url));
export const KEYS_DIR = join(HERE, '.keys');

/**
 * @param {{ persist?: boolean }} [opts]
 * @returns {Promise<{ publicJwk: JsonWebKey, privateJwk: JsonWebKey, kid: string }>}
 */
export async function generateKeys({ persist = true } = {}) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', privateKey);

  const kid = await jwkToKeyID(publicJwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE);
  for (const jwk of [publicJwk, privateJwk]) {
    // No `alg`: Cloudflare's workerd importKey requires the RFC 8037 value "EdDSA" (or no
    // alg) for Ed25519 and throws DOMDataError on "Ed25519"; omitting it keeps the key
    // portable (matches the RFC 9421 reference key shape). Node's WebCrypto is lenient.
    jwk.use = 'sig';
    jwk.kid = kid;
  }

  if (persist) {
    await mkdir(KEYS_DIR, { recursive: true });
    await writeFile(join(KEYS_DIR, 'private.jwk'), `${JSON.stringify(privateJwk, null, 2)}\n`, { mode: 0o600 });
    await writeFile(join(KEYS_DIR, 'public.jwk'), `${JSON.stringify(publicJwk, null, 2)}\n`);
  }
  return { publicJwk, privateJwk, kid };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { kid } = await generateKeys();
  console.log(`01  generated throwaway Ed25519 keypair (kid=${kid}) → .keys/  [gitignored]`);
}
