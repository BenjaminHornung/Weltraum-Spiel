import * as THREE from "three";
import type { StructuralMeshProduct } from "../../voxel/structural";
import type { SurfaceStructuralPresentationSnapshot } from "../contracts";
import type { HestiaSurfaceEnvironmentIdentity } from "./hestiaSurfaceEnvironment";

export const HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES = Object.freeze({
  root: "hestia-surface-structural-tree-presentation",
  componentPrefix: "hestia-surface-structural-tree-component",
  rootMaterial: "hestia-surface-structural-root-material",
  woodMaterial: "hestia-surface-structural-wood-material",
  canopyMaterial: "hestia-surface-structural-canopy-material"
} as const);

export type SurfaceStructuralMeshSpace = "World" | "BodyLocal";

export interface SurfaceStructuralResolvedMeshArtifact {
  readonly meshArtifactId: string;
  readonly space: SurfaceStructuralMeshSpace;
  readonly mesh: Readonly<StructuralMeshProduct>;
}

export type ResolveSurfaceStructuralMeshArtifact = (
  meshArtifactId: string
) => Readonly<SurfaceStructuralResolvedMeshArtifact> | undefined;

export type HestiaStructuralTreePresentationSyncResult =
  | "Applied"
  | "Unchanged"
  | "Stale"
  | "IdentityMismatch"
  | "Disposed";

export interface HestiaStructuralTreePresentation {
  sync(
    snapshot: Readonly<SurfaceStructuralPresentationSnapshot>
  ): HestiaStructuralTreePresentationSyncResult;
  dispose(): void;
}

type DynamicBody = SurfaceStructuralPresentationSnapshot["dynamicBodies"][number];

interface StructuralRenderable {
  readonly componentId: string;
  readonly objectId: string;
  readonly sourceObjectRevision: number;
  readonly sourceContentHash: string;
  readonly anchored: boolean;
  readonly bodyId: string | null;
  readonly meshArtifactId: string;
}

interface ResolvedComponent {
  readonly component: Readonly<StructuralRenderable>;
  readonly body: DynamicBody | null;
  readonly lifecycle: "Attached" | "Falling" | "Resting";
  readonly artifact: Readonly<SurfaceStructuralResolvedMeshArtifact>;
}

interface ComponentMeshRecord {
  readonly meshArtifactId: string;
  readonly sourceRevision: number;
  readonly sourceContentHash: string;
  readonly meshContentHash: string;
  readonly object: THREE.Mesh;
}

const MATERIAL_INDEX_BY_ID = new Map<number, number>([
  [1, 0],
  [2, 1],
  [3, 2]
]);

const finiteArray = (values: readonly number[], path: string): void => {
  if (!Object.isFrozen(values) || !values.every(Number.isFinite)) {
    throw new TypeError(`${path} must be an immutable finite array.`);
  }
};

