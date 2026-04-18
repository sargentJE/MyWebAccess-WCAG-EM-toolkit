import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { loadConfig } from '../lib/config.mjs';
import { ensureDir, writeJson } from '../lib/fs-utils.mjs';
import { fileSafeFromUrl } from '../lib/urls.mjs';

const { config } = await loadConfig();
const resultsDir = await ensureDir('output', 'results');
const screenshotsDir = await ensureDir('output', 'screenshots');

function expandPattern(processDef) {
  if (Array.isArray(processDef.steps) && processDef.steps.length > 0) return processDef.steps;

  if (processDef.pattern === 'blank-submit') {
    return [
      { action: 'goto', url: processDef.startUrl },
      {
        action: 'click',
        selector: processDef.selectors?.submit ?? "button[type='submit'], input[type='submit']",
      },
      { action: 'screenshot', name: 'blank-submit' },
      { action: 'axe', state: 'blank-submit' },
    ];
  }

  if (processDef.pattern === 'partial-submit') {
    const fills = (processDef.fields || []).map((field) => ({
      action: 'fill',
      selector: field.selector,
      value: field.value ?? '',
    }));
    return [
      { action: 'goto', url: processDef.startUrl },
      ...fills,
      {
        action: 'click',
        selector: processDef.selectors?.submit ?? "button[type='submit'], input[type='submit']",
      },
      { action: 'screenshot', name: 'partial-submit' },
      { action: 'axe', state: 'partial-submit' },
    ];
  }

  return [];
}

async function runAxe(page) {
  const result = await new AxeBuilder({ page }).analyze();
  return {
    violations: result.violations,
    passes: result.passes.length,
    incomplete: result.incomplete.length,
    inapplicable: result.inapplicable.length,
  };
}

const browser = await chromium.launch({ headless: true });
const processResults = [];

for (const processDef of config.processes ?? []) {
  const context = await browser.newContext({ viewport: config.scan.viewport });
  const page = await context.newPage();
  const steps = expandPattern(processDef);
  const states = [];

  try {
    console.log(`Running process: ${processDef.name}`);

    if (steps.length === 0) {
      processResults.push({
        name: processDef.name,
        startUrl: processDef.startUrl,
        pattern: processDef.pattern ?? null,
        states: [{ state: 'not-run', note: 'No steps or supported pattern defined.' }],
      });
      continue;
    }

    for (const step of steps) {
      if (step.action === 'goto') {
        await page.goto(step.url, {
          waitUntil: config.scan.waitUntil,
          timeout: config.scan.timeoutMs,
        });
      } else if (step.action === 'click') {
        await page.locator(step.selector).first().click();
      } else if (step.action === 'fill') {
        await page
          .locator(step.selector)
          .first()
          .fill(step.value ?? '');
      } else if (step.action === 'press') {
        await page.keyboard.press(step.key);
      } else if (step.action === 'waitFor') {
        await page.waitForTimeout(step.timeoutMs ?? 500);
      } else if (step.action === 'screenshot') {
        const screenshot = path.join(
          screenshotsDir,
          `${fileSafeFromUrl(processDef.startUrl)}__${processDef.name}__${step.name ?? 'state'}.png`,
        );
        await page.screenshot({ path: screenshot, fullPage: true });
        states.push({ state: `screenshot:${step.name ?? 'state'}`, screenshot });
      } else if (step.action === 'axe') {
        const axe = await runAxe(page);
        states.push({ state: step.state ?? 'state', ...axe });
      }
    }

    processResults.push({
      name: processDef.name,
      startUrl: processDef.startUrl,
      pattern: processDef.pattern ?? null,
      states,
    });
  } catch (error) {
    processResults.push({
      name: processDef.name,
      startUrl: processDef.startUrl,
      pattern: processDef.pattern ?? null,
      error: error.message,
      states,
    });
  } finally {
    await context.close();
  }
}

await browser.close();
await writeJson(path.join(resultsDir, 'process-results.json'), processResults);
console.log('Saved output/results/process-results.json');
