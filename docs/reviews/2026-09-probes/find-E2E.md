# Probe record: find:E2E

Role: round-2 finder. Findings: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
cd $SCRATCH/review && wc -l round1-index.txt && grep -E '^(VERD|REPA|REPB|SCAN)' round1-index.txt | cut -c1-220
````

Output (truncated):

````text
     184 round1-index.txt
VERD-01 | high | new | correctness | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per SC. This gives false passes and false 'not present' v
VERD-02 | medium | new | docs-drift | Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off automated passed/inapplicable verdicts | docs/guides/user-manual.md:71, d
VERD-03 | high | new | correctness | wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria) | src/lib/wcag-em-summary.mjs:371, src/lib/wcag-em-sum
VERD-04 | medium | new | correctness | 4.1.1 Parsing (obsolete and removed in WCAG 2.2) is emitted as notTested ...
````

## 2. Bash

````bash
cd $SCRATCH/review && grep -vE '^(VERD|REPA|REPB|SCAN)' round1-index.txt | cut -c1-170; ls; python3 -c "import json;d=json.load(open('round1-experiments.json'));print(type(d), len(d)); [print(e.get('what','')[:150]) for e in (d if isinstance(d,list) else [])]" | head -80
````

Output (truncated):

````text
SAMP-03 | high | new | correctness | autoSuggest.perCluster means 'clusters per page type', not 'representatives per cluster'. By default only one cluster per type is sam
SAMP-01 | medium | new | correctness | The random tier can re-draw the post-redirect target of a structured URL. It is then folded as a redirect duplicate and coverage re
SAMP-02 | medium | new | accuracy-coverage | The random-tier population includes HTTP 404/500 and soft-404 pages. The inventory records no HTTP status, so the sampler can
SAMP-04 | medium | new | correctness | A negative randomSeed passes the schema but corrupts the Fisher–Yates shuffle, so the random sample silently shrinks while metada
SAMP-05 | medium | new | methodology | The synthesized samplingMethodNotes misdescribes the method ('10% pool'), omits ...
````

## 3. Bash

````bash
cd $SCRATCH/review && python3 - <<'EOF'
import json
d=json.load(open('round1-experiments.json'))
for e in d:
    w=(e.get('what','')+' '+e.get('result',''))
    if any(k in w.lower() for k in ['raw axe','shadow','iframe','ajv','determin','summary.html','dark','cross-artifact','consisten','earl','junit','target-size','occurrence']):
        print('--',e.get('what','')[:200]); print('   ',e.get('result','')[:600])
EOF
````

Output (truncated):

