# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Layer 3 follow-ups

- Replace `test/unit/discover-timeout.test.mjs` (currently a source-text
  regression) with a behavioural test against the Layer 4 e2e fixture
  server so the `page.setDefaultTimeout` line in `discover.mjs` is
  verified by execution, not by grep.

### Layer 3b follow-ups

- `auth.setupScript` runtime execution — deferred pending an explicit
  security review. Schema validates the field and the runtime emits a
  one-shot `warnSchemaAcceptedRuntimeIgnored` via the shared helper in
  `src/lib/auth.mjs`. Target: a later layer that scopes the trust model
  for executing user-supplied scripts in a Playwright context.
- `src/data/act-rule-map.json` exhaustive coverage — the R1 seed covers
  the 30 ACT rules most commonly implemented by axe-core 4.11.2; full
  coverage (70+ rules) requires either the ACT CG to publish a JSON
  feed or a DOM-parser dev dep on their HTML implementation report.
  `scripts/refresh-rule-maps.mjs` is scaffolded for the regeneration
  path.
- Integration-level authenticated-scan test — lands alongside Layer 4's
  fixture harness. R3–R5's applyAuth wiring is unit-covered today;
  end-to-end "restore a real session and scan" coverage waits for the
  test infrastructure.
- `tool-identity` propagation into Pino log records — currently the
  stamp appears on emitted artefacts (R13) only. Future enhancement:
  inject `tool: TOOL_IDENTITY` into every log-line's base bindings so
  downstream log aggregators can filter by tool version without
  re-parsing the artefact.

### Layer 4 follow-ups

- Implement the `reporting.reporters` enum values (`json`, `markdown`,
  `html`, `earl-jsonld`, `junit`). The schema already promises pluggable
  reporters but the Layer 2 runtime hard-codes two output formats, so
  a user writing `reporters: ["earl-jsonld"]` today still gets the
  hard-coded JSON + Markdown set. As of Layer 3a the runtime emits a
  one-shot `logger.warn` when the field is configured (matches the
  same discipline as `scan.axe.overrides[].actions` — schema accepts,
  runtime warns, full implementation lands in the next layer).
  ADR-0008 (forthcoming) will record the pluggable-reporter decision.
