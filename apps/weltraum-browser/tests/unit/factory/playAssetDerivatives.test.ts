import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFactoryCarrierProjection, getFactoryAssetSource, readFactoryAssetDefinition } from "../../../src/factory/presentation/factoryAssets";
import { createFp02CatalogInput, loadFactoryCatalog } from "../../../src/factory/catalog/fp02Catalog";
import { readCargoHandlingProfile } from "../../../src/factory/construction/cargoHandlingProfile";

const repo = fileURLToPath(new URL("../../../../../", import.meta.url));
const script = `${repo}art/factory/play-2026-10-12/build_assets.py`;
const nativePath = "art/factory/fp02/cutter/source.scene.json";
const source = getFactoryAssetSource("B06");
const sourceSHA256 = createHash("sha256").update(readFileSync(`${repo}${nativePath}`)).digest("hex");
const definition = readFactoryAssetDefinition("B06")!;
const binding = () => ({ source, sourceSHA256, definitionRef: {sourceId: definition.sourceId, version: definition.version, digest: definition.digest},
  nodes: source.parts.map(part => ({name: part.partId, scale: [1, 1, 1], translation: [0, 0, 0],
    extras: {playBinding: {partId: part.partId, parentPartId: null, sourceSHA256, sourceAssetId: source.assetId, definitionId: source.definitionId}}})) });
const gate = (input: ReturnType<typeof binding>) => {
  const result = spawnSync("python3", ["-B", script, "--validate-binding"], {input: JSON.stringify(input), encoding: "utf8"});
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as {valid: boolean; errors: string[]};
};

describe("PLAY derivative binding keeps render bytes subordinate to native identity", () => {
  it("accepts every original native part at a neutral metre transform", () => {
    expect(gate(binding())).toEqual({valid: true, errors: []});
  });
  it("rejects a syntactically valid replacement tool with no native part", () => {
    const value = binding();
    value.nodes[0]!.name = "cutter_free_tool";
    value.nodes[0]!.extras.playBinding.partId = "cutter_free_tool";
    expect(gate(value).errors).toContain("part-set-mismatch");
  });
  it("rejects a correct part attached to stale native source bytes", () => {
    const value = binding();
    value.nodes[0]!.extras.playBinding.sourceSHA256 = "0".repeat(64);
    expect(gate(value).errors).toContain("source-binding-mismatch");
  });
  it("rejects a correct part attached to a different device definition", () => {
    const value = binding();
    value.nodes[0]!.extras.playBinding.definitionId = "B07";
    expect(gate(value).errors).toContain("definition-binding-mismatch");
  });
  it("rejects millimetre-scaled GLB nodes before they reach the native metre world", () => {
    const value = binding();
    value.nodes[0]!.scale = [.001, .001, .001];
    expect(gate(value).errors).toContain("non-neutral-transform");
  });
});

interface FileRef {path: string; sha256: string; bytes: number}
interface PlayEntry {
  assetId: string; slug: string; family: string; units: string; runtimeAxes: string; sourceHead: string;
  definitionRef: {sourceId: string; version: number; digest: string} | null;
  visualOnlyAnchor: {kind: string} | null; partIds: string[]; parentPartIds?: Record<string,string|null>;
  nativeBoundsM: {min: number[]; max: number[]};
  sourceFile: FileRef; sourceBlob: FileRef; sourceSnapshot: FileRef; nativeBlend: FileRef; runtimeGlb: FileRef & {url: string};
  exporterReport: FileRef; provenance: FileRef; license: FileRef;
  visualVariant?: {baseAssetId: string; kind: string; pose: string; requiresConfirmedLocalAccess: boolean};
  visualRepair?: unknown;
}
interface Gltf {
  nodes: (ReturnType<typeof binding>["nodes"][number] & {mesh: number})[];
  meshes: {primitives: {attributes: {POSITION: number}}[]}[];
  accessors: {bufferView: number; byteOffset?: number; count: number; componentType: number; type: string; min: number[]; max: number[]}[];
  bufferViews: {byteOffset: number; byteStride?: number}[];
  materials: {name: string; pbrMetallicRoughness: {baseColorFactor: number[]}}[];
  buffers: {uri?: string}[]; images?: {uri?: string}[];
}
const manifestPath = `${repo}art/factory/play-2026-10-12/manifest.json`;
const readManifest = () => JSON.parse(readFileSync(manifestPath, "utf8")) as {schema: string; assets: PlayEntry[]};
const glb = (entry: PlayEntry) => {
  const bytes = readFileSync(`${repo}${entry.runtimeGlb.path}`);
  expect(bytes.subarray(0, 4).toString()).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2);
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  const jsonSize = bytes.readUInt32LE(12);
  expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString()) as Gltf;
  expect(bytes.readUInt32LE(24 + jsonSize)).toBe(0x004e4942);
  return {json, bin: bytes.subarray(28 + jsonSize)};
};
const hashRef = (ref: FileRef) => {
  const bytes = readFileSync(`${repo}${ref.path}`);
  expect(bytes.length, ref.path).toBe(ref.bytes);
  expect(createHash("sha256").update(bytes).digest("hex"), ref.path).toBe(ref.sha256);
  return bytes;
};

const ownerPaths = ["art/factory/fp02/cutter/source.scene.json", "art/factory/fp02/former/source.scene.json", "art/factory/fp01/power-kit/source.scene.json",
  "apps/weltraum-browser/src/factory/presentation/factoryAssets.ts", "apps/weltraum-browser/src/factory/construction/cargoHandlingProfile.ts",
  "apps/weltraum-browser/src/factory/fixtures/cargoSite.ts", "apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts"];
const correctionBase = "e752cc7fce43a50b4bcb4800d9d27584b44b6a0e";
const frozenSourceHead = "96cced23cd285b57f8a557d01ac9ed8a158c927f";
const copyFrozenOwnerSources = (temporary: string): void => {
  // Exercise this historical generator's own frozen source gate. Current
  // approved Host profiles are newer and must not be rolled back to its basis.
  for (const path of ownerPaths) {
    const original = spawnSync("git", ["show", `${frozenSourceHead}:${path}`], {cwd: repo});
    expect(original.status, `${path}: ${original.stderr}`).toBe(0);
    mkdirSync(dirname(join(temporary, path)), {recursive: true});
    writeFileSync(join(temporary, path), original.stdout);
  }
};

