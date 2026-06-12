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
   reports (JSON, Markdown, HTML, EARL JSON-LD, JUnit, portal export,
   report-builder draft), and generate the WCAG-EM Step 5 summary.

## Prerequisites

- **Node.js ≥ 22.11.0** — the toolkit requires a current Node.js release.
  Check with `node -v`.

## Quick start

```bash
npm install wcag-em-a11y-toolkit
npx playwright install chromium
npx wcag-em audit --config configs/example-site.json
```

## Documentation

| Guide                                                   | Covers                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [User manual](./docs/guides/user-manual.md)             | Running the pipeline, every output file, exit codes, Scan health, troubleshooting            |
| [Config authoring guide](./docs/guides/config-guide.md) | Every config field, the process step DSL, SPA recipes, auth setup, production audit workflow |
| [Integrations guide](./docs/guides/integrations.md)     | MyAccess Portal upload, report-builder drafts, CI usage                                      |
| [CONTRIBUTING](./CONTRIBUTING.md)                       | Development setup, conventions, adding to the toolkit                                        |
| [Architecture decisions](./docs/adr/)                   | Why the toolkit works the way it does (MADR records)                                         |
| [CHANGELOG](./CHANGELOG.md)                             | What changed per release, plus the pages/page-views/occurrences/instances counts glossary    |

## CLI commands

| Command                  | Stage | Description                                  |
| ------------------------ | ----- | -------------------------------------------- |
| `wcag-em discover`       | 1     | Crawl and build the URL inventory            |
| `wcag-em sample`         | 2     | Select the structured + random sample        |
| `wcag-em scan`           | 3     | Run axe-core over sample pages               |
| `wcag-em scan-processes` | 4     | Exercise and scan interactive processes      |
| `wcag-em summarize`      | 5     | Aggregate findings and produce reports       |
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
| `crawl.documentLinkPatterns`  | Non-HTML links to skip (PDF/archive/media preset; set `[]` to crawl documents)                                |
| `scan.axe.withTags`           | axe-core tag filter (e.g. `["wcag2aa", "best-practice"]`)                                                     |
| `reporting.reporters`         | Output formats: `json`, `markdown`, `html`, `earl-jsonld`, `junit`, `portal-export`, `report-builder-starter` |
| `reporting.failOnFindings`    | CI exit-code control (impacts + threshold)                                                                    |

Every field is documented in the
[config authoring guide](./docs/guides/config-guide.md) — including the
process step DSL, SPA tuning recipes, authenticated-scan setup, and a
production client-audit workflow. The formal reference is
[`schemas/config.schema.json`](./schemas/config.schema.json); a guard test
keeps guide and schema in sync.

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
- **`random-vs-structured-comparison.json`** — sample-composition diagnostic:
  rule IDs and clusters found only in the random sample, with an
  expand-structured-sample recommendation flag.
- **`manual-backlog.md`** — findings-aware manual-review backlog.

The portal and report-builder exports each have an operator workflow —
pre-upload checks, what the portal rewrites on ingestion, the draft authoring
lifecycle — covered in the
[integrations guide](./docs/guides/integrations.md).

## TypeScript support

The package ships type declarations for the programmatic API:

```ts
import type { WCAGEMAccessibilityToolkitConfig } from 'wcag-em-a11y-toolkit';
import { runAudit, buildContext } from 'wcag-em-a11y-toolkit';
```

## SPAs and client audits

Single-page applications need tuning before axe sees the real DOM (load
states, hydration markers, cookie-banner dismissal) — the recipes live in the
[config guide's beforeScan section](./docs/guides/config-guide.md#4-beforescan-recipes-spas-cookie-banners-modals).

For paid client work — the best-practice rule profile, WCAG-EM scoping,
process definitions, politeness, and the full recon-to-exports workflow — see
the
[config guide's production audit profile](./docs/guides/config-guide.md#production-client-audit-the-myweb-access-workflow).

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
| `docs/guides/`       | User manual, config guide, integrations guide   |
| `docs/adr/`          | Architecture decision records                   |
| `docs/design-notes/` | Original design framework (historical)          |
| `docs/reviews/`      | Systematic review records                       |
| `test/`              | Unit, e2e, and fixture tests                    |

## Architecture decisions

See [`docs/adr/`](./docs/adr/) for the full list of architecture
decision records.

## License

MIT
