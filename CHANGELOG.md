# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Layer 3 follow-ups

- Extend compile-at-load to `scan.axe.overrides[].urlPattern` and
  `processes[].actions[].urlPattern`. Both schema fields are already
  validated by the `validRegex` Ajv keyword (fail-fast on bad patterns at
  load); what's missing is the runtime `RegExp[]` attachment via
  `defineHidden` so hot paths never re-compile. Tracked in ADR-0005
  mechanism 2's scope note. Source hook: `TODO(Layer 3):` anchor above the
  `validRegex` keyword declaration in `src/lib/validate-config.mjs`.
- Replace `test/unit/discover-timeout.test.mjs` (currently a source-text
  regression) with a behavioural test against the Layer 3 e2e fixture
  server so the `page.setDefaultTimeout` line in `discover.mjs` is
  verified by execution, not by grep.

### Layer 4 follow-ups

- Implement the `reporting.reporters` enum values (`json`, `markdown`,
  `html`, `earl-jsonld`, `junit`). The schema already promises pluggable
  reporters but the Layer 2 runtime hard-codes two output formats, so a
  user writing `reporters: ["earl-jsonld"]` today silently gets no
  effect. ADR-0008 (forthcoming) will record the pluggable-reporter
  decision.
