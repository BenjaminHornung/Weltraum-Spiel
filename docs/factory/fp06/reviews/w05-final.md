# W05 final independent technical closure

**SPEC PASS / QUALITY PASS for the sealed W05 technical S0 slice. R1, R2, R3 and the identified P2 front-guard overlap are closed.** This is technical source/runtime/asset acceptance; human Owner Art acceptance remains NOT_RUN and is not claimed or made an additional gate. Final Git/LFS/package binding is a separate Root receipt.

Reviewer `/root/w11_evidence` performed only static reads, byte/hash/JSON inspection and individual views of existing actual PNGs. No tests, build, browser/server jobs, product changes or subagents. Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11`, base `10e1e3026610065206d8ac4b361d3f1686114dd8`.

Both earlier reports remain immutable: first FAIL `/workspace/.cloud-setup/fp06-w05-independent-review.md` SHA256 `6eeac7986ceec0461331f30051ad82b9beaefe674a009e1ce221500c01165633`; first follow-up `/workspace/.cloud-setup/fp06-w05-review-followup.md` SHA256 `b11e8dbb3c66a9e017806219b79d41a54f42751f54a9018a81c5612850f1e2d1`.

## Final seal and unchanged authority

Receipt `/workspace/.cloud-setup/fp06-w05-product-working-hashes.json`: sealed `2026-10-11T11:33:23.919680+00:00`, SHA256 `acc3db45b9817d5ef6294bcdf32aef0277400d3531086e6d30e60b20c8405d23`. Actual patch SHA256 equals the receipt: `a2bc3b99b0d15698474787f75946938f86a49e56f7af16a9d89bfcdb364404d0`. All 18 product files' actual bytes/SHA256 match; the exact six W05 grant roots remain sufficient.

`factoryAssets.ts` SHA256 `5b014f69d2e5240cfacf8fe5d5fe749c1e6494ddf317d29ef9106460585357bb` and `machinePose.ts` SHA256 `c426f01ae087004a1eacde662de0c5da7c22f18410d5900d2ca20e840cae111b` are identical to the prior reviewed R1/R2 seal. Former native source remains SHA256 `4e27abd922e46516d1db0307b8dfb5edaf1b8c6807e80006781344b9dfcf535d`. Confirmed-work-only animation, WAIT_POWER freeze, surviving live part filtering, paid support/load paths and full press-stroke contact remain accepted. The narrow JSON changes do not touch the paid frame/support mechanisms or phase profile. Definition/BOM freeze and source-solid ports remain unchanged; no Host, Cargo/Resources, shared Physics, renderer authority, schema/config or recipe change is introduced.

## R3 exposed sockets and exact metadata binding

The corrected sockets sit on paid beams with positive-area support contact instead of being contained in their volumes:

| Asset | Render socket bounds | Paid support / exposure | Actual authoring port face center |
| --- | --- | --- | --- |
| Wind `wind_power_socket` | X=.25–.5, Y=.5–.75, Z=1.25–1.5m | Base beam top Y=.5; socket bottom contacts it; exposed +Z face at1.5m above beam | `[.375,.625,1.5]`, normal `[0,0,1]` |
| PV `solar_power_socket` | X=-.125–.125, Y=.75–1, Z=1.25–1.5m | Frame top Y=.75; socket bottom contacts it; exposed +Z face at1.5m above frame | `[0,.875,1.5]`, normal `[0,0,1]` |

The actual source port coordinates were corrected along with the geometry; they were not assumed unchanged. Both centers equal their box's front-face center, size=.25×.25m, role=PowerProducer, binding=authoring-only. A point .001m outward is clear of every other native box, as asserted by the new actual exposure/access oracle `presentation.test.ts:230`. Source footprint/whole asset bounds stay unchanged: PV4×3m footprint, height1.25m; Wind nominal6m/13m sweep envelope and actual static AABB width5.0131397247m,height12.75m. This does not activate electrical or collider authority.

The semantic `authoring-v1.json` documents deliberately contain Snap markers referencing part IDs, not independent pose coordinates. `power-kit/authoring-v1.json:252` references `solar_power_socket`; `:257` references `wind_power_socket`. Both referenced parts exist in current native source. Therefore their unchanged semantic hashes are correct for the moved geometry; no stale semantic center is hidden in the document.

All three current authoring document hashes still exactly match the actual 3/3 Draft202012 schema validation receipt `authoring-schema-validation-postreview.json`: Cutter `0cdb071fb15c5b7c5ee57fa5f10685b8919b741adbe0d10c5e7f47f93cca1a61`; Former `31500d6c38d06be22226940222c8abcba5d2e9e48483e36293910da71575c34b`; power-kit `ebab668ca024e995b8742021f4440886c10b51ba58a5c7520de37a6bc87c7dd8`. Unchanged schema SHA256 `981d883c1147673211b155af72d4f080012b76acd0c13864035644e8e5ca6c36`. No fresh schema execution is claimed. Each final derived report's native/semantic hashes match actual current bytes and its ports match current source, including the corrected face centers. Procedural original-project license/provenance remains unchanged.

## P2 narrow Cutter correction

The two front chamber guards move inward by .125m: center Z=.75→.625m, unchanged thickness .25m. Their exposed +Z plane is now .75m instead of sharing the posts' .875m plane. This stays within the existing shell/envelope, retains paid geometry, ports and support/load paths. The individually viewed actual final night capture shows the former chamber/front-post speckled strip resolved. No broader cosmetic iteration is included in this gate.

## Actual final proof, read without running jobs

Run root `apps/weltraum-browser/evidence/factory/w05/run-20261011T104359Z/`:

| Evidence | Actual result |
| --- | --- |
| `red-review-exposed-socket.raw.log.gz` /exit1 | Before source correction at11:30:47, one collected exposure/binding test failed with15 passing. Real mismatched face-center and embedded-access assertions, not import failure. Raw gzip SHA256 `82499756df4e0a2c300e9e2c0e56b9dd31fea8c3fe8306fd9a226fbb225edbf8`. |
| `green-final-sockets.raw.log.gz` /exit0 | Final focused16/16, one file,11:30:49,884ms overall. Raw SHA256 `bed18e9bf26b791a5b537b004cd2adf4cad39703e3dcfbc738eb18f4db230b10`. |
| `build-final-sockets.raw.log.gz` /exit0 | Actual tsc+Vite PASS, Vite1.67s; unchanged existing chunk warning. Raw SHA256 `8d1fd26165f01dc04e3c65c0f2fc4422d3a7b506fd61b05a0a20ab6935f55656`. |
| `final-sockets/browser-probe.raw.log.gz` /exit0 | Actual1 Chromium PASS,8.4s test/9.7s run;26 actual PNGs,24 capture metadata entries. Raw SHA256 `db52359a852a9c413e971b24fe5a41f4197c268c34798140449d1226fb66ab07`. |
| `final-sockets/browser-probe-result.json` | SHA256 `babe923e4ece3011fb820e75829b6d0ffdcb307d02e6221b720dbf8483fdb462`;100 actual WebGL+ThreeBackend cycles, each12 geometry allocations/disposals and4 material allocations/disposals. Every recorded active representation, owned CPU byte, actual owned canvas listener and GPU geometry returns0;pageErrors[]. |

The earlier46/46 affected regressions remain explicitly earlier, with unchanged backend; no rerun is invented. The final probe retains two RAFs/exact DOM caption checks and original30s/5s/20s timeout configuration. It is a synthetic S0 asset probe, not normal paid `/factory.html` gameplay, a performance target measurement or human art approval.

Individually viewed actual final captures, with verified exact caption/file SHA256:

- `final-sockets/synthetic_probe_fp01_wind_s0_v1-socket-close.png`: `cba2cdd6fd49a1407b4f3468335b16e1c8f12f5edc2754ba00fb5d6f163b38b4`; clean exposed teal socket face, connected paid base.
- `final-sockets/synthetic_probe_fp01_solar_s0_v1-socket-close.png`: `13071bc10aa14a05d5821d6b6f5faa1f9cfe6258ce9138f61a73f849024f33de`; clean exposed teal socket face, connected paid frame.
- `final-sockets/B06-night-low-dpr1.png`: `96601a21c02b84482a277abacf82d87c5c2f9aa5a1fab584299b62e1fcf9d8c7`; correct Cutter caption, inset guards no longer share front-post face.

HVOX compilation, Blender, human Owner Art acceptance and normal gameplay admission remain NOT_RUN; these are declared limits, not invented technical W05 handoff blockers. No new source, authority or conservation invariant finding remains in this narrow final closure. Root may complete the separate final Git/LFS/package binding and authorized technical handoff.
