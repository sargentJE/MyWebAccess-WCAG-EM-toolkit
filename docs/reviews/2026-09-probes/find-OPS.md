# Probe record: find:OPS

Role: round-2 finder. Findings: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08, OPS-09, OPS-10, OPS-11, OPS-12, OPS-13, OPS-14

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
S=$SCRATCH; mkdir -p $S/wf2/ops; wc -l $S/review/round1-index.txt; cut -c1-220 $S/review/round1-index.txt
````

Output (truncated):

````text
<persisted-output>
Output too large (38.9KB). Full output saved to: $CLAUDE_STATE

Preview (first 2KB):
     184 $SCRATCH/review/round1-index.txt
VERD-01 | high | new | correctness | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per SC. This gives false passes and false 'not present' v
VERD-02 | medium | new | docs-drift | Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off automated passed/inapplicable verdicts | docs/guides/user-manual.md:71, d
VERD-03 | high | new | correctness | wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria) | src/lib/wcag-em-summary.mjs:371, src/lib/wca ...
````

## 2. Bash

````bash
S=$SCRATCH; awk -F' \\| ' '{print $1" | "$2" | "$4" | "substr($5,1,130)" | "substr($6,1,70)}' $S/review/round1-index.txt
````

Output (truncated):

````text
<persisted-output>
Output too large (39.3KB). Full output saved to: $CLAUDE_STATE

Preview (first 2KB):
VERD-01 | high | correctness | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per  | src/lib/wcag-em-summary.mjs:269, src/lib/wcag-em-summary.mjs:297, src/
VERD-02 | medium | docs-drift | Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off automated passed/inap | docs/guides/user-manual.md:71, docs/guides/user-manual.md:73, docs/gui
VERD-03 | high | correctness | wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria) | src/lib/wcag-em-summary.mjs:371, src/lib/wcag-em-summary.mjs:44 ...
````

## 3. Bash

````bash
F=$CLAUDE_STATE awk -F' \\| ' '{print $1"|"$2"|"substr($4,1,110)"|"substr($5,1,60)}' $F | sed -n '1,100p'
````

Output (truncated):

````text
VERD-01|high|SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what ax|src/lib/wcag-em-summary.mjs:269, src/lib/wcag-em-summary.mjs
VERD-02|medium|Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off a|docs/guides/user-manual.md:71, docs/guides/user-manual.md:73
VERD-03|high|wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets|src/lib/wcag-em-summary.mjs:371, src/lib/wcag-em-summary.mjs
VERD-04|medium|4.1.1 Parsing (obsolete and removed in WCAG 2.2) is emitted as notTested in every default 2.2 run, and the cli|src/lib/wcag-em-summary.mjs:143, src/data/wcag-sc-names.json
VERD-05|medium|SCs above the conformance target that a r ...
````

## 4. Bash

````bash
F=$CLAUDE_STATE awk -F' \\| ' '{print $1"|"$2"|"substr($4,1,110)"|"substr($5,1,60)}' $F | sed -n '101,200p'
````

Output (truncated):

````text
SEC-21|low|reachedSitemapCap reports true when URLs are merely duplicated across sitemaps|src/lib/sitemap.mjs:177, src/lib/sitemap.mjs:183
SEC-22|info|No masking or redaction for screenshots and DOM snippets in authenticated scans|src/commands/scan.mjs:315
SCAN-01|high|Landed-page validation only knows challenge/empty: HTTP error pages, non-Cloudflare/CF-block WAF pages, non-HT|src/commands/scan.mjs:157, src/commands/scan.mjs:228, src/co
SCAN-02|high|No per-page-view watchdog: scan.timeoutMs bounds only page.goto, so a busy page hangs the whole run indefinite|src/commands/scan.mjs:219, src/commands/scan.mjs:155, src/co
SCAN-03|high|Scan results are only written at the end and the browser is only closed on success: a browser crash loses ever|src/commands/scan.mjs:420, src/commands/scan.mjs: ...
````

## 5. Bash

````bash
cd $REPO; ls; ls bin src src/lib src/types scripts configs docs docs/guides docs/adr; wc -l bin/wcag-em.mjs src/index.mjs src/lib/{config,validate-config,args,context,version,engine-check,preflight,logger}.mjs schemas/config.schema.json src/types/* scripts/* package.json README.md docs/guides/* CHANGELOG.md TODO.md CONTRIBUTING.md
````

Output (truncated):

````text
CHANGELOG.md
CONTRIBUTING.md
LICENSE
README.md
TODO.md
bin
configs
docs
eslint.config.mjs
jsconfig.json
logs
node_modules
output
package-lock.json
package.json
schemas
scripts
spikes
src
test
bin:
wcag-em.mjs

configs:
example-site-best-practice.json
example-site-with-auth.json
example-site-with-cdp.json
example-site-with-processes.json
example-site.json
legacy-events.json

docs:
adr
design-notes
guides
plans
reviews

docs/adr:
0000-record-architecture-decisions.md
0001-project-conventions.md
0002-config-is-ajv-validated.md
0003-commander-cli.md
0004-pino-structured-logging.md
0005-fail-fast-on-config.md
0006-multi-viewport-axe-runs.md
0007-wcag-em-summary-shape.md
0008-pluggable-reporters.md
0009-earl-jsonld-output.md
0010-project-layout.md
0011-v1-release-boundary.md
0012-extensibility-i ...
````

## 6. Bash

````bash
cd $REPO; cat -n bin/wcag-em.mjs; cat -n package.json
````

Output (truncated):

````text
     1	#!/usr/bin/env node
     2	// @ts-check
     3	/**
     4	 * @file wcag-em CLI entry — Commander-based.
     5	 * @module bin/wcag-em
     6	 *
     7	 * @description
     8	 * Single binary with six subcommands matching the WCAG-EM-aligned pipeline:
     9	 *   discover | sample | scan | scan-processes | summarize | audit
    10	 *
    11	 * Exit-code policy (ADR-0001):
    12	 *   0  clean — no findings above threshold
    13	 *   1  runtime error (bad config, preflight failure, crash)
    14	 *   2  findings exceeded `reporting.failOnFindings` threshold
    15	 *
    16	 * Engine guard: refuses to run on Node <22.11.0 with an actionable message
    17	 * rather than a cryptic runtime error from (e.g.) `Object.groupBy`.
    18	 *
    19	 * @see docs/adr/0003-commander-cli.md
    2 ...
````

## 7. Bash

````bash
cd $REPO; grep -n "import.meta\|process.argv\|isMain\|^export async function run\|process.exit" src/commands/*.mjs | head -40; cat -n src/index.mjs
````

Output (truncated):

````text
src/commands/sample.mjs:37:export async function run(ctx) {
src/commands/sample.mjs:162:if (import.meta.url === `file://${process.argv[1]}`) {
src/commands/scan.mjs:173:export async function run(ctx) {
src/commands/scan.mjs:468:if (import.meta.url === `file://${process.argv[1]}`) {
src/commands/discover.mjs:168:export async function run(ctx) {
src/commands/discover.mjs:409:if (import.meta.url === `file://${process.argv[1]}`) {
src/commands/scan-processes.mjs:107:export async function runOneProcess(session, processDef, ctx, viewport, contextOptions = {}) {
src/commands/scan-processes.mjs:177:export async function run(ctx) {
src/commands/scan-processes.mjs:214:if (import.meta.url === `file://${process.argv[1]}`) {
src/commands/summarize.mjs:36: * Compute the process exit code for a summary g ...
````

## 8. Bash

````bash
cd $REPO; sed -n 405,430p src/commands/discover.mjs; sed -n 705,730p src/commands/summarize.mjs; sed -n 465,490p src/commands/scan.mjs; cat -n src/lib/args.mjs
````

Output (truncated):

````text
  return { inventoryCount: inventory.length };
}

// SECTION: Standalone runner — backward compat for `node src/commands/discover.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  // discover launches Playwright via Crawlee — require the browser preflight.
  const ctx = await buildContext({ requirePlaywright: true });
  await run(ctx);
}
    'summarize done',
  );

  return { exitCode, summary };
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext({ requirePlaywright: false });
  await run(ctx);
}
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext({ requirePlaywright: true, browserTransportAware: true });
  await run(ctx);
}
     1	// @ts-ch ...
````

## 9. Bash

````bash
cd $REPO; cat -n src/lib/context.mjs
````

Output (truncated):

````text
     1	// @ts-check
     2	/**
     3	 * @file RunContext builder — the object threaded through every command.
     4	 * @module lib/context
     5	 *
     6	 * @description
     7	 * Every command receives a `RunContext` (via `run(ctx)`) so it doesn't need to
     8	 * reimplement config loading, path resolution, logger creation, or preflight.
     9	 * One place to change if any of those evolve.
    10	 *
    11	 * The shape is:
    12	 *   { config, configPath, logger, outDir, paths, args }
    13	 * where `paths` pre-resolves every output subdirectory so commands call
    14	 * `ensureDir(ctx.paths.inventoryDir)` without hardcoding strings.
    15	 *
    16	 * @see docs/adr/0001-project-conventions.md
    17	 * @see docs/adr/0003-commander-cli.md
    18	 */
    19	
    20	// SECTION: I ...
````

## 10. Bash

````bash
cd $REPO; cat -n src/lib/config.mjs
````

Output (truncated):

