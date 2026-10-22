import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../../public/factory/play-2026-10-12/manifest.json";
import { loadFactoryHullProjection, loadPlayAssetProjection, readFactoryHullMetadata, readLoadedHullMetadataBytes, type PlayExpectedBinding } from "../../../src/factory/presentation/playAssetLoader";
import { createFactoryPlayBatch, estimateFactoryPlayBatch, type FactoryPlayBatchInstance } from "../../../src/factory/presentation/batchPlayParts";
import { createFactoryAssetProjection, getFactoryAssetSource, readFactoryAssetDefinition } from "../../../src/factory/presentation/factoryAssets";
import { representationKey, validateMeshArtifact } from "../../../src/presentation";

const repo=fileURLToPath(new URL("../../../../../",import.meta.url));
const surfaceAssets=JSON.parse(readFileSync(`${repo}art/factory/play-surface-v2-2026-10-12/manifest.json`,"utf8")).assets as typeof manifest.assets;
const cargoSurfaceAssets=JSON.parse(readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest-cargo-surface-v2.json`,"utf8")).assets as typeof manifest.assets;
const distributorSurfaceAssets=JSON.parse(readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest-distribution-surface-v2.json`,"utf8")).assets as typeof manifest.assets;
const storageSurfaceAssets=JSON.parse(readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest-storage-surface-v2.json`,"utf8")).assets as typeof manifest.assets;
const hullPins=JSON.parse(readFileSync(`${repo}art/factory/crashsite-walkable-v1-2026-10-19/RUNTIME_NATIVE_BYTE_PINS.json`,"utf8")) as {
  glbSha256:string;anchorMeters:number[];collisionDigest:string;totalBytes:number;
  parts:{partId:string;vertexBytes:number;indexBytes:number;verticesSha256:string;indicesSha256:string}[];
};
const hullPayload=()=>new Uint8Array(readFileSync(`${repo}apps/weltraum-browser/public/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb`));
const hullSidecarPath=`${repo}apps/weltraum-browser/public/factory/crashsite-walkable-v1-2026-10-19/manifest.json`;
const assets=manifest.assets;
const entry=(id="play_cutter_v1")=>assets.find(a=>a.assetId===id)!;
const bytes=(a=entry())=>new Uint8Array(readFileSync(`${repo}${a.runtimeGlb.path}`));
const binding=(a=entry()):PlayExpectedBinding=>a.definitionRef?{definitionRef:a.definitionRef}:{visualOnlyAnchor:a.visualOnlyAnchor!};
const request=(a=entry(),payload=bytes(a))=>({assetId:a.assetId,instanceId:"installed_a",expectedBinding:binding(a),
  fetch:async()=>new Response(new Uint8Array(payload))});
const deferred=<T>()=>{
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(done=>{resolve=done;});
  return {promise,resolve};
};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

interface Doc {
  nodes:{name:string;mesh:number;extras:{hestia:{partId:string};playBinding:{partId:string}};scale?:number[];translation?:number[];children?:number[]}[];
  meshes:{primitives:{attributes:{POSITION:number;NORMAL:number;COLOR_0?:number};indices:number;material:number}[]}[];
  accessors:{bufferView:number;byteOffset?:number;componentType:number;count:number;type:string}[];
  bufferViews:{byteOffset?:number;byteLength:number;byteStride?:number}[];
  materials:{name:string;pbrMetallicRoughness:{baseColorFactor:number[]}}[];
  buffers:{byteLength:number;uri?:string}[];images?:unknown[];skins?:unknown[];animations?:unknown[];extensionsUsed?:string[];
  scenes:{nodes:number[]}[];
}
const unpack=(payload:Uint8Array)=>{
  const view=new DataView(payload.buffer,payload.byteOffset,payload.byteLength),length=view.getUint32(12,true);
  const doc=JSON.parse(new TextDecoder().decode(payload.subarray(20,20+length))) as Doc;
  return {doc,bin:payload.subarray(28+length)};
};
const repack=(doc:Doc,bin:Uint8Array)=>{
  const json=new TextEncoder().encode(JSON.stringify(doc)),pad=(4-json.length%4)%4;
  const result=new Uint8Array(28+json.length+pad+bin.length),view=new DataView(result.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,result.length,true);
  view.setUint32(12,json.length+pad,true);view.setUint32(16,0x4e4f534a,true);result.fill(32,20,20+json.length+pad);result.set(json,20);
  view.setUint32(20+json.length+pad,bin.length,true);view.setUint32(24+json.length+pad,0x004e4942,true);result.set(bin,28+json.length+pad);return result;
};
const hullRequest=(payload=hullPayload())=>({instanceId:"hull_instance",fetch:async(url:Parameters<typeof globalThis.fetch>[0])=>{
  expect(String(url)).toBe("/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.glb");
  return new Response(new Uint8Array(payload));
}});
const editHull=(change:(doc:Doc)=>void)=>{
  const payload=hullPayload(),{doc,bin}=unpack(payload);change(doc);
  return repack(doc,bin);
};
const bypassHullGlbHash=()=>{
  const native=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
  const expected=Uint8Array.from(Buffer.from(hullPins.glbSha256,"hex")).buffer;
  vi.spyOn(globalThis.crypto.subtle,"digest").mockImplementation((algorithm,data)=>{
    const b=data instanceof ArrayBuffer?new Uint8Array(data):new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    return b[0]===0x67&&b[1]===0x6c?Promise.resolve(expected):native(algorithm,data);
  });
};
// The real SHA gate normally rejects every edited GLB before semantic parsing.
// To independently test parser guards, this narrowly labeled scaffold returns
// the reviewed manifest's SHA only for an edited same-length GLB in these tests.
const bypassEditedGlbHash=()=>{
  const native=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
  const expected=Uint8Array.from(Buffer.from(entry().runtimeGlb.sha256,"hex")).buffer;
  vi.spyOn(globalThis.crypto.subtle,"digest").mockImplementation((algorithm,data)=>{
    const b=data instanceof ArrayBuffer?new Uint8Array(data):new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    return b[0]===0x67&&b[1]===0x6c?Promise.resolve(expected):native(algorithm,data);
  });
};
const edited=(change:(doc:Doc)=>void)=>{
  const payload=bytes(),{doc,bin}=unpack(payload);change(doc);
  // Shorten ignored exporter-generator prose to retain exact reviewed size.
  // No binding, geometry, transform, palette or supported-feature field changes.
  (doc as unknown as {asset:{generator:string}}).asset.generator="x";
  const rebuilt=repack(doc,bin);
  // Keep the admitted byte size for independent parser admission. A shortened
  // JSON chunk is padded to its original size, preserving BIN offsets/content.
  const originalJSONLength=new DataView(payload.buffer).getUint32(12,true);
  const newJSONLength=new DataView(rebuilt.buffer).getUint32(12,true);
  if(newJSONLength>originalJSONLength)throw Error("test mutation exceeds reviewed JSON padding");
  const padded=new Uint8Array(payload);padded.fill(32,20,20+originalJSONLength);padded.set(rebuilt.subarray(20,20+newJSONLength),20);
  return padded;
};

describe("reviewed closed Play GLB loader",()=>{
  it.each([...assets,...surfaceAssets,...cargoSurfaceAssets,...distributorSurfaceAssets,...storageSurfaceAssets])("imports actual $assetId bytes into managed source-local artifacts",async a=>{
    const actual=bytes(a),result=await loadPlayAssetProjection(request(a,actual)),colored=await loadPlayAssetProjection({...request(a,actual),renderMode:"vertex-colors"});
    expect(result.parts.map(p=>p.partId).sort()).toEqual([...a.partIds].sort());
    expect(colored.parts.map(p=>p.partId).sort()).toEqual([...a.partIds].sort());
    expect(result.assetId).toBe(a.assetId);
    expect(result.parts.length).toBeGreaterThan(0);
    expect(result.glbSha256).toBe(createHash("sha256").update(actual).digest("hex"));
    expect(result.sourceFileSha256).toBe(a.sourceFile.sha256);
    expect(result.definitionRef).toEqual(a.definitionRef);
    expect(result.visualOnlyAnchor).toEqual(a.visualOnlyAnchor);
    expect(result.frameId).toBe("fp02_east_north_height_xyz_v1");
    const {doc,bin}=unpack(actual),binary=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
    for(const part of result.parts){
      const coloredPart=colored.parts.find(candidate=>candidate.partId===part.partId)!;
      const primitives=doc.meshes[doc.nodes.find(n=>n.name===part.partId)!.mesh]!.primitives;
      const expected:number[]=[],indices:number[]=[],expectedColors:number[]=[];let vertices=0,indexOffset=0;
      for(const primitive of primitives){
        const p=doc.accessors[primitive.attributes.POSITION]!,i=doc.accessors[primitive.indices]!;
        const pb=doc.bufferViews[p.bufferView]!,ib=doc.bufferViews[i.bufferView]!;
        for(let v=0;v<p.count;v++)for(let axis=0;axis<3;axis++)expected.push(binary.getFloat32((pb.byteOffset??0)+(p.byteOffset??0)+v*(pb.byteStride??12)+axis*4,true));
        for(let v=0;v<i.count;v++)indices.push(vertices+binary.getUint16((ib.byteOffset??0)+(i.byteOffset??0)+v*2,true));
        const range=part.artifact.materialRanges.find(value=>value.startIndex===indexOffset)!;
        const profile=part.materialProfiles.find(value=>value.id===range.materialProfileId)!;
        for(let v=0;v<p.count;v++)expectedColors.push(profile.baseColor.r,profile.baseColor.g,profile.baseColor.b);
        vertices+=p.count;
        indexOffset+=i.count;
      }
      expect(Array.from(part.artifact.positions)).toEqual(expected);
      expect(Array.from(part.artifact.indices)).toEqual(indices);
      expect(part.artifact.attributes?.color).toBeUndefined();
      expect(coloredPart.role).toBe(part.role);
      expect(coloredPart.artifact.algorithmVersion).toBe("factory-play-glb-vertex-colors-v1");
      expect(coloredPart.artifact.positions).toEqual(part.artifact.positions);
      expect(coloredPart.artifact.normals).toEqual(part.artifact.normals);
      expect(coloredPart.artifact.indices).toEqual(part.artifact.indices);
      expect(coloredPart.artifact.bounds).toEqual(part.artifact.bounds);
      expect(Array.from(coloredPart.artifact.attributes!.color!)).toEqual(expectedColors.map(Math.fround));
      expect(coloredPart.materialProfiles.map(value=>value.id)).toEqual(["fp06_vertex_color"]);
      expect(coloredPart.materialProfiles[0]!.baseColor).toEqual({r:1,g:1,b:1});
      expect(coloredPart.artifact.materialRanges).toEqual([{materialProfileId:"fp06_vertex_color",startIndex:0,indexCount:indices.length}]);
      expect(coloredPart.artifact.attributes!.color!.buffer).not.toBe(coloredPart.artifact.positions.buffer);
      expect(validateMeshArtifact(part.artifact).valid).toBe(true);
      expect(validateMeshArtifact(coloredPart.artifact).valid).toBe(true);
      expect(part.artifact.representationKey).toContain("installed_a");
      expect(part.materialProfiles.length).toBeGreaterThan(0);
      expect(Object.isFrozen(part)).toBe(true);
    }
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(colored)).toBe(true);
    if("visualVariant" in a)expect(result.visualVariant).toEqual(a.visualVariant);
  });

  it("uses exactly the existing accepted five-role linear MaterialProfiles",async()=>{
    const accepted=new Map(["B06","fp02.device.pv_pack_2kwp"].flatMap(id=>
      createFactoryAssetProjection(readFactoryAssetDefinition(id)!,getFactoryAssetSource(id)).parts.flatMap(p=>p.materialProfiles.map(profile=>[profile.id,profile] as const))));
    for(const id of ["play_belt_v1","play_pv_v1"]){
      const result=await loadPlayAssetProjection(request(entry(id)));
      expect(result.parts.length).toBeGreaterThan(0);
      for(const profile of result.parts.flatMap(p=>p.materialProfiles))expect(profile).toEqual(accepted.get(profile.id));
    }
  });

  it("batches the seven admitted cable and stock templates as one transformed draw",async()=>{
    const ids=["play_cable_end_v1","play_cable_link_v1","play_steel_v1","play_semi_v1","play_profile_v1","play_sheet_v1","play_offcut_v1"] as const;
    const instances:FactoryPlayBatchInstance[]=await Promise.all(ids.map(async(id,index)=>{
      const asset=entry(id),projection=await loadPlayAssetProjection({...request(asset),instanceId:`batch_${index}`,renderMode:"vertex-colors"});
      return {projection,transform:{
        representationKey:representationKey(`batch_instance_${index}`),
        positionRelative:{x:index===0?3:index*2,y:index===0?4:0,z:index===0?5:0},
        orientation:index===0?{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}:{x:0,y:0,z:0,w:1},
        scale:index===0?{x:2,y:1.5,z:.5}:{x:1,y:1,z:1}
      }};
    }));
    const estimate=estimateFactoryPlayBatch(instances),batch=createFactoryPlayBatch(representationKey("factory_play_batch_test"),instances),artifact=batch.artifact!;
    const sourceParts=instances.map(instance=>instance.projection.parts[0]!);
    const sourceVertices=sourceParts.reduce((sum,part)=>sum+part.artifact.positions.length/3,0);
    const sourceIndices=sourceParts.reduce((sum,part)=>sum+part.artifact.indices.length,0);
    expect(sourceParts).toHaveLength(7);
    expect(artifact.indices).toBeInstanceOf(Uint16Array);
    expect(artifact.positions.length/3).toBe(sourceVertices);
    expect(artifact.indices.length).toBe(sourceIndices);
    expect(artifact.materialRanges).toEqual([{materialProfileId:"fp06_vertex_color",startIndex:0,indexCount:sourceIndices}]);
    expect(batch.materialProfiles.map(profile=>profile.id)).toEqual(["fp06_vertex_color"]);
    expect(batch.costs.drawCalls).toBe(1);
    expect(batch.costs.indices).toBe(sourceIndices);
    const geometryBytes=artifact.positions.byteLength+artifact.normals.byteLength+artifact.indices.byteLength+artifact.attributes!.color!.byteLength;
    expect(batch.costs.geometryBytes).toBe(geometryBytes);
    expect(batch.costs.cpuBytes).toBe(geometryBytes*3);
    expect(batch.costs.meshBytes).toBe(geometryBytes*2);
    expect(estimate).toMatchObject(batch.costs);
    expect(validateMeshArtifact(artifact).valid).toBe(true);

    const first=sourceParts[0]!,sourcePosition=first.artifact.positions,sourceNormal=first.artifact.normals;
    // Independent 90-degree Y-rotation, nonuniform position scale, and inverse-transpose normal check.
    expect(artifact.positions[0]).toBeCloseTo(sourcePosition[2]!*.5+3,5);
    expect(artifact.positions[1]).toBeCloseTo(sourcePosition[1]!*1.5+4,5);
    expect(artifact.positions[2]).toBeCloseTo(-sourcePosition[0]!*2+5,5);
    const normalLength=Math.hypot(sourceNormal[0]!,sourceNormal[1]!,sourceNormal[2]!);
    expect(normalLength).toBeGreaterThan(0);
    expect(artifact.normals[0]).toBeCloseTo(sourceNormal[2]!/normalLength,5);
    expect(artifact.normals[1]).toBeCloseTo(sourceNormal[1]!/normalLength,5);
    expect(artifact.normals[2]).toBeCloseTo(-sourceNormal[0]!/normalLength,5);
    expect(artifact.attributes!.color!.slice(0,3)).toEqual(first.artifact.attributes!.color!.slice(0,3));
  });

  it("preflights empty and Uint32 batches without exceeding the closed part bound",async()=>{
    const key=representationKey("factory_play_batch_empty_test");
    expect(estimateFactoryPlayBatch([])).toMatchObject({vertices:0,indices:0,indexBytes:0,geometryBytes:0,cpuBytes:0,meshBytes:0,triangles:0,drawCalls:0});
    expect(createFactoryPlayBatch(key,[])).toMatchObject({artifact:null,materialProfiles:[],costs:{vertices:0,indices:0,drawCalls:0}});

    const asset=entry("play_offcut_v1"),projection=await loadPlayAssetProjection({...request(asset),instanceId:"batch_uint32",renderMode:"vertex-colors"});
    const source=projection.parts[0]!.artifact,verticesPerPart=source.positions.length/3;
    const copies=Math.floor(0xffff/verticesPerPart)+1;
    expect(copies).toBeLessThanOrEqual(640);
    const instances:FactoryPlayBatchInstance[]=Array.from({length:copies},(_,index)=>({projection,transform:{
      representationKey:representationKey(`batch_uint32_${index}`),positionRelative:{x:index,y:0,z:0},
      orientation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1}
    }}));
    const estimate=estimateFactoryPlayBatch(instances);
    expect(estimate.vertices).toBeGreaterThan(0xffff);
    expect(estimate.indexBytes).toBe(4);
    const batch=createFactoryPlayBatch(representationKey("factory_play_batch_uint32_test"),instances),artifact=batch.artifact!;
    expect(artifact.indices).toBeInstanceOf(Uint32Array);
    expect(artifact.indices.length).toBe(source.indices.length*copies);
    expect(artifact.indices[source.indices.length]!).toBe(verticesPerPart+source.indices[0]!);
    expect(artifact.indices[artifact.indices.length-1]!).toBeLessThan(estimate.vertices);
    expect(batch.costs.geometryBytes).toBe(estimate.geometryBytes);
    const overLimit:FactoryPlayBatchInstance[]=Array.from({length:641},(_,index)=>({projection,transform:{
      representationKey:representationKey(`batch_limit_${index}`),positionRelative:{x:index,y:0,z:0},
      orientation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1}
    }}));
    expect(()=>estimateFactoryPlayBatch(overLimit)).toThrow(/640/);
  });

  it.each([
    ["unknown asset",{assetId:"arbitrary_glb"}],
    ["empty instance",{instanceId:""}],
    ["stale definition",{expectedBinding:{definitionRef:{...entry().definitionRef!,digest:"stale"}}}],
    ["wrong anchor",{expectedBinding:{visualOnlyAnchor:{kind:"visual-only-cargo"}}}]
  ])("rejects %s before any fetch",async(_label,drift)=>{
    let fetched=0;
    await expect(loadPlayAssetProjection({...request(),...drift,fetch:async()=>{fetched++;return new Response(bytes());}})).rejects.toThrow(/asset|instance|binding/i);
    expect(fetched).toBe(0);
  });
  it("rejects an unknown opt-in mode before fetching",async()=>{
    let fetched=0;
    await expect(loadPlayAssetProjection({...request(),renderMode:"unknown" as never,fetch:async()=>{fetched++;return new Response(bytes());}})).rejects.toThrow(/render mode/i);
    expect(fetched).toBe(0);
  });
  it.each(["corrupt","short","oversize"])("rejects %s actual payload without fallback",async kind=>{
    const raw=bytes(),payload=kind==="short"?raw.slice(0,-1):kind==="oversize"?new Uint8Array(raw.length+1):raw;
    if(kind==="corrupt")payload[payload.length-1]^=1;
    await expect(loadPlayAssetProjection(request(entry(),payload))).rejects.toThrow(/hash|size|bytes/i);
  });
  it("reports a missing GLB response",async()=>{
    let cancelled=false;
    const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode("absent"));},cancel(){cancelled=true;}});
    await expect(loadPlayAssetProjection({...request(),fetch:async()=>new Response(body,{status:404})})).rejects.toThrow(/response|fetch|404/i);
    expect(cancelled).toBe(true);
  });
  it.each([
    ["missing native root",(d:Doc)=>{d.nodes[0]!.name="bad";d.nodes[0]!.extras.playBinding.partId="bad";d.nodes[0]!.extras.hestia.partId="bad";}],
    ["nonneutral root",(d:Doc)=>{d.nodes[0]!.scale=[2,1,1];}],
    ["wrong palette",(d:Doc)=>{d.materials[0]!.name="bad";}],
    ["incoming COLOR_0",(d:Doc)=>{d.meshes[0]!.primitives[0]!.attributes.COLOR_0=d.meshes[0]!.primitives[0]!.attributes.POSITION;}],
    ["unsupported accessor",(d:Doc)=>{d.accessors[0]!.componentType=5125;}],
    ["external buffer",(d:Doc)=>{d.buffers[0]!.uri="x";}],
    ["animation",(d:Doc)=>{d.animations=[];}],
    ["unsupported extension",(d:Doc)=>{d.extensionsUsed=["x"];}]
  ])("independently rejects %s after the explicitly stubbed integrity gate",async(_label,change)=>{
    bypassEditedGlbHash();
    await expect(loadPlayAssetProjection(request(entry(),edited(change as (d:Doc)=>void)))).rejects.toThrow(/part|transform|palette|accessor|unsupported|external/i);
  });
  it("keeps incoming COLOR_0 rejected even when derived vertex colors are opted in",async()=>{
    bypassEditedGlbHash();
    const payload=edited(d=>{d.meshes[0]!.primitives[0]!.attributes.COLOR_0=d.meshes[0]!.primitives[0]!.attributes.POSITION;});
    await expect(loadPlayAssetProjection({...request(entry(),payload),renderMode:"vertex-colors"})).rejects.toThrow(/unsupported primitive/i);
  });
  it.each(["POSITION","NORMAL","index"])("independently rejects nonfinite/out-of-range %s bytes with the integrity gate stubbed",async kind=>{
    bypassEditedGlbHash();const payload=bytes(),{doc,bin}=unpack(payload),primitive=doc.meshes[0]!.primitives[0]!;
    const accessor=doc.accessors[kind==="index"?primitive.indices:primitive.attributes[kind as "POSITION"|"NORMAL"]]!;
    const offset=doc.bufferViews[accessor.bufferView]!.byteOffset??0,view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
    if(kind==="index")view.setUint16(offset,65535,true);else view.setFloat32(offset,NaN,true);
    await expect(loadPlayAssetProjection(request(entry(),payload))).rejects.toThrow(/finite|index|attribute/i);
  });
  it.each(["manifest.json","manifest-surface-v2.json","manifest-cargo-surface-v2.json","manifest-distribution-surface-v2.json","manifest-storage-surface-v2.json"])("rejects changed %s bytes before fetching",async file=>{
    const path=`../../../public/factory/play-2026-10-12/${file}?raw`;
    const raw=readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/${file}`,"utf8");
    vi.resetModules();vi.doMock(path,()=>({default:raw+" "}));
    try{
      const fresh=await import("../../../src/factory/presentation/playAssetLoader");let fetched=0;
      await expect(fresh.loadPlayAssetProjection({...request(),fetch:async()=>{fetched++;return new Response(bytes());}})).rejects.toThrow(/manifest/i);
      expect(fetched).toBe(0);
    }finally{vi.doUnmock(path);vi.resetModules();}
  });
  it("rejects an already aborted call without fetching",async()=>{
    const abort=new AbortController();abort.abort();let fetched=0;
    await expect(loadPlayAssetProjection({...request(),signal:abort.signal,fetch:async()=>{fetched++;return new Response(bytes());}})).rejects.toMatchObject({name:"AbortError"});
    expect(fetched).toBe(0);
  });
  it("cancels an in-flight response and never publishes partial artifacts",async()=>{
    const abort=new AbortController();let cancelled=false;
    await expect(loadPlayAssetProjection({...request(),signal:abort.signal,fetch:async()=>new Response(new ReadableStream<Uint8Array>({
      start(controller){controller.enqueue(bytes().slice(0,10));queueMicrotask(()=>abort.abort());},cancel(){cancelled=true;}
    }))})).rejects.toMatchObject({name:"AbortError"});
    expect(cancelled).toBe(true);
  });
  it("isolates caller bytes and independently mutable instance snapshots",async()=>{
    const payload=bytes(),a=await loadPlayAssetProjection(request(entry(),payload)),b=await loadPlayAssetProjection({...request(),instanceId:"installed_b"});
    expect(a.parts.length).toBeGreaterThan(0);
    const before=b.parts[0]!.artifact.positions.slice();payload.fill(0);a.parts[0]!.artifact.positions.fill(99);
    expect(b.parts[0]!.artifact.positions).toEqual(before);
    expect(b.parts[0]!.artifact.representationKey).not.toBe(a.parts[0]!.artifact.representationKey);
    expect((await loadPlayAssetProjection(request())).parts[0]!.artifact.positions).toEqual(before);
  });
  it("captures asset identity and deep caller binding before the manifest await",async()=>{
    const original=entry(),replacement=entry("play_former_v1");
    const input={...request(original),expectedBinding:{definitionRef:{...original.definitionRef!}},
      fetch:async(url:Parameters<typeof globalThis.fetch>[0])=>new Response(bytes(assets.find(a=>a.runtimeGlb.url===String(url))!))};
    const loading=loadPlayAssetProjection(input);
    input.assetId=replacement.assetId;
    Object.assign(input.expectedBinding.definitionRef,replacement.definitionRef);
    const result=await loading;
    expect(result.assetId).toBe(original.assetId);
    expect(result.definitionRef).toEqual(original.definitionRef);
  });
  it("keeps the invocation's instance key while the original fetch is pending",async()=>{
    const started=deferred<void>(),response=deferred<Response>();
    const input={...request(),fetch:async()=>{started.resolve();return response.promise;}};
    const loading=loadPlayAssetProjection(input);await started.promise;
    input.instanceId="retargeted_instance";response.resolve(new Response(bytes()));
    const result=await loading;
    expect(result.parts.length).toBeGreaterThan(0);
    expect(result.parts.every(p=>p.artifact.representationKey===`factory-play:installed_a:${entry().assetId}:${p.partId}`)).toBe(true);
  });
  it("keeps the original AbortSignal after the mutable caller replaces its signal",async()=>{
    const original=new AbortController(),replacement=new AbortController(),started=deferred<void>(),response=deferred<Response>();
    const input={...request(),signal:original.signal,fetch:async()=>{started.resolve();return response.promise;}};
    const loading=loadPlayAssetProjection(input);await started.promise;
    input.signal=replacement.signal;original.abort();response.resolve(new Response(bytes()));
    await expect(loading).rejects.toMatchObject({name:"AbortError"});
    expect(replacement.signal.aborted).toBe(false);
  });
  it("uses the fetch function captured when the load was invoked",async()=>{
    const input=request(),loading=loadPlayAssetProjection(input);
    input.fetch=async()=>new Response("replacement",{status:404});
    await expect(loading).resolves.toMatchObject({assetId:entry().assetId});
  });
  it("loads the pinned Hull into matching render triangles and independent Native sectors",async()=>{
    expect(readLoadedHullMetadataBytes()).toBe(0);
    const metadata=readFactoryHullMetadata();
    expect(readLoadedHullMetadataBytes()).toBe(42_578);
    await metadata;
    expect(readLoadedHullMetadataBytes()).toBe(42_578);
    const result=await loadFactoryHullProjection(hullRequest());
    expect(result.assetId).toBe("hestia_crashsite_walkable_v1");
    expect(result.glbSha256).toBe(hullPins.glbSha256);
    expect(result.frameId).toBe("fp02_east_north_height_xyz_v1");
    expect(result.anchorMeters).toEqual(hullPins.anchorMeters);
    expect(result.collisionDigest).toBe(hullPins.collisionDigest);
    expect(result.parts.map(part=>part.partId)).toEqual(hullPins.parts.map(part=>part.partId));
    expect(result.nativeSectors).toHaveLength(8);
    const renderSnapshots=result.parts.map(part=>({
      positions:part.artifact.positions.slice(),normals:part.artifact.normals.slice(),indices:part.artifact.indices.slice(),
      colors:part.artifact.attributes?.color?.slice()
    }));
    let nativeBytes=0;
    for(let i=0;i<result.parts.length;i++){
      const part=result.parts[i]!,sector=result.nativeSectors[i]!,pin=hullPins.parts[i]!;
      expect(part.role).toBe(pin.partId);
      expect(part.artifact.algorithmVersion).toBe("factory-play-glb-vertex-colors-v1");
      expect(part.artifact.positions.buffer).not.toBe(sector.vertices.buffer);
      expect(part.artifact.indices.buffer).not.toBe(sector.indices.buffer);
      const anchored=new Float32Array(part.artifact.positions.length);
      for(let v=0;v<anchored.length;v++)anchored[v]=Math.fround(part.artifact.positions[v]!+hullPins.anchorMeters[v%3]!);
      expect(sector.vertices).toEqual(anchored);
      const widenedIndices=new Uint32Array(part.artifact.indices.length);widenedIndices.set(part.artifact.indices);
      expect(sector.indices).toEqual(widenedIndices);
      const vertexHash=createHash("sha256").update(new Uint8Array(sector.vertices.buffer,sector.vertices.byteOffset,sector.vertices.byteLength)).digest("hex");
      const indexHash=createHash("sha256").update(new Uint8Array(sector.indices.buffer,sector.indices.byteOffset,sector.indices.byteLength)).digest("hex");
      expect(`sha256:${vertexHash}`).toBe(pin.verticesSha256);
      expect(`sha256:${indexHash}`).toBe(pin.indicesSha256);
      expect(sector.vertices.byteLength).toBe(pin.vertexBytes);
      expect(sector.indices.byteLength).toBe(pin.indexBytes);
      nativeBytes+=sector.vertices.byteLength+sector.indices.byteLength;
    }
    expect(nativeBytes).toBe(hullPins.totalBytes);
    expect(result.costs).toMatchObject({
      sourceBytes:1_073_548,sourceSha256CopyBytes:1_073_548,jsonUtf16Bytes:41_208,jsonGraphBytes:70_144,
      renderScratchBytes:1_523_808,renderArtifactBytes:1_523_808,stagedRenderArtifactBytes:1_523_808,nativeSectorBytes:703_296,nativeHashCopyPeakBytes:219_792,
      sidecarUtf8Bytes:6_775,sidecarHashCopyBytes:6_775,sidecarRawUtf16Bytes:13_550,
      sidecarParsedUtf16Bytes:9_366,sidecarParsedGraphBytes:6_112
    });
    const transfers=result.nativeSectors.flatMap(sector=>[sector.vertices.buffer as ArrayBuffer,sector.indices.buffer as ArrayBuffer]);
    structuredClone(result.nativeSectors,{transfer:transfers});
    expect(transfers.every(buffer=>buffer.byteLength===0)).toBe(true);
    for(let i=0;i<result.parts.length;i++){
      expect(result.parts[i]!.artifact.positions).toEqual(renderSnapshots[i]!.positions);
      expect(result.parts[i]!.artifact.normals).toEqual(renderSnapshots[i]!.normals);
      expect(result.parts[i]!.artifact.indices).toEqual(renderSnapshots[i]!.indices);
      if(renderSnapshots[i]!.colors)expect(result.parts[i]!.artifact.attributes?.color).toEqual(renderSnapshots[i]!.colors);
    }
  });
  it("keeps the Hull admission separate, verifies named source pins and pins its sidecar before fetch",async()=>{
    const source=JSON.parse(readFileSync(hullSidecarPath,"utf8")).source as Record<string,string>;
    const sourceFiles=[
      ["sourceGlb","sourceGlbSha256","art/factory/crashsite-hybrid-v2/crashsite-hybrid-v2.glb"],
      ["authoringBlend","authoringBlendSha256","art/factory/crashsite-walkable-v1-2026-10-19/crashsite-walkable-v1.blend"],
      ["builder","builderSha256","art/factory/crashsite-walkable-v1-2026-10-19/build_crashsite.py"],
      ["provenance","provenanceSha256","art/factory/crashsite-walkable-v1-2026-10-19/PROVENANCE.json"],
      ["licenseFile","licenseFileSha256","art/factory/crashsite-walkable-v1-2026-10-19/LICENSE"],
      ["runtimeCensus","runtimeCensusSha256","art/factory/crashsite-walkable-v1-2026-10-19/RUNTIME_CENSUS.json"],
      ["walkabilityValidation","walkabilityValidationSha256","art/factory/crashsite-walkable-v1-2026-10-19/WALKABILITY_VALIDATION.json"],
      ["modelSpec","modelSpecSha256","art/factory/crashsite-walkable-v1-2026-10-19/MODEL_SPEC.json"]
    ] as const;
    for(const [pathField,hashField,path] of sourceFiles){
      expect(source[pathField]).toBe(path);
      expect(createHash("sha256").update(readFileSync(`${repo}${path}`)).digest("hex")).toBe(source[hashField]);
    }
    const spec=JSON.parse(readFileSync(`${repo}${source.modelSpec}`,"utf8")) as {reference:string;referenceSha256:string};
    expect(spec.reference).toBe("art/factory/visual-reference/2026-10-13/crashsite/03-hybrid-revision.png");
    expect(spec.referenceSha256).toBe(source.referenceSha256);
    expect(createHash("sha256").update(readFileSync(`${repo}${spec.reference}`)).digest("hex")).toBe(source.referenceSha256);

    let ordinaryFetches=0;
    await expect(loadPlayAssetProjection({...request(),assetId:"hestia_crashsite_walkable_v1",fetch:async()=>{
      ordinaryFetches++;return new Response(hullPayload());
    }})).rejects.toThrow(/asset ID mismatch/i);
    expect(ordinaryFetches).toBe(0);

    const original=readFileSync(hullSidecarPath,"utf8");
    const rawModule="../../../public/factory/crashsite-walkable-v1-2026-10-19/manifest.json?raw";
    vi.resetModules();vi.doMock(rawModule,()=>({default:original+" "}));
    try{
      const fresh=await import("../../../src/factory/presentation/playAssetLoader");let hullFetches=0;
      expect(fresh.readLoadedHullMetadataBytes()).toBe(0);
      const metadata=fresh.readFactoryHullMetadata();
      expect(fresh.readLoadedHullMetadataBytes()).toBe(42_578);
      await expect(metadata).rejects.toThrow(/Hull metadata bytes\/hash mismatch/);
      expect(fresh.readLoadedHullMetadataBytes()).toBe(42_578);
      await expect(fresh.loadFactoryHullProjection({instanceId:"hull_instance",fetch:async()=>{
        hullFetches++;return new Response(hullPayload());
      }})).rejects.toThrow(/Hull metadata bytes\/hash mismatch/);
      expect(hullFetches).toBe(0);
    }finally{vi.doUnmock(rawModule);vi.resetModules();}
  });
  it("rejects modified Hull payload bytes before creating a projection",async()=>{
    const payload=hullPayload();payload[payload.length-1]^=1;
    await expect(loadFactoryHullProjection(hullRequest(payload))).rejects.toThrow(/GLB hash mismatch/);
  });
  it.each([
    ["node gameplay metadata",(doc:Doc)=>{(doc.nodes[0] as unknown as {extras:Record<string,unknown>}).extras.worldAuthority=true;},/Hull node metadata mismatch/],
    ["palette factor",(doc:Doc)=>{(doc.materials[0]!.pbrMetallicRoughness.baseColorFactor as unknown as number[])[0]=0.3049873113632203;},/Hull palette census mismatch/],
    ["part index census",(doc:Doc)=>{const primitive=doc.meshes[0]!.primitives[0]!,a=doc.accessors[primitive.indices]!;
      (a as unknown as {count:number}).count-=3;},/Hull part census mismatch/]
  ])("fails closed on changed Hull %s after the real payload integrity gate is isolated",async(_label,change,reason)=>{
    bypassHullGlbHash();
    await expect(loadFactoryHullProjection(hullRequest(editHull(change as (doc:Doc)=>void)))).rejects.toThrow(reason as RegExp);
  });
});
