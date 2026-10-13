import assert from "node:assert/strict";
import {digest} from "./static-wasm-reader.mjs";

const DIRECT=new Set([0x10,0x12]);
const CONTROL=new Set([0x02,0x03,0x04,0x06,0x1f,0x0c,0x0d,0x0e,0xd5,0xd6,0x18]);
const ALLOWED=new Set([0x02,0x03,0x04,0x05,0x06,0x07,0x0b,0x0c,0x0d,0x0e,0x0f,0x10,0x12,0x19,0x1a,0x1b,0x1c,0x1f,0x20,0x21,0x22,0x23,0x24,0x41,0x42,0x45,0x46,0x47,0x48,0x49,0x4a,0x4b,0x4c,0x4d,0x4e,0x4f,0x50,0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x6a,0x6b,0x71,0x72,0x73,0x74,0x7c,0x7d,0x83,0x84,0x85,0x86,0xa7,0xac,0xad]);
for(const op of [0x28,0x29,0x2a,0x2b,0x2c,0x2d,0x36,0x37,0x38,0x39,0x3a,0x3c,0x3e])ALLOWED.add(op);
export function descriptorGraph(module,bytes){
    const fById=new Map(module.functions.map(f=>[f.index,f]));
    const imports=new Map(module.functionImports.map(f=>[f.index,f]));
    const matching=name=>module.functionImports.filter(x=>x.namespace==="__wbindgen_placeholder__"&&x.name===name);
    const describe=matching("__wbindgen_describe"),generic=matching("__wbindgen_describe_generic_import");
    assert.ok(describe.length<=1&&generic.length<=1,"Ambiguous descriptor imports");
    const describeId=describe[0]?.index??null,genericId=generic[0]?.index??null;
    const skipExport=module.exports.find(e=>e.name==="__wbindgen_skip_interpret_calls");
    const skip=new Set(),skipEdges=[];
    if(skipExport){
        assert.equal(skipExport.kind,0,"Actual skip export kind");
        const body=fById.get(skipExport.index);assert.ok(body,"Actual local skip function");
        for(const n of body.tokens)if(DIRECT.has(n.op)&&n.depth===0){skip.add(n.imm[0]);skipEdges.push({caller:body.index,callee:n.imm[0],offset:n.offset});}
    }
    const named=module.exports.filter(e=>e.name.startsWith("__wbindgen_describe_"));
    for(const e of named)assert.equal(e.kind,0,"Descriptor export function");
    const genericRoots=[];
    for(const f of module.functions){
        const sites=genericId===null?[]:f.tokens.filter(n=>DIRECT.has(n.op)&&n.imm[0]===genericId);
        if(sites.length)genericRoots.push({function:f.index,markerCalls:sites.length,markerOffsets:sites.map(n=>n.offset),markerDepths:sites.map(n=>n.depth)});
    }
    const roots=[...named.map(e=>({kind:"named_descriptor_export",function:e.index,export:e.name})),...genericRoots.map(f=>({kind:"generic_marker_root",...f}))];
    const initialTable=[];
    for(const e of module.elements.filter(e=>e.active)){
        const concrete=e.offsetI32!==null&&e.offsetI32>=0&&e.entries.every(x=>x.function!==undefined||x.null);
        initialTable.push({table:e.table,offset:e.offsetI32,concrete,functions:e.entries.map((x,j)=>({slot:e.offsetI32===null?null:e.offsetI32+j,function:x.function??null,unknown:!!x.unknown}))});
    }
    const invoke=module.functionImports.filter(x=>x.namespace==="env"&&x.name.startsWith("invoke_"));
    const reached=new Map(),edges=[],unresolved=[],ignoredSuffixes=[],cycles=[];
    const costs=new Map(),visiting=[];
    function name(id){return module.names[id]??module.exports.find(e=>e.kind===0&&e.index===id)?.name??null;}
    function fn(id){
        if(costs.has(id))return costs.get(id);
        if(visiting.includes(id)){cycles.push([...visiting.slice(visiting.indexOf(id)),id]);return {finite:false,bound:null,mustStop:false};}
        const body=fById.get(id);
        if(!body){unresolved.push({kind:"non_local_descriptor_callee",function:id,import:imports.get(id)??null});return {finite:false,bound:null,mustStop:false};}
        visiting.push(id);
        let bound=0n,finite=true,mustStop=false,linear=true;const used=[];
        for(let i=0;i<body.tokens.length;i++){
            const n=body.tokens[i];used.push(n);bound++;
            if(!ALLOWED.has(n.op)){finite=false;unresolved.push({kind:"unsupported_interpreter_opcode",function:id,offset:n.offset,opcode:n.op});}
            if(n.op===0x03){finite=false;unresolved.push({kind:"loop_iteration_bound_unknown",function:id,offset:n.offset});}
            if(CONTROL.has(n.op))linear=false;
            if(n.op===0x11||n.op===0x13||n.op===0x14||n.op===0x15){
                finite=false;unresolved.push({kind:"dynamic_indirect_or_ref_call_unsupported_by_exact_interpreter",function:id,offset:n.offset,opcode:n.op,immediates:n.imm,finiteInitialTableTargets:n.imm[1]===undefined?null:initialTable.filter(x=>x.table===n.imm[1])});
            }
            if(DIRECT.has(n.op)){
                const target=n.imm[0],edge={caller:id,callee:target,offset:n.offset,opcode:n.op,depth:n.depth};
                if(target===describeId){edge.action="INLINED_METADATA_SINK";}
                else if(target===genericId){edge.action="GENERIC_MARKER_GLOBAL_STOP";if(linear&&n.depth===0){mustStop=true;ignoredSuffixes.push({function:id,after:n.offset,bytesRemaining:body.offset+body.bytes-(body.tokens[i+1]?.offset??body.offset+body.bytes),instructions:body.tokens.length-i-1});}}
                else if(skip.has(target)){edge.action="SOURCE_CTOR_SKIP";}
                else if(["__llvm_profile_init","__llvm_profile_register_function"].some(p=>name(target)?.startsWith(p))){edge.action="SOURCE_PROFILE_SKIP";}
                else if(imports.has(target)){
                    edge.action=invoke.some(x=>x.index===target)?"INTERNAL_INVOKE_TABLE_REDIRECTION_UNKNOWN_INDEX":"FORBIDDEN_IMPORTED_CALL_PANIC";
                    finite=false;unresolved.push({kind:edge.action,function:id,offset:n.offset,target,import:imports.get(target),tableCandidates:initialTable});
                }else{
                    edge.action="LOCAL_CALLEE";
                    const child=fn(target);if(child.finite)bound+=BigInt(child.bound);else finite=false;
                    if(child.mustStop&&linear&&n.depth===0)mustStop=true;
                }
                edges.push(edge);
                if(mustStop)break;
            }
            if(n.op===0x0f&&linear&&n.depth===0)break;
            if(n.op===0x12&&linear&&n.depth===0)break;
        }
        visiting.pop();
        const member={function:id,name:name(id),type:body.type,params:module.types[body.type].params,results:module.types[body.type].results,bodyOffset:body.offset,bodyBytes:body.bytes,bodySha256:digest(bytes.subarray(body.offset,body.offset+body.bytes)),
            actualOpcodeCount:body.tokens.length,conservativeVisitedPrefixCount:used.length,opcodes:[...new Set(used.map(n=>n.op))].sort((a,b)=>a-b),loopSites:used.filter(n=>n.op===0x03).map(n=>n.offset),stateAccesses:used.filter(n=>n.op===0x23||n.op===0x24||n.op>=0x28&&n.op<=0x3e).map(n=>({opcode:n.op,offset:n.offset,immediates:n.imm})),
            finiteInstructionVisits:finite&&cycles.length===0?bound.toString():null,mustStopAtMarker:mustStop,structuralLinearPrefix:linear};
        reached.set(id,member);
        const result={finite,bound:finite?bound.toString():null,mustStop};costs.set(id,result);return result;
    }
    const rootEvidence=roots.map(root=>({...root,name:name(root.function),...fn(root.function)}));
    const badMarkerCount=genericRoots.filter(x=>x.markerCalls!==1);
    const markerSelectionUnproven=genericRoots.filter(g=>{
        const f=fById.get(g.function),site=f.tokens.findIndex(n=>DIRECT.has(n.op)&&n.imm[0]===genericId);
        return f.tokens[site].depth!==0||f.tokens.slice(0,site).some(n=>CONTROL.has(n.op)||n.op===0x0f||n.op===0x12);
    });
    if(badMarkerCount.length)unresolved.push({kind:"EXACT_SOURCE_REJECTS_MULTIPLE_GENERIC_MARKERS",roots:badMarkerCount});
    if(markerSelectionUnproven.length)unresolved.push({kind:"RAW_MARKER_TO_WALRUS_IR_SELECTION_NOT_EXACTLY_PROVEN",roots:markerSelectionUnproven});
    const shared=[...module.imports.filter(x=>x.kind===2).map(x=>x.value),...module.memories].some(x=>x.shared);
    const emscripten=module.custom.some(x=>x.name==="__wasm_bindgen_emscripten_marker");
    const cppTag=module.imports.some(x=>x.kind===4&&x.namespace==="env"&&x.name==="__cpp_exception");
    if(shared||emscripten||cppTag)unresolved.push({kind:"PRE_DESCRIPTOR_TRANSFORM_CHANGES_REQUIRE_ADDITIONAL_SOURCE_BINDING",shared,emscripten,cppTag});
    if(module.start!==null&&reached.has(module.start))unresolved.push({kind:"INPUT_START_REACHABLE_FROM_DESCRIPTOR",function:module.start});
    const total=rootEvidence.every(x=>x.finite)&&unresolved.length===0&&cycles.length===0?rootEvidence.reduce((sum,x)=>sum+BigInt(x.bound),0n).toString():null;
    return {
        namedExports:named,genericRoots,roots:rootEvidence,descriptorImport:describe[0]??null,genericMarkerImport:generic[0]??null,
        skipExport:skipExport??null,constructorSkipEdges:skipEdges,skippedFunctions:[...skip].map(id=>({function:id,name:name(id)})),
        invokeImports:invoke,initialTables:initialTable,tableBoundsMeaning:"initial syntactic element targets only; dynamic invocation is never silently resolved",
        reachedFunctions:[...reached.values()].sort((a,b)=>a.function-b.function),edges:edges.sort((a,b)=>a.caller-b.caller||a.offset-b.offset),
        cycles,unresolved,ignoredPostMarkerSuffixes:ignoredSuffixes,
        selectionExactForThisRaw:markerSelectionUnproven.length===0&&!shared&&!emscripten&&!cppTag&&badMarkerCount.length===0,
        preprocessing:{sharedMemory:shared,emscriptenOverride:emscripten,cppTagRewrite:cppTag,note:"No shared-memory threading rewrite, Emscripten override or cpp tag rewrite when false. Demangling/export pruning do not change these selected call bodies."},
        rawStart:module.start,rawStartReached:module.start!==null&&reached.has(module.start),
        finiteDescriptorInstructionVisitsUpperBound:total,
        boundMeaning:"conservative static encoded-instruction visits expanded over acyclic direct calls; includes end delimiters; only exact descriptor evaluation path, not total CLI CPU/IO/metadata processing time",
        timeoutIsFuel:false,descriptorValuesEvaluated:false,genericKeysEvaluated:false,
        wbgCastClassification:"same generic-marker roots are listed; key/signature semantic subtype is not evaluated; names are corroboration only",
        staticClosureClosed:unresolved.length===0&&cycles.length===0&&total!==null
    };
}
