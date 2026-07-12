# Proposal: Browser Autopilot Bang-Bang Transit Profiles v1

## Motivation
The Browser autopilot currently treats Safe, Balanced, and Fast as fixed desired-speed caps (12/18/22 m/s). Long direct transfers therefore spend most of their duration cruising near a low cap; the 2500 m baseline is approximately 215.7 s, 147.6 s, and 123.0 s. The current controller can also apply desired acceleration as an unrestricted world-space vector before the ship aligns, so the visual flip is not causally required for braking.

## Outcome
Provide immutable acceleration-based transit policies and physical align/accelerate/flip/brake execution. Crewed ships obey finite comfort and safety envelopes, crewless drones can exceed biological limits while remaining physically bounded, Economy trades time for lower peak speed and impulse-based fuel use, and future Ship Builder data can populate an abstract propulsion capability snapshot.

## Scope
- Browser Flight/Core/Navigation contracts and execution.
- Stable hashed motion profiles and deterministic waypoint velocity constraints.
- Physical +X body-forward main thrust with RCS/SAS alignment.
- Deterministic phase, acceleration, gravity, coast, fuel, hash, and failure evidence.
- Unit and Playwright/TestBridge regressions plus documentation and evidence artifacts.

## Non-goals
- No concrete engine technology, part catalog, final efficiency curve, or Ship Builder implementation.
- No UI, renderer, resources, package, HTML/CSS, Unity, or `Assets/**` change.
- No route mutation, silent replan, position/velocity/orientation snap, velocity-zero shortcut, or weaker terminal gates.
- No claim that lower throttle alone saves fuel; Economy is measured through lower peak velocity/delta-v in the existing simple impulse model.

## Success
CrewSprint and DroneSprint perform true acceleration-limited transfers; human acceleration never exceeds configured 1.5 g; underpowered craft report comfort shortfall honestly; Economy is slower with lower peak speed and fuel/delta-v; 2500 m CrewSprint is substantially faster than the 123 s legacy Fast result; locked hashes, terminal capture, obstacle clearance, fail-closed cases, station keeping, and TestBridge query gating remain intact.