import { createShipBlueprint, shipBlueprintLayoutHash } from "./blueprint";
import { canonicalJsonHash } from "./canonicalJson";
import {
  createShipBuilderDiagnostic,
  orderShipBuilderDiagnostics,
  shipBuilderValidationStatusForDiagnostics
} from "./diagnostics";
import type {
  ShipBuilderDiagnostic,
  ShipBuilderValidationStatus
} from "./diagnostics";
import type { PartDefinitionId, PartInstanceId } from "./ids";
import type { GridFootprint, PartDefinition, PartInstance, ShipPartCatalogSnapshot } from "./types";
import { dataError, deepFreeze } from "./validation";

export interface ShipBuilderVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ShipBuilderCoordinatePair {
  readonly grid: ShipBuilderVector3;
  readonly meters: ShipBuilderVector3;
}

export interface ShipBuilderAxisAlignedBounds {
  readonly minimum: ShipBuilderVector3;
  readonly maximum: ShipBuilderVector3;
  readonly size: ShipBuilderVector3;
}

export interface ShipBuilderGridBounds {
  readonly grid: ShipBuilderAxisAlignedBounds;
  readonly meters: ShipBuilderAxisAlignedBounds;
}

export interface ShipBuilderMassContribution {
  readonly partInstanceId: PartInstanceId;
  readonly partDefinitionId: PartDefinitionId;
  readonly dryMassKg: number;
  readonly massCenter: {
    readonly grid: ShipBuilderVector3;
    readonly meters: ShipBuilderVector3 | null;
  };
  readonly gridBounds: ShipBuilderGridBounds | null;
}

export interface ShipBuilderMassPropertiesSummary {
  readonly enabledInstanceCount: number;
  readonly contributionCount: number;
  readonly diagnosticCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}

export interface ShipBuilderMassPropertiesPayload {
  readonly reportVersion: 1;
  readonly catalogSignature: string;
  readonly blueprintLayoutHash: string;
  readonly status: ShipBuilderValidationStatus;
  readonly dryMassKg: number | null;
  readonly centerOfMass: ShipBuilderCoordinatePair | null;
  readonly gridBounds: ShipBuilderGridBounds | null;
  readonly contributions: readonly ShipBuilderMassContribution[];
  readonly diagnostics: readonly ShipBuilderDiagnostic[];
  readonly summary: ShipBuilderMassPropertiesSummary;
}

export interface ShipBuilderMassPropertiesReport extends ShipBuilderMassPropertiesPayload {
  readonly signature: string;
}

const normalizedNumber = (value: number): number => (Object.is(value, -0) ? 0 : value);

const vector = (x: number, y: number, z: number): ShipBuilderVector3 => ({
  x: normalizedNumber(x),
  y: normalizedNumber(y),
  z: normalizedNumber(z)
});

const isFiniteVector = (value: ShipBuilderVector3): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

const multiplyVector = (value: ShipBuilderVector3, scalar: number): ShipBuilderVector3 =>
  vector(value.x * scalar, value.y * scalar, value.z * scalar);

const boundsAreFinite = (bounds: ShipBuilderAxisAlignedBounds): boolean =>
  isFiniteVector(bounds.minimum) &&
  isFiniteVector(bounds.maximum) &&
  isFiniteVector(bounds.size) &&
  bounds.minimum.x <= bounds.maximum.x &&
  bounds.minimum.y <= bounds.maximum.y &&
  bounds.minimum.z <= bounds.maximum.z &&
  bounds.size.x >= 0 &&
  bounds.size.y >= 0 &&
  bounds.size.z >= 0;

const axisAlignedBounds = (
  minimum: ShipBuilderVector3,
  maximum: ShipBuilderVector3
): ShipBuilderAxisAlignedBounds => ({
  minimum,
  maximum,
  size: vector(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z)
});

const projectBoundsToMeters = (
  gridBounds: ShipBuilderAxisAlignedBounds,
  gridMeters: number
): ShipBuilderAxisAlignedBounds =>
  axisAlignedBounds(multiplyVector(gridBounds.minimum, gridMeters), multiplyVector(gridBounds.maximum, gridMeters));

const rotatedFootprint = (footprint: GridFootprint, yaw: number): GridFootprint =>
  yaw === 90 || yaw === 270
    ? { x: footprint.z, y: footprint.y, z: footprint.x }
    : { x: footprint.x, y: footprint.y, z: footprint.z };

