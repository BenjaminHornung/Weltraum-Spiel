import { createShipBlueprint, shipBlueprintLayoutHash } from "./blueprint";
import { canonicalJsonHash } from "./canonicalJson";
import { transformDirectionByYaw } from "./compatibility";
import { evaluateShipBlueprintMassProperties } from "./massProperties";
import { createShipAnalysisPolicy, createShipStatPreview } from "./statCanonical";
import type {
  FixedWeaponComponent,
  PartDefinition,
  PartInstance,
  PartSocket,
  PropulsionSupply,
  SerializableVector3,
  ShipPartCatalogSnapshot,
  ShipStatAvailability,
  ShipStats,
  ShipStatsEvaluationOptions,
  ShipStatsReport,
  ShipStatsReportPayload,
  ShipStatUnit,
  ShipStatValue,
  TurretWeaponComponent
} from "./types";
import { deepFreeze } from "./validation";

type NumericStat<TUnit extends ShipStatUnit> = ShipStatValue<number, TUnit>;

interface PositionedMass {
  readonly massKg: number;
  readonly position: SerializableVector3 | null;
}

interface UsableThruster {
  readonly thrustNewtons: number;
  readonly massFlowKgPerSecond: number;
  readonly supply: PropulsionSupply | undefined;
  readonly point: SerializableVector3;
  readonly direction: SerializableVector3;
}

const normalizedNumber = (value: number): number => (Object.is(value, -0) ? 0 : value);
const vector = (x: number, y: number, z: number): SerializableVector3 => ({
  x: normalizedNumber(x),
  y: normalizedNumber(y),
  z: normalizedNumber(z)
});
const isFiniteVector = (value: SerializableVector3): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
const addVector = (left: SerializableVector3, right: SerializableVector3): SerializableVector3 =>
  vector(left.x + right.x, left.y + right.y, left.z + right.z);
const subtractVector = (left: SerializableVector3, right: SerializableVector3): SerializableVector3 =>
  vector(left.x - right.x, left.y - right.y, left.z - right.z);
const multiplyVector = (value: SerializableVector3, scalar: number): SerializableVector3 =>
  vector(value.x * scalar, value.y * scalar, value.z * scalar);
const dot = (left: SerializableVector3, right: SerializableVector3): number =>
  left.x * right.x + left.y * right.y + left.z * right.z;
const cross = (left: SerializableVector3, right: SerializableVector3): SerializableVector3 =>
  vector(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x
  );
const magnitude = (value: SerializableVector3): number => Math.sqrt(dot(value, value));
const normalize = (value: SerializableVector3): SerializableVector3 | null => {
  const length = magnitude(value);
  if (!Number.isFinite(length) || length <= 0) {
    return null;
  }
  const result = multiplyVector(value, 1 / length);
  return isFiniteVector(result) ? result : null;
};

const finiteAdd = (left: number, right: number): number | null => {
  const result = left + right;
  return Number.isFinite(result) ? normalizedNumber(result) : null;
};

const sumFinite = (values: readonly number[]): number | null => {
  let result = 0;
  for (const value of values) {
    const next = finiteAdd(result, value);
    if (next === null) {
      return null;
    }
    result = next;
  }
  return result;
};

const available = <TValue, TUnit extends ShipStatUnit>(
  value: TValue,
  unit: TUnit
): ShipStatValue<TValue, TUnit> => ({ availability: "Available", value, unit });

const unavailable = <TValue, TUnit extends ShipStatUnit>(
  availability: Exclude<ShipStatAvailability, "Available">,
  unit: TUnit
): ShipStatValue<TValue, TUnit> => ({ availability, value: null, unit });

const numericResult = <TUnit extends ShipStatUnit>(value: number | null, unit: TUnit): NumericStat<TUnit> =>
  value === null || !Number.isFinite(value) ? unavailable("Invalid", unit) : available(normalizedNumber(value), unit);

const dependentNumber = <TUnit extends ShipStatUnit, TDependencyUnit extends ShipStatUnit>(
  dependency: ShipStatValue<number, TDependencyUnit>,
  divisor: ShipStatValue<number, "kg">,
  unit: TUnit
): NumericStat<TUnit> => {
  if (dependency.availability !== "Available") {
    return unavailable(dependency.availability, unit);
  }
  if (divisor.availability !== "Available" || divisor.value <= 0) {
    return unavailable("Invalid", unit);
  }
  const result = dependency.value / divisor.value;
  return Number.isFinite(result) ? available(normalizedNumber(result), unit) : unavailable("Invalid", unit);
};

