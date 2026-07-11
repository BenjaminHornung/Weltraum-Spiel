import type { ObstacleDescriptor, Quaternion, RoutePlan, RouteSegment, Vec3 } from "../core";
import type { TelemetrySnapshot } from "../sim/telemetry";

type PlannerMapOrbit = "north-up" | "ship-up";

interface Point2 {
  readonly x: number;
  readonly z: number;
}

interface MapBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 1_000;
const VIEW_HEIGHT = 620;
const MAP_MARGIN = 58;
const ZOOM_FACTORS = [1, 1.25, 1.6] as const;

const viewState: { orbit: PlannerMapOrbit; zoomIndex: number } = {
  orbit: "north-up",
  zoomIndex: 0
};

let lastTelemetry: TelemetrySnapshot | null = null;

const point2 = (value: Vec3): Point2 => ({ x: value.x, z: value.z });

const rotateAround = (point: Point2, origin: Point2, radians: number): Point2 => {
  if (radians === 0) {
    return point;
  }

  const dx = point.x - origin.x;
  const dz = point.z - origin.z;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: origin.x + dx * cosine - dz * sine,
    z: origin.z + dx * sine + dz * cosine
  };
};

const projectedShipForward = (orientation: Quaternion): Point2 => ({
  x: 1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z),
  z: 2 * (orientation.x * orientation.z - orientation.w * orientation.y)
});

const shipUpRotation = (telemetry: TelemetrySnapshot): { readonly radians: number; readonly effectiveOrbit: PlannerMapOrbit } => {
  if (viewState.orbit !== "ship-up") {
    return { radians: 0, effectiveOrbit: "north-up" };
  }

  const forward = projectedShipForward(telemetry.ship.orientation);
  if (Math.hypot(forward.x, forward.z) < 0.0001) {
    return { radians: 0, effectiveOrbit: "north-up" };
  }

  return {
    radians: Math.PI / 2 - Math.atan2(forward.z, forward.x),
    effectiveOrbit: "ship-up"
  };
};

const routePlanFor = (telemetry: TelemetrySnapshot): RoutePlan | null =>
  telemetry.lockedPlan ?? telemetry.routePreview?.plan ?? null;

const targetFor = (telemetry: TelemetrySnapshot) =>
  telemetry.selectedTarget ?? telemetry.lockedPlan?.target ?? telemetry.routePreview?.target ?? null;

const isNonZeroSegment = (segment: RouteSegment): boolean =>
  Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z) > 0.000001;

const calculateBounds = (
  telemetry: TelemetrySnapshot,
  plan: RoutePlan | null,
  obstacles: readonly ObstacleDescriptor[],
  rotate: (point: Point2) => Point2
): MapBounds => {
  const points: Point2[] = [rotate(point2(telemetry.ship.position))];
  const target = targetFor(telemetry);
  if (target) {
    points.push(rotate(point2(target.position)));
  }

  for (const segment of plan?.segments ?? []) {
    if (!isNonZeroSegment(segment)) {
      continue;
    }
    points.push(rotate(point2(segment.start)), rotate(point2(segment.end)));
  }

  for (const obstacle of obstacles) {
    const center = rotate(point2(obstacle.center));
    points.push(
      { x: center.x - obstacle.radius, z: center.z },
      { x: center.x + obstacle.radius, z: center.z },
      { x: center.x, z: center.z - obstacle.radius },
      { x: center.x, z: center.z + obstacle.radius }
    );
  }

  let minX = Math.min(...points.map((point) => point.x));
  let maxX = Math.max(...points.map((point) => point.x));
  let minZ = Math.min(...points.map((point) => point.z));
  let maxZ = Math.max(...points.map((point) => point.z));

  if (maxX - minX < 1) {
    const center = (minX + maxX) / 2;
    minX = center - 0.5;
    maxX = center + 0.5;
  }
  if (maxZ - minZ < 1) {
    const center = (minZ + maxZ) / 2;
    minZ = center - 0.5;
    maxZ = center + 0.5;
  }

  const padX = (maxX - minX) * 0.12;
  const padZ = (maxZ - minZ) * 0.12;
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minZ: minZ - padZ,
    maxZ: maxZ + padZ
  };
};

