/**
 * TEST ONLY: independent synchronous-drain oracle pinned to b3c6523a94cd050f5a9a22dc27f4777fcc03363e.
 * Historical synchronous body: f2ee connectivity blob 339fe39223fe998e51e0a8fda69860f174b822a3.
 * Frozen b3 delta: extraction/order tuples from occupiedEntries blob ef7895b197160b68af98a6ef4b4cfcd8320cdf9f.
 * Adaptations: relative imports, export/error names, braces, frozen historical FNV body,
 * and synchronous native loops rather than a cursor (no suspension in a public drain).
 * No import of connectivity/classificationSteps/occupiedEntries or the candidate hash cursor.
 * Shared coordinate, canonical-encoding, validation and schema primitives are unchanged
 * between f2ee and b3; see P01-PLAN.md for provenance and the limits of this oracle.
 */
import {canonicalAdaptiveJson,deepFreeze,serializeAdaptiveKey as adaptiveSerializeKey} from "../../src/voxel/adaptive";
import {globalQuantumForStructuralCell,localCellIndexFromOffset} from "../../src/voxel/structural/coordinates";
import {serializeStructuralCellAddress} from "../../src/voxel/structural/canonical";
import {structuralAddressForBrickCell} from "../../src/voxel/structural/model";
import {normalizeAdaptiveAuthorityFunction,structuralPositiveBudget} from "../../src/voxel/structural/validation";
import {
  STRUCTURAL_COMPONENT_ID_VERSION,STRUCTURAL_COMPONENT_SCHEMA_VERSION,
  STRUCTURAL_FRAGMENT_ID_VERSION,STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
  type StructuralActiveAnchorFact,type StructuralActiveJointFact,type StructuralCellAddress,
  type StructuralComponent,type StructuralComponentClassification,type StructuralConnectivityBudgets,
  type StructuralFragment,type StructuralObject,type StructuralVoxelState
} from "../../src/voxel/structural/types";

// f2ee core/fnv1a64.ts body, not b3's incremental production hash helpers.
const historicalHash=normalizeAdaptiveAuthorityFunction((value:unknown):string=>{
  const bytes=new TextEncoder().encode(canonicalAdaptiveJson(value));
  let high=0xcbf29ce4,low=0x84222325;
  for(let index=0;index<bytes.length;index+=1){
    const xoredLow=(low^bytes[index]!)>>>0;
    const carry=Math.floor(xoredLow*435/0x100000000);
    high=(Math.imul(high,435)+carry+(xoredLow<<8))>>>0;
    low=Math.imul(xoredLow,435)>>>0;
  }
  return `fnv1a64-v1:${high.toString(16).padStart(8,"0")}${low.toString(16).padStart(8,"0")}`;
});
const serializeKey=normalizeAdaptiveAuthorityFunction(adaptiveSerializeKey);