````text
-- Full CLI audit against my own localhost fixture with known axe-undetectable defects (lang=fr on English text, alt=filename, 'click here' links, no meta viewport, carousel, JS timeout, inputs without a
    Exit 0. wcag-em-summary: 1.1.1/2.4.2/2.4.4/3.1.1/3.3.2/1.4.12 passed; 1.4.4/1.3.5/2.2.1/2.2.2 inapplicable; 2.1.3 AAA failed in an AA run; 4.1.1 notTested. The same rows appear in report-builder criteriaOutcomes, the HTML table and 'Passing criteria', and EARL earl:passed. Portal averageScore 85. All artefacts stamp axeCore 4.11.2. summary.md has no per-SC section.
-- Determinism under reordering: same page set, reversed inventory order, same seed
    The random sample changed ([/services/svc-8, /services/svc-18] became [/news/post-1, /news/post-9]). sample-metadata has no pool fingerp ...
````

## 4. Bash

````bash
grep -n 'withTags\|reporters\|viewports\|wcagVersion\|conformanceTarget\|includePasses' src/lib/config.mjs | head; grep -n "audit" bin/wcag-em.mjs | head -20; grep -n 'processes' -A3 schemas/config.schema.json | head -30
````

Output (truncated):

````text
53:// Multi-viewport support landed `scan.viewports` (sentinel), `crawl.requestDelayMs`,
57:// pipeline added `reporting.reporters`.
101:    // Neither `viewports` nor `viewport` is shipped in DEFAULTS. Users who
102:    // want multi-viewport scans set `scan.viewports: [...]` explicitly; the
124:      withTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
131:    // never read at runtime). `reporters` intentionally absent
157:    wcagVersion: '2.2',
158:    conformanceTarget: 'AA',
9: *   discover | sample | scan | scan-processes | summarize | audit
191:  .command('audit')
317:              "description": "Chrome DevTools Protocol endpoint to attach to — e.g. http://127.0.0.1:9222 from a browser started with --remote-debugging-port (a CDP endpoint, NOT a Playwright launchServ ...
````

## 5. Bash

````bash
sed -n 185,240p bin/wcag-em.mjs; sed -n 455,520p schemas/config.schema.json; ls examples 2>/dev/null; grep -rn '"processes"' -A 25 configs/*.json 2>/dev/null | head -40
````

Output (truncated):

````text
      // configured `reporting.failOnFindings` policy (Pa11y-compatible).
      if (result && typeof result.exitCode === 'number') return result.exitCode;
    }),
  );

program
  .command('audit')
  .description('Run the full pipeline: discover -> sample -> scan -> scan-processes -> summarize.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: true });
      const stages = ['discover', 'sample', 'scan', 'scan-processes', 'summarize'];
      let exitCode = 0;
      for (const stage of stages) {
        ctx.logger.info({ stage }, 'stage start');
        const { run } = await import(`../src/commands/${stage}.mjs`);
        const result = await run(ctx);
        ctx.logger.info({ stage }, 'stage done');
        if (result && typeof ...
````

## 6. Bash

````bash
S=$SCRATCH/wf2/e2e; mkdir -p $S/site && cd $S && cat > rule-impacts.mjs <<'EOF'
import { chromium } from '$REPO/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const src = fs.readFileSync('$REPO/node_modules/axe-core/axe.min.js','utf8');
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent('<html><body></body></html>'); await p.addScriptTag({content: src});
const out = await p.evaluate(() => {
  const checks = Object.fromEntries(axe._audit.checks ? Object.entries(axe._audit.checks).map(([k,c])=>[k,c.impact ?? c.metadata?.impact]) : []);
  return axe._audit.rules.map(r => {
    const ids = [...r.any, ...r.all, ...r.none].map(c => typeof c === 'string' ? c : c.id);
    const imps = [...new Set(ids.map(id => checks[id]))];
    return { id: r.id, tags: r.tags.filter(t=>/wcag|best/.test(t)), checkImpacts: Object.fromEntries(ids.map(id=>[id,checks[id]])), distinct: imps };
  }).filter(r => r.distinct.length > 1);
});
console.log(JSON.stringify(out.map(r=>({id:r.id,tags:r.tags.join(','),ci:r.checkImpacts})),null,0).replace(/\},\{/g,'},\n{'));
await b.close();
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node rule-impacts.mjs 2>&1 | head -60
````

Output (truncated):

````text
[]
````

## 7. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > rule-impacts2.mjs <<'EOF'
import { chromium } from '$REPO/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const src = fs.readFileSync('$REPO/node_modules/axe-core/axe.min.js','utf8');
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent('<html><body></body></html>'); await p.addScriptTag({content: src});
const out = await p.evaluate(() => {
  const c0 = axe._audit.checks; const k0 = Object.keys(c0)[0];
  const sample = { key: k0, keys: Object.keys(c0[k0]), md: c0[k0].metadata ?? null, imp: c0[k0].impact };
  const r0 = axe._audit.rules[0]; 
  return { sample, ruleKeys: Object.keys(r0), any0: r0.any, all0: r0.all };
});
console.log(JSON.stringify(out,null,1).slice(0,1500));
await b.close();
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node rule-impacts2.mjs 2>&1 | head -60
````

Output (truncated):

````text
{
 "sample": {
  "key": "abstractrole",
  "keys": [
   "id",
   "_internalCheck",
   "evaluate"
  ],
  "md": null
 },
 "ruleKeys": [
  "_audit",
  "id",
  "selector",
  "impact",
  "excludeHidden",
  "enabled",
  "pageLevel",
  "reviewOnFail",
  "any",
  "all",
  "none",
  "tags",
  "preload",
  "actIds"
 ],
 "any0": [],
 "all0": []
}
````

## 8. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && sed -i '' 's/const checks = Object.fromEntries(axe._audit.checks ? Object.entries(axe._audit.checks).map((\[k,c\])=>\[k,c.impact ?? c.metadata?.impact\]) : \[\]);/const checks = Object.fromEntries(Object.entries(axe._audit.data.checks).map(([k,c])=>[k,c.impact]));/' rule-impacts.mjs && grep -n 'const checks' rule-impacts.mjs && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node rule-impacts.mjs 2>&1 | head -60
````

Output (truncated):

````text
7:  const checks = Object.fromEntries(Object.entries(axe._audit.data.checks).map(([k,c])=>[k,c.impact]));
[{"id":"area-alt","tags":"wcag2a,wcag244,wcag412","ci":{"non-empty-alt":"critical","aria-label":"serious","aria-labelledby":"serious","non-empty-title":"serious"}},
{"id":"aria-allowed-attr","tags":"wcag2a,wcag412","ci":{"aria-allowed-attr":"critical","aria-unsupported-attr":"critical"}},
{"id":"aria-command-name","tags":"wcag2a,wcag412","ci":{"has-visible-text":"minor","aria-label":"serious","aria-labelledby":"serious","non-empty-title":"serious"}},
{"id":"aria-roles","tags":"wcag2a,wcag412","ci":{"invalidrole":"critical","abstractrole":"serious","unsupportedrole":"critical"}},
{"id":"aria-toggle-field-name","tags":"wcag2a,wcag412","ci":{"has-visible-text":"minor","aria-label":"seriou ...
````

## 9. Bash

````bash
python3 -c "
import json;s=json.load(open('schemas/config.schema.json'))
p=s['properties']
print(json.dumps(p['sample'],indent=0)[:1800]); print(list(p.keys())); print(json.dumps(p['wcagEm'],indent=0)[:900]); print(s.get('required'))"
````

Output (truncated):

````text
{
"type": "object",
"additionalProperties": false,
"properties": {
"structuredManual": {
"type": "array",
"items": {
"type": "string",
"format": "uri"
},
"uniqueItems": true,
"description": "Evaluator-chosen sample URLs (WCAG-EM Step 3a)."
},
"autoSuggest": {
"type": "object",
"additionalProperties": false,
"properties": {
"enabled": {
"type": "boolean"
},
"perCluster": {
"type": "integer",
"minimum": 1,
"maximum": 20
},
"preferTypes": {
"type": "array",
"items": {
"enum": [
"homepage",
"form-or-contact",
"policy",
"listing",
"detail",
"content",
"search-or-results",
"process-entry"
]
},
"uniqueItems": true
}
}
},
"randomPercentOfStructured": {
"type": "number",
"minimum": 0,
"maximum": 1
},
"minRandomPages": {
"type": "integer",
"minimum": 0
},
"randomSeed": {
"type": "integer",
"descript ...
````

## 10. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/site
head_() { cat <<EOF
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>$1</title>
<style>body{font:16px/1.5 sans-serif;color:#111;background:#fff;margin:0}main{padding:16px}$2</style></head><body><header><a href="/index.html">Home</a></header><main>
EOF
}
foot_='</main><footer><p>Fixture footer</p></footer></body></html>'
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -D > x.png
cat > bg.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="200" height="100" fill="#000"/><rect x="200" width="200" height="100" fill="#fff"/></svg>
EOF
{ head_ "Home - Fixture" ""; cat <<'EOF'
<h1>Fixture home</h1><ul>
<li><a href="/multi.html">Multi</a></li><li><a href="/roles.html">Roles</a></li><li><a href="/review.html">Review</a></li>
<li><a href="/clean.html">Clean</a></li><li><a href="/iframe.html">Iframe</a></li><li><a href="/shadow.html">Shadow</a></li>
<li><a href="/bp.html">Best practice</a></li><li><a href="/narrow.html">Narrow</a></li><li><a href="/form.html">Form</a></li><li><a href="/extra.html">Extra</a></li></ul>
EOF
echo "$foot_"; } > index.html
{ head_ "Multi violations" ".low{color:#999}.tiny{width:12px;height:12px;padding:0;margin:0;border:0;background:#333;display:inline-block;vertical-align:top}"; cat <<'EOF'
<h1>Multi</h1>
<img src="/x.png" width="40" height="40"><img src="/x.png" width="40" height="40">
<p class="low">Low contrast paragraph text.</p>
<p><input type="text" id="noname"></p>
<p><button type="button"></button></p>
<p><a href="/clean.html"></a></p>
<div><button class="tiny" aria-label="one" type="button"></button><button class="tiny" aria-label="two" type="button"></button><button class="tiny" aria-label="three" type="button"></button></div>
<div role="command">Abstract role</div>
EOF
echo "$foot_"; } > multi.html
{ head_ "Roles" ""; cat <<'EOF'
<h1>Roles</h1><div role="xyzzy">Invalid role</div><img src="/x.png" width="40" height="40">
EOF
echo "$foot_"; } > roles.html
{ head_ "Needs review" ".grad{background:linear-gradient(90deg,#000,#fff);color:#777;padding:8px}.img{background:#fff url(/bg.svg) no-repeat;color:#888;padding:8px;width:360px}"; cat <<'EOF'
<h1>Review</h1><p class="grad">Text over a gradient background.</p><p class="img">Text over a background image.</p>
EOF
echo "$foot_"; } > review.html
{ head_ "Clean page" ""; echo '<h1>Clean</h1><p>Plain accessible content.</p><p><a href="/index.html">Back home</a></p>'; echo "$foot_"; } > clean.html
{ head_ "Extra page" ""; echo '<h1>Extra</h1><p>Another clean page for the random pool.</p>'; echo "$foot_"; } > extra.html
{ head_ "Iframe host" ""; echo '<h1>Iframe host</h1><iframe title="Inner frame" src="/frame-inner.html" width="400" height="200"></iframe>'; echo "$foot_"; } > iframe.html
cat > frame-inner.html <<'EOF'
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Inner</title><style>.low{color:#aaa}</style></head><body><main><p>Inner frame</p><img src="/x.png" width="20" height="20"><p class="low">Faint inner text</p></main></body></html>
EOF
{ head_ "Shadow host" ""; cat <<'EOF'
<h1>Shadow host</h1><p>Light DOM text so the page is not empty.</p><x-widget></x-widget>
<script>customElements.define('x-widget', class extends HTMLElement{constructor(){super();const r=this.attachShadow({mode:'open'});r.innerHTML='<div><button type="button"></button><img src="/x.png" width="20" height="20"></div>';}});</script>
EOF
echo "$foot_"; } > shadow.html
cat > bp.html <<'EOF'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Best practice only</title><style>body{font:16px/1.5 sans-serif;color:#111;background:#fff}</style></head><body>
<h1>Best practice</h1><h4>Skipped heading levels</h4><p>Content outside any landmark.</p>
<table><tr><td scope="row">A</td><td>1</td></tr></table>
</body></html>
EOF
{ head_ "Narrow only" ".mobile-only{display:none}@media (max-width:600px){.mobile-only{display:block}}.low{color:#aaa}"; cat <<'EOF'
<h1>Narrow</h1><p>Visible everywhere.</p><div class="mobile-only"><img src="/x.png" width="20" height="20"><p class="low">Mobile only faint text</p></div>
EOF
echo "$foot_"; } > narrow.html
{ head_ "Contact form" ".err{color:#bbb;display:none}.show .err{display:block}"; cat <<'EOF'
<h1>Contact</h1><form id="f" novalidate><p><label for="nm">Name</label><input id="nm" name="nm" required><span class="err">Name is required</span></p>
<p><label for="em">Email</label><input id="em" name="em" type="email" required><span class="err">Email is required</span></p>
<p><button type="submit">Send</button></p></form>
<script>document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();e.target.classList.add('show');});</script>
EOF
echo "$foot_"; } > form.html
ls -la; file x.png
````

Output (truncated):

````text
total 112
drwxr-xr-x@ 16 $USER  wheel   512 Sep 30 19:34 .
drwxr-xr-x@  5 $USER  wheel   160 Sep 30 19:33 ..
-rw-r--r--@  1 $USER  wheel   168 Sep 30 19:34 bg.svg
-rw-r--r--@  1 $USER  wheel   408 Sep 30 19:34 bp.html
-rw-r--r--@  1 $USER  wheel   468 Sep 30 19:34 clean.html
-rw-r--r--@  1 $USER  wheel   440 Sep 30 19:34 extra.html
-rw-r--r--@  1 $USER  wheel   892 Sep 30 19:34 form.html
-rw-r--r--@  1 $USER  wheel   245 Sep 30 19:34 frame-inner.html
-rw-r--r--@  1 $USER  wheel   487 Sep 30 19:34 iframe.html
-rw-r--r--@  1 $USER  wheel   828 Sep 30 19:34 index.html
-rw-r--r--@  1 $USER  wheel  1009 Sep 30 19:34 multi.html
-rw-r--r--@  1 $USER  wheel   630 Sep 30 19:34 narrow.html
-rw-r--r--@  1 $USER  wheel   649 Sep 30 19:34 review.html
-rw-r--r--@  1 $USER  wheel   466 Sep 30 19:34 roles ...
````

## 11. Bash

````bash
grep -n "Dir\b\|Dir:" src/lib/context.mjs | head -20; sed -i '' 's#href="/index.html"#href="/"#g' $SCRATCH/wf2/e2e/site/*.html
````

Output (truncated):

````text
12: *   { config, configPath, logger, outDir, paths, args }
14: * `ensureDir(ctx.paths.inventoryDir)` without hardcoding strings.
123: * @property {string} outDir - Root of all outputs (default `output/`).
124: * @property {string} inventoryDir - Inventory artefacts (`output/inventory/`).
125: * @property {string} resultsDir - Raw scan results (`output/results/`).
126: * @property {string} reportsDir - Summaries / reporters (`output/reports/`).
127: * @property {string} screenshotsDir - Page + state screenshots (`output/screenshots/`).
149: * @property {string} [outDir] - Override for `--out-dir`.
234:  const outDir = path.resolve(options.outDir ?? 'output');
236:    outDir,
237:    inventoryDir: path.join(outDir, 'inventory'),
238:    resultsDir: path.join(outDir, 'results'),
239:    repo ...
````

## 12. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > driver.mjs <<'EOF'
// E2E ground-truth driver: server + raw axe + 2x audit + resummarize + self-axe on summary.html
import http from 'node:http'; import fs from 'node:fs/promises'; import path from 'node:path'; import { spawn } from 'node:child_process';
const REPO = '$REPO';
const S = path.dirname(new URL(import.meta.url).pathname);
const { chromium } = await import(`${REPO}/node_modules/playwright/index.mjs`);
const { default: AxeBuilder } = await import(`${REPO}/node_modules/@axe-core/playwright/dist/index.mjs`).catch(async () => import(`${REPO}/node_modules/@axe-core/playwright/dist/index.js`));
const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const hits = [];
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); hits.push(u.pathname);
  const p = u.pathname === '/' ? '/index.html' : u.pathname;
  try { const b = await fs.readFile(path.join(S, 'site', path.normalize(p))); res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'text/plain' }); res.end(b); }
  catch { res.writeHead(404, { 'content-type': 'text/html' }); res.end('<!doctype html><html lang="en"><title>404</title><h1>Not found</h1></html>'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const PAGES = ['/', '/multi.html', '/roles.html', '/review.html', '/clean.html', '/iframe.html', '/shadow.html', '/bp.html', '/narrow.html', '/form.html'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const VPS = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'reflow', width: 320, height: 800 }];
const cfg = {
  name: 'e2e-ground-truth', rootUrl: `${BASE}/`, scope: { mode: 'same-origin', allowedHosts: [] },
  crawl: { maxPages: 30, maxConcurrency: 1, requestTimeoutSecs: 30, requestDelayMs: 0, excludeUrlPatterns: [], sitemapSeeding: { enabled: false, urls: [], commonPaths: [], maxUrls: 10 } },
  sample: { structuredManual: PAGES.map((p) => BASE + p), autoSuggest: { enabled: false, perCluster: 1, preferTypes: ['homepage'] }, randomPercentOfStructured: 0.1, minRandomPages: 1, randomSeed: 42, smallSiteSupplementaryScanThreshold: 0 },
  scan: { viewports: VPS, waitUntil: 'domcontentloaded', timeoutMs: 30000, retries: 0, fullPageScreenshots: true, axe: { include: [], exclude: [], withRules: [], withTags: TAGS, runOnly: null } },
  processes: [{ name: 'contact-form', startUrl: `${BASE}/form.html`, pattern: 'blank-submit' }],
  reporting: { reporters: ['json', 'markdown', 'html', 'earl-jsonld', 'junit', 'portal-export', 'report-builder-starter'], groupBestPracticeSeparately: true, validateExports: 'warn' },
  wcagEm: { wcagVersion: '2.2', conformanceTarget: 'AA', evaluator: { name: 'E2E probe', contact: '' } },
};
await fs.writeFile(path.join(S, 'cfg.json'), JSON.stringify(cfg, null, 2));
await fs.writeFile(path.join(S, 'base.txt'), BASE);
const stage = process.argv[2] ?? 'all';

function run(args, label) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const cp = spawn(process.execPath, [`${REPO}/bin/wcag-em.mjs`, ...args], { cwd: S, env: { ...process.env, CRAWLEE_STORAGE_DIR: path.join(S, 'crawlee-storage', label) } });
    let out = ''; cp.stdout.on('data', (d) => (out += d)); cp.stderr.on('data', (d) => (out += d));
    cp.on('close', async (code) => { await fs.writeFile(path.join(S, `${label}.log`), out); resolve({ code, ms: Date.now() - t0 }); });
  });
}

const browser = await chromium.launch();
try {
  if (stage === 'all' || stage === 'raw') {
    const raw = [];
    for (const vp of VPS) for (const p of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(BASE + p, { waitUntil: 'load' });
      const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const sum = (arr) => arr.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length, nodeImpacts: x.nodes.map((n) => n.impact), targets: x.nodes.map((n) => n.target) }));
      raw.push({ page: p, vp: vp.id, engine: r.testEngine.version, violations: sum(r.violations), incomplete: sum(r.incomplete), passes: r.passes.length, inapplicable: r.inapplicable.length });
      await ctx.close();
    }
    await fs.writeFile(path.join(S, 'raw-axe.json'), JSON.stringify(raw, null, 1));
    console.log('raw done', raw.length);
  }
  if (stage === 'all' || stage === 'audit') {
    for (const label of ['out1', 'out2']) {
      await fs.rm(path.join(S, label), { recursive: true, force: true });
      const r = await run(['audit', '--config', path.join(S, 'cfg.json'), '--out-dir', path.join(S, label)], label);
      console.log(label, r);
    }
    await fs.rm(path.join(S, 'resum'), { recursive: true, force: true });
    await fs.cp(path.join(S, 'out1'), path.join(S, 'resum'), { recursive: true });
    const r = await run(['summarize', '--config', path.join(S, 'cfg.json'), '--out-dir', path.join(S, 'resum')], 'resum');
    console.log('resum', r);
  }
  if (stage === 'all' || stage === 'selfaxe') {
    const res = {};
    for (const scheme of ['light', 'dark']) {
      for (const vp of VPS) {
        const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto('file://' + path.join(S, 'out1', 'reports', 'summary.html'), { waitUntil: 'load' });
        // open all <details> so hidden content is audited too
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color }));
        res[`${scheme}-${vp.id}`] = { overflow, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, ex: v.nodes.slice(0, 3).map((n) => [n.target.join(' '), (n.any[0]?.data && JSON.stringify(n.any[0].data).slice(0, 160)) || ''] ) })), incomplete: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })) };
        await ctx.close();
      }
    }
    await fs.writeFile(path.join(S, 'selfaxe.json'), JSON.stringify(res, null, 1));
    console.log('selfaxe done');
  }
} finally {
  await browser.close();
  server.close();
  await fs.writeFile(path.join(S, 'hits.json'), JSON.stringify(hits));
}
EOF
ls $REPO/node_modules/@axe-core/playwright/dist/
````

Output (truncated):

````text
index.d.mts
index.d.ts
index.js
index.mjs
````

## 13. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && time node driver.mjs all > driver.log 2>&1; tail -20 driver.log
````

Output (truncated):

````text
node driver.mjs all > driver.log 2>&1  36.35s user 11.13s system 74% cpu 1:04.06 total
raw done 20
out1 { code: 2, ms: 23163 }
out2 { code: 2, ms: 25691 }
resum { code: 2, ms: 1226 }
selfaxe done
````

## 14. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && grep -E '"level":(40|50)|WARN|ERROR|warn|error' out1.log | cut -c1-400 | head -20; echo; find out1 -type f | sort; cat out1/sample.json; cat out1/inventory/random-sample.txt
````

Output (truncated):

````text
out1/inventory/document-inventory.json
out1/inventory/inventory-metadata.json
out1/inventory/inventory.json
out1/inventory/page-clusters.json
out1/inventory/process-candidates.json
out1/inventory/random-pool.txt
out1/inventory/random-sample.txt
out1/inventory/sample-metadata.json
out1/inventory/structured-sample-suggested.json
out1/inventory/structured-sample.txt
out1/inventory/urls.txt
out1/reports/earl.jsonld
out1/reports/grouped-by-component.json
out1/reports/grouped-by-rule.json
out1/reports/junit.xml
out1/reports/manual-backlog.md
out1/reports/portal-export.json
out1/reports/random-vs-structured-comparison.json
out1/reports/report-builder-draft.json
out1/reports/summary.html
out1/reports/summary.json
out1/reports/summary.md
out1/reports/wcag-em-summary.json
out1/results/axe-results.js ...
````

## 15. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > diff1.py <<'EOF'
import json
raw=json.load(open('raw-axe.json')); base=open('base.txt').read().strip()
tk=json.load(open('out1/results/axe-results.json'))
print('toolkit keys', sorted(tk[0].keys()))
tkmap={}
for r in tk:
    p=r['url'].replace(base,'') or '/'
    tkmap[(p,r.get('viewport'))]=r
for r in raw:
    t=tkmap.get((r['page'],r['vp']))
    if not t: print('MISSING in toolkit',r['page'],r['vp']); continue
    rv={v['id']:(v['nodes'],v['impact']) for v in r['violations']}
    tv={v['id']:(len(v['nodes']),v['impact']) for v in t['violations']}
    ri={v['id']:v['nodes'] for v in r['incomplete']}
    ti={v['id']:v['nodesCount'] for v in t.get('incompleteDetail',[])}
    flag='' if (rv==tv and ri==ti and r['passes']==t['passes'] and r['inapplicable']==t['inapplicable']) else '  <-- DIFF'
    print(f"{r['page']:14} {r['vp']:7} outcome={t.get('pageOutcome')} V raw={rv} tk={tv if tv!=rv else '='}  I raw={ri} tk={ti if ti!=ri else '='} P {r['passes']}/{t['passes']} NA {r['inapplicable']}/{t['inapplicable']}{flag}")
print('engine raw', raw[0]['engine'])
EOF
python3 diff1.py
````

Output (truncated):

````text
toolkit keys ['_preScanStates', 'attempts', 'finalUrl', 'inapplicable', 'inapplicableDetail', 'incomplete', 'incompleteDetail', 'passes', 'passesDetail', 'screenshot', 'title', 'url', 'viewport', 'violations']
/              desktop outcome=None V raw={} tk==  I raw={} tk== P 24/24 NA 66/66
/multi.html    desktop outcome=None V raw={'aria-roles': (1, 'critical'), 'button-name': (1, 'critical'), 'color-contrast': (1, 'serious'), 'image-alt': (2, 'critical'), 'label': (1, 'critical'), 'link-name': (1, 'serious'), 'target-size': (3, 'serious')} tk==  I raw={} tk== P 34/35 NA 53/52  <-- DIFF
/roles.html    desktop outcome=None V raw={'aria-roles': (1, 'critical'), 'image-alt': (1, 'critical')} tk==  I raw={} tk== P 26/26 NA 62/62
/review.html   desktop outcome=None V raw={} tk==  I raw={'color ...
````

## 16. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > passdiff.mjs <<'EOF'
import http from 'node:http'; import fs from 'node:fs/promises'; import path from 'node:path';
const REPO='$REPO';
const S=path.dirname(new URL(import.meta.url).pathname);
const { chromium } = await import(`${REPO}/node_modules/playwright/index.mjs`);
const { default: AxeBuilder } = await import(`${REPO}/node_modules/@axe-core/playwright/dist/index.mjs`);
const srv=http.createServer(async(req,res)=>{const p=new URL(req.url,'http://x').pathname;try{const b=await fs.readFile(path.join(S,'site',p==='/'?'index.html':p));res.writeHead(200,{'content-type':p.endsWith('.png')?'image/png':p.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(b)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const B=`http://127.0.0.1:${srv.address().port}`;
const TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'];
const br=await chromium.launch();
const tk=JSON.parse(await fs.readFile(path.join(S,'out1/results/axe-results.json'),'utf8'));
try{
for (const p of ['/multi.html','/form.html']) for (const wu of ['load','domcontentloaded']) {
  const ctx=await br.newContext({viewport:{width:1280,height:800}}); const pg=await ctx.newPage();
  await pg.goto(B+p,{waitUntil:wu}); const r=await new AxeBuilder({page:pg}).withTags(TAGS).analyze();
  const t=tk.find(x=>x.url.endsWith(p)&&x.viewport==='desktop');
  const rp=new Set(r.passes.map(x=>x.id)), tp=new Set(t.passesDetail.map(x=>x.id));
  console.log(p,wu,'raw-only passes',[...rp].filter(x=>!tp.has(x)),'toolkit-only passes',[...tp].filter(x=>!rp.has(x)));
  await ctx.close();
}
// role impact probe
const ctx=await br.newContext(); const pg=await ctx.newPage();
for (const role of ['command','widget','structure','input','xyzzy','landmark']) { await pg.setContent(`<html lang=en><title>t</title><main><div role="${role}">x</div></main></html>`); const r=await new AxeBuilder({page:pg}).withRules(['aria-roles']).analyze(); console.log(role, JSON.stringify(r.violations.map(v=>[v.impact,v.nodes.map(n=>[n.impact,n.none.map(c=>c.id+':'+c.impact)])]))); }
for (const h of ['<img src="/x.png" alt=" ">','<img src="/x.png">','<img src="/x.png" role="presentation" tabindex="0">']) { await pg.setContent(`<html lang=en><title>t</title><main>${h}</main></html>`); const r=await new AxeBuilder({page:pg}).withRules(['image-alt']).analyze(); console.log(h, JSON.stringify(r.violations.map(v=>[v.impact,v.nodes.map(n=>n.impact)]))); }
for (const h of ['<div aria-valid="x" role="heading" aria-level="0">H</div>','<div role="checkbox" aria-checked="maybe">c</div>','<h2 aria-level="abc">x</h2>','<div role="heading" aria-level="10">H</div>']) { await pg.setContent(`<html lang=en><title>t</title><main>${h}</main></html>`); const r=await new AxeBuilder({page:pg}).withRules(['aria-valid-attr-value']).analyze(); console.log(h, JSON.stringify(r.violations.map(v=>[v.impact,v.nodes.map(n=>[n.impact,n.all.map(c=>c.id+':'+c.impact)])]))); }
}finally{await br.close(); srv.close();}
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node passdiff.mjs
````

Output (truncated):

````text
/multi.html load raw-only passes [] toolkit-only passes [ 'avoid-inline-spacing' ]
/multi.html domcontentloaded raw-only passes [] toolkit-only passes [ 'avoid-inline-spacing' ]
/form.html load raw-only passes [] toolkit-only passes [ 'avoid-inline-spacing' ]
/form.html domcontentloaded raw-only passes [] toolkit-only passes [ 'avoid-inline-spacing' ]
command [["critical",[["critical",["abstractrole:critical"]]]]]
widget [["critical",[["critical",["abstractrole:critical"]]]]]
structure [["critical",[["critical",["abstractrole:critical"]]]]]
input [["critical",[["critical",["abstractrole:critical"]]]]]
xyzzy [["critical",[["critical",["invalidrole:critical"]]]]]
landmark [["critical",[["critical",["abstractrole:critical"]]]]]
<img src="/x.png" alt=" "> [["critical",["critical"]]]
<img src=" ...
````

## 17. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > shotprobe.mjs <<'EOF'
import path from 'node:path';
const REPO='$REPO';
const S=path.dirname(new URL(import.meta.url).pathname);
const { chromium } = await import(`${REPO}/node_modules/playwright/index.mjs`);
const { default: AxeBuilder } = await import(`${REPO}/node_modules/@axe-core/playwright/dist/index.mjs`);
const br=await chromium.launch(); const pg=await br.newPage();
try {
await pg.goto('file://'+path.join(S,'site','form.html'));
const before = await pg.evaluate(()=>[...document.querySelectorAll('[style]')].map(e=>e.outerHTML.slice(0,120)));
await pg.screenshot({ path: path.join(S,'probe.png'), fullPage: true });
const after = await pg.evaluate(()=>[...document.querySelectorAll('[style]')].map(e=>e.outerHTML.slice(0,160)));
const r = await new AxeBuilder({page:pg}).withRules(['avoid-inline-spacing']).analyze();
console.log({before, after, passes: r.passes.map(p=>[p.id,p.nodes.map(n=>n.html.slice(0,100))]), inapplicable: r.inapplicable.map(p=>p.id)});
} finally { await br.close(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node shotprobe.mjs
````

Output (truncated):

````text
Exit code 1
file://$REPO/node_modules/@axe-core/playwright/dist/index.mjs:218
      throw new Error(
            ^

Error: Please use browser.newContext()
 Please check out https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/error-handling.md
    at AxeBuilder.analyze (file://$REPO/node_modules/@axe-core/playwright/dist/index.mjs:218:13)
    at async file://$SCRATCH/wf2/e2e/shotprobe.mjs:12:11

Node.js v22.14.0
````

## 18. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && sed -i '' "s/const br=await chromium.launch(); const pg=await br.newPage();/const br=await chromium.launch(); const pg=await (await br.newContext()).newPage();/" shotprobe.mjs && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node shotprobe.mjs
````

Output (truncated):

````text
{
  before: [],
  after: [
    '<input id="nm" name="nm" required="" style="">',
    '<input id="em" name="em" type="email" required="" style="">'
  ],
  passes: [ [ 'avoid-inline-spacing', [Array] ] ],
  inapplicable: []
}
````

## 19. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 - <<'EOF'
import json
w=json.load(open('out1/reports/wcag-em-summary.json'))
print(sorted(w.keys()))
co=w['criteriaOutcomes'] if 'criteriaOutcomes' in w else w.get('wcagEmSummary',{}).get('criteriaOutcomes')
print(type(co), len(co))
print(json.dumps(co[0],indent=0)[:800])
from collections import Counter
print(Counter(c['outcome'] for c in co))
for c in co:
    if c['outcome'] in ('failed','cantTell') or c.get('sc') in ('1.4.12','2.5.8','1.4.3','1.4.11','1.4.10'):
        print(c.get('sc'), c.get('level'), c['outcome'], {k:(v if not isinstance(v,list) else v[:6]) for k,v in c.items() if k not in ('sc','outcome','name','level')})
EOF
````

Output (truncated):

````text
['atBaseline', 'automatedCoverage', 'conformanceTarget', 'criteriaOutcomes', 'evaluationDate', 'evaluator', 'processesEvaluated', 'samplingMethodNotes', 'scanWarnings', 'technologiesReliedUpon', 'tool', 'wcagVersion']
<class 'list'> 57
{
"sc": "1.1.1",
"level": "A",
"outcome": "failed",
"examples": [
{
"pageUrl": "http://127.0.0.1:54805/multi.html",
"ruleId": "image-alt",
"impact": "critical"
},
{
"pageUrl": "http://127.0.0.1:54805/roles.html",
"ruleId": "image-alt",
"impact": "critical"
},
{
"pageUrl": "http://127.0.0.1:54805/iframe.html",
"ruleId": "image-alt",
"impact": "critical"
},
{
"pageUrl": "http://127.0.0.1:54805/shadow.html",
"ruleId": "image-alt",
"impact": "critical"
},
{
"pageUrl": "http://127.0.0.1:54805/multi.html",
"ruleId": "image-alt",
"impact": "critical"
}
],
"pagesExa ...
````

## 20. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 - <<'EOF'
import json
w=json.load(open('out1/reports/wcag-em-summary.json'))
for c in w['criteriaOutcomes']:
    if c['outcome'] in ('passed','inapplicable','cantTell'): print(c['sc'],c['level'],c['outcome'],c['pagesExamined'],c['relatedRules'])
print(json.dumps(w['automatedCoverage'],indent=0)); print(w['scanWarnings']); print(w['processesEvaluated'])
EOF
grep -n "examples" $REPO/src/lib/wcag-em-summary.mjs | head
````

Output (truncated):

````text
1.2.2 A inapplicable 12 ['video-caption']
1.3.1 A passed 12 ['aria-hidden-body', 'aria-required-children', 'aria-required-parent', 'definition-list', 'dlitem', 'list', 'listitem', 'td-headers-attr', 'th-has-data-cells']
1.3.5 AA inapplicable 12 ['autocomplete-valid']
1.4.1 A inapplicable 12 ['link-in-text-block']
1.4.2 A inapplicable 12 ['no-autoplay-audio']
1.4.4 AA passed 12 ['meta-viewport']
1.4.12 AA passed 12 ['avoid-inline-spacing']
2.1.1 A inapplicable 12 ['frame-focusable-content', 'scrollable-region-focusable', 'server-side-image-map']
2.1.3 AAA inapplicable 12 ['scrollable-region-focusable']
2.2.1 A inapplicable 12 ['meta-refresh']
2.2.2 A inapplicable 12 ['blink', 'marquee']
2.4.1 A passed 12 ['bypass']
2.4.2 A passed 12 ['document-title']
3.1.1 A passed 12 ['html-has-lang', 'ht ...
````

## 21. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 - <<'EOF'
import json
pr=json.load(open('out1/results/process-results.json'))
for p in pr:
    print(p['name'],p.get('viewport'),p.get('pageOutcome'),[ (s.get('state'),s.get('pageOutcome'),[(v['id'],len(v['nodes']),v['impact']) for v in s.get('violations',[])],[(i['id'],i['nodesCount']) for i in s.get('incompleteDetail',[])], len(s.get('passesDetail',[])), [x['id'] for x in s.get('passesDetail',[]) if x['id'] in ('avoid-inline-spacing','target-size','region')]) for s in p.get('states',[])])
s=json.load(open('out1/reports/summary.json'))
print({k:s[k] for k in ['inventoryCount','finalSampleCount','samplePagesScanned','pageViewsScanned','processRuns','groupedFindingCount','groupedComponentCount']})
for f in s['findings']: print('F',f['id'],f['impact'],f['classification'],'occ',f['occurrences'],'pages',f['pageCount'],f['sourceTypes'],f['wcagCriteria'])
for f in s['incompleteFindings']: print('I',f['id'],f['impact'],'occ',f['occurrences'],'pages',f['pageCount'],f['pages'])
print(json.dumps(s['executionHealth'])[:600])
EOF
````

Output (truncated):

````text
contact-form desktop None [('screenshot:blank-submit', None, [], [], 0, []), ('blank-submit', None, [('color-contrast', 2, 'serious')], [], 28, ['avoid-inline-spacing', 'region'])]
contact-form reflow None [('screenshot:blank-submit', None, [], [], 0, []), ('blank-submit', None, [('color-contrast', 2, 'serious')], [], 28, ['avoid-inline-spacing', 'region'])]
{'inventoryCount': 11, 'finalSampleCount': 11, 'samplePagesScanned': 11, 'pageViewsScanned': 22, 'processRuns': 2, 'groupedFindingCount': 12, 'groupedComponentCount': 26}
F aria-roles critical primary-automated-finding occ 4 pages 2 ['page-scan'] ['4.1.2']
F button-name critical primary-automated-finding occ 4 pages 2 ['page-scan'] ['4.1.2']
F image-alt critical primary-automated-finding occ 11 pages 5 ['page-scan'] ['1.1.1']
F label c ...
````

## 22. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 - <<'EOF'
import json
pe=json.load(open('out1/reports/portal-export.json'))
def keys(o,d=0,pre=''):
    if isinstance(o,dict):
        for k,v in o.items():
            print(' '*d+k, type(v).__name__, (len(v) if isinstance(v,(list,dict)) else repr(v)[:80]))
            if d<2 and isinstance(v,(dict,)): keys(v,d+2)
            if d<2 and isinstance(v,list) and v and isinstance(v[0],dict): keys(v[0],d+4)
keys(pe)
EOF
````

Output (truncated):

````text
scanMetadata dict 5
  url str 'http://127.0.0.1:54805/'
  timestamp str '2026-09-30T18:35:55.253Z'
  tool str 'wcag-em-a11y-toolkit 1.1.0'
  toolVersion str '1.1.0'
  scanOptions dict 6
summary dict 7
  totalIssues int 7
  reportedTotal int 13
  manualReviewIssues int 6
  distribution dict 4
  averageScore int 58
  scoreBasis dict 5
  scoreSource str 'wcag-em-criterion-outcomes'
rawFindings list 13
    ruleId str 'aria-roles'
    impact str 'critical'
    priorityLabel str 'Critical'
    message str 'ARIA roles used must conform to valid values'
    description str 'ARIA roles used must conform to valid values'
    selector str 'div[role="command"]'
    wcag list 1
    evidence dict 4
    confidence str 'automated'
    occurrenceCount int 2
    countsTowardCompliance bool True
    findingK ...
````

## 23. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 - <<'EOF'
import json
pe=json.load(open('out1/reports/portal-export.json'))
print(json.dumps(pe['summary'],indent=0)); print(json.dumps(pe['scanMetadata']['scanOptions'])[:400])
for f in pe['rawFindings']:
    print('P',f['ruleId'],f['impact'],f['findingKind'],'occ',f['occurrenceCount'],'inst',len(f['instances']),'wcag',f['wcag'],'counts',f['countsTowardCompliance'], [ (i.get('url') or i.get('pageUrl'), i.get('viewport')) for i in f['instances']][:6])
print(json.dumps(pe['rawFindings'][0]['instances'][0])[:500])
EOF
````

Output (truncated):

````text
{
"totalIssues": 7,
"reportedTotal": 13,
"manualReviewIssues": 6,
"distribution": {
"critical": 4,
"high": 3,
"medium": 0,
"low": 0
},
"averageScore": 58,
"scoreBasis": {
"passed": 7,
"failed": 5,
"cantTell": 0,
"inapplicable": 9,
"notTested": 36
},
"scoreSource": "wcag-em-criterion-outcomes"
}
{"axeVersion": "4.11.2", "pagesScanned": 11, "sampleSize": 11, "inventorySize": 11, "pageViewsScanned": 22, "executionHealth": {"sampleListedCount": 11, "pagesInSample": 11, "pagesFullyScanned": 11, "pagesDegraded": [], "pagesFailed": [], "pagesUnauditable": [], "challengePages": 0, "structuredMissingFromInventory": [], "pageViewsScanned": 22, "pageViewsFailed": 0, "pageViewsUnauditable": 0, "proc
P aria-roles critical violation occ 2 inst 2 wcag ['4.1.2'] counts True [('http://127.0.0.1:54805/multi ...
````

## 24. Bash

````bash
cd $SCRATCH/review && python3 - <<'EOF'
import json
d=json.load(open('round1-findings.json'))
F=d if isinstance(d,list) else d.get('findings',d)
for f in F:
    blob=json.dumps(f).lower()
    for k in ['viewport','style=\"\"','avoid-inline','screenshot mut','caret','impact of the first','first-seen','dark','prefers-color','ajv','determin']:
        if k in blob:
            print(f['id'],'|',k,'|',f['title'][:140]); break
EOF
````

Output (truncated):

````text
VERD-01 | viewport | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per SC. This g
VERD-09 | viewport | automatedCoverage mixes page and page-view units: a redirect-duplicate or a single failed viewport makes coverage 'partial', and the 'see Sc
VERD-10 | viewport | WCAG-EM Step 5.b evaluation specifics are incomplete or inaccurate in the Step-5 artefact
VERD-11 | caret | The tool identity stamps the wrong axe-core version (the @axe-core/playwright wrapper's 4.11.2, not the injected engine's 4.11.3)
SAMP-10 | determin | Sampling logic is effectively untested: four behaviour-breaking mutants pass all 517 unit and 8 e2e tests
SAMP-08 | determin | 'Same seed, same sample' also depends on inventory file order, the pr ...
````

## 25. Bash

````bash
cd $SCRATCH/review && python3 - <<'EOF'
import json,re
d=json.load(open('round1-findings.json'))
F=d if isinstance(d,list) else d.get('findings',d)
for f in F:
    blob=json.dumps(f)
    for m in re.finditer(r'.{120}(viewport-specific|which viewport|only at 320|reflow-only|viewport is (not|never)|no viewport|without viewport|viewport field|lose the viewport|drops? the viewport|viewport provenance).{160}',blob,re.I):
        print(f['id'],'::',m.group(0)); 
EOF
````

Output (truncated):

````text
PROC-19 :: e": "Process step failures in Scan health dump raw multi-line Playwright call logs (with page HTML) into markdown, with no viewport, action or step index", "category": "dx", "severity": "low", "status": "new", "claim": "markdown interpolates p.error raw, so Playwright call logs add 'Call lo
SCAN-19 :: p' (one carrying a 320px-only button-name violation), one screenshot file on disk.", "impact": "A config slip mislabels viewport-specific findings and loses evidence.", "recommendation": "Enforce unique viewport ids at config load (a custom Ajv keyword or a post-validation check).", "confidence":
REPA-12 :: dx", "severity": "low", "status": "new", "claim": "processStepFailures entries are {name, startUrl, state, error}, with no viewport. A process run at two viewports that fails th ...
````

## 26. Bash

````bash
grep -n "viewport" src/lib/group-findings.mjs src/lib/wcag-em-summary.mjs src/reporters/*.mjs src/commands/summarize.mjs | grep -v '^\s*\*' | head -30; S=$SCRATCH/wf2/e2e; for f in $S/out1/reports/*; do printf "%s reflow=%s viewport=%s\n" $(basename $f) $(grep -o 'reflow' $f | wc -l) $(grep -o 'viewport' $f | wc -l); done
````

Output (truncated):

````text
src/reporters/html.mjs:164:      ? html`<tr><th>Page views scanned (pages x viewports)</th><td>${summary.pageViewsScanned}</td></tr>\n`
src/reporters/html.mjs:217:    out += html`<li><strong>Not scanned</strong> (all viewports failed): <code>${p.url}</code> — ${p.failures?.[0]?.error ?? 'unknown error'}</li>\n`;
src/reporters/html.mjs:220:    const vps = (p.failures ?? []).map((/** @type {any} */ f) => f.viewport).join(', ');
src/reporters/html.mjs:227:    out += html`<li>Pre-scan action "${p.action}" ${p.state} on <code>${p.url}</code> [${p.viewport}] — page scanned without intended setup.</li>\n`;
src/reporters/html.mjs:374: * path from the URL and viewport ID from the screenshot filename suffix.
src/reporters/html.mjs:386:    const vpLabel = vpMatch ? ` at ${vpMatch[1]} viewport` : '';
 ...
