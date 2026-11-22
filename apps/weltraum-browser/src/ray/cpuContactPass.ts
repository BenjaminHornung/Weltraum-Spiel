import type { ThreeSubmittedFrameMetadata, ThreeSubmittedFrameSource } from "../render/three/backend/threeRenderBackend";
import { BvhRayBackend } from "./rt02a/backend";
import type { Binding, Ray, RayResult, Volume } from "./rt02a/types.mts";
import { assertCurrent, assertExclusiveOwners } from "./rt02a/validate.mts";

export type { Binding, Ray, RayResult, Volume } from "./rt02a/types.mts";

/** The source owner supplies current membership and the G1 coordinate frame for the volume poses. */
export interface RaySceneBinding {
  readonly coordinateFrameId: string;
  readonly projectionRevision: number;
  readonly owners: readonly Binding[];
}

export type ContactSample =
  | { readonly kind: "RasterFallback"; readonly reason: "Disabled" | "Stale" | "Unavailable" }
  | { readonly kind: "RasterFallback"; readonly reason: "Unknown" | "BudgetExceeded"; readonly result: RayResult }
  | { readonly kind: "Contact"; readonly occluded: boolean; readonly result: RayResult };

const priority = { Unknown: 0, BudgetExceeded: 1, Hit: 2, Miss: 3 } as const;

function matches(bindings: readonly Binding[], scene: RaySceneBinding | undefined): boolean {
  if (!scene || bindings.length !== scene.owners.length) return false;
  const live = new Map(scene.owners.map(binding => [binding.owner, binding]));
  if (live.size !== bindings.length) return false;
  try {
    return bindings.every(binding => {
      const current = live.get(binding.owner);
      if (!current) return false;
      assertCurrent(binding, current);
      return true;
    });
  } catch {
    return false;
  }
}

/** Owns CPU presentation projections only. The caller supplies its contact ray in the submitted frame.
 * The closest result across exclusive owners wins. Each owner evaluates the supplied traversal budget. */
export class CpuContactPass {
  private enabled = false;
  private closed = false;
  private serial = 0;
  private ready: readonly Binding[] | undefined;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly backends = new Map<string, BvhRayBackend>();

  constructor(private readonly frames: ThreeSubmittedFrameSource, private readonly readScene: () => RaySceneBinding | undefined) {}

  setEnabled(enabled: boolean): void {
    if (this.closed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.release();
  }

  /** Call after a source change. Queueing this operation immediately invalidates old lighting. */
  refresh(volumes: readonly Volume[]): Promise<boolean> {
    if (!this.enabled || this.closed) return Promise.resolve(false);
    const serial = ++this.serial;
    this.ready = undefined;
    if (!volumes.length) {
      this.release();
      return Promise.resolve(false);
    }
    const run = async () => {
      try { return await this.adopt(serial, volumes); }
      catch (error) {
        if (serial !== this.serial) return false;
        throw error;
      }
    };
    const operation = this.pending.then(run, run);
    this.pending = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async adopt(serial: number, volumes: readonly Volume[]): Promise<boolean> {
    if (this.serial !== serial) return false;
    const bindings = volumes.map(volume => volume.binding);
    if (!matches(bindings, this.readScene())) return false;
    if (new Set(bindings.map(b => b.owner)).size !== bindings.length) throw new Error("Duplicate ray owner");
    assertExclusiveOwners([...volumes]);
    const membership = new Set(bindings.map(b => b.owner));
    for (const [owner, backend] of this.backends) {
      if (!membership.has(owner)) {
        backend.dispose();
        this.backends.delete(owner);
      }
    }
    for (const volume of volumes) {
      let backend = this.backends.get(volume.binding.owner);
      if (backend) {
        const old = backend.snapshot().binding;
        // World/session/authority changes establish a new geometry lineage even if cell bytes match.
        if (old.domain !== volume.binding.domain || old.world !== volume.binding.world ||
            old.session !== volume.binding.session || old.epoch !== volume.binding.epoch ||
            old.algorithm !== volume.binding.algorithm) {
          backend.dispose();
          this.backends.delete(volume.binding.owner);
          backend = undefined;
        }
      }
      if (backend) {
        await backend.update(volume, volume.binding);
      } else {
        backend = new BvhRayBackend();
        try {
          await backend.prepare(volume, volume.binding);
          if (serial !== this.serial) { backend.dispose(); return false; }
          this.backends.set(volume.binding.owner, backend);
        } catch (error) {
          backend.dispose();
          throw error;
        }
      }
      // The source oracle retains diagnostic histories. Per-frame projections do not consume them.
      backend.costs.buildMs.length = 0;
      backend.costs.transformMs.length = 0;
      if (serial !== this.serial) return false;
    }
    const adopted = [...this.backends.values()].map(backend => backend.snapshot().binding);
    if (!matches(adopted, this.readScene())) return false;
    this.ready = adopted;
    return true;
  }

  private current(frame: ThreeSubmittedFrameMetadata, bindings: readonly Binding[]): boolean {
    const scene = this.readScene();
    return this.frames.isSubmittedFrameCurrent(frame) && !!scene &&
      frame.coordinateFrameId === scene.coordinateFrameId && frame.projectionRevision === scene.projectionRevision &&
      matches(bindings, scene) && this.ready === bindings;
  }

  /** Recheck the same submitted frame and complete owner membership before publishing a composed tile. */
  canPublish(frame: ThreeSubmittedFrameMetadata): boolean {
    const bindings = this.ready;
    return !!bindings && this.enabled && !this.closed && this.current(frame, bindings);
  }

  sample(frame: ThreeSubmittedFrameMetadata | undefined, ray: Ray): ContactSample {
    if (!this.enabled || this.closed) return { kind: "RasterFallback", reason: "Disabled" };
    const bindings = this.ready;
    if (!bindings || !frame) return { kind: "RasterFallback", reason: "Unavailable" };
    if (this.frames.readSubmittedFrameMetadata() !== frame || !this.current(frame, bindings)) {
      return { kind: "RasterFallback", reason: "Stale" };
    }
    let first: RayResult | undefined;
    for (const binding of bindings) {
      const backend = this.backends.get(binding.owner)!;
      const next = backend.query(ray, binding, "AnyHit");
      backend.costs.queryMs.length = 0;
      if (!first || next.distance < first.distance || (next.distance === first.distance &&
          (priority[next.kind] < priority[first.kind] ||
           (next.kind === first.kind && (next.owner ?? "") < (first.owner ?? ""))))) first = next;
    }
    if (!first || !this.current(frame, bindings)) return { kind: "RasterFallback", reason: "Stale" };
    if (first.kind === "Unknown" || first.kind === "BudgetExceeded") {
      return { kind: "RasterFallback", reason: first.kind, result: first };
    }
    return { kind: "Contact", occluded: first.kind === "Hit", result: first };
  }

  private release(): void {
    ++this.serial;
    this.ready = undefined;
    for (const backend of this.backends.values()) backend.dispose();
    this.backends.clear();
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.release();
  }
}
