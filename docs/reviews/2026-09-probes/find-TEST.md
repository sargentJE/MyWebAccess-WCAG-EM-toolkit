# Probe record: find:TEST

Role: round-2 finder. Findings: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, TEST-10, TEST-11, TEST-12

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
SP=$SCRATCH; mkdir -p $SP/wf2/test; wc -l $SP/review/round1-index.txt; cut -c1-230 $SP/review/round1-index.txt | head -200
````

Output (truncated):

````text
<persisted-output>
Output too large (40.3KB). Full output saved to: $CLAUDE_STATE

Preview (first 2KB):
     184 $SCRATCH/review/round1-index.txt
VERD-01 | high | new | correctness | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per SC. This gives false passes and false 'not present' verdicts on
VERD-02 | medium | new | docs-drift | Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off automated passed/inapplicable verdicts | docs/guides/user-manual.md:71, docs/guides
VERD-03 | high | new | correctness | wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria) | src/lib/wcag-em-summary. ...
````

## 2. Bash

````bash
SP=$SCRATCH; awk -F' \\| ' '{print $1" | "$2" | "$4" | "substr($5,1,140)}' $SP/review/round1-index.txt
````

Output (truncated):

````text
VERD-01 | high | correctness | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per SC. This g
VERD-02 | medium | docs-drift | Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off automated passed/inapplicable v
VERD-03 | high | correctness | wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria)
VERD-04 | medium | correctness | 4.1.1 Parsing (obsolete and removed in WCAG 2.2) is emitted as notTested in every default 2.2 run, and the client draft tells the author to 
VERD-05 | medium | correctness | SCs above the conformance target that a rule touched are emitted and scored: 2.1.3 (AAA) ...
````

## 3. Bash

````bash
SP=$SCRATCH; cd $SP/review; node -e '
const f=JSON.parse(require("fs").readFileSync("round1-findings.json","utf8"));
const arr=Array.isArray(f)?f:(f.findings||Object.values(f).flat());
for (const x of arr) if (["SAMP-10","SEC-09","DISC-25","PROC-16","SCAN-22","REPA-07","REPA-15","REPB-21","SCAN-20"].includes(x.id)) console.log(x.id, "\nCLAIM:", x.claim, "\nVERIF:", (x.verification||"").slice(0,900), "\nREC:", (x.recommendation||"").slice(0,400), "\n---");
'; ls $SP/review
````

Output (truncated):

````text
SAMP-10 
CLAIM: The only sampling-specific test checks the structuredMissingFromInventory warning. No test checks that seededSample is deterministic, that the random pool excludes structured pages, the random-size formula, auto-suggest selection, or process expansion. The 2026-06 review's '100% via indirect tests' coverage figure for sample-utils reflects lines executed, not behaviour asserted. 
VERIF: The repo was copied to the scratch directory (rsync excluding .git and node_modules; node_modules symlinked) and four mutants were applied together: M1 `let t = Math.floor(Math.random() * 233280)` (seed ignored, so sampling is non-deterministic); M2 `const randomPool = allUrls` (structured pages eligible for the random tier); M3 `if (false)` around auto-suggest; M4 an empty process-expansion ...
````

## 4. Bash

````bash
python3 - <<'EOF'
import re
b=open('src/reporters/portal-export.mjs','rb').read()
for m in re.finditer(rb'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', b):
    ln=b[:m.start()].count(b'\n')+1
    line=b.split(b'\n')[ln-1]
    print(ln, repr(m.group()), repr(line[:160]))
EOF
````

Output (truncated):

````text
304 b'\x00' b'        const k = `${r.url}\x00${r.selector}`;'
````

## 5. Bash

````bash
SP=$SCRATCH/wf2/test; mkdir -p $SP/tmp; cd $REPO && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -v && TMPDIR=$SP/tmp CRAWLEE_STORAGE_DIR=$SP/crawlee-storage npm run test:coverage > $SP/coverage.txt 2>&1; echo "exit=$?" >> $SP/coverage.txt
````

Output (truncated):

````text
Command running in background with ID: b7vrbyoo9. Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 6. Bash

````bash
SP=$SCRATCH/wf2/test; R=$REPO; rsync -a --exclude .git --exclude node_modules --exclude output --exclude logs --exclude spikes $R/ $SP/copy/ && ln -sfn $R/node_modules $SP/copy/node_modules && ls $SP/copy | head -30; cd $R && ls src/lib src/commands src/reporters; wc -l src/lib/wcag-em-summary.mjs src/lib/scan-results.mjs src/lib/urls.mjs src/lib/sample-utils.mjs src/commands/summarize.mjs src/reporters/_template.mjs src/reporters/portal-export.mjs 2>/dev/null
````

