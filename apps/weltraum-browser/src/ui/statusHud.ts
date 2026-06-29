import type { TelemetrySnapshot } from "../core";

export const renderStatusHud = (telemetry: TelemetrySnapshot): void => {
  const snapshot = telemetry.flightSnapshot;
  document.getElementById("plan-hash")!.textContent = telemetry.executor.planHash ?? "none";
  document.getElementById("mode")!.textContent = snapshot.authority.mode;
  document.getElementById("status")!.textContent = telemetry.executor.replanRequired
    ? `${telemetry.executor.status} / replanRequired`
    : telemetry.executor.status;
  document.getElementById("route-status")!.textContent = snapshot.routeValid ? "valid" : "invalid";
  document.getElementById("fuel-status")!.textContent = `${snapshot.fuel.status}: ${snapshot.fuel.current}/${snapshot.fuel.capacity} kg (reserve ${snapshot.fuel.reserve})`;
  document.getElementById("authority-status")!.textContent = `AP ${snapshot.authority.autopilotAvailable ? "ready" : "blocked"}, main ${snapshot.authority.mainThrustersAvailable ? "ready" : "blocked"}, RCS ${snapshot.authority.rcsAvailable ? "ready" : "blocked"}, SAS ${snapshot.authority.sasAvailable ? "ready" : "blocked"}`;
  document.getElementById("brake-status")!.textContent = snapshot.brakingReserve.canBrake
    ? `ready: ${snapshot.brakingReserve.availableDeltaV} m/s available`
    : `blocked: ${snapshot.brakingReserve.reasonCodes.join(", ")}`;
  document.getElementById("failure-reasons")!.textContent = snapshot.failureReasonCodes.length > 0 ? snapshot.failureReasonCodes.join(", ") : "none";
  document.getElementById("telemetry")!.textContent = JSON.stringify(
    {
      tick: telemetry.executor.tick,
      fuel: snapshot.fuel,
      mass: snapshot.mass,
      brakingReserve: snapshot.brakingReserve,
      authority: snapshot.authority,
      routeValid: snapshot.routeValid,
      failureReasonCodes: snapshot.failureReasonCodes,
      distanceToTarget: telemetry.executor.distanceToTarget,
      offRouteDistance: telemetry.executor.offRouteDistance,
      activeSegmentId: telemetry.executor.activeSegmentId
    },
    null,
    2
  );
};
