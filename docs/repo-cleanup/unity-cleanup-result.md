# Browser Mainline Repository Cleanup Result

Date: 2026-07-13

## Identity and immutable Unity archive

- Starting commit: `8383487f89f6eb6e63140def564052ac86de259a`
- Synchronized PR base: `bb8ef8378295c1788866d376ded059563229183b`
- Cleanup branch: `cleanup/browser-mainline-repository-v1`
- Archive tag: `unity-legacy-final-2026-07`
- Archive branch: `archive/unity-legacy-final-2026-07`

The tag and archive branch were created and pushed before destructive cleanup.
Both resolve exactly to the starting commit. No history rewrite, force push or
LFS history migration was performed.

Before final PR verification, the cleanup branch merged the then-current
`origin/main` normally. This retained 42 intervening Browser/documentation
commits without moving either immutable Unity archive ref.

## Removed active project structure

The cleanup removes these complete top-level Unity/editor structures from the
active branch:

```text
Assets/
Packages/
ProjectSettings/
weltraum_refactor_strategy_package/
.idea/
.vsconfig
UpgradeLog.htm
uam/
```

The emptied top-level `analysis/` directory is also removed after its useful
contents moved into current browser docs or Unity legacy evidence. No tracked
Unity `.cs`, `.unity`, `.asmdef`, `.asmref` or `.meta` project file remains.

## Moved and retained material

- `docs/current-prototype-state.md` moved to
  `docs/legacy-unity/current-prototype-state-2026-06-15.md`.
- Root `design-qa.md` moved to `docs/browser-mainline/design-qa-v3.md`.
- `analysis/threejs-mainline/source-evidence` moved to
  `docs/legacy-unity/source-evidence`.
- Browser implementation/final reports moved from `analysis/` to
  `docs/browser-mainline`.
- Unity-only architecture, roadmap, asset inventory/evaluation, performance,
  agent-prompt, UI-concept and DevToolbox draft/audit documents moved under
  `docs/legacy-unity`.
- Five compact intent records preserve flight, combat, docking, celestial and
  ship material/VFX semantics without promoting MonoBehaviour architecture.

Original reusable art is retained in neutral paths:

- 11 FBX and 11 GLB ship/part exports under
  `art/source/ships/prototype-ship-kit/exports`;
- the part/socket/marker manifest under
  `art/source/ships/prototype-ship-kit/metadata`;
- the Blender source, eight reference renders, validator and validation report
  under `art/blender`;
- the unchanged runtime Demo Scout at
  `apps/weltraum-browser/public/ships/demo_scout_mk1.glb`.

The runtime GLB remains a 127,108-byte real GLB with `glTF` signature and the
same Git blob as the starting commit. `ProceduralFallback` remains present.

## DevToolbox consolidation

The machine-readable inventory contains all 178 initial change directories plus
seven Browser changes introduced across the four synchronized `main` snapshots,
for 185 classified directories in total. Persistence/Universe-Time/Event keeps
its seven explicitly unchecked tasks, Graphics Settings keeps 22 unchecked
tasks, and both remain active. The synchronized Ship Builder change has no open
tasks but remains active as current mainline documentation rather than being
retroactively archived by the cleanup.
Physical consolidation results:

- active changes before/after: 112 / 35 (seven arrived from synchronized `main`);
- archived change directories before/after: 66 / 142;
- 79 active directories moved to dated archive areas: 58 Unity, 20 completed
  browser changes and 1 completed reconciliation record;
- 8 residual duplicate directories deleted after confirming canonical archive
  copies (5 formerly active, 3 already archived);
- 20 Unity prototype drafts and the dated 2026-06-14 audit moved out of the
  active `.devtoolbox/specs` area into `docs/legacy-unity`;
- no browser task checkbox was changed or silently closed.

DevToolbox MCP was installed but rejected the isolated worktree with
`unauthorized_path`. Clear moves used the documented inventory plus manual
schema/task/evidence preflights; doubtful browser reconcile/review records remain
active.

## Before and after metrics

| Metric | Before | After |
| --- | ---: | ---: |
| Tracked files | 3,835 | 2,161 |
| Git LFS paths | 669 | 410 |
| Active DevToolbox change directories | 112 | 35 |
| Archived DevToolbox change directories | 66 | 142 |
| Tracked Browser evidence files | 152 | 164 |

Git object database before cleanup: 14.59 MiB packed plus 791.90 KiB loose.
At the latest pre-delivery measurement after current-main synchronization it
contained 16.38 MiB packed plus 180.58 KiB loose; subsequent commits can change
the loose-object count without changing the cleaned tree.

`git count-objects` measures the shared object database, including retained
history, rather than the logical size of the cleaned checkout. Removing current
paths does not rewrite or shrink archived history.

## Browser evidence and LFS integrity

All 152 initial browser evidence files were classified. Only five generated,
unreferenced verification logs were deleted. All screenshots, JSON, Markdown
evidence, required baselines and conservative unreferenced records remain.
The synchronized Browser mainline added seventeen tracked current evidence files,
producing the final tracked count of 164 without deleting or rewriting those
additions. Ignored local Playwright report/output directories are not counted.

The required rejected UI baselines are real PNG payloads (not pointers in the
working tree) and match their LFS OIDs. The art preservation scope contains no
unresolved LFS pointer file.

