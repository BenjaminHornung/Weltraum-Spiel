import { createFp02Fixture } from "../catalog/fp02Catalog";
import { createResourceContainerDefinition, createResourceContainerSnapshot } from "../../resources/containers";
import { createFactoryMaterialView } from "../material/reservations";
import { createFactoryConstruction, type FactoryConstruction } from "../construction/buildStep";
import type { FactoryCatalog } from "../contracts";
import type { FactoryHostPort, FactoryHostExtensionHandle, FactoryHostView } from "./hostPort";

export interface FactorySessionView {
  readonly sessionId: string; readonly epoch: number; readonly catalogDigest: string;
  readonly nativeTick: number; readonly remainderTicks: number; readonly steps: number;
  readonly elapsedMs: number; readonly state: "Ready" | "WaitingForHost" | "RecoveryHold" | "Disposed";
}
export interface FactorySessionHandle extends FactoryHostExtensionHandle {
  readonly construction?:FactoryConstruction;
  read(): FactorySessionView;
  subscribe(listener: (view: FactorySessionView) => void): () => void;
}
const mountedHosts = new WeakSet<FactoryHostPort>();

/** D05: six confirmed native 60-Hz ticks, never browser time or offline time. */
export const mountFactorySession = async (host: FactoryHostPort, catalog: FactoryCatalog): Promise<FactorySessionHandle> => {
  if (!host.current()) throw new Error("Factory requires a current, undisposed host");
  if (mountedHosts.has(host)) throw new Error("Factory already mounted on this host");
  const initial = host.read();
  if (!initial.confirmed || !["Running", "Paused"].includes(initial.physicsStatus) || !Number.isSafeInteger(initial.nativeTick) || initial.nativeTick < 0) {
    throw new Error("Factory requires a confirmed native tick baseline");
  }
  let construction:FactoryConstruction|undefined;
  if(host.construction){
    const native=host.construction,fixture=createFp02Fixture("cargo");
    if(fixture.catalog.canonicalJson!==catalog.canonicalJson)throw new Error("Factory initial Cargo catalog binding mismatch");
    const material=createFactoryMaterialView(catalog,[createResourceContainerSnapshot(createResourceContainerDefinition({containerId:fixture.resourceState.containerId,kind:"ShipCargo",maxMassKg:4000,maxVolumeM3:30,maxStackCount:200}),fixture.resourceState,catalog.resources)]);
    construction=createFactoryConstruction({...native,readPlacementView:()=>({...native.readFacts(),material,installations:[]}),pause:async()=>{await host.pause();}},material);
  }
  // Failed catalog/Resources initialization has not acquired this Host's Factory mount.
  mountedHosts.add(host);
  let disposed = false;
  let view: FactorySessionView = Object.freeze({ sessionId: initial.sessionId, epoch: initial.epoch,
    catalogDigest: catalog.catalogDigest, nativeTick: initial.nativeTick, remainderTicks: 0,
    steps: 0, elapsedMs: 0, state: "Ready" });
  const listeners = new Set<(view: FactorySessionView) => void>();
  const publish = (next: FactorySessionView) => {
    view = Object.freeze(next);
    for (const listener of listeners) listener(view);
  };
  const observe = (confirmed: FactoryHostView) => {
    if (disposed || !host.current() || view.state === "RecoveryHold") return;
    if (["RecoveryHold", "Disposed"].includes(confirmed.physicsStatus) || confirmed.sessionId !== initial.sessionId || confirmed.epoch !== initial.epoch
      || !Number.isSafeInteger(confirmed.nativeTick) || confirmed.nativeTick < view.nativeTick) {
      publish({ ...view, state: "RecoveryHold" }); return;
    }
    if (!confirmed.confirmed || !["Running", "Paused"].includes(confirmed.physicsStatus)) {
      if (view.state !== "WaitingForHost") publish({ ...view, state: "WaitingForHost" });
      return;
    }
    if (confirmed.nativeTick === view.nativeTick) {
      if (view.state === "WaitingForHost") publish({ ...view, state: "Ready" });
      return;
    }
    const ticks = view.remainderTicks + confirmed.nativeTick - view.nativeTick;
    const steps = view.steps + Math.floor(ticks / 6);
    if (!Number.isSafeInteger(ticks) || !Number.isSafeInteger(steps * 100)) {
      publish({ ...view, state: "RecoveryHold" }); return;
    }
    publish({ ...view, state: "Ready", nativeTick: confirmed.nativeTick, remainderTicks: ticks % 6, steps, elapsedMs: steps * 100 });
  };
  let unsubscribe: () => void;
  try { unsubscribe = host.subscribeConfirmed(observe); }
  catch (error) { mountedHosts.delete(host); throw error; }
  return Object.freeze({ ...(construction?{construction}:{}),read: () => view,
    subscribe: (listener: (view: FactorySessionView) => void) => {
      if (disposed) throw new Error("Factory session disposed");
      listeners.add(listener); return () => { listeners.delete(listener); };
    }, isQuiescent: () => !disposed && view.state !== "RecoveryHold" && !construction?.busy,
    // Safe teardown is allowed in terminal recovery; pending publication must finish first.
    canEndSession: () => !disposed && (!construction?.busy || construction.read().state==="RecoveryHold"),
    dispose: async () => {
      if (disposed) return;
      if(construction?.busy&&construction.read().state!=="RecoveryHold")throw new Error("Factory installation is still pending");
      disposed = true;host.construction?.dispose();
      unsubscribe(); listeners.clear(); mountedHosts.delete(host);
      view = Object.freeze({ ...view, state: "Disposed" });
    } });
};
