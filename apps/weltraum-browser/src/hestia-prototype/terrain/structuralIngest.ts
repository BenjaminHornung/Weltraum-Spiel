import {
  ADAPTIVE_BRICK_ESTIMATED_BYTES, ADAPTIVE_BRICK_ESTIMATED_WORK, authorityRevision,
  createAdaptiveAuthorityRetention, createAdaptiveBaseFieldDescriptor, createAdaptiveBrickKey,
  createAdaptiveEditJournal, createAdaptiveResidentValidationProofs, materializeAdaptiveBrick,
  stableAuthorityId, type AdaptiveEditInput, type AdaptivePlannerSnapshot
} from "../../voxel/adaptive";
import { createStructuralMaterialTable, createStructuralObjectFromAdaptive, createStructuralCellAddress, STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION } from "../../voxel/structural";

export interface HvpStructuralCell { readonly x:number;readonly y:number;readonly z:number;readonly materialId:number }

/** Real air + bounded AddBox journal -> materialization/proofs -> public ingest. */
export const ingestHvpStructuralCells = (id:string, input:readonly HvpStructuralCell[], materialInput:readonly unknown[],
  anchorInput:readonly Readonly<{x:number;y:number;z:number}>[] = []) => {
  if(!/^[a-zA-Z0-9_.:-]{1,96}$/.test(id)) { throw new Error("Invalid HVP structural ID"); }
  if(input.length===0||input.length>32_768) { throw new Error("HVP ingest BudgetExceeded: 1..32768 cells required"); }
  const materials=createStructuralMaterialTable(materialInput);
  const ids=new Set(materials.map(material=>Number(material.materialId)));
  const cells=input.map(cell=>{
    if(!cell||![cell.x,cell.y,cell.z].every(value=>Number.isSafeInteger(value)&&Math.abs(value)<=1_000_000)
      ||!ids.has(cell.materialId)) { throw new Error("Invalid canonical HVP cell/material"); }
    return {x:cell.x,y:cell.y,z:cell.z,materialId:cell.materialId};
  }).sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x);
  const origins=new Map<string,{x:number;y:number;z:number}>();
  const runs:Array<{x:number;y:number;z:number;end:number;materialId:number}>=[];
  for(let i=0;i<cells.length;i+=1) {
    const cell=cells[i]!;const previous=cells[i-1];
    if(previous&&previous.x===cell.x&&previous.y===cell.y&&previous.z===cell.z) { throw new Error("Duplicate HVP cell"); }
    const origin={x:Math.floor(cell.x/16)*16,y:Math.floor(cell.y/16)*16,z:Math.floor(cell.z/16)*16};
    origins.set(`${origin.x},${origin.y},${origin.z}`,origin);
    if(origins.size*ADAPTIVE_BRICK_ESTIMATED_BYTES>16*1024*1024) { throw new Error("HVP ingest BudgetExceeded: brick working set"); }
    const run=runs.at(-1);
    if(run&&run.y===cell.y&&run.z===cell.z&&run.end===cell.x&&run.materialId===cell.materialId) { run.end+=1; }
    else {
      if(runs.length===4096) { throw new Error("HVP ingest BudgetExceeded: 4096 AddBox runs"); }
      runs.push({...cell,end:cell.x+1});
    }
  }
  const frame={schemaVersion:STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,bodyId:"body.hestia",surfaceFrameId:"frame.hvp",
    regionId:`region.${id}`,generatorVersion:"hvp-rigid-ingest-v1",objectOriginQuantum:{x:0,y:0,z:0}} as const;
  const baseField=createAdaptiveBaseFieldDescriptor({kind:"constant-v1",identity:stableAuthorityId(`base.${id}`),
    version:stableAuthorityId(frame.generatorVersion),sourceRevision:authorityRevision(1),sample:{density:0,occupancy:0,materialId:null}});
  const edits:AdaptiveEditInput[]=runs.map((run,i)=>({editId:`${id}.run.${i}`,sequence:i+1,expectedRegionRevision:i,resultRegionRevision:i+1,
    actorId:"hvp.ingest",sourceId:`hvp.source.${id}`,operation:"AddBox",box:{min:{x:run.x,y:run.y,z:run.z},max:{x:run.end,y:run.y+1,z:run.z+1}},
    materialId:`hvp.material.${run.materialId}`}));
  const editJournal=createAdaptiveEditJournal(edits);
  const bricks=[...origins.values()].sort((a,b)=>a.z-b.z||a.y-b.y||a.x-b.x).map(originQuantum=>materializeAdaptiveBrick({
    key:createAdaptiveBrickKey({bodyId:frame.bodyId,surfaceFrameId:frame.surfaceFrameId,regionId:frame.regionId,
      generatorVersion:frame.generatorVersion,level:4,originQuantum}),baseField,editJournal }));
  const brickRevision=authorityRevision(0);
  const resident=bricks.map(brick=>({key:brick.key,readiness:"ready" as const,byteSize:ADAPTIVE_BRICK_ESTIMATED_BYTES,work:ADAPTIVE_BRICK_ESTIMATED_WORK,
    contentHash:brick.contentHash,provenanceHash:brick.provenance.provenanceHash,baseFieldDescriptorDigest:brick.baseFieldDescriptorDigest,
    journalDigest:brick.provenance.journalDigest,sourceRevision:brick.sourceRevision,editRevision:brick.editRevision,brickRevision}));
  const snapshot:AdaptivePlannerSnapshot={schemaVersion:"adaptive-microvoxel-planner-snapshot-v1",bodyId:stableAuthorityId(frame.bodyId),
    surfaceFrameId:stableAuthorityId(frame.surfaceFrameId),regionId:stableAuthorityId(frame.regionId),generatorVersion:stableAuthorityId(frame.generatorVersion),
    authority:{schemaVersion:"adaptive-microvoxel-planner-authority-v1",baseField,editJournal,brickRevision},planningEpoch:authorityRevision(1),resident,
    activeCoverage:[],refinementRequests:[],budgets:{maxBricks:128,maxBytes:16*1024*1024,maxWork:128*ADAPTIVE_BRICK_ESTIMATED_WORK,maxCoverageQuantum:128*4096}};
  const proofs=createAdaptiveResidentValidationProofs({bricks,brickRevision,snapshot});
  if(anchorInput.length>cells.length) { throw new Error("Invalid HVP anchor count"); }
  const anchors=anchorInput.map((anchor,index)=>{
    if(!cells.some(cell=>cell.x===anchor.x&&cell.y===anchor.y&&cell.z===anchor.z)) { throw new Error("Anchor requires an occupied canonical cell"); }
    const brick=bricks.find(item=>item.key.originQuantum.x===Math.floor(anchor.x/16)*16
      &&item.key.originQuantum.y===Math.floor(anchor.y/16)*16&&item.key.originQuantum.z===Math.floor(anchor.z/16)*16)!;
    return {anchorId:`${id}.anchor.${index}`,cell:createStructuralCellAddress(brick.key,
      {x:anchor.x-brick.key.originQuantum.x,y:anchor.y-brick.key.originQuantum.y,z:anchor.z-brick.key.originQuantum.z})};
  });
  return createStructuralObjectFromAdaptive({objectId:id,frame,authority:createAdaptiveAuthorityRetention({baseField,editJournal}),
    snapshot:{...snapshot,resident:resident.map((entry,i)=>({...entry,validationProof:proofs[i]!}))},materials,
    materialBindings:materials.map(material=>({adaptiveMaterialId:`hvp.material.${material.materialId}`,structuralMaterialId:material.materialId})),
    bricks,anchors,joints:[],objectRevision:0,editRevision:0,commandEvidence:[]});
};
