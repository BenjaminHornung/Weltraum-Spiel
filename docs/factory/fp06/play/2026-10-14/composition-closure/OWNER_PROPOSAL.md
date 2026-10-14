# Proposed next integration window: owned Factory data

**OWNER_REVIEW_PENDING. No product write is authorized by this document.**
Prepared against actual local `a89c1991aa148ff77d001d204de6a3e56fda13ef`,
branch `codex/hestia-fp06-play-candidate-2026-10-12`. Root would be the sole
Integrator/writer; W04/W08/W09 paths require one exclusive window. This is a
new internal composition contract, not another global serializer experiment.

## Evidence and boundary

The unmodified output-blockage test fails its original 5,000 ms gate: 14.27 s
in today's unprofiled test phase. The profiled run takes 20.91 s and is
attribution only. In the test worker, `structuredClone` costs about 5.7 s and
canonical serialization remains another large cost. Production/belt proposals
and newly created Dry state/receipt shells repeatedly copy complete already
checked subtrees. Module return values cannot be trusted merely because they
are frozen: current producers retain caller references and their freeze
helpers stop on already-frozen children. Removing the clone would weaken the
existing nested-Proxy and mutation guards.

The existing C1 safety grant explicitly states:
`IfFAIL noautomaticnewprofile/cache/refactor/limitincrease`. Its product write
set is empty. The subsequent two serializer windows were rejected and reverted.
They do not authorize this new cross-package contract. No such window is opened
by automatic goal continuation or this proposal.
Today's new read-only V8 attribution is recorded separately. It does not
inherit or reopen the closed C1 profile allowance; no further profiling runs.

Source: control worktree
`docs/factory/fp06/play/2026-10-12/grants/play-06-c1-safety-final.json`.
Review: `INDEPENDENT_REVIEW.md`. Measurements are under
`apps/weltraum-browser/evidence/factory/play/2026-10-14/composition-attribution/`.

## Contract to implement if granted

Introduce one internal, render-independent Factory data builder/proof module.
It proves data ownership and immutable structure, never material, power,
World membership or transaction authority.

- Only an audited fresh literal/array allocated by the builder may receive
  private provenance. Registering an arbitrary passed-in object is forbidden.
- Every object child must already have successful defensive proof or take the
  existing full admission path. Reused or spread fields do not become trusted
  from their producer name, `Object.isFrozen`, receipts or caller flags.
  Successful proof means the existing full anti-Proxy clone proof or audited
  fresh allocation plus already proven children. W04's descriptor-only
  `isImmutableProductionData` and `checkedProposals` membership do not qualify
  as proof of absence of nested Proxies.
- Mutable data, restored JSON, copied proposals, forged frozen objects,
  accessors, cycles and nested Proxies retain the current defensive path.
  Inputs are not frozen or mutated merely to gain a fast path.
- Private provenance and derived-byte caches are weak, ephemeral, and not
  serialized. Recreated/restored objects must earn fresh proof.
- Public Resources canonicalization keeps fresh deep-clone behavior, exact
  numbers, lexical numeric keys, getter/iterator order, dense-index checking,
  IteratorClose and cycle errors. No new intrinsic assumptions are allowed:
  changed inherited array iteration must disable reuse and fall back.
- W04/W08 producers explicitly establish ownership of new nodes and reused
  children. Dry may reuse only those proofs for its own new shells. Imported
  arbitrary public results continue to be re-evaluated.
- Current binding, tick interval, material contents, source definitions,
  receipt/history, packet custody and paid energy remain fully checked. Output
  canonical bytes, signatures and replay behavior must match the baseline.

## Exact proposed write set

All paths below are relative to `apps/weltraum-browser/`:

1. `src/factory/internal/ownedData.ts` — new private Factory proof/build helper.
2. `src/factory/session/dryFactorySlice.ts` — proved fresh state/receipt shells.
3. `src/factory/production/productionStep.ts` — explicit result provenance.
4. `src/factory/conveyor/beltReference.ts` — explicit result provenance.
5. `tests/unit/factory/ownedData.test.ts` — new adversarial ownership tests.
6. `tests/unit/factory/dryFactorySlice.test.ts` — appended guards only; the
   original paid-band block remains byte-identical.
7. `tests/unit/factory/production.test.ts` — borrowed/forged-result regressions.
8. `tests/unit/factory/conveyor.test.ts` — borrowed/forged-result regressions.

Additional outputs are confined to
`docs/factory/fp06/play/2026-10-14/composition-closure/` and
`apps/weltraum-browser/evidence/factory/play/2026-10-14/owned-data-candidate/`.
The global
Resources serializer, catalogs/recipes, historical material receipts, Golden
values, Save, native World/Physics, terrain, renderer, dependencies, queues,
timeouts and all power/transport/physics budgets are excluded.

## Bounded gates

One production candidate, no additional CPU profiling, one unchanged original
paid-band pair after implementation. No automatic repair loop after failure.

1. Add and execute expected-failing tests for the proposed owned-data seam.
   Exercise borrowed mutable children, accessors, nested frozen Proxies,
   prototype/iterator changes, cycles and caller-frozen forgeries.
2. Implement the smallest helper and audited producer integration. Preserve
   public copied/forged-proposal re-evaluation and all existing reject paths.
3. Run ownership, production, conveyor, Dry and canonical boundary tests;
   compare complete material/power/production/band receipt bytes and signatures.
   Explicitly filter both original paid-band cases from this preliminary Dry
   run and record their filtered counts. They run only in step 4's single pair.
4. Run both original paid-band cases, with original limits, original scenario
   and no concurrent browser/build/art work. FAIL means reject and revert the
   candidate, retaining tests/evidence as appropriate.
5. If that gate passes, execute affected regressions, normal build, independent
   source/contract review and ordinary production-build player flow.

Removing only clone cost cannot prove the required speedup. The measured
serialization cost remains substantial; no PASS is promised. Native transport
also has a separate current failure: 341 kg pickup succeeds, but the first
loaded move enters SimulationHold. This proposal does not grant a Physics,
renderer or timing-policy change and does not claim that it fixes that hold.

W09 must still complete the actual fresh 16 kg loop, blackout and output-block
cases. W10 remains behind W09, and W11 must independently report Functional,
UI, Save, Visual, Gameplay and Performance. No W12–W29 or publication.
