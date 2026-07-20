import type { HestiaVoxelSizeMeters } from "../world-generation/hestia";
import type { SurfaceLabCameraMode, SurfaceLabCameraPose } from "./surfaceLabCamera";
import type { SurfaceLabPresentationState } from "./surfaceLabEnvironment";
import type { SurfaceLabTelemetrySnapshot } from "./surfaceLabTelemetry";

export interface SurfaceLabFrameTimeSample {
  readonly averageMilliseconds: number;
  readonly sampleCount: number;
  readonly complete: boolean;
}

export interface SurfaceLabFrameTimeSampler {
  push(deltaMilliseconds: number, settled: boolean): SurfaceLabFrameTimeSample;
  reset(): void;
}

export interface SurfaceLabHudActions {
  resetCamera(): void;
  setCameraMode(mode: SurfaceLabCameraMode): void;
  setFogEnabled(enabled: boolean): void;
  setWaterEnabled(enabled: boolean): void;
  setVegetationEnabled(enabled: boolean): void;
  setWireframeEnabled(enabled: boolean): void;
  setBoundariesEnabled(enabled: boolean): void;
  regenerate(seed: string): Promise<unknown>;
  setResolution(voxelSizeMeters: HestiaVoxelSizeMeters): Promise<unknown>;
}

export interface SurfaceLabHudOptions {
  readonly host: HTMLElement;
  readonly actions: SurfaceLabHudActions;
  readonly presentationState: SurfaceLabPresentationState;
  readonly cameraPose: SurfaceLabCameraPose;
  readonly documentPort?: Pick<Document, "createElement" | "body">;
}

export interface SurfaceLabHud {
  update(snapshot: SurfaceLabTelemetrySnapshot, frameTime: SurfaceLabFrameTimeSample, cameraPose: SurfaceLabCameraPose): void;
  dispose(): void;
}

const FRAME_SAMPLE_SIZE = 300;

export const clearSurfaceLabDataset = (body: HTMLElement): void => {
  for (const key of Object.keys(body.dataset)) {
    if (key.startsWith("surfaceLab")) delete body.dataset[key];
  }
};

export const createSurfaceLabFrameTimeSampler = (): SurfaceLabFrameTimeSampler => {
  const samples: number[] = [];
  const snapshot = (): SurfaceLabFrameTimeSample => Object.freeze({
    averageMilliseconds: samples.length === 0 ? 0 : samples.reduce((sum, value) => sum + value, 0) / samples.length,
    sampleCount: samples.length,
    complete: samples.length === FRAME_SAMPLE_SIZE
  });
  return {
    push(deltaMilliseconds, settled) {
      if (!settled) {
        samples.length = 0;
        return snapshot();
      }
      if (Number.isFinite(deltaMilliseconds) && deltaMilliseconds > 0 && deltaMilliseconds < 1_000) {
        samples.push(deltaMilliseconds);
        if (samples.length > FRAME_SAMPLE_SIZE) samples.shift();
      }
      return snapshot();
    },
    reset() { samples.length = 0; }
  };
};

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const formatInteger = (value: number): string => integerFormatter.format(value);
const formatMilliseconds = (value: number): string => `${value.toFixed(2)} ms`;
const formatBytes = (value: number): string => value < 1_024
  ? `${value} B`
  : value < 1_048_576
    ? `${(value / 1_024).toFixed(1)} KiB`
    : `${(value / 1_048_576).toFixed(1)} MiB`;
const formatVector = (value: Readonly<{ x: number; y: number; z: number }>, digits = 1): string =>
  `${value.x.toFixed(digits)}, ${value.y.toFixed(digits)}, ${value.z.toFixed(digits)}`;

