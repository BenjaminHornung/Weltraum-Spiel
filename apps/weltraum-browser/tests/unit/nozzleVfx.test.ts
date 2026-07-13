import { readFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import type { ActuatorTelemetry } from "../../src/core";
import { inactiveControlModeEffect, orientationFromForward, vec3 } from "../../src/core";
import { selectCompatibleRcsNozzles, worldVectorToBody } from "../../src/render/three/nozzleVfx";
import {
  createDemoScoutShipVisual,
  createProceduralShipVisual,
  demoScoutGlbAppliedScale,
  demoScoutGlbDescriptor,
  demoScoutRcsNozzleRegistry,
  proceduralScoutDescriptor,
  resolveGlbNozzleBindings,
  type ShipThrusterNozzleDescriptor
} from "../../src/render/three/shipVisual";

const identity = { x: 0, y: 0, z: 0, w: 1 } as const;
const demoScoutMainNozzle = demoScoutGlbDescriptor.mainEngineNozzle;
if (!demoScoutMainNozzle) {
  throw new Error("Demo Scout test manifest is missing its directional main nozzle.");
}
const demoScoutDirectionalNozzles = [demoScoutMainNozzle, ...demoScoutRcsNozzleRegistry] as const;

const selectionCandidates = demoScoutRcsNozzleRegistry.map((nozzle) => ({
  id: nozzle.id,
  localPosition: nozzle.fallbackLocalPosition,
  localForceDirection: nozzle.localForceDirection
}));

const select = (input: Partial<Parameters<typeof selectCompatibleRcsNozzles>[1]> = {}) =>
  selectCompatibleRcsNozzles(selectionCandidates, {
    ownerOrientation: identity,
    rcsTranslationAccelerationWorld: vec3(),
    angularAccelerationBody: vec3(),
    rcsTranslationActive: false,
    rcsRotationActive: false,
    sasCorrectionActive: false,
    ...input
  });

const activeIds = (selection: ReturnType<typeof select>) =>
  selection.compatibility.filter((candidate) => candidate.visible).map((candidate) => candidate.id);

const telemetry = (overrides: Partial<ActuatorTelemetry> = {}): ActuatorTelemetry => ({
  mainThrustActive: false,
  rcsTranslationActive: false,
  rcsRotationActive: false,
  sasCorrectionActive: false,
  controlModeEffect: inactiveControlModeEffect("Cruise"),
  lastAppliedMainAcceleration: vec3(),
  lastAppliedRcsTranslationAcceleration: vec3(),
  lastAppliedAcceleration: vec3(),
  lastAppliedAngularAcceleration: vec3(),
  ...overrides
});

const glbPositionFor = (browserPosition: { readonly x: number; readonly y: number; readonly z: number }) => ({
  x: browserPosition.z / demoScoutGlbAppliedScale,
  y: browserPosition.y / demoScoutGlbAppliedScale,
  z: -browserPosition.x / demoScoutGlbAppliedScale
});

const addNode = (scene: THREE.Group, name: string, browserPosition: { readonly x: number; readonly y: number; readonly z: number }) => {
  const node = new THREE.Group();
  node.name = name;
  const position = glbPositionFor(browserPosition);
  node.position.set(position.x, position.y, position.z);
  scene.add(node);
  return node;
};

const completeNozzleScene = (nozzles: readonly ShipThrusterNozzleDescriptor[]) => {
  const scene = new THREE.Group();
  for (const nozzle of nozzles) {
    const expectedName = nozzle.expectedNodeNames[0];
    if (!expectedName) {
      throw new Error(`Test nozzle ${nozzle.id} has no expected node name.`);
    }
    addNode(scene, expectedName, nozzle.fallbackLocalPosition);
  }
  return scene;
};

describe("Demo Scout nozzle VFX contracts", () => {
  it("defines twenty unique authored RCS nozzles with normalized opposite force and exhaust directions", () => {
    expect(demoScoutRcsNozzleRegistry).toHaveLength(20);
    expect(new Set(demoScoutRcsNozzleRegistry.map((nozzle) => nozzle.id)).size).toBe(20);
    expect(new Set(demoScoutRcsNozzleRegistry.flatMap((nozzle) => nozzle.expectedNodeNames)).size).toBe(20);
    for (const nozzle of demoScoutRcsNozzleRegistry) {
      expect(nozzle.expectedNodeNames).toHaveLength(1);
      expect(nozzle.expectedNodeNames[0]).toMatch(/^RCS_Nozzle_/);
      expect(Math.hypot(nozzle.localForceDirection.x, nozzle.localForceDirection.y, nozzle.localForceDirection.z)).toBeCloseTo(1, 10);
      expect(Math.hypot(nozzle.localExhaustDirection.x, nozzle.localExhaustDirection.y, nozzle.localExhaustDirection.z)).toBeCloseTo(1, 10);
      expect(
        nozzle.localForceDirection.x * nozzle.localExhaustDirection.x +
        nozzle.localForceDirection.y * nozzle.localExhaustDirection.y +
        nozzle.localForceDirection.z * nozzle.localExhaustDirection.z
      ).toBeCloseTo(-1, 10);
    }
  });

  it("keeps the procedural fallback as exactly six position-only legacy marker bindings", () => {
    const expectedIds = [
      "rcs-front-left",
      "rcs-front-right",
      "rcs-aft-left",
      "rcs-aft-right",
      "rcs-dorsal",
      "rcs-ventral"
    ];
    expect(proceduralScoutDescriptor.mainEngineNozzle).toBeNull();
    expect(proceduralScoutDescriptor.rcsNozzles).toEqual([]);

    const visual = createProceduralShipVisual();
    const snapshot = visual.getSnapshot();
    expect(snapshot.vfx.mainNozzleBinding).toBeNull();
    expect(visual.group.getObjectByName("main-thruster-vfx")?.rotation.z).toBeCloseTo(Math.PI / 2, 10);
    expect(snapshot.nozzleBindings.map((binding) => binding.id)).toEqual(expectedIds);
    expect(snapshot.vfx.rcsPuffs.map((puff) => puff.id)).toEqual(expectedIds);
    expect(snapshot.vfx.bindingKindCounts).toEqual({ DirectionalNozzle: 0, LegacyMarkerFallback: 6 });
    expect(snapshot.vfx.nozzleSourceCounts).toEqual({ GLBNode: 0, ManifestNozzleFallback: 0 });
    for (const binding of snapshot.nozzleBindings) {
      expect(binding).toEqual(expect.objectContaining({
        kind: "LegacyMarkerFallback",
        role: "Rcs",
        source: "LegacyMarkerFallback",
        sourceObjectName: null
      }));
      expect(binding).not.toHaveProperty("localForceDirection");
      expect(binding).not.toHaveProperty("localExhaustDirection");
      expect(binding).not.toHaveProperty("diagnostic");
    }
    for (const puff of snapshot.vfx.rcsPuffs) {
      expect(puff.kind).toBe("LegacyMarkerFallback");
      expect(puff.visible).toBe(false);
      expect(puff).not.toHaveProperty("translationScore");
      expect(puff).not.toHaveProperty("torqueScore");
      expect(puff).not.toHaveProperty("translationCompatible");
      expect(puff).not.toHaveProperty("torqueCompatible");
    }
  });

  it("uses the current owner orientation to transform world RCS translation into body-local selection", () => {
    const ownerOrientation = orientationFromForward(vec3(0, 0, 1));
    const bodyVector = worldVectorToBody(vec3(0, 0, 2), ownerOrientation);
    expect(bodyVector.x).toBeCloseTo(2, 10);
    expect(bodyVector.y).toBeCloseTo(0, 10);
    expect(bodyVector.z).toBeCloseTo(0, 10);

    const selection = select({
      ownerOrientation,
      rcsTranslationAccelerationWorld: vec3(0, 0, 2),
      rcsTranslationActive: true
    });
    expect(activeIds(selection)).toEqual([
      "rcs-front-left-nozzle-back",
      "rcs-front-right-nozzle-back",
      "rcs-aft-left-nozzle-back",
      "rcs-aft-right-nozzle-back"
    ]);
  });

  it("selects only force-compatible nozzles for pure body-local translation", () => {
    const selection = select({
      rcsTranslationAccelerationWorld: vec3(0, 3, 0),
      rcsTranslationActive: true
    });
    expect(activeIds(selection)).toEqual([
      "rcs-front-left-nozzle-down",
      "rcs-front-right-nozzle-down",
      "rcs-aft-left-nozzle-down",
      "rcs-aft-right-nozzle-down"
    ]);
    expect(selection.compatibility.filter((candidate) => candidate.visible).every((candidate) => candidate.translationScore > 0)).toBe(true);
  });

  // Independent oracle: for each fixed manifest position r and force F, compute
  // r x F by hand. Browser X is roll, Y is yaw, and Z is pitch.
  it.each([
    ["positive X roll", vec3(1, 0, 0), [
      "rcs-front-left-nozzle-down",
      "rcs-front-left-nozzle-left",
      "rcs-front-right-nozzle-up",
      "rcs-aft-left-nozzle-down",
      "rcs-aft-right-nozzle-right",
      "rcs-aft-right-nozzle-up"
    ]],
    ["negative X roll", vec3(-1, 0, 0), [
      "rcs-front-left-nozzle-up",
      "rcs-front-right-nozzle-down",
      "rcs-front-right-nozzle-right",
      "rcs-aft-left-nozzle-left",
      "rcs-aft-left-nozzle-up",
      "rcs-aft-right-nozzle-down"
    ]],
    ["positive Y yaw", vec3(0, 1, 0), [
      "rcs-front-left-nozzle-forward",
      "rcs-front-right-nozzle-back",
      "rcs-front-right-nozzle-right",
      "rcs-aft-left-nozzle-forward",
      "rcs-aft-left-nozzle-left",
      "rcs-aft-right-nozzle-back"
    ]],
    ["negative Y yaw", vec3(0, -1, 0), [
      "rcs-front-left-nozzle-back",
      "rcs-front-left-nozzle-left",
      "rcs-front-right-nozzle-forward",
      "rcs-aft-left-nozzle-back",
      "rcs-aft-right-nozzle-forward",
      "rcs-aft-right-nozzle-right"
    ]],
    ["positive Z pitch", vec3(0, 0, 1), [
      "rcs-front-left-nozzle-down",
      "rcs-front-left-nozzle-forward",
      "rcs-front-right-nozzle-down",
      "rcs-front-right-nozzle-forward",
      "rcs-aft-left-nozzle-back",
      "rcs-aft-left-nozzle-up",
      "rcs-aft-right-nozzle-back",
      "rcs-aft-right-nozzle-up"
    ]],
    ["negative Z pitch", vec3(0, 0, -1), [
      "rcs-front-left-nozzle-back",
      "rcs-front-left-nozzle-up",
      "rcs-front-right-nozzle-back",
      "rcs-front-right-nozzle-up",
      "rcs-aft-left-nozzle-down",
      "rcs-aft-left-nozzle-forward",
      "rcs-aft-right-nozzle-down",
      "rcs-aft-right-nozzle-forward"
    ]]
  ] as const)("selects the exact authored nozzle set for %s", (_label, angularAccelerationBody, expectedIds) => {
    const selection = select({ angularAccelerationBody, rcsRotationActive: true });
    expect(activeIds(selection)).toEqual(expectedIds);
    expect(selection.compatibility.filter((candidate) => candidate.visible).every((candidate) =>
      candidate.torqueCompatible && candidate.torqueScore > 0 && !candidate.translationCompatible
    )).toBe(true);
  });

  it("uses SAS angular acceleration as already body-local regardless of owner orientation", () => {
    const identitySelection = select({ angularAccelerationBody: vec3(1, 0, 0), sasCorrectionActive: true });
    const rotatedSelection = select({
      ownerOrientation: orientationFromForward(vec3(0, 0, 1)),
      angularAccelerationBody: vec3(1, 0, 0),
      sasCorrectionActive: true
    });
    expect(activeIds(rotatedSelection)).toEqual(activeIds(identitySelection));
  });

  it("keeps RCS selection independent from simultaneous main thrust and shows zero puffs while idle", () => {
    const visual = createProceduralShipVisual();
    visual.updateVfx(telemetry({
      rcsTranslationActive: true,
      lastAppliedRcsTranslationAcceleration: vec3(0, 2, 0),
      lastAppliedAcceleration: vec3(0, 2, 0)
    }), identity);
    const rcsOnly = visual.getSnapshot();
    const rcsOnlyIds = rcsOnly.vfx.rcsPuffs.filter((puff) => puff.visible).map((puff) => puff.id);
    expect(rcsOnly.vfx.visibleRcsPuffCount).toBe(6);
    expect(rcsOnly.vfx.rcsTranslationVisible).toBe(true);
    expect(rcsOnly.vfx.rcsRotationVisible).toBe(false);
    expect(rcsOnly.vfx.sasCorrectionVisible).toBe(false);

    visual.updateVfx(telemetry({
      mainThrustActive: true,
      rcsTranslationActive: true,
      lastAppliedMainAcceleration: vec3(8, 0, 0),
      lastAppliedRcsTranslationAcceleration: vec3(0, 2, 0),
      lastAppliedAcceleration: vec3(8, 2, 0)
    }), identity);
    const simultaneous = visual.getSnapshot();
    expect(simultaneous.vfx.rcsPuffs.filter((puff) => puff.visible).map((puff) => puff.id)).toEqual(rcsOnlyIds);
    expect(simultaneous.vfx.mainThrustVisible).toBe(true);
    expect(simultaneous.vfx.mainThrustScale).toBeGreaterThan(1);

    visual.updateVfx(telemetry(), identity);
    const idle = visual.getSnapshot();
    expect(idle.vfx.visibleRcsPuffCount).toBe(0);
    expect(idle.vfx.rcsPuffs.every((puff) => !puff.visible)).toBe(true);
    expect(idle.vfx.rcsTranslationVisible).toBe(false);
    expect(idle.vfx.rcsRotationVisible).toBe(false);
    expect(idle.vfx.sasCorrectionVisible).toBe(false);
  });

  it("does not claim category visibility when manual RCS and SAS cancel to zero angular acceleration", () => {
    const visual = createProceduralShipVisual(demoScoutGlbDescriptor);
    visual.updateVfx(telemetry({
      rcsRotationActive: true,
      sasCorrectionActive: true,
      lastAppliedAngularAcceleration: vec3()
    }), identity);

    const snapshot = visual.getSnapshot();
    expect(snapshot.vfx.visibleRcsPuffCount).toBe(0);
    expect(snapshot.vfx.rcsTranslationVisible).toBe(false);
    expect(snapshot.vfx.rcsRotationVisible).toBe(false);
    expect(snapshot.vfx.sasCorrectionVisible).toBe(false);
    expect(snapshot.vfx.rcsPuffs.every((puff) => !puff.visible)).toBe(true);
  });

  it("resizes the real puff pool 6 to 20 to 6 without stale snapshots and disposes removed meshes", async () => {
    let loadAttempt = 0;
    const visual = createDemoScoutShipVisual({
      autoLoad: false,
      loadGltf: async () => {
        loadAttempt += 1;
        if (loadAttempt === 1) {
          return { scene: completeNozzleScene(demoScoutDirectionalNozzles) };
        }
        throw new Error("deterministic reload failure");
      }
    });
    const legacyIds = proceduralScoutDescriptor.rcsMarkers.map((marker) => marker.id);
    expect(visual.getSnapshot().vfx.bindingKindCounts).toEqual({ DirectionalNozzle: 0, LegacyMarkerFallback: 6 });
    expect(visual.getSnapshot().vfx.rcsPuffs).toHaveLength(6);

    visual.updateVfx(telemetry({
      rcsTranslationActive: true,
      lastAppliedRcsTranslationAcceleration: vec3(0, 1, 0),
      lastAppliedAcceleration: vec3(0, 1, 0)
    }), identity);
    expect(visual.getSnapshot().vfx.visibleRcsPuffCount).toBe(6);

    await visual.reload();
    const loaded = visual.getSnapshot();
    expect(loaded.visualSource.state).toBe("GLBLoaded");
    expect(loaded.vfx.bindingKindCounts).toEqual({ DirectionalNozzle: 21, LegacyMarkerFallback: 0 });
    expect(loaded.vfx.rcsPuffs).toHaveLength(20);
    expect(loaded.vfx.visibleRcsPuffCount).toBe(0);
    expect(loaded.vfx.rcsPuffs.every((puff) => puff.kind === "DirectionalNozzle")).toBe(true);

    visual.updateVfx(telemetry({
      rcsRotationActive: true,
      lastAppliedAngularAcceleration: vec3(1, 0, 0)
    }), identity);
    expect(visual.getSnapshot().vfx.visibleRcsPuffCount).toBeGreaterThan(0);

    const vfxGroup = visual.group.getObjectByName("ship-visual-vfx");
    expect(vfxGroup).toBeInstanceOf(THREE.Group);
    const directionalMeshes = vfxGroup!.children.filter((child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.name !== "main-thruster-vfx"
    );
    expect(directionalMeshes).toHaveLength(20);
    const removedMeshes = directionalMeshes.slice(6);
    let geometryDisposals = 0;
    let materialDisposals = 0;
    for (const mesh of removedMeshes) {
      mesh.geometry.addEventListener("dispose", () => {
        geometryDisposals += 1;
      });
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        material.addEventListener("dispose", () => {
          materialDisposals += 1;
        });
      }
    }

    await visual.reload();
    const fallback = visual.getSnapshot();
    expect(fallback.visualSource.state).toBe("GLBFailedFallback");
    expect(fallback.vfx.bindingKindCounts).toEqual({ DirectionalNozzle: 0, LegacyMarkerFallback: 6 });
    expect(fallback.nozzleBindings.map((binding) => binding.id)).toEqual(legacyIds);
    expect(fallback.vfx.rcsPuffs.map((puff) => puff.id)).toEqual(legacyIds);
    expect(fallback.vfx.visibleRcsPuffCount).toBe(0);
    expect(fallback.vfx.rcsPuffs.every((puff) => !puff.visible && puff.kind === "LegacyMarkerFallback")).toBe(true);
    const fallbackMeshes = vfxGroup!.children.filter((child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.name !== "main-thruster-vfx"
    );
    expect(fallbackMeshes).toHaveLength(6);
    expect(fallbackMeshes.map((mesh) => mesh.name)).toEqual(legacyIds.map((id) => `${id}-vfx`));
    expect(fallbackMeshes.every((mesh) => !mesh.visible)).toBe(true);
    expect(removedMeshes.every((mesh) => mesh.parent === null)).toBe(true);
    expect(geometryDisposals).toBe(14);
    expect(materialDisposals).toBe(14);
  });

  it("resolves a complete authored registry to unique GLB nodes at authored positions", () => {
    const nozzles = demoScoutDirectionalNozzles;
    const bindings = resolveGlbNozzleBindings(completeNozzleScene(nozzles), nozzles, demoScoutGlbAppliedScale);
    expect(bindings).toHaveLength(21);
    expect(bindings.every((binding) => binding.source === "GLBNode" && binding.diagnostic.status === "Resolved")).toBe(true);
    expect(new Set(bindings.map((binding) => binding.sourceObjectName)).size).toBe(21);
    for (const [index, binding] of bindings.entries()) {
      const descriptor = nozzles[index];
      expect(descriptor).toBeTruthy();
      expect(binding.localPosition.x).toBeCloseTo(descriptor!.fallbackLocalPosition.x, 4);
      expect(binding.localPosition.y).toBeCloseTo(descriptor!.fallbackLocalPosition.y, 4);
      expect(binding.localPosition.z).toBeCloseTo(descriptor!.fallbackLocalPosition.z, 4);
    }
  });

  it("resolves the checked-in Demo Scout GLB through the real Three.js loader", async () => {
    const bytes = await readFile(path.resolve(process.cwd(), "public/ships/demo_scout_mk1.glb"));
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const gltf = await new GLTFLoader().parseAsync(arrayBuffer, "");
    const nozzles = demoScoutDirectionalNozzles;
    const bindings = resolveGlbNozzleBindings(gltf.scene, nozzles, demoScoutGlbAppliedScale);

    expect(bindings).toHaveLength(21);
    expect(bindings.every((binding) => binding.source === "GLBNode" && binding.diagnostic.status === "Resolved")).toBe(true);
    expect(bindings.filter((binding) => binding.role === "Rcs")).toHaveLength(20);
    expect(new Set(bindings.map((binding) => binding.sourceObjectName)).size).toBe(21);
  });

  it("falls back only the missing or duplicate logical nozzle with deterministic diagnostics", () => {
    const [missing, duplicate, intact] = demoScoutRcsNozzleRegistry;
    expect(missing && duplicate && intact).toBeTruthy();
    const scene = new THREE.Group();
    const duplicateName = duplicate!.expectedNodeNames[0]!;
    const firstDuplicate = addNode(scene, duplicateName, duplicate!.fallbackLocalPosition);
    firstDuplicate.userData.name = duplicateName;
    const loaderRenamedDuplicate = addNode(scene, `${duplicateName}_1`, duplicate!.fallbackLocalPosition);
    loaderRenamedDuplicate.userData.name = duplicateName;
    addNode(scene, intact!.expectedNodeNames[0]!, intact!.fallbackLocalPosition);

    const bindings = resolveGlbNozzleBindings(scene, [missing!, duplicate!, intact!], demoScoutGlbAppliedScale);
    expect(bindings[0]).toEqual(expect.objectContaining({ id: missing!.id, source: "ManifestNozzleFallback" }));
    expect(bindings[0]?.diagnostic.status).toBe("MissingNode");
    expect(bindings[1]).toEqual(expect.objectContaining({ id: duplicate!.id, source: "ManifestNozzleFallback" }));
    expect(bindings[1]?.diagnostic.status).toBe("DuplicateNode");
    expect(bindings[2]).toEqual(expect.objectContaining({ id: intact!.id, source: "GLBNode" }));
    expect(bindings[2]?.diagnostic.status).toBe("Resolved");
  });

  it("falls back only the nozzle whose GLB world transform produces a non-finite position", () => {
    const nozzle = demoScoutRcsNozzleRegistry[0]!;
    const scene = new THREE.Group();
    const node = addNode(scene, nozzle.expectedNodeNames[0]!, nozzle.fallbackLocalPosition);
    node.position.x = Number.POSITIVE_INFINITY;

    const binding = resolveGlbNozzleBindings(scene, [nozzle], demoScoutGlbAppliedScale)[0]!;
    expect(binding).toEqual(expect.objectContaining({
      kind: "DirectionalNozzle",
      id: nozzle.id,
      source: "ManifestNozzleFallback",
      sourceObjectName: null,
      localPosition: nozzle.fallbackLocalPosition
    }));
    expect(binding.diagnostic).toEqual({
      status: "InvalidPosition",
      expectedNodeNames: [...nozzle.expectedNodeNames],
      matchedNodeNames: [nozzle.expectedNodeNames[0]],
      matchedNodeCount: 1,
      reason: `GLB nozzle node '${nozzle.expectedNodeNames[0]}' produced a non-finite browser-local position.`
    });
    expect(JSON.parse(JSON.stringify(binding))).toEqual(binding);
  });

  it("rejects ambiguous candidates and prevents one GLB node from binding two logical nozzles", () => {
    const template = demoScoutRcsNozzleRegistry[0]!;
    const ambiguous: ShipThrusterNozzleDescriptor = { ...template, id: "ambiguous", expectedNodeNames: ["candidate-a", "candidate-b"] };
    const scene = new THREE.Group();
    addNode(scene, "candidate-a", template.fallbackLocalPosition);
    addNode(scene, "candidate-b", template.fallbackLocalPosition);
    expect(resolveGlbNozzleBindings(scene, [ambiguous], demoScoutGlbAppliedScale)[0]?.diagnostic.status).toBe("AmbiguousCandidates");

    const sharedName = "shared-nozzle";
    const first: ShipThrusterNozzleDescriptor = { ...template, id: "shared-first", expectedNodeNames: [sharedName] };
    const second: ShipThrusterNozzleDescriptor = { ...template, id: "shared-second", expectedNodeNames: [sharedName] };
    const sharedScene = new THREE.Group();
    addNode(sharedScene, sharedName, template.fallbackLocalPosition);
    const bindings = resolveGlbNozzleBindings(sharedScene, [first, second], demoScoutGlbAppliedScale);
    expect(bindings[0]?.diagnostic.status).toBe("Resolved");
    expect(bindings[1]?.diagnostic.status).toBe("NodeAlreadyBound");
    expect(bindings[1]?.source).toBe("ManifestNozzleFallback");
  });
});
