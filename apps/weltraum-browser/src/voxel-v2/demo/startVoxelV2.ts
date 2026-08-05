import "./voxelV2.css";
import { parseVoxelV2View, voxelV2DiagnosticsEnabled } from "../query";
import { VoxelV2ThreeRenderer } from "../render-three/voxelV2Renderer";
import type { VoxelV2InputState } from "../runtime/ports";
import { VoxelV2Runtime } from "../runtime/voxelV2Runtime";

interface VoxelV2DocumentPort extends Pick<Document, "body" | "createElement" | "querySelector"> {}

export interface VoxelV2RuntimeHandle {
  readonly dispose: () => void;
}

const messageOf = (error: unknown): string => error instanceof Error ? error.message : "Unknown V2 runtime failure.";

const presentFailure = (documentPort: VoxelV2DocumentPort, error: unknown): void => {
  documentPort.body.dataset.voxelV2 = "1";
  documentPort.body.dataset.voxelV2State = "Failed";
  const existing = documentPort.querySelector<HTMLElement>("#voxel-v2-failure");
  if (existing) existing.remove();
  const root = documentPort.createElement("section");
  root.id = "voxel-v2-failure";
  root.setAttribute("role", "alert");
  root.setAttribute("aria-live", "assertive");
  const heading = documentPort.createElement("h1");
  heading.textContent = "HESTIA VOXEL V2 SPIKE UNAVAILABLE";
  const detail = documentPort.createElement("p");
  detail.textContent = `Technical initialization failure: ${messageOf(error)}`;
  const boundary = documentPort.createElement("p");
  boundary.textContent = "The normal runtime and Surface Lab routes are not part of this failure state.";
  root.append(heading, detail, boundary);
  documentPort.body.append(root);
};

const createUi = (documentPort: VoxelV2DocumentPort, view: string): HTMLElement => {
  const root = documentPort.createElement("section");
  root.id = "voxel-v2-ui";
  root.dataset.v2Presentation = view === "player" ? "interaction" : "beauty";
  root.setAttribute("aria-label", "Hestia Voxel V2 controls and status");
  root.innerHTML = `
    <div id="voxel-v2-reticle" aria-hidden="true"></div>
    <div id="voxel-v2-status" data-testid="voxel-v2-state">LOADING</div>
    <div id="voxel-v2-view-label">VIEW: ${view}</div>
    <div id="voxel-v2-hit" data-testid="voxel-v2-hit">HIT: waiting</div>
    <div id="voxel-v2-edit" data-testid="voxel-v2-edit">EDIT: none</div>
    <div id="voxel-v2-revision" data-testid="voxel-v2-revision">REVISION: 0</div>
    <div id="voxel-v2-prompt">Click to capture · WASD move · Shift sprint · Space jump · Left click cut</div>
    <pre id="voxel-v2-diagnostics" data-testid="voxel-v2-diagnostics" aria-label="V2 read-only diagnostics"></pre>`;
  documentPort.body.append(root);
  return root;
};