````text
     1	// @ts-check
     2	/**
     3	 * @file Configuration loader and DEFAULTS merge base.
     4	 * @module lib/config
     5	 *
     6	 * @description
     7	 * Reads the config JSON from disk and deep-merges it against `DEFAULTS`.
     8	 * Validation lives in `lib/validate-config.mjs` (Ajv 2020 +
     9	 * better-ajv-errors against `schemas/config.schema.json`) and runs in
    10	 * `context.mjs` during `buildContext()`. This module has no opinion on
    11	 * validity beyond what JSON.parse enforces.
    12	 *
    13	 * The compile-at-load step that attaches `crawl.excludeUrlPatternsCompiled`
    14	 * also lives in `context.mjs` because it must run AFTER Ajv has confirmed
    15	 * each pattern compiles.
    16	 *
    17	 * @see docs/adr/0001-project-conventions.md
    18	 * @see d ...
````

## 11. Bash

````bash
cd $REPO; cat -n src/lib/validate-config.mjs | sed -n 1,156p
````

Output (truncated):

````text
     1	// @ts-check
     2	/**
     3	 * @file Ajv-based config validation with fail-fast regex compilation.
     4	 * @module lib/validate-config
     5	 *
     6	 * @description
     7	 * Validates a user-supplied config against `schemas/config.schema.json` using
     8	 * Ajv 2020 with the standard formats plug-in, plus a custom `validRegex`
     9	 * keyword that actually compiles each regex string at validation time so bad
    10	 * patterns fail at config-load rather than mid-crawl (ADR-0005).
    11	 *
    12	 * Returns a `{ valid, errors, formatted }` shape. Callers format errors via
    13	 * `better-ajv-errors` for human-readable output including the JSON pointer,
    14	 * received value, and suggested alternatives.
    15	 *
    16	 * @see docs/adr/0002-config-is-ajv-validated. ...
````

## 12. Bash

````bash
cd $REPO; grep -n '"additionalProperties"' schemas/config.schema.json | head -60; grep -c '"additionalProperties": false' schemas/config.schema.json; grep -n '"type": "object"' schemas/config.schema.json | wc -l
````

Output (truncated):

````text
8:  "additionalProperties": false,
25:      "additionalProperties": false,
49:      "additionalProperties": false,
96:          "additionalProperties": false,
134:      "additionalProperties": false,
155:      "additionalProperties": false,
168:          "additionalProperties": false,
217:      "additionalProperties": false,
238:            "additionalProperties": false,
275:          "additionalProperties": false,
288:          "additionalProperties": false,
308:          "additionalProperties": false,
331:          "additionalProperties": false,
366:                  "additionalProperties": false,
389:                "additionalProperties": false,
459:        "additionalProperties": false,
498:            "additionalProperties": {
527:      "additionalProperties": false,
564:          "a ...
````

## 13. Bash

````bash
cd $REPO; cat -n scripts/gen-types.mjs; head -20 src/types/config.d.ts; git log --oneline -3 -- src/types/config.d.ts; git log --oneline -3 -- schemas/config.schema.json
````

Output (truncated):

````text
     1	// @ts-check
     2	/**
     3	 * @file Regenerate `src/types/config.d.ts` from `schemas/config.schema.json`.
     4	 * @module scripts/gen-types
     5	 *
     6	 * @description
     7	 * Runs on every commit via `.husky/pre-commit` so the generated TypeScript
     8	 * declaration always matches the JSON schema. The committed file is the
     9	 * source of truth for programmatic API consumers importing
    10	 * `'wcag-em-a11y-toolkit'` with full type information.
    11	 *
    12	 * Safe to run by hand:  `npm run gen:types`
    13	 *
    14	 * @see docs/adr/0001-project-conventions.md
    15	 * @see docs/adr/0005-fail-fast-on-config.md
    16	 */
    17	
    18	// SECTION: Imports
    19	import fs from 'node:fs/promises';
    20	import path from 'node:path';
    21	import { file ...
````

## 14. Bash

````bash
cd $SCRATCH/wf2/ops && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && R=$REPO && cat > gen.mjs <<EOF
import { compileFromFile } from '$R/node_modules/json-schema-to-typescript/dist/src/index.js';
import fs from 'node:fs/promises';
const ts = await compileFromFile('$R/schemas/config.schema.json', { bannerComment: '/* eslint-disable */\n/* Auto-generated by scripts/gen-types.mjs — do not edit by hand.\n * Regenerate via \`npm run gen:types\` (also runs on every commit). */' });
await fs.writeFile('config.d.ts', ts);
EOF
node gen.mjs && diff $R/src/types/config.d.ts config.d.ts && echo NO-DIFF; ls $R/node_modules/json-schema-to-typescript/dist/src/index.js; cat $R/.husky/pre-commit 2>/dev/null
````

Output (truncated):

````text
NO-DIFF
$REPO/node_modules/json-schema-to-typescript/dist/src/index.js
#!/usr/bin/env sh
# Regenerate src/types/config.d.ts from the JSON schema + re-stage.
# See docs/adr/0005-fail-fast-on-config.md for why this hook exists.
node scripts/gen-types.mjs && git add src/types/config.d.ts
````

## 15. Bash

````bash
cd $REPO; cat -n .github/workflows/ci.yml; cat -n src/types/index.d.ts
````

Output (truncated):

````text
     1	# ============================================================================
     2	# CI — runs on every push and pull request to main.
     3	#
     4	# Enforces the gate from ADR-0001: `npm run lint && npm run typecheck &&
     5	# npm test` must be green on every commit. Also includes a non-blocking
     6	# `npm audit --production` step. Coverage floors (70% src/lib, 50%
     7	# src/commands) are an ADR-0001 target checked via `npm run test:coverage`;
     8	# automated CI enforcement is an open board item.
     9	#
    10	# Node version follows .nvmrc (currently 22); CI uses the exact same minor.
    11	# ============================================================================
    12	
    13	name: ci
    14	
    15	on:
    16	  push:
    17	    branches: [main]
    18	   ...
````

## 16. Bash

````bash
cd $REPO; grep -n "^export" src/types/config.d.ts; cat jsconfig.json; cat .nvmrc
````

Output (truncated):

````text
8:export interface WCAGEMAccessibilityToolkitConfig {
266:export interface Action {
{
  "compilerOptions": {
    "checkJs": false,
    "allowJs": true,
    "noEmit": true,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "useUnknownInCatchVariables": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2023",
    "lib": ["ES2024", "DOM"],
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["bin/**/*.mjs", "src/**/*.mjs", "test/**/*.mjs", "src/**/*.d.ts"],
  "exclude": ["node_modules", "output", "logs", "coverage", ".au ...
````

## 17. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && npm pack --dry-run --json --ignore-scripts 2>/dev/null > $SCRATCH/wf2/ops/pack.json; node -e "const p=require('$SCRATCH/wf2/ops/pack.json')[0]; console.log(p.entryCount, p.size, p.unpackedSize); for (const f of p.files) console.log(f.path)"; git status --short
````

Output (truncated):

````text
62 144015 490437
CHANGELOG.md
LICENSE
README.md
bin/wcag-em.mjs
configs/example-site-best-practice.json
configs/example-site-with-auth.json
configs/example-site-with-cdp.json
configs/example-site-with-processes.json
configs/example-site.json
configs/legacy-events.json
package.json
schemas/config.schema.json
schemas/portal-canonical-scan.schema.json
schemas/report-builder-draft.schema.json
src/commands/.gitkeep
src/commands/discover.mjs
src/commands/sample.mjs
src/commands/scan-processes.mjs
src/commands/scan.mjs
src/commands/summarize.mjs
src/data/.gitkeep
src/data/act-rule-map.json
src/data/README.md
src/data/wcag-sc-names.json
src/index.mjs
src/lib/args.mjs
src/lib/auth.mjs
src/lib/axe-artifact.mjs
src/lib/axe-utils.mjs
src/lib/browser-engine.mjs
src/lib/browser.mjs
src/lib/config.mjs
sr ...
````

## 18. Bash

````bash
cd $REPO; cat -n src/lib/logger.mjs | sed -n 14,126p; cat -n src/lib/preflight.mjs | sed -n 14,106p
````

Output (truncated):

````text
    14	 *
    15	 * @see docs/adr/0004-pino-structured-logging.md
    16	 */
    17	
    18	// SECTION: Imports
    19	import pino from 'pino';
    20	import { TOOL_IDENTITY } from './version.mjs';
    21	
    22	// SECTION: Constants
    23	
    24	// ANCHOR: REDACT_PATHS — case-insensitive JSON paths never logged verbatim
    25	const REDACT_PATHS = [
    26	  'authorization',
    27	  'Authorization',
    28	  'cookie',
    29	  'Cookie',
    30	  'set-cookie',
    31	  'Set-Cookie',
    32	  '*.password',
    33	  '*.token',
    34	  '*.secret',
    35	  '*.apiKey',
    36	  '*.api_key',
    37	  '*.accessToken',
    38	  '*.access_token',
    39	  'auth.storageState',
    40	  'auth.httpCredentials',
    41	];
    42	
    43	// SECTION: Public API
    44	
    45	/**
    46	 * @typedef ...
````

## 19. Bash

````bash
cd $SCRATCH/review && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e "
const f=require('./round1-findings.json'); const arr=Array.isArray(f)?f:(f.findings||Object.values(f).flat());
for (const id of ['SEC-18','SCAN-20','SEC-08','SEC-19','SEC-12','SEC-20','REPA-16','CAP-22','DISC-05','SEC-09','DISC-17','VERD-02']) { const x=arr.find(a=>a.id===id); if(!x){console.log(id,'MISSING');continue;} console.log('=== '+id+': '+x.title); console.log('CLAIM: '+x.claim); console.log('REC: '+(x.recommendation||'').slice(0,300)); }
" | cut -c1-1500
````

Output (truncated):

````text
=== SEC-18: Preflight checks are partly unreachable or diverge from Playwright's own resolution
CLAIM: (1) buildContext calls loadConfig, which reads the file, before runPreflight, so 'Config not found or unreadable' can never fire. A missing config gives a raw ENOENT JSON log. (2) The browser-binary check hardcodes ~/.cache/ms-playwright on non-darwin, whereas Playwright uses LOCALAPPDATA on Windows and XDG_CACHE_HOME on Linux and treats PLAYWRIGHT_BROWSERS_PATH=0 as node_modules/.local-browsers. That produces false preflight failures there. (3) With scan.browser.channel 'chrome' (system Chrome) the check still demands the bundled chromium. (4) Any 'chromium*' directory passes even if it is the wrong revision.
REC: Run the config-readable check before loadConfig, or let loadConfig throw a ...
````

## 20. Bash

````bash
cd $SCRATCH/review && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e "
const f=require('./round1-findings.json'); const arr=Array.isArray(f)?f:(f.findings||Object.values(f).flat());
const rows=[];
for (const x of arr) for (const e of (x.evidence||[])) if (/README|docs\/|CHANGELOG|TODO|CONTRIBUTING|bin\/|package.json|configs\/|scripts\/|src\/lib\/(config|context|args|version|engine|preflight|logger|validate)|src\/index|src\/types|schemas\/config/.test(e.file)) rows.push(x.id+' '+e.file+':'+(e.line??''));
console.log(rows.sort().join('\n'));
"
````

Output (truncated):

````text
CAP-01 README.md:110
CAP-01 docs/adr/0007-wcag-em-summary-shape.md:18
CAP-01 docs/guides/config-guide.md:403
CAP-01 docs/guides/user-manual.md:73
CAP-02 src/lib/config.mjs:124
CAP-07 docs/guides/config-guide.md:342
CAP-08 docs/design-notes/01-decision-points-and-recommendations.md:166
CAP-08 schemas/config.schema.json:1
CAP-09 docs/guides/integrations.md:132
CAP-09 docs/guides/user-manual.md:85
CAP-11 README.md:74
CAP-11 docs/guides/config-guide.md:412
CAP-11 docs/guides/config-guide.md:67
CAP-13 schemas/config.schema.json:662
CAP-15 docs/adr/0009-earl-jsonld-output.md:87
CAP-16 package.json:1
CAP-17 docs/guides/config-guide.md:54
CAP-17 schemas/config.schema.json:29
CAP-18 docs/guides/integrations.md:54
CAP-19 src/lib/version.mjs:56
CAP-19 src/lib/version.mjs:8
CAP-20 docs/adr/0011-v1-rel ...
````

## 21. Bash

````bash
cd $REPO; cat -n README.md
````

Output (truncated):

````text
     1	# WCAG-EM Accessibility Toolkit
     2	
     3	Automated layer of a [WCAG-EM](https://www.w3.org/TR/WCAG-EM/)-aligned
     4	accessibility audit workflow. Discovers pages, builds a structured
     5	sample, runs [axe-core](https://github.com/dequelabs/axe-core) scans,
     6	evaluates interactive processes, and produces WCAG-EM Step 5 conformance
     7	summaries — without over-claiming what automation can prove.
     8	
     9	## What it does
    10	
    11	The toolkit runs a five-stage pipeline:
    12	
    13	1. **Discover** — crawl from a root URL (optionally seeded from a
    14	   sitemap) to build a page inventory with metadata and clusters.
    15	2. **Sample** — select a structured + random sample from the inventory
    16	   per WCAG-EM Step 3.
    17	3. **Scan** — run axe ...
````

## 22. Bash

````bash
cd $SCRATCH/wf2/ops && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cat > links.mjs <<'EOF'
import fs from 'node:fs'; import path from 'node:path';
const R='$REPO';
const files=['README.md','CHANGELOG.md','TODO.md','CONTRIBUTING.md',...fs.readdirSync(R+'/docs/guides').map(f=>'docs/guides/'+f),...fs.readdirSync(R+'/docs/adr').map(f=>'docs/adr/'+f), 'src/data/README.md'];
function slug(h){return h.trim().toLowerCase().replace(/<[^>]+>/g,'').replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-');}
const anchors={};
function getAnchors(f){ if(anchors[f]) return anchors[f]; const s=new Set(); const counts={}; let inCode=false; for(const line of fs.readFileSync(f,'utf8').split('\n')){ if(/^```/.test(line)) inCode=!inCode; if(inCode) continue; const m=line.match(/^#{1,6}\s+(.*)$/); if(m){ let sl=slug(m[1].replace(/`/g,'')); if(counts[sl]!==undefined){counts[sl]++; s.add(sl+'-'+counts[sl]);} else {counts[sl]=0; s.add(sl);} } } anchors[f]=s; return s;}
for(const f of files){ const abs=path.join(R,f); const txt=fs.readFileSync(abs,'utf8'); const lines=txt.split('\n'); let inCode=false;
 lines.forEach((line,i)=>{ if(/^```/.test(line)) inCode=!inCode; if(inCode) return; for(const m of line.matchAll(/\]\(([^)\s]+)\)/g)){ const href=m[1]; if(/^(https?:|mailto:)/.test(href)) continue; const [p,a]=href.split('#'); const target=p? path.resolve(path.dirname(abs),p): abs; if(p && !fs.existsSync(target)){ console.log(`BROKEN-FILE ${f}:${i+1} -> ${href}`); continue;} if(a && target.endsWith('.md') && fs.statSync(target).isFile()){ if(!getAnchors(target).has(a)) console.log(`BROKEN-ANCHOR ${f}:${i+1} -> ${href}`);} } }); }
EOF
node links.mjs
````

Output (truncated):

````text
(Bash completed with no output)
````

## 23. Bash

````bash
cd $REPO/docs/adr; cat README.md | sed -n 1,80p; for f in 0*.md; do echo "$f: $(grep -m1 -iE '^(- )?\*?\*?status\*?\*?:|^## Status' -A2 $f | tr '\n' ' ' | cut -c1-160)"; done
````

Output (truncated):

````text
# Architecture Decision Records

This project uses [MADR 4.0](https://adr.github.io/madr/) for capturing
architectural decisions. ADR-0001 names this directory as the canonical
home for design rationale; CHANGELOG entries summarise _what_ changed,
ADRs explain _why_ the change was made and _what alternatives were
rejected_.

## Index

| #                                                    | Title                                                              | Status   | Date       |
| ---------------------------------------------------- | ------------------------------------------------------------------ | -------- | ---------- |
| [0000](./0000-record-architecture-decisions.md)      | Record architecture decisions                                      | accepted | 2026-04    |
| [0001](./00 ...
````

## 24. Bash

````bash
cd $REPO/docs/adr; sed -n 1,200p 0015-publish-and-deprecation-policy.md
````

Output (truncated):

````text
# 0015. Publish and deprecation policy

- Status: accepted
- Date: 2026-05-14
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions), ADR-0011 (v1.0 release
  boundary — stability tiers), ADR-0014 (packaging decisions)

## Context and Problem Statement

Before the first public npm publish, two lifecycle questions need
codified answers:

1. **How are releases made?** Without a documented flow, the risk is
   ad-hoc version bumps that skip validation steps or produce
   inconsistent artefacts.
2. **How are breaking config changes communicated?** The config schema
   (`schemas/config.schema.json`) is a public interface. Removing or
   renaming a field without warning would break existing user configs
   silently — or, worse, with an opaque Ajv validation error.

## Decision

## ...
````

## 25. Bash

````bash
cd $REPO; grep -n "^## \|^### \|BREAKING\|[Bb]reaking" CHANGELOG.md | head -60; grep -n "markdownReport" schemas/config.schema.json src -r | head
````

Output (truncated):

````text
7:## [Unreleased]
9:### Changed
17:  _Breaking for diff-based consumers:_ such pages drop out of findings and stop
70:### Added
169:### Changed
201:### Fixed
220:### Counts glossary
234:### Roadmap
255:## [1.1.0] - 2026-05-14
257:### Fixed
270:### Added
278:## [1.0.0] - 2026-05-14
280:### Added
305:### Changed
317:### Fixed
388:  `undefined`, breaking `includePasses` and the HTML criteria table).
395:### Layer 3b follow-ups (carry-forward)
414:## [Layer 4] - 2026-04-30 - Pluggable reporters
416:### Security
433:### Fixed
447:### Added
487:### Changed
504:### Removed
510:### Deferred
schemas/config.schema.json:550:        "markdownReport": {
src/types/config.d.ts:218:    markdownReport?: boolean;
src/lib/auth.mjs:145: * to surface `reporting.markdownReport` deprecation once per run.
src/lib ...
````

## 26. Bash

````bash
cd $REPO; sed -n 1,70p CHANGELOG.md
````

Output (truncated):

````text
# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); ADR-0001
names `CHANGELOG.md [Unreleased]` as the canonical home for deferred work.

## [Unreleased]

### Changed

- **Could-not-audit pages no longer pollute the audit (E1, ADR-0017).** Pages
  the scanner cannot audit — Cloudflare/WAF **challenge** interstitials and
  **empty** documents — are classified at the scan/process write-site
  (`pageOutcome`) and excluded from findings, coverage counters, and per-SC
  verdicts at **every** consumer (summarize, the WCAG-EM inversion, and the
  portal-export / report-builder / html reporters), not just `summary.json`.
  _Breaking for diff-based consumers:_ such pages drop out of findings and st ...
````

## 27. Bash

````bash
cd $REPO; sed -n 160,300p CHANGELOG.md
````

Output (truncated):

````text
- **`schemas/portal-canonical-scan.schema.json`** — vendored (empirically
  derived) portal contract, validated in
  `test/unit/portal-export-schema.test.mjs` as a regression gate: critical/high
  findings must carry `evidence.html` plus an instance htmlSnippet.
- **`src/lib/axe-artifact.mjs`** — shared `liftRuleSummaries` /
  `liftIncompleteSummaries`, consolidating a helper previously duplicated (and
  diverged: 7-key in `scan.mjs` vs 4-key in `process-runner.mjs`).
- ADR-0016 (incomplete-node evidence).

### Changed

- **`samplePagesScanned` redefined to PAGES** (unique pages with at least one
  successful view); the previous value counted page-view entries (pages x
  viewports) INCLUDING failures, so a 5-page 2-viewport audit reported 10
  "pages scanned" and failed pages inflated cove ...
````

## 28. Bash

````bash
cd $REPO; sed -n 130,200p src/lib/auth.mjs; sed -n 340,360p src/commands/summarize.mjs; sed -n 545,560p schemas/config.schema.json
````

Output (truncated):

````text
 * by `applyAuth` for `setupScript` and by `summarize.mjs` for
 * `reporting.reporters`.
 *
 * @param {import('pino').Logger} logger
 * @param {{ feature: string, deferralLayer: string }} args
 * @returns {void}
 */
export function warnSchemaAcceptedRuntimeIgnored(logger, { feature, deferralLayer }) {
  logger.warn({ feature }, buildWarnSchemaAcceptedMessage(feature, deferralLayer));
}

/**
 * Uniform warn message for "legacy config alias; the runtime resolved it to
 * the modern field". Colocated with `warnSchemaAcceptedRuntimeIgnored` so
 * every config-deprecation helper lives in one place. Used by `summarize.mjs`
 * to surface `reporting.markdownReport` deprecation once per run.
 *
 * @param {import('pino').Logger} logger
 * @param {{ oldField: string, newField: string, guidance?: stri ...
````

## 29. Bash

````bash
cd $REPO; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; node -e "
const s=require('./schemas/config.schema.json');
const out=[];
function walk(n,p){ if(!n||typeof n!=='object')return; if(n.properties) for(const [k,v] of Object.entries(n.properties)){ out.push(p?p+'.'+k:k); walk(v,p?p+'.'+k:k);} if(n.items) walk(n.items,p+'[]'); for(const kw of ['oneOf','anyOf','allOf']) if(n[kw]) n[kw].forEach(x=>walk(x,p)); if(n.\$ref&&n.\$ref.startsWith('#/\$defs/')) {} }
walk(s,''); for (const [k,v] of Object.entries(s.\$defs||{})) walk(v,'\$defs.'+k);
console.log(out.join('\n'));
" > $SCRATCH/wf2/ops/schema-keys.txt; wc -l $SCRATCH/wf2/ops/schema-keys.txt
for k in $(sed 's/.*\.//; s/\[\]//g' $SCRATCH/wf2/ops/schema-keys.txt | sort -u); do n=$(grep -rlw -- "$k" src --include=*.mjs | grep -v "src/types" | wc -l | tr -d ' '); [ "$n" = "0" ] && echo "UNREAD-IN-SRC: $k"; done
````

Output (truncated):

````text
     127 $SCRATCH/wf2/ops/schema-keys.txt
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: action
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: actions
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: allowedHosts
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: atBaseline
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: auth
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: autoSuggest
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: axe
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: beforeScan
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: browser
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: captureCanonical
(eval):8: no matches found: --include=*.mjs
UNREAD-IN-SRC: captureForms
 ...
````

## 30. Bash

````bash
cd $REPO; for k in $(sed 's/.*\.//; s/\[\]//g' $SCRATCH/wf2/ops/schema-keys.txt | sort -u); do n=$(grep -rlw --include='*.mjs' -- "$k" src | wc -l | tr -d ' '); [ "$n" = "0" ] && echo "UNREAD-IN-SRC: $k"; done; echo; grep -rn --include='*.mjs' -w "screenshotFormat\|screenshotQuality\|ttlMinutes\|includeSubdomains\|smallSiteSupplementaryScanThreshold\|groupBestPracticeSeparately\|headless\|captureLandmarks\|captureSearchInputs\|fullPageScreenshots\|retries" src | cut -c1-170
````

Output (truncated):

````text
UNREAD-IN-SRC: includeSubdomains

src/lib/process-runner.mjs:17: * step also finally honours `config.scan.fullPageScreenshots` (the v0.3
src/lib/process-runner.mjs:268:        fullPage: config.scan.fullPageScreenshots !== false,
src/lib/browser.mjs:15: *   - **launch** (default; byte-identical to pre-E8): `chromium.launch({ headless })`,
src/lib/browser.mjs:64: * @property {boolean} [headless] - Present when transport is `launch`.
src/lib/browser.mjs:106:    if (typeof browserCfg.headless === 'boolean') {
src/lib/browser.mjs:108:        'scan.browser.headless is ignored under a CDP endpoint (the attached browser owns its mode).',
src/lib/browser.mjs:117:    headless: browserCfg.headless !== false,
src/lib/browser.mjs:176:  const launchOptions = { headless: plan.headless };
src/lib/axe-util ...
````

## 31. Bash

````bash
cd $REPO; cat -n docs/guides/user-manual.md
````

Output (truncated):

````text
     1	# User manual
     2	
     3	Running the toolkit and understanding what comes out. For writing the config
     4	itself, see the [config authoring guide](./config-guide.md); for what to do
     5	with the portal and report-builder exports, see the
     6	[integrations guide](./integrations.md).
     7	
     8	## 1. From install to first audit
     9	
    10	```bash
    11	npm install wcag-em-a11y-toolkit
    12	npx playwright install chromium
    13	```
    14	
    15	Prerequisites: Node.js >= 22.11.0 (`node -v` to check; the CLI refuses older
    16	runtimes with an explicit message) and the Chromium download above (the
    17	discover/scan/scan-processes/audit commands check for it up front and fail
    18	with the install command if missing).
    19	
    20	Create a minimal confi ...
````

## 32. Bash

````bash
cd $REPO; grep -rn "exceeded stepTimeoutMs\|present but unreadable\|path unreadable\|minutes old\|NOT gitignored\|fails the vendored contract\|failed to scan on all viewports\|failed on viewport(s)\|process \\\\\?\"\|pre-scan action\|crawl stopped at maxPages\|with zero reviewable nodes" src | cut -c1-220
````

Output (truncated):

````text
src/lib/fs-utils.mjs:18: * `config.processes` is empty) from "present but unreadable" (corruption —
src/lib/fs-utils.mjs:114:        'artefact present but unreadable; using fallback — pipeline state may be corrupt',
src/lib/wcag-em-summary.mjs:278:          `axe rule ${inc.id} reported incomplete with zero reviewable nodes on ${pageUrl}; ` +
src/lib/process-runner.mjs:108:    super(`step "${action}" exceeded stepTimeoutMs=${timeoutMs}`);
src/commands/summarize.mjs:290:      `page failed to scan on all viewports: ${p.url} (${p.failures[0]?.error ?? 'unknown error'})`,
src/commands/summarize.mjs:295:      `page failed on viewport(s) ${p.failures.map((f) => f.viewport).join(', ')}: ${p.url}`,
src/commands/summarize.mjs:299:    warnings.push(`process "${p.name}" failed at ${p.startUrl}: ${p.er ...
````

## 33. Bash

````bash
cd $REPO; grep -n "vendored\|validateExports" src/reporters/portal-export.mjs | head; sed -n 270,285p src/lib/wcag-em-summary.mjs; sed -n 280,335p src/commands/summarize.mjs
````

Output (truncated):

````text
      }
    }
    for (const inc of incompleteDetail ?? []) {
      const meta = withActAndWcagMetadata(inc);
      const hasReviewableNodes = typeof inc.nodesCount === 'number' && inc.nodesCount > 0;
      if (!hasReviewableNodes) {
        // Infra failure — route to scanWarnings (F8), do NOT elevate to SC verdict.
        scanWarnings.push(
          `axe rule ${inc.id} reported incomplete with zero reviewable nodes on ${pageUrl}; ` +
            `infra failure (script timeout / cross-origin / engine snag). Does not affect SC verdicts.`,
        );
        continue;
      }
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyReviewableIncomplete = true;
    processStepFailures,
    preScanFailures,
    maxPagesConfigured,
    reachedMaxPages,
  };

 ...
````

## 34. Bash

````bash
cd $REPO; grep -rn "fails\|contract" src/reporters/portal-export.mjs | head -20; grep -rn "portal-export:" src | head
````

Output (truncated):

````text
(Bash completed with no output)
````

## 35. Bash

````bash
cd $REPO; grep -rn "validateExports\|vendored" src --include=*.mjs | cut -c1-200 | head -20; grep -n "fails the vendored\|validateExports" docs/guides/*.md | cut -c1-220
````

Output (truncated):

````text
(eval):1: no matches found: --include=*.mjs
docs/guides/config-guide.md:171:| `validateExports`              | `"warn"`               | Write-time contract validation for portal-export and report-builder-starter: `off` \| `warn` (log + write) \| `error` (reporter 
docs/guides/user-manual.md:151:| `portal-export: payload fails the vendored contract ...`                                        | See the integrations guide; with `reporting.validateExports: "warn"` the file still write
docs/guides/integrations.md:37:   `reporting.validateExports: "warn"`, a payload that violates the vendored
docs/guides/integrations.md:39:   `portal-export: payload fails the vendored contract ...` — fix before
docs/guides/integrations.md:42:   Set `validateExports: "error"` to make the reporter refuse to emit a ...
````

## 36. Bash

````bash
cd $REPO; grep -rn "validateExports\|vendored contract\|fails the" src | cut -c1-220 | head -20
````

Output (truncated):

````text
src/types/config.d.ts:227:     * Write-time validation of exporter payloads against their vendored contracts (currently portal-export). 'warn' logs schema violations and still writes; 'error' makes the reporter fail inst
src/types/config.d.ts:229:    validateExports?: "off" | "warn" | "error";
src/reporters/report-builder-starter.mjs:275:/** @returns {Promise<any>} compiled Ajv validate fn for the vendored contract */
src/reporters/report-builder-starter.mjs:575:  const validateMode = config?.reporting?.validateExports ?? 'warn';
src/reporters/report-builder-starter.mjs:583:        throw new Error(`report-builder-starter: draft fails the vendored contract: ${issues}`);
src/reporters/report-builder-starter.mjs:587:        'report-builder-starter: draft fails the vendored contract; writing a ...
````

## 37. Bash

````bash
cd $REPO; sed -n 535,600p src/reporters/portal-export.mjs; wc -l src/reporters/portal-export.mjs
````

Output (truncated):

````text
      reportedTotal: rawFindings.length,
      manualReviewIssues,
      ...(totalIssues > 0 ? { distribution } : {}),
      ...(averageScore !== null ? { averageScore } : {}),
      ...(scoreBasis ? { scoreBasis } : {}),
      scoreSource: 'wcag-em-criterion-outcomes',
    },
    rawFindings,
  };

  // ANCHOR: ValidateExports — write-time contract gate (2026-06 review C4).
  // 'warn' (default) logs violations and still writes — the warning is the
  // signal, matching warnOnMissingCriticalEvidence; 'error' fails the
  // reporter instead of emitting an invalid file (runReporters isolates the
  // failure per-reporter); 'off' skips the check entirely.
  const validateMode = ctx?.config?.reporting?.validateExports ?? 'warn';
  if (validateMode !== 'off') {
    const validate = await getPo ...
````

## 38. Bash

````bash
cd $REPO; grep -c "validateExports" src/reporters/portal-export.mjs; file src/reporters/portal-export.mjs; grep -rn "validateExports" src/reporters/ | cut -c1-120
````

Output (truncated):

````text
src/reporters/portal-export.mjs: data
src/reporters/report-builder-starter.mjs:575:  const validateMode = config?.reporting?.validateExports ?? 'warn';
src/reporters/report-builder-starter.mjs:587:        'report-builder-starter: draft fails the vendored contract; writing
````

## 39. Bash

````bash
cd $REPO; LC_ALL=C grep -c "validateExports" src/reporters/portal-export.mjs; echo "rc=$?"; tr -d -c '\000' < src/reporters/portal-export.mjs | wc -c; git diff --stat HEAD -- src/reporters/portal-export.mjs; git show HEAD:src/reporters/portal-export.mjs | file -; ls -la src/reporters/portal-export.mjs; grep -n $'\xef\xbf\xbe\|\xef\xbf\xbf' src/reporters/portal-export.mjs | head -3
````

Output (truncated):

````text
rc=1
       1
/dev/stdin: data
-rw-r--r--@ 1 $USER  staff  23014 Sep 30 11:50 src/reporters/portal-export.mjs
````

## 40. Bash

````bash
cd $REPO; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; node -e "const s=require('fs').readFileSync('src/reporters/portal-export.mjs','utf8'); const i=s.indexOf('\u0000'); const ln=s.slice(0,i).split('\n').length; console.log('line',ln); console.log(JSON.stringify(s.split('\n')[ln-1]))"; for f in $(git ls-files 'src/*' 'bin/*' 'schemas/*' 'scripts/*'); do n=$(tr -d -c '\000' < $f | wc -c | tr -d ' '); [ "$n" != "0" ] && echo "$f NUL=$n"; done
````

Output (truncated):

````text
Exit code 1
line 304
"        const k = `${r.url}\u0000${r.selector}`;"
src/reporters/portal-export.mjs NUL=1
````

## 41. Bash

````bash
cd $REPO; sed -n 30,80p src/commands/summarize.mjs; grep -n "exitCode\|runReporters" src/commands/summarize.mjs | head -20; sed -n 100,140p src/reporters/index.mjs
````

Output (truncated):

````text
import { buildContext, ensurePreflight } from '../lib/context.mjs';
import { runReporters } from '../reporters/index.mjs';

// SECTION: Pure helpers (exported for testability)

/**
 * Compute the process exit code for a summary given a `failOnFindings`
 * policy. Pa11y-compatible semantics: exit 0 when the run is clean,
 * exit 2 when at least `threshold` findings match the impact set OR
 * classification set. The bin/wcag-em.mjs Commander entry already
 * threads the returned code into `process.exitCode`.
 *
 * Guards: missing / non-object policy → 0 (feature off); threshold not
 * a positive integer → 0 (schema minimum is 0, so 0 is a valid "off"
 * signal that we must not accidentally treat as "trip on every run").
 *
 * Counts GROUPS of findings (one entry per axe rule), not occurrence ...
````

## 42. Bash

````bash
cd $REPO; sed -n 630,705p src/commands/summarize.mjs
````

Output (truncated):

````text
  // `writeJson` calls + `manual-backlog.md` writeText below stay inline —
  // they are analytical side-artefacts that always write regardless of
  // `reporting.reporters` config (per ADR-0008's reporter-vs-side-artefact
  // split).
  const resolvedReporters = Array.isArray(config.reporting?.reporters)
    ? config.reporting.reporters
    : ['json', 'markdown'];
  const reporterOutcome = await runReporters(resolvedReporters, summary, ctx);
  for (const failure of reporterOutcome.errors) {
    logger.error(
      { reporter: failure.name, err: { name: failure.error.name, message: failure.error.message } },
      'reporter failed',
    );
  }
  await writeJson(path.join(paths.reportsDir, 'grouped-by-rule.json'), groupedFindings);
  await writeJson(path.join(paths.reportsDir, 'grouped-by-c ...
````

## 43. Bash

````bash
cd $REPO; grep -rn "npm run \(audit\|discover\|sample\|scan\|summarize\)\|node src/commands" --include=*.md . 2>/dev/null | grep -v node_modules | cut -c1-200; grep -n "rootUrl\|\"name\"" configs/*.json | head -20
````

Output (truncated):

````text
(eval):1: no matches found: --include=*.md
configs/example-site-best-practice.json:2:  "name": "example-site-best-practice",
configs/example-site-best-practice.json:3:  "rootUrl": "https://example.com/",
configs/example-site-best-practice.json:74:      "name": "",
configs/example-site-with-auth.json:2:  "name": "example-site-with-auth",
configs/example-site-with-auth.json:3:  "rootUrl": "https://example.com/",
configs/example-site-with-auth.json:88:      "name": "",
configs/example-site-with-cdp.json:2:  "name": "example-site-with-cdp",
configs/example-site-with-cdp.json:3:  "rootUrl": "https://example.com/",
configs/example-site-with-processes.json:2:  "name": "example-site-with-processes",
configs/example-site-with-processes.json:3:  "rootUrl": "https://example.com/",
configs/example-sit ...
````

## 44. Bash

````bash
cd $REPO; grep -rn "legacy-events" --exclude-dir=node_modules --exclude-dir=output . | grep -v "^./configs/legacy-events.json" | cut -c1-200 | head; grep -rn "npm run" README.md CONTRIBUTING.md docs/guides | cut -c1-200
````

Output (truncated):

````text
.gitignore:28:# example-*.json templates + legacy-events.json; anything else under configs/ is a
.gitignore:32:!configs/legacy-events.json
CHANGELOG.md:112:  from the run summary: site-derived finding IDs (`legacy-events -> LE-001`),
test/unit/reporters-report-builder-starter.test.mjs:37:      config: { name: 'legacy-events', rootUrl: 'https://example.com/' },
test/unit/reporters-report-builder-starter.test.mjs:50:    site: 'legacy-events',
test/unit/reporters-report-builder-starter.test.mjs:132:  assert.equal(deriveIdPrefix('legacy-events'), 'LE');
test/unit/configs-valid.test.mjs:33:  'configs/legacy-events.json',
docs/guides/config-guide.md:40:  derives the report-builder draft's finding-ID prefix (`legacy-events` ->
docs/reviews/2026-06-epics-E1-E7.md:153:shipped config (`configs/<loca ...
````

## 45. Bash

````bash
cd $REPO; echo "src/bin/scripts without @ts-check:"; for f in $(git ls-files 'src/**.mjs' 'bin/*.mjs' 'scripts/*.mjs'); do head -3 $f | grep -q "@ts-check" || echo "  $f"; done; echo "tests without @ts-check: $(for f in $(git ls-files 'test/**.mjs'); do head -3 $f | grep -q '@ts-check' || echo $f; done | wc -l) of $(git ls-files 'test/**.mjs' | wc -l)"; grep -rln "@ts-nocheck" src bin | head; cat -n CONTRIBUTING.md | sed -n 1,64p
````

Output (truncated):

````text
src/bin/scripts without @ts-check:
tests without @ts-check:        0 of       70
     1	# Contributing
     2	
     3	## Setup
     4	
     5	Node.js >= 22.11.0 (see `.nvmrc`; the repo assumes nvm). Then:
     6	
     7	```bash
     8	npm ci
     9	npx playwright install chromium   # needed by the e2e suite + scan stages
    10	```
    11	
    12	## The gate
    13	
    14	Every commit must pass the full gate locally before it lands:
    15	
    16	```bash
    17	npm run lint          # ESLint (flat config; JSDoc required on exports)
    18	npm run typecheck     # tsc over JSDoc types (strict, checkJs)
    19	npm test              # unit suite (node:test)
    20	npm run test:e2e      # pipeline e2e against local fixture servers
    21	npm run format:check  # prettier, markdown included
    ...
````

## 46. Bash

````bash
cd $REPO; cat test/fixtures/site.json.template; sed -n 1,60p test/fixtures/server.mjs; ls test/fixtures
````

Output (truncated):

````text
{
  "name": "e2e-fixture-site",
  "rootUrl": "__BASE_URL__/",
  "scope": {
    "mode": "same-origin",
    "allowedHosts": []
  },
  "crawl": {
    "maxPages": 10,
    "maxConcurrency": 2,
    "requestTimeoutSecs": 30,
    "requestDelayMs": 0,
    "excludeUrlPatterns": [],
    "sitemapSeeding": {
      "enabled": true,
      "urls": [],
      "commonPaths": ["/sitemap.xml"],
      "maxUrls": 50
    }
  },
  "discovery": {
    "captureH1": true,
    "captureCanonical": true,
    "captureForms": true,
    "captureLandmarks": true,
    "captureSearchInputs": true
  },
  "sample": {
    "structuredManual": ["__BASE_URL__/index.html", "__BASE_URL__/about.html"],
    "autoSuggest": {
      "enabled": true,
      "perCluster": 1,
      "preferTypes": ["homepage", "form-or-contact", "policy", "cont ...
````

## 47. Bash

````bash
cd $REPO; sed -n 70,100p src/lib/urls.mjs; sed -n 40,75p src/commands/scan.mjs; sed -n 255,275p src/lib/process-runner.mjs; grep -n '"id"' -A6 schemas/config.schema.json | sed -n 1,30p
````

Output (truncated):

````text
  return url.toString();
}

/**
 * Produce a filename-safe version of a URL (used for screenshot paths).
 *
 * @param {string} url
 * @returns {string}
 */
export function fileSafeFromUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
}

/**
 * First non-empty path segment (or `(root)` for `/`).
 *
 * @param {string} urlString
 * @returns {string}
 */
export function firstPathSegment(urlString) {
  const url = new URL(urlString);
  return url.pathname.split('/').filter(Boolean)[0] ?? '(root)';
}

// SECTION: Public API — classification (internal, plugin API deferred)

/**
 * Heuristic page-type classifier used for sampling and clustering.
 * Plugin API deferred to v2.0 per ADR-0012.
 *
 * @internal
 * Build the screenshot filename for a URL × viewport combinatio ...
````

## 48. Bash

````bash
cd $REPO; grep -rn "\.pathname\b" src bin scripts | grep -i "import.meta\|new URL(" | cut -c1-200; grep -rn "file://\${process.argv\[1\]}\|file://' +\|split('/')" src bin scripts | cut -c1-160; grep -rn "process.platform\|win32\|path.sep\|posix" src bin | cut -c1-160
````

Output (truncated):

````text
src/lib/urls.mjs:244:    pathname = new URL(urlString).pathname;
src/commands/summarize.mjs:381:        new URL('../data/act-rule-map.json', import.meta.url).pathname,
src/commands/discover.mjs:152:    pathname = new URL(url).pathname;
src/commands/discover.mjs:275:          firstPathSegment: new URL(currentUrl).pathname.split('/').filter(Boolean)[0] ?? '(root)',
src/lib/urls.mjs:91:  return url.pathname.split('/').filter(Boolean)[0] ?? '(root)';
src/lib/urls.mjs:107:  const segments = url.pathname.split('/').filter(Boolean);
src/commands/discover.mjs:275:          firstPathSegment: new URL(currentUrl).pathname.split('/').filter(Boolean)[0] ?? '(root)',
src/lib/preflight.mjs:88:        process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright',
src/reporters/ht ...
````

## 49. Bash

````bash
cd $REPO; sed -n 1,60p docs/guides/config-guide.md | cut -c1-260
````

Output (truncated):

````text
# Config authoring guide

How to write a site config for any audit — from a quick smoke test to a full
production client engagement. Every field the toolkit understands is documented
here; the formal source of truth is [`schemas/config.schema.json`](../../schemas/config.schema.json)
(Ajv-validated at load, so a bad config fails fast with a pointer to the exact
field). A guard test keeps this guide complete: every schema field must appear
here, or the test suite fails naming the missing field.

Companion guides: the [user manual](./user-manual.md) covers running the
pipeline and reading its output; the [integrations guide](./integrations.md)
covers what to do with the portal and report-builder exports.

## 1. The minimal valid config

Six sections are required: `name`, `rootUrl`, `scope`, ` ...
````

## 50. Bash

````bash
cd $REPO; sed -n 60,200p docs/guides/config-guide.md | cut -c1-300
````

Output (truncated):

````text
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `maxPages`              | `80`                          | Crawl ceiling. When hit, `inventory-metadata.json` records `reachedMaxPages: true` and summarize emits a truncation scan warning.       |
| `maxConcurrency`        | `5`                           | Parallel page loads. Drop to `2` for slow sites or heavy SPA hydration.                                                                 |
| `requestTimeoutSecs`    | `90`                          | Whole-request budget per crawled page (Crawlee handler).                                                                                |
| `navig ...
````

## 51. Bash

````bash
cd $REPO; sed -n 200,330p docs/guides/config-guide.md | cut -c1-280
````

Output (truncated):

````text
| `samplingMethodNotes`    | synthesized                              | Leave blank and the toolkit writes Step 3 provenance from the real sample metadata (counts, pool %, seed, inventory size). Set it only to use your own wording. |

### Deprecated fields

Accepted by the schema for backwards compatibility; do not use in new configs:

| Field                      | Replacement                                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| `scope.includeSubdomains`  | `scope.mode` (`same-hostname` vs `same-origin`).                          |
| `scan.viewport`            | `scan.viewports` array.                                                   |
| `reporting.markdownReport` | `re ...
````

## 52. Bash

````bash
cd $REPO; sed -n 288,292p docs/guides/config-guide.md; cd $SCRATCH/review && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e "
const f=require('./round1-findings.json'); const arr=Array.isArray(f)?f:(f.findings||Object.values(f).flat());
for (const id of ['SCAN-05','VERD-14','PROC-15','SCAN-04','DISC-26','SEC-15']) { const x=arr.find(a=>a.id===id); console.log('=== '+id+': '+x.title); console.log('CLAIM: '+x.claim.slice(0,900)); }
"
````

Output (truncated):

````text
  after first render — the strongest signal that axe sees the real tree.
- `click` dismisses cookie banners or modals that overlay content.
- Lower `crawl.maxConcurrency` when hydration is CPU-heavy.
- Use `scan.axe.overrides` to relax rules on specific shells (e.g. disable a
  rule on one route via `urlPattern` + `withRules`).
=== SCAN-05: withRules is silently discarded whenever withTags is non-empty (true by default), including per-URL overrides; the documented 'disable a rule on one route' recipe cannot work and there is no disableRules
CLAIM: In @axe-core/playwright, withRules() and withTags() both overwrite this.option.runOnly, so the last call wins. scan.mjs calls withRules first and then withTags, and DEFAULTS ship a five-tag withTags. So a config or override that sets only withRul ...
````

## 53. Bash

````bash
cd $REPO; cat -n TODO.md | sed -n 1,244p | cut -c1-230
````

Output (truncated):

````text
     1	# TODO / working board
     2	
     3	Operational checklist for active and upcoming work. The **canonical** home for
     4	release-bound deferred work is `CHANGELOG.md` `[Unreleased]` (ADR-0001); this
     5	board is the prioritised working view, kept in sync with it. There are no stray
     6	`TODO`/`FIXME` markers in the source — items here come from the CHANGELOG
     7	roadmap, the Layer-3b carry-forwards, the post-`portal-export` review, and the
     8	2026-06 systematic toolkit review
     9	([docs/reviews/2026-06-toolkit-review.md](docs/reviews/2026-06-toolkit-review.md),
    10	which carries evidence, the full roadmap rationale, and the Sprint 1 plan).
    11	
    12	_Last updated: 2026-06-15 (post-E8 + live-validation pass — see "Recently
    13	landed" below). Prior: 2026 ...
````

## 54. Bash

````bash
cd $REPO; git log --format='%h %ad %s' --date=short -25 | cut -c1-150; echo; git log --format='%h %ad %s' --date=short -3 -- TODO.md; git log --format='%h %ad %s' --date=short -3 -- docs/adr/0021-waf-challenge-access-strategy.md; git log --format='%h %ad %s' --date=short -3 -- CHANGELOG.md
````

Output (truncated):

````text
306d38d 2026-06-16 Merge pull request #28 from sargentJE/chore/cf-worker-about-page
6e24333 2026-06-16 chore(spike): cf-worker serves a public "about" page at / (bot documentation URL)
715ecf9 2026-06-15 Merge pull request #27 from sargentJE/chore/web-bot-auth-r2-no-client-zone
2cd3c56 2026-06-15 docs+spike: R2 test without client-zone access; correct "zone we control"
3b9697d 2026-06-15 Merge pull request #26 from sargentJE/fix/cf-worker-ed25519-jwk-alg
dd2232c 2026-06-15 fix(spike): Worker strips JWK to {kty,crv,x,d}; generator drops non-portable alg
0e4f78d 2026-06-15 Merge pull request #25 from sargentJE/chore/cf-worker-custom-domain
9696626 2026-06-15 chore(spike): enable the cf-worker custom domain (auditor.mywebaccess.co.uk)
a6e5aac 2026-06-15 Merge pull request #24 from sargentJE/f ...
````

## 55. Bash

````bash
cd $REPO; git show 2cd3c56 --stat | head -20; grep -n "own zone\|zone we control\|our own\|client zone\|client-zone" TODO.md docs/adr/0021-waf-challenge-access-strategy.md docs/plans/2026-06-web-bot-auth-registration.md | cut -c1-220
````

Output (truncated):

````text
commit 2cd3c56da4c4c68f28481cb0471eded6bfbd77f1
Author: Jamie Sargent <$USER@local>
Date:   Mon Jun 15 19:55:50 2026 +0100

    docs+spike: R2 test without client-zone access; correct "zone we control"
    
    Jamie controls only the auditor zone (mywebaccess.co.uk), not MyVision's Cloudflare,
    so the R2 go/no-go can't be a WAF rule on the client zone. Reframe the test + fix the
    docs that assumed otherwise.
    
    - self-test.mjs: add --raw mode — send a signed request to a REAL target (not the CF
      verifier) and report the HTTP status (200 = cleared, 403 + cf-mitigated = challenged).
    - spike README step 5: rewrite as (a) a controlled Managed-Challenge test on our own
      mywebaccess.co.uk zone (exact WAF rule + curl/self-test procedure) and (b) an empirical
      signe ...
````

## 56. Bash

````bash
cd $REPO; sed -n 60,200p test/fixtures/server.mjs | grep -n "export\|slowMs\|routes\|return {" | head -20; ls test/fixtures/static-site; cat test/fixtures/make-config.mjs | sed -n 1,60p
````

Output (truncated):

````text
65:export async function startFixtureServer(options = {}) {
66:  const { staticDir, routes = {}, auth, slowMs } = options;
122:      // 2. Slow route (explicit opt-in via slowMs option).
123:      if (typeof slowMs === 'number' && urlPath === '/slow') {
124:        await new Promise((r) => setTimeout(r, slowMs));
130:      // 3. Caller-supplied exact-match routes.
131:      const customHandler = routes[urlPath];
about.html
contact.html
index.html
sitemap.xml
xss.html
// @ts-check
/**
 * @file Materialise a test-run config from the template + dynamic baseUrl.
 * @module test/fixtures/make-config
 *
 * @description
 * The fixture server binds on an ephemeral port, so the `rootUrl` in a site
 * config can't be a committed constant. This helper reads
 * `test/fixtures/site.json.template` (whic ...
````

## 57. Bash

````bash
cd $REPO; sed -n 125,200p test/fixtures/server.mjs
````

Output (truncated):

````text
  const { staticDir, routes = {}, auth, slowMs } = options;
  // baseUrl is set after `listen(0)` resolves; closures below read it.
  // String captured by closure so request handlers see the assigned value.
  /** @type {string} */
  let baseUrl = '';

  const server = createServer(async (req, res) => {
    // Force connection close on every response. Default keep-alive
    // (Keep-Alive: timeout=5) causes some headless-browser navigation
    // strategies (waitUntil: 'load' / 'networkidle') to wait the full
    // keep-alive interval before declaring the page settled, which
    // makes test runs flaky and slow.
    res.setHeader('Connection', 'close');
    try {
      const url = req.url ?? '/';
      const urlPath = url.split('?')[0];

      // 1. Auth handlers take precedence over eve ...
````

## 58. Bash

````bash
cd $REPO; sed -n 200,240p test/fixtures/server.mjs | grep -n "return\|baseUrl\|stop" 
````

Output (truncated):

````text
4:          return;
12:          // reference the dynamic ephemeral baseUrl by placeholder without
24:            res.end(body.toString('utf8').replaceAll('__BASE_URL__', baseUrl));
28:          return;
34:            return;
````

## 59. Bash

````bash
cd $REPO; sed -n 240,290p test/fixtures/server.mjs
````

Output (truncated):

````text
      res.statusCode = 404;
      res.end('Not found');
    } catch (err) {
      // Failsafe — never leave a request hanging.
      res.statusCode = 500;
      res.end(String(err instanceof Error ? err.message : err));
    }
  });

  server.listen(0);
  await once(server, 'listening');
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  baseUrl = `http://127.0.0.1:${address.port}`;

  /** @type {FixtureServerHandle} */
  return {
    baseUrl,
    stop: () => new Promise((resolve) => server.close(() => resolve(undefined))),
  };
}

// SECTION: Internal HTML snippets

/** @returns {string} */
function loginFormHtml() {
  return `<!DOCTYPE html>
<html><head><title>Login</title></head><body>
<form method="POST" action="/login">
  <label for="u">Username</labe ...
````

## 60. Bash

````bash
mkdir -p $SCRATCH/wf2/ops && cd $SCRATCH/wf2/ops && cat > lib.mjs <<'EOF'
import { spawn } from 'node:child_process';
export const R = '$REPO';
export const S = '$SCRATCH/wf2/ops';
export const BIN = R + '/bin/wcag-em.mjs';
export function run(cmd, args, { cwd = S, env = {}, timeoutMs = 240000, detached = false, onSpawn } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, CRAWLEE_STORAGE_DIR: S + '/crawlee-storage', ...env }, detached });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const t = setTimeout(() => { try { process.kill(detached ? -child.pid : child.pid, 'SIGKILL'); } catch {} }, timeoutMs);
    if (onSpawn) onSpawn(child);
    child.on('close', (code, signal) => { clearTimeout(t); resolve({ code, signal, out, err }); });
  });
}
EOF
cat > e1.mjs <<'EOF'
import fs from 'node:fs/promises';
import { R, S, BIN, run } from './lib.mjs';
const { startFixtureServer } = await import(R + '/test/fixtures/server.mjs');
const srv = await startFixtureServer({ staticDir: R + '/test/fixtures/static-site' });
try {
  const tpl = await fs.readFile(R + '/test/fixtures/site.json.template', 'utf8');
  const cfg = JSON.parse(tpl.replaceAll('__BASE_URL__', srv.baseUrl));
  await fs.writeFile(S + '/cfg-base.json', JSON.stringify(cfg, null, 2));
  const r = await run('node', [BIN, 'audit', '--config', S + '/cfg-base.json', '--out-dir', S + '/e1', '--quiet']);
  console.log('audit exit', r.code, r.signal, 'stderr tail:', r.err.slice(-600));
  console.log(await fs.readdir(S + '/e1/reports'));
  console.log('inventory files', await fs.readdir(S + '/e1/inventory'));
} finally { await srv.stop(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node e1.mjs
````

Output (truncated):

````text
audit exit 2 null stderr tail: 
[
  'grouped-by-component.json',
  'grouped-by-rule.json',
  'manual-backlog.md',
  'random-vs-structured-comparison.json',
  'summary.json',
  'summary.md',
  'wcag-em-summary.json'
]
inventory files [
  'document-inventory.json',
  'inventory-metadata.json',
  'inventory.json',
  'page-clusters.json',
  'process-candidates.json',
  'random-pool.txt',
  'random-sample.txt',
  'sample-metadata.json',
  'structured-sample-suggested.json',
  'structured-sample.txt',
  'urls.txt'
]
````

## 61. Bash

````bash
cd $SCRATCH/wf2/ops && cat > e2.mjs <<'EOF'
import fs from 'node:fs/promises';
import { R, S, BIN, run } from './lib.mjs';
const cfg = S + '/cfg-base.json';
// fresh working dir whose ./output is a copy of the e1 run
await fs.rm(S + '/wd', { recursive: true, force: true });
await fs.mkdir(S + '/wd');
await fs.cp(S + '/e1', S + '/wd/output', { recursive: true });
const before = (await fs.stat(S + '/wd/output/reports/summary.json')).mtimeMs;
// (a) CLI summarize against the same out-dir
let r = await run('node', [BIN, 'summarize', '--config', cfg, '--out-dir', S + '/wd/output', '--quiet'], { cwd: S + '/wd' });
console.log('(a) wcag-em summarize exit', r.code);
// (b) standalone runner (what `npm run summarize` executes), with --out-dir pointing elsewhere
r = await run('node', [R + '/src/commands/summarize.mjs', '--config', cfg, '--out-dir', S + '/wd/elsewhere'], { cwd: S + '/wd', env: { WCAG_EM_LOG_LEVEL: 'warn' } });
console.log('(b) node src/commands/summarize.mjs exit', r.code, '| elsewhere exists:', await fs.stat(S + '/wd/elsewhere').then(() => true, () => false), '| ./output/reports/summary.json rewritten:', (await fs.stat(S + '/wd/output/reports/summary.json')).mtimeMs > before);
// (c) space-in-path copy of the toolkit: standalone runner
const C = S + '/repo copy';
await fs.rm(C, { recursive: true, force: true });
await fs.mkdir(C);
for (const d of ['src', 'bin', 'schemas', 'configs']) await fs.cp(R + '/' + d, C + '/' + d, { recursive: true });
await fs.copyFile(R + '/package.json', C + '/package.json');
await fs.symlink(R + '/node_modules', C + '/node_modules');
const before2 = (await fs.stat(S + '/wd/output/reports/summary.json')).mtimeMs;
r = await run('node', [C + '/src/commands/summarize.mjs', '--config', cfg], { cwd: S + '/wd' });
console.log('(c) space-path standalone summarize exit', r.code, 'stdout+stderr bytes', (r.out + r.err).length, '| summary.json rewritten:', (await fs.stat(S + '/wd/output/reports/summary.json')).mtimeMs > before2);
r = await run('node', [C + '/bin/wcag-em.mjs', 'summarize', '--config', cfg, '--out-dir', S + '/wd/output', '--quiet'], { cwd: S + '/wd' });
console.log('(c2) space-path CLI summarize exit', r.code);
// (d) npm run audit -- --config <cfg> in a no-space copy WITHOUT configs/example-site.json
const D = S + '/repocopy';
await fs.rm(D, { recursive: true, force: true });
await fs.cp(C, D, { recursive: true, verbatimSymlinks: true });
await fs.rm(D + '/configs/example-site.json');
r = await run('npm', ['run', 'audit', '--', '--config', cfg], { cwd: D });
console.log('(d) npm run audit exit', r.code);
console.log((r.out + r.err).split('\n').filter(l => /^>|ENOENT|example-site|Error/.test(l)).slice(0, 8).join('\n'));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node e2.mjs
````

Output (truncated):

````text
(a) wcag-em summarize exit 2
(b) node src/commands/summarize.mjs exit 0 | elsewhere exists: false | ./output/reports/summary.json rewritten: true
(c) space-path standalone summarize exit 0 stdout+stderr bytes 0 | summary.json rewritten: false
(c2) space-path CLI summarize exit 2
(d) npm run audit exit 1
> wcag-em-a11y-toolkit@1.1.0 audit
> node src/commands/discover.mjs && node src/commands/sample.mjs && node src/commands/scan.mjs && node src/commands/scan-processes.mjs && node src/commands/summarize.mjs --config $SCRATCH/wf2/ops/cfg-base.json
Error: ENOENT: no such file or directory, open '$SCRATCH/wf2/ops/repocopy/configs/example-site.json'
  code: 'ENOENT',
  path: '$SCRATCH/wf2/ops/repocopy/configs/example-site.json'
````

## 62. Bash

````bash
cd $SCRATCH/wf2/ops && cat > e5.mjs <<'EOF'
import fs from 'node:fs/promises';
import { R, S, BIN, run } from './lib.mjs';
const base = JSON.parse(await fs.readFile(S + '/cfg-base.json', 'utf8'));
const W = S + '/e5'; await fs.rm(W, { recursive: true, force: true }); await fs.mkdir(W);
const clone = () => structuredClone(base);
async function tryCfg(label, cfgObj, cmd = 'sample', raw) {
  const p = `${W}/${label}.json`;
  await fs.writeFile(p, raw ?? JSON.stringify(cfgObj, null, 2));
  const out = `${W}/out-${label}`;
  await fs.cp(S + '/e1', out, { recursive: true });
  const r = await run('node', [BIN, cmd, '--config', p, '--out-dir', out, '--quiet'], { cwd: W });
  const txt = (r.err + r.out).replace(/\x1b\[[0-9;]*m/g, '');
  console.log(`\n### ${label}: ${cmd} exit=${r.code}\n` + txt.split('\n').slice(0, 14).join('\n').slice(0, 1400));
  return { r, out };
}
// a. typo'd key
let c = clone(); c.crawl.maxPage = 5; await tryCfg('typo-key', c);
// b. failOnFindings: null  -> summarize
c = clone(); c.reporting.failOnFindings = null; await tryCfg('fof-null', c, 'summarize');
// b2. same but threshold 0 (documented off switch) for contrast
c = clone(); c.reporting.failOnFindings.threshold = 0; await tryCfg('fof-zero', c, 'summarize');
// c. withTags null
c = clone(); c.scan.axe.withTags = null; await tryCfg('withtags-null', c);
// d. minimal {name, rootUrl}
await tryCfg('minimal-2keys', { name: 'x', rootUrl: base.rootUrl });
// e. rootUrl non-http
c = clone(); c.rootUrl = 'ftp://example.invalid/'; await tryCfg('ftp-root', c);
// f. BOM
await tryCfg('bom', null, 'sample', '﻿' + JSON.stringify(base));
// g. syntax error
await tryCfg('syntax', null, 'sample', JSON.stringify(base).slice(0, -2));
// j. screenshotQuality 0
c = clone(); c.reporting.screenshotFormat = 'jpeg'; c.reporting.screenshotQuality = 0; await tryCfg('quality0', c);
// schema-level check of nulls without DEFAULTS merge
const { validateConfig } = await import(R + '/src/lib/validate-config.mjs');
for (const [label, mut] of [['fof-null', (x) => { x.reporting.failOnFindings = null; }], ['withtags-null', (x) => { x.scan.axe.withTags = null; }]]) {
  const x = clone(); mut(x); const v = await validateConfig(x); console.log(`\nraw-schema ${label}: valid=${v.valid}`, v.valid ? '' : (v.errors ?? []).map(e => e.instancePath + ' ' + e.message).join('; '));
}
// h. no --config, cwd without configs/
let r = await run('node', [BIN, 'sample', '--out-dir', W + '/noconfig'], { cwd: W });
console.log('\n### no --config: exit', r.code, (r.err + r.out).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 500));
// i. bogus log level
r = await run('node', [BIN, 'sample', '--config', S + '/cfg-base.json', '--out-dir', W + '/ll', '--log-level', 'bogus'], { cwd: W });
console.log('\n### --log-level bogus: exit', r.code, (r.err + r.out).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 400));
// k. typo subcommand
r = await run('node', [BIN, 'scna', '--config', S + '/cfg-base.json'], { cwd: W });
console.log('\n### typo subcommand: exit', r.code, (r.err + r.out).slice(0, 300));
r = await run('node', [BIN], { cwd: W });
console.log('\n### no subcommand: exit', r.code, (r.err + r.out).slice(0, 200));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node e5.mjs
````

Output (truncated):

````text
### typo-key: sample exit=1
Config validation failed: $SCRATCH/wf2/ops/e5/typo-key.json
ADDTIONAL PROPERTY must NOT have additional properties

  30 |       "\\.(sqlite|db)$"
  31 |     ],
