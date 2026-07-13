import type {
  ConcreteQualityPreset,
  GraphicsCapability,
  GraphicsSettingPath,
  GraphicsSettingsController,
  GraphicsSettingsControllerSnapshot,
  GraphicsSettingsV1
} from "../settings";

export interface GraphicsSettingsPanel {
  open(): void;
  close(): void;
  dispose(): void;
}

const capabilityLabels: Readonly<Record<GraphicsCapability["status"], string>> = {
  SupportedLive: "Live anwendbar",
  SupportedAfterRendererRestart: "Nach Renderer-Neustart",
  BrowserManaged: "Browsergesteuert",
  Unsupported: "Nicht unterstützt",
  Planned: "Geplant"
};

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function settingValue(settings: GraphicsSettingsV1, path: GraphicsSettingPath): string | number | boolean {
  switch (path) {
    case "display.renderScale": return settings.display.renderScale;
    case "display.maxDevicePixelRatio": return settings.display.maxDevicePixelRatio;
    case "display.fieldOfView": return settings.display.fieldOfView;
    case "display.renderDistance": return settings.display.renderDistance;
    case "display.fpsLimit": return settings.display.fpsLimit;
    case "display.fullscreenPreference": return settings.display.fullscreenPreference;
    case "shadows.quality": return settings.shadows.quality;
    case "textures.quality": return settings.textures.quality;
    case "lighting.quality": return settings.lighting.quality;
    case "lighting.toneMapping": return settings.lighting.toneMapping;
    case "lighting.exposure": return settings.lighting.exposure;
    case "lighting.environmentReflectionQuality": return settings.lighting.environmentReflectionQuality;
    case "effects.quality": return settings.effects.quality;
    case "effects.decorDensity": return settings.effects.decorDensity;
    case "effects.bloomPreference": return settings.effects.bloomPreference;
    case "effects.motionEffectsPreference": return settings.effects.motionEffectsPreference;
    case "antiAliasing.enabled": return settings.antiAliasing.enabled;
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDistance(value: number): string {
  return `${new Intl.NumberFormat("de-DE").format(value)} m`;
}

function focusableElements(dialog: HTMLDialogElement): readonly HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(
    "button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"
  )].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

export function createGraphicsSettingsPanel(controller: GraphicsSettingsController): GraphicsSettingsPanel {
  const dialog = requiredElement<HTMLDialogElement>("graphics-settings-dialog");
  const openButton = requiredElement<HTMLButtonElement>("graphics-settings-button");
  const cancelButton = requiredElement<HTMLButtonElement>("graphics-settings-cancel");
  const resetButton = requiredElement<HTMLButtonElement>("graphics-settings-reset");
  const applyButton = requiredElement<HTMLButtonElement>("graphics-settings-apply");
  const flightHud = requiredElement<HTMLElement>("flight-hud");
  const abortController = new AbortController();
  const inertState = new Map<HTMLElement, boolean>();
  let returnFocus: HTMLElement | null = null;

  const controls = [...dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting-path]")];
  const presetButtons = [...dialog.querySelectorAll<HTMLButtonElement>("[data-graphics-preset]")];

  const setInert = (blocked: boolean): void => {
    const targets = document.querySelectorAll<HTMLElement>(
      "#debug-scene, .hud-center-safe-area, #flight-hud > :not(#graphics-settings-dialog), #debug-hud"
    );
    if (blocked) {
      inertState.clear();
      for (const target of targets) {
        inertState.set(target, target.inert);
        target.inert = true;
      }
      return;
    }
    for (const [target, wasInert] of inertState) target.inert = wasInert;
    inertState.clear();
  };

  const render = (snapshot: GraphicsSettingsControllerSnapshot): void => {
    dialog.dataset.pending = String(snapshot.hasPendingChanges);
    if (snapshot.hasPendingChanges) delete dialog.dataset.lastApply;
    dialog.dataset.draftPreset = snapshot.draft.qualityPreset;
    dialog.dataset.confirmedPreset = snapshot.confirmed.qualityPreset;
    dialog.dataset.loadReason = snapshot.loadReason;

    const pending = requiredElement<HTMLElement>("graphics-settings-dialog")
      .querySelector<HTMLElement>("[data-testid='graphics-pending-state']");
    if (pending) {
      pending.dataset.state = snapshot.hasPendingChanges ? "Pending" : "Applied";
      pending.textContent = snapshot.hasPendingChanges ? "Änderungen ausstehend" : "Angewandt";
    }

    requiredElement<HTMLOutputElement>("graphics-preset-current").value = snapshot.draft.qualityPreset;
    for (const button of presetButtons) {
      const active = button.dataset.graphicsPreset === snapshot.draft.qualityPreset;
      button.setAttribute("aria-pressed", String(active));
      button.dataset.active = String(active);
    }

    for (const control of controls) {
      const path = control.dataset.settingPath as GraphicsSettingPath;
      const value = settingValue(snapshot.draft, path);
      if (control instanceof HTMLInputElement && control.type === "checkbox") {
        control.checked = Boolean(value);
      } else {
        control.value = String(value);
      }
      const capabilityId = control.dataset.capabilityId as keyof typeof snapshot.capabilities | undefined;
      if (capabilityId) {
        const status = snapshot.capabilities[capabilityId].status;
        control.disabled = status === "Unsupported" || status === "Planned";
        control.setAttribute("aria-disabled", String(control.disabled));
      }
    }

    requiredElement<HTMLOutputElement>("graphics-render-scale-value").value = formatPercent(snapshot.draft.display.renderScale);
    requiredElement<HTMLOutputElement>("graphics-max-dpr-value").value = `${snapshot.draft.display.maxDevicePixelRatio.toFixed(2)}x`;
    requiredElement<HTMLOutputElement>("graphics-fov-value").value = `${snapshot.draft.display.fieldOfView}°`;
    requiredElement<HTMLOutputElement>("graphics-render-distance-value").value = formatDistance(snapshot.draft.display.renderDistance);
    requiredElement<HTMLOutputElement>("graphics-exposure-value").value = snapshot.draft.lighting.exposure.toFixed(2);
    requiredElement<HTMLOutputElement>("graphics-decor-density-value").value = formatPercent(snapshot.draft.effects.decorDensity);

    for (const statusElement of dialog.querySelectorAll<HTMLElement>("[data-capability-for]")) {
      const settingId = statusElement.dataset.capabilityFor as keyof typeof snapshot.capabilities;
      const capability = snapshot.capabilities[settingId];
      statusElement.dataset.capabilityStatus = capability.status;
      statusElement.textContent = `${capabilityLabels[capability.status]} · ${capability.reason}`;
      statusElement.title = capability.reason;
    }

    const requested = snapshot.draft;
    const actual = snapshot.runtime;
    requiredElement<HTMLElement>("graphics-requested-values").textContent = [
      requested.qualityPreset,
      formatPercent(requested.display.renderScale),
      `DPR ${requested.display.maxDevicePixelRatio.toFixed(2)}`,
      `${requested.display.fieldOfView}°`,
      formatDistance(requested.display.renderDistance),
      requested.display.fpsLimit === 0 ? "Browser-FPS" : `${requested.display.fpsLimit} FPS`
    ].join(" · ");
    requiredElement<HTMLElement>("graphics-actual-values").textContent = [
      formatPercent(actual.renderScale),
      `DPR ${actual.effectivePixelRatio.toFixed(2)}`,
      `${actual.fieldOfView}°`,
      formatDistance(actual.renderDistance),
      actual.fpsLimit === 0 ? "Browser-FPS" : `${actual.fpsLimit} FPS`
    ].join(" · ");

    const restart = requiredElement<HTMLElement>("graphics-restart-state");
    restart.dataset.required = String(snapshot.restartRequired.length > 0);
    restart.textContent = snapshot.restartRequired.length > 0
      ? `Renderer-Neustart erforderlich: ${snapshot.restartRequired.join(", ")}`
      : "Kein Renderer-Neustart erforderlich";
    requiredElement<HTMLElement>("graphics-settings-message").textContent = snapshot.message;
    applyButton.disabled = !snapshot.hasPendingChanges;
    applyButton.setAttribute("aria-disabled", String(applyButton.disabled));
  };

  const cleanupClosedState = (): void => {
    setInert(false);
    delete flightHud.dataset.flightInputBlocked;
    delete document.body.dataset.graphicsSettingsOpen;
    openButton.setAttribute("aria-expanded", "false");
    const focusTarget = returnFocus ?? openButton;
    returnFocus = null;
    focusTarget.focus();
  };

  const close = (): void => {
    if (controller.getSnapshot().hasPendingChanges) controller.cancel();
    if (dialog.open) dialog.close();
    else cleanupClosedState();
  };

  const open = (): void => {
    const planner = document.getElementById("navigation-planner") as HTMLDialogElement | null;
    if (dialog.open || planner?.open || flightHud.dataset.plannerOpen === "true") return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    flightHud.dataset.flightInputBlocked = "true";
    document.body.dataset.graphicsSettingsOpen = "true";
    openButton.setAttribute("aria-expanded", "true");
    setInert(true);
    dialog.showModal();
    (dialog.querySelector<HTMLButtonElement>("[data-graphics-preset][aria-pressed='true']")
      ?? dialog.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
  };

  openButton.setAttribute("aria-haspopup", "dialog");
  openButton.setAttribute("aria-controls", dialog.id);
  openButton.setAttribute("aria-expanded", "false");
  openButton.addEventListener("click", open, { signal: abortController.signal });
  cancelButton.addEventListener("click", close, { signal: abortController.signal });
  resetButton.addEventListener("click", () => controller.resetDefaults(), { signal: abortController.signal });
  applyButton.addEventListener("click", () => {
    dialog.dataset.applying = "true";
    delete dialog.dataset.lastApply;
    applyButton.disabled = true;
    void controller.apply().then((result) => {
      dialog.dataset.lastApply = result.ok ? "Success" : "Failed";
      render(result.snapshot);
    }).finally(() => {
      delete dialog.dataset.applying;
    });
  }, { signal: abortController.signal });

  for (const button of presetButtons) {
    button.addEventListener("click", () => {
      controller.applyPreset(button.dataset.graphicsPreset as ConcreteQualityPreset);
    }, { signal: abortController.signal });
  }

  for (const control of controls) {
    const updateDraft = (): void => {
      const path = control.dataset.settingPath as GraphicsSettingPath;
      const value = control instanceof HTMLInputElement && control.type === "checkbox"
        ? control.checked
        : control.dataset.valueType === "number" || (control instanceof HTMLInputElement && control.type === "range")
          ? Number(control.value)
          : control.value;
      controller.updateSetting(path, value);
    };
    control.addEventListener(control instanceof HTMLInputElement && control.type === "range" ? "input" : "change", updateDraft, {
      signal: abortController.signal
    });
  }

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  }, { signal: abortController.signal });
  dialog.addEventListener("close", cleanupClosedState, { signal: abortController.signal });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }, { signal: abortController.signal });

  const unsubscribe = controller.subscribe(render);
  return {
    open,
    close,
    dispose() {
      if (dialog.open) close();
      unsubscribe();
      abortController.abort();
    }
  };
}
