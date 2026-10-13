import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import {Reader,instruction,digest} from "./static-wasm-reader.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),run=process.argv[2];
assert.equal(resolve(process.cwd()),root);assert.match(run??"",/^literal-proof-[0-9]{2}$/);
const bytes=readFileSync(join(root,"inputs/r04/inputs/r03/outputs/cargo-release/rapier_wasm3d.wasm"));
assert.equal(digest(bytes),"9f6a79d440b1d4f102624752109fade394f4460bea8ed7992ea52be3b38efc37");
const graph=JSON.parse(readFileSync(join(root,"results/static-input-01/descriptor-graph.json"),"utf8"));
const index=JSON.parse(readFileSync(join(root,"results/static-input-01/module-index.json"),"utf8"));
const members=JSON.parse(readFileSync(join(root,"results/static-input-02/function-members.json"),"utf8"));
const keySource=readFileSync(join(root,"inputs/r04/public-source/wasm-bindgen/crates/cli-support/src/descriptor.rs"),"utf8");
const interpreterSource=readFileSync(join(root,"inputs/r04/public-source/wasm-bindgen/crates/cli-support/src/interpreter/mod.rs"),"utf8");
assert.match(keySource,/let key = get_string\(&mut data\);/);
assert.match(keySource,/if key\.is_empty\(\)\s*\{\s*GenericImportKey::Cast/);
assert.match(interpreterSource,/let val = stack\.pop\(\)\.unwrap\(\);[\s\S]{0,160}self\.interp\.descriptor\.push\(val as u32\)/);
function decodeBody(m){
    const r=new Reader(bytes,m.bodyOffset,m.bodyOffset+m.bodyBytes),groups=r.count();const locals=[];
    for(let i=0;i<groups;i++)locals.push({count:r.u(),type:r.byte()});
    const tokens=[];while(r.p<r.end)tokens.push(instruction(r));r.done();return {locals,tokens};
}
function emptyKeyPattern(tokens,sink){
    const first=tokens.findIndex(n=>n.op===0x10&&n.imm[0]===sink);
    assert.ok(first>=1,"First actual metadata sink required");
    const literal=tokens[first-1];assert.equal(literal.op,0x41,"Literal i32 immediately before sink");assert.equal(literal.imm[0],0,"Zero literal key length");
    assert.ok(tokens.slice(0,first-1).every(n=>[0x20,0x21,0x22,0x23,0x24,0x41,0x6a,0x6b].includes(n.op)),"No earlier call/control path or prior metadata emitter");
    return {literalOffset:literal.offset,sinkOffset:tokens[first].offset,encodedLiteral:literal.imm[0],sinkFunction:sink};
}
const synthetic=(op,imm=[])=>({op,imm,offset:0});
const checks=[];
function good(n,fn){fn();checks.push({name:n,result:"STATIC_PATTERN_OK"});}
function bad(n,fn){assert.throws(fn);checks.push({name:n,result:"UNPROVEN_PATTERN_REJECTED"});}
good("literal empty key",()=>emptyKeyPattern([synthetic(0x41,[0]),synthetic(0x10,[8])],8));
bad("nonempty key not classified",()=>emptyKeyPattern([synthetic(0x41,[1]),synthetic(0x10,[8])],8));
bad("dynamic key not classified",()=>emptyKeyPattern([synthetic(0x20,[0]),synthetic(0x10,[8])],8));
bad("earlier callee may emit metadata",()=>emptyKeyPattern([synthetic(0x10,[99]),synthetic(0x41,[0]),synthetic(0x10,[8])],8));
bad("conditional key remains unknown",()=>emptyKeyPattern([synthetic(0x04,[null]),synthetic(0x41,[0]),synthetic(0x10,[8])],8));
bad("wrong sink remains unknown",()=>emptyKeyPattern([synthetic(0x41,[0]),synthetic(0x10,[9])],8));
assert.equal(graph.genericRoots.length,1);
const id=graph.genericRoots[0].function,member=members.find(m=>m.function===id);assert.ok(member);
const body=decodeBody(member);const key=emptyKeyPattern(body.tokens,graph.descriptorImport.index);
const first=body.tokens.slice(0,5);assert.deepEqual(first.map(x=>x.op),[0x23,0x41,0x6b,0x22,0x24]);
assert.equal(first[0].imm[0],first[4].imm[0]);const global=first[0].imm[0],reserve=first[1].imm[0],local=first[3].imm[0];
assert.equal(global,0);assert.equal(reserve,16);
const marker=body.tokens.findIndex(n=>n.op===0x10&&n.imm[0]===graph.genericMarkerImport.index);
assert.ok(marker>5);
const prefix=body.tokens.slice(0,marker+1);
assert.equal(prefix.filter(n=>n.op===0x24).length,1);
const store=prefix.findIndex(n=>n.op===0x39);assert.ok(store>=2);
assert.deepEqual(prefix.slice(store-2,store).map(n=>[n.op,n.imm[0]]),[[0x20,local],[0x20,0]]);
const operand=prefix[store].imm;assert.equal(operand[1],0);assert.equal(operand[2],8);
const initial=index.globals[global].init;assert.equal(initial[0].op,0x41);assert.equal(initial.length,2);
const sp=initial[0].imm[0],capacity=index.memories[0].min*65536;
assert.ok(sp-reserve>0&&(sp-reserve)%4===0&&sp-reserve+operand[2]+8<=capacity);
const skip=members.find(m=>m.function===graph.skipExport.index);const skipBody=decodeBody(skip);
assert.deepEqual(skipBody.tokens.map(n=>n.op),[0x0b]);
const out=join(root,"results",run);mkdirSync(out,{recursive:false});
const evidence={schema:"hestia.phy01.r05.literal-source-pattern-proof.v1",inputSha256:digest(bytes),selfChecks:checks,
 genericFunction:{...member,locals:body.locals,decodedInstructionBytes:body.tokens},
 emptyKeyProof:{...key,classification:"SOURCE_AND_LITERAL_BYTES_PROVE_GenericImportKey_Cast_WBG_CAST",reason:"first metadata sink is immediately preceded by literal i32 zero, no earlier calls/control; original Source consumes first metadata word as string length and maps empty key to Cast",descriptorFunctionEvaluated:false,descriptorNumericSignature:"NOT_GENERATED_OR_EVALUATED"},
 stackMemoryPattern:{globalIndex:global,stackPointerLiteral:sp,reservationLiteral:reserve,addressLocal:local,storeOffset:operand[2],storeWidth:8,memoryInitialBytes:capacity,addressInterval:[sp-reserve+operand[2],sp-reserve+operand[2]+8],staticBoundsClosed:true,sourceMarkerRestoresStackPointer:true,meaning:"syntactic prologue/store plus interval arithmetic over literal initial metadata; no simulated opcode values or VM state"},
 constructorSkip:{function:skip.function,bodySha256:skip.bodySha256,actualInstructions:skipBody.tokens.map(n=>n.op),ctorCalls:0},
 programmeEffects:{descriptorStarts:0,cliStarts:0,wasmApis:0,physicsStarts:0,hostQueries:0},fullGoal:"ACTIVE_INCOMPLETE"};
writeFileSync(join(out,"literal-proof.json"),JSON.stringify(evidence,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({staticPatternChecks:checks.length,genericFunction:id,classification:evidence.emptyKeyProof.classification,memoryBoundsClosed:true,constructorCalls:0,descriptorEvaluated:false}));
