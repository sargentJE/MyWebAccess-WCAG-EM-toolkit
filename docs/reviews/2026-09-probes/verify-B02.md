# Probe record: verify:B02

Role: packet verifier. Findings: STRESS-04, STRESS-07, STRESS-08, OPS-14, E2E-06

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
sed -n 118,135p TODO.md; echo ---; sed -n 198,215p TODO.md; echo ---; grep -n "STRESS-0[478]\|OPS-14\|E2E-06\|SCAN-20\|REPB-18\|REPA-09" $SCRATCH/review/round1-index.txt
````

Output (truncated):

````text
      documents polling that does not exist. Review C5 (probe-confirmed).
      -> Sprint 1 T1.
- [x] **`sample.json` resolves against CWD** (context.mjs:232), ignoring
      `--out-dir` — concurrent/sequential runs from one shell cross-contaminate
      (demonstrated during the review). Move under outDir. -> Sprint 1 T4.
- [x] **Corrupt-artifact hardening.** `readJsonMaybe` treats `SyntaxError` like
      ENOENT (fs-utils.mjs:69-75) and `writeJson` is non-atomic — a corrupt
      `axe-results.json` yields an exit-0 "clean" report (probe P3). Distinguish + warn loudly; temp+rename writes. -> Sprint 1 T3.
- [ ] **Portal contract source-of-truth.** Replace the empirically-derived
      `schemas/portal-canonical-scan.schema.json` with the portal's published
      schema; add a `contractVersio ...
````

## 2. Bash

````bash
sed -n 170,185p src/commands/scan.mjs; echo ---; grep -n "writeJson\|rm(\|unlink\|mkdir\|screenshotPath\s*=" src/commands/scan.mjs; echo ---; sed -n 440,470p src/commands/scan.mjs; echo; sed -n 180,240p bin/wcag-em.mjs; echo; sed -n 100,125p bin/wcag-em.mjs
````

Output (truncated):

````text
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ pagesScanned: number, pagesFailed: number }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;
  const sampleUrls = JSON.parse(await fs.readFile(paths.sampleJsonPath, 'utf8'));

  // ANCHOR: PreScanActionsReady — beforeScan.actions[] and override.actions[]
  // are executed per-URL (URL-matching via compiled action.regex).
  // The companion `reporting.reporters` warn in summarize.mjs was retired
  // when the reporter pipeline shipped; only `auth.setupScript`
  // still uses warnSchemaAcceptedRuntimeIgnored today.

  const viewports = resolveViewports(config, logger);
  logger.info({ viewports: viewports.map((vp) => vp.id) }, 'scan viewports');
---
26:i ...
````

## 3. Bash

````bash
ls $SCRATCH/ $SCRATCH/wf2/ 2>&1 | head -50
````

Output (truncated):

````text
$SCRATCH/:
gate
review
wf
wf2

$SCRATCH/wf2/:
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
````

## 4. Bash

````bash
sed -n 395,440p src/lib/wcag-em-summary.mjs; grep -n "function buildScreenshotPath" -A15 src/commands/scan.mjs src/lib/*.mjs | head -25
````

Output (truncated):

````text
  const excludedByOutcome = new Map();
  for (const page of axeResults) {
    const url = String(page?.url ?? '');
    if (isAuditableView(page)) {
      auditedUrls.add(url);
    } else {
      const key = typeof page?.pageOutcome === 'string' ? page.pageOutcome : viewStatus(page);
      const set = excludedByOutcome.get(key) ?? new Set();
      set.add(url);
      excludedByOutcome.set(key, set);
    }
  }
  const scopeExclusions = [...excludedByOutcome.entries()]
    .map(([outcome, urls]) => ({
      outcome,
      count: urls.size,
      examples: [...urls].sort().slice(0, 5),
    }))
    .sort((a, b) => (a.outcome < b.outcome ? -1 : a.outcome > b.outcome ? 1 : 0));
  const pagesAudited = auditedUrls.size;
  const pagesExcluded = scopeExclusions.reduce((n, e) => n + e.count, 0);
  con ...
````

## 5. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-B02 && cat > $SCRATCH/wf2/verify-B02/probe.mjs <<'EOF'
// verify-B02 probe: one server, one baseline audit, then derived out-dirs per finding.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const S = path.dirname(new URL(import.meta.url).pathname);
const REPO = '$REPO';
const BIN = path.join(REPO, 'bin/wcag-em.mjs');
const env = { ...process.env, CRAWLEE_STORAGE_DIR: path.join(S, 'crawlee-storage'), NO_COLOR: '1' };

let hang = false;
const page = (t, body) => `<!doctype html><html lang="en"><head><title>${t}</title></head><body><main><h1>${t}</h1>${body}</main></body></html>`;
const links = ['p1','p2','p3','p4','p5','hang'].map((p) => `<a href="/${p}.html">${p}</a>`).join(' ');
const server = createServer((req, res) => {
  res.setHeader('Connection', 'close');
  const u = (req.url || '/').split('?')[0];
  if (u === '/hang.html' && hang) { setTimeout(() => { try { res.end(page('hang', 'late')); } catch {} }, 90000); return; }
  if (u === '/sitemap.xml' || u === '/robots.txt') { res.statusCode = 404; return res.end(); }
  const name = u === '/' || u === '/index.html' ? 'index' : u.replace(/^\//, '').replace(/\.html$/, '');
  if (!['index','p1','p2','p3','p4','p5','hang'].includes(name)) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(page(name, `<p>${links}</p><img src="/x-${name}.png">`));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const BASE = `http://127.0.0.1:${server.address().port}`;

