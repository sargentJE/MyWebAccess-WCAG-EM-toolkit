// @ts-check
/**
 * @file Ajv-based config validation with fail-fast regex compilation.
 * @module lib/validate-config
 *
 * @description
 * Validates a user-supplied config against `schemas/config.schema.json` using
 * Ajv 2020 with the standard formats plug-in, plus a custom `validRegex`
 * keyword that actually compiles each regex string at validation time so bad
 * patterns fail at config-load rather than mid-crawl (ADR-0005).
 *
 * Returns a `{ valid, errors, formatted }` shape. Callers format errors via
 * `better-ajv-errors` for human-readable output including the JSON pointer,
 * received value, and suggested alternatives.
 *
 * @see docs/adr/0002-config-is-ajv-validated.md
 * @see docs/adr/0005-fail-fast-on-config.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// NOTE: dual-export interop — Ajv's CJS build exposes the constructor under .default.
// The cast via /** @type {any} */ is intentional and documented.
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import betterAjvErrorsModule from 'better-ajv-errors';

const Ajv2020 = /** @type {any} */ (Ajv2020Module).default ?? /** @type {any} */ (Ajv2020Module);
const addFormats =
  /** @type {any} */ (addFormatsModule).default ?? /** @type {any} */ (addFormatsModule);
const betterAjvErrors =
  /** @type {any} */ (betterAjvErrorsModule).default ?? /** @type {any} */ (betterAjvErrorsModule);

// SECTION: Constants

// ANCHOR: SCHEMA_PATH — resolved relative to this module so tests/CLI both work
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '../../schemas/config.schema.json');

// SECTION: Ajv setup

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictSchema: 'log',
  strictNumbers: true,
  strictTypes: false,
});
addFormats(ajv);

// ANCHOR: validRegex — custom keyword; compiles user regex at validation time
// TODO(Layer 3): the validRegex keyword is attached to three schema fields
// (crawl.excludeUrlPatterns[], scan.axe.overrides[].urlPattern,
// processes[].actions[].urlPattern) but only the first is also compiled
// at config-load via context.mjs → defineHidden. Extend compile-at-load to
// the other two when Layer 3 wires them into the crawl/scan hot paths.
// See CHANGELOG.md [Unreleased] → "Layer 3 follow-ups" + ADR-0005 mechanism 2.
ajv.addKeyword({
  keyword: 'validRegex',
  type: 'string',
  errors: true,
  metaSchema: { type: 'boolean' },
  /**
   * @param {boolean} schema
   * @param {string} data
   * @returns {boolean}
   */
  validate: function validateRegex(schema, data) {
    if (!schema) return true;
    try {
      new RegExp(data);
      return true;
    } catch (err) {
      // @ts-expect-error Ajv sets errors via function property at validation time
      validateRegex.errors = [
        {
          keyword: 'validRegex',
          message: `not a valid regex: ${err instanceof Error ? err.message : String(err)}`,
          params: { pattern: data },
        },
      ];
      return false;
    }
  },
});

/** @type {{ validator: any, schema: any } | null} */
let cached = null;

async function getValidator() {
  if (cached) return cached;
  const raw = await fs.readFile(SCHEMA_PATH, 'utf8');
  const schema = JSON.parse(raw);
  const validator = ajv.compile(schema);
  cached = { validator, schema };
  return cached;
}

// SECTION: Public API

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid - True when the config satisfies the schema.
 * @property {any[] | null} errors - Raw Ajv errors or null when valid.
 * @property {string} [formatted] - Human-readable error text (better-ajv-errors) when invalid.
 */

/**
 * Validate a parsed config object against the schema.
 *
 * @param {unknown} config - Parsed JSON config (after DEFAULTS merge).
 * @param {string} [configPath] - Source path used in error messages.
 * @returns {Promise<ValidationResult>}
 */
export async function validateConfig(config, configPath = '<config>') {
  const { validator, schema } = await getValidator();
  const valid = validator(config);
  if (valid) return { valid: true, errors: null };

  const errors = validator.errors ?? [];
  const formatted = betterAjvErrors(schema, config, errors, {
    format: 'cli',
    indent: 2,
  });
  const prefix = `Config validation failed: ${configPath}\n`;
  return {
    valid: false,
    errors,
    formatted: prefix + (typeof formatted === 'string' ? formatted : String(formatted)),
  };
}

/**
 * Convenience: throws a `ConfigValidationError` on failure.
 *
 * @param {unknown} config
 * @param {string} [configPath]
 * @returns {Promise<void>}
 */
export async function assertValidConfig(config, configPath) {
  const result = await validateConfig(config, configPath);
  if (!result.valid) {
    const err = new Error(result.formatted ?? 'Config validation failed');
    err.name = 'ConfigValidationError';
    throw err;
  }
}