Output (truncated):

````text
CHANGELOG.md
CONTRIBUTING.md
LICENSE
README.md
TODO.md
bin
configs
docs
eslint.config.mjs
jsconfig.json
node_modules
package-lock.json
package.json
schemas
scripts
src
test
src/commands:
discover.mjs
sample.mjs
scan-processes.mjs
scan.mjs
summarize.mjs

src/lib:
args.mjs
auth.mjs
axe-artifact.mjs
axe-utils.mjs
browser-engine.mjs
browser.mjs
config.mjs
context.mjs
engine-check.mjs
fs-utils.mjs
group-findings.mjs
logger.mjs
manual-backlog.mjs
page-guard.mjs
preflight.mjs
process-runner.mjs
sample-utils.mjs
scan-results.mjs
sitemap.mjs
urls.mjs
validate-config.mjs
version.mjs
viewports.mjs
wcag-em-summary.mjs

src/reporters:
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
     532 src/lib/wcag-em-summary.m ...
````

## 7. Bash

````bash
sed -n 40,96p src/lib/scan-results.mjs; grep -n 'function \|=> {$' src/lib/wcag-em-summary.mjs | head -40
````

Output (truncated):

````text
 * Classify a result entry (a page-view in `axe-results.json`, a process state,
 * or a synthetic test fixture). Order matters: a hard execution error wins over
 * a page-outcome tag, which wins over a redirect-duplicate marker.
 *
 * Legacy / pre-feature entries carry none of these fields; the `?? 'ok'`
 * fallback keeps them — and every existing test fixture — fully `auditable`,
 * so introducing the field set is behaviour-neutral for prior artefacts.
 *
 * @param {any} entry - One scan/process result object (or process state).
 * @returns {ViewStatus}
 */
