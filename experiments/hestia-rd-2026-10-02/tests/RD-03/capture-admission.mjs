import { lstatSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

/** @param {string} directory */
export function createBrowserRunDirectory(directory) {
  assertIsolation({ task: 'RD-03', runRoot: directory });
  mkdirSync(path.dirname(directory), { recursive: true });
  mkdirSync(directory);
  return directory;
}

/** @param {string} image @param {(image: string) => Promise<unknown>} capture */
export async function captureBrowserScreenshot(image, capture) {
  assertIsolation({ task: 'RD-03', runRoot: path.dirname(image) });
  if (lstatSync(image, { throwIfNoEntry: false })) { throw new Error('Screenshot destination already exists (file, nonregular or link)'); }
  await capture(image);
}
