import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { ensureDir, writeJson, writeText } from './lib/fs-utils.mjs';
import { normalizeUrl } from './lib/urls.mjs';
import { seededSample, unique } from './lib/sample-utils.mjs';

const { config } = await loadConfig();
const inventoryDir = await ensureDir('output', 'inventory');

const inventory = JSON.parse(await fs.readFile(path.join(inventoryDir, 'inventory.json'), 'utf8'));
const pageClusters = JSON.parse(await fs.readFile(path.join(inventoryDir, 'page-clusters.json'), 'utf8'));
const allUrls = inventory.map(item => normalizeUrl(item.url));

const manual = unique((config.sample.structuredManual || []).map(url => normalizeUrl(url)));
const preferredTypes = config.sample.autoSuggest.preferTypes || [];
const suggested = [];
if (config.sample.autoSuggest.enabled) {
  for (const type of preferredTypes) {
    const matchingClusters = pageClusters.filter(cluster => cluster.pageType === type);
    for (const cluster of matchingClusters.slice(0, config.sample.autoSuggest.perCluster || 1)) {
      suggested.push(cluster.representativeUrl);
    }
  }
}

const structured = unique([...manual, ...suggested]);
const structuredMissingFromInventory = structured.filter(url => !allUrls.includes(url));
const randomPool = allUrls.filter(url => !structured.includes(url));

const randomPercent = Number(config.sample.randomPercentOfStructured ?? 0.10);
const minRandomPages = Number(config.sample.minRandomPages ?? 2);
const randomSeed = Number(config.sample.randomSeed ?? 1);
const desiredRandomCount = Math.max(minRandomPages, Math.ceil(structured.length * randomPercent));
const randomSample = seededSample(randomPool, desiredRandomCount, randomSeed);

const processExpansion = [];
for (const processDef of config.processes ?? []) {
  const startUrl = processDef.startUrl ? normalizeUrl(processDef.startUrl) : null;
  if (processDef.forceInclude === true && startUrl) processExpansion.push(startUrl);
  if (startUrl && structured.includes(startUrl)) processExpansion.push(startUrl);
  for (const extra of processDef.relatedUrls || []) processExpansion.push(normalizeUrl(extra));
}

const finalSample = unique([...structured, ...randomSample, ...processExpansion]);
const inventoryCount = allUrls.length;
const fullSiteSupplementaryRecommended = inventoryCount <= Number(config.sample.smallSiteSupplementaryScanThreshold ?? 50);

await writeText(path.join(inventoryDir, 'structured-sample.txt'), structured.join('\n') + '\n');
await writeJson(path.join(inventoryDir, 'structured-sample-suggested.json'), {
  manual,
  suggested: suggested.filter(url => !manual.includes(url)),
  finalStructured: structured,
});
await writeText(path.join(inventoryDir, 'random-pool.txt'), randomPool.join('\n') + '\n');
await writeText(path.join(inventoryDir, 'random-sample.txt'), randomSample.join('\n') + '\n');
await writeJson('sample.json', finalSample);
await writeJson(path.join(inventoryDir, 'sample-metadata.json'), {
  site: config.name,
  rootUrl: config.rootUrl,
  inventoryCount,
  structuredCount: structured.length,
  randomPoolCount: randomPool.length,
  randomCount: randomSample.length,
  finalSampleCount: finalSample.length,
  randomSeed,
  randomPercent,
  minRandomPages,
  structuredMissingFromInventory,
  processExpansion: unique(processExpansion),
  fullSiteSupplementaryRecommended,
  generatedAt: new Date().toISOString(),
});

console.log(`Wrote sample.json with ${finalSample.length} URLs`);
console.log(`Structured sample: ${structured.length}`);
console.log(`Random sample: ${randomSample.length}`);
if (fullSiteSupplementaryRecommended) {
  console.log(`Small-site note: full-site supplementary automated scan is recommended (inventoryCount=${inventoryCount}).`);
}
