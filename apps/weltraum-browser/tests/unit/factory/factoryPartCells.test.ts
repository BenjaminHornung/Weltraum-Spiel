import { afterEach, describe, expect, it, vi } from "vitest";
import * as sources from "../../../src/factory/presentation/factoryAssets";
import { createFactoryInstallationProfile } from "../../../src/factory/construction/installationProfile";
import { canonicalJson, canonicalSignature } from "../../../src/resources/serialization";
import { meshHvpOccupancy } from "../../../src/hvp/hvpCoastMesher";
import { validateMeshArtifact } from "../../../src/presentation";
import { compileFactoryPartCells, createFactoryPartCellProjection } from "../../../src/factory/presentation/factoryPartCells";
import cutterSourceRaw from "../../../../../art/factory/fp02/cutter/source.scene.json?raw";
import cutterAuthoringRaw from "../../../../../art/factory/fp02/cutter/authoring-v1.json?raw";

const ref = (sourceId="B06") => {
  const d=sources.readFactoryAssetDefinition(sourceId)!;
  return {sourceId:d.sourceId,version:d.version,digest:d.digest};
};
afterEach(()=>vi.restoreAllMocks());

describe("closed B06/B07 source-to-125mm partcells",()=>{
  it.each([["B06",12,33,208_000_000,"fa99c5df"],["B07",13,34,341_000_000,"13c8ba14"]] as const)("%s binds the unchanged native source/profile/part recipe",(id,parts,boxes,mass,digest)=>{
    const native=createFactoryInstallationProfile(id), before=canonicalJson(native);
    const cells=compileFactoryPartCells(ref(id));
    expect(cells.parts).toHaveLength(parts);
    expect(cells.sourceDigest).toBe(digest);
    expect(cells.sourceDigest).toBe(native.sourceDigest);
    expect(cells.profileDigest).toBe(native.profileDigest);
    expect(cells.source).toEqual(native.source);
    expect(cells.definitionRef).toEqual(native.definitionRef);
    expect(native.colliders).toHaveLength(boxes);
    expect(native.massMg).toBe(mass);
    expect(canonicalJson(createFactoryInstallationProfile(id))).toBe(before);
    expect(cells.cellMeters).toBe(.125);
    expect(cells.source.authoringGridM).toBe(.25);
    expect(cells.source.supportPatchesM).toEqual(native.source.supportPatchesM);
    expect(cells.source.ports).toEqual(native.source.ports);
    expect(cells.source.joints).toEqual(native.source.joints);
  });

  it.each(["B05","B08","B09","fp02.device.battery_4kwh"])("rejects general compilation of %s",id=>{
    expect(()=>compileFactoryPartCells(ref(id))).toThrow(/definition/i);
  });
  it.each([{version:2},{digest:"stale"},{sourceId:"b06"}])("rejects mismatched definition %j",drift=>{
    expect(()=>compileFactoryPartCells({...ref(),...drift})).toThrow(/definition/i);
  });

  it.each([
    ["source revision",(s:ReturnType<typeof sources.getFactoryAssetSource>)=>({...s,revision:2}),/source/i],
    ["frame",(s:ReturnType<typeof sources.getFactoryAssetSource>)=>({...s,frameId:"foreign"}),/frame|source/i],
    ["part set",(s:ReturnType<typeof sources.getFactoryAssetSource>)=>({...s,parts:s.parts.slice(1)}),/part|source/i],
    ["motion version",(s:ReturnType<typeof sources.getFactoryAssetSource>)=>({...s,phaseMotionProfile:{...s.phaseMotionProfile!,version:2}}),/source/i]
  ] as const)("rejects admitted-getter %s drift even after a cached compile",(_label,alter,error)=>{
    const original=sources.getFactoryAssetSource("B06");
    compileFactoryPartCells(ref());
    vi.spyOn(sources,"getFactoryAssetSource").mockReturnValue(alter(original) as typeof original);
    expect(()=>compileFactoryPartCells(ref())).toThrow(error);
  });

  it.each([
    ["off-grid edge",{centerM:[-.99,.125,-.75]},/grid/i],
    ["rotated source",{rotationZRadians:.1},/rotation/i],
    ["allocation ceiling",{sizeM:[8192,.25,.5]},/budget|bounds/i],
    ["unknown render role",{material:"steel-density"},/role|palette/i]
  ])("rejects %s before cell allocation",(_label,change,error)=>{
    const original=sources.getFactoryAssetSource("B06"), changed=structuredClone(original);
    const part=changed.parts[0]!;
    const invalid={...changed,parts:[{...part,boxes:[{...part.boxes[0]!,...change},...part.boxes.slice(1)]},...changed.parts.slice(1)]};
    vi.spyOn(sources,"getFactoryAssetSource").mockReturnValue(invalid);
    expect(()=>compileFactoryPartCells(ref())).toThrow(error as RegExp);
  });

  it.each(["B06","B07"])("%s preserves each part's exact native Cuboid union and last-box render priority",id=>{
    const native=createFactoryInstallationProfile(id), cells=compileFactoryPartCells(ref(id));
    const roles=["EX-STRUCT","EX-SHELL","EX-FUNCTION","EX-HAZARD"];
    let actual=0, naive=0;
    for(const part of cells.parts){
      const sourcePart=native.source.parts.find(p=>p.partId===part.partId)!;
      const nativeBoxes=native.colliders.filter(b=>b.partId===part.partId);
      const copy=part.copySlots();
      expect(copy).toHaveLength(part.sizeX*part.sizeY*part.sizeZ);
      expect(copy.length).toBeLessThanOrEqual(32768);
      let occupied=0;
      for(let z=0;z<part.sizeZ;z++)for(let y=0;y<part.sizeY;y++)for(let x=0;x<part.sizeX;x++){
        const center=[part.originMeters.x*1000+(x+.5)*125,part.originMeters.y*1000+(y+.5)*125,part.originMeters.z*1000+(z+.5)*125];
        let slot=0;
        nativeBoxes.forEach((box,index)=>{
          if(center.every((v,axis)=>v>box.centerMm[axis]!-box.sizeMm[axis]!/2&&v<box.centerMm[axis]!+box.sizeMm[axis]!/2))slot=roles.indexOf(sourcePart.boxes[index]!.material)+1;
        });
        expect(part.readSlot(x,y,z)).toBe(slot);
        expect(copy[(z*part.sizeY+y)*part.sizeX+x]).toBe(slot);
        if(slot)occupied++;
      }
      expect(part.occupiedCellCount).toBe(occupied);
      expect(part.cellDigest).toBe(canonicalSignature({version:"factory-partcells-v1",sourceDigest:cells.sourceDigest,partId:part.partId,originMeters:part.originMeters,size:[part.sizeX,part.sizeY,part.sizeZ],slots:Array.from(copy)}));
      actual+=occupied;
      naive+=nativeBoxes.reduce((n,b)=>n+b.sizeMm.reduce((v,s)=>v*s/125,1),0);
    }
    expect(actual).toBeGreaterThan(0);
    expect(actual).toBeLessThan(naive);
    expect(naive).toBe(id==="B06"?2512:7336);
    // Distinct mechanisms overlap in source coordinates; each retains its cells.
    const byWorld=new Map<string,Set<string>>();
    for(const part of cells.parts)for(let z=0;z<part.sizeZ;z++)for(let y=0;y<part.sizeY;y++)for(let x=0;x<part.sizeX;x++)if(part.readSlot(x,y,z)){
      const key=[part.originMeters.x/.125+x,part.originMeters.y/.125+y,part.originMeters.z/.125+z].join(",");
      const owners=byWorld.get(key)??new Set<string>();owners.add(part.partId);byWorld.set(key,owners);
    }
    expect([...byWorld.values()].some(owners=>owners.size>1)).toBe(true);
  });

  it("does not expose a cached slot buffer or caller ref alias",()=>{
    const mutable={...ref(),instanceId:"first"}, cells=compileFactoryPartCells(mutable);
    expect(cells.parts.length).toBeGreaterThan(0);
    const part=cells.parts[0]!, before=part.copySlots();
    part.copySlots().fill(7);mutable.digest="changed";
    expect(part.copySlots()).toEqual(before);
    expect(compileFactoryPartCells(ref())).toBe(cells);
    expect(cells.definitionRef).toEqual(ref());
    expect(Object.isFrozen(cells)).toBe(true);
    expect(Object.isFrozen(part)).toBe(true);
    expect(Object.isFrozen(part.originMeters)).toBe(true);
    expect(part.readSlot(-1,0,0)).toBe(0);
    expect(part.readSlot(part.sizeX,0,0)).toBe(0);
    expect(()=>part.readSlot(.5,0,0)).toThrow(/index/i);
  });

  it.each([["B06","cutter_frame","068f31d3"],["B07","former_frame","dd3f41e7"]])("%s retains all four authoring Slider parent bindings",(id,parent,digest)=>{
    const cells=compileFactoryPartCells(ref(id));
    expect(cells.authoringJointDigest).toBe(digest);
    expect(Object.keys(cells.semanticParents)).toHaveLength(4);
    expect(Object.values(cells.semanticParents)).toEqual([parent,parent,parent,parent]);
    expect(Object.keys(cells.semanticParents).sort()).toEqual(cells.source.joints.map(j=>j.partId).sort());
    expect(Object.isFrozen(cells.semanticParents)).toBe(true);
  });

  it.each(["B06","B07"])("%s projects through the actual existing occupancy mesher and accepted profiles",id=>{
    const cells=compileFactoryPartCells(ref(id)), a=createFactoryPartCellProjection({...ref(id),instanceId:"a"}), b=createFactoryPartCellProjection({...ref(id),instanceId:"b"});
    expect(cells.parts.length).toBeGreaterThan(0);
    expect(a.parts).toHaveLength(cells.parts.length);
    const accepted=sources.createFactoryAssetProjection(ref(id),cells.source).parts.flatMap(p=>p.materialProfiles);
    for(const part of a.parts){
      const mesh=meshHvpOccupancy({...part,slotAt:part.readSlot},undefined,part.cellDigest,"factory-partcells-v1");
      expect(part.artifact.positions).toEqual(mesh.positions);
      expect(part.artifact.normals).toEqual(mesh.normals);
      expect(part.artifact.indices).toEqual(mesh.indices);
      expect(part.artifact.bounds).toEqual(part.sourceLocalBounds);
      expect(validateMeshArtifact(part.artifact).valid).toBe(true);
      for(const profile of part.materialProfiles)expect(accepted).toContainEqual(profile);
      const other=b.parts.find(p=>p.partId===part.partId)!;
      expect(other.artifact.representationKey).not.toBe(part.artifact.representationKey);
      expect(other.artifact.contentHash).toBe(part.artifact.contentHash);
      part.artifact.positions.fill(99);
      expect(other.artifact.positions).toEqual(mesh.positions);
      expect(createFactoryPartCellProjection({...ref(id),instanceId:"fresh"}).parts.find(p=>p.partId===part.partId)!.artifact.positions).toEqual(mesh.positions);
    }
    expect(()=>createFactoryPartCellProjection(ref(id))).toThrow(/instance/i);
  });

  // Only imported source bytes are mocked: the compiler and geometry/mesher remain real.
  it.each(["source bytes","authoring parent","authoring part set","authoring version"])("rejects %s before accepting an authoring/cell binding",async drift=>{
    vi.resetModules();
    const sourcePath="../../../../../art/factory/fp02/cutter/source.scene.json?raw";
    const authoringPath="../../../../../art/factory/fp02/cutter/authoring-v1.json?raw";
    const altered=JSON.parse(cutterAuthoringRaw);
    if(drift==="authoring parent")altered.joints[0].parentPartId="cutter_feet";
    if(drift==="authoring part set")altered.parts[0].partId="foreign";
    if(drift==="authoring version")altered.schema="hestia.asset-authoring.v2";
    vi.doMock(sourcePath,()=>({default:drift==="source bytes"?cutterSourceRaw+" ":cutterSourceRaw}));
    vi.doMock(authoringPath,()=>({default:drift==="source bytes"?cutterAuthoringRaw:JSON.stringify(altered)}));
    try{
      const fresh=await import("../../../src/factory/presentation/factoryPartCells");
      expect(()=>fresh.compileFactoryPartCells(ref())).toThrow(/source|authoring/i);
    }finally{
      vi.doUnmock(sourcePath);vi.doUnmock(authoringPath);vi.resetModules();
    }
  });
});