const contributionBounds = (
  instance: PartInstance,
  footprint: GridFootprint,
  gridMeters: number
): ShipBuilderGridBounds | null => {
  const oriented = rotatedFootprint(footprint, instance.localRotation.yaw);
  const half = vector(oriented.x / 2, oriented.y / 2, oriented.z / 2);
  const center = instance.localGridPosition;
  const grid = axisAlignedBounds(
    vector(center.x - half.x, center.y - half.y, center.z - half.z),
    vector(center.x + half.x, center.y + half.y, center.z + half.z)
  );
  if (
    !boundsAreFinite(grid) ||
    grid.size.x !== oriented.x ||
    grid.size.y !== oriented.y ||
    grid.size.z !== oriented.z
  ) {
    return null;
  }
  const meters = projectBoundsToMeters(grid, gridMeters);
  return boundsAreFinite(meters) ? { grid, meters } : null;
};

const unionBounds = (
  contributions: readonly ShipBuilderMassContribution[],
  gridMeters: number
): ShipBuilderGridBounds | null => {
  if (contributions.length === 0 || contributions.some((contribution) => contribution.gridBounds === null)) {
    return null;
  }

  const first = contributions[0].gridBounds?.grid;
  if (first === undefined) {
    return null;
  }
  let minimum = vector(first.minimum.x, first.minimum.y, first.minimum.z);
  let maximum = vector(first.maximum.x, first.maximum.y, first.maximum.z);
  for (let index = 1; index < contributions.length; index += 1) {
    const bounds = contributions[index].gridBounds?.grid;
    if (bounds === undefined) {
      return null;
    }
    minimum = vector(
      Math.min(minimum.x, bounds.minimum.x),
      Math.min(minimum.y, bounds.minimum.y),
      Math.min(minimum.z, bounds.minimum.z)
    );
    maximum = vector(
      Math.max(maximum.x, bounds.maximum.x),
      Math.max(maximum.y, bounds.maximum.y),
      Math.max(maximum.z, bounds.maximum.z)
    );
  }

  const grid = axisAlignedBounds(minimum, maximum);
  if (!boundsAreFinite(grid)) {
    return null;
  }
  const meters = projectBoundsToMeters(grid, gridMeters);
  return boundsAreFinite(meters) ? { grid, meters } : null;
};

const resolvedDefinition = (
  instance: PartInstance,
  catalog: ShipPartCatalogSnapshot
): PartDefinition => {
  const definition = catalog.indexes.partById[instance.partDefinitionId];
  if (definition === undefined) {
    throw dataError("UnknownReference", "/instances", "Part definition is missing after blueprint validation.");
  }
  return definition;
};

const addFinite = (left: number, right: number): number | null => {
  const result = left + right;
  return Number.isFinite(result) ? normalizedNumber(result) : null;
};

