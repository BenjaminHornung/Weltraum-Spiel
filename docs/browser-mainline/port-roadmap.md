# Browser Mainline Port Roadmap

This roadmap orders browser-mainline work by evidence and contract risk. It intentionally starts with deterministic seams and feature intent, not broad game rewrites.

## M0: Decision And Documentation Baseline

Status: historical M0 baseline, now completed by the current v1 transition with browser app source, copied source evidence, tests and reports.

- Accept browser/Three.js as the new product mainline.
- Keep Unity as legacy/reference/evidence.
- Create ADR, architecture, feature-intent index, bug traps, roadmap and testing/evidence docs.
- Historical M0 constraint only: app/source/tests/spec copy targets were not modified during the baseline. The current v1 transition intentionally adds the browser app, tests, copied source evidence and reports.

## M1: Feature Intent Mining Gate

- Keep feature-intent cards current before implementation.
- Mine Unity and archived specs for behavior, terms, edge cases and evidence structures.
- Resolve contradictions into browser acceptance rules.
- Maintain known bug traps as blockers for new slices.

Gate: every feature slice has a feature-intent card, source paths, non-goals and test/evidence hints.

## M2: Browser Proving-Ground Matrix

Source paths:

- `docs/architecture/autopilot-v2-test-harness.md`
- `analysis/threejs-mainline/source-evidence/threejs-spike-test-summary.md`
- `analysis/threejs-mainline/source-evidence/threejs-spike-decision-report.md`

Required first matrix:

1. direct local arrival,
2. obstacle avoidance route,
3. insufficient fuel,
4. no authority,
5. no main thrusters,
6. brake reserve insufficient,
7. off-route divergence,
8. locked plan hash preservation,
9. explicit replan-required signal.

Gate: each scenario emits JSON, Markdown summary and screenshot/visual evidence where rendering is relevant.

## M3: Flight Authority / Fuel / Braking

Status: v1 implemented in the browser mainline app. `ShipMass`, `FuelState`, `AuthorityState`, `BrakingReserve` and `FlightSnapshot` are explicit TypeScript contracts consumed by executor, telemetry, HUD, TestBridge and scenario evidence. Cargo mass remains a stubbed field only.

Source paths:

- `Assets/Scripts/Prototype/PlayerShipController.cs`
- `Assets/Scripts/Prototype/MainThrusterBank.cs`
- `Assets/Scripts/Prototype/RcsThrusterController.cs`
- `docs/design-audits/2026-06-14-planning-consistency-audit.md`
- `analysis/threejs-mainline/source-evidence/unity-to-threejs-port-map.json`

Intent:

- Replace spike scalar stubs only when contracts/tests justify richer modeling.
- Model mass, fuel, thrust, RCS/SAS and brake reserve explicitly.
- Feed navigation estimates and HUD warnings from the same authority snapshot.

Gate: insufficient fuel, no authority and brake-reserve cases fail closed with visible reasons.

Open M3 follow-up points:

- richer thrust/engine curves beyond the current deterministic first approximation,
- real cargo/resource data contract instead of the stubbed `cargoMass`,
- route-validator scoring and player route-mode choices (belongs to M4, not this v1),
- frame descriptors for future non-local-space flight boundaries.

## M4: Navigation / Autopilot V2

Source paths:

- `docs/architecture/autopilot-v2-design.md`
- `docs/architecture/autopilot-v2-test-harness.md`
- `Assets/_Weltraum/Runtime/Navigation/AutopilotContracts.cs`

Intent:

- Expand planner candidate scoring.
- Add validator gates for clearance, fuel reserve, brake reserve, authority and unsafe targets.
- Preserve immutable `RoutePlan` and no executor-side replan.
- Add route modes: fastest, fuel saver, balanced and safe debug.

Gate: plan determinism and no-silent-replan tests remain green while richer planning is added.

## M5: HUD / Input / Telemetry Foundation

Source paths:

- `docs/ux/player-facing-status-authority-v1.md`
- `docs/ux/player-hud-map-builder-surface-flow.md`
- `docs/ux/unified-ui-input-mode-architecture.md`
- `docs/ux/debug-vs-player-ui-policy.md`

Intent:

- Implement explicit input modes.
- Render route/fuel/authority warning chips from owner snapshots.
- Keep TestBridge/debug panels separate from player UI.
- Add route timeline and target context only as ViewModels/snapshots.

Gate: browser evidence covers Basic HUD, selected target, autopilot active, warning state and debug hidden.

## M6: Low-Poly Open-World Runtime Foundation

Source paths:

- `docs/architecture/coordinate-spaces-and-floating-origin.md`
- `docs/architecture/real-scale-world-architecture.md`
- `docs/architecture/surface-local-frame-architecture.md`
- historical external package input "docs/open-world-low-poly-browser-plan.md" (not a live repo path in this worktree)

Intent:

- Add explicit frame descriptors and conversion tests.
- Add floating-origin projection shift invariants.
- Add simulation bubble membership.
- Add chunk/LOD/instancing smoke tests for low-poly fields.

Gate: absolute state and velocity remain unchanged by local projection shifts.

## M7: Browser Vertical Slice

Intent:

- Ship starts in local space.
- Player selects a target.
- Route preview appears.
- Autopilot executes or explains failure.
- HUD/radar show current status from snapshots.
- Playwright records telemetry and screenshot evidence.

Gate: proving-ground matrix plus player-facing HUD evidence pass in browser gates.

## Deferred Until Separate Feature Intent / Specs

- Ship Builder runtime and broad catalog.
- Surface-FPS runtime.
- Economy, missions, factions, drones.
- Real production asset migration.
- Full planet generation, terrain streaming, orbital mechanics and gravity-assist gameplay.

## Ordering Warnings

- Do not build surface landing/pickup before target taxonomy and exact target handoff are specified.
- Do not build cargo/mining loops before cargo mass/authority integration exists.
- Do not build ship-builder economy before resource/cargo and part metadata contracts are frozen.
- Do not claim world scale before frame/floating-origin invariants are covered by tests.
