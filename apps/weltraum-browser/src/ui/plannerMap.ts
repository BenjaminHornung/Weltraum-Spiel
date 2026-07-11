import type { TelemetrySnapshot } from "../sim/telemetry";
import {
  navigationMapOrientation,
  navigationMapViewportState,
  projectNavigationMapPosition,
  rotateNavigationMapPoint,
  type NavigationMapSnapshot,
  type NavigationMapViewportState
} from "../navigation/map";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 1_000;
const VIEW_HEIGHT = 620;
const MAP_MARGIN = 58;
const MIN_FOCUS_SPAN_METERS = 100;
const FOCUS_PADDING_FACTOR = 1.1;
const ZOOM_FACTORS = [1, 1.25, 1.6] as const;
const MIN_METERS_PER_PIXEL = 0.01;
const MAX_METERS_PER_PIXEL = 100_000;

interface MutableViewportState {
  orbit: NavigationMapViewportState["orbit"];
  centerAbsoluteX: number;
  centerAbsoluteZ: number;
  metersPerPixel: number;
  focusMetersPerPixel: number;
  zoomIndex: number;
  initialized: boolean;
}

interface DragState {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

export interface NavigationMapScaleBar {
  readonly metres: number;
  readonly pixels: number;
  readonly label: string;
}

const viewState: MutableViewportState = {
  orbit: "north-up",
  centerAbsoluteX: 0,
  centerAbsoluteZ: 0,
  metersPerPixel: 1,
  focusMetersPerPixel: 1,
  zoomIndex: 0,
  initialized: false
};

let lastTelemetry: TelemetrySnapshot | null = null;
let dragState: DragState | null = null;

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;

const svgElement = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string>
): SVGElementTagNameMap[K] => {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
};

const appendTitle = (element: SVGElement, text: string): void => {
  const title = svgElement("title", {});
  title.textContent = text;
  element.append(title);
};

const appendPositionExtent = (
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  x: number,
  z: number,
  radius = 0
): void => {
  bounds.minX = Math.min(bounds.minX, x - radius);
  bounds.maxX = Math.max(bounds.maxX, x + radius);
  bounds.minZ = Math.min(bounds.minZ, z - radius);
  bounds.maxZ = Math.max(bounds.maxZ, z + radius);
};

export const calculateNavigationMapFocus = (
  snapshot: NavigationMapSnapshot,
  viewportSize = { width: VIEW_WIDTH, height: VIEW_HEIGHT }
): NavigationMapViewportState => {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY
  };
  const add = (position: NavigationMapSnapshot["ship"]["absolutePosition"], radius = 0): void =>
    appendPositionExtent(bounds, position.value.x, position.value.z, radius);

  add(snapshot.ship.absolutePosition);
  snapshot.targets.forEach((target) => add(target.absolutePosition, target.arrivalRadius));
  snapshot.route?.nodes.forEach((node) => add(node.absolutePosition));
  snapshot.route?.segments.forEach((segment) => {
    add(segment.start);
    add(segment.end);
  });
  snapshot.obstacles.forEach((obstacle) => add(obstacle.center, obstacle.radius + obstacle.padding));
  snapshot.entities.forEach((entity) => add(entity.absolutePosition));

  const centerAbsoluteX = (bounds.minX + bounds.maxX) / 2;
  const centerAbsoluteZ = (bounds.minZ + bounds.maxZ) / 2;
  const spanX = Math.max(MIN_FOCUS_SPAN_METERS, bounds.maxX - bounds.minX) * FOCUS_PADDING_FACTOR;
  const spanZ = Math.max(MIN_FOCUS_SPAN_METERS, bounds.maxZ - bounds.minZ) * FOCUS_PADDING_FACTOR;
  const drawableWidth = Math.max(1, viewportSize.width - MAP_MARGIN * 2);
  const drawableHeight = Math.max(1, viewportSize.height - MAP_MARGIN * 2);
  return navigationMapViewportState({
    orbit: viewState.orbit,
    centerAbsoluteX,
    centerAbsoluteZ,
    metersPerPixel: Math.max(spanX / drawableWidth, spanZ / drawableHeight)
  });
};

const scaleStep = (maximumMetres: number): number => {
  const exponent = Math.floor(Math.log10(Math.max(maximumMetres, Number.MIN_VALUE)));
  const power = 10 ** exponent;
  const normalized = maximumMetres / power;
  const multiplier = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return multiplier * power;
};

