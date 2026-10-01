# Probe record: verify:A15

Role: packet verifier. Findings: SCAN-05, SCAN-10, SCAN-11, SCAN-14, SCAN-16, SCAN-17, SCAN-19, SCAN-21, SCAN-22, VERD-11

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" SCAN-05,SCAN-10,SCAN-11,SCAN-14,SCAN-16,SCAN-17,SCAN-19,SCAN-21,SCAN-22,VERD-11
````

Output (truncated):

````text
[
 {
  "dimension": "VERD",
  "id": "VERD-11",
  "title": "The tool identity stamps the wrong axe-core version (the @axe-core/playwright wrapper's 4.11.2, not the injected engine's 4.11.3)",
  "category": "correctness",
  "severity": "medium",
  "status": "new",
  "claim": "version.mjs reads the version from @axe-core/playwright/package.json and labels it 'axeCore'. @axe-core/playwright 4.11.2 depends on axe-core ~4.11.3 and imports it, so the engine that ran is 4.11.3. Every artefact (wcag-em-summary.tool, summary.md header, the HTML banner, the report-builder methodology.automatedTools and sourceRun.axeCoreVersion, the portal scanOptions.axeVersion) records 4.11.2. The scan stage discards axe's own testEngine.version, so the true engine version is recorded nowhere.",
  "evidence": [
   { ...
````

## 2. Bash

````bash
cd $REPO; sed -n 340,390p src/commands/scan.mjs; sed -n 50,62p src/commands/scan.mjs; sed -n 75,85p src/lib/urls.mjs; sed -n 1,60p src/lib/version.mjs | grep -n "axe" ; grep -n "withRules\|disableRules\|experimental" docs/guides/config-guide.md | head; sed -n 25,45p docs/adr/0006-multi-viewport-axe-runs.md; grep -rn "concurren\|requestDelayMs" src/commands/scan.mjs src/lib/config.mjs | head
````

Output (truncated):

````text
    // abort the scan.
    const preScanStates = await runPreScanActions({
      page,
      url,
      viewport,
      config,
      logger,
      paths,
      globalActions: config.scan?.beforeScan?.actions ?? [],
      overrideActions: Array.isArray(matchedOverride?.actions) ? matchedOverride.actions : [],
    });

    let builder = new AxeBuilder({ page });

    for (const selector of axeConfig.exclude || []) builder = builder.exclude(selector);
    for (const selector of axeConfig.include || []) builder = builder.include(selector);
    if (Array.isArray(axeConfig.withRules) && axeConfig.withRules.length > 0)
      builder = builder.withRules(axeConfig.withRules);
    if (Array.isArray(axeConfig.withTags) && axeConfig.withTags.length > 0)
      builder = builder.withTags(axeConfig.with ...
````

## 3. Bash

````bash
cd $REPO; grep -n -i "concurren\|parallel" docs/adr/0006-multi-viewport-axe-runs.md; sed -n 320,332p src/commands/scan.mjs; sed -n 395,420p src/commands/scan.mjs; grep -n "waitUntil\|waitForLoadState\|networkidle\|screenshot(" src/commands/scan.mjs | head -20; sed -n 285,295p docs/guides/config-guide.md
````

Output (truncated):

````text
20:**how much concurrency the toolkit should attempt across that
23:2 vCPU. A naive "N viewports × M URL-concurrency" cross-product
29:parallelism later without re-deciding the principle.
33:**Sequential viewports; URL concurrency lives inside a viewport; no
34:viewport-level parallelism in v1.0.**
85:  viewport adds one more layer of iteration without adding concurrency.
110:viewport concurrency. Conflating the two in one ADR would blur the
140:  target site's rate limits need respecting; concurrency tuning stays a
142:- **Future viewport-level parallelism** (v2.0 candidate): would
      });
    }

    // ANCHOR: AxeBuilderChain — apply config.scan.axe settings.
    // Per-URL overrides land here: find the first matching override by
    // compiled regex (first-match-wins per Pa11y preced ...
````

## 4. Bash

````bash
cd $REPO; grep -n "runOnly\|withRules\|withTags\|disableRules\|testEngine\|catch" node_modules/@axe-core/playwright/dist/index.mjs | head -30; node -e "console.log(require('./node_modules/axe-core/package.json').version, require('./node_modules/@axe-core/playwright/package.json').version, JSON.stringify(require('./node_modules/@axe-core/playwright/package.json').dependencies))"; ls node_modules/@axe-core/playwright/node_modules 2>/dev/null; grep -rn "testEngine\|toolOptions" src | head; grep -rln "withRules\|withTags" test | head; grep -n "uniqueItems\|viewports" src/schemas/*.json 2>/dev/null | head; ls src
````

Output (truncated):

````text
26:  }).catch((err) => {
79:    } catch (e) {
88:  return (p) => (p.catch(f), p);
141:   * Cannot be used with `AxeBuilder#withTags`
145:  withRules(rules) {
148:    this.option.runOnly = {
156:   * Cannot be used with `AxeBuilder#withRules`
160:  withTags(tags) {
163:    this.option.runOnly = {
174:  disableRules(rules) {
217:    } catch (error) {
240:      } catch (err) {
304:      } catch {
4.11.3 4.11.2 {"axe-core":"~4.11.3"}
test/unit/context-overrides-compiled.test.mjs
test/unit/config-defaults.test.mjs
test/unit/axe-utils.test.mjs
test/fixtures/site.json.template
test/e2e/reporters-html-axe.test.mjs
(eval):1: no matches found: src/schemas/*.json
commands
data
index.mjs
lib
reporters
types
````

## 5. Bash

````bash
cd $REPO; S=$(grep -rl '"withRules"' src schemas 2>/dev/null | head -3); echo $S; for f in $S; do grep -n "withRules\|withTags\|uniqueItems\|not\b\|oneOf" $f | head; done; grep -rn "unique\|duplicate" src/lib/viewports.mjs src/lib/config.mjs | head; grep -n "e2e\|test/e2e" -r test/e2e --include=*.mjs -l | head -20; grep -rn "screenshot\|__desktop" test/unit/*.mjs | grep -i "fileSafe\|buildScreenshotPath" | head
````

Output (truncated):

````text
schemas/config.schema.json
38:          "uniqueItems": true,
107:              "uniqueItems": true
115:              "uniqueItems": true
163:          "uniqueItems": true,
192:              "uniqueItems": true
345:            "withRules": {
350:              "uniqueItems": true
352:            "withTags": {
357:              "uniqueItems": true
360:              "oneOf": [
(eval):1: no matches found: --include=*.mjs
test/unit/scan-result-shape.test.mjs:3: * @file Tests for `buildScreenshotPath` — screenshot-filename helper.
test/unit/scan-result-shape.test.mjs:22:  const result = buildScreenshotPath('/out/screenshots', 'https://example.com/page', {
````

## 6. Bash

````bash
cd $REPO; grep -n '"viewports"' -A25 schemas/config.schema.json | head -40; ls test/e2e; cat test/unit/scan-result-shape.test.mjs | sed -n 15,60p; grep -n -i "axe.*version\|4\.11\|axeCore" CHANGELOG.md TODO.md docs/adr/*.md | head
````

Output (truncated):

````text
233:        "viewports": {
234-          "type": "array",
235-          "minItems": 1,
236-          "items": {
237-            "type": "object",
238-            "additionalProperties": false,
239-            "required": ["id", "width", "height"],
240-            "properties": {
241-              "id": {
242-                "type": "string",
243-                "pattern": "^[a-z0-9-]+$"
244-              },
245-              "width": {
246-                "type": "integer",
247-                "minimum": 280
248-              },
249-              "height": {
250-                "type": "integer",
251-                "minimum": 300
252-              }
253-            }
254-          }
255-        },
256-        "waitUntil": {
257-          "enum": ["load", "domcontentloaded", "networkidle", ...
````

## 7. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A15 && cd $_ && cat > p.mjs <<'EOF'
const R='$REPO/';
const {default:AxeBuilder}=await import(R+'node_modules/@axe-core/playwright/dist/index.mjs');
const b=new AxeBuilder({page:{}}).withRules(['image-alt']).withTags(['wcag2a']);
console.log(JSON.stringify(b.option));
const {buildScreenshotPath}=await import(R+'src/commands/scan.mjs');
for (const u of ['https://ex.org/a/b','https://ex.org/a_b','http://ex.org/a?b','https://ex.org/a/b#x']) console.log(buildScreenshotPath('/o',u,{id:'desktop'}));
const {applyAxeOverride}=await import(R+'src/lib/axe-utils.mjs');
console.log(JSON.stringify(applyAxeOverride({withTags:['wcag2a'],withRules:[]},{withRules:['button-name']})));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p.mjs
````

Output (truncated):

````text
{"runOnly":{"type":"tag","values":["wcag2a"]}}
/o/ex.org_a_b__desktop.png
/o/ex.org_a_b__desktop.png
/o/ex.org_a_b__desktop.png
/o/ex.org_a_b_x__desktop.png
{"withTags":["wcag2a"],"withRules":["button-name"]}
````

## 8. Bash

````bash
cd $REPO; ls docs/adr | grep 0016; grep -n -i "violation" docs/adr/0016*.md | head; grep -n "maxPages\|sampleSize\|size" src/lib/config.mjs | head; sed -n 30,70p src/lib/axe-artifact.mjs; grep -rn "target.join\|\.join(' | ')" src | head
````

Output (truncated):

````text
0016-incomplete-node-evidence.md
12:(`{id, tags, impact, nodesCount, help, helpUrl, firstTarget}`). Violations kept
68:  diagnosis of why the result needs review. Violations already carried it
64:    maxPages: 80,
147:    // board P1 size-cap item). nodesCount always keeps the true total.
/**
 * Join an axe node's `target` selector array into the canonical pipe-joined
 * string used across the pipeline (matches the violation target format in
 * `summarize.mjs`), or `null` when absent.
 *
 * @param {any} node
 * @returns {string | null}
 */
function joinTarget(node) {
  return Array.isArray(node?.target) && node.target.length ? node.target.join(' | ') : null;
}

// SECTION: Public API

/**
 * Project an axe rule-result array into the lean summary shape for the widened
 * artefact contract.  ...
````

## 9. Bash

````bash
cd $REPO; grep -rn -i "experimental\|best-practice\|frame-tested" docs README.md | head -15; grep -rn "networkidle\|waitUntil" docs/guides/*.md | head -5
````

Output (truncated):

````text
docs/adr/0007-wcag-em-summary-shape.md:47:| 3   | Any **non-best-practice** rule passed at this SC                   | `passed`       |
docs/adr/0007-wcag-em-summary-shape.md:67:### 3. `passed` excludes best-practice rules
docs/adr/0007-wcag-em-summary-shape.md:69:Best-practice rules (tagged `best-practice`) cover non-WCAG
docs/adr/0007-wcag-em-summary-shape.md:71:an SC requirement). A best-practice rule passing does NOT contribute
docs/adr/0007-wcag-em-summary-shape.md:74:purely because its best-practice landmark checks ran.
docs/adr/0007-wcag-em-summary-shape.md:158:- **Best-practice rules can still help reviewers** — they appear in
docs/adr/0007-wcag-em-summary-shape.md:159:  `summary.findings` with `classification: 'best-practice-or-manual-review'`
docs/adr/0021-waf-challenge-access-st ...
````

## 10. Bash

````bash
cd $REPO; sed -n 15,24p docs/adr/0006-multi-viewport-axe-runs.md; sed -n 80,86p docs/adr/0006-multi-viewport-axe-runs.md; sed -n 134,145p docs/adr/0006-multi-viewport-axe-runs.md
````

Output (truncated):

````text
failures. A single-viewport pass cannot find defects that only manifest
below a particular width. The WCAG-EM "structured sample" practice
explicitly names viewport variety as a sampling dimension.

This version introduces a viewports dimension. The open design question is
**how much concurrency the toolkit should attempt across that
dimension**. axe-core is CPU-bound; Playwright contexts are cheap per
viewport but share browser process memory; CI runners commonly cap at
2 vCPU. A naive "N viewports × M URL-concurrency" cross-product
multiplies resource consumption by the viewport count and risks OOM on
- **Per-viewport retry budget** — an attempt failure on URL X at
  `desktop` does not borrow from URL X's `reflow` retry budget. Each
  viewport has an independent reliability accounting.
- ...
````
