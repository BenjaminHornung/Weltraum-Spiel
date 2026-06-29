import type { TelemetrySnapshot } from "../core";

export const renderStatusHud = (telemetry: TelemetrySnapshot): void => {
  document.getElementById("plan-hash")!.textContent = telemetry.executor.planHash ?? "none";
  document.getElementById("mode")!.textContent = telemetry.ship.authority.mode;
  document.getElementById("status")!.textContent = telemetry.executor.replanRequired
    ? `${telemetry.executor.status} / replanRequired`
    : telemetry.executor.status;
  document.getElementById("telemetry")!.textContent = JSON.stringify(
    {
      tick: telemetry.executor.tick,
      fuel: telemetry.executor.fuel,
      distanceToTarget: telemetry.executor.distanceToTarget,
      offRouteDistance: telemetry.executor.offRouteDistance,
      activeSegmentId: telemetry.executor.activeSegmentId
    },
    null,
    2
  );
};
