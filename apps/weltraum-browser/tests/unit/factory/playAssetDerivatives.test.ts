import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  visualOnlyAnchor: {kind: string} | null; partIds: string[];
  sourceFile: FileRef; sourceBlob: FileRef; sourceSnapshot: FileRef; nativeBlend: FileRef; runtimeGlb: FileRef & {url: string};
  exporterReport: FileRef; provenance: FileRef; license: FileRef;
  visualVariant?: {baseAssetId: string; kind: string; pose: string; requiresConfirmedLocalAccess: boolean};
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

describe("R2/R6 correction admission", () => {
  it("rejects a catalog-only source change before any snapshot is written", () => {
    const temporary = mkdtempSync(join(tmpdir(), "play-catalog-guard-"));
    try {
      for (const path of ownerPaths) {mkdirSync(dirname(join(temporary, path)), {recursive: true}); copyFileSync(`${repo}${path}`, join(temporary, path));}
      const code = `import importlib.util,json\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location('play',${JSON.stringify(script)})\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nm.ROOT=Path(${JSON.stringify(temporary)})\np=m.ROOT/'apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts'\np.write_bytes(p.read_bytes()+b'\\n// changed catalog source\\n')\ntry:\n m.check_sources();result={'blocked':False,'reason':None}\nexcept ValueError as error:\n result={'blocked':True,'reason':str(error)}\nprint(json.dumps(result))`;
      const result = spawnSync("python3", ["-B", "-c", code], {encoding: "utf8"});
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({blocked: true, reason: "Frozen source changed: apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts"});
    } finally {rmSync(temporary, {recursive: true, force: true});}
  });

  it("rejects an incompatible catalog digest immediately after SSR before snapshot writes", () => {
    const temporary = mkdtempSync(join(tmpdir(), "play-catalog-digest-"));
    try {
      for (const path of ownerPaths) {mkdirSync(dirname(join(temporary, path)), {recursive: true}); copyFileSync(`${repo}${path}`, join(temporary, path));}
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