````

## 27. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && grep -o '.\{60\}viewport.\{60\}' summary.html | head -5; grep -c 'narrow' summary.html summary.md; grep -n 'narrow' summary.md | head; grep -o '.\{80\}reflow.\{40\}' report-builder-draft.json | head -4
````

Output (truncated):

````text
lt="Full-page screenshot of 127.0.0.1/multi.html at desktop viewport" src="../screenshots/127.0.0.1_54805_multi.html__desktop.pn
lt="Full-page screenshot of 127.0.0.1/multi.html at desktop viewport" src="../screenshots/127.0.0.1_54805_multi.html__desktop.pn
t="Full-page screenshot of 127.0.0.1/iframe.html at desktop viewport" src="../screenshots/127.0.0.1_54805_iframe.html__desktop.p
lt="Full-page screenshot of 127.0.0.1/multi.html at desktop viewport" src="../screenshots/127.0.0.1_54805_multi.html__desktop.pn
alt="Full-page screenshot of 127.0.0.1/form.html at desktop viewport" src="../screenshots/127.0.0.1_54805_form.html__desktop.png
summary.html:0
summary.md:0
ance claim on its own; manual testing with keyboard, assistive technology, zoom/reflow, and process walkthroughs is still requ
 ...
````

## 28. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 - <<'EOF'
import json
d=json.load(open('report-builder-draft.json'))
print(list(d.keys()))
for k,v in d.items():
    if isinstance(v,list) and v and isinstance(v[0],dict): print(k,len(v),list(v[0].keys()))
