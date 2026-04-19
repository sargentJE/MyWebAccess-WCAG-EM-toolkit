# WCAG-EM Accessibility Toolkit V2 Recommended

> **Status: work in progress.** This toolkit is mid-migration from v0.3 to
> v1.0.0. Architecture, conventions, and feature set are converging:
> [`docs/adr/`](./docs/adr/) captures current decisions and
> [`CHANGELOG.md`](./CHANGELOG.md) tracks deferred work. The README content
> below still reflects the v0.3 starting point (with references to the old
> `box/` + `scripts/` directories) and will be rewritten in the final
> release layer. For the current CLI surface see
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
