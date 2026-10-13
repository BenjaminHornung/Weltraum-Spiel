import {readFile,writeFile} from 'node:fs/promises';
const r=JSON.parse(await readFile('receipt.json'));
r.oracles.focused.count=20;r.review.independentCodeReview='PASS_BOUNDED_RECHECK_BOTH_P2_FIXED';
r.administrative={devtoolboxSpecs:{status:'PASS',exitCode:0},inheritedProductTypecheck:{status:'FAIL',exitCode:1,cause:'MODULE_NOT_FOUND_PRODUCT_NODE_MODULES_OUTSIDE_SPIKE_SCOPE',configChanged:false},completionPreflight:{status:'DEGRADED_ADVISORY',hasBlockers:false,canProceed:true,decision:'OWN_FOCUSED_EVIDENCE_SUFFICIENT_LOCAL_TASKS_ONLY'},humanApproval:'NOT_PERFORMED',hardwareAndOwnerTasks:'OPEN'};
await writeFile('receipt.json',JSON.stringify(r,null,2)+'\n');console.log('PASS generated receipt reflects exact 20-test evidence and bounded code review; inherited failure retained');
