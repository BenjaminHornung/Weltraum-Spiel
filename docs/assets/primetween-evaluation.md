# PrimeTween Evaluation

Date: 2026-06-18

Branch: `main` (user override; earlier `asset-eval/primetween` branch requirement was abandoned)

## Summary

PrimeTween was imported only as an embedded Unity package for compatibility evaluation. No HUD, UI, scene, prefab, Prototype, or Weltraum runtime code was changed to use it.

Decision: Defer adoption. Keep PrimeTween available only as an evaluated candidate for later presentation-layer animation work, behind a small adapter if adopted.

## Source

- Asset Store cache: `C:/Users/benni/AppData/Roaming/Unity/Asset Store-5.x/Kyrylo Kuzyk/Editor ExtensionsAnimation/PrimeTween High-Performance Animations and Sequences.unitypackage`
- Imported package: embedded UPM package from the asset archive.
- Package name: `com.kyrylokuzyk.primetween`
- Display name: `PrimeTween`
- Version: `1.4.6`
- Declared Unity version: `2018.4`
- Documentation URL: `https://github.com/KyryloKuzyk/PrimeTween`
- Changelog note for `1.4.6`: VisualElement Position/Rotation/Scale animations use `VisualElement.style.translate/rotate/scale` instead of `ITransform` in Unity 6.2 and newer.

## Import Method

The full `.unitypackage` was not imported because it contains demo content under `Assets/Plugins/PrimeTween`, including demo scenes, scripts, materials, textures, and installer assets. Importing those assets would exceed the evaluation scope.

Instead, the embedded UPM package was extracted into:

- `Packages/com.kyrylokuzyk.primetween/`

Unity registered the embedded package in:

- `Packages/packages-lock.json`

No `Assets/Plugins/PrimeTween` folder was imported.

## Imported Package Shape

Package file count: 164 files.

Top-level package areas:

- `.attestation.p7m`
- `Documentation/`
- `Editor/`
- `Runtime/`
- `Samples~/`
- `Tests/`
- `changelog.md`
- `license.md`
- `package.json`
- `readme.md`

Assembly definitions:

- `Runtime/PrimeTween.Runtime.asmdef`
- `Editor/PrimeTween.Editor.asmdef`
- `Tests/PrimeTween.Tests.asmdef`
- `Editor/Tests/PrimeTween.Tests.Editor.asmdef`
- `Samples~/Examples/PrimeTween.Samples.asmdef`

Runtime entry points include:

- `Easing.cs`
- `PrimeTweenConfig.cs`
- `Sequence.cs`
- `Shake.cs`
- `ShakeSettings.cs`
- `Tween.cs`
- `TweenSettings.cs`
- `TweenSettingsT.cs`

## Assembly/Dependency Notes

`PrimeTween.Runtime` is auto-referenced and references:

- `Unity.TextMeshPro`
- `Unity.Burst`

`PrimeTween.Editor` is Editor-only and references `PrimeTween.Runtime`.

The package contains test assemblies guarded by `UNITY_INCLUDE_TESTS`, with `autoReferenced` disabled. Samples reference `Unity.InputSystem`, but samples live under `Samples~/` and were not imported into `Assets`.

Architecture implication: because `PrimeTween.Runtime` is auto-referenced, code in compatible assemblies can reference it without adding an asmdef reference. The project should still avoid direct PrimeTween calls from Clean-Core or authority/model code. If adopted later, restrict usage to presentation-layer adapters or view components.

## Compatibility Checks

Unity Editor:

- Version: `6000.4.7f1`
- Unity MCP package manager status after refresh: available, not compiling, not updating.
- Unity refresh/compile request completed after import.

Console findings:

- PrimeTween-specific console filter: 0 error/warning entries.
- Compiler/CS filter did not show PrimeTween compile errors.
- Existing Unity/MCP environment noise was present: Unity Asset Manager `[SerializeReference]` serialization exceptions and one MCP WebSocket warning. These did not reference PrimeTween.

Code reference checks:

- `Assets/_Weltraum/**/*.cs`: no PrimeTween references.
- `Assets/Scripts/Prototype/**/*.cs`: no PrimeTween references.
- `Assets/**/*.cs`: only pre-existing asset-inventory text mentions PrimeTween; no runtime usage was added.

Scope checks:

- No HUD/UI runtime changes.
- No scene or prefab changes.
- No Prototype script changes.
- No Clean-Core dependency usage added.
- No full demo import under `Assets/Plugins/PrimeTween`.

## Fit For Weltraum

PrimeTween is technically plausible for later UI/HUD/Map animation polish because it provides a focused tweening API, sequences, easing, shake support, and UI-related extension coverage. It is a better fit for small presentation polish than for domain or authority logic.

It should not become a general application dependency. Current UI architecture rules require player-facing views to render authority-provided snapshots and avoid self-computed status, navigation, legal, cargo, or autopilot state. Tweening must therefore stay visual-only and must not drive gameplay state or status authority.

Recommended adoption boundary if used later:

- Create a small presentation adapter under the UI/presentation layer.
- Keep PrimeTween references out of Clean-Core, planners, executors, authority snapshots, and model code.
- Use it only for view transitions, HUD affordance polish, map panel motion, warning-chip emphasis, and other non-authoritative visual effects.
- Do not animate hidden state changes that would obscure current mode/status authority.

## Decision

Defer adoption.

Rationale:

- Import/compile compatibility looks acceptable in Unity `6000.4.7f1`.
- The package adds an auto-referenced runtime assembly, so direct usage must be governed by architecture boundaries.
- There is no immediate UI implementation in scope.
- Future adoption should happen only with a dedicated UI/presentation task and tests/screenshots for the affected HUD/Map flow.
