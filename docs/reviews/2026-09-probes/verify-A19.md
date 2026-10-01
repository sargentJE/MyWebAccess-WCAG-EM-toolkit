# Probe record: verify:A19

Role: packet verifier. Findings: SEC-09, SEC-10, SEC-14, SEC-15, SEC-16, SEC-17, PROC-18, VERD-12, VERD-13, CAP-22, REPA-11, REPA-16

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); [print(f['id'],'|',f.get('severity'),'|',f.get('status'),'|',f.get('title'),'\n  ',json.dumps({k:v for k,v in f.items() if k not in ('id','severity','status','title')})[:900]) for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids]" SEC-09,SEC-10,SEC-14,SEC-15,SEC-16,SEC-17,PROC-18,VERD-12,VERD-13,CAP-22,REPA-11,REPA-16
````

Output (truncated):

````text
VERD-12 | medium | tracked-open | act-rule-map.json contains ACT IDs that contradict axe's own actIds; README says axe does not expose them and that the refresh script works (it is a stub) 
   {"dimension": "VERD", "category": "docs-drift", "trackedRef": "T-Q", "claim": "New information beyond T-Q, which frames the problem as hand-vendoring and coverage. At least 5 mapped rules carry IDs that are wrong, not just incomplete: aria-valid-attr-value is mapped to [5c01ea, c487ae] but axe says [6a7281]; label adds 307n5z; audio-caption is mapped to [e7aa44, c3232f] but axe says [2eb176, afb423]; th-has-data-cells adds a25f45 (td-headers-attr's ID); identical-links-same-purpose adds fd3a94. Another 22 axe rules with native actIds are missing, 28 differ in total. src/data/README.md says ACT IDs ar ...
````

## 2. Bash

````bash
cd $REPO
echo "== SEC-09"; grep -n "audit\|uses:" .github/workflows/*.yml | head -20; ls .github; ls .github/dependabot.yml 2>&1; grep -rn "npm audit\|vulnerab" TODO.md | head -5
echo "== SEC-10"; grep -rn -i "robots" src/ | head; grep -n -i robots spikes/web-bot-auth/cf-worker/worker.mjs spikes/web-bot-auth/README.md docs/adr/0021* | head
echo "== SEC-14"; sed -n 75,130p src/lib/browser.mjs; grep -rn "transport\|cdp" src/commands/summarize.mjs src/reporters/*.mjs | head
echo "== SEC-15"; grep -n -i "remote-debugging\|user-data-dir" -r docs README.md configs | head; cat configs/example-site-with-cdp.json 2>/dev/null | head -30
echo "== PROC-18"; sed -n 95,110p docs/adr/0020-pluggable-browser-transport.md; sed -n 195,215p src/lib/browser.mjs
````

Output (truncated):

````text
== SEC-09
6:# `npm audit --production` step. Coverage floors (70% src/lib, 50%
35:        uses: actions/checkout@v5
38:        uses: actions/setup-node@v5
44:        run: npm ci --no-audit --no-fund
59:      - name: npm audit (production only, non-blocking)
60:        run: npm audit --omit=dev || true
72:      - uses: actions/checkout@v5
73:      - uses: actions/setup-node@v5
79:        run: npm ci --no-audit --no-fund
91:        uses: actions/cache@v5
workflows
ls: .github/dependabot.yml: No such file or directory
TODO.md:94:- [x] **npm audit: 14 moderate advisories**, all via transitive `ws`
TODO.md:95:      (uninitialized memory disclosure, GHSA-58qx-3vcg-4xpx); `npm audit fix`
TODO.md:99:      ranges, npm audit now reports zero vulnerabilities; full gate INCLUDING
== SEC-10
docs/adr/00 ...
````

## 3. Bash

````bash
cd $REPO
echo "== SEC-14 logging"; grep -n "acquireBrowserSession" -A25 src/lib/browser.mjs | grep -n "logger\.\(info\|warn\|debug\)" ; grep -rn "transport" src/commands/*.mjs src/lib/summary*.mjs src/reporters/*.mjs 2>/dev/null | grep -v "^.*://" | head
echo "== SEC-16"; sed -n 38,60p spikes/web-bot-auth/serve-directory.mjs; grep -n "private.jwk\|writeFile" spikes/web-bot-auth/round-trip.mjs | head; grep -n "rm -rf\|private.jwk\|secret store" spikes/web-bot-auth/*.md docs/**/*phase*1* 2>/dev/null | head; cat spikes/web-bot-auth/.gitignore .gitignore 2>/dev/null | grep -n "keys\|dev.vars"
echo "== SEC-17"; ls spikes/web-bot-auth/cf-worker; sed -n 95,130p spikes/web-bot-auth/cf-worker/worker.mjs
````

Output (truncated):

````text
== SEC-14 logging
(eval):2: no matches found: src/lib/summary*.mjs
== SEC-16
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const port = Number(arg('port') || process.env.WBA_PORT || 8788);
const keyPath = arg('key') || process.env.WBA_PRIVATE_JWK;

let privateJwk;
let publicJwk;
let ephemeral = false;
if (keyPath) {
  try {
    privateJwk = JSON.parse(await readFile(keyPath, 'utf8'));
  } catch (err) {
    console.error(`Could not read --key "${keyPath}": ${err.message}`);
    process.exit(1);
  }
  if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519' || !privateJwk.d) {
    console.error(`--key must be an Ed25519 (OKP) PRIVATE JWK with a "d" field; got kty=${privateJwk.kty}, crv=${privateJwk.crv}`);
     ...
````

## 4. Bash

````bash
cd $REPO
sed -n 75,95p spikes/web-bot-auth/round-trip.mjs; grep -rn "rm -rf\|\.keys/private.jwk\|secret store\|password manager" spikes/web-bot-auth/ docs/ --include=*.md | head; git check-ignore -v spikes/web-bot-auth/cf-worker/.dev.vars; echo "ci=$?"
echo "== SEC-17"; cat spikes/web-bot-auth/cf-worker/package.json; grep -n "npm i\|rotation\|rotate" spikes/web-bot-auth/README.md docs/adr/0021* | head
echo "== SEC-14"; grep -n "session\.\|warnings\|logger" src/commands/scan.mjs | sed -n 1,200p | grep -n -i "warn\|transport\|info" | head; grep -rn "transport\|engine" src/lib/browser.mjs | grep -n "logger" | head
````

Output (truncated):

````text
  results.push(await verifyRequestIndependent(publicJwk, req));
  results.push(await verifyDivergentAuthority({ privateJwk, publicJwk }));
  results.push(await verifyRequestCorroborating(publicJwk, req));
  results.push(await verifyDirectory(publicJwk, dir));
  results.push(await negativeControl({ publicJwk, privateJwk }));

  // Persist a machine-readable summary alongside the captured artifacts.
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    join(OUT_DIR, 'round-trip-summary.json'),
    `${JSON.stringify({ self_verified: true, cloudflare_validated: false, results }, null, 2)}\n`,
  );

  const pad = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    console.log(`${r.pass ? '✓ PASS' : '✗ FAIL'}  ${r.name.padEnd(pad)}  ${r.detail}`);
  }
  ...
