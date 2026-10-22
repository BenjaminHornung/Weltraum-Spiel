# B09 correction — source freeze and pending final game replay

R01 export failed before any output: the builder assumed unbaked Blender accessor axes, but original GLB positions are already Native/runtime XYZ. The exact failure and old source hash remain in B09_R01_EXPORT.txt. R02 derives axis planes from the pinned original part boxes, validates identity node transforms and positions against original Native bounds, then exports successfully. This changes no runtime coordinate convention.

Both B09 derivatives retain600vertices/900indices/7primitives and global bounds[-1,0,-1]..[1,1.5,1]. Independent binary review confirms exactly76 shell coordinate components per GLB move1/1024m:118 proven positive coplanar shell/structure triangle pairs before,0after; all other BIN bytes, normals, indices, palette, nodes and Native bindings stay identical. Only derivative ID and moved accessor extrema change in JSON. Original assets/manifests/Goldens remain untouched.

- Closed `storage-v2.glb`:24,168bytes, SHA256 `0c8ece323ac5e15d344829043573ef76b7a6bf9d99bc2eb345f9fb49bc6b3836`.
- Inspection `storage-open-v2.glb`:24,388bytes, SHA256 `a9704c57ea973c00cde66fc216a4bd9c410bb1dec8804843790b685ff835deed`.
- Sidecar14,007bytes, SHA256 `c22bc226d26692ddc1c83ed6bb33bf9ac56424edd840c8ec753020d88b37bd3f`; `14007*4` added to both existing import-reservation formulas. Closed asset census30; existing limits unchanged.
- B09-only stock anchor: actual interior floorY0.32m plus1/1024m separation, clearX/Z±0.875m leaves5mm to original corner-post inner edges±0.88m. Existing rotation/fit/grid/freshness proofs remain; other lots retain their prior placement. This is private presentation data, no Save/Clock/Native contract change.

Freeze: Bootstrap `F2085D2E5A14C333E12AAF937997B0440D3606B3F8DCE62B777AC4BA45CAA2B5`; loader `2AB8C87791E9E1A4540F8D9847809B7D8C113A5DE57B2DDC6FB955F7ACA4A387`. Fresh TypeScript PASS; full loader72/72PASS (1.89s), both new B09 byte/overlap parity cases PASS (520ms). Focused admission tests and independent final integration review are pending.

R04 cleanV6 partial actual evidence proves normal RAW16 payment, moving8kg packet, Cutter and Former distinct work poses and600ms Pause freeze, original Save19 unchanged and no page errors. It also preserves the two B09 defects, so it is not final visual acceptance. Fresh cleanV7 build plus allfive actual views, complete fresh16kg/brace flow, original Save19/cold-browser replay remain mandatory.