const validateArtifact = (
  component: Readonly<StructuralRenderable>,
  body: DynamicBody | null,
  artifact: Readonly<SurfaceStructuralResolvedMeshArtifact> | undefined
): Readonly<SurfaceStructuralResolvedMeshArtifact> => {
  if (artifact === undefined) {
    throw new Error(`Structural mesh artifact is unavailable: ${component.meshArtifactId}`);
  }
  if (!Object.isFrozen(artifact) || artifact.meshArtifactId !== component.meshArtifactId) {
    throw new TypeError(`Structural resolver returned a mutable or mismatched artifact for ${component.meshArtifactId}.`);
  }
  const expectedSpace: SurfaceStructuralMeshSpace = component.anchored ? "World" : "BodyLocal";
  if (artifact.space !== expectedSpace) {
    throw new TypeError(`${component.meshArtifactId} must use ${expectedSpace} coordinates.`);
  }
  if (component.anchored ? body !== null : body === null) {
    throw new TypeError(`${component.componentId} has inconsistent Structural body facts.`);
  }

  const mesh = artifact.mesh;
  if (!Object.isFrozen(mesh)
    || mesh.sourceRevision !== component.sourceObjectRevision
    || mesh.sourceContentHash !== component.sourceContentHash) {
    throw new TypeError(`${component.meshArtifactId} does not bind the published Structural revision and hash.`);
  }
  finiteArray(mesh.positions, `${component.meshArtifactId}.positions`);
  finiteArray(mesh.normals, `${component.meshArtifactId}.normals`);
  finiteArray(mesh.indices, `${component.meshArtifactId}.indices`);
  if (mesh.positions.length === 0
    || mesh.positions.length % 3 !== 0
    || mesh.normals.length !== mesh.positions.length
    || mesh.indices.length === 0
    || mesh.indices.length % 3 !== 0) {
    throw new TypeError(`${component.meshArtifactId} has invalid triangle buffers.`);
  }
  const vertexCount = mesh.positions.length / 3;
  if (!mesh.indices.every((index) => Number.isSafeInteger(index) && index >= 0 && index < vertexCount)) {
    throw new TypeError(`${component.meshArtifactId} has an out-of-range triangle index.`);
  }
  if (!Object.isFrozen(mesh.materialRanges) || mesh.materialRanges.length === 0) {
    throw new TypeError(`${component.meshArtifactId} must have immutable material ranges.`);
  }
  let rangeCursor = 0;
  for (const range of mesh.materialRanges) {
    if (!Object.isFrozen(range)
      || range.firstIndex !== rangeCursor
      || !Number.isSafeInteger(range.indexCount)
      || range.indexCount <= 0
      || range.indexCount % 3 !== 0
      || !MATERIAL_INDEX_BY_ID.has(range.materialId)) {
      throw new TypeError(`${component.meshArtifactId} has invalid or unsupported material ranges.`);
    }
    rangeCursor += range.indexCount;
  }
  if (rangeCursor !== mesh.indices.length) {
    throw new TypeError(`${component.meshArtifactId} material ranges must cover every triangle exactly once.`);
  }
  return artifact;
};

