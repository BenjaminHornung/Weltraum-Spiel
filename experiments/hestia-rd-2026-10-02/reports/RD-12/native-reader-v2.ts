import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { BabylonDiagnostics } from '../../src/experiments/babylon';

export const NATIVE_READER_V2 = 'rd12-diagnosed-collapsed-facts-textcontent-v2';
export const DIAGNOSIS_SHA256 = 'e7156837c5e09333b27f07373e406dad5a51b4dd3ff7cd9c43dec9b28f675eed';
const bytes = readFileSync(process.env.HESTIA_RD12_NATIVE_OUTPUT + '/diagnosis-v1-results.json');
assert.equal(createHash('sha256').update(bytes).digest('hex'), DIAGNOSIS_SHA256, 'Actual independent diagnosis required before reader v2');
const diagnosis = JSON.parse(bytes.toString()); assert.equal(diagnosis.stats.expected, 3); assert.equal(diagnosis.stats.unexpected, 0);
type Observed = { status: string; diagnostic: BabylonDiagnostics | null; mounts: number; owned: Record<string, number> };
export async function observedV2(page: Page): Promise<Observed> {
  const element = page.locator('#facts'); const visibleText = await element.innerText();
  if (visibleText.trim() !== '') { return JSON.parse(visibleText); }
  assert(await element.evaluate((element) => element.closest('details')?.open === false), 'No fallback for empty visible/unknown facts');
  const actualText = await element.textContent(); assert(typeof actualText === 'string' && actualText.trim() !== '', 'Diagnosed hidden facts contain no runtime JSON');
  const value = JSON.parse(actualText); assert.equal(value.productIntegrated, false); assert.equal(typeof value.status, 'string');
  assert(value.owned && Number.isSafeInteger(value.mounts), 'Runtime facts schema missing'); return value;
}
