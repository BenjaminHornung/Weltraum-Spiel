import type { ComponentId, SocketId } from "./ids";
import type {
  ComponentKind,
  ShipBuilderComponent
} from "./types";

export type {
  ArmorComponent,
  CargoStorageComponent,
  ComponentBase,
  ComponentKind,
  ControlCoreComponent,
  DockingConnectorComponent,
  FixedWeaponComponent,
  FuelTankComponent,
  MainThrusterComponent,
  PowerHeatReservedComponent,
  RcsClusterComponent,
  SensorUtilityComponent,
  ShipBuilderComponent,
  StructuralComponent,
  TurretWeaponComponent
} from "./types";

export const BUILT_IN_COMPONENT_KINDS = [
  "ControlCore",
  "Structural",
  "MainThruster",
  "RcsCluster",
  "FuelTank",
  "CargoStorage",
  "FixedWeapon",
  "TurretWeapon",
  "SensorUtility",
  "DockingConnector",
  "Armor",
  "PowerHeatReserved"
] as const satisfies readonly ComponentKind[];

export const isComponentKind = (value: unknown): value is ComponentKind =>
  typeof value === "string" && (BUILT_IN_COMPONENT_KINDS as readonly string[]).includes(value);

export interface ComponentSocketReference {
  readonly componentId: ComponentId;
  readonly property: string;
  readonly socketId: SocketId;
}

const singleSocketReference = (
  componentId: ComponentId,
  property: string,
  socketId: SocketId | undefined
): readonly ComponentSocketReference[] =>
  socketId === undefined ? [] : [{ componentId, property, socketId }];

const arraySocketReferences = (
  componentId: ComponentId,
  property: string,
  socketIds: readonly SocketId[] | undefined
): readonly ComponentSocketReference[] =>
  socketIds === undefined
    ? []
    : socketIds.map((socketId, index) => ({ componentId, property: `${property}/${index}`, socketId }));

/**
 * Returns every local socket dependency declared by a component. This is the
 * sole source for socket-reference integrity checks; categories never contribute.
 */
export const componentSocketReferenceEntries = (
  component: ShipBuilderComponent
): readonly ComponentSocketReference[] => {
  switch (component.kind) {
    case "ControlCore":
      return [
        ...singleSocketReference(component.componentId, "controlSocketId", component.controlSocketId),
        ...singleSocketReference(component.componentId, "cameraSocketId", component.cameraSocketId)
      ];
    case "Structural":
      return arraySocketReferences(component.componentId, "structuralSocketIds", component.structuralSocketIds);
    case "MainThruster":
      return singleSocketReference(component.componentId, "nozzleSocketId", component.nozzleSocketId);
    case "RcsCluster":
      return arraySocketReferences(component.componentId, "nozzleSocketIds", component.nozzleSocketIds);
    case "FuelTank":
      return [
        ...arraySocketReferences(component.componentId, "feedSocketIds", component.feedSocketIds),
        ...singleSocketReference(component.componentId, "fillSocketId", component.fillSocketId)
      ];
    case "CargoStorage":
      return [
        ...arraySocketReferences(component.componentId, "cargoAttachSocketIds", component.cargoAttachSocketIds),
        ...singleSocketReference(component.componentId, "accessSocketId", component.accessSocketId)
      ];
    case "FixedWeapon":
      return [
        ...singleSocketReference(component.componentId, "hardpointSocketId", component.hardpointSocketId),
        ...singleSocketReference(component.componentId, "muzzleSocketId", component.muzzleSocketId),
        ...singleSocketReference(component.componentId, "muzzleFlashSocketId", component.muzzleFlashSocketId)
      ];
    case "TurretWeapon":
      return [
        ...singleSocketReference(component.componentId, "turretBaseSocketId", component.turretBaseSocketId),
        ...singleSocketReference(component.componentId, "yawPivotSocketId", component.yawPivotSocketId),
        ...singleSocketReference(component.componentId, "pitchPivotSocketId", component.pitchPivotSocketId),
        ...singleSocketReference(component.componentId, "muzzleSocketId", component.muzzleSocketId),
        ...singleSocketReference(component.componentId, "muzzleFlashSocketId", component.muzzleFlashSocketId)
      ];
    case "SensorUtility":
      return singleSocketReference(component.componentId, "mountSocketId", component.mountSocketId);
    case "DockingConnector":
      return singleSocketReference(component.componentId, "connectorSocketId", component.connectorSocketId);
    case "Armor":
    case "PowerHeatReserved":
      return [];
  }
};

export const componentSocketReferences = (component: ShipBuilderComponent): readonly SocketId[] => {
  const seen = new Set<SocketId>();
  const references: SocketId[] = [];

  for (const reference of componentSocketReferenceEntries(component)) {
    if (!seen.has(reference.socketId)) {
      seen.add(reference.socketId);
      references.push(reference.socketId);
    }
  }

  return references;
};

/** Context remains code-side so it cannot be persisted in a component document. */
export interface FunctionalComponentHandlerContext {
  readonly catalogId: string;
  readonly partDefinitionId: string;
}

/** Future executable behavior belongs here, never on a serialized component record. */
export interface FunctionalComponentHandler<TComponent extends ShipBuilderComponent = ShipBuilderComponent> {
  readonly kind: TComponent["kind"];
  evaluate(component: TComponent, context: FunctionalComponentHandlerContext): void;
}

/** Code-side registry seam. It is intentionally absent from all JSON domain interfaces. */
export interface FunctionalComponentHandlerRegistry {
  readonly handlers: Readonly<Partial<Record<ComponentKind, FunctionalComponentHandler>>>;
}