class HistoricalConnectivityError extends Error {
  readonly code="BudgetExceeded" as const;
  constructor(readonly path:string,message:string){
    super(message);
    this.name="StructuralConnectivityError";
  }
}
interface OccupiedEntry {
  readonly address:StructuralCellAddress;
  readonly globalKey:string;
  readonly state:StructuralVoxelState;
  readonly brickOrderKey:string;
  readonly localOrderIndex:number;
}
interface IndexedFacts {
  readonly anchorsByCell:ReadonlyMap<string,readonly StructuralActiveAnchorFact[]>;
  readonly jointsByCell:ReadonlyMap<string,readonly StructuralActiveJointFact[]>;
}
const globalKey=(x:number,y:number,z:number):string=>`${x}:${y}:${z}`;
const compareStrings=(left:string,right:string):number=>left<right?-1:left>right?1:0;
// Frozen b3 comparator, not an import of the candidate's helper.
const compareEntries=(left:OccupiedEntry,right:OccupiedEntry):number=>{
  if(left.brickOrderKey!==right.brickOrderKey){
    return left.brickOrderKey<right.brickOrderKey?-1:1;
  }
  return left.localOrderIndex-right.localOrderIndex;
};
const occupiedEntries=(object:StructuralObject,maxVisitedCells:number):readonly OccupiedEntry[]=>{
  const entries:OccupiedEntry[]=[];
  for(const brick of object.bricks){
    for(const cell of brick.cells){
      if(entries.length>=maxVisitedCells){
        throw new HistoricalConnectivityError("connectivityBudgets/maxVisitedCells","Occupied-cell traversal exceeded the explicit connectivity budget.");
      }
      const address=structuralAddressForBrickCell(brick,cell.localIndex);
      const global=globalQuantumForStructuralCell(address);
      const brickOrderKey=serializeKey(address.brickKey);
      entries.push(deepFreeze({address,globalKey:globalKey(global.x,global.y,global.z),state:cell.state,
        brickOrderKey,localOrderIndex:localCellIndexFromOffset(address.local)}));
    }
  }
  entries.sort(compareEntries);
  return deepFreeze(entries);
};
const pushIndexed=<T>(index:Map<string,T[]>,key:string,value:T):void=>{
  const values=index.get(key);
  if(values===undefined){
    index.set(key,[value]);
  }else{
    values.push(value);
  }
};
const indexFacts=(object:StructuralObject,maxIndexedFacts:number):IndexedFacts=>{
  const anchorsByCell=new Map<string,StructuralActiveAnchorFact[]>();
  const jointsByCell=new Map<string,StructuralActiveJointFact[]>();
  let indexedFacts=0;
  const consume=():void=>{
    indexedFacts+=1;
    if(indexedFacts>maxIndexedFacts){
      throw new HistoricalConnectivityError("connectivityBudgets/maxIndexedFacts","Anchor/Joint endpoint indexing exceeded the explicit connectivity fact budget.");
    }
  };
  for(const anchor of object.anchors){
    consume();
    const fact=deepFreeze({anchorId:anchor.anchorId,cell:anchor.cell});
    pushIndexed(anchorsByCell,serializeStructuralCellAddress(anchor.cell),fact);
  }
  for(const joint of object.joints){
    for(const [endpoint,value] of [["A",joint.endpointA],["B",joint.endpointB]] as const){
      consume();
      const fact=deepFreeze({jointId:joint.jointId,endpoint,cell:value.cell,role:value.role});
      pushIndexed(jointsByCell,serializeStructuralCellAddress(value.cell),fact);
    }
  }
  for(const values of anchorsByCell.values()){
    values.sort((left,right)=>compareStrings(left.anchorId,right.anchorId));
  }
  for(const values of jointsByCell.values()){
    values.sort((left,right)=>compareStrings(left.jointId,right.jointId)||compareStrings(left.endpoint,right.endpoint));
  }
  return {anchorsByCell,jointsByCell};
};
const factsForMembers=(indexed:IndexedFacts,members:readonly OccupiedEntry[])=>{
  const anchors:StructuralActiveAnchorFact[]=[],joints:StructuralActiveJointFact[]=[];
  for(const member of members){
    const cellKey=serializeStructuralCellAddress(member.address);
    anchors.push(...(indexed.anchorsByCell.get(cellKey)??[]));
    joints.push(...(indexed.jointsByCell.get(cellKey)??[]));
  }
  anchors.sort((left,right)=>compareStrings(left.anchorId,right.anchorId));
  joints.sort((left,right)=>compareStrings(left.jointId,right.jointId)||compareStrings(left.endpoint,right.endpoint));
  return deepFreeze({anchors:deepFreeze(anchors),joints:deepFreeze(joints)});
};

