# Proposal: Browser Hestia Surface Lab Visual Fidelity V1

## Motivation
The deterministic browser microvoxel pipeline is technically inspectable, but its current screenshots do not yet communicate the approved Hestia visual direction. Terrain and material bands are too dark, the waterline is not convincing, debug overlays can dominate, and quarter-meter detail is not readable.

## Outcome
A later, separately approved change will make the existing Surface Lab terrain legible and recognizably Hestia-directed without changing canonical voxel, mesh, worker, cache, representation, or gameplay authority.

## Scope
- Presentation-only lighting, fog, palette, water, scatter/vegetation, overlays and camera composition.
- Technical HUD typography, focus appearance and responsive readability.
- A reviewed default, wireframe and quarter-meter screenshot matrix at 1920x1080 plus a 1280x720 responsive pass.

## Non-Goals
No generator/hash/topology change, gameplay, scanner, ship, outpost, mission, fake player, concept image at runtime, new dependency, backend contract, TestBridge or silent camera-fixture change.

## Prerequisite
The change starts only after the deterministic pipeline baseline is verified and committed.

## Success
Independent UI review accepts readable foreground/middle/background landforms, faceted material separation, restrained shoreline/water, grouped vegetation with open ground, fog depth, Hestia green/petrol/cyan direction, non-dominant overlays, readable quarter-meter detail, and accessible technical controls.
