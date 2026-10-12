import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import manifest from "../../../public/factory/play-2026-10-12/manifest.json";
import { loadPlayAssetProjection, type PlayExpectedBinding } from "../../../src/factory/presentation/playAssetLoader";
import { createFactoryAssetProjection, getFactoryAssetSource, readFactoryAssetDefinition } from "../../../src/factory/presentation/factoryAssets";
import { validateMeshArtifact } from "../../../src/presentation";

const repo=fileURLToPath(new URL("../../../../../",import.meta.url));
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
  meshes:{primitives:{attributes:{POSITION:number;NORMAL:number};indices:number;material:number}[]}[];
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
  it.each(assets)("imports actual $assetId bytes into managed source-local artifacts",async a=>{
    const actual=bytes(a),result=await loadPlayAssetProjection(request(a,actual));
    expect(result.parts.map(p=>p.partId).sort()).toEqual([...a.partIds].sort());
    expect(result.parts.length).toBeGreaterThan(0);
    expect(result.glbSha256).toBe(createHash("sha256").update(actual).digest("hex"));
    expect(result.sourceFileSha256).toBe(a.sourceFile.sha256);
    expect(result.definitionRef).toEqual(a.definitionRef);
    expect(result.visualOnlyAnchor).toEqual(a.visualOnlyAnchor);
    expect(result.frameId).toBe("fp02_east_north_height_xyz_v1");
    const {doc,bin}=unpack(actual),binary=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
    for(const part of result.parts){
      const primitives=doc.meshes[doc.nodes.find(n=>n.name===part.partId)!.mesh]!.primitives;
      const expected:number[]=[],indices:number[]=[];let vertices=0;
      for(const primitive of primitives){
        const p=doc.accessors[primitive.attributes.POSITION]!,i=doc.accessors[primitive.indices]!;
        const pb=doc.bufferViews[p.bufferView]!,ib=doc.bufferViews[i.bufferView]!;
        for(let v=0;v<p.count;v++)for(let axis=0;axis<3;axis++)expected.push(binary.getFloat32((pb.byteOffset??0)+(p.byteOffset??0)+v*(pb.byteStride??12)+axis*4,true));
        for(let v=0;v<i.count;v++)indices.push(vertices+binary.getUint16((ib.byteOffset??0)+(i.byteOffset??0)+v*2,true));
        vertices+=p.count;
      }
      expect(Array.from(part.artifact.positions)).toEqual(expected);
      expect(Array.from(part.artifact.indices)).toEqual(indices);
      expect(validateMeshArtifact(part.artifact).valid).toBe(true);
      expect(part.artifact.representationKey).toContain("installed_a");
      expect(part.materialProfiles.length).toBeGreaterThan(0);
      expect(Object.isFrozen(part)).toBe(true);
    }
    expect(Object.isFrozen(result)).toBe(true);
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
    ["unsupported accessor",(d:Doc)=>{d.accessors[0]!.componentType=5125;}],
    ["external buffer",(d:Doc)=>{d.buffers[0]!.uri="x";}],
    ["animation",(d:Doc)=>{d.animations=[];}],
    ["unsupported extension",(d:Doc)=>{d.extensionsUsed=["x"];}]
  ])("independently rejects %s after the explicitly stubbed integrity gate",async(_label,change)=>{
    bypassEditedGlbHash();
    await expect(loadPlayAssetProjection(request(entry(),edited(change as (d:Doc)=>void)))).rejects.toThrow(/part|transform|palette|accessor|unsupported|external/i);
  });
  it.each(["POSITION","NORMAL","index"])("independently rejects nonfinite/out-of-range %s bytes with the integrity gate stubbed",async kind=>{
    bypassEditedGlbHash();const payload=bytes(),{doc,bin}=unpack(payload),primitive=doc.meshes[0]!.primitives[0]!;
    const accessor=doc.accessors[kind==="index"?primitive.indices:primitive.attributes[kind as "POSITION"|"NORMAL"]]!;
    const offset=doc.bufferViews[accessor.bufferView]!.byteOffset??0,view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
    if(kind==="index")view.setUint16(offset,65535,true);else view.setFloat32(offset,NaN,true);
    await expect(loadPlayAssetProjection(request(entry(),payload))).rejects.toThrow(/finite|index|attribute/i);
  });
  it("rejects changed manifest bytes before fetching",async()=>{
    const path="../../../public/factory/play-2026-10-12/manifest.json?raw";
    const raw=readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest.json`,"utf8");
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
});
