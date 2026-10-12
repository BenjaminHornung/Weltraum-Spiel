# PLAY-00 read-only repository/boundary audit

Audit by `/root/w00_repo_audit`, completed 2026-10-12T06:26:56.322759+00:00. **READ_ONLY_BASELINE_AND_SCOPED_LFS_PASS**: existing local product work is present, clean and reusable; expected Root control documents are being prepared separately; this is neither a new write grant nor a runtime/Art/package acceptance. Only this external report was written. No tests, build, browser, Blender, profile, index/branch edits, fetch, global LFS check or prior-evidence mutation were performed.

## Actual basis and conflicts

| Worktree | Branch | Full HEAD | Final observed status |
|---|---|---|---|
| `/workspace/Weltraum-Spiel` | `work` | `e40592c113b72a8dc93725187f92cf948e07f44d` | CLEAN |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11` | `codex/hestia-fp06-domain-2026-10-11` | `6929bf2447b72c9f3f8fa3bcae0a59c0691966c0` | CLEAN |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11` | `codex/hestia-fp06-integrator-2026-10-11` | `96cced23cd285b57f8a557d01ac9ed8a158c927f` | CLEAN |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-ui-w09-2026-10-11` | `codex/hestia-fp06-ui-w09-2026-10-11` | `28de0ce99f5f6fa9ca3bed415bcb34c7b5e3117a` | CLEAN |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11` | `codex/hestia-fp06-w00-2026-10-11` | `245dcb61401b9785486545365b7d31bb452d89c2` | CHANGED — '?? docs/factory/fp06/play/2026-10-12/exec-plan.md\n?? docs/factory/fp06/play/2026-10-12/grants/play-01-integrator.json\n?? docs/factory/fp06/play/2026-10-12/source-lock.json\n?? docs/factory/fp06/play/2026-10-12/write-ownership.json\n' |

Fresh native `git ls-remote origin refs/heads/main` succeeded at **2026-10-12T06:22:31.594446+00:00**, exit0: `e40592c113b72a8dc93725187f92cf948e07f44d`. An earlier same-audit query returned128 with no SHA; the successful later request resolves that read-access gap, without credential changes. Main was not fetched/reset or adopted as implementation basis. Continue from existing Integrator `96cced23cd285b57f8a557d01ac9ed8a158c927f`, not old Main. Its actual parent is `aa2e5d7c335453fc555a98ccd35e9f564c596e93`; the latest four commits contain the protocol, four-panel UI, cargo UI and W09 partial implementation. The previous package boundary receipt separately distinguishes26 latest Integrator product paths from31 aggregate W09 product paths; this audit does not relabel the partial package PASS.

Original W05 `26d5e892c2b401b9011234dabf86955af7462fb8` resolves locally. It is **not** an ancestor of IntegratorHEAD: its real integration/cherry-pick `d5502ae7fd5431d58eda51bea062c54691ebe3c2` is an ancestor, and all18 W05 product files at that integration commit equal original W05 bytes. All15 current native Art files remain original W05 bytes. `machinePose.ts` remains `c426f01ae087004a1eacde662de0c5da7c22f18410d5900d2ca20e840cae111b`; current `factoryAssets.ts` is the subsequently extended W09 adapter `a9d707c53d8ae401e952076007aff523bcec127f4c0b58d37020aaea9ced973c`. Do not copy the older W05 adapter over those later paid-band/container/carrier changes.

Seven previously catalogued remote conflict refs were reread, exit0, at2026-10-12T06:24:16.172494+00:00; their tips still match the controlplane:

- `integration/hestia-fp06-v2-2026-10-10`: `07c7587b1a646b6a460025fe5b98c4ef6ac43182`
- `feature/hvp-cut-rt-p00`: `f2ee73cfbfa80b6c09d540c784d3ad426ae83a04`
- `feature/hvp-cut-rt-v3-completion-2026-09-23`: `0bfd1e67117d0dd6184e592e9a2a1b8b9f58241a`
- `feature/resume-hvp-cut-v3-2026-10-05`: `aa2eabd918e03c475a489b412cd18e05f781a0f9`
- `feature/hestia-destruction-program-2026-10-07`: `17b1db4201a28e7b607c30707bdc2b75e3484a10`
- `perf/hvp-hud-frame-hotpath-2026-10-02`: `7e608d4f1e909dbc6576cde821b595a5bc41927b`
- `perf/hvp-route-bundle-isolation-2026-10-02`: `d8fa02867e538dab3363819f10394fd059bda321`

Known overlapping physics/persistence/Bootstrap/main paths stay preserved. Remote history proves neither an active nor inactive external writer. Live PR/uncommitted external-writer visibility is **UNKNOWN**, not freshly checked via GitHub API. Local worktree cleanliness and `activeImplementationWriters: []` support conflict-free *local* resumption after exact new grants.

## Locks, source admission and exact candidate

