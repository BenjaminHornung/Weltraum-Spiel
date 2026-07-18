import { describe, expect, it } from "vitest";
import { createInteractionCapabilityId } from "../../src/interaction";
import { createSuitInterfaceId } from "../../src/suit";
import {
  MINING_CUTTER_FIXTURE,
  SURFACE_EQUIPMENT_COMMAND_KINDS,
  applySurfaceEquipmentCommand,
  canonicalSurfaceEquipmentJson,
  createSurfaceEquipmentBlueprint,
  createSurfaceEquipmentCatalog,
  type SurfaceEquipmentBlueprint,
  type SurfaceEquipmentCatalog,
  type SurfaceEquipmentCommand,
  type SurfaceEquipmentCommandKind,
  type SurfaceEquipmentModuleDefinitionInput,
  type SurfaceEquipmentSlotDefinitionInput
} from "../../src/surface-equipment";

const displayMetadata = (name: string) => ({ displayName: name, description: `${name} command test.` });

const moduleInput = (
  moduleId: string,
  overrides: Partial<SurfaceEquipmentModuleDefinitionInput> = {}
): SurfaceEquipmentModuleDefinitionInput => ({
  moduleId,
  moduleVersion: 1,
  displayMetadata: displayMetadata(moduleId),
  primaryRole: "Utility",
  tags: ["tag:utility"],
  massGrams: 100,
  bulkMicroUnits: 100,
  continuousPowerMilliwatts: 0,
  pulseEnergyMillijoules: 0,
  heatPerActionMillijoules: 0,
  activeThermalLoadMilliwatts: 0,
  passiveDissipationMilliwatts: 0,
  compatibleSlotTypeIds: ["slot-type:utility"],
  interactionCapabilities: [createInteractionCapabilityId("capability.access")],
  requiredSuitInterfaces: [createSuitInterfaceId("interface:primary")],
  resourceRequirements: [],
  calibrationDefinitions: [],
  safetyMetadata: { interlockRequired: false, certified: true },
  legalMetadata: { legalClassId: "unrestricted", legalClass: "Unrestricted" },
  balanceMetadata: { tier: "provisional-v0", rationale: "Deterministic command tests only." },
  ...overrides
});

const slotInput = (slotId: string, order: number): SurfaceEquipmentSlotDefinitionInput => ({
  slotId,
  order,
  slotTypeId: "slot-type:utility",
  required: false,
  exactCount: 1,
  allowedRoles: ["Utility"],
  allowedTags: [],
  excludedTags: [],
  requiredSuitInterfaces: [createSuitInterfaceId("interface:primary")],
  maximumMassGrams: 100,
  maximumBulkMicroUnits: 100,
  displayMetadata: displayMetadata(slotId)
});

const catalog: SurfaceEquipmentCatalog = createSurfaceEquipmentCatalog({
  catalogId: "catalog:commands.v1",
  catalogVersion: 1,
  schemaVersion: 1,
  displayMetadata: displayMetadata("Command catalog"),
  slots: [slotInput("slot:a", 0), slotInput("slot:b", 1)],
  modules: [moduleInput("module:a"), moduleInput("module:b")]
});

const blueprint = (withModule = true): SurfaceEquipmentBlueprint => createSurfaceEquipmentBlueprint({
  blueprintId: "blueprint:commands.v1",
  catalogId: catalog.catalogId,
  catalogVersion: catalog.catalogVersion,
  revision: 0,
  category: "UtilityDevice",
  displayMetadata: displayMetadata("Command equipment"),
  slotAssignments: withModule
    ? [{ slotId: "slot:a", moduleInstanceIds: ["instance:stable"] }]
    : [],
  moduleInstances: withModule
    ? [{ moduleInstanceId: "instance:stable", moduleId: "module:a" }]
    : [],
  calibrationChoices: [],
  tags: [],
  processedCommandIds: []
}, catalog);

let commandCounter = 0;
const command = (
  kind: SurfaceEquipmentCommandKind,
  target: SurfaceEquipmentBlueprint | null,
  payload: Readonly<Record<string, unknown>>,
  overrides: Partial<Record<"commandId" | "blueprintId" | "expectedRevision" | "resultingRevision", unknown>> = {}
): SurfaceEquipmentCommand => {
  commandCounter += 1;
  const expectedRevision = overrides.expectedRevision ?? target?.revision ?? 0;
  return {
    kind,
    commandId: overrides.commandId ?? `command:test-${commandCounter}`,
    blueprintId: overrides.blueprintId ?? target?.blueprintId ?? "blueprint:commands.v1",
    expectedRevision,
    resultingRevision: overrides.resultingRevision ?? (expectedRevision as number) + 1,
    payload,
    source: "source:test",
    sequence: commandCounter
  } as SurfaceEquipmentCommand;
};

