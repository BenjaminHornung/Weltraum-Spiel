import { componentSocketReferenceEntries } from "./components";
import type { ComponentId, SocketId } from "./ids";
import type {
  BuiltInSocketType,
  MountSide,
  PartSocket,
  ShipBuilderComponent,
  SocketDirectionRole,
  SocketRole,
  SocketType
} from "./types";
import { dataError, dataPath, deepFreeze, readFiniteVector3, readNormalizedQuaternion, readNonZeroVector3 } from "./validation";

export type { BuiltInSocketType, PartSocket, SocketArcMetadata, SocketDefinition, SocketType } from "./types";

export const STRUCTURAL_SOCKET_TYPE = "structural" as const;
export const HARDPOINT_SOCKET_TYPE = "hardpoint" as const;
export const MAIN_THRUSTER_NOZZLE_SOCKET_TYPE = "mainThrusterNozzle" as const;
export const RCS_NOZZLE_SOCKET_TYPE = "rcsNozzle" as const;
export const TURRET_BASE_SOCKET_TYPE = "turretBase" as const;
export const TURRET_YAW_PIVOT_SOCKET_TYPE = "turretYawPivot" as const;
export const TURRET_PITCH_PIVOT_SOCKET_TYPE = "turretPitchPivot" as const;
export const MUZZLE_SOCKET_TYPE = "muzzle" as const;
export const MUZZLE_FLASH_SOCKET_TYPE = "muzzleFlash" as const;
export const CARGO_ATTACH_SOCKET_TYPE = "cargoAttach" as const;
export const DOCKING_CONNECTOR_SOCKET_TYPE = "dockingConnector" as const;
export const CAMERA_ANCHOR_SOCKET_TYPE = "cameraAnchor" as const;

export const BUILT_IN_SOCKET_TYPES = [
  STRUCTURAL_SOCKET_TYPE,
  HARDPOINT_SOCKET_TYPE,
  MAIN_THRUSTER_NOZZLE_SOCKET_TYPE,
  RCS_NOZZLE_SOCKET_TYPE,
  TURRET_BASE_SOCKET_TYPE,
  TURRET_YAW_PIVOT_SOCKET_TYPE,
  TURRET_PITCH_PIVOT_SOCKET_TYPE,
  MUZZLE_SOCKET_TYPE,
  MUZZLE_FLASH_SOCKET_TYPE,
  CARGO_ATTACH_SOCKET_TYPE,
  DOCKING_CONNECTOR_SOCKET_TYPE,
  CAMERA_ANCHOR_SOCKET_TYPE
] as const satisfies readonly BuiltInSocketType[];

export interface SocketTypeMetadata {
  readonly socketType: BuiltInSocketType;
  readonly role: SocketRole;
  readonly directionRole: SocketDirectionRole;
  readonly requiresNonZeroDirection: boolean;
  readonly allowedMountSides: readonly MountSide[];
}

const allMountSides: readonly MountSide[] = ["front", "back", "left", "right", "top", "bottom", "internal", "any"];