const instanceOriginMeters = (instance: PartInstance, gridMeters: number): SerializableVector3 | null => {
  const result = vector(
    instance.localGridPosition.x * gridMeters,
    instance.localGridPosition.y * gridMeters,
    instance.localGridPosition.z * gridMeters
  );
  return isFiniteVector(result) ? result : null;
};

const rotatePointByYaw = (point: SerializableVector3, yaw: number): SerializableVector3 | null => {
  const result = transformDirectionByYaw(point, yaw);
  return isFiniteVector(result) ? result : null;
};

const worldSocketPoint = (
  instance: PartInstance,
  socket: PartSocket,
  gridMeters: number
): SerializableVector3 | null => {
  const origin = instanceOriginMeters(instance, gridMeters);
  const offset = rotatePointByYaw(socket.localPosition, instance.localRotation.yaw);
  if (origin === null || offset === null) {
    return null;
  }
  const result = addVector(origin, offset);
  return isFiniteVector(result) ? result : null;
};

const worldSocketDirection = (instance: PartInstance, socket: PartSocket): SerializableVector3 | null => {
  const transformed = transformDirectionByYaw(socket.direction, instance.localRotation.yaw);
  return isFiniteVector(transformed) ? normalize(transformed) : null;
};

const socketById = (definition: PartDefinition, socketId: string): PartSocket | undefined =>
  definition.sockets.find((socket) => socket.socketId === socketId);

const isUsableThrustSocket = (socket: PartSocket | undefined, socketType: "mainThrusterNozzle" | "rcsNozzle"): boolean =>
  socket !== undefined &&
  socket.role === "Functional" &&
  socket.socketType === socketType &&
  socket.directionRole === "Thrust" &&
  normalize(socket.direction) !== null;

const weightedCenter = (masses: readonly PositionedMass[], totalMassKg: number): SerializableVector3 | null => {
  if (!Number.isFinite(totalMassKg) || totalMassKg <= 0 || masses.some((entry) => entry.position === null)) {
    return null;
  }
  let weighted = vector(0, 0, 0);
  for (const entry of masses) {
    const contribution = multiplyVector(entry.position as SerializableVector3, entry.massKg);
    if (!isFiniteVector(contribution)) {
      return null;
    }
    weighted = addVector(weighted, contribution);
    if (!isFiniteVector(weighted)) {
      return null;
    }
  }
  const result = multiplyVector(weighted, 1 / totalMassKg);
  return isFiniteVector(result) ? result : null;
};

const propagationAvailability = (
  stat: ShipStatValue<unknown, ShipStatUnit>
): Exclude<ShipStatAvailability, "Available"> =>
  stat.availability === "Available" ? "Invalid" : stat.availability;

const hasDirection = (socket: PartSocket | undefined): boolean => socket !== undefined && normalize(socket.direction) !== null;

const usableFixedWeapon = (component: FixedWeaponComponent, definition: PartDefinition): boolean => {
  const hardpoint = socketById(definition, component.hardpointSocketId);
  const muzzle = socketById(definition, component.muzzleSocketId);
  return (
    hardpoint?.role === "Functional" &&
    hardpoint.socketType === "hardpoint" &&
    hardpoint.directionRole === "Aim" &&
    hasDirection(hardpoint) &&
    muzzle?.role === "Functional" &&
    muzzle.socketType === "muzzle" &&
    muzzle.directionRole === "Aim" &&
    hasDirection(muzzle)
  );
};

const usableTurretWeapon = (component: TurretWeaponComponent, definition: PartDefinition): boolean => {
  const base = socketById(definition, component.turretBaseSocketId);
  const yaw = socketById(definition, component.yawPivotSocketId);
  const pitch = socketById(definition, component.pitchPivotSocketId);
  const muzzle = socketById(definition, component.muzzleSocketId);
  return (
    base?.role === "Functional" &&
    base.socketType === "turretBase" &&
    base.directionRole === "MountNormal" &&
    hasDirection(base) &&
    yaw?.role === "Functional" &&
    yaw.socketType === "turretYawPivot" &&
    yaw.directionRole === "Aim" &&
    hasDirection(yaw) &&
    pitch?.role === "Functional" &&
    pitch.socketType === "turretPitchPivot" &&
    pitch.directionRole === "Aim" &&
    hasDirection(pitch) &&
    muzzle?.role === "Functional" &&
    muzzle.socketType === "muzzle" &&
    muzzle.directionRole === "Aim" &&
    hasDirection(muzzle)
  );
};

