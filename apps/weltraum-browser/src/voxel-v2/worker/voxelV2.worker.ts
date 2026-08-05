import { executeVoxelV2WorkerRequest } from "./runtime";
import { workerResponseTransferList, type VoxelV2WorkerResponse } from "./protocol";

interface VoxelV2WorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: VoxelV2WorkerResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as VoxelV2WorkerScope;

scope.onmessage = (event): void => {
  const response = executeVoxelV2WorkerRequest(event.data);
  scope.postMessage(response, workerResponseTransferList(response));
};
