import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createDefinitionResolutionFixture,
  createSaveGameEnvelopeV1Fixture,
  type DefinitionResolutionSnapshot
} from "../../src/persistence";
import {
  createSaveCodec,
  createStoredSaveRecord,
  MAX_SAVE_PAYLOAD_BYTES,
  parseSaveRecordRevision,
  parseSaveSlotId,
  SAVE_REPOSITORY_SCHEMA_VERSION,
  type EncodedSavePayload,
  type SaveExportBundle,
  type SaveSlotMetadata
} from "../../src/browser-storage";

const metadataFor = (encoded: EncodedSavePayload): SaveSlotMetadata => ({
  slotId: parseSaveSlotId("codec-slot"),
  displayName: "codec-slot",
  recordRevision: parseSaveRecordRevision(1),
  saveSchemaVersion: 1,
  gameVersion: encoded.envelope.gameVersion,
  universeTick: encoded.envelope.universeTime.tick,
  payloadBytes: encoded.payloadBytes.byteLength,
  contentHash: encoded.contentHash,
  lastWriteReason: "UnitTest"
});

const expectCode = async (promise: Promise<unknown>, code: string): Promise<void> => {
  await expect(promise).rejects.toMatchObject({ code });
};

const exportBundleFor = (encoded: EncodedSavePayload): SaveExportBundle => ({
  bundleVersion: 1,
  repositorySchemaVersion: SAVE_REPOSITORY_SCHEMA_VERSION,
  saveSchemaVersion: 1,
  metadata: metadataFor(encoded),
  canonicalPayload: encoded.canonicalPayload,
  payloadBytes: encoded.payloadBytes.byteLength,
  contentHash: encoded.contentHash
});

const hostileReflectionProxies = <T extends object>(
  target: T,
  getterTrap: () => never
): readonly T[] => [
  new Proxy(target, {
    get: getterTrap,
    getPrototypeOf(): never {
      throw new Error("Prototype reflection trap failed.");
    }
  }),
  new Proxy(target, {
    get: getterTrap,
    getOwnPropertyDescriptor(): never {
      throw new Error("Descriptor reflection trap failed.");
    }
  }),
  new Proxy(target, {
    get: getterTrap,
    ownKeys(): never {
      throw new Error("Own-key reflection trap failed.");
    }
  })
];

