import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SHIP_POWER_THERMAL_FIXTURE_IDS as ids,
  ShipPowerThermalCanonicalError,
  assertValidShipPowerThermalStepInput,
  createShipPowerThermalSignature,
  evaluateShipPowerThermalStep,
  fnv1a32ShipPowerThermal,
  parseCoolingId,
  parseHeatContributionId,
  serializeCanonicalShipPowerThermalValue,
  type ShipPowerThermalStepInput
} from "../../src/ship-power-thermal";

const productionSourceRoot = resolve(process.cwd(), "src", "ship-power-thermal");

const productionTypescriptFiles = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? productionTypescriptFiles(path)
        : entry.isFile() && entry.name.endsWith(".ts")
          ? [path]
          : [];
    });

const productionSources = (): readonly { readonly file: string; readonly source: string }[] =>
  productionTypescriptFiles(productionSourceRoot).map((file) => ({
    file: relative(productionSourceRoot, file),
    source: readFileSync(file, "utf8")
  }));

describe("ship power/thermal canonical foundations", () => {
  it("sorts keys, preserves exact finite numbers, and normalizes negative zero", () => {
    expect(serializeCanonicalShipPowerThermalValue({
      z: -0,
      precise: 0.30000000000000004,
      a: 1.23
    })).toBe('{"a":1.23,"precise":0.30000000000000004,"z":0}');
    expect(serializeCanonicalShipPowerThermalValue({ "2": "two", "10": "ten" })).toBe(
      '{"10":"ten","2":"two"}'
    );
  });

  it("produces stable local FNV-1a signatures", () => {
    expect(fnv1a32ShipPowerThermal("hello")).toBe("4f9f2cab");
    expect(createShipPowerThermalSignature({ z: 2, a: 1 })).toBe("fnv1a32:cadb12a3");
    expect(createShipPowerThermalSignature({ z: 2, a: 1 })).toBe(
      createShipPowerThermalSignature({ a: 1, z: 2 })
    );
  });

  it("preserves generic array order for domain boundaries to normalize explicitly", () => {
    expect(serializeCanonicalShipPowerThermalValue(["b", "a"])).toBe('["b","a"]');
    expect(serializeCanonicalShipPowerThermalValue(["a", "b"])).not.toBe(
      serializeCanonicalShipPowerThermalValue(["b", "a"])
    );
  });

  it.each([
    ["undefined", { bad: undefined }],
    ["function", { bad: () => 1 }],
    ["symbol", { bad: Symbol("bad") }],
    ["bigint", { bad: BigInt(1) }],
    ["non-finite", { bad: Number.NaN }],
    ["non-plain", { bad: new Date(0) }]
  ])("rejects unsupported %s values", (_label, value) => {
    expect(() => serializeCanonicalShipPowerThermalValue(value)).toThrow(ShipPowerThermalCanonicalError);
  });

  it("rejects sparse arrays and cycles", () => {
    const sparse = new Array<unknown>(2);
    sparse[1] = "present";
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(() => serializeCanonicalShipPowerThermalValue(sparse)).toThrow(ShipPowerThermalCanonicalError);
    expect(() => serializeCanonicalShipPowerThermalValue(cyclic)).toThrow(ShipPowerThermalCanonicalError);
  });

  it.each(["01", "4294967295", "extra"])("rejects arrays carrying the extra own key %s", (key) => {
    const value = ["present"];
    Object.defineProperty(value, key, { value: "extra", enumerable: true, configurable: true });

    expect(() => serializeCanonicalShipPowerThermalValue(value)).toThrow(ShipPowerThermalCanonicalError);
  });

  it("keeps the production domain free of Three.js dependencies and types", () => {
    const sources = productionSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const { file, source } of sources) {
      expect(source, file).not.toMatch(/from\s+["'][^"']*three(?:\/[^"']*)?["']/i);
      expect(source, file).not.toMatch(
        /\b(?:THREE|BufferGeometry|WebGLRenderer|Object3D|MeshBasicMaterial|MeshLambertMaterial)\b/
      );
    }
  });

  it("keeps the production domain free of mesh and scene coupling", () => {
    const sources = productionSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const { file, source } of sources) {
      expect(source, file).not.toMatch(/from\s+["'][^"']*(?:mesh|scene)[^"']*["']/i);
      expect(source, file).not.toMatch(/\b(?:mesh|scene)[A-Za-z0-9_$]*/i);
    }
  });

  it("keeps the production domain free of wall-clock and random APIs", () => {
    const sources = productionSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const { file, source } of sources) {
      expect(source, file).not.toMatch(/\bDate\s*\.\s*now\s*\(/);
      expect(source, file).not.toMatch(/\bMath\s*\.\s*random\s*\(/);
    }
  });

  it("canonicalizes validated domain arrays independently of insertion order", () => {
    const base: ShipPowerThermalStepInput = {
      definitions: {
        buses: [{ busId: ids.busMain }, { busId: ids.busAuxiliary }],
        sources: [
          {
            sourceId: ids.sourceGenerator,
            busId: ids.busMain,
            thermalNodeId: ids.thermalNodeMain,
            maxOutputW: 100,
            availableFraction: 1,
            rampLimitWPerSecond: 20,
            efficiency: 0.8
          },
          {
            sourceId: ids.sourceAuxiliary,
            busId: ids.busAuxiliary,
            thermalNodeId: ids.thermalNodeAuxiliary,
            maxOutputW: 50,
            availableFraction: 0.9,
            rampLimitWPerSecond: 10,
            efficiency: 0.75
          }
        ],
        consumers: [
          {
            consumerId: ids.consumerCooling,
            busId: ids.busMain,
            priority: "Safety",
            minimumOperationalPowerW: 5,
            canThrottle: true,
            canShed: true
          },
          {
            consumerId: ids.consumerSafety,
            busId: ids.busAuxiliary,
            priority: "Safety",
            minimumOperationalPowerW: 4,
            canThrottle: true,
            canShed: true
          }
        ],
        batteries: [
          {
            batteryId: ids.batteryMain,
            busId: ids.busMain,
            thermalNodeId: ids.thermalNodeMain,
            capacityJ: 100,
            reserveEnergyJ: 10,
            maxChargePowerW: 10,
            maxDischargePowerW: 10,
            chargeEfficiency: 0.9,
            dischargeEfficiency: 0.8,
            reservePolicy: "PreserveReserve"
          },
          {
            batteryId: ids.batteryAuxiliary,
            busId: ids.busAuxiliary,
            thermalNodeId: ids.thermalNodeAuxiliary,
            capacityJ: 80,
            reserveEnergyJ: 8,
            maxChargePowerW: 8,
            maxDischargePowerW: 8,
            chargeEfficiency: 0.85,
            dischargeEfficiency: 0.75,
            reservePolicy: "PreserveReserve"
          }
        ],
        thermalNodes: [
          {
            thermalNodeId: ids.thermalNodeMain,
            busId: ids.busMain,
            heatCapacityJPerK: 1,
            minimumTemperatureK: 1,
            warningTemperatureK: 2,
            criticalTemperatureK: 3,
            shutdownTemperatureK: 4,
            maximumTemperatureK: 5
          },
          {
            thermalNodeId: ids.thermalNodeAuxiliary,
            busId: ids.busAuxiliary,
            heatCapacityJPerK: 1,
            minimumTemperatureK: 1,
            warningTemperatureK: 2,
            criticalTemperatureK: 3,
            shutdownTemperatureK: 4,
            maximumTemperatureK: 5
          }
        ],
        cooling: [
          {
            coolingId: ids.coolingMain,
            thermalNodeId: ids.thermalNodeMain,
            consumerId: ids.consumerCooling,
            maxCoolingPowerW: 10,
            minimumOperatingPowerW: 5,
            sinkTemperatureK: 1
          },
          {
            coolingId: parseCoolingId("cooling:auxiliary"),
            thermalNodeId: ids.thermalNodeAuxiliary,
            consumerId: ids.consumerSafety,
            maxCoolingPowerW: 8,
            minimumOperatingPowerW: 4,
            sinkTemperatureK: 1
          }
        ]
      },
      state: {
        tick: 4,
        sources: [
          { sourceId: ids.sourceGenerator, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, currentOutputW: 10 },
          { sourceId: ids.sourceAuxiliary, busId: ids.busAuxiliary, thermalNodeId: ids.thermalNodeAuxiliary, currentOutputW: 5 }
        ],
        batteries: [
          { batteryId: ids.batteryMain, busId: ids.busMain, thermalNodeId: ids.thermalNodeMain, storedEnergyJ: 50 },
          { batteryId: ids.batteryAuxiliary, busId: ids.busAuxiliary, thermalNodeId: ids.thermalNodeAuxiliary, storedEnergyJ: 40 }
        ],
        thermalNodes: [
          { thermalNodeId: ids.thermalNodeMain, busId: ids.busMain, temperatureK: 1, protectionState: "Nominal" },
          { thermalNodeId: ids.thermalNodeAuxiliary, busId: ids.busAuxiliary, temperatureK: 1, protectionState: "Nominal" }
        ],
        cooling: [
          { coolingId: ids.coolingMain, thermalNodeId: ids.thermalNodeMain, consumerId: ids.consumerCooling, allocatedOperatingPowerW: 5 },
          { coolingId: parseCoolingId("cooling:auxiliary"), thermalNodeId: ids.thermalNodeAuxiliary, consumerId: ids.consumerSafety, allocatedOperatingPowerW: 4 }
        ]
      },
      tick: 5,
      deltaTimeSeconds: 0.5,
      consumerRequests: [
        { consumerId: ids.consumerCooling, requestedPowerW: 5 },
        { consumerId: ids.consumerSafety, requestedPowerW: 4 }
      ],
      heatContributions: [
        { heatContributionId: ids.heatMission, thermalNodeId: ids.thermalNodeMain, heatInputW: 2 },
        { heatContributionId: parseHeatContributionId("heat:auxiliary"), thermalNodeId: ids.thermalNodeAuxiliary, heatInputW: 1 }
      ]
    };
    const reversed: ShipPowerThermalStepInput = {
      ...base,
      definitions: {
        ...base.definitions,
        buses: [...base.definitions.buses].reverse(),
        sources: [...base.definitions.sources].reverse(),
        consumers: [...base.definitions.consumers].reverse(),
        batteries: [...base.definitions.batteries].reverse(),
        thermalNodes: [...base.definitions.thermalNodes].reverse(),
        cooling: [...base.definitions.cooling].reverse()
      },
      state: {
        ...base.state,
        sources: [...base.state.sources].reverse(),
        batteries: [...base.state.batteries].reverse(),
        thermalNodes: [...base.state.thermalNodes].reverse(),
        cooling: [...base.state.cooling].reverse()
      },
      consumerRequests: [...base.consumerRequests].reverse(),
      heatContributions: [...base.heatContributions].reverse()
    };

    const first = assertValidShipPowerThermalStepInput(base);
    const second = assertValidShipPowerThermalStepInput(reversed);

    expect(serializeCanonicalShipPowerThermalValue(first)).toBe(serializeCanonicalShipPowerThermalValue(second));
    expect(createShipPowerThermalSignature(first)).toBe(createShipPowerThermalSignature(second));

    const firstStep = evaluateShipPowerThermalStep(base);
    const secondStep = evaluateShipPowerThermalStep(reversed);
    expect(firstStep.ok).toBe(true);
    expect(secondStep.ok).toBe(true);
    if (!firstStep.ok || !secondStep.ok) throw new Error("Expected successful deterministic steps.");
    expect(firstStep.canonicalJson).toBe(secondStep.canonicalJson);
    expect(firstStep.signature).toBe(secondStep.signature);
    expect(firstStep.events).toEqual(secondStep.events);
  });
});
