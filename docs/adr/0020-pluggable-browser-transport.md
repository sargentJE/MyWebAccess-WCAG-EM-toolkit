# ADR-0020 — Pluggable browser transport (CDP attach + stealth engine)

## Status

Accepted. Complements [ADR-0017](./0017-page-outcome-could-not-audit.md) (the
page-outcome disclosure E8 lets you act on) and extends
[ADR-0006](./0006-multi-viewport-axe-runs.md) (the multi-viewport per-page-view
contract the transport must preserve).

## Context

Authorized audits increasingly target sites that sit behind a Cloudflare
**Managed Challenge**. E1 ([ADR-0017](./0017-page-outcome-could-not-audit.md))
already detects and DISCLOSES such pages — they surface with
`pageOutcome: challenge` rather than being silently scored as clean — but
detection is not the same as audit: a disclosed challenge page still cannot be
inspected by axe. A live smoke test confirmed the challenge does **not**
auto-solve for headless Playwright, so the disclosure was, in practice, a dead
end for these targets.

The documented robust paths out of this are domain-side and require a token the
challenged party must hand us:

- a WAF bypass header supplied through E1's `auth.extraHTTPHeaders`, or
- a `cf_clearance` cookie supplied through E1's `auth.storageState`.

Both are correct and durable, but both depend on someone with control of the
edge (an allowlist) or a captured clearance artefact. The practical, hands-on
path that needs nothing from the domain is: let a human clear the challenge once
in a real, visible browser, and have the scanner RIDE **that exact session** by
attaching to the same browser over the Chrome DevTools Protocol (CDP). The
challenge is solved by a person; the scanner only inherits the result.

## Decision

1. **Introduce a transport seam — `src/lib/browser.mjs`.** A single module owns
   the answer to "how does the scanner obtain a browser, scope each page-view,
   and tear it down". Both `scan.mjs` (Stage 3) and `scan-processes.mjs`
   (Stage 4) consume the same explicit acquire/release API rather than
   duplicating launch/teardown inline: `acquireBrowserSession`,
   `openPageView` (returning `{ page, release }`), and `disposeBrowserSession`,
   plus two pure, browser-free helpers — `resolveTransport(config, env)` and
   `browserNeedsLocalBinary(config, env)` — that are unit-testable without a
   browser. The seam is an acquire/release pair, not a callback, so each command
   keeps its own failure semantics (`scan.mjs` acquires outside its per-attempt
   try → allocation failure is fatal; `scan-processes.mjs` acquires inside its
   try → allocation failure becomes an `{ error }` result).

2. **Two transports.** `resolveTransport` returns one of:
   - **`launch`** (default) — `chromium.launch({ headless })`, a fresh
     `newContext({ viewport, ...auth })` per page-view, `context.close()` on
     release, and a real `browser.close()` at dispose. This is **byte-identical
     to the pre-E8 inline code**: the default audit is unchanged.
   - **`cdp`** (opt-in) — `chromium.connectOverCDP(endpoint)` attaches to an
     already-running, human-cleared browser.

3. **The keystone: CDP reuses the human-cleared context, never a fresh one.**
   In CDP mode `openPageView` REUSES `browser.contexts()[0]` — the default
   context the human cleared the challenge in — and sets the viewport per page
   via `page.setViewportSize`. This is the load-bearing decision: a fresh
   `newContext()` would be an isolated incognito context **without** the cleared
   session's `cf_clearance` cookie, which would re-trigger the challenge and
   defeat the entire feature. On release, CDP closes **only the PAGE**, leaving
   the shared cleared context intact for the next page-view. At dispose,
   `disposeBrowserSession` **DISCONNECTS** the CDP client (a guarded
   `browser.close()` on a `connectOverCDP` browser detaches the client) and
   **never closes** the external browser the toolkit did not launch. (If the
   attached browser happens to have no existing context, `acquireBrowserSession`
   warns and falls back to a fresh context — which will not inherit any cleared
   session.)

4. **Pluggable engine — `src/lib/browser-engine.mjs`.** `loadBrowserEngine`
   selects a Playwright-API-compatible automation engine. `playwright` is the
   static, bundled default. `patchright` — a stealth-patched, API-compatible
   drop-in (same `chromium.launch` / `connectOverCDP` surface) — is an
   **OPTIONAL** dependency, loaded only when `scan.browser.engine ===
'patchright'` via a dynamic `import()` (mirroring the late-binding stage
   loader in `src/index.mjs`), with an actionable install hint when it is
   absent. A normal install of the toolkit never requires it.

