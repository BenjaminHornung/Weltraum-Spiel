import { beforeAll, describe, expect, it } from "vitest";
import {
  ADAPTIVE_BRICK_CELLS_PER_AXIS,
  canonicalAdaptiveJson,
  globalQuantumCoordinate,
  isDeepFrozen,
  quantumBoundsForKey,
  serializeAdaptiveKey,
  type QuantumBounds
} from "../../src/voxel/adaptive";
import {
  decodeStructuralObject,
  encodeStructuralObject,
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  structuralAddressForBrickCell,
  structuralMaterialId
} from "../../src/voxel/structural";
import {
  HESTIA_VEGETATION_SCHEMA_VERSION,
  HestiaVegetationError,
  applyHestiaVegetationTrunkCut,
  canonicalHestiaVegetationJson,
  classifyVegetationStructuralObject,
  compileVegetationStructuralBricks,
  createHestiaUmbrellaTreeGraph,
  createHestiaVegetationRequestedQuantumBounds,
  createHestiaVegetationProxy,
  freezeHestiaVegetationValue,
  hashHestiaVegetationCanonical,
  isHestiaVegetationValueFrozen,
  type HestiaVegetationInstance
} from "../../src/world-generation/hestia/vegetation";

const umbrellaInstance = (rootX = 8, rootZ = 8): HestiaVegetationInstance => {
  const fixture = rootX === 8 && rootZ === 8 ? "phase2" : `phase2-${rootX}-${rootZ}`;
  const payload = {
    schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION,
    candidateId: `hestia.vegetation.candidate.v1:${fixture}`,
    candidateHash: hashHestiaVegetationCanonical({ fixture: `${fixture}-candidate` }),
    speciesId: "hestia.umbrella-tree.v1" as const,
    positionMeters: { x: (rootX + 0.5) * 0.125, y: 0.0625, z: (rootZ + 0.5) * 0.125 },
    rootQuantum: {
      x: globalQuantumCoordinate(rootX),
      y: globalQuantumCoordinate(0),
      z: globalQuantumCoordinate(rootZ)
    },
    slopeDegrees: 4,
    moisture: 0.8,
    materialId: 1 as HestiaVegetationInstance["materialId"],
    biomeId: "hestia.biome.mist-forest.v1" as const,
    rootMaterialId: structuralMaterialId(1, "fixture/rootMaterialId", false),
    crownRadiusMeters: 3
  };
  const instanceHash = hashHestiaVegetationCanonical(payload);
  return freezeHestiaVegetationValue({
    ...payload,
    instanceId: `hestia.vegetation.instance.v1:${instanceHash.slice(-16)}`,
    instanceHash
  });
};

const FULL_BOUNDS: QuantumBounds = {
  min: { x: -80, y: -16, z: -80 },
  max: { x: 112, y: 160, z: 112 }
} as QuantumBounds;

const brickProjection = (object: ReturnType<typeof compileVegetationStructuralBricks>) => object.bricks.map((brick) => ({
  key: serializeAdaptiveKey(brick.key),
  cells: brick.cells
}));

const containsNegativeZero = (value: unknown): boolean => {
  if (typeof value === "number") return Object.is(value, -0);
  if (Array.isArray(value)) return value.some(containsNegativeZero);
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).some(containsNegativeZero);
};

const boundsIntersectHalfOpen = (left: QuantumBounds, right: QuantumBounds): boolean =>
  left.min.x < right.max.x && left.max.x > right.min.x
  && left.min.y < right.max.y && left.max.y > right.min.y
  && left.min.z < right.max.z && left.max.z > right.min.z;

const coordinateInsideHalfOpen = (
  coordinate: Readonly<{ x: number; y: number; z: number }>,
  bounds: QuantumBounds
): boolean => coordinate.x >= bounds.min.x && coordinate.x < bounds.max.x
  && coordinate.y >= bounds.min.y && coordinate.y < bounds.max.y
  && coordinate.z >= bounds.min.z && coordinate.z < bounds.max.z;

