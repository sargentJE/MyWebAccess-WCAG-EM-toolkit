import { normalizeUrl } from './urls.mjs';

export async function getSitemapSeeds(rootUrl, sitemapSeeding, scope) {
  if (!sitemapSeeding?.enabled) return [];

  const queue = [...new Set([...(sitemapSeeding.urls || []), ...((sitemapSeeding.commonPaths || []).map(p => new URL(p, rootUrl).toString()))])];
  const seenDocs = new Set();
  const foundUrls = new Set();
  const maxUrls = Number(sitemapSeeding.maxUrls ?? 500);

  while (queue.length > 0 && foundUrls.size < maxUrls) {
    const sitemapUrl = queue.shift();
    if (seenDocs.has(sitemapUrl)) continue;
    seenDocs.add(sitemapUrl);

    try {
      const res = await fetch(sitemapUrl, { redirect: 'follow' });
      if (!res.ok) continue;
      const text = await res.text();
      const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1].trim());
      for (const loc of locs) {
        if (/\.xml($|\?)/i.test(loc)) {
          if (!seenDocs.has(loc)) queue.push(loc);
          continue;
        }
        try {
          const normalized = normalizeUrl(loc);
          if (new URL(normalized).hostname === new URL(rootUrl).hostname || scope.mode === 'allowed-hosts') {
            foundUrls.add(normalized);
            if (foundUrls.size >= maxUrls) break;
          }
        } catch {
          // ignore malformed URLs
        }
      }
    } catch {
      // ignore sitemap fetch failures
    }
  }

  return [...foundUrls];
}
