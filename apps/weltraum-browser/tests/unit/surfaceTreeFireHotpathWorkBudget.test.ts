import { describe, expect, it } from "vitest";
import {
  getStructuralVoxel,
  readStructuralMeshDerivationStats
} from "../../src/voxel/structural";
import {
  createSurfaceRigidBodyWorld
} from "../../src/surface-play/physics";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  deriveSurfaceTreeCanonicalHit
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  createSurfaceTreeRuntimeStateFromAuthority,
  preflightSurfaceTreeFire,
  resolveSurfaceTreeStructuralMeshArtifact,
  type SurfaceTreeRuntimeState
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";

const physicsWorld = () => createSurfaceRigidBodyWorld({
  simulationTick: 0,
  gravityMetersPerSecondSquared: 9.81,
  terrainColliders: []
});

const canonicalFire = (
  state: Readonly<SurfaceTreeRuntimeState>,
  ordinal: number
) => {
  const hit = deriveSurfaceTreeCanonicalHit(state.authority, ordinal);
  const voxel = getStructuralVoxel(state.authority.object, hit.address);
  if (voxel === undefined || voxel === null) {
    throw new Error("Canonical Tree hit lost its occupied Structural voxel.");
  }
  return preflightSurfaceTreeFire(state, {
    fireCommandId: `fire:tree-hotpath:${ordinal + 1}`,
    hit: {
      address: hit.address,
      materialId: hit.materialId,
      semanticKey: voxel.semanticKey,
      pointMeters: hit.pointMeters,
      normal: { x: -1, y: 0, z: 0 }
    },
    simulationTick: ordinal + 1
  });
};

const anchoredArtifact = (
  state: Readonly<SurfaceTreeRuntimeState>
) => {
  const component = state.authority.classification.anchoredComponents[0];
  if (component === undefined) throw new Error("Expected an anchored Tree component.");
  const artifact = resolveSurfaceTreeStructuralMeshArtifact(
    state,
    `surface-tree-component-mesh:${component.componentId}:${component.objectRevision}`
  );
  if (artifact === undefined) throw new Error("Anchored Tree mesh artifact was unavailable.");
  return artifact;
};

describe("Surface Tree fire hotpath work budgets", () => {
  it("reuses immutable unchanged Structural brick projections across object revisions", () => {
    let state = createSurfaceTreeRuntimeStateFromAuthority(
      createSurfaceTreeAuthority(createHestiaUmbrellaTree()),
      physicsWorld()
    );
    const initialArtifact = anchoredArtifact(state);
    expect(readStructuralMeshDerivationStats(initialArtifact.mesh)).toMatchObject({
      sourceBrickCount: state.authority.object.bricks.length,
      computedBrickProjectionCount: state.authority.object.bricks.length,
      reusedBrickProjectionCount: 0
    });

    const first = canonicalFire(state, 0);
    expect(first.status).toBe("Ready");
    if (first.status !== "Ready") throw new Error("Canonical first Tree hit was rejected.");
    state = first.state;
    const nextArtifact = anchoredArtifact(state);
    const stats = readStructuralMeshDerivationStats(nextArtifact.mesh);
    expect(stats).toBeDefined();
    expect(stats!.computedBrickProjectionCount + stats!.reusedBrickProjectionCount)
      .toBe(stats!.sourceBrickCount);
    expect(stats!.reusedBrickProjectionCount).toBeGreaterThan(0);
    expect(stats!.computedBrickProjectionCount).toBeLessThan(stats!.sourceBrickCount);
  }, 120_000);

  it("keeps detached BodyLocal render meshing cold until the artifact resolver requests it", () => {
    let state = createSurfaceTreeRuntimeStateFromAuthority(
      createSurfaceTreeAuthority(createHestiaUmbrellaTree()),
      physicsWorld()
    );
    for (let ordinal = 0; ordinal < 3; ordinal += 1) {
      const result = canonicalFire(state, ordinal);
      expect(result.status).toBe("Ready");
      if (result.status !== "Ready") throw new Error("Canonical Tree hit was rejected.");
      state = result.state;
    }

    expect(state.bodySources).toHaveLength(1);
    const bodySource = state.bodySources[0];
    const descriptor = Object.getOwnPropertyDescriptor(bodySource, "meshArtifact");
    expect(descriptor?.get).toBeTypeOf("function");
    expect(descriptor).not.toHaveProperty("value");

    const first = bodySource.meshArtifact;
    const second = resolveSurfaceTreeStructuralMeshArtifact(
      state,
      first.meshArtifactId
    );
    expect(second).toBe(first);
    expect(first.space).toBe("BodyLocal");
    expect(first.mesh.sourceRevision).toBe(bodySource.component.objectRevision);
    expect(first.mesh.sourceContentHash).toBe(bodySource.component.sourceContentHash);
  }, 180_000);
});