const expectCompiledBrickCoverage = (
  object: ReturnType<typeof compileVegetationStructuralBricks>,
  requestedBounds: QuantumBounds,
  authoredSegmentIds: ReadonlySet<string>
): void => {
  for (const brick of object.bricks) {
    expect(boundsIntersectHalfOpen(quantumBoundsForKey(brick.key), requestedBounds)).toBe(true);
    expect(brick.cells.some((cell) => {
      const coordinate = globalQuantumForStructuralCell(structuralAddressForBrickCell(brick, cell.localIndex));
      return coordinateInsideHalfOpen(coordinate, requestedBounds)
        && authoredSegmentIds.has(cell.state.semanticKey ?? "");
    })).toBe(true);
  }
};

let sharedObject: ReturnType<typeof compileVegetationStructuralBricks>;

beforeAll(() => {
  sharedObject = compileVegetationStructuralBricks(umbrellaInstance(), FULL_BOUNDS, 4);
}, 120_000);

describe("Hestia Structural Vegetation Phase 2", () => {
  it("[13-14] builds a stable complete acyclic Umbrella graph within all numeric and explicit budget limits", () => {
    const instance = umbrellaInstance();
    const before = canonicalHestiaVegetationJson(instance);
    const graph = createHestiaUmbrellaTreeGraph(instance);
    const repeat = createHestiaUmbrellaTreeGraph(instance);

    expect(canonicalHestiaVegetationJson(repeat)).toBe(canonicalHestiaVegetationJson(graph));
    expect(graph.trunkHeightMeters).toBeGreaterThanOrEqual(6);
    expect(graph.trunkHeightMeters).toBeLessThanOrEqual(14);
    expect(graph.baseRadiusMeters).toBeGreaterThanOrEqual(0.35);
    expect(graph.baseRadiusMeters).toBeLessThanOrEqual(0.8);
    expect(graph.primaryBranchCount).toBeGreaterThanOrEqual(5);
    expect(graph.primaryBranchCount).toBeLessThanOrEqual(9);
    expect(graph.canopyLobeCount).toBeGreaterThanOrEqual(4);
    expect(graph.canopyLobeCount).toBeLessThanOrEqual(8);
    expect(graph.nodes).toHaveLength(graph.segments.length + 1);
    expect(new Set(graph.nodes.map((node) => node.nodeId)).size).toBe(graph.nodes.length);
    expect(new Set(graph.segments.map((segment) => segment.segmentId)).size).toBe(graph.segments.length);
    expect(new Set(graph.segments.map((segment) => segment.materialRole))).toEqual(new Set(["root", "wood", "canopy"]));

    const nodes = new Map(graph.nodes.map((node) => [node.nodeId, node] as const));
    expect(nodes.get(graph.rootNodeId)?.parentNodeId).toBeNull();
    for (const node of graph.nodes) {
      const seen = new Set<string>();
      let current = node;
      while (current.parentNodeId !== null) {
        expect(seen.has(current.nodeId)).toBe(false);
        seen.add(current.nodeId);
        const parent = nodes.get(current.parentNodeId);
        expect(parent).toBeDefined();
        current = parent!;
      }
      expect(current.nodeId).toBe(graph.rootNodeId);
    }
    for (const segment of graph.segments) {
      expect(nodes.get(segment.childNodeId)?.parentNodeId).toBe(segment.parentNodeId);
    }
    const secondaryCounts = new Map<string, number>();
    for (const segment of graph.segments.filter((entry) => entry.role === "secondary")) {
      secondaryCounts.set(segment.parentNodeId, (secondaryCounts.get(segment.parentNodeId) ?? 0) + 1);
    }
    expect(secondaryCounts.size).toBe(graph.primaryBranchCount);
    expect([...secondaryCounts.values()].every((count) => count >= 1 && count <= 3)).toBe(true);

    const constrained = createHestiaUmbrellaTreeGraph(instance, {
      maxSecondaryBranches: graph.primaryBranchCount,
      maxCanopyLobes: 4
    });
    expect(constrained.secondaryBranchCount).toBe(graph.primaryBranchCount);
    expect(constrained.canopyLobeCount).toBe(4);
    expect(canonicalHestiaVegetationJson(instance)).toBe(before);
    expect(isHestiaVegetationValueFrozen(graph)).toBe(true);
  });

  it("fails closed with InvalidSpeciesId when graph or Structural compilation receives a non-Umbrella instance", () => {
    const mistSprout = {
      ...umbrellaInstance(),
      speciesId: "hestia.mist-sprout.v1"
    } as HestiaVegetationInstance;
    for (const action of [
      () => createHestiaUmbrellaTreeGraph(mistSprout),
      () => compileVegetationStructuralBricks(mistSprout, FULL_BOUNDS, 4)
    ]) {
      let failure: unknown;
      try {
        action();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(HestiaVegetationError);
      expect(failure).toMatchObject({ code: "InvalidSpeciesId", path: "instance/speciesId" });
    }
  });

  it("[15] projects the full graph into stable meaningful trunk, branch, and flat-canopy proxy parts", () => {
    const instance = umbrellaInstance();
    const graph = createHestiaUmbrellaTreeGraph(instance);
    const proxy = createHestiaVegetationProxy(instance);
    expect(proxy.parts).toHaveLength(graph.segments.length);
    expect(proxy.parts.filter((part) => part.role === "root")).toHaveLength(1);
    expect(proxy.parts.filter((part) => part.role === "trunk")).toHaveLength(1);
    expect(proxy.parts.filter((part) => part.role === "branch").length).toBe(graph.primaryBranchCount + graph.secondaryBranchCount);
    expect(proxy.parts.filter((part) => part.role === "canopy").length).toBe(graph.canopyLobeCount);
    expect(proxy.parts.filter((part) => part.role === "canopy").every((part) => part.dimensionsMeters.y < part.dimensionsMeters.x && part.dimensionsMeters.y < part.dimensionsMeters.z)).toBe(true);
    expect(proxy.parts.every((part) => part.sourceNodeId !== null && part.sourceSegmentId !== null)).toBe(true);
    expect(proxy.parts.map((part) => part.sourceSegmentId)).toEqual(graph.segments.map((segment) => segment.segmentId));
    expect(proxy.parts.every((part) => part.shape !== ("sphere" as never) && part.shape !== ("cone" as never))).toBe(true);
  });

  it("[17-19,26-27] compiles only intersected Level-4 Adaptive-keyed bricks into frozen persistent Structural authority with root anchors", () => {
    const instance = umbrellaInstance();
    const mutableBounds = { min: { ...FULL_BOUNDS.min }, max: { ...FULL_BOUNDS.max } } as QuantumBounds;
    const before = canonicalAdaptiveJson(mutableBounds);
    const object = sharedObject;
    const repeat = compileVegetationStructuralBricks(instance, mutableBounds, 4);

    expect(object.bricks.length).toBeGreaterThan(0);
    expect(ADAPTIVE_BRICK_CELLS_PER_AXIS).toBe(16);
    expect(object.bricks.every((brick) => brick.key.level === 4 && brick.cells.length > 0)).toBe(true);
    expect(object.bricks.every((brick) => brick.cells.every((cell) => cell.localIndex >= 0 && cell.localIndex < 16 ** 3))).toBe(true);
    expect(object.bricks.every((brick) => brick.key.originQuantum.x % 16 === 0
      && brick.key.originQuantum.y % 16 === 0 && brick.key.originQuantum.z % 16 === 0)).toBe(true);
    const authoredSegmentIds = new Set(createHestiaUmbrellaTreeGraph(instance).segments.map((segment) => segment.segmentId));
    expectCompiledBrickCoverage(object, mutableBounds, authoredSegmentIds);
    expect(repeat.contentHash).toBe(object.contentHash);
    const encoded = encodeStructuralObject(object);
    expect(decodeStructuralObject(encoded).contentHash).toBe(object.contentHash);
    expect(canonicalAdaptiveJson(mutableBounds)).toBe(before);
    expect(isDeepFrozen(object)).toBe(true);

    const rootMaterial = object.materials.find((material) => material.structuralClass === "hestia.vegetation.root.v1");
    expect(rootMaterial).toBeDefined();
    const rootCells = object.bricks.flatMap((brick) => brick.cells.filter((cell) => cell.state.materialId === rootMaterial!.materialId));
    expect(rootCells.length).toBeGreaterThan(0);
    expect(object.anchors).toHaveLength(rootCells.length);
    expect(object.anchors.every((anchor) => getStructuralVoxel(object, anchor.cell)?.materialId === rootMaterial!.materialId)).toBe(true);
    expect(object.joints).toHaveLength(1);

    const far = compileVegetationStructuralBricks(instance, {
      min: { x: 10_000, y: 10_000, z: 10_000 },
      max: { x: 10_016, y: 10_016, z: 10_016 }
    } as QuantumBounds, 4);
    expect(far.bricks).toEqual([]);
    expect(far.anchors).toEqual([]);

    const maximumOccupiedX = Math.max(...object.bricks.flatMap((brick) => brick.cells.map((cell) =>
      globalQuantumForStructuralCell(structuralAddressForBrickCell(brick, cell.localIndex)).x)));
    const touchingExclusiveMaximum = compileVegetationStructuralBricks(instance, {
      min: { x: maximumOccupiedX + 1, y: FULL_BOUNDS.min.y, z: FULL_BOUNDS.min.z },
      max: { x: maximumOccupiedX + 17, y: FULL_BOUNDS.max.y, z: FULL_BOUNDS.max.z }
    } as QuantumBounds, 4);
    expect(touchingExclusiveMaximum.bricks).toEqual([]);
    expect(() => compileVegetationStructuralBricks(instance, FULL_BOUNDS, 3)).toThrow(/Level 4/);
  }, 90_000);

  it("canonicalizes signed zero at near-origin Adaptive quantum-boundaries without changing canonical output", () => {
    const instance = umbrellaInstance(0, 0);
    const positiveZeroBounds = createHestiaVegetationRequestedQuantumBounds({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 64, y: 160, z: 64 }
    });
    const signedZeroInput = {
      min: { x: -0, y: -0, z: -0 },
      max: { x: 64, y: 160, z: 64 }
    };
    const signedZeroBounds = createHestiaVegetationRequestedQuantumBounds(signedZeroInput);

    const derivedBoundsResult = compileVegetationStructuralBricks(instance, positiveZeroBounds, 4);
    const requestedBoundsResult = compileVegetationStructuralBricks(instance, signedZeroBounds, 4);

    expect(derivedBoundsResult.bricks.length).toBeGreaterThan(0);
    expect(requestedBoundsResult.contentHash).toBe(derivedBoundsResult.contentHash);
    expect(requestedBoundsResult.bricks.every((brick) =>
      !Object.is(brick.key.originQuantum.x, -0)
      && !Object.is(brick.key.originQuantum.y, -0)
      && !Object.is(brick.key.originQuantum.z, -0))).toBe(true);
    expect(containsNegativeZero(requestedBoundsResult)).toBe(false);
    expect(isDeepFrozen(signedZeroBounds)).toBe(true);
    expect(containsNegativeZero(signedZeroBounds)).toBe(false);
    expect(Object.is(signedZeroInput.min.x, -0)).toBe(true);
    expect(Object.is(signedZeroInput.min.y, -0)).toBe(true);
    expect(Object.is(signedZeroInput.min.z, -0)).toBe(true);
  }, 90_000);

  it("[20] classifies the intact tree as one anchored component through Structural Core", () => {
    const object = sharedObject;
    const classification = classifyVegetationStructuralObject(object);
    expect(classification.components).toHaveLength(1);
    expect(classification.anchoredComponents).toHaveLength(1);
    expect(classification.detachedComponents).toHaveLength(0);
    expect(classification.components[0].activeAnchors.length).toBeGreaterThan(0);
    expect(classification.components[0].activeJoints.map((joint) => joint.jointId)).toContain(object.joints[0].jointId);
    expect(isDeepFrozen(classification)).toBe(true);
  }, 90_000);

  it("[21-24] applies a stable Structural Core trunk cut, leaves a joint spanning disconnected components, and derives finite asymmetric mass", () => {
    const instance = umbrellaInstance();
    const first = applyHestiaVegetationTrunkCut(instance, sharedObject);
    const second = applyHestiaVegetationTrunkCut(instance, sharedObject);

    expect(first.commandResult.status).toBe("Applied");
    expect(first.commandResult.changedVoxelCount).toBeGreaterThan(0);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.detachedComponent.componentId).toBe(second.detachedComponent.componentId);
    expect(first.classification.anchoredComponents.length).toBeGreaterThan(0);
    expect(first.classification.detachedComponents.length).toBeGreaterThan(0);
    expect(first.detachedComponent.anchored).toBe(false);
    const graph = createHestiaUmbrellaTreeGraph(instance);
    const branchSegmentIds = new Set(graph.segments.filter((segment) =>
      segment.role === "primary" || segment.role === "secondary" || segment.role === "canopy")
      .map((segment) => segment.segmentId));
    expect(first.detachedComponent.occupiedCells.some((cell) => {
      const semantic = getStructuralVoxel(first.commandResult.object, cell)?.semanticKey ?? "";
      return branchSegmentIds.has(semantic);
    })).toBe(true);

    const jointId = first.commandResult.object.joints[0].jointId;
    expect(first.classification.components.filter((component) => component.activeJoints.some((joint) => joint.jointId === jointId)).length).toBe(2);
    const mass = first.detachedMassProperties;
    expect(mass.totalMassKg).toBeGreaterThan(0);
    expect(mass.centerOfMassMeters).not.toBeNull();
    expect(Object.values(mass.centerOfMassMeters!).every(Number.isFinite)).toBe(true);
    expect(Object.values(mass.inertiaTensorKgMetersSquared).every(Number.isFinite)).toBe(true);
    const crossTerms = [mass.inertiaTensorKgMetersSquared.xy, mass.inertiaTensorKgMetersSquared.xz, mass.inertiaTensorKgMetersSquared.yz];
    expect(crossTerms.every((value) => value !== 0)).toBe(true);
    expect(crossTerms.some((value) => value > 0)).toBe(true);
    expect(crossTerms.some((value) => value < 0)).toBe(true);
    expect("mesh" in first).toBe(false);
    expect(isHestiaVegetationValueFrozen(first)).toBe(true);
  }, 90_000);

  it("[25-27] preserves canonical brick union under region splits without mutating inputs", () => {
    const instance = umbrellaInstance();
    const full = sharedObject;
    const leftBounds = { min: { ...FULL_BOUNDS.min }, max: { ...FULL_BOUNDS.max, x: 8 } } as QuantumBounds;
    const rightBounds = { min: { ...FULL_BOUNDS.min, x: 8 }, max: { ...FULL_BOUNDS.max } } as QuantumBounds;
    const before = canonicalAdaptiveJson([leftBounds, rightBounds]);
    const left = compileVegetationStructuralBricks(instance, leftBounds, 4);
    const right = compileVegetationStructuralBricks(instance, rightBounds, 4);
    const authoredSegmentIds = new Set(createHestiaUmbrellaTreeGraph(instance).segments.map((segment) => segment.segmentId));
    expectCompiledBrickCoverage(left, leftBounds, authoredSegmentIds);
    expectCompiledBrickCoverage(right, rightBounds, authoredSegmentIds);
    const union = new Map<string, (typeof full.bricks)[number]>();
    for (const brick of [...right.bricks, ...left.bricks]) {
      const key = serializeAdaptiveKey(brick.key);
      const existing = union.get(key);
      if (existing !== undefined) expect(existing.cells).toEqual(brick.cells);
      union.set(key, brick);
    }
    const unionProjection = [...union.values()].sort((a, b) => serializeAdaptiveKey(a.key).localeCompare(serializeAdaptiveKey(b.key)))
      .map((brick) => ({ key: serializeAdaptiveKey(brick.key), cells: brick.cells }));
    expect(unionProjection).toEqual(brickProjection(full));
    expect(canonicalAdaptiveJson([leftBounds, rightBounds])).toBe(before);
    expect(isDeepFrozen(left)).toBe(true);
    expect(isDeepFrozen(right)).toBe(true);
  }, 120_000);
});
