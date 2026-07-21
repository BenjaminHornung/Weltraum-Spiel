import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDefinitionResolutionFixture,
  createSaveGameEnvelopeV1Fixture
} from "../../src/persistence";
import {
  createSaveCodec,
  createStoredSaveRecord,
  parseSaveRecordRevision,
  parseSaveSlotId,
  type EncodedSavePayload,
  type SaveContentHash,
  type SaveSlotMetadata
} from "../../src/browser-storage";

const hash = (bytes: Uint8Array): SaveContentHash =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}` as SaveContentHash;

const metadataFor = (encoded: EncodedSavePayload): SaveSlotMetadata => ({
  slotId: parseSaveSlotId("corruption-slot"),
  displayName: "corruption-slot",
  recordRevision: parseSaveRecordRevision(1),
  saveSchemaVersion: 1,
  gameVersion: encoded.envelope.gameVersion,
  universeTick: encoded.envelope.universeTime.tick,
  payloadBytes: encoded.payloadBytes.byteLength,
  contentHash: encoded.contentHash,
  lastWriteReason: "UnitTest"
});

const expectCode = async (operation: Promise<unknown>, code: string): Promise<void> => {
  await expect(operation).rejects.toMatchObject({ code });
};

describe("browser storage corruption handling", () => {
  it("detects changed stored bytes before parsing", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const corrupted = new Uint8Array(encoded.payloadBytes);
    corrupted[corrupted.length - 2] = (corrupted[corrupted.length - 2] ?? 0) ^ 1;

    await expectCode(
      codec.decodeStoredRecord(createStoredSaveRecord(metadataFor(encoded), corrupted)),
      "ChecksumMismatch"
    );
  });

  it("detects a valid-format but incorrect stored hash", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const metadata = { ...metadataFor(encoded), contentHash: `sha256:${"0".repeat(64)}` as SaveContentHash };

    await expectCode(
      codec.decodeStoredRecord(createStoredSaveRecord(metadata, encoded.payloadBytes)),
      "ChecksumMismatch"
    );
  });

  it("rejects malformed current data even when its checksum is recomputed", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const malformed = new TextEncoder().encode("{not-json");
    const metadata = {
      ...metadataFor(encoded),
      payloadBytes: malformed.byteLength,
      contentHash: hash(malformed)
    };

    await expectCode(codec.decodeStoredRecord(createStoredSaveRecord(metadata, malformed)), "CorruptRecord");
  });

  it("fails closed with UnsupportedSaveVersion for future stored envelopes", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const future = JSON.parse(encoded.canonicalPayload) as Record<string, unknown>;
    future.schemaVersion = 2;
    const futureBytes = new TextEncoder().encode(JSON.stringify(future));
    const record = {
      metadata: {
        ...metadataFor(encoded),
        saveSchemaVersion: 2,
        payloadBytes: futureBytes.byteLength,
        contentHash: hash(futureBytes)
      },
      payloadBytes: futureBytes
    };

    await expectCode(codec.decodeStoredRecord(record), "UnsupportedSaveVersion");
  });

  it("rejects malformed record shape and unsafe declared lengths", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const record = createStoredSaveRecord(metadataFor(encoded), encoded.payloadBytes);

    await expectCode(codec.decodeStoredRecord({ ...record, extra: true }), "CorruptRecord");
    await expectCode(codec.decodeStoredRecord({
      metadata: { ...record.metadata, payloadBytes: Number.MAX_SAFE_INTEGER },
      payloadBytes: record.payloadBytes
    }), "CorruptRecord");
  });
});
