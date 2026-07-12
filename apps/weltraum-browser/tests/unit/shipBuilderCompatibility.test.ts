import { describe, expect, it } from "vitest";
import {
  SCOUT_BLUEPRINT,
  STARTER_BLUEPRINT_FIXTURES,
  STARTER_CATALOG,
  STARTER_PART_IDS,
  STARTER_SHIP_BUILDER_VALIDATION_POLICY,
  ShipBuilderDataError,
  catalogDocumentForSerialization,
  createShipBlueprint,
  createShipBuilderDiagnostic,
  createShipBuilderValidationPolicy,
  createShipPartCatalogSnapshot,
  endpointOccupancyForSocketType,
  evaluatePartConnectionCompatibility,
  orderShipBuilderDiagnostics,
  shipBuilderValidationPolicyDocument,
  shipBuilderValidationStatusForDiagnostics
} from "../../src/ship-builder";
import type {
  ShipBlueprint,
  ShipBuilderValidationPolicy,
  ShipPartCatalogSnapshot
} from "../../src/ship-builder";

type MutableRecord = Record<string, any>;

const cloneBlueprint = (source: ShipBlueprint = SCOUT_BLUEPRINT): MutableRecord => structuredClone(source) as MutableRecord;
const cloneCatalog = (): MutableRecord =>
  structuredClone(catalogDocumentForSerialization(STARTER_CATALOG)) as MutableRecord;
const clonePolicy = (): MutableRecord =>
  structuredClone(shipBuilderValidationPolicyDocument(STARTER_SHIP_BUILDER_VALIDATION_POLICY)) as MutableRecord;

const partById = (catalog: MutableRecord, partDefinitionId: string): MutableRecord => {
  const part = catalog.partDefinitions.find((candidate: MutableRecord) => candidate.partDefinitionId === partDefinitionId);
  if (part === undefined) {
    throw new Error(`Missing part ${partDefinitionId}.`);
  }
  return part;
};

const socketById = (part: MutableRecord, socketId: string): MutableRecord => {
  const socket = part.sockets.find((candidate: MutableRecord) => candidate.socketId === socketId);
  if (socket === undefined) {
    throw new Error(`Missing socket ${socketId}.`);
  }
  return socket;
};

const buildBlueprint = (
  source: MutableRecord,
  catalog: ShipPartCatalogSnapshot = STARTER_CATALOG
): ShipBlueprint => createShipBlueprint(source, { catalog });

const evaluateFirst = (
  blueprint: ShipBlueprint,
  catalog: ShipPartCatalogSnapshot = STARTER_CATALOG,
  policy: ShipBuilderValidationPolicy = STARTER_SHIP_BUILDER_VALIDATION_POLICY
) => evaluatePartConnectionCompatibility(blueprint.connections[0], blueprint, catalog, policy);

const diagnosticCodes = (result: ReturnType<typeof evaluateFirst>): readonly string[] =>
  result.diagnostics.map((diagnostic) => diagnostic.code);

