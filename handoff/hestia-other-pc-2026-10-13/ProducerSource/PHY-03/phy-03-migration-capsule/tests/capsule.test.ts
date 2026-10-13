import {expect,it} from "vitest";
import body from "../snapshot/tests/fixtures/hvp-contact-r90-body384.json";
import {R,initializeHvpRapier} from "../snapshot/src/hestia-prototype/physics/rapierPort";
import {prepareHvpRigidBody,installHvpRigidBody} from "../snapshot/src/hestia-prototype/physics/rigidBody";
import {ingestHvpStructuralCells} from "../snapshot/src/hestia-prototype/terrain/structuralIngest";
import {encodeHvpBody,decodeHvpBody} from "../snapshot/src/hestia-prototype/persistence/bodyCheckpoint";
import {readHvpBodyCells} from "../snapshot/src/hestia-prototype/physics/bodyCutPlan";
import {migrateLegacy,decodeEnvelope,encodeEnvelope,sha256,canonicalJson} from "../src/capsule";

const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v));
const saved=()=>bytes(body);
const rehash=async(value:object)=>{
  const record=value as Record<string,unknown>;
  const {digest:_,...payload}=record;return {...payload,digest:await sha256(new TextEncoder().encode(canonicalJson(payload)))};
};
it("preserves exact input bytes, IDs, cells, materials, mass, motion and independent profile refs",async()=>{
  const input=saved(),before=input.slice(),e=await migrateLegacy(input,"body"),d=await decodeEnvelope(encodeEnvelope(e));
  expect(input).toEqual(before);expect(d.legacy).toEqual(before);expect(d.canonical).toEqual(e.canonical);
  const original=decodeHvpBody(JSON.parse(new TextDecoder().decode(input)));
  const projected=(e.canonical as {bodies:unknown[]}).bodies[0];
  expect(projected).toEqual({ownerId:original.checkpoint.ownerId,family:original.checkpoint.family,
    dynamic:original.checkpoint.dynamic,sleeping:original.checkpoint.sleeping,ccd:original.checkpoint.ccd,
    source:{objectId:original.recipe.source.objectId,objectRevision:original.recipe.source.objectRevision,
      contentHash:original.recipe.source.contentHash,frame:original.recipe.source.frame,materials:original.recipe.source.materials,
      cells:readHvpBodyCells(original.recipe.source)},mass:original.recipe.mass,motion:original.motion});
  expect(readHvpBodyCells(original.recipe.source)).toHaveLength(384);
  expect(e.sourceCodec.id).toBe("legacy-structural-region-v1");
  expect(e.solverProfile.id).toBe("rapier-0.12.0-compat-hvp-control-v1");
  expect(e.collisionProfile.id).toBe("owner-uniform-rebuild-v1");
  expect(e.surfaceBindings[0]!.kind).toBe("owner-uniform");
  expect(encodeEnvelope(await migrateLegacy(d.legacy,"body"))).toEqual(encodeEnvelope(e));
});
it("binds raw UTF-8 independently of equivalent JSON formatting",async()=>{
  const compact=await migrateLegacy(saved(),"body"),formatted=bytes(body);
  const pretty=await migrateLegacy(new TextEncoder().encode(JSON.stringify(body,null,2)),"body");
  expect(pretty.canonical).toEqual(compact.canonical);expect(pretty.legacy.sha256).not.toBe(compact.legacy.sha256);
  expect((await decodeEnvelope(encodeEnvelope(compact))).legacy).toEqual(formatted);
});
it("preserves a valid legacy UTF-8 BOM through migration and decoding",async()=>{
  const input=new Uint8Array([239,187,191,...saved()]),e=await migrateLegacy(input,"body");
  expect((await decodeEnvelope(encodeEnvelope(e))).legacy).toEqual(input);
  expect(e.canonical).toEqual((await migrateLegacy(saved(),"body")).canonical);
});
it.each(["version","worldFormatVersion","sourceCodec","solverProfile","collisionProfile"])("rejects unknown or damaged %s even after envelope rehash",async field=>{
  const e=structuredClone(await migrateLegacy(saved(),"body")) as unknown as Record<string,unknown>;
  e[field]=field==="version"||field==="worldFormatVersion"?"future-format":{id:"unknown",digest:"0".repeat(64)};
  await expect(decodeEnvelope(bytes(await rehash(e)))).rejects.toThrow();
});
it("rejects payload, canonical, provenance and profile digest tampering",async()=>{
  const e=await migrateLegacy(saved(),"body");
  for(const changed of [{...e,canonical:{}},{...e,legacy:{...e.legacy,sha256:"0".repeat(64)}},
    {...e,provenance:{...e.provenance,sourceCommit:"0".repeat(40)}},
    {...e,solverProfile:{...e.solverProfile,digest:"0".repeat(64)}}]){
    await expect(decodeEnvelope(bytes(await rehash(changed)))).rejects.toThrow();
  }
  const damaged=encodeEnvelope(e).slice();damaged[damaged.length-2]=33;
  await expect(decodeEnvelope(damaged)).rejects.toThrow();
});
it("does not register 0.21, voxels, owned-subset or unsupported transport",async()=>{
  await expect(migrateLegacy(saved(),"body","voxels-v1")).rejects.toThrow(/profile/i);
  await expect(migrateLegacy(new Uint8Array([255]),"body")).rejects.toThrow();
  await expect(migrateLegacy(new Uint8Array(0),"body")).rejects.toThrow();
  await expect(migrateLegacy(new Uint8Array(16*1024*1024+1),"body")).rejects.toThrow(/budget/i);
  const changed=structuredClone(body),region=JSON.parse(changed.region);region.object.schemaVersion="owned-subset-v1";
  changed.region=JSON.stringify(region);await expect(migrateLegacy(bytes(changed),"body")).rejects.toThrow();
});
it("rejects nonfinite/missing motion and material registry using the original codec",async()=>{
  for(const mutation of ["nonfinite","motion","materials"]){
    const changed=structuredClone(body),region=JSON.parse(changed.region);
    if(mutation==="nonfinite"){region.motions[0].linvelMetersPerSecond.x=null;}
    if(mutation==="motion"){region.motions=[];}
    if(mutation==="materials"){region.object.materials=[];}
    changed.region=JSON.stringify(region);await expect(migrateLegacy(bytes(changed),"body")).rejects.toThrow();
  }
});
it("rejects ambiguous heterogeneous surface migration, retains exact ordered legacy bindings",async()=>{
  await initializeHvpRapier();const world=new R.World({x:0,y:0,z:0});
  const recipe=prepareHvpRigidBody(ingestHvpStructuralCells("saved-L",[
    {x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}
  ],[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}]));
  let changed:ReturnType<typeof encodeHvpBody>;
  try{changed=structuredClone(encodeHvpBody("saved:body","terrain",recipe,installHvpRigidBody(world,recipe)));}
  finally{world.free();}
  expect(changed.surfaces.length).toBeGreaterThan(1);
  Object.assign(changed.surfaces[1]!,{friction:.123});
  await expect(migrateLegacy(bytes(changed),"body")).rejects.toThrow(/heterogeneous/i);
  const ordered=await migrateLegacy(bytes(changed),"body","legacy-ordered-boxes-v1");
  expect(ordered.surfaceBindings[0]!.kind).toBe("legacy-ordered-boxes");
  const edited=structuredClone(ordered),binding=edited.surfaceBindings[0]!;
  if(binding.kind!=="legacy-ordered-boxes"){throw new Error("Wrong surface binding");}
  Object.assign(binding,{entries:[...binding.entries].reverse()});
  await expect(decodeEnvelope(bytes(await rehash(edited)))).rejects.toThrow(/projection|binding/i);
});
