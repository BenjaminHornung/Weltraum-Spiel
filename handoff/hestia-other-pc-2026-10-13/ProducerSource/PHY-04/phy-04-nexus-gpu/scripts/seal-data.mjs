import assert from 'node:assert/strict';
import {sha256} from './commands.mjs';
export function assertNoForeignStage(paths,allowed) {
  for(const path of paths) assert.ok(allowed.some(prefix=>path.startsWith(prefix)),'STAGED_OUT_OF_SCOPE:'+path);
}
export function assertFreshSeal(previous,current,payload) {
  for(const key of ['schema','baseline','branch','scope','dirtyTreeDigest','indexBytesSha256','indexEntriesSha256',
    'trackedDiffSha256','stagedDiffSha256','unstagedDiffSha256','reviewPatchSha256','payloadDigest']) {
    assert.equal(previous[key],current[key],'SEAL_STALE:'+key);
  }
  assert.equal(sha256(JSON.stringify(previous.changedFiles)),previous.dirtyTreeDigest,'STORED_DIRTY_LIST_TAMPERED');
  assert.deepEqual(previous.changedFiles,current.changedFiles,'STORED_DIRTY_LIST_STALE');
  assert.deepEqual(previous.canonicalLfs,current.canonicalLfs,'STORED_LFS_LIST_STALE');
  assert.equal(sha256(JSON.stringify(payload.files)),payload.digest,'STORED_PAYLOAD_LIST_TAMPERED');
  assert.equal(payload.digest,current.payloadDigest,'PAYLOAD_STALE');
}