export function viewStatus(entry) {
  // A thrown navigation/scan failure is recorded as a string `error` on the
  // result (scan.mjs failure-path push); that is an execution fault, distinct
  // from a could-not-audit page.
  if (typ ...
````

## 8. Bash

````bash
sed -n 188,330p src/lib/wcag-em-summary.mjs; sed -n 505,532p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
export function toWcagEmSummary(ctx, rawResults) {
  const wcagEmConfig = ctx?.config?.wcagEm ?? {};
  const axeResults = Array.isArray(rawResults?.axeResults) ? rawResults.axeResults : [];
  const processResults = Array.isArray(rawResults?.processResults) ? rawResults.processResults : [];
  const sampleMetadata =
    rawResults?.sampleMetadata && typeof rawResults.sampleMetadata === 'object'
      ? rawResults.sampleMetadata
      : {};

  /** @type {string[]} */
  const scanWarnings = [];

  // ANCHOR: SCBucket — per-SC aggregation.
  // Each bucket tracks whether we've seen a violation, a pass (non-best-practice),
  // a reviewable incomplete, an inapplicable, and the set of rules that touch
  // this SC in this run.
  /**
   * @typedef {object} ScBucket
   * @property {boolean} anyViol ...
````

## 9. Bash

````bash
SP=$SCRATCH/wf2/test; tail -5 $SP/coverage.txt; command grep -n '^ℹ tests\|^ℹ pass\|^ℹ fail\|^ℹ skipped\|^ℹ todo\|^ℹ duration' $SP/coverage.txt; command grep -n 'start of coverage report' $SP/coverage.txt; awk '/start of coverage report/{f=1} f' $SP/coverage.txt | command grep -E 'src/|file |all files' | cut -c1-200 | head -80
````

Output (truncated):

````text
ℹ ---------------------------------------------------------------------------------------------------------------------------------------------------------
ℹ all files                                   |  97.89 |    83.83 |   94.35 | 
ℹ ---------------------------------------------------------------------------------------------------------------------------------------------------------
ℹ end of coverage report
exit=0
530:ℹ tests 525
532:ℹ pass 525
533:ℹ fail 0
535:ℹ skipped 0
536:ℹ todo 0
537:ℹ duration_ms 28740.298583
538:ℹ start of coverage report
ℹ file                                        | line % | branch % | funcs % | uncovered lines
ℹ all files                                   |  97.89 |    83.83 |   94.35 |
````

## 10. Bash

````bash
SP=$SCRATCH/wf2/test; awk '/start of coverage report/{f=1} f' $SP/coverage.txt | head -140 | cut -c1-260
````

Output (truncated):

````text
ℹ start of coverage report
ℹ ---------------------------------------------------------------------------------------------------------------------------------------------------------
ℹ file                                        | line % | branch % | funcs % | uncovered lines
ℹ ---------------------------------------------------------------------------------------------------------------------------------------------------------
ℹ bin                                         |        |          |         | 
ℹ  wcag-em.mjs                                |  72.73 |    66.67 |   33.33 | 30-36 98-117 128-130 139-141 150-157 166-172 181-186 215-217 220-222 225-227
ℹ src                                         |        |          |         | 
ℹ  commands                                   |        ...
````

## 11. Bash

````bash
SP=$SCRATCH/wf2/test; cat > $SP/mutate.mjs <<'EOF'
// Mutation spot-check runner: applies each mutant to the scratch COPY, runs the
// unit suite, restores the file. Never touches the repo.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const COPY = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(',') : null;
const M = [
  ['SUMM-PASS-BEFORE-CANTTELL', 'src/lib/wcag-em-summary.mjs',
    "  if (bucket.anyReviewableIncomplete) return 'cantTell';\n  if (bucket.anyNonBestPracticePass) return 'passed';",
    "  if (bucket.anyNonBestPracticePass) return 'passed';\n  if (bucket.anyReviewableIncomplete) return 'cantTell';"],
  ['SUMM-BESTPRACTICE-PASS-COUNTS', 'src/lib/wcag-em-summary.mjs',
    'if (!isBestPractice) b.anyNonBestPracticePass = true;', 'b.anyNonBestPracticePass = true;'],
  ['SUMM-STATE-GUARD-REMOVED', 'src/lib/wcag-em-summary.mjs',
    "      if (!isAuditableView(state)) continue;\n      const stateUrl", "      const stateUrl"],
  ['SUMM-PROC-GUARD-REMOVED', 'src/lib/wcag-em-summary.mjs',
    "  for (const proc of processResults) {\n    if (!isAuditableView(proc)) continue;", "  for (const proc of processResults) {"],
  ['VIEW-EMPTY-AUDITABLE', 'src/lib/scan-results.mjs', "  if (outcome === 'empty') return 'empty';\n", ''],
  ['VIEW-REDIRDUP-AUDITABLE', 'src/lib/scan-results.mjs',
    "  if (entry?.redirectedToAlreadyScanned === true) return 'redirect-duplicate';", ''],
  ['URL-QUERY-NOT-SORTED', 'src/lib/urls.mjs',
    'const ordered = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));',
    'const ordered = [...url.searchParams.entries()];'],
  ['URL-DEFAULT-PORT-KEPT', 'src/lib/urls.mjs', "    url.port = '';\n", '    /* mutant */\n'],
  ['EXIT-THRESHOLD-OFF-BY-ONE', 'src/commands/summarize.mjs',
    'if (count >= threshold) return 2;', 'if (count > threshold) return 2;'],
  ['HEALTH-DEGRADED-AS-FULL', 'src/commands/summarize.mjs',
    'if (rec.failed.length === 0) pagesFullyScanned += 1;', 'if (rec.ok.length > 0) pagesFullyScanned += 1;'],
  ['SUMM-INCOMPLETE-EXAMPLE-HTML-DROPPED', 'src/commands/summarize.mjs',
    '          html: ex.html ?? null,\n          failureSummary: ex.failureSummary ?? null,\n        });\n      }\n    }\n  };',
    '          html: null,\n          failureSummary: ex.failureSummary ?? null,\n        });\n      }\n    }\n  };'],
  ['TEMPLATE-ATTR-DQUOTE-UNESCAPED', 'src/reporters/_template.mjs',
    `const dangerChars = ['&', '<', '>', '"', "'", '\`'];`, `const dangerChars = ['&', '<', '>', "'", '\`'];`],
  ['TEMPLATE-SAFEURL-ANY-SCHEME', 'src/reporters/_template.mjs',
    "  if (protocol === 'http' || protocol === 'https') return str;\n  return '#';",
    "  if (protocol === 'http' || protocol === 'https') return str;\n  return str;"],
  ['PORTAL-SCORE-INAPPLICABLE-AS-PASS', 'src/reporters/portal-export.mjs',
    "if (o?.outcome === 'passed') passed += 1;", "if (o?.outcome === 'passed' || o?.outcome === 'inapplicable') passed += 1;"],
  ['PORTAL-SCORE-FLOOR', 'src/reporters/portal-export.mjs',
    'Math.round((passed / denom) * 100)', 'Math.floor((passed / denom) * 100)'],
  ['GUARD-429-NOT-CHALLENGE', 'src/lib/page-guard.mjs',
    'const challengeStatus = status === 403 || status === 429 || status === 503;',
    'const challengeStatus = status === 403 || status === 503;'],
  ['GUARD-CLEARED-EMPTY-BODY', 'src/lib/page-guard.mjs',
    "  if (String(bodyText).trim().length === 0) return false;\n  return true;", "  return true;"],
  ['SAMPLE-SIZE-MIN-NOT-MAX', 'src/commands/sample.mjs',
    'Math.max(minRandomPages, Math.ceil(structured.length * randomPercent))',
    'Math.min(minRandomPages, Math.ceil(structured.length * randomPercent))'],
  ['GROUP-OCCURRENCES-NOT-SUMMED', 'src/lib/group-findings.mjs',
    '    entry.occurrences += 1;\n    entry.pages.add(pageUrl);\n    entry.sourceTypes', '    entry.occurrences = 1;\n    entry.pages.add(pageUrl);\n    entry.sourceTypes'],
];
function run() {
  return new Promise((res) => {
    const c = spawn(process.execPath, ['--test', '--test-reporter=tap', 'test/unit/**/*.test.mjs'], { cwd: COPY, env: { ...process.env } });
    let out = '';
    c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (out += d));
    c.on('close', (code) => {
      const g = (k) => Number((out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? -1);
      const failing = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]).filter((n) => !n.endsWith('.test.mjs')).slice(0, 6);
      res({ code, tests: g('tests'), pass: g('pass'), fail: g('fail'), failing });
    });
  });
}
const results = [];
const base = await run();
console.log('BASELINE', JSON.stringify(base));
for (const [id, rel, find, repl] of M) {
  if (only && !only.includes(id)) continue;
  const f = path.join(COPY, rel);
  const orig = fs.readFileSync(f, 'utf8');
  const n = orig.split(find).length - 1;
  if (n !== 1) { console.log(id, 'FIND-COUNT', n); results.push({ id, error: `find count ${n}` }); continue; }
  fs.writeFileSync(f, orig.replace(find, repl));
  try { const r = await run(); const verdict = r.fail === 0 && r.code === 0 ? 'SURVIVED' : 'KILLED'; console.log(id, verdict, JSON.stringify(r)); results.push({ id, rel, verdict, ...r }); }
  finally { fs.writeFileSync(f, orig); }
}
fs.writeFileSync(path.join(path.dirname(COPY), 'mutation-results.json'), JSON.stringify({ base, results }, null, 2));
EOF
cd $SP && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && TMPDIR=$SP/tmp node $SP/mutate.mjs $SP/copy > $SP/mutation.log 2>&1; echo exit=$? >> $SP/mutation.log
````

