import type { HvpCameraPose, HvpCameraPreset } from "./hvpCamera";

export type HvpLifecycleState = "Loading" | "Ready" | "Error";

export interface HvpHudStats {
  readonly faces: number;
  readonly vertices: number;
  readonly triangles: number;
}

export interface HvpHudActions {
  setPreset(preset: HvpCameraPreset): void;
  resetCamera(): void;
}

export interface HvpHudOptions {
  readonly host: HTMLElement;
  readonly actions: HvpHudActions;
  readonly documentPort?: Pick<Document, "createElement" | "body">;
}

export interface HvpHud {
  update(state: HvpLifecycleState, pose: HvpCameraPose, stats: HvpHudStats, detail?: string): void;
  dispose(): void;
}

export const clearHvpDataset = (body: HTMLElement): void => {
  for (const key of Object.keys(body.dataset)) {
    if (key === "hestiaPrototype" || key.startsWith("hestiaPrototype")) delete body.dataset[key];
  }
};

export const createHvpHud = (options: HvpHudOptions): HvpHud => {
  const documentPort = options.documentPort ?? document;
  const root = documentPort.createElement("section");
  root.id = "hvp-hud";
  root.setAttribute("aria-label", "HVP-01 visible coast controls");
  root.setAttribute("style", [
    "position:fixed",
    "left:12px",
    "top:12px",
    "z-index:20",
    "max-width:320px",
    "padding:10px 12px",
    "background:rgba(6,10,16,0.88)",
    "border:1px solid rgba(140,170,210,0.5)",
    "color:#e7eefc",
    "font:12px/1.45 system-ui,sans-serif"
  ].join(";"));

  const title = documentPort.createElement("strong");
  title.textContent = "HVP-01 VISIBLE COAST";
  const stateValue = documentPort.createElement("div");
  stateValue.id = "hvp-state";
  stateValue.setAttribute("role", "status");
  const modeValue = documentPort.createElement("div");
  modeValue.id = "hvp-mode";
  const detailValue = documentPort.createElement("div");
  detailValue.id = "hvp-detail";

  const controls = documentPort.createElement("div");
  const makeButton = (id: string, label: string, action: () => void): HTMLButtonElement => {
    const button = documentPort.createElement("button");
    button.type = "button";
    button.id = id;
    button.textContent = label;
    button.setAttribute("style", "margin:6px 6px 0 0;pointer-events:auto");
    button.addEventListener("click", action);
    return button;
  };
  controls.append(
    makeButton("hvp-camera-eye", "C01-EYE", () => options.actions.setPreset("C01-EYE")),
    makeButton("hvp-camera-wide", "C04-WIDE", () => options.actions.setPreset("C04-WIDE")),
    makeButton("hvp-reset-camera", "Reset view", () => options.actions.resetCamera())
  );

  root.append(title, stateValue, modeValue, detailValue, controls);
  options.host.append(root);
  let disposed = false;

  return {
    update(state, pose, stats, detail = ""): void {
      if (disposed) return;
      const body = documentPort.body;
      body.dataset.hestiaPrototype = "1";
      body.dataset.hestiaPrototypeState = state;
      body.dataset.hestiaPrototypeCamera = pose.preset;
      body.dataset.hestiaPrototypeFaces = String(stats.faces);
      root.dataset.state = state;
      root.dataset.camera = pose.preset;
      stateValue.textContent = `State: ${state}`;
      modeValue.textContent = `Camera: ${pose.preset} (${pose.mode})`;
      detailValue.textContent = detail === ""
        ? `Terrain faces: ${stats.faces} · vertices: ${stats.vertices} · triangles: ${stats.triangles}`
        : detail;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      root.remove();
    }
  };
};