const tpl = JSON.parse(await fs.readFile(path.join(REPO, 'test/fixtures/site.json.template'), 'utf8').then((s) => s.replaceAll('__BASE_URL__', BASE)));
tpl.crawl.maxPages = 20;
tpl.crawl.sitemapSeeding.enabled = false;
tpl.scan.viewports = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'mobile', width: 390, height: 844 }];
tpl.scan.timeoutMs = 60000;
tpl.sample.autoSuggest.enabled = false;
const cfg1 = structuredClone(tpl);
cfg1.sample.structuredManual = ['index', 'p1', 'p2', 'p3', 'p4'].map((p) => `${BASE}/${p}.html`);
cfg1.sample.randomPercentOfStructured = 0; cfg1.sample.minRandomPages = 0;
const cfg2 = structuredClone(tpl);
cfg2.sample.structuredManual = [`${BASE}/p5.html`, `${BASE}/hang.html`];
cfg2.sample.randomPercentOfStructured = 0; cfg2.sample.minRandomPages = 0;
await fs.writeFile(path.join(S, 'cfg1.json'), JSON.stringify(cfg1, null, 2));
await fs.writeFile(path.join(S, 'cfg2.json'), JSON.stringify(cfg2, null, 2));

const out = {};
function run(label, args, { killAfterMs } = {}) {
  return new Promise((resolve) => {
    const cp = spawn(process.execPath, [BIN, ...args], { cwd: S, env });
    let buf = '';
    cp.stdout.on('data', (d) => (buf += d)); cp.stderr.on('data', (d) => (buf += d));
    let timer;
    if (killAfterMs) timer = setTimeout(() => {
      try { out[label + '_children_before_sigint'] = execSync(`pgrep -P ${cp.pid} || true`).toString().trim(); } catch {}
      cp.kill('SIGINT');
    }, killAfterMs);
    cp.on('exit', async (code, sig) => {
      clearTimeout(timer);
      await fs.writeFile(path.join(S, `${label}.log`), buf);
      const lines = buf.split('\n');
      const warnErr = lines.filter((l) => /"level":(40|50|60)/.test(l) || /\b(WARN|ERROR|FATAL)\b/.test(l));
      resolve({ code, sig, warnErrCount: warnErr.length, warnErr: warnErr.map((l) => l.slice(0, 300)) });
    });
  });
}
const cp = (a, b) => fs.cp(path.join(S, a), path.join(S, b), { recursive: true });
const mdLines = async (dir) => (await fs.readFile(path.join(S, dir, 'reports/summary.md'), 'utf8')).split('\n').filter((l) => /Final selected sample|Sample pages scanned|Automated coverage|Grouped findings|Inventory/i.test(l));
const pick = async (dir) => { const s = JSON.parse(await fs.readFile(path.join(S, dir, 'reports/summary.json'), 'utf8')); return { finalSampleCount: s.finalSampleCount, inventoryCount: s.inventoryCount, samplePagesScanned: s.samplePagesScanned, pageViewsScanned: s.pageViewsScanned, groupedFindingCount: s.groupedFindingCount, automatedCoverage: s.wcagEmSummary?.automatedCoverage, scanWarnings: s.scanWarnings?.length, findingUrls: [...new Set((s.findings||[]).flatMap((f) => (f.pages||f.urls||f.occurrencesByPage||[]).map?.((p)=> typeof p==='string'?p:p.url) ?? []))] }; };

