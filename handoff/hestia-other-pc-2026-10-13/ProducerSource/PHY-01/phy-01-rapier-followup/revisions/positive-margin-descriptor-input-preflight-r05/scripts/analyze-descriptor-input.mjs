import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import {Reader,parseModule,digest,LIMITS} from "./static-wasm-reader.mjs";
import {schemaFromSource,metadataPrograms,ioEvidence} from "./static-metadata-reader.mjs";
import {descriptorGraph} from "./descriptor-static-graph.mjs";
import {selfChecks} from "./static-reader-self-checks.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
assert.equal(resolve(process.cwd()),root);
assert.match(process.argv[2]??"",/^[a-z0-9-]{1,64}$/);
const run=process.argv[2],out=join(root,"results",run);
mkdirSync(out,{recursive:false});
const put=(name,data)=>writeFileSync(join(out,name),JSON.stringify(data,null,2)+"\n",{flag:"wx"});
const input=join(root,"inputs/r04/inputs/r03/outputs/cargo-release/rapier_wasm3d.wasm");
const shared=join(root,"inputs/r04/public-source/wasm-bindgen/crates/shared/src/lib.rs");
const sharedText=readFileSync(shared,"utf8");
const checks=selfChecks(sharedText);put("self-checks.json",{population:"R05_STATIC_PARSER_SYNTHETIC_NOT_PHYSICS",checks,count:checks.length});
console.log(JSON.stringify({stage:"self-checks",count:checks.length,status:"STATIC_CHECK_OK"}));
const bytes=readFileSync(input);assert.equal(bytes.length,4075328);assert.equal(digest(bytes),"9f6a79d440b1d4f102624752109fade394f4460bea8ed7992ea52be3b38efc37");
let module,graph;
const reuse=run!=="static-input-01";
if(reuse){
    const bindings=JSON.parse(readFileSync(join(root,"graph-reuse-binding.json"),"utf8"));
    for(const b of bindings){const data=readFileSync(b.path);assert.equal(data.length,b.bytes);assert.equal(digest(data),b.sha256);}
    module=JSON.parse(readFileSync(bindings.find(b=>b.path.endsWith("module-index.json")).path,"utf8"));
    graph=JSON.parse(readFileSync(bindings.find(b=>b.path.endsWith("descriptor-graph.json")).path,"utf8"));
    assert.equal(module.input.sha256,digest(bytes));
    module.functionCount=module.counts.function;module.budget={instructions:module.instructionCount};
}else module=parseModule(bytes);
put("module-index.json",{input:{bytes:bytes.length,sha256:digest(bytes)},limits:LIMITS,sections:module.sections,custom:module.custom,types:module.types,imports:module.imports,counts:module.counts,exports:module.exports,tables:module.tables,memories:module.memories,globals:module.globals,elements:module.elements,data:module.data,tags:module.tags,start:module.start,functionNames:module.names,instructionCount:module.budget.instructions,semanticValidation:"NOT_A_WASM_VALIDATOR_OR_ENGINE",moduleInstantiated:false});
console.log(JSON.stringify({stage:"module-index",functions:module.functionCount,instructions:module.budget.instructions}));
if(!reuse)graph=descriptorGraph(module,bytes);
if(!reuse)put("descriptor-graph.json",graph);
else put("graph-reuse.json",{sourceRun:"static-input-01",inputSha256:digest(bytes),bindings:JSON.parse(readFileSync(join(root,"graph-reuse-binding.json"),"utf8")),noOpcodeOrGraphReplay:true});
console.log(JSON.stringify({stage:"graph",named:graph.namedExports.length,generic:graph.genericRoots.length,reached:graph.reachedFunctions.length,unresolved:graph.unresolved.length,finiteBound:graph.finiteDescriptorInstructionVisitsUpperBound}));
const schema=schemaFromSource(sharedText);
put("actual-source-schema.json",{source:shared,sha256:digest(Buffer.from(sharedText)),...schema});
const programs=metadataPrograms(bytes,module,schema);put("metadata-programs.json",programs);
const io=ioEvidence(programs);put("metadata-io.json",io);
const typeSection=module.sections.find(s=>s.id===3),codeSection=module.sections.find(s=>s.id===10);
const typeReader=new Reader(bytes,typeSection.payloadOffset,typeSection.payloadOffset+typeSection.bytes);
const functionTypes=Array.from({length:typeReader.count()},()=>typeReader.u());typeReader.done();
const codeReader=new Reader(bytes,codeSection.payloadOffset,codeSection.payloadOffset+codeSection.bytes);
const bodyCount=codeReader.count();assert.equal(bodyCount,functionTypes.length);
const importedCount=module.imports.filter(i=>i.kind===0).length;
const functionMembers=[];
for(let i=0;i<bodyCount;i++){
    const length=codeReader.u(),offset=codeReader.p,body=codeReader.take(length),id=importedCount+i;
    const reached=graph.reachedFunctions.find(f=>f.function===id);
    functionMembers.push({function:id,type:functionTypes[i],bodyOffset:offset,bodyBytes:length,bodySha256:digest(body),descriptorClosureMember:!!reached,visitedPrefixOpcodeCount:reached?.conservativeVisitedPrefixCount??null});
}
codeReader.done();
put("function-members.json",functionMembers);
put("summary.json",{schema:"hestia.phy01.r05.actual-input-static-preflight.v1",input:{bytes:bytes.length,sha256:digest(bytes)},sourceDigest:"f6f31c7d6fe0f7a8d6820664d291d62514b23de0893b36d82e3dbee283369ab3",selfChecks:checks.length,moduleFunctions:module.functionCount,moduleInstructions:module.budget.instructions,namedDescriptorExports:graph.namedExports.length,genericMarkerRoots:graph.genericRoots.length,descriptorCalleeFunctions:graph.reachedFunctions.length,staticClosureClosed:graph.staticClosureClosed,finiteInstructionVisitsUpperBound:graph.finiteDescriptorInstructionVisitsUpperBound,unresolved:graph.unresolved,metadataPrograms:programs.length,ioClosed:io.ioClosed,snippetWrites:io.snippets.length,localModuleWrites:io.localModules.filter(x=>x.written).length,dependencyReads:io.dependencyPackageJsonReads.length,metadataStartExports:io.metadataStartExports,descriptorEvaluation:false,cliStarts:0,physicsStarts:0,interpretationGranted:false,sourceBinaryReproducibleLock:"UNPROVEN_UNACCEPTED",fullGoal:"ACTIVE_INCOMPLETE"});
console.log(JSON.stringify({stage:"metadata",programs:programs.length,snippets:io.snippets.length,locals:io.localModules.length,dependencies:io.dependencyPackageJsonReads.length,ioClosed:io.ioClosed,descriptorEvaluated:false}));