Control HEAD at final read: `245dcb61401b9785486545365b7d31bb452d89c2`. Authoritative current control files are under `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06`, not the older controlplane copy in IntegratorWT. Source-lock SHA256 `baf6ff3f02e42ee5aed95964404476f7c41ae4b31e8584ee60951b39aba3c455`; ownership SHA256 `81ba6a9c91c8e164a54469fb5605be330a94289fd0223ab184cc5db43556ebdc`. Both retain W05/W09 `implementationWriteHold: true`, W10/W11 empty `grantedWriteSet`, and zero active implementation writers. Retained historical W05/W09 path lists are not current permission. Root documentation is the only recorded current writer; shared Host/Physics/Save/contracts/package/CI remain `/root/fp06_integrator` exclusive. Maximum two implementation writers including Art. New PLAY grants/ExecPlan must explicitly reopen intended exact paths and synchronize both locks before product writes. During the final read Root created exactly four expected untracked files under `docs/factory/fp06/play/2026-10-12/`: `exec-plan.md`, `source-lock.json`, `write-ownership.json`, `grants/play-01-integrator.json`. They are Root-owned control-document work, not product drift. New ownership still reports zero active implementation writers; the13-path Integrator grant is `GRANTED_HELD_UNTIL_PLAY00_CAPTURE`, with candidate branch `codex/hestia-fp06-play-candidate-2026-10-12` and existing IntegratorWT. This draft does not release product writes before the recorded capture gate. Source-lock draft SHA256 `af143de8b8ca52ec2401eae0242e507ec1393c0605bc23384f580740d8af6556`, ownership `d48d93ea2285b80d54bc9c876ec65dfae5dab77592b241c06506541f24fca13c`, grant `2e6d1de22cbbaba356e6849e570c637877fa249c671fe0c0ee87561208e1a8a1`, read at approximately06:27UTC; later control edits need their own binding.

Current accepted Factory source remains **`hvp-factory-startsite-v1`**, seed `hestia-factory-layout-a-001`, parent Coast digest `b8fde6b0`, reported accepted Factory digest `e62aea8a`,15 masks/4480 columns/70m²/0mg credit. No source generation/fold was run here. Actual protected bytes:

| Path relative to IntegratorWT | SHA256 |
|---|---|
| `apps/weltraum-browser/src/factory/fixtures/startSite.ts` | `53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29` |
| `apps/weltraum-browser/src/hvp/hvpCoastSource.ts` | `13128d7ad3151da644ae909af0dbb0e2df0e91066c01f55ee566f7eedc1fdaca` |
| `apps/weltraum-browser/src/factory/fixtures/cargoSite.ts` | `83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c` |

New task admits preparing an **isolated versioned candidate**, subject to a new exact Root grant: proposed `hvp-factory-startsite-v2`, sameCoverage/Seed/cellsize/caps, old15 masks retained, plus exactly S1 `[0.75,6,3.25,3.5]`, S2 `[8,15.5,3.25,3.5]`, S3 `[2,13,4.5,4.75]` in East/North metres.380 extra columns/5.9375m²; proposal arithmetic2890 changed slots/264 Air→Solid/2626 Solid→Air is reported census, not an executed sparse diff or accepted final geologic source. New candidate digest **NOT_RUN**. Final Owner acceptance stays pending. Proposal source JSON bound `f78ffa85993585a2c60079c09f03d28d956da59414409dc97a8a8ca217487b3b`; original V2 report `5fd528af5b7fdddf467905f26087090a295ff65c3e15bb2dd843134f6aaee7c7`.

Exact potential Integrator source seams are `fixtures/startSite.ts`, `hvp/hvpCoastSource.ts`, `fixtures/cargoSite.ts`, `session/hostPort.ts`, `hvp/hvpBootstrap.ts`, `factoryEntry.ts`, relevant fixture/Bootstrap tests, and later closed W10 source profiles. These are **candidate scope suggestions**, not granted writes. Preserve valid V1/default Coast paths,125mm terrain vs250mm build grid, Resources/BOM/receipts/native collision/reach/caps. The supplied proposal's old wording “only after Owner acceptance” is superseded only for isolated candidate preparation by the newly activated startprompt; neither doc accepts V2 as final initial terrain.

## W05 assets and scoped LFS

Real Art root is repository-level `art/factory/...`, not the proposed search prefix `apps/weltraum-browser/art/...`.15 files/126,809B are regular Git JSON/README/license sources; all match HEAD and original W05, zero LFS pointers, zero `.blend`/GLB/HVOX files in this admitted native scope. This does not mean models are absent.

| Actual native source | Version/role | Existing definition |
|---|---|---|
| `art/factory/fp02/cutter/source.scene.json` | `hestia.factory-s0-source.v1`, `fp02_cutter_s0_v1`, revision1,12 parts/3 ports | B06,3×2×2.5m,confirmed30s phases |
| `art/factory/fp02/former/source.scene.json` | same schema, `fp02_former_s0_v1`, revision1,13 parts/3 ports | B07,4×3×3m,confirmed40s phases |
| `art/factory/fp01/power-kit/source.scene.json` | same schema, four revision1 proxies | battery4parts,distribution4,PV5,wind7 |