export const calculateNavigationMapScaleBar = (
  metersPerPixel: number,
  maximumPixels = 140
): NavigationMapScaleBar => {
  const safeMetersPerPixel = Math.max(MIN_METERS_PER_PIXEL, finite(metersPerPixel, 1));
  const metres = scaleStep(safeMetersPerPixel * maximumPixels);
  return Object.freeze({
    metres,
    pixels: metres / safeMetersPerPixel,
    label: metres >= 1_000
      ? `${Number((metres / 1_000).toPrecision(3))} km`
      : `${Number(metres.toPrecision(3))} m`
  });
};

const descendants = (element: Element): Element[] =>
  Array.from(element.children).flatMap((child) => [child, ...descendants(child)]);

export const selectPlannerMapTarget = (targetId: string, root: Document = document): boolean => {
  const options = root.getElementById("planner-target-options");
  if (!options) {
    return false;
  }
  const button = descendants(options).find((candidate) =>
    (candidate as HTMLElement).dataset?.plannerTargetId === targetId
  ) as HTMLButtonElement | undefined;
  if (!button || button.disabled) {
    return false;
  }
  if (typeof button.click === "function") {
    button.click();
  } else {
    (button as unknown as { onclick?: (event?: unknown) => void }).onclick?.({});
  }
  return true;
};

const applyFocus = (snapshot: NavigationMapSnapshot): void => {
  const focused = calculateNavigationMapFocus(snapshot);
  viewState.centerAbsoluteX = focused.centerAbsoluteX;
  viewState.centerAbsoluteZ = focused.centerAbsoluteZ;
  viewState.metersPerPixel = focused.metersPerPixel;
  viewState.focusMetersPerPixel = focused.metersPerPixel;
  viewState.zoomIndex = 0;
  viewState.initialized = true;
};

const currentViewport = (): NavigationMapViewportState => navigationMapViewportState({
  orbit: viewState.orbit,
  centerAbsoluteX: viewState.centerAbsoluteX,
  centerAbsoluteZ: viewState.centerAbsoluteZ,
  metersPerPixel: viewState.metersPerPixel
});

const rerender = (): void => {
  if (lastTelemetry) {
    renderPlannerMap(lastTelemetry);
  }
};

const renderEmptyMap = (viewport: SVGGElement, message: string): void => {
  const label = svgElement("text", {
    x: String(VIEW_WIDTH / 2),
    y: String(VIEW_HEIGHT / 2),
    class: "planner-map-empty",
    "text-anchor": "middle"
  });
  label.textContent = message;
  viewport.replaceChildren(label);
};

const renderScaleBar = (metersPerPixel: number): void => {
  const scale = calculateNavigationMapScaleBar(metersPerPixel);
  const line = document.getElementById("planner-map-scale-line") as HTMLElement | null;
  const label = document.getElementById("planner-map-scale-label") as HTMLOutputElement | null;
  const container = document.getElementById("planner-map-scale") as HTMLElement | null;
  if (line) {
    line.style.width = `${scale.pixels.toFixed(2)}px`;
  }
  if (label) {
    label.value = scale.label;
    label.textContent = scale.label;
  }
  if (container) {
    container.dataset.metres = String(scale.metres);
    container.dataset.pixels = scale.pixels.toFixed(3);
  }
};