const expectAccepted = (result: ReturnType<typeof applySurfaceEquipmentCommand>): SurfaceEquipmentBlueprint => {
  expect(result.status).toBe("Accepted");
  if (result.status !== "Accepted") throw new Error("Expected accepted command.");
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.blueprint)).toBe(true);
  return result.blueprint;
};

describe("Surface Equipment atomic commands", () => {
  it("20 enforces exact CAS for all seven commands and preserves rejection identity", () => {
    const existing = blueprint();
    const mining = MINING_CUTTER_FIXTURE.blueprint;
    const miningInstance = mining.moduleInstances.find((entry) => entry.moduleId === "module:mining-cutter.head")!;
    const staleCommands: readonly [SurfaceEquipmentBlueprint | null, SurfaceEquipmentCatalog, SurfaceEquipmentCommand][] = [
      [null, catalog, command("CreateBlueprint", null, {
        category: "UtilityDevice", displayMetadata: displayMetadata("Created"), slotAssignments: [], moduleInstances: []
      }, { expectedRevision: 1, resultingRevision: 2 })],
      [existing, catalog, command("InstallModule", existing, { slotId: "slot:b", moduleInstanceId: "instance:new", moduleId: "module:b" }, { expectedRevision: 1, resultingRevision: 2 })],
      [existing, catalog, command("RemoveModule", existing, { moduleInstanceId: "instance:stable" }, { expectedRevision: 1, resultingRevision: 2 })],
      [existing, catalog, command("ReplaceModule", existing, { moduleInstanceId: "instance:stable", moduleId: "module:b" }, { expectedRevision: 1, resultingRevision: 2 })],
      [existing, catalog, command("MoveModule", existing, { moduleInstanceId: "instance:stable", toSlotId: "slot:b" }, { expectedRevision: 1, resultingRevision: 2 })],
      [mining, MINING_CUTTER_FIXTURE.catalog, command("SetCalibration", mining, {
        moduleInstanceId: miningInstance.moduleInstanceId,
        calibrationId: "calibration:output-mode",
        optionId: "calibration-option:high"
      }, { expectedRevision: 1, resultingRevision: 2 })],
      [existing, catalog, command("RenameDisplayLabel", existing, { displayLabel: "Renamed" }, { expectedRevision: 1, resultingRevision: 2 })]
    ];

    expect(staleCommands.map(([, , entry]) => entry.kind)).toEqual(SURFACE_EQUIPMENT_COMMAND_KINDS);
    for (const [original, commandCatalog, stale] of staleCommands) {
      const before = original === null ? null : canonicalSurfaceEquipmentJson(original);
      const result = applySurfaceEquipmentCommand(original, commandCatalog, stale);
      expect(result.status).toBe("Rejected");
      if (result.status !== "Rejected") continue;
      expect(result.blueprint).toBe(original);
      expect(result.diagnostics.map((entry) => entry.code)).toEqual(["RevisionConflict"]);
      if (original !== null) expect(canonicalSurfaceEquipmentJson(original)).toBe(before);
    }
  });

  it("21 rejects a replayed command ID even when its CAS envelope is otherwise current", () => {
    const original = blueprint();
    const first = command("RenameDisplayLabel", original, { displayLabel: "First" }, { commandId: "command:duplicate" });
    const changed = expectAccepted(applySurfaceEquipmentCommand(original, catalog, first));
    const replay = command("RenameDisplayLabel", changed, { displayLabel: "Replay" }, { commandId: "command:duplicate" });
    const rejected = applySurfaceEquipmentCommand(changed, catalog, replay);
    expect(rejected.status).toBe("Rejected");
    if (rejected.status !== "Rejected") return;
    expect(rejected.blueprint).toBe(changed);
    expect(rejected.diagnostics.map((entry) => entry.code)).toEqual(["DuplicateCommand"]);
    expect(changed.displayMetadata.displayName).toBe("First");
  });

  it("22 rejects an invalid install atomically with exact ordered diagnostics", () => {
    const original = blueprint();
    const before = canonicalSurfaceEquipmentJson(original);
    const invalid = command("InstallModule", original, {
      slotId: "slot:missing",
      moduleInstanceId: "instance:new",
      moduleId: "module:missing"
    });
    const result = applySurfaceEquipmentCommand(original, catalog, invalid);
    expect(result.status).toBe("Rejected");
    if (result.status !== "Rejected") return;
    expect(result.blueprint).toBe(original);
    expect(result.diagnostics.map((entry) => [entry.code, entry.path])).toEqual([
      ["UnknownModule", "/payload/moduleId"],
      ["UnknownSlot", "/payload/slotId"]
    ]);
    expect(canonicalSurfaceEquipmentJson(original)).toBe(before);
    expect(original.moduleInstances).toHaveLength(1);
  });

  it("rejects installation into a full slot during preflight without mutation", () => {
    const original = blueprint();
    const before = canonicalSurfaceEquipmentJson(original);
    const result = applySurfaceEquipmentCommand(original, catalog, command("InstallModule", original, {
      slotId: "slot:a", moduleInstanceId: "instance:new", moduleId: "module:b"
    }));
    expect(result.status).toBe("Rejected");
    if (result.status !== "Rejected") return;
    expect(result.blueprint).toBe(original);
    expect(result.diagnostics).toEqual([expect.objectContaining({
      code: "SlotCapacityExceeded",
      path: "/payload/slotId",
      details: { actual: 1, maximum: 1 }
    })]);
    expect(canonicalSurfaceEquipmentJson(original)).toBe(before);
  });

  it("rejects malformed runtime command data without getter execution or uncaught errors", () => {
    const original = blueprint();
    const valid = command("RenameDisplayLabel", original, { displayLabel: "Valid" });
    let getterExecutions = 0;
    const accessor = { ...valid } as Record<string, unknown>;
    Object.defineProperty(accessor, "kind", {
      enumerable: true,
      get: () => {
        getterExecutions += 1;
        return "RenameDisplayLabel";
      }
    });
    const nonPlain = Object.assign(Object.create({ inherited: true }), valid);
    const sparse = command("CreateBlueprint", null, {
      category: "UtilityDevice", displayMetadata: displayMetadata("Sparse"),
      slotAssignments: new Array(1), moduleInstances: []
    });
    const malformed: readonly unknown[] = [
      null,
      accessor,
      nonPlain,
      { ...valid, unexpected: true },
      { ...valid, payload: { displayLabel: "Renamed", unexpected: true } },
      sparse
    ];
    for (const entry of malformed) {
      const result = applySurfaceEquipmentCommand(original, catalog, entry);
      expect(result.status).toBe("Rejected");
      if (result.status !== "Rejected") continue;
      expect(result.blueprint).toBe(original);
      expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.path])).toEqual([
        ["InvalidCommand", "/command"]
      ]);
    }
    expect(getterExecutions).toBe(0);
  });

  it("23 moves a module without changing its stable instance identity", () => {
    const original = blueprint();
    const moved = expectAccepted(applySurfaceEquipmentCommand(original, catalog, command("MoveModule", original, {
      moduleInstanceId: "instance:stable", toSlotId: "slot:b"
    })));
    expect(moved.moduleInstances).toEqual([{ moduleInstanceId: "instance:stable", moduleId: "module:a" }]);
    expect(moved.slotAssignments).toEqual([
      { slotId: "slot:a", moduleInstanceIds: [] },
      { slotId: "slot:b", moduleInstanceIds: ["instance:stable"] }
    ]);
    expect(original.slotAssignments).toEqual([{ slotId: "slot:a", moduleInstanceIds: ["instance:stable"] }]);
  });

  it("rejects moving a module into a full different slot during preflight without mutation", () => {
    const base = blueprint();
    const original = createSurfaceEquipmentBlueprint({
      blueprintId: base.blueprintId,
      catalogId: base.catalogId,
      catalogVersion: base.catalogVersion,
      revision: base.revision,
      category: base.category,
      displayMetadata: base.displayMetadata,
      slotAssignments: [
        { slotId: "slot:a", moduleInstanceIds: ["instance:stable"] },
        { slotId: "slot:b", moduleInstanceIds: ["instance:destination"] }
      ],
      moduleInstances: [
        { moduleInstanceId: "instance:stable", moduleId: "module:a" },
        { moduleInstanceId: "instance:destination", moduleId: "module:b" }
      ],
      calibrationChoices: base.calibrationChoices,
      tags: base.tags,
      processedCommandIds: base.processedCommandIds
    }, catalog);
    const before = canonicalSurfaceEquipmentJson(original);
    const result = applySurfaceEquipmentCommand(original, catalog, command("MoveModule", original, {
      moduleInstanceId: "instance:stable", toSlotId: "slot:b"
    }));
    expect(result.status).toBe("Rejected");
    if (result.status !== "Rejected") return;
    expect(result.blueprint).toBe(original);
    expect(result.diagnostics).toEqual([expect.objectContaining({
      code: "SlotCapacityExceeded",
      path: "/payload/toSlotId",
      details: { actual: 1, maximum: 1 }
    })]);
    expect(canonicalSurfaceEquipmentJson(original)).toBe(before);
  });

  it("allows moving a module within its already full slot", () => {
    const original = blueprint();
    const moved = expectAccepted(applySurfaceEquipmentCommand(original, catalog, command("MoveModule", original, {
      moduleInstanceId: "instance:stable", toSlotId: "slot:a"
    })));
    expect(moved.slotAssignments).toEqual([{ slotId: "slot:a", moduleInstanceIds: ["instance:stable"] }]);
  });

  it("24 replaces the definition deterministically while preserving the instance ID and clearing calibration", () => {
    const original = blueprint();
    const replaced = expectAccepted(applySurfaceEquipmentCommand(original, catalog, command("ReplaceModule", original, {
      moduleInstanceId: "instance:stable", moduleId: "module:b"
    })));
    expect(replaced.moduleInstances).toEqual([{ moduleInstanceId: "instance:stable", moduleId: "module:b" }]);
    expect(replaced.calibrationChoices).toEqual([]);
    expect(original.moduleInstances[0]?.moduleId).toBe("module:a");
  });

  it("25 increments revision on rename while leaving the gameplay signature unchanged", () => {
    const original = blueprint();
    const renamed = expectAccepted(applySurfaceEquipmentCommand(original, catalog, command("RenameDisplayLabel", original, {
      displayLabel: "Human-readable rename"
    })));
    expect(renamed.displayMetadata.displayName).toBe("Human-readable rename");
    expect(renamed.revision).toBe(original.revision + 1);
    expect(renamed.contentSignature).toBe(original.contentSignature);
    expect(renamed.processedCommandIds).toHaveLength(1);

    const renamedByDisplayName = expectAccepted(applySurfaceEquipmentCommand(
      original,
      catalog,
      command("RenameDisplayLabel", original, { displayName: "Display-name variant" })
    ));
    expect(renamedByDisplayName.displayMetadata.displayName).toBe("Display-name variant");
    expect(renamedByDisplayName.contentSignature).toBe(original.contentSignature);
  });

  it("26 accepts only catalog-defined discrete calibration options", () => {
    const original = MINING_CUTTER_FIXTURE.blueprint;
    const instance = original.moduleInstances.find((entry) => entry.moduleId === "module:mining-cutter.head")!;
    const accepted = expectAccepted(applySurfaceEquipmentCommand(
      original,
      MINING_CUTTER_FIXTURE.catalog,
      command("SetCalibration", original, {
        moduleInstanceId: instance.moduleInstanceId,
        calibrationId: "calibration:output-mode",
        optionId: "calibration-option:high"
      })
    ));
    expect(accepted.calibrationChoices).toEqual([{
      moduleInstanceId: instance.moduleInstanceId,
      calibrationId: "calibration:output-mode",
      optionId: "calibration-option:high"
    }]);

    const invalid = command("SetCalibration", original, {
      moduleInstanceId: instance.moduleInstanceId,
      calibrationId: "calibration:output-mode",
      optionId: "calibration-option:0.618"
    });
    const rejected = applySurfaceEquipmentCommand(original, MINING_CUTTER_FIXTURE.catalog, invalid);
    expect(rejected.status).toBe("Rejected");
    if (rejected.status !== "Rejected") return;
    expect(rejected.blueprint).toBe(original);
    expect(rejected.diagnostics.map((entry) => entry.code)).toEqual(["CalibrationInvalid"]);
  });

  it("accepts Create, Install, Remove, and both supported argument orders without hidden mutation", () => {
    const empty = blueprint(false);
    const installed = expectAccepted(applySurfaceEquipmentCommand(empty, command("InstallModule", empty, {
      slotId: "slot:a", moduleInstanceId: "instance:installed", moduleId: "module:a"
    }), catalog));
    expect(installed.moduleInstances.map((entry) => entry.moduleInstanceId)).toEqual(["instance:installed"]);

    const removed = expectAccepted(applySurfaceEquipmentCommand(blueprint(), catalog, command("RemoveModule", blueprint(), {
      moduleInstanceId: "instance:stable"
    })));
    expect(removed.moduleInstances).toEqual([]);

    const created = expectAccepted(applySurfaceEquipmentCommand(null, catalog, command("CreateBlueprint", null, {
      category: "UtilityDevice",
      displayMetadata: displayMetadata("Created equipment"),
      slotAssignments: [],
      moduleInstances: [],
      calibrationChoices: [],
      tags: []
    })));
    expect(created.revision).toBe(1);
    expect(created.processedCommandIds).toHaveLength(1);

    const createAgainstExisting = applySurfaceEquipmentCommand(blueprint(), catalog, command("CreateBlueprint", blueprint(), {
      category: "UtilityDevice", displayMetadata: displayMetadata("Duplicate create"),
      slotAssignments: [], moduleInstances: []
    }));
    expect(createAgainstExisting.status).toBe("Rejected");
    if (createAgainstExisting.status === "Rejected") {
      expect(createAgainstExisting.diagnostics.map((entry) => [entry.code, entry.path])).toEqual([
        ["BlueprintMismatch", "/kind"]
      ]);
    }
  });
});
