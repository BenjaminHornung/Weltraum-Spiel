import {copyFixturePayload,getFixtureDigest,importFixture,type LabFixtureV1} from '../../contracts/fixture';
import {array,canonicalJson,freezeJson,parseBoundedJson,record,relativePath,requireValue} from '../../contracts/validation';
import type {RayRecipe} from '../../experiments/voxel-rays/volume';
import {windBounds} from '../../experiments/foliage-wind';
import{validatePatchProjection}from'../../experiments/foliage-shapes/fixture';
import{GPU_PROJECTION_TOLERANCE_METERS}from'../../experiments/three-control';
export interface InspectorFinding{readonly code:string;readonly ownerId?:string;readonly count:number;readonly samples:readonly string[];}
export function inspectSourceBindings(input:unknown):InspectorFinding[]{const raw=record(input);array(raw.objects);array(raw.attachments??[]);const owners=raw.objects.map(record),findings:InspectorFinding[]=[];
 for(const value of (raw.attachments??[]) as unknown[]){const a=record(value),owner=owners.find(o=>o.ownerId===a.ownerId),support=owners.find(o=>o.ownerId===a.supportOwnerId);array(a.sourceIds);array(a.supportIds);
  if(!owner||!support||!a.sourceIds.every(id=>Array.isArray(owner.sourceIds)&&owner.sourceIds.includes(id))||!a.supportIds.every(id=>Array.isArray(support.sourceIds)&&support.sourceIds.includes(id)))findings.push({code:'SUPPORT_MISSING',ownerId:String(a.ownerId),count:1,samples:[String(a.id)]});}
 return findings;
}
/** Independent bounded cell-face oracle; no renderer, ray candidate or shared mesher determines truth. */
export function inspectFixture(fixture:LabFixtureV1,recipe?:RayRecipe){const digest=getFixtureDigest(fixture),findings=inspectSourceBindings(fixture),limits:string[]=[];
 const cells=(fixture.voxelRegions??[]).reduce((n,r)=>n+r.dimensions.reduce((a,b)=>a*b,1),0),expected=new Map<string,number>(),actual=new Map<string,number>(),extraFaces=new Map<string,number>(),unsupportedOwners=new Set<string>(),buckets=new Map<string,{key:string;point:number[];materialId:string}[]>();let copiedBytes=0,knownCells=0,occupiedCells=0,checkedQuads=0,processedQuads=0,expectedFaceCount=0,wrongSlots=0;
 const add=(map:Map<string,number>,key:string)=>map.set(key,(map.get(key)??0)+1),key=(owner:string,point:number[],axis:number,sign:number,mat:string)=>`${owner}|${axis}|${sign}|${canonicalJson(point)}|${mat}`;
 const bucket=(owner:string,point:number[],axis:number,sign:number)=>`${owner}|${axis}|${sign}|${point.join('/')}`,spatialIndices=(point:number[])=>point.map(v=>Math.round(v*2/fixture.quantumMeters));
 if(!recipe)limits.push('NO_BOUND_MATERIAL_SLOT_RECIPE');else{requireValue(recipe.fixtureDigest===digest&&recipe.fixtureId===fixture.id&&recipe.sourceRevision===fixture.sourceRevision,'Stale inspector recipe/source');
  if(fixture.quantumMeters<=GPU_PROJECTION_TOLERANCE_METERS*4)limits.push('SOURCE_QUANTUM_BELOW_PROJECTION_PRECISION');else if(cells>2_000_000)limits.push('SOURCE_COMPARISON_EXCEEDS_2M_CELLS');else regions:for(const region of fixture.voxelRegions??[]){const binding=recipe.regions.find(r=>r.id===region.id);requireValue(binding,'Missing bound source region');
   const occ=copyFixturePayload(fixture,region.occupancyPayload),coverage=copyFixturePayload(fixture,region.knownCoveragePayload),slots=copyFixturePayload(fixture,binding.materialSlotsPayload);requireValue(occ instanceof Uint8Array&&coverage instanceof Uint8Array&&slots instanceof Uint8Array&&occ.length===slots.length&&coverage.length===slots.length,'Invalid inspector cell format');copiedBytes+=occ.byteLength+coverage.byteLength+slots.byteLength;
   const [sx,sy,sz]=region.dimensions,offset=(x:number,y:number,z:number)=>x+sx*(y+sy*z),slot=(x:number,y:number,z:number)=>x<0||y<0||z<0||x>=sx||y>=sy||z>=sz?0:slots[offset(x,y,z)];
   for(let z=0;z<sz;z++)for(let y=0;y<sy;y++)for(let x=0;x<sx;x++){const i=offset(x,y,z);requireValue(coverage[i]<=1&&occ[i]<=1&&(slots[i]>0)===(occ[i]>0)&&slots[i]<=binding.materialIds.length&&(occ[i]===0||coverage[i]===1),'Source occupancy/material/coverage disagree');knownCells+=coverage[i];occupiedCells+=occ[i];if(!occ[i])continue;
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const n=[x,y,z];n[axis]+=sign;if(slot(...n as [number,number,number]))continue;if(expectedFaceCount>=100_000){limits.push('SOURCE_COMPARISON_EXCEEDS_100K_FACES');break regions;}expectedFaceCount++;const p=[x+.5,y+.5,z+.5];p[axis]=[x,y,z][axis]+(sign===1?1:0);const point=p.map((v,a)=>v*fixture.quantumMeters+region.originMeters[a]),materialId=binding.materialIds[slots[i]-1],faceKey=key(region.ownerId,point,axis,sign,materialId);add(expected,faceKey);const bin=bucket(region.ownerId,spatialIndices(point),axis,sign),rows=buckets.get(bin)??[];rows.push({key:faceKey,point,materialId});buckets.set(bin,rows);}}
  }
 }
 if(recipe&&cells<=2_000_000&&!limits.includes('SOURCE_COMPARISON_EXCEEDS_100K_FACES')&&!limits.includes('SOURCE_QUANTUM_BELOW_PROJECTION_PRECISION')){meshes:for(const owner of fixture.objects)for(const mesh of owner.meshes){if(mesh.presentationOnly)continue;
  const positions=copyFixturePayload(fixture,mesh.positions),indices=copyFixturePayload(fixture,mesh.indices);copiedBytes+=positions.byteLength+indices.byteLength;
  if(indices.length%6!==0){limits.push('NON_QUAD_TOPOLOGY');unsupportedOwners.add(owner.ownerId);continue;}
  for(let i=0;i<indices.length;i+=6){if(processedQuads>=100_000){limits.push('ACTUAL_GEOMETRY_EXCEEDS_100K_QUADS');break meshes;}processedQuads++;const verts=[...new Set(Array.from(indices.subarray(i,i+6)))];if(verts.length!==4){limits.push('NON_QUAD_TOPOLOGY');unsupportedOwners.add(owner.ownerId);continue;}
   const min=[0,1,2].map(a=>Math.min(...verts.map(v=>positions[v*3+a]))),max=[0,1,2].map(a=>Math.max(...verts.map(v=>positions[v*3+a]))),axis=min.findIndex((v,a)=>Math.abs(max[a]-v)<=GPU_PROJECTION_TOLERANCE_METERS*2);
   if(axis<0||[0,1,2].some(a=>a!==axis&&Math.abs(max[a]-min[a]-fixture.quantumMeters)>GPU_PROJECTION_TOLERANCE_METERS*2)){limits.push('MERGED_OR_NON_VOXEL_QUAD_UNQUALIFIED');unsupportedOwners.add(owner.ownerId);continue;}
   const a=indices[i],b=indices[i+1],c=indices[i+2],u=[0,1,2].map(j=>positions[b*3+j]-positions[a*3+j]),v=[0,1,2].map(j=>positions[c*3+j]-positions[a*3+j]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],sign=Math.sign(cross[axis]);requireValue(sign!==0,'Degenerate inspector triangle');
   const point=min.map((v,a)=>(v+max[a])/2),bin=spatialIndices(point),matches:{key:string;point:number[];materialId:string}[]=[];
   // Coarse bins only locate candidates. Exact admitted source coordinates decide parity.
   for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const row of buckets.get(bucket(owner.ownerId,[bin[0]+x,bin[1]+y,bin[2]+z],axis,sign))??[])if(row.point.every((v,a)=>Math.abs(v-point[a])<=GPU_PROJECTION_TOLERANCE_METERS))matches.push(row);
   const common=Array.from(indices.subarray(i,i+3)).filter(v=>Array.from(indices.subarray(i+3,i+6)).includes(v));
   const diagonal=common.length===2&&[0,1,2].every(a=>a===axis||Math.abs(Math.abs(positions[common[0]*3+a]-positions[common[1]*3+a])-fixture.quantumMeters)<=GPU_PROJECTION_TOLERANCE_METERS*2);
   const a2=indices[i+3],b2=indices[i+4],c2=indices[i+5],u2=[0,1,2].map(j=>positions[b2*3+j]-positions[a2*3+j]),v2=[0,1,2].map(j=>positions[c2*3+j]-positions[a2*3+j]),cross2=[u2[1]*v2[2]-u2[2]*v2[1],u2[2]*v2[0]-u2[0]*v2[2],u2[0]*v2[1]-u2[1]*v2[0]];
   const sameMaterial=matches.filter(row=>row.materialId===mesh.materialId&&diagonal&&Math.sign(cross2[axis])===sign&&verts.every(v=>[0,1,2].every(a=>Math.abs((a===axis?Math.abs(positions[v*3+a]-row.point[a]):Math.abs(Math.abs(positions[v*3+a]-row.point[a])-fixture.quantumMeters/2)))<=GPU_PROJECTION_TOLERANCE_METERS))),matched=sameMaterial.find(row=>(actual.get(row.key)??0)<(expected.get(row.key)??0))??sameMaterial[0];
   if(matched)add(actual,matched.key);else{add(extraFaces,key(owner.ownerId,point,axis,sign,mesh.materialId));if(matches.length&&!matches.some(row=>row.materialId===mesh.materialId))wrongSlots++;}checkedQuads++;
  }
 }
 if(!limits.includes('ACTUAL_GEOMETRY_EXCEEDS_100K_QUADS')){const missing=[...expected.keys()].filter(k=>!unsupportedOwners.has(k.split('|')[0])&&(actual.get(k)??0)!==expected.get(k)),extra=[...actual.keys()].filter(k=>!unsupportedOwners.has(k.split('|')[0])&&(expected.get(k)??0)!==actual.get(k)).concat([...extraFaces.keys()].filter(k=>!unsupportedOwners.has(k.split('|')[0])));
 if(wrongSlots)findings.push({code:'MATERIAL_SLOT_MISMATCH',count:wrongSlots,samples:[...extraFaces.keys()].slice(0,12)});
 if(missing.length)findings.push({code:'MESH_SURFACE_MISSING',count:missing.length,samples:missing.slice(0,12)});
 if(extra.length)findings.push({code:'MESH_SURFACE_EXTRA',count:extra.length,samples:extra.slice(0,12)});}
 }
 return freezeJson({schema:'hestia-rd-inspector-findings-v1',productIntegrated:false,fixtureId:fixture.id,fixtureDigest:digest,sourceRevision:fixture.sourceRevision,recipeDigest:recipe?.recipeSha256??null,
  status:findings.length?'FAIL':limits.length?'UNSUPPORTED':'PASS',findings,limits:[...new Set(limits)],quantumMeters:fixture.quantumMeters,frame:fixture.frame,sourceRefs:fixture.sourceRefs,
  owners:fixture.objects.map(o=>({ownerId:o.ownerId,namespace:o.sourceNamespace,revision:o.sourceRevision,frame:o.frame,sourceIds:o.sourceIds,materialRoles:o.materialRoles,bounds:o.bounds,animatedBounds:windBounds(o.bounds)})),attachments:fixture.attachments??[],
  costs:{sourcePayloadBytes:fixture.payloads.reduce((n,p)=>n+p.byteLength,0),comparisonCopiedBytes:copiedBytes,sourceCells:cells,sourceCountsPartial:limits.some(s=>s.startsWith('SOURCE_COMPARISON_EXCEEDS')),actualCountsPartial:limits.includes('ACTUAL_GEOMETRY_EXCEEDS_100K_QUADS'),knownCells,occupiedCells,expectedFaces:limits.some(s=>s.startsWith('SOURCE_COMPARISON_EXCEEDS'))?null:[...expected.values()].reduce((a,b)=>a+b,0),checkedQuads,processedQuads,nativeGpuBytes:'UNSUPPORTED',gpuMs:'NOT_RUN_NO_LEASE'},
  authority:'CELL_SOURCE_AND_BOUND_RECIPE_ONLY; GLB_WITHOUT_CELLS_IS_PREVIEW_ONLY; NO_NATIVE_PHYSICS_OR_ART_ACCEPTANCE'});
}
export function inspectorFindingBytes(value:ReturnType<typeof inspectFixture>,viewpoint:{cameraId:string;tick:number;view:string;ownerId:string;hidden?:boolean;slice?:{regionId:string;yCell:number;mode:'occupied'|'coverage'}|null}){const bytes=new TextEncoder().encode(canonicalJson({...value,viewpoint}));parseBoundedJson(bytes);return bytes;}
/** File inputs are virtual supplied bytes, never paths followed on the host filesystem. */
export async function importInspectorPackage(manifestBytes:Uint8Array,payloads:ReadonlyMap<string,Uint8Array>){const fixture=await importFixture(manifestBytes,payloads);requireValue(fixture.objects.length<=300,'Inspector exceeds 300 owner previews');validatePatchProjection(fixture);return fixture;}
export async function readInspectorFiles(files:readonly File[]){requireValue(files.length>0&&files.length<=512,'Empty/over-budget file package');let total=0;const byPath=new Map<string,File>();
 for(const file of files){const parts=(file.webkitRelativePath||file.name).split('/'),relative=file.webkitRelativePath?parts.slice(1).join('/'):file.name;relativePath(relative);requireValue(!byPath.has(relative),'Duplicate package path');total+=file.size;requireValue(total<=129*1024*1024,'Package exceeds manifest/payload cap');byPath.set(relative,file);}
 const manifest=byPath.get('manifest.json');requireValue(manifest&&manifest.size<=1024*1024,'Missing/oversize manifest');const bytes=new Uint8Array(await manifest.arrayBuffer()),raw=record(parseBoundedJson(bytes));array(raw.payloads);
 const allowed=new Set(['manifest.json','recipe.json']);for(const value of raw.payloads){const p=record(value);relativePath(p.path);allowed.add(p.path);}requireValue([...byPath.keys()].every(p=>allowed.has(p)),'Foreign files/external textures are unsupported');
 const payloads=new Map<string,Uint8Array>();for(const value of raw.payloads){const p=record(value),file=byPath.get(p.path as string);requireValue(typeof p.id==='string'&&file&&file.size===p.byteLength,'Missing/corrupt binary payload');payloads.set(p.id,new Uint8Array(await file.arrayBuffer()));}return importInspectorPackage(bytes,payloads);
}
