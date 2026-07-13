# Test Protocol: Scene Registry and Manifest v1

Date: 2026-06-15

## Scope
Docs/spec/template only. No `.unity` scene, prefab, runtime code, or Prototype file is part of this slice.

## Files Added/Modified
- `.devtoolbox/specs/changes/scene-registry-and-manifest-v1/proposal.md`
- `.devtoolbox/specs/changes/scene-registry-and-manifest-v1/design.md`
- `.devtoolbox/specs/changes/scene-registry-and-manifest-v1/tasks.md`
- `.devtoolbox/specs/changes/scene-registry-and-manifest-v1/specs/scene-registry-and-manifest/spec.md`
- `.devtoolbox/specs/changes/scene-registry-and-manifest-v1/tests/test-protocol.md`
- `docs/legacy-unity/architecture/scene-registry-and-manifest-v1.md`
- `Assets/_Weltraum/Scenes/SCENE_MANIFEST_TEMPLATE.md`

## Validation

DevToolbox MCP `specs_validate` was run for this change and PASSED.

Tool: `servicerunner_specs_validate`
Arguments: `workspaceRoot = E:\Unity\Weltraum Spiel\Weltraum Spiel`, `changeName = scene-registry-and-manifest-v1`
Result: `isValid = true`, no warnings.

Checks (all Passed):
- Proposal — exists.
- Tasks — exists.
- Specs — 1 spec file found (`specs/scene-registry-and-manifest/spec.md`).
- Design — exists.
- Task parsing — 11 task items parsed.
- Change root — resolves inside `.devtoolbox/specs`.

No runtime build, Unity test, or dotnet test was executed, because this is a
docs/spec/template-only slice with no code or scene change.

## Runtime/Asset Scope Check
Expected scope proof commands from the repository root:

```powershell
git -C "E:\Unity\Weltraum Spiel\Weltraum Spiel" status --short
```

```powershell
git -C "E:\Unity\Weltraum Spiel\Weltraum Spiel" diff --name-only -- "*.unity" "*.prefab" "Assets/Scripts/Prototype"
```

Expected result: only the new documentation/template files appear in `git status --short`, and the `git diff --name-only` query returns no scene, prefab, or Prototype paths.

Explicit scope statement: no `.unity` scene was created or modified; no prefab or runtime code was touched.

Observed output from the repo root:

```text
 M .devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/implementation-plan.md
 M .devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-legacy-boundary-audit-v1/tasks.md
?? .devtoolbox/specs/changes/archive/2026-07-13-unity-prototype-legacy-boundary-audit-v1/tests/closeout-test-protocol.md
?? .devtoolbox/specs/changes/scene-registry-and-manifest-v1/
?? Assets/_Weltraum/Scenes/SCENE_MANIFEST_TEMPLATE.md
?? docs/legacy-unity/architecture/scene-registry-and-manifest-v1.md
?? weltraum_refactor_strategy_package/
```

```text
(no output)
```

Note: the repository already contained unrelated dirty files outside this slice; the scope check above only confirms that this slice did not touch any `.unity`, `.prefab`, or `Assets/Scripts/Prototype` paths.
