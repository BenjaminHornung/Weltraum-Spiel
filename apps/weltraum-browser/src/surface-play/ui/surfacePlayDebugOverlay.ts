import type { RenderBackendDiagnostics } from "../../presentation";
import type { SurfacePlayRuntimeSnapshot } from "../surfacePlayRuntime";
import type { PreparedStructuralFirePrivateDiagnosticTrace } from "../workers/preparedStructuralFireProtocol";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const GRAPH_WIDTH = 120;
const GRAPH_HEIGHT = 48;
const GRAPH_TOP = 2;
const GRAPH_BOTTOM = 46;

export const SURFACE_PLAY_DEBUG_HISTORY_LIMIT = 120;

export interface SurfacePlayDebugFrameSample {
  readonly frameTimeMilliseconds: number;
  readonly fixedSteps: number;
  readonly pendingElapsedSeconds: number;
  readonly snapshot: Readonly<SurfacePlayRuntimeSnapshot>;
  readonly backendDiagnostics: Readonly<RenderBackendDiagnostics>;
}

interface SurfacePlayLongTaskEntry {
  readonly entryType: string;
  readonly duration: number;
}

interface SurfacePlayLongTaskObserver {
  observe(): void;
  disconnect(): void;
}

type SurfacePlayLongTaskObserverFactory = (
  onEntries: (entries: readonly Readonly<SurfacePlayLongTaskEntry>[]) => void
) => SurfacePlayLongTaskObserver | null;

type SurfacePlayDebugOverlayDocumentPort = Pick<Document, "createElement" | "createElementNS">;

export interface SurfacePlayDebugOverlayOptions {
  readonly host: HTMLElement;
  readonly documentPort?: SurfacePlayDebugOverlayDocumentPort;
  readonly historyLimit?: number;
  readonly createLongTaskObserver?: SurfacePlayLongTaskObserverFactory;
}

export interface SurfacePlayDebugOverlay {
  isVisible(): boolean;
  toggle(): void;
  update(sample: Readonly<SurfacePlayDebugFrameSample>): void;
  dispose(): void;
}

const finiteNonNegative = (value: number): number =>
  Number.isFinite(value) && value >= 0 ? value : 0;

const fixed = (value: number, digits = 2): string =>
  (Number.isFinite(value) ? value : 0).toFixed(digits);

const optionalFixed = (value: number | null | undefined, digits = 2): string =>
  value === null || value === undefined ? "--" : fixed(value, digits);

const diagnosticMarkRange = (start: number | null | undefined, end: number | null | undefined): string =>
  `${optionalFixed(start)}-${optionalFixed(end)} MS`;

const preparedSeedSubphaseText = (
  prepareSeed: Readonly<NonNullable<NonNullable<PreparedStructuralFirePrivateDiagnosticTrace["worker"]>["prepareSeed"]>>
    | null
): string => {
  if (prepareSeed === null) return "SUBPHASES -- | VIEWS -- | FACTS -- | COLLIDER N/A BODY-FREE";
  const spanDuration = (span: Readonly<{ readonly durationMilliseconds: number | null }>): string =>
    optionalFixed(span.durationMilliseconds);
  const views = prepareSeed.views.map((view) =>
    `${view.logicalViewName} I${optionalFixed(view.itemCount, 0)} B${optionalFixed(view.byteLength, 0)} `
      + `P${optionalFixed(view.pageCount, 0)} D${optionalFixed(view.decodeDurationMilliseconds)}`
  ).join(",");
  const authority = prepareSeed.facts.authority;
  const connectivity = prepareSeed.facts.connectivity;
  const mass = prepareSeed.facts.mass;
  const collision = prepareSeed.facts.collision;
  return `SUBPHASES CONSTRUCT ${spanDuration(prepareSeed.constructSeed)} MS `
    + `MATERIALIZE ${spanDuration(prepareSeed.materializeAndRetainPages)} MS `
    + `BIND ${spanDuration(prepareSeed.bindSeed)} MS `
    + `| AUTHORITY VALIDATE ${spanDuration(prepareSeed.authority.treeAndObjectCanonicalValidation)} MS `
    + `CONNECTIVITY ${spanDuration(prepareSeed.authority.structuralConnectivity)} MS `
    + `MASS ${spanDuration(prepareSeed.authority.structuralMass)} MS `
    + `PUBLISH/COMPARE ${spanDuration(prepareSeed.authority.authorityPublicationAndFinalCompare)} MS `
    + `| COLLISION VALIDATE ${spanDuration(prepareSeed.collision.collisionCanonicalValidation)} MS `
    + `PUBLISH/INDEX ${spanDuration(prepareSeed.collision.collisionPublicationAndIndex)} MS `
    + `| VIEWS ${views} `
    + `| FACTS AUTHORITY ${authority === null ? "--" : `BRICKS ${authority.brickCount} OCCUPIED ${authority.occupiedCellCount} ANCHORS ${authority.anchorCount} JOINTS ${authority.jointCount}`} `
    + `CONNECTIVITY ${connectivity === null ? "--" : `CELLS ${connectivity.candidateCellCount} PROBES ${connectivity.coordinateNeighborProbeCount}`} `
    + `MASS ${mass === null ? "--" : `VOXELS ${mass.occupiedVoxelCount}`} `
    + `COLLISION ${collision === null ? "--" : `CELLS ${collision.canonicalHashCellCount} BRICKS ${collision.sourceBrickCount}`} `
    + `PHYSICS TERRAIN ${prepareSeed.facts.physics.terrainColliderCount} BODIES ${prepareSeed.facts.physics.bodyCount} `
    + `| COLLIDER N/A BODY-FREE`;
};

