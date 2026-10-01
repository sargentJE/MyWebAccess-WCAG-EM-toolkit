# Probe record: verify:B01

Role: packet verifier. Findings: OPS-01, E2E-02, OPS-04, OPS-05, OPS-06

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
R=$REPO; cd $R; sed -n 100,230p src/lib/config.mjs; echo ----; grep -n "withTags\|best-practice\|null" README.md docs/guides/config-guide.md | head -40
````

Output (truncated):

````text
  scan: {
    // Neither `viewports` nor `viewport` is shipped in DEFAULTS. Users who
    // want multi-viewport scans set `scan.viewports: [...]` explicitly; the
    // schema's `minItems: 1` rejects an empty-array opt-in, so there is no
    // meaningful sentinel to ship. When both are absent, `resolveViewports`
    // falls through to `DEFAULT_VIEWPORTS` (desktop + reflow).
    waitUntil: 'domcontentloaded',
    timeoutMs: 60000,
    retries: 1,
    fullPageScreenshots: true,
    // E1: challenge handling. Detection is always on (cf-mitigated authoritative
    // + the audited host's own host for the title+status heuristic); these only
    // tune the bounded wait and extra allowlisted hosts. wait defaults to 0
    // (opt-in) — the robust path is a WAF bypass header via auth.extraHTTPH ...
````

## 2. Bash

````bash
R=$REPO; cd $R; S=$SCRATCH/review; grep -E "^(VERD-07|PROC-03|SCAN-04|SEC-18|OPS|E2E)" $S/round1-index.txt; grep -iE "withTags|target-size|null|deepMerge|validateConfig|2\.5\.8" $S/round1-index.txt | head -30; echo ----; grep -rn "withTags\|AxeBuilder\|runOnly\|withRules" src --include=*.mjs | grep -v "^src/lib/config.mjs" | head -40
````

Output (truncated):

````text
VERD-07 | medium | new | correctness | Process-state axe runs ignore scan.axe (withTags/runOnly/withRules/include/exclude/overrides), so verdict inputs differ from the configured rule profile | src/lib/process-runner.mjs:350, src/commands/scan.mjs:353, src/commands/scan.mjs:357
PROC-03 | high | new | correctness | Process-state axe runs ignore scan.axe config (exclude/include/withTags/withRules/runOnly/overrides) and other scan setup (beforeScan, challenge wait, screenshotFormat) | src/lib/process-runner.mjs:350, src/commands/scan.mjs:354, src/commands/scan.mjs:348, src/commands/scan.mjs:192, docs/guides/config-guide.md:154
SEC-18 | low | new | dx | Preflight checks are partly unreachable or diverge from Playwright's own resolution | src/lib/context.mjs:171, src/lib/preflight.mjs:84, src/l ...
````

## 3. Bash

````bash
R=$REPO; cd $R; grep -rn "withTags\|AxeBuilder\|runOnly\|withRules" src | grep -v "^src/lib/config.mjs" | head -40; echo ---; sed -n 330,375p src/commands/scan.mjs; echo ---; sed -n 335,360p src/lib/process-runner.mjs
````

Output (truncated):

````text
src/types/config.d.ts:167:      withRules?: string[];
src/types/config.d.ts:168:      withTags?: string[];
src/types/config.d.ts:169:      runOnly?: null | {
src/types/config.d.ts:183:        withRules?: string[];
src/types/config.d.ts:184:        withTags?: string[];
src/types/config.d.ts:185:        runOnly?: null | {
src/lib/context.mjs:207:  // `runOnly: null` (defined-as-null = clear) from absent (inherit base).
src/lib/process-runner.mjs:25:// NOTE: see scan.mjs for rationale on the AxeBuilder type cast.
src/lib/process-runner.mjs:26:import AxeBuilderImport from '@axe-core/playwright';
src/lib/process-runner.mjs:27:const AxeBuilder = /** @type {any} */ (AxeBuilderImport);
src/lib/process-runner.mjs:350:  const result = await new AxeBuilder({ page }).analyze();
src/lib/axe-utils.mjs:2 ...
````

## 4. Bash

````bash
R=$REPO; cd $R; sed -n 60,80p README.md; echo ----; sed -n 10,40p docs/guides/config-guide.md; echo ----; sed -n 140,156p docs/guides/config-guide.md; echo; grep -n "withTags" -A2 configs/*.json | head -30; grep -rn "array\(s\)\? replace\|replace wholesale\|arrays replace" docs README.md CHANGELOG.md | head
````

Output (truncated):

````text
All commands accept `--config <path>`, `--out-dir <path>`,
`--log-level <level>`, `--quiet`, and `--verbose` flags.

## Configuration

Start from [`configs/example-site.json`](./configs/example-site.json)
and adapt to your site. Key fields:

| Field                         | Purpose                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rootUrl`                     | Starting URL for the crawler                                                                                                                       ...
````

## 5. Bash

````bash
R=$REPO; cd $R; sed -n 1,100p src/lib/config.mjs | grep -n "scope\|crawl:\|sample:\|name\|rootUrl\|parseArgs\|import" ; echo ----; sed -n 90,160p src/lib/validate-config.mjs; echo ----; grep -n "required" schemas/config.schema.json | head -5; sed -n 1,30p src/index.mjs | grep -n "export"
````

Output (truncated):

````text
23:import fs from 'node:fs/promises';
24:import path from 'node:path';
25:import { parseArgs } from './args.mjs';
29:// ANCHOR: DEFAULT_DOCUMENT_LINK_PATTERNS — pathname-anchored regex sources matching
59:  scope: {
60:    mode: 'same-hostname',
63:  crawl: {
88:  sample: {
----
      ];
      return false;
    }
  },
});

/** @type {{ validator: any, schema: any } | null} */
let cached = null;

async function getValidator() {
  if (cached) return cached;
  const raw = await fs.readFile(SCHEMA_PATH, 'utf8');
  const schema = JSON.parse(raw);
  const validator = ajv.compile(schema);
  cached = { validator, schema };
  return cached;
}

// SECTION: Public API

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - True when the config satisfies the schema.
 * @property {any ...
````

## 6. Bash

````bash
R=$REPO; cd $R; sed -n 160,215p src/lib/context.mjs; echo ----; sed -n 1,20p src/types/index.d.ts; grep -n "browserTransportAware" -r src | head; echo ----; sed -n 50,115p bin/wcag-em.mjs
````

Output (truncated):

````text
/**
 * Build a RunContext. Loads config via `loadConfig()`, validates it with Ajv,
 * creates the logger, resolves output paths, and runs preflight. Throws on
 * preflight failure so the Commander entry point can exit 1 with the message.
 *
 * @param {BuildContextOptions} [options]
 * @returns {Promise<RunContext>}
 */
export async function buildContext(options = {}) {
  // ANCHOR: StepA — argv loading (options.configPath wins over --config flag)
  const loaded = await loadConfig(options.configPath);
  const configPath = loaded.configPath;

  // ANCHOR: StepB — Ajv validation against schemas/config.schema.json.
  await assertValidConfig(loaded.config, configPath);

  // ANCHOR: CompileRuntimeFields — regex strings become RegExp[] once, at load.
  // Ajv's `validRegex` keyword has already c ...
````

## 7. Bash

````bash
R=$REPO; cd $R; grep -n "runAudit\|export" src/index.mjs | head; grep -rn "export async function runAudit" src; cat src/lib/args.mjs | head -40; ls docs/adr | head -30; grep -n "unstable\|Unstable\|experimental" docs/adr/0012* | head
````

Output (truncated):

````text
7: * Re-exports the public surface so embedders can run audits in-process:
9: *   import { runAudit } from 'wcag-em-a11y-toolkit';
17:// SECTION: Re-exports
18:export { buildContext } from './lib/context.mjs';
19:export { createLogger, getLogger } from './lib/logger.mjs';
20:export { validateConfig, assertValidConfig } from './lib/validate-config.mjs';
21:export { runPreflight } from './lib/preflight.mjs';
32:export async function runAudit(options = {}) {
src/index.mjs:32:export async function runAudit(options = {}) {
// @ts-check
/**
 * @file Fallback argument parser for programmatic `loadConfig()` callers.
 * @module lib/args
 *
 * @description
 * This module persists as a fallback argument parser for programmatic
 * `loadConfig()` callers; the Commander CLI in `bin/wcag-em.mjs` is the
  ...
````

## 8. Bash

````bash
R=$REPO; cd $R; sed -n 25,60p src/index.mjs; grep -n -i "public\|stable\|semver\|programmatic\|index.mjs" docs/adr/0012-extensibility-is-internal.md docs/adr/0011-v1-release-boundary.md docs/adr/0015* | head -20; sed -n 20,40p docs/adr/0005-fail-fast-on-config.md; grep -n -i "merge\|default" docs/adr/0002-config-is-ajv-validated.md | head
````

Output (truncated):

````text
/**
 * Run the full audit pipeline in a single call. For embedders who don't
 * need step-level control.
 *
 * @param {import('./lib/context.mjs').BuildContextOptions} [options]
 * @returns {Promise<{ exitCode: number, stages: Record<string, unknown> }>}
 */
export async function runAudit(options = {}) {
  const { buildContext } = await import('./lib/context.mjs');
  const ctx = await buildContext({ requirePlaywright: true, ...options });

  /** @type {Record<string, unknown>} */
  const stages = {};
  let exitCode = 0;

  const stageNames = /** @type {const} */ ([
    'discover',
    'sample',
    'scan',
    'scan-processes',
    'summarize',
  ]);
  for (const name of stageNames) {
    ctx.logger.info({ stage: name }, 'stage start');
    const mod = await import(`./commands/${name}.mjs` ...
````

## 9. Bash

````bash
W=$SCRATCH/wf2/verify-B01; mkdir -p $W; R=$REPO; cat > $W/axeprobe.mjs <<EOF
import { createRequire } from 'node:module';
const require = createRequire('$R/package.json');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const axePkg = require('axe-core/package.json');
const html = '<!doctype html><html lang="en"><head><title>t</title></head><body><main><h1>x</h1><img src="a.png"><input type="text"><div style="display:flex"><button style="width:10px;height:10px;padding:0;margin:0">a</button><button style="width:10px;height:10px;padding:0;margin:0">b</button></div></main></body></html>';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html);
  const rules = await page.evaluate(async () => {
    const s = document.createElement('script'); return 0;});
  const summarize = (r) => {
    const all = [...r.violations, ...r.passes, ...r.incomplete, ...r.inapplicable].map(x => x.id);
    return { touched: all.length, violations: r.violations.map(v => v.id).sort(), hasTargetSize: all.includes('target-size') };
  };
  const def = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
  const out = {};
  out.axeVersion = axePkg.version;
  out.unconfigured = summarize(await new AxeBuilder({ page }).analyze());
  out.defaultProfile = summarize(await new AxeBuilder({ page }).withTags(def).analyze());
  out.defaultPlusBP = summarize(await new AxeBuilder({ page }).withTags([...def,'best-practice']).analyze());
  out.readmeExample = summarize(await new AxeBuilder({ page }).withTags(['wcag2aa','best-practice']).analyze());
  const meta = await page.evaluate(() => {
    const rs = window.axe.getRules();
    const disabled = window.axe._audit.rules.filter(r => r.enabled === false).map(r => ({ id: r.id, tags: r.tags }));
    return { total: rs.length, disabled };
  });
  out.meta = meta;
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $W && node axeprobe.mjs
````

Output (truncated):

````text
Exit code 1
$REPO/node_modules/@axe-core/playwright/dist/index.js:253
      throw new Error(
            ^

Error: Please use browser.newContext()
 Please check out https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/error-handling.md
    at AxeBuilder.analyze ($REPO/node_modules/@axe-core/playwright/dist/index.js:253:13)
    at async file://$SCRATCH/wf2/verify-B01/axeprobe.mjs:20:32

Node.js v22.14.0
````

## 10. Bash

````bash
W=$SCRATCH/wf2/verify-B01; cd $W; sed -i '' 's/const page = await browser.newPage();/const ctx = await browser.newContext(); const page = await ctx.newPage();/' axeprobe.mjs; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node axeprobe.mjs
````

Output (truncated):

````text
{
 "axeVersion": "4.11.3",
 "unconfigured": {
  "touched": 90,
  "violations": [
   "image-alt",
   "label"
  ],
  "hasTargetSize": false
 },
 "defaultProfile": {
  "touched": 64,
  "violations": [
   "image-alt",
   "label",
   "target-size"
  ],
  "hasTargetSize": true
 },
 "defaultPlusBP": {
  "touched": 92,
  "violations": [
   "image-alt",
   "label",
   "target-size"
  ],
  "hasTargetSize": true
 },
 "readmeExample": {
  "touched": 32,
  "violations": [],
  "hasTargetSize": false
 },
 "meta": {
  "total": 104,
  "disabled": [
   {
    "id": "aria-roledescription",
    "tags": [
     "cat.aria",
     "wcag2a",
     "wcag412",
     "EN-301-549",
     "EN-9.4.1.2",
     "deprecated"
    ]
   },
   {
    "id": "audio-caption",
    "tags": [
     "cat.time-and-media",
     "wcag2a",
      ...
````

## 11. Bash

````bash
R=$REPO; cd $R; grep -rn "scan\.axe\|axeTags\|ruleProfile\|tagProfile\|config\.scan" src/reporters src/commands/summarize.mjs src/lib/wcag-em*.mjs 2>/dev/null | head -15; ls src/reporters src/lib | head -60 | tr '\n' ' '; echo; grep -rn "conformanceTarget" src --include=*.mjs -l 2>/dev/null || grep -rln "conformanceTarget" src
````

Output (truncated):

````text
src/lib: args.mjs auth.mjs axe-artifact.mjs axe-utils.mjs browser-engine.mjs browser.mjs config.mjs context.mjs engine-check.mjs fs-utils.mjs group-findings.mjs logger.mjs manual-backlog.mjs page-guard.mjs preflight.mjs process-runner.mjs sample-utils.mjs scan-results.mjs sitemap.mjs urls.mjs validate-config.mjs version.mjs viewports.mjs wcag-em-summary.mjs  src/reporters: _sort.mjs _template.mjs earl-jsonld.mjs html.mjs index.mjs json.mjs junit.mjs markdown.mjs portal-export.mjs report-builder-starter.mjs 
(eval):1: no matches found: --include=*.mjs
````

## 12. Bash

````bash
R=$REPO; cd $R; grep -rln "conformanceTarget" src; grep -rn "withTags\|scan\.axe\|axe\.withTags" src/reporters src/lib/wcag-em-summary.mjs src/commands/summarize.mjs; grep -n "conformanceTarget\|notTested" src/lib/wcag-em-summary.mjs | head -20
````

Output (truncated):

````text
src/types/config.d.ts
src/lib/wcag-em-summary.mjs
src/lib/config.mjs
src/reporters/report-builder-starter.mjs
src/reporters/earl-jsonld.mjs
154: * @property {'passed' | 'failed' | 'cantTell' | 'inapplicable' | 'untested' | 'notTested'} outcome - EARL outcome verdict.
181: *   conformanceTarget: string,
366:  const conformanceTarget = wcagEmConfig.conformanceTarget ?? 'AA';
369:  const targetLevels = new Set(LEVEL_INCLUDES[conformanceTarget] ?? LEVEL_INCLUDES['AA']);
376:      outcome: /** @type {const} */ ('notTested'),
442:    conformanceTarget: wcagEmConfig.conformanceTarget ?? 'AA',
````

## 13. Bash

````bash
W=$SCRATCH/wf2/verify-B01; R=$REPO; cat > $W/cfgprobe.mjs <<EOF
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const ex = promisify(execFile);
const { loadConfig } = await import('file://$R/src/lib/config.mjs');
const { validateConfig } = await import('file://$R/src/index.mjs');
const W = '$W';
const base = { name: 'p', rootUrl: 'http://127.0.0.1:9/' };
const nullCfg = { ...base, crawl: { documentLinkPatterns: null }, scan: { axe: { withTags: null } }, reporting: { failOnFindings: null } };
await fs.writeFile(W + '/null.json', JSON.stringify(nullCfg));
await fs.writeFile(W + '/min.json', JSON.stringify(base));
await fs.writeFile(W + '/bom.json', '﻿' + JSON.stringify(base));
await fs.writeFile(W + '/typo.json', JSON.stringify({ ...base, crawl: { maxPage: 5 } }, null, 2));
const out = {};
const loaded = await loadConfig(W + '/null.json');
out.nullMerged = { withTags: loaded.config.scan.axe.withTags, failOnFindings: loaded.config.reporting.failOnFindings, docPatternsLen: loaded.config.crawl.documentLinkPatterns?.length };
out.nullMergedValid = (await validateConfig(loaded.config)).valid;
const rawNull = await validateConfig(nullCfg);
out.nullRawValid = rawNull.valid; out.nullRawErrors = rawNull.errors.map(e => e.instancePath + ' ' + e.message);
const rawMin = await validateConfig(base);
out.minRawValid = rawMin.valid; out.minRawErrors = rawMin.errors.map(e => e.instancePath + ' ' + e.message);
const loadedMin = await loadConfig(W + '/min.json');
out.minMergedValid = (await validateConfig(loadedMin.config)).valid;
const loadedTypo = await loadConfig(W + '/typo.json');
const typo = await validateConfig(loadedTypo.config, 'typo.json');
out.typoFormatted = typo.formatted.slice(0, 900);
const cli = async (args) => {
  try { const r = await ex(process.execPath, ['$R/bin/wcag-em.mjs', ...args], { cwd: W, env: { ...process.env, CRAWLEE_STORAGE_DIR: W + '/crawlee-storage' } }); return { code: 0, out: (r.stdout + r.stderr).slice(0, 400) }; }
  catch (e) { return { code: e.code, out: ((e.stdout ?? '') + (e.stderr ?? '')).slice(0, 400) }; }
};
out.cliBom = await cli(['sample', '--config', 'bom.json', '--out-dir', W + '/o-bom']);
out.cliNullSample = await cli(['sample', '--config', 'null.json', '--out-dir', W + '/o-null']);
out.cliMinSample = await cli(['sample', '--config', 'min.json', '--out-dir', W + '/o-min']);
out.cliLogLevel = await cli(['sample', '--config', 'min.json', '--log-level', 'bogus', '--out-dir', W + '/o-ll']);
out.cliScanNoSample = await cli(['scan', '--config', 'min.json', '--out-dir', W + '/o-empty']);
out.cliNoConfig = await cli(['sample', '--out-dir', W + '/o-nocfg']);
console.log(JSON.stringify(out, null, 1));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $W && node cfgprobe.mjs
````

Output (truncated):

````text
{
 "nullMerged": {
  "withTags": [
   "wcag2a",
   "wcag2aa",
   "wcag21a",
   "wcag21aa",
   "wcag22aa"
  ],
  "failOnFindings": {
   "impacts": [
    "critical",
    "serious"
   ],
   "classifications": [],
   "threshold": 1
  },
  "docPatternsLen": 8
 },
 "nullMergedValid": true,
 "nullRawValid": false,
 "nullRawErrors": [
  " must have required property 'scope'",
  " must have required property 'sample'",
  "/crawl/documentLinkPatterns must be array",
  "/scan/axe/withTags must be array",
  "/reporting/failOnFindings must be object"
 ],
 "minRawValid": false,
 "minRawErrors": [
  " must have required property 'scope'",
  " must have required property 'crawl'",
  " must have required property 'sample'",
  " must have required property 'scan'"
 ],
 "minMergedValid": true,
 "typoFormatte ...
````

## 14. Bash

````bash
W=$SCRATCH/wf2/verify-B01; R=$REPO; cd $W; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; for a in "sample --config null.json --out-dir $W/o-null" "scan --config min.json --out-dir $W/o-empty" "sample --out-dir $W/o-nocfg"; do CRAWLEE_STORAGE_DIR=$W/crawlee-storage node $R/bin/wcag-em.mjs $a 2>&1 | grep -o '"message":"[^"]*' | head -1 | sed "s#$W#<W>#g"; done; ls $R/node_modules/@axe-core/playwright/node_modules 2>/dev/null; grep -rn "axeCore" $R/src/lib/logger.mjs $R/src/lib/version.mjs | head -5
````

Output (truncated):

````text
$REPO/src/lib/logger.mjs:80:      axeCore: TOOL_IDENTITY.axeCore,
$REPO/src/lib/logger.mjs:94:          ignore: 'pid,hostname,name,tool,toolVersion,axeCore',
$REPO/src/lib/version.mjs:10: * carries a `tool: { name, version, axeCore }` header so downstream
$REPO/src/lib/version.mjs:51: * @type {Readonly<{ name: string, version: string, axeCore: string }>}
$REPO/src/lib/version.mjs:56:  axeCore: String(axePkg.version ?? '0.0.0'),
````

## 15. Bash

````bash
W=$SCRATCH/wf2/verify-B01; R=$REPO; cd $W; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; for a in "sample --config null.json --out-dir $W/o-null" "scan --config min.json --out-dir $W/o-empty" "sample --out-dir $W/o-nocfg"; do CRAWLEE_STORAGE_DIR=$W/crawlee-storage node $R/bin/wcag-em.mjs $a 2>&1 | head -c 700 | sed "s#$W#<W>#g" | grep -o 'message[^,]*'; done; sed -n 40,56p $R/src/lib/version.mjs; node -e "console.log(require('$R/node_modules/axe-core/package.json').version)"; ls -la $R/node_modules | grep axe
````

Output (truncated):

````text
const axePkg = JSON.parse(fs.readFileSync(axePkgPath, 'utf8'));

// SECTION: Public API

/**
 * Tool identity stamped on every emitted artefact.
 *
 * Frozen so callers can't mutate the shared reference. Spread into artefact
 * object literals as `{ tool: TOOL_IDENTITY, ...rest }` so the stamp appears
 * as the first property of each JSON file.
 *
 * @type {Readonly<{ name: string, version: string, axeCore: string }>}
 */
export const TOOL_IDENTITY = Object.freeze({
  name: String(selfPkg.name ?? 'wcag-em-a11y-toolkit'),
  version: String(selfPkg.version ?? '0.0.0'),
  axeCore: String(axePkg.version ?? '0.0.0'),
4.11.3
drwxr-xr-x@   3 $USER  staff      96 Jun 13 18:13 @axe-core
drwxr-xr-x@  11 $USER  staff     352 Jun 13 18:13 axe-core
drwxr-xr-x@   7 $USER  staff     224 Jun 13 18:13 saxe ...
````

## 16. Bash

````bash
W=$SCRATCH/wf2/verify-B01; R=$REPO; cd $W; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; sed -n 22,39p $R/src/lib/version.mjs; for a in "sample --config null.json --out-dir $W/o-null" "scan --config min.json --out-dir $W/o-empty" "sample --out-dir $W/o-nocfg"; do CRAWLEE_STORAGE_DIR=$W/crawlee-storage node $R/bin/wcag-em.mjs $a 2>&1 | head -c 600 | sed "s#$W#<W>#g" | cut -c 150-420; echo; done
````

Output (truncated):

````text
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md (tool-identity in every artefact)
 */

// SECTION: Imports
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SECTION: Constants

// Read this package's package.json (own). `new URL('../../package.json', ...)`
// from src/lib/version.mjs resolves to the repo root.
const selfPkgUrl = new URL('../../package.json', import.meta.url);
const selfPkg = JSON.parse(fs.readFileSync(selfPkgUrl, 'utf8'));

// Resolve @axe-core/playwright's entry, then walk up to find its package.json.
const axePkgPath = findAxeCorePackageJson();
````

## 17. Bash

````bash
W=$SCRATCH/wf2/verify-B01; R=$REPO; cd $W; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; i=0; for a in "sample --config null.json --out-dir $W/o-null" "scan --config min.json --out-dir $W/o-empty" "sample --out-dir $W/o-nocfg"; do i=$((i+1)); CRAWLEE_STORAGE_DIR=$W/crawlee-storage node $R/bin/wcag-em.mjs $a > $W/cli$i.log 2>&1; echo "exit=$?"; python3 -c "import json,sys; l=open('$W/cli$i.log').read().strip().splitlines()[-1]; d=json.loads(l); print(d.get('err',{}).get('message','')[-160:], '|', d.get('msg'))"; done; sed -n 58,80p $R/src/lib/version.mjs
````

Output (truncated):

````text
exit=1
Traceback (most recent call last):
  File "<string>", line 1, in <module>
    import json,sys; l=open('$SCRATCH/wf2/verify-B01/cli1.log').read().strip().splitlines()[-1]; d=json.loads(l); print(d.get('err',{}).get('message','')[-160:], '|', d.get('msg'))
                                                                                                                                                                                                                                                                       ~~~~~~~~~~^^^
  File "/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/json/__init__.py", line 352, in loads
    return _default_decoder.decode(s)
           ~~~~~~~~~~~~~~~~~~~~~~~^^^
  File "/opt/homebrew/Cellar/python@3.14/3 ...
````

## 18. Bash

````bash
W=$SCRATCH/wf2/verify-B01; S=$SCRATCH/review; for i in 1 2 3; do echo "== cli$i"; head -c 420 $W/cli$i.log | sed "s#$W#<W>#g"; echo; done; grep -iE "4\.11\.2|axeCore|tool identity|TOOL_IDENTITY" $S/round1-index.txt | head
````

Output (truncated):

````text
== cli1
error: unknown command 'sample --config null.json --out-dir <W>/o-null'

== cli2
error: unknown command 'scan --config min.json --out-dir <W>/o-empty'

== cli3
error: unknown command 'sample --out-dir <W>/o-nocfg'

VERD-11 | medium | new | correctness | The tool identity stamps the wrong axe-core version (the @axe-core/playwright wrapper's 4.11.2, not the injected engine's 4.11.3) | src/lib/version.mjs:8, src/lib/version.mjs:56
REPB-12 | low | new | accuracy-coverage | Artefacts report the @axe-core/playwright version as the axe-core engine version (4.11.2 vs the 4.11.3 actually running) | src/lib/version.mjs:56, src/reporters/portal-export.mjs:517, src/reporters/report-builder-starter.mjs:517
CAP-19 | low | new | correctness | The 'axe-core' version stamped on every artefact is th ...
````

## 19. Bash

````bash
W=$SCRATCH/wf2/verify-B01; R=$REPO; cd $W; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; export CRAWLEE_STORAGE_DIR=$W/crawlee-storage; node $R/bin/wcag-em.mjs sample --config null.json --out-dir $W/o-null > c1.log 2>&1; echo "e=$?"; node $R/bin/wcag-em.mjs scan --config min.json --out-dir $W/o-empty > c2.log 2>&1; echo "e=$?"; node $R/bin/wcag-em.mjs sample --out-dir $W/o-nocfg > c3.log 2>&1; echo "e=$?"; for i in 1 2 3; do grep -o '"message":"[^"]*"' c$i.log | head -1 | sed "s#$W#<W>#g"; done
````

Output (truncated):

````text
e=1
e=1
e=1
"message":"ENOENT: no such file or directory, open '<W>/o-null/inventory/inventory.json'"
"message":"ENOENT: no such file or directory, open '<W>/o-empty/sample.json'"
"message":"ENOENT: no such file or directory, open '<W>/configs/example-site.json'"
````

## 20. Bash

````bash
R=$REPO; cd $R; grep -n -i "failOnFindings" docs/guides/*.md README.md | head -8; grep -n -i "disable the gate\|disable.*gate\|threshold.*0\|null" docs/guides/config-guide.md | head -12; grep -n "null" test/unit/config*.test.mjs 2>/dev/null | head -5; ls test/unit | grep -i config
````

Output (truncated):

````text
README.md:78:| `reporting.failOnFindings`    | CI exit-code control (impacts + threshold)                                                                                                               |
docs/guides/integrations.md:110:The pieces: `reporting.failOnFindings` controls the exit code (`2` when
docs/guides/integrations.md:136:(tune `failOnFindings.impacts` / `threshold` per the config guide — for a
docs/guides/config-guide.md:170:| `failOnFindings`               | critical/serious, 1    | CI exit-code control — see below.                                                                                                                                           |
docs/guides/config-guide.md:174:`failOnFindings` sub-fields: `impacts` (axe impact levels that count, default
docs/guides/ ...
````

## 21. Bash

````bash
R=$REPO; cd $R; grep -n '"rootUrl"' configs/example-site.json; grep -n "logger\.\(info\|debug\|warn\)" src/lib/context.mjs | head; grep -n "configPath" src/lib/context.mjs | head; grep -n -A3 "^SEC-18\|\"SEC-18\"" $SCRATCH/review/round1-findings.json | head -12
````

Output (truncated):

````text
3:  "rootUrl": "https://example.com/",
12: *   { config, configPath, logger, outDir, paths, args }
134: * @property {string} configPath - Absolute source path.
148: * @property {string} [configPath] - Override for `--config`.
170:  // ANCHOR: StepA — argv loading (options.configPath wins over --config flag)
171:  const loaded = await loadConfig(options.configPath);
172:  const configPath = loaded.configPath;
175:  await assertValidConfig(loaded.config, configPath);
264:      configPath,
284:    configPath,
317:    configPath: ctx.configPath,
3080:  "id": "SEC-18",
3081-  "title": "Preflight checks are partly unreachable or diverge from Playwright's own resolution",
3082-  "category": "dx",
3083-  "severity": "low",
````

## 22. Bash

````bash
R=$REPO; cd $R; sed -n 305,325p src/lib/context.mjs; python3 -c "
import json;d=json.load(open('$SCRATCH/review/round1-findings.json'))
L=d if isinstance(d,list) else d.get('findings',d)
for f in L:
  if f['id'] in ('SEC-18','VERD-07','PROC-03','SCAN-04'): print(f['id'],'::',f['claim'][:500]);print()
"
````

Output (truncated):

````text
 * programmatic API callers who construct `RunContext` by hand. Idempotent:
 * `ctx.preflightRan` guards against double-running.
 *
 * Co-located with `context.mjs` rather than promoted to its own module —
 * one small helper doesn't justify a file.
 *
 * @param {RunContext} ctx
 * @returns {Promise<void>}
 */
export async function ensurePreflight(ctx) {
  if (ctx.preflightRan) return;
  const pf = await runPreflight({
    configPath: ctx.configPath,
    outDir: ctx.paths.outDir,
    // Preserve build-time intent when buildContext recorded it (skipPreflight
    // flows); hand-built contexts carry no browser claim, so the check stays
    // off and a missing browser surfaces at Playwright launch instead.
    requirePlaywright: ctx.requirePlaywright === true,
  });
  if (!pf.ok) {
    const ...
````

## 23. Bash

````bash
R=$REPO; cd $R; grep -n -i "overall\|automatedCoverage\|conforman.*status\|claim" src/lib/wcag-em-summary.mjs | head -15
````

Output (truncated):

````text
175: *   automatedCoverage: { status: 'complete'|'partial'|'none', adequate: boolean, pagesSelected: number|null, pagesAudited: number, pagesExcluded: number, scopeExclusions: Array<{ outcome: string, count: number, examples: string[] }> },
308:    // the coverage gap is disclosed by the conformance-claim layer.
424:  const automatedCoverage = {
434:    automatedCoverage,
````
