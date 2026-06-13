# Architecture Decision Records

This project uses [MADR 4.0](https://adr.github.io/madr/) for capturing
architectural decisions. ADR-0001 names this directory as the canonical
home for design rationale; CHANGELOG entries summarise _what_ changed,
ADRs explain _why_ the change was made and _what alternatives were
rejected_.

## Index

| #                                                 | Title                                                              | Status   | Date       |
| ------------------------------------------------- | ------------------------------------------------------------------ | -------- | ---------- |
| [0000](./0000-record-architecture-decisions.md)   | Record architecture decisions                                      | accepted | 2026-04    |
| [0001](./0001-project-conventions.md)             | Project conventions (Node 22, JS+JSDoc, flat ESLint, no telemetry) | accepted | 2026-04    |
| [0002](./0002-config-is-ajv-validated.md)         | Configuration is Ajv-validated                                     | accepted | 2026-04    |
| [0003](./0003-commander-cli.md)                   | Commander-based CLI                                                | accepted | 2026-04    |
| [0004](./0004-pino-structured-logging.md)         | Pino structured logging                                            | accepted | 2026-04    |
| [0005](./0005-fail-fast-on-config.md)             | Fail fast on config                                                | accepted | 2026-04    |
| [0006](./0006-multi-viewport-axe-runs.md)         | Multi-viewport axe runs                                            | accepted | 2026-04    |
| [0007](./0007-wcag-em-summary-shape.md)           | WCAG-EM Step 5 summary shape                                       | accepted | 2026-04    |
| [0008](./0008-pluggable-reporters.md)             | Pluggable reporter runtime (internal at v1.0)                      | accepted | 2026-04-30 |
| [0009](./0009-earl-jsonld-output.md)              | EARL JSON-LD as the default RDF serialisation                      | accepted | 2026-04-30 |
| [0010](./0010-project-layout.md)                  | Project layout                                                     | accepted | 2026-05-14 |
| [0011](./0011-v1-release-boundary.md)             | v1.0 release boundary                                              | accepted | 2026-05-14 |
| [0012](./0012-extensibility-is-internal.md)       | Extensibility is internal for v1.0                                 | accepted | 2026-04    |
| [0013](./0013-crawlee-localhost-investigation.md) | Crawlee localhost-fixture hang investigation and resolution        | accepted | 2026-05-09 |
| [0014](./0014-packaging-decisions.md)             | Packaging decisions                                                | accepted | 2026-05-14 |
| [0015](./0015-publish-and-deprecation-policy.md)  | Publish and deprecation policy                                     | accepted | 2026-05-14 |
| [0016](./0016-incomplete-node-evidence.md)        | Incomplete-node evidence (amended 2026-06)                         | accepted | 2026-06-07 |
| [0017](./0017-page-outcome-could-not-audit.md)    | Page-outcome: a first-class could-not-audit status                 | accepted | 2026-06-13 |
| [0019](./0019-redirect-aware-scanning.md)         | Redirect-aware scanning (final-URL identity)                       | accepted | 2026-06-13 |

## Numbering convention

ADR numbers are append-only. All reserved seats through 0019 are
now filled (0018 lands on the E2 branch). The next available number is **0020**.

## Citation convention

ADRs cite the codebase by **symbol** (function name, exported
constant, ANCHOR comment) rather than by raw line number. Symbol
references survive refactors that line numbers don't. See commit
`ac16000` for the originating discussion.

## Adding a new ADR

1. Pick the next available number (sequence resumes at 0020).
2. Copy the template from any recent ADR (0007 / 0008 / 0009 are
   current-style references).
3. Fill `Status`, `Date`, `Deciders`, `Consulted`, then the
   `Context and Problem Statement` / `Decision` /
   `Consequences` sections.
4. Add the entry to the table above. Update any cross-referencing
   ADRs to mention the new one.
5. Land the ADR in the same commit as the code that implements the
   decision (or in a follow-up commit during the same release).
