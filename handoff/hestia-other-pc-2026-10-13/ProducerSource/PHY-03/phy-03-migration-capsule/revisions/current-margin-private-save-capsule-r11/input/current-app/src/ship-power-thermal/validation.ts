import { cloneAndFreezeShipPowerThermalValue, isCanonicalShipPowerThermalArrayIndex } from "./canonical";
import {
  compareShipPowerThermalIds,
  parseBatteryId,
  parseCoolingId,
  parseHeatContributionId,
  parsePowerBusId,
  parsePowerConsumerId,
  parsePowerSourceId,
  parseThermalNodeId,
  ShipPowerThermalIdError,
  type PowerBusId,
  type PowerConsumerId,
} from "./ids";
import {
  BATTERY_RESERVE_POLICIES,
  POWER_PRIORITIES,
  THERMAL_PROTECTION_STATES,
  type BatteryDefinition,
  type BatteryState,
  type ConsumerPowerAllocationResult,
  type ConsumerPowerRequest,
  type CoolingDefinition,
  type CoolingState,
  type HeatSourceContribution,
  type PowerBusDefinition,
  type PowerConsumerDefinition,
  type PowerSourceDefinition,
  type PowerSourceState,
  type ShipPowerThermalDefinitions,
  type ShipPowerThermalState,
  type ShipPowerThermalStepInput,
  type ThermalNodeDefinition,
  type ThermalNodeState,
  type ThermalProtectionState,
  type ValidatedShipPowerThermalStepInput
} from "./types";

export type ShipPowerThermalValidationIssueCode =
  | "INVALID_TYPE"
  | "MISSING_REQUIRED_FIELD"
  | "UNKNOWN_FIELD"
  | "INVALID_ID"
  | "DUPLICATE_ID"
  | "UNKNOWN_REFERENCE"
  | "MISSING_STATE"
  | "DEFINITION_STATE_MISMATCH"
  | "INVALID_NUMBER"
  | "OUT_OF_RANGE"
  | "INVALID_THRESHOLD_ORDER"
  | "INVALID_ENUM"
  | "INVALID_TICK"
  | "INVALID_DELTA_TIME"
  | "DUPLICATE_REQUEST"
  | "BUS_NODE_MISMATCH"
  | "ARITHMETIC_OVERFLOW";

export interface ShipPowerThermalValidationIssue {
  readonly code: ShipPowerThermalValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class ShipPowerThermalValidationError extends Error {
  public readonly issues: readonly ShipPowerThermalValidationIssue[];
  public readonly code: ShipPowerThermalValidationIssueCode;
  public readonly path: string;

  public constructor(issue: ShipPowerThermalValidationIssue) {
    super(issue.message);
    this.name = "ShipPowerThermalValidationError";
    const frozenIssue = Object.freeze({ ...issue });
    this.issues = Object.freeze([frozenIssue]);
    this.code = issue.code;
    this.path = issue.path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type ShipPowerThermalValidationResult<T> =
  | { readonly ok: true; readonly value: Readonly<T> }
  | { readonly ok: false; readonly issues: readonly ShipPowerThermalValidationIssue[] };

const fail = (code: ShipPowerThermalValidationIssueCode, path: string, message: string): never => {
  throw new ShipPowerThermalValidationError({ code, path, message });
};

export const pathFor = (parent: string, segment: string | number): string =>
  `${parent}/${String(segment).replace(/~/g, "~0").replace(/\//g, "~1")}`;

const pathForId = (parent: string, collection: string, id: string): string =>
  pathFor(pathFor(parent, collection), id);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const readObject = (value: unknown, path: string, allowedFields: readonly string[]): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(value)) return fail("INVALID_TYPE", path, "Expected a plain object.");
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) return fail("INVALID_TYPE", path, "Symbol fields are unsupported.");
  for (const key of (keys as string[]).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return fail("INVALID_TYPE", pathFor(path, key), "Expected an enumerable data property.");
    }
    if (!allowedFields.includes(key)) return fail("UNKNOWN_FIELD", pathFor(path, key), "Unexpected field.");
  }
  return value;
};

const required = (object: Readonly<Record<string, unknown>>, key: string, path: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) return fail("MISSING_REQUIRED_FIELD", pathFor(path, key), "Required field is missing.");
  if (!("value" in descriptor) || descriptor.enumerable !== true) {
    return fail("INVALID_TYPE", pathFor(path, key), "Expected an enumerable data property.");
  }
  return descriptor.value;
};

const readArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return fail("INVALID_TYPE", path, "Expected a plain dense array.");
  }
  const keys = Reflect.ownKeys(value);
  const indexKeys: string[] = [];
  for (const key of keys) {
    if (key === "length") continue;
    if (typeof key === "symbol" || !isCanonicalShipPowerThermalArrayIndex(key, value.length)) {
      return fail("INVALID_TYPE", path, "Arrays cannot contain symbol or extra properties.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return fail("INVALID_TYPE", pathFor(path, key), "Expected an enumerable array data property.");
    }
    indexKeys.push(key);
  }
  indexKeys.sort((left, right) => Number(left) - Number(right));
  for (let index = 0; index < indexKeys.length; index += 1) {
    if (indexKeys[index] !== String(index)) {
      return fail("INVALID_TYPE", pathFor(path, index), "Expected a dense enumerable array entry.");
    }
  }
  if (indexKeys.length !== value.length) {
    return fail("INVALID_TYPE", pathFor(path, indexKeys.length), "Expected a dense enumerable array entry.");
  }
  return value;
};

