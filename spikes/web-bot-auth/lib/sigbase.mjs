// @ts-nocheck
/**
 * The INDEPENDENT verifier's core. We rebuild the RFC 9421 signature base with
 * Node's built-in `crypto.subtle` ONLY — never `web-bot-auth` / `http-message-sig`
 * — so the gate is non-circular (the library signs AND verifies through the same
 * base builder, so a shared bug would self-agree).
 *
 * Precisely what is independent vs anchored (do not overstate this):
 *  - Component VALUE lines (`@authority`, `signature-agent`) are derived here per
 *    RFC 9421 §2.2.3 / §2.1 — a wrong value ⇒ raw-verify fails. The
 *    `verifyDivergentAuthority` check exercises the case (uppercase host +
 *    non-default port) where this derivation and the library's could differ.
 *  - The `@signature-params` line is, per RFC 9421 §2.5, DEFINED as the verbatim
 *    `Signature-Input` value, so copying it is spec-correct (not a shortcut); its
 *    CONTENT (components/tag/keyid/created/expires/nonce) is anchored by the frozen
 *    `expectedSigInput` literal the library must reproduce byte-for-byte (the KAT).
 *  - The signature is checked with raw Node Ed25519 sign + verify, not the library.
 * Together a spec-wrong library is caught: a bad value ⇒ raw-verify fails; a bad
 * params serialization ⇒ the frozen-literal assertion fails.
 */

/** Strip the `sig1=` (or other label) prefix from a Signature-Input value. */
export function signatureInputValue(signatureInputHeader, label = 'sig1') {
  const prefix = `${label}=`;
  if (!signatureInputHeader.startsWith(prefix)) {
    throw new Error(`Signature-Input does not start with "${prefix}": ${signatureInputHeader}`);
  }
  return signatureInputHeader.slice(prefix.length);
}

/** Unwrap a `sig1=:<base64>:` structured-field signature to raw bytes. */
export function unwrapSignature(signatureHeader, label = 'sig1') {
  const m = signatureHeader.match(new RegExp(`^${label}=:([^:]+):$`));
  if (!m) throw new Error(`unexpected Signature header shape: ${signatureHeader}`);
  return Uint8Array.from(Buffer.from(m[1], 'base64'));
}

/** RFC 9421 §2.2.3 @authority: host[:port], lowercased, default port omitted. */
function deriveAuthority(url) {
  const u = new URL(url);
  let authority = u.hostname.toLowerCase();
  const isDefaultPort =
    u.port === '' ||
    (u.protocol === 'https:' && u.port === '443') ||
    (u.protocol === 'http:' && u.port === '80');
  if (!isDefaultPort) authority += `:${u.port}`;
  return authority;
}

/**
 * Reconstruct the signature base from the request and its Signature-Input value.
 * Supports the Web Bot Auth request profile (@authority + header components such
 * as signature-agent). Throws on any derived component it does not implement, so
 * it can never silently produce a wrong-but-plausible base.
 *
 * @param {{ url: string, getHeader: (name: string) => (string|null) }} message
 * @param {string} sigInputValue value returned by {@link signatureInputValue}
 * @returns {string} the exact bytes to be signed/verified
 */
export function reconstructSignatureBase(message, sigInputValue) {
  const listMatch = sigInputValue.match(/^\(([^)]*)\)/);
  if (!listMatch) throw new Error(`cannot parse covered-component list from: ${sigInputValue}`);
  const components = listMatch[1].length ? listMatch[1].split(' ').map((c) => c.replace(/^"|"$/g, '')) : [];

  const lines = components.map((name) => {
    if (name === '@authority') return `"@authority": ${deriveAuthority(message.url)}`;
    if (name.startsWith('@')) throw new Error(`derived component "${name}" not supported by this spike`);
    const value = message.getHeader(name);
    if (value == null) throw new Error(`covered header "${name}" missing from message`);
    return `"${name}": ${value.trim()}`;
  });
  lines.push(`"@signature-params": ${sigInputValue}`);
  return lines.join('\n');
}

/** Import an Ed25519 public JWK for raw verification (Node WebCrypto). */
export async function importPublic(jwk) {
  return crypto.subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, { name: 'Ed25519' }, false, [
    'verify',
  ]);
}

/** Import an Ed25519 private JWK for raw signing (Node WebCrypto). */
export async function importPrivate(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);
}

/** Raw Ed25519 verify of a signature over a base string — independent of the lib. */
export async function rawVerify(publicJwk, base, signatureBytes) {
  const key = await importPublic(publicJwk);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, signatureBytes, new TextEncoder().encode(base));
}

/** Raw Ed25519 sign of a base string — independent of the lib (for the KAT). */
export async function rawSign(privateJwk, base) {
  const key = await importPrivate(privateJwk);
  return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(base)));
}
