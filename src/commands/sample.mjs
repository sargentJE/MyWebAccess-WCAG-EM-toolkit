// @ts-check
/**
 * @file `sample` command — builds structured + random + process-expansion sample.
 * @module commands/sample
 *
 * @description
 * Stage 2 of the pipeline. Implements WCAG-EM Step 3 sampling:
 *   - Structured sample: `config.sample.structuredManual` ∪ auto-suggest from clusters.
 *   - Random sample: `seededSample` over non-structured URLs with recorded seed.
 *   - Process expansion: force-includes `startUrl` + `relatedUrls` for
 *     configured processes.
 *
 * The union of the three buckets is written to `sample.json` under the run's
 * out-dir — the single handoff file consumed by `scan`.
 *
 * NOTE: this command warns on `structuredMissingFromInventory` —
 * silent in v0.3, now surfaced via `ctx.logger.warn`.
 *
 * @see https://www.w3.org/TR/WCAG-EM/#step3
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJson, writeText } from '../lib/fs-utils.mjs';
import { normalizeUrl } from '../lib/urls.mjs';
import { seededSample, unique } from '../lib/sample-utils.mjs';
import { TOOL_IDENTITY } from '../lib/version.mjs';
import { buildContext, ensurePreflight } from '../lib/context.mjs';

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ finalSampleCount: number, structuredCount: number, randomCount: number }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;

  /** @type {any[]} */
  const inventory = JSON.parse(
    await fs.readFile(path.join(paths.inventoryDir, 'inventory.json'), 'utf8'),
  );
  /** @type {any[]} */
  const pageClusters = JSON.parse(
    await fs.readFile(path.join(paths.inventoryDir, 'page-clusters.json'), 'utf8'),
  );
  /** @type {string[]} */
  const allUrls = inventory.map((item) => normalizeUrl(item.url));

  // ANCHOR: StructuredSample — manual URLs + auto-suggested cluster representatives
  const manual = unique(
    /** @type {string[]} */ (config.sample.structuredManual || []).map((url) => normalizeUrl(url)),
  );
  /** @type {string[]} */
  const preferredTypes = config.sample.autoSuggest.preferTypes || [];
  /** @type {string[]} */
  const suggested = [];
  if (config.sample.autoSuggest.enabled) {
    for (const type of preferredTypes) {
      const matchingClusters = pageClusters.filter((cluster) => cluster.pageType === type);
      for (const cluster of matchingClusters.slice(0, config.sample.autoSuggest.perCluster || 1)) {
        suggested.push(cluster.representativeUrl);
      }
    }
  }

  const structured = unique([...manual, ...suggested]);
  /** @type {string[]} */
  const structuredMissingFromInventory = structured.filter((url) => !allUrls.includes(url));
  if (structuredMissingFromInventory.length > 0) {
    // Fix: surface silent config error via structured log event.
    logger.warn(
      { missing: structuredMissingFromInventory },
      'structured sample contains URLs not found in inventory',
    );
  }

  // ANCHOR: RandomSample — seeded, reproducible
  const randomPool = allUrls.filter((url) => !structured.includes(url));
  const randomPercent = Number(config.sample.randomPercentOfStructured ?? 0.1);
  const minRandomPages = Number(config.sample.minRandomPages ?? 2);
  const randomSeed = Number(config.sample.randomSeed ?? 1);
  const desiredRandomCount = Math.max(minRandomPages, Math.ceil(structured.length * randomPercent));
  const randomSample = seededSample(randomPool, desiredRandomCount, randomSeed);

  // ANCHOR: ProcessExpansion — pull in process startUrls + relatedUrls per config
  /** @type {string[]} */
  const processExpansion = [];
  for (const processDef of config.processes ?? []) {
    const startUrl = processDef.startUrl ? normalizeUrl(processDef.startUrl) : null;
    if (processDef.forceInclude === true && startUrl) processExpansion.push(startUrl);
    if (startUrl && structured.includes(startUrl)) processExpansion.push(startUrl);
    for (const extra of processDef.relatedUrls || []) processExpansion.push(normalizeUrl(extra));
  }

  const finalSample = unique([...structured, ...randomSample, ...processExpansion]);
  const inventoryCount = allUrls.length;
  const fullSiteSupplementaryRecommended =
    inventoryCount <= Number(config.sample.smallSiteSupplementaryScanThreshold ?? 50);

  // SECTION: Persist artefacts
  await writeText(
    path.join(paths.inventoryDir, 'structured-sample.txt'),
    structured.join('\n') + '\n',
  );
  await writeJson(path.join(paths.inventoryDir, 'structured-sample-suggested.json'), {
    tool: TOOL_IDENTITY,
    manual,
    suggested: suggested.filter((url) => !manual.includes(url)),
    finalStructured: structured,
  });
  await writeText(path.join(paths.inventoryDir, 'random-pool.txt'), randomPool.join('\n') + '\n');
  await writeText(
    path.join(paths.inventoryDir, 'random-sample.txt'),
    randomSample.join('\n') + '\n',
  );
  await writeJson(paths.sampleJsonPath, finalSample);
  await writeJson(path.join(paths.inventoryDir, 'sample-metadata.json'), {
    tool: TOOL_IDENTITY,
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

  logger.info(
    {
      finalSample: finalSample.length,
      structured: structured.length,
      random: randomSample.length,
      expansion: unique(processExpansion).length,
    },
    'sample built',
  );
  if (fullSiteSupplementaryRecommended) {
    logger.info(
      { inventoryCount },
      'small site — full-site supplementary automated scan recommended',
    );
  }

  return {
    finalSampleCount: finalSample.length,
    structuredCount: structured.length,
    randomCount: randomSample.length,
  };
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext({ requirePlaywright: false });
  await run(ctx);
}
