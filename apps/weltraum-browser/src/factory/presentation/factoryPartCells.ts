import cutterSourceBytes from "../../../../../art/factory/fp02/cutter/source.scene.json?raw";
import formerSourceBytes from "../../../../../art/factory/fp02/former/source.scene.json?raw";
import cutterAuthoringBytes from "../../../../../art/factory/fp02/cutter/authoring-v1.json?raw";
import formerAuthoringBytes from "../../../../../art/factory/fp02/former/authoring-v1.json?raw";
import {
  artifactRevision, createMeshArtifact, deepFreezeMetadata, frameId, representationKey, sourceRevision,
  type AxisAlignedBounds, type MaterialProfile, type MeshArtifact
} from "../../presentation";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";
import { HVP_COAST_MESH_ALGORITHM_VERSION, meshHvpOccupancy } from "../../hvp/hvpCoastMesher";
import { createFactoryInstallationProfile } from "../construction/installationProfile";
import {
  createFactoryAssetProjection, getFactoryAssetSource, readFactoryAssetDefinition,
  type FactoryAssetDefinitionRef, type FactoryAssetSource
} from "./factoryAssets";

export interface FactoryPartCell {
  readonly partId: string; readonly role: string;
  readonly sourceLocalBounds: AxisAlignedBounds;
  readonly originMeters: Readonly<{x:number;y:number;z:number}>;
  readonly sizeX:number; readonly sizeY:number; readonly sizeZ:number;
  readonly cellMeters:0.125; readonly occupiedCellCount:number; readonly cellDigest:string;
  readSlot(ix:number,iy:number,iz:number):number;
  copySlots():Uint8Array;
}
export interface FactoryPartCells {
  readonly definitionRef:FactoryAssetDefinitionRef; readonly source:FactoryAssetSource;
  readonly sourceDigest:string; readonly profileDigest:string; readonly frameId:string;
  readonly cellMeters:0.125; readonly parts:readonly FactoryPartCell[];
  readonly semanticParents:Readonly<Record<string,string>>;
  readonly authoringJointDigest:string; readonly authoringDigest:string;
  readonly sourceFileSha256:string; readonly authoringFileSha256:string;
  /** Local palette slots, never physical material, density or inventory IDs. */
  readonly renderRoles:Readonly<Record<number,string>>;
}
export interface FactoryPartCellProjection extends FactoryPartCells {
  readonly bounds:AxisAlignedBounds;
  readonly parts:readonly (FactoryPartCell & Readonly<{artifact:MeshArtifact;materialProfiles:readonly MaterialProfile[]}> )[];
}

