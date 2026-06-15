# Execution plan — register the toolkit as a Web Bot Auth verified bot

## Header

- **Task:** make the MyWeb Access auditor a **Cloudflare-recognised verified bot**
  via **Web Bot Auth** (HTTP Message Signatures), so AUTHORIZED audits reach
  WAF-gated pages by _identity_ rather than by riding a human-cleared CDP session
  or per-client IP allowlists.
- **Implements:** [ADR-0021](../adr/0021-waf-challenge-access-strategy.md)
  (Decision 2 — "Web Bot Auth registration is the strategic, durable path"). This
  plan is the held "build for a plan + review pass" that ADR-0021 defers.
- **Repo:** `wcag-em-a11y-toolkit-v2-recommended` · Node 22 · ESM · JSDoc+`@ts-check`
  · Ajv config. Builds on the E8 transport seam ([ADR-0020](../adr/0020-pluggable-browser-transport.md)).
- **Status:** **Proposed — awaiting review cycle.** No code is written yet. Phases
  0–1 (ops/identity) can begin without toolkit changes; Phase 2 (the signing
  build) is the part that goes through the usual branch + PR + adversarial-review
  flow, Jamie merges.
- **Method:** authored 2026-06-15 after a sequential-thinking execution pass +
  research (Cloudflare, IETF draft, the `web-bot-auth` npm lib, the Stytch
  reference implementation). The signing profile is **confirmed** against
  Cloudflare's docs + the RFC 9421 profile (see _Signing profile — confirmed_);
  only two implementation choices remain open for Phase 2.

## Context

The 2026-06 MyVision dogfood ([validation review](../reviews/2026-06-myvision-cdp-validation.md))
showed the CDP bridge works but only because it rides a **trusted, human-cleared**
browser session — a fresh automated fetch still gets `403 cf-mitigated: challenge`.
The durable, honest, standards-based answer (ADR-0021) is to stop _evading_
detection and instead become a **named, cryptographically verifiable** auditor:
register a public key, sign every request, and let Cloudflare recognise us.
Verified bots "are considered authenticated [and] do not face challenges from Bot
Management", and the message-signature on-ramp has **no minimum-traffic threshold**
— removing the one eligibility bar a per-engagement auditor would otherwise fail.

## The keystone problem (drives the whole build)

The toolkit audits through a **real browser** (Playwright for `scan`/`scan-processes`;
Crawlee for `discover`), and an RFC 9421 signature is computed **per request**
(it covers specific request components plus `created`/`expires`/`nonce` and is
signed with the private key). Therefore a signature **cannot** be a static header
— it cannot ride the existing `auth.extraHTTPHeaders` (fixed strings). The build's
core is a **per-request signing hook** in the browser's request path. Everything
else (keys, directory, application) is comparatively routine. The plan is
sequenced so the routine, cheap parts are **decisive experiments** that de-risk
this hook before it is built.

## Decisions

**Resolved (this plan):**

1. **Identity by signature, fidelity by real UA.** We add Web Bot Auth signature
   headers while keeping a normal browser User-Agent, so the origin cannot serve
   a bot-variant rendering (ADR-0021 fidelity guardrail). Identity travels in the
   signature + `Signature-Agent`, not in a custom bot UA — confirmed viable: the
   submission form treats the User-Agent as **optional**.
2. **Opt-in, per-engagement signing.** Signing is enabled only via explicit
   config/identity profile for a site we are contracted to audit — never
   auto-enabled on arbitrary domains. Verification ≠ authorization.
3. **Default to respecting robots.txt**, with disallowed in-scope paths reached
   only when the client has authorized them — keeping us inside the Verified Bots
   "explicit consent of the zone owner" policy.
4. **Recommended signing mechanism: Playwright route-interception first**
   (`scan`/`scan-processes`), with a **signing forward-proxy documented as the
   Phase-2b upgrade** that additionally covers `discover` (Crawlee), which
   route-interception cannot reach.
5. **Isolate signing behind one module** (`src/lib/web-bot-auth.mjs`), optional
   dependency loaded on demand — mirroring how `patchright` is handled in E8 — so
   a spec/lib change is a one-file blast radius.
6. **Directory hosted on the MyWeb Access domain**, HTTPS, at the well-known path;
   it becomes the auditor's public identity (`Signature-Agent` points at it).

**Open (resolve during Phase 0–1):**

- Exact hosting URL/subdomain for the key directory.
- Key-rotation cadence and the overlap procedure.
- Whether to build the proxy (2b) at all, or defer until a client needs `discover`
  over a gated domain.

## Phases (each with a hard gate + an abandon/kill criterion)

### Phase 0 — Spike / feasibility (no toolkit changes; ~half a day)

Prove the crypto + directory + Cloudflare validation end-to-end with a throwaway
script before touching the toolkit.

1. Generate an Ed25519 keypair as a JWK (`kty:"OKP"`, `crv:"Ed25519"`, `kid`,
   `d`, `x`).
