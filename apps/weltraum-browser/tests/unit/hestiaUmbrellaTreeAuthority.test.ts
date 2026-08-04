import { beforeAll, describe, expect, it } from "vitest";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  deepFreeze,
  isDeepFrozen,
  serializeAdaptiveKey
} from "../../src/voxel/adaptive";
import {
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  hashStructuralObjectContent,
  serializeStructuralCellAddress,
  structuralRevision,
  structuralAddressForBrickCell,
  type StructuralObject
} from "../../src/voxel/structural";
import {
  SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS,
  SURFACE_RIGID_BODY_MAX_SUBSTEPS,
  SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS,
  SURFACE_RIGID_BODY_TICK_SECONDS,
  admitSurfaceRigidBodyBatch,
  createSurfaceRigidBodyCandidate,
  createSurfaceRigidBodyWorld,
  raycastSurfaceRigidBodies,
  stepSurfaceRigidBodyWorld
} from "../../src/surface-play/physics";
import { rotateSpatialVector } from "../../src/spatial/quaternion";
import {
  HESTIA_UMBRELLA_TREE_FIXTURE_INSTANCE_ID,
  HESTIA_UMBRELLA_TREE_FIXTURE_SEED,
  HESTIA_UMBRELLA_TREE_MATERIALS,
  createHestiaUmbrellaTree,
  hestiaSurfaceVegetationAuthorityKind,
  type HestiaUmbrellaTree,
  type HestiaUmbrellaTreeSegment
} from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  deriveSurfaceTreeCanonicalHit,
  deriveSurfaceTreeAuthority,
  previewSurfaceTreeCanonicalHit,
  surfaceTreeOccupiedCellAddresses,
  type SurfaceTreeAuthoritySnapshot
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  createSurfaceTreeCollisionBinding,
  createSurfaceTreeCollisionSnapshot,
  raycastSurfaceTreeCollision
} from "../../src/surface-play/vegetation/surfaceTreeCollision";
import {
  createSurfaceTreePresentationSnapshot,
  createSurfaceTreeRuntimeStateFromAuthority,
  advanceSurfaceTreePhysics,
  preflightSurfaceTreeFire,
  resolveSurfaceTreeStructuralMeshArtifact
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";
import { deriveSurfaceTreeReleaseVelocity } from "../../src/surface-play/vegetation/surfaceTreeRelease";

let initial: SurfaceTreeAuthoritySnapshot;

const MEDIUM_TREE_MIN_HEIGHT_METERS = 5.4;
const MEDIUM_TREE_MAX_HEIGHT_METERS = 6.6;
const MIN_CANOPY_TO_HEIGHT_RATIO = 0.65;
const MAX_CANOPY_TO_HEIGHT_RATIO = 1.05;
const MIN_SUBSTANTIAL_CANOPY_LAYERS = 4;
const MAX_TREE_OCCUPIED_CELLS = 3_971;
const MAX_TREE_RESIDENT_BRICKS = 29;
const MAX_TREE_JOURNAL_RECORDS = 160;

beforeAll(() => {
  initial = createSurfaceTreeAuthority(createHestiaUmbrellaTree());
}, 120_000);

const finiteMass = (authority: SurfaceTreeAuthoritySnapshot): void => {
  const mass = authority.massProperties;
  expect(mass.totalMassKg).toBeGreaterThan(0);
  expect(mass.centerOfMassMeters).not.toBeNull();
  expect(Object.values(mass.centerOfMassMeters!).every(Number.isFinite)).toBe(true);
  expect(Object.values(mass.inertiaTensorKgMetersSquared).every(Number.isFinite)).toBe(true);
};

const physicsWorld = (
  terrainColliders: Parameters<typeof createSurfaceRigidBodyWorld>[0]["terrainColliders"] = []
) => createSurfaceRigidBodyWorld({
  simulationTick: 0,
  gravityMetersPerSecondSquared: 9.81,
  terrainColliders
});

const applyRuntimeCanonicalSequence = (
  start: SurfaceTreeAuthoritySnapshot,
  hitCount = 3,
  hitNormal: Readonly<{ readonly x: number; readonly y: number; readonly z: number }> = {
    x: -1,
    y: 0,
    z: 0
  },
  terrainColliders: Parameters<typeof createSurfaceRigidBodyWorld>[0]["terrainColliders"] = []
) => {
  let state = createSurfaceTreeRuntimeStateFromAuthority(start, physicsWorld(terrainColliders));
  let detachedAt = 0;
  let admittedPosition: Readonly<{ x: number; y: number; z: number }> | null = null;
  const hits: Array<Readonly<{
    before: typeof state;
    admitted: typeof state;
    advanced: typeof state;
    supportResult: "Anchored" | "Detached" | "Empty";
  }>> = [];
  for (let ordinal = 0; ordinal < hitCount; ordinal += 1) {
    const before = state;
    const hit = deriveSurfaceTreeCanonicalHit(state.authority, ordinal);
    const voxel = getStructuralVoxel(state.authority.object, hit.address);
    const preflight = preflightSurfaceTreeFire(state, {
      fireCommandId: "fire:tree-runtime:" + (ordinal + 1),
      hit: {
        address: hit.address,
        materialId: hit.materialId,
        semanticKey: voxel?.semanticKey ?? null,
        pointMeters: hit.pointMeters,
        normal: hitNormal
      },
      simulationTick: ordinal + 1
    });
    expect(
      preflight.status,
      "runtime Tree preflight ordinal " + ordinal
        + (preflight.status === "Rejected" ? " rejected with " + preflight.code : "")
    ).toBe("Ready");
    if (preflight.status !== "Ready") throw new Error("Runtime Tree preflight was rejected.");
    state = preflight.state;
    if (state.physicsWorld.bodies.length > 0 && admittedPosition === null) {
      admittedPosition = state.physicsWorld.bodies[0].positionMeters;
      detachedAt = ordinal + 1;
    }
    const admitted = state;
    state = advanceSurfaceTreePhysics(state);
    hits.push(Object.freeze({
      before,
      admitted,
      advanced: state,
      supportResult: preflight.supportResult
    }));
  }
  return { state, hits: Object.freeze(hits), detachedAt, admittedPosition };
};

const objectWithCells = (
  source: Readonly<StructuralObject>,
  retainedCellKeys: ReadonlySet<string>,
  objectRevision = source.objectRevision,
  editRevision = source.editRevision
): StructuralObject => {
  const candidate = deepFreeze({
    ...source,
    bricks: source.bricks.map((brick) => ({
      ...brick,
      cells: brick.cells.filter((cell) => retainedCellKeys.has(serializeStructuralCellAddress(
        structuralAddressForBrickCell(brick, cell.localIndex)
      )))
    })),
    objectRevision,
    editRevision,
    contentHash: ""
  }) as StructuralObject;
  return deepFreeze({ ...candidate, contentHash: hashStructuralObjectContent(candidate) }) as StructuralObject;
};

const graphNodeMap = (tree: HestiaUmbrellaTree) =>
  new Map(tree.graph.nodes.map((node) => [node.nodeId, node] as const));

const compiledSegmentCells = (
  authority: SurfaceTreeAuthoritySnapshot,
  segment: HestiaUmbrellaTreeSegment
) => authority.object.bricks.flatMap((brick) => brick.cells.flatMap((cell) => {
  if (cell.state.semanticKey !== segment.segmentId) return [];
  const address = structuralAddressForBrickCell(brick, cell.localIndex);
  return [{ address, global: globalQuantumForStructuralCell(address), materialId: cell.state.materialId }];
}));

const strictInterior = (value: number, start: number, end: number): boolean =>
  value > Math.min(start, end) && value < Math.max(start, end);

const assertRootConnectedStructuralOccupancy = (authority: SurfaceTreeAuthoritySnapshot): void => {
  const occupied = surfaceTreeOccupiedCellAddresses(authority);
  const occupiedByKey = new Map(occupied.map((address) => [
    serializeStructuralCellAddress(address),
    address
  ] as const));
  const occupiedByQuantum = new Map<string, (typeof occupied)[number]>(occupied.map((address) => {
    const global = globalQuantumForStructuralCell(address);
    return [`${global.x}:${global.y}:${global.z}`, address] as const;
  }));
  const pending = authority.object.anchors.map((anchor) => anchor.cell);
  const visited = new Set<string>();
  const offsets = [
    { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 }
  ] as const;

  while (pending.length > 0) {
    const address = pending.pop()!;
    const key = serializeStructuralCellAddress(address);
    if (visited.has(key) || !occupiedByKey.has(key)) continue;
    visited.add(key);
    const global = globalQuantumForStructuralCell(address);
    for (const offset of offsets) {
      const neighbour = occupiedByQuantum.get(
        `${global.x + offset.x}:${global.y + offset.y}:${global.z + offset.z}`
      );
      if (neighbour !== undefined) pending.push(neighbour);
    }
  }

  expect(visited.size).toBe(occupied.length);
  expect(authority.object.bricks.every((brick) => brick.cells
    .filter((cell) => cell.state.materialId === HESTIA_UMBRELLA_TREE_MATERIALS.wood.materialId
      || cell.state.materialId === HESTIA_UMBRELLA_TREE_MATERIALS.canopy.materialId)
    .every((cell) => visited.has(serializeStructuralCellAddress(
      structuralAddressForBrickCell(brick, cell.localIndex)
    ))))).toBe(true);
};

describe("Hestia Surface Umbrella Tree authority", () => {
  it("builds a deterministic Medium Umbrella Tree with height-scaled canopy proportions", () => {
    const tree = createHestiaUmbrellaTree();
    const repeat = createHestiaUmbrellaTree();

    expect(tree.instanceId).toBe(HESTIA_UMBRELLA_TREE_FIXTURE_INSTANCE_ID);
    expect(tree.seed).toBe(HESTIA_UMBRELLA_TREE_FIXTURE_SEED);
    expect(tree.rootQuantum).toEqual({ x: 8, y: 0, z: 8 });
    expect(repeat).toEqual(tree);
    expect(tree.graph.contentHash).toBe("fnv1a64-v1:2dfcb11e85a40290");
    expect(tree.contentHash).toBe("fnv1a64-v1:577d45d9dfdc0cd8");
    expect(tree.graph.trunkHeightMeters).toBeGreaterThanOrEqual(MEDIUM_TREE_MIN_HEIGHT_METERS);
    expect(tree.graph.trunkHeightMeters).toBeLessThanOrEqual(MEDIUM_TREE_MAX_HEIGHT_METERS);
    expect(tree.graph.baseRadiusMeters).toBeGreaterThanOrEqual(0.4);
    expect(tree.graph.baseRadiusMeters).toBeLessThanOrEqual(0.55);
    expect(tree.graph.primaryBranchCount).toBeGreaterThanOrEqual(5);
    expect(tree.graph.primaryBranchCount).toBeLessThanOrEqual(9);
    expect(tree.graph.canopyLobeCount).toBeGreaterThanOrEqual(4);
    expect(tree.graph.canopyLobeCount).toBeLessThanOrEqual(8);
    expect(tree.graph.nodes).toHaveLength(tree.graph.segments.length + 1);
    expect(new Set(tree.graph.nodes.map((node) => node.nodeId)).size).toBe(tree.graph.nodes.length);
    expect(new Set(tree.graph.segments.map((segment) => segment.segmentId)).size)
      .toBe(tree.graph.segments.length);
    expect(new Set(tree.graph.segments.map((segment) => segment.materialRole)))
      .toEqual(new Set(["root", "wood", "canopy"]));

    const nodes = graphNodeMap(tree);
    const canopyBounds = tree.graph.segments
      .filter((segment) => segment.role === "canopy")
      .map((segment) => {
        const center = nodes.get(segment.childNodeId)?.positionMeters;
        if (center === undefined || segment.lobeRadiiMeters === null) {
          throw new Error("Canopy fixture lost its authored center or radii.");
        }
        return {
          minX: center.x - segment.lobeRadiiMeters.x,
          maxX: center.x + segment.lobeRadiiMeters.x,
          minZ: center.z - segment.lobeRadiiMeters.z,
          maxZ: center.z + segment.lobeRadiiMeters.z
        };
      });
    const canopyWidthMeters = Math.max(...canopyBounds.map((bounds) => bounds.maxX))
      - Math.min(...canopyBounds.map((bounds) => bounds.minX));
    const canopyDepthMeters = Math.max(...canopyBounds.map((bounds) => bounds.maxZ))
      - Math.min(...canopyBounds.map((bounds) => bounds.minZ));
    expect(canopyWidthMeters / tree.graph.trunkHeightMeters)
      .toBeGreaterThanOrEqual(MIN_CANOPY_TO_HEIGHT_RATIO);
    expect(canopyWidthMeters / tree.graph.trunkHeightMeters)
      .toBeLessThanOrEqual(MAX_CANOPY_TO_HEIGHT_RATIO);
    expect(canopyDepthMeters / tree.graph.trunkHeightMeters)
      .toBeGreaterThanOrEqual(MIN_CANOPY_TO_HEIGHT_RATIO);
    expect(canopyDepthMeters / tree.graph.trunkHeightMeters)
      .toBeLessThanOrEqual(MAX_CANOPY_TO_HEIGHT_RATIO);

    const secondaryByPrimary = new Map<string, number>();
    for (const segment of tree.graph.segments.filter((entry) => entry.role === "secondary")) {
      secondaryByPrimary.set(
        segment.parentNodeId,
        (secondaryByPrimary.get(segment.parentNodeId) ?? 0) + 1
      );
    }
    expect(secondaryByPrimary.size).toBe(tree.graph.primaryBranchCount);
    expect([...secondaryByPrimary.values()].every((count) => count >= 1 && count <= 3)).toBe(true);
    expect(isDeepFrozen(tree)).toBe(true);
  });

  it("keeps Umbrella Trees authoritative while cyan sprouts and caps remain decorative", () => {
    expect(hestiaSurfaceVegetationAuthorityKind("black_trunk")).toBe("StructuralUmbrellaTree");
    expect(hestiaSurfaceVegetationAuthorityKind("cyan_luminous_sprout")).toBe("DecorativeNonSolid");
    expect(hestiaSurfaceVegetationAuthorityKind("cyan_luminous_cap")).toBe("DecorativeNonSolid");
  });

  it("compiles Level-4 occupancy, material density, occupied root anchors, and one intact anchored component", () => {
    expect(initial.object.bricks.length).toBeGreaterThan(0);
    expect(initial.object.bricks.every((brick) => brick.key.level === 4)).toBe(true);
    expect(new Set(initial.object.bricks.map((brick) => serializeAdaptiveKey(brick.key))).size)
      .toBe(initial.object.bricks.length);
    expect(initial.object.materials.map((material) => ({
      id: material.materialId,
      density: material.densityKgPerCubicMeter
    }))).toEqual([
      {
        id: HESTIA_UMBRELLA_TREE_MATERIALS.root.materialId,
        density: HESTIA_UMBRELLA_TREE_MATERIALS.root.densityKgPerCubicMeter
      },
      {
        id: HESTIA_UMBRELLA_TREE_MATERIALS.wood.materialId,
        density: HESTIA_UMBRELLA_TREE_MATERIALS.wood.densityKgPerCubicMeter
      },
      {
        id: HESTIA_UMBRELLA_TREE_MATERIALS.canopy.materialId,
        density: HESTIA_UMBRELLA_TREE_MATERIALS.canopy.densityKgPerCubicMeter
      }
    ]);
    expect(initial.object.anchors.length).toBeGreaterThan(0);
    expect(initial.object.anchors.every((anchor) =>
      getStructuralVoxel(initial.object, anchor.cell)?.materialId
        === HESTIA_UMBRELLA_TREE_MATERIALS.root.materialId)).toBe(true);
    expect(initial.classification.components).toHaveLength(1);
    expect(initial.classification.anchoredComponents).toHaveLength(1);
    expect(initial.classification.detachedComponents).toHaveLength(0);
    expect(initial.classification.components[0].activeAnchors.length).toBeGreaterThan(0);
    expect(initial.occupiedCellCount).toBe(surfaceTreeOccupiedCellAddresses(initial).length);
    expect({
      occupiedCells: initial.occupiedCellCount,
      residentBricks: initial.object.bricks.length,
      journalRecords: initial.object.source.editRevision
    }).toEqual({ occupiedCells: 3_490, residentBricks: 28, journalRecords: 136 });
    expect(initial.object.contentHash).toBe("fnv1a64-v1:dc5c694367b6250d");
    expect(initial.contentHash).toBe("fnv1a64-v1:d5170ddbbab1f61d");
    expect(initial.occupiedCellCount).toBeLessThanOrEqual(MAX_TREE_OCCUPIED_CELLS);
    expect(initial.object.bricks.length).toBeLessThanOrEqual(MAX_TREE_RESIDENT_BRICKS);
    expect(initial.object.source.editRevision).toBeLessThanOrEqual(MAX_TREE_JOURNAL_RECORDS);
    assertRootConnectedStructuralOccupancy(initial);

    const branchSegments = initial.tree.graph.segments.filter((segment) =>
      segment.role === "primary" || segment.role === "secondary");
    const nodes = graphNodeMap(initial.tree);
    expect(branchSegments.some((segment) => {
      const parent = nodes.get(segment.parentNodeId)?.positionMeters;
      const child = nodes.get(segment.childNodeId)?.positionMeters;
      if (parent === undefined || child === undefined) return false;
      const start = {
        x: Math.floor(parent.x / MICROVOXEL_BASE_QUANTUM_METERS),
        y: Math.floor(parent.y / MICROVOXEL_BASE_QUANTUM_METERS),
        z: Math.floor(parent.z / MICROVOXEL_BASE_QUANTUM_METERS)
      };
      const end = {
        x: Math.floor(child.x / MICROVOXEL_BASE_QUANTUM_METERS),
        y: Math.floor(child.y / MICROVOXEL_BASE_QUANTUM_METERS),
        z: Math.floor(child.z / MICROVOXEL_BASE_QUANTUM_METERS)
      };
      return compiledSegmentCells(initial, segment).some(({ global }) =>
        strictInterior(global.x, start.x, end.x)
        && strictInterior(global.y, start.y, end.y)
        && strictInterior(global.z, start.z, end.z));
    })).toBe(true);

    for (const segment of initial.tree.graph.segments.filter((entry) => entry.role === "canopy")) {
      const cells = compiledSegmentCells(initial, segment);
      const layerCounts = new Map<number, number>();
      for (const { global } of cells) {
        layerCounts.set(global.y, (layerCounts.get(global.y) ?? 0) + 1);
      }
      const maximumLayerCells = Math.max(...layerCounts.values());
      const substantialLayerCount = [...layerCounts.values()]
        .filter((count) => count >= maximumLayerCells * 0.25).length;
      expect(substantialLayerCount).toBeGreaterThanOrEqual(MIN_SUBSTANTIAL_CANOPY_LAYERS);
    }
    expect(createSurfaceTreeCollisionSnapshot(initial).cells
      .map((cell) => serializeStructuralCellAddress(cell.address)).sort())
      .toEqual(surfaceTreeOccupiedCellAddresses(initial)
        .map(serializeStructuralCellAddress).sort());
    finiteMass(initial);
    expect(isDeepFrozen(initial)).toBe(true);
  }, 30_000);

  it("resolves the published anchored component as an immutable World-space mesh only", () => {
    const state = createSurfaceTreeRuntimeStateFromAuthority(initial, physicsWorld());
    const snapshot = createSurfaceTreePresentationSnapshot(state, {
      bodyId: initial.object.frame.bodyId,
      regionId: initial.object.frame.regionId,
      surfaceFrameId: initial.object.frame.surfaceFrameId,
      regionRevision: 0,
      simulationTick: 0
    });
    expect(snapshot.components).toHaveLength(1);
    const component = snapshot.components[0];
    const artifact = resolveSurfaceTreeStructuralMeshArtifact(state, component.meshArtifactId);
    expect(artifact).toMatchObject({
      meshArtifactId: component.meshArtifactId,
      space: "World"
    });
    expect(artifact?.mesh.sourceRevision).toBe(component.sourceObjectRevision);
    expect(artifact?.mesh.sourceContentHash).toBe(component.sourceContentHash);
    expect(artifact?.mesh.boundsMeters).not.toBeNull();
    const quanta = initial.classification.components[0].occupiedCells.map(globalQuantumForStructuralCell);
    expect(artifact?.mesh.boundsMeters).toEqual({
      min: {
        x: Math.min(...quanta.map((cell) => cell.x)) * MICROVOXEL_BASE_QUANTUM_METERS,
        y: Math.min(...quanta.map((cell) => cell.y)) * MICROVOXEL_BASE_QUANTUM_METERS,
        z: Math.min(...quanta.map((cell) => cell.z)) * MICROVOXEL_BASE_QUANTUM_METERS
      },
      max: {
        x: (Math.max(...quanta.map((cell) => cell.x)) + 1) * MICROVOXEL_BASE_QUANTUM_METERS,
        y: (Math.max(...quanta.map((cell) => cell.y)) + 1) * MICROVOXEL_BASE_QUANTUM_METERS,
        z: (Math.max(...quanta.map((cell) => cell.z)) + 1) * MICROVOXEL_BASE_QUANTUM_METERS
      }
    });
    expect(isDeepFrozen(artifact)).toBe(true);
  }, 30_000);

  it("re-derives equal immutable authority facts from the same compiled identity and proofs", () => {
    const repeat = deriveSurfaceTreeAuthority(initial.tree, initial.object);
    expect(repeat.object.contentHash).toBe(initial.object.contentHash);
    expect(repeat.object.source).toEqual(initial.object.source);
    expect(repeat.object.bricks).toEqual(initial.object.bricks);
    expect(repeat.classification).toEqual(initial.classification);
    expect(repeat.massProperties).toEqual(initial.massProperties);
    expect(repeat.contentHash).toBe(initial.contentHash);
  }, 30_000);

  it("derives a deterministic physical release impulse from the accepted detaching hit", () => {
    const first = applyRuntimeCanonicalSequence(initial, 3, { x: -1, y: 0, z: 0 });
    const repeated = applyRuntimeCanonicalSequence(initial, 3, { x: -1, y: 0, z: 0 });
    const inverted = applyRuntimeCanonicalSequence(initial, 3, { x: 1, y: 0, z: 0 });
    const firstCandidate = first.hits[2].admitted.bodySources[0]?.candidate;
    const repeatedCandidate = repeated.hits[2].admitted.bodySources[0]?.candidate;
    const invertedCandidate = inverted.hits[2].admitted.bodySources[0]?.candidate;

    expect(firstCandidate).toBeDefined();
    expect(repeatedCandidate).toBeDefined();
    expect(invertedCandidate).toBeDefined();
    expect(JSON.stringify(repeatedCandidate)).toBe(JSON.stringify(firstCandidate));
    expect(firstCandidate!.positionMeters).toEqual(firstCandidate!.centerOfMassMeters);
    expect(firstCandidate!.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(Object.values(firstCandidate!.linearVelocityMetersPerSecond).every(Number.isFinite)).toBe(true);
    expect(Object.values(firstCandidate!.angularVelocityRadiansPerSecond).every(Number.isFinite)).toBe(true);
    expect(Math.hypot(
      firstCandidate!.linearVelocityMetersPerSecond.x,
      firstCandidate!.linearVelocityMetersPerSecond.y,
      firstCandidate!.linearVelocityMetersPerSecond.z
    )).toBeGreaterThan(0);
    expect(Math.hypot(
      firstCandidate!.angularVelocityRadiansPerSecond.x,
      firstCandidate!.angularVelocityRadiansPerSecond.y,
      firstCandidate!.angularVelocityRadiansPerSecond.z
    )).toBeGreaterThan(0);
    expect(Math.abs(firstCandidate!.angularVelocityRadiansPerSecond.z)).toBeGreaterThan(0);
    const normalCanopyMassKg = first.hits[2].admitted.bodySources[0].massProperties.totalMassKg;
    expect(normalCanopyMassKg).toBe(1_481.9140625);
    expect(Math.hypot(
      firstCandidate!.linearVelocityMetersPerSecond.x,
      firstCandidate!.linearVelocityMetersPerSecond.y,
      firstCandidate!.linearVelocityMetersPerSecond.z
    )).toBeCloseTo(128 / normalCanopyMassKg, 15);
    expect(invertedCandidate!.linearVelocityMetersPerSecond.x)
      .toBe(-firstCandidate!.linearVelocityMetersPerSecond.x);
    expect(invertedCandidate!.angularVelocityRadiansPerSecond.z)
      .toBe(-firstCandidate!.angularVelocityRadiansPerSecond.z);
  });

  it("admits the captured one-wood-voxel release without exceeding the first-tick motion budget", () => {
    const massKg = 1.26953125;
    const inertia = 0.0033060709635416665;
    const rawAngularVelocity = {
      x: -13_645.422998064734,
      y: 8_977.134491267021,
      z: 0
    };
    const pointMeters = {
      x: -(inertia * rawAngularVelocity.y) / 128,
      y: (inertia * rawAngularVelocity.x) / 128,
      z: 0
    };
    const release = deriveSurfaceTreeReleaseVelocity({
      pointMeters,
      normal: { x: 0, y: 0, z: -1 },
      positionMeters: { x: 0, y: 0, z: 0 },
      inverseMassPerKg: 1 / massKg,
      inverseInertiaTensorPerKgMetersSquared: {
        xx: 1 / inertia,
        yy: 1 / inertia,
        zz: 1 / inertia,
        xy: 0,
        xz: 0,
        yz: 0
      },
      gravityMetersPerSecondSquared: 9.81
    });
    const candidate = createSurfaceRigidBodyCandidate({
      bodyId: "surface-tree-body:captured-one-wood-voxel",
      componentId: "captured-one-wood-voxel",
      objectId: "captured-tree",
      sourceObjectRevision: 1,
      sourceContentHash: "fnv1a64-v1:0000000000000001",
      occupiedCells: [{ x: 0, y: 0, z: 0 }],
      cellSizeMeters: MICROVOXEL_BASE_QUANTUM_METERS,
      massKg,
      centerOfMassMeters: { x: 0, y: 0, z: 0 },
      inertiaTensorKgMetersSquared: {
        xx: inertia,
        yy: inertia,
        zz: inertia,
        xy: 0,
        xz: 0,
        yz: 0
      },
      linearVelocityMetersPerSecond: release.linearVelocityMetersPerSecond,
      angularVelocityRadiansPerSecond: release.angularVelocityRadiansPerSecond,
      colliderRevision: 1,
      detachedAtSimulationTick: 0
    });
    const admission = admitSurfaceRigidBodyBatch(physicsWorld(), [candidate]);
    expect(admission.status).toBe("Admitted");
    if (admission.status !== "Admitted") throw new Error("Captured one-cell body was not admitted.");

    expect(release.impulseScale).toBeCloseTo(0.0003846785173096263, 15);
    expect(release.linearVelocityMetersPerSecond.z).toBeCloseTo(0.0387850635544672, 14);
    expect(Math.hypot(
      release.angularVelocityRadiansPerSecond.x,
      release.angularVelocityRadiansPerSecond.y,
      release.angularVelocityRadiansPerSecond.z
    )).toBeCloseTo(Math.PI * 2, 14);
    const predictedTranslationMeters = Math.hypot(
      release.linearVelocityMetersPerSecond.x,
      release.linearVelocityMetersPerSecond.y - 9.81 * SURFACE_RIGID_BODY_TICK_SECONDS,
      release.linearVelocityMetersPerSecond.z
    ) * SURFACE_RIGID_BODY_TICK_SECONDS;
    const predictedRotationRadians = Math.hypot(
      release.angularVelocityRadiansPerSecond.x,
      release.angularVelocityRadiansPerSecond.y,
      release.angularVelocityRadiansPerSecond.z
    ) * SURFACE_RIGID_BODY_TICK_SECONDS;
    const requiredSubsteps = Math.max(
      1,
      Math.ceil(predictedTranslationMeters / SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS),
      Math.ceil(predictedRotationRadians / SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS)
    );
    expect(requiredSubsteps).toBe(3);
    const stepped = stepSurfaceRigidBodyWorld(admission.world);
    expect(stepped.status).toBe("Advanced");
    expect(stepped.world.physicsFailure).toBeNull();
  });

  it("uses one deterministic release scale for light canopy, COM, and inverted hits", () => {
    const cellSizeMeters = MICROVOXEL_BASE_QUANTUM_METERS;
    const canopyMassKg = HESTIA_UMBRELLA_TREE_MATERIALS.canopy.densityKgPerCubicMeter
      * cellSizeMeters ** 3;
    const canopyInertia = canopyMassKg * cellSizeMeters ** 2 / 6;
    const shared = {
      pointMeters: { x: -0.25, y: -0.375, z: 0 },
      positionMeters: { x: 0, y: 0, z: 0 },
      inverseMassPerKg: 1 / canopyMassKg,
      inverseInertiaTensorPerKgMetersSquared: {
        xx: 1 / canopyInertia,
        yy: 1 / canopyInertia,
        zz: 1 / canopyInertia,
        xy: 0,
        xz: 0,
        yz: 0
      },
      gravityMetersPerSecondSquared: 9.81
    };
    const forward = deriveSurfaceTreeReleaseVelocity({
      ...shared,
      normal: { x: 0, y: 0, z: -1 }
    });
    const inverted = deriveSurfaceTreeReleaseVelocity({
      ...shared,
      normal: { x: 0, y: 0, z: 1 }
    });
    const centerOfMassHit = deriveSurfaceTreeReleaseVelocity({
      ...shared,
      pointMeters: shared.positionMeters,
      normal: { x: 0, y: 0, z: -1 }
    });

    expect(canopyMassKg).toBe(0.234375);
    expect(forward.impulseScale).toBeGreaterThan(0);
    expect(forward.impulseScale).toBeLessThan(1);
    expect(inverted.impulseScale).toBe(forward.impulseScale);
    expect(inverted.linearVelocityMetersPerSecond.z)
      .toBe(-forward.linearVelocityMetersPerSecond.z);
    expect(inverted.angularVelocityRadiansPerSecond.x)
      .toBe(-forward.angularVelocityRadiansPerSecond.x);
    expect(inverted.angularVelocityRadiansPerSecond.y)
      .toBe(-forward.angularVelocityRadiansPerSecond.y);
    expect(centerOfMassHit.angularVelocityRadiansPerSecond).toEqual({ x: 0, y: 0, z: 0 });
    expect(Object.values(centerOfMassHit.linearVelocityMetersPerSecond).every(Number.isFinite))
      .toBe(true);
    expect(Object.values(centerOfMassHit.angularVelocityRadiansPerSecond).every(Number.isFinite))
      .toBe(true);
  });

  it("topples the deterministic detached fixture within the bounded physics motion budget", () => {
    const occupiedQuanta = surfaceTreeOccupiedCellAddresses(initial).map(globalQuantumForStructuralCell);
    const groundTopMeters = Math.min(...occupiedQuanta.map((cell) => cell.y))
      * MICROVOXEL_BASE_QUANTUM_METERS;
    const rootX = (initial.tree.rootQuantum.x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS;
    const rootZ = (initial.tree.rootQuantum.z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS;
    const ground = [{
      colliderKey: "tree-release-fixture-ground",
      minimumMeters: { x: rootX - 20, y: groundTopMeters - 4, z: rootZ - 20 },
      maximumMeters: { x: rootX + 20, y: groundTopMeters, z: rootZ + 20 }
    }];
    const sequence = applyRuntimeCanonicalSequence(
      initial,
      3,
      { x: -1, y: 0, z: 0 },
      ground
    );
    let state = sequence.hits[2].admitted;
    const released = state.physicsWorld.bodies[0];
    for (let tick = 0; tick < 2_400; tick += 1) {
      if (state.physicsWorld.physicsFailure !== null) break;
      if (state.physicsWorld.bodies[0]?.lifecycle === "Resting") break;
      state = advanceSurfaceTreePhysics(state);
    }
    const resting = state.physicsWorld.bodies[0];
    const up = rotateSpatialVector(resting.orientation, { x: 0, y: 1, z: 0 });
    const tiltRadians = Math.acos(Math.max(-1, Math.min(1, up.y)));
    const lateralDisplacementMeters = Math.hypot(
      resting.positionMeters.x - released.positionMeters.x,
      resting.positionMeters.z - released.positionMeters.z
    );
    const gravityDeltaMetersPerSecond = 9.81 * SURFACE_RIGID_BODY_TICK_SECONDS;
    const predictedTranslationMeters = Math.hypot(
      released.linearVelocityMetersPerSecond.x,
      released.linearVelocityMetersPerSecond.y - gravityDeltaMetersPerSecond,
      released.linearVelocityMetersPerSecond.z
    ) * SURFACE_RIGID_BODY_TICK_SECONDS;
    const predictedRotationRadians = Math.hypot(
      released.angularVelocityRadiansPerSecond.x,
      released.angularVelocityRadiansPerSecond.y,
      released.angularVelocityRadiansPerSecond.z
    ) * SURFACE_RIGID_BODY_TICK_SECONDS;
    const requiredSubsteps = Math.max(
      1,
      Math.ceil(predictedTranslationMeters / SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS),
      Math.ceil(predictedRotationRadians / SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS)
    );

    expect(state.physicsWorld.physicsFailure).toBeNull();
    expect(resting.lifecycle).toBe("Resting");
    expect(requiredSubsteps).toBe(1);
    expect(requiredSubsteps).toBeLessThanOrEqual(SURFACE_RIGID_BODY_MAX_SUBSTEPS);
    expect(tiltRadians).toBeGreaterThanOrEqual(Math.PI / 4);
    expect(lateralDisplacementMeters).toBeGreaterThanOrEqual(0.5);
  }, 120_000);

  it("keeps hits one and two attached, transfers hit three, and edits only the current stump on hit four", () => {
    const first = previewSurfaceTreeCanonicalHit(initial, 0);
    expect(first.status).toBe("Accepted");
    if (first.status !== "Accepted") throw new Error("First canonical hit was rejected.");
    expect(first.result.status).toBe("Applied");
    expect(first.result.changedVoxelCount).toBeGreaterThan(0);
    expect(first.result.changedVoxelCount).toBeLessThan(initial.occupiedCellCount / 10);
    expect(first.authority.classification.anchoredComponents.length).toBeGreaterThan(0);
    expect(first.authority.classification.detachedComponents).toHaveLength(0);

    const runtimeSequence = applyRuntimeCanonicalSequence(initial, 4);
    expect(runtimeSequence.hits).toHaveLength(4);
    expect(runtimeSequence.hits[0]).toMatchObject({ supportResult: "Anchored" });
    expect(runtimeSequence.hits[1]).toMatchObject({ supportResult: "Anchored" });
    expect(runtimeSequence.hits[0].admitted.bodySources).toEqual([]);
    expect(runtimeSequence.hits[1].admitted.bodySources).toEqual([]);
    expect(runtimeSequence.hits[0].admitted.latestTransition).toMatchObject({ authorityTransfer: null });
    expect(runtimeSequence.hits[1].admitted.latestTransition).toMatchObject({ authorityTransfer: null });

    const hit3 = runtimeSequence.hits[2];
    expect(runtimeSequence.detachedAt).toBe(3);
    expect(hit3.supportResult).toBe("Detached");
    expect(hit3.admitted.authority.object.contentHash).toBe("fnv1a64-v1:32946f26196674b5");
    expect(hit3.admitted.authority.classification.detachedComponents).toEqual([]);
    expect(hit3.admitted.authority.classification.fragments).toEqual([]);
    expect(hit3.admitted.authority.classification.components.every((component) => component.anchored))
      .toBe(true);
    expect(hit3.admitted.bodySources).toHaveLength(1);
    const bodySource = hit3.admitted.bodySources[0];
    expect(bodySource.sourceObject.contentHash).toBe("fnv1a64-v1:330df5fa6cebfb1a");
    expect(bodySource.component.occupiedCells).toHaveLength(2_710);
    expect(bodySource.fragment.componentId).toBe(bodySource.component.componentId);
    expect(bodySource.fragment.occupiedCells).toEqual(bodySource.component.occupiedCells);
    expect(bodySource.massProperties.totalMassKg).toBeGreaterThan(0);
    expect(Object.values(bodySource.massProperties.inertiaTensorKgMetersSquared).every(Number.isFinite))
      .toBe(true);
    expect(isDeepFrozen(bodySource)).toBe(true);

    const damageEvidence = bodySource.sourceObject.commandEvidence.at(-1);
    const transferEvidence = hit3.admitted.authority.object.commandEvidence.at(-1);
    expect(damageEvidence).toMatchObject({
      status: "Applied",
      resultingObjectRevision: bodySource.sourceObject.objectRevision,
      resultingEditRevision: bodySource.sourceObject.editRevision
    });
    expect(transferEvidence).toMatchObject({
      status: "Applied",
      commandId: hit3.admitted.latestTransition?.status === "Applied"
        ? hit3.admitted.latestTransition.authorityTransfer?.transferCommandId
        : undefined,
      previousObjectRevision: bodySource.sourceObject.objectRevision,
      resultingObjectRevision: hit3.admitted.authority.objectRevision,
      previousEditRevision: bodySource.sourceObject.editRevision,
      resultingEditRevision: hit3.admitted.authority.editRevision
    });
    expect(hit3.admitted.authority.object.commandEvidence).toHaveLength(
      bodySource.sourceObject.commandEvidence.length + 1
    );
    expect(hit3.admitted.latestTransition).toMatchObject({
      status: "Applied",
      structuralCommandId: damageEvidence?.commandId,
      resultingObjectRevision: bodySource.sourceObject.objectRevision,
      resultingEditRevision: bodySource.sourceObject.editRevision,
      resultingContentHash: bodySource.sourceObject.contentHash,
      supportResult: "Detached",
      detachedComponentIds: [bodySource.component.componentId],
      authorityTransfer: {
        previousObjectRevision: bodySource.sourceObject.objectRevision,
        resultingObjectRevision: hit3.admitted.authority.objectRevision,
        previousEditRevision: bodySource.sourceObject.editRevision,
        resultingEditRevision: hit3.admitted.authority.editRevision,
        previousContentHash: bodySource.sourceObject.contentHash,
        resultingContentHash: hit3.admitted.authority.objectContentHash,
        transferredCellCount: bodySource.fragment.occupiedCells.length,
        sourceFragmentIds: [bodySource.fragment.fragmentId]
      }
    });
    expect(hit3.admitted.physicsWorld.bodies).toHaveLength(1);
    const detachedCellKeys = new Set(bodySource.fragment.occupiedCells.map(serializeStructuralCellAddress));
    const currentCellKeys = new Set(surfaceTreeOccupiedCellAddresses(hit3.admitted.authority)
      .map(serializeStructuralCellAddress));
    const sourceCellKeys = new Set(bodySource.sourceObject.bricks.flatMap((brick) => brick.cells.map((cell) =>
      serializeStructuralCellAddress(structuralAddressForBrickCell(brick, cell.localIndex)))));
    expect([...detachedCellKeys].every((cell) => !currentCellKeys.has(cell))).toBe(true);
    expect(sourceCellKeys.size).toBe(currentCellKeys.size + detachedCellKeys.size);
    expect([...sourceCellKeys].every((cell) => currentCellKeys.has(cell) || detachedCellKeys.has(cell)))
      .toBe(true);
    expect(hit3.admitted.collision.cells.every((cell) =>
      !detachedCellKeys.has(serializeStructuralCellAddress(cell.address)))).toBe(true);
    const admittedBody = hit3.admitted.physicsWorld.bodies[0];
    expect(admittedBody.colliders).toHaveLength(55);
    expect(admittedBody.activationSimulationTick).toBe(4);
    expect(admittedBody.positionMeters).toEqual(runtimeSequence.admittedPosition);
    expect(hit3.advanced.physicsWorld.bodies[0].positionMeters).toEqual(admittedBody.positionMeters);
    const dynamicCollider = admittedBody.colliders[0];
    const dynamicCenter = {
      x: admittedBody.positionMeters.x + dynamicCollider.centerMeters.x,
      y: admittedBody.positionMeters.y + dynamicCollider.centerMeters.y,
      z: admittedBody.positionMeters.z + dynamicCollider.centerMeters.z
    };
    expect(raycastSurfaceRigidBodies(hit3.admitted.physicsWorld, {
      originMeters: { ...dynamicCenter, x: dynamicCenter.x - 2 },
      direction: { x: 1, y: 0, z: 0 },
      maximumDistanceMeters: 4
    })).toMatchObject({
      status: "Hit",
      hit: { bodyId: admittedBody.bodyId, componentId: bodySource.component.componentId }
    });
    const currentStaticCell = hit3.admitted.collision.cells[0];
    expect(raycastSurfaceTreeCollision(hit3.admitted.collision, {
      binding: createSurfaceTreeCollisionBinding(hit3.admitted.collision),
      originMeters: {
        x: currentStaticCell.minMeters.x - 2,
        y: (currentStaticCell.minMeters.y + currentStaticCell.maxMeters.y) / 2,
        z: (currentStaticCell.minMeters.z + currentStaticCell.maxMeters.z) / 2
      },
      direction: { x: 1, y: 0, z: 0 },
      maximumDistanceMeters: 4
    })).toMatchObject({ status: "Resolved", kind: "Hit" });
    const activeState = advanceSurfaceTreePhysics(hit3.advanced);
    expect(activeState.physicsWorld.bodies[0].positionMeters.y)
      .toBeLessThan(admittedBody.positionMeters.y);

    const coldArtifact = resolveSurfaceTreeStructuralMeshArtifact(
      hit3.admitted,
      bodySource.meshArtifact.meshArtifactId
    );
    expect(coldArtifact).toBe(bodySource.meshArtifact);
    expect(coldArtifact?.space).toBe("BodyLocal");
    expect(coldArtifact?.mesh.boundsMeters).not.toBeNull();
    expect(isDeepFrozen(coldArtifact)).toBe(true);
    const archivedMeshBytes = JSON.stringify(coldArtifact);

    const hit3Presentation = createSurfaceTreePresentationSnapshot(hit3.admitted, {
      bodyId: initial.object.frame.bodyId,
      regionId: initial.object.frame.regionId,
      surfaceFrameId: initial.object.frame.surfaceFrameId,
      regionRevision: 0,
      simulationTick: 3
    });
    expect(hit3Presentation.components.every((component) =>
      component.anchored && component.bodyId === null)).toBe(true);
    expect(hit3Presentation.bodySources).toHaveLength(1);
    expect(hit3Presentation.dynamicBodies).toHaveLength(1);
    expect(hit3Presentation.objects[0].componentIds)
      .toEqual(hit3Presentation.components.map((component) => component.componentId));

    const hit4 = runtimeSequence.hits[3];
    expect(hit4.supportResult).toBe("Anchored");
    expect(hit4.admitted.authority.objectRevision).toBe(hit3.admitted.authority.objectRevision + 1);
    expect(hit4.admitted.authority.editRevision).toBe(hit3.admitted.authority.editRevision + 1);
    expect(hit4.admitted.latestTransition).toMatchObject({
      status: "Applied",
      supportResult: "Anchored",
      authorityTransfer: null
    });
    expect(hit4.admitted.bodySources).toHaveLength(1);
    expect(hit4.admitted.bodySources[0]).toBe(bodySource);
    expect(hit4.admitted.bodySources[0].sourceObject).toBe(bodySource.sourceObject);
    expect(hit4.admitted.bodySources[0].fragment).toBe(bodySource.fragment);
    expect(hit4.admitted.bodySources[0].candidate.colliders).toBe(bodySource.candidate.colliders);
    expect(hit4.admitted.bodySources[0].meshArtifact).toBe(bodySource.meshArtifact);
    expect(hit4.admitted.physicsWorld.bodies).toHaveLength(1);
    expect(hit4.admitted.physicsWorld.bodies[0].colliders).toBe(admittedBody.colliders);
    expect(resolveSurfaceTreeStructuralMeshArtifact(
      hit4.admitted,
      bodySource.meshArtifact.meshArtifactId
    )).toBe(bodySource.meshArtifact);
    expect(JSON.stringify(hit4.admitted.bodySources[0].meshArtifact)).toBe(archivedMeshBytes);
    expect(hit4.admitted.collision.cells.every((cell) =>
      !detachedCellKeys.has(serializeStructuralCellAddress(cell.address)))).toBe(true);
  }, 180_000);

  it("keeps an archived body renderable when the later current authority is empty", () => {
    const hit3 = applyRuntimeCanonicalSequence(initial, 3).hits[2].admitted;
    const emptyObject = objectWithCells(
      hit3.authority.object,
      new Set(),
      structuralRevision(hit3.authority.objectRevision + 1),
      structuralRevision(hit3.authority.editRevision + 1)
    );
    const emptyAuthority = deriveSurfaceTreeAuthority(initial.tree, emptyObject);
    const emptyState = deepFreeze({
      ...hit3,
      authority: emptyAuthority,
      collision: createSurfaceTreeCollisionSnapshot(emptyAuthority),
      latestTransition: null
    });
    const snapshot = createSurfaceTreePresentationSnapshot(emptyState, {
      bodyId: initial.object.frame.bodyId,
      regionId: initial.object.frame.regionId,
      surfaceFrameId: initial.object.frame.surfaceFrameId,
      regionRevision: 0,
      simulationTick: 4
    });

    expect(emptyAuthority.objectId).toBe(hit3.authority.objectId);
    expect(emptyAuthority.object.bricks.map((brick) => serializeAdaptiveKey(brick.key)))
      .toEqual(hit3.authority.object.bricks.map((brick) => serializeAdaptiveKey(brick.key)));
    expect(emptyAuthority.classification.components).toEqual([]);
    expect(snapshot.components).toEqual([]);
    expect(snapshot.bodySources).toHaveLength(1);
    expect(snapshot.dynamicBodies).toHaveLength(1);
    expect(resolveSurfaceTreeStructuralMeshArtifact(
      emptyState,
      hit3.bodySources[0].meshArtifact.meshArtifactId
    )).toBe(hit3.bodySources[0].meshArtifact);
  }, 180_000);

  it("publishes Damage Empty without transfer, body source, or changed brick coverage", () => {
    const anchorAddress = initial.object.anchors[0].cell;
    const anchorKey = serializeStructuralCellAddress(anchorAddress);
    const singleCellObject = objectWithCells(initial.object, new Set([anchorKey]));
    const singleCellAuthority = deriveSurfaceTreeAuthority(initial.tree, singleCellObject);
    const state = createSurfaceTreeRuntimeStateFromAuthority(singleCellAuthority, physicsWorld());
    const global = globalQuantumForStructuralCell(anchorAddress);
    const voxel = getStructuralVoxel(singleCellObject, anchorAddress);
    if (voxel === undefined || voxel === null) throw new Error("Single-cell Tree fixture lost its anchor voxel.");
    const preflight = preflightSurfaceTreeFire(state, {
      fireCommandId: "fire:tree-runtime:empty",
      hit: {
        address: anchorAddress,
        materialId: voxel.materialId,
        semanticKey: voxel.semanticKey,
        pointMeters: {
          x: (global.x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
          y: (global.y + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
          z: (global.z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS
        },
        normal: { x: 0, y: 1, z: 0 }
      },
      simulationTick: 1
    });

    expect(preflight.status).toBe("Ready");
    if (preflight.status !== "Ready") throw new Error("Single-cell Damage Empty was rejected.");
    expect(preflight.supportResult).toBe("Empty");
    expect(preflight.state.authority.classification.components).toEqual([]);
    expect(preflight.state.authority.object.bricks.map((brick) => serializeAdaptiveKey(brick.key)))
      .toEqual(singleCellObject.bricks.map((brick) => serializeAdaptiveKey(brick.key)));
    expect(preflight.state.bodySources).toEqual([]);
    expect(preflight.state.physicsWorld.bodies).toEqual([]);
    expect(preflight.state.latestTransition).toMatchObject({
      status: "Applied",
      supportResult: "Empty",
      authorityTransfer: null
    });
  }, 60_000);
});
