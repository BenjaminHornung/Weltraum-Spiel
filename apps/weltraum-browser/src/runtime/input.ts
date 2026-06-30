import { vec3, type Vec3 } from "../core/vector";
import type { FlightControlMode } from "../core/types";

export type CameraMode = "ChaseLocked" | "OrbitInspect" | "Side" | "FreeInspect";

export interface ManualFlightInputState {
  readonly controlMode: FlightControlMode;
  readonly rcsEnabled: boolean;
  readonly sasEnabled: boolean;
  readonly mainThrottleCommand: number;
  readonly translationCommand: Vec3;
  readonly rotationCommand: Vec3;
  readonly cameraMode: CameraMode;
}

export const cameraModes: readonly CameraMode[] = ["ChaseLocked", "OrbitInspect", "Side", "FreeInspect"];

export const controlModes: readonly FlightControlMode[] = ["Cruise", "Precision", "Translation"];

const cycle = <T extends string>(values: readonly T[], current: T): T => values[(Math.max(0, values.indexOf(current)) + 1) % values.length];

export const nextCameraMode = (current: CameraMode): CameraMode => cycle(cameraModes, current);

export const nextControlMode = (current: FlightControlMode): FlightControlMode => cycle(controlModes, current);

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const createManualFlightInputState = (overrides: Partial<ManualFlightInputState> = {}): ManualFlightInputState => ({
  controlMode: overrides.controlMode ?? "Cruise",
  rcsEnabled: overrides.rcsEnabled ?? true,
  sasEnabled: overrides.sasEnabled ?? true,
  mainThrottleCommand: clamp01(overrides.mainThrottleCommand ?? 0),
  translationCommand: overrides.translationCommand ?? vec3(),
  rotationCommand: overrides.rotationCommand ?? vec3(),
  cameraMode: overrides.cameraMode ?? "ChaseLocked"
});

export const mergeManualFlightInputState = (
  current: ManualFlightInputState,
  update: Partial<ManualFlightInputState>
): ManualFlightInputState => ({
  controlMode: update.controlMode ?? current.controlMode,
  rcsEnabled: update.rcsEnabled ?? current.rcsEnabled,
  sasEnabled: update.sasEnabled ?? current.sasEnabled,
  mainThrottleCommand: clamp01(update.mainThrottleCommand ?? current.mainThrottleCommand),
  translationCommand: update.translationCommand ?? current.translationCommand,
  rotationCommand: update.rotationCommand ?? current.rotationCommand,
  cameraMode: update.cameraMode ?? current.cameraMode
});