2. Host a signed JWKS at `/.well-known/http-message-signatures-directory` on a
   staging URL (the Stytch example's `generate-keys` / `serve-jwks` scripts are a
   working reference).
3. Sign a request with the `web-bot-auth` npm lib (`signerFromJWK` →
   `signatureHeaders(request, signer, { created, expires })`) — covering
   `@authority` + `signature-agent`, `tag="web-bot-auth"`, short `expires` — and
   hit Cloudflare's public test endpoint
   `http-message-signatures-example.research.cloudflare.com`.

**GATE:** Cloudflare's verifier accepts the signature.
**KILL:** if the crypto/directory cannot be made to validate with the maintained
library, stop — the approach is not viable for us.

### Phase 1 — Production identity + application (ops; no scanner code)

1. Finalise the hosting domain/subdomain; publish the **production** signed JWKS.
2. Generate + secure the **production** keypair (private key in the operator
   secret store; never in the repo or logs — reuse the existing
   `auth.storageState` gitignore/redaction guards as the pattern).
3. Submit Cloudflare's application: dashboard → **Manage Account →
   Configurations → Bot Submission Form** → method **"Request Signature"** →
   enter the key-directory URL (User-Agent values optional); describe the purpose
   truthfully (per-engagement accessibility auditor, authorized samples).

