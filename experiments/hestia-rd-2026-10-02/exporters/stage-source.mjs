import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha } from './fixture-export.mjs';

export const LAB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(LAB, '../..');
export const RUN = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02';
export const BASE = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
export const START = '63e52eea0f2afbde03ab83b8d66f62941097b314';
export const GIT = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const PREFIX = 'apps/weltraum-browser/src/';
const graph = ['core/hash.ts', 'hvp/hvpCoastSource.ts', 'hvp/hvpCoastMesher.ts', 'hvp/hvpTerrain.ts',
  'voxel/blockAmbientOcclusion.ts', 'presentation/canonical.ts', 'presentation/ids.ts', 'presentation/validation.ts',
  'presentation/materialProfile.ts', 'presentation/meshArtifact.ts',
  'hestia-prototype/presentation/vegetation.ts', 'hestia-prototype/presentation/look.ts'];
const data = ['presentation/index.ts', 'hvp/hvpCamera.ts', 'hestia-prototype/presentation/visualEffects.ts'];
const expected = { 'hvp/hvpCoastSource.ts': '0e9d3226828cc0a233791b77b634aa91c0c39771',
  'hvp/hvpCoastMesher.ts': '1fad35b9ca837256f8acfd1ed1ebeb97ca5b4c26',
  'hestia-prototype/presentation/vegetation.ts': '089e5e985ee9ad271a3ed44e0bb3214ab28c0879',
  'hestia-prototype/presentation/look.ts': 'd4cd91baca674a027416e9cd8eab97532803080d',
  'hvp/hvpCamera.ts': '3f87cadac0664db2b32aae04b25356bb0ead8c8d' };

export function ownedPath(target, allowFixture = false) {
  const resolved = path.resolve(target);
  const roots = [path.resolve(RUN), ...(allowFixture ? [path.join(LAB, 'fixtures')] : [])];
  const root = roots.find(r => resolved === r || resolved.startsWith(`${r}${path.sep}`));
  if (!root) { throw new Error('Output/staging outside own RD-02 run root or fixtures'); }
  let cursor = resolved;
  while (cursor.startsWith(root)) {
    const stat = lstatSync(cursor, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || realpathSync(cursor) !== cursor)) {
      throw new Error('Linked/escaping output path');
    }
    if (cursor === root) { break; }
    cursor = path.dirname(cursor);
  }
  return resolved;
}
export function writeOwned(file, bytes, allowFixture = false) {
  ownedPath(file, allowFixture);
  if (existsSync(file)) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) { throw new Error(`Refusing to overwrite different artifact: ${file}`); }
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes, { flag: 'wx' });
}
export function readPinned(file, ref = BASE) {
  if (ref !== BASE || ![...graph, ...data].map(p => PREFIX + p).includes(file)) { throw new Error('Unpinned/unapproved product source'); }
  const bytes = execFileSync(GIT, ['show', `${ref}:${file}`], { cwd: REPO, maxBuffer: 1_048_576, windowsHide: true });
  const blobSha = execFileSync(GIT, ['rev-parse', `${ref}:${file}`], { cwd: REPO, encoding: 'utf8', windowsHide: true }).trim();
  const actualBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (actualBlob !== blobSha || (expected[file.slice(PREFIX.length)] && expected[file.slice(PREFIX.length)] !== blobSha)) {
    throw new Error('Product blob binding mismatch');
  }
  return { path: file, sha256: sha(bytes), blobSha, bytes };
}
export function verifyFreeze() {
  const freeze = JSON.parse(readFileSync(`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${START}.json`, 'utf8'));
  const rows = freeze.frozenFiles.map(file => ({ path: file.path, expectedSha256: file.sha256,
    actualSha256: sha(readFileSync(path.join(LAB, file.path))) }));
  if (rows.length !== 18 || rows.some(r => r.expectedSha256 !== r.actualSha256)) { throw new Error('RD-00 freeze drift'); }
  return rows;
}
function adapt(source, known, subset = false) {
  const erased = stripTypeScriptTypes(source, { mode: 'strip' });
  const replacements = [];
  const code = erased.replace(/(\b(?:from|import)\s*['"])(\.{1,2}\/[^'"]+)(['"])/g, (match, before, specifier, after) => {
    const dest = path.posix.normalize(path.posix.join(path.posix.dirname(known.current), `${specifier}.ts`));
    let replacement;
    if (subset && dest === 'presentation.ts') { replacement = `${specifier}/subset.mjs`; }
    else {
      if (!known.paths.has(dest)) { throw new Error(`Unexpected executable source import: ${known.current} -> ${specifier}`); }
      replacement = `${specifier}.mjs`;
    }
    replacements.push({ from: specifier, to: replacement });
    return `${before}${replacement}${after}`;
  });
  return { code, replacements, erasedSha256: sha(erased) };
}
export async function stageSource(stageDirectory, ref) {
  if (process.version !== 'v22.23.2') { throw new Error('Pinned Node22.23.2 required'); }
  const stage = ownedPath(stageDirectory);
  const sources = [...graph, ...data].map(file => readPinned(PREFIX + file, ref));
  const adapters = [];
  for (const source of sources) {
    const relative = source.path.slice(PREFIX.length);
    writeOwned(path.join(stage, 'original-product', relative), source.bytes);
    if (!graph.includes(relative)) { continue; }
    const result = adapt(source.bytes.toString('utf8'), { current: relative, paths: new Set(graph) }, true);
    writeOwned(path.join(stage, 'product', relative.replace(/\.ts$/, '.mjs')), result.code);
    adapters.push({ path: source.path, originalSha256: source.sha256, blobSha: source.blobSha,
      erasedSha256: result.erasedSha256, adapterSha256: sha(result.code), replacements: result.replacements });
  }
  const facade = "export * from './ids.mjs';\nexport * from './materialProfile.mjs';\nexport * from './meshArtifact.mjs';\n";
  writeOwned(path.join(stage, 'product/presentation/subset.mjs'), facade);
  adapters.push({ path: 'presentation/subset.mjs', purpose: 'only required pure barrel exports; no algorithm changes', adapterSha256: sha(facade) });
  const names = ['fixture', 'scenario', 'experiment', 'result', 'validation'];
  for (const name of names) {
    const original = readFileSync(path.join(LAB, `src/contracts/${name}.ts`));
    const result = adapt(original.toString('utf8'), { current: `${name}.ts`, paths: new Set(names.map(n => `${n}.ts`)) });
    writeOwned(path.join(stage, `original-contracts/${name}.ts`), original);
    writeOwned(path.join(stage, `contracts/${name}.mjs`), result.code);
    adapters.push({ path: `src/contracts/${name}.ts`, originalSha256: sha(original), erasedSha256: result.erasedSha256,
      adapterSha256: sha(result.code), replacements: result.replacements });
  }
  const product = {};
  for (const [name, file] of Object.entries({ coast: 'hvp/hvpCoastSource', mesher: 'hvp/hvpCoastMesher',
    vegetation: 'hestia-prototype/presentation/vegetation', look: 'hestia-prototype/presentation/look' })) {
    product[name] = await import(pathToFileURL(path.join(stage, `product/${file}.mjs`)).href);
  }
  const contracts = {};
  for (const name of names) { Object.assign(contracts, await import(pathToFileURL(path.join(stage, `contracts/${name}.mjs`)).href)); }
  return { sources, adapters, product, contracts, stage };
}
