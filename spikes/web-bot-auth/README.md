# Web Bot Auth — Phase 0 signing spike

A **throwaway, offline feasibility spike** for registering the MyWeb Access auditor
as a Cloudflare-recognised **Web Bot Auth** verified bot (RFC 9421 HTTP Message
Signatures). It proves the crypto round-trip works with the maintained library
**before** any toolkit code is written.

- Implements Phase 0 of [`docs/plans/2026-06-web-bot-auth-registration.md`](../../docs/plans/2026-06-web-bot-auth-registration.md)
  ([ADR-0021](../../docs/adr/0021-waf-challenge-access-strategy.md)).
- **Not part of the published package** (excluded by the root `files` allowlist),
  not linted/typechecked/tested by the toolkit gate, and **not a runtime dependency**.
- **Self-verified, NOT Cloudflare-validated.** This spike never touches the network.
  It proves the library runs on Node 22 with our key material and emits
  **spec-conformant** signatures (checked independently with Node's own crypto). It
  does **not** prove Cloudflare interop — that is the Phase-1 gate (see below).

## Run it

```bash
nvm use 22
npm ci                              # reproducible install from the committed lockfile
npm run spike                       # the full gate — expect: PASS, 10/10, exit 0
npm run spike:negative              # demo: a tampered signature is rejected (throws, exit 1)
```

`npm run spike` runs `node --no-warnings round-trip.mjs`. Expected output:

```
✓ PASS  lib constants match confirmed profile                                tags, path, content-type, components
✓ PASS  KAT: Signature-Input matches frozen wire literal
✓ PASS  KAT: library reproduces frozen Ed25519 signature
✓ PASS  KAT: independent raw-sign reproduces frozen signature                (byte-identical, independent impls)
✓ PASS  KAT: independent raw-verify of library signature
✓ PASS  KAT: independent thumbprint == keyid
✓ PASS  request: INDEPENDENT raw-crypto verify + wire assertions             @authority+signature-agent, tag, keyid=thumbprint
✓ PASS  divergent @authority: independent base == library base + raw-verify  uppercase host lowercased, :8443 kept
✓ PASS  request: CORROBORATING web-bot-auth.verify()                         intended consumer path resolves
✓ PASS  directory: http-message-sig.verify + structural                      tag, content-type, public-only key
✓ PASS  negative control: tampered sig rejected by both paths                raw=false, lib throws /invalid signature/

RESULT: PASS — 11/11 checks. SELF-VERIFIED, not Cloudflare-validated.
```

### Why `--no-warnings`

Node 22's WebCrypto **Ed25519 is still flagged experimental** and prints
`ExperimentalWarning` to stderr on `generateKey`/`importKey`. `--no-warnings`
keeps the PASS line clean; it does **not** hide a failure. The warning is itself
an **R6 churn signal** (the API may change) — noted here rather than silently
buried.

## What each piece does

| File | Role |
| --- | --- |
| `01-generate-keys.mjs` | Throwaway Ed25519 keypair via Node WebCrypto → JWK in `.keys/` (gitignored). The library ships no keygen. |
| `02-build-directory.mjs` | Hand-rolled `{ keys, purpose }` directory JSON, signed via `directoryResponseHeaders` (directory tag). Public key only. |
| `03-sign-request.mjs` | `signatureHeaders` with `Signature-Agent` set first → request tag, covers `@authority` + `signature-agent`. |
| `04-verify.mjs` | The checks: KAT, independent raw-crypto verify, divergent-@authority cross-check, corroborating library verify, directory verify, negative control. |
| `round-trip.mjs` | Orchestrates 01→04 in-process, offline. Exit 0 ⇔ all pass. |
| `lib/profile.mjs` | Confirmed profile constants + the deterministic KAT fixture (RFC 9421 test key). |
| `lib/sigbase.mjs` | **Independent** RFC 9421 signature-base reconstruction + raw Ed25519 sign/verify (Node crypto only). |
| `lib/thumbprint.mjs` | **Independent** RFC 7638 / RFC 8037 thumbprint (Node `crypto`), cross-checks the library's `keyid`. |

### Why two verification paths

The library both signs and verifies through the same `http-message-sig` base
builder, so a self-consistent round-trip is **circular** — it proves the library
agrees with itself, which its own CI already shows. The gate adds an
**independent** path with Node's `crypto.subtle` only (never the library):

- Component **value** lines (`@authority`, `signature-agent`) are reconstructed
  independently in `lib/sigbase.mjs` per RFC 9421; a wrong value fails raw-verify.
- The `@signature-params` line is, per RFC 9421 §2.5, the verbatim `Signature-Input`
  value (copying it is spec-correct, not a shortcut); its **content** is anchored by
  a frozen expected-literal the library must reproduce byte-for-byte (the KAT).
- Ed25519 is deterministic (RFC 8032), so an independent Node-crypto sign over the
  reconstructed base yields the **byte-identical** frozen signature.
- The **divergent `@authority`** check signs to an uppercase host + non-default port
  (`https://EXAMPLE.com:8443/`) — where our derivation and the library's could differ
  — and asserts our base equals the library's, so independence is *demonstrated*, not
  merely plausible.

A spec-wrong library is therefore caught, not masked.

## Confirmed signing profile (verbatim — Phase 2 should copy from here)

- **Two distinct tags:** requests use `tag="web-bot-auth"`; the directory's own
  signature uses `tag="http-message-signatures-directory"`.
- **Well-known path (PLURAL):** `/.well-known/http-message-signatures-directory`.
  (ADR-0021 currently writes it singular — that is a typo; the library constant and
  the IETF/Cloudflare sources are plural.)
- **Directory content-type:** `application/http-message-signatures-directory+json`.
- **Request covered components:** `("@authority" "signature-agent")`.
- **`keyid`:** the base64url RFC 7638 JWK SHA-256 thumbprint of the Ed25519 key.
- **`expires`:** short (~60 s here) to bound replay.
- **Key type:** Ed25519 (`kty:"OKP"`, `crv:"Ed25519"`).
- **Directory signature scope (Phase-2 note):** the library's directory signature
  covers only `("@authority";req)` (label `binding0`) — it does **not** bind the
  JWKS body. Phase 2 should add a `Content-Digest` so the signed directory
  authenticates the keys themselves, not just the authority.

Pinned exact: `web-bot-auth@0.1.3` + `http-message-sig@0.2.0` — the latter is
declared directly (not left transitive) because the spike imports it for the
tag-agnostic directory verify. Both are **pre-1.0 and self-described "not audited"**;
the lockfile is committed so the whole tree is reproducible (R6).

## Phase 1 — human runbook (NOT done in this spike)

1. Decide the production identity host (open question). Publish the **signed JWKS**
   at `https://<host>/.well-known/http-message-signatures-directory` (HTTPS,
   content-type above). The `out/` artifacts here are the reference. A tunnel
   (cloudflared/ngrok) is fine for the test.
2. **Self-test over the wire** against
   `https://http-message-signatures-example.research.cloudflare.com` and/or
   `https://crawltest.com/cdn-cgi/web-bot-auth` — the first point at which
   "Cloudflare accepts the signature" can truthfully be claimed.
3. Generate + secure the **production** keypair in the operator secret store (never
   the repo or logs).
4. **Bot Submission Form:** dashboard → Manage Account → Configurations → Bot
   Submission Form → method "Request Signature" → directory URL (User-Agent optional).
5. **Decisive go/no-go:** on the MyVision `/event*` zone (we control it), add a WAF
   rule on `cf.bot_management.verified_bot` and confirm signed traffic is recognised
   **and** the challenge clears.

## Cleanup

Everything regenerates. To reset:

```bash
rm -rf .keys out node_modules
```

`.keys/` (private keys), `out/` (artifacts), and `node_modules/` are gitignored by
this directory's own `.gitignore`; only source + `package.json` + `package-lock.json`
are tracked.
