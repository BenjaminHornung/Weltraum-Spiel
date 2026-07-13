# Unity Cleanup Audit

Date: 2026-07-13

## Decision

The repository can be cleaned to the browser mainline after the preservation
moves listed below. No Browser gameplay, physics, planner, executor, flight
controller, render-truth or UI behavior is in scope.

The initial checkout safe-stop found four pre-existing Git LFS pointers whose
payloads are absent from GitHub LFS. Exact recovery was attempted from the
shared LFS cache, all 25 registered worktrees, Git history, local same-name
files and local context ZIPs. GitHub returned HTTP 404 for every OID and no
matching payload was found. On 2026-07-13 the owner instructed Codex to fix the
error and continue. The resolution is to remove only the broken active-branch
pointers, document the loss, and never fabricate replacement evidence. The
unaltered archive refs preserve the original pointer state.

## Preflight identity and archive gate

- Original user checkout: `spike/threejs-core-port-v1` at
  `e416eb880ff4b42fdf35a93c1b567dfbfa186bbb`, with 414 pre-existing dirty
  entries; it remains untouched.
- Initial cleanup source: the then-current `origin/main` at
  `8383487f89f6eb6e63140def564052ac86de259a`.
- Final synchronized PR base: `origin/main` at
  `a790e7b7d4601989c6851e05943d54f3b0adfd52`.
- Cleanup branch: `cleanup/browser-mainline-repository-v1`.
- Unity legacy tag: `unity-legacy-final-2026-07`.
- Unity legacy archive branch: `archive/unity-legacy-final-2026-07`.
- Remote tag and archive branch both resolve exactly to
  `8383487f89f6eb6e63140def564052ac86de259a`.

The tag and branch were created and pushed before cleanup edits. No history
rewrite, force push or LFS migration is permitted.

## Commands used for the baseline

```text
git status --short
git rev-parse HEAD
git ls-tree -d --name-only HEAD
git ls-tree -r --name-only HEAD
git lfs ls-files
git count-objects -vH
```

Additional `git ls-tree`, `git grep`, `rg`, file-signature and SHA-256 checks
were used for the classifications below.

## Before metrics

- Tracked files: 3,835.
- Tracked files under `Assets`: 1,586.
- Tracked files under `Assets/_Weltraum`: 146.
- Tracked files under `Packages`: 166.
- Tracked files under `ProjectSettings`: 28.
- Git LFS paths: 669.
- DevToolbox changes: 112 active directories and 66 archived directories.
- Browser evidence files: 152.
- Git object database: 14.59 MiB packed plus 791.90 KiB loose.

`git count-objects` measures the shared object database, not the logical
checkout size, and does not prove availability of remote LFS payloads. The
result document will report the same metric after cleanup and will keep this
qualification.

## Complete top-level path classification

