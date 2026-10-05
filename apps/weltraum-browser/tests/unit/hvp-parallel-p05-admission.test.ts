import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { verifyHvpOwnedBodyMeshSteps } from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import { decodeHvpBodyCutOutput, HVP_BODY_CUT_MAX_OUTPUT } from "../../src/workers/hvpBodyCutJob";
import { readHvpBodyCutWire, type HvpBodyCutWireV2 } from "../../src/workers/hvpBodyCutWire";
import { byteCount } from "../../src/workers/ids";
import { integrateWorkerResult } from "../../src/workers/resultGate";
import { createFnv1a64State, fnv1a64Bytes, fnv1a64StateHex, updateFnv1a64State } from "../../src/core/fnv1a64";
import { createP05BodyFixture, drainP05Steps, rehashP05Packet } from "../reference/hvp-parallel-p05/bodyFixture";

describe("P05-T01 standalone owner geometry admission (runtime wiring remains OPEN_IMPLEMENTATION)", () => {
  let fixture: ReturnType<typeof createP05BodyFixture>;
  beforeAll(() => { fixture = createP05BodyFixture(); });

  it("accepts the complete compiler output against the retained owner-local child", () => {
    const products = decodeHvpBodyCutOutput(fixture.bundle, fixture.preparation.payload);
    expect(products.parts).toHaveLength(1);
    expect(products.parts[0]!.cells).toEqual(fixture.local.plan.parts[0]!.cells);
    expect(products.removedCells).toBe(1);
    expect(products.removedMassKg).toBe(1);
    expect(() => drainP05Steps(verifyHvpOwnedBodyMeshSteps(fixture.local.plan.parts[0]!, products.parts[0]!.mesh))).not.toThrow();
  });

  it.each(["degenerate-position", "normal", "ao", "winding", "degenerate-index", "material", "unit-face-count"] as const)(
    "rejects hash-valid %s without adopting compiler geometry as the oracle", mutation => {
      const owner = fixture.local.plan.parts[0]!;
      const originalCells = owner.cells;
      const buffers = fixture.bundle.buffers.map(buffer => buffer.slice(0));
      const header = JSON.parse(new TextDecoder().decode(buffers[0]!)) as HvpBodyCutWireV2;
      const wire = readHvpBodyCutWire(rehashP05Packet(fixture.bundle, buffers), header.binding);
      switch (mutation) {
        case "degenerate-position": wire.positions.set(wire.positions.subarray(0, 3), 3); break;
        case "normal": {
          const index = wire.normals.findIndex(value => value !== 0);
          expect(index).toBeGreaterThanOrEqual(0);
          wire.normals[index] = -wire.normals[index]!;
          break;
        }
        case "ao": wire.colors[0] = wire.colors[0] === 1 ? .875 : 1; break;
        case "winding": [wire.indices[0], wire.indices[1]] = [wire.indices[1]!, wire.indices[0]!]; break;
        case "degenerate-index": wire.indices[0] = wire.indices[1]!; break;
        case "material": wire.ranges[0] = wire.ranges[0] === 1 ? 2 : 1; break;
        case "unit-face-count": {
          const parts = header.parts.map((part, index) => index === 0 ? { ...part, unitFaceCount: part.unitFaceCount + 1 } : part);
          buffers[0] = new TextEncoder().encode(JSON.stringify({ ...header, parts })).buffer;
          break;
        }
      }
      const changed = rehashP05Packet(fixture.bundle, buffers);
      expect(changed.contentHash).not.toBe(fixture.bundle.contentHash);
      const expectation = { ...fixture.request, cancelled: false, outputRevision: fixture.result.outputRevision,
        maximumOutputBytes: byteCount(HVP_BODY_CUT_MAX_OUTPUT) };
      const changedResult = { ...fixture.result, outputBytes: changed.byteLength };
      expect(integrateWorkerResult(expectation, changedResult, changed).kind).toBe("RejectedContentHashMismatch");
      expect(integrateWorkerResult(expectation, { ...changedResult, contentHash: changed.contentHash }, changed).kind).toBe("Accepted");
      const products = decodeHvpBodyCutOutput(changed, fixture.preparation.payload);
      expect(products.parts[0]!.sourceDigest).toBe(owner.recipe.source.contentHash);
      expect(() => drainP05Steps(verifyHvpOwnedBodyMeshSteps(owner, products.parts[0]!.mesh))).toThrow("Foreign local body mesh geometry");
      expect(owner.cells).toBe(originalCells);
      expect(Object.isFrozen(owner.cells)).toBe(true);
    }
  );
});