const CELL_METERS = 0.125;
const MAX_PART_GRID_CELLS = 32_768;
const FRAME = "fp02_east_north_height_xyz_v1";
const VERSION = "factory-partcells-v1";
const renderRoles = Object.freeze({1:"EX-STRUCT",2:"EX-SHELL",3:"EX-FUNCTION",4:"EX-HAZARD"});
const roleSlots = new Map<string,number>(Object.entries(renderRoles).map(([slot,role])=>[role,Number(slot)]));
// These are existing canonical FNV signatures over the complete raw strings,
// including whitespace. SHA256 provenance is verified by the unit/source receipts.
// FNV is a deterministic closed-source binding, not a cryptographic trust claim.
const bindings = Object.freeze({
  B06:{definitionDigest:"fnv1a:9f35228b",sourceBytes:cutterSourceBytes,sourceLength:19222,sourceBytesDigest:"0cc17adc",
    authoringBytes:cutterAuthoringBytes,authoringLength:5596,authoringBytesDigest:"1413eec5",sourceDigest:"fa99c5df",
    authoringDigest:"1c11e2df",jointDigest:"068f31d3",parent:"cutter_frame",parts:12,boxes:33,
    sourceFileSha256:"abd1ce25fd19ad61a9cb65de9f5ba10c303aa5c1a1aa16260de9dce9534fa5fd",
    authoringFileSha256:"0cdb071fb15c5b7c5ee57fa5f10685b8919b741adbe0d10c5e7f47f93cca1a61"},
  B07:{definitionDigest:"fnv1a:1cb654af",sourceBytes:formerSourceBytes,sourceLength:19487,sourceBytesDigest:"f65e926f",
    authoringBytes:formerAuthoringBytes,authoringLength:5889,authoringBytesDigest:"fd72ca0b",sourceDigest:"13c8ba14",
    authoringDigest:"759f96e1",jointDigest:"dd3f41e7",parent:"former_frame",parts:13,boxes:34,
    sourceFileSha256:"4e27abd922e46516d1db0307b8dfb5edaf1b8c6807e80006781344b9dfcf535d",
    authoringFileSha256:"31500d6c38d06be22226940222c8abcba5d2e9e48483e36293910da71575c34b"}
});
interface Authoring {
  schema:string;
  asset:{assetId:string;assetRevision:number;representation:string;metersPerUnit:number;
    coordinateFrame:{upAxis:string;forwardAxis:string;handedness:string}};
  parts:readonly {partId:string;representation:string;collisionPolicy:string;navigationPolicy:string}[];
  joints:readonly {jointId:string;parentPartId:string;childPartId:string;jointType:string;breakPolicy:string}[];
}
const vector = (v:readonly number[]) => ({x:v[0]!,y:v[1]!,z:v[2]!});
const exactVector = (v:readonly number[]):boolean => v.length===3 && v.every(Number.isFinite);
const cache = new Map<string,FactoryPartCells>();

/**
 * Closed geometry derivative of the original fixed Native B06/B07 recipes.
 * Admission precedes occupancy allocation and is repeated even on a cache hit.
 * No structural ingest, world owner, mass recipe or mutable cell edits exist here.
 */
