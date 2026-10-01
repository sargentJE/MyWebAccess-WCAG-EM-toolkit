# Gap remediation programme (2026-10): root-level fixes for the 2026-09-30 review

- **Parent:** [2026-09-30 gap review](../reviews/2026-09-toolkit-gap-review.md) of commit `306d38d`.
  - **Counts:** 225 raised; 190 upheld (1 critical, 21 high, 82 medium, 83 low, 3 info); 25 root-cause packets.
  - **Evidence:** the verbatim reproductions are in [`../reviews/2026-09-probes/`](../reviews/2026-09-probes/README.md).
- **Status:** approved 2026-10-01; executing. This document is the working plan; TODO.md tracks progress.
- **Repo state at approval:** `main` = `origin/main` = `306d38d`, verified
  2026-10-01.
- **Gate at planning time:** green on 2026-09-30 (prettier, eslint, tsc JSDoc, 517 unit, 8 e2e). Every command
  needs the nvm 22 prefix; the shell default is Node 20.
- **Decisions (Jamie, 2026-10-01):**
  - **D1:** tag v1.2.0 first; remediation then lands toward v2.0.0.
  - **D2:** toolkit-only. The toolkit's output aligns to what the consumers already read; consumer changes are
    written up as change requests.
  - **D3:** capability gaps form a final, ADR-gated phase.
  - **D4:** strict by default.
  - **D5:** v2.0 omits the portal `averageScore`. A portal change request is a release gate before v2.0 output is
    used in the portal.

## Executive summary

- **Order of work.** 16 remediation epics (E9-E24) in 5 phases on two lanes, then a capability phase (E25-E31).
- **The critical first.** SEC-01 (a dead auth session reported as a complete, passing audit) is fixed in the
  **3rd PR**. Until then, v1.2.0 ships with a known-issues advisory that contains the risk for client audits.
- **v2.0.0-alpha.1 (after Phase 2).** No run can claim coverage it did not achieve, and no secret leaves its
  scope.
- **v2.0.0.** 178 of the 190 upheld findings are closed at their root. Each root has a named **class guard**:
  a test that fails if that class of defect returns. The remaining 12 are capability gaps (v2.1+), led by a
  recommended scope extension: manual-result ingestion (T-L).
- **Traceability.** Machine-checked at planning time: 190/190 upheld IDs, each with exactly one closing epic. At
  release, every ID must map to a `{commit, test}` pair.

---

## Context

What the toolkit _reports_ is accurate: 20/20 page-views matched raw axe. What it _claims around_ those
findings is not. Every high and critical finding traces back to a small set of missing primitives:

1. **An audited-view contract.**
   - The page audit is implemented twice and uses a lossy `ok|challenge|empty` classifier.
   - It records no landed facts and does no auth liveness check.
   - It runs in the wrong order. This is how SEC-01 happens.
2. **An evaluation model.** Single axe rule results become SC-level `passed`/`inapplicable`, and the SC set
   ignores `wcagVersion` and level.
3. **An audit-effectiveness invariant and run lineage.**
   - Zero-rule runs, zero-page runs, stale or mixed artefacts and crashes all read green, or lose everything.
   - Exit codes ignore coverage.
4. **Crawl authority.** discover trusts Crawlee's defaults for scope, redirects, status, storage, auth and its
   local proxy.
5. **A declared secret class.** Without one, egress cannot be scoped and leaks cannot be detected at
   persistence.
6. **Executable contracts.** Consumer contracts, the toolkit's own artefacts and the docs drift because nothing
   executable checks them, and the tests check execution rather than behaviour.

The plan builds each primitive once, closes every finding that shares its root, and leaves a class guard behind.

---

## Self-assessment revisions

### Round 1: adversarial review (v1 -> v2)

A Plan agent attacked v1 against the code, `node_modules` sources and the journals. It raised 4 blockers,
22 should-fix items and 17 nice-to-haves, and dismissed 9 of its own concerns after checking them. I
re-verified 7 of its claims against the source and all held: B1, B2, B4, S3, S5, S9, S20.

**Blocker fixes absorbed:**

- **B1, SEC-02.** Header injection via `context.route` leaks on redirects (`types.d.ts:4039`). It is replaced by
  an egress spike plus an ADR decision.
- **B2.** The writeAtomic scrub would corrupt JSON and redact the tool's own name, because the example header
  value equals `TOOL_IDENTITY.name`. It is replaced by:
  - a narrow secret set, with a minimum length of 8;
  - scrubbing at the points where untrusted text enters the run model;
  - a write-time detector that fails the write.
- **B3.** Portal score semantics, now settled by D5.
- **B4.** Commits that would leave the gate red or silently disable a guard now carry `Migrations:` lines, and
  the invariants are rewritten in the same commit. This also surfaced a new defect: `configs-valid.test.mjs`
  never validates the configs it loads.

**Should-fix items absorbed:**

- two-phase classification;
- `viewStatus` allowlists `ok` only;
- the supervisor owns shared state;
- exit precedence `1 > 4 > 3 > 2 > 0`;
- section-scoped lineage stored in a sidecar manifest;
- `auth.verify` required for `storageState` only;
- the real Crawlee proxy root, plus a listen-guard test;
- `admitPage` built on the shared classifier;
- doc fixes ship with their guards;
- corrected closure claims (SEC-18, SCAN-22, REPB-16, PROC-11, SEC-11, CAP-13, OPS-07, SEC-10, DISC-19, OPS-06);
- the consumer `.strict()` schema and its commit pins;
- the drift check runs in each consumer's own workspace;
- the ADR, test-inversion and coverage-gap schedules.

**Dismissed after checking:**

- `cantTell` validity;
- top-level `status` against the vendored schema;
- `httpCredentials.origin`;
- `axe.getRules()` in Node;
- the discover `waitUntil` hook;
- control bytes;
- test version literals;
- CI triggers.

### Round 2: final sequential self-assessment (v2 -> v3)

The sequential-thinking MCP server failed twice in this client (it declares a draft-07 schema the client
rejects), so this pass was done as explicit structured reasoning. **Criteria:** fidelity to root fixes;
sequencing that can stay gate-green; how early risk is removed; efficiency; verifiability; how easy the plan is
to execute; alignment with D1-D5.

**Strengths kept:**

- **S-a.** Decomposition by primitive: each epic closes a class, not an instance.
- **S-b.** Complete, machine-checked traceability with one owner per finding.
- **S-c.** Every external assumption was verified in source: Playwright route semantics, the axe `runOnly`
  rules, the Crawlee proxy, and the portal and report-builder contracts.
- **S-d.** A toolkit-side alignment that needs no consumer change: `status`, `htmlSnippet`, and enum-valid
  `cantTell`.
- **S-e.** Explicit migration, test-inversion, ADR-amendment and coverage-gap schedules.
- **S-f.** Phased releases, each with gates.

**Weaknesses found and fixed:**

| #   | Weakness in v2                                                                                             | v3 change                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | The only critical landed in the 5th PR, after ~29 foundation commits; nothing contained the risk meanwhile | Re-sequenced: SEC-01 is in the **3rd PR** (E11). The config contract moves after Phase 2: the effectiveness invariant already neutralises the zero-rule false claim at runtime, and `resolveAxeProfile` is extracted behaviour-neutrally inside E11. v1.2.0 ships a **known-issues advisory** (E9 R3), labelled as containment, not closure. |
| W2  | One serial spine; independent hygiene fixes blocked behind it                                              | Two lanes. **Lane C** (E15 independent fixes, E16 governance/CI) runs in parallel from v1.2.0, each PR based on `main`. Constraint: E16's dependency hygiene lands before E18.                                                                                                                                                               |
| W3  | No sizing, so no capacity planning                                                                         | Size per epic (S/M/L/XL) and a commit count                                                                                                                                                                                                                                                                                                  |
| W4  | Strict exit 3 would fire on almost every real audit (blocked or excluded pages), crying wolf               | Adequacy = every sampled page is **audited or explicitly dispositioned** (`sample.dispositions` with a reason, or the manual-review queue), as WCAG-EM's documented exclusions allow. Exit 3 lists only the _undispositioned_ gaps; `minAuditedRatio` is optional.                                                                           |
| W5  | Post-implementation review cost not proportioned to epic size                                              | 3-charter review for L/XL epics; one combined reviewer for S/M. The closure audit stays at v2.0.                                                                                                                                                                                                                                             |
| W6  | Matrix commits ("test(e2e): ...") read as tests landing apart from their fixes                             | Discipline clarified: every fix commit carries its own targeted tests. The `-matrix` commits are extra cross-cutting nets. Test-gap findings (PROC-16, DISC-25) are test-only commits by nature.                                                                                                                                             |
| W7  | ADR churn: separate ADRs for lineage and lifecycle                                                         | Merged into one ADR-0025, "run integrity" (lineage, exits, lifecycle).                                                                                                                                                                                                                                                                       |

**Gaps found and filled:**

