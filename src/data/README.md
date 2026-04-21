# `src/data/`

Static data files consumed at runtime by the toolkit. Each file is pinned
to a specific axe-core version so drift is detectable; regenerate via the
accompanying script when axe-core is upgraded.

## `act-rule-map.json`

Maps axe-core rule IDs to W3C ACT Rules Community Group rule IDs.

- **Shape:** `{ axeRuleId: string[] of ACT rule IDs }`, plus a top-level
  `_meta` object recording the axe-core version used to generate the seed
  and a `coverage` field (`"partial"` / `"full"`).
- **Pinned axe-core version:** `4.11.2` (as of Layer 3b's R1 seed,
  2026-04-19).
- **Source:** the ACT Rules CG implementation report at
  <https://act-rules.github.io/implementation/axe-core/>.
- **Coverage:** `partial`. The seed covers the 30 ACT rules the
  implementation report listed as implemented by axe-core at seed time.
  Expanding to full coverage is tracked as a Layer 3b follow-up in
  `CHANGELOG.md [Unreleased]`.

### Why this file exists

ACT rule IDs are **not** exposed by axe-core at runtime. WCAG SC numbers
are — they live in `violation.tags` as `wcagXXX` (e.g. `wcag111` → SC
1.1.1) and are parsed at runtime by `src/lib/axe-utils.mjs`'s
`withActAndWcagMetadata` helper. ACT IDs have no such runtime source, so
the mapping is curated statically.

### Regenerating

```sh
node scripts/refresh-rule-maps.mjs
```

The script reads the installed `@axe-core/playwright`'s axe-core version,
re-fetches the implementation report, and rewrites this file with a
fresh `_meta.generatedAt` timestamp. Run it whenever the installed
axe-core version in `package-lock.json` changes meaningfully.

### What happens if the map is missing or empty

`src/commands/summarize.mjs` loads this file via `readJsonMaybe` with a
`{}` fallback. An empty or missing map causes every grouped finding to
carry `actRuleIds: []`; the scan does not fail. A one-shot `logger.debug`
announces the degradation so a maintainer reading pipeline logs sees the
cause.
