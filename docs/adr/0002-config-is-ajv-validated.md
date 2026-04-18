# 0002. Configuration is validated by Ajv against a JSON Schema

- Status: accepted
- Date: 2026-04-18
- Deciders: Jamie Sargent

## Context and Problem Statement

The v0.3 toolkit validated configs with a hand-written imperative function that
only checked top-level keys and a few types. Users could provide a malformed
regex in `crawl.excludeUrlPatterns` and the error would only surface mid-crawl
as an opaque `SyntaxError: Invalid regular expression`. Silent validation gaps
are also why Layer 2's bug sweep exists.

A best-in-class tool should fail at config-load time, with a message that
points to the offending field, the JSON pointer, the received value, and a
hint about what's expected.

## Decision

Use **Ajv 2020** (`ajv/dist/2020.js`) with **`ajv-formats`** and
**`better-ajv-errors`** against `schemas/config.schema.json`. Register a custom
`validRegex` keyword that compiles user-supplied regex strings at validation
time so they fail at config-load rather than mid-crawl.

- Schema is the **source of truth** for config shape. Types in
  `src/types/config.d.ts` are generated from it (Layer 1 ships the wiring;
  later layers add the pre-commit hook).
- Errors are formatted with `better-ajv-errors` (`format: 'cli'`) so the user
  sees a colourised pointer, received value, and suggested alternative.
- A convenience `assertValidConfig(config, path)` throws a
  `ConfigValidationError` (error name) that the Commander entry catches and
  prints without a stack trace.

## Consequences

- Every new field added to a config must also land in the schema; reviewers
  cite ADR-0001 to enforce this.
- Users moving from v0.3 whose configs passed the loose imperative validator
  may see new errors (for example the `\?replytocom=` JSON-escape issue the
  v0.3 example configs had). These are real bugs; the migration is expected.
- Schema keywords we don't yet use (anchors, dependencies, etc.) are
  documented in `docs/` so we have a consistent style.

## Alternatives considered

- **Zod.** Loses the JSON-Schema source-of-truth and the ability to generate
  `.d.ts` for downstream consumers without a custom converter. Rejected.
- **Valibot.** Smaller than Zod but same source-of-truth problem.
- **Hand-rolled validators.** What v0.3 had. Cannot catch unknown keys, cannot
  check `oneOf`/`anyOf`, cannot refer to shared definitions (`$defs`) — all of
  which we use extensively for the per-URL axe `overrides` array.

## More Information

- Ajv: <https://ajv.js.org/>
- ACT-compatible rule IDs end up in a separate enrichment map in Layer 3b;
  this ADR is only about structural validation.
