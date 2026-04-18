# Decision Points and Recommended Answers

This file breaks down the V1/V2 decision points and the recommendation now baked into this build.

## Scope model

### Default scope mode
**Recommendation:** `same-hostname` by default.

Why:
- safer than crawling all subdomains by accident
- still practical for most public-site audits
- easy to widen later using `allowed-hosts`

### Subdomain handling
**Recommendation:** do not include subdomains by default. Use `allowed-hosts` only when they are explicitly part of the audit scope.

### Third-party flows
**Recommendation:** do not auto-scan third-party flows as if they are part of the same audit. Discover and document them, but include them only when the scope says so.

### Small-site supplementary scan
**Recommendation:** if the same-scope inventory is at or below the configured threshold, recommend a full-site supplementary automated scan in addition to the WCAG-EM sample.

## Discovery

### URL normalization
**Recommendation:** normalize aggressively enough to reduce duplicates, but not so aggressively that distinct content gets collapsed.

Locked in here:
- strip hash
- remove default ports
- trim trailing slash except root
- remove common tracking parameters
- sort remaining query params

### Sitemap seeding
**Recommendation:** add it now.

Why:
- cheap uplift in coverage
- still bounded by scope and crawl caps
- useful when nav does not expose every page type

### Metadata capture
**Recommendation:** capture enough metadata for clustering and process hints now.

Locked in here:
- title
- H1
- canonical
- form count
- search input count
- landmark count
- page type
- cluster key
- likely process types

### Crawl-time exclusions
**Recommendation:** yes. Exclusions belong in config and should apply during discovery, not after.

### Process entry candidates
**Recommendation:** yes. Discovery should flag likely form/search/critical-process pages.

## Sampling

### Structured sample source
**Recommendation:** hybrid model.

Locked in here:
- manual structured sample remains available in config
- toolkit also proposes structured coverage from page clusters
- final structured sample merges both

### Random sample rounding
**Recommendation:** `ceil(structured * percent)` with a minimum of 2 pages.

### Random sample seed
**Recommendation:** always record it.

### Random sample comparison
**Recommendation:** auto-flag when the random sample introduces new rule IDs or new page clusters.

### Complete-process expansion
**Recommendation:** process definitions remain explicit in config. If a process is forced in or already selected, include its start URL and any listed related URLs.

## Scanning

### Baseline axe defaults
**Recommendation:** keep axe defaults broad unless the evaluator narrows them deliberately.

### Best-practice split
**Recommendation:** separate `best-practice` findings from primary automated findings in summaries.

### Rule/tag filtering
**Recommendation:** keep filters in config, not in code.

### Screenshots
**Recommendation:** on by default.

### Retries
**Recommendation:** one retry by default.

## Process/state coverage

### Process definitions
**Recommendation:** keep them config-driven.

### Process DSL
**Recommendation:** a simple DSL is enough for V2.

Locked in here:
- goto
- click
- fill
- press
- waitFor
- screenshot
- axe
- plus shortcut patterns such as `blank-submit`

### Playwright Test migration
**Recommendation:** defer.

Why:
- it is a strong future direction
- but not essential to make V2 useful and reproducible
- the current config-driven Node approach is enough for now

### Standard patterns
**Recommendation:** support blank-submit now, partial-submit next, and leave richer menu/modal/search libraries for the next iteration.

### Trace and video artifacts
**Recommendation:** defer. Screenshots already carry a lot of value and keep the toolkit lighter.

## Reporting

### JSON summary model
**Recommendation:** lock it now and treat it as the source of truth.

### Markdown report
**Recommendation:** yes, enough for V2.

### HTML report
**Recommendation:** defer until the internal report schema settles.

### EARL export
**Recommendation:** defer until the internal model stabilises.

### Grouping level
**Recommendation:** group by both rule ID and likely component hint.

## Method

### Overclaiming guardrails
**Recommendation:** keep them explicit in README and reports.

### Manual testing backlog
**Recommendation:** generate a standard backlog file every run.

### Random sample expansion trigger
**Recommendation:** yes. If random-only rule IDs or random-only clusters appear, flag the need to revisit the structured sample.

### Process separation
**Recommendation:** always keep process/state outputs separate from baseline page scans.
