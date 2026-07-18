# Proposal: Browser Surface Lab Generation Input Atomicity V1

## Objective
Encode the approved narrow fix for Surface Lab generation-start input atomicity. A seed or resolution candidate is committed only after generation admission succeeds; a non-admitted start is completely inert.

## Scope
- Harden the existing Surface Lab controller start/regenerate/resolution path.
- Preserve authoritative seed/resolution, planning and generation epochs, lifecycle/failure state, published artifacts and Presentation mapping, hashes, metrics, cache decisions, and settlement state on every non-admitted start.
- Preserve current admitted lifecycle and failure semantics while making synchronous exceptions and asynchronous rejections observable and correctly propagated.
- Add focused controller tests and the required verification/review handoff.

## Non-goals and forbidden changes
- No product behavior beyond this atomicity/error-propagation contract.
- No WorkerPool, worker protocol, cache implementation, render backend, Presentation public contract, or public API changes.
- No package, lockfile, stability/config, evidence, test-data, or unrelated source changes.

## Completion gates
The implementation is verified with the full Node 22 matrix, focused scenarios, reviewer and reviewer-GLM review, completion preflight, and exactly one final human review. Commit/push/PR instructions are recorded in `tasks.md`; merge is explicitly forbidden without a separate authorization.
