# WCAG-EM Accessibility Toolkit V2 Recommended

> **Status: work in progress.** This toolkit is mid-migration from v0.3 to
> v1.0.0. Architecture, conventions, and feature set are converging:
> [`docs/adr/`](./docs/adr/) captures current decisions and
> [`CHANGELOG.md`](./CHANGELOG.md) tracks deferred work. Most of the README
> below still reflects the v0.3 starting point (with references to the old
> `box/` + `scripts/` directories) and will be rewritten in the final
> release layer — **except** the "Configuring for SPAs" and "Configuring
> for client audits" sections below, which reflect current v0.3.0
> behaviour with all recent fixes applied (D1+D2+D3+P2+P3 plus the smoke
> e2e un-skip in commit `ba37fad`). For the current CLI surface see
> `node bin/wcag-em.mjs --help`.

This package is the **recommended V2 build** based on the V1 and V2 decision points.

It is designed to help you run the **automated layer** of a WCAG-EM-aligned audit workflow without over-claiming what automation can prove.

## Recommended operating model

1. define scope in config
2. discover URLs from the root URL
3. build a structured sample plus a recorded random sample
4. run automated page scans
5. run separate process/state scans
6. summarize findings, compare random vs structured sample, and prepare the manual testing backlog

## What this build adds over the earlier starter

- stronger config defaults and validation
- optional sitemap seeding
- richer inventory metadata and page clusters
- process candidate detection during discovery
- hybrid sample building (manual + auto-suggest)
- process expansion hooks
- grouped findings by rule and component-ish selector pattern
- random-sample comparison flags
- cleaner Markdown and JSON report outputs
- decision records and recommended checklist files in `box/`

## Install

```bash
npm install
npx playwright install
```

## Example usage

```bash
npm run discover -- --config configs/legacy-events.json
npm run sample -- --config configs/legacy-events.json
npm run scan:sample -- --config configs/legacy-events.json
npm run scan:processes -- --config configs/legacy-events.json
npm run summarize -- --config configs/legacy-events.json
```

Or run the full chain:

```bash
npm run audit -- --config configs/legacy-events.json
```

## Configuring for SPAs

Single-page applications (React, Vue, Angular, Svelte, etc.) typically
hydrate their DOM AFTER `domcontentloaded` fires. The toolkit's default
`scan.waitUntil: "domcontentloaded"` is SPA-friendly for sites that
render server-side and then hydrate, but client-rendered SPAs that
build the DOM entirely in JavaScript need different tuning to ensure
axe-core scans the fully-rendered tree.

Three knobs cover most cases:

```json
{
  "scan": {
    "waitUntil": "networkidle",
    "timeoutMs": 90000,
    "beforeScan": {
      "actions": [
        { "action": "waitFor", "selector": "[data-hydrated]" },
        { "action": "click", "selector": "button[data-cookie-accept]" }
      ]
    }
  },
  "crawl": {
    "maxConcurrency": 2,
    "requestTimeoutSecs": 90
  }
}
```

- **`scan.waitUntil: "networkidle"`** waits for 500ms of network
  silence before axe runs. Adds 1-3s per page versus
  `"domcontentloaded"` but ensures lazy-loaded content is in the DOM.
- **`scan.timeoutMs: 90000`** (default 60000) gives heavy hydration
  more headroom; raise further for SPAs with slow third-party
  dependencies (analytics, chat widgets, etc.).
- **`scan.beforeScan.actions[]`** runs pre-axe hooks: `waitFor` polls
  for a hydration marker (a data attribute the SPA sets after first
  render), `click` dismisses cookie banners or modals that overlay
  the page. Per-URL matching via `urlPattern` is also supported.
- **`crawl.maxConcurrency: 2`** (default 5) prevents SPA scanning
  from saturating the auditor's CPU when JavaScript hydration is
  expensive.
- **`scan.axe.overrides[]`** lets specific SPA routes use different
  rule/tag sets — for example, disabling `region` on a single-pane
  application shell that intentionally has no landmarks.

## Configuring for client audits

For paid client work, start from
[`configs/example-site-best-practice.json`](./configs/example-site-best-practice.json)
rather than the bare-bones `example-site.json`. The sidecar opts in to
axe-core's `best-practice` tag (covers `landmark-one-main`, `region`,
`heading-order`, `page-has-heading-one` — universally-expected auditor
concerns), enables all 5 reporters, and stamps WCAG 2.2 AA conformance
fields for proper WCAG-EM Step 5 reporting.

After copying the sidecar, the four most important per-site overrides:

```json
{
  "sample": {
    "structuredManual": [
      "https://client.example/",
      "https://client.example/contact",
      "https://client.example/checkout",
      "https://client.example/accessibility-statement"
    ]
  },
  "reporting": {
    "failOnFindings": {
      "impacts": ["critical", "serious"],
      "threshold": 1
    }
  },
  "crawl": { "requestDelayMs": 500 },
  "wcagEm": {
    "evaluator": { "name": "Your Name", "contact": "you@firm.example" },
    "technologiesReliedUpon": ["HTML", "CSS", "JavaScript", "WAI-ARIA"],
    "samplingMethodNotes": "Sample covers homepage, primary user journeys, and the accessibility statement; supplemented by toolkit auto-suggest and a 10% random pool."
  }
}
```

- **`sample.structuredManual`** is the WCAG-EM Step 3a curated sample.
  Replace the placeholder URLs above with the client's actual critical
  paths: homepage, primary user journeys (contact, checkout, sign-up,
  search), policy pages (privacy, terms, accessibility statement), and
  any known pain-points the client flagged at scoping. The sidecar
  deliberately ships this field empty so a copy-paste user can't
  accidentally inherit `example.com` URLs.
- **`reporting.failOnFindings`** controls CI exit codes. Threshold `1`
  with impacts `["critical", "serious"]` fails the build on any
  high-severity finding — appropriate for sites with a baseline. For a
  first-time audit on a site with known issues, raise the threshold or
  scope to `["critical"]` only so the run produces a report rather than
  a hard fail.
- **`crawl.requestDelayMs`** sets per-request politeness. Default
  `250` ms in the sidecar; production sites under traffic load may
  benefit from `500-1000` ms. Always honour the site's robots.txt
  manually before running.
- **`wcagEm.evaluator`** is required for WCAG-EM Step 5 conformance
  reporting — fill in your name and contact so the EARL JSON-LD and
  `wcag-em-summary.json` artefacts carry proper provenance.
- **`crawl.documentLinkPatterns`** defaults to skipping
  `.pdf` / `.docx` / `.zip` / etc. (saves ~27s on document-heavy
  sites). For docs-site audits where PDFs are the deliverables under
  review, set this to `[]` to crawl them as page-equivalents.

## What this toolkit does not claim

- it does **not** make a sitewide WCAG conformance claim on its own
- it does **not** replace evaluator judgement in scope, sampling, or process identification
- it does **not** fully automate authenticated or highly dynamic flows without tuning
- it does **not** remove the need for manual testing with keyboard, AT, zoom/reflow, and process walkthroughs

## Folder guide

- `configs/` site configs
- `scripts/` execution scripts
- `schemas/` config schema
- `output/` generated inventory, scan results, screenshots, and reports
- `box/` explanation, decision records, and checklists
