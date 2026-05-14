# 0008. Pluggable reporter runtime (internal at v1.0)

- Status: accepted
- Date: 2026-04-30
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions; symbol-first citation rule),
  ADR-0007 (WCAG-EM Step 5 summary shape — `criteriaOutcomes` powers
  the EARL reporter and the HTML findings-by-SC section), ADR-0012
  (extensibility is internal for v1.0 — applied here to the reporter
  registry surface)

## Context and Problem Statement

Since the config validation overhaul, `schemas/config.schema.json` (`reporting.reporters`,
`reporting.includePasses`, `reporting.screenshotFormat`,
`reporting.screenshotQuality`) has promised a five-format reporter
selection (`json | markdown | html | earl-jsonld | junit`) but the
runtime in `src/commands/summarize.mjs` hard-coded inline emission of
`summary.json` + `summary.md` and emitted a one-shot
`warnSchemaAcceptedRuntimeIgnored` for `reporters`. The `// ANCHOR:
MarkdownReport — replaced by pluggable reporter` marker at
`summarize.mjs` was the seam; the reporter pipeline closes it.

Several open design questions had to be settled in one place rather
than rediscovered each time a future reporter is added:

1. Where does the registry live and what does it expose? Public plugin
   API or internal dispatcher?
2. Which artefacts are "reporter outputs" vs "always-on side artefacts"?
3. What sort contract guarantees byte-stable cross-reporter output?
4. What happens when one reporter throws mid-run?
5. What does `includePasses` mean across axe's `passed` /
   `incomplete` / `inapplicable` triad?
6. How does the HTML reporter defend against XSS without taking on a
   runtime dependency?

## Decision

**Ship five built-in reporters behind a module-private registry. No
public plugin API at v1.0.** The contract is small enough to be
useful internally, restrictive enough to satisfy ADR-0012's
"extensibility is internal" stance, and detailed enough to make
future reporters land without rediscovery.

### 1. Registry shape — module-private + narrow `package.json` exports

`src/reporters/index.mjs` defines `const registry = new Map([...])`
that is **not exported**. Only `runReporters(names, summary, ctx) →
{ results, errors }` and `listReporters()` are exported. Third-party
code cannot register a custom reporter at runtime because the Map is
unreachable.

`package.json:exports` drops the `./reporters/*` entry that was
scaffolded earlier. The remaining `./commands/*` and `./lib/*`
exports stay (they pre-date the reporter pipeline and the cost of removing them
is bigger than the surface they leak). Future ADRs may revisit those
under the same ADR-0012 lens.

### 2. Reporter module interface

Each reporter exports two symbols:

```js
// @ts-check
export const name = 'html'; // matches the registry key + the schema enum
/**
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string, resultsDir?: string }, config?: any }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  /* ... */
}
```

The `summary` argument is the same object `summarize.mjs` writes as
`summary.json` (tool-identity-stamped, with `findings`, `comparison`,
`wcagEmSummary`, etc). The `ctx` argument carries `paths` (always)
and `config` (when the reporter needs `reporting.includePasses` or
similar). `emit` returns the absolute file path it wrote and the
on-disk byte count — for the dispatch caller's logging.

### 3. Reporter outputs vs side-artefacts (the split)

| File                                   | Owner                  | Reasoning              |
| -------------------------------------- | ---------------------- | ---------------------- |
| `summary.json`                         | `json` reporter        | Swappable summary view |
| `summary.md`                           | `markdown` reporter    | Swappable summary view |
| `summary.html`                         | `html` reporter        | Swappable summary view |
| `earl.jsonld`                          | `earl-jsonld` reporter | Swappable summary view |
| `junit.xml`                            | `junit` reporter       | Swappable summary view |
| `grouped-by-rule.json`                 | `summarize.mjs` inline | Analytical artefact    |
| `grouped-by-component.json`            | `summarize.mjs` inline | Analytical artefact    |
| `random-vs-structured-comparison.json` | `summarize.mjs` inline | Analytical artefact    |
| `wcag-em-summary.json`                 | `summarize.mjs` inline | ADR-0007 output        |
| `manual-backlog.md`                    | `summarize.mjs` inline | Always-on backlog      |

