# Recommended Checklist

> **Design-time record (April 2026).** These notes captured the v2 design
> framework while the toolkit was being built and are kept for history;
> details may no longer match the shipped behaviour. For current usage see
> the [guides](../guides/) and [README](../../README.md); for current
> decisions see the [ADRs](../adr/).

Use this as the mark-up version of the decisions already chosen for this build.

## Scope model

- [x] Default scope mode is `same-hostname`
- [x] Subdomains are excluded by default
- [x] Third-party flows are discovered but not auto-included
- [x] Small-site supplementary scan rule is defined

## Discovery

- [x] URL normalization rules are fixed for V2
- [x] Sitemap seeding is included
- [x] Discovery captures metadata for clustering
- [x] Exclusion rules apply at crawl time
- [x] Discovery flags likely process entry points

## Sampling

- [x] Structured sample supports manual seeding
- [x] Structured sample also supports auto-suggestion from clusters
- [x] Random sample rounding rule is fixed
- [x] Random sample seed is always recorded
- [x] Random sample comparison auto-flags new rule IDs and clusters
- [x] Complete-process expansion hooks are defined

## Scanning

- [x] Baseline axe scan defaults remain broad
- [x] Best-practice findings are split in summaries
- [x] Rule and tag filtering live in config
- [x] Screenshots are kept by default
- [x] Retries are built in

## Process/state coverage

- [x] Process definitions are config-driven
- [x] Simple process DSL is used for V2
- [ ] Full Playwright Test migration is deferred
- [~] Standard pattern library started with blank-submit
- [ ] Trace and video capture are deferred

## Reporting

- [x] JSON summary is the source of truth
- [x] Markdown report is included
- [x] HTML report is included (shipped post-checklist; originally deferred)
- [x] EARL export is included (shipped post-checklist; originally deferred)
- [x] Grouping by rule ID is included
- [x] Grouping by likely component is included

## Method

- [x] Guardrails against overclaiming are explicit
- [x] Manual testing backlog format is defined
- [x] Random sample findings can trigger sample expansion
- [x] Complete processes are treated separately from page scans