| #   | Gap in v2                                                                                                                                        | v3 change                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | No schema or version for the toolkit's **own** public artefacts, though ~10 epics change `summary.json` / `wcag-em-summary.json`                 | E10 R1 publishes JSON Schemas with `schemaVersion` for `summary.json`, `wcag-em-summary.json` and axe-results entries, and validates every write in tests. Every later shape change updates schema + version + CHANGELOG in the same commit; the test enforces it. |
| G2  | No performance budget, though route interception disables the HTTP cache and E11 adds settle/DOM probes                                          | E10 R5 captures a baseline (two-viewport e2e plus a 50-page synthetic scan). Each Phase 2/3 PR reports the delta; more than 25% regression needs a written justification.                                                                                          |
| G3  | Dogfooding only at v2.0                                                                                                                          | An authorised MyVision CDP dogfood diff against the 2026-06-16 baseline at alpha.1, alpha.2, beta.1 and v2.0                                                                                                                                                       |
| G4  | No migration tool for the strict v2 config                                                                                                       | E17 R8 `wcag-em config check`: shows the effective config (secrets masked), the derived scope and axe profile, and migration hints for 1.x keys                                                                                                                    |
| G5  | Probe sources existed only in local agent transcripts (the scratchpad copy was already lost once)                                                | E9 R1 extracts them into `docs/reviews/2026-09-probes/` so they are durable and can become the regression fixtures                                                                                                                                                 |
| G6  | Removing automated passes leaves the toolkit unable to produce any decided SC verdict, so the portal shows "awaiting manual review" indefinitely | **Recommended scope extension**: E25 manual-result ingestion (T-L), first in Phase 6, built on E21's SC-keyed manual scope. Approve or strike at plan review.                                                                                                      |
| G7  | Root closure was asserted, not tied to a guard                                                                                                   | A "class guard" column in the programme table names the test that fails if each class returns                                                                                                                                                                      |

---

## State verification

| Check                               | Result                                                                                                                                                                                                                   | Evidence                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| main has not moved since the review | `306d38d` on HEAD, main and origin/main                                                                                                                                                                                  | `git log -1`, 2026-10-01                                                                                    |
| Review data recoverable             | 25 packet verdicts, 2 critical second opinions, 41 round-2 findings, 26 triage duplicates, 26 coverage gaps                                                                                                              | wf_3a8d13f7-465 journal                                                                                     |
| Traceability complete               | 190/190 upheld IDs map to exactly one closing epic and commit (re-checked on v3)                                                                                                                                         | read-only python check against the journal                                                                  |
| Portal master contract              | reads top-level `status` (`queued`/`processing`/`completed`/`failed`; missing -> `completed` + `MISSING_SCAN_STATUS`) and `instances[].htmlSnippet`; derives 100 when `averageScore` is absent and there are no findings | `canonical.adapter.ts` `normalizeStatus`, `normalizeInstances` (~606); `wcag-score.util.ts` `scoreFindings` |
| Report-builder contract             | criteriaOutcomes item is `.strict()` with `{criterion, level, outcome, notes, relatedFindingIds}`; outcome enum is `passed`/`failed`/`cantTell`/`inapplicable`                                                           | `report.schema.js:362-372, :67` @ `3a5fac1`                                                                 |
| Playwright routing                  | the route handler sees only the first URL of a redirect chain; route headers carry onto redirects                                                                                                                        | `types.d.ts:4039`, `:21599-21604`                                                                           |
| Crawlee proxy                       | module-level `Server({port:0})` with no host, so it binds all interfaces                                                                                                                                                 | `@crawlee/browser-pool/proxy-server.js:5-10`                                                                |
| axe rule selection                  | `runOnly` type `rule` ignores `rules.enabled`                                                                                                                                                                            | `axe-core/axe.js:19930-19933`                                                                               |
| Guard tests touched by refactors    | `process-runner-invariant` reads `$defs.action...enum`; `discover-no-locator-invariant` brace-walks `async requestHandler(`; `configs-valid` never validates                                                             | see the inversion schedule                                                                                  |

---

## Discipline (inherits ADR-0001; restated)

**Branches and PRs**

- One epic is one branch is one PR into `main`, and Jamie merges.
- No stacked PRs: CI only fires for PRs based on `main`.
- Spine epics branch from the merged tip of their predecessor.
- Lane C PRs branch from `main` and rebase as the spine merges.

