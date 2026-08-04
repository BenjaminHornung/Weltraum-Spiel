type SurfacePlayFailureDocument = Pick<Document, "body" | "querySelector" | "createElement">;

interface SurfacePlayModule {
  startSurfacePlay(options?: Readonly<{ loading?: SurfacePlayLoadingHandle }>): Promise<Readonly<{
    runtime?: unknown;
  }>>;
}

export const SURFACE_PLAY_LOADING_PHASES = [
  { id: "loading-module", label: "Loading surface systems" },
  { id: "preparing-world", label: "Selecting dry Hestia terrain" },
  { id: "materializing-terrain", label: "Materializing voxel terrain" },
  { id: "resolving-spawn", label: "Resolving a safe suit spawn" },
  { id: "starting-runtime", label: "Starting combat and physics" },
  { id: "preparing-presentation", label: "Preparing Hestia presentation" },
  { id: "connecting-controls", label: "Connecting suit controls" }
] as const;

export type SurfacePlayLoadingPhase = (typeof SURFACE_PLAY_LOADING_PHASES)[number]["id"];

export interface SurfacePlayLoadingHandle {
  readonly root: HTMLElement;
  update(phase: SurfacePlayLoadingPhase): void;
  complete(): void;
  dispose(): void;
}

const loadingPhase = (phase: SurfacePlayLoadingPhase) => {
  const index = SURFACE_PLAY_LOADING_PHASES.findIndex((candidate) => candidate.id === phase);
  if (index < 0) throw new TypeError(`Unknown Surface Play loading phase: ${phase}`);
  return { index, value: SURFACE_PLAY_LOADING_PHASES[index] } as const;
};

export const presentSurfacePlayLoading = (
  documentPort: SurfacePlayFailureDocument,
  phase: SurfacePlayLoadingPhase = "loading-module",
  host: HTMLElement | undefined = documentPort.querySelector<HTMLElement>("#app") ?? undefined
): SurfacePlayLoadingHandle => {
  documentPort.querySelector<HTMLElement>("#surface-play-loading")?.remove();
  documentPort.body.dataset.uiSurface = "surface-play";
  documentPort.body.dataset.surfacePlayState = "loading";
  const root = documentPort.createElement("section");
  root.id = "surface-play-loading";
  root.className = "surface-play-loading";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-busy", "true");
  const panel = documentPort.createElement("div");
  panel.className = "surface-play-loading__panel";
  const heading = documentPort.createElement("h1");
  heading.textContent = "ENTERING HESTIA";
  const detail = documentPort.createElement("p");
  detail.id = "surface-play-loading-phase";
  const progress = documentPort.createElement("div");
  progress.className = "surface-play-loading__indicator";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Hestia surface loading");
  progress.setAttribute("aria-describedby", detail.id);
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  const fill = documentPort.createElement("div");
  fill.className = "surface-play-loading__fill";
  fill.setAttribute("aria-hidden", "true");
  progress.append(fill);
  panel.append(heading, detail, progress);
  root.append(panel);
  (host ?? documentPort.body).append(root);

  let currentIndex = -1;
  let completed = false;
  let disposed = false;
  const publishProgress = (label: string, percentage: number): void => {
    root.dataset.progressPercentage = String(percentage);
    progress.setAttribute("aria-valuenow", String(percentage));
    progress.setAttribute("aria-valuetext", `${label} — ${percentage}%`);
    fill.setAttribute("style", `width: ${percentage}%`);
  };
  const update = (nextPhase: SurfacePlayLoadingPhase): void => {
    if (disposed) return;
    const next = loadingPhase(nextPhase);
    if (next.index < currentIndex) {
      throw new TypeError("Surface Play loading phases must be monotonic.");
    }
    if (completed) return;
    currentIndex = next.index;
    root.dataset.phase = next.value.id;
    root.dataset.phaseIndex = String(next.index);
    detail.textContent = next.value.label;
    publishProgress(next.value.label, Math.round(next.index / SURFACE_PLAY_LOADING_PHASES.length * 100));
  };
  update(phase);
  return Object.freeze({
    root,
    update,
    complete: () => {
      if (disposed || completed) return;
      if (currentIndex !== SURFACE_PLAY_LOADING_PHASES.length - 1) {
        throw new TypeError("Surface Play loading cannot complete before the final phase.");
      }
      completed = true;
      publishProgress(SURFACE_PLAY_LOADING_PHASES[currentIndex].label, 100);
      root.setAttribute("aria-busy", "false");
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      root.remove();
    }
  });
};

const failureMessage = (error: unknown): string => error instanceof Error
  ? error.message
  : "Surface Play initialization failed.";

export const presentSurfacePlayFailure = (
  documentPort: SurfacePlayFailureDocument,
  error: unknown,
  host: HTMLElement | undefined = documentPort.querySelector<HTMLElement>("#app") ?? undefined
): HTMLElement => {
  documentPort.querySelector<HTMLElement>("#surface-play-loading")?.remove();
  documentPort.body.dataset.uiSurface = "surface-play";
  documentPort.body.dataset.surfacePlayState = "failed";
  const root = documentPort.createElement("section");
  root.id = "surface-play-failure";
  root.className = "surface-play-failure";
  root.setAttribute("role", "alert");
  root.setAttribute("aria-live", "assertive");
  const heading = documentPort.createElement("h1");
  heading.textContent = "HESTIA SURFACE UNAVAILABLE";
  const detail = documentPort.createElement("p");
  detail.textContent = `Surface initialization failed: ${failureMessage(error)}`;
  const recovery = documentPort.createElement("p");
  recovery.textContent = "No playable surface state is being claimed. Reload to try again.";
  root.append(heading, detail, recovery);
  (host ?? documentPort.body).append(root);
  return root;
};

export const startSurfacePlayRoute = async (
  documentPort: SurfacePlayFailureDocument,
  loadSurfacePlay: () => Promise<SurfacePlayModule>
): Promise<void> => {
  const loading = presentSurfacePlayLoading(documentPort);
  const bootstrapLoading = Object.freeze<SurfacePlayLoadingHandle>({
    root: loading.root,
    update: loading.update,
    complete: loading.complete,
    dispose: () => undefined
  });
  try {
    const { startSurfacePlay } = await loadSurfacePlay();
    loading.update("preparing-world");
    const result = await startSurfacePlay({ loading: bootstrapLoading });
    if (result.runtime === undefined) {
      loading.dispose();
      return;
    }
    loading.complete();
    loading.dispose();
  } catch (error) {
    loading.dispose();
    presentSurfacePlayFailure(documentPort, error);
  }
};
