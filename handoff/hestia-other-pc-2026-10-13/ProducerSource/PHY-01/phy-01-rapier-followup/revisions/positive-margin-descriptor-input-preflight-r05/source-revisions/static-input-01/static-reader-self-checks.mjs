import assert from "node:assert/strict";
import {Reader,parseModule} from "./static-wasm-reader.mjs";
import {schemaFromSource,decodeProgram,safeRelative} from "./static-metadata-reader.mjs";
import {descriptorGraph} from "./descriptor-static-graph.mjs";

const u=n=>{const out=[];do{let b=n&127;n=Math.floor(n/128);if(n)b|=128;out.push(b);}while(n);return out;};
const str=s=>[...u(Buffer.byteLength(s)),...Buffer.from(s)];
const section=(id,b)=>[id,...u(b.length),...b];
const magic=[0,97,115,109,1,0,0,0];
function fixture(body=[0,0x41,1,0x10,0,0x0b],exports=[1,...str("__wbindgen_describe_test"),0,1]){
    return Uint8Array.from([...magic,...section(1,[1,0x60,0,0]),...section(2,[1,...str("__wbindgen_placeholder__"),...str("__wbindgen_describe"),0,0]),...section(3,[1,0]),...section(7,exports),...section(10,[1,...u(body.length),...body])]);
}
export function selfChecks(sharedSource){
    const checks=[];
    function good(name,fn){fn();checks.push({name,result:"STATIC_CHECK_OK"});}
    function bad(name,fn,pattern){assert.throws(fn,pattern);checks.push({name,result:"MALFORMED_REJECTED"});}
    good("u32 padded valid LEB",()=>assert.equal(new Reader(Uint8Array.from([0x81,0])).u(),1));
    good("signed i32 negative",()=>assert.equal(new Reader(Uint8Array.from([0x7f])).s(),-1));
    bad("truncated unsigned LEB",()=>new Reader(Uint8Array.from([0x80])).u(),/truncated/);
    bad("u32 overflow",()=>new Reader(Uint8Array.from([255,255,255,255,16])).u(),/overflow/);
    bad("overlong unsigned LEB",()=>new Reader(Uint8Array.from([128,128,128,128,128,0])).u(),/overlong/);
    bad("signed overflow",()=>new Reader(Uint8Array.from([255,255,255,255,15])).s(),/overflow/);
    bad("invalid UTF8",()=>new Reader(Uint8Array.from([1,0xff])).str(),/encoded data/);
    bad("subreader length",()=>new Reader(Uint8Array.from([0])).sub(2),/bounds/);
    bad("bad module header",()=>parseModule(Uint8Array.from([...magic.slice(0,7),2])),/header/);
    bad("truncated section",()=>parseModule(Uint8Array.from([...magic,1,10,0])),/bounds/);
    bad("duplicate section",()=>parseModule(Uint8Array.from([...magic,...section(1,[0]),...section(1,[0])])),/duplicate/);
    bad("out of order section",()=>parseModule(Uint8Array.from([...magic,...section(3,[0]),...section(1,[0])])),/order/);
    bad("export function index",()=>parseModule(fixture(undefined,[1,...str("x"),0,2])),/export index/);
    bad("duplicate export name",()=>parseModule(fixture(undefined,[2,...str("x"),0,1,...str("x"),0,1])),/duplicate export/);
    bad("call function index",()=>parseModule(fixture([0,0x10,9,0x0b])),/function index/);
    bad("local index",()=>parseModule(fixture([0,0x20,0,0x0b])),/local index/);
    bad("branch label",()=>parseModule(fixture([0,0x0c,1,0x0b])),/label/);
    bad("missing end",()=>parseModule(fixture([0,0x41,1])),/truncated/);
    bad("stray else",()=>parseModule(fixture([0,0x05,0x0b])),/unexpected else/);
    bad("trailing body byte",()=>parseModule(fixture([0,0x0b,0])),/trailing/);
    bad("unbound opcode prefix",()=>parseModule(fixture([0,0xfd,0,0x0b])),/unsupported/);
    const schema=schemaFromSource(sharedSource);
    const emptyProgram=[0,0,0,0,0,0,0,...str("fixture-0"),0,0];
    good("actual shared Source schema fields",()=>{const p=decodeProgram(Uint8Array.from(emptyProgram),schema);assert.equal(p.unique_crate_identifier,"fixture-0");assert.equal(p.package_json,null);});
    bad("metadata invalid Option",()=>decodeProgram(Uint8Array.from([...emptyProgram.slice(0,-2),2,0]),schema),/Option/);
    bad("metadata trailing payload",()=>decodeProgram(Uint8Array.from([...emptyProgram,0]),schema),/trailing/);
    bad("metadata truncated payload",()=>decodeProgram(Uint8Array.from(emptyProgram.slice(0,-1)),schema),/truncated/);
    bad("path traversal",()=>safeRelative("x/../foreign","fixture"),/traversal/);
    bad("Windows absolute path",()=>safeRelative("C:/foreign","fixture"),/platform/);
    bad("UNC path",()=>safeRelative("\\\\host\\share","fixture"),/platform/);
    bad("NUL path",()=>safeRelative("x\u0000y","fixture"),/NUL/);
    good("literal safe path",()=>assert.equal(safeRelative("crate-0123/local.js","fixture"),"crate-0123/local.js"));
    good("finite literal descriptor graph",()=>{const b=fixture(),m=parseModule(b),g=descriptorGraph(m,b);assert.equal(g.staticClosureClosed,true);assert.equal(g.reachedFunctions.length,1);assert.equal(g.finiteDescriptorInstructionVisitsUpperBound,"3");});
    good("cycle remains blocked",()=>{const b=fixture([0,0x10,1,0x0b]),g=descriptorGraph(parseModule(b),b);assert.ok(g.cycles.length);assert.equal(g.staticClosureClosed,false);});
    good("loop remains blocked",()=>{const b=fixture([0,0x03,0x40,0x0c,0,0x0b,0x0b]),g=descriptorGraph(parseModule(b),b);assert.equal(g.staticClosureClosed,false);assert.ok(g.unresolved.some(x=>x.kind==="loop_iteration_bound_unknown"));});
    good("unsupported float descriptor blocked",()=>{const b=fixture([0,0x43,0,0,0,0,0x0b]),g=descriptorGraph(parseModule(b),b);assert.equal(g.staticClosureClosed,false);});
    return checks;
}
