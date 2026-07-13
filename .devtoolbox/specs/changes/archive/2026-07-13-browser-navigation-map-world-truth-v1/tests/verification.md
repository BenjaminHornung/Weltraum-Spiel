# Browser navigation map world truth verification

## Scope

- Branch: `feature/browser-navigation-map-world-truth-v1`
- Base: `f3de40994737ad49261d851a2cae0c636c893175`
- Normal browser URL: `/`
- New evidence flow does not enable or read `TestBridge`.

## Automated results

- `npm run test`: 23 files passed, 267 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- Focused map/world suite: 4 files passed, 53 tests passed.
- Focused runtime-map integration suite: 4 files passed, 32 tests passed.
- Focused map UI/source-guard suite: 4 files passed, 39 tests passed.
- Browser regression matrix with one worker: 15 tests passed across the new navigation-map flow, normal planner, world chunk streaming, multi-obstacle planner, and both UI parity specs.
- Final post-review Playwright run: new normal-runtime map flow plus normal planner, 5 tests passed.
- `git diff --check`: passed.
- Source guards: no `planner-system-map-clean`, `planner-ship-marker`, `planner-station-marker`, `.planner-map-label`, or `data-planner-target-id` CSS remains; `SYSTEM MAP` is absent from planner HTML.

## Runtime evidence

`browser-navigation-map-world-truth-evidence.json` records the exact selected target, preview hash, runtime layer counts, computed background, live ship displacement, and runtime heading change.

- Target: `range-1000m`, selected through its SVG runtime marker.
- Runtime layers: 6 targets, 3 route segments, 7 obstacles, and 14 resident world entities.
- Ship movement and heading changes are captured from the active-ship marker's runtime absolute coordinates and orientation data.
- FHD screenshot: `screenshots/browser-navigation-map-world-truth-fhd-1920x1080.png`.
- QHD screenshot: `screenshots/browser-navigation-map-world-truth-qhd-2560x1440.png`.

## Review

Spec compliance review found all requested runtime truth, projection, identity, orientation, streaming, interaction, naming, scale, and source-removal requirements represented in code and tests. Code-quality review removed the remaining unused legacy semantic-label CSS and stabilized identical map frames so clickable SVG markers are not replaced unnecessarily.

## Infrastructure note

The repository at the requested base does not track `Weltraum Spiel.sln`, `.slnx`, or any `.csproj`, so the repository-level `dotnet build "Weltraum Spiel.sln" --no-restore` command cannot run in this clean worktree (`MSB1009: Project file does not exist`). No .NET or Unity product files were changed by this browser-only task.
