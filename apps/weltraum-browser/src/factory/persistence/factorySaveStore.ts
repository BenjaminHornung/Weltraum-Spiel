import { IndexedDbSaveRepository, type SaveRepository } from "../../browser-storage";
import { validateSaveGameEnvelopeV1, type SaveGameEnvelopeV1 } from "../../persistence";
import {
  createFactorySaveEnvelopeInput,
  decodeFactoryCheckpointForSave,
  decodeStoredFactoryCheckpoint,
  FACTORY_SAVE_DATABASE,
  FACTORY_SAVE_GAME_VERSION,
  FACTORY_SAVE_SLOT,
  isIssuedFactoryStoredCheckpointPayload,
  readFactoryDecodedOwner,
  type FactoryStoredCheckpoint,
  type FactorySessionCheckpointV2
} from "./factoryCheckpoint";

const gameVersion = FACTORY_SAVE_GAME_VERSION;
const readEnvelope = (envelope: SaveGameEnvelopeV1,retainedCpuBytes=0) => {
  if (envelope.gameVersion !== gameVersion || envelope.player.playerId !== "player:hvp" || envelope.player.activeShipId !== null
    || envelope.player.activeMissionRef !== null || Object.keys(envelope.player.data).join(",") !== "factory"
    || [envelope.ships, envelope.drones, envelope.stations, envelope.bases, envelope.missions, envelope.encounters,
      envelope.discoveries, envelope.definitionsVersionRefs, envelope.worldEvents.events].some(values => values.length !== 0)) {
    throw new Error("Not a combined Factory save");
  }
  const decoded = decodeStoredFactoryCheckpoint(envelope.player.data.factory,retainedCpuBytes);
  const tick = decoded.checkpoint.native.world.tick.ticks;
  if (envelope.universeTime.tick !== tick * 2 || envelope.universeTime.epochSeconds !== tick / 60) throw new Error("Factory/Universe tick mismatch");
  return decoded;
};

/** Factory-only slot on the repository's atomic payload/metadata transaction and CAS. */
export const createFactorySaveStore = (repository: SaveRepository = new IndexedDbSaveRepository([],
  { databaseId: FACTORY_SAVE_DATABASE })) => ({
  initialize: () => repository.initialize(),
  list: () => repository.listSlots(),
  async save(value: FactoryStoredCheckpoint, expectedRevision: number | null, beforeCommit?: () => void) {
    const checkpoint = isIssuedFactoryStoredCheckpointPayload(value) ? value : decodeFactoryCheckpointForSave(value);
    const envelope = validateSaveGameEnvelopeV1(createFactorySaveEnvelopeInput(checkpoint), []);
    return repository.writeSlot({ slotId: FACTORY_SAVE_SLOT, expectedRevision, envelope, lastWriteReason: "ManualSave",
      ...(beforeCommit === undefined ? {} : { beforeCommit }) });
  },
  async load(retainedCpuBytes=0) {
    if(!Number.isSafeInteger(retainedCpuBytes)||retainedCpuBytes<0)throw new Error("Factory checkpoint CPU/decode budget before allocation");
    const saved = await repository.readSlot(FACTORY_SAVE_SLOT);
    const decoded = readEnvelope(saved.envelope,retainedCpuBytes);
    const owner: FactorySessionCheckpointV2 = readFactoryDecodedOwner(decoded);
    return Object.freeze({ decoded, owner, metadata: saved.metadata });
  },
  close: () => repository.close()
});
