# 0013. Crawlee localhost-fixture hang investigation and resolution

- Status: accepted (resolution confirmed via 2026-05-09 commit-bisect)
- Date: 2026-05-09
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions; symbol-first citation rule),
  ADR-0008 (pluggable reporter runtime — the e2e fixture work that surfaced
  the hang during R9), ADR-0012 (extensibility-internal stance; relevant
  because the `discover-no-locator-invariant` source-text guard added in
  commit `df16649` is now load-bearing as the regression backstop)

## Context and Problem Statement

During R9 (Layer 4) development of the pluggable-reporter runtime, two e2e
tests were authored and immediately deferred behind a Crawlee-related hang:

- `test/e2e/reporters-smoke.test.mjs` — full-audit reporter pipeline smoke.
- `test/e2e/discover-timeout.test.mjs` — behavioural per-page-timeout drop
  assertion.

Symptom: `discover.run(ctx)` against the localhost fixture server consistently
exhausted `requestHandlerTimeoutSecs × maxRequestRetries` and never produced
inventory output, even though raw Playwright `page.goto` against the same
fixture loaded in `<250 ms`. The two tests shipped as `test.skip` placeholders
with empty bodies and a 60-line file-level investigation log preserving the
bisect history.

A v2 audit (separate session) refined the diagnosis: a hand-rolled standalone
`PlaywrightCrawler` with the EXACT `discover.mjs` handler logic copied
verbatim crawled all 5 fixture pages in 991 ms — proving the hang lived
somewhere in `discover.run`'s wrapping code, not in Crawlee itself, not in
the fixture, not in the handler. The closest upstream symptom match was
[apify/crawlee#2785](https://github.com/apify/crawlee/issues/2785) ("RequestHandler
Timed Out But Actually Browser Error"). Mitigations ruled out across both
sessions:

- `CRAWLEE_STORAGE_DIR` per-test isolation
- HTTP `Connection: close` server-side
- Scope strategy (`same-origin` vs `same-hostname`)
- Sitemap seeding disabled
- `useSessionPool: false`
- `browserPoolOptions.retireBrowserAfterPageCount: Infinity`
- `persistCookiesPerSession: false`

The thread sat unresolved for ~5 weeks. A 2026-05-03 update note in both
e2e test files claimed the D2 fix (`fix(discover): replace locator-based
metadata capture with one page.evaluate`, commit `468f5c1`) was un-skipped
briefly and "confirmed to remain dead" — but the test bodies were empty,
so re-running them passed trivially without exercising the actual hang.

## Decision

**The localhost-fixture hang was inadvertently fixed by D2 (commit `468f5c1`),
confirmed via 2026-05-09 commit-bisect.** The `reporters-smoke.test.mjs`
e2e test is un-skipped in the same release with a real spawn-based body
that exercises all 5 reporters end-to-end. The companion
`discover-timeout.test.mjs` remains skipped — empirical verification
(2026-05-09 + 2026-05-11) showed its original assertion premise ("`/slow`
dropped from inventory after `crawl.requestTimeoutSecs` exceeded") doesn't
match Crawlee's actual timeout layering: `crawl.requestTimeoutSecs` is
wired only into `requestHandlerTimeoutSecs`, leaving Crawlee's
`navigationTimeoutSecs` at its 60s default. A v1.1 follow-up
(`crawl.navigationTimeoutSecs` config) is the preferred un-skip path; see
the file-level comment in `test/e2e/discover-timeout.test.mjs` for the two
options.

### Bisect history (intellectual capital, single canonical home)

The investigation spanned three sessions:

**Session 1 (R9, Layer 4 development):** First observed; hand-rolled
mitigations ruled out (`CRAWLEE_STORAGE_DIR` isolation, `Connection: close`,
scope strategy, sitemap seeding). e2e tests deferred as `test.skip`.

**Session 2 (v2 audit, ~2026-04-XX):** Three additional Crawlee-config
mitigations ruled out (`useSessionPool`, `browserPoolOptions`,
`persistCookiesPerSession`). v2 bisect: standalone `PlaywrightCrawler` with
the discover handler copied verbatim crawls 5 fixture pages in 991 ms —
hang lives in `discover.run`'s wrapping code (not in Crawlee/handler/fixture).
Closest upstream match: `apify/crawlee#2785`. Two e2e files updated with the
refined diagnosis (commit `2d07869`).

**Session 3 (2026-05-09, P1 Phase 1 + Phase 2):**

- **Phase 1**: Built standalone `p1-repro.mjs` reproducer (untracked,
  repo root). 4 runs all COMPLETED in 600-1500ms with all 5 fixture pages
  crawled. Validated the v2 audit's "991 ms standalone" claim and confirmed
  the toolkit-bisect strategy.
- **Phase 2**: Built `p1-bisect.mjs` harness using the full toolkit path
  (`buildContext` + `discover.run(ctx)`) against the localhost fixture.
  Plan was a forward bisect across 6 candidate surfaces. **Surprise**:
  baseline at HEAD COMPLETED in ~1s on all 3 stability runs — bug not
  reproducing. Pivoted to a commit-bisect to identify the incidental fix:

  | Commit                                 | Status        | Elapsed                    |
  | -------------------------------------- | ------------- | -------------------------- |
  | `2d07869` (v2-audit-bisect anchor)     | **HUNG**      | 60001 ms (1 run)           |
  | `32f27cd` (D3 fix; **D2's parent**)    | **HUNG**      | 60002 / 60004 / 60005 ms   |
  | `468f5c1` (**D2 fix**)                 | **COMPLETED** | 1871 ms                    |
  | `df16649` (HEAD; P3 source-text guard) | **COMPLETED** | 976 / 990 / 1421 / 1537 ms |

  Boundary between `32f27cd` and `468f5c1`. D2 is the only commit between
  those that touches `src/commands/discover.mjs` (`32f27cd` is purely a
  `wcag-em-summary` change). **D2 is the fix.**

  Phase 2's working notes (uncommitted, kept alongside `p1-repro.mjs` and
  `p1-bisect.mjs`) record the runs in detail.

### Mechanism (working hypothesis — Phase 3 work)

Pre-D2: 6 sequential CDP round-trips per page (`page.title` + 5×
`page.locator(...).textContent/.getAttribute/.count`), each locator carrying
Playwright auto-wait setup keyed off `page.setDefaultTimeout(90s)`. Post-D2:
one `page.evaluate(captureDiscoveryMetadata, config.discovery)` call runs
all `document.querySelector*` lookups in-browser in a single tick — no
auto-wait, no per-call CDP message.

The localhost-fixture hang and the AU-dogfood missing-element hang were
two manifestations of the same root cause: locator-based capture, sensitive
to CDP traffic shape — not specifically to whether elements exist (the
fixture's pages have all elements; AU's `before.html` lacks them; both
hang). Framework-internals confirmation (Crawlee's session/queue management
under handlers issuing many serialised CDP awaits) is Phase 3 work for a
future session.

### Considered alternatives (rejected)

1. **Defer indefinitely** — empty `test.skip` placeholders broadcast an
   unsolved bug; closing the thread is high-ROI credibility work for v1.0.
2. **Fold into ADR-0008** — pluggable reporters is a distinct architectural
   concern; the Crawlee investigation deserves its own MADR record.

## Consequences

### Positive

- `reporters-smoke.test.mjs` un-skipped with a real spawn-based body —
  closes the larger half of Layer 4's deferred work. `discover-timeout.test.mjs`
  remains skipped pending a separate v1.1 config addition (see Decision).
- The bisect intellectual capital from R9 / v2 audit / 2026-05-09 is preserved
  in this single canonical home, not scattered across CHANGELOG and e2e
  file-level comments.
- v1.0 release narrative gains a concrete win: a real-world dogfood (AU)
  drove a root-cause fix that incidentally also closed a long-deferred mystery
  hang.
- The `discover-no-locator-invariant` source-text guard (`test/unit/discover-no-locator-invariant.test.mjs`,
  added by P3 / commit `df16649`) is now actively load-bearing as the
  regression backstop. Removing or weakening that guard in any future
  refactor would re-expose both hangs.

### Negative / trade-offs

- The mechanism (CDP message-queue interaction with Crawlee's session/queue
  management) is hypothesised but not yet confirmed at the framework-internals
  level. Phase 3 work for a future session.
- The Crawlee-version pin (`^3.16.0` in `package.json`) is now load-bearing
  for the assertion that the hang stays fixed. A future Crawlee bump should
  re-run `p1-bisect.mjs` (kept alongside `p1-repro.mjs`, both untracked at
  repo root) to confirm the fix still holds against the new version.

### Symbol references

- `captureDiscoveryMetadata` (`src/commands/discover.mjs`) — the
  `page.evaluate` helper introduced by D2 that fixed both hangs.
- `requestHandler` (`src/commands/discover.mjs`) — INVARIANT comment block
  forbids `.locator(...)` calls; enforced by the source-text test below.
- `discover-no-locator-invariant` (`test/unit/discover-no-locator-invariant.test.mjs`) —
  source-text regression guard for the locator-prevention invariant.
- `computeExitCode` (`src/commands/summarize.mjs`) — applies
  `failOnFindings.threshold` and `failOnFindings.impacts`; relevant to the
  un-skipped smoke test's exit-code assertion.
- D2 commit `468f5c1` (`fix(discover): replace locator-based metadata
capture with one page.evaluate`) — the resolution.
- Phase 1 reproducer `p1-repro.mjs` (untracked) — standalone Crawlee+Playwright
  baseline for future Crawlee-version-bump regression checks.
- Phase 2 harness `p1-bisect.mjs` (untracked) — toolkit-path harness for
  the same-purpose regression checks.
