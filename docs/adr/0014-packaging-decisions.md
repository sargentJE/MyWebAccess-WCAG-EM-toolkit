# 0014. Packaging decisions

- Status: accepted
- Date: 2026-05-14
- Deciders: Jamie Sargent
- Consulted: ADR-0012 (extensibility is internal for v1.0),
  ADR-0008 (pluggable reporters — `./reporters/*` already removed
  from exports), ADR-0011 (v1.0 release boundary — stability tiers)

## Context and Problem Statement

Before the first `npm publish`, four `package.json` decisions need to
be made together:

1. **Name.** The working name `wcag-em-a11y-toolkit-v2-recommended`
   predates the v1.0 promotion. The `-v2-recommended` suffix implies
   a variant rather than the canonical package.
2. **Exports.** The current `exports` map exposes `./commands/*` and
   `./lib/*` subpaths alongside the root `.` entry. These deep
   subpaths let consumers import internal modules
   (`import { buildContext } from 'wcag-em-a11y-toolkit/lib/context'`)
   that are not stability-guaranteed (ADR-0012).
3. **Files.** No `files` field exists; npm falls back to `.gitignore`
   exclusions, which may ship test fixtures, configs, and docs that
   inflate the tarball.
4. **Private flag.** `"private": true` blocks `npm publish` entirely.

These four changes are coupled: the name change affects tool-identity
stamping (`TOOL_IDENTITY` in `src/lib/version.mjs` reads `name` from
`package.json`), and the exports change implements the stability tiers
codified in ADR-0011.

## Decision

### 1. Rename to `wcag-em-a11y-toolkit`

Drop the `-v2-recommended` suffix. The toolkit is the primary (and
only) package — calling it "recommended" against an unnamed
alternative is confusing.

The name change propagates automatically to:

- `TOOL_IDENTITY.name` (every emitted JSON/markdown artefact),
- `toolIdentityMarkdownHeader()` output,
- the npm registry listing.

No code change is needed beyond `package.json` because `version.mjs`
reads the name dynamically at import time.

### 2. Narrow exports to root only

```jsonc
// Before
"exports": {
  ".":              { "types": "./src/types/index.d.ts", "default": "./src/index.mjs" },
  "./commands/*":   "./src/commands/*.mjs",
  "./lib/*":        "./src/lib/*.mjs"
}

// After
"exports": {
  ".": { "types": "./src/types/index.d.ts", "default": "./src/index.mjs" }
}
```

The `./reporters/*` entry was already removed in Layer 4 (ADR-0008).
Removing `./commands/*` and `./lib/*` completes the narrowing.

**Internal imports are unaffected.** All `src/` and `test/` files use
relative paths (`../../src/commands/scan.mjs`), not package-name
imports. The `runAudit()` convenience in `src/index.mjs` uses
`import('./commands/${name}.mjs')` — a relative dynamic import that
does not traverse the exports map.

### 3. Add explicit `files` whitelist

```json
"files": [
  "bin/",
  "src/",
  "schemas/",
  "configs/",
  "README.md",
  "LICENSE",
  "CHANGELOG.md"
]
```

This excludes `test/`, `docs/`, `.github/`, editor configs, and
fixture data from the published tarball. `npm pack --dry-run`
verifies the inclusion list before publish.

### 4. Remove `private: true`

Set `"private": false` (or remove the field) in the release commit
to unblock `npm publish`.

## Consequences

### Positive

- The npm tarball is lean: only source, binary, schema, example
  configs, and essential docs.
- Consumers can only import from the root entry point
  (`import { runAudit } from 'wcag-em-a11y-toolkit'`). Internal
  module churn does not break downstream code.
- The package name is concise and memorable.

### Negative / accepted trade-offs

- Consumers who were importing `wcag-em-a11y-toolkit/lib/urls` or
  similar deep paths must migrate to the root entry or copy the
  relevant utility into their own codebase. Given the "unstable
  until v2.0" warning from ADR-0011, this is intentional friction.
- The `bin` field retains `"wcag-em"` as the CLI command name,
  which does not exactly match the package name. This is deliberate:
  `wcag-em` is shorter for shell invocation, and the pattern
  (short CLI name, descriptive package name) is common in the
  npm ecosystem.

## Symbol references (per ADR-0001)

- `TOOL_IDENTITY` — `src/lib/version.mjs` (reads `name` from
  `package.json` via `import.meta.url`-relative `fs.readFileSync`).
- `runAudit` — `src/index.mjs` (the root-export convenience that
  survives the exports narrowing).
- `exports` map — `package.json` (top-level field).
