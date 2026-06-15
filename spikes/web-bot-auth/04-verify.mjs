// @ts-nocheck
/**
 * Step 04 — verify the round-trip. Two independence levels, kept explicit:
 *
 *  • INDEPENDENT  — base reconstructed in our sigbase.mjs, checked with Node's
 *    crypto.subtle. Does not trust the library's verifier or base builder.
 *  • CORROBORATING — the library's own verifier path (web-bot-auth.verify /
 *    http-message-sig.verify). Confirms the intended consumer path also works.
 *
 * The directory is verified via http-message-sig's TAG-AGNOSTIC verify, because
 * web-bot-auth.verify() is hard-coded to the request tag and throws on the
 * directory tag (see README / plan correction #2).
 *
 * Each function returns { name, pass, detail }; round-trip.mjs tallies them.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  verify as wbaVerify,
  HTTP_MESSAGE_SIGNATURE_TAG,
  MediaType,
  Tag,
  HTTP_MESSAGE_SIGNATURES_DIRECTORY,
  REQUEST_COMPONENTS,
} from 'web-bot-auth';
import { verifierFromJWK } from 'web-bot-auth/crypto';
import { verify as hmsVerify } from 'http-message-sig';
import {
  reconstructSignatureBase,
  signatureInputValue,
  unwrapSignature,
  rawVerify,
  rawSign,
} from './lib/sigbase.mjs';
import { ed25519JwkThumbprint } from './lib/thumbprint.mjs';
import {
  RFC_9421_ED25519_TEST_KEY,
  KAT,
  REQUEST_TAG,
  DIRECTORY_TAG,
  DIRECTORY_CONTENT_TYPE,
  WELL_KNOWN_PATH,
  COVERED_COMPONENTS,
  KAT_DIRECTORY_URL,
  PLACEHOLDER_TARGET_URL,
} from './lib/profile.mjs';
import { signRequest } from './03-sign-request.mjs';

const ok = (name, detail = '') => ({ name, pass: true, detail });
const bad = (name, detail) => ({ name, pass: false, detail });

/** Cross-check the library's exported constants against our confirmed profile. */
export function verifyConstants() {
  const checks = [
    [HTTP_MESSAGE_SIGNATURE_TAG === REQUEST_TAG, `request tag ${HTTP_MESSAGE_SIGNATURE_TAG}`],
    [Tag.HTTP_MESSAGE_SIGNAGURES_DIRECTORY === DIRECTORY_TAG, `directory tag ${Tag.HTTP_MESSAGE_SIGNAGURES_DIRECTORY}`],
    [MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY === DIRECTORY_CONTENT_TYPE, `content-type ${MediaType.HTTP_MESSAGE_SIGNATURES_DIRECTORY}`],
    [HTTP_MESSAGE_SIGNATURES_DIRECTORY === WELL_KNOWN_PATH, `well-known ${HTTP_MESSAGE_SIGNATURES_DIRECTORY}`],
    [JSON.stringify(REQUEST_COMPONENTS) === JSON.stringify(COVERED_COMPONENTS), `components ${JSON.stringify(REQUEST_COMPONENTS)}`],
  ];
  const failed = checks.filter(([passed]) => !passed).map(([, d]) => d);
  return failed.length
    ? bad('lib constants match confirmed profile', `mismatch: ${failed.join('; ')}`)
    : ok('lib constants match confirmed profile', 'tags, path, content-type, components');
}

/**
 * Deterministic known-answer test against the RFC 9421 test key. Fully
 * independent: an independent base reconstruction + Node-crypto Ed25519 sign must
 * reproduce the EXACT frozen signature, and the library must emit it too.
 */
