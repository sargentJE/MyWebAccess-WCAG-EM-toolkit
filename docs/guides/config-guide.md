# Config authoring guide

How to write a site config for any audit — from a quick smoke test to a full
production client engagement. Every field the toolkit understands is documented
here; the formal source of truth is [`schemas/config.schema.json`](../../schemas/config.schema.json)
(Ajv-validated at load, so a bad config fails fast with a pointer to the exact
field). A guard test keeps this guide complete: every schema field must appear
here, or the test suite fails naming the missing field.

Companion guides: the [user manual](./user-manual.md) covers running the
pipeline and reading its output; the [integrations guide](./integrations.md)
covers what to do with the portal and report-builder exports.

## 1. The minimal valid config

Six sections are required: `name`, `rootUrl`, `scope`, `crawl`, `sample`,
`scan`. Everything else is optional with shippable defaults. The smallest
config that validates:

```json
{
  "name": "my-first-audit",
  "rootUrl": "https://example.com/",
  "scope": { "mode": "same-hostname" },
  "crawl": {},
  "sample": {},
  "scan": {}
}
```

That is a real, runnable config: defaults fill in an 80-page crawl, sitemap
seeding, auto-suggested sampling, desktop + reflow viewports, and the WCAG
2.0/2.1/2.2 A+AA axe tag profile. Run it with:

```bash
npx wcag-em audit --config my-first-audit.json --out-dir output/my-first-audit
```

- `name` — slug for the run; appears in report headers, the portal export, and
  derives the report-builder draft's finding-ID prefix (`legacy-events` ->
  `LE-001`).
- `rootUrl` — where the crawler starts. Must be `http(s)`.

## 2. Field-by-field reference

Every field, its default, and when to change it. Defaults come from
`src/lib/config.mjs` `DEFAULTS` and are merged underneath your config before
validation.

### `scope` — which URLs belong to the audit

| Field          | Default           | Notes                                                                                              |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `mode`         | `"same-hostname"` | `same-hostname` \| `same-origin` \| `allow-list`. Same-hostname follows subdomain-free host match. |
| `allowedHosts` | `[]`              | Extra hosts to include when `mode` is `allow-list` (e.g. a CDN-hosted app subdomain).              |

### `crawl` — how discovery behaves (Stage 1)

| Field                   | Default                       | Notes                                                                                                                                   |
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `maxPages`              | `80`                          | Crawl ceiling. When hit, `inventory-metadata.json` records `reachedMaxPages: true` and summarize emits a truncation scan warning.       |
| `maxConcurrency`        | `5`                           | Parallel page loads. Drop to `2` for slow sites or heavy SPA hydration.                                                                 |
| `requestTimeoutSecs`    | `90`                          | Whole-request budget per crawled page (Crawlee handler).                                                                                |
| `navigationTimeoutSecs` | `60`                          | Navigation-only budget per crawled page. Pages exceeding it are dropped from the inventory (logged, not fatal).                         |
| `requestDelayMs`        | `0`                           | Politeness throttle between requests. Use `250`-`1000` on production sites; always check the site's robots.txt yourself before running. |
| `excludeUrlPatterns`    | `[]`                          | Regex sources; matching URLs are never enqueued. Validated at load by the custom `validRegex` keyword, so a typo fails fast.            |
| `documentLinkPatterns`  | PDF/archive/media/etc. preset | Pathname regexes for non-HTML links to SKIP (saves ~27s on document-heavy sites). Set to `[]` to crawl PDFs as page-equivalents.        |
| `sitemapSeeding`        | enabled                       | See below.                                                                                                                              |

`sitemapSeeding` sub-fields:

| Field         | Default                                  | Notes                                           |
| ------------- | ---------------------------------------- | ----------------------------------------------- |
| `enabled`     | `true`                                   | Seed the crawl queue from sitemaps.             |
| `urls`        | `[]`                                     | Explicit sitemap URLs (override discovery).     |
| `commonPaths` | `["/sitemap.xml", "/sitemap_index.xml"]` | Probed relative to `rootUrl` when `urls` empty. |
| `maxUrls`     | `500`                                    | Cap on seeded URLs.                             |

### `discovery` — per-page metadata capture (Stage 1)

Five boolean probes, all defaulting to `true`. They run inside each crawled
page and feed page-type clustering (which drives sampling auto-suggest) and
the findings' page-type labels. Disable only if a probe trips site JS:

