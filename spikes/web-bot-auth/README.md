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
| `serve-directory.mjs` | **Phase-1 ops helper** (not a gate step): serves the signed directory at the well-known path, signed per-request for the incoming Host, ready to tunnel to Cloudflare. `npm run serve`. |
| `self-test.mjs` | **Phase-1 ops helper:** signs a request and sends it to a verifier endpoint (Cloudflare `/v0/api/verify`, crawltest) to confirm the wire format is accepted. `npm run self-test`. |
| `cf-worker/` | **Phase-1 hosting template:** a Cloudflare Worker (production port of `serve-directory.mjs`, signs per-request) + `wrangler.toml`, to host the directory at `auditor.mywebaccess.co.uk`. |
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

## Phase 1 — human runbook (executable; NOT done in this spike)

All of this is **human ops** (DNS, secrets, the Cloudflare dashboard); the tools here
make each step turnkey. Run from `spikes/web-bot-auth/` after `npm ci`.

**Prerequisites:** Node 22; a Cloudflare account controlling `mywebaccess.co.uk` DNS;
`npx wrangler` (Cloudflare CLI); optionally `cloudflared` for a quick tunnel.

### Step 1 — Production keypair

```bash
cd spikes/web-bot-auth && npm ci
node 01-generate-keys.mjs                 # writes .keys/{private,public}.jwk (gitignored)
```

Then **move `.keys/private.jwk` into your secret store** (never commit it); note the
printed `kid`. Host is fixed: `auditor.mywebaccess.co.uk` (`DIRECTORY_URL` in
`lib/profile.mjs`). _Done when:_ the private key is in your secret store.

### Step 2 — Wire self-test (no DNS yet)

Confirms Cloudflare's verifier accepts the signature **format** before you host anything.

```bash
npm run self-test                          # signs with the RFC 9421 test key → CF /v0/api/verify
npm run self-test -- --url https://crawltest.com/cdn-cgi/web-bot-auth
```

_Done when:_ the endpoint reports the signature verified. (Default uses the RFC 9421
test key the debug endpoint recognises — no directory needed yet.)

### Step 3 — Host the signed directory at `auditor.mywebaccess.co.uk`

Recommended: the included Cloudflare Worker (`cf-worker/`), which signs the directory
per request from your secret key.

```bash
cd cf-worker
npm i web-bot-auth@0.1.3
npx wrangler secret put WBA_PRIVATE_JWK     # paste the production private JWK (one line)
npx wrangler deploy
```

Then add the custom domain: dashboard → **Workers & Pages → this Worker → Settings →
Domains & Routes → Add → Custom Domain →** `auditor.mywebaccess.co.uk` (Cloudflare
provisions DNS + TLS). _Done when:_

```bash
curl -sSD - https://auditor.mywebaccess.co.uk/.well-known/http-message-signatures-directory | head -20
# → 200, content-type application/http-message-signatures-directory+json,
#   Signature + Signature-Input response headers, body {"keys":[…],"purpose":"…"}
```

(Alternatives to the Worker: run `serve-directory.mjs` on any always-on host behind the
subdomain, or serve a static directory re-signed on a schedule.) Then re-run the
self-test against the real key + host:

```bash
npm run self-test -- --key /secure/path/private.jwk \
  --directory https://auditor.mywebaccess.co.uk/.well-known/http-message-signatures-directory \
  --url https://crawltest.com/cdn-cgi/web-bot-auth
```

### Step 4 — Submit to Cloudflare

Dashboard → **Manage Account → Configurations → Bot Submission Form** → method
**"Request Signature"** → directory URL
`https://auditor.mywebaccess.co.uk/.well-known/http-message-signatures-directory`
(User-Agent values optional). Purpose text:

> Per-engagement automated accessibility auditor (WCAG-EM) for the MyWeb Access
> service. Signs only authorized client-audit traffic; respects robots.txt; local-only
> tooling, no AI. Identity is cryptographic (Web Bot Auth), not evasion.

_Done when:_ the submission is accepted/queued.

### Step 5 — Decisive go/no-go (R2) on MyVision `/event*`

On the MyVision zone you control (**Security → WAF → Custom rules**):

1. **Observe** — rule with action **Log**, expression:
   ```
   starts_with(http.request.uri.path, "/event") and cf.bot_management.verified_bot
   ```
   Send signed traffic (your scanner over the cleared identity, or
   `npm run self-test -- --key … --url https://<myvision-host>/event…`) and confirm it
   matches — i.e. `cf.bot_management.verified_bot` is true for it.
2. **Confirm the challenge clears** — if `/event*` still challenges, add a rule
   **Skip → Managed Challenge** (+ remaining custom rules) on the same expression, and
   confirm an `/event*` page audits with **no** challenge.

- **GATE:** verified **and** the challenge clears → **Phase 2 is justified** (build the
  `src/lib/web-bot-auth.mjs` signing seam; mirror E8).
- **KILL / fork:** if verified status does **not** clear an *explicit* path challenge
  (only Bot-Management identification), fall back to ADR-0021 layer 3 — reuse the same
  verified identity as a per-client allowlist credential (one durable rule). Not wasted.

## Cleanup

Everything regenerates. To reset:

```bash
rm -rf .keys out node_modules
```

`.keys/` (private keys), `out/` (artifacts), and `node_modules/` are gitignored by
this directory's own `.gitignore`; only source + `package.json` + `package-lock.json`
are tracked.
