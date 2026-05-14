# 0011. v1.0 release boundary

- Status: accepted
- Date: 2026-05-14
- Deciders: Jamie Sargent
- Consulted: ADR-0012 (extensibility is internal for v1.0),
  ADR-0008 (pluggable reporters — sealed registry),
  ADR-0014 (packaging decisions)

## Context and Problem Statement

The toolkit has accumulated five layers of work (foundation, conventions,
bug fixes, features, reporters) since the v0.3 import. Before tagging
v1.0.0, the project needs a written boundary that states what is in
scope for v1.0, what is explicitly deferred, and what stability
guarantees consumers can rely on. Without this record, the version
number alone carries no semantics — a v1.0 release should mean
something specific.

## Decision

### What ships in v1.0

The v1.0 release includes the full output of Layers 0–5:

| Surface               | Summary                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLI**               | `bin/wcag-em.mjs` with six subcommands (`discover`, `sample`, `scan`, `scan-processes`, `summarize`, `audit`) + global flags. Exit codes 0/1/2 (Pa11y-compatible).                          |
| **Configuration**     | Ajv-validated `schemas/config.schema.json` with `validRegex` keyword, default tag profile, multi-viewport, per-URL overrides, auth, beforeScan actions, processes, document-link filtering. |
| **Scanning**          | Multi-viewport axe runs (ADR-0006), authenticated scans (`storageState`, `httpCredentials`, `extraHTTPHeaders`), per-URL axe overrides with first-match-wins semantics.                     |
| **WCAG-EM alignment** | Per-SC criteria inversion (`toWcagEmSummary`), EARL JSON-LD output (ADR-0009), findings-aware `buildManualBacklog`, tool-identity stamp on every artefact.                                  |
| **Reporters**         | Five built-in reporters (`json`, `markdown`, `html`, `earl-jsonld`, `junit`) behind a module-private registry (ADR-0008). Deterministic sort. XSS-safe HTML template.                       |
| **Programmatic API**  | `src/index.mjs` re-exports `buildContext`, `createLogger`, `getLogger`, `validateConfig`, `assertValidConfig`, `runPreflight`, `runAudit`.                                                  |

### What is deferred to v2.0 or later

| Item                                | Rationale                                                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public plugin API for reporters** | ADR-0012 decision: extensibility is internal for v1.0. The registry `Map` is module-private. v2.0 will expose a registration hook once the reporter interface has been validated by real-world usage.           |
| **i18n / localisation**             | ADR-0001 codifies English-only CLI output. Supporting translated strings requires a message catalogue, ICU-format pluralisation, and locale-aware number formatting — out of scope.                             |
| **Baseline / regression mode**      | Diffing the current run against a saved baseline (`--baseline`) to surface new vs known findings is a v2.0 feature.                                                                                             |
| **Authenticated SPA crawler**       | `auth.setupScript` runtime execution is deferred pending a security review (Layer 3b follow-up). The schema validates the field; the runtime emits a `warnSchemaAcceptedRuntimeIgnored` via `src/lib/auth.mjs`. |
| **CI auto-publish workflow**        | ADR-0015 decision: v1.0 uses manual `npm publish`. A GitHub Actions release workflow triggers on version tags as a v2.0 enhancement.                                                                            |

### Stability guarantees

- **CLI surface**: stable. Subcommands, flags, exit codes, and artefact
  file names are covered by semver.
- **Programmatic API** (`src/index.mjs`): exposed but **unstable until
  v2.0** (ADR-0012). Breaking changes to function signatures may occur
  in minor releases. The CLI is the blessed surface for end-users.
- **Deep imports** (`./commands/*`, `./lib/*`): removed from
  `package.json` exports in ADR-0014. Internal modules are not part
  of the public API surface and may change without notice.
- **Config schema**: additive changes (new optional fields) are minor
  releases. Removing or renaming a field follows the deprecation
  policy in ADR-0015.

## Consequences

### Positive

- Consumers know exactly what they can depend on at v1.0.
- The deferred-items list doubles as a v2.0 roadmap seed.
- The stability tiers (CLI stable / API unstable / internals private)
  prevent accidental coupling to implementation details.

### Negative / accepted trade-offs

- Consumers who need CSV, SARIF, or custom reporter formats must
  fork or wait for v2.0.
- The programmatic API is usable but comes with a "may break in
  minor releases" warning, which may deter some embedders.

## Symbol references (per ADR-0001)

- `runAudit` / `buildContext` / `validateConfig` — `src/index.mjs`.
- `TOOL_IDENTITY` — `src/lib/version.mjs` (reads `name` + `version`
  from `package.json` at import time).
- `toWcagEmSummary` — `src/lib/wcag-em-summary.mjs`.
- `runReporters` / `listReporters` — `src/reporters/index.mjs`.
- `warnSchemaAcceptedRuntimeIgnored` — `src/lib/auth.mjs`.
