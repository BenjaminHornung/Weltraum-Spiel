# Browser Mainline Repository Cleanup Result

Date: 2026-07-13

## Identity and immutable Unity archive

- Starting commit: `8383487f89f6eb6e63140def564052ac86de259a`
- Cleanup branch: `cleanup/browser-mainline-repository-v1`
- Archive tag: `unity-legacy-final-2026-07`
- Archive branch: `archive/unity-legacy-final-2026-07`

The tag and archive branch were created and pushed before destructive cleanup.
Both resolve exactly to the starting commit. No history rewrite, force push or
LFS history migration was performed.

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

The machine-readable inventory contains all 178 initial change directories.
Physical consolidation results:

- active changes before/after: 112 / 31;
- archived change directories before/after: 66 / 139;
- 76 active directories moved to dated archive areas: 58 Unity, 17 completed
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
| Tracked files | 3,835 | 2,025 |
| Git LFS paths | 669 | 403 |
| Active DevToolbox change directories | 112 | 31 |
| Archived DevToolbox change directories | 66 | 139 |
| Browser evidence files | 152 | 147 |

Git object database before cleanup: 14.59 MiB packed plus 791.90 KiB loose.
After cleanup: 14.59 MiB packed plus 1.98 MiB loose.

`git count-objects` measures the shared object database, including retained
history, rather than the logical size of the cleaned checkout. Removing current
paths does not rewrite or shrink archived history.

## Browser evidence and LFS integrity

All 152 initial browser evidence files were classified. Only five generated,
unreferenced verification logs were deleted. All screenshots, JSON, Markdown
evidence, required baselines and conservative unreferenced records remain.

The required rejected UI baselines are real PNG payloads (not pointers in the
working tree) and match their LFS OIDs. The art preservation scope contains no
unresolved LFS pointer file.

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
- `.github/workflows/browser-mainline-ci.yml` required no path change or CI
  redesign; its referenced app, lockfile, evidence and artifact paths remain
  valid.
- Historical Browser evidence preserves its capture-time Unity paths and carries
  cleanup annotations pointing to `unity-legacy-final-2026-07:<path>`. Current
  non-historical references use archive-object or neutral `art/` paths.

## Verification

All browser commands ran with Node `v22.23.1`:

| Command / check | Result |
| --- | --- |
| `npm ci` | PASS; 60 packages audited, 0 vulnerabilities |
| `npm run test` | PASS; 39 files, 451 tests |
| `npm run build` | PASS; production bundle built (existing chunk-size warning only) |
| `npm run test:e2e:core` | PASS; 23 tests |
| `npm run test:e2e:live` | PASS; 12 tests |
| `npm run test:e2e:ui` | PASS; 9 tests |
| Navigation-map E2E after stable ignored output-path correction | PASS; 1 test; archived snapshot unchanged |
| CI Playwright group-membership script | PASS; 21 discovered and 21 uniquely assigned specs |
| Normal `/` route without `TestBridge` | PASS in Core, Live and UI tests |
| Demo Scout GLB signature and unchanged blob | PASS |
| Four required PNG signatures/OIDs | PASS |
| Prospective cleanup-tree `git lfs fsck --pointers` | PASS |
| Relative links in moved Markdown documents | PASS; 0 missing |
| Package/lockfile diff | PASS; no changes |
| Runtime screenshot diff after evidence restore | PASS; no PNG changes |
| `git diff --check` and `git diff --cached --check` | PASS |
| Final Unity/reference/path checks | PASS; no unresolved active Unity path or stale mainline claim |
| Independent staged-diff review | PASS after GLB policy, historical evidence and E2E output-path fixes; no remaining findings |

The local Windows policy blocks Playwright's downloaded
`chrome-headless-shell.exe` (`spawn UNKNOWN`). The repository-supported
`WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH` was therefore set to installed Google
Chrome and the same unmodified npm group commands, workers, timeouts and
assertions passed. This is a local execution-policy constraint, not a product
failure.

## Remaining issues and behavior confirmation

- The four pre-existing missing LFS payloads remain unrecoverable in the
  immutable Unity archive; the active branch has no unresolved copy of them.
- The shared Git object database retains Unity history by design. A history
  rewrite or retroactive LFS migration was explicitly out of scope.
- DevToolbox MCP path authorization did not include the isolated cleanup
  worktree, so no checkbox or tool-driven completion mutation was attempted.

Browser gameplay, physics, planner, executor, FlightController, renderer truth
and UI behavior are unchanged. The only browser source edit updates the Demo
Scout source-provenance string to its neutral `art/` location; the runtime URL,
GLB bytes, fallback behavior and all product gates remain unchanged.