const riskFor = (snapshot: SurfaceLabTelemetrySnapshot): string => {
  if (snapshot.lifecycle === "Failed" || snapshot.failedChunks > 0) return "Risk: generation failures are visible";
  if (snapshot.staleRejects > 0) return "Risk: stale worker results rejected";
  if (snapshot.lifecycle !== "Ready") return "Risk: terrain generation incomplete";
  return "Risk: presentation only; no gameplay authority";
};

const nextActionFor = (snapshot: SurfaceLabTelemetrySnapshot): string => {
  if (snapshot.lifecycle === "Failed") return "Next: regenerate or inspect worker telemetry";
  if (snapshot.lifecycle === "Ready") return "Next: inspect terrain or compare presentation layers";
  return "Next: wait for deterministic generation to settle";
};

const warningFor = (snapshot: SurfaceLabTelemetrySnapshot): string => {
  const warnings: string[] = [];
  if (snapshot.failedChunks > 0) warnings.push(`${snapshot.failedChunks} chunk job(s) failed`);
  if (snapshot.staleRejects > 0) warnings.push(`${snapshot.staleRejects} stale result(s) rejected`);
  if (snapshot.cancelledJobs > 0) warnings.push(`${snapshot.cancelledJobs} job(s) cancelled`);
  if (warnings.length === 0) {
    return snapshot.lifecycle === "Ready" ? "No active generation warnings." : "Generation is still in progress.";
  }
  return warnings.join("; ");
};

const projectTelemetryData = (
  body: HTMLElement,
  snapshot: SurfaceLabTelemetrySnapshot,
  frameTime: SurfaceLabFrameTimeSample,
  cameraPose: SurfaceLabCameraPose
): void => {
  const data = body.dataset;
  data.surfaceLab = "1";
  data.surfaceLabState = snapshot.lifecycle;
  data.surfaceLabSeed = snapshot.seed;
  data.surfaceLabPreset = snapshot.presetId;
  data.surfaceLabVoxelSize = String(snapshot.voxelSizeMeters);
  data.surfaceLabExtent = `${snapshot.regionExtentMeters.x}x${snapshot.regionExtentMeters.y}x${snapshot.regionExtentMeters.z}`;
  data.surfaceLabRequested = String(snapshot.requestedChunks);
  data.surfaceLabReady = String(snapshot.readyChunks);
  data.surfaceLabFailed = String(snapshot.failedChunks);
  data.surfaceLabCancelled = String(snapshot.cancelledJobs);
  data.surfaceLabStaleRejects = String(snapshot.staleRejects);
  data.surfaceLabQueue = String(snapshot.workerQueueDepth);
  data.surfaceLabRunning = String(snapshot.runningWorkers);
  data.surfaceLabWorkerRestarts = String(snapshot.workerRestarts);
  data.surfaceLabPlanningEpoch = String(snapshot.planningEpoch);
  data.surfaceLabWorkerEpoch = String(snapshot.latestWorkerEpoch);
  data.surfaceLabVertices = String(snapshot.vertices);
  data.surfaceLabTriangles = String(snapshot.triangles);
  data.surfaceLabMeshBytes = String(snapshot.meshBytes);
  data.surfaceLabGenerationMilliseconds = String(snapshot.generationMilliseconds);
  data.surfaceLabMeshingMilliseconds = String(snapshot.meshingMilliseconds);
  data.surfaceLabUploadMilliseconds = String(snapshot.uploadMilliseconds);
  data.surfaceLabFrameMilliseconds = String(frameTime.averageMilliseconds);
  data.surfaceLabFrameSampleCount = String(frameTime.sampleCount);
  data.surfaceLabCacheHits = String(snapshot.cacheHits);
  data.surfaceLabCacheMisses = String(snapshot.cacheMisses);
  data.surfaceLabCacheBypasses = String(snapshot.cacheBypasses);
  data.surfaceLabBrickHashes = snapshot.brickHashes.join(",");
  data.surfaceLabHashes = snapshot.meshHashes.join(",");
  data.surfaceLabBodyId = snapshot.bodyId;
  data.surfaceLabSystemFrameId = snapshot.systemFrameId;
  data.surfaceLabBodyInertialFrameId = snapshot.bodyInertialFrameId;
  data.surfaceLabBodyFixedFrameId = snapshot.bodyFixedFrameId;
  data.surfaceLabFrameId = snapshot.surfaceFrameId;
  data.surfaceLabUniverseTick = String(snapshot.universeTick);
  data.surfaceLabUniverseEpochSeconds = String(snapshot.universeEpochSeconds);
  data.surfaceLabCameraMode = cameraPose.mode;
  data.surfaceLabCameraPosition = formatVector(cameraPose.position, 4);
  data.surfaceLabCameraTarget = formatVector(cameraPose.target, 4);
  data.surfaceLabCameraQuaternion = `${cameraPose.quaternion.x.toFixed(6)}, ${cameraPose.quaternion.y.toFixed(6)}, ${cameraPose.quaternion.z.toFixed(6)}, ${cameraPose.quaternion.w.toFixed(6)}`;
  data.surfaceLabWarnings = warningFor(snapshot);
  data.surfaceLabRendererResize = "camera-and-css-only-private-renderer-drawing-buffer-fixed";
};

