import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { loadConfig } from './lib/config.mjs';
import { ensureDir, writeJson } from './lib/fs-utils.mjs';
import { fileSafeFromUrl } from './lib/urls.mjs';

const { config } = await loadConfig();
const sampleUrls = JSON.parse(await fs.readFile('sample.json', 'utf8'));
const resultsDir = await ensureDir('output', 'results');
const screenshotsDir = await ensureDir('output', 'screenshots');

const browser = await chromium.launch({ headless: true });
const allResults = [];

async function runForPage(page, url) {
  await page.goto(url, {
    waitUntil: config.scan.waitUntil,
    timeout: config.scan.timeoutMs,
  });

  const screenshotPath = path.join(screenshotsDir, `${fileSafeFromUrl(url)}.png`);
  if (config.scan.fullPageScreenshots !== false) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  let builder = new AxeBuilder({ page });
  const axeConfig = config.scan.axe ?? {};

  for (const selector of axeConfig.exclude || []) builder = builder.exclude(selector);
  for (const selector of axeConfig.include || []) builder = builder.include(selector);
  if (Array.isArray(axeConfig.withRules) && axeConfig.withRules.length > 0) builder = builder.withRules(axeConfig.withRules);
  if (Array.isArray(axeConfig.withTags) && axeConfig.withTags.length > 0) builder = builder.withTags(axeConfig.withTags);
  if (axeConfig.runOnly) builder = builder.options({ runOnly: axeConfig.runOnly });

  const axeResults = await builder.analyze();
  return {
    title: await page.title().catch(() => ''),
    screenshot: config.scan.fullPageScreenshots !== false ? screenshotPath : null,
    violations: axeResults.violations,
    passes: axeResults.passes.length,
    incomplete: axeResults.incomplete.length,
    inapplicable: axeResults.inapplicable.length,
  };
}

for (const url of sampleUrls) {
  let attempt = 0;
  let success = false;
  let lastError = null;

  while (attempt <= config.scan.retries && !success) {
    const context = await browser.newContext({ viewport: config.scan.viewport });
    const page = await context.newPage();
    try {
      attempt += 1;
      console.log(`Scanning ${url} (attempt ${attempt})`);
      const result = await runForPage(page, url);
      allResults.push({ url, attempts: attempt, ...result });
      console.log(`Done: ${url} (${result.violations.length} violations)`);
      success = true;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed for ${url}: ${error.message}`);
    } finally {
      await context.close();
    }
  }

  if (!success) {
    allResults.push({ url, attempts: attempt, error: lastError?.message ?? 'Unknown error', violations: [] });
  }
}

await browser.close();
await writeJson(path.join(resultsDir, 'axe-results.json'), allResults);
console.log('Saved output/results/axe-results.json');
