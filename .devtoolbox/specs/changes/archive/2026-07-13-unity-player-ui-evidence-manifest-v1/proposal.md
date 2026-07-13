# Proposal - player-ui-evidence-manifest-v1

## Problem

The Player HUD concept audit is now backed by many screenshot artifacts across several DevToolbox changes. The audit text references those screenshots, but there is no machine-checkable manifest proving the files still exist, are valid PNGs, and match the expected capture dimensions.

## User Outcome

The Player-facing UI document has a repeatable evidence inventory: a single manifest lists the screenshot proof used by the audit, and an Editor test validates that the referenced artifacts are present and structurally valid.

## Scope

- Add a player UI screenshot evidence manifest.
- Include current audit screenshots from the runtime audit, aspect-ratio scaling, world-label readability, and live-evidence symmetry slices.
- Add a focused Editor validation test for path safety, file existence, PNG signature, dimensions, and nontrivial size.
- Document verification results under this change.

## Non-Goals

- No new HUD behavior.
- No screenshot recapture.
- No visual redesign.
- No changes to deferred builder, reward, settings, remapping, or controller scope.
