# Spec - Player UI Evidence Manifest

## Requirements

- The Player UI evidence manifest MUST list the screenshot artifacts used by the current concept audit.
- Every manifest entry MUST resolve inside `.devtoolbox/specs/changes`.
- Every manifest entry MUST point to an existing PNG file.
- Every manifest entry MUST validate the PNG signature.
- Every manifest entry MUST validate the expected PNG width and height.
- Every manifest entry MUST validate a nontrivial file size.
- The manifest validator MUST fail on duplicate screenshot IDs or duplicate screenshot paths.
- The slice MUST NOT change Player HUD runtime behavior.

## Verification

- Unity MCP script validation passes for the new Editor test.
- Focused EditMode manifest validation test passes.
- Explicit solution build passes with `dotnet build "Weltraum Spiel.sln" --no-restore`.
- DevToolbox spec validation passes; generic root verifier limitations are documented if unchanged.