try {
  for (const d of ['out1','run2','e7','e8a','e8b','e6copy','e8c','e8d']) await fs.rm(path.join(S, d), { recursive: true, force: true });
  // Baseline
  out.audit1 = await run('audit1', ['audit', '--config', 'cfg1.json', '--out-dir', path.join(S, 'out1')]);
  out.out1 = { md: await mdLines('out1'), pick: await pick('out1') };
  out.out1_resummarize = await run('out1_resum', ['summarize', '--config', 'cfg1.json', '--out-dir', path.join(S, 'out1')]);

  // STRESS-04: copy, re-sample with cfg2, scan interrupted by SIGINT while stuck on /hang.html, then summarize
  await cp('out1', 'run2');
  const axeP = path.join(S, 'run2/results/axe-results.json');
  const mtimeBefore = (await fs.stat(axeP)).mtime.toISOString();
  out.s04_sample = await run('s04_sample', ['sample', '--config', 'cfg2.json', '--out-dir', path.join(S, 'run2')]);
  out.s04_sampleJson = JSON.parse(await fs.readFile(path.join(S, 'run2/sample.json'), 'utf8'));
  hang = true;
  out.s04_scan = await run('s04_scan', ['scan', '--config', 'cfg2.json', '--out-dir', path.join(S, 'run2')], { killAfterMs: 20000 });
  hang = false;
  out.s04_axe_mtime = { before: mtimeBefore, after: (await fs.stat(axeP)).mtime.toISOString() };
  out.s04_summarize = await run('s04_summ', ['summarize', '--config', 'cfg2.json', '--out-dir', path.join(S, 'run2')]);
  out.s04 = { md: await mdLines('run2'), pick: await pick('run2') };

  // STRESS-07: inventory dir removed
  await cp('out1', 'e7');
  await fs.rm(path.join(S, 'e7/inventory'), { recursive: true });
  out.s07_summarize = await run('s07_summ', ['summarize', '--config', 'cfg1.json', '--out-dir', path.join(S, 'e7')]);
  out.s07 = { md: await mdLines('e7'), pick: await pick('e7') };

  // STRESS-08: truncated and missing axe-results
  await cp('out1', 'e8a');
  const full = await fs.readFile(path.join(S, 'e8a/results/axe-results.json'), 'utf8');
  await fs.writeFile(path.join(S, 'e8a/results/axe-results.json'), full.slice(0, Math.floor(full.length / 2)));
  out.s08a_summarize = await run('s08a_summ', ['summarize', '--config', 'cfg1.json', '--out-dir', path.join(S, 'e8a')]);
  out.s08a = { md: await mdLines('e8a') };
  await cp('out1', 'e8b');
  await fs.rm(path.join(S, 'e8b/results/axe-results.json'));
  out.s08b_summarize = await run('s08b_summ', ['summarize', '--config', 'cfg1.json', '--out-dir', path.join(S, 'e8b')]);
  out.s08b = { md: await mdLines('e8b') };
  // sample on truncated inventory.json; scan on truncated sample.json (error message names file?)
  await cp('out1', 'e8c');
  const inv = await fs.readFile(path.join(S, 'e8c/inventory/inventory.json'), 'utf8');
  await fs.writeFile(path.join(S, 'e8c/inventory/inventory.json'), inv.slice(0, 200));
  out.s08c_sample = await run('s08c_sample', ['sample', '--config', 'cfg1.json', '--out-dir', path.join(S, 'e8c')]);
  await cp('out1', 'e8d');
  const sj = await fs.readFile(path.join(S, 'e8d/sample.json'), 'utf8');
  await fs.writeFile(path.join(S, 'e8d/sample.json'), sj.slice(0, 40));
  out.s08d_scan = await run('s08d_scan', ['scan', '--config', 'cfg1.json', '--out-dir', path.join(S, 'e8d')]);

  // E2E-06: copy then re-summarize
  await cp('out1', 'e6copy');
  out.e6_summarize = await run('e6_summ', ['summarize', '--config', 'cfg1.json', '--out-dir', path.join(S, 'e6copy')]);
  const srcs = (d) => fs.readFile(path.join(S, d, 'reports/summary.html'), 'utf8').then((h) => [...new Set([...h.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]))]);
  out.e6 = { out1Srcs: (await srcs('out1')).slice(0, 4), copySrcs: (await srcs('e6copy')).slice(0, 4) };
} finally {
  server.close();
  server.closeAllConnections?.();
}
await fs.writeFile(path.join(S, 'probe-result.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
EOF
echo ok
````

Output (truncated):

````text
ok
````

## 6. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $SCRATCH/wf2/verify-B02 && node probe.mjs > probe-stdout.txt 2>&1; echo exit=$?; wc -c probe-stdout.txt
````

Output (truncated):

````text
exit=1
    1011 probe-stdout.txt
````

## 7. Bash

````bash
cd $SCRATCH/wf2/verify-B02 && cat probe-stdout.txt; ls; tail -30 audit1.log 2>/dev/null
````

Output (truncated):

````text
node:internal/fs/promises:638
  return new FileHandle(await PromisePrototypeThen(
                        ^

Error: ENOENT: no such file or directory, open '$SCRATCH/wf2/verify-B02/out1/reports/summary.html'
    at async open (node:internal/fs/promises:638:25)
    at async Object.readFile (node:internal/fs/promises:1242:14)
    at async file://$SCRATCH/wf2/verify-B02/probe.mjs:119:25 {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '$SCRATCH/wf2/verify-B02/out1/reports/summary.html'
}

Node.js v22.14.0
audit1.log
cfg1.json
cfg2.json
crawlee-storage
e6_summ.log
e6copy
e7
e8a
e8b
e8c
e8d
out1
out1_resum.log
probe-stdout.txt
probe.mjs
run2
s04_sample.log
s04_scan.log
s04_summ.log
s07_summ.log
s08a_summ.log
s08b_summ.log
s08c_sample.log
s08d_scan.log
{"level":30,"time":"2026-09-30T1 ...
````

## 8. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $SCRATCH/wf2/verify-B02 && sed -i '' "s/^tpl.sample.autoSuggest.enabled = false;/tpl.sample.autoSuggest.enabled = false;\ntpl.reporting.reporters = ['json','markdown','html','portal-export'];/" probe.mjs && grep -n "reporters" probe.mjs && node probe.mjs > probe-stdout.txt 2>&1; echo exit=$?; pgrep -fl "verify-B02" | head
````

Output (truncated):

````text
36:tpl.reporting.reporters = ['json','markdown','html','portal-export'];
exit=0
````

## 9. Bash

````bash
cd $SCRATCH/wf2/verify-B02 && cat probe-result.json | head -250
````

Output (truncated):

````text
{
  "audit1": {
    "code": 2,
    "sig": null,
    "warnErrCount": 1,
    "warnErr": [
      "{\"level\":40,\"time\":\"2026-09-30T19:20:53.501Z\",\"pid\":82687,\"tool\":\"wcag-em-a11y-toolkit\",\"toolVersion\":\"1.1.0\",\"axeCore\":\"4.11.2\",\"name\":\"wcag-em\",\"missing\":[\"http://127.0.0.1:57138/index.html\"],\"msg\":\"structured sample contains URLs not found in inventory\"}"
    ]
  },
  "out1": {
    "md": [
      "- Inventory count: 7",
      "- Final selected sample: 5",
      "- Sample pages scanned: 5",
      "- Grouped findings: 1",
      "- Automated coverage: complete (5/5 selected pages audited)",
      "- Force-included sample URL not in crawl inventory: http://127.0.0.1:57138/index.html",
      "## Grouped findings by rule"
    ],
    "pick": {
      "finalSampleCount":  ...
````

## 10. Bash

````bash
cd $SCRATCH/wf2/verify-B02 && ps -p 82826 -o pid,command 2>/dev/null | head -2; grep -c "unreadable" s08a_summ.log; grep -o '"file":"[^"]*"' s08a_summ.log | sed 's#.*verify-B02/##' ; grep -o 'inventory.json\|sample.json' s08c_sample.log s08d_scan.log | sort | uniq -c; grep -o '"stack":"[^"]\{0,400\}' s08d_scan.log | head -2; cd $REPO && grep -n "function computeExitCode" -A30 src/commands/summarize.mjs | head -40
````

Output (truncated):

````text
  PID COMMAND
3
e8a/results/axe-results.json"
e8a/results/axe-results.json"
e8a/results/axe-results.json"
"stack":"SyntaxError: Unexpected end of JSON input\n    at JSON.parse (<anonymous>)\n    at run (file://$REPO/src/commands/scan.mjs:176:27)\n    at async file://$REPO/bin/wcag-em.mjs:157:7\n    at async Command.handler 
55:export function computeExitCode(summary, failOnFindings) {
56-  if (!failOnFindings || typeof failOnFindings !== 'object') return 0;
57-  const threshold = Number(failOnFindings.threshold);
58-  if (!Number.isFinite(threshold) || threshold <= 0) return 0;
59-  const impacts = new Set(Array.isArray(failOnFindings.impacts) ? failOnFindings.impacts : []);
60-  const classifications = new Set(
61-    Array.isArray(failOnFindings.classifications) ? failOnFindings.classifi ...
````

## 11. Bash

````bash
cd $SCRATCH/review && node -e '
const f=JSON.parse(require("fs").readFileSync("round1-findings.json","utf8"));const arr=Array.isArray(f)?f:(f.findings||Object.values(f).flat());
for(const x of arr){ if(["SCAN-20","REPB-18","REPA-09"].includes(x.id)) console.log(JSON.stringify({id:x.id,claim:x.claim,recommendation:x.recommendation}).slice(0,1500)+"\n");}' 2>&1 | head -40
````

Output (truncated):

````text
{"id":"SCAN-20","claim":"The scan command ignores run()'s pagesFailed and never sets an exit code. When every page-view errors there are no findings, so summarize's failOnFindings gate exits 0 as well. The problem shows only in the report text.","recommendation":"Use a distinct non-zero exit (e.g. 3) when failed or unauditable page-views exceed a configurable threshold, or add reporting.failOnCoverage."}

{"id":"REPA-09","claim":"html.mjs emits `<img src=\"../screenshots/...\">` (path.relative from reportsDir). The user manual says summary.html is a 'Standalone human report (no external assets...)', and the config guide says screenshots are 'embedded in the HTML report'. The integrations guide's GitHub Actions recipe uploads `path: output/ci/reports` and says summary.html 'is the file a te ...
````

## 12. Bash

````bash
cd $SCRATCH/wf2/verify-B02 && ls run2/reports; node -e '
const fs=require("fs");const f=fs.readdirSync("run2/reports").find(n=>/portal/.test(n));const p=JSON.parse(fs.readFileSync("run2/reports/"+f,"utf8"));
const s=JSON.stringify(p);console.log(f, [...new Set(s.match(/http:\/\/127\.0\.0\.1:\d+\/[a-z0-9]+\.html/g))]);'; ls -la --time-style=+%T run2/screenshots 2>/dev/null | head || ls -lT run2/screenshots | head
````

Output (truncated):

````text
grouped-by-component.json
grouped-by-rule.json
manual-backlog.md
portal-export.json
random-vs-structured-comparison.json
summary.html
summary.json
summary.md
wcag-em-summary.json
portal-export.json [
  'http://127.0.0.1:57138/index.html',
  'http://127.0.0.1:57138/p1.html',
  'http://127.0.0.1:57138/p2.html',
  'http://127.0.0.1:57138/p3.html',
  'http://127.0.0.1:57138/p4.html'
]
````
