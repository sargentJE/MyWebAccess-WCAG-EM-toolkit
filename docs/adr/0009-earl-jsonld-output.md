# 0009. EARL JSON-LD as the default RDF serialisation

- Status: accepted
- Date: 2026-04-30
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions; zero-dep stance + symbol-
  first citation rule), ADR-0007 (WCAG-EM Step 5 summary shape — the
  `criteriaOutcomes` array is the source of `earl:passed` Assertions
  when `includePasses` is on), ADR-0008 (pluggable reporter runtime —
  this ADR specifies the `earl-jsonld` reporter module's contract)

## Context and Problem Statement

`schemas/config.schema.json` lists `earl-jsonld` as a `reporters`
enum value. The W3C [EARL 1.0
Schema](https://www.w3.org/TR/EARL10-Schema/) is the canonical
machine-readable test-result vocabulary in the accessibility
ecosystem — Alfa, axe-reports, the W3C ACT-rules CG validator, VPAT
generators — but EARL has **five common serialisations**: RDF/XML,
Turtle, JSON-LD, N3, N-Triples. The reporter must pick one (or
several) and document why.

Sub-questions to settle here:

1. Which serialisation is the default for v1.0?
2. Per-violation Assertion model (one Assertion per rule × URL)
   vs per-SC roll-up (one Assertion per criterion)?
3. How do axe outcomes (`failed` / `passed` / `incomplete` /
   `inapplicable`) map to EARL's `earl:OutcomeValue` individuals?
4. `earl:pointer` typing — plain string vs typed
   `{ @type: ptr:CSSSelector, rdf:value: ... }`?
5. Tool identity — what shape goes on `earl:assertedBy` /
   `earl:Assertor`?

## Decision

**JSON-LD as the default; one `earl:Assertion` per (rule × URL)
pair; `earl:pointer` as plain string for v1.0 with explicit typed
follow-up.** The reporter is a pure reformat of `summary.findings[]`
(plus optional `summary.wcagEmSummary.criteriaOutcomes` when
`includePasses` is on) — no new fields synthesised that aren't
already on the input summary.

### 1. JSON-LD vs the other four serialisations

| Format      | Status       | Rationale                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSON-LD** | **Selected** | (a) Zero-dep parsing — Node 22's `JSON.parse` reads it; `Turtle`/RDF-XML/N3/N-Triples need an external parser. (b) Modern ecosystem default — Alfa's `@siteimprove/alfa-earl` package emits JSON-LD; the W3C ACT-rules CG validator consumes JSON-LD. (c) Diff-friendly in PR review (line-oriented like the existing `wcag-em-summary.json`). |
| Turtle      | Rejected     | Most compact human-readable RDF, but every consumer also accepts JSON-LD; shipping Turtle alongside doubles maintenance for no consumer benefit. Re-add as a second reporter (`earl-turtle`?) only if a downstream tool emerges that requires it.                                                                                              |
| RDF/XML     | Rejected     | Verbose, XML-ecosystem-specific (collides with our existing `junit.xml` mental model). The W3C is moving away from RDF/XML as a default.                                                                                                                                                                                                       |
| N3          | Rejected     | Subset of Turtle plus rules; no consumer in the accessibility audit space requires it.                                                                                                                                                                                                                                                         |
| N-Triples   | Rejected     | Line-oriented but lossy (no @context, no CURIEs); strictly worse than JSON-LD for our use case.                                                                                                                                                                                                                                                |

### 2. Per-violation Assertion model (Alfa convention)

Each `summary.findings[]` row becomes **one Assertion per (rule ×
URL)** pair:

```jsonc
{
  "@context": {
    "earl": "http://www.w3.org/ns/earl#",
    "dct": "http://purl.org/dc/terms/",
    "wcag-em": "http://www.w3.org/TR/WCAG-EM/#",
    "doap": "http://usefulinc.com/ns/doap#",
    "foaf": "http://xmlns.com/foaf/0.1/",
  },
  "@type": "earl:Evaluation",
  "dct:date": "2026-05-14T12:00:00.000Z",
  "dct:description": "WCAG-EM automated evaluation of example-site",
  "wcag-em:conformanceTarget": "AA",
  "wcag-em:wcagVersion": "2.2",
  "earl:assertedBy": {
    "@type": "earl:Assertor",
    "doap:name": "wcag-em-a11y-toolkit",
    "doap:release": "1.1.0",
  },
  "@graph": [
    {
      "@type": "earl:Assertion",
      "earl:assertedBy": {
        "@type": "earl:Assertor",
        "doap:name": "wcag-em-a11y-toolkit",
        "doap:release": "1.1.0",
      },
      "earl:subject": "https://example.com/page",
      "earl:test": "image-alt",
      "earl:result": {
        "@type": "earl:Result",
        "earl:outcome": "earl:failed",
        "earl:info": "impact: critical | classification: primary-automated-finding | Images must have alt text | https://dequeuniversity.com/...",
        "earl:pointer": "img",
      },
      "earl:mode": "earl:automatic",
    },
  ],
}
```

A finding affecting N pages produces N Assertions. Findings flow
through `sortFindings` (ADR-0008 §4) so the `@graph` array order is
byte-stable.

**Rejected alternative:** per-SC Assertion model (one Assertion per
criterion, with `earl:result` summarising every rule that mapped to
it). The per-violation model wins for two reasons:

- Round-trip fidelity. A consumer who wants per-SC roll-up can
  derive it from per-violation Assertions; the reverse is lossy.
- Alfa convention. The accessibility ecosystem has converged on
  per-violation Assertions; deviating without good reason fragments
  the consumer story.

When `reporting.includePasses === true`, **per-SC `earl:passed`
Assertions** are appended after the per-violation ones, sourced
from `summary.wcagEmSummary.criteriaOutcomes` where
`outcome === 'passed'`. The subject of these is `summary.site`
(the configured site identifier), not a per-page URL — passing a
WCAG SC is a site-level claim, not a per-page one.

### 3. Outcome mapping table

| axe outcome    | EARL outcome        | Always shown?                                                                  |
| -------------- | ------------------- | ------------------------------------------------------------------------------ |
| `failed`       | `earl:failed`       | Yes                                                                            |
| `incomplete`   | `earl:cantTell`     | Yes (regardless of `includePasses`)                                            |
| `inapplicable` | `earl:inapplicable` | **Never emitted by the reporter** (volume guard, ADR-0008 §6)                  |
| `passed`       | `earl:passed`       | Only when `includePasses === true` (and only at per-SC level — never per-rule) |

Unknown outcome values fall back to `earl:cantTell` — the safest
"we don't know" answer for an audit. The mapping lives in
`OUTCOME_MAP` (frozen object) at the top of the reporter module so
it can be cited by symbol from tests.

### 4. `earl:pointer` — plain string at v1.0

EARL 1.0's `earl:pointer` accepts a `ptr:Pointer` subtype
(`ptr:CSSSelector`, `ptr:StringMatch`, `ptr:XPathPointer`, etc).
The reporter emits `earl:pointer` as a plain string — the first
selector from `finding.targets[0]`.

```jsonc
"earl:pointer": "img.profile-photo"
```

Strict-mode EARL validators (the ACT-rules CG validator runs in
strict mode by default) will warn that the pointer lacks a typed
value. The pragmatic v1.0 choice trades strict conformance for:

- **Simplicity.** Typed pointers require extending `@context` to
  include `ptr:` (`http://www.w3.org/2009/pointers#`) and emitting
  `{ "@type": "ptr:CSSSelector", "rdf:value": "img.profile-photo" }`
  for every Assertion. ~50% size increase in the emitted JSON-LD
  for marginal validator benefit at v1.0.
- **Real-world tolerance.** Alfa, Pa11y, axe-reports all accept
  plain-string pointers; only the strict ACT-rules validator warns.

**Follow-up signal:** if real validator feedback surfaces (a user
reports a downstream tool refusing the output), revisit by adding
the typed form behind a config flag (`reporting.earlStrictMode:
true` → emits typed pointers + extends `@context` accordingly).
The hooks are documented in the reporter's JSDoc; the change is
~20 LOC.

### 5. Tool + evaluator identity — `earl:Assertor` shape

```jsonc
"earl:assertedBy": {
  "@type": "earl:Assertor",
  "doap:name": "wcag-em-a11y-toolkit",
  "doap:release": "1.1.0",
  "foaf:name": "Jamie Sargent",          // optional — from wcagEm.evaluator.name
  "foaf:mbox": "auditor@example.com"     // optional — from wcagEm.evaluator.contact
}
```

Tool identity pulled from `TOOL_IDENTITY` (`src/lib/version.mjs`):

- `doap:name` — package name. Stable across versions.
- `doap:release` — package version. Increments per published release.

When `wcagEm.evaluator` is configured with non-empty values, the
assertor includes `foaf:name` (evaluator name) and `foaf:mbox`
(evaluator contact). These fields are omitted for default/empty
evaluator config, preserving backward compatibility. This allows
EARL consumers to identify both the tool that produced the assertions
and the human evaluator who configured and reviewed the audit.

`doap:homepage` is **omitted** at v1.0. The package.json doesn't
ship a `homepage` field yet (v2.0 will, alongside the
README rewrite). Adding it now would mean a version-bump path that
adds a transient field; cleaner to defer to v2.0.

The `@context` is `http://www.w3.org/ns/earl#` (single-vocab). The
`foaf:` prefix follows the same informal pattern as `doap:` — no
namespace expansion at v1.0. When typed pointers ship (the §4
follow-up), `@context` becomes a multi-vocab object embedding
`ptr:`, `doap:`, and `foaf:` explicitly.

## Consequences

### Positive

- One canonical EARL output per audit. No "Turtle vs JSON-LD" choice
  surfaced to users.
- Zero parsing dependencies — `JSON.parse` is sufficient for any
  consumer that wants to programmatically read the output.
- Mapping table + Assertor shape are traceable to specific symbols
  (`OUTCOME_MAP`, `buildAssertor`, `buildAssertion`), so tests can
  reference them directly without restating the constants.

### Negative / accepted trade-offs

- Strict ACT-rules validator warns on `earl:pointer` as plain string.
  Acknowledged + tracked above; not a blocker because real-world
  consumers accept plain strings.
- Per-violation × N-pages can produce a large `@graph` for big
  audits. Not a v1.0 problem (default sample is 80 pages); v2.0+
  may add an `earl:Assertion`-deduplication mode that aggregates
  rule-on-page tuples.
- `doap:homepage` deferred until v2.0 — minor; the
  current Assertor identifies the tool unambiguously via `name +
release`.

**Update (v1.1.0):** the EARL document now wraps the `@graph` in an
evaluation-level `earl:Evaluation` node with `dct:date`,
`dct:description`, `wcag-em:conformanceTarget`, and
`wcag-em:wcagVersion`. The `@context` is expanded from a single string
to a multi-namespace object (`earl`, `dct`, `wcag-em`, `doap`, `foaf`).

## Symbol references (per ADR-0001)

- `name` / `emit` — exported by `src/reporters/earl-jsonld.mjs` (the
  reporter's public contract, registered in
  `src/reporters/index.mjs`).
- `OUTCOME_MAP` / `EARL_CONTEXT` / `buildAssertion` / `buildAssertor` /
  `buildInfo` — module-private inside
  `src/reporters/earl-jsonld.mjs`. Tests assert behaviour through
  `emit()` rather than importing the helpers directly; a future change
  that needs to extract one for re-use should also export it.
- `TOOL_IDENTITY` — `src/lib/version.mjs` (source of `doap:name` +
  `doap:release`).
- `sortFindings` — `src/reporters/_sort.mjs` (orders the `@graph`).
- `criteriaOutcomes` — `src/lib/wcag-em-summary.mjs` per ADR-0007
  (source of per-SC `earl:passed` Assertions when `includePasses`
  is on).
