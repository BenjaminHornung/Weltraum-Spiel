import { describe, expect, it } from "vitest";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { createFactoryAssetProjection, getFactoryAssetSource } from "../../../src/factory/presentation/factoryAssets";
import { sampleMachinePose } from "../../../src/factory/presentation/machinePose";
import { backendRevision, canonicalSignature, validateMeshArtifact } from "../../../src/presentation";
import { ThreeRenderBackend } from "../../../src/render/three/backend/threeRenderBackend";
import { createHvpListeners } from "../../../src/hestia-prototype/runtime/listeners";

const catalog = createFp02Fixture("cargo").catalog;
const projection = (id = "B06") => createFactoryAssetProjection(catalog.devices.find(device => device.sourceId === id)!, getFactoryAssetSource(id));

describe("FP06 W05 source-bound factory presentation", () => {
  it("T021 loads real mesh bounds in meters and source-bound 1m ports", () => {
    for (const [id, width, depth, height] of [["B06", 3, 2, 2.5], ["B07", 4, 3, 3]] as const) {
      const asset = projection(id);
      expect(asset.bounds.max.x - asset.bounds.min.x).toBe(width);
      expect(asset.bounds.max.z - asset.bounds.min.z).toBe(depth);
      expect(asset.bounds.max.y - asset.bounds.min.y).toBe(height);
      expect(asset.parts.length).toBeGreaterThan(3);
      for (const part of asset.parts) expect(validateMeshArtifact(part.artifact).valid).toBe(true);
      const ports = asset.ports.filter(port => port.binding === "source-solid");
      expect(ports.map(port => port.centerM)).toEqual([[-width / 2, 1, 0], [width / 2, 1, 0]]);
      expect(ports.map(port => port.normal)).toEqual([[-1, 0, 0], [1, 0, 0]]);
      expect(ports.map(port => port.sizeM)).toEqual([[0.75, 0.75], [0.75, 0.75]]);
    }
  });

  it("T022 WAIT_POWER holds confirmed work and leaves real input/products unchanged", () => {
    const asset = projection();
    const resourceState = createFp02Fixture("cargo").resourceState;
    const before = JSON.stringify(resourceState);
    const read = { projection: asset, status: "RUNNING", confirmedWorkMs: 15_000,
      presentPartIds: asset.parts.map(part => part.partId), damageRevision: 0, resourceState };
    const running = sampleMachinePose(read, 1);
    expect(running.partPoses.some(part => part.translationM.some(value => value !== 0))).toBe(true);
    const stopped = { ...read, status: "WAIT_POWER" };
    const first = sampleMachinePose(stopped, 1);
    expect(first.status).toBe("WAIT_POWER");
    for (const time of [2, 50, 1_000]) expect(sampleMachinePose(stopped, time)).toEqual(first);
    expect(stopped.confirmedWorkMs).toBe(15_000);
    expect(JSON.stringify(resourceState)).toBe(before);
  });

  it("T023 removed tool stays absent across subsequent damage samples", () => {
    const asset = projection();
    const remaining = asset.parts.filter(part => part.role !== "tool").map(part => part.partId);
    expect(remaining.length).toBeGreaterThan(0);
    const read = { projection: asset, status: "FAULT", confirmedWorkMs: 15_000, presentPartIds: remaining, damageRevision: 1 };
    for (const time of [1, 2, 1_000]) {
      expect(sampleMachinePose(read, time).partPoses.map(part => part.partId)).toEqual(remaining);
    }
  });

  it("T024 100 real Three backend mounts/disposals return owned resources to baseline", () => {
    const asset = projection();
    const listeners = createHvpListeners();
    let allocated = 0;
    for (let cycle = 0; cycle < 100; cycle += 1) {
      const backend = new ThreeRenderBackend({ canvas: {} as HTMLCanvasElement,
        rendererFactory: () => ({ setPixelRatio() {}, setSize() {}, render() {}, dispose() {} }) });
      const revision = backendRevision(0);
      expect(backend.dispatch({ kind: "InitializeBackend", backendRevision: revision }).status).toBe("Accepted");
      for (const part of asset.parts) {
        expect(backend.dispatch({ kind: "UpsertMeshArtifact", backendRevision: revision,
          artifact: part.artifact, materialProfiles: part.materialProfiles }).status).toBe("Accepted");
      }
      allocated += backend.readDiagnostics().geometryAllocations;
      expect(backend.dispatch({ kind: "DisposeBackend", backendRevision: revision }).status).toBe("Accepted");
      const result = backend.readDiagnostics();
      expect(result.geometryAllocations - result.geometryDisposals).toBe(0);
      expect(result.materialAllocations - result.materialDisposals).toBe(0);
      expect(result.activeRepresentations).toBe(0);
      expect(result.ownedCpuBytes).toBe(0);
      expect(listeners.size).toBe(0);
    }
    expect(allocated).toBeGreaterThan(0);
    listeners.dispose();
  });

  it("rejects drifted definition and native source bindings", () => {
    const definition = catalog.devices.find(device => device.sourceId === "B06")!;
    const source = getFactoryAssetSource("B06");
    expect(() => createFactoryAssetProjection({ ...definition, digest: "stale" }, source)).toThrow("definition binding");
    expect(() => createFactoryAssetProjection(definition, { ...source, revision: 2 })).toThrow("source binding");
    expect(() => getFactoryAssetSource("unapproved" )).toThrow("Unknown factory asset");
  });

  it("retains explicit paid foot contacts, tool sweeps and separate250/125mm grids", () => {
    for (const id of ["B06", "B07"]) {
      const asset = projection(id), source = asset.source;
      expect(source.authoringGridM).toBe(0.25);
      expect(source.terrainCellM).toBe(0.125);
      expect(source.supportPatchesM).toHaveLength(4);
      for (const foot of source.supportPatchesM) {
        expect(foot.centerM[1]).toBe(0);
        expect(foot.normal).toEqual([0, -1, 0]);
        expect(foot.sizeM).toEqual([0.5, 0.5]);
        expect(asset.parts.some(part => part.partId === foot.partId)).toBe(true);
      }
      expect(source.joints).toHaveLength(4);
      expect(source.joints.find(joint => joint.partId === asset.parts.find(part => part.role === "tool")!.partId)!.sweepBoundsM.min[1]).toBeGreaterThan(1);
      expect(source.serviceBoundsM.max[2]! - source.serviceBoundsM.min[2]!).toBe(1);
      expect(asset.ports.filter(port => port.role === "PowerConsumer").every(port => port.binding === "authoring-only")).toBe(true);
    }
  });

  it("isolates real instance keys while repeated poses leave mesh bytes unchanged", () => {
    const definition = catalog.devices.find(device => device.sourceId === "B06")!;
    const source = getFactoryAssetSource("B06");
    const first = createFactoryAssetProjection({ ...definition, instanceId: "first_instance" }, source);
    const second = createFactoryAssetProjection({ ...definition, instanceId: "second_instance" }, source);
    const keys = new Set(first.parts.map(part => part.artifact.representationKey));
    expect(second.parts.every(part => !keys.has(part.artifact.representationKey))).toBe(true);
    const before = canonicalSignature(first.parts.map(part => part.artifact));
    const read = { projection: first, status: "RUNNING", confirmedWorkMs: 0, presentPartIds: first.parts.map(part => part.partId), damageRevision: 0 };
    for (const work of [0, 5_000, 7_000, 15_000, 24_000, 30_000]) sampleMachinePose({ ...read, confirmedWorkMs: work }, work);
    expect(canonicalSignature(first.parts.map(part => part.artifact))).toBe(before);
  });

  it("holds unknown states and rejects noncanonical pose work", () => {
    const asset = projection();
    const read = { projection: asset, status: "new_unknown_state", confirmedWorkMs: 15_000, presentPartIds: asset.parts.map(part => part.partId), damageRevision: 0 };
    expect(sampleMachinePose(read, 1)).toMatchObject({ status: "UNKNOWN", paused: true });
    for (const work of [-1, 0.5, NaN, Infinity]) expect(() => sampleMachinePose({ ...read, confirmedWorkMs: work }, 1)).toThrow("Invalid machine");
    expect(() => sampleMachinePose({ ...read, presentPartIds: ["deleted_unknown_part"] }, 1)).toThrow("part read view");
  });

  it("loads four original power-kit S0 sources without product or fluid ports", () => {
    for (const id of ["fp02.device.wind_pack_6kw", "fp02.device.pv_pack_2kwp", "fp02.device.battery_4kwh", "fp02.device.distribution_40kw"]) {
      const definition = catalog.items.find(item => item.sourceId === id)!;
      const asset = createFactoryAssetProjection(definition, getFactoryAssetSource(id));
      expect(asset.kind).toBe("S0-proxy");
      expect(asset.parts.length).toBeGreaterThan(2);
      for (const part of asset.parts) expect(validateMeshArtifact(part.artifact).valid).toBe(true);
      expect(asset.ports.every(port => port.binding === "authoring-only")).toBe(true);
      const pose = sampleMachinePose({ projection: asset, status: "IDLE", confirmedWorkMs: 0, presentPartIds: asset.parts.map(part => part.partId), damageRevision: 0 }, 1);
      expect(pose.partPoses.every(part => part.translationM.every(value => value === 0))).toBe(true);
    }
  });

  for (const id of ["B06", "fp02.device.wind_pack_6kw"]) it(`R1 ${id} connects every paid ground shoe to a raised structural load path`, () => {
    const source = getFactoryAssetSource(id);
    const nodes = source.parts.filter(part => ["support", "structure"].includes(part.role)).flatMap(part =>
      part.boxes.map(box => ({ role: part.role, box, min: box.centerM.map((value, axis) => value - box.sizeM[axis]! / 2),
        max: box.centerM.map((value, axis) => value + box.sizeM[axis]! / 2) })));
    const connected = (a: typeof nodes[number], b: typeof nodes[number]) => {
      const overlaps = a.min.map((value, axis) => Math.min(a.max[axis]!, b.max[axis]!) - Math.max(value, b.min[axis]!));
      return overlaps.every(value => value >= 0) && overlaps.filter(value => value === 0).length <= 1;
    };
    for (const foot of nodes.filter(node => node.role === "support")) {
      expect(foot.min[1]).toBe(0);
      const seen = new Set([foot]), pending = [foot];
      while (pending.length) {
        const current = pending.pop()!;
        for (const node of nodes) if (!seen.has(node) && connected(current, node)) { seen.add(node); pending.push(node); }
      }
      expect([...seen].some(node => node.role === "structure" && node.box.centerM[1]! > source.dimensionsM[1]! / 3)).toBe(true);
    }
  });

  it("R2 infeed, clamp and outfeed have bounded confirmed-work motion and frozen WAIT_POWER poses", () => {
    for (const [id, samples] of [["B06", [2_500, 6_000, 28_500]], ["B07", [3_000, 8_000, 37_500]]] as const) {
      const asset = projection(id);
      const base = { projection: asset, status: "RUNNING", confirmedWorkMs: 0, presentPartIds: asset.parts.map(part => part.partId), damageRevision: 0 };
      for (const [index, role] of ["infeed", "clamp", "outfeed"].entries()) {
        const phaseRead = { ...base, confirmedWorkMs: samples[index]! };
        const pose = sampleMachinePose(phaseRead, 1);
        const phaseParts = asset.parts.filter(part => part.role === role);
        expect(phaseParts.length).toBeGreaterThan(0);
        expect(pose.partPoses.some(part => phaseParts.some(source => source.partId === part.partId) && part.translationM.some(value => value !== 0))).toBe(true);
        const held = { ...phaseRead, status: "WAIT_POWER" };
        expect(sampleMachinePose(held, 100_000)).toEqual(sampleMachinePose(held, 1));
      }
      for (const confirmedWorkMs of [0, ...samples, ...(asset.source.phaseMotionProfile!.phaseEndsMs)]) {
        const pose = sampleMachinePose({ ...base, confirmedWorkMs }, 1);
        for (const part of asset.parts) {
          const offset = pose.partPoses.find(value => value.partId === part.partId)!.translationM;
          for (const [axis, coordinate] of ["x", "y", "z"].entries()) {
            expect(part.artifact.bounds.min[coordinate as "x" | "y" | "z"] + offset[axis]!).toBeGreaterThanOrEqual(asset.bounds.min[coordinate as "x" | "y" | "z"]);
            expect(part.artifact.bounds.max[coordinate as "x" | "y" | "z"] + offset[axis]!).toBeLessThanOrEqual(asset.bounds.max[coordinate as "x" | "y" | "z"]);
          }
        }
      }
      expect(asset.source.phaseMotionProfile!.version).toBe(1);
    }
  });

  it("R1 Former bed has a continuous contact path to its raised corner posts", () => {
    const source = getFactoryAssetSource("B07");
    const nodes = source.parts.filter(part => ["structure", "work-bed"].includes(part.role)).flatMap(part => part.boxes.map(box => ({
      role: part.role, box, min: box.centerM.map((value, axis) => value - box.sizeM[axis]! / 2), max: box.centerM.map((value, axis) => value + box.sizeM[axis]! / 2)
    })));
    const seen = new Set(nodes.filter(node => node.role === "work-bed")), pending = [...seen];
    while (pending.length) {
      const current = pending.pop()!;
      for (const node of nodes) {
        const overlaps = current.min.map((value, axis) => Math.min(current.max[axis]!, node.max[axis]!) - Math.max(value, node.min[axis]!));
        if (!seen.has(node) && overlaps.every(value => value >= 0) && overlaps.filter(value => value === 0).length <= 1) { seen.add(node); pending.push(node); }
      }
    }
    expect([...seen].some(node => node.role === "structure" && node.box.centerM[1]! > 1.5)).toBe(true);
  });

  it("R1 Former tool keeps a positive-area actuator contact throughout its half-meter stroke", () => {
    const asset = projection("B07");
    const actuators = asset.source.parts.filter(part => part.role === "actuator").flatMap(part => part.boxes);
    for (const work of [10_000, 15_000, 20_000, 25_000, 30_000]) {
      const pose = sampleMachinePose({ projection: asset, status: "RUNNING", confirmedWorkMs: work,
        presentPartIds: asset.parts.map(part => part.partId), damageRevision: 0 }, 1);
      const tools = asset.source.parts.filter(part => part.role === "tool").flatMap(part => {
        const offset = pose.partPoses.find(value => value.partId === part.partId)!.translationM;
        return part.boxes.map(box => ({ ...box, centerM: box.centerM.map((value, axis) => value + offset[axis]!) }));
      });
      for (const actuator of actuators) expect(tools.some(tool => {
        const overlaps = tool.centerM.map((value, axis) => Math.min(value + tool.sizeM[axis]! / 2, actuator.centerM[axis]! + actuator.sizeM[axis]! / 2)
          - Math.max(value - tool.sizeM[axis]! / 2, actuator.centerM[axis]! - actuator.sizeM[axis]! / 2));
        return overlaps.every(value => value >= 0) && overlaps.filter(value => value === 0).length <= 1;
      })).toBe(true);
    }
  });

  it("R3 Wind and PV expose source-required visible authoring-only power-out sockets", () => {
    for (const id of ["fp02.device.wind_pack_6kw", "fp02.device.pv_pack_2kwp"]) {
      const source = getFactoryAssetSource(id);
      expect(source.ports.filter(port => port.role === "PowerProducer" && port.binding === "authoring-only")).toHaveLength(1);
      expect(source.parts.some(part => part.role === "power-marker" && part.boxes.length > 0)).toBe(true);
    }
  });

  it("R3 electrical markers bind an exposed socket face with clear outward access", () => {
    for (const id of ["fp02.device.wind_pack_6kw", "fp02.device.pv_pack_2kwp"]) {
      const source = getFactoryAssetSource(id), port = source.ports.find(value => value.role === "PowerProducer")!;
      const socket = source.parts.find(part => part.role === "power-marker")!.boxes[0]!;
      expect(port.normal).toEqual([0, 0, 1]);
      expect.soft(port.centerM).toEqual([socket.centerM[0], socket.centerM[1], socket.centerM[2]! + socket.sizeM[2]! / 2]);
      const outward = port.centerM.map((value, axis) => value + port.normal[axis]! * 0.001);
      const embedded = source.parts.filter(part => part.role !== "power-marker").flatMap(part => part.boxes).some(box =>
        outward.every((value, axis) => value >= box.centerM[axis]! - box.sizeM[axis]! / 2 && value <= box.centerM[axis]! + box.sizeM[axis]! / 2));
      expect.soft(embedded).toBe(false);
    }
  });
});
