# ADR-0021 — Access strategy for WAF-challenged pages (register, don't bypass)

## Status

**Proposed** (2026-06-15). This ADR records a _direction_, not shipped code: the
implementation (Web Bot Auth signing; an interactive-clearance mode) is
deliberately **held for a separate plan + review pass**. The Web Bot Auth
registration build (Decision 2) is now planned in detail —
[docs/plans/2026-06-web-bot-auth-registration.md](../plans/2026-06-web-bot-auth-registration.md)
(phased, with abandon/kill gates; ops Phases 0–1 can start without code). What is already shipped
and accepted — disclose-by-default ([ADR-0017](./0017-page-outcome-could-not-audit.md))
and the opt-in CDP transport ([ADR-0020](./0020-pluggable-browser-transport.md)) —
this ADR extends and re-frames. It promotes the "durable fix is domain-side"
non-goal note in ADR-0020 into a first-class, ranked decision, and explicitly
**rejects** automatic stealth bypass as a core feature.

## Context

Authorized audits — and, for the MyWeb Access service, _client_ audits — keep
landing on sites behind a Cloudflare (or other WAF) **Managed Challenge**. The
toolkit already does the honest thing: E1 detects the challenge and DISCLOSES it
(`pageOutcome: challenge`) rather than scoring challenge markup as a clean pass.
E8 then added a pragmatic CDP bridge: a human clears the challenge once in a real
browser and the scanner attaches over CDP to ride that session.

The 2026-06 live MyVision dogfood ([validation review](../reviews/2026-06-myvision-cdp-validation.md))
showed the CDP bridge works end-to-end — all 33 sampled pages, including the
force-included `/event*` pages, were audited with zero challenges. But the
dogfood also clarified _why_ it worked: the scanner rode a **human-cleared,
already-trusted** browser session. A Claude-in-Chrome verification the same day
loaded an `/event*` page in an everyday Chrome with **no challenge at all** — the
same URL that returns `403 cf-mitigated: challenge` to `curl`. Cloudflare was not
defeated; it simply did not challenge a browser + IP it already trusts.

That reframes the question from "how do we get past the challenge" to "how does
an accountable auditor become **trusted**, durably and seamlessly, across many
client engagements?" — without an arms race and without contradicting the
service's candid, no-AI [automated-tooling disclosure](../../README.md).

A material landscape shift makes this newly tractable. The **W3C Web Bot Auth**
specification was finalised **May 2026**, and Cloudflare's **June 2026** Bot
Management update folded HTTP Message Signatures into its **Verified Bots
Program**. Verified bots "are considered authenticated [and] do not face
challenges from Bot Management"; the message-signature on-ramp states **no
minimum-traffic threshold** (the old IP/UA verified-bot path required >1,000
requests/day across many domains — a bar a per-client auditor would never clear).
A signer hosts a key directory, signs each request, and registers the directory
URL. See **References**.

## Decision drivers

- **Determinism** — a managed challenge is, by definition, not deterministically
  auto-solvable; only _identity_ (allowlist / signed verification) or a
  _human-in-the-loop_ yields a repeatable outcome.
- **Honesty & positioning** — the service is sold on candour and "no AI / no
  evasion". The access method must be disclosable as a _strength_.
- **Durability** — survive auditor IP churn, VPNs, CI runners, multiple machines.
- **Audit fidelity** — we must audit the rendering a disabled _user_ sees, not a
  bot-variant rendering.
- **Authorization boundary** — getting _past a challenge_ must never be confused
  with _being authorized_ to audit.
- **Multi-WAF reality** — clients sit behind Cloudflare, Akamai, Imperva,
  DataDome, AWS WAF; no single mechanism covers all.
- **Cost** — implementation, operational hosting, and approval effort are real.

## Considered options

1. **Disclose only (status quo, [ADR-0017](./0017-page-outcome-could-not-audit.md)).**
   Honest, zero-cost, but coverage is simply incomplete for challenged paths.

2. **Domain-side allowlist (IP or secret header via `auth.extraHTTPHeaders`).**
   Deterministic and supported, but per-client and brittle: auditor IPs change,
   headers must be provisioned per engagement, and nothing carries between clients.

3. **Web Bot Auth registration (cryptographic verified-bot identity).** One
   accountable identity for the service; identity-based, not IP-based; honest by
   construction (it _announces_ who we are — the opposite of stealth); the
   emerging standard. Cost: implement HTTP Message Signatures, manage a keypair,
   host `/.well-known/http-message-signatures-directory` on the MyWeb Access
   domain, and pass Cloudflare's approval. Limits: Cloudflare-specific (other
   WAFs unaffected); the site owner can still challenge verified bots via explicit
   custom rules; it grants _access_, never _authorization_.

4. **Interactive CDP clearance (extend [ADR-0020](./0020-pluggable-browser-transport.md)).**
   Fold `run-cdp-audit.sh` into the toolkit as an opt-in mode: on challenge
   detection during `scan`/`scan-processes`, launch a headed browser, pause for a
   human to clear it once, then proceed riding that session. Deterministic
   (a human can always clear it) and honest, but per-session (`cf_clearance`
   ~30–60 min) and bounded to the scan stages (`discover` crawls locally).