Output (truncated):

````text
Command running in background with ID: bfun1f47g. Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 12. Bash

````bash
sleep 60; cat $SCRATCH/wf2/test/mutation.log
````

Output (truncated):

````text
<tool_use_error>Blocked: sleep 60 followed by: cat $SCRATCH/wf2/test/mutation.log. To wait for a condition, use Monitor with an until-loop (e.g. `until <check>; do sleep 2; done`). To wait for a command you started, use run_in_background: true. Do not chain shorter sleeps to work around this block.</tool_use_error>
````

## 13. Bash

````bash
cat $SCRATCH/wf2/test/mutation.log
````

Output (truncated):

````text
BASELINE {"code":0,"tests":517,"pass":517,"fail":0,"failing":[]}
SUMM-PASS-BEFORE-CANTTELL KILLED {"code":1,"tests":517,"pass":516,"fail":1,"failing":["toWcagEmSummary: cantTell wins over passed + inapplicable (but not failed)"]}
SUMM-BESTPRACTICE-PASS-COUNTS KILLED {"code":1,"tests":517,"pass":516,"fail":1,"failing":["toWcagEmSummary: best-practice rule passing does NOT count as passed"]}
SUMM-STATE-GUARD-REMOVED SURVIVED {"code":0,"tests":517,"pass":517,"fail":0,"failing":[]}
SUMM-PROC-GUARD-REMOVED SURVIVED {"code":0,"tests":517,"pass":517,"fail":0,"failing":[]}
VIEW-EMPTY-AUDITABLE KILLED {"code":1,"tests":517,"pass":515,"fail":2,"failing":["viewStatus: pageOutcome maps to challenge / empty / errored / auditable","isAuditableView: true only for auditable views"]}
VIEW-REDIRDUP-AUDITABL ...
````