export const evaluateShipBlueprintMassProperties = (
  source: unknown,
  catalog: ShipPartCatalogSnapshot
): ShipBuilderMassPropertiesReport => {
  const blueprint = createShipBlueprint(source, { catalog });
  const enabledInstances = blueprint.instances.filter((instance) => instance.enabled);
  const diagnostics: ShipBuilderDiagnostic[] = [];
  const invalidCenterInstanceIds: PartInstanceId[] = [];
  const invalidBoundsInstanceIds: PartInstanceId[] = [];
  const contributions: ShipBuilderMassContribution[] = enabledInstances.map((instance) => {
    const definition = resolvedDefinition(instance, catalog);
    const centerGrid = vector(
      instance.localGridPosition.x,
      instance.localGridPosition.y,
      instance.localGridPosition.z
    );
    const centerMetersCandidate = multiplyVector(centerGrid, blueprint.gridMeters);
    const centerMeters = isFiniteVector(centerMetersCandidate) ? centerMetersCandidate : null;
    if (centerMeters === null) {
      invalidCenterInstanceIds.push(instance.stableInstanceId);
    }
    const gridBounds = contributionBounds(instance, definition.gridFootprint, blueprint.gridMeters);
    if (gridBounds === null) {
      invalidBoundsInstanceIds.push(instance.stableInstanceId);
    }
    return {
      partInstanceId: instance.stableInstanceId,
      partDefinitionId: instance.partDefinitionId,
      dryMassKg: definition.dryMassKilograms,
      massCenter: { grid: centerGrid, meters: centerMeters },
      gridBounds
    };
  });

  if (enabledInstances.length === 0) {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code: "NoEnabledInstances",
        severity: "Error",
        phase: "MassProperties",
        path: "/instances"
      })
    );
  }

  let dryMassAggregate = 0;
  let dryMassIsFinite = true;
  for (const contribution of contributions) {
    const next = addFinite(dryMassAggregate, contribution.dryMassKg);
    if (next === null) {
      dryMassIsFinite = false;
      break;
    }
    dryMassAggregate = next;
  }
  const dryMassKg = dryMassIsFinite ? dryMassAggregate : null;
  if (!dryMassIsFinite) {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code: "NonFiniteDryMassAggregate",
        severity: "Error",
        phase: "MassProperties",
        path: "/dryMassKg",
        instanceIds: enabledInstances.map((instance) => instance.stableInstanceId),
        details: { reason: "DryMassSummationOverflow" }
      })
    );
  }

  let centerOfMass: ShipBuilderCoordinatePair | null = null;
  let centerOfMassIsFinite = invalidCenterInstanceIds.length === 0;
  if (dryMassKg !== null && dryMassKg > 0 && centerOfMassIsFinite) {
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;
    for (const contribution of contributions) {
      const weighted = vector(
        contribution.dryMassKg * contribution.massCenter.grid.x,
        contribution.dryMassKg * contribution.massCenter.grid.y,
        contribution.dryMassKg * contribution.massCenter.grid.z
      );
      if (!isFiniteVector(weighted)) {
        centerOfMassIsFinite = false;
        invalidCenterInstanceIds.push(contribution.partInstanceId);
        break;
      }
      const nextX = addFinite(weightedX, weighted.x);
      const nextY = addFinite(weightedY, weighted.y);
      const nextZ = addFinite(weightedZ, weighted.z);
      if (nextX === null || nextY === null || nextZ === null) {
        centerOfMassIsFinite = false;
        invalidCenterInstanceIds.push(contribution.partInstanceId);
        break;
      }
      weightedX = nextX;
      weightedY = nextY;
      weightedZ = nextZ;
    }

    if (centerOfMassIsFinite) {
      const grid = vector(weightedX / dryMassKg, weightedY / dryMassKg, weightedZ / dryMassKg);
      const meters = multiplyVector(grid, blueprint.gridMeters);
      if (isFiniteVector(grid) && isFiniteVector(meters)) {
        centerOfMass = { grid, meters };
      } else {
        centerOfMassIsFinite = false;
      }
    }
  }

  if (enabledInstances.length > 0 && dryMassKg === 0) {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code: "ZeroDryMass",
        severity: "Warning",
        phase: "MassProperties",
        path: "/dryMassKg",
        instanceIds: enabledInstances.map((instance) => instance.stableInstanceId)
      })
    );
  }

  if (dryMassKg !== null && dryMassKg > 0 && !centerOfMassIsFinite) {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code: "NonFiniteCenterOfMass",
        severity: "Error",
        phase: "MassProperties",
        path: "/centerOfMass",
        instanceIds: invalidCenterInstanceIds,
        details: { reason: "SpatialProjectionOrWeightedAggregateOverflow" }
      })
    );
  }

  const gridBounds = enabledInstances.length === 0 ? null : unionBounds(contributions, blueprint.gridMeters);
  if (enabledInstances.length > 0 && gridBounds === null) {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code: "InvalidGridBounds",
        severity: "Error",
        phase: "MassProperties",
        path: "/gridBounds",
        instanceIds:
          invalidBoundsInstanceIds.length > 0
            ? invalidBoundsInstanceIds
            : enabledInstances.map((instance) => instance.stableInstanceId),
        details: { reason: "FootprintUnionOrMeterProjectionOverflow" }
      })
    );
  }

  const orderedDiagnostics = orderShipBuilderDiagnostics(diagnostics);
  const status = shipBuilderValidationStatusForDiagnostics(orderedDiagnostics);
  const summary: ShipBuilderMassPropertiesSummary = {
    enabledInstanceCount: enabledInstances.length,
    contributionCount: contributions.length,
    diagnosticCount: orderedDiagnostics.length,
    errorCount: orderedDiagnostics.filter((diagnostic) => diagnostic.severity === "Error").length,
    warningCount: orderedDiagnostics.filter((diagnostic) => diagnostic.severity === "Warning").length,
    infoCount: orderedDiagnostics.filter((diagnostic) => diagnostic.severity === "Info").length
  };
  const payload: ShipBuilderMassPropertiesPayload = {
    reportVersion: 1,
    catalogSignature: catalog.signature,
    blueprintLayoutHash: shipBlueprintLayoutHash(blueprint),
    status,
    dryMassKg,
    centerOfMass,
    gridBounds,
    contributions,
    diagnostics: orderedDiagnostics,
    summary
  };

  return deepFreeze({
    ...payload,
    signature: canonicalJsonHash(payload)
  }) as ShipBuilderMassPropertiesReport;
};
