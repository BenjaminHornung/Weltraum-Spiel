# Proposal - player-hud-live-aspect-ratio-scaling-v1

## Problem

The Player HUD has focused responsive EditMode tests and live runtime captures for 16:9 and 4:3, but the user specifically called out that panels must not overlap and scaling must remain correct when the aspect ratio changes. The current live evidence does not yet prove ultrawide, 16:10, portrait, or minimum supported viewport behavior from the real Unity runtime.

## User Outcome

The Basic Player HUD is proven in the real `PrototypeBootstrap` runtime across a wider aspect-ratio matrix. Screenshots and tests show that fixed HUD panels, contextual controls, target indicators, radar, help modal, and bottom flight bar remain separated and inside the canvas when the capture size changes.

## Scope

- Reuse the existing uGUI/TextMeshPro Player HUD renderer.
- Add live PlayMode evidence for ultrawide, 16:10, portrait, and 640x480 minimum supported captures.
- Assert fixed panel separation and canvas containment in live runtime captures.
- Keep the existing 16:9 and 4:3 live runtime evidence unchanged.
- Store evidence under this change's `tests` folder.

## Non-Goals

- No decorative visual redesign.
- No fake builder, mission reward, or input-remapping UI.
- No replacement of IMGUI developer/debug windows.
- No change to autopilot, weapon, docking, or arena gameplay behavior.
