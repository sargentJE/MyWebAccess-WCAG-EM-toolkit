export { WCAGEMAccessibilityToolkitConfig, Action } from './config.js';

export interface BuildContextOptions {
  requirePlaywright?: boolean;
  configPath?: string;
  outDir?: string;
}

export interface RunContext {
  config: import('./config.js').WCAGEMAccessibilityToolkitConfig;
  logger: import('pino').Logger;
  paths: {
    reportsDir: string;
    resultsDir: string;
    screenshotsDir: string;
    sampleJsonPath: string;
  };
}

export function buildContext(options?: BuildContextOptions): Promise<RunContext>;

export function createLogger(options?: Record<string, unknown>): import('pino').Logger;
export function getLogger(): import('pino').Logger;

export function validateConfig(
  config: unknown,
): { valid: true } | { valid: false; errors: Array<{ message: string }> };
export function assertValidConfig(config: unknown): void;

export function runPreflight(ctx: RunContext): Promise<void>;

export function runAudit(options?: BuildContextOptions): Promise<{
  exitCode: number;
  stages: Record<string, unknown>;
}>;
