import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LAB, RUN, ownedPath, writeOwned } from '../../exporters/stage-source.mjs';
import { sha } from '../../exporters/fixture-export.mjs';

const repair = `${RUN}/repair-dangling-v1`;
const beforeRoot = path.join(LAB, 'fixtures'); const normal = `${repair}/export-normal`; const reverse = `${repair}/export-reverse`;
const read = (root, relative) => readFileSync(ownedPath(path.join(root, relative), true));
const beforeBytes = read(beforeRoot, 'inventory.json'); const afterBytes = read(normal, 'inventory.json');
const before = JSON.parse(beforeBytes); const after = JSON.parse(afterBytes);
if (sha(beforeBytes) !== '9ada4198596705053bcaecb68b5a5926bf6792e335feb6cc0cb4cd79fbc7a5f0') { throw new Error('Not the e6 parent inventory'); }
const omitRecipeSha = inventory => ({ ...inventory, fixtures: inventory.fixtures.map(({ recipeSha256, ...row }) => row) });
if (JSON.stringify(omitRecipeSha(before)) !== JSON.stringify(omitRecipeSha(after))) { throw new Error('Fixture/source/payload/scenario metadata drift'); }
const oldCodeSha = 'b8941441aa8a3ce66db4fa3daf99fa7b79434423ffa306e64fd15cc692b17ecb';
const newCodeSha = sha(readFileSync(path.join(LAB, 'exporters/stage-source.mjs')));
const recipes = new Set(after.fixtures.map(f => f.recipePath));
const paths = ['inventory.json', ...after.fixtures.flatMap(f => [f.manifestPath, f.recipePath, ...f.payloads.map(p => p.path)]),
  ...after.scenarios.map(s => s.path)];
for (const relative of paths) {
  const a = read(normal, relative); const b = read(reverse, relative);
  if (!a.equals(b)) { throw new Error('Normal/reverse byte drift'); }
  const old = read(beforeRoot, relative);
  if (!old.equals(read(`${RUN}/export-final-normal`, relative))) { throw new Error('e6 static/producer evidence drift'); }
  if (relative === 'inventory.json') { continue; }
  if (!recipes.has(relative)) {
    if (!old.equals(a)) { throw new Error('Manifest/payload/scenario bytes changed'); }
    continue;
  }
  const oldRecipe = JSON.parse(old); const newRecipe = JSON.parse(a);
  const oldEntry = oldRecipe.generatorFiles.find(f => f.path === 'exporters/stage-source.mjs');
  const newEntry = newRecipe.generatorFiles.find(f => f.path === 'exporters/stage-source.mjs');
  if (oldEntry.sha256 !== oldCodeSha || newEntry.sha256 !== newCodeSha) { throw new Error('Stage-source byte binding mismatch'); }
  oldEntry.sha256 = newCodeSha;
  if (JSON.stringify(oldRecipe) !== JSON.stringify(newRecipe)) { throw new Error('Annotation change beyond one code SHA'); }
}
const changed = [...recipes, 'inventory.json'].map(relative => {
  const old = read(beforeRoot, relative); const fresh = read(normal, relative);
  writeOwned(`${repair}/parent-annotations/${relative}`, old);
  return { path: `fixtures/${relative}`, oldSha256: sha(old), newSha256: sha(fresh), bytes: fresh.length };
});
writeOwned(`${repair}/annotation-bindings.json`, `${JSON.stringify({ parentSha: 'e6d41867f0fd3257428132c6463ff7d1f80f91af',
  oldCodeSha, newCodeSha, changed, comparedFiles: paths.length, invariantFiles: paths.length - changed.length,
  manifestsPayloadsScenarios: 'EXACT_PARENT_BYTES', normalReverse: 'EXACT_BYTES' }, null, 2)}\n`);
for (const relative of [...recipes, 'inventory.json']) { writeFileSync(ownedPath(path.join(beforeRoot, relative), true), read(normal, relative)); }
console.log(JSON.stringify({ changedAnnotations: changed.length, comparedFiles: paths.length, invariantFiles: paths.length - changed.length,
  oldCodeSha, newCodeSha, inventorySha256: sha(afterBytes), manifestsPayloadsScenarios: 'EXACT_PARENT_BYTES' }, null, 2));
