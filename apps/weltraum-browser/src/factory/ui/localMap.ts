import { uiButton, uiText } from "./cargoPanel";

export interface FactoryMapWorldPoint { readonly x: number; readonly z: number }
export interface FactoryMapPoint { readonly east: number; readonly north: number }
export interface FactoryMapFrame {
  readonly id: "factory-start-local-v1";
  readonly profileVersion: string;
  readonly sourceDigest: string;
}
export interface FactoryMapSnapshot {
  readonly sessionId: string;
  readonly epoch: number;
  readonly frame: FactoryMapFrame;
  readonly terrainRevision: number;
  readonly facilityRevision: number;
  readonly bounds: Readonly<{ minEast: number; maxEast: number; minNorth: number; maxNorth: number }>;
  /** Explicit known coverage, supplied by Host. Air is never classified here. */
  readonly knownAreas: readonly Readonly<{ id: string; kind: "ground" | "water" | "edge"; outline: readonly FactoryMapWorldPoint[] }>[];
  /** Outlines are already transformed to world space, including quarter-turns. */
  readonly objects: readonly Readonly<{ id: string; label: string; kind: "wreck" | "installed" | "planned" | "cargo"; outline: readonly FactoryMapWorldPoint[] }>[];
  readonly player: Readonly<{ position: FactoryMapWorldPoint; heading: FactoryMapWorldPoint | null }> | null;
}
export interface FactoryMapMarker extends FactoryMapFrame, FactoryMapPoint { readonly label: string }
/** The closed Factory frame, not a planetary coordinate system. */
export const toFactoryMapPoint = (p: FactoryMapWorldPoint): FactoryMapPoint => ({ east: 12.5 - p.z, north: p.x + 12.25 });
export const fromFactoryMapPoint = (p: FactoryMapPoint): FactoryMapWorldPoint => ({ x: p.north - 12.25, z: 12.5 - p.east });
export const toFactoryMapDirection = (p: FactoryMapWorldPoint): FactoryMapPoint => ({ east: -p.z, north: p.x });
const finitePoint = (p: FactoryMapPoint): boolean => Number.isFinite(p.east) && Number.isFinite(p.north);
const inPolygon = (p: FactoryMapPoint, world: readonly FactoryMapWorldPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = world.length - 1; i < world.length; j = i++) {
    const a = toFactoryMapPoint(world[i]!), b = toFactoryMapPoint(world[j]!);
    if ((a.north > p.north) !== (b.north > p.north) && p.east < (b.east - a.east) * (p.north - a.north) / (b.north - a.north) + a.east) inside = !inside;
  }
  return inside;
};
export const canMarkFactoryMapPoint = (snapshot: FactoryMapSnapshot, p: FactoryMapPoint): boolean => {
  const b = snapshot.bounds;
  return finitePoint(p) && p.east >= b.minEast && p.east <= b.maxEast && p.north >= b.minNorth && p.north <= b.maxNorth &&
    snapshot.knownAreas.some(a => a.kind === "ground" && inPolygon(p, a.outline)) &&
    !snapshot.knownAreas.some(a => a.kind !== "ground" && inPolygon(p, a.outline));
};
export const isFactoryMapMarkerCurrent = (marker: FactoryMapMarker, snapshot: FactoryMapSnapshot): boolean =>
  marker.id === snapshot.frame.id && marker.profileVersion === snapshot.frame.profileVersion && marker.sourceDigest === snapshot.frame.sourceDigest &&
  typeof marker.label === "string" && marker.label.length > 0 && marker.label.length <= 80 && canMarkFactoryMapPoint(snapshot, marker);