const propulsionPerformance = (
  thrusters: readonly UsableThruster[],
  mainThrust: ShipStats["mainThrustNewtons"],
  plannedFuelByKind: Readonly<Record<string, number>>,
  totalLoadedMass: ShipStats["totalLoadedMassKg"]
): Pick<ShipStats, "deltaVMps" | "burnTimeSeconds"> => {
  if (mainThrust.availability !== "Available") {
    const reason = propagationAvailability(mainThrust);
    return { deltaVMps: unavailable(reason, "m/s"), burnTimeSeconds: unavailable(reason, "s") };
  }
  if (thrusters.some((thruster) => thruster.supply === undefined)) {
    return {
      deltaVMps: unavailable("UnavailableMissingMetadata", "m/s"),
      burnTimeSeconds: unavailable("UnavailableMissingMetadata", "s")
    };
  }
  const supplies = thrusters.map((thruster) => thruster.supply as PropulsionSupply);
  if (supplies.some((supply) => supply.mode === "FuelFreeExperimental")) {
    return {
      deltaVMps: unavailable("UnavailableUnsupported", "m/s"),
      burnTimeSeconds: unavailable("UnavailableUnsupported", "s")
    };
  }
  const fuelKinds = [...new Set(supplies.map((supply) => (supply.mode === "Fuel" ? supply.fuelKind : "")))];
  if (fuelKinds.length !== 1) {
    return {
      deltaVMps: unavailable("UnavailableUnsupported", "m/s"),
      burnTimeSeconds: unavailable("UnavailableUnsupported", "s")
    };
  }
  const massFlow = sumFinite(thrusters.map((thruster) => thruster.massFlowKgPerSecond));
  if (massFlow === null || massFlow <= 0) {
    return { deltaVMps: unavailable("Invalid", "m/s"), burnTimeSeconds: unavailable("Invalid", "s") };
  }
  const compatibleFuelMass = plannedFuelByKind[fuelKinds[0]] ?? 0;
  if (!Number.isFinite(compatibleFuelMass) || compatibleFuelMass <= 0) {
    return {
      deltaVMps: unavailable("UnavailableNoFuel", "m/s"),
      burnTimeSeconds: unavailable("UnavailableNoFuel", "s")
    };
  }
  if (totalLoadedMass.availability !== "Available") {
    return { deltaVMps: unavailable("Invalid", "m/s"), burnTimeSeconds: unavailable("Invalid", "s") };
  }
  const finalMass = totalLoadedMass.value - compatibleFuelMass;
  if (!Number.isFinite(finalMass) || finalMass <= 0 || totalLoadedMass.value <= finalMass) {
    return { deltaVMps: unavailable("Invalid", "m/s"), burnTimeSeconds: unavailable("Invalid", "s") };
  }
  const exhaustVelocity = mainThrust.value / massFlow;
  const deltaV = exhaustVelocity * Math.log(totalLoadedMass.value / finalMass);
  const burnTime = compatibleFuelMass / massFlow;
  return {
    deltaVMps: Number.isFinite(deltaV) ? available(normalizedNumber(deltaV), "m/s") : unavailable("Invalid", "m/s"),
    burnTimeSeconds: Number.isFinite(burnTime) ? available(normalizedNumber(burnTime), "s") : unavailable("Invalid", "s")
  };
};

