# Read-only contract analysis

Reviewer: `/root/composition_contract_readonly`, actual delegated agent.
No writes, tests, profiles, builds, installations or candidate changes by the
reviewer. Source-only hypotheses are not runtime acceptance.

The observed high clone cost is intentional defensive work. Dry's
`isImmutableData` caches proven descendants, but each new root still calls
`structuredClone(root)` over the whole graph. Root shells arise from imported
production/belt outputs, state-core wrappers, next state and final receipts.
Simply removing the clone or trusting frozen objects would weaken existing
nested ArrayProxy and membership-change protections.

The narrow local possibility is private provenance for audited freshly
allocated Dry shells whose children already have successful defensive proof.
Arbitrary arguments, unproven spread children and external proposals must keep
the current full path. Its speed benefit is not established by source review.

Larger savings need an explicit owner seam across W04/W08/W09: production
outputs retain current material, input binding and prior job; belt outputs
retain line binding/installation and material plans. Their freeze helpers
stop at already-frozen objects. A module's return does not prove ownership of
every descendant. Provenance must establish reused children and preserve all
current bindings, receipt/history checks and external result re-evaluation.

Provenance of canonicalizer-created trees alone does not cover the entire
graph. It must preserve the public fresh clone and generic getter/iterator,
density, IteratorClose, cycle, numeric-key and exact-number contracts. Frozen
canonical arrays still inherit mutable Array.prototype; a broad fast path
needs explicit intrinsic/iterator bounds and fallback.

Repeated Resources state/snapshot reconstruction and complete belt material
projections are real secondary costs. The profile does not justify a new
state-cache candidate alone. No speculative serializer candidate is recommended.

Reviewed source locations: Dry `:34–46, :76–82, :222, :260, :270, :273,
:276–278, :300`; Production `:80–82, :340–347`; Belt `:60–65, :123–127,
:276–279`; Power source adapter `:40–59`; Resources containers `:256–272`;
material snapshot adapter `:51–55`. These are source line citations, not
V8-transformed profile line numbers.
