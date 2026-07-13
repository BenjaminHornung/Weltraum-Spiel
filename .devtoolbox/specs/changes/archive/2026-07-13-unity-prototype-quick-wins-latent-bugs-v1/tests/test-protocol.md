# Quick-Wins Protocol

Date: 2026-06-13

## Item Results

1. Fixed timestep assumption: `0ab2b56` introduces the centralized autopilot tick duration and removes the hard 0.02 s clamp from the normal positive `Time.fixedDeltaTime` path. The change preserves the 0.02 s fallback only for invalid/non-positive fixed timesteps.

2. Duplicate planner ternary: `dd38998` removes the dead `avoidance ? A : A` branch in `PrototypeTrajectoryPlanner.BuildSegments`. Avoidance behavior is still represented by the segment type selected earlier in the method.

3. HUD catalog fallback load: `3f47fd2` gates the `Resources.Load<CelestialBodyCatalog>` fallback after the first failed lookup and resets the attempt state on binding changes. This removes the repeated per-frame missing-resource load.

4. Floating origin shift signal: `b8f2953` adds the origin-shift signal and wires the autopilot to invalidate/replan when the world origin shifts. The v0 behavior intentionally replans instead of trying to translate existing absolute plan samples.

5. HUD radar scene scans: `f75df42` moves normal radar targets to the waypoint manager path and gates fallback scans; `07217a8` resets the sampled fallback cache for deterministic tests and immediate post-invalidation scene visibility. The previous full-suite radar failures are fixed by the targeted 2/2 EditMode pass.

6. HUD text refresh throttling: `53c2fa8` gates heavy HUD snapshot/text work to 10 Hz, keeps dynamic marker/radar/indicator positions on a light per-frame path, and avoids redundant TMP writes with `SetTextIfChanged`.

7. Autopilot component caching: `e27936d` caches `RcsThrusterController` and `MainThrusterBank` lookups behind controller resolution instead of calling `GetComponent` in the hot path.

8. Repository hygiene: `4cff399` removes the Unity recovery artifact from `Assets/_Recovery/` and expands `.gitignore` for the local IDE/recovery/artifact noise called out by the sweep.

9. Find* audit: `59b4ffc` adds the documented audit and gates confirmed production fallback lookups without blindly rewriting debug/setup-only searches. The audit lives in `tests/find-audit.md`.

## Verification Summary

- Build: commit-view `dotnet build "Weltraum Spiel.sln" --no-restore` passed with 0 errors and known Unity/MSBuild warnings.
- Focused EditMode: HUD radar regressions passed 2/2 after `07217a8`.
- PlayMode smoke: `PrototypeRuntimeHudCameraBootstrapPlayModeTests.PlayMode_BootstrapShowsBoundHudShipAndDefaultNavigationTarget` passed 1/1.
- Full EditMode suite: still red in this shared workspace; see `acceptance-evidence.md`. The Abnahme checkbox for full green EditMode is left open.
