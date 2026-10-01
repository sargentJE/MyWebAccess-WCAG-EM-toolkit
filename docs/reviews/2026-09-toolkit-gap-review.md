# Toolkit gap review — 2026-09-30

Adversarially verified gap review of wcag-em-a11y-toolkit at commit `306d38d` (v1.1.0 plus the
`[Unreleased]` E1-E8 work) across eleven lenses: code quality, accuracy of reported findings,
accuracy of coverage and verdict claims, WCAG-EM methodology fidelity, robustness and failure
visibility, security and secrets, downstream contracts, product capability, documentation
truthfulness, testing/CI/release, and performance/scale.

**Gate at start:** green — lint, typecheck, prettier, 517 unit, 8 e2e.

**Method.** Round 1: nine source-dimension finders (discover, sample, scan, security/transport,
processes, verdict engine/methodology, human reporters, machine exporters/contracts, capability
gaps), which also ran ~145 probes against local fixture servers. Round 2: four merged finders
(tests/CI including a 19-mutant spot-check; operator surface — CLI, config, packaging and docs
truthfulness; an empirical end-to-end accuracy differential against raw axe with all 7 reporters;
empirical hostile inputs, pipeline integrity and scale). Triage folded 26 cross-dimension
duplicates and grouped the rest into 25 root-cause packets. Each packet went to one refute-first
verifier who re-read the code and reproduced high/critical claims locally. The two
critical-flagged findings (SEC-01, CAP-01) got an independent second opinion. Strengths were
deduplicated and checked with the same bar. Non-mutating throughout: every probe ran from scratch
directories against localhost only.

**Numbers.** 225 findings raised (184 round 1 + 41 round 2), leaving 199 verdicts after
triage-level dedup: 125 confirmed, 65 partially confirmed (claim or severity corrected),
6 duplicate, 1 refuted, 2 intended. The 190 upheld findings by corrected severity: **1 critical,
21 high, 82 medium, 83 low, 3 info**. All 22 upheld high/critical findings were reproduced
locally by their verifier. 117 of the 190 carry `[probe]`. Verifiers lowered the severity of 21
upheld findings and raised none. CAP-01 was downgraded critical→high by both of its verifiers
(operator signals exist) and is the same defect as VERD-01. SEC-01 stayed critical after two
independent reproductions.

**Evidence tiers.** `[probe]` = the verifier reproduced it locally. `[source]` = verified by code
trace. Several `[source]` rows were also observed in round-1 probes (Appendix C); the tier
records verifier reproduction only.

**Probe records.** The reproductions behind the `[probe]` rows are recorded verbatim (paths
sanitised) in [`2026-09-probes/`](2026-09-probes/README.md), one file per verifying agent.
The remediation programme turns them into committed regression fixtures.

**Status vocabulary.** `new`; `tracked-open` (on the board, this review adds information);
`tracked-stale` (TODO.md, CHANGELOG or an ADR records it as done or closed, but the defect
stands); `known-low`; `intended`. `(corrected)` in a claim cell marks a partially confirmed
finding. The cell holds the verifier's corrected claim. Severity cells show `(was X)` where the
verifier changed the finder's severity.

**Path shorthand.** `src/` basenames are unique and used bare (`scan.mjs:228`). `ADR-NNNN:L` =
`docs/adr/NNNN-*.md`. `portal:` = `<portal-repo>/backend/src/`.
`rb:` = `<report-builder-repo>/`. `crawlee/` = `node_modules/@crawlee/`.
T-A…T-R are this review's shorthand for TODO.md items (mapped in §5).

---

## 1. Verdict summary

| Lens                                    | Grade                | Headline                                                                                                                                                                                                      |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality / engineering              | Good                 | Pure verdict core, XSS-safe HTML, deterministic outputs. The page-audit logic exists twice (scan vs process-runner), and the config schema accepts more than the runtime reads (A04, A14).                    |
| Accuracy of reported findings           | Strong               | Per-page results matched raw axe on 20/20 page-views (rule ids, node counts, impacts, incompletes). Every false finding traced to auditing the wrong document or state, not to a rule error.                  |
| Accuracy of coverage and verdict claims | Weak                 | A dead auth session, a tag typo or a fully WAF-blocked sample each reads as complete, clean or 100%. Single axe rules become SC-level `passed`/`inapplicable` (A05, A08, A01).                                |
| WCAG-EM methodology fidelity            | Weak                 | Scope ignores `wcagVersion` and level. Step 3 auto-suggest takes one cluster per type. The Step 4.c comparison looks only at violations. The Step 5 record misstates the sampling method (A02, A09, A13).     |
| Robustness / failure visibility         | Mixed                | E1's challenge/empty disclosure holds for page scans. But a browser crash loses all results, the CLI can hang or never exit, and crawl-loss telemetry never reaches a report (A08, B03, A12).                 |
| Security and secrets                    | At risk              | A failed `fill` writes its value (e.g. a password) into five reports. The WAF header and Basic credentials go to every origin. discover opens an unauthenticated proxy on all interfaces (A07, STRESS-02).    |
| Downstream contracts                    | Broken / diverging   | report-builder rejects every draft, while the write-time gate passes. The portal scores a zero-audit run 100 and never reads `scoreBasis` or `executionHealth` (A10, REPB-02).                                |
| Product capability                      | Good core, open loop | Where a capability is missing, output stays honest (`notTested`). Cheap signals go uncollected: 320px overflow, keyboard traps, PDF tagging, statement inputs (A18).                                          |
| Documentation truthfulness              | Weak                 | Links resolve and defaults match. But 23 upheld docs-drift findings remain, including a failing install path, a public robots.txt claim and "notTested is the complete checklist" (B05, SEC-10, VERD-02).     |
| Testing / CI / release                  | Weak on behaviour    | The gate is green, but 3 non-equivalent mutants survive and risky branches never execute. There is no real-browser process e2e or two-viewport e2e. Main still stamps itself 1.1.0 (B04, TEST-06).            |
| Performance / scale                     | Adequate for samples | A 414-page discover ran in 89 s and summarize in under 1 s. The scan is strictly sequential, with no per-view deadline, run budget or checkpoint; a 20k-element page costs ~43 s (SCAN-21, SCAN-02, SCAN-03). |

**The single most important takeaway.** What the toolkit reports is still accurate. The round-2
differential matched raw `@axe-core/playwright` on all 20 page-views, cross-artefact counts
agreed, and the prior QA verdict stands. Every false finding in this review came from auditing
the wrong document or state: RSS/JSON inventory entries, a challenge reached by click, excluded
widgets audited inside process states, a header search submitted instead of the target form.
None came from rule-level error. The risk sits in what the toolkit **claims around** those
findings, concentrated in five places:

- **(a) SC-level verdict semantics.** Single axe rules become SC `passed`/`inapplicable`, and
  the SC set ignores the declared WCAG version and level (A01, A02).
- **(b) Silent-success paths**, where nothing was audited, or the wrong thing was, yet the run
  reads complete (A05, A08, A03, A04, B02). Examples: a dead auth session (SEC-01, the one
  critical), an HTTP-error, off-scope or non-HTML landing, a tag typo, a WAF-blocked sample
  scored 100, a failed or mis-targeted process journey, a stale artefact merge.
- **(c) discover trusting Crawlee defaults** for scope, redirects, status, truncation, auth,
  storage and its local proxy (A06, STRESS-01/02/03).
- **(d) Secrets handling.** There is no notion of a sensitive value at egress or at
  persistence (A07).
- **(e) Contract and doc drift** (A10, B05, 23 docs-drift findings).

The process path deserves naming inside (b): three of the ten high packets (A03, A04 and part of
A07) are the process runner. One enabling cause sits under all five: the gate measures
execution, not behaviour (B04), so each of these shipped with CI green.

---

## 2. Strengths (held to the same evidence bar)

Only strengths the verifiers upheld (`holds`) or upheld with corrected wording (`overstated`,
marked _corrected_). The limit column names the finding that bounds each one.

**Accuracy and the verdict engine**

| Strength                                                                                                                     | Evidence                                                                                                 | Limit                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Per-page fidelity to raw axe (iframes, shadow DOM, narrow viewport)                                                          | diff1.py over 20 page-views: rule ids, node counts, impacts, incompletes identical                       | Targets compared after lossy flattening (SCAN-16)                   |
| _Corrected:_ no false positives on the round-1 hostile fixtures                                                              | run3's three rules all true; run1 reported nothing unsubstantiated                                       | False findings where the wrong thing was audited (DISC-03, PROC-01) |
| Cross-origin iframe and open shadow DOM content is audited                                                                   | p1/xframe, hostile/xorigin `['iframe','button']` targets; shadowmix/open-shadow violations found         | Still-loading iframes skipped (SCAN-11)                             |
| Cross-artefact numeric consistency (json/md/html/JUnit/EARL/portal/draft)                                                    | E2E: all 12 rules matched grouped sums; JUnit 22 = EARL 22; draft text matches summary.json              | T-B divergence; REPB-06 pointers                                    |
| Deterministic report and export output for identical inputs                                                                  | Two full audits and repeated summarize byte-identical after masking timestamps; `_sort.mjs` sortFindings | Truncated concurrent crawls (DISC-13)                               |
| Conservative SC decision ordering (failed > cantTell > passed > inapplicable)                                                | wcag-em-summary.mjs:510-519 decideOutcome; ordering mutants killed                                       | Ordering only; inputs are single rules (CAP-01)                     |
| Pure, unit-testable verdict core                                                                                             | toWcagEmSummary and groupFindings are pure; 62 in-scope tests green                                      | —                                                                   |
| SC name/level maps cover all 87 WCAG 2.2 (+4.1.1) SCs and every axe-tagged SC                                                | SC_LEVEL_MAP 87 keys (wcag-em-summary.mjs:54); wcag-sc-names.test.mjs locks the key sets                 | Scoping ignores version/level (VERD-03/05)                          |
| _Corrected:_ every SC in the map that no rule touched is padded `notTested`, and examples are split by outcome               | wcag-em-summary.test.mjs:284-360 (D3 regression tests)                                                   | 4.1.1 in 2.2 runs; AAA 2.1.3 in AA runs (VERD-04/05)                |
| Experimental and deprecated axe rules do not leak into default verdicts                                                      | run1: 1.3.4 and 2.5.3 notTested; wcag411 rules did not run                                               | Undocumented (SCAN-17)                                              |
| Best-practice findings stay out of SC verdicts and the portal score                                                          | bp.html rules `best-practice-or-manual-review`, `countsTowardCompliance:false`                           | JUnit/draft disagree (E2E-05); mixed list (REPA-17)                 |
| Bounded needs-review evidence with the true nodesCount                                                                       | axe-artifact.mjs:72-109                                                                                  | Violations unbounded (SCAN-14)                                      |
| Report-builder draft is conservative (violations only in recommendations, all findings `needsManualReview`, notTested named) | report-builder-starter.mjs:410-430; appendix lists the 36 notTested SCs                                  | Consumer rejects the draft (REPB-01)                                |
| Portal averageScore counts only adjudicated SCs and ships scoreBasis                                                         | portal-export.mjs:121-131, :166-178; rounding and inapplicable mutants killed                            | Portal ignores scoreBasis (REPB-11); zero-audit = 100 (REPB-02)     |

**Failure handling and disclosure**

| Strength                                                                                                                    | Evidence                                                                                           | Limit                                                            |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| _Corrected:_ views classified challenge or empty are consistently excluded by one predicate that an invariant test enforces | scan-results.mjs isAuditableView; scan-results-consumers-invariant and page-outcome-contract tests | Classifier knows only challenge/empty (SCAN-01, PROC-01, SEC-01) |
| Scan could-not-audit and redirect handling never throws                                                                     | scan.mjs:250-269; seen-set added only after a successful analyze (:369-370); scan-challenge test   | Redirect-duplicate accounting (VERD-09)                          |
| _Corrected:_ reports carry guardrail text and an automatedCoverage block                                                    | README "What this toolkit does not claim"; wcag-em-summary.mjs:416-431; manual-backlog.mjs:141-150 | VERD-02, CAP-01, REPA-02, PROC-02                                |
| Corrupt-vs-missing inputs distinguished; downstream stages fail closed                                                      | fs-utils.mjs:106-118 warns on non-ENOENT; truncated inventory/sample exit 1                        | Missing axe-results is silent (STRESS-08)                        |
| Coherent summarize exit-code composition                                                                                    | summarize.mjs:55-75 computeExitCode; :695-696 `Math.max(base, reporterErr?1:0)`                    | Coverage not in exit code (SCAN-20)                              |
| Reporter failures isolated                                                                                                  | reporters/index.mjs per-reporter try/catch; EISDIR experiment: exit 1, other outputs written       | Untested, no artefact trace (REPA-15)                            |
| Scan health rendered defensively in both human reports                                                                      | renderScanHealth `Array.isArray` guards; run1 output                                               | Raw call logs, no viewport (PROC-19)                             |
| _Corrected:_ external signals leave no orphaned Chromium and no torn artefacts                                              | SIGINT/SIGTERM/SIGKILL left 0 Chromium; writeAtomic fs-utils.mjs:39-49                             | Internal error or crash loses all (SCAN-03)                      |
| Hostile pages (dialogs, beforeunload, infinite scroll, huge pages) neither hang nor derail                                  | alert/confirm auto-dismissed; 1280x4478 and 1280x60108 screenshots captured                        | Screenshot failure aborts the view (SCAN-09)                     |
| _Corrected:_ a failed or timed-out step is recorded and shown in Scan health without aborting the journey                   | process-runner.mjs:154-170; summarize.mjs:219-231                                                  | PROC-12, VERD-06, PROC-09                                        |
| waitFor selector timeout is self-describing                                                                                 | process-runner.mjs:246-256 (50 ms undercut); TimeoutError names the locator                        | —                                                                |
| Hang-proof discovery metadata capture with an invariant test                                                                | discover.mjs:79-103 single page.evaluate; discover-no-locator-invariant test                       | Guard is text-based (TEST-03)                                    |
| Crawl failures bucketed; navigation timeout separate from handler budget                                                    | discover.mjs:114-133 classifyCrawlFailure; discover-timeout e2e                                    | Never reaches a report (DISC-08, DISC-04)                        |

**Discover and sampling**

| Strength                                                                                                                      | Evidence                                                                                 | Limit                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| _Corrected:_ given the same inventory.json, the same seed reproduces the same random sample; seed and pool are recorded       | sample.mjs:84-86, 120-136; random-pool.txt persisted; site3 runs A and B identical       | Not across crawls (DISC-13, SAMP-08, SAMP-04)                   |
| Random sample size = max(minRandomPages, ceil(structured × percent))                                                          | sample.mjs:85 verbatim; p7 probe gave 3 for 30 pages                                     | Untested (SAMP-10)                                              |
| Random pool excludes structured pages; inventory canonicalised before sampling                                                | sample.mjs:81; discover.mjs:251/323 normalizeUrl + sort                                  | DISC-09, DISC-20, SAMP-01                                       |
| Curated URLs missing from the inventory are warned about, scanned and surfaced with a reason                                  | sample.mjs:71-78; summarize.mjs:248-259                                                  | Not for processExpansion URLs (SAMP-11)                         |
| _Corrected:_ samplingMethodNotes is never blank, and tier attribution uses the original sample URL                            | wcag-em-summary.mjs:472-495; group-findings.mjs:114-121 `tierKey = sampleKey ?? pageUrl` | Text misdescribes the method (SAMP-05)                          |
| PRNG per-page inclusion probability is near-uniform                                                                           | p6-prng.mjs chi2 over 20,000 seeds at three pool sizes                                   | Joint selections non-uniform (SAMP-14)                          |
| normalizeUrl idempotent; sorted, stable inventory outputs within one locale                                                   | probe-pure.mjs idempotence                                                               | DISC-20, SAMP-08                                                |
| _Corrected:_ sitemap seed selection is round-robin fair and deterministic over the fetched sitemaps; document count is capped | sitemap.mjs:150-172; sitemap.test.mjs                                                    | No timeout/scope check; regex parser (DISC-11, SEC-13, DISC-10) |
| _Corrected:_ link-enqueued requests that redirect off-host are dropped by Crawlee                                             | kitchen /go-offsite, probe-two-origin /go-out                                            | Seeds and root redirects are not (DISC-02)                      |
| Document inventory ignores case and skip config                                                                               | discover.mjs DOCUMENT_EXT `/i` runs before documentLinkPatterns                          | Skip patterns are case-sensitive (DISC-21)                      |
| Config regexes compiled once and kept out of artefacts                                                                        | context.mjs:49 defineHidden, used at :118, :184-200                                      | —                                                               |
| Manual backlog is deterministic and structured                                                                                | manual-backlog.mjs:50; manual-backlog.test.mjs:86-98                                     | Content gaps (CAP-03, CAP-04)                                   |

**Scan, process path and transport**

| Strength                                                                                         | Evidence                                                                                    | Limit                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| beforeScan actions run before axe and change what is audited                                     | run2 vs run2-noclick image-alt difference                                                   | Screenshot and classification run first (SCAN-08, SCAN-06) |
| Auth context and multi-viewport execution apply to processes; a single axe-lifting module        | scan-processes.mjs:186 applyAuth, :199-205 viewport loop; axe-artifact.mjs lifters shared   | Process axe ignores scan.axe (PROC-03)                     |
| _Corrected:_ under the default launch transport, each page-view and process gets a fresh context | browser.mjs:215-231 newContext per acquisition, context.close(); probe-cdp no carry-over    | Shared context under CDP (PROC-18, intended)               |
| CDP lifecycle respects the operator's browser                                                    | browser.mjs:199-257 closes only its pages, disconnects, warns on ignored options            | Transport not logged/recorded (SEC-14)                     |
| Non-UTF-8 pages decode correctly                                                                 | windows-1252 and Shift_JIS titles correct in the inventory (not re-run)                     | —                                                          |
| Risky runtime features deferred or opt-in                                                        | auth.mjs:119-122 setupScript warn-only; patchright lazy-loaded; spawnSync git without shell | —                                                          |

**Security and rendering safety**

| Strength                                                                                                                               | Evidence                                                                                                                                                  | Limit                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| HTML reporter is XSS-safe by construction                                                                                              | \_template.mjs:171-191 routes every value through attr(); safeUrl http/https allowlist; attr/safeUrl mutants each failed 3 tests; 16 URL vectors in jsdom | Markdown is separate (REPA-01)        |
| JUnit sanitisation handles CDATA terminators, C0 controls and code-point truncation                                                    | Real output: `]]>` split, U+0001 stripped                                                                                                                 | U+FFFE/U+FFFF and `<error>` (REPB-05) |
| _Corrected:_ configured auth headers, credentials and cookies were not written to artefacts in the probe; cookies stayed domain-scoped | probe-two-origin grep for header, password and cookie sentinels found nothing                                                                             | PROC-08, SEC-06, SEC-02               |
| Spike private-key discipline                                                                                                           | root .gitignore:25 `spikes/web-bot-auth/.keys/`; private.jwk mode 0o600; worker serves public members only                                                | SEC-16, SEC-17                        |
| _Corrected:_ axe finds no WCAG-tagged violations in summary.html at 1280px in either colour scheme                                     | Self-axe with details open, light and dark                                                                                                                | Fails 1.4.10 at 320px (REPA-06)       |
| _Corrected:_ exports validate against the vendored schemas; junit.xml is well-formed for the fixture content                           | Ajv on portal-export and draft; xmllint on junit.xml                                                                                                      | REPB-01, REPB-05, REPB-07             |

**Engineering hygiene, CI and scale**

