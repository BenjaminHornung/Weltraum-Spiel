# Capability: Atomic Surface Lab Generation Inputs

## Requirement: Non-admitted starts are inert
Given an active Surface Lab generation, when pure candidate/request staging or running/disposal preflight fails, or when `WorkerPool.setPlanningEpoch(candidatePlan)` throws/rejects, then generation has not been admitted and the call leaves the authoritative seed/resolution, planning and generation epochs, lifecycle/failure state, artifacts and Presentation mapping, hashes, metrics, cache state and settlement state unchanged.

## Requirement: Candidate commit follows admission
Given valid candidate inputs, after pure candidate/request staging and successful running/disposal preflight, when `WorkerPool.setPlanningEpoch(candidatePlan)` succeeds, that successful call is the generation admission point. The controller then commits the candidate exactly once before issuing the admitted generation's individual chunk enqueue attempts, and all normal current-generation lifecycle, stale, cancellation, artifact, hash, metric, cache and Presentation rules remain in force.

## Requirement: Errors remain observable
Synchronous validation, candidate-preparation, running/disposal-preflight, or `setPlanningEpoch` exceptions SHALL propagate to the caller and SHALL remain pre-admission; they SHALL NOT be recorded as chunk failures or swallowed. Asynchronous start or worker-replacement rejection before admission SHALL reject its public promise without an unhandled rejection; disposal remains terminal. After admission, each individual chunk enqueue attempt retains the existing tested per-chunk partial-failure semantics, and a rejected ticket promise is handled as a failed chunk without rolling back the admitted generation, swallowing the error, or creating an unhandled rejection. Genuine admitted terminal failures retain normal failure semantics.

## Focused scenarios (all eight required)
### Scenario 1: invalid seed is atomic
Given a settled generation, when `regenerate` receives an invalid seed, then it rejects synchronously and every authoritative and observable value remains unchanged.

### Scenario 2: invalid resolution is atomic
Given a settled generation, when `setResolution` receives a value other than `0.25` or `0.5`, then it rejects synchronously and no input, epoch, ticket, metric, cache, artifact, or presentation value changes.

### Scenario 3: stopped-pool admission is atomic
Given valid candidates but a non-running/stopped pool, when generation admission is attempted, then it throws/rejects without committing candidates or mutating the prior generation.

### Scenario 4: synchronous pre-admission exception propagates
Given a synchronous exception during candidate preparation or pre-admission checks, including `setPlanningEpoch`, then the exception reaches the caller; it is not converted into a failed chunk, swallowed, or followed by a candidate commit. An exception from an individual chunk enqueue after successful `setPlanningEpoch` admission instead follows the existing tested post-admission per-chunk partial-failure semantics and does not roll back the admitted generation.

### Scenario 5: async start rejection is observable
Given an asynchronous start or worker-replacement rejection before a new generation is admitted, then the public promise rejects, no unhandled rejection is emitted, and prior authoritative state remains intact.

### Scenario 6: disposal race stays terminal
Given disposal wins while an awaited start or worker replacement is pending, then the controller remains `Disposed`, performs no post-disposal commit/enqueue/publish/settlement replacement, and the rejection is handled according to the public promise contract.

### Scenario 7: admitted candidate commits once
Given valid inputs and pure candidate/request staging followed by successful running/disposal preflight, when `WorkerPool.setPlanningEpoch(candidatePlan)` succeeds, then that call admits the generation; seed/resolution are committed exactly once, the new epoch and normal tickets are created, individual chunk enqueue attempts begin, and telemetry reflects only the admitted generation.

### Scenario 8: admitted failure keeps normal semantics
Given an admitted generation with an individual enqueue failure, rejected ticket promise, or synchronous/asynchronous terminal job failure, then the existing failure/partial/settlement behavior is preserved; the failure is handled as post-admission, does not roll back the admitted generation, is not swallowed or left unhandled, and is not misclassified as a non-admitted atomic rejection; prior-generation artifacts are not resurrected.

## Verification requirement
Focused controller tests must assert before/after snapshots for all eight scenarios and prove no WorkerPool/public contract change. Full verification is the Node 22 matrix named in the task contract.