Native source SHAs respectively `abd1ce25fd19ad61a9cb65de9f5ba10c303aa5c1a1aa16260de9dce9534fa5fd`, `4e27abd922e46516d1db0307b8dfb5edaf1b8c6807e80006781344b9dfcf535d`, `bb131bb9b03f2e76abf1ba4ad25fe7d228ecf19b70ec9910e491c03dd1ab256c`.

Existing `authoring-v1.json` uses `hestia.asset-authoring.v1`. The actual JSON→MeshArtifact adapter imports these exact sources at `presentation/factoryAssets.ts:2–4`, source-binds at121–133, with receiver staging at `hvpBootstrap.ts:2216`. Part projection and `machinePose.ts` derive presentation only; Parts/ports/supports/material/colliders are not independently owned by a later GLB/Blender import. W05 reports HVOXCompiler/Blender not delivered and human Art not run. Initial cargo shell and transport proxies also already exist in Bootstrap/W09; replacing them requires specific Art/runtime integration rather than inventing missing-domain work. Actual normal visual/loading/animation quality is **NOT_RUN in this audit**.

Only W05 OwnRun `apps/weltraum-browser/evidence/factory/w05/run-20261011T104359Z/` was examined for LFS:157 tracked files,67 regular Git blobs,90 LFS references/74 distinct payloads/1,378,145 unique payload bytes. Every pointer's SHA256/size matches current materialized file **and** scoped local `.git/lfs/objects` payload;0 missing/invalid. No global historical fsck or unrelated cache scan. This is scoped local integrity, not clean-copy/browser/visual acceptance. Historical W05 screenshot probes remain synthetic/presentation evidence.

## Rules and next handoff

Read current actual `AGENTS.md`, README/current-mainline-state, `.agent/PLANS.md`, relevant roadmap/rules and supplied README, Review/startprompt/status/V2proposal. All five AGENTS bytes match SHA256 `2eeb7795250038f4780a5b1906161074b751e493a7d0d1fc4f36bfccc400b7b8`. Old README/status are Mainline snapshots with `/` flight and older dated Main; they do not erase isolated local `/factory.html` work. Complex new multi-stage task needs the required self-contained ExecPlan with exact files/evidence and separated source/functional/visual/human gates. No lockfile/dependency/engine upgrades, fake authority, global timeout/cap increases, mainmerge/push/PR/publication or W12–29.

Original source sections read for this narrow review: FP06 §§9–10,W05(lines890–947),W09(lines1125–1182),W10(lines1184–1242),W11(lines1244–1298); FP01 §3/§14; FP02 §7 and LayoutA §9.1–9.3.10/10 delivery hashes match `SHA256SUMS.txt`; this is document integrity only. External reviewer `REVIEW_EVIDENCE.json` explicitly performed no code/browser/Blender review; its GitHub422 does not establish missing local commits. Setup/network skill guidance was read; no configuration or credentials changed. `environment_status` is not available in current tool catalog; actual successful scoped Git reads establish only those read operations.

Recommended next isolation: create the declared candidate branch from existing verified96cced without resetting the original Integrator branch for bounded W09 route/performance/native/Host work; admit one separate Art branch/worktree based on this same current integration snapshot with native sources/export-only ownership. Integrator exclusively adopts runtime imports/`factoryAssets.ts`/Bootstrap, which overlap current W09; Art/UI must not write those same shared paths in parallel. Art may proceed independently of final V2 acceptance. Afterwards W10 only after real W09 gate, W11 after W10. Existing UI and validated domain modules should be reused.

Current W09 remains historical **BLOCKED**: complete normal fresh16kg/native heavy route/cables not proved, original5355ms vs5000ms composition goal not met; new task authorizes only a newly bounded investigation, not erasure of these FAILs. W10/W11 endgates **NOT_RUN**. A fresh beforeflow, Blender availability/execution, actual S1 asset delivery, user-facing HUD/localmap/save, clean-copy delivery and human Art/usability/hardware acceptance remain work for newly granted actors. This audit supplies no runtime/Art/performance/package PASS.

## Reproducible read-only evidence commands

- `GIT_OPTIONAL_LOCKS=0 git status --porcelain=v1 --untracked-files=all`, `git rev-parse HEAD`, `git branch --show-current` in each of the five worktrees; `git worktree list --porcelain`.
- `git ls-remote origin refs/heads/main`; one targeted `git ls-remote origin <seven listed refs>`; no fetch.
- `git log -4 --format='%H %s'`; `git merge-base --is-ancestor d5502ae7fd5431d58eda51bea062c54691ebe3c2 HEAD`; original W05 ancestry query correctly returns1.
- `git diff-tree --no-commit-id --name-only -r 26d5e892c2b401b9011234dabf86955af7462fb8`; compare `git show <original/integrated SHA>:<18 exact product paths>`.
- `git ls-tree -r --name-only HEAD -- art/factory/fp02/cutter art/factory/fp02/former art/factory/fp01/power-kit` and scoped W05 OwnRun; for each actual pointer `git show HEAD:<path>`, parse oid/size, compare file/cache SHA256+size using Python hashlib. These reads did not invoke a test/evidence verifier job.
- Python SHA256 checks on the ten delivered documents/current locks/exact native sources; targeted `sed`, `rg` reads above. No full historical file glob/hash.