## 14. Bash

````bash
command grep -n "image-alt\|color-contrast\|'label'\|criteriaOutcomes\|outcome ===\|\.outcome" test/e2e/*.mjs | head -20; ls test/fixtures/static-site; cat $SCRATCH/wf2/test/mutation.log | tail -n +9
````

Output (truncated):

````text
test/e2e/reporters-html-axe.test.mjs:9: * `prefers-color-scheme` modes. The test asserts zero `color-contrast`
test/e2e/reporters-html-axe.test.mjs:17: * Why e2e (not unit)? `color-contrast` is computed by axe-core at runtime
test/e2e/reporters-html-axe.test.mjs:104: * and return the list of `color-contrast` violation IDs (empty array means
test/e2e/reporters-html-axe.test.mjs:124:      .filter((v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced')
test/e2e/reporters-html-axe.test.mjs:134:  'html reporter self-axe: zero color-contrast violations in light + dark color schemes',
test/e2e/reporters-html-axe.test.mjs:145:      `light-mode color-contrast violations: ${JSON.stringify(lightViolations)}`,
test/e2e/reporters-html-axe.test.mjs:152:      `dark-mode color-contrast vio ...
````

## 15. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e 'for (const u of ["https://a.test:443/x","http://a.test:80/x","HTTPS://A.test:0443/"]) { const x=new URL(u); console.log(u, "-> port=", JSON.stringify(x.port), x.toString()); }'; cd $REPO && command grep -n "443\|:80" test/unit/urls.test.mjs | head
````

Output (truncated):

````text
https://a.test:443/x -> port= "" https://a.test/x
http://a.test:80/x -> port= "" http://a.test/x
HTTPS://A.test:0443/ -> port= "" https://a.test/
31:  assert.strictEqual(normalizeUrl('https://example.com:443/page'), 'https://example.com/page');
35:  assert.strictEqual(normalizeUrl('http://example.com:80/page'), 'http://example.com/page');
93:    urlAllowedByScope('https://example.com:8080/page', 'https://example.com/', {
````

## 16. Bash

````bash
tail -n +16 $SCRATCH/wf2/test/mutation.log; cd $SCRATCH/wf2/test && diff -rq --exclude node_modules copy $REPO 2>/dev/null | command grep -v "Only in /Users" | head
````

Output (truncated):

````text
PORTAL-SCORE-FLOOR KILLED {"code":1,"tests":517,"pass":516,"fail":1,"failing":["portal-export: averageScore = passed/(passed+failed), rounded"]}
GUARD-429-NOT-CHALLENGE SURVIVED {"code":0,"tests":517,"pass":517,"fail":0,"failing":[]}
GUARD-CLEARED-EMPTY-BODY KILLED {"code":1,"tests":517,"pass":516,"fail":1,"failing":["challengeCleared: an empty body is NOT cleared"]}
SAMPLE-SIZE-MIN-NOT-MAX SURVIVED {"code":0,"tests":517,"pass":517,"fail":0,"failing":[]}
GROUP-OCCURRENCES-NOT-SUMMED KILLED {"code":1,"tests":517,"pass":513,"fail":4,"failing":["groupFindings: buckets violations by rule with occurrence + page counts","groupFindings: caps examples at 5 per rule while still counting all occurrences","page-scan URLs with and without trailing slash group into one finding","process-scan trailing-s ...
````

## 17. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && npx eslint . -f json -o $SCRATCH/wf2/test/eslint.json; echo "eslint rc=$?"; node -e 'const r=require("$SCRATCH/wf2/test/eslint.json"); let w=0,e=0; const byRule={}; for (const f of r){w+=f.warningCount;e+=f.errorCount; for (const m of f.messages) byRule[m.ruleId]=(byRule[m.ruleId]||0)+1;} console.log({files:r.length,w,e,byRule});'; command grep -rn "config.d.ts\|gen-types" test/ .github/ | head; cat .prettierignore
````

Output (truncated):

````text
eslint rc=0
{ files: 114, w: 0, e: 0, byRule: {} }
node_modules/
output/
logs/
.auth/
coverage/
test/.tmp/
test/fixtures/static-site/
package-lock.json
*.min.js

# Runtime artefacts written by Crawlee — gitignored, never hand-edited.
storage/

# Local-only audit configs (gitignored convention) — not subject to repo style.
configs/<local-config>.json

# Auto-generated from schemas/config.schema.json by scripts/gen-types.mjs;
# regenerated on every commit via .husky/pre-commit. Excluded from prettier
# so the regen output (which doesn't run prettier) doesn't conflict with
# format:check.
src/types/config.d.ts

# Whitespace inside html`...` tagged template literals is part of the runtime
# HTML output (the template tag does not normalise whitespace). Prettier
# reformatting these literals cha ...
````

## 18. Bash

````bash
SP=$SCRATCH/wf2/test; cd $SP/copy && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && head -30 scripts/gen-types.mjs | command grep -n "writeFile\|out\|path" ; node scripts/gen-types.mjs && diff -q src/types/config.d.ts $REPO/src/types/config.d.ts && echo "IN SYNC"
````

Output (truncated):

````text
20:import path from 'node:path';
25:const __dirname = path.dirname(fileURLToPath(import.meta.url));
26:const SCHEMA_PATH = path.resolve(__dirname, '../schemas/config.schema.json');
27:const OUT_PATH = path.resolve(__dirname, '../src/types/config.d.ts');
wrote src/types/config.d.ts
IN SYNC
````

## 19. Bash

````bash
sed -n 205,230p bin/wcag-em.mjs; sed -n 60,80p docs/adr/0012-extensibility-is-internal.md; cat src/index.mjs | head -40
````

Output (truncated):

````text
        }
      }
      return exitCode;
    }),
  );

// SECTION: Lifecycle — SIGINT / unhandled rejections
// NOTE: process.exit is intentional here — SIGINT/SIGTERM handlers must not
// allow Playwright's event loop to swallow the signal.
process.on('SIGINT', () => {
  process.stderr.write('\nwcag-em: SIGINT received — exiting\n');
  // eslint-disable-next-line n/no-process-exit
  process.exit(130);
});
process.on('SIGTERM', () => {
  process.stderr.write('\nwcag-em: SIGTERM received — exiting\n');
  // eslint-disable-next-line n/no-process-exit
  process.exit(143);
});
process.on('unhandledRejection', (reason) => {
  const logger = createLogger({ level: 'error' });
  logger.error({ reason }, 'unhandled rejection');
  process.exitCode = 1;
});

// SECTION: Parse and dispatch
  internal- ...
````

## 20. Bash

````bash
command grep -n "export" src/types/index.d.ts; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e 'import("$REPO/src/index.mjs").then(m=>console.log("runtime exports:",Object.keys(m).sort().join(",")))'; command grep -rn "SIGINT\|index.d.ts\|emitDeclaration" $SCRATCH/review/round1-index.txt | head
````

Output (truncated):

````text
1:export { WCAGEMAccessibilityToolkitConfig, Action } from './config.js';
3:export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
5:export interface BuildContextOptions {
13:export interface RunContextPaths {
22:export interface RunContext {
30:export function buildContext(options?: BuildContextOptions): Promise<RunContext>;
32:export interface LoggerOptions {
38:export function createLogger(options?: LoggerOptions): import('pino').Logger;
39:export function getLogger(options?: LoggerOptions): import('pino').Logger;
41:export interface ValidationResult {
47:export function validateConfig(config: unknown, configPath?: string): Promise<ValidationResult>;
49:export function assertValidConfig(config: unknown, configPath?: string): Promise<void>;
51:export i ...
````

## 21. Bash

````bash
SP=$SCRATCH/wf2/test; cd $REPO && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && TMPDIR=$SP/tmp CRAWLEE_STORAGE_DIR=$SP/crawlee-storage node --test --experimental-test-coverage --test-reporter=spec test/e2e/scan-health.test.mjs 2>&1 | command grep -E "✔|✖|tests|markdown.mjs|summarize.mjs|scan.mjs|discover.mjs|all files|^ℹ  *src" | head -20
````

Output (truncated):

````text
✔ scan health: failed page + failing pre-scan action surface end-to-end (22128.404916ms)
ℹ tests 1
ℹ src                          |        |          |         | 
ℹ   discover.mjs               |  82.32 |    53.33 |   64.00 | 57-58 80-103 115-133 154-155 197-200 220-222 254-258 299-301 303-305 313-316 410-413
ℹ   scan.mjs                   |  86.41 |    47.83 |   47.06 | 139-141 230-231 240-249 251-269 276-290 302-307 361-366 469-471
ℹ   summarize.mjs              |  79.16 |    38.30 |   48.28 | 75 141-150 189 205-212 221-231 257-258 294-297 299-300 307-311 313-316 325-328 349-355 398-402 450-462 470-491 494-522 525-528 531-539 639-643 713-715
ℹ   markdown.mjs               |  82.50 |    15.00 |   60.00 | 85 87-88 91-94 101-103 105-106 113-117 119-122 146-148 217-234
ℹ all files            ...
````

## 22. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e 'import("$REPO/src/lib/version.mjs").then(m=>console.log(JSON.stringify(m)))'; sed -n 44,60p src/lib/version.mjs; git log --oneline bf14f68..HEAD | command grep -ciE "^[0-9a-f]+ (feat|fix)"
````

Output (truncated):

````text
{"TOOL_IDENTITY":{"name":"wcag-em-a11y-toolkit","version":"1.1.0","axeCore":"4.11.2"}}
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
});

/**
 * Compose the markdown-style tool-identity header used at the top of
26
````

## 23. Bash

````bash
command grep -rn -a "@typedef" src/commands/scan.mjs src/lib/scan-results.mjs src/lib/axe-artifact.mjs src/lib/group-findings.mjs src/lib/wcag-em-summary.mjs | head; sed -n 1,40p test/unit/page-outcome-contract.test.mjs | command grep -n "contract\|producer\|consumer" | head
````

Output (truncated):

````text
src/lib/scan-results.mjs:36: * @typedef {'auditable' | 'errored' | 'challenge' | 'empty' | 'redirect-duplicate'} ViewStatus
src/lib/group-findings.mjs:30: * @typedef {object} GroupFindingsDeps
src/lib/group-findings.mjs:39: * @typedef {object} GroupedFindings
src/lib/wcag-em-summary.mjs:151: * @typedef {object} CriterionOutcome
src/lib/wcag-em-summary.mjs:205:   * @typedef {object} ScBucket
3: * @file E1 §5 contract-safety: a could-not-audit page leaks NOWHERE.
4: * @module test/unit/page-outcome-contract
10: * consumer that re-reads the raw artefact (and forgets the skip) cannot have its
````

## 24. Bash

````bash
sed -n 40,50p test/unit/version.test.mjs; sed -n 425,450p test/unit/wcag-em-summary.test.mjs; sed -n 25,45p test/unit/manual-backlog.test.mjs; command grep -n "averageScore" test/unit/reporters-portal-export.test.mjs | head -5
````

Output (truncated):

````text
test('TOOL_IDENTITY.version matches package.json (propagates on npm version bump)', () => {
  assert.equal(TOOL_IDENTITY.version, SELF_PKG.version);
});

test('TOOL_IDENTITY.axeCore matches @axe-core/playwright/package.json', () => {
  assert.equal(TOOL_IDENTITY.axeCore, AXE_PKG.version);
});

test('TOOL_IDENTITY is frozen — cannot be mutated by consumers', () => {
  assert.ok(Object.isFrozen(TOOL_IDENTITY));
      '2.5.7': 'AA',
      '2.5.8': 'AA',
      '3.1.1': 'A',
      '3.1.2': 'AA',
      '3.2.1': 'A',
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
  ).length ...
````

## 25. Bash

````bash
awk 'NR>=360 && NR<=445 && /^test\(|wcagVersion|4\.1\.1|notTested/' test/unit/wcag-em-summary.test.mjs | head; command grep -n "^test(" test/unit/wcag-em-summary.test.mjs | awk -F: '$1<445' | tail -2; command grep -n "applyAxeOverride" test/unit/*.mjs | head -3
````

Output (truncated):

````text
// SECTION: notTested emission for uncovered SC
test('toWcagEmSummary: emits notTested for all A+AA SC not touched by a rule (AA target)', () => {
  const touched = out.criteriaOutcomes.filter((o) => o.outcome !== 'notTested');
  const notTested = out.criteriaOutcomes.filter((o) => o.outcome === 'notTested');
  assert.ok(notTested.length > 0, 'notTested entries emitted');
  for (const nt of notTested) {
      '4.1.1': 'A',
329:test('failed SC: violation examples capped at 5; subsequent incomplete entries do NOT contaminate', () => {
364:test('toWcagEmSummary: emits notTested for all A+AA SC not touched by a rule (AA target)', () => {
test/unit/axe-utils.test.mjs:4: *   `findMatchingOverride` / `applyAxeOverride`, and `withActAndWcagMetadata`.
test/unit/axe-utils.test.mjs:13:  applyAxeOverr ...
````

## 26. Bash

````bash
sed -n 368,380p test/unit/wcag-em-summary.test.mjs
````

Output (truncated):

````text
      passesDetail: [{ id: 'html-lang', tags: ['wcag311'], impact: null, nodesCount: 1 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx({ conformanceTarget: 'AA' }), { axeResults });

  const touched = out.criteriaOutcomes.filter((o) => o.outcome !== 'notTested');
  assert.equal(touched.length, 2, 'two SC touched: 1.1.1 + 3.1.1');

  const notTested = out.criteriaOutcomes.filter((o) => o.outcome === 'notTested');
  assert.ok(notTested.length > 0, 'notTested entries emitted');
  for (const nt of notTested) {
    assert.ok(nt.level === 'A' || nt.level === 'AA', `level must be A or AA, got ${nt.level}`);
    assert.deepEqual(nt.examples, []);
````

## 27. Bash

````bash
python3 -c "b=open('src/reporters/portal-export.mjs','rb').read(); print('offset',b.index(b'\x00'),'size',len(b))"; git log --format='%h %s' -S"$(printf 'r.url}')" -- src/reporters/portal-export.mjs | head -3; sed -n 300,308p src/reporters/portal-export.mjs | cat -v; npx prettier --check src/reporters/portal-export.mjs 2>&1 | tail -1
````

Output (truncated):

````text
offset 11868 size 23014
cdfceed feat(reporters): add portal-export reporter + flow incomplete evidence end-to-end
  for (const map of [violations, incompletes]) {
    for (const [id, rows] of map) {
      const seen = new Set();
      const deduped = rows.filter((r) => {
        const k = `${r.url}^@${r.selector}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
All matched files use Prettier code style!
````

## 28. Bash

````bash
pgrep -fl "wcag-em.mjs|scratchpad/wf2/test" | head -5; echo "done"; cd $REPO && git status --short | head -3
````

Output (truncated):

````text
21358 /usr/bin/time -l ~/.nvm/versions/node/v22.14.0/bin/node $REPO/bin/wcag-em.mjs discover --config $SCRATCH/wf2/stress/cfg-scale.json --out-dir $SCRATCH/wf2/stress/run1
21359 ~/.nvm/versions/node/v22.14.0/bin/node $REPO/bin/wcag-em.mjs discover --config $SCRATCH/wf2/stress/cfg-scale.json --out-dir $SCRATCH/wf2/stress/run1
done
````

## 29. Bash

````bash
command grep -n "for (const proc of processResults)" src/lib/wcag-em-summary.mjs; command grep -n "html: ex.html ?? null" src/commands/summarize.mjs; command grep -n "status === 429" src/lib/page-guard.mjs; command grep -n "Math.max(minRandomPages" src/commands/sample.mjs; command grep -n "url.port = ''" src/lib/urls.mjs; command grep -n "error: message," src/commands/scan-processes.mjs; command grep -n "const PREDICATE\|const RAW_READ\|RAW_READ.test(src) && !PREDICATE" test/unit/scan-results-consumers-invariant.test.mjs; command grep -n "challengeWaitMs > 0" src/commands/scan.mjs; command grep -n "excludedByPattern.add\|excludedByExtension.add" src/commands/discover.mjs; command grep -n "function probeStorageStateGitignore" src/lib/auth.mjs; command grep -n "let out = \`<h2>Scan health" src/reporters/html.mjs; command grep -an "for (const entry of Array.isArray(proc)" src/reporters/portal-export.mjs
````

Output (truncated):

````text
319:  for (const proc of processResults) {
458:          html: ex.html ?? null,
87:    const challengeStatus = status === 403 || status === 429 || status === 503;
85:  const desiredRandomCount = Math.max(minRandomPages, Math.ceil(structured.length * randomPercent));
51:    url.port = '';
155:      error: message,
29:const PREDICATE = /\b(?:isAuditableView|viewStatus)\b/;
31:const RAW_READ = /readJsonMaybe\([^)]*?(?:axe-results|process-results)\.json/;
54:    if (RAW_READ.test(src) && !PREDICATE.test(src)) {
239:    if (outcome.outcome === 'challenge' && challengeWaitMs > 0) {
220:      excludedByExtension.add(url);
299:            excludedByPattern.add(normalized);
303:            excludedByExtension.add(normalized);
185:function probeStorageStateGitignore(absPath) {
212:  let out = `<h2>S ...
````