| Strength                                                                                                                  | Evidence                                                                                                                 | Limit                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Hermetic, parallel-safe e2e harness                                                                                       | test/fixtures/server.mjs:249 `listen(0)`; every CLI-spawning e2e sets CRAWLEE_STORAGE_DIR and uses async spawn           | —                                                                              |
| Complete `@ts-check` and lint hygiene                                                                                     | all 41 src/bin and 70 test `.mjs` files carry `@ts-check`                                                                | Not enforced for new files (TEST-10)                                           |
| Schema/docs/config drift guards, including the schema-to-dispatch action invariant                                        | docs-config-coverage, configs-valid, process-runner-invariant tests exist                                                | Presence-only (PROC-09/10, PROC-15, OPS-09)                                    |
| Least-privilege, staged CI with lockfile-integrity installs                                                               | ci.yml:21-22 `contents: read`; timeouts :32, :69; e2e `needs: checks` :70; `npm ci`                                      | Audit non-blocking (SEC-09)                                                    |
| _Corrected:_ top-level and most nested config objects reject unknown keys                                                 | 23 of 29 object nodes have `additionalProperties:false`; `crawl.maxPage` typo exits 1                                    | 4 open nodes; malformed steps (PROC-15)                                        |
| Generated config.d.ts and index.d.ts match the schema and exports                                                         | Regenerated in scratch: byte-identical (accepted from the reviewer's experiment; not re-run)                             | index.d.ts is hand-written and omits `browserTransportAware` (OPS-05, TEST-10) |
| _Corrected:_ from a clean checkout the npm package is tight                                                               | package.json:32-46 files/exports; 62 files packed; engine guard bin/wcag-em.mjs:28-36                                    | Ships local configs from a dirty tree (SEC-08, OPS-13)                         |
| Docs link-clean; config-guide defaults match DEFAULTS                                                                     | 0 broken links/anchors; 61 claims checked                                                                                | Behavioural drift (B05, A11)                                                   |
| _Corrected:_ summary-verdict, exit-code, escaping and portal-score logic are mutation-resistant; 6 of 19 mutants survived | 13 of 19 killed (decideOutcome, computeExitCode, health split, attr/safeUrl, portal score, viewStatus, challengeCleared) | Sampling and scan paths (SAMP-10, SCAN-22)                                     |
| Non-browser stages and reporters scale linearly                                                                           | sample 0.5 s / 414 pages; summarize 0.65 s / 56 views; synthetic 2000 findings × 500 pages                               | Scan stage (SCAN-14, SCAN-21)                                                  |

---

## 3. Findings by root-cause cluster

Packets in severity order, most severe first. Each table lists the upheld members; duplicates folded into the packet
are named in one line, and refuted and intended members appear only in Appendix A.

### A05. Landed-page gate is lossy, weakly heuristic and mis-sequenced — critical

**Root cause:** `runForPage` in scan.mjs (~214-341), duplicated in process-runner.mjs (~305-330), is the only place
that decides whether a page-view is the intended page in the intended state, and it has three flaws. It is lossy:
classifyPageOutcome reduces status, headers, content type and final URL to {ok, challenge, empty} and discards the
facts, so no result carries httpStatus, contentType, redirect or scope, and nothing checks that the auth session is
live. Its two non-ok classes rest on weak proxies (`body.innerText`; cf-ray, which Cloudflare adds to every proxied
response). And it runs too early: the gate, its early return and the evidence screenshot all precede
beforeScan/override setup.

| ID      | Severity | Status | Claim                                                                                                                                                                                                                                                                                                                                                                                                                                          | Evidence                                                    | Tier       |
| ------- | -------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------- |
| SEC-01  | critical | new    | When the auth session is dead at scan time (expired or revoked cookie, cookie-domain mismatch, unresolvable storageState path), every protected URL is scanned as the login page. The run reports complete, adequate coverage, false `passed` outcomes (e.g. 4.1.2), portal averageScore 100, and exits 0. The one Scan-health line ("not in crawl inventory") fires identically on healthy authenticated runs.                                | auth.mjs:79, page-guard.mjs:99, auth.mjs:88                 | [probe] ×2 |
| SCAN-01 | high     | new    | _(corrected)_ No HTTP status, content type, redirect or scope fact is recorded, and no scanWarning fires for non-2xx, non-HTML or off-origin landings. Such views count as audited, with findings attributed to the requested URL. Keeping 4xx-with-markup auditable is ADR-0017 policy; the defect is the non-disclosure. The CF "Attention Required" 403 is already caught. Multi-WAF recognition is out of scope in ADR-0017 and untracked. | scan.mjs:228, page-guard.mjs:145, user-manual.md:118        | [probe]    |
| SCAN-06 | medium   | new    | Classification and its early return run before beforeScan, so the documented SPA hydration `waitFor` never runs and the shell is recorded 'empty'.                                                                                                                                                                                                                                                                                             | scan.mjs:238, scan.mjs:341, config-guide.md:288             | [probe]    |
| SCAN-07 | medium   | new    | 'empty' is `body.innerText`. Open-shadow-root text, image/iframe/form/SVG/video/canvas-only pages and framesets are excluded as could-not-audit, with a false reason.                                                                                                                                                                                                                                                                          | scan.mjs:140, page-guard.mjs:77                             | [probe]    |
| SCAN-08 | medium   | new    | The evidence screenshot is taken before beforeScan/override actions, so it shows the pre-dismissal or pre-hydration state, not the DOM axe audited.                                                                                                                                                                                                                                                                                            | scan.mjs:314, scan.mjs:341                                  | [probe]    |
| SCAN-13 | medium   | new    | Title + cf-ray corroboration collapses to title-only on Cloudflare hosts, so a real "Just a moment…" post is excluded as a challenge. The guarding unit test passes only because it sends no headers.                                                                                                                                                                                                                                          | page-guard.mjs:88, ADR-0017:46, scan-page-guard.test.mjs:71 | [probe]    |

- **Duplicates folded:** CAP-06 → SCAN-08 (the draft's alt text says "at scan time"); SEC-04 → SCAN-01 (off-scope
  redirect scanned and counted as audited).
- **Second opinion (SEC-01):** The packet verifier ran a full CLI `audit` with an expired and a valid session. Expired
  gave exit 0, coverage complete 3/3, averageScore 100, with both /account pages audited as `/login?next=…`. Valid
  gave exit 2, image-alt + button-name and averageScore 67, with byte-identical scanWarnings (discover never applies
  auth). The independent refute-first verifier built its own probe (all five stages, 7 reporters, a live-session
  control). Dead mode gave exit 0, 4/4 complete, "login" in none of the 12 report files, the draft's `pagesTested`
  naming the protected URLs, `junit tests=0`, and 4.1.2 passed / 1.1.1 inapplicable where live mode fails both. Its
  refutation attempts (the guard vocabulary; the guardrail text, which disclaims conformance, not coverage; the
  operator signals) all failed, and both verifiers rate it critical. Precision correction: scan.mjs:226 compares
  finalUrl for dedupe, never against the requested URL. Partial signals exist only for a missing file or TTL (one
  stderr warning) and a plain `/login` redirect ("partial", still scored 100).
- **Consequence for a WCAG-EM deliverable:** The Step 5 record claims complete coverage and per-SC outcomes for pages
  that were never reached; for authenticated audits this is the default failure mode whenever a session lapses. SPA
  and web-component templates drop out of the sample with a false stated reason.
- **Root fix:** One recorded, ordered landed-view pipeline shared by scan.mjs and process-runner.mjs. (a) Persist
  `LandedFacts {httpStatus, contentType, requestedUrl, finalUrl, redirected, finalUrlInScope}` on every result. (b)
  Run beforeScan/override setup (at least `waitFor`) before the final classification, or re-classify after a bounded
  settle. (c) Widen pageOutcome with `http-error`, `non-html`, `off-scope`, `blocked` and `unauthenticated`, routed
  through isAuditableView, automatedCoverage and scanWarnings; ADR-0017's 4xx-with-markup becomes "auditable but
  disclosed". (d) An `auth.verify {url, expectSelector | loginUrlPattern}` liveness gate that fails fast with exit 1,
  a per-view `unauthenticated` outcome, auth status in executionHealth, and a missing storageState fatal at load
  (ADR-0005). (e) DOM-based emptiness including open shadow roots and frames; challenge corroboration by status or
  challenge-platform markers, not cf-ray. (f) The screenshot after setup (ordering relative to axe: B03). (g) e2e for
  an expired cookie, a 429, an off-origin redirect, the SPA recipe, a shadow shell, the banner screenshot and a 200 +
  cf-ray article.
- **Symptom patches this supersedes:** a non-2xx-only scanWarning; an ad-hoc login-URL regex; relying on the mtime
  ttlMinutes; moving only `page.screenshot`; swapping innerText in one of the two readBodyText copies; deleting `||
cfRay` alone; a second 'empty' re-check in scan.mjs only; a 429 retry that does not record status; a fatal missing
  storageState in isolation (still worth shipping, but it does not close the dead-session case).

### A01. Single axe rule results become SC-level verdicts; every manual-scope surface keys only on notTested — high

**Root cause:** decideOutcome (wcag-em-summary.mjs:509-518) lifts rule-level results straight into SC-level verdicts:
any non-best-practice pass gives `passed`, all-inapplicable gives `inapplicable`, and nothing models how much of an SC
automation can decide (ADR-0007 §1 frames the tree as conformance). Because axe reports every tagged rule as pass or
inapplicable on every page, the bucketed SC set is fixed per tag profile (21 here) and notTested collapses into a
fixed "SCs axe has no rule for" list (36 in every AA run). The docs, draft appendix, backlog, HTML "Passing criteria"
and portal score all key manual scope on that list. VERD-15 and REPA-04 (a)/(b) do not share this root.

| ID      | Severity            | Status    | Claim                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Evidence                                                               | Tier       |
| ------- | ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| CAP-01  | high (was critical) | new       | _(corrected; same defect as VERD-01)_ Single-rule pass or inapplicable becomes an SC verdict: 2.1.1, 3.1.2, 2.2.2 and 1.3.5 read 'inapplicable', and 2.4.2, 2.4.4, 4.1.2 and 1.3.1 read 'passed', on pages that fail them. These reach wcag-em-summary.json and the HTML table with no SC-level qualifier, and the portal averageScore reached 100. Draft rows are labelled "Automated outcome" under a caveat callout. EARL shows them only with includePasses, as earl:automatic. The core backlog still covers keyboard, name/role/value, headings, zoom/reflow, text spacing and focus visibility. About 10 in-target SCs are on neither checklist. | wcag-em-summary.mjs:510, portal-export.mjs:169, html.mjs:361           | [probe] ×2 |
| VERD-02 | medium              | new       | _(corrected)_ The docs call notTested "the completeness checklist", and the draft appendix and nextSteps limit manual SC work to notTested. Because the backlog is also mandatory, the real gap is ~9 in-target SCs on neither list: 1.3.5, 1.4.2, 2.2.1, 2.2.2, 2.4.2, 2.4.4, 2.5.8, 3.1.1, 3.1.2.                                                                                                                                                                                                                                                                                                                                                     | user-manual.md:73, config-guide.md:403, report-builder-starter.mjs:438 | [probe]    |
| REPA-04 | medium              | new       | _(corrected)_ The HTML SC table drops level, examples and pagesExamined, so AAA 2.1.3 is unmarked. "Related rules" mixes pass, inapplicable and violation rules. "passed" and "Passing criteria" carry only the page-top aside. The failing rule is findable under "Grouped findings", but no finding card names its SC.                                                                                                                                                                                                                                                                                                                                | html.mjs:258, html.mjs:362, wcag-em-summary.mjs:513                    | [probe]    |
| CAP-03  | medium              | new       | _(corrected)_ Backlog items are unanchored `{section,label}` strings, never reconciled with notTested. Nine in-target SCs are structurally on neither list for any site; round 1's "10" wrongly counted AAA 2.1.3. The 2.2 SCs 2.5.7, 3.2.6, 3.3.7 and 3.3.8 are notTested and lack only a procedure.                                                                                                                                                                                                                                                                                                                                                   | manual-backlog.mjs:48, summarize.mjs:666                               | [probe]    |
| VERD-15 | low                 | known-low | pagesExamined counts process states (`startUrl#state`) and inapplicable-only pages: 2.4.2 read 7 against 3 audited pages. The draft calls this "examined page(s)".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | wcag-em-summary.mjs:323, :361                                          | [probe]    |
| CAP-21  | info                | new       | _(corrected; inflation half is CAP-01)_ The only score is portal `passed/(passed+failed)`. A per-page or per-instance WCAG-EM 5.d score is optional and of marginal practitioner value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | portal-export.mjs:169                                                  | [probe]    |

- **Duplicates folded:** VERD-01 → CAP-01 (adds per-reporter evidence and fixture examples); E2E-07 → VERD-01 (in the
  same run, one unlabelled input fails 4.1.2 while 3.3.2 reads `passed`).
- **Second opinion (CAP-01):** Both verifiers returned partially confirmed and downgraded critical→high. The packet
  verifier's fixture (keyboard trap, pointer-only div, `outline:none`, autoplay carousel, untagged French text) gave 0
  findings, 11 passed / 10 inapplicable / 36 notTested, portal 100. The independent verifier's own probe gave 8 / 13 /
  36, coverage complete, portal 100, and found two overstatements: "drops off the manual checklist" is false for SCs
  the core backlog covers, and "nothing flagged at SC level" is false for the draft (per-row note under the
  "Conformance caveat" callout) and for EARL (opt-in, earl:automatic). The defect stands with no SC-level signal in
  wcag-em-summary.json, the HTML table and the portal averageScore (the portal never reads scoreBasis). Status stays
  new: ADR-0007 documents the tree, not this consequence, and T-L is a different gap.
- **Consequence for a WCAG-EM deliverable:** The per-SC Step 5 record asserts conformance or non-applicability for SCs
  automation cannot decide, the documented workflow routes manual effort away from 9-10 in-target SCs, and the portal
  shows a compliance-like 100%.
- **Root fix:** A vendored per-SC automation-competence table (from ACT outcome mapping) that defaults every
  axe-touched A/AA SC to 'partial'. For partial SCs never emit `passed`/`inapplicable` from automation; emit a
  non-decided status with `automatedResult: 'noFailuresDetected' | 'noApplicableElements'` and `requiresManual: true`,
  keeping `failed`/`cantTell`. One manual-scope list (every in-target SC with requiresManual, notTested included)
  feeds buildManualBacklogItems as SC-keyed items `{sc, level, understandingUrl, relatedRules, pages}`, the draft
  appendix/nextSteps and the docs. computeAverageScore counts decided verdicts only (null until T-L manual verdicts).
  A unit test locks it (an all-inapplicable 2.1.1 must not come out `inapplicable`). Separately: VERD-15 splits
  pagesExamined into applied pages plus statesExamined; REPA-04 (a)/(b) adds Level and failing-rule columns.
  Dependency: an omitted averageScore currently makes the portal derive 100 (REPB-02), so A08's explicit zero-coverage
  status must land first.
- **Symptom patches this supersedes:** rewording user-manual.md:71-73, config-guide.md:403-404, README.md:108-110 and
  the draft appendix (VERD-02); renaming "Passing criteria" plus a legend (REPA-04 c); tweaking the portal score
  (CAP-21); one-off backlog lines for carousel, link text, lang, title or autocomplete (CAP-03/T-H); prioritising
  "screenshots to eyeball" (CAP-07).

### A02. Criteria scope ignores wcagVersion; conformanceTarget filters only the notTested rows — high

**Root cause:** The WCAG-EM Step 1.b scope (wcagVersion + conformanceTarget) is never turned into one in-scope SC set
applied by every stage. SC_LEVEL_MAP (wcag-em-summary.mjs:54) is flat (86 WCAG 2.2 SCs + 4.1.1) with a level axis but
no introducedIn/removedIn; the level filter at :372 applies only to notTested padding while touched buckets (:338-364)
are emitted regardless; wcagVersion is only a label; the scan tag profile (config.mjs:124) is configured separately;
draft boilerplate hard-codes 2.2 (report-builder-starter.mjs:552).

| ID      | Severity         | Status | Claim                                                                                                                                                                                                                                                                                                                                              | Evidence                                                     | Tier     |
| ------- | ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| VERD-03 | high             | new    | wcagVersion only labels output; neither the SC set nor the default axe tags follow it. A 2.0 AA run emits 18 post-2.0 SCs, some with verdicts. A 2.1 run emits the six 2.2-only SCs, with 2.5.8 'failed' on any target-size violation under a "WCAG 2.1 Level AA" header. An AAA target never enables axe's AAA rules. Nothing validates or warns. | wcag-em-summary.mjs:371, :441, config.mjs:124                | [probe]  |
| VERD-05 | medium           | new    | Touched SCs above the target are emitted and scored. 2.1.3 (AAA, via scrollable-region-focusable) appears in every AA run; in the probe it failed, moving averageScore from 92 to 85. Target A emitted 7 AA/AAA verdicts. The "no AAA for AA" unit test passes only because its fixture uses the wcag111 tag alone.                                | wcag-em-summary.mjs:338, :372, wcag-em-summary.test.mjs:451  | [probe]  |
| VERD-04 | low (was medium) | new    | _(corrected)_ Obsolete 4.1.1 is padded notTested in every run because the table has no removedIn. The effect is one inert checklist/appendix row and +1 scoreBasis.notTested, with no verdict or averageScore effect.                                                                                                                              | wcag-em-summary.mjs:143, wcag-sc-names.json:91               | [probe]  |
| REPB-19 | low              | new    | Draft boilerplate always cites WCAG 2.2 and always claims random sampling and process scans, even with 0 random pages and no processes, and it puts markdown `**name**` into JSON labels.                                                                                                                                                          | report-builder-starter.mjs:552, :503, manual-backlog.mjs:151 | [source] |

- **Duplicates folded:** CAP-02 → VERD-03 (umbrella finding: 2.5.8 failed in 2.0/2.1, 18 post-2.0 SCs, 1.4.3 failed at
  target A, 4.1.1 notTested in every cell); REPA-05 → VERD-03 (the padding half, rendered in the HTML SC table).
- **Consequence for a WCAG-EM deliverable:** EAA/EN 301 549 (WCAG 2.1 AA) and Section 508 (WCAG 2.0 AA) engagements
  get criterion tables, manual checklists and portal scores containing criteria outside the declared standard,
  including false `failed` verdicts against it.
- **Root fix:** A versioned SC table `{level, introducedIn, removedIn}` locked by the wcag-sc-names pairing test; one
  `resolveEvaluationScope(wcagEm)` applied to touched buckets and padding alike, moving out-of-scope touched SCs to an
  advisory `beyondScope` list outside criteriaOutcomes and scoring; the default axe profile derived from the scope
  when withTags is unset (add wcag2aaa for AAA, drop wcag22aa for 2.1), with a warning when explicit tags exceed or
  undershoot it; version-specific reporter text and a level column; a 2.0/2.1/2.2 × A/AA/AAA test matrix fed real axe
  tags. REPB-19's methodology text needs its own fix (derive it from run metadata).
- **Symptom patches this supersedes:** special-casing 4.1.1 or filtering 2.1.3 alone; per-reporter level/version
  filters in computeAverageScore, computeScoreBasis, the draft and the HTML table; swapping the standardsContext URL;
  a mismatch warning with no scoping behind it; rewording the README to match current behaviour.

### A03. Process outcomes and provenance never reach the WCAG-EM layer — high

**Root cause:** The process path has no result model the shared seam understands: states record degraded, pageOutcome,
not-run and the failing action, but no `page.url()`, title, step index, viewport or state screenshot. E1's predicate
module (scan-results.mjs) was half applied: viewStatus has no 'degraded'/'not-run' arm (`degraded` is written at
process-runner.mjs:138 and read nowhere); viewIdentity cannot key URL-less states; process coverage is copied from
config (wcag-em-summary.mjs:437, report-builder-starter.mjs:489); buildExecutionHealth sees only error/step-timeout;
reporters rebuild evidence from axe-results.json only.

| ID      | Severity         | Status        | Claim                                                                                                                                                                                                                                                                                                                     | Evidence                                                                   | Tier    |
| ------- | ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------- |
| VERD-06 | high             | new           | States after a failed step are flagged degraded, but nothing reads the flag. A timed-out checkout click scanned a 404 as state 'payment', flipping 2.4.2 and 3.1.1 from passed to failed. processesEvaluated comes from config, so both failed processes were "evaluated", with coverage complete and scanWarnings empty. | process-runner.mjs:138, wcag-em-summary.mjs:437, scan-results.mjs:76       | [probe] |
| PROC-02 | high             | tracked-stale | processesEvaluated and the draft's journeysTested copy config.processes. executionHealth sees only error and step-timeout states, so a process whose states were all challenge, empty or not-run raises no warning and is still reported as evaluated.                                                                    | wcag-em-summary.mjs:437, summarize.mjs:222, report-builder-starter.mjs:489 | [probe] |
| PROC-04 | high             | new           | An axe state records only its label. Every consumer keys process findings to startUrl, whatever page the journey had reached, and the artefacts disagree on identity (startUrl vs the synthetic `startUrl#state` that pagesExamined counts).                                                                              | process-runner.mjs:293, group-findings.mjs:178, portal-export.mjs:292      | [probe] |
| PROC-05 | medium           | new           | No human report or export shows the process or state a finding came from. The attached screenshot is the pre-interaction page scan, and process screenshots are referenced nowhere.                                                                                                                                       | report-builder-starter.mjs:179, html.mjs:407                               | [probe] |
| PROC-17 | low (was medium) | new           | _(corrected)_ Intermediate journey pages are neither auto-scanned nor recorded. process-candidates.json is write-only, with no warning for unconfigured critical-process candidates. Axe-only-at-explicit-steps is documented DSL design, and complete-process conformance is positioned as manual.                       | sample.mjs:93, discover.mjs:359, urls.mjs:151                              | [probe] |
| PROC-19 | low              | new           | Scan health dumps raw multi-line Playwright call logs, including page HTML, into markdown, and drops viewport, action and step index.                                                                                                                                                                                     | markdown.mjs:120, summarize.mjs:223                                        | [probe] |

- **Duplicates folded:** PROC-11 → VERD-06 (the process keeps running after a failed step; the group-findings comment
  is wrong); REPA-12 → PROC-19 (no viewport, so Scan-health lines duplicate).
- **Consequence for a WCAG-EM deliverable:** The Step 3.d/4.b record claims journeys were evaluated when zero states
  were audited, SC verdicts can be driven by states that never occurred, and developers are pointed at the wrong page.
- **Root fix:** Make the process state a first-class view: stamp every state `{url, title, stepIndex, action,
viewport, screenshot?}`; extend viewStatus with 'degraded' and 'not-run' (non-auditable, or degraded→cantTell with a
  reason) and let viewIdentity resolve `state.url`; add one pure `processOutcomes(processResults)` (per process ×
  viewport: statesAudited, statesUnauditable by outcome, notRun, stepFailures, status
  `complete|partial|failed|not-run`) and route toWcagEmSummary, buildExecutionHealth, the draft's
  journeysTested/sourceFiles and portal instances through it; extend the consumers invariant. Separately, reject
  processes with neither steps nor pattern and render Scan-health errors as single escaped lines.
- **Symptom patches this supersedes:** `if (state.degraded) continue` at three ingestion sites; a pageOutcome check in
  processStepFailures only; filtering processesEvaluated against processFailures; swapping startUrl for the synthetic
  URL without recording the real one; a startUrl-keyed process-screenshot lookup; escaping `p.error` without
  viewport/stepIndex/action; a backlog note for challenged processes that does not feed automatedCoverage.

### A04. Process runner and patterns audit the wrong or unsettled state — high

**Root cause:** The process `axe` step audits whatever page exists through its own path — a bare `new AxeBuilder({
page }).analyze()` (process-runner.mjs:350), no challenge wait, classification against `ctx.lastResponse`, which only
`goto` sets (:217, :322) — and pattern expansion (scan-processes.mjs:43-75) clicks the first page-global submit match,
then screenshots and runs axe with no form scoping, settle or landed-URL check. PROC-12 (Promise.race without
cancellation, :158) and PROC-13 (side-effect policy) have separate causes.

| ID      | Severity          | Status        | Claim                                                                                                                                                                                                                                                                                                                                                                                                | Evidence                                                             | Tier    |
| ------- | ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------- |
| PROC-03 | high              | new           | _(corrected)_ Process-state axe runs ignore scan.axe entirely (exclude, include, withTags, withRules, runOnly, overrides) and skip the challenge re-check. With exclude `['.third-party']` + wcag2a, a state reported image-alt from the excluded region and AA color-contrast, so 1.1.1 and 1.4.3 read 'failed' at target A. beforeScan's absence is documented scope; screenshotFormat is PROC-20. | process-runner.mjs:350, scan.mjs:354, config-guide.md:154            | [probe] |
| PROC-06 | high              | new           | The default pattern submit selector is page-global with `.first()`. When a header search precedes the target form, blank-submit submits the search and audits the results page under the process label, with no error and no landing check.                                                                                                                                                          | scan-processes.mjs:48, process-runner.mjs:224, legacy-events.json:80 | [probe] |
| PROC-07 | high              | new           | Patterns run click → screenshot → axe with no settle. Validation rendered ≥150 ms later is missed, and the state still contributes passes: async 1.4.3 read passed where sync read failed.                                                                                                                                                                                                           | scan-processes.mjs:46, :51                                           | [probe] |
| PROC-01 | medium (was high) | tracked-stale | _(corrected)_ After click/press/submit navigation, classification uses the goto's stale response, so ADR-0017's "classified the same way" is false. On Cloudflare-proxied sites the stale cf-ray still catches the English interstitial. False findings need a non-CF WAF or a localized/custom interstitial title; the reverse case gives a false could-not-audit.                                  | process-runner.mjs:217, :322, ADR-0017:40                            | [probe] |
| PROC-12 | low (was medium)  | new           | _(corrected)_ A timed-out step's action is not cancelled and can mutate the later audited state. This happens only when scan.timeoutMs < 30 s (Playwright's own 30 s timeout wins at the 60 s default), and the state is already flagged degraded.                                                                                                                                                   | process-runner.mjs:158, :219                                         | [probe] |
| PROC-13 | low (was medium)  | new           | _(corrected)_ Live submissions repeat once per viewport (two by default), by ADR-0006 design. There is no per-process viewport limit and no side-effect warning in the docs. Defining a submitting process is itself an opt-in.                                                                                                                                                                      | scan-processes.mjs:201, :55                                          | [probe] |

