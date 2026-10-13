import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {traceBruteForce} from '../inputs/rt01/src/bruteForce.mts';
import {traceDda} from '../inputs/rt01/src/dda.mts';
import {verifyInputs,loadFixtures,parity,evidence} from '../inputs.mjs';
await verifyInputs();
const {rays,volumes,fixtureSha256}=await loadFixtures(),counts={};
for(const r of rays){const v=volumes.get(r.volumeId);parity(traceBruteForce(v,r.ray),r.expected,r.ray.id+' AABB');parity(traceDda(v,r.ray),r.expected,r.ray.id+' DDA');counts[r.expected.kind]=(counts[r.expected.kind]??0)+1;}
assert.deepEqual(counts,{Hit:52,Miss:810,Unknown:112,BudgetExceeded:26});
const result={status:'PASS',oracle:'UNCHANGED_RT01_INDEPENDENT_AABBS_AND_DDA',rays:1000,comparisons:2000,counts,fixtureSha256,executionLocation:'LOCAL_WINDOWS_ISOLATED',gpu:'NOT_RUN',productIntegration:'NO'};
await mkdir(evidence,{recursive:true});await writeFile(path.join(evidence,'control.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
