# Runbook — contained Hestia RD lab

Extract the entire archive into a new regular directory under C:/IFI_SourceCode. Keep MANIFEST.json and its external SHA256 together. No Git checkout, active A0 workspace, global config, environment credentials, package installation or node_modules is needed to run the included build or package checker. Use the already approved local runtimes below. These paths are explicit workstation prerequisites, not bundled binaries.

## Verify before start

From the extracted root in PowerShell:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/check-rd-results.mjs' './MANIFEST.json' '<SHA256 from MANIFEST.sha256>'
& 'C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe' -m http.server 5280 --bind 127.0.0.1 --directory './dist'
```

Require a free127.0.0.1:5280; do not kill a foreign listener or select a fallback port. Open http://127.0.0.1:5280/RD-RESULTS.html. Stop only your foreground Python service with Ctrl+C; the package delivery test proves this owned start/stop contract. file:// is insufficient for WebGL/WebGPU/fetch. Chromium path used by evidence: C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe. Native WebGPU availability is device-dependent; explicit unsupported is a valid capability outcome.

## Working URLs / commands

- /src/qa/combined-scene/index.html — Mount, choose combined-rigid/static, pause/seek/reset; ticks0/120/300/600/780/960/1140/1260/1500 show coast, wind, rain, opening, detach, rotation, removed branch, reload and drying. View color/normal/roughness/wetness/bounds/depth; reduced motion stops wind. Dispose releases owned resources.
- /src/tools/foliage-workbench/index.html — validate draft, Preview, Cancel, Undo/Redo; export/import versioned local JSON and optional custom sites. Imported dimensions/coverage/budgets are validated; no product writes.
- /src/tools/weather-workbench/index.html — presets/field/keyframes, pause/seek/reset and local scenario JSON. Invalid/remote/executable input is refused atomically.
- /src/tools/asset-inspector/index.html — mount, choose source slices, normals/bounds/owner solo/hide, findings and report export. Source/mesh discrepancies are findings, never auto-fixes. Large ambiguous imports are explicitly unsupported.
- /src/tools/variant-gallery/index.html — actual same-camera/tick A/B/A, fixed viewport presets and own bound comparison export. Its reference catalogue is historical; current sources/media are linked from results.
- /src/experiments/{foliage-wind,rain,wet-surface,material-light,camera-occlusion}/index.html — separate bounded modules. Lifecycle mode: foliage-wind/index.html?mode=lifecycle.
- /src/runner/index.html — frozen control replay. /src/experiments/three-webgpu/index.html — C1/C2 capability/comparison. Babylon DEFER and voxel-rays REJECT remain labelled experiments; do not interpret a failed candidate as a broken selected route.

## Source development / reproduction

Source, exact lockfile, original fixtures/recipes, test harnesses and code are included. Pinned dependencies (not redistributed node_modules) are already installed in the owner lab: Three0.185.1, Babylon9.29.0, TypeScript7.0.2, Vite8.1.5, Vitest4.1.11, Playwright1.61.1. Never silently install missing packages. With a regular contained matching dependency directory, run explicit approved Node commands:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './node_modules/typescript/bin/tsc' --noEmit
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './node_modules/vite/bin/vite.js' build
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' './scripts/run-source-bound-check.mjs' 'new-unique-unit-run' unit
```

Original BC00/BC01/exporter tests deliberately depend on the preserved pinned Git checkpoints under C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02 and its old immutable worktrees; that full historical test prerequisite is explicit. The runnable build/checker and new source-owned feature tests do not use active A0 code or secrets. New browser tests use playwright.resume.config.ts, pinned Chromium, verified local FFmpeg and a fresh .resume-runs ID. HESTIA_REN12_HOLDOUT=1 enables the withheld fault test. RD40's preserved original harness additionally requires a current build/source receipt from scripts/prepare-gallery-receipt.mjs; sourceCommit/tree are execution-anchor metadata, byte hashes identify changed sources. Fresh before/after hashes detect modifications during execution.

Read RESULTS.md, CORE_INDEX.json, CASE_EVIDENCE.json and ADOPTION_QUEUE.md before integrating. Source/data/owner limits, unsupported native costs, absent concept/video rights and human art gates remain explicit. Product integration, commits/pushes, release and art approval were not performed.
