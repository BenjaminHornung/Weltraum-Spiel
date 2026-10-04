import { afterAll, expect } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, sha256 } from '../../src/contracts/validation';
import { sourceBinding } from '../../src/tools/variant-gallery/source';

// Preserve the original test's phase1-only opt-in emitter. Perform the same disk proof under the granted phase2 root instead.
afterAll(async () => {
  const root = process.env.RD40_PHASE2_CPU_ROOT;
  expect(root).toMatch(/^C:[/\\]IFI_SourceCode[/\\]Temp[/\\]Hestia-RD-2026-10-02-runs[/\\]RD-40[/\\]phase2-32e88a34-20261004-[a-z0-9-]+$/);
  const source = await sourceBinding(); expect(source.sourceBytesDigest).toBe('aff59a722a591a196067441e01dec0b4482a309058957bd7e7a7a1795e499278');
  expect(source.files.some((file) => file.path === 'src/tools/variant-gallery/source.ts')).toBe(true);
  expect(source.files.some((file) => file.path === 'src/tools/variant-gallery/style.css')).toBe(true);
  for (const file of source.files) { expect(file.sha256).toBe(await sha256(new Uint8Array(await readFile(new URL(`../../${file.path}`, import.meta.url))))); }
  const name = path.basename(expect.getState().testPath!).replace('.test.ts', '');
  await writeFile(path.join(root!, `runtime-source-binding-${name}.json`), canonicalJson(source), { flag: 'wx' });
});