describe("R2/R6 correction admission", () => {
  it("rejects a catalog-only source change before any snapshot is written", () => {
    const temporary = mkdtempSync(join(tmpdir(), "play-catalog-guard-"));
    try {
      copyFrozenOwnerSources(temporary);
      const code = `import importlib.util,json\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location('play',${JSON.stringify(script)})\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nm.ROOT=Path(${JSON.stringify(temporary)})\np=m.ROOT/'apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts'\np.write_bytes(p.read_bytes()+b'\\n// changed catalog source\\n')\ntry:\n m.check_sources();result={'blocked':False,'reason':None}\nexcept ValueError as error:\n result={'blocked':True,'reason':str(error)}\nprint(json.dumps(result))`;
      const result = spawnSync("python3", ["-B", "-c", code], {encoding: "utf8"});
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({blocked: true, reason: "Frozen source changed: apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts"});
    } finally {rmSync(temporary, {recursive: true, force: true});}
  });

  it("rejects an incompatible catalog digest immediately after SSR before snapshot writes", () => {
    const temporary = mkdtempSync(join(tmpdir(), "play-catalog-digest-"));
    try {
      copyFrozenOwnerSources(temporary);
      const catalog = JSON.parse(readFileSync(`${repo}art/factory/play-2026-10-12/materials/catalog-read.json`, "utf8")) as {items: unknown[]};
      // SSR is a read dependency. Simulate a stale/mismatched returned catalog,
      // while its source bytes stay exact; observe actual writes in a temporary root.
      const code = `import importlib.util,json,types\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location('play',${JSON.stringify(script)})\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nm.ROOT=Path(${JSON.stringify(temporary)})\nm.ART=m.ROOT/'art/factory/play-2026-10-12'\nm.PUBLIC=m.ROOT/'public'\ndata=json.loads(${JSON.stringify(JSON.stringify({assets: [], items: catalog.items, catalogDigest: "fnv1a:wrong"}))})\nm.subprocess.run=lambda *args,**kwargs:types.SimpleNamespace(stdout='PLAY_JSON='+json.dumps(data))\ntry:\n m.snapshot();result={'blocked':False,'reason':None}\nexcept ValueError as error:\n result={'blocked':True,'reason':str(error)}\nresult['writtenSnapshots']=len(list(m.ART.rglob('native-source.json')))\nprint(json.dumps(result))`;
      const result = spawnSync("python3", ["-B", "-c", code], {encoding: "utf8"});
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout.trim().split("\n").at(-1)!)).toEqual({blocked: true, reason: "Frozen catalog digest mismatch", writtenSnapshots: 0});
    } finally {rmSync(temporary, {recursive: true, force: true});}
  });

  it("provides an inspection-open storage variant with original native identity and clear front access", () => {
    const manifest = readManifest();
    const entry = manifest.assets.find(a => a.assetId === "play_storage_inspection_open_v1");
    expect(entry, "missing confirmed-access visual derivative").toBeDefined();
    if (!entry) return;
    const closed = manifest.assets.find(a => a.assetId === "play_storage_v1")!;
    expect(entry.visualVariant).toEqual({baseAssetId: closed.assetId, kind: "confirmed-local-inventory-inspection", pose: "access-open", requiresConfirmedLocalAccess: true});
    expect(entry.definitionRef).toEqual(closed.definitionRef);
    expect(entry.partIds).toEqual(closed.partIds);
    expect(hashRef(entry.sourceSnapshot)).toEqual(hashRef(closed.sourceSnapshot));
    const {json, bin} = glb(entry);
    expect(json.nodes.map(n => n.name).sort()).toEqual(["body", "support_0", "support_1", "support_2", "support_3"]);
    const body = json.nodes.find(n => n.name === "body")!;
    const points: number[][] = [];
    for (const primitive of json.meshes[body.mesh]!.primitives) {
      const accessor = json.accessors[primitive.attributes.POSITION]!, view = json.bufferViews[accessor.bufferView]!;
      for (let vertex = 0; vertex < accessor.count; vertex++) points.push([0,1,2].map(axis => bin.readFloatLE(view.byteOffset + (accessor.byteOffset ?? 0) + vertex * (view.byteStride ?? 12) + axis * 4)));
    }
    expect(points.filter(([x,y,z]) => Math.abs(x!) < .8 && y! > .4 && y! < 1.35 && z! > .93)).toEqual([]);
    for (const centerX of [-.475, .475]) for (const dx of [-.4625, .4625]) for (const dy of [-.035, .035]) for (const dz of [-.565, .565]) {
      const expected = [centerX+dx, 1.44+dy, .390+dz];
      expect(points.some(point => point.every((value, axis) => Math.abs(value-expected[axis]!) < .00001)), `missing folded door corner ${expected}`).toBe(true);
    }
    const original = spawnSync("git", ["show", `${correctionBase}:art/factory/play-2026-10-12/manifest.json`], {cwd: repo, encoding: "utf8"});
    expect(original.status).toBe(0);
    const originalEntries = (JSON.parse(original.stdout) as {assets: PlayEntry[]}).assets;
    expect(manifest.assets.filter(a => a.assetId !== entry.assetId)).toEqual(originalEntries);
  });
});

