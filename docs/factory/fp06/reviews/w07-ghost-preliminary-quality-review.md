# W07 Bootstrap ghost quality review — provisional before namespace followup

Reviewer `/root/w00_repo_audit`; readonly source/unit/byte and existing log inspection. No tests, builds, browsers, native/profiling/verifier jobs, product/evidence edits, commits or subagents.

**CODE_QUALITY: FAIL — open P1 identity-namespace finding below.** The resident-pose/revision repair is otherwise consistent with the actual receiver lifecycle. This is an interim candidate review, not a final 29-file seal, package, normal-browser or future-build PASS. The subsequently authorized namespace counterexample/fix is a separate pending phase.

## Exact initial/end bytes and observed authorized test change

Base/current branch HEAD is `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Initial inspected runtime `apps/weltraum-browser/src/hvp/hvpBootstrap.ts`: SHA256 `874946ad624ed6e16b27befd9b16b9772508c3e416d8585fc7dd11b049e819ba`, 165644 bytes; same runtime SHA/size at the end read. Initial unit `tests/unit/hvp-bootstrap.test.ts`: `b5d11db5a6ed690947722eac5b7d2bb1138401ad0a46d27cef723c1177bfd9c6`, 66749 bytes. End unit read: `d7445d8636ea9c22158754b69feef796c4966d39de2c398950ff2a5c6afbcede`, 70673 bytes, after Root explicitly authorized the new namespace RED following phases 61/62. This is authorized later test development, not an unauthorized-write finding; no current full-byte PASS is inferred. At both checks only these two paths differed from the eighth 29-file seal; the other **27** bytes still matched that prior receipt.

## P1: Ghost slot IDs collide with valid paid instance IDs

`hvpBootstrap.ts:2188` uses `ghost_slot_0` … `ghost_slot_5` as derived ghost IDs. `resources/ids.ts:48–52` explicitly admits such lowercase/underscore IDs for resource/native identities. `factory/presentation/factoryAssets.ts:92` creates the same `factory:${instanceId}:${partId}` representation namespace for ghost and paid scenes; `hvpBootstrap.ts:2230/2248` also keys both costs by that same ID.

Concrete static trigger: a resident B06 ghost has ID `ghost_slot_0`; an otherwise valid paid B06 placement uses native/installed instance ID `ghost_slot_0`. Its paid projection addresses the resident ghost's exact keys with artifact revision 1 but different ghost/paid material ranges/content identity. The actual receiver can reject that paid Upsert at the existing ghost revision. More seriously, the failed stage's `dropFactoryScene(scene)` removes the shared cost/managed-key bookkeeping under that ID while the original resident ghost remains referenced, so the live ghost no longer has independent admission bookkeeping. Unique paid/native identity must not be invalidated or credited by a derived preview identity.

This is a real reachable contract alias under the ID grammar, not a hyphenated invalid-ID example and not a claim that the normal generated `facility_*` UI IDs already hit it. Root's proposed bounded internal IDs `ghost:slot_0` … `ghost:slot_5` separate this representation namespace from native IDs because `:` is rejected by the native/resource ID grammar but supported by renderer representation keys/asset projection instance metadata. That change can preserve paid native IDs, source versions, quantities, and all existing caps. It is a technical proposal pending its genuinely collected receiver counterexample, minimal fix, new byte seal and review.

## Boundaries otherwise supported by the current delta

- Same-definition move/quarter-turn at lines 2242–2243 changes only the existing ghost transforms and publishes projection. It performs no Upsert/Remove or material acquire/release; actual receiver unit assertions verify pose and unchanged geometry/material allocation/disposal counters.
- Six closed source-definition slots replace request/paid-ID-derived preview identities; one ghost is resident at a time. Safe-integer revision admission is checked before replacing a ghost. Cancel/repreview consumes monotonically increasing derived artifact revisions, with unchanged SourceRevision and mesh content hash; repeated same-definition transforms do not consume revisions.
- A new slot attempt increments its revision before staging. Accepted partial parts are captured in `scene.artifacts`; failure calls the existing retire/release path, then removes managed keys/cost. A later attempt uses a higher revision than every accepted part from the failed attempt. This static cleanup reasoning is limited by the P1 shared namespace collision above. Direct switch/partially rejected-stage tests were **NOT_RUN by this reviewer** and are not claimed as unit PASS.
- Artifact source/frame binding remains the existing common Host frame, source-local geometry and immutable source bytes. Native/Resources/material/paid identity handling and fixed/global caps are unchanged by this presentation repair; the open alias finding affects the shared presentation/cost key boundary rather than creating World authority.
- The existing teardown releases resident and staged scenes and plain leases; actual lifecycle unit uses the real `ThreeRenderBackend` receiver/ledger with only WebGL driver stubbed, then checks renderer disposal once, backend Disposed and zero RAF callbacks. Its Native/Cargo transport fixture is explicitly synthetic, so it is not native LOS/walking/material-conservation or real browser evidence.

## Actual evidence read, not rerun

Evidence root: `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`. Actual command metadata, exit, decompressed raw SHA/size and normalized readable/raw logs bind for phases 59–62:

| Phase | Recorded actual result | Decompressed raw SHA256 |
| --- | --- | --- |
| `59-red-actual-render-receiver-ghost-lifecycle` | exit 1, **1 assertion FAIL /34 SKIP**; actual receiver rejects moved ghost with `RepresentationRemovedAtRevision` before repair | `909ba35099060387672bc8318c484fc897cb9de5cf468d6178ed546809c85b95` |
| `60-green-actual-render-receiver-ghost-lifecycle` | exit 0, **1 PASS /34 SKIP**, wrapper 10.117277814 s; resident pose and repeated lifecycle | `2a8baf8a56c204332b1133f43f96ac2d3a832b9212df85473e64276c28ad1ef7` |
| `61-green-ghost-affected-regressions` | exit 0, **91 PASS /5 files**, 239.83 s Vitest; read after actual completion | `386a4002e32b35c8608037b37c3f8c2cc9a5f96551f4ba354bf97d0a2af58a42` |
| `62-build-after-ghost-receiver-fix` | exit 0, actual full TypeScript/Vite build; read after actual completion | `fb1271c75315621ee2a0b045a897c539bd3f3a84d60857b4fc9e56a50529d4aa` |

The ES2022-compatible test query `filter(...).at(-1)` is the current initial unit byte phase for 61/62. The end unit now includes separately authorized later namespace counterexample bytes; 61/62 do not certify those later bytes. No namespace RED/GREEN, normal ninth browser result or future final seal is fabricated. Prior eighth input review remains its own immutable receipt. A fresh narrow namespace closure and final 29-file seal binding are required before this quality finding can be closed.