- **Duplicates folded:** VERD-07 → PROC-03; E2E-02 → VERD-07. axe-core 4.11.3 ships target-size disabled by default,
  so the unconfigured process builder never evaluates 2.5.8 (89 rules vs 90).
- **Consequence for a WCAG-EM deliverable:** The interaction states WCAG-EM 3.d exists for — validation, error, wizard
  steps — are audited on the wrong page, before they render, or outside the declared rule profile, and still feed SC
  verdicts.
- **Root fix:** One shared `auditCurrentPage(page, config, {response})` used by scan.mjs and process-runner: the
  AxeBuilder built from config.scan.axe plus `findMatchingOverride(page.url())`/applyAxeOverride; classification
  against the latest main-frame navigation response (a `page.on('response')` listener filtered to
  `isNavigationRequest()` on the main frame); the same challenge wait; a source invariant that no AxeBuilder exists
  outside the helper. State-aware patterns: scope the submit to a form and warn on multi-match; settle with
  waitForLoadState plus optional `selectors.error`/`waitFor`; record the landed URL and title and flag the state
  unverified when the URL changed or the DOM did not. Independent: PROC-12 passes the remaining budget as Playwright's
  `timeout` option; PROC-13 adds a docs warning and a per-process `viewports` filter.
- **Symptom patches this supersedes:** nulling or re-reading `ctx.lastResponse` in click/press; copying the
  exclude/withTags loop into runAxe; a fixed `waitForTimeout` after the click; a hard-coded `form ` selector prefix;
  adding beforeScan to the process loop; a screenshotFormat branch.

### A06. discover trusts Crawlee defaults: no toolkit gate on scope, redirects, status, content type, truncation, storage or auth — high

**Root cause:** discover.mjs builds a PlaywrightCrawler on Crawlee defaults with one pre-enqueue filter. (1) There is
no admission gate where a page is recorded: requestHandler stores `normalizeUrl(page.url())` without re-checking the
final URL against scope or exclusions, status or content type, and scope is delegated to Crawlee's hard-wired strategy
glob (DISC-01/02/03). (2) Crawler construction ignores the run context: no Crawlee Configuration from outDir
(DISC-05), no applyAuth (DISC-06), and reachedMaxPages from `inventory.length` rather than crawler.stats (DISC-04).

| ID      | Severity          | Status | Claim                                                                                                                                                                                                                                                                                             | Evidence                                                                         | Tier    |
| ------- | ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------- |
| DISC-01 | high              | new    | In allowed-hosts mode enqueueLinks uses 'same-hostname', and Crawlee applies the strategy glob after transformRequestFunction. Links to allowed hosts are silently dropped and counted nowhere; only sitemap seeds and structuredManual URLs reach them.                                          | discover.mjs:287, urls.mjs:195, crawlee/core/enqueue_links/enqueue_links.js:200  | [probe] |
| DISC-02 | high              | new    | The final URL is never re-checked. A sitemap URL that 301s off-host inventories a third-party page. `/go-admin → /admin/secret` bypassed excludeUrlPatterns and was then auto-suggested. A rootUrl that redirects to another host yields a 1-page inventory, exit 0, no warning.                  | discover.mjs:251, :266, crawlee/basic/internals/basic-crawler.js:1420            | [probe] |
| DISC-03 | high              | new    | There is no status or content-type gate. 404/500/503/soft-404 pages, JSON, RSS/XML and images linked by `<a>` all enter the inventory, and the JSON/XML viewer pages produced false 'failed' 2.4.2 and 3.1.1 verdicts.                                                                            | discover.mjs:236, config.mjs:42, page-guard.mjs:24                               | [probe] |
| DISC-04 | high              | new    | `reachedMaxPages = inventory.length >= maxPages`, but Crawlee's budget also counts failures, redirect skips and duplicate finals. Any such request hides truncation from summarize and from Scan health.                                                                                          | discover.mjs:399, crawlee/basic/internals/basic-crawler.js:93, summarize.mjs:324 | [probe] |
| DISC-06 | high              | new    | _(corrected: new, not covered by T-O)_ discover never calls applyAuth, and the sitemap fetch is bare, so httpCredentials, extraHttpHeaders and storageState are all absent. A documented Basic-auth staging site gives an empty inventory with exit 0; failedRequestCount 1 is read by no report. | discover.mjs:227, scan.mjs:196, sitemap.mjs:108                                  | [probe] |
| DISC-05 | medium (was high) | new    | _(corrected)_ Crawlee storage (request queue, cookie jars) lands in `./storage` under the CWD, not `--out-dir`. Concurrent runs from one CWD crash with exit 1 or, on the same site, silently lose pages. This needs concurrency, which is not a documented workflow.                             | user-manual.md:46, context.mjs:233, crawlee/core/configuration.js:335            | [probe] |

- **Duplicates folded:** CAP-17 → DISC-01; SEC-03 → DISC-06 (includes the sitemap fetch).
- **Consequence for a WCAG-EM deliverable:** The Step 1.a scope the operator configured is not the scope crawled, Step
  2 exploration can inventory other organisations' pages and excluded areas, and truncation is invisible, so the
  random sample is drawn from a population presented as complete.
- **Root fix:** (a) An `admitPage({requestedUrl, finalUrl, status, contentType})` gate before `discovered.set` that
  applies scope and exclusions to the final URL and requires 2xx HTML; status, contentType and finalUrl on each entry;
  rejected pages counted with examples; enqueueLinks strategy 'all' (or explicit globs) so urlAllowedByScope is the
  only scope authority; preflight warns or fails when rootUrl's final origin differs. (b) A
  `buildCrawlerOptions(ctx)`: Crawlee Configuration under outDir (unique per run, removed after), applyAuth
  contextOptions on the crawler and the sitemap fetch, reachedMaxPages from crawler.stats or `onSkippedRequest`
  'limit'. (c) A crawl-level e2e fixture for all six (DISC-25). Dependency: DISC-06 must adopt SEC-02's origin
  scoping, or discover will leak auth to third parties as well.
- **Symptom patches this supersedes:** xml/json/feed families in documentLinkPatterns (cannot catch an extensionless
  `/feed/`); fixing the "allow-list" naming alone; special-casing redirect shapes; CRAWLEE_STORAGE_DIR only in tests;
  filtering 404/500 in the sampler (SAMP-02); a scan-time HTTP-error/non-HTML guard as the primary defence (keep it as
  defence in depth); warning only on failedRequestCount; documenting "discover is unauthenticated".

### A07. Secrets leak: auth sent to every origin, secrets and URL userinfo persisted unredacted, client configs in the tarball — high

**Root cause:** The toolkit has no model of which values are sensitive: httpCredentials, extraHttpHeaders values, fill
values and URL userinfo are plain config literals, so no layer can scope or scrub them. Three mechanisms follow.
Egress: applyAuth (auth.mjs:107-117) maps auth to context-wide Playwright options with no origin allowlist, and the
schema forbids `httpCredentials.origin`. Persistence: runStep stores Playwright's message verbatim
(process-runner.mjs:164-166), normalizeUrl keeps userinfo (urls.mjs:43), and pino path redaction cannot scrub
substrings and has drifted (logger.mjs:25). Packaging: `files: ["configs/"]` overrides .gitignore.

| ID      | Severity | Status | Claim                                                                                                                                                                                                                                                                                                     | Evidence                                       | Tier     |
| ------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------- |
| PROC-08 | high     | new    | When a `fill` step's locator resolves but the action fails, Playwright's call log includes `fill("<value>")`, stored verbatim. The value (e.g. a password) reaches process-results, summary.json/md/html, portal-export, the draft and the CLI log.                                                       | process-runner.mjs:164, :166, markdown.mjs:120 | [probe]  |
| SEC-02  | high     | new    | Auth options are context-wide. The WAF-bypass extraHttpHeaders go on every request (third-party pixels, scripts, iframes, off-site redirect targets), and httpCredentials answer any origin's 401. The custom header also forces CORS preflights that break third-party widgets: a silent false negative. | auth.mjs:115, auth.mjs:107, browser.mjs:219    | [probe]  |
| SEC-06  | medium   | new    | The schema accepts URL userinfo and normalizeUrl keeps it. The password lands in inventory, sample, axe-results, all 7 reporter outputs, stderr logs and screenshot filenames.                                                                                                                            | urls.mjs:43, logger.mjs:25                     | [probe]  |
| SEC-08  | medium   | new    | `files: ["configs/"]` overrides the `configs/*.json` gitignore rule, so npm pack/publish would ship local engagement configs. The main checkout holds 8 non-example configs (filenames only inspected).                                                                                                   | package.json:42, .gitignore:30, ADR-0015:67    | [probe]  |
| SEC-12  | low      | new    | Latent. REDACT_PATHS misses auth.extraHttpHeaders, nested `config.auth.*`, headers.authorization, `contextOptions.*` and `*.key`. ADR-0004 calls the paths case-insensitive (pino's are case-sensitive). No test covers redaction, and WCAG_EM_LOG_LEVEL is dead under the CLI.                           | logger.mjs:25, :63, ADR-0004:32                | [probe]  |
| SEC-22  | info     | new    | Authenticated scans have no screenshot mask and no snippet redaction, so test-account PII flows into the portal export and the draft.                                                                                                                                                                     | scan.mjs:315                                   | [source] |

- **Note:** Related in other packets: STRESS-02 (B03, open proxy), SEC-13 (A12, sitemap SSRF), SEC-16/17 (A19, spike
  keys), OPS-13 (B05, real third-party target in a shipped example).
- **Consequence for a WCAG-EM deliverable:** Authenticated and WAF-bypass engagements — where the toolkit is most
  needed — expose client secrets to third parties and embed credentials and PII in client-facing and portal-uploaded
  artefacts.
- **Root fix:** (A) Declare secrets at config load (auth credentials, header values, fill values; optional
  `sensitive:true` or valueFromEnv, see SEC-20) and reject URL userinfo with an Ajv keyword. (B) One scrub function at
  every persistence choke point — step/page/process failure write sites, pino formatters/hooks, the reporter pipeline
  — keeping path redaction only as a tested backstop. (C) Scope egress: `httpCredentials.origin` set to the root
  origin (allowed in the schema), headers injected via `context.route` for in-scope origins only, a two-origin e2e.
  (D) Narrow `files` to `configs/example-*.json` and add `private:true` or a prepublishOnly pack check. (E) Later: a
  screenshot mask and snippet value redaction.
- **Symptom patches this supersedes:** redacting only `step.value` or truncating the call log in runStep; more
  REDACT_PATHS entries; stripping userinfo only in normalizeUrl/fileSafeFromUrl; per-reporter escaping of
  processStepFailures; an ad-hoc screenshot mask; documenting any of this as a caveat instead of enforcing it.

### A08. Runs that audit nothing, hang or crash still read green or lose everything — high

**Root cause:** Two related roots. (1) The page-view lifecycle has no supervisor: allocation, navigation,
classification, screenshot, axe and release run as one unbounded step with only `goto` bounded; the optional
screenshot shares axe's failure scope; openPageView/release sit outside the per-attempt catch; results are written
once, disposal runs only on success, and `bin/` sets exitCode, so a live browser keeps Node running. (2) There is no
audit-effectiveness invariant: viewStatus treats "nothing failed" as auditable even when zero rules ran,
automatedCoverage is prose only (in neither the exit code nor any field a consumer acts on), and portal-export omits
averageScore, which the portal turns into 100.

| ID      | Severity          | Status | Claim                                                                                                                                                                                                                                                                                                                                                                         | Evidence                                                                                                                         | Tier    |
| ------- | ----------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------- |
| SCAN-03 | high              | new    | Results are held in memory and written once. openPageView and release escape the per-attempt catch, and disposal runs only on success. A mid-run browser crash loses every scanned page, and an escaping error with Chromium alive hangs the CLI after "command failed".                                                                                                      | scan.mjs:420, :434, :454                                                                                                         | [probe] |
| SCAN-04 | high              | new    | withTags, withRules and runOnly values are never validated. A typo ('wcag2.1aa', 'wcag22a') runs zero rules and reports 0 findings with "automated coverage complete". Unknown rule ids fail every page, and only at scan time.                                                                                                                                               | config.schema.json:352, scan.mjs:358                                                                                             | [probe] |
| REPB-02 | high              | new    | _(corrected)_ When no SC is adjudicated (a fully challenged sample, a zero-rule run), portal-export omits averageScore and sends no status. The portal adapter derives 100 and stores the scan as 'completed'. The draft does carry a Scan-warnings appendix, but it also says the 56 SCs were "not touched by any automated rule". The portal-side 100 is from source trace. | portal-export.mjs:538, portal:scans/ingestion/adapters/canonical.adapter.ts:222, portal:scans/ingestion/utils/normalizers.ts:253 | [probe] |
| SCAN-02 | medium (was high) | new    | _(corrected)_ scan.timeoutMs bounds only `goto`; title/evaluate, the screenshot and analyze are unbounded. A main thread that never yields hangs the run indefinitely. A merely busy page overruns (~4×) but completes.                                                                                                                                                       | scan.mjs:219, :155, :368                                                                                                         | [probe] |
| SCAN-09 | medium            | new    | The screenshot runs before axe with no try/catch of its own. Any screenshot error (ENAMETOOLONG, the 30 s font wait) is retried and ends as an error entry, so axe never runs.                                                                                                                                                                                                | scan.mjs:315, :428                                                                                                               | [probe] |
| SCAN-20 | medium            | new    | scan ignores pagesFailed and exits 0 when every page-view failed; summarize then exits 0 on zero findings, so a CI gate passes a run that audited nothing.                                                                                                                                                                                                                    | bin/wcag-em.mjs:156                                                                                                              | [probe] |

- **Duplicates folded:** SEC-07 → SCAN-03 (browser death mid-scan loses every completed result).
- **Consequence for a WCAG-EM deliverable:** A Step 5 report, a portal score and a CI gate can all read green for a
  run that audited nothing (WAF-blocked sample, tag typo, all pages failed), and a long real-site audit is one browser
  crash from total loss.
- **Root fix:** (1) Supervised page-view: a per-view deadline around open/runForPage/release that closes the context
  and records "page-view deadline exceeded"; allocation failures as per-view errors; relaunch on disconnect; an
  isolated screenshot (own try/catch, explicit timeout, `screenshotError`, axe always runs); try/finally disposal;
  incremental JSONL or atomic checkpoints, including on SIGINT/SIGTERM, with optional resume. (2) Audit-effectiveness
  invariant: tags and rule ids validated against `axe.getRules()` at load (ADR-0005); zero-executed-rule views
  non-auditable; automatedCoverage wired to a distinct exit code (e.g. 3, `reporting.failOnCoverage`) for scan,
  summarize and audit and into every exporter; portal-export refuses to emit or sends `status: 'failed'`/a
  zero-coverage marker when nothing was audited or adjudicated (and the portal stops defaulting an omitted score to
  100); JUnit emits could-not-audit views as `<error>`; the draft separates "no page audited" from "no rule covers
  this SC".
- **Symptom patches this supersedes:** a standalone axeTimeoutMs; wrapping only `page.screenshot`; moving only
  disposal into finally; a scan-only exit code; a portal-export-only `averageScore:0`; rewording only the draft
  appendix; a JUnit-only could-not-audit change.

### A10. Portal and report-builder export contracts do not match the real consumers — high

**Root cause:** Both exporters are checked only against the toolkit's own copies of the consumer contracts; nothing
runs either consumer's parser or normaliser. The copies failed differently: the report-builder copy is a 2026-06-11
snapshot that drifted when the consumer changed on 06-17..19 (reportType 'combined-audit' only, a new status enum, a
sourceFile refinement; REPB-01); the portal copy was derived by hand and wrong from the start (the portal reads
`instances[].htmlSnippet` with OR semantics; REPB-03). The same gap produced the doc drift (REPB-11), and REPB-21 is
the missing guard. REPB-10 has an independent root (T-K's missing reports-dir clean policy plus ADR-0008's exit rule).

| ID      | Severity         | Status             | Claim                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Evidence                                                                                                        | Tier    |
| ------- | ---------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------- |
| REPB-01 | high             | new                | Every draft fails the consumer's current DraftReportSchema for three reasons. reportType 'technical-audit' is no longer in the enum (now only 'combined-audit'). Finding status 'Not retested' is not in Open/Accepted risk/Deferred/Resolved. The `#findings`/`#incompleteFindings` sourceFile forms break validateSourceFileReferences. validateExports passes because the vendored copy still allows all three.                                                                           | report-builder-starter.mjs:456, :337, rb:src/schemas/report.schema.js:370                                       | [probe] |
| REPB-10 | medium           | tracked-open (T-K) | _(corrected)_ With `validateExports:'error'`, a failing portal-export is not written, but the previous run's file survives byte-identical next to a fresh summary.json. Exit 2 winning over 1 is ADR-0008 intent, and the failure is logged at level 50 with `reporterErrors:1`.                                                                                                                                                                                                             | portal-export.mjs:557, summarize.mjs:696                                                                        | [probe] |
| REPB-11 | medium           | new                | _(corrected)_ integrations.md is literally true about the file but implies scoreBasis, executionHealth and instance evidence reach the portal. On portal master:<br>• scoreBasis survives only under `sourceMeta.inputSummary`, and executionHealth is stored only.<br>• Instance `evidence.html` is ignored, and confidence 'automated' is dropped.<br>• An omitted averageScore falls back to a portal-derived score.<br>The CHANGELOG's "portal displays failureSummary" has no renderer. | integrations.md:21, portal:scans/ingestion/adapters/canonical.adapter.ts:174, config.schema.json:590            | [probe] |
| REPB-21 | medium           | new                | _(corrected)_ Exporter tests check only the vendored JSON Schemas. No test or CI job runs DraftReportSchema (including superRefine) or the portal adapter, which is why REPB-01 passes CI. This is the missing guard, not a separate defect.                                                                                                                                                                                                                                                 | report-builder-schema.test.mjs:13, reporters-portal-export.test.mjs:251                                         | [probe] |
| REPB-03 | low (was medium) | new                | _(corrected)_ Per-instance HTML goes to `instances[].evidence.html`, but the portal reads only `instances[].htmlSnippet`; it sets engine 'unknown' and maps confidence 'automated' to undefined. No visible loss today, because top-level evidence.html satisfies the portal's OR check. The toolkit schema and tests guard a contract the portal does not have.                                                                                                                             | portal-export.mjs:236, portal:scans/ingestion/scan-ingestion.types.ts:33, portal-canonical-scan.schema.json:225 | [probe] |

- **Refuted member:** REPB-04 (Appendix A).
- **Consequence for a WCAG-EM deliverable:** The commissioned "author a client report from audit data" path fails on
  every run while the write-time gate reports success, and the portal accepts uploads but drops the adjudication
  context (scoreBasis, executionHealth) the 2026-06 C3 fix was meant to ship.
- **Root fix:** (1) Make the consumers the source of truth: pin report-builder's DraftReportSchema (package,
  submodule, or a generated artefact carrying the consumer SHA) and the portal's canonical types and adapter (T-E),
  and add a payload contractVersion. (2) A CI drift job that runs the real consumer code on fixture exports
  (`safeParse` including superRefine; the portal adapter and data-quality checks). (3) Assert that fields survive
  ingestion — htmlSnippet, wcag after normalizeWcag, scoreBasis, confidence — not just that the upload is accepted.
  (4) Generate or check the integrations.md consumer sections from that job. (5) REPB-10, under T-K: delete or
  tombstone the reporter's target before validation.
- **Symptom patches this supersedes:** swapping reportType/status/sourceFile values; hand-regenerating the schema;
  renaming `evidence.html` to htmlSnippet, adding engine, mapping confidence or changing the vendored allOf to OR; a
  two-digit-SC warning (fixed on portal master); hand-editing integrations.md (its "no draft validation mode" is stale
  — the consumer has `--allow-draft`) and the CHANGELOG claims; deleting portal-export.json on validation failure.

### B02. Stage artefacts carry no run identity; summarize silently merges stale, missing or corrupt artefacts — high

**Root cause:** summarize.mjs:357-388 loads each artefact independently through readJsonMaybe (silent on ENOENT,
warn-and-fallback on a parse error). Nothing links the artefacts — no runId, input digest or config hash, no
cross-check between sample.json, sample-metadata.json and axe-results.json — scan writes axe-results.json only at the
end (:455) and never invalidates the old file, wcag-em-summary.mjs:420-423 checks only under-coverage, and
computeExitCode ignores coverage. OPS-14 is adjacent (nothing records how far `audit` got); E2E-06 is REPB-18's
separate defect.

| ID        | Severity | Status             | Claim                                                                                                                                                                                                                                                                                                                                                                                        | Evidence                                           | Tier     |
| --------- | -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------- |
| STRESS-04 | high     | tracked-open (T-K) | The manual says to re-run sample + scan + summarize against the same out-dir. If the re-scan is interrupted, summarize joins the new sample-metadata with old results: "24/7 selected pages audited", findings on 15 unsampled pages, old Scan-health exclusions, zero warnings, dated today.                                                                                                | user-manual.md:29, scan.mjs:455, summarize.mjs:370 | [probe]  |
| STRESS-07 | low      | new                | With sample-metadata missing, finalSampleCount falls back to `axeResults.length` (page-views), giving "Final selected sample: 56" for a 28-page sample, with no log line.                                                                                                                                                                                                                    | summarize.mjs:611, fs-utils.mjs:110                | [probe]  |
| STRESS-08 | low      | new                | _(corrected)_ A truncated axe-results.json exits 0 (the intact run exits 2), with warnings and "coverage none"; a missing one exits 0 with no log line. The exit-0 itself is SCAN-20, and the closed TODO item's remedy (warn plus atomic writes) was delivered. Two residuals are new: ENOENT is silent when sample.json lists pages, and parse errors in sample/scan do not name the file. | TODO.md:123, summarize.mjs:370, scan.mjs:176       | [probe]  |
| OPS-14    | low      | new                | _(corrected)_ `audit` has no `--from`/resume and no run-state file, so a mid-pipeline throw exits 1 and leaves a mixed out-dir. Stage selection already exists through the documented standalone subcommands.                                                                                                                                                                                | bin/wcag-em.mjs:196, :116                          | [source] |