const preparedFireTraceText = (
  label: "CURRENT" | "LAST",
  trace: Readonly<PreparedStructuralFirePrivateDiagnosticTrace> | null
): string => {
  if (trace === null) return `${label} UNAVAILABLE`;
  const runtime = trace.runtime;
  const main = trace.main;
  const worker = trace.worker;
  const workerPhase = (
    label: "PREPARE SEED" | "EXECUTE",
    operation: Readonly<NonNullable<PreparedStructuralFirePrivateDiagnosticTrace["worker"]>["prepareSeed"]>
      | Readonly<NonNullable<PreparedStructuralFirePrivateDiagnosticTrace["worker"]>["execute"]>
      | null
  ): string => operation === null
    ? `WORKER ${label} RECEIPT -- MS START -- MS END -- MS DURATION -- MS`
    : `WORKER ${label} RECEIPT ${optionalFixed(operation.receiptAtMilliseconds)} MS `
      + `START ${optionalFixed(operation.computeStartedAtMilliseconds)} MS `
      + `END ${optionalFixed(operation.computeCompletedAtMilliseconds)} MS `
      + `DURATION ${optionalFixed(operation.computeDurationMilliseconds)} MS`;
  return `${label} ${trace.phase.toUpperCase()} ${trace.status.toUpperCase()} `
    + `| OBJECT ${trace.objectId} | ROOT ${trace.rootJobId ?? "--"} | EPOCH ${trace.workerEpoch ?? "--"} `
    + `| RUNTIME INPUT ${optionalFixed(runtime.inputAcceptedAtMilliseconds)} MS `
    + `QUEUE ${optionalFixed(runtime.queuedAtMilliseconds)} MS `
    + `RUNNING ${optionalFixed(runtime.runningAtMilliseconds)} MS `
    + `WORKER PREPARATION STATE ${diagnosticMarkRange(
      runtime.workerPreparationStateStartAtMilliseconds,
      runtime.workerPreparationStateEndAtMilliseconds
    )} DURATION ${optionalFixed(runtime.workerPreparationStateDurationMilliseconds)} MS `
    + `| RUNTIME READY TO ADOPT ${optionalFixed(runtime.readyToAdoptAtMilliseconds)} MS `
    + `| PREWARM START ${optionalFixed(runtime.prewarmStartAtMilliseconds)} MS `
    + `WORKER PREPARATION STATE ${diagnosticMarkRange(
      runtime.prewarmWorkerPreparationStateStartAtMilliseconds,
      runtime.prewarmWorkerPreparationStateEndAtMilliseconds
    )} END ${optionalFixed(runtime.prewarmEndAtMilliseconds)} MS `
    + `DURATION ${optionalFixed(runtime.prewarmDurationMilliseconds)} MS `
    + `| MAIN PREPARE SEED START ${optionalFixed(main.prepareSeedStartAtMilliseconds)} MS `
    + `END ${optionalFixed(main.prepareSeedEndAtMilliseconds)} MS `
    + `POST START ${optionalFixed(main.prepareSeedPostStartAtMilliseconds)} MS `
    + `RETURN ${optionalFixed(main.prepareSeedPostEndAtMilliseconds)} MS `
    + `RECEIPT ${optionalFixed(main.seedPreparedReceiptAtMilliseconds)} MS `
    + `VALIDATION ${optionalFixed(main.seedValidationCompleteAtMilliseconds)} MS `
    + `DURATION ${optionalFixed(main.prepareSeedDurationMilliseconds)} MS `
    + `| MAIN EXECUTE POST START ${optionalFixed(main.executePostStartAtMilliseconds)} MS `
    + `RETURN ${optionalFixed(main.executePostReturnedAtMilliseconds)} MS `
    + `FIRST RECEIPT ${optionalFixed(main.firstResultOrReadyReceiptAtMilliseconds)} MS `
    + `READY RECEIPT ${optionalFixed(main.executeReadyReceiptAtMilliseconds)} MS `
    + `VALIDATION ${optionalFixed(main.executeValidationCompleteAtMilliseconds)} MS `
    + `DURATION ${optionalFixed(main.executePostDurationMilliseconds)} MS `
    + `| WORKER DOMAIN (CLOCKS NOT COMPARABLE) ${workerPhase("PREPARE SEED", worker?.prepareSeed ?? null)} `
    + `| ${workerPhase("EXECUTE", worker?.execute ?? null)} `
    + `| WORKER PREPARE SEED DETAILS ${preparedSeedSubphaseText(worker?.prepareSeed ?? null)} `
    + `| SEED CANONICAL ${optionalFixed(trace.seedCanonicalBytes, 0)} B `
    + `| RESULT CANONICAL ${optionalFixed(trace.resultCanonicalBytes, 0)} B `
    + `| CANONICAL BASIS ${trace.canonicalBytesBasis} (MANIFEST DESCRIPTOR BYTE LENGTH SUM) `
    + `| CLONE BYTES UNAVAILABLE | TERMINAL REASON ${trace.reason ?? "--"} `
    + `| ADOPTION UNAVAILABLE ${trace.reason === "FixedTickAdoptionUnavailable" ? trace.reason : "--"} `
    + `| PUBLISH ${trace.publication.status.toUpperCase()}`;
};