**GATE (the decisive experiment, R2):** approved, then **re-test MyVision
`/event*`** — a Cloudflare zone _we control_, so we can both verify ourselves and
observe the result. Write a WAF rule referencing **`cf.bot_management.verified_bot`**
and confirm our signed traffic is recognised AND that the `/event*` challenge
clears for it.
**KILL / fork:** if verified status does **not** clear an _explicit_ path
challenge (only Bot Management's bot-identification), the value narrows to
"bot-challenged sites"; fall back to ADR-0021 layer 3 — the directory identity is
reused as an allowlist credential (not wasted). Decide go/no-go on Phase 2 here.

### Phase 2 — Signing build (toolkit; branch + PR + adversarial review)

Only after Phase 1 proves value. Mirrors the E8 shape exactly.

- **2a (recommended first):** `src/lib/web-bot-auth.mjs` (sign a request; build the
  directory), loaded on demand like `browser-engine.mjs`. A signing hook installed
  in `openPageView`'s page setup via **Playwright route-interception**, signing
  document/navigation (and same-origin XHR) requests for `scan`/`scan-processes`.
  Config: a `scan.browser.webBotAuth` block (`enabled`, `keyId`, `directoryUrl`,
  key path) + an env override for the private-key path (mirroring the
  `WCAG_EM_CDP_ENDPOINT` precedent — a per-operator secret is uncommittable).
  Preflight coherence check (key readable, directory HTTPS) — fail fast (ADR-0005).
- **2b (documented upgrade, optional):** a local **signing forward-proxy** the
  browser routes through, which also covers `discover` (Crawlee) — the stage
  route-interception cannot reach (ADR-0020 already notes discover always crawls
  locally). Build only if a client needs `discover` over a gated domain.

**GATE:** a self-contained e2e (mirroring `test/e2e/scan-cdp.test.mjs`) where a
fixture serves content **only** to a validly-signed request; plus a **content-
parity diff** (signed vs unsigned render of a non-gated page — no bot-variant
drift); plus a live MyVision `/event*` re-run that audits the events **with no CDP
and no human-clearance step**. That live result is the proof registration
**supersedes** the CDP bridge.

### Phase 3 — Docs, disclosure sync, rollout SOP

- Toolkit docs: config-guide + user-manual `scan.browser.webBotAuth`; flip
  [ADR-0021](../adr/0021-waf-challenge-access-strategy.md) to **Accepted**;
  CHANGELOG entry.
- **Vault disclosure (candor update):** `Compliance/05` + `Public/.../05` —
  frame Web Bot Auth as a **strength** ("we identify our auditor cryptographically;
  we do not evade detection; still local, still no AI"). ADR-0021 already makes
  this update contingent on client-site use; Phase 1's result triggers it.
- **Per-engagement enablement SOP:** signing is switched on only for a contracted
  client site, with robots.txt scope confirmed — operationalising Decision 2/3.

## Codebase integration (grounded in existing seams)

| Surface                          | Change                                                                | Precedent                                                 |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/lib/web-bot-auth.mjs` (new) | sign request; build directory; load `web-bot-auth` on demand          | `src/lib/browser-engine.mjs` optional-dep loader          |
| `src/lib/browser.mjs`            | install signing hook in `openPageView` page setup when profile active | the E8 transport seam                                     |
| `schemas/config.schema.json`     | `scan.browser.webBotAuth` block (`additionalProperties:false`)        | `scan.browser` (E8)                                       |
| `src/lib/context.mjs`            | preflight coherence (key/dir)                                         | config-aware `requirePlaywright`                          |
| env                              | `WCAG_EM_WEBBOTAUTH_KEY` (private-key path)                           | `WCAG_EM_CDP_ENDPOINT`                                    |
| docs                             | config-guide + user-manual rows                                       | guarded by `docs-config-coverage` + `configs-valid` tests |

The whole build is stylistically isomorphic to E8 (optional dep + seam + config +
env override + preflight + drift-guarded docs + self-contained e2e), so effort is
estimable and the review pattern is known.

## Tests

- **Unit:** `signatureHeaders` produces the required headers + covered components;
  directory JWKS shape (incl. its own signature); key absent → actionable
  install/config hint; signing disabled by default (byte-identical default run).
- **e2e:** signature-gated fixture (content only for a valid signature), mirroring
  `scan-cdp.test.mjs`; the content-parity diff.
- **Live:** MyVision `/event*` audited via signing, no CDP, no human step.

## Risk register + kill-criteria

| #   | Risk                                                        | Mitigation                                                                  | Kill / fork                                                                   |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| R1  | Cloudflare won't verify a low-volume per-engagement auditor | Phases 0–1 cheap; identity reusable as an allowlist credential              | If rejected AND clients won't allowlist → registration dead; CDP bridge stays |
| R2  | Verified status doesn't clear an _explicit_ path challenge  | Decisive Phase-1 test on MyVision `/event*` (we own the zone)               | If it doesn't clear → client allowlist becomes primary                        |
| R3  | Browser sub-resource signing scope/perf; route() leakage    | Sign only document/navigation + same-origin XHR; measure; prefer proxy (2b) | —                                                                             |
| R4  | Announcing identity changes served content                  | Keep real UA; content-parity diff in Phase 2                                | If parity fails → audit-fidelity blocker, rethink                             |
| R5  | Private-key leakage                                         | Operator secret store; reuse gitignore/redaction guards; CI never sees it   | —                                                                             |
| R6  | Spec/lib churn ("not audited" lib; IETF draft)              | Pin the lib; isolate behind one module                                      | —                                                                             |

## Signing profile — confirmed (2026-06-15 research)

Confirmed against Cloudflare's Web Bot Auth docs + the RFC 9421 profile, so the
signer can be built to spec:

- **Directory:** JWKS at `/.well-known/http-message-signatures-directory`, served
  over HTTPS as `application/http-message-signatures-directory+json`, and itself
  signed with **`tag="http-message-signatures-directory"`** (proves key
  possession).
- **Request signatures:** cover **`@authority` + `signature-agent`**;
  `Signature-Input` params `keyid` (= the JWK thumbprint of the Ed25519 key),
  `created`, `expires`, optional `nonce`, and **`tag="web-bot-auth"`** — note this
  is a _different_ tag from the directory's. Keep `expires` short (Cloudflare
  suggests ~a minute) to bound replay.
- **`Signature-Agent` header** points at the directory URL (the public identity).
- **Library:** `web-bot-auth` npm — `signerFromJWK` + `signatureHeaders(request,
signer, { created, expires })`; reference impls: the Stytch example + Cloudflare
  repo.
- **Verification field:** confirm verified status via the WAF field
  **`cf.bot_management.verified_bot`** — the Phase-1 decisive-test rule.
- **User-Agent is optional** on the submission form → a custom bot UA is _not_
  required, which directly supports Decision 1 (keep a real-user UA; identity via
  signature).
- **Cross-vendor trajectory:** the same RFC 9421 profile is being adopted by
  **Google** (experimental) and **Akamai**, not just Cloudflare — which softens
  ADR-0021's "Cloudflare-specific" caveat over time.

Still genuinely open (implementation, not external spec — settle in Phase 2):

- Playwright `route()` per-request header-mutation viability at scale vs the
  signing proxy.
- Whether to use the lib's directory-signing helper or hand-roll the directory
  signature.

## References

- Cloudflare — _Message Signatures in Verified Bots_:
  <https://blog.cloudflare.com/verified-bots-with-cryptography/>
- Cloudflare docs — _Web Bot Auth_ bot verification:
  <https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth>
- `web-bot-auth` npm (`signerFromJWK`, `signatureHeaders`):
  <https://www.npmjs.com/package/web-bot-auth>
- Cloudflare reference impl + browser-extension example:
  <https://github.com/cloudflare/web-bot-auth>
- Stytch working example (`generate-keys` / `serve-jwks` / `sign-and-fetch`):
  <https://github.com/stytchauth/web-bot-auth-example> ·
  <https://stytch.com/blog/how-to-implement-web-bot-auth-signing/>
- IETF — _HTTP Message Signatures for automated traffic Architecture_:
  <https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/>
- Cloudflare test endpoint: `http-message-signatures-example.research.cloudflare.com`
- [ADR-0021](../adr/0021-waf-challenge-access-strategy.md) (decision this implements),
  [ADR-0020](../adr/0020-pluggable-browser-transport.md) (the seam it extends),
  [validation review](../reviews/2026-06-myvision-cdp-validation.md) (motivation).
