// @ts-nocheck
/**
 * Phase-1 OPS HELPER (not toolkit code) — sign a request and send it to a Web Bot
 * Auth verifier endpoint, printing the verdict. This is "Step 2 / wire self-test"
 * of the Phase-1 runbook: the first point you can confirm a real verifier accepts
 * the signature format, BEFORE hosting a directory.
 *
 * Two modes:
 *   - Format check (default): signs with the RFC 9421 test key, which Cloudflare's
 *     verify endpoint (/v0/api/verify) recognises directly — proves our wire format
 *     is accepted with no hosted directory.
 *   - Live identity check: pass --key <prod.jwk> once the directory is hosted; the
 *     verifier fetches your Signature-Agent directory to get the key.
 *
 * Usage:
 *   node --no-warnings self-test.mjs
 *   node --no-warnings self-test.mjs --url https://crawltest.com/cdn-cgi/web-bot-auth
 *   node --no-warnings self-test.mjs --key /secure/path/private.jwk --directory https://auditor.mywebaccess.co.uk/.well-known/http-message-signatures-directory
 */
import { readFile } from 'node:fs/promises';
import { signatureHeaders } from 'web-bot-auth';
import { signerFromJWK } from 'web-bot-auth/crypto';
import { RFC_9421_ED25519_TEST_KEY, DIRECTORY_URL, EXPIRES_WINDOW_MS } from './lib/profile.mjs';

/** Read `--name value` from argv. @param {string} name @param {string} [def] */
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : def;
}

const url = arg('url', 'https://http-message-signatures-example.research.cloudflare.com/v0/api/verify');
const directoryUrl = arg('directory', DIRECTORY_URL);
const keyPath = arg('key');

let jwk;
if (keyPath) {
  jwk = JSON.parse(await readFile(keyPath, 'utf8'));
} else {
  jwk = RFC_9421_ED25519_TEST_KEY;
  console.log('• Using the RFC 9421 test key (the debug endpoint recognises it). Pass --key for your production key once the directory is hosted.\n');
}

const created = new Date();
const expires = new Date(created.getTime() + EXPIRES_WINDOW_MS);
const signatureAgent = JSON.stringify(directoryUrl);
const request = new Request(url, { headers: { 'Signature-Agent': signatureAgent } });
const signed = await signatureHeaders(request, await signerFromJWK(jwk), { created, expires });

console.log(`→ GET ${url}`);
console.log(`  Signature-Agent: ${directoryUrl}`);
console.log(`  Signature-Input: ${signed['Signature-Input']}`);
console.log('');

try {
  const resp = await fetch(url, {
    headers: { 'Signature-Agent': signatureAgent, ...signed },
  });
  const body = await resp.text();
  const ct = resp.headers.get('content-type') || '';
  console.log(`← ${resp.status} ${resp.statusText}  (${ct.split(';')[0] || 'no content-type'})`);

  const verifiedHeader = resp.headers.get('x-signature-verified') ?? resp.headers.get('signature-verified');
  if (verifiedHeader != null) console.log(`  verified header: ${verifiedHeader}`);

  // Cloudflare's /v0/api/verify returns plain text: "valid" | "invalid: <reason>" |
  // "neutral" (no Signature header seen). Other endpoints (e.g. crawltest) may return
  // HTML, so fall back to reading a verdict from the page.
  const trimmed = body.trim();
  const lower = trimmed.toLowerCase();
  const isHtml = /html/i.test(ct) || /^\s*<(?:!doctype|html)/i.test(trimmed);

  let verdict;
  let detail = '';
  if (lower === 'valid' || lower.startsWith('valid')) {
    verdict = 'VERIFIED';
  } else if (lower.startsWith('invalid')) {
    verdict = 'NOT VERIFIED';
    detail = trimmed;
  } else if (lower === 'neutral') {
    verdict = 'NEUTRAL — the verifier saw no Signature header (did the request reach it intact?)';
  } else if (isHtml) {
    const stripped = body
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ');
    const headerClass = (stripped.match(/<header[^>]*class="([^"]*)"/i) || [])[1] || '';
    const text = stripped.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const success = /\bsuccess\b/i.test(headerClass) || /\b(verified|valid signature)\b/i.test(text);
    const failure = /\bfailure\b/i.test(headerClass) || /\b(not verified|invalid signature|verification failed)\b/i.test(text);
    verdict = success && !failure ? 'VERIFIED' : failure && !success ? 'NOT VERIFIED' : 'UNCLEAR';
    console.log(`  page text: ${text.slice(0, 300)}`);
  } else {
    verdict = /invalid|not verified|fail|error/.test(lower) ? 'NOT VERIFIED' : /valid|verified|pass/.test(lower) ? 'VERIFIED' : 'UNCLEAR';
    console.log(`  response body: ${trimmed.slice(0, 300)}`);
  }

  console.log('');
  console.log(`VERDICT: ${verdict}${detail ? ` — ${detail}` : ''}${resp.ok ? '' : ` (HTTP ${resp.status})`}`);
  if (verdict === 'UNCLEAR') console.log('(Unrecognised response — paste it, or try --url https://crawltest.com/cdn-cgi/web-bot-auth.)');
  process.exit(verdict.startsWith('VERIFIED') ? 0 : 1);
} catch (err) {
  console.error(`network error reaching ${url}: ${err.message}`);
  console.error('(If this environment has no outbound access, run this from your own machine.)');
  process.exit(2);
}
