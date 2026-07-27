import type { SurfacePlayHudSnapshot } from "../contracts";

export type SurfacePlayWeaponStatus = "READY" | "COOLDOWN" | "OVERHEATED" | "NO ENERGY";

export interface SurfacePlayHudOptions {
  readonly host: HTMLElement;
  readonly documentPort?: Pick<Document, "createElement">;
}

export interface SurfacePlayHud {
  update(snapshot: Readonly<SurfacePlayHudSnapshot>): void;
  dispose(): void;
}

const formatJoules = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);

const meterPercent = (value: number, maximum: number): number =>
  maximum <= 0 ? 0 : Math.min(100, Math.max(0, (value / maximum) * 100));

const weaponStatusFor = (snapshot: Readonly<SurfacePlayHudSnapshot>): SurfacePlayWeaponStatus => {
  if (snapshot.maximumHeatJoules > 0 && snapshot.heatJoules >= snapshot.maximumHeatJoules) return "OVERHEATED";
  if (snapshot.energyJoules <= 0) return "NO ENERGY";
  if (snapshot.cooldownSeconds > 0) return "COOLDOWN";
  return "READY";
};

const statusKey = (status: SurfacePlayWeaponStatus): string => status.toLowerCase().replace(" ", "-");

export const createSurfacePlayHud = (options: SurfacePlayHudOptions): SurfacePlayHud => {
  const documentPort = options.documentPort ?? document;
  const root = documentPort.createElement("section");
  root.id = "surface-play-hud";
  root.className = "surface-play-hud";
  root.setAttribute("aria-label", "Hestia surface suit status");

  const locationPanel = documentPort.createElement("header");
  locationPanel.className = "surface-play-hud__panel surface-play-hud__location";
  locationPanel.dataset.zone = "edge-top-left";
  const locationTitle = documentPort.createElement("strong");
  locationTitle.className = "surface-play-hud__title";
  locationTitle.textContent = "SURFACE · HESTIA";
  const region = documentPort.createElement("span");
  region.className = "surface-play-hud__eyebrow";
  region.textContent = "REGION · HESTIA";
  const objective = documentPort.createElement("span");
  objective.className = "surface-play-hud__objective";
  objective.textContent = "OBJECTIVE: TEST CUTTER ON SURVEY DRONE";
  locationPanel.append(locationTitle, region, objective);

  const suitPanel = documentPort.createElement("section");
  suitPanel.className = "surface-play-hud__panel surface-play-hud__suit";
  suitPanel.dataset.zone = "edge-bottom-left";
  suitPanel.setAttribute("aria-label", "Suit status");
  const suitHeading = documentPort.createElement("strong");
  suitHeading.className = "surface-play-hud__title";
  suitHeading.textContent = "SUIT";
  const movement = documentPort.createElement("span");
  movement.id = "surface-play-movement";
  movement.className = "surface-play-hud__state";
  const grounded = documentPort.createElement("span");
  grounded.id = "surface-play-grounded";
  grounded.className = "surface-play-hud__state";
  const energyLabel = documentPort.createElement("span");
  energyLabel.className = "surface-play-hud__meter-label";
  energyLabel.textContent = "ENERGY";
  const energyValue = documentPort.createElement("span");
  energyValue.id = "surface-play-energy-value";
  energyValue.className = "surface-play-hud__meter-value";
  const energyMeter = documentPort.createElement("div");
  energyMeter.id = "surface-play-energy-meter";
  energyMeter.className = "surface-play-hud__meter";
  energyMeter.setAttribute("role", "progressbar");
  energyMeter.setAttribute("aria-label", "Suit energy");
  energyMeter.setAttribute("aria-valuemin", "0");
  const energyFill = documentPort.createElement("span");
  energyFill.className = "surface-play-hud__meter-fill";
  energyFill.setAttribute("aria-hidden", "true");
  energyMeter.append(energyFill);
  suitPanel.append(suitHeading, movement, grounded, energyLabel, energyValue, energyMeter);

  const weaponPanel = documentPort.createElement("section");
  weaponPanel.className = "surface-play-hud__panel surface-play-hud__weapon";
  weaponPanel.dataset.zone = "edge-bottom-right";
  weaponPanel.setAttribute("aria-label", "Pulse Cutter status");
  const weaponHeading = documentPort.createElement("strong");
  weaponHeading.className = "surface-play-hud__title";
  weaponHeading.textContent = "PULSE CUTTER";
  const weaponStatus = documentPort.createElement("strong");
  weaponStatus.id = "surface-play-weapon-status";
  weaponStatus.className = "surface-play-hud__weapon-status";
  weaponStatus.setAttribute("role", "status");
  weaponStatus.setAttribute("aria-live", "polite");
  weaponStatus.setAttribute("aria-atomic", "true");
  const heatLabel = documentPort.createElement("span");
  heatLabel.className = "surface-play-hud__meter-label";
  heatLabel.textContent = "HEAT";
  const heatValue = documentPort.createElement("span");
  heatValue.id = "surface-play-heat-value";
  heatValue.className = "surface-play-hud__meter-value";
  const heatMeter = documentPort.createElement("div");
  heatMeter.id = "surface-play-heat-meter";
  heatMeter.className = "surface-play-hud__meter";
  heatMeter.setAttribute("role", "progressbar");
  heatMeter.setAttribute("aria-label", "Pulse Cutter heat");
  heatMeter.setAttribute("aria-valuemin", "0");
  const heatFill = documentPort.createElement("span");
  heatFill.className = "surface-play-hud__meter-fill";
  heatFill.setAttribute("aria-hidden", "true");
  heatMeter.append(heatFill);
  const cooldown = documentPort.createElement("span");
  cooldown.id = "surface-play-cooldown";
  cooldown.className = "surface-play-hud__cooldown";
  weaponPanel.append(weaponHeading, weaponStatus, heatLabel, heatValue, heatMeter, cooldown);

  const center = documentPort.createElement("section");
  center.className = "surface-play-hud__center-safe";
  center.dataset.zone = "center-safe";
  center.setAttribute("aria-label", "Surface focus status");
  const reticle = documentPort.createElement("span");
  reticle.className = "surface-play-hud__reticle";
  reticle.setAttribute("aria-hidden", "true");
  const target = documentPort.createElement("span");
  target.id = "surface-play-target";
  target.className = "surface-play-hud__target";
  const action = documentPort.createElement("span");
  action.id = "surface-play-action";
  action.className = "surface-play-hud__action";
  action.setAttribute("role", "status");
  action.setAttribute("aria-live", "polite");
  action.setAttribute("aria-atomic", "true");
  const block = documentPort.createElement("span");
  block.id = "surface-play-block";
  block.className = "surface-play-hud__block";
  block.setAttribute("role", "alert");
  block.setAttribute("aria-live", "assertive");
  block.setAttribute("aria-atomic", "true");
  center.append(reticle, target, action, block);

  root.append(locationPanel, suitPanel, weaponPanel, center);
  options.host.append(root);

  let disposed = false;

  return {
    update(snapshot) {
      if (disposed) return;

      root.dataset.mode = snapshot.mode;
      movement.textContent = snapshot.movementMode.toUpperCase();
      grounded.textContent = snapshot.grounded ? "GROUNDED" : "AIRBORNE";

      const energyPercent = meterPercent(snapshot.energyJoules, snapshot.maximumEnergyJoules);
      energyValue.textContent = `${formatJoules(snapshot.energyJoules)} / ${formatJoules(snapshot.maximumEnergyJoules)} J`;
      energyMeter.setAttribute("aria-valuemax", String(snapshot.maximumEnergyJoules));
      energyMeter.setAttribute("aria-valuenow", String(snapshot.energyJoules));
      energyMeter.setAttribute(
        "aria-valuetext",
        `${formatJoules(snapshot.energyJoules)} of ${formatJoules(snapshot.maximumEnergyJoules)} joules`
      );
      energyMeter.dataset.tone = snapshot.energyJoules <= 0 ? "critical" : energyPercent <= 25 ? "warning" : "neutral";
      energyFill.setAttribute("style", `inline-size: ${energyPercent.toFixed(2)}%`);

      const status = weaponStatusFor(snapshot);
      weaponPanel.dataset.status = statusKey(status);
      weaponStatus.textContent = status;

      const heatPercent = meterPercent(snapshot.heatJoules, snapshot.maximumHeatJoules);
      heatValue.textContent = `${formatJoules(snapshot.heatJoules)} / ${formatJoules(snapshot.maximumHeatJoules)} J`;
      heatMeter.setAttribute("aria-valuemax", String(snapshot.maximumHeatJoules));
      heatMeter.setAttribute("aria-valuenow", String(snapshot.heatJoules));
      heatMeter.setAttribute(
        "aria-valuetext",
        `${formatJoules(snapshot.heatJoules)} of ${formatJoules(snapshot.maximumHeatJoules)} joules`
      );
      heatMeter.dataset.tone = status === "OVERHEATED" ? "warning" : heatPercent >= 75 ? "warning" : "neutral";
      heatFill.setAttribute("style", `inline-size: ${heatPercent.toFixed(2)}%`);
      cooldown.textContent = `COOLDOWN ${snapshot.cooldownSeconds.toFixed(2)} S`;

      const hasTarget = snapshot.targetCondition !== "None";
      target.hidden = !hasTarget;
      target.textContent = hasTarget ? `TARGET · ${snapshot.targetCondition.toUpperCase()}` : "";

      action.hidden = snapshot.latestAction === null;
      action.textContent = snapshot.latestAction ?? "";
      block.hidden = snapshot.latestBlock === null;
      block.textContent = snapshot.latestBlock ?? "";
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.remove();
    }
  };
};
