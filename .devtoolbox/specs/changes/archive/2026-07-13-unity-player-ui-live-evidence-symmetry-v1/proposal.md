# Proposal - player-ui-live-evidence-symmetry-v1

## Problem

The Player UI concept audit has strong live runtime evidence for 16:9 cruise/navigation and for 4:3 combat/docking/help states. The remaining evidence gap is asymmetric live coverage: normal cruise/objective and active navigation/autopilot need the same real-runtime 4:3 proof so the document is tested across the core moment-to-moment states.

## User Outcome

The 4:3 Player HUD evidence shows the same player-facing information hierarchy as 16:9: cruise keeps Objective/Ship/Radar visible without Combat or Docking preemption, and navigation shows the real autopilot target, route/radar, and target indicator without overlapping panels.

## Scope

- Add focused PlayMode evidence using the real `PrototypeBootstrap` runtime.
- Capture 1024x768 cruise/objective and navigation/autopilot screenshots.
- Assert snapshot state, target/radar evidence, and panel separation.
- Document the new screenshots and verification results.
- Update the existing concept audit matrix/findings to reference the symmetric live evidence.

## Non-Goals

- No gameplay behavior changes.
- No new HUD panels or visual styling pass.
- No changes to autopilot physics, target selection, radar rendering, or debug UI.
- No builder/reward/remapping implementation.
