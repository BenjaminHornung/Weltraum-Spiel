import assert from "node:assert/strict";
import {createHash} from "node:crypto";

export const LIMITS = Object.freeze({bytes: 8_388_608, vector: 100_000, instructions: 4_000_000, nesting: 512});
export const digest = b => createHash("sha256").update(b).digest("hex");
const utf8 = new TextDecoder("utf-8", {fatal: true});
export class Reader {
    constructor(bytes, start = 0, end = bytes.length) {
        assert.ok(bytes instanceof Uint8Array && start >= 0 && end >= start && end <= bytes.length);
        this.b = bytes; this.p = start; this.end = end;
    }
    fail(message) { throw new Error(message + " @byte " + this.p); }
    byte() { if (this.p >= this.end) this.fail("truncated byte"); return this.b[this.p++]; }
    take(n) {
        if (!Number.isSafeInteger(n) || n < 0 || n > this.end - this.p) this.fail("length out of bounds");
        const data = this.b.subarray(this.p, this.p + n); this.p += n; return data;
    }
    sub(n) { const start = this.p; this.take(n); return new Reader(this.b, start, this.p); }
    u(bits = 32) {
        let value = 0n, shift = 0n;
        for (let i = 0; i < Math.ceil(bits / 7); i++) {
            const b = this.byte(); value |= BigInt(b & 127) << shift; shift += 7n;
            if (!(b & 128)) {
                if (value >= (1n << BigInt(bits))) this.fail("unsigned LEB overflow");
                if (value > BigInt(Number.MAX_SAFE_INTEGER)) return value.toString();
                return Number(value);
            }
        }
        this.fail("overlong unsigned LEB");
    }
    s(bits = 32) {
        let value = 0n, shift = 0n;
        for (let i = 0; i < Math.ceil(bits / 7); i++) {
            const b = this.byte(); value |= BigInt(b & 127) << shift; shift += 7n;
            if (!(b & 128)) {
                if (b & 64) value -= 1n << shift;
                if (value < -(1n << BigInt(bits - 1)) || value >= (1n << BigInt(bits - 1))) this.fail("signed LEB overflow");
                return bits <= 33 ? Number(value) : value.toString();
            }
        }
        this.fail("overlong signed LEB");
    }
    count(max = LIMITS.vector) { const n = this.u(); if (n > max || n > this.end - this.p) this.fail("vector bound"); return n; }
    str() { return utf8.decode(this.take(this.u())); }
    done() { if (this.p !== this.end) this.fail("trailing bytes"); }
}
const BASIC_TYPES = new Set([0x7f,0x7e,0x7d,0x7c,0x7b,0x70,0x6f]);
function valType(r) {
    const type = r.byte();
    if (BASIC_TYPES.has(type)) return type;
    if (type === 0x63 || type === 0x64) return {ref: type, heap: r.s(33)};
    r.fail("unsupported value type " + type.toString(16));
}
function limits(r) {
    const flags = r.u(); if (flags & ~7) r.fail("unsupported limits flags");
    const min = r.u(flags & 4 ? 64 : 32), max = flags & 1 ? r.u(flags & 4 ? 64 : 32) : null;
    if (typeof min !== "number" || max !== null && typeof max !== "number") r.fail("non-safe limits");
    if (max !== null && max < min || flags & 2 && max === null) r.fail("invalid limits");
    return {flags, min, max, shared: !!(flags & 2), memory64: !!(flags & 4)};
}
function blockType(r) {
    const b = r.b[r.p];
    if (b === 0x40) { r.byte(); return null; }
    if (BASIC_TYPES.has(b) || b === 0x63 || b === 0x64) return valType(r);
    const index = r.s(33); if (index < 0) r.fail("unsupported block type"); return {type: index};
}
function memarg(r) {
    const align = r.u(); const memory = align & 64 ? r.u() : 0;
    if (align & ~127) r.fail("unsupported memory alignment bits");
    return [align & 63, memory, r.u(64)];
}
export function instruction(r) {
    const offset = r.p, op = r.byte(); let imm = [];
    if ([0x02,0x03,0x04,0x06].includes(op)) imm = [blockType(r)];
    else if ([0x07,0x08,0x09,0x0c,0x0d,0x10,0x12,0x14,0x15,0x18,0x20,0x21,0x22,0x23,0x24,0x25,0x26,0xd2,0xd5,0xd6].includes(op)) imm = [r.u()];
    else if (op === 0x0e) { const n = r.count(); imm = Array.from({length:n},()=>r.u()); imm.push(r.u()); }
    else if (op === 0x11 || op === 0x13) imm = [r.u(),r.u()];
    else if (op === 0x1c) imm = Array.from({length:r.count()},()=>valType(r));
    else if (op === 0x1f) {
        imm = [blockType(r)]; const n = r.count(); const catches = [];
        for (let i=0;i<n;i++) { const kind=r.byte(); if(kind>3)r.fail("catch kind"); catches.push(kind<2?[kind,r.u(),r.u()]:[kind,r.u()]); }
        imm.push(catches);
    }
    else if (op >= 0x28 && op <= 0x3e) imm = memarg(r);
    else if (op === 0x3f || op === 0x40) imm = [r.u()];
    else if (op === 0x41) imm = [r.s()];
    else if (op === 0x42) imm = [r.s(64)];
    else if (op === 0x43) imm = [Buffer.from(r.take(4)).toString("hex")];
    else if (op === 0x44) imm = [Buffer.from(r.take(8)).toString("hex")];
    else if (op === 0xd0) imm = [r.s(33)];
    else if (op === 0xfc) {
        const sub=r.u(); imm=[sub];
        if(sub<=7) {}
        else if([8,10,12,14].includes(sub)) imm.push(r.u(),r.u());
        else if([9,11,13,15,16,17,18].includes(sub)) imm.push(r.u());
        else r.fail("unsupported fc opcode " + sub);
    }
    else if (op === 0xfd || op === 0xfe || op === 0xfb) r.fail("unsupported opcode prefix " + op.toString(16));
    else if (![0x00,0x01,0x05,0x0a,0x0b,0x0f,0x19,0x1a,0x1b,0xd1,0xd3,0xd4].includes(op) && !(op>=0x45 && op<=0xc4)) r.fail("unknown opcode " + op.toString(16));
    return {op, offset, imm};
}
function expression(r) {
    const nodes=[]; for(let i=0;i<16;i++) { const n=instruction(r);nodes.push(n);if(n.op===0x0b)return nodes;if(![0x41,0x42,0x43,0x44,0x23,0xd0,0xd2].includes(n.op))r.fail("unsupported constant expression"); }
    r.fail("constant expression bound");
}
function literalI32(nodes) { return nodes.length===2 && nodes[0].op===0x41 ? nodes[0].imm[0] : null; }
function literalRef(nodes) {
    if(nodes.length!==2)return {unknown:true};
    if(nodes[0].op===0xd2)return {function:nodes[0].imm[0]};
    if(nodes[0].op===0xd0)return {null:true};
    return {unknown:true};
}
function readBody(r,budget) {
    const localGroups=r.count(); const locals=[];let localTotal=0;
    for(let i=0;i<localGroups;i++){const count=r.u(),type=valType(r);localTotal+=count;if(localTotal>1_000_000)r.fail("local bound");locals.push({count,type});}
    const tokens=[],frames=[{op:"function",elseSeen:false}];
    while(frames.length) {
        if(++budget.instructions>LIMITS.instructions)r.fail("instruction bound");
        const n=instruction(r);n.depth=frames.length-1;tokens.push(n);
        if([0x02,0x03,0x04,0x06,0x1f].includes(n.op)){
            if(frames.length>=LIMITS.nesting)r.fail("control nesting bound");
            frames.push({op:n.op,elseSeen:false});
        } else if(n.op===0x05) {
            const f=frames.at(-1);if(f.op!==0x04||f.elseSeen)r.fail("unexpected else");f.elseSeen=true;
        } else if(n.op===0x07||n.op===0x19) {
            if(frames.at(-1).op!==0x06)r.fail("unexpected catch");
        } else if(n.op===0x18) {
            if(frames.at(-1).op!==0x06)r.fail("unexpected delegate");frames.pop();
        } else if(n.op===0x0b) frames.pop();
        else if(n.op===0x0c||n.op===0x0d||n.op===0xd5||n.op===0xd6) {if(n.imm[0]>=frames.length)r.fail("branch label out of range");}
        else if(n.op===0x0e) {if(n.imm.some(x=>x>=frames.length))r.fail("branch table label out of range");}
    }
    r.done();return {locals,localTotal,tokens};
}
export function parseModule(bytes) {
    if(bytes.length>LIMITS.bytes)throw Error("module byte bound");
    const r=new Reader(bytes);assert.deepEqual([...r.take(8)],[0,97,115,109,1,0,0,0],"WASM data header");
    const module={sections:[],custom:[],types:[],imports:[],functionTypes:[],functions:[],tables:[],memories:[],globals:[],exports:[],elements:[],data:[],tags:[],start:null,names:{},budget:{instructions:0}};
    const seen=new Set();let previousRank=0;
    const ranks={1:1,2:2,3:3,4:4,5:5,13:6,6:7,7:8,8:9,9:10,12:11,10:12,11:13};
    while(r.p<r.end){
        const offset=r.p,id=r.byte(),size=r.u(),s=r.sub(size);
        module.sections.push({id,offset,payloadOffset:s.p,bytes:size,sha256:digest(bytes.subarray(s.p,s.end))});
        if(id!==0){if(!ranks[id]||seen.has(id)||ranks[id]<previousRank)s.fail("duplicate/out-of-order/unknown section");seen.add(id);previousRank=ranks[id];}
        if(id===0){const name=s.str();module.custom.push({name,offset:s.p,bytes:s.end-s.p,sha256:digest(bytes.subarray(s.p,s.end))});s.p=s.end;}
        else if(id===1){for(let i=0,n=s.count();i<n;i++){if(s.byte()!==0x60)s.fail("unsupported non-function type");const params=Array.from({length:s.count()},()=>valType(s));const results=Array.from({length:s.count()},()=>valType(s));module.types.push({params,results});}}
        else if(id===2){for(let i=0,n=s.count();i<n;i++){const namespace=s.str(),name=s.str(),kind=s.byte();let value;if(kind===0)value={type:s.u()};else if(kind===1)value={ref:valType(s),...limits(s)};else if(kind===2)value=limits(s);else if(kind===3){value={type:valType(s),mutable:s.byte()};if(value.mutable>1)s.fail("global mutability");}else if(kind===4){if(s.byte()!==0)s.fail("tag attribute");value={type:s.u()};}else s.fail("import kind");module.imports.push({namespace,name,kind,value});}}
        else if(id===3){module.functionTypes=Array.from({length:s.count()},()=>s.u());}
        else if(id===4){for(let i=0,n=s.count();i<n;i++)module.tables.push({ref:valType(s),...limits(s)});}
        else if(id===5){for(let i=0,n=s.count();i<n;i++)module.memories.push(limits(s));}
        else if(id===6){for(let i=0,n=s.count();i<n;i++){const type=valType(s),mutable=s.byte();if(mutable>1)s.fail("global mutability");module.globals.push({type,mutable,init:expression(s)});}}
        else if(id===7){const exportNames=new Set();for(let i=0,n=s.count();i<n;i++){const name=s.str(),kind=s.byte(),index=s.u();if(kind>4||exportNames.has(name))s.fail("invalid/duplicate export");exportNames.add(name);module.exports.push({name,kind,index});}}
        else if(id===8)module.start=s.u();
        else if(id===9){for(let i=0,n=s.count();i<n;i++){const flags=s.u();if(flags>7)s.fail("element flags");const active=(flags&1)===0;const table=active&&(flags&2)?s.u():0;const offset=active?expression(s):null;let ref=0x70;if(flags&4){if(flags!==4)ref=valType(s);}else if(flags!==0){if(s.byte()!==0)s.fail("element kind");}const entries=Array.from({length:s.count()},()=>flags&4?literalRef(expression(s)):{function:s.u()});module.elements.push({flags,active,table,offset,offsetI32:offset?literalI32(offset):null,ref,entries});}}
        else if(id===10){const n=s.count();if(n!==module.functionTypes.length)s.fail("function/code length mismatch");for(let i=0;i<n;i++){const bodySize=s.u(),body=s.sub(bodySize);module.functions.push({localIndex:i,type:module.functionTypes[i],offset:body.p,bytes:bodySize,...readBody(body,module.budget)});}}
        else if(id===11){for(let i=0,n=s.count();i<n;i++){const flags=s.u();if(flags>2)s.fail("data flags");const memory=flags===2?s.u():0;const offset=flags!==1?expression(s):null;const data=s.take(s.u());module.data.push({flags,memory,offset,dataBytes:data.length,sha256:digest(data)});}}
        else if(id===12)module.dataCount=s.u();
        else if(id===13){for(let i=0,n=s.count();i<n;i++){if(s.byte()!==0)s.fail("tag attribute");module.tags.push({type:s.u()});}}
        s.done();
    }
    const imports=module.imports.filter(x=>x.kind===0);
    imports.forEach((f,index)=>{f.index=index;});
    module.functionImports=imports;module.functionCount=imports.length+module.functions.length;
    module.functions.forEach(f=>{f.index=imports.length+f.localIndex;});
    const counts={function:module.functionCount,table:module.imports.filter(x=>x.kind===1).length+module.tables.length,memory:module.imports.filter(x=>x.kind===2).length+module.memories.length,global:module.imports.filter(x=>x.kind===3).length+module.globals.length,tag:module.imports.filter(x=>x.kind===4).length+module.tags.length};
    function index(value,count,label){if(!Number.isSafeInteger(value)||value<0||value>=count)throw Error(label+" index out of range: "+value);}
    for(const f of [...imports,...module.functions])index(f.value?.type??f.type,module.types.length,"function type");
    for(const e of module.exports)index(e.index,[counts.function,counts.table,counts.memory,counts.global,counts.tag][e.kind],"export");
    if(module.start!==null)index(module.start,counts.function,"start");
    for(const e of module.elements){if(e.active)index(e.table,counts.table,"element table");for(const f of e.entries)if(f.function!==undefined)index(f.function,counts.function,"element function");}
    if(module.dataCount!==undefined&&module.dataCount!==module.data.length)throw Error("data count mismatch");
    for(const f of module.functions)for(const n of f.tokens){
        if(n.op===0x10||n.op===0x12||n.op===0xd2)index(n.imm[0],counts.function,"instruction function");
        if(n.op===0x11||n.op===0x13){index(n.imm[0],module.types.length,"indirect type");index(n.imm[1],counts.table,"indirect table");}
        if(n.op===0x14||n.op===0x15)index(n.imm[0],module.types.length,"call-ref type");
        if(n.op>=0x20&&n.op<=0x22)index(n.imm[0],module.types[f.type].params.length+f.localTotal,"local");
        if(n.op===0x23||n.op===0x24)index(n.imm[0],counts.global,"global");
        if(n.op===0x25||n.op===0x26)index(n.imm[0],counts.table,"table");
        if(n.op>=0x28&&n.op<=0x3e)index(n.imm[1],counts.memory,"memory");
        if(n.op===0x3f||n.op===0x40)index(n.imm[0],counts.memory,"memory");
        if([0x02,0x03,0x04,0x06,0x1f].includes(n.op)&&n.imm[0]?.type!==undefined)index(n.imm[0].type,module.types.length,"block type");
    }
    for(const c of module.custom)if(c.name==="name"){
        const names=new Reader(bytes,c.offset,c.offset+c.bytes);
        while(names.p<names.end){const id=names.byte(),s=names.sub(names.u());if(id===1){for(let i=0,n=s.count();i<n;i++){const fn=s.u();index(fn,counts.function,"function name");module.names[fn]=s.str();}}else{s.p=s.end;}s.done();}
    }
    module.counts=counts;return module;
}
