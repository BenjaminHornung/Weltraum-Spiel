import type { StructuralPartId } from "../../../voxel/structural";
import {
  HESTIA_VEGETATION_SCHEMA_VERSION,
  type HestiaVegetationInstance,
  type HestiaVegetationMaterialRole,
  type HestiaVegetationProxy,
  type HestiaVegetationProxyPart,
  type HestiaVegetationProxyShape
} from "./contracts";
import {
  freezeHestiaVegetationValue,
  hashHestiaVegetationCanonical
} from "./canonical";
import { createHestiaUmbrellaTreeGraph } from "./graph";
import { hestiaVegetationSpeciesId } from "./validation";

interface ProxyPartInput {
  readonly partId?: StructuralPartId;
  readonly role: HestiaVegetationProxyPart["role"];
  readonly materialRole: HestiaVegetationMaterialRole;
  readonly shape: HestiaVegetationProxyShape;
  readonly center: Readonly<{ x: number; y: number; z: number }>;
  readonly dimensions: Readonly<{ x: number; y: number; z: number }>;
  readonly yawRadians?: number;
  readonly pitchRadians?: number;
  readonly sourceNodeId?: string;
  readonly sourceSegmentId?: string;
}

const proxyPart = (
  instance: HestiaVegetationInstance,
  index: number,
  input: ProxyPartInput
): HestiaVegetationProxyPart => freezeHestiaVegetationValue({
  partId: input.partId ?? `hestia.vegetation.proxy-part.v1:${hashHestiaVegetationCanonical({
    instanceHash: instance.instanceHash,
    index,
    role: input.role
  }).slice(-16)}` as StructuralPartId,
  role: input.role,
  materialRole: input.materialRole,
  shape: input.shape,
  centerMeters: input.center,
  dimensionsMeters: input.dimensions,
  yawRadians: input.yawRadians ?? 0,
  pitchRadians: input.pitchRadians ?? 0,
  sourceNodeId: input.sourceNodeId ?? null,
  sourceSegmentId: input.sourceSegmentId ?? null
});

const umbrellaParts = (instance: HestiaVegetationInstance): readonly HestiaVegetationProxyPart[] => {
  const graph = createHestiaUmbrellaTreeGraph(instance);
  const nodes = new Map(graph.nodes.map((node) => [node.nodeId, node] as const));
  const parts = graph.segments.map((segment, index) => {
    const parent = nodes.get(segment.parentNodeId);
    const child = nodes.get(segment.childNodeId);
    if (parent === undefined || child === undefined) throw new TypeError("Umbrella proxy segment endpoint is missing.");
    const dx = child.positionMeters.x - parent.positionMeters.x;
    const dy = child.positionMeters.y - parent.positionMeters.y;
    const dz = child.positionMeters.z - parent.positionMeters.z;
    const length = Math.hypot(dx, dy, dz);
    const lobe = segment.lobeRadiiMeters;
    return proxyPart(instance, index, {
      partId: segment.segmentId as StructuralPartId,
      role: segment.role === "primary" || segment.role === "secondary" ? "branch" : segment.role,
      materialRole: segment.materialRole,
      shape: segment.shape,
      center: lobe === null ? {
        x: (parent.positionMeters.x + child.positionMeters.x) / 2,
        y: (parent.positionMeters.y + child.positionMeters.y) / 2,
        z: (parent.positionMeters.z + child.positionMeters.z) / 2
      } : child.positionMeters,
      dimensions: lobe === null ? {
        x: Math.max(segment.startRadiusMeters, segment.endRadiusMeters) * 2,
        y: length,
        z: Math.max(segment.startRadiusMeters, segment.endRadiusMeters) * 2
      } : { x: lobe.x * 2, y: lobe.y * 2, z: lobe.z * 2 },
      yawRadians: Math.atan2(dz, dx),
      pitchRadians: length === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dy / length))),
      sourceNodeId: child.nodeId,
      sourceSegmentId: segment.segmentId
    });
  });
  return freezeHestiaVegetationValue(parts);
};