const createGeometry = (artifact: Readonly<SurfaceStructuralResolvedMeshArtifact>): THREE.BufferGeometry => {
  const product = artifact.mesh;
  const geometry = new THREE.BufferGeometry();
  geometry.name = `${artifact.meshArtifactId}:geometry`;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(product.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(product.normals, 3));
  geometry.setIndex([...product.indices]);
  geometry.clearGroups();
  for (const range of product.materialRanges) {
    const materialIndex = MATERIAL_INDEX_BY_ID.get(range.materialId);
    if (materialIndex === undefined) throw new TypeError(`Unsupported Structural material ${range.materialId}.`);
    geometry.addGroup(range.firstIndex, range.indexCount, materialIndex);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const createMaterials = (): readonly THREE.MeshStandardMaterial[] => {
  const root = new THREE.MeshStandardMaterial({
    color: 0x4b3928,
    roughness: 0.94,
    metalness: 0,
    flatShading: true
  });
  root.name = HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.rootMaterial;
  const wood = new THREE.MeshStandardMaterial({
    color: 0x704c30,
    roughness: 0.9,
    metalness: 0,
    flatShading: true
  });
  wood.name = HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.woodMaterial;
  const canopy = new THREE.MeshStandardMaterial({
    color: 0x49a889,
    roughness: 0.86,
    metalness: 0,
    flatShading: true
  });
  canopy.name = HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.canopyMaterial;
  return Object.freeze([root, wood, canopy]);
};

const sameArtifact = (
  record: ComponentMeshRecord,
  component: Readonly<StructuralRenderable>,
  artifact: Readonly<SurfaceStructuralResolvedMeshArtifact>
): boolean => record.meshArtifactId === component.meshArtifactId
  && record.sourceRevision === component.sourceObjectRevision
  && record.sourceContentHash === component.sourceContentHash
  && record.meshContentHash === artifact.mesh.contentHash;

export const createHestiaStructuralTreePresentation = (
  parent: THREE.Object3D,
  identity: Readonly<HestiaSurfaceEnvironmentIdentity>,
  resolveStructuralMeshArtifact: ResolveSurfaceStructuralMeshArtifact
): HestiaStructuralTreePresentation => {
  const root = new THREE.Group();
  root.name = HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.root;
  parent.add(root);
  const materials = createMaterials();
  let records = new Map<string, ComponentMeshRecord>();
  let lastSnapshot: Readonly<SurfaceStructuralPresentationSnapshot> | null = null;
  let lastRegionRevision = -1;
  let lastSimulationTick = -1;
  let disposed = false;

  const sync = (
    snapshot: Readonly<SurfaceStructuralPresentationSnapshot>
  ): HestiaStructuralTreePresentationSyncResult => {
    if (disposed) return "Disposed";
    if (snapshot.bodyId !== identity.bodyId
      || snapshot.regionId !== identity.regionId
      || snapshot.surfaceFrameId !== identity.surfaceFrameId) {
      return "IdentityMismatch";
    }
    if (snapshot.regionRevision < lastRegionRevision || snapshot.simulationTick < lastSimulationTick) {
      return "Stale";
    }
    if (snapshot === lastSnapshot) return "Unchanged";

    const bodyById = new Map<string, DynamicBody>(
      snapshot.dynamicBodies.map((body) => [String(body.bodyId), body])
    );
    const renderables: readonly Readonly<StructuralRenderable>[] = [
      ...snapshot.components.map((component) => ({ ...component })),
      ...snapshot.bodySources.map((bodySource) => ({
        componentId: bodySource.componentId,
        objectId: bodySource.objectId,
        sourceObjectRevision: bodySource.sourceObjectRevision,
        sourceContentHash: bodySource.sourceContentHash,
        anchored: false,
        bodyId: bodySource.bodyId,
        meshArtifactId: bodySource.meshArtifactId
      }))
    ].sort((left, right) => left.componentId < right.componentId ? -1 : left.componentId > right.componentId ? 1 : 0);
    const resolved: ResolvedComponent[] = renderables.map((component) => {
      const body = component.bodyId === null ? null : bodyById.get(component.bodyId) ?? null;
      const artifact = validateArtifact(
        component,
        body,
        resolveStructuralMeshArtifact(component.meshArtifactId)
      );
      return {
        component,
        body,
        lifecycle: body?.lifecycle ?? "Attached",
        artifact
      };
    });

    const nextRecords = new Map<string, ComponentMeshRecord>();
    const created: THREE.Mesh[] = [];
    try {
      for (const item of resolved) {
        const previous = records.get(item.component.componentId);
        let record: ComponentMeshRecord;
        if (previous !== undefined && sameArtifact(previous, item.component, item.artifact)) {
          record = previous;
        } else {
          const object = new THREE.Mesh(createGeometry(item.artifact), [...materials]);
          object.name = `${HESTIA_STRUCTURAL_TREE_PRESENTATION_NAMES.componentPrefix}:${item.component.componentId}`;
          created.push(object);
          record = {
            meshArtifactId: item.component.meshArtifactId,
            sourceRevision: item.component.sourceObjectRevision,
            sourceContentHash: item.component.sourceContentHash,
            meshContentHash: item.artifact.mesh.contentHash,
            object
          };
        }
        nextRecords.set(item.component.componentId, record);
      }
    } catch (error) {
      created.forEach((object) => object.geometry.dispose());
      throw error;
    }

    for (const [componentId, previous] of records) {
      if (nextRecords.get(componentId) === previous) continue;
      root.remove(previous.object);
      previous.object.geometry.dispose();
    }
    for (const item of resolved) {
      const record = nextRecords.get(item.component.componentId);
      if (record === undefined) throw new Error(`Prepared Structural component disappeared: ${item.component.componentId}`);
      if (record.object.parent !== root) root.add(record.object);
      if (item.body === null) {
        record.object.position.set(0, 0, 0);
        record.object.quaternion.identity();
      } else {
        record.object.position.set(
          item.body.positionMeters.x,
          item.body.positionMeters.y,
          item.body.positionMeters.z
        );
        record.object.quaternion.set(
          item.body.orientation.x,
          item.body.orientation.y,
          item.body.orientation.z,
          item.body.orientation.w
        );
      }
      record.object.userData = {
        source: "SurfaceStructuralPresentationSnapshot",
        componentId: item.component.componentId,
        objectId: item.component.objectId,
        meshArtifactId: item.component.meshArtifactId,
        lifecycle: item.lifecycle,
        bodyId: item.component.bodyId,
        coordinateSpace: item.artifact.space,
        simulationTick: snapshot.simulationTick
      };
    }

    records = nextRecords;
    lastSnapshot = snapshot;
    lastRegionRevision = snapshot.regionRevision;
    lastSimulationTick = snapshot.simulationTick;
    return "Applied";
  };

  return {
    sync,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const record of records.values()) record.object.geometry.dispose();
      materials.forEach((material) => material.dispose());
      records.clear();
      parent.remove(root);
      root.clear();
      lastSnapshot = null;
    }
  };
};
