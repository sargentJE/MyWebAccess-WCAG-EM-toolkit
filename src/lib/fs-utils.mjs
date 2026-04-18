import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(...parts) {
  const dir = path.join(...parts);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function writeText(filePath, text) {
  await fs.writeFile(filePath, text, 'utf8');
}

export async function readJsonMaybe(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}
