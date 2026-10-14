# Independent source review of the approved candidate

Reviewer: `/root/composition_contract_readonly`, read-only. Root is the sole implementation writer on `codex/hestia-fp06-play-candidate-2026-10-12`, base `9724ba4f66be54afa560b3e398dab17ae2c8bfc1`.

Initial review found and Root corrected three concrete issues before the reserved paid-band pair:

- A cold serializer proof could probe an ArrayProxy before its virtual iterator. Byte reuse now requires existing private provenance; unknown values enter Resources directly. Builders do not probe unknown children.
- Copying a borrowed frozen accessor job or packet rejected a previously valid defensive path. Unproved borrowed roots retain their identity and original path. Ignored symbol/nonenumerable data fields remain unproved and use the original serializer.
- Comparing inherited iterator/next values could invoke accessors, and IteratorClose could be omitted after an inherited return was added. Checks now compare descriptors without getter reads and disable reuse for inherited return.

Final reviewer verdict: **No further blocking correctness issues found in the corrected source.** Audited ownedArray call sites receive local dense arrays; public copied/forged proposal re-evaluation and warm-cache checks remain intact. This is a source review, not performance acceptance. The reviewer ran no tests, profiles, builds or browsers and wrote no files.

Reviewed exact SHA-256:

| Product path | SHA-256 |
| --- | --- |
| `src/factory/internal/ownedData.ts` | `c74ac6d96fc841a645872ea9ed7d5d2a742967f5a650fe26a468a9dcd727f7fa` |
| `src/factory/session/dryFactorySlice.ts` | `a6a710e75ed81769a2c82a46c975e376db0d79a0caa552558681fd0193e1246a` |
| `src/factory/production/productionStep.ts` | `a897f02f937115ab6bddc478a204b0076e71885c47f6df8b8eb81726c2fbf243` |
| `src/factory/conveyor/beltReference.ts` | `93b492fd35da6bf549dc187b8ac5ff082d8f9b9c1f94b81702b945be5f72f161` |

Raw test logs and complete reference bytes are under `apps/weltraum-browser/evidence/factory/play/2026-10-14/owned-data-candidate/`. The original performance pair is separately binding; a source-review PASS cannot replace it. The native 341 kg SimulationHold remains unresolved.
