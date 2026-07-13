# Draft Spec Roadmap

Status: draft backlog, not active DevToolbox changes yet.
Date: 2026-05-19

These documents are intentionally stored under `docs/legacy-unity/spec-drafts/` so they do not look like active validated changes. A future Codex/DevToolbox run should promote one draft at a time into `.devtoolbox/specs/changes/<changeName>/` with `proposal.md`, `design.md`, `specs/<capability>/spec.md`, and `tasks.md`, then run DevToolbox validation.

## Current Prototype Baseline

The project already has a working Unity prototype with generated primitive ship visuals, zero-gravity Rigidbody flight, fuel consumption, main thruster, gimballed thrust, transform-driven RCS nozzles, SAS, chase camera, debug overlay, projectile gun, target hit feedback, and prototype module config tuning.

## Recommended Execution Order

1. `archive-completed-prototype-specs`
   - Housekeeping: archive completed active changes after DevToolbox preflight.
2. `prototype-waypoint-navigation-autopilot-v0`
   - Highest priority gameplay-enabler. Realistic controls need navigation assist before larger gameplay loops. This draft explicitly includes initial velocity and remaining-fuel feasibility checks.
3. `prototype-regression-test-harness`
   - Add repeatable smoke tests before the prototype grows further.
4. `controller-feel-validation-pass`
   - Manually verify and tune controller flight feel.
5. `prototype-ship-blueprint-v0`
   - Start converting the generated fixed ship into data-driven ship construction.
6. `prototype-ship-validation-v0`
   - Add basic validity rules for blueprint-driven ships.
7. `simple-ship-builder-v0`
   - First actual player-facing ship builder prototype.
8. `prototype-combat-health-explosions`
   - Add target health, projectile damage, and visible destruction feedback.
9. `prototype-weapon-archetypes-v0`
   - Compare gun, railgun, laser, and early missile behavior.
10. `space-pve-arena-loop-v0`
   - First simple enemy/mission loop in space.
11. `mission-reward-part-unlock-v0`
   - Mission reward/currency loop that unlocks parts for ship building.
12. `prototype-autopilot-arrival-tuning`
   - Follow-up after the first autopilot works; tune overshoot, lateral velocity, arrival quality, and low-fuel conservative behavior.
13. `prototype-nav-target-ui`
   - HUD markers and navigation readouts after autopilot model stabilizes.
14. `prototype-docking-approach-assist`
   - Precise final approach mode for stations/docking targets.
15. `prototype-gravity-well-navigation-research`
   - Later research slice for gravity wells and slingshot navigation.

## Later Star-Citizen-Scope Drafts

These are intentionally later-stage drafts. They should not be promoted before the spaceflight, navigation, ship-building, and combat core is stable.

16. `basic-ground-walkaround-prototype`
    - Minimal on-foot controller and one interaction object.
17. `ship-to-ground-transition`
    - Controlled mode switch between ship flight and walkaround gameplay.
18. `small-outpost-pve-mission`
    - Tiny ground/outpost mission linked back to ship progression.
19. `planet-landing-zone-prototype`
    - Minimal planet/moon visual, landing-zone marker, lights, and transition point.

## Promotion Rule

Do not promote multiple drafts into active implementation at once. Pick one draft, create a real DevToolbox change, validate it, implement it, verify it, then close/archive it before pulling the next larger gameplay feature.

## Product Direction Guardrail

The project should continue to focus on the unique selling point: modular self-designed ships whose physical modules affect flight, navigation, combat, fuel, and mission capability. Planetary cities, ground FPS, multiplayer, and large-scale persistence remain later-stage work until the ship/navigation/combat loop is stable.
