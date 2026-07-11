import { describe, expect, it } from "vitest";
import {
  CARGO_BLUEPRINT,
  SCOUT_BLUEPRINT,
  STARTER_BLUEPRINT_FIXTURES,
  STARTER_CATALOG,
  WEAPON_BLUEPRINT,
  ShipBuilderDataError,
  createShipBlueprint,
  parseShipBlueprint,
  serializeShipBlueprint,
  shipBlueprintLayoutHash,
  updatePartInstanceTransform
} from "../../src/ship-builder";

type MutableRecord = Record<string, any>;

const cloneBlueprint = (source = SCOUT_BLUEPRINT): MutableRecord => JSON.parse(serializeShipBlueprint(source)) as MutableRecord;

const dataError = (operation: () => unknown): ShipBuilderDataError => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ShipBuilderDataError);
    return error as ShipBuilderDataError;
  }

  throw new Error("Expected a ShipBuilderDataError.");
};

describe("ship-builder blueprints", () => {
  it("keeps a stable instance ID after move and supported rotation", () => {
    const instance = SCOUT_BLUEPRINT.instances.find((candidate) => candidate.stableInstanceId === "scout-frame");
    if (instance === undefined) {
      throw new Error("Scout fixture frame instance is missing.");
    }

    const transformed = updatePartInstanceTransform(instance, { x: 4, y: -2, z: 6 }, { yaw: 90, pitch: 0, roll: 0 });
    expect(transformed.stableInstanceId).toBe(instance.stableInstanceId);
    expect(transformed.localGridPosition).toEqual({ x: 4, y: -2, z: 6 });
    expect(transformed.localRotation).toEqual({ yaw: 90, pitch: 0, roll: 0 });
    expect(Object.isFrozen(transformed)).toBe(true);
  });

  it("roundtrips canonical blueprint bytes and preserves stable connection IDs", () => {
    const serialized = serializeShipBlueprint(WEAPON_BLUEPRINT);
    const parsed = parseShipBlueprint(serialized, { catalog: STARTER_CATALOG });

    expect(serializeShipBlueprint(parsed)).toBe(serialized);
    expect(parsed.connections.map((connection) => connection.connectionId)).toEqual(
      WEAPON_BLUEPRINT.connections.map((connection) => connection.connectionId)
    );
    expect(parsed.referencedPartDefinitionIds).toEqual([...parsed.referencedPartDefinitionIds].sort());
  });

  it("excludes draft and cache state from the authoritative layout hash", () => {
    const changedCaches = cloneBlueprint();
    changedCaches.draftMetadata = { editor: "different-draft" };
    changedCaches.cachedValidationMetadata = { status: "stale" };
    changedCaches.cachedStatsMetadata = { mass: 999999 };

    const parsed = createShipBlueprint(changedCaches, { catalog: STARTER_CATALOG });
    expect(shipBlueprintLayoutHash(parsed)).toBe(shipBlueprintLayoutHash(SCOUT_BLUEPRINT));
  });

  it("keeps each fixed fixture inside the starter catalog definition and socket boundary", () => {
    const fixtures = [SCOUT_BLUEPRINT, CARGO_BLUEPRINT, WEAPON_BLUEPRINT];
    expect(Object.values(STARTER_BLUEPRINT_FIXTURES)).toEqual(fixtures);

    for (const fixture of fixtures) {
      expect(fixture.catalogId).toBe(STARTER_CATALOG.catalogId);
      expect(fixture.catalogVersion).toBe(STARTER_CATALOG.catalogVersion);
      for (const instance of fixture.instances) {
        expect(STARTER_CATALOG.indexes.partById[instance.partDefinitionId]).toBeDefined();
      }
      for (const connection of fixture.connections) {
        for (const endpoint of [connection.from, connection.to]) {
          const instance = fixture.instances.find((candidate) => candidate.stableInstanceId === endpoint.partInstanceId);
          expect(instance).toBeDefined();
          const definition = STARTER_CATALOG.indexes.partById[instance!.partDefinitionId];
          expect(definition.sockets.some((socket) => socket.socketId === endpoint.socketId)).toBe(true);
        }
      }
    }
  });

  it.each([
    ["yaw", 45, "/instances/0/localRotation/yaw"],
    ["pitch", 1, "/instances/0/localRotation/pitch"],
    ["roll", -1, "/instances/0/localRotation/roll"]
  ])("reports unsupported V1 %s rotations with stable code and path", (axis, value, expectedPath) => {
    const invalidRotation = cloneBlueprint();
    invalidRotation.instances[0].localRotation[axis] = value;

    const error = dataError(() => createShipBlueprint(invalidRotation, { catalog: STARTER_CATALOG }));
    expect(error.code).toBe("UnsupportedRotation");
    expect(error.path).toBe(expectedPath);
  });

  it("rejects duplicate authoritative IDs and unknown endpoint/catalog references deterministically", () => {
    const duplicateInstance = cloneBlueprint();
    duplicateInstance.instances.push(structuredClone(duplicateInstance.instances[0]));
    const duplicateInstanceError = dataError(() => createShipBlueprint(duplicateInstance, { catalog: STARTER_CATALOG }));
    expect(duplicateInstanceError.code).toBe("DuplicateId");
    expect(duplicateInstanceError.path).toBe("/instances/1/stableInstanceId");

    const duplicateConnection = cloneBlueprint();
    duplicateConnection.connections.push(structuredClone(duplicateConnection.connections[0]));
    const duplicateConnectionError = dataError(() => createShipBlueprint(duplicateConnection, { catalog: STARTER_CATALOG }));
    expect(duplicateConnectionError.code).toBe("DuplicateId");
    expect(duplicateConnectionError.path).toBe("/connections/1/connectionId");

    const unknownEndpoint = cloneBlueprint();
    unknownEndpoint.connections[0].from.partInstanceId = "missing-instance";
    const unknownEndpointError = dataError(() => createShipBlueprint(unknownEndpoint, { catalog: STARTER_CATALOG }));
    expect(unknownEndpointError.code).toBe("UnknownInstance");
    expect(unknownEndpointError.path).toBe("/connections/0/from/partInstanceId");

    const unknownCatalogReference = cloneBlueprint();
    unknownCatalogReference.instances[0].partDefinitionId = "missing-definition";
    unknownCatalogReference.referencedPartDefinitionIds = [
      ...new Set(unknownCatalogReference.instances.map((instance: MutableRecord) => instance.partDefinitionId))
    ].sort();
    const unknownCatalogReferenceError = dataError(() =>
      createShipBlueprint(unknownCatalogReference, { catalog: STARTER_CATALOG })
    );
    expect(unknownCatalogReferenceError.code).toBe("UnknownReference");
    expect(unknownCatalogReferenceError.path).toBe("/instances/0/partDefinitionId");
  });

  it("changes the layout hash only for authoritative layout data and keeps nested fixture values immutable", () => {
    const moved = cloneBlueprint();
    moved.instances[0].localGridPosition.x += 1;
    const movedBlueprint = createShipBlueprint(moved, { catalog: STARTER_CATALOG });

    expect(shipBlueprintLayoutHash(movedBlueprint)).not.toBe(shipBlueprintLayoutHash(SCOUT_BLUEPRINT));
    expect(Object.isFrozen(SCOUT_BLUEPRINT.instances)).toBe(true);
    expect(Object.isFrozen(SCOUT_BLUEPRINT.instances[0])).toBe(true);
    expect(Object.isFrozen(SCOUT_BLUEPRINT.instances[0].localGridPosition)).toBe(true);
    expect(Object.isFrozen(SCOUT_BLUEPRINT.connections[0].from)).toBe(true);
  });

  it("pins the scout authoritative layout hash", () => {
    expect(shipBlueprintLayoutHash(SCOUT_BLUEPRINT)).toBe("fc4597b6");
  });
});