export async function runKAT() {
  const created = new Date(KAT.created * 1000);
  const expires = new Date(KAT.expires * 1000);
  const { signed, base, signatureAgentValue } = await signRequest({
    privateJwk: RFC_9421_ED25519_TEST_KEY,
    target: PLACEHOLDER_TARGET_URL,
    directoryUrl: KAT_DIRECTORY_URL,
    created,
    expires,
    nonce: KAT.nonce,
  });

  const expectedSigInput =
    `sig1=("@authority" "signature-agent");created=${KAT.created};keyid="${KAT.keyid}";alg="ed25519";` +
    `expires=${KAT.expires};nonce="${KAT.nonce}";tag="web-bot-auth"`;
  const libSig = Buffer.from(unwrapSignature(signed['Signature'])).toString('base64');

  if (signed['Signature-Input'] !== expectedSigInput) {
    return [bad('KAT: Signature-Input matches frozen wire literal', `got ${signed['Signature-Input']}`)];
  }
  if (libSig !== KAT.signature) {
    return [bad('KAT: library reproduces frozen Ed25519 signature', `got ${libSig}`)];
  }

  // Independent: sign our reconstructed base with raw Node crypto → must equal frozen value.
  const mySig = Buffer.from(await rawSign(RFC_9421_ED25519_TEST_KEY, base)).toString('base64');
  if (mySig !== KAT.signature) {
    return [bad('KAT: independent raw-sign reproduces frozen signature', `got ${mySig}`)];
  }
  // Independent: raw verify the library's signature over our base.
  const rawOk = await rawVerify(RFC_9421_ED25519_TEST_KEY, base, unwrapSignature(signed['Signature']));
  if (!rawOk) return [bad('KAT: independent raw-verify of library signature', 'returned false')];

  // Independent thumbprint == keyid on the wire.
  const tp = ed25519JwkThumbprint(RFC_9421_ED25519_TEST_KEY);
  if (tp !== KAT.keyid) return [bad('KAT: independent thumbprint == keyid', `got ${tp}`)];

  return [
    ok('KAT: Signature-Input matches frozen wire literal'),
    ok('KAT: library reproduces frozen Ed25519 signature'),
    ok('KAT: independent raw-sign reproduces frozen signature', '(byte-identical, independent impls)'),
    ok('KAT: independent raw-verify of library signature'),
    ok('KAT: independent thumbprint == keyid'),
  ];
}

/** Generated-key request: independent raw verify + structural assertions. */
export async function verifyRequestIndependent(publicJwk, art) {
  const sigInput = signatureInputValue(art.signed['Signature-Input']);
  const base = reconstructSignatureBase(
    { url: art.target, getHeader: () => art.signatureAgentValue },
    sigInput,
  );
  const rawOk = await rawVerify(publicJwk, base, unwrapSignature(art.signed['Signature']));
  if (!rawOk) return bad('request: INDEPENDENT raw-crypto verify', 'returned false');

  // structural: covered components, tag, keyid == independent thumbprint
  const tp = ed25519JwkThumbprint(publicJwk);
  const wants = [`("@authority" "signature-agent")`, `tag="web-bot-auth"`, `keyid="${tp}"`];
  const missing = wants.filter((w) => !art.signed['Signature-Input'].includes(w));
  if (missing.length) return bad('request: wire assertions (components/tag/keyid)', `missing ${missing.join(', ')}`);
  return ok('request: INDEPENDENT raw-crypto verify + wire assertions', '@authority+signature-agent, tag, keyid=thumbprint');
}

/**
 * Demonstrate independence on the DIVERGENT @authority path — uppercase host + an
 * explicit non-default port, the case where our derivation and the library's
 * COULD differ (default-port omission, host case). Asserts our independently-built
 * base equals the library's actual base byte-for-byte AND raw-verify passes —
 * turning "independence is structurally plausible" into "independence is exercised".
 */
export async function verifyDivergentAuthority({ privateJwk, publicJwk }) {
  const target = 'https://EXAMPLE.com:8443/';
  const art = await signRequest({ privateJwk, target });
  const myBase = reconstructSignatureBase(
    { url: target, getHeader: () => art.signatureAgentValue },
    signatureInputValue(art.signed['Signature-Input']),
  );
  // Capture the library's ACTUAL signed base (via the tag-agnostic verify callback)
  // and require byte-equality — this is the genuine cross-check, not a tautology.
  let libBase;
  const signed = new Request(target, {
    headers: {
      'Signature-Agent': art.signatureAgentValue,
      Signature: art.signed['Signature'],
      'Signature-Input': art.signed['Signature-Input'],
    },
  });
  await hmsVerify(signed, (data) => {
    libBase = data;
  });
  if (myBase !== libBase) {
    return bad('divergent @authority: independent base == library base', `mine="${myBase.split('\n')[0]}" lib="${libBase.split('\n')[0]}"`);
  }
  const rawOk = await rawVerify(publicJwk, myBase, unwrapSignature(art.signed['Signature']));
  if (!rawOk) return bad('divergent @authority: independent raw-verify', 'returned false');
  return ok('divergent @authority: independent base == library base + raw-verify', 'uppercase host lowercased, :8443 kept');
}