describe("ship-builder compatibility policy", () => {
  it("canonicalizes, signs, and deeply freezes plain policy data", () => {
    const reordered = clonePolicy();
    reordered.endpointRules.reverse();
    reordered.connectionRules.reverse();
    reordered.connectionRules[0].connectionTypes.reverse();
    reordered.connectionRules[0].capacityPairs.reverse();
    reordered.connectionRules[0].mountSidePairs.reverse();
    for (const pair of reordered.connectionRules[0].mountSidePairs) {
      pair.reverse();
    }

    const rebuilt = createShipBuilderValidationPolicy(reordered);
    expect(rebuilt).toEqual(STARTER_SHIP_BUILDER_VALIDATION_POLICY);
    expect(rebuilt.signature).toBe(STARTER_SHIP_BUILDER_VALIDATION_POLICY.signature);
    expect(JSON.parse(JSON.stringify(shipBuilderValidationPolicyDocument(rebuilt)))).toEqual(
      shipBuilderValidationPolicyDocument(rebuilt)
    );
    expect(Object.isFrozen(rebuilt)).toBe(true);
    expect(Object.isFrozen(rebuilt.connectionRules)).toBe(true);
    expect(Object.isFrozen(rebuilt.connectionRules[0].mountSidePairs[0])).toBe(true);
    expect(endpointOccupancyForSocketType(rebuilt, "structural")).toBe("Shared");
    expect(endpointOccupancyForSocketType(rebuilt, "custom")).toBeUndefined();
  });

  it("uses the fixed diagnostic precedence and status semantics", () => {
    const warning = createShipBuilderDiagnostic({
      code: "RequiredSocketUnused",
      severity: "Warning",
      phase: "RequiredSockets",
      path: "/instances/1"
    });
    const info = createShipBuilderDiagnostic({
      code: "RequiredSocketUnused",
      severity: "Info",
      phase: "RequiredSockets",
      path: "/instances/0"
    });
    const error = createShipBuilderDiagnostic({
      code: "SocketTypeIncompatible",
      severity: "Error",
      phase: "ConnectionCompatibility",
      path: "/connections/0"
    });
    const ordered = orderShipBuilderDiagnostics([warning, info, error]);

    expect(ordered.map((diagnostic) => diagnostic.code)).toEqual([
      "SocketTypeIncompatible",
      "RequiredSocketUnused",
      "RequiredSocketUnused"
    ]);
    expect(shipBuilderValidationStatusForDiagnostics([info])).toBe("Valid");
    expect(shipBuilderValidationStatusForDiagnostics([warning, info])).toBe("ValidWithWarnings");
    expect(shipBuilderValidationStatusForDiagnostics(ordered)).toBe("Invalid");
    expect(Object.isFrozen(ordered)).toBe(true);
  });

  it("fails policy construction when a connection type lacks explicit endpoint occupancy", () => {
    const input = clonePolicy();
    input.connectionRules[0].socketTypes = ["custom", "custom"];

    expect(() => createShipBuilderValidationPolicy(input)).toThrowError(ShipBuilderDataError);
    try {
      createShipBuilderValidationPolicy(input);
    } catch (error) {
      expect(error).toMatchObject({ code: "UnknownReference", path: "/connectionRules/0/socketTypes" });
    }
  });
});