export const compileFactoryPartCells = (ref:FactoryAssetDefinitionRef):FactoryPartCells => {
  if(ref.sourceId!=="B06" && ref.sourceId!=="B07")throw Error("Factory partcells definition mismatch");
  const binding=bindings[ref.sourceId], definition=readFactoryAssetDefinition(ref.sourceId);
  if(!definition || ref.version!==1 || ref.version!==definition.version || ref.digest!==definition.digest
    || ref.digest!==binding.definitionDigest)throw Error("Factory partcells definition mismatch");
  if(binding.sourceBytes.length!==binding.sourceLength || canonicalSignature(binding.sourceBytes)!==binding.sourceBytesDigest)
    throw Error("Factory partcells source bytes mismatch");
  if(binding.authoringBytes.length!==binding.authoringLength || canonicalSignature(binding.authoringBytes)!==binding.authoringBytesDigest)
    throw Error("Factory partcells authoring bytes mismatch");
  const source=getFactoryAssetSource(ref.sourceId);
  if(source.frameId!==FRAME || source.origin!=="ground-center" || source.metersPerUnit!==1)
    throw Error("Factory partcells source frame mismatch");
  if(source.authoringGridM!==.25 || source.terrainCellM!==CELL_METERS)throw Error("Factory partcells source grid mismatch");

  // Only tiny box descriptors are allocated here; every part's bounds pass
  // before allocating any occupancy buffer, without rounding or epsilon repair.
  const descriptors=source.parts.map(part=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    const boxes=part.boxes.map(box=>{
      if((box.rotationZRadians??0)!==0)throw Error("Factory partcells source rotation rejected");
      if(!exactVector(box.centerM)||!exactVector(box.sizeM)||box.sizeM.some(v=>v<=0))
        throw Error("Factory partcells source bounds invalid");
      const slot=roleSlots.get(box.material);
      if(slot===undefined)throw Error("Factory partcells render role palette mismatch");
      const lo=box.centerM.map((v,i)=>(v-box.sizeM[i]!/2)/CELL_METERS);
      const hi=box.centerM.map((v,i)=>(v+box.sizeM[i]!/2)/CELL_METERS);
      if(![...lo,...hi].every(Number.isSafeInteger))throw Error("Factory partcells exact grid mismatch");
      for(let i=0;i<3;i++){min[i]=Math.min(min[i]!,lo[i]!);max[i]=Math.max(max[i]!,hi[i]!);}
      return {lo,hi,slot};
    });
    const size=max.map((v,i)=>v-min[i]!);
    const count=size.reduce((n,v)=>n*v,1);
    if(!Number.isSafeInteger(count)||count<=0||count>MAX_PART_GRID_CELLS||size.some(v=>v>=1024))
      throw Error("Factory partcells bounds BudgetExceeded");
    return {part,min,max,size,boxes,count};
  });
  const scene=JSON.parse(binding.sourceBytes) as {schema:string;assets:FactoryAssetSource[]};
  if(scene.schema!=="hestia.factory-s0-source.v1" || scene.assets.length!==1 || source.definitionId!==ref.sourceId
    || source.revision!==1 || source.kind!=="S0-proxy" || source.parts.length!==binding.parts
    || descriptors.reduce((n,p)=>n+p.boxes.length,0)!==binding.boxes
    || new Set(source.parts.map(p=>p.partId)).size!==binding.parts
    || canonicalJson(source)!==canonicalJson(scene.assets[0]) || canonicalSignature(source)!==binding.sourceDigest)
    throw Error("Factory partcells source binding mismatch");
  const authoring=JSON.parse(binding.authoringBytes) as Authoring;
  const partIds=source.parts.map(p=>p.partId).sort();
  if(authoring.schema!=="hestia.asset-authoring.v1" || authoring.asset.assetId!==source.assetId
    || authoring.asset.assetRevision!==source.revision || authoring.asset.representation!=="StructuralAssembly"
    || authoring.asset.metersPerUnit!==1 || canonicalJson(authoring.asset.coordinateFrame)!==canonicalJson({upAxis:"+Y",forwardAxis:"+Z",handedness:"RIGHT"})
    || canonicalJson(authoring.parts.map(p=>p.partId).sort())!==canonicalJson(partIds)
    || authoring.parts.some(p=>p.representation!=="ModularPart" || p.collisionPolicy!=="Compound" || p.navigationPolicy!=="Obstacle")
    || authoring.joints.length!==4 || new Set(authoring.joints.map(j=>j.childPartId)).size!==4
    || canonicalJson(authoring.joints.map(j=>j.childPartId).sort())!==canonicalJson(source.joints.map(j=>j.partId).sort())
    || authoring.joints.some(j=>j.parentPartId!==binding.parent || !partIds.includes(j.childPartId)
      || j.jointId!==`${j.childPartId}_joint` || j.jointType!=="Slider" || j.breakPolicy!=="Scripted")
    || canonicalSignature(authoring)!==binding.authoringDigest || canonicalSignature(authoring.joints)!==binding.jointDigest)
    throw Error("Factory partcells authoring part/joint/version mismatch");
  const native=createFactoryInstallationProfile(ref.sourceId);
  if(native.sourceDigest!==canonicalSignature(source) || canonicalJson(native.source)!==canonicalJson(source)
    || canonicalJson(native.definitionRef)!==canonicalJson({sourceId:ref.sourceId,version:ref.version,digest:ref.digest}))
    throw Error("Factory partcells native profile/source binding mismatch");
  const cached=cache.get(ref.sourceId);
  if(cached){
    if(cached.profileDigest!==native.profileDigest)throw Error("Factory partcells native profile digest mismatch");
    return cached;
  }
  const parts=descriptors.map<FactoryPartCell>(({part,min,max,size,boxes,count})=>{
    const slots=new Uint8Array(count),[sizeX,sizeY,sizeZ]=size as [number,number,number];
    // Last source box wins the local render role on overlap, in original source
    // order. Union occurs only inside this part; other parts retain their cells.
    for(const box of boxes)for(let z=box.lo[2]!;z<box.hi[2]!;z++)for(let y=box.lo[1]!;y<box.hi[1]!;y++)for(let x=box.lo[0]!;x<box.hi[0]!;x++)
      slots[((z-min[2]!)*sizeY+y-min[1]!)*sizeX+x-min[0]!]=box.slot;
    const originMeters=vector(min.map(v=>v*CELL_METERS));
    const sourceLocalBounds={min:originMeters,max:vector(max.map(v=>v*CELL_METERS))};
    const cellDigest=canonicalSignature({version:VERSION,sourceDigest:native.sourceDigest,partId:part.partId,originMeters,size,slots:Array.from(slots)});
    return deepFreezeMetadata({partId:part.partId,role:part.role,sourceLocalBounds,originMeters,sizeX,sizeY,sizeZ,cellMeters:CELL_METERS,
      occupiedCellCount:slots.reduce((n,v)=>n+(v===0?0:1),0),cellDigest,
      readSlot:(x:number,y:number,z:number):number=>{
        if(![x,y,z].every(Number.isSafeInteger))throw Error("Factory partcells index invalid");
        return x<0||x>=sizeX||y<0||y>=sizeY||z<0||z>=sizeZ?0:slots[(z*sizeY+y)*sizeX+x]!;
      },copySlots:()=>slots.slice()});
  });
  const product:FactoryPartCells=deepFreezeMetadata({definitionRef:{...native.definitionRef},source:native.source,sourceDigest:native.sourceDigest,
    profileDigest:native.profileDigest,frameId:source.frameId,cellMeters:CELL_METERS,parts,renderRoles,
    semanticParents:Object.fromEntries(authoring.joints.map(j=>[j.childPartId,j.parentPartId])),authoringDigest:binding.authoringDigest,
    authoringJointDigest:binding.jointDigest,sourceFileSha256:binding.sourceFileSha256,authoringFileSha256:binding.authoringFileSha256});
  cache.set(ref.sourceId,product);
  return product;
};