describe("browser storage codec", () => {
  it("roundtrips compact canonical UTF-8 and hashes the exact stored bytes", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const source = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as Record<string, any>;
    source.gameVersion = "fixture-🚀";

    const encoded = await codec.encode(source);
    const expected = createHash("sha256").update(encoded.payloadBytes).digest("hex");
    const decoded = await codec.decodeStoredRecord(createStoredSaveRecord(metadataFor(encoded), encoded.payloadBytes));

    expect(encoded.contentHash).toBe(`sha256:${expected}`);
    expect(new TextDecoder().decode(encoded.payloadBytes)).toBe(encoded.canonicalPayload);
    expect(decoded.envelope).toEqual(encoded.envelope);
    expect(decoded.payloadBytes).toEqual(encoded.payloadBytes);
    expect(await codec.encode(decoded.envelope)).toMatchObject({
      canonicalPayload: encoded.canonicalPayload,
      contentHash: encoded.contentHash
    });
  });

  it.each([
    ["257-character", "v".repeat(257)],
    ["internal-control-character", "fixture\u0001v1"]
  ])("roundtrips a persistence-valid %s gameVersion through stored-record decoding", async (_description, gameVersion) => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const source = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as { gameVersion: string };
    source.gameVersion = gameVersion;

    const encoded = await codec.encode(source);
    const decoded = await codec.decodeStoredRecord(createStoredSaveRecord(metadataFor(encoded), encoded.payloadBytes));

    expect(decoded.metadata.gameVersion).toBe(gameVersion);
    expect(decoded.envelope.gameVersion).toBe(gameVersion);
  });

  it("captures immutable definition resolution data instead of retaining caller arrays", async () => {
    const mutableSnapshots = JSON.parse(JSON.stringify(createDefinitionResolutionFixture())) as Array<{
      domain: string;
      version: string;
      definitionIds: string[];
    }>;
    const codec = createSaveCodec(mutableSnapshots as unknown as readonly DefinitionResolutionSnapshot[]);
    mutableSnapshots[0]!.domain = "changed";
    mutableSnapshots[0]!.definitionIds.length = 0;

    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());

    expect(codec.definitionSnapshots[0]).toEqual(createDefinitionResolutionFixture()[0]);
    expect(Object.isFrozen(codec.definitionSnapshots)).toBe(true);
    expect(Object.isFrozen(codec.definitionSnapshots[0]?.definitionIds)).toBe(true);
    expect(encoded.envelope.schemaVersion).toBe(1);
  });

  it("fails closed for invalid values and future save envelopes", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const invalid = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as Record<string, any>;
    invalid.ships[0].currentMassKg = Number.NaN;
    const future = JSON.parse(JSON.stringify(createSaveGameEnvelopeV1Fixture())) as Record<string, any>;
    future.schemaVersion = 2;

    await expectCode(codec.encode(invalid), "InvalidEnvelope");
    await expectCode(codec.encode(future), "UnsupportedSaveVersion");
    await expectCode(codec.encode(new Date(0)), "InvalidEnvelope");
  });

  it("rejects noncanonical JSON even when its recomputed checksum is valid", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const noncanonical = new TextEncoder().encode(JSON.stringify(JSON.parse(encoded.canonicalPayload), null, 2));
    const contentHash = `sha256:${createHash("sha256").update(noncanonical).digest("hex")}` as typeof encoded.contentHash;
    const metadata = {
      ...metadataFor(encoded),
      payloadBytes: noncanonical.byteLength,
      contentHash
    };

    await expectCode(codec.decodeStoredRecord(createStoredSaveRecord(metadata, noncanonical)), "CorruptRecord");
  });

  it("normalizes hostile top-level and nested imported-bundle reflection traps without invoking getters", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const bundle = exportBundleFor(encoded);
    let getterCalls = 0;
    const getterTrap = (): never => {
      getterCalls += 1;
      throw new Error("Imported bundle getters must not run.");
    };
    const hostileBundles: readonly unknown[] = [
      ...hostileReflectionProxies(bundle, getterTrap),
      ...hostileReflectionProxies(bundle.metadata, getterTrap).map((metadata) => ({
        ...bundle,
        metadata
      }))
    ];

    for (const hostileBundle of hostileBundles) {
      await expect(codec.decodeExportBundle(hostileBundle)).rejects.toMatchObject({
        code: "InvalidEnvelope",
        operation: "decodeExportBundle"
      });
    }

    expect(getterCalls).toBe(0);
  });

  it("normalizes revoked imported bundles and preserves stored-record corruption context", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const revokedBundle = Proxy.revocable(exportBundleFor(encoded), {});
    revokedBundle.revoke();
    let storedGetterCalls = 0;
    const hostileStoredRecord = new Proxy(
      createStoredSaveRecord(metadataFor(encoded), encoded.payloadBytes),
      {
        get(): never {
          storedGetterCalls += 1;
          throw new Error("Stored record getters must not run.");
        },
        getPrototypeOf(): never {
          throw new Error("Stored record prototype reflection trap failed.");
        }
      }
    );

    await expect(codec.decodeExportBundle(revokedBundle.proxy)).rejects.toMatchObject({
      code: "InvalidEnvelope",
      operation: "decodeExportBundle"
    });
    await expect(codec.decodeStoredRecord(hostileStoredRecord)).rejects.toMatchObject({
      code: "CorruptRecord",
      operation: "decodeStoredRecord"
    });
    expect(storedGetterCalls).toBe(0);
  });

  it("normalizes a revoked stored Uint8Array payload as a corrupt record", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const revokedPayload = Proxy.revocable(new Uint8Array(encoded.payloadBytes), {});
    revokedPayload.revoke();

    await expect(codec.decodeStoredRecord({
      metadata: metadataFor(encoded),
      payloadBytes: revokedPayload.proxy
    })).rejects.toMatchObject({
      code: "CorruptRecord",
      operation: "decodeStoredRecord"
    });
  });

  it("rejects an oversized ASCII import payload before UTF-8 encoding", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const bundle = {
      ...exportBundleFor(encoded),
      canonicalPayload: "a".repeat(MAX_SAVE_PAYLOAD_BYTES + 1)
    };
    const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode");

    try {
      await expectCode(codec.decodeExportBundle(bundle), "InvalidEnvelope");
      expect(encodeSpy).not.toHaveBeenCalled();
    } finally {
      encodeSpy.mockRestore();
    }
  });

  it("rejects a multi-byte import payload below the character ceiling but above the encoded-byte ceiling", async () => {
    const codec = createSaveCodec(createDefinitionResolutionFixture());
    const encoded = await codec.encode(createSaveGameEnvelopeV1Fixture());
    const canonicalPayload = "é".repeat(Math.floor(MAX_SAVE_PAYLOAD_BYTES / 2) + 1);
    const bundle = {
      ...exportBundleFor(encoded),
      metadata: {
        ...metadataFor(encoded),
        payloadBytes: MAX_SAVE_PAYLOAD_BYTES
      },
      canonicalPayload,
      payloadBytes: MAX_SAVE_PAYLOAD_BYTES
    };
    const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode");

    try {
      expect(canonicalPayload.length).toBeLessThanOrEqual(MAX_SAVE_PAYLOAD_BYTES);
      await expectCode(codec.decodeExportBundle(bundle), "InvalidEnvelope");
      expect(encodeSpy).toHaveBeenCalledOnce();
    } finally {
      encodeSpy.mockRestore();
    }
  });
});
