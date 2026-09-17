import {expect,it} from "vitest";
import {buildHvpPlant,planHvpVegetation,meshHvpVegetation,hvpPlantSourceDigest} from "../../src/hestia-prototype/presentation/vegetation";
import {encodeHvpPlant,decodeHvpPlant,hvpPlantCheckpointBytes} from "../../src/hestia-prototype/persistence/plantCheckpoint";
import {createPersistenceSignature,serializeCanonicalPersistenceValue} from "../../src/persistence";
import {materializeHvpCoastSource,prepareHvpCoastSource,restoreHvpCoastSource} from "../../src/hvp/hvpCoastSource";

it("restores saved root-tree and ground-plant cells without regenerating them, including canonically sorted JSON",()=>{
  const terrain=prepareHvpCoastSource(materializeHvpCoastSource());
  const instances=planHvpVegetation();
  for(const instance of [instances[0]!,instances.find(p=>p.kind!=="tree")!]){
    const original=buildHvpPlant(instance),slots=original.decoration.copySlots();
    // A valid saved palette cell differs from the authored generator. Rebuilding
    // the seed instead of loading its actual bytes cannot pass this round trip.
    const index=slots.findIndex(v=>v!==0);slots[index]=slots[index]===1?2:1;
    const d=original.decoration,decoration={...d,copySlots:()=>slots.slice(),
      slotAt:(x:number,y:number,z:number)=>x<0||y<0||z<0||x>=d.sizeX||y>=d.sizeY||z>=d.sizeZ?0:slots[x+y*d.sizeX+z*d.sizeX*d.sizeY]!};
    const source={...original,decoration,digest:hvpPlantSourceDigest(instance.id,[original.wood,decoration])},encoded=encodeHvpPlant(source);
    const artifact=JSON.parse(serializeCanonicalPersistenceValue(encoded));
    const restored=decodeHvpPlant(artifact,terrain);
    expect(restored.instance).toEqual(source.instance);expect(restored.digest).toBe(source.digest);
    expect(restored.decoration.copySlots()).toEqual(source.decoration.copySlots());
    expect(restored.wood?.copySlots()).toEqual(source.wood?.copySlots());
    expect(restored.attachments).toEqual(source.attachments);expect(restored.anchors).toEqual(source.anchors);
    expect(meshHvpVegetation(restored).map(p=>p.artifact.contentHash)).toEqual(meshHvpVegetation(source).map(p=>p.artifact.contentHash));
    const wrong=structuredClone(artifact);wrong.attachments[0].supportOwnerId="foreign";
    const {signature:_,...data}=wrong;wrong.signature=createPersistenceSignature(data);
    expect(()=>decodeHvpPlant(wrong,terrain)).toThrow(/support/);
    expect(()=>hvpPlantCheckpointBytes({...artifact,generator:"future"})).toThrow(/profile/);
  }
},120_000);
it("checks actual restored base occupancy against its declared coast digest without using the generator",()=>{
  const snapshot=materializeHvpCoastSource(),slots=snapshot.copySlots();
  expect(restoreHvpCoastSource(slots,snapshot.sourceDigest).sourceDigest).toBe(snapshot.sourceDigest);
  slots[0]=slots[0]===0?1:0;
  expect(()=>restoreHvpCoastSource(slots,snapshot.sourceDigest)).toThrow(/digest mismatch/);
},120_000);
