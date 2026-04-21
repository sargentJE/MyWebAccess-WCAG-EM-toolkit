# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Layer 3 follow-ups

- `$defs/action.urlPattern` compile-at-load — **DONE in Layer 3b R7**.
  Wired at all three consumer sites (`scan.beforeScan.actions[]`,
  `scan.axe.overrides[].actions[]`, `processes[].steps[]`) via
  `context.mjs` → `compileActionUrlPatterns`. Every validRegex field in
  the schema is now compile-at-load.
- Replace `test/unit/discover-timeout.test.mjs` (currently a source-text
  regression) with a behavioural test against the Layer 4 e2e fixture
  server so the `page.setDefaultTimeout` line in `discover.mjs` is
  verified by execution, not by grep.

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
