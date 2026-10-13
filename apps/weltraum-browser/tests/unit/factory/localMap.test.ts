import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FactoryMapFrame, FactoryMapSnapshot } from "../../../src/factory/ui/localMap";

const modulePath = "../../../src/factory/ui/localMap";
const load = async (): Promise<typeof import("../../../src/factory/ui/localMap") | null> => existsSync(new URL("../../../src/factory/ui/localMap.ts", import.meta.url)) ? await import(modulePath) : null;
const frame: FactoryMapFrame = { id: "factory-start-local-v1", profileVersion: "hvp-factory-startsite-v1", sourceDigest: "source_a" };
const snapshot = (): FactoryMapSnapshot => ({ sessionId: "map_session", epoch: 2, frame, terrainRevision: 3, facilityRevision: 4,
  bounds: { minEast: 0, maxEast: 20, minNorth: 0, maxNorth: 12 },
  knownAreas: [{ id: "known_floor", kind: "ground", outline: [{ x: -12.25, z: 12.5 }, { x: -12.25, z: 8.5 }, { x: -8.25, z: 8.5 }, { x: -8.25, z: 12.5 }] }], objects: [], player: null });

class MapElement extends EventTarget {
  readonly children: MapElement[] = [];
  readonly attributes = new Map<string, string>();
  textContent = ""; className = ""; value = ""; type = ""; maxLength = 0; disabled = false;
  append(...values: MapElement[]): void { this.children.push(...values); }
  replaceChildren(...values: MapElement[]): void { this.children.length = 0; this.append(...values); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  remove(): void {}
}
const mapDoc = () => ({ createElement: () => new MapElement(), createElementNS: () => new MapElement() }) as unknown as Document;
const descendants = (node: MapElement): MapElement[] => [node, ...node.children.flatMap(descendants)];
const outline = (root: HTMLElement, kind: string) => descendants(root as unknown as MapElement).find(n => n.attributes.get("class") === `factory-map-${kind}`)?.attributes.get("points");

describe("source-bound local map", () => {
  it("provides a read-only compact map of the same confirmed coverage", async () => {
    const module = await load(), map = module!.mountFactoryLocalMap(mapDoc(), { compact: true });
    map.update(snapshot());
    const nodes = descendants(map.element as unknown as MapElement);
    expect(nodes.some(n => n.attributes.get("aria-label") === "Minimap of known starting terrain, north up")).toBe(true);
    expect(nodes.some(n => n.textContent === "Mark map centre")).toBe(false);
    expect(outline(map.element, "ground")).toBe("0,0 4,0 4,-4 0,-4");
    expect(map.readMarkers()).toEqual([]);
    map.dispose();
  });
  it("uses the Factory frame for player, heading and already-transformed footprints", async () => {
    const map = await load();
    expect(map?.toFactoryMapPoint({ x: -6.25, z: -2.5 })).toEqual({ east: 15, north: 6 });
    expect(map?.toFactoryMapDirection({ x: 0, z: -1 })).toEqual({ east: 1, north: 0 });
    expect(map?.fromFactoryMapPoint({ east: 15, north: 6 })).toEqual({ x: -6.25, z: -2.5 });
  });

  it("does not treat unknown coverage as available ground", async () => {
    const map = await load();
    expect(map?.canMarkFactoryMapPoint(snapshot(), { east: 10, north: 6 })).toBe(false);
    expect(map?.canMarkFactoryMapPoint(snapshot(), { east: 2, north: 2 })).toBe(true);
  });

  it("rejects marker coordinates from a different source generation", async () => {
    const map = await load();
    const marker = { ...frame, east: 2, north: 2, label: "Arbeitsstelle" };
    expect(map?.isFactoryMapMarkerCurrent(marker, snapshot())).toBe(true);
    expect(map?.isFactoryMapMarkerCurrent(marker, { ...snapshot(), frame: { ...frame, sourceDigest: "source_b" } })).toBe(false);
  });

  it.each(["planned", "cargo"] as const)("adds, moves and removes %s outlines without a facility revision change", async kind => {
    const module = await load(), map = module?.mountFactoryLocalMap(mapDoc());
    const base = snapshot(), original = base.knownAreas[0]!.outline;
    const object = { id: "moving_object", label: "Vorschau oder Last", kind, outline: original };
    map?.update(base);
    map?.update({ ...base, objects: [object] });
    expect(map && outline(map.element, kind)).toBe("0,0 4,0 4,-4 0,-4");
    map?.update({ ...base, objects: [{ ...object, outline: original.map(p => ({ ...p, x: p.x + 1 })) }] });
    expect(map && outline(map.element, kind)).toBe("0,-1 4,-1 4,-5 0,-5");
    map?.update(base);
    expect(map && outline(map.element, kind)).toBeUndefined();
    map?.dispose();
  });

  it("recovers the known background after invalid bounds without changing source revisions", async () => {
    const module = await load(), map = module?.mountFactoryLocalMap(mapDoc()), base = snapshot();
    map?.update(base);
    map?.update({ ...base, bounds: { ...base.bounds, maxEast: 0 } });
    expect(map && outline(map.element, "ground")).toBeUndefined();
    map?.update(base);
    expect(map && outline(map.element, "ground")).toBe("0,0 4,0 4,-4 0,-4");
    map?.dispose();
  });
});
