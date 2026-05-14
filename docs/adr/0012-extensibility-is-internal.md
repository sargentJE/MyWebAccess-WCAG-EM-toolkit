# 0012. Extensibility is internal for v1.0

- Status: accepted
- Date: 2026-04-19
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions), ADR-0007 (WCAG-EM summary shape)

## Context and Problem Statement

`src/lib/urls.mjs` exports a set of heuristic classifiers that shape
every downstream artefact:

- `guessPageType(url)` — tags each URL as `homepage` / `policy` /
  `form-or-contact` / `detail` / `listing` / `content` / etc. Used by
  `sample.mjs` to prefer representative pages per cluster and by
  `summarize.mjs` to group findings.
- `clusterKeyFor(url, pageType)` — pairs the page type with the first
  path segment so similarly-shaped URLs dedupe into one cluster.
- `guessProcessTypes({url, formCount, searchInputCount})` — labels a
  URL as likely `process-entry` material.
- `selectorComponentHint(selector)` — best-effort "component hint"
  from a CSS selector, used to bucket findings by likely design-system
  component.

These heuristics are **necessary for the pipeline to function** but
they are not stable public surface. They are:

- Crude by design — the heuristics lean on URL patterns and simple
  counts, not on semantic analysis of page contents.
- Expected to evolve — better classifiers (LLM-assisted page-type
  detection, proper component-library introspection) will likely
  replace some of them in v2.0.
- Easy to write a plugin for — users could plug in site-specific
  logic, and the ecosystem eventually should support that.

The question at v1.0 is: do we ship a plugin API for these classifiers
now, or defer?

## Decision

**Ship v1.0 with the four classifiers marked `@internal` in their
JSDoc.** Do NOT publish a plugin API. Defer the extensibility story
to v2.0.

### What `@internal` means in this project

- **JSDoc `@internal` tag** on each exported function. Documented by
  `eslint-plugin-jsdoc` but not enforced at lint level today; enforced
  by convention + future-v2.0 codemod that strips `@internal` symbols
  from the published `.d.ts` (when we ship type declarations in
  v2.0).
- **No stability guarantee across minor versions.** Downstream code
  that depends on these classifiers does so at its own risk; a future
  minor release may change behaviour without the changelog treating
  it as a breaking change (because it's not — these are internal).
- **Still exported.** They remain in the module's export surface
  because (a) removing them would require a major refactor to
  collapse the helper-pipeline shape, and (b) they're genuinely useful
  as programmatic-API entry points for advanced users who accept the
  internal-ness.

## Consequences

- **Cleaner v1.0 surface area.** The public contract is the CLI +
  `runAudit()` programmatic entry point + the config schema + the
  artefact JSON shapes. Not a plugin API; not a classifier contract.
- **Future refactor headroom.** v2.0 can rewrite any
  classifier without a semver-major bump. Users who depend on the
  internal symbols accept that.
- **Plugin API deferred to v2.0.** The v2.0 agenda includes a proper
  extension-point interface for classifiers — likely a registry
  pattern where users register a `{ pageType(url) }` object via the
  config. Out of scope for v1.0.
- **Type declarations respect the boundary.** When v2.0 ships
  `.d.ts` generation via `tsc --emitDeclarationOnly`, a codemod (or
  hand-curation) strips `@internal` symbols from the public surface.
  Consumers of `import('wcag-em-a11y-toolkit')` do not see the
  classifiers in IntelliSense unless they opt into the internal
  types.
- **Documentation honesty.** `src/lib/urls.mjs`'s module docstring
  names the four classifiers and cross-references this ADR. A
  maintainer reading the file sees the `@internal` + the decision
  rationale in one hop.

## More Information

- [ADR-0001 — Project conventions](./0001-project-conventions.md) —
  the export-surface discipline this ADR is an instance of.
- [ADR-0007 — WCAG-EM summary shape](./0007-wcag-em-summary-shape.md) —
  the artefact contract this classifier boundary supports.
- `src/lib/urls.mjs` — houses the four `@internal` classifiers.
- `src/commands/sample.mjs` — primary consumer of `guessPageType` +
  `clusterKeyFor`.
- `src/commands/discover.mjs` — primary consumer of
  `guessProcessTypes`.
- `src/commands/summarize.mjs` — consumer of `selectorComponentHint`
  for component-grouped findings.
