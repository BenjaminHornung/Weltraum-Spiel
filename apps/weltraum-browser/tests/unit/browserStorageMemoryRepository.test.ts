import { describe, expect, it } from "vitest";
import {
  createDefinitionResolutionFixture,
  createSaveGameEnvelopeV1Fixture
} from "../../src/persistence";
import {
  createMemorySaveRepository,
  type SaveRepositoryError
} from "../../src/browser-storage";

const rejectionCode = async (operation: Promise<unknown>): Promise<string> => {
  try {
    await operation;
    return "resolved";
  } catch (error) {
    return (error as SaveRepositoryError).code;
  }
};

describe("memory save repository", () => {
  it("requires initialization, initializes idempotently, and closes terminally", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());

    expect(await rejectionCode(repository.listSlots())).toBe("RepositoryUnavailable");
    await repository.initialize();
    await repository.initialize();
    expect(await repository.listSlots()).toEqual({ slots: [] });
    await repository.close();
    await repository.close();
    expect(await rejectionCode(repository.initialize())).toBe("ClosedRepository");
    expect(await rejectionCode(repository.listSlots())).toBe("ClosedRepository");
  });

  it("creates, reads, lists ordinally, and deletes slots", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();

    await repository.writeSlot({
      slotId: "slot-z",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });
    await repository.writeSlot({
      slotId: "slot-a",
      expectedRevision: 0,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });

    const listed = await repository.listSlots();
    expect(listed.slots.map((slot) => slot.slotId)).toEqual(["slot-a", "slot-z"]);
    expect(listed.slots[0]).toMatchObject({
      displayName: "slot-a",
      recordRevision: 1,
      saveSchemaVersion: 1,
      lastWriteReason: "ManualSave"
    });
    expect((await repository.readSlot("slot-z")).envelope).toEqual(createSaveGameEnvelopeV1Fixture());

    expect(await repository.deleteSlot("slot-z", 1)).toEqual({ slotId: "slot-z", deletedRevision: 1 });
    expect(await rejectionCode(repository.readSlot("slot-z"))).toBe("SlotNotFound");
  });

  it("isolates stored bytes and envelopes from caller and result mutation", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const callerEnvelope = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as Record<string, any>;
    const write = await repository.writeSlot({
      slotId: "copy-slot",
      expectedRevision: null,
      envelope: callerEnvelope,
      lastWriteReason: "ManualSave"
    });
    const committedHash = write.metadata.contentHash;
    const committedFirstByte = write.payloadBytes[0];

    callerEnvelope.player.data.credits = 999999;
    write.payloadBytes[0] = (write.payloadBytes[0] ?? 0) ^ 0xff;
    const firstRead = await repository.readSlot("copy-slot");
    firstRead.payloadBytes[0] = (firstRead.payloadBytes[0] ?? 0) ^ 0xff;
    const secondRead = await repository.readSlot("copy-slot");

    expect((secondRead.envelope.player.data as Record<string, unknown>).credits).toBe(1000);
    expect(secondRead.metadata.contentHash).toBe(committedHash);
    expect(secondRead.payloadBytes[0]).toBe(committedFirstByte);
    expect(firstRead.payloadBytes).not.toEqual(secondRead.payloadBytes);
    expect(Object.isFrozen(secondRead.envelope)).toBe(true);
    expect(Object.isFrozen(secondRead.metadata)).toBe(true);
  });

  it.each([
    ["257-character", "v".repeat(257)],
    ["internal-control-character", "fixture\u0001v1"]
  ])("writes and reads a persistence-valid %s gameVersion without corruption", async (_description, gameVersion) => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const envelope = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as { gameVersion: string };
    envelope.gameVersion = gameVersion;

    const write = await repository.writeSlot({
      slotId: "game-version-slot",
      expectedRevision: null,
      envelope,
      lastWriteReason: "UnitTest"
    });
    const read = await repository.readSlot("game-version-slot");

    expect(write.metadata.gameVersion).toBe(gameVersion);
    expect(read.metadata.gameVersion).toBe(gameVersion);
    expect(read.envelope.gameVersion).toBe(gameVersion);
  });

  it("rejects invalid slot IDs without changing deterministic listing", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const envelope = createSaveGameEnvelopeV1Fixture();

    for (const slotId of ["", " Slot", "Slot", "slot/name", "a".repeat(65)]) {
      expect(await rejectionCode(repository.writeSlot({
        slotId,
        expectedRevision: null,
        envelope,
        lastWriteReason: "ManualSave"
      }))).toBe("InvalidEnvelope");
    }

    expect(await repository.listSlots()).toEqual({ slots: [] });
  });

  it("exports JSON-safe canonical data and imports it without silent overwrite", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    await repository.writeSlot({
      slotId: "export-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });

    const exported = await repository.exportSlot("export-slot");
    const jsonRoundtrip = JSON.parse(JSON.stringify(exported)) as unknown;
    const imported = await repository.importSlot(jsonRoundtrip, {
      kind: "CreateNewSlot",
      targetSlotId: "import-slot"
    });

    expect(imported.metadata).toMatchObject({
      slotId: "import-slot",
      displayName: "export-slot",
      recordRevision: 1,
      lastWriteReason: "Import",
      contentHash: exported.contentHash
    });
    expect(imported.envelope).toEqual(createSaveGameEnvelopeV1Fixture());
    expect(await rejectionCode(repository.importSlot(jsonRoundtrip, { kind: "RejectIfExists" }))).toBe("ImportConflict");
    const replaced = await repository.importSlot(jsonRoundtrip, {
      kind: "ReplaceExpectedRevision",
      expectedRevision: 1
    });
    expect(replaced.metadata.recordRevision).toBe(2);
  });
});
