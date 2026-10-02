import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { LAB, RUN, ownedPath, writeOwned } from '../../exporters/stage-source.mjs';
import { sha } from '../../exporters/fixture-export.mjs';

const beforeRoot = path.join(LAB, 'fixtures');
const afterRoot = ownedPath(process.argv[2]);
const beforeBytes = readFileSync(path.join(beforeRoot, 'inventory.json'));
const afterBytes = readFileSync(path.join(afterRoot, 'inventory.json'));
const before = JSON.parse(beforeBytes); const after = JSON.parse(afterBytes);
const withoutRecipeHash = inventory => ({ ...inventory, fixtures: inventory.fixtures.map(({ recipeSha256, ...row }) => row) });
if (JSON.stringify(withoutRecipeHash(before)) !== JSON.stringify(withoutRecipeHash(after))) {
  throw new Error('Annotation refresh must not change fixture/source/payload/scenario bytes');
}
writeOwned(`${RUN}/red-palette/unit.test.ts`, readFileSync(path.join(LAB, 'tests/RD-02/unit.test.ts')));
writeOwned(`${RUN}/red-palette/recipe.json`, readFileSync(path.join(beforeRoot, 'F01-HVP-COAST/recipe.json')));
const pending = [...after.fixtures.map(row => row.recipePath), 'inventory.json'].map(relative => {
  const target = ownedPath(path.join(beforeRoot, relative), true); const source = ownedPath(path.join(afterRoot, relative));
  if (!lstatSync(target).isFile() || !lstatSync(source).isFile()) { throw new Error('Non-regular annotation artifact'); }
  const oldBytes = readFileSync(target); const newBytes = readFileSync(source);
  return { relative, target, oldBytes, newBytes };
});
// All manifests, payloads and scenarios must be exactly the already-reviewed
// bytes, not merely advertised equal digests, before the narrow annotation edit.
for (const row of after.fixtures) {
  for (const relative of [row.manifestPath, ...row.payloads.map(p => p.path)]) {
    if (!readFileSync(path.join(beforeRoot, relative)).equals(readFileSync(path.join(afterRoot, relative)))) { throw new Error('Binary/manifest drift'); }
  }
}
for (const row of after.scenarios) {
  if (!readFileSync(path.join(beforeRoot, row.path)).equals(readFileSync(path.join(afterRoot, row.path)))) { throw new Error('Scenario drift'); }
}
const changes = pending.map(p => ({ path: p.relative, oldBytes: p.oldBytes.length, oldSha256: sha(p.oldBytes),
  newBytes: p.newBytes.length, newSha256: sha(p.newBytes) }));
writeOwned(`${RUN}/annotation-refresh.json`, `${JSON.stringify({ reason: 'Bind native decoration tone palette and artifact revisions; no binary/profile/limit changes',
  changes, redTestSha256: sha(readFileSync(`${RUN}/red-palette/unit.test.ts`)), redRecipeSha256: sha(readFileSync(`${RUN}/red-palette/recipe.json`)) }, null, 2)}\n`);
for (const p of pending) { writeFileSync(p.target, p.newBytes); }
console.log(JSON.stringify({ changedAnnotations: changes.length, payloadManifestScenarioBytes: 'UNCHANGED', inventorySha256: sha(afterBytes) }, null, 2));
