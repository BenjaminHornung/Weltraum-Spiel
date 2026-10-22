# Native24 containment R03: bounded Clock interval correction

Disposition: SOURCE_CLOCK_CORRECTION_COMPLETE_PENDING_INDEPENDENT_REVIEW. Actual-current admission remains HOLD / NONE_HOLD. Both JS entries, native public entry and PowerShell entry remain unconditional vetoes.

Current canonical binding: BRIDGE_BINDINGS.json SHA2fb2a1588ef4ce78597a74fb0b3017bc35ef38c1d559f084170099fbd05c55c9. Current pins: BRIDGE_SOURCE_PINS.tsv SHA0624160f991b8915ed8b98b8638773f8d45f1d5e6207192044399c40a5a2eb04. BASE_BINDINGS_R02.json is only the exact immutable derivation reference to R02's current BRIDGE_BINDINGS_FINAL.json, never obsolete R01 metadata.

## Minimal correction

At issue, request publication, existing receipt polling and immediately after awaited start receipt, the producer's private sampler executes floor(performance.now()) -> actual Date.now() -> ceil(performance.now()) in that immediate order. It does not derive UTC, add guessed tolerance, introduce a measurement loop or equate origins. Requests retain positions0-13 and append issuedMonoUpper/nowMonoUpper at14/15: exactly16fields. The private13-field supervisor receipt layout is unchanged.

Each sample lower<=upper; both lower and upper endpoints are nondecreasing across samples, with overlapping/identical brackets allowed. UTC must remain nonnegative/nondecreasing. Producer/model/native validate canonical safe integer inputs; the native reader uses checked signed-safe intermediate arithmetic. The representational offset interval is [utc-upper,utc+1-lower). Strict intersection uses max(low)<min(high); touching or disjoint intervals HOLD. Negative signed offset bounds are valid. The+1 is the approved integer-millisecond representation boundary, not hardware accuracy or guessed timing slack.

Node's own utcIssued/utcNow are separate from the earlier Native issue UTC. Only Node's erroneous equal-elapsed test is replaced. Native boot-origin checks, independent Node process-origin binding, old admission checker, custody, counter, cleanup, IPC and terminal checks remain unchanged. The producer maps nodeOverallEnd=issuedLower+entry.end-(issuedUtc+1), checks each arithmetic step and nodeWorkDeadline=nodeOverallEnd-60000. Expiration/full reserve use latest sampled upper; postawait fresh UTC is retained independently. Start reserve remains600000ms work/660000ms overall in each own domain, with all5000case/600000child/60000cleanup/1200000whole/six-lane/retry0 limits unchanged.

Behavior changes are confined to diagnostic.mjs, Native24Family.cs::ReadRequest, bridge-contract.mjs and source-guards.mjs, plus allowed fixed-path retargeting and a dedicated pure clock-guards.mjs. diagnostic-child.mjs and supervise.ps1 remain byte-identical to R02. Namespace Hestia.M5.Native24Source and the1250 original ordered role values/7 duplicates/ORIGINAL projection remain unchanged. Six new adapter pins are separate from original roles. SOURCE_DIFF.patch is the logical LF diff against frozen R02.

## Actual verification

- RED: original no-clock-jump case (floor1000->1001 with actual UTC2000000 at both reads) failed correctly on copied defective R02 logic.1PASS/1FAIL, Exit1; owned host140ms, observed command3.4037782s. The unchanged-overlapping-bracket positive already passed. Exact RED source/tests are preserved.
- Focused CLOCK_GREEN:34PASS/0FAIL, Exit0; host141ms, observed command2.990266s. This was followed by the final action-specific wire reserve check, which is covered in the final complete suite.
- Final complete GREEN:186PASS/0FAIL, Exit0; host172ms, observed command2.9991069s. This retains all150 prior invariants with deliberate interval-fixture migration, plus34 Clock checks and2 production/source checks. Counts are not summed across runs and are not native execution coverage.
- Covered Clock cases: original sameUTC/cross-monoms; identical overlapping brackets; actual UTC transition; independently specified observed sample duration; disjoint/touching offsets; backward UTC/lower/upper/inverted/missing bounds; independent Node issue UTC; wrong origins; noncanonical/unsafe/fractional/overflow inputs;16vs14fields; signed negative offset bounds; exact fresh-upper reserve versus1ms less/prewait100ms stale/expired UTC; conservative end without extension; floor/realUTC/ceil source order and matching producer/native/model fields.
- Emit-only COMPILE_R01:Exit0/no diagnostics; host1219ms, observed command2.8276641s. Native source SHA73a6dab119c44b9b66e3938e98e769e2e7e19e4ad0c23f8a42e13020d96bf6ab; DLL36864bytes/SHAed7506ab1ae8ee02aaea44365862d56a34e16d01d05757bb37f06ff36890d964. OutputAssembly/Library without PassThru; before/after loaded-assembly path inventory proves the generated DLL absent. No generated method/type/reflection/interop execution.
- Three direct PinNode22 hosts and one qualified CIFI PowerShell emit host all completed stdout/stderr, signaled termination and closed actual owned handles, with no timeout/kill. Each entire observed data submission stayed below30s; compiler below60s. Exact commands, source hashes, raw stdout/stderr/exit, actual handle receipts and tool/host times are preserved.