5. **Config surface + the first env override.** `scan.browser.{engine,
cdpEndpoint, channel, headless}` configures the transport, with a
   `WCAG_EM_CDP_ENDPOINT` environment variable that **overrides**
   `scan.browser.cdpEndpoint` (env > config). A per-session CDP endpoint should
   not have to be committed to a config file; this is the toolkit's first
   env-based config override, so it is called out deliberately.

6. **Preflight knows when a local binary is not needed.** A config-aware
   `requirePlaywright` in `src/lib/context.mjs` suppresses preflight's
   local-Chromium cache check when the browser is external (CDP) or
   self-managed (`patchright`). The decision is driven by the pure
   `browserNeedsLocalBinary`, which is true only for `launch` + `playwright`.

## Consequences

- **Default behaviour is unchanged.** With no `scan.browser` config and no
  `WCAG_EM_CDP_ENDPOINT`, the transport is `launch` + `playwright` and the
  per-page-view newContext/close lifecycle is byte-identical to pre-E8. The
  [ADR-0006](./0006-multi-viewport-axe-runs.md) per-viewport isolation is
  preserved exactly.
- **CDP page-views are intentionally NOT context-isolated.** All page-views in a
  CDP run share the one human-cleared context (that is the whole point — they
  must share its `cf_clearance`). This is a deliberate departure from launch
  isolation, and it applies only to the opt-in CDP path.
- **`auth.*` is ignored under CDP** — the attached browser owns the session
  (cookies, storage, credentials), so applying `auth` context options would be
  meaningless or actively wrong. `resolveTransport` surfaces this as a warning
  (alongside warnings for ignored `channel` / `headless` under CDP, and for an
  env-vs-config endpoint mismatch), returned on the session for the caller to
  log once.
- **CDP attach covers `scan` + `scan-processes` only.** `discover` always crawls
  with a locally-launched browser (Crawlee), so on a protected domain it is
  challenged and still requires a local Chromium even when `cdpEndpoint` is set.
  Accordingly `discover` and `audit` are NOT transport-aware — they keep the
  local-binary preflight check — while standalone `scan` / `scan-processes` skip
  it under CDP/patchright. For challenged-domain audits, seed the challenged URLs
  via `sample.structuredManual` so `scan` reaches them over the cleared session.
- **A new OPTIONAL dependency (`patchright`).** Installs that never set
  `scan.browser.engine = 'patchright'` are unaffected; the package is only
  resolved on demand, and its absence yields an install hint rather than a hard
  failure.
- **`cf_clearance` is session-bound and time-limited.** The clearance cookie is
  bound to the client IP + User-Agent + TLS fingerprint and lives only ~30–60
  minutes. A long crawl must therefore keep the **same** attached browser alive
  for its whole duration; restarting or rotating the browser mid-crawl discards
  the cleared session and re-triggers the challenge.

## Non-goals

These are explicit, to forestall misreading the feature as a bypass:

- **CDP does not pass a _fresh_ challenge headlessly, and solves no
  CAPTCHA/Turnstile.** It rides a session a **human** already cleared.
  `headless: false` on the launch path merely lets a Managed Challenge
  auto-solve in a visible window where a person can interact; it is not a
  programmatic solver.
- **`patchright`/stealth reduces fingerprint detection — it is not a guaranteed
  bypass**, and it is never a substitute for authorization. It lowers the odds
  of being flagged as a bot; it does not grant a right to scan.
- **The durable, vendor-blessed fix is domain-side.** A WAF allowlist for the
  audit's egress, or Cloudflare Web Bot Auth (a signed agent identity) — both
  delivered through E1's `auth.extraHTTPHeaders` — are the supported long-term
  paths. CDP attach is the pragmatic stopgap for an authorized auditor who
  cannot yet get an edge change made.

## References

- `src/lib/browser.mjs` — `acquireBrowserSession`, `openPageView`
  (`{ page, release }`), `disposeBrowserSession`; pure `resolveTransport` and
  `browserNeedsLocalBinary`; the `browser.contexts()[0]` reuse +
  `page.setViewportSize` keystone; CDP disconnect-not-close at dispose.
- `src/lib/browser-engine.mjs` — `loadBrowserEngine` (`playwright` static
  default; optional `patchright` via dynamic `import()` with install hint).
- `src/lib/context.mjs` — config-aware `requirePlaywright` preflight suppression
  for external (CDP) / self-managed (`patchright`) browsers.
- Config: `scan.browser.{engine, cdpEndpoint, channel, headless}`; env override
  `WCAG_EM_CDP_ENDPOINT` (env > config).
- [ADR-0017](./0017-page-outcome-could-not-audit.md) — `pageOutcome: challenge`
  disclosure that E8 complements (disclose → then attach-and-audit).
- [ADR-0006](./0006-multi-viewport-axe-runs.md) — the multi-viewport per-view
  contract preserved on launch and reproduced via `setViewportSize` on CDP.
