# PrimeTween Evaluation Test Protocol

Date: 2026-06-18

Branch: `main` (user override; current PrimeTween evaluation was moved from the originally requested `asset-eval/primetween` branch to `main`)

## Scope

Evaluate PrimeTween import/API compatibility only.

Non-goals:

- No HUD/UI runtime implementation.
- No scene or prefab changes.
- No Prototype script changes.
- No Clean-Core dependency usage.
- No full Asset Store demo import into `Assets/Plugins/PrimeTween`.

## Preservation Step

Before switching to `main`, current uncommitted/untracked work was preserved with:

```powershell
git stash push --include-untracked -m "preserve pre-main work before PrimeTween evaluation"
```

Then `main` was checked out.

## Import Evidence

Imported as embedded UPM package:

- `Packages/com.kyrylokuzyk.primetween/`

Unity package lock update:

- `Packages/packages-lock.json` added embedded package entry for `com.kyrylokuzyk.primetween` with `version: file:com.kyrylokuzyk.primetween`, `source: embedded`, `depth: 0`.

Full `.unitypackage` demo content was not imported.

## Package Inspection

Package metadata:

- Name: `com.kyrylokuzyk.primetween`
- Display name: `PrimeTween`
- Version: `1.4.6`
- Declared Unity version: `2018.4`
- Runtime asmdef: `PrimeTween.Runtime`
- Editor asmdef: `PrimeTween.Editor`

Imported package count: 164 files.

Assembly definitions found:

- `Packages/com.kyrylokuzyk.primetween/Runtime/PrimeTween.Runtime.asmdef`
- `Packages/com.kyrylokuzyk.primetween/Editor/PrimeTween.Editor.asmdef`
- `Packages/com.kyrylokuzyk.primetween/Tests/PrimeTween.Tests.asmdef`
- `Packages/com.kyrylokuzyk.primetween/Editor/Tests/PrimeTween.Tests.Editor.asmdef`
- `Packages/com.kyrylokuzyk.primetween/Samples~/Examples/PrimeTween.Samples.asmdef`

## Unity MCP Checks

Unity MCP package manager check after import:

- Unity version: `6000.4.7f1`
- Package manager available: yes
- `is_compiling`: false after refresh completed
- `is_updating`: false

Refresh/compile request:

```text
unityMCP_refresh_unity(mode="force", scope="all", compile="request", wait_for_ready=true)
```

Result:

- Refresh triggered.
- Compile requested.
- Editor returned to ready/not-compiling state.

Console checks:

- PrimeTween filter: 0 error/warning entries.
- CS/compiler filter: no PrimeTween compile errors.
- Non-PrimeTween environment noise observed: Unity Asset Manager `[SerializeReference]` serialization exceptions and one MCP WebSocket warning.

## Product Code Reference Checks

Commands/checks performed:

```text
grep PrimeTween under Assets/_Weltraum/**/*.cs
grep PrimeTween under Assets/Scripts/Prototype/**/*.cs
grep PrimeTween under Assets/**/*.cs
```

Results:

- `Assets/_Weltraum/**/*.cs`: no matches.
- `Assets/Scripts/Prototype/**/*.cs`: no matches.
- `Assets/**/*.cs`: only pre-existing asset-inventory text mentions PrimeTween; no gameplay/runtime PrimeTween usage was added.

## Required Build Check

Command:

```powershell
dotnet build "Weltraum Spiel.sln" --no-restore
```

Result:

- Passed.
- Projects: 23.
- Errors: 0.
- Warnings: 49.
- Elapsed: 00:00:09.92.

Warning notes:

- Visible warnings were in imported PrimeTween editor/generator code, including `CS0162` unreachable code and `CS0649` never-assigned fields in `CodeGenerator`.
- No build errors were reported.

## Diff Scope Check

Expected PrimeTween evaluation changes:

- `Packages/com.kyrylokuzyk.primetween/`
- `Packages/packages-lock.json`
- `docs/legacy-unity/asset-evaluations/primetween-evaluation.md`
- `.devtoolbox/specs/changes/asset-primetween-eval-v1/tests/test-protocol.md`

Unexpected and must remain absent:

- `Assets/Scripts/Prototype/**`
- `Assets/_Weltraum/**` PrimeTween usage
- `Assets/Scenes/**`
- prefab changes
- `Assets/Plugins/PrimeTween/**` demo import
