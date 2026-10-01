# Probe record: verify:A09

Role: packet verifier. Findings: SAMP-03, DISC-14, SAMP-06, SAMP-07, SAMP-11, SAMP-09

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" SAMP-03,DISC-14,SAMP-06,SAMP-07,SAMP-11,SAMP-09
````

Output (truncated):

````text
[
 {
  "dimension": "SAMP",
  "id": "SAMP-03",
  "title": "autoSuggest.perCluster means 'clusters per page type', not 'representatives per cluster'. By default only one cluster per type is sampled",
  "category": "correctness",
  "severity": "high",
  "status": "new",
  "claim": "The auto-suggest loop takes the first N clusters of each preferred page type and adds one representative from each. It never adds more than one page per cluster, and it skips every other cluster of the same type. The config guide says it adds 'one representative page per discovered page-type cluster' and calls perCluster 'Representatives per cluster'. With the shipped defaults (perCluster 1, six types), the auto-suggested structured sample tops out at 6 pages, whatever the number of distinct templates. Clusters le ...
````

## 2. Bash

````bash
sed -n 470,510p src/lib/wcag-em-summary.mjs; echo ----; grep -rn "process-candidates\|processCandidates" src docs README.md | head; echo ----; grep -rn "canonical" src | head; echo ---; grep -rn "\.h1\b\|item.h1\|h1:" src | head
````

Output (truncated):

````text
 * @returns {string}
 */
function resolveSamplingMethodNotes(wcagEmConfig, sampleMetadata) {
  if (
    typeof wcagEmConfig.samplingMethodNotes === 'string' &&
    wcagEmConfig.samplingMethodNotes.trim().length > 0
  ) {
    return wcagEmConfig.samplingMethodNotes;
  }
  const structured = sampleMetadata?.structuredCount;
  const random = sampleMetadata?.randomCount;
  if (typeof structured !== 'number' || typeof random !== 'number') {
    // No sample-metadata available (e.g. summarize over a partial out-dir):
    // keep the historical empty string rather than inventing provenance.
    return '';
  }
  const percent = Number(sampleMetadata.randomPercent ?? 0) * 100;
  const seed = sampleMetadata.randomSeed;
  const inventoryCount = sampleMetadata.inventoryCount;
  const parts = [
    `St ...
````

## 3. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A09 && cat > $SCRATCH/wf2/verify-A09/probe.mjs <<'EOF'
import fs from 'node:fs/promises';
import path from 'node:path';
const R = '$REPO/src';
const { guessPageType, clusterKeyFor, guessProcessTypes, normalizeUrl } = await import(`file://${R}/lib/urls.mjs`);
const { run: sampleRun } = await import(`file://${R}/commands/sample.mjs`);
const { defineHidden } = await import(`file://${R}/lib/context.mjs`);
const { DEFAULTS } = await import(`file://${R}/lib/config.mjs`).catch(() => ({}));
const SCR = path.dirname(new URL(import.meta.url).pathname);
const B = 'https://charity.test';

// 1. classifier table
const paths = ['/research','/research/papers/2025','/contact-lenses','/support-services','/support/groups','/services/accessibility-consulting','/accessibility-services','/cookies-recipes','/facebook','/ebooks','/cartoons','/notebook-guide','/applying-for-grants','/registered-charity','/donate','/feedback-form','/?s=braille','/search','/contact','/privacy','/index.php?page=contact'];
console.log('== guessPageType');
for (const p of paths) console.log(p.padEnd(40), guessPageType(B + p));
console.log('guessProcessTypes support host /about:', guessProcessTypes({ url: 'https://support.example.org/about' }));
console.log('guessProcessTypes /about?ref=contact:', guessProcessTypes({ url: B + '/about?ref=contact' }));

// 2. build inventory + clusters exactly like discover.mjs:323-341
const urls = [
  '/', '/about', '/team', '/contact', '/privacy', '/donate', '/feedback-form', '/search',
  ...Array.from({ length: 6 }, (_, i) => `/news/post-${i}`), '/news',
  ...Array.from({ length: 5 }, (_, i) => `/services/svc-${i}`), '/services',
  ...Array.from({ length: 4 }, (_, i) => `/events/ev-${i}`), '/events',
  ...Array.from({ length: 3 }, (_, i) => `/shop/item-${i}`), '/shop',
  '/terms', '/cookies',
].map((p) => normalizeUrl(B + p));
const inventory = urls.map((u) => { const pageType = guessPageType(u); return { url: u, pageType, clusterKey: clusterKeyFor(u, pageType), firstPathSegment: new URL(u).pathname.split('/').filter(Boolean)[0] ?? '(root)' }; }).sort((a, b) => a.url.localeCompare(b.url));
const clusters = Object.values(Object.groupBy(inventory, (i) => i.clusterKey)).filter((g) => Array.isArray(g) && g.length > 0).map((g) => ({ clusterKey: g[0].clusterKey, pageType: g[0].pageType, firstPathSegment: g[0].firstPathSegment, count: g.length, representativeUrl: g.map((i) => i.url).sort((a, b) => a.length - b.length)[0] })).sort((a, b) => b.count - a.count || a.clusterKey.localeCompare(b.clusterKey));
console.log('\n== clusters'); for (const c of clusters) console.log(c.clusterKey.padEnd(28), c.count, c.representativeUrl);

async function runSample(label, sampleCfg, processes = []) {
  const dir = path.join(SCR, 'out-' + label);
  await fs.rm(dir, { recursive: true, force: true });
  const inventoryDir = path.join(dir, 'inventory');
  await fs.mkdir(inventoryDir, { recursive: true });
  await fs.writeFile(path.join(inventoryDir, 'inventory.json'), JSON.stringify(inventory));
  await fs.writeFile(path.join(inventoryDir, 'page-clusters.json'), JSON.stringify(clusters));
  const warns = [];
  const logger = { info() {}, debug() {}, error() {}, trace() {}, fatal() {}, warn: (p, m) => warns.push({ p, m }) };
  const ctx = { config: { name: 'x', rootUrl: B + '/', sample: sampleCfg, processes }, configPath: path.join(dir, 'c.json'), logger, paths: { outDir: dir, inventoryDir, resultsDir: dir, reportsDir: dir, screenshotsDir: dir, sampleJsonPath: path.join(dir, 'sample.json') }, args: {} };
  defineHidden(ctx, 'preflightRan', true);
  await sampleRun(ctx);
  const sug = JSON.parse(await fs.readFile(path.join(inventoryDir, 'structured-sample-suggested.json'), 'utf8'));
  const meta = JSON.parse(await fs.readFile(path.join(inventoryDir, 'sample-metadata.json'), 'utf8'));
  const sample = JSON.parse(await fs.readFile(path.join(dir, 'sample.json'), 'utf8'));
  return { sug, meta, sample, warns };
}
const base = { structuredManual: [], randomPercentOfStructured: 0.1, minRandomPages: 2, randomSeed: 1, smallSiteSupplementaryScanThreshold: 50 };
const types6 = ['homepage', 'form-or-contact', 'policy', 'listing', 'detail', 'content'];
for (const pc of [1, 3, 20]) {
  const { sug } = await runSample('pc' + pc, { ...base, autoSuggest: { enabled: true, perCluster: pc, preferTypes: types6 } });
  const f = sug.finalStructured;
  const perCluster = {}; for (const u of f) { const k = inventory.find((i) => i.url === u)?.clusterKey; perCluster[k] = (perCluster[k] || 0) + 1; }
  const unrep = clusters.filter((c) => !perCluster[c.clusterKey]).map((c) => c.clusterKey);
  console.log(`\n== perCluster=${pc}: structured=${f.length}`, JSON.stringify(perCluster), '\n   unrepresented:', unrep.join(', '));
}

// 3. process expansion
const r = await runSample('proc', { ...base, autoSuggest: { enabled: true, perCluster: 1, preferTypes: types6 } }, [
  { name: 'donate', startUrl: B + '/donate', relatedUrls: [B + '/donate/step-2', B + '/donate/thanks'] },
  { name: 'offsite', startUrl: B + '/newsletter', forceInclude: true, relatedUrls: ['https://payments.other.test/checkout'] },
]);
console.log('\n== process expansion');
console.log('sample contains /donate?', r.sample.includes(B + '/donate'), '| step-2?', r.sample.includes(B + '/donate/step-2'), '| offsite?', r.sample.includes('https://payments.other.test/checkout'), '| /newsletter?', r.sample.includes(B + '/newsletter'));
console.log('meta.structuredMissingFromInventory', r.meta.structuredMissingFromInventory, 'processExpansion', r.meta.processExpansion);
console.log('warns', JSON.stringify(r.warns));
console.log('\n== sample-metadata keys', Object.keys(r.meta).join(','));
console.log('sample.json type', Array.isArray(r.sample) ? 'array of ' + typeof r.sample[0] : typeof r.sample);
console.log('suggested json keys', Object.keys(r.sug).join(','));
EOF
cd $SCRATCH/wf2/verify-A09 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs
````

Output (truncated):

````text
== guessPageType
/research                                search-or-results
/research/papers/2025                    search-or-results
/contact-lenses                          form-or-contact
/support-services                        form-or-contact
/support/groups                          form-or-contact
/services/accessibility-consulting       policy
/accessibility-services                  policy
/cookies-recipes                         policy
/facebook                                process-entry
/ebooks                                  process-entry
/cartoons                                process-entry
/notebook-guide                          process-entry
/applying-for-grants                     process-entry
/registered-charity                      process-entry
/donate              ...
````

## 4. Bash

````bash
ls configs; for f in configs/*.json; do python3 -c "import json,sys; c=json.load(open(sys.argv[1])); s=c.get('sample',{}); print(sys.argv[1], 'manual=',len(s.get('structuredManual',[])), 'auto=',s.get('autoSuggest'))" $f; done; sed -n 90,100p docs/guides/user-manual.md
````

Output (truncated):

````text
example-site-best-practice.json
example-site-with-auth.json
example-site-with-cdp.json
example-site-with-processes.json
example-site.json
legacy-events.json
configs/example-site-best-practice.json manual= 0 auto= {'enabled': True, 'perCluster': 1, 'preferTypes': ['homepage', 'form-or-contact', 'policy', 'listing', 'detail', 'content']}
configs/example-site-with-auth.json manual= 0 auto= {'enabled': True, 'perCluster': 1, 'preferTypes': ['homepage', 'form-or-contact', 'policy', 'listing', 'detail', 'content']}
configs/example-site-with-cdp.json manual= 0 auto= None
configs/example-site-with-processes.json manual= 2 auto= {'enabled': True, 'perCluster': 1}
configs/example-site.json manual= 0 auto= {'enabled': True, 'perCluster': 1, 'preferTypes': ['homepage', 'form-or-contact', 'policy', 'li ...
````

## 5. Bash

````bash
grep -n -i "sample\|seed" src/reporters/markdown.mjs src/reporters/html.mjs | head -20; echo ----; grep -n -i "sampl\|pages\b\|pageList\|structured" src/reporters/report-builder-starter.mjs | head -20; echo ---; grep -rn -i "sampledPages\|samplePages\|pagesInSample\|sample:" src/lib/wcag-em-summary.mjs src/commands/summarize.mjs | head
````

Output (truncated):

````text
src/reporters/html.mjs:170:    html`<tr><th>Final selected sample</th><td>${summary.finalSampleCount ?? 0}</td></tr>\n` +
src/reporters/html.mjs:171:    html`<tr><th>Sample pages scanned</th><td>${summary.samplePagesScanned ?? 0}</td></tr>\n` +
src/reporters/html.mjs:214:    out += html`<li>Crawl stopped at maxPages=${health.maxPagesConfigured}; the inventory (and sample) may be truncated.</li>\n`;
src/reporters/html.mjs:241:        ? 'Force-included sample URL blocked (challenge), not audited'
src/reporters/html.mjs:242:        : 'Force-included sample URL not in crawl inventory';
src/reporters/markdown.mjs:92:      `- Crawl stopped at maxPages=${health.maxPagesConfigured}; the inventory (and sample) may be truncated.`,
src/reporters/markdown.mjs:126:        ? `- Force-included sample URL ...
````

## 6. Bash

````bash
grep -n -i "sample" src/lib/wcag-em-summary.mjs | head -20; grep -n -i "structuredSample\|randomSample\|sampleUrls\|tier" src/commands/summarize.mjs | head
````

Output (truncated):

````text
165: * sampleMetadata }` is the input feedstock; the return value is the inverted
172: *   sampleMetadata?: Record<string, any>,
192:  const sampleMetadata =
193:    rawResults?.sampleMetadata && typeof rawResults.sampleMetadata === 'object'
194:      ? rawResults.sampleMetadata
417:    typeof sampleMetadata?.finalSampleCount === 'number' ? sampleMetadata.finalSampleCount : null;
447:    // NOTE: synthesized from sample-metadata when the config leaves it blank
451:    // be empty when the sample stage recorded how the sample was built.
452:    samplingMethodNotes: resolveSamplingMethodNotes(wcagEmConfig, sampleMetadata),
465: * otherwise a sentence synthesized from the sample stage's recorded counts —
469: * @param {Record<string, any>} sampleMetadata - `inventory/sample-metadata.json` con ...
````