it("P05-T10 preserves public/incremental FNV bytes against independent BigInt arithmetic at every partition", () => {
  const bytes = new Uint8Array(259);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index % 256;
  }
  // Independent standard FNV-1a reference; no product hash helper in the expectation.
  let expected = 0xcbf29ce484222325n;
  for (const value of bytes) {
    expected = ((expected ^ BigInt(value)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  const hex = expected.toString(16).padStart(16, "0");
  expect(fnv1a64Bytes(new Uint8Array())).toBe("cbf29ce484222325");
  expect(fnv1a64Bytes(bytes)).toBe(hex);
  for (let split = 0; split <= bytes.length; split += 1) {
    const state = createFnv1a64State();
    updateFnv1a64State(state, bytes.subarray(0, split));
    updateFnv1a64State(state, bytes.subarray(split));
    expect(fnv1a64StateHex(state)).toBe(hex);
  }
});

// Prepared after S03, NOT_RUN. The S03 31-case artifact does not verify these two checks.
describe.skipIf(!process.env.P05_AB_ROLE)("P05-AB R02/R03 immutable-candidate checks", () => {
  const b3 = "b3c6523a94cd050f5a9a22dc27f4777fcc03363e";
  const candidate = "e7113c0b73b7b748cd9a8111394c4387ce6c0d7c";
  const app = "C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Parallel-P05-2026-10-02/apps/weltraum-browser";
  const evidence = "C:/IFI_SourceCode/Utils/opencode-migration/tmp/opencode/hestia-parallel-coordination-20261002/P05-evidence-e711-20261003";
  const git = "C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe";
  let role: "baseline" | "candidate", probe: typeof import("../reference/hvp-parallel-p05/classificationProbe");
  let baseline: { binding: { head: string; tree: string; role: string }; drafts: Record<string, string>;
    runtimeLock: Record<string, string>; R03: unknown };
  const record: Record<string, unknown> = {};

  beforeAll(async () => {
    const requested = process.env.P05_AB_ROLE, expected = process.env.P05_AB_EXPECTED_SHA;
    if ((requested !== "baseline" && requested !== "candidate") || !expected || !/^[0-9a-f]{40}$/.test(expected)
      || expected !== (requested === "baseline" ? b3 : candidate)
      || path.resolve(process.cwd()) !== path.resolve(app)) {
      throw new Error("P05 A/B requires a granted role, exact immutable SHA and own app directory");
    }
    role = requested;
    const readGit = (args: string[]) => execFileSync(git, args, { cwd: app, encoding: "utf8", timeout: 3000 }).trim();
    if (readGit(["rev-parse", "HEAD"]) !== expected || readGit(["diff", "--name-only", "HEAD"]) !== "") {
      throw new Error("P05 A/B HEAD mismatch or tracked WIP; stop without testing or rebinding");
    }
    const drafts: Record<string, string> = {};
    for (const file of ["tests/unit/hvp-parallel-p05-admission.test.ts", "tests/unit/hvp-parallel-p05-lifecycle.test.ts",
      "tests/unit/hvp-parallel-p05-memory.test.ts", "tests/reference/hvp-parallel-p05/bodyFixture.ts",
      "tests/reference/hvp-parallel-p05/classificationProbe.ts"]) {
      drafts[file] = createHash("sha256").update(readFileSync(path.join(app, file))).digest("hex");
    }
    const sources: Record<string, string> = {};
    for (const file of ["src/voxel/structural/classificationSteps.ts", "src/voxel/structural/occupiedEntries.ts", "src/voxel/structural/model.ts",
      "src/hestia-prototype/terrain/bodyCutConsumer.ts", "src/hvp/hvpBootstrap.ts"]) {
      sources[file] = createHash("sha256").update(readFileSync(path.join(app, file))).digest("hex");
    }
    const tree = readGit(["rev-parse", "HEAD^{tree}"]);
    if (tree !== (role === "baseline" ? "cdf8a92b17eecd764bac4588054167bd566485f1" : "195a8d2f66e689d4410bc0dd9b4f1efac9ac86a5")) {
      throw new Error("P05 A/B immutable tree mismatch; stop without rebinding");
    }
    if (role === "candidate") {
      sources["src/hestia-prototype/presentation/renderStageRecovery.ts"] = createHash("sha256")
        .update(readFileSync(path.join(app, "src/hestia-prototype/presentation/renderStageRecovery.ts"))).digest("hex");
    }
    record.binding = { head: expected, tree, role, sources };
    record.drafts = drafts;
    const runtimeLock: Record<string, string> = {};
    for (const file of ["package.json", "package-lock.json"]) {
      runtimeLock[file] = createHash("sha256").update(readFileSync(path.join(app, file))).digest("hex");
    }
    record.runtimeLock = runtimeLock;
    if (role === "candidate") {
      const baselineBytes = readFileSync("C:/IFI_SourceCode/Utils/opencode-migration/tmp/opencode/hestia-parallel-coordination-20261002/P05-evidence-ab-split-2548ce04-20261002-r01/baseline-observations.json");
      expect(createHash("sha256").update(baselineBytes).digest("hex")).toBe("c24df68c286c79c4a14db34a49c398d09bf85d7e495a3179303ed34443ed3400");
      baseline = JSON.parse(baselineBytes.toString("utf8"));
      expect(baseline.binding.head).toBe(b3);
      expect(baseline.binding.tree).toBe("cdf8a92b17eecd764bac4588054167bd566485f1");
      expect(baseline.binding.role).toBe("baseline");
      expect(baseline.drafts).toEqual({ ...drafts,
        "tests/unit/hvp-parallel-p05-admission.test.ts": "6447d776f183bb1192432f0d11006954d301ee8375793674944caaf3d8d2946d" });
      expect(baseline.runtimeLock).toEqual(runtimeLock);
    }
    probe = await import("../reference/hvp-parallel-p05/classificationProbe");
  });

  afterAll(() => {
    if (record.binding !== undefined) {
      // Directory must be freshly prepared by Meta's granted runner; never overwrite any artifact.
      writeFileSync(path.join(evidence, `${role}-observations.json`), JSON.stringify(record, null, 2), { flag: "wx" });
    }
  });

  it("R03 compares constructor/species read order and original sentinel identity", () => {
    const source = probe.createP05JointFixture(0);
    const clean = probe.observeP05ArrayReads(source, "none"), trace = probe.observeP05ArrayReads(source, "trace");
    const wrapper = probe.observeP05ArrayReads(source, "wrapper-throw"), species = probe.observeP05ArrayReads(source, "species-throw");
    const observations = { clean, trace, wrapper, species };
    record.R03 = observations;
    for (const result of [clean, trace, wrapper, species]) {
      expect(result.inputUnchanged).toBe(true); expect(result.descriptorRestored).toBe(true);
    }
    expect(clean.error).toBeNull(); expect(clean.output).not.toBeNull();
    expect(trace.error).toBeNull(); expect(trace.output).toBe(clean.output);
    expect(species.error?.sameSentinel).toBe(true); expect(species.output).toBeNull();
    if (wrapper.error !== null) {
      expect(wrapper.error.sameSentinel).toBe(true);
    }
    expect(wrapper.error).toBeNull(); expect(wrapper.output).toBe(clean.output);
    if (role === "candidate") {
      expect(observations).toEqual(baseline.R03);
    }
  });

  it("R02 compares one issued cell with zero joints versus 65 legal joints / 130 endpoint facts", () => {
    const control = probe.observeP05FactSteps(probe.createP05JointFixture(0), role);
    const rich = probe.observeP05FactSteps(probe.createP05JointFixture(65), role);
    const largeControl = probe.observeP05FactSteps(probe.createP05JointFixture(65, 257), role), expected: string[] = [];
    for (let index = 0; index < 65; index += 1) {
      for (const endpoint of ["A", "B"]) {
        expected.push(`p05:joint:${String(index).padStart(3, "0")}|${endpoint}|${endpoint}`);
      }
    }
    record.R02 = { control, rich, largeControl };
    expect(control.inputUnchanged).toBe(true); expect(rich.inputUnchanged).toBe(true); expect(largeControl.inputUnchanged).toBe(true);
    expect(control.output.components).toHaveLength(1); expect(rich.output.components).toHaveLength(1);
    expect(control.output.components[0]!.activeJoints).toHaveLength(0);
    const component = rich.output.components[0]!;
    expect(component.occupiedCells).toHaveLength(1); expect(component.activeAnchors).toHaveLength(0);
    expect(component.activeJoints.map(fact => `${fact.jointId}|${fact.endpoint}|${fact.role}`)).toEqual(expected);
    expect(component.anchored).toBe(false);
    expect(largeControl.output.components).toHaveLength(1);
    expect(largeControl.output.components[0]!.occupiedCells).toHaveLength(257);
    expect(largeControl.output.components[0]!.activeJoints.map(fact => `${fact.jointId}|${fact.endpoint}|${fact.role}`)).toEqual(expected);
    expect(largeControl.labels.length).toBeGreaterThan(control.labels.length);
    if (role === "baseline") {
      expect(rich.labels.length).toBe(control.labels.length);
    } else {
      expect(rich.labels.length).toBeGreaterThan(control.labels.length);
    }
    // Yield-count/label counterprobe only: not a bound on each fact loop, native time or timer gaps.
  });
});

// Standalone regression, NOT_RUN; the original 209-line harness above stays unchanged.
import { deriveStructuralObjectMassProperties, encodeStructuralObject } from "../../src/voxel/structural";
import { readHvpBodyCells } from "../../src/hestia-prototype/physics/bodyCutPlan";
import { meshHvpBodyCells } from "../../src/hestia-prototype/presentation/terrainFragment";
import { ingestHvpStructuralCells } from "../../src/hestia-prototype/terrain/structuralIngest";
import { p05Materials } from "../reference/hvp-parallel-p05/bodyFixture";

describe("P05-R02 normal specimen material storage", () => {
  it.each([256, 65_535])("preserves Source ID %i and its six unit faces without aliasing", materialId => {
    // Generic saved specimen source, not a new Coast/Branch palette or native owner.
    const input = Object.freeze([Object.freeze({ x: 0, y: 0, z: 0, materialId })]);
    const source = ingestHvpStructuralCells(`p05-specimen-material-${materialId}`, input,
      [{ ...p05Materials[0]!, materialId }]);
    const sourceBytes = encodeStructuralObject(source), digest = source.contentHash;
    const cells = readHvpBodyCells(source);
    const mass = deriveStructuralObjectMassProperties(source, { maxVisitedCells: 32_768 });
    expect(mass.centerOfMassMeters).toEqual({ x: .0625, y: .0625, z: .0625 });
    const mesh = meshHvpBodyCells(cells, mass.centerOfMassMeters!, digest);

    expect(input[0]!.materialId).toBe(materialId);
    expect(readHvpBodyCells(source)).toEqual(input);
    expect(encodeStructuralObject(source)).toBe(sourceBytes);
    expect(source.contentHash).toBe(digest);
    expect(mesh.sourceDigest).toBe(digest);
    // Targets the legacy256-to-air and65535-to-range-alias defects; execution is NOT_RUN.
    expect(mesh.unitFaceCount).toBe(6);
    expect(mesh.materialRanges).toEqual([{ slot: materialId, startIndex: 0, indexCount: 36 }]);
    expect([mesh.faceCount, mesh.outerFaceCount, mesh.cavityFaceCount]).toEqual([6, 6, 0]);

    // Literal one-cell cube oracle: -.0625..+.0625 m, outward faces, open AO.
    // Same established corner/diagonal convention as the S45 literal cube, not mesher output.
    const positions = new Float32Array([
      0,0,0, 0,0,1, 0,1,1, 0,1,0, 1,0,0, 1,1,0, 1,1,1, 1,0,1,
      0,0,0, 1,0,0, 1,0,1, 0,0,1, 0,1,0, 0,1,1, 1,1,1, 1,1,0,
      0,0,0, 0,1,0, 1,1,0, 1,0,0, 0,0,1, 1,0,1, 1,1,1, 0,1,1
    ].map(value => value * .125 - .0625));
    const normals = new Float32Array([[-1,0,0], [1,0,0], [0,-1,0], [0,1,0], [0,0,-1], [0,0,1]]
      .flatMap(normal => Array.from({ length: 4 }, () => normal).flat()));
    const indices = new Uint16Array([0,1,2,0,2,3, 7,4,5,7,5,6, 11,8,9,11,9,10,
      12,13,14,12,14,15, 19,16,17,19,17,18, 20,21,22,20,22,23]);
    expect(mesh.positions).toEqual(positions);
    expect(mesh.normals).toEqual(normals);
    expect(mesh.indices).toEqual(indices);
    expect(mesh.colors).toEqual(new Float32Array(72).fill(1));
  });
});
