# Probe record: verify:A14

Role: packet verifier. Findings: PROC-09, PROC-10, PROC-15, PROC-16, PROC-20, SEC-18, SEC-19, SEC-20

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" PROC-09,PROC-10,PROC-15,PROC-16,PROC-20,SEC-18,SEC-19,SEC-20
````

Output (truncated):

````text
[
 {
  "dimension": "PROC",
  "id": "PROC-09",
  "title": "processes[].stepTimeoutMs is in the schema, the docs and the example but never read; per-step timeouts are otherwise inconsistent",
  "category": "docs-drift",
  "severity": "medium",
  "status": "new",
  "claim": "The step budget is always scan.timeoutMs. processDef.stepTimeoutMs has had no runtime reader since it was added to the schema. step.timeoutMs affects only waitFor, and a waitFor sleep longer than the budget becomes a step-timeout that degrades later states. Under the default 60000ms budget, click and fill are actually capped by Playwright's 30s default action timeout.",
  "evidence": [
   {
    "file": "schemas/config.schema.json",
    "line": 517,
    "excerpt": "\"stepTimeoutMs\": {"
   },
   {
    "file": "src/lib/pro ...
````

## 2. Bash

````bash
cd $REPO; grep -rn "stepTimeoutMs" src schemas docs configs test | head -20; echo ---; grep -n "timeout\|Timeout" src/lib/process-runner.mjs | head -40; echo ---; grep -rn "urlPattern\|\.regex" src/lib/process-runner.mjs src/commands/scan-processes.mjs src/lib/context.mjs src/commands/scan.mjs 2>/dev/null | head; ls src src/commands src/lib | head -60
````

Output (truncated):

````text
src/types/config.d.ts:209:    stepTimeoutMs?: number;
src/lib/process-runner.mjs:94: * Thrown internally when a step exceeds its `stepTimeoutMs`. Caught by
src/lib/process-runner.mjs:108:    super(`step "${action}" exceeded stepTimeoutMs=${timeoutMs}`);
src/lib/process-runner.mjs:155:  const stepTimeoutMs = Number(ctx.config?.scan?.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS);
src/lib/process-runner.mjs:156:  const timeout = rejectAfter(step.action, stepTimeoutMs);
schemas/config.schema.json:517:          "stepTimeoutMs": {
docs/guides/config-guide.md:228:| `stepTimeoutMs` | no       | Per-step budget override for this process (else `scan.timeoutMs`).                                       |
docs/guides/config-guide.md:245:inside a budget (`stepTimeoutMs`/`timeoutMs`, else `scan.timeoutMs`); a fai ...
````

## 3. Bash

````bash
cd $REPO; sed -n 120,170p src/lib/process-runner.mjs; sed -n 200,300p src/lib/process-runner.mjs; sed -n 90,125p src/lib/context.mjs; sed -n 250,265p docs/guides/config-guide.md; sed -n 50,65p docs/adr/0005-fail-fast-on-config.md; grep -rn "warnSchemaAcceptedRuntimeIgnored" src | head
````

Output (truncated):

````text
 * (`summarize.mjs`) read `state.state` for reporting.
 *
 * @param {any} processDef
 * @param {any[]} steps
 * @param {StepContext} ctx
 * @returns {Promise<StepResult[]>}
 */
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
      if (result.stat ...
````

## 4. Bash

````bash
cd $REPO; grep -n -i "stepTimeoutMs\|urlPattern\|__proto__\|env-subst\|secret\|scan-processes\|process.*e2e\|preflight" CHANGELOG.md TODO.md | head -40; sed -n 500,530p schemas/config.schema.json; sed -n 660,700p schemas/config.schema.json
````

Output (truncated):

````text
CHANGELOG.md:83:  under `cdpEndpoint` (the external browser owns the session); preflight skips
CHANGELOG.md:103:  `beforeScan` `urlPattern` conditionals (illustrative URLs).
            }
          },
          "fields": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["selector"],
              "properties": {
                "selector": {
                  "type": "string"
                },
                "value": {
                  "type": "string"
                }
              }
            }
          },
          "stepTimeoutMs": {
            "type": "integer",
            "minimum": 100,
            "maximum": 600000
          }
        }
      }
    },
    "reporting": {
      "type": "object",
      "additionalP ...
````

## 5. Bash

````bash
cd $REPO; sed -n 440,500p schemas/config.schema.json; sed -n 700,730p schemas/config.schema.json; grep -n "processes\|steps\|pattern" src/commands/scan-processes.mjs | head -30
````

Output (truncated):

````text
                    ]
                  },
                  "actions": {
                    "type": "array",
                    "items": {
                      "$ref": "#/$defs/action"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "processes": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "startUrl"],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-z0-9-]+$"
          },
          "startUrl": {
            "type": "string",
            "format": "uri"
          },
          "pattern": {
            "oneOf": [
              {
                "enum": ["blank-subm ...
````

## 6. Bash

````bash
cd $REPO; sed -n 185,230p src/lib/config.mjs; grep -n "export" src/lib/validate-config.mjs src/lib/config.mjs; sed -n 160,200p src/lib/context.mjs; grep -n "config\|Config not found" src/lib/preflight.mjs | head -20
````

Output (truncated):

````text
 * flag → `configs/example-site.json` fallback. `overridePath` is the hook
 * programmatic API callers use to point at an arbitrary config file without
 * having to mutate `process.argv`.
 *
 * @param {string} [overridePath] - Absolute or relative path; wins over argv.
 * @returns {Promise<LoadConfigResult>}
 */
export async function loadConfig(overridePath) {
  const args = parseArgs();
  const configPath =
    overridePath ?? (typeof args.config === 'string' ? args.config : 'configs/example-site.json');
  const resolved = path.resolve(configPath);
  const raw = await fs.readFile(resolved, 'utf8');
  const config = deepMerge(DEFAULTS, JSON.parse(raw));
  return { config, configPath: resolved, args };
}

// SECTION: Internal helpers

/**
 * Recursively merge `override` on top of `base`. Ar ...
````

## 7. Bash

````bash
cd $REPO; sed -n 70,110p src/lib/preflight.mjs; sed -n 120,145p src/lib/browser.mjs; grep -n "env\|secret" docs/guides/config-guide.md | head; cat .gitignore | head -40
````

Output (truncated):

````text
    await fs.unlink(probe);
  } catch (err) {
    failures.push(
      `Output directory not writable: ${opts.outDir} (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  // ANCHOR: Check3 — Playwright browser binaries installed (opt-in; see
  // PreflightOptions.requirePlaywright for why the default is OFF).
  if (opts.requirePlaywright === true) {
    // NOTE: we avoid actually launching Chromium here (too slow); instead
    // check that the playwright browsers directory exists and contains at
    // least one chromium build. The path is controlled by
    // PLAYWRIGHT_BROWSERS_PATH or defaults to ~/.cache/ms-playwright on unix.
    const browsersRoot =
      process.env.PLAYWRIGHT_BROWSERS_PATH ||
      path.join(
        process.env.HOME ?? process.env.USERPROFILE ??  ...
````

## 8. Bash

````bash
cd $REPO; grep -n "channel" src/lib/*.mjs schemas/config.schema.json | head; grep -rn "requirePlaywright" src | head
````

Output (truncated):

````text
src/lib/browser.mjs:65: * @property {string} [channel] - Present (optional) when transport is `launch`.
src/lib/browser.mjs:103:    if (browserCfg.channel) {
src/lib/browser.mjs:104:      warnings.push('scan.browser.channel is ignored under a CDP endpoint.');
src/lib/browser.mjs:118:    channel: typeof browserCfg.channel === 'string' ? browserCfg.channel : undefined,
src/lib/browser.mjs:177:  if (plan.channel) launchOptions.channel = plan.channel;
schemas/config.schema.json:307:          "description": "Pluggable browser transport (E8, opt-in; ADR-0020). Default is a headless Chromium via Playwright (byte-identical to prior releases). Set cdpEndpoint to attach over the Chrome DevTools Protocol to an already-running, human-cleared browser so AUTHORIZED audits can scan pages behind a Cloudfl ...
````

## 9. Bash

````bash
S=$SCRATCH/wf2/verify-A14; mkdir -p $S; R=$REPO
cat > $S/probe.mjs <<EOF
import fs from 'node:fs/promises';
const R='file://$R/src/lib/';
const { validateConfig } = await import(R+'validate-config.mjs');
const { loadConfig } = await import(R+'config.mjs');
const { runStep } = await import(R+'process-runner.mjs');
const { resolveTransport } = await import(R+'browser.mjs');
const base = JSON.parse((await fs.readFile('$R/test/fixtures/site.json.template','utf8')).replaceAll('{{BASE_URL}}','http://127.0.0.1:1').replaceAll('{{PORT}}','1'));
const mk = (processes) => ({...base, processes});
const cases = {
 clickNoSel: [{name:'a',startUrl:'http://127.0.0.1:1/',steps:[{action:'click'}]}],
 gotoNoUrl: [{name:'a',startUrl:'http://127.0.0.1:1/',steps:[{action:'goto'}]}],
 gotoRel: [{name:'a',startUrl:'http://127.0.0.1:1/',steps:[{action:'goto',url:'/rel'}]}],
 dupNames: [{name:'a',startUrl:'http://127.0.0.1:1/',pattern:'blank-submit'},{name:'a',startUrl:'http://127.0.0.1:1/',pattern:'blank-submit'}],
 fieldsTypo: [{name:'a',startUrl:'http://127.0.0.1:1/',pattern:'partial-submit',fields:[{selector:'#x',valeu:'y'}],selectors:{submitt:'#s'}}],
 empty: [{name:'a',startUrl:'http://127.0.0.1:1/'}],
 traversalName: [{name:'a',startUrl:'http://127.0.0.1:1/',steps:[{action:'screenshot',name:'x/../../../ESC'}]}],
};
for (const [k,p] of Object.entries(cases)) { try { const r = await validateConfig(mk(p)); console.log(k, JSON.stringify(r).slice(0,120)); } catch(e){ console.log(k,'THROW',e.message);} }
// deepMerge proto
const cfg = {...base, processes: []};
const txt = JSON.stringify(cfg).replace('"scan":{', '"scan":{"__proto__":{"browser":{"cdpEndpoint":"http://127.0.0.1:1","engine":"patchright"}},');
await fs.writeFile('$S/proto.json', txt);
const { config } = await loadConfig('$S/proto.json');
console.log('own browser?', Object.keys(config.scan).includes('browser'), 'transport', JSON.stringify(resolveTransport(config, {})));
console.log('valid', JSON.stringify(await validateConfig(config)).slice(0,100));
// screenshot path
let captured; const page = { screenshot: async (o)=>{captured=o.path;} };
const ctx = { page, config:{scan:{timeoutMs:2000}}, paths:{screenshotsDir:'/tmp/out/screenshots'}, processDef:{name:'a',startUrl:'http://127.0.0.1:1/'}, viewport:{id:'desktop'}, logger:{warn(){},error(){},info(){}} };
await runStep({action:'screenshot', name:'x/../../../ESC'}, ctx); console.log('path', (await import('node:path')).default.resolve(captured));
await runStep({action:'screenshot'}, ctx); const p1=captured; await runStep({action:'screenshot'}, ctx); console.log('unnamed same', p1===captured);
EOF
cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs 2>&1 | tail -20; CRAWLEE_STORAGE_DIR=$S/cs node $R/bin/wcag-em.mjs sample --config $S/nope.json --out-dir $S/out 2>&1 | tail -3
````

Output (truncated):

````text
clickNoSel {"valid":false,"errors":[{"instancePath":"/rootUrl","schemaPath":"#/properties/rootUrl/pattern","keyword":"pattern","par
gotoNoUrl {"valid":false,"errors":[{"instancePath":"/rootUrl","schemaPath":"#/properties/rootUrl/pattern","keyword":"pattern","par
gotoRel {"valid":false,"errors":[{"instancePath":"/rootUrl","schemaPath":"#/properties/rootUrl/pattern","keyword":"pattern","par
dupNames {"valid":false,"errors":[{"instancePath":"/rootUrl","schemaPath":"#/properties/rootUrl/pattern","keyword":"pattern","par
fieldsTypo {"valid":false,"errors":[{"instancePath":"/rootUrl","schemaPath":"#/properties/rootUrl/pattern","keyword":"pattern","par
empty {"valid":false,"errors":[{"instancePath":"/rootUrl","schemaPath":"#/properties/rootUrl/pattern","keyword":"pattern","par
traversalName {"val ...
````

## 10. Bash

````bash
S=$SCRATCH/wf2/verify-A14; R=$REPO; grep -n "{{\|rootUrl" $R/test/fixtures/site.json.template | head
````

Output (truncated):

````text
3:  "rootUrl": "__BASE_URL__/",
````

## 11. Bash

````bash
S=$SCRATCH/wf2/verify-A14; cd $S; sed -i '' "s/replaceAll('{{BASE_URL}}'/replaceAll('__BASE_URL__'/" probe.mjs; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs 2>&1 | cut -c1-200
````

Output (truncated):

````text
clickNoSel {"valid":true,"errors":null}
gotoNoUrl {"valid":true,"errors":null}
gotoRel {"valid":true,"errors":null}
dupNames {"valid":true,"errors":null}
fieldsTypo {"valid":true,"errors":null}
empty {"valid":true,"errors":null}
traversalName {"valid":true,"errors":null}
own browser? false transport {"transport":"cdp","engine":"patchright","cdpEndpoint":"http://127.0.0.1:1","warnings":[]}
valid {"valid":true,"errors":null}
path /tmp/ESC__desktop.png
unnamed same true
````

## 12. Bash

````bash
R=$REPO; cd $R; grep -rln "scan-processes\|scanProcesses\|processes" test/e2e test/fixtures | head; grep -rn "processes\":\|processes:" test/e2e | head; grep -rn "expandPattern" test | head -5; grep -n "T-I\|process-sourced\|incomplete.*e2e" TODO.md | head
````

Output (truncated):

````text
test/e2e/scan-cdp.test.mjs
test/fixtures/site.json.template
test/e2e/scan-cdp.test.mjs:107:      processes: [],
194:- [ ] Add a process-sourced incomplete-evidence end-to-end test (a needs-review
````

## 13. Bash

````bash
R=$REPO; cd $R; sed -n 190,200p TODO.md; ls test/e2e; grep -rln "scan-processes\|runScanProcesses\|audit" test/e2e | head
````

Output (truncated):

````text
- [x] Drop the `scan.mjs` `liftRuleSummaries` re-export; repoint the widening
      tests at `src/lib/axe-artifact.mjs`. _Review-confirmed (scan.mjs:66).
      Done 2026-06-12 (maintenance pass): single importer repointed, shim
      removed, no behavioural change._
- [ ] Add a process-sourced incomplete-evidence end-to-end test (a needs-review
      finding originating from a `process-results.json` state, through to
      `portal-export` / html).
- [ ] Add a cross-reporter consistency test (the same finding's numbers agree
      across `portal-export` vs html / markdown) — would surface the
      `occurrenceCount` divergence above.
- [x] Carry toolkit screenshots into the report-builder chain as typed
authenticated-scan.test.mjs
discover-timeout.test.mjs
reporters-html-axe.test.mjs
report ...
````

## 14. Bash

````bash
R=$REPO; cd $R; grep -rn "scan-processes\|scanProcesses\|expandPattern\|blank-submit" test/e2e test/unit | grep -v "^test/unit/.*fixture" | cut -c1-160 | head
````

Output (truncated):

````text
test/unit/cli.test.mjs:23:  for (const cmd of ['discover', 'sample', 'scan', 'scan-processes', 'summarize', 'audit']) {
test/unit/browser-session.test.mjs:16: * `scan-processes-isolation.test.mjs` and the e2e scan-health test.
test/unit/configs-valid.test.mjs:50:  assert.ok(patterns.includes('blank-submit'), 'blank-submit pattern present');
test/unit/wcag-em-summary.test.mjs:226:          state: 'blank-submit',
test/unit/wcag-em-summary.test.mjs:236:  assert.equal(v.examples[0].pageUrl, 'https://x.com/signup#blank-submit');
test/unit/context-preflight-cdp.test.mjs:9: * transport-aware (standalone scan / scan-processes) AND config/env selects an
test/unit/scan-processes-isolation.test.mjs:4: * @module test/unit/scan-processes-isolation
test/unit/scan-processes-isolation.test.mjs:8: * per-pr ...
````

## 15. Bash

````bash
R=$REPO; cd $R; grep -rn "screenshotFormat" src schemas docs/guides | cut -c1-200 | head
````

Output (truncated):

````text
src/types/config.d.ts:219:    screenshotFormat?: "png" | "jpeg";
src/commands/scan.mjs:47: * match `config.reporting.screenshotFormat`. Default `'png'` preserves
src/commands/scan.mjs:292:    // Honour reporting.screenshotFormat + screenshotQuality.
src/commands/scan.mjs:297:    const screenshotFormat = config.reporting?.screenshotFormat === 'jpeg' ? 'jpeg' : 'png';
src/commands/scan.mjs:301:    if (screenshotFormat === 'png' && typeof rawQuality === 'number' && !pngQualityWarnFired) {
src/commands/scan.mjs:303:        { screenshotFormat, screenshotQuality: rawQuality },
src/commands/scan.mjs:304:        'reporting.screenshotQuality has no effect when screenshotFormat is png; ignoring',
src/commands/scan.mjs:312:      screenshotFormat,
src/commands/scan.mjs:318:        type: screenshotForm ...
````