export const startVoxelV2 = async (
  documentPort: VoxelV2DocumentPort,
  search: string | URLSearchParams = window.location.search
): Promise<VoxelV2RuntimeHandle> => {
  const canvas = documentPort.querySelector<HTMLCanvasElement>("#debug-scene");
  if (!canvas) throw new Error("Missing #debug-scene canvas for Voxel V2.");
  const view = parseVoxelV2View(search);
  const diagnosticsEnabled = voxelV2DiagnosticsEnabled(search);
  documentPort.body.dataset.runtimeMode = "voxel-v2";
  documentPort.body.dataset.voxelV2 = "1";
  documentPort.body.dataset.voxelV2State = "Loading";
  documentPort.body.dataset.voxelV2View = view;
  if (diagnosticsEnabled) documentPort.body.dataset.voxelV2Diagnostics = "1";
  canvas.setAttribute("aria-label", "Hestia Voxel V2 viewport");
  documentPort.querySelector<HTMLElement>("#voxel-v2-ui")?.remove();
  const ui = createUi(documentPort, view);
  const status = ui.querySelector<HTMLElement>("#voxel-v2-status")!;
  const hitText = ui.querySelector<HTMLElement>("#voxel-v2-hit")!;
  const editText = ui.querySelector<HTMLElement>("#voxel-v2-edit")!;
  const revisionText = ui.querySelector<HTMLElement>("#voxel-v2-revision")!;
  const diagnosticsText = ui.querySelector<HTMLElement>("#voxel-v2-diagnostics")!;
  const prompt = ui.querySelector<HTMLElement>("#voxel-v2-prompt")!;
  const renderer = new VoxelV2ThreeRenderer(canvas);
  const runtime = new VoxelV2Runtime({ renderer, view });
  const pressedKeys = new Set<string>();
  let jumpQueued = false;
  let disposed = false;
  let frameHandle = 0;
  let previousTime = performance.now();
  let longTaskObserver: PerformanceObserver | undefined;

  const input = (): VoxelV2InputState => ({
    forward: pressedKeys.has("KeyW"),
    backward: pressedKeys.has("KeyS"),
    left: pressedKeys.has("KeyA"),
    right: pressedKeys.has("KeyD"),
    sprint: pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight"),
    jumpQueued
  });

  const updateUi = (): void => {
    const snapshot = runtime.diagnostics();
    status.textContent = snapshot.state.toUpperCase();
    hitText.textContent = `HIT: ${snapshot.lastHit?.status ?? "waiting"}`;
    editText.textContent = `EDIT: ${snapshot.lastHit?.changedCells ?? 0} cells`;
    revisionText.textContent = `REVISION: ${snapshot.worldRevision} · MESH: ${snapshot.visibleMeshWorldRevision}`;
    documentPort.body.dataset.voxelV2State = snapshot.state;
    documentPort.body.dataset.voxelV2WorldRevision = String(snapshot.worldRevision);
    documentPort.body.dataset.voxelV2VisibleMeshRevision = String(snapshot.visibleMeshWorldRevision);
    documentPort.body.dataset.voxelV2LastEdit = snapshot.lastHit?.status ?? "none";
    documentPort.body.dataset.voxelV2PendingMeshes = String(snapshot.pendingMeshJobs);
    documentPort.body.dataset.voxelV2AcceptedEdits = String(snapshot.acceptedEdits);
    documentPort.body.dataset.voxelV2RejectedEdits = String(snapshot.rejectedEdits);
    documentPort.body.dataset.voxelV2HitCount = String(snapshot.inputToHitMs.count);
    if (snapshot.player) {
      documentPort.body.dataset.voxelV2PlayerPosition = [
        snapshot.player.position.x.toFixed(3),
        snapshot.player.position.y.toFixed(3),
        snapshot.player.position.z.toFixed(3)
      ].join(",");
    }
    diagnosticsText.textContent = JSON.stringify(snapshot, null, 2);
    prompt.textContent = document.pointerLockElement === canvas
      ? "WASD move · Shift sprint · Space jump · Left click cut · Esc release"
      : "Click to capture · WASD move · Shift sprint · Space jump · Left click cut";
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "Space" && !event.repeat) jumpQueued = true;
    pressedKeys.add(event.code);
  };
  const handleKeyUp = (event: KeyboardEvent): void => { pressedKeys.delete(event.code); };
  const handleBlur = (): void => { pressedKeys.clear(); jumpQueued = false; };
  const handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement === canvas) runtime.rotate(event.movementX, event.movementY);
  };
  const handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    if (document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock();
      return;
    }
    const result = runtime.fire();
    hitText.textContent = `HIT: ${result.status}`;
  };
  const handleCanvasClick = (): void => {
    if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
  };
  const handlePageHide = (): void => { dispose(); };

  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("pagehide", handlePageHide, { once: true });
  if ("PerformanceObserver" in window) {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) runtime.recordLongTask(entry.duration);
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      longTaskObserver = undefined;
    }
  }

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameHandle);
    longTaskObserver?.disconnect();
    canvas.removeEventListener("click", handleCanvasClick);
    canvas.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleBlur);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("pagehide", handlePageHide);
    runtime.dispose();
    ui.remove();
    delete documentPort.body.dataset.runtimeMode;
  };

  const renderFrame = (timestamp: number): void => {
    if (disposed) return;
    const deltaSeconds = Math.max(0, (timestamp - previousTime) / 1_000);
    previousTime = timestamp;
    runtime.setInput({ ...input(), jumpQueued });
    jumpQueued = false;
    runtime.recordFrameTime(deltaSeconds * 1_000);
    runtime.advanceFrame(deltaSeconds);
    updateUi();
    frameHandle = requestAnimationFrame(renderFrame);
  };
  frameHandle = requestAnimationFrame(renderFrame);

  try {
    await runtime.initialize();
    updateUi();
  } catch (error) {
    if (!disposed) {
      runtime.dispose();
      cancelAnimationFrame(frameHandle);
      disposed = true;
      longTaskObserver?.disconnect();
      canvas.removeEventListener("click", handleCanvasClick);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pagehide", handlePageHide);
      ui.remove();
      presentFailure(documentPort, error);
    }
    return { dispose: () => undefined };
  }

  return Object.freeze({ dispose });
};

export const startVoxelV2Route = async (
  documentPort: VoxelV2DocumentPort,
  search: string | URLSearchParams = window.location.search
): Promise<VoxelV2RuntimeHandle> => {
  try {
    return await startVoxelV2(documentPort, search);
  } catch (error) {
    presentFailure(documentPort, error);
    return { dispose: () => undefined };
  }
};