| Field                 | Captures                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| `captureH1`           | First `<h1>` text (page-type signal).                                           |
| `captureCanonical`    | `<link rel="canonical">` (duplicate detection).                                 |
| `captureForms`        | Form count (drives form-or-contact typing AND the manual backlog's forms item). |
| `captureLandmarks`    | Landmark count.                                                                 |
| `captureSearchInputs` | Search input presence (process candidates).                                     |

### `sample` — WCAG-EM Step 3 sampling (Stage 2)

| Field                                 | Default | Notes                                                                                                                                        |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `structuredManual`                    | `[]`    | YOUR curated sample: homepage, key journeys, policy pages. URLs missing from the inventory are warned about but still scanned.               |
| `autoSuggest.enabled`                 | `true`  | Add one representative page per discovered page-type cluster.                                                                                |
| `autoSuggest.perCluster`              | `1`     | Representatives per cluster.                                                                                                                 |
| `autoSuggest.preferTypes`             | 6 types | Page types eligible for auto-suggest: homepage, form-or-contact, policy, listing, detail, content.                                           |
| `randomPercentOfStructured`           | `0.1`   | Random-sample size as a fraction of the structured sample (WCAG-EM 10% guidance).                                                            |
| `minRandomPages`                      | `2`     | Floor for the random sample.                                                                                                                 |
| `randomSeed`                          | `1`     | Seeded selection: same seed + same pool = same sample (reproducible). Changing ANY pool input changes the selection even with the same seed. |
| `smallSiteSupplementaryScanThreshold` | `50`    | Inventories at/below this size log a "scan everything as a supplementary pass" recommendation.                                               |

The summarize stage compares random-sample findings against structured-sample
findings; rules or clusters that ONLY appear in the random sample produce an
expand-your-structured-sample recommendation in
`random-vs-structured-comparison.json`.

### `scan` — axe runs per page x viewport (Stage 3)

| Field                 | Default                           | Notes                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewports`           | desktop 1280x800 + reflow 320x800 | Array of `{ id, width, height }`. Each page is scanned once per viewport; findings carry the viewport `id`.                                                                                                                                                                                                                              |
| `waitUntil`           | `"domcontentloaded"`              | Playwright load state before axe runs. `"networkidle"` waits for 500ms network silence — see SPA recipes.                                                                                                                                                                                                                                |
| `timeoutMs`           | `60000`                           | Per-page navigation budget AND the shared per-step budget for process/pre-scan actions.                                                                                                                                                                                                                                                  |
| `retries`             | `1`                               | Re-attempts per (page x viewport) before the page-view is recorded as failed (it then surfaces in Scan health).                                                                                                                                                                                                                          |
| `fullPageScreenshots` | `true`                            | Full-page PNG per page x viewport; embedded in the HTML report and carried into the report-builder draft.                                                                                                                                                                                                                                |
| `beforeScan`          | none                              | Pre-axe page setup actions — see section 4.                                                                                                                                                                                                                                                                                              |
| `challenge`           | detection on; wait off            | Bot/WAF challenge handling (E1). `waitForAutoSolveMs` (0–60000, default `0`) bounds the wait for a managed challenge to auto-clear before a page is recorded as unauditable; `hosts` adds extra hosts to the title+status heuristic (the `cf-mitigated` check is host-independent). Use `auth.extraHTTPHeaders` for a WAF bypass header. |
| `axe`                 | A+AA tag profile                  | See below.                                                                                                                                                                                                                                                                                                                               |

`axe` sub-fields:

| Field       | Default                                                | Notes                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `include`   | `[]`                                                   | CSS selectors to scope axe INTO (rarely needed).                                                                                                                                                                                    |
| `exclude`   | `[]`                                                   | CSS selectors axe skips (third-party widgets you cannot fix).                                                                                                                                                                       |
| `withRules` | `[]`                                                   | Run ONLY these rule IDs (diagnostic use).                                                                                                                                                                                           |
| `withTags`  | `["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]` | The conformance rule profile. Add `"best-practice"` for client audits (landmarks, heading order).                                                                                                                                   |
| `runOnly`   | `null`                                                 | Raw axe `runOnly` `{ type, values }` object; overrides tags when set. `null` disables.                                                                                                                                              |
| `overrides` | none                                                   | Per-URL rule changes: array of `{ urlPattern, include?, exclude?, withRules?, withTags?, runOnly? }`. First matching `urlPattern` wins; an override REPLACES the base value for each key it defines (set `runOnly: null` to clear). |

### `processes` — interactive journeys (Stage 4)

See section 3 for the full DSL specification.

### `reporting` — outputs and CI behaviour (Stage 5)

| Field                          | Default                | Notes                                                                                                                                                                       |
| ------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reporters`                    | `["json", "markdown"]` | Any of: json, markdown, html, earl-jsonld, junit, portal-export, report-builder-starter.                                                                                    |
| `includePasses`                | `false`                | Adds passed-criteria detail to html/earl outputs.                                                                                                                           |
| `groupBestPracticeSeparately`  | `true`                 | Best-practice rule hits are classified apart from WCAG conformance findings (and never count toward the portal compliance score).                                           |
| `screenshotFormat`             | png                    | `png` \| `jpeg` for captured screenshots.                                                                                                                                   |
| `screenshotQuality`            | (jpeg only)            | 0-100 quality when `screenshotFormat` is jpeg.                                                                                                                              |
| `failOnFindings`               | critical/serious, 1    | CI exit-code control — see below.                                                                                                                                           |
| `validateExports`              | `"warn"`               | Write-time contract validation for portal-export and report-builder-starter: `off` \| `warn` (log + write) \| `error` (reporter fails instead of emitting an invalid file). |
| `maxIncompleteExamplesPerRule` | `25`                   | Per-rule cap on condensed needs-review evidence examples kept in `axe-results.json`; `nodesCount` always keeps the true total.                                              |

`failOnFindings` sub-fields: `impacts` (axe impact levels that count, default
`["critical", "serious"]`), `classifications` (classification buckets that
count, default `[]`), `threshold` (finding GROUPS — unique rules, not
occurrences — at or above which the run exits `2`; default `1`; `0` disables).

### `auth` — authenticated scans

Absent by default (no auth). See section 5 for the walkthrough.

| Field              | Notes                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storageState`     | Path to a Playwright storage-state JSON, or the inline object. Restores cookies/localStorage into every scan context.                                                                  |
| `ttlMinutes`       | Staleness guard: warns when the storage-state file's mtime is older than this many minutes.                                                                                            |
| `httpCredentials`  | `{ username, password }` for HTTP Basic/Digest. Use an env-substituted secrets workflow — never commit real values.                                                                    |
| `extraHttpHeaders` | Header map added to every request (e.g. a staging bypass token).                                                                                                                       |
| `setupScript`      | Schema-accepted, runtime-IGNORED pending a security review of executing user scripts. The run warns: "auth.setupScript is schema-accepted but runtime-ignored until a future release". |

### `wcagEm` — WCAG-EM Step 5 report metadata

| Field                    | Default                                  | Notes                                                                                                                                                           |
| ------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluator`              | empty `name` / `contact`                 | Fill for client work — stamped into `wcag-em-summary.json`, EARL, and the report-builder draft's `preparedBy`.                                                  |
| `wcagVersion`            | `"2.2"`                                  | `"2.0"` \| `"2.1"` \| `"2.2"`.                                                                                                                                  |
| `conformanceTarget`      | `"AA"`                                   | `"A"` \| `"AA"` \| `"AAA"` — controls which untested criteria appear as `notTested`.                                                                            |
| `atBaseline`             | `[]`                                     | Assistive-technology baseline strings for the report record.                                                                                                    |
| `technologiesReliedUpon` | `["HTML","CSS","JavaScript","WAI-ARIA"]` | WCAG-EM Step 1c record.                                                                                                                                         |
| `samplingMethodNotes`    | synthesized                              | Leave blank and the toolkit writes Step 3 provenance from the real sample metadata (counts, pool %, seed, inventory size). Set it only to use your own wording. |

### Deprecated fields

Accepted by the schema for backwards compatibility; do not use in new configs:

| Field                      | Replacement                                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| `scope.includeSubdomains`  | `scope.mode` (`same-hostname` vs `same-origin`).                          |
| `scan.viewport`            | `scan.viewports` array.                                                   |
| `reporting.markdownReport` | `reporting.reporters` (presence triggers a one-shot deprecation warning). |

## 3. The process step DSL

Processes exercise interactive journeys — form submissions, search, navigation
states — and axe-scan the RESULTING states, which page scans never reach. Each
entry in `processes`:

| Field           | Required | Notes                                                                                                    |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `name`          | yes      | Kebab-case identifier (`^[a-z0-9-]+$`); appears in results, reports, and finding source labels.          |
| `startUrl`      | yes      | Where the process begins.                                                                                |
| `pattern`       | no       | Shorthand: `"blank-submit"` \| `"partial-submit"` \| `null`. Ignored when `steps` is present.            |
| `steps`         | no       | Custom action sequence (wins over `pattern`).                                                            |
| `selectors`     | no       | Named selectors for pattern expansion — `selectors.submit` overrides the default submit-button selector. |
| `fields`        | no       | For `partial-submit`: array of `{ selector, value }` filled before submitting.                           |
| `forceInclude`  | no       | Also add `startUrl` to the page-scan sample even if the crawler never found it.                          |
| `relatedUrls`   | no       | Extra URLs pulled into the page-scan sample alongside this process.                                      |
| `stepTimeoutMs` | no       | Per-step budget override for this process (else `scan.timeoutMs`).                                       |

### Pattern shorthands

Two common journeys need no custom steps (expansion source:
`src/commands/scan-processes.mjs`):

- `"blank-submit"` expands to: `goto` the `startUrl` -> `click` the submit
  button (default selector `button[type='submit'], input[type='submit']`, or
  `selectors.submit`) -> `screenshot` -> `axe`. Captures empty-form validation
  states.
- `"partial-submit"` expands the same way but first runs a `fill` per entry in
  `fields`. Captures per-field validation errors (e.g. an invalid email).

### The seven actions

Used in `processes[].steps` and `scan.beforeScan.actions`. Every step runs
inside a budget (`stepTimeoutMs`/`timeoutMs`, else `scan.timeoutMs`); a failed
or timed-out step is recorded (`error` / `step-timeout`) and the sequence
continues — failures surface in the run's Scan health section, never silently.

| `action`     | Fields                    | Behaviour                                                                                                                                                       |
| ------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goto`       | `url`                     | Navigate, honouring `scan.waitUntil` and `scan.timeoutMs`.                                                                                                      |
| `click`      | `selector`                | Click the first match.                                                                                                                                          |
| `fill`       | `selector`, `value`       | Fill the first match (empty string when `value` omitted).                                                                                                       |
| `press`      | `key`                     | Keyboard press (Playwright key names, e.g. `Enter`).                                                                                                            |
| `waitFor`    | `selector`?, `timeoutMs`? | With `selector`: poll the DOM for it (hydration markers). Without: fixed sleep of `timeoutMs` (default 500ms).                                                  |
| `screenshot` | `name`?                   | Full-page PNG into the run's screenshots dir, named `<startUrl>__<process>__<name>__<viewport>.png`.                                                            |
| `axe`        | `state`?, `name`?         | Run axe NOW and record a result state labelled `state` (default `state`) — this is what makes the journey auditable; steps after it can capture further states. |

Any action may also carry `urlPattern` (a regex source): the action then runs
only on URLs matching it. Patterns are compiled and validated at config load.

## 4. beforeScan recipes (SPAs, cookie banners, modals)

`scan.beforeScan.actions` runs before EVERY page scan (filtered per-URL by each
action's `urlPattern`). Client-rendered SPAs build their DOM after
`domcontentloaded`, so untuned scans see an empty shell. Three knobs cover most
cases:

```json
{
  "scan": {
    "waitUntil": "networkidle",
    "timeoutMs": 90000,
    "beforeScan": {
      "actions": [
        { "action": "click", "selector": "button[data-cookie-accept]" },
        { "action": "waitFor", "selector": "[data-hydrated]" }
      ]
    }
  },
  "crawl": { "maxConcurrency": 2, "requestTimeoutSecs": 90 }
}
```

- `waitUntil: "networkidle"` waits for 500ms of network silence (adds 1-3s per
  page vs `domcontentloaded`, catches lazy-loaded content).
- A `waitFor` with a `selector` polls for a hydration marker your app sets
  after first render — the strongest signal that axe sees the real tree.
- `click` dismisses cookie banners or modals that overlay content.
- Lower `crawl.maxConcurrency` when hydration is CPU-heavy.
- Use `scan.axe.overrides` to relax rules on specific shells (e.g. disable a
  rule on one route via `urlPattern` + `withRules`).

If a beforeScan action fails, axe still scans the page AND the failure is
recorded: the page appears in the report's Scan health section as "pre-scan
action ... — axe scanned the page without the intended setup".

## 5. Authenticated scans

Pick the lightest method that works:

| Situation                          | Method                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| HTTP Basic/Digest gate (staging)   | `httpCredentials`                                                     |
| Token/header bypass                | `extraHttpHeaders`                                                    |
| Real login session (cookies/local) | `storageState` (capture walkthrough below)                            |
| Scripted login at runtime          | Not yet supported (`setupScript` is deferred pending security review) |

### Capturing a storageState file

1. Record a real login once with Playwright's codegen:

   ```bash
   npx playwright codegen --save-storage=.auth/state.json https://example.com/login
   ```

   Log in in the opened browser, then close it — cookies and localStorage are
   saved to `.auth/state.json`.

2. Reference it from the config:

   ```json
   {
     "auth": {
       "storageState": ".auth/state.json",
       "ttlMinutes": 60
     }
   }
   ```

3. Keep it out of git. The toolkit probes this for you and warns:
   "auth.storageState at ... is inside the working tree and NOT gitignored.
   Risk of committing session data; add the path (or its parent directory) to
   .gitignore."

`ttlMinutes` compares the file's age at scan time and warns when the session
is likely expired ("... exceeds ttlMinutes=60. Session may be stale.") — set
it to your app's real session lifetime. Re-run the codegen capture to refresh.

## 6. Choosing viewports

The default pair is deliberate: `desktop` (1280x800) plus `reflow` (320x800 —
the WCAG 1.4.10 Reflow breakpoint, where content must work without
two-dimensional scrolling). Keep both for conformance work; add tablet or
brand-specific breakpoints as extra entries when the site behaves differently
there. Each viewport multiplies scan time and produces its own page-view
results and screenshots; reports count PAGES (a page is scanned if at least
one viewport succeeded) with page-views broken out separately.

## 7. Worked profiles

### Quick smoke test (any site, five minutes)

The minimal config from section 1, with a tighter crawl:

```json
{
  "name": "smoke",
  "rootUrl": "https://example.com/",
  "scope": { "mode": "same-hostname" },
  "crawl": { "maxPages": 15 },
  "sample": { "minRandomPages": 1 },
  "scan": {},
  "reporting": { "reporters": ["json", "markdown"] }
}
```

Read `reports/summary.md` first; exit code `2` means findings at or above the
critical/serious threshold.

### SPA

Section 4's recipes, plus per-route overrides if the app shell intentionally
lacks landmarks. Set a hydration marker in the app if one does not exist — it
is the difference between auditing the real UI and auditing a loading screen.

### Production client audit (the MyWeb Access workflow)

Start from
[`configs/example-site-best-practice.json`](../../configs/example-site-best-practice.json)
(adds the `best-practice` axe tag — landmarks, heading order — enables the
baseline reporters, and stamps WCAG 2.2 AA conformance fields), and from
[`configs/example-site-with-processes.json`](../../configs/example-site-with-processes.json)
for the process shapes (that example targets `example.com`, so it is
illustrative rather than executable — lift its structure, not its URLs).

1. **Scope (WCAG-EM Steps 1-3).** Fill `wcagEm.evaluator`,
   `technologiesReliedUpon`, and the conformance target agreed with the
   client. Curate `sample.structuredManual`: homepage, primary user journeys
   (contact, checkout, sign-up, search), policy pages (privacy, terms,
   accessibility statement), and any pain-points the client flagged. Define a
   process for every distinct interactive journey a user must complete — one
   per form/flow, using a `pattern` shorthand where it fits and custom `steps`
   where it does not.
2. **Recon run.** `requestDelayMs: 500` politeness (check robots.txt
   manually); run the full audit to a scratch out-dir. Tune: excludes for
   infinite calendars or logout links, timeouts for slow routes, beforeScan
   for banners.
3. **Formal run.** Fresh out-dir. Then read the Scan health section FIRST —
   a failed or degraded page means the coverage claim is wrong until re-run
   or documented.
4. **Manual layer.** Work `reports/manual-backlog.md` item by item (keyboard,
   AT, zoom, the journeys). The per-SC `notTested` list in
   `wcag-em-summary.json` is the completeness checklist.
5. **Exports.** `portal-export` for the MyAccess Portal upload and
   `report-builder-starter` for the client report draft — both covered in the
   [integrations guide](./integrations.md). `failOnFindings` with threshold
   `1` and impacts critical/serious is right for re-test runs against a
   baseline; for a first audit of a known-bad site, raise the threshold so
   the run reports rather than hard-fails.

For document-heavy audits where PDFs are deliverables under review, set
`crawl.documentLinkPatterns: []` so they crawl as page-equivalents.