export const createSurfaceLabHud = (options: SurfaceLabHudOptions): SurfaceLabHud => {
  const documentPort = options.documentPort ?? document;
  const root = documentPort.createElement("section");
  root.id = "surface-lab-hud";
  root.className = "surface-lab-hud";
  root.setAttribute("aria-label", "Hestia Surface Lab controls and telemetry");

  const modeBar = documentPort.createElement("header");
  modeBar.className = "surface-lab-mode-bar";
  const modeTitle = documentPort.createElement("strong");
  modeTitle.textContent = "SURFACE LAB";
  const provingGround = documentPort.createElement("span");
  provingGround.textContent = "TECHNICAL PROVING GROUND";
  const notGameplay = documentPort.createElement("span");
  notGameplay.className = "surface-lab-not-gameplay";
  notGameplay.textContent = "NOT GAMEPLAY";
  const queryLabel = documentPort.createElement("code");
  queryLabel.textContent = "surfaceLab=1";
  modeBar.append(modeTitle, provingGround, notGameplay, queryLabel);

  const summary = documentPort.createElement("section");
  summary.className = "surface-lab-summary";
  summary.setAttribute("aria-label", "Inspection status");
  const summaryHeading = documentPort.createElement("h2");
  summaryHeading.textContent = "Inspection status";
  const stateValue = documentPort.createElement("strong");
  stateValue.id = "surface-lab-state";
  const riskValue = documentPort.createElement("p");
  riskValue.id = "surface-lab-risk";
  const nextValue = documentPort.createElement("p");
  nextValue.id = "surface-lab-next-action";
  const warningValue = documentPort.createElement("p");
  warningValue.id = "surface-lab-warnings";
  warningValue.setAttribute("role", "status");
  summary.append(summaryHeading, stateValue, riskValue, nextValue, warningValue);

  const controls = documentPort.createElement("section");
  controls.className = "surface-lab-controls";
  controls.setAttribute("aria-label", "Surface Lab controls");
  const controlsHeading = documentPort.createElement("h2");
  controlsHeading.textContent = "Inspection controls";
  const cameraRow = documentPort.createElement("div");
  cameraRow.className = "surface-lab-control-row";
  const layerRow = documentPort.createElement("div");
  layerRow.className = "surface-lab-control-row";
  const generationRow = documentPort.createElement("div");
  generationRow.className = "surface-lab-generation-row";
  const input = documentPort.createElement("input");
  input.id = "surface-lab-seed-input";
  input.type = "text";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Deterministic Hestia seed");
  const resolution = documentPort.createElement("select");
  resolution.id = "surface-lab-resolution";
  resolution.setAttribute("aria-label", "Voxel size");
  for (const value of ["0.5", "0.25"] as const) {
    const option = documentPort.createElement("option");
    option.value = value;
    option.textContent = `${Number(value).toFixed(2)} m`;
    resolution.append(option);
  }

  let presentationState = options.presentationState;
  let lastSnapshot: SurfaceLabTelemetrySnapshot | undefined;
  let lastFrameTime: SurfaceLabFrameTimeSample = Object.freeze({ averageMilliseconds: 0, sampleCount: 0, complete: false });
  let lastCameraPose = options.cameraPose;
  let actionError = "";
  let seedEditing = false;
  let disposed = false;
  const fields = new Map<string, HTMLElement>();
  const toggleButtons = new Map<keyof SurfaceLabPresentationState, HTMLButtonElement>();

  const makeButton = (label: string, action: () => void): HTMLButtonElement => {
    const button = documentPort.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
  };

  const invoke = (action: () => Promise<unknown>): void => {
    if (disposed) return;
    actionError = "";
    const reportError = (error: unknown): void => {
      if (disposed) return;
      actionError = error instanceof Error ? error.message : "Surface Lab action failed.";
      if (lastSnapshot !== undefined) render(lastSnapshot, lastFrameTime, lastCameraPose);
    };
    try {
      void action().catch(reportError);
    } catch (error) {
      reportError(error);
    }
  };

  const resetButton = makeButton("Reset view", () => options.actions.resetCamera());
  resetButton.id = "surface-lab-reset-camera";
  const orbitButton = makeButton("Orbit", () => {
    options.actions.setCameraMode("Orbit");
    lastCameraPose = { ...lastCameraPose, mode: "Orbit" };
    if (lastSnapshot !== undefined) render(lastSnapshot, lastFrameTime, lastCameraPose);
  });
  orbitButton.id = "surface-lab-camera-orbit";
  const flyButton = makeButton("Fly", () => {
    options.actions.setCameraMode("Fly");
    lastCameraPose = { ...lastCameraPose, mode: "Fly" };
    if (lastSnapshot !== undefined) render(lastSnapshot, lastFrameTime, lastCameraPose);
  });
  flyButton.id = "surface-lab-camera-fly";
  cameraRow.append(resetButton, orbitButton, flyButton);

  const addToggle = (key: keyof SurfaceLabPresentationState, label: string, action: (enabled: boolean) => void): void => {
    const button = makeButton(label, () => {
      const enabled = !presentationState[key];
      presentationState = Object.freeze({ ...presentationState, [key]: enabled });
      action(enabled);
      if (lastSnapshot !== undefined) render(lastSnapshot, lastFrameTime, lastCameraPose);
    });
    button.id = `surface-lab-toggle-${key.replace("Enabled", "").toLowerCase()}`;
    button.setAttribute("aria-pressed", String(presentationState[key]));
    toggleButtons.set(key, button);
    layerRow.append(button);
  };
  addToggle("fogEnabled", "Fog", options.actions.setFogEnabled);
  addToggle("waterEnabled", "Water", options.actions.setWaterEnabled);
  addToggle("vegetationEnabled", "Vegetation", options.actions.setVegetationEnabled);
  addToggle("wireframeEnabled", "Wireframe", options.actions.setWireframeEnabled);
  addToggle("boundariesEnabled", "Chunk boundaries", options.actions.setBoundariesEnabled);

  input.addEventListener("input", () => { seedEditing = true; });
  input.addEventListener("blur", () => { seedEditing = false; });
  const regenerate = makeButton("Regenerate", () => {
    seedEditing = false;
    invoke(() => options.actions.regenerate(input.value));
  });
  regenerate.id = "surface-lab-regenerate";
  regenerate.className = "surface-lab-primary-action";
  resolution.addEventListener("change", () => invoke(() => options.actions.setResolution(Number(resolution.value) as HestiaVoxelSizeMeters)));
  generationRow.append(input, resolution, regenerate);
  const controlsHint = documentPort.createElement("p");
  controlsHint.className = "surface-lab-controls-hint";
  controlsHint.textContent = "Mouse drag orbit/look · wheel dolly · Fly: WASD, Q/E vertical, Shift fast, Alt precise";
  controls.append(controlsHeading, cameraRow, layerRow, generationRow, controlsHint);

  const telemetry = documentPort.createElement("section");
  telemetry.className = "surface-lab-telemetry";
  telemetry.setAttribute("aria-label", "Technical telemetry");
  const telemetryHeading = documentPort.createElement("h2");
  telemetryHeading.textContent = "TECHNICAL TELEMETRY";
  const telemetryNotice = documentPort.createElement("p");
  telemetryNotice.className = "surface-lab-telemetry-notice";
  telemetryNotice.textContent = "Read-only measurements · renderer resize is camera/CSS only; drawing buffer remains fixed";
  const telemetryGrid = documentPort.createElement("dl");
  const addField = (key: string, label: string): void => {
    const term = documentPort.createElement("dt");
    term.textContent = label;
    const value = documentPort.createElement("dd");
    value.id = `surface-lab-${key}`;
    telemetryGrid.append(term, value);
    fields.set(key, value);
  };
  [
    ["seed", "Seed"], ["preset", "Preset"], ["voxel-size", "Voxel size"], ["extent", "Region extent"],
    ["chunks", "Chunks req/ready/failed"], ["cancelled", "Cancelled jobs"], ["queue", "Queue / running"],
    ["worker-restarts", "Worker restarts"], ["stale", "Stale rejects"], ["epochs", "Plan / worker epoch"],
    ["geometry", "Vertices / triangles"], ["mesh-bytes", "Mesh bytes"], ["generation-time", "Generation"],
    ["meshing-time", "Meshing"], ["upload-time", "Upload"], ["frame-time", "Frame time"],
    ["cache", "Cache hit/miss/bypass"], ["body-id", "Body"], ["system-frame", "System frame"],
    ["body-inertial-frame", "Body inertial frame"], ["body-fixed-frame", "Body fixed frame"],
    ["surface-frame", "Surface frame"], ["universe-time", "Universe tick / epoch"], ["layers", "Presentation layers"],
    ["camera", "Camera mode / pose"],
    ["brick-hashes", "Brick hashes"], ["mesh-hashes", "Mesh hashes"]
  ].forEach(([key, label]) => addField(key!, label!));
  telemetry.append(telemetryHeading, telemetryNotice, telemetryGrid);

  root.append(modeBar, summary, controls, telemetry);
  options.host.append(root);

  const setField = (key: string, value: string): void => {
    const field = fields.get(key);
    if (field !== undefined) field.textContent = value;
  };

  const render = (snapshot: SurfaceLabTelemetrySnapshot, frameTime: SurfaceLabFrameTimeSample, cameraPose: SurfaceLabCameraPose): void => {
    if (disposed) return;
    lastSnapshot = snapshot;
    lastFrameTime = frameTime;
    lastCameraPose = cameraPose;
    projectTelemetryData(documentPort.body, snapshot, frameTime, cameraPose);
    documentPort.body.dataset.surfaceLabFog = String(presentationState.fogEnabled);
    documentPort.body.dataset.surfaceLabWater = String(presentationState.waterEnabled);
    documentPort.body.dataset.surfaceLabVegetation = String(presentationState.vegetationEnabled);
    documentPort.body.dataset.surfaceLabWireframe = String(presentationState.wireframeEnabled);
    documentPort.body.dataset.surfaceLabBoundaries = String(presentationState.boundariesEnabled);
    root.dataset.state = snapshot.lifecycle;
    root.dataset.cameraMode = cameraPose.mode;
    stateValue.textContent = `State: ${snapshot.lifecycle}`;
    riskValue.textContent = riskFor(snapshot);
    nextValue.textContent = nextActionFor(snapshot);
    warningValue.textContent = actionError === "" ? warningFor(snapshot) : `Action failed: ${actionError}`;
    if (!seedEditing) input.value = snapshot.seed;
    resolution.value = String(snapshot.voxelSizeMeters);
    orbitButton.setAttribute("aria-pressed", String(cameraPose.mode === "Orbit"));
    flyButton.setAttribute("aria-pressed", String(cameraPose.mode === "Fly"));
    toggleButtons.forEach((button, key) => button.setAttribute("aria-pressed", String(presentationState[key])));
    setField("seed", snapshot.seed);
    setField("preset", snapshot.presetId);
    setField("voxel-size", `${snapshot.voxelSizeMeters.toFixed(2)} m`);
    setField("extent", `${snapshot.regionExtentMeters.x} × ${snapshot.regionExtentMeters.y} × ${snapshot.regionExtentMeters.z} m`);
    setField("chunks", `${snapshot.requestedChunks} / ${snapshot.readyChunks} / ${snapshot.failedChunks}`);
    setField("cancelled", formatInteger(snapshot.cancelledJobs));
    setField("queue", `${snapshot.workerQueueDepth} / ${snapshot.runningWorkers}`);
    setField("worker-restarts", formatInteger(snapshot.workerRestarts));
    setField("stale", formatInteger(snapshot.staleRejects));
    setField("epochs", `${snapshot.planningEpoch} / ${snapshot.latestWorkerEpoch}`);
    setField("geometry", `${formatInteger(snapshot.vertices)} / ${formatInteger(snapshot.triangles)}`);
    setField("mesh-bytes", formatBytes(snapshot.meshBytes));
    setField("generation-time", formatMilliseconds(snapshot.generationMilliseconds));
    setField("meshing-time", formatMilliseconds(snapshot.meshingMilliseconds));
    setField("upload-time", formatMilliseconds(snapshot.uploadMilliseconds));
    setField("frame-time", frameTime.complete
      ? `${formatMilliseconds(frameTime.averageMilliseconds)} · 300-frame settled sample`
      : `${formatMilliseconds(frameTime.averageMilliseconds)} · warming ${frameTime.sampleCount}/300`);
    setField("cache", `${snapshot.cacheHits} / ${snapshot.cacheMisses} / ${snapshot.cacheBypasses}`);
    setField("body-id", snapshot.bodyId);
    setField("system-frame", snapshot.systemFrameId);
    setField("body-inertial-frame", snapshot.bodyInertialFrameId);
    setField("body-fixed-frame", snapshot.bodyFixedFrameId);
    setField("surface-frame", snapshot.surfaceFrameId);
    setField("universe-time", `${snapshot.universeTick} / ${snapshot.universeEpochSeconds}s`);
    setField("layers", `fog ${presentationState.fogEnabled ? "on" : "off"} · water ${presentationState.waterEnabled ? "on" : "off"} · vegetation ${presentationState.vegetationEnabled ? "on" : "off"} · wireframe ${presentationState.wireframeEnabled ? "on" : "off"} · boundaries ${presentationState.boundariesEnabled ? "on" : "off"}`);
    setField("camera", `${cameraPose.mode} · position ${formatVector(cameraPose.position)} · target ${formatVector(cameraPose.target)} · quaternion ${cameraPose.quaternion.x.toFixed(3)}, ${cameraPose.quaternion.y.toFixed(3)}, ${cameraPose.quaternion.z.toFixed(3)}, ${cameraPose.quaternion.w.toFixed(3)}`);
    setField("brick-hashes", snapshot.brickHashes.join(" · ") || "—");
    setField("mesh-hashes", snapshot.meshHashes.join(" · ") || "—");
  };

  return {
    update: render,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.remove();
      clearSurfaceLabDataset(documentPort.body);
    }
  };
};