fs=d.get('findings') or []
for f in fs: print('RB',f.get('id'),f.get('ruleId') or f.get('title','')[:40],f.get('severity') or f.get('impact'),'occ',f.get('occurrenceCount'),'pages',len(f.get('pages',f.get('affectedPages',[])) or []), str(f.get('screenshots') or f.get('evidence',''))[:160])
EOF
````

Output (truncated):

````text
['schemaVersion', 'reportType', 'meta', 'executiveSummary', 'scope', 'methodology', 'sourceRun', 'criteriaOutcomes', 'userTesting', 'manualChecks', 'findings', 'recommendations', 'standardsContext', 'nextSteps', 'appendices', 'draftMeta']
criteriaOutcomes 21 ['criterion', 'level', 'outcome', 'notes', 'relatedFindingIds']
manualChecks 17 ['label', 'outcome']
findings 13 ['id', 'title', 'severity', 'status', 'priorityTier', 'affectedArea', 'affectedPages', 'wcag', 'userImpact', 'technicalIssue', 'recommendation', 'evidence', 'sourceReferences', 'relatedJourneyIds', 'draftStatus', 'includeInReport', 'needsManualReview', 'reviewNotes', 'sourceRuleId', 'axeImpact']
recommendations 2 ['tier', 'title', 'timeframe', 'summary', 'items']
appendices 1 ['title', 'content']
RB EGT-001 Aria Roles Critic ...
````

