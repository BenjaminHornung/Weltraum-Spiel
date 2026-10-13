import {loadInputs,compare} from './inputs.mjs';
import {traceDda} from './imported/rt01/src/dda.mts';
import {traceBruteForce} from './imported/rt01/src/bruteForce.mts';
const {rays,volumes}=await loadInputs();
const counts={Hit:0,Miss:0,Unknown:0,BudgetExceeded:0};
for(const item of rays){const v=volumes.get(item.volumeId),r=item.ray;
 compare(traceBruteForce(v,r),item.expected,r.id+' frozen brute force');
 compare(traceDda(v,r),item.expected,r.id+' unchanged DDA');counts[item.expected.kind]++;}
console.log(JSON.stringify({status:'PASS',uniqueRays:rays.length,counts,volumes:[...volumes.values()].map(v=>({id:v.id,size:v.size,provenance:v.provenance})),sourceExports:0}));
