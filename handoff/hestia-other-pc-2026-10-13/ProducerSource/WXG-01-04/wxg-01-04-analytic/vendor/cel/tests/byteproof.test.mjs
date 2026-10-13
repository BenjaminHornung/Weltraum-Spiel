import test from 'node:test';
import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { root, verifyFileBindings, verifyLocal } from '../scripts/bind-inputs.mjs';

function scratch(t) {
  const runtime=resolve(root,'.runtime');
  const path=resolve(runtime,`byteproof-${randomUUID()}`);
  mkdirSync(path,{recursive:true});
  t.after(()=>{
    assert.equal(dirname(path),runtime);
    assert.equal(lstatSync(path).isSymbolicLink(),false);
    rmSync(path,{recursive:true,force:true});
  });
  return path;
}
function copyBoundFile(base,relativePath,bytes) {
  const path=resolve(base,...relativePath.split('/'));
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);
}

test('shared local source verifier rejects a changed copied PLT numerics byte',t=>{
  const manifest=verifyLocal();
  const bound=manifest.files.find(f=>f.localPath==='vendor/plt/src/numerics.mjs');
  assert.ok(bound);
  const bytes=readFileSync(resolve(root,bound.localPath)), base=scratch(t);
  copyBoundFile(base,bound.localPath,bytes);
  verifyFileBindings(base,[bound]);
  const changed=Buffer.from(bytes);changed[0]^=0xff;copyBoundFile(base,bound.localPath,changed);
  assert.throws(()=>verifyFileBindings(base,[bound]),/LOCAL_SNAPSHOT_DRIFT/);
});

test('measured schema golden binding rejects changed bytes and corrupt length or hash',t=>{
  const bound={localPath:'fixtures/schema-goldens.json',bytes:3541,sha256:'440055a05cdbeba03d7acab8ecb5b95e8bccc6beafd9a953a9bfd663981de156'};
  verifyFileBindings(root,[bound]);
  const bytes=readFileSync(resolve(root,bound.localPath)),base=scratch(t);
  copyBoundFile(base,bound.localPath,bytes);verifyFileBindings(base,[bound]);
  const changed=Buffer.from(bytes);changed[0]^=0xff;copyBoundFile(base,bound.localPath,changed);
  assert.throws(()=>verifyFileBindings(base,[bound]),/LOCAL_SNAPSHOT_DRIFT/);
  assert.throws(()=>verifyFileBindings(base,[{...bound,bytes:bound.bytes+1}]),/LOCAL_SNAPSHOT_DRIFT/);
  assert.throws(()=>verifyFileBindings(base,[{...bound,sha256:'0'.repeat(64)}]),/LOCAL_SNAPSHOT_DRIFT/);
  assert.throws(()=>verifyFileBindings(base,[{...bound,sha256:'bad'}]),/INVALID_LOCAL_BINDING/);
});

test('shared local source verifier rejects unresolved and escaping paths',t=>{
  const base=scratch(t),bound={bytes:1,sha256:'0'.repeat(64)};
  assert.throws(()=>verifyFileBindings(base,[{...bound,localPath:'missing/file.bin'}]),/LOCAL_BINDING_PATH_UNRESOLVED/);
  assert.throws(()=>verifyFileBindings(base,[{...bound,localPath:'..\/outside.bin'}]),/INVALID_LOCAL_BINDING/);
});

test('shared local source verifier rejects directory symlinks',t=>{
  const base=scratch(t),target=resolve(base,'target'),alias=resolve(base,'alias');
  mkdirSync(target);writeFileSync(resolve(target,'file.bin'),Buffer.from([1]));
  symlinkSync(target,alias,'junction');
  assert.equal(lstatSync(alias).isSymbolicLink(),true);
  assert.throws(()=>verifyFileBindings(base,[{localPath:'alias/file.bin',bytes:1,sha256:'4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a'}]),/LOCAL_BINDING_SYMLINK/);
});
