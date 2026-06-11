# WCAG-EM Accessibility Toolkit

Automated layer of a [WCAG-EM](https://www.w3.org/TR/WCAG-EM/)-aligned
accessibility audit workflow. Discovers pages, builds a structured
sample, runs [axe-core](https://github.com/dequelabs/axe-core) scans,
evaluates interactive processes, and produces WCAG-EM Step 5 conformance
summaries — without over-claiming what automation can prove.

## What it does

The toolkit runs a five-stage pipeline:

1. **Discover** — crawl from a root URL (optionally seeded from a
   sitemap) to build a page inventory with metadata and clusters.
2. **Sample** — select a structured + random sample from the inventory
   per WCAG-EM Step 3.
3. **Scan** — run axe-core over every sample page at each configured
   viewport, with optional pre-scan actions and per-URL overrides.
4. **Scan-processes** — exercise interactive processes (form submissions,
   search, navigation states) via a step DSL and scan the resulting
   states.
5. **Summarize** — aggregate findings into per-SC outcomes, produce
   reports (Markdown, HTML, EARL JSON-LD, JUnit), and generate the
   WCAG-EM Step 5 summary.

## Prerequisites

- **Node.js ≥ 22.11.0** — the toolkit requires a current Node.js release.
  Check with `node -v`.

## Quick start

```bash
npm install wcag-em-a11y-toolkit
npx playwright install chromium
npx wcag-em audit --config configs/example-site.json
```

## CLI commands

| Command                  | Stage | Description                                  |
| ------------------------ | ----- | -------------------------------------------- |
| `wcag-em discover`       | 1     | Crawl and build the URL inventory            |
| `wcag-em sample`         | 2     | Select the structured + random sample        |
| `wcag-em scan`           | 3     | Run axe-core over sample pages               |
| `wcag-em scan-processes` | 3b    | Exercise and scan interactive processes      |
| `wcag-em summarize`      | 4     | Aggregate findings and produce reports       |
| `wcag-em audit`          | All   | Run the full pipeline (discover → summarize) |

All commands accept `--config <path>`, `--out-dir <path>`,
`--log-level <level>`, `--quiet`, and `--verbose` flags.

## Configuration

Start from [`configs/example-site.json`](./configs/example-site.json)
and adapt to your site. Key fields:

| Field                         | Purpose                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `rootUrl`                     | Starting URL for the crawler                                                                                  |
| `crawl.maxPages`              | Maximum pages to discover                                                                                     |
| `crawl.navigationTimeoutSecs` | Per-page navigation timeout                                                                                   |
| `scan.axe.withTags`           | axe-core tag filter (e.g. `["wcag2aa", "best-practice"]`)                                                     |
| `reporting.reporters`         | Output formats: `json`, `markdown`, `html`, `earl-jsonld`, `junit`, `portal-export`, `report-builder-starter` |
| `reporting.failOnFindings`    | CI exit-code control (impacts + threshold)                                                                    |

See [`schemas/config.schema.json`](./schemas/config.schema.json) for
the full configuration reference.

## Reporters

| Reporter                 | Output file                 | Description                                                                                 |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- |
| `json`                   | `summary.json`              | Structured summary with findings, incomplete results, and execution health                  |
| `markdown`               | `summary.md`                | Human-readable Markdown summary with scan-health and incomplete-review sections             |
| `html`                   | `summary.html`              | Standalone HTML report with dark mode, scan-health and needs-review sections                |
| `earl-jsonld`            | `earl.jsonld`               | W3C EARL JSON-LD assertions with WCAG-EM evaluation metadata                                |
| `junit`                  | `junit.xml`                 | JUnit XML for CI — `cantTell` emits as failures; scan failures as `<error>` testcases       |
| `portal-export`          | `portal-export.json`        | MyAccess Portal canonical-scan envelope (compliance summary + scoreBasis + rawFindings)     |
| `report-builder-starter` | `report-builder-draft.json` | myweb-report-builder DraftReportSchema starter draft (flagged findings, checks, appendices) |

Reports never count a failed page as scanned: `samplePagesScanned` is unique
pages with at least one successful view, `pageViewsScanned` counts
page-per-viewport scans, and `summary.executionHealth` itemises failed or
degraded pages, process failures, and pre-scan action failures (rendered as a
"Scan health" section when a run was not clean). See the counts glossary in
[`CHANGELOG.md`](./CHANGELOG.md) for how pages, page-views, occurrences, and
instances differ.

In addition to the reporter outputs, the summarize stage also writes:

- **`wcag-em-summary.json`** — per-SC outcomes covering every WCAG 2.2
  success criterion at or below your conformance target. Criteria not
  touched by any axe rule are marked `notTested`, giving a complete
  checklist for the manual-review phase.
- **`grouped-by-rule.json`** / **`grouped-by-component.json`** — machine-
  readable finding breakdowns for integration with other tools.
- **`manual-backlog.md`** — findings-aware manual-review backlog.

### Uploading to the MyAccess Portal

Enable the `portal-export` reporter to write `portal-export.json` in the
portal's canonical-scan format, then upload it at the portal's scan-upload
screen (drag-drop or "Paste JSON instead"). It carries per-element HTML
evidence, WCAG SC references, and per-page instances. Compliance-affecting
violations drive the dashboard compliance score; best-practice and axe
needs-review items are emitted as manual-review cards that do not affect the
score. Remediation is added by the admin in the portal's enrichment UI.

## TypeScript support

The package ships type declarations for the programmatic API:

```ts
import type { WCAGEMAccessibilityToolkitConfig } from 'wcag-em-a11y-toolkit';
import { runAudit, buildContext } from 'wcag-em-a11y-toolkit';
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

| Path                 | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `bin/`               | CLI entry point                                 |
| `src/commands/`      | Pipeline stages                                 |
| `src/lib/`           | Shared utilities                                |
| `src/reporters/`     | Report generators                               |
| `src/data/`          | Static data (ACT rule map, WCAG SC metadata)    |
| `schemas/`           | JSON Schema for config + portal-export contract |
| `configs/`           | Example site configurations                     |
| `docs/adr/`          | Architecture decision records                   |
| `docs/design-notes/` | Original design framework                       |
| `test/`              | Unit, e2e, and fixture tests                    |

## Architecture decisions

See [`docs/adr/`](./docs/adr/) for the full list of architecture
decision records.

## License

MIT
