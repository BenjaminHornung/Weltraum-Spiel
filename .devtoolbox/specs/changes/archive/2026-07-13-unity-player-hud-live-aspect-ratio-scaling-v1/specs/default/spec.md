# Spec - Player HUD Live Aspect-Ratio Scaling

## Requirements

- The Basic Player HUD MUST have live PlayMode screenshot evidence from the real `PrototypeBootstrap` runtime at ultrawide, 16:10, portrait, and 640x480 minimum supported capture sizes.
- The evidence captures MUST use explicit capture dimensions and re-apply the HUD responsive layout before rendering.
- Fixed HUD panels MUST NOT overlap in the captured runtime states.
- Active fixed HUD panels MUST remain inside the HUD canvas bounds in the captured runtime states.
- Navigation and Combat control rows MUST remain inside the context panel when active.
- The slice MUST preserve existing 16:9 and 4:3 runtime evidence behavior.
- The slice MUST NOT introduce fake builder, mission reward, or remapping UI for deferred concept items.

## Verification

- Unity MCP script validation passes for changed scripts.
- Focused EditMode HUD validation passes.
- PlayMode `PlayerHudEvidence` tests pass and generate the new screenshot matrix.
- Explicit solution build passes with `dotnet build "Weltraum Spiel.sln" --no-restore`.
- DevToolbox spec validation passes; generic verifier limitations are documented if they remain blocked by the workspace root shape.
