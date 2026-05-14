export { WCAGEMAccessibilityToolkitConfig, Action } from './config.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

export interface BuildContextOptions {
  configPath?: string;
  outDir?: string;
  logLevel?: LogLevel;
  skipPreflight?: boolean;
  requirePlaywright?: boolean;
}

export interface RunContextPaths {
  outDir: string;
  inventoryDir: string;
  resultsDir: string;
  reportsDir: string;
  screenshotsDir: string;
  sampleJsonPath: string;
}

export interface RunContext {
  config: import('./config.js').WCAGEMAccessibilityToolkitConfig;
  configPath: string;
  logger: import('pino').Logger;
  paths: RunContextPaths;
  args: Record<string, string | boolean>;
}

export function buildContext(options?: BuildContextOptions): Promise<RunContext>;

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  prettyOverride?: boolean;
}

export function createLogger(options?: LoggerOptions): import('pino').Logger;
export function getLogger(options?: LoggerOptions): import('pino').Logger;

export interface ValidationResult {
  valid: boolean;
  errors: unknown[] | null;
  formatted?: string;
}

export function validateConfig(config: unknown, configPath?: string): Promise<ValidationResult>;

export function assertValidConfig(config: unknown, configPath?: string): Promise<void>;

export interface PreflightOptions {
  configPath: string;
  outDir: string;
  requirePlaywright?: boolean;
}

export interface PreflightResult {
  ok: boolean;
  failures: string[];
}

export function runPreflight(opts: PreflightOptions): Promise<PreflightResult>;

export function runAudit(options?: BuildContextOptions): Promise<{
  exitCode: number;
  stages: Record<string, unknown>;
}>;
