# 0015. Publish and deprecation policy

- Status: accepted
- Date: 2026-05-14
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions), ADR-0011 (v1.0 release
  boundary — stability tiers), ADR-0014 (packaging decisions)

## Context and Problem Statement

Before the first public npm publish, two lifecycle questions need
codified answers:

1. **How are releases made?** Without a documented flow, the risk is
   ad-hoc version bumps that skip validation steps or produce
   inconsistent artefacts.
2. **How are breaking config changes communicated?** The config schema
   (`schemas/config.schema.json`) is a public interface. Removing or
   renaming a field without warning would break existing user configs
   silently — or, worse, with an opaque Ajv validation error.

## Decision

### Versioning

The project follows [Semantic Versioning 2.0.0](https://semver.org/):

| Change type                                                            | Version bump | Example       |
| ---------------------------------------------------------------------- | ------------ | ------------- |
| Bug fix, documentation                                                 | patch        | 1.0.0 → 1.0.1 |
| New config field, new reporter, new CLI flag                           | minor        | 1.0.0 → 1.1.0 |
| Removed/renamed config field (after deprecation), API signature change | major        | 1.x → 2.0.0   |

**Exception:** the programmatic API (`src/index.mjs`) is explicitly
unstable until v2.0 (ADR-0011). Breaking changes to function
signatures may occur in minor releases during the v1.x series.
The CLI surface and config schema are semver-stable from v1.0.0.

### Deprecation policy for config fields

1. **Deprecation release (minor).** The field remains in the schema
   and continues to function. The runtime emits a one-shot
   `warn`-level log message via `warnLegacyAliasResolved` or a
   purpose-built helper. The message names the deprecated field,
   the replacement (if any), and the version in which it will be
   removed.

2. **Removal release (next minor or major).** The field is removed
   from the schema. Configs that still use it receive an Ajv
   validation error at load time — a clear, actionable failure
   rather than silent data loss.

**Duration:** one minor version. A field deprecated in 1.1.0 is
removed no earlier than 1.2.0. Patch releases do not remove
deprecated fields.

**Existing example:** `reporting.markdownReport` was deprecated in
Layer 4 (replaced by `reporting.reporters: ['markdown']`). The
runtime emits `warnLegacyAliasResolved` when the old field is
present. It will be removed in the first post-v1.0 minor release.

### Publish flow

```
npm version <major|minor|patch>   # bumps package.json + package-lock.json + git tag
npm run format:check && npm run lint && npm run typecheck && npm test
npm pack --dry-run                # verify tarball contents against files[] whitelist
npm publish --dry-run             # smoke-check registry interaction
npm publish                       # publish to npm
```

`npm version` creates the git tag automatically. The tag triggers the
CI workflow, which runs the full gate as a final safety net.

**No auto-publish CI at v1.0.** The publish step is manual. The
reasoning: the project is single-maintainer and low-cadence; the
overhead of a fully automated release pipeline (npm token
management, provenance attestation, changelog automation) exceeds
the benefit at this scale. A GitHub Actions release workflow is a
v2.0 enhancement.

### Dependency update policy

- **Dependabot or Renovate** runs on a weekly schedule.
- PRs are **manually reviewed and merged** — no auto-merge.
- Security patches (npm audit alerts) may be fast-tracked outside
  the weekly cadence.
- Major-version dependency bumps are treated as minor releases of
  the toolkit (they may surface new axe-core rules or changed
  Playwright behaviour).

## Consequences

### Positive

- Users of the config schema get at least one release of deprecation
  warnings before a field disappears — no silent breakage.
- The publish flow is documented and repeatable, reducing the risk
  of a botched release.
- The weekly dependency cadence balances freshness against review
  burden for a single-maintainer project.

### Negative / accepted trade-offs

- The one-minor deprecation window is short. High-traffic packages
  typically offer two or three minors. For a low-cadence CLI tool
  with a small user base, one minor is proportionate.
- Manual publishing adds human error risk (forgetting to run the
  gate, publishing from a dirty working tree). The documented
  checklist mitigates this; CI auto-publish is the long-term fix.

## Symbol references (per ADR-0001)

- `warnLegacyAliasResolved` — `src/lib/auth.mjs` (shared helper
  for deprecation warnings; colocated with
  `warnSchemaAcceptedRuntimeIgnored`).
- `assertValidConfig` — `src/lib/validate-config.mjs` (the Ajv
  gate that surfaces schema errors on removed fields).
- `files` — `package.json` (the tarball whitelist from ADR-0014).