| Path | Before files | Class | Planned result |
| --- | ---: | --- | --- |
| `.agent` | 1 | Keep / Update | Keep ExecPlan guidance; make browser work the default. |
| `.ask-pro` | 36 | Keep / Classify | Retain immutable consultation bundles without unpacking or copying potentially confidential context; add a root marker that classifies them as historical Unity source evidence. |
| `.devtoolbox` | 1,447 | Keep / Archive / Delete | Keep active browser/cross-platform work, archive clear completed browser and Unity-only records, delete only verified residual duplicates and three broken evidence pointers. |
| `.gitattributes` | 1 | Keep / Update | Remove Unity merge/type rules; keep text/EOL and required binary/LFS rules. |
| `.github` | 1 | Keep | Keep browser CI; only path-validity changes allowed. |
| `.gitignore` | 1 | Keep / Replace | Replace Unity defaults with browser/art outputs and editor/OS ignores. |
| `.idea` | 6 | Delete | Tracked IDE cache. |
| `.vsconfig` | 1 | Delete | Requests the Visual Studio managed-game workload. |
| `AGENTS.md` | 1 | Keep / Replace | Browser-mainline guidance. |
| `Assets` | 1,586 | Move / Delete | Move unique neutral art/metadata; delete the Unity tree. |
| `Packages` | 166 | Delete | Unity package project. |
| `ProjectSettings` | 28 | Delete | Unity project settings. |
| `README.md` | 1 | Keep / Replace | Browser install, test, build and E2E instructions. |
| `UpgradeLog.htm` | 1 | Delete | Generated Visual Studio upgrade report. |
| `analysis` | 14 | Move / Delete | Move source evidence to `docs/legacy-unity/source-evidence`; move useful final transition reports into browser docs, then remove the top-level directory. |
| `apps` | 371 | Keep | Product mainline; only provenance path literals and their tests may change. |
| `art` | 11 | Keep / Extend | Neutral home for original ship sources, exports, manifest, validation and renders. |
| `docs/browser-mainline/design-qa-v3.md` | 1 | Move | Move to `docs/browser-mainline/design-qa-v3.md`. |
| `docs` | 142 | Keep / Update | Browser docs remain; Unity state/evidence moves under `docs/legacy-unity`. |
| `uam` | 1 | Delete | Generated Unity Asset Manager folder; its README says it is deletable. |
| `weltraum_refactor_strategy_package` | 19 | Delete | Sixteen exact duplicates and three superseded draft specs; mapping recorded below. |

No tracked Unity solution or project file exists. Tracked Unity/editor residue is
limited to `.idea/**`, `.vsconfig`, `UpgradeLog.htm`, `uam/README.txt` and the
Unity project trees listed above.

## Incoming references for top-level deletion paths

Repository-wide raw-reference inventory before moves:

| Target | Referencing files | Matching lines | Main sources and disposition |
| --- | ---: | ---: | --- |
| `Assets/` | 352 | 1,494 | DevToolbox history, docs, browser provenance tests, `.ask-pro`, strategy package and source evidence. Active browser provenance is updated to neutral `art/`; historical lineage moves under legacy archives or remains explicitly historical. |
| `Packages/` | 16 | 39 | DevToolbox history, docs, Unity assets, attributes and UAM. Removed with Unity records or retained only as historical legacy text. |
| `ProjectSettings/` | 9 | 10 | DevToolbox history and embedded Unity package documentation. Removed or retained only in historical legacy records. |
| `Assets/_Weltraum` | 49 | 184 | DevToolbox planning, docs, strategy package, source evidence and old AGENTS. New product guidance removes the claim; historical references are explicitly legacy. |
| `weltraum_refactor_strategy_package` | 8 | 9 | Three active change designs, historical test protocols and this audit. Canonical replacements are recorded below; active links are updated. |

Browser runtime does not read a Unity file at runtime. It exposes the old Demo
Scout source path as provenance metadata in
`apps/weltraum-browser/src/render/three/shipVisual.ts`; unit/E2E tests assert
that string. The cleanup changes the provenance literal and assertions to the
neutral art path only. The browser asset URL remains
`/ships/demo_scout_mk1.glb`, the actual GLB bytes remain unchanged, and render/
gameplay behavior is unaffected.

## Unique content to extract before deleting `Assets`

The only Unity-tree art scope with concrete future browser value is
`Assets/Art/PrototypeShipKit`:

- 11 GLB exports: Demo Scout, Demo Cargo and nine modular parts.
- 11 matching FBX exports.
- `prototype_ship_kit_manifest.json` with part IDs, connector transforms,
  sockets, ship compositions and canonical axes.
- Demo Scout markers for main engines, RCS, turret/muzzle and camera anchor.
- Unity import metadata used only to confirm source scale/axis assumptions.

Already-neutral sources under `art/blender` are also retained:

- `prototype_modular_ship_kit_v0.blend`.
- eight Demo Scout/Cargo reference renders.
- `validate_ship_kit_meshes.py`.
- `ship_kit_mesh_validation_report.md`.

