# Proposal: browser-flight-feel-rcs-sas-parity-v1

## Problem

The browser prototype already has a control-mode enum, RCS/SAS toggles, and controller telemetry, but the feel contract is still shallow compared with Unity. Precision does not yet behave distinctly from Cruise, throttle lacks applied inertia/spool, RCS diagnostics stop at actuator-level flags, and SAS is still closer to damping than a readable stabilization mode. The result is technically functional but not yet parity-complete for flight feel.

## Outcome

Create a browser-native flight-feel package that makes Cruise, Precision, and Translation feel distinct; adds persistent throttle/spool behavior; clarifies RCS translation versus rotation authority; upgrades SAS readability; and introduces staged telemetry/visualization without depending on Unity's rigidbody or GLB/socket topology.

## Scope

- Analyze Unity flight-feel behavior and browser seams.
- Define the browser control contract for Cruise, Precision, and Translation.
- Specify throttle ramp/inertia, RCS authority split, SAS behavior, HUD telemetry, and visualization staging.
- Preserve the browser no-snap / no-idle-zero executor contract.
- Produce spec artifacts only; no product code, tests, or assets in this package.

## Non-goals

- No implementation in `apps/weltraum-browser/src/**`.
- No browser test edits in `apps/weltraum-browser/tests/**`.
- No evidence PNG or package file changes.
- No Unity code changes.
- No 1:1 port of Unity Rigidbody, nozzle hierarchy, or imported socket names.

## Constraints

- Stay independent from the GLB/ship-visual work in flight.
- Keep the browser-native control model as the source of truth.
- Preserve the current manual/idle request protections in the executor.
- Prefer browser telemetry and staged markers over copied Unity debug surfaces.

## Success criteria

- The analysis files clearly separate Unity capability from browser current state.
- The spec defines testable browser behavior for modes, throttle, RCS, SAS, HUD, and visualization.
- The task list is ordered, concrete, and verifiable.
- The package explicitly states what must not be ported 1:1 from Unity.
- The browser's current no-snap / no-idle-zero protections remain in the design contract.
