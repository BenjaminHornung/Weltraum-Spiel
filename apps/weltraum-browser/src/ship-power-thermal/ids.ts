export type ShipPowerThermalBrand<T, Name extends string> = T & {
  readonly __shipPowerThermalBrand: Name;
};

export type PowerBusId = ShipPowerThermalBrand<string, "PowerBusId">;
export type PowerSourceId = ShipPowerThermalBrand<string, "PowerSourceId">;
export type PowerConsumerId = ShipPowerThermalBrand<string, "PowerConsumerId">;
export type BatteryId = ShipPowerThermalBrand<string, "BatteryId">;
export type ThermalNodeId = ShipPowerThermalBrand<string, "ThermalNodeId">;
export type CoolingId = ShipPowerThermalBrand<string, "CoolingId">;
export type HeatContributionId = ShipPowerThermalBrand<string, "HeatContributionId">;
export type ShipPowerThermalEventId = ShipPowerThermalBrand<string, "ShipPowerThermalEventId">;

export type ShipPowerThermalStableId =
  | PowerBusId
  | PowerSourceId
  | PowerConsumerId
  | BatteryId
  | ThermalNodeId
  | CoolingId
  | HeatContributionId
  | ShipPowerThermalEventId;

export const MAX_SHIP_POWER_THERMAL_ID_LENGTH = 128;
export const SHIP_POWER_THERMAL_STABLE_ID_PATTERN = /^[!-~]{1,128}$/;

export type ShipPowerThermalIdErrorCode = "INVALID_STABLE_ID";

export class ShipPowerThermalIdError extends Error {
  public constructor(
    public readonly code: ShipPowerThermalIdErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "ShipPowerThermalIdError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isShipPowerThermalStableId = (value: unknown): value is ShipPowerThermalStableId =>
  typeof value === "string"
  && value.length <= MAX_SHIP_POWER_THERMAL_ID_LENGTH
  && SHIP_POWER_THERMAL_STABLE_ID_PATTERN.test(value);

export const parseShipPowerThermalId = <TId extends ShipPowerThermalStableId>(
  value: unknown,
  path = ""
): TId => {
  if (!isShipPowerThermalStableId(value)) {
    throw new ShipPowerThermalIdError(
      "INVALID_STABLE_ID",
      path,
      "Expected a nonempty stable printable ASCII ID without whitespace (maximum 128 characters)."
    );
  }
  return value as TId;
};

export const parsePowerBusId = (value: unknown, path = ""): PowerBusId =>
  parseShipPowerThermalId<PowerBusId>(value, path);
export const parsePowerSourceId = (value: unknown, path = ""): PowerSourceId =>
  parseShipPowerThermalId<PowerSourceId>(value, path);
export const parsePowerConsumerId = (value: unknown, path = ""): PowerConsumerId =>
  parseShipPowerThermalId<PowerConsumerId>(value, path);
export const parseBatteryId = (value: unknown, path = ""): BatteryId =>
  parseShipPowerThermalId<BatteryId>(value, path);
export const parseThermalNodeId = (value: unknown, path = ""): ThermalNodeId =>
  parseShipPowerThermalId<ThermalNodeId>(value, path);
export const parseCoolingId = (value: unknown, path = ""): CoolingId =>
  parseShipPowerThermalId<CoolingId>(value, path);
export const parseHeatContributionId = (value: unknown, path = ""): HeatContributionId =>
  parseShipPowerThermalId<HeatContributionId>(value, path);
export const parseShipPowerThermalEventId = (value: unknown, path = ""): ShipPowerThermalEventId =>
  parseShipPowerThermalId<ShipPowerThermalEventId>(value, path);

/** Locale-independent lexical order used at every domain ordering boundary. */
export const compareShipPowerThermalIds = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Returns a new frozen array and never sorts the caller-owned array in place. */
export const orderByShipPowerThermalId = <T>(
  values: readonly T[],
  selectId: (value: T) => string
): readonly T[] => Object.freeze([...values].sort((left, right) => compareShipPowerThermalIds(selectId(left), selectId(right))));