**Gate:** green on every commit.

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run format:check && npm run lint && npm run typecheck && npm test
```

Also run `npm run test:e2e` on any commit that touches:

- `src/commands`
- browser, audit-view, process-runner, sitemap or discover code
- a reporter

**Commit rules**

- Tests first for every bug fix. The test and the fix land in the same commit; each fix commit carries its own
  targeted tests. `-matrix` commits are extra cross-cutting nets, not where a fix's tests live.
- Each commit body opens with `Root cause:`, then lists the finding IDs closed, the symptom patches superseded,
  and `Migrations:` (tests, configs, docs or schemas that must change with it).
- Any change to a public artefact's shape also updates its schema, `schemaVersion` and CHANGELOG in the same
  commit (enforced by E10 R1).
- Conventional Commits; Comment Anchors; zero emoji; no AI attribution in commits, PRs or merges.

**Decisions and guards**

- An ADR (MADR) comes before each significant decision. Amendments land in the epic that changes the decision.
- Every grep invariant asserts at least one match; the real guard is a behavioural assertion.
- `CHANGELOG [Unreleased]` is updated in each PR, with a BREAKING/Migration block whenever an artefact, exit-code
  or config contract changes.

**Before each push**

- Review in proportion to size: L/XL epics get 3-charter review (code, tests, docs); S/M epics get one combined
  reviewer.
- Phase 2 and 3 PRs report the performance delta against the E10 baseline.

---

## Programme shape

| Phase / lane                        | Epic                                           | Size          | Release                       | Class guard (fails if the class returns)                                                              |
| ----------------------------------- | ---------------------------------------------- | ------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| 0 Contain & baseline                | E9 Baseline, advisory, urgent fixes            | S (7)         | **v1.2.0**                    | `prepublishOnly` package allowlist                                                                    |
| 1 Safety net                        | E10 Behaviour-first test contract              | M (5)         | —                             | Artefact JSON Schemas; behavioural consumer invariant; parity/determinism e2e; perf baseline          |
| 2 No silent coverage claim, no leak | E11 Audited view and auth liveness             | XL (9)        | —                             | `viewStatus` allowlist + audited-view matrix (also under CDP); no `AxeBuilder` outside `auditView`    |
| 2                                   | E12 Secrets as a declared class                | L (6)         | —                             | Canary-secret sweep of outDir/logs; write-time detector; two-origin egress matrix                     |
| 2                                   | E13 Run lineage, effectiveness, exits          | L (7)         | —                             | Lineage replay suite; `rulesRun=0` non-auditable; exit-composer table test                            |
| 2                                   | E14 Supervised run lifecycle                   | M (6)         | **v2.0.0-alpha.1**            | SIGKILL / browser-death / hung-view e2e; injective evidence-path property test                        |
| Lane C                              | E15 Independent single-cause fixes             | S (9)         | (any time after v1.2.0)       | Path lint, control-byte lint, per-fix tests                                                           |
| Lane C                              | E16 Governance, CI and docs truth              | M (9, sliced) | (dependency slice before E18) | Blocking audit, Dependabot, gen-types diff, coverage floors, mutation smoke, doc-truth guards         |
| 3 Trustworthy population            | E17 Effective config contract                  | L (8)         | —                             | Raw-validation of every committed config; field-runtime recording invariant; action-variant invariant |
| 3                                   | E18 Toolkit as crawl authority                 | XL (9)        | —                             | Crawl-level fixture; loopback-bind guard                                                              |
| 3                                   | E19 Process states as first-class views        | L (7)         | **v2.0.0-alpha.2**            | `processOutcomes` consumer invariant; real-browser processes e2e                                      |
| 4 Honest record                     | E20 Consumer-aligned contracts                 | M (5)         | —                             | Consumer drift check (pre-release gate)                                                               |
| 4                                   | E21 Evaluation scope and automation competence | L (6)         | —                             | Competence invariant unit lock; version x level matrix                                                |
| 4                                   | E22 Sample manifest and Step 3-5 record        | L (6)         | **v2.0.0-beta.1**             | Sampler determinism/exclusion tests; manifest-derived record tests                                    |
| 5 Truthful surfaces                 | E23 Shared human report model                  | L (4)         | —                             | Renderer parity; maximal self-axe; hostile-content e2e                                                |
| 5                                   | E24 Machine projections                        | M (5)         | **v2.0.0** (with Lane C done) | JSON-LD expansion; XML well-formedness property test                                                  |
| 6 Capabilities                      | E25 (recommended) - E31                        | per ADR       | v2.1+                         | per ADR                                                                                               |

**Dependency notes**

- **Spine:** E9 -> E10 -> E11 -> E12 -> E13 -> E14 -> E17 -> E18 -> E19 -> E20 -> E21 -> E22 -> E23 -> E24.
- **Phase 2:**
  - E12 needs E11's preflight final origin.
  - E13 needs E11's `rulesRun`.
  - E14 needs E12's serialiser and E13's manifest.
- **Phase 3:**
  - E17 R6 provides the scope primitive for E21.
  - E18 needs E11 (landed facts), E12 (scoped auth), E16 R1 (dependency hygiene) and E17 R5 (host normalisation).
  - E19 needs E17 R3/R4.
- **Phase 4:**
  - E20 must precede E21: the explicit status and consumer alignment have to exist before the score semantics
    change.
  - E22 needs E18 (inventory status, cluster members) and E13 (manifest).
- **Lane C:** E15 should land early to minimise rebase friction with E18. Its last slice (the 2.0.0 Migration
  guide) lands after E24.

---

## Commit sequence by epic

### Phase 0: Contain and baseline

#### E9: Baseline, advisory and urgent fixes (`chore/v1.2.0-baseline`)

**Root cause (TEST-06, OPS-07, REPA-11; SEC-08, OPS-13 and SEC-10 are independent):** three separate problems.

- **Release drift.** The release state and the board drifted from the code: main stamps 1.1.0 after 55
  behaviour-changing commits, and `[Unreleased]` has no BREAKING block.
- **Packaging.** The npm `files` list overrides `.gitignore`.
- **Public claim.** A public bot page claims behaviour that does not exist.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Closes                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| R1  | `docs(review): record the 2026-09-30 gap review` — `docs/reviews/2026-09-toolkit-gap-review.md` (the delivered REPORT.md plus the REPB-02 portal-master re-check) and `docs/reviews/2026-09-probes/`, with the probe sources extracted from the journals                                                                                                                                                                                                                                                                 | —                              |
| R2  | `docs(board): reconcile TODO with verified state` — corrects the tracked-stale items (PROC-01, PROC-02, T-B text), adds new-info notes, and makes this programme the active board                                                                                                                                                                                                                                                                                                                                        | REPA-11                        |
| R3  | `docs: known-issues advisory for 1.2.0` (containment, not closure) — README and user-manual "Known limitations in 1.2.0" covering: verify auth sessions manually (SEC-01); read automated `passed` as "no failures detected" (A01); check rule counts and tag names (SCAN-04); `allowed-hosts` and root redirects (A06); no real passwords in `fill` (PROC-08); headers reach third parties (SEC-02); report-builder draft drift (REPB-01); zero-coverage runs score 100 in the portal (REPB-02)                         | —                              |
| R4  | `fix(spike): public bot text states implemented behaviour` (ADR-0021 amended)                                                                                                                                                                                                                                                                                                                                                                                                                                            | SEC-10                         |
| R5  | `fix(package): allowlist shipped configs; neutral example target` — `files` narrowed to `configs/example-*.json` and `configs/legacy-events.json`. Class guard `scripts/check-pack.mjs` fails when a packed file is not committed at HEAD or has uncommitted changes; it runs as `prepublishOnly`, in CI with planted canary configs, and as an explicit step in ADR-0015's publish flow. legacy-events moves to example.com with generic paths and no process. Gitignore covers `configs/**/*.json*`. ADR-0014 amended. | SEC-08, OPS-13                 |
| R6  | `chore(release): cut 1.2.0` — BREAKING/Migration notes for E1-E8; the ADR-0011 exception recorded; `markdownReport` removal re-dated to 2.0.0 (ADR-0015)                                                                                                                                                                                                                                                                                                                                                                 | OPS-07, TEST-06 (release half) |
| R7  | `feat(version): stamp gitSha/dirty when run from a checkout` — git calls strip inherited `GIT_*` location variables (shared `src/lib/git-env.mjs`) and never write the index; hermetic tests; ADR-0007 §5 and the CHANGELOG record the new `tool` keys                                                                                                                                                                                                                                                                   | TEST-06                        |

**Post-merge:** Jamie tags `v1.2.0`. The release notes carry the R3 advisory.

### Phase 1: Safety net

#### E10: Behaviour-first test contract (`test/behaviour-contract`)

**Root cause (B04):** the gate measures whether code runs, not whether it behaves correctly.

- Fixtures lack the data that distinguishes right from wrong.
- Invariants grep source text.
- The artefact seam is typed `any`, and the toolkit's own public artefacts have no schema.

| #   | Commit                                                                                                                                                                                                                                                                                                                              | Closes                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| R1  | `types+schema: artefact typedefs and public artefact schemas` — JSDoc typedefs for PageViewResult/ProcessState/Summary (tsc checks producers and consumers); JSON Schemas with `schemaVersion` for `summary.json`, `wcag-em-summary.json` and axe-results entries; every write is validated in tests                                | TEST-11                                                        |
| R2  | `test: shared artefact fixture builder` — every variant: errored/challenge/empty/redirect-duplicate with residual rule data, incompletes with examples, processes with states, two viewports. **Migrations:** inline fixtures in `summarize-url-dedup`, `summarize-execution-health` and the reporter tests move onto the builder   | TEST-02                                                        |
| R3  | `test: behavioural consumer invariant` — the fixture set runs through summarize, group-findings, wcag-em-summary, portal-export and the html/markdown Scan health with outcome assertions; grep guards become tripwires that assert at least one match                                                                              | TEST-03                                                        |
| R4  | `test: shared runChild and timing hygiene` — no wall-clock upper bounds; adds assertions to the test that had none; fixes the dead default-port test                                                                                                                                                                                | TEST-12, TEST-04 (class fix; instance inversions per schedule) |
| R5  | `test(e2e): parity, determinism and performance baseline` — default two-viewport audit; seeded rule IDs and SC outcomes consistent across all 7 reporters; a permanent raw-axe differential fixture; two same-seed runs diff clean under varied `TZ`/`LANG`; baseline wall-clock for this run and a 50-page synthetic scan recorded | TEST-05                                                        |

### Phase 2: No silent coverage claim, no leak

#### E11: Audited view and auth liveness (`feat/audited-view`); ADR-0023, which amends ADR-0006, 0017, 0019 and 0020

**Root cause (A05, A04 core, B03(1)):** the decision "this page-view is the page we meant, in the state we meant,
and axe really audited it" is wrong in four ways:

- it is implemented in two divergent copies;
- it uses a lossy classifier;
- it runs before setup;
- a DOM-mutating screenshot sits on its critical path.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Closes                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| R1  | `docs(adr): ADR-0023 audited-view contract`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                |
| R2  | `refactor(scan): extract auditView() and resolveAxeProfile()` — behaviour-neutral: the current rule-selection semantics move unchanged into one resolver; one classifier, body probe and result builder; source invariant: no `new AxeBuilder` outside the helper (at least one match asserted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                |
| R3  | `feat(scan): record LandedFacts` — main-frame navigation response captured by a listener (not `goto`'s return value); `{httpStatus, contentType, requestedUrl, finalUrl, redirected, finalUrlInScope, viewportWidth, viewportHeight}` on every entry; schema bumped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | (enabler)                                                        |
| R4  | `feat(scan): two-phase classification with an allowlisted vocabulary` — **pre-setup** from landed facts, in priority order: challenge (`cf-mitigated`) > `unauthenticated` (401/403 with auth configured, or a login-pattern final URL) > `http-error` > `off-scope` > `non-html`. **Post-setup and settle**, from the DOM: `empty` by element/replaced-element count across open shadow roots and frames; challenge-platform markers (never cf-ray alone); closed shadow roots via an `attachShadow({mode:'closed'})` init-script counter plus a bounded declarative check, disclosed and routed to manual review. `viewStatus` allowlists `ok` only. `http-error` views keep their findings but do not count as covered. A setup failure gives `degraded` with a disclosure. The E10 R3 invariant gains every outcome. | SCAN-01, SCAN-06, SCAN-07, SCAN-13, STRESS-05                    |
| R5  | `feat(auth): session liveness contract` — `auth.verify {url, expectSelector \| loginUrlPattern}` is required with `storageState` (`verify:false` is an opt-out, and it is disclosed). A preflight liveness check exits 1. Mid-run 401/403 or a login-pattern URL -> `unauthenticated`. Under CDP the session check is optional; without it, "liveness unverified" is disclosed. A missing or unparseable `storageState` is fatal at load and resolved relative to the config file. Auth status goes in `executionHealth`. **Migrations:** `example-site-with-auth.json` gains `verify`; config-guide §5 paths                                                                                                                                                                                                            | SEC-01                                                           |
| R6  | `fix(scan): independent settle; evidence after axe` — bounded settle; `domcontentloaded` with subresources bounded; screenshot after axe with `caret:'initial'`, its own timeout and try/catch (`screenshotError`); `fullPageScreenshots:false` means the same for pages and processes. **Migrations:** the E10 R5 1.4.12 assertion flips                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | SCAN-08, SCAN-09, SCAN-11, E2E-01, OPS-10, STRESS-03 (scan half) |
| R7  | `feat(scan): effective-scan provenance` — `rulesRun`, `toolOptions` and `testEngine.version` recorded per view (the runtime version is the source of truth); e2e asserts the persisted options and rule counts for `withRules`, `withTags`, `runOnly` and an override                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | SCAN-22                                                          |
| R8  | `feat(process): the process axe step uses auditView` — configured profile and overrides (so target-size is evaluated); the latest main-frame response; the challenge wait; Playwright per-action `timeout`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | PROC-03, PROC-01, PROC-12                                        |
| R9  | `test(e2e): audited-view matrix, also under CDP` — dead at start (exit 1); revoked mid-run (`unauthenticated`, coverage none); 429; off-origin redirect; SPA recipe; web-component shell; banner screenshot; 200 + cf-ray article; closed shadow root; same-origin, cross-origin and sandboxed iframes; hung subresource                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | (net)                                                            |

#### E12: Secrets as a declared class (`feat/secrets-model`); ADR-0024, which amends ADR-0004

**Root cause (A07):** the toolkit has no notion of a sensitive value. So egress cannot be scoped, and a leak at
persistence cannot be detected.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Closes          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| R1  | `test(spike): egress mechanism matrix` (test-only) — whether a `route.fulfill`ed 3xx from `route.fetch({maxRedirects:0, headers})` re-enters the route; in-scope `route.fallback({headers})`; `page.route` under CDP; `serviceWorkers:'block'`; whether the HTTP cache is disabled                                                                                                                                                                                                                                                                                          | —               |
| R2  | `docs(adr): ADR-0024 secrets model` (decided from R1's evidence; the residual risk and cache cost are disclosed)                                                                                                                                                                                                                                                                                                                                                                                                                                                            | —               |
| R3  | `feat(config): declared secret set` — `httpCredentials.password`, values marked `sensitive:true` and `valueFromEnv` values, plus their derived encodings; anything shorter than 8 characters is rejected; an Ajv keyword rejects URL userinfo; `normalizeUrl` strips userinfo                                                                                                                                                                                                                                                                                               | SEC-20, SEC-06  |
| R4  | `feat(secrets): scrub at ingress, detect at egress` — `scrubSecrets()` at the error-capture sites, snippet capture, pino formatters/hooks, `asHandler`, `unhandledRejection`, and a Crawlee log bridge that also strips ANSI at warn level. One shared serialiser for `writeJson`, `writeText` and later the E14 journal **fails the write** if a raw secret appears. Canary tests with `"`, `\`, `&`, `<` and a 1-character header: grep the outDir and logs, check every JSON still parses and `TOOL_IDENTITY` is intact. Pino paths tested; `WCAG_EM_LOG_LEVEL` honoured | PROC-08, SEC-12 |
| R5  | `feat(auth): scope credential egress` — `httpCredentials.origin` set to the root's final origin (from E11 preflight); `allowed-hosts` with credentials but no explicit origin is a load error; headers via the ADR-0024 mechanism; e2e covers a navigation 302 off-origin, a script 302 to a third party, a cross-origin iframe and a service worker                                                                                                                                                                                                                        | SEC-02          |
| R6  | `feat(evidence): opt-in masking for authenticated scans`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | SEC-22          |