The synchronized low-poly `public/favicon.png` is also an available LFS-backed
PNG. Browser CI now includes it in the selective LFS restore and signature gate,
so `lfs: false` checkout mode cannot silently serve the pointer text as an icon.

The starting commit already referenced four unavailable LFS payloads. GitHub
LFS returns HTTP 404 and no exact local payload exists. Three were historical
screenshots and one was a Unity tutorial icon. The active branch removes those
broken pointers without fabricating replacements; the immutable archive refs
preserve the original pointer state and the limitation is recorded in
`docs/legacy-unity/legacy-manifest.md`.

## Updated repository truth

- Root README, AGENTS and `.agent/PLANS.md` now treat
  `apps/weltraum-browser` as the product mainline.
- `docs/current-mainline-state.md` records only browser runtime truth.
- `.gitignore` is browser/Node/art-oriented.
- `.gitattributes` has no Unity YAML merge/type rules and retains appropriate
  text/EOL and existing LFS rules for binary art/evidence. GLB files remain
  regular Git blobs; no retroactive GLB-to-LFS migration was introduced.
- `.github/workflows/browser-mainline-ci.yml` keeps its existing jobs and group
  design. Its selective artifact restore now includes the synchronized favicon;
  the current groups preserve Combat, Persistence and Ship Builder in Core plus
  Graphics Settings in UI from current `main`.
- Historical Browser evidence preserves its capture-time Unity paths and carries
  cleanup annotations pointing to `unity-legacy-final-2026-07:<path>`. Current
  non-historical references use archive-object or neutral `art/` paths.

## Verification

All fresh browser commands ran with Node `v26.2.0`:

| Command / check | Result |
| --- | --- |
| `npm ci` | PASS; 60 packages audited, 0 vulnerabilities |
| `npx tsc -p tsconfig.json` | PASS |
| `npm run test` | PASS; 64 files, 664 tests |
| `npm run build` | PASS; production bundle built (existing chunk-size warning only) |
| `npm run test:e2e:core` | PASS; 27 tests, including synchronized Celestial, Combat, Persistence and Ship Builder coverage |
| `npm run test:e2e:live` | PASS; 12 tests |
| `npm run test:e2e:ui` | PASS; 12 tests including Graphics Settings |
| `npm run test:e2e` | PASS; 51 tests |
| Navigation-map E2E after stable ignored output-path correction | PASS; 1 test; archived snapshot unchanged |
| Live-flight strict-progress reproduction | PASS focused and in full 8-worker Live group |
| CI Playwright group-membership script | PASS; 26 discovered and 26 uniquely assigned specs (Core 14, Live 8, UI 4) |
| Normal `/` route without `TestBridge` | PASS in Core, Live and UI tests |
| Demo Scout GLB signature and unchanged blob | PASS |
| Five required PNG signatures/OIDs (four UI baselines plus favicon) | PASS |
| Prospective cleanup-tree `git lfs fsck --pointers` | PASS |
| Relative links in active Markdown documents | PASS; 244 files checked, 26 relative links, 0 missing |
| Dependency/lockfile diff | PASS; unchanged; package scripts preserve Combat, Persistence and Ship Builder in Core plus Graphics Settings in UI |
| Runtime screenshot diff after evidence restore | PASS; no PNG changes |
| `git diff --check` and `git diff --cached --check` | PASS |
| Final Unity/reference/path checks | PASS; no unresolved active Unity path or stale mainline claim |
| Independent staged-diff reviews | Pending fresh exact-head re-review after the final documentation reconciliation |

The local Windows policy blocks Playwright's downloaded
`chrome-headless-shell.exe` (`spawn UNKNOWN`). The repository-supported
`WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` was therefore set to installed Google
Chrome and the current npm group commands, workers, timeouts and assertions
passed. This is a local execution-policy constraint, not a product failure.

Two earlier local long-suite attempts ended sporadically in different places:
one Live run observed the completed-plan label before the newly selected 2500 m
preview presentation settled, and one aggregate run lost a page execution
context during the 500 m frame wait. No timeout, assertion, product code or test
group was changed. The affected specs passed unchanged in focused serial runs,
the complete Live group passed unchanged, and the final aggregate run passed all
51 tests with the CI one-worker policy. The official synchronized Graphics
Settings feature-head workflow also passed Unit, Build, membership, Core, Live,
UI and Evidence gates.

## Remaining issues and behavior confirmation

- The four pre-existing missing LFS payloads remain unrecoverable in the
  immutable Unity archive; the active branch has no unresolved copy of them.
- The shared Git object database retains Unity history by design. A history
  rewrite or retroactive LFS migration was explicitly out of scope.
- DevToolbox MCP path authorization did not include the isolated cleanup
  worktree, so no checkbox or tool-driven completion mutation was attempted.
- The first synchronized `main` left the Combat E2E spec unassigned, while the
  live progress poll could return at equality before its stricter assertion.
  Current `main` now contains the exact Combat, Persistence and Ship Builder
  Core assignments plus Graphics Settings in UI;
  the cleanup keeps the poll waiting for the already-required strict progress.
  No assertion, timeout or product behavior was weakened.

Browser gameplay, physics, planner, executor, FlightController, renderer truth
and UI behavior are unchanged. The only browser source edit updates the Demo
Scout source-provenance string to its neutral `art/` location; the runtime URL,
GLB bytes and fallback behavior remain unchanged. Test-only changes preserve
historical evidence, isolate generated output, preserve exact CI membership and
align a polling return condition with its existing strict assertion.
