# Scene Manifest: <SceneName>

Place this file at `Assets/_Weltraum/Scenes/<Category>/<SceneName>.manifest.md`.

## 1. Scene name
`<SceneName>`
- Use the stable scene identifier that matches the file name.

## 2. Scene type
`<Product | VerticalSlice | TestRange | UIShowroom | Archive>`
- Choose exactly one type and keep it aligned with the folder mapping.

## 3. Purpose
`<Short description of what this scene proves or ships>`
- Describe the scene outcome in one concise paragraph.

## 4. Owner systems
`<Weltraum.Navigation, Weltraum.UI, ...>`
- List the runtime or UI systems that own the scene behavior.

## 5. Allowed runtime roots
`<GameRoot, ServiceRegistry, UIRoot, DiagnosticsRoot, ...>`
- Name only the root objects and services that are allowed to exist here.

## 6. Required prefabs
`<PrefabA, PrefabB, ... or none>`
- State every prefab the scene depends on, or write `none`.

## 7. Required services
`<SceneLoader, InputModeController, ... or none>`
- Name the services that must be present before the scene is considered valid.

## 8. Input mode
`<Gameplay | UIOnly | TestHarness | Mixed>`
- Specify how the player or test harness interacts with the scene. Extend this list only with a documented justification recorded in Known Limits.

## 9. Camera policy
`<One active MainCamera, exception documented, evidence required>`
- Describe the camera setup and any allowed exception in plain terms.

## 10. UI policy
`<Player HUD only | Debug overlay allowed in TestRange | UI showcase only | ...>`
- State what UI is allowed and whether debug-only UI is excluded in player builds.

## 11. Test category
`<Product | VerticalSlice | TestRange | UIShowroom | Archive>`
- Choose the category that best matches the scene purpose and keep it aligned with the scene type. Set test category equal to scene type unless this scene is being used as a test boundary for a different category (for example, a VerticalSlice exercised as a TestRange).

## 12. Screenshot evidence requirements
`<Required views, states, captions, and acceptance images>`
- Document which screenshots or other evidence must be attached. See the structured `Screenshot Evidence Requirements` table below for the authoritative detail.

## 13. Scene validation checklist
`<Checklist items to verify before acceptance>`
- Capture the exact checks that must pass before the scene is accepted. See the structured `Scene Validation Checklist` below; check every applicable item per scene.

## 14. Known limits
`<Known constraints, deliberate gaps, or accepted exceptions>`
- Record anything that future agents must not misread as a bug.

## 15. Exit criteria
`<What must be true for this scene to be done>`
- Define the acceptance threshold in one short list.

> The next two structured sections are the authoritative detail for fields 12 and 13 above. Fill them per scene.

## Scene Validation Checklist

- [ ] Exactly one active MainCamera unless an exception is documented here.
- [ ] Exactly one EventSystem unless an exception is documented here.
- [ ] No Missing Scripts in the scene hierarchy.
- [ ] No null-critical serialized fields remain unresolved.
- [ ] No product logic exists in a scene-only script.
- [ ] Scene wiring stays composition-only.
- [ ] No Prototype dependency exists without a documented adapter.
- [ ] No debug-only UI is exposed in the Player Basic Preset.
- [ ] The scene loads without console errors.
- [ ] TestRange scenes can run headless or be automated where possible.
- [ ] Validation evidence is attached.
- [ ] Screenshot evidence is attached.

## Screenshot Evidence Requirements

| View / State | Required Capture | Purpose | Notes |
| --- | --- | --- | --- |
| Default scene start | Screenshot | Prove initial wiring and camera framing | Include HUD or harness state if relevant |
| Validation state | Screenshot or log excerpt | Prove checklist completion | Use the same scene build state that was validated |
| Exception state | Screenshot | Document any approved camera/UI exception | Only needed when the manifest declares an exception |

## Mandatory Scene Rules (core)

> These six rules are the core binding scene rules from AGENTS.md. The full binding validation rule set (including exactly one EventSystem, no null-critical serialized fields, no Prototype dependency without adapter, no debug-only UI in Player Basic Preset, scenes load without console errors) is operationalized in the Scene Validation Checklist above and documented in `docs/architecture/scene-registry-and-manifest-v1.md`.

- Scenes enthalten Wiring, keine Geschäftslogik.
- Genau eine aktive MainCamera, außer dokumentiert.
- Keine Missing Scripts.
- Keine Produktlogik als Scene-only Script.
- Scene-Änderungen brauchen Validation und Screenshot/Evidence.
- TestRange Scenes müssen headless/automatisierbar sein, wenn möglich.

## EXAMPLE: AutopilotTestRange

```md
# Scene Manifest: AutopilotTestRange

## 1. Scene name
`AutopilotTestRange`

## 2. Scene type
`TestRange`

## 3. Purpose
Deterministic harness for autopilot route planning, execution, and failure diagnostics.

## 4. Owner systems
`Weltraum.Navigation, Weltraum.Simulation, Weltraum.UI`

## 5. Allowed runtime roots
`GameRoot, ServiceRegistry, SceneLoader, DiagnosticsRoot`

## 6. Required prefabs
`AutopilotTestHarnessPrefab`

## 7. Required services
`SceneLoader, InputModeController, DiagnosticsService`

## 8. Input mode
`TestHarness`

## 9. Camera policy
One active MainCamera; any exception must be documented before acceptance.

## 10. UI policy
Debug diagnostics allowed; player-only HUD is not required.

## 11. Test category
`TestRange`

## 12. Screenshot evidence requirements
Start state, autopilot engage state, arrival/failure state, and diagnostics overlay capture.

## 13. Scene validation checklist
Single active MainCamera, one EventSystem, no Missing Scripts, headless run verified.

## 14. Known limits
Uses synthetic targets and simplified obstacle data.

## 15. Exit criteria
Route result is deterministic, evidence is attached, and validation passes.
```
