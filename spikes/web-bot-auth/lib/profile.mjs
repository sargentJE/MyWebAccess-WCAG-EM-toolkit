// @ts-nocheck
/**
 * Web Bot Auth signing profile — constants + the deterministic known-answer-test
 * (KAT) fixture. Values CONFIRMED against primary sources (RFC 9421, the IETF
 * draft-meunier-web-bot-auth-architecture, Cloudflare docs) and the installed
 * `web-bot-auth@0.1.3` / `http-message-sig@0.2.0` artifacts — see ../README.md.
 *
 * NOTE: every value the library also exposes as a constant is cross-checked
 * against these in 04-verify.mjs, so a library/spec drift fails the gate loudly.
 */

// ── Signing profile (the two tags, the path, the content-type) ───────────────
export const REQUEST_TAG = 'web-bot-auth';
export const DIRECTORY_TAG = 'http-message-signatures-directory';
export const WELL_KNOWN_PATH = '/.well-known/http-message-signatures-directory'; // PLURAL (ADR-0021 writes it singular — wrong)
export const DIRECTORY_CONTENT_TYPE = 'application/http-message-signatures-directory+json';
export const COVERED_COMPONENTS = ['@authority', 'signature-agent']; // request signature
export const EXPIRES_WINDOW_MS = 60_000; // Cloudflare suggests ~1 minute to bound replay

// ── Placeholders (Phase 0 is offline; nothing is hosted or fetched) ──────────
// The real identity host is a Phase-1 decision (open question in the plan). The
// `.example` TLD is reserved (RFC 2606) so this can never resolve by accident.
export const PLACEHOLDER_DIRECTORY_URL =
  'https://auditor.myweb.example/.well-known/http-message-signatures-directory';
export const PLACEHOLDER_TARGET_URL = 'https://example.com/';
export const DIRECTORY_PURPOSE =
  'Authorized WCAG-EM accessibility auditing for contracted MyWeb Access engagements';

// ── RFC 9421 Appendix B.1.4 Ed25519 test key (testing only — public spec key) ─
// Used ONLY for the deterministic KAT below; never for real signing.
export const RFC_9421_ED25519_TEST_KEY = Object.freeze({
  kty: 'OKP',
  crv: 'Ed25519',
  kid: 'test-key-ed25519',
  d: 'n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU',
  x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs',
});

// ── Deterministic KAT fixture ────────────────────────────────────────────────
// Ed25519 is deterministic (RFC 8032): a fixed key + fixed base ⇒ a fixed
// signature. We assert the library reproduces these EXACT bytes AND that an
// independent Node-crypto signer over an independently-reconstructed base
// reproduces them too. Frozen literals double as an R6 churn detector.
//
// Fixed inputs: target https://example.com/, Signature-Agent =
// JSON.stringify(PLACEHOLDER_DIRECTORY_URL), created/expires below, 64 zero-byte
// nonce. (created/expires are in the past, so the KAT verifies with raw webcrypto
// only — the library verifiers reject expired signatures; see README.)
export const KAT = Object.freeze({
  created: 1718000000, // 2024-06-10T07:33:20Z
  expires: 1718000060,
  nonce: Buffer.from(new Uint8Array(64)).toString('base64'), // 64×0x00 → "AAAA…AA=="
  keyid: 'poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U', // RFC 7638 thumbprint of the test key
  // Exact signature value (base64, unwrapped from the `sig1=:…:` structured field):
  signature: 'yLAlbsIH6jpZUKhYbPvro4FLOkabACbCR7u3TggWgdumATQmfBUIq1uUerahnbJgYadlVBOtiGetVnrtv3fEBA==',
});
