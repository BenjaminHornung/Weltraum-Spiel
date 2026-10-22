# Owned Dry state byte alias v1

Composition cause candidate 2 of at most 3; decision 17 October 2026.
C01 was rejected: unchanged W09 pair test time 6.08 s versus 6.14 s, no useful
gain demonstrated. Its exact patch and measurement remain historical.

prepareDryFactoryStep already serializes the fully frozen `next` core to
nextStateBytes. Its returned proposal.state differs only in the root lastStep;
dryStateBytes explicitly excludes that field. Reuse these exact bytes by adding
proposal.state to the EXISTING private stateBytes WeakMap, only inside the
existing full isImmutableData(state/material/proposal) and dataOnly(input)
ownership branch. That proof rejects accessors, mutable graphs and Proxies.
The alias shares an already retained string; it adds no new public representation,
weaker hash comparison, admission shortcut, unbounded strong cache or output.
Canonical bytes, state/material receipts, fresh input binding and external
proposal recomputation remain unchanged. No Clock policy, cap or timeout change.

Baseline attribution found 81 prepares and approximately 4.78 million UTF-16
units per next-state binding. The next prepare reconstructs the same preceding
core unnecessarily. This establishes a concrete reuse opportunity, not a timing
claim. No additional profile is permitted by this decision.

Writer scope: src/factory/session/dryFactorySlice.ts and meaningful existing
dryFactorySlice compatibility tests only. Preserve all historic byte Goldens.
Verify owned next-state/base-state equality, replay and external/mutable guards;
run the same ORIGINAL unprofiled W09 paid-band pair after the patch, with no
other game/test workload. Parent owns exact-diff review and acceptance. Reject
if no useful measured gain or any behavior regression; preserve failed evidence.

## Result

Parent same original unprofiled pair: 2 PASS, 40 filtered SKIP (one added guard
test), 5.91 s tests / 6.36 s total versus immediate baseline 6.14 / 6.77 s.
The observed 3.7% test-time reduction is small and is not a statistical, browser
FPS or per-step-latency claim. Retain the bounded exact alias because it avoids
reconstructing the proven repeated 4.78-million-unit core without adding a new
cache or validation shortcut. No third speculative candidate follows.
Native independent exact-diff review: no blockers. TypeScript, 19 focused guard
tests and production build pass. The writer's first invocation also ran the
whole 42-test file before narrowed steering arrived; all passed. That redundant
run is disclosed and does not count as isolated timing evidence.