#### E13: Run lineage, effectiveness and exit taxonomy (`feat/run-lineage`); ADR-0025 "run integrity", which amends ADR-0001, 0008 §5 and 0011:47

**Root cause (B02, A08(2), SCAN-20):**

- Stage artefacts carry no run identity, so summarize fills in defaults for missing, corrupt or stale inputs.
- Nothing asserts that a run audited anything.
- New outputs need an escaping policy before they are written.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Closes                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| R1  | `feat(reporters): one escaping primitive per output format` — `_text.mjs`: `mdText()` (every free-text interpolation, fenced multi-line errors, variable-length fences) and `xmlText()`/`xmlAttr()` (the full XML 1.0 Char production, including the `<error>` CDATA); hostile-content canaries                                                                                                                                                                | REPA-01, REPA-14, REPB-05                |
| R2  | `docs(adr): ADR-0025 run integrity` — exit codes: 0 ok, 1 runtime/config/reporter error, 2 findings, 3 coverage inadequate, 4 lineage/integrity (checked against Node 22's reserved codes and reassigned if they collide); precedence `1 > 4 > 3 > 2 > 0`; signals 130/143; `audit` still reports on 3/4; `summary.exitReasons[]`; coverage adequacy = audited **or dispositioned**; the needs-review vs failOnFindings decision; the lifecycle design for E14 | —                                        |
| R3  | `feat(artefacts): run-manifest.json` — per stage: `{runId, stage, startedAt, finishedAt, configSectionsHash (only the sections it reads, secrets excluded), inputDigests, outputDigests, tool}`; artefact shapes and names unchanged                                                                                                                                                                                                                           | (enabler)                                |
| R4  | `feat(summarize): strict lineage loader; reporters consume loaded data` — required, missing, corrupt or digest-mismatched inputs -> exit 4; `--accept-unlinked-artefacts` opt-out (disclosed); `pagesSelected` comes from the sample; over-coverage is an integrity error; html, portal and starter take their data from `ctx`                                                                                                                                 | STRESS-04, STRESS-07, STRESS-08          |
| R5  | `feat(coverage): effectiveness invariant and dispositions` — `rulesRun === 0` is non-auditable; coverage is computed per page via `viewIdentity`; `sample.dispositions [{urlPattern, reason}]` and the manual-review queue count as dispositioned; `reporting.coverage {policy: strict\|warn, minAuditedRatio?}` (strict by default) -> exit 3, listing only undispositioned gaps. **Migrations:** `scan-health` e2e -> 3; builder fixtures carry rule detail  | SCAN-04 (runtime half), VERD-09, SCAN-20 |
| R6  | `feat(exports): explicit run status` — portal top-level `status` (`failed` when nothing was audited); JUnit could-not-audit -> `<error>`; the draft says "no page audited" separately from "no rule covers"; the target file is tombstoned before validation; a reporter failure is recorded and never masked by exit 2                                                                                                                                        | REPB-02, REPB-10, REPA-15 (exit half)    |
| R7  | `feat(cli): one exit composer and explicit termination` — every stage returns an exit code; one composer shared by `bin` and `runAudit`; `process.exit` after the logger flushes                                                                                                                                                                                                                                                                               | STRESS-01                                |

#### E14: Supervised run lifecycle (`feat/run-lifecycle`); ADR-0025 lifecycle section, which also amends ADR-0016

**Root cause (A08(1)):** nothing supervises a page-view's lifecycle.

- Only `goto` has a deadline.
- Allocation and release sit outside error handling.
- Results stay in memory until the end.
- Evidence filenames are not unique per URL.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Closes           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| R1  | `feat(scan): per-view supervisor` — `scan.viewDeadlineMs` covers allocate, navigate, audit and release. The supervisor owns `seenFinalUrls` and the evidence paths. On expiry it closes the page (CDP) or context (launch), then awaits the abandoned work with a bounded grace via `rejectAfter`'s `{promise, cancel}`. Allocation and release errors become per-view errors. The session is in a try/finally. On disconnect it relaunches; under CDP the run fails with partial results persisted | SCAN-02          |
| R2  | `feat(scan): crash-safe journal` — per-view JSONL through the E12 serialiser; atomic finalisation to `axe-results.json` (same public shape); SIGINT/SIGTERM checkpoint; a truncated last line is tolerated and disclosed                                                                                                                                                                                                                                                                            | SCAN-03          |
| R3  | `feat(cli): safe resume` — `audit --from <stage>` and scan resume, both lineage-checked                                                                                                                                                                                                                                                                                                                                                                                                             | OPS-14           |
| R4  | `fix(evidence): unique evidence paths` — bounded slug plus a short hash for page and process screenshots; paths relative to outDir, resolved by one helper                                                                                                                                                                                                                                                                                                                                          | SCAN-10, REPB-18 |
| R5  | `feat(scan): bounded node evidence and explicit target paths` — per-rule node cap keeping `nodesCount`; explicit shadow/frame targets; streaming replaces the single huge stringify                                                                                                                                                                                                                                                                                                                 | SCAN-14, SCAN-16 |
| R6  | `test(e2e): lifecycle under stress` — SIGKILL, browser death, a hung view, resume after kill; also under CDP                                                                                                                                                                                                                                                                                                                                                                                        | (net)            |

### Lane C (parallel; each PR based on `main`)

#### E15: Independent single-cause fixes (`fix/independent-root-fixes`)

Each commit fully fixes a defect that shares no root with the others; they are grouped here only for review
convenience.

| #   | Commit                                                                                                                                                                                        | Closes                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| R1  | `fix(paths): one file-URL idiom` — `fileURLToPath` everywhere; `realpathSync` main-module guard; lint bans `.pathname` on `import.meta.url`                                                   | VERD-13, OPS-11 (path half)       |
| R2  | `fix(source): no raw control bytes in src` (`\u0000`; lint check)                                                                                                                             | TEST-09                           |
| R3  | `fix(discover): document patterns are case-insensitive`                                                                                                                                       | DISC-21                           |
| R4  | `fix(discover): read error from the handler argument`                                                                                                                                         | DISC-24                           |
| R5  | `fix(backlog): always emit the 1.4.11 item` (**Migrations:** invert `manual-backlog.test.mjs:28`)                                                                                             | CAP-04                            |
| R6  | `fix(version): resolve axe-core's own version` (**Migrations:** invert the `TOOL_IDENTITY.axeCore` test in `version.test.mjs`)                                                                | VERD-11                           |
| R7  | `docs+test: naming drift fixed with its guard` — ADR paths resolve; config enum values and `auth.*` names quoted in docs exist in the schema; the ADR reporter count equals `listReporters()` | DISC-26, DISC-17, CAP-22, REPA-16 |
| R8  | `fix(scripts): npm stage scripts route through the CLI`; standalone main blocks deleted                                                                                                       | OPS-02                            |

#### E16: Governance, CI and documentation truth (`chore/governance-truth`; landed in slices)

**Root cause (B05, A19 residue):** the governance docs describe mechanisms that were never built, and nothing
mechanical catches drift in dependencies, releases, platforms or data.

| #   | Commit                                                                                                                                                                                                                            | Closes                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| R1  | `ci: dependency hygiene` (lands before E18) — Dependabot for npm and actions; blocking `npm audit --omit=dev --audit-level=high` with a dated allowlist; actions SHA-pinned; cf-worker lockfile                                   | SEC-09                             |
| R2  | `ci: coverage floors and mutation smoke` — floors on `src/`; `scripts/mutation-smoke.mjs` over the verdict, evidence, exit and sampling functions                                                                                 | TEST-01, T-D                       |
| R3  | `ci: release and platform truth` — `tags: ['v*']` trigger and release job; Node 22 + 24 matrix; macOS; Windows smoke; gen-types `git diff --exit-code`; `--max-warnings 0`; concurrency fix; non-blocking axe latest-minor canary | TEST-07, TEST-08, OPS-11 (CI half) |
| R4  | `chore(types): checkJs decision` (enable it, or amend ADR-0001/CONTRIBUTING)                                                                                                                                                      | TEST-10                            |
| R5  | `test(docs): truth guards` — config-guide defaults and ranges vs DEFAULTS + schema; output-file names vs an e2e run                                                                                                               | OPS-09                             |
| R6  | `feat(data): ACT ids derived from axe` (`axe.getRules()`; stub script retired)                                                                                                                                                    | VERD-12, T-Q                       |
| R7  | `feat(transport): transport and engine in run metadata`; CDP isolation guidance; CDP example fixed; PROC-18 intent documented                                                                                                     | SEC-14, SEC-15                     |
| R8  | `fix(spike): key handling and worker hygiene`                                                                                                                                                                                     | SEC-16, SEC-17                     |
| R9  | `docs: governance truth pass and 2.0.0` (lands last, after E24) — install path; ADR-0001/0003/0006/0015 match reality; CLI claims; `[2.0.0]` Migration guide; release checklist including a manual AT pass over summary.html      | OPS-03, OPS-08, SCAN-21 (doc half) |

### Phase 3: Trustworthy population

#### E17: Effective config contract (`feat/effective-config-contract`); ADR-0022, which amends ADR-0002 and ADR-0005

**Root cause (B01(1), A14 schema, SCAN-04/05/17/19, DISC-19):** there is no single effective-config contract.

- The raw file is never validated: the merge runs first, so nulls vanish and `__proto__` is honoured.
- The schema accepts fields the runtime never reads and shapes it cannot run.
- The axe profile is not tied to the declared scope.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Closes                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| R1  | `docs(adr): ADR-0022 effective config contract`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                            |
| R2  | `feat(config): validate raw config before merge` — BOM strip; `ConfigLoadError`; a raw-schema variant (explicit `null` rejected except `runOnly`); proto-safe merge; Ajv frames on the raw text; `loadAndValidateConfig` exported; readability checked before load; `executablePath()` preflight; log-level `.choices()`; a "run sample first" hint; no silent default config. **Migrations:** `configs-valid` validates for real (new defect); `context-paths`/`config-defaults` tests updated                                                                                                                                        | OPS-04, OPS-05, OPS-06, SEC-19, SEC-18, (new: configs-valid) |
| R3  | `feat(schema): per-action variants and process constraints` — `oneOf` on `action`; screenshot name pattern; closed `fields`; `steps`-or-`pattern`; unique names. **Migrations:** the invariant derives from `oneOf[*].properties.action.const`; `gen:types` in the same commit                                                                                                                                                                                                                                                                                                                                                         | PROC-15, PROC-20                                             |
| R4  | `test(config): schema-to-runtime field invariant` — a recording Proxy over the effective config during the two-viewport e2e and the process-runner units. `KNOWN_UNREAD` = `{processes[].stepTimeoutMs, steps[].urlPattern}` (emptied in E19) plus `auth.setupScript` (accepted and warned until T-O)                                                                                                                                                                                                                                                                                                                                  | (guard)                                                      |
| R5  | `feat(config): normalise and constrain at load` — `allowedHosts` normalised and validated; `scope.includeSubdomains` removed (load error with a migration note); unique viewport IDs; `randomSeed >= 1`; `reporting.markdownReport` removed (deprecated since Layer 4; ADR-0015 amendment)                                                                                                                                                                                                                                                                                                                                             | DISC-19, SCAN-19                                             |
| R6  | `feat(scope): evaluation-scope primitive` — `src/data/wcag-sc-table.json` (versioned: `level`, `introducedIn`, `removedIn`; `_meta` cites the W3C recommendations) replaces the `SC_LEVEL_MAP` literal; `resolveEvaluationScope()` returns the in-scope SCs and the implied tags; pairing test                                                                                                                                                                                                                                                                                                                                         | (foundation)                                                 |
| R7  | `feat(axe): resolveAxeProfile semantics` — non-empty `withRules`/`withTags` are exclusive; `enableRules`/`disableRules`; in rule-list mode `frame-tested` and enabled rules are appended; an override that sets any selection key replaces the whole selection; tags and IDs validated against `axe.getRules()`; the default profile is derived from the scope (DEFAULTS no longer hard-codes `withTags`); a profile that overshoots or undershoots the scope warns (and fails under strict); `extraTags` added; README fixed. **Migrations:** `config-defaults.test.mjs:88`; the `applyAxeOverride` pin; the template adds `wcag22aa` | SCAN-04, SCAN-05, SCAN-17, OPS-01                            |
| R8  | `feat(cli): wcag-em config check` — the effective config with secrets masked, the derived scope and axe profile, and migration hints for 1.x keys (`includeSubdomains`, `withTags` semantics, `auth.verify`, coverage policy, `reporting.markdownReport`)                                                                                                                                                                                                                                                                                                                                                                              | (migration aid; strengthens the OPS-01 disclosure)           |

#### E18: The toolkit as crawl authority (`feat/crawl-authority`); ADR-0027, which amends ADR-0018, 0019 and 0021

**Root cause (A06, A11 shared, A12, STRESS-02):** discover hands authority to Crawlee's defaults.

- There is no admission gate where a page is recorded.
- The crawler is built without the run context.
- The sitemap walker is unbounded.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Closes                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| R1  | `docs(adr): ADR-0027 crawl authority`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                    |
| R2  | `feat(discover): buildCrawlerOptions(ctx)` — Crawlee `Configuration` storage under outDir, per run; E12-scoped auth; one identifying-UA policy shared with scan; a `domcontentloaded` pre-navigation hook; a global rate limit plus Retry-After; the proxy shim loaded before crawlee (proxy-chain resolved via `createRequire` from browser-pool) defaults the host to loopback, with an upstream PR filed; a `net.Server.prototype.listen` guard test. **Migrations:** `discover-no-locator-invariant` | DISC-05, DISC-06, DISC-16, STRESS-02 |
| R3  | `feat(discover): admitPage on E11 landed facts` — the final URL is checked against scope and exclusions; 2xx and HTML required; the shared classifier rejects challenges and login walls; enqueue strategy `all` (counts the redirect rejections Crawlee no longer makes); inventory entries carry status, contentType, sourceUrl, finalUrl and pageOutcome; rejections counted with examples; preflight fails when the root redirects to another origin                                                 | DISC-01, DISC-02, DISC-03, DISC-07   |
| R4  | `feat(discover): URL identity` — navigate the as-linked URL; `normalizeUrl` is used only as the `uniqueKey`; session-id, `/index.html` and canonical policy                                                                                                                                                                                                                                                                                                                                              | DISC-09, DISC-20                     |
| R5  | `feat(discover): accounting and ordering` — `reachedMaxPages` from crawler stats; no overshoot; seed and link crawls interleaved; truncation independent of concurrency; settle plus `area`, `role=link` and post-load links                                                                                                                                                                                                                                                                             | DISC-04, DISC-12, DISC-13, DISC-15   |
| R6  | `feat(sitemap): bounded, standards-correct walker` — entities, CDATA and namespace prefixes; gunzip; robots `Sitemap:`; timeout and byte cap; UA and auth; scope check and protocol allowlist for child sitemaps; failures recorded; duplicates kept separate from clipped URLs                                                                                                                                                                                                                          | DISC-10, DISC-11, SEC-13, SEC-21     |
| R7  | `feat(discover): robots policy and crawl health` — opt-in `respectRobotsTxtFile`; a crawl-health block in `executionHealth`, Scan health and `scanWarnings`                                                                                                                                                                                                                                                                                                                                              | DISC-18, DISC-08                     |
| R8  | `fix(discover): PDFs are inventoried, never crawled`                                                                                                                                                                                                                                                                                                                                                                                                                                                     | CAP-11                               |
| R9  | `test(e2e): crawl-level fixture` — two hosts; redirects to excluded paths and off-host; 404/JSON/RSS links; Basic auth; low maxPages; a stalled subresource; sitemap edge cases                                                                                                                                                                                                                                                                                                                          | DISC-25                              |

#### E19: Process states as first-class views (`feat/process-views`)

**Root cause (A03, A04 patterns, A14 runtime):**

- Process states carry no location or provenance.
- Process coverage comes from config rather than from what ran.
- Patterns never establish the state they label.

| #   | Commit                                                                                                                                                                                                                                                                                                 | Closes                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| R1  | `feat(process): state provenance and stop-on-failure` — every state records `{url, title, stepIndex, action, viewport, screenshot}`; a run stops at its first failure and the remaining steps are recorded `not-run`; `viewStatus` gains `degraded` and `not-run`; `viewIdentity` resolves `state.url` | PROC-04, VERD-06          |
| R2  | `feat(process): processOutcomes() as the single derivation` — routed through summary, health, the draft and the portal; invariant extended                                                                                                                                                             | PROC-02                   |
| R3  | `feat(process): honour schema-accepted fields` — timeout precedence `step.timeoutMs > stepTimeoutMs > scan.timeoutMs`; `urlPattern` gating; `KNOWN_UNREAD` reduced to `auth.setupScript`                                                                                                               | PROC-09, PROC-10          |
| R4  | `fix(process): patterns establish their state` — submit scoped to the form; ambiguity warning; settle; landed URL and title; an unverified-state flag                                                                                                                                                  | PROC-06, PROC-07          |
| R5  | `feat(process): live-submission safety` — warning; per-process `viewports` filter; documented production workflow                                                                                                                                                                                      | PROC-13                   |
| R6  | `feat(process): provenance through every surface` — reports show the state screenshot and URL; Scan health errors are single-line via `mdText`; process findings flow through EARL, JUnit, portal and the draft; visited pages recorded; process candidates reconciled                                 | PROC-05, PROC-19, PROC-17 |
| R7  | `test(e2e): real-browser scan-processes`                                                                                                                                                                                                                                                               | PROC-16                   |

### Phase 4: Honest record

#### E20: Consumer-aligned contracts, toolkit side (`feat/consumer-contracts`); ADR-0028

**Root cause (A10):** the exporters are checked only against copies of the consumer contracts that the toolkit
wrote itself. The report-builder copy has drifted, and the portal copy was derived wrongly.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                        | Closes  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| R1  | `docs(adr): ADR-0028 consumers are the contract source of truth`                                                                                                                                                                                                                                                                                              | —       |
| R2  | `fix(report-builder): conform to the current DraftReportSchema` — regenerated at `3a5fac1`, with the SHA recorded in `_meta`; adapt reportType, finding status and the sourceFile refinement                                                                                                                                                                  | REPB-01 |
| R3  | `fix(portal-export): emit the fields the portal reads` — `instances[].htmlSnippet` (`evidence.html` kept); the schema covers E13's `status`; derived from the adapter behaviour at portal `4fdaa9cc`; `contractVersion` added                                                                                                                                 | REPB-03 |
| R4  | `test(contracts): consumer drift check` — `npm run contracts:check` runs each consumer's own `safeParse` (including superRefine) and canonical adapter, in that consumer's workspace and toolchain, against a committed fixture corpus, and asserts that fields survive; it is a required pre-release gate if CI cannot reach the consumers                   | REPB-21 |
| R5  | `docs: verified integration behaviour and change requests` — `docs/consumer-change-requests.md`. **Portal**, a release gate under D5: "awaiting manual review" instead of a fallback score; honour `scoreBasis` and coverage; no derived score for `failed`; the customizationKey migration for E24 R4. **Report-builder:** per-SC notes; `notTested` display | REPB-11 |

#### E21: Evaluation scope and automation competence (`feat/evaluation-model`); ADR-0029 (supersedes part of ADR-0007, amends ADR-0009); BREAKING

**Root cause (A01, A02):** there is no competence model and no versioned scope. So single rule results become SC
verdicts, and SCs outside the declared scope are emitted and scored.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                     | Closes                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| R1  | `docs(adr): ADR-0029` — the invariant that automation never emits criterion-level `passed`/`inapplicable`; `cantTell` + `automatedResult` (valid EARL, and enum-valid in both consumers); before/after numbers from the 2026-06-16 baseline; any "fully automatable" entry needs ACT provenance                                                            | —                         |
| R2  | `feat(summary): apply the evaluation scope everywhere` — `beyondScope` is advisory and never scored; 4.1.1 is absent from the 2.2 scope; references are version-specific. **Migrations:** invert `wcag-em-summary.test.mjs:440`                                                                                                                            | VERD-03, VERD-05, VERD-04 |
| R3  | `feat(summary): automation-competence invariant` — `src/data/sc-automation-competence.json` (`_meta` cites the ACT outcome mapping); partially automatable SCs with no failures get `cantTell` + `automatedResult` + `requiresManual: true`; the draft carries this via `notes`; unit lock. **Migrations:** E10 R5 outcome assertions                      | CAP-01                    |
| R4  | `feat(summary): one SC-keyed manual scope; no automated score` — SC-keyed backlog items `{sc, level, understandingUrl, relatedRules, pages, procedure}` feed the draft and the docs; portal-export omits `averageScore` and adds `scoreBasis.requiresManual` (D5). **Migrations:** invert the `averageScore` pin; CHANGELOG BREAKING plus the release gate | VERD-02, CAP-03, CAP-21   |
| R5  | `feat(summary): honest page accounting per SC` (`pagesWhereApplicable`, `statesExamined`)                                                                                                                                                                                                                                                                  | VERD-15                   |
| R6  | `test: 2.0/2.1/2.2 x A/AA/AAA matrix with real axe tags; portal before/after snapshots`                                                                                                                                                                                                                                                                    | (net)                     |

#### E22: Sample manifest and the WCAG-EM Step 3-5 record (`feat/sample-manifest`); ADR-0030

**Root cause (A09, A13):**

- The sample handoff is a bare `string[]`.
- The seeded primitive is neither validated nor tested.
- Every Step 3-5 field is rebuilt ad hoc by each consumer.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                             | Closes                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| R1  | `docs(adr): ADR-0030 sample manifest`                                                                                                                                                                                                                                                                                                                              | —                                                            |
| R2  | `fix(sample): validated seeded primitive` — mulberry32; seed validation; code-unit sort; a pool fingerprint; the PRNG id and version recorded (BREAKING); determinism, exclusion and size tests                                                                                                                                                                    | SAMP-04, SAMP-08, SAMP-14, SAMP-10                           |
| R3  | `feat(discover): cluster members and anchored typing` — clusters keep their member lists; `guessPageType` anchored on path segments; `guessProcessTypes` matches the pathname only; tests; config guide updated                                                                                                                                                    | DISC-14, SAMP-06                                             |
| R4  | `feat(sample): typed sample manifest` — each entry `{url, tier, source, clusterKey, pageType, inInventory, inScope, finalUrl, status, rationale}`; `sample.json` becomes a derived view; the random pool excludes structured URLs by final identity and ineligible statuses; process URLs are checked; integrity guards                                            | SAMP-09, SAMP-11, SAMP-01, SAMP-02, SAMP-13                  |
| R5  | `fix(sample): perCluster means pages per cluster` — cluster-coverage table; essential functionality and process-entry pages included                                                                                                                                                                                                                               | SAMP-03, SAMP-07                                             |
| R6  | `feat(summary): Step 3-5 record derived from the manifest` — samplingMethodNotes; the 4.c comparison (rules, cantTell, clusters, all random pages); the 5.b specifics; examples keyed by `viewIdentity`; the backlog built once; WCAG-EM step anchors; draft boilerplate from run metadata; `atBaseline` and `scope.*` reach the draft (the CAP-13 data-loss half) | SAMP-05, VERD-08, VERD-10, VERD-19, CAP-05, SAMP-15, REPB-19 |

### Phase 5: Truthful surfaces (ADR-0031 for both report projections, written before E23)

#### E23: Shared human report model (`feat/human-report-model`)

**Root cause (A16, E2E-05):** two problems.

- **No shared model.** html and markdown each build their own sections.
- **No parity contract or single classification.** Each artefact classifies best-practice findings differently.

| #   | Commit                                                                                                                                                                                                                                                                                                                                  | Closes                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| R1  | `feat(reporters): _model.mjs` — the scope/method/coverage/sample blocks; the comparison; a per-SC table with Level, failing rules and a legend explaining `requiresManual`; WCAG findings with per-violation evidence (screenshot via `viewIdentity`); an advisory best-practice section; one `classifyFinding` used by all 7 reporters | REPA-02, REPA-03, REPA-04, REPA-13, REPA-17, VERD-14, E2E-05 |
| R2  | `fix(html): accessible report shell` — `<main>`, viewport meta, overflow-wrap; a maximal self-axe check (all tags, details open, 320px `scrollWidth`)                                                                                                                                                                                   | REPA-06, REPA-07                                             |
| R3  | `test(reporters): parity, isolation and hostile content` — viewport-only and best-practice-only fixtures; a throwing reporter is isolated; attacker-controlled content runs end-to-end                                                                                                                                                  | REPA-15 (test half)                                          |
| R4  | `docs: evidence packaging truth` — remove the "standalone" claim; the CI recipe uploads screenshots                                                                                                                                                                                                                                     | REPA-09, CAP-09 (docs half)                                  |

#### E24: Machine projections from a per-view index (`feat/machine-projections`)

**Root cause (A17, E2E-03, T-B):** the machine reporters project from the lossy, rule-grouped summary, and
nothing gives a run or a finding a stable identity.

| #   | Commit                                                                                                                                                                                                                             | Closes                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| R1  | `feat(summary): per-(url, viewport, rule) index` — built once; counts defined once (node hits vs distinct elements); viewport provenance kept throughout                                                                           | E2E-03, REPB-06, REPB-14, T-B  |
| R2  | `feat(earl): valid EARL from the index` — IRI coercion; EARL classes; SC-linked failures; criterion-level `earl:cantTell` for `requiresManual`; `earl:untested`; subjects for could-not-audit pages; JSON-LD expansion test        | REPB-07, REPB-08, REPB-09, T-J |
| R3  | `fix(junit): per-page evidence and run metadata`                                                                                                                                                                                   | REPB-20                        |
| R4  | `feat(identity): stable finding identity` — `sourceFingerprint` plus a stable representative selector; draft IDs derived from them; timestamps from the manifest. BREAKING: customizationKeys change once (see the E20 R5 request) | REPB-16, CAP-18, REPB-15       |
| R5  | `feat(portal-export): size budget`                                                                                                                                                                                                 | REPB-17                        |

### Phase 6: Capabilities (v2.1+; each epic = an ADR commit, then an implementation PR)

| Epic                                                               | ADR      | Scope                                                                                                                                                                                                                                                   | Closes                                                |
| ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **E25 Manual-result ingestion (recommended scope extension, T-L)** | ADR-0032 | An auditor-editable results file keyed by the E21 SC-keyed manual scope, merged by summarize into criteriaOutcomes (`earl:manual`), the portal (restores a decided score) and the draft                                                                 | (product loop; prerequisite for any decided `passed`) |
| E26 Page-view hook                                                 | ADR-0033 | `scan.emulation` (reducedMotion, colorScheme, locale, timezone, mobile/touch); opt-in `scan.measure` probes: 320px overflow and text-spacing (1.4.10/1.4.12), tab order, keyboard trap, focus style, pointer-only. Results are `cantTell` evidence only | CAP-07, CAP-08, SCAN-12                               |
| E27 Process DSL                                                    | ADR-0034 | `selectOption`, `check`, `hover`, `focus`, `setInputFiles`, frame prefix, `waitForURL`, `expect` (the E17 R3 invariant moves with them)                                                                                                                 | PROC-14                                               |
| E28 Output projections                                             | ADR-0035 | EN 301 549 / Section 508 map; statement inputs and Step 5c statement; WCAG-EM Report Tool export (CSV/SARIF stays out, per ADR-0011)                                                                                                                    | CAP-14, CAP-15, CAP-13                                |
| E29 Evidence and documents                                         | ADR-0036 | PDF triage; template-level dedupe; element crops, highlights and ariaSnapshot evidence                                                                                                                                                                  | CAP-12, CAP-10, CAP-09                                |
| E30 Second engine                                                  | ADR-0037 | An optional engine behind an adapter seam, with an agreement signal between engines (spike first)                                                                                                                                                       | CAP-16                                                |
| E31 Throughput                                                     | ADR-0038 | Bounded per-view concurrency on E14's journal; run budget; ETA                                                                                                                                                                                          | SCAN-21 (+ dup STRESS-06)                             |

---

## Cross-cutting schedules

### ADR amendment schedule

| ADR        | Epic(s)      | Change                                                                                                                |
| ---------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| 0001       | E13, E16     | Exit codes and signals; tooling claims                                                                                |
| 0002, 0005 | E17, E11     | Raw-then-merge validation; `storageState` fatal at load                                                               |
| 0004       | E12          | Redaction model                                                                                                       |
| 0006       | E11, E16     | Evidence taken after axe; scan stated as sequential                                                                   |
| 0007       | E9, E21      | `tool` stamp gains build provenance (E9); superseded in part by 0029 (E21)                                            |
| 0008 §5    | E13          | Exit precedence                                                                                                       |
| 0009       | E21, E24     | Criterion passes removed; EARL classes                                                                                |
| 0011       | E9, E13      | 1.2.0 exception; run manifest keeps artefact names stable                                                             |
| 0014       | E9           | `files` allowlists only committed configs; check-pack guard (SEC-08)                                                  |
| 0015       | E9, E16, E17 | markdownReport timing and pack guard in the publish flow (E9); release process (E16); markdownReport removed (E17 R5) |
| 0016       | E14          | Violation node cap                                                                                                    |
| 0017       | E11          | 4xx = audited and disclosed; vocabulary widened                                                                       |
| 0018       | E18          | Seed/link interleaving                                                                                                |
| 0019       | E11, E18     | Landed facts; as-linked identity                                                                                      |
| 0020       | E11, E16     | Liveness under CDP; transport metadata                                                                                |
| 0021       | E9, E18      | Bot-page claims; robots decision                                                                                      |

### Behaviour-pinning test inversions (TEST-04 schedule)

| Test                                                                 | Pinned behaviour                                     | Inverted in     |
| -------------------------------------------------------------------- | ---------------------------------------------------- | --------------- |
| `manual-backlog.test.mjs:28`                                         | 1.4.11 item suppressed                               | E15 R5          |
| `version.test.mjs` (`TOOL_IDENTITY.axeCore` test)                    | wrapper version reported as the axe version          | E15 R6          |
| E10 R5 cross-reporter assertions                                     | 1.4.12 caused by caret mutation; automated SC passes | E11 R6; E21 R3  |
| `scan-health.test.mjs:106`                                           | exit 2 on partial coverage                           | E13 R5          |
| scan-results consumer invariant raw-read regex                       | grep-only guard                                      | E10 R3 / E13 R4 |
| `configs-valid.test.mjs`                                             | `loadConfig` without validation                      | E17 R2          |
| `process-runner-invariant.test.mjs:40`                               | flat action enum                                     | E17 R3          |
| `config-defaults.test.mjs:88`; `axe-utils.test.mjs` applyAxeOverride | default withTags; merged override shape              | E17 R7          |
| `discover-no-locator-invariant.test.mjs:45`                          | handler location                                     | E18 R2          |
| `wcag-em-summary.test.mjs:440`                                       | 4.1.1 in the 2.2 scope                               | E21 R2          |
| `reporters-portal-export.test.mjs` averageScore                      | SC-ratio score                                       | E21 R4          |

### Config, fixture and doc migration ledger

| Item                                        | Epic           | Change                                                                   |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `configs/legacy-events.json`                | E9 R5          | example.com target; no live submit                                       |
| `configs/example-site-with-auth.json`       | E11 R5, E12 R3 | add `auth.verify`; the `X-Audit-Run` value is not a secret unless marked |
| config-guide §5 storageState walkthrough    | E11 R5         | paths are relative to the config file                                    |
| `sample.dispositions`, `reporting.coverage` | E13 R5         | documented in the production-audit workflow                              |
| `scope.includeSubdomains` users             | E17 R5         | migration note; `config check` hint                                      |
| `test/fixtures/site.json.template`          | E17 R7         | add `wcag22aa`                                                           |
| `configs/*.json` `withRules: []`            | E17 R7         | still valid (exclusivity applies to non-empty arrays)                    |
| README withTags example                     | E17 R7         | `extraTags`, or the full tag list                                        |
| `configs/example-site-with-cdp.json`        | E16 R7         | remove the ignored option                                                |

### Disposition of the 26 triage coverage gaps

| Gap                                                           | Disposition                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| CLI orchestration, args, engine-check                         | E15 R8, E17 R2, E13 R7                                                                  |
| Config typing drift                                           | E17 R3, E16 R3                                                                          |
| json/\_sort determinism                                       | E10 R5                                                                                  |
| Process findings through the exports                          | E19 R6                                                                                  |
| CDP and patchright paths                                      | E11 R9 and E14 R6 run under CDP; patchright stays opt-in (smoke in E16 R3 if installed) |
| TLS, corporate proxies, IPv6 literals                         | **Out of scope**; added to the board as a capability item                               |
| Interrupted / partial runs                                    | E14 R2, R6                                                                              |
| Scale and memory                                              | E14 R5, E18 R6, E31; perf budget from E10 R5                                            |
| Hostile page content end to end                               | E13 R1, E23 R3                                                                          |
| Windows paths                                                 | E15 R1, E14 R4, E16 R3                                                                  |
| Normative sources                                             | `_meta` provenance in E17 R6, E21 R3, E22 R6                                            |
| Real-world behaviour                                          | Dogfood diff at each alpha/beta and at v2.0                                             |
| Consumer rendering                                            | **Out of scope** (D2); E20 R5 change requests                                           |
| needs-review vs failOnFindings; ANSI logs; maxPages overshoot | E13 R2; E12 R4; E18 R5                                                                  |
| Repo-wide test adequacy                                       | E16 R2                                                                                  |
| Assistive-technology testing of reports                       | Manual AT pass in the release checklist (E16 R9)                                        |
| Real login journeys                                           | E11 R9 uses a captured storageState; SSO is **out of scope** (T-O)                      |
| Iframe ground truth                                           | E11 R9                                                                                  |
| scan-processes stress                                         | E19 R7                                                                                  |
| SIGINT mid-scan                                               | E14 R6                                                                                  |
| Round-2 artefacts vs live consumers                           | E20 R4                                                                                  |
| Locale and timezone determinism                               | E10 R5, E22 R2                                                                          |
| axe minor-version drift                                       | E17 R7, E16 R3, E16 R6                                                                  |
| Reporter rendering of new inputs                              | E23 R3                                                                                  |

---

## File-level summary

**New files**

- **`src/lib/`:** `audit-view.mjs`, `axe-profile.mjs`, `landed-facts.mjs`, `secrets.mjs`, `serialise.mjs`,
  `run-manifest.mjs`, `exit-codes.mjs`, `view-supervisor.mjs`, `evaluation-scope.mjs`, `crawler-options.mjs`,
  `admit-page.mjs`, `crawlee-proxy-shim.mjs`, `sample-manifest.mjs`, `process-outcomes.mjs`, `view-index.mjs`.
- **`src/reporters/`:** `_text.mjs`, `_model.mjs`.
- **`src/data/`:** `wcag-sc-table.json`, `sc-automation-competence.json`.
- **`schemas/`:** `summary.schema.json`, `wcag-em-summary.schema.json`, `axe-result-entry.schema.json`,
  `run-manifest.schema.json`.
- **`test/fixtures/`:** `artifacts.mjs`, `run-child.mjs`.
- **`scripts/`:** `mutation-smoke.mjs`, `contracts-check.mjs`.
- **`docs/`:**
  - `adr/0022-0038-*.md`
  - `reviews/2026-09-toolkit-gap-review.md` and `reviews/2026-09-probes/`
  - `consumer-change-requests.md`
- **`.github/`:** `dependabot.yml`.

**Heavily edited**

- **`src/commands/`:** `scan`, `scan-processes`, `summarize`, `discover`, `sample`.
- **`src/lib/`:** `process-runner`, `page-guard`, `scan-results`, `wcag-em-summary`, `group-findings`,
  `manual-backlog`, `auth`, `browser`, `config`, `validate-config`, `context`, `logger`, `fs-utils`, `urls`,
  `sitemap`, `axe-utils`, `version`, `preflight`.
- All 7 reporters.
- `schemas/config.schema.json` and both vendored consumer schemas.
- `bin/wcag-em.mjs`, `src/index.mjs`, `package.json`, `ci.yml`.
- README and the three guides.
- The 15 ADRs listed in the amendment schedule.

**Removed**

- The duplicate classify, body-probe and axe paths in process-runner.
- The `SC_LEVEL_MAP` literal.
- The stub `refresh-rule-maps.mjs`.
- The standalone stage main blocks.
- `scope.includeSubdomains`.
- The hard-coded DEFAULTS `withTags`.

---

## End-to-end verification plan

**Every commit:**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e
```

**Every epic, before its PR:**

- Replay the epic's review probes (from `docs/reviews/2026-09-probes/`) as committed fixtures.
- Show that the epic's **class guard** fails when its root fix is reverted locally, so the guard demonstrably
  guards.
- Report the performance delta against the E10 baseline for Phases 2 and 3.

**Programme gates**

1. **v1.2.0 (after E9):**
   - Tagged at the merge commit.
   - Artefacts stamp 1.2.0 and the gitSha.
   - The advisory ships in the release notes.
2. **v2.0.0-alpha.1 (after E14):**
   - Session dead at start -> exit 1.
   - Session revoked mid-run -> `unauthenticated` views, coverage none, exit 3.
   - Zero rules executed -> non-auditable views, exit 3.
   - Zero pages audited -> `status:'failed'`, no score.
   - Stale replay -> exit 4.
   - No secret canary appears anywhere.
   - SIGKILL leaves a resumable journal.
   - Dogfood diff #1.
3. **v2.0.0-alpha.2 (after E19):**
   - The crawl fixture is green.
   - The loopback guard is green.
   - The processes e2e is green.
   - `wcag-em config check` passes on every committed config.
   - Dogfood diff #2.
4. **v2.0.0-beta.1 (after E22):**
   - The version x level matrix is green.
   - No automated criterion-level `passed`/`inapplicable`.
   - `contracts:check` is green against the consumers' then-current master.
   - Dogfood diff #3, with before/after scores recorded in ADR-0029.
5. **v2.0.0 (after E24 + Lane C):**
   - **Closure audit:** re-run the lean review method (4 merged finders plus packet verification, about 30
     agents) on the release candidate. All 178 v2.0 IDs must verify closed with `{commit, test}` evidence.
   - Dogfood diff #4.
   - The portal change request (D5) is accepted before v2.0 output is uploaded to the portal.
   - Manual AT pass over summary.html.

---

## Risks and mitigations

| Risk                                                               | Mitigation                                                                                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client audits run on 1.2.0 while the programme is under way        | E9 R3 advisory in the release notes; SEC-01 is fixed in the 3rd PR; alpha tags let real audits move to fixed builds early                                         |
| The E11 refactor regresses the verified accuracy                   | R2 is behaviour-neutral; E10 R5 provides the parity and raw-axe differential nets; dogfood diffs at every gate                                                    |
| Strict defaults produce false alarms                               | Dispositions (E13 R5); an exit-3 report that lists only undispositioned gaps; `config check`; a Migration guide; explicit, disclosed opt-outs                     |
| Portal dashboard semantics change                                  | D5 release gate; CHANGELOG BREAKING; before/after numbers in ADR-0029; E25 (T-L) restores decided scores                                                          |
| Header egress cannot be fully scoped, or routing costs performance | E12 R1 spike decides; ADR-0024 discloses the residual risk and cache cost; the perf budget makes the cost visible; Basic credentials are origin-scoped regardless |
| Crawlee proxy shim breaks on upgrade                               | The listen-guard test fails loudly; upstream PR; Dependabot; the shim is removed once upstream ships                                                              |
| customizationKey change orphans portal customisations              | BREAKING note; E20 R5 change request; documented one-time mapping                                                                                                 |
| PRNG change alters samples for the same seed                       | BREAKING note; PRNG id recorded in metadata                                                                                                                       |
| Lane C conflicts with spine refactors                              | E15 lands early; Lane C PRs are small and rebase on `main`                                                                                                        |

---

## Out of scope (confirmed)

- **Companion-repo changes (D2).** Covered by the change requests; the portal score item is a release gate
  (D5).
- **Pre-existing roadmap items not raised by this review:** T-M regression, T-N plugin API, T-O SPA/SSO auth,
  T-P localisation, and TLS/proxy/IPv6 support. T-L is the exception: it is proposed as E25, and Jamie can
  approve or strike it.
- **No action needed:**
  - CAP-20: intended, per ADR-0011.
  - PROC-18: intended, per ADR-0020; documented in E16 R7.
  - REPB-04: refuted.

---

## Push plan

For each epic:

1. Branch from merged `main`.
2. Keep the gate green on every commit.
3. Run a review sized to the epic.
4. Push, open the PR, and watch its CI run.
5. Jamie merges.

Each PR also back-annotates:

- TODO.md;
- CHANGELOG `[Unreleased]`;
- the review doc's Status column (finding -> commit -> test).

At v2.0.0, append the closure-audit results to the review doc.

---

## Appendix: Traceability (machine-checked on v3: 190/190 upheld IDs, exactly one closing owner each)

| Epic            | Findings closed                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E9              | REPA-11, TEST-06, OPS-07, SEC-10, SEC-08, OPS-13                                                                                                                                                    |
| E10             | TEST-11, TEST-02, TEST-03, TEST-12, TEST-04, TEST-05                                                                                                                                                |
| E11             | SCAN-01, SCAN-06, SCAN-07, SCAN-13, STRESS-05, SEC-01, SCAN-08, SCAN-09, SCAN-11, E2E-01, OPS-10, STRESS-03, SCAN-22, PROC-03, PROC-01, PROC-12                                                     |
| E12             | SEC-20, SEC-06, PROC-08, SEC-12, SEC-02, SEC-22                                                                                                                                                     |
| E13             | REPA-01, REPA-14, REPB-05, STRESS-04, STRESS-07, STRESS-08, VERD-09, SCAN-20, REPB-02, REPB-10, REPA-15, STRESS-01                                                                                  |
| E14             | SCAN-02, SCAN-03, OPS-14, SCAN-10, REPB-18, SCAN-14, SCAN-16                                                                                                                                        |
| E15             | VERD-13, OPS-11, TEST-09, DISC-21, DISC-24, CAP-04, VERD-11, DISC-26, DISC-17, CAP-22, REPA-16, OPS-02                                                                                              |
| E16             | SEC-09, TEST-01, TEST-07, TEST-08, TEST-10, OPS-09, VERD-12, SEC-14, SEC-15, SEC-16, SEC-17, OPS-03, OPS-08                                                                                         |
| E17             | OPS-04, OPS-05, OPS-06, SEC-19, SEC-18, PROC-15, PROC-20, DISC-19, SCAN-19, SCAN-04, SCAN-05, SCAN-17, OPS-01                                                                                       |
| E18             | DISC-05, DISC-06, DISC-16, STRESS-02, DISC-01, DISC-02, DISC-03, DISC-07, DISC-09, DISC-20, DISC-04, DISC-12, DISC-13, DISC-15, DISC-10, DISC-11, SEC-13, SEC-21, DISC-18, DISC-08, CAP-11, DISC-25 |
| E19             | PROC-04, VERD-06, PROC-02, PROC-09, PROC-10, PROC-06, PROC-07, PROC-13, PROC-05, PROC-19, PROC-17, PROC-16                                                                                          |
| E20             | REPB-01, REPB-03, REPB-21, REPB-11                                                                                                                                                                  |
| E21             | VERD-03, VERD-05, VERD-04, CAP-01, VERD-02, CAP-03, CAP-21, VERD-15                                                                                                                                 |
| E22             | SAMP-04, SAMP-08, SAMP-14, SAMP-10, DISC-14, SAMP-06, SAMP-09, SAMP-11, SAMP-01, SAMP-02, SAMP-13, SAMP-03, SAMP-07, SAMP-05, VERD-08, VERD-10, VERD-19, CAP-05, SAMP-15, REPB-19                   |
| E23             | REPA-02, REPA-03, REPA-04, REPA-13, REPA-17, VERD-14, E2E-05, REPA-06, REPA-07, REPA-09                                                                                                             |
| E24             | E2E-03, REPB-06, REPB-14, REPB-07, REPB-08, REPB-09, REPB-20, REPB-16, CAP-18, REPB-15, REPB-17                                                                                                     |
| E26-E31 (v2.1+) | CAP-07, CAP-08, SCAN-12 (E26); PROC-14 (E27); CAP-14, CAP-15, CAP-13 (E28); CAP-12, CAP-10, CAP-09 (E29); CAP-16 (E30); SCAN-21 (E31)                                                               |

**Totals and timing**

- 178 findings close by v2.0.0 (E9-E24); the other 12 close in v2.1+.
- Three of those 12 close a half early:
  - CAP-09: docs half in E23 R4.
  - CAP-13: data-loss half in E22 R6.
  - SCAN-21: doc half in E16 R9.
- The false _coverage_ claim behind SCAN-04 is neutralised at runtime by E13 R5 (alpha.1), ahead of its
  load-time half in E17.

**Folded duplicates** (each closes with its kept finding)

| Folded                            | Kept    |
| --------------------------------- | ------- |
| VERD-01, E2E-07                   | CAP-01  |
| PROC-11                           | VERD-06 |
| SAMP-12                           | VERD-08 |
| REPA-10                           | VERD-09 |
| VERD-16                           | SAMP-05 |
| VERD-17                           | CAP-04  |
| VERD-07, E2E-02                   | PROC-03 |
| VERD-18, SEC-11                   | PROC-09 |
| SCAN-15, REPA-08, REPB-12, CAP-19 | VERD-11 |
| CAP-17                            | DISC-01 |
| SEC-03                            | DISC-06 |
| DISC-23                           | SEC-13  |
| SEC-05                            | SCAN-10 |
| CAP-06                            | SCAN-08 |
| SEC-07                            | SCAN-03 |
| REPB-13                           | CAP-05  |
| REPA-12                           | PROC-19 |
| SEC-04                            | SCAN-01 |
| SCAN-18                           | CAP-07  |
| DISC-22                           | SAMP-08 |
| OPS-12, E2E-04                    | TEST-09 |
| CAP-02, REPA-05                   | VERD-03 |
| E2E-06                            | REPB-18 |
| STRESS-06                         | SCAN-21 |

Some folded findings carried extra content, and each piece is kept explicitly:

| Folded  | Extra content              | Lands in |
| ------- | -------------------------- | -------- |
| PROC-11 | Stop-on-failure            | E19 R1   |
| SEC-11  | Timeout precedence         | E19 R3   |
| SCAN-18 | Viewport dimensions        | E11 R3   |
| SEC-05  | Process screenshot names   | E14 R4   |
| DISC-23 | Sitemap protocol allowlist | E18 R6   |

**No action:**

- REPB-04: refuted.
- CAP-20, PROC-18: intended.

**New during planning:** `configs-valid.test.mjs` never validated the configs it loads. Fixed in E17 R2.