## 29. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && xmllint --noout junit.xml && echo junit-wellformed; python3 - <<'EOF'
import xml.etree.ElementTree as ET, json, collections
t=ET.parse('junit.xml').getroot()
print(t.tag, t.attrib)
for s in t.iter('testsuite'):
    cases=list(s.iter('testcase'))
    print(' suite',s.attrib, 'cases',len(cases), 'failures',sum(1 for c in cases if c.find('failure') is not None),'errors',sum(1 for c in cases if c.find('error') is not None),'skipped',sum(1 for c in cases if c.find('skipped') is not None))
    cnt=collections.Counter(c.attrib.get('classname') for c in cases)
    print('  ', dict(cnt))
    for c in cases[:3]: print('   ',c.attrib, (c.find('failure').attrib if c.find('failure') is not None else ''))
e=json.load(open('earl.jsonld'))
g=e.get('@graph',e)
print(type(g), len(g))
asserts=[x for x in (g if isinstance(g,list) else [g]) ]
def walk(o,acc):
    if isinstance(o,dict):
        if o.get('@type') in ('earl:Assertion','Assertion'): acc.append(o)
        for v in o.values(): walk(v,acc)
    elif isinstance(o,list):
        for v in o: walk(v,acc)
A=[]; walk(e,A)
print('assertions',len(A)); print(json.dumps(A[0])[:600])
oc=collections.Counter()
for a in A:
    res=a.get('result',a.get('earl:result',{}))
    out=res.get('outcome',res.get('earl:outcome'))
    test=a.get('test',a.get('earl:test'))
    oc[(str(test)[:40],str(out))]+=1
for k,v in sorted(oc.items()): print('  ',k,v)
EOF
````

Output (truncated):

````text
junit-wellformed
testsuite {'name': 'WCAG-EM Audit', 'tests': '22', 'failures': '22', 'time': '0'}
 suite {'name': 'WCAG-EM Audit', 'tests': '22', 'failures': '22', 'time': '0'} cases 22 failures 22 errors 0 skipped 0
   {'aria-roles': 2, 'button-name': 2, 'image-alt': 5, 'label': 1, 'color-contrast': 5, 'link-name': 1, 'target-size': 1, 'heading-order': 1, 'landmark-one-main': 1, 'landmark-unique': 1, 'region': 1, 'scope-attr-valid': 1}
    {'classname': 'aria-roles', 'name': 'http://127.0.0.1:54805/multi.html#div'} {'type': 'critical'}
    {'classname': 'aria-roles', 'name': 'http://127.0.0.1:54805/roles.html#div'} {'type': 'critical'}
    {'classname': 'button-name', 'name': 'http://127.0.0.1:54805/multi.html#p:nth-child(6) > button'} {'type': 'critical'}
<class 'list'> 22
assertions 22 ...
````

## 30. Bash

````bash
sed -n 50,80p src/reporters/junit.mjs; sed -n 66,90p src/reporters/earl-jsonld.mjs; S=$SCRATCH/wf2/e2e; python3 -c "
import json;s=json.load(open('$S/out1/reports/summary.json'))
for f in s['findings'][:3]: print(f['id'],f['targets'],f.get('firstTarget'),[ (e['pageUrl'][-12:],e['target']) for e in f['examples']])"
````

Output (truncated):