Test: a user setting `reporting.reporters: []` gets only the side-
artefacts on disk. A user setting `reporting.reporters: ['html']`
gets `summary.html` + all five side-artefacts. The split is
covered by `test/e2e/reporters-smoke.test.mjs` (un-skipped after the
Crawlee localhost-fixture hang resolution — see
`docs/adr/0013-crawlee-localhost-investigation.md`; resolved by D2 /
commit `468f5c1`).

### 4. Deterministic-sort contract

`src/reporters/_sort.mjs` exports `sortFindings(findings)` with the
**2-key contract** `[impact desc, ruleId asc]`. The impact ordering
is `IMPACT_ORDER`:

| impact     | priority       |
| ---------- | -------------- |
| `critical` | 4              |
| `serious`  | 3              |
| `moderate` | 2              |
| `minor`    | 1              |
| `null`     | 0 (sorts last) |

Inner arrays (`urls`, `targets`, `pageTypes`, `clusters`) are sorted
upstream in `summarize.mjs` (the existing post-grouping
post-processing). Findings are rule-grouped, so viewport info is
aggregated into the `urls` array — viewport is NOT part of the
finding-level sort key.

Every reporter (JSON, markdown, HTML, EARL, JUnit) routes findings
through `sortFindings` before emission. Cross-reporter consistency
beats byte-perfect history compat: this is a small byte-shift from
HEAD `abd7339` markdown for findings sharing an impact, but
auditors diffing JSON vs markdown vs HTML to cross-check the same
audit run see one canonical order.

### 5. Error isolation policy

`runReporters` is **fail-resilient**. Each reporter runs in its own
try/catch:

```js
try {
  const out = await reporter.emit(summary, ctx);
  results.push({ name: n, path: out.path, bytes: out.bytes });
} catch (err) {
  errors.push({ name: n, error: ... });
}
```

A reporter throwing (disk full, permission error, malformed input
the reporter happens to crash on) does NOT abort the others. The
caller in `summarize.mjs` logs each error at `error` level and
composes the exit code:

```js
const exitCode = Math.max(
  computeExitCode(summary, failOnFindings), // 0 or 2
  reporterOutcome.errors.length > 0 ? 1 : 0,
);
```

The threshold-hit signal (2) wins over a reporter-error signal (1)
when both are present — auditors care about findings even if one
reporter format failed. **Unknown reporter names are a CONFIG error
and throw immediately**, before any reporter runs (a typo in
`reporters: ['htlm']` is worse than no output).

### 6. `includePasses` semantics — locked

`reporting.includePasses: true` means: reporters emit axe
**`passes`** bucket entries only (rule executed, no violation).
`incomplete` results surface as `earl:cantTell` /
`<failure type="incomplete">` **regardless** of the flag — auditors
always need to see incompletes. `inapplicable` results are **never**
emitted by any reporter (volume drowns the report; an EARL document
with 200 inapplicable Assertions per page × N pages is unusable).

The markdown reporter is `includePasses`-agnostic — it renders
findings only, matching v0.3 behaviour.

### 7. Zero-dep XSS-safe HTML template

`src/reporters/_template.mjs` exports four helpers:

| helper        | context                  | escape set                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text(s)`     | element text             | `&` `<` `>` `"` `'`                                                                                                                                                                                                                                                                                                                                                                                         |
| `attr(s)`     | attribute value          | text set + backtick + ASCII control chars 0x00-0x08, 0x0b-0x0c, 0x0e-0x1f, 0x7f, plus Unicode C1 controls 0x80-0x9f (HTML 5 forbids the C1 range in attribute context). Both `text(s)` and `attr(s)` additionally STRIP Unicode bidi-override / isolate formatting characters (U+202A-U+202E, U+2066-U+2069) before the escape pass — defends against Trojan Source-style visual spoofing (CVE-2021-42574). |
| `safeUrl(s)`  | `<a href>` / `<img src>` | http / https / relative pass through; everything else (`javascript:`, `data:`, `file:`, `vbscript:`) is quarantined to `'#'`                                                                                                                                                                                                                                                                                |
| `html\`...\`` | tagged template          | applies `attr()` (strict superset of text-context) to every interpolation                                                                                                                                                                                                                                                                                                                                   |