const configureMapInteractions = (svg: SVGSVGElement, snapshot: NavigationMapSnapshot): void => {
  svg.setAttribute("tabindex", "-1");
  svg.onpointerdown = (event) => {
    svg.focus();
    dragState = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
    svg.setPointerCapture?.(event.pointerId);
  };
  svg.onpointermove = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - dragState.clientX;
    const deltaY = event.clientY - dragState.clientY;
    viewState.centerAbsoluteX -= deltaX * viewState.metersPerPixel;
    viewState.centerAbsoluteZ += deltaY * viewState.metersPerPixel;
    dragState = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
    rerender();
  };
  const finishDrag = (event: PointerEvent): void => {
    if (dragState?.pointerId === event.pointerId) {
      dragState = null;
      svg.releasePointerCapture?.(event.pointerId);
    }
  };
  svg.onpointerup = finishDrag;
  svg.onpointercancel = finishDrag;
  svg.onwheel = (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const cursorX = rect.width > 0 ? (event.clientX - rect.left) * VIEW_WIDTH / rect.width : VIEW_WIDTH / 2;
    const cursorY = rect.height > 0 ? (event.clientY - rect.top) * VIEW_HEIGHT / rect.height : VIEW_HEIGHT / 2;
    const orientation = navigationMapOrientation(snapshot.ship.orientation, viewState.orbit);
    const relativeBefore = rotateNavigationMapPoint({
      x: (cursorX - VIEW_WIDTH / 2) * viewState.metersPerPixel,
      y: (cursorY - VIEW_HEIGHT / 2) * viewState.metersPerPixel
    }, { x: 0, y: 0 }, -orientation.worldRotationDegrees);
    const anchorAbsoluteX = viewState.centerAbsoluteX + relativeBefore.x;
    const anchorAbsoluteZ = viewState.centerAbsoluteZ - relativeBefore.y;
    const factor = event.deltaY > 0 ? 1.25 : 0.8;
    viewState.metersPerPixel = Math.min(
      MAX_METERS_PER_PIXEL,
      Math.max(MIN_METERS_PER_PIXEL, viewState.metersPerPixel * factor)
    );
    const relativeAfter = rotateNavigationMapPoint({
      x: (cursorX - VIEW_WIDTH / 2) * viewState.metersPerPixel,
      y: (cursorY - VIEW_HEIGHT / 2) * viewState.metersPerPixel
    }, { x: 0, y: 0 }, -orientation.worldRotationDegrees);
    viewState.centerAbsoluteX = anchorAbsoluteX - relativeAfter.x;
    viewState.centerAbsoluteZ = anchorAbsoluteZ + relativeAfter.y;
    rerender();
  };
  svg.onkeydown = (event) => {
    const pan = 40 * viewState.metersPerPixel;
    if (event.key === "ArrowLeft") viewState.centerAbsoluteX -= pan;
    else if (event.key === "ArrowRight") viewState.centerAbsoluteX += pan;
    else if (event.key === "ArrowUp") viewState.centerAbsoluteZ += pan;
    else if (event.key === "ArrowDown") viewState.centerAbsoluteZ -= pan;
    else if (event.key === "+" || event.key === "=") viewState.metersPerPixel = Math.max(MIN_METERS_PER_PIXEL, viewState.metersPerPixel / 1.25);
    else if (event.key === "-" || event.key === "_") viewState.metersPerPixel = Math.min(MAX_METERS_PER_PIXEL, viewState.metersPerPixel * 1.25);
    else if (event.key === "Home") applyFocus(snapshot);
    else return;
    event.preventDefault();
    rerender();
  };
};

const configureButtons = (snapshot: NavigationMapSnapshot): void => {
  const focusButton = document.getElementById("planner-map-focus") as HTMLButtonElement | null;
  const orbitButton = document.getElementById("planner-map-orbit") as HTMLButtonElement | null;
  const zoomButton = document.getElementById("planner-map-zoom") as HTMLButtonElement | null;
  if (focusButton) {
    focusButton.onclick = () => {
      applyFocus(snapshot);
      rerender();
    };
  }
  if (orbitButton) {
    orbitButton.setAttribute("aria-pressed", String(viewState.orbit === "ship-up"));
    orbitButton.dataset.orbit = viewState.orbit;
    orbitButton.onclick = () => {
      viewState.orbit = viewState.orbit === "north-up" ? "ship-up" : "north-up";
      rerender();
    };
  }
  if (zoomButton) {
    const factor = ZOOM_FACTORS[viewState.zoomIndex];
    zoomButton.dataset.zoom = String(factor);
    zoomButton.setAttribute("aria-label", `Cycle map zoom, current ${factor} times`);
    zoomButton.onclick = () => {
      viewState.zoomIndex = (viewState.zoomIndex + 1) % ZOOM_FACTORS.length;
      viewState.metersPerPixel = viewState.focusMetersPerPixel / ZOOM_FACTORS[viewState.zoomIndex];
      rerender();
    };
  }
};

