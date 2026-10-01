# Probe record: verify:A10

Role: packet verifier. Findings: REPB-01, REPB-03, REPB-04, REPB-10, REPB-11, REPB-21

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" REPB-01,REPB-03,REPB-04,REPB-10,REPB-11,REPB-21
````

Output (truncated):

````text
[
 {
  "dimension": "REPB",
  "id": "REPB-01",
  "title": "report-builder-draft.json is rejected by the consumer's current DraftReportSchema, and validateExports can't detect it",
  "category": "contract",
  "severity": "high",
  "status": "new",
  "claim": "Every draft the report-builder-starter writes now fails myweb-report-builder's current Zod DraftReportSchema, for three separate reasons. (1) reportType 'technical-audit' is no longer in the enum, which is now only 'combined-audit'. (2) Every finding's status is 'Not retested', but the finding status enum is now Open/Accepted risk/Deferred/Resolved. (3) sourceFile 'reports/summary.json#findings' and '#incompleteFindings' are not listed in sourceRun.sourceFiles, which breaks the new validateSourceFileReferences refinement. The toolkit o ...
````

## 2. Bash

````bash
cd $SCRATCH && find . -name "report-builder-draft.json" -not -path "*/node_modules/*" 2>/dev/null | head; find . -name "portal-export.json" -not -path "*/node_modules/*" | head; ls wf2 2>/dev/null
````

Output (truncated):

````text
./wf2/e2e/out2/reports/report-builder-draft.json
./wf2/e2e/noshot/reports/report-builder-draft.json
./wf2/e2e/out1/reports/report-builder-draft.json
./wf2/e2e/noproc-noshot/reports/report-builder-draft.json
./wf2/e2e/bponly/reports/report-builder-draft.json
./wf2/verify-A03/out/reports/report-builder-draft.json
./wf2/verify-A07/run2/reports/report-builder-draft.json
./wf2/verify-A07/run1/reports/report-builder-draft.json
./wf2/verify-A01/out/reports/report-builder-draft.json
./wf/proc/out-audit/reports/report-builder-draft.json
./wf2/verify-A03/out/reports/portal-export.json
./wf2/e2e/out2/reports/portal-export.json
./wf2/e2e/noshot/reports/portal-export.json
./wf2/e2e/bponly/reports/portal-export.json
./wf2/verify-A07/run2/reports/portal-export.json
./wf2/verify-A07/run1/reports/portal-ex ...
````

## 3. Bash

````bash
cd $RB && head -20 src/schemas/report.schema.js | grep -n import; ls node_modules/zod/package.json && node -e "console.log(require('$RB/node_modules/zod/package.json').version)"; grep -n "import" src/schemas/package-metadata.js 2>/dev/null | head; ls src/schemas
````

Output (truncated):

````text
7:import { z } from "zod";
8:import {
node_modules/zod/package.json
4.4.3
README.md
report.schema.js
````

## 4. Bash

````bash
S=$SCRATCH/wf2/verify-A10; mkdir -p $S/rb/src/schemas $S/rb/src/packages $S/rb/node_modules; cp $RB/src/schemas/report.schema.js $S/rb/src/schemas/; cp $RB/src/packages/package-metadata.js $S/rb/src/packages/; head -20 $S/rb/src/packages/package-metadata.js | grep import; ln -sf $RB/node_modules/zod $S/rb/node_modules/zod; cat $RB/package.json | grep -n '"type"'; echo '{"type":"module"}' > $S/rb/package.json; ls $REPO/test/fixtures/static-site
````

Output (truncated):

````text
5:  "type": "module",
about.html
contact.html
index.html
sitemap.xml
xss.html
````

## 5. Bash

````bash
S=$SCRATCH/wf2/verify-A10; mkdir -p $S/site; cat > $S/site/index.html <<'EOF'
<!doctype html><html lang="en"><head><title>Home</title></head><body><main>
<h1>Home</h1>
<img src="x.png">
<p style="color:#aaa;background:#fff">Low contrast text here</p>
<p style="letter-spacing: 0.05em !important">Tight spacing text</p>
<a href="/about.html">About</a>
<input type="text">
</main></body></html>
EOF
cat > $S/site/about.html <<'EOF'
<!doctype html><html lang="en"><head><title>About</title></head><body><main><h1>About</h1><p>Plain page.</p><a href="/index.html">Home</a><button></button></main></body></html>
EOF
cat > $S/run.mjs <<'EOF'
import { startFixtureServer } from 'file://$REPO/test/fixtures/server.mjs';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const S = process.argv[2]; const mode = process.argv[3] ?? 'warn'; const out = process.argv[4] ?? `${S}/out`;
const srv = await startFixtureServer({ staticDir: `${S}/site` });
const tpl = JSON.parse((await fs.readFile('$REPO/test/fixtures/site.json.template','utf8')).replaceAll('__BASE_URL__', srv.baseUrl));
tpl.crawl.sitemapSeeding.enabled = false;
tpl.scan.fullPageScreenshots = false;
tpl.reporting.reporters = ['json','portal-export','report-builder-starter'];
tpl.reporting.validateExports = mode;
await fs.writeFile(`${S}/cfg.json`, JSON.stringify(tpl, null, 2));
const cmd = process.argv[5] ?? 'audit';
const child = spawn(process.execPath, ['$REPO/bin/wcag-em.mjs', cmd, '--config', `${S}/cfg.json`, '--out-dir', out], { cwd: S, env: { ...process.env, CRAWLEE_STORAGE_DIR: `${S}/crawlee-storage` }, stdio: ['ignore','pipe','pipe'] });
let log=''; child.stdout.on('data', d=>log+=d); child.stderr.on('data', d=>log+=d);
const code = await new Promise(r=>child.on('close', r));
await fs.writeFile(`${S}/${cmd}-${mode}.log`, log);
console.log('exit', code);
await srv.stop();
EOF
cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && timeout 300 node run.mjs $S warn $S/out audit; ls $S/out/reports; grep -c . $S/audit-warn.log; grep -i "vendored contract\|error" $S/audit-warn.log | head
````

Output (truncated):

````text
(eval):34: command not found: timeout
ls: $SCRATCH/wf2/verify-A10/out/reports: No such file or directory
ugrep: warning: $SCRATCH/wf2/verify-A10/audit-warn.log: No such file or directory
ugrep: warning: $SCRATCH/wf2/verify-A10/audit-warn.log: No such file or directory
````

## 6. Bash

````bash
S=$SCRATCH/wf2/verify-A10; cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node run.mjs $S warn $S/out audit; ls $S/out/reports; /usr/bin/grep -i "vendored contract\|\"level\":50\|\"level\":40" $S/audit-warn.log | cut -c1-300 | head
````

Output (truncated):

````text
exit 2
grouped-by-component.json
grouped-by-rule.json
manual-backlog.md
portal-export.json
random-vs-structured-comparison.json
report-builder-draft.json
summary.json
wcag-em-summary.json
````

## 7. Bash

````bash
S=$SCRATCH/wf2/verify-A10; cat > $S/rb/parse.mjs <<'EOF'
import fs from 'node:fs';
import { DraftReportSchema } from './src/schemas/report.schema.js';
const d = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const variants = { asIs: d };
const patched = structuredClone(d); patched.reportType='combined-audit'; for (const f of patched.findings) f.status='Open';
variants.patchedTypeStatus = patched;
const p2 = structuredClone(patched); p2.sourceRun.sourceFiles.push('reports/summary.json#findings','reports/summary.json#incompleteFindings');
variants.patchedAll = p2;
for (const [k,v] of Object.entries(variants)) {
  const r = DraftReportSchema.safeParse(v);
  const agg = {};
  if (!r.success) for (const i of r.error.issues) { const key = i.path.map(p=>typeof p==='number'?'#':p).join('.')+' :: '+i.message.slice(0,90); agg[key]=(agg[key]??0)+1; }
  console.log(k, r.success, JSON.stringify(agg, null, 1));
}
console.log('findings', d.findings.length, 'statuses', [...new Set(d.findings.map(f=>f.status))], 'reportType', d.reportType, 'schemaVersion', d.schemaVersion);
EOF
cd $S/rb && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node parse.mjs $S/out/reports/report-builder-draft.json; shasum $RB/src/schemas/report.schema.js src/schemas/report.schema.js
````

Output (truncated):

````text
asIs false {
 "reportType :: Invalid input: expected \"combined-audit\"": 1,
 "findings.#.status :: Invalid option: expected one of \"Open\"|\"Accepted risk\"|\"Deferred\"|\"Resolved\"": 5
}
patchedTypeStatus false {
 "findings.#.sourceReferences.#.sourceFile :: Source file is not listed in sourceRun.sourceFiles: reports/summary.json#findings": 5,
 "findings.#.evidence.#.source.sourceFile :: Source file is not listed in sourceRun.sourceFiles: reports/summary.json#findings": 5
}
patchedAll true {}
findings 5 statuses [ 'Not retested' ] reportType technical-audit schemaVersion 1.0
c2a395857e1fac09bfe88f0c057e529818ced0da  $RB/src/schemas/report.schema.js
c2a395857e1fac09bfe88f0c057e529818ced0da  src/schemas/report.schema.js
````

## 8. Bash

````bash
cd $RB && sed -n 60,90p src/engine/build-report.js | /usr/bin/grep -n "parse\|Draft" ; cd $REPO && /usr/bin/grep -n -i -e "report-builder" -e "DraftReportSchema" -e "consumer-side" -e "contractVersion" TODO.md | cut -c1-260 | head -20; echo ----; sed -n 85,110p docs/guides/integrations.md
````

Output (truncated):

````text
7:  if (allowDraft) {
8:    return DraftReportSchema.parse(data);
11:  const draftResult = DraftReportSchema.safeParse(data);
14:      "Draft report input is not allowed for build:report. Use --allow-draft or npm run build:draft-report -- <path> for draft previews.",
52:- [ ] **E4 final-URL re-key in `portal-export` / `report-builder`** — deferred
110:- [x] **report-builder contract breaks (x2) + starter exporter.** Live v1.1 output
113:      commissioned `report-builder-starter` reporter emitting DraftReportSchema
128:      schema; add a `contractVersion` to the payload, negotiated at upload, so
138:      payload `contractVersion` remain (verified absent 2026-06-12)._
164:      portal's "provide WCAG criteria tags" prompt. _Report-builder side
178:      the toolkit knows the method; `''`  ...
````

## 9. Bash

````bash
S=$SCRATCH/wf2/verify-A10; cat > $S/portal-port.mjs <<'EOF'
import fs from 'node:fs';
const WCAG_DOTTED=/^\d\.\d\.\d$/, WCAG_COMPACT=/^wcag(\d)(\d)(\d)$/i;
const nws=(v)=>{const t=v.trim(); if(!t) return null; if(WCAG_DOTTED.test(t)) return t; const m=t.match(WCAG_COMPACT); if(m) return `${m[1]}.${m[2]}.${m[3]}`; const n=t.replace(/[^0-9]/g,''); return n.length===3?`${n[0]}.${n[1]}.${n[2]}`:null;};
const nc=(v)=>{if(typeof v==='number')return v; if(typeof v==='string'){const f=parseFloat(v); if(Number.isFinite(f)) return f; const n=v.trim().toLowerCase(); if(n==='high'||n==='confirmed')return .9; if(n==='medium'||n==='promoted')return .7; if(n==='low')return .4; if(n==='manual-review')return .25;} return undefined;};
const e = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for (const f of e.rawFindings) {
  const inst = f.instances ?? [];
  console.log(f.ruleId, f.impact, '| toolkit wcag', JSON.stringify(f.wcag), '-> portal', JSON.stringify(f.wcag.map(nws).filter(Boolean)), '| top evidence.html', !!f.evidence?.html, '| inst n', inst.length, 'htmlSnippet', inst.some(i=>typeof i.htmlSnippet==='string'), 'evidence.html', inst.some(i=>typeof i.evidence?.html==='string'), 'engine', [...new Set(inst.map(i=>typeof i.engine==='string'&&i.engine.trim()?i.engine:'unknown'))].join(), '| conf', f.confidence, '->', nc(f.confidence));
}
console.log('summary keys', Object.keys(e.summary), 'scoreBasis?', 'scoreBasis' in e.summary, 'execHealth?', !!e.scan?.scanOptions?.executionHealth || JSON.stringify(Object.keys(e.scan ?? e)).slice(0,200));
EOF
cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node portal-port.mjs out/reports/portal-export.json
````

Output (truncated):

````text
button-name critical | toolkit wcag ["4.1.2"] -> portal ["4.1.2"] | top evidence.html true | inst n 1 htmlSnippet false evidence.html true engine unknown | conf automated -> undefined
image-alt critical | toolkit wcag ["1.1.1"] -> portal ["1.1.1"] | top evidence.html true | inst n 2 htmlSnippet false evidence.html true engine unknown | conf automated -> undefined
label critical | toolkit wcag ["4.1.2"] -> portal ["4.1.2"] | top evidence.html true | inst n 2 htmlSnippet false evidence.html true engine unknown | conf automated -> undefined
avoid-inline-spacing serious | toolkit wcag ["1.4.12"] -> portal [] | top evidence.html true | inst n 2 htmlSnippet false evidence.html true engine unknown | conf automated -> undefined
color-contrast serious | toolkit wcag ["1.4.3"] -> portal ["1.4.3"] |  ...
````

## 10. Bash

````bash
S=$SCRATCH/wf2/verify-A10; rm -rf $S/out-err && cp -R $S/out $S/out-err && cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e '
const fs=require("fs"); const S=process.argv[1];
const c=JSON.parse(fs.readFileSync(S+"/cfg.json","utf8")); c.reporting.validateExports="error"; c.reporting.reporters=["json","portal-export","report-builder-starter"]; fs.writeFileSync(S+"/cfg-error.json", JSON.stringify(c,null,2));
const p=S+"/out-err/results/axe-results.json"; const j=JSON.parse(fs.readFileSync(p,"utf8")); let n=0;
const walk=o=>{ if(Array.isArray(o)) o.forEach(walk); else if(o&&typeof o==="object"){ for(const k of Object.keys(o)){ if(k==="html"&&typeof o[k]==="string"){ delete o[k]; n++; } else walk(o[k]); } } };
walk(j); fs.writeFileSync(p, JSON.stringify(j)); console.log("stripped", n);
' $S; stat -f '%Sm %N' -t '%T' out-err/reports/portal-export.json out-err/reports/summary.json out-err/reports/report-builder-draft.json; /usr/bin/grep -o '"generatedAt": *"[^"]*"' out-err/reports/portal-export.json out-err/reports/summary.json | head -3
````

Output (truncated):

````text
stripped 11
20:00:56 out-err/reports/portal-export.json
20:00:56 out-err/reports/summary.json
20:00:56 out-err/reports/report-builder-draft.json
out-err/reports/summary.json:"generatedAt": "2026-09-30T18:58:53.257Z"
````

## 11. Bash

````bash
S=$SCRATCH/wf2/verify-A10; cd $S && shasum out-err/reports/*.json | sed 's#.*/##' > before.sha; cat > sum.mjs <<'EOF'
import { spawn } from 'node:child_process'; import fs from 'node:fs/promises';
const [S, cfg, out, tag] = process.argv.slice(2);
const child = spawn(process.execPath, ['$REPO/bin/wcag-em.mjs','summarize','--config',cfg,'--out-dir',out], { cwd: S, env: { ...process.env, CRAWLEE_STORAGE_DIR: `${S}/crawlee-storage` }, stdio: ['ignore','pipe','pipe'] });
let log=''; child.stdout.on('data',d=>log+=d); child.stderr.on('data',d=>log+=d);
const code = await new Promise(r=>child.on('close',r)); await fs.writeFile(`${S}/${tag}.log`, log); console.log('exit', code);
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node sum.mjs $S $S/cfg-error.json $S/out-err summarize-error; shasum out-err/reports/*.json | sed 's#.*/##' > after.sha; paste before.sha after.sha | awk '{print ($1==$3?"SAME   ":"CHANGED"), $2}'; /usr/bin/grep -o '"level":[45]0[^\n]\{0,260\}' summarize-error.log | cut -c1-260; /usr/bin/grep -c . summarize-error.log
````

Output (truncated):

````text
exit 2
CHANGED grouped-by-component.json
CHANGED grouped-by-rule.json
CHANGED portal-export.json
CHANGED random-vs-structured-comparison.json
CHANGED report-builder-draft.json
CHANGED summary.json
CHANGED wcag-em-summary.json
grep: maximum repetition exceeds 255
3
````

## 12. Bash

````bash
S=$SCRATCH/wf2/verify-A10; cd $S && cut -c1-600 summarize-error.log; node -e 'const e=require(process.argv[1]); for(const f of e.rawFindings) console.log(f.ruleId,f.impact,JSON.stringify(f.evidence?.html), f.instances.map(i=>i.evidence?.html))' $S/out-err/reports/portal-export.json 2>/dev/null || (source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 22 >/dev/null; node -e 'const e=require(process.argv[1]); for(const f of e.rawFindings) console.log(f.ruleId,f.impact,JSON.stringify(f.evidence?.html), f.instances.map(i=>i.evidence?.html))' $S/out-err/reports/portal-export.json)
````

Output (truncated):

````text
{"level":40,"time":"2026-09-30T19:01:09.171Z","pid":45333,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","reporter":"portal-export","findings":["button-name","image-alt","label","avoid-inline-spacing","color-contrast"],"msg":"portal-export: 5 critical/high finding(s) lack HTML evidence; the portal will flag these as \"missing evidence.html\". Re-run the scan to capture node evidence."}
{"level":50,"time":"2026-09-30T19:01:09.224Z","pid":45333,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","reporter":"portal-export","err":{"type":"Object","message":"portal-export: payload fails the vendored contract: /rawFindings/0/evidence/html must be string; /rawFindings/0/instances/0/evidence/html must be string; /rawFindi ...
````

## 13. Bash

````bash
S=$SCRATCH/wf2/verify-A10; cd $S && cat before.sha | head -3; cat after.sha | head -3; shasum out/reports/portal-export.json out-err/reports/portal-export.json; cmp out/reports/portal-export.json out-err/reports/portal-export.json && echo IDENTICAL-TO-PRE-RUN; /usr/bin/grep -o '"generatedAt": *"[^"]*"' out-err/reports/summary.json out-err/reports/report-builder-draft.json; /usr/bin/grep -o '"scannedAt": *"[^"]*"\|"generatedAt": *"[^"]*"' out-err/reports/portal-export.json | head -2
````

Output (truncated):

````text
grouped-by-component.json
grouped-by-rule.json
portal-export.json
grouped-by-component.json
grouped-by-rule.json
portal-export.json
0ed1207f95be54fdf4a0922474ae7d3b5e6f0eaf  out/reports/portal-export.json
0ed1207f95be54fdf4a0922474ae7d3b5e6f0eaf  out-err/reports/portal-export.json
IDENTICAL-TO-PRE-RUN
out-err/reports/summary.json:"generatedAt": "2026-09-30T19:01:09.168Z"
out-err/reports/report-builder-draft.json:"generatedAt": "2026-09-30"
out-err/reports/report-builder-draft.json:"generatedAt": "2026-09-30"
````

## 14. Bash

````bash
S=$SCRATCH/wf2/verify-A10; cd $RB && git show "origin/master:src/schemas/report.schema.js" | sed -n 39,44p; mkdir -p $S/rbm/src/schemas $S/rbm/src/packages $S/rbm/node_modules; git show "origin/master:src/schemas/report.schema.js" > $S/rbm/src/schemas/report.schema.js; git show "origin/master:src/packages/package-metadata.js" > $S/rbm/src/packages/package-metadata.js 2>/dev/null || echo "no package-metadata on master"; ln -sf $RB/node_modules/zod $S/rbm/node_modules/zod; echo '{"type":"module"}' > $S/rbm/package.json; cp $S/rb/parse.mjs $S/rbm/; cd $S/rbm && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node parse.mjs $S/out/reports/report-builder-draft.json
````

Output (truncated):

````text
export const FindingStatusSchema = z.enum([
  "Open",
  "Accepted risk",
  "Deferred",
  "Resolved",
]);
asIs false {
 "reportType :: Invalid input: expected \"combined-audit\"": 1,
 "findings.#.status :: Invalid option: expected one of \"Open\"|\"Accepted risk\"|\"Deferred\"|\"Resolved\"": 5
}
patchedTypeStatus false {
 "findings.#.sourceReferences.#.sourceFile :: Source file is not listed in sourceRun.sourceFiles: reports/summary.json#findings": 5,
 "findings.#.evidence.#.source.sourceFile :: Source file is not listed in sourceRun.sourceFiles: reports/summary.json#findings": 5
}
patchedAll true {}
findings 5 statuses [ 'Not retested' ] reportType technical-audit schemaVersion 1.0
````

## 15. Bash

````bash
cd $PORTAL && git show origin/master:backend/src/scans/scans.service.ts > $SCRATCH/wf2/verify-A10/scans.service.master.ts; F=$SCRATCH/wf2/verify-A10/scans.service.master.ts; /usr/bin/grep -n "missingCodeSnippetCount\|missingEvidenceCount\|hasCodeSnippet\|hasInstanceSnippet\|hasEvidenceHtml" $F | head -20
````

Output (truncated):

````text
105:    missingEvidenceCount: number;
107:    missingCodeSnippetCount: number;
1065:    let missingEvidenceCount = 0;
1067:    let missingCodeSnippetCount = 0;
1081:      const hasCodeSnippet = hasEvidence || this.hasRemediationCodeSnippet(finding);
1102:          missingEvidenceCount += 1;
1107:        if (!hasCodeSnippet) {
1108:          missingCodeSnippetCount += 1;
1110:        if (hasEvidence && hasRemediation && hasCodeSnippet) {
1122:    if (missingEvidenceCount > 0) {
1125:        message: `Add evidence.html or instances[].htmlSnippet for ${missingEvidenceCount} critical/high finding${this.pluralSuffix(missingEvidenceCount)} to improve extracted code and issue traceability.`,
1134:    if (missingCodeSnippetCount > 0) {
1137:        message: `Provide code snippets (evidence htmlSni ...
````

## 16. Bash

````bash
F=$SCRATCH/wf2/verify-A10/scans.service.master.ts; sed -n 1072,1085p $F; /usr/bin/grep -n "private hasFindingEvidence\|private hasEvidence" -A14 $F | head -20
````

Output (truncated):

````text
      const hasSelector =
        (typeof finding.selector === 'string' && finding.selector.trim().length > 0) ||
        finding.instances?.some(
          (instance) =>
            typeof instance?.selector === 'string' && instance.selector.trim().length > 0,
        ) === true;
      const hasWcag = Array.isArray(finding.wcag) && finding.wcag.length > 0;
      const hasEvidence = this.hasEvidenceSnippet(finding);
      const hasRemediation = this.hasRemediationContent(finding);
      const hasCodeSnippet = hasEvidence || this.hasRemediationCodeSnippet(finding);
      const isCriticalOrHigh =
        finding.impact === 'critical' ||
        finding.impact === 'serious' ||
        (typeof finding.priorityScore === 'number' && finding.priorityScore <= 2);
1245:  private hasEvidenceSnippet( ...
````