> 32 |     "maxPage": 5
     |     ^^^^^^^^^ 😲  maxPage is not expected to be here!
  33 |   },
  34 |   "discovery": {
  35 |     "captureH1": true,


### fof-null: summarize exit=2


### fof-zero: summarize exit=0


### withtags-null: sample exit=0


### minimal-2keys: sample exit=0


### ftp-root: sample exit=1
Config validation failed: $SCRATCH/wf2/ops/e5/ftp-root.json
PATTERN must match pattern "^https?://"

  118 |   "processes": [],
  119 |   "name": "e2e-fixture-site",
> 120 |   "rootUrl": "ftp://example.invalid/"
      |              ^^^^^^^^^^^^^^^^^^^^^^^^ 👈🏽  pattern must match pattern "^http ...
````

## 63. Bash

````bash
cd $SCRATCH/wf2/ops && cat > e6.mjs <<'EOF'
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { R, S, BIN, run } from './lib.mjs';
const { startFixtureServer } = await import(R + '/test/fixtures/server.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function descendants(pid) {
  const out = []; const q = [pid];
  while (q.length) { const p = q.shift(); let kids = []; try { kids = execSync(`pgrep -P ${p}`).toString().trim().split('\n').filter(Boolean).map(Number); } catch {} for (const k of kids) { out.push(k); q.push(k); } }
  return out;
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
function cmdline(pid) { try { return execSync(`ps -o command= -p ${pid}`).toString(); } catch { return ''; } }
const srv = await startFixtureServer({ staticDir: R + '/test/fixtures/static-site', slowMs: 45000, routes: { '/crawlroot': (req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html lang="en"><title>r</title><main><a href="/slow">slow</a></main></html>'); } } });
const results = [];
try {
  const base = JSON.parse(await fs.readFile(S + '/cfg-base.json', 'utf8'));
  const cfg = structuredClone(base);
  cfg.rootUrl = srv.baseUrl + '/'; cfg.sample.structuredManual = [srv.baseUrl + '/slow'];
  cfg.scan.timeoutMs = 90000; cfg.crawl.sitemapSeeding.enabled = false; cfg.crawl.maxPages = 3;
  await fs.writeFile(S + '/cfg-sig.json', JSON.stringify(cfg));
  const dcfg = structuredClone(cfg); dcfg.rootUrl = srv.baseUrl + '/crawlroot'; dcfg.crawl.requestTimeoutSecs = 120; dcfg.crawl.navigationTimeoutSecs = 90;
  await fs.writeFile(S + '/cfg-sig-disc.json', JSON.stringify(dcfg));
  const OUT = S + '/e6'; await fs.rm(OUT, { recursive: true, force: true });
  let r = await run('node', [BIN, 'discover', '--config', S + '/cfg-sig.json', '--out-dir', OUT, '--quiet']);
  r = await run('node', [BIN, 'sample', '--config', S + '/cfg-sig.json', '--out-dir', OUT, '--quiet']);
  console.log('prep sample exit', r.code, JSON.parse(await fs.readFile(OUT + '/sample.json', 'utf8')).length ?? '');
  for (const [label, sub, cfgPath, sig, group] of [
    ['scan SIGINT->node pid', 'scan', S + '/cfg-sig.json', 'SIGINT', false],
    ['scan SIGINT->process group (Ctrl-C)', 'scan', S + '/cfg-sig.json', 'SIGINT', true],
    ['scan SIGTERM->node pid', 'scan', S + '/cfg-sig.json', 'SIGTERM', false],
    ['discover SIGINT->node pid', 'discover', S + '/cfg-sig-disc.json', 'SIGINT', false],
  ]) {
    let child; const p = run('node', [BIN, sub, '--config', cfgPath, '--out-dir', OUT + '-' + sub, '--quiet'], { detached: true, onSpawn: (c) => (child = c), timeoutMs: 120000 });
    let desc = []; const t0 = Date.now();
    while (Date.now() - t0 < 40000) { await sleep(1000); desc = descendants(child.pid); if (desc.some((d) => /chrom|headless_shell/i.test(cmdline(d)))) break; }
    await sleep(4000); desc = descendants(child.pid);
    const chromes = desc.filter((d) => /chrom|headless_shell/i.test(cmdline(d)));
    const udd = [...new Set(chromes.map((d) => (cmdline(d).match(/--user-data-dir=(\S+)/) || [])[1]).filter(Boolean))];
    const tsig = Date.now();
    process.kill(group ? -child.pid : child.pid, sig);
    const res = await p; await sleep(3000);
    const survivors = desc.filter(alive);
    const dirsLeft = []; for (const d of udd) if (await fs.stat(d).then(() => true, () => false)) dirsLeft.push(d);
    const line = { label, exit: res.code, signal: res.signal, secsToExit: ((Date.now() - tsig) / 1000 - 3).toFixed(1), descendantsBefore: desc.length, chromeProcsBefore: chromes.length, survivors: survivors.length, survivorCmds: survivors.map((s) => cmdline(s).slice(0, 80)), userDataDirs: udd.length, userDataDirsLeft: dirsLeft.length, stderr: res.err.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 160), resultsWritten: await fs.readdir(OUT + '-' + sub + '/results').catch(() => 'n/a') };
    console.log(JSON.stringify(line));
    for (const s of survivors) { try { process.kill(s, 'SIGKILL'); } catch {} }
    results.push(line);
  }
} finally { await srv.stop(); }
await fs.writeFile(S + '/e6-results.json', JSON.stringify(results, null, 2));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node e6.mjs
````

Output (truncated):

````text
Exit code 1
prep sample exit 0 4
node:internal/process/per_thread:225
      throw new ErrnoException(err, 'kill');
            ^

Error: kill ESRCH
    at process.kill (node:internal/process/per_thread:225:13)
    at file://$SCRATCH/wf2/ops/e6.mjs:40:13 {
  errno: -3,
  code: 'ESRCH',
  syscall: 'kill'
}

Node.js v22.14.0
````

## 64. Bash

````bash
ps -axo pid,ppid,command | grep -E "cfg-sig|e6-scan|e6-discover" | grep -v grep | cut -c1-200; S=$SCRATCH/wf2/ops; cat $S/e6/sample.json | head -c 600; ls $S/e6-scan 2>/dev/null; ls $S/e6-scan/results 2>/dev/null
````

Output (truncated):

````text
[
  "http://127.0.0.1:55500/slow",
  "http://127.0.0.1:55500/",
  "http://127.0.0.1:55500/contact.html",
  "http://127.0.0.1:55500/about.html"
]
inventory
reports
results
screenshots
````

## 65. Bash

````bash
cd $SCRATCH/wf2/ops && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && rm -rf e6-empty && CRAWLEE_STORAGE_DIR=$PWD/crawlee-storage node $REPO/bin/wcag-em.mjs scan --config cfg-sig.json --out-dir e6-empty 2>&1 | cut -c1-300; echo "exit=${pipestatus[1]}"; ls e6-empty/results; grep -n "sampleJsonPath" $REPO/src/commands/scan.mjs $REPO/src/commands/summarize.mjs
````

Output (truncated):

````text
{"level":50,"time":"2026-09-30T18:41:54.292Z","pid":55902,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","err":{"type":"Object","message":"ENOENT: no such file or directory, open '$TMP
exit=1
$REPO/src/commands/scan.mjs:176:  const sampleUrls = JSON.parse(await fs.readFile(paths.sampleJsonPath, 'utf8'));
````

## 66. Bash

````bash
cd $SCRATCH/wf2/ops && python3 - <<'EOF'
p='e6.mjs'; s=open(p).read()
s=s.replace("    let child; const p = run(", "    await fs.rm(OUT + '-' + sub, { recursive: true, force: true }); if (sub === 'scan') await fs.cp(OUT, OUT + '-' + sub, { recursive: true });\n    let child; const p = run(")
s=s.replace("process.kill(group ? -child.pid : child.pid, sig);", "try { process.kill(group ? -child.pid : child.pid, sig); } catch (e) { console.log('process already gone before signal', label); }")
open(p,'w').write(s)
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node e6.mjs
````

Output (truncated):

````text
prep sample exit 0 4
{"label":"scan SIGINT->node pid","exit":130,"signal":null,"secsToExit":"0.0","descendantsBefore":4,"chromeProcsBefore":4,"survivors":0,"survivorCmds":[],"userDataDirs":1,"userDataDirsLeft":0,"stderr":"\nwcag-em: SIGINT received — exiting\n","resultsWritten":[]}
{"label":"scan SIGINT->process group (Ctrl-C)","exit":130,"signal":null,"secsToExit":"0.0","descendantsBefore":4,"chromeProcsBefore":4,"survivors":0,"survivorCmds":[],"userDataDirs":1,"userDataDirsLeft":0,"stderr":"\nwcag-em: SIGINT received — exiting\n","resultsWritten":[]}
{"label":"scan SIGTERM->node pid","exit":143,"signal":null,"secsToExit":"0.0","descendantsBefore":4,"chromeProcsBefore":4,"survivors":0,"survivorCmds":[],"userDataDirs":1,"userDataDirsLeft":0,"stderr":"\nwcag-em: SIGTERM received — exiting\n ...
````

## 67. Bash

````bash
cd $REPO; sed -n 106,141p docs/guides/integrations.md
````

Output (truncated):

````text
gate as the portal export.

## 3. CI — failing builds on findings

The pieces: `reporting.failOnFindings` controls the exit code (`2` when
finding GROUPS — unique rules — at the configured impacts reach the
threshold), and `reports/junit.xml` gives the CI system per-finding test
cases: violations as `<failure>`, needs-review items as
`<failure type="incomplete">` (ambiguity fails CI on purpose — triage it),
and execution failures as `<error type="scan-failure">` test cases so a page
that never scanned reads as an error, not a pass.

Minimal GitHub Actions job:

```yaml
a11y-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v5
      with: { node-version: 22 }
    - run: npm ci
    - run: npx playwright install chromium
    - run: npx wca ...
````

## 68. Bash

````bash
cd $REPO/docs/adr; grep -n -i "exit\|npm run\|script\|standalone\|coverage\|telemetry\|--from\|resume\|env\b\|WCAG_EM" 0001-project-conventions.md 0003-commander-cli.md 0014-packaging-decisions.md 0011-v1-release-boundary.md 0010-project-layout.md | cut -c1-230
````

Output (truncated):

````text
0003-commander-cli.md:9:The v0.3 toolkit had five top-level Node scripts driven by npm-script entries,
0003-commander-cli.md:12:Users relied on remembering `npm run discover -- --config foo.json`.
0003-commander-cli.md:14:A best-in-class CLI has one binary, one `--help`, subcommands, and exit codes
0003-commander-cli.md:31:Exit codes (Pa11y-compatible):
0003-commander-cli.md:36:  lands in WCAG-EM summary**; v0.3 only exits 0 or 1.
0003-commander-cli.md:43:- The npm scripts in `package.json` (`npm run discover` etc.) still work but
0003-commander-cli.md:60:- Pa11y exit-code convention:
0003-commander-cli.md:61:  <https://github.com/pa11y/pa11y/blob/HEAD/API.md#exit-codes>
0011-v1-release-boundary.md:28:| **CLI**               | `bin/wcag-em.mjs` with six subcommands (`discover`, `sample`, ` ...
````

## 69. Bash

````bash
cd $REPO/docs/adr; sed -n 28,50p 0003-commander-cli.md; sed -n 45,60p 0001-project-conventions.md; sed -n 78,95p 0001-project-conventions.md; sed -n 44,52p 0011-v1-release-boundary.md
````

Output (truncated):

````text
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
  is supported, unstable until v2.0 per AD ...
````

## 70. Bash

````bash
cd $REPO; grep -rn "process.stdout\|console.log" src bin | grep -v "^\s*\*" | cut -c1-160 | head; sed -n 55,62p docs/adr/0001-project-conventions.md
````

Output (truncated):

````text
src/lib/logger.mjs:11: * NOTE: findings summaries are written to stdout via `process.stdout.write`;
  installed, output dir writable); preflight failure exits `1` with a clear message.

### Logging

- Pino 9 via `src/lib/logger.mjs`; `pino-pretty` when TTY, JSON when piped.
- Findings summary is printed to **stdout**; operational events (progress, errors,
  warnings) go to **stderr** — Unix convention.
- Redact list applied to every logger instance: `Authorization`, `Cookie`, `Set-Cookie`,
````

## 71. Bash

````bash
cd $SCRATCH/review; grep -o -i "[^.]*stdout[^.]*\." round1-findings.json | head -5; grep -o -i "[^.]*npm run[^.]*\." round1-findings.json | head -5; grep -o -i "[^.]*standalone runner[^.]*\." round1-findings.json | head; grep -o "[^.]*SIGINT[^.]*\." round1-findings.json | head -3; grep -o "[^.]*deepMerge[^.]*null[^.]*\." round1-findings.json | head -3; grep -o "[^.]*BOM[^.]*\." round1-findings.json | head -3; grep -c "" round1-experiments.json; grep -o '"what": *"[^"]*"' round1-experiments.json | cut -c1-150 | head -80
````

Output (truncated):

````text
mjs (`npm run spike`) unconditionally regenerates and overwrites .
    "excerpt": "npm run self-test -- --key .
872
"what": "Probed axe.getRules() for SC tags, experimental/deprecated rules, best-practice+SC overlap, and ACT IDs compared with act-rule-map.json"
"what": "Full CLI audit against my own localhost fixture with known axe-undetectable defects (lang=fr on English text, alt=filename, 'click here' link
"what": "Effect of wcagVersion and conformanceTarget on the SC set"
"what": "ACT map loading from an install path containing a space"
"what": "automatedCoverage with a redirect-duplicate page-view"
"what": "automatedCoverage with a degraded viewport, and pagesExamined with process states"
"what": "Audit with failing processes (click on a missing selector; goto to a 404 then a click)"
 ...
````

## 72. Bash

````bash
cd $REPO; sed -n 1,43p src/lib/engine-check.mjs | grep -v "^ \*\|^/\*\*\|^ \*/"; grep -rn "engine-check\|meetsEngine\|checkEngine" src bin test --include='*.mjs' 2>/dev/null | cut -c1-140 | head -5; sed -n 1,60p src/lib/version.mjs | grep -v "^ \*" | head -40
````

Output (truncated):

````text
// @ts-check

// SECTION: Constants

// ANCHOR: MIN_MAJOR / MIN_MINOR — must match `bin/wcag-em.mjs` inline check
const MIN_MAJOR = 22;
const MIN_MINOR = 11;

// SECTION: Public API

export function isNodeVersionSupported(versionString = process.versions.node) {
  const cleaned = versionString.startsWith('v') ? versionString.slice(1) : versionString;
  const [majorStr, minorStr] = cleaned.split('.');
  const major = Number(majorStr);
  const minor = Number(minorStr);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  if (major > MIN_MAJOR) return true;
  if (major === MIN_MAJOR && minor >= MIN_MINOR) return true;
  return false;
}
src/lib/engine-check.mjs:4: * @module lib/engine-check
bin/wcag-em.mjs:25:// LINK: src/lib/engine-check.mjs mirrors this predicate for uni ...
````

## 73. Bash

````bash
cd $REPO; cat .gitignore; ls; ls logs output 2>/dev/null | head
````

Output (truncated):

````text
node_modules/

# Husky v9 runtime shim — regenerated by `prepare: "husky"` on npm install.
.husky/_/

# Runtime artefacts
output/
storage/
logs/
.auth/
sample.json

# Tooling / IDE
coverage/
*.tsbuildinfo
.DS_Store
.idea/
.claude/

# Test scratch
test/.tmp/

# Web Bot Auth spike private key material (belt-and-suspenders — the spike's own
# spikes/web-bot-auth/.gitignore is the primary guard, written before any keygen).
spikes/web-bot-auth/.keys/

# Local-only, per-engagement audit configs. The committed configs are the
# example-*.json templates + legacy-events.json; anything else under configs/ is a
# local audit instance and is kept out of git by convention.
configs/*.json
!configs/example-*.json
!configs/legacy-events.json

# Local operational run helpers (per-engagement; not committed) ...
````

## 74. Bash

````bash
cd $REPO; ls -la output output/* | head -30; grep -rln "buildContext(" test | head; grep -rn "buildContext({" test | grep -v outDir | cut -c1-160 | head
````

Output (truncated):

````text
output:
total 0
drwxr-xr-x@  6 $USER  staff   192 Sep 30 19:32 .
drwxr-xr-x@ 32 $USER  staff  1024 Sep 30 11:50 ..
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50 inventory
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50 reports
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50 results
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50 screenshots

output/inventory:
total 0
drwxr-xr-x@ 3 $USER  staff   96 Sep 30 11:50 .
drwxr-xr-x@ 6 $USER  staff  192 Sep 30 19:32 ..
-rw-r--r--@ 1 $USER  staff    0 Sep 30 11:50 .gitkeep

output/reports:
total 0
drwxr-xr-x@ 3 $USER  staff   96 Sep 30 11:50 .
drwxr-xr-x@ 6 $USER  staff  192 Sep 30 19:32 ..
-rw-r--r--@ 1 $USER  staff    0 Sep 30 11:50 .gitkeep

output/results:
total 0
drwxr-xr-x@ 3 $USER  staff   96 Sep 30 11:50 .
drwxr-xr-x@ 6 $USER  staff  192 Sep 3 ...
````

## 75. Bash

````bash
cd $SCRATCH/wf2/ops && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node --input-type=module -e "
const R='$REPO';
const api = await import(R+'/src/index.mjs');
const v = await api.validateConfig({ name: 'x', rootUrl: 'https://example.invalid/' });
console.log('public validateConfig on 2-key config (CLI accepts it): valid=', v.valid, (v.errors||[]).map(e=>e.instancePath+' '+e.message).join('; '));
const s = JSON.parse(require('fs').readFileSync(R+'/schemas/config.schema.json','utf8'));
" 2>&1 | head -5; node --input-type=module -e "
import fs from 'node:fs';
const R='$REPO';
const api = await import(R+'/src/index.mjs');
const v = await api.validateConfig({ name: 'x', rootUrl: 'https://example.invalid/' });
console.log('public validateConfig on 2-key config (CLI accepts it): valid=', v.valid, '|', (v.errors||[]).map(e=>(e.instancePath||'/')+' '+e.message).join('; '));
const s = JSON.parse(fs.readFileSync(R+'/schemas/config.schema.json','utf8'));
console.log('schema required:', s.required);
import path from 'node:path';
console.log('win32 act-map path:', path.win32.resolve('C:\\\\work', new URL('../data/act-rule-map.json', 'file:///C:/work/toolkit/src/commands/summarize.mjs').pathname));
console.log('win32 standalone guard:', 'file:///C:/work/toolkit/src/commands/discover.mjs' === 'file://' + 'C:\\\\work\\\\toolkit\\\\src\\\\commands\\\\discover.mjs');
"
````

Output (truncated):

````text
public validateConfig on 2-key config (CLI accepts it): valid= false  must have required property 'scope';  must have required property 'crawl';  must have required property 'sample';  must have required property 'scan'
file://$SCRATCH/wf2/ops/[eval1]:6
const s = JSON.parse(require('fs').readFileSync(R+'/schemas/config.schema.json','utf8'));
               ^

public validateConfig on 2-key config (CLI accepts it): valid= false | / must have required property 'scope'; / must have required property 'crawl'; / must have required property 'sample'; / must have required property 'scan'
schema required: [ 'name', 'rootUrl', 'scope', 'crawl', 'sample', 'scan' ]
win32 act-map path: C:\C:\work\toolkit\src\data\act-rule-map.json
win32 standalone guard: false
````

## 76. Bash

````bash
cd $REPO; grep -rn "setupScript" src/lib/auth.mjs | head -5; grep -n "deferralLayer:" -r src | head; node -e "const s=require('./schemas/config.schema.json'); console.log(JSON.stringify(s.\$defs.action.properties.action))"; ls test/unit | grep -i "docs\|configs-valid"; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && timeout 30 npm view wcag-em-a11y-toolkit name version dist-tags --json 2>&1 | head -20
````

Output (truncated):

````text
src/lib/auth.mjs:14: * `auth.setupScript` is schema-validated but runtime execution is
src/lib/auth.mjs:120:  if (typeof auth.setupScript === 'string' && auth.setupScript.length > 0) {
src/lib/auth.mjs:121:    warnings.push(buildWarnSchemaAcceptedMessage('auth.setupScript', 'a future release'));
src/lib/auth.mjs:130: * by `applyAuth` for `setupScript` and by `summarize.mjs` for
src/lib/auth.mjs:134: * @param {{ feature: string, deferralLayer: string }} args
{"enum":["goto","click","fill","press","waitFor","screenshot","axe"]}
configs-valid.test.mjs
docs-config-coverage.test.mjs
(eval):1: command not found: timeout
````

## 77. Bash

````bash
cd $SCRATCH/wf2/ops && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && npm view wcag-em-a11y-toolkit name version --json 2>&1 | head -12; echo "rc=$?"; npm view wcag-em name version --json 2>&1 | head -6
````

Output (truncated):

````text
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/wcag-em-a11y-toolkit - Not found
npm error 404
npm error 404  'wcag-em-a11y-toolkit@*' is not in this registry.
npm error 404
npm error 404 Note that you can also install from a
npm error 404 tarball, folder, http url, or git url.
{
  "error": {
    "code": "E404",
    "summary": "Not Found - GET https://registry.npmjs.org/wcag-em-a11y-toolkit - Not found",
    "detail": "'wcag-em-a11y-toolkit@*' is not in this registry.\n\nNote that you can also install from a\ntarball, folder, http url, or git url."
rc=0
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/wcag-em - Not found
npm error 404
npm error 404  'wcag-em@*' is not in this registry.
npm error 404
npm error 404 Note that you can al ...
````

## 78. Bash

````bash
cd $SCRATCH/wf2/ops/repocopy && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && npm --version && npm exec --no -- wcag-em --version 2>&1 | head -5; echo "rc=$?"; mkdir -p ../consumer && cd ../consumer && echo '{"name":"consumer","version":"1.0.0"}' > package.json && npm exec --no -- wcag-em --version 2>&1 | head -5
````

Output (truncated):

````text
10.9.2
1.1.0
rc=0
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/wcag-em - Not found
npm error 404
npm error 404  'wcag-em@*' is not in this registry.
npm error 404
````

## 79. Bash

````bash
cd $REPO; grep -n "viewport\b\|legacy\|deprecat" src/lib/viewports.mjs | head -12; grep -n '"viewport"' -A4 schemas/config.schema.json | head -8; grep -rn "includeSubdomains" src schemas | cut -c1-160
````

Output (truncated):

````text
3: * @file Viewport resolution for multi-viewport scans.
9: * agree on the "defaults ∨ legacy-singleton ∨ user-array" precedence. Future
10: * changes to viewport defaults (e.g. a future version's opt-in tablet / mobile)
15: *   2. `config.scan.viewport` — legacy singleton wrapped as
16: *      `[{ id: 'legacy', ...viewport }]` with a deprecation warn.
19: * @see docs/adr/0006-multi-viewport-axe-runs.md
44: * Resolve the viewport list for a scan.
49: * @param {{ scan?: { viewports?: Viewport[], viewport?: { width?: number, height?: number } } }} config
51: *   - Optional pino-compatible logger. When present and the legacy-singleton
52: *     path is taken, a single deprecation warn is emitted.
69:  if (scan.viewport && typeof scan.viewport === 'object') {
70:    const { width, height } = s ...
````

## 80. Bash

````bash
cd $REPO; sed -n 308,325p src/commands/scan.mjs; sed -n 372,376p src/commands/scan.mjs; grep -n '"fullPageScreenshots"' -A3 schemas/config.schema.json
````

Output (truncated):

````text
    const screenshotPath = buildScreenshotPath(
      paths.screenshotsDir,
      url,
      viewport,
      screenshotFormat,
    );
    if (config.scan.fullPageScreenshots !== false) {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: screenshotFormat,
        ...(screenshotFormat === 'jpeg' ? { quality: screenshotQuality } : {}),
      });
    }

    // ANCHOR: AxeBuilderChain — apply config.scan.axe settings.
    // Per-URL overrides land here: find the first matching override by
    // compiled regex (first-match-wins per Pa11y precedent), then merge
      title: await page.title().catch(() => ''),
      finalUrl,
      screenshot: config.scan.fullPageScreenshots !== false ? screenshotPath : null,
      violations: axeResults.violations, ...
````

## 81. Bash

````bash
cd $REPO/docs/adr; grep -n "^## \|^### \|files\|exports\|docs/\|publish\|npm i\|install" 0014-packaging-decisions.md | cut -c1-200 | head -40
````

Output (truncated):

````text
8:  from exports), ADR-0011 (v1.0 release boundary — stability tiers)
10:## Context and Problem Statement
12:Before the first `npm publish`, four `package.json` decisions need to
18:2. **Exports.** The current `exports` map exposes `./commands/*` and
23:3. **Files.** No `files` field exists; npm falls back to `.gitignore`
26:4. **Private flag.** `"private": true` blocks `npm publish` entirely.
30:`package.json`), and the exports change implements the stability tiers
33:## Decision
35:### 1. Rename to `wcag-em-a11y-toolkit`
50:### 2. Narrow exports to root only
54:"exports": {
61:"exports": {
69:**Internal imports are unaffected.** All `src/` and `test/` files use
73:does not traverse the exports map.
75:### 3. Add explicit `files` whitelist
78:"files": [
89:This excludes `test/`, `docs/`,  ...
````

## 82. Bash

````bash
cd $REPO; sed -n 1,20p configs/legacy-events.json; sed -n 70,95p configs/legacy-events.json; grep -n "legacy-events" CHANGELOG.md docs/guides/*.md | head
````

Output (truncated):

````text
{
  "name": "legacy-events",
  "rootUrl": "https://legacy-events.com/",
  "scope": {
    "mode": "same-hostname",
    "allowedHosts": []
  },
  "crawl": {
    "maxPages": 80,
    "maxConcurrency": 5,
    "requestTimeoutSecs": 90,
    "requestDelayMs": 500,
    "excludeUrlPatterns": ["/wp-admin", "\\?replytocom=", "/feed/?$"],
    "sitemapSeeding": {
      "enabled": true,
      "urls": [],
      "commonPaths": ["/sitemap.xml", "/sitemap_index.xml"],
      "maxUrls": 500
    }
  },
      "runOnly": null
    }
  },
  "processes": [
    {
      "name": "contact-blank-submit",
      "startUrl": "https://legacy-events.com/contact-us/",
      "pattern": "blank-submit",
      "forceInclude": true,
      "selectors": {
        "submit": "button[type='submit'], input[type='submit']"
      }
    }
  ...
````

## 83. Bash

````bash
cd $REPO; sed -n 1,40p scripts/refresh-rule-maps.mjs; grep -n "writeFile\|argv\|--write\|dry" scripts/refresh-rule-maps.mjs; grep -rn "refresh-rule-maps" --exclude-dir=node_modules . | grep -v "^./scripts" | cut -c1-160
````

Output (truncated):

````text
// @ts-check
/**
 * @file Dev utility that regenerates `src/data/act-rule-map.json`.
 * @module scripts/refresh-rule-maps
 *
 * @description
 * Reads the installed `@axe-core/playwright` package version, fetches the
 * W3C ACT Rules CG implementation report, and rewrites the static
 * `src/data/act-rule-map.json` with a fresh `_meta.generatedAt` + the
 * current axe-core version pin.
 *
 * NOT shipped in `bin/` — developer tooling only. Run manually whenever
 * `package-lock.json`'s `@axe-core/playwright` entry changes.
 *
 * The implementation report is HTML, not JSON, so this script parses the
 * document structure. If the ACT Rules CG changes their page layout, the
 * parser here breaks visibly (a clear error rather than silent drift).
 *
 * @see https://act-rules.github.io/implementati ...
````

## 84. Bash

````bash
cd $REPO; sed -n 60,160p scripts/refresh-rule-maps.mjs | grep -v "^\s*//" | head -80; sed -n 20,40p src/data/README.md
````

Output (truncated):

````text
  }
  const html = await res.text();

  const parsed = parseImplementationReport(html);
  if (parsed.length === 0) {
    throw new Error(
      'ACT implementation report parser produced zero entries; page layout likely changed. ' +
        'Update this script or seed manually.',
    );
  }

  const byAxeRule = invertToAxeIndex(parsed);
  const map = {
    _meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      axeCoreVersion: axeVersion,
      source: REPORT_URL,
      coverage: parsed.length < 50 ? 'partial' : 'full',
      ruleCount: parsed.length,
      note:
        `Regenerated from ${REPORT_URL}. Expanding to full coverage is tracked as a Layer 3b ` +
        `follow-up in CHANGELOG.md [Unreleased].`,
    },
    ...byAxeRule,
  };

  await fs.writeFile(MAP_PATH, JSO ...
````

## 85. Bash

````bash
cd $REPO; sed -n 80,100p src/lib/browser.mjs; grep -rn "process.env\.\|process.env\[" src bin | grep -v "^\s*\*" | cut -c1-150
````

Output (truncated):

````text
 */
export function resolveTransport(config = {}, env = {}) {
  const browserCfg = config?.scan?.browser ?? {};
  const engine = browserCfg.engine === 'patchright' ? 'patchright' : 'playwright';
  /** @type {string[]} */
  const warnings = [];

  const envRaw = env.WCAG_EM_CDP_ENDPOINT;
  const envEndpoint = typeof envRaw === 'string' && envRaw.trim() ? envRaw.trim() : '';
  const cfgEndpoint =
    typeof browserCfg.cdpEndpoint === 'string' ? browserCfg.cdpEndpoint.trim() : '';
  const cdpEndpoint = envEndpoint || cfgEndpoint;

  if (cdpEndpoint) {
    if (envEndpoint && cfgEndpoint && envEndpoint !== cfgEndpoint) {
      warnings.push('WCAG_EM_CDP_ENDPOINT overrides scan.browser.cdpEndpoint for this run.');
    }
    if (config?.auth) {
      warnings.push(
        'config.auth is ignored ...
````

## 86. Bash

````bash
cd $REPO; sed -n 1,80p test/unit/docs-config-coverage.test.mjs | grep -v "^ \*\|^/\*\*" | head -60
````

Output (truncated):

````text
// @ts-check

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// SECTION: Exceptions (empty by design; register deliberate omissions here)

const DOCUMENTED_EXCEPTIONS = [];

// SECTION: Helpers (plain functions so the negative case below can drive them)

export function collectFieldNames(node, names = new Set()) {
  if (!node || typeof node !== 'object') return names;
  if (node.properties && typeof node.properties === 'object') {
    for (const [key, child] of Object.entries(node.properties)) {
      names.add(key);
      collectFieldNames(child, names);
    }
  }
  if (node.items) collectFieldNames(node.items, names);
  for (const branchKey of ['oneOf', 'anyOf']) {
    for (const branch of Array.isArray(n ...
````

## 87. Bash

````bash
cd $SCRATCH/review; grep -o '[^.]*README[^.]*75[^.]*\.' round1-findings.json | head; grep -o '[^."]*best-practice\\"\]\?[^.]*array[^.]*\.' round1-findings.json | head -3; grep -o '[^.]*wholesale[^.]*\.' round1-findings.json | head -5; grep -n "withTags" $REPO/configs/*.json
````

Output (truncated):

````text
$REPO/configs/example-site-best-practice.json:53:      "withTags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
$REPO/configs/example-site-with-auth.json:62:      "withTags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
$REPO/configs/example-site-with-processes.json:38:      "withTags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
$REPO/configs/example-site.json:53:      "withTags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
$REPO/configs/legacy-events.json:69:      "withTags": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
````

## 88. Bash

````bash
cd $SCRATCH/wf2/ops && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node --input-type=module -e "
import { createRequire } from 'node:module';
const require = createRequire('$REPO/node_modules/@axe-core/playwright/package.json');
const axe = require('axe-core');
const rules = axe.getRules();
const sel = (tags) => rules.filter(r => r.tags.some(t => tags.includes(t)) && !r.tags.includes('experimental') && !r.tags.includes('deprecated'));
const def = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
const a = sel([...def,'best-practice']), b = sel(['wcag2aa','best-practice']);
const lost = a.filter(r => !b.includes(r));
const lostWcag = lost.filter(r => r.tags.some(t=>/^wcag\d{3,4}$/.test(t)));
console.log('axe', axe.version, '| default+bp rules:', a.length, '| README example rules:', b.length, '| WCAG-mapped rules dropped:', lostWcag.length);
console.log('dropped sample:', lostWcag.slice(0,14).map(r=>r.ruleId+'('+r.tags.filter(t=>/^wcag\d/.test(t)).join(',')+')').join(' '));
"
````

Output (truncated):

````text
axe 4.11.3 | default+bp rules: 90 | README example rules: 31 | WCAG-mapped rules dropped: 59
dropped sample: area-alt(wcag2a,wcag244,wcag412) aria-allowed-attr(wcag2a,wcag412) aria-braille-equivalent(wcag2a,wcag412) aria-command-name(wcag2a,wcag412) aria-conditional-attr(wcag2a,wcag412) aria-deprecated-role(wcag2a,wcag412) aria-hidden-body(wcag2a,wcag131,wcag412) aria-hidden-focus(wcag2a,wcag412) aria-input-field-name(wcag2a,wcag412) aria-meter-name(wcag2a,wcag111) aria-progressbar-name(wcag2a,wcag111) aria-prohibited-attr(wcag2a,wcag412) aria-required-attr(wcag2a,wcag412) aria-required-children(wcag2a,wcag131)
````

## 89. Bash

````bash
cd $SCRATCH/wf2/ops && cat > e7.mjs <<'EOF'
import fs from 'node:fs/promises';
import { R, S, BIN, run } from './lib.mjs';
const { startFixtureServer } = await import(R + '/test/fixtures/server.mjs');
const srv = await startFixtureServer({ staticDir: R + '/test/fixtures/static-site' });
try {
  const tpl = await fs.readFile(R + '/test/fixtures/site.json.template', 'utf8');
  const out = {};
  for (const [label, tags] of [['default+bp', ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']], ['readme-example', ['wcag2aa', 'best-practice']]]) {
    const cfg = JSON.parse(tpl.replaceAll('__BASE_URL__', srv.baseUrl));
    cfg.scan.axe.withTags = tags; cfg.reporting.reporters = ['json', 'junit'];
    const p = `${S}/cfg-e7-${label}.json`; await fs.writeFile(p, JSON.stringify(cfg));
    const od = `${S}/e7-${label}`; await fs.rm(od, { recursive: true, force: true });
    const r = await run('node', [BIN, 'audit', '--config', p, '--out-dir', od, '--quiet']);
    const sum = JSON.parse(await fs.readFile(od + '/reports/summary.json', 'utf8'));
    const w = JSON.parse(await fs.readFile(od + '/reports/wcag-em-summary.json', 'utf8'));
    const co = w.criteriaOutcomes ?? w.criteria ?? [];
    const pick = (id) => { const x = (Array.isArray(co) ? co : Object.values(co)).find((c) => (c.sc ?? c.id ?? c.criterion) === id); return x ? (x.outcome ?? x.result) : 'absent'; };
    const failed = (Array.isArray(co) ? co : Object.values(co)).filter((c) => (c.outcome ?? c.result) === 'failed').map((c) => c.sc ?? c.id ?? c.criterion);
    out[label] = { exit: r.code, groupedFindings: sum.groupedFindingCount ?? sum.findings?.length, rules: (sum.findings ?? []).map((f) => f.ruleId ?? f.id).sort(), failedSCs: failed.sort(), sc111: pick('1.1.1'), sc412: pick('4.1.2'), sc131: pick('1.3.1'), automatedCoverage: w.automatedCoverage?.status };
  }
  console.log(JSON.stringify(out, null, 1));
  await fs.writeFile(S + '/e7-results.json', JSON.stringify(out, null, 2));
} finally { await srv.stop(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node e7.mjs
````

Output (truncated):

````text
{
 "default+bp": {
  "exit": 2,
  "groupedFindings": 5,
  "rules": [
   "color-contrast",
   "image-alt",
   "label",
   "landmark-no-duplicate-main",
   "landmark-unique"
  ],
  "failedSCs": [
   "1.1.1",
   "1.4.3",
   "4.1.2"
  ],
  "sc111": "failed",
  "sc412": "failed",
  "sc131": "passed",
  "automatedCoverage": "complete"
 },
 "readme-example": {
  "exit": 2,
  "groupedFindings": 3,
  "rules": [
   "color-contrast",
   "landmark-no-duplicate-main",
   "landmark-unique"
  ],
  "failedSCs": [
   "1.4.3"
  ],
  "sc111": "notTested",
  "sc412": "notTested",
  "sc131": "notTested",
  "automatedCoverage": "complete"
 }
}
````

## 90. Bash

````bash
cd $REPO; grep -n -i "replace\|wholesale\|merged underneath\|concat" docs/guides/config-guide.md README.md docs/guides/user-manual.md | cut -c1-200
````

Output (truncated):

````text
README.md:155:- it does **not** replace evaluator judgement in scope, sampling, or process identification
docs/guides/config-guide.md:47:`src/lib/config.mjs` `DEFAULTS` and are merged underneath your config before
docs/guides/config-guide.md:155:| `overrides` | none                                                   | Per-URL rule changes: array of `{ urlPattern, include?, exclude?, withRules?, withTags?, runOnl
docs/guides/config-guide.md:206:| Field                      | Replacement                                                               |
````

## 91. Bash

````bash
cd $REPO; git log --numstat --format='%h %s' -2 -- src/reporters/portal-export.mjs | head -6; grep -rn "validateExports" src/reporters/portal-export.mjs | wc -l; grep -a -n "validateExports" src/reporters/portal-export.mjs | head -3; git grep -n "validateExports" -- src/reporters/portal-export.mjs | head -2; LC_ALL=C grep -c "" src/reporters/portal-export.mjs; sed -n 300,306p src/reporters/portal-export.mjs | cat -v
````

Output (truncated):

````text
2b7ffab feat(summarize): consume pageOutcome at every raw-artefact site (E1 REMOVE)

9	1	src/reporters/portal-export.mjs
fad2270 feat(portal-export): scoreBasis, failure summaries, write-time validation

157	11	src/reporters/portal-export.mjs
       0
550:  const validateMode = ctx?.config?.reporting?.validateExports ?? 'warn';
562:        'portal-export: payload fails the vendored contract; writing anyway (reporting.validateExports=warn)',
src/reporters/portal-export.mjs:550:  const validateMode = ctx?.config?.reporting?.validateExports ?? 'warn';
src/reporters/portal-export.mjs:562:        'portal-export: payload fails the vendored contract; writing anyway (reporting.validateExports=warn)',
  for (const map of [violations, incompletes]) {
    for (const [id, rows] of map) {
      const s ...
````

## 92. Bash

````bash
cd $REPO/docs/adr; grep -n -i "default\|merge\|null\|after\|before" 0005-fail-fast-on-config.md 0002-config-is-ajv-validated.md | cut -c1-200 | head -20
````

Output (truncated):

````text
0005-fail-fast-on-config.md:28:detect before stage 1 must be detected before stage 1. Four layered
0005-fail-fast-on-config.md:36:`src/lib/context.mjs:buildContext` before any command's `run()` body
0005-fail-fast-on-config.md:65:lands (likely the pre-scan action filtering step's `beforeScan` action filtering).
0005-fail-fast-on-config.md:70:as a `RegExp[]` after Ajv passes. The attachment goes through the
0005-fail-fast-on-config.md:91:Runs inside `buildContext` before returning.
0005-fail-fast-on-config.md:115:  `ensurePreflight` is idempotent — the flag short-circuits after the
````

## 93. Bash

````bash
cd $REPO/docs/adr; sed -n 20,50p 0005-fail-fast-on-config.md
````

Output (truncated):

````text
compile-at-load today and which are only validated (subsequent work completes
the story). We want one coherent story — a principle, not a grab-bag of
checks — that future maintainers can extend in subsequent versions without
re-deciding the philosophy.

## Decision

**Fail fast on config.** Every configuration problem the toolkit can
detect before stage 1 must be detected before stage 1. Four layered
mechanisms, each catching a narrower class of error:

### 1. Ajv 2020 + better-ajv-errors (from ADR-0002)

Structural validation at config-load. Human-readable error output
includes the JSON pointer, received value, and closest matching schema
alternative. Runs in `src/lib/validate-config.mjs:assertValidConfig` via
`src/lib/context.mjs:buildContext` before any command's `run()` body
touches th ...
````

## 94. Bash

````bash
cd $REPO; grep -n '`withTags`' docs/guides/config-guide.md | cut -c1-140; grep -n "Six sections\|screenshotQuality\|fullPageScreenshots" docs/guides/config-guide.md | cut -c1-120; grep -n "stdout" docs/adr/0001-project-conventions.md src/lib/logger.mjs; grep -n "SIGINT" docs/adr/0001-project-conventions.md; grep -n "npm scripts\|commands/X" docs/adr/0003-commander-cli.md; grep -n "Deep imports" -A3 docs/adr/0011-v1-release-boundary.md; grep -n "artefact" docs/adr/0011-v1-release-boundary.md | head -3; grep -n "first post-v1.0\|Dependabot" docs/adr/0015-publish-and-deprecation-policy.md; grep -n "npx playwright install chromium" docs/guides/integrations.md
````

Output (truncated):

````text
153:| `withTags`  | `["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]` | The conformance rule profile. Add `"best-practice"` for client 
16:Six sections are required: `name`, `rootUrl`, `scope`, `crawl`, `sample`,
120:| `fullPageScreenshots` | `true`                            | Full-page PNG per page x viewport; embedded in the HTM
169:| `screenshotQuality`            | (jpeg only)            | 0-100 quality when `screenshotFormat` is jpeg.          
src/lib/logger.mjs:11: * NOTE: findings summaries are written to stdout via `process.stdout.write`;
docs/adr/0001-project-conventions.md:60:- Findings summary is printed to **stdout**; operational events (progress, errors,
90:- `SIGINT` / `SIGTERM` handlers close the Playwright browser and flush pino, exit `130`.
43:- The npm scripts in ` ...
````

## 95. Bash

````bash
cd $REPO; grep -n "sample.json\` lives\|samplePagesScanned\` redefined\|Breaking for diff\|now carry the final URL" CHANGELOG.md; grep -n "is deprecated and ignored" src/lib/auth.mjs; grep -n "findUndocumented\|backtick\|\`\${" test/unit/docs-config-coverage.test.mjs | head -5; sed -n 50,60p test/unit/docs-config-coverage.test.mjs
````

Output (truncated):

````text
17:  _Breaking for diff-based consumers:_ such pages drop out of findings and stop
47:  EARL `earl:subject` / JUnit case names) now carry the final URL.
171:- **`samplePagesScanned` redefined to PAGES** (unique pages with at least one
177:- **`sample.json` lives under the run's `--out-dir`** (previously resolved
155:    `${oldField} is deprecated and ignored; use ${newField} instead.${tail}`,
14: * contains (2026-06 docs-review pressure-test finding 2). The backtick
66: * Names from `fieldNames` that do NOT appear as a backticked token in
75:export function findUndocumented(fieldNames, guideText) {
89:test('config guide documents every schema field as a backticked token', async () => {
99:  const missing = findUndocumented(names, guide);
  if (node.items) collectFieldNames(node.items, name ...
````

## 96. Bash

````bash
ps -axo pid,ppid,command | grep -E "wf2/ops|cfg-e7|cfg-sig|cfg-base" | grep -v grep | cut -c1-160; echo "---"; ls $SCRATCH/wf2/ops; cd $REPO && git status --short | head
````

Output (truncated):

````text
---
cfg-base.json
cfg-e7-default+bp.json
cfg-e7-readme-example.json
cfg-sig-disc.json
cfg-sig.json
config.d.ts
consumer
crawlee-storage
e1
e1.mjs
e2.mjs
e5
e5.mjs
e6
e6-discover
e6-empty
e6-results.json
e6-scan
e6.mjs
e7-default+bp
e7-readme-example
e7-results.json
e7.mjs
gen.mjs
lib.mjs
links.mjs
pack.json
repo copy
repocopy
schema-keys.txt
wd
````