describe("ship-builder connection compatibility", () => {
  it("accepts every starter fixture connection and keeps Weapon structural endpoints shared", () => {
    for (const blueprint of Object.values(STARTER_BLUEPRINT_FIXTURES)) {
      for (const connection of blueprint.connections) {
        const result = evaluatePartConnectionCompatibility(
          connection,
          blueprint,
          STARTER_CATALOG,
          STARTER_SHIP_BUILDER_VALIDATION_POLICY
        );
        expect(result.status).toBe("Compatible");
        expect(result.contributesToStructure).toBe(true);
        expect(result.diagnostics).toEqual([]);
      }
    }
    expect(endpointOccupancyForSocketType(STARTER_SHIP_BUILDER_VALIDATION_POLICY, "structural")).toBe("Shared");
  });

  it("reports disabled endpoints while ignoring disabled connections", () => {
    const disabledEndpointSource = cloneBlueprint();
    disabledEndpointSource.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-cockpit").enabled = false;
    const disabledEndpoint = evaluateFirst(buildBlueprint(disabledEndpointSource));
    expect(diagnosticCodes(disabledEndpoint)).toContain("ConnectionEndpointDisabled");
    expect(disabledEndpoint.contributesToStructure).toBe(false);

    const disabledConnectionSource = cloneBlueprint();
    disabledConnectionSource.connections[0].enabled = false;
    const disabledConnection = evaluateFirst(buildBlueprint(disabledConnectionSource));
    expect(disabledConnection).toMatchObject({ status: "Compatible", enabled: false, contributesToStructure: false });
    expect(disabledConnection.diagnostics).toEqual([]);
  });

  it("always rejects identical endpoints and gates different sockets on the same instance", () => {
    const identicalSource = cloneBlueprint();
    identicalSource.connections[0].to = structuredClone(identicalSource.connections[0].from);
    const identical = evaluateFirst(buildBlueprint(identicalSource));
    expect(diagnosticCodes(identical)[0]).toBe("IdenticalConnectionEndpoints");
    expect(diagnosticCodes(identical)).not.toContain("SelfConnectionNotAllowed");

    const sameInstanceSource = cloneBlueprint();
    sameInstanceSource.connections[0].from = { partInstanceId: "scout-frame", socketId: "structural-back" };
    sameInstanceSource.connections[0].to = { partInstanceId: "scout-frame", socketId: "structural-front" };
    const sameInstance = evaluateFirst(buildBlueprint(sameInstanceSource));
    expect(diagnosticCodes(sameInstance)).toContain("SelfConnectionNotAllowed");

    const allowingPolicySource = clonePolicy();
    allowingPolicySource.connectionRules[0].allowSameInstance = true;
    const allowingPolicy = createShipBuilderValidationPolicy(allowingPolicySource);
    expect(evaluateFirst(buildBlueprint(sameInstanceSource), STARTER_CATALOG, allowingPolicy).status).toBe("Compatible");
  });

  it("fails closed for custom socket types without an explicit policy rule", () => {
    const catalogSource = cloneCatalog();
    const scoutCockpit = partById(catalogSource, STARTER_PART_IDS.scoutCockpitSmall);
    const spineFrame = partById(catalogSource, STARTER_PART_IDS.smallSpineFrame);
    socketById(scoutCockpit, "structural-back").socketType = "customStructural";
    socketById(spineFrame, "structural-front").socketType = "customStructural";
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const blueprint = buildBlueprint(cloneBlueprint(), catalog);

    expect(diagnosticCodes(evaluateFirst(blueprint, catalog))).toContain("SocketTypeIncompatible");
  });

  it("reports connection type and capacity mismatches independently", () => {
    const connectionTypeSource = cloneBlueprint();
    connectionTypeSource.connections[0].connectionType = "Functional";
    expect(diagnosticCodes(evaluateFirst(buildBlueprint(connectionTypeSource)))).toContain("ConnectionTypeIncompatible");

    const catalogSource = cloneCatalog();
    socketById(partById(catalogSource, STARTER_PART_IDS.scoutCockpitSmall), "structural-back").capacityClass = "heavy";
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const blueprint = buildBlueprint(cloneBlueprint(), catalog);
    expect(diagnosticCodes(evaluateFirst(blueprint, catalog))).toContain("SocketCapacityIncompatible");
  });

  it("applies category and component restrictions bilaterally", () => {
    const catalogSource = cloneCatalog();
    const socket = socketById(partById(catalogSource, STARTER_PART_IDS.scoutCockpitSmall), "structural-back");
    socket.compatibleCategoryIds = ["weapon"];
    socket.compatibleComponentKinds = ["FixedWeapon"];
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const blueprint = buildBlueprint(cloneBlueprint(), catalog);
    const codes = diagnosticCodes(evaluateFirst(blueprint, catalog));

    expect(codes).toContain("SocketCategoryIncompatible");
    expect(codes).toContain("SocketComponentKindIncompatible");
  });

  it("transforms mount sides and opposed directions by each instance yaw", () => {
    const mountPolicySource = clonePolicy();
    mountPolicySource.connectionRules[0].mountSidePairs = [["front", "left"]];
    const mountPolicy = createShipBuilderValidationPolicy(mountPolicySource);
    const mountBlueprintSource = cloneBlueprint();
    mountBlueprintSource.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-cockpit").localRotation.yaw = 90;
    expect(evaluateFirst(buildBlueprint(mountBlueprintSource), STARTER_CATALOG, mountPolicy).status).toBe("Compatible");

    const opposedPolicySource = clonePolicy();
    opposedPolicySource.connectionRules[0].directionMode = "Opposed";
    opposedPolicySource.connectionRules[0].mountSidePairs = [["left", "right"]];
    const opposedPolicy = createShipBuilderValidationPolicy(opposedPolicySource);
    const opposedBlueprintSource = cloneBlueprint();
    opposedBlueprintSource.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-cockpit").localRotation.yaw = 90;
    opposedBlueprintSource.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-frame").localRotation.yaw = 90;
    expect(evaluateFirst(buildBlueprint(opposedBlueprintSource), STARTER_CATALOG, opposedPolicy).status).toBe("Compatible");
  });

  it("reports nonzero direction failures without synthesizing a fallback", () => {
    const catalogSource = cloneCatalog();
    socketById(partById(catalogSource, STARTER_PART_IDS.scoutCockpitSmall), "structural-back").direction = { x: 0, y: 0, z: 0 };
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const blueprint = buildBlueprint(cloneBlueprint(), catalog);

    expect(diagnosticCodes(evaluateFirst(blueprint, catalog))).toContain("SocketDirectionInvalid");
  });

  it("preserves schema errors before returning a gameplay result", () => {
    const invalid = cloneBlueprint();
    invalid.connections[0].from.partInstanceId = "missing-instance";

    expect(() =>
      evaluatePartConnectionCompatibility(
        invalid.connections[0],
        invalid as ShipBlueprint,
        STARTER_CATALOG,
        STARTER_SHIP_BUILDER_VALIDATION_POLICY
      )
    ).toThrowError(ShipBuilderDataError);
  });

  it("returns deeply frozen diagnostics and compatibility results", () => {
    const invalidSource = cloneBlueprint();
    invalidSource.connections[0].connectionType = "Functional";
    const result = evaluateFirst(buildBlueprint(invalidSource));

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.endpoints)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.diagnostics[0])).toBe(true);
    expect(Object.isFrozen(result.diagnostics[0].details)).toBe(true);
  });
});