export const historicalStructuralClassification=(object:StructuralObject,budgetValue:StructuralConnectivityBudgets):StructuralComponentClassification=>{
  const budgets=deepFreeze({
    maxVisitedCells:structuralPositiveBudget(budgetValue.maxVisitedCells,"connectivityBudgets/maxVisitedCells"),
    maxComponents:structuralPositiveBudget(budgetValue.maxComponents,"connectivityBudgets/maxComponents"),
    maxIndexedFacts:structuralPositiveBudget(budgetValue.maxIndexedFacts,"connectivityBudgets/maxIndexedFacts")
  });
  const entries=occupiedEntries(object,budgets.maxVisitedCells);
  const indexedFacts=indexFacts(object,budgets.maxIndexedFacts);
  const byGlobal=new Map(entries.map(entry=>[entry.globalKey,entry]));
  const visited=new Set<string>(),components:StructuralComponent[]=[];
  const neighborOffsets=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]] as const;
  const sourceAdaptiveAuthorityDigest=historicalHash(object.source);
  for(const seed of entries){
    if(visited.has(seed.globalKey)){
      continue;
    }
    if(components.length>=budgets.maxComponents){
      throw new HistoricalConnectivityError("connectivityBudgets/maxComponents","Component derivation exceeded the explicit component budget.");
    }
    const queue:OccupiedEntry[]=[seed],members:OccupiedEntry[]=[];
    visited.add(seed.globalKey);
    for(let cursor=0;cursor<queue.length;cursor+=1){
      const current=queue[cursor]!;
      members.push(current);
      const global=globalQuantumForStructuralCell(current.address);
      for(const [dx,dy,dz] of neighborOffsets){
        const x=global.x+dx,y=global.y+dy,z=global.z+dz;
        if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!Number.isSafeInteger(z)){
          continue;
        }
        const neighbor=byGlobal.get(globalKey(x,y,z));
        if(neighbor!==undefined&&!visited.has(neighbor.globalKey)){
          visited.add(neighbor.globalKey);
          queue.push(neighbor);
        }
      }
    }
    members.sort(compareEntries);
    const occupiedCells=deepFreeze(members.map(member=>member.address));
    const facts=factsForMembers(indexedFacts,members);
    const projectedCells=deepFreeze(members.map(member=>deepFreeze({cellKey:serializeStructuralCellAddress(member.address),state:member.state})));
    const componentContentHash=historicalHash(deepFreeze({
      occupiedCells:projectedCells,
      activeAnchors:facts.anchors.map(fact=>deepFreeze({anchorId:fact.anchorId,cellKey:serializeStructuralCellAddress(fact.cell)})),
      activeJoints:facts.joints.map(fact=>deepFreeze({jointId:fact.jointId,endpoint:fact.endpoint,cellKey:serializeStructuralCellAddress(fact.cell),role:fact.role}))
    }));
    const smallestOccupiedCellKey=serializeStructuralCellAddress(occupiedCells[0]!);
    const componentId=historicalHash({schemaVersion:STRUCTURAL_COMPONENT_ID_VERSION,
      objectId:object.objectId,objectRevision:object.objectRevision,sourceContentHash:object.contentHash,
      sourceAdaptiveAuthorityDigest,smallestOccupiedCellKey,componentContentHash}) as StructuralComponent["componentId"];
    components.push(deepFreeze({schemaVersion:STRUCTURAL_COMPONENT_SCHEMA_VERSION,componentIdVersion:STRUCTURAL_COMPONENT_ID_VERSION,
      componentId,objectId:object.objectId,objectRevision:object.objectRevision,sourceContentHash:object.contentHash,
      sourceAdaptiveAuthorityDigest,occupiedCells,smallestOccupiedCellKey,activeAnchors:facts.anchors,activeJoints:facts.joints,
      anchored:facts.anchors.length>0,componentContentHash}));
  }
  components.sort((left,right)=>compareStrings(left.componentId,right.componentId));
  const frozenComponents=deepFreeze(components);
  const anchoredComponents=deepFreeze(frozenComponents.filter(component=>component.anchored));
  const detachedComponents=deepFreeze(frozenComponents.filter(component=>!component.anchored));
  const fragments=deepFreeze(detachedComponents.map((component):StructuralFragment=>{
    const fragmentContentHash=historicalHash({schemaVersion:STRUCTURAL_FRAGMENT_SCHEMA_VERSION,
      componentId:component.componentId,sourceContentHash:component.sourceContentHash,
      sourceAdaptiveAuthorityDigest:component.sourceAdaptiveAuthorityDigest,componentContentHash:component.componentContentHash,
      occupiedCellKeys:component.occupiedCells.map(serializeStructuralCellAddress)});
    return deepFreeze({schemaVersion:STRUCTURAL_FRAGMENT_SCHEMA_VERSION,fragmentIdVersion:STRUCTURAL_FRAGMENT_ID_VERSION,
      fragmentId:historicalHash({schemaVersion:STRUCTURAL_FRAGMENT_ID_VERSION,objectId:component.objectId,
        objectRevision:component.objectRevision,componentId:component.componentId,fragmentContentHash}) as StructuralFragment["fragmentId"],
      componentId:component.componentId,objectId:component.objectId,objectRevision:component.objectRevision,
      sourceContentHash:component.sourceContentHash,sourceAdaptiveAuthorityDigest:component.sourceAdaptiveAuthorityDigest,
      occupiedCells:component.occupiedCells,fragmentContentHash});
  }).sort((left,right)=>compareStrings(left.fragmentId,right.fragmentId)));
  return deepFreeze({components:frozenComponents,anchoredComponents,detachedComponents,fragments});
};