**No `raw()` export**; minimal attack surface. Authors can't slip
unescaped strings through accidentally — the API forces secure-by-
default usage. The HTML reporter's `<style>` block is a module-
level literal with **zero interpolation**; a unit test extracts the
block and asserts no `${` placeholders survived (catches a future
edit that introduces dynamic CSS without adding a `css()` helper).

The control-char regex is built programmatically via
`buildAttrPattern()` using `\u00XX` escapes — keeps source
files readable in editors / diffs (no literal control bytes).

### 8. JUnit emission — Pa11y convention

Single `<testsuite>` root. One `<testcase>` per (rule × URL ×
firstSelector) tuple. `<failure type="impact|incomplete">` wraps
help + helpUrl + selector + truncated outerHTML inside CDATA.
**`incomplete` → `<failure type="incomplete">`** (NOT `<skipped>`)
so CI fails on cantTell results — auditors must investigate, not
silently pass.

`]]>` defusal uses the canonical replacement `]]]]><![CDATA[>`
(close-and-reopen). Truncation is character-based via
`Array.from(s).slice(...).join('')` so UTF-8 multi-byte sequences
(4-byte emoji) are never split — byte-based slicing would produce
invalid UTF-8 inside CDATA and break strict XML parsers.

XML 1.0-illegal control characters are **stripped** from attribute
context (no escape sequence makes them legal); the danger-class
listed above for HTML escaping is overlapping but not identical.

## Consequences

### Positive

- Schema-runtime gap closed: `reporting.reporters` finally honoured.
- Zero new runtime dependencies. Total surface added: ~1500 LOC of
  reporter modules + ~600 LOC of unit tests, all hand-rolled.
- Three CHANGELOG carry-forwards triaged during the reporter pipeline: 1 closed
  (authenticated-scan), 2 deferred behind a documented Crawlee
  localhost-fixture hang — both since resolved by D2 / commit `468f5c1`
  and un-skipped (see `docs/adr/0013-crawlee-localhost-investigation.md`).
- Future reporters land by adding one file under `src/reporters/`,
  one entry in the registry import block, and one test file. The
  shape is small enough to memorise.

### Negative / accepted trade-offs

- The registry is sealed at v1.0. A user who needs a CSV / SARIF /
  custom format must (a) raise an issue, or (b) fork. The v2.0
  story revisits this under ADR-0012's deferral.
- `markdownReport: true` from v0.3 configs is now a deprecation
  warning, not an error. Documented in the relevant commit body.
- Adding `<a href>` anchor tags requires three calls (`safeUrl` to
  validate scheme, `attr()` via the `html\`\`` tag to escape the
  result). The verbosity is intentional — the tagged-template hides
  the second call but the first is explicit so authors notice when
  they're handling URLs vs free text.

## Symbol references (per ADR-0001)

- `runReporters` / `listReporters` — `src/reporters/index.mjs`.
- `sortFindings` / `IMPACT_ORDER` — `src/reporters/_sort.mjs`.
- `text` / `attr` / `safeUrl` / `html` — `src/reporters/_template.mjs`.
- `name` / `emit` — module-scope exports of every reporter
  (`src/reporters/{json,markdown,html,earl-jsonld,junit}.mjs`).
- `computeExitCode` — `src/commands/summarize.mjs` (composed with
  the reporter-error signal in the same file's `run()`).
- `warnLegacyAliasResolved` — `src/lib/auth.mjs` (colocated with
  `warnSchemaAcceptedRuntimeIgnored`).
- `buildScreenshotPath` — `src/commands/scan.mjs` (extended with
  `format` parameter; the HTML reporter's screenshot embedding uses
  `path.relative(reportsDir, screenshotPath)` to stay browser-
  resolvable).
