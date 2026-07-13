# Browser Playable Ship Flight Polish v1

## Problem

`browser-playable-ship-flight-v1` delivered playable browser flight, actuator-driven autopilot, procedural ship visuals, camera modes, VFX, and evidence. Final review intentionally deferred a small polish slice: safe Demo Scout GLB evaluation, ship marker/socket validation, HUD readability, desktop/mobile limitation wording, and small code readability/VFX polish.

## Outcome

The browser playable-flight demo remains functionally unchanged but is easier to trust and present:

- A safe GLB integration attempt is documented, with a browser-readable copy only if it does not require Unity, fragile dependencies, or `unity-legacy-final-2026-07:Assets/**` mutation.
- Procedural low-poly fallback remains available and validated.
- Ship visual descriptor exposes required markers/sockets for future authored-asset parity.
- Player HUD avoids raw velocity component triples while retaining scalar speed and keeping full vectors in telemetry/TestBridge.
- Main thruster VFX scale reflects acceleration magnitude instead of only world-X acceleration.
- Evidence clearly states mobile manual-flight limitation: keyboard/mouse manual flight on desktop; mobile is target/autopilot-only in this slice.

## Scope

In scope:

- `apps/weltraum-browser` render/runtime/UI/test/evidence updates needed for this polish slice.
- Optional browser public copy of `unity-legacy-final-2026-07:Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.glb` to `apps/weltraum-browser/public/ships/demo_scout_mk1.glb`, only after read-only validation and with no `unity-legacy-final-2026-07:Assets/**` changes.
- Direct `.devtoolbox/specs` task/evidence updates because DevToolbox MCP is unavailable for this repo path (`unauthorized_path`).

Out of scope:

- Unity startup, Unity install, Unity MCP, `unity-legacy-final-2026-07:Assets/**` edits/deletes.
- 1:1 MonoBehaviour port.
- New gameplay systems: weapons, ship builder, cargo, economy, missions, drones, surface/orbit/terrain runtime.
- Mobile touch/manual flight controls.
- Broad B4/B6/B7/B8/N3-N7 hardening beyond the explicit polish items in this change.

## Success Criteria

- Unit/build pass.
- Default Playwright E2E is attempted; if it fails only with known `browserType.launch: spawn UNKNOWN`, Chrome executable fallback passes.
- `git status --short -- Assets` remains clean.
- Evidence records GLB attempt result, fallback status, marker validation, HUD polish, VFX polish, and remaining limitations.
