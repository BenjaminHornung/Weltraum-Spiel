import assert from "node:assert/strict";
import {Reader, digest} from "./static-wasm-reader.mjs";

export function schemaFromSource(source) {
    const start=source.indexOf("$mac! {"), end=source.indexOf("}; // end of mac case",start);
    assert.ok(start>=0&&end>start,"Actual shared_api macro");
    const body=source.slice(start+7,end).replace(/\/\/[^\n]*/g,"");
    const defs={};let parsed="";
    for(const m of body.matchAll(/(struct|enum)\s+(\w+)(?:<'a>)?\s*\{([^{}]*)\}/g)){
        assert.ok(!defs[m[2]],"Duplicate Source schema");
        if(m[1]==="struct"){
            const fields=[...m[3].matchAll(/(\w+)\s*:\s*([^,]+),/g)].map(x=>({name:x[1],type:x[2].trim().replaceAll("<'a>","").replaceAll("&'a str","str")}));
            assert.equal(m[3].replace(/(\w+)\s*:\s*([^,]+),/g,"").trim(),"","Unparsed actual fields");
            defs[m[2]]={kind:"struct",fields};
        }else{
            const variants=m[3].split(",").map(x=>x.trim()).filter(Boolean).map(x=>{
                const v=/^(\w+)(?:\(([^)]+)\))?$/.exec(x);assert.ok(v,"Actual enum variant");
                return {name:v[1],type:v[2]?.replaceAll("<'a>","").replaceAll("&'a str","str")??null};
            });
            defs[m[2]]={kind:"enum",variants};
        }
        parsed+=m[0];
    }
    assert.ok(Object.keys(defs).length>=20&&defs.Program,"Complete genuine shared_api schema");
    const residue=body.replace(/(struct|enum)\s+(\w+)(?:<'a>)?\s*\{([^{}]*)\}/g,"").replace(/[\s}]/g,"");
    assert.equal(residue,"","Unrecognized Source schema construct");
    return {defs,schemaVersion:/SCHEMA_VERSION:\s*&str\s*=\s*"([^"]+)"/.exec(source)?.[1]};
}
function readValue(r,type,defs,depth=0,budget={nodes:0}) {
    if(depth>64||++budget.nodes>1_000_000)r.fail("metadata structure bound");
    if(type==="u32")return r.u();
    if(type==="bool")return r.byte()!==0;
    if(type==="str"||type==="String"||type==="LitOrExpr")return r.str();
    const vector=/^Vec<(.+)>$/.exec(type);
    if(vector)return Array.from({length:r.count()},()=>readValue(r,vector[1],defs,depth+1,budget));
    const option=/^Option<(.+)>$/.exec(type);
    if(option){const tag=r.byte();if(tag===0)return null;if(tag!==1)r.fail("invalid metadata Option tag");return readValue(r,option[1],defs,depth+1,budget);}
    const def=defs[type];if(!def)r.fail("unbound metadata Source type "+type);
    if(def.kind==="struct"){const out={};for(const f of def.fields)out[f.name]=readValue(r,f.type,defs,depth+1,budget);return out;}
    const tag=r.byte(),variant=def.variants[tag];if(!variant)r.fail("invalid metadata enum tag "+type);
    return {variant:variant.name,value:variant.type===null?null:readValue(r,variant.type,defs,depth+1,budget)};
}
export function decodeProgram(bytes,schema) {
    const r=new Reader(bytes);const value=readValue(r,"Program",schema.defs);r.done();return value;
}
export function metadataPrograms(bytes,module,schema) {
    const programs=[];
    for(const section of module.custom.filter(s=>s.name==="__wasm_bindgen_unstable")){
        const r=new Reader(bytes,section.offset,section.offset+section.bytes);
        function frame(){
            const sizeBytes=r.take(4);const size=Buffer.from(sizeBytes).readUInt32LE();
            const offset=r.p,data=r.take(size);return {offset,data,bytes:size,sha256:digest(data)};
        }
        while(r.p<r.end){
            const header=frame();const json=new TextDecoder("utf-8",{fatal:true}).decode(header.data);
            assert.ok(json.startsWith("{")&&json.endsWith("}"),"Actual schema JSON boundary");
            const schemaHeader=JSON.parse(json);assert.equal(schemaHeader.schema_version,schema.schemaVersion,"Actual shared schema version");
            const payload=frame();const value=decodeProgram(payload.data,schema);
            programs.push({schemaHeader,header:{offset:header.offset,bytes:header.bytes,sha256:header.sha256},payload:{offset:payload.offset,bytes:payload.bytes,sha256:payload.sha256},value});
        }
    }
    assert.ok(programs.length>0,"Genuine custom metadata present");return programs;
}
export function safeRelative(value,label){
    assert.equal(typeof value,"string",label);
    assert.ok(value.length>0&&!value.includes("\u0000"),label+" empty/NUL");
    assert.ok(!value.includes("\\")&&!value.includes(":")&&!value.startsWith("/")&&!value.startsWith("//"),label+" absolute/platform path");
    assert.ok(value.split("/").every(part=>part!==""&&part!=="."&&part!==".."),label+" traversal");
    return value;
}
export function ioEvidence(programs) {
    const snippets=[],locals=[],dependencies=[],moduleImports=[],linked=[],starts=[],unresolved=[];
    function visitImport(mod,p,index){
        if(mod===null)return;
        if(mod.variant==="Inline"){
            if(mod.value>=p.value.inline_js.length)throw Error("metadata inline module index out of range");
            moduleImports.push({program:index,kind:"inline",index:mod.value});
        }else if(mod.variant==="Named"||mod.variant==="RawNamed"){
            const name=mod.value;moduleImports.push({program:index,kind:mod.variant,name});
            if(name.startsWith(".")||name.startsWith("/")||name.includes("\\")||/^[A-Za-z]:/.test(name)){
                unresolved.push({program:index,kind:"external_or_relative_named_module",name});
            }else if(!/^(?:@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(name)){
                unresolved.push({program:index,kind:"unbound_dynamic_module_specifier",name});
            }
        }else throw Error("unbound metadata module variant");
    }
    for(let i=0;i<programs.length;i++){
        const p=programs[i],v=p.value;safeRelative(v.unique_crate_identifier,"unique crate identifier");
        for(let j=0;j<v.inline_js.length;j++)snippets.push({program:i,path:"snippets/"+v.unique_crate_identifier+"/inline"+j+".js",bytes:Buffer.byteLength(v.inline_js[j]),sha256:digest(Buffer.from(v.inline_js[j]))});
        for(const m of v.local_modules){
            safeRelative(m.identifier,"local module identifier");
            locals.push({program:i,path:"snippets/"+m.identifier,linkedModule:m.linked_module,defaultSplitLinkedModules:false,written:!m.linked_module,bytes:Buffer.byteLength(m.contents),sha256:digest(Buffer.from(m.contents))});
        }
        if(v.package_json!==null)dependencies.push({program:i,path:v.package_json,status:"ACTUAL_ADDITIONAL_READ_REQUIRES_EXACT_BINDING"});
        for(const m of v.imports)visitImport(m.module,p,i);
        for(const m of v.linked_modules){visitImport(m.module,p,i);linked.push({program:i,module:m.module,linkFunction:m.link_function_name});}
        for(const e of v.exports)if(e.start.variant!=="None")starts.push({program:i,function:e.function.name,start:e.start.variant,class:e.class});
    }
    return {programs:programs.length,snippets,localModules:locals,dependencyPackageJsonReads:dependencies,moduleImports,linkedModules:linked,metadataStartExports:starts,unresolvedNamedModules:unresolved,
        outputNames:["rapier_wasm3d_bg.wasm","rapier_wasm3d.js","rapier_wasm3d.d.ts","rapier_wasm3d_bg.wasm.d.ts"],
        mode:"web",outName:"rapier_wasm3d",splitDebugInfo:false,splitLinkedModules:false,
        noInstall:true,noSourceOrSnippetExecution:true,
        ioClosed:dependencies.length===0&&unresolved.length===0};
}
