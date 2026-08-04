import { hashAdaptiveCanonical } from "../../voxel/adaptive";
import { serializeStructuralCellAddress } from "../../voxel/structural";
import type { SurfaceCollisionDelegate } from "../collision";
import type {
  SurfaceCapsuleSweepQuery,
  SurfaceContactInput,
  SurfaceGroundContactQuery,
  SurfaceLineQuery,
  SurfaceRayQuery
} from "../contracts";
import {
  querySurfaceRigidBodyGroundContact,
  raycastSurfaceRigidBodies,
  sweepSurfaceRigidBodyCapsule,
  type SurfaceRigidBodyWorld
} from "../physics";
import {
  createSurfaceTreeCollisionBinding,
  raycastSurfaceTreeCollision,
  sweepSurfaceTreeCapsule,
  type SurfaceTreeCollisionHit,
  type SurfaceTreeCollisionSnapshot
} from "./surfaceTreeCollision";

const EPSILON = 1e-9;
const SURFACE_TREE_CONTACT_COLLIDER_ID_DOMAIN = "surface-tree-contact-collider";
const SURFACE_TREE_CONTACT_COLLIDER_ID_SCHEMA_VERSION = 1;

const magnitude = (value: Readonly<{ x: number; y: number; z: number }>): number =>
  Math.hypot(value.x, value.y, value.z);

const unitOpposite = (
  value: Readonly<{ x: number; y: number; z: number }>
): Readonly<{ x: number; y: number; z: number }> => {
  const length = magnitude(value);
  return length <= EPSILON
    ? Object.freeze({ x: 0, y: 1, z: 0 })
    : Object.freeze({ x: -value.x / length, y: -value.y / length, z: -value.z / length });
};

const hitNormal = (
  hit: Readonly<SurfaceTreeCollisionHit>,
  fallbackDirection: Readonly<{ x: number; y: number; z: number }>
) => magnitude(hit.normal) <= EPSILON ? unitOpposite(fallbackDirection) : hit.normal;

const colliderId = (
  snapshot: Readonly<SurfaceTreeCollisionSnapshot>,
  hit: Readonly<SurfaceTreeCollisionHit>
): string => `structural-tree:${hashAdaptiveCanonical({
  domain: SURFACE_TREE_CONTACT_COLLIDER_ID_DOMAIN,
  schemaVersion: SURFACE_TREE_CONTACT_COLLIDER_ID_SCHEMA_VERSION,
  objectId: snapshot.binding.objectId,
  objectRevision: snapshot.binding.objectRevision,
  objectContentHash: snapshot.binding.objectContentHash,
  cellAddress: serializeStructuralCellAddress(hit.address)
})}`;

