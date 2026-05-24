# Spec - Player World Label Readability

## Requirements

- Training display mode MUST NOT create the large `ORIGIN` world label in the player view.
- Training display mode MUST NOT create the large station/hangar world label in the player view.
- FullDebug display mode MUST preserve the debug world labels.
- Removing Training labels MUST NOT remove origin or station data from `PrototypeTestEnvironment.Points`.
- Player HUD runtime evidence MUST include a fresh screenshot showing the normal cruise/objective view without the large `ORIGIN` label.

## Verification

- Unity MCP script validation passes for changed scripts.
- Focused EditMode `PrototypeTestEnvironmentValidationTests` passes.
- Focused PlayMode Player HUD evidence screenshot capture passes.
- Explicit solution build passes with `dotnet build "Weltraum Spiel.sln" --no-restore`.
- DevToolbox spec validation passes; generic root verifier limitations are documented if unchanged.
