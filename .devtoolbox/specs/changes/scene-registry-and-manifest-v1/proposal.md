# Proposal: Scene Registry and Manifest v1

## Problem
The project needs a binding scene manifest template and registry rules before any new Clean-Core scene is built. The existing `scene-management-v1.md` document defines categories and broad validation intent, but it does not provide a complete, copy-paste-ready template or the full validation rule set that later agents can apply consistently.

## Outcome
A single authoritative scene manifest template, validation rules, architecture guidance, and DevToolbox spec will exist so later agents can create scenes consistently without inventing their own structure.

## Scope

### In scope
- The 7 files listed in the task brief.
- The 15 required manifest fields.
- The 6 mandatory validation rules plus the additional scene-management rules.
- The architecture doc that explains the scene registry approach.
- The reusable scene manifest template.

### Out of scope
- Any real `.unity` scene.
- Runtime code.
- Prefabs or ScriptableObjects.
- Applying the manifest to existing scenes.
- Additive-loading implementation.
- Automation tooling.

## Success Criteria
- All 7 files exist with mutually consistent content.
- The manifest template defines all 15 required fields.
- Validation rules cover the 6 mandatory rules.
- No scene, prefab, runtime, or Prototype file is changed.
- `specs_validate` passes.
- The test protocol documents that no `.unity` scene was modified.
