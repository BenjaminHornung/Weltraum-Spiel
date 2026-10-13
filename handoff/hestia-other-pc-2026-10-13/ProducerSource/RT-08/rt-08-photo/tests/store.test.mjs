import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {storeCapture} from '../capture-store.mjs';import {sha} from '../verify-inputs.mjs';
test('MOCK_ARTIFACT_STORAGE: bounded own-scope names/digests; reject traversal, drift, overwrite',async()=>{
 const root='negative-copies/store-'+randomUUID(),run='rt08-test';const bytes=[137,80,78,71,13,10,26,10,0];
 const value={bytes,sidecar:{productIntegration:'NO',executionLocation:'LOCAL_WINDOWS_ISOLATED',samples:{min:32},png:{byteLength:bytes.length,sha256:sha(Uint8Array.from(bytes))}}};
 await assert.rejects(storeCapture(root,'../outside','32',value));await assert.rejects(storeCapture(root,run,'999',value));
 await assert.rejects(storeCapture(root,run,'32',{...value,bytes:[1,2,3]}));
 const bad=structuredClone(value);bad.sidecar.png.sha256='0'.repeat(64);await assert.rejects(storeCapture(root,run,'32',bad));
 await storeCapture(root,run,'32',value);assert.deepEqual(Array.from(await readFile(root+'/captures/'+run+'/32spp.png')),bytes);await assert.rejects(storeCapture(root,run,'32',value),/EEXIST/);
 await storeCapture(root,run,'diagnostics',{productIntegration:'NO',status:'MOCK_NOT_GPU_CAPTURE'});
});
