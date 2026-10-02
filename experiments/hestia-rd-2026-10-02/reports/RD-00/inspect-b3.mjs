import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/b3-read-only';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const commit = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const inputs = [
  ['hvp/hvpCoastSource.ts', '0e9d3226828cc0a233791b77b634aa91c0c39771'],
  ['hvp/hvpCoastMesher.ts', '1fad35b9ca837256f8acfd1ed1ebeb97ca5b4c26'],
  ['hestia-prototype/presentation/vegetation.ts', '089e5e985ee9ad271a3ed44e0bb3214ab28c0879'],
  ['hestia-prototype/presentation/look.ts', 'd4cd91baca674a027416e9cd8eab97532803080d'],
  ['hvp/hvpCamera.ts', '3f87cadac0664db2b32aae04b25356bb0ead8c8d'],
  ['hestia-prototype/presentation/visualEffects.ts', '5d99e23a6bc8dfd80e8bd8d056d3dea393daad2b'],
];
mkdirSync(run, { recursive: true });
const files = inputs.map(([relative, blob]) => {
  const sourcePath = `apps/weltraum-browser/src/${relative}`;
  const actual = execFileSync(git, ['rev-parse', `${commit}:${sourcePath}`], { cwd: root, encoding: 'utf8' }).trim();
  if (actual !== blob) { throw new Error(`Pinned blob mismatch: ${sourcePath}`); }
  const bytes = execFileSync(git, ['show', `${commit}:${sourcePath}`], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
  const target = path.join(run, path.basename(relative)); writeFileSync(target, bytes);
  return { path: sourcePath, blobSha: blob, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), stagedReadOnlyBytes: target };
});
const binding = { commit, executedProductCode: false, files };
writeFileSync(`${run}/bindings.json`, JSON.stringify(binding, null, 2)); console.log(JSON.stringify(binding, null, 2));
