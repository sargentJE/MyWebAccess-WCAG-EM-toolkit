// @ts-nocheck
/**
 * Phase-1 OPS HELPER (not toolkit code) — sign a request and send it to a Web Bot
 * Auth verifier endpoint, printing the verdict. This is "Step 2 / wire self-test"
 * of the Phase-1 runbook: the first point you can confirm a real verifier accepts
 * the signature format, BEFORE hosting a directory.
 *
 * Two modes:
 *   - Format check (default): signs with the RFC 9421 test key, which Cloudflare's
 *     debug endpoint recognises directly — proves our wire format is accepted with
 *     no hosted directory.
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

const url = arg('url', 'https://http-message-signatures-example.research.cloudflare.com/debug');
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

  // The Cloudflare /debug endpoint returns an HTML page that shows the result by
  // styling a <header class="success|failure">. Extract the verdict from that rather
  // than dumping raw HTML/CSS (whose class *names* would confuse a naive grep).
  const isHtml = /html/i.test(ct) || /^\s*<(?:!doctype|html)/i.test(body);
  let verdict;
  if (isHtml) {
    const stripped = body
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ');
    const headerClass = (stripped.match(/<header[^>]*class="([^"]*)"/i) || [])[1] || '';
    const text = stripped.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const success = /\bsuccess\b/i.test(headerClass) || /\b(verified|valid signature|signature is valid)\b/i.test(text);
    const failure = /\bfailure\b/i.test(headerClass) || /\b(not verified|invalid signature|verification failed)\b/i.test(text);
    verdict = success && !failure ? 'VERIFIED' : failure && !success ? 'NOT VERIFIED' : 'UNCLEAR';
    console.log(`  page result class: ${headerClass || '(none found)'}`);
    console.log(`  page text: ${text.slice(0, 500)}`);
  } else {
    console.log(body.slice(0, 1200));
    const t = body.toLowerCase();
    verdict = /not verified|invalid|fail|error/.test(t) ? 'NOT VERIFIED' : /verified|valid|"?ok"?|pass/.test(t) ? 'VERIFIED' : 'UNCLEAR';
  }

  console.log('');
  console.log(`VERDICT: ${verdict}${resp.ok ? '' : ` (HTTP ${resp.status})`}`);
  if (verdict === 'UNCLEAR') console.log('(Could not parse a verdict — paste the output and the maintainer can read it, or try --url https://crawltest.com/cdn-cgi/web-bot-auth.)');
  process.exit(verdict === 'NOT VERIFIED' || !resp.ok ? 1 : 0);
} catch (err) {
  console.error(`network error reaching ${url}: ${err.message}`);
  console.error('(If this environment has no outbound access, run this from your own machine.)');
  process.exit(2);
}
