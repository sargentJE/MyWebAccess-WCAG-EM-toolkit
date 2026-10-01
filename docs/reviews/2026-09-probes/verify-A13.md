# Probe record: verify:A13

Role: packet verifier. Findings: SAMP-04, SAMP-05, SAMP-08, SAMP-10, SAMP-14, SAMP-15, VERD-08, VERD-09, VERD-10, VERD-19, CAP-04, CAP-05

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
cd $TMP && python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" SAMP-04,SAMP-05,SAMP-08,SAMP-10,SAMP-14,SAMP-15,VERD-08,VERD-09,VERD-10,VERD-19,CAP-04,CAP-05
````

Output (truncated):

````text
<persisted-output>
Output too large (32.5KB). Full output saved to: $CLAUDE_STATE

Preview (first 2KB):
[
 {
  "dimension": "VERD",
  "id": "VERD-08",
  "title": "The WCAG-EM Step 4.c structured-vs-random comparison looks only at violations. New cantTell outcomes, and random pages from page types the structured sample lacks, never trigger expansion. The comparison has no test",
  "category": "methodology",
  "severity": "medium",
  "status": "new",
  "claim": "ruleIdsSeenInRandom is built from violations only. randomClusters and structuredClusters are populated inside addRuleFinding, which runs only per violation node. So a random page from a page type absent from the structured sample, but with no violations, gives no signal. A random-only needs-review outcome that flips an SC to cantTell ...
````

## 2. Bash

````bash
python3 -c "
import json
d=json.load(open('$CLAUDE_STATE'))
for f in d:
  print('=====',f['id'],f['severity'],f['status'],f['title']); print(f['claim'])
  for e in f['evidence']: print('  -',e['file'],e.get('line'),'|',e.get('excerpt','')[:200].replace('\n',' '))
"
````

Output (truncated):

````text
===== VERD-08 medium new The WCAG-EM Step 4.c structured-vs-random comparison looks only at violations. New cantTell outcomes, and random pages from page types the structured sample lacks, never trigger expansion. The comparison has no test
ruleIdsSeenInRandom is built from violations only. randomClusters and structuredClusters are populated inside addRuleFinding, which runs only per violation node. So a random page from a page type absent from the structured sample, but with no violations, gives no signal. A random-only needs-review outcome that flips an SC to cantTell also gives no signal. WCAG-EM 4.c asks whether the random sample reveals new content types or new outcomes. The comparison code (summarize.mjs 568-587) is inline and no test asserts its values; the reporter tests pass hand- ...
````

## 3. Bash

````bash
R=$REPO; cd $R; sed -n 1,70p src/lib/sample-utils.mjs; echo ----; sed -n 30,140p src/commands/sample.mjs; echo ---; sed -n 195,215p schemas/config.schema.json
````

Output (truncated):

````text
// @ts-check
/**
 * @file Deterministic sampling primitives used by the sample-building stage.
 * @module lib/sample-utils
 *
 * @description
 * Two tiny helpers:
 *  - `seededSample` — Fisher–Yates shuffle backed by a Linear Congruential
 *    Generator (LCG), so the same seed always produces the same output.
 *  - `unique` — dedupe an array while dropping falsy entries.
 *
 * NOTE: The LCG is chosen for **reproducibility**, not statistical rigour.
 * WCAG-EM Step 3 requires the random sample selection method to be recorded
 * so audits are repeatable. A cryptographic RNG would be overkill and would
 * break that contract. See the `sample.randomSeed` field in the config schema.
 *
 * ANCHOR: LCG_CONSTANTS — 9301 / 49297 / 233280 are the Park–Miller / Numerical
 * Recipes variant; the comb ...
````

## 4. Bash

````bash
R=$REPO; cd $R; ls test/unit | grep -i -E "sampl|seed"; grep -rln "seededSample\|randomSeed" test | head; grep -rn "localeCompare" src | head -20; grep -n "seed\|order" docs/guides/config-guide.md | head
````

Output (truncated):

````text
sample-missing.test.mjs
test/unit/context-compile-actions.test.mjs
test/unit/sample-missing.test.mjs
test/unit/context-paths.test.mjs
test/unit/context-overrides-compiled.test.mjs
test/unit/validate-config.test.mjs
test/unit/config-defaults.test.mjs
test/unit/context-compile-regex.test.mjs
test/unit/docs-config-coverage.test.mjs
test/unit/context-preflight-cdp.test.mjs
test/fixtures/site.json.template
src/lib/urls.mjs:62:  const ordered = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
src/commands/summarize.mjs:566:    .sort((a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key));
src/commands/discover.mjs:323:  const inventory = [...discovered.values()].sort((a, b) => a.url.localeCompare(b.url));
src/commands/discover.mjs:341:    .sort((a, b) => b.c ...
````

## 5. Bash

````bash
R=$REPO; cd $R; grep -rn "seededSample\|sample-utils\|randomPool\|random-sample\|processExpansion" test | head -20; grep -rln "sample.mjs\|commands/sample" test
````

Output (truncated):

````text
test/unit/smoke.test.mjs:27:  '../../src/lib/sample-utils.mjs',
test/unit/summarize-url-dedup.test.mjs:60:  await fs.writeFile(path.join(inventoryDir, 'random-sample.txt'), '');
test/unit/sample-missing.test.mjs
````

## 6. Bash

````bash
S=$SCRATCH/wf2/verify-A13; mkdir -p $S; cat > $S/p.mjs <<'EOF'
import { seededSample, unique } from 'file://$REPO/src/lib/sample-utils.mjs';
const pool = Array.from({length:50},(_,i)=>'u'+i);
for (const s of [-1,-7,-12345]) { const r=seededSample(pool,5,s); console.log('seed',s,JSON.stringify(r), 'unique len', unique(r).length); }
console.log('alias', JSON.stringify(seededSample(pool,5,3))===JSON.stringify(seededSample(pool,5,3+233280)));
const a=['b','a','B','é','e','z','Z'].map(x=>'https://x/'+x);
console.log([...a].sort((x,y)=>x.localeCompare(y)).join(' '));
console.log([...a].sort((x,y)=>x.localeCompare(y,'sv')).join(' '));
console.log(new Intl.Collator().resolvedOptions().locale);
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node $S/p.mjs; LANG=sv_SE.UTF-8 LC_ALL=sv_SE.UTF-8 node -e "console.log(new Intl.Collator().resolvedOptions().locale, ['https://x/z','https://x/ä','https://x/a'].sort((x,y)=>x.localeCompare(y)).join(' '))"; node -e "console.log(new Intl.Collator().resolvedOptions().locale, ['https://x/z','https://x/ä','https://x/a'].sort((x,y)=>x.localeCompare(y)).join(' '))"
````

Output (truncated):

````text
seed -1 ["u23","u13","u11","u35","u29"] unique len 5
seed -7 ["u0","u8","u9",null,"u10"] unique len 4
seed -12345 ["u0","u2","u6","u4","u36"] unique len 5
alias true
https://x/a https://x/b https://x/B https://x/e https://x/é https://x/z https://x/Z
https://x/a https://x/b https://x/B https://x/e https://x/é https://x/z https://x/Z
en-US
sv-SE https://x/a https://x/z https://x/ä
en-US https://x/a https://x/ä https://x/z
````

## 7. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; for L in en_US da_DK C; do LANG=$L.UTF-8 LC_ALL=$L.UTF-8 node -e "console.log(new Intl.Collator().resolvedOptions().locale, ['https://x/about','https://x/About','https://x/aa','https://x/b', 'https://x/%C3%A4'].sort((x,y)=>x.localeCompare(y)).join(' '))"; done; grep -n "random-sample\|randomSet\b" $REPO/src/commands/summarize.mjs | head
````

Output (truncated):

````text
en-US https://x/%C3%A4 https://x/aa https://x/about https://x/About https://x/b
da-DK https://x/%C3%A4 https://x/About https://x/about https://x/b https://x/aa
en-US https://x/%C3%A4 https://x/aa https://x/about https://x/About https://x/b
415:  const randomSet = new Set(
416:    (await fs.readFile(path.join(paths.inventoryDir, 'random-sample.txt'), 'utf8').catch(() => ''))
435:    randomSet,
571:    (item) => isAuditableView(item) && randomSet.has(normalizeUrl(item.url)),
````

## 8. Bash

````bash
R=$REPO; cd $R; sed -n 380,510p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
    });
  }
  criteriaOutcomes.sort((a, b) => compareScs(a.sc, b.sc));

  // E1 DISCLOSE: excluding could-not-audit pages from the SC verdicts above
  // would otherwise let a criterion read `passed` purely because the page that
  // would have failed it was skipped. Record what the automated layer actually
  // covered so a clean result is never mistaken for complete coverage. A per-SC
  // denominator is deliberately NOT synthesized: an excluded page's axe never
  // ran, so which criteria it would have touched is unknown — the honest
  // statement is run-level ("N of M selected pages audited; the rest assessed
  // for no criterion").
  /** @type {Set<string>} */
  const auditedUrls = new Set();
  /** @type {Map<string, Set<string>>} */
  const excludedByOutcome = new Map();
  for (con ...
````

## 9. Bash

````bash
R=$REPO; cd $R; grep -rn "redirect-duplicate" src | head -20; grep -n "export function isAuditableView\|export function viewStatus\|export function viewIdentity" -A15 src/lib/*.mjs | head -60
````

Output (truncated):

````text
src/lib/scan-results.mjs:36: * @typedef {'auditable' | 'errored' | 'challenge' | 'empty' | 'redirect-duplicate'} ViewStatus
src/lib/scan-results.mjs:42: * a page-outcome tag, which wins over a redirect-duplicate marker.
src/lib/scan-results.mjs:64:  if (entry?.redirectedToAlreadyScanned === true) return 'redirect-duplicate';
src/commands/summarize.mjs:124:    // E4: a redirect-duplicate was already audited under its canonical (final)
src/commands/summarize.mjs:126:    if (status === 'redirect-duplicate') continue;
src/commands/summarize.mjs:268:    // E1: pages that could not be audited (challenge/empty/redirect-duplicate)
src/commands/scan.mjs:272:    // viewport, skip axe + screenshot and record a redirect-duplicate (excluded
src/lib/scan-results.mjs:51:export function viewStatus(entry)  ...
````

## 10. Bash

````bash
R=$REPO; cd $R; sed -n 262,300p src/commands/scan.mjs; echo ----; sed -n 110,140p src/commands/summarize.mjs; sed -n 262,285p src/commands/summarize.mjs; grep -rn "redirect-duplicate\|redirectedToAlreadyScanned" CHANGELOG.md docs/adr | head
````

Output (truncated):

````text
        incomplete: 0,
        inapplicable: 0,
        passesDetail: [],
        incompleteDetail: [],
        inapplicableDetail: [],
        _preScanStates: [],
      };
    }

    // E4: redirect dedupe. If this view's final URL was already scanned at this
    // viewport, skip axe + screenshot and record a redirect-duplicate (excluded
    // everywhere via isAuditableView). The set is updated AFTER a successful axe
    // below, so a thrown retry of the same url is not mistaken for a duplicate.
    if (seenFinalUrls && seenFinalUrls.has(finalUrl)) {
      return {
        title: await page.title().catch(() => ''),
        finalUrl,
        redirectedToAlreadyScanned: true,
        screenshot: null,
        violations: [],
        passes: 0,
        incomplete: 0,
        inapplicable: ...
````

## 11. Bash

````bash
R=$REPO; cd $R; grep -n "pageOutcome" src/commands/scan.mjs | head; sed -n 15,60p docs/adr/0019-redirect-aware-scanning.md; grep -rn "automatedCoverage\|pagesExcluded" test/unit/*.mjs | head
````

Output (truncated):

````text
234:    // challenge/empty page is recorded as a pageOutcome with empty violations —
251:      // Empty violations + a pageOutcome so every consumer (via isAuditableView)
257:        pageOutcome: outcome.outcome,
reported `region` `pageCount=147` double-counting `/contact-us` + its
`301 → /get-in-touch` target.

## Decision

1. **Capture `finalUrl` at the scan write-site.** `runForPage` records
   `finalUrl = normalizeUrl(page.url())` after `goto` (mirroring `discover.mjs`).
   A **per-viewport seen-set** of final URLs skips re-scanning: the second view
   of the same final URL is recorded `redirectedToAlreadyScanned: true` with
   empty violations (excluded everywhere via `isAuditableView`). The set is
   updated only **after a successful axe run**, so a thrown retry of the same URL
   is ...
````

## 12. Bash

````bash
R=$REPO; cd $R; grep -n "^export" src/lib/wcag-em-summary.mjs; sed -n 195,225p test/unit/page-outcome-contract.test.mjs; grep -n "Scan health" src/reporters/markdown.mjs | head
````

Output (truncated):

````text
54:export const SC_LEVEL_MAP = /** @type {const} */ ({
188:export function toWcagEmSummary(ctx, rawResults) {
  // The real page's image-alt fails 1.1.1...
  assert.equal(byScOutcome.get('1.1.1'), 'failed', '1.1.1 fails from the real page');
  // ...but the challenge page's fake color-contrast must NOT fail 1.4.3.
  assert.notEqual(
    byScOutcome.get('1.4.3'),
    'failed',
    '1.4.3 must not be failed by a skipped challenge page',
  );
});

test('§5 DISCLOSE: automatedCoverage flags PARTIAL when a page is excluded (no false "complete")', () => {
  const wcag = toWcagEmSummary(
    { config: { wcagEm: { conformanceTarget: 'AA' } } },
    { axeResults, processResults: [], sampleMetadata: { finalSampleCount: 2 } },
  );
  const cov = wcag.automatedCoverage;
  assert.equal(cov.status, 'par ...
````

## 13. Bash

````bash
R=$REPO; cd $R; sed -n 54,100p src/reporters/markdown.mjs; sed -n 170,190p src/reporters/markdown.mjs
````

Output (truncated):

````text
// SECTION: Scan health

/**
 * Render the scan-health section lines, or nothing when the run was clean.
 * Failed pages contributed NOTHING to any verdict — without this section a
 * reader of the Step 5 summary cannot tell attempted coverage from achieved
 * coverage (2026-06 review C1).
 *
 * @param {Record<string, any> | undefined} health - `summary.executionHealth`.
 * @returns {string[]} Markdown lines (empty array when there is nothing to report).
 */
function renderScanHealth(health) {
  if (!health || typeof health !== 'object') return [];
  const failed = Array.isArray(health.pagesFailed) ? health.pagesFailed : [];
  const degraded = Array.isArray(health.pagesDegraded) ? health.pagesDegraded : [];
  const processFailures = Array.isArray(health.processFailures) ? health.processFai ...
````

## 14. Bash

````bash
S=$SCRATCH/wf2/verify-A13; cat > $S/cov.mjs <<'EOF'
import { toWcagEmSummary } from 'file://$REPO/src/lib/wcag-em-summary.mjs';
const base = (u, vp, extra={}) => ({ url:u, viewport:vp, finalUrl:u, violations:[], passes:0, incomplete:0, inapplicable:0, passesDetail:[], incompleteDetail:[], inapplicableDetail:[], ...extra });
const A='http://h/a', B='http://h/b', C='http://h/contact';
// redirect dup: C -> B
const r1=[base(A,'d'),base(A,'r'),base(B,'d'),base(B,'r'),{...base(C,'d'),finalUrl:B,redirectedToAlreadyScanned:true},{...base(C,'r'),finalUrl:B,redirectedToAlreadyScanned:true}];
console.log(JSON.stringify(toWcagEmSummary({config:{wcagEm:{}}},{axeResults:r1,processResults:[],sampleMetadata:{finalSampleCount:3}}).automatedCoverage));
const r2=[base(A,'d'),base(A,'r'),base(B,'d'),{url:B,viewport:'r',error:'boom'}];
console.log(JSON.stringify(toWcagEmSummary({config:{wcagEm:{}}},{axeResults:r2,processResults:[],sampleMetadata:{finalSampleCount:2}}).automatedCoverage));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node $S/cov.mjs
````

Output (truncated):

````text
{"status":"partial","adequate":false,"pagesSelected":3,"pagesAudited":2,"pagesExcluded":1,"scopeExclusions":[{"outcome":"redirect-duplicate","count":1,"examples":["http://h/contact"]}]}
{"status":"partial","adequate":false,"pagesSelected":2,"pagesAudited":2,"pagesExcluded":1,"scopeExclusions":[{"outcome":"errored","count":1,"examples":["http://h/b"]}]}
````

## 15. Bash

````bash
R=$REPO; cd $R; sed -n 555,595p src/commands/summarize.mjs; sed -n 1,20p src/lib/group-findings.mjs; sed -n 100,130p src/lib/group-findings.mjs; grep -rn "randomSampleIntroduced" test | head
````

Output (truncated):

````text
      const impactOrder = { critical: 4, serious: 3, moderate: 2, minor: 1, null: 0 };
      return (impactOrder[b.impact ?? 'null'] ?? 0) - (impactOrder[a.impact ?? 'null'] ?? 0);
    });

  const groupedComponents = [...groupedByComponent.values()]
    .map((item) => ({
      ...item,
      pages: [...item.pages].sort(),
      pageCount: item.pages.size,
      targets: [...item.targets].sort(),
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key));

  /** @type {Set<string>} */
  const ruleIdsSeenInRandom = new Set();
  for (const pageResult of axeResults.filter(
    (item) => isAuditableView(item) && randomSet.has(normalizeUrl(item.url)),
  )) {
    for (const violation of pageResult.violations || []) ruleIdsSeenInRandom.add(violation.id);
  }
  const  ...
````

## 16. Bash

````bash
R=$REPO; cd $R; grep -rln "randomClusters\|structuredRuleIds\|expandStructuredSampleRecommended" test; grep -n "Step 3\|3c\|4c\|4\.c\|step4" docs/adr/0018*.md docs/adr/0019*.md src/commands/scan-processes.mjs | head; grep -rn "Step 3\.\|Step 3[abcd]\|step3[a-d]\|Step 4" --include=*.md --include=*.mjs --include=*.json . 2>/dev/null | grep -v node_modules | grep -v "^./test" | head -30
````

Output (truncated):

````text
test/unit/group-findings.test.mjs
test/unit/reporters-markdown.test.mjs
test/unit/reporters-html.test.mjs
test/e2e/reporters-html-axe.test.mjs
docs/adr/0018-fair-deterministic-sitemap-seeding.md:42:**Determinism (WCAG-EM Step 3c).** Seeds must be reproducible for a fixed
docs/adr/0018-fair-deterministic-sitemap-seeding.md:58:  (which sitemaps get into the crawl). The WCAG-EM Step 3c _random sample_ still
docs/adr/0019-redirect-aware-scanning.md:37:   structured page would silently vanish from the WCAG-EM Step 3c random-vs-
(eval):1: no matches found: --include=*.md
````

## 17. Bash

````bash
R=$REPO; cd $R; grep -n "randomClusters\|structuredRuleIds" test/unit/group-findings.test.mjs | head; git grep -n -E "Step ?3\.?[a-d]|step3[a-d]|Step ?4\.?[a-c]" -- ':!test' | head -30
````

Output (truncated):

````text
84:  const { structuredRuleIds, structuredClusters, randomClusters } = groupFindings(
89:  assert.equal(structuredRuleIds.has('color-contrast'), true);
90:  assert.equal(structuredRuleIds.has('image-alt'), false);
92:  assert.equal(randomClusters.has('listing::b'), true);
181:  const { groupedByRule, structuredRuleIds } = groupFindings(axe, [], d);
190:  assert.equal(structuredRuleIds.has('label'), true);
configs/example-site-best-practice.json:72:    "samplingMethodNotes": "Structured sample (WCAG-EM Step 3a) curated by the auditor for this run — set sample.structuredManual in your per-site config to pin critical user-journey URLs (homepage, contact, key flows, policy pages). Supplemented by toolkit auto-suggest (top page-type per cluster) and a 10% random pool.",
configs/legacy-events.js ...
````

## 18. Bash

````bash
grep -rIl -i "Randomly Selected Sample\|Compare Structured and Random" $REPO/docs $PORTAL $RB $VAULT 2>/dev/null | grep -v node_modules | head
````

Output (truncated):

````text
$RB/docs/MyWebAccess-docs/Methodology/04-audit.md
````

## 19. Bash

````bash
R=$REPO; cd $R; grep -n "At\b\|At:\|timestamp\|toISOString" src/commands/scan.mjs src/commands/scan-processes.mjs | head; sed -n 395,410p src/reporters/report-builder-starter.mjs; sed -n 478,520p src/reporters/report-builder-starter.mjs; grep -n "assistiveTechnologies\|browsers\|devices" src/reporters/report-builder-starter.mjs | head
````

Output (truncated):

````text
    }));
  const untestedScs = allOutcomes.filter(
    (/** @type {any} */ c) => c?.outcome === 'notTested' || c?.outcome === 'untested',
  );

  const backlogItems = buildManualBacklogItems({
    findings: violations,
    inventory: [],
    processes: Array.isArray(config.processes) ? config.processes : [],
  });

  const recommendationTiers = ['Tier 1', 'Tier 2', 'Tier 3', 'Advisory'];
  const TIER_TIMEFRAMES = /** @type {Record<string, string>} */ ({
    'Tier 1': 'Immediate (blockers and high-impact barriers)',
    'Tier 2': 'Next development cycle',
    'Tier 3': 'Scheduled maintenance',
        { label: 'Automated findings', value: String(violationFindings.length) },
        { label: 'Needs-review findings', value: String(incompleteFindings.length) },
        { label: 'Pages scanned' ...
````

## 20. Bash

````bash
grep -rn "assistiveTechnologies\|\"browsers\"\|\"devices\"" $RB --include=*.json --include=*.ts --include=*.mjs 2>/dev/null | grep -v node_modules | head -8; grep -rn "Not specified" $RB/src 2>/dev/null | head -5; R=$REPO; grep -n "rootUrl\|siteName\|site:" $R/src/lib/wcag-em-summary.mjs | head; grep -n "Step 5\|5\.b\|evaluationDate\|envelope" $R/TODO.md | head
````

Output (truncated):

````text
(eval):1: no matches found: --include=*.json
$RB/src/components/ui/DataTable.jsx:50:                      {row[column.key] ?? "Not specified"}
$RB/src/components/sections/ScopeMethodologySection.jsx:15:    value: values?.length > 0 ? values.join(", ") : "Not specified",
$RB/src/components/sections/MetricGrid.jsx:22:            <span>{metric.value ?? "Not specified"}</span>
$RB/src/components/sections/FindingsRegister.jsx:27:    wcag: finding.wcag?.map((item) => item.criterion).join(", ") || "Not specified",
$RB/src/components/findings/EvidenceBlock.jsx:60:  return source?.[key] ?? "Not specified";
204:- [ ] Artifact envelope (Sprint 2): runId + timestamps + engine versions +
213:      summarize (-> combined Step 5 record, `earl:manual` assertions, portal
````

## 21. Bash

````bash
cd $RB; grep -rn "assistiveTechnologies\|browsers\|devices" src schema* 2>/dev/null | grep -v node_modules | head -8; sed -n 1,30p src/components/sections/ScopeMethodologySection.jsx; R=$REPO; sed -n 200,216p $R/TODO.md
````

Output (truncated):

````text
(eval):1: no matches found: schema*
/**
 * Renders scope, sampling, tools, methodology, and conformance caveats.
 */
import React from "react";
import { ReportSection } from "../layout/ReportSection";
import { Callout } from "../ui/Callout";
import { DataTable } from "../ui/DataTable";
import { MarkdownProse } from "../ui/MarkdownProse";
import { ReportKey } from "./ReportKey";

function listRows(label, values) {
  return {
    id: label,
    label,
    value: values?.length > 0 ? values.join(", ") : "Not specified",
  };
}

function outcomeRows(criteriaOutcomes) {
  return (criteriaOutcomes ?? []).map((outcome) => ({
    id: outcome.criterion,
    criterion: `${outcome.criterion} (${outcome.level})`,
    outcome: outcome.outcome,
    notes: outcome.notes ?? "",
  }));
}

/**
 * Displays s ...
````

## 22. Bash

````bash
R=$REPO; cd $R; sed -n 290,330p src/lib/wcag-em-summary.mjs; grep -n "T-C\|finalUrl\|source URL\|label" TODO.md | head
````

Output (truncated):

````text
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
    // violation/pass arrays would otherwise mark criteria as assessed (or, with
    // residual fake violations, flip a real criterion to failed). Excluded here;
    // the coverage gap is disclosed by the conformance-claim layer.
    if (!isAuditableView(page)) continue;
    ingestPage(
      String(page?.url ?? ''),
      page?.violations ?? [],
      page?.passesD ...
````

## 23. Bash

````bash
R=$REPO; cd $R; sed -n 1,140p src/lib/manual-backlog.mjs; sed -n 20,45p test/unit/manual-backlog.test.mjs; node -e "const a=require('$R/node_modules/axe-core');const r=a.getRules();console.log(r.filter(x=>x.tags.includes('wcag1411')).map(x=>x.ruleId), r.find(x=>x.ruleId==='color-contrast').tags)"
````

Output (truncated):

````text
// @ts-check
/**
 * @file Findings-aware manual accessibility backlog generator.
 * @module lib/manual-backlog
 *
 * @description
 * Generates a findings-aware markdown backlog for `output/reports/manual-backlog.md`.
 * A pure function that adapts items to what was actually found:
 *
 *   - Drops inapplicable reminders (e.g. color-contrast line when no such
 *     violations were found — the automated pass covered it).
 *   - Adds landmark-review items when `region` violations are present.
 *   - Adds a process-walkthrough item per configured process.
 *   - Header + framing paragraphs stay constant so existing reviewers
 *     recognise the output.
 *
 * Deterministic: two calls with the same inputs produce byte-identical
 * output. No timestamps, no Set-iteration (all ordering derived fr ...
````

## 24. Bash

````bash
R=$REPO; cd $R; sed -n 660,700p src/commands/summarize.mjs; grep -n "manualReview\|documentInventory\|screenshots" src/reporters/report-builder-starter.mjs | head; grep -n "hasForms\|formCount" src/commands/discover.mjs | head -3
````

Output (truncated):

````text
    /** @type {Record<string, any>} */ ({}),
    logger,
  );
  await writeText(
    path.join(paths.reportsDir, 'manual-backlog.md'),
    toolIdentityMarkdownHeader() +
      buildManualBacklog({
        findings: groupedFindings,
        inventory,
        processes: config.processes ?? [],
        // E7: multi-viewport screenshots → "screenshots to eyeball" (responsive
        // overlap candidates); keyed by the redirect-folded identity.
        screenshots: axeResults
          .filter((r) => isAuditableView(r) && typeof r.screenshot === 'string')
          .map((r) => ({ url: viewIdentity(r), viewport: r.viewport, screenshot: r.screenshot })),
        // E7: the could-not-auto-audit hand-off — challenge/blocked pages (after
        // §0a) + the PDF document inventory.
        manual ...
````

## 25. Bash

````bash
R=$REPO; cd $R; grep -n "pagesUnauditable\|challenge\|exclusions\|automatedCoverage\|document" src/reporters/report-builder-starter.mjs | head
````

Output (truncated):

````text
187:    // challenge/empty page-views, so a could-not-audit URL never enters pagesTested.
````

## 26. Bash

````bash
R=$REPO; cd $R; grep -rn "sample.json\|sample-metadata\|randomCount\|structuredCount\|finalSampleCount" test/e2e test/unit | grep -v "sampleMetadata: {" | head -15; grep -n "mutant\|SAMP-10" $SCRATCH/review/round1-experiments.json | head -5
````

Output (truncated):

````text
test/e2e/reporters-html-axe.test.mjs:62:    finalSampleCount: impacts.length,
test/unit/portal-export-schema.test.mjs:111:      finalSampleCount: 1,
test/unit/sample-missing.test.mjs:104:      sampleJsonPath: path.join(tmpdir, 'sample.json'),
test/unit/page-outcome-contract.test.mjs:106:    finalSampleCount: 2,
test/unit/context-paths.test.mjs:7: * Locks the sample.json handoff location under the run's out-dir. Before the
test/unit/context-paths.test.mjs:11: * repo-root sample.json of an unrelated audit).
test/unit/context-paths.test.mjs:43:  assert.strictEqual(ctx.paths.sampleJsonPath, path.join(outDir, 'sample.json'));
test/unit/context-paths.test.mjs:46:      path.resolve('sample.json').slice(0, -'sample.json'.length),
test/unit/context-paths.test.mjs:48:    'sample.json must not resolv ...
````