export const evaluateShipStats = (
  source: unknown,
  catalog: ShipPartCatalogSnapshot,
  options: ShipStatsEvaluationOptions = {}
): ShipStatsReport => {
  const blueprint = createShipBlueprint(source, { catalog });
  const preview = createShipStatPreview(options.preview ?? {});
  const policy = createShipAnalysisPolicy(options.policy ?? {});
  const massReport = evaluateShipBlueprintMassProperties(blueprint, catalog);
  const enabledInstances = blueprint.instances.filter((instance) => instance.enabled);

  const dryMassKg: ShipStats["dryMassKg"] = numericResult(massReport.dryMassKg, "kg");
  const positionedMasses: PositionedMass[] = massReport.contributions.map((contribution) => ({
    massKg: contribution.dryMassKg,
    position: contribution.massCenter.meters
  }));
  const fuelMasses: PositionedMass[] = [];
  const cargoStores: { readonly capacityKg: number; readonly position: SerializableVector3 | null }[] = [];
  const usableThrusters: UsableThruster[] = [];
  const plannedFuelByKind: Record<string, number> = Object.create(null) as Record<string, number>;
  const rcsNozzles: { readonly point: SerializableVector3; readonly direction: SerializableVector3; readonly thrust: number }[] = [];
  const weaponComponents: { readonly component: FixedWeaponComponent | TurretWeaponComponent; readonly definition: PartDefinition }[] = [];
  const powerReservations: { readonly power: number; readonly heat: number }[] = [];
  const cargoMassCapacities: number[] = [];
  const cargoVolumeCapacities: number[] = [];

  for (const instance of enabledInstances) {
    const definition = catalog.indexes.partById[instance.partDefinitionId];
    const origin = instanceOriginMeters(instance, blueprint.gridMeters);
    for (const component of definition.components) {
      switch (component.kind) {
        case "FuelTank": {
          const fuelMass = component.capacityKilograms * preview.fuelFillFraction;
          fuelMasses.push({ massKg: fuelMass, position: origin });
          const next = finiteAdd(plannedFuelByKind[component.fuelKind] ?? 0, fuelMass);
          plannedFuelByKind[component.fuelKind] = next ?? Number.NaN;
          break;
        }
        case "CargoStorage":
          cargoMassCapacities.push(component.maximumPayloadKilograms);
          cargoVolumeCapacities.push(component.capacityCubicMeters);
          cargoStores.push({ capacityKg: component.maximumPayloadKilograms, position: origin });
          break;
        case "MainThruster": {
          const socket = socketById(definition, component.nozzleSocketId);
          if (!isUsableThrustSocket(socket, "mainThrusterNozzle")) {
            break;
          }
          const point = worldSocketPoint(instance, socket as PartSocket, blueprint.gridMeters);
          const direction = worldSocketDirection(instance, socket as PartSocket);
          if (point !== null && direction !== null && component.maximumThrustNewtons > 0) {
            usableThrusters.push({
              thrustNewtons: component.maximumThrustNewtons,
              massFlowKgPerSecond: component.propellantBurnKilogramsPerSecond,
              supply: component.propulsionSupply,
              point,
              direction
            });
          }
          break;
        }
        case "RcsCluster":
          for (const socketId of component.nozzleSocketIds) {
            const socket = socketById(definition, socketId);
            if (!isUsableThrustSocket(socket, "rcsNozzle")) {
              continue;
            }
            const point = worldSocketPoint(instance, socket as PartSocket, blueprint.gridMeters);
            const direction = worldSocketDirection(instance, socket as PartSocket);
            if (point !== null && direction !== null && component.thrustPerNozzleNewtons > 0) {
              rcsNozzles.push({ point, direction, thrust: component.thrustPerNozzleNewtons });
            }
          }
          break;
        case "FixedWeapon":
        case "TurretWeapon":
          weaponComponents.push({ component, definition });
          break;
        case "PowerHeatReserved":
          powerReservations.push({ power: component.reservedPowerWatts, heat: component.reservedHeatWatts });
          break;
        default:
          break;
      }
    }
  }

  const plannedFuelMassValue = sumFinite(fuelMasses.map((entry) => entry.massKg));
  const plannedFuelMassKg = numericResult(plannedFuelMassValue, "kg");
  const plannedCargoMassKg = available(preview.cargoPreviewMassKg, "kg");
  const plannedCargoVolumeM3 = available(preview.cargoPreviewVolumeM3, "m^3");
  const cargoMassCapacityValue = sumFinite(cargoMassCapacities);
  const cargoVolumeCapacityValue = sumFinite(cargoVolumeCapacities);
  const cargoMassCapacityKg = numericResult(cargoMassCapacityValue, "kg");
  const cargoVolumeCapacityM3 = numericResult(cargoVolumeCapacityValue, "m^3");

  const totalEmptyMassValue =
    dryMassKg.availability === "Available" && plannedFuelMassKg.availability === "Available"
      ? finiteAdd(dryMassKg.value, plannedFuelMassKg.value)
      : null;
  const totalEmptyMassKg = numericResult(totalEmptyMassValue, "kg");
  const totalLoadedMassValue =
    totalEmptyMassKg.availability === "Available"
      ? finiteAdd(totalEmptyMassKg.value, preview.cargoPreviewMassKg)
      : null;
  const totalLoadedMassKg = numericResult(totalLoadedMassValue, "kg");

  const cargoPositionedMasses: PositionedMass[] = [];
  if (preview.cargoPreviewMassKg > 0 && cargoMassCapacityValue !== null && cargoMassCapacityValue > 0) {
    for (const store of cargoStores) {
      cargoPositionedMasses.push({
        massKg: preview.cargoPreviewMassKg * (store.capacityKg / cargoMassCapacityValue),
        position: store.position
      });
    }
  }
  const centerValue =
    totalLoadedMassKg.availability === "Available" &&
    (preview.cargoPreviewMassKg === 0 || (cargoMassCapacityValue !== null && cargoMassCapacityValue > 0))
      ? weightedCenter([...positionedMasses, ...fuelMasses, ...cargoPositionedMasses], totalLoadedMassKg.value)
      : null;
  const centerOfMass: ShipStats["centerOfMass"] =
    centerValue === null ? unavailable("Invalid", "m") : available(centerValue, "m");

  const mainThrustValue = sumFinite(usableThrusters.map((thruster) => thruster.thrustNewtons));
  const mainThrustNewtons: ShipStats["mainThrustNewtons"] =
    usableThrusters.length === 0
      ? unavailable("UnavailableNoThrust", "N")
      : mainThrustValue === null
        ? unavailable("Invalid", "N")
        : available(mainThrustValue, "N");
  const accelerationEmptyMps2 = dependentNumber(mainThrustNewtons, totalEmptyMassKg, "m/s^2");
  const accelerationLoadedMps2 = dependentNumber(mainThrustNewtons, totalLoadedMassKg, "m/s^2");

  let resultantForce = vector(0, 0, 0);
  let weightedThrustPoint = vector(0, 0, 0);
  let forwardThrust = 0;
  let brakingThrust = 0;
  let thrustGeometryValid = true;
  for (const thruster of usableThrusters) {
    resultantForce = addVector(resultantForce, multiplyVector(thruster.direction, thruster.thrustNewtons));
    weightedThrustPoint = addVector(weightedThrustPoint, multiplyVector(thruster.point, thruster.thrustNewtons));
    const nextForward = finiteAdd(forwardThrust, Math.max(0, thruster.direction.z) * thruster.thrustNewtons);
    const nextBraking = finiteAdd(brakingThrust, Math.max(0, -thruster.direction.z) * thruster.thrustNewtons);
    if (!isFiniteVector(resultantForce) || !isFiniteVector(weightedThrustPoint) || nextForward === null || nextBraking === null) {
      thrustGeometryValid = false;
      break;
    }
    forwardThrust = nextForward;
    brakingThrust = nextBraking;
  }
  const axisDirectionValue = thrustGeometryValid ? normalize(resultantForce) : null;
  const axisPointValue =
    thrustGeometryValid && mainThrustNewtons.availability === "Available"
      ? multiplyVector(weightedThrustPoint, 1 / mainThrustNewtons.value)
      : null;
  const thrustAxisPoint: ShipStats["thrustAxisPoint"] =
    usableThrusters.length === 0
      ? unavailable("UnavailableNoThrust", "m")
      : axisPointValue !== null && isFiniteVector(axisPointValue)
        ? available(axisPointValue, "m")
        : unavailable("Invalid", "m");
  const thrustAxisDirection: ShipStats["thrustAxisDirection"] =
    usableThrusters.length === 0
      ? unavailable("UnavailableNoThrust", "unitless")
      : axisDirectionValue === null
        ? unavailable("UnavailableUnsupported", "unitless")
        : available(axisDirectionValue, "unitless");
  let thrustOffsetMeters: ShipStats["thrustOffsetMeters"];
  if (centerOfMass.availability !== "Available") {
    thrustOffsetMeters = unavailable("Invalid", "m");
  } else if (thrustAxisPoint.availability !== "Available") {
    thrustOffsetMeters = unavailable(propagationAvailability(thrustAxisPoint), "m");
  } else if (thrustAxisDirection.availability !== "Available") {
    thrustOffsetMeters = unavailable(propagationAvailability(thrustAxisDirection), "m");
  } else {
    const fromAxisPoint = subtractVector(centerOfMass.value, thrustAxisPoint.value);
    const rejection = subtractVector(
      fromAxisPoint,
      multiplyVector(thrustAxisDirection.value, dot(fromAxisPoint, thrustAxisDirection.value))
    );
    const offset = magnitude(rejection);
    thrustOffsetMeters = Number.isFinite(offset) ? available(normalizedNumber(offset), "m") : unavailable("Invalid", "m");
  }

  const forwardForceStat: NumericStat<"N"> =
    usableThrusters.length === 0
      ? unavailable("UnavailableNoThrust", "N")
      : thrustGeometryValid
        ? available(forwardThrust, "N")
        : unavailable("Invalid", "N");
  const brakingForceStat: NumericStat<"N"> =
    usableThrusters.length === 0
      ? unavailable("UnavailableNoThrust", "N")
      : thrustGeometryValid
        ? available(brakingThrust, "N")
        : unavailable("Invalid", "N");
  const forwardAccelerationMps2 = dependentNumber(forwardForceStat, totalLoadedMassKg, "m/s^2");
  const brakingAccelerationMps2 = dependentNumber(brakingForceStat, totalLoadedMassKg, "m/s^2");
  const brakingRatio: ShipStats["brakingRatio"] =
    forwardAccelerationMps2.availability !== "Available"
      ? unavailable(propagationAvailability(forwardAccelerationMps2), "ratio")
      : forwardAccelerationMps2.value <= 0
        ? unavailable("UnavailableUnsupported", "ratio")
        : brakingAccelerationMps2.availability !== "Available"
          ? unavailable(propagationAvailability(brakingAccelerationMps2), "ratio")
          : numericResult(brakingAccelerationMps2.value / forwardAccelerationMps2.value, "ratio");

  const rcsAxes = { positiveX: 0, negativeX: 0, positiveY: 0, negativeY: 0, positiveZ: 0, negativeZ: 0 };
  const rcsTorque = { pitch: 0, yaw: 0, roll: 0 };
  let rcsTranslationValid = true;
  let rcsTorqueValid = centerOfMass.availability === "Available" || rcsNozzles.length === 0;
  for (const nozzle of rcsNozzles) {
    const contributions: readonly [keyof typeof rcsAxes, number][] = [
      ["positiveX", Math.max(0, nozzle.direction.x) * nozzle.thrust],
      ["negativeX", Math.max(0, -nozzle.direction.x) * nozzle.thrust],
      ["positiveY", Math.max(0, nozzle.direction.y) * nozzle.thrust],
      ["negativeY", Math.max(0, -nozzle.direction.y) * nozzle.thrust],
      ["positiveZ", Math.max(0, nozzle.direction.z) * nozzle.thrust],
      ["negativeZ", Math.max(0, -nozzle.direction.z) * nozzle.thrust]
    ];
    for (const [key, contribution] of contributions) {
      const next = finiteAdd(rcsAxes[key], contribution);
      if (next === null) {
        rcsTranslationValid = false;
      } else {
        rcsAxes[key] = next;
      }
    }
    if (centerOfMass.availability === "Available") {
      const lever = subtractVector(nozzle.point, centerOfMass.value);
      const torque = cross(lever, multiplyVector(nozzle.direction, nozzle.thrust));
      const nextPitch = finiteAdd(rcsTorque.pitch, Math.abs(torque.x));
      const nextYaw = finiteAdd(rcsTorque.yaw, Math.abs(torque.y));
      const nextRoll = finiteAdd(rcsTorque.roll, Math.abs(torque.z));
      if (!isFiniteVector(torque) || nextPitch === null || nextYaw === null || nextRoll === null) {
        rcsTorqueValid = false;
      } else {
        rcsTorque.pitch = nextPitch;
        rcsTorque.yaw = nextYaw;
        rcsTorque.roll = nextRoll;
      }
    }
  }
  const rcsStat = (value: number): NumericStat<"N"> =>
    rcsTranslationValid ? available(value, "N") : unavailable("Invalid", "N");
  const torqueStat = (value: number): NumericStat<"N*m"> =>
    rcsTorqueValid ? available(value, "N*m") : unavailable("Invalid", "N*m");

  let fixedWeaponCount = 0;
  let turretWeaponCount = 0;
  let usableWeaponCount = 0;
  let missingMuzzleCount = 0;
  for (const entry of weaponComponents) {
    if (entry.component.kind === "FixedWeapon") {
      fixedWeaponCount += 1;
      if (socketById(entry.definition, entry.component.muzzleSocketId) === undefined) {
        missingMuzzleCount += 1;
      }
      if (usableFixedWeapon(entry.component, entry.definition)) {
        usableWeaponCount += 1;
      }
    } else {
      turretWeaponCount += 1;
      if (socketById(entry.definition, entry.component.muzzleSocketId) === undefined) {
        missingMuzzleCount += 1;
      }
      if (usableTurretWeapon(entry.component, entry.definition)) {
        usableWeaponCount += 1;
      }
    }
  }
  const weaponCount = fixedWeaponCount + turretWeaponCount;

  const powerRequiredValue = sumFinite(powerReservations.map((reservation) => reservation.power));
  const heatGeneratedValue = sumFinite(powerReservations.map((reservation) => reservation.heat));
  const powerRequired: ShipStats["powerRequired"] =
    powerReservations.length === 0
      ? unavailable("UnavailableMissingMetadata", "W")
      : numericResult(powerRequiredValue, "W");
  const heatGenerated: ShipStats["heatGenerated"] =
    powerReservations.length === 0
      ? unavailable("UnavailableMissingMetadata", "W")
      : numericResult(heatGeneratedValue, "W");
  const propulsion = propulsionPerformance(usableThrusters, mainThrustNewtons, plannedFuelByKind, totalLoadedMassKg);

  const stats: ShipStats = {
    dryMassKg,
    plannedFuelMassKg,
    plannedCargoMassKg,
    plannedCargoVolumeM3,
    totalEmptyMassKg,
    totalLoadedMassKg,
    mainThrustNewtons,
    accelerationEmptyMps2,
    accelerationLoadedMps2,
    rcsTranslationPositiveX: rcsStat(rcsAxes.positiveX),
    rcsTranslationNegativeX: rcsStat(rcsAxes.negativeX),
    rcsTranslationPositiveY: rcsStat(rcsAxes.positiveY),
    rcsTranslationNegativeY: rcsStat(rcsAxes.negativeY),
    rcsTranslationPositiveZ: rcsStat(rcsAxes.positiveZ),
    rcsTranslationNegativeZ: rcsStat(rcsAxes.negativeZ),
    pitchTorqueNm: torqueStat(rcsTorque.pitch),
    yawTorqueNm: torqueStat(rcsTorque.yaw),
    rollTorqueNm: torqueStat(rcsTorque.roll),
    deltaVMps: propulsion.deltaVMps,
    burnTimeSeconds: propulsion.burnTimeSeconds,
    cargoMassCapacityKg,
    cargoVolumeCapacityM3,
    weaponCount: available(weaponCount, "count"),
    usableWeaponCount: available(usableWeaponCount, "count"),
    fixedWeaponCount: available(fixedWeaponCount, "count"),
    turretWeaponCount: available(turretWeaponCount, "count"),
    missingMuzzleCount: available(missingMuzzleCount, "count"),
    blockedOrInvalidWeaponCount: available(weaponCount - usableWeaponCount, "count"),
    centerOfMass,
    thrustAxisPoint,
    thrustAxisDirection,
    thrustOffsetMeters,
    forwardAccelerationMps2,
    brakingAccelerationMps2,
    brakingRatio,
    powerGenerated: unavailable("UnavailableMissingMetadata", "W"),
    powerRequired,
    powerBalance: unavailable("UnavailableMissingMetadata", "W"),
    heatGenerated,
    coolingCapacity: unavailable("UnavailableMissingMetadata", "W"),
    heatBalance: unavailable("UnavailableMissingMetadata", "W")
  };
  const payload: ShipStatsReportPayload = {
    reportVersion: 1,
    catalogSignature: catalog.signature,
    blueprintLayoutHash: shipBlueprintLayoutHash(blueprint),
    previewSignature: preview.signature,
    policySignature: policy.signature,
    preview,
    policy,
    stats
  };
  return deepFreeze({ ...payload, signature: canonicalJsonHash(payload) }) as ShipStatsReport;
};
