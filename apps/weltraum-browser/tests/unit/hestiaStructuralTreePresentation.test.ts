import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION,
  STRUCTURAL_MESH_SCHEMA_VERSION,
  structuralMaterialId,
  structuralRevision,
  type StructuralMeshProduct
} from "../../src/voxel/structural";
import { createSurfaceStructuralPresentationSnapshot } from "../../src/surface-play/contracts";
import {
  HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES,
  createHestiaStructuralTreePresentation,
  type ResolveSurfaceStructuralMeshArtifact,
  type SurfaceStructuralMeshSpace
} from "../../src/surface-play/environment";

const identity = Object.freeze({
  bodyId: "planet.hestia",
  regionId: "region:hestia.surface-play.v1",
  surfaceFrameId: "frame:surface_hestia_surface_play_v1"
});
const componentId = "component:hestia.umbrella-tree.crown";
const stumpComponentId = "component:hestia.umbrella-tree.stump";
const objectId = "object:hestia.umbrella-tree";
const bodyId = "body:hestia.umbrella-tree.crown";
const hash1 = "fnv1a64-v1:1111111111111111";
const hash2 = "fnv1a64-v1:2222222222222222";

const meshProduct = (sourceRevision: number, sourceContentHash: string): Readonly<StructuralMeshProduct> =>
  Object.freeze({
    schemaVersion: STRUCTURAL_MESH_SCHEMA_VERSION,
    algorithmVersion: STRUCTURAL_GREEDY_MESH_ALGORITHM_VERSION,
    positions: Object.freeze([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 0, 1, 1, 0, 0, 1, 0,
      0, 1, 0, 1, 1, 0, 0.5, 2, 0
    ]),
    normals: Object.freeze(new Array(27).fill(0).map((value, index) => index % 3 === 2 ? 1 : value)),
    indices: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    materialRanges: Object.freeze([
      Object.freeze({ materialId: structuralMaterialId(1), firstIndex: 0, indexCount: 3 }),
      Object.freeze({ materialId: structuralMaterialId(2), firstIndex: 3, indexCount: 3 }),
      Object.freeze({ materialId: structuralMaterialId(3), firstIndex: 6, indexCount: 3 })
    ]),
    boundsMeters: Object.freeze({
      min: Object.freeze({ x: 0, y: 0, z: 0 }),
      max: Object.freeze({ x: 1, y: 2, z: 0 })
    }),
    contentHash: `mesh:${sourceRevision}:${sourceContentHash}`,
    sourceRevision: structuralRevision(sourceRevision),
    sourceContentHash
  });

const resolvedArtifact = (
  meshArtifactId: string,
  space: SurfaceStructuralMeshSpace,
  sourceRevision: number,
  sourceContentHash: string
) => Object.freeze({
  meshArtifactId,
  space,
  mesh: meshProduct(sourceRevision, sourceContentHash)
});

