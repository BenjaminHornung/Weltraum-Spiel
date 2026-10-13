import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve,sep } from 'node:path';
import { root, sha256 } from './commands.mjs';
function ownPath(path) {
  const absolute=resolve(root,path);
  assert.ok(absolute.startsWith(resolve(root)+sep),'OWN_INPUT_SCOPE_REQUIRED');
  return absolute;
}
export function verifyDependencies(dependencies) {
  assert.equal(dependencies?.schema,'phy04.dependency-bindings.v1','DEPENDENCY_BINDINGS_REQUIRED');
  assert.ok(Array.isArray(dependencies.records)&&Array.isArray(dependencies.binaries),'DEPENDENCY_LISTS_REQUIRED');
  assert.equal(sha256(JSON.stringify(dependencies.records)),dependencies.recordsDigest);
  for(const file of dependencies.records) {
    const data=readFileSync(ownPath(file.path));
    assert.equal(data.length,file.bytes,'DEPENDENCY_SIZE:'+file.path);
    assert.equal(sha256(data),file.sha256,'DEPENDENCY_SHA:'+file.path);
  }
  for(const file of dependencies.binaries) {
    assert.ok(file.path.replaceAll('\\','/').startsWith('C:/IFI_SourceCode/'),'CIFI_TOOL_REQUIRED');
    const data=readFileSync(file.path);
    assert.equal(data.length,file.bytes,'TOOL_SIZE:'+file.path);
    assert.equal(sha256(data),file.sha256,'TOOL_SHA:'+file.path);
  }
}

export function verifyInputs() {
  const binding = JSON.parse(readFileSync(resolve(root, 'SourceBindings.json')));
  assert.equal(sha256(JSON.stringify(binding.records)), binding.recordsDigest);
  const seen = new Set();
  for (const file of binding.records) {
    assert.ok(!seen.has(file.path), 'DUPLICATE_INPUT:' + file.path); seen.add(file.path);
    const data = readFileSync(ownPath(file.path));
    assert.equal(data.length, file.bytes, 'INPUT_SIZE:' + file.path);
    assert.equal(sha256(data), file.sha256, 'INPUT_SHA:' + file.path);
  }
  const dir = resolve(root, 'upstream/source/nexus-' + binding.nexus.commit);
  function tree(path = '') {
    return readdirSync(resolve(dir, path)).sort().flatMap(name => {
      const key = path ? path + '/' + name : name;
      const stat = lstatSync(resolve(dir, key));
      assert.ok(!stat.isSymbolicLink(), 'UPSTREAM_SYMLINK');
      return stat.isDirectory() ? tree(key) : [{ path: key, bytes: stat.size, sha256: sha256(readFileSync(resolve(dir, key))) }];
    });
  }
  assert.deepEqual(tree(), binding.nexus.upstreamFiles, 'NEXUS_SOURCE_CHANGED');
  assert.equal(sha256(JSON.stringify(binding.nexus.upstreamFiles)), binding.nexus.sourceDigest);
  const dependencyPath=resolve(root,'DependencyBindings.json');
  verifyDependencies(JSON.parse(readFileSync(dependencyPath)));
  return { status: 'PASS', snapshotFiles: seen.size, nexusFiles: binding.nexus.upstreamFiles.length };
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/verify-inputs.mjs')) console.log(JSON.stringify(verifyInputs()));
