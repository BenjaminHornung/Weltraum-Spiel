# Task 22.2 Phase 2 — Mixed-resolution authority proof

## Result

Task 22.2 Phase 2 is **implemented and verified as an isolated,
production-unwired proof**. It records one deterministic mixed-resolution
authority contract for existing L0–L4 representation levels. No task checkbox
was changed.

The worktree was already dirty with foreign work. This evidence preserves that
state: branch `feature/browser-hestia-first-person-combat-integration-v1`, HEAD
`20c837d2e2f062fe5d63acf953dfb0f8a6e3cd6b`, and cached diff empty.

## Requirements to evidence

| Task 22.2 requirement | Direct evidence |
| --- | --- |
| Deterministic mixed-material terrain, trunk, fracture and vegetation across L0–L4; ground at L2/L3 and trunk/fracture at L4 | `types.ts`, `canonical.ts`, and `structuralMicrovoxelContracts.test.ts`; focused Vitest: 34/34 across 3 files |
| Exactly one immutable authority snapshot owns occupancy, density, material, ordered edits/provenance, identity, revision and content hash | Final reviewer **APPROVE**: shared brick tuple/journal/base/source binding; literal material/provenance/hash oracles; deep-freeze proof |
| Render, collision, support, mass and physics remain derived products, not alternate authority | Final reviewer **APPROVE**; no runtime consumer is present in the isolated slice |
| Main-side snapshot/acceptance/CAS/adoption contract is isolated from worker derivation | Final reviewer **APPROVE**: shared journal/base/source binding and production mismatch rejection coverage |
| Protocol, derivation and material versions are commitment-bound and adoption equality is exact | Final reviewer **APPROVE**: literal contract oracles and production mismatch rejections |
| No live Coast/Surface Play route reaches the fixture; no optional L5 promotion | 6/6 new authority exports are isolated to `canonical.ts` and the focused test; no Surface Play, Coast, bootstrap, or runtime consumers |

The reviewed proof also covers real full 9-brick candidate continuity: a
history prefix plus exactly one record/key set, including the production
mismatch rejection path.

## Source and test artifacts

These are the scoped product/test artifacts recorded for the proof; this
documentation-only handoff did not modify them:

| Path | SHA-256 |
| --- | --- |
| `apps/weltraum-browser/src/voxel/adaptive/types.ts` | `25D47CAD94B373A3BBAE3CB6EB35ADA7E3065F638BFC08942B9069971CC2F10E` |
| `apps/weltraum-browser/src/voxel/adaptive/canonical.ts` | `CA3B5095C51D1749806ED13B4A63D3CFC26562F038DEA8BAA5262D6BA8FDB2CE` |
| `apps/weltraum-browser/tests/unit/structuralMicrovoxelContracts.test.ts` | `F6FF0DD390E807228F90C6829311944AB226702BACBA0C320C2B8BBF91EA2A17` |

No `tasks.md` or other documentation was changed by this handoff.

## Fresh verification

Commands were run from:

`C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-browser-hestia-first-person-combat-integration-v1\apps\weltraum-browser`

Node executable:

`C:\IFI_SourceCode\Utils\npm-tmp\opencode\node22-cache\_npx\52027bd8fc0022aa\node_modules\node\node_modules\node-win-x64\bin\node.exe`

| Command | Result |
| --- | --- |
| `node --version` | **PASS** — `v22.23.1` |
| `node .\node_modules\vitest\vitest.mjs run tests/unit/adaptiveMicrovoxelContracts.test.ts tests/unit/adaptiveMicrovoxelMaterialization.test.ts tests/unit/structuralMicrovoxelContracts.test.ts --maxWorkers=1` | **PASS** — 34/34, 3 files; test duration 9.36s, total 10.46s |
| `node .\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit` | **PASS** — 1.13s |
| `node .\node_modules\vite\bin\vite.js build` | **PASS** — 268 modules, 1.30s / 1.94s wall; only the existing chunk warning |
| Root, cached, and focused diff checks (`git diff --check` and cached equivalent) | **PASS** |

The prescribed scoped checks were also clean:

```powershell
git diff --check -- .devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md
git diff --name-only -- .devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md
git status --short --untracked-files=all -- .devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md
```

## Review and limits

Final reviewer result: **APPROVE**. The review confirmed shared brick
tuple/journal/base/source binding, full 9-brick candidate continuity, mismatch
rejections, literal material/provenance/hash oracles, and deep freeze. It found
no Phase 3/runtime/material numeric rules in this proof.

Skipped and not claimed: browser/E2E, full-suite, services, runtime wiring,
and screenshot evidence. This is not a UI or render change, so no screenshot
is required. Phase 3 and later phases remain hard-blocked until the approved,
hash-bound `Hestia Unified Surface Material Rules V1` exists. This evidence
does not claim that tree latency or Coast parity is fixed.
