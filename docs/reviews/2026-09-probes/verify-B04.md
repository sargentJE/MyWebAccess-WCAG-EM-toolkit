# Probe record: verify:B04

Role: packet verifier. Findings: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-11, TEST-12

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
R=$REPO; cd $R; sed -n 310,330p src/lib/wcag-em-summary.mjs; grep -n "isAuditableView" src/lib/wcag-em-summary.mjs; sed -n 145,160p src/commands/scan-processes.mjs; sed -n 450,462p src/commands/summarize.mjs; sed -n 80,95p src/lib/page-guard.mjs; sed -n 80,90p src/commands/sample.mjs; sed -n 40,55p src/lib/urls.mjs; grep -n "429" test/unit/*.mjs | head
````

Output (truncated):

````text
    ingestPage(
      String(page?.url ?? ''),
      page?.violations ?? [],
      page?.passesDetail ?? [],
      page?.incompleteDetail ?? [],
      page?.inapplicableDetail ?? [],
    );
  }

  for (const proc of processResults) {
    if (!isAuditableView(proc)) continue;
    for (const state of proc?.states ?? []) {
      if (!isAuditableView(state)) continue;
      const stateUrl = `${proc?.startUrl ?? ''}#${state?.state ?? 'state'}`;
      ingestPage(
        stateUrl,
        state?.violations ?? [],
        state?.passesDetail ?? [],
        state?.incompleteDetail ?? [],
        state?.inapplicableDetail ?? [],
      );
44:import { isAuditableView, viewStatus } from './scan-results.mjs';
309:    if (!isAuditableView(page)) continue;
320:    if (!isAuditableView(proc)) continue;
32 ...
````

## 2. Bash

````bash
R=$REPO; S=$SCRATCH/wf2/verify-B04; mkdir -p $S; rsync -a --exclude .git --exclude node_modules --exclude output --exclude logs --exclude spikes $R/ $S/copy/; ln -sfn $R/node_modules $S/copy/node_modules
cat > $S/mut.mjs <<'EOF'
import fs from 'node:fs'; import {spawn} from 'node:child_process';
const C=process.argv[2];
const muts=[
 ['A','src/lib/wcag-em-summary.mjs','    if (!isAuditableView(proc)) continue;\n',''],
 ['B','src/commands/summarize.mjs','html: ex.html ?? null,','html: null,'],
 ['C','src/lib/page-guard.mjs','status === 403 || status === 429 || status === 503','status === 403 || status === 503'],
 ['D','src/commands/sample.mjs','Math.max(minRandomPages, Math.ceil','Math.min(minRandomPages, Math.ceil'],
 ['E','src/lib/urls.mjs',"    url.port = '';\n",''],
];
function run(){return new Promise(r=>{const c=spawn('node',['--test','test/unit/**/*.test.mjs'],{cwd:C});let o='';c.stdout.on('data',d=>o+=d);c.stderr.on('data',d=>o+=d);c.on('close',()=>r(o))})}
const only=process.argv[3];
for(const [id,f,a,b] of muts){ if(only&&only!==id)continue;
 const p=C+'/'+f; const src=fs.readFileSync(p,'utf8'); if(src.split(a).length!==2){console.log(id,'MATCH!=1');continue}
 fs.writeFileSync(p,src.replace(a,b)); const o=await run(); fs.writeFileSync(p,src);
 const pass=o.match(/# pass (\d+)/)?.[1], fail=o.match(/# fail (\d+)/)?.[1]; console.log(id,'pass',pass,'fail',fail);
 const fl=[...o.matchAll(/^not ok \d+ - (.*)$/gm)].map(m=>m[1]).slice(0,5); if(fl.length)console.log('  ',fl.join(' | '));}
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S && node mut.mjs $S/copy BASE 2>&1; cd $S/copy && node --test 'test/unit/**/*.test.mjs' 2>&1 | grep -E "^# (pass|fail)"
````

Output (truncated):

````text
# pass 517
# fail 0
````

## 3. Bash

````bash
S=$SCRATCH/wf2/verify-B04; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S && node mut.mjs $S/copy 2>&1; diff -rq --exclude node_modules --exclude .git --exclude output --exclude logs --exclude spikes $REPO $S/copy | head
````

Output (truncated):

````text
A pass 517 fail 0
B pass 517 fail 0
C pass 517 fail 0
D pass 517 fail 0
E pass 517 fail 0
````

## 4. Bash

````bash
R=$REPO; cd $R; sed -n 100,145p src/commands/scan-processes.mjs; sed -n 40,80p src/lib/scan-results.mjs; grep -rn "status: 429\|429" test/ | head -3; grep -rln "sample.mjs\|commands/sample" test/unit | head
````

Output (truncated):

````text
 * @param {Record<string, any>} [contextOptions]
 *   - Playwright newContext options from `applyAuth(config)`; storageState,
 *     httpCredentials, extraHTTPHeaders. Hoisted in `run()` so the sync
 *     `applyAuth` call fires once per scan rather than per-process. Empty
 *     object (default) means "no auth" — no-op.
 * @returns {Promise<any>} The process result (pushed into processResults).
 */
export async function runOneProcess(session, processDef, ctx, viewport, contextOptions = {}) {
  /** @type {import('../lib/browser.mjs').PageView | undefined} */
  let view;
  /** @type {any[]} */
  const states = [];
  try {
    const steps = expandPattern(processDef);

    if (steps.length === 0) {
      return {
        name: processDef.name,
        startUrl: processDef.startUrl,
        pa ...
````

## 5. Bash

````bash
R=$REPO; cd $R; grep -n "export async function runProcessSteps\|catch\|throw\|return\|error:" src/lib/process-runner.mjs | head -60
````

Output (truncated):

````text
15: * as `{ state: 'step-timeout', ... }` in the returned state array so the
116: * Run every step in a process and return the accumulated state array.
125: * @returns {Promise<StepResult[]>}
127:export async function runProcessSteps(processDef, steps, ctx) {
143:  return states;
152: * @returns {Promise<StepResult | null>}
158:    return await Promise.race([dispatch(step, ctx), timeout.promise]);
159:  } catch (err) {
162:      return { state: 'step-timeout', name: err.action, error: err.message };
166:    return { state: 'error', name: step.action, error: message };
176: * returning the promise together with a `cancel()` that clears the handle.
185: * @returns {{ promise: Promise<never>, cancel: () => void }}
195:  return {
209: * @returns {Promise<StepResult | null>}
221:      return nu ...
````

## 6. Bash

````bash
R=$REPO; cd $R; sed -n 127,170p src/lib/process-runner.mjs; sed -n 160,200p src/commands/scan-processes.mjs
````

Output (truncated):

````text
export async function runProcessSteps(processDef, steps, ctx) {
  /** @type {StepResult[]} */
  const states = [];
  // E1: once a step errors, every subsequent recorded state ran against a page
  // whose intended setup did not complete — tag it `degraded` so reporters can
  // flag findings of uncertain provenance (the failed step itself surfaces via
  // executionHealth.processStepFailures).
  let priorStepErrored = false;
  for (const step of steps) {
    const result = await runStep(step, ctx);
    if (result) {
      if (priorStepErrored) result.degraded = true;
      states.push(result);
      if (result.state === 'error' || result.state === 'step-timeout') priorStepErrored = true;
    }
  }
  return states;
}

/**
 * Run a single step. Returns the state entry to append (or `null` w ...
````

## 7. Bash

````bash
R=$REPO; cd $R; sed -n 20,70p test/unit/scan-results-consumers-invariant.test.mjs; echo ---; grep -rln "executionHealth" test/ ; echo ---html; grep -rn "'html'" test/e2e | head; echo ---wait; grep -rn "waitForAutoSolveMs" test/ | head -3; echo ---excl; grep -rn "excludeUrlPatterns\|documentLinkPatterns" test/ | head; echo ---gi; grep -rn "gitignore" test/ | head; echo ---portal; grep -rln "process-results" test/ 
````

Output (truncated):

````text
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../../src/', import.meta.url));

/** References either shared predicate (both come from lib/scan-results.mjs). */
const PREDICATE = /\b(?:isAuditableView|viewStatus)\b/;
/** A readJsonMaybe call against one of the raw scan artefacts. */
const RAW_READ = /readJsonMaybe\([^)]*?(?:axe-results|process-results)\.json/;

/**
 * @param {string} dir
 * @returns {Promise<string[]>} absolute paths of every .mjs under dir.
 */
async function listMjs(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true }) ...
````

## 8. Bash

````bash
R=$REPO; cd $R; grep -n "Pattern\|viewports\|reporters" test/fixtures/site.json.template; grep -n "process-results\|portal" test/unit/page-outcome-contract.test.mjs | head; grep -n "resultsDir\|process-results" test/unit/reporters-portal-export.test.mjs | head; sed -n 205,215p src/reporters/html.mjs; sed -n 285,300p src/reporters/portal-export.mjs; sed -n 292,306p src/commands/discover.mjs
````

Output (truncated):

````text
13:    "excludeUrlPatterns": [],
41:    "viewports": [{ "id": "desktop", "width": 1280, "height": 800 }],
12: * out of portal-export.json / report-builder-draft.json, and the only way the
25:import * as portalReporter from '../../src/reporters/portal-export.mjs';
61:    // FAKE violations that would poison the portal upload + client draft + SC
64:    //     unguarded portal loadInstanceMap would attach the challenge URL to the
150:  await fs.writeFile(path.join(resultsDir, 'process-results.json'), JSON.stringify([]));
154:test('§5: portal-export ingests ZERO challenge findings/instances from the raw artefact', async (t) => {
160:  await portalReporter.emit(summary(), ctx);
161:  const out = JSON.parse(await fs.readFile(path.join(reportsDir, 'portal-export.json'), 'utf8'));
299:  // No resu ...
````

## 9. Bash

````bash
W=$SCRATCH/wf2; ls $W; ls $W/test 2>/dev/null | head; grep -E "html.mjs|portal-export.mjs|scan.mjs|discover.mjs|auth.mjs|summarize.mjs|sample.mjs|urls.mjs|all files" $W/test/coverage.txt 2>/dev/null | head -20; R=$REPO; grep -n "test:coverage" $R/package.json
````

Output (truncated):

````text
crit-CAP-01
crit-SEC-01
e2e
ops
stress
test
verify-A01
verify-A02
verify-A03
verify-A04
verify-A05
verify-A06
verify-A07
verify-A08
verify-A09
verify-A10
verify-A11
verify-A12
verify-A13
verify-A14
verify-A15
verify-A16
verify-A17
verify-B03
verify-B04
verify-B05
copy
coverage.txt
eslint.json
mutate.mjs
mutation-results.json
mutation.log
tmp
✔ imports: ../../src/lib/urls.mjs loads without throwing (0.29775ms)
ℹ   discover.mjs                              |  95.40 |    83.33 |   82.14 | 197-200 254-258 299-301 303-305 410-413
ℹ   sample.mjs                                |  95.15 |    50.00 |  100.00 | 92-96 163-165
ℹ   scan.mjs                                  |  93.63 |    64.38 |   47.06 | 139-141 230-231 240-249 302-307 361-366 469-471
ℹ   summarize.mjs                             |  94 ...
````

## 10. Bash

````bash
W=$SCRATCH/wf2; grep -cE "\.test\.mjs +\|" $W/test/coverage.txt; grep -E "^ℹ (tests|pass|fail)" $W/test/coverage.txt; R=$REPO; cd $R; sed -n 25,60p test/unit/manual-backlog.test.mjs | head -30; sed -n 40,50p test/unit/version.test.mjs; sed -n 425,450p test/unit/wcag-em-summary.test.mjs
````

Output (truncated):

````text
68
ℹ tests 525
ℹ pass 525
ℹ fail 0
  assert.doesNotMatch(md, /Process walkthroughs/);
});

test('buildManualBacklog: color-contrast finding → non-text contrast item is DROPPED', () => {
  const md = buildManualBacklog({
    findings: [{ id: 'color-contrast', impact: 'serious' }],
  });
  assert.doesNotMatch(
    md,
    /Non-text contrast spot-check/,
    'automated pass covered color-contrast; manual duplicate dropped',
  );
});

test('buildManualBacklog: region finding → landmarks review section added', () => {
  const md = buildManualBacklog({
    findings: [{ id: 'region', impact: 'moderate' }],
  });
  assert.match(md, /## Landmarks \(flagged automated/);
  assert.match(md, /every region has an accessible name/);
  assert.match(md, /`main` landmark exists and is unique/);
});

test('b ...
````

## 11. Bash

````bash
RV=$SCRATCH/review; grep -E "^(VERD-11|VERD-04|CAP-04|VERD-17|REPB-21|SCAN-22|SAMP-10|PROC-16|REPA-07|DISC-25|SCAN-15) " $RV/round1-index.txt | cut -c1-230; R=$REPO; node -e "console.log(require('$R/node_modules/axe-core/package.json').version, require('$R/node_modules/@axe-core/playwright/package.json').version)"; grep -n "4.1.1" $R/src/lib/*.mjs | head -5
````

Output (truncated):

````text
VERD-04 | medium | new | correctness | 4.1.1 Parsing (obsolete and removed in WCAG 2.2) is emitted as notTested in every default 2.2 run, and the client draft tells the author to evaluate it by hand | src/lib/wcag-em-summary.mjs:1
VERD-11 | medium | new | correctness | The tool identity stamps the wrong axe-core version (the @axe-core/playwright wrapper's 4.11.2, not the injected engine's 4.11.3) | src/lib/version.mjs:8, src/lib/version.mjs:56
VERD-17 | low | new | methodology | The manual backlog drops the non-text contrast (1.4.11) check whenever color-contrast (1.4.3) violations exist | src/lib/manual-backlog.mjs:60, src/lib/manual-backlog.mjs:87
SAMP-10 | medium | new | test-gap | Sampling logic is effectively untested: four behaviour-breaking mutants pass all 517 unit and 8 e2e tests  ...
````

## 12. Bash

````bash
R=$REPO; cd $R; grep -rn "viewports" test/e2e test/fixtures/make-config.mjs | head; grep -n "spawn\|runChild\|bin/wcag-em\|applyAuth\|chromium" test/e2e/authenticated-scan.test.mjs | head; grep -n "assert" test/e2e/reporters-smoke.test.mjs | head -40; grep -rn "image-alt\|criteriaOutcomes" test/e2e | head; grep -rn "login" test/e2e | head -3
````

Output (truncated):

````text
7: * Proves that `applyAuth`'s storageState wiring round-trips end-to-end
10: * applyAuth-derived `storageState` reaches 200. No spawnSync — direct
23:import { chromium } from 'playwright';
25:import { applyAuth } from '../../src/lib/auth.mjs';
30:  'authenticated scan: applyAuth.storageState lets Playwright pass /protected guard',
75:    const browser = await chromium.launch({ headless: true });
83:    // 2. With storageState via applyAuth: /protected returns 200.
84:    const { contextOptions, warnings } = applyAuth({
87:    assert.equal(warnings.length, 0, `applyAuth warnings unexpected: ${warnings.join('|')}`);
88:    // applyAuth's typedef returns `storageState: string | object` — looser
8: * full `audit` via async `child_process.spawn`, and asserts every reporter
37:import assert fro ...
````

## 13. Bash

````bash
R=$REPO; cd $R; sed -n 90,94p test/e2e/reporters-smoke.test.mjs; sed -n 183,245p test/e2e/reporters-smoke.test.mjs | grep -n "assert\|test(" ; ls test/e2e; grep -n "elapsed <\|test(" test/unit/discover-throttle.test.mjs; grep -l "function runChild" test/e2e/*.mjs | wc -l; grep -rn "@typedef" src/lib/scan-results.mjs src/commands/scan.mjs | head; grep -rcE "\{any(\[\])?\}|\{\*\}" src bin | awk -F: '{s+=$2} END{print s}'
````

Output (truncated):

````text
test(
  'reporters smoke: full audit produces all 5 reporter outputs',
  { timeout: 60_000 },
  async (t) => {
authenticated-scan.test.mjs
discover-timeout.test.mjs
reporters-html-axe.test.mjs
reporters-smoke.test.mjs
scan-cdp.test.mjs
scan-challenge.test.mjs
scan-health.test.mjs
scan-redirect.test.mjs
20:test('buildRequestDelayHook sleeps for the configured number of ms', async () => {
29:test('buildRequestDelayHook returns fast when requestDelayMs is 0', async () => {
34:  assert.ok(elapsed < 20, `expected < 20ms; got ${elapsed}ms`);
37:test('buildRequestDelayHook returns fast when requestDelayMs is undefined', async () => {
42:  assert.ok(elapsed < 20, `expected < 20ms; got ${elapsed}ms`);
45:test('buildRequestDelayHook returns fast for NaN / negative values (inert, not throw)', async ( ...
````

## 14. Bash

````bash
R=$REPO; cd $R; sed -n 55,70p test/unit/discover-throttle.test.mjs; grep -n "strict\|checkJs" tsconfig.json jsconfig.json 2>/dev/null
````

Output (truncated):

````text
Exit code 2
test('buildRequestDelayHook returns a callable (can be invoked more than once)', async () => {
  const hook = buildRequestDelayHook(10);
  await hook();
  await hook();
  // No exception is the contract — two consecutive calls both resolve.
});
3:    "checkJs": false,
6:    "strict": true,
9:    "strictNullChecks": true,
10:    "strictFunctionTypes": true,
````

## 15. Bash

````bash
R=$REPO; cd $R; cat tsconfig.json | head -30; grep -l "@ts-check" src/**/*.mjs src/*/*.mjs 2>/dev/null | wc -l; ls src/*/*.mjs | wc -l
````

Output (truncated):

````text
cat: tsconfig.json: No such file or directory
      77
      39
````
