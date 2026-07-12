import { describe, expect, it } from "vitest";
import {
  CARGO_BLUEPRINT,
  SCOUT_BLUEPRINT,
  STARTER_CATALOG,
  STARTER_CATALOG_SIGNATURE,
  STARTER_PART_IDS,
  STARTER_SHIP_BUILDER_VALIDATION_POLICY,
  ShipBuilderDataError,
  WEAPON_BLUEPRINT,
  catalogDocumentForSerialization,
  createShipBuilderValidationPolicy,
  createShipPartCatalogSnapshot,
  shipBuilderValidationPolicyDocument,
  validateShipBlueprintStructure
} from "../../src/ship-builder";
import type {
  ShipBlueprint,
  ShipBuilderDiagnosticSeverity,
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

const policyWithRequiredSocket = (severity: ShipBuilderDiagnosticSeverity): ShipBuilderValidationPolicy => {
  const policy = clonePolicy();
  policy.requiredSocketRules = [
    {
      ruleId: `require-control-primary-${severity.toLowerCase()}`,
      severity,
      socketIds: ["control-primary"]
    }
  ];
  return createShipBuilderValidationPolicy(policy);
};

const validate = (
  source: unknown = SCOUT_BLUEPRINT,
  catalog: ShipPartCatalogSnapshot = STARTER_CATALOG,
  policy: ShipBuilderValidationPolicy = STARTER_SHIP_BUILDER_VALIDATION_POLICY
) => validateShipBlueprintStructure(source, catalog, policy);

describe("ship-builder structural validation", () => {
  it.each([
    ["Scout", SCOUT_BLUEPRINT, "scout-cockpit", 8],
    ["Cargo", CARGO_BLUEPRINT, "cargo-cockpit", 10],
    ["Weapon", WEAPON_BLUEPRINT, "weapon-cockpit", 11]
  ] as const)("accepts the %s fixture as one canonical connected component", (_name, blueprint, rootInstanceId, occupiedCount) => {
    const report = validate(blueprint);
    const expectedInstanceIds = blueprint.instances.map((instance) => instance.stableInstanceId).sort();

    expect(report.status).toBe("Valid");
    expect(report.catalogSignature).toBe(STARTER_CATALOG_SIGNATURE);
    expect(report.policySignature).toBe(STARTER_SHIP_BUILDER_VALIDATION_POLICY.signature);
    expect(report.connectedComponents).toEqual([{ instanceIds: expectedInstanceIds }]);
    expect(report.rootComponent).toEqual({ rootInstanceId, instanceIds: expectedInstanceIds });
    expect(report.disconnectedInstanceIds).toEqual([]);
    expect(report.unusedRequiredSocketEndpoints).toEqual([]);
    expect(report.occupiedSocketEndpoints).toHaveLength(occupiedCount);
    expect(report.summary).toMatchObject({
      connectedComponentCount: 1,
      disconnectedInstanceCount: 0,
      occupiedSocketEndpointCount: occupiedCount,
      unusedRequiredSocketEndpointCount: 0,
      diagnosticCount: 0
    });
    expect(report.signature).toMatch(/^[0-9a-f]{8}$/);
  });

  it("keeps the shared Weapon endpoint occupied by both sorted connections", () => {
    const report = validate(WEAPON_BLUEPRINT);
    const shared = report.occupiedSocketEndpoints.find(
      (occupied) =>
        occupied.endpoint.partInstanceId === "weapon-frame" && occupied.endpoint.socketId === "structural-top"
    );

    expect(shared).toEqual({
      endpoint: { partInstanceId: "weapon-frame", socketId: "structural-top" },
      connectionRole: "From",
      connectionIds: ["connection_weapon_frame_sensor", "connection_weapon_frame_turret"]
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "ExclusiveSocketOccupiedMultipleTimes"
    );
  });

  it("keeps opposite Cargo authoring roles distinct while sharing endpoint identity", () => {
    const report = validate(CARGO_BLUEPRINT);
    const cargoBayFront = report.occupiedSocketEndpoints.filter(
      (occupied) =>
        occupied.endpoint.partInstanceId === "cargo-bay" && occupied.endpoint.socketId === "structural-front"
    );

    expect(cargoBayFront).toEqual([
      {
        endpoint: { partInstanceId: "cargo-bay", socketId: "structural-front" },
        connectionRole: "From",
        connectionIds: ["connection_cargo_bay_docking"]
      },
      {
        endpoint: { partInstanceId: "cargo-bay", socketId: "structural-front" },
        connectionRole: "To",
        connectionIds: ["connection_cargo_frame_bay"]
      }
    ]);
    expect(report.summary.occupiedSocketEndpointCount).toBe(10);

    const exclusiveSource = clonePolicy();
    exclusiveSource.policyId = "cargo-opposite-role-exclusive-test";
    exclusiveSource.endpointRules[0].occupancy = "Exclusive";
    const exclusiveReport = validate(
      CARGO_BLUEPRINT,
      STARTER_CATALOG,
      createShipBuilderValidationPolicy(exclusiveSource)
    );
    expect(
      exclusiveReport.diagnostics.find(
        (diagnostic) =>
          diagnostic.code === "ExclusiveSocketOccupiedMultipleTimes" &&
          diagnostic.endpoints[0]?.partInstanceId === "cargo-bay" &&
          diagnostic.endpoints[0]?.socketId === "structural-front"
      )?.connectionIds
    ).toEqual(["connection_cargo_bay_docking", "connection_cargo_frame_bay"]);
  });

  it("reports one canonical occupancy error under an explicitly derived Exclusive policy", () => {
    const policySource = clonePolicy();
    policySource.policyId = "starter-structural-exclusive-test";
    policySource.endpointRules[0].occupancy = "Exclusive";
    const policy = createShipBuilderValidationPolicy(policySource);
    const report = validate(WEAPON_BLUEPRINT, STARTER_CATALOG, policy);
    const diagnostics = report.diagnostics.filter(
      (diagnostic) => diagnostic.code === "ExclusiveSocketOccupiedMultipleTimes"
    );

    expect(report.status).toBe("Invalid");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      connectionIds: ["connection_weapon_frame_sensor", "connection_weapon_frame_turret"],
      endpoints: [{ partInstanceId: "weapon-frame", socketId: "structural-top" }]
    });
  });

  it("ignores disabled connections and excludes disabled endpoint connections from occupancy and graph edges", () => {
    const disabledConnectionSource = cloneBlueprint();
    disabledConnectionSource.connections[0].enabled = false;
    const disabledConnection = validate(disabledConnectionSource);
    expect(disabledConnection.summary.occupiedSocketEndpointCount).toBe(6);
    expect(disabledConnection.summary.structuralEdgeCount).toBe(3);
    expect(disabledConnection.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("ConnectionEndpointDisabled");
    expect(disabledConnection.disconnectedInstanceIds).toEqual([
      "scout-engine",
      "scout-frame",
      "scout-fuel",
      "scout-rcs"
    ]);

    const disabledEndpointSource = cloneBlueprint();
    disabledEndpointSource.instances.find((instance: MutableRecord) => instance.stableInstanceId === "scout-cockpit").enabled = false;
    const disabledEndpoint = validate(disabledEndpointSource);
    expect(disabledEndpoint.summary.occupiedSocketEndpointCount).toBe(6);
    expect(disabledEndpoint.summary.structuralEdgeCount).toBe(3);
    expect(disabledEndpoint.diagnostics.map((diagnostic) => diagnostic.code)).toContain("ConnectionEndpointDisabled");
    expect(disabledEndpoint.rootComponent?.rootInstanceId).toBe("scout-engine");
    expect(disabledEndpoint.disconnectedInstanceIds).toEqual([]);
  });

  it("counts enabled occupied endpoints even when another compatibility rule fails", () => {
    const source = cloneBlueprint();
    source.connections[0].connectionType = "Functional";
    const report = validate(source);

    expect(report.summary.occupiedSocketEndpointCount).toBe(8);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain("ConnectionTypeIncompatible");
    expect(report.disconnectedInstanceIds).toEqual([
      "scout-engine",
      "scout-frame",
      "scout-fuel",
      "scout-rcs"
    ]);
  });

  it.each([
    ["Error", "Invalid"],
    ["Warning", "ValidWithWarnings"],
    ["Info", "Valid"]
  ] as const)("preserves %s policy-required socket severity", (severity, expectedStatus) => {
    const report = validate(SCOUT_BLUEPRINT, STARTER_CATALOG, policyWithRequiredSocket(severity));
    const requiredDiagnostic = report.diagnostics.find((diagnostic) => diagnostic.code === "RequiredSocketUnused");

    expect(report.status).toBe(expectedStatus);
    expect(requiredDiagnostic?.severity).toBe(severity);
    expect(report.unusedRequiredSocketEndpoints).toEqual([
      {
        endpoint: { partInstanceId: "scout-cockpit", socketId: "control-primary" },
        requirements: [
          {
            source: "Policy",
            sourceId: `require-control-primary-${severity.toLowerCase()}`,
            severity
          }
        ]
      }
    ]);
  });

  it("treats matching component metadata as an Error-level required socket without category inference", () => {
    const catalogSource = cloneCatalog();
    const cockpit = partById(catalogSource, STARTER_PART_IDS.scoutCockpitSmall);
    socketById(cockpit, "control-primary").requiredForComponentIds = ["control-core"];
    const catalog = createShipPartCatalogSnapshot(catalogSource);
    const report = validate(cloneBlueprint(), catalog);

    expect(report.status).toBe("Invalid");
    expect(report.summary.requiredSocketEndpointCount).toBe(1);
    expect(report.summary.unusedRequiredSocketEndpointCount).toBe(1);
    expect(report.diagnostics.find((diagnostic) => diagnostic.code === "RequiredSocketUnused")).toMatchObject({
      severity: "Error",
      endpoints: [{ partInstanceId: "scout-cockpit", socketId: "control-primary" }]
    });
  });

  it("selects deterministic roots and components for disconnected and empty blueprints", () => {
    const disconnectedSource = cloneBlueprint();
    disconnectedSource.connections = [];
    const disconnected = validate(disconnectedSource);
    expect(disconnected.rootComponent).toEqual({
      rootInstanceId: "scout-cockpit",
      instanceIds: ["scout-cockpit"]
    });
    expect(disconnected.connectedComponents).toEqual(
      disconnectedSource.instances
        .map((instance: MutableRecord) => instance.stableInstanceId)
        .sort()
        .map((instanceId: string) => ({ instanceIds: [instanceId] }))
    );
    expect(disconnected.disconnectedInstanceIds).toEqual([
      "scout-engine",
      "scout-frame",
      "scout-fuel",
      "scout-rcs"
    ]);

    const emptySource = cloneBlueprint();
    emptySource.instances = [];
    emptySource.connections = [];
    emptySource.referencedPartDefinitionIds = [];
    const empty = validate(emptySource);
    expect(empty.rootComponent).toBeNull();
    expect(empty.connectedComponents).toEqual([]);
    expect(empty.disconnectedInstanceIds).toEqual([]);
    expect(empty.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["NoEnabledInstances"]);
  });

  it("canonicalizes reordered input to the identical report and signature", () => {
    const reordered = cloneBlueprint(WEAPON_BLUEPRINT);
    reordered.instances.reverse();
    reordered.connections.reverse();
    reordered.referencedPartDefinitionIds.reverse();

    const canonical = validate(WEAPON_BLUEPRINT);
    const reorderedReport = validate(reordered);
    expect(reorderedReport).toEqual(canonical);
    expect(reorderedReport.signature).toBe(canonical.signature);
  });

  it("keeps unknown socket and instance failures in the schema layer", () => {
    const invalidSocket = cloneBlueprint();
    invalidSocket.connections[0].from.socketId = "missing-socket";
    expect(() => validate(invalidSocket)).toThrowError(ShipBuilderDataError);

    const invalidInstance = cloneBlueprint();
    invalidInstance.connections[0].to.partInstanceId = "missing-instance";
    expect(() => validate(invalidInstance)).toThrowError(ShipBuilderDataError);
  });

  it("deeply freezes report arrays, nested endpoints, summary, and diagnostics", () => {
    const policy = policyWithRequiredSocket("Warning");
    const report = validate(SCOUT_BLUEPRINT, STARTER_CATALOG, policy);

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.summary)).toBe(true);
    expect(Object.isFrozen(report.connectedComponents)).toBe(true);
    expect(Object.isFrozen(report.connectedComponents[0].instanceIds)).toBe(true);
    expect(Object.isFrozen(report.occupiedSocketEndpoints[0].endpoint)).toBe(true);
    expect(Object.isFrozen(report.unusedRequiredSocketEndpoints[0].requirements)).toBe(true);
    expect(Object.isFrozen(report.diagnostics[0])).toBe(true);
  });
});