const mistSproutParts = (instance: HestiaVegetationInstance): readonly HestiaVegetationProxyPart[] =>
  freezeHestiaVegetationValue([
    proxyPart(instance, 0, {
      role: "root",
      materialRole: "root",
      shape: "disc",
      center: { x: instance.positionMeters.x, y: instance.positionMeters.y, z: instance.positionMeters.z },
      dimensions: { x: 0.45, y: 0.12, z: 0.45 }
    }),
    proxyPart(instance, 1, {
      role: "stem",
      materialRole: "wood",
      shape: "capsule",
      center: { x: instance.positionMeters.x, y: instance.positionMeters.y + 0.55, z: instance.positionMeters.z },
      dimensions: { x: 0.16, y: 1.1, z: 0.16 }
    }),
    ...[0, 1, 2].map((index) => {
      const yaw = index * Math.PI * 2 / 3;
      return proxyPart(instance, index + 2, {
        role: "leaf",
        materialRole: "canopy",
        shape: "ellipsoid",
        center: {
          x: instance.positionMeters.x + Math.cos(yaw) * 0.34,
          y: instance.positionMeters.y + 0.78,
          z: instance.positionMeters.z + Math.sin(yaw) * 0.34
        },
        dimensions: { x: 0.65, y: 0.18, z: 0.28 },
        yawRadians: yaw
      });
    })
  ]);

const luminousCapParts = (instance: HestiaVegetationInstance): readonly HestiaVegetationProxyPart[] =>
  freezeHestiaVegetationValue([
    proxyPart(instance, 0, {
      role: "root",
      materialRole: "root",
      shape: "disc",
      center: { x: instance.positionMeters.x, y: instance.positionMeters.y, z: instance.positionMeters.z },
      dimensions: { x: 0.5, y: 0.12, z: 0.5 }
    }),
    proxyPart(instance, 1, {
      role: "stem",
      materialRole: "wood",
      shape: "capsule",
      center: { x: instance.positionMeters.x, y: instance.positionMeters.y + 0.48, z: instance.positionMeters.z },
      dimensions: { x: 0.22, y: 0.9, z: 0.22 }
    }),
    proxyPart(instance, 2, {
      role: "cap",
      materialRole: "canopy",
      shape: "ellipsoid",
      center: { x: instance.positionMeters.x, y: instance.positionMeters.y + 0.98, z: instance.positionMeters.z },
      dimensions: { x: 1.3, y: 0.34, z: 1.1 }
    }),
    proxyPart(instance, 3, {
      role: "cap",
      materialRole: "canopy",
      shape: "disc",
      center: { x: instance.positionMeters.x, y: instance.positionMeters.y + 0.91, z: instance.positionMeters.z },
      dimensions: { x: 1.05, y: 0.08, z: 0.9 }
    })
  ]);

export const createHestiaVegetationProxy = (
  instance: HestiaVegetationInstance
): HestiaVegetationProxy => {
  const speciesId = hestiaVegetationSpeciesId(instance.speciesId);
  let parts: readonly HestiaVegetationProxyPart[];
  switch (speciesId) {
    case "hestia.umbrella-tree.v1":
      parts = umbrellaParts(instance);
      break;
    case "hestia.mist-sprout.v1":
      parts = mistSproutParts(instance);
      break;
    case "hestia.luminous-cap.v1":
      parts = luminousCapParts(instance);
      break;
    default: {
      const unhandledSpecies: never = speciesId;
      return unhandledSpecies;
    }
  }
  const payload = freezeHestiaVegetationValue({
    schemaVersion: HESTIA_VEGETATION_SCHEMA_VERSION,
    proxyId: `hestia.vegetation.proxy.v1:${instance.instanceHash.slice(-16)}`,
    instanceId: instance.instanceId,
    speciesId,
    parts
  });
  return freezeHestiaVegetationValue({
    ...payload,
    contentHash: hashHestiaVegetationCanonical(payload)
  });
};
