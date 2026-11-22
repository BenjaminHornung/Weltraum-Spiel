import { bindHvpPhysicsOwner, type HvpPhysicsOwnerPort } from "./physicsWorkerHost";
export type * from "./physicsWorkerHost";

bindHvpPhysicsOwner(globalThis as unknown as HvpPhysicsOwnerPort);
