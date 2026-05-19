# Draft Spec: archive-completed-prototype-specs

Status: draft only. Promote to `.devtoolbox/specs/changes/archive-completed-prototype-specs/` only if DevToolbox expects housekeeping work to be represented as a change. Otherwise execute as a documented maintenance task.

## Purpose

The repository contains multiple completed prototype changes. Before starting larger gameplay work, completed changes should be archived through the official DevToolbox workflow so active changes stay small and readable.

## In Scope

- Identify completed changes under `.devtoolbox/specs/changes/`.
- Run or request `specs_get_status` for each candidate.
- Run `specs_archive_preflight` before any archive operation.
- Archive only changes whose tasks, validation, and verification signals are acceptable.
- Document any warnings or blocked archive candidates.
- Do not modify Unity gameplay code.

## Out of Scope

- No gameplay implementation.
- No spec rewriting.
- No task completion changes unless required by documented preflight results.
- No destructive cleanup outside the DevToolbox archive operation.

## Candidate Changes

Likely candidates based on current repo history:

- `working-spaceflight-prototype`
- `thruster-rcs-flight-controls`
- `fix-rcs-authority-and-vfx-regression`
- `fix-chase-camera-stability`
- `prototype-flight-tuning-diagnostics`
- `prototype-target-hit-feedback`
- `prototype-module-configs`

The final list must come from DevToolbox status, not this draft.

## Acceptance Criteria

- Each archived change passed archive preflight or was explicitly skipped with a reason.
- Active changes no longer include completed specs that are safe to archive.
- No Unity Assets or scripts are changed.
- The final maintenance note lists archived, skipped, and blocked changes.

## Risks

- Some completed-looking changes may still be active because they are referenced by ongoing work.
- Preflight warnings should not be bypassed unless the tool explicitly allows it and the reason is documented.
