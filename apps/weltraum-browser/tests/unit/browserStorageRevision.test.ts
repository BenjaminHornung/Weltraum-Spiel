import { describe, expect, it } from "vitest";
import {
  createDefinitionResolutionFixture,
  createSaveGameEnvelopeV1Fixture
} from "../../src/persistence";
import {
  createMemorySaveRepository,
  type SaveRepositoryError,
  type SaveRepositoryErrorCode
} from "../../src/browser-storage";

const expectCode = async (operation: Promise<unknown>, code: SaveRepositoryErrorCode): Promise<void> => {
  await expect(operation).rejects.toMatchObject({ code } satisfies Partial<SaveRepositoryError>);
};

describe("memory save repository revisions", () => {
  it("creates at revision one and increments only an exact compare-and-swap", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const envelope = createSaveGameEnvelopeV1Fixture();

    const created = await repository.writeSlot({
      slotId: "revision-slot",
      expectedRevision: 0,
      envelope,
      lastWriteReason: "ManualSave"
    });
    await expectCode(repository.writeSlot({
      slotId: "revision-slot",
      expectedRevision: null,
      envelope,
      lastWriteReason: "ManualSave"
    }), "SlotAlreadyExists");
    await expectCode(repository.writeSlot({
      slotId: "revision-slot",
      expectedRevision: 0,
      envelope,
      lastWriteReason: "ManualSave"
    }), "RevisionConflict");
    const updated = await repository.writeSlot({
      slotId: "revision-slot",
      expectedRevision: created.metadata.recordRevision,
      envelope,
      lastWriteReason: "Checkpoint"
    });

    expect(created.metadata.recordRevision).toBe(1);
    expect(updated.metadata.recordRevision).toBe(2);
    expect(updated.metadata.lastWriteReason).toBe("Checkpoint");
  });

  it("allows only one concurrent writer to commit the same expected revision", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const envelope = createSaveGameEnvelopeV1Fixture();
    await repository.writeSlot({
      slotId: "race-slot",
      expectedRevision: null,
      envelope,
      lastWriteReason: "ManualSave"
    });

    const writes = await Promise.allSettled([
      repository.writeSlot({ slotId: "race-slot", expectedRevision: 1, envelope, lastWriteReason: "WriterA" }),
      repository.writeSlot({ slotId: "race-slot", expectedRevision: 1, envelope, lastWriteReason: "WriterB" })
    ]);

    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "RevisionConflict" });
    expect((await repository.readSlot("race-slot")).metadata.recordRevision).toBe(2);
  });

  it("guards deletion by exact revision and preserves the slot on conflict", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    await repository.writeSlot({
      slotId: "delete-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });

    await expectCode(repository.deleteSlot("delete-slot", 2), "RevisionConflict");
    expect((await repository.readSlot("delete-slot")).metadata.recordRevision).toBe(1);
    await repository.deleteSlot("delete-slot", 1);
    await expectCode(repository.deleteSlot("delete-slot", 1), "SlotNotFound");
  });

  it("keeps the complete old record when a replacement fails validation", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const created = await repository.writeSlot({
      slotId: "rollback-slot",
      expectedRevision: null,
      envelope: createSaveGameEnvelopeV1Fixture(),
      lastWriteReason: "ManualSave"
    });
    const invalid = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as Record<string, any>;
    invalid.gameVersion = "";

    await expectCode(repository.writeSlot({
      slotId: "rollback-slot",
      expectedRevision: 1,
      envelope: invalid,
      lastWriteReason: "BrokenWrite"
    }), "InvalidEnvelope");
    const after = await repository.readSlot("rollback-slot");

    expect(after.metadata).toEqual(created.metadata);
    expect(after.payloadBytes).toEqual(created.payloadBytes);
    expect(after.envelope).toEqual(created.envelope);
  });

  it("rejects invalid or missing expected revisions before mutation", async () => {
    const repository = createMemorySaveRepository(createDefinitionResolutionFixture());
    await repository.initialize();
    const envelope = createSaveGameEnvelopeV1Fixture();

    await expectCode(repository.writeSlot({
      slotId: "missing-slot",
      expectedRevision: 4,
      envelope,
      lastWriteReason: "ManualSave"
    }), "RevisionConflict");
    for (const revision of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      await expectCode(repository.writeSlot({
        slotId: "invalid-revision",
        expectedRevision: revision,
        envelope,
        lastWriteReason: "ManualSave"
      }), "InvalidEnvelope");
    }
    expect(await repository.listSlots()).toEqual({ slots: [] });
  });
});