/** Bounded instance projection; mutable MeshArtifact snapshots are never cached. */
export const createFactoryPartCellProjection = (ref:FactoryAssetDefinitionRef):FactoryPartCellProjection => {
  if(typeof ref.instanceId!=="string" || ref.instanceId.length===0)throw Error("Factory partcells instance binding required");
  const product=compileFactoryPartCells(ref);
  // Reuse the accepted existing MaterialProfiles rather than interpreting role
  // slots as HVP terrain materials or constructing a competing physical palette.
  const accepted=createFactoryAssetProjection(ref,product.source);
  const profiles=new Map(accepted.parts.flatMap(p=>p.materialProfiles.map(profile=>[profile.id,profile] as const)));
  const parts=product.parts.map(part=>{
    const mesh=meshHvpOccupancy({...part,slotAt:part.readSlot},
      {maxVisitedCells:MAX_PART_GRID_CELLS,maxQuads:196_608,maxVertices:786_432,maxIndices:1_179_648},
      part.cellDigest,`${VERSION}:${HVP_COAST_MESH_ALGORITHM_VERSION}`);
    const materialRanges=mesh.materialRanges.map(range=>{
      const role=renderRoles[range.slot as keyof typeof renderRoles];
      const profile=profiles.get(`fp06_${role.toLowerCase().replace("-","_")}` as MaterialProfile["id"]);
      if(!profile)throw Error("Factory partcells accepted material profile missing");
      return {materialProfileId:profile.id,startIndex:range.startIndex,indexCount:range.indexCount};
    });
    const artifact=createMeshArtifact({representationKey:representationKey(`factory-partcells:${ref.instanceId}:${part.partId}`),
      sourceRevision:sourceRevision(product.source.revision),artifactRevision:artifactRevision(1),algorithmVersion:mesh.algorithmVersion,
      frameId:frameId(product.frameId),positions:mesh.positions,normals:mesh.normals,indices:mesh.indices,materialRanges,bounds:mesh.boundsMeters});
    return Object.freeze({...part,artifact,materialProfiles:Object.freeze([...new Set(materialRanges.map(r=>profiles.get(r.materialProfileId)!))])});
  });
  return deepFreezeMetadata({...product,definitionRef:{...product.definitionRef,instanceId:ref.instanceId},parts,bounds:accepted.bounds});
};