const mebibytes = (bytes: number): string => fixed(bytes / (1024 * 1024));

const createBrowserLongTaskObserver: SurfacePlayLongTaskObserverFactory = (onEntries) => {
  if (
    typeof PerformanceObserver !== "function"
    || !PerformanceObserver.supportedEntryTypes?.includes("longtask")
  ) return null;
  const observer = new PerformanceObserver((entries) => onEntries(entries.getEntries()));
  return {
    observe: () => observer.observe({ type: "longtask" }),
    disconnect: () => observer.disconnect()
  };
};

const createMetric = (
  documentPort: SurfacePlayDebugOverlayDocumentPort,
  id: string
): HTMLParagraphElement => {
  const metric = documentPort.createElement("p");
  metric.id = id;
  metric.className = "surface-play-debug-overlay__metric";
  return metric;
};

export const createSurfacePlayDebugOverlay = (
  options: SurfacePlayDebugOverlayOptions
): SurfacePlayDebugOverlay => {
  const documentPort = options.documentPort ?? document;
  const requestedHistoryLimit = Number.isSafeInteger(options.historyLimit) && (options.historyLimit ?? 0) > 0
    ? options.historyLimit!
    : SURFACE_PLAY_DEBUG_HISTORY_LIMIT;
  const historyLimit = Math.min(SURFACE_PLAY_DEBUG_HISTORY_LIMIT, requestedHistoryLimit);
  const createLongTaskObserver = options.createLongTaskObserver ?? createBrowserLongTaskObserver;
  const frameTimes = new Array<number>(historyLimit);
  let sampleCount = 0;
  let latestSample: Readonly<SurfacePlayDebugFrameSample> | undefined;
  let visible = false;
  let disposed = false;
  let longTaskObserver: SurfacePlayLongTaskObserver | undefined;
  let longTaskStatus: "Idle" | "Observing" | "Unsupported" = "Idle";
  let longTaskCount = 0;
  let longTaskTotalMilliseconds = 0;
  let longTaskMaximumMilliseconds = 0;

  const root = documentPort.createElement("aside");
  root.id = "surface-play-debug-overlay";
  root.className = "surface-play-debug-overlay";
  root.hidden = true;
  root.dataset.visible = "false";
  root.dataset.sampleCount = "0";
  root.dataset.historyLimit = String(historyLimit);
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("aria-label", "Surface Play debug and performance diagnostics");

  const heading = documentPort.createElement("h2");
  heading.className = "surface-play-debug-overlay__heading";
  heading.textContent = "SURFACE PLAY DIAGNOSTICS";
  const fps = createMetric(documentPort, "surface-play-debug-fps");
  const frameTime = createMetric(documentPort, "surface-play-debug-frametime");
  const runtime = createMetric(documentPort, "surface-play-debug-runtime");
  const player = createMetric(documentPort, "surface-play-debug-player");
  const world = createMetric(documentPort, "surface-play-debug-world");
  const bodies = createMetric(documentPort, "surface-play-debug-bodies");
  const representations = createMetric(documentPort, "surface-play-debug-representations");
  const backend = createMetric(documentPort, "surface-play-debug-backend");
  const event = createMetric(documentPort, "surface-play-debug-event");
  const action = createMetric(documentPort, "surface-play-debug-action");
  const physics = createMetric(documentPort, "surface-play-debug-physics");
  const asyncStatus = createMetric(documentPort, "surface-play-debug-async");
  const preparedFireDiagnostics = createMetric(documentPort, "surface-play-debug-prepared-fire");
  const longTasks = createMetric(documentPort, "surface-play-debug-long-tasks");
  longTasks.textContent = "LONG --";

  const graph = documentPort.createElementNS(SVG_NAMESPACE, "svg") as SVGSVGElement;
  graph.id = "surface-play-debug-frametime-graph";
  graph.setAttribute("class", "surface-play-debug-overlay__graph");
  graph.setAttribute("viewBox", `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`);
  graph.setAttribute("preserveAspectRatio", "none");
  graph.setAttribute("role", "img");
  graph.setAttribute("aria-label", `Rolling frame time graph, newest ${historyLimit} frames`);
  const graphLine = documentPort.createElementNS(SVG_NAMESPACE, "polyline") as SVGPolylineElement;
  graphLine.id = "surface-play-debug-frametime-line";
  graphLine.setAttribute("class", "surface-play-debug-overlay__graph-line");
  graphLine.setAttribute("fill", "none");
  graphLine.setAttribute("points", "");
  graph.append(graphLine);

  root.append(
    heading,
    fps,
    frameTime,
    graph,
    longTasks,
    runtime,
    player,
    world,
    bodies,
    representations,
    backend,
    event,
    action,
    physics,
    asyncStatus,
    preparedFireDiagnostics
  );
  options.host.append(root);

  const history = (): readonly number[] => frameTimes.slice(0, sampleCount);

  const renderLongTasks = (): void => {
    longTasks.textContent = longTaskStatus === "Unsupported"
      ? "LONG UNSUPPORTED"
      : longTaskStatus === "Observing"
        ? `LONG ${longTaskCount} | TOTAL ${fixed(longTaskTotalMilliseconds)} MS | MAX ${fixed(longTaskMaximumMilliseconds)} MS`
        : "LONG --";
  };

  const stopLongTaskObserver = (): void => {
    longTaskObserver?.disconnect();
    longTaskObserver = undefined;
    if (longTaskStatus === "Observing") longTaskStatus = "Idle";
  };

  const startLongTaskObserver = (): void => {
    longTaskCount = 0;
    longTaskTotalMilliseconds = 0;
    longTaskMaximumMilliseconds = 0;
    try {
      longTaskObserver = createLongTaskObserver((entries) => {
        if (disposed || !visible || longTaskStatus !== "Observing") return;
        for (const entry of entries) {
          if (entry.entryType !== "longtask" || !Number.isFinite(entry.duration) || entry.duration < 0) continue;
          longTaskCount += 1;
          longTaskTotalMilliseconds += entry.duration;
          longTaskMaximumMilliseconds = Math.max(longTaskMaximumMilliseconds, entry.duration);
        }
        renderLongTasks();
      }) ?? undefined;
      if (longTaskObserver === undefined) {
        longTaskStatus = "Unsupported";
      } else {
        longTaskStatus = "Observing";
        longTaskObserver.observe();
      }
    } catch {
      longTaskObserver?.disconnect();
      longTaskObserver = undefined;
      longTaskStatus = "Unsupported";
    }
    renderLongTasks();
  };

  const render = (): void => {
    if (disposed || !visible || latestSample === undefined || sampleCount === 0) return;
    const samples = history();
    const currentMilliseconds = samples[samples.length - 1] ?? 0;
    const averageMilliseconds = samples.reduce((total, value) => total + value, 0) / samples.length;
    const ordered = [...samples].sort((left, right) => left - right);
    const medianIndex = Math.floor(ordered.length / 2);
    const p50Milliseconds = ordered.length % 2 === 1
      ? ordered[medianIndex] ?? 0
      : ((ordered[medianIndex - 1] ?? 0) + (ordered[medianIndex] ?? 0)) / 2;
    const percentileIndex = Math.max(0, Math.ceil(ordered.length * 0.95) - 1);
    const p95Milliseconds = ordered[percentileIndex] ?? 0;
    const maximumMilliseconds = ordered[ordered.length - 1] ?? 0;
    const framesPerSecond = averageMilliseconds <= 0 ? 0 : 1_000 / averageMilliseconds;
    const snapshot = latestSample.snapshot;
    const diagnostics = latestSample.backendDiagnostics;
    const structuralBodies = snapshot.presentation.structural?.dynamicBodies ?? [];
    const fallingBodies = structuralBodies.filter((body) => body.lifecycle === "Falling").length;
    const restingBodies = structuralBodies.filter((body) => body.lifecycle === "Resting").length;
    const position = snapshot.player.positionMeters;
    const velocity = snapshot.player.velocityMetersPerSecond;
    const worldRevision = snapshot.world?.identity.regionRevision;

    root.dataset.currentFrameMilliseconds = fixed(currentMilliseconds);
    root.dataset.averageFrameMilliseconds = fixed(averageMilliseconds);
    root.dataset.p50FrameMilliseconds = fixed(p50Milliseconds);
    root.dataset.p95FrameMilliseconds = fixed(p95Milliseconds);
    root.dataset.maximumFrameMilliseconds = fixed(maximumMilliseconds);
    fps.textContent = `FPS ${fixed(framesPerSecond, 1)}`;
    frameTime.textContent = `FRAME ${fixed(currentMilliseconds)} MS | AVG ${fixed(averageMilliseconds)} | P50 ${fixed(p50Milliseconds)} | P95 ${fixed(p95Milliseconds)} | MAX ${fixed(maximumMilliseconds)}`;
    runtime.textContent = `TICK ${snapshot.player.simulationTick} | FIXED ${latestSample.fixedSteps} | ACC ${fixed(snapshot.fixedStep.accumulatorSeconds * 1_000)} MS | PENDING ${fixed(latestSample.pendingElapsedSeconds * 1_000)} MS`;
    player.textContent = `POS ${fixed(position.x)}, ${fixed(position.y)}, ${fixed(position.z)} | VEL ${fixed(velocity.x)}, ${fixed(velocity.y)}, ${fixed(velocity.z)} | ${snapshot.player.grounded ? "GROUNDED" : "AIRBORNE"}`;
    world.textContent = `WORLD ${worldRevision === undefined ? "--" : `R${worldRevision}`} | REGION R${snapshot.authorityState.regionRevision}`;
    bodies.textContent = `STRUCTURAL BODIES ${structuralBodies.length} | FALLING ${fallingBodies} | RESTING ${restingBodies}`;
    representations.textContent = `REP RESIDENT ${diagnostics.residentRepresentationKeys.length} | VISIBLE ${diagnostics.visibleRepresentationKeys.length} | FALLBACK ${diagnostics.pinnedFallbackRepresentationKeys.length}`;
    backend.textContent = `CPU ${mebibytes(diagnostics.ownedCpuBytes)} MIB | GPU ${mebibytes(diagnostics.estimatedGpuBytes)} MIB | REJECTED ${diagnostics.rejectedArtifacts} | STALE ${diagnostics.staleRejectCount}`;
    const latestCombatEvent = snapshot.combat.events.at(-1);
    const latestFireResult = snapshot.combat.latestFireResult;
    const fireStatus = latestFireResult === null
      ? "--"
      : latestFireResult.status === "Accepted"
        ? `ACCEPTED ${latestFireResult.hit}`
        : `REJECTED ${latestFireResult.code}`;
    const latestRejection = snapshot.latestRejection;
    const structural = snapshot.presentation.structural;
    event.textContent = `EVENT ${latestCombatEvent === undefined ? "--" : `${latestCombatEvent.kind} @ TICK ${latestCombatEvent.simulationTick}`} | FIRE ${fireStatus} | VOXEL ${snapshot.latestVoxelTransition?.result.status ?? "--"}`;
    action.textContent = `ACTION ${snapshot.hud.latestAction ?? snapshot.hud.latestBlock ?? "--"} | REJECTION ${latestRejection === null ? "--" : `${latestRejection.kind}/${latestRejection.code} @ TICK ${latestRejection.simulationTick}`}`;
    physics.textContent = structural === null
      ? "PHYSICS UNAVAILABLE | CONTACTS -- | SUBSTEPS --"
      : structural.physicsFailure === null
        ? "PHYSICS FAILURE NONE | CONTACTS -- | SUBSTEPS --"
        : `PHYSICS FAILURE ${structural.physicsFailure.code} @ TICK ${structural.physicsFailure.simulationTick} | CONTACTS -- | SUBSTEPS --`;
    const preparation = snapshot.hud.structuralPreparation;
    asyncStatus.textContent = preparation === undefined
      ? "ASYNC UNAVAILABLE | QUEUE -- | LATENCY --"
      : preparation === null
        ? "ASYNC IDLE | QUEUE 0 | RUNNING 0 | LATENCY --"
      : `ASYNC ${preparation.status.toUpperCase()} | QUEUE ${preparation.queueDepth} | RUNNING ${preparation.inFlight} | LATENCY ${fixed(preparation.latencyMilliseconds)} MS`;
    const preparedFire = snapshot.preparedStructuralFireDiagnostics;
    preparedFireDiagnostics.textContent = preparedFire === undefined
      ? "PREPARED FIRE UNAVAILABLE"
      : `PREPARED FIRE ${preparedFireTraceText("CURRENT", preparedFire.current)} | ${preparedFireTraceText("LAST", preparedFire.lastCompleted)}`;

    const scaleMilliseconds = Math.max(1000 / 60, maximumMilliseconds);
    const points = samples.map((milliseconds, index) => {
      const x = samples.length === 1 ? 0 : index * GRAPH_WIDTH / (samples.length - 1);
      const ratio = Math.min(1, milliseconds / scaleMilliseconds);
      const y = GRAPH_BOTTOM - ratio * (GRAPH_BOTTOM - GRAPH_TOP);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
    graphLine.setAttribute("points", points);
  };

  return {
    isVisible() {
      return !disposed && visible;
    },
    toggle() {
      if (disposed) return;
      visible = !visible;
      root.hidden = !visible;
      root.dataset.visible = String(visible);
      root.setAttribute("aria-hidden", String(!visible));
      if (visible) startLongTaskObserver();
      else stopLongTaskObserver();
      render();
    },
    update(sample) {
      if (disposed) return;
      const frameTimeMilliseconds = finiteNonNegative(sample.frameTimeMilliseconds);
      if (sampleCount < historyLimit) {
        frameTimes[sampleCount] = frameTimeMilliseconds;
        sampleCount += 1;
      } else {
        frameTimes.copyWithin(0, 1);
        frameTimes[historyLimit - 1] = frameTimeMilliseconds;
      }
      latestSample = sample;
      root.dataset.sampleCount = String(sampleCount);
      render();
    },
    dispose() {
      if (disposed) return;
      visible = false;
      stopLongTaskObserver();
      disposed = true;
      latestSample = undefined;
      sampleCount = 0;
      root.remove();
    }
  };
};
