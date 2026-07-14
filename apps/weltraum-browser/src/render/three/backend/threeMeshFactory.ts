import * as THREE from "three";
import type { MaterialProfile, MeshArtifact } from "../../../presentation";
import type { ThreeMaterialFactory, ThreeMaterialLease } from "./threeMaterialFactory";

export interface PreparedThreeMesh {
  readonly geometry: THREE.BufferGeometry;
  readonly sceneNode: THREE.Mesh;
  readonly materialLease: ThreeMaterialLease;
  dispose(): void;
}

export const prepareThreeMesh = (
  artifact: MeshArtifact,
  materialProfiles: readonly MaterialProfile[],
  materialFactory: ThreeMaterialFactory
): PreparedThreeMesh => {
  const geometry = new THREE.BufferGeometry();
  let lease: ThreeMaterialLease | undefined;
  let disposed = false;
  try {
    const position = new THREE.BufferAttribute(artifact.positions, 3, false);
    const normal = new THREE.BufferAttribute(artifact.normals, 3, false);
    const index = new THREE.BufferAttribute(artifact.indices, 1, false);
    position.setUsage(THREE.StaticDrawUsage);
    normal.setUsage(THREE.StaticDrawUsage);
    index.setUsage(THREE.StaticDrawUsage);
    geometry.setAttribute("position", position);
    geometry.setAttribute("normal", normal);
    geometry.setIndex(index);
    if (artifact.attributes?.uv !== undefined) {
      const uv = new THREE.BufferAttribute(artifact.attributes.uv, 2, false);
      uv.setUsage(THREE.StaticDrawUsage);
      geometry.setAttribute("uv", uv);
    }
    if (artifact.attributes?.color !== undefined) {
      const color = new THREE.BufferAttribute(artifact.attributes.color, 3, false);
      color.setUsage(THREE.StaticDrawUsage);
      geometry.setAttribute("color", color);
    }
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(artifact.bounds.min.x, artifact.bounds.min.y, artifact.bounds.min.z),
      new THREE.Vector3(artifact.bounds.max.x, artifact.bounds.max.y, artifact.bounds.max.z)
    );
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    artifact.materialRanges.forEach((range, materialIndex) => {
      geometry.addGroup(range.startIndex, range.indexCount, materialIndex);
    });
    lease = materialFactory.acquire(materialProfiles);
    const sceneNode = new THREE.Mesh(geometry, [...lease.materials]);
    sceneNode.name = `representation:${artifact.representationKey}`;
    sceneNode.matrixAutoUpdate = true;
    sceneNode.visible = false;
    return Object.freeze({
      geometry,
      sceneNode,
      materialLease: lease,
      dispose: (): void => {
        if (disposed) return;
        disposed = true;
        geometry.dispose();
        lease?.release();
      }
    });
  } catch (error) {
    geometry.dispose();
    lease?.release();
    throw error;
  }
};