All required art payloads were pulled normally from LFS before moves. A byte
scan found zero unresolved pointers in the two preservation scopes. The Demo
Scout GLB under `Assets` and the browser-runtime GLB are the same Git blob; the
runtime path remains untouched.

Destination:

```text
art/source/ships/prototype-ship-kit/
  exports/demo-ships/
  exports/parts/
  metadata/prototype_ship_kit_manifest.json
```

The existing `art/blender` source, validator, report and renders remain at
their neutral paths. Unity `.meta`, `.mat`, `.prefab` and `.asset` files are not
portable source assets; their useful material/VFX intent is distilled into a
legacy intent document instead of retaining Unity YAML.

## Strategy-package uniqueness mapping

Sixteen of 19 files are byte-identical to canonical files already present:

- numbered architecture/UX/workflow/roadmap files -> corresponding files under
  `docs/architecture`, `docs/ux`, `docs/ai` and `docs/roadmap`;
- package README -> `docs/legacy-unity/architecture/clean-core-refactor-overview.md`;
- prompt files -> `docs/legacy-unity/agent-prompts/*`;
- templates -> root `AGENTS.md` and `.agent/PLANS.md`.

The remaining three draft specs are superseded by full change trees:

- `.devtoolbox/specs/changes/archive/2026-07-13-unity-autopilot-v2-core-planner-executor-v1`;
- `.devtoolbox/specs/changes/archive/2026-07-13-unity-clean-core-runtime-architecture-v1`;
- `.devtoolbox/specs/changes/player-ui-redesign-foundation-v1`.

After active lineage links point to canonical docs/specs, the complete strategy
package is a safe delete.

## DevToolbox classification

At the audit base, the machine-readable inventory represented all 178 change
directories exactly once:

- Platforms: 36 browser, 12 cross-platform, 129 Unity, 1 unknown.
- Status: 45 active, 100 complete, 23 reconcile, 10 superseded.
- Actions: 91 keep, 55 archive, 8 delete, 24 review.

Across the two final `main` synchronizations, five Browser changes were added.
They are appended to `docs/repo-cleanup/devtoolbox-change-inventory.json`, which
therefore contains 183 entries: 41 browser, 12 cross-platform, 129 Unity and 1
unknown. Statuses are 47 active, 103 complete, 23 reconcile and 10 superseded;
actions are 93 keep, 58 archive, 8 delete and 24 review. Three additions had zero
open tasks plus evidence and move to the dated archive. The Demo Scout
nozzle-VFX change retains its one open CI task. The Persistence/Universe-Time/
Event change deliberately retains seven unchecked tasks because DevToolbox
preflight could not run in its isolated source worktree; both remain active
without checkbox mutation.

DevToolbox MCP is installed but rejects the isolated cleanup worktree with
`unauthorized_path`. Therefore no task checkbox is changed and no doubtful
archive decision is treated as completion. Clear Unity-only records are moved
to a dated Unity archive while retaining open task metadata; residual duplicate
folders are deleted only when a canonical archived copy exists. Clear completed
browser records with zero open tasks and evidence are moved to a dated browser
archive after a manual schema/task/evidence preflight. Browser reconcile/review
and active browser/cross-platform records remain active.

Detailed review reclassified `prototype-legacy-boundary-audit-v1` as Unity-only:
its audit is complete and its two open tasks only extend the discarded Unity
Clean Core. The change therefore moves to the dated Unity archive with those
checkboxes untouched.

## Browser evidence classification

All 152 files under `apps/weltraum-browser/evidence` were classified:

- active baseline: 4;
- active evidence: 118;
- historical evidence: 16;
- generated log: 5;
- unreferenced non-log evidence: 9.

Synchronized `main` later added ten tracked current Browser evidence files.
They remain untouched; after deleting the five classified generated logs, the
final tracked Browser evidence count is 157. Ignored local Playwright
report/output directories are not counted.

Only these five generated, unreferenced command logs are safe to delete:

