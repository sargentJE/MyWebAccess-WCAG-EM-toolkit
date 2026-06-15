// @ts-nocheck
/**
 * Step 03 — sign an HTTP request with the REQUEST tag (`web-bot-auth`).
 *
 * We set the `Signature-Agent` header (the directory URL, as a structured-field
 * string) BEFORE signing, so the library auto-covers components
 * ["@authority", "signature-agent"] (its REQUEST_COMPONENTS), auto-adds
 * tag="web-bot-auth", and generates a 64-byte nonce. A fixed `nonce`/`created`/
 * `expires` may be passed for the deterministic KAT.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { signatureHeaders } from 'web-bot-auth';
import { signerFromJWK } from 'web-bot-auth/crypto';
import { PLACEHOLDER_TARGET_URL, PLACEHOLDER_DIRECTORY_URL, EXPIRES_WINDOW_MS } from './lib/profile.mjs';
import { signatureInputValue, reconstructSignatureBase } from './lib/sigbase.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'out');

/**
 * @param {{
 *   privateJwk: JsonWebKey,
 *   target?: string, directoryUrl?: string,
 *   created?: Date, expires?: Date, nonce?: string,
 *   persist?: boolean
 * }} opts
 */
export async function signRequest({
  privateJwk,
  target = PLACEHOLDER_TARGET_URL,
  directoryUrl = PLACEHOLDER_DIRECTORY_URL,
  created = new Date(),
  expires,
  nonce,
  persist = false,
}) {
  expires = expires ?? new Date(created.getTime() + EXPIRES_WINDOW_MS);
  const signatureAgentValue = JSON.stringify(directoryUrl); // structured-field string: "https://…"

  const request = new Request(target, { headers: { 'Signature-Agent': signatureAgentValue } });
  const signer = await signerFromJWK(privateJwk);
  const params = { created, expires };
  if (nonce) params.nonce = nonce;
  const signed = await signatureHeaders(request, signer, params);

  // Independently reconstruct the signature base from the wire output, for the
  // raw-crypto verification in step 04 (and to capture as an artifact).
  const base = reconstructSignatureBase(
    { url: target, getHeader: () => signatureAgentValue },
    signatureInputValue(signed['Signature-Input']),
  );

  const artifact = { target, directoryUrl, signatureAgentValue, signed, base };

  if (persist) {
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(join(OUT_DIR, 'request-signed-headers.json'), `${JSON.stringify(signed, null, 2)}\n`);
    await writeFile(join(OUT_DIR, 'request-signature-base.txt'), base);
  }
  return artifact;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const privateJwk = JSON.parse(await readFile(join(HERE, '.keys', 'private.jwk'), 'utf8'));
  const { signed } = await signRequest({ privateJwk, persist: true });
  console.log(`03  signed request (tag=web-bot-auth) → out/`);
  console.log(`    Signature-Input: ${signed['Signature-Input'].slice(0, 72)}…`);
}
