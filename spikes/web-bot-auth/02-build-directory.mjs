// @ts-nocheck
/**
 * Step 02 — build the key directory JSON and sign it with the DIRECTORY tag.
 *
 * The library has no directory-JSON builder (we hand-roll `{ keys, purpose }`),
 * but it DOES provide `directoryResponseHeaders`, which signs a
 * Response/Request pair with tag `http-message-signatures-directory` (distinct
 * from the request tag `web-bot-auth`). Only the PUBLIC key goes in the
 * directory.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { directoryResponseHeaders, MediaType, jwkToKeyID, helpers } from 'web-bot-auth';
import { Ed25519Signer } from 'web-bot-auth/crypto';
import { PLACEHOLDER_DIRECTORY_URL, DIRECTORY_PURPOSE, EXPIRES_WINDOW_MS } from './lib/profile.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'out');

/**
 * @param {{ publicJwk: JsonWebKey, privateJwk: JsonWebKey, persist?: boolean }} opts
 */
export async function buildDirectory({ publicJwk, privateJwk, persist = true }) {
  const kid = await jwkToKeyID(publicJwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE);
  // Directory key: public components only (no `d`).
  const directoryKey = { kid, kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x };
  const directory = { keys: [directoryKey], purpose: DIRECTORY_PURPOSE };
  const body = JSON.stringify(directory);

  const signer = await Ed25519Signer.fromJWK(privateJwk);
  const request = new Request(PLACEHOLDER_DIRECTORY_URL, { method: 'GET' });
  const response = new Response(body, { headers: { 'content-type': MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY } });
  const created = new Date();
  const expires = new Date(created.getTime() + EXPIRES_WINDOW_MS);
  const signed = await directoryResponseHeaders({ request, response }, [signer], { created, expires });

  const artifact = {
    url: PLACEHOLDER_DIRECTORY_URL,
    contentType: MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY,
    directory,
    body,
    signed,
  };

  if (persist) {
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, 'directory.json'), `${JSON.stringify(directory, null, 2)}\n`);
    await writeFile(join(OUT_DIR, 'directory-signed-headers.json'), `${JSON.stringify(signed, null, 2)}\n`);
  }
  return artifact;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const publicJwk = JSON.parse(await readFile(join(HERE, '.keys', 'public.jwk'), 'utf8'));
  const privateJwk = JSON.parse(await readFile(join(HERE, '.keys', 'private.jwk'), 'utf8'));
  const { signed } = await buildDirectory({ publicJwk, privateJwk });
  console.log(`02  built + signed directory (tag=http-message-signatures-directory) → out/`);
  console.log(`    Signature-Input: ${signed['Signature-Input'].slice(0, 72)}…`);
}
