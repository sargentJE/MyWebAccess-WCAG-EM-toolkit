# 0004. Pino structured logging with Prettier TTY mode

- Status: accepted
- Date: 2026-04-18
- Deciders: Jamie Sargent

## Context and Problem Statement

The v0.3 toolkit used `console.log` / `console.error` for everything. No
levels, no structured fields, no redaction of sensitive headers, no way for a
CI system to parse progress events without regex-scraping stdout.

A best-in-class audit tool writes findings to stdout (for piping into other
tools) and operational events to stderr — Unix convention — with structured
JSON when piped and a human-friendly pretty-print when run interactively.

## Decision

**Pino 9** via `src/lib/logger.mjs`. `pino-pretty` when stderr is a TTY; raw
NDJSON when piped. One shared factory (`createLogger`) used by every command
through `RunContext.logger`. A lazy singleton `getLogger` is also exposed for
deep helpers that shouldn't take a logger by parameter.

A redact list is applied to every logger instance, matching ADR-0001:

```
Authorization, Cookie, Set-Cookie, *.password, *.token, *.secret, *.key,
*.apiKey, *.api_key, *.accessToken, *.access_token,
auth.storageState, auth.httpCredentials
```

Case-insensitive JSON-path globs. The `remove: true` option means redacted
fields disappear from the log record entirely rather than being replaced with
`"[REDACTED]"`.

### Stream discipline

- **stdout**: findings summaries (the `summarize` command may write report
  paths to stdout for piping).
- **stderr**: every pino event — progress, warnings, errors. 12-factor.

## Consequences

- CI systems parse stderr JSON for per-stage timings and per-URL errors.
- Users who `wcag-em audit > audit.log` get findings on stdout; progress on
  terminal.
- Redact list must grow whenever a new auth-shaped field is added to the
  config schema; the CI coverage floor encourages regressions to be caught.

## Alternatives considered

- **winston** — more configurable but heavier; no advantage here.
- **bunyan** — stagnant.
- **native `console`** — cannot redact, cannot emit structured JSON, cannot
  suppress by level without global monkey-patching.

## More Information

- Pino: <https://getpino.io/>
- 12-factor logs principle: <https://12factor.net/logs>
