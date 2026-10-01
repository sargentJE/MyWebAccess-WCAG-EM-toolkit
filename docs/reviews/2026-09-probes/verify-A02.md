# Probe record: verify:A02

Role: packet verifier. Findings: CAP-02, VERD-03, VERD-04, VERD-05, REPA-05, REPB-19

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" CAP-02,VERD-03,VERD-04,VERD-05,REPA-05,REPB-19
````

Output (truncated):

````text
[
 {
  "dimension": "VERD",
  "id": "VERD-03",
  "title": "wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria)",
  "category": "correctness",
  "severity": "high",
  "status": "new",
  "claim": "The notTested padding iterates the single flat SC_LEVEL_MAP, which holds the WCAG 2.2 set plus 4.1.1, and never consults wcagVersion. The default axe withTags always includes wcag21a/wcag21aa/wcag22aa and are not derived from wcagVersion or conformanceTarget. So a wcagVersion '2.0' AA run emits 18 SCs that do not exist in WCAG 2.0, some with automated verdicts (2.5.8 passed, 1.4.12 passed, 1.3.5 inapplicable). A '2.1' run (the EN 301 549 baseline) emits the 6 WCAG 2.2-only SCs, including 2.5.8, which would come out 'failed ...
````

## 2. Bash

````bash
W=$REPO; cd $W; grep -n "SC_LEVEL_MAP\|wcagVersion\|targetLevels\|conformanceTarget\|obsolete\|4.1.1" src/lib/wcag-em-summary.mjs | head -60; echo ---; sed -n 320,460p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
48:// ANCHOR: SC_LEVEL_MAP — minimal WCAG 2.2 level table used for the `level`
54:export const SC_LEVEL_MAP = /** @type {const} */ ({
143:  '4.1.1': 'A',
180: *   wcagVersion: string,
181: *   conformanceTarget: string,
355:        Object.prototype.hasOwnProperty.call(SC_LEVEL_MAP, sc)
356:          ? SC_LEVEL_MAP[/** @type {keyof typeof SC_LEVEL_MAP} */ (sc)]
366:  const conformanceTarget = wcagEmConfig.conformanceTarget ?? 'AA';
369:  const targetLevels = new Set(LEVEL_INCLUDES[conformanceTarget] ?? LEVEL_INCLUDES['AA']);
371:  for (const [sc, level] of Object.entries(SC_LEVEL_MAP)) {
372:    if (coveredScs.has(sc) || !targetLevels.has(level)) continue;
441:    wcagVersion: wcagEmConfig.wcagVersion ?? '2.2',
442:    conformanceTarget: wcagEmConfig.conformanceTarget ?? 'AA',
---
    if (! ...
````

## 3. Bash

````bash
W=$REPO; cd $W; grep -rn "wcagVersion" src schemas docs README.md CHANGELOG.md TODO.md --include=*.mjs --include=*.json --include=*.md | grep -v node_modules | head -60
````

Output (truncated):

````text
(eval):1: no matches found: --include=*.mjs
````

## 4. Bash

````bash
W=$REPO; cd $W; grep -rn "wcagVersion" src schemas docs README.md CHANGELOG.md TODO.md | head -60; echo ---; sed -n 40,60p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
src/types/config.d.ts:259:    wcagVersion?: "2.0" | "2.1" | "2.2";
src/lib/wcag-em-summary.mjs:180: *   wcagVersion: string,
src/lib/wcag-em-summary.mjs:441:    wcagVersion: wcagEmConfig.wcagVersion ?? '2.2',
src/lib/config.mjs:157:    wcagVersion: '2.2',
src/reporters/earl-jsonld.mjs:150:    'wcag-em:wcagVersion': wcagEm.wcagVersion ?? '2.2',
src/reporters/report-builder-starter.mjs:463:      standard: `WCAG ${wcagEm.wcagVersion ?? '2.2'} Level ${wcagEm.conformanceTarget ?? 'AA'}`,
src/reporters/report-builder-starter.mjs:492:      standard: `WCAG ${wcagEm.wcagVersion ?? '2.2'} Level ${wcagEm.conformanceTarget ?? 'AA'}`,
docs/adr/0007-wcag-em-summary-shape.md:123:  "wcagVersion": "2.2",
schemas/config.schema.json:662:        "wcagVersion": {
docs/adr/0009-earl-jsonld-output.md:72:  "wcag- ...
````

## 5. Bash

````bash
W=$REPO; cd $W; grep -rn -i "at or below\|above the target\|above target\|beyond.target\|out-of-target\|conformance target\|AAA" docs/adr/0007-wcag-em-summary-shape.md README.md docs/guides/user-manual.md docs/guides/config-guide.md CHANGELOG.md TODO.md | head -40; echo ---; grep -rn -i "4\.1\.1\|parsing\|obsolete" docs README.md CHANGELOG.md TODO.md src --include=* 2>/dev/null | grep -v "^src/data/wcag-sc-names.json:9[0-9]" | head -30
````

Output (truncated):

````text
README.md:110:  success criterion at or below your conformance target. Criteria not
docs/guides/user-manual.md:72:   per WCAG success criterion at or below your target
docs/adr/0007-wcag-em-summary-shape.md:84:no applicable rules for SC 1.4.6 (AAA Contrast Enhanced) produces zero
docs/adr/0007-wcag-em-summary-shape.md:95:`notTested` for every SC at or below the configured conformance target
docs/adr/0007-wcag-em-summary-shape.md:96:(`A`, `AA`, or `AAA`) that no axe rule touched in the run. The ~80-row
docs/guides/config-guide.md:197:| `conformanceTarget`      | `"AA"`                                   | `"A"` \| `"AA"` \| `"AAA"` — controls which untested criteria appear as `notTested`.                                                                            |
docs/guides/config-guide.md ...
````

## 6. Bash

````bash
W=$REPO; cd $W; sed -n 75,110p docs/adr/0007-wcag-em-summary-shape.md; echo ---; sed -n 105,114p README.md; echo ---; sed -n 66,78p docs/guides/user-manual.md; echo ---; sed -n 268,278p CHANGELOG.md; echo ---; grep -rn -i "4\.1\.1\|obsolete" docs README.md CHANGELOG.md TODO.md src 2>/dev/null | head -30
````

Output (truncated):

````text
This is implemented by tracking a separate
`anyNonBestPracticePass` flag per SC bucket.

### 4. SC scope — only emit SCs the run touched

The output does **not** enumerate every SC in WCAG 2.2. An SC appears
in `criteriaOutcomes` only if at least one axe rule in this run was
tagged with it (pass, fail, incomplete, or inapplicable). A scan with
no applicable rules for SC 1.4.6 (AAA Contrast Enhanced) produces zero
output for 1.4.6, not an `untested` entry.

**Rationale:** an exhaustive enumeration would emit ~80 `untested`
verdicts per run for SCs outside the configured tag profile, which
readers would have to filter out. The WCAG-EM report template does
not demand exhaustiveness; it asks for "outcomes observed during
evaluation".

**Update (v1.1.0):** the dogfood audit proved auditors need ...
````

## 7. Bash

````bash
W=$REPO; cd $W; sed -n 150,320p src/lib/wcag-em-summary.mjs | grep -n "" | sed -n 1,200p | grep -v "^\s*[0-9]*:\s*//" | head -150
````

Output (truncated):

````text
1:/**
2: * @typedef {object} CriterionOutcome
3: * @property {string} sc - Success Criterion number, e.g. "1.4.3".
4: * @property {string | null} level - Conformance level "A" / "AA" / "AAA" / null (if unknown).
5: * @property {'passed' | 'failed' | 'cantTell' | 'inapplicable' | 'untested' | 'notTested'} outcome - EARL outcome verdict.
6: * @property {Array<{ pageUrl: string, ruleId: string, impact: string | null }>} examples - Up to 5 example offenders.
7: * @property {number} pagesExamined - Number of unique page URLs that contributed to this verdict.
8: * @property {string[]} relatedRules - Unique axe rule IDs that reference this SC in the run.
9: */
10:
11:/**
12: * Produce the WCAG-EM Step 5 per-SC summary.
13: *
14: * Note on naming: the second parameter is a *bundle of raw results*, ...
````

## 8. Bash

````bash
W=$REPO; cd $W; grep -n "export function isAuditableView\|export function viewStatus" -A 18 src/lib/scan-results.mjs | head -50; sed -n 110,135p src/lib/config.mjs; sed -n 150,165p src/lib/config.mjs
````

Output (truncated):

````text
51:export function viewStatus(entry) {
52-  // A thrown navigation/scan failure is recorded as a string `error` on the
53-  // result (scan.mjs failure-path push); that is an execution fault, distinct
54-  // from a could-not-audit page.
55-  if (typeof entry?.error === 'string') return 'errored';
56-
57-  const outcome = entry?.pageOutcome ?? 'ok';
58-  if (outcome === 'challenge') return 'challenge';
59-  if (outcome === 'empty') return 'empty';
60-  if (outcome === 'error') return 'errored';
61-
62-  // A page-view that resolved to an already-scanned final URL (redirect
63-  // dedupe): real, but its findings belong to the canonical view, not here.
64-  if (entry?.redirectedToAlreadyScanned === true) return 'redirect-duplicate';
65-
66-  return 'auditable';
67-}
68-
69-/**
--
76:export  ...
````

## 9. Bash

````bash
W=$REPO; cd $W; grep -rn "withTags\|conformanceTarget\|wcag2aaa" src --include=*.mjs | grep -v "^src/lib/config.mjs:124" | head -30; grep -n '"version"' node_modules/axe-core/package.json
````

Output (truncated):

````text
(eval):1: no matches found: --include=*.mjs
4:  "version": "4.11.3",
108:    "version": "echo \"use 'npm run release' to bump axe-core version\" && exit 1",
````

## 10. Bash

````bash
W=$REPO; cd $W; grep -rn "withTags\|conformanceTarget\|wcag2aaa" src | grep -v "^src/lib/config.mjs:124" | head -30
````

Output (truncated):

````text
src/types/config.d.ts:168:      withTags?: string[];
src/types/config.d.ts:184:        withTags?: string[];
src/types/config.d.ts:260:    conformanceTarget?: "A" | "AA" | "AAA";
src/lib/wcag-em-summary.mjs:181: *   conformanceTarget: string,
src/lib/wcag-em-summary.mjs:366:  const conformanceTarget = wcagEmConfig.conformanceTarget ?? 'AA';
src/lib/wcag-em-summary.mjs:369:  const targetLevels = new Set(LEVEL_INCLUDES[conformanceTarget] ?? LEVEL_INCLUDES['AA']);
src/lib/wcag-em-summary.mjs:442:    conformanceTarget: wcagEmConfig.conformanceTarget ?? 'AA',
src/lib/axe-utils.mjs:30:  'withTags',
src/lib/config.mjs:158:    conformanceTarget: 'AA',
src/commands/scan.mjs:358:    if (Array.isArray(axeConfig.withTags) && axeConfig.withTags.length > 0)
src/commands/scan.mjs:359:      builder = build ...
````

## 11. Bash

````bash
W=$REPO; cd $W; grep -rn "wcag2aaa\|withTags" docs README.md configs 2>/dev/null | head -20; sed -n 190,200p docs/guides/config-guide.md
````

Output (truncated):

````text
docs/guides/config-guide.md:153:| `withTags`  | `["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]` | The conformance rule profile. Add `"best-practice"` for client audits (landmarks, heading order).                                                                                                                                   |
docs/guides/config-guide.md:155:| `overrides` | none                                                   | Per-URL rule changes: array of `{ urlPattern, include?, exclude?, withRules?, withTags?, runOnly? }`. First matching `urlPattern` wins; an override REPLACES the base value for each key it defines (set `runOnly: null` to clear). |
README.md:75:| `scan.axe.withTags`           | axe-core tag filter (e.g. `["wcag2aa", "best-practice"]`)                           ...
````

## 12. Bash

````bash
S=$SCRATCH/wf2/verify-A02; mkdir -p $S; W=$REPO; cat > $S/tags.cjs <<EOF
const axe = require('$W/node_modules/axe-core');
const def = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
const ids = ['scrollable-region-focusable','target-size','color-contrast','color-contrast-enhanced','identical-links-same-purpose','meta-refresh-no-exceptions','autocomplete-valid','avoid-inline-spacing','meta-viewport','meta-viewport-large','css-orientation-lock','duplicate-id','duplicate-id-aria','duplicate-id-active'];
const rules = axe.getRules();
for (const id of ids) { const r = rules.find(x=>x.ruleId===id); console.log(id, r ? JSON.stringify(r.tags) + ' defaultSelected=' + r.tags.some(t=>def.includes(t)) : 'ABSENT'); }
// all rules selected by default whose tags include an AAA SC or post-2.0 SC
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node $S/tags.cjs
````

Output (truncated):

````text
scrollable-region-focusable ["cat.keyboard","wcag2a","wcag211","wcag213","TTv5","TT4.a","EN-301-549","EN-9.2.1.1","EN-9.2.1.3","RGAAv4","RGAA-7.3.2"] defaultSelected=true
target-size ["cat.sensory-and-visual-cues","wcag22aa","wcag258"] defaultSelected=true
color-contrast ["cat.color","wcag2aa","wcag143","TTv5","TT13.c","EN-301-549","EN-9.1.4.3","ACT","RGAAv4","RGAA-3.2.1"] defaultSelected=true
color-contrast-enhanced ["cat.color","wcag2aaa","wcag146","ACT"] defaultSelected=false
identical-links-same-purpose ["cat.semantics","wcag2aaa","wcag249"] defaultSelected=false
meta-refresh-no-exceptions ["cat.time-and-media","wcag2aaa","wcag224","wcag325"] defaultSelected=false
autocomplete-valid ["cat.forms","wcag21aa","wcag135","EN-301-549","EN-9.1.3.5","ACT","RGAAv4","RGAA-11.13.1"] defaultSelect ...
````

## 13. Bash

````bash
W=$REPO; cd $W; grep -n "export function withActAndWcagMetadata" -A 25 src/lib/axe-utils.mjs; grep -n "function.*[Ww]cag.*[Tt]ag\|wcag\\\\d\|/\^wcag" src/lib/axe-utils.mjs | head
````

Output (truncated):

````text
142:export function withActAndWcagMetadata(rule, options = {}) {
143-  const { actMap = {}, reportingConfig = {} } = options;
144-  const base = classifyRule(rule, reportingConfig);
145-
146-  /** @type {string[]} */
147-  const actRuleIds = rule.id && Array.isArray(actMap[rule.id]) ? [...actMap[rule.id]] : [];
148-
149-  const tags = Array.isArray(rule.tags) ? rule.tags : [];
150-  /** @type {Set<string>} */
151-  const scSet = new Set();
152-  for (const tag of tags) {
153-    if (typeof tag !== 'string') continue;
154-    const match = WCAG_SC_TAG_REGEX.exec(tag);
155-    if (!match) continue;
156-    scSet.add(`${match[1]}.${match[2]}.${match[3]}`);
157-  }
158-  const wcagCriteria = [...scSet].sort();
159-
160-  return { ...base, actRuleIds, wcagCriteria };
161-}
162-
163-// ANCHOR: a ...
````

## 14. Bash

````bash
W=$REPO; cd $W; grep -rn "scoreBasis\|averageScore" src | head -12; echo ---; grep -n "criteriaOutcomes\|notTested\|level" src/reporters/report-builder-starter.mjs | head -30
````

Output (truncated):

````text
---
11: * `notTested` outcome both fail its Zod contract).
27: * - criteriaOutcomes filtered to the consumer's four-value enum;
28: *   notTested/untested coverage and scanWarnings ride in `appendices`.
65:/** Outcomes the consumer's criteriaOutcomes enum accepts. */
143: * Map SC ids to the consumer's `{ criterion, name, level }` references. An
149: * @returns {Array<{ criterion: string, name: string, level: string }>}
154:    return [{ criterion: 'Best practice', name: 'Manual review required', level: 'Best practice' }];
159:    level: /** @type {Record<string, string>} */ (SC_LEVEL_MAP)[sc] ?? 'A',
381:  // criteriaOutcomes: consumer enum only; coverage gaps ride the appendices.
382:  const allOutcomes = Array.isArray(wcagEm.criteriaOutcomes) ? wcagEm.criteriaOutcomes : [];
383:  const  ...
````

## 15. Bash

````bash
W=$REPO; cd $W; ls src/reporters; grep -rln "score" src/reporters src/lib | head; echo; sed -n 375,420p src/reporters/report-builder-starter.mjs
````

Output (truncated):

````text
_sort.mjs
_template.mjs
earl-jsonld.mjs
html.mjs
index.mjs
json.mjs
junit.mjs
markdown.mjs
portal-export.mjs
report-builder-starter.mjs

  };

  const violationFindings = violations.map((f) => toDraftFinding(f, { needsReview: false }));
  const incompleteFindings = incompletes.map((f) => toDraftFinding(f, { needsReview: true }));
  const findings = [...violationFindings, ...incompleteFindings];

  // criteriaOutcomes: consumer enum only; coverage gaps ride the appendices.
  const allOutcomes = Array.isArray(wcagEm.criteriaOutcomes) ? wcagEm.criteriaOutcomes : [];
  const criteriaOutcomes = allOutcomes
    .filter((/** @type {any} */ c) => CONSUMER_OUTCOMES.includes(c?.outcome))
    .map((/** @type {any} */ c) => ({
      criterion: String(c.sc ?? ''),
      level: typeof c.level === 'strin ...
````

## 16. Bash

````bash
W=$REPO; cd $W; grep -n "score\|criteriaOutcomes\|notTested\|level" src/reporters/portal-export.mjs | head -40
````

Output (truncated):

````text
(Bash completed with no output)
````

## 17. Bash

````bash
W=$REPO; cd $W; wc -l src/reporters/portal-export.mjs; grep -rn "scoreBasis\|averageScore" src schemas docs test 2>/dev/null | head -10; grep -rn "scoreBasis\|averageScore" $PORTAL --include=*.ts -l 2>/dev/null | grep -v node_modules | head -5
````

Output (truncated):

````text
     571 src/reporters/portal-export.mjs
schemas/portal-canonical-scan.schema.json:67:        "averageScore": {
schemas/portal-canonical-scan.schema.json:79:        "scoreBasis": {
schemas/portal-canonical-scan.schema.json:81:          "description": "Adjudication context for averageScore: how many WCAG criteria landed in each outcome. untested folds into notTested.",
docs/reviews/2026-06-toolkit-review.md:109:| `averageScore: 50` exported while **36 of the 56** Level A/AA SCs are notTested — nothing in the payload conveys the adjudication basis                                              | `[live]` portal-export.mjs:368,392-398                                                            |
docs/reviews/2026-06-toolkit-review.md:269:| T5  | `feat(portal-export): scoreBasis + evidence enrich ...
````

## 18. Bash

````bash
W=$REPO; cd $W; grep -n "Score\|Basis\|passed\|failed" src/reporters/portal-export.mjs | head -30
````

Output (truncated):

````text
(Bash completed with no output)
````

## 19. Bash

````bash
W=$REPO; cd $W; file src/reporters/portal-export.mjs; grep -c "" src/reporters/portal-export.mjs; grep -an "averageScore" src/reporters/portal-export.mjs | head; grep -rln "averageScore" src
````

Output (truncated):

````text
src/reporters/portal-export.mjs: data
111: * Count adjudication outcomes so `averageScore` ships with its basis. The
112: * 2026-06 review's live run exported `averageScore: 50` while 36 of 50
490:  const averageScore = computeAverageScore(criteriaOutcomes);
538:      ...(averageScore !== null ? { averageScore } : {}),
````

## 20. Bash

````bash
W=$REPO; cd $W; grep -an "function computeAverageScore\|function computeScoreBasis\|scoreBasis" src/reporters/portal-export.mjs | head; grep -an "function computeAverageScore" -A 25 src/reporters/portal-export.mjs | head -40; grep -anP "\x00" src/reporters/portal-export.mjs | head -3 | cut -c1-80
````

Output (truncated):

````text
121:function computeScoreBasis(outcomes) {
169:function computeAverageScore(outcomes) {
491:  // scoreBasis ships whenever per-SC outcomes exist so the dashboard score
493:  const scoreBasis =
539:      ...(scoreBasis ? { scoreBasis } : {}),
169:function computeAverageScore(outcomes) {
170-  if (!Array.isArray(outcomes)) return null;
171-  let passed = 0;
172-  let failed = 0;
173-  for (const o of outcomes) {
174-    if (o?.outcome === 'passed') passed += 1;
175-    else if (o?.outcome === 'failed') failed += 1;
176-  }
177-  const denom = passed + failed;
178-  return denom === 0 ? null : Math.round((passed / denom) * 100);
179-}
180-
181-/**
182- * Per-PAGE instance rows from summary data — the FALLBACK used when the scan
183- * results are unavailable (e.g. a pre-existing summary with  ...
````

## 21. Bash

````bash
W=$REPO; cd $W; sed -n 480,496p src/reporters/portal-export.mjs; sed -n 495,560p src/reporters/report-builder-starter.mjs
````

Output (truncated):

````text
  const compliance = findings.filter((f) => !isBestPractice(f));

  // distribution + totalIssues: compliance-affecting only; null-impact omitted.
  const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of compliance) {
    const entry = PRIORITY_MAP[f.impact];
    if (entry) distribution[entry.bucket] += 1;
  }
  const totalIssues = compliance.length;
  const criteriaOutcomes = summary.wcagEmSummary?.criteriaOutcomes;
  const averageScore = computeAverageScore(criteriaOutcomes);
  // scoreBasis ships whenever per-SC outcomes exist so the dashboard score
  // carries its adjudication context (how many SCs were actually decided).
  const scoreBasis =
    Array.isArray(criteriaOutcomes) && criteriaOutcomes.length
      ? computeScoreBasis(criteriaOutcomes)
      :  ...
````

## 22. Bash

````bash
W=$REPO; cd $W; sed -n 140,160p src/lib/manual-backlog.mjs; grep -rn "manualChecks" $RB/src 2>/dev/null | grep -v test | head -8
````

Output (truncated):

````text
  // Per-process walkthrough items.
  if (Array.isArray(processes) && processes.length > 0) {
    for (const p of processes) {
      const name = typeof p?.name === 'string' ? p.name : '(unnamed)';
      items.push({
        section: 'Process walkthroughs',
        label: `Complete walkthrough of process: **${name}**`,
      });
    }
  }

  // E7: screenshots to eyeball — pages captured at MORE THAN ONE viewport are
  // responsive-overlap / clipping candidates (compare desktop vs reflow).
  /** @type {Map<string, Set<string>>} */
  const viewportsByUrl = new Map();
  for (const s of Array.isArray(screenshots) ? screenshots : []) {
    if (!s?.url || !s?.screenshot) continue;
    const set = viewportsByUrl.get(s.url) ?? new Set();
    set.add(typeof s.viewport === 'string' ? s.viewport :  ...
````

## 23. Bash

````bash
S=$SCRATCH/wf2/verify-A02; W=$REPO; cat > $S/probe.mjs <<EOF
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axe = require('$W/node_modules/axe-core');
const { toWcagEmSummary, SC_LEVEL_MAP } = await import('file://$W/src/lib/wcag-em-summary.mjs');
const rules = axe.getRules();
const tagsOf = (id) => rules.find((r) => r.ruleId === id).tags;
// WCAG 2.1-introduced and 2.2-introduced SCs (authoritative W3C lists)
const NEW_IN_21 = ['1.3.4','1.3.5','1.3.6','1.4.10','1.4.11','1.4.12','1.4.13','2.1.4','2.2.6','2.3.3','2.5.1','2.5.2','2.5.3','2.5.4','2.5.5','2.5.6','4.1.3'];
const NEW_IN_22 = ['2.4.11','2.4.12','2.4.13','2.5.7','2.5.8','3.2.6','3.3.7','3.3.8','3.3.9'];
const page = {
  url: 'http://localhost/a', pageOutcome: 'ok',
  violations: [
    { id: 'target-size', tags: tagsOf('target-size'), impact: 'serious', nodes: [{}] },
    { id: 'scrollable-region-focusable', tags: tagsOf('scrollable-region-focusable'), impact: 'serious', nodes: [{}] },
    { id: 'color-contrast', tags: tagsOf('color-contrast'), impact: 'serious', nodes: [{}] },
  ],
  passesDetail: [
    { id: 'avoid-inline-spacing', tags: tagsOf('avoid-inline-spacing') },
    { id: 'image-alt', tags: tagsOf('image-alt') },
  ],
  incompleteDetail: [], inapplicableDetail: [
    { id: 'autocomplete-valid', tags: tagsOf('autocomplete-valid') },
  ],
};
const mapKeys = Object.keys(SC_LEVEL_MAP);
console.log('SC_LEVEL_MAP size', mapKeys.length, 'has 4.1.1', mapKeys.includes('4.1.1'), 'AAA count', Object.values(SC_LEVEL_MAP).filter(l=>l==='AAA').length);
for (const v of ['2.0','2.1','2.2']) for (const t of ['A','AA','AAA']) {
  const out = toWcagEmSummary({ config: { wcagEm: { wcagVersion: v, conformanceTarget: t } } }, { axeResults: [page] });
  const co = out.criteriaOutcomes;
  const notInVersion = co.filter((o) => (v === '2.0' && (NEW_IN_21.includes(o.sc) || NEW_IN_22.includes(o.sc))) || (v === '2.1' && NEW_IN_22.includes(o.sc))).map(o=>o.sc+':'+o.outcome);
  const lv = { A: ['A'], AA: ['A','AA'], AAA: ['A','AA','AAA'] }[t];
  const aboveTarget = co.filter((o) => o.level && !lv.includes(o.level)).map(o=>o.sc+'('+o.level+'):'+o.outcome);
  const p = co.filter(o=>o.outcome==='passed').length, f = co.filter(o=>o.outcome==='failed').length;
  const pIn = co.filter(o=>o.outcome==='passed' && !notInVersion.includes(o.sc+':passed') && !(o.level && !lv.includes(o.level))).length;
  const fIn = co.filter(o=>o.outcome==='failed' && !notInVersion.includes(o.sc+':failed') && !(o.level && !lv.includes(o.level))).length;
  const o411 = co.find(o=>o.sc==='4.1.1');
  console.log(\`v=\${v} t=\${t} rows=\${co.length} notTested=\${co.filter(o=>o.outcome==='notTested').length} outOfVersion=\${notInVersion.length} [\${notInVersion.filter(x=>!x.endsWith('notTested')).join(',')}] aboveTarget=[\${aboveTarget.join(',')}] 4.1.1=\${o411?.outcome} score=\${Math.round(p/(p+f)*100)} (in-scope-only=\${Math.round(pIn/(pIn+fIn)*100)}) 2.2-only-listed=\${co.filter(o=>NEW_IN_22.includes(o.sc)).map(o=>o.sc).join(' ')}\`);
}
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S && node probe.mjs
````

Output (truncated):

````text
SC_LEVEL_MAP size 87 has 4.1.1 true AAA count 31
v=2.0 t=A rows=37 notTested=30 outOfVersion=10 [1.3.5:inapplicable,1.4.12:passed,2.5.8:failed] aboveTarget=[1.3.5(AA):inapplicable,1.4.3(AA):failed,1.4.12(AA):passed,2.1.3(AAA):failed,2.5.8(AA):failed] 4.1.1=notTested score=33 (in-scope-only=50) 2.2-only-listed=2.5.8 3.2.6 3.3.7
v=2.0 t=AA rows=57 notTested=50 outOfVersion=18 [1.3.5:inapplicable,1.4.12:passed,2.5.8:failed] aboveTarget=[2.1.3(AAA):failed] 4.1.1=notTested score=33 (in-scope-only=33) 2.2-only-listed=2.4.11 2.5.7 2.5.8 3.2.6 3.3.7 3.3.8
v=2.0 t=AAA rows=87 notTested=80 outOfVersion=26 [1.3.5:inapplicable,1.4.12:passed,2.5.8:failed] aboveTarget=[] 4.1.1=notTested score=33 (in-scope-only=25) 2.2-only-listed=2.4.11 2.4.12 2.4.13 2.5.7 2.5.8 3.2.6 3.3.7 3.3.8 3.3.9
v=2.1 t=A rows=37 ...
````

## 24. Bash

````bash
W=$REPO; cd $W; grep -rn "wcagEm\b\|wcagEm\.\|wcagEm?" src/lib/config.mjs src/commands/*.mjs | head -12; sed -n 655,680p schemas/config.schema.json; grep -n "AAA\|wcag213\|2\.1\.3\|level ===" test/unit/wcag-em-summary.test.mjs | head -20
````

Output (truncated):

````text
src/lib/config.mjs:56:// `resolveViewports`. Authenticated scans added `auth`, `wcagEm`. The reporter
src/lib/config.mjs:154:  // defaults so users without explicit wcagEm config still get a valid
src/lib/config.mjs:156:  wcagEm: {
              "type": "string"
            },
            "contact": {
              "type": "string"
            }
          }
        },
        "wcagVersion": {
          "enum": ["2.0", "2.1", "2.2"]
        },
        "conformanceTarget": {
          "enum": ["A", "AA", "AAA"]
        },
        "atBaseline": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "technologiesReliedUpon": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "sampl ...
````

## 25. Bash

````bash
W=$REPO; cd $W; sed -n 430,485p test/unit/wcag-em-summary.test.mjs
````

Output (truncated):

````text
      '3.2.2': 'A',
      '3.2.3': 'AA',
      '3.2.4': 'AA',
      '3.2.6': 'A',
      '3.3.1': 'A',
      '3.3.2': 'A',
      '3.3.3': 'AA',
      '3.3.4': 'AA',
      '3.3.7': 'A',
      '3.3.8': 'AA',
      '4.1.1': 'A',
      '4.1.2': 'A',
      '4.1.3': 'AA',
    }),
  ).length;
  assert.equal(
    out.criteriaOutcomes.length,
    allA_AA_count,
    `total outcomes = all A+AA SC (${allA_AA_count})`,
  );

  assert.ok(
    !out.criteriaOutcomes.some((o) => o.level === 'AAA'),
    'no AAA SC emitted for AA target',
  );
});

test('toWcagEmSummary: notTested entries are sorted with touched SC', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      violations: [{ id: 'color-contrast', tags: ['wcag143'], impact: 'serious', nodes: [{}] }],
    }),
  ];
  const out = toWca ...
````

## 26. Bash

````bash
W=$REPO; cd $W; sed -n 245,275p src/reporters/html.mjs; sed -n 395,415p test/unit/wcag-em-summary.test.mjs
````

Output (truncated):

````text
  out += `</ul>\n`;
  return out;
}

/**
 * @param {Record<string, any>} summary
 * @returns {string}
 */
function renderCriteriaOutcomes(summary) {
  const wcagEm = summary.wcagEmSummary;
  const outcomes = Array.isArray(wcagEm?.criteriaOutcomes) ? wcagEm.criteriaOutcomes : [];
  if (outcomes.length === 0) return '';
  let out = `<h2>Findings by WCAG success criterion</h2>\n<table>\n<thead>\n`;
  out += `<tr><th>Criterion</th><th>Outcome</th><th>Related rules</th></tr>\n`;
  out += `</thead>\n<tbody>\n`;
  for (const c of outcomes) {
    const outcomeClass = c.outcome === 'notTested' ? ' class="outcome-notTested"' : '';
    out += `<tr><td>${html`${c.sc ?? ''}`}</td><td${outcomeClass}>${html`${c.outcome ?? ''}`}</td><td>${html`${(Array.isArray(c.relatedRules) ? c.relatedRules : []).join(' ...
````

## 27. Bash

````bash
W=$REPO; cd $W; grep -n -i "methodology\|boilerplate\|wcag version\|wcagVersion\|2\.0\b\|obsolete\|AAA\|standardsContext" TODO.md | head -15; git log --oneline -3 -- src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
ab1bae7 feat(wcag-em): disclose automated coverage so exclusions can't fake passes (E1 DISCLOSE)
2b7ffab feat(summarize): consume pageOutcome at every raw-artefact site (E1 REMOVE)
d1a7646 feat(reporters): report-builder-starter exporter
````
