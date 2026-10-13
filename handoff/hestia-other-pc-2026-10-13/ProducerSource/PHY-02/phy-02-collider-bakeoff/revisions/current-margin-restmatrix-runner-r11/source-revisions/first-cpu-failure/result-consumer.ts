import type {Descriptor,CaseRecord,ResourceObservation} from "./case-types";
const maxRawBytes=8*1024*1024;
function object(value:unknown):Record<string,unknown>{
  if(value===null||typeof value!=="object"||Array.isArray(value))throw new Error("Expected record");
  return value as Record<string,unknown>;
}
function ownString(row:Record<string,unknown>,key:string):string{
  if(typeof row[key]!=="string")throw new Error("Missing string "+key);return row[key] as string;
}
export function parseBoundJson(bytes:Uint8Array,maxBytes=maxRawBytes):unknown{
  if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||maxBytes>maxRawBytes||bytes.byteLength>maxBytes)throw new Error("Raw byte limit exceeded");
  const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  return JSON.parse(text) as unknown;
}
export function consumeCaseRecords(raw:unknown,selected:readonly Descriptor[],binding:{engineBinding:string;wasmSha256:string}){
  if(!Array.isArray(raw)||raw.length>selected.length||selected.length===0||new Set(selected.map(c=>c.id)).size!==selected.length)throw new Error("Case count/selection drift");
  const expected=new Map(selected.map(c=>[c.id,c])),seen=new Set<string>();
  const records:CaseRecord[]=[];let hold=false;let stopIndex:number|null=null;
  for(const value of raw){
    const row=object(value),id=ownString(row,"caseId"),descriptor=expected.get(id);
    if(!descriptor||seen.has(id))throw new Error("Unknown/duplicate case");seen.add(id);
    if(row.ordinal!==descriptor.ordinal||row.profile!==descriptor.profile||row.kind!==descriptor.kind||row.group!==descriptor.group||row.gyro!==descriptor.gyro)throw new Error("Case/profile drift");
    if(row.engineBinding!==binding.engineBinding||row.wasmSha256!==binding.wasmSha256||row.classification!=="DIAGNOSTIC_NOT_REFERENCE")throw new Error("Source/engine binding drift");
    if(!["PASS","FAIL","NOT_RUN"].includes(String(row.status))||typeof row.primaryPresent!=="boolean"||typeof row.poisoned!=="boolean"||!Array.isArray(row.resources))throw new Error("Invalid case status");
    if(row.status==="FAIL"&&!row.primaryPresent||row.status==="PASS"&&row.primaryPresent)throw new Error("Primary presence drift");
    if(hold&&row.status!=="NOT_RUN")throw new Error("Acquisition after poison");
    for(const value of row.resources){
      const r=object(value),a=object(r.acquisition),p=object(r.primary),c=object(r.cleanup);
      if(typeof r.acquired!=="boolean"||typeof r.primaryPresent!=="boolean"||!Number.isSafeInteger(r.releaseAttempts)||!Array.isArray(r.stopCauses))throw new Error("Invalid resource observation");
      if(!["PASS","FAIL","NOT_RUN"].includes(String(a.status))||!["PASS","FAIL","NOT_RUN"].includes(String(p.status))||!["PASS","FAIL","NOT_RUN"].includes(String(c.status)))throw new Error("Invalid observation status");
      if(r.acquired){
        if(a.status!=="PASS"||r.releaseAttempts!==1||c.status==="NOT_RUN")throw new Error("Acquired handle not released exactly once");
        if(r.primaryPresent!==(p.status==="FAIL"))throw new Error("Resource primary presence drift");
      }else if(r.releaseAttempts!==0||p.status!=="NOT_RUN"||c.status!=="NOT_RUN")throw new Error("Release without returned handle");
      if(a.status==="FAIL"||c.status==="FAIL"||r.stopCauses.length||r.disposition==="POISONED")hold=true;
      if(row.status==="PASS"&&(p.status!=="PASS"||c.status!=="PASS"))throw new Error("PASS conflicts with resource failure");
    }
    if(row.poisoned)hold=true;if(hold&&stopIndex===null)stopIndex=records.length;
    records.push(row as unknown as CaseRecord);
  }
  const missing=selected.filter(c=>!seen.has(c.id)).map(c=>c.id);
  const ordinaryFailures=records.filter(r=>r.status==="FAIL"&&!r.poisoned&&r.resources.every(o=>o.cleanup.status==="PASS"&&o.stopCauses.length===0)).map(r=>r.caseId);
  return {protocol:hold||missing.length?"HOLD":"COMPLETE_DATA_PROTOCOL",records,missing,ordinaryFailures,stopIndex,
    nativeAcceptance:false,physicalHeap:"UNPROVEN",referenceAcceptance:false};
}
export function consumeHistorical(raw:unknown,cases:readonly Descriptor[]){
  const row=object(raw);if(!Array.isArray(row.records))throw new Error("Missing historical records");
  const expected=new Map(cases.map(c=>[c.title,c]));const seen=new Set<string>();
  let pass=0,fail=0;
  for(const value of row.records){
    const r=object(value),name=ownString(r,"name"),c=expected.get(name);
    if(!c||seen.has(name))throw new Error("Historical duplicate/unknown title");seen.add(name);
    if(r.profile!=="rapier-0.21.0-phy01.migration2:"+c.profile||r.kind!==c.kind||r.status!==c.historicalStatus)throw new Error("Historical binding/status drift");
    if(r.status==="PASS")pass++;else if(r.status==="FAIL")fail++;else throw new Error("Unexpected historical status");
  }
  if(seen.size!==cases.length)throw new Error("Historical missing case");
  return {classification:"HISTORICAL_ED3C_NOT_CURRENT_F26",pass,fail,nativeCurrent:"NOT_RUN"};
}

