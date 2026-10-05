import { faceCounts, meshUnitFaces } from '../../../exporters/unit-faces.mjs';
import generatorSource from './index.ts?raw';
import adapterSource from './fixture.ts?raw';
import mesherSource from '../../../exporters/unit-faces.mjs?raw';
import { importFixture, type LabFixtureV1, type LabObject, type LabPayload, type LabTypedPayload, type LabVoxelRegion, type Vec3 } from '../../contracts/fixture';
import { canonicalJson, requireValue, sha256 } from '../../contracts/validation';
import { validatePatchRecipe, type PatchRecipe } from './index';

const q=0.125;
const frame=(id:string,originMeters:Vec3=[0,0,0])=>({id,originMeters,rotationXyzw:[0,0,0,1] as const,basis:'right-handed-y-up' as const});
type Cell=readonly[number,number,number];
export const PATCH_LIMITS=Object.freeze({indexedCells:2_000_000,projectionBytes:32*1024*1024,extentMeters:24});
export function validatePatchProjection(fixture:Pick<LabFixtureV1,'objects'|'payloads'>){const bytes=fixture.objects.reduce((sum,o)=>sum+o.meshes.reduce((n,m)=>n+[m.positions,m.indices,m.normals??m.positions,m.colors].reduce((b,id)=>b+(id?fixture.payloads.find(p=>p.id===id)!.length*4:0),0),0),0);requireValue(bytes<=PATCH_LIMITS.projectionBytes,'Patch exceeds whole-population projection budget');return bytes;}

