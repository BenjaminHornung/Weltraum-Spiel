# REN12-v2 native control population and frozen stronger gate

Historical v1 and bad native vertex-color image remain unchanged. The actual C1 bad/good image re-evaluation demonstrates v1's32² AO false green (.0332044<.035). Existing semantic v2 ROI rectangles were fixed before this native population: foliage crown .24/.07/.24/.22; visible water/bed .15/.62/.16/.22; solid bank .52/.22/.25/.35. Full-resolution pixels, no resampling. Source F01-HVP-COAST, DG688fda7d61d4d4a68a9917841ba8b7cb2722e04ddd6c4d9ce53039314d0b5b08, revision0, C01-EYE, tick0, srgb/exposure/tonemapper bound. Renderer drawing buffers are requested1280×720; actual compositor PNG headers and capture bindings are1280×721. ROI coordinates use the actual PNG dimensions, never rewrite the721-row screenshot as a720-row image.

Control collection ren12-native-population-02 is1/1 collection PASS, not oracle qualification. Native raw JSON SHA25641d7bd418fef34ad8624c649cd5e9e7e288c1bbfdeb89acc920e33a9e2705ab8. C0=WebGLRenderer/WebGL2; C1=WebGPURenderer forceWebGL2; C2=actual WebGPU, no fallback. Repeats and all real fault restorations have RGB-error0 at each ROI. C0→C1 MAE foliage.0302931, water.0376060, solid.0157484 within original .06 cap. C1→C2 MAE foliage.00306168, water.000773806, solid.000156282 within original .035 cap.

| Declared native fault | Actual renderer mutation | Sensitive semantic region / MAE | Original semantic caps |
|---|---|---|---|
| Vertex colors off | All native mesh material.vertexColors=false; recompile | Crown .199... with contrast reduction | REJECT |
| Missing geometry | Actual dry bank mesh detached from native scene | Solid .14... | REJECT |
| Wrong Owner pose | Actual hero group x+=1.5m | Crown .15... | REJECT |
| Wrong opacity | Actual water native material.opacity=.55→1 | Water .09..., contrast collapses | REJECT |
| Depth fault | Actual water native material.depthTest=false | Solid .0111035734; selected water ROI itself0 | Old .035 gate insensitive |

Before any held-out fault is observed, fix an additional **stronger** .005 solid RGB-response cap for same-backend CONTROL and C1→C2 only. It is above actual valid cross-backend .0001563 and below real depth-loss .0111036, preserves a30× margin over observed positive variation, and never changes source/ROI or raises a threshold. C0→C1 keeps .06 because it includes a distinct material/pipeline port with positive solid error.0157484. This gate diagnoses source-occlusion RGB response, not native depth-buffer equivalence.

Held-out population: C2 hero-owner visibility removed in its actual native scene, not previously captured or used in the calibration. The five calibration faults repeat under the frozen limits; repeats/restores and C0/C1/C2 comparisons must still pass. Require rejection of each actual fault plus the unseen C2 case. TestBridge mutations are enum-gated on testBridge=1, F01 only, exact bound source/camera/tick with strictly later native submittedFrames; each original material/property/pose/parent is restored before next fault. No time seek to1 or metadata-only fake fault.

Native final alpha is captured opaque255 and checked, not proof of all floating formats. Effective MSAA/scene-buffer/native canvas formats remain separately recorded from renderer diagnostics. Native depth-buffer readback and AO-isolated fault UNSUPPORTED, shadows/sky/water shader equivalence unqualified, performance Q0 without lease, ART=PENDING_OWNER, PRODUCT_INTEGRATED=false. Original RD11 native8/9 remains historical FAIL.

Fresh built qualification ren12-native-holdout-03:1/1 PASS, no skipped/flaky, all requested assertions executed. Each of the five actual native faults is rejected in at least its bound semantic region; the stronger solid response rejects water depthTest=false. The previously unseen C2 owner-hidden fault rejects; two repeats, five C1 restores and C2 holdout restore pass across all three ROIs, as do both declared ordered backend comparisons. Types45/build28 and synthetic focused97/97 passed. The complete native control record, originals and actual PNGs are sealed for independent review13 before candidate promotion.
