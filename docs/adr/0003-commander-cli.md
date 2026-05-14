# 0003. Commander-based CLI at bin/wcag-em.mjs

- Status: accepted
- Date: 2026-04-18
- Deciders: Jamie Sargent

## Context and Problem Statement

The v0.3 toolkit had five top-level Node scripts driven by npm-script entries,
with a hand-rolled `parseArgs` that recognised exactly `--key value` pairs
and nothing else. No `--help`, no `--version`, no way to pass a subcommand.
Users relied on remembering `npm run discover -- --config foo.json`.

A best-in-class CLI has one binary, one `--help`, subcommands, and exit codes
that match industry convention.

## Decision

Commander 12 at `bin/wcag-em.mjs`. Six subcommands matching the pipeline
stages: `discover`, `sample`, `scan`, `scan-processes`, `summarize`, `audit`.

Global flags:

- `-c, --config <path>` — site config JSON path (default
  `configs/example-site.json`).
- `-o, --out-dir <path>` — output root (default `output`).
- `-l, --log-level <level>` — pino level (`trace|debug|info|warn|error|fatal`).
- `--quiet` — alias for `--log-level=warn`.
- `--verbose` — alias for `--log-level=debug`.

Exit codes (Pa11y-compatible):

- `0` — clean; no findings above threshold.
- `1` — runtime error (bad config, preflight failure, crash).
- `2` — findings exceeded `reporting.failOnFindings` threshold. **Policy
  lands in WCAG-EM summary**; v0.3 only exits 0 or 1.

Engine guard: refuses to run on Node <22.11.0 with an actionable message
before any ES2023-requiring module is loaded.

## Consequences

- The npm scripts in `package.json` (`npm run discover` etc.) still work but
  are thin wrappers over `node src/commands/X.mjs`; they remain through v1.1
  and may be removed in v1.2.
- Programmatic use via `import { run } from 'wcag-em-a11y-toolkit/commands/X'`
  is supported, unstable until v2.0 per ADR-0013.

## Alternatives considered

- **yargs** — great, but overkill for six subcommands; heavier install.
- **citty** — modern, but smaller ecosystem and less battle-tested.
- **@oclif** — full framework, the right answer if we ever grow plugins;
  overkill now.
- **Hand-rolled** — we had that. Cost > benefit at this scale.

## More Information

- Commander: <https://github.com/tj/commander.js>
- Pa11y exit-code convention:
  <https://github.com/pa11y/pa11y/blob/HEAD/API.md#exit-codes>
