# Surface Interaction Core Capability

## ADDED Requirements

### Requirement: Stable renderer-independent interaction contracts
The system SHALL expose `InteractionActorId`, `InteractionTargetId`, `InteractionRevision`, `InteractionCapabilityId`, `InteractionToolId`, `InteractionVerb`, `InteractionTargetSnapshot`, `InteractionActorContext`, `InteractionCandidate`, `InteractionDecision`, `InteractionBlockReason`, `InteractionSession`, `InteractionProgress`, `InteractionCompletionRequest`, `InteractionResult`, and `InteractionEvent` as immutable, serializable contracts independent of UI, renderer, scene, and world mutation authority.

`InteractionVerb` SHALL contain exactly `Inspect`, `Scan`, `Extract`, `Repair`, `Open`, `Close`, `Activate`, `Deactivate`, `Pickup`, `Place`, and `Transfer`.

#### Scenario: Snapshot boundary
A target snapshot contains stable target ID/revision, owner/claim, legal state, hazard summary, supported verbs, and required capabilities. World/physics supplies evaluated distance, line of sight, reachability, and focus rank without supplying positions.

#### Scenario: Unknown contract values
Unknown verbs, unknown required capabilities, malformed IDs/revisions, unsupported values, and non-finite numeric inputs fail closed and never gain interaction authority.

### Requirement: Deterministic interaction evaluation
`evaluateInteraction(candidate, context)` SHALL return exactly `Allowed`, `Blocked`, or `Unavailable` without mutating its inputs. Blocked decisions SHALL use only `OutOfRange`, `NoLineOfSight`, `NotReachable`, `MissingCapability`, `MissingTool`, `InsufficientEnergy`, `InsufficientResource`, `HazardTooHigh`, `PermissionDenied`, `IllegalWithoutOverride`, `TargetBusy`, `TargetStale`, `ActorIncapacitated`, or `ModeConflict`.

Checks SHALL have stable precedence: target identity/revision; actor identity/state/revision; range/line-of-sight/reachability; capability/tool; energy/resource; hazard/permission/legal; then verb-specific rules.

#### Scenario: Multiple failures
When several checks fail, evaluation returns the reason from the earliest precedence layer and produces the same decision and hash for equivalent inputs.

#### Scenario: Tool versus capability
A required capability and a required tool are independently evaluated: lacking the capability returns `MissingCapability`, while possessing it but lacking the tool returns `MissingTool`.

#### Scenario: Permission versus legality
Permission and legal override are independent. A missing permission returns `PermissionDenied` before an otherwise illegal action returns `IllegalWithoutOverride`.

#### Scenario: Hazard warning and block
A hazard at or below explicit tolerance may produce a deterministic warning; a hazard above tolerance returns `HazardTooHigh` and grants no authority.

#### Scenario: Candidate ordering
Equivalent candidate sets resolve in deterministic rank order, with stable `InteractionTargetId` as the final tie-break.

### Requirement: Explicit integer-tick sessions
Only integer `InteractionTick` values SHALL govern interaction progress. An Allowed decision SHALL include `requiredHoldTicks`, `interruptPolicy`, `movementToleranceClass`, `damageInterrupts`, and `focusLossInterrupts`. Start, advance, cancel, and complete operations SHALL be pure and SHALL expose all progress.

#### Scenario: Zero-tick hold
An interaction with `requiredHoldTicks` equal to zero is immediately eligible for an explicit completion request without hidden advancement.

#### Scenario: Monotonic progress and early completion
Progress advances monotonically by explicit integer ticks, never exceeds required hold ticks, rejects regressing or invalid ticks, and cannot complete before the requirement is met.

#### Scenario: Policy interruption
Movement outside the declared tolerance, damage, or focus loss interrupts exactly when the locked policy says it does and produces a deterministic cancellation/result without mutation.

#### Scenario: Stale authority
Completion requires the exact actor and target revisions locked by the session. A stale actor or target fails closed.

### Requirement: Atomic external mutation intent
Completion SHALL emit only a deterministic atomic mutation intent/result containing expected revisions, consumed finite nonnegative canonical energy/resources, generated capability/discovery facts, semantic events, a result code, and next action. External owners SHALL remain responsible for applying mutations.

#### Scenario: Successful completion
A valid completed session returns one canonically ordered intent whose expected revisions match the session and whose costs, generated facts, events, result code, and next action are deterministic.

#### Scenario: No-op result
Blocked, unavailable, cancelled, interrupted, early, or stale outcomes return no mutation intent and do not consume energy/resources or generate facts/events that claim mutation.

### Requirement: Canonical immutable outputs
Equivalent inputs SHALL produce byte-stable serialization and hashes. Inputs SHALL remain unchanged and public outputs SHALL be frozen. The core SHALL not import or use Three.js, DOM authority, `Date`, randomness, wall clocks, hidden global registries, raycasts, animation, inventory transfer, positions, or world mutation.

### Requirement: Mandatory verification coverage
Automated verification SHALL explicitly cover all of the following 18 cases:

1. deterministic decisions and hashes for equivalent inputs;
2. stable target-ID final tie-break;
3. every closed block reason;
4. independent tool-versus-capability behavior;
5. hold tick zero;
6. integer monotonic progress;
7. movement, damage, and focus policy interruptions;
8. no early completion;
9. stale target and stale actor fail closed;
10. no-op outcomes contain no mutation;
11. permission versus legality precedence;
12. hazard warning versus hazard block;
13. canonical finite nonnegative costs;
14. immutable inputs and frozen outputs;
15. absence of Three.js, DOM, Date, and Random authority;
16. serialization and hash stability;
17. unknown verbs and capabilities fail closed;
18. normal-browser proof without TestBridge authority.

### Requirement: Normal-browser proof fixture
A focused Playwright test SHALL load the normal route, confirm TestBridge has no authority, dynamically import the interaction module, and execute a deterministic fixture containing a locked cargo door, resource node, repair terminal, and an actor with scanner and cutter. Scan SHALL be allowed, Extract SHALL be blocked without energy, Open SHALL require hold progress, and completion against a stale revision SHALL be rejected. The test SHALL write timestamp-free JSON/Markdown evidence and no screenshot, and SHALL not be added to an E2E CI group.