const readBoolean = (value: unknown, path: string): boolean =>
  typeof value === "boolean" ? value : fail("INVALID_TYPE", path, "Expected a boolean.");

const readFinite = (
  value: unknown,
  path: string,
  minimum?: number,
  maximum?: number,
  exclusiveMinimum = false
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail("INVALID_NUMBER", path, "Expected a finite number.");
  }
  const normalized = Object.is(value, -0) ? 0 : value;
  if (minimum !== undefined && (exclusiveMinimum ? normalized <= minimum : normalized < minimum)) {
    return fail("OUT_OF_RANGE", path, exclusiveMinimum ? `Expected a number greater than ${minimum}.` : `Expected a number at least ${minimum}.`);
  }
  if (maximum !== undefined && normalized > maximum) {
    return fail("OUT_OF_RANGE", path, `Expected a number no greater than ${maximum}.`);
  }
  return normalized;
};

const readTick = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return fail("INVALID_TICK", path, "Expected a nonnegative safe integer tick.");
  }
  return value;
};

const readEnum = <T extends string>(value: unknown, allowed: readonly T[], path: string): T =>
  typeof value === "string" && allowed.includes(value as T)
    ? value as T
    : fail("INVALID_ENUM", path, `Expected one of: ${allowed.join(", ")}.`);

const parseId = <T>(parser: (value: unknown, path: string) => T, value: unknown, path: string): T => {
  try {
    return parser(value, path);
  } catch (error) {
    if (error instanceof ShipPowerThermalIdError) return fail("INVALID_ID", path, error.message);
    throw error;
  }
};

const requireUnique = <T>(values: readonly T[], id: (value: T) => string, path: string): void => {
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = id(values[index]);
    if (seen.has(value)) return fail("DUPLICATE_ID", pathFor(path, index), `Duplicate stable ID: ${value}.`);
    seen.add(value);
  }
};

const ordered = <T>(values: readonly T[], id: (value: T) => string): readonly T[] =>
  [...values].sort((left, right) => compareShipPowerThermalIds(id(left), id(right)));

