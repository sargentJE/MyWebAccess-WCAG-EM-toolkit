// @ts-nocheck
import { createHash } from 'node:crypto';

/**
 * Independent RFC 7638 JWK thumbprint for an Ed25519 (OKP) key — RFC 8037 §2.
 * Canonical JSON is the required members in lexicographic order (crv, kty, x),
 * SHA-256, base64url (no padding). Implemented with Node's `crypto` ONLY, so it
 * is a genuine cross-check of the library's `jwkToKeyID` (which uses WebCrypto),
 * not a re-use of it.
 *
 * @param {{ crv: string, kty: string, x: string }} jwk
 * @returns {string} base64url thumbprint (the Web Bot Auth `keyid`)
 */
export function ed25519JwkThumbprint(jwk) {
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    throw new Error(`expected an Ed25519 OKP JWK, got kty=${jwk.kty} crv=${jwk.crv}`);
  }
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x });
  return createHash('sha256').update(canonical).digest('base64url');
}