const svgElement = <K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string>): SVGElementTagNameMap[K] => {
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

export const renderPlannerMap = (telemetry: TelemetrySnapshot): void => {
  lastTelemetry = telemetry;
  const svg = document.getElementById("planner-route-svg") as SVGSVGElement | null;
  const viewport = document.getElementById("planner-map-viewport") as SVGGElement | null;
  if (!svg || !viewport || typeof document.createElementNS !== "function") {
    return;
  }

  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Runtime route preview map");

  const plan = routePlanFor(telemetry);
  const target = targetFor(telemetry);
  const obstacles = telemetry.obstacles ?? [];
  const shipOrigin = point2(telemetry.ship.position);
  const orientation = shipUpRotation(telemetry);
  const rotate = (point: Point2): Point2 => rotateAround(point, shipOrigin, orientation.radians);
  const bounds = calculateBounds(telemetry, plan, obstacles, rotate);
  const extentX = bounds.maxX - bounds.minX;
  const extentZ = bounds.maxZ - bounds.minZ;
  const drawableWidth = VIEW_WIDTH - MAP_MARGIN * 2;
  const drawableHeight = VIEW_HEIGHT - MAP_MARGIN * 2;
  const worldScale = Math.min(drawableWidth / extentX, drawableHeight / extentZ);
  const mapCenterX = (bounds.minX + bounds.maxX) / 2;
  const mapCenterZ = (bounds.minZ + bounds.maxZ) / 2;
  const zoom = ZOOM_FACTORS[viewState.zoomIndex];
  const toMap = (value: Vec3 | Point2): { readonly x: number; readonly y: number } => {
    const rotated = rotate("z" in value ? { x: value.x, z: value.z } : point2(value));
    return {
      x: VIEW_WIDTH / 2 + (rotated.x - mapCenterX) * worldScale,
      y: VIEW_HEIGHT / 2 - (rotated.z - mapCenterZ) * worldScale
    };
  };

  const content = svgElement("g", {
    class: "planner-map-content",
    transform: `translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2}) scale(${zoom}) translate(${-VIEW_WIDTH / 2} ${-VIEW_HEIGHT / 2})`
  });

  for (const obstacle of obstacles) {
    const center = toMap(obstacle.center);
    const accessibleLabel = `${obstacle.id}, radius ${obstacle.radius.toFixed(1)} metres`;
    const circle = svgElement("circle", {
      cx: center.x.toFixed(3),
      cy: center.y.toFixed(3),
      r: Math.max(1, obstacle.radius * worldScale).toFixed(3),
      class: "planner-obstacle",
      "data-obstacle-id": obstacle.id,
      "data-radius-metres": String(obstacle.radius),
      "data-label-visibility": "accessible-only",
      role: "img",
      "aria-label": accessibleLabel
    });
    appendTitle(circle, accessibleLabel);
    content.append(circle);
  }

  const renderedSegments = (plan?.segments ?? []).filter(isNonZeroSegment);
  for (const segment of renderedSegments) {
    const start = toMap(segment.start);
    const end = toMap(segment.end);
    const line = svgElement("line", {
      x1: start.x.toFixed(3),
      y1: start.y.toFixed(3),
      x2: end.x.toFixed(3),
      y2: end.y.toFixed(3),
      class: `planner-route ${segment.kind === "Avoidance" ? "planner-route--avoidance" : "planner-route--primary"}`,
      "data-segment-id": segment.id,
      "data-segment-kind": segment.kind
    });
    appendTitle(line, `${segment.kind} segment, desired speed ${segment.desiredSpeed.toFixed(1)} metres per second`);
    content.append(line);

    const node = svgElement("circle", {
      cx: end.x.toFixed(3),
      cy: end.y.toFixed(3),
      r: "6",
      class: "planner-node planner-node--maneuver",
      "data-segment-end": segment.id
    });
    content.append(node);
  }

  const ship = toMap(telemetry.ship.position);
  const shipNode = svgElement("polygon", {
    points: `${ship.x},${ship.y - 12} ${ship.x - 9},${ship.y + 10} ${ship.x},${ship.y + 5} ${ship.x + 9},${ship.y + 10}`,
    class: "planner-node planner-node--ship",
    "data-map-object": "ship"
  });
  appendTitle(shipNode, "Player ship");
  content.append(shipNode);

  const shipLabel = svgElement("text", {
    x: (ship.x + 14).toFixed(3),
    y: (ship.y - 14).toFixed(3),
    class: "planner-map-runtime-label planner-map-runtime-label--ship"
  });
  shipLabel.textContent = "SHIP";
  content.append(shipLabel);

  if (target) {
    const targetPoint = toMap(target.position);
    const targetNode = svgElement("polygon", {
      points: `${targetPoint.x},${targetPoint.y - 10} ${targetPoint.x + 10},${targetPoint.y} ${targetPoint.x},${targetPoint.y + 10} ${targetPoint.x - 10},${targetPoint.y}`,
      class: "planner-node planner-node--target",
      "data-map-object": "target",
      "data-target-id": target.id
    });
    appendTitle(targetNode, `${target.label}, ${target.kind}`);
    content.append(targetNode);

    const targetLabel = svgElement("text", {
      x: (targetPoint.x + 14).toFixed(3),
      y: (targetPoint.y - 14).toFixed(3),
      class: "planner-map-runtime-label planner-map-runtime-label--target"
    });
    targetLabel.textContent = target.label;
    content.append(targetLabel);
  }

  if (!target && renderedSegments.length === 0 && obstacles.length === 0) {
    renderEmptyMap(viewport, "Select a target to display runtime geometry");
  } else {
    viewport.replaceChildren(content);
  }

  const rotationDegrees = orientation.radians * 180 / Math.PI;
  svg.dataset.orbit = viewState.orbit;
  svg.dataset.effectiveOrbit = orientation.effectiveOrbit;
  svg.dataset.zoom = String(zoom);
  svg.dataset.viewScale = String(zoom);
  svg.dataset.rotationDegrees = rotationDegrees.toFixed(4);
  svg.dataset.worldScale = worldScale.toFixed(6);
  svg.dataset.worldBounds = `${bounds.minX.toFixed(3)},${bounds.minZ.toFixed(3)},${bounds.maxX.toFixed(3)},${bounds.maxZ.toFixed(3)}`;
  svg.dataset.mapTransform = `orbit:${orientation.effectiveOrbit};rotation:${rotationDegrees.toFixed(4)};zoom:${zoom}`;
  svg.dataset.segmentCount = String(renderedSegments.length);
  svg.dataset.obstacleCount = String(obstacles.length);
  svg.dataset.obstacleLabels = "accessible-only";

  const focusButton = document.getElementById("planner-map-focus") as HTMLButtonElement | null;
  const orbitButton = document.getElementById("planner-map-orbit") as HTMLButtonElement | null;
  const zoomButton = document.getElementById("planner-map-zoom") as HTMLButtonElement | null;
  if (focusButton) {
    focusButton.onclick = () => {
      viewState.zoomIndex = 0;
      if (lastTelemetry) {
        renderPlannerMap(lastTelemetry);
      }
    };
  }
  if (orbitButton) {
    orbitButton.setAttribute("aria-pressed", String(viewState.orbit === "ship-up"));
    orbitButton.dataset.orbit = viewState.orbit;
    orbitButton.onclick = () => {
      viewState.orbit = viewState.orbit === "north-up" ? "ship-up" : "north-up";
      if (lastTelemetry) {
        renderPlannerMap(lastTelemetry);
      }
    };
  }
  if (zoomButton) {
    zoomButton.dataset.zoom = String(zoom);
    zoomButton.setAttribute("aria-label", `Cycle map zoom, current ${zoom} times`);
    zoomButton.onclick = () => {
      viewState.zoomIndex = (viewState.zoomIndex + 1) % ZOOM_FACTORS.length;
      if (lastTelemetry) {
        renderPlannerMap(lastTelemetry);
      }
    };
  }
};
