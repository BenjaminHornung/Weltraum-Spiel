import { describe, expect, it } from "vitest";
import {
  SCOUT_BLUEPRINT,
  STARTER_CATALOG,
  STARTER_PART_IDS,
  ShipBuilderDataError,
  catalogDocumentForSerialization,
  createShipPartCatalogSnapshot,
  evaluateShipStats
} from "../../src/ship-builder";
import type { ShipBlueprint } from "../../src/ship-builder";

type MutableRecord = Record<string, any>;
const cloneBlueprint = (source: ShipBlueprint = SCOUT_BLUEPRINT): MutableRecord => structuredClone(source) as MutableRecord;
const cloneCatalog = (): MutableRecord =>
  structuredClone(catalogDocumentForSerialization(STARTER_CATALOG)) as MutableRecord;
const partById = (catalog: MutableRecord, id: string): MutableRecord => {
  const part = catalog.partDefinitions.find((candidate: MutableRecord) => candidate.partDefinitionId === id);
  if (part === undefined) throw new Error(`Missing part ${id}.`);
  return part;
};

describe("ship-builder RCS authority", () => {
  it("derives all signed translation axes from transformed nozzle directions", () => {
    const report = evaluateShipStats(SCOUT_BLUEPRINT, STARTER_CATALOG);

    expect(report.stats.rcsTranslationPositiveX.value).toBe(550);
    expect(report.stats.rcsTranslationNegativeX.value).toBe(550);
    expect(report.stats.rcsTranslationPositiveY.value).toBe(0);
    expect(report.stats.rcsTranslationNegativeY.value).toBe(0);
    expect(report.stats.rcsTranslationPositiveZ.value).toBe(550);
    expect(report.stats.rcsTranslationNegativeZ.value).toBe(550);
  });

  it("rotates an asymmetric local authority profile onto the exact world axes", () => {
    const catalogSource = cloneCatalog();
    const rcs = partById(catalogSource, STARTER_PART_IDS.fourWayCornerRcs);
    rcs.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-left").direction = { x: 1, y: 0, z: 0 };
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const localReport = evaluateShipStats(SCOUT_BLUEPRINT, catalog);
    const yawSource = cloneBlueprint();
    yawSource.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-rcs").localRotation.yaw = 90;
    const worldReport = evaluateShipStats(yawSource, catalog);

    expect({
      positiveX: localReport.stats.rcsTranslationPositiveX.value,
      negativeX: localReport.stats.rcsTranslationNegativeX.value,
      positiveZ: localReport.stats.rcsTranslationPositiveZ.value,
      negativeZ: localReport.stats.rcsTranslationNegativeZ.value
    }).toEqual({ positiveX: 1100, negativeX: 0, positiveZ: 550, negativeZ: 550 });
    expect({
      positiveX: worldReport.stats.rcsTranslationPositiveX.value,
      negativeX: worldReport.stats.rcsTranslationNegativeX.value,
      positiveZ: worldReport.stats.rcsTranslationPositiveZ.value,
      negativeZ: worldReport.stats.rcsTranslationNegativeZ.value
    }).toEqual({ positiveX: 550, negativeX: 550, positiveZ: 0, negativeZ: 1100 });
  });

  it("preserves asymmetric nozzle authority instead of mirroring it", () => {
    const catalogSource = cloneCatalog();
    const rcs = partById(catalogSource, STARTER_PART_IDS.fourWayCornerRcs);
    rcs.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-left").direction = { x: 1, y: 0, z: 0 };
    const report = evaluateShipStats(SCOUT_BLUEPRINT, createShipPartCatalogSnapshot(catalogSource));

    expect(report.stats.rcsTranslationPositiveX.value).toBe(1100);
    expect(report.stats.rcsTranslationNegativeX.value).toBe(0);
  });

  it("uses world-space lever arms relative to loaded COM for pitch, yaw, and roll torque", () => {
    const centered = cloneBlueprint();
    centered.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-rcs").localGridPosition = {
      x: 0,
      y: 0,
      z: 0
    };
    const offset = structuredClone(centered) as MutableRecord;
    offset.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-rcs").localGridPosition = {
      x: 4,
      y: 3,
      z: 2
    };
    const centeredReport = evaluateShipStats(centered, STARTER_CATALOG);
    const offsetReport = evaluateShipStats(offset, STARTER_CATALOG);

    expect(offsetReport.stats.pitchTorqueNm.value).not.toBe(centeredReport.stats.pitchTorqueNm.value);
    expect(offsetReport.stats.yawTorqueNm.value).not.toBe(centeredReport.stats.yawTorqueNm.value);
    expect(offsetReport.stats.rollTorqueNm.value).not.toBe(centeredReport.stats.rollTorqueNm.value);
    expect(offsetReport.stats.pitchTorqueNm.value).toBeGreaterThan(0);
    expect(offsetReport.stats.yawTorqueNm.value).toBeGreaterThan(0);
    expect(offsetReport.stats.rollTorqueNm.value).toBeGreaterThan(0);
  });

  it("pins r cross F axes and magnitude for a single analytical nozzle", () => {
    const catalogSource = cloneCatalog();
    const rcsDefinition = partById(catalogSource, STARTER_PART_IDS.fourWayCornerRcs);
    const cluster = rcsDefinition.components.find((component: MutableRecord) => component.kind === "RcsCluster");
    cluster.nozzleSocketIds = ["nozzle-front"];
    rcsDefinition.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-front").direction = { x: 1, y: 0, z: 0 };
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const source = cloneBlueprint();
    const rcsInstance = source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-rcs");
    rcsInstance.localGridPosition = { x: 0, y: 0, z: 0 };
    source.instances = [rcsInstance];
    source.connections = [];
    source.referencedPartDefinitionIds = [rcsInstance.partDefinitionId];
    const report = evaluateShipStats(source, catalog);

    // r=(0,0,0.9)m and F=(550,0,0)N, so r x F=(0,495,0)N*m.
    expect(report.stats.pitchTorqueNm.value).toBe(0);
    expect(report.stats.yawTorqueNm.value).toBe(495);
    expect(report.stats.rollTorqueNm.value).toBe(0);
    expect(
      Math.hypot(
        report.stats.pitchTorqueNm.value as number,
        report.stats.yawTorqueNm.value as number,
        report.stats.rollTorqueNm.value as number
      )
    ).toBe(495);
  });

  it("fails closed on zero, missing, and nonfinite nozzle directions at the catalog boundary", () => {
    for (const direction of [{ x: 0, y: 0, z: 0 }, { x: Number.NaN, y: 0, z: 1 }]) {
      const catalogSource = cloneCatalog();
      const rcs = partById(catalogSource, STARTER_PART_IDS.fourWayCornerRcs);
      rcs.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-left").direction = direction;
      expect(() => createShipPartCatalogSnapshot(catalogSource)).toThrowError(ShipBuilderDataError);
    }

    const missing = cloneCatalog();
    const rcs = partById(missing, STARTER_PART_IDS.fourWayCornerRcs);
    delete rcs.sockets.find((socket: MutableRecord) => socket.socketId === "nozzle-left").direction;
    expect(() => createShipPartCatalogSnapshot(missing)).toThrowError(ShipBuilderDataError);
  });

  it("returns known zero authority without fabricating a missing RCS cluster", () => {
    const source = cloneBlueprint();
    source.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-rcs").enabled = false;
    const report = evaluateShipStats(source, STARTER_CATALOG);

    expect(report.stats.rcsTranslationPositiveX).toEqual({ availability: "Available", value: 0, unit: "N" });
    expect(report.stats.pitchTorqueNm).toEqual({ availability: "Available", value: 0, unit: "N*m" });
  });
});
