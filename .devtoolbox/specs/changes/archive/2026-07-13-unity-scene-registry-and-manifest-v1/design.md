# Design: Scene Registry and Manifest v1

## Source Draft
This design builds on `docs/legacy-unity/architecture/scene-management-v1.md` and `docs/legacy-unity/architecture/clean-core-runtime-architecture.md`. The first source defines the scene categories and the existing validation intent; the second source defines the clean-core boundary that scenes must respect.

## Architecture Direction
This slice is docs/template-only. It establishes a Markdown manifest convention for each scene instead of a code-driven registry, because scenes do not exist yet and the template must be usable before runtime tooling exists.

The manifest path is:

`Assets/_Weltraum/Scenes/<Category>/<SceneName>.manifest.md`

## Manifest Model
The manifest contains 15 fields:

1. Scene name
2. Scene type
3. Purpose
4. Owner systems
5. Allowed runtime roots
6. Required prefabs
7. Required services
8. Input mode
9. Camera policy
10. UI policy
11. Test category
12. Screenshot evidence requirements
13. Scene validation checklist
14. Known limits
15. Exit criteria

The manifest reuses the five scene categories from `scene-management-v1.md`. The folder names remain plural where the existing architecture uses plural folders, while the manifest `Scene type` values stay singular where needed:

- `Product` -> `Product/`
- `VerticalSlice` -> `VerticalSlices/`
- `TestRange` -> `TestRanges/`
- `UIShowroom` -> `UIShowroom/`
- `Archive` -> `Archive/`

## Validation Rules
The binding rules are intentionally kept simple and explicit so they can later be automated from the manifest fields:

- scenes contain wiring, not business logic
- exactly one active MainCamera unless an exception is documented
- no missing scripts
- no scene-only product logic script
- scene changes require validation and screenshot/evidence
- TestRange scenes should be headless/automatable where possible

The design also preserves the additional checks already named in `scene-management-v1.md`.

## Scope Decision (Template Only)
This work does not change any real scene, prefab, or runtime code. It only defines the documentation and template surface that future scene work will consume.

## Reuse
- Reuse the existing five scene categories.
- Reuse the clean-core rule that scenes may compose systems but must not contain business logic.
- Reuse the legacy scene guidance from the existing architecture docs.

## Risks
The main risk is template drift from future automation. That risk is mitigated by binding the validation checklist directly to the manifest fields and by keeping the template versioned alongside the architecture docs.
