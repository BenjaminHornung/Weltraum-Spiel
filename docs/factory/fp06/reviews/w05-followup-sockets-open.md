# W05 independent follow-up — bound seal 11:21:31Z

Reviewer: `/root/w11_evidence`. Read-only review; no tests, build, browser, server or product writes executed by this reviewer. Reviewed domain worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11`, base `10e1e3026610065206d8ac4b361d3f1686114dd8`.

**Decision: R1 PASS; R2 PASS; R3 semantic admission PASS but visible-socket QUALITY FAIL. W05 independent gate remains blocked by the concrete R3 rendering defect below.** Native authoring/schema, real GPU import and cleanup have actual passing receipts. Human Owner Art acceptance remains NOT_RUN and is not substituted by this technical review.

The initial FAIL report `/workspace/.cloud-setup/fp06-w05-independent-review.md` is preserved unchanged, SHA256 `6eeac7986ceec0461331f30051ad82b9beaefe674a009e1ce221500c01165633`. This document evaluates a later candidate and does not erase the earlier findings or initial passing synthetic captures. The withdrawn initial caption-mismatch suspicion was a multi-image association error, not a proven capture failure.

## Exact snapshot and scope

- Product receipt `/workspace/.cloud-setup/fp06-w05-product-working-hashes.json`: sealed `2026-10-11T11:21:31.422712+00:00`, SHA256 `4f7a345d7987e90ad029a5426e0d39de00a7096b0eb624421983fdb154008fb6`.
- Patch `/workspace/.cloud-setup/fp06-w05-product-working.patch`: actual/expected SHA256 `40cb5b0a0608073c9ad5822dc2224819f55d409ab6ad577a0ef6266fdbf865bd`.
- All 18 actual product byte sizes and SHA256 values match the receipt; files remain within the six exact granted roots. Runtime WRITE HOLD was respected. Catalog/definition/BOM, Host, Cargo/Resources, Physics and schema have no changes from the stated base. Electrical null geometry in the W01 definition is not populated by these authoring markers.
- Own-run `manifest.json` now exists, SHA256 `dc6368ec4e7d01acf40e099817f7789309b8ae6245ce1214af55f23243b98f05`. Its 18 product hashes and 109 listed evidence hashes/sizes match actual local bytes. Root owns final staged/LFS/package admission; that receipt is separate from this visual finding.

## Closed R1: paid visible support and force paths

Source requirements remain FP02 Cutter/Former layouts (FP02:539–567), FP03 visible ground contacts/load paths (FP03:176–186) and no floating Former press plate (FP02:561). Exact original source hashes remain recorded in each native source; no new free C09 or inventory material is introduced.

`art/factory/fp02/cutter/source.scene.json:79`: four new paid frame blocks span Y=.25–.5m, closing the former shoe-to-frame gap. They meet the shoes with positive X/Z area at Y=.25 and the raised beams at Y=.5. The two bed sections are incorporated in the same paid frame part. Original 3×2×2.5m bounds, four ground patches and the 1m Solid ports/openings remain unchanged.

`art/factory/fp01/power-kit/source.scene.json:951`: two 3m base crossbars at Z=±1.25 and a central 3m fore/aft beam span Y=.25–.5m. Every corner shoe contacts a crossbar, the central beam joins both crossbars and overlaps the mast starting at Y=.25. This fixes the disconnected mast/feet while retaining the paid kit footprint.

`art/factory/fp02/former/source.scene.json:79`: lower side beams and transverse supports join the original bed (bottom Y=.5m) to the four portal posts and shoes. The bed is no longer suspended between posts. `:279` adds two telescopic proxy rods to the same tool part. At offset d∈[-.5,0], each rod spans Y=[2+d,2.75+d] while the corresponding fixed actuator spans Y=[2.25,2.5]; they retain positive-area X/Z contact for the entire stroke, including contact at Y=2.25 for d=-.5. The rod overlaps its moving plate throughout. Actual whole-tool sweep is Y=1.25–2.75 inside the 3m asset. No structural solver/collider authority is claimed.

## Closed R2: actual phase motion from confirmed work

The sources declare version-1 phase ends matching unchanged source recipes: B06 `[5000,7000,24000,27000,30000]`; B07 `[6000,10000,30000,35000,40000]`. These are animation profiles over existing confirmed work, not shortened timers or new recipe authority.

`src/factory/presentation/machinePose.ts:15` reads only immutable source projection, confirmed work and authoritative surviving part IDs. Infeed carriages translate X by .25m/.5m; separate clamps lower .25m and hold/retract; outfeed carriages move and return during the source outfeed interval. Cutter tool follows its original Z work travel; Former tool makes two bounded .5m presses. Channel endpoints are continuous; offsets remain within the actual source envelope. Presentation time does not advance work. WAIT_POWER and every unchanged-work sample hold the same pose. Invalid work/part IDs reject; missing live tool parts are filtered out and never reconstructed by sampling.

`tests/unit/factory/presentation.test.ts:161` now checks real nonzero infeed/clamp/outfeed poses, frozen WAIT_POWER samples and translated bounds at phase boundaries and representative samples. Source analytic extrema also stay inside the envelope. `:188` checks bed contact; `:204` covers the two press minima at 15s/25s and other work positions. Production module remains a pure read projection; no Host/World/Cargo/energy writes or renderer-authorized receipts.

## Open R3: fully embedded, coplanar socket boxes

FP01:837 requires protected Wind Power-Out at the foot; FP01:857 requires protected PV Power-Out at the frame. The new source ports and native Snap markers now exist and correctly remain authoring-only. The source/authoring/derived SHA bindings match. However, the new render marker boxes do not provide a stable exposed face:

| Marker | Actual marker box | Containing structural box | Consequence |
| --- | --- | --- | --- |
| `solar_power_socket` (`power-kit/source.scene.json:717`) | X=[-.125,.125], Y=[.5,.75], Z=[1.25,1.5] | `solar_frame` (`:622`), X=[-2,2], Y=[.5,.75], Z=[-1.5,1.5] | Entire socket lies inside the frame; front and top faces coincide exactly. |
| `wind_power_socket` (`:1101`) | X=[.25,.5], Y=[.25,.5], Z=[1.25,1.5] | front base beam (`:993`), X=[-1.5,1.5], Y=[.25,.5], Z=[1,1.5] | Entire socket lies inside the beam; front and top faces coincide exactly. |

The individually viewed fresh PV capture shows an irregular thin teal strip on the front beam, and Wind shows a tiny teal coincident strip at its base. Exact coplanar overlapping triangles make marker visibility dependent on depth tie behavior; a stable visible socket is not established. `presentation.test.ts:222` checks a PowerProducer authoring port and nonempty marker boxes only, so the passing test cannot catch this defect. This is a concrete render geometry correction within existing W05 roots, not a new product choice or Owner-approval requirement. Close R3 with a noncoincident exposed marker surface while retaining source footprint, paid/native-authoring semantics and unchanged W01 electrical definition, then bind fresh focused/schema/build/GPU evidence to the corrected seal.

Additional P2 proxy polish observation: the fresh Cutter player/night images show speckled chamber/upright overlap strips. Cutter front posts and front chamber panel both have outer face Z=.875m with overlapping X=.625–.75m and Y=1.875–2.375m (`cutter/source.scene.json:79` and its chamber boxes). This predates R1/R2 repairs. It is recorded as a technical rendering limitation, independently of human art style acceptance; Root may decide its relevance to the current technical proxy gate.

## Actual verification read, without rerunning

Evidence directory: `apps/weltraum-browser/evidence/factory/w05/run-20261011T104359Z/`. Logs are losslessly preserved as `.raw.log.gz` plus actual exit receipts; the reviewer read the decompressed bytes.

| Actual receipt | Result / scope |
| --- | --- |
| `red-review-r1-r2.raw.log.gz` | 11:13:55, 3 real assertion failures / 9 passing, exit 1; ground paths and phase movement. |
| `red-review-former-forcepath.raw.log.gz` | 11:15:43, 5 real assertion failures / 9 passing, exit 1; adds bed and full-stroke force-path failures. |
| `red-review-r3-markers.raw.log.gz` | 11:16:38, 6 real assertion failures / 9 passing, exit 1; adds missing Power-Out markers. |
| `green-review-bounds.raw.log.gz` | 11:19:25, 15/15, 1 file, exit 0, 966ms overall. Actual source-bound focused run. |
| `authoring-schema-validation-postreview.json` | 3/3 exact current authoring documents; unchanged Draft202012 schema SHA256 `981d883c1147673211b155af72d4f080012b76acd0c13864035644e8e5ca6c36`. Receipt SHA256 `cd27926a697bded77a509f64ad5795f8f65807083f8eab0e2278fa23f4f75d44`. |
| `build-postreview.raw.log.gz` | actual `tsc -p tsconfig.json && vite build`, exit 0; Vite1.84s and existing chunk-size warning. |
| `post-review/browser-probe.raw.log.gz` | 1 Chromium test PASS,8.3s test/9.6s run, exit0. Actual fresh 24 PNGs /22 metadata entries. |
| `post-review/browser-probe-result.json` | SHA256 `ff4300b8c071e3deb623030b0ae85fee99d89f0de76125ad810814a844dc7827`;100 actual WebGL+ThreeBackend cycles, each12 geometry allocations/disposals and4 material allocations/disposals. All active representations, ownedCPU bytes, actual ownedcanvas listeners and GPU geometries return0;pageErrors[]. |

The original 9/9 focused run,46/46 affected backend/HVP regressions and7.2s GPU test are pre-repair evidence, explicitly retained as such. The 46 regressions were not rerun after source/pose fixes; backend code is unchanged. The focused100-cycle unit test uses the real backend/geometry/material leases with a renderer stub; its separate never-registered HVP listener registry is not a strong listener oracle. The fresh GPU probe observes actual canvas registrations and real WebGL geometry memory, providing the meaningful owned-listener cleanup evidence.

Fresh probe `post-review/probe.spec.mts:11` waits two actual RAFs and asserts exact asset/status/phase DOM text before each screenshot. The configuration keeps the original30s test/5s expect/20s server-start limits. It is a synthetic asset probe, not paid normal UI gameplay or normal `/factory.html` admission.

Individually viewed fresh files (each correct caption; no multi-image association):

| File under `post-review/` | SHA256 | Observed technical content |
| --- | --- | --- |
| `B06-player-idle.png` | `09ed0d67213318eaa60717ba8a8c80508e3ae99e6d5c07eb11abe8934ff0ab0b` | Cutter shoes/frame connected; chamber overlap speckle remains. |
| `B07-run-24000.png` | `95a8b1f86bc124ffff5be98479e474cffbffe181b87f7a09cc75644bc3b4ab04` | Correct Former RUNNING/work, rods visible and load path retained. |
| `synthetic_probe_fp01_wind_s0_v1.png` | `14d0839d059dca9aed5f88f60e9c1f60a702cd71f251df8a405e6257d8fc98b5` | Mast/base arms connected; socket strip has coplanar overlap. |
| `synthetic_probe_fp01_solar_s0_v1.png` | `782204877bed27d3a13963d934fe7a1c444ff42433c9f5956688e3d5cc61dcf7` | Four-panel PV proxy; socket appears as irregular coincident strip. |
| `B06-night-low-dpr1.png` | `b0afbcb696a4a81dd1aff0913ace33588028d837681c6cd19082522d5d0ce71b` | Correct Cutter caption, dim light/DPR1; chamber overlap strip remains. |

Derived reports now bind the actual current native source and semantic SHA256 values for all three packages. They correctly separate Wind nominal6m rotor/13m sweep envelope from actual static posed AABB width5.0131397247m,height12.75m; no false static6m-width, rotor animation, energy generation or FPS claim. License remains procedural `LicenseRef-Hestia-Project-Original`, with no third-party asset provenance invented.

Normal gameplay, real game damage/physics collisions, W07 energy admission, W09 production flow, W10 save/recovery, W11 regression/performance evidence, HVOX compilation, Blender and human Owner Art acceptance remain outside the passing synthetic probe. No new Owner gate is inferred from those limits. Current blocker is only the concrete exposed-socket render defect above (plus Root's disposition of the reported P2 overlap limitation).
