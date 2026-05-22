# Capability: spec-maintenance-archive-completed-changes

## Requirement
The repository SHALL provide a validated maintenance record for archiving completed DevToolbox changes without changing gameplay code.

## Scenarios
- When the workspace contains completed unarchived changes, the maintenance run SHALL check DevToolbox status and archive only candidates reported as ready.
- When validation is blocked by evidence-only folders, the maintenance run MAY add minimal proposal/spec/tasks artifacts that describe the already-recorded evidence.
- When a candidate is incomplete, in progress, missing required artifacts, or otherwise not archive-ready, the maintenance run SHALL skip it and record the reason.
- The maintenance run SHALL keep a protocol listing preflight inputs, archived changes, skipped changes, blocked changes, and post-archive validation results.

## Constraints
- Do not modify Unity gameplay scripts, scenes, prefabs, materials, generated visuals, imported art, or runtime assets for this maintenance capability.
- Use DevToolbox archive tooling instead of manual moves.
- Preserve existing evidence artifacts.
