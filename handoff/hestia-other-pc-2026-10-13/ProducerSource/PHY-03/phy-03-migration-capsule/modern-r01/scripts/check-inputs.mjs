import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const modern=resolve(import.meta.dirname,'..'), root=resolve(modern,'../../..');
const binding=JSON.parse(readFileSync(resolve(modern,'input-binding.json')));
const context=JSON.parse(readFileSync(resolve(modern,'context-binding.json')));
const supplement=JSON.parse(readFileSync(resolve(modern,'supplement-binding-r03.json')));
const lab=JSON.parse(readFileSync(resolve(modern,'lab-contract-binding.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(Buffer.from(JSON.stringify(binding.files))),binding.inputIndexSha256);
for(const row of binding.files){const b=readFileSync(resolve(modern,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}
assert.equal(sha(Buffer.from(JSON.stringify(context.files))),context.indexSha256);
for(const row of context.files){const b=readFileSync(resolve(modern,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}
assert.equal(sha(Buffer.from(JSON.stringify(supplement.files))),supplement.indexSha256);
for(const row of supplement.files){const b=readFileSync(resolve(modern,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}
assert.equal(sha(Buffer.from(JSON.stringify(lab.files))),lab.indexSha256);
for(const row of lab.files){const b=readFileSync(resolve(modern,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}
assert.equal(sha(readFileSync(resolve(modern,lab.derivedFixture.path))),lab.derivedFixture.sha256);
for(const row of binding.legacyRows){const b=readFileSync(resolve(root,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}
const review=readFileSync(resolve(modern,'../.runtime/final-review.diff'));
assert.equal(sha(review),binding.legacyReviewDiff.sha256);
console.log(JSON.stringify({status:'PASS',actualInputFiles:binding.files.length,partialContextFiles:context.files.length,r03SupplementFiles:supplement.files.length,a0LabContractFiles:lab.files.length,unchangedLegacyFiles:binding.legacyRows.length,inputIndexSha256:binding.inputIndexSha256,contextIndexSha256:context.indexSha256,supplementIndexSha256:supplement.indexSha256,labIndexSha256:lab.indexSha256,readOnly:true}));