const svgNS = "http://www.w3.org/2000/svg";
export const mountFactoryLocalMap = (doc: Document = document) => {
  const element = doc.createElement("section"); element.className = "factory-local-map";
  const status = uiText(doc, "p", "Keine bestätigte Kartenquelle verfügbar."); status.setAttribute("role", "status");
  const svg = doc.createElementNS(svgNS, "svg"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Lokale Karte des bekannten Startgeländes, Norden oben");
  const background = doc.createElementNS(svgNS, "g"), dynamic = doc.createElementNS(svgNS, "g"); svg.append(background, dynamic);
  const label = doc.createElement("input"); label.type = "text"; label.value = "Arbeitsstelle"; label.maxLength = 80; label.setAttribute("aria-label", "Name des Zielmarkers");
  const legend = uiText(doc, "p", "N ↑ · Boden bekannt · Wasser · Kante · gestrichelt: Bau geplant · dunkler Bereich: unbekannt");
  const note = uiText(doc, "p", "Zielmarker dienen der Orientierung. Die Karte bestätigt keine Schwerlastfreigabe und steuert keine Bewegung.");
  let snapshot: FactoryMapSnapshot | null = null, key = "", disposed = false;
  let markers: FactoryMapMarker[] = [];
  let viewport = { east: 0, north: 0, width: 20, height: 12 };
  const viewbox = () => svg.setAttribute("viewBox", `${viewport.east} ${-viewport.north - viewport.height} ${viewport.width} ${viewport.height}`);
  const make = (tag: "polygon" | "circle" | "line" | "text", className: string) => { const node = doc.createElementNS(svgNS, tag); node.setAttribute("class", className); return node; };
  const drawObject = (object: FactoryMapSnapshot["objects"][number], layer: SVGGElement) => {
    const node = make("polygon", `factory-map-${object.kind}`); node.setAttribute("points", object.outline.map(toFactoryMapPoint).map(p => `${p.east},${-p.north}`).join(" "));
    const title = doc.createElementNS(svgNS, "title"); title.textContent = object.label; node.append(title); layer.append(node);
    if (object.outline[0]) { const p = toFactoryMapPoint(object.outline[0]), text = make("text", "factory-map-label"); text.setAttribute("x", String(p.east)); text.setAttribute("y", String(-p.north)); text.textContent = object.label; layer.append(text); }
  };
  const drawDynamic = () => {
    dynamic.replaceChildren();
    if (!snapshot) return;
    // Ghost selection/move/cancel and cargo movement do not commit facilities.
    for (const object of snapshot.objects) if (object.kind === "planned" || object.kind === "cargo") drawObject(object, dynamic);
    for (const marker of markers) {
      if (!isFactoryMapMarkerCurrent(marker, snapshot)) continue;
      const node = make("circle", "factory-map-target"); node.setAttribute("cx", String(marker.east)); node.setAttribute("cy", String(-marker.north)); node.setAttribute("r", ".22");
      const text = make("text", "factory-map-label"); text.setAttribute("x", String(marker.east + .3)); text.setAttribute("y", String(-marker.north)); text.textContent = marker.label;
      dynamic.append(node, text);
    }
    if (snapshot.player) {
      const p = toFactoryMapPoint(snapshot.player.position);
      if (!finitePoint(p)) return;
      const node = make("circle", "factory-map-player"); node.setAttribute("cx", String(p.east)); node.setAttribute("cy", String(-p.north)); node.setAttribute("r", ".2"); dynamic.append(node);
      if (snapshot.player.heading) {
        const d = toFactoryMapDirection(snapshot.player.heading), size = Math.hypot(d.east, d.north);
        if (Number.isFinite(size) && size > 0) {
          const heading = make("line", "factory-map-heading"); heading.setAttribute("x1", String(p.east)); heading.setAttribute("y1", String(-p.north));
          heading.setAttribute("x2", String(p.east + d.east / size)); heading.setAttribute("y2", String(-p.north - d.north / size)); dynamic.append(heading);
        }
      }
    }
  };
  const setMarker = (point: FactoryMapPoint, name: string): boolean => {
    if (disposed || !snapshot || !canMarkFactoryMapPoint(snapshot, point) || !name.trim() || name.trim().length > 80) { status.textContent = "Marker nur auf bestätigtem bekanntem Boden setzen."; return false; }
    markers = [Object.freeze({ ...snapshot.frame, ...point, label: name.trim() })]; drawDynamic(); status.textContent = `Ziel markiert: ${name.trim()}`; return true;
  };
  const controls = doc.createElement("div"); controls.className = "factory-map-controls";
  const zoom = (factor: number) => { const width = Math.min(80, Math.max(2, viewport.width * factor)), height = width * viewport.height / viewport.width;
    viewport = { east: viewport.east + (viewport.width - width) / 2, north: viewport.north + (viewport.height - height) / 2, width, height }; viewbox(); };
  controls.append(uiButton(doc, "Vergrößern", () => zoom(.75)), uiButton(doc, "Verkleinern", () => zoom(1.25)));
  for (const [text, dx, dy] of [["Karte nach Westen", -1, 0], ["Karte nach Osten", 1, 0], ["Karte nach Norden", 0, 1], ["Karte nach Süden", 0, -1]] as const)
    controls.append(uiButton(doc, text, () => { viewport = { ...viewport, east: viewport.east + dx * viewport.width / 4, north: viewport.north + dy * viewport.height / 4 }; viewbox(); }));
  const mark = uiButton(doc, "Kartenmitte markieren", () => { setMarker({ east: viewport.east + viewport.width / 2, north: viewport.north + viewport.height / 2 }, label.value); });
  const clear = uiButton(doc, "Zielmarker entfernen", () => { markers = []; drawDynamic(); status.textContent = "Zielmarker entfernt."; }); controls.append(label, mark, clear);
  const onClick = (event: MouseEvent) => {
    const rect = svg.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    // SVG aspect-ratio preservation is disabled so pointer mapping stays exact.
    setMarker({ east: viewport.east + (event.clientX - rect.left) / rect.width * viewport.width,
      north: viewport.north + viewport.height - (event.clientY - rect.top) / rect.height * viewport.height }, label.value);
  };
  svg.setAttribute("preserveAspectRatio", "none"); svg.addEventListener("click", onClick);
  element.append(uiText(doc, "h2", "Lokale Karte"), status, svg, legend, controls, note);
  return {
    element, setMarker,
    update(next: FactoryMapSnapshot | null): void {
      if (disposed) return;
      snapshot = next; mark.disabled = !next; clear.disabled = !next;
      if (!next) { key = ""; background.replaceChildren(); dynamic.replaceChildren(); status.textContent = "Keine bestätigte Kartenquelle verfügbar."; return; }
      const b = next.bounds;
      if (![b.minEast, b.maxEast, b.minNorth, b.maxNorth].every(Number.isFinite) || b.maxEast <= b.minEast || b.maxNorth <= b.minNorth) {
        snapshot = null; key = ""; background.replaceChildren(); dynamic.replaceChildren(); mark.disabled = true; status.textContent = "Kartenquelle enthält keine gültige begrenzte Fläche."; return;
      }
      const nextKey = JSON.stringify([next.sessionId, next.epoch, next.frame, next.terrainRevision, next.facilityRevision, b]);
      if (nextKey !== key) {
        key = nextKey; viewport = { east: b.minEast, north: b.minNorth, width: b.maxEast - b.minEast, height: b.maxNorth - b.minNorth }; viewbox(); background.replaceChildren();
        for (const area of next.knownAreas) {
          const node = make("polygon", `factory-map-${area.kind}`); node.setAttribute("points", area.outline.map(toFactoryMapPoint).map(p => `${p.east},${-p.north}`).join(" ")); background.append(node);
        }
        for (const object of next.objects) if (object.kind === "wreck" || object.kind === "installed") drawObject(object, background);
        markers = markers.filter(m => isFactoryMapMarkerCurrent(m, next));
      }
      status.textContent = next.player ? "Bestätigtes Startgelände · Standort bestätigt" : "Bestätigtes Startgelände · Standort noch nicht bestätigt"; drawDynamic();
    },
    readMarkers: (): readonly FactoryMapMarker[] => Object.freeze(markers.map(m => Object.freeze({ ...m }))),
    restoreMarkers(values: readonly FactoryMapMarker[]): void { markers = snapshot ? values.slice(0, 1).filter(m => isFactoryMapMarkerCurrent(m, snapshot!)).map(m => Object.freeze({ ...m })) : []; drawDynamic(); },
    dispose(): void { if (disposed) return; disposed = true; svg.removeEventListener("click", onClick); element.remove(); }
  };
};
