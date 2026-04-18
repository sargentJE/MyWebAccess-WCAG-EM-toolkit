import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from './args.mjs';

const DEFAULTS = {
  scope: {
    mode: 'same-hostname',
    allowedHosts: [],
  },
  crawl: {
    maxPages: 80,
    maxConcurrency: 5,
    requestTimeoutSecs: 90,
    sitemapSeeding: {
      enabled: true,
      urls: [],
      commonPaths: ['/sitemap.xml', '/sitemap_index.xml'],
      maxUrls: 500,
    },
    excludeUrlPatterns: [],
  },
  discovery: {
    captureH1: true,
    captureCanonical: true,
    captureForms: true,
    captureLandmarks: true,
    captureSearchInputs: true,
  },
  sample: {
    structuredManual: [],
    autoSuggest: {
      enabled: true,
      perCluster: 1,
      preferTypes: ['homepage', 'form-or-contact', 'policy', 'listing', 'detail', 'content'],
    },
    randomPercentOfStructured: 0.1,
    minRandomPages: 2,
    randomSeed: 1,
    smallSiteSupplementaryScanThreshold: 50,
  },
  scan: {
    viewport: { width: 1440, height: 900 },
    waitUntil: 'load',
    timeoutMs: 60000,
    retries: 1,
    fullPageScreenshots: true,
    axe: {
      include: [],
      exclude: [],
      withRules: [],
      withTags: [],
      runOnly: null,
    },
  },
  reporting: {
    groupBestPracticeSeparately: true,
    markdownReport: true,
  },
  processes: [],
};

export async function loadConfig() {
  const args = parseArgs();
  const configPath = args.config || 'configs/example-site.json';
  const resolved = path.resolve(configPath);
  const raw = await fs.readFile(resolved, 'utf8');
  const config = deepMerge(DEFAULTS, JSON.parse(raw));
  validateConfig(config, resolved);
  return { config, configPath: resolved, args };
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (typeof base !== 'object' || typeof override !== 'object' || !base || !override) {
    return override ?? base;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return out;
}

function validateConfig(config, configPath) {
  const requiredTopLevel = ['name', 'rootUrl', 'scope', 'crawl', 'sample', 'scan'];
  for (const key of requiredTopLevel) {
    if (!(key in config)) throw new Error(`Missing required config key "${key}" in ${configPath}`);
  }
  if (typeof config.name !== 'string' || config.name.trim() === '') {
    throw new Error(`name must be a non-empty string in ${configPath}`);
  }
  if (typeof config.rootUrl !== 'string' || !/^https?:\/\//.test(config.rootUrl)) {
    throw new Error(`rootUrl must be a full URL in ${configPath}`);
  }
  const supportedScopeModes = new Set(['same-hostname', 'same-origin', 'allowed-hosts']);
  if (!supportedScopeModes.has(config.scope.mode)) {
    throw new Error(`Unsupported scope.mode "${config.scope.mode}" in ${configPath}`);
  }
  if (!Array.isArray(config.sample.structuredManual)) {
    throw new Error(`sample.structuredManual must be an array in ${configPath}`);
  }
  if (typeof config.sample.randomSeed !== 'number') {
    throw new Error(`sample.randomSeed must be numeric in ${configPath}`);
  }
  if (!Array.isArray(config.processes)) {
    throw new Error(`processes must be an array in ${configPath}`);
  }
}
