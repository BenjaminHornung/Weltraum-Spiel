# Proposal

## Change
`spec-maintenance-archive-completed-changes`

## Problem
Completed DevToolbox changes are still mixed into the active `.devtoolbox/specs/changes/` folder. That makes validation noisy, obscures the truly active gameplay work, and causes follow-up agents to reread old completed specs.

Two evidence-only folders also contain useful test artifacts but no proposal/spec/tasks metadata, which blocks whole-workspace `specs_validate` before any archive preflight can be trusted.

## Goal
Validate the active spec workspace, repair metadata-only blockers when required for preflight, archive completed changes through DevToolbox archive tooling, and document which changes were archived, skipped, or blocked.

## Scope
- Use DevToolbox status, validation, and archive tools as the source of truth.
- Create or repair documentation-only spec artifacts needed to make validation meaningful.
- Keep test evidence under the related change `tests/` folders.
- Do not modify Unity gameplay scripts, scenes, prefabs, materials, or generated/imported art as part of this maintenance change.

## Non-Goals
- No gameplay implementation.
- No broad spec rewrite of in-progress changes.
- No manual filesystem cleanup outside the official DevToolbox archive operation.