````

## 5. Bash

````bash
cd $REPO
ls spikes/web-bot-auth; grep -rn "rm -rf\|private.jwk\|secret store\|\"spike\"" spikes/web-bot-auth/*.md spikes/web-bot-auth/package.json docs/guides/*.md 2>/dev/null | head -15; grep -n "writeFile\|existsSync" spikes/web-bot-auth/*generate*.mjs spikes/web-bot-auth/lib/*.mjs 2>/dev/null | head
grep -n "CDP\|cdp\|transport" src/lib/browser.mjs | grep -in "log" | head -3; grep -rn "cdp\|transport" src/commands/summarize.mjs src/lib/execution-health*.mjs src/reporters/ 2>/dev/null | head -3
````

Output (truncated):

````text
01-generate-keys.mjs
02-build-directory.mjs
03-sign-request.mjs
04-verify.mjs
README.md
cf-worker
lib
package-lock.json
package.json
round-trip.mjs
self-test.mjs
serve-directory.mjs
spikes/web-bot-auth/README.md:132:Then **move `.keys/private.jwk` into your secret store** (never commit it); note the
spikes/web-bot-auth/README.md:134:`lib/profile.mjs`). _Done when:_ the private key is in your secret store.
spikes/web-bot-auth/README.md:175:npm run self-test -- --key /secure/path/private.jwk \
spikes/web-bot-auth/README.md:213:   npm run self-test -- --key .keys/private.jwk --url https://www.mywebaccess.co.uk/__wba-r2-test --raw
spikes/web-bot-auth/README.md:227:npm run self-test -- --key .keys/private.jwk --url https://<a-myvision-event-url> --raw
spikes/web-bot-auth/README.md:248:rm -rf .k ...
````

## 6. Bash

````bash
cd $REPO
sed -n 30,45p spikes/web-bot-auth/01-generate-keys.mjs; grep -n "generate\|import" spikes/web-bot-auth/round-trip.mjs | head; sed -n 125,136p spikes/web-bot-auth/README.md; sed -n 205,215p spikes/web-bot-auth/README.md; sed -n 240,250p spikes/web-bot-auth/README.md; grep -rln "cdp\|transport" src/commands src/reporters src/lib | head
````

Output (truncated):

````text
  const kid = await jwkToKeyID(publicJwk, helpers.WEBCRYPTO_SHA256, helpers.BASE64URL_DECODE);
  for (const jwk of [publicJwk, privateJwk]) {
    // No `alg`: Cloudflare's workerd importKey requires the RFC 8037 value "EdDSA" (or no
    // alg) for Ed25519 and throws DOMDataError on "Ed25519"; omitting it keeps the key
    // portable (matches the RFC 9421 reference key shape). Node's WebCrypto is lenient.
    jwk.use = 'sig';
    jwk.kid = kid;
  }

  if (persist) {
    await mkdir(KEYS_DIR, { recursive: true });
    await writeFile(join(KEYS_DIR, 'private.jwk'), `${JSON.stringify(privateJwk, null, 2)}\n`, { mode: 0o600 });
    await writeFile(join(KEYS_DIR, 'public.jwk'), `${JSON.stringify(publicJwk, null, 2)}\n`);
  }
  return { publicJwk, privateJwk, kid };
20:import { writeFile, mkdir ...
````

## 7. Bash

````bash
cd $REPO
grep -n "generateKeys(" spikes/web-bot-auth/*.mjs; grep -n "persist" spikes/web-bot-auth/01-generate-keys.mjs | head -3; grep -n "cdp\|transport" src/lib/context.mjs src/lib/logger.mjs | head -5
echo "== VERD"; sed -n 375,385p src/commands/summarize.mjs; sed -n 100,118p src/lib/fs-utils.mjs; grep -n "not exposed\|re-fetches\|rewrites" src/data/README.md; grep -n "throw" scripts/*act* 2>/dev/null | head; ls scripts | grep -i act
echo "== CAP-22"; sed -n 18p src/lib/urls.mjs; ls docs/adr | grep 0012
echo "== REPA-11"; sed -n 243,246p CHANGELOG.md; grep -c "occurrences" src/reporters/html.mjs src/reporters/markdown.mjs; sed -n 218,226p src/reporters/report-builder-starter.mjs
echo "== REPA-16"; sed -n 39p docs/adr/0008-pluggable-reporters.md; sed -n 60,72p src/reporters/index.mjs
````

Output (truncated):

````text
spikes/web-bot-auth/01-generate-keys.mjs:26:export async function generateKeys({ persist = true } = {}) {
spikes/web-bot-auth/01-generate-keys.mjs:49:  const { kid } = await generateKeys();
spikes/web-bot-auth/round-trip.mjs:46:  const { publicJwk, privateJwk } = await generateKeys({ persist: false });
spikes/web-bot-auth/round-trip.mjs:71:  const { publicJwk, privateJwk } = await generateKeys({ persist: true });
spikes/web-bot-auth/serve-directory.mjs:62:  ({ publicJwk, privateJwk } = await generateKeys({ persist: false }));
23: * @param {{ persist?: boolean }} [opts]
26:export async function generateKeys({ persist = true } = {}) {
40:  if (persist) {
src/lib/logger.mjs:74:    // mode hides them via the transport ignore list below — they are for
src/lib/logger.mjs:88:      pino.transport( ...
````

## 8. Bash

````bash
cd $REPO
sed -n 25,45p src/data/README.md; grep -rn "parseImplementationReport" --include=*.mjs . 2>/dev/null | grep -v node_modules | head -4
grep -n "nodesCount\|occurrence" src/reporters/html.mjs src/reporters/markdown.mjs | head
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e '
const axe=require("./node_modules/axe-core"); const map=require("./src/data/act-rule-map.json");
let diff=0,missing=0; for(const r of axe.getRules()){const a=(r.actIds||[]).slice().sort().join(","); const m=map[r.ruleId]; if(!m){ if(a) missing++; continue;} const b=m.slice().sort().join(","); if(a!==b){diff++; if(["aria-valid-attr-value","label","audio-caption","th-has-data-cells","identical-links-same-purpose"].includes(r.ruleId)) console.log(r.ruleId,"axe=",a,"map=",b);}}
console.log("differ",diff,"missing-with-actIds",missing,"axe",axe.version,"meta",JSON.stringify(map._meta||"").slice(0,120));'
````

Output (truncated):

````text
are — they live in `violation.tags` as `wcagXXX` (e.g. `wcag111` → SC
1.1.1) and are parsed at runtime by `src/lib/axe-utils.mjs`'s
`withActAndWcagMetadata` helper. ACT IDs have no such runtime source, so
the mapping is curated statically.

### Regenerating

```sh
node scripts/refresh-rule-maps.mjs
```

The script reads the installed `@axe-core/playwright`'s axe-core version,
re-fetches the implementation report, and rewrites this file with a
fresh `_meta.generatedAt` timestamp. Run it whenever the installed
axe-core version in `package-lock.json` changes meaningfully.

### What happens if the map is missing or empty

`src/commands/summarize.mjs` loads this file via `readJsonMaybe` with a
`{}` fallback. An empty or missing map causes every grouped finding to
carry `actRuleIds: []`; the sca ...
````

## 9. Bash

````bash
cd $REPO
grep -n "throw\|function parseImplementationReport\|TODO\|stub" scripts/refresh-rule-maps.mjs | head; sed -n 18,24p src/data/README.md; grep -n "T-Q\|act-rule-map\|refresh-rule-maps" TODO.md CHANGELOG.md | head -5; grep -n "actIds\|getRules" -r src | head -3
````

Output (truncated):

````text
59:    throw new Error(`ACT implementation report fetch failed: ${res.status} ${res.statusText}`);
65:    throw new Error(
103: * heuristic extraction; throws if the page shape is unrecognisable so the
107: * @throws {Error} Always — this function is a stub; see module-level comment
110:function parseImplementationReport(_html) {
124:  throw new Error(
125:    'ACT implementation report parser is a stub. See scripts/refresh-rule-maps.mjs ' +
  implementation report listed as implemented by axe-core at seed time.
  Expanding to full coverage is tracked as a follow-up in
  `CHANGELOG.md [Unreleased]`.

### Why this file exists

ACT rule IDs are **not** exposed by axe-core at runtime. WCAG SC numbers
CHANGELOG.md:402:- `src/data/act-rule-map.json` exhaustive coverage — the initial seed covers ...
````

## 10. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && npm audit --omit=dev --json 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['metadata']['vulnerabilities']); print({k:v['severity'] for k,v in d['vulnerabilities'].items() if v['severity'] in ('high','critical')})"; sed -n 1,12p .github/workflows/ci.yml; grep -n "codeql\|gitleaks" -ri .github | head -2
````

Output (truncated):

````text
{'info': 0, 'low': 0, 'moderate': 13, 'high': 7, 'critical': 0, 'total': 20}
{'adm-zip': 'high', 'brace-expansion': 'high', 'browserslist': 'high', 'fast-uri': 'high', 'generative-bayesian-network': 'high', 'ip-address': 'high', 'nanoid': 'high'}
# ============================================================================
# CI — runs on every push and pull request to main.
#
# Enforces the gate from ADR-0001: `npm run lint && npm run typecheck &&
# npm test` must be green on every commit. Also includes a non-blocking
# `npm audit --production` step. Coverage floors (70% src/lib, 50%
# src/commands) are an ADR-0001 target checked via `npm run test:coverage`;
# automated CI enforcement is an open board item.
#
# Node version follows .nvmrc (currently 22); CI uses the exact same minor.
# == ...
````

## 11. Bash

````bash
cd $REPO; sed -n 248,262p src/lib/context.mjs; grep -n "logger\.\|console\." src/lib/browser.mjs src/lib/browser-engine.mjs | head; grep -n "visible-browser\|disclos" docs/adr/0021*.md docs/adr/0020*.md | head -5; grep -n "user-data-dir\|profile" docs/guides/config*.md docs/adr/0020*.md | head
````

Output (truncated):

````text
  // ANCHOR: RequirePlaywrightEffective — a browser command states its need via
  // options.requirePlaywright. For a TRANSPORT-AWARE command (standalone scan /
  // scan-processes, which attach externally under CDP), the local ms-playwright
  // binary check is suppressed when config/env selects an external browser (CDP)
  // or the patchright engine — `browserNeedsLocalBinary` reads config + env
  // (WCAG_EM_CDP_ENDPOINT). `discover` and `audit` are NOT transport-aware:
  // `discover` always launches a local browser (Crawlee), so they need the
  // binary regardless of `scan.browser`. The EFFECTIVE value is persisted below
  // so a later ensurePreflight re-runs the same check set.
  const requirePlaywright =
    options.requirePlaywright === true &&
    (options.browserTransportAware  ...
````

## 12. Bash

````bash
cd $REPO; grep -n -i "attach" docs/adr/0021*.md | head -5; grep -n -i "remote-debugging\|user-data" docs/guides/config-guide.md docs/adr/0020*.md | head
````

Output (truncated):

````text
24:browser and the scanner attaches over CDP to ride that session.
149:  candour (visible-browser attach / signed identity; still local; still no AI).
````

## 13. Bash

````bash
cd $REPO; grep -n -i "portal\|report-builder\|amend\|superseded\|update" docs/adr/0008-pluggable-reporters.md | head; grep -n "ADR-0008\|0008" docs/adr/*.md | grep -v "^docs/adr/0008" | head -5
````

Output (truncated):

````text
57:under the same ADR-0012 lens. **Update:** `./commands/*` and `./lib/*`
179:**Update (v1.1.0):** Incomplete results now flow through
docs/adr/0009-earl-jsonld-output.md:9:  when `includePasses` is on), ADR-0008 (pluggable reporter runtime —
docs/adr/0009-earl-jsonld-output.md:101:through `sortFindings` (ADR-0008 §4) so the `@graph` array order is
docs/adr/0009-earl-jsonld-output.md:127:| `inapplicable` | `earl:inapplicable` | **Never emitted by the reporter** (volume guard, ADR-0008 §6)                  |
docs/adr/0011-v1-release-boundary.md:7:  ADR-0008 (pluggable reporters — sealed registry),
docs/adr/0011-v1-release-boundary.md:32:| **Reporters**         | Five built-in reporters (`json`, `markdown`, `html`, `earl-jsonld`, `junit`) behind a module-private registry (ADR-0008). Determin ...
````
