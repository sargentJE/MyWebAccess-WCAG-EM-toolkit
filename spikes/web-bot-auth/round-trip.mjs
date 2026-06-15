// @ts-nocheck
/**
 * Orchestrator — the Phase-0 GATE. Runs the whole crypto round-trip IN-PROCESS
 * and offline:
 *
 *   constants ─▶ KAT (deterministic, independent) ─▶ keygen ─▶ build+sign
 *   directory ─▶ sign request ─▶ verify (independent + corroborating) ─▶
 *   directory verify ─▶ negative control.
 *
 * Exit 0 ⇔ every check passes. This is SELF-VERIFIED, NOT Cloudflare-validated:
 * it proves the library runs on Node 22 with our key material and emits
 * spec-conformant signatures (checked with Node crypto, independently of the
 * library). It does NOT prove Cloudflare interop — that is the Phase-1 gate.
 *
 * Usage:
 *   node --no-warnings round-trip.mjs              # full gate; exit 0 on PASS
 *   node --no-warnings round-trip.mjs --negative   # demo: a tampered signature is
 *                                                  # rejected (throws, exits non-zero)
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateKeys } from './01-generate-keys.mjs';
import { buildDirectory } from './02-build-directory.mjs';
import { signRequest } from './03-sign-request.mjs';
import { verify as wbaVerify } from 'web-bot-auth';
import { verifierFromJWK } from 'web-bot-auth/crypto';
import { unwrapSignature } from './lib/sigbase.mjs';
import {
  verifyConstants,
  runKAT,
  verifyRequestIndependent,
  verifyDivergentAuthority,
  verifyRequestCorroborating,
  verifyDirectory,
  negativeControl,
} from './04-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'out');

async function negativeDemo() {
  // Deliberately verify a tampered signature with NO catch, so it throws
  // /invalid signature/ and the process exits non-zero — visible proof the gate
  // is not vacuous (the same verifier that passes valid input rejects bad input).
  const { publicJwk, privateJwk } = await generateKeys({ persist: false });
  const art = await signRequest({ privateJwk });
  const sig = unwrapSignature(art.signed['Signature']);
  sig[0] ^= 0x01;
  const request = new Request(art.target, {
    headers: {
      'Signature-Agent': art.signatureAgentValue,
      Signature: `sig1=:${Buffer.from(sig).toString('base64')}:`,
      'Signature-Input': art.signed['Signature-Input'],
    },
  });
  console.log('negative-control demo — verifying a tampered signature (expected to throw):');
  await wbaVerify(request, await verifierFromJWK(publicJwk)); // throws → non-zero exit
}

async function main() {
  if (process.argv.includes('--negative')) {
    await negativeDemo();
    return; // not reached: negativeDemo throws
  }

  const results = [];
  results.push(verifyConstants());
  results.push(...(await runKAT()));

  const { publicJwk, privateJwk } = await generateKeys({ persist: true });
  const dir = await buildDirectory({ publicJwk, privateJwk, persist: true });
  const req = await signRequest({ privateJwk, persist: true });

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
  const failed = results.filter((r) => !r.pass);
  console.log('');
  if (failed.length) {
    console.log(`RESULT: FAIL — ${failed.length}/${results.length} checks failed. (self-verified gate)`);
    process.exit(1);
  }
  console.log(`RESULT: PASS — ${results.length}/${results.length} checks. SELF-VERIFIED, not Cloudflare-validated.`);
}

await main();