5. **Automatic stealth bypass (patchright auto-solve, no human). REJECTED.**
   Not deterministic (depends on Cloudflare's _current_ heuristics), an active
   arms race (breaks on every update), and it directly contradicts the no-AI /
   no-evasion disclosure. Identifying-by-evasion is the wrong posture for an
   accountable accessibility auditor.

## Decision

Adopt a **layered access strategy**, ranked, with registration as the durable
default and bypass explicitly off the table:

1. **Disclose by default — unchanged.** Absent any access mechanism, a challenged
   page stays `pageOutcome: challenge`: excluded from findings, surfaced in scan
   health and the manual backlog. The toolkit never fabricates coverage. This is
   the floor under every other layer.

2. **Web Bot Auth registration is the strategic, durable path** for the service.
   Register one accountable auditor identity (signed HTTP requests + a hosted key
   directory on the MyWeb Access domain) so the Cloudflare-fronted majority of
   client sites recognise the auditor and do not challenge it — by identity, not
   IP. This is the best-practice answer and is **disclosable as a strength**.

3. **Client allowlist where Web Bot Auth does not reach** — non-Cloudflare WAFs,
   or clients who explicitly challenge a path. Prefer "allow our verified
   identity" (one durable toggle) over IP allowlisting; fall back to a secret
   header via `auth.extraHTTPHeaders`. Make "allow the auditor" a normal step of
   audit onboarding.

4. **Interactive CDP clearance is the opt-in tactical bridge** — for one-off
   authorized audits before registration/allowlisting is in place, or
   self-controlled sites (e.g. MyVision). Trigger may be automatic-on-detection,
   but the _capability_ stays consciously opt-in per audit.

5. **No automatic stealth bypass as a core feature.** `patchright` remains an
   optional, manually-selected, clearly-flagged last resort — never a default,
   never auto-engaged. The toolkit does not ship a CAPTCHA/Turnstile solver.

## Consequences

- **Positive.** The durable path is the _honest_ path: cryptographic
  self-identification aligns with the candid, no-AI positioning and can be stated
  in the disclosure as a differentiator. Identity-based access survives IP churn
  and works from any auditor machine or CI runner. Building on a finalised W3C /
  IETF standard avoids a bespoke, brittle bypass.
- **Cost / negative.** Web Bot Auth is real work: HTTP Message Signatures in the
  request path, key generation + rotation, a hosted, always-on key directory, and
  a Cloudflare approval application. It is Cloudflare-specific, so the multi-WAF
  per-engagement access question never fully disappears. Site owners retain final
  control via explicit rules.
- **Audit-fidelity guardrail.** Signing must _add_ Signature headers while keeping
  a real-user User-Agent and rendering path, so the origin cannot serve a
  bot-variant page. A run that audits a bot-only rendering is invalid; the plan
  pass must verify parity.
- **Authorization is unchanged.** None of layers 2–4 grants a right to scan;
  contractual authorization is still required and is a separate gate.
- **Documentation follows.** If layers 2–4 are used on _client_ sites, the
  automated-tooling disclosure (vault `Compliance/05`) should be updated for
  candour (visible-browser attach / signed identity; still local; still no AI).
  If they stay internal/dogfood-only, the disclosure is unchanged.

## Non-goals

- **Not a challenge solver.** No layer here programmatically passes a _fresh_
  challenge or solves a CAPTCHA. Layer 4 rides a session a **human** cleared;
  layer 2 is recognised because it is _registered_, not because it defeats a test.
- **Not a multi-WAF abstraction (yet).** This ADR commits to Cloudflare Web Bot
  Auth. Akamai/Imperva/DataDome equivalents are out of scope until a client need
  is concrete.
- **Not an authorization mechanism.** Access ≠ permission. Restated because it is
  the easiest thing to conflate.

## Open questions (for the plan + review pass)

- Key-directory hosting: which domain/endpoint, and how is rotation operated?
- robots.txt etiquette vs. audit completeness — Verified Bots policy expects
  robots.txt respect; an accessibility audit may need disallowed paths. Reconcile
  (e.g. authorized-audit exception documented with the client).
- UA / rendering-parity verification method (the fidelity guardrail above).
- Whether interactive CDP clearance (layer 4) is worth building once registration
  exists, or whether `run-cdp-audit.sh` + allowlist suffice.
- Scope of disclosure update, contingent on whether client-site use is adopted.

## References

- Cloudflare, _Message Signatures are now part of our Verified Bots Program_ —
  <https://blog.cloudflare.com/verified-bots-with-cryptography/> (key directory at
  `/.well-known/http-message-signatures-directory`; sign requests; register the URL
  via the Verified Bots form; message-signature applicants prioritised; no stated
  traffic minimum).
- Cloudflare, _The age of agents: cryptographically recognizing agent traffic_ —
  <https://blog.cloudflare.com/signed-agents/>.
- Cloudflare docs, _Verified bots_ (policy: consent, benign purpose, crawl
  etiquette; the >1,000 req/day minimum applies to the IP/UA path) —
  <https://developers.cloudflare.com/bots/concepts/bot/verified-bots/>.
- IETF, _HTTP Message Signatures for automated traffic Architecture_
  (draft-meunier-web-bot-auth-architecture) —
  <https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/>.
- [ADR-0017](./0017-page-outcome-could-not-audit.md) — disclose-by-default
  (`pageOutcome: challenge`), the floor this strategy sits on.
- [ADR-0020](./0020-pluggable-browser-transport.md) — the CDP transport this
  re-frames; its "durable fix is domain-side" non-goal is promoted to Decision 2–3
  here.
- [Live validation review](../reviews/2026-06-myvision-cdp-validation.md) — the
  dogfood evidence that the bridge rides a _trusted_ session, motivating this ADR.
