import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, fileBinding, verifyMembers, verifyInputs, verifyInventory, files, verifyTools } from '../scripts/bindings.mjs';

test('real byte checker rejects a same-length content mutation and changed length', () => {
  const directory = mkdtempSync(resolve(root, '.runtime/byte-negative-'));
  const path = resolve(directory, 'snapshot.bin');
  writeFileSync(path, Buffer.from([1, 2, 3]));
  const original = fileBinding('snapshot.bin', directory);
  verifyMembers([original], directory);
  writeFileSync(path, Buffer.from([1, 9, 3]));
  assert.throws(() => verifyMembers([original], directory), /BYTE_DRIFT/);
  writeFileSync(path, Buffer.from([1, 2]));
  assert.throws(() => verifyMembers([original], directory), /BYTE_DRIFT/);
});
test('input member checker rejects duplicate membership and traversal', () => {
  const entry = fileBinding('InputBindings.json');
  assert.throws(() => verifyMembers([entry, entry]), /INVALID_MEMBER/);
  assert.throws(() => verifyMembers([{ path: '../foreign.txt', bytes: 0, sha256: '' }]), /INVALID_MEMBER/);
});
test('late unbound source/test member fails the actual inventory checker before imports', () => {
  const directory = mkdtempSync(resolve(root, '.runtime/source-negative-'));
  writeFileSync(resolve(directory, 'bound.test.mjs'), 'export const value = 1;');
  const bound = [fileBinding('./bound.test.mjs', directory)];
  verifyInventory(bound, files('.', directory));
  writeFileSync(resolve(directory, 'late.test.mjs'), "throw Error('UNBOUND_TEST_EXECUTED');");
  assert.throws(() => verifyInventory(bound, files('.', directory)), /SOURCE_MEMBER_DRIFT/);
});
test('actual installed compiler byte drift is rejected against the frozen pre-execution archive binding', () => {
  const path = resolve(root, 'node_modules/typescript/lib/tsc.js'), original = readFileSync(path);
  verifyTools();
  try {
    writeFileSync(path, Buffer.concat([original, Buffer.from("\nthrow Error('MUTATED_COMPILER_EXECUTED');\n")]));
    assert.throws(() => verifyTools(), /BYTE_DRIFT/);
  } finally { writeFileSync(path, original); }
  verifyTools();
});
test('PLT semantic profile digest and actual file-byte digest are independently verified', () => {
  const result = verifyInputs();
  assert.equal(result.producerMembershipVerified, 102);
  assert.equal(result.copiedMembers.length, 27);
  assert.equal(result.profileContentDigest, 'sha256:64e7977f9b510d74aa61fc37edae076c94ef7a3d0fda09b1fd9cf14e364bb714');
  assert.equal(result.profileFileSha256, 'c7652cc948a0f213a8a29ff75bdb0a76ede71344c315f924fcc541e6f7ead551');
  assert.notEqual(result.profileContentDigest, 'sha256:' + result.profileFileSha256);
});