const parseBus = (value: unknown, path: string): PowerBusDefinition => {
  const object = readObject(value, path, ["busId"]);
  return { busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")) };
};

const parseSource = (value: unknown, path: string): PowerSourceDefinition => {
  const object = readObject(value, path, [
    "sourceId", "busId", "thermalNodeId", "maxOutputW", "availableFraction", "rampLimitWPerSecond", "efficiency"
  ]);
  const maxOutputW = readFinite(required(object, "maxOutputW", path), pathFor(path, "maxOutputW"), 0);
  const efficiency = readFinite(required(object, "efficiency", path), pathFor(path, "efficiency"), 0, 1);
  if (maxOutputW > 0 && efficiency <= 0) {
    return fail("OUT_OF_RANGE", pathFor(path, "efficiency"), "A positive-capability source requires positive efficiency.");
  }
  if (maxOutputW > 0 && !Number.isFinite(maxOutputW / efficiency - maxOutputW)) {
    return fail(
      "ARITHMETIC_OVERFLOW",
      pathFor(path, "efficiency"),
      "Maximum source loss arithmetic must remain finite."
    );
  }
  return {
    sourceId: parseId(parsePowerSourceId, required(object, "sourceId", path), pathFor(path, "sourceId")),
    busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")),
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    maxOutputW,
    availableFraction: readFinite(required(object, "availableFraction", path), pathFor(path, "availableFraction"), 0, 1),
    rampLimitWPerSecond: readFinite(required(object, "rampLimitWPerSecond", path), pathFor(path, "rampLimitWPerSecond"), 0),
    efficiency
  };
};

const parseConsumer = (value: unknown, path: string): PowerConsumerDefinition => {
  const object = readObject(value, path, [
    "consumerId", "busId", "priority", "minimumOperationalPowerW", "canThrottle", "canShed"
  ]);
  return {
    consumerId: parseId(parsePowerConsumerId, required(object, "consumerId", path), pathFor(path, "consumerId")),
    busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")),
    priority: readEnum(required(object, "priority", path), POWER_PRIORITIES, pathFor(path, "priority")),
    minimumOperationalPowerW: readFinite(
      required(object, "minimumOperationalPowerW", path),
      pathFor(path, "minimumOperationalPowerW"),
      0
    ),
    canThrottle: readBoolean(required(object, "canThrottle", path), pathFor(path, "canThrottle")),
    canShed: readBoolean(required(object, "canShed", path), pathFor(path, "canShed"))
  };
};

const parseBattery = (value: unknown, path: string): BatteryDefinition => {
  const object = readObject(value, path, [
    "batteryId", "busId", "thermalNodeId", "capacityJ", "reserveEnergyJ", "maxChargePowerW",
    "maxDischargePowerW", "chargeEfficiency", "dischargeEfficiency", "reservePolicy"
  ]);
  const capacityJ = readFinite(required(object, "capacityJ", path), pathFor(path, "capacityJ"), 0);
  const reserveEnergyJ = readFinite(required(object, "reserveEnergyJ", path), pathFor(path, "reserveEnergyJ"), 0, capacityJ);
  const maxChargePowerW = readFinite(required(object, "maxChargePowerW", path), pathFor(path, "maxChargePowerW"), 0);
  const maxDischargePowerW = readFinite(required(object, "maxDischargePowerW", path), pathFor(path, "maxDischargePowerW"), 0);
  const chargeEfficiency = readFinite(required(object, "chargeEfficiency", path), pathFor(path, "chargeEfficiency"), 0, 1);
  const dischargeEfficiency = readFinite(required(object, "dischargeEfficiency", path), pathFor(path, "dischargeEfficiency"), 0, 1);
  if (maxChargePowerW > 0 && chargeEfficiency <= 0) {
    return fail("OUT_OF_RANGE", pathFor(path, "chargeEfficiency"), "Positive charge capability requires positive efficiency.");
  }
  if (maxDischargePowerW > 0 && dischargeEfficiency <= 0) {
    return fail("OUT_OF_RANGE", pathFor(path, "dischargeEfficiency"), "Positive discharge capability requires positive efficiency.");
  }
  return {
    batteryId: parseId(parseBatteryId, required(object, "batteryId", path), pathFor(path, "batteryId")),
    busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")),
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    capacityJ,
    reserveEnergyJ,
    maxChargePowerW,
    maxDischargePowerW,
    chargeEfficiency,
    dischargeEfficiency,
    reservePolicy: readEnum(required(object, "reservePolicy", path), BATTERY_RESERVE_POLICIES, pathFor(path, "reservePolicy"))
  };
};

const parseThermalNode = (value: unknown, path: string): ThermalNodeDefinition => {
  const object = readObject(value, path, [
    "thermalNodeId", "busId", "heatCapacityJPerK", "minimumTemperatureK", "warningTemperatureK",
    "criticalTemperatureK", "shutdownTemperatureK", "maximumTemperatureK"
  ]);
  const definition: ThermalNodeDefinition = {
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")),
    heatCapacityJPerK: readFinite(required(object, "heatCapacityJPerK", path), pathFor(path, "heatCapacityJPerK"), 0, undefined, true),
    minimumTemperatureK: readFinite(required(object, "minimumTemperatureK", path), pathFor(path, "minimumTemperatureK"), 0),
    warningTemperatureK: readFinite(required(object, "warningTemperatureK", path), pathFor(path, "warningTemperatureK"), 0),
    criticalTemperatureK: readFinite(required(object, "criticalTemperatureK", path), pathFor(path, "criticalTemperatureK"), 0),
    shutdownTemperatureK: readFinite(required(object, "shutdownTemperatureK", path), pathFor(path, "shutdownTemperatureK"), 0),
    maximumTemperatureK: readFinite(required(object, "maximumTemperatureK", path), pathFor(path, "maximumTemperatureK"), 0)
  };
  if (!(definition.minimumTemperatureK <= definition.warningTemperatureK
    && definition.warningTemperatureK < definition.criticalTemperatureK
    && definition.criticalTemperatureK < definition.shutdownTemperatureK
    && definition.shutdownTemperatureK <= definition.maximumTemperatureK)) {
    return fail(
      "INVALID_THRESHOLD_ORDER",
      path,
      "Thermal thresholds must satisfy minimum <= warning < critical < shutdown <= maximum."
    );
  }
  return definition;
};

const parseCooling = (value: unknown, path: string): CoolingDefinition => {
  const object = readObject(value, path, [
    "coolingId", "thermalNodeId", "consumerId", "maxCoolingPowerW", "minimumOperatingPowerW", "sinkTemperatureK"
  ]);
  const maxCoolingPowerW = readFinite(required(object, "maxCoolingPowerW", path), pathFor(path, "maxCoolingPowerW"), 0);
  const minimumOperatingPowerW = readFinite(
    required(object, "minimumOperatingPowerW", path),
    pathFor(path, "minimumOperatingPowerW"),
    0
  );
  if (maxCoolingPowerW > 0 && minimumOperatingPowerW <= 0) {
    return fail(
      "OUT_OF_RANGE",
      pathFor(path, "minimumOperatingPowerW"),
      "Positive cooling capability requires positive minimum operating power."
    );
  }
  return {
    coolingId: parseId(parseCoolingId, required(object, "coolingId", path), pathFor(path, "coolingId")),
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    consumerId: parseId(parsePowerConsumerId, required(object, "consumerId", path), pathFor(path, "consumerId")),
    maxCoolingPowerW,
    minimumOperatingPowerW,
    sinkTemperatureK: readFinite(required(object, "sinkTemperatureK", path), pathFor(path, "sinkTemperatureK"), 0)
  };
};

const definitionsInternal = (value: unknown, path = "/definitions"): ShipPowerThermalDefinitions => {
  const object = readObject(value, path, ["buses", "sources", "consumers", "batteries", "thermalNodes", "cooling"]);
  const buses = readArray(required(object, "buses", path), pathFor(path, "buses"))
    .map((entry, index) => parseBus(entry, pathFor(pathFor(path, "buses"), index)));
  const sources = readArray(required(object, "sources", path), pathFor(path, "sources"))
    .map((entry, index) => parseSource(entry, pathFor(pathFor(path, "sources"), index)));
  const consumers = readArray(required(object, "consumers", path), pathFor(path, "consumers"))
    .map((entry, index) => parseConsumer(entry, pathFor(pathFor(path, "consumers"), index)));
  const batteries = readArray(required(object, "batteries", path), pathFor(path, "batteries"))
    .map((entry, index) => parseBattery(entry, pathFor(pathFor(path, "batteries"), index)));
  const thermalNodes = readArray(required(object, "thermalNodes", path), pathFor(path, "thermalNodes"))
    .map((entry, index) => parseThermalNode(entry, pathFor(pathFor(path, "thermalNodes"), index)));
  const cooling = readArray(required(object, "cooling", path), pathFor(path, "cooling"))
    .map((entry, index) => parseCooling(entry, pathFor(pathFor(path, "cooling"), index)));

  requireUnique(buses, (entry) => entry.busId, pathFor(path, "buses"));
  requireUnique(sources, (entry) => entry.sourceId, pathFor(path, "sources"));
  requireUnique(consumers, (entry) => entry.consumerId, pathFor(path, "consumers"));
  requireUnique(batteries, (entry) => entry.batteryId, pathFor(path, "batteries"));
  requireUnique(thermalNodes, (entry) => entry.thermalNodeId, pathFor(path, "thermalNodes"));
  requireUnique(cooling, (entry) => entry.coolingId, pathFor(path, "cooling"));

  const busById = new Map(buses.map((entry) => [entry.busId, entry]));
  const nodeById = new Map(thermalNodes.map((entry) => [entry.thermalNodeId, entry]));
  const consumerById = new Map(consumers.map((entry) => [entry.consumerId, entry]));
  const requireBus = (busId: PowerBusId, itemPath: string): void => {
    if (!busById.has(busId)) fail("UNKNOWN_REFERENCE", itemPath, `Unknown power bus: ${busId}.`);
  };
  for (const source of sources) {
    const sourcePath = pathForId(path, "sources", source.sourceId);
    requireBus(source.busId, pathFor(sourcePath, "busId"));
    const node = nodeById.get(source.thermalNodeId);
    if (node === undefined) return fail("UNKNOWN_REFERENCE", pathFor(sourcePath, "thermalNodeId"), "Unknown thermal node.");
    if (node.busId !== source.busId) fail("BUS_NODE_MISMATCH", pathFor(sourcePath, "thermalNodeId"), "Source and thermal node must belong to the same bus.");
  }
  for (const consumer of consumers) {
    requireBus(consumer.busId, pathFor(pathForId(path, "consumers", consumer.consumerId), "busId"));
  }
  for (const battery of batteries) {
    const batteryPath = pathForId(path, "batteries", battery.batteryId);
    requireBus(battery.busId, pathFor(batteryPath, "busId"));
    const node = nodeById.get(battery.thermalNodeId);
    if (node === undefined) return fail("UNKNOWN_REFERENCE", pathFor(batteryPath, "thermalNodeId"), "Unknown thermal node.");
    if (node.busId !== battery.busId) fail("BUS_NODE_MISMATCH", pathFor(batteryPath, "thermalNodeId"), "Battery and thermal node must belong to the same bus.");
  }
  for (const node of thermalNodes) {
    requireBus(node.busId, pathFor(pathForId(path, "thermalNodes", node.thermalNodeId), "busId"));
  }
  for (const device of cooling) {
    const coolingPath = pathForId(path, "cooling", device.coolingId);
    const node = nodeById.get(device.thermalNodeId);
    const consumer = consumerById.get(device.consumerId);
    if (node === undefined) return fail("UNKNOWN_REFERENCE", pathFor(coolingPath, "thermalNodeId"), "Unknown thermal node.");
    if (consumer === undefined) return fail("UNKNOWN_REFERENCE", pathFor(coolingPath, "consumerId"), "Unknown cooling consumer.");
    if (node.busId !== consumer.busId) fail("BUS_NODE_MISMATCH", coolingPath, "Cooling node and consumer must belong to the same bus.");
  }

  return cloneAndFreezeShipPowerThermalValue({
    buses: ordered(buses, (entry) => entry.busId),
    sources: ordered(sources, (entry) => entry.sourceId),
    consumers: ordered(consumers, (entry) => entry.consumerId),
    batteries: ordered(batteries, (entry) => entry.batteryId),
    thermalNodes: ordered(thermalNodes, (entry) => entry.thermalNodeId),
    cooling: ordered(cooling, (entry) => entry.coolingId)
  }) as ShipPowerThermalDefinitions;
};

const deriveProtectionState = (temperatureK: number, definition: ThermalNodeDefinition): ThermalProtectionState => {
  if (temperatureK >= definition.shutdownTemperatureK) return "Shutdown";
  if (temperatureK >= definition.criticalTemperatureK) return "Critical";
  if (temperatureK >= definition.warningTemperatureK) return "Warning";
  return "Nominal";
};

const parseSourceState = (value: unknown, path: string, definition: PowerSourceDefinition): PowerSourceState => {
  const object = readObject(value, path, ["sourceId", "busId", "thermalNodeId", "currentOutputW"]);
  const state: PowerSourceState = {
    sourceId: parseId(parsePowerSourceId, required(object, "sourceId", path), pathFor(path, "sourceId")),
    busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")),
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    currentOutputW: readFinite(required(object, "currentOutputW", path), pathFor(path, "currentOutputW"), 0, definition.maxOutputW)
  };
  if (state.sourceId !== definition.sourceId || state.busId !== definition.busId || state.thermalNodeId !== definition.thermalNodeId) {
    return fail("DEFINITION_STATE_MISMATCH", path, "Source state identities must match its definition.");
  }
  return state;
};

const parseBatteryState = (value: unknown, path: string, definition: BatteryDefinition): BatteryState => {
  const object = readObject(value, path, ["batteryId", "busId", "thermalNodeId", "storedEnergyJ"]);
  const state: BatteryState = {
    batteryId: parseId(parseBatteryId, required(object, "batteryId", path), pathFor(path, "batteryId")),
    busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")),
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    storedEnergyJ: readFinite(required(object, "storedEnergyJ", path), pathFor(path, "storedEnergyJ"), 0, definition.capacityJ)
  };
  if (state.batteryId !== definition.batteryId || state.busId !== definition.busId || state.thermalNodeId !== definition.thermalNodeId) {
    return fail("DEFINITION_STATE_MISMATCH", path, "Battery state identities must match its definition.");
  }
  return state;
};

const parseThermalNodeState = (value: unknown, path: string, definition: ThermalNodeDefinition): ThermalNodeState => {
  const object = readObject(value, path, ["thermalNodeId", "busId", "temperatureK", "protectionState"]);
  const state: ThermalNodeState = {
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    busId: parseId(parsePowerBusId, required(object, "busId", path), pathFor(path, "busId")),
    temperatureK: readFinite(
      required(object, "temperatureK", path),
      pathFor(path, "temperatureK"),
      definition.minimumTemperatureK,
      definition.maximumTemperatureK
    ),
    protectionState: readEnum(
      required(object, "protectionState", path),
      THERMAL_PROTECTION_STATES,
      pathFor(path, "protectionState")
    )
  };
  if (state.thermalNodeId !== definition.thermalNodeId || state.busId !== definition.busId) {
    return fail("DEFINITION_STATE_MISMATCH", path, "Thermal state identities must match its definition.");
  }
  const atBoundary = state.temperatureK === definition.minimumTemperatureK || state.temperatureK === definition.maximumTemperatureK;
  if (state.protectionState === "Invalid") {
    if (!atBoundary) return fail("DEFINITION_STATE_MISMATCH", pathFor(path, "protectionState"), "Invalid thermal state must be held at a validated boundary.");
  } else if (state.protectionState !== deriveProtectionState(state.temperatureK, definition)) {
    return fail("DEFINITION_STATE_MISMATCH", pathFor(path, "protectionState"), "Protection state does not match the validated temperature thresholds.");
  }
  return state;
};

const parseCoolingState = (value: unknown, path: string, definition: CoolingDefinition): CoolingState => {
  const object = readObject(value, path, ["coolingId", "thermalNodeId", "consumerId", "allocatedOperatingPowerW"]);
  const state: CoolingState = {
    coolingId: parseId(parseCoolingId, required(object, "coolingId", path), pathFor(path, "coolingId")),
    thermalNodeId: parseId(parseThermalNodeId, required(object, "thermalNodeId", path), pathFor(path, "thermalNodeId")),
    consumerId: parseId(parsePowerConsumerId, required(object, "consumerId", path), pathFor(path, "consumerId")),
    allocatedOperatingPowerW: readFinite(
      required(object, "allocatedOperatingPowerW", path),
      pathFor(path, "allocatedOperatingPowerW"),
      0
    )
  };
  if (state.coolingId !== definition.coolingId
    || state.thermalNodeId !== definition.thermalNodeId
    || state.consumerId !== definition.consumerId) {
    return fail("DEFINITION_STATE_MISMATCH", path, "Cooling state identities must match its definition.");
  }
  return state;
};

const indexStateById = <TId extends string>(
  values: readonly unknown[],
  path: string,
  readId: (value: unknown, path: string) => TId
): ReadonlyMap<TId, unknown> => {
  const result = new Map<TId, unknown>();
  for (let index = 0; index < values.length; index += 1) {
    const itemPath = pathFor(path, index);
    const id = readId(values[index], itemPath);
    if (result.has(id)) return fail("DUPLICATE_ID", itemPath, `Duplicate state ID: ${id}.`);
    result.set(id, values[index]);
  }
  return result;
};

const stateInternal = (value: unknown, definitions: ShipPowerThermalDefinitions, path = "/state"): ShipPowerThermalState => {
  const object = readObject(value, path, ["tick", "sources", "batteries", "thermalNodes", "cooling"]);
  const sourceValues = readArray(required(object, "sources", path), pathFor(path, "sources"));
  const batteryValues = readArray(required(object, "batteries", path), pathFor(path, "batteries"));
  const nodeValues = readArray(required(object, "thermalNodes", path), pathFor(path, "thermalNodes"));
  const coolingValues = readArray(required(object, "cooling", path), pathFor(path, "cooling"));

  const sourceById = indexStateById(sourceValues, pathFor(path, "sources"), (entry, itemPath) => {
    const item = readObject(entry, itemPath, ["sourceId", "busId", "thermalNodeId", "currentOutputW"]);
    return parseId(parsePowerSourceId, required(item, "sourceId", itemPath), pathFor(itemPath, "sourceId"));
  });
  const batteryById = indexStateById(batteryValues, pathFor(path, "batteries"), (entry, itemPath) => {
    const item = readObject(entry, itemPath, ["batteryId", "busId", "thermalNodeId", "storedEnergyJ"]);
    return parseId(parseBatteryId, required(item, "batteryId", itemPath), pathFor(itemPath, "batteryId"));
  });
  const nodeById = indexStateById(nodeValues, pathFor(path, "thermalNodes"), (entry, itemPath) => {
    const item = readObject(entry, itemPath, ["thermalNodeId", "busId", "temperatureK", "protectionState"]);
    return parseId(parseThermalNodeId, required(item, "thermalNodeId", itemPath), pathFor(itemPath, "thermalNodeId"));
  });
  const coolingById = indexStateById(coolingValues, pathFor(path, "cooling"), (entry, itemPath) => {
    const item = readObject(entry, itemPath, ["coolingId", "thermalNodeId", "consumerId", "allocatedOperatingPowerW"]);
    return parseId(parseCoolingId, required(item, "coolingId", itemPath), pathFor(itemPath, "coolingId"));
  });

  const requireExactStates = <TDefinition, TId extends string>(
    expected: readonly TDefinition[],
    states: ReadonlyMap<TId, unknown>,
    selectId: (definition: TDefinition) => TId,
    statePath: string
  ): void => {
    const expectedIds = new Set(expected.map(selectId));
    for (const id of expectedIds) if (!states.has(id)) fail("MISSING_STATE", statePath, `Missing state for definition: ${id}.`);
    for (const id of states.keys()) if (!expectedIds.has(id)) fail("DEFINITION_STATE_MISMATCH", statePath, `State has no matching definition: ${id}.`);
  };
  requireExactStates(definitions.sources, sourceById, (entry) => entry.sourceId, pathFor(path, "sources"));
  requireExactStates(definitions.batteries, batteryById, (entry) => entry.batteryId, pathFor(path, "batteries"));
  requireExactStates(definitions.thermalNodes, nodeById, (entry) => entry.thermalNodeId, pathFor(path, "thermalNodes"));
  requireExactStates(definitions.cooling, coolingById, (entry) => entry.coolingId, pathFor(path, "cooling"));

  const sources = definitions.sources.map((definition) =>
    parseSourceState(sourceById.get(definition.sourceId), pathForId(path, "sources", definition.sourceId), definition)
  );
  const batteries = definitions.batteries.map((definition) =>
    parseBatteryState(batteryById.get(definition.batteryId), pathForId(path, "batteries", definition.batteryId), definition)
  );
  const thermalNodes = definitions.thermalNodes.map((definition) =>
    parseThermalNodeState(nodeById.get(definition.thermalNodeId), pathForId(path, "thermalNodes", definition.thermalNodeId), definition)
  );
  const cooling = definitions.cooling.map((definition) =>
    parseCoolingState(coolingById.get(definition.coolingId), pathForId(path, "cooling", definition.coolingId), definition)
  );
  return cloneAndFreezeShipPowerThermalValue({
    tick: readTick(required(object, "tick", path), pathFor(path, "tick")),
    sources,
    batteries,
    thermalNodes,
    cooling
  }) as ShipPowerThermalState;
};

const rejectedRequest = (
  consumerId: PowerConsumerId,
  definition: PowerConsumerDefinition
): ConsumerPowerAllocationResult => ({
  consumerId,
  busId: definition.busId,
  priority: definition.priority,
  requestedPowerW: 0,
  allocatedPowerW: 0,
  satisfactionFraction: 0,
  state: "RejectedInvalidRequest",
  rejectionCode: "InvalidRequestedPowerW"
});

const ensureFiniteArithmetic = (value: number, path: string): number =>
  Number.isFinite(value) ? value : fail("ARITHMETIC_OVERFLOW", path, "Validated values would produce non-finite arithmetic.");

const stepInputInternal = (value: unknown): ValidatedShipPowerThermalStepInput => {
  const path = "";
  const object = readObject(value, path, [
    "definitions", "state", "tick", "deltaTimeSeconds", "consumerRequests", "heatContributions"
  ]);
  const definitions = definitionsInternal(required(object, "definitions", path));
  const state = stateInternal(required(object, "state", path), definitions);
  const tick = readTick(required(object, "tick", path), "/tick");
  if (tick <= state.tick) {
    return fail("INVALID_TICK", "/tick", "Step tick must be greater than the prior state tick.");
  }
  const deltaTimeSeconds = readFinite(required(object, "deltaTimeSeconds", path), "/deltaTimeSeconds", 0, undefined, true);

  const consumerById = new Map(definitions.consumers.map((entry) => [entry.consumerId, entry]));
  const seenRequests = new Set<PowerConsumerId>();
  const consumerRequests: ConsumerPowerRequest[] = [];
  const rejectedConsumerResults: ConsumerPowerAllocationResult[] = [];
  const requestValues = readArray(required(object, "consumerRequests", path), "/consumerRequests");
  for (let index = 0; index < requestValues.length; index += 1) {
    const requestPath = pathFor("/consumerRequests", index);
    const requestObject = readObject(requestValues[index], requestPath, ["consumerId", "requestedPowerW"]);
    const consumerId = parseId(
      parsePowerConsumerId,
      required(requestObject, "consumerId", requestPath),
      pathFor(requestPath, "consumerId")
    );
    if (seenRequests.has(consumerId)) return fail("DUPLICATE_REQUEST", requestPath, `Duplicate request for consumer: ${consumerId}.`);
    seenRequests.add(consumerId);
    const definition = consumerById.get(consumerId);
    if (definition === undefined) return fail("UNKNOWN_REFERENCE", pathFor(requestPath, "consumerId"), "Unknown power consumer.");
    const requestedPowerValue = required(requestObject, "requestedPowerW", requestPath);
    if (typeof requestedPowerValue !== "number" || !Number.isFinite(requestedPowerValue) || requestedPowerValue < 0) {
      rejectedConsumerResults.push(rejectedRequest(consumerId, definition));
    } else {
      consumerRequests.push({
        consumerId,
        requestedPowerW: Object.is(requestedPowerValue, -0) ? 0 : requestedPowerValue
      });
    }
  }

  const nodeById = new Map(definitions.thermalNodes.map((entry) => [entry.thermalNodeId, entry]));
  const seenHeat = new Set<string>();
  const heatContributions: HeatSourceContribution[] = readArray(
    required(object, "heatContributions", path),
    "/heatContributions"
  ).map((entry, index) => {
    const contributionPath = pathFor("/heatContributions", index);
    const contributionObject = readObject(entry, contributionPath, ["heatContributionId", "thermalNodeId", "heatInputW"]);
    const heatContributionId = parseId(
      parseHeatContributionId,
      required(contributionObject, "heatContributionId", contributionPath),
      pathFor(contributionPath, "heatContributionId")
    );
    if (seenHeat.has(heatContributionId)) return fail("DUPLICATE_ID", contributionPath, `Duplicate heat contribution ID: ${heatContributionId}.`);
    seenHeat.add(heatContributionId);
    const thermalNodeId = parseId(
      parseThermalNodeId,
      required(contributionObject, "thermalNodeId", contributionPath),
      pathFor(contributionPath, "thermalNodeId")
    );
    if (!nodeById.has(thermalNodeId)) return fail("UNKNOWN_REFERENCE", pathFor(contributionPath, "thermalNodeId"), "Unknown thermal node.");
    return {
      heatContributionId,
      thermalNodeId,
      heatInputW: readFinite(required(contributionObject, "heatInputW", contributionPath), pathFor(contributionPath, "heatInputW"), 0)
    };
  });

  const requestTotalByBus = new Map<PowerBusId, number>();
  for (const bus of definitions.buses) {
    let requestTotalW = 0;
    for (const request of consumerRequests) {
      const definition = consumerById.get(request.consumerId) as PowerConsumerDefinition;
      if (definition.busId === bus.busId) {
        requestTotalW = ensureFiniteArithmetic(requestTotalW + request.requestedPowerW, "/consumerRequests");
      }
    }
    requestTotalByBus.set(bus.busId, requestTotalW);
  }
  const sourceStateById = new Map(state.sources.map((entry) => [entry.sourceId, entry]));
  const projectedSourcePowerByBus = new Map<PowerBusId, number>();
  const projectedHeatInputByNode = new Map(
    definitions.thermalNodes.map((definition) => [definition.thermalNodeId, 0])
  );
  for (const definition of definitions.sources) {
    const definitionPath = pathForId("/definitions", "sources", definition.sourceId);
    const availableCapacityW = ensureFiniteArithmetic(
      definition.maxOutputW * definition.availableFraction,
      definitionPath
    );
    const rampAmountW = ensureFiniteArithmetic(
      definition.rampLimitWPerSecond * deltaTimeSeconds,
      definitionPath
    );
    if (definition.efficiency > 0) {
      ensureFiniteArithmetic(definition.maxOutputW / definition.efficiency - definition.maxOutputW, definitionPath);
      const sourceState = sourceStateById.get(definition.sourceId) as PowerSourceState;
      ensureFiniteArithmetic(sourceState.currentOutputW / definition.efficiency - sourceState.currentOutputW, pathForId("/state", "sources", definition.sourceId));

      const remainingDemandW = Math.max(
        0,
        (requestTotalByBus.get(definition.busId) ?? 0) - (projectedSourcePowerByBus.get(definition.busId) ?? 0)
      );
      const targetOutputW = Math.min(remainingDemandW, availableCapacityW);
      const projectedOutputW = sourceState.currentOutputW < targetOutputW
        ? Math.min(targetOutputW, ensureFiniteArithmetic(sourceState.currentOutputW + rampAmountW, definitionPath))
        : Math.max(targetOutputW, ensureFiniteArithmetic(sourceState.currentOutputW - rampAmountW, definitionPath));
      const outputDeltaW = Math.abs(ensureFiniteArithmetic(
        projectedOutputW - sourceState.currentOutputW,
        definitionPath
      ));
      if (projectedOutputW <= availableCapacityW && outputDeltaW <= rampAmountW) {
        projectedSourcePowerByBus.set(
          definition.busId,
          ensureFiniteArithmetic(
            (projectedSourcePowerByBus.get(definition.busId) ?? 0) + projectedOutputW,
            pathFor("/state", "sources")
          )
        );
        const projectedLossHeatW = projectedOutputW <= 0
          ? 0
          : ensureFiniteArithmetic(
              projectedOutputW / definition.efficiency - projectedOutputW,
              definitionPath
            );
        const temperaturePath = pathFor(
          pathForId("/state", "thermalNodes", definition.thermalNodeId),
          "temperatureK"
        );
        projectedHeatInputByNode.set(
          definition.thermalNodeId,
          ensureFiniteArithmetic(
            (projectedHeatInputByNode.get(definition.thermalNodeId) ?? 0) + projectedLossHeatW,
            temperaturePath
          )
        );
      }
    }
  }
  for (const definition of definitions.batteries) {
    const definitionPath = pathForId("/definitions", "batteries", definition.batteryId);
    if (definition.chargeEfficiency > 0) {
      ensureFiniteArithmetic(definition.maxChargePowerW * definition.chargeEfficiency * deltaTimeSeconds, definitionPath);
    }
    if (definition.dischargeEfficiency > 0) {
      ensureFiniteArithmetic(definition.maxDischargePowerW / definition.dischargeEfficiency * deltaTimeSeconds, definitionPath);
    }
  }
  for (const contribution of heatContributions) {
    const node = nodeById.get(contribution.thermalNodeId) as ThermalNodeDefinition;
    const temperaturePath = pathFor(
      pathForId("/state", "thermalNodes", contribution.thermalNodeId),
      "temperatureK"
    );
    projectedHeatInputByNode.set(
      contribution.thermalNodeId,
      ensureFiniteArithmetic(
        (projectedHeatInputByNode.get(contribution.thermalNodeId) ?? 0) + contribution.heatInputW,
        temperaturePath
      )
    );
    ensureFiniteArithmetic(
      contribution.heatInputW * deltaTimeSeconds / node.heatCapacityJPerK,
      pathFor("/heatContributions", contribution.heatContributionId)
    );
  }

  return cloneAndFreezeShipPowerThermalValue({
    definitions,
    state,
    tick,
    deltaTimeSeconds,
    consumerRequests: ordered(consumerRequests, (entry) => entry.consumerId),
    rejectedConsumerResults: ordered(rejectedConsumerResults, (entry) => entry.consumerId),
    heatContributions: ordered(heatContributions, (entry) => entry.heatContributionId)
  }) as ValidatedShipPowerThermalStepInput;
};

const asResult = <T>(operation: () => T): ShipPowerThermalValidationResult<T> => {
  try {
    return Object.freeze({ ok: true as const, value: operation() as Readonly<T> });
  } catch (error) {
    if (error instanceof ShipPowerThermalValidationError) {
      return Object.freeze({ ok: false as const, issues: error.issues });
    }
    throw error;
  }
};

export const validateShipPowerThermalDefinitions = (
  value: unknown
): ShipPowerThermalValidationResult<ShipPowerThermalDefinitions> => asResult(() => definitionsInternal(value, ""));

export const assertValidShipPowerThermalDefinitions = (value: unknown): ShipPowerThermalDefinitions =>
  definitionsInternal(value, "");

export const validateShipPowerThermalState = (
  value: unknown,
  definitions: ShipPowerThermalDefinitions
): ShipPowerThermalValidationResult<ShipPowerThermalState> => asResult(() =>
  stateInternal(value, definitionsInternal(definitions), "")
);

export const assertValidShipPowerThermalState = (
  value: unknown,
  definitions: ShipPowerThermalDefinitions
): ShipPowerThermalState => stateInternal(value, definitionsInternal(definitions), "");

export const validateShipPowerThermalStepInput = (
  value: unknown
): ShipPowerThermalValidationResult<ValidatedShipPowerThermalStepInput> => asResult(() => stepInputInternal(value));

export const assertValidShipPowerThermalStepInput = (value: unknown): ValidatedShipPowerThermalStepInput =>
  stepInputInternal(value);

/** Convenience constructor retaining the public input type at call sites. */
export const createValidatedShipPowerThermalStepInput = (
  value: ShipPowerThermalStepInput
): ValidatedShipPowerThermalStepInput => assertValidShipPowerThermalStepInput(value);