export const renderPlannerMap = (telemetry: TelemetrySnapshot): void => {
  lastTelemetry = telemetry;
  const svg = document.getElementById("planner-route-svg") as SVGSVGElement | null;
  const viewport = document.getElementById("planner-map-viewport") as SVGGElement | null;
  if (!svg || !viewport || typeof document.createElementNS !== "function") {
    return;
  }

  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Runtime local navigation map");
  const snapshot = telemetry.navigationMap;
  if (!snapshot) {
    renderEmptyMap(viewport, "Runtime navigation snapshot unavailable");
    svg.dataset.snapshot = "unavailable";
    return;
  }
  if (!viewState.initialized) {
    applyFocus(snapshot);
  }

  const orientation = navigationMapOrientation(snapshot.ship.orientation, viewState.orbit);
  const viewportState = currentViewport();
  const toMap = (position: NavigationMapSnapshot["ship"]["absolutePosition"]) =>
    projectNavigationMapPosition(position, viewportState, { width: VIEW_WIDTH, height: VIEW_HEIGHT }, orientation.worldRotationDegrees);
  const content = svgElement("g", { class: "planner-map-content", "data-semantic-geometry": "runtime" });

  const entityLayer = svgElement("g", { class: "planner-map-layer planner-map-layer--entities", "data-map-layer": "world-entities" });
  for (const entity of snapshot.entities) {
    const point = toMap(entity.absolutePosition);
    const node = svgElement("circle", {
      cx: point.x.toFixed(3),
      cy: point.y.toFixed(3),
      r: entity.residence === "Full" ? "4" : "3",
      class: `planner-world-entity planner-world-entity--${entity.presentationKey}`,
      "data-world-entity-id": entity.id,
      "data-chunk-id": entity.chunkId,
      "data-residence": entity.residence,
      "data-render-lod": entity.renderLod,
      "data-absolute-x": String(entity.absolutePosition.value.x),
      "data-absolute-z": String(entity.absolutePosition.value.z)
    });
    appendTitle(node, `${entity.id}, ${entity.residence} resident`);
    entityLayer.append(node);
  }
  content.append(entityLayer);

  const obstacleLayer = svgElement("g", { class: "planner-map-layer planner-map-layer--obstacles", "data-map-layer": "obstacles" });
  for (const obstacle of snapshot.obstacles) {
    const center = toMap(obstacle.center);
    const accessibleLabel = `${obstacle.id}, radius ${obstacle.radius.toFixed(1)} metres`;
    const circle = svgElement("circle", {
      cx: center.x.toFixed(3),
      cy: center.y.toFixed(3),
      r: Math.max(1, obstacle.radius / viewportState.metersPerPixel).toFixed(3),
      class: "planner-obstacle",
      "data-obstacle-id": obstacle.id,
      "data-radius-metres": String(obstacle.radius),
      "data-absolute-x": String(obstacle.center.value.x),
      "data-absolute-z": String(obstacle.center.value.z),
      "data-label-visibility": "accessible-only",
      role: "img",
      "aria-label": accessibleLabel
    });
    appendTitle(circle, accessibleLabel);
    obstacleLayer.append(circle);
  }
  content.append(obstacleLayer);

  const routeLayer = svgElement("g", { class: "planner-map-layer planner-map-layer--route", "data-map-layer": "route" });
  for (const segment of snapshot.route?.segments ?? []) {
    const start = toMap(segment.start);
    const end = toMap(segment.end);
    const line = svgElement("line", {
      x1: start.x.toFixed(3),
      y1: start.y.toFixed(3),
      x2: end.x.toFixed(3),
      y2: end.y.toFixed(3),
      class: `planner-route ${segment.kind === "Avoidance" ? "planner-route--avoidance" : "planner-route--primary"}`,
      "data-segment-id": segment.id,
      "data-segment-kind": segment.kind,
      "data-start-x": String(segment.start.value.x),
      "data-start-z": String(segment.start.value.z),
      "data-end-x": String(segment.end.value.x),
      "data-end-z": String(segment.end.value.z)
    });
    appendTitle(line, `${segment.kind} segment, desired speed ${segment.desiredSpeed.toFixed(1)} metres per second`);
    routeLayer.append(line);
  }
  for (const nodeSnapshot of snapshot.route?.nodes ?? []) {
    const point = toMap(nodeSnapshot.absolutePosition);
    routeLayer.append(svgElement("circle", {
      cx: point.x.toFixed(3),
      cy: point.y.toFixed(3),
      r: "5",
      class: "planner-node planner-node--maneuver",
      "data-route-node-id": nodeSnapshot.id,
      "data-absolute-x": String(nodeSnapshot.absolutePosition.value.x),
      "data-absolute-z": String(nodeSnapshot.absolutePosition.value.z)
    }));
  }
  content.append(routeLayer);

  const targetLayer = svgElement("g", { class: "planner-map-layer planner-map-layer--targets", "data-map-layer": "targets" });
  for (const target of snapshot.targets) {
    const point = toMap(target.absolutePosition);
    const selected = target.id === snapshot.selectedTargetId;
    const marker = svgElement("g", {
      class: `planner-target-marker${selected ? " planner-target-marker--selected" : ""}`,
      transform: `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`,
      role: "button",
      tabindex: "-1",
      "aria-label": `Select ${target.label}`,
      "aria-pressed": String(selected),
      "data-target-id": target.id,
      "data-map-object": "target",
      "data-absolute-x": String(target.absolutePosition.value.x),
      "data-absolute-z": String(target.absolutePosition.value.z)
    });
    marker.append(svgElement("path", { d: "M 0 -9 L 9 0 L 0 9 L -9 0 Z", class: "planner-node planner-node--target" }));
    marker.onclick = () => { selectPlannerMapTarget(target.id); };
    marker.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectPlannerMapTarget(target.id);
      }
    };
    appendTitle(marker, `${target.label}, ${target.kind}`);
    targetLayer.append(marker);

    const label = svgElement("text", {
      x: (point.x + 13).toFixed(3),
      y: (point.y - 12).toFixed(3),
      class: `planner-map-runtime-label planner-map-runtime-label--target${selected ? " is-selected" : ""}`,
      "data-target-label-id": target.id
    });
    label.textContent = target.label;
    targetLayer.append(label);
  }
  content.append(targetLayer);

  const shipLayer = svgElement("g", { class: "planner-map-layer planner-map-layer--ship", "data-map-layer": "active-ship" });
  const shipPoint = toMap(snapshot.ship.absolutePosition);
  const shipMarker = svgElement("g", {
    class: `planner-active-ship planner-active-ship--${snapshot.ship.presentation.symbolKey}`,
    transform: `translate(${shipPoint.x.toFixed(3)} ${shipPoint.y.toFixed(3)}) rotate(${orientation.shipMarkerRotationDegrees.toFixed(4)})`,
    "data-map-object": "active-ship",
    "data-ship-id": snapshot.ship.id,
    "data-display-name": snapshot.ship.presentation.displayName,
    "data-blueprint-id": snapshot.ship.presentation.blueprintId,
    "data-visual-id": snapshot.ship.presentation.visualId,
    "data-symbol-key": snapshot.ship.presentation.symbolKey,
    "data-absolute-x": String(snapshot.ship.absolutePosition.value.x),
    "data-absolute-z": String(snapshot.ship.absolutePosition.value.z),
    "data-heading-degrees": orientation.headingDegrees.toFixed(4)
  });
  shipMarker.append(svgElement("path", {
    d: "M 0 -15 L 7 -3 L 13 9 L 3 6 L 0 11 L -3 6 L -13 9 L -7 -3 Z",
    class: "planner-active-ship-symbol"
  }));
  appendTitle(shipMarker, `${snapshot.ship.presentation.displayName}, ${snapshot.ship.presentation.blueprintId}`);
  shipLayer.append(shipMarker);

  const shipName = svgElement("text", {
    x: (shipPoint.x + 16).toFixed(3),
    y: (shipPoint.y - 13).toFixed(3),
    class: "planner-map-runtime-label planner-map-runtime-label--ship"
  });
  shipName.textContent = snapshot.ship.presentation.displayName;
  shipLayer.append(shipName);
  const shipIdentity = svgElement("text", {
    x: (shipPoint.x + 16).toFixed(3),
    y: (shipPoint.y + 3).toFixed(3),
    class: "planner-map-runtime-label planner-map-runtime-label--ship-identity"
  });
  shipIdentity.textContent = `${snapshot.ship.presentation.blueprintId} / ${snapshot.ship.presentation.visualId}`;
  shipLayer.append(shipIdentity);
  content.append(shipLayer);

  viewport.replaceChildren(content);
  configureMapInteractions(svg, snapshot);
  configureButtons(snapshot);
  renderScaleBar(viewportState.metersPerPixel);

  const zoom = viewState.focusMetersPerPixel / viewState.metersPerPixel;
  const zoomLabel = String(Number(zoom.toFixed(4)));
  svg.dataset.snapshot = "ready";
  svg.dataset.snapshotSignature = snapshot.signature;
  svg.dataset.orbit = viewState.orbit;
  svg.dataset.effectiveOrbit = orientation.effectiveOrbit;
  svg.dataset.zoom = zoomLabel;
  svg.dataset.viewScale = zoomLabel;
  svg.dataset.rotationDegrees = orientation.worldRotationDegrees.toFixed(4);
  svg.dataset.headingDegrees = orientation.headingDegrees.toFixed(4);
  svg.dataset.metersPerPixel = viewportState.metersPerPixel.toFixed(8);
  svg.dataset.viewCenter = `${viewportState.centerAbsoluteX.toFixed(3)},${viewportState.centerAbsoluteZ.toFixed(3)}`;
  svg.dataset.mapTransform = `orbit:${orientation.effectiveOrbit};rotation:${orientation.worldRotationDegrees.toFixed(4)};zoom:${zoom.toFixed(4)}`;
  svg.dataset.segmentCount = String(snapshot.route?.segments.length ?? 0);
  svg.dataset.obstacleCount = String(snapshot.obstacles.length);
  svg.dataset.targetCount = String(snapshot.targets.length);
  svg.dataset.entityCount = String(snapshot.entities.length);
  svg.dataset.obstacleLabels = "accessible-only";
};
