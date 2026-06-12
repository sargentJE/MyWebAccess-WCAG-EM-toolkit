# Build Choices Implemented in This Recommended Version

> **Design-time record (April 2026).** These notes captured the v2 design
> framework while the toolkit was being built and are kept for history;
> details may no longer match the shipped behaviour. For current usage see
> the [guides](../guides/) and [README](../../README.md); for current
> decisions see the [ADRs](../adr/).

## Implemented now

- config-driven scope model
- sitemap seeding
- crawl-time exclusion rules
- richer discovery metadata
- cluster output
- process candidate output
- hybrid structured sample building
- fixed random sample rounding rule
- recorded seed and sample metadata
- process expansion hooks
- page scans with retry
- grouped findings by rule
- grouped findings by likely component
- random-vs-structured comparison output
- manual backlog generation
- Markdown and JSON reporting

## Intentionally deferred

- Playwright Test migration for process execution
- HTML reporting
- EARL export
- trace and video capture by default
- complex authenticated flow orchestration
- advanced component clustering beyond selector hints