export const createAttachedSurfaceTreeCollisionDelegate = (
  options: Readonly<{
    readonly terrain: SurfaceCollisionDelegate;
    readonly tree: Readonly<SurfaceTreeCollisionSnapshot>;
    readonly physicsWorld: Readonly<SurfaceRigidBodyWorld>;
  }>
): SurfaceCollisionDelegate => {
  const { terrain, tree, physicsWorld } = options;
  const binding = createSurfaceTreeCollisionBinding(tree);

  const sweepCapsule = (query: SurfaceCapsuleSweepQuery) => {
    const terrainResult = terrain.sweepCapsule(query);
    if (terrainResult.status === "Rejected") return terrainResult;
    const endMeters = {
      x: query.startPositionMeters.x + query.displacementMeters.x,
      y: query.startPositionMeters.y + query.displacementMeters.y,
      z: query.startPositionMeters.z + query.displacementMeters.z
    };
    const structural = sweepSurfaceTreeCapsule(tree, {
      binding,
      startMeters: query.startPositionMeters,
      endMeters,
      capsule: query.capsule
    });
    if (structural.status === "Rejected") {
      return {
        status: "Rejected" as const,
        queryId: query.queryId,
        code: "AuthorityUnavailable" as const,
        message: "Structural Tree collision is stale or unavailable."
      };
    }
    const body = sweepSurfaceRigidBodyCapsule(physicsWorld, {
      capsule: query.capsule,
      startPositionMeters: query.startPositionMeters,
      displacementMeters: query.displacementMeters
    });
    const candidates = [{
      rank: 2,
      fraction: terrainResult.fraction,
      result: terrainResult
    }];
    if (structural.hit !== null) {
      const distanceMeters = magnitude(query.displacementMeters) * structural.fraction;
      candidates.push({
        rank: 0,
        fraction: structural.fraction,
        result: {
          status: "Resolved" as const,
          queryId: query.queryId,
          fraction: structural.fraction,
          contact: {
            pointMeters: structural.hit.pointMeters,
            normal: hitNormal(structural.hit, query.displacementMeters),
            distanceMeters,
            colliderId: colliderId(tree, structural.hit)
          }
        }
      });
    }
    if (body.status === "Hit") {
      candidates.push({
        rank: 1,
        fraction: body.fraction,
        result: {
          status: "Resolved" as const,
          queryId: query.queryId,
          fraction: body.fraction,
          contact: {
            pointMeters: body.hit.pointMeters,
            normal: magnitude(body.hit.normal) <= EPSILON
              ? unitOpposite(query.displacementMeters)
              : body.hit.normal,
            distanceMeters: body.hit.distanceMeters,
            colliderId: [
              "structural-body",
              body.hit.bodyId,
              body.hit.colliderIndex
            ].join(":")
          }
        }
      });
    }
    return candidates.sort((left, right) =>
      left.fraction - right.fraction || left.rank - right.rank)[0].result;
  };

  const ray = (
    query: SurfaceRayQuery | Readonly<{
      readonly queryId: string;
      readonly originMeters: SurfaceRayQuery["originMeters"];
      readonly direction: SurfaceRayQuery["direction"];
      readonly maximumDistanceMeters: number;
    }>,
    terrainResult: ReturnType<SurfaceCollisionDelegate["queryRay"]>
  ) => {
    if (terrainResult.status === "Rejected") return terrainResult;
    const structural = raycastSurfaceTreeCollision(tree, {
      binding,
      originMeters: query.originMeters,
      direction: query.direction,
      maximumDistanceMeters: query.maximumDistanceMeters
    });
    if (structural.status === "Rejected") {
      return {
        status: "Rejected" as const,
        queryId: query.queryId,
        code: "AuthorityUnavailable" as const,
        message: "Structural Tree ray authority is stale or unavailable."
      };
    }
    const body = raycastSurfaceRigidBodies(physicsWorld, {
      originMeters: query.originMeters,
      direction: query.direction,
      maximumDistanceMeters: query.maximumDistanceMeters
    });
    const candidates: Array<{
      rank: number;
      distanceMeters: number;
      contact: SurfaceContactInput | null;
    }> = [{
      rank: 2,
      distanceMeters: terrainResult.contact?.distanceMeters ?? Number.POSITIVE_INFINITY,
      contact: terrainResult.contact
    }];
    if (structural.kind === "Hit") {
      candidates.push({
        rank: 0,
        distanceMeters: structural.distanceMeters,
        contact: {
          pointMeters: structural.hit.pointMeters,
          normal: hitNormal(structural.hit, query.direction),
          distanceMeters: structural.distanceMeters,
          colliderId: colliderId(tree, structural.hit)
        }
      });
    }
    if (body.status === "Hit") {
      candidates.push({
        rank: 1,
        distanceMeters: body.hit.distanceMeters,
        contact: {
          pointMeters: body.hit.pointMeters,
          normal: magnitude(body.hit.normal) <= EPSILON
            ? unitOpposite(query.direction)
            : body.hit.normal,
          distanceMeters: body.hit.distanceMeters,
          colliderId: [
            "structural-body",
            body.hit.bodyId,
            body.hit.colliderIndex
          ].join(":")
        }
      });
    }
    const nearest = candidates.sort((left, right) =>
      left.distanceMeters - right.distanceMeters || left.rank - right.rank)[0];
    return {
      status: "Resolved" as const,
      queryId: query.queryId,
      contact: nearest.contact
    };
  };

  const queryRay = (query: SurfaceRayQuery) => ray(query, terrain.queryRay(query));

  const queryLine = (query: SurfaceLineQuery) => {
    const delta = {
      x: query.endMeters.x - query.startMeters.x,
      y: query.endMeters.y - query.startMeters.y,
      z: query.endMeters.z - query.startMeters.z
    };
    const length = magnitude(delta);
    const direction = {
      x: delta.x / length,
      y: delta.y / length,
      z: delta.z / length
    };
    return ray({
      queryId: query.queryId,
      originMeters: query.startMeters,
      direction,
      maximumDistanceMeters: length
    }, terrain.queryLine(query));
  };

  const queryGroundContact = (query: SurfaceGroundContactQuery) => {
    const terrainResult = terrain.queryGroundContact(query);
    if (terrainResult.status === "Rejected") return terrainResult;
    const body = querySurfaceRigidBodyGroundContact(physicsWorld, {
      capsule: query.capsule,
      positionMeters: query.positionMeters,
      maximumDistanceMeters: query.maximumDistanceMeters
    });
    if (body.status === "Miss") return terrainResult;
    const bodyContact: SurfaceContactInput = {
      pointMeters: body.hit.pointMeters,
      normal: magnitude(body.hit.normal) <= EPSILON
        ? Object.freeze({ x: 0, y: 1, z: 0 })
        : body.hit.normal,
      distanceMeters: body.hit.distanceMeters,
      colliderId: [
        "structural-body",
        body.hit.bodyId,
        body.hit.colliderIndex
      ].join(":")
    };
    const terrainDistance = terrainResult.contact?.distanceMeters ?? Number.POSITIVE_INFINITY;
    return {
      status: "Resolved" as const,
      queryId: query.queryId,
      contact: bodyContact.distanceMeters <= terrainDistance
        ? bodyContact
        : terrainResult.contact
    };
  };

  return Object.freeze({
    queryGroundContact,
    sweepCapsule,
    queryRay,
    queryLine
  });
};
