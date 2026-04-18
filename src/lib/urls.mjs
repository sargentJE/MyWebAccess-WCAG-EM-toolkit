const TRACKING_PARAM_PATTERNS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_/i];

export function normalizeUrl(rawUrl, options = {}) {
  const url = new URL(rawUrl);
  url.hash = '';

  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = '';
  }

  if (options.removeTrackingParams !== false) {
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
        url.searchParams.delete(key);
      }
    }
  }

  const ordered = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = '';
  for (const [key, value] of ordered) url.searchParams.append(key, value);

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function fileSafeFromUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_');
}

export function firstPathSegment(urlString) {
  const url = new URL(urlString);
  return url.pathname.split('/').filter(Boolean)[0] ?? '(root)';
}

export function guessPageType(urlString) {
  const url = new URL(urlString);
  const segments = url.pathname.split('/').filter(Boolean);
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '') return 'homepage';
  if (/privacy|terms|cookies|policy|accessibility/i.test(pathname)) return 'policy';
  if (/contact|support|get-in-touch/i.test(pathname)) return 'form-or-contact';
  if (/search|results/i.test(pathname)) return 'search-or-results';
  if (/cart|basket|checkout|book|apply|register|signup|sign-up/i.test(pathname))
    return 'process-entry';
  if (
    (/blog|latest|news|articles/i.test(pathname) ||
      /our-work|portfolio|projects|case-studies/i.test(pathname)) &&
    segments.length === 1
  )
    return 'listing';
  if (segments.length >= 2) return 'detail';
  return 'content';
}

export function clusterKeyFor(urlString, pageType) {
  const seg = firstPathSegment(urlString);
  return `${pageType}::${seg}`;
}

export function guessProcessTypes({ url, formCount = 0, searchInputCount = 0 }) {
  const types = [];
  if (/contact|support/i.test(url) || formCount > 0) types.push('form');
  if (/search|results/i.test(url) || searchInputCount > 0) types.push('search');
  if (/checkout|basket|cart|book|register|apply/i.test(url)) types.push('critical-process');
  return [...new Set(types)];
}

export function selectorComponentHint(selector = '') {
  if (!selector) return 'unknown';
  const first = selector.split(' | ')[0].trim();
  if (first.startsWith('#')) return `id:${first.slice(1).split(/[ >.:[]/, 1)[0]}`;
  if (first.startsWith('.')) return `class:${first.slice(1).split(/[ >.:[]/, 1)[0]}`;
  return `selector:${first.split(/[ >]/, 1)[0]}`;
}

export function urlAllowedByScope(targetUrl, rootUrl, scope) {
  const target = new URL(targetUrl);
  const root = new URL(rootUrl);

  if (scope.mode === 'same-origin') return target.origin === root.origin;
  if (scope.mode === 'same-hostname') return target.hostname === root.hostname;
  if (scope.mode === 'allowed-hosts') {
    const allowedHosts = new Set([root.hostname, ...(scope.allowedHosts || [])]);
    return allowedHosts.has(target.hostname);
  }
  return false;
}

export function urlExcludedByPatterns(urlString, patterns = []) {
  return patterns.some((pattern) => new RegExp(pattern).test(urlString));
}
