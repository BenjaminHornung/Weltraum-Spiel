import context from "../context-binding.json";
import supplement from "../supplement-binding-r03.json";
import lab from "../lab-contract-binding.json";
import {canonicalJson,sha256} from "../../src/profileBinding";
import type {InputReader} from "./registry";
const encoder=new TextEncoder(),decoder=new TextDecoder("utf-8",{fatal:true});
const r1="inputs/phy02/payload/spikes/phy-02-collider-bakeoff/revisions/phy01-migration2-r01/";
interface Case {name:string;profile:string;kind:string;status:"PASS"|"FAIL";acceptance:string;cleanup:string;gyro?:boolean;evidence:string}

/** Archived assertions are evidence, not newly executed physics or collider admission. */
export async function bindPartialEvidence(read:InputReader,profileId:string){
  if(await sha256(encoder.encode(JSON.stringify(context.files)))!==context.indexSha256)throw new Error("Partial context index mismatch");
  if(await sha256(encoder.encode(JSON.stringify(supplement.files)))!==supplement.indexSha256)throw new Error("R03 supplement index mismatch");
  if(await sha256(encoder.encode(JSON.stringify(lab.files)))!==lab.indexSha256)throw new Error("A0 lab contract index mismatch");
  let matrixBytes:Uint8Array|undefined;
  const hashes=new Map<string,string>();
  for(const row of [...context.files,...supplement.files,...lab.files]){
    const bytes=new Uint8Array(await read(row.path));
    if(bytes.length!==row.bytes||await sha256(bytes)!==row.sha256)throw new Error("Partial context bytes mismatch: "+row.path);
    hashes.set(row.path,row.sha256);if(row.path===context.phy02.matrixPath)matrixBytes=bytes;
  }
  if(!matrixBytes)throw new Error("Actual matrix missing");
  const generated=new Uint8Array(await read(lab.derivedFixture.path));
  if(await sha256(generated)!==lab.derivedFixture.sha256)throw new Error("Owner-authored fixture derivation mismatch");
  if(supplement.owner.selectedProfile!==profileId||supplement.owner.gyro!==false||supplement.owner.decision!=="ACCEPT_BOUNDED_FROZEN_SOURCE_PORT_INPUT"
    ||supplement.owner.inputSha256!==context.a0SourcePort.inputSha256)throw new Error("Reviewed owner/source binding mismatch");
  const matrix=JSON.parse(decoder.decode(matrixBytes)) as {schema:string;status:string;cases:Case[];raw:unknown;acceptance:unknown};
  if(matrix.schema!=="phy02.migration2.matrix.r01"||matrix.status!=="PARTIAL_RETAINED_NEGATIVES"||matrix.cases.length!==192)throw new Error("Unknown matrix population");
  const raw={PASS:0,FAIL:0},acceptance:Record<string,number>={},groups:Record<string,{PASS:number;FAIL:number}>={};
  for(const c of matrix.cases){
    if(!["PASS","FAIL"].includes(c.status)||!["PASS","FAIL","UNSUPPORTED","NOT_APPLICABLE"].includes(c.acceptance))throw new Error("Unknown case state");
    raw[c.status]++;acceptance[c.acceptance]=(acceptance[c.acceptance]??0)+1;
    const group=groups[c.profile]??(groups[c.profile]={PASS:0,FAIL:0});group[c.status]++;
    if(!hashes.has(r1+c.evidence))throw new Error("Unbound raw case evidence: "+c.evidence);
    if(c.profile===profileId&&c.gyro!==undefined&&c.gyro!==false)throw new Error("Selected profile gyro mismatch");
  }
  if(canonicalJson(raw)!==canonicalJson(matrix.raw)||canonicalJson(acceptance)!==canonicalJson(matrix.acceptance)
    ||raw.PASS!==146||raw.FAIL!==46||groups[profileId]?.PASS!==73||groups[profileId]?.FAIL!==23)throw new Error("Matrix count/profile mismatch");
  const examples=matrix.cases.filter(c=>c.profile===profileId&&(/codec/.test(c.name)||c.status==="FAIL"));
  return Object.freeze({status:"PARTIAL_NOT_FINAL_INDEX" as const,population:"ARCHIVED_NOT_RERUN" as const,
    matrixSha256:context.phy02.matrixSha256,contextIndexSha256:context.indexSha256,
    raw:Object.freeze(raw),acceptance:Object.freeze(acceptance),selectedProfileRaw:Object.freeze(groups[profileId]),
    gyroPopulation:"SEPARATE_UNSELECTED" as const,representationChoice:"NONE" as const,currentSemanticIndex:supplement.phy02.currentIndex,
    indexClosure:Object.freeze({...supplement.phy02}),supplementIndexSha256:supplement.indexSha256,
    sourcePort:Object.freeze({...context.a0SourcePort,historicalPreReview:context.a0SourcePort.adoption,adoption:supplement.owner.decision,reviewedOwner:Object.freeze({...supplement.owner})}),
    currentA0LabContract:Object.freeze({inputSha256:lab.inputSha256,ownerReceiptSha256:lab.ownerReceiptSha256,indexSha256:lab.indexSha256,
      snapshotRows:lab.snapshotRows,ownerBindingRows:lab.ownerBindingRows,independentReview:lab.independentReview,
      publicContract:lab.publicContract,runtimeWiring:"AWAIT_PHY021_LAB_FUNCTIONAL_R01_FREEZE",nativeLifecycle:"NOT_RUN"}),
    examples:Object.freeze(examples.map(c=>Object.freeze({name:c.name,kind:c.kind,status:c.status,acceptance:c.acceptance,cleanup:c.cleanup,evidence:c.evidence,evidenceSha256:hashes.get(r1+c.evidence)!}))),
    publicColdSave:"NOT_PROVEN" as const,sourceV2:"UNSUPPORTED" as const});
}
