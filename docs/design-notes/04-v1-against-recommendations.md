# V1 Against Recommended V2

> **Design-time record (April 2026).** These notes captured the v2 design
> framework while the toolkit was being built and are kept for history;
> details may no longer match the shipped behaviour. For current usage see
> the [guides](../guides/) and [README](../../README.md); for current
> decisions see the [ADRs](../adr/).

## V1 already proved

- root-URL discovery works
- bounded crawl works
- structured sample creation works
- random sample creation works
- seed-based repeatability works
- sample-based page scans work
- screenshot capture works
- raw JSON output works

## Recommended V2 adds

- stronger config defaults
- optional sitemap seeding
- crawl-time exclusions
- richer discovery metadata
- cluster output
- process candidate output
- hybrid sample construction
- random-vs-structured comparison flags
- grouped findings by rule and component
- standard manual backlog output
- clearer guardrails against overclaiming
