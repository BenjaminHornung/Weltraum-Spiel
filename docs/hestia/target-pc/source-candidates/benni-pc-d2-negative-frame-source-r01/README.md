# D2 nonzero source-frame correction: separate afterimages

Disposition: PARTIAL / SOURCE_HOLD. Five source afterimages implemented; compiler context and regression/runtime acceptance remain open. No normal-source integration or product adoption.
Same sole A0 Native01a13648-c55b-7250-bf07-34921d70b43b; actual CWD C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13. Git status UNKNOWN/not queried. No subagents.
Actual App turn01a14b0f-65a1-7bd2-8801-5e7b563716ce started2026-10-17T18:11:02Z. Deadline18:23:02Z including report, never reset. FINAL_RESULT records elapsed at freeze separately from artifact preparation; Root can read completed App duration after delivery.

## Delivered source

Only afterimages under after/apps/weltraum-browser/src changed:
- physics/rigidRecipe.ts: internal module export hvpObjectLocalCenterOfMass(source,center), using existing sub/scale/Vec3 and MICROVOXEL_BASE_QUANTUM_METERS. Nullorigin returns the exact input COM object. No recipe field/barrel/public mass change.
- physics/bodyCut.ts: captured contact maps against local Reader cells using projected local COM.
- physics/structuralPlan.ts: preCutCenter uses object-local COM; child/removed re-ingest, mass order, canonical hashes and save format unchanged.
- physics/branchSession.ts: initial/released render centers and local ray conversion use the same projection; native/public pose/mass remains global.
- hvp/hvpBootstrap.ts: saved drop/fragments, both restored fragment mesh paths and the later saved-inertia mesh-center subtraction use the local projection. Fresh nullorigin inertia route retains its original center.

Full paths, before/after SHA and exact line changes: INPUTS.json, SOURCE_DIFF.json and SOURCE_DIFF.patch. before/ holds exact original bytes. Normal source files were checked unchanged. No earlier private freeze was edited.

Read consumer boundaries: persistence/gameCheckpoint158-170 and worldCheckpoint145-146 keep local-cell ownership comparisons; physics/bodyCutSession371-418/556-560 and owned bodyMesh admission use newly ingested children with zero frame; physics/terrainFragment89/148-159 keeps stricter zero-origin admission; presentation/structuralPart13-18 consumes caller-projected local centers. None was changed.
The original patch application rejected an incorrect import-line context before writing; corrected exact context was then applied. No fallback contract change.

## Analytic reproduction and prepared regressions

after/apps/weltraum-browser/tests/unit/hvp-negative-frame.test.ts prepares three origin cases (-16,+16,0), using existing ingest, regular internal reconstruction with only frame origin changed, real rigid recipe/local cut, picking, author-to-world mapping and both mesh kernels.
Density512kg/m3, two globally adjacent wood cells: mass2kg and global COM remain unchanged. At origin-16, expected globalCOM(-1.875,.0625,.0625), localCOM(.125,.0625,.0625), local hit[0,0,0], remaining child worldCOMx-1.8125 and removed centerx-1.9375. Nullorigin checks exact COM object identity. Mesh Float32/metadata parity uses the existing kernels.
These are analytic expectations and NEW TEST SOURCE ONLY: all three cases NOT_RUN. No claim of reproduced runtime failure, RED/GREEN, native pose correctness or performance improvement.

## Actual static/compiler evidence

STATIC_RESULT.json: five normal sources unchanged; helper zero-origin identity present; five modified afterimages. SOURCE_DIFF records public recipe structure unchanged. No application method or test executed.
Compiler: exact previously qualified CIFI native TypeScript7 binary SHA f9ecfbdc93753d2c972d66a8d0d75f5bd737fd4a5f88b422d9091ea282bcb2c7, strict/noEmit/noEmitOnError/nonincremental; extends existing qualified PHY03-R02 declarations without stubs/relaxed flags.
- COMPILE_RESULT: Exit1,204diagnostics,1516ms owned host; terminal, complete stdout/stderr and actual handle close confirmed.
- PURE_COMPILE_RESULT: narrower recipe/plan/test selection, Exit1,191diagnostics,1375ms; same confirmed host retirement.
Both diagnostic sets remain intact. Examples are missing RigidBody/Ray/World APIs through the normal rapier021Candidate wrapper. No assertion that all diagnostics are pre-existing: no baseline comparison was run. No repair/rebinding of solver contracts or dependency installation attempted. The proposed afterimage rootDirs typecheck can also read normal dependency modules; it is not a runtime-overlay qualification.
The narrow compile reports no diagnostic in the new test/modified recipe/plan files, but whole-context failure is NOT a compile PASS.

## Concrete future pure test path for Root

PURE_TEST_REQUEST.json gives exact qualified Node/Vitest executable paths, argv, cwd, expected worker/cache effects and remaining approval/custody gate. TOOLS.json pins all three tool binaries/entries; installed qualification remains under m5-toolchain/TOOL_QUALIFICATION.json.
PURE_TEST_IMPORT_GRAPH.json records92eager-source nodes/469text-import edges,0unresolved eager-relative edges, external boundary vitest only. It is a static text graph, not full compiler/runtime resolution proof. Type-only edges are recorded but not traversed as eager effects.
test-tree/ physically materializes those92existing source modules, selecting edited recipe/plan afterimages and byte-identical unchanged dependencies; TEST_TREE_BINDINGS.json binds every source/target/hash. No agent/tool or external package was copied. This prevents accidentally testing the normal old structural plan through missing relative dependencies.
vitest.pure.config.mjs is an unexecuted configuration source using the existing installed Vitest alias. No new runner/transpiler/dependency.
Root must review the effective framework/external graph, exact one-worker invocation and process/file custody before any separate pure test grant. This source phase ran no framework, fixture, app, solver/WASM, physics, browser/GPU, Save, family or Native24.
Initial static graph preparation had two inspector bugs (dictionary projection and candidate-array grouping); failed metadata is retained with failed-r01 suffix. Corrected graph is explicitly labelled static-only; no source test was run to produce it.

## Stop / remaining work

Root next action under2min: open SOURCE_DIFF.patch and PURE_TEST_REQUEST.json; decide source review and qualify the proposed pure test invocation/context. The ordinary five normal files remain unchanged; technical integration is a separate Root decision.
Compiler binding, functional regression execution, original runtime contact/split/render reproduction and product adoption remain HOLD/NOT_RUN.
No installation, commit/push/merge, normal-source edit, historical overwrite, new owner/provider/daemon or M5-veto activation. STOP idle after final manifest.