/** Browser adapter around the original unit-face mesher and importer; no product export or physics. */
export async function buildPatchFixture(input:PatchRecipe,signal?:AbortSignal){
  const recipe=validatePatchRecipe(input);signal?.throwIfAborted();
  const codeSha=await sha256(new TextEncoder().encode(canonicalJson([generatorSource,adapterSource,mesherSource])));
  const recipeSha=await sha256(new TextEncoder().encode(canonicalJson(recipe)));
  const payloads:LabPayload[]=[],bytes=new Map<string,Uint8Array<ArrayBuffer>>(),objects:LabObject[]=[],regions:LabVoxelRegion[]=[],attachments:NonNullable<LabFixtureV1['attachments']>[number][]=[];
  let byteCount=0,indexedCells=0,projectionBytes=0;
  const arrays=new Map<LabTypedPayload,string>();
  async function payload(values:LabTypedPayload){
    const cached=arrays.get(values);if(cached)return cached;
    byteCount+=values.byteLength;requireValue(byteCount<=PATCH_LIMITS.projectionBytes,'Patch exceeds unique source payload budget');
    const type=values instanceof Uint8Array?'uint8':values instanceof Uint32Array?'uint32':values instanceof Float32Array?'float32':'unsupported';
    requireValue(type!=='unsupported','Unsupported patch payload');
    const data=new Uint8Array(values.byteLength),view=new DataView(data.buffer);
    for(let i=0;i<values.length;i++){if(type==='uint8')view.setUint8(i,values[i]);else if(type==='uint32')view.setUint32(i*4,values[i],true);else view.setFloat32(i*4,values[i],true);}
    const id=`patch-payload-${payloads.length}`,path=`payloads/${id}.bin`;
    payloads.push({id,path,elementType:type,byteOrder:'little',length:values.length,byteLength:data.byteLength,sha256:await sha256(data)});
    arrays.set(values,id);bytes.set(id,data);return id;
  }
  const templates=new Map<string,ReturnType<typeof volume>>();
  function volume(cells:readonly Cell[],materialId:string,anchor:Vec3=[0,0,0]){
    const min=[0,1,2].map((a)=>Math.min(...cells.map((c)=>c[a]))),max=[0,1,2].map((a)=>Math.max(...cells.map((c)=>c[a]))+1);
    const dimensions=max.map((v,a)=>v-min[a]) as [number,number,number],count=dimensions.reduce((a,b)=>a*b,1);
    requireValue(count<=150_000,'Plant template exceeds cell budget');
    const slots=new Uint8Array(count),coverage=new Uint8Array(count).fill(1);
    for(const c of cells)slots[c[0]-min[0]+dimensions[0]*(c[1]-min[1]+dimensions[1]*(c[2]-min[2]))]=1;
    const v={id:'patch-unit',dimensions,slots,coverage,materialIds:[materialId],originMeters:min.map((v,a)=>v*q-anchor[a]) as unknown as Vec3};
    const counts=faceCounts(v);requireValue([...counts.values()].reduce((a,b)=>a+b,0)*120<=4*1024*1024,'Plant template exceeds face budget');
    return {...v,meshes:meshUnitFaces(v,q,counts),bounds:{min:v.originMeters,max:max.map((v,a)=>v*q-anchor[a]) as unknown as Vec3}};
  }
  async function add(ownerId:string,sourceIds:readonly string[],position:Vec3,cells:readonly Cell[],materialId:string,physical:boolean,anchor:Vec3=[0,0,0]){
    signal?.throwIfAborted();const key=canonicalJson([cells,materialId,anchor]);let v=templates.get(key);if(!v){v=volume(cells,materialId,anchor);templates.set(key,v);}
    const mesh=v.meshes[0];projectionBytes+=mesh.positions.byteLength+mesh.normals.byteLength+mesh.indices.byteLength;
    requireValue(projectionBytes<=PATCH_LIMITS.projectionBytes,'Patch exceeds whole-population projection budget');
    objects.push({ownerId,sourceRevision:0,sourceIds,sourceNamespace:physical?'rd20-connected-wood-v1':'rd20-support-anchor-v1',frame:frame(ownerId,position),materialRoles:[materialId],bounds:v.bounds,
      meshes:[{positions:await payload(mesh.positions),normals:await payload(mesh.normals),indices:await payload(mesh.indices),materialId,presentationOnly:!physical}]});
    if(physical){indexedCells+=v.slots.length;requireValue(indexedCells<=PATCH_LIMITS.indexedCells,'Patch exceeds whole-population source-query budget');regions.push({id:`${ownerId}/region`,ownerId,originMeters:v.originMeters,dimensions:v.dimensions,occupancyPayload:await payload(v.slots),knownCoveragePayload:await payload(v.coverage)});}
  }
  // A small known-coverage ground volume gives source-query air above the patch. It is not an AABB wood substitute.
  const minX=Math.floor((recipe.bounds.min[0]-1)/q)*q,maxX=Math.ceil((recipe.bounds.max[0]+1)/q)*q,minZ=Math.floor((recipe.bounds.min[2]-1)/q)*q,maxZ=Math.ceil((recipe.bounds.max[2]+1)/q)*q;
  const width=Math.max(2,maxX-minX),depth=Math.max(2,maxZ-minZ),height=Math.max(2,Math.ceil((recipe.bounds.max[1]+1)/q)*q);
  requireValue(width<=PATCH_LIMITS.extentMeters&&depth<=PATCH_LIMITS.extentMeters&&recipe.parameters.candidates.every((s)=>s.positionMeters[1]===0),'Patch preview supports a bounded flat habitat; slope eligibility remains explicit');
  const dims=[Math.round(width/q),Math.round((height+q)/q),Math.round(depth/q)] as const,groundCount=dims.reduce((a,b)=>a*b,1);
  const wholeCells=groundCount+recipe.plants.reduce((sum,p)=>sum+[0,1,2].map((a)=>Math.max(...p.recipe.wood.map((w)=>w.cell[a]))-Math.min(...p.recipe.wood.map((w)=>w.cell[a]))+1).reduce((a,b)=>a*b,1),0);
  requireValue(wholeCells<=PATCH_LIMITS.indexedCells,'Patch exceeds whole-population source-query budget');indexedCells=groundCount;
  const groundSlots=new Uint8Array(groundCount),groundCoverage=new Uint8Array(groundCount).fill(1);
  for(let z=0;z<dims[2];z++)for(let x=0;x<dims[0];x++)groundSlots[x+dims[0]*dims[1]*z]=1;
  const cube=volume([[0,0,0]],'limestone-dry');const groundMesh=cube.meshes[0];
  for(let i=0;i<groundMesh.positions.length;i+=3){groundMesh.positions[i]*=width/q;groundMesh.positions[i+2]*=depth/q;}
  projectionBytes=groundMesh.positions.byteLength+groundMesh.normals.byteLength+groundMesh.indices.byteLength;
  objects.push({ownerId:'patch-ground',sourceRevision:0,sourceNamespace:'rd20-habitat-ground-v1',sourceIds:recipe.undergrowth.map((u)=>u.supportId),frame:frame('patch-ground',[minX,-q,minZ]),materialRoles:['limestone-dry'],bounds:{min:[0,0,0],max:[width,q,depth]},meshes:[{positions:await payload(groundMesh.positions),normals:await payload(groundMesh.normals),indices:await payload(groundMesh.indices),materialId:'limestone-dry'}]});
  regions.push({id:'patch-ground/region',ownerId:'patch-ground',originMeters:[0,0,0],dimensions:dims,occupancyPayload:await payload(groundSlots),knownCoveragePayload:await payload(groundCoverage)});
  for(const plant of recipe.plants){
    await add(plant.ownerId,plant.recipe.wood.map((w)=>w.id),plant.positionMeters,plant.recipe.wood.map((w)=>w.cell),'wood',true);
    for(const decor of plant.recipe.decor){const support=plant.recipe.wood.find((w)=>w.id===decor.supportId);requireValue(support,'Missing declared wood support');const anchor=support.cell.map((v)=>v*q) as unknown as Vec3,ownerId=`${plant.id}/${decor.id}`;
      await add(ownerId,[decor.id],plant.positionMeters.map((v,a)=>v+anchor[a]) as unknown as Vec3,decor.cells,'foliage',false,anchor);
      attachments.push({id:`${ownerId}/attachment`,ownerId,sourceIds:[decor.id],supportOwnerId:plant.ownerId,supportIds:[decor.supportId]});}
  }
  for(const under of recipe.undergrowth){await add(under.id,[under.id],under.positionMeters,under.cells,under.type,false);attachments.push({id:`${under.id}/attachment`,ownerId:under.id,sourceIds:[under.id],supportOwnerId:'patch-ground',supportIds:[under.supportId]});}
  const target:Vec3=[(minX+maxX)/2,2,(minZ+maxZ)/2];
  const manifest:LabFixtureV1={schema:'hestia-rd-fixture-v1',id:'F20-HABITAT-PATCH',kind:'synthetic',sourceRevision:0,units:'meter',quantumMeters:q,frame:frame('patch'),
    sourceRefs:[{kind:'synthetic',generatorPath:'src/experiments/foliage-shapes/fixture.ts',generatorCodeSha256:codeSha,generatorVersion:'rd20-unitface-support-patch-v1',seed:recipe.parameters.seed,testOnly:true,sourceDigest:recipeSha}],
    materials:[{id:'wood',role:'wood',colorLinearRgb:[.22,.12,.05]},{id:'foliage',role:'foliage',colorLinearRgb:[.19,.36,.11]},{id:'reed',role:'reed',colorLinearRgb:[.28,.32,.08]},{id:'accent',role:'accent',colorLinearRgb:[.48,.13,.62]},{id:'limestone-dry',role:'limestone-dry',colorLinearRgb:[.61,.57,.43]}],objects,payloads,voxelRegions:regions,attachments,
    cameras:[{id:'habitat-overview',positionMeters:[target[0]+12,9,target[2]-14],targetMeters:target,up:[0,1,0],verticalFovDegrees:55},{id:'habitat-roots',positionMeters:[target[0]+4,1.8,target[2]-6],targetMeters:[target[0],1.8,target[2]],up:[0,1,0],verticalFovDegrees:60}]};
  const manifestBytes=new TextEncoder().encode(canonicalJson(manifest));signal?.throwIfAborted();
  projectionBytes=validatePatchProjection(manifest);
  const fixture=await importFixture(manifestBytes,bytes);signal?.throwIfAborted();
  return {fixture,manifestBytes,payloads:bytes,recipeSha,codeSha,costs:{payloadBytes:byteCount,projectionBytes,indexedCells,owners:objects.length,templates:templates.size,woodMassKg:recipe.plants.reduce((n,p)=>n+p.recipe.wood.length,0),decorMassKg:0},warnings:recipe.plants.filter((p)=>p.recipe.emptyArchCells.length===0).map((p)=>`No visible root arch: ${p.id}`)};
}
