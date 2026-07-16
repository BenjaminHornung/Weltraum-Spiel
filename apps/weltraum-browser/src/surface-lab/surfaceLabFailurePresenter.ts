type SurfaceLabFailureDocument = Pick<Document, "body" | "querySelector" | "createElement">;

interface SurfaceLabModule {
  startSurfaceLab(): Promise<unknown>;
}

const failureMessage = (error: unknown): string => error instanceof Error
  ? error.message
  : "Surface Lab initialization failed.";

export const presentSurfaceLabFailure = (
  documentPort: SurfaceLabFailureDocument,
  error: unknown,
  host: HTMLElement | undefined = documentPort.querySelector<HTMLElement>("#app") ?? undefined
): HTMLElement => {
  for (const key of Object.keys(documentPort.body.dataset)) {
    if (key.startsWith("surfaceLab")) delete documentPort.body.dataset[key];
  }
  documentPort.body.dataset.surfaceLab = "1";
  documentPort.body.dataset.surfaceLabState = "Failed";
  const root = documentPort.createElement("section");
  root.id = "surface-lab-failure";
  root.className = "surface-lab-failure";
  root.setAttribute("role", "alert");
  root.setAttribute("aria-live", "assertive");
  const heading = documentPort.createElement("h1");
  heading.textContent = "SURFACE LAB UNAVAILABLE";
  const detail = documentPort.createElement("p");
  detail.textContent = `Technical initialization failure: ${failureMessage(error)}`;
  const boundary = documentPort.createElement("p");
  boundary.textContent = "NOT GAMEPLAY · no terrain readiness is being claimed";
  root.append(heading, detail, boundary);
  (host ?? documentPort.body).append(root);
  return root;
};

export const startSurfaceLabRoute = async (
  documentPort: SurfaceLabFailureDocument,
  loadSurfaceLab: () => Promise<SurfaceLabModule>
): Promise<void> => {
  documentPort.body.dataset.surfaceLab = "1";
  try {
    const { startSurfaceLab } = await loadSurfaceLab();
    await startSurfaceLab();
  } catch (error) {
    presentSurfaceLabFailure(documentPort, error);
  }
};
