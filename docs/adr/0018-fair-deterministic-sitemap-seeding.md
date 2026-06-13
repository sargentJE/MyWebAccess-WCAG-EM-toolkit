# ADR-0018 — Fair, deterministic, recursion-aware sitemap seeding

## Status

Accepted.

## Context

`getSitemapSeeds` drained its seed budget (`maxUrls`) in **config/BFS order**:
the first sitemaps processed filled the budget, and later ones were never
reached. On a live 16-sitemap site this starved coverage — a 1001-URL events
sitemap consumed the budget 37 URLs into the next sitemap, and the `post-sitemap`
(blog) was never fetched (6 of 230 posts seeded). Three coupled defects:

1. **No fairness.** FIFO drain lets one large sitemap shut out the rest.
2. **Leaf-vs-index by URL extension.** A per-`<loc>` `/\.xml/` regex mis-treated
   `/sitemap?page=2` index children as pages and `.xml` content URLs as
   sitemaps.
3. **No telemetry + no fetch bound.** `reachedMaxPages` tracked only the crawl
   ceiling, not the seed cap; a malicious/large index could fan out to thousands
   of document fetches.

## Decision

Rewrite `getSitemapSeeds` as expand-then-allocate, returning telemetry:

1. **Phase 1 — expand the index tree.** BFS over the sitemap tree, classifying
   each document by its **root element** (`<sitemapindex>` vs `<urlset>`), not by
   per-`<loc>` extension. Index locs are child sitemaps (enqueued); leaf locs are
   page URLs (collected, in-scope, sorted + deduped). **Bound total documents
   fetched** by `sitemapSeeding.maxSitemapDocs` (default 50); unfetched children
   are recorded as `neverReached`.
2. **Phase 2 — pure round-robin reservoir** across leaves sorted by URL: round
   `r` takes each leaf's `r`-th URL until `maxUrls`. **No proportional/floor
   allocation** — round-robin maximizes content-TYPE representation (a 9-URL form
   sitemap gets in before a 1001-URL events sitemap drowns it), which is what the
   downstream cluster-based sampler wants.
3. **Telemetry** → `inventory-metadata.json.sitemaps`: per-leaf
   `{found, contributed, clipped}`, `reachedSitemapCap` (the seed-cap analogue of
   `reachedMaxPages`), `neverReached`, `docsFetched`.

**Determinism (WCAG-EM Step 3c).** Seeds must be reproducible for a fixed
`randomSeed`. Leaves are URL-sorted and each leaf's locs are pre-sorted, so the
positional round-robin is **independent of fetch arrival order** — the fetches
are therefore kept **sequential** (parallelizing them would make the clip set
arrival-order-dependent and break reproducibility). A two-run byte-identical
seed-list test guards this.

## Consequences

- `getSitemapSeeds` returns `{ seeds, perSitemap, reachedSitemapCap,
neverReached, sitemapDocsFetched }` instead of `string[]`; `discover.mjs`
  destructures `.seeds` and writes the telemetry. (Internal contract — only
  `discover` and the tests call it.)
- New config `sitemapSeeding.maxSitemapDocs` (schema + DEFAULTS + config guide +
  regenerated `config.d.ts`).
- **Seed fairness is NOT sample fairness.** This ADR fixes the _seed_ layer
  (which sitemaps get into the crawl). The WCAG-EM Step 3c _random sample_ still
  draws uniformly from the whole post-crawl inventory (`sample.mjs`), so a
  content type that blooms via internal cross-linking can still dominate the
  random tier. That residual skew is made **visible** by E1's `automatedCoverage`
  - per-type coverage, not hidden. A stratified random sampler is a noted
    follow-up, deliberately out of scope here.
- The recorded sample for a re-run changes (reproducible given fixed inputs, but
  the previous run's sample will not byte-reproduce). Noted in CHANGELOG.

## References

- `src/lib/sitemap.mjs` — `getSitemapSeeds` (ExpandIndexTree + RoundRobinReservoir).
- `src/commands/discover.mjs` — destructures `.seeds`, writes `sitemaps` telemetry.
- `src/lib/config.mjs`, `schemas/config.schema.json` — `maxSitemapDocs`.
- `test/unit/sitemap.test.mjs` — recursion, fairness, body-classification,
  determinism, telemetry, anti-amplification.
- `docs/reviews/2026-06-epics-E1-E7.md` (E2) — the evidence.