/** Explicit built-in metadata; custom types are accepted by the data shape but have no inferred behavior. */
export const BUILT_IN_SOCKET_TYPE_METADATA: Readonly<Record<BuiltInSocketType, SocketTypeMetadata>> = deepFreeze({
  structural: {
    socketType: STRUCTURAL_SOCKET_TYPE,
    role: "Structural",
    directionRole: "MountNormal",
    requiresNonZeroDirection: false,
    allowedMountSides: allMountSides
  },
  hardpoint: {
    socketType: HARDPOINT_SOCKET_TYPE,
    role: "Functional",
    directionRole: "Aim",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  mainThrusterNozzle: {
    socketType: MAIN_THRUSTER_NOZZLE_SOCKET_TYPE,
    role: "Functional",
    directionRole: "Thrust",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  rcsNozzle: {
    socketType: RCS_NOZZLE_SOCKET_TYPE,
    role: "Functional",
    directionRole: "Thrust",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  turretBase: {
    socketType: TURRET_BASE_SOCKET_TYPE,
    role: "Functional",
    directionRole: "MountNormal",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  turretYawPivot: {
    socketType: TURRET_YAW_PIVOT_SOCKET_TYPE,
    role: "Functional",
    directionRole: "Aim",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  turretPitchPivot: {
    socketType: TURRET_PITCH_PIVOT_SOCKET_TYPE,
    role: "Functional",
    directionRole: "Aim",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  muzzle: {
    socketType: MUZZLE_SOCKET_TYPE,
    role: "Functional",
    directionRole: "Aim",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  muzzleFlash: {
    socketType: MUZZLE_FLASH_SOCKET_TYPE,
    role: "Visual",
    directionRole: "Aim",
    requiresNonZeroDirection: false,
    allowedMountSides: allMountSides
  },
  cargoAttach: {
    socketType: CARGO_ATTACH_SOCKET_TYPE,
    role: "Functional",
    directionRole: "MountNormal",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  dockingConnector: {
    socketType: DOCKING_CONNECTOR_SOCKET_TYPE,
    role: "Functional",
    directionRole: "Docking",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  },
  cameraAnchor: {
    socketType: CAMERA_ANCHOR_SOCKET_TYPE,
    role: "Camera",
    directionRole: "Camera",
    requiresNonZeroDirection: true,
    allowedMountSides: allMountSides
  }
});

export const isBuiltInSocketType = (value: unknown): value is BuiltInSocketType =>
  typeof value === "string" && (BUILT_IN_SOCKET_TYPES as readonly string[]).includes(value);

export const socketTypeMetadataFor = (socketType: SocketType): SocketTypeMetadata | undefined =>
  isBuiltInSocketType(socketType) ? BUILT_IN_SOCKET_TYPE_METADATA[socketType] : undefined;

/**
 * Validates the spatial requirements that belong to an individual socket.
 * In particular, it never synthesizes an origin, identity rotation, or zero direction.
 */
export const validateSocketSpatialData = (socket: PartSocket, path: string): void => {
  readFiniteVector3(socket.localPosition, dataPath(path, "localPosition"));
  readNormalizedQuaternion(socket.localRotation, dataPath(path, "localRotation"));

  const directionPath = dataPath(path, "direction");
  const metadata = socketTypeMetadataFor(socket.socketType);
  if (socket.role === "Functional" || metadata?.requiresNonZeroDirection === true) {
    readNonZeroVector3(socket.direction, directionPath);
    return;
  }

  readFiniteVector3(socket.direction, directionPath);
};

export const createLocalSocketIndex = (sockets: readonly PartSocket[], path = "/sockets"): Readonly<Record<SocketId, PartSocket>> => {
  const index: Record<SocketId, PartSocket> = Object.create(null) as Record<SocketId, PartSocket>;

  for (let indexPosition = 0; indexPosition < sockets.length; indexPosition += 1) {
    const socket = sockets[indexPosition];
    const socketPath = dataPath(path, indexPosition);
    validateSocketSpatialData(socket, socketPath);

    if (Object.prototype.hasOwnProperty.call(index, socket.socketId)) {
      throw dataError("DuplicateId", dataPath(socketPath, "socketId"), "Duplicate local socket ID.");
    }

    index[socket.socketId] = socket;
  }

  return Object.freeze(index);
};

const createLocalComponentIdSet = (components: readonly ShipBuilderComponent[], path: string): ReadonlySet<ComponentId> => {
  const componentIds = new Set<ComponentId>();

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    if (componentIds.has(component.componentId)) {
      throw dataError("DuplicateId", dataPath(dataPath(path, index), "componentId"), "Duplicate local component ID.");
    }
    componentIds.add(component.componentId);
  }

  return componentIds;
};

/** Checks all socket/component dependencies within one part definition, in source order. */
export const validateLocalSocketReferences = (
  sockets: readonly PartSocket[],
  components: readonly ShipBuilderComponent[],
  socketsPath = "/sockets",
  componentsPath = "/components"
): void => {
  const socketIndex = createLocalSocketIndex(sockets, socketsPath);
  const componentIds = createLocalComponentIdSet(components, componentsPath);

  const componentReferencePath = (componentPath: string, property: string): string =>
    property.split("/").reduce((currentPath, segment) => dataPath(currentPath, segment), componentPath);

  for (let socketIndexPosition = 0; socketIndexPosition < sockets.length; socketIndexPosition += 1) {
    const socket = sockets[socketIndexPosition];
    const requiredIds = socket.requiredForComponentIds;
    for (let requiredIndex = 0; requiredIndex < requiredIds.length; requiredIndex += 1) {
      if (!componentIds.has(requiredIds[requiredIndex])) {
        throw dataError(
          "UnknownComponent",
          dataPath(dataPath(dataPath(socketsPath, socketIndexPosition), "requiredForComponentIds"), requiredIndex),
          "Required component ID does not exist in this part definition."
        );
      }
    }
  }

  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    for (const reference of componentSocketReferenceEntries(components[componentIndex])) {
      if (!Object.prototype.hasOwnProperty.call(socketIndex, reference.socketId)) {
        throw dataError(
          "UnknownSocket",
          componentReferencePath(dataPath(componentsPath, componentIndex), reference.property),
          "Component socket reference does not exist in this part definition."
        );
      }
    }
  }
};