- **Duplicates folded:** E2E-06 → REPB-18 (re-summarising a copied run points summary.html images at the original
  run's screenshots).
- **Consequence for a WCAG-EM deliverable:** A client-facing report can describe a sample that was never scanned,
  mixing findings and screenshots from two runs, with an impossible ratio as the only signal.
- **Root fix:** The T-K envelope and a strict loader as one change: every stage writes `{runId, stage, startedAt,
configHash, inputDigest}` (sample stamps a digest of sample.json; scan records it plus its own runId); scan and
  scan-processes remove or rename downstream results at start behind an in-progress marker and write atomically;
  summarize fails with a distinct exit code on a missing, unreadable or foreign-lineage artefact and derives
  pagesSelected from sample.json; over-coverage or out-of-sample URLs are an integrity error; plus SCAN-20's
  coverage-aware exit code. REPB-18 (outDir-relative screenshot paths at scan time) is separate. Two cheap patches are
  worth landing now: over-coverage as an error (wcag-em-summary.mjs:420-423) and the file path in JSON.parse errors
  (scan.mjs:176 and the sample inventory read).
- **Symptom patches this supersedes:** an ad-hoc URL-set assertion or scan-start delete (STRESS-04); a
  finalSampleCount fallback plus warning (STRESS-07); a missing-file warning or an "exit non-zero on coverage none"
  patch, both folded into SCAN-20 (STRESS-08); a standalone run-state file (OPS-14); re-basing at html.mjs:308
  (E2E-06).

### A-X1. PDF "crawl as page-equivalents" docs drift — medium

**Root cause:** A single finding. The docs still carry the pre-E5 idea that `documentLinkPatterns: []` makes PDFs
crawlable pages; the CHANGELOG entry that introduced the setting already says un-skipped documents retry 3 times and
are dropped, and E5 made document-inventory.json the only route PDFs take into the audit.

| ID     | Severity | Status | Claim                                                                                                                                                                                                                                                                                 | Evidence                                              | Tier    |
| ------ | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------- |
| CAP-11 | medium   | new    | Four places (the config guide twice, the root README and the discover warning) say that emptying documentLinkPatterns crawls PDFs as pages. Headless Chromium turns them into downloads: "Download is starting" after 3 retries, and no PDF reaches the inventory, the sample or axe. | config-guide.md:412, config-guide.md:67, README.md:74 | [probe] |

- **Consequence for a WCAG-EM deliverable:** Operators following the production-audit guidance believe PDFs were
  audited as pages; only the manual document queue keeps them in the coverage record.
- **Root fix:** One statement of PDF handling that every doc repeats — always inventoried for manual review, never
  browser-audited; `documentLinkPatterns: []` only adds failed navigations (4 attempts per document). Optionally drop
  PDF-matching URLs from the crawl queue regardless of the patterns.
- **Symptom patches this supersedes:** rewording config-guide.md:67 and :412-413, README.md:74 and the
  discover.mjs:198 warning one at a time.

### A09. Structured-sample auto-suggest semantics, URL-only page typing, and sample provenance — medium

**Root cause:** Two related roots. (A) Selection: sample.mjs takes the structured sample from page-clusters.json (one
representativeUrl per cluster, keyed on URL substrings), slices clusters per preferred type (`perCluster` = clusters
per type) and does no coverage accounting; discovery signals (h1, canonical, formCount, process-candidates) never
reach typing or sampling although the guide says they do. (B) Provenance: sample.json is a bare `string[]`, so tier,
source, cluster, inventory membership and rationale are scattered or absent, the E5 not-in-inventory disclosure covers
only the structured tier, and no reporter can list the sample.

| ID      | Severity          | Status | Claim                                                                                                                                                                                                                                                                                                                                                        | Evidence                                                 | Tier    |
| ------- | ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------- |
| SAMP-03 | medium (was high) | new    | _(corrected)_ `perCluster` means "clusters per type", with one representative each. The defaults add at most 6 pages. With 18 clusters, 12 were unrepresented, and raising perCluster still yields one page per cluster. This contradicts config-guide.md:99-100. structuredManual remains the primary mechanism.                                            | sample.mjs:61, config-guide.md:99                        | [probe] |
| DISC-14 | medium            | new    | _(corrected)_ Unanchored substring regexes misroute /research, /support-\*, /facebook, /ebooks and /contact-lenses. guessProcessTypes tests host and query, and query-routed CMSs collapse into one cluster. None of this has tests. URL-only typing is ADR-0012 intent, but combined with SAMP-03 the real /contact and /privacy dropped out of the sample. | urls.mjs:112, urls.mjs:150, sample.mjs:63                | [probe] |
| SAMP-06 | medium            | new    | The guide says h1, forms and canonical drive clustering and dedupe. In code, pageType uses the pathname only, formCount feeds only process-candidates and the backlog, and canonical has no consumer.                                                                                                                                                        | config-guide.md:83, :88, discover.mjs:262                | [probe] |
| SAMP-09 | medium            | new    | _(corrected)_ No reporter lists the sampled pages. Tiers can be recovered only across three artefacts. structuredManual has no rationale field, and sample-metadata omits the autoSuggest parameters. The WCAG-EM 3.e/5.a sample record and the house sample table are built by hand.                                                                        | sample.mjs:119, config.schema.json:157, markdown.mjs:168 | [probe] |
| SAMP-07 | low (was medium)  | new    | _(corrected)_ process-candidates.json is never reconciled against config.processes or the sample, and no warning fires for an unconfigured critical-process URL. The default preferTypes exclusion is documented and defensible; the misroutes are DISC-14.                                                                                                  | config.mjs:93, discover.mjs:359                          | [probe] |
| SAMP-11 | low               | new    | _(corrected)_ processExpansion URLs that are off-host or missing from the inventory are scanned without the disclosure structuredManual URLs get. Adding relatedUrls without the start page matches the config guide.                                                                                                                                        | sample.mjs:91, summarize.mjs:248                         | [probe] |

- **Consequence for a WCAG-EM deliverable:** The 3.a representativeness claim ("auto-suggested cluster
  representatives") overstates template coverage, unsampled failing templates can leave SCs reading passed or
  inapplicable, and the 3.e/5.a sample record is rebuilt by hand.
- **Root fix:** A typed sample manifest `[{url, tier, source, clusterKey, pageType, inInventory, inScope,
rationale?}]` with a cluster-coverage table and the autoSuggest parameters, sample.json derived from it; disclosures
  for every tier and a rendered sample table (tier, URL, cluster, seed) with the unrepresented-cluster count;
  `perCluster` = pages per cluster across every cluster of each preferred type (discover persists member lists);
  guessPageType anchored on path segments, guessProcessTypes pathname-only, first classifier tests; config-guide
  82-101 corrected, or formCount and canonical actually wired in.
- **Symptom patches this supersedes:** rewording or renaming perCluster without coverage accounting; adding search or
  process-entry to the default preferTypes; a separate processExpansion check; gating relatedUrls on startUrl alone; a
  one-off process-candidates warning; fixing regexes one by one; a sampled-URL list in markdown only.

### A11. Discover link extraction, URL identity and inventory quality — medium

**Root cause:** Partly shared. DISC-07, -09, -20, SAMP-01 and SAMP-02 share a root: inventory entries carry no
validity or identity metadata (status, challenge outcome, redirect source→target), normalizeUrl is both dedupe key and
navigation URL (discover.mjs:306 `req.url = normalized`), Crawlee throws only on 401/403/429 so 404/500/503 pages are
inventoried, and the random pool filters by string equality (sample.mjs:81). The rest are crawl defaults (DISC-15,
-16, -18), config normalisation (DISC-19) and doc drift (DISC-17, -26).

| ID      | Severity | Status | Claim                                                                                                                                                                                                                                                                                                                             | Evidence                                                             | Tier     |
| ------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| DISC-07 | medium   | new    | _(corrected)_ discover never classifies challenges, so a 200 interstitial is inventoried as the homepage. An empty inventory or a 403 on the root is recorded only in inventory-metadata and a log warning, never at report level.                                                                                                | discover.mjs:251, sample.mjs:100                                     | [source] |
| DISC-09 | medium   | new    | The crawler navigates to the normalized, slash-stripped URL. That breaks relative-link resolution and fetches 404s on slash-sensitive servers.                                                                                                                                                                                    | urls.mjs:66, discover.mjs:306                                        | [source] |
| DISC-15 | medium   | new    | Only `a[href]` present at 'load' is enqueued. JS-inserted links, onclick or role=link navigation, `<area>`, iframe src and hash routes are never discovered, and the SPA settle recipe applies only to scan.                                                                                                                      | discover.mjs:286, :249, urls.mjs:45                                  | [source] |
| DISC-16 | medium   | new    | requestDelayMs sleeps per concurrency slot, giving N requests per window. 429 Retry-After is ignored (retries within ~0.5 s), and 503 maintenance pages are inventoried.                                                                                                                                                          | discover.mjs:234, config.schema.json:76, config-guide.md:65          | [source] |
| DISC-17 | medium   | new    | Config-guide drift:<br>• it documents scope.mode 'allow-list', which the schema rejects (the value is allowed-hosts);<br>• it overstates what the discovery probes feed;<br>• it calls sitemap `urls` an override, but the code always takes the union;<br>• it points includeSubdomains at modes that do not include subdomains. | config-guide.md:54, :88, sitemap.mjs:82                              | [source] |
| SAMP-01 | medium   | new    | The random pool excludes structured URLs by literal string, so a structured URL's redirect target can be drawn again. Scan folds it, coverage flips to partial with a "see Scan health" pointer that leads nowhere, and the warning misreports "not in crawl inventory".                                                          | sample.mjs:81, discover.mjs:251, wcag-em-summary.mjs:421             | [source] |
| SAMP-02 | medium   | new    | The random tier draws from every inventory URL, including 404, 500 and soft-404 pages, since no status is recorded. These are audited as content with complete/adequate coverage.                                                                                                                                                 | discover.mjs:266, sample.mjs:50, page-guard.mjs:99                   | [source] |
| DISC-18 | low      | new    | _(corrected)_ No stable userAgent is set, so Crawlee injects a randomised fingerprint UA on every run. Not handling robots.txt is documented operator responsibility.                                                                                                                                                             | crawlee/browser/internals/browser-crawler.js:172, config-guide.md:65 | [source] |
| DISC-19 | low      | new    | _(corrected)_ allowedHosts entries are neither normalised nor validated: case, IDN, scheme, port and wildcard entries silently never match. Ignoring includeSubdomains is documented deprecation.                                                                                                                                 | urls.mjs:195, config.schema.json:41                                  | [probe]  |
| DISC-20 | low      | new    | Only utm*\*, fbclid, gclid and mc*\* are stripped. Session-id variants, `/` vs `/index.html` and canonical-sharing variants split into separate entries, hash routes merge, and normalisation rewrites the query actually sent.                                                                                                   | urls.mjs:24, :62                                                     | [probe]  |
| DISC-26 | low      | new    | The WAF-bypass guidance names `auth.extraHTTPHeaders` in the guide, schema description, d.ts and ADRs. The property is `extraHttpHeaders` and `additionalProperties:false` applies, so a config copied from the guidance fails validation.                                                                                        | config-guide.md:122, config.schema.json:637                          | [source] |

- **Note:** Several `[source]` rows were also observed in round-1 probes (Appendix C: kitchen-sink discover,
  slash-sensitive server, 429/503, random-tier population).
- **Consequence for a WCAG-EM deliverable:** Step 2 exploration silently under- or mis-inventories, and Step 3.e
  random pages can be error pages or duplicates of structured pages, weakening the Step 4.c check.
- **Root fix:** (1) Navigate to the as-linked URL and use normalizeUrl only as uniqueKey; (2) record status, the
  source→final pair and the page-guard outcome per item; (3) route challenged and ≥400 pages to metadata counters, not
  the inventory; (4) summarize warns on an empty or degenerate inventory and on failedRequestCount; (5) sample maps
  structured and process URLs to their final identity before building the pool and excludes ineligible statuses with a
  count. Independent: DISC-15 crawl settle and more link sources; DISC-16 a global rate limit and Retry-After; DISC-18
  a stable identifying UA plus opt-in respectRobotsTxtFile; DISC-19 allowedHosts normalised at load; DISC-17/26 doc
  corrections plus a drift guard on enum values and `auth.*` names.
- **Symptom patches this supersedes:** scan-time redirect folding as the only defence; "not in inventory" warnings for
  redirect sources; counting redirect duplicates as excluded; classifying error pages at scan time after they used a
  random slot; hand-seeding structuredManual; adding tracking-param patterns one at a time.

### A12. Crawl accounting, sitemap walker and document handling — medium

**Root cause:** Partly shared, in two clusters. (1) sitemap.mjs is a regex-over-fetch helper: no XML decoding,
robots.txt or gunzip; no timeout, byte cap, UA or scope check; no failure record; dedup skips conflated with budget
clipping (DISC-10, -11, SEC-13, -21). (2) discover and sample compute crawl and sample-integrity telemetry but write
it only to `inventory/*.json`; summarize reads just maxPagesConfigured and reachedMaxPages, and E1 plan step 1g was
never done (DISC-08, SAMP-13). DISC-12, -13, -21, -24 and -25 have their own causes.

| ID      | Severity         | Status | Claim                                                                                                                                                                                                                                                                                                                   | Evidence                                                                     | Tier     |
| ------- | ---------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| DISC-08 | medium           | new    | Crawl-loss telemetry (failedRequestCount, failureReasons, reachedSitemapCap, neverReached) reaches no report, scanWarning or executionHealth field; E1 step 1g was never implemented. The existing counters also miscount: mailto/tel links land in outOfScopeLinkCount, and documents under excluded paths are listed. | summarize.mjs:236, docs/reviews/2026-06-epics-E1-E7.md:135, discover.mjs:296 | [source] |
| DISC-10 | medium           | new    | Regex `<loc>` extraction:<br>• `&amp;` corrupts query URLs and numeric entities truncate;<br>• CDATA and `sm:`-prefixed sets yield 0 URLs;<br>• prefixed indexes seed their child .xml files as pages;<br>• `.xml.gz` yields 0;<br>• robots.txt `Sitemap:` lines are never read.                                        | sitemap.mjs:119, :120, :117                                                  | [probe]  |
| DISC-11 | medium           | new    | The sitemap fetch has no AbortSignal, so undici's 300 s default applies per document, sequentially: about 10 min against a tarpit on the two default paths. Failures are dropped with `continue` and recorded nowhere, and the UA is 'node'.                                                                            | sitemap.mjs:108, :112                                                        | [probe]  |
| DISC-12 | medium           | new    | _(corrected)_ When sitemap seeds reach maxPages (default 80), the root's own links queue behind them and are never crawled. The loss is limited to pages the sitemap does not list. Alphabetical selection within a leaf is ADR-0018 intent.                                                                            | config.mjs:64, discover.mjs:320, sitemap.mjs:140                             | [source] |
| DISC-25 | medium           | new    | The only discover e2e covers navigation timeouts. Crawl-level scope modes, redirects, status and content type, maxPages accounting and storage location have no behavioural tests, and the page-type classifiers have none at all.                                                                                      | discover-timeout.test.mjs:62, urls.test.mjs:100                              | [source] |
| DISC-13 | low (was medium) | new    | _(corrected)_ Truncated crawls at concurrency > 1 produce run-dependent inventories, so a re-crawl cannot reproduce the pool. The sample actually used is persisted, and `inventoryDeterministic:false` is not flagged.                                                                                                 | discover.mjs:229, crawlee/basic/internals/basic-crawler.js:739               | [source] |
| DISC-21 | low              | new    | The default documentLinkPatterns have no `i` flag. `.PDF` and `.DOCX` links are listed as documents but also crawled as pages (4 attempts each), counted as failures, and charged to the maxPages budget.                                                                                                               | context.mjs:200, discover.mjs:139                                            | [probe]  |
| DISC-24 | low              | new    | failedRequestHandler reads the deprecated `context.error`, so Crawlee prints a deprecation warning on every run that has failures.                                                                                                                                                                                      | discover.mjs:312                                                             | [source] |
| SEC-13  | low              | new    | Sitemap-index children are fetched with no scope check, timeout or size cap, so a hostile site can drive up to 50 blind GETs from the auditor's network.                                                                                                                                                                | sitemap.mjs:122, :108                                                        | [probe]  |
| SEC-21  | low              | new    | reachedSitemapCap is true whenever a URL appears in two sitemaps (`clipped = found − contributed`). Diagnostic only today.                                                                                                                                                                                              | sitemap.mjs:177, :183                                                        | [probe]  |
| SAMP-13 | low              | new    | No Step-3 integrity guards: an empty structured sample, a disabled random tier and an empty final sample all pass silently. The small-site flag ignores reachedMaxPages and is surfaced nowhere.                                                                                                                        | sample.mjs:100, :147                                                         | [source] |

- **Duplicates folded:** DISC-23 → SEC-13 (adds `data:` and link-local protocols).
- **Consequence for a WCAG-EM deliverable:** A Step 2/3 coverage statement cannot distinguish a crawl that lost 30% of
  its pages from a clean one, and seeding silently fails on standard sitemap shapes.
- **Root fix:** (a) A bounded sitemap fetcher: entity, CDATA, namespace-prefix and gzip handling; robots.txt
  `Sitemap:` lines; a timeout, byte cap, the crawler's UA and auth; a scope check on children; `failed[{url,
reason}]`; duplicates counted apart from clipping. (b) A crawl-health section in executionHealth (failure counts and
  reasons, reachedSitemapCap, neverReached, sitemap failures, sample-integrity flags, the small-site flag gated on
  `!reachedMaxPages`) rendered in Scan health and scanWarnings as E1 step 1g planned, with fixture-driven discover e2e
  tests. Separately: DISC-12 root-link priority or a seed cap; DISC-13 a deterministic tail or an
  `inventoryDeterministic` flag; DISC-21 the `i` flag; DISC-24 the `(ctx, error)` handler signature.
- **Symptom patches this supersedes:** a fetch timeout alone; decoding `&amp;` only; changing the reachedSitemapCap
  formula alone; logging the small-site flag; failedRequestCount in markdown only.

### A13. Sampling reproducibility and the synthesized WCAG-EM Step 3-5 record — medium

**Root cause:** Two roots plus two standalone items. (1) There is no single model of the Step 3-5 record built from
the sample's composition and per-page results, so each consumer rebuilds a slice: samplingMethodNotes from counts
(SAMP-05), the 4.c comparison from violation-grouping side effects (VERD-08), coverage keyed on raw `page.url` while
findings fold by viewIdentity (VERD-09, VERD-19), the draft's backlog rebuilt with `inventory: []` (CAP-05), the 5.b
specifics never collected (VERD-10). (2) The seeded sampler has no input validation, canonical pool order or
behavioural tests (SAMP-04, -08, -14, -10). Standalone: CAP-04 is an inverted condition; SAMP-15 is citation drift.

| ID      | Severity | Status             | Claim                                                                                                                                                                                                                                                                                                          | Evidence                                                               | Tier     |
| ------- | -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| SAMP-04 | medium   | new                | _(corrected)_ Seeds of roughly −6 or below drive the LCG state negative, and Fisher–Yates then writes `undefined` into the sample (seed −7 gave 4 distinct pages of 5). randomCount and samplingMethodNotes still report the requested size. The schema accepts any integer; the default seed 1 is unaffected. | sample-utils.mjs:36, config.schema.json:205, sample.mjs:127            | [probe]  |
| SAMP-05 | medium   | new                | The synthesized notes say "10% pool", but the percentage applies to the structured sample and the minimum floor often dominates. They omit crawl truncation and process pages, repeat the requested random count, and are copied verbatim into the draft's `scope.samplingMethod`.                             | wcag-em-summary.mjs:491, sample.mjs:85, report-builder-starter.mjs:493 | [source] |
| SAMP-10 | medium   | new                | The only sampling test checks the missing-from-inventory warning. Four behaviour-breaking mutants (determinism, pool exclusion, size formula, auto-suggest) pass all 517 unit and 8 e2e tests.                                                                                                                 | sample-missing.test.mjs:117, smoke.test.mjs:27                         | [probe]  |
| VERD-08 | medium   | new                | _(corrected)_ The 4.c comparison uses violations only, because tier clusters are filled per violation node. A clean random page from an unrepresented type, or a random-only cantTell, never triggers expansion. group-findings tests do assert the cluster sets; only the summarize assembly is untested.     | summarize.mjs:570, group-findings.mjs:121                              | [source] |
| VERD-09 | medium   | new                | automatedCoverage counts page-views. A redirect-duplicate counts as excluded ("partial", "see Scan health", with nothing there). A page with one errored viewport counts as both audited and excluded (3 + 1 of 3).                                                                                            | wcag-em-summary.mjs:396, :421, markdown.mjs:182                        | [probe]  |
| VERD-10 | medium   | new                | _(corrected)_ wcag-em-summary.json lacks scope, rootUrl, viewports, browser and the rule profile. evaluationDate is summarize time, and atBaseline silently defaults to `[]`. The draft never fills scope.devices, browsers, assistiveTechnologies or exclusions, which render as "Not specified".             | wcag-em-summary.mjs:436, :443, report-builder-starter.mjs:486          | [source] |
| CAP-04  | medium   | new                | The 1.4.11 non-text-contrast reminder is dropped whenever a color-contrast (1.4.3) finding exists, yet axe has no 1.4.11 rule. The docstring states the reverse condition, and a unit test locks the bug in.                                                                                                   | manual-backlog.mjs:84, :10, manual-backlog.test.mjs:28                 | [probe]  |
| CAP-05  | medium   | new                | The draft rebuilds the backlog with `inventory: []` and no screenshots or manualReview. The Forms item, the could-not-audit/PDF queue and the screenshot items never reach the client draft.                                                                                                                   | report-builder-starter.mjs:400, summarize.mjs:677                      | [source] |
| SAMP-08 | low      | new                | "Same seed, same sample" also depends on inventory order, the ICU locale (localeCompare) and crawl nondeterminism, and no pool fingerprint is recorded.                                                                                                                                                        | discover.mjs:323, sample.mjs:86                                        | [probe]  |
| SAMP-14 | low      | new                | The PRNG is the Numerical Recipes LCG (m = 233280), misattributed in its comment to Park–Miller. Joint selections are measurably non-uniform, and seeds alias modulo 233280.                                                                                                                                   | sample-utils.mjs:17, :39                                               | [probe]  |
| SAMP-15 | low      | new                | _(corrected)_ Step citations disagree across the repo (the random sample is labelled 3b and 3c, the comparison 3c). Under WCAG-EM 1.0 the random sample is 3.e, complete processes are 3.d (scan-processes.mjs is correct) and the comparison is 4.c.                                                          | config.schema.json:207, sample-utils.mjs:20, group-findings.mjs:11     | [source] |
| VERD-19 | low      | tracked-open (T-C) | SC examples and pagesExamined key on the pre-redirect URL, while findings use finalUrl.                                                                                                                                                                                                                        | wcag-em-summary.mjs:311, group-findings.mjs:157                        | [source] |

- **Duplicates folded:** SAMP-12 → VERD-08; REPA-10 → VERD-09; VERD-16 → SAMP-05; VERD-17 → CAP-04; REPB-13 → CAP-05;
  DISC-22 → SAMP-08.
- **Consequence for a WCAG-EM deliverable:** The Step 5.a/5.b record misdescribes how the sample was drawn and what it
  covered, and the sample cannot be reproduced across machines from its own metadata.
- **Root fix:** Root 1: the sample stage persists a manifest (URL, tier, redirect fold, inventory fingerprint and
  truncation flag, seed, achieved counts) and every Step 3-5 field derives from it plus results keyed on viewIdentity
  — samplingMethodNotes, the 4.c comparison (rules, outcomes including cantTell, clusters of every random page),
  per-page automatedCoverage with redirect duplicates folded, SC examples, the 5.b specifics; backlog items are built
  once (`summary.manualBacklog`) and read by the draft. Root 2: a validated sampler (reject non-positive seeds,
  code-unit pool sort, a documented PRNG, a pool fingerprint, determinism/exclusion/size tests). Separately: CAP-04
  always keeps the 1.4.11 item (invert its test, fix the docstring), and step anchors are aligned to 3.e, 3.d and 4.c.
- **Symptom patches this supersedes:** rewording "10% pool" or appending a truncation clause; hand-filtering
  'redirect-duplicate' from exclusions; passing inventory into the draft's backlog call; re-keying only SC examples; a
  seed schema minimum without tests; replacing localeCompare only in discover; fixing only the Park–Miller comment;
  editing `@see` anchors one at a time.

### A14. The config contract is wider than the runtime — medium

**Root cause:** The schema and guide grew faster than process-runner.mjs. `$defs/action` is one shared shape requiring
only `action` and allowing every field on every action, and the only schema-to-runtime guard compares action names;
nothing checks that an accepted field has a runtime reader or that each action's required fields are present. That
yields PROC-09, PROC-10, PROC-15 and PROC-20's unsanitised name. SEC-19 is a separate loader weakness; SEC-18, SEC-20
and PROC-16 are independent, and PROC-16 is what let the drift go unnoticed.

| ID      | Severity         | Status | Claim                                                                                                                                                                                                                                                         | Evidence                                                                               | Tier     |
| ------- | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| PROC-09 | medium           | new    | `processes[].stepTimeoutMs` (in the schema, the docs and the example) has never had a runtime reader. The budget is always scan.timeoutMs, and click/fill are capped by Playwright's 30 s default.                                                            | config.schema.json:517, process-runner.mjs:155, user-manual.md:146                     | [probe]  |
| PROC-10 | medium           | new    | `steps[].urlPattern` is compiled but never consulted by runProcessSteps, so steps documented as URL-gated always run. ADR-0005's table is half stale.                                                                                                         | context.mjs:101, config-guide.md:259, ADR-0005:58                                      | [source] |
| PROC-16 | medium           | new    | Every process test uses mocked pages, no e2e runs a non-empty `processes[]`, and expandPattern output is untested. PROC-01/03/06/07/10/12 reproduce only in a real browser.                                                                                   | process-runner.test.mjs:49, scan-cdp.test.mjs:107, test/fixtures/site.json.template:54 | [source] |
| PROC-15 | low (was medium) | new    | _(corrected)_ Malformed steps pass validateConfig: click/fill without a selector, goto without a url or with a relative one, press without a key, field typos, duplicate process names. They fail at runtime as signalled step errors; fail-late, not silent. | config.schema.json:690, process-runner-invariant.test.mjs:38                           | [probe]  |
| PROC-20 | low              | new    | _(corrected)_ An unsanitised step.name escapes the out-dir (`x/../../../ESC` wrote /tmp/ESC\_\_desktop.png). Unnamed screenshot steps, and processes with duplicate names, overwrite each other. PNG-only output is documented behaviour.                     | process-runner.mjs:264                                                                 | [probe]  |
| SEC-18  | low              | new    | The "Config not found" preflight can never fire, because loadConfig reads the file first. The browser-binary check hardcodes ~/.cache/ms-playwright and demands the bundled Chromium even with channel 'chrome'.                                              | context.mjs:171, preflight.mjs:84, browser.mjs:136                                     | [probe]  |
| SEC-19  | low              | new    | deepMerge honours `__proto__` keys: inherited scan.browser and auth values invisibly drive transport and auth, and an invalid inherited key crashes better-ajv-errors. No global pollution; the config is operator-trusted.                                   | config.mjs:219                                                                         | [probe]  |
| SEC-20  | low              | new    | _(corrected)_ There is no env or file indirection for secrets; the guide's "env-substituted secrets workflow" is vague rather than false. The gitignore does not cover nested `configs/**/` paths or .jsonc files.                                            | config-guide.md:187, config.mjs:197                                                    | [source] |

- **Duplicates folded:** VERD-18 → PROC-09; SEC-11 → PROC-09.
- **Consequence for a WCAG-EM deliverable:** Journey definitions that validate can behave differently from what the
  operator wrote (timeouts, URL gating), changing which states get audited.
- **Root fix:** (1) Per-action schema variants (oneOf or if/then) with per-action required fields, a `^[a-z0-9-]+$`
  screenshot name, `additionalProperties:false` on fields[] items and known selector keys; (2) a schema-to-runtime
  field invariant (every accepted property has a consumer or goes through warnSchemaAcceptedRuntimeIgnored); (3)
  honour stepTimeoutMs via setDefaultTimeout, and honour or drop urlPattern; (4) harden deepMerge; (5) one
  real-browser scan-processes e2e. Items 1-2 also enforce unique names and steps-or-pattern.
- **Symptom patches this supersedes:** deleting stepTimeoutMs from the docs; an ADR table note; sanitising step.name
  only at the screenshot path; a warning when stepTimeoutMs is set; special-casing a missing selector.

### A15. Scan stage: axe option composition, page settle, evidence filenames and engine provenance — medium

**Root cause:** Partly shared. For SCAN-05, -17, VERD-11 and SCAN-22, scan.mjs hands config to AxeBuilder without
deriving or recording the effective axe configuration: it chains withRules and withTags (mutually exclusive in the
wrapper), never persists `toolOptions` or `testEngine.version`, stamps the wrapper's version, and no test asserts what
axe ran. For SCAN-10 and -19, evidence filenames come from a non-injective substitution with no hash, length cap or
viewport-id uniqueness check. SCAN-11, -14, -16 and -21 are independent.

| ID      | Severity         | Status | Claim                                                                                                                                                                                                                                                                                                                              | Evidence                                                                                | Tier     |
| ------- | ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| SCAN-05 | medium           | new    | withRules and withTags both overwrite runOnly, and scan calls withRules then withTags (five tags by default). So withRules and per-URL overrides are silently discarded, the documented "disable a rule on one route" recipe cannot work, and there is no disableRules. The error is toward over-inclusion.                        | node_modules/@axe-core/playwright/dist/index.mjs:145, scan.mjs:356, config-guide.md:291 | [probe]  |
| SCAN-10 | medium           | new    | fileSafeFromUrl strips the scheme and collapses runs of non-`[\w.-]` characters to `_`. /a/b, /a_b, /a?b and http vs https therefore map to one file and overwrite each other's evidence, and length is unbounded (a 264-char URL gives a 269-byte name).                                                                          | urls.mjs:79, scan.mjs:58                                                                | [probe]  |
| SCAN-11 | medium           | new    | _(corrected)_ The settle knobs exist (waitUntil, beforeScan waitFor), but the default is domcontentloaded with no settle. The pre-axe screenshot acts as an implicit readiness wait, so toggling screenshots changes results. An iframe that has not loaded yet is dropped silently, because frame-tested is a best-practice rule. | config.mjs:106, node_modules/@axe-core/playwright/dist/index.mjs:304                    | [source] |
| SCAN-22 | medium           | new    | The browser-dependent scan logic is barely tested. The applyAxeOverride test asserts exactly the merged shape that fails at runtime. Nothing tests the effective options, action ordering, screenshot isolation, deadlines or disposal.                                                                                            | scan-runonly.test.mjs:20, axe-utils.test.mjs:90                                         | [source] |
| VERD-11 | medium           | new    | version.mjs stamps @axe-core/playwright's 4.11.2 as "axeCore", but the injected engine is 4.11.3. testEngine.version is discarded, so the true engine version is recorded nowhere.                                                                                                                                                 | version.mjs:8, :56                                                                      | [probe]  |
| SCAN-14 | low (was medium) | new    | _(corrected)_ Violation nodes are uncapped, and the whole run is pretty-printed in one string. The RangeError needs ~500 MB of JSON (~70 views × ~4,000 failing nodes), far beyond typical samples. Latent.                                                                                                                        | scan.mjs:375, fs-utils.mjs:75                                                           | [source] |
| SCAN-16 | low              | new    | _(corrected)_ A shadow-DOM target joins to `host,child`, which reads as a CSS selector list. The iframe form `iframe \| img` is the intended convention.                                                                                                                                                                           | axe-artifact.mjs:39, :63                                                                | [source] |
| SCAN-19 | low              | new    | Duplicate viewport ids are accepted, so page-views become indistinguishable and screenshots overwrite.                                                                                                                                                                                                                             | scan.mjs:58                                                                             | [source] |
| SCAN-21 | low              | new    | ADR-0006 says URL concurrency lives inside a viewport, but the scan is strictly sequential, with no concurrency or throttle setting.                                                                                                                                                                                               | ADR-0006:33, scan.mjs:408                                                               | [source] |
| SCAN-17 | info             | new    | _(corrected)_ Best-practice rules being off by default is documented. What is undocumented: axe's experimental rules (label-content-name-mismatch for 2.5.3, css-orientation-lock for 1.3.4) never run, and the executed rule set is neither recorded nor pinned.                                                                  | config.mjs:124                                                                          | [source] |

- **Duplicates folded:** SCAN-15, REPA-08, REPB-12, CAP-19 → VERD-11; SEC-05 → SCAN-10 (an over-long name fails the
  whole page scan, and process-runner shares the helper); STRESS-06 → SCAN-21 (throughput measurements, Appendix C).
- **Consequence for a WCAG-EM deliverable:** The Step 5.b "tools used" record is wrong (engine version) and the
  effective rule profile is unrecorded, so nothing shows that two runs applied the same tests; evidence images can
  belong to another page.
- **Root fix:** An "effective scan contract": (1) compose axe options explicitly (withRules/withTags mutually
  exclusive in the schema or reconciled into one runOnly with a warning; disableRules/enableRules; toolOptions and
  testEngine.version persisted per page-view; version.mjs resolving axe-core's own package.json); (2) filenames from a
  truncated slug plus a short hash, and unique viewport ids; (3) fixture e2e asserting the effective options and rule
  counts. Separately: a bounded settle before axe independent of screenshots, with frame-tested always on; a per-rule
  node cap keeping nodesCount; explicit shadow-boundary serialisation; an ADR-0006 correction.
- **Symptom patches this supersedes:** fixing only the guide's recipe or reordering the calls; a hard-coded version
  string; a test for one collision pair; counter suffixes; a hand-documented rule list.

### A16. Human reports (HTML/Markdown): rendering safety, evidence and disclosure parity — medium

**Root cause:** html.mjs and markdown.mjs each assemble their sections and escaping directly from `summary`: there is
no shared report model, section-parity contract or single escaping policy. Features added to one drift from the other
(the E1 coverage line exists only in markdown, the D4 SC table only in HTML), rich summary.json data is never
projected, and the screenshot join uses a different URL identity from the findings. REPA-09/CAP-09 (docs) and
REPA-07/REPA-15 (tests) are independent; REPA-06 stays hidden only because of REPA-07.

| ID      | Severity         | Status             | Claim                                                                                                                                                                                                                                                                                                            | Evidence                                             | Tier     |
| ------- | ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| REPA-01 | medium           | new                | _(corrected)_ About 18 of 104 axe help strings, plus Playwright error text, are written unescaped into summary.md, and multi-line errors split list items. In HTML pass-through renderers a literal `<title>`, `<textarea>` or `<script>` swallows the findings that follow; GFM's tagfilter blocks those three. | markdown.mjs:205, :97, :120                          | [probe]  |
| REPA-02 | medium           | new                | html.mjs never reads automatedCoverage, the comparison or scanWarnings; E1 wired coverage into markdown only. summary.md has no per-SC table. Neither report shows wcagVersion, the target, the evaluator, sampling notes, scope, viewports or the axe tags.                                                     | html.mjs:161, markdown.mjs:180, user-manual.md:84    | [probe]  |
| REPA-03 | medium           | new                | Violations show only impact, classification, page count, help and `targets[0]`. pages, examples[].html, failureSummary, wcagCriteria, occurrences and sourceTypes are never rendered, and `targets[0]` and the screenshot page are chosen independently.                                                         | html.mjs:293, :344, markdown.mjs:201                 | [probe]  |
| REPA-06 | medium           | new                | The HTML report fails 1.4.10 at 320 CSS px, because code URLs and helpUrl text do not wrap. It has no `<main>` and no viewport meta, and findings are `<details>` rather than headings.                                                                                                                          | html.mjs:73, :113, :117                              | [source] |
| REPA-09 | medium           | new                | The docs say summary.html is standalone with embedded screenshots. In fact images are relative `../screenshots/…` refs, and the documented CI recipe uploads only reports/, so every image breaks.                                                                                                               | html.mjs:308, user-manual.md:85, integrations.md:132 | [source] |
| REPA-07 | low              | new                | The HTML self-axe test keeps only color-contrast violations, runs with `<details>` closed, and uses a fixture without the SC table, Scan health or needs-review sections.                                                                                                                                        | reporters-html-axe.test.mjs:120, :124                | [source] |
| REPA-13 | low              | new                | The HTML screenshot lookup keys on the requested URL while findings use viewIdentity, so redirected pages lose their screenshot.                                                                                                                                                                                 | html.mjs:412, summarize.mjs:674                      | [probe]  |
| REPA-14 | low              | new                | mdInlineCode turns backticks into apostrophes, so a reported selector such as ``#q\`w`` selects nothing when pasted into devtools.                                                                                                                                                                               | markdown.mjs:51                                      | [probe]  |
| REPA-15 | low              | new                | Reporter isolation works, but its catch branch is untested, and a failed reporter leaves no trace in any artefact.                                                                                                                                                                                               | reporters/index.mjs:115, reporters-json.test.mjs:135 | [source] |
| REPA-17 | low              | tracked-open (T-B) | Best-practice findings share the "Grouped findings by rule" list with WCAG failures, sorted by impact, so serious advisory rules rank above WCAG failures.                                                                                                                                                       | html.mjs:279, markdown.mjs:197                       | [source] |
| VERD-14 | low              | new                | The default reporters are json and markdown, and markdown has no per-SC table, so by default the Step 5.a outcome record exists only as JSON. The user manual still points readers at summary.html.                                                                                                              | summarize.mjs:634, markdown.mjs:193                  | [source] |
| CAP-09  | low (was medium) | new                | _(corrected; the broken-image half is REPA-09)_ There are no per-finding element crops, highlights or accessibility-tree evidence. The practice evidence standard is met by the code snippets already carried.                                                                                                   | html.mjs:308, scan.mjs:316                           | [source] |

- **Consequence for a WCAG-EM deliverable:** The primary client-facing report cannot serve as a self-contained Step 5
  record — no coverage status beside the SC verdicts, no target, version or method, no per-violation location or
  reason — and it fails AA reflow itself.
- **Root fix:** One shared human-report model rendered by both reporters: a fixed section set (scope/method, coverage
  status, comparison, per-SC table with notTested, WCAG findings, then a separate advisory section); per rule the SC,
  capped pages and 1-3 examples (page, target, snippet, failureSummary) with the screenshot looked up by viewIdentity
  from the same page; `mdText()` escaping for all free text, fenced multi-line errors, variable-length backtick
  fences; a parity test. Separately: correct the docs/CI recipe; add `<main>`, a viewport meta and overflow-wrap to
  the HTML shell; run self-axe on a maximal fixture with details open plus a 320px scrollWidth check; add a
  throwing-reporter isolation test.
- **Symptom patches this supersedes:** automatedCoverage in html only or an SC table in markdown only; failureSummary
  added per reporter; escaping only `help`; switching the screenshot key alone; a different replacement character; a
  best-practice heading in one reporter.

### A17. EARL/JUnit semantics and portal/draft identity stability — medium

**Root cause:** The single-root triage hypothesis is overstated; two partial roots explain seven findings. (1) The
machine reporters are built from the lossy, rule-grouped `summary.findings[]` rather than per-(page, rule) data
(REPB-06, -08, -09). (2) There is no stable run or finding identity (REPB-15, -16, CAP-18). REPB-05, -07, -14, -17,
-18 and -20 are independent local defects.

| ID      | Severity         | Status             | Claim                                                                                                                                                                                                                                                       | Evidence                                                                    | Tier     |
| ------- | ---------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| REPB-05 | medium           | new                | stripControlPattern removes only C0 controls. U+FFFE/U+FFFF from page markup make junit.xml unparseable, and the `<error>` CDATA path skips sanitisation altogether.                                                                                        | junit.mjs:251, :239, :143                                                   | [probe]  |
| REPB-06 | medium           | new                | EARL and JUnit emit one assertion per page but reuse the finding's global `targets[0]` (and, in JUnit, `examples[0].html`). The pointer on page B is often an element that exists only on page A.                                                           | earl-jsonld.mjs:76, junit.mjs:60, :61                                       | [probe]  |
| REPB-08 | medium           | new                | _(corrected)_ Emitting SC-level passes only is ADR-0009 design. But the consumer roll-up ADR-0009 assumes is impossible, because rule assertions carry no SC link: with includePasses the document shows SC passes beside SC-less failures.                 | earl-jsonld.mjs:123, :214                                                   | [source] |
| REPB-09 | medium           | new                | JUnit renders pagesFailed and pagesDegraded as `<error>` but ignores pagesUnauditable, and EARL has no unauditable subjects. A challenge-blocked page therefore reads as nothing, despite the integrations guide's promise that it reads as an error.       | junit.mjs:134, integrations.md:117                                          | [probe]  |
| REPB-07 | low (was medium) | new                | _(corrected)_ The @context is prefix-only, so outcomes, modes, subjects and tests expand to literals, and earl:Result and earl:Evaluation are not EARL 1.0 classes. ADR-0009 takes a JSON.parse-first stance, and no consumer in the pipeline reads RDF.    | earl-jsonld.mjs:139, :172, :146                                             | [source] |
| REPB-14 | low              | tracked-open (T-B) | Portal manual-review occurrenceCount is the capped instance count (25 per view per rule); the true nodesCount appears nowhere in the row.                                                                                                                   | portal-export.mjs:273, :415                                                 | [source] |
| REPB-15 | low              | tracked-open (T-K) | scanMetadata.timestamp and EARL dct:date are summarize time, so re-summarising produces a new portal fingerprint and a duplicate scan.                                                                                                                      | portal-export.mjs:513, portal:scans/ingestion/utils/fingerprint.ts:29       | [source] |
| REPB-16 | low              | new                | rawFinding.selector is the first node met in scan order, and the portal hashes it into both the fingerprint and customizationKey, so identities churn across re-audits.                                                                                     | portal-export.mjs:335, portal:reports/report-issue-extractor.service.ts:603 | [source] |
| REPB-17 | low              | new                | portal-export has no size budget, while the portal stores rawFindings in one MongoDB document (16 MiB limit). A synthetic large audit produced 13.36 MiB.                                                                                                   | portal-export.mjs:299, portal:scans/scans.service.ts:466                    | [source] |
| REPB-18 | low              | new                | _(corrected)_ Screenshot paths are stored absolute and re-based per reporter, so a moved run breaks the report-builder build ("Screenshot evidence file not found"). sourceFolder is load-bearing, so the fix is relative paths, not dropping sourceFolder. | report-builder-starter.mjs:193, :514                                        | [source] |
| REPB-20 | low              | new                | JUnit polish: `url##selector` case names, `time="0"`, no timestamp or properties, and no failureSummary.                                                                                                                                                    | junit.mjs:70, :154, :233                                                    | [probe]  |
| CAP-18  | low (was medium) | new                | _(corrected)_ Draft IDs come from a positional counter, so a retest renumbers them. The draft is a human-confirmed starter that carries sourceRuleId, so the cost is manual cross-walking, not silent mis-marking.                                          | report-builder-starter.mjs:313, integrations.md:54                          | [source] |

