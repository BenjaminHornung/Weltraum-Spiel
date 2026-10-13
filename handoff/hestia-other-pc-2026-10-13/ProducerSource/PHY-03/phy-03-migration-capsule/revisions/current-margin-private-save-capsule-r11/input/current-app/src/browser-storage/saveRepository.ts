import type { SaveRecordRevision, SaveSlotId } from "./ids";
import type {
  SaveDeleteResult,
  SaveExportBundle,
  SaveImportPolicy,
  SaveListResult,
  SaveReadResult,
  SaveWriteRequest,
  SaveWriteResult
} from "./types";

export interface SaveRepository {
  initialize(): Promise<void>;
  listSlots(): Promise<SaveListResult>;
  readSlot(slotId: SaveSlotId | string): Promise<SaveReadResult>;
  writeSlot(request: SaveWriteRequest): Promise<SaveWriteResult>;
  deleteSlot(
    slotId: SaveSlotId | string,
    expectedRevision: SaveRecordRevision | number
  ): Promise<SaveDeleteResult>;
  exportSlot(slotId: SaveSlotId | string): Promise<SaveExportBundle>;
  importSlot(bundle: unknown, policy: SaveImportPolicy): Promise<SaveWriteResult>;
  close(): Promise<void>;
}
