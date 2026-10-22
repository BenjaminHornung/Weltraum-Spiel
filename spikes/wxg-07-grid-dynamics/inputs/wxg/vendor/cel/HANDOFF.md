# CEL-01-WXG-00 handoff to WXG/ATM and A0

Entry: README.md, then REPORT.md, receipt.json and runner-profile.json. Fixed source 17b1db4201a28e7b607c30707bdc2b75e3484a10; branch feature/cel-01-wxg-00-2026-10-09. Execution LOCAL_WINDOWS_ISOLATED. Product integration NO; A0 alone integrates. This is a finite validator/read candidate, not accepted planetary weather.

## Frozen consumer package

Use src/types.ts, src/contracts.ts, generated model-pin.ts, unchanged snapshot/product/** and closed vendor/plt/**, SourceBindings.json, fixtures/{profiles,schema-goldens,read-goldens-input}.json, own package/locks and README build. The real emitted entry is dist/src/contracts.js with declarations. Verify every local source/tool/compiled binding immediately before import; do not import mutable producer paths at runtime. The profile binds the actual implementation digest, so swapping code/profile hashes is rejected. Copy only the closed files needed by your consumer; keep the full receipt/seal pointers for audit.

PLT producer receipt SHA256 5842f1c2b781c1ce65a347ec45c28da0717215537ebd45ee100b3a255429555a, 13793 bytes. Profile file SHA256 c7652cc948a0f213a8a29ff75bdb0a76ede71344c315f924fcc541e6f7ead551 differs deliberately from semantic contentDigest 64e7977f9b510d74aa61fc37edae076c94ef7a3d0fda09b1fd9cf14e364bb714. Producer seal SHA256 b4c0daf90e5c91e4f6811e47b08f32dcfc39b2e932b1e9f34fc53c4009586c6d; all 102 sealed files were verified. No producer mutation. PLT's scalar/SIMD WASM remains only its upstream byte/load probe.

## Concrete reproduction

From this spike directory:

```powershell
$node = 'C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe'
& $node scripts/seal.mjs --check
& $node scripts/tool-bindings.mjs --check
& $node scripts/repro.mjs --run-id consumer-check-unique
```

The repro adds new evidence and thereby changes the dirty tree: run seal --check before adding a run when validating this delivered exact diff; afterwards produce a new separate seal if that new state is to be reviewed. Existing run IDs fail closed. Raw positive and negative logs are retained. Parent/orchestrator owns transfers; no other chats were contacted.

## Exact diff / authority

After final documentation/task state, scripts/seal.mjs writes ignored detached `.runtime/final-seal/scope-seal.json` and `review.patch`. The seal binds every changed tracked/staged/unstaged/nonignored-untracked path plus the complete semantic Git index. Dependency/compiler/dist bytes are separately bound in DependencyBindings/receipt/build manifests. Detached seal avoids receipt/hash self-reference. Any later content/index change invalidates it.

Human Plannotator approval for the exact final diff is NOT_REQUESTED; no commit or push is authorized/performed. No fake approval or merge-ready claim. Normal product typecheck retains FAIL_MODULE_NOT_FOUND. The own slice's 72/72 and strict typecheck are separate evidence. Receipt creation verifies current tested source/fixture/type/module and raw-log bytes; it rejects a historical PASS with stale inputs.

## Remaining finite work

No GPU prerequisite for this card. Runner may repeat the same bounded pure functional profile on an actual target with exact source/tool inputs, serially; missing tools/producer/device proof report NOT_RUN/UNSUPPORTED. No reference performance run is requested by this handoff. Before any real catalogue integration, A0 binds actual atmosphere/substance data, product Core/Save/Flight tests and versioned body-profile references described in PRODUCT_PATCH_CANDIDATE.md. Header/SAB/ARM/deployment and large HVP qualification remain untouched separate gates.
