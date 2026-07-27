import type { SurfacePlayHudSnapshot } from "../contracts";
import { createSurfacePlayHud } from "./surfacePlayHud";
import { SURFACE_PLAY_UI_STYLES } from "./surfacePlayUiStyles";

export type SurfacePlayUiIntent = Readonly<{ readonly type: "RequestPointerLock" }>;

export type SurfacePlayUiDocumentPort = Pick<
  Document,
  "addEventListener" | "createElement" | "head" | "pointerLockElement" | "removeEventListener"
>;

export interface SurfacePlayUiOptions {
  readonly host: HTMLElement;
  readonly viewport: HTMLElement;
  readonly onIntent: (intent: SurfacePlayUiIntent) => void;
  readonly documentPort?: SurfacePlayUiDocumentPort;
}

export interface SurfacePlayUi {
  update(snapshot: Readonly<SurfacePlayHudSnapshot>): void;
  isPlayerInputBlocked(): boolean;
  dispose(): void;
}

export const createSurfacePlayUi = (options: SurfacePlayUiOptions): SurfacePlayUi => {
  const documentPort = options.documentPort ?? document;
  const style = documentPort.createElement("style");
  style.className = "surface-play-ui__styles";
  style.textContent = SURFACE_PLAY_UI_STYLES;
  documentPort.head.append(style);

  const root = documentPort.createElement("div");
  root.className = "surface-play-ui";
  root.setAttribute("aria-label", "Hestia surface player interface");

  const hudHost = documentPort.createElement("div");
  hudHost.className = "surface-play-ui__hud-host";
  const hud = createSurfacePlayHud({ host: hudHost, documentPort });

  const pointerLock = documentPort.createElement("section");
  pointerLock.className = "surface-play-ui__pointer-lock";
  pointerLock.setAttribute("aria-label", "Suit control engagement");
  const pointerStatus = documentPort.createElement("p");
  pointerStatus.id = "surface-play-pointer-status";
  pointerStatus.className = "surface-play-ui__pointer-status";
  pointerStatus.setAttribute("role", "status");
  pointerStatus.setAttribute("aria-live", "polite");
  pointerStatus.setAttribute("aria-atomic", "true");
  const pointerButton = documentPort.createElement("button");
  pointerButton.id = "surface-play-pointer-button";
  pointerButton.className = "surface-play-ui__pointer-button";
  pointerButton.type = "button";
  pointerLock.append(pointerStatus, pointerButton);

  root.append(hudHost, pointerLock);
  options.host.append(root);

  let disposed = false;
  let controlFocused = false;
  let hadPointerLock = documentPort.pointerLockElement === options.viewport;

  const renderPointerLock = (): void => {
    if (disposed) return;
    const engaged = documentPort.pointerLockElement === options.viewport;
    if (engaged) {
      hadPointerLock = true;
      controlFocused = false;
      root.dataset.pointerLock = "engaged";
      pointerLock.hidden = true;
      pointerLock.setAttribute("aria-hidden", "true");
      return;
    }

    pointerLock.hidden = false;
    pointerLock.setAttribute("aria-hidden", "false");
    if (hadPointerLock) {
      root.dataset.pointerLock = "released";
      pointerStatus.hidden = false;
      pointerStatus.textContent = "POINTER RELEASED";
      pointerButton.textContent = "CLICK VIEWPORT TO RESUME";
      pointerButton.setAttribute("aria-label", "Click viewport to resume suit control");
      return;
    }

    root.dataset.pointerLock = "idle";
    pointerStatus.hidden = true;
    pointerStatus.textContent = "";
    pointerButton.textContent = "CLICK TO ENGAGE SUIT CONTROL";
    pointerButton.setAttribute("aria-label", "Click to engage suit control");
  };

  const onPointerLockChange = (): void => renderPointerLock();
  const onPointerClick = (): void => {
    if (disposed || documentPort.pointerLockElement === options.viewport) return;
    options.onIntent(Object.freeze({ type: "RequestPointerLock" }));
  };
  const onFocusIn = (): void => {
    if (!disposed && !pointerLock.hidden) controlFocused = true;
  };
  const onFocusOut = (): void => {
    controlFocused = false;
  };

  documentPort.addEventListener("pointerlockchange", onPointerLockChange);
  pointerButton.addEventListener("click", onPointerClick);
  pointerButton.addEventListener("focusin", onFocusIn);
  pointerButton.addEventListener("focusout", onFocusOut);
  renderPointerLock();

  return {
    update(snapshot) {
      if (disposed) return;
      hud.update(snapshot);
    },
    isPlayerInputBlocked() {
      return !disposed && controlFocused && !pointerLock.hidden;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controlFocused = false;
      documentPort.removeEventListener("pointerlockchange", onPointerLockChange);
      pointerButton.removeEventListener("click", onPointerClick);
      pointerButton.removeEventListener("focusin", onFocusIn);
      pointerButton.removeEventListener("focusout", onFocusOut);
      hud.dispose();
      root.remove();
      style.remove();
    }
  };
};
