# Probe record: verify:B05

Role: packet verifier. Findings: TEST-06, TEST-07, TEST-08, TEST-10, OPS-02, OPS-03, OPS-07, OPS-08, OPS-09, OPS-11, OPS-13, TEST-09

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
cd $REPO; R=.; sed -n 1,40p .github/workflows/ci.yml; ls -a .github; ls renovate.json .renovaterc* 2>&1; git tag; git log --oneline --no-merges bf14f68..HEAD | wc -l; git show bf14f68 --stat | head -5; sed -n 45,65p src/lib/version.mjs; grep -n '"version"\|"prepare"\|"lint"\|"test\|"audit"\|"exports"\|"files"' package.json
````

Output (truncated):

````text
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
# ============================================================================

name: ci

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref ...
````

## 2. Bash

````bash
cd $REPO; sed -n 55,90p docs/adr/0015-publish-and-deprecation-policy.md; echo ----; grep -n 'checkJs\|eslint-config-prettier\|emitDeclarationOnly\|SIGINT\|stdout' docs/adr/0001-project-conventions.md CONTRIBUTING.md; grep -n checkJs jsconfig.json; grep -rn 'prettier' eslint.config.mjs package.json | head; sed -n 38,46p CONTRIBUTING.md; sed -n 205,230p bin/wcag-em.mjs; grep -rn 'process.stdout\|console.log' src bin | head
````

Output (truncated):

````text
deprecated fields.

**Existing example:** `reporting.markdownReport` was deprecated in
Layer 4 (replaced by `reporting.reporters: ['markdown']`). The
runtime emits `warnLegacyAliasResolved` when the old field is
present. It will be removed in the first post-v1.0 minor release.

### Publish flow

```
npm version <major|minor|patch>   # bumps package.json + package-lock.json + git tag
npm run format:check && npm run lint && npm run typecheck && npm test
npm pack --dry-run                # verify tarball contents against files[] whitelist
npm publish --dry-run             # smoke-check registry interaction
npm publish                       # publish to npm
```

`npm version` creates the git tag automatically. The tag triggers the
CI workflow, which runs the full gate as a final safety net.

* ...
````

## 3. Bash

````bash
cd $REPO; sed -n 40,50p docs/adr/0003-commander-cli.md; sed -n 45,55p docs/adr/0011-v1-release-boundary.md; sed -n 30,45p package.json; grep -rn 'file://\${process.argv\[1\]}' src scripts | head; sed -n 700,720p src/commands/summarize.mjs; sed -n 375,385p src/commands/summarize.mjs; grep -n 'rootUrl\|startUrl' configs/*.json | head -20; grep -n 'legacy-events\|stage script\|npm run discover\|npm run audit' TODO.md CHANGELOG.md README.md docs -r | head -20
````

Output (truncated):

````text
## Consequences

- The npm scripts in `package.json` (`npm run discover` etc.) still work but
  are thin wrappers over `node src/commands/X.mjs`; they remain through v1.1
  and may be removed in v1.2.
- Programmatic use via `import { run } from 'wcag-em-a11y-toolkit/commands/X'`
  is supported, unstable until v2.0 per ADR-0013.

## Alternatives considered

### Stability guarantees

- **CLI surface**: stable. Subcommands, flags, exit codes, and artefact
  file names are covered by semver.
- **Programmatic API** (`src/index.mjs`): exposed but **unstable until
  v2.0** (ADR-0012). Breaking changes to function signatures may occur
  in minor releases. The CLI is the blessed surface for end-users.
- **Deep imports** (`./commands/*`, `./lib/*`): removed from
  `package.json` exports in ADR-0014. ...
````

## 4. Bash

````bash
cd $REPO; sed -n 185,200p src/lib/config.mjs; sed -n 225,240p src/lib/context.mjs; grep -n 'argv\|parseArgs' src/lib/context.mjs src/lib/config.mjs | head; S=$SCRATCH/wf2/verify-B05; mkdir -p "$S/dir with space"; printf 'console.log(import.meta.url, process.argv[1], import.meta.url === `file://${process.argv[1]}` ? "RAN" : "NOOP");\n' > "$S/dir with space/g.mjs"; cp "$S/dir with space/g.mjs" "$S/g.mjs"; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node "$S/dir with space/g.mjs"; node "$S/g.mjs"; LC_ALL=C grep -c $'\x00' src/reporters/portal-export.mjs; file src/reporters/portal-export.mjs; sed -n 165,172p docs/guides/config-guide.md | grep -n screenshotQuality; grep -n -A3 screenshotQuality schemas/config.schema.json | head; sed -n 44,48p TODO.md; grep -n 'with-deps\|playwright install' docs/guides/integrations.md .github/workflows/ci.yml; grep -n 'reporters' configs/<local-config>.json 2>&1 | head -3; git ls-files configs
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
  // `defineHidden` (non-enumerable) so it doesn't leak into JSON-serialised
  // artef ...
````

## 5. Bash

````bash
cd $REPO; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; npm view wcag-em-a11y-toolkit version 2>&1 | head -2; npm view wcag-em version 2>&1 | head -2; sed -n 28,40p README.md; ls docs/adr | grep -E '001[34]'; grep -rn browserTransportAware src/index.mjs src/lib/context.mjs src/types/index.d.ts | head -5; grep -n 'Changed\|^### \|^## ' CHANGELOG.md | head -20; grep -n 'markdownReport' src/commands/summarize.mjs schemas/config.schema.json | head; grep -rn 'Windows\|win32' README.md docs/guides | head -5; python3 -c "d=open('src/reporters/portal-export.mjs','rb').read();print(d.count(b'\x00'),d.index(b'\x00'))"
````

Output (truncated):

````text
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/wcag-em-a11y-toolkit - Not found
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/wcag-em - Not found
- **Node.js ≥ 22.11.0** — the toolkit requires a current Node.js release.
  Check with `node -v`.

## Quick start

```bash
npm install wcag-em-a11y-toolkit
npx playwright install chromium
npx wcag-em audit --config configs/example-site.json
```

## Documentation

0013-crawlee-localhost-investigation.md
0014-packaging-decisions.md
src/lib/context.mjs:153: * @property {boolean} [browserTransportAware] - When true, the local-Chromium
src/lib/context.mjs:259:    (options.browserTransportAware ? browserNeedsLocalBinary(loaded.config, process.env) : true);
7:## [Unreleased]
9:### Changed
70:# ...
````

## 6. Bash

````bash
cd $SCRATCH/review; grep -in 'NUL\|dependabot\|legacy-events\|\.pathname\|windows\|space' round1-index.txt | cut -c1-220
````

Output (truncated):

````text
13:VERD-13 | low | new | robustness | act-rule-map.json is loaded through URL.pathname, so ACT enrichment is silently lost when the install path has a space or non-ASCII characters, or on Windows | src/commands/summarize
40:PROC-06 | high | new | correctness | The blank-submit/partial-submit default submit selector plus .first() clicks the first submit button in the DOM (typically header search), silently auditing the wrong page | src/co
89:SEC-09 | medium | new | ci-ops | Supply-chain and CI hardening gaps: 20 production advisories (7 high) are now invisible because the audit is non-blocking, and there is no Dependabot/CodeQL/secret scanning or SHA-pinn
````

## 7. Bash

````bash
cd $SCRATCH; grep -rl 'OPS-12\|E2E-04' . 2>/dev/null | head; grep -rho '"id": *"\(OPS-12\|E2E-04\)"[^}]\{0,200\}' . 2>/dev/null | head -3
````

Output (truncated):

````text
(Bash completed with no output)
````
