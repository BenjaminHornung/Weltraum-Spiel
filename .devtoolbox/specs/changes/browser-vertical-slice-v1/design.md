# Browser Vertical Slice v1 Design

## Selected Approach

The vertical slice reuses the existing browser runtime as the owner of target selection, route preview, plan locking, simulation stepping, and telemetry snapshots. UI and Three.js rendering remain consumers of runtime snapshots and descriptors.

## Data Flow

1. Existing proving-ground targets remain the source of selectable browser targets.
2. Runtime command handling validates target selection and planner requests.
3. Runtime/core creates route previews and locked plans using existing planners.
4. HUD ViewModels convert telemetry snapshots into player-facing text/chips.
5. `DebugScene` renders the selected target/route and forwards UI commands to runtime.
6. Gated TestBridge exposes only evidence-oriented snapshots needed by E2E.

## Tradeoffs

- A compact radar-style status readout is in scope; a full radar/minimap/map implementation is deferred.
- Existing proving-ground targets are reused to avoid inventing new gameplay world data.
- Negative/failure evidence should use existing flight cases where possible rather than introducing new cargo/orbit/surface systems.
- Runtime commands should ignore/reject invalid payloads explicitly instead of throwing in player paths or falling back to default targets.

## Reuse Expectations

- Reuse `TargetDescriptor`, `RoutePlan`, `RoutePlanningResult`, `RouteValidationResult`, `FlightSnapshot`, and existing planner/executor invariants.
- Reuse `StatusHudViewModel` and warning-chip translation patterns from M5.
- Reuse M6 render-descriptor separation: renderers consume descriptors/snapshots and do not become world-truth owners.

## Verification Design

Unit tests should cover command/runtime behavior and HUD ViewModel output. E2E should cover visible browser behavior, route preview alignment, TestBridge gating, and screenshot/telemetry evidence. The known local Playwright launcher issue may require the documented Chrome executable fallback.

## Deferred Work

- Full radar/minimap navigation.
- Route-mode UI beyond the compact selected-target/preview state.
- Large-range/open-world streaming behavior.
- Landing/docking/orbit/cargo/surface/ship-builder gameplay.
