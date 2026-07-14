import * as THREE from "three";
import {
  materialProfileSignature,
  type MaterialProfile,
  type MaterialProfileId
} from "../../../presentation";

interface CachedMaterial {
  readonly signature: string;
  readonly material: THREE.Material;
  references: number;
}

export class MaterialProfileConflictError extends Error {
  constructor(readonly profileId: MaterialProfileId) {
    super(`Material profile ${profileId} conflicts with its generation definition`);
    this.name = "MaterialProfileConflictError";
  }
}

export interface ThreeMaterialLease {
  readonly materials: readonly THREE.Material[];
  release(): number;
}

export class ThreeMaterialFactory {
  private readonly cache = new Map<MaterialProfileId, CachedMaterial>();
  private readonly definitions = new Map<MaterialProfileId, string>();
  private allocationCount = 0;
  private disposalCount = 0;

  get allocations(): number {
    return this.allocationCount;
  }

  get disposals(): number {
    return this.disposalCount;
  }

  acquire(profiles: readonly MaterialProfile[]): ThreeMaterialLease {
    const acquired: CachedMaterial[] = [];
    const newDefinitionIds: MaterialProfileId[] = [];
    try {
      for (const profile of profiles) {
        const signature = materialProfileSignature(profile);
        const knownDefinition = this.definitions.get(profile.id);
        if (knownDefinition !== undefined && knownDefinition !== signature) {
          throw new MaterialProfileConflictError(profile.id);
        }
        if (knownDefinition === undefined) {
          this.definitions.set(profile.id, signature);
          newDefinitionIds.push(profile.id);
        }
        const cached = this.cache.get(profile.id);
        if (cached !== undefined) {
          cached.references += 1;
          acquired.push(cached);
          continue;
        }
        const material = this.create(profile);
        const entry: CachedMaterial = { signature, material, references: 1 };
        this.cache.set(profile.id, entry);
        this.allocationCount += 1;
        acquired.push(entry);
      }
    } catch (error) {
      this.releaseEntries(acquired);
      newDefinitionIds.forEach((id) => this.definitions.delete(id));
      throw error;
    }

    let released = false;
    return Object.freeze({
      materials: Object.freeze(acquired.map((entry) => entry.material)),
      release: (): number => {
        if (released) return 0;
        released = true;
        return this.releaseEntries(acquired);
      }
    });
  }

  disposeAll(): number {
    let disposed = 0;
    for (const entry of this.cache.values()) {
      entry.material.dispose();
      disposed += 1;
    }
    this.cache.clear();
    this.definitions.clear();
    this.disposalCount += disposed;
    return disposed;
  }

  private create(profile: MaterialProfile): THREE.Material {
    const parameters: THREE.MeshBasicMaterialParameters = {
      color: new THREE.Color(profile.baseColor.r, profile.baseColor.g, profile.baseColor.b),
      opacity: profile.opacity,
      transparent: profile.opacity < 1,
      side: profile.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      wireframe: profile.kind === "DebugWireframe" || profile.wireframe,
      depthWrite: profile.depthWrite
    };
    return profile.kind === "BasicLit"
      ? new THREE.MeshLambertMaterial(parameters)
      : new THREE.MeshBasicMaterial(parameters);
  }

  private releaseEntries(entries: readonly CachedMaterial[]): number {
    let disposed = 0;
    for (const entry of entries) {
      entry.references -= 1;
      if (entry.references !== 0) continue;
      entry.material.dispose();
      for (const [id, candidate] of this.cache) {
        if (candidate === entry) {
          this.cache.delete(id);
          break;
        }
      }
      disposed += 1;
    }
    this.disposalCount += disposed;
    return disposed;
  }
}
