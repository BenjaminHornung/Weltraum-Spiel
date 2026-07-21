# Proposal: Browser Shared Trajectory Predictor Core v1

## Motivation

The browser mainline has deterministic Universe-time, frame, celestial-gravity, spatial and physics foundations, but no renderer-independent shared trajectory prediction contract. Navigation, autopilot, timewarp, encounters, background simulation and safety checks therefore lack one canonical prediction basis.

## Outcome

Add a pure TypeScript trajectory core that predicts finite, immutable state sequences from explicit Universe ticks, one inertially propagated point-mass gravity source and an ordered segment list. It reports deterministic samples, segment results, hazard facts, closest approaches, numerical metrics and one canonical signature.

## Scope

- New implementation only in apps/weltraum-browser/src/trajectory/**.
- GravityCoast, ConstantInertialAcceleration and ImpulseDeltaV segments.
- SemiImplicitEuler, VelocityVerlet and RungeKutta4 policies.
- Swept segment versus spherical hazard checks.
- Canonical serialization, fixed budgets, immutable results and deterministic ordering.
- Focused unit tests, real Playwright import verification, evidence and one browser-mainline contract document.

## Success criteria

- Every input, intermediate state and output is finite and frame/tick explicit.
- Equal semantic inputs produce equal canonical signatures regardless of hazard insertion order.
- Invalid frames, ordering, overlap, gaps, step alignment, hazards, budgets or numerical states reject fail-closed.
- All required focused and full Node 22 verification commands pass.
- Git scope contains only the approved allowlist paths.

## Non-goals

No SOI transitions, patched conics, N-body gravity, atmosphere, fuel use, variable mass, body-fixed thrust, renderer types, navigation/flight/autopilot/map/runtime/timewarp integration, gameplay decisions, performance timing, package-script changes, PR or merge.