````text
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);

  /** @type {string[]} */
  const cases = [];
  let testsCount = 0;
  let failuresCount = 0;

  for (const f of findings) {
    const ruleId = String(f.id ?? '');
    const pages = Array.isArray(f.pages) ? f.pages : [];
    const firstTarget = Array.isArray(f.targets) && f.targets.length ? String(f.targets[0]) : '';
    const exampleHtml =
      Array.isArray(f.examples) && f.examples[0]?.html ? String(f.examples[0].html) : '';
    // Treat findings as failures unless they declare otherwise. Grouped
    // findings are violation-only by construction; future versions may extend.
    const outcome = typeof f.outcome === 'string' ? f.outcome : 'failed';
    if (outcome === 'inapplicable') continue;
     ...
````

## 31. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > impact2.mjs <<'EOF'
const REPO='$REPO';
const { chromium } = await import(`${REPO}/node_modules/playwright/index.mjs`);
const { default: AxeBuilder } = await import(`${REPO}/node_modules/@axe-core/playwright/dist/index.mjs`);
const br=await chromium.launch(); const pg=await (await br.newContext()).newPage();
const cases = [
 ['scope-attr-valid','<table><tr><td scope="row">A</td><td>1</td></tr></table>'],
 ['scope-attr-valid','<table><tr><th scope="foo">A</th><td>1</td></tr></table>'],
 ['aria-valid-attr-value','<div role="heading" aria-level="-1">H</div>'],
 ['aria-valid-attr-value','<div role="checkbox" aria-checked="maybe" tabindex="0">c</div>'],
 ['aria-command-name','<div role="button" tabindex="0"></div>'],
 ['frame-title','<iframe src="about:blank" role="presentation" tabindex="0"></iframe>'],
 ['frame-title','<iframe src="about:blank"></iframe>'],
 ['color-contrast','<p style="color:#777">x</p>'],
];
try { for (const [rule,h] of cases) { await pg.setContent(`<html lang=en><title>t</title><main>${h}</main></html>`); const r=await new AxeBuilder({page:pg}).withRules([rule]).analyze(); console.log(rule, h.slice(0,60), JSON.stringify(r.violations.map(v=>[v.impact,v.nodes.map(n=>n.impact)]))); } } finally { await br.close(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node impact2.mjs
````

Output (truncated):

````text
scope-attr-valid <table><tr><td scope="row">A</td><td>1</td></tr></table> []
scope-attr-valid <table><tr><th scope="foo">A</th><td>1</td></tr></table> [["moderate",["moderate"]]]
aria-valid-attr-value <div role="heading" aria-level="-1">H</div> [["critical",["critical"]]]
aria-valid-attr-value <div role="checkbox" aria-checked="maybe" tabindex="0">c</di [["critical",["critical"]]]
aria-command-name <div role="button" tabindex="0"></div> [["serious",["serious"]]]
frame-title <iframe src="about:blank" role="presentation" tabindex="0">< [["serious",["serious"]]]
frame-title <iframe src="about:blank"></iframe> [["serious",["serious"]]]
color-contrast <p style="color:#777">x</p> []
````

## 32. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && sed -n 1,80p summary.md | cut -c1-200
````

Output (truncated):

````text
**Tool:** wcag-em-a11y-toolkit 1.1.0 (axe-core 4.11.2)

# Accessibility scan summary

Site: **e2e-ground-truth**
Generated: 2026-09-30T18:35:55.253Z

## Method guardrails

- This is the automated layer of the audit workflow.
- It does not make a sitewide WCAG conformance claim on its own.
- Complete processes and manual checks still need separate review.

## Run summary

- Inventory count: 11
- Final selected sample: 11
- Sample pages scanned: 11
- Page views scanned (pages x viewports): 22
- Process runs: 2
- Grouped findings: 12
- Automated coverage: complete (11/11 selected pages audited)

## Random vs structured sample comparison

- New rule IDs found only in random sample: 0
- New clusters found only in random sample: 0
- Expand structured sample recommended: no

## Grouped findings b ...
````

## 33. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 - <<'EOF'
import re,html
t=open('summary.html').read()
txt=re.sub(r'<[^>]+>',' ',t); txt=html.unescape(re.sub(r'\s+',' ',txt))
for k in ['Grouped findings','Pages affected','Needs review','needs review','Automated coverage','Passing criteria','1.4.12','Text Spacing','occurrence']:
    for m in re.finditer(re.escape(k)+r'.{0,120}',txt): print(k,'::',m.group(0)[:170]); 
EOF
````

Output (truncated):

````text
Grouped findings :: Grouped findings 12 Findings by WCAG success criterion Criterion Outcome Related rules 1.1.1 failed aria-meter-name, aria-progressbar-na
Grouped findings :: Grouped findings by rule aria-roles · critical · 2 pages Classification primary-automated-finding Help ARIA roles used must conform to v
needs review :: needs review) color-contrast · serious · 1 pages · needs review Help Elements must meet minimum color contrast ratio thresholds Rule
1.4.12 :: 1.4.12 passed avoid-inline-spacing 1.4.13 notTested 2.1.1 inapplicable frame-focusable-content, scrollable-region-focusable, s
````

## 34. Bash

````bash
grep -n "averageScore" -B2 -A8 src/reporters/portal-export.mjs | sed -n 1,60p | grep -v '^\S*-\s*//' | head -45; S=$SCRATCH/wf2/e2e; python3 -c "
import json;d=json.load(open('$S/out1/reports/report-builder-draft.json'))
print([ (c['criterion'],c['outcome'],c['notes'][:80]) for c in d['criteriaOutcomes'] if '1.4.12' in c['criterion']])"
````

Output (truncated):

````text
[('1.4.12', 'passed', 'Automated outcome across 12 examined page(s).')]
````

## 35. Bash

````bash
grep -an 'averageScore\|scoreBasis\|scoreSource' src/reporters/portal-export.mjs | head; python3 -c "
b=open('src/reporters/portal-export.mjs','rb').read()
import re
for m in re.finditer(rb'[\x00-\x08\x0b\x0c\x0e-\x1f]',b): 
    ln=b[:m.start()].count(b'\n')+1; print('ctrl byte',m.group(0),'line',ln)
"
````

Output (truncated):

````text
111: * Count adjudication outcomes so `averageScore` ships with its basis. The
112: * 2026-06 review's live run exported `averageScore: 50` while 36 of 50
490:  const averageScore = computeAverageScore(criteriaOutcomes);
491:  // scoreBasis ships whenever per-SC outcomes exist so the dashboard score
493:  const scoreBasis =
538:      ...(averageScore !== null ? { averageScore } : {}),
539:      ...(scoreBasis ? { scoreBasis } : {}),
540:      scoreSource: 'wcag-em-criterion-outcomes',
ctrl byte b'\x00' line 304
````

## 36. Bash

````bash
python3 -c "
import pathlib
for p in pathlib.Path('.').rglob('*'):
    if 'node_modules' in p.parts or '.git' in p.parts or not p.is_file(): continue
    if p.suffix in ('.mjs','.js','.json','.md','.ts'):
        b=p.read_bytes()
        if b'\x00' in b: print(p, b.count(b'\x00'))
"; command rg -n averageScore src; echo "rg exit=$?"; command rg -n --binary averageScore src | head -2
````

Output (truncated):

````text
src/reporters/portal-export.mjs 1
(eval):8: command not found: rg
rg exit=127
(eval):8: command not found: rg
````

## 37. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > ajvcheck.mjs <<'EOF'
import fs from 'node:fs';
const REPO='$REPO';
const { default: Ajv2020 } = await import(`${REPO}/node_modules/ajv/dist/2020.js`).catch(()=>({default:null}));
const { default: Ajv } = await import(`${REPO}/node_modules/ajv/dist/ajv.js`);
const addFormats = (await import(`${REPO}/node_modules/ajv-formats/dist/index.js`).catch(()=>({default:null}))).default;
for (const [schemaF, dataF] of [['portal-canonical-scan.schema.json','portal-export.json'],['report-builder-draft.schema.json','report-builder-draft.json']]) {
  const schema = JSON.parse(fs.readFileSync(`${REPO}/schemas/${schemaF}`,'utf8'));
  const A = (schema.$schema||'').includes('2020') && Ajv2020 ? Ajv2020 : Ajv;
  const ajv = new A({ allErrors: true, strict: false });
  if (addFormats) addFormats(ajv);
  const v = ajv.compile(schema);
  for (const dir of process.argv.slice(2)) {
    const data = JSON.parse(fs.readFileSync(`${dir}/reports/${dataF}`,'utf8'));
    const ok = v(data);
    console.log(dir.split('/').pop(), dataF, schema.$schema, ok, ok ? '' : JSON.stringify(v.errors.slice(0,5)));
  }
}
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node ajvcheck.mjs $S/out1 $S/out2 $S/resum; grep -n '"\$schema"\|additionalProperties' $REPO/schemas/portal-canonical-scan.schema.json | head -5
````

Output (truncated):

````text
out1 portal-export.json https://json-schema.org/draft/2020-12/schema true 
out2 portal-export.json https://json-schema.org/draft/2020-12/schema true 
resum portal-export.json https://json-schema.org/draft/2020-12/schema true 
out1 report-builder-draft.json https://json-schema.org/draft/2020-12/schema true 
out2 report-builder-draft.json https://json-schema.org/draft/2020-12/schema true 
resum report-builder-draft.json https://json-schema.org/draft/2020-12/schema true 
2:  "$schema": "https://json-schema.org/draft/2020-12/schema",
````

## 38. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 - <<'EOF'
import os,re,json,difflib
TS=re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z')
def norm(p,root):
    t=open(p,encoding='utf8',errors='replace').read()
    t=TS.sub('<TS>',t).replace(root,'<ROOT>')
    return t
for pair in [('out1','out2'),('out1','resum')]:
    a,b=pair; print('=== ',a,'vs',b)
    for dp,_,fs in os.walk(a):
        for f in sorted(fs):
            pa=os.path.join(dp,f); pb=pa.replace(a,b,1)
            if f.endswith('.png'):
                continue
            if not os.path.exists(pb): print('missing',pb); continue
            ta,tb=norm(pa,os.path.abspath(a)),norm(pb,os.path.abspath(b))
            if ta!=tb:
                d=[l for l in difflib.unified_diff(ta.splitlines(),tb.splitlines(),lineterm='',n=0) if not l.startswith(('---','+++','@@'))]
                print(' DIFF',pa,len(d),'lines'); [print('   ',l[:230]) for l in d[:8]]
EOF
````

Output (truncated):

````text
===  out1 vs out2
===  out1 vs resum
 DIFF out1/results/axe-results.json 44 lines
    -    "screenshot": "<ROOT>/screenshots/127.0.0.1_54805___desktop.png",
    +    "screenshot": "$SCRATCH/wf2/e2e/out1/screenshots/127.0.0.1_54
    -    "screenshot": "<ROOT>/screenshots/127.0.0.1_54805_multi.html__desktop.png",
    +    "screenshot": "$SCRATCH/wf2/e2e/out1/screenshots/127.0.0.1_54
    -    "screenshot": "<ROOT>/screenshots/127.0.0.1_54805_roles.html__desktop.png",
    +    "screenshot": "$SCRATCH/wf2/e2e/out1/screenshots/127.0.0.1_54
    -    "screenshot": "<ROOT>/screenshots/127.0.0.1_54805_review.html__desktop.png",
    +    "screenshot": "$SCRATCH/wf2/e2e/out1/screenshots/127.0.0.1_54
 DIFF out1/results/process-results.json 4 lines
    -        "screenshot": "<ROOT>/screenshots/127.0.0. ...
````

## 39. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 -c "
import json;d=json.load(open('selfaxe.json'))
for k,v in d.items(): print(k, v['overflow'], [(x['id'],x['impact'],x['nodes'],x['ex'][:2]) for x in v['violations']], v['incomplete'])
"; grep -n 'prefers-color-scheme\|color-scheme' out1/reports/summary.html | head
````

Output (truncated):

````text
light-desktop {'sw': 1280, 'cw': 1280, 'bg': 'rgb(255, 255, 255)', 'fg': 'rgb(26, 26, 26)'} [('landmark-one-main', 'moderate', 1, [['html', '']]), ('region', 'moderate', 35, [['div', '{"isIframe":false}'], ['h1', '{"isIframe":false}']])] []
light-reflow {'sw': 450, 'cw': 320, 'bg': 'rgb(255, 255, 255)', 'fg': 'rgb(26, 26, 26)'} [('landmark-one-main', 'moderate', 1, [['html', '']]), ('region', 'moderate', 35, [['div', '{"isIframe":false}'], ['h1', '{"isIframe":false}']])] [{'id': 'color-contrast', 'nodes': 22}]
dark-desktop {'sw': 1280, 'cw': 1280, 'bg': 'rgb(18, 18, 18)', 'fg': 'rgb(232, 232, 232)'} [('landmark-one-main', 'moderate', 1, [['html', '']]), ('region', 'moderate', 35, [['div', '{"isIframe":false}'], ['h1', '{"isIframe":false}']])] []
dark-reflow {'sw': 450, 'cw': 320, 'bg': 'rg ...
````

## 40. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > noshot.mjs <<'EOF'
import http from 'node:http'; import fs from 'node:fs/promises'; import path from 'node:path'; import { spawn } from 'node:child_process';
const REPO='$REPO';
const S=path.dirname(new URL(import.meta.url).pathname);
const PORT=Number((await fs.readFile(path.join(S,'base.txt'),'utf8')).split(':').pop());
const MIME={'.html':'text/html; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');const p=u.pathname==='/'?'/index.html':u.pathname;try{const b=await fs.readFile(path.join(S,'site',path.normalize(p)));res.writeHead(200,{'content-type':MIME[path.extname(p)]??'text/plain'});res.end(b)}catch{res.writeHead(404);res.end()}});
await new Promise((r,j)=>{srv.once('error',j);srv.listen(PORT,'127.0.0.1',r)});
const cfg=JSON.parse(await fs.readFile(path.join(S,'cfg.json'),'utf8'));
const variant=process.argv[2];
if (variant==='noshot') cfg.scan.fullPageScreenshots=false;
if (variant==='noproc-noshot') { cfg.scan.fullPageScreenshots=false; cfg.processes=[]; }
await fs.writeFile(path.join(S,`cfg-${variant}.json`),JSON.stringify(cfg,null,2));
const out=path.join(S,variant); await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
await fs.cp(path.join(S,'out1','inventory'),path.join(out,'inventory'),{recursive:true});
await fs.cp(path.join(S,'out1','sample.json'),path.join(out,'sample.json'));
const run=(args)=>new Promise(r=>{const cp=spawn(process.execPath,[`${REPO}/bin/wcag-em.mjs`,...args],{cwd:S,env:{...process.env,CRAWLEE_STORAGE_DIR:path.join(S,'crawlee-storage',variant)}});let o='';cp.stdout.on('data',d=>o+=d);cp.stderr.on('data',d=>o+=d);cp.on('close',c=>r({c,o}))});
try { for (const st of ['scan','scan-processes','summarize']) { const r=await run([st,'--config',path.join(S,`cfg-${variant}.json`),'--out-dir',out]); console.log(variant,st,'exit',r.c); await fs.appendFile(path.join(S,`${variant}.log`),r.o); } }
finally { srv.close(); }
const w=JSON.parse(await fs.readFile(path.join(out,'reports','wcag-em-summary.json'),'utf8'));
const pe=JSON.parse(await fs.readFile(path.join(out,'reports','portal-export.json'),'utf8'));
console.log(variant,'1.4.12 =',w.criteriaOutcomes.find(c=>c.sc==='1.4.12').outcome,'scoreBasis',JSON.stringify(pe.summary.scoreBasis),'avg',pe.summary.averageScore);
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node noshot.mjs noshot && node noshot.mjs noproc-noshot
````

Output (truncated):

````text
noshot scan exit 0
noshot scan-processes exit 0
noshot summarize exit 2
noshot 1.4.12 = passed scoreBasis {"passed":7,"failed":5,"cantTell":0,"inapplicable":9,"notTested":36} avg 58
noproc-noshot scan exit 0
noproc-noshot scan-processes exit 0
noproc-noshot summarize exit 2
noproc-noshot 1.4.12 = inapplicable scoreBasis {"passed":6,"failed":5,"cantTell":0,"inapplicable":10,"notTested":36} avg 55
````

## 41. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 -c "
import json
for v in ['out1','noshot']:
    tk=json.load(open(v+'/results/axe-results.json'))
    print(v,[ (r['url'].split('/')[-1] or '/', r['viewport']) for r in tk if any(p['id']=='avoid-inline-spacing' for p in r['passesDetail'])])
    pr=json.load(open(v+'/results/process-results.json'))
    print(v,'process', [ (p['viewport'], s['state']) for p in pr for s in p['states'] if any(x['id']=='avoid-inline-spacing' for x in s.get('passesDetail',[]))])
"; sed -n 55,80p $REPO/src/commands/scan-processes.mjs; grep -n "case 'screenshot'" -A 14 $REPO/src/lib/process-runner.mjs | head -20
````

Output (truncated):

````text
out1 [('multi.html', 'desktop'), ('form.html', 'desktop'), ('multi.html', 'reflow'), ('form.html', 'reflow')]
out1 process [('desktop', 'blank-submit'), ('reflow', 'blank-submit')]
noshot []
noshot process [('desktop', 'blank-submit'), ('reflow', 'blank-submit')]
  if (processDef.pattern === 'partial-submit') {
    const fills = (processDef.fields || []).map(
      /** @type {(field: any) => { action: string, selector: string, value: string }} */ (
        (field) => ({
          action: 'fill',
          selector: field.selector,
          value: field.value ?? '',
        })
      ),
    );
    return [
      { action: 'goto', url: processDef.startUrl },
      ...fills,
      {
        action: 'click',
        selector: processDef.selectors?.submit ?? "button[type='submit'], input[type=' ...
````

## 42. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && cat > caret.mjs <<'EOF'
import path from 'node:path';
const REPO='$REPO';
const S=path.dirname(new URL(import.meta.url).pathname);
const { chromium } = await import(`${REPO}/node_modules/playwright/index.mjs`);
const pw = JSON.parse(await (await import('node:fs/promises')).readFile(`${REPO}/node_modules/playwright/package.json`,'utf8')).version;
const br=await chromium.launch();
try { for (const opts of [{}, {caret:'initial'}, {caret:'hide'}]) {
  const pg=await (await br.newContext()).newPage();
  await pg.setContent('<html lang=en><body><label>A <input></label><textarea aria-label=t></textarea><div contenteditable>x</div><select aria-label=s><option>1</option></select><button>b</button></body></html>');
  await pg.screenshot({ path: path.join(S,'c.png'), ...opts });
  console.log('playwright',pw, JSON.stringify(opts), await pg.evaluate(()=>[...document.querySelectorAll('[style]')].map(e=>e.tagName+':'+JSON.stringify(e.getAttribute('style')))));
} } finally { await br.close(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node caret.mjs
````

Output (truncated):

````text
playwright 1.59.1 {} [ 'INPUT:""', 'TEXTAREA:""', 'DIV:""' ]
playwright 1.59.1 {"caret":"initial"} []
playwright 1.59.1 {"caret":"hide"} [ 'INPUT:""', 'TEXTAREA:""', 'DIV:""' ]
````

## 43. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 - <<'EOF'
import json,collections
s=json.load(open('summary.json')); g=json.load(open('grouped-by-rule.json')); c=json.load(open('grouped-by-component.json'))
print('grouped-by-rule == summary.findings:', g==s['findings'])
comp=collections.Counter(); compPages=collections.defaultdict(set)
for x in c: comp[x['ruleId']]+=x['occurrences']; compPages[x['ruleId']]|=set(x['pages'])
for f in s['findings']:
    print(f['id'], f['occurrences'], comp[f['id']], f['pageCount'], len(compPages[f['id']]), 'OK' if (f['occurrences']==comp[f['id']] and f['pageCount']==len(compPages[f['id']])) else 'MISMATCH')
rc=json.load(open('random-vs-structured-comparison.json')); print(rc)
w=json.load(open('wcag-em-summary.json')); print('wcag-em-summary == summary.wcagEmSummary', w==s['wcagEmSummary'])
EOF
````

Output (truncated):

````text
grouped-by-rule == summary.findings: False
aria-roles 4 4 2 2 OK
button-name 4 4 2 2 OK
image-alt 11 11 5 5 OK
label 2 2 1 1 OK
color-contrast 9 9 4 4 OK
link-name 2 2 1 1 OK
target-size 6 6 1 1 OK
heading-order 2 2 1 1 OK
landmark-one-main 2 2 1 1 OK
landmark-unique 2 2 1 1 OK
region 8 8 1 1 OK
scope-attr-valid 2 2 1 1 OK
{'tool': {'name': 'wcag-em-a11y-toolkit', 'version': '1.1.0', 'axeCore': '4.11.2'}, 'randomSampleIntroducedNewRuleIds': [], 'randomSampleIntroducedNewClusters': [], 'expandStructuredSampleRecommended': False}
wcag-em-summary == summary.wcagEmSummary False
````

## 44. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 - <<'EOF'
import json
s=json.load(open('summary.json')); g=json.load(open('grouped-by-rule.json')); w=json.load(open('wcag-em-summary.json'))
print(type(g), (list(g.keys()) if isinstance(g,dict) else len(g)))
G=g['findings'] if isinstance(g,dict) and 'findings' in g else g
print('findings equal:', G==s['findings'])
ks=set(w)|set(s['wcagEmSummary']); print('wcag keys diff', [k for k in ks if w.get(k)!=s['wcagEmSummary'].get(k)])
EOF
````

Output (truncated):

````text
<class 'list'> 12
findings equal: False
wcag keys diff ['tool']
````

## 45. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 - <<'EOF'
import json
s=json.load(open('summary.json')); g=json.load(open('grouped-by-rule.json')); w=json.load(open('wcag-em-summary.json'))
for a,b in zip(g,s['findings']):
    d=[k for k in set(a)|set(b) if a.get(k)!=b.get(k)]
    if d: print(a['id'], d, [ (a.get(k),b.get(k)) for k in d][:2])
print(w['tool'], s['wcagEmSummary'].get('tool'))
EOF
````

Output (truncated):

````text
landmark-unique ['examples', 'id', 'targets', 'clusters', 'helpUrl', 'help', 'pages'] [([{'pageUrl': 'http://127.0.0.1:54805/iframe.html', 'target': 'main', 'html': '<main>\n<h1>Iframe host</h1><iframe title="Inner frame" src="/frame-inner.html" width="400" height="200"></iframe>\n</main>', 'failureSummary': 'Fix any of the following:\n  The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishable'}, {'pageUrl': 'http://127.0.0.1:54805/iframe.html', 'target': 'main', 'html': '<main>\n<h1>Iframe host</h1><iframe title="Inner frame" src="/frame-inner.html" width="400" height="200"></iframe>\n</main>', 'failureSummary': 'Fix any of the following:\n  The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishabl ...
````

## 46. Bash

````bash
sed -n 280,365p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
        );
        continue;
      }
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyReviewableIncomplete = true;
        b.relatedRules.add(inc.id);
        b.pages.add(pageUrl);
        if (b.incompleteExamples.length < 5) {
          b.incompleteExamples.push({ pageUrl, ruleId: inc.id, impact: inc.impact ?? null });
        }
      }
    }
    for (const ina of inapplicableDetail ?? []) {
      const meta = withActAndWcagMetadata(ina);
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyInapplicable = true;
        b.relatedRules.add(ina.id);
        b.pages.add(pageUrl);
      }
    }
  }

  for (const page of axeResults) {
    // E1: a could-not-audit page-view must not flip SC verdicts — its empty
    //  ...
````

## 47. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 -c "
import json
pr=json.load(open('out1/results/process-results.json'))
s=pr[0]['states'][1]
ids=lambda k:set(x['id'] for x in s.get(k,[]))
allp=ids('passesDetail')|ids('inapplicableDetail')|ids('incompleteDetail')|set(v['id'] for v in s['violations'])
tk=json.load(open('out1/results/axe-results.json'))
pg=[r for r in tk if r['url'].endswith('form.html') and r['viewport']=='desktop'][0]
allpg=set(x['id'] for k in ['passesDetail','inapplicableDetail','incompleteDetail'] for x in pg[k])|set(v['id'] for v in pg['violations'])
print('state rules',len(allp),'page rules',len(allpg)); print('only in page scan',sorted(allpg-allp)); print('only in process state',sorted(allp-allpg))
"; grep -n "AxeBuilder\|withTags\|analyze" $REPO/src/lib/process-runner.mjs | head
````

Output (truncated):

````text
state rules 89 page rules 90
only in page scan ['target-size']
only in process state []
25:// NOTE: see scan.mjs for rationale on the AxeBuilder type cast.
26:import AxeBuilderImport from '@axe-core/playwright';
27:const AxeBuilder = /** @type {any} */ (AxeBuilderImport);
350:  const result = await new AxeBuilder({ page }).analyze();
````

## 48. Bash

````bash
cd $SCRATCH/review && python3 -c "
import json,re
d=json.load(open('round1-findings.json')); F=d if isinstance(d,list) else d.get('findings',d)
for f in F:
    b=json.dumps(f)
    for m in re.finditer(r'.{150}target-size.{150}',b): print(f['id'],'::',m.group(0))
e=json.load(open('round1-experiments.json'))
for x in e:
    b=json.dumps(x)
    for m in re.finditer(r'.{100}target-size.{100}',b): print('EXP',x['what'][:50],'::',m.group(0))
"
````

Output (truncated):

````text
VERD-03 :: ssed, 1.3.5 inapplicable). A '2.1' run (the EN 301 549 baseline) emits the 6 WCAG 2.2-only SCs, including 2.5.8, which would come out 'failed' on any target-size violation, while the draft says 'WCAG 2.1 Level AA'. The same decoupling means conformanceTarget 'AAA' never enables axe's AAA rules (color-contrast-
SCAN-01 :: ages audited)'. p17: /account and /account/orders 302 to a second-origin IdP /login?return=...; both were audited (button-name, label, html-has-lang, target-size on the IdP URLs), with scanWarnings [] and 'Automated coverage: complete (3 selected pages audited)'. p1: /json (application/json) and /text (text/pl
SCAN-11 :: page with a cross-origin booking iframe that responds after 8s. With fullPageScreenshots true, 4 in-iframe violations (button-name, image-alt,  ...
````

## 49. Bash

````bash
node -e "
const fs=require('fs');const s=fs.readFileSync('node_modules/axe-core/axe.js','utf8');
const i=s.indexOf(\"id: 'target-size'\"); console.log(s.slice(i-20,i+400));
" 2>/dev/null | head -20; node -p "require('./node_modules/axe-core/package.json').version"; ls node_modules/@axe-core/playwright/node_modules 2>/dev/null
````

Output (truncated):

````text
Exit code 1
: []
    }, {
      id: 'target-size',
      impact: 'serious',
      selector: '*',
      enabled: false,
      matches: 'widget-not-inline-matches',
      tags: [ 'cat.sensory-and-visual-cues', 'wcag22aa', 'wcag258' ],
      all: [],
      any: [ {
        options: {
          minSize: 24
        },
        id: 'target-size'
      }, {
        options: {
          minOffset: 24
        },
        id: 'target-offset
4.11.3
````

## 50. Bash

````bash
python3 - <<'EOF'
import re
s=open('node_modules/axe-core/axe.js').read()
for m in re.finditer(r"\{\s*id: '([a-z0-9-]+)',(?:(?!\bid: ').){0,400}?enabled: false,(?:(?!\bid: ').){0,200}?tags: \[([^\]]*)\]",s,re.S):
    print(m.group(1), m.group(2).replace("'","").replace('\n',' ')[:120])
EOF
````

Output (truncated):

````text
audio-caption  cat.time-and-media, wcag2a, wcag121, EN-301-549, EN-9.1.2.1, section508, section508.22.a, deprecated 
color-contrast-enhanced  cat.color, wcag2aaa, wcag146, ACT 
identical-links-same-purpose  cat.semantics, wcag2aaa, wcag249 
meta-refresh-no-exceptions  cat.time-and-media, wcag2aaa, wcag224, wcag325 
target-size  cat.sensory-and-visual-cues, wcag22aa, wcag258
````

## 51. Bash

````bash
cd $SCRATCH/review && python3 -c "
import json,re
d=json.load(open('round1-findings.json')); F=d if isinstance(d,list) else d.get('findings',d)
for f in F:
    b=json.dumps(f).lower()
    if 'junit' in b and ('best-practice' in b or 'moderate' in b or 'minor' in b):
        for m in re.finditer(r'.{120}junit.{160}',b): print(f['id'],'::',m.group(0)[:280]); 
" | head -12; grep -n -i 'junit' $REPO/docs/guides/integrations.md | head -12
````

Output (truncated):

````text
112:threshold), and `reports/junit.xml` gives the CI system per-finding test
138:threshold so CI reports rather than blocks). Publish `junit.xml` to your CI's
139:test-report UI if it supports JUnit ingestion, and always upload the reports
````

## 52. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && rm -rf bponly && cp -R noproc-noshot bponly && python3 - <<'EOF'
import json
p='bponly/results/axe-results.json'; a=json.load(open(p))
keep=[r for r in a if r['url'].endswith(('bp.html','clean.html','/'))]
json.dump(keep,open(p,'w'),indent=2)
json.dump([],open('bponly/results/process-results.json','w'))
print(len(keep))
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node $REPO/bin/wcag-em.mjs summarize --config cfg-noproc-noshot.json --out-dir $S/bponly > bponly.log 2>&1; echo "summarize exit=$?"; python3 - <<'EOF'
import xml.etree.ElementTree as ET, json
t=ET.parse('bponly/reports/junit.xml').getroot(); print('junit', t.attrib, [ (c.attrib['classname'], c.find('failure').attrib.get('type')) for c in t.iter('testcase')])
pe=json.load(open('bponly/reports/portal-export.json')); print('portal', pe['summary']['totalIssues'], pe['summary']['manualReviewIssues'], pe['summary'].get('averageScore'))
s=json.load(open('bponly/reports/summary.json')); print('findings',[ (f['id'],f['classification']) for f in s['findings']])
EOF
grep -n 'Grouped findings\|coverage' bponly/reports/summary.md | head -4
````

Output (truncated):

````text
6
summarize exit=0
junit {'name': 'WCAG-EM Audit', 'tests': '4', 'failures': '4', 'time': '0'} [('heading-order', 'moderate'), ('landmark-one-main', 'moderate'), ('region', 'moderate'), ('scope-attr-valid', 'moderate')]
portal 0 4 100
findings [('heading-order', 'best-practice-or-manual-review'), ('landmark-one-main', 'best-practice-or-manual-review'), ('region', 'best-practice-or-manual-review'), ('scope-attr-valid', 'best-practice-or-manual-review')]
21:- Grouped findings: 4
22:- Automated coverage: partial — PARTIAL (3/11 selected pages audited)
30:## Grouped findings by rule
````

## 53. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 - <<'EOF'
import json,re,html
d=json.load(open('report-builder-draft.json'))
print(json.dumps(d['sourceRun'])[:700]); print(json.dumps(d['scope'])[:900])
print(json.dumps(d['executiveSummary'])[:900])
EOF
````

Output (truncated):

````text
{"sourceFolder": "$SCRATCH/wf2/e2e/out1", "toolName": "wcag-em-a11y-toolkit", "toolVersion": "1.1.0", "axeCoreVersion": "4.11.2", "generatedAt": "2026-09-30", "sourceFiles": ["reports/summary.json", "reports/wcag-em-summary.json", "results/axe-results.json"]}
{"websiteOrProduct": "e2e-ground-truth", "pagesTested": ["http://127.0.0.1:54805/", "http://127.0.0.1:54805/bp.html", "http://127.0.0.1:54805/clean.html", "http://127.0.0.1:54805/extra.html", "http://127.0.0.1:54805/form.html", "http://127.0.0.1:54805/iframe.html", "http://127.0.0.1:54805/multi.html", "http://127.0.0.1:54805/narrow.html", "http://127.0.0.1:54805/review.html", "http://127.0.0.1:54805/roles.html", "http://127.0.0.1:54805/shadow.html"], "journeysTested": ["contact-form"], "standard": "WCAG 2.2 Level AA", "samplingMethod" ...
````

## 54. Bash

````bash
cd $SCRATCH/review && python3 -c "
import json,re
d=json.load(open('round1-findings.json')); F=d if isinstance(d,list) else d.get('findings',d)
for f in F:
    b=json.dumps(f)
    for k in ['manualReviewIssues','keyMetrics','Automated findings','totalIssues','Needs-review findings']:
        for m in re.finditer(r'.{120}'+re.escape(k)+r'.{160}',b): print(f['id'],k,'::',m.group(0)[:300])
"; grep -n 'Automated findings\|Needs-review findings\|keyMetrics' -A3 $REPO/src/reporters/report-builder-starter.mjs | head -20; grep -an 'manualReviewIssues\|totalIssues\|findingKind' $REPO/src/reporters/portal-export.mjs | head
````

Output (truncated):

````text
SCAN-04 totalIssues :: verage {status:'complete',adequate:true}, criteriaOutcomes 56 \u00d7 notTested, and portal scoreBasis notTested:56 with totalIssues 0. p19 (withTags ['WCAG2A','wcag2.1aa'], --log-level=debug): 6 log lines, none mentioning tags, and 0 for passes, incomplete, inapplicable and violations. p2 '
SCAN-12 manualReviewIssues :: n:'reduce'}) gave no incomplete.", "impact": "False needs-review items reach client needs-review lists and the portal's manualReviewIssues. Dark-mode contrast barriers are never detected, and outputs vary between auditors' machines.", "recommendation": "Add scan.emulation {reducedMotion (consider 
REPB-02 manualReviewIssues :: Result: exit 0, samplePagesScanned 0, 56/56 SCs notTested, and portal-export summary = {totalIssues:0, reportedTotal:0, manual ...
````

## 55. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 -c "
import json;d=json.load(open('report-builder-draft.json'))
for f in d['findings']: print(f['id'],f['sourceRuleId'],f['severity'],f['status'],f['priorityTier'],'wcag',f['wcag'],'incl',f['includeInReport'],'nmr',f['needsManualReview'],f['draftStatus'])
"
````

Output (truncated):

````text
EGT-001 aria-roles Critical Not retested Tier 1 wcag [{'criterion': '4.1.2', 'name': 'Name, Role, Value', 'level': 'A'}] incl True nmr True generated
EGT-002 button-name Critical Not retested Tier 1 wcag [{'criterion': '4.1.2', 'name': 'Name, Role, Value', 'level': 'A'}] incl True nmr True generated
EGT-003 image-alt Critical Not retested Tier 1 wcag [{'criterion': '1.1.1', 'name': 'Non-text Content', 'level': 'A'}] incl True nmr True generated
EGT-004 label Critical Not retested Tier 1 wcag [{'criterion': '4.1.2', 'name': 'Name, Role, Value', 'level': 'A'}] incl True nmr True generated
EGT-005 color-contrast Serious Not retested Tier 1 wcag [{'criterion': '1.4.3', 'name': 'Contrast (Minimum)', 'level': 'AA'}] incl True nmr True generated
EGT-006 link-name Serious Not retested Tier 1 wcag  ...
````

## 56. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S/out1/reports && python3 -c "
import json;d=json.load(open('report-builder-draft.json'))
f=d['findings'][2]; print(f['affectedPages']); print(json.dumps(f['evidence'])[:1200])
" ; grep -o '[^"]*reflow[^"]*' report-builder-draft.json | head
````

Output (truncated):

````text
['http://127.0.0.1:54805/iframe.html', 'http://127.0.0.1:54805/multi.html', 'http://127.0.0.1:54805/narrow.html', 'http://127.0.0.1:54805/roles.html', 'http://127.0.0.1:54805/shadow.html']
[{"type": "axe", "label": "image-alt automated evidence", "tool": "axe-core", "content": "11 occurrence(s) across 5 page(s). Classification: primary-automated-finding. Axe: Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"", "pageUrl": "http://127.0.0.1:54805/multi.html", "target": "img:nth- ...
````

## 57. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && grep -o '<h2[^>]*>[^<]*</h2>' out1/reports/summary.html; grep -o '.\{80\}1\.4\.12.\{80\}' out1/reports/summary.html | head -3; grep -c '1.4.12' noproc-noshot/reports/summary.html; grep -o '.\{30\}1\.4\.12.\{60\}' noproc-noshot/reports/summary.html | head -2; cd $REPO && grep -rn "caret" src test | head
````

Output (truncated):

````text
<h2>Run summary</h2>
<h2>Findings by WCAG success criterion</h2>
<h2>Grouped findings by rule</h2>
<h2>Incomplete results (needs review)</h2>
1
````

## 58. Bash

````bash
S=$SCRATCH/wf2/e2e; cd $S && python3 - <<'EOF'
import re
for v in ['out1','noproc-noshot']:
    t=open(v+'/reports/summary.html').read()
    i=t.find('1.4.12'); print(v, re.sub(r'\s+',' ',t[i-40:i+200]))
    j=t.find('Passing criteria'); print('  passing section:', re.sub(r'<[^>]+>',' ',t[j:j+600])[:400] if j>=0 else 'none')
EOF
cd $REPO && rg -n "caret" src test; echo "rg caret exit=$?"
````

Output (truncated):

````text
out1 d">notTested</td><td></td></tr> <tr><td>1.4.12</td><td>passed</td><td>avoid-inline-spacing</td></tr> <tr><td>1.4.13</td><td class="outcome-notTested">notTested</td><td></td></tr> <tr><td>2.1.1</td><td>inapplicable</td><td>frame-focusable-co
  passing section: none
noproc-noshot d">notTested</td><td></td></tr> <tr><td>1.4.12</td><td>inapplicable</td><td>avoid-inline-spacing</td></tr> <tr><td>1.4.13</td><td class="outcome-notTested">notTested</td><td></td></tr> <tr><td>2.1.1</td><td>inapplicable</td><td>frame-focusa
  passing section: none
rg caret exit=1
````

## 59. Bash

````bash
grep -n "entry.examples.push" src/lib/group-findings.mjs; grep -n "violationExamples.push\|violationExamples.length" src/lib/wcag-em-summary.mjs; grep -an "collapses viewport repeats" src/reporters/portal-export.mjs; grep -n "viewport: vp.id. everywhere\|### 3" docs/adr/0006-multi-viewport-axe-runs.md; grep -n "relative\|screenshot" src/reporters/html.mjs | head -12; grep -n "screenshot:" src/commands/scan.mjs | head -3; grep -n "const result = await new AxeBuilder" src/lib/process-runner.mjs
````

Output (truncated):

````text
112:    if (entry.examples.length < 5) entry.examples.push({ pageUrl, target, html, failureSummary });
257:        if (b.violationExamples.length < 5) {
258:          b.violationExamples.push({ pageUrl, ruleId: v.id, impact: v.impact ?? null });
299:  // Dedupe by (url, selector) — collapses viewport repeats — then sort.
92:### 3. Result and artefact shape — `viewport: vp.id` everywhere
21: * `path.relative(ctx.paths.reportsDir, absolutePath)` so the `<img src>`
76:  .screenshot { max-width: 100%; border: 1px solid #ddd; margin-top: 0.5rem; }
110:  const screenshotsByUrl = await loadScreenshotMap(ctx);
123:    renderFindings(findings, ctx, screenshotsByUrl) +
271: * @param {Map<string, string[]>} screenshotsByUrl
274:function renderFindings(findings, ctx, screenshotsByUrl) {
298:    // Fir ...
````

## 60. Bash

````bash
cd $SCRATCH/review && python3 -c "
import json
d=json.load(open('round1-findings.json')); F=d if isinstance(d,list) else d.get('findings',d)
for f in F:
    if f['id'] in ('REPB-18','VERD-07','REPA-17','VERD-01','REPB-06'): print(f['id'],'|',f['claim'][:700]); print('   REC:',f.get('recommendation','')[:300]); print()
"
````

Output (truncated):

````text
VERD-01 | decideOutcome marks an SC 'passed' when any non-best-practice rule tagged with that SC passed on any page. It marks the SC 'inapplicable' when every tagged rule was inapplicable. Nothing records how much of the SC axe can actually test. In a normal run against a local fixture the toolkit reported these false passes: 1.1.1 (alt="DSC_0042.jpg" and alt="image"), 3.1.1 (lang="fr" on an all-English page), 2.4.2 (<title>Page</title>), 2.4.4 (two different links both labelled 'click here'), 3.3.2 (only form-field-multiple-labels ran) and 1.4.12 (only avoid-inline-spacing). It also reported these false inapplicables: 1.4.4 Resize Text (the page simply has no <meta viewport>), 1.3.5 (name/email/tel i
   REC: Add an SC coverage model, for example a data file mapping each SC to 'axe can fai ...
````

## 61. Bash

````bash
ps -axo pid,etime,command | grep -E 'wf2/e2e|driver.mjs|noshot.mjs|wcag-em.mjs' | grep -v grep | head; lsof -nP -iTCP:54805 -sTCP:LISTEN 2>/dev/null | head -3; echo done
````

Output (truncated):

````text
80239       00:07 ~/.nvm/versions/node/v22.14.0/bin/node $REPO/bin/wcag-em.mjs audit --config $SCRATCH/wf2/verify-A03/cfg.json --out-dir $SCRATCH/wf2/verify-A03/out
done
````

## 62. Bash

````bash
grep -n "const outcome = typeof f.outcome\|outcome === 'passed' && !includePasses" src/reporters/junit.mjs; grep -n "function decideOutcome" -A 14 src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
65:    const outcome = typeof f.outcome === 'string' ? f.outcome : 'failed';
67:    if (outcome === 'passed' && !includePasses) continue;
510:function decideOutcome(bucket) {
511-  if (bucket.anyViolation) return 'failed';
512-  if (bucket.anyReviewableIncomplete) return 'cantTell';
513-  if (bucket.anyNonBestPracticePass) return 'passed';
514-  if (bucket.anyInapplicable) return 'inapplicable';
515-  // Bucket exists only because SOME rule tagged this SC — but none of the above
516-  // fired. This shouldn't happen in practice (a bucket is always populated by
517-  // at least one arm), but if it does, `untested` is the safest fallback.
518-  return 'untested';
519-}
520-
521-/**
522- * Natural numeric sort for SC strings like "1.2.10" (10 must sort after 9).
523- *
524- * @param {string} ...
````