const snapshot = (
  lifecycle: "Attached" | "Falling" | "Resting",
  simulationTick: number,
  emptyCurrent = false
) => {
  const attached = lifecycle === "Attached";
  const objectRevision = attached ? 1 : 3;
  const currentComponents = attached
    ? [{
        componentId,
        objectId,
        sourceObjectRevision: objectRevision,
        sourceContentHash: hash1,
        anchored: true as const,
        bodyId: null,
        meshArtifactId: "mesh:hestia.tree.attached"
      }]
    : emptyCurrent
      ? []
      : [{
          componentId: stumpComponentId,
          objectId,
          sourceObjectRevision: objectRevision,
          sourceContentHash: hash1,
          anchored: true as const,
          bodyId: null,
          meshArtifactId: "mesh:hestia.tree.stump"
        }];
  return createSurfaceStructuralPresentationSnapshot({
    ...identity,
    regionRevision: 4,
    objects: [{
      objectId,
      treeInstanceId: "tree:hestia.umbrella.fixture",
      speciesId: "hestia.umbrella-tree.v1",
      objectRevision,
      editRevision: objectRevision,
      contentHash: hash1,
      componentIds: currentComponents.map((component) => component.componentId),
      meshArtifactId: `mesh:hestia.tree.object:${objectRevision}`
    }],
    components: currentComponents,
    bodySources: attached ? [] : [{
      componentId,
      sourceFragmentId: "fragment:hestia.umbrella-tree.crown",
      bodyId,
      objectId,
      sourceObjectRevision: 2,
      sourceContentHash: hash2,
      colliderRevision: 2,
      meshArtifactId: "mesh:hestia.tree.detached"
    }],
    dynamicBodies: attached ? [] : [{
      bodyId,
      componentId,
      objectId,
      sourceObjectRevision: 2,
      sourceContentHash: hash2,
      lifecycle,
      positionMeters: lifecycle === "Falling" ? { x: 4, y: 7, z: 2 } : { x: 5, y: 0.75, z: 3 },
      orientation: lifecycle === "Falling"
        ? { x: 0, y: 0, z: 0, w: 1 }
        : { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
      linearVelocityMetersPerSecond: lifecycle === "Falling"
        ? { x: 0.2, y: -2, z: 0 }
        : { x: 0, y: 0, z: 0 },
      angularVelocityRadiansPerSecond: lifecycle === "Falling"
        ? { x: 0, y: 0.1, z: 0 }
        : { x: 0, y: 0, z: 0 },
      colliderRevision: 2,
      simulationTick
    }],
    latestTransition: null,
    physicsFailure: null,
    simulationTick
  });
};

const resolver = (): ResolveSurfaceStructuralMeshArtifact => {
  const artifacts = new Map([
    ["mesh:hestia.tree.attached", resolvedArtifact("mesh:hestia.tree.attached", "World", 1, hash1)],
    ["mesh:hestia.tree.stump", resolvedArtifact("mesh:hestia.tree.stump", "World", 3, hash1)],
    ["mesh:hestia.tree.detached", resolvedArtifact("mesh:hestia.tree.detached", "BodyLocal", 2, hash2)]
  ]);
  return (meshArtifactId) => artifacts.get(meshArtifactId);
};

describe("Hestia Structural Umbrella Tree presentation", () => {
  it("renders only component artifacts and follows Attached, Falling and Resting snapshots", () => {
    const parent = new THREE.Group();
    const presentation = createHestiaStructuralTreePresentation(parent, identity, resolver());

    const attached = snapshot("Attached", 10);
    expect(presentation.sync(attached)).toBe("Applied");
    const root = parent.getObjectByName(HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.root) as THREE.Group;
    expect(root.children).toHaveLength(1);
    const attachedMesh = root.children[0] as THREE.Mesh;
    expect(attachedMesh.userData).toMatchObject({
      lifecycle: "Attached",
      coordinateSpace: "World",
      meshArtifactId: "mesh:hestia.tree.attached"
    });
    expect(attachedMesh.position.toArray()).toEqual([0, 0, 0]);
    expect(attachedMesh.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(attachedMesh.geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1, 2]);
    const materials = attachedMesh.material as THREE.MeshStandardMaterial[];
    expect(materials.map((material) => material.color.getHex())).toEqual([0x4b3928, 0x704c30, 0x49a889]);
    expect(materials.every((material) => material.color.getHex() !== 0x000000)).toBe(true);

    const falling = snapshot("Falling", 11);
    expect(presentation.sync(falling)).toBe("Applied");
    expect(root.children).toHaveLength(2);
    const fallingMesh = root.children.find((child) =>
      child.userData.componentId === componentId) as THREE.Mesh;
    const stumpMesh = root.children.find((child) =>
      child.userData.componentId === stumpComponentId) as THREE.Mesh;
    expect(fallingMesh.userData).toMatchObject({
      lifecycle: "Falling",
      coordinateSpace: "BodyLocal",
      bodyId
    });
    expect(fallingMesh.position.toArray()).toEqual([4, 7, 2]);
    expect(fallingMesh.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(stumpMesh.userData).toMatchObject({
      lifecycle: "Attached",
      coordinateSpace: "World",
      bodyId: null
    });
    expect(stumpMesh.position.toArray()).toEqual([0, 0, 0]);

    const fallingGeometry = fallingMesh.geometry;
    const resting = snapshot("Resting", 131);
    expect(presentation.sync(resting)).toBe("Applied");
    const restingMesh = root.children.find((child) =>
      child.userData.componentId === componentId) as THREE.Mesh;
    expect(restingMesh.geometry).toBe(fallingGeometry);
    expect(restingMesh.userData.lifecycle).toBe("Resting");
    expect(restingMesh.position.toArray()).toEqual([5, 0.75, 3]);
    expect(restingMesh.quaternion.y).toBeCloseTo(Math.SQRT1_2, 12);

    const bodyOnly = snapshot("Resting", 132, true);
    expect(presentation.sync(bodyOnly)).toBe("Applied");
    expect(root.children).toHaveLength(1);
    const bodyOnlyMesh = root.children[0] as THREE.Mesh;
    expect(bodyOnlyMesh.userData.componentId).toBe(componentId);
    expect(bodyOnlyMesh.geometry).toBe(fallingGeometry);

    expect(presentation.sync(falling)).toBe("Stale");
    expect(bodyOnlyMesh.userData.lifecycle).toBe("Resting");
    expect(bodyOnlyMesh.position.toArray()).toEqual([5, 0.75, 3]);
    presentation.dispose();
  });

  it("fails closed on missing or wrong-space artifacts without inventing renderer truth", () => {
    const parent = new THREE.Group();
    const wrongSpace = resolvedArtifact("mesh:hestia.tree.attached", "BodyLocal", 1, hash1);
    const presentation = createHestiaStructuralTreePresentation(
      parent,
      identity,
      () => wrongSpace
    );
    const root = parent.getObjectByName(HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.root) as THREE.Group;

    expect(() => presentation.sync(snapshot("Attached", 10))).toThrow(/must use World coordinates/);
    expect(root.children).toHaveLength(0);
    expect(presentation.sync(createSurfaceStructuralPresentationSnapshot({
      ...snapshot("Attached", 10),
      regionId: "region:hestia.other"
    }))).toBe("IdentityMismatch");
    expect(Object.keys(presentation).sort()).toEqual(["dispose", "sync"]);
    expect(Object.keys(presentation).join(" ")).not.toMatch(/collision|damage|edit|command/i);
    presentation.dispose();
  });

  it("disposes owned geometry and shared materials exactly once", () => {
    const parent = new THREE.Group();
    const presentation = createHestiaStructuralTreePresentation(parent, identity, resolver());
    presentation.sync(snapshot("Attached", 10));
    const root = parent.getObjectByName(HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.root) as THREE.Group;
    const mesh = root.children[0] as THREE.Mesh;
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    const materialDisposals = (mesh.material as THREE.Material[]).map((material) => vi.spyOn(material, "dispose"));

    presentation.dispose();
    presentation.dispose();

    expect(parent.getObjectByName(HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.root)).toBeUndefined();
    expect(geometryDispose).toHaveBeenCalledOnce();
    materialDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });
});
