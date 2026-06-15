# User manual

Running the toolkit and understanding what comes out. For writing the config
itself, see the [config authoring guide](./config-guide.md); for what to do
with the portal and report-builder exports, see the
[integrations guide](./integrations.md).

## 1. From install to first audit

```bash
npm install wcag-em-a11y-toolkit
npx playwright install chromium
```

Prerequisites: Node.js >= 22.11.0 (`node -v` to check; the CLI refuses older
runtimes with an explicit message) and the Chromium download above (the
discover/scan/scan-processes/audit commands check for it up front and fail
with the install command if missing).

Create a minimal config (see the
[config guide, section 1](./config-guide.md#1-the-minimal-valid-config)) and
run:

```bash
npx wcag-em audit --config my-site.json --out-dir output/my-site
```

`audit` runs all five stages; each is also a standalone subcommand so you can
iterate on one stage without re-running the others (e.g. tweak sampling and
re-run `sample` + `scan` + `summarize` against the same out-dir):

| Command                  | Stage | What it does                                               |
| ------------------------ | ----- | ---------------------------------------------------------- |
| `wcag-em discover`       | 1     | Crawl from the root URL (+ sitemap) into a URL inventory.  |
| `wcag-em sample`         | 2     | Select the structured + random sample (WCAG-EM Step 3).    |
| `wcag-em scan`           | 3     | Run axe-core over each sample page at each viewport.       |
| `wcag-em scan-processes` | 4     | Exercise configured journeys and scan their states.        |
| `wcag-em summarize`      | 5     | Aggregate findings, compute per-SC outcomes, emit reports. |

Global flags on every command: `--config <path>`, `--out-dir <path>`,
`--log-level <trace|debug|info|warn|error|fatal>`, `--quiet` (= warn),
`--verbose` (= debug).

## 2. The mental model

Each stage writes files; the next stage reads them. Everything lives under
your `--out-dir`:

```
<out-dir>/
  inventory/    what the crawler found + how the sample was chosen
  sample.json   the page list scan will visit (the stage 2 -> 3 handoff)
  results/      raw axe output per page x viewport, and per process state
  screenshots/  full-page captures (per page x viewport, per process state)
  reports/      everything human- or machine-readable that you consume
```

A page may be scanned at several viewports — those are page-views. Reports
count PAGES (unique URLs with at least one successful view) as the coverage
figure, with page-views broken out separately. Four different numbers describe
findings; they answer different questions — see the counts glossary in
[`CHANGELOG.md`](../../CHANGELOG.md).

## 3. Output files — what to open, in order

Start here after a run:

1. **`reports/summary.html`** — the human report. Run summary, Scan health
   (only when something failed), findings by WCAG success criterion, findings
   by rule with evidence and screenshots, needs-review section.
2. **`reports/wcag-em-summary.json`** — the conformance record: one outcome
   per WCAG success criterion at or below your target
   (`passed` / `failed` / `cantTell` / `inapplicable` / `notTested`). The
   `notTested` list is your manual-testing completeness checklist.
3. **`reports/manual-backlog.md`** — the findings-aware manual to-do list
   (keyboard, AT, zoom, journeys). Automation cannot decide these; the audit
   is not finished until this list is worked.

The full set:

| File                                                                        | What it is                                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `reports/summary.json`                                                      | Machine-readable everything: grouped findings, needs-review items, execution health, WCAG-EM block.                       |
| `reports/summary.md`                                                        | The HTML report's markdown sibling (diff-friendly).                                                                       |
| `reports/summary.html`                                                      | Standalone human report (no external assets, dark-mode aware).                                                            |
| `reports/earl.jsonld`                                                       | W3C EARL assertions for RDF/semantic-web consumers.                                                                       |
| `reports/junit.xml`                                                         | CI surface: findings as failures, needs-review as `incomplete` failures, scan failures as errors.                         |
| `reports/portal-export.json`                                                | MyAccess Portal upload envelope — see the integrations guide.                                                             |
| `reports/report-builder-draft.json`                                         | Report-builder starter draft — see the integrations guide.                                                                |
| `reports/wcag-em-summary.json`                                              | Per-SC outcomes + evaluator/scope metadata (WCAG-EM Step 5).                                                              |
| `reports/grouped-by-rule.json`                                              | Findings keyed by axe rule (integration-friendly).                                                                        |
| `reports/grouped-by-component.json`                                         | Findings keyed by rule x likely component (selector heuristic).                                                           |
| `reports/random-vs-structured-comparison.json`                              | Sample-composition diagnostic; recommends expanding your structured sample when the random pool finds new rules/clusters. |
| `reports/manual-backlog.md`                                                 | Manual-testing checklist, adapted to what was found.                                                                      |
| `inventory/inventory.json`                                                  | Every crawled URL with captured metadata and page-type cluster.                                                           |
| `inventory/inventory-metadata.json`                                         | Crawl provenance: seed/discovered counts, exclusion tallies, `reachedMaxPages`.                                           |
| `inventory/sample-metadata.json`                                            | How the sample was built: counts, random seed/percent, anything missing from inventory.                                   |
| `inventory/structured-sample.txt` / `random-sample.txt` / `random-pool.txt` | The sample lists, one URL per line.                                                                                       |
| `inventory/structured-sample-suggested.json`                                | What auto-suggest proposed (manual vs suggested split).                                                                   |
| `inventory/page-clusters.json`                                              | Page-type clusters behind auto-suggest.                                                                                   |
| `inventory/process-candidates.json`                                         | Heuristic process entry-points (forms found while crawling).                                                              |
| `results/axe-results.json`                                                  | Raw per page x viewport results (full violation nodes; condensed needs-review evidence).                                  |
| `results/process-results.json`                                              | Raw per-process state results.                                                                                            |
| `screenshots/*.png`                                                         | `<url>__<viewport>.png` per page-view; `<url>__<process>__<state>__<viewport>.png` per process step.                      |

## 4. Exit codes

| Code | Meaning                                                                                 | Typical reaction                                                                                             |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `0`  | Clean run; nothing at/above your `failOnFindings` threshold.                            | Read the reports anyway — needs-review items never trip the threshold by themselves in `summary.json` terms. |
| `1`  | Runtime error: bad config, preflight failure, reporter crash, unexpected exception.     | Fix the named problem; see troubleshooting below.                                                            |
| `2`  | Findings reached `reporting.failOnFindings` (counted as finding GROUPS — unique rules). | Expected on a failing site; this is the CI signal.                                                           |

`2` beats `1` when both apply (the threshold signal is the stronger CI fact).

## 5. Scan health — trust the coverage claim

A WCAG-EM report is only as good as its coverage claim, so failures are never
silent. `summary.json` carries an `executionHealth` block, every failure also
appears in `scanWarnings`, and the html/markdown reports render a
**Scan health** section whenever a run was not clean (a clean run shows
nothing). What each warning means:

| Warning (template)                                                                                           | Meaning + reaction                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `page failed to scan on all viewports: <url> (<error>)`                                                      | The page contributed NOTHING to any verdict and is not counted in `samplePagesScanned`. Re-run, raise `scan.timeoutMs`, or document the gap. |
| `page failed on viewport(s) <ids>: <url>`                                                                    | Degraded: the page counts (some views succeeded), but the failed viewport's findings are missing.                                            |
| `process "<name>" failed at <url>: <error>`                                                                  | The journey never produced scannable states; its findings are absent.                                                                        |
| `pre-scan action "<action>" <state> on <url> [<viewport>] — axe scanned the page without the intended setup` | The cookie-dismiss/hydration step failed; results for that page may reflect the WRONG page state.                                            |
| `crawl stopped at maxPages=<n>; the inventory (and therefore the sample) may be truncated`                   | Raise `crawl.maxPages` or accept and record the scope limit.                                                                                 |
| `axe rule <id> reported incomplete with zero reviewable nodes on <url>; infra failure ...`                   | An engine snag (script timeout/cross-origin) — does NOT affect SC verdicts; noted for transparency.                                          |

## 6. Troubleshooting

Matched to the real messages you will see.

| Symptom (verbatim)                                                                              | Cause + fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wcag-em requires Node >= 22.11.0; you're on <v>`                                               | Old runtime. Install Node 22 LTS (see `.nvmrc`) and re-run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Config not found or unreadable: <path>`                                                        | Wrong `--config` path or permissions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Config validation failed: <path>` followed by a field pointer and received value               | Schema violation; the pointer names the exact field. `not a valid regex: ...` means an `excludeUrlPatterns`/`urlPattern` entry will not compile.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Output directory not writable: <path>`                                                         | Permissions or read-only volume; pick another `--out-dir`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Playwright browsers directory missing (<path>); run: npx playwright install`                   | Browser download was skipped. Run the printed command (`... install chromium` suffices).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `page.goto: Timeout <n>ms exceeded` in Scan health                                              | Slow page or SPA hydration. Raise `scan.timeoutMs`, switch `waitUntil` to `networkidle`, add a `waitFor` hydration marker — see the config guide's SPA recipes.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Pages recorded as `challenge` in Scan health, or a force-included URL annotated `blocked`       | A Cloudflare/WAF managed challenge — the page cannot be audited headlessly, so it is excluded from findings and **disclosed** (ADR-0017), not silently passed. For an **authorized** audit, attach over CDP to a human-cleared browser: launch Chrome with `--remote-debugging-port=9222`, clear the challenge by hand, then set `scan.browser.cdpEndpoint` (or export `WCAG_EM_CDP_ENDPOINT=http://127.0.0.1:9222`) and re-run scan/scan-processes. The durable fix is domain-side (WAF allowlist / Web Bot Auth via `auth.extraHTTPHeaders`). See the config guide's `scan.browser` section. |
| `step "<action>" exceeded stepTimeoutMs=<n>`                                                    | A process/beforeScan step hung. Raise the process's `stepTimeoutMs` (or `scan.timeoutMs`), or fix the selector.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `artefact present but unreadable; using fallback — pipeline state may be corrupt`               | A results/inventory JSON was truncated or hand-edited. Re-run the stage that produces the named file before trusting the summary.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `auth.storageState path unreadable: <path> ...; proceeding without session restore`             | The session file is missing — recapture it (config guide, auth section).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `auth.storageState at <path> is <n> minutes old; exceeds ttlMinutes=<n>. Session may be stale.` | Session likely expired; recapture.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `... is inside the working tree and NOT gitignored. Risk of committing session data ...`        | Add the storage-state path to `.gitignore` before anything else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `portal-export: payload fails the vendored contract ...`                                        | See the integrations guide; with `reporting.validateExports: "warn"` the file still writes — fix before uploading.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Two habits prevent most confusion: give every run its own `--out-dir` (stages
read whatever artifacts they find there — mixing runs in one directory mixes
their data), and read Scan health before reading findings.

## 7. What automation does not claim

The automated layer never makes a sitewide conformance claim on its own: it
cannot judge keyboard operability, focus visibility, caption quality, or
meaning — that is what `manual-backlog.md` and the `notTested` criteria list
exist for. A manual-result ingestion flow (recording your manual outcomes back
into the per-SC summary) is on the project roadmap; until then the combined
record is assembled in your reporting tool — see the
[integrations guide](./integrations.md).