```text
verification-npm-install.log
verification-npm-run-build.log
verification-npm-run-test.log
verification-npm-run-test-e2e.log
verification-npx-playwright-install-chromium.log
```

All screenshots, JSON, Markdown evidence and the nine conservative unreferenced
records remain.

The required Demo Scout is a real 127,108-byte GLB with `glTF` signature. The
four required rejected UI baselines were pulled normally from LFS and verified
as real PNG files with the `89 50 4e 47 0d 0a 1a 0a` signature.

The later synchronized `public/favicon.png` is likewise available from Git LFS
and resolves to a real PNG. Because Browser CI checks out with `lfs: false`, its
selective restore/signature list must include that runtime icon as well as the
four evidence baselines.

## Pre-existing unavailable LFS payloads

| Path | OID | Resolution on active cleanup branch |
| --- | --- | --- |
| `.devtoolbox/specs/changes/archive/2026-05-21-prototype-test-environment-ui-pass/tests/screenshots/environment-overview.png` | `c03d059b365d570421ef9c8f06abd7f55c2bbc50ce6587afb84b436f02738e53` | Remove broken pointer; retain protocol note and archive-manifest disclosure. |
| `.devtoolbox/specs/changes/archive/2026-05-21-prototype-ui-readability-testability-pass/tests/screenshots/default-compact-flight-ui-after-navball-fix.png` | `909d62e6585e6439a6d189d21b81140e8e892a054801c7fa2e026e8daa50fdd1` | Remove broken pointer; retain protocol note and archive-manifest disclosure. |
| `.devtoolbox/specs/changes/archive/2026-05-21-prototype-ui-readability-testability-pass/tests/screenshots/default-compact-flight-ui.png` | `414747a1b9c1943cce1f8b5087a2b55be292df891514e477ceec64e8a0b2a284` | Remove broken pointer; retain protocol note and archive-manifest disclosure. |
| `Assets/TutorialInfo/Icons/URP.png` | `1d17a9ff3537859abe2c008603d29d90cf43191ae77aa386167cc65e53ba03d9` | Removed with third-party Unity tutorial assets. |

No LFS replacement, history migration or fake binary is permitted.

## Expected CI, documentation and spec impact

- Browser CI remains under `.github/workflows/browser-mainline-ci.yml`; action
  versions and job design do not change, while the selective LFS allowlist adds
  the synchronized favicon.
- Node 22 remains the CI runtime.
- The exact group-membership check remains the workflow's inline Node script;
  the first synchronization required the missing Combat assignment, while the
  final synchronized `main` already contains both Combat and Persistence. The
  final cleanup therefore has no package or lockfile diff.
- `analysis/threejs-mainline/source-evidence` references change to
  `docs/legacy-unity/source-evidence`.
- Root `docs/browser-mainline/design-qa-v3.md` references change to
  `docs/browser-mainline/design-qa-v3.md`.
- Historical Unity state references change to
  `docs/legacy-unity/current-prototype-state-2026-06-15.md`; current mainline
  guidance changes to `docs/current-mainline-state.md`.
- Browser runtime/test provenance literals change from the Unity asset path to
  the neutral art path; package/lock files and runtime asset bytes do not.
- `.devtoolbox` task checkboxes remain unchanged.

## Safe-stop criteria during execution

Stop cleanup mutation if any of these occurs:

- a new unavailable LFS payload appears outside the four disclosed historical
  pointers;
- a Browser runtime or CI path reads a Unity file rather than carrying
  provenance text;
- any unique Blender/FBX/GLB/manifest/marker content would be lost;
- a DevToolbox record cannot be preserved without claiming false completion;
- a Browser test fails after move-only cleanup and repair would require product
  behavior, weaker assertions, longer timeouts or reduced coverage;
- the Demo Scout GLB, ProceduralFallback, synchronized favicon or four required
  UI baselines change;
- `TestBridge` becomes available on the normal `/` route;
- planner/executor/flight/render/UI product behavior changes.
