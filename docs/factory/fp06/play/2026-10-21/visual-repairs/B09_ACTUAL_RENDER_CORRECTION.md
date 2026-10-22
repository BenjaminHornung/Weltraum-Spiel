# B09 actual render correction — bounded continuation

Actual cleanV6 startup and paid RAW16 transfer now work, original Save19 remains readonly. Normal actual packet3 (8kg) moved1125→1500mm over30Native ticks, with the same render representation updated from WorldZ9.375→9.0m. Pause froze both Native tick and full material projection for600ms. No new performance run.

Actual `R04_B09_OPEN_RAW16_ACTUAL_STOCK.png` plus independent source/GLB inspection confirm two remaining material-integration defects. Stock placement incorrectly uses closed body.maxY1.5m, so its world bottom3.04m floats above roof3.0m. Existing B09 GLBs have coplanar EX-SHELL roof/side faces and EX-STRUCT corner posts, producing visible serrations. Closed and open are correctly exclusive; the green patch alone proves no further defect.

Approved task-local implementation scope:

1. Private B09 inspection-stock placement uses the existing model's actual interior floor top (aboutlocalY0.32m) and clear interior bounds. Confirm exact geometry first. Keep the existing bounded grid, positive fit, rotation, current accessible Cargo/Native/catalog/container proof and material family identity. This changes render coordinates only; no saved representation, Collider, source plant or domain change.
2. Derive two tiny B09 surface corrections (closed/open) from the pinned existing GLBs, reusing the Distributor Surface-V2 exporter/provenance/closed-loader pattern. Only proven coplanar shell faces move inward by the minimum1/1024m separation; structural extrema preserve original Native envelopes, profiles and parts. Preserve indices/normals/material colors/source files/old manifests/Goldens. No topology replacement or new asset package.
3. Existing sole runtime integrator `fp06_writer` owns Bootstrap and closed loader integration/cost accounting, plus narrowly relevant loader assertions if needed. `fp06_ui_writer` owns only derivative art/public files and the existing derivative parity test. No overlap, no third writer. Root owns all execution. Both writers stop after frozen source/hash/diff-check; no tests/build/runtime/children.
4. Additional derivative sidecar bytes and actual staging/retained copies are charged before admission under unchanged caps. Existing original IDs and files remain valid; new visual derivative IDs are ephemeral, never written into Saves. No Clock or public/schema/security contract change.

Root retains failed cleanV5 and current cleanV6 evidence, independently reviews exact source/asset delta, repeats focused boundary checks, builds a fresh clean final copy and repeats ordinary direct visual/production/Save19/cold-browser acceptance. Current unsaved test stock is disposable; original primary slot must not be overwritten. No general architecture/assets expansion.