No hardware clock or native calibration was measured. Versioned Node/V8 documents in the approved task justify representation intervals only; no installed-binary build equivalence or physical clock accuracy is claimed. The pure fixed16-field clock validator is data consistency only, not authentication or a start capability.

## Preservation and evidence accuracy

PRESERVATION_AFTER.json reverified4007 original physical files,1250 ordered original roles/7 duplicates,2064 R11 states(1351present/713absent),50 admission files,108 containmentR01 files and83 containmentR02 files, all unchanged. The authoritative original baseline remains6e32d7f58314b006e67117bd23decac8e1286cd4b0aae307046f3076bee0e740. R02 freeze276789a1eb3023882020b7e16f435b0f9796d79071cdc7062abd35668a7138bc and current binding184d03887e6e07d4fa34c734857188bdb03de853128b13c5fc2ed0401664a1d4 were checked before deriving source; obsolete R01 metadata was not copied.

Root's R02 raw proof4d545f1ab821459436d4a710decc52844c0f331c6ed6293cc6902e32434537da preserves four chronological phase-mapping errors while its physical proof passes. Corrected proofb6fabcc1979183454a8eb328af578993c26b7f63009c85072028aa1d991b9186 closes all8 exact phase mappings. Both source documents and R02 review were read; this correction does not rewrite either.

The first CLOCK_GREEN source reconstruction trimmed a second terminal LF and therefore failed the recorded SHA check; that unbound reconstruction is retained under snapshots/clock-green. The byte-exact version under snapshots/clock-green-exact preserves both terminal LF and matches the executed ba74b5f2b8405471349cb028b5d718cc94f84ea79e46dce2f84d298c265447a3 hash. Current runtime source was never changed by this evidence repair. Final GREEN rechecks the final module.

## Identity, timing and stop

Same actual Native01a13648-c55b-7250-bf07-34921d70b43b, same worktree/branch/HEAD6ac0f61947c5a6aa3e5b156831542d8188c75c0a. Actual Paseo/workspace process bindings and full tracked Git status remain UNKNOWN; no qualified CIFI Git was executed. No original local work was overwritten.

Existing direct human source/static/data/emit approval call_f3af61fa018d45c9a7c4d05c47a7358a covers this correction. Current task SHA5203df09b8e91ee6742ee9ee352d3eed4bb34036b6f186141e9dca43f321b89f. Actual App turn01a14a43-488c-74b0-bd92-08c083b4020e started2026-10-17T14:28:05Z, deadline14:48:05Z. The later first-tool clock14:28:18 did not reset the timer. Final manifest timing is explicitly the App-start-to-manifest interval including this report; Root may separately record the complete App turn through final response.

No agents, installation, network, provider fallback/global configuration, Git mutation, database, publish, service or driver action occurred. All actual tools were qualified CIFI programs. Native/Node real runner/origin/capacity/output/containment/grant fields remain absent/HOLD. All entries remain closed. Family/fixture/framework/engine/Native24/physics/GPU/Save/app runtime and publication probes are NOT_RUN. Pi opinion remains NOT_RUN under supplied429 constraint. Independent general/native source review and Root acceptance remain OPEN. STOP idle; no automatic live or source continuation. Whole-program goal ACTIVE_INCOMPLETE.