- **Consequence for a WCAG-EM deliverable:** CI and machine consumers get locator claims that are false for their
  subject, blocked pages vanish from JUnit and EARL, and portal/draft identities do not survive re-audits, which
  blocks baseline and retest workflows.
- **Root fix:** (a) A per-(url, viewport, rule) index built from axe-results and process-results (the loader
  portal-export's loadInstanceMap already uses): EARL and JUnit take each page's own pointer and HTML, carry the SC
  mapping, and emit pagesUnauditable as error/cantTell subjects. (b) The T-K envelope's scan timestamps become
  scanMetadata.timestamp and dct:date; a deterministic per-finding `sourceFingerprint` (ruleId | findingKind | sorted
  SCs) goes into portal-export and the draft, and draft IDs derive from it (the T-M prerequisite). (c) One XML
  sanitiser covering the full XML 1.0 Char production on every sink. REPB-07, -14, -17, -18 and -20 stay local fixes.
- **Symptom patches this supersedes:** per-reporter "first example matching pageUrl" swaps; pagesUnauditable bolted
  onto JUnit only; ad-hoc timestamp overrides; sorting selectors without emitting sourceFingerprint; hand-maintained
  ID cross-walks; adding only U+FFFE/U+FFFF to the strip set.

### A18. Claimed-absent capabilities — medium

**Root cause:** No single root: two loose clusters plus independent items. (1) Page-view pipeline: `newContext` is
hard-wired to `{viewport, ...auth}` and the 7-verb DSL is the only way to change page state, so nothing sets emulation
state or takes a non-axe measurement after render (CAP-07, CAP-08, SCAN-12, PROC-14). (2) Output projections: no
standards map, statement or Report Tool projection, and no CSV/SARIF, a declared ADR-0011 boundary (CAP-13, -14, -15,
-20). CAP-10, -12 and -16 are independent. Output stays honest throughout (1.4.10, 2.1.2 and 2.4.7 notTested;
documents and reflow to the backlog); the one data-loss defect is CAP-13's draft scope fill.

| ID      | Severity         | Status | Claim                                                                                                                                                                                                                                                                                                                   | Evidence                                                                        | Tier     |
| ------- | ---------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| CAP-07  | medium           | new    | The default 320px "reflow" viewport only re-runs axe. There is no scrollWidth/clientWidth overflow check, no 1.4.12 spacing injection and no 1.4.4 zoom pass, so 1.4.10 is always notTested and every page is queued to eyeball.                                                                                        | viewports.mjs:23, config-guide.md:342, scan.mjs:368                             | [source] |
| CAP-08  | medium           | new    | _(corrected)_ There are no automated keyboard or focus signals: tab order, trap detection, focus-indicator deltas, pointer-only candidates, auto-updating regions. Focus states are reachable with press plus an axe step; only hover-without-activation is unreachable. The DSL half is PROC-14.                       | config.schema.json:1, process-runner.mjs:225                                    | [source] |
| CAP-13  | medium           | new    | No accessibility statement or Step 5.c evaluation statement is produced. The wcagEm config cannot record the 1.a scope, 1.d additional requirements, third-party content or the commissioner. The draft's scope.exclusions, devices, browsers and assistiveTechnologies are never filled, and atBaseline is not mapped. | config.schema.json:662, report-builder-starter.mjs:487, wcag-em-summary.mjs:443 | [source] |
| SCAN-12 | medium           | new    | _(corrected)_ There are no emulation controls (reducedMotion, colorScheme, locale/timezone, isMobile/hasTouch), so dark-scheme contrast is never tested and output depends on the host's locale. Mid-animation "1:1 contrast" noise has a beforeScan waitFor workaround and lands as needs-review.                      | browser.mjs:219                                                                 | [source] |
| PROC-14 | medium           | new    | The seven-action DSL has no selectOption, check, hover, focus, setInputFiles, frame targeting, waitForURL/LoadState, expect or dialog handling, and `press` acts on whatever has focus.                                                                                                                                 | process-runner.mjs:42, :235                                                     | [source] |
| CAP-10  | low (was medium) | new    | _(corrected)_ Component grouping keys on the first token of axe's page-local selector, so one template element splits into several components (e.g. `selector:img` vs `img[src$="logo.png"]`). ADR-0012 calls this "crude by design". Only the secondary view is affected, and there is no templateLikely flag.         | urls.mjs:164, group-findings.mjs:128                                            | [source] |
| CAP-12  | low (was medium) | new    | The document inventory is `{url, type}` from an extension regex. There is no PDF triage (tagged, /Lang, /Title, text layer), no linking page and no content-type detection.                                                                                                                                             | discover.mjs:139, :362, manual-backlog.mjs:192                                  | [source] |
| CAP-14  | low              | new    | No EN 301 549 clause or Section 508 mapping on findings or criteria outcomes.                                                                                                                                                                                                                                           | wcag-em-summary.mjs:10, wcag-sc-names.json:1                                    | [source] |
| CAP-15  | low              | new    | _(corrected)_ There is no W3C WCAG-EM Report Tool import/export shape. Rule-keyed EARL is ADR-0009 design, and notTested is T-J. The Report Tool's format details were not verified.                                                                                                                                    | earl-jsonld.mjs:83, ADR-0009:87                                                 | [source] |
| CAP-16  | low              | new    | axe-core is the only engine, so there is no cross-engine agreement signal.                                                                                                                                                                                                                                              | scan.mjs:352, package.json:1                                                    | [source] |

- **Intended member:** CAP-20 (Appendix A). Duplicates folded: SCAN-18 → CAP-07 (viewport width and height are not
  stored in results). Value, effort and tracking are in §4.
- **Consequence for a WCAG-EM deliverable:** Cheap, reliable signals (overflow at 320px, keyboard traps, PDF tagging)
  go uncollected, so the manual phase starts from zero on exactly the SCs that fail most, and the statement
  deliverable is assembled by hand.
- **Root fix:** Cluster 1: one page-view hook — a validated `scan.emulation` block applied through newContext
  (emulateMedia on CDP) and an opt-in `scan.measure`/interaction probe that records overflow at ≤320px, tab order,
  traps, focus style and pointer-only candidates as cantTell evidence, never passes; DISPATCH_ACTIONS and the schema
  extended together. Cluster 2: a vendored `standards-map.json`, a statement-inputs projection (verdicts from T-L),
  and the draft's `scope.*` filled from data already held; CSV/SARIF and the Report Tool revisited with ADR-0011.
  Separate backlog: CAP-10 a stable fingerprint plus templateLikely; CAP-12 bounded PDF triage; CAP-16 a second engine
  behind T-N.
- **Symptom patches this supersedes:** per-verb DSL additions and per-signal probes that bypass the shared hook. The
  atBaseline → assistiveTechnologies mapping is a legitimate one-line quick fix on its own.

### A19. Supply chain, CDP transport, bot-identity spike and doc/data drift — medium

**Root cause:** Mostly no shared code root. The common thread is that nothing mechanical catches drift outside the
audit data path: a non-blocking audit with no Dependabot or CodeQL, no docs-link or data-vs-source drift checks, and
spike tooling that reached production without the review bar applied to `src/`. SEC-14, SEC-15 and PROC-18 share a
separate root: the transport is not first-class run metadata or documented procedure.

| ID      | Severity | Status              | Claim                                                                                                                                                                                                                                                                                                | Evidence                                                                                                             | Tier     |
| ------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| SEC-09  | medium   | new                 | _(corrected)_ The non-blocking npm audit is documented intent, but nothing surfaces drift. Production advisories went from 0 (per TODO.md:98) to 20, 7 of them high. There is no Dependabot, CodeQL, gitleaks or SHA pinning. Exploitability in a local CLI has not been shown.                      | ci.yml:59, ci.yml:35, TODO.md:98                                                                                     | [probe]  |
| SEC-10  | medium   | new                 | The deployed cf-worker "about" page (the bot documentation URL) and the README's submission text both say the auditor "Respects robots.txt". No code reads robots.txt, and respectRobotsTxtFile is unset.                                                                                            | spikes/web-bot-auth/cf-worker/worker.mjs:53, spikes/web-bot-auth/README.md:188, ADR-0021:166                         | [probe]  |
| VERD-12 | medium   | tracked-open (T-Q)  | _(corrected)_ act-rule-map.json diverges from axe 4.11.3's `getRules().actIds`: 6 entries differ and 22 are unmapped, with aria-valid-attr-value a clear substitution. src/data/README.md falsely says axe does not expose ACT IDs and that the refresh script works (it throws "parser is a stub"). | act-rule-map.json:17, src/data/README.md:24, refresh-rule-maps.mjs:124                                               | [probe]  |
| SEC-14  | low      | new                 | WCAG_EM_CDP_ENDPOINT silently switches a run to CDP attach. No info line and no artefact records the transport or engine, contrary to ADR-0021's disclosure expectation.                                                                                                                             | browser.mjs:87, scan.mjs:202, ADR-0021:147                                                                           | [source] |
| SEC-15  | low      | new                 | The CDP docs give no `--user-data-dir` isolation guidance, so the operator's everyday profile can be reused; Chrome 136+ refuses the default profile anyway. The CDP example config sets `headless:true`, which is ignored.                                                                          | user-manual.md:145, browser.mjs:202, example-site-with-cdp.json:13                                                   | [source] |
| SEC-16  | low      | new                 | Spike key footguns: WBA_PRIVATE_JWK is read as a path, so setting it to the key content prints the private JWK to stderr. `npm run spike` overwrites .keys/private.jwk, the runbook's cleanup deletes the production key location, and .dev.vars is not gitignored.                                  | spikes/web-bot-auth/serve-directory.mjs:44, spikes/web-bot-auth/round-trip.mjs:71, spikes/web-bot-auth/README.md:248 | [source] |
| SEC-17  | low      | new                 | The production cf-worker has no lockfile and echoes internal errors publicly. Single-key rotation is an open ADR-0021 question (T-A).                                                                                                                                                                | spikes/web-bot-auth/cf-worker/worker.mjs:125, :104, spikes/web-bot-auth/cf-worker/package.json:8                     | [source] |
| VERD-13 | low      | new                 | act-rule-map.json is read via `URL.pathname`. Paths with spaces or non-ASCII characters, and Windows paths, give ENOENT, which readJsonMaybe turns into `{}`: ACT enrichment disappears with only a debug log.                                                                                       | summarize.mjs:381, fs-utils.mjs:111                                                                                  | [source] |
| CAP-22  | low      | new                 | urls.mjs links `0012-extensibility-is-internal-for-v1.md`; the file is `0012-extensibility-is-internal.md`.                                                                                                                                                                                          | urls.mjs:18, ADR-0012:80                                                                                             | [probe]  |
| REPA-11 | low      | tracked-stale (T-B) | The board and CHANGELOG say the Σ-nodesCount occurrences are shown in html and markdown; neither renders them. The real same-name collision is report-builder's occurrenceCount (not deduplicated) against the portal's (deduplicated).                                                              | CHANGELOG.md:245, report-builder-starter.mjs:223                                                                     | [probe]  |
| REPA-16 | low      | new                 | ADR-0008 still says "five" reporters and omits the portal and report-builder outputs. Its includePasses definition does not match the HTML "Passing criteria", and the registry comment is garbled.                                                                                                  | ADR-0008:39, reporters/index.mjs:65                                                                                  | [probe]  |

- **Intended member:** PROC-18 (Appendix A).
- **Consequence for a WCAG-EM deliverable:** ACT attributions are partly wrong, or silently absent on common install
  paths; the access method (CDP attach) cannot be verified after the fact; and a public representation to Cloudflare
  and site owners (robots.txt) is currently untrue.
- **Root fix:** (1) CI hygiene: Dependabot for npm and actions, a blocking `npm audit --omit=dev --audit-level=high`
  or a dated allowlist, SHA-pinned actions, a cf-worker lockfile. (2) A drift-guard suite: docs/adr path resolution;
  act-rule-map vs `getRules().actIds` (better: derive at runtime and retire the stub, which closes T-Q); ADR reporter
  counts vs `listReporters()`. (3) The transport in run metadata (log line, executionHealth, client disclosure). (4) A
  claims review before promoting spike artefacts: implement respectRobotsTxtFile or remove the claim; fix the key-env
  naming, cleanup and regeneration paths. VERD-13 is a separate one-line fix (`fileURLToPath`).
- **Symptom patches this supersedes:** fixing the 0012 filename by hand; hand-editing five map entries; editing the
  T-B CHANGELOG line or ADR-0008's "five"; a one-off `npm audit fix`; deleting the robots line without a claims
  review.

### B01. Effective axe rule profile and config merge/validation — medium

**Root cause:** Two related roots. (1) There is no single "effective config" contract: deepMerge (arrays replace
wholesale; null/undefined → default) runs before Ajv, which validates only the merged object; the raw file is never
validated or rendered; the public validateConfig expects a merged object that no public helper produces;
non-validation load errors bypass the human-readable path (OPS-01 doc half, OPS-04, OPS-05, OPS-06 code frame). (2)
The effective axe profile is built in two places and never checked against the target or recorded (OPS-01 guard;
E2E-02 = VERD-07/PROC-03; a sibling of SCAN-04). Most of OPS-06 is independent DX.

| ID     | Severity          | Status | Claim                                                                                                                                                                                                                                                                                                                                            | Evidence                                                    | Tier    |
| ------ | ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------- |
| OPS-01 | medium (was high) | new    | _(corrected)_ The README's withTags example `["wcag2aa","best-practice"]` replaces the whole default profile, because arrays replace wholesale (undocumented). Level-A and wcag22aa rules vanish (image-alt, label, target-size), and 1.1.1 and 4.1.2 go from failed to notTested while coverage still says "complete". Nothing flips to passed. | README.md:75, config.mjs:213, config-guide.md:153           | [probe] |
| OPS-04 | low (was medium)  | new    | _(corrected)_ Explicit nulls bypass Ajv because deepMerge (`override ?? base`) runs first, so they silently become the documented conservative defaults, contrary to ADR-0005. There is no false-claim path.                                                                                                                                     | config.mjs:213, context.mjs:175, ADR-0005:27                | [probe] |
| OPS-05 | low               | new    | _(corrected)_ The public validateConfig expects the post-merge shape, but no merge helper is exported, so embedders cannot reproduce what the CLI accepts. config-guide overstates the required sections, and index.d.ts omits browserTransportAware. The argv fallback is documented.                                                           | src/index.mjs:20, config.mjs:193, src/types/index.d.ts:5    | [probe] |
| OPS-06 | low               | new    | A JSON syntax error, a UTF-8 BOM, a missing `--config`, running scan before sample, or a bad `--log-level` all surface as raw pino stack dumps. Ajv code frames show the merged config rather than the operator's file. Omitting `--config` inside a checkout silently audits example.com.                                                       | bin/wcag-em.mjs:99, config.mjs:198, validate-config.mjs:130 | [probe] |

- **Duplicates folded:** E2E-02 → VERD-07 (see A04).
- **Consequence for a WCAG-EM deliverable:** The rule profile an audit actually ran can diverge from the declared
  conformance target with no artefact recording it, so "tested against WCAG 2.2 AA" can be untrue by configuration
  alone.
- **Root fix:** (a) One `resolveAxeProfile(config, url)` used by scan.mjs and the process runAxe; tags and ids
  validated against `axe.getRules()` at load; a warning when the tag set omits a level implied by target plus version;
  the effective tags and rules stamped into summary.json and wcag-em-summary.json. (b) A reworked load pipeline: strip
  the BOM, parse inside a ConfigLoadError, validate the raw user JSON against an all-optional schema variant that
  rejects explicit null, then merge; render Ajv frames against the raw text; export `loadAndValidateConfig`; document
  array replacement and add an additive `extraTags`.
- **Symptom patches this supersedes:** editing only the README; a one-off wcag2a check; hard-coded tags in the process
  runAxe; keeping nulls in deepMerge without raw validation; per-command "run sample first" messages;
  browserTransportAware in the d.ts alone (worth doing, but a typing fix).

### B03. Side-effects on the capture path, Crawlee proxy defaults, and aggregation that loses provenance — medium

**Root cause:** Three independent sub-roots. (1) Capture ordering: page.screenshot runs before axe on the critical
path, inheriting Playwright defaults that mutate the DOM (`caret:'hide'` leaves `style=""`) and block without a bound
(the font/load wait); discover inherits Crawlee's implicit `waitUntil 'load'`. (2) A dependency default:
@crawlee/browser-pool's module-level proxy-chain server binds `*:port` with upstream sockets that are not unref'd, and
the CLI waits for the event loop to drain. (3) Aggregation drops the viewport, cannot see closed shadow roots, and
lets each reporter decide the failure status of best-practice findings.

| ID        | Severity | Status | Claim                                                                                                                                                                                                                                                                                                                                                              | Evidence                                                                                | Tier     |
| --------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------- |
| E2E-01    | medium   | new    | _(corrected)_ The pre-axe screenshot (default `caret:'hide'`) adds `style=""` to form fields, which makes avoid-inline-spacing applicable and passing. The 1.4.12 verdict flips from inapplicable to passed only when no sampled view has a real inline style, but per-page pass evidence is fabricated on any page with an input (portal 55 → 58 in the fixture). | scan.mjs:315, process-runner.mjs:266, wcag-em-summary.mjs:513                           | [probe]  |
| STRESS-03 | medium   | new    | Both stages effectively wait for 'load'. A stalled pixel, font or iframe drops the page from discover (4 × navigation timeout) and fails the scan screenshot (30 s font wait), so axe never runs. On the root URL the inventory comes back empty.                                                                                                                  | crawlee/browser/internals/browser-crawler.js:326, discover.mjs:234, scan.mjs:315        | [probe]  |
| STRESS-01 | medium   | new    | Crawlee's in-process proxy keeps header-pending upstream sockets alive after the browser closes. Because the CLI waits for the event loop, discover and audit log "done" and never exit, and the exit code is never delivered, while any upstream withholds headers.                                                                                               | crawlee/browser-pool/proxy-server.js:5, bin/wcag-em.mjs:96, discover.mjs:24             | [source] |
| STRESS-02 | medium   | new    | The proxy-chain singleton listens on all interfaces, unauthenticated, from module load. A LAN peer can relay through it, including to the auditor's 127.0.0.1-only services; the same-host test returned a loopback-only secret.                                                                                                                                   | crawlee/browser-pool/proxy-server.js:5, :9, node_modules/proxy-chain/dist/server.js:568 | [probe]  |
| STRESS-05 | medium   | new    | Closed shadow roots are invisible to axe and go undetected. A closed widget with 5 real barriers gave 0 violations and 8 passes, where open mode gave 5 violations. CDP exposes closed roots cheaply.                                                                                                                                                              | scan.mjs:352, reporters/json.mjs:16                                                     | [probe]  |
| E2E-03    | medium   | new    | The viewport is recorded per page-view, then dropped by every downstream artefact, so a 320px-only violation reads as a plain page defect. SC examples append once per view, so the same page repeats.                                                                                                                                                             | group-findings.mjs:112, wcag-em-summary.mjs:258, portal-export.mjs:299                  | [source] |
| OPS-10    | low      | new    | `fullPageScreenshots:false` disables page screenshots entirely, but only shrinks process screenshots to the viewport. Neither the schema nor the guide says so.                                                                                                                                                                                                    | scan.mjs:314, process-runner.mjs:268, config-guide.md:120                               | [source] |
| E2E-05    | low      | new    | JUnit fails best-practice findings and the draft counts them as "Automated findings", while the portal classes them as manual review. A best-practice-only run exits 0, scores 100 in the portal and shows red in JUnit.                                                                                                                                           | junit.mjs:65, report-builder-starter.mjs:478, portal-export.mjs:362                     | [source] |

- **Duplicates folded:** STRESS-06 → SCAN-21 (measurements, Appendix C); E2E-07 → VERD-01 (see A01).
- **Consequence for a WCAG-EM deliverable:** The audited DOM is not the served DOM (fabricated 1.4.12 evidence),
  closed-shadow widgets and responsive-only barriers are silently misreported, and a CI job can hang past its own exit
  code.
- **Root fix:** (1) Non-mutating capture off the critical path: axe first, then the screenshot in its own try/catch
  with an explicit timeout and `caret:'initial'`, recording screenshotError, in scan.mjs and process-runner; discover
  sets `waitUntil:'domcontentloaded'` in a preNavigationHook. Combined with A05(f), the screenshot runs after setup
  and after axe. (2) Exit explicitly in asHandler after the logger flushes; pin the local proxy to 127.0.0.1
  (patch-package or upstream) with a no-non-loopback-LISTEN test. (3) Keep `viewports[]` through grouping, SC examples
  and instances; one shared isFailure/classification helper; detect closed shadow roots over CDP and route those pages
  to manual review.
- **Symptom patches this supersedes:** `caret:'initial'` alone; isolating the screenshot alone; a doc note on
  fullPageScreenshots; per-reporter JUnit best-practice handling; a 3.3.2-vs-4.1.2 guard; a "run discover only on
  trusted networks" note (acceptable as an interim).

### B04. Test-suite adequacy: surviving mutants, unexecuted risky branches, weak invariant guards — medium

**Root cause:** The gate measures whether lines execute, not whether behaviour is checked. Fixtures reach the risky
paths without distinguishing data (incompletes without examples, no status 429, an empty process-results fixture, no
HTML fixture with executionHealth, single-viewport e2e); invariant guards match source text; the artefact seam is
typed `any`; there is no mutation check and coverage floors are not enforced (T-D). Round-1 defects were encoded as
expected values unnoticed.

| ID      | Severity | Status | Claim                                                                                                                                                                                                                                                                                                                                                                               | Evidence                                                                                     | Tier     |
| ------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| TEST-01 | medium   | new    | _(corrected)_ Of 19 behaviour-changing mutants, 13 were killed. Three non-equivalent survivors remain: summarize dropping needs-review example HTML, 429 removed from challenge corroboration, and Math.min for the random-tier size. The process-level guard mutant is effectively equivalent for toolkit-produced artefacts, because errored processes always carry `states: []`. | summarize.mjs:458, page-guard.mjs:87, sample.mjs:85                                          | [probe]  |
| TEST-02 | medium   | new    | Coverage over unit plus e2e (525/525) headlines 97.89%/83.83%, a figure that includes the test files themselves. Risky ranges that never execute: the HTML Scan-health list (html.mjs:212-246), portal process-instance extraction, challenge auto-clear, crawl-level exclude filters, and the storageState gitignore warning.                                                      | html.mjs:212, portal-export.mjs:290, scan.mjs:239                                            | [probe]  |
| TEST-05 | medium   | new    | _(corrected)_ The default two-viewport run and CLI-level auth are never exercised end to end. reporters-smoke asserts exit 2 and the shape of the outputs, never rule ids or SC outcomes, and its name still says 5 reporters.                                                                                                                                                      | viewports.mjs:36, authenticated-scan.test.mjs:10, reporters-smoke.test.mjs:134               | [source] |
| TEST-03 | low      | new    | The source-text invariants check only that an identifier appears somewhere in the file. Deleting one of the three guards in wcag-em-summary.mjs still passes, and indirect reads and non-`.locator(` APIs are invisible to them.                                                                                                                                                    | scan-results-consumers-invariant.test.mjs:29, :54, discover-no-locator-invariant.test.mjs:68 | [probe]  |
| TEST-04 | low      | new    | _(corrected)_ version.test pins VERD-11, and the notTested count pins 4.1.1 (VERD-04), so the fixes must invert both. The default-port strip in normalizeUrl is unreachable, because WHATWG URL already strips default ports, so its tests pass for the wrong reason.                                                                                                               | version.test.mjs:45, wcag-em-summary.test.mjs:440, urls.mjs:51                               | [probe]  |
| TEST-11 | low      | new    | There is no typedef for page-view or process-state entries, and consumers take `any` (84 annotations in `src/`), so strict tsc cannot catch producer/consumer field drift.                                                                                                                                                                                                          | scan-results.mjs:48, group-findings.mjs:50, fs-utils.mjs:106                                 | [source] |
| TEST-12 | low      | new    | _(corrected)_ Three throttle tests assert real-timer upper bounds (<20 ms), and runChild is duplicated in 6 e2e files. The "assertion-free" test is an intentional no-throw contract.                                                                                                                                                                                               | discover-throttle.test.mjs:34, scan-redirect.test.mjs:54                                     | [source] |

- **Consequence for a WCAG-EM deliverable:** Every high finding in this review shipped with the gate green; the
  verdict and evidence paths most likely to regress are the least behaviourally asserted.
- **Root fix:** A behaviour-first contract at the artefact seam: (1) a shared typed fixture builder
  (PageViewResult/ProcessState typedefs in scan-results.mjs) emitting every distinguishing variant with residual rule
  data, incompletes with examples, processes with states and two viewports; (2) that fixture fed through every
  consumer with outcome assertions, the greps kept only as tripwires; (3) a default two-viewport e2e asserting rule
  ids and SC outcomes across reporters (T-I); (4) an occasional scripted mutation smoke over the verdict and evidence
  functions, with coverage floors on `src/` only (T-D).
- **Symptom patches this supersedes:** the 15 point patches the packet lists, among them an errored-process test,
  incomplete examples, a 429 case, a sample.run size test, `html` in the scan-health e2e, inverted pinning tests, a
  CLI auth e2e, `mock.timers` and moving runChild.

### B05. Release, CI, platform and documentation governance drift — medium

**Root cause:** Mostly one process gap: the governance docs (ADR-0001/0003/0015, README, CONTRIBUTING, guides)
describe mechanisms designed but never built or kept in sync — tag-triggered CI, Dependabot, npm publish, version
bumps, checkJs, signal cleanup, a stdout summary — and the doc guards check presence, not truth. OPS-02 and OPS-11
share a code root (legacy standalone entry points with a non-portable main-module guard and `URL.pathname` paths).
OPS-13 and TEST-09 are independent hygiene items.

| ID      | Severity | Status | Claim                                                                                                                                                                                                                                                                                                     | Evidence                                                | Tier     |
| ------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------- |
| TEST-06 | medium   | new    | TOOL_IDENTITY reads only package.json (1.1.0), while main carries 55 non-merge E1-E8 commits. The stamp has no git SHA or dirty flag, and v1.1.0 was never tagged; only v1.0.0 exists.                                                                                                                    | version.mjs:54, package.json:3, CHANGELOG.md:7          | [probe]  |
| OPS-02  | medium   | new    | The npm stage scripts:<br>• `npm run audit -- --config x` reaches only the last stage, so earlier stages load the example.com config;<br>• `--out-dir` is ignored;<br>• summarize's exit 2 is dropped;<br>• the argv guard turns every stage into a silent no-op under spaces, Windows paths or symlinks. | package.json:53, summarize.mjs:712, ADR-0003:43         | [probe]  |
| OPS-03  | medium   | new    | The npm install in README and the user manual fails with E404, because the package was never published. Outside a checkout, `npx wcag-em` resolves an unclaimed registry name, and non-TTY CI auto-confirms the install.                                                                                  | README.md:34, user-manual.md:11, integrations.md:129    | [probe]  |
| TEST-07 | low      | new    | ADR-0015's tag-triggered final gate and weekly Dependabot/Renovate do not exist (the push filter is branches-only), and its manual publish gate omits test:e2e.                                                                                                                                           | ADR-0015:72, :84, ci.yml:15                             | [probe]  |
| TEST-08 | low      | new    | CI gaps: a single OS and Node version; config.d.ts drift guarded only by a bypassable husky hook; non-fatal lint warnings; and cancel-in-progress also cancels runs on main.                                                                                                                              | ci.yml:24, .husky/pre-commit:4, eslint.config.mjs:90    | [source] |
| TEST-10 | low      | new    | ADR-0001 and CONTRIBUTING describe checkJs:true, eslint-config-prettier, emitted .d.ts files, browser-closing signal handlers and a configs guard that "fails by name". None of it is true: enforcement comes from per-file `@ts-check`, which nothing requires on new files.                             | jsconfig.json:3, ADR-0001:31, configs-valid.test.mjs:24 | [probe]  |
| OPS-07  | low      | new    | _(corrected)_ [Unreleased] changes semver-covered artefacts (the sample.json location, samplePagesScanned semantics) with no breaking/migration section, and has duplicate "Changed" headings. ADR-0015's promised markdownReport removal never happened.                                                 | ADR-0011:47, CHANGELOG.md:171, ADR-0015:60              | [probe]  |
| OPS-08  | low      | new    | ADRs describe three CLI behaviours that do not exist: a stdout findings summary (nothing writes to stdout), signal handlers that close the browser and flush (they only exit 130/143), and a supported deep-import API (only `.` is exported).                                                            | ADR-0001:60, logger.mjs:11, ADR-0003:46                 | [probe]  |
| OPS-09  | low      | new    | Six small drifts the presence-only guard cannot catch: the screenshotQuality range, missing output files, missing Scan-health templates, a CI recipe without `--with-deps` that relies on non-default reporters, the "own zone" wording at TODO.md:46, and a config.d.ts guard that lives only in a hook. | config-guide.md:169, user-manual.md:95, TODO.md:46      | [probe]  |
| OPS-11  | low      | new    | _(corrected)_ No platform is declared and there is no Windows CI leg. The Windows failure modes themselves are OPS-02, VERD-13 and SEC-18; the residual is the declaration, the matrix and the single-quoted test globs.                                                                                  | summarize.mjs:381, preflight.mjs:88, package.json:59    | [source] |
| OPS-13  | low      | new    | The shipped "example" legacy-events.json targets a real, non-reserved domain and blank-submits its contact form, and it is in the npm tarball.                                                                                                                                                            | legacy-events.json:3, :75, package.json:42              | [probe]  |
| TEST-09 | low      | new    | A raw NUL byte at portal-export.mjs:304 makes the file binary to grep, rg and file(1), so code searches, including earlier reviews', silently skip it.                                                                                                                                                    | portal-export.mjs:304                                   | [probe]  |

- **Duplicates folded:** OPS-12, E2E-04 → TEST-09.
- **Consequence for a WCAG-EM deliverable:** Two audits both labelled "toolkit 1.1.0" can come from materially
  different verdict logic, undermining the Step 5.b tools record, and operators following the documented install or CI
  path fail at step 1 or audit the wrong site.
- **Root fix:** (1) Make the governance docs executable or honest — build what they describe (`tags: ['v*']` plus a
  release job, dependabot.yml, checkJs:true, a gitSha in TOOL_IDENTITY) or amend them — with truth guards (guide
  defaults and ranges vs DEFAULTS and the schema; UM templates and file lists vs `src/` and an e2e run; gen-types plus
  `git diff --exit-code` in CI; `--max-warnings 0`) and a migration/breaking block in [Unreleased]. (2) Retire the
  legacy npm stage scripts or route them through `bin/`, with `fileURLToPath` and a portable main-module guard. (3)
  Point legacy-events.json at example.com, replace the raw NUL with `\u0000`, and lint against control bytes.
- **Symptom patches this supersedes:** editing individual ADR sentences; fixing the screenshotQuality range or TODO
  wording one at a time; patching only summarize's standalone exitCode; patching only the act-rule-map `.pathname`
  call; adding `--with-deps` alone.

---

## 4. Capability gap analysis

The capability-gap findings (packet A18 plus capability items elsewhere) are listed below. Value and effort come
from the finding or verifier text where they state one. Entries marked _est._ are this report's estimate from the
finding's impact statement. "Honest today" means the current output does not over-claim in this area.

| Gap                                                                          | Findings                  | Sev.   | Practitioner value                                                         | Effort                                                                                | Tracked                  |
| ---------------------------------------------------------------------------- | ------------------------- | ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| Discover cannot authenticate (staging, WAF header)                           | DISC-06                   | high   | High: staging audits get no inventory, auto-suggest or random tier         | Medium _est._; needs SEC-02 scoping first                                             | No; T-O is narrower      |
| SC-keyed manual checklist derived from the SC matrix                         | CAP-03                    | medium | High: "basic WCAG-EM Step 4/5 practice"; prerequisite for T-L              | Medium _est._; lands with A01's coverage model                                        | Partly: T-H, T-L         |
| Reflow/text-spacing/zoom measurement at the existing 320px render            | CAP-07 (+SCAN-18)         | medium | High: "one of the most common AA failures"                                 | Low: a page.evaluate at the reflow viewport                                           | No                       |
| Keyboard, focus and dynamic-content signals (tab order, traps, focus deltas) | CAP-08                    | medium | High _est._: the auditor starts the keyboard pass from zero                | Medium _est._                                                                         | No                       |
| Accessibility statement / Step 5.c inputs; draft scope fill                  | CAP-13                    | medium | High: a paid deliverable (PSBAR/EN 301 549 statement) assembled by hand    | Low for scope fill (one-line atBaseline map); medium for statement inputs (needs T-L) | No                       |
| Browser emulation (reducedMotion, colorScheme, locale, touch)                | SCAN-12                   | medium | Medium _est._: dark-mode contrast untested; machine-dependent output       | Low _est._: newContext options                                                        | No                       |
| Process DSL verbs (select, hover, focus, upload, frames, assertions)         | PROC-14                   | medium | Medium-high _est._: dropdown, upload and iframe-payment states unreachable | Medium _est._: schema + dispatch + invariant together                                 | No (related T-N/T-O)     |
| Sample record: per-page tier, rationale, sample table in reports             | SAMP-09                   | medium | High: house methodology requires a sample table and replicable method      | Low-medium _est._: falls out of the A09 manifest                                      | No                       |
| JS-inserted / non-anchor link discovery; crawl settle                        | DISC-15                   | medium | Medium-high _est._: CSR sites inventory only the shell                     | Medium _est._                                                                         | No                       |
| Human reports carry per-violation evidence and Step 5 metadata               | REPA-02, REPA-03, VERD-14 | medium | High _est._: the client-facing deliverable                                 | Medium: shared report model (A16)                                                     | No                       |
| Step 5.b evaluation specifics in the Step 5 artefact                         | VERD-10                   | medium | Medium _est._                                                              | Low _est._                                                                            | Partly: T-K (timestamps) |
| Closed-shadow-root detection routed to manual review                         | STRESS-05                 | medium | Medium: vendor chat/consent widgets read clean today (not honest today)    | Low: CDP DOM.getDocument pierce                                                       | No                       |
| PDF/office document triage (tagged, /Lang, /Title, linking page)             | CAP-12                    | low    | High for UK/EU clients (EN 301 549 clause 10)                              | Low for triage; medium for veraPDF-grade                                              | No                       |
| EN 301 549 / Section 508 clause mapping                                      | CAP-14                    | low    | Medium-high for EU/UK clients                                              | Low: static SC→clause table; depends on A02 scoping                                   | Adjacent: T-R            |
| Stable finding identity for retest/baseline                                  | CAP-18, REPB-16           | low    | Medium _est._: retest cross-walk by hand today                             | Low-medium _est._: sourceFingerprint                                                  | Adjacent: T-M            |
| WCAG-EM Report Tool import/export                                            | CAP-15                    | low    | Medium _est._; format not verified                                         | Medium _est._                                                                         | No (T-J adjacent)        |
| Second engine / cross-engine agreement                                       | CAP-16                    | low    | Medium: recall on axe-silent areas                                         | Medium-high: per-engine SC normalisation                                              | No (T-N)                 |
| Template-level dedupe (`templateLikely`)                                     | CAP-10                    | low    | Low-medium: triage aid only                                                | Medium _est._                                                                         | No                       |
| Element crops / accessibility-tree evidence                                  | CAP-09                    | low    | Low: evidence standard already met by snippets                             | Medium _est._                                                                         | No                       |
| Env/file indirection for secrets                                             | SEC-20                    | low    | Medium: "real capability gap of practical value"                           | Low _est._                                                                            | No                       |
| Screenshot mask / snippet redaction for authenticated scans                  | SEC-22                    | info   | Medium _est._ for authenticated engagements                                | Low-medium _est._                                                                     | No                       |
| `audit --from` / resume                                                      | OPS-14                    | low    | Low-medium: large estates                                                  | Low; fits the T-K envelope                                                            | No                       |
| Critical-process candidate reconciliation                                    | SAMP-07, PROC-17          | low    | Low-medium: URL signals are noisy                                          | Low                                                                                   | No                       |
| Declared platform support / Windows CI leg                                   | OPS-11                    | low    | Low for the current macOS practice                                         | Low                                                                                   | No                       |
| Per-page WCAG-EM 5.d score                                                   | CAP-21                    | info   | Marginal (5.d optional)                                                    | Low                                                                                   | No                       |
| CSV / SARIF / issue-tracker export                                           | CAP-20 (intended)         | low    | Medium for dev-team hand-off                                               | Low                                                                                   | ADR-0011 trade-off; T-N  |

**Reading.** Most rows are honest-output gaps: the toolkit declines to claim, and the auditor does the work by hand.
STRESS-05 and DISC-06 are the exceptions, because today they produce a false clean result or an empty
inventory. The capability work with the highest leverage is the work that also fixes a false claim:

- CAP-03 lands with A01's coverage model.
- CAP-07's overflow evidence turns 1.4.10 from notTested into cantTell-with-evidence.
- STRESS-05 detection lands with the landed-view pipeline.
- CAP-13's scope fill is a one-line quick win.

Manual-result ingestion (T-L), which the 2026-06 review named the single biggest product unlock, depends on CAP-03:
manual verdicts need SC-keyed items to attach to.

---

## 5. Board reconciliation

Board labels map to TODO.md as follows:

| Label | TODO.md item                                                                      | Line                                              |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| T-A   | Durable WAF access / Web Bot Auth                                                 | :38                                               |
| T-B   | Distinct-node counts / advisory best-practice, plus the `occurrenceCount` P1 item | :48, :139                                         |
| T-C   | E4 final-URL re-key                                                               | :52                                               |
| T-D   | Coverage floors in CI                                                             | :60                                               |
| T-E   | Portal contract source-of-truth                                                   | :126                                              |
| T-H   | Feature-aware manual backlog                                                      | :179                                              |
| T-I   | Process-sourced incomplete e2e                                                    | :194                                              |
| T-J   | notTested in EARL                                                                 | :202                                              |
| T-K   | Artifact envelope                                                                 | :204                                              |
| T-L   | Manual-result ingestion                                                           | :210                                              |
| T-M   | Baseline/regression                                                               | :216                                              |
| T-N   | Plugin API                                                                        | :218                                              |
| T-O   | Authenticated SPA crawler (setupScript)                                           | :220                                              |
| T-Q   | act-rule-map carry-forward                                                        | :227                                              |
| T-R   | VPAT/ACR export                                                                   | none; 2026-06 review "Later" list, not on TODO.md |

| Board item                                            | Finding(s)                                 | Board says now                                                                   | Board should say                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stale:** E1-E7 `[x]` (TODO.md:22) and CHANGELOG E1  | PROC-02 (high)                             | Could-not-audit done; coverage disclosed via automatedCoverage + executionHealth | Reopen for the process path. Challenge, empty and not-run process states are dropped silently, and processesEvaluated/journeysTested come from config. Track under A03.                                                                                |
| **Stale:** ADR-0017 Decision 1 (via E1)               | PROC-01 (medium)                           | A process step landing on a challenge "is classified the same way"               | Amend ADR-0017: parity fails for click/press/submit navigation (stale goto response). Fix via A04's shared primitive.                                                                                                                                  |
| **Stale:** T-B text and CHANGELOG.md:245              | REPA-11 (low)                              | Σ-nodesCount "shown in summary.json/html/markdown"                               | html and md render only pageCount. The real same-name collision is report-builder `occurrenceCount` (not deduplicated) vs portal `occurrenceCount` (deduplicated): rename or align.                                                                    |
| T-K (TODO.md:204, P3 "Sprint 2")                      | STRESS-04 (high), REPB-10, REPB-15         | Envelope, strict loader, reports-dir clean                                       | Promote. The documented re-sample workflow plus an interrupted scan reports a different sample with zero warnings. Add scan-start invalidation, lineage check, scan-time timestamps, engine version (VERD-11), transport (SEC-14), typedefs (TEST-11). |
| T-C (TODO.md:52)                                      | VERD-19 (low); REPA-13 same class          | Export labels key on source URL                                                  | Widen scope to the Step 5 artefact itself (SC examples, pagesExamined) and the HTML screenshot map.                                                                                                                                                    |
| T-B (TODO.md:48, :139)                                | REPA-17, REPB-14; E2E-05                   | Advisory framing; occurrenceCount reconcile                                      | Add: human reports rank serious best-practice rules above WCAG failures; JUnit fails them and the draft counts them as automated findings; the portal needs-review count is capped at 25 per view per rule.                                            |
| T-Q (TODO.md:227)                                     | VERD-12 (medium); VERD-13                  | Derive from `getRules().actIds`; add drift check                                 | Add the measured divergence (6 differ, 22 unmapped vs axe 4.11.3). src/data/README.md claims axe hides ACT IDs and the refresh script works (it throws "parser is a stub"). VERD-13 silently drops the map on space/Windows paths.                     |
| T-O (TODO.md:220)                                     | DISC-06 (high), SEC-01 (critical)          | setupScript runtime execution only                                               | Split into three items: (a) discover and the sitemap fetch apply no auth at all; (b) no auth-liveness check, so a dead session reads as a complete passing audit; (c) setupScript as today.                                                            |
| T-H (TODO.md:179)                                     | CAP-03                                     | Feature-aware items (carousel, modal, tables…)                                   | Re-frame: derive SC-keyed items from the SC matrix first (9 in-target SCs are on neither list today), then add feature-aware procedures.                                                                                                               |
| T-L (TODO.md:210)                                     | CAP-01, CAP-03                             | Manual-result ingestion                                                          | Record the prerequisites: SC-keyed backlog items and A01's automation-competence model. averageScore should be null until manual verdicts exist.                                                                                                       |
| T-I (TODO.md:194)                                     | PROC-16, TEST-05                           | Process-sourced incomplete e2e                                                   | Broaden to a real-browser scan-processes e2e (wizard, async validation, header search + form, challenge on submit, excluded widget) plus the default two-viewport run.                                                                                 |
| T-J (TODO.md:202)                                     | REPB-08, REPB-09                           | notTested as `earl:untested`                                                     | Also SC links on rule assertions (or SC-level failed/cantTell), and could-not-audit subjects.                                                                                                                                                          |
| T-M (TODO.md:216)                                     | REPB-16, CAP-18                            | Baseline/regression mode                                                         | Prerequisite: a deterministic per-finding `sourceFingerprint`. Today's selector-based portal fingerprint and positional draft IDs churn.                                                                                                               |
| T-E (TODO.md:126)                                     | REPB-11, REPB-03, REPB-21, REPB-02         | Published schema + contractVersion                                               | Add an executable consumer drift job. The instance field is `htmlSnippet`, not `evidence.html`. Portal master never reads scoreBasis or executionHealth and derives a score when averageScore is omitted. REPB-01 (report-builder) is outside T-E.     |
| `[x]` scoreBasis in portal export (TODO.md:168)       | REPB-11                                    | Done                                                                             | Done toolkit-side only. Portal master keeps it only under `sourceMeta.inputSummary` and nothing reads it, so the C3 intent (score ships with its basis) is not met. Raise a consumer ticket.                                                           |
| Consumer-side notes (TODO.md:240-244)                 | REPB-01, REPB-02, REPB-04                  | report-builder: add a draft-mode to `validate:report`                            | Stale: the consumer now has `--allow-draft`. Record instead that the consumer schema moved (reportType, status enum, sourceFile refinement). Portal: do not default an omitted score to 100. Do not add a two-digit-SC item (fixed on master, #407).   |
| `[x]` npm audit zero vulnerabilities (TODO.md:94-100) | SEC-09                                     | Done 2026-06-12, zero vulnerabilities                                            | Now 20 production advisories (7 high). Add Dependabot and a blocking-at-high audit item.                                                                                                                                                               |
| `[x]` Corrupt-artifact hardening (TODO.md:123)        | STRESS-08                                  | Done                                                                             | Remedy delivered as written. Annotate: the exit 0 on corrupt/missing axe-results belongs to SCAN-20's coverage-aware exit code, plus silent ENOENT and file-less parse errors.                                                                         |
| T-D (TODO.md:60)                                      | TEST-02                                    | Enforce floors in CI                                                             | Measure floors on `src/` only; the 97.89% headline includes the test files.                                                                                                                                                                            |
| T-A (TODO.md:38; wording at :46)                      | SEC-10, DISC-18, SEC-16, SEC-17, OPS-09(e) | Web Bot Auth phases                                                              | The live bot page claims robots.txt respect the toolkit lacks. discover sends a random fingerprint UA per run. Add the spike key-handling and cf-worker lockfile items. Fix the "own zone" wording at :46 (corrected elsewhere in 2cd3c56).            |
| T-R (VPAT/ACR)                                        | CAP-14                                     | Later                                                                            | Do the lighter SC→EN 301 549/508 clause map first; it depends on A02's version scoping.                                                                                                                                                                |

---

## 6. Recommended roadmap

**What to do first, and why.** SEC-01 is the only critical, and it lives in the same function as the rest of A05:
the landed-view gate in `runForPage`, duplicated in process-runner. The widened pageOutcome
vocabulary that fix creates (http-error, non-html, off-scope, unauthenticated) is also the input A08's coverage exit
code, A03's process outcomes and A06's defence in depth all need. Build that primitive once, shared by scan and
process-runner, before touching SC semantics.

A01 is high, but its root fix makes averageScore null, and the portal currently turns an omitted score into 100
(REPB-02). It also changes the criteriaOutcomes vocabulary, which report-builder already rejects (REPB-01). So A08's
explicit zero-coverage status and A10's consumer drift job must precede it, which puts A01 at the top of Sprint 2.
Secrets (A07) are independent and cannot be disclosed away, so they run in parallel from day one. Each probe from
this review should land as the regression test with its fix (B04's fixture builder is the vehicle).

**Sprint 1: "No silent pass, no leak"** (critical, every path that yields a false complete/100/clean, and secret
egress)

| #    | Work package                                             | Root cause / findings                                                                                                                             | Depends on | Why here                                                                                                                                 |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| S1.1 | Shared audited-view primitive                            | A05 (SEC-01, SCAN-01, -06, -07, -08, -13) + A04 core (PROC-03, PROC-01) + capture order (SCAN-09, E2E-01) + closed-shadow landed fact (STRESS-05) | none       | The only critical. It creates the vocabulary S1.2, S2.3 and S2.4 need, and fixing scan and process separately would triplicate the gate. |
| S1.2 | Audit-effectiveness invariant + cheap lineage guards     | A08 root 2 (SCAN-04, SCAN-20, REPB-02) + B01(a) profile-vs-target check (OPS-01) + B02 cheap patches (STRESS-04 interim, STRESS-08)               | S1.1       | Turns every "audited nothing" path into a non-zero exit and an explicit export status; unblocks A01.                                     |
| S1.3 | Secrets: declare, scrub, scope egress, package allowlist | A07 A-D (PROC-08, SEC-02, SEC-06, SEC-08) + STRESS-02 + OPS-13                                                                                    | none       | Leaks cannot be disclosed away. It must precede discover auth (DISC-06).                                                                 |
| S1.4 | Supervised page-view lifecycle                           | A08 root 1 (SCAN-03, SCAN-02) + explicit CLI exit (STRESS-01)                                                                                     | S1.1       | Total result loss and CI hangs; same function as S1.1.                                                                                   |
| S1.5 | Behaviour-first fixture builder                          | B04 (1)-(2) (TEST-01, -02, -03, -11)                                                                                                              | none       | Every S1 probe lands as an outcome-asserting test.                                                                                       |

**Sprint 2: "Honest per-SC and per-journey record"**

| #    | Work package                                             | Root cause / findings                                                   | Depends on | Why here                                                                                                                                                                       |
| ---- | -------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S2.1 | Consumer contract drift job + REPB-01 fix                | A10 (REPB-01, -21, -11, -03)                                            | none       | S2.2 changes criteriaOutcomes; ship it against the real consumers.                                                                                                             |
| S2.2 | Automation-competence model + versioned evaluation scope | A01 + A02 (CAP-01, VERD-02, CAP-03, REPA-04, VERD-03, VERD-05, VERD-04) | S1.2, S2.1 | Both live in toWcagEmSummary; they remove the false SC verdicts and give the SC-keyed checklist (T-L prerequisite).                                                            |
| S2.3 | Process outcomes into the seam + state-aware patterns    | A03 (VERD-06, PROC-02, PROC-04, PROC-05) + A04 (PROC-06, PROC-07)       | S1.1       | Needs states stamped with landed facts.                                                                                                                                        |
| S2.4 | Discover admission gate + crawler context                | A06 (DISC-01 to -06) + DISC-25 e2e                                      | S1.3       | The one high packet deferred. S1.1's scan-time off-scope/non-html/http-error outcomes neutralise its false-verdict paths as defence in depth; what remains is under-inventory. |

**Sprint 3: "Trustworthy population and lineage".** B02 in full: the T-K envelope plus a strict loader and
reports-dir clean (REPB-10). Then A09 + A13: one sample manifest feeding samplingMethodNotes, the 4.c comparison,
per-page coverage, the 5.b specifics and a single backlog build (CAP-05). Then A11's shared root and A12's crawl
health (E1 step 1g), plus A-X1's doc fix. The manifest needs S2.4's per-item status and finalUrl.

**Sprint 4: "Truthful surfaces and contracts".**

- A16: a shared human report model with coverage, method, per-violation evidence and reflow fixed.
- A17: a per-page index for EARL/JUnit, sourceFingerprint (unblocks T-M) and one XML sanitiser.
- B03(3): viewport provenance and one best-practice classification helper.
- A15: the effective scan contract (SCAN-05, SCAN-10, VERD-11 if not already a quick win).
- A14: per-action schema and a field-consumer invariant.
- B01(b): the config load pipeline.

**Later: "Close the loop" (ADR first).**

- T-L manual-result ingestion on the SC-keyed items from S2.2.
- The A18 page-view hook: CAP-07 overflow, CAP-08 interaction probes, SCAN-12 emulation, PROC-14 DSL.
- CAP-13 statement inputs, CAP-12 PDF triage, CAP-14 standards map.
- Then T-M, T-R, CAP-15, CAP-16 and CAP-20 as ADR-0011 is revisited.

**Continuous.**

- B05: tag v1.1.0 plus a gitSha stamp; retire the npm stage scripts (OPS-02); fix the install docs (OPS-03); an
  ADR truth pass (TEST-07, TEST-10, OPS-07, OPS-08, OPS-09).
- A19 CI hygiene: Dependabot, a blocking-at-high audit, drift guards.
- B04 (3)-(4): the two-viewport e2e and a mutation smoke.

**Quick wins.** Each is a standalone or one-line fix a verifier identified, safe to land before the sprints.

1. **SEC-10.** Reword the live bot page and the Bot Submission text ("Respects robots.txt") to conditional until it is implemented. This is a public representation.
2. **CAP-04.** Always emit the 1.4.11 backlog item; invert manual-backlog.test.mjs:28 and fix the docstring.
3. **VERD-11.** Stamp axe-core's own version (its package.json or `testEngine.version`); invert version.test.mjs:45.
4. **VERD-13.** Use `fileURLToPath(new URL(...))` at summarize.mjs:381.
5. **DISC-21.** Compile documentLinkPatterns with the `i` flag.
6. **SEC-08 + OPS-13.** Narrow `files` to `configs/example-*.json`, point legacy-events.json at example.com, and add `private: true` until publish is intended.
7. **B02 cheap patches.** Treat over-coverage as an integrity error (wcag-em-summary.mjs:420-423), and put the file path in JSON.parse errors (scan.mjs:176).
8. **STRESS-01.** `process.exit(process.exitCode)` in asHandler after the logger flushes.
9. **TEST-06.** Tag v1.1.0 at `bf14f68`, and add gitSha/dirty to TOOL_IDENTITY (or bump main to a pre-release).
10. **CAP-13 slice.** Map `wcagEm.atBaseline` to the draft's `scope.assistiveTechnologies`.
11. **TEST-09.** Replace the raw NUL at portal-export.mjs:304 with `\u0000`.
12. **Docs.** Standardise on `extraHttpHeaders` (DISC-26) and `allowed-hosts` (DISC-17a); fix the ADR-0012 link (CAP-22). **Code:** `failedRequestHandler({ request }, error)` (DISC-24); Commander `--log-level` default undefined (SEC-12).

E2E-01's `caret:'initial'` is a one-option change, but S1.1 moves the screenshot after axe anyway, so land them
together rather than twice.

---

## Appendix A — Refuted and intended claims (kept so they are not re-discovered)

| ID                       | Claim                                                                                    | Verdict  | Reason                                                                                                                                                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REPB-04                  | The portal drops two-digit SCs, so 1.4.12 (avoid-inline-spacing) arrives with `wcag: []` | refuted  | Round 1 read the portal branch `fix/ut-extension-withheld-issue-rows` @ 208c6a80, which is not an ancestor of master. Portal master carries 0ab905e3 (#407, 2026-08-28): `WCAG_DOTTED = /^\d\.\d\.\d{1,2}$/` plus 4-digit compact forms. The toolkit emits "1.4.12" correctly. |
| CAP-20                   | No CSV, issue-tracker or SARIF export                                                    | intended | ADR-0011:70-71 records it as an accepted v1 trade-off ("fork or wait for v2.0"); ADR-0008:245 agrees. Tied to T-N.                                                                                                                                                             |
| PROC-18                  | Under CDP, processes share one browser context                                           | intended | ADR-0020: "CDP page-views are intentionally NOT context-isolated" (opt-in path, I-3). The only residue is a doc note for state-mutating journeys, which overlaps SEC-15.                                                                                                       |
| (round-2 E2E hypothesis) | Grouped finding impact comes from the first-seen page and understates severity           | refuted  | axe-core 4.11.3 impacts are rule-constant at runtime, so first-seen vs maximum impact cannot diverge today.                                                                                                                                                                    |

**Sub-claims the verifiers rejected** (the parent finding stands in corrected form in §3; do not re-raise these
parts):

- **Verdict layer.** CAP-01: "Drops off the manual checklist" is false for the SCs the core backlog covers (keyboard,
  name/role/value, headings, zoom/reflow, text spacing, focus). "Nothing flagged at SC level" is false for the draft
  (per-row note plus caveat callout) and for EARL (earl:automatic, opt-in); VERD-02: "Never re-evaluated" is wrong:
  the backlog is also mandatory; VERD-04: 4.1.1 has no verdict or averageScore effect; VERD-08: The tier cluster sets
  are unit-tested; VERD-10: Timestamps belong to T-K, and 5.d is optional; VERD-12: The extra implementation-report
  IDs are not shown to be wrong; REPA-04: The failing rule is findable under "Grouped findings"; CAP-03: Round 1's "10
  SCs" included AAA 2.1.3, 9 are in target; CAP-21: A per-page 5.d score is optional and marginal.
- **Page gate and scan.** SCAN-01: The CF "Attention Required" 403 is caught, and 4xx-with-markup being auditable is
  ADR-0017 policy; SCAN-02: A merely busy page does not hang; SCAN-11: Settle knobs exist; SCAN-14: Loss is
  unrealistic at WCAG-EM sample sizes; SCAN-16: The iframe `a | b` join is intended; SCAN-17: Best-practice off by
  default is documented; SCAN-12: Fade-in noise is avoidable with beforeScan waitFor and lands as needs-review;
  E2E-01: The 1.4.12 verdict flips only when no real inline style exists in the sample.
- **Process path.** PROC-01: On Cloudflare-proxied sites the stale cf-ray still catches the English interstitial;
  PROC-03: beforeScan not running in processes is documented scope; PROC-12: No orphan at the 60 s default; PROC-13: A
  submitting process is itself an opt-in, and per-viewport repetition is ADR-0006 design; PROC-15: Failures are
  signalled at runtime, and a no-steps process records "not-run"; PROC-17: Axe only at explicit steps is documented
  DSL design; PROC-20: PNG-only is documented; TEST-01: The process-guard mutant is effectively equivalent.
- **Discover and sampling.** DISC-05: It needs concurrent runs, and the common failure is loud; DISC-06: It is not
  covered by T-O, status new; DISC-07: The 403-root case does log a warning; DISC-12: The alphabetical within-leaf
  pick is ADR-0018 intent; DISC-13: The sample used is persisted; DISC-14: URL-only typing is ADR-0012 intent;
  DISC-18: Robots handling is documented operator responsibility (but see SEC-10); DISC-19: includeSubdomains is a
  documented deprecation; SAMP-03: No false conformance claim results; SAMP-04: Not every negative seed is affected,
  and the default seed is unaffected; SAMP-07: The preferTypes default is documented and defensible; SAMP-09: Tiers
  are recoverable from the artefacts; SAMP-11: relatedUrls behaviour matches the config guide; SAMP-15: The finder's
  own proposed step mapping was also wrong.
- **Exports and reports.** REPB-02: The draft does carry a Scan-warnings appendix, and the exit/JUnit parts are
  SCAN-20/REPB-09; REPB-03: No visible downstream loss today; REPB-07: The JSON.parse-first stance is ADR-0009;
  REPB-08: SC-level passes only is ADR-0009 design; REPB-10: Exit 2 masking 1 is ADR-0008 intent; REPB-18:
  sourceFolder is load-bearing; REPB-21: Its examples outside consumer contracts were not verified; REPA-01: 18 of 104
  help strings, not 31, GFM's tagfilter blocks title, textarea and script; CAP-09: The evidence standard is met by
  code snippets; CAP-10: Crude by design, and only the secondary view is affected; CAP-15: Rule-keyed EARL is design;
  CAP-18: No silent mis-marking: the draft is human-confirmed.
- **Config, ops, tests.** OPS-01: Nothing flips to passed; OPS-04: There is no false-claim path; OPS-05: The argv
  fallback is documented, and the API is declared unstable; OPS-07: The Dependabot point duplicates TEST-07/SEC-09;
  OPS-11: The Windows failure modes are other findings; OPS-14: Standalone subcommands already give stage selection;
  STRESS-08: The closed TODO remedy was delivered; SEC-09: The non-blocking audit is documented intent, and
  exploitability was not shown; SEC-20: The guide line is ambiguous, not false; TEST-04: The 1.4.11 pin is already in
  CAP-04; TEST-05: The smoke fixture is seeded and asserts exit 2; TEST-12: The no-throw test is intentional.

## Appendix B — Duplicate map (folded ID → kept ID)

**Triage-level folds (26).**

| Packet | Folds                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| A05    | CAP-06 → SCAN-08; SEC-04 → SCAN-01                                                                             |
| A01    | VERD-01 → CAP-01                                                                                               |
| A03    | PROC-11 → VERD-06; REPA-12 → PROC-19                                                                           |
| A04    | VERD-07 → PROC-03                                                                                              |
| A06    | CAP-17 → DISC-01; SEC-03 → DISC-06                                                                             |
| A08    | SEC-07 → SCAN-03                                                                                               |
| A12    | DISC-23 → SEC-13                                                                                               |
| A13    | SAMP-12 → VERD-08; REPA-10 → VERD-09; VERD-16 → SAMP-05; VERD-17 → CAP-04; REPB-13 → CAP-05; DISC-22 → SAMP-08 |
| A14    | VERD-18 → PROC-09; SEC-11 → PROC-09                                                                            |
| A15    | SCAN-15, REPA-08, REPB-12, CAP-19 → VERD-11; SEC-05 → SCAN-10                                                  |
| A18    | SCAN-18 → CAP-07                                                                                               |
| B05    | OPS-12, E2E-04 → TEST-09                                                                                       |

**Verifier `duplicate` verdicts (6).** CAP-02 → VERD-03; REPA-05 → VERD-03; E2E-06 → REPB-18; E2E-02 → VERD-07
(→ PROC-03); STRESS-06 → SCAN-21; E2E-07 → VERD-01 (→ CAP-01).

**Upheld with a duplicate pointer (counted in the 190).** CAP-01 ↔ VERD-01 (the same defect; CAP-01 is the row
kept); CAP-21 → CAP-01 for the score-inflation half; CAP-09 → REPA-09 for the broken-screenshot half.

## Appendix C — Key experiments

All probes ran against localhost fixtures from scratch directories. Round-1 finders ran ~145 probes, packet verifiers
re-ran the high/critical ones, and round 2 added 41. Condensed, with the ones that reproduced high/critical findings
first.

| Finding(s)        | Experiment                                                                                                                                                      | Result                                                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01            | Full `audit`, `/account/*` → 302 `/login?next=` without a valid cookie; expired vs valid session, then an independent probe with a live-session control         | Dead: exit 0, coverage complete, averageScore 100, "login" in 0 of 12 reports, draft lists protected URLs as tested. Live: exit 2, image-alt + button-name, score 67.                                                                                 |
| CAP-01, VERD-01   | Fixture with a keyboard trap, pointer-only div, `outline:none`, carousel, untagged French, "Click here", `<title>Page</title>`; two independent probes          | 0 findings; 11/10/36 and 8/13/36 passed/inapplicable/notTested; 2.1.1 inapplicable, 2.4.2 passed; portal 100. A separate Playwright probe detected the trap and the pointer-only div.                                                                 |
| SCAN-01           | Audit of 404, 429, JSON and an off-origin SSO redirect                                                                                                          | All auditable with no status field; JSON got document-title + html-has-lang; the IdP page was audited under its own origin; Akamai 403, CF 1020 and 401 "Sign in" classify ok.                                                                        |
| VERD-03, VERD-05  | wcagVersion × conformanceTarget matrix                                                                                                                          | 2.0/AA emits 18 post-2.0 SCs; 2.1/AA emits 2.5.8 failed; target A emits 1.4.3 failed; 4.1.1 notTested in all 9 cells; 2.1.3 moved the score 92 → 85.                                                                                                  |
| VERD-06, PROC-02  | Audit with a process whose click times out, then goto 404; challenge-landing process                                                                            | Degraded state flipped 2.4.2/3.1.1 to failed from `missing-page.html#payment`; processesEvaluated listed both; scanWarnings []; challenged process: 0 warnings.                                                                                       |
| PROC-03, E2E-02   | Page scan vs process state on one page with exclude + wcag2a; rule-set diff                                                                                     | Process state reported image-alt (excluded), color-contrast and region; scan chain reported none. Process ran 89 rules vs 90; target-size missing (disabled by default).                                                                              |
| PROC-06, PROC-07  | Header search before the target form; async validation at 0/50/150/300/1000 ms                                                                                  | Blank-submit audited /search results, with 0 contact POSTs. Validation at ≥150 ms missed; async 1.4.3 passed vs sync failed.                                                                                                                          |
| PROC-08           | Failed `fill` with sentinel `PROBE-S3cret-Value-42`                                                                                                             | Sentinel present in process-results, summary.json/md/html, portal-export, the draft and CLI logs.                                                                                                                                                     |
| SEC-02            | Two-origin probe; third-party 401 iframe; CORS widget                                                                                                           | X-WAF-Bypass on 7 third-party requests; Basic credentials sent to B's iframe and redirect target; widget "Failed to fetch" only with the header set.                                                                                                  |
| DISC-01..06       | allowed-hosts on two loopback names; root/sitemap/go-admin redirects; 404/JSON/RSS links; redirect duplicates at maxPages 6; Basic-auth staging; shared storage | Allowed host never requested; 1-page inventory for root redirect, exit 0; `/admin/secret` inventoried and suggested; false 2.4.2/3.1.1 fails; reachedMaxPages false with /p1../p6 unfetched; 4 × 401, empty inventory, exit 0; concurrent run ENOENT. |
| SCAN-03, SCAN-02  | Kill Chromium mid-run; busy main thread                                                                                                                         | 7 pages scanned then exit 1 with no axe-results.json; a never-yielding page hung until SIGKILL; a 20 s busy page completed in 21.5 s.                                                                                                                 |
| SCAN-04           | withTags `['wcag2.1aa']`; runOnly with an unknown rule                                                                                                          | 0 rules on every page, "coverage complete (4 pages)", 56 notTested; unknown rule: every page errored, exit 0.                                                                                                                                         |
| REPB-02           | Every response 403 + `cf-mitigated: challenge`                                                                                                                  | Exit 0; portal-export has no averageScore and no status; draft says "not touched by any automated rule"; portal fallback → 100 (source trace).                                                                                                        |
| REPB-01           | Drafts through the consumer's current DraftReportSchema                                                                                                         | Every draft fails on reportType; 5× findings.status; 10 sourceFile refinement failures on a patched copy; toolkit validateExports silent.                                                                                                             |
| STRESS-04         | Documented re-sample workflow + SIGINT mid-scan                                                                                                                 | Old axe-results untouched; summarize exit 2 with 0 warnings: "PARTIAL (24/7 selected pages audited)", findings on 15 unsampled pages.                                                                                                                 |
| E2E differential  | 10-page ground-truth fixture, 2 viewports, all 7 reporters; raw `@axe-core/playwright` per view                                                                 | 20/20 page-views identical on violation ids, node counts, impacts, incompletes; two audits byte-identical after masking; only extra pass was avoid-inline-spacing (E2E-01).                                                                           |
| E2E-01            | Screenshot with default caret vs `caret:'initial'` vs none                                                                                                      | Default adds `style=""` to inputs: 1.4.12 passed, score 58; no screenshots and no process: inapplicable, score 55.                                                                                                                                    |
| STRESS-01/02/03   | 414-page site with a never-answered pixel; LAN curl through the proxy                                                                                           | CLI never exited after "done" (killed at 677 s); proxy on `*:PORT` returned a 127.0.0.1-only secret; stalled pages dropped after 4 × 15 s, root → empty inventory.                                                                                    |
| STRESS-05         | Same widget in open vs closed shadow root                                                                                                                       | Closed: 0 violations, 8 passes; open: 5 violations; CDP reports `shadowRootType: closed`.                                                                                                                                                             |
| STRESS-06 (scale) | 414-page discover; 28 pages × 2 viewports scan                                                                                                                  | Discover 88.8 s, peak RSS 1.47 GB; scan 549.6 s (simple ~0.4 s/view, 20k-element ~43 s, hung subresource 60 s); axe-results 5.84 MB; summarize 0.67 s.                                                                                                |
| TEST-01, SAMP-10  | 19 mutants one at a time against the unit suite; 4 sampling mutants against unit + e2e                                                                          | 13 killed; 3 non-equivalent survivors; all 4 sampling mutants survived 517 + 8.                                                                                                                                                                       |
| TEST-02           | `npm run test:coverage` (unit + e2e, child processes counted)                                                                                                   | 525/525; headline includes test files; html.mjs:212-246 and five other risky ranges never execute.                                                                                                                                                    |
| OPS-01            | README withTags example vs full profile                                                                                                                         | 31 rules vs 90; image-alt and label vanish; 1.1.1/4.1.2 failed → notTested; coverage "complete" in both.                                                                                                                                              |
| OPS-02, OPS-03    | npm stage scripts; registry lookup                                                                                                                              | `--config` reached only summarize; standalone summarize exit 0, `--out-dir` ignored; space-path runner no-op; both package names E404.                                                                                                                |
| REPA-01, REPA-06  | summary.md in a pass-through renderer; summary.html at 320px                                                                                                    | A `<textarea>` swallowed 5,254 chars (0 of 5 finding headings visible); scrollWidth 431 > 320.                                                                                                                                                        |
| REPB-05, REPB-06  | junit.xml with U+FFFE/U+FFFF; EARL pointers per page                                                                                                            | xmllint "Char 0xFFFF out of allowed range"; about.html asserted `#ctl-img`, which exists only on index.html.                                                                                                                                          |
| SAMP-04, SAMP-08  | Negative seeds; locale and order changes                                                                                                                        | 29% of negative-seed combinations produce undefined entries; en-US vs da-DK and reversed order give different samples for the same seed.                                                                                                              |

## Appendix D — Coverage statement (what this review did not examine)

- **Real-world targets.** No WAF, CDN or CMS target was used, and neither the MyVision prod config nor legacy-events
  ran end to end. All evidence comes from localhost fixtures. Scale figures for a 2,450-URL estate are extrapolated,
  not measured.
- **Normative sources were not fetched** (no network). The WCAG 2.2 SC set, WCAG-EM 1.0 step numbering, ACT outcome
  mappings, the EARL vocabulary and the Report Tool import shape were checked from memory; SAMP-15's step mapping
  rests on this.
- **Transports and engines.** The patchright engine and a live CDP attach were code-read only. Round-2 conditions (exit
  hang, proxy exposure, caret DOM mutation, load-event loss) were not re-run under CDP.
- **Process path under load.** scan-processes was not exercised under stress or on multi-step forms beyond the round-1
  fixtures. Process-sourced findings were not traced through EARL, JUnit, portal-export or the draft.
- **Consumers.** Portal frontend rendering, report-builder UI rendering and the other portal adapters were not examined.
  Round-2 artefacts were not re-run against the live consumer schemas.
- **Platform and network.** Windows was only simulated (`path.win32`). TLS, corporate proxies, self-signed certificates
  and IPv6-literal root URLs were not probed. Locale, timezone and clock determinism were not probed beyond SAMP-08.
- **Signals and memory.** SIGTERM mid-scan and signals during discover/summarize were only partly tested. Heap growth on
  multi-hour runs was not measured. The SCAN-14 string ceiling was not re-measured above ~414 pages.
- **Security depth.** No end-to-end hostile-content probe pushed attacker-controlled titles or selectors through the
  draft and portal ingestion; the XSS assessment is code reading plus a jsdom URL fuzz. Authenticated audits used
  synthetic cookies and Basic auth only, with no real SSO or codegen storageState and no setupScript path.
- **Tests.** Mutants ran against the unit suite only, and the survivors were not run against e2e. There was no
  repo-wide mutation or per-test assertion-density scan. The accessibility of the generated reports was checked with
  axe and a 320px measurement, not with assistive technology.
- **Out of charter.** spikes/ tests and the cf-worker CI; docs/design-notes, docs/reviews and docs/plans beyond cited
  lines; every historical CHANGELOG entry; axe-core forward-compatibility beyond 4.11.3.
- **Observed but never triaged** (candidates for a follow-up):
  - failOnFindings ignores needs-review items, so a critical incomplete still exits 0.
  - Crawlee INFO logs with ANSI codes reach stdout at `--log-level warn`.
  - The inventory overshot maxPages (26 pages at 25), possibly adjacent to DISC-04.

**Data caveats for verification.**

- **REPB-02's portal fallback trace — resolved, the claim holds on master.** The "omitted score → 100" was first
  traced on portal HEAD 208c6a80, a feature branch that is not an ancestor of master (REPB-04). It was then
  re-checked read-only on portal `origin/master` @ e2eb1d15 (2026-09-30), with three results:
  - `canonical.adapter.ts:160`, `normalizeAverageScore(summary, scored.score)`, falls back to the derived score
    when `summary.averageScore` is absent.
  - `wcag-score.util.ts` `scoreFindings()` returns `score: totalIssues === 0 ? 100 : ...`.
  - master has no `scoreBasis` reader.

  So on master too, a zero-audit toolkit export scores 100% in the portal.

- **Screenshot ordering.** A05's root fix says to take the screenshot after setup, immediately before axe. B03 says axe
  first, then the screenshot. This report reconciles the two as after setup and after axe.
- **SAMP-15's recommendation field contradicts its corrected claim.** The recommendation says "3.b random, 3.c
  processes", but the claim is 3.e random, 3.d processes, 4.c comparison. The claim is used here.