describe("real saved/reopened Factory art payloads", () => {
  it("binds every file to actual payload bytes and every installed definition to the frozen native source", () => {
    const manifest = readManifest();
    expect(manifest.schema).toBe("hestia.factory.play-assets/v1");
    expect(manifest.assets).toHaveLength(23);
    expect(new Set(manifest.assets.map(a => a.family))).toEqual(new Set(["cutter", "former", "wreck-cargo", "carrier", "workbench", "storage", "belt", "power-kit", "materials", "brace"]));
    for (const entry of manifest.assets) {
      expect(entry.sourceHead).toBe("96cced23cd285b57f8a557d01ac9ed8a158c927f");
      expect(entry.units).toBe("meters");
      expect(entry.runtimeAxes).toBe("right-handed +X east +Y up +Z north");
      // Source provenance is bound to the declared historical Git blob. An unrelated
      // later owner-code edit must not masquerade as a changed geometry definition.
      const frozenBlob = spawnSync("git", ["show", `${entry.sourceHead}:${entry.sourceFile.path}`], {cwd: repo});
      expect(frozenBlob.status).toBe(0);
      expect(frozenBlob.stdout.length).toBe(entry.sourceFile.bytes);
      expect(createHash("sha256").update(frozenBlob.stdout).digest("hex")).toBe(entry.sourceFile.sha256);
      expect(hashRef(entry.sourceBlob)).toEqual(frozenBlob.stdout);
      for (const ref of [entry.sourceSnapshot, entry.nativeBlend, entry.runtimeGlb, entry.exporterReport, entry.provenance, entry.license]) hashRef(ref);
      expect(hashRef(entry.nativeBlend).subarray(0, 7).toString()).toBe("BLENDER");
      expect(entry.runtimeGlb.url).toBe(`/factory/play-2026-10-12/${entry.slug}.glb`);
      if (entry.definitionRef) {
        const native = getFactoryAssetSource(entry.definitionRef.sourceId);
        // The existing sourceBytes binding is JSON.stringify(source); JSON's
        // numeric contract intentionally serializes negative zero as zero.
        expect(JSON.parse(hashRef(entry.sourceSnapshot).toString())).toEqual(JSON.parse(JSON.stringify(native)));
        const definition = readFactoryAssetDefinition(entry.definitionRef.sourceId)!;
        expect(entry.definitionRef).toEqual({sourceId: definition.sourceId, version: definition.version, digest: definition.digest});
      } else expect(entry.visualOnlyAnchor?.kind).toMatch(/^visual-only-/);
    }
    expect(readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest.json`)).toEqual(readFileSync(manifestPath));
  });

  it("exports one neutral mesh per native part and real position bytes stay inside its frozen bounds", () => {
    for (const entry of readManifest().assets) {
      const snapshot = JSON.parse(hashRef(entry.sourceSnapshot).toString()) as typeof source;
      const {json, bin} = glb(entry);
      expect(json.nodes.map(n => n.name).sort()).toEqual([...entry.partIds].sort());
      expect(gate({source: snapshot, sourceSHA256: entry.sourceFile.sha256,
        definitionRef: entry.definitionRef ?? {sourceId: snapshot.definitionId, version: 1, digest: "visual-anchor-no-catalog-definition"}, nodes: json.nodes})).toEqual({valid: true, errors: []});
      expect(json.buffers.every(b => b.uri === undefined)).toBe(true);
      expect(json.images ?? []).toEqual([]);
      for (const node of json.nodes) {
        const part = snapshot.parts.find(p => p.partId === node.name)!;
        const corners = part.boxes.flatMap(box => [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => {
          const xx = x * box.sizeM[0]! / 2, yy = y * box.sizeM[1]! / 2, angle = box.rotationZRadians ?? 0;
          return [box.centerM[0]! + Math.cos(angle) * xx - Math.sin(angle) * yy,
            box.centerM[1]! + Math.sin(angle) * xx + Math.cos(angle) * yy, box.centerM[2]! + z * box.sizeM[2]! / 2];
        }))));
        const min = [0,1,2].map(i => Math.min(...corners.map(p => p[i]!)));
        const max = [0,1,2].map(i => Math.max(...corners.map(p => p[i]!)));
        for (const primitive of json.meshes[node.mesh]!.primitives) {
          const accessor = json.accessors[primitive.attributes.POSITION]!;
          const view = json.bufferViews[accessor.bufferView]!;
          expect(accessor.componentType).toBe(5126);
          expect(accessor.type).toBe("VEC3");
          const actualMin = [Infinity,Infinity,Infinity], actualMax = [-Infinity,-Infinity,-Infinity];
          for (let vertex = 0; vertex < accessor.count; vertex++) for (let axis = 0; axis < 3; axis++) {
            const value = bin.readFloatLE(view.byteOffset + (accessor.byteOffset ?? 0) + vertex * (view.byteStride ?? 12) + axis * 4);
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(min[axis]! - .00001);
            expect(value).toBeLessThanOrEqual(max[axis]! + .00001);
            actualMin[axis] = Math.min(actualMin[axis]!, value); actualMax[axis] = Math.max(actualMax[axis]!, value);
          }
          for (let i = 0; i < 3; i++) {
            expect(actualMin[i]).toBeCloseTo(accessor.min[i]!, 5);
            expect(actualMax[i]).toBeCloseTo(accessor.max[i]!, 5);
          }
        }
      }
    }
  });

  it("preserves the accepted sRGB palette as linear GLB PBR factors", () => {
    const palette: Record<string, string> = {"EX-STRUCT": "30383D", "EX-SHELL": "B6BDB8", "EX-FUNCTION": "407A79", "EX-HAZARD": "D8A94E", "EX-PV": "1D2E3C"};
    const linear = (value: number) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    for (const entry of readManifest().assets) for (const material of glb(entry).json.materials) {
      const hex = palette[material.name]!;
      expect(hex).toBeDefined();
      for (let axis = 0; axis < 3; axis++) expect(material.pbrMetallicRoughness.baseColorFactor[axis]).toBeCloseTo(linear(parseInt(hex.slice(axis * 2, axis * 2 + 2), 16) / 255), 6);
    }
  });

  it("retains the actual closed Native carrier part envelopes for heavy, medium and light loads", () => {
    const catalog = loadFactoryCatalog(createFp02CatalogInput());
    for (const [slug, profileId] of [["carrier-heavy", "B07-BOM"], ["carrier-medium", "B06-BOM"], ["carrier-light", "RAW8"]]) {
      const profile = readCargoHandlingProfile(catalog, profileId!)!;
      const actual = createFactoryCarrierProjection(profileId!, profile.digest, 1);
      const entry = readManifest().assets.find(a => a.slug === slug)!;
      const snapshot = JSON.parse(hashRef(entry.sourceSnapshot).toString()) as typeof source;
      expect(snapshot.parts.map(p => p.partId).sort()).toEqual(actual.map(p => p.partId).sort());
      for (const part of snapshot.parts) {
        const native = actual.find(p => p.partId === part.partId)!.artifact.bounds;
        const box = part.boxes[0]!;
        for (const [axis, name] of (["x", "y", "z"] as const).entries()) {
          expect(box.centerM[axis]! - box.sizeM[axis]! / 2).toBe(native.min[name]);
          expect(box.centerM[axis]! + box.sizeM[axis]! / 2).toBe(native.max[name]);
        }
      }
    }
  });
});

describe("bounded render surface V2 derivatives", () => {
  interface CargoGltf extends Gltf {
    asset:{extras:{hestia:{assetId:string;assetRevision:number}}};
    meshes:{primitives:{attributes:{POSITION:number;NORMAL:number};indices:number;material:number}[]}[];
    accessors:{bufferView:number;byteOffset?:number;count:number;componentType:number;type:string;min:number[];max:number[]}[];
  }
  const cargoManifest=JSON.parse(readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest-cargo-surface-v2.json`,"utf8")) as {assets:PlayEntry[]};
  const distributorManifest=JSON.parse(readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest-distribution-surface-v2.json`,"utf8")) as {assets:PlayEntry[]};
  const storageSurfaceManifest=JSON.parse(readFileSync(`${repo}apps/weltraum-browser/public/factory/play-2026-10-12/manifest-storage-surface-v2.json`,"utf8")) as {assets:PlayEntry[]};
  const oldCargo=readManifest().assets;
  const cargoBytes=(entry:PlayEntry)=>readFileSync(`${repo}${entry.runtimeGlb.path}`);
  const cargoGlb=(entry:PlayEntry)=>{
    const payload=cargoBytes(entry),{json,bin}=glb(entry);
    return {payload,doc:json as unknown as CargoGltf,bin};
  };
  const accessorTriples=(doc:CargoGltf,bin:Buffer,index:number)=>{
    const accessor=doc.accessors[index]!,view=doc.bufferViews[accessor.bufferView]!,stride=view.byteStride??12;
    return Array.from({length:accessor.count},(_,vertex)=>[0,1,2].map(axis=>bin.readFloatLE(view.byteOffset+(accessor.byteOffset??0)+vertex*stride+axis*4)));
  };
  const trianglesAtPlane=(doc:CargoGltf,bin:Buffer,role:string,plane:number)=>doc.meshes.flatMap(mesh=>mesh.primitives.flatMap(primitive=>{
    if(doc.materials[primitive.material]!.name!==role)return [];
    const positions=accessorTriples(doc,bin,primitive.attributes.POSITION),accessor=doc.accessors[primitive.indices]!,view=doc.bufferViews[accessor.bufferView]!,offset=view.byteOffset+(accessor.byteOffset??0);
    const result:number[][][]=[];
    for(let index=0;index<accessor.count;index+=3){
      const triangle=[0,1,2].map(corner=>positions[bin.readUInt16LE(offset+(index+corner)*2)]!);
      if(triangle.every(point=>point[2]===plane))result.push(triangle.map(point=>[point[0]!,point[1]!]));
    }
    return result;
  }));
  const trianglesAtAxisPlane=(doc:CargoGltf,bin:Buffer,role:string,axis:number,plane:number)=>doc.meshes.flatMap(mesh=>mesh.primitives.flatMap(primitive=>{
    if(doc.materials[primitive.material]!.name!==role)return [];
    const positions=accessorTriples(doc,bin,primitive.attributes.POSITION),index=doc.accessors[primitive.indices]!,view=doc.bufferViews[index.bufferView]!,offset=view.byteOffset+(index.byteOffset??0);
    const readIndex=(vertex:number)=>index.componentType===5123?bin.readUInt16LE(offset+vertex*2):index.componentType===5125?bin.readUInt32LE(offset+vertex*4):NaN;
    const axes=[0,1,2].filter(value=>value!==axis),result:number[][][]=[];
    for(let i=0;i<index.count;i+=3){
      const ids=[readIndex(i),readIndex(i+1),readIndex(i+2)];
      const triangle=ids.map(id=>positions[id]!);
      if(triangle.every(point=>point[axis]===plane))result.push(triangle.map(point=>[point[axes[0]!]!,point[axes[1]!]!]));
    }
    return result;
  }));
  const hasTriangleOverlap=(first:number[][][],second:number[][][])=>first.some(a=>second.some(b=>overlapArea(a,b)>1e-10));
  const overlapArea=(subject:number[][],clip:number[][])=>{
    const cross=(a:number[],b:number[],p:number[]) => (b[0]!-a[0]!)*(p[1]!-a[1]!)-(b[1]!-a[1]!)*(p[0]!-a[0]!);
    const orientation=Math.sign(cross(clip[0]!,clip[1]!,clip[2]!));
    if(orientation===0)return 0;
    let polygon=subject;
    for(let edge=0;edge<3&&polygon.length;edge++){
      const a=clip[edge]!,b=clip[(edge+1)%3]!,input=polygon;polygon=[];
      for(let i=0;i<input.length;i++){
        const from=input[i]!,to=input[(i+1)%input.length]!,fromDistance=orientation*cross(a,b,from),toDistance=orientation*cross(a,b,to),fromInside=fromDistance>=-1e-12,toInside=toDistance>=-1e-12;
        if(fromInside!==toInside){const t=fromDistance/(fromDistance-toDistance);polygon.push([from[0]!+t*(to[0]!-from[0]!),from[1]!+t*(to[1]!-from[1]!)]);}
        if(toInside)polygon.push(to);
      }
    }
    return Math.abs(polygon.reduce((sum,point,index)=>sum+point[0]!*(polygon[(index+1)%polygon.length]![1]!)-point[1]!*polygon[(index+1)%polygon.length]![0]!,0))/2;
  };

  it.each([
    ["play_wreck_cargo_v1","play_wreck_cargo_v2","EX-SHELL","EX-FUNCTION",15_108,"4b16d587014cba2587b8cf7ca34f674f3352c77c25aecfac3dca2073bd17a639"],
    ["play_wreck_cargo_open_v1","play_wreck_cargo_open_v2","EX-STRUCT","EX-SHELL",13_648,"304daec645c51a27e1735db2dc0b173cbbd01a8276d5b1862b54049af991c03a"]
  ])("repairs only the coplanar front surfaces of %s",(oldId,newId,firstRole,secondRole,oldSize,oldHash)=>{
    const original=oldCargo.find(a=>a.assetId===oldId)! as unknown as PlayEntry;
    const derivative=cargoManifest.assets.find(a=>a.assetId===newId)!;
    const old=cargoGlb(original),next=cargoGlb(derivative);
    expect(old.payload).toHaveLength(oldSize);
    expect(createHash("sha256").update(old.payload).digest("hex")).toBe(oldHash);
    expect(next.payload.length).toBeLessThanOrEqual(108_824);
    expect(derivative.runtimeGlb.bytes).toBe(next.payload.length);
    expect(next.doc.asset.extras.hestia).toEqual({...old.doc.asset.extras.hestia,assetId:newId,assetRevision:1});
    expect(derivative.partIds).toEqual(original.partIds);
    const expectedNativeBoundsM={min:[-0.75,0,-0.5],max:[0.75,1.5,0.5]};
    expect(original.nativeBoundsM).toEqual(expectedNativeBoundsM);
    expect(derivative.nativeBoundsM).toEqual(expectedNativeBoundsM);
    expect(derivative.visualOnlyAnchor).toEqual(original.visualOnlyAnchor);
    expect(derivative.sourceFile).toEqual(original.sourceFile);
    expect(derivative.sourceBlob).toEqual(original.sourceBlob);
    expect(derivative.sourceSnapshot).toEqual(original.sourceSnapshot);
    expect(next.doc.nodes.map(node=>node.name)).toEqual(old.doc.nodes.map(node=>node.name));
    expect(next.doc.materials).toEqual(old.doc.materials);
    expect(next.doc.meshes).toHaveLength(old.doc.meshes.length);
    expect(next.doc.accessors.map(accessor=>accessor.count)).toEqual(old.doc.accessors.map(accessor=>accessor.count));

    const changedByRole=new Map<string,number>(),rearChangedByRole=new Map<string,number>();
    for(let meshIndex=0;meshIndex<old.doc.meshes.length;meshIndex++){
      const oldPrimitives=old.doc.meshes[meshIndex]!.primitives,newPrimitives=next.doc.meshes[meshIndex]!.primitives;
      expect(newPrimitives).toHaveLength(oldPrimitives.length);
      for(let primitiveIndex=0;primitiveIndex<oldPrimitives.length;primitiveIndex++){
        const a=oldPrimitives[primitiveIndex]!,b=newPrimitives[primitiveIndex]!,role=old.doc.materials[a.material]!.name;
        expect(b.material).toBe(a.material);
        expect(b.indices).toBe(a.indices);
        const oldPositions=accessorTriples(old.doc,old.bin,a.attributes.POSITION),newPositions=accessorTriples(next.doc,next.bin,b.attributes.POSITION);
        expect(accessorTriples(next.doc,next.bin,b.attributes.NORMAL)).toEqual(accessorTriples(old.doc,old.bin,a.attributes.NORMAL));
        const offsets=role==="EX-STRUCT"?1/1024:role==="EX-SHELL"?2/1024:0;
        let changed=0;
        for(let vertex=0;vertex<oldPositions.length;vertex++){
          const before=oldPositions[vertex]!,after=newPositions[vertex]!,expected=[...before];
          if(offsets!==0&&before[2]===-0.5)expected[2]=before[2]!+offsets;
          else if(role==="EX-SHELL"&&before[2]===0.5){expected[2]=before[2]!-2/1024;rearChangedByRole.set(role,(rearChangedByRole.get(role)??0)+1);}
          if(JSON.stringify(before)!==JSON.stringify(after))changed++;
          expect(after).toEqual(expected);
        }
        changedByRole.set(role,(changedByRole.get(role)??0)+changed);
        const indices=(doc:CargoGltf,bin:Buffer,accessorIndex:number)=>{const index=doc.accessors[accessorIndex]!,view=doc.bufferViews[index.bufferView]!,offset=view.byteOffset+(index.byteOffset??0);return Array.from({length:index.count},(_,i)=>bin.readUInt16LE(offset+i*2));};
        expect(indices(next.doc,next.bin,b.indices)).toEqual(indices(old.doc,old.bin,a.indices));
        const assertAccessorBounds=(doc:CargoGltf,bin:Buffer,index:number)=>{
          const accessor=doc.accessors[index]!,points=accessorTriples(doc,bin,index);
          expect(accessor.min).toEqual([0,1,2].map(axis=>Math.min(...points.map(point=>point[axis]!))));
          expect(accessor.max).toEqual([0,1,2].map(axis=>Math.max(...points.map(point=>point[axis]!))));
        };
        assertAccessorBounds(old.doc,old.bin,a.attributes.POSITION);
        assertAccessorBounds(next.doc,next.bin,b.attributes.POSITION);
      }
    }
    expect(changedByRole.get("EX-STRUCT")).toBe(48);
    expect(changedByRole.get("EX-SHELL")).toBe(36);
    expect(rearChangedByRole.get("EX-SHELL")).toBe(12);
    expect(changedByRole.get("EX-FUNCTION")??0).toBe(0);
    expect(changedByRole.get("EX-HAZARD")??0).toBe(0);
    expect(changedByRole.get("EX-PV")??0).toBe(0);
    expect(trianglesAtPlane(old.doc,old.bin,firstRole,-0.5).some(a=>trianglesAtPlane(old.doc,old.bin,secondRole,-0.5).some(b=>overlapArea(a,b)>1e-10))).toBe(true);
    expect(trianglesAtPlane(old.doc,old.bin,"EX-STRUCT",0.5).some(a=>trianglesAtPlane(old.doc,old.bin,"EX-SHELL",0.5).some(b=>overlapArea(a,b)>1e-10))).toBe(true);
    expect(trianglesAtPlane(next.doc,next.bin,"EX-STRUCT",-0.5+1/1024).length).toBeGreaterThan(0);
    expect(trianglesAtPlane(next.doc,next.bin,"EX-SHELL",-0.5+2/1024).length).toBeGreaterThan(0);
    expect(trianglesAtPlane(next.doc,next.bin,"EX-STRUCT",0.5).length).toBeGreaterThan(0);
    expect(trianglesAtPlane(next.doc,next.bin,"EX-SHELL",0.5-2/1024).length).toBeGreaterThan(0);
    expect(trianglesAtPlane(next.doc,next.bin,"EX-STRUCT",0.5).some(a=>trianglesAtPlane(next.doc,next.bin,"EX-SHELL",0.5).some(b=>overlapArea(a,b)>1e-10))).toBe(false);
  });

  it("recesses only the Distributor shell/function front while preserving its Native bindings",()=>{
    const original=oldCargo.find(a=>a.assetId==="play_distribution_v1")!;
    const derivative=distributorManifest.assets.find(a=>a.assetId==="play_distribution_v2")!;
    const old=cargoGlb(original),next=cargoGlb(derivative);
    expect(old.payload).toHaveLength(20_764);
    expect(createHash("sha256").update(old.payload).digest("hex")).toBe("985f4c5627cc884c549dbe8aed9683798ef7a2d44c2f8340a3c2ef5fd9238b51");
    expect(next.payload.length).toBeLessThanOrEqual(108_824);
    expect(derivative.runtimeGlb).toEqual({
      path:"apps/weltraum-browser/public/factory/play-2026-10-12/distribution-v2.glb",
      sha256:createHash("sha256").update(next.payload).digest("hex"),bytes:next.payload.length,
      url:"/factory/play-2026-10-12/distribution-v2.glb"
    });
    expect(derivative.assetId).toBe("play_distribution_v2");
    expect(derivative.family).toBe(original.family);
    expect(derivative.definitionRef).toEqual(original.definitionRef);
    expect(derivative.partIds).toEqual(original.partIds);
    expect(derivative.parentPartIds).toEqual(original.parentPartIds);
    expect(derivative.sourceFile).toEqual(original.sourceFile);
    expect(derivative.sourceBlob).toEqual(original.sourceBlob);
    expect(derivative.sourceSnapshot).toEqual(original.sourceSnapshot);
    expect(derivative.nativeBoundsM).toEqual({min:[-1,0,-.5],max:[1,2,.5]});
    const originalLicense=readFileSync(join(repo,original.license.path));
    const originalLicenseSha=createHash("sha256").update(originalLicense).digest("hex");
    const originalLicenseIsSealedLf=originalLicense.length===326&&originalLicenseSha==="bc5e00789f9e69f40bb76b0db9802fca5122dde6d37f905c700b17febccbb632";
    const originalLicenseIsObservedCrlf=originalLicense.length===332&&originalLicenseSha==="9fdc99e37e82fd73e718b8c53079634204015ceddcf51c7e296f874f0e1340ea";
    expect(originalLicenseIsSealedLf||originalLicenseIsObservedCrlf).toBe(true);
    expect(original.license).toMatchObject({path:"art/factory/play-2026-10-12/LICENSE.txt",sha256:"bc5e00789f9e69f40bb76b0db9802fca5122dde6d37f905c700b17febccbb632",bytes:326});
    expect(derivative.license).toMatchObject({path:"art/factory/play-distribution-surface-v2-2026-10-21/LICENSE.txt",sha256:"bc5e00789f9e69f40bb76b0db9802fca5122dde6d37f905c700b17febccbb632",bytes:326});
    const normalizedLicense=Buffer.from(originalLicense.toString("utf8").replace(/\r\n/g,"\n"),"utf8");
    expect(hashRef(derivative.license)).toEqual(normalizedLicense);
    const provenance=JSON.parse(hashRef(derivative.provenance).toString()) as {historicalLicense:{path:string;sha256:string;bytes:number};licenseNormalization:string};
    expect(provenance.historicalLicense).toEqual(original.license);
    expect(provenance.licenseNormalization).toBe("CRLF-to-LF checkout normalization only");

    const expectedDoc=structuredClone(old.doc);
    expectedDoc.asset.extras.hestia.assetId="play_distribution_v2";
    expectedDoc.asset.extras.hestia.assetRevision=1;
    const changedAccessors=new Set<number>(),allowedFloatOffsets=new Set<number>();
    const changedByRole:Record<string,number>={"EX-SHELL":0,"EX-FUNCTION":0};
    for(let meshIndex=0;meshIndex<old.doc.meshes.length;meshIndex++){
      const oldPrimitives=old.doc.meshes[meshIndex]!.primitives,newPrimitives=next.doc.meshes[meshIndex]!.primitives;
      expect(newPrimitives).toHaveLength(oldPrimitives.length);
      for(let primitiveIndex=0;primitiveIndex<oldPrimitives.length;primitiveIndex++){
        const a=oldPrimitives[primitiveIndex]!,b=newPrimitives[primitiveIndex]!,role=old.doc.materials[a.material]!.name;
        expect(b.material).toBe(a.material);
        expect(b.indices).toBe(a.indices);
        const before=accessorTriples(old.doc,old.bin,a.attributes.POSITION);
        const after=accessorTriples(next.doc,next.bin,b.attributes.POSITION);
        expect(after).toHaveLength(before.length);
        const accessor=old.doc.accessors[a.attributes.POSITION]!,view=old.doc.bufferViews[accessor.bufferView]!;
        const stride=view.byteStride??12,offset=view.byteOffset+(accessor.byteOffset??0);
        for(let vertex=0;vertex<before.length;vertex++){
          const expected=[...before[vertex]!];
          if((role==="EX-SHELL"||role==="EX-FUNCTION")&&expected[2]===.5){
            const recess=role==="EX-SHELL"?2/1024:1/1024;
            expected[2]=.5-recess;
            const byteOffset=offset+vertex*stride+8;
            if(!allowedFloatOffsets.has(byteOffset))changedByRole[role]++;
            allowedFloatOffsets.add(byteOffset);
            changedAccessors.add(a.attributes.POSITION);
          }
          expect(after[vertex]).toEqual(expected);
        }
      }
    }
    expect(changedByRole).toEqual({"EX-SHELL":24,"EX-FUNCTION":48});
    expect(allowedFloatOffsets.size).toBe(72);
    expect(next.bin).toHaveLength(old.bin.length);
    const allowedBytes=new Set<number>();
    for(const offset of allowedFloatOffsets)for(let byte=0;byte<4;byte++)allowedBytes.add(offset+byte);
    for(let offset=0;offset<old.bin.length;offset++)if(!allowedBytes.has(offset))expect(next.bin[offset]).toBe(old.bin[offset]);
    for(const accessorIndex of changedAccessors){
      const points=accessorTriples(next.doc,next.bin,accessorIndex),accessor=expectedDoc.accessors[accessorIndex]!;
      accessor.min=[0,1,2].map(axis=>Math.min(...points.map(point=>point[axis]!)));
      accessor.max=[0,1,2].map(axis=>Math.max(...points.map(point=>point[axis]!)));
    }
    expect(next.doc).toEqual(expectedDoc);

    const frontRoles=["EX-SHELL","EX-FUNCTION","EX-STRUCT"] as const;
    const oldHasDifferentColorOverlap=frontRoles.some((first,index)=>frontRoles.slice(index+1).some(second=>
      trianglesAtPlane(old.doc,old.bin,first,.5).some(a=>trianglesAtPlane(old.doc,old.bin,second,.5).some(b=>overlapArea(a,b)>1e-10))));
    expect(oldHasDifferentColorOverlap).toBe(true);
    for(const plane of [.5,.5-1/1024,.5-2/1024]){
      for(let firstIndex=0;firstIndex<frontRoles.length;firstIndex++)for(let secondIndex=firstIndex+1;secondIndex<frontRoles.length;secondIndex++){
        const first=frontRoles[firstIndex]!,second=frontRoles[secondIndex]!;
        expect(trianglesAtPlane(next.doc,next.bin,first,plane).some(a=>
          trianglesAtPlane(next.doc,next.bin,second,plane).some(b=>overlapArea(a,b)>1e-10))).toBe(false);
      }
    }
  });

  it.each([
    ["play_storage_v1","play_storage_v2","storage-v2.glb"],
    ["play_storage_inspection_open_v1","play_storage_inspection_open_v2","storage-open-v2.glb"],
  ])("separates only proven coplanar B09 shell faces for %s",(oldId,newId,filename)=>{
    const original=oldCargo.find(entry=>entry.assetId===oldId)!;
    const derivative=storageSurfaceManifest.assets.find(entry=>entry.assetId===newId)!;
    const old=cargoGlb(original),next=cargoGlb(derivative);
    const oldSha=createHash("sha256").update(old.payload).digest("hex");
    const expectedOld=oldId==="play_storage_v1"
      ? {bytes:24_160,sha:"e7ddc40fd2be52f8886b8acd42561fcc5fb403b1630d674bd7be5e28190e1e03"}
      : {bytes:24_380,sha:"569557420499f023373f1f5fd7fc1ac0f7d72c9cd89f9b91277c8787dd7054d4"};
    expect(old.payload).toHaveLength(expectedOld.bytes);
    expect(oldSha).toBe(expectedOld.sha);
    expect(next.payload.length).toBeLessThanOrEqual(108_824);
    expect(derivative.runtimeGlb).toEqual({
      path:`apps/weltraum-browser/public/factory/play-2026-10-12/${filename}`,
      sha256:createHash("sha256").update(next.payload).digest("hex"),bytes:next.payload.length,
      url:`/factory/play-2026-10-12/${filename}`
    });
    expect(derivative.assetId).toBe(newId);
    expect(derivative.family).toBe(original.family);
    expect(derivative.definitionRef).toEqual(original.definitionRef);
    expect(derivative.partIds).toEqual(original.partIds);
    expect(derivative.parentPartIds).toEqual(original.parentPartIds);
    expect(derivative.sourceFile).toEqual(original.sourceFile);
    expect(derivative.sourceBlob).toEqual(original.sourceBlob);
    expect(derivative.sourceSnapshot).toEqual(original.sourceSnapshot);
    expect(derivative.nativeBoundsM).toEqual({min:[-1,0,-1],max:[1,1.5,1]});
    if(oldId==="play_storage_inspection_open_v1") {
      expect(derivative.visualVariant).toEqual({baseAssetId:"play_storage_v2",kind:"confirmed-local-inventory-inspection",pose:"access-open",requiresConfirmedLocalAccess:true});
    } else expect(derivative.visualVariant).toBeUndefined();
    expect(next.doc.asset.extras.hestia).toEqual({...old.doc.asset.extras.hestia,assetId:newId,assetRevision:1});
    expect(next.doc.nodes).toEqual(old.doc.nodes);
    expect(next.doc.materials).toEqual(old.doc.materials);
    expect(next.doc.meshes).toEqual(old.doc.meshes);
    expect(next.doc.accessors.map(accessor=>accessor.count)).toEqual(old.doc.accessors.map(accessor=>accessor.count));
    expect(next.bin).toHaveLength(old.bin.length);

    const snapshot=JSON.parse(hashRef(original.sourceSnapshot).toString()) as {parts:{partId:string;boxes:{centerM:number[];sizeM:number[];rotationZRadians?:number}[]}[]};
    const bodyBox=snapshot.parts.find(part=>part.partId==="body")!.boxes[0]!;
    const bodyBounds={min:bodyBox.centerM.map((value,axis)=>value-bodyBox.sizeM[axis]!/2),max:bodyBox.centerM.map((value,axis)=>value+bodyBox.sizeM[axis]!/2)};
    const repair=derivative.visualRepair as unknown as {changedCoordinateCount:number;nativeBodyBoundsM:{min:number[];max:number[]};positionAccessorAxisMapping:Record<string,string>;planes:{positionAccessorAxis:"X"|"Y"|"Z";positionPlaneFromM:number;positionPlaneToM:number;changedVertexCount:number}[]};
    expect(repair.nativeBodyBoundsM).toEqual(bodyBounds);
    expect(repair.positionAccessorAxisMapping).toEqual({X:"Native/runtime X",Y:"Native/runtime Y",Z:"Native/runtime Z"});
    expect(repair.planes.length).toBeGreaterThan(0);
    const axisIndex={X:0,Y:1,Z:2} as const;
    for(const plane of repair.planes){
      const axis=axisIndex[plane.positionAccessorAxis];
      expect(plane.changedVertexCount).toBeGreaterThan(0);
      expect([bodyBounds.min[axis]!,bodyBounds.max[axis]!]).toContain(plane.positionPlaneFromM);
      expect(hasTriangleOverlap(trianglesAtAxisPlane(old.doc,old.bin,"EX-SHELL",axis,plane.positionPlaneFromM),trianglesAtAxisPlane(old.doc,old.bin,"EX-STRUCT",axis,plane.positionPlaneFromM))).toBe(true);
      expect(hasTriangleOverlap(trianglesAtAxisPlane(next.doc,next.bin,"EX-SHELL",axis,plane.positionPlaneFromM),trianglesAtAxisPlane(next.doc,next.bin,"EX-STRUCT",axis,plane.positionPlaneFromM))).toBe(false);
      expect(hasTriangleOverlap(trianglesAtAxisPlane(next.doc,next.bin,"EX-SHELL",axis,plane.positionPlaneToM),trianglesAtAxisPlane(next.doc,next.bin,"EX-STRUCT",axis,plane.positionPlaneToM))).toBe(false);
    }

    const positions=new Map<number,{before:number[][];after:number[][]}>(),roleVertices=new Map<number,Map<string,Set<number>>>();
    const expectedCenter=bodyBox.centerM,boundaries=bodyBounds;
    const allowedByteOffsets=new Set<number>(),changedAccessors=new Set<number>();
    let changedCoordinates=0;
    for(let meshIndex=0;meshIndex<old.doc.meshes.length;meshIndex++){
      const oldPrimitives=old.doc.meshes[meshIndex]!.primitives,newPrimitives=next.doc.meshes[meshIndex]!.primitives;
      expect(newPrimitives).toHaveLength(oldPrimitives.length);
      for(let primitiveIndex=0;primitiveIndex<oldPrimitives.length;primitiveIndex++){
        const a=oldPrimitives[primitiveIndex]!,b=newPrimitives[primitiveIndex]!,role=old.doc.materials[a.material]!.name;
        expect(b.material).toBe(a.material);
        expect(b.indices).toBe(a.indices);
        expect(b.attributes).toEqual(a.attributes);
        const accessorIndex=a.attributes.POSITION;
        if(!positions.has(accessorIndex))positions.set(accessorIndex,{before:accessorTriples(old.doc,old.bin,accessorIndex),after:accessorTriples(next.doc,next.bin,accessorIndex)});
        const indexAccessor=old.doc.accessors[a.indices]!,indexView=old.doc.bufferViews[indexAccessor.bufferView]!,indexOffset=indexView.byteOffset+(indexAccessor.byteOffset??0);
        const readIndex=(index:number)=>indexAccessor.componentType===5123?old.bin.readUInt16LE(indexOffset+index*2):old.bin.readUInt32LE(indexOffset+index*4);
        const used=roleVertices.get(accessorIndex)??new Map<string,Set<number>>(),set=used.get(role)??new Set<number>();
        for(let i=0;i<indexAccessor.count;i++)set.add(readIndex(i));
        used.set(role,set);roleVertices.set(accessorIndex,used);
        const oldNormals=accessorTriples(old.doc,old.bin,a.attributes.NORMAL),newNormals=accessorTriples(next.doc,next.bin,b.attributes.NORMAL);
        expect(newNormals).toEqual(oldNormals);
      }
    }
    for(const [accessorIndex,values] of positions){
      expect(values.after).toHaveLength(values.before.length);
      const used=roleVertices.get(accessorIndex)!;
      for(let vertex=0;vertex<values.before.length;vertex++){
        const before=values.before[vertex]!,after=values.after[vertex]!;
        for(let axis=0;axis<3;axis++){
          if(before[axis]===after[axis])continue;
          changedCoordinates++;
          expect(used.get("EX-SHELL")?.has(vertex)).toBe(true);
          for(const [role,indices] of used)if(role!=="EX-SHELL")expect(indices.has(vertex)).toBe(false);
          expect([boundaries.min[axis]!,boundaries.max[axis]!]).toContain(before[axis]!);
          const expected=Math.fround(before[axis]!+Math.sign(expectedCenter[axis]!-before[axis]!)/1024);
          expect(after[axis]).toBe(expected);
          const accessor=old.doc.accessors[accessorIndex]!,view=old.doc.bufferViews[accessor.bufferView]!;
          const stride=view.byteStride??12,offset=view.byteOffset+(accessor.byteOffset??0)+vertex*stride+axis*4;
          for(let byte=0;byte<4;byte++)allowedByteOffsets.add(offset+byte);
          changedAccessors.add(accessorIndex);
        }
      }
    }
    expect(changedCoordinates).toBe(repair.changedCoordinateCount);
    const allowedBinaryBytes=allowedByteOffsets;
    for(let offset=0;offset<old.bin.length;offset++)if(!allowedBinaryBytes.has(offset))expect(next.bin[offset]).toBe(old.bin[offset]);
    const expectedDoc=structuredClone(old.doc);
    expectedDoc.asset.extras.hestia.assetId=newId;
    expectedDoc.asset.extras.hestia.assetRevision=1;
    for(const accessorIndex of changedAccessors){
      const points=accessorTriples(next.doc,next.bin,accessorIndex),expected=structuredClone(old.doc.accessors[accessorIndex]!);
      expected.min=[0,1,2].map(axis=>Math.min(...points.map(point=>point[axis]!)));
      expected.max=[0,1,2].map(axis=>Math.max(...points.map(point=>point[axis]!)));
      expect(next.doc.accessors[accessorIndex]).toEqual(expected);
      expectedDoc.accessors[accessorIndex]!.min=expected.min;
      expectedDoc.accessors[accessorIndex]!.max=expected.max;
    }
    expect(next.doc).toEqual(expectedDoc);
  });
});