/** Generated-key request: corroborating library verifier path (within window). */
export async function verifyRequestCorroborating(publicJwk, art) {
  const request = new Request(art.target, {
    headers: {
      'Signature-Agent': art.signatureAgentValue,
      Signature: art.signed['Signature'],
      'Signature-Input': art.signed['Signature-Input'],
    },
  });
  try {
    await wbaVerify(request, await verifierFromJWK(publicJwk));
    return ok('request: CORROBORATING web-bot-auth.verify()', 'intended consumer path resolves');
  } catch (e) {
    return bad('request: CORROBORATING web-bot-auth.verify()', e.message);
  }
}

/** Directory: real verification via the tag-agnostic http-message-sig.verify. */
export async function verifyDirectory(publicJwk, art) {
  const request = new Request(art.url, { method: 'GET' });
  const response = new Response(art.body, {
    headers: {
      'content-type': art.contentType,
      Signature: art.signed['Signature'],
      'Signature-Input': art.signed['Signature-Input'],
    },
  });
  let seenTag;
  try {
    await hmsVerify({ request, response }, async (data, signature, params) => {
      seenTag = params.tag;
      const valid = await rawVerify(publicJwk, data, signature);
      if (!valid) throw new Error('invalid directory signature');
    });
  } catch (e) {
    return bad('directory: http-message-sig.verify + raw-crypto', e.message);
  }
  if (seenTag !== DIRECTORY_TAG) return bad('directory: signed with directory tag', `tag=${seenTag}`);
  if (art.contentType !== DIRECTORY_CONTENT_TYPE) return bad('directory: content-type', art.contentType);
  const k = art.directory.keys?.[0];
  if (!k || k.kty !== 'OKP' || k.crv !== 'Ed25519' || !k.x || k.d) {
    return bad('directory: key shape (public OKP/Ed25519, no private d)', JSON.stringify(k));
  }
  return ok('directory: http-message-sig.verify + structural', 'tag, content-type, public-only key');
}

/** Negative control: a corrupted signature must fail BOTH paths, specifically. */
export async function negativeControl({ publicJwk, privateJwk }) {
  // Long expiry so the ONLY possible rejection reason is the bad signature:
  // web-bot-auth.verify() checks expiry BEFORE the signature, so a slow/paused run
  // with a 60s window could otherwise throw "expired" and mask this control.
  const art = await signRequest({ privateJwk, expires: new Date(Date.now() + 3600_000) });
  const sigBytes = unwrapSignature(art.signed['Signature']);
  const tampered = Uint8Array.from(sigBytes);
  tampered[0] ^= 0x01; // flip one bit

  const sigInput = signatureInputValue(art.signed['Signature-Input']);
  const base = reconstructSignatureBase({ url: art.target, getHeader: () => art.signatureAgentValue }, sigInput);
  const rawStillOk = await rawVerify(publicJwk, base, tampered);
  if (rawStillOk) return bad('negative control: raw verify rejects tampered sig', 'raw verify returned TRUE');

  const tamperedHeader = `sig1=:${Buffer.from(tampered).toString('base64')}:`;
  const request = new Request(art.target, {
    headers: {
      'Signature-Agent': art.signatureAgentValue,
      Signature: tamperedHeader,
      'Signature-Input': art.signed['Signature-Input'],
    },
  });
  try {
    await wbaVerify(request, await verifierFromJWK(publicJwk));
    return bad('negative control: lib verify rejects tampered sig', 'lib verify did NOT throw');
  } catch (e) {
    if (!/invalid signature/i.test(e.message)) {
      return bad('negative control: lib throws specifically /invalid signature/', `threw: ${e.message}`);
    }
  }
  return ok('negative control: tampered sig rejected by both paths', 'raw=false, lib throws /invalid signature/');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { readFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const publicJwk = JSON.parse(await readFile(join(here, '.keys', 'public.jwk'), 'utf8'));
  const privateJwk = JSON.parse(await readFile(join(here, '.keys', 'private.jwk'), 'utf8'));
  const art = await signRequest({ privateJwk });
  console.log(await verifyRequestIndependent(publicJwk, art));
  console.log(await verifyRequestCorroborating(publicJwk, art));
}
