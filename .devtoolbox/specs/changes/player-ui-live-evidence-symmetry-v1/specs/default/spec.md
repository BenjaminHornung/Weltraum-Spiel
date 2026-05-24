# Spec - Player UI Live Evidence Symmetry

## Requirements

- Live runtime evidence MUST include a 4:3 cruise/objective screenshot created from the real `PrototypeBootstrap` runtime.
- Live runtime evidence MUST include a 4:3 navigation/autopilot screenshot created from the real `PrototypeBootstrap` runtime.
- The cruise/objective evidence MUST assert that Objective/Arena is visible, Combat has no active target, Docking is not visible, and HUD panels are separated.
- The navigation/autopilot evidence MUST assert that Navigation is visible, radar blips exist, a navigation target indicator exists, and HUD panels are separated.
- The slice MUST NOT change gameplay behavior or default debug UI routing.
- The concept audit documentation MUST reference the new 4:3 live evidence.

## Verification

- Unity MCP script validation passes for the changed PlayMode test.
- Focused PlayMode evidence test passes and writes the screenshots.
- Explicit solution build passes with `dotnet build "Weltraum Spiel.sln" --no-restore`.
- DevToolbox spec validation passes; generic root verifier limitations are documented if unchanged.
