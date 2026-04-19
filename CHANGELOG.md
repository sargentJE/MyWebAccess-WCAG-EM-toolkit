# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Layer 3 follow-ups

- `processes[].actions[].urlPattern` compile-at-load — deferred pending a
  runtime consumer. The schema field is validated by the `validRegex` Ajv
  keyword today, but no code reads it, so attaching a compiled `RegExp[]`
  would be YAGNI. Wire `defineHidden` compile-at-load alongside the first
  consumer (likely Layer 3b's `beforeScan` action filtering or a future
  process-action URL predicate). `scan.axe.overrides[].urlPattern` was
  cleared in Layer 3a — compile-at-load now lives in `context.mjs` at
  ANCHOR: CompileOverrides, mirroring `crawl.excludeUrlPatternsCompiled`.
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
