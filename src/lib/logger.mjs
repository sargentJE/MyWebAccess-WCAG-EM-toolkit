// @ts-check
/**
 * @file Pino logger factory with TTY pretty-print and structured JSON.
 * @module lib/logger
 *
 * @description
 * Single logger factory used by every command. Pretty-prints to TTY; emits
 * newline-delimited JSON when piped. Applies the redact list from ADR-0001 so
 * Authorization / Cookie / auth-state fields never leak into logs.
 *
 * NOTE: findings summaries are written to stdout via `process.stdout.write`;
 * operational events (progress, errors, warnings) go through this logger to
 * stderr — Unix convention.
 *
 * @see docs/adr/0004-pino-structured-logging.md
 */

// SECTION: Imports
import pino from 'pino';

// SECTION: Constants

// ANCHOR: REDACT_PATHS — case-insensitive JSON paths never logged verbatim
const REDACT_PATHS = [
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'set-cookie',
  'Set-Cookie',
  '*.password',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.api_key',
  '*.accessToken',
  '*.access_token',
  'auth.storageState',
  'auth.httpCredentials',
];

// SECTION: Public API

/**
 * @typedef {'trace'|'debug'|'info'|'warn'|'error'|'fatal'|'silent'} LogLevel
 */

/**
 * @typedef {object} LoggerOptions
 * @property {LogLevel} [level] - Minimum level; defaults to `$WCAG_EM_LOG_LEVEL` or `info`.
 * @property {string} [name] - Logger name (appears in every record).
 * @property {boolean} [prettyOverride] - Force pretty mode regardless of TTY.
 */

/**
 * Build a Pino logger instance with project-wide defaults.
 *
 * @param {LoggerOptions} [options]
 * @returns {pino.Logger}
 */
export function createLogger(options = {}) {
  const level = options.level ?? /** @type {LogLevel} */ (process.env.WCAG_EM_LOG_LEVEL) ?? 'info';
  const pretty = options.prettyOverride ?? Boolean(process.stderr.isTTY);

  /** @type {pino.LoggerOptions} */
  const baseOpts = {
    name: options.name ?? 'wcag-em',
    level,
    redact: { paths: REDACT_PATHS, remove: true },
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (pretty) {
    return pino(
      baseOpts,
      pino.transport({
        target: 'pino-pretty',
        options: {
          destination: 2, // stderr
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,name',
        },
      }),
    );
  }

  // NOTE: plain JSON to stderr when piped — matches 12-factor expectations.
  return pino(baseOpts, pino.destination({ fd: 2, sync: false }));
}

/** @type {pino.Logger | null} */
let singleton = null;

/**
 * Lazily-constructed process-wide logger. Useful when a deep helper needs a
 * logger but shouldn't take one by parameter.
 *
 * @param {LoggerOptions} [options]
 * @returns {pino.Logger}
 */
export function getLogger(options) {
  if (!singleton) singleton = createLogger(options);
  return singleton;
}

/**
 * For tests: reset the cached singleton.
 *
 * @returns {void}
 */
export function _resetLoggerForTests() {
  singleton = null;
}
