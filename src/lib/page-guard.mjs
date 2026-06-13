// @ts-check
/**
 * @file Classify whether a fetched page is real, auditable content.
 * @module lib/page-guard
 *
 * @description
 * Decides, from a navigation response plus light page signals, whether a
 * page-view is real content (`ok`), a bot/WAF challenge interstitial
 * (`challenge`), or an empty document (`empty`). The scan and process stages
 * use the verdict to skip axe + screenshot on non-`ok` views and record a
 * `pageOutcome` instead of false findings (E1).
 *
 * Design rules (the original defect was scanning Cloudflare challenge pages and
 * an `about:blank` as real content):
 *   - **Header/status are PRIMARY.** Cloudflare's own `cf-mitigated` response
 *     header is authoritative — it is set only when CF actually
 *     challenged/blocked the request — so it needs no host allowlist.
 *   - **Title/content are CORROBORATING only.** A real article may legitimately
 *     contain "just a moment"; an interstitial title is never sufficient alone.
 *   - **The weaker heuristic is host-allowlisted.** Title-plus-status detection
 *     applies only to hosts the operator expects to be challenge-protected, so
 *     an unknown host defaults to `ok` rather than false-excluding real content.
 *   - **Empty is content-thinness, never status-only.** A 404/500 that still
 *     serves real markup stays `ok`; only a genuinely empty body is `empty`.
 *
 * Pure function; classification is decoupled from Playwright (callers extract
 * primitives from the Response) so it is unit-testable without a browser.
 *
 * @see docs/reviews/2026-06-epics-E1-E7.md (E1 step 1a, §0a, §5.6)
 */

// SECTION: Public API

/**
 * @typedef {'ok' | 'challenge' | 'empty'} PageOutcomeKind
 * @typedef {{ outcome: PageOutcomeKind, reason: string }} PageOutcome
 */

/**
 * Classify a successfully-navigated page-view.
 *
 * Note: a *thrown* navigation (network failure, timeout) never reaches here —
 * the scan stage records that as an `error` on the result. This function only
 * judges pages whose `goto` resolved.
 *
 * @param {object} signals
 * @param {number} [signals.status] - HTTP status from the navigation response.
 * @param {Record<string, any>} [signals.headers] - Response headers (any case).
 * @param {string} [signals.title] - Document title.
 * @param {string} [signals.bodyText] - Rendered body text (innerText).
 * @param {string} [signals.url] - The page's current (final) URL.
 * @param {string[]} [signals.challengeHosts] - Hosts to apply the weaker
 *   title+status heuristic to (typically the audited site's host). The
 *   authoritative `cf-mitigated` check ignores this list.
 * @returns {PageOutcome}
 */
export function classifyPageOutcome({
  status,
  headers = {},
  title = '',
  bodyText = '',
  url = '',
  challengeHosts = [],
} = {}) {
  const lcHeaders = lowerKeys(headers);
  const u = String(url);

  // Authoritative: Cloudflare's mitigation header. Checked first (and without a
  // host allowlist) because a challenge interstitial may itself be thin, and CF
  // only emits this header when it genuinely intervened.
  if (typeof lcHeaders['cf-mitigated'] === 'string') {
    return { outcome: 'challenge', reason: 'cf-mitigated response header present' };
  }

  // Empty document — about:blank or no rendered body. The navigation resolved
  // but there is nothing to audit. Content-thinness only, never status-only.
  if (u === 'about:blank' || String(bodyText).trim().length === 0) {
    return { outcome: 'empty', reason: 'document had no rendered body content' };
  }

  // Weaker, host-allowlisted heuristic for interstitials that do not set
  // cf-mitigated: an interstitial title CORROBORATED by a challenge-class
  // status or a cf-ray header. Title alone is never sufficient.
  const host = hostOf(u);
  if (host && challengeHosts.includes(host)) {
    const interstitialTitle = INTERSTITIAL_TITLE.test(String(title));
    const challengeStatus = status === 403 || status === 429 || status === 503;
    const cfRay = typeof lcHeaders['cf-ray'] === 'string';
    if (interstitialTitle && (challengeStatus || cfRay)) {
      return {
        outcome: 'challenge',
        reason: `interstitial title corroborated by ${
          challengeStatus ? `status ${status}` : 'cf-ray header'
        } on ${host}`,
      };
    }
  }

  return { outcome: 'ok', reason: 'real content' };
}

/**
 * Re-check predicate for the §0a wait-for-auto-solve path: after a bounded wait
 * for a managed challenge to clear, decide whether the page NOW shows real
 * content. Because we already know the page WAS a challenge, evidence rules are
 * looser than initial detection — a persistent interstitial title (merely
 * corroborating in {@link classifyPageOutcome}) is here sufficient to conclude
 * the challenge has NOT cleared. Judged from page state only: a managed
 * challenge auto-navigates client-side, so the original response headers are
 * stale by this point.
 *
 * @param {{ title?: string, bodyText?: string }} signals
 * @returns {boolean} True if the page looks like real, auditable content now.
 */
export function challengeCleared({ title = '', bodyText = '' } = {}) {
  if (INTERSTITIAL_TITLE.test(String(title))) return false;
  if (String(bodyText).trim().length === 0) return false;
  return true;
}

/**
 * Compute the challenge-detection host allowlist from config: the audited site's
 * host (always) plus any extra `scan.challenge.hosts`. Shared by the scan and
 * process write-sites so they classify identically. The authoritative
 * `cf-mitigated` check ignores this list.
 *
 * @param {Record<string, any>} config
 * @returns {string[]}
 */
export function challengeHostsFor(config) {
  let rootHost = '';
  try {
    rootHost = new URL(config?.rootUrl).host.toLowerCase();
  } catch {
    rootHost = '';
  }
  const extra = Array.isArray(config?.scan?.challenge?.hosts) ? config.scan.challenge.hosts : [];
  return [rootHost, ...extra].filter(Boolean);
}

// SECTION: Internal helpers

// Known bot-challenge interstitial titles (Cloudflare, AWS WAF, generic).
// Corroborating signal only — never used without a header/status corroborator.
const INTERSTITIAL_TITLE =
  /just a moment|attention required|checking your browser|verifying you are human|please wait/i;

/**
 * Lower-case a header map's keys so lookups are case-insensitive.
 *
 * @param {Record<string, any>} obj
 * @returns {Record<string, any>}
 */
function lowerKeys(obj) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) out[k.toLowerCase()] = v;
  return out;
}

/**
 * Extract the lower-cased host from a URL, or '' if it cannot be parsed.
 *
 * @param {string} url
 * @returns {string}
 */
function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}
